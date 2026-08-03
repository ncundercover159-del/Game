// RERUN 2D — entry point. Fixed 60Hz simulation, render on the frame.

import './style.css';

import { PHASE, TICK_MS, TOTAL_ROUNDS, SETTLING_SECONDS } from './constants.js';
import { Room } from './room.js';
import { Renderer } from './render.js';
import { Controls } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { sampleAt } from './ghostbuf.js';
import { PLATES } from './arena.js';

const renderer = new Renderer(document.getElementById('gl'));
const controls = new Controls();
const audio = new Audio();
const ui = new UI();

let room = null;
let screen = 'home';
let acc = 0;
let last = performance.now();
let lastCount = 0;
let lastSettleShown = -1;
let wakeLock = null;
let results = null;
let toldAboutTheKnife = false;
let knifeNotice = 0;
let deathNotice = 0;

// Ghost death edges, so a replayed fall screams once per loop and not once
// per frame.
const deadEdge = new Map();

// --------------------------------------------------------------- controls --
document.getElementById('begin').addEventListener('click', start);
document.getElementById('again').addEventListener('click', start);

function start() {
  audio.init();
  requestWakeLock();
  room = new Room('YOU');
  results = null;
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

  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (room) {
    room.input = { x: controls.x, jump: controls.jump, stab: controls.stab };
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

    const clock = room.ghostClock(performance.now());
    checkGhostScreams(clock);
    renderer.draw(room, now, clock);
    updateHud(now);
  }
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
      renderer.addSlash(d.fromX, d.fromY, d.x, d.y);
      renderer.addScar(d.x, d.y);
      audio.stab();
      audio.scream(d.gen, 1);
      if (!toldAboutTheKnife) {
        toldAboutTheKnife = true;
        ui.murdered(d.gen);
        clearTimeout(knifeNotice);
        knifeNotice = setTimeout(() => ui.centre(''), 2600);
      }
    } else if (e.type === 'death') {
      audio.scream(1, 1);
      renderer.addScar(e.detail.x, e.detail.y);
      ui.dead();
      clearTimeout(deathNotice);
      deathNotice = setTimeout(() => ui.centre(''), 2400);
    } else if (e.type === 'solved') {
      audio.beep(true);
    } else if (e.type === 'door') {
      audio.plate();
    } else if (e.type === 'results') {
      results = e.detail;
      ui.results(results);
    }
  }
}

const probe = { x: 0, y: 0, dead: false, grounded: true, facing: 1, vx: 0, vy: 0, dist: 0, index: 0 };

/** The death loop: every twenty seconds, forever, with the same scream. */
function checkGhostScreams(clock) {
  for (const g of room.ghosts) {
    if (!g.hasDeath) continue;
    const s = sampleAt(g.rec, clock, probe);
    const prev = deadEdge.get(g.id);
    if (prev === undefined) { deadEdge.set(g.id, s.dead ? 1 : 0); continue; }
    // A wrap resets the edge, so the fall fires again on the next pass.
    const wrapped = s.index < (g._li || 0);
    g._li = s.index;
    if (wrapped) { deadEdge.set(g.id, 0); continue; }
    if (s.dead && !prev) {
      audio.scream(g.gen, 1);
      renderer.addScar(s.x, s.y);
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

// Handy while building: __r2.stage(20) fills the tower with one ghost per
// generation without waiting seven minutes for them.
window.__r2 = {
  get room() { return room; },
  renderer,
  controls,
  start,
  PLATES,
  stats: () => ({
    ghosts: room ? room.ghosts.length : 0,
    round: room ? room.round : 0,
    score: room ? Math.round(room.score) : 0,
  }),
};

void TOTAL_ROUNDS; void SETTLING_SECONDS;
