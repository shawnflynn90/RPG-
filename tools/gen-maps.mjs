// Generates the milestone's starter maps as plain Tiled JSON (.tmj) files in public/maps/.
// After that they're ordinary Tiled maps: open and edit them in Tiled. This script will NOT overwrite
// an existing map unless you pass --force (which would throw away your Tiled edits!).
//
//   node tools/gen-maps.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const force = process.argv.includes('--force');
const T = 16;

// Tile ids in the placeholder tileset (see tools/gen-placeholder-art.mjs). gid = id + 1.
const t = {
  grass: 0, flowers: 1, dirt: 2, water: 3, tree: 4, houseWall: 5, roof: 6, door: 7,
  floor: 8, floorCracked: 9, wall: 10, wallTop: 11, stairsDown: 12, fence: 13, wood: 14,
  carpet: 15, counter: 16, bossFloor: 17, pillar: 18, plaza: 19, bush: 20, void: 21,
  treeTop: 22, stairsUp: 23,
};

class MapBuilder {
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

function save(name, builder) {
  const path = `public/maps/${name}.tmj`;
  if (existsSync(path) && !force) {
    console.log(`skip  ${path} (exists; use --force to overwrite)`);
    return;
  }
  mkdirSync('public/maps', { recursive: true });
  writeFileSync(path, JSON.stringify(builder.toTiled()));
  console.log(`wrote ${path}`);
}

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/** A dungeon room: wall ring, floor inside, with openings. */
function dungeonRoom(w, h, { floor = t.floor } = {}) {
  const m = new MapBuilder(w, h);
  m.fill('ground', 0, 0, w, h, floor);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rand() < 0.08) m.set('ground', x, y, t.floorCracked);
  m.fill('walls', 0, 0, w, 1, t.wallTop);
  m.fill('walls', 0, 1, w, 1, t.wall);
  m.fill('walls', 0, h - 1, w, 1, t.wallTop);
  m.fill('walls', 0, 0, 1, h, t.wallTop);
  m.fill('walls', w - 1, 0, 1, h, t.wallTop);
  return m;
}
const openTop = (m, x, w = 2) => m.fill('walls', x, 0, w, 2, null);
const openBottom = (m, x, w = 2) => m.fill('walls', x, m.height - 1, w, 1, null);
const openLeft = (m, y, h = 2) => m.fill('walls', 0, y, 1, h, null);
const openRight = (m, y, h = 2) => m.fill('walls', m.width - 1, y, 1, h, null);

