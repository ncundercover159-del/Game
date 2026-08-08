// HAZARD PAY — the client end of the wire.
//
// Two jobs, deliberately separated. `decodeSnapshot` is a pure function over an
// ArrayBuffer that imports nothing but the shared protocol — which means it can
// be run in Node against a real Room and diffed byte for byte against the
// encoder, and it is, because a snapshot decoder that has never met its encoder
// is a guess. `Net` is everything stateful: transport, clock, control JSON.
//
// The transport is swappable on purpose. A browser talks to the server over a
// WebSocket; a test harness hands the same Net an in-process pipe to a Room it
// is stepping itself. Neither knows which it is.

import {
  Reader, MSG, PFLAG, OFLAG, Writer, writeInput, unpackQuat, NO_WATER,
} from '../../shared/protocol.js';
import { INTERP_DELAY_MS, POS_SCALE } from '../../shared/tune.js';

export { MSG, PFLAG, OFLAG };

// --- the snapshot -----------------------------------------------------------
/**
 * Decode one MSG.SNAPSHOT exactly as server/room.js snapshot() writes it.
 *
 * The layout, in order, all little-endian:
 *   u8  MSG.SNAPSHOT
 *   u32 tick
 *   u32 server clock, milliseconds, truncated to 32 bits
 *   u8  phase
 *   u8  player count
 *     u8  slot | u8 PFLAG | i16*3 feet position | i16 yaw | i16 pitch
 *     u8  health | u8 stamina | u16 held prop id (0 = empty hands)
 *     u32 last input sequence this actor has consumed
 *   u16 bone count, summed across every ragdolled contractor
 *     u8 slot | u8 bone index | i16*3 position | u32 packed quaternion
 *   u16 prop count — only what moved, plus anything that just fell asleep
 *     u16 id | u8 OFLAG | i16*3 position | u32 packed quaternion
 *   i16 water level in centimetres, or NO_WATER for a level with none
 *   u8  valve bitmask, one bit per declared valve in declaration order
 *   u8  zone count
 *     i16 that zone's own surface, for a tank whose valve was skipped
 *
 * Positions are centimetres, angles are radians*10000, quaternions are
 * smallest-three. All of that is protocol.js's problem, not ours.
 *
 * @param {ArrayBuffer} buf
 * @returns {object|null} null if this is not a snapshot
 */
