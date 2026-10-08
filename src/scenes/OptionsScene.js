import Phaser from 'phaser';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { touchControls } from '../input/TouchControls.js';
import { Audio } from '../systems/Audio.js';
import { BUTTONS, KEYBOARD, GAMEPAD } from '../config/input.config.js';
import { pixelText, wrapText } from '../ui/font.js';
import { drawPanel, ListMenu, COLORS } from '../ui/widgets.js';
import { anchorUI, backdrop } from '../ui/layout.js';

const TEXT_SPEED_NAMES = ['Slow', 'Normal', 'Fast'];
const BUTTON_NAMES = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', A: 'A', B: 'B', LB: 'L', RB: 'R', select: 'Select', start: 'Start' };
const PAD_NAMES = ['A/Cross', 'B/Circle', 'X/Square', 'Y/Triangle', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L-Stick', 'R-Stick', 'Up', 'Down', 'Left', 'Right', 'Home'];

/** Apply every saved setting (called at boot and after changes). */
export function applySettings() {
  const s = Game.settings;
  touchControls.vibrate = s.vibrate;
  touchControls.applyLayout({ scale: s.touchScale, offsets: s.touchOffsets });
  input.applyMappings(s.keyboard, s.gamepad);
  Audio.applyVolumes();
}

function keyName(code) {
  if (!code) return '-';
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Arrow/, '')
    .replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, (_, k, side) => side[0] + k.replace('Control', 'Ctrl'));
}

/**
 * Options: volume, text speed, vibration, touch size/position, keyboard + gamepad rebinding.
 * Opened from the title screen and from Pause > System.
 */
export class OptionsScene extends Phaser.Scene {
  constructor() {
    super('Options');
  }

  init(data) {
    this.onClose = data.onClose || (() => {});
    this.page = 'main'; // main | keyboard | gamepad
    this.waiting = false;
  }

  create() {
    backdrop(this);
    anchorUI(this, 'center');
    drawPanel(this, 2, 2, 236, 18);
    this.title = pixelText(this, 8, 7, 'Options', COLORS.highlight);
    drawPanel(this, 2, 22, 236, 104);
    drawPanel(this, 2, 128, 236, 30);
    this.desc = pixelText(this, 9, 133, '', COLORS.text);
    this.menu = new ListMenu(this, 7, 28, 222, 9, []);
    this.refresh(false);
  }

  get s() {
    return Game.settings;
  }

  mainItems() {
    const s = this.s;
    const bar = (v) => `${v}/10`;
    return [
      { id: 'music', label: 'Music volume', right: `< ${bar(s.musicVolume)} >`, desc: 'Left/Right to change.' },
      { id: 'sfx', label: 'Sound effects', right: `< ${bar(s.sfxVolume)} >`, desc: 'Left/Right to change.' },
      { id: 'text', label: 'Text speed', right: `< ${TEXT_SPEED_NAMES[s.textSpeed]} >`, desc: 'How fast dialogue text appears.' },
      { id: 'vibrate', label: 'Vibration', right: s.vibrate ? 'On' : 'Off', desc: 'Vibrate when touch buttons are pressed (Android).' },
      { id: 'touchScale', label: 'Touch button size', right: `< ${Math.round(s.touchScale * 100)}% >`, desc: 'Left/Right to resize the on-screen buttons.' },
      { id: 'touchMove', label: 'Move touch buttons', desc: 'Drag the on-screen buttons where you want them (saved per orientation).' },
      { id: 'keyboard', label: 'Keyboard controls', desc: 'Choose which key does what.' },
      { id: 'gamepad', label: 'Gamepad controls', desc: 'Choose which gamepad button does what.' },
      { id: 'back', label: 'Back', desc: '' },
    ];
  }

  bindItems(kind) {
    const map = kind === 'keyboard' ? this.s.keyboard || KEYBOARD : this.s.gamepad || GAMEPAD.buttons;
    const items = BUTTONS.map((b) => ({
      id: b,
      label: BUTTON_NAMES[b],
      right: (map[b] || []).map((c) => (kind === 'keyboard' ? keyName(c) : PAD_NAMES[c] || `#${c}`)).join(', ') || '-',
      desc: `Select, then press the ${kind === 'keyboard' ? 'key' : 'gamepad button'} for ${BUTTON_NAMES[b]}.`,
    }));
    items.push({ id: 'reset', label: 'Reset to defaults', desc: 'Restore the original controls.' });
    items.push({ id: 'back', label: 'Back', desc: '' });
    return items;
  }

