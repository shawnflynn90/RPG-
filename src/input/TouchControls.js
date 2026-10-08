import { TOUCH } from '../config/input.config.js';
import { input } from './InputManager.js';

/**
 * On-screen controls (DOM, see index.html + style.css).
 * - Multi-touch: every finger is tracked separately (hold a direction while pressing A).
 * - D-pad: a finger that starts on the D-pad keeps steering it while it slides, including diagonals,
 *   even after it leaves the pad.
 * - Buttons: a finger can slide from one button to another (e.g. from B onto A).
 * - Hides itself when keyboard/gamepad is used, comes back on the next touch.
 */
export class TouchControls {
  constructor() {
    this.dpad = document.getElementById('dpad');
    this.arms = {
      up: this.dpad.querySelector('.arm.up'),
      down: this.dpad.querySelector('.arm.down'),
      left: this.dpad.querySelector('.arm.left'),
      right: this.dpad.querySelector('.arm.right'),
    };
    this.buttonEls = [...document.querySelectorAll('[data-btn]')];
    /** pointerId -> { kind: 'dpad' | 'button', btns: Set } */
    this.pointers = new Map();
    this.vibrate = TOUCH.vibrate;
    this.editing = null; // layout edit mode state
    // Groups that can be dragged around in "Move touch buttons" mode.
    this.groups = {
      lb: document.querySelector('#left-pad .shoulder'),
      dpad: this.dpad,
      rb: document.querySelector('#right-pad .shoulder'),
      face: document.getElementById('face'),
      sys: document.getElementById('sys'),
    };
    this.layout = { scale: 1, offsets: {} };
  }

  orientation() {
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  }

  /** Apply size + per-orientation offsets. layout = { scale, offsets: { landscape: { dpad: [dx, dy] } } } */
  applyLayout(layout) {
    this.layout = { scale: layout.scale || 1, offsets: layout.offsets || {} };
    document.documentElement.style.setProperty('--touch-scale', String(this.layout.scale));
    const offs = this.layout.offsets[this.orientation()] || {};
    for (const [k, el] of Object.entries(this.groups)) {
      const [dx, dy] = offs[k] || [0, 0];
      el.style.translate = `${dx}px ${dy}px`;
    }
  }

