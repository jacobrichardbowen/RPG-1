// Procedural props: containers, furniture, village clutter, camp gear, weapons and quest objects.
import * as THREE from 'three';
import { texMat, colorMat, glowMat, box, sphere, cyl, cone, capsule, bake } from './geo.js';
import { mulberry32 } from '../../core/noise.js';

const joint = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

const metal = () => colorMat(0x4a4a50, { rough: 0.45, metal: 0.7 });
const gold = () => colorMat(0xb08d40, { rough: 0.35, metal: 0.8 });

export function buildCrate() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0xc0a080 });
  const d = texMat('woodDark');
  g.add(box(1, 1, 1, p, { y: 0.5 }));
  for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) g.add(box(0.08, 1.02, 0.08, d, { x, y: 0.5, z }));
  for (const y of [0.04, 0.96]) {
    g.add(box(1.02, 0.08, 0.08, d, { y, z: 0.48 }));
    g.add(box(1.02, 0.08, 0.08, d, { y, z: -0.48 }));
    g.add(box(0.08, 0.08, 1.02, d, { x: 0.48, y }));
    g.add(box(0.08, 0.08, 1.02, d, { x: -0.48, y }));
  }
  const out = bake(g, 'crate');
  out.userData.collider = { box: [0.52, 0.52], h: 1 };
  return out;
}

export function buildBarrel() {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    prof.push(new THREE.Vector2(0.38 + Math.sin(t * Math.PI) * 0.07, t * 1.1));
  }
  const geo = new THREE.LatheGeometry(prof, 16);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * 0.5);
  const bm = texMat('planks', { color: 0xb08a68 });
  g.add(new THREE.Mesh(geo, bm));
  g.add(cyl(0.39, 0.39, 0.02, texMat('woodDark'), { y: 1.09, seg: 16 }));
  for (const y of [0.15, 0.95]) g.add(cyl(0.425, 0.425, 0.06, metal(), { y, seg: 16, open: true }));
  for (const y of [0.42, 0.68]) g.add(cyl(0.455, 0.455, 0.06, metal(), { y, seg: 16, open: true }));
  const out = bake(g, 'barrel');
  out.children.forEach((c) => (c.material.side = THREE.DoubleSide));
  out.userData.collider = { r: 0.45, h: 1.1 };
  return out;
}

export function buildChest() {
  const g = new THREE.Group();
  const w = texMat('woodDark', { color: 0xa07850 });
  const m = gold();
  g.add(box(1.1, 0.55, 0.65, w, { y: 0.275 }));
  for (const x of [-0.4, 0.4]) g.add(box(0.07, 0.57, 0.67, m, { x, y: 0.285 }));
  const lid = joint('lid', 0, 0.55, -0.325);
  g.add(lid);
  lid.add(box(1.12, 0.2, 0.67, w, { y: 0.1, z: 0.335 }));
  lid.add(box(1.0, 0.06, 0.6, w, { y: 0.22, z: 0.335 }));
  for (const x of [-0.4, 0.4]) lid.add(box(0.07, 0.22, 0.69, m, { x, y: 0.11, z: 0.335 }));
  lid.add(box(0.12, 0.16, 0.05, m, { y: 0.0, z: 0.68 }));
  lid.children.forEach((c) => (c.userData.keep = true));
  g.userData.collider = { box: [0.58, 0.36], h: 0.8 };
  g.userData.rig = { type: 'chest' };
  return g;
}

export function buildLanternPost() {
  const g = new THREE.Group();
  const d = texMat('woodDark');
  g.add(box(0.16, 3, 0.16, d, { y: 1.5 }));
  g.add(box(0.9, 0.1, 0.1, d, { y: 2.9, z: 0, x: 0.38 }));
  g.add(box(0.06, 0.4, 0.06, d, { y: 2.75, x: 0.15, rz: 0.8 }));
  g.add(cyl(0.012, 0.012, 0.2, metal(), { x: 0.75, y: 2.75, seg: 4 }));
  g.add(cyl(0.16, 0.12, 0.08, metal(), { x: 0.75, y: 2.63, seg: 8 }));
  const lamp = cyl(0.12, 0.12, 0.3, glowMat(0xffb050, 2.4), { x: 0.75, y: 2.45, seg: 8 });
  g.add(lamp);
  g.add(cyl(0.14, 0.14, 0.05, metal(), { x: 0.75, y: 2.28, seg: 8 }));
  const out = bake(g, 'lantern_post');
  out.userData.collider = { r: 0.15, h: 3 };
  out.userData.light = { x: 0.75, y: 2.4, z: 0, color: 0xffa040, intensity: 6, distance: 14 };
  return out;
}

