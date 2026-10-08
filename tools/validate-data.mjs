// Checks every data file, the asset manifest and all Tiled maps for broken references.
//   npm run validate
// Exits with code 1 if anything is wrong, so you can catch typos before playing.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const PUB = 'public';
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${path}: ${e.message}`);
    return null;
  }
}

const D = {};
for (const n of ['world', 'weapons', 'spells', 'items', 'armor', 'enemies', 'bosses', 'shops', 'teachers', 'smiths', 'dialogue', 'sounds', 'music']) {
  D[n] = readJSON(join(PUB, 'data', `${n}.json`)) || {};
}
const assets = readJSON(join(PUB, 'assets.json')) || {};
const sprites = assets.sprites || {};
const images = assets.images || {};
const textureExists = (k) => k in sprites || k in images;

// ---- asset manifest
for (const [k, s] of Object.entries(sprites)) {
  if (s.layout && !(assets.layouts || {})[s.layout]) err(`assets.json sprite "${k}": unknown layout "${s.layout}"`);
  if (s.file && !existsSync(join(PUB, s.file))) err(`assets.json sprite "${k}": file not found: public/${s.file}`);
}
for (const [k, s] of Object.entries(images)) {
  if (s.file && !existsSync(join(PUB, s.file))) err(`assets.json image "${k}": file not found: public/${s.file}`);
}

// ---- content
const need = (cond, msg) => cond || err(msg);
for (const [id, w] of Object.entries(D.weapons)) {
  need(['arc', 'thrust', 'projectile'].includes(w.shape), `weapons.${id}: shape must be arc, thrust or projectile`);
  need(typeof w.damage === 'number', `weapons.${id}: damage must be a number`);
  if (w.icon && !textureExists(w.icon)) err(`weapons.${id}: icon "${w.icon}" not in assets.json`);
  if (w.projectile?.sprite && !textureExists(w.projectile.sprite)) err(`weapons.${id}: projectile sprite "${w.projectile.sprite}" not in assets.json`);
}
for (const [id, s] of Object.entries(D.spells)) {
  need(['projectile', 'area', 'heal'].includes(s.type), `spells.${id}: type must be projectile, area or heal`);
  need(typeof s.mpCost === 'number', `spells.${id}: mpCost must be a number`);
  if (s.icon && !textureExists(s.icon)) err(`spells.${id}: icon "${s.icon}" not in assets.json`);
  if (s.projectile?.sprite && !textureExists(s.projectile.sprite)) err(`spells.${id}: projectile sprite "${s.projectile.sprite}" not in assets.json`);
}
for (const [id, it] of Object.entries(D.items)) {
  if (it.icon && !textureExists(it.icon)) err(`items.${id}: icon "${it.icon}" not in assets.json`);
}
for (const [id, a] of Object.entries(D.armor)) {
  need(typeof a.defense === 'number', `armor.${id}: defense must be a number`);
  if (a.icon && !textureExists(a.icon)) err(`armor.${id}: icon "${a.icon}" not in assets.json`);
}
const sfxNames = new Set(Object.keys(D.sounds).filter((k) => !k.startsWith('_')));
const checkSfx = (where, name) => name && !sfxNames.has(name) && !(assets.audio || {})[`sfx_${name}`] && warn(`${where}: sfx "${name}" not in sounds.json`);
for (const [id, w] of Object.entries(D.weapons)) checkSfx(`weapons.${id}`, w.sfx);
for (const [id, s] of Object.entries(D.spells)) checkSfx(`spells.${id}`, s.sfx);
const tracks = new Set(Object.keys(D.music).filter((k) => !k.startsWith('_')));
const checkMusic = (where, t) => t && !tracks.has(t) && !(assets.audio || {})[`music_${t}`] && err(`${where}: music track "${t}" not in music.json`);
for (const [id, tr] of Object.entries(D.music)) {
  if (id.startsWith('_')) continue;
  for (const [ci, c] of (tr.channels || []).entries()) {
    for (const tok of c.notes.trim().split(/\s+/)) {
      if (!/^([A-G][#b]?-?\d|-|\.|x|o)$/.test(tok)) err(`music.${id} channel ${ci}: bad note "${tok}"`);
    }
  }
}
checkMusic('world.titleMusic', D.world.titleMusic);
for (const [id, e] of Object.entries(D.enemies)) {
  need(e.sprite in sprites, `enemies.${id}: sprite "${e.sprite}" not in assets.json sprites`);
  need(typeof e.hp === 'number', `enemies.${id}: hp must be a number`);
  const ai = e.ai || {};
  if (ai.idle) need(['wander', 'flutter', 'stand'].includes(ai.idle), `enemies.${id}: ai.idle must be wander, flutter or stand`);
  if (ai.onSight) need(['chase', 'keepDistance', 'charge', 'teleport', 'none'].includes(ai.onSight), `enemies.${id}: ai.onSight must be chase, keepDistance, charge, teleport or none`);
  for (const d of e.drops || []) {
    need(['gold', 'heart', 'mana', 'item'].includes(d.type), `enemies.${id}: drop type "${d.type}" must be gold, heart, mana or item`);
    if (d.type === 'item') need(d.item in D.items, `enemies.${id}: drop item "${d.item}" unknown`);
  }
  const pr = ai.attack && ai.attack.projectile;
  if (pr && pr.sprite && !textureExists(pr.sprite)) err(`enemies.${id}: projectile sprite "${pr.sprite}" not in assets.json`);
}
const PATTERN_TYPES = ['chase', 'charge', 'area', 'radial', 'aimed', 'summon', 'teleport'];
for (const [id, b] of Object.entries(D.bosses)) {
  need(b.sprite in sprites, `bosses.${id}: sprite "${b.sprite}" not in assets.json sprites`);
  need(Array.isArray(b.phases) && b.phases.length, `bosses.${id}: needs at least one phase`);
  for (const [pi, ph] of (b.phases || []).entries()) {
    for (const p of ph.patterns || []) need(p in (b.patterns || {}), `bosses.${id}: phase ${pi} uses unknown pattern "${p}"`);
  }
  for (const [pn, p] of Object.entries(b.patterns || {})) {
    need(PATTERN_TYPES.includes(p.type), `bosses.${id}.patterns.${pn}: type must be one of ${PATTERN_TYPES.join(', ')}`);
    if (p.type === 'summon') need(p.enemy in D.enemies, `bosses.${id}.patterns.${pn}: unknown enemy "${p.enemy}"`);
  }
  const r = b.reward || {};
  if (r.weapon) need(r.weapon in D.weapons, `bosses.${id}.reward: unknown weapon "${r.weapon}"`);
  if (r.spell) need(r.spell in D.spells, `bosses.${id}.reward: unknown spell "${r.spell}"`);
  if (r.item) need(r.item in D.items, `bosses.${id}.reward: unknown item "${r.item}"`);
  if (r.armor) need(r.armor in D.armor, `bosses.${id}.reward: unknown armor "${r.armor}"`);
  checkMusic(`bosses.${id}`, b.music);
}
for (const [id, s] of Object.entries(D.shops)) {
  for (const e of s.stock || []) {
    if (e.weapon) need(e.weapon in D.weapons, `shops.${id}: unknown weapon "${e.weapon}"`);
    else if (e.spell) need(e.spell in D.spells, `shops.${id}: unknown spell "${e.spell}"`);
    else if (e.armor) need(e.armor in D.armor, `shops.${id}: unknown armor "${e.armor}"`);
    else need(e.item in D.items, `shops.${id}: unknown item "${e.item}"`);
  }
}
for (const [id, t] of Object.entries(D.teachers)) {
  for (const e of t.spells || []) need(e.spell in D.spells, `teachers.${id}: unknown spell "${e.spell}"`);
}
const ng = D.world.newGame || {};
for (const w of ng.weapons || []) need(w in D.weapons, `world.newGame: unknown weapon "${w}"`);
for (const s of ng.spells || []) need(s in D.spells, `world.newGame: unknown spell "${s}"`);
for (const i of Object.keys(ng.items || {})) need(i in D.items, `world.newGame: unknown item "${i}"`);
for (const a of ng.armor || []) need(a in D.armor, `world.newGame: unknown armor "${a}"`);
const regionIds = new Set((D.world.regions || []).map((r) => r.id));
for (const r of D.world.regions || []) if (r.boss) need(r.boss in D.bosses, `world.regions.${r.id}: unknown boss "${r.boss}"`);
for (const [id, def] of Object.entries(D.world.maps || {})) {
  if (def.region && regionIds.size && !regionIds.has(def.region)) warn(`world.maps.${id}: region "${def.region}" is not in world.regions`);
  checkMusic(`world.maps.${id}`, def.music);
  if (def.grid) need(Array.isArray(def.grid) && def.grid.length === 2, `world.maps.${id}: grid must be [col, row]`);
}
for (const [id, d] of Object.entries(D.dialogue)) {
  for (const v of [d, ...(d.variants || [])]) {
    const g = v.give;
    if (g && g.item) need(g.item in D.items, `dialogue.${id}: give.item "${g.item}" unknown`);
    if (g && g.weapon) need(g.weapon in D.weapons, `dialogue.${id}: give.weapon "${g.weapon}" unknown`);
  }
}

// ---- maps
const maps = {};
for (const [id, def] of Object.entries(D.world.maps || {})) {
  const path = join(PUB, def.file);
  if (!existsSync(path)) {
    err(`world.maps.${id}: file not found: ${path}`);
    continue;
  }
  maps[id] = { path, json: readJSON(path) };
}
const propsOf = (o) => Object.fromEntries((o.properties || []).map((p) => [p.name, p.value]));
const spawnsOf = (m) =>
  new Set(m.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects.filter((o) => (o.type || o.class) === 'spawn').map((o) => o.name)));

for (const [id, { path, json }] of Object.entries(maps)) {
  if (!json) continue;
  for (const ts of json.tilesets || []) {
    if (ts.source) {
      const tsPath = resolve(dirname(path), ts.source);
      if (!existsSync(tsPath)) err(`${path}: tileset not found: ${ts.source}`);
      else {
        const t = readJSON(tsPath);
        if (t && t.image && !existsSync(resolve(dirname(tsPath), t.image))) err(`${tsPath}: image not found: ${t.image}`);
      }
    } else if (ts.image && !existsSync(resolve(dirname(path), ts.image))) err(`${path}: tileset image not found: ${ts.image}`);
  }
  if (json.infinite) err(`${path}: infinite maps aren't supported (Map > Map Properties > untick Infinite)`);
  const where = (o) => `${path} object #${o.id} "${o.name || ''}"`;
  for (const layer of json.layers.filter((l) => l.type === 'objectgroup')) {
    for (const o of layer.objects) {
      const type = o.type || o.class || '';
      const p = propsOf(o);
      switch (type) {
        case 'spawn':
          if (!o.name) err(`${where(o)}: spawn needs a name`);
          break;
        case 'warp':
          if (!maps[p.map]) err(`${where(o)}: warp to unknown map "${p.map}" (add it to world.json)`);
          else if (p.spawn && maps[p.map].json && !spawnsOf(maps[p.map].json).has(p.spawn)) err(`${where(o)}: map "${p.map}" has no spawn named "${p.spawn}"`);
          if (!o.width || !o.height) err(`${where(o)}: warp must be a rectangle`);
          break;
        case 'smith':
          if (!(p.smith in D.smiths)) err(`${where(o)}: unknown smith "${p.smith}"`);
          break;
        case 'npc':
        case 'healer':
          if (p.dialogue && !(p.dialogue in D.dialogue)) err(`${where(o)}: unknown dialogue "${p.dialogue}"`);
          if (p.sprite && !(p.sprite in sprites)) err(`${where(o)}: unknown sprite "${p.sprite}"`);
          if (type === 'npc' && !p.dialogue) warn(`${where(o)}: npc has no dialogue property`);
          break;
        case 'shop':
          if (!(p.shop in D.shops)) err(`${where(o)}: unknown shop "${p.shop}"`);
          break;
        case 'teacher':
          if (!(p.teacher in D.teachers)) err(`${where(o)}: unknown teacher "${p.teacher}"`);
          break;
        case 'chest':
          if (p.weapon && !(p.weapon in D.weapons)) err(`${where(o)}: unknown weapon "${p.weapon}"`);
          if (p.spell && !(p.spell in D.spells)) err(`${where(o)}: unknown spell "${p.spell}"`);
          if (p.item && !(p.item in D.items)) err(`${where(o)}: unknown item "${p.item}"`);
          if (p.armor && !(p.armor in D.armor)) err(`${where(o)}: unknown armor "${p.armor}"`);
          break;
        case 'door':
          if (!o.width || !o.height) err(`${where(o)}: door must be a rectangle`);
          if (p.lock && !(p.lock in D.items)) err(`${where(o)}: lock item "${p.lock}" unknown`);
          break;
        case 'switch':
          if (!p.flag) err(`${where(o)}: switch needs a flag`);
          if (p.mode && !['floor', 'plate', 'crystal'].includes(p.mode)) err(`${where(o)}: switch mode must be floor, plate or crystal`);
          break;
        case 'pot':
          if (p.item && !(p.item in D.items)) err(`${where(o)}: unknown item "${p.item}"`);
          break;
        case 'item':
          if (!(p.item in D.items)) err(`${where(o)}: unknown item "${p.item}"`);
          break;
        case 'block':
        case 'torch':
        case 'light':
          break;
        case 'enemy':
          if (!((p.enemy || o.name) in D.enemies)) err(`${where(o)}: unknown enemy "${p.enemy || o.name}"`);
          break;
        case 'boss':
          if (!((p.boss || o.name) in D.bosses)) err(`${where(o)}: unknown boss "${p.boss || o.name}"`);
          break;
        case 'gate':
        case 'sign':
          break;
        default:
          warn(`${where(o)}: unknown object type "${type}" (ignored by the game)`);
      }
    }
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR:   ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`All good: ${Object.keys(maps).length} maps, ${Object.keys(D.weapons).length} weapons, ${Object.keys(D.spells).length} spells, ${Object.keys(D.enemies).length} enemies, ${Object.keys(D.bosses).length} bosses.${warnings.length ? ` (${warnings.length} warnings)` : ''}`);
