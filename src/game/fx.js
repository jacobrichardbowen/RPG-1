// Visual effects: particles, projectiles, rings, telegraphs, wards, level-up columns, fireflies.
import * as THREE from 'three';

const MAX_P = 3000;

class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.size = new Float32Array(MAX_P);
    this.alpha = new Float32Array(MAX_P);
    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.baseSize = new Float32Array(MAX_P);
    this.count = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 500 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * (0.6 + a), a * vAlpha);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.mat = mat;
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0) {
    if (this.count >= MAX_P) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = _c.setHex(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.baseSize[i] = size;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
    this.alpha[i] = 1;
  }

  update(dt, height) {
    this.mat.uniforms.uScale.value = height * 0.9;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) this.copy(last, i);
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }

  copy(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.size[to] = this.size[from];
    this.baseSize[to] = this.baseSize[from];
    this.grav[to] = this.grav[from];
    this.alpha[to] = this.alpha[from];
  }
}
const _c = new THREE.Color();
const _v = new THREE.Vector3();

export class FX {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.p = new Particles(this.scene);
    this.items = [];
    this.fireflyT = 0;
  }

  chestOf(u) { return _v.set(u.pos.x, u.pos.y + (u.height || 1.6) * 0.6, u.pos.z).clone(); }
  handOf(u) {
    const grip = u.visual.points && u.visual.points.grip_r;
    if (grip) { grip.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(grip.matrixWorld); }
    return this.chestOf(u).add(new THREE.Vector3(Math.sin(u.yaw) * 0.5, 0.2, Math.cos(u.yaw) * 0.5));
  }

  burst(pos, color, n = 22, speed = 4, size = 0.35) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.p.emit(pos.x, pos.y + 1, pos.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 1, Math.sin(a) * Math.cos(b) * s, color, size, 0.4 + Math.random() * 0.4, 3);
    }
  }

  sparkle(u, color) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.5;
      this.p.emit(u.pos.x + Math.cos(a) * r, u.pos.y + Math.random() * 1.6, u.pos.z + Math.sin(a) * r, 0, 1 + Math.random() * 1.5, 0, color, 0.25, 0.8 + Math.random() * 0.6, -0.5);
    }
  }

  projectile(src, target, opts, onHit) {
    const start = this.handOf(src);
    let mesh;
    if (opts.knife) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.8, roughness: 0.3 }));
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(opts.size || 0.3, 10, 8), new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    }
    mesh.position.copy(start);
    this.scene.add(mesh);
    this.items.push({ kind: 'proj', mesh, target, speed: opts.speed || 25, color: opts.color, onHit, knife: opts.knife, life: 6 });
  }

  ring(pos, radius, color, dur = 0.5) {
    const geo = new THREE.RingGeometry(0.8, 1, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.25, pos.z);
    this.scene.add(mesh);
    this.items.push({ kind: 'ring', mesh, t: 0, dur, radius });
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.p.emit(pos.x, pos.y + 0.4, pos.z, Math.cos(a) * radius * 2, 0.5, Math.sin(a) * radius * 2, color, 0.4, 0.5);
    }
  }

  // Ground-hugging warning circle that fills up until the attack lands.
  telegraph(center, radius, dur, color) {
    const T = this.game.world.collision;
    const seg = 40, rings = 6;
    const pos = [], idx = [], uv = [];
    const baseY = T.groundAt(center.x, center.z, 100, 0);
    for (let r = 0; r <= rings; r++) {
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2, rr = (r / rings) * radius;
        const x = center.x + Math.cos(a) * rr, z = center.z + Math.sin(a) * rr;
        const y = Math.max(T.groundAt(x, z, baseY + 1.5, 1.5), 0) + 0.12;
        pos.push(x, y, z);
        uv.push(r / rings, s / seg);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uT; uniform vec3 uColor;
        void main(){
          float r = vUv.x;
          float edge = smoothstep(0.9, 1.0, r) * (1.0 - smoothstep(0.98, 1.0, r) * 0.0);
          float fill = step(r, uT) * 0.35;
          float a = max(edge * 0.9, fill) + 0.08;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    this.scene.add(mesh);
    this.items.push({ kind: 'tele', mesh, t: 0, dur });
  }

  pillar(pos, radius, color) {
    const geo = new THREE.CylinderGeometry(radius * 0.7, radius, 9, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 4.5, pos.z);
    this.scene.add(mesh);
    this.items.push({ kind: 'pillar', mesh, t: 0, dur: 0.8 });
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.p.emit(pos.x + Math.cos(a) * r, pos.y + Math.random() * 2, pos.z + Math.sin(a) * r, 0, 4 + Math.random() * 6, 0, color, 0.5, 0.6 + Math.random() * 0.5, 2);
    }
  }

  ward(u, dur) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc080ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(mesh);
    this.items.push({ kind: 'ward', mesh, unit: u, t: 0, dur });
  }

  freeze(u, dur) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(0.6, u.radius * 1.4), 0), new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1, emissive: 0x204060 }));
    mesh.scale.y = (u.height || 1.6) / Math.max(0.6, u.radius * 1.4) * 0.45;
    this.scene.add(mesh);
    this.items.push({ kind: 'freeze', mesh, unit: u, t: 0, dur });
  }

  levelUp(u) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(mesh);
    this.items.push({ kind: 'column', mesh, unit: u, t: 0, dur: 2.2 });
    this.ring(u.pos, 3, 0xffd060, 0.8);
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
      this.p.emit(u.pos.x + Math.cos(a) * r, u.pos.y + Math.random() * 0.5, u.pos.z + Math.sin(a) * r, 0, 2 + Math.random() * 6, 0, 0xffd870, 0.35, 1 + Math.random(), -0.5);
    }
  }

  update(dt) {
    const g = this.game;
    for (const it of this.items) {
      if (it.kind === 'proj') {
        it.life -= dt;
        const tgt = it.target;
        const dest = this.chestOf(tgt);
        const m = it.mesh;
        _v.copy(dest).sub(m.position);
        const d = _v.length();
        const step = it.speed * dt;
        if (d <= step + 0.3 || it.life <= 0 || !tgt.alive) {
          if (tgt.alive) it.onHit();
          this.burst(new THREE.Vector3(dest.x, dest.y - 1, dest.z), it.color, it.knife ? 6 : 18, 3, 0.3);
          it.dead = true;
          continue;
        }
        _v.multiplyScalar(step / d);
        m.position.add(_v);
        m.lookAt(dest);
        if (it.knife) m.rotateX(g.elapsed * 30);
        else for (let i = 0; i < 3; i++) this.p.emit(m.position.x + (Math.random() - 0.5) * 0.2, m.position.y + (Math.random() - 0.5) * 0.2, m.position.z + (Math.random() - 0.5) * 0.2, 0, 0.3, 0, it.color, 0.4, 0.35);
      } else {
        it.t += dt;
        const k = it.t / it.dur;
        if (k >= 1) { it.dead = true; continue; }
        if (it.kind === 'ring') {
          const s = 0.3 + k * it.radius;
          it.mesh.scale.set(s, 1, s);
          it.mesh.material.opacity = 0.9 * (1 - k);
        } else if (it.kind === 'tele') {
          it.mesh.material.uniforms.uT.value = k;
        } else if (it.kind === 'pillar') {
          it.mesh.material.opacity = 0.7 * (1 - k);
          it.mesh.scale.set(1 + k * 0.3, 1, 1 + k * 0.3);
        } else if (it.kind === 'ward') {
          const ward = it.unit.effects.find((e) => e.absorb > 0);
          if (!ward || !it.unit.alive) { it.dead = true; continue; }
          it.mesh.position.set(it.unit.pos.x, it.unit.pos.y + 1, it.unit.pos.z);
          it.mesh.material.opacity = 0.12 + Math.sin(g.elapsed * 4) * 0.05;
        } else if (it.kind === 'freeze') {
          if (!it.unit.effects.some((e) => e.root) || !it.unit.alive) { it.dead = true; continue; }
          it.mesh.position.set(it.unit.pos.x, it.unit.pos.y + (it.unit.height || 1.6) * 0.4, it.unit.pos.z);
        } else if (it.kind === 'column') {
          it.mesh.position.set(it.unit.pos.x, it.unit.pos.y + 7, it.unit.pos.z);
          it.mesh.material.opacity = 0.28 * Math.min(1, k * 6) * (1 - k);
        }
      }
    }
    for (const it of this.items) if (it.dead) { it.mesh.removeFromParent(); it.mesh.geometry.dispose(); it.mesh.material.dispose(); }
    this.items = this.items.filter((it) => !it.dead);
    // Casting glow around the hands.
    for (const u of g.player ? [g.player, ...g.creatures] : g.creatures) {
      if (!u.cast || !u.alive || u.cast.creatureSpell?.telegraph) continue;
      if (Math.random() < 0.6) {
        const h = this.handOf(u);
        const col = u.cast.school === 'fire' ? 0xff8030 : u.cast.school === 'frost' ? 0x9ae0ff : u.cast.school === 'nature' ? 0x8ad040 : u.cast.school === 'shadow' ? 0x40e0e0 : 0xc080ff;
        this.p.emit(h.x + (Math.random() - 0.5) * 0.3, h.y, h.z + (Math.random() - 0.5) * 0.3, 0, 0.8, 0, col, 0.3, 0.5);
      }
    }
    // Loot sparkle on lootable corpses.
    for (const c of g.creatures) {
      if (!c.alive && !c.removed && c.loot && (c.loot.items.length || c.loot.gold) && Math.random() < 0.25) {
        this.p.emit(c.pos.x + (Math.random() - 0.5), c.pos.y + 0.3, c.pos.z + (Math.random() - 0.5), 0, 0.8, 0, 0xffe070, 0.22, 0.9);
      }
    }
    // Fireflies at night.
    const night = g.world.sky.nightFactor;
    if (night > 0.5 && g.player) {
      this.fireflyT -= dt;
      if (this.fireflyT <= 0) {
        this.fireflyT = 0.06;
        const p = g.player.pos;
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 22;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const h = g.world.terrain.heightAt(x, z);
        if (h > 0.2) this.p.emit(x, h + 0.5 + Math.random() * 2, z, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.5, 0xc8ff70, 0.12, 3 + Math.random() * 2);
      }
    }
    this.p.update(dt, g.engine.renderer.domElement.height);
  }
}
