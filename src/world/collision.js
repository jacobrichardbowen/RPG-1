// Static collision world: terrain height + circles, oriented boxes and ramps in a spatial hash.
// Volumes are vertical prisms [y0, y1]. Walkable volumes act as floors when you're above them.
const CELL = 8;

export class CollisionWorld {
  constructor(terrain) {
    this.terrain = terrain;
    this.grid = new Map();
    this.all = [];
    this.stamp = 0;
  }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  add(c) {
    c.stamp = 0;
    if (c.type === 'circle') {
      c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r;
    } else {
      c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0);
      const ex = Math.abs(c.hx * c.cos) + Math.abs(c.hz * c.sin);
      const ez = Math.abs(c.hx * c.sin) + Math.abs(c.hz * c.cos);
      c.minX = c.x - ex; c.maxX = c.x + ex; c.minZ = c.z - ez; c.maxZ = c.z + ez;
      if (c.type === 'ramp') c.y1 = Math.max(c.h0, c.h1);
    }
    this.all.push(c);
    for (let i = Math.floor(c.minX / CELL); i <= Math.floor(c.maxX / CELL); i++) {
      for (let j = Math.floor(c.minZ / CELL); j <= Math.floor(c.maxZ / CELL); j++) {
        const k = this.key(i, j);
        let cell = this.grid.get(k);
        if (!cell) { cell = []; this.grid.set(k, cell); }
        cell.push(c);
      }
    }
    return c;
  }

  remove(c) {
    for (const cell of this.grid.values()) {
      const i = cell.indexOf(c);
      if (i >= 0) cell.splice(i, 1);
    }
    const i = this.all.indexOf(c);
    if (i >= 0) this.all.splice(i, 1);
  }

  // Add a collider given in an object's local space, transformed by position/rotation.
  addLocal(c, px, py, pz, rot) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const wx = px + c.x * cs + c.z * sn;
    const wz = pz - c.x * sn + c.z * cs;
    const w = { ...c, x: wx, z: wz, y0: py + (c.y0 ?? -2), y1: py + (c.y1 ?? 3) };
    if (c.type !== 'circle') w.rot = (c.rot || 0) + rot;
    if (c.type === 'ramp') { w.h0 = py + c.h0; w.h1 = py + c.h1; }
    return this.add(w);
  }

  query(x, z, r, out) {
    this.stamp++;
    out.length = 0;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const cell = this.grid.get(this.key(i, j));
        if (!cell) continue;
        for (const c of cell) {
          if (c.stamp === this.stamp) continue;
          c.stamp = this.stamp;
          if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
          out.push(c);
        }
      }
    }
    return out;
  }

  // Top surface height of a collider at (x, z), or -Infinity if (x,z) is outside it.
  topAt(c, x, z, pad = 0) {
    if (c.type === 'circle') {
      const dx = x - c.x, dz = z - c.z;
      return dx * dx + dz * dz <= (c.r + pad) * (c.r + pad) ? c.y1 : -Infinity;
    }
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * c.cos - dz * c.sin;
    const lz = dx * c.sin + dz * c.cos;
    if (Math.abs(lx) > c.hx + pad || Math.abs(lz) > c.hz + pad) return -Infinity;
    if (c.type === 'ramp') {
      const t = Math.min(1, Math.max(0, (lx + c.hx) / (2 * c.hx)));
      return c.h0 + (c.h1 - c.h0) * t;
    }
    return c.y1;
  }

  // Highest floor under (x, z) that's at most `feetY + step` (terrain or walkable volumes).
  groundAt(x, z, feetY, step = 0.5, radius = 0.25) {
    let g = this.terrain.heightAt(x, z);
    const list = this.query(x, z, radius, _q);
    for (const c of list) {
      if (!c.walk && c.type !== 'ramp') continue;
      const top = this.topAt(c, x, z, radius * 0.6);
      if (top > g && top <= feetY + step) g = top;
    }
    return g;
  }

  // Push a vertical cylinder (feetY..feetY+height) out of solid volumes. Mutates pos {x, z}.
  resolve(pos, feetY, radius, height, step = 0.5) {
    const list = this.query(pos.x, pos.z, radius + 0.5, _q2);
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of list) {
        if (c.camOnly) continue;
        // Vertical overlap: floors we can step onto are not walls.
        let top = c.y1;
        if (c.type === 'ramp') {
          const t = this.topAt(c, pos.x, pos.z, radius);
          top = t === -Infinity ? Math.min(c.h0, c.h1) : t;
        }
        if (top <= feetY + step || c.y0 >= feetY + height) continue;
        if (c.type === 'circle') {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + radius;
          if (d < min) {
            if (d < 1e-5) { pos.x += min; continue; }
            pos.x = c.x + (dx / d) * min;
            pos.z = c.z + (dz / d) * min;
            hit = true;
          }
        } else {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          let lx = dx * c.cos - dz * c.sin;
          let lz = dx * c.sin + dz * c.cos;
          const cx = Math.max(-c.hx, Math.min(c.hx, lx));
          const cz = Math.max(-c.hz, Math.min(c.hz, lz));
          let ox = lx - cx, oz = lz - cz;
          const d2 = ox * ox + oz * oz;
          if (d2 > radius * radius) continue;
          if (d2 < 1e-8) {
            // Center inside: push out along the shallowest axis.
            const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
            if (px < pz) lx = Math.sign(lx || 1) * (c.hx + radius);
            else lz = Math.sign(lz || 1) * (c.hz + radius);
          } else {
            const d = Math.sqrt(d2);
            lx = cx + (ox / d) * radius;
            lz = cz + (oz / d) * radius;
          }
          pos.x = c.x + lx * c.cos + lz * c.sin;
          pos.z = c.z - lx * c.sin + lz * c.cos;
          hit = true;
        }
      }
    }
    return hit;
  }

  // Is a point inside any solid volume (used by the camera and line-of-sight tests)?
  pointBlocked(x, y, z, includeCamOnly = true, includeTerrain = true) {
    if (includeTerrain && y < this.terrain.heightAt(x, z) + 0.15) return true;
    const list = this.query(x, z, 0.05, _q3);
    for (const c of list) {
      if (c.camOnly && !includeCamOnly) continue;
      if (c.noCam) continue;
      const top = this.topAt(c, x, z, 0.1);
      if (top === -Infinity) continue;
      if (y >= c.y0 && y <= top) return true;
    }
    return false;
  }

  // March along a segment; returns the fraction [0..1] of the first blocked point.
  segmentFree(ax, ay, az, bx, by, bz, stepLen = 0.3, includeCamOnly = true, includeTerrain = true) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.max(1, Math.ceil(len / stepLen));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, includeCamOnly, includeTerrain)) return (i - 1) / steps;
    }
    return 1;
  }
}

const _q = [], _q2 = [], _q3 = [];
