// Asset registry: every model, texture, icon and sound in the game lives in a named "slot".
// A slot has a procedural placeholder. Players can override any slot with their own file
// (glb/gltf/fbx/obj for models, png/jpg/webp for textures, ogg/mp3/wav for audio).
// Overrides come from: files dropped into the Asset Workshop (saved in IndexedDB),
// assets baked into Play.html at build time, or a linked folder (Chromium browsers).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { OverrideStore } from './store.js';

export const MODEL_EXT = ['glb', 'gltf', 'fbx', 'obj'];
export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
export const AUDIO_EXT = ['ogg', 'mp3', 'wav', 'm4a', 'flac', 'webm'];

export const ANIM_STATES = ['idle', 'walk', 'run', 'attack', 'cast', 'hit', 'death', 'jump', 'swim', 'sit'];
const ANIM_ALIASES = {
  idle: ['idle', 'stand', 'breath', 'wait'],
  walk: ['walk'],
  run: ['run', 'sprint', 'jog'],
  attack: ['attack', 'slash', 'swing', 'punch', 'strike', 'melee', 'bite'],
  cast: ['cast', 'spell', 'magic', 'throw'],
  hit: ['hit', 'hurt', 'damage', 'impact', 'react'],
  death: ['death', 'die', 'dying', 'dead'],
  jump: ['jump', 'fall', 'air'],
  swim: ['swim', 'tread'],
  sit: ['sit', 'seat'],
};

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function kindForExt(ext) {
  if (MODEL_EXT.includes(ext)) return 'model';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (ext === 'json') return 'json';
  return null;
}

// "char_player@walk.fbx" -> { slot: 'char_player', anim: 'walk' }
export function parseAssetName(fileName) {
  const base = fileName.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const at = base.indexOf('@');
  if (at > 0) return { slot: base.slice(0, at).toLowerCase(), anim: base.slice(at + 1).toLowerCase() };
  return { slot: base.toLowerCase(), anim: null };
}

export function matchClip(clips, state, mapping) {
  if (mapping && mapping[state]) {
    const c = clips.find((c) => c.name === mapping[state]);
    if (c) return c;
  }
  const exact = clips.find((c) => c.name.toLowerCase() === state);
  if (exact) return exact;
  for (const alias of ANIM_ALIASES[state] || [state]) {
    const c = clips.find((c) => c.name.toLowerCase().replace(/^.*\|/, '').includes(alias));
    if (c) return c;
  }
  return null;
}

const DEFAULT_SETTINGS = { fit: null, scale: 1, rotY: 0, offsetY: 0, anims: {} };

class AssetRegistry {
  constructor() {
    this.slots = new Map();
    this.overrides = new Map(); // id -> { id, kind, fileName, blob, settings, source, anims: {name: {fileName, blob}}, extraFiles }
    this.textures = new Map(); // id -> stable THREE.Texture
    this.models = new Map(); // id -> template record
    this.placeholderModels = new Map();
    this.audio = new Map(); // id -> AudioBuffer (overrides only)
    this.listeners = new Set();
    this.store = new OverrideStore();
    this.anisotropy = 4;
    this.loadErrors = new Map();
  }

  define(def) {
    if (this.slots.has(def.id)) return this.slots.get(def.id);
    const slot = { category: 'Misc', label: def.id, description: '', ...def };
    this.slots.set(def.id, slot);
    return slot;
  }

  slot(id) { return this.slots.get(id); }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(id) { for (const fn of this.listeners) { try { fn(id); } catch (e) { console.error(e); } } }

  // ---------------------------------------------------------------- textures
  texture(id) {
    let tex = this.textures.get(id);
    if (tex) return tex;
    const slot = this.slots.get(id);
    if (!slot) throw new Error(`Unknown texture slot ${id}`);
    const canvas = slot.build();
    tex = new THREE.Texture(canvas);
    tex.wrapS = tex.wrapT = slot.wrap === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.colorSpace = slot.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = this.anisotropy;
    tex.needsUpdate = true;
    tex.userData.placeholder = canvas;
    this.textures.set(id, tex);
    const ov = this.overrides.get(id);
    if (ov && ov.image) this.applyTextureImage(tex, ov.image);
    return tex;
  }

  applyTextureImage(tex, image) {
    tex.image = image;
    tex.needsUpdate = true;
  }

