// Procedural animation for the placeholder rigs (humanoid, crab, quadruped, bird, tentacles, chest).
// Overridden models with animation clips use AnimationMixer instead (see visual.js).
import * as THREE from 'three';

const ss = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// Keyframed action poses: [t, {joint: [rx, ry, rz]}]
const ACTIONS = {
  slash: [
    [0, {}],
    [0.35, { upperarm_r: [-2.5, 0, -0.35], elbow_r: [-1.1, 0, 0], chest: [0, 0.4, 0], spine: [-0.08, 0.1, 0], upperarm_l: [-0.4, 0, 0.25] }],
    [0.55, { upperarm_r: [-0.5, 0, 0.35], elbow_r: [-0.15, 0, 0], chest: [0.1, -0.45, 0], spine: [0.15, -0.1, 0], upperarm_l: [0.2, 0, 0.2] }],
    [1, {}],
  ],
  stab: [
    [0, {}],
    [0.3, { upperarm_r: [-0.6, 0, -0.2], elbow_r: [-1.6, 0, 0], chest: [0, 0.35, 0] }],
    [0.5, { upperarm_r: [-1.45, 0, 0.05], elbow_r: [-0.1, 0, 0], chest: [0.1, -0.3, 0], spine: [0.15, 0, 0] }],
    [1, {}],
  ],
  overhead: [
    [0, {}],
    [0.4, { upperarm_r: [-2.9, 0, 0.1], upperarm_l: [-2.9, 0, -0.1], elbow_r: [-0.5, 0, 0], elbow_l: [-0.5, 0, 0], spine: [-0.15, 0, 0] }],
    [0.6, { upperarm_r: [-0.9, 0, 0.2], upperarm_l: [-0.9, 0, -0.2], elbow_r: [-0.2, 0, 0], elbow_l: [-0.2, 0, 0], spine: [0.3, 0, 0] }],
    [1, {}],
  ],
  cast: [
    [0, {}],
    [0.35, { upperarm_r: [-1.3, 0, 0.25], upperarm_l: [-1.3, 0, -0.25], elbow_r: [-0.7, 0, 0], elbow_l: [-0.7, 0, 0], head: [-0.15, 0, 0] }],
    [0.7, { upperarm_r: [-1.75, 0, 0.1], upperarm_l: [-1.75, 0, -0.1], elbow_r: [-0.1, 0, 0], elbow_l: [-0.1, 0, 0], spine: [0.1, 0, 0] }],
    [1, {}],
  ],
  channel: [
    [0, { upperarm_r: [-0.9, 0, 0.5], upperarm_l: [-0.9, 0, -0.5], elbow_r: [-1.2, 0, 0], elbow_l: [-1.2, 0, 0], head: [-0.1, 0, 0] }],
    [1, { upperarm_r: [-0.9, 0, 0.5], upperarm_l: [-0.9, 0, -0.5], elbow_r: [-1.2, 0, 0], elbow_l: [-1.2, 0, 0], head: [-0.1, 0, 0] }],
  ],
  hit: [
    [0, {}],
    [0.2, { spine: [-0.3, 0, 0], chest: [-0.15, 0.1, 0], head: [-0.25, 0, 0], upperarm_r: [0.3, 0, -0.3], upperarm_l: [0.3, 0, 0.3] }],
    [1, {}],
  ],
  use: [
    [0, {}],
    [0.4, { upperarm_r: [-1.3, 0, 0], elbow_r: [-0.3, 0, 0], spine: [0.25, 0, 0], head: [0.2, 0, 0] }],
    [0.7, { upperarm_r: [-1.3, 0, 0], elbow_r: [-0.3, 0, 0], spine: [0.25, 0, 0], head: [0.2, 0, 0] }],
    [1, {}],
  ],
  wave: [
    [0, {}],
    [0.2, { upperarm_r: [-2.6, 0, -0.5], elbow_r: [-0.6, 0, -0.3] }],
    [0.4, { upperarm_r: [-2.6, 0, -0.5], elbow_r: [-0.6, 0, 0.4] }],
    [0.6, { upperarm_r: [-2.6, 0, -0.5], elbow_r: [-0.6, 0, -0.3] }],
    [0.8, { upperarm_r: [-2.6, 0, -0.5], elbow_r: [-0.6, 0, 0.4] }],
    [1, {}],
  ],
  cheer: [
    [0, {}],
    [0.3, { upperarm_r: [-2.9, 0, -0.3], upperarm_l: [-2.9, 0, 0.3], elbow_r: [-0.3, 0, 0], elbow_l: [-0.3, 0, 0], head: [-0.3, 0, 0] }],
    [0.8, { upperarm_r: [-2.9, 0, -0.3], upperarm_l: [-2.9, 0, 0.3], elbow_r: [-0.3, 0, 0], elbow_l: [-0.3, 0, 0], head: [-0.3, 0, 0] }],
    [1, {}],
  ],
  talk: [
    [0, {}],
    [0.3, { upperarm_r: [-0.7, 0, 0.1], elbow_r: [-1.0, 0.3, 0], head: [0.05, 0.15, 0] }],
    [0.6, { upperarm_r: [-0.5, 0, 0.2], elbow_r: [-0.8, -0.3, 0], upperarm_l: [-0.3, 0, -0.2], head: [-0.05, -0.1, 0] }],
    [1, {}],
  ],
};

