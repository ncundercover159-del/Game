// LocalSession: runs the shared Race simulation in the browser with a fixed
// timestep and exposes interpolated kart states for rendering.
// NetSession (net/netSession.js) implements the same interface for online play.
import { SIM } from '@shared/config.js';
import { Race } from '@shared/sim/race.js';
import { createWorld } from '@shared/track/world.js';
import { getTrackDef } from '@shared/data/registry.js';
import { lerp, wrapAngle } from '@shared/math.js';

const RENDER_KEYS = ['x', 'y', 'z', 'yaw'];

export class LocalSession {
  constructor(opts) {
    this.opts = opts;
    this.def = opts.trackDef || getTrackDef(opts.trackId);
    this.world = createWorld(this.def, { mirror: opts.mirror });
    this.race = new Race({ ...opts, world: this.world });
    this.localId = opts.localId;
    this.acc = 0;
    this.paused = false;
    this.prev = new Map();
    this.view = new Map();
    this.inputFn = null;          // () => input for the local kart
    this.onEvents = null;         // (events) => void
    this.stepHooks = [];
    for (const k of this.race.karts) {
      this.prev.set(k.id, { x: k.x, y: k.y, z: k.z, yaw: k.yaw });
      this.view.set(k.id, { ...k });
    }
  }

  get karts() { return this.race.karts; }
  get phase() { return this.race.phase; }
  get time() { return this.race.time; }
  get countdown() { return this.race.countdown; }
  localKart() { return this.race.kart(this.localId); }

  update(realDt) {
    if (this.paused) return 0;
    this.acc += Math.min(realDt, 0.1);
    let steps = 0;
    while (this.acc >= SIM.dt && steps < 5) {
      for (const k of this.race.karts) {
        const p = this.prev.get(k.id);
        for (const key of RENDER_KEYS) p[key] = k[key];
      }
      if (this.inputFn && this.localId) this.race.setInput(this.localId, this.inputFn());
      for (const h of this.stepHooks) h(this.race);
      this.race.step();
      const ev = this.race.drainEvents();
      if (ev.length && this.onEvents) this.onEvents(ev);
      this.acc -= SIM.dt;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    return steps;
  }

  // Interpolated state for rendering (alpha between the last two sim ticks).
  viewState(id) {
    const k = this.race.kart(id);
    const p = this.prev.get(id);
    const v = this.view.get(id);
    Object.assign(v, k);
    const a = this.acc / SIM.dt;
    // don't interpolate across teleports (respawn)
    const jump = Math.abs(k.x - p.x) + Math.abs(k.z - p.z) > 8;
    if (!jump) {
      v.x = lerp(p.x, k.x, a);
      v.y = lerp(p.y, k.y, a);
      v.z = lerp(p.z, k.z, a);
      v.yaw = p.yaw + wrapAngle(k.yaw - p.yaw) * a;
    }
    return v;
  }

  dispose() {}
}
