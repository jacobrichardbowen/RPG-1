// Game windows: character, bags, journal, spellbook, map, dialog, loot, vendor, book, help.
import { h, clear, miniMarkdown, clockText } from './dom.js';
import { itemTooltip, abilityTooltip } from './tooltip.js';
import { worldToMap, drawMarker, drawPlayerArrow, MAP_PX } from './map.js';
import { registry } from '../assets/registry.js';
import { ITEMS, EQUIP_SLOTS, SLOT_NAMES } from '../data/items.js';
import { ABILITIES, ABILITY_LEVELS } from '../data/classes.js';
import { QUESTS, QUEST_ORDER } from '../data/quests.js';
import { BOOKS } from '../data/books.js';
import { VENDORS, SELL_MULT, BUY_MULT } from '../data/loot.js';
import { ZONES } from '../world/layout.js';
import { ATTRS, ATTR_NAMES, ATTR_HELP } from '../game/character.js';
import { RACES } from '../assets/placeholders/characters.js';

class Win {
  constructor(mgr, id, title, { cls = '', modal = false, x, y, w } = {}) {
    this.mgr = mgr;
    this.ui = mgr.ui;
    this.game = mgr.ui.game;
    this.id = id;
    this.modal = modal;
    this.el = h('div', { class: `window win-${id} ${cls}`, hidden: true, role: 'dialog', 'aria-label': title });
    this.titleEl = h('div', { class: 'win-title' }, title);
    const close = h('button', { class: 'win-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => this.close() }, '×');
    this.head = h('div', { class: 'win-head' }, this.titleEl, close);
    this.body = h('div', { class: 'win-body' });
    this.el.append(this.head, this.body);
    if (w) this.el.style.width = w;
    if (x !== undefined) { this.el.style.left = x; this.el.style.top = y; }
    mgr.layer.append(this.el);
    this.el.addEventListener('pointerdown', () => mgr.focus(this));
    this.makeDraggable();
  }
  makeDraggable() {
    this.head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = this.el.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const move = (ev) => {
        this.el.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - ox))}px`;
        this.el.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - oy))}px`;
        this.el.style.transform = 'none';
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  get isOpen() { return !this.el.hidden; }
  open() {
    this.el.hidden = false;
    this.mgr.focus(this);
    this.render();
    this.game.audio?.play('open');
  }
  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.ui.tooltip.hide();
    this.onClose?.();
    this.game.audio?.play('close');
  }
  render() {}
  update() {}
}

// ---------------------------------------------------------------- item slot widget
function itemSlot(ui, id, count, { onRight, onLeft, drag, tooltipOpts, cls = '' } = {}) {
  const el = h('div', { class: `islot ${cls} ${id ? `q-border-${ITEMS[id]?.quality}` : 'empty'}` });
  if (id) {
    el.append(h('img', { src: registry.iconURL(`icon_${id}`), alt: ITEMS[id]?.name || '' }));
    if (count > 1) el.append(h('span', { class: 'islot-count' }, count));
    ui.tooltip.bind(el, () => itemTooltip(ui.game, id, { ...(tooltipOpts || {}), count }));
  }
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (id && onRight) { ui.tooltip.hide(); onRight(e); } });
  el.addEventListener('click', (e) => { if (id && onLeft && !ui.drag) onLeft(e); });
  if (id && drag) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      ui.beginDrag(e, { ...drag, itemId: id, icon: registry.iconURL(`icon_${id}`) });
    });
  }
  return el;
}

