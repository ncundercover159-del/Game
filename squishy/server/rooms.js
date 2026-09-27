// Room lifecycle: create / join / reconnect / disconnect grace, plus routing of
// client messages into the room's Session.

import crypto from 'node:crypto';
import { Session } from './game.js';
import { CODE_ALPHABET, GRACE_MS, SIM_HZ } from '../shared/protocol.js';

const WAITING_TTL_MS = 30 * 60 * 1000;

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

class Room {
  constructor(code, pickQuestions) {
    this.code = code;
    this.pickQuestions = pickQuestions;
    this.slots = [null, null]; // { token, ws, connected, goneAt }
    this.session = null;
    this.phase = 'waiting';    // waiting | play | ended
    this.createdAt = Date.now();
    this.acc = 0;
    this.sentMeta = [-1, -1];
  }

  get full() { return this.slots[0] && this.slots[1]; }
  get paused() { return this.phase === 'play' && this.slots.some((s) => !s.connected); }

  attach(slot, ws) {
    const s = this.slots[slot];
    s.ws = ws;
    s.connected = true;
    s.goneAt = 0;
    ws.room = this;
    ws.slot = slot;
    this.sentMeta[slot] = -1;
  }

  start() {
    this.phase = 'play';
    this.session = new Session(this.pickQuestions);
    this.broadcastMeta(true);
  }

  // Advance the simulation by wall-clock `ms` and broadcast state.
  tick(ms, now) {
    if (this.phase !== 'play') return;
    if (this.paused) { this.broadcastMeta(); return; }
    this.acc += ms;
    const stepMs = 1000 / SIM_HZ;
    let steps = 0;
    while (this.acc >= stepMs && steps < 12) {
      this.session.step();
      this.acc -= stepMs;
      steps++;
    }
    if (this.acc > stepMs * 12) this.acc = 0;
    const snap = JSON.stringify(this.session.snapshot(now));
    for (const s of this.slots) if (s.connected && s.ws.readyState === 1) s.ws.send(snap);
    this.broadcastMeta();
  }

  broadcastMeta(force = false) {
    const ver = this.session ? this.session.metaVersion : 0;
    this.slots.forEach((s, i) => {
      if (!s || !s.connected) return;
      const pausedKey = this.pauseKey();
      const key = ver * 100 + pausedKey;
      if (!force && this.sentMeta[i] === key) return;
      this.sentMeta[i] = key;
      send(s.ws, this.metaMsg(i));
    });
  }

  pauseKey() {
    if (!this.paused) return 0;
    const gone = this.slots.find((s) => !s.connected);
    return 1 + Math.max(0, Math.ceil((gone.goneAt + GRACE_MS - Date.now()) / 1000));
  }

  metaMsg(slot) {
    let paused = null;
    if (this.paused) {
      const goneSlot = this.slots.findIndex((s) => !s.connected);
      paused = { slot: goneSlot, left: Math.max(0, Math.ceil((this.slots[goneSlot].goneAt + GRACE_MS - Date.now()) / 1000)) };
    }
    return { t: 'meta', phase: this.phase, code: this.code, you: slot, paused, game: this.session ? this.session.metaFor(slot) : null };
  }
}

export class RoomManager {
  constructor({ pickQuestions }) {
    this.pickQuestions = pickQuestions;
    this.rooms = new Map();
  }

  newCode() {
    for (let tries = 0; tries < 1000; tries++) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('no free room codes');
  }

  handle(ws, msg) {
    switch (msg.t) {
      case 'create': return this.create(ws);
      case 'join': return this.join(ws, String(msg.code || '').toUpperCase().trim());
      case 'resume': return this.resume(ws, String(msg.code || '').toUpperCase().trim(), String(msg.token || ''));
      case 'ping': return send(ws, { t: 'pong', c: msg.c, s: Date.now() });
    }
    const room = ws.room;
    if (!room || room.phase === 'ended') return;
    const sess = room.session;
    switch (msg.t) {
      case 'in': if (sess && Array.isArray(msg.c)) sess.pushInput(ws.slot, msg.c.slice(0, 32)); break;
      case 'pick': if (sess) sess.pick(ws.slot, msg.i); break;
      case 'cont': if (sess) sess.cont(ws.slot); break;
      case 'again':
        if (sess && sess.flags.finale) { sess.reset(); room.broadcastMeta(true); }
        break;
      case 'leave': this.leave(ws); break;
      case 'dbg': if (sess && process.env.SQUISHY_DEBUG === '1') sess.debug(msg); break;
    }
  }

  create(ws) {
    if (ws.room) this.leave(ws);
    const code = this.newCode();
    const room = new Room(code, this.pickQuestions);
    this.rooms.set(code, room);
    const token = crypto.randomBytes(12).toString('hex');
    room.slots[0] = { token, ws, connected: true, goneAt: 0 };
    room.attach(0, ws);
    send(ws, { t: 'joined', code, token, you: 0 });
    send(ws, room.metaMsg(0));
  }

  join(ws, code) {
    const room = this.rooms.get(code);
    if (!room || room.phase === 'ended') return send(ws, { t: 'err', msg: `No room called ${code || '····'} — check the code?` });
    if (room.full) return send(ws, { t: 'err', msg: 'That room already has two squishies.' });
    if (ws.room) this.leave(ws);
    const token = crypto.randomBytes(12).toString('hex');
    const slot = room.slots[0] ? 1 : 0;
    room.slots[slot] = { token, ws, connected: true, goneAt: 0 };
    room.attach(slot, ws);
    send(ws, { t: 'joined', code, token, you: slot });
    if (room.full) room.start();
    else send(ws, room.metaMsg(slot));
  }

  resume(ws, code, token) {
    const room = this.rooms.get(code);
    const slot = room ? room.slots.findIndex((s) => s && s.token === token) : -1;
    if (!room || slot < 0 || room.phase === 'ended') return send(ws, { t: 'gone' });
    const old = room.slots[slot].ws;
    if (old && old !== ws) { old.room = null; try { old.close(); } catch { /* already closed */ } }
    room.attach(slot, ws);
    // a reloaded page restarts its input sequence numbers
    if (room.session) { const inp = room.session.inputs[slot]; inp.queue.length = 0; inp.ack = 0; }
    send(ws, { t: 'joined', code, token, you: slot, resumed: true });
    room.broadcastMeta(true);
  }

  leave(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    const other = room.slots[1 - ws.slot];
    if (other && other.connected) send(other.ws, { t: 'ended', reason: 'left' });
    this.close(room);
  }

  onClose(ws) {
    const room = ws.room;
    if (!room) return;
    const s = room.slots[ws.slot];
    if (!s || s.ws !== ws) return;
    s.connected = false;
    s.goneAt = Date.now();
    room.broadcastMeta(true);
  }

  close(room) {
    room.phase = 'ended';
    for (const s of room.slots) if (s && s.ws) s.ws.room = null;
    this.rooms.delete(room.code);
  }

  tick(ms) {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      const gone = room.slots.filter((s) => s && !s.connected);
      if (gone.some((s) => now - s.goneAt > GRACE_MS)) {
        for (const s of room.slots) if (s && s.connected) send(s.ws, { t: 'ended', reason: 'timeout' });
        this.close(room);
        continue;
      }
      if (room.phase === 'waiting' && now - room.createdAt > WAITING_TTL_MS) {
        for (const s of room.slots) if (s && s.connected) send(s.ws, { t: 'ended', reason: 'expired' });
        this.close(room);
        continue;
      }
      room.tick(ms, now);
    }
  }
}
