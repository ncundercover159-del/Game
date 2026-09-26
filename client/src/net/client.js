// WebSocket client: connection, message dispatch, ping/RTT, token reconnect.
import { PROTOCOL_VERSION } from '@shared/net/protocol.js';

export function defaultServerUrl() {
  const p = new URLSearchParams(location.search);
  const override = p.get('server') || localStorage.getItem('skykart:serverUrl');
  if (override) return override;
  const secure = location.protocol === 'https:';
  // dev server (vite on 5173/4173) talks to the game server on 8787; production is same-origin
  const host = /^(5173|4173)$/.test(location.port) ? `${location.hostname}:8787` : location.host;
  return `${secure ? 'wss' : 'ws'}://${host}/ws`;
}

// HTTP base of the game server (ghost sharing API etc.)
export function httpBase() {
  return defaultServerUrl().replace(/^ws/, 'http').replace(/\/ws$/, '');
}

export class NetClient {
  constructor(url = defaultServerUrl()) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
    this.state = 'idle';
    this.rtt = 0;
    this.token = sessionStorage.getItem('skykart:token') || null;
    this.inRoom = false;
    this.retry = 0;
    this.pingT = null;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  emit(type, m) { for (const fn of this.handlers.get(type) || []) fn(m); for (const fn of this.handlers.get('*') || []) fn(m); }

  connect() {
    if (this.ws && (this.state === 'open' || this.state === 'connecting')) return this.ready;
    this.state = 'connecting';
    this.ready = new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { this.state = 'closed'; reject(e); return; }
      this.ws = ws;
      const timeout = setTimeout(() => { if (this.state === 'connecting') { ws.close(); reject(new Error('Connection timed out')); } }, 6000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.state = 'open';
        this.retry = 0;
        this.send({ type: 'hello', token: this.inRoom ? this.token : null, v: PROTOCOL_VERSION });
        this.startPing();
        resolve();
        this.emit('open', {});
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'welcome') { this.token = m.token; this.inRoom = true; sessionStorage.setItem('skykart:token', m.token); }
        if (m.type === 'pong') { const rtt = performance.now() - m.c; this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt; }
        this.emit(m.type, m);
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        const was = this.state;
        this.state = 'closed';
        this.stopPing();
        this.emit('close', { was });
        if (was === 'connecting') reject(new Error('Could not reach the game server'));
        else if (this.inRoom && !this.leaving) this.scheduleReconnect();
      };
      ws.onerror = () => {};
    });
    return this.ready;
  }

  scheduleReconnect() {
    if (this.retry > 12) { this.emit('lost', {}); return; }
    const delay = Math.min(5000, 500 * 2 ** this.retry++);
    this.emit('reconnecting', { delay });
    setTimeout(() => this.connect().catch(() => this.scheduleReconnect()), delay);
  }

  startPing() {
    this.stopPing();
    this.pingT = setInterval(() => this.send({ type: 'ping', c: performance.now(), rtt: Math.round(this.rtt) }), 2000);
  }

  stopPing() { clearInterval(this.pingT); }

  send(m) {
    if (this.ws && this.state === 'open') this.ws.send(JSON.stringify(m));
  }

  leave() {
    this.send({ type: 'leave' });
    this.inRoom = false;
    sessionStorage.removeItem('skykart:token');
  }

  close() {
    this.leaving = true;
    this.inRoom = false;
    this.stopPing();
    this.ws?.close();
    this.state = 'closed';
  }
}
