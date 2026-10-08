import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { Combat } from '../systems/Combat.js';
import { Audio } from '../systems/Audio.js';
import { Lighting } from '../systems/Lighting.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { NPC, Prop, Chest, Gate, Pickup, Pot, Switch, Torch, Door, Block, ItemPickup } from '../entities/Props.js';
import { DIR_VECTORS } from '../entities/Actor.js';
import { PLAYER, GAME } from '../config/game.config.js';

const Rect = Phaser.Geom.Rectangle;

/** Tiled custom properties come as [{name, value}] - turn them into a plain object. */
export function propsOf(obj) {
  const p = obj.properties;
  if (!p) return {};
  if (Array.isArray(p)) return Object.fromEntries(p.map((x) => [x.name, x.value]));
  return { ...p };
}

/** A map's settings: world.json entry, with Tiled map properties as fallbacks. */
export function mapSettings(mapId) {
  const def = DB.world.maps[mapId] || {};
  const tiled = DB.maps[mapId] ? propsOf(DB.maps[mapId]) : {};
  return { ...tiled, ...def };
}

/**
 * Plays any map listed in world.json: towns, interiors and dungeon rooms alike.
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
    this.player = null;
    this.boss = null;
    this.tempFlags = new Set();
    this.pendingLevelUps = [];
  }

  sfx(name) {
    Audio.sfx(name);
  }

  create() {
    this.ui = this.scene.get('UI');
    if (!DB.world.maps[this.mapId]) throw new Error(`Map "${this.mapId}" is not listed in data/world.json`);
    const def = mapSettings(this.mapId);
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
    this.doors = [];
    this.switches = [];
    this.blocks = [];
    this.torches = [];
    this.breakables = [];
    this.itemPickups = [];
    this.spawns = {};
    this.lighting = def.darkness ? new Lighting(this, def.darkness) : null;

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
    Game.s.visited[this.mapId] = true;

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

    Audio.music(this.boss ? def.music || 'dungeon' : def.music);
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
    const uid = p.id || `${this.mapId}:${obj.id}`;

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
      case 'healer':
      case 'smith': {
        if (p.ifFlag && !Game.flag(p.ifFlag)) break; // only appears after a story flag
        if (p.ifNotFlag && Game.flag(p.ifNotFlag)) break;
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
        const contents = {};
        for (const k of ['weapon', 'spell', 'item', 'armor', 'count', 'gold', 'maxHp', 'maxMp', 'flag']) if (p[k] !== undefined) contents[k] = p[k];
        if (p.ifFlag && !Game.flag(p.ifFlag)) {
          // appears when a flag is set (e.g. after solving a puzzle)
          this.hiddenChests = this.hiddenChests || [];
          this.hiddenChests.push({ cx, cy, uid: `chest:${uid}`, contents, flag: p.ifFlag });
          break;
        }
        this.addChest(cx, cy, `chest:${uid}`, contents);
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
      case 'door': {
        const d = new Door(this, rect, `door:${uid}`, p);
        this.gateGroup.add(d.sprite);
        this.doors.push(d);
        this.interactables.push({
          bounds: () => d.bounds(),
          run: async () => {
            if (d.open) return;
            const msg = d.tryOpen();
            if (msg) await this.ui.say(msg);
          },
          active: () => !d.open,
        });
        break;
      }
      case 'switch': {
        if (!p.flag) {
          console.warn(`Map ${this.mapId}: switch #${obj.id} needs a "flag" property`);
          break;
        }
        const s = new Switch(this, cx, cy, p);
        if (s.mode === 'crystal') {
          this.propGroup.add(s);
          this.breakables.push(s);
        }
        this.switches.push(s);
        break;
      }
      case 'block': {
        const b = new Block(this, cx, cy, p);
        this.propGroup.add(b);
        this.blocks.push(b);
        break;
      }
      case 'pot': {
        const pot = new Pot(this, cx, cy, p);
        this.propGroup.add(pot);
        this.breakables.push(pot);
        break;
      }
      case 'torch': {
        const t = new Torch(this, cx, cy, p);
        this.propGroup.add(t);
        this.breakables.push(t);
        this.torches.push(t);
        break;
      }
      case 'light':
        if (this.lighting) this.lighting.addLight(cx, cy, p.radius || 40, p.flicker !== false);
        break;
      case 'item':
        if (!Game.flag(`item:${uid}`)) {
          const it = this.spawnItemPickup(cx, cy, p.item, p.count || 1);
          if (it) it.flagId = `item:${uid}`;
        }
        break;
      default:
        if (type) console.warn(`Map ${this.mapId}: unknown object type "${type}" (${obj.name})`);
    }
  }

  addChest(x, y, flagId, contents) {
    const c = new Chest(this, x, y, flagId, contents);
    this.propGroup.add(c);
    this.interactables.push({ bounds: () => c.bounds(), run: () => this.openChest(c) });
    return c;
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
      if (d.type === 'item') {
        this.spawnItemPickup(x, y, d.item, d.count || 1);
        continue;
      }
      const amount = Array.isArray(d.amount) ? Phaser.Math.Between(d.amount[0], d.amount[1]) : d.amount || 1;
      const pk = new Pickup(this, x, y, d.type, amount);
      this.pickupGroup.add(pk);
      pk.body.setDrag(120, 120);
      const a = Math.random() * Math.PI * 2;
      pk.body.setVelocity(Math.cos(a) * 30, Math.sin(a) * 30);
    }
  }

  spawnItemPickup(x, y, itemId, count = 1) {
    if (!DB.items[itemId]) {
      console.warn(`Unknown item "${itemId}"`);
      return null;
    }
    const it = new ItemPickup(this, x, y, itemId, count);
    this.itemPickups.push(it);
    return it;
  }

  // ======================================================================== world queries
  /** True if a point (with optional padding) is free of solid tiles, closed gates/doors and props. */
  isWalkable(x, y, pad = 6) {
    const r = new Rect(x - pad, y - pad, pad * 2, pad * 2);
    if (x < pad || y < pad || x > this.map.widthInPixels - pad || y > this.map.heightInPixels - pad) return false;
    return this.isAreaFree(r);
  }

  isAreaFree(r, ignore = null) {
    for (const layer of this.collisionLayers) {
      const tiles = layer.getTilesWithinWorldXY(r.x, r.y, r.width, r.height);
      if (tiles.some((t) => t.collides)) return false;
    }
    if (r.x < 0 || r.y < 0 || r.right > this.map.widthInPixels || r.bottom > this.map.heightInPixels) return false;
    for (const g of this.gates) if (g.closed && Rect.Overlaps(r, g.rect)) return false;
    for (const d of this.doors) if (!d.open && Rect.Overlaps(r, d.rect)) return false;
    for (const c of this.propGroup.getChildren()) {
      if (c === ignore || !c.active || !c.body || !c.body.enable) continue;
      if (Rect.Overlaps(r, new Rect(c.body.x, c.body.y, c.body.width, c.body.height))) return false;
    }
    for (const e of this.enemies) if (e.active && Rect.Overlaps(r, new Rect(e.body.x, e.body.y, e.body.width, e.body.height))) return false;
    for (const n of this.npcs) if (Rect.Overlaps(r, new Rect(n.body.x, n.body.y, n.body.width, n.body.height))) return false;
    return true;
  }

  blockInFront(player) {
    const f = DIR_VECTORS[player.facing];
    const b = player.body;
    const probe = new Rect(b.center.x + f.x * (b.width / 2 + 3) - 2, b.center.y + f.y * (b.height / 2 + 3) - 2, 4, 4);
    return this.blocks.find((bl) => !bl.moving && Rect.Overlaps(probe, bl.bounds())) || null;
  }

  /** A switch, torch or chest changed a flag: refresh everything that depends on flags. */
  onFlagChanged() {
    for (const g of this.gates) g.refresh();
    for (const s of this.switches) s.refreshLook();
    if (this.hiddenChests) {
      this.hiddenChests = this.hiddenChests.filter((hc) => {
        if (!Game.flag(hc.flag)) return true;
        const c = this.addChest(hc.cx, hc.cy, hc.uid, hc.contents);
        this.combat.puff(c.x, c.y, 0xf8e060, 10);
        this.sfx('chest');
        return false;
      });
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
    const usable = this.interactables.filter((it) => !it.active || it.active());
    const target = usable.find((it) => Rect.Overlaps(near, it.bounds())) || usable.find((it) => it.isNpc && Rect.Overlaps(far, it.bounds()));
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
    if (src.give) {
      // one-time gift: { give: {...reward}, giveFlag: 'got_x' }
      const key = src.giveFlag || `gift:${id}`;
      if (!Game.flag(key)) {
        Game.setFlag(key);
        return { pages: [...(src.pages || d.pages), ...Game.grant(src.give)], speaker: src.speaker || d.speaker || null };
      }
    }
    return { pages: src.pages || d.pages, speaker: src.speaker || d.speaker || null };
  }

  async talkTo(npc) {
    npc.talking = true;
    npc.body.setVelocity(0, 0);
    npc.faceTowards(this.player);
    const p = npc.props;
    try {
      if (npc.npcType === 'shop' || npc.npcType === 'teacher' || npc.npcType === 'smith') {
        const table = { shop: DB.shops, teacher: DB.teachers, smith: DB.smiths }[npc.npcType];
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
          this.player.cure();
          Game.s.respawn = { map: this.mapId, pos: { x: this.player.x, y: this.player.y } };
          this.recordPosition();
          const ok = Game.save();
          this.sfx('heal');
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
    this.sfx('chest');
    this.combat.puff(c.x, c.y - 6, 0xf8e060, 8);
    await this.ui.say(lines.length ? lines : ['The chest is empty.']);
    if (c.contents.flag) this.onFlagChanged();
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

  // ======================================================================== XP
  gainXp(n, x, y) {
    if (!n) return;
    this.combat.floatText(x, y - 14, `+${n} XP`, 0x88d8f8);
    const before = { maxHp: Game.s.maxHp, maxMp: Game.s.maxMp, attack: Game.attackBonus() };
    const levels = Game.addXp(n);
    if (levels) {
      this.pendingLevelUps.push({
        level: Game.s.level,
        hp: Game.s.maxHp - before.maxHp,
        mp: Game.s.maxMp - before.maxMp,
        attack: Game.attackBonus() - before.attack,
      });
    }
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
      this.events.emit('boss-start', b);
      Audio.music(b.def.music || 'boss');
      this.cutscene(async () => {
        this.sfx('bossRoar');
        await this.ui.bossIntro(b.def.name, b.def.title || '');
        b.engage();
      });
    }
  }

  async onBossDefeated(boss) {
    this.bossFightActive = false;
    this.events.emit('boss-end', boss);
    Audio.music(null);
    this.sfx('bossRoar');
    // death throes: flashes and puffs (the world keeps running so the effects animate)
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 120, () => {
        if (!boss.active) return;
        boss.flash(60);
        this.sfx('enemyDie');
        this.combat.puff(boss.x + Phaser.Math.Between(-12, 12), boss.y + Phaser.Math.Between(-12, 12), 0xf8e060, 6);
      });
    }
    await new Promise((r) => this.time.delayedCall(1000, r));
    this.combat.puff(boss.x, boss.y, 0xffffff, 16);
    this.cameras.main.flash(300, 255, 255, 255);
    const bx = boss.x;
    const by = boss.y;
    boss.destroy();
    this.boss = null;
    Game.setFlag(`boss:${boss.id}`);
    this.sfx('victory');
    const r = boss.def.reward || {};
    const lines = [`You defeated the ${boss.def.name}!`, ...Game.grant(r)];
    if (r.message) lines.push(r.message);
    this.onFlagChanged();
    this.gainXp(boss.def.xp || 0, bx, by);
    await this.cutscene(() => this.ui.say(lines));
    Audio.music(this.mapDef.music);
  }

  // ======================================================================== death
  onPlayerDeath() {
    Audio.music(null);
    this.cutscene(async () => {
      this.player.setTint(0x808080);
      await new Promise((r) => setTimeout(r, 700));
      await this.ui.say('You collapsed...');
      Game.heal();
      this.player.cure();
      const r = Game.s.respawn;
      this.transitioning = false;
      this.scene.resume();
      this.goTo(r.map, r.spawn, r.pos ? { pos: r.pos } : {});
    });
  }

  // ======================================================================== update
  update(time, dt) {
    Game.s.playTimeMs += dt;
    if (this.lighting) this.lighting.update(time);
    if (this.transitioning || this.inCutscene) return;

    if (this.pendingLevelUps.length) {
      const lv = this.pendingLevelUps.shift();
      this.cutscene(() => this.ui.levelUp(lv));
      return;
    }
    if (input.pressed('pause')) {
      this.recordPosition();
      this.sfx('menuSelect');
      this.cutscene(() => this.openMenuScene('Pause'));
      return;
    }
    if (input.pressed('map')) {
      this.sfx('menuSelect');
      this.cutscene(() => this.openMenuScene('Map', { mapId: this.mapId }));
      return;
    }

    this.player.update(time, dt);
    if (this.inCutscene) return;
    for (const e of this.enemies) if (e.active) e.update(time, dt);
    this.enemies = this.enemies.filter((e) => e.active);
    for (const n of this.npcs) n.update(time, dt);
    this.combat.update();
    this.breakables = this.breakables.filter((b) => b.active);

    const pl = this.player;
    if (!pl.dead) {
      const pb = new Rect(pl.body.x, pl.body.y, pl.body.width, pl.body.height);
      // contact damage (+ status effects like poison bites)
      for (const e of this.enemies) {
        const dmg = e.def.contactDamage;
        if (!dmg || e.dead || e.state === 'vanish' || e.hidden) continue;
        const eh = e.hurtbox();
        Rect.Inflate(eh, -eh.width * 0.2, -eh.height * 0.2);
        if (Rect.Overlaps(eh, pb) && pl.hurt(dmg, e.footX, e.footY)) pl.applyEffect(e.def.contactEffect);
      }
      // pickups
      for (const pk of [...this.pickupGroup.getChildren()]) {
        if (Rect.Overlaps(pb, pk.getBounds())) {
          this.combat.puff(pk.x, pk.y, 0xf8f8a0, 4);
          pk.collect();
        }
      }
      for (const it of this.itemPickups) {
        if (it.active && Rect.Overlaps(pb, it.getBounds())) {
          if (it.flagId) Game.setFlag(it.flagId);
          it.collect();
        }
      }
      this.itemPickups = this.itemPickups.filter((it) => it.active);
      // floor switches / pressure plates
      for (const s of this.switches) {
        if (s.mode === 'crystal') continue;
        const r = s.bounds();
        const pressed = Rect.Overlaps(r, pb) || this.blocks.some((b) => !b.moving && Rect.Overlaps(r, b.bounds()));
        s.updatePressed(pressed);
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
