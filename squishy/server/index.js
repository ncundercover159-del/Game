// SQUISHY multiplayer server: static file host for the built client, the
// WebSocket endpoint at /ws, the fixed-rate tick loop, and the trivia pool.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from './rooms.js';
import { TICK_HZ } from '../shared/protocol.js';

const PORT = Number(process.env.PORT) || 8787;
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

// ---- trivia pool ---------------------------------------------------------------
// The first answer is the correct one; the server shuffles options per gate.

export const TRIVIA = [
  { q: 'What does walking through a torii gate traditionally mark?',
    a: ['Stepping into a sacred space', 'The start of a market street', 'Crossing into a new year'],
    fact: 'A torii marks the boundary between the everyday world and the home of a kami. Many people bow before passing through.' },
  { q: 'In Japanese legend, a koi that swims up a waterfall becomes…',
    a: ['A dragon', 'A crane', 'A golden turtle'],
    fact: 'The koi that climbs the Dragon Gate waterfall becomes a dragon — which is why koi stand for perseverance, and why koinobori streamers fly on Children’s Day.' },
  { q: 'What is the custom of picnicking under cherry blossoms called?',
    a: ['Hanami', 'Tsukimi', 'Omiai'],
    fact: 'Hanami means “flower viewing”. Friends and families gather under the sakura each spring — even at night, which is called yozakura.' },
  { q: 'Going out to admire red autumn maple leaves is called…',
    a: ['Momijigari', 'Hanabi', 'Omikuji'],
    fact: 'Momijigari literally means “red-leaf hunting” — but the only thing you take home is the view.' },
  { q: 'What are the lion-dog statues guarding shrine entrances called?',
    a: ['Komainu', 'Kitsune', 'Tanuki'],
    fact: 'Komainu usually come in pairs: one with its mouth open (“a”) and one closed (“un”) — the first and last sounds, together meaning everything.' },
  { q: 'Fox statues at many shrines are messengers of which kami?',
    a: ['Inari', 'Raijin', 'Susanoo'],
    fact: 'Inari is the kami of rice and prosperity. Fushimi Inari in Kyoto has thousands of vermilion torii donated by grateful visitors.' },
  { q: 'At a shrine, what is an omikuji?',
    a: ['A paper fortune slip', 'A sweet rice cake', 'A bell rope'],
    fact: 'If your omikuji is unlucky, you can tie it to a rack or tree at the shrine and leave the bad luck behind.' },
  { q: 'What are the small wooden plaques visitors write wishes on?',
    a: ['Ema', 'Noren', 'Furoshiki'],
    fact: 'Ema often have a horse painted on them — long ago, people offered real horses to the kami.' },
  { q: 'At the shrine water basin (temizuya), what do you do?',
    a: ['Rinse your hands and mouth', 'Drink straight from the ladle', 'Toss in a coin for luck'],
    fact: 'Left hand first, then right, then a little water cupped in your hand for your mouth — a small act of purification before greeting the kami.' },
  { q: 'On Tanabata, people hang wishes written on paper strips from…',
    a: ['Bamboo branches', 'Paper lanterns', 'Pine trees'],
    fact: 'Tanabata celebrates the stars Orihime and Hikoboshi (Vega and Altair), who may meet only once a year across the Milky Way.' },
  { q: 'Which summer festival welcomes the spirits of ancestors home?',
    a: ['Obon', 'Setsubun', 'Shichi-Go-San'],
    fact: 'During Obon, families light lanterns to guide spirits home, and dance the Bon Odori together in the evenings.' },
  { q: 'On Setsubun, what do people throw to chase away oni (demons)?',
    a: ['Roasted soybeans', 'Rice grains', 'Cherry petals'],
    fact: 'People shout “Oni wa soto! Fuku wa uchi!” — “Demons out! Luck in!” — then eat one bean for each year of their age.' },
  { q: 'Mochi is made by pounding which ingredient?',
    a: ['Steamed glutinous rice', 'Wheat flour', 'Mashed sweet potato'],
    fact: 'Pounding mochi (mochitsuki) is a team effort: one person swings the mallet while the other turns the rice — very squishy, very co-op.' },
  { q: 'What does the thick straw rope (shimenawa) at a shrine mark?',
    a: ['A sacred boundary', 'The path to the exit', 'The age of the shrine'],
    fact: 'The zig-zag white paper strips hanging from shimenawa are called shide.' },
  { q: 'What is the usual way to pray at a Shinto shrine?',
    a: ['Bow twice, clap twice, bow once', 'Clap three times, then bow', 'Bow once and ring a gong'],
    fact: 'Ni-rei, ni-hakushu, ichi-rei: two bows, two claps, one bow. Some shrines, like Izumo Taisha, use four claps.' },
  { q: 'What is the tallest mountain in Japan?',
    a: ['Mount Fuji', 'Mount Takao', 'Mount Aso'],
    fact: 'Fuji-san stands 3,776 m tall and is itself considered sacred — there is a shrine at its summit.' },
  { q: 'Which glowing insect lights up early-summer riversides in Japan?',
    a: ['Hotaru — the firefly', 'Semi — the cicada', 'Tonbo — the dragonfly'],
    fact: 'Hotaru-gari, “firefly hunting”, is a gentle summer evening outing — the fireflies are only watched, never kept.' },
  { q: 'Kyoto’s most famous bamboo grove is in which district?',
    a: ['Arashiyama', 'Akihabara', 'Ginza'],
    fact: 'The sound of the wind in Arashiyama’s bamboo was chosen as one of Japan’s “100 soundscapes to preserve”.' },
  { q: 'The idea of “wabi-sabi” finds beauty in…',
    a: ['Imperfection and impermanence', 'Perfect symmetry', 'Bright, bold colours'],
    fact: 'A cracked tea bowl mended with gold — kintsugi — is a lovely example of wabi-sabi thinking.' },
  { q: 'The loud buzzing of semi (cicadas) is the sound of which season?',
    a: ['Summer', 'Winter', 'Spring'],
    fact: 'In haiku, cicadas are a classic seasonal word (kigo) for summer — Bashō wrote a famous one about their voices sinking into the rocks.' },
];

function pickQuestions(n) {
  const idx = TRIVIA.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => TRIVIA[i]);
}

// ---- static files ---------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('SQUISHY server is running. Build the client with `npm run build`, or use `npm run dev`.');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ---- boot ---------------------------------------------------------------------

export function startServer(port = PORT) {
  const rooms = new RoomManager({ pickQuestions });
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

  wss.on('connection', (ws) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg && typeof msg.t === 'string') rooms.handle(ws, msg);
    });
    ws.on('close', () => rooms.onClose(ws));
  });

  // Drop connections that stop answering pings so the partner gets the
  // reconnect prompt promptly instead of waiting on a TCP timeout.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 5000);

  let last = performance.now();
  const loop = setInterval(() => {
    const now = performance.now();
    rooms.tick(now - last);
    last = now;
  }, 1000 / TICK_HZ);

  server.listen(port, () => console.log(`SQUISHY server on http://localhost:${port} (ws: /ws)`));
  server.on('close', () => { clearInterval(loop); clearInterval(heartbeat); });
  return { server, wss, rooms };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
