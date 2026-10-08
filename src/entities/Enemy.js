import Phaser from 'phaser';
import { Actor, dirFromVector, DIR_VECTORS } from './Actor.js';
import { Audio } from '../systems/Audio.js';
import { Game } from '../systems/GameState.js';

/**
 * Data-driven enemy (see public/data/enemies.json).
 *   ai.idle:     'wander' | 'flutter' | 'stand'
 *   ai.onSight:  'chase' | 'keepDistance' | 'charge' | 'teleport' | 'none'
 *   ai.attack:   ranged attack { type: 'projectile', cooldownMs, windupMs, count, spreadDeg, projectile: {...} }
 *   ai.dash:     lunge when close { range, windupMs, speed, durationMs, cooldownMs }
 *   ai.teleport: { cooldownMs, minDist, maxDist }
 *   shield:      { arcDeg } blocks melee + projectiles from the front (magic areas get through)
 *   contactEffect, resist: status effects (see README)
 */
export class Enemy extends Actor {
  constructor(scene, x, y, id, def) {
    super(scene, x, y, def.sprite);
    this.id = id;
    this.def = def;
    this.ai = def.ai || {};
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.state = 'idle';
    this.stateUntil = 0;
    this.moveDir = { x: 0, y: 0 };
    this.nextAttackAt = scene.time.now + 800 + Math.random() * 800;
    this.nextDashAt = scene.time.now + 600;
    this.nextTeleportAt = scene.time.now + 1200;
    this.home = { x, y };
    this.body.setCollideWorldBounds(true);
    this.facing = 'down';
    if (def.shield) {
      this.shieldFx = scene.add.rectangle(x, y, 2, 10, Phaser.Display.Color.HexStringToColor(def.shield.color || '#c8d0e0').color);
    }
  }

  get player() {
    return this.scene.player;
  }

  distToPlayer() {
    const p = this.player;
    return Phaser.Math.Distance.Between(this.footX, this.footY, p.footX, p.footY);
  }

  angleToPlayer() {
    const p = this.player;
    return Phaser.Math.Angle.Between(this.footX, this.footY, p.footX, p.footY);
  }

  move(vx, vy) {
    const m = this.speedMul;
    this.body.setVelocity(vx * m, vy * m);
    if (vx || vy) this.facing = dirFromVector(vx, vy, this.facing);
  }

  faceAngle(a) {
    this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
  }

  update(time) {
    if (this.dead || !this.player) return;
    this.updateShieldFx();
    if (this.knockedBack) {
      this.body.velocity.scale(0.88);
      this.play4('hurt');
      return;
    }
    if (this.stunned) {
      this.body.setVelocity(0, 0);
      this.play4('hurt');
      if (this.state === 'windup' || this.state === 'charging') this.state = 'alert';
      return;
    }
    const ai = this.ai;
    const dist = this.distToPlayer();
    const sees = !this.player.dead && dist < (ai.sightRange || 64);
    const lost = this.player.dead || dist > (ai.loseRange || 120);

    if (this.state === 'idle' && sees && ai.onSight && ai.onSight !== 'none') this.state = 'alert';
    if (this.state === 'alert' && lost) this.state = 'idle';

    switch (this.state) {
      case 'idle':
        this.idle(time);
        break;
      case 'alert':
        this.alert(time, dist);
        break;
      case 'windup':
        this.body.setVelocity(0, 0);
        if (Math.floor(time / 90) % 2) this.flash(45); // blink = "about to attack"
        if (time >= this.stateUntil) this.windupDone(time);
        break;
      case 'charging':
        if (time >= this.stateUntil || this.body.blocked.none === false) {
          this.state = 'rest';
          this.stateUntil = time + (this.pendingRest || 600);
          this.body.setVelocity(0, 0);
        }
        break;
      case 'vanish':
        this.body.setVelocity(0, 0);
        if (time >= this.stateUntil) this.reappear(time);
        break;
      case 'rest':
        this.body.setVelocity(0, 0);
        if (time >= this.stateUntil) this.state = 'alert';
        break;
    }
    const moving = this.body.velocity.lengthSq() > 4;
    this.play4(this.state === 'windup' ? 'attack' : moving ? 'walk' : 'idle');
  }

