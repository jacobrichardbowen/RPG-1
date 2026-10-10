// Procedural creature placeholders. Each root sets userData.rig.type so the animator
// knows how to move it: 'crab', 'quad', 'bird', 'tentacles'. Humanoid monsters reuse buildHumanoid.
import * as THREE from 'three';
import { colorMat, box, sphere, capsule, cyl, cone, rigidSkin } from './geo.js';
import { buildHumanoid } from './characters.js';

const joint = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

export function buildCrab({ scale = 1, shell = 0x9a4a2e, under = 0xd9b48a, eye = 0x111111, barnacles = false } = {}) {
  const s = scale;
  const root = new THREE.Group();
  const shellM = colorMat(shell, { rough: 0.55 });
  const underM = colorMat(under, { rough: 0.7 });
  const body = joint('body', 0, 0.42 * s, 0);
  root.add(body);
  body.add(sphere(0.42 * s, shellM, { sx: 1.25, sy: 0.5, sz: 0.95, wseg: 16, hseg: 10 }));
  body.add(sphere(0.38 * s, underM, { y: -0.04 * s, sx: 1.2, sy: 0.35, sz: 0.9, thetaStart: Math.PI * 0.5, thetaLength: Math.PI * 0.5 }));
  for (let i = 0; i < 5; i++) body.add(cone(0.05 * s, 0.1 * s, shellM, { x: (i - 2) * 0.16 * s, y: 0.16 * s, z: -0.1 * s + Math.abs(i - 2) * 0.05 * s }));
  if (barnacles) {
    const bm = colorMat(0xc8c0b0, { rough: 1 });
    for (let i = 0; i < 9; i++) body.add(cyl(0.035 * s, 0.05 * s, 0.05 * s, bm, { x: Math.sin(i * 2.3) * 0.35 * s, y: 0.17 * s, z: Math.cos(i * 1.7) * 0.25 * s, seg: 6 }));
  }
  for (const sx of [-1, 1]) {
    const stalk = cyl(0.018 * s, 0.022 * s, 0.16 * s, underM, { x: sx * 0.12 * s, y: 0.16 * s, z: 0.3 * s, seg: 6 });
    body.add(stalk);
    body.add(sphere(0.04 * s, colorMat(eye, { rough: 0.2 }), { x: sx * 0.12 * s, y: 0.25 * s, z: 0.3 * s }));
  }
  // Legs: 3 per side.
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    for (let i = 0; i < 3; i++) {
      const leg = joint(`leg_${side}${i}`, sx * 0.4 * s, -0.02 * s, (0.12 - i * 0.2) * s);
      leg.rotation.y = sx * (Math.PI / 2) + (i - 1) * 0.35 * sx;
      body.add(leg);
      leg.add(capsule(0.035 * s, 0.3 * s, shellM, { z: 0.17 * s, rx: Math.PI / 2 - 0.5 }));
      const lower = joint(`legl_${side}${i}`, 0, 0.13 * s, 0.32 * s);
      leg.add(lower);
      lower.add(capsule(0.028 * s, 0.38 * s, shellM, { y: -0.22 * s, z: 0.06 * s, rx: 0.25 }));
    }
    // Claws
    const arm = joint(`claw_${side}`, sx * 0.3 * s, 0.02 * s, 0.32 * s);
    body.add(arm);
    arm.rotation.y = sx * 0.4;
    arm.add(capsule(0.05 * s, 0.22 * s, shellM, { z: 0.15 * s, rx: Math.PI / 2 }));
    const pincer = joint(`pincer_${side}`, 0, 0, 0.32 * s);
    arm.add(pincer);
    pincer.add(sphere(0.12 * s, shellM, { z: 0.08 * s, sx: 0.8, sy: 0.6, sz: 1.2 }));
    const jaw = joint(`jaw_${side}`, 0, -0.02 * s, 0.14 * s);
    pincer.add(jaw);
    jaw.add(cone(0.06 * s, 0.22 * s, underM, { z: 0.1 * s, rx: Math.PI / 2 }));
    pincer.add(cone(0.07 * s, 0.24 * s, shellM, { y: 0.04 * s, z: 0.22 * s, rx: Math.PI / 2 }));
  }
  root.userData.rig = { type: 'crab', bodyY: 0.42 * s };
  return rigidSkin(root);
}

