// Classes and their abilities. Each ability gets an icon slot "icon_ab_<id>".
// cost: { mana, st }  cd: cooldown seconds  cast: cast time (0 = instant)  range: meters or 'melee'
// effects are executed in order by game/abilities.js.

export const CLASSES = {
  warrior: {
    name: 'Warrior', resource: 'stamina',
    blurb: 'A shield-bearing brawler. Shrugs off blows, carves through crowds and never runs out of fight.',
    base: { str: 14, agi: 10, int: 6, end: 13 }, growth: { str: 2, agi: 1, int: 0, end: 2 },
    hpBase: 55, manaPerInt: 0, weapons: ['sword', 'axe', 'mace', 'dagger'], shield: true,
    start: ['rusty_sword', 'battered_buckler', 'prisoner_rags', 'rope_sandals'],
    abilities: ['cleave', 'concussive_bash', 'charge', 'whirlwind', 'second_wind', 'executioner'],
  },
  mage: {
    name: 'Mage', resource: 'mana',
    blurb: 'A scholar of fire and frost. Fragile up close, devastating from afar.',
    base: { str: 6, agi: 9, int: 16, end: 10 }, growth: { str: 0, agi: 1, int: 3, end: 1 },
    hpBase: 35, manaPerInt: 6, weapons: ['staff', 'dagger'], shield: false,
    start: ['driftwood_staff', 'prisoner_rags', 'rope_sandals'],
    abilities: ['firebolt', 'frost_lance', 'counterspell', 'frost_nova', 'arcane_ward', 'pyroclasm'],
  },
  nightblade: {
    name: 'Nightblade', resource: 'stamina',
    blurb: 'A quick-handed duelist who mixes poison and shadow. Strikes hard, then vanishes.',
    base: { str: 9, agi: 15, int: 9, end: 11 }, growth: { str: 1, agi: 3, int: 1, end: 1 },
    hpBase: 45, manaPerInt: 2.5, weapons: ['dagger', 'sword'], shield: false,
    start: ['chipped_dagger', 'prisoner_rags', 'rope_sandals'],
    abilities: ['twin_fangs', 'throwing_knife', 'gouge', 'venom_edge', 'shadowstep', 'eviscerate'],
  },
};

export const XP_TABLE = [0, 0, 420, 1050, 1900, 3000, 4400]; // XP needed to reach level n from n-1
export const MAX_LEVEL = 6;
export const ABILITY_LEVELS = [1, 1, 2, 3, 4, 5];

