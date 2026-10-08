import Phaser from 'phaser';
import { Actor, dirFromVector } from './Actor.js';

/**
 * Data-driven enemy (see public/data/enemies.json).
 *   ai.idle:     'wander' | 'flutter' | 'stand'
 *   ai.onSight:  'chase' | 'keepDistance' | 'charge' | 'none'
 *   ai.attack:   optional ranged attack { type: 'projectile', cooldownMs, windupMs, projectile: {...} }
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
    this.home = { x, y };
    this.body.setCollideWorldBounds(true);
    this.facing = 'down';
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

  update(time) {
    if (this.dead || !this.player) return;
    if (this.knockedBack) {
      this.body.velocity.scale(0.88);
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
          this.stateUntil = time + (ai.charge?.restMs || 600);
          this.body.setVelocity(0, 0);
        }
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

  alert(time, dist) {
    const ai = this.ai;
    const a = this.angleToPlayer();
    const sp = ai.chaseSpeed || this.def.speed || 30;
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
      this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
    } else if (ai.onSight === 'charge') {
      this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
      this.body.setVelocity(0, 0);
      this.state = 'windup';
      this.pending = 'charge';
      this.stateUntil = time + (ai.charge?.windupMs || 500);
      return;
    }
    if (ai.attack && time >= this.nextAttackAt) {
      this.state = 'windup';
      this.pending = 'shoot';
      this.stateUntil = time + (ai.attack.windupMs || 300);
      this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
    }
  }

  windupDone(time) {
    const ai = this.ai;
    const a = this.angleToPlayer();
    if (this.pending === 'charge') {
      const c = ai.charge || {};
      this.state = 'charging';
      this.stateUntil = time + (c.durationMs || 400);
      this.body.setVelocity(Math.cos(a) * (c.speed || 120), Math.sin(a) * (c.speed || 120));
    } else {
      const atk = ai.attack;
      const pr = atk.projectile || {};
      this.scene.combat.projectile({
        x: this.footX,
        y: this.footY - 4,
        angle: a,
        speed: pr.speed || 90,
        range: pr.range || 150,
        size: pr.size,
        sprite: pr.sprite || 'rock',
        damage: pr.damage || 1,
        knockback: pr.knockback,
        effect: pr.effect,
        team: 'enemy',
      });
      this.nextAttackAt = time + (atk.cooldownMs || 1500);
      this.state = 'alert';
    }
    this.pending = null;
  }

  onHurt() {
    // getting hit always makes an enemy notice you
    if (this.state === 'idle') this.state = 'alert';
    if (this.state === 'windup' || this.state === 'charging') {
      this.state = 'rest';
      this.stateUntil = this.scene.time.now + 300;
    }
  }

  die() {
    super.die();
    this.scene.combat.puff(this.x, this.y, 0xffffff, 10);
    this.scene.spawnDrops(this.x, this.y, this.def.drops || []);
    this.scene.events.emit('enemy-died', this);
    this.destroy();
  }
}
