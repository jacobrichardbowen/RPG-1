// Player character sheet: attributes, derived stats, experience, inventory and equipment.
import { CLASSES, XP_TABLE, MAX_LEVEL, ABILITY_LEVELS } from '../data/classes.js';
import { RACES } from '../assets/placeholders/characters.js';
import { ITEMS } from '../data/items.js';

export const BAG_SIZE = 28;
export const ATTRS = ['str', 'agi', 'int', 'end'];
export const ATTR_NAMES = { str: 'Strength', agi: 'Agility', int: 'Intellect', end: 'Endurance' };
export const ATTR_HELP = {
  str: 'Increases damage with swords, axes and maces, and maximum stamina.',
  agi: 'Increases damage with daggers, critical strike and dodge chance, and armor.',
  int: 'Increases spell power and maximum mana.',
  end: 'Increases maximum health and stamina.',
};

export class CharacterSheet {
  constructor(data) {
    this.name = data.name || 'Stranger';
    this.race = data.race || 'westerling';
    this.cls = data.cls || 'warrior';
    this.look = data.look || {};
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.alloc = data.alloc || { str: 0, agi: 0, int: 0, end: 0 };
    this.points = data.points || 0;
    this.gold = data.gold ?? 0;
    this.bags = data.bags || new Array(BAG_SIZE).fill(null);
    while (this.bags.length < BAG_SIZE) this.bags.push(null);
    this.equip = data.equip || {};
    this.bar = data.bar || null; // action bar slots
    this.kills = data.kills || 0;
    this.deaths = data.deaths || 0;
    this.listeners = new Set();
    this.buffStats = { str: 0, agi: 0, int: 0, end: 0 };
    this.recompute();
  }

