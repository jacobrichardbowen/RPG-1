// Procedural audio: synthesized sound effects, ambience (waves, wind, birds, insects) and a
// generative score. Every sound is an asset slot (sfx_<name>, music_<mood>, amb_<name>) that
// can be replaced with your own .ogg/.mp3/.wav in the Asset Workshop.
import { registry } from '../assets/registry.js';

const SFX = [
  'swing', 'hit', 'hit_crit', 'hit_fire', 'hit_frost', 'hit_nature', 'hit_shadow', 'fire', 'frost', 'arcane', 'shadow',
  'throw', 'bash', 'charge', 'whirl', 'heavy', 'heal', 'cast_start', 'cast_nature', 'cast_shadow',
  'step_grass', 'step_wood', 'step_stone', 'jump', 'land', 'splash', 'chest_open', 'locked', 'gather', 'loot', 'coin',
  'quest_accept', 'quest_progress', 'quest_ready', 'quest_complete', 'levelup', 'click', 'open', 'close', 'error',
  'blessing', 'drink', 'eat', 'equip', 'scream', 'death_player',
  'aggro_crab', 'aggro_growl', 'aggro_bogling', 'aggro_drowned', 'aggro_cultist', 'aggro_morwen', 'aggro_deep',
  'attack_crab', 'attack_growl', 'attack_bogling', 'attack_drowned', 'attack_cultist', 'attack_morwen', 'attack_deep',
];
const MUSIC = ['explore', 'town', 'night', 'combat', 'boss'];
const AMB = ['waves', 'wind'];

