// The hand-authored layout of the Isle of Brackwater.
// Coordinates are meters. +X is east, -Z is north (map "up"), Y is up. Sea level is y = 0.
// Edit positions here to rearrange the island; terrain, map and spawns all read from this file.

export const SEA_LEVEL = 0;

// Extra land shapes merged with the main island outline (signed "inland distance" blobs).
export const LAND_BLOBS = [
  { x: -104, z: 226, r: 30 }, // Lantern Point headland (lighthouse)
  { x: 152, z: 238, r: 16 }, // Gull Rock islet
  { x: 205, z: 40, r: 34 }, // Snapper Strand bulge
];

// Bays carved out of the coastline.
export const BAYS = [
  { x: -186, z: -182, r: 46 }, // Wrecker's Cove
  { x: 92, z: 236, r: 26 }, // little harbour east of the docks
];

// Flat pads blended into the terrain (buildings sit on these).
export const PADS = [
  { x: 10, z: 162, rx: 72, rz: 46, h: 2.4, falloff: 22 }, // Brackwater plateau
  { x: 30, z: -152, rx: 17, rz: 17, h: null, falloff: 10 }, // Spire summit (keeps natural height)
  { x: -104, z: 226, rx: 12, rz: 12, h: 6.5, falloff: 12 }, // Lighthouse base
  { x: -172, z: 34, rx: 20, rz: 16, h: 0.75, falloff: 10 }, // Bogling camp mound
];

export const TOR = { x: 30, z: -150, height: 40, radius: 46 };
export const MARSH = { x: -150, z: 12, radius: 88 };
export const STRAND = { x: 188, z: 60, radius: 70 };

// Roads are polylines; terrain is smoothed along them and painted with the path texture.
export const ROADS = [
  { width: 4.5, pts: [[10, 205], [10, 160], [8, 118], [4, 90], [-2, 55], [2, 20], [14, -30], [24, -70], [16, -100], [38, -118], [26, -134], [30, -146]] },
  { width: 3.5, pts: [[-2, 55], [-40, 48], [-78, 38], [-112, 30], [-140, 32]] },
  { width: 3.5, pts: [[30, 130], [70, 112], [110, 96], [145, 78], [172, 66]] },
  { width: 3, pts: [[-30, 168], [-58, 186], [-80, 204], [-98, 220]] },
  { width: 3, pts: [[-78, 38], [-96, -10], [-118, -70], [-140, -118], [-156, -146]] },
  { width: 3, pts: [[-40, 160], [-30, 168], [-10, 170], [10, 170], [30, 165], [48, 160]] },
];

// Zones: discovering one gives exploration XP and shows a banner.
export const ZONES = [
  { id: 'brackwater', name: 'Brackwater', x: 10, z: 165, r: 70, xp: 0, music: 'town' },
  { id: 'docks', name: 'Brackwater Docks', x: 16, z: 228, r: 26, xp: 0, parent: 'brackwater' },
  { id: 'strand', name: 'Snapper Strand', x: 185, z: 62, r: 62, xp: 40 },
  { id: 'wood', name: 'Parasol Wood', x: 10, z: 35, r: 72, xp: 40 },
  { id: 'fen', name: 'Glowcap Fen', x: -150, z: 12, r: 85, xp: 50 },
  { id: 'tor', name: "Vael's Tor", x: 30, z: -140, r: 70, xp: 60 },
  { id: 'spire', name: 'The Drowned Spire', x: 30, z: -152, r: 18, xp: 40, parent: 'tor' },
  { id: 'cove', name: "Wrecker's Cove", x: -168, z: -160, r: 52, xp: 60 },
  { id: 'lantern', name: 'Lantern Point', x: -104, z: 224, r: 30, xp: 40 },
  { id: 'gullrock', name: 'Gull Rock', x: 152, z: 238, r: 18, xp: 75 },
];

