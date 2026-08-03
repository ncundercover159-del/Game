// RERUN — client entry point.

import './style.css';

import { PHASE, ROUND_MS, INPUT_MS, TICK_MS, SAMPLES_PER_GHOST } from '@shared/constants.js';
import { BOXES_DOOR_CLOSED, BOXES_DOOR_OPEN, spawnFor } from '@shared/arena.js';
import { createPlayerState, resetPlayerState, stepPlayer } from '@shared/physics.js';

import { World } from './world.js';
import { Ghosts } from './ghosts.js';
import { Avatars } from './avatars.js';
import { Controls } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
// Swapped at build time: the real WebSocket transport, or the in-page
// loopback used by the single-file solo build.
import { Net, storedSession, clearSession } from '@transport';

const world = new World(document.getElementById('gl'));
const ghosts = new Ghosts(world.scene);
const avatars = new Avatars(world.scene);
const controls = new Controls();
const audio = new Audio();
const ui = new UI();
const net = new Net();

// ----------------------------------------------------------------- state --
const G = {
  screen: 'home',
  room: null,
  phase: PHASE.LOBBY,
  round: 0,
  title: '',
  goal: '',
  required: [],
  playStart: 0,
  phaseEndsAt: 0,
  plateMask: 0,
  doorOpen: false,
  teamScore: 0,
  roundScore: 0,
  serverGhostCount: 0,
  eulogies: [],
  revealed: 0,
  results: null,
  myDead: false,

  // authoritative snapshots for interpolation
  snapA: null,
  snapB: null,

  // local prediction for our own capsule
  me: createPlayerState(0, 8),
  meValid: false,
  serverMe: null,
  serverMeAt: { x: 0, y: 0, z: 0 },
  accumulator: 0,
  lastFrame: performance.now(),
};


// ------------------------------------------------------------- bootstrap --
const params = new URLSearchParams(location.search);
const autoRoom = (params.get('room') || '').toUpperCase().trim();
if (autoRoom) ui.el.codeInput.value = autoRoom;
try {
  const savedName = localStorage.getItem('rerun-name');
  if (savedName) ui.el.nameInput.value = savedName;
} catch { /* ignore */ }

document.getElementById('btn-create').addEventListener('click', () => {
  gesture();
  connectThen(() => net.create(nameValue()));
});
document.getElementById('btn-join').addEventListener('click', () => {
  gesture();
  const code = ui.el.codeInput.value.toUpperCase().trim();
  if (code.length < 4) return ui.error('THAT IS NOT A ROOM CODE');
  connectThen(() => net.join(code, nameValue()));
});
ui.el.btnStart.addEventListener('click', () => { gesture(); net.start(); });
ui.el.btnAgain.addEventListener('click', () => net.again());
ui.el.btnShare.addEventListener('click', share);

function nameValue() {
  const v = (ui.el.nameInput.value || '').trim().toUpperCase().slice(0, 10) ||
    `P${Math.floor(Math.random() * 90 + 10)}`;
  try { localStorage.setItem('rerun-name', v); } catch { /* ignore */ }
  return v;
}

/** AudioContext has to be created inside a user gesture. So does Wake Lock. */
let wakeLock = null;
function gesture() {
  audio.init();
  requestWakeLock();
}

async function requestWakeLock() {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* not fatal */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && G.screen !== 'home') requestWakeLock();
});

function connectThen(fn) {
  ui.error('');
  if (net.open) { fn(); return; }
  net.connect(fn);
}

// Up to 60 ghosts is a ~215KB burst on join. Hold the screen for a beat so it
// reads as loading rather than as a stutter — and always take it down again,
// including when the archive turns out to be empty.
let catchingSince = 0;
function showCatchingUp() {
  catchingSince = performance.now();
  ui.catchingUp();
}
function clearCatchingUp() {
  if (!catchingSince) return;
  const started = catchingSince;
  setTimeout(() => {
    if (catchingSince !== started) return;
    catchingSince = 0;
    ui.centre('');
    lastCountdownShown = 0; // let whatever phase we're in redraw its overlay
    G.revealed = -1;
  }, Math.max(0, 900 - (performance.now() - started)));
}

