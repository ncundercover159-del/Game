// THE LUMPS — entry point. Fixed 60Hz simulation, render on the frame.

import './style.css';

import { PHASE, TICK_MS, SAMPLES_PER_GHOST, RECORD_INTERVAL_MS } from './constants.js';
import { Room } from './room.js';
import { Renderer } from './render.js';
import { Controls } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Mascots } from './mascot.js';
import { createRecording, writeSample, buildStride, makeSampleOut, FLAG_GROUNDED } from '@shared/ghostbuf.js';
import { spawnFor, PLATES } from '@shared/arena.js';
import { makeMem } from './creature.js';

const renderer = new Renderer(document.getElementById('gl'));
const controls = new Controls();
const audio = new Audio();
const ui = new UI();
const mascots = new Mascots(document.getElementById('mascot'));

let room = null;
let screen = 'home';
let acc = 0;
let last = performance.now();
let lastCount = 0;
let lastSettleShown = -1;
let wakeLock = null;
let toldAboutTheKnife = false;
let knifeNotice = 0;
let deathNotice = 0;

// Ghost death edges, so a replayed death screams once per loop and not once
// per frame.
const deadEdge = new Map();

// --------------------------------------------------------------- controls --
document.getElementById('begin').addEventListener('click', start);
document.getElementById('again').addEventListener('click', start);

function start() {
  audio.init();
  requestWakeLock();
  room = new Room();
  renderer.reset();
  toldAboutTheKnife = false;
  clearTimeout(knifeNotice);
  clearTimeout(deathNotice);
  deadEdge.clear();
  lastCount = 0;
  lastSettleShown = -1;
  ui.setSelves(0);
  ui.centre('');
  screen = 'game';
  ui.show('game');
  last = performance.now();
  acc = 0;
}

async function requestWakeLock() {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* not fatal */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && screen === 'game') requestWakeLock();
});

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 150));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ------------------------------------------------------------------ loop --
function frame(now) {
  requestAnimationFrame(frame);

  if (screen === 'home') mascots.frame(now);
  if (!room || screen !== 'game') return;

  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  room.input = { x: controls.x, y: controls.y, jump: controls.jump, stab: controls.stab };
  acc += dt;
  let steps = 0;
  while (acc >= TICK_MS / 1000 && steps < 8) {
    acc -= TICK_MS / 1000;
    steps++;
    room.tick(performance.now());
  }
  if (steps === 8) acc = 0;

  handleEvents();
  controls.setArmed(!!room.target);
  checkGhostScreams();
  renderer.draw(room, now, room.ghostClock(performance.now()));
  updateHud(now);
}

function handleEvents() {
  for (const e of room.drain()) {
    if (e.type === 'phase') {
      if (e.detail.phase === PHASE.COUNTDOWN) {
        ui.buildPips(room.required, room.turnstiles);
        lastCount = 0;
      } else if (e.detail.phase === PHASE.PLAY) {
        ui.centre('');
        audio.beep(true);
      } else if (e.detail.phase === PHASE.SETTLING) {
        lastSettleShown = -1;
      } else if (e.detail.phase === PHASE.RESULTS) {
        screen = 'results';
        ui.show('results');
        ui.centre('');
      }
    } else if (e.type === 'ghost') {
      audio.shutter();
    } else if (e.type === 'retire') {
      deadEdge.delete(e.detail.id);
    } else if (e.type === 'stab') {
      const d = e.detail;
      renderer.addSlash(d.fromX, d.fromZ, d.x, d.z);
      renderer.addScar(d.x, d.z);
      audio.stab();
      audio.scream(d.gen, 1);
      if (!toldAboutTheKnife) {
        toldAboutTheKnife = true;
        ui.murdered(d.gen);
        clearTimeout(knifeNotice);
        knifeNotice = setTimeout(() => ui.centre(''), 3000);
      }
    } else if (e.type === 'death') {
      audio.scream(1, 1);
      renderer.addScar(e.detail.x, e.detail.z);
      ui.dead();
      clearTimeout(deathNotice);
      deathNotice = setTimeout(() => ui.centre(''), 2400);
    } else if (e.type === 'solved') {
      audio.beep(true);
    } else if (e.type === 'door') {
      audio.plate();
    } else if (e.type === 'results') {
      ui.results(e.detail);
    }
  }
}