export function decodeSnapshot(buf) {
  const r = new Reader(buf);
  if (r.u8r() !== MSG.SNAPSHOT) return null;

  const snap = {
    tick: r.u32r(),
    now: r.u32r(),
    phase: r.u8r(),
    players: [],
    bones: [],
    props: [],
    recvAt: 0,
  };

  const n = r.u8r();
  for (let i = 0; i < n; i++) {
    const slot = r.u8r();
    const flags = r.u8r();
    const p = r.posr({});
    const yaw = r.angr();
    const pitch = r.angr();
    snap.players.push({
      slot,
      flags,
      // The wire carries the FEET, not the centre of the capsule: actor.pos is
      // the contact point and the body sits height/2 above it.
      x: p.x, y: p.y, z: p.z,
      yaw, pitch,
      health: r.u8r(),
      stamina: r.u8r(),
      heldId: r.u16r(),
      seq: r.u32r(),
    });
  }

  const bones = r.u16r();
  for (let i = 0; i < bones; i++) {
    const slot = r.u8r();
    const index = r.u8r();
    const p = r.posr({});
    const q = unpackQuat(r.u32r(), {});
    snap.bones.push({ slot, index, x: p.x, y: p.y, z: p.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
  }

  const props = r.u16r();
  for (let i = 0; i < props; i++) {
    const id = r.u16r();
    const flags = r.u8r();
    const p = r.posr({});
    const q = unpackQuat(r.u32r(), {});
    snap.props.push({ id, flags, x: p.x, y: p.y, z: p.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
  }

  const water = r.i16r();
  // null rather than -Infinity: "no water" is a fact about the level, and a
  // renderer that has to test for a magic float will eventually forget to.
  snap.water = water === NO_WATER ? null : water / POS_SCALE;
  snap.valves = r.u8r();
  const zones = r.u8r();
  snap.zoneWater = [];
  for (let i = 0; i < zones; i++) snap.zoneWater.push(r.i16r() / POS_SCALE);

  return snap;
}

/**
 * Wrap-safe difference between two server clocks.
 *
 * The server sends `Date.now() >>> 0`, which rolls over every 49.7 days. A
 * plain subtraction is right 99.9999% of the time and catastrophically wrong
 * for the two seconds either side of the wrap, which is exactly the kind of bug
 * that gets blamed on the physics.
 */
export function clockDelta(a, b) {
  const d = (a - b) >>> 0;
  return d > 0x80000000 ? d - 0x100000000 : d;
}

// --- transports -------------------------------------------------------------
// A transport is four methods and no opinions:
//   connect(handlers)  handlers = { onOpen, onMessage, onClose, onError }
//                      onMessage receives a string or an ArrayBuffer
//   send(data)         string or ArrayBuffer
//   close()
//   get connected()

export class WebSocketTransport {
  constructor(url) { this.url = url; this.ws = null; }

  get connected() { return !!this.ws && this.ws.readyState === 1; }

  connect(h) {
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => h.onOpen && h.onOpen();
    ws.onmessage = (ev) => h.onMessage && h.onMessage(ev.data);
    ws.onclose = (ev) => h.onClose && h.onClose(ev.code, ev.reason);
    ws.onerror = (e) => h.onError && h.onError(e);
  }

  send(data) { if (this.connected) this.ws.send(data); }
  close() { if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; } }
}

/**
 * A transport with no socket in it.
 *
 * The other end is a plain object with `receive(data)` and a `deliver` callback
 * — a Room being stepped in the same process, a recorded session, a worker.
 * Used by the test harness, and by anything that wants a single-player game
 * without a network stack.
 */
export class LoopbackTransport {
  constructor(peer) { this.peer = peer; this.h = null; this.open = false; }

  get connected() { return this.open; }

  connect(h) {
    this.h = h;
    this.peer.deliver = (data) => h.onMessage && h.onMessage(data);
    this.open = true;
    // Asynchronous, so a caller can wire up listeners after connect() returns
    // and still see the open — same ordering guarantee a real socket gives.
    queueMicrotask(() => { if (this.open && h.onOpen) h.onOpen(); });
  }

  send(data) { if (this.open) this.peer.receive(data); }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.h && this.h.onClose) this.h.onClose(1000, 'loopback closed');
  }
}

/** Where the server is, unless the URL says otherwise. */
export function defaultServerUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q.replace(/^http/, 'ws');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

// --- the connection ---------------------------------------------------------
export class Net extends EventTarget {
  /**
   * @param {object} transport anything matching the transport interface above
   */
  constructor(transport) {
    super();
    this.transport = transport;
    this.open = false;
    this.slot = -1;
    this.code = null;
    this.levelId = null;

    // Snapshot buffer, ordered by tick, trimmed to a second or so of history.
    this.snaps = [];
    this.latest = null;

    // serverClock - performance.now(), smoothed. Render time is derived from
    // this rather than from arrival times, so a burst of three snapshots in one
    // frame does not shove the interpolation cursor forward by three ticks.
    this.offset = null;
    this.rtt = 0;

    this.inputSeq = 1;
    this.w = new Writer(32);
    this._msgs = 0;
    this._bytes = 0;
  }

  get connected() { return this.open && this.transport.connected; }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  connect() {
    this.transport.connect({
      onOpen: () => { this.open = true; this.emit('open'); },
      onMessage: (data) => this.onMessage(data),
      onClose: (code, reason) => { this.open = false; this.emit('close', { code, reason }); },
      onError: (e) => this.emit('error', { error: e }),
    });
  }

  close() { this.transport.close(); }

  // --- inbound --------------------------------------------------------------
  onMessage(data) {
    this._msgs++;
    if (typeof data === 'string') {
      this._bytes += data.length;
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      this.onControl(msg);
      return;
    }

    const buf = data instanceof ArrayBuffer ? data : data.buffer.slice(
      data.byteOffset, data.byteOffset + data.byteLength,
    );
    this._bytes += buf.byteLength;
    const kind = new Uint8Array(buf)[0];

    if (kind === MSG.SNAPSHOT) {
      const snap = decodeSnapshot(buf);
      if (snap) this.pushSnapshot(snap);
      return;
    }

    if (kind === MSG.LEVEL) {
      // The server sends the static build once on join. The client already has
      // the level — it imports shared/levels/ directly, which is the only way
      // prediction can agree with the server about a wall — so this is only
      // ever a hint about WHICH level. Accept a JSON body if that is what it
      // turns out to be, and otherwise hand the bytes to whoever wants them.
      const body = new TextDecoder().decode(new Uint8Array(buf, 1));
      try {
        const parsed = JSON.parse(body);
        if (parsed && parsed.id) this.levelId = parsed.id;
        this.emit('level', parsed);
      } catch {
        this.emit('level', { raw: buf });
      }
      return;
    }

    this.emit('binary', { kind, buf });
  }

  /**
   * Control traffic is JSON, and the client is deliberately lenient about it.
   *
   * The messages it acts on:
   *   { t:'joined', slot, code, levelId, phase, endsAt?, players?[] }
   *   { t:'phase',  phase, endsAt? }
   *   { t:'state',  banked?, breakages?, tasks?[], endsAt?, players?[] }
   *   { t:'events', events:[{ type, detail }] }  (or a bare { t:<eventType> })
   *   { t:'error',  message }
   *   { t:'pong',   c, s }
   *
   * Anything else is re-emitted under its own `t` so the HUD can pick it up
   * without this file needing to know the whole vocabulary.
   */
  onControl(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'pong') {
      this.rtt = performance.now() - msg.c;
      if (typeof msg.s === 'number') this.offset = msg.s - performance.now();
      return;
    }
    if (msg.t === 'joined') {
      this.slot = msg.slot;
      this.code = msg.code || this.code;
      this.levelId = msg.levelId || this.levelId;
    }
    if (msg.t === 'events' && Array.isArray(msg.events)) {
      for (const e of msg.events) this.emit('gameevent', e);
    }
    this.emit(msg.t, msg);
  }

  pushSnapshot(snap) {
    snap.recvAt = performance.now();

    // First snapshot sets the clock; after that it is nudged, never jumped, or
    // every hiccup in the network becomes a hiccup in the world.
    const target = snap.now - snap.recvAt;
    if (this.offset === null) this.offset = target;
    else {
      const drift = clockDelta(snap.now, this.offset + snap.recvAt);
      // Snap forward hard (we are behind and about to run out of buffer), ease
      // backward gently (we are early, and being early is survivable).
      this.offset += drift > 250 || drift < -600 ? drift : drift * 0.08;
    }

    // Out-of-order arrivals are possible on any transport that is not TCP;
    // insert by tick rather than assuming.
    const at = this.snaps.length && this.snaps[this.snaps.length - 1].tick > snap.tick
      ? this.snaps.findIndex((s) => s.tick > snap.tick)
      : this.snaps.length;
    this.snaps.splice(at < 0 ? this.snaps.length : at, 0, snap);

    this.latest = this.snaps[this.snaps.length - 1];
    while (this.snaps.length > 40) this.snaps.shift();
    this.emit('snapshot', snap);
  }

  /** Server time we should be rendering: now, minus the interpolation buffer. */
  renderTime() {
    if (this.offset === null) return 0;
    return this.offset + performance.now() - INTERP_DELAY_MS;
  }

  /**
   * The pair of snapshots bracketing render time, and where between them we are.
   * Returns null until two have arrived.
   */
  interpolationWindow() {
    if (this.snaps.length === 0) return null;
    const t = this.renderTime();
    let a = null, b = null;
    for (let i = this.snaps.length - 1; i >= 0; i--) {
      if (clockDelta(this.snaps[i].now, t) <= 0) { a = this.snaps[i]; b = this.snaps[i + 1] || null; break; }
    }
    if (!a) {
      // Render time is behind everything we hold — we have just connected, or
      // the clock jumped. Show the oldest thing we have rather than nothing.
      a = this.snaps[0];
      b = this.snaps[1] || null;
    }
    if (!b) return { a, b: a, f: 0 };
    const span = clockDelta(b.now, a.now);
    const f = span > 0 ? Math.min(1, Math.max(0, clockDelta(t, a.now) / span)) : 0;
    return { a, b, f };
  }

  // --- outbound -------------------------------------------------------------
  join(name, code) {
    this.sendJSON({ t: 'join', name, code: code || null });
  }

  start() { this.sendJSON({ t: 'start' }); }

  ping() { this.sendJSON({ t: 'ping', c: performance.now() }); }

  sendJSON(o) { if (this.connected) this.transport.send(JSON.stringify(o)); }

  /**
   * One input packet. Returns the sequence number it went out with, which is
   * what the predictor stores alongside its copy of the input so it knows what
   * to replay when the server echoes a seq back.
   */
  sendInput(moveX, moveY, yaw, pitch, buttons, holdDist) {
    if (!this.connected) return 0;
    const seq = this.inputSeq++;
    this.w.o = 0;
    // Yaw has to be wrapped before it goes near the wire: angw quantises to
    // +/-3.2767 radians and a free-running yaw walks straight out of that range
    // after half a turn, at which point the server clamps and everyone else
    // watches you face a wall for the rest of the shift.
    writeInput(this.w, seq, moveX, moveY, wrapAngle(yaw), clamp(pitch, -1.55, 1.55), buttons, holdDist);
    this.transport.send(this.w.bytes());
    return seq;
  }

  stats() {
    return {
      msgs: this._msgs, bytes: this._bytes, rtt: this.rtt,
      buffered: this.snaps.length, slot: this.slot,
    };
  }
}

export function wrapAngle(a) {
  const t = (a + Math.PI) % (Math.PI * 2);
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Shortest-way-round interpolation, for yaw that has just wrapped. */
export function lerpAngle(a, b, f) { return a + wrapAngle(b - a) * f; }
