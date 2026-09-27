// SQUISHY client entry: renderer + render loop, screen flow, and the glue
// between net snapshots, prediction, puzzles, trivia, audio and HUD.

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildPuzzles } from './puzzles.js';
import { Squishy, COLORS } from './squishy.js';
import { Net } from './net.js';
import { createControls } from './joystick.js';
import { createTrivia } from './trivia.js';
import { createAudio } from './audio.js';
import { smooth, clamp01 } from './util.js';
import { DT, EV } from '../shared/physics.js';
import { ZONES, zoneIndexAt, GATES, TRIVIA_GATES, TERRACE, POND, FIREFLIES, BELL } from '../shared/level.js';

const $ = (id) => document.getElementById(id);

// ---- renderer / scene ----------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.domElement.id = 'scene';
document.body.prepend(renderer.domElement);
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 150); // fog hides everything beyond
const world = buildWorld(scene, renderer);
const puzzles = buildPuzzles(scene, world.materials);
const squishies = [new Squishy(scene, 0), new Squishy(scene, 1)];
squishies.forEach((s) => s.setVisible(false));
const audio = createAudio();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- state --------------------------------------------------------------------------------------
const S = {
  mode: 'lobby',       // lobby | waiting | play
  you: 0,
  code: null,
  meta: null,          // latest game meta
  paused: null,
  connected: false,
  run: 0,
  zoneSeen: new Set(),
  finaleShown: false,
  momentsTotal: 0,
  lastTm: 0,
  hint: '',
  hintT: 0,
};
const other = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, g: 1, sqd: 0, act: 0, sq: 0 };

// ---- UI -------------------------------------------------------------------------------------------
const ui = {
  lobby: $('lobby'), waiting: $('waiting'), hud: $('hud'), trivia: $('trivia'), overlay: $('overlay'),
  finale: $('finale'), fade: $('fade'), lobbyErr: $('lobbyErr'), codeInput: $('codeInput'),
};
const show = (el, on) => el.classList.toggle('hidden', !on);

const params = new URLSearchParams(location.search);
if (params.get('room')) ui.codeInput.value = params.get('room').toUpperCase().slice(0, 4);

ui.codeInput.addEventListener('input', () => {
  ui.codeInput.value = ui.codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  ui.lobbyErr.textContent = '';
});
ui.codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

$('createBtn').addEventListener('click', () => {
  audio.init(); audio.play('tap');
  ui.lobbyErr.textContent = '';
  net.create();
});
$('joinBtn').addEventListener('click', () => {
  audio.init(); audio.play('tap');
  const code = ui.codeInput.value.trim();
  if (code.length !== 4) { ui.lobbyErr.textContent = 'Room codes are 4 letters.'; return; }
  net.join(code);
});
$('cancelBtn').addEventListener('click', () => { net.leave(); toLobby(); });
$('shareBtn').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?room=${S.code}`;
  const text = `Come explore a little forest shrine with me in SQUISHY! Room code: ${S.code}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'SQUISHY', text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    $('shareBtn').textContent = 'Copied!';
    setTimeout(() => { $('shareBtn').textContent = 'Share code'; }, 1600);
  } catch { /* share sheet dismissed */ }
});
$('chipClose').addEventListener('click', () => show($('codeChip'), false));
$('audioBtn').addEventListener('click', () => { audio.init(); $('audioBtn').textContent = audio.toggleMute() ? '♪̸' : '♪'; });

function toLobby(err = '') {
  S.mode = 'lobby';
  S.meta = null;
  show(ui.lobby, true); show(ui.waiting, false); show(ui.hud, false); show(ui.overlay, false);
  show(ui.finale, false); show($('audioBtn'), false);
  ui.fade.classList.remove('show');
  trivia.render(null, S.you);
  document.body.classList.remove('modal-open');
  squishies.forEach((s) => s.setVisible(false));
  ui.lobbyErr.textContent = err;
}

function overlay(html) {
  if (!html) { show(ui.overlay, false); ui.overlay.innerHTML = ''; return; }
  ui.overlay.innerHTML = `<div class="card">${html}</div>`;
  show(ui.overlay, true);
}
ui.overlay.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  if (b.dataset.act === 'lobby') { net.forget(); toLobby(); }
});

const trivia = createTrivia(ui.trivia, {
  onPick: (i) => net.send({ t: 'pick', i }),
  onContinue: () => net.send({ t: 'cont' }),
  sfx: (n) => audio.play(n),
});

