// Procedural buildings. Each builder returns a Group whose userData carries:
//   colliders: collision volumes in local space (see world/collision.js)
//   lights:    light anchors { x, y, z, color, intensity, distance }
//   spots:     named NPC/prop anchors { x, z, rot, y? }
//   props:     furniture to place as separate swappable props { slot, x, z, rot, y? }
// Buildings face +Z (their door side) and sit with their floor origin at y = 0.
import * as THREE from 'three';
import { texMat, colorMat, glowMat, box, cyl, cone, sphere, gableTriangle, bake } from './geo.js';
import { mulberry32 } from '../../core/noise.js';

const T = 0.25; // wall thickness

function wallCollider(c, x, z, hx, hz, h, rot = 0) {
  c.push({ type: 'box', x, z, hx, hz, rot, y0: -2, y1: h });
}

// A wall along X (front/back) or Z (sides) with optional door gap. Adds meshes + colliders.
function wallX(g, c, { x0, x1, z, y0, h, mat, door = null, doorH = 2.4, collide = true }) {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  if (!door) {
    g.add(box(len, h, T, mat, { x: cx, y: y0 + h / 2, z }));
    if (collide) wallCollider(c, cx, z, len / 2, T / 2 + 0.05, y0 + h + 3);
    return;
  }
  const dl = door.x - door.w / 2, dr = door.x + door.w / 2;
  if (dl > x0) {
    g.add(box(dl - x0, h, T, mat, { x: (x0 + dl) / 2, y: y0 + h / 2, z }));
    if (collide) wallCollider(c, (x0 + dl) / 2, z, (dl - x0) / 2, T / 2 + 0.05, y0 + h + 3);
  }
  if (x1 > dr) {
    g.add(box(x1 - dr, h, T, mat, { x: (dr + x1) / 2, y: y0 + h / 2, z }));
    if (collide) wallCollider(c, (dr + x1) / 2, z, (x1 - dr) / 2, T / 2 + 0.05, y0 + h + 3);
  }
  g.add(box(door.w, h - doorH, T, mat, { x: door.x, y: y0 + doorH + (h - doorH) / 2, z }));
  if (collide) c.push({ type: 'box', x: door.x, z, hx: door.w / 2, hz: T / 2 + 0.05, rot: 0, y0: y0 + doorH, y1: y0 + h + 3 });
}

function wallZ(g, c, { z0, z1, x, y0, h, mat, door = null, doorH = 2.4, collide = true }) {
  const len = z1 - z0;
  const cz = (z0 + z1) / 2;
  if (!door) {
    g.add(box(T, h, len, mat, { x, y: y0 + h / 2, z: cz }));
    if (collide) wallCollider(c, x, cz, T / 2 + 0.05, len / 2, y0 + h + 3);
    return;
  }
  const dl = door.z - door.w / 2, dr = door.z + door.w / 2;
  if (dl > z0) { g.add(box(T, h, dl - z0, mat, { x, y: y0 + h / 2, z: (z0 + dl) / 2 })); if (collide) wallCollider(c, x, (z0 + dl) / 2, T / 2 + 0.05, (dl - z0) / 2, y0 + h + 3); }
  if (z1 > dr) { g.add(box(T, h, z1 - dr, mat, { x, y: y0 + h / 2, z: (dr + z1) / 2 })); if (collide) wallCollider(c, x, (dr + z1) / 2, T / 2 + 0.05, (z1 - dr) / 2, y0 + h + 3); }
  g.add(box(T, h - doorH, door.w, mat, { x, y: y0 + doorH + (h - doorH) / 2, z: door.z }));
}

// Dark timber framing over a rectangular wall section.
function timberFrame(g, { w, d, y0, h, beam }) {
  const b = 0.16, o = T / 2 + 0.03;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(b, h, b, beam, { x: sx * (w / 2 + 0.02), y: y0 + h / 2, z: sz * (d / 2 + 0.02) }));
  for (const y of [y0 + 0.08, y0 + h - 0.08, y0 + h * 0.45]) {
    g.add(box(w + 0.1, b, 0.06, beam, { y, z: d / 2 + o }));
    g.add(box(w + 0.1, b, 0.06, beam, { y, z: -d / 2 - o }));
    g.add(box(0.06, b, d + 0.1, beam, { x: w / 2 + o, y }));
    g.add(box(0.06, b, d + 0.1, beam, { x: -w / 2 - o, y }));
  }
  // Diagonal braces on the side walls.
  for (const sx of [-1, 1]) {
    const len = Math.hypot(d / 2, h * 0.55);
    g.add(box(0.06, len, 0.12, beam, { x: sx * (w / 2 + o), y: y0 + h * 0.45 + h * 0.27, z: d / 4, rx: Math.atan2(d / 2, h * 0.55) }));
    g.add(box(0.06, len, 0.12, beam, { x: sx * (w / 2 + o), y: y0 + h * 0.45 + h * 0.27, z: -d / 4, rx: -Math.atan2(d / 2, h * 0.55) }));
  }
}

function windowAt(g, { x, y, z, ry = 0, w = 0.9, h = 1.0, beam }) {
  const glass = glowMat(0xffc070, 2.0);
  const grp = new THREE.Group();
  grp.add(box(w, h, 0.06, glass, {}));
  grp.add(box(w + 0.16, 0.1, 0.12, beam, { y: h / 2 + 0.05 }));
  grp.add(box(w + 0.22, 0.1, 0.16, beam, { y: -h / 2 - 0.05 }));
  grp.add(box(0.07, h, 0.1, beam, {}));
  grp.add(box(w, 0.06, 0.1, beam, {}));
  for (const s of [-1, 1]) grp.add(box(0.08, h + 0.1, 0.1, beam, { x: s * (w / 2 + 0.04) }));
  grp.position.set(x, y, z);
  grp.rotation.y = ry;
  g.add(grp);
}

