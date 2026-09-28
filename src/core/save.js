// Save slots in localStorage: versioned documents with a checksum, a backup copy written before
// every save, migrations for old versions, and file export/import.
import { SAVE_VERSION, SAVE_SLOTS } from '../config.js';
import { hashString } from './rng.js';

const key = (n) => `ronin.slot${n}`;

// MIGRATIONS[v] upgrades a document's state from version v to v + 1.
export const MIGRATIONS = {};

export function makeDoc(state, meta) {
  const body = JSON.stringify(state);
  return { version: SAVE_VERSION, checksum: hashString(body), savedAt: Date.now(), meta, state };
}

/** Validate and migrate a parsed document. Throws on corruption. */
export function upgrade(doc) {
  if (!doc || typeof doc !== 'object' || !doc.state || typeof doc.version !== 'number') throw new Error('Not a save file');
  if (hashString(JSON.stringify(doc.state)) !== doc.checksum) throw new Error('Checksum mismatch');
  let v = doc.version;
  if (v > SAVE_VERSION) throw new Error(`Save is from a newer version (${v})`);
  let state = doc.state;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from version ${v}`);
    state = step(state);
    v++;
  }
  return { ...doc, version: v, state };
}

export function parseDoc(text) {
  return upgrade(JSON.parse(text));
}

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function writeSlot(n, doc) {
  const ls = storage();
  if (!ls) return false;
  const prev = ls.getItem(key(n));
  if (prev) ls.setItem(key(n) + '.bak', prev);
  ls.setItem(key(n), JSON.stringify(doc));
  return true;
}

/** Returns { doc, backup } or { error } ; falls back to the .bak copy when the main copy is bad. */
export function readSlot(n) {
  const ls = storage();
  const raw = ls?.getItem(key(n));
  if (!raw) return { empty: true };
  try {
    return { doc: parseDoc(raw) };
  } catch (err) {
    const bak = ls.getItem(key(n) + '.bak');
    if (bak) {
      try { return { doc: parseDoc(bak), backup: true, error: String(err.message || err) }; } catch { /* both bad */ }
    }
    return { error: String(err.message || err) };
  }
}

export function listSlots() {
  const out = [];
  for (let n = 1; n <= SAVE_SLOTS; n++) out.push({ n, ...readSlot(n) });
  return out;
}

export function exportDoc(doc, filename) {
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Opens a file picker; resolves with a validated document or rejects. */
export function importDoc() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try { resolve(parseDoc(await input.files[0].text())); } catch (e) { reject(e); }
    };
    input.click();
  });
}
