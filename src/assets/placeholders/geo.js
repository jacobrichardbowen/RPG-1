// Geometry & material helpers shared by all procedural placeholder builders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registry } from '../registry.js';

// Texture-backed materials. Each references a stable registry texture, so swapping the
// texture in the Asset Workshop updates every material that uses it.
const TEX_MATS = {
  planks: { tex: 'tex_planks', tile: 2.4 },
  woodDark: { tex: 'tex_wood_dark', tile: 1.6 },
  roof: { tex: 'tex_roof', tile: 3 },
  plaster: { tex: 'tex_plaster', tile: 3 },
  stone: { tex: 'tex_stone', tile: 3 },
  thatch: { tex: 'tex_thatch', tile: 2.5 },
  bark: { tex: 'tex_bark', tile: 1.5 },
  cloth: { tex: 'tex_cloth', tile: 2 },
  cap: { tex: 'tex_mushroom_cap', tile: 1 },
  rock: { tex: 'tex_rock', tile: 4 },
  sand: { tex: 'tex_sand', tile: 4 },
};

const matCache = new Map();

export function texMat(key, { color = 0xffffff, rough = 0.9, side, emissive } = {}) {
  const ck = `t:${key}:${color}:${rough}:${side || 0}:${emissive || 0}`;
  let m = matCache.get(ck);
  if (m) return m;
  const def = TEX_MATS[key];
  m = new THREE.MeshStandardMaterial({ map: registry.texture(def.tex), color, roughness: rough, metalness: 0 });
  if (side) m.side = side;
  if (emissive) m.emissive = new THREE.Color(emissive);
  m.userData.tile = def.tile;
  m.name = key;
  matCache.set(ck, m);
  return m;
}

export function colorMat(color, { rough = 0.85, metal = 0, emissive = 0, emissiveIntensity = 1, flat = false, side, transparent = false, opacity = 1 } = {}) {
  const ck = `c:${color}:${rough}:${metal}:${emissive}:${emissiveIntensity}:${flat}:${side || 0}:${opacity}`;
  let m = matCache.get(ck);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (side) m.side = side;
  if (transparent) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  matCache.set(ck, m);
  return m;
}

// Materials whose glow follows the time of day (windows, lanterns). The sky system updates them.
export const nightGlowMaterials = new Set();
export function glowMat(color, strength = 1.6) {
  const ck = `g:${color}:${strength}`;
  let m = matCache.get(ck);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: new THREE.Color(color), emissiveIntensity: 0.2, roughness: 0.6 });
  m.userData.nightGlow = strength;
  nightGlowMaterials.add(m);
  matCache.set(ck, m);
  return m;
}

// Scale a geometry's UVs so textures keep a consistent size in meters.
function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z; 4 verts each.
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  uv.needsUpdate = true;
}

export function box(w, h, d, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const tile = mat.userData && mat.userData.tile;
  if (tile) scaleBoxUVs(geo, w, h, d, tile);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (name) m.name = name;
  return m;
}

export function cyl(rTop, rBot, h, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12, open = false, thetaLength, name } = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open, 0, thetaLength || Math.PI * 2);
  const tile = mat.userData && mat.userData.tile;
  if (tile) {
    const uv = geo.attributes.uv;
    const circ = Math.PI * 2 * Math.max(rTop, rBot);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * h / tile);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (name) m.name = name;
  return m;
}

export function sphere(r, mat, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, wseg = 12, hseg = 10, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI, name, rx = 0, ry = 0, rz = 0 } = {}) {
  const geo = new THREE.SphereGeometry(r, wseg, hseg, phiStart, phiLength, thetaStart, thetaLength);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  if (name) m.name = name;
  return m;
}

export function capsule(r, len, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, name } = {}) {
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  if (name) m.name = name;
  return m;
}

export function cone(r, h, mat, opts = {}) {
  return cyl(0, r, h, mat, { seg: 10, ...opts });
}

// A triangular prism (gable end wall). Width along X, height along Y, thickness along Z.
export function gableTriangle(w, h, t, mat, { x = 0, y = 0, z = 0, ry = 0 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  const tile = mat.userData && mat.userData.tile;
  if (tile) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

// Merge all meshes in a group by material into as few meshes as possible (fewer draw calls).
// Meshes flagged with userData.keep stay separate (e.g. animated or glowing parts).
export function bake(group, name) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const keep = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.keep) { keep.push(o); return; }
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    buckets.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  out.name = name || group.name;
  for (const { mat, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const k of keep) {
    const world = k.matrixWorld.clone();
    k.removeFromParent();
    k.matrix.multiplyMatrices(inv, world);
    k.matrix.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  for (const [key, v] of Object.entries(group.userData)) out.userData[key] = v;
  return out;
}

// Deform a geometry's vertices with a function (for organic rocks, trunks, ...).
export function deform(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Convert a hierarchy of named joint Groups with child meshes into one SkinnedMesh per material
// driven by a Bone hierarchy with the same names (rigid skinning). Cuts draw calls from dozens to a
// handful per character, and exported placeholders become properly rigged glTF files.
export function rigidSkin(root) {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const bones = [];
  const boneOf = new Map();
  const isJoint = (o) => (o.isGroup || o.type === 'Object3D') && o.name;
  const makeBone = (g, parent) => {
    const b = new THREE.Bone();
    b.name = g.name;
    b.position.copy(g.position);
    b.quaternion.copy(g.quaternion);
    b.scale.copy(g.scale);
    boneOf.set(g, bones.length);
    bones.push(b);
    if (parent) parent.add(b);
    for (const c of g.children) if (isJoint(c)) makeBone(c, b);
    return b;
  };
  const topJoints = root.children.filter(isJoint);
  if (!topJoints.length) return root;
  const tops = topJoints.map((j) => makeBone(j, null));
  // Collect meshes with their owning joint.
  const buckets = new Map();
  const visit = (g, boneIndex) => {
    for (const c of g.children) {
      if (c.isMesh) {
        const key = c.material.uuid;
        if (!buckets.has(key)) buckets.set(key, { mat: c.material, geos: [], shadow: !c.userData.noShadow });
        let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, c.matrixWorld));
        const n = geo.attributes.position.count;
        const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { si[i * 4] = boneIndex; sw[i * 4] = 1; }
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
        buckets.get(key).geos.push(geo);
      } else if (isJoint(c)) {
        visit(c, boneOf.get(c));
      }
    }
  };
  for (const j of topJoints) visit(j, boneOf.get(j));
  for (const j of topJoints) root.remove(j);
  for (const b of tops) root.add(b);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const box = new THREE.Box3();
  for (const { mat, geos, shadow } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const sm = new THREE.SkinnedMesh(merged, mat);
    sm.name = `skin_${mat.name || 'part'}`;
    sm.castShadow = shadow;
    sm.receiveShadow = true;
    if (!shadow) sm.userData.noShadow = true;
    root.add(sm);
    sm.bind(skeleton);
    merged.computeBoundingBox();
    box.union(merged.boundingBox);
  }
  // A generous bounding sphere so animated poses (lying down, attacking) aren't culled.
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 1.1 + 0.3;
  for (const c of root.children) if (c.isSkinnedMesh) c.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, size.y * 0.5, 0), r);
  return root;
}
