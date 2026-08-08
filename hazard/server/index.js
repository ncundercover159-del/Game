// HAZARD PAY — the server.
//
// One process, rooms in a Map, no database. Each room owns a Rapier world and a
// fixed 60Hz clock; the sockets attached to it are just plumbing that must never
// be able to disturb the simulation. That is the whole design brief for this
// file: everything here is either "move bytes" or "stop a client from hurting
// the room it is in".
//
// Two wire formats, and the split is not negotiable:
//   JSON  — join, joined, roster, phase, tasks, state, results, events, error,
//           ping/pong. Rare, human-readable, and never in the hot path.
//   BINARY — INPUT in, SNAPSHOT and LEVEL out, using shared/protocol.js. There
//           is exactly one encoder for these and it lives in shared/ + room.js.
//
// The loop is a fixed-step accumulator. It never drifts, because time is only
// ever consumed in whole TICK_MS units and the remainder is carried; and it
// never death-spirals, because the backlog is clamped — a server that falls
// behind skips time rather than trying to simulate an ever-growing debt at
// ever-decreasing speed.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { Room } from './room.js';
import { initPhysics } from './world.js';
import { BotPool } from './bots.js';
import { makeCode, normaliseCode, codeSpace, CODE_ALPHABET } from './codes.js';
import { Reader, MSG, readInput } from '../shared/protocol.js';
import { LEVEL_BY_ID, DEFAULT_LEVEL } from '../shared/levels/index.js';
import {
  TICK_MS, SNAPSHOT_MS, INPUT_HZ, MAX_PLAYERS, ROOM_IDLE_MS, PHASE,
  HOLD_DISTANCE_MIN, HOLD_DISTANCE_MAX,
} from '../shared/tune.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../client/dist');

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

const PORT = num(process.env.PORT, 8787);
const HOST = process.env.HOST || '0.0.0.0';

// --- knobs that exist for the harness ---------------------------------------
// Everything simulation-shaped lives in shared/tune.js. These four are about
// the SERVER's relationship with wall-clock time and memory, not about the
// game, which is why they are env and not tune constants.
const TIMESCALE = num(process.env.HAZARD_TIMESCALE, 1);      // >1 fast-forwards
const IDLE_MS = num(process.env.HAZARD_ROOM_IDLE_MS, ROOM_IDLE_MS);
// A room with bots in it keeps simulating after the last human leaves, so that
// walking out for thirty seconds does not cost you the job. It should not,
// however, keep a physics world alive all night for nobody.
const EMPTY_MS = num(process.env.HAZARD_EMPTY_MS, 90_000);
const MAX_ROOMS = num(process.env.HAZARD_MAX_ROOMS, 400);
// Contractors the server adds to a job that starts short-handed. The game is
// built for a crew; a lone player with an empty warehouse is not the game.
const AUTOFILL = Math.max(0, Math.min(MAX_PLAYERS,
  Number(process.env.HAZARD_AUTOFILL ?? 2) || 0));

// --- limits ------------------------------------------------------------------
// A frame larger than this is not a client with an opinion, it is an attack or
// a bug, and either way there is nothing in the protocol that needs the space.
const MAX_FRAME = 1024;
const INPUT_BYTES = 13;          // u8 kind + u32 seq + 2*i8 + 2*i16 + u8 + u8
// Inputs are nominally 30Hz. Allow double for a client on a jittery timer, plus
// a burst so a tab that was backgrounded can catch up without being punished.
const INPUT_RATE = INPUT_HZ * 2;
const INPUT_BURST = INPUT_HZ;
const CONTROL_RATE = 12;
const CONTROL_BURST = 24;
// Frames refused by the bucket are dropped in silence up to this many, because
// dropping is cheap and clients are sometimes just clumsy. Past it the socket is
// costing the room real time and gets closed.
const ABUSE_LIMIT = 240;
// Never make up more than this much simulation in one pass. Fifteen ticks is
// enough to ride out a GC pause; beyond it the honest answer is that time was
// lost, and pretending otherwise is how a struggling server becomes a stopped
// one.
const MAX_CATCHUP_MS = 250;
// If a socket cannot drain this fast it is not going to catch up by being sent
// more; skip its snapshot rather than growing the kernel buffer without bound.
const BACKPRESSURE_BYTES = 512 * 1024;
const JOIN_GRACE_MS = 30_000;    // connect, then say something, or go away

/** @type {Map<string, Session>} */
const rooms = new Map();
let nextClientId = 1;

