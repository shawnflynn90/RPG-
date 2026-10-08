import Phaser from 'phaser';
import { DIR_VECTORS } from '../entities/Actor.js';

const Rect = Phaser.Geom.Rectangle;

/**
 * All attacks go through here: melee hitboxes, projectiles and area bursts, for both teams.
 *   team 'player' hits enemies + bosses, team 'enemy' hits the player.
 */
export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.hitboxes = [];
    this.projectiles = scene.physics.add.group({ allowGravity: false });
  }

  targets(team) {
    const s = this.scene;
    if (team === 'player') return s.enemies.filter((e) => e.active && !e.dead);
    return s.player && !s.player.dead ? [s.player] : [];
  }

  /** Called once walls/gates exist, so projectiles break on them. */
  addBlockers(blockers) {
    for (const b of blockers) {
      this.scene.physics.add.collider(this.projectiles, b, (p) => this.killProjectile(p));
    }
  }

  // ------------------------------------------------------------------------------ melee
  /** Melee swing from `owner` in its facing direction using a weapon definition. */
  melee(owner, w, team = 'player') {
    const f = DIR_VECTORS[owner.facing];
    const ax = owner.body.center.x;
    const ay = owner.body.center.y - 4;
    const start = 4;
    const range = w.range || 14;
    const width = w.width || 16;
    let rect;
    if (f.x !== 0) {
      rect = new Rect(f.x > 0 ? ax + start : ax - start - range, ay - width / 2, range, width);
    } else {
      rect = new Rect(ax - width / 2, f.y > 0 ? ay + start : ay - start - range, width, range);
    }
    const hb = {
      rect,
      team,
      owner,
      damage: w.damage,
      knockback: w.knockback ?? 140,
      effect: w.effect,
      until: this.scene.time.now + (w.activeMs || 100),
      hit: new Set(),
    };
    this.hitboxes.push(hb);
    this.drawSwing(rect, f, w);
    return hb;
  }

  drawSwing(rect, f, w) {
    const g = this.scene.add.graphics().setDepth(5000);
    const color = Phaser.Display.Color.HexStringToColor(w.color || '#ffffff').color;
    if (w.shape === 'thrust') {
      g.fillStyle(color, 1);
      if (f.x !== 0) g.fillRect(rect.x, rect.centerY - 1, rect.width, 2);
      else g.fillRect(rect.centerX - 1, rect.y, 2, rect.height);
      g.fillStyle(0xffffff, 1);
      const tipX = f.x > 0 ? rect.right - 3 : f.x < 0 ? rect.x : rect.centerX - 1;
      const tipY = f.y > 0 ? rect.bottom - 3 : f.y < 0 ? rect.y : rect.centerY - 1;
      g.fillRect(tipX, tipY, 3, 3);
    } else {
      // arc: a crescent sweep in front
      const cx = rect.centerX - f.x * rect.width * 0.4;
      const cy = rect.centerY - f.y * rect.height * 0.4;
      const r = Math.max(rect.width, rect.height) * 0.6;
      const base = Math.atan2(f.y, f.x);
      g.lineStyle(3, color, 0.9);
      g.beginPath();
      g.arc(cx, cy, r, base - 1.1, base + 1.1);
      g.strokePath();
      g.lineStyle(1, 0xffffff, 1);
      g.beginPath();
      g.arc(cx, cy, r + 1, base - 0.9, base + 0.9);
      g.strokePath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: (w.activeMs || 100) + 60, onComplete: () => g.destroy() });
  }

  // ------------------------------------------------------------------------- projectiles
  /**
   * opts: { x, y, angle (radians), speed, range, damage, sprite, size:[w,h], team, effect, knockback, pierce }
   */
  projectile(opts) {
    const p = this.projectiles.create(opts.x, opts.y, opts.sprite || 'rock');
    const [w, h] = opts.size || [6, 6];
    p.body.setSize(Math.min(w, p.width), Math.min(h, p.height));
    p.setRotation(opts.angle);
    p.setDepth(4000);
    p.body.setVelocity(Math.cos(opts.angle) * opts.speed, Math.sin(opts.angle) * opts.speed);
    p.proj = { ...opts, startX: opts.x, startY: opts.y, hit: new Set() };
    return p;
  }

  killProjectile(p) {
    if (!p.active) return;
    this.puff(p.x, p.y, 0xffffff, 3);
    p.destroy();
  }

  // ------------------------------------------------------------------------------ areas
  /** Instant burst: { x, y, radius, damage, team, effect, knockback, color } */
  area(o) {
    const color = Phaser.Display.Color.HexStringToColor(o.color || '#ffffff').color;
    const ring = this.scene.add.circle(o.x, o.y, o.radius).setStrokeStyle(2, color, 1).setDepth(4500);
    ring.isFilled = false;
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.15, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: 320,
      onComplete: () => ring.destroy(),
    });
    for (const t of this.targets(o.team)) {
      const hb = t.hurtbox();
      const dist = Phaser.Math.Distance.Between(o.x, o.y, hb.centerX, hb.centerY);
      if (dist <= o.radius + Math.min(hb.width, hb.height) / 2) this.hit(t, o, o.x, o.y);
    }
  }

  /** A pulsing warning circle (boss windups). */
  telegraph(x, y, radius, ms, color = 0xf86048) {
    const c = this.scene.add.circle(x, y, radius, color, 0.25).setDepth(2).setStrokeStyle(1, color, 0.9);
    this.scene.tweens.add({ targets: c, alpha: 0.6, yoyo: true, repeat: -1, duration: 120 });
    this.scene.time.delayedCall(ms, () => c.destroy());
  }

  // ------------------------------------------------------------------------------ shared
  hit(target, src, fromX, fromY) {
    const tx = target.x;
    const ty = target.y - target.frameH / 2;
    const ok = target.hurt(src.damage || 0, fromX, fromY, { knockback: src.knockback ?? 120 });
    if (ok) {
      if (!target.dead) target.applyEffect(src.effect);
      if (src.damage) this.floatText(tx, ty, String(src.damage), src.team === 'player' ? 0xffffff : 0xf87878);
    }
    return ok;
  }

  update() {
    const now = this.scene.time.now;
    // melee hitboxes
    this.hitboxes = this.hitboxes.filter((hb) => now < hb.until);
    for (const hb of this.hitboxes) {
      for (const t of this.targets(hb.team)) {
        if (hb.hit.has(t)) continue;
        if (Rect.Overlaps(hb.rect, t.hurtbox())) {
          hb.hit.add(t);
          this.hit(t, hb, hb.owner.body.center.x, hb.owner.body.center.y);
        }
      }
    }
    // projectiles
    for (const p of [...this.projectiles.getChildren()]) {
      const d = p.proj;
      if (Phaser.Math.Distance.Between(d.startX, d.startY, p.x, p.y) > d.range) {
        this.killProjectile(p);
        continue;
      }
      const pr = new Rect(p.body.x, p.body.y, p.body.width, p.body.height);
      for (const t of this.targets(d.team)) {
        if (d.hit.has(t)) continue;
        if (Rect.Overlaps(pr, t.hurtbox())) {
          d.hit.add(t);
          this.hit(t, d, p.x - Math.cos(d.angle) * 8, p.y - Math.sin(d.angle) * 8);
          if (!d.pierce) {
            this.killProjectile(p);
            break;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------ juice
  puff(x, y, color = 0xffffff, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const r = this.scene.add.rectangle(x, y, 2, 2, color).setDepth(5000);
      this.scene.tweens.add({
        targets: r,
        x: x + Math.cos(a) * (6 + Math.random() * 6),
        y: y + Math.sin(a) * (6 + Math.random() * 6),
        alpha: 0,
        duration: 250 + Math.random() * 150,
        onComplete: () => r.destroy(),
      });
    }
  }

  floatText(x, y, str, color) {
    const t = this.scene.add.bitmapText(Math.round(x), Math.round(y), 'pixel', str).setOrigin(0.5).setTint(color).setDepth(6000);
    this.scene.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }
}
