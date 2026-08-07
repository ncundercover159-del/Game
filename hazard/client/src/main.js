// HAZARD PAY — the client.
//
// Two ways to run, one renderer:
//
//   * LOCAL   — a real Room stepped in this tab. Same server code, same physics,
//               same wire format; the snapshot goes through encode and decode
//               before anything is drawn, so the local game exercises the exact
//               path the networked one does. This is what makes single-player
//               and the offline build possible without a second codebase.
//   * REMOTE  — net.js against the ws server, when one is running.
//
// Because both ends speak the same bytes, a bug in the codec shows up locally
// rather than only under multiplayer, which is where it would be hardest to see.

import './style.css';
import * as THREE from 'three';

import { Room } from '../../server/room.js';
import { initPhysics } from '../../server/world.js';
import { decodeSnapshot } from './net.js';
import { WorldView } from './worldview.js';
import { Controls } from './input.js';
import { HUD } from './hud.js';
import { LEVEL_BY_ID, DEFAULT_LEVEL } from '../../shared/levels/index.js';
import { PROP_BY_ID } from '../../shared/props.js';
import {
  TICK_MS, SNAPSHOT_MS, PHASE, EYE_HEIGHT, CROUCH_EYE, BUTTON,
} from '../../shared/tune.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// ACES gives dark interiors a filmic roll-off instead of clipping every lamp to
// white, which is most of the difference between "3D scene" and "game".
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const camera = new THREE.PerspectiveCamera(78, 1, 0.06, 220);

let room = null;
let view = null;
let controls = null;
let hud = null;
let mySlot = -1;
let running = false;

// --- boot --------------------------------------------------------------------
async function boot(levelId = DEFAULT_LEVEL) {
  await initPhysics();

  room = await Room.create('LOCAL', levelId);
  const level = LEVEL_BY_ID[levelId];
  renderer.toneMappingExposure = level.env?.exposure ?? 1.0;

  mySlot = room.join({ send() {} }, 'YOU');

  view = new WorldView(level);
  controls = new Controls(canvas);
  controls.yaw = level.spawnYaw ?? Math.PI;
  hud = new HUD(level);

  room.begin(performance.now());
  resize();
  running = true;

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('screen').classList.add('hidden');

  // Handy from the console, and what the screenshot harness drives.
  window.__hz = {
    get room() { return room; },
    get view() { return view; },
    renderer, camera, controls,
    stats: () => ({
      phase: room.phase,
      banked: room.banked,
      breakages: room.breakages,
      props: room.world.props.size,
      draws: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      fps: Math.round(fps),
    }),
    /** Drop the camera somewhere for a screenshot. */
    look(x, y, z, yaw, pitch) {
      const me = room.actors.get(mySlot);
      me.pos.x = x; me.pos.y = y; me.pos.z = z;
      me.body.setNextKinematicTranslation({ x, y: y + me.height / 2, z });
      controls.yaw = yaw; controls.pitch = pitch ?? 0;
    },
  };
}

// --- the loop ----------------------------------------------------------------
let last = performance.now();
let acc = 0;
let snapAcc = 0;
let fps = 60;

function frame(now) {
  requestAnimationFrame(frame);
  if (!running) return;

  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += ((1 / Math.max(1e-4, dt)) - fps) * 0.08;

  // --- feed the simulation -------------------------------------------------
  const input = controls.sample();
  const me = room.actors.get(mySlot);
  if (me) me.pendingInput = { seq: 0, ...input };

  acc += dt * 1000;
  let steps = 0;
  while (acc >= TICK_MS && steps < 6) {
    acc -= TICK_MS;
    steps++;
    room.step(performance.now());
  }
  if (steps === 6) acc = 0;

  // --- ship a snapshot through the real codec ------------------------------
  snapAcc += dt * 1000;
  if (snapAcc >= SNAPSHOT_MS) {
    snapAcc %= SNAPSHOT_MS;
    const snap = decodeSnapshot(room.snapshot(performance.now()));
    if (snap) view.ingest(snap, now);
  }

  view.sample(now, dt);

  // --- camera ---------------------------------------------------------------
  if (me) {
    // The local contractor is simulated in this tab, so the camera reads the
    // authoritative position directly. No prediction, no reconciliation, no
    // rubber-banding — that machinery only earns its keep against a real server.
    const eyeH = me.crouched ? CROUCH_EYE : EYE_HEIGHT;
    camera.position.set(me.pos.x, me.pos.y + eyeH, me.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(controls.yaw);
    camera.rotateX(controls.pitch);
    // Hide your own body: you are inside it.
    const mine = view.figures.get(mySlot);
    if (mine) { mine.root.visible = false; mine.rig.visible = !!mine.ragdoll; }
  }

  drainEvents();
  hud.update(room, me, fps, renderer.info.render.calls);
  renderer.render(view.scene, camera);
}

function drainEvents() {
  for (const e of room.drainEvents()) {
    if (e.type === 'break') hud.flash(`${PROP_BY_ID[e.detail.kind]?.name || 'SOMETHING'} DESTROYED`, 'bad');
    else if (e.type === 'extract') hud.flash(`+£${e.detail.value}`, 'good');
    else if (e.type === 'phase' && e.detail.phase === PHASE.ACTIVE) hud.flash('CLOCK RUNNING', 'note');
    else if (e.type === 'phase' && e.detail.phase === PHASE.DEBRIEF) hud.results(room.results(e.detail.reason));
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

document.getElementById('btn-join').addEventListener('click', () => {
  boot().catch((err) => {
    document.getElementById('screen-error').textContent = `FAILED: ${err.message}`;
    console.error(err);
  });
});

// Autostart when the harness asks, so a screenshot run needs no click.
if (new URLSearchParams(location.search).has('auto')) {
  boot().catch((err) => console.error(err));
}

requestAnimationFrame(frame);
void BUTTON;
