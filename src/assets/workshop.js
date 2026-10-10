// The Asset Workshop: browse every asset slot, preview it, and replace it with your own file.
// Files are matched to slots by name (e.g. "mob_mudsnapper.glb"). Overrides are saved in the
// browser and swap into the running game immediately.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { registry, extOf, kindForExt, parseAssetName, ANIM_STATES, matchClip } from './registry.js';
import { ProceduralAnimator } from '../entities/animator.js';
import { h, clear } from '../ui/dom.js';
import { makeZip } from './zip.js';

const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const EXT_FOR = { model: 'glb', texture: 'png', icon: 'png', audio: 'ogg' };
const ACCEPT = { model: '.glb,.gltf,.fbx,.obj', texture: 'image/*', icon: 'image/*', audio: 'audio/*,.ogg,.mp3,.wav' };

export class Workshop {
  constructor(game, onClose) {
    this.game = game;
    this.onClose = onClose;
    this.selected = null;
    this.filter = '';
    this.collapsed = new Set(['Icons: items', 'Icons: abilities', 'Icons: effects', 'Audio: effects', 'Audio: music', 'Audio: ambience', 'Nature', 'Props', 'Textures', 'Buildings', 'Weapons']);
    this.previewState = 'idle';
    this.el = h('div', { class: 'menu-screen workshop' });
    this.build();
    registry.onChange((id) => { this.renderList(); if (id === this.selected) this.select(id, true); });
  }

