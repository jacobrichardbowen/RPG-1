// Loot tables for creatures and containers.
// gold: [min, max]; items: [itemId, chance, [min, max] count]; oneOf: pick one entry from a list.
export const LOOT = {
  mudsnapper: { gold: [0, 3], items: [['snapper_claw', 0.6, [1, 2]], ['snapper_meat', 0.45, [1, 1]], ['cracked_pearl', 0.06, [1, 1]], ['minor_healing', 0.05, [1, 1]]] },
  grandclaw: { gold: [12, 20], items: [['snapper_meat', 1, [2, 3]], ['cracked_pearl', 1, [1, 2]]], oneOf: ['grandclaw_carapace', 'pearl_of_the_deep'] },
  stalker: { gold: [1, 4], items: [['stalker_hide', 0.55, [1, 1]], ['stalker_fang', 0.5, [1, 2]], ['stalker_leggings', 0.04, [1, 1]], ['minor_healing', 0.06, [1, 1]]] },
  bogling: { gold: [2, 6], items: [['bogling_trinket', 0.5, [1, 2]], ['moldy_bread', 0.3, [1, 1]], ['minor_healing', 0.08, [1, 1]], ['minor_mana', 0.06, [1, 1]], ['bogwalker_boots', 0.03, [1, 1]], ['hexer_charm', 0.03, [1, 1]]] },
  grubgut: { gold: [18, 30], items: [['bogling_trinket', 1, [2, 4]], ['healing_draught', 1, [1, 1]]], oneOf: ['fenking_cudgel', 'grubgut_bellyplate'] },
  drowned: { gold: [2, 7], items: [['waterlogged_coin', 0.6, [1, 4]], ['sea_glass', 0.35, [1, 2]], ['barnacled_ring', 0.04, [1, 1]], ['tidewrack_gauntlets', 0.04, [1, 1]], ['minor_healing', 0.06, [1, 1]]] },
  cultist: { gold: [4, 9], items: [['cult_sigil', 0.45, [1, 1]], ['minor_healing', 0.12, [1, 1]], ['minor_mana', 0.1, [1, 1]], ['zealot_wrap', 0.04, [1, 1]]] },
  adept: { gold: [5, 10], items: [['cult_orders', 0, [1, 1]], ['cult_sigil', 0.5, [1, 1]], ['minor_mana', 0.2, [1, 1]], ['hexer_charm', 0.04, [1, 1]]] },
  morwen: { gold: [40, 60], items: [['spire_key', 1, [1, 1]], ['morwen_crown', 1, [1, 1]], ['healing_draught', 1, [2, 2]]] },
  // Containers
  dock: { gold: [1, 6], items: [['bread', 0.6, [1, 2]], ['brackwater_ale', 0.4, [1, 1]], ['minor_healing', 0.3, [1, 1]]] },
  lighthouse: { gold: [3, 8], items: [['keeper_log', 1, [1, 1]], ['fish_stew', 0.8, [1, 2]]] },
  gullrock: { gold: [25, 40], items: [['cracked_pearl', 1, [2, 3]], ['scroll_featherfall', 1, [1, 1]], ['healing_draught', 1, [1, 1]], ['tideworn_boots', 0.35, [1, 1]]] },
  wreck: { gold: [15, 25], items: [['brannoc_bottle', 0, [1, 1]], ['waterlogged_coin', 1, [3, 6]], ['sea_glass', 1, [1, 3]], ['barnacled_ring', 0.3, [1, 1]]] },
  bogcamp: { gold: [10, 18], items: [['healing_draught', 1, [1, 1]], ['minor_mana', 1, [1, 1]], ['bogwalker_boots', 0.4, [1, 1]]] },
  cult: { gold: [8, 16], items: [['lay_drowned_eye', 1, [1, 1]], ['minor_healing', 1, [1, 2]], ['minor_mana', 1, [1, 1]]] },
  spire: { gold: [60, 90], items: [['healing_draught', 1, [2, 3]], ['scroll_skyleap', 1, [1, 2]], ['pearl_of_the_deep', 0.5, [1, 1]]] },
  hall_chest: { gold: [5, 10], items: [['guide_brackwater', 1, [1, 1]]] },
};

// Vendor inventories. price multiplier on item value when buying; selling gives 25% of value.
export const VENDORS = {
  general: {
    name: "Tobin's Sundries",
    items: ['iron_sword', 'hand_axe', 'iron_mace', 'steel_dagger', 'apprentice_staff', 'wooden_shield', 'padded_jerkin', 'wool_robe', 'leather_cap', 'leather_boots', 'linen_trousers', 'wool_gloves', 'minor_healing', 'bread', 'guide_brackwater'],
  },
  alchemist: {
    name: "Ysolde's Remedies",
    items: ['minor_healing', 'healing_draught', 'minor_mana', 'stamina_tonic', 'scroll_featherfall'],
  },
  tavern: {
    name: 'The Drowned Lantern',
    items: ['bread', 'fried_snapper', 'fish_stew', 'brackwater_ale'],
  },
};
export const BUY_MULT = 1.0;
export const SELL_MULT = 0.25;
