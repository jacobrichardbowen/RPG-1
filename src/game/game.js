// Game orchestration: session lifecycle, the main loop, targeting, interaction, combat glue,
// rewards, story events and saving.
import * as THREE from 'three';
import { Engine } from '../core/engine.js';
import { Input } from '../core/input.js';
import { CameraRig } from '../core/camera.js';
import { World } from '../world/world.js';
import { LightPool } from '../world/lights.js';
import { Player } from '../entities/player.js';
import { Npc } from '../entities/npc.js';
import { Creature } from '../entities/creature.js';
import { Container, Herb, PellBody, Signpost, Shrine } from '../entities/interactables.js';
import { Unit } from '../entities/unit.js';
import { CharacterSheet } from './character.js';
import { QuestLog } from './quests.js';
import { DialogEngine } from './dialog.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { tryUseAbility, updateCast } from './abilities.js';
import { updateEffects, addEffect, dealDamage, rollMelee, interrupt, isStunned, isRooted, speedMult, removeEffect } from './combat.js';
import { UI } from '../ui/ui.js';
import { CLASSES, ABILITIES, MELEE_RANGE } from '../data/classes.js';
import { CREATURES, levelXp } from '../data/creatures.js';
import { ITEMS } from '../data/items.js';
import { LOOT } from '../data/loot.js';
import { QUESTS } from '../data/quests.js';
import { NPCS, WIZARD_LOOK, PELL_BODY } from '../data/npcs.js';
import { RACES } from '../assets/placeholders/characters.js';
import { PLAYER_START, RESPAWN, TOR_CHECKPOINT, SPAWNS, HERBS, CONTAINERS, ZONES, WIZARD_FALL, PROPS } from '../world/layout.js';
import { registry } from '../assets/registry.js';

const SAVE_KEY = 'brackwater.save.v1';
const SETTINGS_KEY = 'brackwater.settings.v1';
export const DEFAULT_SETTINGS = {
  quality: 'medium', renderScale: 1, fov: 65, sensitivity: 1, invertY: false,
  master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.7, showFps: false, shake: true, dayMinutes: 36,
  nameplates: true, combatText: true,
};

const SIGN_TEXT = {
  '13,118': 'North: Parasol Wood, Vael\'s Tor  ·  South: Brackwater',
  '-2,60': 'North: Vael\'s Tor  ·  West: Glowcap Fen  ·  South: Brackwater',
  '32,128': 'East: Snapper Strand  ·  West: Brackwater',
  '-76,42': 'West: Glowcap Fen  ·  North-west: Wrecker\'s Cove  ·  East: Brackwater',
};

function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, v) { try { localStorage.setItem(key, v); return true; } catch (e) { return false; } }

export class Game {
  constructor(viewport, uiRoot) {
    this.viewportEl = viewport;
    this.uiRoot = uiRoot;
    this.engine = new Engine(viewport);
    this.scene = this.engine.scene;
    this.camera = this.engine.camera;
    this.input = new Input(this.engine.renderer.domElement);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.hour = 9;
    this.dayCount = 1;
    this.state = 'boot';
    this.npcs = [];
    this.creatures = [];
    this.interactables = [];
    this.flags = {};
    this.containerLoot = {};
    this.discovered = {};
    this.target = null;
    this.playerInCombat = false;
    this.combatT = 0;
    this.channel = null;
    this.paused = false;
    this.settings = { ...DEFAULT_SETTINGS, ...(safeParse(storageGet(SETTINGS_KEY)) || {}) };
    this.fpsT = 0; this.frames = 0; this.fps = 0;
    this.timers = [];
  }

