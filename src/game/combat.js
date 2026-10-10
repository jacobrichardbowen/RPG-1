// Damage, healing and timed effects (buffs, debuffs, damage/heal over time, crowd control).

export const SCHOOL_COLORS = {
  physical: '#ffffff', fire: '#ff9a40', frost: '#9ae0ff', nature: '#8ae060', shadow: '#c890ff', arcane: '#e0a0ff', holy: '#ffe08a',
};

// ---------------------------------------------------------------- effects
export function addEffect(game, unit, eff) {
  if (!unit.alive) return null;
  const existing = unit.effects.find((e) => e.id === eff.id && (e.src === eff.src || !eff.src));
  if (existing) {
    existing.t = 0;
    existing.dur = eff.dur;
    if (eff.absorb !== undefined) existing.absorb = Math.max(existing.absorb, eff.absorb);
    if (eff.amount !== undefined) existing.amount = eff.amount;
    game.ui?.effectsChanged(unit);
    return existing;
  }
  const e = { t: 0, tickT: 0, ...eff };
  unit.effects.push(e);
  if (e.stun || e.silence) interrupt(game, unit);
  if (e.stats && unit.isPlayer) game.recomputePlayer();
  game.ui?.effectsChanged(unit);
  return e;
}

export function removeEffect(game, unit, id) {
  const before = unit.effects.length;
  const had = unit.effects.filter((e) => e.id === id);
  unit.effects = unit.effects.filter((e) => e.id !== id);
  if (had.some((e) => e.stats) && unit.isPlayer) game.recomputePlayer();
  if (before !== unit.effects.length) game.ui?.effectsChanged(unit);
}

export function hasEffect(unit, id) { return unit.effects.some((e) => e.id === id); }
export const isStunned = (u) => u.effects.some((e) => e.stun);
export const isRooted = (u) => u.effects.some((e) => e.root || e.stun);
export const isSilenced = (u) => u.effects.some((e) => e.silence || e.stun);

export function speedMult(u) {
  let m = 1;
  for (const e of u.effects) if (e.slow) m *= 1 - e.slow;
  return m;
}

export function updateEffects(game, unit, dt) {
  if (!unit.effects.length) return;
  let changed = false;
  for (const e of unit.effects) {
    e.t += dt;
    if (e.interval) {
      e.tickT += dt;
      while (e.tickT >= e.interval && e.t <= e.dur + 0.01) {
        e.tickT -= e.interval;
        if (e.dot) dealDamage(game, e.srcUnit || null, unit, e.dot, { school: e.school || 'nature', periodic: true, name: e.name });
        if (e.hot) heal(game, e.srcUnit || unit, unit, e.hot, { periodic: true });
        if (e.food) {
          if (unit.inCombat && unit.inCombat()) { e.t = e.dur + 1; break; }
          heal(game, unit, unit, e.food, { periodic: true, quiet: true });
        }
      }
    }
  }
  const expired = unit.effects.filter((e) => e.t > e.dur || (e.absorb !== undefined && e.absorb <= 0));
  if (expired.length) {
    unit.effects = unit.effects.filter((e) => !expired.includes(e));
    changed = true;
    if (unit.isPlayer && expired.some((e) => e.stats)) game.recomputePlayer();
    for (const e of expired) if (e.onExpire) e.onExpire(game, unit);
  }
  if (changed) game.ui?.effectsChanged(unit);
}

export function interrupt(game, unit, lockout = 0) {
  if (!unit.cast) return false;
  const c = unit.cast;
  unit.cast = null;
  unit.visual.stop('channel');
  game.ui?.castChanged(unit);
  if (lockout) unit.lockout = { school: c.school, t: lockout };
  game.fct(unit, 'Interrupted', 'info');
  return true;
}

// ---------------------------------------------------------------- damage
export function armorReduction(armor, attackerLevel) {
  return armor / (armor + 45 + 20 * attackerLevel);
}

