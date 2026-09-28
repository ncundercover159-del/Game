import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc, upgrade, parseDoc, MIGRATIONS } from '../../src/core/save.js';
import { SAVE_VERSION } from '../../src/config.js';

const state = { seed: 7, money: 500, cal: { day: 3, season: 0, year: 1, minutes: 400 }, list: [1, 2.5, null] };

test('documents round-trip through JSON with a valid checksum', () => {
  const doc = makeDoc(state, { name: 'Hayato' });
  const back = parseDoc(JSON.stringify(doc));
  assert.deepEqual(back.state, state);
  assert.equal(back.version, SAVE_VERSION);
});

test('tampering or truncation is detected', () => {
  const doc = makeDoc(state, {});
  const bad = JSON.parse(JSON.stringify(doc));
  bad.state.money = 999999;
  assert.throws(() => upgrade(bad), /Checksum/);
  assert.throws(() => parseDoc(JSON.stringify(doc).slice(0, 40)));
  assert.throws(() => upgrade({ hello: 1 }), /Not a save/);
});

test('saves from a newer version are refused', () => {
  const doc = makeDoc(state, {});
  doc.version = SAVE_VERSION + 1;
  assert.throws(() => upgrade(doc), /newer/);
});

test('older saves run through each migration step in order', () => {
  const old = makeDoc({ ...state, legacy: true }, {});
  old.version = SAVE_VERSION - 1;
  MIGRATIONS[SAVE_VERSION - 1] = (s) => { const { legacy, ...rest } = s; return { ...rest, migrated: legacy }; };
  try {
    const up = upgrade(old);
    assert.equal(up.version, SAVE_VERSION);
    assert.equal(up.state.migrated, true);
    assert.equal(up.state.legacy, undefined);
  } finally {
    delete MIGRATIONS[SAVE_VERSION - 1];
  }
});