// ---------------------------------------------------------------------------------- Town 1
{
  const W = 30;
  const H = 20;
  const m = new MapBuilder(W, H);
  m.fill('ground', 0, 0, W, H, t.grass);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < 0.07) m.set('ground', x, y, t.flowers);
  // border of trees (trunks block, canopies of the row below drawn above the player)
  for (let x = 0; x < W; x++) {
    m.set('walls', x, 0, t.tree);
    m.set('walls', x, H - 1, t.tree);
  }
  for (let y = 0; y < H; y++) {
    m.set('walls', 0, y, t.tree);
    m.set('walls', W - 1, y, t.tree);
  }
  // paths + plaza
  m.fill('ground', 1, 10, W - 2, 1, t.dirt);
  m.fill('ground', 14, 4, 1, 15, t.dirt);
  m.fill('ground', 11, 8, 7, 5, t.plaza);
  m.fill('ground', 15, 4, 9, 1, t.dirt);
  m.fill('ground', 24, 4, 1, 1, t.dirt);

  // Healer's house (left)
  m.fill('walls', 3, 3, 5, 2, t.roof);
  m.fill('walls', 3, 5, 5, 2, t.houseWall);
  m.set('walls', 5, 6, null);
  m.set('ground', 5, 6, t.door);
  m.fill('ground', 5, 7, 1, 3, t.dirt);

  // Market stall (top middle-right)
  m.fill('walls', 18, 1, 4, 1, t.roof);
  m.fill('ground', 18, 2, 4, 1, t.wood);
  m.fill('walls', 18, 3, 4, 1, t.counter);

  // Spell teacher's house (bottom right)
  m.fill('walls', 20, 12, 6, 2, t.roof);
  m.fill('walls', 20, 14, 6, 2, t.houseWall);
  m.set('walls', 23, 15, null);
  m.set('ground', 23, 15, t.door);
  m.fill('ground', 23, 16, 1, 1, t.dirt);
  m.fill('ground', 15, 16, 9, 1, t.dirt);

  // Pond with fence (bottom left)
  m.fill('ground', 3, 13, 6, 4, t.water);
  m.fill('walls', 2, 12, 8, 1, t.fence);
  m.fill('walls', 2, 17, 8, 1, t.fence);

  // Bushes and a tree clump with canopy above the player
  for (const [x, y] of [[9, 3], [10, 3], [26, 8], [27, 8], [11, 15], [12, 17], [2, 9]]) m.set('walls', x, y, t.bush);
  m.set('walls', 9, 13, t.tree);
  m.set('above', 9, 12, t.treeTop);

  // Dungeon entrance: a stone outcrop with stairs (top right)
  m.fill('walls', 23, 1, 5, 3, t.wall);
  m.fill('walls', 23, 1, 5, 1, t.wallTop);
  m.set('walls', 25, 3, null);
  m.set('ground', 25, 3, t.stairsDown);
  m.fill('ground', 25, 4, 1, 6, t.dirt);

  m.point('spawn', 'start', 14, 13);
  m.point('spawn', 'from_dungeon', 25, 5, { facing: 'down' });
  m.area('warp', 'to_dungeon', 25, 3, 1, 1, { map: 'dungeon1_1', spawn: 'entrance' });

  m.point('npc', 'Elder', 13, 9, { sprite: 'npc_elder', dialogue: 'elder', facing: 'down' });
  m.point('npc', 'Kid', 17, 12, { sprite: 'npc_kid', dialogue: 'kid', wander: true });
  m.point('shop', 'Merchant', 19, 2, { sprite: 'npc_merchant', shop: 'town1_shop', facing: 'down' });
  m.point('teacher', 'Mage', 22, 16, { sprite: 'npc_mage', teacher: 'town1_teacher', facing: 'down' });
  m.point('healer', 'Healer', 4, 7, { sprite: 'npc_healer', dialogue: 'healer', facing: 'down' });
  m.point('sign', 'Sign', 24, 5, { text: 'DUNGEON 1\nMonsters inside. Turn back if you value your life!' });
  m.point('sign', 'Sign', 15, 9, { text: 'TOWN 1\nNorth-east: Dungeon 1\nWest: Healer   East: Market' });
  m.point('chest', 'Chest', 28, 18, { gold: 15 });
  save('town1', m);
}

// ---------------------------------------------------------------------------------- Dungeon 1, room 1
{
  const m = dungeonRoom(18, 12);
  openBottom(m, 8);
  openTop(m, 8);
  m.set('ground', 8, 11, t.stairsUp);
  m.set('ground', 9, 11, t.stairsUp);
  for (const [x, y] of [[4, 4], [13, 4], [4, 8], [13, 8]]) m.set('walls', x, y, t.pillar);
  m.area('warp', 'to_town', 8, 11, 2, 1, { map: 'town1', spawn: 'from_dungeon' });
  m.area('warp', 'to_room2', 8, 0, 2, 1, { map: 'dungeon1_2', spawn: 'south' });
  m.point('spawn', 'entrance', 8.5, 9, { facing: 'up' });
  m.point('spawn', 'north', 8.5, 2, { facing: 'down' });
  m.point('enemy', 'Slime', 5, 6, { enemy: 'slime' });
  m.point('enemy', 'Slime', 12, 6, { enemy: 'slime' });
  m.point('enemy', 'Slime', 9, 4, { enemy: 'slime' });
  save('dungeon1_1', m);
}

// ---------------------------------------------------------------------------------- Dungeon 1, room 2
{
  const m = dungeonRoom(22, 14);
  openBottom(m, 10);
  openRight(m, 6);
  // a little inner wall to fight around
  m.fill('walls', 6, 5, 10, 1, t.wall);
  m.fill('walls', 6, 4, 10, 1, t.wallTop);
  m.set('walls', 11, 9, t.pillar);
  m.area('warp', 'to_room1', 10, 13, 2, 1, { map: 'dungeon1_1', spawn: 'north' });
  m.area('warp', 'to_room3', 21, 6, 1, 2, { map: 'dungeon1_3', spawn: 'west' });
  m.point('spawn', 'south', 10.5, 11, { facing: 'up' });
  m.point('spawn', 'east', 19, 6.5, { facing: 'left' });
  m.point('enemy', 'Archer', 4, 3, { enemy: 'archer' });
  m.point('enemy', 'Archer', 17, 3, { enemy: 'archer' });
  m.point('enemy', 'Slime', 6, 9, { enemy: 'slime' });
  m.point('chest', 'Chest', 10.5, 2.5, { weapon: 'bow' });
  save('dungeon1_2', m);
}