function gableRoof(g, { w, d, yTop, rise, over = 0.6, mat, endMat, ridgeMat }) {
  const halfSpan = d / 2 + over;
  const slope = Math.hypot(halfSpan, rise + over * (rise / (d / 2)));
  const ang = Math.atan2(rise, d / 2);
  const len = w + over * 2;
  const thick = 0.14;
  for (const s of [-1, 1]) {
    const slab = box(len, thick, slope, mat, { y: yTop + rise / 2 - over * Math.tan(ang) / 2 + 0.05, z: s * (d / 4 + over / 2 - 0.0), rx: s * ang });
    g.add(slab);
  }
  if (ridgeMat) g.add(box(len + 0.05, 0.2, 0.25, ridgeMat, { y: yTop + rise + 0.05 }));
  for (const sx of [-1, 1]) g.add(gableTriangle(d, rise, T, endMat, { x: sx * (w / 2), y: yTop, ry: Math.PI / 2 }));
}

function stepBlock(g, c, { x, z, w, d, h, mat }) {
  g.add(box(w, h, d, mat, { x, y: h / 2, z }));
  c.push({ type: 'box', x, z, hx: w / 2, hz: d / 2, rot: 0, y0: -2, y1: h, walk: true });
}

function floorSlab(g, c, { w, d, y, mat, foundMat }) {
  g.add(box(w, 0.12, d, mat, { y: y - 0.06 }));
  if (foundMat) g.add(box(w + 0.3, y + 1.6, d + 0.3, foundMat, { y: (y - 1.6) / 2 - 0.06 }));
  c.push({ type: 'box', x: 0, z: 0, hx: w / 2 + 0.15, hz: d / 2 + 0.15, rot: 0, y0: -3, y1: y, walk: true });
}

function finish(g, name) {
  const ud = { ...g.userData };
  const out = bake(g, name);
  Object.assign(out.userData, ud);
  return out;
}

// ---------------------------------------------------------------- house A (closed)
export function buildHouseA({ seed = 1 } = {}) {
  const g = new THREE.Group();
  const c = [];
  const w = 8, d = 6, fh = 0.5, h = 3.1;
  const plaster = texMat('plaster');
  const beam = texMat('woodDark');
  const stone = texMat('stone');
  floorSlab(g, c, { w, d, y: fh, mat: texMat('planks'), foundMat: stone });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: d / 2, y0: fh, h, mat: plaster, door: { x: 0, w: 1.3 } });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: -d / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: w / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: -w / 2, y0: fh, h, mat: plaster });
  timberFrame(g, { w, d, y0: fh, h, beam });
  // Closed door.
  g.add(box(1.3, 2.4, 0.1, texMat('planks', { color: 0x8a6a4a }), { y: fh + 1.2, z: d / 2 + 0.08 }));
  g.add(sphere(0.05, colorMat(0x8a7040, { metal: 0.7 }), { x: 0.45, y: fh + 1.15, z: d / 2 + 0.16 }));
  c.push({ type: 'box', x: 0, z: d / 2, hx: 0.65, hz: 0.2, rot: 0, y0: -2, y1: fh + 2.6 });
  for (const x of [-2.4, 2.4]) windowAt(g, { x, y: fh + 1.7, z: d / 2 + 0.16, beam });
  windowAt(g, { x: 1.5, y: fh + 1.7, z: -d / 2 - 0.16, ry: Math.PI, beam });
  windowAt(g, { x: w / 2 + 0.16, y: fh + 1.7, z: 0, ry: Math.PI / 2, beam });
  gableRoof(g, { w, d, yTop: fh + h, rise: 2.2, mat: texMat('roof'), endMat: plaster, ridgeMat: beam });
  stepBlock(g, c, { x: 0, z: d / 2 + 0.6, w: 1.8, d: 0.8, h: fh * 0.5, mat: stone });
  g.add(cyl(0.35, 0.4, 1.4, stone, { x: -2.5, y: fh + h + 1.6, z: -1, seg: 8 }));
  g.userData.colliders = c;
  g.userData.lights = [];
  return finish(g, 'house_a');
}

// ---------------------------------------------------------------- house B (stilted fisher hut, closed)
export function buildHouseB() {
  const g = new THREE.Group();
  const c = [];
  const w = 6, d = 5, fh = 1.3, h = 2.7;
  const planks = texMat('planks', { color: 0xb8a088 });
  const beam = texMat('woodDark');
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2 + 1.6], [-w / 2, d / 2 + 1.6], [w / 2, d / 2 + 1.6]]) {
    g.add(box(0.22, fh + 2, 0.22, beam, { x, y: fh / 2 - 1, z }));
  }
  g.add(box(w + 0.3, 0.15, d + 0.3, planks, { y: fh - 0.07 }));
  c.push({ type: 'box', x: 0, z: 0, hx: w / 2 + 0.15, hz: d / 2 + 0.15, rot: 0, y0: -3, y1: fh, walk: true });
  // Porch
  g.add(box(w + 0.3, 0.12, 1.6, planks, { y: fh - 0.06, z: d / 2 + 0.95 }));
  c.push({ type: 'box', x: 0, z: d / 2 + 0.95, hx: w / 2 + 0.15, hz: 0.8, rot: 0, y0: -3, y1: fh, walk: true });
  for (const x of [-w / 2, w / 2]) g.add(box(0.08, 0.9, 1.6, beam, { x, y: fh + 0.45, z: d / 2 + 0.95 }));
  // Steps down from the porch (ramp collider).
  for (let i = 0; i < 4; i++) g.add(box(1.4, 0.1, 0.4, planks, { x: 0, y: fh - (i + 1) * (fh / 4.5), z: d / 2 + 1.95 + i * 0.4 }));
  c.push({ type: 'ramp', x: 0, z: d / 2 + 2.55, hx: 0.85, hz: 0.75, rot: Math.PI / 2, y0: -3, h0: 0.15, h1: fh });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: d / 2, y0: fh, h, mat: planks, door: { x: 0, w: 1.2 } });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: -d / 2, y0: fh, h, mat: planks });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: w / 2, y0: fh, h, mat: planks });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: -w / 2, y0: fh, h, mat: planks });
  g.add(box(1.2, 2.3, 0.1, texMat('planks', { color: 0x7a5a40 }), { y: fh + 1.15, z: d / 2 + 0.08 }));
  c.push({ type: 'box', x: 0, z: d / 2, hx: 0.6, hz: 0.2, rot: 0, y0: fh - 0.1, y1: fh + 2.5 });
  windowAt(g, { x: 1.8, y: fh + 1.5, z: d / 2 + 0.16, w: 0.8, h: 0.8, beam });
  windowAt(g, { x: -w / 2 - 0.16, y: fh + 1.5, z: 0, ry: -Math.PI / 2, w: 0.8, h: 0.8, beam });
  gableRoof(g, { w, d, yTop: fh + h, rise: 1.9, mat: texMat('thatch'), endMat: planks, ridgeMat: beam });
  g.add(box(0.05, 0.05, 1.8, beam, { x: -1.6, y: fh + 2.1, z: d / 2 + 1.2 }));
  g.userData.colliders = c;
  g.userData.spots = { front: { x: 0, z: d / 2 + 3.6, rot: 0 } };
  return finish(g, 'house_b');
}

