// End-to-end smoke test of the server: two WebSocket clients create/join a
// room, move, disconnect/reconnect; plus a direct Session test that walks a
// trivia gate, the springboard and the bell finale.
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer, TRIVIA } from '../server/index.js';
import { Session } from '../server/game.js';
import { GATES, BELL, TERRACE, PLATES } from '../shared/level.js';
import { EV } from '../shared/physics.js';

const PORT = 18787;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { ws, msgs: [], snaps: [], metas: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 's') c.snaps.push(m); else if (m.t === 'meta') c.metas.push(m); else c.msgs.push(m);
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.send = (m) => ws.send(JSON.stringify(m));
  c.wait = async (pred, ms = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = [...c.msgs, ...c.metas].find(pred);
      if (hit) return hit;
      await sleep(20);
    }
    throw new Error('timeout waiting for message');
  };
  return c;
}

async function netTest() {
  const { server } = startServer(PORT);
  await sleep(100);
  const a = client(), b = client();
  await a.open; await b.open;

  a.send({ t: 'create' });
  const created = await a.wait((m) => m.t === 'joined');
  assert.match(created.code, /^[A-Z]{4}$/);
  await a.wait((m) => m.t === 'meta' && m.phase === 'waiting');

  b.send({ t: 'join', code: 'ZZZZ' });
  await b.wait((m) => m.t === 'err');
  b.send({ t: 'join', code: created.code.toLowerCase() });
  const joined = await b.wait((m) => m.t === 'joined');
  assert.equal(joined.you, 1);
  const metaA = await a.wait((m) => m.t === 'meta' && m.phase === 'play');
  const metaB = await b.wait((m) => m.t === 'meta' && m.phase === 'play');
  assert.equal(metaA.game.seed, metaB.game.seed, 'shared seed');

  // player B walks north for half a second
  let seq = 0;
  const startZ = (await (async () => { await sleep(120); return b.snaps.at(-1).p[1][2]; })());
  for (let i = 0; i < 10; i++) {
    b.send({ t: 'in', c: [1, 2, 3].map(() => [++seq, 0, 1, 0]) });
    await sleep(50);
  }
  await sleep(150);
  const last = b.snaps.at(-1);
  assert.ok(last.p[1][2] > startZ + 1, `player moved (${startZ} -> ${last.p[1][2]})`);
  assert.equal(last.p[1][9], seq, 'server acked all inputs');
  assert.ok(Math.abs(a.snaps.at(-1).p[1][2] - last.p[1][2]) < 0.5, 'both clients see the same world');

  // third player can't join
  const c = client(); await c.open;
  c.send({ t: 'join', code: created.code });
  await c.wait((m) => m.t === 'err');
  c.ws.close();

  // disconnect -> pause -> resume with token
  b.ws.close();
  const paused = await a.wait((m) => m.t === 'meta' && m.paused && m.paused.slot === 1);
  assert.ok(paused.paused.left <= 30);
  const b2 = client(); await b2.open;
  a.metas.length = 0;
  b2.send({ t: 'resume', code: created.code, token: joined.token });
  const re = await b2.wait((m) => m.t === 'joined');
  assert.equal(re.resumed, true);
  await a.wait((m) => m.t === 'meta' && m.paused === null);

  // leaving tells the partner
  b2.send({ t: 'leave' });
  await a.wait((m) => m.t === 'ended');
  a.ws.close(); b2.ws.close();
  server.close();
  console.log('✓ network: create/join/input/ack/full-room/pause/resume/leave');
}

function sessionTest() {
  const s = new Session((n) => TRIVIA.slice(0, n));
  const run = (n) => { for (let i = 0; i < n; i++) s.step(); };
  const [p0, p1] = s.players;

  // trivia gate 1
  Object.assign(p0, { x: -1, z: GATES.tg1.z - 2, y: 0 });
  Object.assign(p1, { x: 1, z: GATES.tg1.z - 2, y: 0 });
  run(3);
  assert.ok(s.trivia, 'trivia starts when both arrive');
  const correct = s.trivia.correct;
  const wrong = (correct + 1) % 3;
  s.pick(0, correct); s.pick(1, wrong);
  assert.equal(s.trivia.phase, 'reveal');
  run(120);
  assert.equal(s.trivia.phase, 'retry');
  assert.equal(s.trivia.outcome, 'disagree');
  run(200);
  assert.equal(s.trivia.phase, 'ask');
  assert.equal(s.trivia.attempt, 2);
  s.pick(0, wrong); s.pick(1, wrong);
  run(120);
  assert.equal(s.trivia.outcome, 'gentle', 'second miss still opens the gate');
  s.cont(0); s.cont(1);
  assert.equal(s.trivia, null);
  assert.equal(s.flags.trivia[0], true);
  run(200);
  assert.ok(s.w.open.tg1 > 0.9, 'gate opens');

  // forest switches must be squished together
  Object.assign(p0, { x: PLATES.f1.x, z: PLATES.f1.z, y: 0 });
  Object.assign(p1, { x: 0, z: PLATES.f1.z, y: 0 });
  s.pushInput(0, [[5000, 0, 0, 1]]);
  s.pushInput(1, [[5000, 0, 0, 0]]);
  run(60);
  assert.equal(s.flags.forest, false, 'one switch alone does nothing');
  Object.assign(p1, { x: PLATES.f2.x, z: PLATES.f2.z, y: 0 });
  s.pushInput(1, [[5001, 0, 0, 1]]);
  run(2);
  assert.equal(s.flags.forest, true, 'both switches open the forest gate');

  // springboard: p1 squishes by the terrace wall, p0 rolls onto them
  Object.assign(p1, { x: 0, z: TERRACE.z0 - 0.6, y: 0, vx: 0, vy: 0, vz: 0 });
  Object.assign(p0, { x: 0, z: TERRACE.z0 - 3.5, y: 0, vx: 0, vy: 0, vz: 0 });
  let sprung = false;
  for (let i = 0; i < 240; i++) {
    s.pushInput(1, [[10000 + i, 0, 1, 1]]);
    s.pushInput(0, [[10000 + i, 0, 1, 0]]);
    s.step();
    if (p0.ev & EV.SPRING) sprung = true;
  }
  assert.ok(sprung, 'springboard launches');
  assert.ok(p0.y > TERRACE.h - 0.01, `landed on the terrace (y=${p0.y.toFixed(2)})`);

  // bell finale needs both squishes within the window
  s.flags.trivia = [true, true, true];
  Object.assign(p0, { x: -1, z: BELL.z, y: TERRACE.h, g: 1 });
  Object.assign(p1, { x: 1, z: BELL.z, y: TERRACE.h, g: 1 });
  s.pushInput(0, [[20000, 0, 0, 0], [20001, 0, 0, 1]]);
  s.pushInput(1, [[20000, 0, 0, 0], [20001, 0, 0, 0]]);
  run(2);
  assert.equal(s.flags.finale, false, 'one squish is not enough');
  s.pushInput(1, [[20002, 0, 0, 1]]);
  run(1);
  assert.equal(s.flags.finale, true, 'bell rings when both squish together');
  assert.ok(s.finaleInfo.dur >= 0);

  // play again re-rolls and resets
  const oldSeason = s.season;
  s.reset();
  assert.equal(s.flags.finale, false);
  assert.notEqual(s.season, oldSeason, 'season alternates on replay');
  assert.ok(s.players[0].z < 10, 'back at the entrance');
  console.log('✓ session: trivia retry/gentle, springboard, bell finale, replay');
}

sessionTest();
await netTest();
process.exit(0);