function samplePose(frames, t, out, w) {
  t = clamp01(t);
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1][0] < t) i++;
  const [t0, p0] = frames[i], [t1, p1] = frames[i + 1];
  const k = ss(clamp01((t - t0) / (t1 - t0 || 1)));
  const names = new Set([...Object.keys(p0), ...Object.keys(p1)]);
  for (const n of names) {
    const a = p0[n] || ZERO, b = p1[n] || ZERO;
    const o = out[n] || (out[n] = [0, 0, 0]);
    o[0] += (a[0] + (b[0] - a[0]) * k) * w;
    o[1] += (a[1] + (b[1] - a[1]) * k) * w;
    o[2] += (a[2] + (b[2] - a[2]) * k) * w;
  }
}
const ZERO = [0, 0, 0];

export class ProceduralAnimator {
  constructor(root) {
    this.root = root;
    this.rig = root.userData.rig || { type: 'static' };
    this.type = this.rig.type;
    this.joints = {};
    this.rest = {};
    root.traverse((o) => {
      if (o.isGroup || o.isBone || o.type === 'Object3D') {
        if (o.name && !this.joints[o.name]) {
          this.joints[o.name] = o;
          this.rest[o.name] = { r: o.rotation.clone(), p: o.position.clone() };
        }
      }
    });
    this.phase = Math.random() * 10;
    this.time = Math.random() * 10;
    this.actions = []; // { name, t, dur, weight }
    this.deathT = -1;
    this.pose = {};
    this.flap = 0;
  }

  play(name, dur = 0.6) {
    if (name === 'death') { this.deathT = 0; this.actions.length = 0; return; }
    if (name === 'revive') { this.deathT = -1; return; }
    let a = this.actions.find((x) => x.name === name);
    if (!a) { a = { name, t: 0, dur, loop: name === 'channel' }; this.actions.push(a); }
    a.t = 0; a.dur = dur;
  }
  stop(name) { this.actions = this.actions.filter((a) => a.name !== name); }