  // ------------------------------------------------------------------ boot
  async init(progress) {
    const q = this.engine.setQuality(this.settings.quality);
    await progress('Raising the island');
    this.world = new World(this.scene);
    this.world.build(() => {});
    await progress('Lighting lanterns');
    this.lights = new LightPool(this.scene, this.world.lightAnchors, q.lights);
    this.rig = new CameraRig(this.camera, this.world.collision);
    this.fx = new FX(this);
    this.audio = new AudioEngine(this);
    await progress('Waking the villagers');
    this.spawnNpcs();
    this.spawnInteractables();
    await progress('Stirring the wildlife');
    this.spawnCreatures();
    this.spawnCritters();
    this.ui = new UI(this, this.uiRoot);
    this.applySettings();
    this.input.onKey = (e) => this.ui.onKey(e);
    this.loop = this.loop.bind(this);
    this.state = 'menu';
    this.ui.showMainMenu();
    requestAnimationFrame(this.loop);
    window.addEventListener('beforeunload', () => { if (this.state === 'play') this.save(true); });
    setInterval(() => { if (this.state === 'play' && this.player && this.player.alive) this.save(true); }, 60000);
    this.engine.renderer.domElement.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });
  }

  applySettings() {
    const s = this.settings;
    const q = this.engine.setQuality(s.quality);
    this.engine.renderScale = s.renderScale;
    this.engine.fov = s.fov;
    this.engine.setQuality(s.quality);
    this.lights.setCount(q.lights);
    this.world.sky.setShadowQuality(q.shadowSize, q.shadows);
    this.world.vegetation.distScale = q.veg;
    this.rig.sensitivity = s.sensitivity;
    this.rig.invertY = s.invertY;
    Object.assign(this.audio.vol, { master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient });
    this.audio.applyVolumes();
    storageSet(SETTINGS_KEY, JSON.stringify(s));
  }

  spawnNpcs() {
    for (const def of NPCS) {
      let spot;
      if (def.at.building) {
        spot = this.world.spots[def.at.building]?.[def.at.spot];
        if (!spot) { console.warn('Missing spot for', def.id); continue; }
      } else {
        spot = { ...def.at };
      }
      this.npcs.push(new Npc(this, def, spot));
    }
  }

  spawnInteractables() {
    for (const c of CONTAINERS) this.interactables.push(new Container(this, c));
    HERBS.forEach(([x, z], i) => this.interactables.push(new Herb(this, x, z, i)));
    this.interactables.push(new PellBody(this, PELL_BODY));
    for (const [slot, x, z] of PROPS) {
      if (slot === 'prop_signpost') this.interactables.push(new Signpost(this, x, z, SIGN_TEXT[`${x},${z}`] || 'The writing has worn away.'));
    }
    const sh = this.world.buildingsById.shrine;
    this.interactables.push(new Shrine(this, sh.x, sh.z));
    // The Hall's chest holds a guidebook.
    const hc = this.world.spots.hall;
    if (hc) {
      const b = this.world.buildingsById.hall;
      const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
      const lx = 5.0, lz = -2.0;
      this.interactables.push(new Container(this, { id: 'hall_chest', type: 'chest', x: b.x + lx * cs + lz * sn, z: b.z - lx * sn + lz * cs, rot: b.rot - Math.PI / 2, loot: 'hall_chest', y: b.y + 0.6 }));
    }
  }

  spawnCreatures() {
    for (const s of SPAWNS) {
      const c = new Creature(this, s.type, s);
      c.setPosition(s.x, s.z);
      this.creatures.push(c);
    }
    // The Eye that hangs above the Spire.
    const sp = this.world.spots.spire?.eye;
    if (sp) {
      const rec = this.world.place('prop_spire_eye', sp.x, (sp.y ?? 9) + this.world.buildingsById.spire.y, sp.z, 0);
      this.spireEye = rec.wrapper;
      const ph = registry.placeholder('prop_spire_eye').root.userData.light;
      this.eyeLight = { x: sp.x, y: this.spireEye.position.y, z: sp.z, color: new THREE.Color(ph.color), intensity: ph.intensity, distance: ph.distance, interior: true, phase: 0 };
      this.world.lightAnchors.push(this.eyeLight);
    }
  }

  spawnCritters() {
    this.gulls = [];
    for (let i = 0; i < 9; i++) {
      const u = new Unit(this, { slot: 'critter_gull', name: 'Seagull', faction: 'neutral', radius: 0.2, height: 0.3 });
      const cx = [10, 180, -100, -170, 150, 40, -40, 200, 0][i], cz = [230, 60, 230, -170, 240, 200, 210, 100, 260][i];
      u.gull = { cx, cz, r: 10 + Math.random() * 18, h: 10 + Math.random() * 12, a: Math.random() * 6, s: 0.25 + Math.random() * 0.2 };
      this.gulls.push(u);
    }
  }

  // ------------------------------------------------------------------ session
  newGame(char) {
    this.resetSession();
    const cls = CLASSES[char.cls];
    this.sheet = new CharacterSheet({ ...char, gold: 0 });
    for (const id of cls.start) {
      const it = ITEMS[id];
      if (it.slot && !this.sheet.equip[it.slot]) this.sheet.equip[it.slot] = id;
      else this.sheet.add(id, 1);
    }
    this.sheet.add('minor_healing', 3);
    this.sheet.add('bread', 4);
    if (cls.resource === 'mana' || cls.manaPerInt > 0) this.sheet.add('minor_mana', 2);
    this.sheet.bar = this.defaultBar();
    this.sheet.recompute();
    this.quests = new QuestLog(this);
    this.dialog = new DialogEngine(this);
    this.createPlayer(charLook(this.sheet));
    this.player.setPosition(PLAYER_START.x, PLAYER_START.z);
    this.player.yaw = PLAYER_START.facing;
    this.rig.yaw = PLAYER_START.facing;
    this.rig.pitch = 0.22;
    this.rig.targetDistance = 5.5;
    this.player.hp = this.sheet.maxHp;
    this.player.mana = this.sheet.maxMana;
    this.player.st = this.sheet.maxSt;
    this.hour = 8.5;
    this.dayCount = 1;
    this.discovered = { docks: true, brackwater: false };
    this.startPlay();
    this.ui.showIntro();
  }

  resetSession() {
    this.timers = [];
    this.flags = {};
    this.containerLoot = {};
    this.target = null;
    this.channel = null;
    for (const c of this.creatures) if (c.type === 'darro' || c.type === 'deepspawn') c.dispose();
    this.creatures = this.creatures.filter((c) => !(c.type === 'darro' || c.type === 'deepspawn'));
    for (const c of this.creatures) if (c.spawn.x !== undefined) { c.respawn(); c.state = 'idle'; }
    if (this.wizard) { this.wizard.dispose(); this.wizard = null; }
    for (const n of this.npcs) { n.visual.setVisible(true); n.hidden = false; n.removedFromWorld = false; }
    for (const i of this.interactables) if (i.isContainer) { i.open = false; i.locked = !!i.def.locked; }
    if (this.player) { this.player.dispose(); this.player = null; }
  }

  createPlayer(char) {
    if (this.player) this.player.dispose();
    this.player = new Player(this, char);
    this.player.hp = this.sheet.maxHp;
    this.player.maxHp = this.sheet.maxHp;
    this.player.maxMana = this.sheet.maxMana;
    this.player.maxSt = this.sheet.maxSt;
    this.player.swingT = 0;
    this.sheet.onChange((what) => this.onSheetChanged(what));
    this.updateEquipmentVisuals();
  }

  defaultBar() {
    const abil = this.sheet.clsDef.abilities;
    const bar = new Array(10).fill(null);
    abil.forEach((a, i) => { bar[i] = { type: 'ability', id: a }; });
    bar[7] = { type: 'item', id: 'minor_healing' };
    bar[8] = { type: 'item', id: this.sheet.maxMana > 0 ? 'minor_mana' : 'bread' };
    bar[9] = { type: 'item', id: 'bread' };
    if (this.sheet.maxMana > 0) bar[9] = { type: 'item', id: 'bread' };
    return bar;
  }

  startPlay() {
    this.state = 'play';
    this.paused = false;
    this.ui.enterGame();
    this.rig.snapTo(this.player.pos);
    this.recomputePlayer();
    this.questsChanged();
  }

  // ------------------------------------------------------------------ saving
  serialize() {
    const p = this.player;
    return {
      version: 1, savedAt: Date.now(),
      sheet: this.sheet.serialize(),
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, hp: p.hp, mana: p.mana, st: p.st },
      quests: this.quests.serialize(), topics: this.dialog.serialize(),
      flags: this.flags, hour: this.hour, day: this.dayCount, containers: this.containerLoot, discovered: this.discovered,
      dead: this.creatures.filter((c) => c.def.noRespawn || c.spawn.respawn === 0).filter((c) => !c.alive).map((c) => c.type),
      effects: p.effects.filter((e) => e.stats).map((e) => ({ id: e.id, name: e.name, stats: e.stats, dur: e.dur - e.t, icon: e.icon })),
      cam: { yaw: this.rig.yaw, pitch: this.rig.pitch, dist: this.rig.targetDistance },
    };
  }

  save(auto = false) {
    if (this.state !== 'play' || !this.player) return false;
    const ok = storageSet(SAVE_KEY, JSON.stringify(this.serialize()));
    if (!auto) {
      if (ok) this.ui.toast('Game saved.', 2);
      else this.ui.toast('Saving is unavailable in this browser window. Try opening Play.html directly.', 5);
    }
    return ok;
  }

  hasSave() { return !!storageGet(SAVE_KEY); }
  saveInfo() {
    const d = safeParse(storageGet(SAVE_KEY));
    if (!d) return null;
    return { name: d.sheet.name, level: d.sheet.level, cls: CLASSES[d.sheet.cls]?.name, race: RACES[d.sheet.race]?.name, savedAt: d.savedAt };
  }

  load() {
    const d = safeParse(storageGet(SAVE_KEY));
    if (!d) { this.ui.toast('No saved game found.', 3); return false; }
    return this.loadData(d);
  }

  loadData(d) {
    try {
      this.resetSession();
      this.sheet = new CharacterSheet(d.sheet);
      if (!this.sheet.bar) this.sheet.bar = this.defaultBar();
      this.quests = new QuestLog(this, d.quests);
      this.dialog = new DialogEngine(this, d.topics);
      this.flags = d.flags || {};
      this.hour = d.hour ?? 9;
      this.dayCount = d.day || 1;
      this.containerLoot = d.containers || {};
      this.discovered = d.discovered || {};
      for (const i of this.interactables) if (i.isContainer && this.containerLoot[i.id]) i.locked = false;
      this.createPlayer(charLook(this.sheet));
      const p = this.player;
      p.setPosition(d.player.x, d.player.z, d.player.y);
      p.yaw = d.player.yaw;
      for (const e of d.effects || []) addEffect(this, p, { ...e, t: 0 });
      this.recomputePlayer();
      p.hp = Math.min(this.sheet.maxHp, d.player.hp);
      p.mana = Math.min(this.sheet.maxMana, d.player.mana);
      p.st = Math.min(this.sheet.maxSt, d.player.st);
      if (d.cam) { this.rig.yaw = d.cam.yaw; this.rig.pitch = d.cam.pitch; this.rig.targetDistance = d.cam.dist; }
      for (const type of d.dead || []) {
        for (const c of this.creatures) if (c.type === type) { c.alive = false; c.hp = 0; c.removed = true; c.visual.setVisible(false); c.corpseT = 999; }
      }
      this.applyStoryState();
      this.startPlay();
      this.ui.toast(`Welcome back, ${this.sheet.name}.`, 3);
      return true;
    } catch (e) {
      console.error(e);
      this.ui.toast('That save could not be loaded.', 4);
      return false;
    }
  }

  // Re-apply world changes implied by story flags (after loading).
  applyStoryState() {
    if (this.flags.darro_gone) this.hideNpc('darro');
    if (this.flags.wizardFell) this.spawnWizard(true);
    if (this.flags.spire_done && this.spireEye) this.spireEye.visible = false;
  }

  // ------------------------------------------------------------------ loop
  loop() {
    requestAnimationFrame(this.loop);
    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    this.elapsed += dt;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    try {
      this.update(Math.min(dt, 0.05));
    } catch (e) {
      console.error(e);
      this.ui?.toast(`Error: ${e.message}`, 4);
    }
    this.engine.render();
    this.input.endFrame();
  }

  update(dt) {
    const playing = this.state === 'play' && !this.paused;
    if (this.state === 'menu' || this.state === 'create') this.updateMenuCamera(dt);
    const talking = playing && this.ui.windows.modal();
    if (playing) for (const n of this.npcs) { if (!n.removedFromWorld) n.update(dt); }
    if (playing && !talking) {
      this.hour += (dt * 24) / (this.settings.dayMinutes * 60);
      if (this.hour >= 24) { this.hour -= 24; this.dayCount++; }
      this.updateTimers(dt);
      this.updatePlayer(dt);
      for (const c of this.creatures) {
        const d = Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z);
        if (d > 160 && c.state === 'idle') continue; // sleep far-away creatures
        updateEffects(this, c, dt);
        if (c.alive) {
          updateCast(this, c, dt);
          if (c.lockout) { c.lockout.t -= dt; if (c.lockout.t <= 0) c.lockout = null; }
          if (c.dash) this.updateDash(c, dt);
        }
        c.update(dt);
      }
      for (const i of this.interactables) i.update(dt);
      if (this.wizard) this.updateWizard(dt);
      this.updateZones();
      this.checkEvents();
      this.updateCombatState(dt);
      this.updateTargetValidity();
    }
    // Visual updates continue in menus so the world stays alive.
    if (this.player) this.player.updateVisual(dt);
    for (const n of this.npcs) n.updateVisual(dt);
    for (const c of this.creatures) {
      const d = this.player ? Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z) : 0;
      c.group.visible = !c.removed && d < 220;
      if (c.group.visible) c.updateVisual(dt);
    }
    this.updateGulls(dt);
    if (this.state === 'play' && this.player) this.rig.update(dt, this.player.pos, this.player.height);
    const focus = this.player && this.state === 'play' ? this.player.pos : this.menuFocus || new THREE.Vector3(10, 2, 180);
    this.world.update(dt, this.elapsed, this.hour, focus, this.camera.position);
    this.lights.update(dt, focus, this.world.sky.nightFactor, this.elapsed);
    if (this.eyeLight && this.spireEye) {
      this.spireEye.rotation.y += dt * 0.4;
      this.spireEye.position.y = this.eyeLight.y + Math.sin(this.elapsed * 0.8) * 0.4;
      this.eyeLight.intensity = this.spireEye.visible ? 14 : 0;
    }
    this.fx.update(dt);
    if (this.player && this.state === 'play') {
      if (this.player.visual) this.player.visual.setVisible(!this.rig.firstPerson);
      this.audio.listener = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, yaw: this.rig.yaw };
      this.audio.update(dt, this.audioEnv());
      this.audio.setMood(this.musicMood());
    } else {
      this.audio.update(dt, { coast: 0.8, height: 5, marsh: 0, indoors: false });
      this.audio.setMood('explore');
    }
    this.ui.update(dt);
  }

  updateMenuCamera(dt) {
    if (this.state === 'create' && this.player) {
      const p = this.player.pos;
      const yaw = this.player.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      this.camera.position.set(p.x + fx * 3.2 - fz * 0.9, p.y + 1.45, p.z + fz * 3.2 + fx * 0.9);
      this.camera.lookAt(p.x - fz * 0.5, p.y + 1.05, p.z + fx * 0.5);
      this.menuFocus = p;
      return;
    }
    const t = this.elapsed * 0.03;
    const cx = 12, cz = 190;
    this.camera.position.set(cx + Math.cos(t) * 70, 26 + Math.sin(t * 0.7) * 4, cz + Math.sin(t) * 70);
    this.camera.lookAt(cx, 4, cz - 10);
    this.menuFocus = new THREE.Vector3(cx, 2, cz);
  }

  // ------------------------------------------------------------------ player
  updatePlayer(dt) {
    const p = this.player;
    const input = this.input;
    const ui = this.ui;
    const canAct = p.alive && !ui.modalOpen() && !isStunned(p) && !this.channelBlocks();
    // Camera control.
    const dragging = input.mouseDown(0) || input.mouseDown(2);
    if ((dragging || input.pointerLocked) && !ui.modalOpen()) this.rig.rotate(input.mouse.dx, input.mouse.dy);
    if (input.mouse.wheel && !ui.pointerOverUi) this.rig.zoom(input.mouse.wheel);
    // Leaving pointer lock (Esc, alt-tab) also leaves mouse-look mode.
    if (this.mouselook && !input.pointerLocked && this._lockSeen) { this.mouselook = false; this._lockSeen = false; this.ui.setCrosshair(false); }
    if (input.pointerLocked) this._lockSeen = true;
    // Movement (disabled while rooted/dashing/dead).
    let res = { moving: false };
    if (p.dash) this.updateDash(p, dt);
    else if (!p.alive) p.move(dt, 0, 0, 0);
    else if (isRooted(p) || ui.blockMovement()) { p.move(dt, 0, 0, 0); }
    else {
      p.speedMult = () => speedMult(p) * (p.effects.some((e) => e.id === 'tipsy') ? 0.92 : 1);
      p.jumpMult = p.effects.some((e) => e.jump) ? 2.4 : 1;
      p.swimBonus = this.sheet.race === 'skarn' ? 1.5 : 1;
      res = p.control(dt, input, this.rig, canAct);
    }
    if (p.jumped) { p.jumped = false; this.audio.play('jump', p.pos); }
    // Footsteps
    if (p.grounded && p.speedNow > 1) {
      this.stepT = (this.stepT || 0) - dt * p.speedNow;
      if (this.stepT <= 0) {
        this.stepT = 2.1;
        const surf = this.surfaceAt(p.pos);
        this.audio.play(`step_${surf}`, null, 0.5);
      }
    }
    // Landing & fall damage.
    if (p.lastFallSpeed) {
      const v = p.lastFallSpeed;
      p.lastFallSpeed = 0;
      if (v > 6) this.audio.play('land', p.pos);
      const safe = p.effects.some((e) => e.featherfall);
      if (v > 15 && !safe) {
        const dmg = Math.round((v - 15) * (v - 15) * 0.9 + (v - 15) * 6);
        dealDamage(this, null, p, dmg, { ignoreArmor: true, name: 'Falling' });
        this.log(`You take ${dmg} falling damage.`, 'combat');
      }
    }
    if (p.swimming && !this.wasSwimming) this.audio.play('splash', p.pos);
    this.wasSwimming = p.swimming;
    // Movement cancels casting & channels.
    if (res.moving || !p.grounded && !p.swimming) {
      if (p.cast) { p.cast = null; p.visual.stop('channel'); this.ui.castChanged(p); }
      if (this.channel) this.cancelChannel();
    }
    // Resources.
    p.maxHp = this.sheet.maxHp; p.maxMana = this.sheet.maxMana; p.maxSt = this.sheet.maxSt;
    const inC = this.playerInCombat;
    if (p.alive) {
      const regenHp = inC ? 0.002 : 0.022;
      if (!inC || this.elapsed - (p.lastHitT || 0) > 6) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regenHp * dt);
      if (p.swimming && this.sheet.race === 'skarn') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.01 * dt);
      const castRecently = this.elapsed - (p.lastCastT || -10) < 4;
      p.mana = Math.min(p.maxMana, p.mana + p.maxMana * (inC ? (castRecently ? 0.006 : 0.015) : 0.04) * dt);
      if (res.sprinting) p.st = Math.max(0, p.st - 14 * dt);
      else p.st = Math.min(p.maxSt, p.st + (inC ? 7 : 16) * dt);
    }
    // Timers.
    p.gcd = Math.max(0, p.gcd - dt);
    for (const k of Object.keys(p.cooldowns)) { p.cooldowns[k] -= dt; if (p.cooldowns[k] <= 0) delete p.cooldowns[k]; }
    for (const k of Object.keys(this.itemCooldowns || {})) { this.itemCooldowns[k] -= dt; if (this.itemCooldowns[k] <= 0) delete this.itemCooldowns[k]; }
    updateEffects(this, p, dt);
    if (p.cast) { p.lastCastT = this.elapsed; updateCast(this, p, dt); }
    this.updateChannel(dt);
    // Input actions.
    if (canAct || (p.alive && !ui.modalOpen())) this.handleActions(dt, canAct);
    this.updateAutoAttack(dt);
    // Drowning in the deep? No: the sea is kind. But falling off the world edge is not.
    if (p.pos.y < -30) { p.setPosition(RESPAWN.x, RESPAWN.z); }
  }

  surfaceAt(pos) {
    const t = this.world.terrain.heightAt(pos.x, pos.z);
    if (pos.y > t + 0.15) return 'wood';
    return this.world.terrain.roadAt(pos.x, pos.z) > 0.5 ? 'stone' : 'grass';
  }

  handleActions(dt, canAct) {
    const input = this.input, p = this.player;
    for (let i = 0; i < 10; i++) if (input.hit(`bar${i + 1}`) && canAct) this.useBarSlot(i);
    if (input.hit('target')) this.cycleTarget();
    if (input.hit('interact') && canAct) this.interact();
    if (input.hit('camera')) this.rig.setFirstPerson(!this.rig.firstPerson && this.rig.targetDistance > 0.5);
    if (input.hit('mouselook')) this.toggleMouselook();
    // Mouse clicks on the world.
    for (const c of input.clicks) {
      if (this.ui.pointerOverUi) continue;
      const pick = input.pointerLocked ? this.pickCenter() : this.pickAt(c.x, c.y);
      if (c.button === 0) {
        if (input.pointerLocked) this.mouselookPrimary(pick, canAct);
        else if (pick && pick.unit) this.setTarget(pick.unit);
        else if (!pick) this.setTarget(null);
      } else if (c.button === 2 && pick) {
        this.useWorldThing(pick, canAct);
      }
    }
    if (input.pointerLocked && input.mouseDown(0) && canAct && this.target && this.isHostile(p, this.target)) p.autoAttack = true;
  }

  toggleMouselook() {
    this.mouselook = !this.mouselook;
    this._lockSeen = false;
    if (this.mouselook) { this.input.requestLock(); this.ui.toast('Mouse-look on. Press T or Esc to release the cursor.', 2.5); }
    else { this.input.exitLock(); }
    this.ui.setCrosshair(this.mouselook);
  }

  mouselookPrimary(pick, canAct) {
    if (pick && pick.unit && pick.unit.alive && this.isHostile(this.player, pick.unit)) {
      this.setTarget(pick.unit);
      this.player.autoAttack = true;
      if (this.player.edgeDist(pick.unit) > MELEE_RANGE + 0.5) this.error('Out of range.');
    } else if (pick && pick.unit) {
      this.setTarget(pick.unit);
    } else if (canAct && this.player.swingT <= 0) {
      this.player.visual.play('slash', 0.5);
      this.audio.play('swing', this.player.pos);
      this.player.swingT = 0.8;
    }
  }

  useWorldThing(pick, canAct) {
    const p = this.player;
    if (pick.unit) {
      const u = pick.unit;
      this.setTarget(u);
      if (u.isNpc) { if (p.distTo(u) < 4.5) this.talkTo(u); else this.error('You are too far away.'); return; }
      if (u.isCreature && !u.alive) { if (p.distTo(u) < 4) this.lootCorpse(u); else this.error('You are too far away.'); return; }
      if (u.alive && this.isHostile(p, u)) { p.autoAttack = true; return; }
    } else if (pick.obj) {
      if (p.distTo(pick.obj) - pick.obj.radius < 2.5) this.useObject(pick.obj);
      else this.error('You are too far away.');
    }
  }

  // Interact with whatever is in front of you (or targeted and close).
  interact() {
    const best = this.interactCandidate();
    if (!best) return;
    if (best.unit) {
      if (best.unit.isNpc) this.talkTo(best.unit);
      else if (best.unit.isCreature && !best.unit.alive) this.lootCorpse(best.unit);
    } else if (best.obj) this.useObject(best.obj);
  }

  interactCandidate() {
    const p = this.player;
    if (!p || !p.alive) return null;
    if (this.input.pointerLocked) {
      const pk = this.pickCenter();
      if (pk) {
        const d = pk.unit ? p.distTo(pk.unit) : p.distTo(pk.obj) - pk.obj.radius;
        if (d < 3.5 && (!pk.unit || pk.unit.isNpc || (pk.unit.isCreature && !pk.unit.alive && pk.unit.loot))) return pk;
      }
      return null;
    }
    let best = null, bestScore = Infinity;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const consider = (pos, extra, item) => {
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.2 + extra || Math.abs(pos.y - p.pos.y) > 2.5) return;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (facing < -0.1 && d > 1.2 + extra) return;
      const score = d - extra - facing * 1.2;
      if (score < bestScore) { bestScore = score; best = item; }
    };
    for (const n of this.npcs) if (!n.removedFromWorld) consider(n.pos, 0.6, { unit: n });
    for (const c of this.creatures) if (!c.alive && !c.removed && c.loot && (c.loot.items.length || c.loot.gold)) consider(c.pos, c.radius, { unit: c });
    for (const o of this.interactables) if (o.enabled && o.group.visible) consider(o.pos, o.radius * 0.6, { obj: o });
    if (this.wizard && this.wizard.landed && this.wizard.loot) consider(this.wizard.pos, 0.5, { obj: this.wizardObj });
    return best;
  }

  useObject(o) {
    if (!o.canUse()) {
      if (o.isHerb) this.error('You have no use for this right now.');
      return;
    }
    o.use();
  }

  talkTo(npc) {
    if (!this.player.alive) return;
    if (this.playerInCombat) { this.error('You cannot talk while in combat.'); return; }
    this.ui.openDialog(npc);
  }

  // ------------------------------------------------------------------ action bar & items
  useBarSlot(i) {
    const s = this.sheet.bar[i];
    if (!s) return;
    if (s.type === 'ability') this.useAbility(s.id);
    else if (s.type === 'item') this.useItemById(s.id);
  }

  useAbility(id) {
    if (!this.sheet.knownAbilities().includes(id)) { this.error(`You need to be level ${this.abilityLevel(id)} to use that.`); return; }
    const err = tryUseAbility(this, this.player, id);
    if (err) this.error(err);
  }

  abilityLevel(id) {
    const i = this.sheet.clsDef.abilities.indexOf(id);
    return [1, 1, 2, 3, 4, 5][i] || 1;
  }

  useItemById(id) {
    const idx = this.sheet.bags.findIndex((s) => s && s.id === id);
    if (idx < 0) { this.error(`You have no ${ITEMS[id]?.name || 'such item'}.`); return; }
    this.useBagItem(idx);
  }

  useBagItem(idx) {
    const s = this.sheet.bags[idx];
    if (!s) return;
    const it = ITEMS[s.id];
    const p = this.player;
    if (!p.alive) return;
    if (it.book) { this.ui.showBook(it.book); this.audio.play('open'); return; }
    if (it.slot) {
      const err = this.sheet.equipFromBag(idx);
      if (err) this.error(err);
      else this.audio.play('equip');
      return;
    }
    if (it.type !== 'consumable') { this.error('You cannot use that.'); return; }
    this.itemCooldowns = this.itemCooldowns || {};
    const cdKey = it.use.heal || it.use.mana ? 'potion' : it.use.food ? 'food' : s.id;
    if (this.itemCooldowns[cdKey] > 0) { this.error('That item is not ready yet.'); return; }
    const u = it.use;
    if (u.food && this.playerInCombat) { this.error('You cannot eat while in combat.'); return; }
    if (u.heal) { p.hp = Math.min(p.maxHp, p.hp + u.heal); this.fct(p, `+${u.heal}`, 'heal'); this.audio.play('drink'); this.fx.sparkle(p, 0xff6060); }
    if (u.mana) { p.mana = Math.min(p.maxMana, p.mana + u.mana); this.fct(p, `+${u.mana} mana`, 'mana'); this.audio.play('drink'); }
    if (u.stamina) { p.st = Math.min(p.maxSt, p.st + u.stamina); this.audio.play('drink'); }
    if (u.food) {
      addEffect(this, p, { id: 'food', name: 'Food', food: u.food / u.duration, interval: 1, dur: u.duration, icon: `icon_${s.id}` });
      p.sitting = true;
      this.audio.play('eat');
      if (u.buff) this.after(10, () => { if (p.effects.some((e) => e.id === 'food')) addEffect(this, p, { ...u.buff, icon: 'icon_fx_well_fed' }); });
    } else if (u.buff) {
      addEffect(this, p, { ...u.buff, icon: `icon_fx_${u.buff.id}` });
      this.fx.sparkle(p, 0x9a6aff);
      this.audio.play('arcane');
      if (u.buff.jump) this.log('Your legs thrum with arcane power. Mind the landing.', 'system');
    }
    if (u.tipsy) addEffect(this, p, { id: 'tipsy', name: 'Tipsy', dur: u.tipsy, icon: 'icon_fx_tipsy' });
    if (it.cooldown) this.itemCooldowns[cdKey] = it.cooldown;
    this.sheet.removeAt(idx, 1);
  }

  // ------------------------------------------------------------------ targeting & picking
  setTarget(u) {
    if (this.target === u) return;
    this.target = u;
    this.player.target = u;
    if (!u) this.player.autoAttack = false;
    this.ui.targetChanged();
  }

  updateTargetValidity() {
    const t = this.target;
    if (!t) return;
    if (t.removed || t.removedFromWorld || (t.isCreature && !t.alive && !t.loot) || this.player.distTo(t) > 80) this.setTarget(null);
    if (t && t.isCreature && !t.alive) this.player.autoAttack = false;
  }

  isHostile(a, b) {
    if (!a || !b || a === b) return false;
    if (a.isPlayer) return b.faction === 'hostile';
    if (b.isPlayer) return a.faction === 'hostile';
    return false;
  }

  nearestEnemy(caster, range, inFront) {
    let best = null, bd = Infinity;
    const fx = Math.sin(caster.yaw), fz = Math.cos(caster.yaw);
    for (const c of this.creatures) {
      if (!c.alive || c.removed) continue;
      const d = caster.edgeDist(c);
      if (d > range) continue;
      const dx = c.pos.x - caster.pos.x, dz = c.pos.z - caster.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      if (inFront && (dx * fx + dz * fz) / l < 0.3 && d > 2) continue;
      const score = d - (c.state === 'combat' ? 5 : 0);
      if (score < bd) { bd = score; best = c; }
    }
    return best;
  }

  cycleTarget() {
    const p = this.player;
    const fx = Math.sin(this.rig.yaw), fz = Math.cos(this.rig.yaw);
    const list = this.creatures.filter((c) => {
      if (!c.alive || c.removed) return false;
      const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      return d < 40 && (dx * fx + dz * fz) / (d || 1) > 0.2 && this.lineOfSight(p, c);
    }).sort((a, b) => p.distTo(a) - p.distTo(b));
    if (!list.length) return;
    const i = list.indexOf(this.target);
    this.setTarget(list[(i + 1) % list.length]);
  }

  enemiesNear(caster, pos, radius) {
    return this.creatures.filter((c) => c.alive && !c.removed && this.isHostile(caster, c) && Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) - c.radius <= radius);
  }
  hostilesOf(creature, pos, radius) {
    const p = this.player;
    return p && p.alive && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) <= radius + p.radius ? [p] : [];
  }

  lineOfSight(a, b) {
    const ay = a.pos.y + (a.height || 1.6) * 0.8, by = b.pos.y + (b.height || 1.6) * 0.6;
    return this.world.collision.segmentFree(a.pos.x, ay, a.pos.z, b.pos.x, by, b.pos.z, 0.6, false, false) >= 0.99;
  }

  rayFromScreen(sx, sy) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray.ray;
  }

  pickCenter() {
    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    return this.pickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  // Ray against vertical cylinders around units and objects.
  pickAt(sx, sy) {
    const ray = this.rayFromScreen(sx, sy);
    let best = null, bt = Infinity;
    const test = (pos, r, h, item) => {
      const t = rayCylinder(ray, pos, r, h);
      if (t !== null && t < bt && t < 90) { bt = t; best = item; }
    };
    for (const n of this.npcs) if (!n.removedFromWorld) test(n.pos, 0.5, n.visual.height, { unit: n });
    for (const c of this.creatures) if (!c.removed && c.group.visible) test(c.pos, Math.max(0.5, c.radius), c.alive ? c.visual.height : 0.8, { unit: c });
    for (const o of this.interactables) if (o.enabled && o.group.visible) test(o.pos, o.radius * 0.8, o.height, { obj: o });
    if (this.wizard && this.wizardObj && this.wizard.landed) test(this.wizard.pos, 0.8, 0.6, { obj: this.wizardObj });
    if (best) {
      // Reject picks hidden behind walls.
      const o = ray.origin, d = ray.direction;
      const free = this.world.collision.segmentFree(o.x, o.y, o.z, o.x + d.x * bt, o.y + d.y * bt, o.z + d.z * bt, 0.5, false, false);
      if (free < 0.95) return null;
    }
    return best;
  }

  // ------------------------------------------------------------------ combat glue
  enterCombat(a, b) {
    if (a.isPlayer || b.isPlayer) {
      this.combatT = 5;
      const other = a.isPlayer ? b : a;
      if (other.isCreature) other.engage(this.player);
    }
  }

  updateCombatState(dt) {
    this.combatT = Math.max(0, this.combatT - dt);
    const engaged = this.creatures.some((c) => c.alive && c.state === 'combat' && c.target === this.player);
    const was = this.playerInCombat;
    this.playerInCombat = engaged || this.combatT > 0;
    if (this.playerInCombat !== was) {
      this.ui.combatChanged(this.playerInCombat);
      if (this.playerInCombat) { this.player.sitting = false; removeEffect(this, this.player, 'food'); }
    }
    if (this.player.sitting && (this.player.speedNow > 0.3 || !this.player.effects.some((e) => e.id === 'food'))) this.player.sitting = false;
  }

  updateAutoAttack(dt) {
    const p = this.player;
    p.swingT = Math.max(0, (p.swingT || 0) - dt);
    const t = this.target;
    if (!p.autoAttack || !t || !t.alive || !this.isHostile(p, t) || !p.alive || isStunned(p) || p.cast) return;
    const d = p.edgeDist(t);
    if (d > MELEE_RANGE + 0.2) return;
    const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
    const facing = (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / (Math.hypot(dx, dz) || 1);
    if (p.speedNow < 0.5) { p.faceUnit(t); }
    else if (facing < 0.2) return;
    if (p.swingT > 0) return;
    p.swingT = this.sheet.weapon.speed;
    const w = this.sheet.weapon.wtype;
    p.visual.play(w === 'dagger' ? 'stab' : w === 'staff' ? 'overhead' : 'slash', Math.min(0.6, p.swingT * 0.4));
    this.audio.play('swing', p.pos);
    this.after(0.18, () => {
      if (!t.alive || !p.alive) return;
      const r = rollMelee(p, t, 1);
      if (!r.hit) { this.fct(t, r.dodge ? 'Dodge' : 'Miss', 'info'); return; }
      dealDamage(this, p, t, r.amount, { crit: r.crit });
    });
    this.enterCombat(p, t);
  }

  updateDash(u, dt) {
    const d = u.dash;
    const t = d.target;
    const dist = u.edgeDist(t);
    if (!t.alive || dist < 0.6 || (d.t = (d.t || 0) + dt) > 1.6) {
      u.dash = null;
      u.vel.set(0, 0, 0);
      if (t.alive && dist < 2) d.onArrive?.();
      return;
    }
    const dx = t.pos.x - u.pos.x, dz = t.pos.z - u.pos.z, l = Math.hypot(dx, dz) || 1;
    u.yaw = Math.atan2(dx, dz);
    u.move(dt, dx / l, dz / l, d.speed);
    if (Math.random() < 0.7) this.fx.p.emit(u.pos.x, u.pos.y + 0.3, u.pos.z, 0, 0.5, 0, 0xc0a080, 0.5, 0.4);
  }

  kill(unit, killer) {
    if (!unit.alive) return;
    unit.alive = false;
    unit.hp = 0;
    unit.cast = null;
    unit.effects = [];
    unit.visual.play('death');
    this.ui.castChanged(unit);
    if (unit.isPlayer) { this.onPlayerDeath(); return; }
    if (unit.isCreature) this.onCreatureDeath(unit, killer);
  }

  onCreatureDeath(c, killer) {
    this.audio.play(`aggro_${c.def.sound}`, c.pos, 0.5);
    c.loot = this.rollLoot(c.def.loot, false, c);
    if (killer && killer.isPlayer || this.player.distTo(c) < 60) {
      const diff = c.level - this.sheet.level;
      let f = Math.max(0.15, Math.min(1.4, 1 + diff * 0.12));
      if (diff <= -3) f = 0.1;
      const xp = Math.round(levelXp(c.level) * (c.def.xp || 1) * f * (c.elite ? 1.5 : 1));
      if (xp > 0 && c.type !== 'deepspawn') this.addXp(xp, 'kill');
      this.sheet.kills++;
      this.questEvent('kill', c.def.tag);
    }
    if (c.boss) this.onBossDeath(c);
    if (c.type === 'darro' && !this.flags.darro_resolved) {
      this.setFlag('darro_resolved');
      this.setFlag('darro_gone');
      this.quests.addJournal('taxman', "Darro Vex chose to fight rather than face the Watch, and died for it. I should return Pell's ledger to Tidewarden Garrow.");
    }
    if (this.target === c && !(c.loot.items.length || c.loot.gold)) this.setTarget(null);
  }

  onBossDeath(c) {
    this.yell(c, 'The Eye... will... see...');
    for (const a of this.creatures) if (a.type === 'deepspawn' && a.alive) this.kill(a, null);
    if (this.spireEye) {
      this.fx.burst(this.spireEye.position.clone().setY(this.spireEye.position.y - 1), 0x40e0e0, 80, 8, 0.6);
      this.spireEye.visible = false;
    }
    this.setFlag('morwen_dead');
    this.rig.shake = 1;
    this.ui.banner('The Eye Closes', 'Sister Morwen is defeated.');
  }

  onPlayerDeath() {
    this.sheet.deaths++;
    this.player.autoAttack = false;
    this.audio.play('death_player');
    for (const c of this.creatures) if (c.target === this.player && c.alive) c.startEvade();
    this.ui.showDeath();
  }

  respawnAtShrine() {
    const p = this.player;
    p.alive = true;
    p.visual.play('revive');
    // During the final quest you wake at the foot of the Tor instead of back in the village.
    const nearTor = this.questActive('spire') && this.questStage('spire') === 2 && Math.hypot(p.pos.x - 30, p.pos.z + 150) < 90;
    if (nearTor) p.setPosition(TOR_CHECKPOINT.x, TOR_CHECKPOINT.z);
    else p.setPosition(RESPAWN.x, RESPAWN.z);
    p.hp = Math.round(p.maxHp * 0.6);
    p.mana = Math.round(p.maxMana * 0.6);
    p.effects = [];
    this.recomputePlayer();
    this.rig.snapTo(p.pos);
    this.fx.sparkle(p, 0x80d0ff);
    this.log(nearTor ? 'You wake on the slope below the Tor, bruised but breathing.' : 'You wake beside the Shrine of the Tide, soaked and shivering.', 'system');
  }

  yell(unit, text) {
    this.log(`${unit.name} yells: ${text}`, 'yell');
    this.ui.speech(unit, text, 'yell');
  }

  spawnAdds(boss, type, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const s = { type, x: boss.pos.x + Math.cos(a) * 6, z: boss.pos.z + Math.sin(a) * 6, wander: 0, level: boss.level - 1, respawn: 0 };
      const c = new Creature(this, type, s);
      c.setPosition(s.x, s.z);
      this.creatures.push(c);
      this.fx.burst(c.pos, 0x40a0c0, 30, 5);
      c.engage(this.player);
    }
  }

  onSurrender(c) {
    if (c.type !== 'darro' || this.flags.darro_resolved) return;
    c.faction = 'neutral';
    c.state = 'idle';
    c.target = null;
    c.cast = null;
    c.effects = [];
    this.player.autoAttack = false;
    if (this.target === c) this.setTarget(null);
    this.speechAndLog(c, 'Enough! Enough, I yield! Take your cursed ledger. I\'ll go quietly.');
    this.setFlag('darro_resolved');
    this.setFlag('darro_gone');
    this.quests.addJournal('taxman', "Darro Vex fought me rather than face the Watch, then threw down his blade and surrendered. Captain Rook's guards will take him. I should return Pell's ledger to Tidewarden Garrow.");
    this.after(4.5, () => { c.visual.setVisible(false); c.removed = true; c.alive = false; c.state = 'gone'; });
  }

  speechAndLog(unit, text) {
    this.log(`${unit.name} says: ${text}`, 'say');
    this.ui.speech(unit, text, 'say');
  }

  // ------------------------------------------------------------------ channels (gathering, etc.)
  startChannel(label, dur, onDone, icon) {
    if (this.playerInCombat) { this.error('You are in combat.'); return; }
    this.channel = { label, dur, t: 0, onDone, icon };
    this.player.visual.play('use', dur);
    this.ui.castChanged(this.player);
  }
  updateChannel(dt) {
    const c = this.channel;
    if (!c) return;
    c.t += dt;
    if (c.t >= c.dur) {
      this.channel = null;
      this.ui.castChanged(this.player);
      c.onDone();
    }
  }
  cancelChannel() {
    if (!this.channel) return;
    this.channel = null;
    this.ui.castChanged(this.player);
  }
  channelBlocks() { return false; }

  // ------------------------------------------------------------------ rewards & inventory
  addXp(amount, source) {
    const before = this.sheet.level;
    const gained = this.sheet.addXp(amount);
    this.fct(this.player, `+${Math.round(amount * (this.sheet.race === 'westerling' ? 1.1 : 1))} XP`, 'xp');
    if (gained) {
      this.fx.levelUp(this.player);
      this.audio.play('levelup');
      this.recomputePlayer();
      this.player.hp = this.player.maxHp;
      this.player.mana = this.player.maxMana;
      this.player.st = this.player.maxSt;
      const lvl = this.sheet.level;
      const newAb = this.sheet.clsDef.abilities.filter((a, i) => [1, 1, 2, 3, 4, 5][i] > before && [1, 1, 2, 3, 4, 5][i] <= lvl);
      this.ui.levelUp(lvl, newAb);
      this.log(`You have reached level ${lvl}! You have ${this.sheet.points} attribute points to spend.`, 'system');
      this.questEvent('level');
    }
  }

  addGold(n) {
    this.sheet.gold += n;
    this.sheet.changed('gold');
    this.audio.play('coin');
    this.log(`You receive ${n} gold.`, 'loot');
  }

  giveItem(id, n = 1, quiet = false) {
    const added = this.sheet.add(id, n);
    if (added < n) this.error('Your bags are full.');
    if (added > 0) {
      const it = ITEMS[id];
      if (!quiet) this.log(`You receive: [${it.name}]${added > 1 ? ` x${added}` : ''}.`, 'loot', it.quality);
      if (id === 'pell_ledger') this.learnTopic("Pell's ledger");
      this.questEvent('item');
    }
    return added === n;
  }
  removeItem(id, n = 1) {
    const r = this.sheet.remove(id, n);
    this.questEvent('item');
    return r;
  }
  hasItem(id) { return this.sheet.has(id); }

  rollLoot(tableId, isContainer, creature) {
    const out = { gold: 0, items: [] };
    const t = LOOT[tableId];
    if (!t) return out;
    if (t.gold) out.gold = Math.floor(t.gold[0] + Math.random() * (t.gold[1] - t.gold[0] + 1));
    if (creature && creature.level) out.gold = Math.round(out.gold * (0.7 + creature.level * 0.15));
    for (const [id, chance, [a, b]] of t.items || []) {
      if (chance === 0) {
        if (this.questNeedsItem(id)) out.items.push({ id, count: 1 });
        continue;
      }
      if (Math.random() < chance) out.items.push({ id, count: a + Math.floor(Math.random() * (b - a + 1)) });
    }
    if (t.oneOf) out.items.push({ id: t.oneOf[Math.floor(Math.random() * t.oneOf.length)], count: 1 });
    return out;
  }

  lootCorpse(c) {
    if (!c.loot || (!c.loot.items.length && !c.loot.gold)) { this.error('There is nothing to loot.'); return; }
    this.ui.openLoot({ name: () => c.name, isCorpse: true, creature: c }, c.loot);
  }

  takeLoot(loot, index, source) {
    if (index === 'gold') {
      if (loot.gold > 0) { this.addGold(loot.gold); loot.gold = 0; }
      return true;
    }
    const it = loot.items[index];
    if (!it) return false;
    if (!this.sheet.canAdd(it.id, it.count)) { this.error('Your bags are full.'); return false; }
    this.giveItem(it.id, it.count);
    loot.items.splice(index, 1);
    this.audio.play('loot');
    return true;
  }

  questNeedsItem(id) {
    if (!this.quests) return false;
    for (const [qid, st] of Object.entries(this.quests.state)) {
      if (st.status === 'done') continue;
      const stage = QUESTS[qid].stages[st.stage];
      if (stage && stage.objectives.some((o) => o.type === 'collect' && o.item === id && this.sheet.count(id) < o.count)) return true;
    }
    return false;
  }

  recomputePlayer() {
    if (!this.sheet || !this.player) return;
    const bs = { str: 0, agi: 0, int: 0, end: 0 };
    for (const e of this.player.effects) if (e.stats) for (const [k, v] of Object.entries(e.stats)) bs[k] += v;
    this.sheet.buffStats = bs;
    this.sheet.recompute();
    const p = this.player;
    const hpF = p.maxHp ? p.hp / p.maxHp : 1;
    p.maxHp = this.sheet.maxHp; p.maxMana = this.sheet.maxMana; p.maxSt = this.sheet.maxSt;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    if (!p.alive) return;
    if (hpF > 0 && p.hp === 0) p.hp = p.maxHp * hpF;
    this.ui?.statsChanged();
  }

  addPlayerEffect(e) { addEffect(this, this.player, e); }

  onSheetChanged(what) {
    if (what === 'equip') { this.updateEquipmentVisuals(); this.recomputePlayer(); }
    if (what === 'stats' || what === 'xp') this.recomputePlayer();
    if (what === 'bags' || what === 'equip') this.questEvent('item');
    this.ui?.sheetChanged(what);
  }

  updateEquipmentVisuals() {
    const p = this.player, s = this.sheet;
    if (!p) return;
    const main = ITEMS[s.equip.mainhand];
    if (main && main.model) p.visual.attach('grip_r', main.model, { upright: main.wtype === 'staff', offsetY: main.wtype === 'staff' ? -0.55 : 0 });
    else p.visual.detach('grip_r');
    const off = ITEMS[s.equip.offhand];
    if (off && off.model) p.visual.attach('shield_l', off.model);
    else p.visual.detach('shield_l');
    // Tint the placeholder's shirt with the chest armor's color.
    const chest = ITEMS[s.equip.chest];
    const tint = chest && chest.tint ? chest.tint : null;
    if (!p.visual.isOverride && (p._tint ?? null) !== tint) {
      p._tint = tint;
      p.rebuildLook({ ...charLook(s), shirtOverride: tint });
    }
  }

  // ------------------------------------------------------------------ quests & story helpers
  questsChanged() {
    if (!this.quests) return;
    for (const n of this.npcs) n.setMarker(this.quests.markerFor(n.id));
    this.ui?.questsChanged();
  }
  questEvent(type, key) { if (this.quests) this.quests.event(type, key); }
  questDone(id) { return this.quests?.isDone(id); }
  questActive(id) { return this.quests?.isActive(id); }
  questStarted(id) { return !!this.quests?.state[id]; }
  questStage(id) { return this.quests?.stage(id) ?? -1; }
  setFlag(f, v = true) { this.flags[f] = v; this.questEvent('flag'); }
  learnTopic(t) { if (this.dialog && this.dialog.learn(t)) this.ui?.topicLearned(t); }
  npcName(id) { const n = NPCS.find((x) => x.id === id); return n ? n.name : id; }
  fillText(t) { return (t || '').replace(/\{name\}/g, this.sheet ? this.sheet.name : 'stranger'); }
  day() { return this.dayCount; }

  darroBribe() {
    this.removeItem('pell_ledger', 1);
    this.flags.bribed = true;
    this.giveItem('smuggler_stiletto', 1);
    this.addGold(150);
    this.setFlag('darro_resolved');
    const st = this.quests.state.taxman;
    st.status = 'done';
    st.outcome = 'bribed';
    this.quests.addJournal('taxman', "I gave Pell's ledger to Darro Vex in exchange for a hundred and fifty crowns and a fine stiletto. As far as Tidewarden Garrow will ever know, the ledger was lost in the Fen.");
    this.addXp(300, 'quest');
    this.audio.play('quest_complete');
    this.ui.questCompleted('taxman', true);
    this.questsChanged();
    this.ui.closeDialog();
  }

  darroFight() {
    const npc = this.npcs.find((n) => n.id === 'darro');
    this.ui.closeDialog();
    this.hideNpc('darro');
    const s = { type: 'darro', x: npc.pos.x, z: npc.pos.z, wander: 0, level: 3, respawn: 0 };
    const c = new Creature(this, 'darro', s);
    c.setPosition(npc.pos.x, npc.pos.z, npc.pos.y);
    c.spawn.leash = 80;
    c.def = { ...c.def, leash: 80 };
    this.creatures.push(c);
    this.speechAndLog(c, 'Then you can join Pell in the reeds!');
    c.engage(this.player);
    this.setTarget(c);
  }

  hideNpc(id) {
    const n = this.npcs.find((x) => x.id === id);
    if (!n) return;
    n.visual.setVisible(false);
    n.marker.visible = false;
    n.removedFromWorld = true;
    n.group.visible = false;
  }

  // ------------------------------------------------------------------ zones & events
  updateZones() {
    const p = this.player;
    const z = this.world.zoneAt(p.pos.x, p.pos.z);
    const id = z ? z.id : null;
    if (id !== this.zoneId) {
      this.zoneId = id;
      this.ui.zoneChanged(z);
      if (z && !this.discovered[z.id]) {
        this.discovered[z.id] = true;
        this.ui.banner(z.name, z.xp ? `Discovered · ${z.xp} XP` : '');
        if (z.xp) this.addXp(z.xp, 'explore');
        this.learnTopic(z.name);
      }
    }
  }

  checkEvents() {
    const p = this.player;
    // The falling wizard.
    if (!this.flags.wizardFell && this.questStarted('fresh_boat') && Math.hypot(p.pos.x - WIZARD_FALL.x, p.pos.z - WIZARD_FALL.z) < WIZARD_FALL.triggerRadius) {
      this.flags.wizardFell = true;
      this.spawnWizard(false);
    }
  }

  spawnWizard(landed) {
    const w = new Unit(this, { slot: 'npc_wizard', name: 'Vendril the Unwise', faction: 'neutral' });
    const x = WIZARD_FALL.x, z = WIZARD_FALL.z;
    const g = this.world.collision.groundAt(x, z, 100, 0);
    w.pos.set(x, landed ? g : g + 70, z);
    w.yaw = 2.3;
    w.vel.set(0, -2, 0);
    w.landed = landed;
    w.loot = this.flags.wizardLooted ? null : { gold: 18, items: [{ id: 'scroll_skyleap', count: 3 }, { id: 'vendril_notes', count: 1 }, { id: 'vendril_ring', count: 1 }] };
    if (landed) { w.visual.play('death'); for (let i = 0; i < 40; i++) w.visual.update(0.05, {}); }
    this.wizard = w;
    const game = this;
    this.wizardObj = {
      pos: w.pos, radius: 0.8, height: 0.6, enabled: true, group: { visible: true },
      name: () => 'Vendril the Unwise', verb: () => 'Search', canUse: () => true,
      use: () => {
        if (!w.loot || (!w.loot.items.length && !w.loot.gold)) { game.log('Vendril has nothing more to give, except a lesson.', 'system'); return; }
        game.ui.openLoot({ name: () => 'Vendril the Unwise', onLootClosed: () => { if (!w.loot.items.length && !w.loot.gold) game.flags.wizardLooted = true; } }, w.loot);
      },
    };
    if (!landed) {
      this.audio.play('scream', w.pos);
      this.ui.speech(w, 'AAAAaaaaaaahhhh!', 'yell');
    }
  }

  updateWizard(dt) {
    const w = this.wizard;
    if (w.landed) { w.updateVisual(dt); return; }
    w.vel.y -= 22 * dt;
    w.pos.y += w.vel.y * dt;
    w.visual.update(dt, { airborne: true });
    w.group.rotation.y += dt * 2;
    const g = this.world.collision.groundAt(w.pos.x, w.pos.z, w.pos.y + 1, 0);
    if (w.pos.y <= g) {
      w.pos.y = g;
      w.landed = true;
      w.visual.play('death');
      this.audio.play('land', w.pos, 1.5);
      this.audio.play('hit_crit', w.pos);
      this.fx.burst(w.pos, 0xa08060, 30, 4);
      this.rig.shake = 0.6;
      this.log('A man falls out of the sky and lands with a sickening crunch.', 'emote');
      this.quests.addJournal(null, 'A wizard fell out of the sky near the north road outside Brackwater. He did not survive the landing. I should see what he was carrying.');
    }
  }

  updateGulls(dt) {
    for (const u of this.gulls || []) {
      const g = u.gull;
      g.a += dt * g.s;
      const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r;
      u.pos.set(x, g.h + Math.sin(g.a * 3) * 1.2, z);
      u.yaw = g.a + Math.PI;
      u.group.rotation.y = -g.a;
      u.group.rotation.z = 0.25;
      u.visual.update(dt, { glide: Math.sin(g.a * 2) > 0 });
    }
  }

  audioEnv() {
    const p = this.player.pos;
    const T = this.world.terrain;
    const inland = T.inlandAtGrid(p.x, p.z);
    const coast = Math.max(0, Math.min(1, 1 - inland / 45));
    const ib = this.indoorBuilding();
    return { coast: ib ? coast * 0.2 : coast, height: Math.max(0, p.y), marsh: T.marshAt(p.x, p.z), indoors: !!ib };
  }

  indoorBuilding() {
    const p = this.player.pos;
    for (const b of Object.values(this.world.buildingsById)) {
      if (!b.interior) continue;
      const i = b.interior;
      const dx = p.x - i.cx, dz = p.z - i.cz;
      const lx = dx * Math.cos(i.rot) - dz * Math.sin(i.rot), lz = dx * Math.sin(i.rot) + dz * Math.cos(i.rot);
      if (Math.abs(lx) < i.hx && Math.abs(lz) < i.hz && p.y > i.y - 0.6 && p.y < i.y + 3) return b;
    }
    return null;
  }

  musicMood() {
    const bossFight = this.creatures.some((c) => c.boss && c.alive && c.state === 'combat');
    if (bossFight) return 'boss';
    if (this.playerInCombat) return 'combat';
    if (this.world.sky.nightFactor > 0.6) return 'night';
    const z = this.zoneId;
    if (z === 'brackwater' || z === 'docks') return 'town';
    return 'explore';
  }

  // Game-time scheduler: callbacks pause with the game and follow simulation time.
  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  updateTimers(dt) {
    if (!this.timers.length) return;
    const due = [];
    for (const t of this.timers) { t.t -= dt; if (t.t <= 0) due.push(t); }
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) { try { t.fn(); } catch (e) { console.error(e); } }
  }

  // Advance the simulation without rendering (used by automated tests).
  debugStep(seconds, dt = 0.05) {
    for (let t = 0; t < seconds; t += dt) {
      this.elapsed += dt;
      this.update(dt);
      this.input.endFrame();
    }
  }

  // ------------------------------------------------------------------ messages
  fct(unit, text, kind, color) { if (this.settings.combatText || kind === 'xp') this.ui?.floatText(unit, text, kind, color); }
  log(msg, kind = 'system', quality) { this.ui?.log(msg, kind, quality); }
  error(msg) {
    if (!msg) return;
    this.ui?.errorText(msg);
    this.audio.play('error');
  }
}

function rayCylinder(ray, pos, r, h) {
  // Intersect with infinite vertical cylinder, then clamp to height.
  const ox = ray.origin.x - pos.x, oz = ray.origin.z - pos.z;
  const dx = ray.direction.x, dz = ray.direction.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-8) return null;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
    if (t < 0) continue;
    const y = ray.origin.y + ray.direction.y * t;
    if (y >= pos.y - 0.2 && y <= pos.y + h + 0.2) return t;
  }
  return null;
}

export function charLook(sheet) {
  return { race: sheet.race, name: sheet.name, ...(sheet.look || {}) };
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
