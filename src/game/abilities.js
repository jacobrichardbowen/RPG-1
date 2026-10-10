// Executes class abilities for the player and spells for creatures.
import { ABILITIES, MELEE_RANGE, GCD } from '../data/classes.js';
import { addEffect, dealDamage, heal, interrupt, rollMelee, isStunned, isSilenced } from './combat.js';

export function abilityRangeOk(caster, target, def) {
  if (!target) return true;
  const d = caster.edgeDist(target);
  if (def.range === 'melee') return d <= MELEE_RANGE + 0.4;
  if (typeof def.range === 'number' && def.range > 0) {
    if (d > def.range) return false;
    if (def.minRange && d < def.minRange) return false;
  }
  return true;
}

export function resolveTarget(game, caster, def) {
  if (def.target !== 'enemy') return null;
  let t = caster.target;
  if (t && (!t.alive || !game.isHostile(caster, t))) t = null;
  if (!t) {
    t = game.nearestEnemy(caster, typeof def.range === 'number' ? def.range : 6, true);
    if (t) game.setTarget(t);
  }
  return t;
}

// Returns null on success, or a message explaining why the ability can't be used.
export function tryUseAbility(game, caster, id) {
  const def = ABILITIES[id];
  if (!def) return 'Unknown ability.';
  if (!caster.alive) return 'You are dead.';
  if (isStunned(caster)) return 'You are stunned.';
  if (def.cost.mana && isSilenced(caster)) return 'You are silenced.';
  if ((caster.cooldowns[id] || 0) > 0) return 'That ability is not ready yet.';
  if (!def.offGcd && caster.gcd > 0) return '';
  if (caster.cast) return 'You are already casting.';
  if (def.cost.mana && caster.mana < def.cost.mana) return 'Not enough mana.';
  if (def.cost.st && caster.st < def.cost.st) return 'Not enough stamina.';
  if (def.combatOk === false && caster.inCombat()) return 'You cannot do that while in combat.';
  const target = resolveTarget(game, caster, def);
  if (def.target === 'enemy') {
    if (!target) return 'You have no target.';
    if (!abilityRangeOk(caster, target, def)) {
      if (def.minRange && caster.edgeDist(target) < def.minRange) return 'Target is too close.';
      return 'Out of range.';
    }
    if (def.range !== 'melee' && !game.lineOfSight(caster, target)) return 'Target is not in line of sight.';
    caster.faceUnit(target);
  }
  if (!def.offGcd) caster.gcd = GCD;
  if (def.cast > 0) {
    caster.cast = { id, t: 0, dur: def.cast * (caster.castMult || 1), target, name: def.name, school: def.effects[0]?.onHit?.[0]?.school || 'arcane', icon: `icon_ab_${id}` };
    caster.visual.play('channel', 1);
    game.ui?.castChanged(caster);
    game.audio?.play('cast_start', caster.pos);
    return null;
  }
  execute(game, caster, id, target);
  return null;
}

export function updateCast(game, caster, dt) {
  const c = caster.cast;
  if (!c) return;
  c.t += dt;
  if (c.t < c.dur) return;
  caster.cast = null;
  caster.visual.stop('channel');
  game.ui?.castChanged(caster);
  if (c.creatureSpell) {
    finishCreatureSpell(game, caster, c);
    return;
  }
  const def = ABILITIES[c.id];
  if (def.target === 'enemy' && (!c.target || !c.target.alive)) return;
  if (def.cost.mana && caster.mana < def.cost.mana) { game.error('Not enough mana.'); return; }
  execute(game, caster, c.id, c.target);
}

