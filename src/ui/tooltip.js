// WoW-style tooltips for items and abilities.
import { h } from './dom.js';
import { ITEMS, SLOT_NAMES } from '../data/items.js';
import { ABILITIES } from '../data/classes.js';
import { ATTR_NAMES } from '../game/character.js';

export class Tooltip {
  constructor(root) {
    this.el = h('div', { class: 'tooltip', hidden: true });
    root.append(this.el);
  }
  show(content, x, y) {
    this.el.replaceChildren(content);
    this.el.hidden = false;
    this.move(x, y);
  }
  move(x, y) {
    const r = this.el.getBoundingClientRect();
    let px = x + 16, py = y + 16;
    if (px + r.width > window.innerWidth - 8) px = x - r.width - 12;
    if (py + r.height > window.innerHeight - 8) py = window.innerHeight - r.height - 8;
    this.el.style.left = `${Math.max(4, px)}px`;
    this.el.style.top = `${Math.max(4, py)}px`;
  }
  hide() { this.el.hidden = true; }

  // Attach hover behaviour to an element; builder returns content when shown.
  bind(el, builder) {
    el.addEventListener('pointerenter', (e) => { const c = builder(); if (c) this.show(c, e.clientX, e.clientY); });
    el.addEventListener('pointermove', (e) => { if (!this.el.hidden) this.move(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', () => this.hide());
  }
}

export function itemTooltip(game, id, { price, sell, compare = true, count } = {}) {
  const it = ITEMS[id];
  if (!it) return null;
  const rows = [h('div', { class: `tt-title q-${it.quality}` }, it.name)];
  if (it.type === 'quest' || it.type === 'key') rows.push(h('div', { class: 'tt-line' }, it.type === 'key' ? 'Key' : 'Quest Item'));
  if (it.slot) {
    const two = it.twoHand ? 'Two-Hand' : SLOT_NAMES[it.slot];
    rows.push(h('div', { class: 'tt-split' }, h('span', {}, two), h('span', {}, it.wtype ? cap(it.wtype) : '')));
  }
  if (it.dmg) {
    rows.push(h('div', { class: 'tt-split' }, h('span', {}, `${it.dmg[0]} - ${it.dmg[1]} Damage`), h('span', {}, `Speed ${it.speed.toFixed(2)}`)));
    rows.push(h('div', { class: 'tt-line' }, `(${(((it.dmg[0] + it.dmg[1]) / 2) / it.speed).toFixed(1)} damage per second)`));
  }
  if (it.armor) rows.push(h('div', { class: 'tt-line' }, `${it.armor} Armor`));
  for (const [k, v] of Object.entries(it.stats || {})) rows.push(h('div', { class: 'tt-line' }, `+${v} ${ATTR_NAMES[k]}`));
  if (it.cls) rows.push(h('div', { class: 'tt-line' }, `Classes: ${cap(it.cls)}`));
  if (it.type === 'weapon' && game.sheet && !game.sheet.clsDef.weapons.includes(it.wtype)) rows.push(h('div', { class: 'tt-line tt-bad' }, `Your class cannot use ${it.wtype}s`));
  if (it.desc) rows.push(h('div', { class: 'tt-use' }, it.type === 'consumable' ? `Use: ${it.desc}` : it.desc));
  if (it.book) rows.push(h('div', { class: 'tt-use' }, 'Right-click to read'));
  if (it.stack > 1 && count) rows.push(h('div', { class: 'tt-dim' }, `Stack: ${count}/${it.stack}`));
  if (price !== undefined) rows.push(h('div', { class: 'tt-price' }, `Price: ${price} gold`));
  if (sell !== undefined) rows.push(h('div', { class: 'tt-price' }, sell > 0 ? `Sells for ${sell} gold` : 'No sell value'));
  else if (it.value && price === undefined) rows.push(h('div', { class: 'tt-dim' }, `Sell value: ${Math.max(1, Math.floor(it.value * 0.25))} gold`));
  const box = h('div', { class: 'tt-box' }, rows);
  if (compare && it.slot && game.sheet) {
    const cur = game.sheet.equip[it.slot];
    if (cur && cur !== id) {
      const c = itemTooltip(game, cur, { compare: false });
      return h('div', { class: 'tt-compare' }, box, h('div', { class: 'tt-equipped' }, h('div', { class: 'tt-dim tt-eq-label' }, 'Currently equipped'), c));
    }
  }
  return box;
}

export function abilityTooltip(game, id) {
  const ab = ABILITIES[id];
  if (!ab) return null;
  const cost = ab.cost.mana ? `${ab.cost.mana} Mana` : ab.cost.st ? `${ab.cost.st} Stamina` : '';
  const range = ab.range === 'melee' ? 'Melee range' : ab.range > 0 ? `${ab.range} m range` : '';
  const cast = ab.cast ? `${ab.cast.toFixed(1)} sec cast` : 'Instant';
  const cd = ab.cd ? `${ab.cd} sec cooldown` : '';
  const known = game.sheet ? game.sheet.knownAbilities().includes(id) : true;
  const lvl = game.abilityLevel ? game.abilityLevel(id) : 1;
  return h('div', { class: 'tt-box' },
    h('div', { class: 'tt-title' }, ab.name),
    h('div', { class: 'tt-split' }, h('span', {}, cost), h('span', {}, range)),
    h('div', { class: 'tt-split' }, h('span', {}, cast), h('span', {}, cd)),
    h('div', { class: 'tt-desc' }, ab.desc),
    known ? null : h('div', { class: 'tt-line tt-bad' }, `Requires level ${lvl}`),
  );
}

export function effectTooltip(e) {
  const rows = [h('div', { class: 'tt-title' }, e.name || e.id)];
  if (e.stats) rows.push(h('div', { class: 'tt-line' }, Object.entries(e.stats).map(([k, v]) => `+${v} ${ATTR_NAMES[k]}`).join(', ')));
  if (e.absorb !== undefined) rows.push(h('div', { class: 'tt-line' }, `Absorbs ${Math.round(e.absorb)} damage`));
  if (e.dot) rows.push(h('div', { class: 'tt-line' }, `${Math.round(e.dot)} damage every ${e.interval} sec`));
  if (e.hot) rows.push(h('div', { class: 'tt-line' }, `Heals ${Math.round(e.hot)} every ${e.interval} sec`));
  if (e.slow) rows.push(h('div', { class: 'tt-line' }, `Movement slowed by ${Math.round(e.slow * 100)}%`));
  if (e.stun) rows.push(h('div', { class: 'tt-line' }, 'Stunned'));
  if (e.root) rows.push(h('div', { class: 'tt-line' }, 'Cannot move'));
  if (e.dmgPct) rows.push(h('div', { class: 'tt-line' }, `Next attack deals ${Math.round(e.dmgPct * 100)}% more damage`));
  if (e.jump) rows.push(h('div', { class: 'tt-line' }, 'Jumps soar to tremendous heights'));
  if (e.featherfall) rows.push(h('div', { class: 'tt-line' }, 'No falling damage'));
  if (e.food) rows.push(h('div', { class: 'tt-line' }, 'Restoring health'));
  rows.push(h('div', { class: 'tt-dim' }, `${Math.max(0, Math.ceil(e.dur - e.t))} sec remaining`));
  return h('div', { class: 'tt-box' }, rows);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