export function defineAudioSlots() {
  for (const s of SFX) registry.define({ id: `sfx_${s}`, kind: 'audio', category: 'Audio: effects', label: s.replace(/_/g, ' '), description: 'Short sound effect. Mono .ogg or .wav works best.' });
  for (const m of MUSIC) registry.define({ id: `music_${m}`, kind: 'audio', category: 'Audio: music', label: `Music: ${m}`, description: 'Loops while this mood is active. Replaces the generated score for this mood.' });
  for (const a of AMB) registry.define({ id: `amb_${a}`, kind: 'audio', category: 'Audio: ambience', label: `Ambience: ${a}`, description: 'Seamless loop. Volume follows your surroundings.' });
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// D dorian / modal material
const SCALES = {
  explore: [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69],
  town: [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74],
  night: [50, 52, 53, 55, 57, 58, 60, 62, 64, 65, 67],
  combat: [50, 52, 53, 55, 57, 58, 61, 62],
  boss: [49, 50, 53, 55, 56, 58, 61, 62],
};
const CHORDS = {
  explore: [[38, 50, 57, 62, 65], [36, 48, 55, 60, 64], [43, 55, 59, 62, 67], [38, 50, 57, 62, 69]],
  town: [[43, 55, 59, 62, 67], [38, 50, 57, 62, 66], [40, 52, 55, 59, 64], [36, 48, 55, 60, 64]],
  night: [[38, 50, 53, 57, 62], [34, 46, 53, 58, 62], [41, 53, 57, 60, 65], [36, 48, 52, 55, 60]],
  combat: [[38, 50, 53, 57], [34, 46, 53, 58], [36, 48, 55, 60], [37, 49, 52, 57]],
  boss: [[37, 49, 52, 56], [38, 50, 53, 58], [34, 46, 49, 53], [37, 49, 53, 56]],
};

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.7 };
    this.mood = 'explore';
    this.nextMood = 'explore';
    this.buffers = new Map();
    this.loading = new Set();
    this.lastStep = 0;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.musicT = 0;
    this.chordI = 0;
    this.beat = 0;
    this.overrideLoops = {};
    registry.onChange((id) => {
      if (id.startsWith('sfx_') || id.startsWith('music_') || id.startsWith('amb_')) {
        this.buffers.delete(id);
        if (this.overrideLoops[id]) { try { this.overrideLoops[id].src.stop(); } catch (e) { /* ignore */ } delete this.overrideLoops[id]; }
      }
    });
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.5);
    this.reverbOut = c.createGain(); this.reverbOut.gain.value = 0.5;
    this.reverb.connect(this.reverbOut); this.reverbOut.connect(this.master);
    this.musicVerb = c.createGain(); this.musicVerb.gain.value = 0.7; this.musicVerb.connect(this.reverb);
    this.noise = this.noiseBuffer(2);
    this.applyVolumes();
    this.startAmbience();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.ambient * 0.6, t, 0.05);
  }

  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  noiseBuffer(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  async loadOverride(id) {
    if (this.buffers.has(id) || this.loading.has(id)) return this.buffers.get(id) || null;
    const ov = registry.overrides.get(id);
    if (!ov || !ov.blob) return null;
    this.loading.add(id);
    try {
      const buf = await this.ctx.decodeAudioData(await ov.blob.arrayBuffer());
      this.buffers.set(id, buf);
      return buf;
    } catch (e) {
      console.warn('Could not decode audio override', id, e);
      this.buffers.set(id, null);
      return null;
    } finally {
      this.loading.delete(id);
    }
  }

  // ------------------------------------------------------------------ positional sfx
  out(pos, vol = 1) {
    const c = this.ctx;
    const g = c.createGain();
    let v = vol;
    let pan = 0;
    if (pos) {
      const L = this.listener;
      const dx = pos.x - L.x, dz = pos.z - L.z;
      const d = Math.hypot(dx, dz, (pos.y || 0) - L.y);
      v *= 1 / (1 + d * d / 120);
      if (d > 45) return null;
      const ang = Math.atan2(dx, dz) - L.yaw;
      pan = -Math.sin(ang) * Math.min(1, d / 6) * 0.7;
    }
    g.gain.value = v;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  play(name, pos, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const id = `sfx_${name}`;
    if (registry.overrides.has(id)) {
      const buf = this.buffers.get(id);
      if (buf) {
        const dst = this.out(pos, vol);
        if (!dst) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(dst);
        src.start();
        return;
      }
      if (buf === undefined) this.loadOverride(id);
    }
    const dst = this.out(pos, vol);
    if (!dst) return;
    const fn = this.recipes[name] || this.recipes[name.split('_')[0]];
    if (fn) fn.call(this, dst, this.ctx.currentTime);
  }

  // Building blocks
  osc(type, f, t, dur, dst, { gain = 0.3, attack = 0.005, f2, curve = 'exp', detune = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    if (f2) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      else o.frequency.linearRampToValueAtTime(f2, t + dur);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  noiseHit(t, dur, dst, { type = 'lowpass', f = 1000, f2, q = 1, gain = 0.4, attack = 0.003 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter();
    fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  bell(f, t, dst, gain = 0.15, dur = 1.2) {
    this.osc('sine', f, t, dur, dst, { gain });
    this.osc('sine', f * 2.01, t, dur * 0.6, dst, { gain: gain * 0.4 });
    this.osc('sine', f * 3.03, t, dur * 0.3, dst, { gain: gain * 0.2 });
    if (this.reverb) { const g = this.ctx.createGain(); g.gain.value = 0.25; g.connect(this.reverb); this.osc('sine', f, t, dur, g, { gain }); }
  }

  get recipes() {
    if (this._recipes) return this._recipes;
    const R = {
      swing(d, t) { this.noiseHit(t, 0.22, d, { type: 'bandpass', f: 700, f2: 2600, q: 1.2, gain: 0.35, attack: 0.04 }); },
      throw(d, t) { this.noiseHit(t, 0.15, d, { type: 'bandpass', f: 1500, f2: 3500, q: 2, gain: 0.25, attack: 0.02 }); },
      hit(d, t) { this.osc('sine', 140, t, 0.14, d, { gain: 0.5, f2: 55 }); this.noiseHit(t, 0.09, d, { f: 1800, gain: 0.35 }); },
      hit_crit(d, t) { R.hit.call(this, d, t); this.osc('square', 900, t, 0.06, d, { gain: 0.1, f2: 300 }); this.osc('sine', 90, t, 0.25, d, { gain: 0.5, f2: 40 }); },
      hit_fire(d, t) { this.noiseHit(t, 0.4, d, { f: 1200, f2: 300, gain: 0.45, attack: 0.01 }); this.osc('sine', 120, t, 0.2, d, { gain: 0.3, f2: 50 }); },
      hit_frost(d, t) { this.noiseHit(t, 0.25, d, { type: 'highpass', f: 3000, gain: 0.25 }); [2400, 3100, 3700].forEach((f, i) => this.osc('sine', f, t + i * 0.02, 0.3, d, { gain: 0.06 })); },
      hit_nature(d, t) { this.noiseHit(t, 0.2, d, { type: 'bandpass', f: 500, q: 3, gain: 0.35 }); this.osc('sine', 200, t, 0.15, d, { gain: 0.2, f2: 90 }); },
      hit_shadow(d, t) { this.osc('sawtooth', 160, t, 0.35, d, { gain: 0.15, f2: 60 }); this.noiseHit(t, 0.3, d, { f: 600, gain: 0.3 }); },
      fire(d, t) { this.noiseHit(t, 0.55, d, { f: 400, f2: 2500, gain: 0.4, attack: 0.1 }); this.osc('triangle', 220, t, 0.5, d, { gain: 0.08, f2: 440 }); },
      frost(d, t) { this.noiseHit(t, 0.4, d, { type: 'highpass', f: 2500, gain: 0.18, attack: 0.05 }); [1800, 2400, 3000, 3600].forEach((f, i) => this.osc('sine', f, t + i * 0.04, 0.5, d, { gain: 0.05 })); },
      arcane(d, t) { this.osc('sine', 400, t, 0.5, d, { gain: 0.15, f2: 1300 }); this.osc('sine', 600, t + 0.05, 0.5, d, { gain: 0.08, f2: 1800 }); },
      shadow(d, t) { this.osc('sawtooth', 300, t, 0.4, d, { gain: 0.1, f2: 80 }); this.noiseHit(t, 0.4, d, { type: 'bandpass', f: 400, q: 4, gain: 0.3, attack: 0.1 }); },
      bash(d, t) { this.osc('sine', 110, t, 0.2, d, { gain: 0.6, f2: 45 }); this.noiseHit(t, 0.12, d, { f: 900, gain: 0.5 }); this.osc('square', 300, t, 0.05, d, { gain: 0.08 }); },
      charge(d, t) { this.noiseHit(t, 0.5, d, { type: 'bandpass', f: 300, f2: 1500, q: 1, gain: 0.35, attack: 0.1 }); },
      whirl(d, t) { for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.12, 0.2, d, { type: 'bandpass', f: 600 + i * 300, f2: 2400, q: 1.5, gain: 0.3, attack: 0.04 }); },
      heavy(d, t) { this.noiseHit(t, 0.3, d, { type: 'bandpass', f: 400, f2: 1800, q: 1, gain: 0.4, attack: 0.08 }); this.osc('sine', 90, t + 0.15, 0.25, d, { gain: 0.4, f2: 40 }); },
      heal(d, t) { [523, 659, 784, 1047].forEach((f, i) => this.bell(f, t + i * 0.08, d, 0.07, 0.9)); },
      blessing(d, t) { [392, 494, 587, 784, 988].forEach((f, i) => this.bell(f, t + i * 0.12, d, 0.08, 1.6)); },
      cast_start(d, t) { this.osc('sine', 300, t, 0.3, d, { gain: 0.06, f2: 600, attack: 0.1 }); },
      cast_nature(d, t) { this.osc('triangle', 200, t, 0.4, d, { gain: 0.12, f2: 500 }); },
      cast_shadow(d, t) { this.osc('sawtooth', 220, t, 0.5, d, { gain: 0.08, f2: 110 }); },
      step_grass(d, t) { this.noiseHit(t, 0.07, d, { f: 700 + Math.random() * 300, gain: 0.12, attack: 0.005 }); },
      step_wood(d, t) { this.noiseHit(t, 0.06, d, { type: 'bandpass', f: 900, q: 3, gain: 0.2 }); this.osc('sine', 180, t, 0.05, d, { gain: 0.08 }); },
      step_stone(d, t) { this.noiseHit(t, 0.05, d, { type: 'bandpass', f: 2000, q: 2, gain: 0.12 }); },
      jump(d, t) { this.noiseHit(t, 0.1, d, { f: 500, gain: 0.1 }); },
      land(d, t) { this.osc('sine', 100, t, 0.12, d, { gain: 0.3, f2: 50 }); this.noiseHit(t, 0.1, d, { f: 500, gain: 0.2 }); },
      splash(d, t) { this.noiseHit(t, 0.6, d, { f: 2500, f2: 400, gain: 0.35, attack: 0.01 }); this.noiseHit(t + 0.05, 0.3, d, { type: 'highpass', f: 2000, gain: 0.15 }); },
      chest_open(d, t) { this.osc('sawtooth', 90, t, 0.45, d, { gain: 0.07, f2: 140, curve: 'lin' }); this.noiseHit(t + 0.3, 0.1, d, { f: 800, gain: 0.25 }); },
      locked(d, t) { this.osc('square', 300, t, 0.05, d, { gain: 0.08 }); this.osc('square', 250, t + 0.08, 0.05, d, { gain: 0.08 }); },
      gather(d, t) { this.noiseHit(t, 0.15, d, { type: 'bandpass', f: 1200, q: 2, gain: 0.2 }); this.bell(1200, t + 0.1, d, 0.04, 0.5); },
      loot(d, t) { this.noiseHit(t, 0.12, d, { type: 'bandpass', f: 1600, q: 3, gain: 0.15 }); },
      coin(d, t) { this.osc('sine', 2600, t, 0.12, d, { gain: 0.1 }); this.osc('sine', 3400, t + 0.06, 0.15, d, { gain: 0.08 }); this.osc('sine', 3000, t + 0.11, 0.1, d, { gain: 0.06 }); },
      quest_accept(d, t) { this.bell(523, t, d, 0.1); this.bell(784, t + 0.15, d, 0.1); },
      quest_progress(d, t) { this.bell(660, t, d, 0.08, 0.6); },
      quest_ready(d, t) { this.bell(784, t, d, 0.1); this.bell(1047, t + 0.12, d, 0.08); },
      quest_complete(d, t) { [523, 659, 784, 1047].forEach((f, i) => this.bell(f, t + i * 0.11, d, 0.1, 1.4)); },
      levelup(d, t) {
        [392, 494, 587, 784].forEach((f, i) => this.bell(f, t + i * 0.1, d, 0.12, 1.8));
        [784, 988, 1175, 1568].forEach((f, i) => this.bell(f, t + 0.45 + i * 0.06, d, 0.07, 2));
        this.osc('sawtooth', 196, t, 1.6, d, { gain: 0.04, attack: 0.2 });
      },
      click(d, t) { this.osc('square', 1800, t, 0.025, d, { gain: 0.04 }); },
      open(d, t) { this.noiseHit(t, 0.15, d, { type: 'bandpass', f: 2200, q: 1, gain: 0.08, attack: 0.03 }); },
      close(d, t) { this.noiseHit(t, 0.12, d, { type: 'bandpass', f: 1400, q: 1, gain: 0.08, attack: 0.02 }); },
      error(d, t) { this.osc('square', 180, t, 0.12, d, { gain: 0.05 }); },
      drink(d, t) { for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.18, 0.1, d, { f: 400, gain: 0.25 }); },
      eat(d, t) { for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.16, 0.06, d, { type: 'bandpass', f: 2500, q: 1, gain: 0.2 }); },
      equip(d, t) { this.noiseHit(t, 0.08, d, { type: 'bandpass', f: 3000, q: 2, gain: 0.15 }); this.osc('sine', 1600, t, 0.08, d, { gain: 0.05 }); },
      scream(d, t) { const o = this.osc('sawtooth', 900, t, 2.4, d, { gain: 0.18, f2: 160, attack: 0.05 }); const l = this.ctx.createOscillator(); const lg = this.ctx.createGain(); l.frequency.value = 7; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 2.4); },
      death_player(d, t) { this.osc('sawtooth', 220, t, 1.4, d, { gain: 0.12, f2: 55 }); this.osc('sine', 110, t, 2, d, { gain: 0.2, f2: 40 }); },
      aggro_crab(d, t) { for (let i = 0; i < 5; i++) this.noiseHit(t + i * 0.06, 0.03, d, { type: 'highpass', f: 3000, gain: 0.25 }); },
      attack_crab(d, t) { this.noiseHit(t, 0.05, d, { type: 'highpass', f: 2500, gain: 0.3 }); this.osc('square', 600, t, 0.04, d, { gain: 0.06 }); },
      aggro_growl(d, t) { const o = this.osc('sawtooth', 80, t, 0.8, d, { gain: 0.2, f2: 60, attack: 0.1 }); this.noiseHit(t, 0.8, d, { type: 'bandpass', f: 300, q: 2, gain: 0.2, attack: 0.1 }); return o; },
      attack_growl(d, t) { this.noiseHit(t, 0.2, d, { type: 'bandpass', f: 500, q: 2, gain: 0.3 }); this.osc('sawtooth', 120, t, 0.2, d, { gain: 0.15, f2: 70 }); },
      aggro_bogling(d, t) { for (let i = 0; i < 6; i++) this.osc('square', 600 + Math.random() * 600, t + i * 0.07, 0.06, d, { gain: 0.05 }); },
      attack_bogling(d, t) { this.osc('square', 500 + Math.random() * 300, t, 0.08, d, { gain: 0.05 }); },
      aggro_drowned(d, t) { this.osc('sine', 180, t, 1.4, d, { gain: 0.2, f2: 130, attack: 0.3 }); this.noiseHit(t, 1.2, d, { f: 500, gain: 0.12, attack: 0.3 }); },
      attack_drowned(d, t) { this.osc('sine', 160, t, 0.3, d, { gain: 0.12, f2: 110 }); },
      aggro_cultist(d, t) { this.osc('sawtooth', 147, t, 1, d, { gain: 0.06, attack: 0.2 }); this.osc('sawtooth', 220, t, 1, d, { gain: 0.05, attack: 0.2 }); },
      attack_cultist(d, t) { this.noiseHit(t, 0.08, d, { f: 1000, gain: 0.15 }); },
      aggro_morwen(d, t) { [73, 110, 147].forEach((f) => this.osc('sawtooth', f, t, 2.5, d, { gain: 0.07, attack: 0.5 })); },
      attack_morwen(d, t) { this.osc('sine', 200, t, 0.3, d, { gain: 0.1, f2: 100 }); },
      aggro_deep(d, t) { this.osc('sine', 60, t, 1, d, { gain: 0.3, f2: 40, attack: 0.2 }); this.noiseHit(t, 1, d, { f: 300, gain: 0.2, attack: 0.2 }); },
      attack_deep(d, t) { this.noiseHit(t, 0.2, d, { f: 600, gain: 0.25 }); },
    };
    this._recipes = R;
    return R;
  }

  // ------------------------------------------------------------------ ambience
  startAmbience() {
    const c = this.ctx;
    const mk = (type, f, q) => {
      const s = c.createBufferSource();
      s.buffer = this.noise; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(this.ambBus);
      s.start();
      return { s, fl, g };
    };
    this.waves = mk('lowpass', 500, 0.7);
    this.wind = mk('bandpass', 400, 0.6);
    this.birdT = 2;
    this.insectT = 1;
  }

  updateAmbience(dt, env) {
    if (!this.ctx || !this.waves) return;
    const t = this.ctx.currentTime;
    const g = this.game;
    // Waves swell near the coast.
    const swell = 0.6 + 0.4 * Math.sin(g.elapsed * 0.45) * Math.sin(g.elapsed * 0.17 + 1);
    const coast = env.coast;
    const useWaveOv = this.loopOverride('amb_waves', coast * 0.8);
    this.waves.g.gain.setTargetAtTime(useWaveOv ? 0 : coast * 0.55 * swell, t, 0.4);
    this.waves.fl.frequency.setTargetAtTime(300 + swell * 600, t, 0.4);
    const windAmt = (0.12 + env.height * 0.012 + Math.max(0, Math.sin(g.elapsed * 0.07)) * 0.1) * (env.indoors ? 0.2 : 1);
    const useWindOv = this.loopOverride('amb_wind', windAmt * 2);
    this.wind.g.gain.setTargetAtTime(useWindOv ? 0 : windAmt * 0.5, t, 0.6);
    this.wind.fl.frequency.setTargetAtTime(300 + Math.sin(g.elapsed * 0.3) * 150, t, 0.5);
    // Birds by day, insects and frogs by night.
    const night = g.world.sky.nightFactor;
    this.birdT -= dt;
    if (this.birdT <= 0 && !env.indoors) {
      this.birdT = 2 + Math.random() * 6;
      if (night < 0.5) {
        const d = this.ambBus;
        const gull = env.coast > 0.4 && Math.random() < 0.5;
        const n = gull ? 3 : 2 + Math.floor(Math.random() * 4);
        const base = gull ? 1200 : 2500 + Math.random() * 1500;
        for (let i = 0; i < n; i++) this.osc(gull ? 'sawtooth' : 'sine', base * (1 + Math.random() * 0.2), t + i * (gull ? 0.22 : 0.09), gull ? 0.2 : 0.07, d, { gain: gull ? 0.015 : 0.03, f2: base * (gull ? 0.7 : 1.3) });
      }
    }
    this.insectT -= dt;
    if (this.insectT <= 0 && night > 0.4 && !env.indoors) {
      this.insectT = 0.4 + Math.random() * 1.5;
      const d = this.ambBus;
      if (env.marsh > 0.3 && Math.random() < 0.5) {
        this.osc('square', 120 + Math.random() * 40, t, 0.12, d, { gain: 0.03, f2: 90 });
        this.osc('square', 120 + Math.random() * 40, t + 0.15, 0.12, d, { gain: 0.03, f2: 90 });
      } else {
        for (let i = 0; i < 4; i++) this.osc('sine', 4200 + Math.random() * 300, t + i * 0.05, 0.03, d, { gain: 0.012 });
      }
    }
  }

  loopOverride(id, vol) {
    if (!registry.overrides.has(id)) return false;
    let L = this.overrideLoops[id];
    if (!L) {
      const buf = this.buffers.get(id);
      if (!buf) { if (buf === undefined) this.loadOverride(id); return false; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g); g.connect(id.startsWith('music') ? this.musicBus : this.ambBus);
      src.start();
      L = this.overrideLoops[id] = { src, g };
    }
    L.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.8);
    return true;
  }

  // ------------------------------------------------------------------ music
  setMood(m) { this.nextMood = m; }

  updateMusic(dt) {
    if (!this.ctx || this.vol.music <= 0.001) return;
    const c = this.ctx, t = c.currentTime;
    // Override loops for moods.
    let anyOv = false;
    for (const m of MUSIC) {
      const id = `music_${m}`;
      if (registry.overrides.has(id)) {
        anyOv = anyOv || m === this.nextMood;
        this.loopOverride(id, m === this.nextMood ? 0.9 : 0);
      }
    }
    if (anyOv) { this.mood = this.nextMood; return; }
    const combat = this.nextMood === 'combat' || this.nextMood === 'boss';
    this.musicT -= dt;
    if (combat) {
      // Percussive pulse.
      this.beatT = (this.beatT || 0) - dt;
      const bpm = this.nextMood === 'boss' ? 118 : 104;
      if (this.beatT <= 0) {
        this.beatT = 60 / bpm / 2;
        const b = this.beat++ % 16;
        const d = this.musicBus;
        if (b % 4 === 0 || b === 14) { this.osc('sine', 75, t, 0.35, d, { gain: 0.5, f2: 38 }); this.noiseHit(t, 0.1, d, { f: 300, gain: 0.25 }); }
        if (b % 8 === 4) this.noiseHit(t, 0.15, d, { type: 'bandpass', f: 1800, q: 0.8, gain: 0.2 });
        if (b % 2 === 1) this.noiseHit(t, 0.03, d, { type: 'highpass', f: 6000, gain: 0.05 });
        const sc = SCALES[this.nextMood];
        if (b % 2 === 0) {
          const ost = [0, 2, 4, 2, 1, 2, 4, 6];
          const n = sc[ost[(b / 2) % 8] % sc.length];
          this.pluck(NOTE(n - 12), t, 0.08);
        }
      }
      if (this.musicT <= 0) {
        this.musicT = 60 / bpm * 8;
        const ch = CHORDS[this.nextMood][this.chordI++ % 4];
        for (const n of ch) this.pad(NOTE(n), t, this.musicT + 0.5, 0.03);
      }
      this.mood = this.nextMood;
      return;
    }
    if (this.musicT > 0) {
      // Plucked melody notes, sparse.
      this.pluckT = (this.pluckT || 0) - dt;
      if (this.pluckT <= 0) {
        const m = this.mood;
        this.pluckT = (m === 'night' ? 1.4 : m === 'town' ? 0.55 : 0.85) * (0.6 + Math.random() * 0.9);
        if (Math.random() < (m === 'night' ? 0.45 : 0.7)) {
          const sc = SCALES[m];
          this.melI = Math.max(0, Math.min(sc.length - 1, (this.melI ?? 5) + Math.floor(Math.random() * 5) - 2));
          this.pluck(NOTE(sc[this.melI] + 12), t, m === 'night' ? 0.05 : 0.07);
        }
      }
      return;
    }
    this.mood = this.nextMood;
    const m = this.mood;
    const dur = m === 'night' ? 11 : 8;
    this.musicT = dur;
    const ch = CHORDS[m][this.chordI++ % 4];
    for (const n of ch) this.pad(NOTE(n), t, dur + 2, m === 'night' ? 0.022 : 0.03);
  }

  pad(f, t, dur, gain) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 2.2);
    g.gain.setValueAtTime(gain, t + dur - 2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.5;
    g.connect(fl); fl.connect(this.musicBus); fl.connect(this.musicVerb);
    for (const det of [-7, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.1);
    }
    const s = c.createOscillator();
    s.type = 'sine'; s.frequency.value = f / 2;
    const sg = c.createGain(); sg.gain.value = 0.6;
    s.connect(sg); sg.connect(g);
    s.start(t); s.stop(t + dur + 0.1);
  }

  pluck(f, t, gain) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(f * 6, t);
    fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.6);
    g.connect(fl); fl.connect(this.musicBus); fl.connect(this.musicVerb);
    for (const [type, mult, gm] of [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = f * mult;
      const og = c.createGain(); og.gain.value = gm;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + 2.3);
    }
  }

  update(dt, env) {
    if (!this.ctx) return;
    this.updateAmbience(dt, env);
    this.updateMusic(dt);
  }
}
