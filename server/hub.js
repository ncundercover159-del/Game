// Room registry + fixed-rate tick loop + connection handling.
import { SIM, NET } from '../shared/config.js';
import { Room } from './room.js';
import { makeRoomCode, PROTOCOL_VERSION, sanitizeName } from '../shared/net/protocol.js';

export class Hub {
  constructor({ log = console.log } = {}) {
    this.rooms = new Map();
    this.byToken = new Map(); // token -> { room, player }
    this.log = log;
    this.tickMs = 1000 / SIM.hz;
    this.stats = { ticks: 0, stepMs: 0, maxStepMs: 0 };
  }

  start() {
    let next = performance.now();
    const loop = () => {
      const now = performance.now();
      let steps = 0;
      while (now >= next && steps < 4) {
        const t0 = performance.now();
        this.update(1 / SIM.hz);
        const ms = performance.now() - t0;
        this.stats.ticks++;
        this.stats.stepMs = this.stats.stepMs * 0.98 + ms * 0.02;
        this.stats.maxStepMs = Math.max(this.stats.maxStepMs * 0.999, ms);
        next += this.tickMs;
        steps++;
      }
      if (now - next > 250) next = now; // fell far behind: don't spiral
      this.timer = setTimeout(loop, Math.max(0, next - performance.now()));
    };
    loop();
  }

  stop() { clearTimeout(this.timer); }

  update(dt) {
    for (const [code, room] of this.rooms) {
      room.update(dt);
      const anyone = [...room.players.values()].some((p) => p.connected);
      if (anyone) room.emptySince = 0;
      else if (!room.emptySince) room.emptySince = Date.now();
      else if (Date.now() - room.emptySince > NET.reconnectGrace * 1000) {
        this.rooms.delete(code);
        this.log(`[hub] room ${code} closed (empty)`);
      }
    }
  }

  newCode() {
    let code;
    do code = makeRoomCode(); while (this.rooms.has(code));
    return code;
  }

  createRoom(isPublic = false) {
    const room = new Room(this.newCode(), { isPublic, log: this.log });
    this.rooms.set(room.code, room);
    return room;
  }

  publicRooms() {
    return [...this.rooms.values()]
      .filter((r) => r.isPublic)
      .map((r) => ({ code: r.code, players: r.humanCount, phase: r.phase }));
  }

  // A connection: `send(obj|string)` + message handler returned to the transport.
  connect(sendRaw) {
    const conn = { room: null, player: null };
    const send = (m, raw) => sendRaw(raw && typeof m === 'string' ? m : JSON.stringify(m));
    const join = (room, name, token) => {
      const player = room.addPlayer({ name, send, token });
      if (!player) return send({ type: 'error', code: 'full', message: 'That room is full.' });
      conn.room = room; conn.player = player;
      this.byToken.set(player.token, { room, player });
      send({ type: 'welcome', id: player.id, token: player.token, code: room.code, v: PROTOCOL_VERSION });
      room.broadcastRoom();
    };
    const handle = (m) => {
      if (!m || typeof m !== 'object') return;
      if (conn.room && conn.player && !['create', 'join', 'quick', 'hello', 'leave'].includes(m.type)) {
        return conn.room.onMessage(conn.player.id, m);
      }
      switch (m.type) {
        case 'hello': {
          // reconnect with a token within the grace period
          const rec = m.token && this.byToken.get(m.token);
          if (rec && this.rooms.get(rec.room.code) === rec.room && rec.room.players.get(rec.player.id)) {
            conn.room = rec.room; conn.player = rec.player;
            send({ type: 'welcome', id: rec.player.id, token: rec.player.token, code: rec.room.code, v: PROTOCOL_VERSION, resumed: true });
            rec.room.reconnect(rec.player, send);
          } else send({ type: 'hello', v: PROTOCOL_VERSION, rooms: this.publicRooms() });
          return undefined;
        }
        case 'create': return join(this.createRoom(!!m.public), sanitizeName(m.name));
        case 'join': {
          const room = this.rooms.get(String(m.code || '').toUpperCase().trim());
          if (!room) return send({ type: 'error', code: 'noroom', message: 'No room with that code.' });
          return join(room, sanitizeName(m.name));
        }
        case 'quick': {
          let room = [...this.rooms.values()].find((r) => r.isPublic && r.phase === 'lobby' && r.humanCount < 12);
          if (!room) room = this.createRoom(true);
          return join(room, sanitizeName(m.name));
        }
        case 'leave':
          if (conn.room && conn.player) { conn.room.removePlayer(conn.player.id); this.byToken.delete(conn.player.token); }
          conn.room = null; conn.player = null;
          return undefined;
        default: return undefined;
      }
    };
    const close = () => {
      if (conn.room && conn.player) conn.room.disconnect(conn.player.id);
    };
    return { handle, close, conn };
  }
}
