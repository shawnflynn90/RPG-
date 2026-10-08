// Generates the four dungeons from the recipes below: every room is a Tiled map in public/maps/,
// and the dungeon's rooms are written into public/data/world.json (name, region, grid, darkness).
//
//   node tools/gen-dungeons.mjs [--force]          (--force overwrites existing dungeon maps)
//
// How a dungeon is put together (all seeded, so the same recipe gives the same dungeon):
//   1. A main path of 7 rooms winds north from the entrance to the boss room. Its doors split it
//      into zones:  entrance zone | small-key door | zone 1 | ITEM BARRIER | zone 2 | small-key door
//      | zone 3 | big-key door | boss.
//   2. Branches (1-2 rooms, ending in a dead end) hang off the main path. Each zone's branches hold
//      what you need to get past the next door: zone 0 has the first key and the map, zone 1 the
//      mini-boss (who drops the dungeon's item, e.g. the Bow) and the compass, zone 2 the second
//      key, zone 3 the Big Key. Other dead ends hold loot, quest items or just monsters.
//      Some loot branches are sealed by an older dungeon's item (come back later!).
//   3. One extra "loop" door joins two neighbouring rooms of the same zone.
//   4. Rooms are filled from the dungeon's style (pillars, pools, ice, lava...), with puzzles for
//      chests: plain, floor switch, or an ambush that seals the doors until every enemy is beaten.
//   5. Checks: every room is tested tile by tile (all doors and objects reachable on foot), and the
//      whole dungeon is "played" (collect keys/items, open doors) to prove the boss is reachable and
//      every room can be visited. A recipe that fails is retried with the next seed.
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { t, T, makeRng, setRand, dungeonRoom, openTop, openBottom, openLeft, openRight, save, force, BRICK, STONE, ICE } from './maplib.mjs';

const SPIRE = { floor: t.sand, wall: t.stoneWall, top: t.stoneTop, cracked: t.dirt };
const HAZARDS = new Set([t.water, t.pit, t.lava, t.frozenWater]);

// What each barrier needs.
const NEEDS = { eye: 'bow', crack: 'bombs', moat: 'hookshot', brazier: 'flame_brand' };

const DUNGEONS = [
  {
    id: 'dungeon1',
    name: 'Mossy Catacombs',
    bossRoomName: "Warden's Lair",
    style: BRICK,
    hazard: t.water,
    decor: ['pillars', 'pool', 'barrels', 'pillars2'],
    seed: 1101,
    music: 'dungeon',
    town: 'town1',
    next: 'town2',
    nextGate: 'A stone seal blocks the road north.',
    intro: 'MOSSY CATACOMBS\nNo one has ever come back out the other side.',
    enemies: [['slime', 3], ['bat', 2], ['archer', 2]],
    miniboss: 'moss_golem',
    barrier: 'eye',
    tools: [],
    boss: 'warden',
    loot: [{ weapon: 'twin_daggers' }, { maxHp: 4 }, { gold: 40 }, { item: 'potion', count: 2 }, { item: 'ether', count: 2 }],
    gatedLoot: [],
    extraItems: [],
    dark: 0,
  },
  {
    id: 'dungeon2',
    name: 'Shadow Crypt',
    bossRoomName: "Sorcerer's Sanctum",
    style: STONE,
    hazard: t.pit,
    decor: ['pillars', 'pool', 'pillars2', 'barrels'],
    seed: 2202,
    music: 'dark',
    town: 'town2',
    next: 'town3',
    nextGate: 'Dark magic seals the way.',
    intro: 'THE SHADOW CRYPT\nThe dark devours the unprepared. Bring fire.',
    enemies: [['bat', 2], ['knight', 2], ['wisp', 2], ['spider', 2]],
    miniboss: 'crypt_knight',
    barrier: 'crack',
    tools: ['bow'],
    boss: 'sorcerer',
    loot: [{ weapon: 'war_hammer' }, { maxHp: 4 }, { maxMp: 4 }, { gold: 60 }, { item: 'antidote', count: 3 }],
    gatedLoot: [['eye', { gold: 120 }]],
    extraItems: [{ item: 'lost_ring' }],
    dark: [0.7, 0.6, 0.9],
  },
  {
    id: 'dungeon3',
    name: 'Frost Cavern',
    bossRoomName: "Wyrm's Den",
    style: ICE,
    hazard: t.frozenWater,
    decor: ['ice', 'pool', 'pillars', 'ice'],
    seed: 3303,
    music: 'ice',
    town: 'town3',
    next: 'town4',
    nextGate: 'Thick ice seals the way.',
    intro: 'FROST CAVERN\nThe ice is slippery. Watch your step!',
    enemies: [['ice_slime', 3], ['yeti', 2], ['frost_wisp', 2], ['bat', 1]],
    miniboss: 'yeti_chief',
    barrier: 'moat',
    tools: ['bow', 'bombs'],
    boss: 'wyrm',
    loot: [{ armor: 'mystic_robe' }, { maxHp: 4 }, { maxMp: 4 }, { gold: 80 }, { item: 'bomb', count: 5 }],
    gatedLoot: [['crack', { item: 'potion', count: 3, gold: 50 }], ['eye', { gold: 100 }]],
    extraItems: [{ item: 'frost_herb' }, { item: 'frost_herb' }, { item: 'frost_herb' }],
    dark: 0,
  },
  {
    id: 'dungeon4',
    name: 'Hollow Spire',
    bossRoomName: "The Hollow Throne",
    style: SPIRE,
    hazard: t.lava,
    decor: ['pool', 'pillars', 'pillars2', 'barrels'],
    seed: 4404,
    music: 'dark',
    town: 'town4',
    next: null,
    intro: 'THE HOLLOW SPIRE\nThe King waits at the top. Every seal you broke has made him angrier.',
    enemies: [['fire_imp', 3], ['sand_knight', 2], ['scorpion', 2], ['wisp', 1]],
    miniboss: 'fire_drake',
    barrier: 'brazier',
    tools: ['bow', 'bombs', 'hookshot'],
    boss: 'hollow_king',
    loot: [{ armor: 'sun_plate' }, { maxHp: 4 }, { maxMp: 4 }, { gold: 100 }, { item: 'ether', count: 3 }],
    gatedLoot: [['moat', { maxHp: 4 }], ['crack', { gold: 150 }]],
    extraItems: [],
    dark: [0.35, 0.5, 0.7],
  },
];