export function buildFence() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xb09880 });
  for (const x of [-1.5, 1.5]) g.add(box(0.14, 1.2, 0.14, d, { x, y: 0.6 }));
  g.add(box(3.1, 0.1, 0.06, d, { y: 0.95 }));
  g.add(box(3.1, 0.1, 0.06, d, { y: 0.5, rz: 0.03 }));
  const out = bake(g, 'fence');
  out.userData.collider = { box: [1.55, 0.1], h: 1.2 };
  return out;
}

export function buildTable() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0xc8a888 });
  const d = texMat('woodDark');
  g.add(box(1.8, 0.08, 0.95, p, { y: 0.78 }));
  for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) g.add(box(0.08, 0.76, 0.08, d, { x, y: 0.38, z }));
  // A few things on the table.
  g.add(cyl(0.05, 0.04, 0.14, colorMat(0x8a7050), { x: 0.4, y: 0.89, z: 0.1, seg: 8 }));
  g.add(cyl(0.14, 0.12, 0.03, colorMat(0xd8d0c0), { x: -0.3, y: 0.84, z: -0.1, seg: 12 }));
  const out = bake(g, 'table');
  out.userData.collider = { box: [0.92, 0.5], h: 0.85 };
  return out;
}

export function buildChair() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xc0a080 });
  g.add(box(0.48, 0.06, 0.46, d, { y: 0.46 }));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(box(0.05, 0.46, 0.05, d, { x, y: 0.23, z }));
  g.add(box(0.48, 0.5, 0.05, d, { y: 0.74, z: -0.21 }));
  const out = bake(g, 'chair');
  out.userData.collider = { r: 0.3, h: 0.5 };
  return out;
}

export function buildStool() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xc0a080 });
  g.add(cyl(0.2, 0.2, 0.06, d, { y: 0.62, seg: 10 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(box(0.04, 0.62, 0.04, d, { x: Math.cos(a) * 0.13, y: 0.31, z: Math.sin(a) * 0.13 }));
  }
  const out = bake(g, 'stool');
  out.userData.collider = { r: 0.22, h: 0.6 };
  return out;
}

export function buildBench() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0xb09070 });
  g.add(box(2, 0.08, 0.4, p, { y: 0.45 }));
  for (const x of [-0.85, 0.85]) g.add(box(0.08, 0.45, 0.36, texMat('woodDark'), { x, y: 0.22 }));
  const out = bake(g, 'bench');
  out.userData.collider = { box: [1, 0.22], h: 0.5 };
  return out;
}

export function buildBed() {
  const g = new THREE.Group();
  const d = texMat('woodDark');
  g.add(box(1.1, 0.35, 2.1, d, { y: 0.18 }));
  g.add(box(1.0, 0.16, 2.0, colorMat(0xd8ccb0), { y: 0.42 }));
  g.add(box(1.02, 0.1, 1.3, texMat('cloth', { color: 0x8a4a3a }), { y: 0.52, z: 0.3 }));
  g.add(box(0.6, 0.12, 0.35, colorMat(0xe8e0d0), { y: 0.55, z: -0.75 }));
  g.add(box(1.1, 0.8, 0.08, d, { y: 0.4, z: -1.05 }));
  const out = bake(g, 'bed');
  out.userData.collider = { box: [0.56, 1.06], h: 0.6 };
  return out;
}

export function buildShelf() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xb09070 });
  for (const x of [-0.9, 0.9]) g.add(box(0.06, 2, 0.4, d, { x, y: 1 }));
  const rnd = mulberry32(31);
  const jars = [0x6a8a5a, 0x8a5a4a, 0x5a6a9a, 0xb09a5a, 0x7a5a8a];
  for (const y of [0.1, 0.65, 1.2, 1.75]) {
    g.add(box(1.86, 0.05, 0.4, d, { y }));
    if (y < 1.7) {
      for (let i = 0; i < 5; i++) {
        const h = 0.15 + rnd() * 0.2;
        g.add(cyl(0.06 + rnd() * 0.04, 0.07, h, colorMat(jars[(i + Math.floor(y * 3)) % jars.length], { rough: 0.3 }), { x: -0.7 + i * 0.35 + rnd() * 0.1, y: y + 0.03 + h / 2, z: (rnd() - 0.5) * 0.15, seg: 8 }));
      }
    }
  }
  const out = bake(g, 'shelf');
  out.userData.collider = { box: [0.95, 0.22], h: 2 };
  return out;
}

