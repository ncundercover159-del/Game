// RERUN — networking. Plain WebSocket, JSON for control, binary for ghosts.

import { decodeGhosts } from '@shared/ghostbuf.js';

function serverUrl() {
  const override = import.meta.env.VITE_SERVER_URL;
  if (override) {
    return override.replace(/^http/, 'ws').replace(/\/$/, '') +
      (override.includes('/ws') ? '' : '/ws');
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class Net extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.offset = 0; // serverNow - clientNow
    this.rtt = 200;
    this.samples = [];
    this.open = false;
    this.playerId = null;
    this.code = null;
    this.slot = 0;
    this.wantReconnect = false;
    this._pingTimer = null;
    this._retry = 0;
  }

  now() {
    return Date.now() + this.offset;
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  connect(then) {
    const ws = new WebSocket(serverUrl());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.open = true;
      this._retry = 0;
      this.emit('open');
      this.syncClock(true);
      this._pingTimer = setInterval(() => this.syncClock(false), 4000);
      if (then) then();
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        const decoded = decodeGhosts(ev.data);
        if (decoded) this.emit('ghosts', decoded);
        return;
      }
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'pong') { this.onPong(msg); return; }
      if (msg.t === 'joined') {
        this.playerId = msg.playerId;
        this.code = msg.code;
        this.slot = msg.slot;
        try {
          sessionStorage.setItem('rerun', JSON.stringify({ roomCode: msg.code, playerId: msg.playerId }));
        } catch { /* private mode */ }
      }
      this.emit(msg.t, msg);
    };

    ws.onclose = () => {
      this.open = false;
      clearInterval(this._pingTimer);
      this.emit('close');
      if (this.wantReconnect) {
        this._retry++;
        const delay = Math.min(4000, 400 * this._retry);
        setTimeout(() => this.connect(() => this.resume()), delay);
      }
    };

    ws.onerror = () => { /* onclose does the work */ };
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  // ---- clock sync --------------------------------------------------------
  syncClock(burst) {
    const fire = () => this.send({ t: 'ping', c: performance.now() });
    fire();
    if (burst) { setTimeout(fire, 120); setTimeout(fire, 260); setTimeout(fire, 420); }
  }

  onPong(msg) {
    const rtt = performance.now() - msg.c;
    const clientMid = Date.now() - rtt / 2;
    this.samples.push({ rtt, offset: msg.now - clientMid });
    if (this.samples.length > 12) this.samples.shift();
    // Lowest-RTT sample is the least polluted by queueing.
    let best = this.samples[0];
    for (const s of this.samples) if (s.rtt < best.rtt) best = s;
    this.rtt = best.rtt;
    // Ease toward it so the round clock never jumps under the player.
    if (Math.abs(best.offset - this.offset) > 250) this.offset = best.offset;
    else this.offset += (best.offset - this.offset) * 0.25;
  }

  // ---- room --------------------------------------------------------------
  create(name) {
    this.wantReconnect = true;
    this.send({ t: 'create', name });
  }

  join(code, name, playerId) {
    this.wantReconnect = true;
    this.send({ t: 'join', code, name, playerId: playerId || undefined });
  }

  resume() {
    if (!this.code) return;
    this.send({ t: 'join', code: this.code, playerId: this.playerId });
  }

  start() { this.send({ t: 'start' }); }
  again() { this.send({ t: 'again' }); }

  sendInput(stick, jump) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      t: 'input',
      s: [Math.round(stick.x * 1000) / 1000, Math.round(stick.y * 1000) / 1000],
      j: jump ? 1 : 0,
    }));
  }
}

export function storedSession() {
  try {
    const raw = sessionStorage.getItem('rerun');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && v.roomCode && v.playerId ? v : null;
  } catch { return null; }
}

export function clearSession() {
  try { sessionStorage.removeItem('rerun'); } catch { /* ignore */ }
}