// ---------------------------------------------------------------- The Drowned Lantern (enterable)
export function buildTavern() {
  const g = new THREE.Group();
  const c = [];
  const w = 14, d = 10, fh = 0.4, h = 3.6;
  const plaster = texMat('plaster', { color: 0xe8dcc8 });
  const stone = texMat('stone');
  const beam = texMat('woodDark');
  const planks = texMat('planks');
  floorSlab(g, c, { w, d, y: fh, mat: planks, foundMat: stone });
  const door = { x: 0, w: 1.8 };
  // Lower stone course + plaster upper on ground floor.
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: d / 2, y0: fh, h, mat: plaster, door });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: -d / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: w / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: -w / 2, y0: fh, h, mat: plaster });
  timberFrame(g, { w, d, y0: fh, h, beam });
  // Ceiling / upper floor.
  g.add(box(w - 0.2, 0.2, d - 0.2, planks, { y: fh + h + 0.1 }));
  c.push({ type: 'box', x: 0, z: 0, hx: w / 2, hz: d / 2, rot: 0, y0: fh + h, y1: fh + h + 0.3, camOnly: true });
  for (let i = -2; i <= 2; i++) g.add(box(0.2, 0.25, d - 0.3, beam, { x: i * 2.8, y: fh + h - 0.1 }));
  // Upper storey (overhanging jetty), visual only.
  const uw = w + 0.8, ud = d + 0.8, uy = fh + h + 0.2, uh = 2.8;
  g.add(box(uw, uh, ud, plaster, { y: uy + uh / 2 }));
  timberFrame(g, { w: uw, d: ud, y0: uy, h: uh, beam });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) windowAt(g, { x, y: uy + 1.4, z: ud / 2 + 0.05, beam });
  for (const x of [-4, 0, 4]) windowAt(g, { x, y: uy + 1.4, z: -ud / 2 - 0.05, ry: Math.PI, beam });
  gableRoof(g, { w: uw, d: ud, yTop: uy + uh, rise: 3, mat: texMat('roof'), endMat: plaster, ridgeMat: beam });
  for (const x of [-4.5, -2.5, 2.5, 4.5]) windowAt(g, { x, y: fh + 1.7, z: d / 2 + 0.16, beam });
  for (const z of [-2.5, 2.5]) {
    windowAt(g, { x: w / 2 + 0.16, y: fh + 1.7, z, ry: Math.PI / 2, beam });
    windowAt(g, { x: -w / 2 - 0.16, y: fh + 1.7, z, ry: -Math.PI / 2, beam });
  }
  // Hanging sign with a lantern.
  g.add(box(0.12, 0.12, 1.6, beam, { x: 2.0, y: fh + 3.0, z: d / 2 + 0.8 }));
  g.add(box(1.4, 0.8, 0.06, texMat('planks', { color: 0x6a4a30 }), { x: 2.0, y: fh + 2.45, z: d / 2 + 1.4, ry: Math.PI / 2 }));
  const lantern = cyl(0.14, 0.14, 0.3, glowMat(0xffb050, 2.6), { x: -2.0, y: fh + 2.7, z: d / 2 + 0.5, seg: 8 });
  g.add(lantern);
  stepBlock(g, c, { x: 0, z: d / 2 + 0.7, w: 3, d: 1.0, h: 0.2, mat: stone });
  g.add(box(1.0, 2.0, 0.8, stone, { x: w / 2 - 1.6, y: uy + uh + 2.5, z: -2 }));
  g.userData.colliders = c;
  g.userData.lights = [
    { x: 4.5, y: fh + 1.2, z: -1, color: 0xff8a40, intensity: 9, distance: 12, flicker: true, interior: true },
    { x: -3.5, y: fh + 2.8, z: 0, color: 0xffb070, intensity: 7, distance: 11, interior: true },
    { x: -2.0, y: fh + 2.6, z: d / 2 + 0.6, color: 0xffa040, intensity: 4, distance: 9 },
  ];
  g.userData.props = [
    { slot: 'prop_counter', x: -3.8, z: -2.6, rot: 0 },
    { slot: 'prop_shelf', x: -3.8, z: -4.55, rot: 0 },
    { slot: 'prop_shelf', x: -1.4, z: -4.55, rot: 0 },
    { slot: 'prop_hearth', x: 6.35, z: -1, rot: -Math.PI / 2 },
    { slot: 'prop_table', x: 1.5, z: 1.5, rot: 0.1 },
    { slot: 'prop_table', x: 3.8, z: -3.0, rot: Math.PI / 2 },
    { slot: 'prop_table', x: -4.5, z: 2.6, rot: 0 },
    { slot: 'prop_stool', x: 0.6, z: 2.4, rot: 0 }, { slot: 'prop_stool', x: 2.4, z: 2.3, rot: 0 },
    { slot: 'prop_stool', x: 1.6, z: 0.5, rot: 0 }, { slot: 'prop_stool', x: 4.8, z: -2.2, rot: 0 },
    { slot: 'prop_chair', x: -4.5, z: 1.7, rot: 0 }, { slot: 'prop_chair', x: -5.4, z: 3.4, rot: Math.PI / 2 },
    { slot: 'prop_chair', x: 2.8, z: -3.6, rot: -Math.PI / 2 },
    { slot: 'prop_stool', x: -4.8, z: -1.6, rot: 0 }, { slot: 'prop_stool', x: -3.0, z: -1.6, rot: 0 },
    { slot: 'prop_barrel', x: -6.2, z: -4.2, rot: 0 }, { slot: 'prop_barrel', x: -6.2, z: -3.2, rot: 0 },
    { slot: 'prop_rug', x: 1.2, z: 1.0, rot: Math.PI / 2 },
  ];
  g.userData.spots = {
    keeper: { x: -3.8, z: -3.7, rot: 0 },
    darro: { x: -4.5, z: 3.5, rot: Math.PI, sit: true },
    patron: { x: 3.0, z: -2.2, rot: -Math.PI / 2, sit: true },
    door: { x: 0, z: d / 2 + 2 },
  };
  g.userData.interior = { hx: w / 2, hz: d / 2, y: fh };
  return finish(g, 'tavern');
}

