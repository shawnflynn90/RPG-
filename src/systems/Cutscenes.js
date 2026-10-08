import Phaser from 'phaser';
import { DB } from './db.js';
import { Game } from './GameState.js';
import { Audio } from './Audio.js';
import { dirFromVector } from '../entities/Actor.js';
import { pixelText } from '../ui/font.js';

const T = 16;
const tileToPx = ([tx, ty]) => ({ x: tx * T + T / 2, y: ty * T + T / 2 });

/**
 * Data-driven cutscenes (public/data/cutscenes.json).
 *
 * A cutscene: { "if": {conditions}, "once": true, "steps": [ ...commands ] }
 * Actors are "player" or an NPC's Name from Tiled. Positions are in TILES ([x, y]).
 *
 *   { "say": ["text", ...], "speaker": "Elder" }        dialogue box
 *   { "ask": "Question?", "options": ["Yes","No"], "flags": ["said_yes", null] }
 *   { "move": "Elder", "to": [14, 11], "speed": 40 }      walk (add "wait": false to not wait)
 *   { "face": "player", "dir": "up" }   or  { "face": "Elder", "toward": "player" }
 *   { "emote": "Elder", "icon": "!" }                      little bubble above someone
 *   { "camera": [x, y], "ms": 800 }   { "camera": "player" }   pan the camera / follow again
 *   { "wait": 500 }   { "shake": 300 }   { "flash": "#ffffff" }   { "fade": "out" | "in" }
 *   { "sfx": "chest" }   { "music": "boss" }
 *   { "flag": "name" }   { "give": { reward } }   { "startQuest": "id" }
 *   { "hide": "Elder" }  { "show": "Elder" }
 *   { "warp": { "map": "town2", "spawn": "south" } }
 *   { "credits": true }                                    roll the credits (data/credits)
 */
export class CutsceneRunner {
  constructor(world) {
    this.world = world;
  }

  /** Can this cutscene play now? */
  canPlay(id) {
    const def = DB.cutscenes[id];
    if (!def) {
      console.warn(`Unknown cutscene "${id}"`);
      return false;
    }
    if (def.once !== false && Game.flag(`cutscene:${id}`)) return false;
    return Game.check(def.if || {});
  }

  actor(name) {
    const w = this.world;
    if (!name || name === 'player') return w.player;
    const npc = w.npcs.find((n) => n.name === name);
    if (!npc) console.warn(`Cutscene: no NPC named "${name}" in map ${w.mapId}`);
    return npc;
  }

  async play(id) {
    const def = DB.cutscenes[id];
    if (!def) return;
    if (def.once !== false) Game.setFlag(`cutscene:${id}`);
    const w = this.world;
    w.scripting = true;
    w.player.body.setVelocity(0, 0);
    w.player.play4('idle');
    for (const e of w.enemies) if (e.body) e.body.setVelocity(0, 0);
    try {
      for (const step of def.steps || []) {
        if (!w.scene.isActive() && !w.scene.isPaused()) return; // scene was stopped
        await this.run(step);
        if (step.warp) return;
      }
    } catch (e) {
      console.error(`Cutscene "${id}" failed:`, e);
    } finally {
      w.scripting = false;
      w.cameras.main.startFollow(w.player, true);
    }
  }

  wait(ms) {
    return new Promise((res) => this.world.time.delayedCall(ms, res));
  }

