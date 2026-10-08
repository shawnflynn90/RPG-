// Everything about the player's progress lives here, and this object is what gets saved.
import { DB } from './db.js';
import { SAVE } from '../config/game.config.js';

function freshState() {
  const ng = DB.world.newGame;
  return {
    version: SAVE.version,
    mapId: DB.world.start.map,
    spawn: DB.world.start.spawn,
    pos: null, // exact {x, y} when saved mid-map
    facing: 'down',
    hp: ng.maxHp,
    maxHp: ng.maxHp,
    mp: ng.maxMp,
    maxMp: ng.maxMp,
    gold: ng.gold,
    weapons: [...ng.weapons],
    weapon: ng.weapons[0] || null,
    spells: [...ng.spells],
    spell: ng.spells[0] || null,
    items: { ...ng.items },
    armors: [...(ng.armor || [])],
    armor: (ng.armor || [])[0] || null,
    weaponLevels: {},
    level: 1,
    xp: 0,
    visited: {},
    kills: {}, // enemy id -> total defeated
    quests: {}, // quest id -> { state: 'active' | 'done', base: {kills at start}, notified }
    flags: {},
    respawn: { map: DB.world.start.map, spawn: DB.world.start.spawn },
    playTimeMs: 0,
    savedAt: null,
  };
}

/** Upgrade old saves here when the save format changes (bump SAVE.version). */
function migrate(data) {
  const fresh = freshState();
  const s = { ...fresh, ...data, version: SAVE.version };
  if ((data.version || 1) < 2) {
    // v0.4 rebuilt every dungeon: forget per-room progress in them and step outside.
    const roomish = /^(chest|door|crack|item):dungeon|^(switch|ambush|eye|brazier):/;
    s.flags = Object.fromEntries(Object.entries(s.flags || {}).filter(([k]) => !roomish.test(k)));
    s.visited = Object.fromEntries(Object.entries(s.visited || {}).filter(([k]) => !k.startsWith('dungeon')));
    s.items = { ...s.items };
    delete s.items.small_key;
    delete s.items.boss_key;
    const outside = (mapId) => {
      const m = /^dungeon(\d)/.exec(mapId || '');
      return m ? { map: `town${m[1]}`, spawn: 'from_dungeon' } : null;
    };
    const out = outside(s.mapId);
    if (out) {
      s.mapId = out.map;
      s.spawn = out.spawn;
      s.pos = null;
    }
    if (s.respawn && outside(s.respawn.map)) s.respawn = outside(s.respawn.map);
    // dungeons you already beat: you get their mini-boss items
    const gifts = [
      ['dungeon1_cleared', 'moss_golem', () => s.weapons.includes('bow') || s.weapons.push('bow')],
      ['dungeon2_cleared', 'crypt_knight', () => s.spells.includes('bombs') || (s.spells.push('bombs'), (s.items.bomb = (s.items.bomb || 0) + 5))],
      ['dungeon3_cleared', 'yeti_chief', () => s.spells.includes('hookshot') || s.spells.push('hookshot')],
    ];
    s.weapons = [...(s.weapons || [])];
    s.spells = [...(s.spells || [])];
    for (const [flag, boss, give] of gifts) {
      if (!s.flags[flag]) continue;
      s.flags[`boss:${boss}`] = true;
      give();
    }
  }
  return s;
}