// ---------------------------------------------------------------------------------- Dungeon 1, room 3
{
  const m = dungeonRoom(16, 16);
  openLeft(m, 6);
  openTop(m, 7);
  m.fill('ground', 5, 9, 6, 3, t.water);
  m.fill('walls', 5, 9, 6, 3, null);
  m.area('warp', 'to_room2', 0, 6, 1, 2, { map: 'dungeon1_2', spawn: 'east' });
  m.area('warp', 'to_boss', 7, 0, 2, 1, { map: 'dungeon1_boss', spawn: 'south' });
  m.point('spawn', 'west', 2, 6.5, { facing: 'right' });
  m.point('spawn', 'north', 7.5, 2.5, { facing: 'down' });
  m.point('enemy', 'Bat', 11, 4, { enemy: 'bat' });
  m.point('enemy', 'Bat', 4, 13, { enemy: 'bat' });
  m.point('enemy', 'Archer', 12, 13, { enemy: 'archer' });
  m.point('enemy', 'Slime', 9, 6, { enemy: 'slime' });
  m.point('chest', 'Chest', 2.5, 13.5, { item: 'potion', count: 2 });
  m.point('chest', 'Chest', 13.5, 3, { gold: 40 });
  m.point('sign', 'Sign', 9.5, 2.5, { text: 'A chill runs down your spine. Something big waits beyond.' });
  save('dungeon1_3', m);
}

// ---------------------------------------------------------------------------------- Dungeon 1, boss room
{
  const m = dungeonRoom(18, 15, { floor: t.bossFloor });
  openBottom(m, 8);
  openTop(m, 8);
  for (const [x, y] of [[3, 4], [14, 4], [3, 10], [14, 10]]) m.set('walls', x, y, t.pillar);
  m.area('warp', 'to_room3', 8, 14, 2, 1, { map: 'dungeon1_3', spawn: 'north' });
  m.area('warp', 'to_town2', 8, 0, 2, 1, { map: 'town2', spawn: 'south' });
  m.point('spawn', 'south', 8.5, 12, { facing: 'up' });
  m.point('spawn', 'north', 8.5, 2.5, { facing: 'down' });
  // Gate that shuts behind you while the boss is alive.
  m.area('gate', 'BossDoor', 8, 13, 2, 1, { mode: 'boss' });
  // Gate that opens once the boss is beaten.
  m.area('gate', 'NorthGate', 8, 1, 2, 1, { flag: 'dungeon1_cleared', text: 'The gate is sealed by a strange force.' });
  m.point('boss', 'Warden', 8.5, 6, { boss: 'warden' });
  save('dungeon1_boss', m);
}

// ---------------------------------------------------------------------------------- Town 2 (stub)
{
  const W = 18;
  const H = 12;
  const m = new MapBuilder(W, H);
  m.fill('ground', 0, 0, W, H, t.grass);
  for (let x = 0; x < W; x++) {
    m.set('walls', x, 0, t.tree);
    m.set('walls', x, H - 1, t.tree);
  }
  for (let y = 0; y < H; y++) {
    m.set('walls', 0, y, t.tree);
    m.set('walls', W - 1, y, t.tree);
  }
  m.set('walls', 8, H - 1, null);
  m.set('walls', 9, H - 1, null);
  m.fill('ground', 8, 3, 2, 9, t.dirt);
  m.fill('ground', 5, 3, 8, 3, t.plaza);
  m.fill('walls', 2, 2, 3, 2, t.roof);
  m.fill('walls', 2, 4, 3, 1, t.houseWall);
  m.fill('walls', 13, 2, 3, 2, t.roof);
  m.fill('walls', 13, 4, 3, 1, t.houseWall);
  m.area('warp', 'to_boss', 8, 11, 2, 1, { map: 'dungeon1_boss', spawn: 'north' });
  m.point('spawn', 'south', 8.5, 9, { facing: 'up' });
  m.point('npc', 'Guard', 10, 7, { sprite: 'npc_guard', dialogue: 'town2_greeter', facing: 'down' });
  m.point('sign', 'Sign', 7, 7, { text: 'TOWN 2\n(Under construction - next milestone!)' });
  save('town2', m);
}
