import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { pixelText, wrapText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';
import { touchControls } from '../input/TouchControls.js';
import { formatTime } from './TitleScene.js';

const TABS = ['Items', 'Weapons', 'Spells', 'System'];

/** START menu: items, weapons, spells, save & options. LB/RB (or left/right) switch tabs. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.onClose = data.onClose || (() => {});
    this.tab = 0;
  }

  create() {
    this.add.rectangle(0, 0, 240, 160, 0x000000, 0.55).setOrigin(0);
    drawPanel(this, 2, 2, 236, 18);
    this.tabTexts = TABS.map((t, i) => pixelText(this, 12 + i * 58, 7, t, COLORS.dim));
    pixelText(this, 4, 7, '<', COLORS.dim);
    pixelText(this, 233, 7, '>', COLORS.dim);
    drawPanel(this, 2, 22, 150, 96);
    drawPanel(this, 154, 22, 84, 96);
    drawPanel(this, 2, 120, 236, 38);
    this.stats = pixelText(this, 160, 28, '', COLORS.text);
    this.desc = pixelText(this, 9, 126, '', COLORS.text);
    this.menu = new ListMenu(this, 7, 28, 138, 8, []);
    this.message = null;
    this.refresh(false);
  }

  items() {
    const s = Game.s;
    switch (TABS[this.tab]) {
      case 'Items':
        return Object.entries(s.items)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => {
            const d = DB.items[id] || { name: id };
            return { label: d.name, right: `x${n}`, id, desc: d.description };
          });
      case 'Weapons':
        return s.weapons.map((id) => {
          const d = DB.weapons[id];
          return {
            label: (s.weapon === id ? '♥ ' : '  ') + d.name,
            right: `${d.damage}`,
            id,
            color: s.weapon === id ? COLORS.highlight : undefined,
            desc: `${d.description}\nDamage ${d.damage}  Speed ${speedLabel(d.cooldownMs)}`,
          };
        });
      case 'Spells':
        return s.spells.map((id) => {
          const d = DB.spells[id];
          return {
            label: (s.spell === id ? '♥ ' : '  ') + d.name,
            right: `${d.mpCost}MP`,
            id,
            color: s.spell === id ? COLORS.highlight : undefined,
            desc: d.description,
          };
        });
      default:
        return [
          { label: 'Save', id: 'save', desc: `Save to slot ${Game.slot + 1}.` },
          { label: `Vibration: ${Game.settings.vibrate ? 'On' : 'Off'}`, id: 'vibrate', desc: 'Vibrate when touch buttons are pressed.' },
          { label: 'Return to Title', id: 'title', desc: 'Unsaved progress will be lost.' },
          { label: 'Close', id: 'close', desc: 'Back to the game.' },
        ];
    }
  }

  refresh(keepIndex = true) {
    this.tabTexts.forEach((t, i) => t.setTint(i === this.tab ? COLORS.highlight : COLORS.dim));
    const list = this.items();
    if (!list.length) list.push({ label: '(nothing)', disabled: true, desc: '' });
    this.menu.setItems(list, keepIndex);
    const s = Game.s;
    this.stats.setText(
      [`HP ${Math.ceil(s.hp)}/${s.maxHp}`, `MP ${Math.floor(s.mp)}/${s.maxMp}`, `Gold ${s.gold}`, '', `Time ${formatTime(s.playTimeMs)}`, '', `Slot ${Game.slot + 1}`].join('\n'),
    );
    this.showDesc();
  }

  showDesc(text) {
    const t = text ?? (this.menu.selected && this.menu.selected.desc) ?? '';
    this.desc.setText(wrapText(t, 220).slice(0, 3).join('\n'));
  }

  close() {
    input.consume();
    this.scene.stop();
    this.onClose();
  }

  select(item) {
    const s = Game.s;
    if (!item || item.disabled) return;
    switch (TABS[this.tab]) {
      case 'Items': {
        const d = DB.items[item.id];
        const use = (d && d.use) || {};
        if ((use.hp && s.hp >= s.maxHp && !use.mp) || (use.mp && s.mp >= s.maxMp && !use.hp)) return this.showDesc("You don't need that right now.");
        Game.heal(use.hp || 0, use.mp || 0);
        s.items[item.id]--;
        if (s.items[item.id] <= 0) delete s.items[item.id];
        this.refresh();
        return this.showDesc(`Used ${d.name}.`);
      }
      case 'Weapons':
        s.weapon = item.id;
        return this.refresh();
      case 'Spells':
        s.spell = item.id;
        return this.refresh();
      default:
        if (item.id === 'save') {
          const ok = Game.save();
          this.refresh();
          return this.showDesc(ok ? 'Game saved!' : 'Could not save (storage full or blocked).');
        }
        if (item.id === 'vibrate') {
          Game.settings.vibrate = !Game.settings.vibrate;
          touchControls.vibrate = Game.settings.vibrate;
          Game.saveSettings();
          return this.refresh();
        }
        if (item.id === 'title') {
          this.scene.stop('World');
          this.scene.stop('HUD');
          this.scene.stop('UI');
          this.scene.stop();
          this.scene.start('Title');
          return;
        }
        if (item.id === 'close') return this.close();
    }
  }

  update() {
    if (input.justPressed('start')) return this.close();
    let dt = 0;
    if (input.pressed('prevTab') || input.repeat('left')) dt = -1;
    if (input.pressed('nextTab') || input.repeat('right')) dt = 1;
    if (dt) {
      this.tab = (this.tab + dt + TABS.length) % TABS.length;
      return this.refresh(false);
    }
    const r = this.menu.update();
    if (!r) return;
    if (r.type === 'cancel') return this.close();
    if (r.type === 'move') return this.showDesc();
    if (r.type === 'select') this.select(this.menu.selected);
  }
}

function speedLabel(ms) {
  if (ms <= 320) return 'Fast';
  if (ms <= 550) return 'Normal';
  return 'Slow';
}
