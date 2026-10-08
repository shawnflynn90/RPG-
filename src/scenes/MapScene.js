import Phaser from 'phaser';
import { DB } from '../systems/db.js';
import { Game } from '../systems/GameState.js';
import { input } from '../input/InputManager.js';
import { Audio } from '../systems/Audio.js';
import { pixelText } from '../ui/font.js';
import { drawPanel, COLORS } from '../ui/widgets.js';
import { propsOf } from './WorldScene.js';

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
    this.put(this.add.rectangle(0, 0, 240, 160, 0x080818).setOrigin(0));
    this.put(drawPanel(this, 2, 2, 236, 18));
    ['Area', 'World'].forEach((t, i) => this.put(pixelText(this, 12 + i * 50, 7, t, i === this.tab ? COLORS.highlight : COLORS.dim)));
    this.put(pixelText(this, 232, 7, 'L/R: tab  B: close', COLORS.dim).setOrigin(1, 0));
    this.put(drawPanel(this, 2, 22, 236, 136));
    if (this.tab === 0) this.drawArea();
    else this.drawWorld();
  }

  // ------------------------------------------------------------------------------ dungeon
  drawArea() {
    const regionDef = (DB.world.regions || []).find((r) => r.id === this.region);
    const rooms = Object.entries(DB.world.maps).filter(([, m]) => m.region === this.region && m.grid);
    if (!rooms.length) {
      this.put(pixelText(this, 120, 80, 'No map for this area.', COLORS.dim).setOrigin(0.5));
      return;
    }
    this.put(pixelText(this, 10, 28, regionDef ? regionDef.name : this.region, COLORS.highlight));
    const hasMap = Game.flag(`map:${this.region}`);
    const keys = Game.s.items.small_key || 0;
    const bigKey = Game.s.items.boss_key ? '  Big Key' : '';
    this.put(pixelText(this, 230, 28, `Keys ${keys}${bigKey}`, COLORS.text).setOrigin(1, 0));
    if (!hasMap) this.put(pixelText(this, 10, 146, 'Find the dungeon map to see every room.', COLORS.dim));

    const cols = rooms.map(([, m]) => m.grid[0]);
    const rows = rooms.map(([, m]) => m.grid[1]);
    const minC = Math.min(...cols);
    const minR = Math.min(...rows);
    const w = (Math.max(...cols) - minC + 1) * (CELL_W + 4);
    const h = (Math.max(...rows) - minR + 1) * (CELL_H + 4);
    const ox = Math.round(120 - w / 2);
    const oy = Math.round(88 - h / 2);
    const pos = {};
    for (const [id, m] of rooms) pos[id] = { x: ox + (m.grid[0] - minC) * (CELL_W + 4), y: oy + (m.grid[1] - minR) * (CELL_H + 4), m };

    // connections, derived from the warps in each map
    const g = this.put(this.add.graphics());
    for (const [id, p] of Object.entries(pos)) {
      const visible = Game.s.visited[id] || hasMap;
      if (!visible) continue;
      for (const target of warpTargets(id)) {
        const q = pos[target];
        if (!q || !(Game.s.visited[target] || hasMap)) continue;
        g.lineStyle(4, 0x8890b8, 1);
        g.lineBetween(p.x + CELL_W / 2, p.y + CELL_H / 2, q.x + CELL_W / 2, q.y + CELL_H / 2);
      }
    }
    for (const [id, p] of Object.entries(pos)) {
      const visited = !!Game.s.visited[id];
      if (!visited && !hasMap) continue;
      const isBoss = p.m.boss;
      const fill = visited ? (isBoss ? 0x903040 : 0x3858c8) : 0x283058;
      g.fillStyle(0x000000, 1).fillRect(p.x - 1, p.y - 1, CELL_W + 2, CELL_H + 2);
      g.fillStyle(fill, 1).fillRect(p.x, p.y, CELL_W, CELL_H);
      if (isBoss) this.put(pixelText(this, p.x + CELL_W / 2, p.y + 5, 'BOSS', 0xffffff).setOrigin(0.5, 0));
      if (id === this.mapId) {
        this.here = this.put(this.add.rectangle(p.x + CELL_W / 2, p.y + CELL_H / 2, 6, 6, 0xf8e060));
      }
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
