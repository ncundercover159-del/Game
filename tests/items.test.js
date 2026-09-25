import { describe, it, expect } from 'vitest';
import { makeRace, entrant } from './helpers.js';
import { BTN } from '../shared/physics/input.js';
import { ITEMS, KART } from '../shared/config.js';
import { ITEM_DEFS } from '../shared/sim/items.js';

// Two karts on the start straight: A behind, B `gap` metres ahead.
function duel(gap = 30, opts = {}) {
  const race = makeRace('sky_cloudtop', { entrants: [entrant('a'), entrant('b', { racerId: opts.racerB || 'draxo' })], ...opts });
  const w = race.world;
  const [a, b] = race.karts;
  const place = (k, t, lane = 0) => {
    const p = w.at(t, lane);
    Object.assign(k, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, hint: p.idx, ribbon: 0, speed: 0 });
    race.lapSystem.initKart(k);
  };
  place(a, 0.07);
  place(b, 0.07 + gap / w.length);
  // clear item boxes so they don't interfere
  race.items.boxes.forEach((bx) => { bx.active = false; bx.t = 1e9; });
  race.items.coins.forEach((c) => { c.active = false; c.t = 1e9; });
  return { race, a, b, w };
}

function run(race, ticks, inputs = {}) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    for (const k of race.karts) race.setInput(k.id, typeof inputs[k.id] === 'function' ? inputs[k.id](i) : inputs[k.id] || { steer: 0, btn: 0 });
    race.step();
    events.push(...race.drainEvents());
  }
  return events;
}

const tap = (extra = 0) => (i) => ({ steer: 0, btn: (i === 1 ? BTN.ITEM : 0) | extra });
const hold = (from, to, extra = 0) => (i) => ({ steer: 0, btn: (i >= from && i < to ? BTN.ITEM : 0) | extra });

describe('item boxes & roulette', () => {
  it('picks up a box, spins the roulette and delivers an item', () => {
    const race = makeRace('sky_cloudtop');
    const k = race.karts[0];
    const box = race.items.boxes[0];
    Object.assign(k, { x: box.x, y: box.y - 1.1, z: box.z });
    const ev = run(race, 2);
    expect(ev.some((e) => e.type === 'itemBox' && e.got)).toBe(true);
    expect(k.roulette).toBeGreaterThan(0);
    const ev2 = run(race, Math.ceil(ITEMS.rouletteTime * 60) + 2);
    expect(ev2.some((e) => e.type === 'itemReady')).toBe(true);
    expect(ITEM_DEFS[k.item]).toBeTruthy();
    expect(box.active).toBe(false);
  });

  it('gives leaders weak items and trailing racers strong ones', () => {
    const race = makeRace('sky_cloudtop', { entrants: Array.from({ length: 12 }, (_, i) => entrant('k' + i, { human: i === 0 })) });
    const strong = new Set(['star', 'goldShroom', 'comet', 'bolt', 'shroom3']);
    const leader = race.karts[0], last = race.karts[11];
    leader.place = 1; last.place = 12;
    race.ranked = [...race.karts];
    let leadStrong = 0, lastStrong = 0;
    for (let i = 0; i < 400; i++) {
      if (strong.has(race.items.roll(leader))) leadStrong++;
      if (strong.has(race.items.roll(last))) lastStrong++;
    }
    expect(leadStrong).toBe(0);
    expect(lastStrong).toBeGreaterThan(150);
  });
});