  refresh(keep = true) {
    this.title.setText(this.page === 'main' ? 'Options' : this.page === 'keyboard' ? 'Options - Keyboard' : 'Options - Gamepad');
    this.menu.setItems(this.page === 'main' ? this.mainItems() : this.bindItems(this.page), keep);
    this.showDesc();
  }

  showDesc(t) {
    const text = t ?? (this.menu.selected && this.menu.selected.desc) ?? '';
    this.desc.setText(wrapText(text, 220).slice(0, 2).join('\n'));
  }

  save() {
    Game.saveSettings();
    applySettings();
  }

  adjust(id, dir) {
    const s = this.s;
    if (id === 'music') s.musicVolume = Phaser.Math.Clamp(s.musicVolume + dir, 0, 10);
    else if (id === 'sfx') s.sfxVolume = Phaser.Math.Clamp(s.sfxVolume + dir, 0, 10);
    else if (id === 'text') s.textSpeed = Phaser.Math.Clamp(s.textSpeed + dir, 0, 2);
    else if (id === 'touchScale') s.touchScale = Phaser.Math.Clamp(Math.round((s.touchScale + dir * 0.1) * 10) / 10, 0.7, 1.5);
    else if (id === 'vibrate') s.vibrate = !s.vibrate;
    else return false;
    this.save();
    Audio.sfx('menuMove');
    this.refresh();
    return true;
  }

  close() {
    input.consume();
    this.scene.stop();
    this.onClose();
  }

  rebind(kind, btn) {
    this.waiting = true;
    this.showDesc(`Press the new ${kind === 'keyboard' ? 'key' : 'gamepad button'} for ${BUTTON_NAMES[btn]}...`);
    input.captureNext(kind, (code) => {
      const base = kind === 'keyboard' ? this.s.keyboard || KEYBOARD : this.s.gamepad || GAMEPAD.buttons;
      const map = JSON.parse(JSON.stringify(base));
      // a key/button can only do one thing: take it away from any other button
      for (const b of Object.keys(map)) map[b] = map[b].filter((c) => c !== code);
      map[btn] = [code];
      if (kind === 'keyboard') this.s.keyboard = map;
      else this.s.gamepad = map;
      this.save();
      Audio.sfx('menuSelect');
      // ignore the key-up / release of the key we just captured
      this.time.delayedCall(150, () => {
        this.waiting = false;
        input.consume();
      });
      this.refresh();
    });
  }

  update() {
    if (this.waiting) return;
    const sel = this.menu.selected;
    if (this.page === 'main' && sel) {
      if (input.repeat('left') && this.adjust(sel.id, -1)) return;
      if (input.repeat('right') && this.adjust(sel.id, 1)) return;
    }
    const r = this.menu.update();
    if (!r) return;
    if (r.type === 'move') return this.showDesc();
    if (r.type === 'cancel') {
      if (this.page === 'main') return this.close();
      this.page = 'main';
      return this.refresh(false);
    }
    if (r.type !== 'select') return;
    if (this.page === 'main') {
      switch (sel.id) {
        case 'vibrate':
          return this.adjust('vibrate', 1);
        case 'music':
        case 'sfx':
        case 'text':
        case 'touchScale':
          return this.adjust(sel.id, 1);
        case 'touchMove':
          this.waiting = true;
          this.showDesc('Drag the buttons, then tap DONE at the top of the screen.');
          touchControls.startEdit((offsets) => {
            this.s.touchOffsets = offsets;
            this.save();
            this.waiting = false;
            input.consume();
            this.refresh();
          });
          return;
        case 'keyboard':
        case 'gamepad':
          this.page = sel.id;
          return this.refresh(false);
        case 'back':
          return this.close();
      }
    } else {
      if (sel.id === 'back') {
        this.page = 'main';
        return this.refresh(false);
      }
      if (sel.id === 'reset') {
        if (this.page === 'keyboard') this.s.keyboard = null;
        else this.s.gamepad = null;
        this.save();
        return this.refresh();
      }
      this.rebind(this.page, sel.id);
    }
  }
}
