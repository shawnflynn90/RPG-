import Phaser from 'phaser';
import { Actor, DIR_VECTORS, dirFromVector } from './Actor.js';
import { input } from '../input/InputManager.js';
import { PLAYER } from '../config/game.config.js';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { Audio } from '../systems/Audio.js';

export class Player extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    this.flickerOnInvuln = true;
    this.lockUntil = 0;
    this.attackReadyAt = 0;
    this.spellReadyAt = {};
    this.charging = null; // { start, weapon, ready }
    this.pushTarget = null;
    this.pushSince = 0;
    this.body.setCollideWorldBounds(true);
  }

  // HP/MP live in the saved game state.
  get hp() {
    return Game.s ? Game.s.hp : 1;
  }

  set hp(v) {
    if (Game.s) Game.s.hp = v;
  }

  get maxHp() {
    return Game.s ? Game.s.maxHp : 1;
  }

  set maxHp(_) {}

  resists(effect) {
    return Game.resists(effect);
  }

  update(time, dt) {
    if (this.dead) return;
    const s = Game.s;
    s.mp = Math.min(s.maxMp, s.mp + (PLAYER.mpRegenPerSecond * dt) / 1000);

    if (input.pressed('cycleWeapon') && s.weapons.length > 1) {
      const id = Game.cycle('weapons', 'weapon');
      this.cancelCharge();
      Audio.sfx('menuMove');
      this.scene.events.emit('equip-changed', 'weapon', id);
    }
    if (input.pressed('cycleSpell') && s.spells.length > 1) {
      const id = Game.cycle('spells', 'spell');
      Audio.sfx('menuMove');
      this.scene.events.emit('equip-changed', 'spell', id);
    }

    const stunned = this.stunned;
    const locked = time < this.lockUntil || stunned;
    if (!locked && input.pressed('attack')) {
      if (!this.scene.tryInteract()) this.attack(time);
    } else if (!locked && input.pressed('cast')) {
      this.cast(time);
    }
    this.updateCharge(time);

    if (this.knockedBack) {
      this.body.velocity.scale(0.9);
      this.play4('hurt');
    } else if (time < this.lockUntil || stunned) {
      this.body.setVelocity(0, 0);
      if (stunned) this.play4('hurt');
    } else {
      const d = input.direction();
      if (d.x || d.y) {
        const len = Math.hypot(d.x, d.y);
        let sp = PLAYER.speed * this.speedMul * (Game.armorDef.speedMul || 1);
        if (this.charging) sp *= 0.55; // walk slowly while charging, keep facing
        this.body.setVelocity((d.x / len) * sp, (d.y / len) * sp);
        if (!this.charging) this.facing = dirFromVector(d.x, d.y, this.facing);
        this.play4('walk');
        this.checkPush(time, d);
      } else {
        this.body.setVelocity(0, 0);
        this.play4('idle');
        this.pushTarget = null;
      }
    }
  }

  /** Pushing into a pushable block for a moment slides it one tile. */
  checkPush(time, d) {
    const blocked = this.body.blocked;
    const f = DIR_VECTORS[this.facing];
    const pushingWall = (f.x > 0 && blocked.right) || (f.x < 0 && blocked.left) || (f.y > 0 && blocked.down) || (f.y < 0 && blocked.up);
    const aligned = (f.x !== 0 && d.y === 0) || (f.y !== 0 && d.x === 0);
    if (!pushingWall || !aligned) {
      this.pushTarget = null;
      return;
    }
    const target = this.scene.blockInFront ? this.scene.blockInFront(this) : null;
    if (!target) {
      this.pushTarget = null;
      return;
    }
    if (this.pushTarget !== target) {
      this.pushTarget = target;
      this.pushSince = time;
    } else if (time - this.pushSince > 320) {
      this.pushTarget = null;
      target.push(f.x, f.y);
    }
  }

  // ------------------------------------------------------------------------------ weapons
  attack(time) {
    const w = Game.weaponStats();
    if (!w || time < this.attackReadyAt) return;
    this.attackReadyAt = time + (w.cooldownMs || 300);
    this.lockUntil = time + (w.lockMs || 150);
    this.body.setVelocity(0, 0);
    this.play4('attack', false);
    Audio.sfx(w.sfx || (w.shape === 'projectile' ? 'bow' : w.shape === 'thrust' ? 'thrust' : 'swing'));
    if (w.shape === 'projectile') this.shoot(w, w.damage, w.projectile?.pierce);
    else this.scene.combat.melee(this, w, 'player');
    if (w.charge) this.charging = { start: time, weapon: Game.s.weapon, ready: false };
  }

  shoot(w, damage, pierce) {
    const f = DIR_VECTORS[this.facing];
    const pr = w.projectile || {};
    this.scene.combat.projectile({
      x: this.footX + f.x * 6,
      y: this.footY - 4 + f.y * 6,
      angle: Math.atan2(f.y, f.x),
      speed: pr.speed || 200,
      range: pr.range || 160,
      size: pr.size,
      sprite: pr.sprite || 'arrow',
      damage,
      knockback: w.knockback,
      effect: w.effect,
      pierce,
      light: pr.light,
      team: 'player',
    });
  }

  /** Hold A after swinging to charge; release when charged for a spin attack (or piercing shot). */
  updateCharge(time) {
    const c = this.charging;
    if (!c) return;
    if (c.weapon !== Game.s.weapon || this.knockedBack) return this.cancelCharge();
    const w = Game.weaponStats();
    if (!input.held('attack')) {
      if (c.ready) this.releaseCharge(w);
      return this.cancelCharge();
    }
    if (!c.ready && time - c.start >= w.charge.timeMs) {
      c.ready = true;
      Audio.sfx('charge');
    }
    if (c.ready) this.baseTint = Math.floor(time / 80) % 2 ? 0xfff070 : null;
  }

  cancelCharge() {
    this.charging = null;
    this.baseTint = null;
  }

  releaseCharge(w) {
    const ch = w.charge;
    const damage = Math.round(w.damage * (ch.damageMul || 2));
    this.play4('attack', false);
    this.lockUntil = this.scene.time.now + 220;
    if (w.shape === 'projectile') {
      Audio.sfx(w.sfx || 'bow');
      this.shoot(w, damage, ch.pierce ?? true);
    } else {
      Audio.sfx('spin');
      this.scene.combat.area({
        x: this.footX,
        y: this.footY - 4,
        radius: ch.radius || 24,
        damage,
        knockback: (w.knockback || 140) * 1.3,
        color: w.color || '#ffffff',
        team: 'player',
        hitsSwitches: true,
      });
      this.scene.combat.spinFx(this.footX, this.footY - 4, ch.radius || 24, w.color);
    }
  }

  // ------------------------------------------------------------------------------ spells
  cast(time) {
    const id = Game.s.spell;
    const sp = DB.spells[id];
    if (!sp) return;
    if (time < (this.spellReadyAt[id] || 0)) return;
    if (Game.s.mp < sp.mpCost) {
      Audio.sfx('error');
      this.scene.ui.toast('Not enough MP!', 700);
      return;
    }
    if (sp.type === 'heal' && Game.s.hp >= Game.s.maxHp) {
      this.scene.ui.toast('HP is already full.', 700);
      return;
    }
    Game.s.mp -= sp.mpCost;
    this.spellReadyAt[id] = time + (sp.cooldownMs || 500);
    this.lockUntil = time + 150;
    this.cancelCharge();
    this.body.setVelocity(0, 0);
    this.play4('attack', false);
    Audio.sfx(sp.sfx);
    const combat = this.scene.combat;
    const f = DIR_VECTORS[this.facing];
    if (sp.type === 'projectile') {
      const pr = sp.projectile || {};
      combat.projectile({
        x: this.footX + f.x * 6,
        y: this.footY - 4 + f.y * 6,
        angle: Math.atan2(f.y, f.x),
        speed: pr.speed || 150,
        range: pr.range || 150,
        size: pr.size,
        sprite: pr.sprite || 'fireball',
        damage: sp.damage,
        knockback: sp.knockback,
        effect: sp.effect,
        element: sp.element,
        pierce: pr.pierce,
        light: pr.light ?? 40,
        team: 'player',
      });
    } else if (sp.type === 'area') {
      combat.area({
        x: this.footX,
        y: this.footY - 4,
        radius: sp.radius || 32,
        damage: sp.damage,
        effect: sp.effect,
        element: sp.element,
        knockback: sp.knockback,
        color: sp.color,
        team: 'player',
        hitsSwitches: true,
      });
    } else if (sp.type === 'heal') {
      const before = Game.s.hp;
      Game.heal(sp.amount || 10, 0);
      combat.puff(this.x, this.y, 0x78f878, 8);
      combat.floatText(this.x, this.y - 10, `+${Math.round(Game.s.hp - before)}`, 0x78f878);
    }
    this.scene.events.emit('spell-cast', id);
  }

  /** Remaining cooldown fraction 0..1 for the HUD. */
  spellCooldown(id) {
    const sp = DB.spells[id];
    if (!sp) return 0;
    const left = (this.spellReadyAt[id] || 0) - this.scene.time.now;
    return Phaser.Math.Clamp(left / (sp.cooldownMs || 1), 0, 1);
  }

  // ------------------------------------------------------------------------------ damage
  hurt(amount, fromX, fromY) {
    const dmg = amount > 0 ? Math.max(1, amount - Game.defense) : 0;
    return super.hurt(dmg, fromX, fromY, {
      knockback: PLAYER.knockbackSpeed,
      knockMs: PLAYER.knockbackMs,
      invulnMs: PLAYER.hitInvincibleMs,
    });
  }

  onHurt() {
    this.lockUntil = 0;
    this.cancelCharge();
    Audio.sfx('hurt');
    this.scene.cameras.main.shake(100, 0.01);
    if (Game.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch {
        /* ignore */
      }
    }
  }

  die() {
    super.die();
    this.cancelCharge();
    this.body.setVelocity(0, 0);
    this.scene.onPlayerDeath();
  }
}
