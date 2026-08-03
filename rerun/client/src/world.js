// RERUN — the scene. Arena geometry merged into one draw call, plates and
// fake shadow decals instanced, no shadow maps anywhere. With sixty bodies on
// screen shadow maps are not close to affordable.

import {
  BufferGeometry, BufferAttribute, BoxGeometry, CylinderGeometry, CircleGeometry,
  Mesh, MeshLambertMaterial, MeshBasicMaterial, InstancedMesh, Object3D, Color,
  Scene, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  Vector3, Fog, CanvasTexture, DoubleSide, RingGeometry, SRGBColorSpace,
} from 'three';

import {
  STATIC_BOXES, DOOR_BOX, DOOR_OPEN_DROP, PLATES, ARENA, PIT, surfaceBelow,
  BOXES_DOOR_OPEN,
} from '@shared/arena.js';
import { PLATE_RADIUS } from '@shared/constants.js';

const MAX_DECALS = 80;
const DECAL_CULL = 15; // metres — beyond this the decal is not drawn

const KIND_COLOR = {
  floor: 0x232742,
  wall: 0x1a1d33,
  ledge: 0x2c3153,
  room: 0x272b48,
  door: 0x5a4630,
};

export class World {
  constructor(canvas) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.pixelRatioCap = 2;
    this.applyPixelRatio();

    this.scene = new Scene();
    this.scene.fog = new Fog(0x0a0b12, 26, 62);

    this.camera = new PerspectiveCamera(52, 1, 0.5, 120);

    const hemi = new HemisphereLight(0xa8c0ff, 0x1a1626, 1.7);
    this.scene.add(hemi);
    const dir = new DirectionalLight(0xfff0d0, 1.3);
    dir.position.set(-7, 16, 5);
    this.scene.add(dir);

    this.buildArena();
    this.buildPlates();
    this.buildDecals();