// =============================================================================
// a token bucket
// =============================================================================
class Bucket {
  constructor(perSecond, burst) {
    this.rate = perSecond / 1000;
    this.cap = burst;
    this.tokens = burst;
    this.at = 0;
  }

  take(now) {
    if (!this.at) this.at = now;
    this.tokens = Math.min(this.cap, this.tokens + (now - this.at) * this.rate);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// =============================================================================
// a connected contractor
// =============================================================================
class Client {
  constructor(ws) {
    this.id = nextClientId++;
    this.ws = ws;
    this.session = null;
    this.slot = -1;
    this.name = '';
    this.bot = false;
    this.autopilot = false;
    this.connectedAt = Date.now();
    this.inputs = new Bucket(INPUT_RATE, INPUT_BURST);
    this.control = new Bucket(CONTROL_RATE, CONTROL_BURST);
    this.abuse = 0;
    this.junk = 0;
    this.alive = true;
  }

  get open() { return this.ws.readyState === 1; }

  send(data) {
    if (!this.open) return false;
    try { this.ws.send(data); return true; } catch { return false; }
  }

  sendJSON(o) { return this.send(JSON.stringify(o)); }

  /** Close politely; the socket's own close handler does the leaving. */
  kick(code, reason) {
    try { this.ws.close(code, reason); } catch { /* already gone */ }
  }
}

// =============================================================================
// a room, plus its clock and its sockets
// =============================================================================
class Session {
  constructor(code, levelId) {
    this.code = code;
    this.room = new Room(code, levelId);
    this.bots = new BotPool(this.room);
    this.clients = new Set();
    this.hostSlot = -1;

    // The room's clock. Anchored to wall time at creation and advanced only in
    // whole ticks, so `phaseEndsAt` and the snapshot timestamps share one
    // domain and the client's interpolation has something coherent to track.
    this.clock = Date.now();
    this.wall = this.clock;
    this.acc = 0;
    this.snapAcc = 0;
    this.stateAcc = 0;
    this.lostMs = 0;
    this.ticks = 0;

    this.lastActivity = this.clock;
    this.lastHumanAt = this.clock;
    this.keyframe = true;
    this.taskSig = '';
    this.errors = 0;
    this.dead = false;
  }

  get humans() { return this.clients.size; }
  get population() { return this.room.actors.size; }

  touch() { this.lastActivity = Date.now(); }

  // --- membership ------------------------------------------------------------
  admit(client, name) {
    // A job full of stand-ins should still let a real contractor in: the bots
    // are there to cover for absent friends, not to lock them out.
    if (this.room.full && this.bots.size > 0) this.bots.remove(1);
    const slot = this.room.join(client, name);
    if (slot === null || slot === undefined) return null;

    client.session = this;
    client.slot = slot;
    client.name = this.room.actors.get(slot).name;
    this.clients.add(client);
    if (this.hostSlot < 0) this.hostSlot = slot;
    // Whoever just arrived has no idea where two hundred sleeping crates are.
    this.keyframe = true;
    this.touch();
    this.lastHumanAt = this.lastActivity;
    return slot;
  }

  release(client) {
    if (!this.clients.delete(client)) return;
    // room.leave() releases anything this contractor was holding before it
    // destroys them, which is what stops a disconnect mid-carry from leaving a
    // piano welded to a ghost.
    this.room.leave(client.slot);
    if (this.hostSlot === client.slot) this.promoteHost();
    client.session = null;
    client.slot = -1;
    this.touch();
    this.broadcastRoster();
  }

  /** The host leaving is not the end of the job, just a change of paperwork. */
  promoteHost() {
    const next = [...this.clients].sort((a, b) => a.connectedAt - b.connectedAt)[0];
    this.hostSlot = next ? next.slot : -1;
  }

  isHost(client) {
    // A room whose host has gone and left only bots behind still has to be
    // startable by whoever walks in next.
    return this.hostSlot === client.slot || this.hostSlot < 0;
  }

  // --- the clock -------------------------------------------------------------
  step(wall) {
    let dt = (wall - this.wall) * TIMESCALE;
    this.wall = wall;
    // A backwards system clock (NTP, a suspended laptop) must not rewind a job.
    if (!(dt > 0)) dt = 0;

    this.acc += dt;
    if (this.acc > MAX_CATCHUP_MS) {
      // Own up to the lost time instead of hiding it in the accumulator: the
      // room's clock jumps, the phase timers stay honest against wall time, and
      // the backlog cannot grow. This is the anti-death-spiral clamp.
      const lost = this.acc - MAX_CATCHUP_MS;
      this.clock += lost;
      this.acc = MAX_CATCHUP_MS;
      this.lostMs += lost;
    }

    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      this.clock += TICK_MS;
      try {
        // Bots go through pendingInput exactly like a socket does, so there is
        // one code path into the simulation and no second physics for AI.
        this.bots.think(this.clock);
        this.room.step(this.clock);
      } catch (err) {
        this.onError('step', err);
        return;
      }
      this.ticks++;
    }

    this.snapAcc += dt;
    if (this.snapAcc >= SNAPSHOT_MS) {
      // Carry the remainder so the broadcast rate is exactly SNAPSHOT_HZ, but
      // refuse to fire a burst of them after a stall.
      this.snapAcc = this.snapAcc > SNAPSHOT_MS * 3 ? 0 : this.snapAcc - SNAPSHOT_MS;
      try { this.publish(); } catch (err) { this.onError('publish', err); }
    }
  }

  onError(where, err) {
    this.errors++;
    console.error(`room ${this.code} ${where} error:`, err && err.stack ? err.stack : err);
    // One bad tick is a bug worth surviving; a room that cannot tick at all is
    // a room that will spam the log forever, so retire it.
    if (this.errors > 20) {
      console.error(`room ${this.code} retired after ${this.errors} errors`);
      destroySession(this, 4003, 'room failed');
    }
  }

  // --- outbound --------------------------------------------------------------
  publish() {
    const room = this.room;

    // Events first: they explain the snapshot that is about to arrive, and
    // draining them is not optional — nothing else clears that array, so a room
    // with no listeners at all would grow one forever.
    const events = room.drainEvents();
    if (events.length) {
      const payload = JSON.stringify({ t: 'events', events });
      for (const c of this.clients) c.send(payload);
      for (const e of events) {
        if (e.type === 'phase') this.broadcastPhase(e.detail.reason);
        else if (e.type === 'results') this.broadcast({ t: 'results', ...e.detail });
        else if (e.type === 'join' || e.type === 'leave') this.broadcastRoster();
      }
    }

    // A snapshot only carries what moved, so somebody who just walked in needs
    // one frame that carries everything. `dirty` is the mechanism room.js and
    // world.js already use for exactly this; there is no keyframe API to call.
    if (this.keyframe) {
      for (const rec of room.world.props.values()) rec.dirty = true;
      this.keyframe = false;
    }

    const snap = room.snapshot(this.clock);
    for (const c of this.clients) {
      if (c.ws.bufferedAmount > BACKPRESSURE_BYTES) continue;
      c.send(snap);
    }

    const sig = room.taskState.map((s) => `${s.done ? 1 : 0}:${s.progress.toFixed(2)}`).join('|');
    if (sig !== this.taskSig) {
      this.taskSig = sig;
      this.broadcast(this.tasksPayload());
    }

    this.stateAcc += SNAPSHOT_MS;
    if (this.stateAcc >= 500) {
      this.stateAcc = 0;
      this.broadcast(this.statePayload());
    }
  }

  broadcast(o, except) {
    const payload = JSON.stringify(o);
    for (const c of this.clients) if (c !== except) c.send(payload);
  }

  broadcastRoster() { this.broadcast(this.rosterPayload()); }

  broadcastPhase(reason) {
    this.broadcast({ ...this.phasePayload(), ...(reason ? { reason } : {}) });
  }

  // --- payloads --------------------------------------------------------------
  roster() {
    const out = [];
    for (const [slot, actor] of this.room.actors) {
      const handle = this.room.clients.get(slot);
      out.push({
        slot,
        name: actor.name,
        bot: !!(handle && handle.bot),
        host: slot === this.hostSlot,
        autopilot: !!(handle && handle.autopilot),
      });
    }
    return out.sort((a, b) => a.slot - b.slot);
  }

  rosterPayload() {
    return { t: 'roster', players: this.roster(), host: this.hostSlot, code: this.code };
  }

  /**
   * Both forms of the deadline, on purpose. `endsAt` is in the server clock the
   * snapshots are stamped with, which is what a client that has synced its
   * offset wants; `endsIn` is milliseconds from now, which is what a client that
   * has not synced anything can still draw a countdown from.
   */
  phasePayload() {
    const r = this.room;
    return {
      t: 'phase',
      phase: r.phase,
      endsAt: r.phaseEndsAt ? r.phaseEndsAt >>> 0 : 0,
      endsIn: r.phaseEndsAt ? Math.max(0, Math.round(r.phaseEndsAt - this.clock)) : 0,
      now: this.clock >>> 0,
    };
  }

  tasksPayload() {
    const r = this.room;
    return {
      t: 'tasks',
      quota: r.level.quota,
      banked: r.banked,
      breakages: r.breakages,
      tasks: r.level.tasks.map((task, i) => ({
        id: task.id,
        title: task.title,
        detail: task.detail,
        bonus: task.bonus || 0,
        done: r.taskState[i].done,
        progress: r.taskState[i].progress,
      })),
    };
  }

  statePayload() {
    const r = this.room;
    return {
      ...this.tasksPayload(),
      t: 'state',
      phase: r.phase,
      tick: r.tick,
      now: this.clock >>> 0,
      endsAt: r.phaseEndsAt ? r.phaseEndsAt >>> 0 : 0,
      endsIn: r.phaseEndsAt ? Math.max(0, Math.round(r.phaseEndsAt - this.clock)) : 0,
      players: this.roster(),
    };
  }

  destroy() {
    this.dead = true;
    this.bots.clear();
    try { this.room.destroy(); } catch { /* already gone */ }
  }
}

// =============================================================================
// rooms
// =============================================================================
function createSession(levelId) {
  if (rooms.size >= MAX_ROOMS) return null;
  const code = makeCode(rooms);
  const session = new Session(code, LEVEL_BY_ID[levelId] ? levelId : DEFAULT_LEVEL);
  rooms.set(code, session);
  console.log(`room ${code} opened on "${session.room.level.name}" (${rooms.size} live)`);
  return session;
}

function destroySession(session, code = 1001, reason = 'room closed') {
  if (!rooms.get(session.code)) return;
  rooms.delete(session.code);
  for (const c of [...session.clients]) {
    session.clients.delete(c);
    c.session = null;
    c.slot = -1;
    c.kick(code, reason);
  }
  session.destroy();
  console.log(`room ${session.code} closed: ${reason} (${rooms.size} live)`);
}

// =============================================================================
// http
// =============================================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    let players = 0;
    let bots = 0;
    for (const s of rooms.values()) { players += s.humans; bots += s.bots.size; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true, rooms: rooms.size, players, bots,
      uptime: Math.round(process.uptime()),
    }));
    return;
  }

  // Optional: serve the built client from the same box. Ignored entirely when
  // the client is hosted somewhere else, which is the usual arrangement.
  if (!fs.existsSync(DIST)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('HAZARD PAY server. The client is hosted separately.\n');
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || !path.extname(p)) p = '/index.html';
  const file = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': file.includes('/assets/')
        ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(buf);
  });
});

