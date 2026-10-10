// Hostile creatures: wander, aggro, chase, melee or cast, flee, leash home, die, respawn.
import { Unit } from './unit.js';
import { CREATURES, levelHp, levelDmg, levelArmor } from '../data/creatures.js';
import { isStunned, isRooted, speedMult, isSilenced, dealDamage, addEffect } from '../game/combat.js';
import { startCreatureSpell } from '../game/abilities.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Creature extends Unit {
  constructor(game, type, spawn) {
    const def = CREATURES[type];
    super(game, { slot: def.model, name: def.name, level: spawn.level || 1, faction: 'hostile', radius: def.radius, height: def.height });
    this.type = type;
    this.def = def;
    this.spawn = spawn;
    this.isCreature = true;
    this.title = def.title || '';
    this.elite = !!def.elite;
    this.boss = !!def.boss;
    this.rare = !!def.rare;
    this.ccImmune = !!def.boss;
    if (def.weapon) this.visual.attach('grip_r', def.weapon, { upright: def.upright });
    this.resetStats();
    this.state = 'idle';
    this.stateT = rand(0, 4);
    this.swingT = 0;
    this.wanderTo = null;
    this.abilityT = {};
    for (const a of def.abilities || []) this.abilityT[a.id] = a.every * rand(0.4, 0.8);
    for (const s of def.spells || []) if (s.every) this.abilityT[s.id] = s.every * rand(0.5, 1);
    this.fled = false;
    this.corpseT = 0;
    this.respawnT = 0;
    this.loot = null;
    this.phase = 0;
    this.stuckT = 0;
    this.lastPos = { x: spawn.x, z: spawn.z };
    this.combatT = 0;
    this.yaw = rand(0, Math.PI * 2);
  }

  resetStats() {
    const def = this.def, L = this.level;
    this.maxHp = Math.round(levelHp(L) * def.hp);
    this.hp = this.maxHp;
    this.maxMana = def.spells ? 100 : 0;
    this.mana = this.maxMana;
    this.effects = [];
    this.alive = true;
  }

  displayName() { return this.name; }
  getArmor() { return levelArmor(this.level) * this.def.armor; }
  getCrit() { return 0.05; }
  getDodge() { return 0.04; }
  getSpellPower() { return 0; }
  rollWeapon() { return levelDmg(this.level) * this.def.dmg * rand(0.8, 1.2); }
  spellDamage(mult) { return levelDmg(this.level) * mult * rand(0.9, 1.1); }
  inCombat() { return this.state === 'combat' || this.state === 'flee'; }

  aggroRange(player) {
    const d = this.def.aggro + (this.level - player.level) * 1.2;
    return Math.max(4, Math.min(30, d));
  }

  engage(target) {
    if (!this.alive || this.state === 'evade') return;
    if (this.state !== 'combat' && this.state !== 'flee') {
      this.state = 'combat';
      this.target = target;
      this.combatT = 0;
      this.game.audio?.play(`aggro_${this.def.sound}`, this.pos);
      if (this.boss) this.game.yell(this, 'Another offering for the Eye! Kneel, and let the water take you.');
      // Call friends.
      if (this.def.social) {
        for (const c of this.game.creatures) {
          if (c !== this && c.alive && c.state !== 'combat' && c.def.family === this.def.family && c.distTo(this) < this.def.social) {
            c.engage(target);
          }
        }
      }
    }
  }

  onDamaged(src) {
    if (src && src.isPlayer) this.engage(src);
  }

  moveToward(dt, tx, tz, speed, stopDist = 0) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopDist || isRooted(this)) {
      this.move(dt, 0, 0, 0);
      return d;
    }
    let wx = dx / d, wz = dz / d;
    // Simple unstuck: if we haven't moved, try sliding sideways for a moment.
    if (this.unstuck > 0) {
      this.unstuck -= dt;
      const s = this.unstuckDir;
      const nx = wx * 0.4 + -wz * s, nz = wz * 0.4 + wx * s;
      const l = Math.hypot(nx, nz);
      wx = nx / l; wz = nz / l;
    }
    this.yaw = Math.atan2(wx, wz);
    this.move(dt, wx, wz, speed * speedMult(this));
    // Avoid deep water.
    if (this.swimming && !this.def.swims) {
      this.pos.x -= wx * speed * dt * 1.5;
      this.pos.z -= wz * speed * dt * 1.5;
    }
    this.stuckT += dt;
    if (this.stuckT > 0.6) {
      const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
      if (moved < speed * 0.6 * 0.15 && !(this.unstuck > 0)) { this.unstuck = 0.8; this.unstuckDir = Math.random() < 0.5 ? -1 : 1; }
      this.lastPos.x = this.pos.x; this.lastPos.z = this.pos.z;
      this.stuckT = 0;
    }
    return d;
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) {
      this.corpseT += dt;
      this.move(dt, 0, 0, 0);
      const empty = !this.loot || (this.loot.items.length === 0 && this.loot.gold === 0);
      if (this.corpseT > (empty ? 20 : 120) && !this.removed) {
        this.visual.setVisible(false);
        this.removed = true;
      }
      if (this.def.noRespawn || this.spawn.respawn === 0) return;
      this.respawnT += dt;
      if (this.respawnT > (this.spawn.respawn || 150)) {
        if (Math.hypot(g.player.pos.x - this.spawn.x, g.player.pos.z - this.spawn.z) > 35) this.respawn();
        else this.respawnT -= 10;
      }
      return;
    }
    if (isStunned(this) || this.faction !== 'hostile') { this.move(dt, 0, 0, 0); return; }
    const p = g.player;
    const speed = this.def.speed;
    switch (this.state) {
      case 'idle':
      case 'wander': {
        this.stateT -= dt;
        if (this.wanderTo) {
          const d = this.moveToward(dt, this.wanderTo.x, this.wanderTo.z, speed * 0.32, 0.5);
          if (d < 0.6 || this.stateT < -8) this.wanderTo = null;
        } else {
          this.move(dt, 0, 0, 0);
          if (this.stateT <= 0 && this.spawn.wander > 0) {
            const a = rand(0, Math.PI * 2), r = rand(0, this.spawn.wander);
            this.wanderTo = { x: this.spawn.x + Math.cos(a) * r, z: this.spawn.z + Math.sin(a) * r };
            this.stateT = rand(4, 9);
          }
        }
        if (p.alive && !p.hidden && !g.peaceful) {
          const d = this.distTo(p);
          if (d < this.aggroRange(p) && Math.abs(p.pos.y - this.pos.y) < 8 && g.lineOfSight(this, p)) this.engage(p);
        }
        break;
      }
      case 'combat':
        this.updateCombat(dt);
        break;
      case 'flee': {
        this.stateT -= dt;
        const t = this.target;
        if (t) {
          const ax = this.pos.x - t.pos.x, az = this.pos.z - t.pos.z, l = Math.hypot(ax, az) || 1;
          this.moveToward(dt, this.pos.x + (ax / l) * 6, this.pos.z + (az / l) * 6, speed * 0.75);
        }
        if (this.stateT <= 0) this.state = 'combat';
        break;
      }
      case 'evade': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
        const d = this.moveToward(dt, this.spawn.x, this.spawn.z, speed * 1.4, 0.8);
        if (d < 1.2 || this.stateT-- < -2000) {
          this.state = 'idle';
          this.evading = false;
          this.hp = this.maxHp;
          this.effects = [];
          this.fled = false;
          this.phase = 0;
        }
        break;
      }
      default: break;
    }
  }

  startEvade() {
    this.state = 'evade';
    this.evading = true;
    this.target = null;
    this.cast = null;
    this.stateT = 0;
    this.effects = this.effects.filter((e) => !e.harmful);
    this.game.ui?.castChanged(this);
    if (this.game.target === this) this.game.ui?.targetChanged();
  }

  updateCombat(dt) {
    const g = this.game, t = this.target, def = this.def;
    this.combatT += dt;
    if (!t || !t.alive || t.hidden) { this.startEvade(); return; }
    const homeD = Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z);
    if (homeD > (def.leash || 48) || (this.distTo(t) > 60)) { this.startEvade(); return; }
    // Morale.
    if (def.flee && !this.fled && this.hp / this.maxHp < def.flee) {
      this.fled = true;
      this.state = 'flee';
      this.stateT = 5;
      g.fct(this, 'flees in terror!', 'info');
      g.log(`${this.name} attempts to run away in fear!`, 'emote');
      return;
    }
    if (def.surrender && this.hp / this.maxHp < def.surrender) { g.onSurrender(this); return; }
    if (this.boss) this.bossPhases(dt);
    for (const id of Object.keys(this.abilityT)) this.abilityT[id] -= dt;
    if (this.cast) { this.move(dt, 0, 0, 0); this.faceUnit(t); return; }
    const d = this.edgeDist(t);
    // Special abilities.
    for (const a of def.abilities || []) {
      if (this.abilityT[a.id] > 0) continue;
      if (a.leap && d > 4 && d < a.range) {
        this.abilityT[a.id] = a.every;
        this.dash = { target: t, speed: 18, onArrive: () => dealDamage(g, this, t, this.rollWeapon() * a.dmg, { name: a.name }) };
        g.log(`${this.name} pounces!`, 'emote');
        return;
      }
      if (!a.leap && d < (a.aoe || this.def.reach + 1)) {
        this.abilityT[a.id] = a.every;
        this.telegraph(a, t);
        return;
      }
    }
    for (const s of def.spells || []) {
      if (!s.every || this.abilityT[s.id] > 0) continue;
      if (s.self && this.hp / this.maxHp < 0.6 && !isSilenced(this)) {
        this.abilityT[s.id] = s.every;
        startCreatureSpell(g, this, s, this);
        return;
      }
    }
    const caster = def.behavior === 'caster' && !isSilenced(this) && def.spells;
    if (caster) {
      const s = def.spells.find((x) => !x.every);
      const range = Math.min(s.range, 24);
      if (d > range || !g.lineOfSight(this, t)) {
        this.moveToward(dt, t.pos.x, t.pos.z, def.speed);
        return;
      }
      if (d > 3.5 || this.combatT < 2) {
        this.move(dt, 0, 0, 0);
        this.faceUnit(t);
        this.swingT -= dt;
        if (this.swingT <= 0) {
          this.swingT = 0.6 + Math.random() * 0.8;
          startCreatureSpell(g, this, s, t);
        }
        return;
      }
    }
    // Melee.
    if (d > def.reach) {
      this.moveToward(dt, t.pos.x, t.pos.z, def.speed);
      this.swingT = Math.max(this.swingT, 0.3);
      return;
    }
    this.move(dt, 0, 0, 0);
    this.faceUnit(t);
    this.swingT -= dt;
    if (this.swingT <= 0) {
      this.swingT = def.attackSpeed;
      this.visual.play(this.def.weapon ? 'slash' : 'attack', Math.min(0.7, def.attackSpeed * 0.45));
      g.after(Math.min(0.7, def.attackSpeed * 0.45) * 0.45, () => {
        if (!this.alive || !t.alive || this.edgeDist(t) > def.reach + 1.2 || isStunned(this)) return;
        const dodge = t.getDodge ? t.getDodge() : 0;
        const r = Math.random();
        if (r < 0.05) { g.fct(t, 'Miss', 'info'); return; }
        if (r < 0.05 + dodge) { g.fct(t, 'Dodge', 'info'); return; }
        const crit = Math.random() < 0.05;
        dealDamage(g, this, t, this.rollWeapon() * (crit ? 1.5 : 1), { crit });
        g.audio?.play(`attack_${def.sound}`, this.pos);
      });
    }
  }

  // Telegraphed attack: a warning ring, then damage to whatever is still inside.
  telegraph(a, t) {
    const g = this.game;
    const radius = a.aoe || 3;
    const center = a.aoe ? { x: this.pos.x, z: this.pos.z } : { x: t.pos.x, z: t.pos.z };
    const cast = a.cast || 1.2;
    this.cast = { creatureSpell: { name: a.name, cast, telegraph: true }, t: 0, dur: cast, name: a.name };
    g.ui?.castChanged(this);
    g.fx?.telegraph(center, radius, cast, 0xff5030);
    g.log(`${this.name} begins to ${a.name.toLowerCase()}!`, 'emote');
    g.after(cast, () => {
      if (!this.alive) return;
      this.cast = null;
      g.ui?.castChanged(this);
      this.visual.play('overhead', 0.5);
      for (const u of g.hostilesOf(this, center, radius)) {
        dealDamage(g, this, u, this.rollWeapon() * a.dmg, { name: a.name });
        if (a.knock && u.alive) {
          const dx = u.pos.x - center.x, dz = u.pos.z - center.z, l = Math.hypot(dx, dz) || 1;
          u.vel.x = (dx / l) * 9; u.vel.z = (dz / l) * 9; u.vel.y = 5; u.grounded = false;
        }
      }
      g.rig.shake = Math.min(1, g.rig.shake + 0.4);
    });
  }

  bossPhases() {
    const g = this.game;
    const f = this.hp / this.maxHp;
    if (this.phase === 0 && f < 0.6) {
      this.phase = 1;
      g.yell(this, 'Rise, children of the deep! Rise and feed!');
      g.spawnAdds(this, 'deepspawn', 2);
      this.abilityT.wave = 6;
    } else if (this.phase === 1 && f < 0.3) {
      this.phase = 2;
      g.yell(this, 'The tide rises! Drown with me, little stranger!');
      g.spawnAdds(this, 'deepspawn', 1);
      this.abilityT.wave = 1;
    }
    if (this.phase >= 1 && this.abilityT.wave <= 0 && !this.cast) {
      this.abilityT.wave = this.phase >= 2 ? 11 : 14;
      const t = this.target;
      const center = { x: t.pos.x, z: t.pos.z };
      g.fx?.telegraph(center, 5, 2.6, 0x40e0ff);
      g.log('Sister Morwen calls a Drowning Wave!', 'emote');
      g.after(2.6, () => {
        if (!this.alive) return;
        for (const u of g.hostilesOf(this, center, 5)) {
          dealDamage(g, this, u, u.maxHp * 0.25, { school: 'shadow', name: 'Drowning Wave' });
          addEffect(g, u, { id: 'slow', name: 'Waterlogged', slow: 0.4, dur: 3, harmful: true, icon: 'icon_fx_slow' });
        }
        g.fx?.pillar(center, 5, 0x40e0ff);
      });
    }
  }

  respawn() {
    this.resetStats();
    this.removed = false;
    this.corpseT = 0;
    this.respawnT = 0;
    this.loot = null;
    this.state = 'idle';
    this.phase = 0;
    this.fled = false;
    this.visual.setVisible(true);
    this.visual.play('revive');
    this.setPosition(this.spawn.x, this.spawn.z);
  }
}
