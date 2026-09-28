// M7d: the music's rules (the theme for each moment, the composer's scales and form) and the
// ambience's levels. The WebAudio side is exercised in the browser (tests/e2e/audio.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeFor, Composer, SCALES, pitch } from '../../src/systems/music.js';
import { THEMES } from '../../src/data/music.js';
import { INSTRUMENTS } from '../../src/core/instruments.js';
import { bedLevels, callRates } from '../../src/core/ambience.js';

const day = (over) => ({ scene: 'play', map: 'farm', cave: false, zone: 0, indoors: false, boss: false, festival: false, season: 'spring', minutes: 10 * 60, weather: 'clear', rain: false, ...over });

test('the theme for each moment: places, seasons, the night, rain, caves, bosses, festivals', () => {
  assert.equal(themeFor({ scene: 'title' }), 'title');
  assert.equal(themeFor(day()), 'farm_spring');
  assert.equal(themeFor(day({ season: 'winter' })), 'farm_winter');
  assert.equal(themeFor(day({ map: 'village' })), 'village');
  assert.equal(themeFor(day({ map: 'shrine' })), 'shrine');
  assert.equal(themeFor(day({ map: 'grove' })), 'grove');
  assert.equal(themeFor(day({ rain: true })), 'rain');
  assert.equal(themeFor(day({ minutes: 20 * 60 })), 'night');
  assert.equal(themeFor(day({ minutes: 23 * 60 })), null, 'late: only the valley\'s sounds');
  assert.equal(themeFor(day({ minutes: 3 * 60 })), null);
  assert.equal(themeFor(day({ indoors: true, map: 'house_farm' })), 'home');
  assert.equal(themeFor(day({ indoors: true, map: 'honden' })), 'shrine');
  assert.equal(themeFor(day({ cave: true, zone: 3 })), 'cave_3');
  assert.equal(themeFor(day({ cave: true, zone: 5, boss: true })), 'boss');
  assert.equal(themeFor(day({ festival: true, minutes: 23 * 60 })), 'festival', 'a festival plays on late');
  // Every theme the director can ask for exists, and uses real instruments and scales.
  for (const map of ['farm', 'village', 'shrine', 'grove', 'kurayama', 'house_farm', 'honden']) for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const minutes of [7 * 60, 13 * 60, 20 * 60]) {
    const n = themeFor(day({ map, season, minutes, indoors: map.includes('_') || map === 'honden' }));
    assert.ok(n === null || THEMES[n], `${map} ${season} ${minutes}: ${n}`);
  }
  for (const [id, th] of Object.entries(THEMES)) {
    assert.ok(SCALES[th.scale], `${id} scale`);
    assert.ok(INSTRUMENTS[th.lead], `${id} lead`);
  }
});

test('the composer: notes in the scale, bars in time, A A B A\' coming home, the same seed the same tune', () => {
  for (const name of Object.keys(THEMES)) {
    const th = THEMES[name], sc = SCALES[th.scale], c = new Composer(name, 11);
    const bars = Array.from({ length: 32 }, () => c.nextBar());
    for (const bar of bars) for (const n of bar) {
      assert.ok(INSTRUMENTS[n.inst], `${name}: ${n.inst}`);
      assert.ok(n.beat >= 0 && n.beat < 4 && n.dur > 0 && n.vel > 0 && n.vel <= 1, `${name}: ${JSON.stringify(n)}`);
      if (!n.inst.startsWith('taiko')) assert.ok(sc.includes((((n.midi - th.root) % 12) + 12) % 12), `${name}: ${n.midi} in ${th.scale}`);
    }
    const lead = (b) => bars[b].filter((n) => n.inst === th.lead && n.vel >= 0.5).map((n) => `${n.beat}:${n.midi}:${n.dur}`);
    assert.deepEqual(lead(2), lead(0), `${name}: A repeats`);
    assert.deepEqual(lead(3), lead(1), `${name}: A repeats`);
    // A' ends on the root (in some octave).
    const last = bars[7].filter((n) => n.inst === th.lead && n.vel >= 0.5).at(-1) || bars[6].filter((n) => n.inst === th.lead && n.vel >= 0.5).at(-1);
    if (last) assert.equal((last.midi - th.root) % 12, 0, `${name}: home`);
    const again = new Composer(name, 11);
    assert.deepEqual(again.nextBar(), bars[0]);
  }
  // Busy themes play more lead notes than calm ones.
  const count = (name) => { const c = new Composer(name, 3); let n = 0; for (let i = 0; i < 64; i++) n += c.nextBar().filter((x) => x.inst === THEMES[name].lead && x.vel >= 0.5).length; return n; };
  assert.ok(count('festival') > count('cave_5') * 1.5);
  assert.equal(pitch(THEMES.farm_spring, 5), THEMES.farm_spring.root + 12);
});

test('ambience: rain outdoors (muffled inside), the mountain\'s rumble, crickets on summer nights, birds by day', () => {
  const rainy = bedLevels(day({ weather: 'rain', rain: true }));
  const inside = bedLevels(day({ weather: 'rain', rain: true, indoors: true }));
  assert.ok(rainy.rain > 0 && inside.rain > 0 && inside.rain < rainy.rain);
  assert.equal(bedLevels(day()).rain, 0);
  assert.ok(bedLevels(day({ weather: 'typhoon' })).wind > bedLevels(day()).wind);
  assert.ok(bedLevels(day({ cave: true, zone: 4 })).rumble > bedLevels(day({ cave: true, zone: 1 })).rumble);
  assert.ok(bedLevels(day({ map: 'grove' })).water > bedLevels(day()).water);
  assert.ok(callRates(day({ season: 'summer', minutes: 21 * 60 })).cricket > 0);
  assert.equal(callRates(day({ season: 'winter', minutes: 21 * 60 })).cricket, 0);
  assert.ok(callRates(day()).bird > 0);
  assert.equal(callRates(day({ rain: true })).bird, 0);
  assert.ok(callRates(day({ cave: true, zone: 2 })).drip > 0);
  assert.equal(callRates(day({ indoors: true })).bird, 0);
});
