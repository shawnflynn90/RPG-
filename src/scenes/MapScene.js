import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { Audio } from '../systems/Audio.js';
import { pixelText } from '../ui/font.js';
import { drawPanel, COLORS } from '../ui/widgets.js';
import { propsOf } from './WorldScene.js';
import { anchorUI, backdrop } from '../ui/layout.js';

const CELL_W = 26;
const CELL_H = 18;

/**
 * SELECT screen.
 *  - Area tab: room-by-room map of the current dungeon (rooms need "region" + "grid": [col, row]
 *    in world.json). Visited rooms are shown; finding the dungeon map (flag "map:<region>")
 *    reveals the rest.
 *  - World tab: the chain of towns and dungeons from world.json "regions".
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  init(data) {
    this.onClose = data.onClose || (() => {});
    this.mapId = data.mapId;
    const def = DB.world.maps[this.mapId] || {};
    this.region = def.region || null;
    const regionDef = (DB.world.regions || []).find((r) => r.id === this.region);
    const hasGrid = Object.values(DB.world.maps).some((m) => m.region === this.region && m.grid);
    this.tab = regionDef && regionDef.kind === 'dungeon' && hasGrid ? 0 : 1;
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.draw();
  }

  clear() {
    this.layer.removeAll(true);
  }

  put(o) {
    this.layer.add(o);
    return o;
  }

  draw() {
    this.clear();
    this.put(backdrop(this));
    anchorUI(this, 'center');
    this.put(drawPanel(this, 2, 2, 236, 18));
    ['Area', 'World'].forEach((t, i) => this.put(pixelText(this, 12 + i * 50, 7, t, i === this.tab ? COLORS.highlight : COLORS.dim)));
    this.put(pixelText(this, 232, 7, 'L/R: tab  B: close', COLORS.dim).setOrigin(1, 0));
    this.put(drawPanel(this, 2, 22, 236, 136));
    if (this.tab === 0) this.drawArea();
    else this.drawWorld();
  }

  // ------------------------------------------------------------------------------ dungeon
  /**
   * The map fills in as you explore: visited rooms are drawn solid, doorways you have seen lead
   * to "?" outlines. The dungeon map (flag map:<region>) reveals every room; the compass
   * (flag compass:<region>) marks unopened chests and the boss.
   */
  drawArea() {
    const regionDef = (DB.world.regions || []).find((r) => r.id === this.region);
    const rooms = Object.entries(DB.world.maps).filter(([, m]) => m.region === this.region && m.grid);
    if (!rooms.length) {
      this.put(pixelText(this, 120, 80, 'No map for this area.', COLORS.dim).setOrigin(0.5));
      return;
    }
    this.put(pixelText(this, 10, 28, regionDef ? regionDef.name : this.region, COLORS.highlight));
    const hasMap = Game.flag(`map:${this.region}`);
    const hasCompass = Game.flag(`compass:${this.region}`);
    const keys = Game.s.items.small_key || 0;
    const bigKey = Game.s.items.boss_key ? ' +Big' : '';
    this.put(pixelText(this, 230, 28, `Keys ${keys}${bigKey}`, COLORS.text).setOrigin(1, 0));
    const tips = [hasMap ? 'Map' : null, hasCompass ? 'Compass' : null].filter(Boolean).join(' + ');
    this.put(pixelText(this, 10, 146, tips ? `Have: ${tips}` : 'Find the map and compass!', COLORS.dim));
    this.put(pixelText(this, 230, 146, '? unexplored', COLORS.dim).setOrigin(1, 0));

    const visited = (id) => !!Game.s.visited[id];
    const links = {};
    for (const [id] of rooms) links[id] = warpTargets(id).filter((t) => DB.world.maps[t] && DB.world.maps[t].region === this.region);
    // rooms you've seen a doorway to (or every room, with the map)
    const seen = new Set();
    for (const [id] of rooms) if (visited(id) || hasMap) seen.add(id);
    for (const [id] of rooms) if (visited(id)) for (const t of links[id]) seen.add(t);

    const cols = rooms.map(([, m]) => m.grid[0]);
    const rows = rooms.map(([, m]) => m.grid[1]);
    const minC = Math.min(...cols);
    const minR = Math.min(...rows);
    const nC = Math.max(...cols) - minC + 1;
    const nR = Math.max(...rows) - minR + 1;
    const gap = 4;
    const cw = Math.max(10, Math.min(CELL_W, Math.floor(220 / nC) - gap));
    const ch = Math.max(8, Math.min(CELL_H, Math.floor(104 / nR) - gap));
    const ox = Math.round(120 - (nC * (cw + gap) - gap) / 2);
    const oy = Math.round(88 - (nR * (ch + gap) - gap) / 2);
    const pos = {};
    for (const [id, m] of rooms) pos[id] = { x: ox + (m.grid[0] - minC) * (cw + gap), y: oy + (m.grid[1] - minR) * (ch + gap), m };

    const g = this.put(this.add.graphics());
    // doorways between neighbouring rooms
    for (const [id, p] of Object.entries(pos)) {
      if (!visited(id) && !hasMap) continue;
      for (const t of links[id]) {
        const q = pos[t];
        if (!q) continue;
        const dx = Math.sign(q.m.grid[0] - p.m.grid[0]);
        const dy = Math.sign(q.m.grid[1] - p.m.grid[1]);
        g.fillStyle(visited(id) && visited(t) ? 0xc8d0f0 : 0x6870a0, 1);
        if (dx) g.fillRect(dx > 0 ? p.x + cw : p.x - gap, p.y + ch / 2 - 2, gap, 4);
        else if (dy) g.fillRect(p.x + cw / 2 - 2, dy > 0 ? p.y + ch : p.y - gap, 4, gap);
      }
    }
    for (const [id, p] of Object.entries(pos)) {
      if (!seen.has(id)) continue;
      const isBoss = p.m.boss === true;
      g.fillStyle(0x000000, 1).fillRect(p.x - 1, p.y - 1, cw + 2, ch + 2);
      if (visited(id)) {
        g.fillStyle(isBoss ? 0x903040 : 0x3858c8, 1).fillRect(p.x, p.y, cw, ch);
        g.fillStyle(0xffffff, 0.18).fillRect(p.x, p.y, cw, 2);
      } else if (hasMap) {
        g.fillStyle(isBoss ? 0x502030 : 0x283058, 1).fillRect(p.x, p.y, cw, ch);
      } else {
        g.lineStyle(1, 0x6870a0, 1).strokeRect(p.x + 0.5, p.y + 0.5, cw - 1, ch - 1);
        this.put(pixelText(this, p.x + cw / 2, p.y + ch / 2 - 4, '?', COLORS.dim).setOrigin(0.5, 0));
      }
      if (hasCompass) {
        const marks = roomMarkers(id);
        if (isBoss && !marks.bossBeaten) g.fillStyle(0xf84838, 1).fillCircle(p.x + cw / 2, p.y + ch / 2, 3);
        for (let i = 0; i < marks.chests; i++) g.fillStyle(0xf8d048, 1).fillRect(p.x + 2 + i * 4, p.y + ch - 5, 3, 3);
      }
      if (id === this.mapId) this.here = this.put(this.add.rectangle(p.x + cw / 2, p.y + ch / 2, 5, 5, 0xf8e060));
    }
  }

  // ------------------------------------------------------------------------------ world
  drawWorld() {
    const regions = DB.world.regions || [];
    this.put(pixelText(this, 10, 28, 'World', COLORS.highlight));
    if (!regions.length) {
      this.put(pixelText(this, 120, 80, 'Add "regions" to world.json', COLORS.dim).setOrigin(0.5));
      return;
    }
    const visitedRegion = (r) => Object.entries(DB.world.maps).some(([id, m]) => m.region === r.id && Game.s.visited[id]);
    // zig-zag path across the screen
    const pts = regions.map((r, i) => ({
      r,
      x: 26 + i * Math.min(44, 188 / Math.max(1, regions.length - 1)),
      y: i % 2 ? 106 : 70,
    }));
    const g = this.put(this.add.graphics());
    for (let i = 1; i < pts.length; i++) {
      const lit = visitedRegion(pts[i].r);
      g.lineStyle(3, lit ? 0xc8a060 : 0x404868, 1);
      g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    for (const p of pts) {
      const v = visitedRegion(p.r);
      const town = p.r.kind === 'town';
      g.fillStyle(0x000000, 1).fillRect(p.x - 8, p.y - 8, 16, 16);
      g.fillStyle(!v ? 0x404868 : town ? 0x48a058 : 0x8848a8, 1).fillRect(p.x - 7, p.y - 7, 14, 14);
      if (town && v) g.fillStyle(0xc04838, 1).fillRect(p.x - 5, p.y - 5, 10, 4);
      const label = v ? p.r.name : '???';
      this.put(pixelText(this, p.x, p.r === pts[0].r || pts.indexOf(p) % 2 === 0 ? p.y - 20 : p.y + 11, label, v ? COLORS.text : COLORS.dim).setOrigin(0.5, 0));
      if (p.r.id === this.region) this.here = this.put(this.add.rectangle(p.x, p.y, 6, 6, 0xf8e060));
      if (p.r.boss && Game.flag(`boss:${p.r.boss}`)) this.put(pixelText(this, p.x, p.y - 4, '*', 0xf8e060).setOrigin(0.5, 0));
    }
    this.put(pixelText(this, 10, 146, `Level ${Game.s.level}   Bosses beaten: ${regions.filter((r) => r.boss && Game.flag(`boss:${r.boss}`)).length}`, COLORS.dim));
  }

  close() {
    input.consume();
    Audio.sfx('menuBack');
    this.scene.stop();
    this.onClose();
  }

  update(time) {
    if (this.here) this.here.setVisible(Math.floor(time / 300) % 2 === 0);
    if (input.pressed('cancel') || input.justPressed('select') || input.justPressed('start') || input.pressed('confirm')) return this.close();
    if (input.pressed('prevTab') || input.pressed('nextTab') || input.justPressed('left') || input.justPressed('right')) {
      this.tab = 1 - this.tab;
      this.here = null;
      Audio.sfx('menuMove');
      this.draw();
    }
  }
}

/** Which maps can be reached from a map's warps. */
function warpTargets(mapId) {
  const map = DB.maps[mapId];
  if (!map) return [];
  const out = new Set();
  for (const l of map.layers) {
    if (l.type !== 'objectgroup') continue;
    for (const o of l.objects) if ((o.type || o.class) === 'warp') out.add(propsOf(o).map);
  }
  return [...out];
}

/** Unopened chests and an unbeaten boss in a map (for the compass). */
function roomMarkers(mapId) {
  const map = DB.maps[mapId];
  const out = { chests: 0, bossBeaten: true };
  if (!map) return out;
  for (const l of map.layers) {
    if (l.type !== 'objectgroup') continue;
    for (const o of l.objects) {
      const type = o.type || o.class;
      const p = propsOf(o);
      if (type === 'chest' && !Game.flag(`chest:${p.id || `${mapId}:${o.id}`}`)) out.chests++;
      if (type === 'boss' && !Game.flag(`boss:${p.boss || o.name}`)) out.bossBeaten = false;
    }
  }
  return out;
}
