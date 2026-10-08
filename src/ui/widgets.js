import { input } from '../input/InputManager.js';
import { pixelText, LINE_HEIGHT } from './font.js';

export const COLORS = {
  panel: 0x182058,
  panelLight: 0x2838a0,
  border: 0xf8f8f8,
  borderDark: 0x080818,
  text: 0xffffff,
  dim: 0x8890b8,
  highlight: 0xf8e060,
  bad: 0xf87878,
  good: 0x88f888,
};

/** GBA-style window: dark blue with a white double border. */
export function drawPanel(scene, x, y, w, h) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.borderDark, 1).fillRect(x, y, w, h);
  g.fillStyle(COLORS.border, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(COLORS.borderDark, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(COLORS.panel, 1).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(COLORS.panelLight, 1).fillRect(x + 3, y + 3, w - 6, 1);
  return g;
}

/**
 * A vertical list with a ▶ cursor, scrolling and auto-repeat.
 * items: [{ label, right?, color?, disabled? }]
 * Call update() every frame: returns { type: 'select', index } | { type: 'cancel' } | { type: 'move', index } | null
 */
export class ListMenu {
  constructor(scene, x, y, width, rows, items = [], { cancelable = true } = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.rows = rows;
    this.cancelable = cancelable;
    this.index = 0;
    this.top = 0;
    this.objects = [];
    this.cursor = pixelText(scene, x, y, '▶', COLORS.highlight);
    this.upArrow = pixelText(scene, x + width - 6, y - 7, '▲', COLORS.dim);
    this.downArrow = pixelText(scene, x + width - 6, y + rows * LINE_HEIGHT - 2, '▼', COLORS.dim);
    this.setItems(items);
  }

  setItems(items, keepIndex = true) {
    this.items = items;
    if (!keepIndex) this.index = 0;
    this.index = Math.max(0, Math.min(this.index, items.length - 1));
    this.render();
  }

  render() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    if (this.index < this.top) this.top = this.index;
    if (this.index >= this.top + this.rows) this.top = this.index - this.rows + 1;
    this.items.slice(this.top, this.top + this.rows).forEach((item, i) => {
      const y = this.y + i * LINE_HEIGHT;
      const color = item.disabled ? COLORS.dim : item.color ?? COLORS.text;
      this.objects.push(pixelText(this.scene, this.x + 8, y, item.label, color));
      if (item.right !== undefined) {
        this.objects.push(pixelText(this.scene, this.x + this.width, y, String(item.right), color).setOrigin(1, 0));
      }
    });
    this.cursor.setVisible(this.items.length > 0 && this.active !== false);
    this.cursor.y = this.y + (this.index - this.top) * LINE_HEIGHT;
    this.upArrow.setVisible(this.top > 0);
    this.downArrow.setVisible(this.top + this.rows < this.items.length);
  }

  setActive(active) {
    this.active = active;
    this.cursor.setVisible(active && this.items.length > 0);
  }

  get selected() {
    return this.items[this.index];
  }

  update() {
    if (this.items.length) {
      let moved = 0;
      if (input.repeat('up')) moved = -1;
      if (input.repeat('down')) moved = 1;
      if (moved) {
        this.index = (this.index + moved + this.items.length) % this.items.length;
        this.render();
        return { type: 'move', index: this.index };
      }
      if (input.pressed('confirm')) return { type: 'select', index: this.index };
    }
    if (this.cancelable && input.pressed('cancel')) return { type: 'cancel' };
    return null;
  }

  destroy() {
    for (const o of this.objects) o.destroy();
    this.cursor.destroy();
    this.upArrow.destroy();
    this.downArrow.destroy();
  }
}
