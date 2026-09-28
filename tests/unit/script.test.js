import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, ScriptRunner, tokenize } from '../../src/systems/script.js';

/** A host that records calls and completes blocking verbs on demand. */
function mockHost() {
  const log = [];
  const flags = {};
  const inv = { rice: 2 };
  const pending = [];
  const handle = (entry, value = 0) => { const h = { done: false, value }; pending.push(h); log.push(entry); return h; };
  return {
    log, flags, inv, pending,
    finishAll(value) { for (const h of pending.splice(0)) { if (value !== undefined) h.value = value; h.done = true; } },
    say: (who, face, text) => handle(['say', who, face, text]),
    choice: (texts) => handle(['choice', texts]),
    moveNpc: (npc, tx, ty, dir) => handle(['move', npc, tx, ty, dir]),
    pan: (target, t) => handle(['pan', target, t]),
    fade: (dir, t) => handle(['fade', dir, t]),
    give: (id, n) => { inv[id] = (inv[id] || 0) + n; log.push(['give', id, n]); },
    take: (id, n) => { if ((inv[id] || 0) < n) return false; inv[id] -= n; log.push(['take', id, n]); return true; },
    money: (n) => log.push(['money', n]),
    bond: (npc, n) => log.push(['bond', npc, n]),
    virtue: (name, n) => log.push(['virtue', name, n]),
    face: (npc, dir) => log.push(['face', npc, dir]),
    placeNpc: (npc, tx, ty, dir) => log.push(['place', npc, tx, ty, dir]),
    emote: (npc, kind) => log.push(['emote', npc, kind]),
    flag: (name) => flags[name],
    setFlag: (name, v) => { flags[name] = v; },
  };
}

test('tokenize keeps quoted text whole and unescapes quotes', () => {
  assert.deepEqual(tokenize('say genzo happy "Well, \\"rōnin\\"."'), ['say', 'genzo', 'happy', { s: 'Well, "rōnin".' }]);
});

test('parse errors name the line', () => {
  assert.throws(() => parseScript('say "hi"\nfly away'), /line 2: unknown verb "fly"/);
  assert.throws(() => parseScript('goto @nowhere'), /unknown label @nowhere/);
  assert.throws(() => parseScript('wait soon'), /expected a number/);
});

test('say blocks until the host finishes it; speaker and face are optional', () => {
  const h = mockHost();
  const r = new ScriptRunner(h, parseScript('say "Narration."\nsay tomoe sad "Oh."\ngive rice 1'));
  r.update(0.016);
  assert.deepEqual(h.log, [['say', null, 'neutral', 'Narration.']]);
  h.finishAll();
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['say', 'tomoe', 'sad', 'Oh.']);
  h.finishAll();
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['give', 'rice', 1]);
  assert.ok(r.finished);
});

test('choices jump to their labels', () => {
  const src = `
    choice "Help" @help "Leave" @leave
    @help
    bond heibei 50
    goto @done
    @leave
    virtue meiyo -1
    @done
    setFlag asked`;
  for (const [pick, expect] of [[0, ['bond', 'heibei', 50]], [1, ['virtue', 'meiyo', -1]]]) {
    const h = mockHost();
    const r = new ScriptRunner(h, parseScript(src));
    r.update(0.016);
    h.finishAll(pick);
    r.update(0.016);
    assert.deepEqual(h.log[1], expect);
    assert.equal(h.log.length, 2);
    assert.equal(h.flags.asked, true);
    assert.ok(r.finished);
  }
});

test('ifFlag, negated ifFlag, take with an else branch, and end', () => {
  const src = `
    ifFlag !met @first
    say "Again?"
    end
    @first
    setFlag met
    take rice 5 @short
    say "Thanks for the rice."
    end
    @short
    say "Not enough rice."`;
  const h = mockHost();
  const r = new ScriptRunner(h, parseScript(src));
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['say', null, 'neutral', 'Not enough rice.']);
  assert.equal(h.flags.met, true);
  h.finishAll();
  r.update(0.016);
  assert.ok(r.finished);
  const r2 = new ScriptRunner(h, parseScript(src));
  r2.update(0.016);
  assert.deepEqual(h.log.at(-1), ['say', null, 'neutral', 'Again?']);
});

test('wait counts down in real time; moves, pans and fades block on the host', () => {
  const h = mockHost();
  const r = new ScriptRunner(h, parseScript('placeNpc kaito 1 2\nwait 0.5\nmoveNpc kaito 4 5 up\ncameraPan player 1\nfade out 0.3\nemote kaito !'));
  r.update(0.3);
  assert.deepEqual(h.log, [['place', 'kaito', 1, 2, null]]);
  r.update(0.3);
  assert.deepEqual(h.log.at(-1), ['move', 'kaito', 4, 5, 'up']);
  h.finishAll();
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['pan', 'player', 1]);
  h.finishAll();
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['fade', 'out', 0.3]);
  h.finishAll();
  r.update(0.016);
  assert.deepEqual(h.log.at(-1), ['emote', 'kaito', '!']);
  assert.ok(r.finished);
});
