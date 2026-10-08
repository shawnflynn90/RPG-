import { GAME } from './config/game.config.js';

/**
 * Sizes the 240x160 canvas to fit the #screen area.
 * The canvas keeps its native resolution; CSS scales it with `image-rendering: pixelated`.
 * With integer scaling we pick a whole multiple of the *device* pixel grid, so every game pixel
 * is exactly N x N physical pixels: perfectly crisp, even on 3x phone screens.
 */
export function installScaler(game) {
  const screen = document.getElementById('screen');

  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const availW = screen.clientWidth;
    const availH = screen.clientHeight;
    if (!availW || !availH) return;
    let cssScale;
    if (GAME.integerScaling) {
      const devScale = Math.max(1, Math.floor(Math.min((availW * dpr) / GAME.width, (availH * dpr) / GAME.height)));
      cssScale = devScale / dpr;
    } else {
      cssScale = Math.min(availW / GAME.width, availH / GAME.height);
    }
    game.scale.setZoom(cssScale);
  };

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.ResizeObserver) new ResizeObserver(fit).observe(screen);
  fit();
}
