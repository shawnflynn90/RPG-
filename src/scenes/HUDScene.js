import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { pixelText } from '../ui/font.js';
import { drawPanel } from '../ui/widgets.js';

/** HP / MP bars, gold, equipped weapon + spell, boss health bar, area names. */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    this.world = null;
    this.lastArea = null;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.45).fillRoundedRect(1, 1, 70, 29, 3);
    pixelText(this, 4, 2, 'HP', 0xf87878);
    pixelText(this, 4, 11, 'MP', 0x78a8f8);
    this.hpBar = this.makeBar(18, 4, 50, 0xe84050);
    this.mpBar = this.makeBar(18, 13, 50, 0x4888f0);
    this.xpBar = this.add.rectangle(18, 18, 0, 1, 0x88d8f8).setOrigin(0, 0);
    this.add.image(8, 24, 'coin');
    this.goldText = pixelText(this, 14, 20, '0', 0xf8e060);
    this.levelText = pixelText(this, 68, 20, '', 0x88d8f8).setOrigin(1, 0);
    this.statusText = pixelText(this, 4, 32, '', 0x98e878);
    this.keyIcon = this.add.image(203, 30, 'icon_key').setVisible(false);
    this.keyText = pixelText(this, 211, 26, '', 0xffffff);

    // equipped weapon (L) and spell (R)
    this.slots = {};
    for (const [kind, x, label] of [
      ['weapon', 196, 'L'],
      ['spell', 219, 'R'],
    ]) {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.5).fillRoundedRect(x - 1, 1, 20, 20, 3);
      g.lineStyle(1, 0xd0d0e8, 0.8).strokeRoundedRect(x - 1, 1, 20, 20, 3);
      const icon = this.add.image(x + 9, 11, 'pixel');
      const cd = this.add.rectangle(x + 1, 3, 16, 16, 0x000000, 0.6).setOrigin(0, 0);
      const tag = pixelText(this, x + 13, 13, label, 0xffffff);
      this.slots[kind] = { icon, cd, tag, x };
    }
    this.mpCost = pixelText(this, 228, 22, '', 0x88b8ff).setOrigin(0.5, 0);
    this.equipName = pixelText(this, 236, 33, '', 0xffffff).setOrigin(1, 0).setAlpha(0);

    // boss bar
    this.bossUI = this.add.container(0, 0).setVisible(false);
    const bb = this.add.graphics();
    bb.fillStyle(0x000000, 0.6).fillRoundedRect(36, 140, 168, 18, 3);
    this.bossName = pixelText(this, 120, 141, '', 0xf8e060).setOrigin(0.5, 0);
    const bossBg = this.add.rectangle(40, 152, 160, 4, 0x401018).setOrigin(0, 0.5);
    this.bossFill = this.add.rectangle(40, 152, 160, 4, 0xf84838).setOrigin(0, 0.5);
    this.bossUI.add([bb, this.bossName, bossBg, this.bossFill]);

    this.areaBanner = this.add.container(120, 46).setAlpha(0);
  }

  makeBar(x, y, w, color) {
    this.add.rectangle(x - 1, y - 1, w + 2, 6, 0x000000).setOrigin(0, 0);
    this.add.rectangle(x, y, w, 4, 0x302838).setOrigin(0, 0);
    const fill = this.add.rectangle(x, y, w, 4, color).setOrigin(0, 0);
    const shine = this.add.rectangle(x, y, w, 1, 0xffffff, 0.35).setOrigin(0, 0);
    return { fill, shine, w };
  }

  setBar(bar, frac) {
    const w = Math.round(bar.w * Phaser.Math.Clamp(frac, 0, 1));
    bar.fill.width = w;
    bar.shine.width = w;
  }

  /** Called by WorldScene every time a map loads. */
  attachWorld(world) {
    this.world = world;
    if (!this.areaBanner) return; // HUD not created yet
    world.events.off('equip-changed', this.flashEquip, this); // scene events survive restarts
    world.events.on('equip-changed', this.flashEquip, this);
    const def = world.mapDef;
    if (def.name && def.name !== this.lastArea) this.showArea(def.name);
    this.lastArea = def.name;
  }

  showArea(name) {
    this.areaBanner.removeAll(true);
    const w = name.length * 5 + 20;
    this.areaBanner.add([drawPanel(this, -w / 2, -8, w, 17), pixelText(this, 0, -4, name, 0xffffff).setOrigin(0.5, 0)]);
    this.tweens.killTweensOf(this.areaBanner);
    this.areaBanner.setAlpha(0);
    this.tweens.chain({
      targets: this.areaBanner,
      tweens: [
        { alpha: 1, duration: 200, delay: 200 },
        { alpha: 0, duration: 400, delay: 1400 },
      ],
    });
  }

  flashEquip(kind, id) {
    const def = kind === 'weapon' ? Game.weaponStats(id) : DB.spells[id];
    if (!def) return;
    this.equipName.setText(def.displayName || def.name).setAlpha(1);
    this.tweens.killTweensOf(this.equipName);
    this.tweens.add({ targets: this.equipName, alpha: 0, delay: 900, duration: 300 });
  }

  update() {
    const s = Game.s;
    if (!s) return;
    this.setBar(this.hpBar, s.hp / s.maxHp);
    this.setBar(this.mpBar, s.mp / s.maxMp);
    this.goldText.setText(String(s.gold));
    this.levelText.setText(`Lv${s.level}`);
    const next = Game.xpToNext();
    this.xpBar.width = next === Infinity ? 50 : Math.round((50 * s.xp) / next);
    const keys = (s.items.small_key || 0) + (s.items.boss_key ? 1 : 0);
    this.keyIcon.setVisible(keys > 0);
    this.keyText.setText(keys > 0 ? `${s.items.small_key || 0}${s.items.boss_key ? '+B' : ''}` : '');
    const pl = this.world && this.world.player;
    if (pl && pl.active) {
      const st = [];
      if (pl.status.poison) st.push('POISON');
      if (pl.status.burn) st.push('BURN');
      if (pl.stunned) st.push('STUN');
      if (this.time.now < pl.slowUntil) st.push('SLOW');
      this.statusText.setText(st.join(' '));
      this.statusText.setTint(pl.status.poison ? 0x98e878 : pl.status.burn ? 0xf8a050 : 0xf8f078);
    }

    const w = Game.weaponStats();
    const sp = DB.spells[s.spell];
    this.setIcon(this.slots.weapon, w && w.icon);
    this.setIcon(this.slots.spell, sp && sp.icon);
    const cd = pl && pl.active && sp ? pl.spellCooldown(s.spell) : 0;
    const noMp = sp && s.mp < sp.mpCost;
    this.slots.spell.cd.setVisible(cd > 0 || noMp);
    this.slots.spell.cd.height = noMp ? 16 : 16 * cd;
    this.slots.weapon.cd.setVisible(false);
    this.mpCost.setText(sp ? `${sp.mpCost}` : '');

    // boss bar
    const boss = this.world && this.world.boss;
    const show = !!(boss && boss.active && boss.engaged);
    this.bossUI.setVisible(show);
    if (show) {
      this.bossName.setText(boss.def.name);
      this.bossFill.width = Math.round(160 * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1));
    }
  }

  setIcon(slot, key) {
    if (!key || !this.textures.exists(key)) {
      slot.icon.setVisible(false);
      return;
    }
    if (slot.icon.texture.key !== key) slot.icon.setTexture(key);
    slot.icon.setVisible(true);
  }
}
