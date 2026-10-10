// Things in the world you can use: containers, herbs, the body on the Fen road, signposts, the shrine.
import * as THREE from 'three';
import { Visual } from './visual.js';

export class Interactable {
  constructor(game, { id, slot, x, z, y, rot = 0, radius = 1.2, height = 1.2, label, verb = 'Use' }) {
    this.game = game;
    this.id = id;
    this.group = new THREE.Group();
    const gy = y ?? game.world.collision.groundAt(x, z, 50, 0);
    this.group.position.set(x, gy, z);
    this.group.rotation.y = rot;
    this.pos = this.group.position;
    this.radius = radius;
    this.height = height;
    this.label = label;
    this.verbText = verb;
    if (slot) {
      this.visual = new Visual(slot, { cloneMaterials: false });
      this.group.add(this.visual.group);
    }
    game.scene.add(this.group);
    this.enabled = true;
  }
  name() { return this.label; }
  verb() { return this.verbText; }
  canUse() { return this.enabled; }
  use() {}
  update(dt) {
    if (this.visual) this.visual.update(dt, { open: this.open });
  }
}

// Chests, crates and barrels with a loot table. Contents persist in the save once rolled.
export class Container extends Interactable {
  constructor(game, def) {
    const slot = def.type === 'chest' ? 'prop_chest' : def.type === 'crate' ? 'prop_crate' : 'prop_barrel';
    const names = { chest: 'Chest', crate: 'Crate', barrel: 'Barrel' };
    super(game, { ...def, slot, label: def.label || names[def.type], verb: 'Open', y: def.y ?? (game.world.collision.groundAt(def.x, def.z, 50, 0) + (def.yOffset || 0)) });
    this.def = def;
    this.locked = !!def.locked;
    this.isContainer = true;
    this.open = false;
    if (def.type !== 'chest') {
      // Crates and barrels block movement; chests are low enough to step around.
      const r = def.type === 'crate' ? 0.6 : 0.45;
      game.world.collision.add({ type: 'circle', x: def.x, z: def.z, r, y0: this.pos.y - 1, y1: this.pos.y + 1.05, walk: true });
    }
  }
  verb() { return this.locked && !this.game.sheet.has('spire_key') ? 'Locked' : 'Open'; }
  use() {
    const g = this.game;
    if (this.locked) {
      if (!g.sheet.has('spire_key')) { g.error('It is locked. Perhaps someone carries a key.'); g.audio?.play('locked'); return; }
      this.locked = false;
      g.log('You unlock the chest with the Coral Key.', 'system');
    }
    if (!g.containerLoot[this.id]) g.containerLoot[this.id] = g.rollLoot(this.def.loot, true);
    this.open = true;
    g.audio?.play('chest_open', this.pos);
    g.ui.openLoot(this, g.containerLoot[this.id]);
  }
  onLootClosed() { this.open = false; }
}

// A gatherable glowcap cluster. Only gatherable while the quest needs it.
export class Herb extends Interactable {
  constructor(game, x, z, index) {
    super(game, { id: `herb_${index}`, slot: 'glowcap', x, z, rot: Math.random() * 6, radius: 1.2, height: 0.6, label: 'Glowcap', verb: 'Gather' });
    this.respawnT = 0;
    this.isHerb = true;
    this.light = { x, y: this.pos.y + 0.3, z, color: new THREE.Color(0x40b0ff), intensity: 2.5, distance: 6, interior: false, phase: Math.random() * 10, flicker: false };
    game.world.lightAnchors.push(this.light);
  }
  canUse() { return this.enabled && this.game.questNeedsItem('glowcap'); }
  verb() { return this.game.questNeedsItem('glowcap') ? 'Gather' : 'Glowcap'; }
  use() {
    const g = this.game;
    g.startChannel('Gathering', 1.6, () => {
      if (!this.enabled) return;
      if (g.giveItem('glowcap', 1)) {
        this.enabled = false;
        this.group.visible = false;
        this.light.intensity = 0;
        this.respawnT = 75;
        g.audio?.play('gather', this.pos);
      }
    }, 'icon_glowcap');
  }
  update(dt) {
    super.update(dt);
    if (!this.enabled) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.enabled = true; this.group.visible = true; this.light.intensity = 2.5; }
    }
  }
}

// Corwin Pell's body on the Fen road.
export class PellBody extends Interactable {
  constructor(game, at) {
    super(game, { id: 'pell_body', slot: 'npc_pell', x: at.x, z: at.z, rot: at.rot, radius: 1.4, height: 0.6, label: 'Body of Corwin Pell', verb: 'Search' });
    this.visual.play('death');
    for (let i = 0; i < 60; i++) this.visual.update(0.05, {});
  }
  label2() { return this.game.questDone('taxman') || this.game.questStage('taxman') > 1 ? 'Body of Corwin Pell' : 'A body'; }
  name() { return this.game.questStage('taxman') >= 1 || this.game.questDone('taxman') ? 'Body of Corwin Pell' : 'A body'; }
  use() {
    const g = this.game;
    if (g.questActive('taxman') && g.questStage('taxman') === 1) {
      g.giveItem('pell_ledger', 1, true);
      g.questEvent('interact', 'pell_body');
      g.ui.showBook('pell_ledger');
      return;
    }
    if (g.questActive('taxman') && g.questStage('taxman') === 0) {
      g.log('A man in a Hall clerk\'s coat lies dead in the reeds. His pockets have been turned out. A thin stab wound shows between his ribs.', 'system');
      return;
    }
    g.log('Corwin Pell lies where he fell. The crows have been at him.', 'system');
  }
  update() {}
}

// Readable signposts.
export class Signpost extends Interactable {
  constructor(game, x, z, text) {
    super(game, { id: `sign_${x}_${z}`, x, z, radius: 1.1, height: 2.4, label: 'Signpost', verb: 'Read' });
    this.text = text;
  }
  use() { this.game.ui.toast(this.text, 5); }
}

// The Shrine of the Tide: pray for a blessing, and it is where you wake after death.
export class Shrine extends Interactable {
  constructor(game, x, z) {
    super(game, { id: 'shrine', x, z, radius: 3.8, height: 4, label: 'Shrine of the Tide', verb: 'Pray' });
  }
  use() {
    const g = this.game;
    const last = g.flags.prayedDay;
    if (last === g.day()) { g.log('You pray at the shrine. The water is calm, but you feel no new blessing today.', 'system'); return; }
    g.flags.prayedDay = g.day();
    g.addPlayerEffect({ id: 'tide_blessing', name: 'Blessing of the Tide', stats: { str: 2, agi: 2, int: 2, end: 2 }, dur: 900, icon: 'icon_fx_blessing' });
    g.player.hp = g.player.maxHp;
    g.player.mana = g.player.maxMana;
    g.fx?.sparkle(g.player, 0x80d0ff);
    g.audio?.play('blessing');
    g.log('You pray at the Shrine of the Tide. You feel the sea\'s blessing settle over you.', 'system');
  }
}

// A corpse you can loot (wraps a dead creature).
export class CorpseLoot {
  constructor(creature) { this.creature = creature; }
}
