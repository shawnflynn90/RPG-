// Sound effects + music.
// Everything is synthesized with WebAudio from public/data/sounds.json and music.json, so the game has
// sound with zero audio files. Any sound can be replaced by a real file: add an "audio" entry in
// assets.json with the key  sfx_<name>  or  music_<track>  and that file is used instead.
import { DB } from './db.js';
import { Game } from './GameState.js';

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  n += (parseInt(m[3], 10) + 1) * 12; // MIDI number
  return 440 * Math.pow(2, (n - 69) / 12);
}

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.game = null;
    this.currentTrack = null;
    this.musicTimer = null;
    this.musicFile = null;
    this.lastPlayed = {};
  }

  /** Call once after the game boots. Audio starts on the first touch/key press (browser rule). */
  init(game) {
    this.game = game;
    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true });
    // Gamepads don't count as a user gesture everywhere, but try anyway.
    window.addEventListener('gamepadconnected', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
    // white noise buffer shared by all noise sounds
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pendingTrack) {
      const t = this.pendingTrack;
      this.pendingTrack = null;
      this.music(t);
    }
    return this.ctx;
  }

  applyVolumes() {
    const s = Game.settings;
    const sfx = (s.sfxVolume ?? 8) / 10;
    const mus = (s.musicVolume ?? 6) / 10;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
    if (this.musicBus) this.musicBus.gain.value = mus;
    if (this.musicFile) this.musicFile.setVolume(mus);
  }

  // ------------------------------------------------------------------------------- sfx
  sfx(name) {
    if (!name) return;
    // throttle identical sounds fired in the same few ms (e.g. 10 projectiles at once)
    const now = performance.now();
    if (now - (this.lastPlayed[name] || 0) < 30) return;
    this.lastPlayed[name] = now;

    const fileKey = `sfx_${name}`;
    if (this.game && this.game.cache.audio.exists(fileKey)) {
      this.game.sound.play(fileKey, { volume: (Game.settings.sfxVolume ?? 8) / 10 });
      return;
    }
    const def = DB.sounds && DB.sounds[name];
    if (!def || !this.ctx || this.ctx.state !== 'running') return;
    if (def.notes) {
      const step = def.step || 0.08;
      def.notes.forEach((n, i) => {
        const f = noteFreq(n);
        if (f) this.tone({ ...def, freq: [f, f], dur: step * 0.95 }, this.ctx.currentTime + i * step, this.sfxBus);
      });
    } else this.tone(def, this.ctx.currentTime, this.sfxBus);
  }

  tone(def, t, bus) {
    const ctx = this.ctx;
    const dur = def.dur || 0.1;
    const vol = def.vol ?? 0.2;
    const [f0, f1] = def.freq || [440, 440];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bus);
    let src;
    if (def.wave === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = 1.2;
      filt.frequency.setValueAtTime(Math.max(20, f0), t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      src.connect(filt);
      filt.connect(g);
    } else {
      src = ctx.createOscillator();
      src.type = def.wave || 'square';
      src.frequency.setValueAtTime(Math.max(20, f0), t);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      src.connect(g);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------------------------- music
  /** Play a track by id (from music.json or an audio file music_<id>). Same track = keeps playing. */
  music(trackId) {
    if (trackId === this.currentTrack) return;
    this.stopMusic();
    this.currentTrack = trackId || null;
    if (!trackId) return;
    const fileKey = `music_${trackId}`;
    if (this.game && this.game.cache.audio.exists(fileKey)) {
      this.musicFile = this.game.sound.add(fileKey, { loop: true, volume: (Game.settings.musicVolume ?? 6) / 10 });
      this.musicFile.play();
      return;
    }
    const track = DB.music && DB.music[trackId];
    if (!track) {
      console.warn(`[audio] no music track "${trackId}"`);
      return;
    }
    if (!this.ctx) {
      this.pendingTrack = trackId; // starts after the first user gesture
      this.currentTrack = null;
      return;
    }
    this.startSequencer(track);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicFile) {
      this.musicFile.stop();
      this.musicFile.destroy();
      this.musicFile = null;
    }
    if (this.voices) for (const v of this.voices) v.gain.gain.cancelScheduledValues(0);
    if (this.trackGain) {
      const g = this.trackGain;
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => g.disconnect(), 300);
      this.trackGain = null;
    }
    this.currentTrack = null;
  }

  startSequencer(track) {
    const ctx = this.ctx;
    const stepDur = 60 / (track.bpm || 120) / 2;
    this.trackGain = ctx.createGain();
    this.trackGain.connect(this.musicBus);
    const bus = this.trackGain;
    // Pre-parse channels into steps: { freq | 'hit' | null, len }
    const chans = track.channels.map((c) => {
      const toks = c.notes.trim().split(/\s+/);
      const events = [];
      toks.forEach((tok, i) => {
        if (tok === '-') return;
        if (tok === '.') return;
        let len = 1;
        while (toks[(i + len) % toks.length] === '-' && len < toks.length) len++;
        events[i] = { tok, len };
      });
      return { ...c, toks, events };
    });
    let step = 0;
    let nextTime = ctx.currentTime + 0.05;
    const schedule = () => {
      while (nextTime < ctx.currentTime + 0.2) {
        for (const c of chans) {
          const ev = c.events[step % c.toks.length];
          if (!ev) continue;
          if (c.wave === 'noise') {
            if (ev.tok === 'x') this.tone({ wave: 'noise', freq: [6000, 2000], dur: 0.05, vol: c.vol }, nextTime, bus);
            else if (ev.tok === 'o') this.tone({ wave: 'noise', freq: [300, 80], dur: 0.12, vol: c.vol * 2 }, nextTime, bus);
          } else {
            const f = noteFreq(ev.tok);
            if (f) this.tone({ wave: c.wave, freq: [f, f], dur: ev.len * stepDur * 0.92, vol: c.vol }, nextTime, bus);
          }
        }
        step++;
        nextTime += stepDur;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 50);
  }
}

export const Audio = new AudioSystem();