// ---------------------------------------------------------------- character
class CharacterWin extends Win {
  constructor(mgr) { super(mgr, 'character', 'Character', { x: '40px', y: '90px' }); }
  render() {
    const g = this.game, s = g.sheet;
    if (!s) return;
    clear(this.body);
    this.titleEl.textContent = s.name;
    const slotEl = (slot) => {
      const id = s.equip[slot];
      const el = itemSlot(this.ui, id, 1, {
        onRight: () => { const err = s.unequip(slot); if (err) g.error(err); else g.audio.play('equip'); },
        drag: { from: 'equip', slot },
      });
      el.dataset.equip = slot;
      el.classList.add('equip-slot');
      if (!id) el.append(h('span', { class: 'islot-label' }, SLOT_NAMES[slot]));
      return el;
    };
    const left = h('div', { class: 'paperdoll-col' }, ['head', 'neck', 'chest', 'hands'].map(slotEl));
    const right = h('div', { class: 'paperdoll-col' }, ['legs', 'feet', 'ring'].map(slotEl));
    const weapons = h('div', { class: 'paperdoll-weapons' }, ['mainhand', 'offhand'].map(slotEl));
    const race = RACES[s.race];
    const pts = s.points;
    const attrRows = ATTRS.map((k) => {
      const row = h('div', { class: 'stat-row' }, h('span', { class: 'stat-name' }, ATTR_NAMES[k]), h('span', { class: 'stat-val' }, s.attrs[k]));
      if (pts > 0) row.append(h('button', { class: 'stat-plus', title: `Spend a point on ${ATTR_NAMES[k]}`, onclick: () => { s.spendPoint(k); g.audio.play('click'); } }, '+'));
      this.ui.tooltip.bind(row, () => h('div', { class: 'tt-box' }, h('div', { class: 'tt-title' }, ATTR_NAMES[k]), h('div', { class: 'tt-desc' }, ATTR_HELP[k])));
      return row;
    });
    const w = s.weapon;
    const avg = (w.dmg[0] + w.dmg[1]) / 2 + s.weaponBonus;
    const derived = [
      ['Health', `${Math.round(g.player.hp)} / ${s.maxHp}`],
      s.maxMana ? ['Mana', `${Math.round(g.player.mana)} / ${s.maxMana}`] : null,
      ['Stamina', `${Math.round(g.player.st)} / ${s.maxSt}`],
      ['Armor', s.armor],
      ['Damage', `${Math.round(w.dmg[0] + s.weaponBonus)} - ${Math.round(w.dmg[1] + s.weaponBonus)}`],
      ['Damage / sec', (avg / w.speed).toFixed(1)],
      ['Spell power', s.spellPower],
      ['Critical strike', `${(s.crit * 100).toFixed(1)}%`],
      ['Dodge', `${(s.dodge * 100).toFixed(1)}%`],
    ].filter(Boolean).map(([a, b]) => h('div', { class: 'stat-row small' }, h('span', { class: 'stat-name' }, a), h('span', { class: 'stat-val' }, b)));
    const center = h('div', { class: 'paperdoll-center' },
      h('div', { class: 'char-sub' }, `Level ${s.level} ${race.name} ${s.clsDef.name}`),
      pts > 0 ? h('div', { class: 'char-points' }, `${pts} attribute point${pts > 1 ? 's' : ''} to spend`) : null,
      h('div', { class: 'stat-block' }, attrRows),
      h('div', { class: 'stat-block' }, derived),
      h('div', { class: 'char-passive' }, race.passive),
    );
    this.body.append(h('div', { class: 'paperdoll' }, left, center, right), weapons);
  }
}

// ---------------------------------------------------------------- bags
class BagsWin extends Win {
  constructor(mgr) { super(mgr, 'bags', 'Bags', { x: 'calc(100vw - 420px)', y: 'calc(100vh - 470px)' }); }
  render() {
    const g = this.game, s = g.sheet;
    if (!s) return;
    clear(this.body);
    const grid = h('div', { class: 'bag-grid' });
    const vendorOpen = this.mgr.wins.vendor.isOpen;
    s.bags.forEach((slot, i) => {
      const id = slot && slot.id;
      const sellPrice = id && vendorOpen ? Math.floor((ITEMS[id].value || 0) * SELL_MULT) : undefined;
      const el = itemSlot(this.ui, id, slot && slot.count, {
        onRight: () => {
          if (vendorOpen) this.mgr.wins.vendor.sell(i);
          else g.useBagItem(i);
        },
        drag: { from: 'bag', index: i },
        tooltipOpts: { sell: sellPrice },
      });
      el.dataset.bag = i;
      grid.append(el);
    });
    this.body.append(grid, h('div', { class: 'bag-foot' }, h('span', { class: 'bag-hint' }, vendorOpen ? 'Right-click to sell' : 'Right-click to use or equip'), h('span', { class: 'gold' }, `${s.gold} gold`)));
  }
}

