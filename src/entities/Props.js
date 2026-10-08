import Phaser from 'phaser';
import { Actor, dirFromVector } from './Actor.js';
import { Game } from '../systems/GameState.js';
import { DB } from '../systems/db.js';

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
    if (this.props.flag) {
      // "a,b" = every flag must be set. Pressure-plate flags only count while held down.
      const all = String(this.props.flag)
        .split(',')
        .map((f) => f.trim())
        .every((f) => Game.flag(f) || this.scene.tempFlags.has(f));
      return this.props.invert ? all : !all;
    }
    return true;
  }

  refresh() {
    const want = this.shouldBeClosed();
    if (want === this.closed) return;
    this.closed = want;
    this.sprite.setVisible(want);
    this.sprite.body.enable = want;
    if (this.scene.combat && this.scene.player) {
      this.scene.sfx('door');
      if (!want) this.scene.combat.puff(this.rect.centerX, this.rect.centerY, 0xc8c8e0, 8);
    }
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
    this.scene.sfx(this.kind === 'gold' ? 'coin' : 'pickup');
    if (this.kind === 'gold') s.gold += this.amount;
    if (this.kind === 'heart') Game.heal(4 * this.amount, 0);
    if (this.kind === 'mana') Game.heal(0, 3 * this.amount);
    this.destroy();
  }
}

// =========================================================================== puzzle objects

/** Something attacks can hit that isn't an enemy (pots, crystal switches, torches). */
class Breakable extends Prop {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    this.dead = false;
    this.frameH = this.height;
  }

  hurtbox() {
    return new Phaser.Geom.Rectangle(this.x - this.width / 2 + 1, this.y - this.height / 2 + 1, this.width - 2, this.height - 2);
  }

  applyEffect() {}

  hurt() {
    return false;
  }
}

/** Breaks when hit; may drop something. props: drop ('random'|'gold'|'heart'|'mana'|'none'), item */
export class Pot extends Breakable {
  constructor(scene, x, y, props) {
    super(scene, x, y, 'pot');
    this.props = props;
  }

  hurt() {
    if (this.dead) return false;
    this.dead = true;
    const s = this.scene;
    s.combat.puff(this.x, this.y, 0xc89870, 10);
    s.sfx('break');
    const p = this.props;
    if (p.item) s.spawnItemPickup(this.x, this.y, p.item, p.count || 1);
    const drop = p.drop || 'random';
    if (drop === 'random') {
      const r = Math.random();
      if (r < 0.3) s.spawnDrops(this.x, this.y, [{ type: 'gold', amount: [1, 3] }]);
      else if (r < 0.42) s.spawnDrops(this.x, this.y, [{ type: 'heart' }]);
      else if (r < 0.5) s.spawnDrops(this.x, this.y, [{ type: 'mana' }]);
    } else if (drop !== 'none') s.spawnDrops(this.x, this.y, [{ type: drop, amount: p.amount || 1 }]);
    this.destroy();
    return false; // never counts as a "hit" for damage numbers
  }
}

/**
 * Switch. props: flag (required), mode:
 *   'floor'   step on it once; stays down (saved)
 *   'plate'   only down while the player or a block stands on it (not saved)
 *   'crystal' hit it with a weapon or spell to toggle the flag (saved)
 */
export class Switch extends Breakable {
  constructor(scene, x, y, props) {
    const mode = props.mode || 'floor';
    super(scene, x, y, mode === 'crystal' ? 'crystal_off' : 'switch_up');
    this.props = props;
    this.mode = mode;
    if (mode !== 'crystal') {
      // floor switches are walkable
      this.body.enable = false;
      this.setDepth(2);
    }
    this.refreshLook();
  }

  get on() {
    return this.mode === 'plate' ? this.scene.tempFlags.has(this.props.flag) : Game.flag(this.props.flag);
  }

  refreshLook() {
    if (this.mode === 'crystal') this.setTexture(this.on ? 'crystal_on' : 'crystal_off');
    else this.setTexture(this.on ? 'switch_down' : 'switch_up');
  }

  /** Called each frame by the world with what is standing on it. */
  updatePressed(pressed) {
    const s = this.scene;
    if (this.mode === 'floor' && pressed && !this.on) {
      Game.setFlag(this.props.flag);
      s.sfx('switch');
      s.onFlagChanged();
    } else if (this.mode === 'plate') {
      const was = this.on;
      if (pressed) s.tempFlags.add(this.props.flag);
      else s.tempFlags.delete(this.props.flag);
      if (was !== pressed) {
        s.sfx(pressed ? 'switch' : 'menuBack');
        s.onFlagChanged();
      }
    }
    this.refreshLook();
  }

  hurt() {
    if (this.mode !== 'crystal') return false;
    const now = this.scene.time.now;
    if (now < (this.cooldownUntil || 0)) return false;
    this.cooldownUntil = now + 400;
    Game.setFlag(this.props.flag, !Game.flag(this.props.flag));
    this.scene.sfx('switch');
    this.scene.combat.puff(this.x, this.y, 0x80d0ff, 6);
    this.refreshLook();
    this.scene.onFlagChanged();
    return false;
  }