const controls = createControls({
  hud: ui.hud, stick: $('stick'), knob: document.querySelector('#stick .knob'), zone: $('touchZone'),
  button: $('actionBtn'), keysHelp: $('keysHelp'), onFirstInput: () => audio.init(),
});

// ---- networking -------------------------------------------------------------------------------------
const net = new Net({
  onConnection(ok) {
    S.connected = ok;
    if (S.mode === 'play') {
      if (!ok) overlay('<h2>Reconnecting…</h2><p>Hold on — finding the path back to the shrine.</p><div class="dots"><span></span><span></span><span></span></div>');
      else if (!S.paused) overlay(null);
    }
  },
  onJoined(msg) {
    S.you = msg.you;
    S.code = msg.code;
    net.pred.ready = false;
    $('chipCode').textContent = msg.code;
    $('meDot').style.background = COLORS[S.you].body;
    $('actionBtn').classList.toggle('me1', S.you === 1);
  },
  onMeta(msg) {
    S.you = msg.you;
    S.code = msg.code;
    if (msg.phase === 'waiting') {
      S.mode = 'waiting';
      $('bigCode').textContent = msg.code;
      show(ui.lobby, false); show(ui.waiting, true); show(ui.hud, false);
      return;
    }
    if (msg.phase !== 'play' || !msg.game) return;
    const g = msg.game;
    if (S.mode !== 'play') enterPlay();
    if (g.run !== S.run) newRun(g);
    S.meta = g;
    S.paused = msg.paused;
    if (msg.paused && msg.paused.slot !== S.you) {
      overlay(`<h2>Your partner wandered off…</h2><p>Their connection dropped. Waiting for them to come back — <b>${msg.paused.left}s</b></p><div class="dots"><span></span><span></span><span></span></div>`);
    } else if (S.connected) overlay(null);
    trivia.render(g.trivia, S.you);
    document.body.classList.toggle('modal-open', !!g.trivia || !!g.finale);
    const total = g.moments.fireflies + g.moments.stones + g.moments.harmony;
    if (total !== S.momentsTotal) {
      $('momentsN').textContent = total;
      if (total > S.momentsTotal) { $('moments').classList.remove('pop'); void $('moments').offsetWidth; $('moments').classList.add('pop'); }
      S.momentsTotal = total;
    }
    if (g.finale && !S.finaleShown) showFinale(g.finale, true);
  },
  onSnapshot(s) {
    if (S.mode !== 'play') return;
    const me = s.players[S.you];
    const them = s.players[1 - S.you];
    net.pred.reconcile(me, net.col, them);
    // partner's physics events drive their animation & sounds
    if (them.ev) {
      squishies[1 - S.you].event(them.ev, them);
      if (them.ev & EV.SQUISH) audio.play('squish');
      if (them.ev & EV.SPRING) { audio.play('spring'); squishies[S.you].pressed(); }
      if (them.ev & EV.SPLASH) audio.play('splash');
      if (them.ev & EV.LAND) audio.play('land', them.land);
    }
    for (const e of s.ev || []) serverEvent(e);
    // timer ticks for the last seconds
    if (s.tm > 0 && Math.ceil(s.tm) !== Math.ceil(S.lastTm) && s.tm < 6) audio.play('tick');
    S.lastTm = s.tm;
  },
  onError(msg) { if (S.mode !== 'play') toLobby(msg); },
  onGone() { if (S.mode !== 'lobby') toLobby('That room has closed.'); },
  onEnded(reason) {
    if (S.mode === 'lobby') return;
    const txt = reason === 'left' ? 'Your partner has left the shrine.' : reason === 'timeout' ? 'Your partner didn’t make it back in time.' : 'This room has closed.';
    show(ui.trivia, false);
    overlay(`<h2>Until next time</h2><p>${txt}</p><button class="btn" data-act="lobby">Back to start</button>`);
    S.mode = 'ended';
  },
});

function enterPlay() {
  S.mode = 'play';
  show(ui.lobby, false); show(ui.waiting, false); show(ui.hud, true); show($('codeChip'), true); show($('audioBtn'), true);
  squishies.forEach((s) => s.setVisible(true));
  controls.reset();
}

