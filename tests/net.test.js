import { describe, it, expect } from 'vitest';
import './helpers.js';
import { Hub } from '../server/hub.js';
import { KART_FULL, KART_VIEW, encodeKart, decodeKart, sanitizeInput } from '../shared/net/protocol.js';
import { makeRace } from './helpers.js';

function fakeClient(hub) {
  const inbox = [];
  const c = hub.connect((s) => inbox.push(JSON.parse(s)));
  return { ...c, inbox, last: (type) => [...inbox].reverse().find((m) => m.type === type) };
}

describe('protocol', () => {
  it('round-trips kart state through the compact arrays', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    for (let i = 0; i < 120; i++) { race.setInput('a', { steer: 0.3, btn: 1 }); race.step(); }
    const back = decodeKart(JSON.parse(JSON.stringify(encodeKart(k, KART_FULL))), KART_FULL, {});
    for (const f of ['x', 'y', 'z', 'yaw', 'speed', 'hint', 'ribbon', 'grounded', 'surface']) {
      if (typeof k[f] === 'number') expect(back[f]).toBeCloseTo(k[f], 2);
      else expect(back[f]).toEqual(k[f]);
    }
    const view = decodeKart(encodeKart(k, KART_VIEW), KART_VIEW, {});
    expect(view.x).toBeCloseTo(k.x, 2);
  });

  it('sanitises hostile input', () => {
    expect(sanitizeInput('1e9', 99999)).toEqual({ steer: 1, btn: 99999 & 0x1ff });
    expect(sanitizeInput(NaN, 'x')).toEqual({ steer: 0, btn: 0 });
  });
});

describe('server rooms (no sockets)', () => {
  it('creates a room, joins by code, votes, races with bots and snapshots', () => {
    const hub = new Hub({ log: () => {} });
    const a = fakeClient(hub), b = fakeClient(hub);
    a.handle({ type: 'create', name: 'Alice' });
    const code = a.last('welcome').code;
    expect(code).toMatch(/^[A-Z]{4}$/);
    b.handle({ type: 'join', code, name: 'Bob' });
    expect(b.last('welcome').code).toBe(code);
    const room = hub.rooms.get(code);
    expect(room.players.size).toBe(2);
    b.handle({ type: 'pick', racerId: 'gobbles', vehicleId: 'tide_runner' });
    a.handle({ type: 'settings', laps: 1 });
    a.handle({ type: 'ready', ready: true });
    b.handle({ type: 'ready', ready: true });
    expect(room.phase).toBe('vote');
    a.handle({ type: 'vote', trackId: 'sky_cloudtop' });
    b.handle({ type: 'vote', trackId: 'sky_cloudtop' });
    for (let i = 0; i < 90; i++) hub.update(1 / 60);
    expect(room.phase).toBe('race');
    const start = a.last('start');
    expect(start.entrants.length).toBe(12);
    expect(start.trackId).toBe('sky_cloudtop');
    // send inputs and run 5 seconds
    let seq = 0;
    for (let i = 0; i < 300; i++) {
      seq++;
      a.handle({ type: 'i', f: [[seq, 0, 1]] });
      hub.update(1 / 60);
    }
    const snap = a.last('s');
    expect(snap).toBeTruthy();
    expect(snap.k.length).toBe(12);
    expect(snap.a).toBeGreaterThan(200);
    expect(snap.me.length).toBe(KART_FULL.length);
    // disconnect -> bot takes over; reconnect restores control
    b.close();
    const kb = room.race.kart(room.order[1]);
    expect(kb.human).toBe(false);
    const b2 = fakeClient(hub);
    b2.handle({ type: 'hello', token: b.last('welcome').token });
    expect(b2.last('welcome').resumed).toBe(true);
    expect(b2.last('start')).toBeTruthy();
    expect(kb.human).toBe(true);
  });

  it('quick match puts players into the same public room', () => {
    const hub = new Hub({ log: () => {} });
    const a = fakeClient(hub), b = fakeClient(hub);
    a.handle({ type: 'quick', name: 'A' });
    b.handle({ type: 'quick', name: 'B' });
    expect(a.last('welcome').code).toBe(b.last('welcome').code);
    expect(hub.publicRooms().length).toBe(1);
  });

  it('a 12-human room steps well within the tick budget', () => {
    const hub = new Hub({ log: () => {} });
    const clients = Array.from({ length: 12 }, () => fakeClient(hub));
    clients[0].handle({ type: 'create', name: 'H' });
    const code = clients[0].last('welcome').code;
    clients.slice(1).forEach((c, i) => c.handle({ type: 'join', code, name: 'P' + i }));
    const room = hub.rooms.get(code);
    room.settings.trackId = 'sky_cloudtop';
    room.startVote();
    const t0 = performance.now();
    let seq = 0;
    for (let i = 0; i < 600; i++) {
      seq++;
      for (const c of clients) c.handle({ type: 'i', f: [[seq, Math.sin(i / 20) * 60, 1 | (i % 90 < 30 ? 4 : 0)]] });
      hub.update(1 / 60);
    }
    const msPerTick = (performance.now() - t0) / 600;
    expect(room.race.karts.filter((k) => k.human).length).toBe(12);
    expect(msPerTick).toBeLessThan(8);
  });
});
