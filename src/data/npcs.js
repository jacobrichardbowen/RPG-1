// Non-player characters of Brackwater. `look` drives the procedural placeholder model;
// `model` is the asset slot you can override with your own character model.
// `at` places the NPC either at world coordinates or at a named spot inside a building.

export const NPCS = [
  {
    id: 'ilsa', name: 'Ilsa Vane', title: 'Harbormaster', model: 'npc_ilsa',
    at: { x: 12.6, z: 216, rot: Math.PI * 0.95 },
    look: { female: true, skin: 0xd8a888, hair: 0x6a4a2a, hairStyle: 'ponytail', shirt: 0x2a4a6a, pants: 0x3a3028, boots: 0x2a1f18, cloak: 0x24384e, hat: 'tricorn' },
    greeting: 'ilsa',
  },
  {
    id: 'kell', name: 'Sergeant Kell', title: 'Ship Guard', model: 'npc_kell',
    at: { building: 'ship', spot: 'kell' },
    look: { skin: 0xb08060, hair: 0x2a1a10, hairStyle: 'short', beard: 0x2a1a10, shirt: 0x5a2a2a, cuirass: 0x8a8a90, shoulders: 0x8a8a90, helm: 0x8a8a90, pants: 0x3a3030 },
  },
  {
    id: 'sailor', name: 'Deckhand Pim', title: '', model: 'npc_sailor',
    at: { building: 'ship', spot: 'sailor' },
    look: { skin: 0xe0b090, hair: 0xb08040, hairStyle: 'short', shirt: 0xd8d0c0, sleeves: 'short', pants: 0x3a4a6a, boots: 0x2a2018 },
  },
  {
    id: 'orvel', name: 'Orvel Garrow', title: 'Tidewarden', model: 'npc_orvel',
    at: { building: 'hall', spot: 'orvel' },
    look: { skin: 0xd0a890, hair: 0x9a9a9a, hairStyle: 'short', beard: 0xa0a0a0, robe: 0x2a3a5a, shirt: 0x2a3a5a, height: 1.76, build: 1.08 },
  },
  {
    id: 'clerk', name: 'Nessa Wick', title: 'Clerk of the Hall', model: 'npc_clerk',
    at: { building: 'hall', spot: 'clerk' },
    look: { female: true, skin: 0xe0b8a0, hair: 0x2a1a14, hairStyle: 'bun', shirt: 0x5a6a7a, pants: 0x3a3a44 },
  },
  {
    id: 'maela', name: 'Maela Strand', title: 'Fisherwoman', model: 'npc_maela',
    at: { x: 60, z: 150, rot: -Math.PI / 2 },
    look: { female: true, skin: 0xb88a68, hair: 0x8a3a1a, hairStyle: 'ponytail', shirt: 0x6a7a5a, sleeves: 'short', apron: 0x8a7a5a, pants: 0x4a3a2a, boots: 0x3a3020 },
  },
  {
    id: 'ysolde', name: 'Ysolde Fenn', title: 'Alchemist', model: 'npc_ysolde',
    at: { x: 36.5, z: 176.5, rot: Math.PI * 1.15 },
    look: { female: true, skin: 0x7d8590, ears: 'pointed', glowEyes: 0xd03a28, hair: 0x1a1a24, hairStyle: 'long', robe: 0x3a5a3a, shirt: 0x3a5a3a, apron: 0x6a5a40 },
    vendor: 'alchemist',
  },
  {
    id: 'darro', name: 'Darro Vex', title: '', model: 'npc_darro',
    at: { building: 'tavern', spot: 'darro' },
    look: { skin: 0xc09070, hair: 0x1a1210, hairStyle: 'long', beard: 0x1a1210, shirt: 0x3a2a2a, pants: 0x2a2424, cloak: 0x2a2a30, boots: 0x1a1414 },
  },
  {
    id: 'bram', name: 'Bram Hollis', title: 'Innkeeper', model: 'npc_bram',
    at: { building: 'tavern', spot: 'keeper' },
    look: { skin: 0x7a8f58, ears: 'pointed', tusks: true, build: 1.2, height: 1.9, hairStyle: 'mohawk', hair: 0x2a2a1a, shirt: 0x8a7a6a, sleeves: 'short', apron: 0xc8b898, pants: 0x4a3a2a },
    vendor: 'tavern',
  },
  {
    id: 'patron', name: 'Gus Larrow', title: '', model: 'npc_villager',
    at: { building: 'tavern', spot: 'patron' },
    look: { skin: 0xd0a080, hair: 0x6a5a40, hairStyle: 'short', shirt: 0x7a5a4a, pants: 0x4a4038 },
  },
  {
    id: 'hessa', name: 'Hessa Rook', title: 'Captain of the Watch', model: 'npc_hessa',
    at: { building: 'tower', spot: 'hessa' },
    look: { female: true, skin: 0xc89878, hair: 0x2a1a10, hairStyle: 'bun', shirt: 0x2a4a7a, cuirass: 0x9a9aa2, shoulders: 0x9a9aa2, pants: 0x2a2a34, boots: 0x1a1a20, cloak: 0x2a4a7a },
  },
  {
    id: 'tobin', name: 'Tobin Six-Scales', title: 'Trader', model: 'npc_tobin',
    at: { building: 'shop', spot: 'tobin' },
    look: { lizard: { scales: 0x4a6a5a, belly: 0xc0b080, crest: 0xa04a2a }, hairStyle: 'none', shirt: 0x7a5a3a, apron: 0x5a4a30, pants: 0x4a3a2a },
    vendor: 'general',
  },
  {
    id: 'brannoc', name: 'Old Brannoc', title: 'Lighthouse Keeper', model: 'npc_brannoc',
    at: { building: 'lighthouse', spot: 'brannoc' },
    look: { skin: 0xd8b098, hair: 0xe8e8e8, hairStyle: 'short', beard: 0xf0f0f0, shirt: 0x4a5a6a, pants: 0x3a3a3a, hunch: 0.15, height: 1.72 },
  },
  {
    id: 'guard1', name: 'Brackwater Guard', title: '', model: 'npc_guard',
    at: { x: 2, z: 140, rot: 0 }, patrol: [[2, 140], [18, 165], [6, 190], [-14, 165]],
    look: { skin: 0xc09070, hairStyle: 'short', shirt: 0x2a4a7a, cuirass: 0x8a8a92, shoulders: 0x8a8a92, helm: 0x8a8a92, pants: 0x2a2a34 },
  },
  {
    id: 'guard2', name: 'Brackwater Guard', title: '', model: 'npc_guard',
    at: { x: 14, z: 200, rot: 0 }, patrol: [[14, 200], [14, 238], [12, 212], [30, 196]],
    look: { skin: 0xa07050, hairStyle: 'short', shirt: 0x2a4a7a, cuirass: 0x8a8a92, shoulders: 0x8a8a92, helm: 0x8a8a92, pants: 0x2a2a34 },
  },
  {
    id: 'fisher', name: 'Edda Marsh', title: '', model: 'npc_villager',
    at: { x: 9.5, z: 230, rot: Math.PI / 2 },
    look: { female: true, skin: 0xd8a888, hair: 0x9a6a3a, hairStyle: 'long', shirt: 0x8a6a5a, pants: 0x4a3a30, apron: 0x7a6a50 },
  },
  {
    id: 'villager', name: 'Corbin Ash', title: '', model: 'npc_villager',
    at: { x: 4, z: 156, rot: 0.5 }, wander: 10,
    look: { skin: 0xb88a68, hair: 0x3a2a1a, hairStyle: 'short', shirt: 0x6a6a4a, pants: 0x4a3a2a },
  },
];

// Corwin Pell, the missing tax collector (found dead by the Fen road).
export const PELL_LOOK = { skin: 0xd8b8a0, hair: 0x6a5a4a, hairStyle: 'short', shirt: 0x3a3a5a, pants: 0x2a2a34, cloak: 0x2a2a44, height: 1.7 };
export const PELL_BODY = { x: -101, z: 35.5, rot: 1.2 };

// Appearance of the fallen mage (spawned by an event, not placed at start).
export const WIZARD_LOOK = { skin: 0xe0c0a8, hair: 0xb0b0b0, hairStyle: 'long', beard: 0xb0b0b0, robe: 0x5a2a6a, shirt: 0x5a2a6a, hood: 0x5a2a6a };
