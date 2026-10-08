import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { input } from '../input/InputManager.js';
import { Audio } from '../systems/Audio.js';
import { pixelText, LINE_HEIGHT } from '../ui/font.js';
import { COLORS } from '../ui/widgets.js';
import { anchorUI, backdrop } from '../ui/layout.js';

/** Scrolling credits (public/data/credits.json). Hold A to speed up; A at the end closes. */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  init(data) {
    this.onClose = data.onClose || (() => {});
  }

  create() {
    const c = DB.credits || {};
    backdrop(this, 0x000000);
    this.stars = [];
    for (let i = 0; i < 50; i++) this.stars.push(this.add.rectangle(Math.random() * 240, Math.random() * 256 - 48, 1, 1, 0xffffff, Math.random() * 0.7 + 0.2));
    let extra = 0;
    anchorUI(this, 'center', (e) => (extra = e));
    this.content = this.add.container(0, 170 + Math.ceil(extra / 2));
    let y = 0;
    const add = (txt, color, scale = 1) => {
      this.content.add(pixelText(this, 120, y, txt, color).setOrigin(0.5, 0).setScale(scale));
      y += LINE_HEIGHT * scale + 2;
    };
    add((c.title || DB.world.title || '').toUpperCase(), COLORS.highlight, 2);
    y += 20;
    for (const sec of c.sections || []) {
      add(sec.heading, COLORS.highlight);
      for (const l of sec.lines || []) add(l, COLORS.text);
      y += 16;
    }
    y += 40;
    this.endY = y;
    add(c.ending || 'Thank you for playing!', COLORS.highlight);
    this.done = false;
    this.hint = pixelText(this, 236, 152, 'Hold A: faster', COLORS.dim).setOrigin(1, 0);
    Audio.music(c.music || 'title');
  }

  update(time, dt) {
    for (const s of this.stars) {
      s.y += 0.04 * dt * 0.06;
      if (s.y > 208) s.y = -48;
    }
    const target = 70 - this.endY;
    if (this.content.y > target) {
      const speed = input.isDown('A') ? 90 : 18;
      this.content.y = Math.max(target, this.content.y - (speed * dt) / 1000);
    } else if (!this.done) {
      this.done = true;
      this.hint.setText('Press A');
    } else if (input.pressed('confirm') || input.justPressed('start')) {
      input.consume();
      this.scene.stop();
      this.onClose();
    }
  }
}