// ---------------------------------------------------------------- Tidewarden's Hall (enterable)
export function buildHall() {
  const g = new THREE.Group();
  const c = [];
  const w = 12, d = 9, fh = 0.6, h = 4.0;
  const stone = texMat('stone', { color: 0xd0c8c0 });
  const beam = texMat('woodDark');
  const planks = texMat('planks', { color: 0xc8b090 });
  floorSlab(g, c, { w, d, y: fh, mat: planks, foundMat: stone });
  const door = { x: 0, w: 2.0 };
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: d / 2, y0: fh, h, mat: stone, door, doorH: 2.8 });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: -d / 2, y0: fh, h, mat: stone });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: w / 2, y0: fh, h, mat: stone });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: -w / 2, y0: fh, h, mat: stone });
  g.add(box(w - 0.2, 0.2, d - 0.2, planks, { y: fh + h + 0.1 }));
  c.push({ type: 'box', x: 0, z: 0, hx: w / 2, hz: d / 2, rot: 0, y0: fh + h, y1: fh + h + 0.3, camOnly: true });
  for (let i = -2; i <= 2; i++) g.add(box(0.25, 0.3, d - 0.3, beam, { x: i * 2.5, y: fh + h - 0.12 }));
  // Corner buttresses and a cornice.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.7, h + 0.4, 0.7, stone, { x: sx * w / 2, y: fh + h / 2 - 0.2, z: sz * d / 2 }));
  g.add(box(w + 0.5, 0.3, d + 0.5, stone, { y: fh + h + 0.15 }));
  for (const x of [-3.8, 3.8]) windowAt(g, { x, y: fh + 2.2, z: d / 2 + 0.16, w: 1.0, h: 1.5, beam });
  for (const z of [-2, 2]) {
    windowAt(g, { x: w / 2 + 0.16, y: fh + 2.2, z, ry: Math.PI / 2, w: 1.0, h: 1.5, beam });
    windowAt(g, { x: -w / 2 - 0.16, y: fh + 2.2, z, ry: -Math.PI / 2, w: 1.0, h: 1.5, beam });
  }
  gableRoof(g, { w: w + 0.4, d: d + 0.4, yTop: fh + h + 0.3, rise: 3.2, mat: texMat('roof', { color: 0x8a90a0 }), endMat: stone, ridgeMat: beam });
  // Banners by the door.
  const bannerM = texMat('cloth', { color: 0x2a4a7a });
  for (const x of [-1.8, 1.8]) {
    g.add(box(0.8, 2.2, 0.04, bannerM, { x, y: fh + 2.4, z: d / 2 + 0.17 }));
    g.add(box(0.95, 0.08, 0.1, beam, { x, y: fh + 3.55, z: d / 2 + 0.2 }));
    g.add(sphere(0.18, colorMat(0xd0b050, { metal: 0.6, rough: 0.4 }), { x, y: fh + 2.7, z: d / 2 + 0.2, sz: 0.3 }));
  }
  stepBlock(g, c, { x: 0, z: d / 2 + 0.65, w: 3.4, d: 0.9, h: 0.3, mat: stone });
  stepBlock(g, c, { x: 0, z: d / 2 + 1.35, w: 3.4, d: 0.6, h: 0.12, mat: stone });
  g.add(cyl(0.12, 0.12, 0.35, glowMat(0xffc070, 2.4), { x: -1.3, y: fh + 3.1, z: d / 2 + 0.35, seg: 8 }));
  g.add(cyl(0.12, 0.12, 0.35, glowMat(0xffc070, 2.4), { x: 1.3, y: fh + 3.1, z: d / 2 + 0.35, seg: 8 }));
  // Desk
  const desk = new THREE.Group();
  desk.add(box(3.0, 0.1, 1.1, planks, { y: 0.85 }));
  desk.add(box(3.0, 0.8, 0.1, beam, { y: 0.4, z: 0.5 }));
  for (const x of [-1.45, 1.45]) desk.add(box(0.1, 0.8, 1.0, beam, { x, y: 0.4 }));
  desk.add(box(0.5, 0.04, 0.35, colorMat(0xe8dcc0), { x: -0.6, y: 0.92, rz: 0.04 }));
  desk.add(box(0.4, 0.12, 0.3, colorMat(0x6a2a2a), { x: 0.8, y: 0.96 }));
  desk.add(cyl(0.04, 0.05, 0.1, colorMat(0x1a1a2a), { x: 0.2, y: 0.95, seg: 8 }));
  desk.position.set(0, fh, -2.2);
  g.add(desk);
  c.push({ type: 'box', x: 0, z: -2.2, hx: 1.55, hz: 0.6, rot: 0, y0: -2, y1: fh + 0.95 });
  g.userData.colliders = c;
  g.userData.lights = [
    { x: 0, y: fh + 3.0, z: -1, color: 0xffc080, intensity: 9, distance: 13, interior: true },
    { x: 0, y: fh + 3.1, z: d / 2 + 0.6, color: 0xffb060, intensity: 4, distance: 9 },
  ];
  g.userData.props = [
    { slot: 'prop_bookshelf', x: -4.4, z: -4.2, rot: 0 }, { slot: 'prop_bookshelf', x: -2.6, z: -4.2, rot: 0 },
    { slot: 'prop_bookshelf', x: 2.6, z: -4.2, rot: 0 }, { slot: 'prop_shelf', x: 4.6, z: -4.25, rot: 0 },
    { slot: 'prop_chair', x: 0, z: -3.2, rot: 0 }, { slot: 'prop_bench', x: -4.8, z: 1.5, rot: Math.PI / 2 },
    { slot: 'prop_bench', x: 4.8, z: 1.5, rot: -Math.PI / 2 }, { slot: 'prop_rug', x: 0, z: 1.2, rot: 0 },
    { slot: 'prop_chest', x: 5.0, z: -2.0, rot: -Math.PI / 2 },
  ];
  g.userData.spots = { orvel: { x: 0, z: -3.0, rot: 0 }, clerk: { x: 4.0, z: 2.5, rot: -Math.PI / 2 }, door: { x: 0, z: d / 2 + 2.4 } };
  g.userData.interior = { hx: w / 2, hz: d / 2, y: fh };
  return finish(g, 'hall');
}

