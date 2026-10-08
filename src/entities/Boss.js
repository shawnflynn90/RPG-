import Phaser from 'phaser';
import { Actor, dirFromVector } from './Actor.js';
import { Audio } from '../systems/Audio.js';

/**
 * Data-driven boss (see public/data/bosses.json).
 * Runs the current phase's `patterns` list in order, looping, with `restMs` between them.
 * When HP drops to a phase's `hpBelow` fraction, it switches phase (message, tint, speed).
 *
 * Pattern types: chase, charge, area, radial, aimed, summon, teleport, rain.
 */
export class Boss extends Actor {
  constructor(scene, x, y, id, def) {
    super(scene, x, y, def.sprite);
    this.id = id;
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.isBoss = true;
    this.phaseIndex = 0;
    this.mode = 'idle';
    this.modeUntil = 0;
    this.engaged = false;
    this.body.setCollideWorldBounds(true);
    this.body.pushable = false;
    this.summons = [];
  }

  /** Bosses can't be stunned unless their data says "stunnable": true. */
  resists(effect) {
    if (effect === 'stun' && !this.def.stunnable) return true;
    return super.resists(effect);
  }

  get phase() {
    return this.def.phases[this.phaseIndex];
  }

  get player() {
    return this.scene.player;
  }

  /** Start fighting (called by the world when the player walks in). */
  engage() {
    if (this.engaged || !this.scene) return; // the room may have changed during the intro
    this.engaged = true;
    this.loop();
  }

  wait(ms) {
    // never resolves if the boss is gone (left the room): the loop just stops
    return new Promise((res) => this.scene && this.scene.time.delayedCall(ms, res));
  }

  async loop() {
    let i = 0;
    await this.wait(600);
    while (this.active && !this.dead) {
      const phase = this.phaseIndex;
      const list = this.phase.patterns;
      const name = list[i % list.length];
      const p = this.def.patterns[name];
      if (!p) console.warn(`Boss ${this.id}: unknown pattern "${name}"`);
      else await this.run(p);
      if (!this.active || this.dead) return;
      this.mode = 'idle';
      this.body.setVelocity(0, 0);
      await this.wait(this.def.restMs ?? 600);
      // reset the pattern order when the phase changes
      i = phase === this.phaseIndex ? i + 1 : 0;
    }
  }

  get speed() {
    return (this.def.speed || 30) * (this.phase.speedMul || 1) * this.speedMul;
  }

  aim() {
    return Phaser.Math.Angle.Between(this.footX, this.footY, this.player.footX, this.player.footY);
  }

  async windup(ms) {
    if (!ms) return;
    this.mode = 'windup';
    this.body.setVelocity(0, 0);
    this.play4('attack', false);
    await this.wait(ms);
  }

  projectileFrom(angle, pr) {
    this.scene.combat.projectile({
      x: this.footX,
      y: this.footY - 6,
      angle,
      speed: pr.speed || 90,
      range: pr.range || 200,
      size: pr.size,
      sprite: pr.sprite || 'rock',
      damage: pr.damage || 2,
      knockback: pr.knockback,
      effect: pr.effect,
      light: pr.light,
      team: 'enemy',
    });
  }

