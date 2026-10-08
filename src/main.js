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
  scene: [BootScene, TitleScene, WorldScene, HUDScene, PauseScene, ShopScene, UIScene],
});

// Merge keyboard/gamepad/touch once per frame, before any scene updates.
game.events.on(Phaser.Core.Events.PRE_STEP, (time) => input.update(time));

installScaler(game);

const fsBtn = document.getElementById('fullscreen-btn');
if (!document.fullscreenEnabled) fsBtn.style.display = 'none';
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
});

window.__game = game; // handy for debugging in the browser console
