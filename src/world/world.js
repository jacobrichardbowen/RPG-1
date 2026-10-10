// Builds the island: terrain, sea, sky, buildings, props, vegetation and light anchors.
// Every model is placed through the asset registry, so overriding a slot swaps it live.
import * as THREE from 'three';
import { registry } from '../assets/registry.js';
import { BUILDING_SLOTS } from '../assets/slots.js';
import { Terrain, createTerrainMaterial } from './terrain.js';
import { createWater } from './water.js';
import { Sky } from './sky.js';
import { CollisionWorld } from './collision.js';
import { Vegetation } from './vegetation.js';
import { BUILDINGS, DOCK, SHIP, PROPS, ZONES } from './layout.js';
import { texMat } from '../assets/placeholders/geo.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.placed = []; // { slot, wrapper, opts }
    this.spots = {};
    this.buildingsById = {};
    this.lightAnchors = [];
    this.flames = [];
    this.animated = [];
  }

  build(progress = () => {}) {
    progress('Raising the island');
    this.terrain = new Terrain(1337);
    this.collision = new CollisionWorld(this.terrain);
    progress('Painting the land');
    const textures = {};
    for (const k of ['grass', 'sand', 'rock', 'mud', 'ash', 'path']) textures[k] = registry.texture(`tex_${k}`);
    this.terrainMat = createTerrainMaterial(textures);
    this.terrainMeshes = this.terrain.buildMeshes(this.terrainMat);
    this.root.add(this.terrainMeshes);

    progress('Filling the sea');
    this.sky = new Sky(this.scene);
    this.water = createWater(registry.texture('tex_water_normal'), this.terrain.heightTexture(), this.sky);
    this.scene.add(this.water);

    progress('Building Brackwater');
    for (const b of BUILDINGS) this.placeBuilding(b);
    this.placeBuilding({ id: 'ship', type: 'ship', x: SHIP.x, z: SHIP.z, rot: SHIP.rot, y: 0, bob: true });
    this.buildDock();
    for (const [slot, x, z, rot, opts = {}] of PROPS) {
      let y;
      if (opts.water) y = 0.05;
      else y = this.collision.groundAt(x, z, 50, 0);
      if (opts.stack) y += opts.stack;
      this.placeProp(slot, x, y, z, rot, { collide: !opts.water, ...opts });
    }

    progress('Growing the wilds');
    this.vegetation = new Vegetation(this);
    this.vegetation.build();
    this.root.add(this.vegetation.root);

    registry.onChange((id) => this.onAssetChanged(id));
  }

  // ------------------------------------------------------------------ placement
  slotDependsOn(slot, changed) {
    let cur = slot;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      if (cur === changed) return true;
      seen.add(cur);
      const s = registry.slot(cur);
      cur = s && s.fallback;
    }
    return false;
  }

  makeInstance(slot, opts = {}) {
    const inst = registry.instance(slot);
    const obj = inst.root;
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = opts.castShadow !== false && !o.userData.noShadow;
        o.receiveShadow = true;
      }
      if (o.name === 'flame') this.flames.push(o);
    });
    return obj;
  }

  place(slot, x, y, z, rot = 0, opts = {}) {
    const wrapper = new THREE.Group();
    wrapper.position.set(x, y, z);
    wrapper.rotation.y = rot;
    if (opts.scale) wrapper.scale.setScalar(opts.scale);
    wrapper.add(this.makeInstance(slot, opts));
    wrapper.name = `${slot}@${x.toFixed(0)},${z.toFixed(0)}`;
    (opts.parent || this.root).add(wrapper);
    const rec = { slot, wrapper, opts };
    this.placed.push(rec);
    return rec;
  }

  placeProp(slot, x, y, z, rot = 0, opts = {}) {
    const rec = this.place(slot, x, y, z, rot, opts);
    const ph = registry.placeholder(slot).root.userData;
    const s = opts.scale || 1;
    if (opts.collide !== false && ph.collider) {
      const c = ph.collider;
      if (c.r) this.collision.add({ type: 'circle', x, z, r: c.r * s, y0: y - 1, y1: y + (c.h || 3) * s, prop: true });
      else if (c.box) this.collision.add({ type: 'box', x, z, hx: c.box[0] * s, hz: c.box[1] * s, rot, y0: y - 1, y1: y + (c.h || 1) * s, walk: c.h <= 1.1, prop: true });
    }
    if (ph.light) this.addLightAnchor(ph.light, x, y, z, rot, opts.interior);
    return rec;
  }

  addLightAnchor(l, x, y, z, rot, interior) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    this.lightAnchors.push({
      x: x + l.x * cs + l.z * sn, y: y + l.y, z: z - l.x * sn + l.z * cs,
      color: new THREE.Color(l.color), intensity: l.intensity, distance: l.distance,
      flicker: !!l.flicker, interior: !!(l.interior || interior), beacon: !!l.beacon, phase: Math.random() * 10,
    });
  }

  placeBuilding(b) {
    const slot = BUILDING_SLOTS[b.type];
    const ph = registry.placeholder(slot).root.userData;
    const y = b.y ?? this.terrain.heightAt(b.x, b.z);
    const rec = this.place(slot, b.x, y, b.z, b.rot);
    rec.building = b;
    this.buildingsById[b.id] = { ...b, y, rec };
    if (b.bob) this.animated.push({ obj: rec.wrapper, type: 'bob', baseY: y });
    const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
    const toWorld = (lx, lz) => [b.x + lx * cs + lz * sn, b.z - lx * sn + lz * cs];
    for (const c of ph.colliders || []) {
      const wc = this.collision.addLocal(c, b.x, y, b.z, b.rot);
      wc.building = b.id;
    }
    const floorY = ph.interior ? ph.interior.y : 0;
    for (const p of ph.props || []) {
      const [wx, wz] = toWorld(p.x, p.z);
      this.placeProp(p.slot, wx, y + floorY + (p.y || 0), wz, b.rot + p.rot, { interior: true });
    }
    for (const l of ph.lights || []) this.addLightAnchor(l, b.x, y, b.z, b.rot);
    this.spots[b.id] = {};
    for (const [name, s] of Object.entries(ph.spots || {})) {
      const [wx, wz] = toWorld(s.x, s.z);
      this.spots[b.id][name] = { x: wx, z: wz, rot: b.rot + (s.rot || 0), y: s.y !== undefined ? y + s.y : null, sit: s.sit, floorY: y + floorY };
    }
    if (ph.interior) {
      this.buildingsById[b.id].interior = { ...ph.interior, cx: b.x, cz: b.z, rot: b.rot, y: y + ph.interior.y };
    }
  }

  buildDock() {
    const { x, width, deckY } = DOCK;
    // The dock starts where the shore drops below the deck.
    let z0 = DOCK.z0;
    for (let z = 185; z < 230; z += 0.5) {
      if (this.terrain.heightAt(x, z) < deckY + 0.6) { z0 = z - 1.5; break; }
    }
    const z1 = DOCK.z1;
    const g = new THREE.Group();
    const planks = texMat('planks', { color: 0xb09878 });
    const beams = texMat('woodDark');
    const len = z1 - z0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, len), planks);
    scaleUV(deck.geometry, width, 0.22, len, 2.4);
    deck.position.set(x, deckY - 0.11, (z0 + z1) / 2);
    g.add(deck);
    this.collision.add({ type: 'box', x, z: (z0 + z1) / 2, hx: width / 2, hz: len / 2, rot: 0, y0: deckY - 0.4, y1: deckY, walk: true });
    const addPost = (px, pz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, deckY + 6, 8), beams);
      post.position.set(px, (deckY - 6) / 2 + 0.3, pz);
      g.add(post);
      this.collision.add({ type: 'circle', x: px, z: pz, r: 0.2, y0: -8, y1: deckY - 0.3 });
    };
    for (let z = z0 + 1; z <= z1; z += 3) { addPost(x - width / 2 + 0.1, z); addPost(x + width / 2 - 0.1, z); }
    for (const p of DOCK.piers) {
      const px = x + p.side * (width / 2 + p.len / 2);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(p.len, 0.22, 2.6), planks);
      scaleUV(pier.geometry, p.len, 0.22, 2.6, 2.4);
      pier.position.set(px, deckY - 0.11, p.z);
      g.add(pier);
      this.collision.add({ type: 'box', x: px, z: p.z, hx: p.len / 2, hz: 1.3, rot: 0, y0: deckY - 0.4, y1: deckY, walk: true });
      for (let i = 1; i <= Math.floor(p.len / 3); i++) {
        addPost(x + p.side * (width / 2 + i * 3), p.z - 1.2);
        addPost(x + p.side * (width / 2 + i * 3), p.z + 1.2);
      }
    }
    // Low rails along the far end.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.12), beams);
    rail.position.set(x, deckY + 0.9, z1 - 0.1);
    g.add(rail);
    this.collision.add({ type: 'box', x, z: z1 - 0.1, hx: width / 2, hz: 0.15, rot: 0, y0: deckY, y1: deckY + 1 });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(g);
    this.dock = { z0, z1 };
  }

  onAssetChanged(id) {
    for (const rec of this.placed) {
      if (!this.slotDependsOn(rec.slot, id)) continue;
      for (const c of [...rec.wrapper.children]) {
        rec.wrapper.remove(c);
      }
      this.flames = this.flames.filter((f) => f.parent);
      rec.wrapper.add(this.makeInstance(rec.slot, rec.opts));
    }
    this.vegetation.onAssetChanged(id);
  }

  zoneAt(x, z) {
    let best = null, bestR = Infinity;
    for (const zn of ZONES) {
      const d = Math.hypot(x - zn.x, z - zn.z);
      if (d < zn.r && zn.r < bestR) { best = zn; bestR = zn.r; }
    }
    return best;
  }

  update(dt, elapsed, hour, focus, camPos) {
    this.sky.update(dt, hour, focus, elapsed);
    this.water.userData.update(elapsed, camPos);
    this.vegetation.update(elapsed, camPos);
    for (const f of this.flames) {
      const s = 0.85 + Math.sin(elapsed * 13 + f.id) * 0.08 + Math.sin(elapsed * 23 + f.id * 2) * 0.06;
      f.scale.set(s, 0.9 + (1 - s) * 2 + Math.sin(elapsed * 17 + f.id) * 0.1, s);
    }
    for (const a of this.animated) {
      if (a.type === 'bob') {
        a.obj.position.y = a.baseY + Math.sin(elapsed * 0.7) * 0.06;
        a.obj.rotation.z = Math.sin(elapsed * 0.5) * 0.01;
      }
    }
  }
}

function scaleUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
}