  build() {
    const head = h('div', { class: 'ws-head' },
      h('div', { class: 'ws-title' }, h('h2', {}, 'Asset Workshop'), h('span', { class: 'ws-sub' }, 'Replace any placeholder with your own model, texture, icon or sound. Changes apply instantly and are saved in this browser.')),
      h('div', { class: 'ws-actions' },
        this.fileBtn('Import files…', true, null, (files) => this.importMany(files)),
        this.folderBtn(),
        'showDirectoryPicker' in window && !inFrame ? h('button', { class: 'btn', title: 'Pick a folder and keep watching it for changes (Chrome/Edge)', onclick: () => this.linkFolder() }, 'Link folder (live)') : null,
        h('button', { class: 'btn', title: 'Download every placeholder as a starting point for your own art', onclick: () => this.exportKit() }, 'Download asset kit'),
        h('button', { class: 'btn btn-dim', onclick: () => this.confirmReset() }, 'Reset all'),
        h('button', { class: 'btn btn-big', onclick: () => this.requestClose() }, 'Done'),
      ));
    this.search = h('input', { id: 'ws-search', class: 'text-input', placeholder: 'Search slots…', 'aria-label': 'Search asset slots' });
    this.search.addEventListener('input', () => { this.filter = this.search.value.toLowerCase(); this.renderList(); });
    this.listEl = h('div', { class: 'ws-list' });
    this.side = h('div', { class: 'ws-side' }, this.search, this.listEl);
    this.canvasWrap = h('div', { class: 'ws-preview' });
    this.previewCtl = h('div', { class: 'ws-preview-ctl' });
    this.center = h('div', { class: 'ws-center' }, this.canvasWrap, this.previewCtl);
    this.info = h('div', { class: 'ws-info' });
    this.status = h('div', { class: 'ws-status' }, inFrame ? 'Tip: downloads are disabled in this embedded view. Open Play.html directly to export the asset kit.' : 'Drag files or a whole folder anywhere onto this window. Name files after their slot id.');
    this.dropHint = h('div', { class: 'ws-drop', hidden: true }, h('div', {}, 'Drop to import'));
    this.el.append(head, h('div', { class: 'ws-main' }, this.side, this.center, this.info), this.status, this.dropHint);
    // Drag & drop anywhere on the workshop.
    this.el.addEventListener('dragover', (e) => { e.preventDefault(); this.dropHint.hidden = false; });
    this.el.addEventListener('dragleave', (e) => { if (e.target === this.dropHint || !this.el.contains(e.relatedTarget)) this.dropHint.hidden = true; });
    this.el.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.dropHint.hidden = true;
      const files = await filesFromDrop(e.dataTransfer);
      if (files.length === 1 && this.selected && !registry.slotForFile(files[0].name)) await this.assign(this.selected, files[0]);
      else await this.importMany(files);
    });
  }

  fileBtn(label, multiple, accept, cb) {
    const inp = h('input', { type: 'file', hidden: true, multiple: multiple || undefined, accept: accept || undefined });
    inp.addEventListener('change', () => { const f = [...inp.files]; inp.value = ''; if (f.length) cb(f); });
    return h('label', { class: 'btn file-btn' }, label, inp);
  }

  folderBtn() {
    const inp = h('input', { type: 'file', hidden: true, webkitdirectory: true, multiple: true });
    inp.addEventListener('change', () => {
      const files = [...inp.files].map((f) => { f.relPath = f.webkitRelativePath || f.name; return f; });
      inp.value = '';
      if (files.length) this.importMany(files);
    });
    return h('label', { class: 'btn file-btn', title: 'Import every matching file from a folder' }, 'Import folder…', inp);
  }

  setStatus(msg, bad = false) {
    this.status.textContent = msg;
    this.status.classList.toggle('bad', bad);
  }

  onShow() {
    this.renderList();
    if (!this.selected) this.select('mob_mudsnapper');
    else this.select(this.selected, true);
    this.startPreview();
    this.checkStoredFolder();
  }
  onHide() { this.stopPreview(); }
  requestClose() { this.onClose(); }
  update() {}

  // ------------------------------------------------------------------ list
  renderList() {
    clear(this.listEl);
    const cats = registry.categories();
    for (const [cat, slots] of cats) {
      const shown = slots.filter((s) => !this.filter || s.id.includes(this.filter) || (s.label || '').toLowerCase().includes(this.filter));
      if (!shown.length) continue;
      const custom = shown.filter((s) => registry.hasOverride(s.id)).length;
      const open = !this.collapsed.has(cat) || this.filter;
      const head = h('button', { class: `ws-cat ${open ? 'open' : ''}`, onclick: () => { if (this.collapsed.has(cat)) this.collapsed.delete(cat); else this.collapsed.add(cat); this.renderList(); } },
        h('span', {}, cat), h('span', { class: 'ws-cat-count' }, custom ? `${custom}/${shown.length}` : `${shown.length}`));
      this.listEl.append(head);
      if (!open) continue;
      for (const s of shown) {
        const ov = registry.overrides.get(s.id);
        const err = registry.loadErrors.get(s.id);
        this.listEl.append(h('button', { class: `ws-item ${this.selected === s.id ? 'on' : ''} ${ov ? 'custom' : ''} ${err ? 'error' : ''}`, onclick: () => this.select(s.id) },
          h('span', { class: 'ws-dot', title: ov ? 'Custom asset' : 'Placeholder' }), h('span', { class: 'ws-label' }, s.label), h('span', { class: 'ws-id' }, s.id)));
      }
    }
  }

  // ------------------------------------------------------------------ details
  select(id, keepView = false) {
    const slot = registry.slot(id);
    if (!slot) return;
    this.selected = id;
    if (!keepView) { this.previewState = 'idle'; this.collapsed.delete(slot.category); }
    this.renderList();
    this.renderInfo();
    this.showPreview();
  }

  renderInfo() {
    const id = this.selected, slot = registry.slot(id);
    const ov = registry.overrides.get(id);
    clear(this.info);
    const ext = EXT_FOR[slot.kind];
    const fileName = `${id}.${ext}`;
    this.info.append(h('h3', {}, slot.label), h('div', { class: 'ws-kind' }, `${slot.kind === 'icon' ? 'Icon' : slot.kind[0].toUpperCase() + slot.kind.slice(1)} slot`));
    const copy = h('button', { class: 'btn btn-small', onclick: () => { try { navigator.clipboard.writeText(id).then(() => this.setStatus(`Copied "${id}"`), () => {}); } catch (e) { /* ignore */ } } }, 'Copy id');
    this.info.append(h('div', { class: 'ws-field' }, h('span', { class: 'ws-k' }, 'Slot id'), h('code', {}, id), copy));
    this.info.append(h('div', { class: 'ws-field' }, h('span', { class: 'ws-k' }, 'File name'), h('code', {}, slot.kind === 'model' ? `${id}.glb / .gltf / .fbx / .obj` : slot.kind === 'audio' ? `${id}.ogg / .mp3 / .wav` : `${id}.png / .jpg / .webp`)));
    if (slot.description) this.info.append(h('p', { class: 'ws-desc' }, slot.description));
    if (slot.fallback) this.info.append(h('p', { class: 'ws-desc dim' }, `If empty, uses your override for "${slot.fallback}" when you have one.`));
    if (slot.kind === 'model') {
      const ph = registry.placeholder(id);
      const sz = ph.size;
      this.info.append(h('div', { class: 'ws-field' }, h('span', { class: 'ws-k' }, 'Placeholder size'), h('span', {}, `${sz.x.toFixed(2)} × ${sz.y.toFixed(2)} × ${sz.z.toFixed(2)} m (W × H × D)`)));
      this.info.append(h('p', { class: 'ws-desc dim' }, 'Model with Y up, facing +Z (Blender: front view, -Y forward), feet or base at the origin. Size is fitted automatically.'));
      if (slot.anims) this.info.append(h('div', { class: 'ws-field col' }, h('span', { class: 'ws-k' }, 'Animation names'), h('span', { class: 'ws-anims' }, slot.anims.join(', ')), h('span', { class: 'dim small' }, `Add separate animation files as ${id}@walk.fbx, ${id}@attack.glb, and so on.`)));
    }
    // Current override
    const box = h('div', { class: 'ws-override' });
    if (ov) {
      box.append(h('div', { class: 'ws-field' }, h('span', { class: 'ws-k' }, 'Using'), h('b', {}, ov.fileName), h('span', { class: 'ws-src' }, ov.source === 'baked' ? 'built into Play.html' : ov.source === 'folder' ? 'linked folder' : 'saved in browser')));
      const err = registry.loadErrors.get(id);
      if (err) box.append(h('div', { class: 'ws-error' }, err));
      if (slot.kind === 'model') this.renderModelSettings(box, id, ov);
      if (ov.source !== 'baked') box.append(h('button', { class: 'btn btn-dim', onclick: async () => { await registry.removeOverride(id); this.setStatus(`Restored the placeholder for ${id}.`); } }, 'Remove custom asset'));
    } else {
      box.append(h('div', { class: 'ws-field' }, h('span', { class: 'ws-k' }, 'Using'), h('span', {}, 'Procedural placeholder')));
    }
    box.append(h('div', { class: 'ws-buttons' },
      this.fileBtn(ov ? 'Replace…' : 'Choose file…', false, ACCEPT[slot.kind], (files) => this.assign(id, files[0])),
      slot.kind === 'model' && ov ? this.fileBtn('Add animation…', true, '.glb,.gltf,.fbx', (files) => this.addAnims(id, files)) : null,
      slot.kind !== 'audio' ? h('button', { class: 'btn', disabled: inFrame || undefined, title: inFrame ? 'Open Play.html directly to download' : '', onclick: () => this.downloadPlaceholder(id) }, slot.kind === 'model' ? 'Download placeholder .glb' : 'Download placeholder .png') : null,
    ));
    this.info.append(box);
  }

  renderModelSettings(box, id, ov) {
    const rec = registry.models.get(id);
    const st = ov.settings || {};
    const fit = h('select', { id: 'ws-fit', 'aria-label': 'Size fitting' },
      ...[['', `Automatic (${registry.slot(id).fit || 'height'})`], ['height', 'Match placeholder height'], ['bounds', 'Match placeholder footprint'], ['none', 'Use model units (meters)']].map(([v, l]) => h('option', { value: v }, l)));
    fit.value = st.fit || '';
    const num = (key, label, step, def) => {
      const inp = h('input', { type: 'number', step, value: st[key] ?? def, class: 'num-input', 'aria-label': label });
      inp.addEventListener('change', () => registry.updateSettings(id, { [key]: +inp.value }));
      return h('label', { class: 'ws-num' }, h('span', {}, label), inp);
    };
    fit.addEventListener('change', () => registry.updateSettings(id, { fit: fit.value || null }));
    box.append(h('div', { class: 'ws-settings' }, h('label', { class: 'ws-num' }, h('span', {}, 'Fit'), fit), num('scale', 'Scale', 0.05, 1), num('rotY', 'Turn (°)', 15, 0), num('offsetY', 'Raise (m)', 0.05, 0)));
    if (rec) {
      box.append(h('div', { class: 'dim small' }, `Raw size ${rec.rawSize.x.toFixed(2)} × ${rec.rawSize.y.toFixed(2)} × ${rec.rawSize.z.toFixed(2)}, scaled ×${rec.appliedScale.toFixed(3)}`));
      if (rec.clips.length) {
        const slot = registry.slot(id);
        const map = h('div', { class: 'ws-animmap' });
        for (const state of slot.anims || ANIM_STATES) {
          const sel = h('select', { 'aria-label': `Clip for ${state}` }, h('option', { value: '' }, '(auto)'), ...rec.clips.map((c) => h('option', { value: c.name }, c.name)));
          sel.value = st.anims?.[state] || '';
          const auto = matchClip(rec.clips, state, st.anims);
          sel.addEventListener('change', () => registry.updateSettings(id, { anims: { ...(st.anims || {}), [state]: sel.value || undefined } }));
          map.append(h('label', { class: 'ws-num' }, h('span', {}, state), sel, h('span', { class: 'dim small' }, auto ? `→ ${auto.name}` : 'missing')));
        }
        box.append(h('div', { class: 'ws-k' }, `Animations (${rec.clips.length} clips found)`), map);
      } else {
        box.append(h('div', { class: 'dim small' }, 'No animation clips found. The game will bob and tilt the model instead.'));
      }
    }
  }

  async assign(id, file) {
    const slot = registry.slot(id);
    const kind = kindForExt(extOf(file.name));
    const ok = (slot.kind === 'model' && kind === 'model') || ((slot.kind === 'texture' || slot.kind === 'icon') && kind === 'image') || (slot.kind === 'audio' && kind === 'audio');
    if (!ok) { this.setStatus(`"${file.name}" is not a ${slot.kind} file.`, true); return; }
    this.setStatus(`Loading ${file.name}…`);
    try {
      await registry.setOverride(id, file);
      this.setStatus(`${file.name} is now used for ${id}.`);
    } catch (e) {
      console.error(e);
      registry.loadErrors.set(id, String(e.message || e));
      this.setStatus(`Could not load ${file.name}: ${e.message || e}`, true);
      await registry.removeOverride(id).catch(() => {});
    }
    this.select(id, true);
  }

  async addAnims(id, files) {
    for (const f of files) {
      const p = parseAssetName(f.name);
      const anim = p.anim || prompt2(f.name);
      try {
        await registry.addAnimation(id, anim, f);
        this.setStatus(`Added animation "${anim}" from ${f.name}.`);
      } catch (e) { this.setStatus(`Could not add ${f.name}: ${e.message}`, true); }
    }
    this.select(id, true);
  }

  async importMany(files) {
    if (!files.length) return;
    this.setStatus(`Importing ${files.length} file(s)…`);
    const r = await registry.importFiles(files);
    const parts = [];
    if (r.applied.length) parts.push(`Imported ${r.applied.length}: ${r.applied.slice(0, 6).join(', ')}${r.applied.length > 6 ? '…' : ''}`);
    if (r.skipped.length) parts.push(`${r.skipped.length} file(s) did not match a slot name (e.g. ${r.skipped[0]})`);
    if (r.errors.length) parts.push(`Errors: ${r.errors.slice(0, 2).join('; ')}`);
    this.setStatus(parts.join(' · ') || 'Nothing matched. Name files after slot ids, e.g. tex_grass.png.', !r.applied.length);
    if (r.applied[0]) this.select(r.applied[0].split('@')[0], true);
  }

  confirmReset() {
    const n = [...registry.overrides.values()].filter((o) => o.source !== 'baked').length;
    if (!n) { this.setStatus('There are no custom assets to reset.'); return; }
    clear(this.status);
    this.status.append(`Remove all ${n} custom assets and restore every placeholder? `,
      h('button', { class: 'btn btn-small', onclick: async () => { await registry.clearAll(); this.setStatus('All placeholders restored.'); } }, 'Reset all'),
      ' ', h('button', { class: 'btn btn-small btn-dim', onclick: () => this.setStatus('Kept your assets.') }, 'Cancel'));
  }

  // ------------------------------------------------------------------ live folder link
  async linkFolder() {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      this.dirHandle = dir;
      try { await registry.store.setMeta('folder', dir); } catch (e) { /* not persistable */ }
      await this.scanFolder(true);
      this.startWatch();
    } catch (e) {
      if (e.name !== 'AbortError') this.setStatus(`Could not open the folder: ${e.message}`, true);
    }
  }

  async checkStoredFolder() {
    if (this.dirHandle || inFrame || !('showDirectoryPicker' in window)) return;
    try {
      const dir = await registry.store.getMeta('folder');
      if (!dir) return;
      clear(this.status);
      this.status.append(`Reconnect your linked folder "${dir.name}"? `, h('button', { class: 'btn btn-small', onclick: async () => {
        const perm = await dir.requestPermission({ mode: 'read' });
        if (perm === 'granted') { this.dirHandle = dir; await this.scanFolder(true); this.startWatch(); }
      } }, 'Reconnect'));
    } catch (e) { /* ignore */ }
  }

  async scanFolder(force) {
    const files = [];
    const walk = async (dir, prefix) => {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'directory') await walk(handle, `${prefix}${name}/`);
        else { const f = await handle.getFile(); f.relPath = prefix + name; files.push(f); }
      }
    };
    await walk(this.dirHandle, '');
    this.seen = this.seen || new Map();
    const changed = files.filter((f) => force || this.seen.get(f.relPath) !== f.lastModified);
    for (const f of files) this.seen.set(f.relPath, f.lastModified);
    if (!changed.length) return;
    const all = force ? files : changed.concat(files.filter((f) => f.name.endsWith('.bin') || kindForExt(extOf(f.name)) === 'image'));
    const r = await registry.importFiles(all.length ? all : changed, { persist: false });
    this.setStatus(`Linked folder "${this.dirHandle.name}": ${r.applied.length} asset(s) loaded${force ? '' : ' (changed on disk)'}. Watching for changes…`);
  }

  startWatch() {
    clearInterval(this.watchT);
    this.watchT = setInterval(() => { if (this.dirHandle) this.scanFolder(false).catch(() => {}); }, 2000);
  }

  // ------------------------------------------------------------------ export
  async downloadPlaceholder(id) {
    const slot = registry.slot(id);
    if (slot.kind === 'model') {
      const buf = await exportGLB(registry.placeholder(id).root);
      download(new Blob([buf], { type: 'model/gltf-binary' }), `${id}.glb`);
    } else {
      const canvas = slot.kind === 'icon' ? slot.build() : registry.texture(id).userData.placeholder;
      canvas.toBlob((b) => download(b, `${id}.png`), 'image/png');
    }
  }

  async exportKit() {
    if (inFrame) { this.setStatus('Downloads are disabled in this embedded view. Open Play.html directly to export the asset kit.', true); return; }
    const entries = [];
    const slots = [...registry.slots.values()].filter((s) => !s.hidden);
    let i = 0;
    const manifest = [];
    for (const s of slots) {
      i++;
      if (i % 4 === 0) { this.setStatus(`Exporting placeholders… ${i}/${slots.length}`); await new Promise((r) => setTimeout(r, 0)); }
      const m = { id: s.id, kind: s.kind, category: s.category, label: s.label };
      try {
        if (s.kind === 'model') {
          const ph = registry.placeholder(s.id);
          m.size = [+ph.size.x.toFixed(3), +ph.size.y.toFixed(3), +ph.size.z.toFixed(3)];
          if (s.anims) m.animations = s.anims;
          entries.push({ name: `models/${s.id}.glb`, data: new Uint8Array(await exportGLB(ph.root, 256)) });
        } else if (s.kind === 'texture' || s.kind === 'icon') {
          const canvas = s.kind === 'icon' ? s.build() : registry.texture(s.id).userData.placeholder;
          const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
          entries.push({ name: `${s.kind === 'icon' ? 'icons' : 'textures'}/${s.id}.png`, data: blob });
        }
      } catch (e) {
        console.warn('Export failed for', s.id, e);
      }
      manifest.push(m);
    }
    entries.push({ name: 'slots.json', data: JSON.stringify(manifest, null, 2) });
    entries.push({ name: 'README.txt', data: KIT_README });
    this.setStatus('Packing zip…');
    const zip = await makeZip(entries);
    download(zip, 'brackwater-asset-kit.zip');
    this.setStatus(`Asset kit downloaded (${(zip.size / 1024 / 1024).toFixed(1)} MB). Edit any file, keep its name, and drop it back in here.`);
  }

  // ------------------------------------------------------------------ preview
  startPreview() {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x26211b);
      this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x3a3020, 2.2));
      const d = new THREE.DirectionalLight(0xfff0dd, 2.5);
      d.position.set(4, 8, 6);
      this.scene.add(d);
      this.grid = new THREE.GridHelper(20, 20, 0x6a5a40, 0x3a3226);
      this.scene.add(this.grid);
      this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
      this.holder = new THREE.Group();
      this.scene.add(this.holder);
      this.ref = makeReferenceFigure();
      this.scene.add(this.ref);
      this.orbit = { yaw: 0.6, pitch: 0.25, dist: 4, auto: true };
      const c = this.renderer.domElement;
      c.addEventListener('pointerdown', (e) => {
        this.orbit.auto = false;
        const sx = e.clientX, sy = e.clientY, y0 = this.orbit.yaw, p0 = this.orbit.pitch;
        const move = (ev) => { this.orbit.yaw = y0 - (ev.clientX - sx) * 0.01; this.orbit.pitch = Math.max(-0.2, Math.min(1.4, p0 + (ev.clientY - sy) * 0.01)); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
      c.addEventListener('wheel', (e) => { e.preventDefault(); this.orbit.dist *= e.deltaY > 0 ? 1.1 : 0.9; }, { passive: false });
      this.clock = new THREE.Clock();
    }
    this.canvasWrap.append(this.renderer.domElement);
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      this.renderPreview(this.clock.getDelta());
    };
    tick();
  }

  stopPreview() { this.running = false; if (this.audioEl) this.audioEl.pause(); }

  showPreview() {
    if (!this.holder) return;
    clear(this.previewCtl);
    for (const c of [...this.holder.children]) this.holder.remove(c);
    this.mixer = null;
    this.anim = null;
    this.texPlane = null;
    const slot = registry.slot(this.selected);
    this.ref.visible = slot.kind === 'model';
    this.grid.visible = slot.kind === 'model';
    if (slot.kind === 'model') {
      let inst;
      if (slot.dynamic && !registry.resolveOverrideSlot(slot.id) && this.game.player) {
        inst = { root: registry.instance(slot.id).root, clips: [] };
      } else inst = registry.instance(slot.id);
      const root = inst.root;
      this.holder.add(root);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const big = Math.max(size.x, size.y, size.z, 0.5);
      this.ref.position.set(-(Math.max(size.x / 2, 0.3) + 0.7), 0, -0.3);
      this.ref.visible = big < 30;
      this.focusY = size.y * 0.5;
      this.orbit.dist = Math.max(2.2, big * 1.9 + 1);
      if (inst.isOverride && inst.clips.length) {
        this.mixer = new THREE.AnimationMixer(root);
        this.clips = inst.clips;
      } else if (root.userData.rig) {
        this.anim = new ProceduralAnimator(root);
      }
      const states = slot.anims || [];
      if (states.length && (this.mixer || this.anim)) {
        for (const st of states) {
          this.previewCtl.append(h('button', { class: `chip ${this.previewState === st ? 'on' : ''}`, onclick: () => { this.previewState = st; this.playPreviewState(); this.showPreviewButtons(states); } }, st));
        }
        this.playPreviewState();
      }
      this.previewCtl.append(h('span', { class: 'dim small' }, 'Drag to orbit · scroll to zoom'));
    } else if (slot.kind === 'texture') {
      const tex = registry.texture(slot.id).clone();
      tex.repeat.set(3, 3);
      tex.needsUpdate = true;
      const mat = slot.linear ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), mat);
      plane.rotation.x = -Math.PI / 2.6;
      plane.position.y = 0.9;
      this.holder.add(plane);
      this.texPlane = plane;
      this.focusY = 0.9; this.orbit.dist = 3.6; this.orbit.yaw = 0; this.orbit.pitch = 0.5;
      this.previewCtl.append(h('span', { class: 'dim small' }, 'Shown tiled 3×3 so you can check seams.'));
    } else if (slot.kind === 'icon') {
      const img = h('img', { class: 'ws-icon-preview', src: registry.iconURL(slot.id), alt: slot.label });
      this.previewCtl.append(img, h('span', { class: 'dim small' }, 'Icons are shown at 40–64 px in game.'));
    } else if (slot.kind === 'audio') {
      const ov = registry.overrides.get(slot.id);
      const play = h('button', { class: 'btn btn-big', onclick: () => {
        if (ov) {
          if (this.audioEl) this.audioEl.pause();
          this.audioEl = new Audio(URL.createObjectURL(ov.blob));
          this.audioEl.volume = 0.8;
          this.audioEl.play().catch(() => {});
        } else {
          this.game.audio.unlock();
          const name = slot.id.replace(/^sfx_/, '');
          if (slot.id.startsWith('sfx_')) this.game.audio.play(name, null, 1);
          else this.setStatus('The generated score and ambience play in the world; replace this slot to hear your own track.');
        }
      } }, '▶ Play');
      this.previewCtl.append(play, h('span', { class: 'dim small' }, ov ? ov.fileName : 'Generated sound'));
    }
  }

  showPreviewButtons(states) {
    for (const b of this.previewCtl.querySelectorAll('.chip')) b.classList.toggle('on', b.textContent === this.previewState);
    void states;
  }

  playPreviewState() {
    const st = this.previewState;
    if (this.mixer) {
      this.mixer.stopAllAction();
      const ov = registry.overrides.get(registry.resolveOverrideSlot(this.selected));
      const clip = matchClip(this.clips, st, ov?.settings?.anims) || this.clips[0];
      if (clip) this.mixer.clipAction(clip).reset().play();
    } else if (this.anim) {
      this.animState = st;
      if (['attack', 'cast', 'hit', 'death'].includes(st)) this.anim.play(st === 'attack' ? 'slash' : st, st === 'death' ? 1 : 0.8);
      if (st !== 'death') this.anim.play('revive');
    }
  }

  renderPreview(dt) {
    const wrap = this.canvasWrap;
    const w = wrap.clientWidth, hgt = wrap.clientHeight;
    if (!w || !hgt) return;
    const c = this.renderer.domElement;
    if (c.width !== Math.floor(w * this.renderer.getPixelRatio()) || c.height !== Math.floor(hgt * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, hgt, false);
      c.style.width = '100%'; c.style.height = '100%';
      this.camera.aspect = w / hgt;
      this.camera.updateProjectionMatrix();
    }
    if (this.orbit.auto) this.orbit.yaw += dt * 0.4;
    const o = this.orbit;
    const fy = this.focusY ?? 0.9;
    this.camera.position.set(Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, fy + Math.sin(o.pitch) * o.dist, Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    this.camera.lookAt(0, fy, 0);
    if (this.mixer) this.mixer.update(dt);
    if (this.anim) {
      const st = this.animState || this.previewState;
      const speed = st === 'walk' ? 2.4 : st === 'run' ? 6 : 0;
      this.anim.update(dt, { speed, airborne: st === 'jump', swim: st === 'swim', sit: st === 'sit' });
      if ((st === 'attack' || st === 'cast' || st === 'hit') && !this.anim.actions.length) this.anim.play(st === 'attack' ? 'slash' : st, 0.8);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------- helpers
function makeReferenceFigure() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.25, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 4, 10), m);
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), m);
  head.position.y = 1.62;
  g.add(body, head);
  g.name = 'reference 1.8 m';
  return g;
}

