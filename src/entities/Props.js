import Phaser from 'phaser';
import { Actor, dirFromVector } from './Actor.js';
import { Game } from '../systems/GameState.js';

/** Townsperson. Talks via an async `onInteract` set up by the world. */
export class NPC extends Actor {
  constructor(scene, x, y, spriteKey, props) {
    super(scene, x, y, spriteKey);
    this.props = props;
    this.facing = props.facing || 'down';
    this.body.setImmovable(true);
    this.body.pushable = false;
    this.home = { x, y };
    this.nextMove = 0;
    this.talking = false;
    this.play4('idle');
  }

  faceTowards(target) {
    this.facing = dirFromVector(target.footX - this.footX, target.footY - this.footY, this.facing);
    this.play4('idle');
  }

  update(time) {
    if (!this.props.wander || this.talking) {
      this.body.setVelocity(0, 0);
      return;
    }
    if (time > this.nextMove) {
      this.nextMove = time + 800 + Math.random() * 1600;
      const far = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y) > 24;
      if (!far && Math.random() < 0.5) this.body.setVelocity(0, 0);
      else {
        const a = far ? Phaser.Math.Angle.Between(this.x, this.y, this.home.x, this.home.y) : Math.random() * Math.PI * 2;
        this.body.setVelocity(Math.cos(a) * 20, Math.sin(a) * 20);
        this.facing = dirFromVector(Math.cos(a), Math.sin(a), this.facing);
      }
    }
    this.play4(this.body.velocity.lengthSq() > 1 ? 'walk' : 'idle');
  }
}

/** Static solid thing you can interact with (chest, sign...). */
export class Prop extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(this.width - 2, Math.min(this.height, 10));
    this.body.setOffset(1, this.height - Math.min(this.height, 10));
    this.setDepth(10 + this.body.bottom);
  }

  bounds() {
    return new Phaser.Geom.Rectangle(this.body.x, this.body.y, this.body.width, this.body.height);
  }
}

export class Chest extends Prop {
  constructor(scene, x, y, flagId, contents) {
    super(scene, x, y, Game.flag(flagId) ? 'chest_open' : 'chest_closed');
    this.flagId = flagId;
    this.contents = contents;
  }

  get opened() {
    return Game.flag(this.flagId);
  }

  open() {
    Game.setFlag(this.flagId);
    this.setTexture('chest_open');
    return Game.grant(this.contents);
  }
}

/**
 * A barrier.
 *  - { flag: 'x' }   closed until flag x is set (e.g. by beating a boss)
 *  - { mode: 'boss' } open, but shuts while the room's boss fight is on
 */
export class Gate {
  constructor(scene, rect, props) {
    this.scene = scene;
    this.props = props;
    this.rect = rect;
    this.sprite = scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, 'gate').setOrigin(0, 0);
    scene.physics.add.existing(this.sprite, true);
    this.sprite.setDepth(10 + rect.bottom);
    this.closed = true;
    this.refresh();
  }

  shouldBeClosed() {
    if (this.props.mode === 'boss') return !!this.scene.bossFightActive;
    if (this.props.flag) return !Game.flag(this.props.flag);
    return true;
  }

  refresh() {
    const want = this.shouldBeClosed();
    if (want === this.closed) return;
    this.closed = want;
    this.sprite.setVisible(want);
    this.sprite.body.enable = want;
    if (this.scene.combat && !want) this.scene.combat.puff(this.rect.centerX, this.rect.centerY, 0xc8c8e0, 8);
  }

  bounds() {
    return this.rect;
  }
}

/** Gold / heart / mana dropped by enemies. */
export class Pickup extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, kind, amount = 1) {
    const tex = { gold: 'coin', heart: 'heart', mana: 'mana' }[kind] || 'coin';
    super(scene, x, y, tex);
    this.kind = kind;
    this.amount = amount;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setDepth(9);
    const a = Math.random() * Math.PI * 2;
    this.body.setVelocity(Math.cos(a) * 30, Math.sin(a) * 30);
    this.body.setDrag(120, 120);
    this.bornAt = scene.time.now;
    this.lifeMs = 9000;
    scene.tweens.add({ targets: this, y: y - 4, yoyo: true, duration: 180, ease: 'Quad.easeOut' });
  }

  preUpdate(time) {
    const age = time - this.bornAt;
    if (age > this.lifeMs) this.destroy();
    else if (age > this.lifeMs - 2500) this.setVisible(Math.floor(time / 100) % 2 === 0);
  }

  collect() {
    const s = Game.s;
    if (this.kind === 'gold') s.gold += this.amount;
    if (this.kind === 'heart') Game.heal(4 * this.amount, 0);
    if (this.kind === 'mana') Game.heal(0, 3 * this.amount);
    this.destroy();
  }
}
