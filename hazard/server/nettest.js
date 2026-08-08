// HAZARD PAY — the network harness.
//
//   node hazard/server/nettest.js
//
// Starts a real server on a real port, connects real `ws` clients, and asserts
// the things that only break under multiplayer. Everything here is checked over
// the wire with the client's own decoder — server/room.js encodes, and
// client/src/net.js decodes, and if those two ever disagree this is where it
// shows up rather than in somebody's browser.
//
// The one section that does not use a socket is the bot shift at the end: it
// steps a room in process as fast as the CPU allows, because five minutes of
// simulated warehouse should not take five minutes to test. It drives the bots
// through exactly the same BotPool the server does.

import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

import { Room } from './room.js';
import { initPhysics } from './world.js';
import { BotPool } from './bots.js';
import { makeCode, normaliseCode, CODE_ALPHABET } from './codes.js';
import { decodeSnapshot } from '../client/src/net.js';
import { Writer, writeInput, MSG, PFLAG, OFLAG } from '../shared/protocol.js';
import { PROP_BY_ID } from '../shared/props.js';
import {
  TICK_MS, PHASE, MAX_PLAYERS, CODE_LENGTH, BUTTON, SNAPSHOT_MS,
} from '../shared/tune.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(__dirname, 'index.js');

// The server runs fast-forwarded so a six-second briefing does not cost six
// seconds of test. It changes how quickly the room's clock advances and nothing
// else — the sockets, the rate limiter and the reaper are all still wall-clock.
const TIMESCALE = 4;
const PORT = 21000 + Math.floor(Math.random() * 8000);
const URL = `ws://127.0.0.1:${PORT}/ws`;

let fails = 0;
let checks = 0;
const ok = (name, cond, extra) => {
  checks++;
  if (!cond) { fails++; console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
  else console.log(`ok   ${name}${extra ? ` — ${extra}` : ''}`);
};
const section = (s) => console.log(`\n--- ${s} ---`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll a condition. Returns what the predicate returned, or null on timeout. */
async function until(fn, ms = 5000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(15);
  }
}

// =============================================================================
// a client
// =============================================================================
class TC {
  constructor(label) {
    this.label = label;
    this.ws = null;
    this.control = [];
    this.snaps = [];
    this.levels = [];
    this.unknown = [];
    this.closed = null;
    this.slot = -1;
    this.code = null;
    this.seq = 1;
    this.w = new Writer(32);
    // Counted separately from the buffer, which is trimmed: "did the room keep
    // ticking" is a question about arrivals, not about what is still in hand.
    this.received = 0;
  }

  open() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(URL);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      const t = setTimeout(() => reject(new Error(`${this.label}: connect timed out`)), 8000);
      ws.on('open', () => { clearTimeout(t); resolve(this); });
      ws.on('error', (e) => { clearTimeout(t); if (!this.closed) reject(e); });
      ws.on('close', (code, reason) => {
        this.closed = { code, reason: String(reason || '') };
      });
      ws.on('message', (data, isBinary) => {
        if (!isBinary) {
          let msg;
          try { msg = JSON.parse(data.toString()); } catch { return; }
          this.control.push(msg);
          if (msg.t === 'joined') { this.slot = msg.slot; this.code = msg.code; }
          return;
        }
        const buf = data instanceof ArrayBuffer
          ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const kind = new Uint8Array(buf)[0];
        if (kind === MSG.SNAPSHOT) {
          const snap = decodeSnapshot(buf);
          if (snap) { snap.bytes = buf.byteLength; this.snaps.push(snap); this.received++; }
          if (this.snaps.length > 60) this.snaps.shift();
          return;
        }
        if (kind === MSG.LEVEL) {
          try { this.levels.push(JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 1)))); }
          catch { this.levels.push({ raw: buf.byteLength }); }
          return;
        }
        this.unknown.push(kind);
      });
    });
  }

  send(o) { try { this.ws.send(JSON.stringify(o)); } catch { /* gone */ } }
  sendRaw(buf) { try { this.ws.send(buf); } catch { /* gone */ } }

  input({ moveX = 0, moveY = 0, yaw = 0, pitch = 0, buttons = 0, holdDist = 1.85 } = {}) {
    this.w.o = 0;
    const seq = this.seq++;
    writeInput(this.w, seq, moveX, moveY, yaw, pitch, buttons, holdDist);
    this.sendRaw(this.w.bytes());
    return seq;
  }

  last(t) { for (let i = this.control.length - 1; i >= 0; i--) if (this.control[i].t === t) return this.control[i]; return null; }
  all(t) { return this.control.filter((m) => m.t === t); }
  get snap() { return this.snaps[this.snaps.length - 1] || null; }
  player(slot = this.slot) { return this.snap ? this.snap.players.find((p) => p.slot === slot) : null; }
  prop(id) { for (let i = this.snaps.length - 1; i >= 0; i--) { const p = this.snaps[i].props.find((q) => q.id === id); if (p) return p; } return null; }

  waitControl(t, pred = () => true, ms = 6000) {
    const from = this.control.length;
    return until(() => this.control.slice(from).find((m) => m.t === t && pred(m))
      || (this.last(t) && pred(this.last(t)) ? this.last(t) : null), ms);
  }

  waitSnaps(n = 2, ms = 6000) {
    const from = this.received;
    return until(() => (this.received - from >= n ? this.snap : null), ms);
  }

  async join(name, code = null) {
    this.send({ t: 'join', name, code });
    return this.waitControl('joined', () => true, 6000);
  }

  close() { try { this.ws.close(); } catch { /* gone */ } }
  kill() { try { this.ws.terminate(); } catch { /* gone */ } }
}

