// UI root: HUD (unit frames, action bar, minimap, tracker, log, nameplates, combat text)
// plus routing to windows and menus.
import * as THREE from 'three';
import { h, clear, clockText, fmtTime } from './dom.js';
import { Tooltip, itemTooltip, abilityTooltip, effectTooltip } from './tooltip.js';
import { renderMapImage, worldToMap, drawMarker, drawPlayerArrow, MAP_PX } from './map.js';
import { Windows } from './windows.js';
import { Menus } from './menus.js';
import { registry } from '../assets/registry.js';
import { ITEMS } from '../data/items.js';
import { ABILITIES, MELEE_RANGE } from '../data/classes.js';
import { QUESTS, QUEST_ORDER } from '../data/quests.js';
import { abilityRangeOk } from '../game/abilities.js';

const _v = new THREE.Vector3();

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.pointerOverUi = false;
    this.plates = new Map();
    this.fct = [];
    this.bubbles = [];
    this.tooltip = new Tooltip(document.getElementById('app'));
    this.mapImage = renderMapImage(game.world.terrain);
    this.minimapZoom = 1.6;
    this.build();
    this.windows = new Windows(this);
    this.menus = new Menus(this);
    this.drag = null;
    root.addEventListener('pointerover', (e) => { this.pointerOverUi = e.target !== root && !e.target.closest('.passthrough'); });
    root.addEventListener('pointerout', () => { this.pointerOverUi = false; });
  }

  // ------------------------------------------------------------------ structure
  build() {
    const r = this.root;
    this.layers = {
      plates: h('div', { class: 'layer plates passthrough' }),
      fct: h('div', { class: 'layer fct passthrough' }),
      bubbles: h('div', { class: 'layer bubbles passthrough' }),
    };
    r.append(this.layers.plates, this.layers.bubbles, this.layers.fct);
    this.hud = h('div', { class: 'hud passthrough', hidden: true });
    r.append(this.hud);

    // Player frame
    this.pf = {
      root: h('div', { class: 'unitframe player-frame' }),
      level: h('div', { class: 'uf-level' }),
      name: h('div', { class: 'uf-name' }),
      hp: bar('hp'), mana: bar('mana'), st: bar('st'),
      buffs: h('div', { class: 'buffs' }),
    };
    this.pf.root.append(h('div', { class: 'uf-portrait' }, this.pf.level), h('div', { class: 'uf-body' }, this.pf.name, this.pf.hp.el, this.pf.mana.el, this.pf.st.el));
    this.pf.combat = h('div', { class: 'uf-combat', title: 'In combat' });
    this.pf.root.append(this.pf.combat);
    this.hud.append(this.pf.root, this.pf.buffs);

    // Target frame
    this.tf = {
      root: h('div', { class: 'unitframe target-frame', hidden: true }),
      level: h('div', { class: 'uf-level' }),
      name: h('div', { class: 'uf-name' }),
      sub: h('div', { class: 'uf-sub' }),
      hp: bar('hp'),
      cast: castbar('small'),
      debuffs: h('div', { class: 'buffs target-buffs' }),
    };
    this.tf.root.append(h('div', { class: 'uf-portrait' }, this.tf.level), h('div', { class: 'uf-body' }, this.tf.name, this.tf.sub, this.tf.hp.el, this.tf.cast.el, this.tf.debuffs));
    this.hud.append(this.tf.root);

    // Minimap
    this.mm = { root: h('div', { class: 'minimap' }), canvas: h('canvas', { width: 200, height: 200 }), zone: h('div', { class: 'mm-zone' }), clock: h('div', { class: 'mm-clock' }) };
    const zin = h('button', { class: 'mm-btn mm-in', title: 'Zoom in', onclick: () => { this.minimapZoom = Math.min(4, this.minimapZoom * 1.4); } }, '+');
    const zout = h('button', { class: 'mm-btn mm-out', title: 'Zoom out', onclick: () => { this.minimapZoom = Math.max(0.7, this.minimapZoom / 1.4); } }, '−');
    this.mm.root.append(this.mm.zone, h('div', { class: 'mm-ring' }, this.mm.canvas, h('div', { class: 'mm-n' }, 'N'), zin, zout), this.mm.clock);
    this.mm.canvas.addEventListener('click', () => this.windows.toggle('map'));
    this.hud.append(this.mm.root);

    // Quest tracker
    this.tracker = h('div', { class: 'tracker' });
    this.hud.append(this.tracker);

    // Action bar + XP
    this.xp = { root: h('div', { class: 'xpbar' }), fill: h('div', { class: 'xp-fill' }), text: h('div', { class: 'xp-text' }) };
    this.xp.root.append(this.xp.fill, this.xp.text);
    this.bar = h('div', { class: 'actionbar' });
    this.slots = [];
    for (let i = 0; i < 10; i++) {
      const s = { el: h('div', { class: 'slot', 'data-i': i }), icon: h('img', { class: 'slot-icon', alt: '' }), cd: h('div', { class: 'slot-cd' }), cdText: h('div', { class: 'slot-cdtext' }), key: h('div', { class: 'slot-key' }, i === 9 ? '0' : String(i + 1)), count: h('div', { class: 'slot-count' }) };
      s.el.append(s.icon, s.cd, s.cdText, s.key, s.count);
      s.el.addEventListener('click', () => { if (!this.drag) this.game.useBarSlot(i); });
      s.el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.game.useBarSlot(i); });
      s.el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const entry = this.game.sheet?.bar[i];
        if (!entry) return;
        this.beginDrag(e, { from: 'bar', index: i, entry, icon: s.icon.src }, () => { this.game.sheet.bar[i] = null; this.refreshBar(); });
      });
      this.tooltip.bind(s.el, () => {
        const entry = this.game.sheet?.bar[i];
        if (!entry) return null;
        return entry.type === 'ability' ? abilityTooltip(this.game, entry.id) : itemTooltip(this.game, entry.id, { compare: false, count: this.game.sheet.count(entry.id) });
      });
      this.bar.append(s.el);
      this.slots.push(s);
    }
    this.micro = h('div', { class: 'micro' });
    for (const [label, key, win] of [['Character', 'C', 'character'], ['Bags', 'B', 'bags'], ['Journal', 'J', 'journal'], ['Abilities', 'P', 'spellbook'], ['Map', 'M', 'map'], ['Workshop', 'F10', 'workshop'], ['Menu', 'Esc', 'menu']]) {
      const b = h('button', { class: 'micro-btn', title: `${label} (${key})`, onclick: () => (win === 'menu' ? this.menus.togglePause() : win === 'workshop' ? this.openWorkshop() : this.windows.toggle(win)) }, h('span', { class: 'micro-label' }, label), h('span', { class: 'micro-key' }, key));
      this.micro.append(b);
    }
    this.gold = h('div', { class: 'gold-display' });
    this.bottom = h('div', { class: 'bottom-center' }, this.xp.root, this.bar, h('div', { class: 'bottom-row' }, this.micro, this.gold));
    this.hud.append(this.bottom);

    // Cast bar
    this.castbar = castbar('big');
    this.castbar.el.classList.add('player-cast');
    this.hud.append(this.castbar.el);

    // Chat / log
    this.logEl = h('div', { class: 'chatlog' });
    this.hud.append(this.logEl);

    // Center messages
    this.err = h('div', { class: 'errortext passthrough' });
    this.prompt = h('div', { class: 'interact-prompt passthrough', hidden: true });
    this.bannerEl = h('div', { class: 'zone-banner passthrough' });
    this.toastEl = h('div', { class: 'toasts passthrough' });
    this.crosshair = h('div', { class: 'crosshair passthrough', hidden: true });
    this.questNote = h('div', { class: 'quest-note passthrough' });
    this.fpsEl = h('div', { class: 'fps passthrough', hidden: true });
    this.hud.append(this.err, this.prompt, this.bannerEl, this.questNote, this.crosshair, this.fpsEl);
    this.root.append(this.toastEl);
  }

  // ------------------------------------------------------------------ state routing
  modalOpen() { return this.menus.modal() || this.windows.modal(); }
  blockMovement() {
    const a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  }

  showMainMenu() { this.hud.hidden = true; this.menus.showMain(); }
  enterGame() {
    this.hud.hidden = false;
    this.menus.closeAll();
    this.refreshAll();
  }
  showIntro() { this.menus.showIntro(); }
  showDeath() { this.menus.showDeath(); }
  showEnding() { setTimeout(() => this.menus.showEnding(), 1200); }
  openWorkshop() { this.menus.openWorkshop(); }

  refreshAll() {
    this.refreshBar();
    this.statsChanged();
    this.questsChanged();
    this.targetChanged();
    this.effectsChanged(this.game.player);
    this.sheetChanged('all');
  }

  onKey(e) {
    const g = this.game;
    const code = e.code;
    const input = g.input;
    if (this.menus.handleKey(e)) return;
    if (g.state !== 'play') return;
    const is = (a) => (input.bindings[a] || []).includes(code);
    if (is('menu')) {
      if (this.windows.closeTop()) return;
      if (g.target) { g.setTarget(null); return; }
      this.menus.togglePause();
      return;
    }
    if (this.modalOpen() && !this.windows.dialogOpen()) return;
    if (is('bags')) this.windows.toggle('bags');
    else if (is('character')) this.windows.toggle('character');
    else if (is('journal')) this.windows.toggle('journal');
    else if (is('map')) this.windows.toggle('map');
    else if (is('spellbook')) this.windows.toggle('spellbook');
    else if (is('workshop')) this.openWorkshop();
    else if (is('help')) this.windows.toggle('help');
    else if (is('quicksave')) g.save(false);
    else if (is('quickload')) { if (g.hasSave()) g.load(); }
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    const g = this.game;
    this.menus.update(dt);
    this.windows.update(dt);
    if (g.state !== 'play' || !g.player) return;
    const p = g.player;
    // Player frame
    this.pf.hp.set(p.hp, p.maxHp);
    this.pf.mana.el.hidden = !p.maxMana;
    if (p.maxMana) this.pf.mana.set(p.mana, p.maxMana);
    this.pf.st.set(p.st, p.maxSt);
    this.pf.combat.classList.toggle('on', g.playerInCombat);
    this.pf.root.classList.toggle('dead', !p.alive);
    // Target frame
    const t = g.target;
    if (t) {
      this.tf.hp.set(t.hp, t.maxHp, true);
      this.tf.root.classList.toggle('dead', !t.alive);
      this.updateCast(this.tf.cast, t);
    }
    // Player cast/channel bar
    if (g.channel) {
      this.castbar.el.hidden = false;
      this.castbar.label.textContent = g.channel.label;
      this.castbar.fill.style.width = `${(g.channel.t / g.channel.dur) * 100}%`;
      this.castbar.time.textContent = `${Math.max(0, g.channel.dur - g.channel.t).toFixed(1)}`;
    } else this.updateCast(this.castbar, p);
    // Action bar state
    this.updateBar();
    // Buff timers
    this.updateBuffTimers();
    // Clock & minimap
    this.mm.clock.textContent = `Day ${g.dayCount} · ${clockText(g.hour)}`;
    this.drawMinimap();
    // Floating texts, nameplates, bubbles, prompt
    this.updateFct(dt);
    this.updatePlates();
    this.updateBubbles(dt);
    this.updatePrompt();
    this.errT = (this.errT || 0) - dt;
    if (this.errT <= 0) this.err.classList.remove('show');
    this.fpsEl.hidden = !g.settings.showFps;
    if (g.settings.showFps) this.fpsEl.textContent = `${g.fps.toFixed(0)} fps`;
  }

  updateCast(cb, u) {
    const c = u.cast;
    if (!c) { cb.el.hidden = true; return; }
    cb.el.hidden = false;
    cb.label.textContent = c.name;
    cb.fill.style.width = `${Math.min(100, (c.t / c.dur) * 100)}%`;
    if (cb.time) cb.time.textContent = `${Math.max(0, c.dur - c.t).toFixed(1)}`;
  }

  refreshBar() {
    const sheet = this.game.sheet;
    if (!sheet) return;
    this.slots.forEach((s, i) => {
      const e = sheet.bar[i];
      s.entry = e;
      if (!e) { s.icon.hidden = true; s.icon.removeAttribute('src'); s.count.textContent = ''; s.el.classList.add('empty'); return; }
      s.el.classList.remove('empty');
      s.icon.hidden = false;
      s.icon.src = registry.iconURL(e.type === 'ability' ? `icon_ab_${e.id}` : `icon_${e.id}`);
    });
  }

  updateBar() {
    const g = this.game, p = g.player, sheet = g.sheet;
    const known = sheet.knownAbilities();
    this.slots.forEach((s) => {
      const e = s.entry;
      if (!e) return;
      let cd = 0, cdMax = 1, usable = true, range = true, nores = false;
      if (e.type === 'ability') {
        const ab = ABILITIES[e.id];
        const own = p.cooldowns[e.id] || 0;
        const gcd = ab.offGcd ? 0 : p.gcd;
        if (own > gcd) { cd = own; cdMax = ab.cd; } else if (gcd > 0) { cd = gcd; cdMax = 1.2; }
        usable = known.includes(e.id);
        if (ab.cost.mana && p.mana < ab.cost.mana) nores = true;
        if (ab.cost.st && p.st < ab.cost.st) nores = true;
        if (ab.target === 'enemy' && g.target && g.target.alive && g.isHostile(p, g.target)) range = abilityRangeOk(p, g.target, ab);
        s.count.textContent = '';
      } else {
        const n = sheet.count(e.id);
        s.count.textContent = n > 1 ? n : n === 0 ? '0' : '';
        usable = n > 0;
        const it = ITEMS[e.id];
        const key = it && it.use && (it.use.heal || it.use.mana) ? 'potion' : it && it.use && it.use.food ? 'food' : e.id;
        cd = (g.itemCooldowns || {})[key] || 0;
        cdMax = (it && it.cooldown) || 30;
      }
      s.el.classList.toggle('unusable', !usable);
      s.el.classList.toggle('nores', usable && nores);
      s.el.classList.toggle('oor', usable && !nores && !range);
      if (cd > 0) {
        s.cd.style.background = `conic-gradient(rgba(0,0,0,0) ${(1 - cd / cdMax) * 360}deg, rgba(0,0,0,0.68) 0)`;
        s.cd.hidden = false;
        s.cdText.textContent = cd > 1.5 ? fmtTime(cd) : '';
      } else { s.cd.hidden = true; s.cdText.textContent = ''; }
    });
  }

  abilityUsed(id) {
    const s = this.slots.find((x) => x.entry && x.entry.type === 'ability' && x.entry.id === id);
    if (s) { s.el.classList.remove('flash'); void s.el.offsetWidth; s.el.classList.add('flash'); }
  }

  statsChanged() {
    const g = this.game;
    if (!g.sheet) return;
    this.pf.level.textContent = g.sheet.level;
    this.pf.name.textContent = g.sheet.name;
    const need = g.sheet.xpToNext();
    this.xp.fill.style.width = need ? `${(g.sheet.xp / need) * 100}%` : '100%';
    this.xp.text.textContent = need ? `Level ${g.sheet.level} · ${g.sheet.xp} / ${need} XP` : `Level ${g.sheet.level} (maximum)`;
    this.windows.refresh('character');
  }

  sheetChanged(what) {
    const g = this.game;
    if (!g.sheet) return;
    this.gold.textContent = `${g.sheet.gold} gold`;
    if (what === 'bags' || what === 'equip' || what === 'all' || what === 'gold') { this.windows.refresh('bags'); this.windows.refresh('character'); this.windows.refresh('vendor'); }
    if (what === 'xp' || what === 'stats' || what === 'all') { this.statsChanged(); this.windows.refresh('spellbook'); }
    this.refreshBar();
  }

  // ------------------------------------------------------------------ target
  targetChanged() {
    const g = this.game, t = g.target;
    this.tf.root.hidden = !t;
    if (!t) return;
    this.tf.name.textContent = t.name;
    const lvl = t.isNpc ? '' : t.level;
    this.tf.level.textContent = t.boss ? '☠' : lvl;
    this.tf.level.style.color = t.isNpc ? '' : diffColor(t.level, g.sheet.level);
    this.tf.sub.textContent = t.isNpc ? (t.title ? `<${t.title}>` : '') : `${t.elite ? 'Elite ' : ''}${t.rare ? 'Rare ' : ''}${t.def?.family || ''}`;
    this.tf.root.classList.toggle('elite', !!t.elite && !t.rare);
    this.tf.root.classList.toggle('rare', !!t.rare);
    this.tf.root.classList.toggle('friendly', !!t.isNpc || t.faction === 'neutral');
    this.tf.hp.el.classList.toggle('friendly', !!t.isNpc);
    this.effectsChanged(t);
  }

  combatChanged() {}

  // ------------------------------------------------------------------ effects
  effectsChanged(u) {
    if (!u) return;
    const g = this.game;
    const host = u === g.player ? this.pf.buffs : u === g.target ? this.tf.debuffs : null;
    if (!host) return;
    clear(host);
    for (const e of u.effects) {
      if (e.id === 'stun' && u === g.player) { /* show anyway */ }
      const el = h('div', { class: `buff ${e.harmful ? 'harmful' : ''}` }, h('img', { src: registry.iconURL(e.icon && registry.slot(e.icon) ? e.icon : 'icon_fx_blessing'), alt: '' }), h('span', { class: 'buff-t' }));
      el._eff = e;
      this.tooltip.bind(el, () => effectTooltip(e));
      host.append(el);
    }
  }

  updateBuffTimers() {
    for (const host of [this.pf.buffs, this.tf.debuffs]) {
      for (const el of host.children) {
        const e = el._eff;
        if (!e) continue;
        const left = e.dur - e.t;
        el.lastChild.textContent = left < 3600 ? fmtTime(Math.max(0, left)) : '';
        el.classList.toggle('expiring', left < 5);
      }
    }
  }

  castChanged() {}

  // ------------------------------------------------------------------ messages
  log(msg, kind = 'system', quality) {
    const line = h('div', { class: `log-line log-${kind}${quality ? ` q-${quality}` : ''}` }, msg);
    this.logEl.append(line);
    while (this.logEl.children.length > 80) this.logEl.firstChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  errorText(msg) {
    this.err.textContent = msg;
    this.err.classList.add('show');
    this.errT = 2;
  }

  toast(text, sec = 3) {
    const el = h('div', { class: 'toast' }, text);
    this.toastEl.append(el);
    setTimeout(() => el.classList.add('hide'), sec * 1000);
    setTimeout(() => el.remove(), sec * 1000 + 600);
  }

  banner(title, sub) {
    clear(this.bannerEl);
    this.bannerEl.append(h('div', { class: 'banner-title' }, title), sub ? h('div', { class: 'banner-sub' }, sub) : null);
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  zoneChanged(z) { this.mm.zone.textContent = z ? z.name : 'Isle of Brackwater'; }

  levelUp(level, newAbilities) {
    this.banner(`Level ${level}`, newAbilities.length ? `New ability: ${newAbilities.map((a) => ABILITIES[a].name).join(', ')}` : 'You feel stronger.');
    // Put newly learned abilities on empty bar slots.
    const bar = this.game.sheet.bar;
    for (const a of newAbilities) {
      if (bar.some((b) => b && b.type === 'ability' && b.id === a)) continue;
      const i = bar.findIndex((b) => !b);
      if (i >= 0) bar[i] = { type: 'ability', id: a };
    }
    this.refreshBar();
    this.windows.refresh('character');
  }

  questNoteText(text) {
    const el = h('div', { class: 'qn-line' }, text);
    this.questNote.append(el);
    setTimeout(() => el.classList.add('hide'), 3000);
    setTimeout(() => el.remove(), 3700);
  }

  questAccepted(id) {
    this.questNoteText(`Quest accepted: ${QUESTS[id].name}`);
    this.log(`Quest accepted: ${QUESTS[id].name}`, 'quest');
  }
  questUpdated(id, text, stageAdvanced, ready) {
    if (text) this.questNoteText(text);
    if (stageAdvanced) { this.questNoteText(`${QUESTS[id].name}: journal updated`); this.log(`${QUESTS[id].name}: your journal has been updated.`, 'quest'); }
    if (ready) { this.questNoteText(`${QUESTS[id].name} (Complete)`); this.log(`${QUESTS[id].name} is ready to turn in.`, 'quest'); }
  }
  questCompleted(id, alt) {
    this.banner(alt ? 'Quest Concluded' : 'Quest Complete', QUESTS[id].name);
    this.log(`${QUESTS[id].name} completed.`, 'quest');
  }
  journalAdded() { this.windows.refresh('journal'); }
  topicLearned() { this.windows.refresh('dialog-topics'); }

  questsChanged() {
    const g = this.game;
    if (!g.quests) return;
    clear(this.tracker);
    const active = QUEST_ORDER.filter((id) => g.quests.isActive(id));
    if (active.length) this.tracker.append(h('div', { class: 'tracker-head' }, 'Quests'));
    for (const id of active.slice(0, 5)) {
      const st = g.quests.state[id];
      const q = h('div', { class: `tr-quest ${st.status === 'ready' ? 'ready' : ''}` }, h('div', { class: 'tr-name' }, QUESTS[id].name + (st.status === 'ready' ? ' (Complete)' : '')));
      q.addEventListener('click', () => this.windows.open('journal', { quest: id }));
      for (const o of g.quests.objectives(id)) {
        q.append(h('div', { class: `tr-obj ${o.done ? 'done' : ''}` }, o.counted ? `${o.text}: ${o.have}/${o.need}` : o.text));
      }
      this.tracker.append(q);
    }
    this.windows.refresh('journal');
  }

  // ------------------------------------------------------------------ minimap
  drawMinimap() {
    const g = this.game, p = g.player;
    const c = this.mm.canvas, ctx = c.getContext('2d');
    const W = c.width;
    const scale = (MAP_PX / 640) * this.minimapZoom; // px per meter at this zoom
    const [mx, my] = worldToMap(p.pos.x, p.pos.z);
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, 7); ctx.clip();
    ctx.fillStyle = '#9aa8a0'; ctx.fillRect(0, 0, W, W);
    const z = this.minimapZoom;
    ctx.drawImage(this.mapImage, mx - W / 2 / z, my - W / 2 / z, W / z, W / z, 0, 0, W, W);
    const toMini = (x, zz) => [W / 2 + (x - p.pos.x) * scale, W / 2 + (zz - p.pos.z) * scale];
    // Quest areas
    for (const id of QUEST_ORDER) {
      if (!g.quests.isActive(id)) continue;
      const poi = g.quests.poi(id);
      if (!poi || poi.npc) continue;
      const [x, y] = toMini(poi.x, poi.z);
      ctx.beginPath(); ctx.arc(x, y, Math.max(6, poi.r * scale), 0, 7);
      ctx.fillStyle = 'rgba(255,210,60,0.18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,60,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    for (const c2 of g.creatures) {
      if (!c2.alive || c2.removed || c2.distTo(p) > 60) continue;
      const [x, y] = toMini(c2.pos.x, c2.pos.z);
      drawMarker(ctx, c2.elite ? 'elite' : 'enemy', x, y, 0.8);
    }
    if (g.questNeedsItem('glowcap')) for (const o of g.interactables) if (o.isHerb && o.enabled) { const [x, y] = toMini(o.pos.x, o.pos.z); drawMarker(ctx, 'herb', x, y, 0.9); }
    for (const n of g.npcs) {
      if (n.removedFromWorld) continue;
      const [x, y] = toMini(n.pos.x, n.pos.z);
      if (n.markerKind) drawMarker(ctx, n.markerKind, x, y, 0.9);
      else if (n.distTo(p) < 60) drawMarker(ctx, 'npc', x, y, 0.8);
    }
    drawPlayerArrow(ctx, W / 2, W / 2, p.yaw, 1);
    ctx.restore();
  }

  // ------------------------------------------------------------------ world-space overlays
  project(pos, yOff) {
    _v.set(pos.x, pos.y + yOff, pos.z);
    _v.project(this.game.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    const r = this.game.engine.renderer.domElement.getBoundingClientRect();
    return { x: (_v.x * 0.5 + 0.5) * r.width + r.left, y: (-_v.y * 0.5 + 0.5) * r.height + r.top };
  }

  floatText(unit, text, kind, color) {
    if (!text) return;
    const el = h('div', { class: `fct fct-${kind}` }, text);
    if (color && kind !== 'heal' && kind !== 'xp') el.style.color = color;
    this.layers.fct.append(el);
    this.fct.push({ el, unit, t: 0, dur: kind === 'crit' ? 1.4 : 1.1, dx: (Math.random() - 0.5) * 50, kind });
  }

  updateFct(dt) {
    for (const f of this.fct) {
      f.t += dt;
      const u = f.unit;
      const s = this.project(u.pos, (u.visual?.height || u.height || 1.8) + 0.2);
      if (!s || f.t > f.dur) { f.el.remove(); f.dead = true; continue; }
      const k = f.t / f.dur;
      f.el.style.transform = `translate(${s.x + f.dx * k - 0}px, ${s.y - 60 * k}px) translate(-50%, -50%) scale(${f.kind === 'crit' ? 1.5 - Math.min(0.4, k) : 1})`;
      f.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
    this.fct = this.fct.filter((f) => !f.dead);
  }

  updatePlates() {
    const g = this.game, p = g.player;
    const seen = new Set();
    if (g.settings.nameplates) {
      const show = (u, dist) => {
        const s = this.project(u.pos, (u.visual?.height || u.height || 1.8) + (u.markerKind ? 0.95 : 0.35));
        if (!s) return;
        seen.add(u.id);
        let pl = this.plates.get(u.id);
        if (!pl) {
          pl = { el: h('div', { class: 'plate' }), name: h('div', { class: 'plate-name' }), hp: h('div', { class: 'plate-hp' }, h('div', { class: 'plate-hpfill' })) };
          pl.el.append(pl.name, pl.hp);
          this.layers.plates.append(pl.el);
          this.plates.set(u.id, pl);
        }
        const hostile = !!(u.isCreature && u.faction === 'hostile' && u.alive);
        pl.name.textContent = u.isNpc && u.title ? `${u.name}` : u.name;
        pl.el.title = '';
        pl.el.classList.toggle('npc', !!u.isNpc);
        pl.el.classList.toggle('hostile', hostile);
        pl.el.classList.toggle('targeted', g.target === u);
        pl.el.classList.toggle('combat', !!(u.isCreature && u.state === 'combat'));
        pl.hp.hidden = !u.isCreature || !u.alive || (u.hp >= u.maxHp && g.target !== u && u.state !== 'combat');
        if (!pl.hp.hidden) pl.hp.firstChild.style.width = `${(u.hp / u.maxHp) * 100}%`;
        const fade = Math.max(0.35, 1 - dist / 45);
        pl.el.style.opacity = g.target === u ? 1 : fade;
        pl.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      };
      for (const n of g.npcs) {
        if (n.removedFromWorld) continue;
        const d = n.distTo(p);
        if (d < 22 && g.lineOfSight(p, n)) show(n, d);
      }
      const now = g.elapsed;
      for (const c of g.creatures) {
        if (c.removed || !c.alive && g.target !== c) continue;
        const d = c.distTo(p);
        if (d >= 38 && g.target !== c) continue;
        // Line of sight is re-checked a few times a second per creature.
        if (!c._losT || now - c._losT > 0.3) { c._losT = now + Math.random() * 0.1; c._los = d < 6 || g.target === c || g.lineOfSight(p, c); }
        if (c._los) show(c, d);
      }
    }
    for (const [id, pl] of this.plates) if (!seen.has(id)) { pl.el.remove(); this.plates.delete(id); }
  }

  speech(unit, text, kind) {
    const el = h('div', { class: `bubble bubble-${kind}` }, text);
    this.layers.bubbles.append(el);
    this.bubbles.push({ el, unit, t: 0, dur: Math.min(8, 2.5 + text.length * 0.05) });
  }

  updateBubbles(dt) {
    for (const b of this.bubbles) {
      b.t += dt;
      const s = this.project(b.unit.pos, (b.unit.visual?.height || 1.8) + 0.9);
      if (b.t > b.dur) { b.el.remove(); b.dead = true; continue; }
      if (!s || b.unit.pos.distanceTo(this.game.camera.position) > 60) { b.el.style.opacity = 0; continue; }
      b.el.style.opacity = b.t > b.dur - 0.5 ? (b.dur - b.t) / 0.5 : 1;
      b.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    this.bubbles = this.bubbles.filter((b) => !b.dead);
  }

  updatePrompt() {
    const g = this.game;
    if (this.modalOpen() || !g.player.alive) { this.prompt.hidden = true; return; }
    const c = g.interactCandidate();
    if (!c) { this.prompt.hidden = true; return; }
    let verb, name;
    if (c.unit) {
      if (c.unit.isNpc) { verb = 'Talk to'; name = c.unit.name; }
      else { verb = 'Loot'; name = c.unit.name; }
    } else { verb = c.obj.verb(); name = c.obj.name(); }
    const key = g.input.keyFor('interact');
    this.prompt.hidden = false;
    this.prompt.replaceChildren(h('span', { class: 'key' }, key), h('span', {}, ` ${verb} `), h('b', {}, name));
  }

  setCrosshair(on) { this.crosshair.hidden = !on; }

  // ------------------------------------------------------------------ drag & drop
  beginDrag(e, payload, onDropOutside) {
    const startX = e.clientX, startY = e.clientY;
    let ghost = null;
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        ghost = h('img', { class: 'drag-ghost', src: payload.icon });
        document.getElementById('app').append(ghost);
        this.drag = payload;
        this.tooltip.hide();
      }
      if (ghost) { ghost.style.left = `${ev.clientX - 20}px`; ghost.style.top = `${ev.clientY - 20}px`; }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!ghost) return;
      ghost.remove();
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const handled = this.drop(payload, target);
      if (!handled && onDropOutside && !(target && target.closest('.window, .actionbar'))) onDropOutside();
      setTimeout(() => { this.drag = null; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  drop(payload, target) {
    if (!target) return false;
    const g = this.game, sheet = g.sheet;
    const slotEl = target.closest('.actionbar .slot');
    if (slotEl) {
      const i = +slotEl.dataset.i;
      const entry = payload.entry || (payload.itemId ? { type: 'item', id: payload.itemId } : payload.abilityId ? { type: 'ability', id: payload.abilityId } : null);
      if (!entry) return false;
      if (entry.type === 'item' && ITEMS[entry.id].type !== 'consumable') { g.error('Only usable items can go on the action bar.'); return true; }
      if (payload.from === 'bar') sheet.bar[payload.index] = sheet.bar[i];
      sheet.bar[i] = entry;
      this.refreshBar();
      return true;
    }
    return this.windows.drop(payload, target);
  }

  // ------------------------------------------------------------------ windows passthrough
  openDialog(npc) { this.windows.openDialog(npc); }
  closeDialog() { this.windows.close('dialog'); }
  openLoot(src, loot) { this.windows.openLoot(src, loot); }
  showBook(id) { this.windows.openBook(id); }
}

function bar(kind) {
  const el = h('div', { class: `bar bar-${kind}` });
  const fill = h('div', { class: 'bar-fill' });
  const text = h('div', { class: 'bar-text' });
  el.append(fill, text);
  return {
    el, fill, text,
    set(v, max, pct) {
      const f = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
      fill.style.width = `${f * 100}%`;
      text.textContent = pct ? `${Math.round(f * 100)}%` : `${Math.ceil(v)} / ${Math.round(max)}`;
    },
  };
}

function castbar(size) {
  const el = h('div', { class: `castbar castbar-${size}`, hidden: true });
  const fill = h('div', { class: 'cast-fill' });
  const label = h('div', { class: 'cast-label' });
  const time = h('div', { class: 'cast-time' });
  el.append(fill, label, time);
  return { el, fill, label, time };
}

export function diffColor(mob, me) {
  const d = mob - me;
  if (d >= 3) return '#ff3030';
  if (d >= 2) return '#ff8020';
  if (d >= -1) return '#ffe020';
  if (d >= -2) return '#40d040';
  return '#a0a0a0';
}
