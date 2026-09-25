// SkyKart game server: WebSocket rooms + authoritative simulation, a tiny
// JSON API (health, public rooms, ghost sharing) and static hosting of the
// built client (dist/) so one command serves LAN play.
//   PORT=8787 node server/index.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadNodeData } from '../shared/data/nodeLoader.js';
import { Hub } from './hub.js';
import { GhostStore } from './ghosts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '../dist');
const PORT = +(process.env.PORT || 8787);

loadNodeData();
const hub = new Hub();
hub.start();
const ghosts = new GhostStore(path.join(here, 'data/ghosts.json'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, rooms: hub.rooms.size, stepMs: +hub.stats.stepMs.toFixed(3), maxStepMs: +hub.stats.maxStepMs.toFixed(3) });
  }
  if (url.pathname === '/api/rooms') return json(res, 200, hub.publicRooms());
  if (url.pathname === '/api/ghosts' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const code = ghosts.put(body);
      return json(res, 200, { code });
    } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
  }
  if (url.pathname.startsWith('/api/ghosts/')) {
    const g = ghosts.get(url.pathname.split('/').pop());
    return g ? json(res, 200, g) : json(res, 404, { error: 'not found' });
  }
  // static client
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (!fs.existsSync(DIST)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('SkyKart server running. Build the client with `npm run build` to serve it from here, or use `npm run dev`.'); }
    file = path.join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 512 }, maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  const { handle, close } = hub.connect((s) => { if (ws.readyState === 1) ws.send(s); });
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    handle(m);
  });
  ws.on('close', close);
  ws.on('error', close);
});

server.listen(PORT, () => {
  console.log(`SkyKart server on http://localhost:${PORT}  (ws path /ws)`);
});

export { hub, server };