// Resume a session on refresh — under five seconds, with all ghosts intact.
const saved = storedSession();
if (saved) {
  showCatchingUp();
  net.code = saved.roomCode;
  net.playerId = saved.playerId;
  net.wantReconnect = true;
  net.connect(() => net.join(saved.roomCode, null, saved.playerId));
} else if (autoRoom) {
  // ?room=ABCD auto-joins.
  gesture();
  connectThen(() => net.join(autoRoom, nameValue()));
}

async function share() {
  const url = `${location.origin}${location.pathname}?room=${G.room ? G.room.code : ''}`;
  const text = `RERUN — room ${G.room ? G.room.code : ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'RERUN', text, url }); return; } catch { /* fell through */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    ui.el.btnShare.textContent = 'LINK COPIED';
    setTimeout(() => { ui.el.btnShare.textContent = 'SHARE LINK'; }, 1600);
  } catch {
    ui.el.btnShare.textContent = url;
  }
}

// -------------------------------------------------------------- messages --
net.addEventListener('open', () => ui.netStatus(''));
net.addEventListener('close', () => {
  if (G.screen !== 'home') ui.netStatus('RECONNECTING…');
});

net.addEventListener('error', (e) => {
  const msg = e.detail.message || 'SOMETHING WENT WRONG';
  ui.error(msg);
  ui.centre('');
  if (G.screen === 'home') clearSession();
  if (/NO ROOM/.test(msg)) { clearSession(); ui.showScreen('home'); G.screen = 'home'; }
});

net.addEventListener('joined', (e) => {
  const d = e.detail;
  ui.netStatus('');
  if (!d.resumed) ui.error('');
  if (d.late && !catchingSince) showCatchingUp();
  // Sandboxed embeds can refuse this; the room code is cosmetic in the URL.
  try {
    history.replaceState(null, '', `${location.pathname}?room=${d.code}`);
  } catch { /* not our business */ }
});

net.addEventListener('room', (e) => {
  G.room = e.detail;
  if (G.phase === PHASE.LOBBY) {
    ui.renderLobby(G.room, net.playerId);
    if (G.screen !== 'lobby') { G.screen = 'lobby'; ui.showScreen('lobby'); }
  }
});

net.addEventListener('phase', (e) => onPhase(e.detail));

net.addEventListener('ghosts', (e) => {
  const { isArchive, ghosts: list } = e.detail;
  if (isArchive) {
    ghosts.clear();
    ghosts.add(list, performance.now());
  } else {
    // A fresh batch: they fade in one at a time, oldest first, during the
    // settling beat. Four seconds is exactly long enough for someone to say
    // "oh no".
    ghosts.add(list, performance.now());
    for (const g of list) {
      setTimeout(() => audio.pop(), g.revealDelayMs || 0);
    }
  }
  ui.setGhostCount(ghosts.countFor(net.slot));
});

net.addEventListener('archive_done', () => clearCatchingUp());


net.addEventListener('retire', (e) => {
  ghosts.remove(e.detail.ids || []);
  G.eulogies = e.detail.entries || [];
  ui.setGhostCount(ghosts.countFor(net.slot));
});

net.addEventListener('solved', (e) => {
  audio.beep(true);
  ui.toast(`FULL SET HELD\n+${e.detail.bonus}`, 1600);
});

net.addEventListener('reset', () => {
  ghosts.clear();
  G.results = null;
  G.eulogies = [];
  ui.setGhostCount(0);
  ui.centre('');
});

net.addEventListener('results', (e) => {
  G.results = e.detail;
});

net.addEventListener('s', (e) => onState(e.detail));

function onPhase(d) {
  const wasPhase = G.phase;
  G.phase = d.phase;
  G.round = d.round;
  G.title = d.title;
  G.goal = d.goal;
  G.required = d.required || [];
  G.playStart = d.playStart;
  G.phaseEndsAt = d.phaseEndsAt;
  G.serverGhostCount = d.ghosts;

  if (d.phase === PHASE.LOBBY) {
    G.screen = 'lobby';
    ui.showScreen('lobby');
    if (G.room) ui.renderLobby(G.room, net.playerId);
    ui.centre('');
    return;
  }

  if (d.phase === PHASE.RESULTS) {
    G.screen = 'results';
    ui.showScreen('results');
    ui.centre('');
    if (G.results) ui.renderResults(G.results, G.room && G.room.hostId === net.playerId);
    return;
  }

  if (G.screen !== 'game') {
    G.screen = 'game';
    ui.showScreen('game');
  }

  if (d.phase === PHASE.COUNTDOWN) {
    ui.setRound(d.round, d.title);
    ui.buildPips(G.required);
    world.updatePlates(0, G.required);
    G.myDead = false;
    G.revealed = 0;
    // Reset local prediction to the spawn so the countdown doesn't show you
    // sliding in from last round's grave.
    const sp = spawnFor(net.slot, d.round);
    resetPlayerState(G.me, sp.x, sp.z);
    G.meValid = true;
  }

  if (d.phase === PHASE.PLAY && wasPhase !== PHASE.PLAY) {
    ui.centre('');
    audio.beep(true);
  }

  if (d.phase === PHASE.SETTLING) {
    ui.centre('');
    G.revealed = 0;
  }
}

function onState(s) {
  G.plateMask = s.pl;
  G.doorOpen = !!s.d;
  G.teamScore = s.sc;
  G.roundScore = s.rs;
  G.phase = s.ph;
  G.round = s.r;
  G.playStart = s.ps;
  G.phaseEndsAt = s.pe;
  G.serverGhostCount = s.g;

  G.snapA = G.snapB;
  G.snapB = { t: s.n, players: s.p };

  // Authoritative correction for our own capsule.
  for (const row of s.p) {
    if (row[0] !== net.slot) continue;
    const [, x, y, z, yaw, f] = row;
    const dead = (f & 1) !== 0;
    if (!G.meValid) {
      G.me.x = x; G.me.y = y; G.me.z = z; G.me.yaw = yaw;
      G.meValid = true;
    }
    if (dead && !G.myDead) {
      G.myDead = true;
      audio.scream(0, 1);
      ui.dead();
    }
    if (!dead && G.myDead) { G.myDead = false; ui.centre(''); }
    G.me.dead = dead;
    G.serverMeAt.x = x; G.serverMeAt.y = y; G.serverMeAt.z = z;
    G.serverMe = G.serverMeAt;
  }
}

// -------------------------------------------------------- ghost screams --
ghosts.onScream = (g, s) => {
  const dx = s.x, dz = s.z;
  audio.scream(Math.hypot(dx, dz) * 0.5, g.gen);
};

// --------------------------------------------------------------- helpers --
function ghostClock() {
  if (!G.playStart) return 0;
  let t = (net.now() - G.playStart) % ROUND_MS;
  if (t < 0) t += ROUND_MS;
  return t;
}

function phaseSecondsLeft() {
  if (!G.phaseEndsAt) return 0;
  return Math.max(0, (G.phaseEndsAt - net.now()) / 1000);
}

// ------------------------------------------------------------ main loop --
let lastInput = 0;
let frameTimes = [];
let droppedRatio = false;

function frame(nowPerf) {
  requestAnimationFrame(frame);

  const dtRaw = (nowPerf - G.lastFrame) / 1000;
  G.lastFrame = nowPerf;
  const dt = Math.min(0.1, dtRaw);

  // --- frame pressure watchdog: drop to 1.5x DPR rather than drop frames ---
  frameTimes.push(dtRaw);
  if (frameTimes.length > 90) {
    frameTimes.shift();
    if (!droppedRatio) {
      let slow = 0;
      for (const t of frameTimes) if (t > 1 / 42) slow++;
      if (slow > 55) { world.setPixelRatioCap(1.5); droppedRatio = true; }
    }
  }

  // --- inputs, at 30Hz ---
  if (G.screen === 'game' && nowPerf - lastInput >= INPUT_MS) {
    lastInput = nowPerf;
    net.sendInput(controls.stick, controls.jump);
  }

  // One ghost pass per frame: it fills the collision bodies that local
  // prediction needs *and* writes the instance buffers and decals.
  world.setDoorOpen(G.doorOpen, dt);
  world.updatePlates(G.plateMask, G.required);
  world.beginDecals();
  ghosts.update(ghostClock(), nowPerf, world);

  if (G.screen === 'game' && G.phase === PHASE.PLAY && G.meValid) predict(dt);

  avatars.update(buildRenderPlayers(), world.camera, world);
  world.endDecals();
  world.render();

  updateHud();
}

const predInput = { x: 0, y: 0, jump: false };

function predict(dt) {
  const boxes = G.doorOpen ? BOXES_DOOR_OPEN : BOXES_DOOR_CLOSED;
  const w = { boxes, bodies: ghosts.bodies };
  predInput.x = controls.stick.x;
  predInput.y = controls.stick.y;
  predInput.jump = controls.jump;

  G.accumulator += dt;
  let steps = 0;
  const now = net.now();
  const h = TICK_MS / 1000;
  while (G.accumulator >= h && steps < 6) {
    G.accumulator -= h;
    steps++;
    stepPlayer(G.me, predInput, h, w, now, null);
  }
  if (steps === 6) G.accumulator = 0; // we fell behind; don't spiral

  // Gentle reconciliation. The server is right; it just isn't punctual.
  const sm = G.serverMe;
  if (sm) {
    const ex = sm.x - G.me.x, ey = sm.y - G.me.y, ez = sm.z - G.me.z;
    const err = Math.hypot(ex, ey, ez);
    if (err > 2.2) {
      G.me.x = sm.x; G.me.y = sm.y; G.me.z = sm.z;
    } else if (err > 0.22) {
      const k = 1 - Math.exp(-7 * dt);
      G.me.x += ex * k; G.me.y += ey * k; G.me.z += ez * k;
    }
  }
}

const RENDER_DELAY = 110; // ms behind the server, for smooth remote motion

function buildRenderPlayers() {
  const out = [];
  const names = new Map();
  const late = new Map();
  const conn = new Map();
  if (G.room) {
    for (const p of G.room.players) {
      names.set(p.slot, p.name);
      late.set(p.slot, p.late);
      conn.set(p.slot, p.connected);
    }
  }

  const b = G.snapB;
  const a = G.snapA;
  if (!b) return out;

  const target = net.now() - RENDER_DELAY;
  let alpha = 1;
  if (a && b.t > a.t) alpha = clamp01((target - a.t) / (b.t - a.t));

  const prev = new Map();
  if (a) for (const row of a.players) prev.set(row[0], row);

  for (const row of b.players) {
    const slot = row[0];
    let [, x, y, z, yaw, f] = row;
    const p0 = prev.get(slot);
    if (p0 && a) {
      x = lerp(p0[1], x, alpha);
      y = lerp(p0[2], y, alpha);
      z = lerp(p0[3], z, alpha);
      yaw = lerpAngle(p0[4], yaw, alpha);
    }

    // Our own capsule comes from local prediction so the stick feels attached
    // to it rather than to the network.
    if (slot === net.slot && G.meValid && G.phase === PHASE.PLAY) {
      x = G.me.x; y = G.me.y; z = G.me.z; yaw = G.me.yaw;
    }

    // In the lobby everyone just bobs, waiting to find out what this is.
    if (G.phase === PHASE.LOBBY) {
      y += 0.11 + Math.sin(performance.now() / 460 + slot * 1.4) * 0.11;
      yaw = Math.sin(performance.now() / 1700 + slot) * 0.5;
    }

    out.push({
      slot, x, y, z, yaw,
      dead: (f & 1) !== 0,
      disconnected: (f & 2) !== 0 || conn.get(slot) === false,
      late: (f & 4) !== 0 || late.get(slot) === true,
      name: names.get(slot) || '',
    });
  }
  return out;
}

function updateHud() {
  if (G.screen !== 'game') return;
  ui.updatePips(G.plateMask);
  ui.setScores(G.roundScore, G.teamScore);
  ui.setGhostCount(ghosts.countFor(net.slot));

  const left = phaseSecondsLeft();
  if (G.phase === PHASE.PLAY) {
    ui.setTimer(left, left <= 5);
  } else if (G.phase === PHASE.COUNTDOWN) {
    ui.setTimer(left, false);
    const n = Math.max(1, Math.ceil(left));
    if (n !== lastCountdownShown) {
      lastCountdownShown = n;
      ui.countdown(n, G.title, G.goal);
      audio.beep(n === 1);
    }
  } else if (G.phase === PHASE.SETTLING) {
    ui.setTimer(left, false);
    const total = G.serverGhostCount;
    let shown = 0;
    const t = performance.now();
    for (const g of ghosts.list) if (t >= g.revealAt) shown++;
    // Only re-render when the population actually ticks up — this overlay is
    // otherwise rebuilt sixty times a second for no reason.
    if (shown !== G.revealed) {
      G.revealed = shown;
      ui.settling(total, Math.min(shown, total), G.eulogies);
    }
  }

  if (G.phase !== PHASE.COUNTDOWN) lastCountdownShown = 0;
}
let lastCountdownShown = 0;

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

window.addEventListener('resize', () => world.resize());
window.addEventListener('orientationchange', () => setTimeout(() => world.resize(), 150));

// Never let a stray gesture scroll or zoom the page out from under a match.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

ui.showScreen('home');
requestAnimationFrame(frame);

// Handy in dev: `__rerun.info` prints the draw-call and triangle budget.
window.__rerun = {
  get info() { return { ...world.info, ghosts: ghosts.length }; },
  G, ghosts, world, net, controls, audio, avatars,
  fakeGhosts: (n) => fakeGhosts(n),
};

/**
 * Step 4 of the build order: fake N ghosts with dummy data and check the frame
 * rate on a real phone before any of the networking exists.
 *   __rerun.fakeGhosts(60)
 */
function fakeGhosts(n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const rec = {
      pos: new Int16Array(SAMPLES_PER_GHOST * 3),
      yaw: new Int16Array(SAMPLES_PER_GHOST),
      flags: new Uint8Array(SAMPLES_PER_GHOST),
    };
    const r = 0.6 + Math.random() * 2.0;
    const cx = (Math.random() - 0.5) * 2 * (4.6 - r);
    const cz = (Math.random() - 0.5) * 2 * (8.4 - r);
    const sp = 0.5 + Math.random() * 2;
    for (let s = 0; s < SAMPLES_PER_GHOST; s++) {
      const a = (s / SAMPLES_PER_GHOST) * Math.PI * 2 * sp + i;
      rec.pos[s * 3] = Math.round((cx + Math.cos(a) * r) * 1000);
      rec.pos[s * 3 + 1] = 0;
      rec.pos[s * 3 + 2] = Math.round((cz + Math.sin(a) * r) * 1000);
      rec.yaw[s] = Math.round((-a + Math.PI / 2) * 10000) % 32767;
    }
    list.push({
      id: 900000 + i, slot: i % 8, gen: (i % 6) + 1, round: (i % 6) + 1,
      revealDelayMs: 0, rec,
    });
  }
  ghosts.add(list, performance.now());
  G.playStart = net.now() - 1;
  return ghosts.length;
}
