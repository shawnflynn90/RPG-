// Generates the placeholder tileset (PNG + Tiled .tsj) and the PWA icons.
//   npm run placeholders            (skips files that already exist)
//   npm run placeholders -- --force (overwrites them)
// You only need this if you deleted the placeholder files. Your own art never gets overwritten
// unless you pass --force.
import { existsSync, writeFileSync } from 'node:fs';
import { Bitmap, hex } from './png.mjs';

const force = process.argv.includes('--force');
const T = 16;
const COLS = 8;

// Deterministic "noise" so the output is identical on every run.
let seed = 1234;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function speckle(bmp, ox, oy, color, count) {
  for (let i = 0; i < count; i++) bmp.set(ox + Math.floor(rand() * T), oy + Math.floor(rand() * T), color);
}

function border(bmp, ox, oy, color) {
  bmp.rect(ox, oy, T, 1, color);
  bmp.rect(ox, oy + T - 1, T, 1, color);
  bmp.rect(ox, oy, 1, T, color);
  bmp.rect(ox + T - 1, oy, 1, T, color);
}

// Every tile: [name, collides, draw(bmp, ox, oy)]. The index in this list is the tile id in Tiled.
const TILES = [
  ['grass', false, (b, x, y) => { b.rect(x, y, T, T, hex('#58a848')); speckle(b, x, y, hex('#78c858'), 14); }],
  ['grass_flowers', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#58a848'));
    speckle(b, x, y, hex('#78c858'), 8);
    for (const [fx, fy, c] of [[3, 4, '#f8e858'], [10, 3, '#f878a8'], [6, 11, '#f8f8f8'], [12, 12, '#f8e858']]) {
      b.set(x + fx, y + fy, hex(c));
      b.set(x + fx + 1, y + fy, hex(c));
    }
  }],
  ['dirt', false, (b, x, y) => { b.rect(x, y, T, T, hex('#c8a060')); speckle(b, x, y, hex('#a88048'), 12); }],
  ['water', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#3870d0'));
    for (const r of [3, 9, 13]) b.rect(x + (r % 5), y + r, 5, 1, hex('#78a8f0'));
  }],
  ['tree', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#58a848'));
    b.rect(x + 6, y + 10, 4, 6, hex('#805028'));
    b.rect(x + 2, y + 1, 12, 10, hex('#287830'));
    speckle(b, x + 2, y + 1, hex('#389840'), 0);
    b.rect(x + 4, y + 2, 4, 3, hex('#40a048'));
  }],
  ['house_wall', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#e8d8b0'));
    for (let r = 3; r < T; r += 4) b.rect(x, y + r, T, 1, hex('#c0a880'));
  }],
  ['roof', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#c04838'));
    for (let r = 1; r < T; r += 3) b.rect(x, y + r, T, 1, hex('#a03028'));
  }],
  ['door', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#e8d8b0'));
    b.rect(x + 3, y + 2, 10, 14, hex('#704020'));
    b.set(x + 10, y + 9, hex('#f8d848'));
  }],
  ['dungeon_floor', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#585068'));
    border(b, x, y, hex('#4a4258'));
  }],
  ['dungeon_floor_cracked', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#585068'));
    border(b, x, y, hex('#4a4258'));
    for (let i = 0; i < 6; i++) b.set(x + 4 + i, y + 5 + (i % 3), hex('#383048'));
  }],
  ['dungeon_wall', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#706888'));
    for (const r of [0, 8]) b.rect(x, y + r, T, 1, hex('#504868'));
    b.rect(x + 8, y, 1, 8, hex('#504868'));
    b.rect(x + 3, y + 8, 1, 8, hex('#504868'));
    b.rect(x + 12, y + 8, 1, 8, hex('#504868'));
  }],
  ['dungeon_wall_top', true, (b, x, y) => { b.rect(x, y, T, T, hex('#282038')); speckle(b, x, y, hex('#383050'), 6); }],
  ['stairs_down', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#282038'));
    for (let i = 0; i < 4; i++) b.rect(x + 2, y + 2 + i * 3, 12, 2, hex(['#a098b8', '#888098', '#686078', '#484058'][i]));
  }],
  ['fence', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#58a848'));
    b.rect(x, y + 5, T, 2, hex('#a07040'));
    b.rect(x, y + 10, T, 2, hex('#a07040'));
    b.rect(x + 2, y + 3, 2, 11, hex('#805028'));
    b.rect(x + 12, y + 3, 2, 11, hex('#805028'));
  }],
  ['wood_floor', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#b07840'));
    for (let r = 3; r < T; r += 4) b.rect(x, y + r, T, 1, hex('#906030'));
  }],
  ['carpet', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#b03848'));
    border(b, x, y, hex('#e8c050'));
  }],
  ['counter', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#b07840'));
    b.rect(x, y + 2, T, 10, hex('#784820'));
    b.rect(x, y + 2, T, 2, hex('#986030'));
  }],
  ['boss_floor', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#503060'));
    border(b, x, y, hex('#402050'));
    b.set(x + 7, y + 7, hex('#805090'));
    b.set(x + 8, y + 8, hex('#805090'));
  }],
  ['pillar', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#585068'));
    b.rect(x + 3, y + 1, 10, 14, hex('#a098b8'));
    b.rect(x + 3, y + 1, 2, 14, hex('#c8c0d8'));
  }],
  ['plaza', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#b8b0a0'));
    b.rect(x, y + 7, T, 1, hex('#989080'));
    b.rect(x + 7, y, 1, 7, hex('#989080'));
    b.rect(x + 3, y + 8, 1, 8, hex('#989080'));
  }],
  ['bush', true, (b, x, y) => {
    b.rect(x, y, T, T, hex('#58a848'));
    b.rect(x + 2, y + 3, 12, 11, hex('#307830'));
    b.rect(x + 4, y + 4, 4, 3, hex('#48a050'));
  }],
  ['void', true, (b, x, y) => { b.rect(x, y, T, T, hex('#100818')); }],
  ['tree_top', false, (b, x, y) => {
    // Meant for the "above" layer: drawn over the player.
    b.rect(x + 2, y + 4, 12, 12, hex('#287830'));
    b.rect(x + 4, y + 5, 4, 3, hex('#40a048'));
  }],
  ['stairs_up', false, (b, x, y) => {
    b.rect(x, y, T, T, hex('#585068'));
    for (let i = 0; i < 4; i++) b.rect(x + 2, y + 2 + i * 3, 12, 2, hex(['#484058', '#686078', '#888098', '#a098b8'][i]));
  }],
];

