// Network protocol shared by client and server. JSON messages over WebSocket.
// Kart states travel as fixed-order arrays to keep snapshots small.
//
// client -> server: hello, create, join, quick, pick, ready, settings, vote, start,
//                   i (inputs), ping, leave, pause, resume, rematch
// server -> client: welcome, room, error, start, s (snapshot), results, pong, kicked
export const PROTOCOL_VERSION = 3;

// Full physics state for the local kart (reconciliation).
export const KART_FULL = [
  'x', 'y', 'z', 'yaw', 'speed', 'lat', 'vy', 'vyGround', 'ex', 'ez', 'steer', 'grounded', 'airTime', 'trickable', 'trickDone',
  'glider', 'gliderAvail', 'rampKick', 'hopping', 'driftArmed', 'drift', 'driftTime', 'driftCharge', 'driftTier', 'boostTime',
  'boostMul', 'boostKind', 'padCooldown', 'surface', 'gnx', 'gny', 'gnz', 'groundH', 'lastGroundY', 'ribbon', 'hint', 'safeRibbon',
  'safeHint', 'spin', 'tumble', 'squish', 'shrink', 'star', 'invuln', 'ink', 'blind', 'burrow', 'ghost', 'rescue', 'rescuePhase',
  'stuckTime', 'burnout', 'startRev', 'coins', 'prevBtn', 'rubberMul', 's', 'lane', 'tdx', 'tdz',
  // items / race (HUD)
  'item', 'itemCount', 'roulette', 'trailing', 'orbitCount', 'orbitKind', 'orbitAngle', 'goldTime', 'flail', 'cloneShield', 'magnetTime',
  'place', 'lap', 'raceDist', 'finished', 'finishTime', 'estimated', 'isWrongWay', 'lapTimes', 'itemsUsed', 'hitsLanded', 'coinsTotal',
  'balloons', 'eliminated', 'score',
];

// Render state for remote karts.
export const KART_VIEW = [
  'x', 'y', 'z', 'yaw', 'speed', 'steer', 'drift', 'driftTier', 'boostTime', 'boostKind', 'grounded', 'glider', 'trickDone',
  'gnx', 'gny', 'gnz', 'groundH', 'spin', 'tumble', 'squish', 'shrink', 'star', 'invuln', 'burrow', 'ghost', 'rescue', 'rescuePhase',
  'coins', 'place', 'lap', 'raceDist', 'finished', 'finishTime', 'trailing', 'orbitCount', 'orbitKind', 'orbitAngle', 'flail', 'surface',
  'lane', 'item', 'balloons', 'eliminated', 'score', 'estimated', 'magnetTime', 'goldTime',
];

const r3 = (v) => Math.round(v * 1000) / 1000;

function getField(k, f) {
  if (f === 'orbitCount') return k.orbit ? k.orbit.count : 0;
  if (f === 'orbitKind') return k.orbit ? k.orbit.kind : 0;
  return k[f];
}

export function encodeKart(k, fields) {
  const out = new Array(fields.length);
  for (let i = 0; i < fields.length; i++) {
    const v = getField(k, fields[i]);
    if (typeof v === 'number') out[i] = r3(v);
    else if (typeof v === 'boolean') out[i] = v ? 1 : 0;
    else if (v === undefined || v === null) out[i] = 0;
    else if (Array.isArray(v)) out[i] = v.map((x) => (typeof x === 'number' ? r3(x) : x));
    else out[i] = v;
  }
  return out;
}

const BOOL_FIELDS = new Set(['grounded', 'trickable', 'trickDone', 'glider', 'gliderAvail', 'hopping', 'driftArmed', 'finished', 'estimated', 'isWrongWay', 'eliminated']);
const STR_FIELDS = new Set(['boostKind', 'surface', 'item', 'trailing', 'orbitKind']);

export function decodeKart(arr, fields, target = {}) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    let v = arr[i];
    if (BOOL_FIELDS.has(f)) v = !!v;
    else if (STR_FIELDS.has(f)) v = v === 0 || v === '' ? (f === 'boostKind' ? '' : f === 'surface' ? 'road' : null) : v;
    if (f === 'orbitCount') { target.orbit = v > 0 ? { kind: target.orbit?.kind || 'orb', count: v } : null; continue; }
    if (f === 'orbitKind') { if (target.orbit && v) target.orbit.kind = v; continue; }
    target[f] = v;
  }
  return target;
}

// Items: compact arrays
export const encodeProjectile = (p) => [p.id, p.kind, r3(p.x), r3(p.y), r3(p.z), r3(p.yaw), p.owner, p.element || 0, p.target ?? 0, p.phase || 0, r3(p.speed || 0), r3(p.t || 0)];
export const decodeProjectile = (a) => ({ id: a[0], kind: a[1], x: a[2], y: a[3], z: a[4], yaw: a[5], owner: a[6], element: a[7] || null, target: a[8] || null, phase: a[9] || 'fly', speed: a[10], t: a[11] });
export const encodeHazard = (h) => [h.id, h.kind, r3(h.x), r3(h.y), r3(h.z), r3(h.r), r3(h.life > 1e6 ? -1 : h.life)];
export const decodeHazard = (a) => ({ id: a[0], kind: a[1], x: a[2], y: a[3], z: a[4], r: a[5], life: a[6] < 0 ? 9999 : a[6] });
export const encodeEffect = (e) => [e.id, e.kind, e.owner, e.target ?? 0, r3(e.x || 0), r3(e.y || 0), r3(e.z || 0), r3(e.t || 0)];
export const decodeEffect = (a) => ({ id: a[0], kind: a[1], owner: a[2], target: a[3] || null, x: a[4], y: a[5], z: a[6], t: a[7] });
export const encodeLoose = (c) => [c.id, r3(c.x), r3(c.y), r3(c.z), r3(c.t)];
export const decodeLoose = (a) => ({ id: a[0], x: a[1], y: a[2], z: a[3], t: a[4] });

export const bitString = (list) => list.map((b) => (b.active ? '1' : '0')).join('');

// Events that the client predicts locally for its own kart (server copies are dropped).
export const PREDICTED_EVENTS = new Set(['hop', 'driftStart', 'mtTier', 'miniTurbo', 'trick', 'land', 'takeoff', 'wallHit', 'glider']);

export function makeRoomCode(rng = Math.random, chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ') {
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

// Sanitise untrusted client input frames.
export function sanitizeInput(steer, btn) {
  let s = Number(steer);
  if (!Number.isFinite(s)) s = 0;
  s = Math.max(-127, Math.min(127, Math.round(s)));
  let b = Number(btn);
  if (!Number.isFinite(b)) b = 0;
  return { steer: s / 127, btn: b & 0x1ff };
}

export function sanitizeName(n) {
  return String(n || 'Racer').replace(/[^\p{L}\p{N} _\-.!?']/gu, '').trim().slice(0, 16) || 'Racer';
}
