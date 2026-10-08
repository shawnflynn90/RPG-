// Engine-level tunables. Content (weapons, spells, enemies...) lives in public/data/*.json instead.

export const GAME = {
  width: 240, // GBA native resolution
  height: 160, // minimum height; tall screens (portrait phones) get up to maxHeight
  maxHeight: 256,
  tileSize: 16,
  /**
   * true  = prefer whole multiples of the *device* pixel grid (perfectly crisp pixels) when
   *         that costs little screen space; otherwise fill.
   * false = fill the available space (pixels may be slightly uneven).
   */
  integerScaling: true,
  backgroundColor: '#000000',
  debugPhysics: false,
};

export const PLAYER = {
  speed: 72, // px per second
  hitInvincibleMs: 900,
  knockbackSpeed: 170,
  knockbackMs: 140,
  mpRegenPerSecond: 0.5,
  interactReach: 12, // px in front of the player that counts for talking / opening chests
  talkReach: 30, // longer reach for NPCs only (talk across a shop counter)
};

export const UI = {
  textSpeed: 40, // characters per second in dialogue boxes (hold A to speed up)
  dialogueLines: 3,
};

export const SAVE = {
  slots: 3,
  keyPrefix: 'pocketquest.save.',
  settingsKey: 'pocketquest.settings',
  version: 2, // bump when old saves need fixing up (see migrate() in systems/GameState.js)
};