// =============================================================================
// ws
// =============================================================================
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Snapshots compress well and the level frame compresses very well, but the
  // 13-byte input packets do not, so keep a threshold on it.
  perMessageDeflate: { threshold: 2048, zlibDeflateOptions: { level: 6 } },
  maxPayload: MAX_FRAME * 8,
});

wss.on('connection', (ws) => {
  const client = new Client(ws);
  ws.hz = client;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    try {
      if (isBinary) onBinary(client, data);
      else onText(client, data);
    } catch (err) {
      // A client cannot be allowed to take the process down by sending
      // something the parser did not expect. Count it and carry on.
      client.junk++;
      console.error(`client ${client.id} message error:`, err && err.message);
      if (client.junk > 40) client.kick(4004, 'malformed traffic');
    }
  });

  ws.on('error', () => { /* the close handler does the cleanup */ });

  ws.on('close', () => {
    client.alive = false;
    if (client.session) client.session.release(client);
  });
});

// --- inbound: binary ---------------------------------------------------------
function onBinary(client, data) {
  // Oversized first, and without looking inside: a frame this big is not a
  // protocol message under any reading of protocol.js.
  if (data.length > MAX_FRAME) { flagJunk(client); return; }
  if (data.length < 1) { flagJunk(client); return; }

  const kind = data[0];
  if (kind !== MSG.INPUT) { flagJunk(client); return; }
  if (data.length < INPUT_BYTES) { flagJunk(client); return; }

  const now = Date.now();
  if (!client.inputs.take(now)) {
    // Flooding. Dropping is the cheap correct answer; the room simply uses the
    // last input it accepted, which is exactly what it does for a lagging
    // client anyway. Persistent offenders are shown the door.
    client.abuse++;
    if (client.abuse > ABUSE_LIMIT) client.kick(4008, 'input flood');
    return;
  }

  const session = client.session;
  if (!session) return;
  const actor = session.room.actors.get(client.slot);
  if (!actor) return;

  // Copy out of the pooled Buffer before handing it to a DataView, or the
  // reader is looking at whatever else Node has parked in that arena.
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const r = new Reader(buf);
  r.u8r();
  const raw = readInput(r);

  // Sanitise everything. The simulation trusts these numbers with a character
  // controller and a force servo, and a NaN yaw would take the whole room's
  // physics with it.
  const seq = raw.seq >>> 0;
  const last = actor.lastInputSeq >>> 0;
  // Late or duplicated packets are dropped, but a large backwards jump is a
  // fresh connection reusing a slot, not an attack, so let it re-anchor.
  if (seq <= last && last - seq < 4096) return;

  actor.pendingInput = {
    seq,
    moveX: clampFinite(raw.moveX, -1, 1),
    moveY: clampFinite(raw.moveY, -1, 1),
    yaw: wrapAngle(clampFinite(raw.yaw, -Math.PI * 2, Math.PI * 2)),
    pitch: clampFinite(raw.pitch, -1.55, 1.55),
    buttons: raw.buttons & 0xff,
    holdDist: clampFinite(raw.holdDist, HOLD_DISTANCE_MIN, HOLD_DISTANCE_MAX),
  };
  // The echo the client's predictor reconciles against.
  actor.lastInputSeq = seq;
  client.autopilot = false;   // a real input takes the wheel back off the bot
  session.touch();
}

