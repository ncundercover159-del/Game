// Lap counting, positions, wrong-way detection and race finish.
// Progress is a continuous "raceDist" (metres since the start line), built from
// per-tick deltas of the main-ribbon projection, so shortcuts count naturally
// and reversing over the line can never double count a lap.
import { RACE } from '../config.js';

export class LapSystem {
  constructor(race) {
    this.race = race;
    const w = race.world;
    this.L = w.length;
    this.finishOrder = [];
    this.allDoneAt = -1;
    for (const k of race.karts) this.initKart(k);
  }

  initKart(k) {
    const w = this.race.world;
    const s = k.s ?? w.sAt(k.x, k.y, k.z);
    k.s = s;
    let rel = s - w.startS;
    if (rel > this.L / 2) rel -= this.L;
    if (rel < -this.L / 2) rel += this.L;
    k.raceDist = rel;
    k.lastS = s;
    k.lap = 0;          // completed laps
    k.lapTimes = [];
    k.lapStart = 0;
    k.wrongWay = 0;
    k.isWrongWay = false;
    k.bestDist = rel;
  }

  postStep(race) {
    const L = this.L;
    const laps = race.laps;
    for (const k of race.karts) {
      if (k.eliminated) continue;
      if (k.rescue > 0 && k.rescuePhase === 0) continue; // being carried: don't count
      let ds = k.s - k.lastS;
      if (ds > L / 2) ds -= L;
      if (ds < -L / 2) ds += L;
      if (Math.abs(ds) > 30) ds = 0; // teleport guard
      k.lastS = k.s;
      if (k.finished) continue;
      k.raceDist += ds;
      k.bestDist = Math.max(k.bestDist, k.raceDist);
      const lapNow = Math.floor(k.raceDist / L);
      if (lapNow > k.lap && race.phase === 'racing') {
        k.lap = lapNow;
        const lapTime = race.time - k.lapStart;
        k.lapTimes.push(lapTime);
        k.lapStart = race.time;
        if (k.lap >= laps) {
          this.finish(k);
        } else {
          race.emit('lap', k.id, { lap: k.lap + 1, time: lapTime, final: k.lap + 1 === laps });
          if (k.lap + 1 === laps) race.emit('finalLap', k.id, {});
        }
      }
      // wrong way: heading against the track direction while moving
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
      const dot = fx * (k.tdx ?? 0) + fz * (k.tdz ?? 1);
      if (dot < -0.35 && Math.abs(k.speed) > 4 && k.rescue <= 0) k.wrongWay += 1 / 60;
      else k.wrongWay = Math.max(0, k.wrongWay - 3 / 60);
      const ww = k.wrongWay > RACE.wrongWayTime;
      if (ww !== k.isWrongWay) {
        k.isWrongWay = ww;
        race.emit('wrongWay', k.id, { on: ww });
      }
    }
    this.updatePlaces(race);
    this.checkEnd(race);
  }

  finish(k) {
    const race = this.race;
    k.finished = true;
    k.finishTime = race.time;
    this.finishOrder.push(k.id);
    k.place = this.finishOrder.length;
    k.raceDist = race.laps * this.L;
    race.emit('finish', k.id, { place: k.place, time: k.finishTime });
  }

  updatePlaces(race) {
    const ranked = [...race.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceDist - a.raceDist;
    });
    ranked.forEach((k, i) => {
      if (k.place !== i + 1) {
        const old = k.place;
        k.place = i + 1;
        if (race.phase === 'racing' && old) race.emit('place', k.id, { place: k.place, old });
      }
    });
    race.ranked = ranked;
  }

  // End the race once all humans are done (plus a grace period), placing the rest.
  checkEnd(race) {
    if (race.phase !== 'racing') return;
    const humans = race.karts.filter((k) => k.human && !k.disconnected);
    const allHumansDone = humans.length ? humans.every((k) => k.finished) : race.karts.every((k) => k.finished);
    const everyone = race.karts.every((k) => k.finished || k.eliminated);
    if (everyone) return this.end(race);
    if (allHumansDone) {
      if (this.allDoneAt < 0) this.allDoneAt = race.time;
      // AI keep racing a little; single-player ends quickly, online waits for stragglers
      const grace = humans.length > 1 ? 6 : 4;
      if (race.time - this.allDoneAt > grace) this.end(race);
    } else if (humans.some((k) => k.finished)) {
      const first = Math.min(...humans.filter((k) => k.finished).map((k) => k.finishTime));
      if (race.time - first > RACE.finishGrace) this.end(race);
    }
  }

  end(race) {
    // estimate finish times for anyone still racing
    const L = this.L;
    const remaining = race.karts.filter((k) => !k.finished).sort((a, b) => b.raceDist - a.raceDist);
    for (const k of remaining) {
      const left = race.laps * L - k.raceDist;
      const avg = Math.max(8, k.raceDist / Math.max(1, race.time));
      k.finished = true;
      k.estimated = true;
      k.finishTime = race.time + left / avg;
      this.finishOrder.push(k.id);
      k.place = this.finishOrder.length;
    }
    race.phase = 'finished';
    race.emit('raceEnd', null, { order: [...this.finishOrder] });
  }
}
