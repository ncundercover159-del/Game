// RERUN — solo transport.
//
// The Artifact sandbox blocks every outbound connection, so there is no
// server to talk to. Instead the real server Room runs in this tab behind a
// loopback socket, and the client can't tell the difference: same phase
// machine, same recordings, same plate authority, same wire messages.
//
// One player, six rounds, five past selves by the end. Which is the whole
// game — you were always cooperating with yourself.

import { Room } from '../../server/room.js';
import { TICK_MS } from '../../shared/constants.js';
import { decodeGhosts } from '../../shared/ghostbuf.js';

const CODE = 'SOLO';

export class Net extends EventTarget {
  constructor() {
    super();
    this.open = false;
    this.playerId = null;
    this.slot = 0;
    this.code = CODE;
    this.wantReconnect = false;
    this.rtt = 0;
    this.room = null;
    this.player = null;
    this.timer = 0;
  }

  // Same clock on both ends of a loopback, so there is nothing to sync.
  now() { return Date.now(); }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  connect(then) {
    this.open = true;
    this.emit('open');
    if (then) then();
  }

  /** Stands in for a WebSocket: the Room writes to it exactly as it would a real one. */
  makeSocket() {
    return {
      readyState: 1,
      send: (data) => {
        // Deliver on a microtask so the Room finishes its tick before the
        // client reacts — a real socket never re-enters mid-broadcast either.
        queueMicrotask(() => this.receive(data));
      },
      close: () => {},
    };
  }

  receive(data) {
    if (typeof data !== 'string') {
      const decoded = decodeGhosts(data);
      if (decoded) this.emit('ghosts', decoded);
      return;
    }
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.t === 'joined') {
      this.playerId = msg.playerId;
      this.slot = msg.slot;
      this.code = msg.code;
    }
    this.emit(msg.t, msg);
  }

  create(name) {
    if (this.room) return;
    this.room = new Room(CODE);
    this.player = this.room.addPlayer('solo-player', name || 'YOU', this.makeSocket());

    this.timer = setInterval(() => {
      try {
        this.room.tick(Date.now());
      } catch (err) {
        clearInterval(this.timer);
        this.emit('error', { message: 'THE SIMULATION FELL OVER' });
        throw err;
      }
    }, TICK_MS);

    // Mirror what the server sends a fresh joiner.
    const p = this.player;
    p.ws.send(JSON.stringify({
      t: 'joined', playerId: p.id, slot: p.slot, code: CODE,
      resumed: false, late: false, now: Date.now(),
    }));
    this.room.broadcastRoom();
    p.ws.send(JSON.stringify(this.room.phasePayload()));
    this.room.sendArchive(p);

    // No lobby worth sitting in when there is one of you. Straight to the
    // countdown; the rules were on the screen you just tapped through.
    this.room.startMatch();
  }

  join(_code, name) { this.create(name); }
  resume() {}

  start() { if (this.room) this.room.startMatch(), this.room.broadcastRoom(); }
  again() {
    if (!this.room) return;
    this.room.returnToLobby();
    this.room.startMatch();
  }

  sendInput(stick, jump) {
    if (!this.player) return;
    this.player.input.x = clamp(stick.x, -1, 1);
    this.player.input.y = clamp(stick.y, -1, 1);
    this.player.input.jump = !!jump;
  }

  send() {}
}

function clamp(v, lo, hi) {
  const n = Number(v) || 0;
  return n < lo ? lo : n > hi ? hi : n;
}

// No reconnect story when the server is a variable in this tab.
export function storedSession() { return null; }
export function clearSession() {}