async function exportGLB(root, maxTextureSize = 1024) {
  const exporter = new GLTFExporter();
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  return new Promise((res, rej) => exporter.parse(clone, res, rej, { binary: true, maxTextureSize, onlyVisible: true }));
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

async function filesFromDrop(dt) {
  const out = [];
  const items = dt.items ? [...dt.items] : [];
  const entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return [...dt.files];
  const readEntry = (entry, prefix) => new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f) => { f.relPath = prefix + f.name; out.push(f); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const read = () => reader.readEntries(async (batch) => {
        if (!batch.length) {
          for (const e of all) await readEntry(e, `${prefix}${entry.name}/`);
          resolve();
        } else { all.push(...batch); read(); }
      }, () => resolve());
      read();
    } else resolve();
  });
  for (const e of entries) await readEntry(e, '');
  return out;
}

function prompt2(fileName) {
  // Guess an animation name from the file name ("Walking.fbx" -> walk).
  const n = fileName.toLowerCase();
  for (const s of ANIM_STATES) if (n.includes(s)) return s;
  if (n.includes('walking')) return 'walk';
  if (n.includes('running')) return 'run';
  if (n.includes('dying')) return 'death';
  return 'idle';
}

const KIT_README = `ISLE OF BRACKWATER — ASSET KIT
==============================

Every file in this kit is a placeholder from the game. Edit or replace any of them,
keep the file name, and drop the file (or the whole folder) into the Asset Workshop
(F10 in game, or "Asset Workshop" on the title screen). Your files are saved in the
browser and used every time you play.

  models/    .glb models. Y is up, the model faces +Z (Blender: -Y forward), base at the origin.
             You may also use .gltf, .fbx or .obj with the same base name.
             Size is matched to the placeholder automatically (change "Fit" in the Workshop).
  textures/  Tiling textures (.png/.jpg/.webp). Any size; 512, 1024 or 2048 square work best.
  icons/     Square item and ability icons, 64x64 or larger.
  slots.json Every slot id with its kind, size in meters and expected animation names.

CHARACTERS & ANIMATION
  Name clips idle, walk, run, attack, cast, hit, death, jump, swim, sit (partial names
  like "Armature|Walk" are matched automatically). You can also add one animation per
  file named <slot>@<anim>, e.g. char_player@walk.fbx (handy for Mixamo).
  Weapons attach to a bone whose name contains "RightHand" / "hand_r"; shields to the left forearm.

AUDIO
  Sound slots (sfx_*, music_*, amb_*) accept .ogg, .mp3 or .wav files named after the slot.

BAKING ASSETS INTO THE GAME
  To ship your art inside Play.html, put the files in the project's assets/models,
  assets/textures, assets/icons or assets/audio folders and run "npm run build".
`;
