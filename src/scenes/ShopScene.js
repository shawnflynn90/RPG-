import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { pixelText, wrapText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';

import { Audio } from '../systems/Audio.js';
import { anchorUI, backdrop } from '../ui/layout.js';

/**
 * Buying screen for shops (data/shops.json), spell teachers (data/teachers.json) and
 * blacksmiths (data/smiths.json).
 * Shop stock entries: { weapon | item | spell | armor, price }.  Teacher entries: { spell, price }.
 * Blacksmiths upgrade the player's weapons using each weapon's "upgrades" list.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.kind = data.kind;
    this.def = { teacher: DB.teachers, smith: DB.smiths, shop: DB.shops }[data.kind][data.id];
    this.onClose = data.onClose || (() => {});
  }

  create() {
    backdrop(this);
    anchorUI(this, 'center');
    drawPanel(this, 2, 2, 236, 18);
    pixelText(this, 8, 7, this.def.name || 'Shop', COLORS.highlight);
    this.goldText = pixelText(this, 232, 7, '', COLORS.highlight).setOrigin(1, 0);
    drawPanel(this, 2, 22, 236, 96);
    drawPanel(this, 2, 120, 236, 38);
    this.desc = pixelText(this, 9, 126, '', COLORS.text);
    this.menu = new ListMenu(this, 7, 28, 222, 8, []);
    this.refresh();
  }

  smithEntries() {
    const s = Game.s;
    return s.weapons.map((id) => {
      const w = Game.weaponStats(id);
      const base = DB.weapons[id];
      const next = (base.upgrades || [])[w.level];
      if (!next) return { label: w.displayName, right: 'MAX', disabled: true, color: COLORS.dim, desc: `${base.name} is fully upgraded.` };
      const changes = Object.entries(next)
        .filter(([k]) => k !== 'price')
        .map(([k, v]) => (k === 'cooldownMs' ? (v < 0 ? 'faster' : 'slower') : `${k} ${v > 0 ? '+' : ''}${v}`))
        .join(', ');
      const tooPoor = s.gold < next.price;
      return {
        label: w.displayName,
        right: `${next.price}G`,
        disabled: tooPoor,
        color: tooPoor ? COLORS.bad : undefined,
        upgrade: id,
        price: next.price,
        desc: `Upgrade to +${w.level + 1}: ${changes}.`,
      };
    });
  }

  entries() {
    if (this.kind === 'smith') return this.smithEntries();
    const list = this.kind === 'teacher' ? this.def.spells : this.def.stock;
    const s = Game.s;
    return list.map((e) => {
      let def;
      let owned = false;
      let kind;
      if (e.weapon) {
        kind = 'weapon';
        def = DB.weapons[e.weapon];
        owned = s.weapons.includes(e.weapon);
      } else if (e.tool) {
        kind = 'tool';
        def = DB.spells[e.tool];
        owned = s.spells.includes(e.tool);
      } else if (e.armor) {
        kind = 'armor';
        def = DB.armor[e.armor];
        owned = s.armors.includes(e.armor);
      } else if (e.spell) {
        kind = 'spell';
        def = DB.spells[e.spell];
        owned = s.spells.includes(e.spell);
      } else {
        kind = 'item';
        def = DB.items[e.item];
      }
      if (!def) return { label: `(missing ${JSON.stringify(e)})`, disabled: true };
      const price = e.price ?? def.price ?? 0;
      const tooPoor = s.gold < price;
      let right = `${price}G`;
      if (owned) right = kind === 'spell' ? 'Learned' : 'Owned';
      else if (kind === 'item' && s.items[e.item]) right = `${price}G (${s.items[e.item]})`;
      return {
        label: e.count > 1 ? `${def.name} x${e.count}` : def.name,
        right,
        disabled: owned || tooPoor,
        color: owned ? COLORS.dim : tooPoor ? COLORS.bad : undefined,
        entry: e,
        kind,
        def,
        price,
        owned,
        desc: def.description || '',
      };
    });
  }

  refresh() {
    this.goldText.setText(`Gold ${Game.s.gold}`);
    this.menu.setItems([...this.entries(), { label: 'Leave', leave: true, desc: 'Come again!' }]);
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

  buy(it) {
    if (it && it.leave) return this.close();
    if (it && it.upgrade) {
      if (Game.s.gold < it.price) return this.showDesc("You can't afford that.");
      Game.s.gold -= it.price;
      Game.s.weaponLevels[it.upgrade] = (Game.s.weaponLevels[it.upgrade] || 0) + 1;
      Audio.sfx('upgrade');
      this.refresh();
      return this.showDesc(`${Game.weaponStats(it.upgrade).displayName}! It feels stronger.`);
    }
    if (!it || !it.def) return;
    if (it.owned) return this.showDesc(it.kind === 'spell' ? 'You already know that spell.' : 'You already have that.');
    if (Game.s.gold < it.price) return this.showDesc("You can't afford that.");
    Game.s.gold -= it.price;
    if (it.kind === 'weapon') Game.addWeapon(it.entry.weapon);
    if (it.kind === 'spell') Game.addSpell(it.entry.spell);
    if (it.kind === 'tool') Game.addSpell(it.entry.tool);
    if (it.kind === 'armor') Game.addArmor(it.entry.armor);
    Audio.sfx('coin');
    if (it.kind === 'item') Game.addItem(it.entry.item, it.entry.count || 1);
    this.refresh();
    const tip = { spell: ' Equip it with RB or in the menu.', tool: ' Select it with RB, use it with B.', armor: ' Equip it in the menu (Armor).' }[it.kind] || '';
    this.showDesc(it.kind === 'spell' ? `You learned ${it.def.name}!${tip}` : `Bought ${it.def.name}!${tip}`);
  }

  update() {
    const r = this.menu.update();
    if (!r) return;
    if (r.type === 'cancel') this.close();
    else if (r.type === 'move') this.showDesc();
    else if (r.type === 'select') this.buy(this.menu.selected);
  }
}
