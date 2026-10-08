// Shared helpers for the map generators (tools/gen-maps.mjs, tools/gen-dungeons.mjs):
// a tiny Tiled-JSON writer plus building blocks for rooms, towns and houses.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

export const force = process.argv.includes('--force');
export const T = 16;

// Tile ids in the placeholder tileset (see tools/gen-placeholder-art.mjs). gid = id + 1.
export const t = {
  grass: 0, flowers: 1, dirt: 2, water: 3, tree: 4, houseWall: 5, roof: 6, door: 7,
  floor: 8, floorCracked: 9, wall: 10, wallTop: 11, stairsDown: 12, fence: 13, wood: 14,
  carpet: 15, counter: 16, bossFloor: 17, pillar: 18, plaza: 19, bush: 20, void: 21,
  treeTop: 22, stairsUp: 23,
  inWall: 24, inWallTop: 25, checker: 26, table: 27, bed: 28, shelf: 29, window: 30, mat: 31,
  sand: 32, cactus: 33, stoneFloor: 34, stoneWall: 35, stoneTop: 36, pit: 37, lava: 38,
  barrel: 39, autumnGrass: 40, autumnTree: 41, anvil: 42, fountain: 43,
  ice: 44, snow: 45, iceWall: 46, iceTop: 47, snowTree: 48, frozenWater: 49,
};

export class MapBuilder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = { ground: [], walls: [], above: [] };
    for (const k of Object.keys(this.layers)) this.layers[k] = new Array(width * height).fill(0);
    this.objects = [];
    this.nextId = 1;
  }

  set(layer, x, y, tile) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.layers[layer][y * this.width + x] = tile === null ? 0 : tile + 1;
  }

  fill(layer, x, y, w, h, tile) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(layer, i, j, tile);
  }

  /** Point object at the centre of tile (tx, ty). */
  point(type, name, tx, ty, props = {}) {
    this.objects.push({ type, name, x: tx * T + T / 2, y: ty * T + T / 2, point: true, props });
  }

  /** Rectangle object covering tiles. */
  area(type, name, tx, ty, tw, th, props = {}) {
    this.objects.push({ type, name, x: tx * T, y: ty * T, width: tw * T, height: th * T, props });
  }

  toTiled() {
    const prop = (name, value) => ({
      name,
      type: typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : typeof value === 'boolean' ? 'bool' : 'string',
      value,
    });
    let layerId = 1;
    const tileLayer = (name) => ({
      id: layerId++, name, type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0,
      width: this.width, height: this.height, data: this.layers[name],
    });
    return {
      type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
      width: this.width, height: this.height, tilewidth: T, tileheight: T, infinite: false,
      compressionlevel: -1,
      tilesets: [{ firstgid: 1, source: '../assets/tilesets/placeholder.tsj' }],
      layers: [
        tileLayer('ground'),
        tileLayer('walls'),
        tileLayer('above'),
        {
          id: layerId++, name: 'objects', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0,
          draworder: 'topdown',
          objects: this.objects.map((o) => ({
            id: this.nextId++, name: o.name, type: o.type, x: o.x, y: o.y,
            width: o.width || 0, height: o.height || 0, rotation: 0, visible: true,
            ...(o.point ? { point: true } : {}),
            properties: Object.entries(o.props).map(([k, v]) => prop(k, v)),
          })),
        },
      ],
      nextlayerid: layerId, nextobjectid: this.nextId,
    };
  }
}

export function save(name, builder) {
  const path = `public/maps/${name}.tmj`;
  if (existsSync(path) && !force) {
    console.log(`skip  ${path} (exists; use --force to overwrite)`);
    return;
  }
  mkdirSync('public/maps', { recursive: true });
  writeFileSync(path, JSON.stringify(builder.toTiled()));
  console.log(`wrote ${path}`);
}


/** Small seeded random number generator: rng() -> [0, 1). */
export function makeRng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = makeRng(42);
/** Swap the generator used by dungeonRoom() etc. */
export const setRand = (r) => (rand = r);

export const STONE = { floor: t.stoneFloor, wall: t.stoneWall, top: t.stoneTop, cracked: t.stoneFloor };
export const BRICK = { floor: t.floor, wall: t.wall, top: t.wallTop, cracked: t.floorCracked };
export const ICE = { floor: t.snow, wall: t.iceWall, top: t.iceTop, cracked: t.ice };

/** A dungeon room: wall ring, floor inside, with openings. */
export function dungeonRoom(w, h, { style = BRICK, floor } = {}) {
  const m = new MapBuilder(w, h);
  m.fill('ground', 0, 0, w, h, floor ?? style.floor);
  if (floor === undefined) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rand() < 0.08) m.set('ground', x, y, style.cracked);
  m.style = style;
  m.fill('walls', 0, 0, w, 1, style.top);
  m.fill('walls', 0, 1, w, 1, style.wall);
  m.fill('walls', 0, h - 1, w, 1, style.top);
  m.fill('walls', 0, 0, 1, h, style.top);
  m.fill('walls', w - 1, 0, 1, h, style.top);
  return m;
}
export const openTop = (m, x, w = 2) => m.fill('walls', x, 0, w, 2, null);
export const openBottom = (m, x, w = 2) => m.fill('walls', x, m.height - 1, w, 1, null);
export const openLeft = (m, y, h = 2) => m.fill('walls', 0, y, 1, h, null);
export const openRight = (m, y, h = 2) => m.fill('walls', m.width - 1, y, 1, h, null);

/** Small indoor room (fits on one screen). The exit is a doormat in the bottom wall at column `door`. */
export function interior(w, h, door, { floor = t.wood, windows = [] } = {}) {
  const m = new MapBuilder(w, h);
  m.fill('ground', 0, 0, w, h, floor);
  m.fill('walls', 0, 0, w, 1, t.inWallTop);
  m.fill('walls', 0, 1, w, 1, t.inWall);
  for (const x of windows) m.set('walls', x, 1, t.window);
  m.fill('walls', 0, 0, 1, h, t.inWallTop);
  m.fill('walls', w - 1, 0, 1, h, t.inWallTop);
  m.fill('walls', 0, h - 1, w, 1, t.inWallTop);
  m.set('walls', door, h - 1, null);
  m.set('ground', door, h - 1, t.mat);
  m.point('spawn', 'entrance', door, h - 2, { facing: 'up' });
  return m;
}
export const exitTo = (m, door, map, spawn) => m.area('warp', 'exit', door, m.height - 1, 1, 1, { map, spawn });

/** Tree border with optional gaps: { top: [x...], bottom: [x...] } */
export function townBase(W, H, ground, tree, gaps = {}) {
  const m = new MapBuilder(W, H);
  m.fill('ground', 0, 0, W, H, ground);
  for (let x = 0; x < W; x++) {
    if (!(gaps.top || []).includes(x)) m.set('walls', x, 0, tree);
    if (!(gaps.bottom || []).includes(x)) m.set('walls', x, H - 1, tree);
  }
  for (let y = 0; y < H; y++) {
    m.set('walls', 0, y, tree);
    m.set('walls', W - 1, y, tree);
  }
  return m;
}

/** House with a roof (2 rows) and a front wall (2 rows) with a door. Returns the door position. */
export function house(m, x, y, w, doorX) {
  m.fill('walls', x, y, w, 2, t.roof);
  m.fill('walls', x, y + 2, w, 2, t.houseWall);
  m.set('walls', doorX, y + 3, null);
  m.set('ground', doorX, y + 3, t.door);
  return { x: doorX, y: y + 3 };
}