function newRun(g) {
  S.run = g.run;
  S.zoneSeen.clear();
  S.finaleShown = false;
  S.momentsTotal = -1;
  S.dusk = 0;
  show(ui.finale, false);
  ui.fade.classList.remove('show');
  puzzles.reset();
  net.pred.ready = false;
  net.resetClock();
  world.setSeason(g.season);
  world.setDusk(0);
  camInit = false;
}

function serverEvent(e) {
  switch (e.k) {
    case 'plate': audio.play('plate'); break;
    case 'solve':
      audio.play(TRIVIA_GATES.includes(e.id) ? 'chime' : 'solve');
      if (navigator.vibrate) navigator.vibrate(30);
      break;
    case 'timer': audio.play('solve'); break;
    case 'stones': audio.play('stones'); puzzles.stonesRipple(); break;
    case 'firefly': puzzles.catchFirefly(e.i); audio.play('firefly'); break;
    case 'trivia': audio.play('trivia'); controls.reset(); break;
    case 'correct': audio.play('chime'); break;
    case 'retry': audio.play('retry'); break;
    case 'gentle': audio.play('gentle'); break;
    case 'bellsolo': audio.play('bellsolo'); puzzles.ringBell(0.35); break;
    case 'bell':
      audio.play('bell'); puzzles.ringBell(1.4);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      break;
  }
}

function showFinale(info, immediate = false) {
  S.finaleShown = true;
  const draw = () => {
    ui.fade.classList.add('show');
    setTimeout(() => {
      if (!S.meta || !S.meta.finale) return;
      const m = info.moments;
      const mm = Math.floor(info.dur / 60), ss = String(info.dur % 60).padStart(2, '0');
      ui.finale.innerHTML = `<div class="card">
        <div class="thanks-jp">ありがとう</div>
        <div class="thanks">Thanks for playing</div>
        <div class="pair"><span class="av p0" style="display:inline-block;width:44px;height:36px"></span> <span class="av p1" style="display:inline-block;width:44px;height:36px"></span></div>
        <div class="stats">
          <div class="stat"><b>${mm}:${ss}</b><span>together</span></div>
          <div class="stat"><b>${m.fireflies}/${FIREFLIES.length}</b><span>fireflies</span></div>
          <div class="stat"><b>${m.harmony}/3</b><span>in harmony</span></div>
          <div class="stat"><b>${m.stones}/2</b><span>crossed the pond</span></div>
        </div>
        <button class="btn" id="againBtn">Play Again</button>
        <button class="btn ghost" id="leaveBtn">Leave</button>
      </div>`;
      show(ui.finale, true);
      $('againBtn').onclick = () => { audio.play('tap'); net.send({ t: 'again' }); $('againBtn').disabled = true; $('againBtn').textContent = 'Heading back to the forest…'; };
      $('leaveBtn').onclick = () => { net.leave(); toLobby(); };
    }, immediate ? 600 : 3800);
  };
  if (immediate) draw(); else setTimeout(draw, 2400);
}

// ---- hints & zone titles ------------------------------------------------------------------------------
function computeHint(me, meta, snap) {
  if (!meta || meta.trivia || meta.finale) return '';
  const f = meta.flags;
  const z = me.z, y = me.y;
  const tm = snap ? snap.tm : 0, sh = snap ? snap.sh : 0, stones = snap ? snap.w[6] : 0;
  for (let i = 0; i < 3; i++) {
    const g = GATES[TRIVIA_GATES[i]];
    if (f.trivia[i] || (i === 2 && !f.court)) continue;
    const near = (p) => p.z > g.z - 5.5 && p.z < g.z - 0.2 && Math.abs(p.y - g.y) < 1;
    if (near(me) && !near(other)) return 'The gate has a question for you both — wait here for your partner.';
  }
  if (!f.forest && z > 16 && z < 34) return 'Two mossy switch-stones… squish on both at the same time to open the gate. (Hold ● to squish.)';
  if (!f.timerLatched && z > 46 && z < 64.4) {
    if (tm > 0) return 'The gate is open — hold ● to squeeze under the fallen bamboo, and get through together!';
    return 'Squish the leaf-stone to open the far gate — then squeeze under the fallen bamboo together.';
  }
  if (z > 84 && z < POND.z0 + 0.5) {
    if (stones < 0.5 && sh <= 0) return 'Stand together inside the stone ring to call the stepping stones.';
    if (sh > 0 && sh < 9) return 'Across the stones, before they sink!';
  }
  if (z > POND.z1 && z < 124 && other.z < POND.z0 && sh <= 0) return 'Squish the switch-stone here to raise the stones for your partner.';
  if (!f.stairs && z > 126 && z < TERRACE.z0 + 0.1 && y < 1) return 'Too high to climb! One of you holds ● by the wall — the other bounces on top.';
  if (!f.stairs && y > TERRACE.h - 0.2 && z < 147) return 'You made it up! Squish the switch-stone here to raise the steps.';
  if (!f.court && z > 164 && z < 182) return 'Light the lanterns: squish on both lantern-stones together.';
  if (f.trivia[2] && z > 183) {
    const dx = me.x - BELL.x, dz = me.z - BELL.z;
    return dx * dx + dz * dz < BELL.r * BELL.r ? 'Squish together, at the same moment, to ring the bell.' : 'Stand by the bell together…';
  }
  if (f.court && z > 164 && meta.ff !== (1 << FIREFLIES.length) - 1 && meta.moments.fireflies < 3) return 'Fireflies! Some float high — a bounce off your partner might help.';
  return '';
}

