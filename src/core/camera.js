// Third/first-person orbit camera with wall and terrain collision.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = Math.PI; // facing -Z initially
    this.pitch = 0.25;
    this.distance = 5.5;
    this.targetDistance = 5.5;
    this.minDist = 0;
    this.maxDist = 18;
    this.current = 5.5;
    this.focus = new THREE.Vector3();
    this.smoothFocus = new THREE.Vector3();
    this.firstPerson = false;
    this.sensitivity = 1;
    this.invertY = false;
    this.shake = 0;
    this.headHeight = 1.62;
  }

  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  rotate(dx, dy) {
    const s = 0.0042 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch += (this.invertY ? -dy : dy) * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.45);
  }

  zoom(steps) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + steps * (this.targetDistance < 4 ? 0.8 : 1.4), this.minDist, this.maxDist);
  }

  setFirstPerson(on) {
    this.targetDistance = on ? 0 : Math.max(this.targetDistance, 5);
  }

  snapTo(pos) {
    this.smoothFocus.copy(pos);
  }

  update(dt, target, height = 1.7) {
    this.headHeight = height * 0.9;
    this.focus.set(target.x, target.y + this.headHeight, target.z);
    // Smooth vertical motion slightly (stairs, landing) but keep horizontal tight.
    this.smoothFocus.x = this.focus.x;
    this.smoothFocus.z = this.focus.z;
    this.smoothFocus.y += (this.focus.y - this.smoothFocus.y) * Math.min(1, dt * 14);
    this.current += (this.targetDistance - this.current) * Math.min(1, dt * 10);
    this.firstPerson = this.current < 0.6;

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp); // camera -> behind target
    const f = this.smoothFocus;
    let dist = this.firstPerson ? 0 : this.current;
    if (dist > 0) {
      const ex = f.x + dir.x * (dist + 0.3), ey = f.y + dir.y * (dist + 0.3), ez = f.z + dir.z * (dist + 0.3);
      const t = this.collision.segmentFree(f.x, f.y, f.z, ex, ey, ez, 0.25, true, false);
      dist = Math.max(0.35, Math.min(dist, (dist + 0.3) * t - 0.3));
    }
    const cam = this.camera;
    if (this.firstPerson) {
      cam.position.copy(f);
      cam.position.y += 0.08;
      const look = new THREE.Vector3(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp);
      cam.lookAt(cam.position.clone().add(look));
    } else {
      cam.position.set(f.x + dir.x * dist, f.y + dir.y * dist, f.z + dir.z * dist);
      // Ride over hills instead of zooming into them.
      const T = this.collision.terrain;
      let ground = T.heightAt(cam.position.x, cam.position.z);
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        ground = Math.max(ground, T.heightAt(f.x + (cam.position.x - f.x) * k, f.z + (cam.position.z - f.z) * k) - (1 - k) * 0.6);
      }
      const minY = Math.max(ground, 0.05) + 0.45;
      if (cam.position.y < minY) cam.position.y = minY;
      cam.lookAt(f.x, f.y + 0.25 * Math.min(1, dist / 6), f.z);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.12;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
  }
}