  idle(time) {
    const ai = this.ai;
    if (ai.idle === 'stand') {
      this.body.setVelocity(0, 0);
      return;
    }
    if (time >= this.stateUntil) {
      const flutter = ai.idle === 'flutter';
      if (!flutter && Math.random() < 0.4) this.moveDir = { x: 0, y: 0 };
      else {
        // drift back toward home if we've wandered far
        const homeAng = Phaser.Math.Angle.Between(this.footX, this.footY, this.home.x, this.home.y);
        const far = Phaser.Math.Distance.Between(this.footX, this.footY, this.home.x, this.home.y) > 48;
        const a = far ? homeAng : Math.random() * Math.PI * 2;
        this.moveDir = { x: Math.cos(a), y: Math.sin(a) };
      }
      this.stateUntil = time + (flutter ? 250 + Math.random() * 350 : 700 + Math.random() * 1500);
    }
    const sp = this.def.speed || 20;
    this.move(this.moveDir.x * sp, this.moveDir.y * sp);
  }

  startWindup(kind, ms, time) {
    this.state = 'windup';
    this.pending = kind;
    this.stateUntil = time + ms;
    this.faceAngle(this.angleToPlayer());
  }

  alert(time, dist) {
    const ai = this.ai;
    const a = this.angleToPlayer();
    const sp = ai.chaseSpeed || this.def.speed || 30;

    // close-range lunge works with any movement style
    if (ai.dash && dist < (ai.dash.range || 40) && time >= this.nextDashAt) {
      this.startWindup('dash', ai.dash.windupMs || 350, time);
      return;
    }

    if (ai.onSight === 'chase') {
      this.move(Math.cos(a) * sp, Math.sin(a) * sp);
    } else if (ai.onSight === 'keepDistance') {
      const want = ai.preferredDistance || 56;
      if (dist < want - 10) this.move(-Math.cos(a) * sp, -Math.sin(a) * sp);
      else if (dist > want + 10) this.move(Math.cos(a) * sp, Math.sin(a) * sp);
      else {
        // strafe slowly
        const s = Math.sin(time / 700) > 0 ? 1 : -1;
        this.move(-Math.sin(a) * sp * 0.5 * s, Math.cos(a) * sp * 0.5 * s);
      }
      this.faceAngle(a);
    } else if (ai.onSight === 'charge') {
      this.body.setVelocity(0, 0);
      this.startWindup('charge', ai.charge?.windupMs || 500, time);
      return;
    } else if (ai.onSight === 'teleport') {
      this.body.setVelocity(0, 0);
      this.faceAngle(a);
      if (time >= this.nextTeleportAt) {
        this.vanish(time);
        return;
      }
    }
    if (ai.attack && time >= this.nextAttackAt) this.startWindup('shoot', ai.attack.windupMs || 300, time);
  }

  windupDone(time) {
    const ai = this.ai;
    const a = this.angleToPlayer();
    if (this.pending === 'charge' || this.pending === 'dash') {
      const c = this.pending === 'charge' ? ai.charge || {} : ai.dash;
      this.state = 'charging';
      this.stateUntil = time + (c.durationMs || 400);
      this.pendingRest = c.restMs ?? 500;
      if (this.pending === 'dash') this.nextDashAt = time + (c.cooldownMs || 1500);
      this.faceAngle(a);
      this.body.setVelocity(Math.cos(a) * (c.speed || 120), Math.sin(a) * (c.speed || 120));
      Audio.sfx('thrust');
    } else {
      this.fire(a);
      this.nextAttackAt = time + (ai.attack.cooldownMs || 1500);
      this.state = 'alert';
    }
    this.pending = null;
  }

  fire(a) {
    const atk = this.ai.attack;
    const pr = atk.projectile || {};
    const n = atk.count || 1;
    const spread = Phaser.Math.DegToRad(atk.spreadDeg || 15);
    for (let k = 0; k < n; k++) {
      this.scene.combat.projectile({
        x: this.footX,
        y: this.footY - 4,
        angle: a + (k - (n - 1) / 2) * spread,
        speed: pr.speed || 90,
        range: pr.range || 150,
        size: pr.size,
        sprite: pr.sprite || 'rock',
        damage: pr.damage || 1,
        knockback: pr.knockback,
        effect: pr.effect,
        light: pr.light,
        team: 'enemy',
      });
    }
    Audio.sfx(atk.sfx || 'bow');
  }