export function buildQuadruped({ scale = 1, hide = 0x5a6a4a, belly = 0x9a9a7a, stripe = 0x3a4430, eye = 0xd0a020, spines = 0x6a4a3a } = {}) {
  const s = scale;
  const root = new THREE.Group();
  const hm = colorMat(hide, { rough: 0.8 });
  const bm = colorMat(belly, { rough: 0.85 });
  const sm = colorMat(stripe, { rough: 0.85 });
  const body = joint('body', 0, 0.72 * s, 0);
  root.add(body);
  body.add(capsule(0.3 * s, 0.75 * s, hm, { rx: Math.PI / 2, sx: 1, sy: 1, sz: 0.9 }));
  body.add(capsule(0.24 * s, 0.6 * s, bm, { y: -0.1 * s, rx: Math.PI / 2 }));
  for (let i = 0; i < 4; i++) body.add(box(0.5 * s, 0.05 * s, 0.07 * s, sm, { y: 0.22 * s, z: (0.3 - i * 0.2) * s, rx: 0.1 }));
  const spm = colorMat(spines, { rough: 0.7 });
  for (let i = 0; i < 6; i++) body.add(cone(0.04 * s, 0.18 * s, spm, { y: 0.3 * s, z: (0.4 - i * 0.16) * s, rx: -0.4 }));
  const neck = joint('neck', 0, 0.1 * s, 0.55 * s);
  body.add(neck);
  neck.rotation.x = -0.35;
  neck.add(capsule(0.16 * s, 0.25 * s, hm, { z: 0.15 * s, rx: Math.PI / 2 }));
  const head = joint('head', 0, 0.02 * s, 0.38 * s);
  neck.add(head);
  head.add(box(0.28 * s, 0.2 * s, 0.34 * s, hm, { z: 0.08 * s }));
  head.add(box(0.2 * s, 0.1 * s, 0.24 * s, hm, { y: 0.0, z: 0.32 * s }));
  for (const sx of [-1, 1]) {
    head.add(sphere(0.035 * s, colorMat(eye, { emissive: eye, emissiveIntensity: 0.8 }), { x: sx * 0.12 * s, y: 0.06 * s, z: 0.2 * s }));
    head.add(cone(0.04 * s, 0.14 * s, spm, { x: sx * 0.1 * s, y: 0.12 * s, z: 0.0, rx: -0.9 }));
  }
  const jaw = joint('jaw', 0, -0.08 * s, 0.14 * s);
  head.add(jaw);
  jaw.add(box(0.18 * s, 0.06 * s, 0.3 * s, bm, { z: 0.14 * s }));
  for (let i = 0; i < 4; i++) jaw.add(cone(0.015 * s, 0.05 * s, colorMat(0xeee8d0), { x: (i - 1.5) * 0.04 * s, y: 0.04 * s, z: 0.24 * s }));
  for (const [n, x, z] of [['fl', 1, 1], ['fr', -1, 1], ['bl', 1, -1], ['br', -1, -1]]) {
    const leg = joint(`leg_${n}`, x * 0.22 * s, -0.12 * s, z * 0.42 * s);
    body.add(leg);
    leg.add(capsule(0.09 * s, 0.25 * s, hm, { y: -0.18 * s }));
    const low = joint(`legl_${n}`, 0, -0.36 * s, 0);
    leg.add(low);
    low.add(capsule(0.06 * s, 0.18 * s, hm, { y: -0.12 * s }));
    low.add(box(0.12 * s, 0.05 * s, 0.16 * s, sm, { y: -0.24 * s, z: 0.04 * s }));
  }
  let parent = body;
  for (let i = 0; i < 4; i++) {
    const t = joint(`tail${i}`, 0, i === 0 ? 0.05 * s : 0, i === 0 ? -0.62 * s : -0.28 * s);
    parent.add(t);
    t.rotation.x = 0.12;
    t.add(capsule(0.11 * s * (1 - i * 0.22), 0.2 * s, hm, { z: -0.14 * s, rx: Math.PI / 2 }));
    parent = t;
  }
  root.userData.rig = { type: 'quad', bodyY: 0.72 * s };
  return rigidSkin(root);
}

