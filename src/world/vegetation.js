// Scatters vegetation and rocks across the island using chunked InstancedMeshes
// (frustum- and distance-culled per chunk). Plants sway in the wind.
import * as THREE from 'three';
import { registry } from '../assets/registry.js';
import { Rng, smoothstep } from '../core/noise.js';
import { BUILDINGS, ROADS, SPAWNS, ZONES, TOR, HERBS, STRAND } from './layout.js';

const CHUNK = 90;
const swayTime = { value: 0 };
const swayCache = new Map();

function swayMaterial(mat, strength) {
  const key = `${mat.uuid}:${strength}`;
  let m = swayCache.get(key);
  if (m) return m;
  m = mat.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = swayTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iw = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = uSwayTime * 1.6 + iw.x * 0.21 + iw.z * 0.17;
          float hgt = max(0.0, transformed.y);
          float amt = ${strength.toFixed(3)} * hgt * 0.06;
          transformed.x += (sin(ph) + 0.4 * sin(ph * 2.3)) * amt;
          transformed.z += cos(ph * 0.8) * amt * 0.7;
        #endif`);
  };
  m.customProgramCacheKey = () => `sway:${strength}`;
  swayCache.set(key, m);
  return m;
}

// Types: slot, count, maxDistance, scale range, align to slope, collider radius, sway
const TYPES = {
  grass_tuft: { maxDist: 62, scale: [0.75, 1.35], sway: 1, noShadow: true, chunk: 24 },
  flowers: { maxDist: 70, scale: [0.8, 1.2], sway: 0.8, noShadow: true, chunk: 30 },
  fern: { maxDist: 130, scale: [0.8, 1.5], sway: 0.6 },
  reeds: { maxDist: 150, scale: [0.8, 1.3], sway: 1 },
  bush: { maxDist: 260, scale: [0.7, 1.4], sway: 0.25 },
  mushroom_small: { maxDist: 200, scale: [0.6, 1.4] },
  tree_mushroom_giant: { maxDist: 900, scale: [0.8, 1.35], collide: true },
  tree_mushroom_giant_b: { maxDist: 900, scale: [0.8, 1.3], collide: true },
  tree_swamp: { maxDist: 900, scale: [0.8, 1.3], collide: true, sway: 0.25 },
  tree_swamp_b: { maxDist: 900, scale: [0.8, 1.3], collide: true, sway: 0.25 },
  tree_dead: { maxDist: 700, scale: [0.8, 1.4], collide: true },
  rock_large: { maxDist: 900, scale: [0.7, 1.4], collide: true, randRot: true },
  rock_medium: { maxDist: 500, scale: [0.6, 1.5], collide: true, randRot: true },
  rock_small: { maxDist: 160, scale: [0.6, 1.6], randRot: true },
  driftwood: { maxDist: 220, scale: [0.8, 1.3] },
  kelp: { maxDist: 90, scale: [0.7, 1.2], sway: 0.8, noShadow: true, chunk: 30 },
  lilypads: { maxDist: 150, scale: [0.8, 1.4], noShadow: true, water: true },
};

export class Vegetation {
  constructor(world) {
    this.world = world;
    this.terrain = world.terrain;
    this.root = new THREE.Group();
    this.root.name = 'vegetation';
    this.instances = {}; // type -> [{x,y,z,rot,s}]
    this.chunks = []; // { type, mesh, center }
    this.density = 1;
    this.distScale = 1;
  }

  // Keep plants out of buildings, roads, camps and spawn clearings.
  blocked(x, z, r) {
    for (const b of BUILDINGS) {
      const rad = b.type === 'spire' ? 19 : b.type === 'tavern' || b.type === 'hall' ? 10 : b.type === 'cult_camp' ? 10 : 7;
      if (Math.hypot(x - b.x, z - b.z) < rad + r) return true;
    }
    if (x > 8 && x < 20 && z > 190) return true; // dock
    if (this.terrain.roadAt(x, z) > 0.25) return true;
    return false;
  }

  nearTree(x, z, r) {
    for (const t of ['tree_mushroom_giant', 'tree_mushroom_giant_b', 'tree_swamp', 'tree_swamp_b']) {
      for (const it of this.instances[t] || []) if (Math.abs(it.x - x) < r && Math.abs(it.z - z) < r && Math.hypot(it.x - x, it.z - z) < r) return true;
    }
    return false;
  }

  // Faster check for dense grass: only building footprints and the dock.
  blockedCheap(x, z) {
    if (x > 8 && x < 20 && z > 190) return true;
    for (const b of BUILDINGS) {
      const dx = x - b.x, dz = z - b.z;
      const rad = b.type === 'spire' ? 17 : b.type === 'tavern' || b.type === 'hall' ? 8.5 : 5;
      if (dx * dx + dz * dz < rad * rad) return true;
    }
    return false;
  }

