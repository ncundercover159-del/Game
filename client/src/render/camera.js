// Chase camera with smoothing, FOV punch on boost, shake, look-back,
// plus scripted modes (intro fly-through, orbit, finish cams).
import * as THREE from 'three';
import { damp, wrapAngle, clamp } from '@shared/math.js';

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.baseFov = 68;
    this.fov = 68;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.initialized = false;
    this.mode = 'chase';
    this.reduceMotion = false;
    this.height = 0;
  }

  // Keep a constant horizontal FOV (~88 deg) so ultra-wide phones don't shrink the kart.
  setAspect(aspect) {
    const h = (88 * Math.PI) / 180;
    this.baseFov = clamp((2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI, 46, 70);
  }

  snap(k) {
    this.yaw = k.yaw;
    this.initialized = false;
    this.update(k, 1 / 60);
  }

  shake(amount) {
    if (this.reduceMotion) amount *= 0.25;
    this.shakeAmp = Math.min(1.2, this.shakeAmp + amount);
  }

  update(k, dt, opts = {}) {
    const lookBack = !!opts.lookBack;
    // follow heading; lag a bit during drift so the slide reads on screen
    const target = k.yaw + (lookBack ? Math.PI : 0);
    const followK = k.drift ? 4.6 : 6;
    this.yaw += wrapAngle(target - this.yaw) * (1 - Math.exp(-(lookBack ? 20 : followK) * dt));
    this.yaw = wrapAngle(this.yaw);

    const speed = Math.abs(k.speed || 0);
    // distance grows a little with speed/boost (sense of speed without lag)
    this.distX = damp(this.distX ?? 5.0, 5.0 + clamp(speed / 30, 0, 1.3) * 0.5 + (k.boostTime > 0 ? 0.6 : 0), 4, dt);
    const dist = this.distX;
    const h = 2.3 + clamp(speed / 30, 0, 1) * 0.15;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // vertical follow is softer while airborne so jumps feel big
    const yTarget = k.y;
    this.height = this.initialized ? damp(this.height, yTarget, k.grounded ? 9 : 3.5, dt) : yTarget;

    const px = k.x - fx * dist, pz = k.z - fz * dist, py = this.height + h;
    // horizontal position is rigidly kart-relative (smoothing comes from the yaw),
    // so speed never changes framing; vertical follows softly
    this.pos.set(px, this.initialized ? damp(this.pos.y, py, 10, dt) : py, pz);
    this.initialized = true;
    this.look.set(k.x + fx * 8, this.height + 1.15, k.z + fz * 8);

    // FOV punch
    const boost = k.boostTime > 0 ? (k.boostMul || 1) - 1 : 0;
    const fovTarget = this.baseFov + clamp(speed / 30, 0, 1.3) * 4 + boost * (this.reduceMotion ? 8 : 26);
    this.fov = damp(this.fov, fovTarget, 6, dt);

    this.apply(dt);
  }

  apply(dt) {
    const c = this.cam;
    c.position.copy(this.pos);
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shakeAmp * 0.35;
      c.position.x += Math.sin(this.shakeT * 1.3) * a;
      c.position.y += Math.sin(this.shakeT * 1.7 + 1) * a * 0.7;
      c.position.z += Math.cos(this.shakeT * 1.1) * a;
      this.shakeAmp = damp(this.shakeAmp, 0, 6, dt);
    }
    c.lookAt(this.look);
    if (Math.abs(c.fov - this.fov) > 0.01) {
      c.fov = this.fov;
      c.updateProjectionMatrix();
    }
  }

  // scripted: position & target directly
  setPose(pos, look, fov = this.baseFov) {
    this.pos.copy(pos);
    this.look.copy(look);
    this.fov = fov;
    this.cam.position.copy(pos);
    this.cam.lookAt(look);
    this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
  }
}
