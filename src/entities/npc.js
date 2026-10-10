// Friendly NPCs: stand, patrol or wander; face the player when spoken to; show quest markers.
import * as THREE from 'three';
import { Unit } from './unit.js';

const markerTex = {};
function markerTexture(kind) {
  if (markerTex[kind]) return markerTex[kind];
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const gold = kind.endsWith('gray') ? '#9a9a9a' : '#ffd100';
  ctx.font = 'bold 104px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#2a1a00';
  const ch = kind.startsWith('q') ? '?' : '!';
  ctx.strokeText(ch, 32, 66);
  ctx.fillStyle = gold;
  ctx.fillText(ch, 32, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  markerTex[kind] = t;
  return t;
}

export class Npc extends Unit {
  constructor(game, def, spot) {
    super(game, { slot: def.model, name: def.name, level: 5, faction: 'friendly', radius: 0.4, height: (def.look && def.look.height) || 1.8 });
    this.def = def;
    this.id = def.id;
    this.title = def.title || '';
    this.isNpc = true;
    this.home = { x: spot.x, z: spot.z, rot: spot.rot || 0, y: spot.y };
    this.sitting = !!spot.sit;
    this.patrol = def.patrol ? def.patrol.map(([x, z]) => ({ x, z })) : null;
    this.patrolI = 0;
    this.waitT = Math.random() * 3;
    this.talking = false;
    this.hp = this.maxHp = 500;
    this.setPosition(spot.x, spot.z, spot.y ?? undefined);
    if (spot.floorY !== undefined && spot.floorY !== null) this.pos.y = game.world.collision.groundAt(spot.x, spot.z, spot.floorY + 1, 1);
    this.yaw = this.home.rot;
    const mat = new THREE.SpriteMaterial({ map: markerTexture('!'), depthTest: true, transparent: true });
    this.marker = new THREE.Sprite(mat);
    this.marker.scale.set(0.45, 0.9, 1);
    this.marker.visible = false;
    this.markerKind = null;
    this.group.add(this.marker);
    if (this.sitting) this.pos.y -= 0.0;
    if (def.id === 'guard1' || def.id === 'guard2' || def.id === 'kell' || def.id === 'hessa') this.visual.attach('grip_r', 'wpn_sword');
    if (def.id === 'kell' || def.id === 'hessa' || def.id.startsWith('guard')) this.visual.attach('shield_l', 'wpn_shield');
    this.gestureT = 2 + Math.random() * 4;
  }

  displayName() { return this.name; }
  inCombat() { return false; }

  setMarker(kind) {
    if (kind === this.markerKind) return;
    this.markerKind = kind;
    if (!kind) { this.marker.visible = false; return; }
    this.marker.material.map = markerTexture(kind);
    this.marker.material.needsUpdate = true;
    this.marker.visible = true;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const dp = this.distTo(p);
    if (this.talking) {
      this.move(dt, 0, 0, 0);
      const target = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (!this.sitting) this.turnTo(target, dt * 6);
      this.gestureT -= dt;
      if (this.gestureT <= 0) {
        this.visual.play('talk', 1.6);
        this.gestureT = 2.5 + Math.random() * 3;
      }
    } else if (this.patrol) {
      const wp = this.patrol[this.patrolI];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.7) {
        this.move(dt, 0, 0, 0);
        this.waitT -= dt;
        if (this.waitT <= 0) { this.patrolI = (this.patrolI + 1) % this.patrol.length; this.waitT = 2 + Math.random() * 4; }
      } else if (dp < 2.2) {
        this.move(dt, 0, 0, 0); // step aside for the player
      } else {
        this.yaw = Math.atan2(dx, dz);
        this.move(dt, dx / d, dz / d, 1.7);
      }
    } else if (this.def.wander) {
      this.waitT -= dt;
      if (!this.wanderTo && this.waitT <= 0) {
        const a = Math.random() * 6.28, r = Math.random() * this.def.wander;
        this.wanderTo = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
      }
      if (this.wanderTo) {
        const dx = this.wanderTo.x - this.pos.x, dz = this.wanderTo.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { this.wanderTo = null; this.waitT = 3 + Math.random() * 6; this.move(dt, 0, 0, 0); }
        else { this.yaw = Math.atan2(dx, dz); this.move(dt, dx / d, dz / d, 1.4); }
      } else this.move(dt, 0, 0, 0);
    } else {
      if (!this.sitting) this.move(dt, 0, 0, 0);
      // Glance at the player when they come close.
      const want = dp < 5 && !this.sitting ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : this.home.rot;
      this.turnTo(want, dt * 3);
    }
    if (this.sitting && !this.talking) this.yaw = this.home.rot;
    this.marker.position.y = this.visual.height + 0.55 + Math.sin(g.elapsed * 2.4) * 0.06;
  }

  turnTo(target, k) {
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, k);
  }
}