  /** Drag the buttons around; onDone(offsets) is called when the player taps DONE. */
  startEdit(onDone) {
    this.wasVisible = document.body.classList.contains('touch-visible');
    this.setVisible(true);
    document.body.classList.add('touch-edit');
    const bar = document.createElement('div');
    bar.id = 'touch-edit-bar';
    bar.innerHTML = '<span>Drag the buttons where you like them</span><button data-act="reset">Reset</button><button data-act="done">Done</button>';
    document.body.appendChild(bar);
    const orient = this.orientation();
    const offs = JSON.parse(JSON.stringify(this.layout.offsets));
    offs[orient] = offs[orient] || {};
    this.editing = { orient, offs, drag: null, bar };
    bar.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'reset') {
        offs[orient] = {};
        this.applyLayout({ ...this.layout, offsets: offs });
      } else if (act === 'done') {
        this.editing = null;
        bar.remove();
        document.body.classList.remove('touch-edit');
        this.setVisible(this.wasVisible);
        onDone(offs);
      }
    });
  }

  editDown(e) {
    const ed = this.editing;
    for (const [k, el] of Object.entries(this.groups)) {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const [dx, dy] = ed.offs[ed.orient][k] || [0, 0];
        ed.drag = { k, el, sx: e.clientX, sy: e.clientY, dx, dy, id: e.pointerId };
        el.classList.add('dragging');
        return;
      }
    }
  }

  editMove(e) {
    const d = this.editing && this.editing.drag;
    if (!d || d.id !== e.pointerId) return;
    const nx = Math.round(d.dx + e.clientX - d.sx);
    const ny = Math.round(d.dy + e.clientY - d.sy);
    this.editing.offs[this.editing.orient][d.k] = [nx, ny];
    d.el.style.translate = `${nx}px ${ny}px`;
  }

  editUp() {
    const d = this.editing && this.editing.drag;
    if (d) d.el.classList.remove('dragging');
    if (this.editing) this.editing.drag = null;
  }

  attach() {
    const opts = { passive: false };
    const shell = document.getElementById('shell');
    shell.addEventListener('pointerdown', (e) => this.onDown(e), opts);
    window.addEventListener('pointermove', (e) => this.onMove(e), opts);
    window.addEventListener('pointerup', (e) => this.onUp(e), opts);
    window.addEventListener('pointercancel', (e) => this.onUp(e), opts);

    // Belt and braces against scrolling, pinch-zoom, double-tap zoom, long-press menus.
    const block = (e) => {
      if (e.target.closest && e.target.closest('#fullscreen-btn, #touch-edit-bar')) return;
      e.preventDefault();
    };
    document.addEventListener('touchstart', block, opts);
    document.addEventListener('touchmove', block, opts);
    document.addEventListener('gesturestart', block, opts);
    document.addEventListener('dblclick', block, opts);
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Any touch anywhere brings the controls back.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') input.setSource('touch');
    });
    input.onSourceChange((src) => !this.editing && this.setVisible(src === 'touch'));
    window.addEventListener('resize', () => this.applyLayout(this.layout));

    // Start visible on touch devices, hidden on desktop.
    const touchy = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.setVisible(touchy);
  }

  setVisible(visible) {
    document.body.classList.toggle('touch-hidden', !visible);
    document.body.classList.toggle('touch-visible', visible);
    if (!visible) {
      this.pointers.clear();
      this.sync();
    }
    window.dispatchEvent(new Event('resize')); // the screen area changed size
  }

  onDown(e) {
    if (e.target.closest('#fullscreen-btn')) return;
    e.preventDefault();
    if (this.editing) return this.editDown(e);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const dpadRect = this.dpad.getBoundingClientRect();
    // A slightly generous hit area around the D-pad.
    const pad = dpadRect.width * 0.15;
    if (
      e.clientX >= dpadRect.left - pad &&
      e.clientX <= dpadRect.right + pad &&
      e.clientY >= dpadRect.top - pad &&
      e.clientY <= dpadRect.bottom + pad
    ) {
      this.pointers.set(e.pointerId, { kind: 'dpad', btns: this.dpadDirs(e.clientX, e.clientY) });
    } else {
      const btn = this.buttonAt(e.clientX, e.clientY);
      if (!btn) return;
      this.pointers.set(e.pointerId, { kind: 'button', btns: new Set([btn]) });
    }
    this.sync(true);
  }

  onMove(e) {
    if (this.editing) return this.editMove(e);
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'dpad') {
      p.btns = this.dpadDirs(e.clientX, e.clientY);
    } else {
      const btn = this.buttonAt(e.clientX, e.clientY);
      if (btn && !p.btns.has(btn)) p.btns = new Set([btn]);
    }
    this.sync(true);
  }

  onUp(e) {
    if (this.editing) return this.editUp(e);
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.sync();
  }

  buttonAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const btnEl = el && el.closest('[data-btn]');
    return btnEl ? btnEl.dataset.btn : null;
  }

  /** Map a finger position to D-pad directions (8-way, with diagonals). */
  dpadDirs(x, y) {
    const r = this.dpad.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const dirs = new Set();
    if (Math.hypot(dx, dy) < (r.width / 2) * TOUCH.dpadDeadzone) return dirs;
    // angle 0 = right, 90 = down
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const near = (target) => Math.abs(((ang - target + 540) % 360) - 180) <= TOUCH.dpadDiagonalAngle;
    const sector = Math.round(ang / 45); // -4..4
    const s = ((sector % 8) + 8) % 8; // 0=right,1=down-right,2=down,...
    const map = [['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left'], ['up'], ['up', 'right']];
    let picked = map[s];
    // Only treat as diagonal when clearly diagonal; otherwise snap to the nearest cardinal.
    if (picked.length === 2 && !near(s * 45)) {
      picked = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 'right' : 'left'] : [dy > 0 ? 'down' : 'up'];
    }
    for (const d of picked) dirs.add(d);
    return dirs;
  }

  sync(fromPress = false) {
    const held = new Set();
    for (const p of this.pointers.values()) for (const b of p.btns) held.add(b);
    const before = input.sources.touch;
    const newlyPressed = [...held].some((b) => !before.has(b));
    input.setSourceButtons('touch', held);
    if (fromPress && newlyPressed && this.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(TOUCH.vibrateMs);
      } catch {
        /* not allowed yet */
      }
    }
    for (const [dir, el] of Object.entries(this.arms)) el.classList.toggle('on', held.has(dir));
    for (const el of this.buttonEls) el.classList.toggle('on', held.has(el.dataset.btn));
  }
}

export const touchControls = new TouchControls();
