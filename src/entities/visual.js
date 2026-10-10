// A model in the scene bound to an asset slot. Rebuilds itself when the slot is overridden
// and animates either procedurally (placeholders) or with the model's own clips (overrides).
import * as THREE from 'three';
import { registry, matchClip } from '../assets/registry.js';
import { ProceduralAnimator, BobAnimator } from './animator.js';

const BONE_PATTERNS = {
  grip_r: [/^grip_r$/i, /right.?hand$/i, /hand.?r$/i, /r.?hand$/i, /hand_r/i, /righthand/i, /wrist.?r/i],
  grip_l: [/^grip_l$/i, /left.?hand$/i, /hand.?l$/i, /l.?hand$/i, /hand_l/i, /lefthand/i, /wrist.?l/i],
  shield_l: [/^shield_l$/i, /left.?fore.?arm$/i, /forearm.?l/i, /lowerarm.?l/i, /left.?hand$/i, /hand.?l$/i],
  head: [/^head$/i, /head$/i],
};

export class Visual {
  constructor(slotId, opts = {}) {
    this.slotId = slotId;
    this.opts = opts;
    this.group = new THREE.Group();
    this.attachments = []; // { point, slot, obj, opts }
    this.flashT = 0;
    this.opacity = 1;
    this.height = opts.height || 1.8;
    this.loopState = 'idle';
    this.build();
    this.unsub = registry.onChange((id) => {
      if (this.dependsOn(this.slotId, id)) this.rebuild();
      else if (this.attachments.some((a) => this.dependsOn(a.slot, id))) this.rebuildAttachments();
    });
  }

