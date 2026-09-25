// Small math helpers shared by client and server (no Three.js dependency).

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Frame-rate independent exponential approach: move a toward b at rate k (1/s).
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export const angleDiff = (a, b) => wrapAngle(b - a);

export function approach(v, target, maxDelta) {
  if (v < target) return Math.min(v + maxDelta, target);
  return Math.max(v - maxDelta, target);
}

// Deterministic PRNG (mulberry32). State is a plain uint32 so it can be snapshotted.
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.getState = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  return rng;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Weighted random pick from {key: weight}.
export function weightedPick(weights, r) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let x = r * total;
  for (const k in weights) {
    x -= weights[k];
    if (x <= 0) return k;
  }
  return Object.keys(weights)[0];
}

// 2D helpers on the XZ plane
export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
};
export const len2 = (x, z) => Math.sqrt(x * x + z * z);

// Forward/right vectors for a yaw. Forward = +Z at yaw 0; right = -X at yaw 0
// (so a camera behind the kart looking down +Z sees "right" on screen-right).
export const fwdX = (yaw) => Math.sin(yaw);
export const fwdZ = (yaw) => Math.cos(yaw);
export const rightX = (yaw) => -Math.cos(yaw);
export const rightZ = (yaw) => Math.sin(yaw);

export function round(v, d = 1000) {
  return Math.round(v * d) / d;
}