// Building placements. `rot` is radians around Y; buildings face +Z locally (door side).
export const BUILDINGS = [
  { id: 'hall', type: 'hall', x: 42, z: 150, rot: -Math.PI / 2, name: "Tidewarden's Hall" },
  { id: 'tavern', type: 'tavern', x: -24, z: 150, rot: Math.PI / 2, name: 'The Drowned Lantern' },
  { id: 'shop', type: 'shop', x: -14, z: 184, rot: Math.PI * 0.9, name: "Tobin's Sundries" },
  { id: 'alchemist', type: 'house_b', x: 40, z: 182, rot: Math.PI * 1.1, name: "Ysolde's Remedies", enter: false },
  { id: 'house1', type: 'house_a', x: -36, z: 124, rot: Math.PI * 0.35 },
  { id: 'house2', type: 'house_a', x: 58, z: 126, rot: -Math.PI * 0.3 },
  { id: 'house3', type: 'house_b', x: -50, z: 178, rot: Math.PI * 0.6 },
  { id: 'house4', type: 'house_b', x: 66, z: 168, rot: -Math.PI * 0.55 },
  { id: 'house5', type: 'house_a', x: 22, z: 122, rot: Math.PI },
  { id: 'tower', type: 'watchtower', x: -6, z: 116, rot: 0, name: 'North Watch' },
  { id: 'lighthouse', type: 'lighthouse', x: -106, z: 228, rot: 0.4, name: 'Lantern Point Light' },
  { id: 'shrine', type: 'shrine', x: 10, z: 160, rot: 0, name: 'Shrine of the Tide' },
  { id: 'spire', type: 'spire', x: 30, z: -152, rot: 0, name: 'The Drowned Spire' },
  { id: 'hut1', type: 'bog_hut', x: -176, z: 28, rot: 0.6 },
  { id: 'hut2', type: 'bog_hut', x: -164, z: 44, rot: 2.4 },
  { id: 'hut3', type: 'bog_hut', x: -182, z: 46, rot: -1.2 },
  { id: 'wreck', type: 'wreck', x: -170, z: -168, rot: 0.9, name: 'Wreck of the Gilded Gull' },
  { id: 'cultcamp', type: 'cult_camp', x: 40, z: -112, rot: 0.3 },
];

// The docks and the prison ship.
export const DOCK = {
  x: 14, z0: 196, z1: 252, width: 4.2, deckY: 1.6,
  piers: [{ z: 226, side: -1, len: 10 }, { z: 244, side: -1, len: 7 }],
};
export const SHIP = { x: 25.5, z: 241, rot: 0, deckY: 2.1, length: 22, beam: 7 };

// Spawn point for a new game (on the ship deck) and respawn point after death.
export const PLAYER_START = { x: 24.0, z: 241.0, facing: -Math.PI / 2 };
export const RESPAWN = { x: 10, z: 166 };

// Enemy spawn groups. Each spawn has a creature type, position and wander radius.
export const SPAWNS = [
  // Snapper Strand
  ...[[172, 28], [184, 44], [196, 30], [190, 64], [176, 80], [204, 76], [212, 50], [168, 102], [196, 100], [214, 20]]
    .map(([x, z], i) => ({ type: 'mudsnapper', x, z, wander: 9, level: i % 3 === 0 ? 2 : 1 })),
  { type: 'grandclaw', x: 226, z: 92, wander: 6, level: 3, respawn: 600 },
  // Parasol Wood
  ...[[-18, 30], [30, 10], [42, 52], [-30, 72], [18, -18], [56, -12]]
    .map(([x, z], i) => ({ type: 'fenstalker', x, z, wander: 16, level: 2 + (i % 2) })),
  // Glowcap Fen bogling camp
  ...[[-158, 26], [-178, 18], [-186, 38], [-166, 52], [-150, 40], [-142, 12], [-130, 44]]
    .map(([x, z], i) => ({ type: 'bogling', x, z, wander: 6, level: 2 + (i % 2) })),
  { type: 'bogling_hexer', x: -172, z: 36, wander: 3, level: 3 },
  { type: 'bogling_hexer', x: -160, z: 30, wander: 3, level: 3 },
  { type: 'grubgut', x: -176, z: 38, wander: 2, level: 4, respawn: 420 },
  // Wrecker's Cove
  ...[[-162, -150], [-176, -160], [-158, -172], [-180, -140], [-148, -160]]
    .map(([x, z], i) => ({ type: 'drowned', x, z, wander: 7, level: 3 + (i % 2) })),
  // Vael's Tor: cult camp and spire
  ...[[44, -106], [34, -114], [50, -118], [22, -124], [40, -134], [18, -142]]
    .map(([x, z], i) => ({ type: 'cultist', x, z, wander: 4, level: 4 + (i % 2) })),
  { type: 'cult_adept', x: 38, z: -110, wander: 2, level: 4 },
  { type: 'cult_adept', x: 36, z: -142, wander: 2, level: 5 },
  { type: 'cult_adept', x: 22, z: -150, wander: 2, level: 5 },
  { type: 'morwen', x: 30, z: -156, wander: 0, level: 6, respawn: 0 },
];

// Gatherable herbs (glowcaps) in the fen.
export const HERBS = [
  [-120, 10], [-132, -8], [-146, -20], [-168, -6], [-190, 6], [-196, -18], [-128, 54], [-108, 40],
  [-150, 62], [-200, 30], [-176, -30], [-140, -36],
];

