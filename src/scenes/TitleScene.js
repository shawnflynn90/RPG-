import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { pixelText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';
import { Audio } from '../systems/Audio.js';

export function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Start the game from the current Game state. */
export function startWorld(scene) {
  const s = Game.s;
  scene.scene.launch('HUD');
  scene.scene.launch('UI');
  scene.scene.start('World', s.pos ? { mapId: s.mapId, pos: s.pos, facing: s.facing } : { mapId: s.mapId, spawn: s.spawn });
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width } = this.scale;
    // simple animated backdrop
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push(this.add.rectangle(Math.random() * 240, Math.random() * 160, 1, 1, 0xffffff, Math.random() * 0.8 + 0.2));
    }
    const title = (DB.world.title || 'Pocket Quest').toUpperCase();
    pixelText(this, width / 2 + 1, 25, title, 0x402060).setOrigin(0.5).setScale(2);
    pixelText(this, width / 2, 24, title, COLORS.highlight).setOrigin(0.5).setScale(2);
    this.hero = this.add.sprite(width / 2, 58, 'player').play('player:walk:down');
    this.prompt = pixelText(this, width / 2, 82, 'Press START or A', 0xffffff).setOrigin(0.5);
    pixelText(this, width / 2, 150, 'v0.2 - milestone 2', COLORS.dim).setOrigin(0.5);

    this.mode = 'press';
    this.menu = null;
    this.panel = null;
    Audio.music(DB.world.titleMusic || 'title');
  }

  openMain() {
    this.prompt.setVisible(false);
    const hasSave = Game.listSlots().some(Boolean);
    const items = [];
    if (hasSave) items.push({ label: 'Continue', action: 'continue' });
    items.push({ label: 'New Game', action: 'new' });
    items.push({ label: 'Options', action: 'options' });
    this.showMenu(items, 'main', 80);
  }

  openSlots(action) {
    const slots = Game.listSlots();
    const items = slots.map((s, i) => {
      if (!s) return { label: `Slot ${i + 1}  - empty -`, slot: i, empty: true, disabled: action === 'continue' };
      const area = (DB.world.maps[s.mapId] || {}).name || s.mapId;
      return { label: `Slot ${i + 1}  ${area}`, right: formatTime(s.playTimeMs || 0), slot: i, empty: false };
    });
    this.slotAction = action;
    this.showMenu(items, 'slots', 170);
  }

  showMenu(items, mode, w) {
    this.clearMenu();
    const h = items.length * 10 + 12;
    this.panel = drawPanel(this, 120 - w / 2, 92, w, h);
    this.menu = new ListMenu(this, 120 - w / 2 + 6, 98, w - 16, items.length, items);
    this.mode = mode;
  }

  clearMenu() {
    if (this.menu) this.menu.destroy();
    if (this.panel) this.panel.destroy();
    this.menu = null;
    this.panel = null;
  }

  update(time) {
    for (const s of this.stars) {
      s.y += 0.05;
      if (s.y > 160) s.y = 0;
    }
    if (this.mode === 'press') {
      this.prompt.setVisible(Math.floor(time / 500) % 2 === 0);
      if (input.justPressed('start') || input.pressed('confirm')) {
        input.consume();
        this.openMain();
      }
      return;
    }
    if (this.mode === 'sub') return;
    const r = this.menu.update();
    if (!r) return;
    const item = this.menu.selected;
    if (this.mode === 'main') {
      if (r.type === 'cancel') {
        this.clearMenu();
        this.mode = 'press';
        this.prompt.setVisible(true);
      } else if (r.type === 'select' && item.action === 'options') {
        this.mode = 'sub';
        this.scene.launch('Options', { onClose: () => (this.mode = 'main') });
        this.scene.bringToTop('Options');
      } else if (r.type === 'select') this.openSlots(item.action);
    } else if (this.mode === 'slots') {
      if (r.type === 'cancel') return this.openMain();
      if (r.type !== 'select' || item.disabled) return;
      if (this.slotAction === 'continue') {
        if (Game.load(item.slot)) startWorld(this);
      } else {
        Game.newGame(item.slot);
        startWorld(this);
      }
    }
  }
}