  // state: { speed, run (0..1), grounded, swim, sit, airborne }
  update(dt, st) {
    this.time += dt;
    const P = this.pose;
    for (const k in P) { P[k][0] = 0; P[k][1] = 0; P[k][2] = 0; }
    let hipsY = 0, rootRx = 0, rootRz = 0, rootY = 0;
    const speed = st.speed || 0;
    const add = (n, x, y = 0, z = 0) => {
      const o = P[n] || (P[n] = [0, 0, 0]);
      o[0] += x; o[1] += y; o[2] += z;
    };

    if (this.type === 'humanoid') {
      const k = (this.rig.height || 1.8) / 1.8;
      const runF = clamp01((speed - 2.5) / 3.5);
      const moving = clamp01(speed / 1.2);
      this.phase += dt * speed * (Math.PI / (0.75 + runF * 0.45)) / k;
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      const A = 0.42 + runF * 0.38;
      if (st.sit) {
        add('thigh_l', -1.5); add('thigh_r', -1.5); add('knee_l', 1.5); add('knee_r', 1.5);
        add('upperarm_l', -0.35, 0, 0.1); add('upperarm_r', -0.35, 0, -0.1); add('elbow_l', -0.9); add('elbow_r', -0.9);
        hipsY = -0.43 * k;
        add('chest', Math.sin(this.time * 1.4) * 0.02);
      } else if (st.swim) {
        add('spine', 0.9); add('head', -0.7);
        const sw = Math.sin(this.time * 3.2);
        add('upperarm_l', -2.2 + sw * 0.6, 0, -0.5 - sw * 0.5); add('upperarm_r', -2.2 + sw * 0.6, 0, 0.5 + sw * 0.5);
        add('elbow_l', -0.5); add('elbow_r', -0.5);
        add('thigh_l', 0.3 + Math.sin(this.time * 5) * 0.4); add('thigh_r', 0.3 - Math.sin(this.time * 5) * 0.4);
        add('knee_l', 0.4); add('knee_r', 0.4);
        hipsY = -0.2;
      } else if (st.airborne) {
        add('thigh_l', -0.7); add('thigh_r', -0.25); add('knee_l', 1.1); add('knee_r', 0.6);
        add('upperarm_l', -0.5, 0, 0.45); add('upperarm_r', -0.5, 0, -0.45); add('elbow_l', -0.6); add('elbow_r', -0.6);
      } else {
        // Idle breathing blended with locomotion.
        const idle = 1 - moving;
        const br = Math.sin(this.time * 1.7);
        add('chest', br * 0.025 * idle);
        add('upperarm_l', 0, 0, (0.09 + br * 0.015) * idle);
        add('upperarm_r', 0, 0, (-0.09 - br * 0.015) * idle);
        add('elbow_l', -0.15 * idle); add('elbow_r', -0.15 * idle);
        add('head', Math.sin(this.time * 0.5) * 0.04 * idle, Math.sin(this.time * 0.31) * 0.15 * idle);
        // Walk / run cycle.
        const back = st.backward ? -1 : 1;
        add('thigh_l', -s * A * moving * back); add('thigh_r', s * A * moving * back);
        add('knee_l', (Math.max(0, c * back) * (0.75 + runF * 0.6) + 0.08) * moving);
        add('knee_r', (Math.max(0, -c * back) * (0.75 + runF * 0.6) + 0.08) * moving);
        add('foot_l', Math.max(0, -c) * 0.25 * moving); add('foot_r', Math.max(0, c) * 0.25 * moving);
        add('upperarm_l', s * A * 0.85 * moving * back, 0, 0.06 * moving);
        add('upperarm_r', -s * A * 0.85 * moving * back, 0, -0.06 * moving);
        add('elbow_l', (-0.2 - runF * 0.95) * moving); add('elbow_r', (-0.2 - runF * 0.95) * moving);
        add('spine', runF * 0.16 * moving, s * 0.06 * moving);
        add('chest', 0, -s * 0.1 * moving);
        hipsY = Math.abs(c) * (0.025 + runF * 0.04) * moving - runF * 0.03 * moving;
        for (let i = 0; i < 4; i++) add(`tail${i}`, 0, Math.sin(this.time * 2 + i * 0.7) * 0.12 * (1 + moving), 0);
      }
      for (const a of this.actions) {
        const frames = ACTIONS[a.name] || ACTIONS.slash;
        samplePose(frames, a.loop ? (a.t / a.dur) % 1 : a.t / a.dur, P, 1);
      }
      if (this.deathT >= 0) {
        this.deathT += dt;
        const d = ss(clamp01(this.deathT / 0.7));
        rootRx = -1.48 * d;
        rootY = 0.14 * d * k;
        add('upperarm_l', -0.4 * d, 0, 1.0 * d); add('upperarm_r', -0.4 * d, 0, -1.0 * d);
        add('knee_l', 0.4 * d); add('thigh_l', -0.3 * d); add('head', 0.3 * d, 0.4 * d);
      }
      this.apply(P, hipsY, rootRx, rootRz, rootY);
    } else if (this.type === 'crab') {
      const moving = clamp01(speed / 1);
      this.phase += dt * (speed * 3.2 + 0.0);
      for (const side of ['l', 'r']) {
        for (let i = 0; i < 3; i++) {
          const ph = this.phase + i * 2.1 + (side === 'l' ? 0 : Math.PI);
          add(`leg_${side}${i}`, Math.max(0, Math.sin(ph)) * -0.35 * moving, Math.cos(ph) * 0.35 * moving, 0);
          add(`legl_${side}${i}`, Math.sin(ph + 1) * 0.15 * moving);
        }
        add(`claw_${side}`, Math.sin(this.time * 1.3 + (side === 'l' ? 0 : 2)) * 0.08);
        add(`jaw_${side}`, 0.15 + Math.max(0, Math.sin(this.time * 2.1 + (side === 'l' ? 1 : 0))) * 0.25);
      }
      add('body', 0, 0, Math.sin(this.phase * 2) * 0.05 * moving);
      hipsY = Math.abs(Math.sin(this.phase * 2)) * 0.03 * moving;
      for (const a of this.actions) {
        const t = clamp01(a.t / a.dur);
        const up = t < 0.4 ? ss(t / 0.4) : 1 - ss((t - 0.4) / 0.6);
        const snap = t > 0.35 && t < 0.6 ? 1 : 0;
        if (a.name === 'hit') { add('body', -0.25 * up); continue; }
        add('claw_l', -0.9 * up, 0.3 * up); add('claw_r', -0.9 * up, -0.3 * up);
        add('jaw_l', snap ? -0.15 : 0.5 * up); add('jaw_r', snap ? -0.15 : 0.5 * up);
        add('body', -0.15 * up);
      }
      if (this.deathT >= 0) {
        this.deathT += dt;
        const d = ss(clamp01(this.deathT / 0.6));
        rootRz = Math.PI * d;
        rootY = 0.6 * (this.rig.bodyY || 0.4) * d * 2;
        for (const side of ['l', 'r']) for (let i = 0; i < 3; i++) add(`legl_${side}${i}`, -0.8 * d);
      }
      this.apply(P, hipsY, rootRx, rootRz, rootY, 'body');
    } else if (this.type === 'quad') {
      const runF = clamp01((speed - 3) / 4);
      const moving = clamp01(speed / 1);
      this.phase += dt * speed * 2.2;
      const s = Math.sin(this.phase);
      const A = (0.45 + runF * 0.35) * moving;
      add('leg_fl', -s * A); add('leg_br', -s * A); add('leg_fr', s * A); add('leg_bl', s * A);
      add('legl_fl', Math.max(0, Math.cos(this.phase)) * 0.6 * moving); add('legl_br', Math.max(0, Math.cos(this.phase)) * 0.6 * moving);
      add('legl_fr', Math.max(0, -Math.cos(this.phase)) * 0.6 * moving); add('legl_bl', Math.max(0, -Math.cos(this.phase)) * 0.6 * moving);
      hipsY = Math.abs(Math.cos(this.phase)) * 0.05 * moving;
      add('body', Math.sin(this.phase * 2) * 0.03 * moving);
      add('neck', Math.sin(this.phase * 2) * 0.06 * moving + Math.sin(this.time * 0.9) * 0.05 * (1 - moving));
      add('head', 0, Math.sin(this.time * 0.6) * 0.2 * (1 - moving));
      add('jaw', 0.06 + Math.max(0, Math.sin(this.time * 1.7)) * 0.08);
      for (let i = 0; i < 4; i++) add(`tail${i}`, 0, Math.sin(this.time * 3 + i * 0.8) * 0.18);
      for (const a of this.actions) {
        const t = clamp01(a.t / a.dur);
        const lunge = t < 0.4 ? ss(t / 0.4) : 1 - ss((t - 0.4) / 0.6);
        if (a.name === 'hit') { add('body', -0.15 * lunge); continue; }
        add('neck', 0.5 * lunge); add('head', 0.2 * lunge); add('jaw', t > 0.25 && t < 0.5 ? 0.7 : 0.05);
        add('body', 0.1 * lunge);
        add('leg_fl', -0.4 * lunge); add('leg_fr', -0.4 * lunge);
      }
      if (this.deathT >= 0) {
        this.deathT += dt;
        const d = ss(clamp01(this.deathT / 0.6));
        rootRz = 1.5 * d;
        rootY = 0.25 * d;
        add('neck', -0.3 * d); add('jaw', 0.5 * d);
      }
      this.apply(P, hipsY, rootRx, rootRz, rootY, 'body');
    } else if (this.type === 'bird') {
      const f = Math.sin(this.time * (st.glide ? 1.5 : 9)) * (st.glide ? 0.15 : 0.7);
      add('wing_l', 0, 0, f + 0.1); add('wing_r', 0, 0, -f - 0.1);
      add('wingtip_l', 0, 0, f * 0.6); add('wingtip_r', 0, 0, -f * 0.6);
      this.apply(P, 0, 0, 0, 0, 'body');
    } else if (this.type === 'tentacles') {
      for (let t = 0; t < (this.rig.count || 6); t++) {
        for (let i = 0; i < 4; i++) add(`tent${t}_${i}`, Math.sin(this.time * 2.2 + t * 1.3 + i * 0.6) * 0.25, Math.cos(this.time * 1.7 + t) * 0.15);
      }
      hipsY = Math.sin(this.time * 1.8) * 0.08;
      for (const a of this.actions) {
        const t = clamp01(a.t / a.dur);
        const up = t < 0.4 ? ss(t / 0.4) : 1 - ss((t - 0.4) / 0.6);
        for (let k2 = 0; k2 < 2; k2++) for (let i = 0; i < 4; i++) add(`tent${k2}_${i}`, -0.5 * up);
      }
      if (this.deathT >= 0) {
        this.deathT += dt;
        const d = ss(clamp01(this.deathT / 0.8));
        hipsY -= 0.5 * d;
        for (let t = 0; t < 6; t++) add(`tent${t}_0`, 0.8 * d);
      }
      this.apply(P, hipsY, 0, 0, 0, 'body');
    } else if (this.type === 'chest') {
      const open = st.open ? 1 : 0;
      this.lid = (this.lid || 0) + (open - (this.lid || 0)) * Math.min(1, dt * 5);
      add('lid', -this.lid * 1.6);
      this.apply(P, 0, 0, 0, 0, null);
    }
    for (const a of this.actions) a.t += dt;
    this.actions = this.actions.filter((a) => a.loop || a.t < a.dur);
  }

