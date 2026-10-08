import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { pixelText, wrapText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';

/**
 * Buying screen for shops (data/shops.json) and spell teachers (data/teachers.json).
 * Shop stock entries: { weapon | item | spell, price }.  Teacher entries: { spell, price }.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.kind = data.kind;
    this.def = (data.kind === 'teacher' ? DB.teachers : DB.shops)[data.id];
    this.onClose = data.onClose || (() => {});
  }

  create() {
    drawPanel(this, 2, 2, 236, 18);
    pixelText(this, 8, 7, this.def.name || 'Shop', COLORS.highlight);
    this.goldText = pixelText(this, 232, 7, '', COLORS.highlight).setOrigin(1, 0);
    drawPanel(this, 2, 22, 236, 96);
    drawPanel(this, 2, 120, 236, 38);
    this.desc = pixelText(this, 9, 126, '', COLORS.text);
    this.menu = new ListMenu(this, 7, 28, 222, 8, []);
    this.refresh();
  }

  entries() {
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
        label: def.name,
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
    if (!it || !it.def) return;
    if (it.owned) return this.showDesc(it.kind === 'spell' ? 'You already know that spell.' : 'You already have that.');
    if (Game.s.gold < it.price) return this.showDesc("You can't afford that.");
    Game.s.gold -= it.price;
    if (it.kind === 'weapon') Game.addWeapon(it.entry.weapon);
    if (it.kind === 'spell') Game.addSpell(it.entry.spell);
    if (it.kind === 'item') Game.addItem(it.entry.item, 1);
    this.refresh();
    this.showDesc(it.kind === 'spell' ? `You learned ${it.def.name}! Equip it with RB or in the menu.` : `Bought ${it.def.name}!`);
  }

  update() {
    const r = this.menu.update();
    if (!r) return;
    if (r.type === 'cancel') this.close();
    else if (r.type === 'move') this.showDesc();
    else if (r.type === 'select') this.buy(this.menu.selected);
  }
}
