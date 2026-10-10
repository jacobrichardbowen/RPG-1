// Procedural vegetation and rocks. All face +Z, base at y = 0, sized in meters.
import * as THREE from 'three';
import { texMat, colorMat, box, sphere, cyl, cone, deform, bake } from './geo.js';
import { Simplex, mulberry32 } from '../../core/noise.js';

const noise = new Simplex(4242);

function tube(points, radiusFn, mat, segs = 24, radial = 9) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  // Taper: scale each ring by radiusFn(t).
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = radiusFn(t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2);
  return new THREE.Mesh(geo, mat);
}

function blob(r, mat, seed, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 1, amp = 0.25 } = {}) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  deform(geo, (v) => {
    const n = noise.noise(v.x * 1.7 + seed, v.y * 1.7 + v.z * 1.3 - seed);
    v.multiplyScalar(1 + n * amp);
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

export function buildGiantMushroom({ height = 11, seed = 1, capColor = 0xb88a66 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const stalkM = colorMat(0xd8c8a8, { rough: 0.9 });
  const lean = (rnd() - 0.5) * 2.5;
  const pts = [[0, 0, 0], [lean * 0.2, height * 0.3, 0.3], [lean * 0.7, height * 0.65, -0.2], [lean, height, 0]];
  g.add(tube(pts, (t) => 0.75 * (1 - t * 0.55) + (t < 0.08 ? (0.08 - t) * 6 : 0), stalkM, 20, 10));
  const top = new THREE.Vector3(lean, height, 0);
  const capR = height * 0.42;
  const capM = texMat('cap', { color: capColor, rough: 0.8 });
  const gillM = colorMat(0x7a5a48, { rough: 1, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), capM);
  cap.scale.y = 0.42;
  cap.position.copy(top).add(new THREE.Vector3(0, -capR * 0.3, 0));
  g.add(cap);
  const gill = new THREE.Mesh(new THREE.CircleGeometry(capR * 0.99 * Math.sin(Math.PI * 0.42), 22), gillM);
  gill.rotation.x = Math.PI / 2;
  gill.position.copy(top).add(new THREE.Vector3(0, -capR * 0.3 + capR * 0.42 * Math.cos(Math.PI * 0.42), 0));
  g.add(gill);
  // Shelf fungi on the stalk.
  const shelfM = colorMat(0xc8a070, { rough: 0.8 });
  for (let i = 0; i < 3; i++) {
    const t = 0.25 + rnd() * 0.5;
    const a = rnd() * Math.PI * 2;
    const r = 0.75 * (1 - t * 0.55);
    g.add(sphere(0.5 + rnd() * 0.4, shelfM, { x: lean * t + Math.cos(a) * r, y: height * t, z: Math.sin(a) * r, sy: 0.25, thetaLength: Math.PI * 0.5 }));
  }
  const out = bake(g, 'giant_mushroom');
  out.userData.collider = { r: 0.8 };
  return out;
}

export function buildSmallMushroom({ seed = 2 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const stalkM = colorMat(0xe0d4b8);
  const capM = texMat('cap', { color: 0xa87858, rough: 0.8 });
  for (let i = 0; i < 3; i++) {
    const h = 0.8 + rnd() * 1.6, x = (rnd() - 0.5) * 1.4, z = (rnd() - 0.5) * 1.4;
    g.add(cyl(0.09 * h, 0.13 * h, h, stalkM, { x, y: h / 2, z, seg: 8 }));
    g.add(sphere(0.45 * h, capM, { x, y: h, z, sy: 0.45, thetaLength: Math.PI * 0.5, wseg: 12, hseg: 6 }));
  }
  return bake(g, 'small_mushroom');
}

export function buildSwampTree({ height = 9, seed = 3 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const barkM = texMat('bark', { color: 0x9a8a78 });
  const leafM = colorMat(0x4a5e2c, { rough: 0.95, flat: true });
  const leafM2 = colorMat(0x5d6d34, { rough: 0.95, flat: true });
  const mossM = colorMat(0x7d8a6a, { rough: 1, side: THREE.DoubleSide });
  const pts = [[0, 0, 0]];
  let x = 0, z = 0;
  for (let i = 1; i <= 4; i++) {
    x += (rnd() - 0.5) * 1.6; z += (rnd() - 0.5) * 1.6;
    pts.push([x, (height * 0.7 * i) / 4, z]);
  }
  g.add(tube(pts, (t) => 0.55 * (1 - t * 0.7) + (t < 0.1 ? (0.1 - t) * 4 : 0), barkM, 16, 8));
  const top = pts[pts.length - 1];
  // Roots
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    g.add(tube([[0, 0.8, 0], [Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9], [Math.cos(a) * 1.6, -0.3, Math.sin(a) * 1.6]], (t) => 0.22 * (1 - t * 0.7), barkM, 6, 6));
  }
  const crowns = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd() * 0.8;
    const len = 2 + rnd() * 2;
    const end = [top[0] + Math.cos(a) * len, top[1] + 0.8 + rnd() * 1.6, top[2] + Math.sin(a) * len];
    g.add(tube([top, [(top[0] + end[0]) / 2, end[1] - 0.6, (top[2] + end[2]) / 2], end], (t) => 0.22 * (1 - t * 0.7), barkM, 8, 6));
    crowns.push(end);
  }
  crowns.push([top[0], top[1] + 2.2, top[2]]);
  crowns.forEach((c, i) => {
    g.add(blob(1.6 + rnd() * 0.9, i % 2 ? leafM : leafM2, i + seed, { x: c[0], y: c[1] + 0.4, z: c[2], sy: 0.6, amp: 0.3 }));
    for (let m = 0; m < 3; m++) {
      const mh = 1 + rnd() * 1.6;
      g.add(box(0.25, mh, 0.01, mossM, { x: c[0] + (rnd() - 0.5) * 2, y: c[1] - mh / 2 - 0.1, z: c[2] + (rnd() - 0.5) * 2, ry: rnd() * 3 }));
    }
  });
  const out = bake(g, 'swamp_tree');
  out.userData.collider = { r: 0.6 };
  out.userData.sway = 0.35;
  return out;
}

export function buildDeadTree({ height = 6, seed = 4 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const barkM = texMat('bark', { color: 0x8a8278 });
  g.add(tube([[0, 0, 0], [0.3, height * 0.5, 0.2], [-0.2, height, 0]], (t) => 0.35 * (1 - t * 0.8), barkM, 10, 7));
  for (let i = 0; i < 5; i++) {
    const y = height * (0.4 + rnd() * 0.5), a = rnd() * Math.PI * 2, len = 1 + rnd() * 2;
    g.add(tube([[0, y, 0], [Math.cos(a) * len * 0.6, y + 0.5, Math.sin(a) * len * 0.6], [Math.cos(a) * len, y + 1.2 + rnd(), Math.sin(a) * len]], (t) => 0.12 * (1 - t * 0.8), barkM, 5, 5));
  }
  const out = bake(g, 'dead_tree');
  out.userData.collider = { r: 0.4 };
  return out;
}

export function buildRock({ size = 1, seed = 5, flat = 0.7, color = 0xb0a898 } = {}) {
  const mat = texMat('rock', { color });
  const geo = new THREE.IcosahedronGeometry(size, 2);
  deform(geo, (v) => {
    const n = noise.fbm(v.x * 0.9 / size + seed, v.z * 0.9 / size + v.y * 0.5, 3);
    v.multiplyScalar(1 + n * 0.32);
    v.y *= flat;
    if (v.y < 0) v.y *= 0.4;
  });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = size * 0.25;
  const g = new THREE.Group();
  g.add(mesh);
  const out = bake(g, 'rock');
  out.userData.collider = { r: size * 0.85 };
  return out;
}

function bladeTuft(count, height, colors, spread, seed, width = 0.06) {
  const rnd = mulberry32(seed);
  const pos = [], col = [];
  const base = new THREE.Color(colors[0]), tip = new THREE.Color(colors[1]);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * spread;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = height * (0.6 + rnd() * 0.6);
    const lean = (rnd() - 0.5) * 0.5;
    const ox = Math.cos(a + 1.57) * width, oz = Math.sin(a + 1.57) * width;
    const tx = x + Math.cos(a) * lean * h, tz = z + Math.sin(a) * lean * h;
    pos.push(x - ox, 0, z - oz, x + ox, 0, z + oz, tx, h, tz);
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.computeVertexNormals();
  // Point normals upward for soft, uniform lighting on thin blades.
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return geo;
}

const vcMats = new Map();
function vertexColorMat(key) {
  let m = vcMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 });
    vcMats.set(key, m);
  }
  return m;
}

export function buildGrassTuft() {
  const mesh = new THREE.Mesh(bladeTuft(22, 0.5, [0x6a7e3a, 0xc4cc74], 0.42, 7, 0.028), vertexColorMat('grass'));
  mesh.userData.noShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.sway = 1;
  return g;
}

export function buildReeds() {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(bladeTuft(16, 1.7, [0x5a6430, 0xc0b470], 0.4, 8, 0.03), vertexColorMat('reeds'));
  mesh.userData.noShadow = true;
  g.add(mesh);
  const rnd = mulberry32(9);
  const cat = colorMat(0x5a3a22);
  const stem = colorMat(0x6a7038);
  const parts = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const x = (rnd() - 0.5) * 0.6, z = (rnd() - 0.5) * 0.6, h = 1.6 + rnd() * 0.8;
    parts.add(cyl(0.012, 0.015, h, stem, { x, y: h / 2, z, seg: 4 }));
    parts.add(capsule2(0.04, 0.22, cat, x, h - 0.05, z));
  }
  const baked = bake(parts);
  baked.children.forEach((c) => g.add(c.clone()));
  g.userData.sway = 1;
  return g;
}

