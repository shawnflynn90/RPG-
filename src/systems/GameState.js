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
    flags: {},
    respawn: { map: DB.world.start.map, spawn: DB.world.start.spawn },
    playTimeMs: 0,
    savedAt: null,
  };
}

/** Upgrade old saves here when the save format changes (bump SAVE.version). */
function migrate(data) {
  const fresh = freshState();
  return { ...fresh, ...data, version: SAVE.version };
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
    return true;
  }

  addWeapon(id) {
    if (!this.state.weapons.includes(id)) this.state.weapons.push(id);
    if (!this.state.weapon) this.state.weapon = id;
  }

  addSpell(id) {
    if (!this.state.spells.includes(id)) this.state.spells.push(id);
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