function flagJunk(client) {
  client.junk++;
  if (client.junk > 40) client.kick(4004, 'malformed traffic');
}

// --- inbound: text -----------------------------------------------------------
function onText(client, data) {
  if (data.length > MAX_FRAME * 4) { flagJunk(client); return; }
  if (!client.control.take(Date.now())) {
    client.abuse++;
    if (client.abuse > ABUSE_LIMIT) client.kick(4008, 'control flood');
    return;
  }
  let msg;
  try { msg = JSON.parse(data.toString()); } catch { flagJunk(client); return; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') {
    flagJunk(client);
    return;
  }
  handle(client, msg);
}

function fail(client, message) { client.sendJSON({ t: 'error', message }); }

function handle(client, msg) {
  switch (msg.t) {
    case 'ping':
      // Clock sync. `s` is the same domain the snapshots are stamped in, so the
      // client's offset lines up with the interpolation cursor; net.js reads
      // exactly these two fields.
      client.sendJSON({
        t: 'pong',
        c: msg.c,
        s: (client.session ? client.session.clock : Date.now()) >>> 0,
      });
      return;

    case 'join': return onJoin(client, msg);

    case 'start': {
      const s = client.session;
      if (!s) return fail(client, 'NOT IN A JOB');
      if (!s.isHost(client)) return fail(client, 'ONLY THE HOST CAN START');
      if (s.room.phase !== PHASE.LOBBY) return fail(client, 'THE JOB HAS STARTED');
      // Top the crew up to a workable size. A warehouse this big is not a
      // one-person job, and the stand-ins are the difference between a demo and
      // an empty building.
      if (AUTOFILL > 0) s.bots.fill(Math.max(s.bots.size, AUTOFILL - s.humans));
      s.room.begin(s.clock);
      s.keyframe = true;
      s.touch();
      s.broadcastRoster();
      return;
    }

    case 'bots': {
      const s = client.session;
      if (!s) return fail(client, 'NOT IN A JOB');
      if (!s.isHost(client)) return fail(client, 'ONLY THE HOST CAN HIRE');
      const want = Math.max(0, Math.min(MAX_PLAYERS, Math.round(Number(msg.n) || 0)));
      s.bots.fill(want);
      s.keyframe = true;
      s.touch();
      s.broadcastRoster();
      return;
    }

    case 'autopilot': {
      // Hand your own contractor to the bot brain. This is what makes the game
      // demoable alone, and it is also how the harness gets a client to be
      // holding something at a chosen moment without a navmesh.
      const s = client.session;
      if (!s) return fail(client, 'NOT IN A JOB');
      client.autopilot = msg.on !== false;
      if (client.autopilot) s.bots.possess(client.slot);
      else s.bots.dispossess(client.slot);
      s.touch();
      s.broadcastRoster();
      return;
    }

    case 'name': {
      const s = client.session;
      if (!s) return;
      const actor = s.room.actors.get(client.slot);
      if (!actor) return;
      actor.name = String(msg.name || actor.name).slice(0, 14).toUpperCase();
      client.name = actor.name;
      s.broadcastRoster();
      return;
    }

    case 'leave': {
      const s = client.session;
      if (s) s.release(client);
      return;
    }

    default:
      return;   // an unknown verb is a newer client, not an error
  }
}

