// Tiny namespaced localStorage wrapper (safe when storage is unavailable).
const NS = 'skykart:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[storage] save failed', key, e);
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(NS + key); } catch { /* ignore */ }
}

export function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    const b = base ? base[k] : undefined;
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? deepMerge(b, over[k]) : over[k];
  }
  return out;
}