export const ABILITIES = {
  // ------------------------------------------------------------------ warrior
  cleave: {
    name: 'Cleave', cls: 'warrior', cost: { st: 12 }, cd: 3, range: 'melee', target: 'enemy', anim: 'slash', sound: 'swing',
    desc: 'A heavy swing dealing 160% weapon damage to your target and 70% to one other nearby enemy.',
    effects: [{ type: 'weapon', mult: 1.6 }, { type: 'cleave', mult: 0.7, radius: 4.5, count: 1 }], icon: ['slash', 0xd08040],
  },
  concussive_bash: {
    name: 'Concussive Bash', cls: 'warrior', cost: { st: 18 }, cd: 12, range: 'melee', target: 'enemy', anim: 'stab', sound: 'bash',
    desc: 'Slam your target with your shield or pommel, dealing 60% weapon damage, interrupting spellcasting and stunning for 2 sec.',
    effects: [{ type: 'weapon', mult: 0.6 }, { type: 'interrupt' }, { type: 'stun', dur: 2 }], icon: ['shield', 0xb0b0c0],
  },
  charge: {
    name: 'Charge', cls: 'warrior', cost: { st: 0 }, cd: 15, range: 25, minRange: 7, target: 'enemy', anim: 'slash', sound: 'charge', offGcd: true, combatOk: false,
    desc: 'Rush at an enemy 7 to 25 m away, stunning it for 1 sec and restoring 20 stamina. Cannot be used in combat.',
    effects: [{ type: 'charge', stun: 1 }, { type: 'restore', st: 20 }], icon: ['charge', 0xe0a040],
  },
  whirlwind: {
    name: 'Whirlwind', cls: 'warrior', cost: { st: 28 }, cd: 9, range: 0, target: 'none', anim: 'overhead', sound: 'whirl',
    desc: 'Spin with your weapon, striking every enemy within 6 m for 90% weapon damage.',
    effects: [{ type: 'aoe', radius: 6, center: 'self', effects: [{ type: 'weapon', mult: 0.9 }] }, { type: 'fx', fx: 'ring', color: 0xe0c080, radius: 6 }], icon: ['whirl', 0xd0a060],
  },
  second_wind: {
    name: 'Second Wind', cls: 'warrior', cost: { st: 0 }, cd: 45, range: 0, target: 'self', anim: 'cheer', sound: 'heal', offGcd: true,
    desc: 'Catch your breath, healing 35% of your maximum health over 6 sec.',
    effects: [{ type: 'hot', pct: 0.35, dur: 6, id: 'second_wind', name: 'Second Wind' }], icon: ['heart', 0xe05050],
  },
  executioner: {
    name: "Executioner's Strike", cls: 'warrior', cost: { st: 22 }, cd: 6, range: 'melee', target: 'enemy', anim: 'overhead', sound: 'heavy',
    desc: 'A brutal blow for 180% weapon damage. Deals double damage to enemies below 30% health.',
    effects: [{ type: 'weapon', mult: 1.8, execute: 0.3 }], icon: ['axe', 0xc03030],
  },

  // ------------------------------------------------------------------ mage
  firebolt: {
    name: 'Firebolt', cls: 'mage', cost: { mana: 14 }, cd: 0, cast: 1.6, range: 32, target: 'enemy', anim: 'cast', sound: 'fire',
    desc: 'Hurl a bolt of flame for 14 to 19 fire damage, plus 85% of your spell power.',
    effects: [{ type: 'projectile', color: 0xff7a20, speed: 30, size: 0.35, onHit: [{ type: 'spell', base: [14, 19], coef: 0.85, school: 'fire' }] }], icon: ['flame', 0xff7a20],
  },
  frost_lance: {
    name: 'Frost Lance', cls: 'mage', cost: { mana: 12 }, cd: 5, cast: 0, range: 30, target: 'enemy', anim: 'cast', sound: 'frost',
    desc: 'Instantly fling a shard of ice for 9 to 12 frost damage, plus 50% of spell power, slowing the target by 50% for 4 sec.',
    effects: [{ type: 'projectile', color: 0x9ae0ff, speed: 40, size: 0.25, onHit: [{ type: 'spell', base: [9, 12], coef: 0.5, school: 'frost' }, { type: 'slow', pct: 0.5, dur: 4 }] }], icon: ['shard', 0x9ae0ff],
  },
  counterspell: {
    name: 'Counterspell', cls: 'mage', cost: { mana: 10 }, cd: 15, cast: 0, range: 30, target: 'enemy', anim: 'cast', sound: 'arcane', offGcd: true,
    desc: "Shatter your target's concentration, interrupting its spell and silencing it for 3 sec.",
    effects: [{ type: 'interrupt', silence: 3 }, { type: 'fx', fx: 'burst', color: 0xc080ff, at: 'target' }], icon: ['rune', 0xc080ff],
  },
  frost_nova: {
    name: 'Frost Nova', cls: 'mage', cost: { mana: 22 }, cd: 20, cast: 0, range: 0, target: 'none', anim: 'cast', sound: 'frost',
    desc: 'Blast the ground with frost, dealing 8 frost damage to enemies within 8 m and freezing them in place for 4 sec.',
    effects: [{ type: 'aoe', radius: 8, center: 'self', effects: [{ type: 'spell', base: [7, 9], coef: 0.2, school: 'frost' }, { type: 'root', dur: 4 }] }, { type: 'fx', fx: 'ring', color: 0x9ae0ff, radius: 8 }], icon: ['snow', 0xb0f0ff],
  },
  arcane_ward: {
    name: 'Arcane Ward', cls: 'mage', cost: { mana: 26 }, cd: 25, cast: 0, range: 0, target: 'self', anim: 'cast', sound: 'arcane', offGcd: true,
    desc: 'Surround yourself with a ward that absorbs 40 damage, plus 150% of spell power. Lasts 20 sec.',
    effects: [{ type: 'shield', base: 40, coef: 1.5, dur: 20, id: 'arcane_ward', name: 'Arcane Ward' }], icon: ['ward', 0xc080ff],
  },
  pyroclasm: {
    name: 'Pyroclasm', cls: 'mage', cost: { mana: 38 }, cd: 10, cast: 2.4, range: 32, target: 'enemy', anim: 'cast', sound: 'fire',
    desc: 'Call down a column of fire on your target, dealing 26 to 34 fire damage plus 110% spell power to it and all enemies within 5 m.',
    effects: [{ type: 'aoe', radius: 5, center: 'target', effects: [{ type: 'spell', base: [26, 34], coef: 1.1, school: 'fire' }] }, { type: 'fx', fx: 'pillar', color: 0xff6a10, at: 'target', radius: 5 }], icon: ['meteor', 0xff5010],
  },

  // ------------------------------------------------------------------ nightblade
  twin_fangs: {
    name: 'Twin Fangs', cls: 'nightblade', cost: { st: 14 }, cd: 0, range: 'melee', target: 'enemy', anim: 'stab', sound: 'swing',
    desc: 'Strike twice in quick succession, each blow dealing 80% weapon damage.',
    effects: [{ type: 'weapon', mult: 0.8 }, { type: 'weapon', mult: 0.8, delay: 0.18 }], icon: ['fangs', 0xd0d0e0],
  },
  throwing_knife: {
    name: 'Throwing Knife', cls: 'nightblade', cost: { st: 10 }, cd: 4, range: 22, target: 'enemy', anim: 'cast', sound: 'throw',
    desc: 'Throw a knife at an enemy up to 22 m away for 70% weapon damage. Good for luring foes one at a time.',
    effects: [{ type: 'projectile', color: 0xd0d8e0, speed: 38, size: 0.15, knife: true, onHit: [{ type: 'weapon', mult: 0.7, ranged: true }] }], icon: ['knife', 0xc0c8d0],
  },
  gouge: {
    name: 'Gouge', cls: 'nightblade', cost: { st: 16 }, cd: 14, range: 'melee', target: 'enemy', anim: 'stab', sound: 'bash',
    desc: 'A dirty strike to the eyes: 40% weapon damage, interrupts spellcasting and stuns the target for 3 sec.',
    effects: [{ type: 'weapon', mult: 0.4 }, { type: 'interrupt' }, { type: 'stun', dur: 3 }], icon: ['eye', 0xd0a0a0],
  },
  venom_edge: {
    name: 'Venom Edge', cls: 'nightblade', cost: { st: 18 }, cd: 10, range: 'melee', target: 'enemy', anim: 'slash', sound: 'swing',
    desc: 'Slash with a poisoned blade for 60% weapon damage, then 6 nature damage plus 15% of agility every 2 sec for 12 sec.',
    effects: [{ type: 'weapon', mult: 0.6 }, { type: 'dot', base: 6, coef: 0.15, stat: 'agi', interval: 2, dur: 12, school: 'nature', id: 'venom', name: 'Venom' }], icon: ['drop', 0x70d040],
  },
  shadowstep: {
    name: 'Shadowstep', cls: 'nightblade', cost: { mana: 15 }, cd: 18, range: 25, target: 'enemy', anim: 'cast', sound: 'shadow', offGcd: true,
    desc: 'Step through the shadows to appear behind your target. Your next attack within 5 sec deals 50% more damage.',
    effects: [{ type: 'shadowstep' }, { type: 'buff', id: 'shadow_focus', name: 'Shadow Focus', dmgPct: 0.5, dur: 5, consume: true }], icon: ['step', 0x8060c0],
  },
  eviscerate: {
    name: 'Eviscerate', cls: 'nightblade', cost: { st: 30 }, cd: 8, range: 'melee', target: 'enemy', anim: 'overhead', sound: 'heavy',
    desc: 'A finishing cut for 220% weapon damage plus 60% of agility. Critical strikes are twice as likely.',
    effects: [{ type: 'weapon', mult: 2.2, statBonus: 'agi', statCoef: 0.6, critBonus: 0.15 }], icon: ['slash', 0xe04040],
  },
};

// Auto-attack range for melee (edge to edge, meters).
export const MELEE_RANGE = 2.2;
export const GCD = 1.2;

for (const [id, a] of Object.entries(ABILITIES)) a.id = id;
