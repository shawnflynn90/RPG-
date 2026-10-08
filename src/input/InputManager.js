import { BUTTONS, KEYBOARD, GAMEPAD, ACTIONS } from '../config/input.config.js';

const REPEAT_DELAY = 280; // ms before a held direction starts repeating (menus)
const REPEAT_RATE = 90; // ms between repeats

/**
 * The single input layer. Keyboard, gamepad and touch each report which virtual buttons they hold;
 * this merges them into one state that the game reads once per frame.
 *
 *   input.isDown('A')          held right now
 *   input.justPressed('A')     went down this frame (never missed, even for very quick taps)
 *   input.pressed('attack')    same as justPressed, but by action name (see ACTIONS in input.config.js)
 *   input.repeat('down')       true on press and then auto-repeats while held (for menus)
 *   input.direction()          {x, y} from the D-pad, each -1/0/1
 */
class InputManager {
  constructor() {
    this.sources = { keyboard: new Set(), gamepad: new Set(), touch: new Set() };
    this.down = new Set();
    this.prev = new Set();
    this.latched = new Set(); // presses that happened since the last update()
    this.just = new Set();
    this.heldSince = {};
    this.lastRepeat = {};
    this.now = 0;
    this.lastSource = null;
    this.sourceListeners = [];
    this.keysHeld = new Set();
    this.capture = null; // { type: 'keyboard'|'gamepad', cb }
    this.prevPadButtons = new Set();
    this.applyMappings(null, null);
  }

  /** Use custom mappings (from the Options menu); null = defaults from input.config.js. */
  applyMappings(keyboard, gamepadButtons) {
    this.keyboardMap = keyboard || KEYBOARD;
    this.gamepadMap = gamepadButtons || GAMEPAD.buttons;
    this.codeToButtons = new Map();
    for (const [btn, codes] of Object.entries(this.keyboardMap)) {
      for (const code of codes) {
        if (!this.codeToButtons.has(code)) this.codeToButtons.set(code, []);
        this.codeToButtons.get(code).push(btn);
      }
    }
    this.keysHeld.clear();
    this.sources.keyboard = new Set();
  }

  /** Wait for the next key (type 'keyboard') or gamepad button (type 'gamepad'); cb(codeOrIndex). */
  captureNext(type, cb) {
    this.capture = { type, cb, since: performance.now() };
  }

  /** Call once at startup. */
  attach() {
    window.addEventListener('keydown', (e) => {
      if (this.capture && this.capture.type === 'keyboard') {
        e.preventDefault();
        const { cb } = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      const btns = this.codeToButtons.get(e.code);
      if (!btns) return;
      e.preventDefault();
      if (e.repeat) return;
      this.keysHeld.add(e.code);
      this.recomputeKeyboard();
      this.setSource('keyboard');
    });
    window.addEventListener('keyup', (e) => {
      if (!this.codeToButtons.has(e.code)) return;
      e.preventDefault();
      this.keysHeld.delete(e.code);
      this.recomputeKeyboard();
    });
    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.sources.keyboard.clear();
      this.sources.touch.clear();
    });
  }

  recomputeKeyboard() {
    const set = new Set();
    for (const code of this.keysHeld) for (const b of this.codeToButtons.get(code)) set.add(b);
    this.setSourceButtons('keyboard', set);
  }

  /** Used by TouchControls (and the keyboard/gamepad code): replace one source's held buttons. */
  setSourceButtons(source, set) {
    const old = this.sources[source];
    for (const b of set) if (!old.has(b)) this.latched.add(b);
    this.sources[source] = set;
  }

  setSource(name) {
    if (this.lastSource === name) return;
    this.lastSource = name;
    for (const fn of this.sourceListeners) fn(name);
  }

  /** fn(sourceName) whenever the player switches between keyboard / gamepad / touch. */
  onSourceChange(fn) {
    this.sourceListeners.push(fn);
  }

  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const set = new Set();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      if (this.capture && this.capture.type === 'gamepad' && performance.now() - this.capture.since > 250) {
        const idx = pad.buttons.findIndex((b, i) => b && b.pressed && !this.prevPadButtons.has(i));
        if (idx >= 0) {
          const { cb } = this.capture;
          this.capture = null;
          cb(idx);
        }
      }
      this.prevPadButtons = new Set(pad.buttons.map((b, i) => (b && b.pressed ? i : -1)).filter((i) => i >= 0));
      if (this.capture) continue; // don't press game buttons while capturing
      for (const [btn, idxs] of Object.entries(this.gamepadMap)) {
        if (idxs.some((i) => pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5))) set.add(btn);
      }
      const { xAxis, yAxis, deadzone } = GAMEPAD.stick;
      const x = pad.axes[xAxis] || 0;
      const y = pad.axes[yAxis] || 0;
      if (x < -deadzone) set.add('left');
      if (x > deadzone) set.add('right');
      if (y < -deadzone) set.add('up');
      if (y > deadzone) set.add('down');
    }
    if (set.size > 0) this.setSource('gamepad');
    this.setSourceButtons('gamepad', set);
  }

  /** Call once per game step, before any scene updates. */
  update(time) {
    this.now = time;
    this.pollGamepads();
    this.prev = this.down;
    this.down = new Set([...this.sources.keyboard, ...this.sources.gamepad, ...this.sources.touch]);
    this.just = new Set(this.latched);
    for (const b of this.down) if (!this.prev.has(b)) this.just.add(b);
    this.latched.clear();
    for (const b of BUTTONS) {
      if (this.just.has(b)) {
        this.heldSince[b] = time;
        this.lastRepeat[b] = time;
      }
    }
  }

  isDown(btn) {
    return this.down.has(btn);
  }

  justPressed(btn) {
    return this.just.has(btn);
  }

  /** Swallow presses so the next scene doesn't see them (e.g. after closing a menu). */
  consume(...btns) {
    for (const b of btns.length ? btns : BUTTONS) this.just.delete(b);
  }

  /** Action-name helpers. */
  pressed(action) {
    return this.justPressed(ACTIONS[action]);
  }

  held(action) {
    return this.isDown(ACTIONS[action]);
  }

  repeat(btn) {
    if (this.just.has(btn)) return true;
    if (!this.down.has(btn)) return false;
    if (this.now - this.heldSince[btn] < REPEAT_DELAY) return false;
    if (this.now - this.lastRepeat[btn] >= REPEAT_RATE) {
      this.lastRepeat[btn] = this.now;
      return true;
    }
    return false;
  }

  direction() {
    return {
      x: (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0),
      y: (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0),
    };
  }
}

export const input = new InputManager();