describe('projectiles & shields', () => {
  it('an orb thrown forward hits the kart ahead', () => {
    const { race, a, b } = duel(25);
    a.item = 'orb'; a.itemCount = 1;
    const ev = run(race, 90, { a: tap() });
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(true);
    expect(b.spin > 0 || b.invuln > 0).toBe(true);
    expect(a.hitsLanded).toBe(1);
  });

  it('a trailing item blocks a projectile from behind', () => {
    const { race, a, b } = duel(25);
    a.item = 'orb';
    b.item = 'peel';
    // b holds its peel behind (item held), a fires an orb forward
    const ev = run(race, 90, { a: tap(), b: () => ({ steer: 0, btn: BTN.ITEM }) });
    expect(ev.some((e) => e.type === 'shielded' && e.id === 'b')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(false);
  });

  it('a seeker homes onto the racer ahead even when offset', () => {
    const { race, a, b, w } = duel(40);
    const p = w.at(b.s / w.length, 0.6);
    Object.assign(b, { x: p.x, z: p.z });
    a.item = 'seeker';
    a.place = 2; b.place = 1;
    race.ranked = [b, a];
    const ev = run(race, 120, { a: tap() });
    expect(ev.some((e) => e.type === 'homing' && e.id === 'b')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(true);
  });

  it('peels dropped behind spin out the next racer', () => {
    const { race, a, b } = duel(-20); // b is behind a
    a.item = 'peel';
    run(race, 3, { a: tap() });
    expect(race.items.hazards.length).toBe(1);
    const ev = run(race, 150, { b: () => ({ steer: 0, btn: BTN.ACCEL }) });
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(true);
    expect(race.items.hazards.length).toBe(0);
  });

  it('a horn destroys an incoming seeker', () => {
    const { race, a, b } = duel(35);
    a.item = 'seeker'; b.item = 'horn';
    a.place = 2; b.place = 1; race.ranked = [b, a];
    const ev = run(race, 60, { a: tap(), b: (i) => ({ steer: 0, btn: i === 28 ? BTN.ITEM : 0 }) });
    expect(ev.some((e) => e.type === 'shock' && e.kind === 'horn')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(false);
  });

  it('star makes the user immune and bowls over others', () => {
    const { race, a, b } = duel(6);
    a.item = 'star';
    const ev = run(race, 60, { a: (i) => ({ steer: 0, btn: BTN.ACCEL | (i === 1 ? BTN.ITEM : 0) }) });
    expect(a.star).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b')).toBe(true);
  });

  it('the sky comet hunts down the leader and explodes', () => {
    const { race, a, b } = duel(120);
    a.item = 'comet';
    a.place = 2; b.place = 1; race.ranked = [b, a];
    const ev = run(race, 60 * 6, { a: tap() });
    expect(ev.some((e) => e.type === 'cometWarn' && e.id === 'b')).toBe(true);
    expect(ev.some((e) => e.type === 'explosion')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b' && e.kind === 'tumble')).toBe(true);
  });
});

describe('coins', () => {
  it('collecting coins raises top speed up to the cap and hits cost coins', () => {
    const { race, a } = duel(30);
    race.items.giveCoins(a, 15);
    expect(a.coins).toBe(KART.coinMax);
    race.items.hit(a, 'spin', {});
    expect(a.coins).toBe(KART.coinMax - KART.coinsLostOnHit);
  });
});

describe('signature items', () => {
  it('swap spell trades places with a racer ahead after a telegraph', () => {
    const { race, a, b } = duel(60);
    a.item = 'swap';
    a.place = 2; b.place = 1; race.ranked = [b, a];
    const beforeA = a.raceDist, beforeB = b.raceDist;
    const ev = run(race, 60 * 2.2, { a: tap() });
    expect(ev.some((e) => e.type === 'swapWarn')).toBe(true);
    expect(ev.some((e) => e.type === 'swap')).toBe(true);
    expect(a.raceDist).toBeGreaterThan(beforeB - 5);
    expect(b.raceDist).toBeLessThan(beforeA + 5);
  });

  it('tongue lash steals the held item of the racer ahead', () => {
    const { race, a, b } = duel(12);
    a.item = 'tongue';
    b.item = 'star';
    run(race, 3, { a: tap() });
    expect(a.item).toBe('star');
    expect(b.item).toBe(null);
  });

  it('rolling boulder flattens racers in its path', () => {
    const { race, b } = duel(30);
    race.karts[0].item = 'boulder';
    const ev = run(race, 90, { a: tap() });
    expect(ev.some((e) => e.type === 'hit' && e.id === 'b' && e.kind === 'squish')).toBe(true);
    expect(b.squish).toBeGreaterThan(0);
  });

  it('tunnel dash makes the user intangible to hazards', () => {
    const { race, a } = duel(30);
    a.item = 'tunnel';
    run(race, 2, { a: tap() });
    expect(a.burrow).toBeGreaterThan(0);
    expect(race.items.hit(a, 'spin', {})).toBe(false);
  });

  it('every item id resolves without throwing', () => {
    for (const id of Object.keys(ITEM_DEFS)) {
      const { race, a, b } = duel(20);
      a.item = id; a.itemCount = ITEM_DEFS[id].count || 1;
      a.place = 2; b.place = 1; race.ranked = [b, a];
      expect(() => run(race, 60 * 3, { a: hold(1, 20) })).not.toThrow();
    }
  });
});
