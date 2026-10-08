import { GAME } from '../config/game.config.js';

/**
 * UI scenes are laid out for 240x160. On taller screens (see scale.js) this shifts the
 * scene's camera so the layout sits at the top, bottom or centre of the real screen.
 * `onResize(extra)` is called with the extra height whenever the screen changes.
 */
export function anchorUI(scene, mode = 'center', onResize) {
  const apply = () => {
    const extra = scene.scale.height - GAME.height;
    const cam = scene.cameras.main;
    cam.setSize(scene.scale.width, scene.scale.height);
    cam.setScroll(0, mode === 'top' ? 0 : mode === 'bottom' ? -extra : -Math.floor(extra / 2));
    if (onResize) onResize(extra);
  };
  apply();
  scene.scale.on('resize', apply);
  scene.events.once('shutdown', () => scene.scale.off('resize', apply));
  return apply;
}

/** A full-screen backdrop that still covers the screen when the camera is shifted. */
export function backdrop(scene, color = 0x080818, alpha = 1) {
  return scene.add.rectangle(0, -GAME.maxHeight, GAME.width, GAME.maxHeight * 3, color, alpha).setOrigin(0);
}
