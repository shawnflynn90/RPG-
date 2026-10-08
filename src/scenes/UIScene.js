import Phaser from 'phaser';
import { input } from '../input/InputManager.js';
import { pixelText, wrapText, LINE_HEIGHT } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';
import { UI } from '../config/game.config.js';
import { Audio } from '../systems/Audio.js';
import { Game } from '../systems/GameState.js';
import { anchorUI, backdrop } from '../ui/layout.js';

const TEXT_SPEEDS = [0.5, 1, 2.2];

const BOX = { x: 4, y: 110, w: 232, h: 46 };

/**
 * Always-on-top overlay for dialogue boxes, yes/no choices and toasts.
 * All methods return Promises, so game code can be written like a script:
 *   await ui.say(['Hello!'], 'Elder');
 *   const i = await ui.choose(['Yes', 'No']);
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.active = null; // current box state
    this.toasts = [];
    this.extra = 0;
    // dialogue sits at the bottom of tall screens
    anchorUI(this, 'bottom', (extra) => (this.extra = extra));
  }

  /** Show pages of text in a GBA-style box. Long pages are split automatically. */
  say(pages, speaker = null, { hold = false } = {}) {
    if (typeof pages === 'string') pages = [pages];
    const boxes = [];
    for (const p of pages) {
      const lines = wrapText(p, BOX.w - 16);
      for (let i = 0; i < lines.length; i += UI.dialogueLines) boxes.push(lines.slice(i, i + UI.dialogueLines).join('\n'));
    }
    return new Promise((resolve) => {
      input.consume();
      this.closeBox();
      const objs = [drawPanel(this, BOX.x, BOX.y, BOX.w, BOX.h)];
      if (speaker) {
        const w = Math.max(40, speaker.length * 5 + 12);
        objs.push(drawPanel(this, BOX.x + 4, BOX.y - 11, w, 14));
        objs.push(pixelText(this, BOX.x + 10, BOX.y - 8, speaker, COLORS.highlight));
      }
      const text = pixelText(this, BOX.x + 8, BOX.y + 7, '');
      const arrow = pixelText(this, BOX.x + BOX.w - 12, BOX.y + BOX.h - 10, '▼', COLORS.highlight).setVisible(false);
      objs.push(text, arrow);
      this.active = { kind: 'say', boxes, page: 0, shown: 0, text, arrow, objs, resolve, hold };
    });
  }

  /** A choice list (shown above the text box if one is open). Resolves to the index, or -1 if cancelled. */
  choose(options, { cancelable = true } = {}) {
    return new Promise((resolve) => {
      input.consume();
      const w = Math.max(...options.map((o) => o.length)) * 5 + 22;
      const h = options.length * LINE_HEIGHT + 10;
      const x = 240 - w - 4;
      const y = BOX.y - h - 2;
      const panel = drawPanel(this, x, y, w, h);
      const menu = new ListMenu(this, x + 4, y + 6, w - 10, options.length, options.map((label) => ({ label })), { cancelable });
      this.active = { kind: 'choose', menu, panel, resolve };
    });
  }

  /** Ask a question in the text box and show a choice list beside it. Resolves to index or -1. */
  async ask(question, options, speaker = null, opts = {}) {
    await this.say(question, speaker, { hold: true });
    const i = await this.choose(options, opts);
    this.releaseHeld();
    return i;
  }

  releaseHeld() {
    if (this.held) for (const o of this.held) o.destroy();
    this.held = null;
  }

  /** Cinematic boss title card with letterbox bars. */
  bossIntro(name, title) {
    return new Promise((resolve) => {
      const top = this.add.rectangle(0, -this.extra - 20, 240, 20, 0x000000).setOrigin(0);
      const bot = this.add.rectangle(0, 160, 240, 20, 0x000000).setOrigin(0);
      const band = this.add.rectangle(-240, 64, 240, 30, 0x000000, 0.75).setOrigin(0);
      const t1 = pixelText(this, 120, 69, name.toUpperCase(), 0xf86048).setOrigin(0.5, 0).setScale(2).setAlpha(0);
      const t2 = pixelText(this, 120, 86, title, COLORS.highlight).setOrigin(0.5, 0).setAlpha(0);
      const objs = [top, bot, band, t1, t2];
      this.tweens.add({ targets: top, y: -this.extra, duration: 250 });
      this.tweens.add({ targets: bot, y: 140, duration: 250 });
      this.tweens.add({ targets: band, x: 0, duration: 300, delay: 200, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 250, delay: 450 });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.skipFn = null;
        this.tweens.add({
          targets: objs,
          alpha: 0,
          duration: 250,
          onComplete: () => {
            for (const o of objs) o.destroy();
            resolve();
          },
        });
      };
      this.time.delayedCall(2200, finish);
      this.skipFn = () => this.time.now > this.introStart + 600 && finish();
      this.introStart = this.time.now;
    });
  }

  /** Big "LEVEL UP!" moment. info: { level, hp, mp, attack } */
  levelUp(info) {
    return new Promise((resolve) => {
      Audio.sfx('levelUp');
      this.cameras.main.flash(250, 255, 255, 220);
      const objs = [];
      const glow = backdrop(this, 0xf8e060, 0.15);
      objs.push(glow);
      const big = pixelText(this, 120, 48, 'LEVEL UP!', COLORS.highlight).setOrigin(0.5).setScale(3);
      objs.push(big);
      this.tweens.add({ targets: big, scale: { from: 5, to: 3 }, duration: 250, ease: 'Back.easeOut' });
      const lines = [`Level ${info.level}`];
      if (info.hp) lines.push(`Max HP +${info.hp}`);
      if (info.mp) lines.push(`Max MP +${info.mp}`);
      if (info.attack) lines.push(`Attack +${info.attack}`);
      lines.push('HP and MP restored!');
      const h = lines.length * LINE_HEIGHT + 12;
      objs.push(drawPanel(this, 60, 70, 120, h));
      lines.forEach((l, i) => objs.push(pixelText(this, 120, 76 + i * LINE_HEIGHT, l, i === 0 ? COLORS.highlight : COLORS.text).setOrigin(0.5, 0)));
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        for (const o of objs) o.destroy();
        this.skipFn = null;
        resolve();
      };
      this.introStart = this.time.now;
      this.skipFn = () => this.time.now > this.introStart + 700 && finish();
      this.time.delayedCall(2600, finish);
    });
  }

  /** Small message at the top of the screen that fades out by itself. */
  toast(message, ms = 1600) {
    const lines = wrapText(message, 200);
    const w = Math.max(...lines.map((l) => l.length)) * 5 + 16;
    const h = lines.length * LINE_HEIGHT + 8;
    const c = this.add.container(120 - w / 2, 22);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.75).fillRoundedRect(0, 0, w, h, 3);
    const t = pixelText(this, w / 2, 5, lines.join('\n')).setOrigin(0.5, 0).setCenterAlign();
    c.add([g, t]);
    this.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 300, onComplete: () => c.destroy() });
  }

  get busy() {
    return !!this.active;
  }

  closeBox() {
    this.releaseHeld();
    if (this.active && this.active.kind === 'say') {
      for (const o of this.active.objs) o.destroy();
      this.active = null;
    }
  }

  update(_, dt) {
    if (this.skipFn && (input.pressed('confirm') || input.justPressed('start'))) this.skipFn();
    const a = this.active;
    if (!a) return;
    if (a.kind === 'say') {
      const full = a.boxes[a.page];
      if (a.shown < full.length) {
        const base = UI.textSpeed * TEXT_SPEEDS[Game.settings.textSpeed ?? 1];
        const speed = input.isDown('A') || input.isDown('B') ? base * 4 : base;
        const before = Math.floor(a.shown);
        a.shown = Math.min(full.length, a.shown + (speed * dt) / 1000);
        if (Math.floor(a.shown) !== before && before % 3 === 0 && full[before] !== ' ') Audio.sfx('text');
        a.text.setText(full.slice(0, Math.floor(a.shown)));
        if (input.pressed('confirm')) {
          a.shown = full.length;
          a.text.setText(full);
        }
        a.arrow.setVisible(false);
      } else if (a.hold && a.page === a.boxes.length - 1) {
        // keep the question on screen; ask() puts a choice list next to it
        this.held = a.objs;
        this.active = null;
        a.resolve();
      } else {
        a.arrow.setVisible(Math.floor(this.time.now / 300) % 2 === 0);
        if (input.pressed('confirm') || input.pressed('cancel')) {
          Audio.sfx('menuMove');
          a.page++;
          if (a.page >= a.boxes.length) {
            this.closeBox();
            a.resolve();
          } else {
            a.shown = 0;
            a.text.setText('');
          }
        }
      }
    } else if (a.kind === 'choose') {
      const r = a.menu.update();
      if (r && (r.type === 'select' || r.type === 'cancel')) {
        a.menu.destroy();
        a.panel.destroy();
        this.active = null;
        a.resolve(r.type === 'select' ? r.index : -1);
      }
    }
  }
}
