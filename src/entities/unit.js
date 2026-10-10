// Base class for anything that walks around: the player, NPCs and creatures.
import * as THREE from 'three';
import { Visual } from './visual.js';

let NEXT_ID = 1;
export const GRAVITY = 22;
export const SWIM_FEET = -1.3; // feet height while swimming (sea level is 0)

export class Unit {
  constructor(game, { slot, name = '', level = 1, faction = 'neutral', radius = 0.4, height = 1.8, visualOpts = {} }) {
    this.game = game;
    this.id = NEXT_ID++;
    this.name = name;
    this.level = level;
    this.faction = faction;
    this.radius = radius;
    this.height = height;
    this.group = new THREE.Group();
    this.group.name = `unit:${name}`;
    this.visual = new Visual(slot, visualOpts);
    this.group.add(this.visual.group);
    game.scene.add(this.group);
    this.pos = this.group.position;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.swimming = false;
    this.airTime = 0;
    this.speedNow = 0;
    this.backward = false;
    this.alive = true;
    this.hp = this.maxHp = 100;
    this.mana = this.maxMana = 0;
    this.st = this.maxSt = 100;
    this.effects = [];
    this.cooldowns = {};
    this.gcd = 0;
    this.cast = null;
    this.target = null;
    this.sitting = false;
    this.lastFallSpeed = 0;
    this.stepUp = 0.5;
    this.hidden = false;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  distTo(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }
  dist3(u) { return this.pos.distanceTo(u.pos); }
  edgeDist(u) { return Math.max(0, this.distTo(u) - this.radius - u.radius); }
  angleTo(u) { return Math.atan2(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }

  facePoint(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }
  faceUnit(u) { this.facePoint(u.pos.x, u.pos.z); }

  setPosition(x, z, y) {
    const col = this.game.world.collision;
    this.pos.set(x, y ?? col.groundAt(x, z, 200, 0), z);
    this.vel.set(0, 0, 0);
    this.grounded = true;
  }

  // Shared movement with gravity, stepping, sliding along walls, swimming and fall damage.
  move(dt, wishX, wishZ, speed, jump = false, jumpV = 7.2) {
    const col = this.game.world.collision;
    const accel = this.grounded || this.swimming ? 16 : 2.5;
    const k = Math.min(1, accel * dt);
    this.vel.x += (wishX * speed - this.vel.x) * k;
    this.vel.z += (wishZ * speed - this.vel.z) * k;
    let feet = this.pos.y;
    if (this.swimming) {
      this.vel.y += ((SWIM_FEET - feet) * 6 - this.vel.y) * Math.min(1, dt * 5);
    } else {
      this.vel.y -= GRAVITY * dt;
      if (jump && this.grounded) {
        this.vel.y = jumpV;
        this.grounded = false;
        this.jumped = true;
      }
    }
    const next = { x: this.pos.x + this.vel.x * dt, z: this.pos.z + this.vel.z * dt };
    // Refuse to climb very steep terrain.
    const tn = this.game.world.terrain.normalAt(next.x, next.z, _n);
    if (tn.y < 0.62 && !this.swimming) {
      const uphill = -(tn.x * this.vel.x + tn.z * this.vel.z);
      if (uphill > 0) {
        next.x = this.pos.x + (this.vel.x + tn.x * uphill * 1.2) * dt;
        next.z = this.pos.z + (this.vel.z + tn.z * uphill * 1.2) * dt;
      }
    }
    col.resolve(next, feet, this.radius, this.height, this.stepUp);
    feet += this.vel.y * dt;
    const ground = col.groundAt(next.x, next.z, Math.max(feet, this.pos.y), this.stepUp, this.radius);
    const wasGrounded = this.grounded;
    if (feet <= ground) {
      if (!wasGrounded && this.vel.y < 0) this.lastFallSpeed = -this.vel.y;
      feet = ground;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    } else if (wasGrounded && this.vel.y <= 0 && feet - ground < 0.65) {
      feet = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    // Water: float when the sea floor is deep enough.
    const deep = ground < SWIM_FEET - 0.05;
    if (deep && feet <= SWIM_FEET + 0.1) {
      if (!this.swimming) this.lastFallSpeed = 0;
      this.swimming = true;
      this.grounded = false;
      if (feet < SWIM_FEET - 0.6) feet = SWIM_FEET - 0.6;
    } else if (this.swimming && (!deep || feet > SWIM_FEET + 0.6)) {
      this.swimming = false;
    }
    this.pos.set(next.x, feet, next.z);
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.airTime = this.grounded || this.swimming ? 0 : this.airTime + dt;
  }

  inWater() { return this.pos.y < -0.3; }

  updateVisual(dt) {
    this.group.rotation.y = this.yaw;
    this.visual.update(dt, {
      speed: this.speedNow,
      airborne: this.airTime > 0.15 && !this.swimming,
      swim: this.swimming,
      sit: this.sitting,
      dead: !this.alive,
      backward: this.backward,
    });
  }

  dispose() {
    this.visual.dispose();
    this.group.removeFromParent();
  }
}

const _n = new THREE.Vector3();
