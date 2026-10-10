// Procedural placeholder textures, painted on canvases. Every texture tiles seamlessly.
// Replace any of these by dropping an image named after its slot id (e.g. tex_grass.png)
// into the Asset Workshop.
import { TileNoise, makeWorley, mulberry32, clamp } from '../../core/noise.js';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Fill every pixel from a function of (u, v) in [0,1).
function fillPixels(canvas, fn) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = fn(x / size, y / size, x, y);
      const i = (y * size + x) * 4;
      d[i] = clamp(c[0], 0, 255);
      d[i + 1] = clamp(c[1], 0, 255);
      d[i + 2] = clamp(c[2], 0, 255);
      d[i + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

// Draw something at (x, y) and at its wrapped copies so strokes tile across edges.
function wrapDraw(ctx, size, x, y, margin, draw) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * size, py = y + oy * size;
      if (px < -margin || px > size + margin || py < -margin || py > size + margin) continue;
      draw(px, py);
    }
  }
}

export function texGrass(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(11);
  const base = hex(0x5b7434), dark = hex(0x3f5526), light = hex(0x8a9a45), dry = hex(0x9a8c4a);
  const ctx = fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    const b = n.fbm(u + 0.37, v + 0.11, 16, 3);
    let col = mix(dark, base, clamp(a * 1.6 - 0.2, 0, 1));
    col = mix(col, light, clamp((b - 0.55) * 2.5, 0, 1) * 0.6);
    col = mix(col, dry, clamp((n.fbm(u + 0.7, v + 0.2, 3, 3) - 0.6) * 3, 0, 1) * 0.5);
    return col;
  });
  const rnd = mulberry32(5);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = 5 + rnd() * 9, ang = -Math.PI / 2 + (rnd() - 0.5) * 0.9;
    const shade = rnd();
    ctx.strokeStyle = shade < 0.5
      ? `rgba(${40 + rnd() * 20},${62 + rnd() * 25},${24},0.55)`
      : `rgba(${130 + rnd() * 30},${150 + rnd() * 30},${70},0.45)`;
    ctx.lineWidth = 1 + rnd() * 1.2;
    wrapDraw(ctx, size, x, y, 16, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(ang) * len * 0.5 + 2, py + Math.sin(ang) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    });
  }
  return c;
}

export function texSand(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(21);
  const base = hex(0xc8b285), dark = hex(0xa48d63), light = hex(0xe0cfa4);
  fillPixels(c, (u, v, x, y) => {
    const a = n.fbm(u, v, 4, 4);
    const ripple = Math.sin((v * 22 + n.fbm(u, v, 3, 3) * 3.2) * Math.PI * 2) * 0.5 + 0.5;
    let col = mix(dark, base, clamp(a * 1.4 - 0.1, 0, 1));
    col = mix(col, light, ripple * 0.22);
    const speck = n.sample(u, v, 256);
    if (speck > 0.82) col = mix(col, dark, 0.5);
    else if (speck < 0.12) col = mix(col, light, 0.45);
    return col;
  });
  return c;
}

export function texRock(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(31);
  const w = makeWorley(32, 7);
  const w2 = makeWorley(33, 18);
  const base = hex(0x7b7268), dark = hex(0x4a443e), light = hex(0xa39a8d), lichen = hex(0x6f7a46);
  fillPixels(c, (u, v) => {
    const [d1, d2] = w(u, v);
    const [e1, e2] = w2(u, v);
    const crack = clamp((d2 - d1) * 9, 0, 1);
    const crack2 = clamp((e2 - e1) * 7, 0, 1);
    const a = n.fbm(u, v, 4, 5);
    let col = mix(dark, base, clamp(a * 1.5 - 0.15, 0, 1));
    col = mix(col, light, clamp(d1 * 1.1 - 0.15, 0, 1) * 0.35);
    col = mix(dark, col, 0.35 + 0.65 * crack);
    col = mix(dark, col, 0.6 + 0.4 * crack2);
    const l = n.fbm(u + 0.5, v + 0.5, 6, 3);
    if (l > 0.62) col = mix(col, lichen, clamp((l - 0.62) * 4, 0, 0.7));
    return col;
  });
  return c;
}

export function texMud(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(41);
  const base = hex(0x4c3d2b), dark = hex(0x2f261b), wet = hex(0x6a5a45), moss = hex(0x4c5a2c);
  fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    const p = n.fbm(u + 0.2, v + 0.6, 3, 4);
    let col = mix(dark, base, clamp(a * 1.5 - 0.1, 0, 1));
    if (p > 0.58) col = mix(col, wet, clamp((p - 0.58) * 6, 0, 0.8));
    const m = n.fbm(u + 0.8, v + 0.1, 5, 3);
    if (m < 0.36) col = mix(col, moss, clamp((0.36 - m) * 5, 0, 0.7));
    return col;
  });
  return c;
}

