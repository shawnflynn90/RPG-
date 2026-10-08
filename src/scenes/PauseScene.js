import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { Audio } from '../systems/Audio.js';
import { pixelText, wrapText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';
import { formatTime } from './TitleScene.js';

const TABS = ['Items', 'Weapons', 'Spells', 'Armor', 'System'];

/** START menu: items, weapons, spells, armor, save & options. LB/RB (or left/right) switch tabs. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.onClose = data.onClose || (() => {});
    this.tab = 0;
    this.sub = false; // an Options screen is open on top
  }

  create() {
    this.add.rectangle(0, 0, 240, 160, 0x080818).setOrigin(0);
    drawPanel(this, 2, 2, 236, 18);
    this.tabTexts = TABS.map((t, i) => pixelText(this, 10 + i * 46, 7, t, COLORS.dim));
    drawPanel(this, 2, 22, 150, 96);
    drawPanel(this, 154, 22, 84, 96);
    drawPanel(this, 2, 120, 236, 38);
    this.stats = pixelText(this, 159, 27, '', COLORS.text);
    this.desc = pixelText(this, 9, 126, '', COLORS.text);
    this.menu = new ListMenu(this, 7, 28, 138, 8, []);
    this.refresh(false);
  }

  items() {
    const s = Game.s;
    const mark = (on) => (on ? '♥ ' : '  ');
    switch (TABS[this.tab]) {
      case 'Items':
        return Object.entries(s.items)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => {
            const d = DB.items[id] || { name: id };
            return { label: d.name, right: `x${n}`, id, desc: d.description, color: d.key ? COLORS.highlight : undefined };
          });
      case 'Weapons':
        return s.weapons.map((id) => {
          const w = Game.weaponStats(id);
          return {
            label: mark(s.weapon === id) + w.displayName,
            right: `${w.damage}`,
            id,
            color: s.weapon === id ? COLORS.highlight : undefined,
            desc: `${w.description}\nDamage ${w.damage}  Speed ${speedLabel(w.cooldownMs)}${w.charge ? '  Hold A: charge' : ''}`,
          };
        });
      case 'Spells':
        return s.spells.map((id) => {
          const d = DB.spells[id];
          return {
            label: mark(s.spell === id) + d.name,
            right: `${d.mpCost}MP`,
            id,
            color: s.spell === id ? COLORS.highlight : undefined,
            desc: d.description,
          };
        });
      case 'Armor':
        return s.armors.map((id) => {
          const d = DB.armor[id] || { name: id, defense: 0 };
          return {
            label: mark(s.armor === id) + d.name,
            right: `Def ${d.defense || 0}`,
            id,
            color: s.armor === id ? COLORS.highlight : undefined,
            desc: d.description,
          };
        });
      default:
        return [
          { label: 'Save', id: 'save', desc: `Save to slot ${Game.slot + 1}.` },
          { label: 'Options', id: 'options', desc: 'Sound, text speed, controls and touch layout.' },
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
    const next = Game.xpToNext();
    this.stats.setText(
      [
        `Level ${s.level}`,
        next === Infinity ? 'XP  MAX' : `XP ${s.xp}/${next}`,
        `HP ${Math.ceil(s.hp)}/${s.maxHp}`,
        `MP ${Math.floor(s.mp)}/${s.maxMp}`,
        `Atk +${Game.attackBonus()}  Def ${Game.defense}`,
        `Gold ${s.gold}`,
        `Time ${formatTime(s.playTimeMs)}`,
        `Slot ${Game.slot + 1}`,
      ].join('\n'),
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

  get world() {
    return this.scene.get('World');
  }

  select(item) {
    const s = Game.s;
    if (!item || item.disabled) return;
    switch (TABS[this.tab]) {
      case 'Items': {
        const d = DB.items[item.id];
        const use = (d && d.use) || {};
        if (d.key || !d.use) return this.showDesc(d.key ? 'Keys are used automatically on locked doors.' : "You can't use that here.");
        const pl = this.world.player;
        const poisoned = pl && Object.keys(pl.status).some((k) => (use.cure || []).includes(k));
        const needHp = use.hp && s.hp < s.maxHp;
        const needMp = use.mp && s.mp < s.maxMp;
        if (!needHp && !needMp && !poisoned) {
          Audio.sfx('error');
          return this.showDesc("You don't need that right now.");
        }
        Game.heal(use.hp || 0, use.mp || 0);
        if (use.cure && pl) pl.cure(use.cure);
        s.items[item.id]--;
        if (s.items[item.id] <= 0) delete s.items[item.id];
        Audio.sfx('heal');
        this.refresh();
        return this.showDesc(`Used ${d.name}.`);
      }
      case 'Weapons':
        s.weapon = item.id;
        return this.refresh();
      case 'Spells':
        s.spell = item.id;
        return this.refresh();
      case 'Armor':
        s.armor = item.id;
        return this.refresh();
      default:
        if (item.id === 'save') {
          const ok = Game.save();
          this.refresh();
          return this.showDesc(ok ? 'Game saved!' : 'Could not save (storage full or blocked).');
        }
        if (item.id === 'options') {
          this.sub = true;
          this.scene.launch('Options', {
            onClose: () => {
              this.sub = false;
              input.consume();
              this.refresh();
            },
          });
          this.scene.bringToTop('Options');
          return;
        }
        if (item.id === 'title') {
          Audio.music(null);
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
    if (this.sub) return;
    if (input.justPressed('start')) {
      Audio.sfx('menuBack');
      return this.close();
    }
    let dt = 0;
    if (input.pressed('prevTab') || input.repeat('left')) dt = -1;
    if (input.pressed('nextTab') || input.repeat('right')) dt = 1;
    if (dt) {
      Audio.sfx('menuMove');
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
