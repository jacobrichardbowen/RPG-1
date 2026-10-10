// Item database. Each item gets an icon slot "icon_<id>" you can override with a PNG.
// quality: poor | common | uncommon | rare | epic | quest
// stats: str (strength), agi (agility), int (intellect), end (endurance), armor
export const ITEMS = {
  // ------------------------------------------------------------------ starting gear
  rusty_sword: { name: 'Rusty Shortsword', type: 'weapon', slot: 'mainhand', wtype: 'sword', quality: 'poor', dmg: [3, 6], speed: 2.2, value: 3, model: 'wpn_sword', icon: ['sword', 0x8a7a6a] },
  driftwood_staff: { name: 'Driftwood Staff', type: 'weapon', slot: 'mainhand', wtype: 'staff', twoHand: true, quality: 'poor', dmg: [4, 8], speed: 3.0, stats: { int: 2 }, value: 3, model: 'wpn_staff', icon: ['staff', 0x9a8a6a] },
  chipped_dagger: { name: 'Chipped Dagger', type: 'weapon', slot: 'mainhand', wtype: 'dagger', quality: 'poor', dmg: [2, 4], speed: 1.5, stats: { agi: 1 }, value: 3, model: 'wpn_dagger', icon: ['dagger', 0x8a8a8a] },
  battered_buckler: { name: 'Battered Buckler', type: 'armor', slot: 'offhand', quality: 'poor', armor: 8, value: 2, model: 'wpn_shield', icon: ['shield', 0x7a5a3a] },
  prisoner_rags: { name: "Prisoner's Rags", type: 'armor', slot: 'chest', quality: 'poor', armor: 2, value: 1, icon: ['chest', 0x8a7a62], tint: 0x8a7a62 },
  rope_sandals: { name: 'Rope Sandals', type: 'armor', slot: 'feet', quality: 'poor', armor: 1, value: 1, icon: ['boots', 0x9a8a6a] },

  // ------------------------------------------------------------------ vendor gear
  iron_sword: { name: 'Iron Arming Sword', type: 'weapon', slot: 'mainhand', wtype: 'sword', quality: 'common', dmg: [6, 10], speed: 2.4, stats: { str: 1 }, value: 28, model: 'wpn_sword', icon: ['sword', 0xb8c0c8] },
  hand_axe: { name: 'Woodsman Hatchet', type: 'weapon', slot: 'mainhand', wtype: 'axe', quality: 'common', dmg: [7, 12], speed: 2.7, stats: { str: 1 }, value: 26, model: 'wpn_axe', icon: ['axe', 0xa0a8b0] },
  iron_mace: { name: 'Iron Cudgel', type: 'weapon', slot: 'mainhand', wtype: 'mace', quality: 'common', dmg: [6, 11], speed: 2.6, stats: { end: 1 }, value: 26, model: 'wpn_mace', icon: ['mace', 0x9a9aa0] },
  steel_dagger: { name: 'Steel Dirk', type: 'weapon', slot: 'mainhand', wtype: 'dagger', quality: 'common', dmg: [4, 7], speed: 1.6, stats: { agi: 1 }, value: 26, model: 'wpn_dagger', icon: ['dagger', 0xc8d0d8] },
  apprentice_staff: { name: "Apprentice's Rod", type: 'weapon', slot: 'mainhand', wtype: 'staff', twoHand: true, quality: 'common', dmg: [7, 12], speed: 3.0, stats: { int: 3 }, value: 30, model: 'wpn_staff', icon: ['staff', 0x60a0e0] },
  wooden_shield: { name: 'Oak Roundshield', type: 'armor', slot: 'offhand', quality: 'common', armor: 16, value: 18, model: 'wpn_shield', icon: ['shield', 0x8a6a4a] },
  padded_jerkin: { name: 'Padded Jerkin', type: 'armor', slot: 'chest', quality: 'common', armor: 10, stats: { end: 1 }, value: 20, icon: ['chest', 0x8a6a4a], tint: 0x7a5a3e },
  wool_robe: { name: 'Wool Robe', type: 'armor', slot: 'chest', quality: 'common', armor: 5, stats: { int: 1, end: 1 }, value: 20, icon: ['chest', 0x5a5a8a], tint: 0x4a4a7a },
  leather_cap: { name: 'Leather Cap', type: 'armor', slot: 'head', quality: 'common', armor: 4, value: 10, icon: ['helm', 0x7a5a3a] },
  leather_boots: { name: 'Leather Boots', type: 'armor', slot: 'feet', quality: 'common', armor: 4, value: 10, icon: ['boots', 0x6a4a2a] },
  linen_trousers: { name: 'Linen Trousers', type: 'armor', slot: 'legs', quality: 'common', armor: 4, value: 10, icon: ['legs', 0xb0a080] },
  wool_gloves: { name: 'Wool Gloves', type: 'armor', slot: 'hands', quality: 'common', armor: 2, value: 6, icon: ['gloves', 0x8a8a6a] },

  // ------------------------------------------------------------------ consumables
  minor_healing: { name: 'Minor Healing Draught', type: 'consumable', quality: 'common', stack: 10, value: 6, use: { heal: 60 }, cooldown: 30, icon: ['potion', 0xd03030], desc: 'Restores 60 health.' },
  healing_draught: { name: 'Healing Draught', type: 'consumable', quality: 'common', stack: 10, value: 16, use: { heal: 140 }, cooldown: 30, icon: ['potion_big', 0xe03838], desc: 'Restores 140 health.' },
  minor_mana: { name: 'Minor Mana Draught', type: 'consumable', quality: 'common', stack: 10, value: 6, use: { mana: 70 }, cooldown: 30, icon: ['potion', 0x3060e0], desc: 'Restores 70 mana.' },
  stamina_tonic: { name: 'Stamina Tonic', type: 'consumable', quality: 'common', stack: 10, value: 5, use: { stamina: 80 }, cooldown: 20, icon: ['potion', 0x40a040], desc: 'Restores 80 stamina.' },
  bread: { name: 'Brown Bread', type: 'consumable', quality: 'common', stack: 20, value: 1, use: { food: 30, duration: 15 }, icon: ['bread', 0xb08040], desc: 'Restores 30 health over 15 sec. Must remain out of combat.' },
  fried_snapper: { name: 'Fried Snapper Leg', type: 'consumable', quality: 'common', stack: 20, value: 3, use: { food: 80, duration: 18 }, icon: ['meat', 0xd06040], desc: 'Restores 80 health over 18 sec. Must remain out of combat.' },
  fish_stew: { name: 'Brackwater Fish Stew', type: 'consumable', quality: 'uncommon', stack: 20, value: 5, use: { food: 120, duration: 18, buff: { id: 'well_fed', name: 'Well Fed', stats: { end: 2 }, duration: 600 } }, icon: ['bowl', 0xc09050], desc: 'Restores 120 health over 18 sec. If you eat for 10 sec you become Well Fed (+2 Endurance for 10 min).' },
  brackwater_ale: { name: 'Brackwater Ale', type: 'consumable', quality: 'common', stack: 20, value: 2, use: { stamina: 50, tipsy: 60 }, icon: ['mug', 0xc0a040], desc: 'Restores 50 stamina. Makes the world a little wobbly.' },
  scroll_skyleap: { name: 'Scroll of Skyleap', type: 'consumable', quality: 'uncommon', stack: 5, value: 25, use: { buff: { id: 'skyleap', name: 'Skyleap', jump: 7, duration: 8 } }, icon: ['scroll', 0x8a5aff], desc: 'Your jumps soar to tremendous heights for 8 sec. Landing is your own concern.' },
  scroll_featherfall: { name: 'Scroll of Featherfall', type: 'consumable', quality: 'uncommon', stack: 5, value: 25, use: { buff: { id: 'featherfall', name: 'Featherfall', featherfall: true, duration: 20 } }, icon: ['scroll', 0x5ad0ff], desc: 'You take no damage from falling for 20 sec.' },

  // ------------------------------------------------------------------ loot & junk
  snapper_claw: { name: 'Snapper Claw', type: 'junk', quality: 'poor', stack: 20, value: 2, icon: ['claw', 0xa04a2a] },
  snapper_meat: { name: 'Stringy Snapper Meat', type: 'junk', quality: 'poor', stack: 20, value: 1, icon: ['meat', 0xc08070], desc: 'Tough, but Bram at the tavern might fry it for you.' },
  cracked_pearl: { name: 'Cracked Pearl', type: 'junk', quality: 'common', stack: 10, value: 12, icon: ['pearl', 0xe8e0f0] },
  stalker_hide: { name: 'Fen Stalker Hide', type: 'junk', quality: 'poor', stack: 10, value: 4, icon: ['hide', 0x6a7a4a] },
  stalker_fang: { name: 'Curved Fang', type: 'junk', quality: 'poor', stack: 20, value: 3, icon: ['fang', 0xe8e0c8] },
  bogling_trinket: { name: 'Bogling Knucklebone', type: 'junk', quality: 'poor', stack: 20, value: 2, icon: ['bone', 0xd8d0b0] },
  moldy_bread: { name: 'Moldy Bread', type: 'junk', quality: 'poor', stack: 20, value: 0, icon: ['bread', 0x7a8a50] },
  sea_glass: { name: 'Sea Glass', type: 'junk', quality: 'common', stack: 20, value: 5, icon: ['gem', 0x70c0b0] },
  waterlogged_coin: { name: 'Waterlogged Crown', type: 'junk', quality: 'poor', stack: 50, value: 4, icon: ['coin', 0xb0a060] },
  cult_sigil: { name: 'Tarnished Eye Sigil', type: 'junk', quality: 'common', stack: 20, value: 7, icon: ['amulet', 0x40d0d0] },

  // ------------------------------------------------------------------ uncommon & rare drops
  bogwalker_boots: { name: 'Bogwalker Boots', type: 'armor', slot: 'feet', quality: 'uncommon', armor: 6, stats: { agi: 2, end: 1 }, value: 22, icon: ['boots', 0x5a6a3a] },
  hexer_charm: { name: "Hexer's Charm", type: 'armor', slot: 'neck', quality: 'uncommon', stats: { int: 2, end: 1 }, value: 24, icon: ['amulet', 0xa070ff] },
  barnacled_ring: { name: 'Barnacled Ring', type: 'armor', slot: 'ring', quality: 'uncommon', stats: { str: 2, end: 1 }, value: 26, icon: ['ring', 0x9ab0a0] },
  tidewrack_gauntlets: { name: 'Tidewrack Gauntlets', type: 'armor', slot: 'hands', quality: 'uncommon', armor: 8, stats: { str: 1, end: 2 }, value: 24, icon: ['gloves', 0x5a7a7a] },
  zealot_wrap: { name: "Zealot's Wrap", type: 'armor', slot: 'chest', quality: 'uncommon', armor: 9, stats: { agi: 2, int: 1, end: 1 }, value: 30, icon: ['chest', 0x1d4444], tint: 0x1d4444 },
  stalker_leggings: { name: 'Stalkerhide Leggings', type: 'armor', slot: 'legs', quality: 'uncommon', armor: 8, stats: { agi: 2, end: 1 }, value: 24, icon: ['legs', 0x5a6a4a] },
  grandclaw_carapace: { name: 'Grandclaw Carapace', type: 'armor', slot: 'offhand', quality: 'rare', armor: 32, stats: { end: 3, str: 1 }, value: 60, model: 'wpn_snapper_buckler', icon: ['shield', 0x8a5a5a] },
  pearl_of_the_deep: { name: 'Pearl of the Deep', type: 'armor', slot: 'ring', quality: 'rare', stats: { int: 3, agi: 2, end: 1 }, value: 60, icon: ['ring', 0xe0f0ff] },
  fenking_cudgel: { name: "Fen-King's Cudgel", type: 'weapon', slot: 'mainhand', wtype: 'mace', quality: 'rare', dmg: [10, 17], speed: 2.8, stats: { str: 3, end: 2 }, value: 70, model: 'wpn_mace', icon: ['mace', 0x6a8a4a] },
  grubgut_bellyplate: { name: "Grubgut's Belly-Plate", type: 'armor', slot: 'chest', quality: 'rare', armor: 24, stats: { str: 2, end: 3 }, value: 70, icon: ['chest', 0x7a7a5a], tint: 0x6a6a50 },
  morwen_crown: { name: "Morwen's Coral Crown", type: 'armor', slot: 'head', quality: 'epic', armor: 14, stats: { int: 5, end: 3, agi: 2 }, value: 150, icon: ['crown', 0x40e0d0] },

  // ------------------------------------------------------------------ quest rewards
  snapper_buckler: { name: 'Snapper-shell Buckler', type: 'armor', slot: 'offhand', quality: 'uncommon', armor: 22, stats: { end: 2 }, value: 30, model: 'wpn_snapper_buckler', icon: ['shield', 0xa85a3a] },
  tideworn_boots: { name: 'Tideworn Boots', type: 'armor', slot: 'feet', quality: 'uncommon', armor: 7, stats: { agi: 2, end: 1 }, value: 30, icon: ['boots', 0x4a6a7a] },
  fisher_cap: { name: "Fisher's Cap", type: 'armor', slot: 'head', quality: 'uncommon', armor: 5, stats: { int: 2, end: 1 }, value: 30, icon: ['helm', 0x6a8a9a] },
  fenwalker_leggings: { name: 'Fenwalker Leggings', type: 'armor', slot: 'legs', quality: 'uncommon', armor: 10, stats: { str: 2, end: 2 }, value: 36, icon: ['legs', 0x4a5a3a] },
  glowcap_circlet: { name: 'Glowcap Circlet', type: 'armor', slot: 'head', quality: 'uncommon', armor: 4, stats: { int: 3, end: 1 }, value: 36, icon: ['crown', 0x60c8e8] },
  alchemist_gloves: { name: "Ysolde's Spare Gloves", type: 'armor', slot: 'hands', quality: 'uncommon', armor: 5, stats: { agi: 2, int: 1 }, value: 36, icon: ['gloves', 0x3a5a3a] },
  tidewarden_signet: { name: "Tidewarden's Signet", type: 'armor', slot: 'ring', quality: 'rare', stats: { str: 2, int: 2, end: 3 }, value: 80, icon: ['ring', 0xd0b050] },
  smuggler_stiletto: { name: "Smuggler's Stiletto", type: 'weapon', slot: 'mainhand', wtype: 'dagger', quality: 'rare', dmg: [6, 10], speed: 1.6, stats: { agi: 3, str: 1 }, value: 70, model: 'wpn_dagger', icon: ['dagger', 0x404050] },
  keeper_coat: { name: "Lightkeeper's Coat", type: 'armor', slot: 'chest', quality: 'uncommon', armor: 13, stats: { end: 2, int: 1, str: 1 }, value: 40, icon: ['chest', 0x4a5a6a], tint: 0x3a4a5a },
  vendril_ring: { name: "Vendril's Band", type: 'armor', slot: 'ring', quality: 'uncommon', stats: { int: 2, agi: 1 }, value: 30, icon: ['ring', 0x9a5aff] },
  spirebreaker: { name: 'Spire-Breaker', type: 'weapon', slot: 'mainhand', wtype: 'sword', quality: 'epic', dmg: [13, 21], speed: 2.6, stats: { str: 5, end: 3 }, value: 200, model: 'wpn_spirebreaker', icon: ['sword', 0x60d0e0], cls: 'warrior' },
  tidecaller: { name: 'Tidecaller', type: 'weapon', slot: 'mainhand', wtype: 'staff', twoHand: true, quality: 'epic', dmg: [15, 25], speed: 3.2, stats: { int: 8, end: 2 }, value: 200, model: 'wpn_tidecaller', icon: ['staff', 0x40f0e0], cls: 'mage' },
  eyepiercer: { name: 'Eye-Piercer', type: 'weapon', slot: 'mainhand', wtype: 'dagger', quality: 'epic', dmg: [9, 14], speed: 1.6, stats: { agi: 6, end: 2 }, value: 200, model: 'wpn_eyepiercer', icon: ['dagger', 0x60e0e0], cls: 'nightblade' },

  // ------------------------------------------------------------------ quest items, books & keys
  release_papers: { name: 'Release Papers', type: 'quest', quality: 'quest', value: 0, icon: ['letter', 0xe8dcc0], book: 'release_papers' },
  pell_ledger: { name: "Pell's Tax Ledger", type: 'quest', quality: 'quest', value: 0, icon: ['book', 0x6a4a2a], book: 'pell_ledger' },
  glowcap: { name: 'Glowcap', type: 'quest', quality: 'quest', stack: 20, value: 0, icon: ['mushroom', 0x60c8e8] },
  brannoc_bottle: { name: "Brannoc's Bottle", type: 'quest', quality: 'quest', value: 0, icon: ['bottle', 0x3a8a5a] },
  cult_orders: { name: 'Sodden Orders', type: 'quest', quality: 'quest', value: 0, icon: ['letter', 0x6a8a8a], book: 'cult_orders' },
  spire_key: { name: 'Coral Key', type: 'key', quality: 'quest', value: 0, icon: ['key', 0x40d0c0] },
  vendril_notes: { name: "Vendril's Notes", type: 'book', quality: 'common', value: 2, icon: ['book', 0x5a2a6a], book: 'vendril_notes' },
  guide_brackwater: { name: 'A Visitor\'s Guide to Brackwater', type: 'book', quality: 'common', value: 3, icon: ['book', 0x2a4a7a], book: 'guide_brackwater' },
  lay_drowned_eye: { name: 'The Lay of the Drowned Eye', type: 'book', quality: 'common', value: 5, icon: ['book', 0x1d4444], book: 'lay_drowned_eye' },
  keeper_log: { name: "Brannoc's Logbook", type: 'book', quality: 'common', value: 1, icon: ['book', 0x4a5a6a], book: 'keeper_log' },
};

export const QUALITY_ORDER = ['poor', 'common', 'uncommon', 'rare', 'epic', 'quest'];
export const SLOT_NAMES = {
  mainhand: 'Main Hand', offhand: 'Off Hand', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet',
  hands: 'Hands', neck: 'Neck', ring: 'Finger',
};
export const EQUIP_SLOTS = ['head', 'neck', 'chest', 'hands', 'legs', 'feet', 'ring', 'mainhand', 'offhand'];

export function itemDef(id) { return ITEMS[id]; }