    this.doorOpen = false;
    this.resize();
  }

  applyPixelRatio() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
  }

  /** Called by the frame-pressure watchdog in main.js. */
  setPixelRatioCap(cap) {
    if (this.pixelRatioCap === cap) return;
    this.pixelRatioCap = cap;
    this.applyPixelRatio();
    this.resize();
  }

  // ------------------------------------------------------------- arena ---
  buildArena() {
    const geos = [];
    for (const b of STATIC_BOXES) {
      geos.push(boxGeo(b, KIND_COLOR[b.kind] || 0x333333));
    }
    // A rim around the pit so the hole reads at a glance.
    geos.push(pitRim());
    const merged = mergeColoured(geos);
    const mat = new MeshLambertMaterial({ vertexColors: true });
    this.arena = new Mesh(merged, mat);
    this.arena.frustumCulled = false;
    this.scene.add(this.arena);

    // The door moves, so it is its own (single) mesh.
    const dg = boxGeo(DOOR_BOX, KIND_COLOR.door);
    this.door = new Mesh(dg, new MeshLambertMaterial({ vertexColors: true }));
    this.scene.add(this.door);
  }

  setDoorOpen(open, dt) {
    this.doorOpen = open;
    const target = open ? -DOOR_OPEN_DROP : 0;
    this.door.position.y += (target - this.door.position.y) * Math.min(1, dt * 9);
  }

  // ------------------------------------------------------------ plates ---
  buildPlates() {
    const geo = new CylinderGeometry(PLATE_RADIUS, PLATE_RADIUS * 0.94, 0.09, 14);
    geo.translate(0, 0.045, 0);
    this.plateMesh = new InstancedMesh(
      geo,
      new MeshLambertMaterial({ vertexColors: false }),
      PLATES.length,
    );
    this.plateMesh.frustumCulled = false;

    const ringGeo = new RingGeometry(PLATE_RADIUS * 1.02, PLATE_RADIUS * 1.3, 20);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMesh = new InstancedMesh(
      ringGeo,
      new MeshBasicMaterial({ transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
      PLATES.length,
    );
    this.ringMesh.frustumCulled = false;

    const dummy = new Object3D();
    for (let i = 0; i < PLATES.length; i++) {
      const p = PLATES[i];
      dummy.position.set(p.x, p.y + 0.005, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.plateMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.y + 0.02;
      dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, dummy.matrix);
      this.plateMesh.setColorAt(i, new Color(0x2b2f4d));
      this.ringMesh.setColorAt(i, new Color(0x2b2f4d));
    }
    this.plateMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.plateMesh, this.ringMesh);

    this._colOff = new Color(0x2b2f4d);
    this._colArmed = new Color(0x6d5a1c);
    this._colOn = new Color(0xffd24a);
    this._colRingOff = new Color(0x22263f);
    this._colRingArmed = new Color(0x8a6f1e);
    this._colOnT = new Color(0x4fc3ff);
    this._colArmedT = new Color(0x1d566d);
    this._colRingArmedT = new Color(0x2a6f95);
    this._plateKey = '';
  }

  /**
   * mask: bitfield of pressed plates. required: plate indices this round.
   * turnstiles: indices that only stay down while weight is increasing — they
   * read blue, because standing on one is a waste of a body.
   */
  updatePlates(mask, required, turnstiles) {
    const key = `${mask}|${required}|${turnstiles}`;
    if (key === this._plateKey) return;
    this._plateKey = key;

    const req = new Set(required || []);
    const turn = new Set(turnstiles || []);
    for (let i = 0; i < PLATES.length; i++) {
      const on = (mask & (1 << i)) !== 0;
      const armed = req.has(i);
      const t = turn.has(i);
      this.plateMesh.setColorAt(i,
        on ? (t ? this._colOnT : this._colOn)
          : armed ? (t ? this._colArmedT : this._colArmed) : this._colOff);
      this.ringMesh.setColorAt(i,
        on ? (t ? this._colOnT : this._colOn)
          : armed ? (t ? this._colRingArmedT : this._colRingArmed) : this._colRingOff);
    }
    this.plateMesh.instanceColor.needsUpdate = true;
    this.ringMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------ decals ---
  buildDecals() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new CanvasTexture(c);
    const geo = new CircleGeometry(0.55, 10);
    geo.rotateX(-Math.PI / 2);
    this.decals = new InstancedMesh(
      geo,
      new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }),
      MAX_DECALS,
    );
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    this.scene.add(this.decals);
    this._decalDummy = new Object3D();
    this._camPos = new Vector3();
  }

  beginDecals() {
    this._decalN = 0;
    this.camera.getWorldPosition(this._camPos);
  }

  addDecal(x, y, z) {
    if (this._decalN >= MAX_DECALS) return;
    const ground = surfaceBelow(BOXES_DOOR_OPEN, x, z, y + 0.05);
    if (ground === -Infinity) return; // over the pit; nothing to fall on
    const dx = x - this._camPos.x, dz = z - this._camPos.z, dy = ground - this._camPos.y;
    if (dx * dx + dy * dy + dz * dz > DECAL_CULL * DECAL_CULL) return;
    const drop = Math.max(0, y - ground);
    const s = Math.max(0.35, 1 - drop * 0.22);
    const d = this._decalDummy;
    d.position.set(x, ground + 0.015, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(s, 1, s);
    d.updateMatrix();
    this.decals.setMatrixAt(this._decalN++, d.matrix);
  }

  endDecals() {
    this.decals.count = this._decalN;
    this.decals.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ camera ---
  // Fixed high angle framing the whole arena. No follow: you need to see the
  // crowd, and a chase camera in a room this dense is nauseating.
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  // The arena is framed into this slice of the screen. The bottom is left
  // clear for the joystick and JUMP; the top clears the HUD.
  static FRAME = { x: 0.96, yTop: 0.86, yBottom: -0.74 };

  fitCamera() {
    const cx = (ARENA.minX + ARENA.maxX) / 2;
    const cz = (ARENA.minZ + ARENA.maxZ) / 2 - 0.4;
    const centre = new Vector3(cx, 0.9, cz);

    const corners = [];
    for (const x of [ARENA.minX - 0.5, ARENA.maxX + 0.5]) {
      for (const z of [ARENA.minZ - 0.5, ARENA.maxZ + 0.5]) {
        for (const y of [0, 3.2]) corners.push(new Vector3(x, y, z));
      }
    }

    // A tall screen wants a steeper angle: the closer to top-down, the less
    // the arena's depth foreshortens, so the more of the screen it fills.
    // Not fully top-down, though — you still need to read who is stacked on
    // whose shoulders.
    const a = this.camera.aspect;
    const t = Math.max(0, Math.min(1, (a - 0.42) / (1.1 - 0.42)));
    const elev = (62 - t * 16) * (Math.PI / 180);
    const dir = new Vector3(0, Math.sin(elev), Math.cos(elev)).normalize();
    // Camera-local up, in the vertical plane containing `dir`.
    const up = new Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();

    const F = World.FRAME;
    const halfH = (F.yTop - F.yBottom) / 2;
    const midY = (F.yTop + F.yBottom) / 2;
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);

    const target = new Vector3();
    const v = new Vector3();
    let dist = 30;
    let shift = 0;

    for (let iter = 0; iter < 40; iter++) {
      target.copy(centre).addScaledVector(up, shift);
      this.camera.position.copy(dir).multiplyScalar(dist).add(target);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld(true);

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of corners) {
        v.copy(c).project(this.camera);
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }

      const scale = Math.max((maxX - minX) / (2 * F.x), (maxY - minY) / (2 * halfH));
      const cyErr = midY - (minY + maxY) / 2;
      // Raising the camera pushes content down the screen, hence the minus.
      shift -= cyErr * dist * tanHalf;
      if (Math.abs(scale - 1) < 0.0015 && Math.abs(cyErr) < 0.0015) break;
      dist *= scale;
    }

    target.copy(centre).addScaledVector(up, shift);
    this.camera.position.copy(dir).multiplyScalar(dist).add(target);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get info() {
    return this.renderer.info.render;
  }
}