  // ---- teleporting ---------------------------------------------------------------------
  vanish(time) {
    const t = this.ai.teleport || {};
    this.state = 'vanish';
    this.stateUntil = time + (t.fadeMs || 350);
    this.nextTeleportAt = time + (t.cooldownMs || 2500);
    Audio.sfx('teleport');
    this.scene.tweens.add({ targets: this, alpha: 0, duration: (t.fadeMs || 350) * 0.8 });
    this.body.enable = false;
  }

  reappear(time) {
    const t = this.ai.teleport || {};
    const p = this.player;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = Phaser.Math.Between(t.minDist || 40, t.maxDist || 72);
      const x = p.footX + Math.cos(a) * r;
      const y = p.footY + Math.sin(a) * r;
      if (this.scene.isWalkable(x, y)) {
        this.body.reset(x - (this.body.center.x - this.x), y - (this.body.center.y - this.y));
        break;
      }
    }
    this.body.enable = true;
    this.alpha = 1;
    this.scene.tweens.add({ targets: this, alpha: { from: 0, to: 1 }, duration: 200 });
    this.scene.combat.puff(this.x, this.y, 0xc080f8, 8);
    this.state = 'alert';
    // fire soon after appearing
    if (this.ai.attack) this.nextAttackAt = Math.min(this.nextAttackAt, time + 250);
  }

  // ---- shields ---------------------------------------------------------------------------
  updateShieldFx() {
    if (!this.shieldFx) return;
    const f = DIR_VECTORS[this.facing];
    this.shieldFx.setPosition(this.x + f.x * 7, this.y + 2 + f.y * 6);
    this.shieldFx.setSize(f.x ? 2 : 10, f.x ? 10 : 2);
    this.shieldFx.setDepth(this.depth + (f.y < 0 ? -1 : 1));
    this.shieldFx.setVisible(this.visible && !this.stunned);
  }

  /** Shields block melee and projectiles that come from the front. */
  blocks(fromX, fromY, kind) {
    const sh = this.def.shield;
    if (!sh || kind === 'area' || kind === 'dot' || this.stunned || this.state === 'vanish') return false;
    const f = DIR_VECTORS[this.facing];
    const toSrc = Phaser.Math.Angle.Between(this.footX, this.footY, fromX, fromY);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(toSrc - Math.atan2(f.y, f.x)));
    return diff <= Phaser.Math.DegToRad((sh.arcDeg || 100) / 2);
  }

  hurt(amount, fromX, fromY, opts = {}) {
    if (this.state === 'vanish') return false;
    if (this.blocks(fromX, fromY, opts.kind)) {
      if (!this.invulnerable) {
        Audio.sfx('tink');
        this.scene.combat.puff(this.shieldFx ? this.shieldFx.x : this.x, this.shieldFx ? this.shieldFx.y : this.y, 0xffffff, 4);
        this.invulnUntil = this.scene.time.now + 150;
        // the shield pushes the attacker back a little
        const p = this.player;
        if (opts.kind === 'melee' && p) {
          const a = Phaser.Math.Angle.Between(this.footX, this.footY, p.footX, p.footY);
          p.body.setVelocity(Math.cos(a) * 120, Math.sin(a) * 120);
          p.knockUntil = this.scene.time.now + 100;
        }
      }
      return false;
    }
    return super.hurt(amount, fromX, fromY, opts);
  }

  onHurt() {
    Audio.sfx('hit');
    // getting hit always makes an enemy notice you
    if (this.state === 'idle') this.state = 'alert';
    if (this.state === 'windup' || this.state === 'charging') {
      this.state = 'rest';
      this.stateUntil = this.scene.time.now + 300;
    }
  }

  die() {
    super.die();
    Audio.sfx('enemyDie');
    Game.recordKill(this.id);
    if (this.spawnKey) Game.s.slain[this.spawnKey] = true;
    this.scene.particles.burst(this.x, this.y, 'hit', 8);
    this.scene.combat.puff(this.x, this.y, 0xffffff, 10);
    this.scene.spawnDrops(this.x, this.y, this.def.drops || []);
    this.scene.gainXp(this.def.xp || 0, this.x, this.y);
    this.scene.events.emit('enemy-died', this);
    this.destroy();
  }

  destroy(fromScene) {
    if (this.shieldFx) this.shieldFx.destroy();
    super.destroy(fromScene);
  }
}