export function buildBookshelf() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xa08060 });
  g.add(box(1.6, 2.1, 0.08, d, { y: 1.05, z: -0.18 }));
  for (const x of [-0.78, 0.78]) g.add(box(0.06, 2.1, 0.42, d, { x, y: 1.05 }));
  const rnd = mulberry32(37);
  const cols = [0x7a2a2a, 0x2a4a6a, 0x3a5a2a, 0x6a5a2a, 0x4a2a4a, 0x8a6a3a];
  for (const y of [0.08, 0.6, 1.12, 1.64]) {
    g.add(box(1.56, 0.05, 0.4, d, { y }));
    let x = -0.72;
    while (x < 0.68) {
      const w = 0.05 + rnd() * 0.05, h = 0.3 + rnd() * 0.14;
      g.add(box(w, h, 0.28, colorMat(cols[Math.floor(rnd() * cols.length)]), { x: x + w / 2, y: y + 0.03 + h / 2, z: 0.02, rz: rnd() < 0.1 ? 0.2 : 0 }));
      x += w + 0.01;
    }
  }
  const out = bake(g, 'bookshelf');
  out.userData.collider = { box: [0.82, 0.24], h: 2.1 };
  return out;
}

export function buildCounter() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0xa88868 });
  const d = texMat('woodDark');
  g.add(box(4, 1.0, 0.7, p, { y: 0.5 }));
  g.add(box(4.1, 0.08, 0.85, d, { y: 1.04 }));
  for (let i = 0; i < 4; i++) g.add(cyl(0.05, 0.045, 0.16, colorMat(0x6a8aa0, { rough: 0.2, transparent: true, opacity: 0.8 }), { x: -1.4 + i * 0.35, y: 1.16, z: 0.1, seg: 8 }));
  const out = bake(g, 'counter');
  out.userData.collider = { box: [2.05, 0.43], h: 1.1 };
  return out;
}

export function buildHearth() {
  const g = new THREE.Group();
  const s = texMat('stone', { color: 0xa09890 });
  g.add(box(2.2, 1.3, 0.9, s, { y: 0.65 }));
  g.add(box(1.2, 0.8, 0.5, colorMat(0x1a1410), { y: 0.5, z: 0.25 }));
  g.add(box(2.4, 0.15, 1.0, s, { y: 1.35 }));
  g.add(box(1.0, 1.6, 0.7, s, { y: 2.2, z: -0.1 }));
  for (let i = 0; i < 3; i++) g.add(cyl(0.06, 0.06, 0.7, texMat('bark'), { x: (i - 1) * 0.15, y: 0.18, z: 0.3, rz: Math.PI / 2, ry: i * 0.5, seg: 6 }));
  const fire = cone(0.25, 0.5, colorMat(0xff8a30, { emissive: 0xff6a10, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 }), { y: 0.42, z: 0.3 });
  fire.userData.keep = true;
  fire.name = 'flame';
  g.add(fire);
  const out = bake(g, 'hearth');
  out.userData.collider = { box: [1.15, 0.5], h: 3 };
  out.userData.light = { x: 0, y: 0.7, z: 0.8, color: 0xff7a30, intensity: 10, distance: 12, flicker: true };
  return out;
}

export function buildFishRack() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xb0a080 });
  for (const x of [-1.2, 1.2]) {
    g.add(box(0.08, 2, 0.08, d, { x, y: 0.95, z: 0.35, rx: 0.3 }));
    g.add(box(0.08, 2, 0.08, d, { x, y: 0.95, z: -0.35, rx: -0.3 }));
  }
  g.add(box(2.6, 0.06, 0.06, d, { y: 1.85 }));
  const fishM = colorMat(0x9aa8a8, { rough: 0.4, metal: 0.2 });
  for (let i = 0; i < 6; i++) g.add(sphere(0.08, fishM, { x: -1 + i * 0.4, y: 1.55, sy: 2.6, sz: 0.4 }));
  const out = bake(g, 'fish_rack');
  out.userData.collider = { box: [1.3, 0.5], h: 2 };
  return out;
}

