// Renderer, scene and camera setup plus quality presets.
import * as THREE from 'three';

export const QUALITY = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 1024, lights: 2, veg: 0.45, far: 900 },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, lights: 4, veg: 0.75, far: 1400 },
  high: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, lights: 6, veg: 1, far: 2400 },
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'game-canvas';
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8aa0b0);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 2400);
    this.quality = 'medium';
    this.fov = 65;
    this.renderScale = 1;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.medium;
    this.quality = name;
    this.q = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio) * this.renderScale);
    this.renderer.shadowMap.enabled = q.shadows;
    this.camera.far = q.far;
    this.camera.updateProjectionMatrix();
    this.resize();
    return q;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