/** The death loop: every twenty seconds, forever, with the same scream. */
function checkGhostScreams() {
  for (const g of room.ghosts) {
    if (!g.hasDeath) continue;
    const s = g.cur;
    const prev = deadEdge.get(g.id);
    if (prev === undefined) { deadEdge.set(g.id, s.dead ? 1 : 0); g._li = s.index; continue; }
    // A wrap resets the edge, so the death fires again on the next pass.
    const wrapped = s.index < (g._li || 0);
    g._li = s.index;
    if (wrapped) { deadEdge.set(g.id, 0); continue; }
    if (s.dead && !prev) {
      audio.scream(g.gen, 1);
      // The scream repeats forever; the stain is stamped once. Re-inking the
      // same spot every twenty seconds turns the floor solid inside a minute.
      if (!g._scarred) { g._scarred = true; renderer.addScar(s.x, s.z); }
    }
    deadEdge.set(g.id, s.dead ? 1 : 0);
  }
}

function updateHud(now) {
  ui.setSelves(room.ghosts.length);
  ui.setRound(room.round, room.spec.title);
  ui.updatePips(room.pressedMask());
  ui.setScore(room.roundScore, room.score);

  const left = room.phaseEndsAt ? Math.max(0, (room.phaseEndsAt - performance.now()) / 1000) : 0;

  if (room.phase === PHASE.PLAY) {
    ui.setTimer(left, left <= 5);
  } else if (room.phase === PHASE.COUNTDOWN) {
    ui.setTimer(left, false);
    const n = Math.max(1, Math.ceil(left));
    if (n !== lastCount) {
      lastCount = n;
      ui.countdown(n, room.spec.title, room.spec.goal);
      audio.beep(n === 1);
    }
  } else if (room.phase === PHASE.SETTLING) {
    ui.setTimer(left, false);
    let shown = 0;
    for (const g of room.ghosts) if (now >= g.revealAt) shown++;
    if (shown !== lastSettleShown) {
      lastSettleShown = shown;
      ui.settling(room.ghosts.length, shown, room.eulogies);
    }
  }
}

ui.show('home');
requestAnimationFrame(frame);

// Handy while building: __lumps.stage(20) fills the tank with one specimen per
// generation instead of waiting seven minutes for them.
window.__lumps = {
  get room() { return room; },
  renderer,
  controls,
  ui,
  start,
  PLATES,
  stage(n) {
    if (!room) start();
    for (let g = 1; g <= n; g++) room.ghosts.push(fakeGhost(g));
    room.round = Math.min(20, n + 1);
    room.required = room.required.length ? room.required : [0];
    for (const gh of room.ghosts) gh.revealAt = 0;
    return room.ghosts.length;
  },
  stats: () => (room ? {
    ghosts: room.ghosts.length,
    round: room.round,
    phase: room.phase,
    score: Math.round(room.score),
    murders: room.murders,
  } : null),
};

/** A plausible-looking tape: scuttle from a spawn to a plate and back. */
function fakeGhost(gen) {
  const rec = createRecording();
  const from = spawnFor(0, gen);
  const to = PLATES[(gen * 5) % PLATES.length];
  for (let i = 0; i < SAMPLES_PER_GHOST; i++) {
    const u = i / (SAMPLES_PER_GHOST - 1);
    const k = u < 0.5 ? u * 2 : (1 - u) * 2;
    const x = from.x + (to.x - from.x) * k;
    const z = from.z + (to.z - from.z) * k;
    const y = to.y * (k > 0.9 ? 1 : 0);
    writeSample(rec, i, x, y, z, Math.atan2(to.x - from.x, to.z - from.z), FLAG_GROUNDED);
  }
  return {
    id: 9000 + gen,
    gen,
    round: gen,
    rec,
    stride: buildStride(rec),
    hasDeath: false,
    plateSeconds: 0,
    collisions: 0,
    lastHitAt: 0,
    loops: 0,
    revealAt: 0,
    stabbedAt: -1,
    cur: makeSampleOut(),
    mem: makeMem(gen * 2.39),
  };
}

void RECORD_INTERVAL_MS;
