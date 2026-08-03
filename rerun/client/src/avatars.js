// RERUN — the living. Same articulated rig as the ghosts, except lit and
// opaque, so you can tell at a glance who is still allowed to make choices.

import { Color, Vector3 } from 'three';

import { MAX_PLAYERS, SLOT_COLORS } from '@shared/constants.js';
import { CharacterRig, RIG } from './character.js';

export class Avatars {
  constructor(scene) {
    this.rig = new CharacterRig(scene, MAX_PLAYERS, { ghost: false });

    this.tagRoot = document.getElementById('tags');
    this.tags = new Map(); // slot -> element
    // Distance walked, per player, so the stride matches the ground the same
    // way a ghost's does.
    this.dist = new Map();
    this.lastPos = new Map();
    this._v = new Vector3();
  }

  /** players: [{ slot, x, y, z, yaw, dead, late, disconnected, grounded, name }] */
  update(players, camera, world, dt) {
    this.rig.begin();
    const seen = new Set();
    const t = performance.now() / 1000;

    for (const p of players) {
      if (p.y < -3) { this.hideTag(p.slot); continue; } // gone into the pit

      const prev = this.lastPos.get(p.slot);
      let speed = 0;
      let d = this.dist.get(p.slot) || 0;
      if (prev) {
        const step = Math.hypot(p.x - prev.x, p.z - prev.z);
        // A respawn teleports; don't let that spin the legs.
        if (step < 1.5) {
          d += step;
          speed = dt > 0 ? step / dt : 0;
        }
      }
      this.dist.set(p.slot, d);
      if (!prev) this.lastPos.set(p.slot, { x: p.x, z: p.z });
      else { prev.x = p.x; prev.z = p.z; }

      const base = COLORS[p.slot % COLORS.length];
      const dim = p.dead || p.disconnected ? 0.42 : 1;
      TMP.setRGB(base.r * dim, base.g * dim, base.b * dim);

      this.rig.write({
        x: p.x, y: p.y, z: p.z, yaw: p.yaw,
        dist: d,
        speed,
        grounded: p.grounded !== false,
        dead: p.dead,
        t,
        color: TMP,
      });

      if (world) world.addDecal(p.x, p.y, p.z);
      seen.add(p.slot);
      this.placeTag(p, camera, base);
    }

    for (const slot of [...this.tags.keys()]) {
      if (!seen.has(slot)) this.hideTag(slot);
    }
    this.rig.end();
  }

  placeTag(p, camera, color) {
    let el = this.tags.get(p.slot);
    if (!el) {
      el = document.createElement('div');
      el.className = 'tag-el';
      this.tagRoot.appendChild(el);
      this.tags.set(p.slot, el);
    }
    const label = `${p.name || ''}${p.disconnected ? ' (AWAY)' : ''}`;
    // Late joiners start with zero ghosts of their own and are at a real
    // disadvantage. They wear it.
    const html = p.late ? `${label}<span class="tag-new">NEW HERE</span>` : label;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.style.color = `#${color.getHexString()}`;

    this._v.set(p.x, p.y + RIG.headY + RIG.headR + 0.4, p.z).project(camera);
    if (this._v.z > 1) { el.style.display = 'none'; return; }
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    el.style.display = '';
    el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  hideTag(slot) {
    const el = this.tags.get(slot);
    if (el) el.style.display = 'none';
  }

  /** New match: forget everyone's stride so nobody starts mid-step. */
  reset() {
    this.dist.clear();
    this.lastPos.clear();
  }

  clearTags() {
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
  }
}

const COLORS = SLOT_COLORS.map((h) => new Color(h));
const TMP = new Color();
export { COLORS };
