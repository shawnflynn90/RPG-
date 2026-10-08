import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { Combat } from '../systems/Combat.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { NPC, Prop, Chest, Gate, Pickup } from '../entities/Props.js';
import { DIR_VECTORS } from '../entities/Actor.js';
import { PLAYER, GAME } from '../config/game.config.js';

const Rect = Phaser.Geom.Rectangle;

/** Tiled custom properties come as [{name, value}] - turn them into a plain object. */
function propsOf(obj) {
  const p = obj.properties;
  if (!p) return {};
  if (Array.isArray(p)) return Object.fromEntries(p.map((x) => [x.name, x.value]));
  return { ...p };
}

/**
 * Plays any map listed in world.json: towns and dungeon rooms alike.
 * Everything in the map comes from its Tiled object layer(s) - see README "Building maps in Tiled".
 */
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.mapId = data.mapId;
    this.spawnName = data.spawn || null;
    this.startPos = data.pos || null;
    this.startFacing = data.facing || null;
    this.transitioning = false;
    this.inCutscene = false;
    this.bossFightActive = false;
  }

  create() {
    this.ui = this.scene.get('UI');
    const def = DB.world.maps[this.mapId];
    if (!def) throw new Error(`Map "${this.mapId}" is not listed in data/world.json`);
    this.mapDef = def;

    // ---- tilemap ------------------------------------------------------------------
    const cacheKey = `map:${this.mapId}`;
    if (!this.cache.tilemap.exists(cacheKey)) {
      this.cache.tilemap.add(cacheKey, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: DB.maps[this.mapId] });
    }
    const map = this.make.tilemap({ key: cacheKey });
    this.map = map;
    const tilesets = map.tilesets.map((ts) => map.addTilesetImage(ts.name, `tileset:${ts.name}`));
    this.collisionLayers = [];
    map.layers.forEach((ld, i) => {
      const layer = map.createLayer(ld.name, tilesets, 0, 0);
      const p = propsOf(ld);
      const name = ld.name.toLowerCase();
      const isAbove = name === 'above' || name === 'overhead' || p.above === true;
      layer.setDepth(isAbove ? 100000 : i);
      layer.setCollisionByProperty({ collides: true });
      if (/wall|collision|block/.test(name) || p.collides === true) layer.setCollisionByExclusion([-1]);
      this.collisionLayers.push(layer);
    });
    const W = map.widthInPixels;
    const H = map.heightInPixels;
    this.physics.world.setBounds(0, 0, W, H);

    // ---- systems & groups -------------------------------------------------------------
    this.combat = new Combat(this);
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.npcGroup = this.physics.add.group({ collideWorldBounds: true, immovable: true, pushable: false });
    this.propGroup = this.physics.add.staticGroup();
    this.gateGroup = this.physics.add.staticGroup();
    this.pickupGroup = this.physics.add.group({ collideWorldBounds: true });
    this.enemies = [];
    this.npcs = [];
    this.interactables = [];
    this.warps = [];
    this.gates = [];
    this.spawns = {};
    this.boss = null;

    for (const layer of map.objects) for (const obj of layer.objects) this.createObject(obj);

    // ---- player -----------------------------------------------------------------------
    const sp = this.startPos || this.spawns[this.spawnName] || Object.values(this.spawns)[0] || { x: W / 2, y: H / 2 };
    if (!this.startPos && this.spawnName && !this.spawns[this.spawnName]) {
      console.warn(`Map ${this.mapId} has no spawn named "${this.spawnName}"`);
    }
    this.player = new Player(this, sp.x, sp.y - 4);
    this.player.facing = this.startFacing || sp.facing || Game.s.facing || 'down';
    this.player.play4('idle');
    this.entryPoint = { x: this.player.x, y: this.player.y };
    Game.s.mapId = this.mapId;

    // ---- collisions -------------------------------------------------------------------
    const blockers = [...this.collisionLayers, this.gateGroup, this.propGroup];
    this.physics.add.collider(this.player, [...blockers, this.npcGroup]);
    this.physics.add.collider(this.enemyGroup, blockers);
    this.physics.add.collider(this.npcGroup, blockers);
    this.physics.add.collider(this.pickupGroup, blockers);
    this.combat.addBlockers(blockers);

    // ---- camera -----------------------------------------------------------------------
    const cam = this.cameras.main;
    const bx = W < GAME.width ? -(GAME.width - W) / 2 : 0;
    const by = H < GAME.height ? -(GAME.height - H) / 2 : 0;
    cam.setBounds(bx, by, Math.max(W, GAME.width), Math.max(H, GAME.height));
    cam.startFollow(this.player, true);
    cam.setRoundPixels(true);
    cam.fadeIn(180, 0, 0, 0);

    this.events.emit('map-entered', this.mapId, def);
    this.scene.get('HUD').attachWorld(this);
  }

  // ======================================================================== object layer
  createObject(obj) {
    const type = obj.type || obj.class || '';
    const p = propsOf(obj);
    let x = obj.x;
    let y = obj.y;
    const w = obj.width || 0;
    const h = obj.height || 0;
    if (obj.gid) y -= h; // tile objects are anchored bottom-left in Tiled
    const cx = w ? x + w / 2 : x;
    const cy = h ? y + h / 2 : y;
    const rect = new Rect(x, y, w || 16, h || 16);

    switch (type) {
      case 'spawn':
        this.spawns[obj.name] = { x: cx, y: cy, facing: p.facing };
        break;
      case 'warp':
        this.warps.push({ rect, map: p.map, spawn: p.spawn, facing: p.facing });
        break;
      case 'npc':
      case 'shop':
      case 'teacher':
      case 'healer': {
        const npc = new NPC(this, cx, cy - 4, p.sprite || 'npc_elder', p);
        npc.npcType = type;
        npc.name = obj.name;
        this.npcGroup.add(npc);
        this.npcs.push(npc);
        this.interactables.push({ bounds: () => npc.hurtbox(), run: () => this.talkTo(npc), isNpc: true });
        break;
      }
      case 'sign': {
        const s = new Prop(this, cx, cy, 'sign');
        this.propGroup.add(s);
        this.interactables.push({ bounds: () => s.bounds(), run: () => this.ui.say(String(p.text || '...').replace(/\\n/g, '\n')) });
        break;
      }
      case 'chest': {
        const flagId = p.id || `chest:${this.mapId}:${obj.id}`;
        const contents = {};
        for (const k of ['weapon', 'spell', 'item', 'count', 'gold', 'maxHp', 'maxMp', 'flag']) if (p[k] !== undefined) contents[k] = p[k];
        const c = new Chest(this, cx, cy, flagId, contents);
        this.propGroup.add(c);
        this.interactables.push({ bounds: () => c.bounds(), run: () => this.openChest(c) });
        break;
      }
      case 'enemy':
        this.spawnEnemy(p.enemy || obj.name, cx, cy);
        break;
      case 'boss': {
        const id = p.boss || obj.name;
        const bdef = DB.bosses[id];
        if (!bdef) {
          console.warn(`Unknown boss "${id}" in map ${this.mapId}`);
          break;
        }
        if (Game.flag(`boss:${id}`)) break; // already beaten
        this.boss = new Boss(this, cx, cy, id, bdef);
        this.enemyGroup.add(this.boss);
        this.boss.body.pushable = false;
        this.enemies.push(this.boss);
        break;
      }
      case 'gate': {
        const g = new Gate(this, rect, p);
        this.gateGroup.add(g.sprite);
        this.gates.push(g);
        if (p.text) this.interactables.push({ bounds: () => g.bounds(), run: () => (g.closed ? this.ui.say(p.text) : null) });
        break;
      }
      default:
        if (type) console.warn(`Map ${this.mapId}: unknown object type "${type}" (${obj.name})`);
    }
  }

  spawnEnemy(id, x, y) {
    const def = DB.enemies[id];
    if (!def) {
      console.warn(`Unknown enemy "${id}" (check data/enemies.json)`);
      return null;
    }
    const e = new Enemy(this, x, y, id, def);
    this.enemyGroup.add(e);
    this.enemies.push(e);
    return e;
  }

  spawnDrops(x, y, drops) {
    for (const d of drops) {
      if (Math.random() > (d.chance ?? 1)) continue;
      const amount = Array.isArray(d.amount) ? Phaser.Math.Between(d.amount[0], d.amount[1]) : d.amount || 1;
      const pk = new Pickup(this, x, y, d.type, amount);
      this.pickupGroup.add(pk);
      pk.body.setDrag(120, 120);
      const a = Math.random() * Math.PI * 2;
      pk.body.setVelocity(Math.cos(a) * 30, Math.sin(a) * 30);
    }
  }

  // ======================================================================== interaction
  /** Called by the player on A: talk / open / read if something is right in front. */
  tryInteract() {
    if (this.inCutscene) return true;
    const pl = this.player;
    const f = DIR_VECTORS[pl.facing];
    const b = pl.body;
    const probe = (reach) =>
      f.x !== 0
        ? new Rect(f.x > 0 ? b.right : b.left - reach, b.top - 4, reach, b.height + 4)
        : new Rect(b.center.x - 5, f.y > 0 ? b.bottom : b.top - reach - 4, 10, reach + 4);
    const near = probe(PLAYER.interactReach);
    // Second, longer probe for people only, so you can talk across shop counters.
    const far = probe(PLAYER.talkReach);
    const target =
      this.interactables.find((it) => Rect.Overlaps(near, it.bounds())) ||
      this.interactables.find((it) => it.isNpc && Rect.Overlaps(far, it.bounds()));
    if (!target) return false;
    input.consume('A');
    this.cutscene(() => target.run());
    return true;
  }

  /** Freeze the world while an async sequence (dialogue, menus...) runs. */
  async cutscene(fn) {
    if (this.inCutscene) return;
    this.inCutscene = true;
    this.player.body.setVelocity(0, 0);
    this.player.play4('idle');
    this.scene.pause();
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      this.inCutscene = false;
      if (this.scene.isPaused()) this.scene.resume();
      input.consume();
    }
  }

  dialogue(id) {
    const d = DB.dialogue[id];
    if (!d) return { pages: [`(missing dialogue "${id}")`], speaker: null };
    const v = (d.variants || []).find((x) => Game.check(x.if));
    const src = v || d;
    if (src.setFlag) Game.setFlag(src.setFlag);
    return { pages: src.pages || d.pages, speaker: src.speaker || d.speaker || null };
  }

  async talkTo(npc) {
    npc.talking = true;
    npc.body.setVelocity(0, 0);
    npc.faceTowards(this.player);
    const p = npc.props;
    try {
      if (npc.npcType === 'shop' || npc.npcType === 'teacher') {
        const table = npc.npcType === 'shop' ? DB.shops : DB.teachers;
        const id = p[npc.npcType];
        const shop = table[id];
        if (!shop) return this.ui.say(`(missing ${npc.npcType} "${id}")`);
        if (p.dialogue) {
          const d = this.dialogue(p.dialogue);
          await this.ui.say(d.pages, d.speaker);
        }
        await this.ui.say(shop.greeting || 'Welcome!', shop.name);
        await this.openMenuScene('Shop', { kind: npc.npcType, id });
      } else if (npc.npcType === 'healer') {
        const d = this.dialogue(p.dialogue || 'healer');
        await this.ui.say(d.pages, d.speaker);
        const price = p.price || 0;
        const q = price ? `Rest for ${price} gold? (Heals and saves)` : 'Rest and save your progress?';
        const i = await this.ui.ask(q, ['Yes', 'No'], d.speaker);
        if (i === 0) {
          if (Game.s.gold < price) return this.ui.say("You don't have enough gold.");
          Game.s.gold -= price;
          Game.heal();
          Game.s.respawn = { map: this.mapId, pos: { x: this.player.x, y: this.player.y } };
          this.recordPosition();
          const ok = Game.save();
          await this.ui.say(ok ? 'HP and MP restored. Your progress has been saved.' : 'HP and MP restored. (Saving failed!)', d.speaker);
        }
      } else {
        const d = this.dialogue(p.dialogue);
        await this.ui.say(d.pages, d.speaker || npc.name);
      }
    } finally {
      npc.talking = false;
    }
  }

  async openChest(c) {
    if (c.opened) return this.ui.say('The chest is empty.');
    const lines = c.open();
    this.combat.puff(c.x, c.y - 6, 0xf8e060, 8);
    await this.ui.say(lines.length ? lines : ['The chest is empty.']);
  }

  /** Launch a menu scene over the paused world and wait for it to close. */
  openMenuScene(key, data = {}) {
    return new Promise((resolve) => {
      this.scene.launch(key, { ...data, onClose: resolve });
      this.scene.bringToTop('UI');
    });
  }

  recordPosition() {
    Game.s.mapId = this.mapId;
    Game.s.pos = { x: this.player.x, y: this.player.y };
    Game.s.facing = this.player.facing;
  }

  // ======================================================================== map changes
  goTo(mapId, spawn, extra = {}) {
    if (this.transitioning) return;
    if (!DB.world.maps[mapId]) {
      this.ui.toast(`Map "${mapId}" doesn't exist yet`);
      return;
    }
    this.transitioning = true;
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      Game.s.pos = null;
      this.scene.restart({ mapId, spawn, ...extra });
    });
  }

  // ======================================================================== boss fight
  maybeStartBoss() {
    const b = this.boss;
    if (!b || b.engaged || b.dead) return;
    const moved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.entryPoint.x, this.entryPoint.y) > 28;
    const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y) < 110;
    if (moved || near) {
      this.bossFightActive = true;
      for (const g of this.gates) g.refresh();
      b.engage();
      this.ui.toast(b.def.name, 1400);
      this.events.emit('boss-start', b);
    }
  }

  async onBossDefeated(boss) {
    this.bossFightActive = false;
    this.events.emit('boss-end', boss);
    // death throes: flashes and puffs (the world keeps running so the effects animate)
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 120, () => {
        if (!boss.active) return;
        boss.flash(60);
        this.combat.puff(boss.x + Phaser.Math.Between(-12, 12), boss.y + Phaser.Math.Between(-12, 12), 0xf8e060, 6);
      });
    }
    await new Promise((r) => this.time.delayedCall(1000, r));
    this.combat.puff(boss.x, boss.y, 0xffffff, 16);
    boss.destroy();
    this.boss = null;
    Game.setFlag(`boss:${boss.id}`);
    const r = boss.def.reward || {};
    const lines = [`You defeated the ${boss.def.name}!`, ...Game.grant(r)];
    if (r.message) lines.push(r.message);
    for (const g of this.gates) g.refresh();
    this.cutscene(() => this.ui.say(lines));
  }

  // ======================================================================== death
  onPlayerDeath() {
    this.cutscene(async () => {
      this.player.setTint(0x808080);
      await new Promise((r) => setTimeout(r, 700));
      await this.ui.say('You collapsed...');
      Game.heal();
      const r = Game.s.respawn;
      this.transitioning = false;
      this.scene.resume();
      this.goTo(r.map, r.spawn, r.pos ? { pos: r.pos } : {});
    });
  }

  // ======================================================================== update
  update(time, dt) {
    Game.s.playTimeMs += dt;
    if (this.transitioning || this.inCutscene) return;

    if (input.pressed('pause')) {
      this.recordPosition();
      this.cutscene(() => this.openMenuScene('Pause'));
      return;
    }
    if (input.pressed('map')) this.ui.toast('Map screen coming in a later milestone!');

    this.player.update(time, dt);
    if (this.inCutscene) return;
    for (const e of this.enemies) if (e.active) e.update(time, dt);
    this.enemies = this.enemies.filter((e) => e.active);
    for (const n of this.npcs) n.update(time, dt);
    this.combat.update();

    const pl = this.player;
    if (!pl.dead) {
      const pb = new Rect(pl.body.x, pl.body.y, pl.body.width, pl.body.height);
      // contact damage
      for (const e of this.enemies) {
        const dmg = e.def.contactDamage;
        if (!dmg || e.dead) continue;
        const eh = e.hurtbox();
        Rect.Inflate(eh, -eh.width * 0.2, -eh.height * 0.2);
        if (Rect.Overlaps(eh, pb)) pl.hurt(dmg, e.footX, e.footY);
      }
      // pickups
      for (const pk of [...this.pickupGroup.getChildren()]) {
        if (Rect.Overlaps(pb, pk.getBounds())) {
          this.combat.puff(pk.x, pk.y, 0xf8f8a0, 4);
          pk.collect();
        }
      }
      // warps
      for (const w of this.warps) {
        if (Rect.Overlaps(w.rect, pb)) {
          this.goTo(w.map, w.spawn, w.facing ? { facing: w.facing } : {});
          break;
        }
      }
    }
    this.maybeStartBoss();
  }
}