  async run(p) {
    const combat = this.scene.combat;
    switch (p.type) {
      case 'chase':
        this.mode = 'chase';
        await this.wait(p.durationMs || 1500);
        break;
      case 'charge': {
        await this.windup(p.windupMs);
        if (!this.active || this.dead) return;
        const a = this.aim();
        this.mode = 'charge';
        this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
        this.body.setVelocity(Math.cos(a) * p.speed * this.speedMul, Math.sin(a) * p.speed * this.speedMul);
        await this.wait(p.durationMs || 600);
        break;
      }
      case 'area': {
        combat.telegraph(this.footX, this.footY - 4, p.radius || 40, p.windupMs || 600);
        await this.windup(p.windupMs);
        if (!this.active || this.dead) return;
        this.scene.cameras.main.shake(120, 0.008);
        Audio.sfx(p.sfx || 'slam');
        combat.area({
          x: this.footX,
          y: this.footY - 4,
          radius: p.radius || 40,
          damage: p.damage || 3,
          knockback: p.knockback ?? 200,
          effect: p.effect,
          color: p.color,
          team: 'enemy',
        });
        break;
      }
      case 'radial':
      case 'aimed': {
        await this.windup(p.windupMs);
        for (let w = 0; w < (p.waves || 1); w++) {
          if (!this.active || this.dead) return;
          Audio.sfx(p.sfx || 'fire');
          const n = p.count || 8;
          if (p.type === 'radial') {
            const offset = w * (Math.PI / n); // alternate waves so there are gaps to dodge through
            for (let k = 0; k < n; k++) this.projectileFrom(offset + (k / n) * Math.PI * 2, p.projectile || {});
          } else {
            const base = this.aim();
            const spread = Phaser.Math.DegToRad(p.spreadDeg || 15);
            for (let k = 0; k < n; k++) this.projectileFrom(base + (k - (n - 1) / 2) * spread, p.projectile || {});
          }
          if (w < (p.waves || 1) - 1) await this.wait(p.waveDelayMs || 300);
        }
        break;
      }
      case 'summon': {
        this.summons = this.summons.filter((e) => e.active && !e.dead);
        if (this.summons.length >= (p.max || 4)) break;
        await this.windup(p.windupMs);
        if (!this.active || this.dead) return;
        for (let k = 0; k < (p.count || 2); k++) {
          const a = Math.random() * Math.PI * 2;
          const e = this.scene.spawnEnemy(p.enemy, this.x + Math.cos(a) * 24, this.y + Math.sin(a) * 24);
          if (e) {
            e.state = 'alert';
            this.summons.push(e);
            combat.puff(e.x, e.y, 0xc080f8, 6);
          }
        }
        break;
      }
      case 'rain': {
        // warning circles appear around the player, then strike
        const pl = this.player;
        const spots = [];
        for (let k = 0; k < (p.count || 4); k++) {
          const a = Math.random() * Math.PI * 2;
          const r = k === 0 ? 0 : Math.random() * (p.spread || 48);
          spots.push({ x: pl.footX + Math.cos(a) * r, y: pl.footY - 4 + Math.sin(a) * r });
        }
        this.mode = 'windup';
        this.body.setVelocity(0, 0);
        this.play4('attack', false);
        for (const sp of spots) combat.telegraph(sp.x, sp.y, p.radius || 14, p.windupMs || 700, 0x88c8ff);
        await this.wait(p.windupMs || 700);
        if (!this.active || this.dead) return;
        Audio.sfx(p.sfx || 'break');
        for (const sp of spots) {
          combat.area({ x: sp.x, y: sp.y, radius: p.radius || 14, damage: p.damage || 3, knockback: 60, effect: p.effect, color: p.color || '#c8f0ff', team: 'enemy' });
          if (this.scene.particles) this.scene.particles.burst(sp.x, sp.y, 'ice', 8);
        }
        break;
      }
      case 'teleport': {
        // fade out, reappear somewhere near the player
        Audio.sfx('teleport');
        this.mode = 'windup';
        this.body.setVelocity(0, 0);
        await new Promise((res) => this.scene.tweens.add({ targets: this, alpha: 0, duration: p.fadeMs || 300, onComplete: res }));
        if (!this.active || this.dead) return;
        this.body.enable = false;
        this.hidden = true;
        await this.wait(p.hideMs || 300);
        if (!this.active || this.dead) return;
        const pl = this.player;
        for (let tries = 0; tries < 16; tries++) {
          const a = Math.random() * Math.PI * 2;
          const r = Phaser.Math.Between(p.minDist || 48, p.maxDist || 80);
          const x = pl.footX + Math.cos(a) * r;
          const y = pl.footY + Math.sin(a) * r;
          if (this.scene.isWalkable(x, y, 12)) {
            this.body.reset(x - (this.body.center.x - this.x), y - (this.body.center.y - this.y));
            break;
          }
        }
        this.body.enable = true;
        this.hidden = false;
        combat.puff(this.x, this.y, 0xc080f8, 10);
        await new Promise((res) => this.scene.tweens.add({ targets: this, alpha: 1, duration: 200, onComplete: res }));
        break;
      }
      default:
        console.warn(`Boss ${this.id}: unknown pattern type "${p.type}"`);
    }
  }

  update() {
    if (this.dead || !this.engaged) {
      if (!this.engaged) this.play4('idle');
      return;
    }
    if (this.mode === 'chase' && !this.player.dead) {
      const a = this.aim();
      this.body.setVelocity(Math.cos(a) * this.speed, Math.sin(a) * this.speed);
      this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
    } else if (this.mode === 'charge') {
      if (!this.body.blocked.none) {
        // slammed into a wall
        this.body.setVelocity(0, 0);
        this.scene.cameras.main.shake(150, 0.01);
        this.mode = 'idle';
      }
    } else if (this.mode !== 'windup') {
      this.body.setVelocity(0, 0);
    }
    if (this.mode !== 'windup') this.play4(this.body.velocity.lengthSq() > 4 ? 'walk' : 'idle');
  }

  // Bosses don't get knocked around by normal hits.
  hurt(amount, fromX, fromY, opts = {}) {
    if (this.hidden) return false;
    const ok = super.hurt(amount, fromX, fromY, { ...opts, knockback: 0, invulnMs: 120 });
    if (ok) Audio.sfx('hit');
    if (ok && !this.dead) this.checkPhase();
    return ok;
  }

  checkPhase() {
    const frac = this.hp / this.maxHp;
    let next = this.phaseIndex;
    this.def.phases.forEach((ph, i) => {
      if (i > next && frac <= ph.hpBelow) next = i;
    });
    if (next !== this.phaseIndex) {
      this.phaseIndex = next;
      const ph = this.phase;
      if (ph.tint) this.baseTint = Phaser.Display.Color.HexStringToColor(ph.tint).color;
      if (ph.message) this.scene.ui.toast(ph.message, 1800);
      Audio.sfx('bossRoar');
      this.scene.cameras.main.shake(300, 0.012);
      this.invulnUntil = this.scene.time.now + 800;
      this.scene.events.emit('boss-phase', this, next);
    }
  }

  die() {
    super.die();
    this.body.setVelocity(0, 0);
    for (const e of this.summons) if (e.active && !e.dead) e.hurt(999, e.x, e.y);
    this.scene.onBossDefeated(this);
  }
}
