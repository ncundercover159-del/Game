// Ghost sharing store: players upload a compact ghost and get a short code.
// Persisted to a JSON file (best effort) so codes survive restarts.
import fs from 'node:fs';
import path from 'node:path';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX = 2000;

export class GhostStore {
  constructor(file) {
    this.file = file;
    this.map = new Map();
    try {
      if (fs.existsSync(file)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) this.map.set(k, v);
    } catch (e) { console.warn('[ghosts] could not load store', e.message); }
  }

  put(g) {
    if (!g || typeof g.track !== 'string' || typeof g.data !== 'string' || g.data.length > 200000) throw new Error('bad ghost');
    let code;
    do { code = ''; for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; } while (this.map.has(code));
    this.map.set(code, { track: g.track, time: +g.time || 0, name: String(g.name || '').slice(0, 16), racer: String(g.racer || ''), vehicle: String(g.vehicle || ''), data: g.data, at: Date.now() });
    while (this.map.size > MAX) this.map.delete(this.map.keys().next().value);
    this.save();
    return code;
  }

  get(code) { return this.map.get(String(code || '').toUpperCase()) || null; }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.map)));
    } catch (e) { console.warn('[ghosts] save failed', e.message); }
  }
}