  add(type, x, z, rng, y) {
    const t = TYPES[type];
    const s = rng.float(t.scale[0], t.scale[1]);
    const yy = y ?? this.terrain.heightAt(x, z) - 0.05;
    (this.instances[type] ||= []).push({ x, y: yy, z, rot: rng.float(0, Math.PI * 2), s, tilt: t.randRot ? rng.float(-0.3, 0.3) : 0 });
    if (t.collide) {
      const ph = registry.placeholder(type).root.userData;
      const r = (ph.collider ? ph.collider.r : 0.5) * s;
      this.world.collision.add({ type: 'circle', x, z, r, y0: yy - 2, y1: yy + (type.startsWith('rock') ? r * 1.2 : 30), tree: true });
    }
  }

  build() {
    const T = this.terrain;
    const rng = new Rng(9001);
    const village = ZONES.find((z) => z.id === 'brackwater');
    const wood = ZONES.find((z) => z.id === 'wood');
    const spawnClear = SPAWNS.filter((s) => s.type === 'morwen' || s.type === 'grubgut');
    const tryPlace = (n, fn) => {
      for (let i = 0; i < n; i++) {
        const x = rng.float(-330, 330), z = rng.float(-330, 330);
        const h = T.heightAt(x, z);
        if (h < -2) continue;
        fn(x, z, h);
      }
    };
    const inVillage = (x, z) => Math.hypot(x - village.x, z - village.z) < village.r;
    const inWood = (x, z) => smoothstep(wood.r + 25, wood.r * 0.5, Math.hypot(x - wood.x, z - wood.z));
    const torD = (x, z) => Math.hypot(x - TOR.x, z - TOR.z);
    // Matches the terrain shader's sand band on the wide eastern beach.
    const strandSand = (x, z, h) => Math.hypot(x - STRAND.x, z - STRAND.z) < STRAND.radius * 0.85 && h < 4.2;

    // Trees and large features first (they register colliders).
    tryPlace(40000, (x, z, h) => {
      if (h < 0.6) return;
      const slope = T.slopeAt(x, z);
      const marsh = T.marshAt(x, z);
      const w = inWood(x, z);
      if (this.blocked(x, z, 3) || inVillage(x, z) || spawnClear.some((s) => Math.hypot(x - s.x, z - s.z) < 14)) return;
      if (slope > 0.22) {
        if (rng.chance(0.012)) this.add('rock_large', x, z, rng);
        else if (rng.chance(0.02)) this.add('rock_medium', x, z, rng);
        return;
      }
      const tooClose = (r) => this.nearTree(x, z, r);
      if (w > 0.3 && rng.chance(0.03 * w)) {
        if (!tooClose(7)) this.add(rng.chance(0.55) ? 'tree_mushroom_giant' : 'tree_mushroom_giant_b', x, z, rng);
      } else if (marsh > 0.3 && h > 0.25 && rng.chance(0.05 * marsh)) {
        if (!tooClose(5.5)) this.add(rng.chance(0.5) ? 'tree_swamp' : 'tree_swamp_b', x, z, rng);
      } else if (torD(x, z) < TOR.radius * 1.3 && h > 8 && rng.chance(0.006)) this.add('tree_dead', x, z, rng);
      else if (marsh < 0.3 && w < 0.3 && h > 2 && rng.chance(0.006)) {
        if (!tooClose(9)) this.add(rng.chance(0.6) ? 'tree_swamp_b' : 'tree_mushroom_giant_b', x, z, rng);
      } else if (rng.chance(0.0012)) this.add('rock_large', x, z, rng);
      else if (rng.chance(0.004)) this.add('rock_medium', x, z, rng);
      else if (rng.chance(0.004) && h > 2) this.add('bush', x, z, rng);
    });
    // A few framing trees inside the village, kept clear of streets.
    for (const [x, z] of [[-48, 158], [62, 140], [-28, 196], [44, 196], [-40, 112], [72, 158]]) {
      if (!this.blocked(x, z, 2)) this.add('tree_mushroom_giant_b', x, z, rng);
    }

    // Undergrowth.
    const d = this.density;
    tryPlace(Math.floor(90000 * d), (x, z, h) => {
      if (h < 0.15) {
        if (h > -0.9 && T.marshAt(x, z) > 0.3 && rng.chance(0.05)) this.add('lilypads', x, z, rng, 0.03);
        else if (h > -0.4 && T.marshAt(x, z) < 0.2 && rng.chance(0.03)) this.add('kelp', x, z, rng);
        return;
      }
      if (this.blocked(x, z, 0.8)) return;
      const slope = T.slopeAt(x, z);
      if (slope > 0.3) return;
      const marsh = T.marshAt(x, z);
      const w = inWood(x, z);
      const sandy = h < 1.6 || strandSand(x, z, h);
      const ash = torD(x, z) < TOR.radius * 1.1 && h > 14;
      const vil = inVillage(x, z);
      const r = rng.next();
      if (sandy) {
        if (marsh > 0.3 && r < 0.12) this.add('reeds', x, z, rng);
        else if (r < 0.004) this.add('driftwood', x, z, rng);
        else if (r < 0.012) this.add('rock_small', x, z, rng);
        return;
      }
      if (ash) {
        if (r < 0.02) this.add('rock_small', x, z, rng);
        return;
      }
      if (marsh > 0.3) {
        if (r < 0.2 * marsh) this.add('reeds', x, z, rng);
        else if (r < 0.28) this.add('fern', x, z, rng);
        else if (r < 0.31) this.add('mushroom_small', x, z, rng);
        else if (r < 0.33) this.add('bush', x, z, rng, undefined, 0x4a5a2a);
        return;
      }
      if (w > 0.3) {
        if (r < 0.1) this.add('fern', x, z, rng);
        else if (r < 0.14) this.add('mushroom_small', x, z, rng);
        else if (r < 0.165) this.add('bush', x, z, rng);
        else if (r < 0.18) this.add('flowers', x, z, rng);
        return;
      }
      if (vil) {
        if (r < 0.02) this.add('flowers', x, z, rng);
        return;
      }
      if (r < 0.04) this.add('flowers', x, z, rng);
      else if (r < 0.055) this.add('bush', x, z, rng);
      else if (r < 0.075) this.add('fern', x, z, rng);
      else if (r < 0.081) this.add('rock_small', x, z, rng);
    });
    // Dense grass on a jittered grid.
    const gs = 1.55 / Math.sqrt(Math.max(0.2, d));
    for (let gx = -330; gx < 330; gx += gs) {
      for (let gz = -330; gz < 330; gz += gs) {
        const x = gx + rng.float(-gs * 0.5, gs * 0.5), z = gz + rng.float(-gs * 0.5, gs * 0.5);
        const h = T.heightAt(x, z);
        if (h < 1.1) continue;
        const road = T.roadAt(x, z);
        if (road > 0.45) continue;
        const marsh = T.marshAt(x, z);
        const ash = torD(x, z) < TOR.radius * 1.1 && h > 14;
        let p = 0.62 - road;
        if (marsh > 0.3) p = 0.3;
        if (ash) p = 0.12;
        if (T.slopeAt(x, z) > 0.3) p *= 0.3;
        if (inVillage(x, z)) p *= 0.6;
        if (h < 1.8) p *= 0.4;
        if (strandSand(x, z, h)) p *= 0.12;
        if (!rng.chance(p)) continue;
        if (this.blockedCheap(x, z)) continue;
        this.add('grass_tuft', x, z, rng);
      }
    }
    // Reeds around herb spots so they read as marsh.
    for (const [x, z] of HERBS) for (let i = 0; i < 3; i++) {
      const a = rng.float(0, 6.28), r = rng.float(1.5, 3);
      this.add('reeds', x + Math.cos(a) * r, z + Math.sin(a) * r, rng);
    }
    for (const type of Object.keys(this.instances)) this.buildType(type);
  }