export function buildRowboat() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0x9a8268 });
  const shape = new THREE.Shape();
  shape.moveTo(0, 2.1);
  shape.quadraticCurveTo(0.9, 0.8, 0.75, -1.6);
  shape.lineTo(-0.75, -1.6);
  shape.quadraticCurveTo(-0.9, 0.8, 0, 2.1);
  const hull = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  hull.rotateX(Math.PI / 2);
  hull.translate(0, 0.6, 0);
  g.add(new THREE.Mesh(hull, p));
  g.add(box(1.3, 0.06, 0.3, texMat('woodDark'), { y: 0.62, z: 0.2 }));
  g.add(box(1.2, 0.06, 0.3, texMat('woodDark'), { y: 0.62, z: -0.9 }));
  g.add(box(0.06, 0.06, 2.2, texMat('woodDark'), { x: 0.5, y: 0.7, z: 0.4, ry: 0.15 }));
  const out = bake(g, 'rowboat');
  out.userData.collider = { box: [0.85, 1.9], h: 0.8 };
  return out;
}

export function buildCampfire() {
  const g = new THREE.Group();
  const st = texMat('rock', { color: 0x9a9088 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(sphere(0.16, st, { x: Math.cos(a) * 0.55, y: 0.06, z: Math.sin(a) * 0.55, sy: 0.6 }));
  }
  for (let i = 0; i < 4; i++) g.add(cyl(0.06, 0.06, 0.8, texMat('bark'), { y: 0.15, rz: Math.PI / 2 - 0.4, ry: (i / 4) * Math.PI, seg: 6 }));
  const fire = cone(0.32, 0.7, colorMat(0xff8a30, { emissive: 0xff6010, emissiveIntensity: 2.8, transparent: true, opacity: 0.85 }), { y: 0.45 });
  fire.userData.keep = true;
  fire.name = 'flame';
  g.add(fire);
  const out = bake(g, 'campfire');
  out.userData.collider = { r: 0.7, h: 0.4 };
  out.userData.light = { x: 0, y: 0.8, z: 0, color: 0xff7a30, intensity: 12, distance: 16, flicker: true };
  return out;
}

export function buildTent({ color = 0x6a7a6a } = {}) {
  const g = new THREE.Group();
  const c = texMat('cloth', { color, side: THREE.DoubleSide });
  const w = 3, h = 2.2, d = 3.6;
  const slope = Math.hypot(w / 2, h);
  const ang = Math.atan2(h, w / 2);
  g.add(box(slope, 0.03, d, c, { x: -w / 4, y: h / 2, rz: ang }));
  g.add(box(slope, 0.03, d, c, { x: w / 4, y: h / 2, rz: -ang }));
  g.add(box(0.08, h + 0.2, 0.08, texMat('woodDark'), { y: h / 2, z: d / 2 }));
  g.add(box(0.08, h + 0.2, 0.08, texMat('woodDark'), { y: h / 2, z: -d / 2 }));
  g.add(box(2.4, 0.15, 1.0, colorMat(0x6a5040), { y: 0.08, z: -0.6 }));
  const out = bake(g, 'tent');
  out.userData.collider = { box: [1.5, 1.8], h: 2.2 };
  return out;
}

export function buildSignpost() {
  const g = new THREE.Group();
  const d = texMat('woodDark', { color: 0xb09878 });
  g.add(box(0.14, 2.6, 0.14, d, { y: 1.3 }));
  g.add(box(1.2, 0.26, 0.05, texMat('planks'), { x: 0.5, y: 2.2, rz: 0.05 }));
  g.add(box(1.1, 0.26, 0.05, texMat('planks'), { x: -0.45, y: 1.85, ry: 0.4, rz: -0.04 }));
  const out = bake(g, 'signpost');
  out.userData.collider = { r: 0.15, h: 2.6 };
  return out;
}

export function buildWell() {
  const g = new THREE.Group();
  const s = texMat('stone', { color: 0xa8a098 });
  g.add(cyl(1.0, 1.05, 0.9, s, { y: 0.45, seg: 16, open: true }));
  g.add(cyl(0.95, 0.95, 0.1, colorMat(0x1a2a30), { y: 0.3, seg: 16 }));
  g.add(cyl(1.08, 1.08, 0.12, s, { y: 0.92, seg: 16, open: true }));
  const d = texMat('woodDark');
  for (const x of [-0.95, 0.95]) g.add(box(0.12, 2.0, 0.12, d, { x, y: 1.4 }));
  g.add(cyl(0.07, 0.07, 2.0, d, { y: 2.1, rz: Math.PI / 2, seg: 8 }));
  g.add(box(2.4, 0.06, 1.2, texMat('roof'), { y: 2.6, x: 0, rz: 0 }));
  g.add(cyl(0.18, 0.15, 0.25, texMat('planks'), { y: 1.3, seg: 8 }));
  const out = bake(g, 'well');
  out.children.forEach((c) => (c.material.side = THREE.DoubleSide));
  out.userData.collider = { r: 1.1, h: 1.0 };
  return out;
}

export function buildBones() {
  const g = new THREE.Group();
  const b = colorMat(0xe0d8c0, { rough: 0.8 });
  const rnd = mulberry32(41);
  g.add(sphere(0.12, b, { y: 0.1, sy: 1.1, x: 0.3 }));
  for (let i = 0; i < 7; i++) g.add(capsule(0.025, 0.4, b, { x: (rnd() - 0.5) * 1, y: 0.04, z: (rnd() - 0.5) * 1, rz: Math.PI / 2, ry: rnd() * 3 }));
  for (let i = 0; i < 4; i++) g.add(cyl(0.25, 0.25, 0.03, b, { y: 0.1 + i * 0.02, z: -0.2 + i * 0.1, thetaLength: Math.PI, seg: 8, rx: Math.PI / 2 }));
  return bake(g, 'bones');
}

export function buildAltar() {
  const g = new THREE.Group();
  const s = texMat('stone', { color: 0x8a9090 });
  g.add(box(2.2, 0.9, 1.2, s, { y: 0.45 }));
  g.add(box(2.5, 0.15, 1.4, s, { y: 0.97 }));
  const eye = sphere(0.22, colorMat(0x7af8ff, { emissive: 0x40e0e0, emissiveIntensity: 2 }), { y: 1.25, sz: 0.5 });
  eye.userData.keep = true;
  g.add(eye);
  for (const x of [-0.9, 0.9]) g.add(cyl(0.08, 0.1, 0.25, colorMat(0xe0d8c0), { x, y: 1.17, seg: 8 }));
  const out = bake(g, 'altar');
  out.userData.collider = { box: [1.25, 0.7], h: 1.1 };
  return out;
}

function eyeBannerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#163232'; ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = '#4ad8c8'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(64, 100, 44, 24, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#4ad8c8'; ctx.beginPath(); ctx.arc(64, 100, 12, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(30 + i * 17, 130); ctx.quadraticCurveTo(36 + i * 17, 180, 26 + i * 17, 230); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _bannerMat;
export function buildBanner() {
  const g = new THREE.Group();
  if (!_bannerMat) _bannerMat = new THREE.MeshStandardMaterial({ map: eyeBannerTexture(), side: THREE.DoubleSide, roughness: 0.9 });
  const d = texMat('woodDark');
  g.add(box(0.1, 3.6, 0.1, d, { y: 1.8 }));
  g.add(box(1.0, 0.07, 0.07, d, { y: 3.4, x: 0.0 }));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8, 1, 6), _bannerMat);
  cloth.position.set(0, 2.45, 0.06);
  g.add(cloth);
  const out = bake(g, 'banner');
  out.userData.collider = { r: 0.12, h: 3.6 };
  return out;
}

