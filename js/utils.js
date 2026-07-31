'use strict';

/* Small helpers shared by every module. */
const Utils = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },

  lerp(a, b, t) { return a + (b - a) * t; },

  rand(a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.random() * (b - a);
  },

  randInt(a, b) { return Math.floor(Utils.rand(a, b + 1)); },

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  shuffle(arr, rng) {
    const r = rng || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },

  /* Deterministic PRNG so generated levels are stable between sessions. */
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // --- easing ---------------------------------------------------------
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => (t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInCubic: t => t * t * t,
  easeOutBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic: t => {
    if (t === 0 || t === 1) return t;
    const p = 0.35;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  easeOutBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375;
    return n1 * (t -= 2.625 / d1) * t + .984375;
  },

  /* mm:ss for the life-regeneration timer. */
  formatTime(ms) {
    if (ms <= 0) return '0:00';
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  },

  formatNumber(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); },

  el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  },

  /* Frame-accurate delay used by the animation sequencer. */
  raf() { return new Promise(res => requestAnimationFrame(res)); },
};