export function buildGull({ scale = 1 } = {}) {
  const s = scale;
  const root = new THREE.Group();
  const wm = colorMat(0xeeeeea, { rough: 0.8 });
  const gm = colorMat(0x8a9098, { rough: 0.8 });
  const body = joint('body', 0, 0, 0);
  root.add(body);
  body.add(sphere(0.12 * s, wm, { sz: 2.2, sy: 0.9 }));
  body.add(sphere(0.08 * s, wm, { y: 0.04 * s, z: 0.22 * s }));
  body.add(cone(0.025 * s, 0.1 * s, colorMat(0xe0b020), { y: 0.03 * s, z: 0.32 * s, rx: Math.PI / 2 }));
  body.add(box(0.12 * s, 0.02 * s, 0.14 * s, gm, { z: -0.28 * s }));
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    const wing = joint(`wing_${side}`, sx * 0.08 * s, 0.05 * s, 0.02 * s);
    body.add(wing);
    wing.add(box(0.42 * s, 0.015 * s, 0.16 * s, gm, { x: sx * 0.21 * s }));
    const tip = joint(`wingtip_${side}`, sx * 0.42 * s, 0, 0);
    wing.add(tip);
    tip.add(box(0.3 * s, 0.012 * s, 0.11 * s, colorMat(0x2a2a2e), { x: sx * 0.15 * s, z: -0.02 * s }));
  }
  root.userData.rig = { type: 'bird' };
  return rigidSkin(root);
}

export function buildDeepspawn({ scale = 1 } = {}) {
  const s = scale;
  const root = new THREE.Group();
  const fm = colorMat(0x2e4a5a, { rough: 0.4 });
  const sm = colorMat(0x7ab0b8, { rough: 0.5 });
  const body = joint('body', 0, 0.6 * s, 0);
  root.add(body);
  body.add(sphere(0.55 * s, fm, { sy: 0.8, wseg: 16, hseg: 12 }));
  const eye = sphere(0.18 * s, colorMat(0xc0f0ff, { emissive: 0x6af0ff, emissiveIntensity: 2.4 }), { y: 0.15 * s, z: 0.42 * s });
  eye.userData.keep = true;
  body.add(eye);
  body.add(sphere(0.08 * s, colorMat(0x050a10), { y: 0.15 * s, z: 0.58 * s }));
  for (let t = 0; t < 6; t++) {
    const a = (t / 6) * Math.PI * 2;
    let parent = joint(`tent${t}_0`, Math.sin(a) * 0.4 * s, -0.3 * s, Math.cos(a) * 0.4 * s);
    parent.rotation.y = a;
    parent.rotation.x = 0.9;
    body.add(parent);
    for (let i = 0; i < 4; i++) {
      const r = 0.12 * s * (1 - i * 0.2);
      parent.add(capsule(r, 0.22 * s, i % 2 ? sm : fm, { z: 0.15 * s, rx: Math.PI / 2 }));
      if (i < 3) {
        const next = joint(`tent${t}_${i + 1}`, 0, 0, 0.3 * s);
        next.rotation.x = 0.25;
        parent.add(next);
        parent = next;
      }
    }
  }
  root.userData.rig = { type: 'tentacles', bodyY: 0.6 * s, count: 6 };
  return rigidSkin(root);
}

// ---------------------------------------------------------------- humanoid monsters
export const buildBogling = (hexer = false) => {
  const root = buildHumanoid({
    height: 1.15, build: 1.1, skin: hexer ? 0x6a7a5a : 0x7a8a4a, hairStyle: 'none', ears: 'long',
    shirt: hexer ? 0x4a3a5a : 0x5a4a30, pants: 0x4a3a28, boots: 0x6a7a3a, belt: 0x3a2a1a, sleeves: 'short',
    hunch: 0.45, headScale: 1.45, eyes: 0xe0d040, glowEyes: hexer ? 0xb070ff : null, rags: true,
    hood: hexer ? 0x3a2a4a : null,
  });
  return root;
};

export const buildDrowned = () => buildHumanoid({
  height: 1.78, skin: 0x8aa0a0, hairStyle: 'long', hair: 0x2a3a30, shirt: 0x4a5a5a, pants: 0x3a4444,
  boots: 0x2a3030, sleeves: 'short', hunch: 0.25, glowEyes: 0x60e0d0, rags: true, seaweed: true,
});

export const buildCultist = (adept = false) => buildHumanoid({
  height: 1.8, skin: 0xc0a088, shirt: adept ? 0x2a2a4a : 0x1f3a3a, pants: 0x1a2424, boots: 0x1a1a1a,
  robe: adept ? 0x2a2050 : 0x1d3434, hood: adept ? 0x2a2050 : 0x1d3434, sigil: 0x5af0e0, hairStyle: 'none',
});

export const buildMorwen = () => buildHumanoid({
  height: 2.15, female: true, skin: 0xa8b8c0, hairStyle: 'long', hair: 0xd8e0e8, robe: 0x1a2a48, shirt: 0x1a2a48,
  hood: null, crown: 0x40e0d0, sigil: 0x7af8ff, glowEyes: 0x7af8ff, cloak: 0x0e1a2e,
});