export function buildPillar({ broken = true, seed = 51 } = {}) {
  const g = new THREE.Group();
  const s = texMat('stone', { color: 0x9a9a98 });
  const rnd = mulberry32(seed);
  const h = broken ? 1.5 + rnd() * 2.5 : 4.5;
  g.add(box(1.0, 0.3, 1.0, s, { y: 0.15 }));
  g.add(cyl(0.38, 0.42, h, s, { y: 0.3 + h / 2, seg: 10 }));
  if (!broken) g.add(box(1.0, 0.3, 1.0, s, { y: 0.45 + h }));
  else g.add(cyl(0.3, 0.38, 0.3, s, { y: 0.3 + h + 0.1, rz: 0.4, seg: 7 }));
  const out = bake(g, 'pillar');
  out.userData.collider = { r: 0.5, h: h + 0.5 };
  return out;
}

export function buildCart() {
  const g = new THREE.Group();
  const p = texMat('planks', { color: 0xb09070 });
  const d = texMat('woodDark');
  g.add(box(1.5, 0.1, 2.4, p, { y: 0.75 }));
  for (const x of [-0.72, 0.72]) g.add(box(0.06, 0.4, 2.4, p, { x, y: 0.98 }));
  g.add(box(1.5, 0.4, 0.06, p, { y: 0.98, z: -1.18 }));
  for (const x of [-0.82, 0.82]) {
    const wheel = cyl(0.5, 0.5, 0.1, d, { x, y: 0.5, z: -0.3, rz: Math.PI / 2, seg: 12 });
    g.add(wheel);
  }
  for (const x of [-0.4, 0.4]) g.add(box(0.07, 0.07, 1.8, d, { x, y: 0.6, z: 1.9, rx: 0.15 }));
  g.add(box(1.0, 0.4, 0.8, texMat('cloth', { color: 0xb8a070 }), { y: 1.0, z: 0.3 }));
  const out = bake(g, 'cart');
  out.userData.collider = { box: [0.85, 1.4], h: 1.2 };
  return out;
}

