import Phaser from 'phaser';
import { loadDatabase, DB } from '../systems/db.js';
import { queueAssets, finalizeAssets } from '../systems/assets.js';
import { createPixelFont, pixelText } from '../ui/font.js';
import { Game } from '../systems/GameState.js';
import { touchControls } from '../input/TouchControls.js';

/** Loads data + maps (fetch), then all art (Phaser loader), then builds placeholders/animations. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    createPixelFont(this);
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2 + 10, 122, 8, 0x302848).setStrokeStyle(1, 0x8878b0);
    this.bar = this.add.rectangle(width / 2 - 60, height / 2 + 10, 0, 6, 0xf8d848).setOrigin(0, 0.5);
    this.label = pixelText(this, width / 2, height / 2 - 6, 'Loading...').setOrigin(0.5);
    touchControls.vibrate = Game.settings.vibrate;

    loadDatabase((p) => this.bar.setSize(60 * p, 6))
      .then(() => {
        queueAssets(this);
        this.load.on('progress', (p) => this.bar.setSize(60 + 60 * p, 6));
        this.load.once('complete', () => this.ready());
        this.load.start();
      })
      .catch((e) => this.fail(e));
  }

  ready() {
    try {
      finalizeAssets(this);
      document.title = DB.world.title || document.title;
      this.scene.start('Title');
    } catch (e) {
      this.fail(e);
    }
  }

  fail(e) {
    console.error(e);
    this.children.removeAll();
    pixelText(this, 4, 4, 'Error while loading:', 0xf86060);
    pixelText(this, 4, 16, String(e.message || e), 0xffffff).setMaxWidth(232);
  }
}