  buildType(type) {
    for (const c of this.chunks.filter((c) => c.type === type)) c.mesh.removeFromParent();
    this.chunks = this.chunks.filter((c) => c.type !== type);
    const list = this.instances[type];
    if (!list || !list.length) return;
    const def = TYPES[type];
    const tmpl = registry.model(type).root;
    tmpl.updateMatrixWorld(true);
    const parts = [];
    tmpl.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld.clone().premultiply(new THREE.Matrix4().copy(tmpl.matrixWorld).invert()));
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const mat = def.sway ? (Array.isArray(o.material) ? mats.map((m) => swayMaterial(m, def.sway)) : swayMaterial(o.material, def.sway)) : o.material;
      parts.push({ geo, mat, noShadow: o.userData.noShadow || def.noShadow });
    });
    // Bucket instances into chunks.
    const buckets = new Map();
    const csz = def.chunk || CHUNK;
    for (const it of list) {
      const k = `${Math.floor(it.x / csz)},${Math.floor(it.z / csz)}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(it);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const [, items] of buckets) {
      const center = new THREE.Vector3();
      for (const it of items) center.add(p.set(it.x, it.y, it.z));
      center.divideScalar(items.length);
      for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geo, part.mat, items.length);
        items.forEach((it, i) => {
          e.set(it.tilt, it.rot, it.tilt * 0.5);
          q.setFromEuler(e);
          m.compose(p.set(it.x, it.y, it.z), q, s.set(it.s, it.s, it.s));
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = !part.noShadow;
        mesh.receiveShadow = true;
        mesh.name = `veg_${type}`;
        this.root.add(mesh);
        this.chunks.push({ type, mesh, center, maxDist: def.maxDist, size: csz });
      }
    }
  }

  onAssetChanged(id) {
    for (const type of Object.keys(this.instances)) {
      if (this.world.slotDependsOn(type, id)) this.buildType(type);
    }
  }

  update(elapsed, camPos) {
    swayTime.value = elapsed;
    if (!camPos) return;
    for (const c of this.chunks) {
      const dx = c.center.x - camPos.x, dz = c.center.z - camPos.z;
      c.mesh.visible = dx * dx + dz * dz < (c.maxDist * this.distScale + c.size * 0.7) ** 2;
    }
  }
}