  get clsDef() { return CLASSES[this.cls]; }
  get raceDef() { return RACES[this.race]; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed(what) { this.recompute(); for (const fn of this.listeners) fn(what); }

  // ------------------------------------------------------------------ stats
  recompute() {
    const c = this.clsDef, r = this.raceDef;
    const a = {};
    for (const k of ATTRS) {
      a[k] = c.base[k] + c.growth[k] * (this.level - 1) + (r.stats[k] || 0) + (this.alloc[k] || 0) + (this.buffStats[k] || 0);
    }
    let armor = 0;
    for (const id of Object.values(this.equip)) {
      const it = ITEMS[id];
      if (!it) continue;
      armor += it.armor || 0;
      for (const [k, v] of Object.entries(it.stats || {})) if (k in a) a[k] += v;
    }
    armor += a.agi * 2;
    this.attrs = a;
    this.armor = armor;
    this.maxHp = Math.round((c.hpBase + a.end * 6 + (this.level - 1) * 14) * (this.race === 'tuskari' ? 1.1 : 1));
    this.maxMana = c.manaPerInt > 0 ? Math.round(a.int * c.manaPerInt + this.level * 8) : 0;
    this.maxSt = Math.round(80 + a.end * 2 + a.agi * 1.5 + a.str * 1 + this.level * 4);
    this.spellPower = Math.round(a.int * 0.9 + this.level * 1.5);
    this.crit = 0.05 + a.agi * 0.0016;
    this.dodge = 0.03 + a.agi * 0.0011;
    const w = ITEMS[this.equip.mainhand];
    if (w && w.type === 'weapon') {
      this.weapon = { dmg: w.dmg, speed: w.speed, wtype: w.wtype };
    } else {
      this.weapon = { dmg: [1, 3], speed: 2.0, wtype: 'fist' };
    }
    const stat = this.weapon.wtype === 'dagger' ? a.agi : this.weapon.wtype === 'staff' ? (a.str + a.int) * 0.5 : a.str;
    this.weaponBonus = stat * (this.cls === 'warrior' ? 0.27 : 0.22) * this.weapon.speed;
  }

  weaponRoll() {
    const [lo, hi] = this.weapon.dmg;
    return lo + Math.random() * (hi - lo) + this.weaponBonus;
  }

  // ------------------------------------------------------------------ experience
  xpToNext() { return this.level >= MAX_LEVEL ? 0 : XP_TABLE[this.level + 1]; }

  // Returns number of levels gained.
  addXp(amount) {
    if (this.level >= MAX_LEVEL) return 0;
    if (this.race === 'westerling') amount = Math.round(amount * 1.1);
    this.xp += amount;
    let gained = 0;
    while (this.level < MAX_LEVEL && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level++;
      this.points += 2;
      gained++;
    }
    if (this.level >= MAX_LEVEL) this.xp = 0;
    this.changed('xp');
    return gained;
  }

  spendPoint(attr) {
    if (this.points <= 0) return false;
    this.points--;
    this.alloc[attr] = (this.alloc[attr] || 0) + 1;
    this.changed('stats');
    return true;
  }

  knownAbilities() {
    return this.clsDef.abilities.filter((_, i) => this.level >= ABILITY_LEVELS[i]);
  }

  // ------------------------------------------------------------------ inventory
  count(id) {
    let n = 0;
    for (const s of this.bags) if (s && s.id === id) n += s.count;
    return n;
  }
  has(id, n = 1) { return this.count(id) >= n || Object.values(this.equip).includes(id); }

  freeSlots() { return this.bags.filter((s) => !s).length; }

  canAdd(id, n = 1) {
    const def = ITEMS[id];
    const stack = def.stack || 1;
    let room = 0;
    for (const s of this.bags) {
      if (!s) room += stack;
      else if (s.id === id && stack > 1) room += stack - s.count;
      if (room >= n) return true;
    }
    return room >= n;
  }

  // Adds as many as fit; returns how many were added.
  add(id, n = 1) {
    const def = ITEMS[id];
    if (!def) return 0;
    const stack = def.stack || 1;
    let left = n;
    if (stack > 1) {
      for (const s of this.bags) {
        if (left <= 0) break;
        if (s && s.id === id && s.count < stack) {
          const k = Math.min(stack - s.count, left);
          s.count += k; left -= k;
        }
      }
    }
    for (let i = 0; i < this.bags.length && left > 0; i++) {
      if (!this.bags[i]) {
        const k = Math.min(stack, left);
        this.bags[i] = { id, count: k };
        left -= k;
      }
    }
    if (left !== n) this.changed('bags');
    return n - left;
  }

  remove(id, n = 1) {
    let left = n;
    for (let i = this.bags.length - 1; i >= 0 && left > 0; i--) {
      const s = this.bags[i];
      if (s && s.id === id) {
        const k = Math.min(s.count, left);
        s.count -= k; left -= k;
        if (s.count <= 0) this.bags[i] = null;
      }
    }
    if (left !== n) this.changed('bags');
    return n - left;
  }

  removeAt(i, n = 1) {
    const s = this.bags[i];
    if (!s) return null;
    const k = Math.min(n, s.count);
    s.count -= k;
    const out = { id: s.id, count: k };
    if (s.count <= 0) this.bags[i] = null;
    this.changed('bags');
    return out;
  }

  moveSlot(from, to) {
    if (from === to) return;
    const a = this.bags[from], b = this.bags[to];
    if (a && b && a.id === b.id && (ITEMS[a.id].stack || 1) > 1) {
      const stack = ITEMS[a.id].stack;
      const k = Math.min(stack - b.count, a.count);
      b.count += k; a.count -= k;
      if (a.count <= 0) this.bags[from] = null;
    } else {
      this.bags[from] = b;
      this.bags[to] = a;
    }
    this.changed('bags');
  }

  canEquip(id) {
    const it = ITEMS[id];
    if (!it || !it.slot) return { ok: false, why: 'That cannot be equipped.' };
    if (it.type === 'weapon' && !this.clsDef.weapons.includes(it.wtype)) {
      return { ok: false, why: `A ${this.clsDef.name} cannot wield a ${it.wtype}.` };
    }
    if (it.slot === 'offhand') {
      const main = ITEMS[this.equip.mainhand];
      if (main && main.twoHand) return { ok: false, why: 'Your weapon needs both hands.' };
      if (!this.clsDef.shield) return { ok: false, why: `A ${this.clsDef.name} cannot use shields.` };
    }
    return { ok: true };
  }

  // Equip from bag index. Returns an error string or null.
  equipFromBag(i) {
    const s = this.bags[i];
    if (!s) return null;
    const chk = this.canEquip(s.id);
    if (!chk.ok) return chk.why;
    const it = ITEMS[s.id];
    const prev = this.equip[it.slot];
    this.bags[i] = prev ? { id: prev, count: 1 } : null;
    this.equip[it.slot] = s.id;
    if (it.twoHand && this.equip.offhand) {
      const off = this.equip.offhand;
      delete this.equip.offhand;
      if (!this.add(off, 1)) { this.equip.offhand = off; }
    }
    this.changed('equip');
    return null;
  }

  unequip(slot) {
    const id = this.equip[slot];
    if (!id) return null;
    if (this.freeSlots() <= 0) return 'Your bags are full.';
    delete this.equip[slot];
    this.add(id, 1);
    this.changed('equip');
    return null;
  }

  serialize() {
    return {
      name: this.name, race: this.race, cls: this.cls, look: this.look, level: this.level, xp: this.xp,
      alloc: this.alloc, points: this.points, gold: this.gold, bags: this.bags, equip: this.equip, bar: this.bar,
      kills: this.kills, deaths: this.deaths,
    };
  }
}