// --------------------------------------------------------------- helpers ---

function boxGeo(b, color) {
  const g = new BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
  g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  paint(g, color);
  return g;
}

function pitRim() {
  const t = 0.14;
  const h = 0.16;
  const parts = [
    { x0: PIT.x0 - t, x1: PIT.x1 + t, y0: -h, y1: 0.02, z0: PIT.z0 - t, z1: PIT.z0 },
    { x0: PIT.x0 - t, x1: PIT.x1 + t, y0: -h, y1: 0.02, z0: PIT.z1, z1: PIT.z1 + t },
    { x0: PIT.x0 - t, x1: PIT.x0, y0: -h, y1: 0.02, z0: PIT.z0, z1: PIT.z1 },
    { x0: PIT.x1, x1: PIT.x1 + t, y0: -h, y1: 0.02, z0: PIT.z0, z1: PIT.z1 },
  ];
  return mergeColoured(parts.map((p) => boxGeo(p, 0x120e14)));
}

function paint(geo, hex) {
  const c = new Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
}

/** Tiny merge for position/normal/color/index geometries — beats pulling in
 *  BufferGeometryUtils for the twenty boxes this project has. */
function mergeColoured(geos) {
  let vTotal = 0, iTotal = 0;
  for (const g of geos) {
    vTotal += g.attributes.position.count;
    iTotal += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vTotal * 3);
  const nor = new Float32Array(vTotal * 3);
  const col = new Float32Array(vTotal * 3);
  const idx = new Uint32Array(iTotal);

  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const c = g.attributes.color.array;
    pos.set(p, vo * 3);
    nor.set(n, vo * 3);
    col.set(c, vo * 3);
    const count = g.attributes.position.count;
    if (g.index) {
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      io += gi.length;
    } else {
      for (let i = 0; i < count; i++) idx[io + i] = i + vo;
      io += count;
    }
    vo += count;
    g.dispose();
  }

  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('color', new BufferAttribute(col, 3));
  out.setIndex(new BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
