// Asset pipeline driven by public/assets.json:
//   1. queueAssets()   - queue every file the manifest names (plus tileset images from the maps)
//   2. finalizeAssets() - make a placeholder for anything without a file (or that failed to load),
//                        then build all animations from the sprite layouts.
// Placeholders follow exactly the same sheet layout your art will use, so swapping art never
// needs code changes.
import { DB } from './db.js';
import { drawGlyphs } from '../ui/font.js';
import { makeLightTexture } from './Lighting.js';

/** key -> resolved sprite info { frameWidth, frameHeight, directions, animations, mirrorLeft, body } */
export const SpriteInfo = {};

const resolveUrl = (file) => new URL(file, document.baseURI).href;

function spriteDef(key) {
  const def = DB.assets.sprites[key];
  const layout = (def.layout && DB.assets.layouts[def.layout]) || {};
  return {
    ...layout,
    ...def,
    animations: { ...(layout.animations || {}), ...(def.animations || {}) },
  };
}

export function queueAssets(scene) {
  const { sprites = {}, images = {}, fonts = {}, audio = {} } = DB.assets;
  for (const key of Object.keys(sprites)) {
    const def = spriteDef(key);
    if (def.file) {
      scene.load.spritesheet(key, resolveUrl(def.file), { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
    }
  }
  for (const [key, def] of Object.entries(images)) if (def.file) scene.load.image(key, resolveUrl(def.file));
  // A BMFont with the key "pixel" replaces the built-in font.
  if (fonts.pixel) scene.cache.bitmapFont.remove('pixel');
  for (const [key, def] of Object.entries(fonts)) scene.load.bitmapFont(key, resolveUrl(def.image), resolveUrl(def.data));
  for (const [key, def] of Object.entries(audio)) scene.load.audio(key, resolveUrl(def.file));
  for (const [name, url] of Object.entries(DB.tilesetImages)) scene.load.image(`tileset:${name}`, url);
  scene.load.on('loaderror', (file) => console.warn(`[assets] could not load "${file.key}" from ${file.url} - using a placeholder`));
}

export function finalizeAssets(scene) {
  const { sprites = {}, images = {} } = DB.assets;
  for (const key of Object.keys(sprites)) {
    const def = spriteDef(key);
    if (!scene.textures.exists(key)) makeCharacterPlaceholder(scene, key, def);
    buildAnimations(scene, key, def);
  }
  for (const [key, def] of Object.entries(images)) {
    if (!scene.textures.exists(key)) makeImagePlaceholder(scene, key, def.placeholder || {});
  }
  for (const name of Object.keys(DB.tilesetImages)) {
    if (!scene.textures.exists(`tileset:${name}`)) throw new Error(`Tileset image for "${name}" failed to load.`);
  }
  makeLightTexture(scene);
  // A 1x1 white pixel, handy for effects.
  if (!scene.textures.exists('pixel')) {
    const t = scene.textures.createCanvas('pixel', 1, 1);
    t.getContext().fillStyle = '#fff';
    t.getContext().fillRect(0, 0, 1, 1);
    t.refresh();
  }
}

function buildAnimations(scene, key, def) {
  const dirs = def.directions || ['down'];
  const tex = scene.textures.get(key);
  const cols = Math.floor(tex.getSourceImage().width / def.frameWidth);
  const total = cols * Math.floor(tex.getSourceImage().height / def.frameHeight);
  const mirrorLeft = !dirs.includes('left') && dirs.includes('right');
  SpriteInfo[key] = {
    frameWidth: def.frameWidth,
    frameHeight: def.frameHeight,
    directions: dirs,
    animations: def.animations,
    mirrorLeft,
    body: def.body || null,
  };
  dirs.forEach((dir, row) => {
    for (const [anim, a] of Object.entries(def.animations)) {
      const frames = [];
      for (let i = 0; i < (a.frames || 1); i++) {
        const idx = row * cols + (a.column || 0) + i;
        if (idx < total) frames.push({ key, frame: idx });
      }
      if (!frames.length) {
        console.warn(`[assets] ${key}: animation "${anim}" (${dir}) is outside the sheet - check assets.json`);
        frames.push({ key, frame: 0 });
      }
      const animKey = `${key}:${anim}:${dir}`;
      if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
      scene.anims.create({ key: animKey, frames, frameRate: a.fps || 8, repeat: a.repeat ?? -1 });
    }
  });
}

/** Play `anim` facing `dir` on a sprite, handling mirrored-left sheets. */
export function playAnim(sprite, key, anim, dir, ignoreIfPlaying = true) {
  const info = SpriteInfo[key];
  if (!info) return;
  let d = dir;
  let flip = false;
  if (!info.directions.includes(d)) {
    if (d === 'left' && info.mirrorLeft) {
      d = 'right';
      flip = true;
    } else d = info.directions[0];
  }
  const a = info.animations[anim] ? anim : 'idle';
  sprite.setFlipX(flip);
  sprite.anims.play(`${key}:${a}:${d}`, ignoreIfPlaying);
}

// ---------------------------------------------------------------------------- placeholders

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function makeCharacterPlaceholder(scene, key, def) {
  const fw = def.frameWidth;
  const fh = def.frameHeight;
  const dirs = def.directions || ['down'];
  const anims = Object.entries(def.animations);
  const cols = Math.max(1, ...anims.map(([, a]) => (a.column || 0) + (a.frames || 1)));
  const tex = scene.textures.createCanvas(key, cols * fw, dirs.length * fh);
  const ctx = tex.getContext();
  const ph = def.placeholder || {};
  dirs.forEach((dir, row) => {
    for (let col = 0; col < cols; col++) {
      // Which animation (and which frame of it) owns this column?
      let pose = 'idle';
      let f = 0;
      for (const [name, a] of anims) {
        const c0 = a.column || 0;
        if (col >= c0 && col < c0 + (a.frames || 1)) {
          pose = name;
          f = col - c0;
        }
      }
      ctx.save();
      ctx.translate(col * fw, row * fh);
      ctx.scale(fw / 16, fh / 16);
      drawCharacter(ctx, ph, dir, pose, f);
      ctx.restore();
    }
  });
  tex.refresh();
  let i = 0;
  for (let row = 0; row < dirs.length; row++) for (let col = 0; col < cols; col++) tex.add(i++, 0, col * fw, row * fh, fw, fh);
}

/** Draws one 16x16 placeholder frame (scaled for bigger sprites). */
function drawCharacter(ctx, ph, dir, pose, f) {
  const color = ph.color || '#c0c0c0';
  const accent = ph.accent || '#ffffff';
  const R = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const bob = pose === 'walk' ? f % 2 : 0;
  const dx = { left: -1, right: 1 }[dir] || 0;
  const dy = { up: -1, down: 1 }[dir] || 0;
  const shape = ph.shape || 'humanoid';
  const dark = shade(color, -0.35);
  if (shape === 'humanoid') {
    // feet
    const step = pose === 'walk' ? (f % 2 === 0 ? 1 : -1) : 0;
    R(5, 14, 2, 2, dark);
    R(9, 14, 2, 2, dark);
    if (step) R(step > 0 ? 5 : 9, 15, 2, 1, '#202020');
    // body
    R(4, 7 + bob, 8, 7, dark);
    R(5, 7 + bob, 6, 6, color);
    // head
    R(4, 1 + bob, 8, 7, '#202020');
    R(5, 2 + bob, 6, 5, accent);
    R(5, 1 + bob, 6, 2, color); // hair / hood
    if (dir === 'up') R(5, 2 + bob, 6, 4, color);
    else if (dir === 'down') {
      R(6, 4 + bob, 1, 1, '#202020');
      R(9, 4 + bob, 1, 1, '#202020');
    } else {
      R(dir === 'left' ? 5 : 10, 4 + bob, 1, 1, '#202020');
      R(dir === 'left' ? 9 : 5, 2 + bob, 2, 4, color);
    }
    if (pose === 'attack') {
      // arm thrust toward facing
      R(7 + dx * 5, 9 + dy * 4, 2, 2, accent);
    }
  } else if (shape === 'blob') {
    const squash = pose === 'walk' ? f % 2 : 0;
    R(2, 7 + squash, 12, 9 - squash, dark);
    R(3, 6 + squash, 10, 9 - squash, color);
    R(4, 7 + squash, 3, 2, shade(color, 0.25));
    if (dir !== 'up') {
      const ex = dir === 'left' ? 4 : dir === 'right' ? 8 : 5;
      R(ex, 10, 1, 2, accent);
      R(ex + 4 - (dx ? 1 : 0), 10, 1, 2, accent);
    }
  } else if (shape === 'bat') {
    const up = pose === 'walk' ? f % 2 === 0 : true;
    R(6, 6, 4, 5, color);
    if (up) {
      R(1, 3, 5, 3, dark);
      R(10, 3, 5, 3, dark);
    } else {
      R(1, 8, 5, 3, dark);
      R(10, 8, 5, 3, dark);
    }
    if (dir !== 'up') {
      R(6 + (dx > 0 ? 1 : 0), 7, 1, 1, accent);
      R(9 - (dx < 0 ? 1 : 0), 7, 1, 1, accent);
    }
  } else if (shape === 'wisp') {
    const bobW = pose === 'walk' ? f % 2 : 0;
    R(3, 3 + bobW, 10, 10, shade(color, -0.2));
    R(4, 2 + bobW, 8, 12, color);
    R(2, 4 + bobW, 12, 8, color);
    R(5, 4 + bobW, 4, 3, accent);
    if (dir !== 'up') {
      R(6 + dx, 8 + bobW, 1, 2, '#202020');
      R(9 + dx, 8 + bobW, 1, 2, '#202020');
    }
  } else if (shape === 'spider') {
    const leg = pose === 'walk' ? f % 2 : 0;
    for (let i = 0; i < 4; i++) {
      R(1 + leg, 7 + i * 2, 3, 1, '#201818');
      R(12 - leg, 7 + i * 2, 3, 1, '#201818');
    }
    R(4, 6, 8, 8, '#201818');
    R(5, 7, 6, 6, color);
    R(5, 8, 6, 1, shade(color, 0.2));
    if (dir !== 'up') {
      R(6 + dx, 10 + Math.max(0, dy), 1, 1, accent);
      R(9 + dx, 10 + Math.max(0, dy), 1, 1, accent);
    }
  } else if (shape === 'robed') {
    R(3, 5 + bob, 10, 11 - bob, '#202020');
    R(4, 6 + bob, 8, 10 - bob, color);
    R(3, 14, 10, 2, dark);
    R(4, 1 + bob, 8, 6, '#202020');
    R(5, 1 + bob, 6, 6, color); // hood
    if (dir !== 'up') {
      R(6 + dx, 4 + bob, 4, 2, '#100818');
      R(6 + dx, 4 + bob, 1, 1, accent);
      R(9 + dx, 4 + bob, 1, 1, accent);
    }
    R(7, 8 + bob, 2, 6, accent); // sash
    if (pose === 'attack') {
      R(0, 6, 3, 3, accent);
      R(13, 6, 3, 3, accent);
    }
  } else if (shape === 'wyrm') {
    const sway = pose === 'walk' ? (f % 2 ? 1 : -1) : 0;
    R(2 + sway, 9, 12, 6, dark); // coiled tail
    R(3 + sway, 10, 10, 4, color);
    R(4, 3 + bob, 8, 8, '#202020');
    R(5, 3 + bob, 6, 7, color); // neck / head
    R(3, 1 + bob, 2, 3, accent); // horns
    R(11, 1 + bob, 2, 3, accent);
    if (dir !== 'up') {
      R(6 + dx, 5 + bob, 1, 1, '#f84848');
      R(9 + dx, 5 + bob, 1, 1, '#f84848');
      R(6 + dx, 8 + bob, 4, 1, accent); // frosty breath line
    }
    if (pose === 'attack') R(5 + dx * 3, 10, 6, 2, accent);
  } else if (shape === 'golem') {
    R(1, 4 + bob, 14, 12 - bob, '#202020');
    R(2, 4 + bob, 12, 11 - bob, color);
    R(2, 4 + bob, 12, 2, shade(color, 0.2));
    R(0, 7 + bob, 2, 6, dark); // arms
    R(14, 7 + bob, 2, 6, dark);
    if (dir !== 'up') {
      R(7 + dx * 2, 9 + bob, 2, 2, accent); // glowing core
      R(4 + dx, 6 + bob, 2, 1, accent);
      R(10 + dx, 6 + bob, 2, 1, accent);
    }
    if (pose === 'attack') {
      R(0, 3, 3, 3, accent);
      R(13, 3, 3, 3, accent);
    }
  }
  if (pose === 'hurt') {
    ctx.globalCompositeOperation = 'source-atop';
    R(0, 0, 16, 16, 'rgba(255,255,255,0.6)');
    ctx.globalCompositeOperation = 'source-over';
  }
}

function makeImagePlaceholder(scene, key, ph) {
  const [w, h] = ph.size || [8, 8];
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const color = ph.color || '#ff00ff';
  const accent = ph.accent || shade(color, 0.3);
  const dark = shade(color, -0.35);
  const R = (x, y, ww, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, ww, hh);
  };
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  switch (ph.shape) {
    case 'circle':
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
          if (d <= 1) R(x, y, 1, 1, d < 0.5 ? accent : color);
        }
      break;
    case 'diamond':
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = Math.abs(x - cx) / (w / 2) + Math.abs(y - cy) / (h / 2);
          if (d <= 1) R(x, y, 1, 1, d < 0.5 ? accent : color);
        }
      break;
    case 'heart':
      ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'].forEach((row, y) =>
        [...row].forEach((c, x) => c === '#' && R(x, y + 1, 1, 1, color)),
      );
      R(1, 2, 1, 1, '#ffffff');
      break;
    case 'chest':
    case 'chest_open':
      R(1, 4, 14, 11, '#202020');
      R(2, 5, 12, 9, color);
      R(2, 9, 12, 1, dark);
      if (ph.shape === 'chest') {
        R(2, 5, 12, 4, shade(color, 0.12));
        R(7, 8, 2, 3, accent);
      } else {
        R(2, 5, 12, 3, '#201010');
        R(2, 2, 12, 3, shade(color, 0.12));
      }
      break;
    case 'sign':
      R(7, 9, 2, 6, dark);
      R(1, 2, 14, 8, '#202020');
      R(2, 3, 12, 6, accent);
      R(4, 5, 8, 1, dark);
      R(4, 7, 6, 1, dark);
      break;
    case 'bars':
      R(0, 0, w, h, shade(color, -0.5));
      for (let x = 1; x < w; x += 4) R(x, 0, 2, h, color);
      R(0, 2, w, 2, accent);
      R(0, h - 4, w, 2, accent);
      break;
    case 'shadow':
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) if (Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) <= 1) R(x, y, 1, 1, 'rgba(0,0,0,0.35)');
      break;
    case 'pot':
      R(4, 3, 8, 2, '#202020');
      R(2, 5, 12, 10, '#202020');
      R(3, 6, 10, 8, color);
      R(5, 3, 6, 2, accent);
      R(4, 7, 3, 2, accent);
      R(3, 12, 10, 2, dark);
      break;
    case 'switch':
    case 'switch_down':
      R(2, 2, 12, 12, '#303040');
      R(3, 3, 10, 10, color);
      if (ph.shape === 'switch') {
        R(5, 4, 6, 6, '#202020');
        R(5, 4, 6, 5, accent);
      } else R(5, 7, 6, 3, accent);
      break;
    case 'crystal':
      R(5, 12, 6, 3, '#404050');
      for (let yy = 1; yy < 12; yy++) {
        const half = yy < 6 ? yy * 0.8 : (12 - yy) * 0.8;
        R(Math.round(8 - half), yy, Math.max(1, Math.round(half * 2)), 1, yy % 3 ? color : accent);
      }
      R(7, 3, 1, 4, '#ffffff');
      break;
    case 'torch':
    case 'torch_lit':
      R(6, 8, 4, 7, '#202020');
      R(7, 8, 2, 7, color);
      R(4, 6, 8, 3, accent === '#303038' ? dark : '#404048');
      if (ph.shape === 'torch_lit') {
        R(5, 1, 6, 5, accent);
        R(6, 0, 4, 3, '#f8e060');
        R(7, 2, 2, 3, '#ffffff');
      }
      break;
    case 'door':
      R(0, 0, 16, 16, '#202020');
      R(1, 1, 14, 15, color);
      R(1, 5, 14, 1, dark);
      R(1, 10, 14, 1, dark);
      R(6, 6, 4, 5, accent);
      R(7, 8, 2, 2, '#202020');
      break;
    case 'block':
      R(0, 0, 16, 16, '#202028');
      R(1, 1, 14, 14, color);
      R(1, 1, 14, 2, accent);
      R(1, 1, 2, 14, accent);
      R(4, 5, 8, 6, dark);
      break;
    case 'key':
      R(0, 1, 4, 4, color);
      R(1, 2, 2, 2, '#202020');
      R(4, 2, 4, 2, color);
      R(6, 4, 1, 2, color);
      break;
    case 'bomb':
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = Math.hypot((x - cx) / (w / 2), (y - cy - 1) / (h / 2 - 1));
          if (d <= 1 && y > 1) R(x, y, 1, 1, d < 0.45 ? shade(color, 0.25) : color);
        }
      R(Math.round(cx), 0, 1, 2, '#c0a070');
      R(Math.round(cx) + 1, 0, 1, 1, accent);
      R(2, 4, 2, 1, '#ffffff');
      break;
    case 'crack':
      R(0, 0, w, h, color);
      R(0, 0, w, 1, shade(color, -0.2));
      for (const [x, y] of [[7, 1], [6, 3], [8, 5], [7, 7], [5, 9], [9, 10], [7, 12], [8, 14], [4, 8], [11, 6]]) R(x, y, 2, 2, accent);
      break;
    case 'post':
      R(5, 4, 6, 12, '#202020');
      R(6, 5, 4, 11, color);
      R(3, 1, 10, 5, '#202020');
      R(4, 2, 8, 3, accent);
      R(7, 0, 2, 2, accent);
      break;
    case 'icon':
      R(0, 0, w, h, '#202020');
      R(1, 1, w - 2, h - 2, color);
      if (ph.label) drawGlyphs(ctx, ph.label, 1, 2, '#101010');
      break;
    default:
      R(0, 0, w, h, color);
  }
  tex.refresh();
}
