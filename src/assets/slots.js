// The list of every swappable asset slot. Name your file after the slot id
// (e.g. "mob_mudsnapper.glb", "tex_grass.png") and drop it into the Asset Workshop.
import { registry } from './registry.js';
import * as TX from './placeholders/textures.js';
import { buildHumanoid } from './placeholders/characters.js';
import * as CR from './placeholders/creatures.js';
import * as NA from './placeholders/nature.js';
import * as PR from './placeholders/props.js';
import * as BL from './placeholders/buildings.js';
import { NPCS, WIZARD_LOOK, PELL_LOOK } from '../data/npcs.js';

const ANIMS_HUMANOID = ['idle', 'walk', 'run', 'attack', 'cast', 'hit', 'death', 'jump', 'swim', 'sit'];
const ANIMS_BEAST = ['idle', 'walk', 'run', 'attack', 'hit', 'death'];

function tex(id, label, build, extra = {}) {
  registry.define({ id, kind: 'texture', category: 'Textures', label, build, description: 'Tiling texture. Any size; square power-of-two images (512, 1024, 2048) look best.', ...extra });
}
function model(id, category, label, build, extra = {}) {
  registry.define({ id, kind: 'model', category, label, build, ...extra });
}

export function defineSlots() {
  // ------------------------------------------------------------------ textures
  tex('tex_grass', 'Grass ground', () => TX.texGrass());
  tex('tex_sand', 'Sand ground', () => TX.texSand());
  tex('tex_rock', 'Rock / cliffs', () => TX.texRock());
  tex('tex_mud', 'Marsh mud', () => TX.texMud());
  tex('tex_ash', 'Volcanic ash', () => TX.texAsh());
  tex('tex_path', 'Dirt road', () => TX.texPath());
  tex('tex_planks', 'Wood planks', () => TX.texPlanks());
  tex('tex_wood_dark', 'Dark timber beams', () => TX.texWoodDark());
  tex('tex_roof', 'Roof shingles', () => TX.texRoof());
  tex('tex_plaster', 'Plaster walls', () => TX.texPlaster());
  tex('tex_stone', 'Stone blocks', () => TX.texStone());
  tex('tex_thatch', 'Thatch', () => TX.texThatch());
  tex('tex_bark', 'Tree bark', () => TX.texBark());
  tex('tex_cloth', 'Woven cloth', () => TX.texCloth());
  tex('tex_mushroom_cap', 'Mushroom cap', () => TX.texMushroomCap());
  tex('tex_water_normal', 'Water normal map', () => TX.texWaterNormal(), { linear: true, description: 'Tangent-space normal map (purple-blue) that animates the sea surface.' });

  // ------------------------------------------------------------------ characters
  const hum = { fit: 'height', anims: ANIMS_HUMANOID, attach: ['hand_r', 'hand_l'], rig: 'humanoid' };
  model('char_player', 'Characters', 'Player character', () => buildHumanoid({}), {
    ...hum, dynamic: true,
    description: 'Your character. Placeholder changes with race and appearance; an override replaces it for every race. Use char_player_<race> (westerling, ashborn, tuskari, skarn) for per-race models.',
  });
  for (const r of ['westerling', 'ashborn', 'tuskari', 'skarn']) {
    model(`char_player_${r}`, 'Characters', `Player (${r})`, () => buildHumanoid({}), { ...hum, dynamic: true, fallback: 'char_player', description: `Player model used only when your race is ${r}.` });
  }
  model('char_humanoid', 'Characters', 'Generic humanoid (all NPCs)', () => buildHumanoid({}), {
    ...hum, description: 'Fallback for every NPC that has no model of its own. Override this once to replace all villagers.',
  });
  const seen = new Set();
  for (const n of NPCS) {
    if (seen.has(n.model)) continue;
    seen.add(n.model);
    model(n.model, 'Characters', n.title ? `${n.name}, ${n.title}` : n.name, () => buildHumanoid(n.look), { ...hum, fallback: 'char_humanoid' });
  }
  model('npc_wizard', 'Characters', 'Vendril the Unwise', () => buildHumanoid(WIZARD_LOOK), { ...hum, fallback: 'char_humanoid' });
  model('npc_pell', 'Characters', 'Corwin Pell (tax collector)', () => buildHumanoid(PELL_LOOK), { ...hum, fallback: 'char_humanoid' });

  // ------------------------------------------------------------------ creatures
  const beast = { fit: 'height', anims: ANIMS_BEAST };
  model('mob_mudsnapper', 'Creatures', 'Mudsnapper (giant crab)', () => CR.buildCrab(), { ...beast, rig: 'crab' });
  model('mob_grandclaw', 'Creatures', 'Old Grandclaw (rare crab)', () => CR.buildCrab({ scale: 2.1, shell: 0x6a5a5a, under: 0xc8b090, barnacles: true }), { ...beast, rig: 'crab', fallback: 'mob_mudsnapper' });
  model('mob_fenstalker', 'Creatures', 'Fen Stalker', () => CR.buildQuadruped(), { ...beast, rig: 'quad' });
  model('mob_bogling', 'Creatures', 'Bogling Spearman', () => CR.buildBogling(false), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r', 'hand_l'] });
  model('mob_bogling_hexer', 'Creatures', 'Bogling Hexer', () => CR.buildBogling(true), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r'], fallback: 'mob_bogling' });
  model('mob_grubgut', 'Creatures', 'Grubgut the Fat', () => {
    const r = CR.buildBogling(false);
    r.scale.set(1.5, 1.35, 1.6);
    return r;
  }, { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', fallback: 'mob_bogling' });
  model('mob_drowned', 'Creatures', 'Drowned Sailor', () => CR.buildDrowned(), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r'] });
  model('mob_cultist', 'Creatures', 'Drowned Eye Zealot', () => CR.buildCultist(false), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r'] });
  model('mob_cult_adept', 'Creatures', 'Drowned Eye Adept', () => CR.buildCultist(true), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r'], fallback: 'mob_cultist' });
  model('mob_morwen', 'Creatures', 'Sister Morwen (boss)', () => CR.buildMorwen(), { ...beast, anims: ANIMS_HUMANOID, rig: 'humanoid', attach: ['hand_r'] });
  model('mob_deepspawn', 'Creatures', 'Deepspawn', () => CR.buildDeepspawn(), { ...beast, rig: 'tentacles' });
  model('critter_gull', 'Creatures', 'Seagull', () => CR.buildGull(), { fit: 'height', anims: ['idle', 'walk'], rig: 'bird' });

  // ------------------------------------------------------------------ weapons
  const wpn = { fit: 'height', description: 'Held items: grip at the origin, blade/shaft pointing up (+Y).' };
  model('wpn_sword', 'Weapons', 'Sword', () => PR.buildSword(), wpn);
  model('wpn_axe', 'Weapons', 'Axe', () => PR.buildAxe(), wpn);
  model('wpn_mace', 'Weapons', 'Mace', () => PR.buildMace(), wpn);
  model('wpn_dagger', 'Weapons', 'Dagger', () => PR.buildDagger(), wpn);
  model('wpn_staff', 'Weapons', 'Staff', () => PR.buildStaff(), wpn);
  model('wpn_spear', 'Weapons', 'Bogling spear', () => {
    const g = PR.buildStaff({ wood: 0x6a5a3a, orb: 0x8a8a80, crystal: true });
    return g;
  }, wpn);
  model('wpn_shield', 'Weapons', 'Shield', () => PR.buildShield(), { ...wpn, description: 'Worn on the left forearm, face pointing outward (+Z).' });
  model('wpn_spirebreaker', 'Weapons', 'Spire-Breaker (epic sword)', () => PR.buildSword({ blade: 0x9ad0e0, guard: 0x40a0b0, length: 1.05, glow: 0x2080a0 }), { ...wpn, fallback: 'wpn_sword' });
  model('wpn_tidecaller', 'Weapons', 'Tidecaller (epic staff)', () => PR.buildStaff({ wood: 0x2a3a4a, orb: 0x40f0e0, crystal: true }), { ...wpn, fallback: 'wpn_staff' });
  model('wpn_eyepiercer', 'Weapons', 'Eye-Piercer (epic dagger)', () => PR.buildDagger({ blade: 0x80e0e0, glow: 0x20a0a0 }), { ...wpn, fallback: 'wpn_dagger' });
  model('wpn_snapper_buckler', 'Weapons', 'Snapper-shell Buckler', () => PR.buildShield({ shell: true }), { ...wpn, fallback: 'wpn_shield' });

  // ------------------------------------------------------------------ nature
  const nat = { fit: 'height' };
  model('tree_mushroom_giant', 'Nature', 'Giant mushroom tree', () => NA.buildGiantMushroom({ height: 12, seed: 3 }), nat);
  model('tree_mushroom_giant_b', 'Nature', 'Giant mushroom tree (variant)', () => NA.buildGiantMushroom({ height: 8, seed: 9, capColor: 0xa0785a }), { ...nat, fallback: 'tree_mushroom_giant' });
  model('tree_swamp', 'Nature', 'Twisted swamp tree', () => NA.buildSwampTree({ height: 9, seed: 5 }), nat);
  model('tree_swamp_b', 'Nature', 'Twisted swamp tree (variant)', () => NA.buildSwampTree({ height: 7, seed: 21 }), { ...nat, fallback: 'tree_swamp' });
  model('tree_dead', 'Nature', 'Dead tree', () => NA.buildDeadTree(), nat);
  model('mushroom_small', 'Nature', 'Mushroom cluster', () => NA.buildSmallMushroom(), nat);
  model('bush', 'Nature', 'Bush', () => NA.buildBush(), nat);
  model('fern', 'Nature', 'Fern', () => NA.buildFern(), nat);
  model('reeds', 'Nature', 'Reeds & cattails', () => NA.buildReeds(), nat);
  model('grass_tuft', 'Nature', 'Grass tuft', () => NA.buildGrassTuft(), nat);
  model('flowers', 'Nature', 'Wildflowers', () => NA.buildFlowers(), nat);
  model('rock_large', 'Nature', 'Large rock', () => NA.buildRock({ size: 3.2, seed: 2, flat: 0.75 }), nat);
  model('rock_medium', 'Nature', 'Medium rock', () => NA.buildRock({ size: 1.4, seed: 7, flat: 0.7 }), nat);
  model('rock_small', 'Nature', 'Small rock', () => NA.buildRock({ size: 0.5, seed: 11, flat: 0.6 }), nat);
  model('glowcap', 'Nature', 'Glowcap (quest herb)', () => NA.buildGlowcap(), nat);
  model('lilypads', 'Nature', 'Lily pads', () => NA.buildLilyPads(), { ...nat, fit: 'bounds' });
  model('driftwood', 'Nature', 'Driftwood', () => NA.buildDriftwood(), { ...nat, fit: 'bounds' });
  model('kelp', 'Nature', 'Shore weed', () => NA.buildKelp(), nat);

  // ------------------------------------------------------------------ props
  const pr = { fit: 'height' };
  model('prop_crate', 'Props', 'Crate', () => PR.buildCrate(), pr);
  model('prop_barrel', 'Props', 'Barrel', () => PR.buildBarrel(), pr);
  model('prop_chest', 'Props', 'Treasure chest', () => PR.buildChest(), { ...pr, description: 'If your model has a node named "lid", it swings open when looted.' });
  model('prop_lantern_post', 'Props', 'Lantern post', () => PR.buildLanternPost(), pr);
  model('prop_fence', 'Props', 'Fence segment', () => PR.buildFence(), { ...pr, fit: 'bounds' });
  model('prop_table', 'Props', 'Table', () => PR.buildTable(), pr);
  model('prop_chair', 'Props', 'Chair', () => PR.buildChair(), pr);
  model('prop_stool', 'Props', 'Stool', () => PR.buildStool(), pr);
  model('prop_bench', 'Props', 'Bench', () => PR.buildBench(), { ...pr, fit: 'bounds' });
  model('prop_bed', 'Props', 'Bed', () => PR.buildBed(), { ...pr, fit: 'bounds' });
  model('prop_shelf', 'Props', 'Shelf with jars', () => PR.buildShelf(), pr);
  model('prop_bookshelf', 'Props', 'Bookshelf', () => PR.buildBookshelf(), pr);
  model('prop_counter', 'Props', 'Bar counter', () => PR.buildCounter(), { ...pr, fit: 'bounds' });
  model('prop_hearth', 'Props', 'Hearth', () => PR.buildHearth(), pr);
  model('prop_fish_rack', 'Props', 'Fish drying rack', () => PR.buildFishRack(), pr);
  model('prop_rowboat', 'Props', 'Rowboat', () => PR.buildRowboat(), { ...pr, fit: 'bounds' });
  model('prop_campfire', 'Props', 'Campfire', () => PR.buildCampfire(), { ...pr, fit: 'bounds' });
  model('prop_tent', 'Props', 'Tent', () => PR.buildTent(), pr);
  model('prop_signpost', 'Props', 'Signpost', () => PR.buildSignpost(), pr);
  model('prop_well', 'Props', 'Well', () => PR.buildWell(), pr);
  model('prop_bones', 'Props', 'Bones', () => PR.buildBones(), { ...pr, fit: 'bounds' });
  model('prop_altar', 'Props', 'Cult altar', () => PR.buildAltar(), pr);
  model('prop_banner', 'Props', 'Drowned Eye banner', () => PR.buildBanner(), pr);
  model('prop_pillar', 'Props', 'Ruined pillar', () => PR.buildPillar(), pr);
  model('prop_cart', 'Props', 'Cart', () => PR.buildCart(), pr);
  model('prop_sack', 'Props', 'Sack', () => PR.buildSack(), pr);
  model('prop_rug', 'Props', 'Rug', () => PR.buildRug(), { ...pr, fit: 'bounds' });
  model('prop_spire_eye', 'Props', 'The Drowned Eye (floating)', () => PR.buildSpireEye(), { ...pr, fit: 'bounds' });
  model('prop_scroll', 'Props', 'Dropped scroll', () => PR.buildScrollPickup(), { ...pr, fit: 'bounds' });

  // ------------------------------------------------------------------ buildings
  const bld = { fit: 'bounds', description: 'Collision keeps the placeholder footprint, so match its size (shown below). Doors face +Z.' };
  model('bld_house_a', 'Buildings', 'Timber house', () => BL.buildHouseA(), bld);
  model('bld_house_b', 'Buildings', 'Stilted fisher hut', () => BL.buildHouseB(), bld);
  model('bld_tavern', 'Buildings', 'The Drowned Lantern (tavern)', () => BL.buildTavern(), { ...bld, description: bld.description + ' Interior furniture is placed separately as props.' });
  model('bld_hall', 'Buildings', "Tidewarden's Hall", () => BL.buildHall(), bld);
  model('bld_shop', 'Buildings', "Tobin's Sundries", () => BL.buildShop(), bld);
  model('bld_watchtower', 'Buildings', 'Watchtower', () => BL.buildWatchtower(), bld);
  model('bld_lighthouse', 'Buildings', 'Lighthouse', () => BL.buildLighthouse(), bld);
  model('bld_shrine', 'Buildings', 'Shrine of the Tide', () => BL.buildShrine(), bld);
  model('bld_spire', 'Buildings', 'The Drowned Spire', () => BL.buildSpire(), bld);
  model('bld_bog_hut', 'Buildings', 'Bogling hut', () => BL.buildBogHut(), bld);
  model('bld_wreck', 'Buildings', 'Shipwreck', () => BL.buildWreck(), bld);
  model('bld_ship', 'Buildings', 'Prison ship', () => BL.buildShip(), bld);
  model('bld_cult_camp', 'Buildings', 'Cult camp (empty marker)', () => BL.buildCultCamp(), { ...bld, hidden: true });
}

// Building type -> slot id
export const BUILDING_SLOTS = {
  house_a: 'bld_house_a', house_b: 'bld_house_b', tavern: 'bld_tavern', hall: 'bld_hall', shop: 'bld_shop',
  watchtower: 'bld_watchtower', lighthouse: 'bld_lighthouse', shrine: 'bld_shrine', spire: 'bld_spire',
  bog_hut: 'bld_bog_hut', wreck: 'bld_wreck', ship: 'bld_ship', cult_camp: 'bld_cult_camp',
};