// ---------------------------------------------------------------- Tobin's Sundries (enterable)
export function buildShop() {
  const g = new THREE.Group();
  const c = [];
  const w = 9, d = 7, fh = 0.4, h = 3.2;
  const planks = texMat('planks', { color: 0xc0a888 });
  const plaster = texMat('plaster', { color: 0xd8d0b8 });
  const beam = texMat('woodDark');
  const stone = texMat('stone');
  floorSlab(g, c, { w, d, y: fh, mat: texMat('planks'), foundMat: stone });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: d / 2, y0: fh, h, mat: plaster, door: { x: -1.5, w: 1.6 } });
  wallX(g, c, { x0: -w / 2, x1: w / 2, z: -d / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: w / 2, y0: fh, h, mat: plaster });
  wallZ(g, c, { z0: -d / 2, z1: d / 2, x: -w / 2, y0: fh, h, mat: plaster });
  timberFrame(g, { w, d, y0: fh, h, beam });
  g.add(box(w - 0.2, 0.2, d - 0.2, planks, { y: fh + h + 0.1 }));
  c.push({ type: 'box', x: 0, z: 0, hx: w / 2, hz: d / 2, rot: 0, y0: fh + h, y1: fh + h + 0.3, camOnly: true });
  windowAt(g, { x: 2.2, y: fh + 1.6, z: d / 2 + 0.16, w: 1.6, h: 1.1, beam });
  windowAt(g, { x: w / 2 + 0.16, y: fh + 1.7, z: 0, ry: Math.PI / 2, beam });
  gableRoof(g, { w, d, yTop: fh + h, rise: 2.4, mat: texMat('roof', { color: 0x9a7a6a }), endMat: plaster, ridgeMat: beam });
  // Awning over the window.
  const aw = texMat('cloth', { color: 0x8a3a30, side: THREE.DoubleSide });
  g.add(box(2.4, 0.04, 1.4, aw, { x: 2.2, y: fh + 2.55, z: d / 2 + 0.7, rx: 0.35 }));
  g.add(box(1.2, 0.6, 0.06, texMat('planks', { color: 0x5a3a28 }), { x: -1.5, y: fh + 2.8, z: d / 2 + 0.2 }));
  stepBlock(g, c, { x: -1.5, z: d / 2 + 0.6, w: 2.2, d: 0.8, h: 0.2, mat: stone });
  g.userData.colliders = c;
  g.userData.lights = [{ x: 0, y: fh + 2.6, z: -0.5, color: 0xffc080, intensity: 8, distance: 11, interior: true }];
  g.userData.props = [
    { slot: 'prop_counter', x: 1.2, z: -1.4, rot: 0 },
    { slot: 'prop_shelf', x: 1.0, z: -3.25, rot: 0 }, { slot: 'prop_shelf', x: 3.2, z: -3.25, rot: 0 },
    { slot: 'prop_crate', x: -3.6, z: -2.6, rot: 0.2 }, { slot: 'prop_crate', x: -3.6, z: -2.6, rot: 0.6, y: 1 },
    { slot: 'prop_barrel', x: -3.7, z: -1.2, rot: 0 }, { slot: 'prop_sack', x: -2.6, z: -2.9, rot: 0 },
    { slot: 'prop_sack', x: 3.8, z: 2.4, rot: 0 }, { slot: 'prop_barrel', x: 3.8, z: 1.2, rot: 0 },
  ];
  g.userData.spots = { tobin: { x: 1.2, z: -2.4, rot: 0 }, door: { x: -1.5, z: d / 2 + 2 } };
  g.userData.interior = { hx: w / 2, hz: d / 2, y: fh };
  return finish(g, 'shop');
}

// ---------------------------------------------------------------- North Watch tower
export function buildWatchtower() {
  const g = new THREE.Group();
  const c = [];
  const stone = texMat('stone', { color: 0xb0a8a0 });
  const beam = texMat('woodDark');
  const planks = texMat('planks');
  g.add(box(4.6, 4, 4.6, stone, { y: 1.6 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.3, 5.2, 0.3, beam, { x: sx * 1.9, y: 6.2, z: sz * 1.9 }));
  g.add(box(5.2, 0.25, 5.2, planks, { y: 3.7 }));
  g.add(box(5.4, 0.25, 5.4, planks, { y: 8.5 }));
  for (const s of [-1, 1]) {
    g.add(box(5.4, 1.0, 0.12, planks, { y: 9.1, z: s * 2.65 }));
    g.add(box(0.12, 1.0, 5.4, planks, { y: 9.1, x: s * 2.65 }));
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.2, 2.4, 0.2, beam, { x: sx * 2.5, y: 9.8, z: sz * 2.5 }));
  g.add(cone(4.2, 2.4, texMat('roof'), { y: 12.1, seg: 4, ry: Math.PI / 4 }));
  g.add(box(1.2, 2.2, 0.1, texMat('planks', { color: 0x6a4a30 }), { y: 1.1, z: 2.32 }));
  // Ladder.
  for (const x of [-0.35, 0.35]) g.add(box(0.07, 5, 0.07, beam, { x, y: 6.2, z: 2.0 }));
  for (let i = 0; i < 12; i++) g.add(box(0.7, 0.05, 0.05, beam, { y: 3.9 + i * 0.4, z: 2.0 }));
  const banner = texMat('cloth', { color: 0x2a4a7a });
  g.add(box(0.05, 1.6, 0.9, banner, { x: 2.7, y: 6.8 }));
  g.add(cyl(0.12, 0.12, 0.3, glowMat(0xffb050, 2.4), { x: 0, y: 3.2, z: 2.5, seg: 8 }));
  c.push({ type: 'box', x: 0, z: 0, hx: 2.4, hz: 2.4, rot: 0, y0: -2, y1: 12 });
  g.userData.colliders = c;
  g.userData.lights = [{ x: 0, y: 3.2, z: 2.8, color: 0xffa040, intensity: 5, distance: 10 }];
  g.userData.spots = { hessa: { x: 1.6, z: 4.0, rot: 0.2 } };
  return finish(g, 'watchtower');
}

