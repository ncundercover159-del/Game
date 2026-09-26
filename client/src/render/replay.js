// Finish replay: the stage keeps a rolling buffer of every kart's visual state
// (20 Hz, ~10 s). When the local player crosses the line, the last seconds
// before the finish are replayed with TV-style trackside cameras, then the
// view returns to the live race.
const FIELDS = ['x', 'y', 'z', 'yaw', 'speed', 'steer', 'drift', 'driftTier', 'boostTime', 'grounded', 'glider', 'spin', 'tumble', 'squish', 'star', 'balloons'];
const HZ = 20;
const KEEP = 10; // seconds

export class ReplayBuffer {
  constructor() { this.frames = []; this.acc = 0; }

  record(karts, viewState, dt) {
    this.acc += dt;
    if (this.acc < 1 / HZ) return;
    this.acc = 0;
    const f = new Map();
    for (const k of karts) {
      const v = viewState(k.id);
      if (!v) continue;
      const o = {};
      for (const key of FIELDS) o[key] = v[key];
      f.set(k.id, o);
    }
    this.frames.push(f);
    if (this.frames.length > KEEP * HZ) this.frames.shift();
  }

  // Take the last `seconds` of frames (before now) as a clip.
  clip(seconds = 7) {
    return this.frames.slice(-Math.round(seconds * HZ));
  }
}

export class ReplayPlayer {
  // clip: frames; world: track world (for camera spots); focusId: kart to follow
  constructor(clip, world, focusId) {
    this.clip = clip;
    this.world = world;
    this.focusId = focusId;
    this.t = 0;
    this.dur = clip.length / HZ;
    this.camT = 0;
    this.cam = null;
  }

  get done() { return this.t >= this.dur; }

  // state for kart id at the current replay time (interpolated)
  stateAt(id, into) {
    const f = Math.min(this.clip.length - 1.001, this.t * HZ);
    const i = Math.floor(f), u = f - i;
    const a = this.clip[i]?.get(id), b = this.clip[i + 1]?.get(id) || a;
    if (!a) return null;
    Object.assign(into, a);
    for (const k of ['x', 'y', 'z']) into[k] = a[k] + (b[k] - a[k]) * u;
    let dy = b.yaw - a.yaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    into.yaw = a.yaw + dy * u;
    return into;
  }

  // Trackside camera: a new spot ahead of the focus kart every ~2.3 s.
  camera(focus, camera) {
    const w = this.world;
    if (!this.cam || this.camT > 2.3) {
      this.camT = 0;
      let p;
      if (w.at && w.nearestMain) {
        const pj = w.nearestMain(focus.x, focus.y, focus.z);
        const side = Math.random() < 0.5 ? -1 : 1;
        const q = w.at(((pj.s + 28 + Math.random() * 20) % w.length) / w.length, side * (1.25 + Math.random() * 0.5));
        p = { x: q.x, y: q.y + 2 + Math.random() * 4, z: q.z };
      } else {
        const a = Math.random() * Math.PI * 2;
        p = { x: focus.x + Math.sin(a) * 18, y: focus.y + 6, z: focus.z + Math.cos(a) * 18 };
      }
      this.cam = p;
    }
    camera.position.set(this.cam.x, this.cam.y, this.cam.z);
    camera.lookAt(focus.x, focus.y + 0.8, focus.z);
    const d = Math.hypot(focus.x - this.cam.x, focus.z - this.cam.z);
    // zoom so the kart stays a readable size
    const fov = Math.max(18, Math.min(70, (2 * Math.atan(4.5 / Math.max(1, d)) * 180) / Math.PI));
    camera.fov += (fov - camera.fov) * 0.2;
    camera.updateProjectionMatrix();
  }

  step(dt) { this.t += dt; this.camT += dt; }
}