// ---------------------------------------------------------------- journal
class JournalWin extends Win {
  constructor(mgr) {
    super(mgr, 'journal', 'Journal', { x: 'calc(50vw - 380px)', y: '80px' });
    this.tab = 'quests';
    this.selected = null;
  }
  open(opts = {}) {
    if (opts.quest) { this.tab = 'quests'; this.selected = opts.quest; }
    super.open();
  }
  render() {
    const g = this.game;
    if (!g.quests) return;
    clear(this.body);
    const tabs = h('div', { class: 'tabs' });
    for (const [id, label] of [['quests', 'Quests'], ['diary', 'Journal'], ['topics', 'Topics']]) {
      tabs.append(h('button', { class: `tab ${this.tab === id ? 'on' : ''}`, onclick: () => { this.tab = id; this.render(); } }, label));
    }
    this.body.append(tabs);
    if (this.tab === 'quests') this.renderQuests();
    else if (this.tab === 'diary') this.renderDiary();
    else this.renderTopics();
  }
  renderQuests() {
    const g = this.game, ql = g.quests;
    const active = QUEST_ORDER.filter((id) => ql.isActive(id));
    const done = QUEST_ORDER.filter((id) => ql.isDone(id));
    if (!this.selected || !ql.state[this.selected]) this.selected = active[0] || done[0] || null;
    const list = h('div', { class: 'ql-list' });
    const item = (id) => h('button', { class: `ql-item ${this.selected === id ? 'on' : ''} ${ql.isDone(id) ? 'done' : ''}`, onclick: () => { this.selected = id; this.render(); } },
      h('span', { class: 'ql-lvl' }, `[${QUESTS[id].level}]`), ` ${QUESTS[id].name}${ql.status(id) === 'ready' ? ' (Complete)' : ''}`);
    if (active.length) list.append(h('div', { class: 'ql-head' }, 'Active'), ...active.map(item));
    if (done.length) list.append(h('div', { class: 'ql-head' }, 'Completed'), ...done.map(item));
    if (!active.length && !done.length) list.append(h('div', { class: 'empty-note' }, 'No quests yet. People with a golden ! above their heads have work for you.'));
    const detail = h('div', { class: 'ql-detail' });
    const id = this.selected;
    if (id) {
      const q = QUESTS[id];
      detail.append(h('h3', {}, q.name));
      const st = ql.state[id];
      if (st.status !== 'done') {
        detail.append(h('div', { class: 'ql-section' }, 'Objectives'));
        for (const o of ql.objectives(id)) detail.append(h('div', { class: `ql-obj ${o.done ? 'done' : ''}` }, o.counted ? `${o.text}: ${o.have}/${o.need}` : o.text));
      } else if (st.outcome === 'bribed') {
        detail.append(h('div', { class: 'ql-obj' }, 'You took Darro Vex\'s bribe.'));
      }
      detail.append(h('div', { class: 'ql-section' }, 'Description'), h('div', { class: 'ql-text' }, g.fillText(q.offer)));
      const r = q.rewards || {};
      if (st.status !== 'done' && (r.xp || r.gold || r.items || r.choice)) {
        detail.append(h('div', { class: 'ql-section' }, 'Rewards'), rewardsView(this.ui, q, null));
      }
      if (st.status !== 'done') {
        detail.append(h('div', { class: 'ql-buttons' },
          h('button', { class: 'btn', onclick: () => { ql.tracked = id; g.questsChanged(); } }, ql.tracked === id ? 'Tracked' : 'Track'),
          id === 'fresh_boat' || id === 'passage' ? null : h('button', { class: 'btn btn-dim', onclick: () => this.confirmAbandon(id) }, 'Abandon'),
        ));
      }
    }
    this.body.append(h('div', { class: 'ql' }, list, detail));
  }
  confirmAbandon(id) {
    const detail = this.body.querySelector('.ql-buttons');
    clear(detail);
    detail.append(h('span', { class: 'confirm-text' }, `Abandon "${QUESTS[id].name}"?`),
      h('button', { class: 'btn', onclick: () => { this.game.quests.abandon(id); this.selected = null; this.render(); } }, 'Abandon'),
      h('button', { class: 'btn btn-dim', onclick: () => this.render() }, 'Keep'));
  }
  renderDiary() {
    const g = this.game;
    const page = h('div', { class: 'diary parchment' });
    let lastDay = null;
    for (const e of g.quests.journal) {
      if (e.day !== lastDay) { page.append(h('div', { class: 'diary-day' }, `Day ${e.day} of Rainmoot`)); lastDay = e.day; }
      page.append(h('p', { class: 'diary-entry' }, h('span', { class: 'diary-time' }, clockText(e.hour)), ' ', e.text));
    }
    if (!g.quests.journal.length) page.append(h('p', { class: 'diary-entry' }, 'My journal is empty. That will change soon enough.'));
    this.body.append(page);
    setTimeout(() => { page.scrollTop = page.scrollHeight; }, 0);
  }
  renderTopics() {
    const g = this.game;
    const list = h('div', { class: 'topic-index' });
    for (const t of [...g.dialog.known].sort((a, b) => a.localeCompare(b))) list.append(h('span', { class: 'topic-chip' }, t));
    this.body.append(h('div', { class: 'ql-section' }, 'Topics you can ask about'), list);
  }
}