  dependsOn(slot, changed) {
    let cur = slot;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      if (cur === changed) return true;
      seen.add(cur);
      const s = registry.slot(cur);
      cur = s && s.fallback;
    }
    return false;
  }

  build() {
    let root, clips = [], isOverride = false;
    const hasOverride = registry.resolveOverrideSlot(this.slotId);
    if (this.opts.buildPlaceholder && !hasOverride) {
      root = this.opts.buildPlaceholder();
      root.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
    } else {
      const inst = registry.instance(this.slotId, { cloneMaterials: true });
      root = inst.root;
      clips = inst.clips;
      isOverride = inst.isOverride;
    }
    root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    this.root = root;
    this.isOverride = isOverride;
    this.group.add(root);
    this.mixer = null;
    this.animator = null;
    if (!isOverride && root.userData.rig) {
      this.animator = new ProceduralAnimator(root);
    } else if (clips.length) {
      this.mixer = new THREE.AnimationMixer(root);
      this.clips = clips;
      this.actions = {};
      const mapping = registry.overrides.get(registry.resolveOverrideSlot(this.slotId))?.settings?.anims;
      for (const st of ['idle', 'walk', 'run', 'attack', 'cast', 'hit', 'death', 'jump', 'swim', 'sit']) {
        const clip = matchClip(clips, st, mapping);
        if (clip) this.actions[st] = this.mixer.clipAction(clip);
      }
      if (!this.actions.idle) this.actions.idle = this.mixer.clipAction(clips[0]);
      this.current = null;
      this.setLoop('idle', 0);
    } else {
      this.animator = new BobAnimator(root);
    }
    const box = new THREE.Box3().setFromObject(root);
    this.height = Math.max(0.3, box.max.y - box.min.y) || this.height;
    this.points = {};
    for (const [name, pats] of Object.entries(BONE_PATTERNS)) {
      let found = null;
      for (const p of pats) {
        root.traverse((o) => { if (!found && !o.isMesh && p.test(o.name)) found = o; });
        if (found) break;
      }
      this.points[name] = found;
    }
    this.rebuildAttachments();
    if (this.opacity < 1) this.setOpacity(this.opacity);
  }

  rebuild() {
    this.group.remove(this.root);
    for (const a of this.attachments) if (a.obj) a.obj.removeFromParent();
    this.build();
  }

  attach(point, slot, opts = {}) {
    this.detach(point);
    const a = { point, slot, opts, obj: null };
    this.attachments.push(a);
    this.mountAttachment(a);
  }
  detach(point) {
    for (const a of this.attachments.filter((x) => x.point === point)) if (a.obj) a.obj.removeFromParent();
    this.attachments = this.attachments.filter((x) => x.point !== point);
  }
  mountAttachment(a) {
    if (!a.slot) return;
    const parent = this.points[a.point];
    if (!parent) return;
    const obj = registry.instance(a.slot, { cloneMaterials: true }).root;
    const holder = new THREE.Group();
    holder.add(obj);
    if (a.point === 'grip_r' || a.point === 'grip_l') {
      if (a.opts.upright) holder.rotation.set(0.15, 0, 0);
      else holder.rotation.set(Math.PI / 2, 0, 0);
      if (a.opts.offsetY) obj.position.y = a.opts.offsetY;
    } else if (a.point === 'shield_l') {
      holder.rotation.set(0, Math.PI / 2, 0);
      holder.position.set(0.04, 0, 0);
    }
    if (this.isOverride) {
      // Compensate for bone scale (FBX bones are often in centimeters).
      parent.updateWorldMatrix(true, false);
      const ws = new THREE.Vector3();
      parent.getWorldScale(ws);
      this.group.updateWorldMatrix(true, false);
      const gs = new THREE.Vector3();
      this.group.getWorldScale(gs);
      holder.scale.setScalar(gs.x / (ws.x || 1));
    }
    parent.add(holder);
    a.obj = holder;
  }
  rebuildAttachments() {
    for (const a of this.attachments) {
      if (a.obj) a.obj.removeFromParent();
      a.obj = null;
      this.mountAttachment(a);
    }
  }

  setLoop(state, fade = 0.25) {
    this.loopState = state;
    if (!this.mixer) return;
    const act = this.actions[state] || (state === 'run' && this.actions.walk) || this.actions.idle;
    if (!act || act === this.current) return;
    act.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = act;
  }

  play(action, dur = 0.6) {
    if (this.animator) {
      this.animator.play(action, dur);
      return;
    }
    if (!this.mixer) return;
    if (action === 'revive') {
      if (this.actions.death) this.actions.death.stop();
      this.current = null;
      this.setLoop('idle', 0.1);
      return;
    }
    const key = action === 'slash' || action === 'stab' || action === 'overhead' ? 'attack' : action === 'channel' ? 'cast' : action;
    const act = this.actions[key];
    if (!act) return;
    if (key === 'death') {
      act.reset().setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.fadeIn(0.15).play();
      if (this.current) this.current.fadeOut(0.15);
      this.current = act;
      return;
    }
    act.reset().setLoop(action === 'channel' ? THREE.LoopRepeat : THREE.LoopOnce, action === 'channel' ? Infinity : 1);
    act.clampWhenFinished = false;
    act.setEffectiveTimeScale(Math.max(0.3, act.getClip().duration / dur));
    act.setEffectiveWeight(1);
    act.fadeIn(0.08).play();
    if (action !== 'channel') {
      clearTimeout(this._ot);
      this._ot = setTimeout(() => act.fadeOut(0.2), dur * 900);
    }
  }
  stop(action) {
    if (this.animator) this.animator.stop(action);
    else if (this.mixer) {
      const key = action === 'channel' ? 'cast' : action;
      if (this.actions[key]) this.actions[key].fadeOut(0.15);
    }
  }

  flash(color = 0xffffff, t = 0.12) {
    this.flashT = t;
    this.flashColor = color;
  }

  setOpacity(o) {
    this.opacity = o;
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.transparent = o < 1;
        mat.opacity = o;
        mat.depthWrite = o >= 1;
      }
    });
  }

  setVisible(v) { this.group.visible = v; }

  update(dt, st) {
    if (this.animator) this.animator.update(dt, st);
    else if (this.mixer) {
      if (st.dead) { /* death clip holds */ } else if (st.swim && this.actions.swim) this.setLoop('swim');
      else if (st.sit && this.actions.sit) this.setLoop('sit');
      else if (st.airborne && this.actions.jump) this.setLoop('jump', 0.15);
      else if (st.speed > 4 && this.actions.run) this.setLoop('run');
      else if (st.speed > 0.4) this.setLoop(this.actions.walk ? 'walk' : 'run');
      else this.setLoop('idle');
      if (this.current && (this.current === this.actions.walk || this.current === this.actions.run)) {
        const base = this.current === this.actions.run ? 6 : 2.6;
        this.current.setEffectiveTimeScale(Math.max(0.4, (st.speed || 0) / base));
      }
      this.mixer.update(dt);
    }
    if (this.flashT > 0 || this._flashing) {
      this.flashT -= dt;
      const on = this.flashT > 0;
      this._flashing = on;
      this.root.traverse((m) => {
        if (!m.isMesh || !m.material.emissive) return;
        if (m.userData.baseEmissive === undefined) {
          m.userData.baseEmissive = m.material.emissive.getHex();
          m.userData.baseEI = m.material.emissiveIntensity;
        }
        if (on) { m.material.emissive.setHex(this.flashColor); m.material.emissiveIntensity = 0.6; }
        else { m.material.emissive.setHex(m.userData.baseEmissive); m.material.emissiveIntensity = m.userData.baseEI; }
      });
    }
  }

  dispose() {
    this.unsub();
    this.group.removeFromParent();
    if (this.mixer) this.mixer.stopAllAction();
  }
}
