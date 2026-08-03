// RERUN — ghosts.
//
// Sixty articulated bodies across five InstancedMeshes (head, torso, arms,
// legs, eyes). Hats are three more, flies a single Points cloud. This is the
// one real performance requirement in the project and it is built in, not
// retrofitted — a per-ghost skinned mesh would be sixty draw calls.
//
// Ghosts are deterministic replays against a server-synced clock, so they need
// no ongoing network sync at all — just the recording, sent once.

import {
  ConeGeometry, CylinderGeometry, InstancedMesh, MeshBasicMaterial, Color,
  Points, PointsMaterial, BufferGeometry, BufferAttribute, DoubleSide,
} from 'three';

import { MAX_GHOSTS, SLOT_COLORS } from '@shared/constants.js';
import { sampleAt, makeSampleOut, buildStride } from '@shared/ghostbuf.js';
import { writeMatrix, writeLeaningMatrix } from './instancing.js';
import { CharacterRig } from './character.js';

const FLIES_PER_GHOST = 5;
const MAX_FLY_GHOSTS = 12;

export function ghostColor(slot, gen) {
  const base = new Color(SLOT_COLORS[slot % SLOT_COLORS.length]);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const c = new Color();
  // Your colour, progressively desaturated by generation. Asymptotic rather
  // than exponential-to-a-floor: over twenty generations an exponential curve
  // bottoms out by about gen 8 and every ghost after that is the same grey.
  const g = Math.max(0, gen - 1);
  c.setHSL(
    hsl.h,
    hsl.s * (0.30 + 0.70 * Math.pow(0.86, g)),
    hsl.l * (0.55 + 0.45 * Math.pow(0.90, g)),
  );
  return c;
}

