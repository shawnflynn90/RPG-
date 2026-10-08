/**
 * Pixel particle presets (Phaser particle emitters using a 1x1 white pixel, tinted).
 *   scene.particles.burst(x, y, 'fire', 20)
 * Presets: fire, spark, dust, ice, magic, heal, leaf, blood (enemy hit), coin.
 */
const PRESETS = {
  fire: { speed: { min: 20, max: 90 }, lifespan: { min: 250, max: 600 }, tint: [0xf8e060, 0xf8a040, 0xf86030, 0x606060], gravityY: -40, scale: { start: 2, end: 1 } },
  spark: { speed: { min: 30, max: 80 }, lifespan: { min: 120, max: 260 }, tint: [0xffffff, 0xf8f0a0], scale: 1 },
  dust: { speed: { min: 4, max: 14 }, lifespan: { min: 200, max: 380 }, tint: [0xc8b898, 0xa89878], gravityY: -10, alpha: { start: 0.8, end: 0 }, scale: 1 },
  ice: { speed: { min: 20, max: 60 }, lifespan: { min: 300, max: 600 }, tint: [0xffffff, 0xa8e0f8, 0x70b8f0], scale: { start: 2, end: 1 } },
  magic: { speed: { min: 10, max: 50 }, lifespan: { min: 300, max: 700 }, tint: [0xe0c0ff, 0xa070f8, 0x7040c8], gravityY: -30, scale: 1 },
  heal: { speed: { min: 6, max: 20 }, lifespan: { min: 400, max: 800 }, tint: [0xa8f8a8, 0x58d858], gravityY: -50, scale: 1 },
  leaf: { speed: { min: 10, max: 40 }, lifespan: { min: 400, max: 800 }, tint: [0x58b048, 0x308830, 0x88c858], gravityY: 30, scale: { start: 2, end: 1 } },
  hit: { speed: { min: 40, max: 100 }, lifespan: { min: 100, max: 220 }, tint: [0xffffff, 0xf8d878], scale: 1 },
  coin: { speed: { min: 20, max: 50 }, lifespan: { min: 200, max: 400 }, tint: [0xf8e060, 0xfff8b0], gravityY: 60, scale: 1 },
};

export class Particles {
  constructor(scene, depth = 4900) {
    this.scene = scene;
    this.emitters = {};
    for (const [name, cfg] of Object.entries(PRESETS)) {
      const e = scene.add.particles(0, 0, 'pixel', { ...cfg, emitting: false, angle: { min: 0, max: 360 } });
      e.setDepth(depth);
      this.emitters[name] = e;
    }
  }

  burst(x, y, kind = 'spark', count = 8) {
    const e = this.emitters[kind] || this.emitters.spark;
    e.explode(count, x, y);
  }
}