// ---------------------------------------------------------------- Lantern Point lighthouse
export function buildLighthouse() {
  const g = new THREE.Group();
  const c = [];
  const stone = texMat('stone', { color: 0xe0d8d0 });
  const red = texMat('plaster', { color: 0xa84a3a });
  g.add(cyl(3.0, 3.6, 1.5, stone, { y: 0.0, seg: 16 }));
  for (let i = 0; i < 4; i++) {
    g.add(cyl(2.9 - i * 0.18, 3.1 - i * 0.18, 3.2, i % 2 ? red : stone, { y: 0.75 + 1.6 + i * 3.2, seg: 16 }));
  }
  const top = 0.75 + 12.8;
  g.add(cyl(2.8, 2.6, 0.3, stone, { y: top + 0.15, seg: 16 }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(box(0.06, 0.9, 0.06, colorMat(0x2a2a2a, { metal: 0.6 }), { x: Math.cos(a) * 2.6, y: top + 0.75, z: Math.sin(a) * 2.6 }));
  }
  const lamp = cyl(1.3, 1.3, 1.8, glowMat(0xfff0b0, 3.5), { y: top + 1.2, seg: 12 });
  g.add(lamp);
  g.add(cone(1.9, 1.6, colorMat(0x3a2a2a, { rough: 0.6 }), { y: top + 2.9, seg: 12 }));
  g.add(sphere(0.25, colorMat(0xb08d40, { metal: 0.8 }), { y: top + 3.8 }));
  g.add(box(1.3, 2.3, 0.2, texMat('planks', { color: 0x5a3a2a }), { y: 1.9, z: 2.9 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 3.4, y0: -2, y1: 18 });
  g.userData.colliders = c;
  g.userData.lights = [{ x: 0, y: top + 1.2, z: 0, color: 0xffe0a0, intensity: 40, distance: 60, beacon: true }];
  g.userData.spots = { brannoc: { x: 2.2, z: 4.6, rot: 0.5 } };
  return finish(g, 'lighthouse');
}

// ---------------------------------------------------------------- Shrine of the Tide (village center)
export function buildShrine() {
  const g = new THREE.Group();
  const c = [];
  const stone = texMat('stone', { color: 0xc8c4bc });
  g.add(cyl(3.4, 3.6, 0.35, stone, { y: 0.0, seg: 20 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 3.6, y0: -2, y1: 0.175, walk: true });
  g.add(cyl(1.6, 1.8, 0.6, stone, { y: 0.45, seg: 16 }));
  g.add(cyl(1.45, 1.45, 0.1, colorMat(0x3a6a7a, { rough: 0.1, metal: 0.2 }), { y: 0.72, seg: 16 }));
  g.add(cyl(0.45, 0.6, 1.4, stone, { y: 1.4, seg: 10 }));
  // Statue: robed figure lifting a lantern.
  const sm = colorMat(0xa8b0a8, { rough: 0.8 });
  g.add(cyl(0.28, 0.5, 1.7, sm, { y: 2.95, seg: 10 }));
  g.add(sphere(0.22, sm, { y: 4.0, sy: 1.1 }));
  g.add(sphere(0.3, sm, { y: 4.05, z: -0.05, thetaLength: Math.PI * 0.6, sx: 1.05 }));
  g.add(cyl(0.07, 0.08, 0.8, sm, { x: 0.32, y: 4.15, z: 0.1, rz: -0.35 }));
  g.add(cyl(0.07, 0.08, 0.7, sm, { x: -0.3, y: 3.2, z: 0.15, rz: 0.2 }));
  g.add(cyl(0.12, 0.14, 0.26, glowMat(0x80e0ff, 3), { x: 0.5, y: 4.62, z: 0.12, seg: 8 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 1.85, y0: -2, y1: 5 });
  g.userData.colliders = c;
  g.userData.lights = [{ x: 0.5, y: 4.6, z: 0.2, color: 0x80d0ff, intensity: 8, distance: 14 }];
  return finish(g, 'shrine');
}

// ---------------------------------------------------------------- The Drowned Spire (ruin + arena)
export function buildSpire() {
  const g = new THREE.Group();
  const c = [];
  const stone = texMat('stone', { color: 0x8a9294 });
  const dark = texMat('stone', { color: 0x5a6668 });
  const rnd = mulberry32(77);
  // Arena floor
  g.add(cyl(16, 16.4, 0.4, dark, { y: -0.1, seg: 32 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 16.2, y0: -3, y1: 0.1, walk: true });
  // Inner tower ring
  const R = 5, blocks = 18;
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) continue; // door gap facing +Z
    const h = 5 + rnd() * 11 * (i % 3 === 0 ? 1 : 0.6);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    g.add(box(1.85, h, 1.0, i % 2 ? stone : dark, { x, y: h / 2, z, ry: -a + Math.PI / 2 }));
    c.push({ type: 'box', x, z, hx: 0.95, hz: 0.55, rot: -a + Math.PI / 2, y0: -2, y1: h });
  }
  g.add(cyl(4.4, 4.4, 0.3, stone, { y: 0.15, seg: 20 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 4.4, y0: -3, y1: 0.3, walk: true });
  // Ring of pillars.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 13, z = Math.sin(a) * 13;
    const h = i % 3 === 0 ? 2 + rnd() * 2 : 6 + rnd() * 2;
    g.add(box(1.1, 0.4, 1.1, stone, { x, y: 0.3, z }));
    g.add(cyl(0.45, 0.5, h, i % 2 ? stone : dark, { x, y: 0.4 + h / 2, z, seg: 10 }));
    if (h > 5) g.add(box(1.2, 0.4, 1.2, stone, { x, y: 0.6 + h, z }));
    c.push({ type: 'circle', x, z, r: 0.65, y0: -2, y1: h + 1 });
  }
  // Fallen blocks
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, r = 7 + rnd() * 6;
    const s = 0.6 + rnd() * 0.8;
    g.add(box(s * 1.6, s, s, stone, { x: Math.cos(a) * r, y: s / 2, z: Math.sin(a) * r, ry: rnd() * 3, rz: rnd() * 0.3 }));
    c.push({ type: 'circle', x: Math.cos(a) * r, z: Math.sin(a) * r, r: s * 0.8, y0: -2, y1: s });
  }
  // Steps into the arena from the road side (+Z).
  for (let i = 0; i < 3; i++) g.add(box(5, 0.2, 1, stone, { y: -0.3 - i * 0.25, z: 16.6 + i * 0.9 }));
  g.userData.colliders = c;
  g.userData.lights = [];
  g.userData.spots = { eye: { x: 0, z: 0, y: 11, rot: 0 }, boss: { x: 0, z: 8.5, rot: 0 } };
  return finish(g, 'spire');
}

// ---------------------------------------------------------------- Bogling hut
export function buildBogHut({ seed = 3 } = {}) {
  const g = new THREE.Group();
  const c = [];
  const th = texMat('thatch', { color: 0x8a8060 });
  const bark = texMat('bark');
  const rnd = mulberry32(seed);
  g.add(sphere(2.4, th, { y: 0, sy: 0.95, thetaLength: Math.PI * 0.5, wseg: 14, hseg: 7 }));
  g.add(sphere(0.9, colorMat(0x140e08), { y: 0.0, z: 2.0, sy: 1.1, sz: 0.5, thetaLength: Math.PI * 0.5 }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(cyl(0.05, 0.08, 3.2, bark, { x: Math.cos(a) * 1.5, y: 1.3, z: Math.sin(a) * 1.5, rz: Math.cos(a) * -0.5, rx: Math.sin(a) * 0.5, seg: 5 }));
  }
  g.add(cyl(0.05, 0.06, 2.2, bark, { x: 1.6, y: 1.1, z: 2.4, seg: 5 }));
  g.add(sphere(0.16, colorMat(0xe0d8c0), { x: 1.6, y: 2.3, z: 2.4, sy: 1.15 }));
  for (let i = 0; i < 3; i++) g.add(box(0.5 + rnd() * 0.4, 0.04, 0.12, colorMat(0x7a6a3a), { x: (rnd() - 0.5) * 2, y: 2.2, z: (rnd() - 0.5) * 2, ry: rnd() * 3 }));
  c.push({ type: 'circle', x: 0, z: 0, r: 2.3, y0: -2, y1: 2.4 });
  g.userData.colliders = c;
  return finish(g, 'bog_hut');
}

// ---------------------------------------------------------------- Wreck of the Gilded Gull
export function buildWreck() {
  const g = new THREE.Group();
  const c = [];
  const p = texMat('planks', { color: 0x8a7a66 });
  const d = texMat('woodDark', { color: 0x8a7a6a });
  const hull = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const z = -6 + i * 1.5;
    const w = 2.8 * Math.sin(((i + 1) / 10) * Math.PI) + 0.6;
    for (const s of [-1, 1]) hull.add(box(0.2, 3.0, 1.55, p, { x: s * w, y: 1.4, z, rz: s * 0.25 }));
    hull.add(box(w * 2, 0.2, 1.55, p, { y: 0.0, z }));
    if (i % 2 === 0) for (const s of [-1, 1]) hull.add(box(0.25, 3.6, 0.25, d, { x: s * (w - 0.1), y: 1.6, z, rz: s * 0.3 }));
  }
  hull.add(box(0.5, 9, 0.5, d, { x: 0.2, y: 4.5, z: 1, rz: 0.5 }));
  hull.add(box(0.4, 4, 0.4, d, { x: 0.5, y: 1.6, z: -4, rz: -0.9 }));
  hull.add(box(5, 0.15, 5, p, { y: 2.2, z: -2, rz: 0.08 }));
  hull.rotation.z = 0.22;
  hull.position.y = -0.3;
  g.add(hull);
  c.push({ type: 'box', x: 2.8, z: 0, hx: 0.5, hz: 7, rot: 0, y0: -2, y1: 4 });
  c.push({ type: 'box', x: -2.2, z: 0, hx: 0.5, hz: 7, rot: 0, y0: -2, y1: 3 });
  c.push({ type: 'box', x: 0, z: -7, hx: 2.8, hz: 0.5, rot: 0, y0: -2, y1: 3 });
  g.userData.colliders = c;
  return finish(g, 'wreck');
}

// ---------------------------------------------------------------- Prison ship
export function buildShip() {
  const g = new THREE.Group();
  const c = [];
  const L = 22, B = 7, deck = 2.1;
  const p = texMat('planks', { color: 0x9a8064 });
  const dk = texMat('planks', { color: 0xc0a888 });
  const d = texMat('woodDark');
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, L / 2 + 2);
  hullShape.quadraticCurveTo(B / 2 + 0.6, L / 4, B / 2, -L / 2 + 1);
  hullShape.lineTo(B / 2 - 0.5, -L / 2);
  hullShape.lineTo(-B / 2 + 0.5, -L / 2);
  hullShape.lineTo(-B / 2, -L / 2 + 1);
  hullShape.quadraticCurveTo(-B / 2 - 0.6, L / 4, 0, L / 2 + 2);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 3.4, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.4, bevelSegments: 2 });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, deck + 0.05, 0);
  const uv = hullGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4, uv.getY(i) / 2.4);
  g.add(new THREE.Mesh(hullGeo, p));
  g.add(box(B - 0.4, 0.1, L - 0.6, dk, { y: deck + 0.02, z: -0.2 }));
  c.push({ type: 'box', x: 0, z: 0, hx: B / 2 - 0.1, hz: L / 2, rot: 0, y0: -4, y1: deck, walk: true });
  c.push({ type: 'box', x: 0, z: L / 2 + 0.4, hx: 1.8, hz: 1.2, rot: 0, y0: -4, y1: deck, walk: true });
  // Rails with a gap for the gangplank on the -X side.
  const railY = deck + 0.55;
  for (const s of [-1, 1]) {
    const zs = s === -1 ? [[-L / 2 + 0.5, -1.4], [1.4, L / 2 - 1]] : [[-L / 2 + 0.5, L / 2 - 1]];
    for (const [z0, z1] of zs) {
      g.add(box(0.12, 0.12, z1 - z0, d, { x: s * (B / 2 - 0.15), y: railY + 0.45, z: (z0 + z1) / 2 }));
      g.add(box(0.16, 0.9, z1 - z0, p, { x: s * (B / 2 - 0.05), y: railY, z: (z0 + z1) / 2 }));
      c.push({ type: 'box', x: s * (B / 2 - 0.1), z: (z0 + z1) / 2, hx: 0.2, hz: (z1 - z0) / 2, rot: 0, y0: -4, y1: deck + 1.4 });
    }
  }
  c.push({ type: 'box', x: 0, z: -L / 2 + 0.3, hx: B / 2, hz: 0.3, rot: 0, y0: -4, y1: deck + 1.4 });
  c.push({ type: 'box', x: 0, z: L / 2 + 1.5, hx: 2, hz: 0.3, rot: 0, y0: -4, y1: deck + 1.4 });
  for (const s of [-1, 1]) c.push({ type: 'box', x: s * 1.8, z: L / 2 + 0.2, hx: 0.3, hz: 1.4, rot: s * 0.5, y0: -4, y1: deck + 1.4 });
  // Stern cabin
  g.add(box(B - 1, 2.4, 4.5, p, { y: deck + 1.2, z: -L / 2 + 2.9 }));
  g.add(box(B - 0.6, 0.2, 4.9, d, { y: deck + 2.5, z: -L / 2 + 2.9 }));
  g.add(box(1.0, 1.9, 0.1, texMat('planks', { color: 0x5a3a28 }), { y: deck + 0.95, z: -L / 2 + 5.2 }));
  for (const x of [-1.8, 1.8]) windowAt(g, { x, y: deck + 1.4, z: -L / 2 + 5.17, w: 0.6, h: 0.5, beam: d });
  c.push({ type: 'box', x: 0, z: -L / 2 + 2.9, hx: (B - 1) / 2, hz: 2.3, rot: 0, y0: -4, y1: deck + 2.6 });
  // Mast, yard, sail
  g.add(cyl(0.22, 0.28, 15, d, { y: deck + 7.5, z: 1.5, seg: 10 }));
  c.push({ type: 'circle', x: 0, z: 1.5, r: 0.35, y0: -4, y1: deck + 15 });
  g.add(cyl(0.12, 0.12, 9, d, { y: deck + 11, z: 1.5, rz: Math.PI / 2, seg: 8 }));
  const sail = texMat('cloth', { color: 0xd8ccb0, side: THREE.DoubleSide });
  const sailGeo = new THREE.PlaneGeometry(8.4, 6, 8, 6);
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin((sp.getX(i) / 8.4 + 0.5) * Math.PI) * 0.6 * (0.5 + (3 - sp.getY(i)) / 12));
  sailGeo.computeVertexNormals();
  const sailM = new THREE.Mesh(sailGeo, sail);
  sailM.position.set(0, deck + 7.8, 1.65);
  g.add(sailM);
  g.add(cyl(0.1, 0.12, 7, d, { y: deck + 1.9, z: L / 2 + 3.5, rx: 1.15, seg: 8 }));
  // Crates and a cage on deck.
  for (const [x, z] of [[2.3, 6], [2.3, 7.2], [-2.3, -4.5]]) {
    g.add(box(1, 1, 1, texMat('planks', { color: 0xc0a080 }), { x, y: deck + 0.5, z }));
    c.push({ type: 'box', x, z, hx: 0.55, hz: 0.55, rot: 0, y0: -4, y1: deck + 1 });
  }
  const bars = colorMat(0x3a3a3a, { metal: 0.7, rough: 0.5 });
  g.add(box(2.2, 0.12, 2.2, d, { x: 1.6, y: deck + 0.06, z: -1.8 }));
  g.add(box(2.2, 0.12, 2.2, d, { x: 1.6, y: deck + 2.2, z: -1.8 }));
  for (let i = 0; i < 6; i++) {
    g.add(cyl(0.025, 0.025, 2.1, bars, { x: 0.5 + i * 0.44, y: deck + 1.1, z: -0.7, seg: 4 }));
    g.add(cyl(0.025, 0.025, 2.1, bars, { x: 0.5 + i * 0.44, y: deck + 1.1, z: -2.9, seg: 4 }));
    if (i > 0 && i < 5) g.add(cyl(0.025, 0.025, 2.1, bars, { x: 2.7, y: deck + 1.1, z: -2.9 + i * 0.44, seg: 4 }));
  }
  c.push({ type: 'box', x: 1.6, z: -1.8, hx: 1.15, hz: 1.15, rot: 0, y0: -4, y1: deck + 2.3 });
  g.add(cyl(0.12, 0.12, 0.3, glowMat(0xffb050, 2.4), { y: deck + 2.4, z: -L / 2 + 5.4, seg: 8 }));
  // Gangplank to the dock (-X side).
  const gp = box(6.2, 0.1, 1.2, dk, { x: -B / 2 - 2.9, y: deck - 0.22, z: 0, rz: Math.atan2(0.5, 6) });
  g.add(gp);
  for (const s of [-1, 1]) g.add(box(6.2, 0.06, 0.06, d, { x: -B / 2 - 2.9, y: deck + 0.4, z: s * 0.6, rz: Math.atan2(0.5, 6) }));
  c.push({ type: 'ramp', x: -B / 2 - 2.9, z: 0, hx: 3.1, hz: 0.6, rot: 0, y0: -4, h0: deck - 0.5, h1: deck });
  g.userData.colliders = c;
  g.userData.lights = [{ x: 0, y: deck + 2.4, z: -L / 2 + 5.6, color: 0xffa040, intensity: 4, distance: 9 }];
  g.userData.spots = { kell: { x: -1.6, z: 2.2, rot: -Math.PI / 2 }, sailor: { x: 1.8, z: 8.5, rot: Math.PI } };
  return finish(g, 'ship');
}

// ---------------------------------------------------------------- Cult camp (built from props)
export function buildCultCamp() {
  const g = new THREE.Group();
  g.userData.colliders = [];
  g.userData.props = [
    { slot: 'prop_tent', x: -4, z: -2, rot: 0.4 },
    { slot: 'prop_tent', x: 4.5, z: -3, rot: -0.5 },
    { slot: 'prop_campfire', x: 0, z: 1, rot: 0 },
    { slot: 'prop_banner', x: -1.5, z: -4, rot: 0 },
    { slot: 'prop_banner', x: 2.0, z: 5, rot: Math.PI },
    { slot: 'prop_crate', x: 6.0, z: 1.0, rot: 0.4 },
    { slot: 'prop_sack', x: 5.5, z: 2.2, rot: 0 },
    { slot: 'prop_altar', x: 0, z: -6, rot: 0 },
  ];
  g.userData.lights = [];
  return g;
}