function capsule2(r, len, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 2, 6), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildFern({ seed = 10 } = {}) {
  const rnd = mulberry32(seed);
  const pos = [], col = [];
  const c0 = new THREE.Color(0x2e4a1e), c1 = new THREE.Color(0x6a8a3a);
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.8 + rnd() * 0.5;
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const p = (t) => {
        const d = t * len;
        return [Math.cos(a) * d, Math.sin(t * Math.PI) * 0.45 * len + t * 0.05, Math.sin(a) * d];
      };
      const w0 = Math.sin(t0 * Math.PI) * 0.16 + 0.02, w1 = Math.sin(t1 * Math.PI) * 0.16 + 0.02;
      const P0 = p(t0), P1 = p(t1);
      const ox = -Math.sin(a), oz = Math.cos(a);
      pos.push(P0[0] - ox * w0, P0[1], P0[2] - oz * w0, P0[0] + ox * w0, P0[1], P0[2] + oz * w0, P1[0] + ox * w1, P1[1], P1[2] + oz * w1);
      pos.push(P0[0] - ox * w0, P0[1], P0[2] - oz * w0, P1[0] + ox * w1, P1[1], P1[2] + oz * w1, P1[0] - ox * w1, P1[1], P1[2] - oz * w1);
      for (let k = 0; k < 6; k++) {
        const c = c0.clone().lerp(c1, t0 + 0.2);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, vertexColorMat('fern'));
  m.userData.noShadow = true;
  g.add(m);
  g.userData.sway = 0.6;
  return g;
}