function writeIfAllowed(path, write) {
  if (existsSync(path) && !force) {
    console.log(`skip  ${path} (exists; use --force to overwrite)`);
    return;
  }
  write(path);
  console.log(`wrote ${path}`);
}

// --- Tileset ---------------------------------------------------------------------------
const rows = Math.ceil(TILES.length / COLS);
const sheet = new Bitmap(COLS * T, rows * T);
TILES.forEach(([, , draw], i) => draw(sheet, (i % COLS) * T, Math.floor(i / COLS) * T));
writeIfAllowed('public/assets/tilesets/placeholder.png', (p) => sheet.save(p));

const tsj = {
  type: 'tileset',
  version: '1.10',
  tiledversion: '1.10.2',
  name: 'placeholder',
  image: 'placeholder.png',
  imagewidth: COLS * T,
  imageheight: rows * T,
  tilewidth: T,
  tileheight: T,
  columns: COLS,
  tilecount: COLS * rows,
  margin: 0,
  spacing: 0,
  tiles: TILES.map(([name, collides], id) => ({
    id,
    properties: [
      { name: 'collides', type: 'bool', value: collides },
      { name: 'label', type: 'string', value: name },
    ],
  })),
};
writeIfAllowed('public/assets/tilesets/placeholder.tsj', (p) => writeFileSync(p, JSON.stringify(tsj, null, 1)));

// --- PWA icons -------------------------------------------------------------------------
function icon(size, path) {
  const b = new Bitmap(size, size);
  const u = size / 16;
  const R = (x, y, w, h, c) => b.rect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u), hex(c));
  R(0, 0, 16, 16, '#2a2238');
  R(2, 3, 12, 8, '#8bac0f');
  R(3, 4, 10, 6, '#9bbc0f');
  R(7, 5, 2, 4, '#306230'); // tiny hero
  R(6, 6, 4, 2, '#306230');
  R(2, 12, 1, 3, '#d8d0e8'); // d-pad
  R(1, 13, 3, 1, '#d8d0e8');
  R(12, 12, 2, 2, '#e04858'); // A
  R(10, 13, 2, 2, '#e04858'); // B
  b.save(path);
}
writeIfAllowed('public/icons/icon-192.png', (p) => icon(192, p));
writeIfAllowed('public/icons/icon-512.png', (p) => icon(512, p));
writeIfAllowed('public/icons/apple-touch-icon.png', (p) => icon(180, p));
