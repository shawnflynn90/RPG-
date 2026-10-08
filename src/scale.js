import { GAME } from './config/game.config.js';

/**
 * Sizes the canvas to fill the #screen area.
 * The game is always GAME.width (240) pixels wide; its height grows with tall screens
 * (e.g. portrait phones) from GAME.height (160) up to GAME.maxHeight, so the screen can take
 * about half the phone. Scenes anchor their UI to the real height (see ui/layout.js).
 * CSS scales the canvas with `image-rendering: pixelated`. With integerScaling we snap to a
 * whole multiple of the *device* pixel grid when that wastes little space.
 */
export function installScaler(game) {
  const screen = document.getElementById('screen');

  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const availW = screen.clientWidth;
    const availH = screen.clientHeight;
    if (!availW || !availH) return;
    const W = GAME.width;
    const clampH = (h) => Math.max(GAME.height, Math.min(GAME.maxHeight, Math.floor(h)));
    let zoom = availW / W;
    if (availH / zoom < GAME.height) zoom = availH / GAME.height;
    if (GAME.integerScaling) {
      const dev = Math.floor(zoom * dpr);
      if (dev >= 1 && dev / (zoom * dpr) >= 0.88) zoom = dev / dpr;
    }
    const H = clampH(availH / zoom);
    if (H !== game.scale.height) game.scale.resize(W, H);
    game.scale.setZoom(zoom);
  };

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.ResizeObserver) new ResizeObserver(fit).observe(screen);
  fit();
}