// Loot containers placed in the world (some are inside buildings, see buildings.js interiors).
export const CONTAINERS = [
  { id: 'gullrock_chest', type: 'chest', x: 153, z: 238, rot: 1.2, loot: 'gullrock', locked: false },
  { id: 'wreck_chest', type: 'chest', x: -172, z: -170, rot: 0.9, loot: 'wreck', yOffset: 0.6 },
  { id: 'bog_chest', type: 'chest', x: -178, z: 34, rot: 0.5, loot: 'bogcamp' },
  { id: 'cult_crate', type: 'crate', x: 44, z: -110, rot: 0.3, loot: 'cult' },
  { id: 'dock_crate1', type: 'crate', x: 11.2, z: 208, rot: 0.1, loot: 'dock' },
  { id: 'dock_barrel1', type: 'barrel', x: 16.8, z: 214, rot: 0, loot: 'dock' },
  { id: 'lighthouse_barrel', type: 'barrel', x: -100, z: 224, rot: 0, loot: 'lighthouse' },
  { id: 'spire_chest', type: 'chest', x: 30, z: -161, rot: 0, loot: 'spire', locked: true },
];

// Loose props placed around the island: [slot, x, z, rot, opts?]. Props with a collider block movement.
export const PROPS = [
  // Docks clutter
  ['prop_crate', 12.6, 206, 0.2], ['prop_crate', 12.4, 207.2, 0.5, { stack: 1 }], ['prop_barrel', 15.6, 205.5, 0],
  ['prop_barrel', 16.2, 222, 0], ['prop_crate', 15.5, 236, 0.1], ['prop_sack', 12.4, 238, 0], ['prop_sack', 13, 238.6, 0.4],
  ['prop_lantern_post', 16.0, 210, Math.PI], ['prop_lantern_post', 11.9, 228, 0], ['prop_lantern_post', 16.0, 246, Math.PI],
  ['prop_rowboat', 4.5, 222, 0.3, { water: true }], ['prop_rowboat', 2.0, 231, -0.2, { water: true }],
  ['prop_rowboat', 34, 210, 1.2], ['prop_fish_rack', 26, 204, 0.1], ['prop_fish_rack', 56, 146, Math.PI / 2],
  ['prop_fish_rack', 56, 156, Math.PI / 2], ['prop_barrel', 58, 160, 0], ['prop_crate', 62, 155, 0.6],
  // Village
  ['prop_well', -4, 172, 0], ['prop_bench', 4, 152, Math.PI], ['prop_bench', 16, 152, Math.PI],
  ['prop_lantern_post', -2, 144, 0], ['prop_lantern_post', 22, 144, Math.PI], ['prop_lantern_post', 26, 172, Math.PI],
  ['prop_lantern_post', -10, 166, 0], ['prop_lantern_post', 10, 128, 0], ['prop_lantern_post', 12, 196, 0],
  ['prop_lantern_post', 30, 158, Math.PI / 2], ['prop_lantern_post', -36, 165, 0],
  ['prop_signpost', 13, 118, 0.2], ['prop_signpost', -2, 60, 1.0], ['prop_signpost', 32, 128, -0.8], ['prop_signpost', -76, 42, 0.4],
  ['prop_cart', -6, 194, 0.7], ['prop_crate', -8, 190, 0.3], ['prop_barrel', -20, 194, 0], ['prop_barrel', -21, 193, 0],
  ['prop_table', 39, 175.8, 0.2], ['prop_shelf', 41.3, 175, 0.2], ['prop_barrel', 44, 177, 0],
  ['prop_fence', 70, 135, 1.2], ['prop_fence', 72, 138, 1.0], ['prop_fence', -50, 136, 0.6], ['prop_fence', -54, 139, 0.9],
  ['prop_crate', 48, 140, 0.4], ['prop_sack', -44, 148, 0], ['prop_bench', -30, 140, 0.4],
  // Wilderness
  ['prop_campfire', -160, 32, 0], ['prop_bones', -150, 30, 0.4], ['prop_bones', -186, 26, 1.2],
  ['prop_bones', 210, 70, 0.4], ['prop_bones', -170, -150, 0.9], ['prop_bones', 24, -112, 0.3],
  ['prop_crate', -166, -164, 0.4], ['prop_barrel', -174, -158, 1.2], ['prop_barrel', -160, -176, 0.2],
  ['prop_pillar', 52, -128, 0, { seed: 3 }], ['prop_pillar', 6, -136, 0, { seed: 4 }], ['prop_pillar', 56, -150, 0, { seed: 5 }],
  ['prop_campfire', -98, 218, 0], ['prop_bench', -100, 214, 0.6], ['prop_crate', -108, 220, 0.4],
];

// Where the "Sky-Fall" event drops the unlucky wizard.
export const WIZARD_FALL = { x: 18, z: 104, triggerRadius: 30 };