  apply(P, hipsY, rootRx, rootRz, rootY, bodyJoint = 'hips') {
    for (const name in this.joints) {
      const j = this.joints[name];
      const r = this.rest[name];
      const o = P[name];
      if (o) j.rotation.set(r.r.x + o[0], r.r.y + o[1], r.r.z + o[2]);
      else if (j.rotation.x !== r.r.x || j.rotation.y !== r.r.y || j.rotation.z !== r.r.z) j.rotation.copy(r.r);
    }
    if (bodyJoint && this.joints[bodyJoint]) this.joints[bodyJoint].position.y = this.rest[bodyJoint].p.y + hipsY;
    this.root.rotation.x = rootRx;
    this.root.rotation.z = rootRz;
    this.root.position.y = rootY;
  }
}

// Bob/tilt fallback for overridden models that have no animation clips.
export class BobAnimator {
  constructor(root) {
    this.root = root;
    this.time = 0;
    this.phase = 0;
    this.actions = [];
    this.deathT = -1;
    this.baseY = root.position.y;
  }
  play(name, dur = 0.5) {
    if (name === 'death') { this.deathT = 0; return; }
    if (name === 'revive') { this.deathT = -1; return; }
    this.actions.push({ name, t: 0, dur });
  }
  stop(name) { this.actions = this.actions.filter((a) => a.name !== name); }
  update(dt, st) {
    this.time += dt;
    const speed = st.speed || 0;
    this.phase += dt * speed * 4;
    let y = Math.abs(Math.sin(this.phase)) * 0.06 * clamp01(speed);
    let rx = Math.sin(this.phase) * 0.03 * clamp01(speed), rz = 0;
    for (const a of this.actions) {
      const t = clamp01(a.t / a.dur);
      const e = Math.sin(t * Math.PI);
      if (a.name === 'hit') rx -= e * 0.15;
      else rx += e * 0.22;
      a.t += dt;
    }
    this.actions = this.actions.filter((a) => a.t < a.dur);
    if (this.deathT >= 0) {
      this.deathT += dt;
      const d = ss(clamp01(this.deathT / 0.6));
      rz = 1.5 * d;
      y = 0.2 * d;
    }
    this.root.position.y = this.baseY + y;
    this.root.rotation.x = rx;
    this.root.rotation.z = rz;
  }
}
