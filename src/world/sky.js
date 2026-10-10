// Sky dome, sun, two moons, stars, clouds, and the day/night lighting rig.
import * as THREE from 'three';
import { nightGlowMaterials } from '../assets/placeholders/geo.js';

const KEYS = [
  // hour, zenith, horizon, fog, sun color, sun intensity, hemi sky, hemi ground, hemi intensity, exposure
  [0, 0x070c1c, 0x1c2640, 0x161e30, 0x9aaae0, 0.55, 0x34446a, 0x1c1c24, 0.7, 1.0],
  [4.5, 0x0c1426, 0x2e3050, 0x252a3c, 0x9aaae0, 0.5, 0x34446a, 0x1c1c24, 0.7, 1.0],
  [6.0, 0x3a4a78, 0xd88a64, 0x9a8a88, 0xffa070, 1.1, 0x7080a0, 0x403830, 0.7, 1.0],
  [8.0, 0x4a7ab8, 0xb8ccd4, 0xa8bcbc, 0xffeedd, 2.3, 0xa8c0d8, 0x5a5440, 0.85, 1.0],
  [12.5, 0x3d74b8, 0xc4d8e0, 0xb0c4c4, 0xfff6ea, 2.7, 0xb0c8e0, 0x60584a, 0.9, 1.0],
  [16.5, 0x4572b0, 0xd8cca8, 0xb4bcb0, 0xffe2b8, 2.3, 0xb0b8c8, 0x605448, 0.85, 1.0],
  [18.6, 0x2c3c74, 0xe0784c, 0x8a6a64, 0xff8650, 1.1, 0x806a80, 0x40302a, 0.7, 1.0],
  [20.0, 0x101a36, 0x4a3058, 0x2c2840, 0x9aaae0, 0.5, 0x3e4468, 0x1c1c24, 0.7, 1.0],
  [24, 0x070c1c, 0x1c2640, 0x161e30, 0x9aaae0, 0.55, 0x34446a, 0x1c1c24, 0.7, 1.0],
];

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpColor(a, b, t, out) {
  _c1.setHex(a); _c2.setHex(b);
  return out.copy(_c1).lerp(_c2, t);
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.hour = 9;
    this.zenith = new THREE.Color();
    this.horizon = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.hemiSky = new THREE.Color();
    this.hemiGround = new THREE.Color();
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.nightFactor = 0;
    this.weatherFog = 0;

    const geo = new THREE.SphereGeometry(1, 32, 16);
    this.uniforms = {
      uZenith: { value: this.zenith }, uHorizon: { value: this.horizon },
      uSunDir: { value: this.sunDir }, uMoonDir: { value: this.moonDir }, uMoon2Dir: { value: new THREE.Vector3() },
      uSunColor: { value: this.sunColor }, uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uSunDir, uMoonDir, uMoon2Dir, uSunColor;
        uniform float uTime, uNight, uCloud;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          // Below the horizon fade to a darker sea-haze.
          if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.55, min(-d.y * 4.0, 1.0));
          // Sun
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(sd, 900.0) * 30.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.08) * (1.0 - uNight);
          // Stars
          if (uNight > 0.01 && d.y > 0.0) {
            vec2 sp = d.xz / (d.y + 0.4) * 140.0;
            float s = hash(floor(sp));
            float tw = 0.6 + 0.4 * sin(uTime * 3.0 + s * 50.0);
            col += vec3(step(0.996, s) * tw * uNight * smoothstep(0.0, 0.3, d.y));
          }
          // Two moons
          float m1 = max(dot(d, uMoonDir), 0.0);
          col += vec3(1.0, 0.82, 0.7) * (smoothstep(0.9993, 0.9995, m1) * 1.2 + pow(m1, 60.0) * 0.12) * (0.25 + uNight);
          float m2 = max(dot(d, uMoon2Dir), 0.0);
          col += vec3(0.8, 0.85, 1.0) * (smoothstep(0.99975, 0.99985, m2) * 1.4 + pow(m2, 120.0) * 0.08) * (0.25 + uNight);
          // Clouds
          if (d.y > 0.0) {
            vec2 cp = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
            float c = fbm(cp);
            c = smoothstep(0.55 - uCloud * 0.25, 0.85, c);
            vec3 cloudCol = mix(uHorizon * 1.15 + uSunColor * 0.15, vec3(0.08, 0.09, 0.13), uNight * 0.85);
            col = mix(col, cloudCol, c * 0.75 * smoothstep(0.0, 0.18, d.y));
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.scale.setScalar(1800);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.FogExp2(0x9aa8b0, 0.0042);
  }

  setShadowQuality(size, enabled) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  update(dt, hour, focus, elapsed) {
    this.hour = hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (hour - a[0]) / (b[0] - a[0]);
    lerpColor(a[1], b[1], t, this.zenith);
    lerpColor(a[2], b[2], t, this.horizon);
    lerpColor(a[3], b[3], t, this.fogColor);
    lerpColor(a[4], b[4], t, this.sunColor);
    lerpColor(a[6], b[6], t, this.hemiSky);
    lerpColor(a[7], b[7], t, this.hemiGround);
    const sunI = a[5] + (b[5] - a[5]) * t;
    const hemiI = a[8] + (b[8] - a[8]) * t;

    // Sun travels east -> west; its arc is tilted south.
    const ang = ((hour - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const mang = ((hour - 18) / 12) * Math.PI;
    this.moonDir.set(Math.cos(mang) * 0.9, Math.sin(mang) * 0.85 + 0.12, -0.35).normalize();
    this.uniforms.uMoon2Dir.value.set(Math.cos(mang + 0.5), Math.sin(mang + 0.5) * 0.8 + 0.18, -0.15).normalize();
    const day = THREE.MathUtils.smoothstep(this.sunDir.y, -0.12, 0.12);
    this.nightFactor = 1 - day;
    this.lightDir.copy(day > 0.5 ? this.sunDir : this.moonDir);
    if (this.lightDir.y < 0.15) this.lightDir.y = 0.15;
    this.lightDir.normalize();

    this.uniforms.uNight.value = this.nightFactor;
    this.uniforms.uTime.value = elapsed;
    this.hemi.color.copy(this.hemiSky);
    this.hemi.groundColor.copy(this.hemiGround);
    this.hemi.intensity = hemiI * 2.3;
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = sunI;
    // Shadow camera follows the focus point (snapped to texels to avoid shimmering).
    const snap = 110 / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.lightDir.x * 150, focus.y + this.lightDir.y * 150, fz + this.lightDir.z * 150);
    this.dome.position.copy(focus);

    const fog = this.scene.fog;
    fog.color.copy(this.fogColor);
    fog.density = 0.0036 + this.nightFactor * 0.0016 + this.weatherFog;

    // Windows and lanterns glow at night.
    const glow = 0.15 + this.nightFactor * 1.0 + (1 - Math.min(1, Math.abs(hour - 12.5) / 6)) * -0.1;
    for (const m of nightGlowMaterials) m.emissiveIntensity = Math.max(0.12, glow) * m.userData.nightGlow;
  }
}
