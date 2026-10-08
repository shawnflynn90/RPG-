import Phaser from 'phaser';
import { DIR_VECTORS } from '../entities/Actor.js';
import { Game } from './GameState.js';
import { DB } from './db.js';
import { Audio } from './Audio.js';

const Rect = Phaser.Geom.Rectangle;

/**
 * Bombs and the hookshot (data in public/data/tools.json).
 *  - Bombs: placed in front of the player, explode after a fuse. They hurt enemies (and you!),
 *    break pots, light torches and open cracked walls.
 *  - Hookshot: a chain that flies straight ahead. It latches onto hook posts and pulls you to them,
 *    even across pits and water. It stuns enemies, breaks pots and grabs items.
 */
export class Tools {
  constructor(scene) {
    this.scene = scene;
    this.hook = null;
    this.bombs = [];
    this.chain = scene.add.graphics().setDepth(4800);
  }

  use(def, player) {
    if (def.type === 'bomb') return this.placeBomb(def, player);
    if (def.type === 'hookshot') return this.fireHook(def, player);
    console.warn(`Unknown tool type "${def.type}"`);
    return false;
  }

  // ------------------------------------------------------------------------------ bombs
  placeBomb(def, player) {
    if (this.bombs.length >= (def.maxActive || 2)) return false;
    const f = DIR_VECTORS[player.facing];
    const x = player.footX + f.x * 12;
    const y = player.footY - 2 + f.y * 12;
    const s = this.scene;
    const bomb = s.add.image(x, y, 'bomb').setDepth(9);
    s.tweens.add({ targets: bomb, scale: { from: 1, to: 1.15 }, yoyo: true, repeat: -1, duration: 220 });
    const b = { def, sprite: bomb, at: s.time.now + (def.fuseMs || 1500) };
    this.bombs.push(b);
    Audio.sfx('fuse');
    return true;
  }

  explode(b) {
    const s = this.scene;
    const { x, y } = b.sprite;
    const def = b.def;
    const r = def.radius || 30;
    b.sprite.destroy();
    Audio.sfx('explode');
    s.cameras.main.shake(180, 0.012);
    s.particles.burst(x, y, 'fire', 22);
    s.combat.area({ x, y, radius: r, damage: def.damage || 8, knockback: 220, color: '#f8a040', element: 'fire', team: 'player' });
    const p = s.player;
    if (p && !p.dead && Phaser.Math.Distance.Between(x, y, p.footX, p.footY) < r) p.hurt(def.selfDamage ?? 2, x, y);
    s.onExplosion(x, y, r);
  }

  // ------------------------------------------------------------------------------ hookshot
  fireHook(def, player) {
    if (this.hook) return false;
    const f = DIR_VECTORS[player.facing];
    this.hook = { def, f, len: 4, state: 'out', post: null };
    player.hooked = true;
    player.body.setVelocity(0, 0);
    Audio.sfx('hook');
    return true;
  }

  hookOrigin() {
    const p = this.scene.player;
    return { x: p.footX, y: p.footY - 5 };
  }

  hookHead() {
    const o = this.hookOrigin();
    const h = this.hook;
    if (h.state === 'pull') return { x: h.post.x, y: h.post.y };
    return { x: o.x + h.f.x * h.len, y: o.y + h.f.y * h.len };
  }

  retract() {
    this.hook.state = 'back';
  }

  updateHook(dt) {
    const h = this.hook;
    const s = this.scene;
    const p = s.player;
    if (!p || p.dead) return this.endHook();
    const sp = (h.def.speed || 280) * dt;
    if (h.state === 'out') {
      h.len += sp;
      const head = this.hookHead();
      const probe = new Rect(head.x - 3, head.y - 3, 6, 6);
      const post = (s.hookPosts || []).find((hp) => Rect.Overlaps(probe, hp.bounds()));
      if (post) {
        h.state = 'pull';
        h.post = post;
        Audio.sfx('latch');
        p.body.checkCollision.none = true; // fly over pits and water
        return;
      }
      for (const t of s.combat.targets('player')) {
        if (Rect.Overlaps(probe, t.hurtbox())) {
          s.combat.hit(t, { damage: h.def.damage || 0, effect: h.def.effect, knockback: 40, kind: 'projectile', team: 'player' }, head.x, head.y);
          Audio.sfx('clink');
          return this.retract();
        }
      }
      for (const it of [...(s.itemPickups || []), ...s.pickupGroup.getChildren()]) {
        if (it.active && Rect.Overlaps(probe, it.getBounds())) {
          if (it.flagId) Game.setFlag(it.flagId);
          it.collect();
          return this.retract();
        }
      }
      if (!s.isHookable(head.x, head.y)) {
        Audio.sfx('clink');
        s.particles.burst(head.x, head.y, 'spark', 4);
        return this.retract();
      }
      if (h.len >= (h.def.range || 110)) this.retract();
    } else if (h.state === 'back') {
      h.len -= sp * 1.4;
      if (h.len <= 0) this.endHook();
    } else if (h.state === 'pull') {
      // stop just short of the post
      const tx = h.post.x - h.f.x * 14;
      const ty = h.post.y - h.f.y * 12 + 4;
      const dx = tx - p.footX;
      const dy = ty - p.footY;
      const d = Math.hypot(dx, dy);
      if (d < 4 || this.pullTime > 2) {
        p.body.setVelocity(0, 0);
        this.endHook();
        return;
      }
      this.pullTime = (this.pullTime || 0) + dt;
      const v = Math.min(220, d / dt);
      p.body.setVelocity((dx / d) * v, (dy / d) * v);
    }
  }

  endHook() {
    const p = this.scene.player;
    if (p && p.body) {
      p.body.checkCollision.none = false;
      p.hooked = false;
      p.body.setVelocity(0, 0);
    }
    this.hook = null;
    this.pullTime = 0;
    this.chain.clear();
  }

  draw() {
    this.chain.clear();
    if (!this.hook) return;
    const o = this.hookOrigin();
    const head = this.hookHead();
    const len = Phaser.Math.Distance.Between(o.x, o.y, head.x, head.y);
    this.chain.fillStyle(0xa8a8b8, 1);
    for (let d = 4; d < len; d += 4) {
      const t = d / len;
      this.chain.fillRect(Math.round(o.x + (head.x - o.x) * t) - 1, Math.round(o.y + (head.y - o.y) * t) - 1, 2, 2);
    }
    this.chain.fillStyle(0xf8f8f8, 1).fillRect(Math.round(head.x) - 2, Math.round(head.y) - 2, 4, 4);
    this.chain.fillStyle(0x606070, 1).fillRect(Math.round(head.x) - 1, Math.round(head.y) - 1, 2, 2);
  }

  update(time, dt) {
    for (const b of [...this.bombs]) {
      if (time >= b.at) {
        this.bombs.splice(this.bombs.indexOf(b), 1);
        this.explode(b);
      } else if (b.at - time < 500) b.sprite.setTintFill(Math.floor(time / 60) % 2 ? 0xf84040 : 0xffffff);
    }
    if (this.hook) this.updateHook(dt / 1000);
    this.draw();
  }
}

/** True if a tool can be used right now (ammo check). Returns an error message or null. */
export function toolProblem(def) {
  if (def.ammo && !((Game.s.items[def.ammo] || 0) > 0)) {
    const name = (DB.items[def.ammo] || { name: def.ammo }).name;
    return `Out of ${name}s!`;
  }
  return null;
}