  // Icons are plain canvases/images used by the HTML UI.
  iconURL(id) {
    const ov = this.overrides.get(id);
    if (ov && ov.url) return ov.url;
    const slot = this.slots.get(id);
    if (!slot) return '';
    if (!slot._url) {
      const canvas = slot.build();
      slot._url = canvas.toDataURL('image/png');
    }
    return slot._url;
  }

  // ---------------------------------------------------------------- models
  placeholder(id) {
    let rec = this.placeholderModels.get(id);
    if (rec) return rec;
    const slot = this.slots.get(id);
    if (!slot || !slot.build) throw new Error(`Unknown model slot ${id}`);
    const root = slot.build();
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    rec = { root, clips: root.userData.clips || [], box, size: box.getSize(new THREE.Vector3()), isOverride: false, slot };
    this.placeholderModels.set(id, rec);
    return rec;
  }

  // Resolve the template for a slot, following fallback chains for overrides.
  model(id) {
    const ov = this.resolveOverrideSlot(id);
    if (ov) {
      const rec = this.models.get(ov);
      if (rec) return { ...rec, requested: id };
    }
    return { ...this.placeholder(id), requested: id };
  }

  resolveOverrideSlot(id) {
    let cur = id;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (this.models.has(cur)) return cur;
      const slot = this.slots.get(cur);
      cur = slot && slot.fallback;
    }
    return null;
  }

  hasOverride(id) { return this.overrides.has(id); }

  // A fresh, independent copy of a slot's model ready to be placed in the scene.
  instance(id, { cloneMaterials = false } = {}) {
    const rec = this.model(id);
    const root = SkeletonUtils.clone(rec.root);
    if (cloneMaterials) {
      root.traverse((o) => {
        if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      });
    }
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.userData.noShadow ? false : true;
        o.receiveShadow = true;
      }
    });
    return { root, clips: rec.clips, isOverride: rec.isOverride, rec };
  }

  async buildOverrideModel(ov) {
    const slot = this.slots.get(ov.id);
    const loaded = await loadModelBlob(ov.blob, ov.fileName, ov.extraFiles);
    const inner = new THREE.Group();
    inner.add(loaded.scene);
    const container = new THREE.Group();
    container.add(inner);
    container.name = `override:${ov.id}`;
    const settings = { ...DEFAULT_SETTINGS, ...(ov.settings || {}) };
    // Measure the raw model.
    loaded.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(loaded.scene, true);
    const size = box.getSize(new THREE.Vector3());
    let fit = settings.fit || (slot && slot.fit) || 'height';
    let s = 1;
    if (fit !== 'none' && slot && slot.build) {
      const ref = this.placeholder(ov.id).size;
      if (fit === 'height' && size.y > 1e-4) s = ref.y / size.y;
      else if (fit === 'bounds') {
        const m = Math.max(size.x, size.z), rm = Math.max(ref.x, ref.z);
        if (m > 1e-4) s = rm / m;
      }
    }
    s *= settings.scale || 1;
    inner.scale.setScalar(s);
    inner.rotation.y = THREE.MathUtils.degToRad(settings.rotY || 0);
    // Center on X/Z and put the base on y = 0 (after scaling & rotation).
    inner.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(inner, true);
    const c = b2.getCenter(new THREE.Vector3());
    if (fit !== 'none' || settings.recenter) {
      inner.position.x -= c.x;
      inner.position.z -= c.z;
    }
    inner.position.y += -b2.min.y + (settings.offsetY || 0);
    container.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = !o.isSkinnedMesh;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m && m.map) m.map.anisotropy = this.anisotropy;
      }
    });
    let clips = loaded.animations.slice();
    for (const [name, a] of Object.entries(ov.anims || {})) {
      try {
        const al = await loadModelBlob(a.blob, a.fileName);
        if (al.animations[0]) {
          const clip = al.animations[0].clone();
          clip.name = name;
          clips = clips.filter((c) => c.name !== name);
          clips.push(clip);
        }
      } catch (e) {
        console.warn('Animation failed to load', a.fileName, e);
      }
    }
    const finalBox = new THREE.Box3().setFromObject(container, true);
    return {
      root: container, clips, box: finalBox, size: finalBox.getSize(new THREE.Vector3()), isOverride: true,
      rawSize: size, appliedScale: s, fit, slot, settings,
    };
  }

  // ---------------------------------------------------------------- overrides
  // Baked files (from the build) load first; the player's own Workshop overrides win over them.
  async init(bakedFiles = []) {
    if (bakedFiles.length) {
      const r = await this.importFiles(bakedFiles, { persist: false, source: 'baked', notify: false });
      for (const e of r.errors) console.warn('Baked asset failed:', e);
    }
    let stored = [];
    try {
      stored = await this.store.all();
    } catch (e) {
      console.warn('Asset store unavailable', e);
    }
    for (const it of stored) {
      try { await this.applyRecord({ ...it, source: 'user' }, false); } catch (e) {
        console.warn('Override failed', it.id, e);
        this.loadErrors.set(it.id, String(e.message || e));
      }
    }
  }

  async applyRecord(rec, notify = true) {
    const slot = this.slots.get(rec.id);
    const kind = rec.kind || (slot ? slot.kind : null);
    const ov = { ...rec, kind, settings: { ...DEFAULT_SETTINGS, ...(rec.settings || {}) }, anims: rec.anims || {} };
    if (kind === 'texture' || kind === 'icon') {
      ov.image = await blobToImage(ov.blob);
      if (ov.url) URL.revokeObjectURL(ov.url);
      ov.url = URL.createObjectURL(ov.blob);
      this.overrides.set(ov.id, ov);
      const tex = this.textures.get(ov.id);
      if (tex) this.applyTextureImage(tex, ov.image);
    } else if (kind === 'model') {
      this.overrides.set(ov.id, ov);
      if (ov.blob) {
        const built = await this.buildOverrideModel(ov);
        this.models.set(ov.id, built);
      }
    } else if (kind === 'audio') {
      this.overrides.set(ov.id, ov);
      this.audio.delete(ov.id); // decoded lazily by the audio engine
    } else {
      throw new Error(`No slot named "${rec.id}"`);
    }
    this.loadErrors.delete(ov.id);
    if (notify) this.emit(ov.id);
    return ov;
  }

  // Add or replace an override from a user file. Returns the slot id it landed in.
  async setOverride(id, file, { settings, persist = true, extraFiles, source, notify = true } = {}) {
    const prev = this.overrides.get(id);
    const rec = {
      id, fileName: file.name, blob: file, settings: settings || (prev && prev.settings) || {},
      anims: (prev && prev.anims) || {}, extraFiles, source: source || (persist ? 'user' : 'folder'),
    };
    const slot = this.slots.get(id);
    rec.kind = slot.kind;
    await this.applyRecord(rec, notify);
    if (persist) await this.persist(id);
    return id;
  }

  async addAnimation(id, animName, file, { persist = true, notify = true } = {}) {
    const ov = this.overrides.get(id);
    if (!ov || ov.kind !== 'model') throw new Error(`Add a model for ${id} before adding animations`);
    ov.anims = { ...(ov.anims || {}), [animName]: { fileName: file.name, blob: file } };
    await this.applyRecord(ov, notify);
    if (persist) await this.persist(id);
  }

  async updateSettings(id, settings, { persist = true } = {}) {
    const ov = this.overrides.get(id);
    if (!ov) return;
    ov.settings = { ...ov.settings, ...settings };
    await this.applyRecord(ov, true);
    if (persist) await this.persist(id);
  }

  async persist(id) {
    const ov = this.overrides.get(id);
    if (!ov || ov.source === 'baked') return;
    try {
      await this.store.put({
        id, kind: ov.kind, fileName: ov.fileName, blob: ov.blob, settings: ov.settings,
        anims: ov.anims, extraFiles: ov.extraFiles,
      });
    } catch (e) {
      console.warn('Could not save override', e);
    }
  }

  async removeOverride(id) {
    const ov = this.overrides.get(id);
    if (!ov) return;
    this.overrides.delete(id);
    this.models.delete(id);
    this.audio.delete(id);
    if (ov.url) URL.revokeObjectURL(ov.url);
    const tex = this.textures.get(id);
    if (tex) this.applyTextureImage(tex, tex.userData.placeholder);
    try { await this.store.delete(id); } catch (e) { /* ignore */ }
    this.emit(id);
  }

  async clearAll() {
    const ids = [...this.overrides.keys()].filter((id) => this.overrides.get(id).source !== 'baked');
    for (const id of ids) await this.removeOverride(id);
  }

  // Import many files at once (folder drop / folder link). Files are matched to slots by name.
  async importFiles(files, { persist = true, source, notify = true } = {}) {
    const report = { applied: [], skipped: [], errors: [] };
    const byName = new Map();
    for (const f of files) byName.set((f.relPath || f.name).replace(/\\/g, '/'), f);
    const sidecars = new Map();
    for (const f of files) {
      if (extOf(f.name) === 'json') {
        try { sidecars.set(parseAssetName(f.name).slot, JSON.parse(await f.text())); } catch (e) { /* ignore */ }
      }
    }
    const anims = [];
    for (const f of files) {
      const ext = extOf(f.name);
      const kind = kindForExt(ext);
      if (!kind || kind === 'json') continue;
      const { slot: sid, anim } = parseAssetName(f.name);
      const slot = this.slots.get(sid);
      if (!slot) { if (!['bin'].includes(ext) && kind) report.skipped.push(f.name); continue; }
      if (anim) { anims.push({ sid, anim, f }); continue; }
      const ok = (slot.kind === 'model' && kind === 'model') || ((slot.kind === 'texture' || slot.kind === 'icon') && kind === 'image') || (slot.kind === 'audio' && kind === 'audio');
      if (!ok) { report.skipped.push(f.name); continue; }
      try {
        await this.setOverride(sid, f, { settings: sidecars.get(sid), persist, source, notify, extraFiles: ext === 'gltf' ? collectSiblings(f, byName) : undefined });
        report.applied.push(sid);
      } catch (e) {
        report.errors.push(`${f.name}: ${e.message || e}`);
      }
    }
    for (const { sid, anim, f } of anims) {
      try { await this.addAnimation(sid, anim, f, { persist, notify }); report.applied.push(`${sid}@${anim}`); } catch (e) { report.errors.push(`${f.name}: ${e.message || e}`); }
    }
    return report;
  }

  // Match a single file to a slot by its name.
  slotForFile(name) {
    const { slot } = parseAssetName(name);
    return this.slots.has(slot) ? slot : null;
  }

  categories() {
    const ORDER = ['Characters', 'Creatures', 'Weapons', 'Buildings', 'Props', 'Nature', 'Textures', 'Icons: items', 'Icons: abilities', 'Icons: effects', 'Audio: music', 'Audio: ambience', 'Audio: effects'];
    const cats = new Map();
    const names = [...new Set([...this.slots.values()].filter((s) => !s.hidden).map((s) => s.category))];
    names.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
    for (const n of names) cats.set(n, []);
    for (const s of this.slots.values()) if (!s.hidden) cats.get(s.category).push(s);
    return cats;
  }
}