export function buildSack() {
  const g = new THREE.Group();
  g.add(sphere(0.32, texMat('cloth', { color: 0xc0a878 }), { y: 0.3, sy: 1.2 }));
  g.add(cyl(0.08, 0.12, 0.12, texMat('cloth', { color: 0xa89060 }), { y: 0.68, seg: 8 }));
  const out = bake(g, 'sack');
  out.userData.collider = { r: 0.32, h: 0.7 };
  return out;
}

export function buildRug() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a2a22'; ctx.fillRect(0, 0, 128, 192);
  ctx.strokeStyle = '#d0a050'; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 108, 172);
  ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 3; ctx.strokeRect(22, 22, 84, 148);
  ctx.fillStyle = '#d0a050';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(64, 40 + i * 28); ctx.lineTo(78, 54 + i * 28); ctx.lineTo(64, 68 + i * 28); ctx.lineTo(50, 54 + i * 28); ctx.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.userData.noShadow = true;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function buildSpireEye() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 32), colorMat(0x2a3a4a, { metal: 0.6, rough: 0.3 }));
  g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 32), colorMat(0x40e0e0, { emissive: 0x40e0e0, emissiveIntensity: 1.5 }));
  g.add(ring2);
  const eye = sphere(0.6, colorMat(0xd0ffff, { emissive: 0x60f0ff, emissiveIntensity: 2.2 }), { sz: 0.5 });
  g.add(eye);
  g.add(sphere(0.25, colorMat(0x050a10), { z: 0.28, sz: 0.4 }));
  g.children.forEach((c) => (c.userData.keep = true));
  g.userData.light = { x: 0, y: 0, z: 0, color: 0x40e0e0, intensity: 14, distance: 26 };
  return g;
}

export function buildScrollPickup() {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 0.35, colorMat(0xe8dcc0), { y: 0.06, rz: Math.PI / 2, seg: 8 }));
  g.add(cyl(0.02, 0.02, 0.06, colorMat(0xa02020), { y: 0.06, seg: 6 }));
  return g;
}

