// ONE place for all control mapping.
// Keyboard, gamepad and on-screen touch controls all drive the same virtual buttons; the game only
// ever asks about virtual buttons (or the actions below), never about physical keys.

/** The virtual buttons of our "handheld". */
export const BUTTONS = ['up', 'down', 'left', 'right', 'A', 'B', 'LB', 'RB', 'select', 'start'];

/** Keyboard: virtual button -> list of KeyboardEvent.code values. */
export const KEYBOARD = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  A: ['KeyJ', 'KeyZ', 'Space'],
  B: ['KeyK', 'KeyX'],
  LB: ['KeyQ', 'KeyU'],
  RB: ['KeyE', 'KeyI'],
  select: ['Tab', 'ShiftRight', 'KeyM'],
  start: ['Enter', 'Escape', 'KeyP'],
};

/**
 * Gamepad (W3C "standard" layout, e.g. Xbox / PlayStation / Switch Pro in a browser):
 * 0 = bottom face, 1 = right face, 2 = left face, 3 = top face,
 * 4 = LB, 5 = RB, 6 = LT, 7 = RT, 8 = Back/Select, 9 = Start, 12-15 = D-pad up/down/left/right.
 */
export const GAMEPAD = {
  buttons: {
    up: [12],
    down: [13],
    left: [14],
    right: [15],
    A: [0],
    B: [2, 1],
    LB: [4, 6],
    RB: [5, 7],
    select: [8],
    start: [9],
  },
  /** Left stick also drives the D-pad. */
  stick: { xAxis: 0, yAxis: 1, deadzone: 0.35 },
};

/** Touch controls. */
export const TOUCH = {
  /** Vibrate on press (Android; iOS browsers ignore this). Can be toggled in the pause menu. */
  vibrate: true,
  vibrateMs: 8,
  /** Inner radius of the D-pad (fraction of its half-width) where no direction is pressed. */
  dpadDeadzone: 0.18,
  /** Diagonals: a thumb within this angle (degrees) of a diagonal presses both directions. */
  dpadDiagonalAngle: 22.5,
};

/**
 * Game actions -> virtual button. Game code asks `input.pressed('attack')` etc.
 * Several actions may share a button (A both attacks and talks, depending on what is in front of you).
 */
export const ACTIONS = {
  attack: 'A',
  interact: 'A',
  cast: 'B',
  cycleWeapon: 'LB',
  cycleSpell: 'RB',
  pause: 'start',
  map: 'select',
  // menus
  confirm: 'A',
  cancel: 'B',
  prevTab: 'LB',
  nextTab: 'RB',
};