function onJoin(client, msg) {
  if (client.session) return fail(client, 'ALREADY IN A JOB');

  let session;
  const raw = msg.code == null ? '' : String(msg.code);
  if (raw.trim() === '') {
    session = createSession(msg.levelId);
    if (!session) return fail(client, 'NO ROOM ON THE SERVER');
  } else {
    const code = normaliseCode(raw);
    if (!code) return fail(client, 'THAT IS NOT A JOB CODE');
    session = rooms.get(code);
    if (!session) return fail(client, 'NO JOB WITH THAT CODE');
  }

  const slot = session.admit(client, msg.name);
  if (slot === null) return fail(client, 'THAT JOB IS FULL');

  const level = session.room.level;
  client.sendJSON({
    ...session.phasePayload(),
    t: 'joined',
    slot,
    code: session.code,
    levelId: level.id,
    host: session.hostSlot,
    players: session.roster(),
    quota: level.quota,
    tick: session.room.tick,
  });

  // The client already has the level geometry — it imports shared/levels
  // directly, which is the only way its prediction can agree with this process
  // about where a wall is — so this frame is a pointer, not a payload.
  sendLevel(client, level);
  client.sendJSON(session.tasksPayload());
  session.broadcastRoster();
  // Arriving in the middle of a job is a normal thing to do, so give the new
  // arrival the world immediately rather than at the next broadcast beat.
  session.keyframe = true;
  try { session.publish(); } catch (err) { session.onError('publish', err); }
}

