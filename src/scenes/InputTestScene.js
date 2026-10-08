import Phaser from 'phaser';
import { input } from '../input/InputManager.js';
import { BUTTONS } from '../config/input.config.js';
import { createPixelFont, pixelText } from '../ui/font.js';

/** Temporary scene: shows which virtual buttons are held. */
export class InputTestScene extends Phaser.Scene {
  constructor() {
    super('InputTest');
  }

  create() {
    createPixelFont(this);
    pixelText(this, 8, 6, 'Input test - press anything!', 0xf8e858);
    pixelText(this, 8, 18, 'The quick brown fox jumps over', 0xffffff);
    pixelText(this, 8, 28, 'THE LAZY DOG. 0123456789 (?!) ♥▶▼', 0xffffff);
    this.labels = BUTTONS.map((b, i) => pixelText(this, 8 + (i % 5) * 46, 50 + Math.floor(i / 5) * 14, b, 0x606060));
    this.dot = this.add.rectangle(120, 120, 8, 8, 0x58a8f8);
    this.log = pixelText(this, 8, 146, '', 0xa0a0a0);
  }

  update(_, dt) {
    BUTTONS.forEach((b, i) => this.labels[i].setTint(input.isDown(b) ? 0x78f878 : 0x606060));
    const d = input.direction();
    const len = Math.hypot(d.x, d.y) || 1;
    this.dot.x = Phaser.Math.Clamp(this.dot.x + (d.x / len) * dt * 0.08, 4, 236);
    this.dot.y = Phaser.Math.Clamp(this.dot.y + (d.y / len) * dt * 0.08, 80, 140);
    for (const b of BUTTONS) if (input.justPressed(b)) this.log.setText(`pressed ${b} (${input.lastSource})`);
  }
}