export function texAsh(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(51);
  const base = hex(0x5a5550), dark = hex(0x34302d), light = hex(0x85807a), rust = hex(0x6e4d3a);
  fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    let col = mix(dark, base, clamp(a * 1.5 - 0.15, 0, 1));
    const g = n.sample(u, v, 128);
    if (g > 0.75) col = mix(col, light, 0.5);
    if (g < 0.15) col = mix(col, dark, 0.6);
    const r = n.fbm(u + 0.3, v + 0.9, 3, 3);
    if (r > 0.64) col = mix(col, rust, clamp((r - 0.64) * 5, 0, 0.6));
    return col;
  });
  return c;
}

export function texPath(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(61);
  const base = hex(0x8a6f4c), dark = hex(0x5e4a33), light = hex(0xa88d66);
  const ctx = fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    let col = mix(dark, base, clamp(a * 1.4 - 0.05, 0, 1));
    const s = n.sample(u, v, 64);
    col = mix(col, light, clamp((s - 0.6) * 2, 0, 0.4));
    return col;
  });
  const rnd = mulberry32(62);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 6;
    const g = 90 + rnd() * 60;
    wrapDraw(ctx, size, x, y, 12, (px, py) => {
      ctx.fillStyle = `rgba(${g * 0.55},${g * 0.5},${g * 0.45},0.5)`;
      ctx.beginPath(); ctx.ellipse(px + 1, py + 1.5, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${g},${g * 0.93},${g * 0.85})`;
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.7, rnd(), 0, Math.PI * 2); ctx.fill();
    });
  }
  return c;
}

export function texPlanks(size = 512, opts = {}) {
  const c = makeCanvas(size);
  const n = new TileNoise(opts.seed || 71);
  const rnd = mulberry32(opts.seed || 72);
  const boards = opts.boards || 8;
  const base = hex(opts.color || 0xa08c70), dark = hex(opts.dark || 0x5e4e3c);
  const shades = Array.from({ length: boards }, () => 0.75 + rnd() * 0.4);
  const offs = Array.from({ length: boards }, () => rnd());
  const ctx = fillPixels(c, (u, v) => {
    const bi = Math.floor(v * boards);
    const bv = v * boards - bi;
    const grain = n.fbm((u + offs[bi]) % 1, v * 0.25 + bi * 0.13, 2, 4);
    const fine = Math.sin((grain * 18 + bv * 3) * Math.PI) * 0.5 + 0.5;
    let col = mix(dark, base, clamp(shades[bi] * (0.65 + fine * 0.35), 0, 1.2));
    const edge = Math.min(bv, 1 - bv);
    if (edge < 0.04) col = mix(col, dark, 0.85);
    else if (edge < 0.08) col = mix(col, dark, 0.3);
    return col;
  });
  // Board joints and nails.
  for (let b = 0; b < boards; b++) {
    const y0 = (b / boards) * size, h = size / boards;
    const jx = offs[b] * size;
    ctx.fillStyle = 'rgba(30,22,14,0.8)';
    wrapDraw(ctx, size, jx, y0, 4, (px) => ctx.fillRect(px, y0, 2, h));
    ctx.fillStyle = 'rgba(25,25,28,0.7)';
    for (const dy of [0.25, 0.75]) {
      wrapDraw(ctx, size, jx + 6, y0 + h * dy, 4, (px, py) => { ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill(); });
      wrapDraw(ctx, size, jx - 6, y0 + h * dy, 4, (px, py) => { ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill(); });
    }
  }
  return c;
}

export function texWoodDark(size = 256) {
  return texPlanks(size, { seed: 81, boards: 2, color: 0x5a4330, dark: 0x2c2117 });
}

export function texRoof(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(91);
  const rnd = mulberry32(92);
  const rows = 10, cols = 8;
  const base = hex(0x6e4c3a), dark = hex(0x3a281f), moss = hex(0x5d6a3a);
  const jitter = Array.from({ length: rows * cols }, () => 0.8 + rnd() * 0.35);
  fillPixels(c, (u, v) => {
    const r = Math.floor(v * rows);
    const rv = v * rows - r;
    const shift = (r % 2) * 0.5 / cols;
    const cu = ((u + shift) % 1) * cols;
    const ci = Math.floor(cu);
    const cuf = cu - ci;
    const j = jitter[r * cols + ci];
    const a = n.fbm(u, v, 8, 3);
    let col = mix(dark, base, clamp(j * (0.6 + a * 0.5), 0, 1.2));
    col = mix(col, dark, Math.pow(rv, 3) * 0.8); // shadow at lower edge of each row
    if (cuf < 0.04 || cuf > 0.96) col = mix(col, dark, 0.7);
    if (rv > 0.93) col = mix(col, dark, 0.9);
    const m = n.fbm(u + 0.4, v + 0.4, 4, 3);
    if (m > 0.6) col = mix(col, moss, clamp((m - 0.6) * 3, 0, 0.6));
    return col;
  });
  return c;
}

export function texPlaster(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(101);
  const base = hex(0xd6ccb8), dark = hex(0xa89c86), stain = hex(0x9a8a6a);
  fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    let col = mix(dark, base, clamp(a * 1.6 - 0.1, 0, 1));
    const s = n.fbm(u + 0.3, v * 0.6 + 0.1, 3, 4);
    if (s > 0.6) col = mix(col, stain, clamp((s - 0.6) * 3, 0, 0.5));
    const g = n.sample(u, v, 128);
    col = mix(col, dark, clamp((g - 0.8) * 3, 0, 0.3));
    return col;
  });
  return c;
}

export function texStone(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(111);
  const rnd = mulberry32(112);
  const rows = 8, cols = 4;
  const base = hex(0x8d877d), dark = hex(0x4c4741), mortar = hex(0x5e574d);
  const shades = Array.from({ length: rows * cols * 2 }, () => 0.7 + rnd() * 0.45);
  fillPixels(c, (u, v) => {
    const r = Math.floor(v * rows);
    const rv = v * rows - r;
    const shift = (r % 2) * 0.5 / cols;
    const cu = ((u + shift) % 1) * cols;
    const ci = Math.floor(cu);
    const cuf = cu - ci;
    const a = n.fbm(u, v, 8, 4);
    let col = mix(dark, base, clamp(shades[r * cols + ci] * (0.55 + a * 0.6), 0, 1.15));
    const ex = Math.min(cuf, 1 - cuf) * cols, ey = Math.min(rv, 1 - rv);
    const edge = Math.min(ex * 0.5, ey);
    if (edge < 0.05) col = mortar;
    else if (edge < 0.1) col = mix(col, dark, 0.4);
    return col;
  });
  return c;
}

export function texThatch(size = 512) {
  const c = makeCanvas(size);
  const n = new TileNoise(121);
  const base = hex(0xa08a52), dark = hex(0x5e4c2a), light = hex(0xc8b276);
  const ctx = fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 4);
    return mix(dark, base, clamp(a * 1.3, 0, 1));
  });
  const rnd = mulberry32(122);
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * size, y = rnd() * size, len = 20 + rnd() * 40;
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(${light[0]},${light[1]},${light[2]},0.5)` : `rgba(${dark[0]},${dark[1]},${dark[2]},0.5)`;
    ctx.lineWidth = 1 + rnd() * 1.5;
    wrapDraw(ctx, size, x, y, 60, (px, py) => {
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * 6, py + len); ctx.stroke();
    });
  }
  return c;
}