  async run(s) {
    const w = this.world;
    const ui = w.ui;
    if (s.say) return ui.say(s.say, s.speaker || null);
    if (s.ask) {
      const i = await ui.ask(s.ask, s.options || ['Yes', 'No'], s.speaker || null, { cancelable: false });
      const f = (s.flags || [])[i];
      if (f) Game.setFlag(f);
      return;
    }
    if (s.move) {
      const a = this.actor(s.move);
      if (!a) return;
      const to = tileToPx(s.to);
      const dist = Phaser.Math.Distance.Between(a.x, a.y, to.x, to.y - 4);
      const ms = (dist / (s.speed || 40)) * 1000;
      a.facing = dirFromVector(to.x - a.x, to.y - 4 - a.y, a.facing);
      a.play4('walk');
      if (a.talking !== undefined) a.talking = true; // NPCs stop wandering
      const p = new Promise((res) =>
        w.tweens.add({
          targets: a,
          x: to.x,
          y: to.y - 4,
          duration: ms,
          onComplete: () => {
            a.play4('idle');
            res();
          },
        }),
      );
      if (s.wait === false) return;
      return p;
    }
    if (s.face) {
      const a = this.actor(s.face);
      if (!a) return;
      if (s.toward) {
        const b = this.actor(s.toward);
        if (b) a.facing = dirFromVector(b.x - a.x, b.y - a.y, a.facing);
      } else a.facing = s.dir || 'down';
      a.play4('idle');
      return;
    }
    if (s.emote) {
      const a = this.actor(s.emote);
      if (!a) return;
      const t = pixelText(w, Math.round(a.x), Math.round(a.y - a.frameH / 2 - 10), s.icon || '!', 0xf8e060).setOrigin(0.5).setDepth(7000);
      const bg = w.add.rectangle(t.x, t.y, 9, 11, 0xffffff).setStrokeStyle(1, 0x000000).setDepth(6999);
      t.setTint(0x202020);
      Audio.sfx('menuSelect');
      w.tweens.add({ targets: [t, bg], y: '-=3', yoyo: true, duration: 120 });
      await this.wait(s.ms || 700);
      t.destroy();
      bg.destroy();
      return;
    }
    if (s.camera) {
      const cam = w.cameras.main;
      if (s.camera === 'player') {
        cam.pan(w.player.x, w.player.y, s.ms || 500, 'Sine.easeInOut');
        await this.wait(s.ms || 500);
        cam.startFollow(w.player, true);
        return;
      }
      cam.stopFollow();
      const to = tileToPx(s.camera);
      cam.pan(to.x, to.y, s.ms || 800, 'Sine.easeInOut');
      return this.wait(s.ms || 800);
    }
    if (s.wait) return this.wait(s.wait);
    if (s.shake) {
      w.cameras.main.shake(s.shake, 0.012);
      return this.wait(s.shake);
    }
    if (s.flash) {
      const c = Phaser.Display.Color.HexStringToColor(s.flash);
      ui.cameras.main.flash(300, c.red, c.green, c.blue);
      return this.wait(300);
    }
    if (s.fade) {
      const cam = w.cameras.main;
      if (s.fade === 'out') cam.fadeOut(s.ms || 400, 0, 0, 0);
      else cam.fadeIn(s.ms || 400, 0, 0, 0);
      return this.wait(s.ms || 400);
    }
    if (s.sfx) return Audio.sfx(s.sfx);
    if (s.music !== undefined) return Audio.music(s.music);
    if (s.flag) return Game.setFlag(s.flag);
    if (s.startQuest) {
      if (Game.startQuest(s.startQuest)) {
        Audio.sfx('quest');
        return ui.say(`New quest: ${DB.quests[s.startQuest].name}!`);
      }
      return;
    }
    if (s.give) {
      const lines = Game.grant(s.give);
      Audio.sfx('chest');
      return ui.say(lines);
    }
    if (s.hide || s.show) {
      const a = this.actor(s.hide || s.show);
      if (a) {
        a.setVisible(!!s.show);
        a.body.enable = !!s.show;
      }
      return;
    }
    if (s.warp) {
      w.scripting = false;
      return w.goTo(s.warp.map, s.warp.spawn);
    }
    if (s.credits) {
      return new Promise((res) => {
        w.scene.pause();
        w.scene.launch('Credits', {
          onClose: () => {
            w.scene.resume();
            Audio.music(w.mapDef.music);
            res();
          },
        });
        w.scene.bringToTop('Credits');
      });
    }
    console.warn('Unknown cutscene step', s);
  }
}