function sendLevel(client, level) {
  const body = Buffer.from(JSON.stringify({
    id: level.id,
    name: level.name,
    subtitle: level.subtitle,
    brief: level.brief,
    quota: level.quota,
    timeLimit: level.timeLimit,
    spawn: level.spawn,
    spawnYaw: level.spawnYaw,
    extract: level.extract,
  }), 'utf8');
  const frame = Buffer.allocUnsafe(body.length + 1);
  frame[0] = MSG.LEVEL;
  body.copy(frame, 1);
  client.send(frame);
}

function clampFinite(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < lo ? lo : n > hi ? hi : n;
}

/** Yaw goes on the wire quantised to +/-3.2767 radians; keep it in range. */
function wrapAngle(a) {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

// =============================================================================
// loops
// =============================================================================
// One timer for every room. Node rounds the interval down to 16ms, which fires
// slightly fast; the accumulator turns that into exactly 60Hz and carries the
// remainder, so the tick rate does not drift with the timer's rounding.
setInterval(() => {
  const wall = Date.now();
  for (const session of rooms.values()) {
    if (!session.dead) session.step(wall);
  }
}, Math.max(4, Math.floor(TICK_MS)));

setInterval(() => {
  const now = Date.now();
  for (const session of [...rooms.values()]) {
    if (session.humans > 0) {
      session.lastHumanAt = now;
      session.lastActivity = now;
      continue;
    }
    if (now - session.lastHumanAt > EMPTY_MS) {
      destroySession(session, 4002, 'nobody left on site');
    } else if (now - session.lastActivity > IDLE_MS) {
      destroySession(session, 4002, 'job expired');
    }
  }
}, 2000);

// Sockets that stopped answering, and sockets that connected and never spoke.
setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    const client = ws.hz;
    if (client && !client.session && now - client.connectedAt > JOIN_GRACE_MS) {
      client.kick(4005, 'never joined');
      continue;
    }
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* gone */ }
  }
}, 15_000);

// =============================================================================
// boot
// =============================================================================
// Physics is initialised before the port opens, so the first join does not race
// a WASM load and every room construction downstream can be synchronous.
await initPhysics();

server.listen(PORT, HOST, () => {
  console.log(`HAZARD PAY server on :${PORT}`
    + `  ${CODE_ALPHABET.length}^4 = ${codeSpace().toLocaleString()} codes`
    + `  autofill ${AUTOFILL}`
    + (TIMESCALE !== 1 ? `  TIMESCALE ${TIMESCALE}x` : ''));
  if (fs.existsSync(DIST)) console.log(`serving the client from ${DIST}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const session of [...rooms.values()]) destroySession(session, 1012, 'server restarting');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

export { rooms, server, wss };