const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const SIDE_NAME = { N: 'north', S: 'south', W: 'west', E: 'east' };
const FACING_IN = { N: 'down', S: 'up', W: 'right', E: 'left' };
const MAIN = 7;
const ZONE = [0, 0, 1, 1, 2, 2, 3];

class Fail extends Error {}

// ============================================================================================ layout
function pickWeighted(rng, list) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[list.length - 1][0];
}
const shuffle = (rng, a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function layout(cfg, rng) {
  const grid = new Map();
  const rooms = [];
  const edges = [];
  const k = (x, y) => `${x},${y}`;
  const free = (x, y) => !grid.has(k(x, y)) && y <= 0 && Math.abs(x) <= 5 && y >= -10;
  const add = (x, y, props) => {
    const r = { gx: x, gy: y, doors: {}, purpose: null, ...props };
    grid.set(k(x, y), r);
    rooms.push(r);
    return r;
  };
  const link = (a, b, side, type = 'open') => {
    const e = { a, b, side, type };
    a.doors[side] = e;
    b.doors[OPP[side]] = e;
    edges.push(e);
    return e;
  };
  const MAIN_EDGE = [null, 'open', 'lock', 'open', cfg.barrier, 'open', 'lock'];

  // 1. main path
  const main = [add(0, 0, { zone: 0, kind: 'main', purpose: 'entrance' })];
  for (let i = 1; i < MAIN; i++) {
    const p = main[i - 1];
    const opts = [['N', 3], ['E', 1.4], ['W', 1.4]].filter(([s]) => free(p.gx + DIRS[s][0], p.gy + DIRS[s][1]));
    if (!opts.length) throw new Fail('main path stuck');
    const s = pickWeighted(rng, opts);
    const r = add(p.gx + DIRS[s][0], p.gy + DIRS[s][1], { zone: ZONE[i], kind: 'main' });
    link(p, r, s, MAIN_EDGE[i]);
    main.push(r);
  }
  const last = main[MAIN - 1];
  if (!free(last.gx, last.gy - 1)) throw new Fail('no room for the boss');
  const boss = add(last.gx, last.gy - 1, { zone: 3, kind: 'boss', purpose: 'boss' });
  link(last, boss, 'N', 'bossdoor');

  // 2. branches
  const grow = (zone, purpose, { len = 1 + (rng() < 0.35 ? 1 : 0), gate = 'open', gatedZone = false } = {}) => {
    // prefer the main path and corridor rooms; if they're boxed in, branch off a dead end
    const inZone = rooms.filter((r) => r.zone === zone && r.kind !== 'boss' && r.purpose !== 'miniboss');
    const parents = [
      ...shuffle(rng, inZone.filter((r) => r.kind === 'main' || !r.purpose)),
      ...shuffle(rng, inZone.filter((r) => r.kind === 'branch' && r.purpose)),
    ];
    for (const p of parents) {
      for (const s of shuffle(rng, ['N', 'E', 'W', 'S'])) {
        let x = p.gx + DIRS[s][0];
        let y = p.gy + DIRS[s][1];
        if (!free(x, y) || p.doors[s]) continue;
        // walk the branch
        const path = [[x, y, s]];
        const taken = new Set([k(x, y)]);
        let ok = true;
        for (let i = 1; i < len; i++) {
          const opts = shuffle(rng, ['N', 'E', 'W', 'S']).filter((d) => free(x + DIRS[d][0], y + DIRS[d][1]) && !taken.has(k(x + DIRS[d][0], y + DIRS[d][1])));
          if (!opts.length) {
            ok = false;
            break;
          }
          const d = opts[0];
          x += DIRS[d][0];
          y += DIRS[d][1];
          taken.add(k(x, y));
          path.push([x, y, d]);
        }
        if (!ok) continue;
        let prev = p;
        path.forEach(([bx, by, d], i) => {
          const r = add(bx, by, { zone: gatedZone ? 10 + zone : zone, kind: 'branch', purpose: i === path.length - 1 ? purpose : null });
          link(prev, r, d, i === 0 ? gate : 'open');
          prev = r;
        });
        return prev;
      }
    }
    throw new Fail(`no space for ${purpose} z${zone} ${gate}`);
  };
  grow(0, 'key');
  grow(0, 'map', { len: 1 });
  grow(1, 'miniboss');
  grow(1, 'compass', { len: 1 });
  grow(2, 'key');
  grow(3, 'bigkey');
  // dead ends: loot (spread over the zones), quest items, empty ones
  const lootZones = [0, 1, 2, 3, 2];
  cfg.loot.forEach((loot, i) => (grow(lootZones[i % lootZones.length], 'loot', { len: rng() < 0.3 ? 2 : 1 }).loot = loot));
  for (const [gate, loot] of cfg.gatedLoot) {
    const z = 1 + Math.floor(rng() * 3);
    grow(z, 'loot', { len: 1, gate, gatedZone: true }).loot = loot;
  }
  grow(1, 'empty', { len: 1 });
  grow(2, 'empty', { len: 1 });

  // 3. one loop between neighbouring rooms of the same zone
  for (const a of shuffle(rng, rooms)) {
    if (a.kind === 'boss' || a.purpose === 'miniboss' || a.zone >= 10) continue;
    const s = shuffle(rng, ['N', 'E', 'W'])
      .filter((d) => !a.doors[d])
      .find((d) => {
        const b = grid.get(k(a.gx + DIRS[d][0], a.gy + DIRS[d][1]));
        return b && b.zone === a.zone && b.kind !== 'boss' && b.purpose !== 'miniboss' && !b.doors[OPP[d]];
      });
    if (s) {
      link(a, grid.get(k(a.gx + DIRS[s][0], a.gy + DIRS[s][1])), s, 'open').loop = true;
      break;
    }
  }

  // extra quest items go into dead ends
  const ends = shuffle(rng, rooms.filter((r) => r.kind === 'branch' && r.purpose && r.purpose !== 'miniboss'));
  cfg.extraItems.forEach((it, i) => {
    const r = ends[i % ends.length];
    (r.extraItems = r.extraItems || []).push(it);
  });
  return { rooms, edges, main, boss };
}

// ============================================================================== solvability check
/** Plays the dungeon at the room level: collect keys and items, open doors when possible. */
function simulate(cfg, L) {
  const have = new Set(cfg.tools);
  let keys = 0;
  let bigKey = false;
  const opened = new Set();
  const collected = new Set();
  const passable = (e) =>
    e.type === 'open' || opened.has(e) || (NEEDS[e.type] && have.has(NEEDS[e.type]));
  for (let guard = 0; guard < 100; guard++) {
    // what can we reach?
    const reach = new Set([L.main[0]]);
    const stack = [L.main[0]];
    while (stack.length) {
      const r = stack.pop();
      for (const e of Object.values(r.doors)) {
        const other = e.a === r ? e.b : e.a;
        if (reach.has(other)) continue;
        // barriers only stop you from the near side (A); from B you are already past them
        if (!passable(e) && r === e.a) continue;
        reach.add(other);
        stack.push(other);
      }
    }
    let changed = false;
    for (const r of reach) {
      if (collected.has(r)) continue;
      collected.add(r);
      if (r.purpose === 'key') keys++;
      if (r.purpose === 'bigkey') bigKey = true;
      if (r.purpose === 'miniboss') have.add(NEEDS[cfg.barrier]);
      changed = true;
    }
    if (reach.size === L.rooms.length) return { ok: true, keysLeft: keys };
    for (const e of L.edges) {
      if (!reach.has(e.a) || reach.has(e.b) || opened.has(e)) continue;
      if (e.type === 'lock' && keys > 0) {
        keys--;
        opened.add(e);
        changed = true;
      } else if (e.type === 'bossdoor' && bigKey) {
        opened.add(e);
        changed = true;
      }
    }
    if (!changed) return { ok: false, reason: `stuck with ${reach.size}/${L.rooms.length} rooms reachable` };
  }
  return { ok: false, reason: 'loop' };
}

// ============================================================================================ rooms
class RoomBuilder {
  constructor(cfg, room, rng, region) {
    this.cfg = cfg;
    this.room = room;
    this.rng = rng;
    this.region = region;
    const { W, H } = room;
    this.W = W;
    this.H = H;
    this.cx = Math.floor(W / 2) - 1;
    this.cy = Math.floor(H / 2) - 1;
    this.m = dungeonRoom(W, H, { style: cfg.style });
    this.solid = new Set();
    this.reserved = new Set();
    this.mustReach = []; // tiles that must be reachable on foot
    this.unreachable = []; // tiles that must NOT be (moat platforms)
  }

  /** Tile at lateral offset a / depth d in front of the door on `side` (d = 0: just inside). */
  local(side, a, d) {
    const { W, H, cx, cy } = this;
    if (side === 'N') return [cx + a, 2 + d];
    if (side === 'S') return [cx + a, H - 3 - d];
    if (side === 'W') return [2 + d, cy + a];
    return [W - 3 - d, cy + a];
  }

  threshold(side) {
    const { W, H, cx, cy } = this;
    return { N: [cx, 1, 2, 1], S: [cx, H - 2, 2, 1], W: [1, cy, 1, 2], E: [W - 2, cy, 1, 2] }[side];
  }

  key(x, y) {
    return `${x},${y}`;
  }

  inside(x, y) {
    return x >= 1 && y >= 2 && x <= this.W - 2 && y <= this.H - 2;
  }

  isFloor(x, y) {
    if (!this.inside(x, y)) return false;
    const i = y * this.W + x;
    return !this.m.layers.walls[i] && !HAZARDS.has(this.m.layers.ground[i] - 1);
  }

  reserve(x, y) {
    this.reserved.add(this.key(x, y));
  }

  /** Flood fill on foot from the first entry. */
  reach() {
    const seen = new Set();
    const [sx, sy] = this.start;
    const st = [[sx, sy]];
    while (st.length) {
      const [x, y] = st.pop();
      const kk = this.key(x, y);
      if (seen.has(kk) || !this.isFloor(x, y) || this.solid.has(kk)) continue;
      seen.add(kk);
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
  }

  ok() {
    const r = this.reach();
    return this.mustReach.every(([x, y]) => r.has(this.key(x, y))) && this.unreachable.every(([x, y]) => !r.has(this.key(x, y)));
  }

  /** A free floor tile (not reserved/solid), reachable, optionally near a point. */
  freeTiles({ near, margin = 1, avoidSpawns = 0 } = {}) {
    const r = this.reach();
    const out = [];
    for (let y = 2 + margin - 1; y <= this.H - 2 - (margin - 1); y++) {
      for (let x = margin; x <= this.W - 1 - margin; x++) {
        const kk = this.key(x, y);
        if (!r.has(kk) || this.reserved.has(kk) || this.solid.has(kk)) continue;
        if (avoidSpawns && this.spawns.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) < avoidSpawns)) continue;
        out.push([x, y]);
      }
    }
    if (near) out.sort((p, q) => Math.hypot(p[0] - near[0], p[1] - near[1]) - Math.hypot(q[0] - near[0], q[1] - near[1]));
    else return shuffle(this.rng, out);
    return out;
  }

  /** Put a solid object somewhere that keeps the room walkable. Returns the tile. */
  placeSolid(cands, needAccess = true) {
    for (const [x, y] of cands) {
      const kk = this.key(x, y);
      this.solid.add(kk);
      const adj = [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]];
      const r = this.reach();
      const access = !needAccess || adj.some(([ax, ay]) => r.has(this.key(ax, ay)));
      if (access && this.mustReach.every(([mx, my]) => r.has(this.key(mx, my)))) {
        if (needAccess) this.mustReach.push(adj.find(([ax, ay]) => r.has(this.key(ax, ay))));
        return [x, y];
      }
      this.solid.delete(kk);
    }
    throw new Fail(`no spot for an object in ${this.room.id}`);
  }

  // -------------------------------------------------------------------------------- doors
  doors() {
    const { m, room } = this;
    this.spawns = [];
    const sides = Object.keys(room.doors);
    if (room.purpose === 'entrance') sides.push('S');
    for (const side of sides) {
      const { cx, cy, W, H } = this;
      if (side === 'N') openTop(m, cx);
      if (side === 'S') openBottom(m, cx);
      if (side === 'W') openLeft(m, cy);
      if (side === 'E') openRight(m, cy);
      for (let a = -1; a <= 2; a++) for (let d = 0; d <= 2; d++) this.reserve(...this.local(side, a, d));
      const [tx, ty, tw, th] = this.threshold(side);
      for (let i = 0; i < tw; i++) for (let j = 0; j < th; j++) this.reserve(tx + i, ty + j);
      const sp = this.local(side, 0.5, 1);
      this.spawns.push(this.local(side, 0, 1));
      this.mustReach.push(this.local(side, 0, 0), this.local(side, 1, 0));
      if (!this.start) this.start = this.local(side, 0, 1);
      const warp = { N: [cx, 0, 2, 1], S: [cx, H - 1, 2, 1], W: [0, cy, 1, 2], E: [W - 1, cy, 1, 2] }[side];
      if (side === 'S' && room.purpose === 'entrance') {
        m.set('ground', cx, H - 1, t.stairsUp);
        m.set('ground', cx + 1, H - 1, t.stairsUp);
        m.area('warp', 'to_town', ...warp, { map: this.cfg.town, spawn: 'from_dungeon' });
        m.point('spawn', 'entrance', sp[0], sp[1], { facing: 'up' });
        continue;
      }
      if (side === 'N' && room.purpose === 'boss') continue; // handled in boss()
      const e = room.doors[side];
      const other = e.a === room ? e.b : e.a;
      m.area('warp', `to_${other.id}`, ...warp, { map: other.id, spawn: SIDE_NAME[OPP[side]] });
      m.point('spawn', SIDE_NAME[side], sp[0], sp[1], { facing: FACING_IN[side] });
      if (e.a === room) this.barrier(side, e);
    }
  }

  /** The obstacle on the near side of a door. */
  barrier(side, e) {
    const { m } = this;
    const th = this.threshold(side);
    const id = this.room.id;
    switch (e.type) {
      case 'lock':
        m.area('door', 'Door', ...th, { lock: 'small_key' });
        break;
      case 'bossdoor':
        m.area('door', 'BossDoor', ...th, { lock: 'boss_key' });
        break;
      case 'crack':
        m.area('crack', 'Crack', ...th, { text: 'A crack runs through the wall. A bomb might do it.' });
        break;
      case 'eye': {
        const flag = `eye:${id}:${side}`;
        m.area('gate', 'EyeGate', ...th, { flag, text: 'The gate is shut. A stone eye stares from nearby... Only an arrow could reach it.' });
        const a = this.rng() < 0.5 ? -2 : 3;
        const [ex, ey] = this.local(side, a, 0);
        this.solid.add(this.key(ex, ey));
        this.reserve(ex, ey);
        m.point('switch', 'Eye', ex, ey, { mode: 'crystal', hitBy: 'bow', flag });
        // stand in line with the eye and shoot it
        for (let d = 1; d <= 3; d++) this.reserve(...this.local(side, a, d));
        this.mustReach.push(this.local(side, a, 2));
        break;
      }
      case 'brazier': {
        const flags = [0, 1].map((i) => `brazier:${id}:${side}:${i}`);
        m.area('gate', 'FlameGate', ...th, { flag: flags.join(','), text: 'Two cold braziers guard the gate. Only a holy flame can kindle them.' });
        [-2, 3].forEach((a, i) => {
          const [bx, by] = this.local(side, a, 0);
          this.solid.add(this.key(bx, by));
          this.reserve(bx, by);
          this.reserve(...this.local(side, a, 1));
          m.point('torch', 'Brazier', bx, by, { flag: flags[i], hitBy: 'flame_brand', radius: 44 });
          this.mustReach.push(this.local(side, a, 1));
        });
        break;
      }
      case 'moat': {
        // a pit around a little platform in front of the door; hookshot posts to cross
        const plat = [];
        for (let a = -3; a <= 4; a++) {
          for (let d = 0; d <= 3; d++) {
            const [x, y] = this.local(side, a, d);
            this.reserve(x, y);
            if (a >= -1 && a <= 2 && d <= 1) plat.push([x, y]);
            else m.set('ground', x, y, t.pit);
          }
        }
        // keep the platform side walls closed (side doors next to the moat would bypass it)
        const [px, py] = this.local(side, -1, 0);
        this.solid.add(this.key(px, py));
        m.point('hook', 'Post', px, py, {});
        const [rx, ry] = this.local(side, 2, 5);
        this.solid.add(this.key(rx, ry));
        m.point('hook', 'Post', rx, ry, {});
        for (let d = 4; d <= 6; d++) for (const a of [-1, 2]) this.reserve(...this.local(side, a, d));
        this.mustReach.push(this.local(side, -1, 5), this.local(side, 2, 4));
        this.unreachable.push(...plat.filter(([x, y]) => !(x === px && y === py)));
        // the platform's door tiles are not reachable on foot (that's the point)
        this.mustReach = this.mustReach.filter(([x, y]) => !plat.some(([qx, qy]) => qx === x && qy === y));
        if (this.start && plat.some(([qx, qy]) => qx === this.start[0] && qy === this.start[1])) this.start = null;
        m.point('sign', 'Sign', ...this.local(side, 4, 5), { text: 'The way is cut off by a chasm. Something that grabs the post might pull you over...' });
        this.solid.add(this.key(...this.local(side, 4, 5)));
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------- decoration
  decorate() {
    const { cfg, rng, m, W, H } = this;
    const snapshot = () => ({ g: [...m.layers.ground], w: [...m.layers.walls] });
    const free = (x, y) => this.isFloor(x, y) && !this.reserved.has(this.key(x, y)) && !this.solid.has(this.key(x, y));
    const before = snapshot();
    for (let attempt = 0; attempt < 12; attempt++) {
      m.layers.ground = [...before.g];
      m.layers.walls = [...before.w];
      const kinds = shuffle(rng, cfg.decor).slice(0, 1 + (rng() < 0.5 ? 1 : 0));
      for (const kind of kinds) {
        if (kind === 'pillars') {
          const ix = 3 + Math.floor(rng() * 2);
          const iy = 4 + Math.floor(rng() * 2);
          for (const [x, y] of [[ix, iy], [W - 1 - ix, iy], [ix, H - 1 - iy + 1], [W - 1 - ix, H - 1 - iy + 1]]) if (free(x, y)) m.set('walls', x, y, t.pillar);
        } else if (kind === 'pillars2') {
          const y = Math.floor(H / 2);
          for (let x = 3; x < W - 3; x += 3) if (free(x, y - 2) && free(x, y + 2)) {
            m.set('walls', x, y - 2, t.pillar);
            m.set('walls', x, y + 2, t.pillar);
          }
        } else if (kind === 'pool') {
          const pw = 2 + Math.floor(rng() * 4);
          const ph = 2 + Math.floor(rng() * 2);
          const px = 2 + Math.floor(rng() * (W - pw - 4));
          const py = 3 + Math.floor(rng() * (H - ph - 5));
          for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (free(x, y)) m.set('ground', x, y, cfg.hazard);
        } else if (kind === 'barrels') {
          for (let i = 0; i < 4; i++) {
            const x = rng() < 0.5 ? 1 + Math.floor(rng() * 2) : W - 2 - Math.floor(rng() * 2);
            const y = 2 + Math.floor(rng() * (H - 4));
            if (free(x, y)) m.set('walls', x, y, t.barrel);
          }
        } else if (kind === 'ice') {
          const pw = 4 + Math.floor(rng() * 6);
          const ph = 3 + Math.floor(rng() * 3);
          const px = 1 + Math.floor(rng() * (W - pw - 2));
          const py = 2 + Math.floor(rng() * (H - ph - 3));
          for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (this.isFloor(x, y)) m.set('ground', x, y, t.ice);
        }
      }
      if (this.ok()) return;
    }
    m.layers.ground = before.g;
    m.layers.walls = before.w;
  }

  // ------------------------------------------------------------------------------ contents
  chest(contents, variant = 'plain') {
    const { m, room } = this;
    const center = [Math.floor(this.W / 2), Math.floor(this.H / 2)];
    const [x, y] = this.placeSolid(this.freeTiles({ near: center, margin: 2 }));
    if (variant === 'switch') {
      const flag = `switch:${room.id}`;
      const [sx, sy] = this.freeTiles({ margin: 2, avoidSpawns: 3 })[0] || [];
      if (sx === undefined) throw new Fail('no switch spot');
      this.reserve(sx, sy);
      this.mustReach.push([sx, sy]);
      m.point('switch', 'Switch', sx, sy, { mode: 'floor', flag });
      m.point('chest', 'Chest', x, y, { ...contents, ifFlag: flag });
    } else if (variant === 'ambush') {
      m.point('chest', 'Chest', x, y, { ...contents, ifFlag: `ambush:${room.id}` });
    } else {
      m.point('chest', 'Chest', x, y, contents);
    }
  }

  ambushGates() {
    for (const side of Object.keys(this.room.doors)) {
      const e = this.room.doors[side];
      if (e.a === this.room && e.type !== 'open') continue; // already blocked by its barrier
      this.m.area('gate', 'Ambush', ...this.threshold(side), { mode: 'clear' });
    }
  }

  enemies(n) {
    const tiles = this.freeTiles({ margin: 2, avoidSpawns: 5 });
    for (let i = 0; i < n && i < tiles.length; i++) {
      const [x, y] = tiles[i];
      this.reserve(x, y);
      this.m.point('enemy', 'Enemy', x, y, { enemy: pickWeighted(this.rng, this.cfg.enemies) });
    }
  }

  pots(n) {
    const corners = [[1, 2], [this.W - 2, 2], [1, this.H - 2], [this.W - 2, this.H - 2], [2, 2], [this.W - 3, 2]];
    let placed = 0;
    for (const [x, y] of shuffle(this.rng, corners)) {
      if (placed >= n) break;
      if (!this.isFloor(x, y) || this.reserved.has(this.key(x, y)) || this.solid.has(this.key(x, y))) continue;
      this.solid.add(this.key(x, y));
      if (!this.ok()) {
        this.solid.delete(this.key(x, y));
        continue;
      }
      const r = this.rng();
      this.m.point('pot', 'Pot', x, y, r < 0.15 ? { drop: 'gold', amount: 5 } : {});
      placed++;
    }
  }

  torches(n, lit = true) {
    const spots = [[2, 2], [this.W - 3, 2], [2, this.H - 2], [this.W - 3, this.H - 2]];
    let placed = 0;
    for (const [x, y] of shuffle(this.rng, spots)) {
      if (placed >= n) break;
      if (!this.isFloor(x, y) || this.reserved.has(this.key(x, y)) || this.solid.has(this.key(x, y))) continue;
      this.solid.add(this.key(x, y));
      if (!this.ok()) {
        this.solid.delete(this.key(x, y));
        continue;
      }
      this.m.point('torch', 'Torch', x, y, { lit, radius: 56 });
      placed++;
    }
  }

  build() {
    const { cfg, room, rng, m } = this;
    setRand(rng);
    this.doors();
    if (!this.start) this.start = this.mustReach[0];
    if (!this.ok()) throw new Fail(`room ${room.id} not walkable after doors`);
    const p = room.purpose;
    if (p !== 'boss' && p !== 'miniboss') this.decorate();
    const variant = () => pickWeighted(rng, [['plain', 2], ['switch', 1.2], ['ambush', 0.9]]);
    switch (p) {
      case 'entrance':
        this.mustReach.push(this.local('S', -2, 2));
        m.point('sign', 'Sign', ...this.local('S', -2, 1), { text: cfg.intro.replace(/\n/g, '\\n') });
        this.solid.add(this.key(...this.local('S', -2, 1)));
        this.enemies(2);
        break;
      case 'key':
      case 'bigkey':
      case 'loot': {
        const v = variant();
        const contents = p === 'key' ? { item: 'small_key' } : p === 'bigkey' ? { item: 'boss_key' } : room.loot;
        this.chest(contents, v);
        if (v === 'ambush') this.ambushGates();
        this.enemies(v === 'ambush' ? 3 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2));
        break;
      }
      case 'map':
        this.chest({ item: 'dungeon_map', flag: `map:${this.region}` });
        this.enemies(1);
        break;
      case 'compass':
        this.chest({ item: 'compass', flag: `compass:${this.region}` });
        this.enemies(2);
        break;
      case 'miniboss':
        for (const side of Object.keys(room.doors)) m.area('gate', 'BossGate', ...this.threshold(side), { mode: 'boss' });
        for (const [x, y] of [[3, 4], [this.W - 4, 4], [3, this.H - 4], [this.W - 4, this.H - 4]]) if (this.isFloor(x, y) && !this.reserved.has(this.key(x, y))) m.set('walls', x, y, t.pillar);
        m.point('boss', cfg.miniboss, this.W / 2 - 0.5, this.H / 2 - 0.5, { boss: cfg.miniboss });
        break;
      case 'empty':
        this.enemies(3);
        if (rng() < 0.3) this.ambushGates();
        break;
      case 'boss':
        this.boss();
        break;
      default:
        this.enemies(2 + Math.floor(rng() * 2));
        if (room.kind === 'main' && rng() < 0.12 && !Object.values(room.doors).some((e) => e.type === 'moat')) this.ambushGates();
    }
    for (const it of room.extraItems || []) {
      const [x, y] = this.freeTiles({ margin: 2, avoidSpawns: 2 })[0];
      this.reserve(x, y);
      m.point('item', 'Item', x, y, it);
    }
    if (p !== 'boss' && p !== 'miniboss') this.pots(Math.floor(rng() * 3));
    if (room.darkness) this.torches(2 + Math.floor(rng() * 2));
    if (!this.ok()) throw new Fail(`room ${room.id} not walkable`);
    return m;
  }

  boss() {
    const { cfg, m, W, H, cx } = this;
    for (const [x, y] of [[3, 4], [W - 4, 4], [3, H - 4], [W - 4, H - 4]]) m.set('walls', x, y, t.pillar);
    m.area('gate', 'BossGate', ...this.threshold('S'), { mode: 'boss' });
    m.point('boss', cfg.boss, W / 2 - 0.5, H / 2 - 1, { boss: cfg.boss });
    if (cfg.next) {
      openTop(m, cx);
      m.area('gate', 'NorthGate', ...this.threshold('N'), { flag: `${cfg.id}_cleared`, text: cfg.nextGate });
      m.area('warp', `to_${cfg.next}`, cx, 0, 2, 1, { map: cfg.next, spawn: 'south' });
      const sp = this.local('N', 0.5, 1);
      m.point('spawn', 'north', sp[0], sp[1], { facing: 'down' });
    }
  }
}

// ============================================================================================ main
function generate(cfg) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = makeRng(cfg.seed + attempt * 7919);
    try {
      const L = layout(cfg, rng);
      const sim = simulate(cfg, L);
      if (!sim.ok) throw new Fail(sim.reason);
      // name rooms: entrance _1, then in creation order; boss _boss
      let n = 1;
      for (const r of L.rooms) r.id = r.kind === 'boss' ? `${cfg.id}_boss` : `${cfg.id}_${n++}`;
      // sizes + darkness
      for (const r of L.rooms) {
        const moat = Object.values(r.doors).some((e) => e.a === r && e.type === 'moat');
        r.W = r.kind === 'boss' ? 18 : r.purpose === 'miniboss' ? 17 : 15 + Math.floor(rng() * 5);
        r.H = r.kind === 'boss' ? 15 : r.purpose === 'miniboss' ? 13 : (moat ? 13 : 11) + Math.floor(rng() * 3);
        if (Array.isArray(cfg.dark) && r.purpose !== 'entrance' && rng() < cfg.dark[0]) r.darkness = Math.round((cfg.dark[1] + rng() * (cfg.dark[2] - cfg.dark[1])) * 100) / 100;
      }
      const maps = L.rooms.map((r) => [r, new RoomBuilder(cfg, r, rng, cfg.id).build()]);
      return { L, maps, attempt };
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      if (process.env.DEBUG_GEN) (globalThis.__fails = globalThis.__fails || {})[e.message.replace(/dungeon\d_\d+/, "R")] = ((globalThis.__fails || {})[e.message.replace(/dungeon\d_\d+/, "R")] || 0) + 1;
    }
  }
  throw new Error(`Could not generate ${cfg.id} ${JSON.stringify(globalThis.__fails || {})}`);
}

