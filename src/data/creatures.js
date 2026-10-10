// Creature types. Stats scale with level; multipliers tune each type.
// behavior: 'melee' | 'caster' | 'critter'. model: asset slot. loot: table id in loot.js.
export const CREATURES = {
  mudsnapper: {
    name: 'Mudsnapper', model: 'mob_mudsnapper', family: 'Beast', behavior: 'melee',
    hp: 0.95, dmg: 0.9, armor: 1.4, speed: 3.4, attackSpeed: 2.0, reach: 1.6, radius: 0.75, height: 0.9,
    aggro: 10, social: 7, loot: 'mudsnapper', sound: 'crab', xp: 1, tag: 'mudsnapper',
  },
  grandclaw: {
    name: 'Old Grandclaw', model: 'mob_grandclaw', family: 'Beast', behavior: 'melee', elite: true, rare: true,
    hp: 3.4, dmg: 1.5, armor: 2.2, speed: 3.6, attackSpeed: 2.4, reach: 2.8, radius: 1.6, height: 1.8,
    aggro: 14, loot: 'grandclaw', sound: 'crab', xp: 3, tag: 'mudsnapper',
    abilities: [{ id: 'crushing_claw', every: 9, name: 'Crushing Claw', dmg: 2.2, cast: 1.2 }],
  },
  fenstalker: {
    name: 'Fen Stalker', model: 'mob_fenstalker', family: 'Beast', behavior: 'melee',
    hp: 1.0, dmg: 1.1, armor: 0.9, speed: 5.4, attackSpeed: 1.7, reach: 1.9, radius: 0.7, height: 1.2,
    aggro: 15, social: 9, loot: 'stalker', sound: 'growl', xp: 1, tag: 'fenstalker',
    abilities: [{ id: 'pounce', every: 12, name: 'Pounce', dmg: 1.6, range: 12, leap: true }],
  },
  bogling: {
    name: 'Bogling Spearman', model: 'mob_bogling', family: 'Bogling', behavior: 'melee', weapon: 'wpn_spear',
    hp: 1.0, dmg: 1.0, armor: 1.0, speed: 4.6, attackSpeed: 2.0, reach: 2.0, radius: 0.45, height: 1.2,
    aggro: 12, social: 11, flee: 0.18, loot: 'bogling', sound: 'bogling', xp: 1, tag: 'bogling',
  },
  bogling_hexer: {
    name: 'Bogling Hexer', model: 'mob_bogling_hexer', family: 'Bogling', behavior: 'caster', weapon: 'wpn_staff', upright: true,
    hp: 0.8, dmg: 0.6, armor: 0.7, speed: 4.2, attackSpeed: 2.2, reach: 1.8, radius: 0.45, height: 1.2,
    aggro: 16, social: 11, loot: 'bogling', sound: 'bogling', xp: 1.1, tag: 'bogling',
    spells: [{ id: 'swamp_bolt', name: 'Swamp Bolt', school: 'nature', dmg: 1.6, cast: 2.0, range: 26, color: 0x8ad040, every: 0 }],
  },
  grubgut: {
    name: 'Grubgut the Fat', title: 'Chieftain of the Fen', model: 'mob_grubgut', family: 'Bogling', behavior: 'melee', elite: true, weapon: 'wpn_mace',
    hp: 3.2, dmg: 1.45, armor: 1.5, speed: 4.4, attackSpeed: 2.6, reach: 2.4, radius: 0.8, height: 1.7,
    aggro: 14, social: 14, loot: 'grubgut', sound: 'bogling', xp: 3, tag: 'grubgut',
    abilities: [{ id: 'belly_slam', every: 11, name: 'Belly Slam', dmg: 1.4, aoe: 5, cast: 1.5, knock: true }],
  },
  drowned: {
    name: 'Drowned Sailor', model: 'mob_drowned', family: 'Undead', behavior: 'melee', weapon: 'wpn_sword',
    hp: 1.15, dmg: 1.05, armor: 1.1, speed: 3.6, attackSpeed: 2.2, reach: 2.0, radius: 0.45, height: 1.8,
    aggro: 11, social: 9, loot: 'drowned', sound: 'drowned', xp: 1.1, tag: 'drowned',
  },
  cultist: {
    name: 'Drowned Eye Zealot', model: 'mob_cultist', family: 'Humanoid', behavior: 'melee', weapon: 'wpn_sword',
    hp: 1.05, dmg: 1.1, armor: 1.1, speed: 4.8, attackSpeed: 2.2, reach: 2.0, radius: 0.45, height: 1.8,
    aggro: 14, social: 12, loot: 'cultist', sound: 'cultist', xp: 1.1, tag: 'cultist',
  },
  cult_adept: {
    name: 'Drowned Eye Adept', model: 'mob_cult_adept', family: 'Humanoid', behavior: 'caster', weapon: 'wpn_staff', upright: true,
    hp: 0.9, dmg: 0.7, armor: 0.8, speed: 4.4, attackSpeed: 2.4, reach: 1.8, radius: 0.45, height: 1.8,
    aggro: 18, social: 12, loot: 'adept', sound: 'cultist', xp: 1.2, tag: 'cultist',
    spells: [
      { id: 'shadow_bolt', name: 'Brine Bolt', school: 'shadow', dmg: 1.7, cast: 2.0, range: 28, color: 0x40d0d0 },
      { id: 'mend', name: 'Tidal Mending', school: 'shadow', heal: 0.25, cast: 2.5, every: 14, self: true },
    ],
  },
  morwen: {
    name: 'Sister Morwen', title: 'Voice of the Deep', model: 'mob_morwen', family: 'Humanoid', behavior: 'caster', boss: true, elite: true,
    weapon: 'wpn_tidecaller', upright: true,
    hp: 6.5, dmg: 1.3, armor: 1.4, speed: 4.6, attackSpeed: 2.0, reach: 2.2, radius: 0.6, height: 2.15,
    aggro: 22, loot: 'morwen', sound: 'morwen', xp: 5, tag: 'morwen', noLeash: false, leash: 40,
    spells: [
      { id: 'abyssal_bolt', name: 'Abyssal Bolt', school: 'shadow', dmg: 1.6, cast: 2.0, range: 30, color: 0x40e8ff },
    ],
    phases: true,
  },
  darro: {
    name: 'Darro Vex', model: 'npc_darro', family: 'Humanoid', behavior: 'melee', weapon: 'wpn_dagger',
    hp: 2.4, dmg: 1.1, armor: 1.0, speed: 5.2, attackSpeed: 1.6, reach: 2.0, radius: 0.45, height: 1.8,
    aggro: 30, loot: null, sound: 'cultist', xp: 1.5, tag: 'darro', surrender: 0.25, noRespawn: true,
  },
  deepspawn: {
    name: 'Deepspawn', model: 'mob_deepspawn', family: 'Aberration', behavior: 'melee',
    hp: 0.55, dmg: 0.8, armor: 0.6, speed: 3.6, attackSpeed: 1.8, reach: 2.0, radius: 0.7, height: 1.4,
    aggro: 40, loot: null, sound: 'deep', xp: 0.3, tag: 'deepspawn',
  },
};

// Base numbers per level (before multipliers).
export const levelHp = (l) => 42 + 24 * (l - 1);
export const levelDmg = (l) => 4.2 + 2.3 * (l - 1);
export const levelArmor = (l) => 12 + 9 * l;
export const levelXp = (l) => 45 + 10 * l;