// Roll a weapon swing from attacker to target. Returns { hit, crit, dodge, amount }.
export function rollMelee(attacker, target, mult = 1, opts = {}) {
  const dodge = target.getDodge ? target.getDodge() : 0.05;
  const missChance = 0.04 + Math.max(0, (target.level - attacker.level) * 0.01);
  const r = Math.random();
  if (!opts.noMiss && r < missChance) return { hit: false, miss: true };
  if (!opts.noMiss && !opts.ranged && r < missChance + dodge) return { hit: false, dodge: true };
  let amount = attacker.rollWeapon() * mult;
  if (opts.statBonus && attacker.sheet) amount += attacker.sheet.attrs[opts.statBonus] * (opts.statCoef || 0);
  const crit = Math.random() < (attacker.getCrit ? attacker.getCrit() : 0.05) + (opts.critBonus || 0);
  if (crit) amount *= opts.critMult || 2;
  return { hit: true, crit, amount };
}

export function dealDamage(game, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  const school = opts.school || 'physical';
  if (tgt.evading) { game.fct(tgt, 'Evade', 'info'); return 0; }
  if (tgt.invulnerable) { game.fct(tgt, 'Immune', 'info'); return 0; }
  let dmg = amount;
  if (school === 'physical' && !opts.ignoreArmor) dmg *= 1 - armorReduction(tgt.getArmor ? tgt.getArmor() : 0, src ? src.level : tgt.level);
  if (tgt.isPlayer && tgt.sheet.race === 'ashborn' && (school === 'fire' || school === 'shadow')) dmg *= 0.75;
  if (src) {
    for (const e of src.effects) {
      if (e.dmgPct) {
        dmg *= 1 + e.dmgPct;
        if (e.consume) e.t = e.dur + 1;
      }
    }
  }
  if (tgt.dmgTakenMult) dmg *= tgt.dmgTakenMult;
  dmg = Math.max(1, Math.round(dmg));
  // Absorb shields.
  let absorbed = 0;
  for (const e of tgt.effects) {
    if (e.absorb > 0 && dmg > 0) {
      const a = Math.min(e.absorb, dmg);
      e.absorb -= a; dmg -= a; absorbed += a;
    }
  }
  if (absorbed) game.ui?.effectsChanged(tgt);
  tgt.hp = Math.max(0, tgt.hp - dmg);
  tgt.lastHitT = game.elapsed;
  if (dmg > 0 || absorbed > 0) {
    const txt = dmg > 0 ? `${dmg}${opts.crit ? '!' : ''}` : '';
    game.fct(tgt, absorbed ? `${txt}${txt ? ' ' : ''}(${absorbed} absorbed)` : txt, tgt.isPlayer ? 'taken' : opts.crit ? 'crit' : 'dmg', SCHOOL_COLORS[school]);
    if (!opts.periodic && dmg > 0) {
      tgt.visual.flash(tgt.isPlayer ? 0xff2020 : 0xffffff, 0.1);
      if (!tgt.cast && Math.random() < 0.6) tgt.visual.play('hit', 0.35);
    }
    if (tgt.isPlayer && dmg > tgt.maxHp * 0.12) game.rig.shake = Math.min(1, game.rig.shake + 0.5);
    if (!opts.periodic) game.audio?.play(opts.crit ? 'hit_crit' : school === 'physical' ? 'hit' : `hit_${school}`, tgt.pos);
  }
  if (src && src !== tgt) {
    game.enterCombat(src, tgt);
    if (tgt.onDamaged) tgt.onDamaged(src, dmg);
  }
  if (opts.name || opts.ability) {
    const who = src ? (src.isPlayer ? 'Your ' : `${src.displayName()}'s `) : '';
    const whom = tgt.isPlayer ? 'you' : tgt.displayName();
    game.log(`${who}${opts.name || opts.ability || 'attack'} hits ${whom} for ${dmg}${opts.crit ? ' (critical)' : ''}.`, 'combat');
  }
  if (tgt.hp <= 0) game.kill(tgt, src);
  return dmg;
}

export function heal(game, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  const before = tgt.hp;
  tgt.hp = Math.min(tgt.maxHp, tgt.hp + Math.round(amount));
  const gained = Math.round(tgt.hp - before);
  if (gained > 0 && !opts.quiet) game.fct(tgt, `+${gained}`, 'heal');
  return gained;
}
