'use strict';

/* Persistent player profile: progress, stars, coins and the lives timer. */
const Store = {
  KEY: 'crown-quest-save-v1',
  MAX_LIVES: 5,
  LIFE_MS: 15 * 60 * 1000,

  data: null,

  defaults() {
    return {
      level: 1,          // highest unlocked level
      stars: {},         // levelId -> 0..3
      best: {},          // levelId -> best score
      coins: 500,
      lives: 5,
      livesAt: Date.now(),
      sound: true,
      totalStars: 0,
    };
  },

  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { saved = null; }
    this.data = Object.assign(this.defaults(), saved || {});
    if (typeof this.data.stars !== 'object' || !this.data.stars) this.data.stars = {};
    if (typeof this.data.best !== 'object' || !this.data.best) this.data.best = {};
    SFX.enabled = !!this.data.sound;
    return this.data;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  },

  reset() {
    this.data = this.defaults();
    SFX.enabled = true;
    this.save();
  },

  // --- lives ----------------------------------------------------------

  /* Lives regenerate in real time; recompute lazily whenever they're read. */
  lives() {
    const d = this.data;
    if (d.lives >= this.MAX_LIVES) { d.livesAt = Date.now(); return d.lives; }
    const elapsed = Date.now() - d.livesAt;
    const gained = Math.floor(elapsed / this.LIFE_MS);
    if (gained > 0) {
      d.lives = Math.min(this.MAX_LIVES, d.lives + gained);
      d.livesAt = d.lives >= this.MAX_LIVES ? Date.now() : d.livesAt + gained * this.LIFE_MS;
      this.save();
    }
    return d.lives;
  },

  msToNextLife() {
    if (this.lives() >= this.MAX_LIVES) return 0;
    return Math.max(0, this.LIFE_MS - (Date.now() - this.data.livesAt));
  },

  spendLife() {
    if (this.lives() <= 0) return false;
    if (this.data.lives === this.MAX_LIVES) this.data.livesAt = Date.now();
    this.data.lives--;
    this.save();
    return true;
  },

  addLives(n) {
    this.lives();
    this.data.lives = Math.min(this.MAX_LIVES, this.data.lives + n);
    if (this.data.lives >= this.MAX_LIVES) this.data.livesAt = Date.now();
    this.save();
  },

  refillLives() { this.data.lives = this.MAX_LIVES; this.data.livesAt = Date.now(); this.save(); },

  // --- currency -------------------------------------------------------

  coins() { return this.data.coins; },

  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + n); this.save(); },

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  },

  // --- progress -------------------------------------------------------

  starsFor(levelId) { return this.data.stars[levelId] || 0; },

  bestFor(levelId) { return this.data.best[levelId] || 0; },

  isUnlocked(levelId) { return levelId <= this.data.level; },

  completeLevel(levelId, stars, score) {
    const d = this.data;
    const prev = d.stars[levelId] || 0;
    if (stars > prev) {
      d.stars[levelId] = stars;
      d.totalStars += stars - prev;
    }
    if (score > (d.best[levelId] || 0)) d.best[levelId] = score;
    if (levelId >= d.level) d.level = levelId + 1;
    this.save();
  },

  setSound(on) { this.data.sound = !!on; SFX.enabled = !!on; this.save(); },
};