export class Ghosts {
  constructor(scene) {
    this.list = [];
    this.byId = new Map();
    this.bodies = []; // collision bodies for local prediction
    this.onScream = null;

    // --- bodies: head, torso, arms, legs, eyes — five draw calls for sixty ---
    this.rig = new CharacterRig(scene, MAX_GHOSTS, { ghost: true, opacity: 0.6 });

    // --- hats: gen 3 a cone, gen 4 a wide brim, gen 5 something structurally
    //     unsound, gen 6 all three at once and enormous ---
    const coneGeo = new ConeGeometry(0.26, 0.44, 8);
    coneGeo.translate(0, 0.22, 0);
    this.coneMesh = this.makeHat(coneGeo);

    // Wide, but not so wide it hides the wearer from a top-down camera.
    const brimGeo = new CylinderGeometry(0.44, 0.44, 0.05, 14);
    brimGeo.translate(0, 0.025, 0);
    this.brimMesh = this.makeHat(brimGeo);

    const towerGeo = new ConeGeometry(0.2, 1.25, 5, 1, true);
    towerGeo.translate(0, 0.62, 0);
    this.towerMesh = this.makeHat(towerGeo, true);

    // --- flies (gen 6 only) ---
    const flyPos = new Float32Array(MAX_FLY_GHOSTS * FLIES_PER_GHOST * 3);
    const flyGeo = new BufferGeometry();
    flyGeo.setAttribute('position', new BufferAttribute(flyPos, 3));
    flyGeo.setDrawRange(0, 0);
    this.flies = new Points(flyGeo, new PointsMaterial({
      color: 0x2a2620, size: 0.085, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.flies.frustumCulled = false;
    this.flyPos = flyPos;

    scene.add(this.coneMesh, this.brimMesh, this.towerMesh, this.flies);
  }

  makeHat(geo, doubleSided) {
    const m = new InstancedMesh(
      geo,
      new MeshBasicMaterial({
        transparent: true, opacity: 0.5, depthWrite: false,
        side: doubleSided ? DoubleSide : undefined,
      }),
      MAX_GHOSTS,
    );
    m.frustumCulled = false;
    m.count = 0;
    const white = new Color(1, 1, 1);
    for (let i = 0; i < MAX_GHOSTS; i++) m.setColorAt(i, white);
    m.instanceColor.needsUpdate = true;
    return m;
  }

  clear() {
    this.list.length = 0;
    this.byId.clear();
    this.bodies.length = 0;
  }

  /** Add decoded ghosts. `nowMs` is client time; reveal is staggered. */
  add(decoded, nowMs) {
    for (const g of decoded) {
      if (this.byId.has(g.id)) continue;
      const rec = {
        id: g.id,
        slot: g.slot,
        gen: g.gen,
        round: g.round,
        rec: g.rec,
        stride: buildStride(g.rec),
        color: ghostColor(g.slot, g.gen),
        bobPhase: (g.id * 2.399963) % (Math.PI * 2),
        revealAt: nowMs + (g.revealDelayMs || 0),
        primed: false,
        lastDead: false,
        lastIndex: 0,
        cur: makeSampleOut(),
      };
      this.list.push(rec);
      this.byId.set(g.id, rec);
    }
    this.list.sort((a, b) => a.id - b.id);
  }

  remove(ids) {
    for (const id of ids) {
      const g = this.byId.get(id);
      if (!g) continue;
      this.byId.delete(id);
      const i = this.list.indexOf(g);
      if (i >= 0) this.list.splice(i, 1);
    }
  }

  /**
   * @param ghostClock  mod(serverNow - playStart, 20000) — the shared clock
   * @param nowMs       client wall time, for reveal staggering and bobbing
   * @param world       optional World, to drop a decal per ghost
   */
  update(ghostClock, nowMs, world) {
    const coneArr = this.coneMesh.instanceMatrix.array;
    const brimArr = this.brimMesh.instanceMatrix.array;
    const towerArr = this.towerMesh.instanceMatrix.array;

    // Instance slots shift as ghosts reveal and retire, so colours are written
    // alongside the matrices rather than cached by list index.
    const coneCol = this.coneMesh.instanceColor.array;
    const brimCol = this.brimMesh.instanceColor.array;
    const towerCol = this.towerMesh.instanceColor.array;

    const bodies = this.bodies;
    bodies.length = 0;

    let n = 0, coneN = 0, brimN = 0, towerN = 0, flyN = 0;
    const tSec = nowMs / 1000;
    this.rig.begin();

    for (let i = 0; i < this.list.length && n < MAX_GHOSTS; i++) {
      const g = this.list[i];
      const s = sampleAt(g.rec, ghostClock, g.cur, g.stride);

      // Collision bodies use the exact sample — the server does the same maths
      // on the same clock, so the two agree.
      bodies.push({ x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz });

      // The death loop. Every twenty seconds, forever, with the same scream.
      // The first sample only primes the edge detector — otherwise a late
      // joiner's forty-ghost archive all screams at once on arrival.
      if (!g.primed) {
        g.primed = true;
      } else {
        if (s.index < g.lastIndex) g.lastDead = (g.rec.flags[0] & 1) !== 0;
        if (s.dead && !g.lastDead && this.onScream) this.onScream(g, s);
      }
      g.lastIndex = s.index;
      g.lastDead = s.dead;

      if (nowMs < g.revealAt) continue;

      // Near-sync is funnier than sync: a per-ghost vertical bob so a stack of
      // your own past selves doing the same thing isn't perfectly aligned.
      const bob = Math.sin(tSec * 1.7 + g.bobPhase) * 0.045;
      const pop = Math.min(1, (nowMs - g.revealAt) / 260);
      const scale = 0.6 + 0.4 * pop + (pop < 1 ? Math.sin(pop * Math.PI) * 0.18 : 0);

      const y = s.y + bob;
      this.rig.write({
        x: s.x, y, z: s.z, yaw: s.yaw,
        dist: s.dist,
        speed: Math.hypot(s.vx, s.vz),
        grounded: s.grounded,
        dead: s.dead,
        t: tSec,
        scale,
        color: g.color,
      });

      // hats
      const head = y + CharacterRig.headTop(scale);
      // Gen 3 a cone, 4 a wide brim, 5 something structurally unsound, 6 all
      // three at once — and from there it keeps growing, because twenty rounds
      // means twenty generations and they should not all look like gen 6.
      const gen = g.gen;
      const huge = gen >= 6 ? Math.min(2.1, 1.15 + (gen - 6) * 0.05) : 1;
      if (gen === 3 || gen >= 6) {
        writeMatrix(coneArr, coneN, s.x, head + 0.02 * huge, s.z, s.yaw, huge, huge, huge);
        setCol(coneCol, coneN++, g.color);
      }
      if (gen === 4 || gen >= 6) {
        // The brim is the one that hides its wearer from a camera looking
        // down, so it grows at less than half the rate of the vertical hats.
        const wide = 1 + (huge - 1) * 0.45;
        const lift = gen >= 6 ? 0.5 * huge : 0.02;
        writeMatrix(brimArr, brimN, s.x, head + lift, s.z, s.yaw, wide, huge, wide);
        setCol(brimCol, brimN++, g.color);
      }
      if (gen === 5 || gen >= 6) {
        // Structurally unsound. It sways.
        const lean = 0.22 + Math.sin(tSec * 2.3 + g.bobPhase) * 0.13;
        const dirA = tSec * 0.9 + g.bobPhase;
        const base = head + (gen >= 6 ? 0.62 * huge : 0.02);
        writeLeaningMatrix(towerArr, towerN, s.x, base, s.z, s.yaw, lean, dirA, huge, huge, huge);
        setCol(towerCol, towerN++, g.color);
      }

      if (gen >= 6 && flyN < MAX_FLY_GHOSTS) {
        const o = flyN * FLIES_PER_GHOST * 3;
        for (let f = 0; f < FLIES_PER_GHOST; f++) {
          const a = tSec * (2.4 + f * 0.42) + f * 2.1 + g.bobPhase;
          const r = 0.34 + 0.16 * Math.sin(tSec * 1.6 + f);
          this.flyPos[o + f * 3] = s.x + Math.cos(a) * r;
          this.flyPos[o + f * 3 + 1] = head + 0.34 + Math.sin(a * 1.7 + f) * 0.2;
          this.flyPos[o + f * 3 + 2] = s.z + Math.sin(a) * r;
        }
        flyN++;
      }

      if (world && s.y > -2) world.addDecal(s.x, s.y, s.z);
      n++;
    }

    this.rig.end();
    this.coneMesh.count = coneN;
    this.coneMesh.instanceMatrix.needsUpdate = true;
    this.coneMesh.instanceColor.needsUpdate = true;
    this.brimMesh.count = brimN;
    this.brimMesh.instanceMatrix.needsUpdate = true;
    this.brimMesh.instanceColor.needsUpdate = true;
    this.towerMesh.count = towerN;
    this.towerMesh.instanceMatrix.needsUpdate = true;
    this.towerMesh.instanceColor.needsUpdate = true;
    this.flies.geometry.setDrawRange(0, flyN * FLIES_PER_GHOST);
    this.flies.geometry.attributes.position.needsUpdate = true;
  }

  countFor(slot) {
    let n = 0;
    for (const g of this.list) if (g.slot === slot) n++;
    return n;
  }

  get length() { return this.list.length; }
}

function setCol(arr, i, c) {
  arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
}