const worldPath = 'public/data/world.json';
const world = JSON.parse(readFileSync(worldPath, 'utf8'));
for (const cfg of DUNGEONS.filter((d) => !process.env.ONLY || d.id === process.env.ONLY)) {
  const { L, maps, attempt } = generate(cfg);
  const minX = Math.min(...L.rooms.map((r) => r.gx));
  const minY = Math.min(...L.rooms.map((r) => r.gy));
  // drop this dungeon's old rooms from world.json (and, with --force, old map files)
  for (const id of Object.keys(world.maps)) if (world.maps[id].region === cfg.id) delete world.maps[id];
  const ids = new Set(L.rooms.map((r) => r.id));
  if (force) {
    for (const f of readdirSync('public/maps')) {
      const id = f.replace(/\.tmj$/, '');
      if (id.startsWith(`${cfg.id}_`) && !ids.has(id)) unlinkSync(`public/maps/${f}`);
    }
  }
  for (const [r, m] of maps) {
    save(r.id, m);
    world.maps[r.id] = {
      file: `maps/${r.id}.tmj`,
      name: r.kind === 'boss' ? cfg.bossRoomName : cfg.name,
      kind: 'dungeon',
      region: cfg.id,
      music: cfg.music,
      grid: [r.gx - minX, r.gy - minY],
      ...(r.kind === 'boss' ? { boss: true } : {}),
      ...(r.darkness ? { darkness: r.darkness } : {}),
    };
  }
  const counts = {};
  for (const r of L.rooms) counts[r.purpose || r.kind] = (counts[r.purpose || r.kind] || 0) + 1;
  console.log(`${cfg.id}: ${L.rooms.length} rooms (attempt ${attempt})`, JSON.stringify(counts));
  // ascii preview of the layout
  const maxX = Math.max(...L.rooms.map((r) => r.gx));
  const maxY = Math.max(...L.rooms.map((r) => r.gy));
  const sym = { entrance: 'E', key: 'k', bigkey: 'K', map: 'm', compass: 'c', miniboss: 'M', loot: '$', empty: '.', boss: 'B' };
  for (let y = minY; y <= maxY; y++) {
    let row = '   ';
    for (let x = minX; x <= maxX; x++) {
      const r = L.rooms.find((q) => q.gx === x && q.gy === y);
      row += r ? (sym[r.purpose] || (r.kind === 'main' ? 'o' : '-')) + (r.doors.E ? '-' : ' ') : '  ';
    }
    console.log(row);
  }
}
writeFileSync(worldPath, JSON.stringify(world, null, 2) + '\n');
console.log(`updated ${worldPath}`);
if (!existsSync('public/maps')) console.log('note: public/maps missing');
void T;