function execute(game, caster, id, target) {
  const def = ABILITIES[id];
  if (def.cost.mana) caster.mana -= def.cost.mana;
  if (def.cost.st) caster.st -= def.cost.st;
  if (def.cd) caster.cooldowns[id] = def.cd;
  if (def.anim) caster.visual.play(def.anim, def.anim === 'cast' ? 0.5 : 0.55);
  game.audio?.play(def.sound || 'swing', caster.pos);
  if (target && def.target === 'enemy') {
    game.enterCombat(caster, target);
    if (caster.isPlayer) caster.autoAttack = def.range === 'melee' || caster.autoAttack;
  }
  for (const eff of def.effects) {
    if (eff.delay) game.after(eff.delay, () => applyEffect(game, caster, target, eff, def));
    else applyEffect(game, caster, target, eff, def);
  }
  game.ui?.abilityUsed(id);
}

function applyEffect(game, caster, target, eff, def) {
  if (!caster.alive) return;
  switch (eff.type) {
    case 'weapon': {
      if (!target || !target.alive) return;
      let mult = eff.mult;
      if (eff.execute && target.hp / target.maxHp < eff.execute) mult *= 2;
      const r = rollMelee(caster, target, mult, eff);
      if (!r.hit) { game.fct(target, r.dodge ? 'Dodge' : 'Miss', 'info'); return; }
      dealDamage(game, caster, target, r.amount, { crit: r.crit, name: def.name });
      return;
    }
    case 'cleave': {
      if (!target) return;
      const others = game.enemiesNear(caster, target.pos, eff.radius).filter((u) => u !== target).slice(0, eff.count);
      for (const o of others) {
        const r = rollMelee(caster, o, eff.mult, { noMiss: true });
        dealDamage(game, caster, o, r.amount, { crit: r.crit, name: def.name });
      }
      return;
    }
    case 'interrupt':
      if (!target) return;
      if (interrupt(game, target, 4)) game.log(`You interrupt ${target.displayName()}.`, 'combat');
      if (eff.silence) addEffect(game, target, { id: 'silence', name: 'Silenced', silence: true, dur: eff.silence, harmful: true, icon: `icon_ab_${def.id || 'counterspell'}` });
      return;
    case 'stun':
      if (!target || !target.alive) return;
      if (target.ccImmune) { game.fct(target, 'Immune', 'info'); return; }
      addEffect(game, target, { id: 'stun', name: 'Stunned', stun: true, dur: eff.dur, harmful: true, icon: 'icon_fx_stun' });
      return;
    case 'root':
      if (!target || !target.alive) return;
      if (target.ccImmune) { game.fct(target, 'Immune', 'info'); return; }
      addEffect(game, target, { id: 'root', name: 'Frozen', root: true, dur: eff.dur, harmful: true, icon: 'icon_fx_root' });
      game.fx?.freeze(target, eff.dur);
      return;
    case 'slow':
      if (!target || !target.alive) return;
      addEffect(game, target, { id: 'slow', name: 'Chilled', slow: target.ccImmune ? eff.pct * 0.5 : eff.pct, dur: eff.dur, harmful: true, icon: 'icon_fx_slow' });
      return;
    case 'charge':
      if (!target) return;
      caster.dash = { target, speed: 30, onArrive: () => {
        if (target.alive && !target.ccImmune) addEffect(game, target, { id: 'stun', name: 'Stunned', stun: true, dur: eff.stun, harmful: true, icon: 'icon_fx_stun' });
      } };
      return;
    case 'restore':
      if (eff.st) caster.st = Math.min(caster.maxSt, caster.st + eff.st);
      if (eff.mana) caster.mana = Math.min(caster.maxMana, caster.mana + eff.mana);
      return;
    case 'aoe': {
      const center = eff.center === 'target' && target ? target.pos : caster.pos;
      for (const u of game.enemiesNear(caster, center, eff.radius)) {
        for (const sub of eff.effects) applyEffect(game, caster, u, sub, def);
      }
      return;
    }
    case 'hot': {
      const ticks = eff.dur;
      addEffect(game, caster, { id: eff.id, name: eff.name, hot: (caster.maxHp * eff.pct) / ticks, interval: 1, dur: eff.dur, srcUnit: caster, icon: `icon_ab_${eff.id}` });
      game.fx?.sparkle(caster, 0xff8080);
      return;
    }
    case 'dot': {
      if (!target || !target.alive) return;
      const stat = eff.stat && caster.sheet ? caster.sheet.attrs[eff.stat] : 0;
      addEffect(game, target, { id: eff.id, name: eff.name, dot: eff.base + stat * eff.coef + caster.level, interval: eff.interval, dur: eff.dur, school: eff.school, src: caster.id, srcUnit: caster, harmful: true, icon: `icon_ab_venom_edge` });
      return;
    }
    case 'shield':
      addEffect(game, caster, { id: eff.id, name: eff.name, absorb: eff.base + eff.coef * caster.getSpellPower(), dur: eff.dur, icon: `icon_ab_${eff.id}` });
      game.fx?.ward(caster, eff.dur);
      return;
    case 'spell': {
      if (!target || !target.alive) return;
      const [lo, hi] = eff.base;
      let amount = lo + Math.random() * (hi - lo) + eff.coef * caster.getSpellPower();
      const crit = Math.random() < 0.05 + (caster.sheet ? caster.sheet.attrs.int * 0.0012 : 0);
      if (crit) amount *= 1.5;
      dealDamage(game, caster, target, amount, { school: eff.school, crit, name: def.name });
      return;
    }
    case 'projectile': {
      if (!target) return;
      game.fx?.projectile(caster, target, { color: eff.color, speed: eff.speed, size: eff.size, knife: eff.knife }, () => {
        for (const sub of eff.onHit) applyEffect(game, caster, target, sub, def);
      });
      return;
    }
    case 'shadowstep': {
      if (!target) return;
      const back = 1.4 + target.radius;
      const x = target.pos.x - Math.sin(target.yaw) * back, z = target.pos.z - Math.cos(target.yaw) * back;
      game.fx?.burst(caster.pos, 0x8060c0);
      caster.setPosition(x, z, game.world.collision.groundAt(x, z, target.pos.y + 1, 1));
      caster.faceUnit(target);
      game.fx?.burst(caster.pos, 0x8060c0);
      return;
    }
    case 'buff':
      addEffect(game, caster, { id: eff.id, name: eff.name, dmgPct: eff.dmgPct, dur: eff.dur, consume: eff.consume, icon: `icon_ab_shadowstep` });
      return;
    case 'fx':
      if (eff.fx === 'ring') game.fx?.ring(caster.pos, eff.radius, eff.color);
      else if (eff.fx === 'burst') game.fx?.burst((eff.at === 'target' && target ? target : caster).pos, eff.color);
      else if (eff.fx === 'pillar' && target) game.fx?.pillar(target.pos, eff.radius, eff.color);
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------- creature spells
export function startCreatureSpell(game, c, spell, target) {
  if (c.cast || isSilenced(c)) return false;
  c.cast = { creatureSpell: spell, t: 0, dur: spell.cast, target, name: spell.name, school: spell.school };
  c.visual.play('channel', 1);
  if (target) c.faceUnit(target);
  game.ui?.castChanged(c);
  return true;
}

function finishCreatureSpell(game, c, cast) {
  const s = cast.creatureSpell;
  c.visual.play('cast', 0.5);
  if (s.heal) {
    heal(game, c, c, c.maxHp * s.heal);
    game.fx?.sparkle(c, 0x60e0d0);
    return;
  }
  const t = cast.target;
  if (!t || !t.alive) return;
  if (c.distTo(t) > (s.range || 30) + 4) return;
  const dmg = c.spellDamage(s.dmg);
  if (s.aoe) {
    game.fx?.ring(c.pos, s.aoe, s.color || 0x40e0e0);
    for (const u of game.hostilesOf(c, c.pos, s.aoe)) dealDamage(game, c, u, dmg, { school: s.school, name: s.name });
    return;
  }
  game.audio?.play(s.school === 'nature' ? 'cast_nature' : 'cast_shadow', c.pos);
  game.fx?.projectile(c, t, { color: s.color || 0x40d0d0, speed: 22, size: 0.3 }, () => {
    dealDamage(game, c, t, dmg, { school: s.school, name: s.name });
  });
}
