import Phaser from 'phaser';
import './style.css';
import { GAME } from './config/game.config.js';
import { input } from './input/InputManager.js';
import { touchControls } from './input/TouchControls.js';
import { installScaler } from './scale.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { UIScene } from './scenes/UIScene.js';
import { OptionsScene, applySettings } from './scenes/OptionsScene.js';
import { MapScene } from './scenes/MapScene.js';
import { Audio } from './systems/Audio.js';

input.attach();
touchControls.attach();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: GAME.backgroundColor,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  physics: { default: 'arcade', arcade: { debug: GAME.debugPhysics } },
  input: { keyboard: false, gamepad: false, mouse: false, touch: false }, // we use our own input layer
  // Order = draw order (later scenes are drawn on top).
  scene: [BootScene, TitleScene, WorldScene, HUDScene, PauseScene, ShopScene, MapScene, OptionsScene, UIScene],
});

// Merge keyboard/gamepad/touch once per frame, before any scene updates.
game.events.on(Phaser.Core.Events.PRE_STEP, (time) => input.update(time));

installScaler(game);
Audio.init(game);
applySettings();

const fsBtn = document.getElementById('fullscreen-btn');
if (!document.fullscreenEnabled) fsBtn.style.display = 'none';
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
});

window.__game = game; // handy for debugging in the browser console
window.__audio = Audio;

/**
 * Art helper: in the browser console run  __exportSprite('player')  to download that sprite's
 * current sheet (placeholder or yours) as a PNG template in the exact layout the game expects.
 */
window.__exportSprite = (key) => {
  const tex = game.textures.get(key);
  if (!tex || tex.key === '__MISSING') return console.warn(`No texture "${key}"`);
  const src = tex.getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `${key}.png`;
  a.click();
};
