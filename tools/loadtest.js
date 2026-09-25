// Headless load test: N bot clients join one room over real WebSockets and
// race with noisy steering. Reports snapshot rate/size and server tick cost.
//   node tools/loadtest.js [--url ws://localhost:8787/ws] [--clients 12] [--seconds 30]
import WebSocket from 'ws';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'ws://localhost:8787/ws');
const N = +arg('clients', 12);
const SECONDS = +arg('seconds', 30);
const httpBase = URL.replace(/^ws/, 'http').replace(/\/ws$/, '');

const stats = { snaps: 0, bytes: 0, starts: 0, results: 0, errors: 0 };
let code = null;
const clients = [];

function bot(i) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { ws, seq: 0, racing: false, id: null };
    ws.on('open', () => {
      if (i === 0) ws.send(JSON.stringify({ type: 'create', name: 'Load0' }));
      else ws.send(JSON.stringify({ type: 'join', name: 'Load' + i, code }));
    });
    ws.on('message', (data) => {
      const s = data.toString();
      const m = JSON.parse(s);
      if (m.type === 'welcome') {
        c.id = m.id;
        if (i === 0) { code = m.code; resolve(c); }
        ws.send(JSON.stringify({ type: 'pick', racerId: ['draxo', 'gobbles', 'gillby', 'boltz', 'grimchain', 'cinder', 'sprout', 'bouldar'][i % 8] }));
        if (i !== 0) resolve(c);
      } else if (m.type === 'start') { stats.starts++; c.racing = true; }
      else if (m.type === 's') { stats.snaps++; stats.bytes += s.length; }
      else if (m.type === 'results') stats.results++;
      else if (m.type === 'error') { stats.errors++; console.log('error', m.message); }
    });
    ws.on('error', (e) => { stats.errors++; console.log('ws error', e.message); resolve(c); });
    c.timer = setInterval(() => {
      if (!c.racing || ws.readyState !== 1) return;
      const f = [];
      for (let k = 0; k < 2; k++) {
        c.seq++;
        const steer = Math.round(Math.sin(c.seq / 40 + i) * 90);
        f.push([c.seq, steer, 1 | (c.seq % 120 < 40 ? 4 : 0) | (c.seq % 200 === 0 ? 8 : 0)]);
      }
      ws.send(JSON.stringify({ type: 'i', f }));
    }, 1000 / 30);
    clients.push(c);
  });
}

const t0 = Date.now();
await bot(0);
console.log(`room ${code}`);
for (let i = 1; i < N; i++) await bot(i);
clients[0].ws.send(JSON.stringify({ type: 'settings', trackId: 'sky_cloudtop', laps: 1 }));
clients[0].ws.send(JSON.stringify({ type: 'start' }));
await new Promise((r) => setTimeout(r, SECONDS * 1000));
const health = await fetch(`${httpBase}/api/health`).then((r) => r.json()).catch(() => null);
const secs = (Date.now() - t0) / 1000;
console.log(JSON.stringify({
  clients: N, seconds: +secs.toFixed(1), starts: stats.starts, results: stats.results, errors: stats.errors,
  snapshotsPerClientPerSec: +(stats.snaps / N / SECONDS).toFixed(1),
  avgSnapshotBytes: Math.round(stats.bytes / Math.max(1, stats.snaps)),
  kbPerSecPerClient: +((stats.bytes / N / SECONDS) / 1024).toFixed(1),
  server: health,
}, null, 2));
for (const c of clients) { clearInterval(c.timer); c.ws.close(); }
process.exit(0);