// ---------------------------------------------------------------- weapons (grip at origin, pointing +Y)
export function buildSword({ blade = 0xb8c0c8, hilt = 0x6a4a2a, guard = 0x8a7040, length = 0.85, glow = null } = {}) {
  const g = new THREE.Group();
  const bm = glow ? colorMat(blade, { rough: 0.25, metal: 0.8, emissive: glow, emissiveIntensity: 0.9 }) : colorMat(blade, { rough: 0.25, metal: 0.85 });
  g.add(box(0.035, 0.18, 0.035, colorMat(hilt), { y: 0.0 }));
  g.add(sphere(0.035, colorMat(guard, { metal: 0.7, rough: 0.3 }), { y: -0.11 }));
  g.add(box(0.22, 0.035, 0.05, colorMat(guard, { metal: 0.7, rough: 0.3 }), { y: 0.1 }));
  g.add(box(0.06, length, 0.012, bm, { y: 0.12 + length / 2 }));
  g.add(cone(0.03, 0.08, bm, { y: 0.12 + length + 0.04, seg: 4, rx: 0 }));
  return g;
}
export function buildAxe({ head = 0x9aa0a8, haft = 0x7a5a3a } = {}) {
  const g = new THREE.Group();
  g.add(cyl(0.022, 0.026, 0.75, colorMat(haft), { y: 0.25, seg: 6 }));
  const hm = colorMat(head, { metal: 0.8, rough: 0.3 });
  g.add(box(0.03, 0.2, 0.2, hm, { y: 0.55, z: 0.1 }));
  g.add(cyl(0.12, 0.12, 0.03, hm, { y: 0.55, z: 0.2, rz: Math.PI / 2, thetaLength: Math.PI, seg: 10, ry: Math.PI / 2 }));
  return g;
}
export function buildMace({ head = 0x8a8a90, haft = 0x5a4030 } = {}) {
  const g = new THREE.Group();
  g.add(cyl(0.022, 0.026, 0.65, colorMat(haft), { y: 0.2, seg: 6 }));
  const hm = colorMat(head, { metal: 0.8, rough: 0.35 });
  g.add(sphere(0.09, hm, { y: 0.55 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cone(0.03, 0.08, hm, { x: Math.cos(a) * 0.09, y: 0.55, z: Math.sin(a) * 0.09, rz: -Math.cos(a) * 1.57, rx: Math.sin(a) * 1.57 }));
  }
  return g;
}
export function buildDagger({ blade = 0xc0c8d0, hilt = 0x3a2a2a, glow = null } = {}) {
  const g = new THREE.Group();
  const bm = glow ? colorMat(blade, { rough: 0.25, metal: 0.8, emissive: glow, emissiveIntensity: 1 }) : colorMat(blade, { rough: 0.2, metal: 0.85 });
  g.add(box(0.03, 0.12, 0.03, colorMat(hilt)));
  g.add(box(0.12, 0.025, 0.04, colorMat(0x7a6040, { metal: 0.6 }), { y: 0.07 }));
  g.add(box(0.045, 0.3, 0.01, bm, { y: 0.23 }));
  g.add(cone(0.022, 0.06, bm, { y: 0.41, seg: 4 }));
  return g;
}
export function buildStaff({ wood = 0x6a5038, orb = 0x60c0ff, crystal = false } = {}) {
  const g = new THREE.Group();
  const wm = texMat('bark', { color: wood });
  g.add(cyl(0.025, 0.032, 1.7, wm, { y: 0.15, seg: 6 }));
  for (let i = 0; i < 3; i++) g.add(cyl(0.035, 0.022, 0.25, wm, { y: 1.02, x: Math.cos(i * 2.1) * 0.05, z: Math.sin(i * 2.1) * 0.05, rz: Math.cos(i * 2.1) * 0.4, rx: Math.sin(i * 2.1) * 0.4, seg: 5 }));
  const om = colorMat(orb, { emissive: orb, emissiveIntensity: 1.8, rough: 0.2 });
  const o = crystal ? cone(0.07, 0.28, om, { y: 1.2, seg: 5 }) : sphere(0.075, om, { y: 1.15 });
  g.add(o);
  return g;
}
export function buildShield({ face = 0x8a5a3a, rim = 0x7a7a80, boss = 0xa08a50, shell = false } = {}) {
  const g = new THREE.Group();
  const fm = shell ? colorMat(0xa85a3a, { rough: 0.5 }) : texMat('planks', { color: face });
  const s = cyl(0.33, 0.33, 0.05, fm, { rx: Math.PI / 2, seg: 16 });
  g.add(s);
  g.add(cyl(0.35, 0.35, 0.04, colorMat(rim, { metal: 0.7, rough: 0.4 }), { rx: Math.PI / 2, seg: 16, open: true }));
  g.add(sphere(0.08, colorMat(boss, { metal: 0.8, rough: 0.3 }), { z: 0.03, sz: 0.6 }));
  if (shell) for (let i = 0; i < 5; i++) g.add(cone(0.04, 0.08, colorMat(0x8a4a2a), { x: (i - 2) * 0.1, y: 0.15 - Math.abs(i - 2) * 0.05, z: 0.04, rx: Math.PI / 2 }));
  return g;
}
