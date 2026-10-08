import { GAME } from '../config/game.config.js';

/**
 * Darkness overlay for dark rooms. A screen-sized layer of darkness with soft holes cut out
 * around light sources: the player, lit torches, `light` objects and glowing projectiles.
 *
 * Turn it on per map with "darkness": 0.0-1.0 in world.json (or a Tiled map property).
 */
export class Lighting {
  constructor(scene, darkness, color = 0x05030c) {
    this.scene = scene;
    this.darkness = darkness;
    this.color = color;
    this.rt = scene.add.renderTexture(0, 0, GAME.width, GAME.height).setOrigin(0).setScrollFactor(0).setDepth(150000);
    this.stamp = scene.make.image({ key: 'light', add: false });
    this.sources = []; // static lights: { x, y, radius, flicker }
  }

  addLight(x, y, radius, flicker = false) {
    const l = { x, y, radius, flicker };
    this.sources.push(l);
    return l;
  }

  cut(x, y, radius) {
    const cam = this.scene.cameras.main;
    this.stamp.setScale((radius * 2) / this.stamp.width);
    this.rt.erase(this.stamp, Math.round(x - cam.scrollX), Math.round(y - cam.scrollY));
  }

  update(time) {
    const s = this.scene;
    this.rt.clear();
    this.rt.fill(this.color, this.darkness);
    const wobble = (seed) => Math.sin(time / 90 + seed) * 2 + Math.sin(time / 37 + seed * 3);
    if (s.player && !s.player.dead) this.cut(s.player.x, s.player.y, 52 + wobble(1));
    for (const l of this.sources) this.cut(l.x, l.y, l.radius + (l.flicker ? wobble(l.x) : 0));
    for (const t of s.torches || []) if (t.active && t.lit) this.cut(t.x, t.y, t.lightRadius + wobble(t.x));
    for (const p of s.combat.projectiles.getChildren()) {
      if (p.proj && p.proj.light) this.cut(p.x, p.y, p.proj.light);
    }
    if (s.boss && s.boss.active && s.boss.def.light) this.cut(s.boss.x, s.boss.y, s.boss.def.light);
    for (const e of s.enemies) if (e.active && e.def.light) this.cut(e.x, e.y, e.def.light);
  }
}

/** Soft radial gradient used to punch holes in the darkness. */
export function makeLightTexture(scene) {
  if (scene.textures.exists('light')) return;
  const size = 128;
  const tex = scene.textures.createCanvas('light', size, size);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

