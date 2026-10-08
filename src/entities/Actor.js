import Phaser from 'phaser';
import { SpriteInfo, playAnim } from '../systems/assets.js';

export const DIR_VECTORS = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function dirFromVector(x, y, current = 'down') {
  if (x === 0 && y === 0) return current;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 'down' : 'up';
  // exact diagonal: keep the current facing if it's one of the two
  const h = x > 0 ? 'right' : 'left';
  const v = y > 0 ? 'down' : 'up';
  return current === h || current === v ? current : v;
}

/**
 * Base for everything that walks around and can be hurt: player, enemies, bosses, NPCs.
 * Position (x, y) is the sprite centre; the physics body sits at the feet.
 */
export class Actor extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, spriteKey) {
    super(scene, x, y, spriteKey, 0);
    this.spriteKey = spriteKey;
    this.facing = 'down';
    // hp / maxHp are set by subclasses (the player's live in the save data)
    this.invulnUntil = 0;
    this.knockUntil = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.dead = false;
    this.flashUntil = 0;
    this.baseTint = null;
    this._tint = null;
    this.stunUntil = 0;
    this.status = {}; // poison / burn: { until, dps, acc }
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setupBody();
    const info = SpriteInfo[spriteKey];
    this.frameW = info ? info.frameWidth : 16;
    this.frameH = info ? info.frameHeight : 16;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(1).setScale(this.frameW / 16);
  }

  /** Area that weapons and projectiles can hit (roughly the visible sprite). */
  hurtbox() {
    const w = this.frameW * 0.7;
    const h = this.frameH * 0.8;
    return new Phaser.Geom.Rectangle(this.x - w / 2, this.y - h / 2 + this.frameH * 0.1, w, h);
  }

  setupBody() {
    const info = SpriteInfo[this.spriteKey];
    const fw = info ? info.frameWidth : this.width;
    const fh = info ? info.frameHeight : this.height;
    const b = (info && info.body) || {};
    const w = b.width ?? Math.round(fw * 0.625);
    const h = b.height ?? Math.round(fh * 0.5);
    this.body.setSize(w, h);
    this.body.setOffset(b.offsetX ?? (fw - w) / 2, b.offsetY ?? fh - h - 1);
  }

  /** Centre of the physics body (the "feet" area). */
  get footX() {
    return this.body.center.x;
  }

  get footY() {
    return this.body.center.y;
  }

  play4(anim, ignoreIfPlaying = true) {
    playAnim(this, this.spriteKey, anim, this.facing, ignoreIfPlaying);
  }

  get speedMul() {
    return this.scene.time.now < this.slowUntil ? this.slowFactor : 1;
  }

  get knockedBack() {
    return this.scene.time.now < this.knockUntil;
  }

  get stunned() {
    return this.scene.time.now < this.stunUntil;
  }

  /** Override to make an actor immune to an effect ('poison', 'burn', 'stun', 'slow'). */
  resists(effect) {
    return !!(this.def && (this.def.resist || []).includes(effect));
  }

  get invulnerable() {
    return this.scene.time.now < this.invulnUntil;
  }

  /**
   * Status effects from weapons, spells and enemy attacks:
   *   slow: 0.4 (+ durationMs)   poison/burn: { dps, durationMs }   stun: { durationMs }
   */
  applyEffect(effect) {
    if (!effect || this.dead) return;
    const now = this.scene.time.now;
    for (const k of ['poison', 'burn']) {
      if (effect[k] && !this.resists(k)) this.status[k] = { until: now + (effect[k].durationMs || 3000), dps: effect[k].dps || 1, acc: 0 };
    }
    if (effect.stun && !this.resists('stun')) this.stunUntil = now + (effect.stun.durationMs || 1000);
    if (effect.slow && !this.resists('slow')) {
      this.slowFactor = 1 - effect.slow;
      this.slowUntil = this.scene.time.now + (effect.durationMs || 2000);
    }
  }

  /**
   * Take damage from a point (for knockback direction).
   * Returns true if the hit landed.
   */
  hurt(amount, fromX, fromY, { knockback = 120, knockMs = 140, invulnMs = 250 } = {}) {
    if (this.dead || this.invulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = this.scene.time.now + invulnMs;
    const ang = Phaser.Math.Angle.Between(fromX, fromY, this.footX, this.footY);
    if (knockback > 0) {
      this.knockUntil = this.scene.time.now + knockMs;
      this.body.setVelocity(Math.cos(ang) * knockback, Math.sin(ang) * knockback);
    }
    this.flash();
    this.onHurt(amount);
    if (this.hp <= 0) this.die();
    return true;
  }

  /** Brief white flash. */
  flash(ms = 70) {
    this.setTintFill(0xffffff);
    this.flashUntil = this.scene.time.now + ms;
    this._tint = 'flash';
  }

  cure(kinds = ['poison', 'burn']) {
    for (const k of kinds) delete this.status[k];
  }

  /** Damage over time from poison / burn. */
  tickStatus(time, delta) {
    for (const [k, st] of Object.entries(this.status)) {
      if (time >= st.until) {
        delete this.status[k];
        continue;
      }
      st.acc += (st.dps * delta) / 1000;
      if (st.acc >= 1) {
        const n = Math.floor(st.acc);
        st.acc -= n;
        this.hp = Math.max(0, this.hp - n);
        if (this.scene.combat) this.scene.combat.floatText(this.x, this.y - this.frameH / 2, String(n), k === 'poison' ? 0x98f878 : 0xf8a050);
        this.onDot(k, n);
        if (this.hp <= 0 && !this.dead) {
          this.die();
          return;
        }
      }
    }
  }

  onDot() {}

  onHurt() {}

  die() {
    this.dead = true;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    // y-sort: things lower on screen are drawn in front
    this.setDepth(10 + this.body.bottom);
    this.shadow.setPosition(this.footX, this.body.bottom - 1);
    this.shadow.setVisible(this.visible);
    // flicker while invulnerable
    if (this.invulnerable && this.flickerOnInvuln) this.setAlpha(Math.floor(time / 60) % 2 ? 0.35 : 1);
    else if (this.alpha !== 1 && this.flickerOnInvuln) this.setAlpha(1);
    if (!this.dead) this.tickStatus(time, delta);
    if (!this.active) return;
    // tint: white flash > stunned > slowed (icy) > poisoned > burning > baseTint (e.g. boss phase 2) > none
    if (!(time < this.flashUntil)) {
      let want = this.baseTint ?? null;
      if (this.status.burn) want = 0xf8a868;
      if (this.status.poison) want = 0x98e878;
      if (time < this.slowUntil) want = 0x88c8ff;
      if (time < this.stunUntil) want = Math.floor(time / 100) % 2 ? 0xf8f078 : 0xffffff;
      if (want !== this._tint) {
        if (want === null) this.clearTint();
        else this.setTint(want);
        this._tint = want;
      }
    }
  }

  destroy(fromScene) {
    if (this.shadow) this.shadow.destroy();
    super.destroy(fromScene);
  }
}
