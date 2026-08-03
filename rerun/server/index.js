// RERUN — server. Node + ws, plain WebSockets, rooms in a Map, no database.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

import { Room, MIN_PLAYERS } from './room.js';
import { makeCode } from './codes.js';
import {
  PHASE, TICK_MS, ROOM_IDLE_MS, MAX_PLAYERS, RECONNECT_MS,
} from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(__dirname, '../client/dist');

/** @type {Map<string, Room>} */
const rooms = new Map();

// ---------------------------------------------------------------- http ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      rooms: rooms.size,
      players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0),
      uptime: Math.round(process.uptime()),
    }));
    return;
  }

  // Optional: serve the built client from the same service. Handy for a
  // one-box deploy; ignored entirely if you host the client on Netlify.
  if (!fs.existsSync(DIST)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('RERUN server. Client is hosted separately.\n');
    return;
  }

  let p = decodeURIComponent(url.pathname);
  if (p === '/' || !path.extname(p)) p = '/index.html';
  const file = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST)) {
    res.writeHead(403); res.end(); return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(buf);
  });
});

// ----------------------------------------------------------------- ws -----
const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: {
    threshold: 1024, // the late-join archive burst is what this is for
    zlibDeflateOptions: { level: 6 },
  },
  maxPayload: 1 << 20,
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.ctx = { room: null, playerId: null };
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    try { handle(ws, msg); } catch (err) {
      console.error('handler error', err);
    }
  });

  ws.on('close', () => {
    const { room, playerId } = ws.ctx;
    if (!room || !playerId) return;
    const p = room.players.get(playerId);
    if (!p || p.ws !== ws) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    p.input = { x: 0, y: 0, jump: false };
    if (room.hostId === playerId) room.promoteHost();
    room.broadcastRoom();
  });
});

function fail(ws, message) {
  try { ws.send(JSON.stringify({ t: 'error', message })); } catch { /* gone */ }
}

function handle(ws, msg) {
  switch (msg.t) {
    case 'ping':
      // Clock sync. The client measures RTT and derives the server offset.
      ws.send(JSON.stringify({ t: 'pong', c: msg.c, now: Date.now() }));
      return;

    case 'create': {
      const code = makeCode(rooms);
      const room = new Room(code);
      rooms.set(code, room);
      joinRoom(ws, room, msg.name, null);
      return;
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return fail(ws, 'NO ROOM WITH THAT CODE');
      joinRoom(ws, room, msg.name, msg.playerId || null);
      return;
    }

    case 'input': {
      const { room, playerId } = ws.ctx;
      if (!room) return;
      const p = room.players.get(playerId);
      if (!p) return;
      const s = msg.s || [0, 0];
      p.input.x = clamp(Number(s[0]) || 0, -1, 1);
      p.input.y = clamp(Number(s[1]) || 0, -1, 1);
      p.input.jump = !!msg.j;
      room.lastActivity = Date.now();
      return;
    }

    case 'start': {
      const { room, playerId } = ws.ctx;
      if (!room || room.hostId !== playerId) return;
      if (!room.canStart()) return fail(ws, `NEED ${MIN_PLAYERS} PLAYERS`);
      room.startMatch();
      room.broadcastRoom();
      return;
    }

    case 'again': {
      const { room, playerId } = ws.ctx;
      if (!room || room.hostId !== playerId) return;
      if (room.phase !== PHASE.RESULTS) return;
      room.returnToLobby();
      return;
    }

    case 'leave': {
      const { room, playerId } = ws.ctx;
      if (!room) return;
      room.removePlayer(playerId);
      room.broadcastRoom();
      ws.ctx = { room: null, playerId: null };
      return;
    }

    default:
      return;
  }
}

function joinRoom(ws, room, name, resumeId) {
  // Reconnect within the window resumes the same player — and their ghosts,
  // which have been running the whole time without them.
  if (resumeId && room.players.has(resumeId)) {
    const p = room.players.get(resumeId);
    if (p.ws && p.ws !== ws && p.ws.readyState === 1) {
      try { p.ws.close(4001, 'replaced'); } catch { /* gone */ }
    }
    p.ws = ws;
    p.connected = true;
    p.disconnectedAt = 0;
    if (name) p.name = String(name).slice(0, 10).toUpperCase();
    ws.ctx = { room, playerId: p.id };
    if (!room.hostId || !room.players.get(room.hostId)?.connected) room.promoteHost();
    sendWelcome(ws, room, p, true);
    return;
  }

  if (room.players.size >= MAX_PLAYERS) return fail(ws, 'ROOM IS FULL');

  const id = randomUUID();
  const p = room.addPlayer(id, name, ws);
  if (!p) return fail(ws, 'ROOM IS FULL');
  ws.ctx = { room, playerId: id };
  sendWelcome(ws, room, p, false);
}

function sendWelcome(ws, room, p, resumed) {
  ws.send(JSON.stringify({
    t: 'joined',
    playerId: p.id,
    slot: p.slot,
    code: room.code,
    resumed,
    late: p.late,
    now: Date.now(),
  }));
  room.broadcastRoom();
  ws.send(JSON.stringify(room.phasePayload()));
  room.sendArchive(p);
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// --------------------------------------------------------------- loops ----
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    try { room.tick(now); } catch (err) { console.error('tick error', room.code, err); }
  }
}, TICK_MS);

// Rooms expire after 10 idle minutes. No database, nothing to clean up.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = [...room.players.values()].some(
      (p) => p.connected || now - p.disconnectedAt < RECONNECT_MS,
    );
    if (anyone) room.lastActivity = now;
    if (now - room.lastActivity > ROOM_IDLE_MS) {
      for (const p of room.players.values()) {
        try { p.ws && p.ws.close(4002, 'room expired'); } catch { /* gone */ }
      }
      rooms.delete(code);
      console.log(`room ${code} expired`);
    }
  }
}, 30_000);

// Drop sockets that stopped answering.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* gone */ }
  }
}, 15_000);


server.listen(PORT, () => {
  console.log(`RERUN server on :${PORT}  (min players: ${MIN_PLAYERS})`);
  if (fs.existsSync(DIST)) console.log(`serving client from ${DIST}`);
});
