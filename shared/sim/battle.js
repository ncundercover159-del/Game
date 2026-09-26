// Battle mode rules: "balloons" (3 balloons each, hits pop one, last kart
// standing or most balloons when time runs out) and "coins" (Coin Runners:
// grab the most coins before time is up; hits scatter your coins).
import { BATTLE } from '../config.js';

export class BattleSystem {
  constructor(race, { variant = 'balloons' } = {}) {
    this.race = race;
    this.variant = variant;
    this.timeLeft = variant === 'coins' ? BATTLE.coinRunnersTime : BATTLE.timeLimit;
    this.spawnT = 0;
    this.ended = false;
    race.battle = this;
    for (const k of race.karts) {
      k.balloons = variant === 'balloons' ? BATTLE.balloons : 0;
      k.score = 0;
      k.coins = 0;
      k.eliminated = false;
    }
    race.hitHooks.push((k, kind, opts) => this.onHit(k, kind, opts));
    // Coin Runners: coins scatter across the arena instead of fixed lines
    if (variant === 'coins' && race.items) {
      for (const c of race.items.coins) c.active = true;
    }
  }

  onHit(k, kind, opts) {
    if (this.ended || kind === 'shrink') return;
    const by = opts.by != null ? this.race.kart(opts.by) : null;
    if (this.variant === 'balloons') {
      if (k.balloons <= 0) return;
      k.balloons--;
      k.invuln = Math.max(k.invuln, BATTLE.respawnInvuln);
      if (by && by !== k) by.score++;
      this.race.emit('balloonPop', k.id, { by: opts.by, left: k.balloons });
      if (k.balloons <= 0) {
        k.eliminated = true;
        k.finished = true;
        k.finishTime = this.race.time;
        this.race.emit('eliminated', k.id, { by: opts.by });
      }
    }
  }

  postStep(race, dt) {
    if (race.phase !== 'racing' || this.ended) return;
    this.timeLeft -= dt;
    // Coin Runners: periodically drop fresh coins around the arena
    if (this.variant === 'coins' && race.items) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 1.2;
        const w = race.world;
        const b = w.bounds || { shape: 'circle', r: 60 };
        const r = (b.shape === 'circle' ? b.r : Math.min(b.w, b.d) / 2) * 0.8;
        let x = 0, z = 0, ok = false;
        const probe = {}, agent = { radius: 1.5 };
        for (let tries = 0; tries < 8 && !ok; tries++) {
          const a = race.rng() * Math.PI * 2, d = Math.sqrt(race.rng()) * r;
          x = Math.cos(a) * d; z = Math.sin(a) * d;
          // never drop coins into lava/pits or inside pillars
          w.probe(agent, x, 50, z, probe);
          ok = probe.ground && probe.pen <= 0 && probe.surface !== 'lava' && probe.surface !== 'void';
        }
        if (ok && race.items.loose.length < 40) race.items.loose.push({ id: race.items.nextId++, x, y: w.heightAt ? w.heightAt(x, z) + 0.9 : 0.9, z, t: 30, delay: 0 });
      }
      for (const k of race.karts) k.score = k.coins;
    }
    this.rank(race);
    const alive = race.karts.filter((k) => !k.eliminated);
    const done = this.timeLeft <= 0 || (this.variant === 'balloons' && alive.length <= 1 && race.karts.length > 1);
    if (done) this.end(race);
  }

  rank(race) {
    const key = (k) => (this.variant === 'balloons'
      ? (k.eliminated ? 0 : 1000) + k.balloons * 100 + k.score + (k.eliminated ? k.finishTime / 1000 : 0)
      : k.coins * 100 + k.score);
    const ranked = [...race.karts].sort((a, b) => key(b) - key(a));
    ranked.forEach((k, i) => { k.place = i + 1; });
    race.ranked = ranked;
  }

  end(race) {
    this.ended = true;
    this.rank(race);
    for (const k of race.karts) {
      if (!k.eliminated) { k.finished = true; k.finishTime = race.time; }
    }
    race.phase = 'finished';
    race.emit('raceEnd', null, { order: race.ranked.map((k) => k.id), battle: this.variant });
  }

  snapshot() { return { v: this.variant, tl: Math.max(0, Math.round(this.timeLeft * 10) / 10) }; }
}