  // floor switches aren't solid and shouldn't block anything
  bounds() {
    return this.mode === 'crystal' ? super.bounds() : new Phaser.Geom.Rectangle(this.x - 6, this.y - 6, 12, 12);
  }
}

/** Torch: light it with fire to set a flag (and light up dark rooms). props: lit, flag, radius */
export class Torch extends Breakable {
  constructor(scene, x, y, props) {
    super(scene, x, y, 'torch_off');
    this.props = props;
    this.lit = !!props.lit || (props.flag && Game.flag(props.flag));
    this.lightRadius = props.radius || 48;
    this.refreshLook();
  }

  refreshLook() {
    this.setTexture(this.lit ? 'torch_on' : 'torch_off');
    if (this.lit && !this.flicker) {
      this.flicker = this.scene.tweens.add({ targets: this, scaleY: { from: 1, to: 1.06 }, yoyo: true, repeat: -1, duration: 160 });
    }
  }

  hurt(_amount, _fx, _fy, opts = {}) {
    if (this.lit || opts.element !== 'fire') return false;
    this.lit = true;
    this.scene.sfx('fire');
    if (this.props.flag) Game.setFlag(this.props.flag);
    this.refreshLook();
    this.scene.onFlagChanged();
    return false;
  }
}

/** Locked door: open with a key item (consumed). props: lock (item id, default small_key), text */
export class Door {
  constructor(scene, rect, flagId, props) {
    this.scene = scene;
    this.rect = rect;
    this.props = props;
    this.flagId = flagId;
    this.lock = props.lock || 'small_key';
    const tex = this.lock === 'boss_key' ? 'door_boss' : 'door_locked';
    this.sprite = scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, tex).setOrigin(0, 0);
    scene.physics.add.existing(this.sprite, true);
    this.sprite.setDepth(10 + rect.bottom);
    if (Game.flag(flagId)) this.setOpen();
  }

  get open() {
    return Game.flag(this.flagId);
  }

  setOpen() {
    this.sprite.setVisible(false);
    this.sprite.body.enable = false;
  }

  bounds() {
    return this.rect;
  }

  /** Returns the message to show. */
  tryOpen() {
    if (this.open) return null;
    const s = Game.s;
    if ((s.items[this.lock] || 0) > 0) {
      if (this.props.consume !== false) {
        s.items[this.lock]--;
        if (s.items[this.lock] <= 0) delete s.items[this.lock];
      }
      Game.setFlag(this.flagId);
      this.scene.sfx('unlock');
      this.scene.time.delayedCall(150, () => this.scene.sfx('door'));
      this.scene.combat.puff(this.rect.centerX, this.rect.centerY, 0xf8e060, 10);
      this.setOpen();
      return null;
    }
    this.scene.sfx('error');
    return this.props.text || (this.lock === 'boss_key' ? 'A huge lock. You need the Big Key.' : 'It\'s locked. You need a Small Key.');
  }
}

/** Pushable block. Slides one tile when the player pushes into it. props: once (bool) */
export class Block extends Prop {
  constructor(scene, x, y, props) {
    super(scene, x, y, 'block');
    this.props = props;
    this.body.setSize(16, 16);
    this.body.setOffset(0, 0);
    this.body.updateFromGameObject();
    this.moving = false;
    this.moved = false;
  }

  bounds() {
    return new Phaser.Geom.Rectangle(this.x - 8, this.y - 8, 16, 16);
  }

  push(dx, dy) {
    if (this.moving || (this.props.once && this.moved)) return;
    const nx = this.x + dx * 16;
    const ny = this.y + dy * 16;
    const target = new Phaser.Geom.Rectangle(nx - 7, ny - 7, 14, 14);
    if (!this.scene.isAreaFree(target, this)) {
      this.scene.sfx('error');
      return;
    }
    this.moving = true;
    this.scene.sfx('push');
    this.scene.tweens.add({
      targets: this,
      x: nx,
      y: ny,
      duration: 220,
      onUpdate: () => this.body.updateFromGameObject(),
      onComplete: () => {
        this.body.updateFromGameObject();
        this.setDepth(10 + this.body.bottom);
        this.moving = false;
        this.moved = true;
      },
    });
  }
}

/** A key (or other item) lying on the floor. */
export class ItemPickup extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y, itemId, count = 1) {
    const def = DB.items[itemId] || {};
    super(scene, x, y, def.icon && scene.textures.exists(def.icon) ? def.icon : 'coin');
    this.itemId = itemId;
    this.count = count;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    scene.tweens.add({ targets: this, y: y - 3, yoyo: true, repeat: -1, duration: 500 });
  }

  collect() {
    Game.addItem(this.itemId, this.count);
    const def = DB.items[this.itemId] || { name: this.itemId };
    this.scene.ui.toast(`Got ${def.name}!`, 1200);
    this.scene.sfx('chest');
    this.destroy();
  }
}
