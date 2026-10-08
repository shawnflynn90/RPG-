import Phaser from 'phaser';
import { Actor, DIR_VECTORS, dirFromVector } from './Actor.js';
import { input } from '../input/InputManager.js';
import { PLAYER } from '../config/game.config.js';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';

export class Player extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    this.flickerOnInvuln = true;
    this.lockUntil = 0;
    this.attackReadyAt = 0;
    this.spellReadyAt = {};
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

  update(time, dt) {
    if (this.dead) return;
    const s = Game.s;
    s.mp = Math.min(s.maxMp, s.mp + (PLAYER.mpRegenPerSecond * dt) / 1000);

    if (input.pressed('cycleWeapon') && s.weapons.length > 1) {
      const id = Game.cycle('weapons', 'weapon');
      this.scene.events.emit('equip-changed', 'weapon', id);
    }
    if (input.pressed('cycleSpell') && s.spells.length > 1) {
      const id = Game.cycle('spells', 'spell');
      this.scene.events.emit('equip-changed', 'spell', id);
    }

    const locked = time < this.lockUntil;
    if (!locked && input.pressed('attack')) {
      if (!this.scene.tryInteract()) this.attack(time);
    } else if (!locked && input.pressed('cast')) {
      this.cast(time);
    }

    if (this.knockedBack) {
      this.body.velocity.scale(0.9);
      this.play4('hurt');
    } else if (time < this.lockUntil) {
      this.body.setVelocity(0, 0);
    } else {
      const d = input.direction();
      if (d.x || d.y) {
        const len = Math.hypot(d.x, d.y);
        const sp = PLAYER.speed * this.speedMul;
        this.body.setVelocity((d.x / len) * sp, (d.y / len) * sp);
        this.facing = dirFromVector(d.x, d.y, this.facing);
        this.play4('walk');
      } else {
        this.body.setVelocity(0, 0);
        this.play4('idle');
      }
    }
  }

  attack(time) {
    const w = DB.weapons[Game.s.weapon];
    if (!w || time < this.attackReadyAt) return;
    this.attackReadyAt = time + (w.cooldownMs || 300);
    this.lockUntil = time + (w.lockMs || 150);
    this.body.setVelocity(0, 0);
    this.play4('attack', false);
    if (w.shape === 'projectile') {
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
        damage: w.damage,
        knockback: w.knockback,
        effect: w.effect,
        pierce: pr.pierce,
        team: 'player',
      });
    } else {
      this.scene.combat.melee(this, w, 'player');
    }
  }

  cast(time) {
    const id = Game.s.spell;
    const sp = DB.spells[id];
    if (!sp) return;
    if (time < (this.spellReadyAt[id] || 0)) return;
    if (Game.s.mp < sp.mpCost) {
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
    this.body.setVelocity(0, 0);
    this.play4('attack', false);
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
        pierce: pr.pierce,
        team: 'player',
      });
    } else if (sp.type === 'area') {
      combat.area({
        x: this.footX,
        y: this.footY - 4,
        radius: sp.radius || 32,
        damage: sp.damage,
        effect: sp.effect,
        knockback: sp.knockback,
        color: sp.color,
        team: 'player',
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

  hurt(amount, fromX, fromY) {
    return super.hurt(amount, fromX, fromY, {
      knockback: PLAYER.knockbackSpeed,
      knockMs: PLAYER.knockbackMs,
      invulnMs: PLAYER.hitInvincibleMs,
    });
  }

  onHurt() {
    this.lockUntil = 0;
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
    this.body.setVelocity(0, 0);
    this.scene.onPlayerDeath();
  }
}
