// The player character: input-driven movement on top of Unit, camera-relative controls.
import { Unit } from './unit.js';
import { buildHumanoid, playerLook } from '../assets/placeholders/characters.js';

export class Player extends Unit {
  constructor(game, char) {
    const race = char.race || 'westerling';
    super(game, {
      slot: `char_player_${race}`,
      name: char.name || 'Stranger',
      faction: 'player',
      visualOpts: { buildPlaceholder: () => buildHumanoid(playerLook(char)) },
    });
    this.char = char;
    this.isPlayer = true;
    this.autorun = false;
    this.walkMode = false;
    this.sprinting = false;
    this.moveSpeed = 6.4;
    this.jumpV = 7.4;
    this.fallImmune = 0;
  }

  // Combat stat hooks used by game/combat.js
  get sheet() { return this.game.sheet; }
  displayName() { return 'You'; }
  getArmor() { return this.sheet.armor; }
  getCrit() { return this.sheet.crit; }
  getDodge() { return this.sheet.dodge; }
  getSpellPower() { return this.sheet.spellPower; }
  rollWeapon() { return this.sheet.weaponRoll(); }
  inCombat() { return this.game.playerInCombat; }
  get level() { return this.game.sheet ? this.game.sheet.level : 1; }
  set level(v) { /* derived from the character sheet */ }

  rebuildLook(char) {
    this.char = char;
    this.visual.opts.buildPlaceholder = () => buildHumanoid(playerLook(char));
    this.visual.rebuild();
  }

  // Called by the game each frame with resolved input.
  control(dt, input, rig, canAct) {
    let fwd = 0, side = 0;
    if (canAct) {
      if (input.down('forward')) fwd += 1;
      if (input.down('back')) fwd -= 1;
      if (input.down('left')) side += 1;
      if (input.down('right')) side -= 1;
      if (input.mouseDown(0) && input.mouseDown(2)) fwd = 1;
      if (input.hit('autorun')) this.autorun = !this.autorun;
      if (input.hit('walk')) this.walkMode = !this.walkMode;
      if (input.down('back')) this.autorun = false;
      if (this.autorun && fwd === 0) fwd = 1;
    }
    const moving = fwd !== 0 || side !== 0;
    const steering = input.mouseDown(2) || input.pointerLocked || rig.firstPerson;
    if (moving || steering) {
      // Character faces where the camera looks (strafing with A/D).
      let dy = rig.yaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * (moving ? 14 : 20));
    }
    let wx = 0, wz = 0;
    if (moving) {
      const sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
      wx = sy * fwd + cy * side;
      wz = cy * fwd - sy * side;
      const l = Math.hypot(wx, wz);
      wx /= l; wz /= l;
    }
    this.backward = fwd < 0 && side === 0;
    let speed = this.walkMode ? 2.6 : this.moveSpeed;
    if (this.backward) speed *= 0.55;
    this.sprinting = false;
    if (canAct && input.down('sprint') && moving && !this.backward && this.st > 1 && !this.swimming) {
      speed *= 1.45;
      this.sprinting = true;
    }
    if (this.swimming) speed = 3.6 * (this.swimBonus || 1);
    speed *= this.speedMult ? this.speedMult() : 1;
    const jump = canAct && input.hit('jump');
    this.move(dt, wx, wz, speed, jump, this.jumpV * (this.jumpMult || 1));
    return { moving, sprinting: this.sprinting };
  }
}
