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
import { installPost } from './art/post.js';
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
let post = null;

// --- boot --------------------------------------------------------------------
async function boot(levelId = DEFAULT_LEVEL) {
  await initPhysics();

  room = await Room.create('LOCAL', levelId);
  const level = LEVEL_BY_ID[levelId];
  renderer.toneMappingExposure = level.env?.exposure ?? 1.0;

  mySlot = room.join({ send() {} }, 'YOU');

  view = new WorldView(level, renderer);
  controls = new Controls(canvas);
  controls.yaw = level.spawnYaw ?? Math.PI;
  hud = new HUD(level);
  // The art pass owns what this returns; a passthrough is always valid.
  post = installPost(renderer, view.scene, camera);

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
    // The post chain, so a harness can grade what the player actually sees.
    // Without it a probe reads the raw scene and concludes that grounding
    // failed when the AO doing the grounding lives in the chain.
    get post() { return post; },
    stats: () => ({
      phase: room.phase,
      banked: room.banked,
      breakages: room.breakages,
      props: room.world.props.size,
      draws: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      fps: Math.round(fps),
    }),
    /** Push the job clock forward, so a harness can see the water risen. */
    clockTo(seconds) {
      room.startedAt = performance.now() - seconds * 1000;
      room.phaseEndsAt = performance.now() + 1e9;
    },
    /**
     * Drop the camera somewhere for a screenshot.
     *
     * Stands the contractor back up first. Ragdolling destroys the capsule and
     * nulls `body`, so a harness that walks around before it starts taking
     * measurements will eventually trip over something, fall, and then crash on
     * the next `look()` with "cannot read properties of null" — a full run
     * thrown away for a reason that has nothing to do with what it was testing.
     */
    look(x, y, z, yaw, pitch) {
      const me = room.actors.get(mySlot);
      if (!me) return;
      if (me.ragdoll) { me.downed = false; me.exitRagdoll(); }
      me.health = Math.max(me.health, 60);
      me.pos.x = x; me.pos.y = y; me.pos.z = z;
      me.vel.x = 0; me.vel.y = 0; me.vel.z = 0;
      me.body?.setNextKinematicTranslation({ x, y: y + me.height / 2, z });
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
    if (snap) {
      view.ingest(snap, now);
      // Water arrives on the wire like everything else, so the local game and
      // the networked one are looking at the same number and a quantisation bug
      // in it shows up here rather than only under multiplayer.
      view.setWater(snap.water, snap.zoneWater);
    }
  }

  view.sample(now, dt);

  // --- camera ---------------------------------------------------------------
  //
  // The +PI is not a fudge and removing it breaks the game in a way that is
  // very hard to see and impossible to play around.
  //
  // A Three camera looks down its own -Z, so rotateY(yaw) points it at
  // (-sin yaw, -cos yaw). Every other thing in this project that has a facing —
  // the server's grab and valve rays via lookDir(), the figures via
  // root.rotation.y, and every level's spawnYaw — uses (+sin yaw, +cos yaw).
  // Those are opposite. Without the correction the camera looks due south while
  // the contractor behind it reaches due north: you grab whatever is BEHIND
  // you, valves cannot be turned by looking at them, and the warehouse spawn
  // faces the dock wall instead of the job.
  //
  // Nothing caught it for a long time, because the headless tests set yaw
  // directly and never involve a camera, and the screenshot harness picked its
  // angles by eye and so silently learned the wrong convention. The regression
  // test is in client/src/aimtest.js: it asserts the two vectors agree.
  if (me) {
    // The local contractor is simulated in this tab, so the camera reads the
    // authoritative position directly. No prediction, no reconciliation, no
    // rubber-banding — that machinery only earns its keep against a real server.
    const eyeH = me.crouched ? CROUCH_EYE : EYE_HEIGHT;
    camera.position.set(me.pos.x, me.pos.y + eyeH, me.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(controls.yaw + Math.PI);
    camera.rotateX(controls.pitch);
    // Hide your own body: you are inside it.
    const mine = view.figures.get(mySlot);
    if (mine) { mine.root.visible = false; mine.rig.visible = !!mine.ragdoll; }

    // Under water, and by how much. The wash is driven off the eye rather than
    // the feet, because wading through a flooded tank should not black out the
    // screen — only going under should.
    const eye = camera.position;
    hud.setSubmerged(view.submerged(eye.x, eye.y, eye.z)
      ? Math.min(1, (view.water.y - eye.y) / 1.5) : 0);

    hud.setPrompt(me.turning ? `HOLD G · ${valveLabel(me.turning)}` : '', me.turnProgress || 0);
  }

  drainEvents();
  hud.update(room, me, fps, renderer.info.render.calls);
  post.render(dt);
}

function valveLabel(id) {
  const v = (room.level.sequence?.valves || []).find((x) => x.id === id);
  return v ? v.label : id;
}

function drainEvents() {
  for (const e of room.drainEvents()) {
    if (e.type === 'break') hud.flash(`${PROP_BY_ID[e.detail.kind]?.name || 'SOMETHING'} DESTROYED`, 'bad');
    else if (e.type === 'extract') hud.flash(`+£${e.detail.value}`, 'good');
    else if (e.type === 'sunk') hud.flash(`${PROP_BY_ID[e.detail.kind]?.name || 'SOMETHING'} LOST · -£${e.detail.value}`, 'bad');
    else if (e.type === 'valve') hud.flash(`${e.detail.label} SHUT · ${e.detail.shut}/${e.detail.total}`, 'good');
    // The penalty is the point of the whole sequence, so it gets its own line
    // rather than being folded into the valve message it arrives with.
    else if (e.type === 'penalty') hud.flash(`OUT OF ORDER · ${e.detail.valve} STILL OPEN`, 'bad');
    else if (e.type === 'phase' && e.detail.phase === PHASE.ACTIVE) hud.flash('CLOCK RUNNING', 'note');
    else if (e.type === 'phase' && e.detail.phase === PHASE.DEBRIEF) hud.results(room.results(e.detail.reason));
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (post) post.setSize(w, h);
}
window.addEventListener('resize', resize);

document.getElementById('btn-join').addEventListener('click', () => {
  boot().catch((err) => {
    document.getElementById('screen-error').textContent = `FAILED: ${err.message}`;
    console.error(err);
  });
});

// Autostart when the harness asks, so a screenshot run needs no click.
// ?level= picks the job, because a harness that can only ever see the warehouse
// cannot tell you whether the other two render at all.
{
  const q = new URLSearchParams(location.search);
  if (q.has('auto')) {
    const want = q.get('level');
    boot(LEVEL_BY_ID[want] ? want : DEFAULT_LEVEL).catch((err) => console.error(err));
  }
}

requestAnimationFrame(frame);
void BUTTON;
