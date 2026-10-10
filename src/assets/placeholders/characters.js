// Procedural humanoid characters. Each is a hierarchy of named joints (hips, spine, chest,
// neck, head, upperarm_l/r, elbow_l/r, hand_l/r, thigh_l/r, knee_l/r, foot_l/r) animated in code.
// Characters face +Z with feet at y = 0 and are about 1.8 m tall.
import * as THREE from 'three';
import { colorMat, box, sphere, capsule, cyl, cone, rigidSkin } from './geo.js';

const joint = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

export const DEFAULT_LOOK = {
  height: 1.8, build: 1, female: false,
  skin: 0xc99a78, hair: 0x3b2a1c, hairStyle: 'short', beard: null, eyes: 0x1c1a18,
  shirt: 0x7a6650, sleeves: 'long', pants: 0x4d3e2f, boots: 0x3a2c20, belt: 0x2a1d12,
  robe: null, hood: null, cloak: null, helm: null, shoulders: null, cuirass: null, apron: null,
  ears: 'round', tusks: false, lizard: null, glowEyes: null, hunch: 0, headScale: 1,
  sigil: null, crown: null, rags: false, seaweed: false,
};

export function buildHumanoid(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const k = L.height / 1.8;
  const w = L.build;
  const fem = L.female;
  const M = {
    skin: colorMat(L.skin, { rough: 0.75 }),
    hair: colorMat(L.hair, { rough: 0.9 }),
    shirt: colorMat(L.shirt, { rough: 0.9 }),
    pants: colorMat(L.pants, { rough: 0.9 }),
    boots: colorMat(L.boots, { rough: 0.8 }),
    belt: colorMat(L.belt, { rough: 0.7 }),
    eyes: L.glowEyes ? colorMat(L.glowEyes, { emissive: L.glowEyes, emissiveIntensity: 2.2 }) : colorMat(L.eyes, { rough: 0.3 }),
  };
  const root = new THREE.Group();
  root.name = 'humanoid';

  const hipY = 0.93 * k;
  const hips = joint('hips', 0, hipY, 0);
  root.add(hips);
  hips.add(box(0.31 * k * w * (fem ? 1.08 : 1), 0.17 * k, 0.2 * k, M.pants, { y: -0.01 * k }));
  hips.add(box(0.33 * k * w, 0.05 * k, 0.21 * k, M.belt, { y: 0.06 * k }));

  const spine = joint('spine', 0, 0.05 * k, 0);
  hips.add(spine);
  spine.rotation.x = L.hunch * 0.6;
  const abd = cyl(0.15 * k * w, 0.15 * k * w * (fem ? 1.02 : 1), 0.24 * k, M.shirt, { y: 0.11 * k, seg: 12 });
  abd.scale.z = 0.7;
  spine.add(abd);

  const chest = joint('chest', 0, 0.22 * k, 0);
  spine.add(chest);
  chest.rotation.x = L.hunch * 0.4;
  const chestTop = (fem ? 0.165 : 0.195) * k * w;
  const ch = cyl(chestTop, 0.155 * k * w, 0.27 * k, M.shirt, { y: 0.12 * k, seg: 14 });
  ch.scale.z = 0.66;
  chest.add(ch);
  if (fem) {
    for (const s of [-1, 1]) chest.add(sphere(0.062 * k, M.shirt, { x: s * 0.065 * k, y: 0.1 * k, z: 0.075 * k, sz: 0.9 }));
  }
  if (L.cuirass) {
    const cm = colorMat(L.cuirass, { rough: 0.45, metal: 0.5 });
    const cu = cyl(chestTop * 1.08, 0.165 * k * w, 0.3 * k, cm, { y: 0.11 * k, seg: 14 });
    cu.scale.z = 0.72;
    chest.add(cu);
  }
  if (L.apron) chest.add(box(0.26 * k, 0.5 * k, 0.02 * k, colorMat(L.apron), { y: -0.08 * k, z: 0.115 * k }));
  if (L.sigil) {
    const sg = sphere(0.045 * k, colorMat(L.sigil, { emissive: L.sigil, emissiveIntensity: 2.5 }), { y: 0.13 * k, z: 0.125 * k, sz: 0.4 });
    sg.userData.keep = true;
    chest.add(sg);
  }
  if (L.cloak) {
    const cl = box(0.4 * k * w, 0.95 * k, 0.03 * k, colorMat(L.cloak, { rough: 0.95 }), { y: -0.22 * k, z: -0.13 * k, rx: 0.08 });
    chest.add(cl);
  }

  const neck = joint('neck', 0, 0.25 * k, 0);
  chest.add(neck);
  neck.add(cyl(0.05 * k, 0.055 * k, 0.1 * k, M.skin, { y: 0.03 * k, seg: 8 }));

  const head = joint('head', 0, 0.07 * k, 0);
  neck.add(head);
  head.scale.setScalar(L.headScale);
  buildHead(head, L, M, k);

  // Arms
  const sw = (fem ? 0.18 : 0.2) * k * w;
  const ua = 0.27 * k, fa = 0.25 * k;
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    const sh = joint(`upperarm_${side}`, sx * sw, 0.19 * k, 0);
    chest.add(sh);
    sh.add(sphere(0.06 * k * w, M.shirt, { y: -0.01 * k }));
    sh.add(capsule(0.052 * k * w, ua - 0.1 * k, M.shirt, { y: -ua / 2 }));
    if (L.shoulders) {
      const pm = colorMat(L.shoulders, { rough: 0.4, metal: 0.6 });
      sh.add(sphere(0.085 * k * w, pm, { y: 0.005, thetaLength: Math.PI * 0.55, sx: 1.1 }));
    }
    const el = joint(`elbow_${side}`, 0, -ua, 0);
    sh.add(el);
    const sleeveMat = L.sleeves === 'long' ? M.shirt : M.skin;
    el.add(capsule(0.045 * k * w, fa - 0.09 * k, sleeveMat, { y: -fa / 2 }));
    if (L.sleeves === 'long') el.add(cyl(0.05 * k, 0.048 * k, 0.05 * k, M.belt, { y: -fa + 0.04 * k, seg: 8 }));
    const hand = joint(`hand_${side}`, 0, -fa, 0);
    el.add(hand);
    hand.add(box(0.065 * k, 0.09 * k, 0.045 * k, L.lizard ? colorMat(L.lizard.scales) : M.skin, { y: -0.045 * k }));
    const grip = joint(`grip_${side}`, 0, -0.06 * k, 0.005);
    hand.add(grip);
    if (side === 'l') {
      const mount = joint('shield_l', 0.06 * k, -fa * 0.5, 0);
      el.add(mount);
    }
  }

  // Legs
  const tl = 0.44 * k, sl = 0.42 * k;
  for (const [side, sx] of [['l', 1], ['r', -1]]) {
    const th = joint(`thigh_${side}`, sx * 0.095 * k * w * (fem ? 1.05 : 1), -0.03 * k, 0);
    hips.add(th);
    th.add(capsule(0.078 * k * w, tl - 0.12 * k, M.pants, { y: -tl / 2 }));
    const kn = joint(`knee_${side}`, 0, -tl, 0);
    th.add(kn);
    kn.add(capsule(0.062 * k * w, sl - 0.1 * k, M.pants, { y: -sl / 2 }));
    kn.add(cyl(0.07 * k * w, 0.064 * k * w, 0.26 * k, M.boots, { y: -sl + 0.13 * k, seg: 10 }));
    const ft = joint(`foot_${side}`, 0, -sl, 0);
    kn.add(ft);
    ft.add(box(0.1 * k * w, 0.08 * k, 0.24 * k, M.boots, { y: 0, z: 0.05 * k }));
  }

  // Long garments hang from the hips and cover the legs.
  if (L.robe) {
    const rm = colorMat(L.robe, { rough: 0.95 });
    const robe = cyl(0.17 * k * w, 0.29 * k * w, 0.78 * k, rm, { y: -0.4 * k, seg: 14, open: true });
    robe.material = rm;
    robe.scale.z = 0.85;
    hips.add(robe);
    // Robe also covers the torso.
    chest.children[0].material = rm;
    abd.material = rm;
    if (L.rags) robe.scale.y = 0.85;
  }
  if (L.rags) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      hips.add(box(0.08 * k, 0.2 * k, 0.02 * k, M.shirt, { x: Math.sin(a) * 0.17 * k, y: -0.17 * k, z: Math.cos(a) * 0.12 * k, ry: a }));
    }
  }
  if (L.seaweed) {
    const sm = colorMat(0x3d5a2a, { rough: 1 });
    for (let i = 0; i < 4; i++) chest.add(box(0.03 * k, 0.32 * k, 0.01 * k, sm, { x: (i - 1.5) * 0.08 * k, y: 0.05 * k, z: 0.13 * k, rz: (i - 1.5) * 0.2 }));
  }
  if (L.lizard) {
    const lm = colorMat(L.lizard.scales, { rough: 0.7 });
    let parent = hips;
    let len = 0.24 * k;
    for (let i = 0; i < 4; i++) {
      const tj = joint(`tail${i}`, 0, i === 0 ? -0.02 * k : 0, i === 0 ? -0.1 * k : -len);
      parent.add(tj);
      tj.rotation.x = i === 0 ? 0.9 : 0.12;
      tj.add(capsule(0.065 * k * (1 - i * 0.2), len * 0.8, lm, { z: -len / 2, rx: Math.PI / 2 }));
      parent = tj;
      len *= 0.9;
    }
  }

  root.userData.rig = { type: 'humanoid', hipY, height: L.height };
  root.userData.look = L;
  return rigidSkin(root);
}

