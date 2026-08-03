// RERUN — the living. Capsules with two dot eyes, same as the ghosts, except
// lit and fully opaque so you can tell who is still allowed to make choices.

import {
  CapsuleGeometry, CircleGeometry, InstancedMesh, MeshLambertMaterial,
  MeshBasicMaterial, Color, DoubleSide, Vector3,
} from 'three';

import {
  MAX_PLAYERS, PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT, SLOT_COLORS,
} from '@shared/constants.js';
import { writeMatrix } from './instancing.js';

export class Avatars {
  constructor(scene) {
    const capsule = new CapsuleGeometry(
      PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2, 3, 8,
    );
    capsule.translate(0, PLAYER_HEIGHT / 2, 0);
    this.mesh = new InstancedMesh(capsule, new MeshLambertMaterial({}), MAX_PLAYERS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const white = new Color(1, 1, 1);
    for (let i = 0; i < MAX_PLAYERS; i++) this.mesh.setColorAt(i, white);

    const eye = new CircleGeometry(0.078, 6);
    this.eyes = new InstancedMesh(
      eye,
      new MeshBasicMaterial({ color: 0x0b0c14, side: DoubleSide }),
      MAX_PLAYERS * 2,
    );
    this.eyes.frustumCulled = false;
    this.eyes.count = 0;

    scene.add(this.mesh, this.eyes);

    this.tagRoot = document.getElementById('tags');
    this.tags = new Map(); // slot -> element
    this._v = new Vector3();
  }

  /**
   * players: [{ slot, x, y, z, yaw, dead, late, disconnected, name }]
   */
  update(players, camera, world) {
    const arr = this.mesh.instanceMatrix.array;
    const col = this.mesh.instanceColor.array;
    const eyeArr = this.eyes.instanceMatrix.array;
    let n = 0, e = 0;

    const seen = new Set();

    for (const p of players) {
      if (p.y < -3) { this.hideTag(p.slot); continue; } // gone into the pit
      const c = COLORS[p.slot % COLORS.length];
      const dim = p.dead || p.disconnected ? 0.4 : 1;

      writeMatrix(arr, n, p.x, p.y, p.z, p.yaw, 1, 1, 1);
      col[n * 3] = c.r * dim; col[n * 3 + 1] = c.g * dim; col[n * 3 + 2] = c.b * dim;
      n++;

      const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      const fx = sn * PLAYER_RADIUS * 0.92, fz = cs * PLAYER_RADIUS * 0.92;
      const rx = cs * 0.145, rz = -sn * 0.145;
      writeMatrix(eyeArr, e++, p.x + fx + rx, p.y + EYE_HEIGHT, p.z + fz + rz, p.yaw, 1, 1, 1);
      writeMatrix(eyeArr, e++, p.x + fx - rx, p.y + EYE_HEIGHT, p.z + fz - rz, p.yaw, 1, 1, 1);

      if (world) world.addDecal(p.x, p.y, p.z);

      seen.add(p.slot);
      this.placeTag(p, camera, c);
    }

    for (const slot of [...this.tags.keys()]) {
      if (!seen.has(slot)) this.hideTag(slot);
    }

    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.eyes.count = e;
    this.eyes.instanceMatrix.needsUpdate = true;
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
    const html = p.late
      ? `${label}<span class="tag-new">NEW HERE</span>`
      : label;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.style.color = `#${color.getHexString()}`;

    this._v.set(p.x, p.y + PLAYER_HEIGHT + 0.42, p.z).project(camera);
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

  clearTags() {
    for (const el of this.tags.values()) el.remove();
    this.tags.clear();
  }
}

const COLORS = SLOT_COLORS.map((h) => new Color(h));
export { COLORS };