function rewardsView(ui, q, selectHandler, selected) {
  const r = q.rewards || {};
  const box = h('div', { class: 'rewards' });
  if (r.items && r.items.length) {
    box.append(h('div', { class: 'rw-label' }, 'You will receive:'));
    const row = h('div', { class: 'rw-items' });
    for (const [id, n] of r.items) row.append(h('div', { class: 'rw-item' }, itemSlot(ui, id, n), h('span', { class: `q-${ITEMS[id].quality}` }, ITEMS[id].name)));
    box.append(row);
  }
  if (r.choice && r.choice.length) {
    box.append(h('div', { class: 'rw-label' }, selectHandler ? 'Choose your reward:' : 'You will be able to choose one of:'));
    const row = h('div', { class: 'rw-items' });
    for (const id of r.choice) {
      const it = h('div', { class: `rw-item choice ${selected === id ? 'on' : ''}` }, itemSlot(ui, id, 1), h('span', { class: `q-${ITEMS[id].quality}` }, ITEMS[id].name));
      if (selectHandler) it.addEventListener('click', () => selectHandler(id));
      row.append(it);
    }
    box.append(row);
  }
  const extra = [];
  if (r.xp) extra.push(`${r.xp} experience`);
  if (r.gold) extra.push(`${r.gold} gold`);
  if (extra.length) box.append(h('div', { class: 'rw-extra' }, extra.join(' · ')));
  return box;
}

// ---------------------------------------------------------------- spellbook
class SpellbookWin extends Win {
  constructor(mgr) { super(mgr, 'spellbook', 'Abilities', { x: '60px', y: '100px' }); }
  render() {
    const g = this.game, s = g.sheet;
    if (!s) return;
    clear(this.body);
    this.titleEl.textContent = `${s.clsDef.name} Abilities`;
    const known = s.knownAbilities();
    s.clsDef.abilities.forEach((id, i) => {
      const ab = ABILITIES[id];
      const ok = known.includes(id);
      const icon = h('img', { class: 'sb-icon', src: registry.iconURL(`icon_ab_${id}`), alt: '' });
      const row = h('div', { class: `sb-row ${ok ? '' : 'locked'}` }, icon,
        h('div', { class: 'sb-text' }, h('div', { class: 'sb-name' }, ab.name, h('span', { class: 'sb-lvl' }, ok ? '' : `  Level ${ABILITY_LEVELS[i]}`)), h('div', { class: 'sb-desc' }, ab.desc)));
      this.ui.tooltip.bind(icon, () => abilityTooltip(g, id));
      if (ok) {
        icon.addEventListener('pointerdown', (e) => { if (e.button === 0) this.ui.beginDrag(e, { from: 'spellbook', abilityId: id, icon: icon.src }); });
        icon.addEventListener('click', () => { if (!this.ui.drag) g.useAbility(id); });
      }
      this.body.append(row);
    });
    this.body.append(h('div', { class: 'win-hint' }, 'Drag an ability onto your action bar. Abilities unlock as you level up.'));
  }
}

