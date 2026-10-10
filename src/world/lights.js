// A small fixed pool of point lights assigned to the nearest light anchors (lanterns, hearths,
// interiors). Keeping the count constant avoids shader recompiles.
import * as THREE from 'three';

export class LightPool {
  constructor(scene, anchors, count = 4) {
    this.scene = scene;
    this.anchors = anchors;
    this.lights = [];
    this.setCount(count);
    this.timer = 0;
    this.assigned = [];
    this.beacon = new THREE.PointLight(0xffe0a0, 0, 60, 1.6);
    scene.add(this.beacon);
    this.beaconAnchor = anchors.find((a) => a.beacon);
    if (this.beaconAnchor) this.beacon.position.set(this.beaconAnchor.x, this.beaconAnchor.y, this.beaconAnchor.z);
  }

  setCount(n) {
    while (this.lights.length < n) {
      const l = new THREE.PointLight(0xffaa66, 0, 10, 1.8);
      l.castShadow = false;
      this.scene.add(l);
      this.lights.push(l);
    }
    while (this.lights.length > n) this.scene.remove(this.lights.pop());
  }

  update(dt, focus, night, elapsed) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const scored = [];
      for (const a of this.anchors) {
        if (a.beacon) continue;
        const d = Math.hypot(a.x - focus.x, a.z - focus.z, (a.y - focus.y) * 0.5);
        if (d > a.distance + 30) continue;
        const weight = a.interior ? 1 : night;
        if (weight < 0.05) continue;
        scored.push({ a, s: d - (a.interior ? 6 : 0) });
      }
      scored.sort((p, q) => p.s - q.s);
      this.assigned = scored.slice(0, this.lights.length).map((x) => x.a);
    }
    this.lights.forEach((l, i) => {
      const a = this.assigned[i];
      if (!a) { l.intensity = 0; return; }
      l.position.set(a.x, a.y, a.z);
      l.color.copy(a.color);
      l.distance = a.distance;
      const flick = a.flicker ? 0.85 + Math.sin(elapsed * 11 + a.phase) * 0.08 + Math.sin(elapsed * 23 + a.phase * 3) * 0.07 : 1;
      const weight = a.interior ? Math.max(0.65, night) : night;
      l.intensity = a.intensity * flick * weight;
    });
    if (this.beaconAnchor) {
      this.beacon.intensity = this.beaconAnchor.intensity * night;
    }
  }
}