function buildHead(head, L, M, k) {
  const hr = 0.115 * k;
  if (L.lizard) {
    const lm = colorMat(L.lizard.scales, { rough: 0.7 });
    head.add(sphere(hr, lm, { y: 0.1 * k, sx: 0.95, sy: 1.0, sz: 1.05 }));
    head.add(box(0.13 * k, 0.09 * k, 0.17 * k, lm, { y: 0.07 * k, z: 0.12 * k, rx: 0.12 }));
    head.add(box(0.12 * k, 0.03 * k, 0.15 * k, colorMat(L.lizard.belly || 0xb8a070), { y: 0.03 * k, z: 0.12 * k }));
    const cm = colorMat(L.lizard.crest || 0x7a3a2a);
    for (let i = 0; i < 4; i++) head.add(cone(0.025 * k, 0.1 * k, cm, { y: 0.21 * k - i * 0.02 * k, z: -0.02 * k - i * 0.05 * k, rx: -0.6 - i * 0.2 }));
    for (const s of [-1, 1]) head.add(sphere(0.02 * k, M.eyes, { x: s * 0.06 * k, y: 0.13 * k, z: 0.08 * k }));
    return;
  }
  head.add(sphere(hr, M.skin, { y: 0.11 * k, sx: 0.92, sy: 1.1, sz: 1.0, wseg: 14, hseg: 12 }));
  head.add(box(0.025 * k, 0.045 * k, 0.03 * k, M.skin, { y: 0.1 * k, z: 0.112 * k }));
  for (const s of [-1, 1]) {
    head.add(sphere(0.016 * k, M.eyes, { x: s * 0.04 * k, y: 0.125 * k, z: 0.098 * k }));
    head.add(box(0.035 * k, 0.008 * k, 0.01 * k, M.hair, { x: s * 0.04 * k, y: 0.148 * k, z: 0.105 * k, rz: s * 0.15 }));
    if (L.ears === 'pointed') {
      head.add(cone(0.022 * k, 0.11 * k, M.skin, { x: s * 0.115 * k, y: 0.13 * k, z: -0.01 * k, rz: -s * 1.15, rx: -0.3 }));
    } else if (L.ears === 'long') {
      head.add(cone(0.035 * k, 0.2 * k, M.skin, { x: s * 0.16 * k, y: 0.12 * k, z: -0.01 * k, rz: -s * 1.4 }));
    } else {
      head.add(sphere(0.022 * k, M.skin, { x: s * 0.1 * k, y: 0.11 * k, sx: 0.5 }));
    }
    if (L.tusks) head.add(cone(0.012 * k, 0.05 * k, colorMat(0xe8e0c8), { x: s * 0.035 * k, y: 0.06 * k, z: 0.09 * k, rx: -0.2 }));
  }
  head.add(box(0.05 * k, 0.008 * k, 0.01 * k, colorMat(0x6a3a30), { y: 0.065 * k, z: 0.108 * k }));
  if (L.beard) {
    const bm = colorMat(L.beard, { rough: 1 });
    head.add(sphere(0.085 * k, bm, { y: 0.05 * k, z: 0.045 * k, sx: 1.05, sy: 0.9, sz: 0.85, thetaStart: Math.PI * 0.45, thetaLength: Math.PI * 0.55 }));
  }
  const hm = M.hair;
  switch (L.hairStyle) {
    case 'short':
      head.add(sphere(hr * 1.06, hm, { y: 0.125 * k, z: -0.008 * k, sx: 0.96, sy: 1.0, thetaLength: Math.PI * 0.5 }));
      break;
    case 'long':
      head.add(sphere(hr * 1.07, hm, { y: 0.125 * k, z: -0.008 * k, sx: 0.97, thetaLength: Math.PI * 0.55 }));
      head.add(box(0.2 * k, 0.26 * k, 0.06 * k, hm, { y: 0.0, z: -0.08 * k }));
      break;
    case 'bun':
      head.add(sphere(hr * 1.06, hm, { y: 0.125 * k, z: -0.008 * k, sx: 0.96, thetaLength: Math.PI * 0.5 }));
      head.add(sphere(0.055 * k, hm, { y: 0.2 * k, z: -0.09 * k }));
      break;
    case 'ponytail':
      head.add(sphere(hr * 1.06, hm, { y: 0.125 * k, z: -0.008 * k, sx: 0.96, thetaLength: Math.PI * 0.5 }));
      head.add(capsule(0.03 * k, 0.18 * k, hm, { y: 0.05 * k, z: -0.13 * k, rx: 0.3 }));
      break;
    case 'mohawk':
      head.add(box(0.03 * k, 0.07 * k, 0.24 * k, hm, { y: 0.24 * k, z: -0.01 * k }));
      break;
    default:
      break;
  }
  if (L.hood) {
    const hd = colorMat(L.hood, { rough: 0.95 });
    head.add(sphere(hr * 1.32, hd, { y: 0.12 * k, z: -0.025 * k, sx: 1.0, sy: 1.08, thetaLength: Math.PI * 0.62, side: THREE.DoubleSide }));
    head.add(cone(0.1 * k, 0.16 * k, hd, { y: 0.2 * k, z: -0.12 * k, rx: -2.2 }));
  }
  if (L.helm) {
    const hmm = colorMat(L.helm, { rough: 0.35, metal: 0.7 });
    head.add(sphere(hr * 1.18, hmm, { y: 0.13 * k, thetaLength: Math.PI * 0.55 }));
    head.add(box(0.02 * k, 0.07 * k, 0.02 * k, hmm, { y: 0.1 * k, z: 0.125 * k }));
    head.add(cyl(hr * 1.22, hr * 1.22, 0.025 * k, hmm, { y: 0.135 * k, seg: 14 }));
  }
  if (L.hat === 'tricorn') {
    const tm = colorMat(0x2a2230);
    head.add(cyl(0.18 * k, 0.18 * k, 0.02 * k, tm, { y: 0.2 * k, seg: 3 }));
    head.add(cyl(0.08 * k, 0.11 * k, 0.09 * k, tm, { y: 0.245 * k, seg: 10 }));
  }
  if (L.crown) {
    const cm = colorMat(L.crown, { rough: 0.6, emissive: L.crown, emissiveIntensity: 0.6 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      head.add(cone(0.02 * k, 0.16 * k, cm, { x: Math.sin(a) * 0.12 * k, y: 0.26 * k, z: Math.cos(a) * 0.12 * k, rx: Math.cos(a) * -0.3, rz: Math.sin(a) * 0.3 }));
    }
  }
}

// ---------------------------------------------------------------- races & presets
export const RACES = {
  westerling: {
    name: 'Westerling', blurb: 'Hardy settlers from the western kingdoms. Adaptable in all things.',
    stats: { str: 1, agi: 1, int: 1, end: 1 }, passive: 'Quick Study: +10% experience from all sources.',
    skins: [0xe0b394, 0xc99a78, 0xa8754f, 0x7a5236], look: { ears: 'round' },
  },
  ashborn: {
    name: 'Ashborn', blurb: 'Grey-skinned elves of the ash wastes, long-lived and proud.',
    stats: { int: 3, agi: 2, str: -1 }, passive: 'Ember Blood: take 25% less fire and shadow damage.',
    skins: [0x7d8590, 0x6a6f7c, 0x8c8f96, 0x5d6370], look: { ears: 'pointed', glowEyes: 0xd03a28 },
  },
  tuskari: {
    name: 'Tuskari', blurb: 'Broad, tusked mountain folk. Their grip is iron and their temper short.',
    stats: { str: 3, end: 2, int: -1 }, passive: 'Thick Hide: +10% maximum health.',
    skins: [0x7a8f58, 0x6a7d4a, 0x8a9a62, 0x5a6b40], look: { ears: 'pointed', tusks: true, build: 1.12, height: 1.86 },
  },
  skarn: {
    name: 'Skarn', blurb: 'Scaled marsh-dwellers who breathe water as easily as air.',
    stats: { agi: 3, end: 1, str: 0 }, passive: 'Gills: swim 50% faster and regain health in water.',
    skins: [0x5f7a4a, 0x4a6a6a, 0x7a6a3a, 0x5a5a7a], look: { hairStyle: 'none' }, lizard: true,
  },
};

export function playerLook(char) {
  const race = RACES[char.race] || RACES.westerling;
  const skin = race.skins[char.skin || 0] ?? race.skins[0];
  const look = {
    ...race.look,
    female: !!char.female,
    skin,
    hair: char.hairColor ?? 0x3b2a1c,
    hairStyle: race.lizard ? 'none' : (char.hairStyle || 'short'),
    beard: !char.female && char.beard && !race.lizard ? (char.hairColor ?? 0x3b2a1c) : null,
    shirt: char.shirtOverride ?? 0x8a7a62, pants: 0x5a4a38, boots: 0x3a2c20, sleeves: char.shirtOverride ? 'long' : 'short',
  };
  if (race.lizard) look.lizard = { scales: skin, belly: 0xc0a878, crest: 0x8a3a2a };
  if (char.female) look.height = (look.height || 1.8) * 0.95;
  return look;
}