// ---------------------------------------------------------------- map
class MapWin extends Win {
  constructor(mgr) {
    super(mgr, 'map', 'Isle of Brackwater', { cls: 'win-map' });
    this.canvas = h('canvas', { width: MAP_PX, height: MAP_PX, class: 'worldmap' });
    this.legend = h('div', { class: 'map-legend' },
      h('span', {}, h('b', { class: 'lg-q' }, '!'), ' quest'), h('span', {}, h('b', { class: 'lg-q' }, '?'), ' turn in'),
      h('span', {}, h('i', { class: 'lg-area' }), ' quest area'), h('span', {}, h('i', { class: 'lg-herb' }), ' glowcap'));
    this.body.append(this.canvas, this.legend);
  }
  render() { this.draw(); }
  update() { if (this.isOpen) this.draw(); }
  draw() {
    const g = this.game, ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.ui.mapImage, 0, 0);
    ctx.textAlign = 'center';
    for (const z of ZONES) {
      if (z.parent) continue;
      const [x, y] = worldToMap(z.x, z.z);
      const known = g.discovered[z.id];
      ctx.font = `${known ? 'bold ' : 'italic '}${z.id === 'brackwater' ? 17 : 15}px "IM Fell English SC", Georgia, serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(234,219,184,0.85)';
      const label = known ? z.name : '?';
      ctx.strokeText(label, x, y - z.r * 0.25);
      ctx.fillStyle = known ? '#3b2410' : 'rgba(59,36,16,0.45)';
      ctx.fillText(label, x, y - z.r * 0.25);
    }
    if (!g.quests || !g.player) return;
    for (const id of QUEST_ORDER) {
      if (!g.quests.isActive(id)) continue;
      const poi = g.quests.poi(id);
      if (!poi || poi.npc) continue;
      const [x, y] = worldToMap(poi.x, poi.z);
      ctx.beginPath(); ctx.arc(x, y, Math.max(8, poi.r * (MAP_PX / 640)), 0, 7);
      ctx.fillStyle = 'rgba(255,200,40,0.22)'; ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,0,0.8)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
    if (g.questNeedsItem('glowcap')) for (const o of g.interactables) if (o.isHerb && o.enabled) { const [x, y] = worldToMap(o.pos.x, o.pos.z); drawMarker(ctx, 'herb', x, y, 1); }
    for (const n of g.npcs) {
      if (!n.markerKind || n.removedFromWorld) continue;
      const [x, y] = worldToMap(n.pos.x, n.pos.z);
      drawMarker(ctx, n.markerKind, x, y, 1.1);
    }
    const [px, py] = worldToMap(g.player.pos.x, g.player.pos.z);
    drawPlayerArrow(ctx, px, py, g.player.yaw, 1.4);
  }
}

// ---------------------------------------------------------------- dialog
class DialogWin extends Win {
  constructor(mgr) {
    super(mgr, 'dialog', '', { cls: 'win-dialog', modal: true });
    this.textEl = h('div', { class: 'dlg-text' });
    this.side = h('div', { class: 'dlg-side' });
    this.body.append(h('div', { class: 'dlg' }, this.textEl, this.side));
  }
  openFor(npc) {
    const g = this.game;
    this.npc = npc;
    npc.talking = true;
    this.titleEl.textContent = npc.title ? `${npc.name}, ${npc.title}` : npc.name;
    clear(this.textEl);
    this.mode = 'talk';
    const greet = g.fillText(g.dialog.greeting(npc.id));
    super.open();
    this.say(null, greet);
    g.questEvent('talk', { npc: npc.id });
    this.renderSide();
  }
  onClose() {
    if (this.npc) this.npc.talking = false;
    this.npc = null;
    this.mgr.wins.vendor.close();
  }
  say(topic, text) {
    const g = this.game;
    const block = h('div', { class: 'dlg-entry' });
    if (topic) block.append(h('div', { class: 'dlg-topic' }, topic));
    const p = h('div', { class: 'dlg-para' });
    for (const para of g.fillText(text).split('\n\n')) {
      const pe = h('p', {});
      for (const run of g.dialog.parse(para)) {
        if (run.topic) {
          const a = h('a', { class: 'dlg-link', href: '#', onclick: (e) => { e.preventDefault(); this.ask(run.topic); } }, run.text);
          pe.append(a);
        } else pe.append(run.text);
      }
      p.append(pe);
    }
    block.append(p);
    this.textEl.append(block);
    setTimeout(() => { this.textEl.scrollTop = this.textEl.scrollHeight; }, 0);
    this.renderSide();
    return block;
  }
  ask(topic) {
    const g = this.game, npc = this.npc;
    if (!npc) return;
    if (!g.dialog.hasAnswer(npc.id, topic)) { this.say(topic, "I don't know anything about that."); return; }
    const ans = g.dialog.answer(npc.id, topic);
    const block = this.say(topic, ans.text);
    if (ans.do) ans.do(g);
    g.questEvent('talk', { npc: npc.id, topic });
    if (ans.choices) {
      const row = h('div', { class: 'dlg-choices' });
      for (const c of ans.choices) {
        if (c.if && !c.if(g)) continue;
        row.append(h('button', { class: 'dlg-choice', onclick: () => { row.remove(); if (c.reply) this.say(null, c.reply); c.do?.(g); if (this.npc) this.renderSide(); } }, c.label));
      }
      block.append(row);
    }
    g.audio.play('click');
  }
  renderSide() {
    const g = this.game, npc = this.npc;
    if (!npc) return;
    clear(this.side);
    const { offers, turnins, progress } = g.quests.forNpc(npc.id);
    if (offers.length || turnins.length || progress.length) {
      const qs = h('div', { class: 'dlg-quests' });
      for (const id of turnins) qs.append(h('button', { class: 'dlg-quest ready', onclick: () => this.showQuest(id, 'turnin') }, h('b', {}, '? '), QUESTS[id].name));
      for (const { id, low } of offers) qs.append(h('button', { class: `dlg-quest ${low ? 'low' : ''}`, onclick: () => this.showQuest(id, 'offer') }, h('b', {}, '! '), QUESTS[id].name, low ? h('span', { class: 'dlg-req' }, ` (level ${QUESTS[id].level})`) : null));
      for (const id of progress) qs.append(h('button', { class: 'dlg-quest gray', onclick: () => this.showQuest(id, 'progress') }, h('b', {}, '? '), QUESTS[id].name));
      this.side.append(qs);
    }
    const topics = h('div', { class: 'dlg-topics' });
    for (const t of g.dialog.topicsFor(npc.id)) topics.append(h('button', { class: 'dlg-topic-btn', onclick: () => this.ask(t) }, t));
    this.side.append(topics);
    const btns = h('div', { class: 'dlg-buttons' });
    if (npc.def.vendor) btns.append(h('button', { class: 'btn', onclick: () => this.mgr.openVendor(npc) }, 'Trade'));
    btns.append(h('button', { class: 'btn btn-dim', onclick: () => this.close() }, 'Goodbye'));
    this.side.append(btns);
  }
  showQuest(id, mode) {
    const g = this.game, q = QUESTS[id];
    const panel = h('div', { class: 'dlg-entry quest-panel' });
    panel.append(h('div', { class: 'dlg-topic quest' }, q.name));
    const text = mode === 'offer' ? q.offer : mode === 'turnin' ? q.complete : q.progress;
    for (const para of g.fillText(text).split('\n\n')) panel.append(h('p', {}, para));
    if (mode === 'offer') {
      panel.append(h('div', { class: 'ql-section' }, 'Objectives'));
      for (const o of q.stages[0].objectives) panel.append(h('div', { class: 'ql-obj' }, o.count > 1 ? `${o.text}: 0/${o.count}` : o.text));
      panel.append(h('div', { class: 'ql-section' }, 'Rewards'), rewardsView(this.ui, q, null));
      const low = g.sheet.level < q.level;
      panel.append(h('div', { class: 'dlg-choices' },
        low ? h('div', { class: 'dlg-req' }, `Requires level ${q.level}.`) : h('button', { class: 'btn', onclick: () => { g.quests.accept(id); this.renderSide(); panel.querySelector('.dlg-choices').replaceChildren(h('div', { class: 'dlg-accepted' }, 'Quest accepted.')); } }, 'Accept'),
        h('button', { class: 'btn btn-dim', onclick: () => panel.remove() }, 'Decline')));
    } else if (mode === 'turnin') {
      let choice = null;
      const r = q.rewards || {};
      const renderRewards = () => {
        const old = panel.querySelector('.rewards');
        const nv = rewardsView(this.ui, q, r.choice ? (c) => { choice = c; renderRewards(); } : null, choice);
        if (old) old.replaceWith(nv); else panel.insertBefore(nv, panel.querySelector('.dlg-choices'));
      };
      panel.append(h('div', { class: 'ql-section' }, 'Rewards'));
      panel.append(h('div', { class: 'dlg-choices' }, h('button', { class: 'btn', onclick: () => {
        if (r.choice && !choice) { g.error('Choose a reward first.'); return; }
        if (g.quests.turnIn(id, choice)) { panel.querySelector('.dlg-choices').replaceChildren(h('div', { class: 'dlg-accepted' }, 'Quest complete.')); this.renderSide(); }
      } }, 'Complete Quest')));
      renderRewards();
    }
    this.textEl.append(panel);
    setTimeout(() => { panel.scrollIntoView({ block: 'start' }); }, 0);
  }
}

// ---------------------------------------------------------------- loot
class LootWin extends Win {
  constructor(mgr) { super(mgr, 'loot', 'Loot', { x: 'calc(50vw + 120px)', y: 'calc(50vh - 160px)' }); }
  openFor(src, loot) {
    this.src = src;
    this.loot = loot;
    this.titleEl.textContent = src.name();
    super.open();
  }
  onClose() {
    if (this.src && this.src.onLootClosed) this.src.onLootClosed();
    if (this.src && this.src.isCorpse && this.game.target === this.src.creature && !this.loot.items.length && !this.loot.gold) this.game.setTarget(null);
    this.src = null;
  }
  render() {
    const g = this.game, L = this.loot;
    clear(this.body);
    if (!L) return;
    if (L.gold > 0) {
      const row = h('button', { class: 'loot-row', onclick: () => { g.takeLoot(L, 'gold'); this.after(); } }, h('div', { class: 'islot q-border-common' }, h('img', { src: registry.iconURL('icon_waterlogged_coin'), alt: '' })), h('span', { class: 'gold' }, `${L.gold} gold`));
      this.body.append(row);
    }
    L.items.forEach((it, i) => {
      const def = ITEMS[it.id];
      const row = h('button', { class: 'loot-row', onclick: () => { g.takeLoot(L, i); this.after(); } }, itemSlot(this.ui, it.id, it.count), h('span', { class: `q-${def.quality}` }, def.name));
      this.body.append(row);
    });
    if (!L.gold && !L.items.length) this.body.append(h('div', { class: 'empty-note' }, 'Empty.'));
    else this.body.append(h('button', { class: 'btn take-all', onclick: () => this.takeAll() }, 'Take all'));
  }
  takeAll() {
    const g = this.game, L = this.loot;
    if (L.gold) g.takeLoot(L, 'gold');
    for (let i = L.items.length - 1; i >= 0; i--) g.takeLoot(L, i);
    this.after();
  }
  after() {
    this.ui.tooltip.hide();
    if (!this.loot.gold && !this.loot.items.length) this.close();
    else this.render();
  }
  update() {
    if (this.isOpen && this.src && this.src.isCorpse && this.game.player.distTo(this.src.creature) > 6) this.close();
  }
}

// ---------------------------------------------------------------- vendor
class VendorWin extends Win {
  constructor(mgr) { super(mgr, 'vendor', 'Trade', { x: '60px', y: '90px' }); this.tab = 'buy'; }
  openFor(npc) {
    this.npc = npc;
    this.vendor = VENDORS[npc.def.vendor];
    this.titleEl.textContent = this.vendor.name;
    this.tab = 'buy';
    super.open();
    this.mgr.wins.bags.open();
    this.mgr.wins.bags.render();
  }
  onClose() { this.mgr.wins.bags.render(); }
  price(id) { return Math.max(1, Math.round((ITEMS[id].value || 1) * BUY_MULT)); }
  render() {
    const g = this.game;
    if (!this.vendor) return;
    clear(this.body);
    const tabs = h('div', { class: 'tabs' }, h('button', { class: `tab ${this.tab === 'buy' ? 'on' : ''}`, onclick: () => { this.tab = 'buy'; this.render(); } }, 'Buy'), h('button', { class: `tab ${this.tab === 'sell' ? 'on' : ''}`, onclick: () => { this.tab = 'sell'; this.render(); } }, 'Sell'));
    this.body.append(tabs);
    const list = h('div', { class: 'vendor-list' });
    if (this.tab === 'buy') {
      for (const id of this.vendor.items) {
        const def = ITEMS[id];
        const price = this.price(id);
        const afford = g.sheet.gold >= price;
        const row = h('button', { class: `vendor-row ${afford ? '' : 'poor'}`, onclick: () => this.buy(id) }, itemSlot(this.ui, id, 1, { tooltipOpts: { price } }), h('span', { class: `vr-name q-${def.quality}` }, def.name), h('span', { class: 'vr-price' }, `${price} g`));
        list.append(row);
      }
    } else {
      g.sheet.bags.forEach((s, i) => {
        if (!s) return;
        const def = ITEMS[s.id];
        const val = Math.floor((def.value || 0) * SELL_MULT);
        const row = h('button', { class: `vendor-row ${val > 0 ? '' : 'poor'}`, onclick: () => this.sell(i) }, itemSlot(this.ui, s.id, s.count, { tooltipOpts: { sell: val } }), h('span', { class: `vr-name q-${def.quality}` }, def.name), h('span', { class: 'vr-price' }, val > 0 ? `${val * s.count} g` : '—'));
        list.append(row);
      });
      if (!list.children.length) list.append(h('div', { class: 'empty-note' }, 'You have nothing to sell.'));
    }
    this.body.append(list, h('div', { class: 'bag-foot' }, h('span', { class: 'bag-hint' }, this.tab === 'buy' ? 'Click to buy' : 'Click to sell'), h('span', { class: 'gold' }, `${g.sheet.gold} gold`)));
  }
  buy(id) {
    const g = this.game, price = this.price(id);
    if (g.sheet.gold < price) { g.error('You cannot afford that.'); return; }
    if (!g.sheet.canAdd(id, 1)) { g.error('Your bags are full.'); return; }
    g.sheet.gold -= price;
    g.giveItem(id, 1);
    g.audio.play('coin');
    this.render();
  }
  sell(i) {
    const g = this.game, s = g.sheet.bags[i];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def.type === 'quest' || def.type === 'key') { g.error('You cannot sell that.'); return; }
    const val = Math.floor((def.value || 0) * SELL_MULT) * s.count;
    g.sheet.bags[i] = null;
    g.sheet.gold += val;
    g.sheet.changed('bags');
    g.log(`You sold ${def.name}${s.count > 1 ? ` x${s.count}` : ''} for ${val} gold.`, 'loot');
    g.audio.play('coin');
    g.questEvent('item');
    this.render();
  }
}

// ---------------------------------------------------------------- book
class BookWin extends Win {
  constructor(mgr) { super(mgr, 'book', 'Book', { cls: 'win-book', modal: true }); }
  openFor(id) {
    this.bookId = id;
    super.open();
  }
  render() {
    const b = BOOKS[this.bookId];
    clear(this.body);
    if (!b) return;
    this.titleEl.textContent = b.title;
    const page = h('div', { class: 'book-page parchment' }, h('h2', {}, b.title));
    page.insertAdjacentHTML('beforeend', miniMarkdown(b.text));
    this.body.append(page, h('div', { class: 'book-foot' }, h('button', { class: 'btn', onclick: () => this.close() }, 'Close')));
  }
}

// ---------------------------------------------------------------- help
export const CONTROLS = [
  ['W A S D', 'Move and strafe'], ['Mouse drag (left)', 'Look around'], ['Mouse drag (right)', 'Steer your character and camera'],
  ['Both mouse buttons', 'Run forward'], ['Mouse wheel', 'Zoom (all the way in for first person)'], ['V', 'Toggle first person'],
  ['T', 'Mouse-look mode (crosshair, left-click attacks)'], ['Space', 'Jump'], ['Shift', 'Sprint (uses stamina)'], ['R', 'Auto-run'], ['Z', 'Walk / run'],
  ['E or F', 'Talk, loot, open, gather'], ['Left click', 'Select a target'], ['Right click', 'Attack, talk or use'],
  ['Tab', 'Cycle enemy targets'], ['1 – 0', 'Action bar'], ['C', 'Character'], ['B or I', 'Bags'], ['J', 'Journal and quests'],
  ['P', 'Abilities'], ['M', 'Map'], ['F10', 'Asset Workshop'], ['F5 / F9', 'Quick save / quick load'], ['Esc', 'Close window, clear target, menu'],
];

class HelpWin extends Win {
  constructor(mgr) { super(mgr, 'help', 'How to Play', { x: 'calc(50vw - 300px)', y: '70px' }); }
  render() {
    clear(this.body);
    const t = h('div', { class: 'controls-grid' });
    for (const [k, v] of CONTROLS) t.append(h('div', { class: 'ck' }, k), h('div', { class: 'cv' }, v));
    this.body.append(t, h('div', { class: 'help-tips' },
      h('p', {}, 'People with a golden ', h('b', { class: 'lg-q' }, '!'), ' have work for you; a golden ', h('b', { class: 'lg-q' }, '?'), ' means you can turn a quest in. Underlined words in conversation are topics: click them to learn more.'),
      h('p', {}, 'You heal quickly out of combat. Eat food (it must be out of combat) or drink potions to recover faster. Pray at the Shrine of the Tide in the village square for a daily blessing.'),
    ));
  }
}

// ---------------------------------------------------------------- manager
export class Windows {
  constructor(ui) {
    this.ui = ui;
    this.layer = h('div', { class: 'windows' });
    ui.root.append(this.layer);
    this.z = 10;
    this.wins = {
      character: new CharacterWin(this), bags: new BagsWin(this), journal: new JournalWin(this), spellbook: new SpellbookWin(this),
      map: new MapWin(this), dialog: new DialogWin(this), loot: new LootWin(this), vendor: new VendorWin(this), book: new BookWin(this), help: new HelpWin(this),
    };
  }
  focus(w) { w.el.style.zIndex = ++this.z; }
  open(id, opts) { const w = this.wins[id]; if (w) w.open(opts); }
  close(id) { this.wins[id]?.close(); }
  toggle(id) {
    if (this.ui.game.state !== 'play') return;
    const w = this.wins[id];
    if (!w) return;
    if (w.isOpen) w.close(); else w.open();
  }
  refresh(id) {
    if (id === 'dialog-topics') { if (this.wins.dialog.isOpen) this.wins.dialog.renderSide(); return; }
    const w = this.wins[id];
    if (w && w.isOpen) w.render();
  }
  modal() { return Object.values(this.wins).some((w) => w.modal && w.isOpen); }
  dialogOpen() { return this.wins.dialog.isOpen; }
  closeTop() {
    const open = Object.values(this.wins).filter((w) => w.isOpen).sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0));
    if (!open.length) return false;
    open[0].close();
    return true;
  }
  closeAll() { for (const w of Object.values(this.wins)) w.close(); }
  update(dt) { for (const w of Object.values(this.wins)) if (w.isOpen) w.update(dt); }
  openDialog(npc) { this.wins.dialog.openFor(npc); }
  openLoot(src, loot) { this.wins.loot.openFor(src, loot); }
  openBook(id) { this.wins.book.openFor(id); }
  openVendor(npc) { this.wins.vendor.openFor(npc); }

  drop(payload, target) {
    const g = this.ui.game, s = g.sheet;
    const bagEl = target.closest('[data-bag]');
    const eqEl = target.closest('[data-equip]');
    if (bagEl) {
      const i = +bagEl.dataset.bag;
      if (payload.from === 'bag') { s.moveSlot(payload.index, i); return true; }
      if (payload.from === 'equip') {
        if (s.bags[i]) { g.error('Drop it on an empty slot.'); return true; }
        const err = s.unequip(payload.slot);
        if (err) g.error(err);
        return true;
      }
      return false;
    }
    if (eqEl && payload.from === 'bag') {
      const it = ITEMS[payload.itemId];
      if (it.slot !== eqEl.dataset.equip) { g.error('That does not go there.'); return true; }
      const err = s.equipFromBag(payload.index);
      if (err) g.error(err); else g.audio.play('equip');
      return true;
    }
    if (target.closest('.win-vendor') && payload.from === 'bag') { this.wins.vendor.sell(payload.index); return true; }
    return false;
  }
}

export { EQUIP_SLOTS };