// =============================================================================
// the server under test
// =============================================================================
function health(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function startServer(port, env = {}) {
  const child = spawn(process.execPath, [INDEX], {
    env: {
      ...process.env,
      PORT: String(port),
      HAZARD_TIMESCALE: String(TIMESCALE),
      HAZARD_AUTOFILL: '0',          // rosters stay predictable unless asked
      HAZARD_EMPTY_MS: '3000',
      HAZARD_ROOM_IDLE_MS: '120000',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.log = '';
  child.stdout.on('data', (d) => { child.log += d; });
  child.stderr.on('data', (d) => { child.log += d; process.env.NETTEST_VERBOSE && process.stderr.write(d); });
  child.on('exit', (code) => { child.exited = code; });
  return child;
}

const children = [];
function bye() { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
process.on('exit', bye);

// =============================================================================
// codes
// =============================================================================
section('room codes');
{
  const taken = new Set();
  let worst = '';
  for (let i = 0; i < 4000; i++) {
    const c = makeCode(taken);
    taken.add(c);
    if (c.length !== CODE_LENGTH) worst = worst || `length ${c.length}: ${c}`;
    for (const ch of c) if (!CODE_ALPHABET.includes(ch)) worst = worst || `bad glyph in ${c}`;
  }
  ok('4000 codes are all the right shape and all distinct', !worst && taken.size === 4000, worst);
  ok('the alphabet has no O, I, 0 or 1', !/[OI01]/.test(CODE_ALPHABET));
  ok('the alphabet has no vowels', !/[AEIOU]/.test(CODE_ALPHABET));
  ok('a code never collides with a live room', !taken.has(makeCode(taken)));
  ok('lower case and punctuation normalise', normaliseCode(' bc-df ') === 'BCDF');
  ok('a vowel is not a code', normaliseCode('BEDF') === '');
  ok('a digit is not a code', normaliseCode('BCD1') === '');
  ok('the wrong length is not a code', normaliseCode('BCD') === '' && normaliseCode('BCDFGH') === '');
  ok('null is not a code', normaliseCode(null) === '' && normaliseCode(undefined) === '');
}

// =============================================================================
// the server
// =============================================================================
section('server');
const server = startServer(PORT);
children.push(server);

const up = await until(() => health(PORT), 20000);
ok('the server comes up and answers /health', !!up && up.ok === true,
  up ? `${up.rooms} rooms` : `no response on :${PORT}\n${server.log}`);
if (!up) { console.log(server.log); bye(); process.exit(1); }

// --- two clients, one room ---------------------------------------------------
section('two clients in one room');
const A = await new TC('A').open();
const joinedA = await A.join('ALPHA');
ok('a client with no code opens a new job', !!joinedA && joinedA.slot === 0,
  joinedA ? `slot ${joinedA.slot} code ${joinedA.code}` : 'no joined message');
ok('the code it gets back is a real code', !!joinedA && normaliseCode(joinedA.code) === joinedA.code,
  joinedA && joinedA.code);
ok('the level comes across as a MSG.LEVEL frame',
  !!(await until(() => A.levels.length && A.levels[0].id, 3000)),
  A.levels[0] && A.levels[0].id);

const B = await new TC('B').open();
// Typed in lower case, the way a player reads it off a friend's screen.
const joinedB = await B.join('BRAVO', joinedA.code.toLowerCase());
ok('a second client joins by code, case and all', !!joinedB && joinedB.code === joinedA.code,
  joinedB ? `slot ${joinedB.slot}` : 'refused');

await A.waitSnaps(2);
await B.waitSnaps(2);
ok('A sees both contractors in its snapshot',
  !!A.snap && A.snap.players.length === 2
  && A.snap.players.some((p) => p.slot === A.slot) && A.snap.players.some((p) => p.slot === B.slot),
  A.snap && `${A.snap.players.length} players`);
ok('B sees both contractors in its snapshot',
  !!B.snap && B.snap.players.length === 2, B.snap && `${B.snap.players.length} players`);

const rosterA = await A.waitControl('roster', (m) => m.players.length === 2, 3000);
ok('the roster names them both', !!rosterA
  && rosterA.players.some((p) => p.name === 'ALPHA') && rosterA.players.some((p) => p.name === 'BRAVO'),
  rosterA && rosterA.players.map((p) => p.name).join(', '));
ok('exactly one of them is the host',
  !!rosterA && rosterA.players.filter((p) => p.host).length === 1);

// --- the snapshot itself -----------------------------------------------------
section('the wire');
ok('the snapshot decodes with the client\'s own decodeSnapshot', !!A.snap && A.snap.tick > 0,
  A.snap && `tick ${A.snap.tick}, ${A.snap.bytes}B`);
ok('the first snapshot is a keyframe carrying every prop',
  !!A.snaps[0] && A.snaps[0].props.length > 30, A.snaps[0] && `${A.snaps[0].props.length} props`);
ok('players carry a live position', !!A.player() && Number.isFinite(A.player().x)
  && Math.abs(A.player().y) < 40, A.player() && `y=${A.player().y.toFixed(2)}`);
ok('the alive flag is set on a live contractor', !!A.player() && (A.player().flags & PFLAG.ALIVE) !== 0);

A.send({ t: 'ping', c: 12345 });
const pong = await A.waitControl('pong', (m) => m.c === 12345, 3000);
ok('ping is answered with the echo the client expects', !!pong && pong.c === 12345
  && typeof pong.s === 'number', pong && `s=${pong.s}`);
ok('the pong clock is the snapshot clock',
  !!pong && !!A.snap && Math.abs(((pong.s - A.snap.now) << 0)) < 2000,
  pong && A.snap && `${pong.s - A.snap.now}ms apart`);

// Sleeping props stop being sent, which is the whole bandwidth argument. They
// are authored a little above their resting place and have to fall into it
// first, so this is a "settles to" rather than a "is".
const settled = await until(() => {
  const s = A.snap;
  return s && s.props.length < 8 ? s : null;
}, 12000);
ok('an idle site settles and stops resending sleeping props', !!settled,
  `${(A.snap || { props: [] }).props.length} props in the latest frame`);

// --- a bad code --------------------------------------------------------------
section('bad codes');
{
  const bad = await new TC('BAD').open();
  bad.send({ t: 'join', name: 'BAD', code: '../../etc/passwd' });
  const e1 = await bad.waitControl('error', () => true, 3000);
  ok('a code-shaped attack is refused', !!e1 && /NOT A JOB CODE/i.test(e1.message), e1 && e1.message);
  bad.send({ t: 'join', name: 'BAD', code: 'ZZZZ' });
  const e2 = await bad.waitControl('error', (m) => /NO JOB/i.test(m.message), 3000);
  ok('an unused but well-formed code is refused', !!e2, e2 && e2.message);
  ok('a refused join leaves the socket usable', !bad.closed);
  bad.close();
}

// =============================================================================
// the job
// =============================================================================
// Nothing below here would move an inch in the lobby: room.js feeds every actor
// ZERO_INPUT until the phase is BRIEFING or ACTIVE, so the clock has to be
// running before input means anything.
section('starting the job');
A.send({ t: 'start' });
const briefing = await A.waitControl('phase', (m) => m.phase === PHASE.BRIEFING, 3000);
ok('the host can start the job', !!briefing, briefing && `phase ${briefing.phase}`);
ok('the briefing carries a deadline', !!briefing && briefing.endsIn > 0,
  briefing && `${briefing.endsIn}ms`);
const active = await A.waitControl('phase', (m) => m.phase === PHASE.ACTIVE, 20000);
ok('the briefing runs out and the clock starts', !!active);
ok('tasks come across as their own control message',
  !!A.last('tasks') && A.last('tasks').tasks.length > 0,
  A.last('tasks') && A.last('tasks').tasks.map((t) => t.id).join(', '));
ok('state carries the money and the deadline',
  !!(await A.waitControl('state', (m) => typeof m.banked === 'number' && m.endsIn > 0, 3000)));

// --- input in, seq out -------------------------------------------------------
section('input');
const before = { ...B.player(B.slot) };
let lastSeq = 0;
for (let i = 0; i < 30; i++) { lastSeq = B.input({ moveY: 1, yaw: Math.PI }); await sleep(20); }
const moved = await until(() => {
  const p = A.player(B.slot);
  return p && Math.hypot(p.x - before.x, p.z - before.z) > 0.6 ? p : null;
}, 4000);
ok('input moves the contractor, and everyone else sees it', !!moved,
  moved ? `moved ${Math.hypot(moved.x - before.x, moved.z - before.z).toFixed(2)}m` : 'did not move');
const echoed = await until(() => {
  const p = B.player();
  return p && p.seq >= lastSeq - 2 ? p : null;
}, 3000);
ok('the input sequence is echoed back in the snapshot', !!echoed,
  echoed ? `seq ${echoed.seq} vs sent ${lastSeq}` : `stuck at ${B.player() && B.player().seq}`);

// =============================================================================
// robustness
// =============================================================================
section('malformed traffic');
const snapsBefore = A.received;
B.sendRaw(new Uint8Array([99]).buffer);                       // unknown kind
B.sendRaw(new Uint8Array([MSG.INPUT, 1, 2]).buffer);          // truncated input
B.sendRaw(new Uint8Array(5000).buffer);                       // oversized
B.sendRaw(new Uint8Array([MSG.SNAPSHOT, 4, 4, 4, 4]).buffer); // server->client kind, inbound
B.sendRaw(new Uint8Array(0).buffer);                          // empty
try { B.ws.send('not json at all'); } catch { /* gone */ }
try { B.ws.send('[1,2,3]'); } catch { /* gone */ }
try { B.ws.send('{"t":42}'); } catch { /* gone */ }
try { B.ws.send('{"no":"verb"}'); } catch { /* gone */ }
try { B.ws.send(JSON.stringify({ t: 'join', code: '../../etc/passwd' })); } catch { /* gone */ }
try { B.ws.send(JSON.stringify({ t: 'name', name: { evil: true } })); } catch { /* gone */ }
await sleep(300);

// A name that is not a string reaches `(name).slice(0, 14)` inside room.js, so
// it has to be stopped on the way in or it throws mid-join, after a slot and a
// rigid body have already been handed out.
{
  const odd = await new TC('ODD').open();
  odd.send({ t: 'join', name: { toString: 1 }, code: joinedA.code });
  const gotIn = await odd.waitControl('joined', () => true, 3000);
  ok('a join with a junk name does not wedge the room', !!gotIn,
    gotIn ? `named "${(A.last('roster').players.find((p) => p.slot === gotIn.slot) || {}).name}"` : 'no joined');
  ok('the junk name is replaced, not stored', !!gotIn
    && !/object/i.test((A.last('roster').players.find((p) => p.slot === gotIn.slot) || {}).name || ''));
  odd.close();
  await sleep(300);
}
const named = A.last('roster');
ok('a junk rename is ignored', !!named
  && !named.players.some((p) => /object/i.test(p.name)),
  named && named.players.map((p) => p.name).join(', '));

ok('the server survives a bag of rubbish', server.exited === undefined || server.exited === null,
  `exit ${server.exited}`);
ok('the room keeps ticking through it', A.received > snapsBefore + 2,
  `${A.received - snapsBefore} snapshots since`);
A.send({ t: 'ping', c: 777 });
ok('the server still answers after the rubbish',
  !!(await A.waitControl('pong', (m) => m.c === 777, 3000)));
ok('the offending client is still in the job', !B.closed && !!A.player(B.slot));

// --- flooding ----------------------------------------------------------------
section('input flooding');
const F = await new TC('FLOOD').open();
await F.join('FLOOD', joinedA.code);
const floodFrom = A.received;
for (let i = 0; i < 4000; i++) F.input({ moveY: 1, yaw: 0.5 });
const kicked = await until(() => (F.closed ? F.closed : null), 8000);
ok('a flooding client is throttled and then dropped', !!kicked && kicked.code === 4008,
  kicked ? `close ${kicked.code} ${kicked.reason}` : 'still connected after 4000 frames');
ok('the flood does not stop the room', A.received > floodFrom + 2,
  `${A.received - floodFrom} snapshots during and after`);
ok('the server is still alive after the flood', server.exited === undefined || server.exited === null);
// The kicked socket has to actually give its slot back, or the room leaks one
// contractor's worth of capacity per flood.
const drained = await until(() => {
  const r = A.last('roster');
  return r && r.players.length === 2 ? r : null;
}, 5000);
ok('the flooder gives its slot back', !!drained,
  `${(A.last('roster') || { players: [] }).players.length} in the roster`);

// --- a full job --------------------------------------------------------------
section('a full room');
const crowd = [];
for (let i = 0; i < MAX_PLAYERS; i++) {
  const c = await new TC(`X${i}`).open();
  const j = await c.join(`EXTRA${i}`, joinedA.code);
  crowd.push(c);
  if (!j) break;
}
const refused = crowd[crowd.length - 1];
const fullRoster = A.last('roster');
ok(`the room fills to ${MAX_PLAYERS} and stops`,
  !!fullRoster && fullRoster.players.length === MAX_PLAYERS,
  fullRoster && `${fullRoster.players.length} contractors`);
const full = await refused.waitControl('error', (m) => /FULL/i.test(m.message), 3000);
ok('the one over the limit is turned away rather than squeezed in', !!full, full && full.message);
for (const c of crowd) c.close();
await until(() => {
  const r = A.last('roster');
  return r && r.players.length === 2 ? r : null;
}, 6000);

// --- joining mid-job ---------------------------------------------------------
section('joining mid-job');
const C = await new TC('C').open();
const joinedC = await C.join('CHARLIE', joinedA.code);
ok('a late arrival is let in', !!joinedC, joinedC && `slot ${joinedC.slot}`);
ok('they are told the job is already running', !!joinedC && joinedC.phase === PHASE.ACTIVE,
  joinedC && `phase ${joinedC.phase}`);
ok('they get the level', C.levels.length === 1 && !!C.levels[0].id, C.levels[0] && C.levels[0].id);
const firstC = await until(() => C.snaps[0] || null, 3000);
ok('their first snapshot is a keyframe, not a delta',
  !!firstC && firstC.props.length > 30, firstC && `${firstC.props.length} props`);
ok('they can see the contractors who were already there',
  !!firstC && firstC.players.length >= 2, firstC && `${firstC.players.length} players`);

const cBefore = { ...C.player() };
for (let i = 0; i < 24; i++) { C.input({ moveY: 1, yaw: Math.PI }); await sleep(20); }
const cMoved = await until(() => {
  const p = C.player();
  return p && Math.hypot(p.x - cBefore.x, p.z - cBefore.z) > 0.6 ? p : null;
}, 4000);
ok('a mid-job joiner starts simulating straight away', !!cMoved,
  cMoved ? `moved ${Math.hypot(cMoved.x - cBefore.x, cMoved.z - cBefore.z).toFixed(2)}m` : 'never moved');

// --- dying mid-carry ---------------------------------------------------------
section('a disconnect mid-carry');
const D = await new TC('D').open();
await D.join('DELTA', joinedA.code);
// Hand D's contractor to the bot brain so it goes and picks something up: this
// is the same possession the server offers a player who walks away from their
// desk, and it is the only way to have a socket reliably be holding something
// at the moment it is killed.
D.send({ t: 'autopilot', on: true });
const carrying = await until(() => {
  const p = A.player(D.slot);
  return p && p.heldId ? p : null;
}, 60000);
ok('the stand-in picks something up', !!carrying,
  carrying ? `holding prop ${carrying.heldId}` : 'never got hold of anything');

if (carrying) {
  const heldId = carrying.heldId;
  const flagged = A.prop(heldId);
  ok('the prop is flagged as held on the wire', !!flagged && (flagged.flags & OFLAG.HELD) !== 0,
    flagged && `flags ${flagged.flags}`);

  D.kill();   // not a close frame: the wire goes away mid-carry

  const releasedProp = await until(() => {
    const p = A.prop(heldId);
    return p && (p.flags & OFLAG.HELD) === 0 ? p : null;
  }, 5000);
  ok('killing a client mid-carry releases what it was holding', !!releasedProp,
    releasedProp ? `prop ${heldId} flags ${releasedProp.flags}` : 'still flagged held');

  const gone = await until(() => {
    const s = A.snap;
    return s && !s.players.some((p) => p.slot === D.slot) ? s : null;
  }, 5000);
  ok('the dead client leaves the roster', !!gone);
  ok('the room carries on without them', !!A.snap && A.snap.players.length >= 2,
    A.snap && `${A.snap.players.length} left`);
}

// --- the host leaving --------------------------------------------------------
section('the host leaving');
const hostWas = A.last('roster') ? A.last('roster').host : -1;
ok('A was the host', hostWas === A.slot, `host slot ${hostWas}`);
const bSnaps = B.received;
A.close();
await sleep(600);
const promoted = await B.waitControl('roster', (m) => m.host !== A.slot, 5000);
ok('the host leaving does not kill the room', B.received > bSnaps + 2,
  `${B.received - bSnaps} snapshots after the host left`);
ok('somebody else is made host', !!promoted && promoted.host !== A.slot && promoted.host >= 0,
  promoted && `host is now slot ${promoted.host}`);
B.send({ t: 'start' });   // the new host may drive the room
ok('the new host is obeyed', !(await B.waitControl('error', (m) => /HOST/i.test(m.message), 800)));

// --- bots over the wire ------------------------------------------------------
section('bots over the wire');
B.send({ t: 'bots', n: 2 });
const withBots = await B.waitControl('roster', (m) => m.players.filter((p) => p.bot).length === 2, 5000);
ok('the host can hire stand-ins', !!withBots,
  withBots && withBots.players.map((p) => `${p.name}${p.bot ? '(bot)' : ''}`).join(', '));
if (withBots) {
  const botSlot = withBots.players.find((p) => p.bot).slot;
  // The roster lands before the snapshot that first carries the new actor.
  const start = await until(() => {
    const p = B.player(botSlot);
    return p ? { ...p } : null;
  }, 5000);
  ok('a hired bot appears in the snapshot', !!start);
  const botMoved = await until(() => {
    const p = B.player(botSlot);
    return start && p && Math.hypot(p.x - start.x, p.z - start.z) > 1.5 ? p : null;
  }, 25000);
  ok('a hired bot actually goes to work', !!botMoved,
    botMoved ? `walked ${Math.hypot(botMoved.x - start.x, botMoved.z - start.z).toFixed(1)}m`
      : 'stood still');
  B.send({ t: 'bots', n: 0 });
  ok('and can be sent home',
    !!(await B.waitControl('roster', (m) => m.players.every((p) => !p.bot), 5000)));
}

// --- rooms expire ------------------------------------------------------------
section('rooms expire');
const E = await new TC('E').open();
const joinedE = await E.join('ECHO');
ok('a fresh room for the expiry test', !!joinedE, joinedE && joinedE.code);
E.close();
await sleep(4500);   // HAZARD_EMPTY_MS is 3s on the test server
const G = await new TC('G').open();
G.send({ t: 'join', name: 'GONE', code: joinedE.code });
const expired = await G.waitControl('error', (m) => /NO JOB/i.test(m.message), 3000);
ok('an abandoned room is reaped', !!expired, expired && expired.message);
G.close();
B.close();
await sleep(200);
const finalHealth = await health(PORT);
ok('the server is still healthy at the end', !!finalHealth && finalHealth.ok,
  finalHealth && `${finalHealth.rooms} rooms left`);
server.kill('SIGTERM');

// =============================================================================
// a shift, worked by bots alone
// =============================================================================
// Stepped in process rather than over a socket, because this is five simulated
// minutes and the point is the bots, not the transport — which everything above
// has already been through. The BotPool is the one the server uses.
section('a room of bots works a shift');
await initPhysics();
const botRoom = await Room.create('BOTS');
const pool = new BotPool(botRoom);
pool.fill(4);

// The warehouse as authored cannot be worked to its quota by anybody, and it is
// worth being precise about why, because it is not the bots' fault:
//
//   * £6,600 of it is the piano, the bath and the generator, and NOTHING can
//     pick those up — grab.js refuses the first pair of hands on anything over
//     liftCapacity(1) * 1.35 = 189kg, and all three are heavier, so the second
//     pair of hands the co-op carry needs can never join a lift that cannot be
//     started. See the report.
//   * £7,300 of it is on the top decks at 6.6m, which needs a boost off a
//     friend's shoulders — a verb the bots do not have.
//
// That leaves about £2,800 reachable against a £5,200 quota. So the fixture
// puts four heavy-but-liftable pieces of stock on clear floor, which is the job
// the level means to be: the bots still have to find it, lift it, carry it up
// the ramp and set it down in the van without breaking it.
const FLOOR_STOCK = [
  ['safe', [-6.0, 0, 7.0]],
  ['serverrack', [6.0, 0, 7.0]],
  ['elk', [-6.0, 0, 9.4]],
  ['safe', [6.0, 0, 9.4]],
];
let seeded = 0;
for (const [kind, p] of FLOOR_STOCK) {
  const def = PROP_BY_ID[kind];
  // Set it down rather than dropping it: gravity is -22 here, so half a metre
  // is 4.7m/s and several of these shatter below that.
  botRoom.world.spawnProp(kind, [p[0], restHeight(def) + 0.03, p[2]]);
  seeded += def.value;
}
console.log(`     seeded £${seeded} of reachable stock on the floor `
  + `(quota £${botRoom.level.quota}, ${botRoom.world.props.size} props total)`);

let clock = Date.now();
botRoom.begin(clock);
const budget = botRoom.level.timeLimit * 1000 + 12000;
const startedAt = performance.now();
let ticks = 0;
let firstBank = 0;
for (let t = 0; t < budget; t += TICK_MS) {
  clock += TICK_MS;
  pool.think(clock);
  botRoom.step(clock);
  botRoom.drainEvents();   // nobody is listening; do not let the queue grow
  ticks++;
  if (!firstBank && botRoom.banked > 0) firstBank = t;
  if (botRoom.phase === PHASE.DEBRIEF) break;
}
const wall = performance.now() - startedAt;
const simSeconds = Math.round((ticks * TICK_MS) / 1000);

ok('bots find, lift and bank stock unaided', botRoom.banked > 0,
  `first payment at ${(firstBank / 1000).toFixed(0)}s`);
ok('a room of bots reaches its quota unaided', botRoom.banked >= botRoom.level.quota,
  `£${botRoom.banked} of £${botRoom.level.quota} in ${simSeconds}s `
  + `(${[...botRoom.extractedKinds].map(([k, n]) => `${k}x${n}`).join(' ') || 'nothing'})`);
ok('the job ends because it was finished, not because time ran out',
  botRoom.phase === PHASE.DEBRIEF && botRoom.banked >= botRoom.level.quota,
  `phase ${botRoom.phase}`);
ok('the crew is still standing at the end',
  [...botRoom.actors.values()].some((a) => a.alive && !a.downed),
  [...botRoom.actors.values()].map((a) => (a.downed ? 'down' : 'up')).join(' '));
ok('nothing went non-finite over a whole shift',
  [...botRoom.actors.values()].every((a) => [a.pos.x, a.pos.y, a.pos.z].every(Number.isFinite))
  && [...botRoom.world.props.values()].every((r) => {
    const p = r.rb.translation();
    return [p.x, p.y, p.z].every(Number.isFinite);
  }));
console.log(`     ${simSeconds}s simulated in ${(wall / 1000).toFixed(1)}s wall `
  + `(${(wall / ticks).toFixed(2)}ms/tick), ${botRoom.breakages} breakages`);
botRoom.destroy();

// =============================================================================
console.log(fails ? `\n${fails} FAILED of ${checks}` : `\nall good — ${checks} checks`);
bye();
process.exit(fails ? 1 : 0);

/** Half-height of a prop at rest, so a fixture can set one down gently. */
function restHeight(def) {
  if (def.shape === 'box') return def.size[1] / 2;
  if (def.shape === 'cyl') return def.size[1] / 2;
  if (def.shape === 'ball') return def.size[0];
  let lo = 0;
  for (const p of def.parts) {
    const h = p.shape === 'ball' ? p.size[0] : p.size[1] / 2;
    lo = Math.min(lo, p.offset[1] - h);
  }
  return -lo;
}

void BUTTON; void SNAPSHOT_MS;