function updateHint(dt, me) {
  S.hintT -= dt;
  if (S.hintT > 0) return;
  S.hintT = 0.35;
  const h = computeHint(me, S.meta, net.latest);
  const el = $('hint');
  if (h !== S.hint) {
    S.hint = h;
    if (h) { el.textContent = h; el.classList.add('show'); } else el.classList.remove('show');
  }
}

let zoneTimer = 0;
function updateZone(dt, me) {
  const zi = zoneIndexAt(me.z);
  if (!S.zoneSeen.has(zi)) {
    S.zoneSeen.add(zi);
    const t = $('zoneToast');
    t.querySelector('.jp').textContent = ZONES[zi].jp;
    t.querySelector('.en').textContent = ZONES[zi].en;
    t.classList.add('show');
    zoneTimer = 3.6;
  }
  if (zoneTimer > 0) { zoneTimer -= dt; if (zoneTimer <= 0) $('zoneToast').classList.remove('show'); }
}

function zoneWeights(z) {
  return ZONES.map((zn) => {
    const inside = smooth(zn.z0 - 6, zn.z0 + 4, z) * (1 - smooth(zn.z1 - 4, zn.z1 + 6, z));
    return inside;
  });
}

// ---- camera -----------------------------------------------------------------------------------------------
let camInit = false;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const want = new THREE.Vector3(), wantLook = new THREE.Vector3();
function updateCamera(dt, t, focus) {
  if (S.mode !== 'play') {
    const a = Math.sin(t * 0.07) * 0.5;
    want.set(Math.sin(a) * 10, 4.2 + Math.sin(t * 0.13) * 0.6, 12 - Math.cos(a) * 10);
    wantLook.set(0, 1.6, 20);
  } else if (S.meta && S.meta.finale) {
    want.set(0, TERRACE.h + 4.5, 180.5);
    wantLook.set(0, TERRACE.h + 3, 193);
  } else {
    const portrait = camera.aspect < 0.8;
    const back = portrait ? 8.6 : 7.2, up = portrait ? 5.8 : 4.6;
    want.set(focus.x * 0.85, focus.y + up, focus.z - back);
    wantLook.set(focus.x * 0.9, focus.y + 0.7, focus.z + 2.8);
  }
  if (camInit && S.mode === 'play' && !S.meta?.finale && want.distanceTo(camPos) > 16) camInit = false; // teleported
  const k = camInit ? 1 - Math.exp(-dt * (S.meta && S.meta.finale ? 0.8 : 4.5)) : 1;
  camInit = true;
  camPos.lerp(want, k);
  camLook.lerp(wantLook, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---- main loop -----------------------------------------------------------------------------------------------
let last = performance.now();
let acc = 0;
let wasSqd = 0;
const focus = new THREE.Vector3(0, 0, 8);
const dispMe = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, g: 1, sqd: 0 };
S.dusk = 0;

function frozen() {
  const m = S.meta;
  return !m || !!m.trivia || !!m.finale || !!S.paused || !S.connected;
}

// Drop render resolution on devices that can't keep up.
let perfT = 0, perfFrames = 0;
function adaptResolution(rawDt) {
  perfT += rawDt; perfFrames++;
  if (perfT < 2.5) return;
  const fps = perfFrames / perfT;
  perfT = 0; perfFrames = 0;
  if (document.hidden) return;
  const next = fps < 40 ? Math.max(0.75, pixelRatio - 0.25) : fps > 57 ? Math.min(Math.min(window.devicePixelRatio || 1, 1.75), pixelRatio + 0.25) : pixelRatio;
  if (next !== pixelRatio) { pixelRatio = next; renderer.setPixelRatio(pixelRatio); resize(); }
}

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.1, rawDt);
  last = now;
  if (rawDt < 1) adaptResolution(rawDt);
  const t = now / 1000;

  if (S.mode === 'play' && net.latest) {
    const pred = net.pred;
    const partner = net.interpolated(1 - S.you, other) || other;
    if (!pred.ready) pred.reset(net.latest.players[S.you]);
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 8) {
      acc -= DT;
      steps++;
      if (frozen()) continue;
      const inp = controls.sample();
      // camera looks north (+z): screen-right is world -x
      const cmd = pred.step({ jx: -inp.x, jz: inp.y, act: inp.act }, net.col, partner);
      net.queueInput(cmd);
      const ev = pred.p.ev;
      if (ev) {
        squishies[S.you].event(ev, pred.p);
        if (ev & EV.SQUISH) audio.play('squish');
        if (ev & EV.SPRING) { audio.play('spring'); squishies[1 - S.you].pressed(); }
        if (ev & EV.SPLASH) audio.play('splash');
        if (ev & EV.LAND) audio.play('land', pred.p.land);
        if (ev & EV.BUMP) audio.play('bump');
      }
    }
    if (acc > DT * 8) acc = 0;
    net.flush(now);
    pred.decay(dt);

    const p = pred.p;
    if (wasSqd && !p.sqd) audio.play('unsquish');
    wasSqd = p.sqd;
    Object.assign(dispMe, p);
    dispMe.x += pred.err.x; dispMe.y += pred.err.y; dispMe.z += pred.err.z;
    squishies[S.you].setState(dispMe);
    squishies[1 - S.you].setState(partner);
    focus.set(dispMe.x, dispMe.y, dispMe.z);

    updateHint(dt, dispMe);
    updateZone(dt, dispMe);

    // golden hour -> dusk as we approach the courtyard; lanterns once it's lit
    let duskT = smooth(150, 182, dispMe.z) * 0.5;
    if (S.meta?.flags.court) duskT = Math.max(duskT, 0.3 + smooth(150, 175, dispMe.z) * 0.5);
    if (S.meta?.finale) duskT = 1;
    S.dusk += (duskT - S.dusk) * Math.min(1, dt * 0.6);
    world.setDusk(S.dusk);
    squishies.forEach((s) => s.setDusk(S.dusk));
    audio.update(zoneWeights(dispMe.z), S.dusk, dt);

    // bamboo timer ring
    const tm = net.latest.tm;
    const ring = $('timerRing');
    ring.classList.toggle('show', tm > 0 && !S.meta?.flags.timerLatched);
    if (tm > 0) {
      $('timerArc').setAttribute('stroke-dashoffset', String(113.1 * (1 - tm / 15)));
      $('timerArc').setAttribute('stroke', tm < 5 ? '#d9573b' : '#6fa65a');
      $('timerText').textContent = Math.ceil(tm);
    }
  }

  squishies.forEach((s) => s.update(dt, t));
  updateCamera(dt, t, focus);
  const lp = S.mode === 'play' ? [dispMe, other] : [];
  puzzles.update(dt, t, net.latest, S.meta, net.serverTime(), S.dusk, lp, pixelRatio);
  world.update(dt, t, camera, S.mode === 'play' ? focus : camLook);
  renderer.render(scene, camera);
}

// hop sounds for our own squishy only (the partner's would be a lot of noise)
squishies.forEach((s, i) => { s.onHop = (amp) => { if (i === S.you) audio.play('hop', amp); }; });

// Stop moving if the tab goes to the background mid-stride.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'play' && net.pred.ready) {
    controls.reset();
    const cmd = net.pred.step({ jx: 0, jz: 0, act: 0 }, net.col, other);
    net.queueInput(cmd);
    net.flush(Infinity);
  }
});

// Pick up where we left off after a page reload.
if (net.hasSavedRoom()) net.resumeSaved();
else net.connect();
requestAnimationFrame(frame);

// Expose a tiny debug handle for automated smoke tests.
window.__squishy = { S, net, camera, renderer };