class GameStateManager {
  constructor() {
    this.state = null;
    this.slot = 0;
    this.settings = {
      vibrate: true,
      musicVolume: 6,
      sfxVolume: 8,
      textSpeed: 1, // 0 slow, 1 normal, 2 fast
      touchScale: 1,
      touchOffsets: {}, // per orientation: { landscape: { dpad: [dx, dy], ... } }
      keyboard: null, // custom keyboard mapping (null = defaults from input.config.js)
      gamepad: null,
    };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(SAVE.settingsKey) || '{}'));
    } catch {
      /* ignore */
    }
  }

  get s() {
    return this.state;
  }

  newGame(slot) {
    this.slot = slot;
    this.state = freshState();
  }

  // ---- saving -------------------------------------------------------------------------
  slotKey(slot) {
    return SAVE.keyPrefix + slot;
  }

  /** Summary of each slot for the title screen. */
  listSlots() {
    const out = [];
    for (let i = 0; i < SAVE.slots; i++) {
      try {
        const raw = localStorage.getItem(this.slotKey(i));
        out.push(raw ? JSON.parse(raw) : null);
      } catch {
        out.push(null);
      }
    }
    return out;
  }

  save() {
    this.state.savedAt = Date.now();
    try {
      localStorage.setItem(this.slotKey(this.slot), JSON.stringify(this.state));
      return true;
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  }

  load(slot) {
    const raw = localStorage.getItem(this.slotKey(slot));
    if (!raw) return false;
    this.slot = slot;
    this.state = migrate(JSON.parse(raw));
    return true;
  }

  saveSettings() {
    try {
      localStorage.setItem(SAVE.settingsKey, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  // ---- helpers used by game code -----------------------------------------------------
  flag(name) {
    return !!this.state.flags[name];
  }

  /** "a,b" = every listed flag is set. */
  allFlags(list) {
    return String(list)
      .split(',')
      .every((f) => this.flag(f.trim()));
  }

  setFlag(name, value = true) {
    this.state.flags[name] = value;
  }

  /** Simple condition objects used by dialogue variants etc. All keys must match. */
  check(cond = {}) {
    const s = this.state;
    if (cond.flag && !s.flags[cond.flag]) return false;
    if (cond.notFlag && s.flags[cond.notFlag]) return false;
    if (cond.hasWeapon && !s.weapons.includes(cond.hasWeapon)) return false;
    if (cond.hasSpell && !s.spells.includes(cond.hasSpell)) return false;
    if (cond.hasItem && !(s.items[cond.hasItem] > 0)) return false;
    if (cond.minGold && s.gold < cond.minGold) return false;
    if (cond.minLevel && s.level < cond.minLevel) return false;
    if (cond.visited && !s.visited[cond.visited]) return false;
    if (cond.questActive && this.questState(cond.questActive) !== 'active') return false;
    if (cond.questReady && !this.questReady(cond.questReady)) return false;
    if (cond.questDone && this.questState(cond.questDone) !== 'done') return false;
    if (cond.questNotStarted && this.questState(cond.questNotStarted)) return false;
    return true;
  }

  addWeapon(id) {
    if (!this.state.weapons.includes(id)) this.state.weapons.push(id);
    if (!this.state.weapon) this.state.weapon = id;
  }

  addSpell(id) {
    if (!this.state.spells.includes(id)) {
      this.state.spells.push(id);
      // tools can come with some ammo (e.g. 5 bombs)
      const def = DB.spells[id];
      if (def && def.ammo && def.startAmmo) this.addItem(def.ammo, def.startAmmo);
    }
    if (!this.state.spell) this.state.spell = id;
  }

  addArmor(id) {
    if (!this.state.armors.includes(id)) this.state.armors.push(id);
    if (!this.state.armor) this.state.armor = id;
  }

  // ---- derived stats ---------------------------------------------------------------
  /** A weapon's definition with blacksmith upgrades, level bonus applied. */
  weaponStats(id = this.state.weapon) {
    const base = DB.weapons[id];
    if (!base) return null;
    const lvl = this.state.weaponLevels[id] || 0;
    const w = { ...base, level: lvl, maxLevel: (base.upgrades || []).length };
    for (const up of (base.upgrades || []).slice(0, lvl)) {
      for (const [k, v] of Object.entries(up)) if (k !== 'price' && typeof v === 'number') w[k] = (w[k] || 0) + v;
    }
    w.damage += this.attackBonus();
    w.displayName = lvl ? `${base.name} +${lvl}` : base.name;
    return w;
  }

  attackBonus() {
    const lv = DB.world.leveling;
    return lv ? Math.floor((lv.perLevel.attack || 0) * (this.state.level - 1)) : 0;
  }

  get armorDef() {
    return DB.armor[this.state.armor] || { defense: 0 };
  }

  get defense() {
    return this.armorDef.defense || 0;
  }

  resists(effect) {
    return (this.armorDef.resist || []).includes(effect);
  }

  // ---- quests (data/quests.json) ------------------------------------------------------
  questState(id) {
    const q = this.state.quests[id];
    return q ? q.state : null;
  }

  startQuest(id) {
    if (!DB.quests[id] || this.state.quests[id]) return false;
    this.state.quests[id] = { state: 'active', base: { ...this.state.kills }, notified: false };
    return true;
  }

  /** Progress lines: [{ text, have, need, done }] */
  questProgress(id) {
    const def = DB.quests[id];
    const q = this.state.quests[id];
    if (!def) return [];
    return (def.goals || []).map((g) => {
      let have = 0;
      let need = 1;
      if (g.kills) {
        const [enemy, n] = Object.entries(g.kills)[0];
        need = n;
        have = (this.state.kills[enemy] || 0) - ((q && q.base[enemy]) || 0);
      } else if (g.item) {
        need = g.count || 1;
        have = this.state.items[g.item] || 0;
      } else if (g.flag) {
        have = this.flag(g.flag) ? 1 : 0;
      }
      have = Math.max(0, Math.min(have, need));
      return { text: g.text, have, need, done: have >= need };
    });
  }

  questReady(id) {
    return this.questState(id) === 'active' && this.questProgress(id).every((g) => g.done);
  }

  /** Turn in a ready quest: takes quest items, grants the reward. Returns message lines. */
  completeQuest(id) {
    if (!this.questReady(id)) return [];
    const def = DB.quests[id];
    if (def.takeItems !== false) {
      for (const g of def.goals || []) {
        if (!g.item) continue;
        this.state.items[g.item] -= g.count || 1;
        if (this.state.items[g.item] <= 0) delete this.state.items[g.item];
      }
    }
    this.state.quests[id].state = 'done';
    return [`Quest complete: ${def.name}!`, ...this.grant(def.reward || {})];
  }

  recordKill(enemyId) {
    this.state.kills[enemyId] = (this.state.kills[enemyId] || 0) + 1;
  }

  /** Quests that just became ready (each reported once). */
  newlyReadyQuests() {
    const out = [];
    for (const [id, q] of Object.entries(this.state.quests)) {
      if (q.state === 'active' && !q.notified && this.questReady(id)) {
        q.notified = true;
        out.push(id);
      }
    }
    return out;
  }

  // ---- experience --------------------------------------------------------------------
  xpToNext(level = this.state.level) {
    const lv = DB.world.leveling;
    if (!lv || level >= lv.maxLevel) return Infinity;
    return Math.round(lv.xpBase * Math.pow(lv.xpGrowth, level - 1));
  }

  /** Add XP; returns the number of levels gained (stats are raised and HP/MP refilled). */
  addXp(n) {
    const lv = DB.world.leveling;
    if (!lv || !n) return 0;
    const s = this.state;
    s.xp += n;
    let gained = 0;
    while (s.xp >= this.xpToNext()) {
      s.xp -= this.xpToNext();
      s.level++;
      gained++;
      s.maxHp += lv.perLevel.maxHp || 0;
      s.maxMp += lv.perLevel.maxMp || 0;
    }
    if (gained) {
      s.hp = s.maxHp;
      s.mp = s.maxMp;
    }
    return gained;
  }

  addItem(id, n = 1) {
    this.state.items[id] = (this.state.items[id] || 0) + n;
  }

  heal(hp = Infinity, mp = Infinity) {
    const s = this.state;
    s.hp = Math.min(s.maxHp, s.hp + hp);
    s.mp = Math.min(s.maxMp, s.mp + mp);
  }

  cycle(listKey, currentKey, dir = 1) {
    const list = this.state[listKey];
    if (!list.length) return null;
    const i = list.indexOf(this.state[currentKey]);
    this.state[currentKey] = list[(i + dir + list.length) % list.length];
    return this.state[currentKey];
  }

  /** Give a reward object: { weapon, spell, item, count, gold, maxHp, maxMp, flag }. Returns message lines. */
  grant(r) {
    const lines = [];
    if (r.weapon) {
      this.addWeapon(r.weapon);
      lines.push(`You got the ${DB.weapons[r.weapon].name}!`);
    }
    if (r.spell) {
      this.addSpell(r.spell);
      lines.push(`You learned ${DB.spells[r.spell].name}!`);
    }
    if (r.tool) {
      this.addSpell(r.tool);
      lines.push(`You got the ${DB.spells[r.tool].name}! Select it with RB, use it with B.`);
    }
    if (r.armor) {
      this.addArmor(r.armor);
      lines.push(`You got ${DB.armor[r.armor].name}!`);
    }
    if (r.item) {
      const n = r.count || 1;
      this.addItem(r.item, n);
      lines.push(`You got ${n > 1 ? n + ' x ' : 'a '}${DB.items[r.item].name}!`);
    }
    if (r.gold) {
      this.state.gold += r.gold;
      lines.push(`You found ${r.gold} gold!`);
    }
    if (r.maxHp) {
      this.state.maxHp += r.maxHp;
      this.state.hp = this.state.maxHp;
      lines.push(`Max HP increased by ${r.maxHp}!`);
    }
    if (r.maxMp) {
      this.state.maxMp += r.maxMp;
      this.state.mp = this.state.maxMp;
      lines.push(`Max MP increased by ${r.maxMp}!`);
    }
    if (r.flag) this.setFlag(r.flag);
    return lines;
  }
}

export const Game = new GameStateManager();