export function buildBush({ seed = 11, color = 0x4d6430 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const m1 = colorMat(color, { rough: 0.95, flat: true });
  const m2 = colorMat(0x5f7038, { rough: 0.95, flat: true });
  const m3 = colorMat(0x3f5226, { rough: 0.95, flat: true });
  const mats = [m1, m2, m3];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.45;
    g.add(blob(0.28 + rnd() * 0.22, mats[i % 3], seed + i, { x: Math.cos(a) * r, y: 0.3 + rnd() * 0.35, z: Math.sin(a) * r, sy: 0.85, detail: 1, amp: 0.35 }));
  }
  const twig = colorMat(0x5a4632);
  for (let i = 0; i < 3; i++) g.add(cyl(0.015, 0.025, 0.5, twig, { x: (rnd() - 0.5) * 0.3, y: 0.2, z: (rnd() - 0.5) * 0.3, rz: (rnd() - 0.5) * 0.6, seg: 4 }));
  const out = bake(g, 'bush');
  out.userData.sway = 0.25;
  return out;
}

export function buildFlowers({ seed = 12 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const stem = colorMat(0x4a6a2a);
  const petals = [colorMat(0xd8c040), colorMat(0xc05a70), colorMat(0xe8e0f0), colorMat(0x8a6ad0)];
  for (let i = 0; i < 9; i++) {
    const x = (rnd() - 0.5) * 1.4, z = (rnd() - 0.5) * 1.4, h = 0.25 + rnd() * 0.3;
    g.add(cyl(0.01, 0.012, h, stem, { x, y: h / 2, z, seg: 4 }));
    g.add(sphere(0.05, petals[i % petals.length], { x, y: h, z, sy: 0.5, wseg: 6, hseg: 4 }));
  }
  const out = bake(g, 'flowers');
  out.children.forEach((c) => (c.userData.noShadow = true));
  out.userData.sway = 0.8;
  return out;
}

export function buildGlowcap() {
  const g = new THREE.Group();
  const stalk = colorMat(0xc8d8e0);
  const capM = colorMat(0x60c8e8, { emissive: 0x40b0ff, emissiveIntensity: 1.2, rough: 0.5 });
  const rnd = mulberry32(13);
  for (let i = 0; i < 5; i++) {
    const x = (rnd() - 0.5) * 0.5, z = (rnd() - 0.5) * 0.5, h = 0.15 + rnd() * 0.3;
    g.add(cyl(0.02, 0.03, h, stalk, { x, y: h / 2, z, seg: 6 }));
    const c = sphere(0.07 + h * 0.2, capM, { x, y: h, z, sy: 0.55, thetaLength: Math.PI * 0.5, wseg: 10, hseg: 5 });
    g.add(c);
  }
  return bake(g, 'glowcap');
}

export function buildLilyPads({ seed = 14 } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const m = colorMat(0x4a7a30, { rough: 0.6, side: THREE.DoubleSide });
  const fm = colorMat(0xf0e0e8, { emissive: 0x302028 });
  for (let i = 0; i < 6; i++) {
    const r = 0.25 + rnd() * 0.25;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 12, 0.3, Math.PI * 2 - 0.3), m);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = rnd() * 6;
    pad.position.set((rnd() - 0.5) * 2.4, 0.02, (rnd() - 0.5) * 2.4);
    g.add(pad);
    if (rnd() < 0.3) g.add(sphere(0.07, fm, { x: pad.position.x, y: 0.06, z: pad.position.z, sy: 0.6 }));
  }
  const out = bake(g, 'lilypads');
  out.children.forEach((c) => (c.userData.noShadow = true));
  return out;
}

export function buildDriftwood({ seed = 15 } = {}) {
  const g = new THREE.Group();
  const m = texMat('bark', { color: 0xb0a898 });
  g.add(tube([[-1.6, 0.15, 0], [-0.3, 0.25, 0.2], [0.8, 0.2, -0.1], [1.8, 0.35, 0.3]], (t) => 0.22 * (1 - t * 0.5), m, 10, 7));
  g.add(tube([[0.4, 0.2, 0], [0.8, 0.5, 0.6], [1.0, 0.9, 1.0]], (t) => 0.08 * (1 - t * 0.6), m, 5, 5));
  return bake(g, 'driftwood');
}

export function buildKelp() {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(bladeTuft(8, 1.2, [0x2a3a1a, 0x5a6a2a], 0.4, 16, 0.08), vertexColorMat('kelp'));
  g.add(mesh);
  g.userData.sway = 0.8;
  return g;
}
