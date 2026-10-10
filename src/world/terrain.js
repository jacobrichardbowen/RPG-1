// Island heightfield: generation, chunked meshes with a 6-layer splat material, and height queries.
import * as THREE from 'three';
import { Simplex, smoothstep, clamp, lerp } from '../core/noise.js';
import { LAND_BLOBS, BAYS, PADS, TOR, MARSH, STRAND, ROADS } from './layout.js';

export const TERRAIN_HALF = 360;
export const TERRAIN_RES = 384; // cells per side
export const CELL = (TERRAIN_HALF * 2) / TERRAIN_RES;
const N = TERRAIN_RES + 1; // vertices per side
const CHUNKS = 12;

const smax = (a, b, k) => {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h);
};
const smin = (a, b, k) => -smax(-a, -b, k);

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export class Terrain {
  constructor(seed = 1337) {
    this.noise = new Simplex(seed);
    this.heights = new Float32Array(N * N);
    this.inland = new Float32Array(N * N); // signed distance-ish from the coast (meters, + is land)
    this.roadMask = new Float32Array(N * N);
    this.marshMask = new Float32Array(N * N);
    this.generate();
  }

  // Signed "inland" distance: > 0 on land, < 0 at sea.
  inlandAt(x, z) {
    const s = this.noise;
    const r = Math.hypot(x / 1.08, z);
    const th = Math.atan2(z, x);
    const cx = Math.cos(th), sz = Math.sin(th);
    const R = 212 + 16 * s.noise(cx * 1.1 + 3, sz * 1.1 - 2) + 9 * s.noise(cx * 2.7, sz * 2.7 + 5) + 4 * s.noise(cx * 6 + 1, sz * 6);
    let e = R - r;
    for (const b of LAND_BLOBS) e = smax(e, b.r - Math.hypot(x - b.x, z - b.z), 12);
    for (const b of BAYS) e = smin(e, Math.hypot(x - b.x, z - b.z) - b.r, 10);
    return e;
  }

  rawHeight(x, z, e) {
    const s = this.noise;
    let h;
    const strand = smoothstep(STRAND.radius + 30, STRAND.radius * 0.4, Math.hypot(x - STRAND.x, z - STRAND.z));
    if (e < 0) {
      const d = -e;
      h = -Math.min(24, d * 0.3 + d * d * 0.0035 * (1 - strand * 0.6));
      h += s.noise(x / 30, z / 30) * 0.6;
    } else {
      const beachW = 9 + strand * 22;
      h = 1.3 * smoothstep(0, beachW, e);
      const inland = smoothstep(beachW * 0.6, beachW + 70, e);
      h += inland * (3 + 6 * (s.fbm(x / 95, z / 95, 4) * 0.5 + 0.5));
      h += smoothstep(beachW, beachW + 40, e) * s.fbm(x / 34 + 10, z / 34, 3) * 2.6;
    }
    // Vael's Tor.
    const dt = Math.hypot(x - TOR.x, z - TOR.z);
    const torG = Math.exp(-(dt * dt) / (2 * TOR.radius * TOR.radius));
    h += TOR.height * torG * (0.82 + 0.45 * s.ridged(x / 38, z / 38, 3));
    // Glowcap Fen: low, wet, full of pools.
    const dm = Math.hypot(x - MARSH.x, z - MARSH.z);
    const mm = smoothstep(MARSH.radius, MARSH.radius * 0.45, dm) * smoothstep(0, 14, e);
    const marshH = 0.18 + 1.25 * s.fbm(x / 21, z / 21, 3);
    h = lerp(h, marshH, mm);
    return h;
  }

  generate() {
    const H = this.heights;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -TERRAIN_HALF + i * CELL, z = -TERRAIN_HALF + j * CELL;
        const e = this.inlandAt(x, z);
        const k = j * N + i;
        this.inland[k] = e;
        let h = this.rawHeight(x, z, e);
        const dm = Math.hypot(x - MARSH.x, z - MARSH.z);
        this.marshMask[k] = smoothstep(MARSH.radius, MARSH.radius * 0.5, dm) * smoothstep(0, 14, e);
        // Flatten pads (village plateau, summit, camps).
        for (const p of PADS) {
          const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz;
          const d = (Math.sqrt(dx * dx + dz * dz) - 1) * Math.min(p.rx, p.rz);
          const m = (1 - smoothstep(0, p.falloff, d)) * smoothstep(-4, 8, e);
          if (m <= 0) continue;
          if (p.target === undefined) p.target = p.h ?? this.rawHeight(p.x, p.z, this.inlandAt(p.x, p.z));
          h = lerp(h, p.target + this.noise.noise(x / 9, z / 9) * 0.12, m);
        }
        H[k] = h;
      }
    }
    // Road mask, then smooth terrain along roads.
    const segs = [];
    for (const r of ROADS) for (let i = 0; i < r.pts.length - 1; i++) segs.push([...r.pts[i], ...r.pts[i + 1], r.width]);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -TERRAIN_HALF + i * CELL, z = -TERRAIN_HALF + j * CELL;
        let m = 0;
        for (const [ax, az, bx, bz, w] of segs) {
          if (x < Math.min(ax, bx) - 12 || x > Math.max(ax, bx) + 12 || z < Math.min(az, bz) - 12 || z > Math.max(az, bz) + 12) continue;
          const d = distToSegment(x, z, ax, az, bx, bz);
          const wob = this.noise.noise(x / 6, z / 6) * 0.8;
          m = Math.max(m, 1 - smoothstep(w * 0.5 + wob, w * 0.5 + 2.2 + wob, d));
        }
        this.roadMask[j * N + i] = m;
      }
    }
    const blurred = this.blur(H, 4);
    for (let k = 0; k < H.length; k++) {
      const m = this.roadMask[k] * 0.85 * smoothstep(0, 6, this.inland[k]);
      if (m > 0) H[k] = lerp(H[k], blurred[k], m) - this.roadMask[k] * 0.08;
    }
    this.computeNormals();
  }

  blur(src, radius) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let s = 0, c = 0;
        for (let o = -radius; o <= radius; o++) {
          const ii = i + o;
          if (ii < 0 || ii >= N) continue;
          s += src[j * N + ii]; c++;
        }
        tmp[j * N + i] = s / c;
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let s = 0, c = 0;
        for (let o = -radius; o <= radius; o++) {
          const jj = j + o;
          if (jj < 0 || jj >= N) continue;
          s += tmp[jj * N + i]; c++;
        }
        out[j * N + i] = s / c;
      }
    }
    return out;
  }

  computeNormals() {
    const H = this.heights;
    this.normals = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const hl = H[j * N + Math.max(0, i - 1)], hr = H[j * N + Math.min(N - 1, i + 1)];
        const hd = H[Math.max(0, j - 1) * N + i], hu = H[Math.min(N - 1, j + 1) * N + i];
        const nx = (hl - hr) / (2 * CELL), nz = (hd - hu) / (2 * CELL);
        const len = Math.hypot(nx, 1, nz);
        const k = (j * N + i) * 3;
        this.normals[k] = nx / len;
        this.normals[k + 1] = 1 / len;
        this.normals[k + 2] = nz / len;
      }
    }
  }

  // Exact height of the rendered triangle mesh at (x, z).
  heightAt(x, z) {
    const fx = (x + TERRAIN_HALF) / CELL, fz = (z + TERRAIN_HALF) / CELL;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= TERRAIN_RES || j >= TERRAIN_RES) return -24;
    const u = fx - i, v = fz - j;
    const H = this.heights;
    const ha = H[j * N + i], hb = H[j * N + i + 1], hc = H[(j + 1) * N + i], hd = H[(j + 1) * N + i + 1];
    if (u + v <= 1) return ha + (hb - ha) * u + (hc - ha) * v;
    return hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
  }

  sampleGrid(arr, x, z) {
    const fx = clamp((x + TERRAIN_HALF) / CELL, 0, TERRAIN_RES - 0.001), fz = clamp((z + TERRAIN_HALF) / CELL, 0, TERRAIN_RES - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = arr[j * N + i], b = arr[j * N + i + 1], c = arr[(j + 1) * N + i], d = arr[(j + 1) * N + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  roadAt(x, z) { return this.sampleGrid(this.roadMask, x, z); }
  marshAt(x, z) { return this.sampleGrid(this.marshMask, x, z); }
  inlandAtGrid(x, z) { return this.sampleGrid(this.inland, x, z); }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    const hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  slopeAt(x, z) {
    const n = this.normalAt(x, z, _n);
    return 1 - n.y;
  }

  // Splat weights for a vertex: [grass, sand, rock, mud] and [ash, path].
  splatWeights(k, x, z, h, ny) {
    const s = this.noise;
    const slope = 1 - ny;
    const road = this.roadMask[k];
    const marsh = this.marshMask[k];
    const dt = Math.hypot(x - TOR.x, z - TOR.z);
    let rock = smoothstep(0.2, 0.36, slope);
    rock = Math.max(rock, smoothstep(0.5, 0.7, s.noise(x / 14, z / 14)) * smoothstep(TOR.radius * 1.4, TOR.radius * 0.6, dt) * 0.8);
    let sand = (1 - smoothstep(1.0, 2.2 + s.noise(x / 12, z / 12) * 0.6, h)) * (1 - marsh * 0.85);
    const strand = smoothstep(STRAND.radius + 10, STRAND.radius * 0.5, Math.hypot(x - STRAND.x, z - STRAND.z));
    sand = Math.max(sand, strand * (1 - smoothstep(3.0, 4.5, h)));
    let mud = marsh * smoothstep(-0.3, 0.6, s.fbm(x / 16, z / 16, 2) + 0.4);
    let ash = smoothstep(TOR.radius * 1.3, TOR.radius * 0.5, dt) * smoothstep(8, 18, h) * (0.6 + 0.4 * s.noise(x / 10, z / 10));
    let path = road;
    rock *= 1 - road * 0.8;
    sand *= 1 - rock;
    mud *= (1 - rock) * (1 - sand);
    ash *= (1 - rock) * (1 - sand);
    path *= (1 - sand * 0.7);
    const grass = Math.max(0, 1 - rock - sand - mud - ash - path);
    const sum = grass + sand + rock + mud + ash + path + 1e-5;
    return [grass / sum, sand / sum, rock / sum, mud / sum, ash / sum, path / sum];
  }

  buildMeshes(material) {
    const group = new THREE.Group();
    group.name = 'terrain';
    const per = TERRAIN_RES / CHUNKS;
    const H = this.heights, Nn = this.normals;
    // Pre-compute per-vertex splat and color once for the whole grid.
    const splatA = new Float32Array(N * N * 4), splatB = new Float32Array(N * N * 2), colors = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const x = -TERRAIN_HALF + i * CELL, z = -TERRAIN_HALF + j * CELL, h = H[k];
        const w = this.splatWeights(k, x, z, h, Nn[k * 3 + 1]);
        splatA.set(w.slice(0, 4), k * 4);
        splatB.set(w.slice(4, 6), k * 2);
        // Cheap cavity shading + depth darkening.
        let avg = 0, c = 0;
        for (const [di, dj] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
          avg += H[jj * N + ii]; c++;
        }
        avg /= c;
        let shade = 1 - clamp((avg - h) * 0.22, 0, 0.3) + clamp((h - avg) * 0.08, 0, 0.08);
        if (h < 0) shade *= lerp(1, 0.55, clamp(-h / 10, 0, 1));
        const tint = this.noise.noise(x / 40 + 7, z / 40) * 0.06;
        colors[k * 3] = shade * (1 + tint);
        colors[k * 3 + 1] = shade;
        colors[k * 3 + 2] = shade * (1 - tint);
      }
    }
    for (let cj = 0; cj < CHUNKS; cj++) {
      for (let ci = 0; ci < CHUNKS; ci++) {
        const vi = per + 1;
        const pos = new Float32Array(vi * vi * 3), nor = new Float32Array(vi * vi * 3);
        const sa = new Float32Array(vi * vi * 4), sb = new Float32Array(vi * vi * 2), col = new Float32Array(vi * vi * 3);
        for (let lj = 0; lj < vi; lj++) {
          for (let li = 0; li < vi; li++) {
            const i = ci * per + li, j = cj * per + lj;
            const k = j * N + i, v = lj * vi + li;
            pos[v * 3] = -TERRAIN_HALF + i * CELL;
            pos[v * 3 + 1] = H[k];
            pos[v * 3 + 2] = -TERRAIN_HALF + j * CELL;
            nor.set(Nn.subarray(k * 3, k * 3 + 3), v * 3);
            sa.set(splatA.subarray(k * 4, k * 4 + 4), v * 4);
            sb.set(splatB.subarray(k * 2, k * 2 + 2), v * 2);
            col.set(colors.subarray(k * 3, k * 3 + 3), v * 3);
          }
        }
        const idx = [];
        for (let lj = 0; lj < per; lj++) {
          for (let li = 0; li < per; li++) {
            const a = lj * vi + li, b = a + 1, c = a + vi, d = c + 1;
            idx.push(a, c, b, b, c, d);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('splatA', new THREE.BufferAttribute(sa, 4));
        g.setAttribute('splatB', new THREE.BufferAttribute(sb, 2));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeBoundingBox();
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, material);
        mesh.receiveShadow = true;
        mesh.name = `terrain_${ci}_${cj}`;
        group.add(mesh);
      }
    }
    return group;
  }

  // Half-float height texture used by the water shader for shoreline foam and depth tint.
  heightTexture() {
    const data = new Uint16Array(N * N);
    for (let k = 0; k < N * N; k++) data[k] = THREE.DataUtils.toHalfFloat(this.heights[k]);
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
}

const _n = new THREE.Vector3();

// Terrain material: MeshStandardMaterial with splat blending injected into the shader.
export function createTerrainMaterial(textures) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const uniforms = {
    tGrass: { value: textures.grass }, tSand: { value: textures.sand }, tRock: { value: textures.rock },
    tMud: { value: textures.mud }, tAsh: { value: textures.ash }, tPath: { value: textures.path },
    uScale: { value: 1 / 6 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 splatA; attribute vec2 splatB;
        varying vec4 vSplatA; varying vec2 vSplatB; varying vec3 vTPos; varying vec3 vTNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSplatA = splatA; vSplatB = splatB;
        vTPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTNormal = normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGrass, tSand, tRock, tMud, tAsh, tPath; uniform float uScale;
        varying vec4 vSplatA; varying vec2 vSplatB; varying vec3 vTPos; varying vec3 vTNormal;
        vec3 layer(sampler2D t, vec2 uv) {
          return mix(texture2D(t, uv).rgb, texture2D(t, uv * 0.21 + 0.37).rgb, 0.38);
        }
        vec3 triRock(vec3 p, vec3 n) {
          vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
          return texture2D(tRock, p.zy * uScale).rgb * b.x + layer(tRock, p.xz * uScale) * b.y + texture2D(tRock, p.xy * uScale).rgb * b.z;
        }`)
      .replace('#include <map_fragment>', `
        vec2 tuv = vTPos.xz * uScale;
        vec3 splatCol = layer(tGrass, tuv) * vSplatA.x
          + layer(tSand, tuv) * vSplatA.y
          + triRock(vTPos, normalize(vTNormal)) * vSplatA.z
          + layer(tMud, tuv) * vSplatA.w
          + layer(tAsh, tuv) * vSplatB.x
          + layer(tPath, tuv * 1.3) * vSplatB.y;
        diffuseColor.rgb *= splatCol;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.55, vSplatA.w * 0.6);`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v1';
  return mat;
}