function collectSiblings(gltfFile, byName) {
  const dir = (gltfFile.relPath || gltfFile.name).replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  const out = {};
  for (const [path, f] of byName) {
    const pdir = path.split('/').slice(0, -1).join('/');
    if (pdir === dir && f !== gltfFile) out[path.split('/').pop()] = f;
  }
  return out;
}

export async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Keep URL alive until decoded; the image keeps its pixels afterwards.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function loadModelBlob(blob, fileName, extraFiles) {
  const ext = extOf(fileName);
  const manager = new THREE.LoadingManager();
  const urls = [];
  if (extraFiles) {
    const map = {};
    for (const [name, f] of Object.entries(extraFiles)) {
      const u = URL.createObjectURL(f);
      urls.push(u);
      map[name] = u;
    }
    manager.setURLModifier((url) => {
      const name = decodeURIComponent(url.split(/[\\/]/).pop());
      return map[name] || url;
    });
  }
  try {
    if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader(manager);
      const data = ext === 'glb' ? await blob.arrayBuffer() : await blob.text();
      const gltf = await new Promise((res, rej) => loader.parse(data, '', res, rej));
      return { scene: gltf.scene || gltf.scenes[0], animations: gltf.animations || [] };
    }
    if (ext === 'fbx') {
      const loader = new FBXLoader(manager);
      const obj = loader.parse(await blob.arrayBuffer(), '');
      return { scene: obj, animations: obj.animations || [] };
    }
    if (ext === 'obj') {
      const loader = new OBJLoader(manager);
      const obj = loader.parse(await blob.text());
      obj.traverse((o) => {
        if (o.isMesh && (!o.material || o.material.type === 'MeshPhongMaterial')) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.8 });
        }
      });
      return { scene: obj, animations: [] };
    }
    throw new Error(`Unsupported model format .${ext}`);
  } finally {
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 30000);
  }
}

export const registry = new AssetRegistry();
