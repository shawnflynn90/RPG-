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
  inWall: 24, inWallTop: 25, checker: 26, table: 27, bed: 28, shelf: 29, window: 30, mat: 31,
  sand: 32, cactus: 33, stoneFloor: 34, stoneWall: 35, stoneTop: 36, pit: 37, lava: 38,
  barrel: 39, autumnGrass: 40, autumnTree: 41, anvil: 42, fountain: 43,
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

const STONE = { floor: t.stoneFloor, wall: t.stoneWall, top: t.stoneTop, cracked: t.stoneFloor };
const BRICK = { floor: t.floor, wall: t.wall, top: t.wallTop, cracked: t.floorCracked };

/** A dungeon room: wall ring, floor inside, with openings. */
function dungeonRoom(w, h, { style = BRICK, floor } = {}) {
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
const openTop = (m, x, w = 2) => m.fill('walls', x, 0, w, 2, null);
const openBottom = (m, x, w = 2) => m.fill('walls', x, m.height - 1, w, 1, null);
const openLeft = (m, y, h = 2) => m.fill('walls', 0, y, 1, h, null);
const openRight = (m, y, h = 2) => m.fill('walls', m.width - 1, y, 1, h, null);

/** Small indoor room (fits on one screen). The exit is a doormat in the bottom wall at column `door`. */
function interior(w, h, door, { floor = t.wood, windows = [] } = {}) {
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
const exitTo = (m, door, map, spawn) => m.area('warp', 'exit', door, m.height - 1, 1, 1, { map, spawn });

/** Tree border with optional gaps: { top: [x...], bottom: [x...] } */
function townBase(W, H, ground, tree, gaps = {}) {
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
function house(m, x, y, w, doorX) {
  m.fill('walls', x, y, w, 2, t.roof);
  m.fill('walls', x, y + 2, w, 2, t.houseWall);
  m.set('walls', doorX, y + 3, null);
  m.set('ground', doorX, y + 3, t.door);
  return { x: doorX, y: y + 3 };
}

// ====================================================================================== TOWN 1
{
  const W = 30;
  const H = 20;
  const m = townBase(W, H, t.grass, t.tree);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < 0.07) m.set('ground', x, y, t.flowers);
  // paths + plaza
  m.fill('ground', 1, 10, W - 2, 1, t.dirt);
  m.fill('ground', 14, 4, 1, 15, t.dirt);
  m.fill('ground', 11, 8, 7, 5, t.plaza);
  m.fill('ground', 15, 4, 11, 1, t.dirt);

  // Healer's house (left)
  const healer = house(m, 3, 3, 5, 5);
  m.fill('ground', 5, 7, 1, 3, t.dirt);
  m.area('warp', 'to_healer', healer.x, healer.y, 1, 1, { map: 'town1_healer', spawn: 'entrance' });
  m.point('spawn', 'from_healer', 5, 7.5, { facing: 'down' });

  // Shop (top middle-right)
  m.fill('walls', 17, 1, 5, 2, t.roof);
  m.fill('walls', 17, 3, 5, 1, t.houseWall);
  m.set('walls', 19, 3, null);
  m.set('ground', 19, 3, t.door);
  m.area('warp', 'to_shop', 19, 3, 1, 1, { map: 'town1_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 19, 5, { facing: 'down' });
  m.point('sign', 'Sign', 16, 3.5, { text: 'SHOP\\nWeapons, armor and potions.' });

  // Spell teacher's house (bottom right)
  m.fill('walls', 20, 12, 6, 2, t.roof);
  m.fill('walls', 20, 14, 6, 2, t.houseWall);
  m.set('walls', 23, 15, null);
  m.set('ground', 23, 15, t.door);
  m.fill('ground', 15, 16, 9, 1, t.dirt);
  m.area('warp', 'to_magic', 23, 15, 1, 1, { map: 'town1_magic', spawn: 'entrance' });
  m.point('spawn', 'from_magic', 23, 16.6, { facing: 'down' });
  m.point('sign', 'Sign', 26, 16, { text: 'MAGIC SCHOOL\\nSpells taught here.' });

  // Pond with fence (bottom left)
  m.fill('ground', 3, 13, 6, 4, t.water);
  m.fill('walls', 2, 12, 8, 1, t.fence);
  m.fill('walls', 2, 17, 8, 1, t.fence);

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
  m.point('npc', 'Villager', 7, 8, { sprite: 'npc_villager', dialogue: 'villager1', facing: 'down' });
  m.point('sign', 'Sign', 24, 5, { text: 'DUNGEON 1\\nMonsters inside. Turn back if you value your life!' });
  m.point('sign', 'Sign', 15, 9, { text: 'TOWN 1\\nNorth-east: Dungeon 1\\nWest: Healer   North: Shop' });
  m.point('chest', 'Chest', 28, 18, { gold: 15 });
  m.point('pot', 'Pot', 1, 1, {});
  m.point('pot', 'Pot', 2, 1, {});
  save('town1', m);
}

// ---------------------------------------------------------------------------------- Town 1 interiors
{
  const m = interior(10, 8, 5, { windows: [2, 7] });
  exitTo(m, 5, 'town1', 'from_healer');
  m.set('walls', 1, 2, t.bed);
  m.set('walls', 1, 4, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.shelf);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.point('healer', 'Healer', 5, 2.6, { sprite: 'npc_healer', dialogue: 'healer', facing: 'down' });
  save('town1_healer', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [7] });
  exitTo(m, 5, 'town1', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 1, 2, t.barrel);
  m.set('walls', 8, 2, t.shelf);
  m.set('walls', 2, 1, t.shelf);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town1_shop', facing: 'down' });
  m.point('pot', 'Pot', 1, 6, {});
  save('town1_shop', m);
}
{
  const m = interior(10, 8, 5, { windows: [] });
  exitTo(m, 5, 'town1', 'from_magic');
  m.fill('walls', 1, 1, 8, 1, t.shelf);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.set('walls', 1, 4, t.table);
  m.set('walls', 8, 4, t.table);
  m.point('teacher', 'Mage', 4.5, 2.6, { sprite: 'npc_mage', teacher: 'town1_teacher', facing: 'down' });
  save('town1_magic', m);
}

// ====================================================================================== DUNGEON 1
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
  m.point('chest', 'Map', 16, 2, { item: 'dungeon_map', flag: 'map:dungeon1' });
  for (const [x, y] of [[1, 2], [1, 10], [16, 10]]) m.point('pot', 'Pot', x, y, {});
  save('dungeon1_1', m);
}
{
  const m = dungeonRoom(22, 14);
  openBottom(m, 10);
  openRight(m, 6);
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
  for (const [x, y] of [[1, 12], [20, 12], [1, 2]]) m.point('pot', 'Pot', x, y, {});
  save('dungeon1_2', m);
}
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
  m.point('pot', 'Pot', 14, 14, {});
  save('dungeon1_3', m);
}
{
  const m = dungeonRoom(18, 15, { floor: t.bossFloor });
  openBottom(m, 8);
  openTop(m, 8);
  for (const [x, y] of [[3, 4], [14, 4], [3, 10], [14, 10]]) m.set('walls', x, y, t.pillar);
  m.area('warp', 'to_room3', 8, 14, 2, 1, { map: 'dungeon1_3', spawn: 'north' });
  m.area('warp', 'to_town2', 8, 0, 2, 1, { map: 'town2', spawn: 'south' });
  m.point('spawn', 'south', 8.5, 12, { facing: 'up' });
  m.point('spawn', 'north', 8.5, 2.5, { facing: 'down' });
  m.area('gate', 'BossDoor', 8, 13, 2, 1, { mode: 'boss' });
  m.area('gate', 'NorthGate', 8, 1, 2, 1, { flag: 'dungeon1_cleared', text: 'The gate is sealed by a strange force.' });
  m.point('boss', 'Warden', 8.5, 6, { boss: 'warden' });
  save('dungeon1_boss', m);
}

// ====================================================================================== TOWN 2
{
  const W = 26;
  const H = 18;
  const m = townBase(W, H, t.autumnGrass, t.autumnTree, { bottom: [12, 13] });
  m.fill('ground', 12, 4, 2, 14, t.dirt);
  m.fill('ground', 2, 9, 22, 1, t.dirt);
  m.fill('ground', 9, 7, 8, 5, t.plaza);
  m.set('walls', 16, 7, t.fountain);
  // North: the crypt entrance
  m.fill('walls', 10, 1, 6, 3, t.stoneWall);
  m.fill('walls', 10, 1, 6, 1, t.stoneTop);
  m.set('walls', 13, 3, null);
  m.set('ground', 13, 3, t.stairsDown);
  m.area('warp', 'to_crypt', 13, 3, 1, 1, { map: 'dungeon2_1', spawn: 'entrance' });
  m.point('spawn', 'from_dungeon', 13, 5, { facing: 'down' });
  m.point('sign', 'Sign', 15, 4.5, { text: 'THE SHADOW CRYPT\\nBring fire. The dark devours the unprepared.' });
  // South: road back to Dungeon 1
  m.area('warp', 'to_dungeon1', 12, H - 1, 2, 1, { map: 'dungeon1_boss', spawn: 'north' });
  m.point('spawn', 'south', 12.5, 15.5, { facing: 'up' });
  // Inn (healer)
  const inn = house(m, 2, 2, 6, 4);
  m.area('warp', 'to_inn', inn.x, inn.y, 1, 1, { map: 'town2_inn', spawn: 'entrance' });
  m.point('spawn', 'from_inn', 4, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 7, 6.5, { text: 'INN\\nRest and save.' });
  // Shop
  const shop = house(m, 18, 2, 6, 20);
  m.area('warp', 'to_shop', shop.x, shop.y, 1, 1, { map: 'town2_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 20, 6.6, { facing: 'down' });
  // Library (spell teacher)
  const lib = house(m, 2, 11, 6, 5);
  m.area('warp', 'to_library', lib.x, lib.y, 1, 1, { map: 'town2_library', spawn: 'entrance' });
  m.point('spawn', 'from_library', 5, 15.6, { facing: 'down' });
  m.point('sign', 'Sign', 8, 15, { text: 'LIBRARY\\nAdvanced spells.' });
  // Blacksmith (outdoors)
  m.fill('ground', 18, 11, 6, 4, t.plaza);
  m.set('walls', 20, 12, t.anvil);
  m.set('walls', 23, 11, t.barrel);
  m.set('walls', 18, 11, t.barrel);
  m.point('smith', 'Smith', 21, 12, { sprite: 'npc_smith', smith: 'town2_smith', facing: 'down' });
  m.point('sign', 'Sign', 19, 14, { text: 'BLACKSMITH\\nWeapon upgrades.' });
  // Decoration
  for (const [x, y] of [[9, 3], [17, 3], [24, 9], [1, 9]]) m.set('walls', x, y, t.cactus);
  m.set('walls', 1, 9, null);
  // People
  m.point('npc', 'Guard', 14, 5.5, { sprite: 'npc_guard', dialogue: 'town2_guard', facing: 'down' });
  m.point('npc', 'Scholar', 10, 8, { sprite: 'npc_scholar', dialogue: 'scholar', facing: 'down' });
  m.point('npc', 'Villager', 15, 11, { sprite: 'npc_villager', dialogue: 'town2_villager', wander: true });
  m.point('npc', 'Kid', 7, 10, { sprite: 'npc_kid', dialogue: 'town2_kid', wander: true });
  m.point('chest', 'Chest', 24, 16, { item: 'antidote', count: 2 });
  m.point('pot', 'Pot', 1, 16, {});
  m.point('pot', 'Pot', 24, 1, {});
  save('town2', m);
}
{
  const m = interior(10, 8, 4, { windows: [2, 7] });
  exitTo(m, 4, 'town2', 'from_inn');
  m.fill('walls', 6, 2, 1, 1, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.bed);
  m.set('walls', 1, 2, t.table);
  m.point('healer', 'Innkeeper', 3.5, 2.6, { sprite: 'npc_healer', dialogue: 'innkeeper', facing: 'down' });
  m.point('npc', 'Traveler', 7, 5, { sprite: 'npc_villager', dialogue: 'traveler', facing: 'left' });
  save('town2_inn', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [2] });
  exitTo(m, 5, 'town2', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 8, 2, t.barrel);
  m.set('walls', 1, 2, t.shelf);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town2_shop', facing: 'down' });
  save('town2_shop', m);
}
{
  const m = interior(10, 8, 5, { windows: [] });
  exitTo(m, 5, 'town2', 'from_library');
  m.fill('walls', 1, 1, 8, 1, t.shelf);
  m.set('walls', 1, 3, t.shelf);
  m.set('walls', 8, 3, t.shelf);
  m.set('walls', 1, 5, t.table);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.point('teacher', 'Librarian', 4.5, 2.6, { sprite: 'npc_scholar', teacher: 'town2_teacher', facing: 'down' });
  save('town2_library', m);
}

// ====================================================================================== DUNGEON 2: the Shadow Crypt
// Grid:            [boss]
//          [west]-[hub]-[east]
//                 [entrance]
{
  // Entrance: light both torches with fire to open the north gate.
  const m = dungeonRoom(16, 12, { style: STONE });
  openBottom(m, 7);
  openTop(m, 7);
  m.set('ground', 7, 11, t.stairsUp);
  m.set('ground', 8, 11, t.stairsUp);
  m.area('warp', 'to_town', 7, 11, 2, 1, { map: 'town2', spawn: 'from_dungeon' });
  m.area('warp', 'to_hub', 7, 0, 2, 1, { map: 'dungeon2_2', spawn: 'south' });
  m.area('gate', 'TorchGate', 7, 1, 2, 1, { flag: 'd2_torch_a,d2_torch_b', text: 'Two cold torches flank the gate. Maybe fire would help...' });
  m.point('torch', 'Torch', 5, 2, { flag: 'd2_torch_a' });
  m.point('torch', 'Torch', 10, 2, { flag: 'd2_torch_b' });
  m.point('light', 'Light', 7.5, 10, { radius: 40 });
  m.point('spawn', 'entrance', 7.5, 9.5, { facing: 'up' });
  m.point('spawn', 'north', 7.5, 3, { facing: 'down' });
  m.point('enemy', 'Knight', 8, 6, { enemy: 'knight' });
  m.point('enemy', 'Spider', 3, 8, { enemy: 'spider' });
  m.point('enemy', 'Spider', 12, 8, { enemy: 'spider' });
  m.point('chest', 'Map', 13.5, 9.5, { item: 'dungeon_map', flag: 'map:dungeon2' });
  for (const [x, y] of [[1, 2], [14, 2], [1, 10]]) m.point('pot', 'Pot', x, y, {});
  m.point('sign', 'Sign', 3, 2.5, { text: 'Only flame opens the way.' });
  save('dungeon2_1', m);
}
{
  // Hub: locked door east (small key), boss door north (big key).
  const m = dungeonRoom(20, 14, { style: STONE });
  openBottom(m, 9);
  openLeft(m, 6);
  openRight(m, 6);
  openTop(m, 9);
  for (const [x, y] of [[5, 4], [14, 4], [5, 9], [14, 9]]) m.set('walls', x, y, t.pillar);
  m.fill('ground', 8, 5, 4, 4, t.pit);
  m.area('warp', 'to_entrance', 9, 13, 2, 1, { map: 'dungeon2_1', spawn: 'north' });
  m.area('warp', 'to_west', 0, 6, 1, 2, { map: 'dungeon2_3', spawn: 'east' });
  m.area('warp', 'to_east', 19, 6, 1, 2, { map: 'dungeon2_4', spawn: 'west' });
  m.area('warp', 'to_boss', 9, 0, 2, 1, { map: 'dungeon2_boss', spawn: 'south' });
  m.area('door', 'EastDoor', 18, 6, 1, 2, { lock: 'small_key' });
  m.area('door', 'BossDoor', 9, 1, 2, 1, { lock: 'boss_key' });
  m.point('spawn', 'south', 9.5, 11.5, { facing: 'up' });
  m.point('spawn', 'west', 2, 6.5, { facing: 'right' });
  m.point('spawn', 'east', 16.5, 6.5, { facing: 'left' });
  m.point('spawn', 'north', 9.5, 3, { facing: 'down' });
  for (const [x, y] of [[3, 3], [16, 3], [3, 10], [16, 10]]) m.point('light', 'Brazier', x, y, { radius: 30 });
  m.point('enemy', 'Wisp', 4, 7, { enemy: 'wisp' });
  m.point('enemy', 'Wisp', 15, 11, { enemy: 'wisp' });
  m.point('enemy', 'Knight', 12, 11, { enemy: 'knight' });
  m.point('pot', 'Pot', 1, 12, {});
  m.point('pot', 'Pot', 18, 12, {});
  save('dungeon2_2', m);
}
{
  // West: push the block onto the pressure plate to open the alcove with the small key.
  const m = dungeonRoom(16, 12, { style: STONE });
  openRight(m, 5);
  m.area('warp', 'to_hub', 15, 5, 1, 2, { map: 'dungeon2_2', spawn: 'west' });
  m.point('spawn', 'east', 13.5, 5.5, { facing: 'left' });
  // alcove (x1-4, y2-4) walled off, gate at (2,5)
  m.fill('walls', 5, 2, 1, 4, STONE.wall);
  m.fill('walls', 1, 5, 4, 1, STONE.wall);
  m.area('gate', 'PlateGate', 2, 5, 1, 1, { flag: 'd2_plate', text: "It won't budge. Something must hold the plate down." });
  m.set('walls', 2, 5, null);
  m.point('chest', 'Key', 2.5, 3, { item: 'small_key' });
  m.point('switch', 'Plate', 4, 8, { flag: 'd2_plate', mode: 'plate' });
  m.point('block', 'Block', 7, 8, {});
  m.point('torch', 'Torch', 13, 2, { lit: true });
  m.point('light', 'Light', 3, 3, { radius: 22 });
  m.point('enemy', 'Spider', 10, 9, { enemy: 'spider' });
  m.point('enemy', 'Spider', 9, 3, { enemy: 'spider' });
  m.point('sign', 'Sign', 11, 10, { text: 'Heavy things press harder than feet.' });
  for (const [x, y] of [[14, 10], [8, 10]]) m.point('pot', 'Pot', x, y, {});
  save('dungeon2_3', m);
}
{
  // East: a crystal switch flips two gates. The Big Key is behind the top gate.
  const m = dungeonRoom(16, 14, { style: STONE });
  openLeft(m, 6);
  m.area('warp', 'to_hub', 0, 6, 1, 2, { map: 'dungeon2_2', spawn: 'east' });
  m.point('spawn', 'west', 2, 6.5, { facing: 'right' });
  m.fill('walls', 8, 2, 1, 11, STONE.wall);
  m.fill('walls', 9, 7, 6, 1, STONE.wall);
  m.set('walls', 8, 4, null);
  m.set('walls', 8, 10, null);
  m.area('gate', 'GateA', 8, 4, 1, 1, { flag: 'd2_crystal' });
  m.area('gate', 'GateB', 8, 10, 1, 1, { flag: 'd2_crystal', invert: true });
  m.point('switch', 'Crystal', 4, 7, { flag: 'd2_crystal', mode: 'crystal' });
  m.point('chest', 'BigKey', 12, 3, { item: 'boss_key' });
  m.point('switch', 'FloorSwitch', 13, 5, { flag: 'd2_secret', mode: 'floor' });
  m.point('chest', 'Secret', 12, 10, { item: 'ether', count: 2, ifFlag: 'd2_secret' });
  m.point('light', 'Light', 4, 7, { radius: 28 });
  m.point('light', 'Light', 12, 4, { radius: 26 });
  m.point('light', 'Light', 12, 11, { radius: 26 });
  m.point('enemy', 'Knight', 5, 4, { enemy: 'knight' });
  m.point('enemy', 'Wisp', 11, 5, { enemy: 'wisp' });
  m.point('enemy', 'Spider', 12, 12, { enemy: 'spider' });
  m.point('sign', 'Sign', 2.5, 2.5, { text: 'Strike the crystal to change the way.' });
  for (const [x, y] of [[1, 12], [14, 12]]) m.point('pot', 'Pot', x, y, {});
  save('dungeon2_4', m);
}
{
  const m = dungeonRoom(18, 15, { style: STONE, floor: t.bossFloor });
  openBottom(m, 8);
  openTop(m, 8);
  for (const [x, y] of [[3, 4], [14, 4], [3, 10], [14, 10]]) m.set('walls', x, y, t.pillar);
  m.area('warp', 'to_hub', 8, 14, 2, 1, { map: 'dungeon2_2', spawn: 'north' });
  m.area('warp', 'to_town3', 8, 0, 2, 1, { map: 'town3', spawn: 'south' });
  m.point('spawn', 'south', 8.5, 12, { facing: 'up' });
  m.point('spawn', 'north', 8.5, 2.5, { facing: 'down' });
  m.area('gate', 'BossDoor', 8, 13, 2, 1, { mode: 'boss' });
  m.area('gate', 'NorthGate', 8, 1, 2, 1, { flag: 'dungeon2_cleared', text: 'Dark magic seals the way.' });
  for (const [x, y] of [[2, 2], [15, 2], [2, 12], [15, 12]]) m.point('torch', 'Torch', x, y, { lit: true, radius: 56 });
  m.point('boss', 'Sorcerer', 8.5, 6, { boss: 'sorcerer' });
  save('dungeon2_boss', m);
}

// ====================================================================================== TOWN 3 (stub)
{
  const W = 18;
  const H = 12;
  const m = townBase(W, H, t.sand, t.cactus, { bottom: [8, 9] });
  m.fill('ground', 8, 3, 2, 9, t.dirt);
  m.fill('ground', 5, 3, 8, 3, t.plaza);
  house(m, 2, 1, 3, 3);
  house(m, 13, 1, 3, 14);
  m.area('warp', 'to_crypt', 8, 11, 2, 1, { map: 'dungeon2_boss', spawn: 'north' });
  m.point('spawn', 'south', 8.5, 9, { facing: 'up' });
  m.point('npc', 'Guard', 10, 7, { sprite: 'npc_guard', dialogue: 'town3_greeter', facing: 'down' });
  m.point('sign', 'Sign', 7, 7, { text: 'TOWN 3\\n(Under construction - next milestone!)' });
  save('town3', m);
}