export function texBark(size = 256) {
  const c = makeCanvas(size);
  const n = new TileNoise(131);
  const base = hex(0x5b4a3a), dark = hex(0x2e251c), light = hex(0x7d6a55);
  fillPixels(c, (u, v) => {
    const a = n.fbm(u * 1, v * 0.25, 8, 4);
    const ridge = Math.abs(Math.sin((u * 10 + a * 2.5) * Math.PI));
    let col = mix(dark, base, clamp(ridge * 1.2, 0, 1));
    col = mix(col, light, clamp((n.fbm(u, v, 4, 3) - 0.6) * 2, 0, 0.4));
    return col;
  });
  return c;
}

export function texCloth(size = 256) {
  const c = makeCanvas(size);
  const n = new TileNoise(141);
  const base = hex(0xcfc0a0), dark = hex(0x9c8b6c);
  fillPixels(c, (u, v, x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 1 : 0.9;
    const a = n.fbm(u, v, 4, 4);
    return mix(dark, base, clamp((0.5 + a * 0.6) * weave, 0, 1));
  });
  return c;
}

export function texMushroomCap(size = 256) {
  const c = makeCanvas(size);
  const n = new TileNoise(151);
  const base = hex(0x9c6b4a), dark = hex(0x5e3a2a), spot = hex(0xe2cfa6);
  const w = makeWorley(152, 6);
  fillPixels(c, (u, v) => {
    const a = n.fbm(u, v, 4, 4);
    const streak = Math.sin((u * 26 + a * 3) * Math.PI) * 0.5 + 0.5;
    let col = mix(dark, base, clamp(0.4 + a * 0.6 + streak * 0.2, 0, 1));
    const [d1] = w(u, v);
    if (d1 < 0.16) col = mix(col, spot, clamp((0.16 - d1) * 14, 0, 1) * 0.9);
    return col;
  });
  return c;
}

// Tangent-space normal map for water, derived from tileable fbm heights.
export function texWaterNormal(size = 256) {
  const c = makeCanvas(size);
  const n = new TileNoise(161);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      H[y * size + x] = n.fbm(x / size, y / size, 4, 5, 0.55);
    }
  }
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  fillPixels(c, (u, v, x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
    const len = Math.hypot(dx, dy, 1);
    return [(-dx / len * 0.5 + 0.5) * 255, (-dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255];
  });
  return c;
}
