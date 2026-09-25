// AI drivers. They only produce input frames (steer + buttons), so they obey
// exactly the same physics and item rules as humans. Racing line, drifting,
// shortcuts, avoidance and item tactics depend on difficulty and personality.
import { AI, RUBBER_BAND } from '../config.js';
import { BTN } from '../physics/input.js';
import { ITEM_DEFS } from '../sim/items.js';
import { clamp, wrapAngle, makeRng, fwdX, fwdZ } from '../math.js';

const PERSONALITIES = Object.keys(AI.personalities);

// ---------------------------------------------------------------------------
// Racing line: apex-hugging lane offsets with anticipation, per ribbon.
function buildLine(world) {
  if (world._aiLine) return world._aiLine;
  const lines = world.ribbons.map((R) => {
    const N = R.n;
    const kappa = new Float64Array(N);
    const idx = (i) => (R.closed ? ((i % N) + N) % N : clamp(i, 0, N - 1));
    for (let i = 0; i < N; i++) {
      const a = idx(i - 5), b = idx(i + 5);
      const ya = Math.atan2(R.tx[a], R.tz[a]), yb = Math.atan2(R.tx[b], R.tz[b]);
      kappa[i] = wrapAngle(yb - ya) / (10 * R.step);
    }
    // raw inside-lane target from curvature; smooth with look-ahead bias
    const raw = new Float64Array(N);
    for (let i = 0; i < N; i++) raw[i] = -clamp(kappa[i] * 26, -0.72, 0.72);
    const lane = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0, wsum = 0;
      for (let k = -8; k <= 22; k++) {
        const w = k < 0 ? 0.5 : 1 - k / 26;
        sum += raw[idx(i + k)] * w; wsum += w;
      }
      lane[i] = clamp(sum / wsum, -0.72, 0.72);
    }
    // curvature ahead (sum over next ~40 m), used for drift decisions and braking
    const ahead = new Float64Array(N);
    const look = Math.round(40 / R.step);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let k = 2; k <= look; k++) sum += kappa[idx(i + k)] * R.step;
      ahead[i] = sum; // radians of turning in the next 40 m
    }
    return { kappa, lane, ahead };
  });
  world._aiLine = lines;
  return lines;
}

export class AIController {
  constructor(race, opts = {}) {
    this.race = race;
    this.world = race.world;
    this.difficulty = opts.difficulty || race.cls?.ai || 'normal';
    this.rng = makeRng((opts.seed || 1) * 7919 + 13);
    this.lines = this.world.ribbons ? buildLine(this.world) : null;
    this.states = new Map();
    this.enabled = true;
  }

  stateFor(k) {
    let st = this.states.get(k.id);
    if (!st) {
      const e = k.entrant || {};
      const pers = e.personality && AI.personalities[e.personality] ? e.personality : PERSONALITIES[Math.floor(this.rng() * PERSONALITIES.length)];
      st = {
        diff: AI.difficulties[e.difficulty || this.difficulty] || AI.difficulties.normal,
        persName: pers,
        pers: AI.personalities[pers],
        laneBias: (this.rng() - 0.5) * 0.5,
        noise: 0,
        noiseT: 0,
        itemWait: -1,
        driftHold: 0,
        shortcut: null,
        shortcutLap: -1,
        mistake: 0,
        stuck: 0,
        reverse: 0,
        prevErr: 0,
        holdShield: false,
      };
      this.states.set(k.id, st);
    }
    return st;
  }

  preStep(race, dt) {
    if (!this.enabled) return;
    if (race.phase === 'countdown') {
      // rev at the right moment for a rocket start (better drivers manage it more often)
      for (const k of race.karts) {
        if (k.human) continue;
        const st = this.stateFor(k);
        if (st.rocket === undefined) st.rocket = this.rng() < ({ easy: 0.1, normal: 0.35, hard: 0.6, expert: 0.85 }[this.difficulty] ?? 0.4);
        const rev = st.rocket && race.countdown < 0.34 && race.countdown > 0.12;
        race.setInput(k.id, { steer: 0, btn: rev ? BTN.REV : 0 });
      }
      return;
    }
    this.applyRubberBand(race);
    for (const k of race.karts) {
      if (k.human && !k.finished) continue;
      if (k.eliminated) continue;
      race.setInput(k.id, this.drive(k, dt));
    }
  }

  // Tunable catch-up / leader slowdown (the only "cheat", applied to everyone).
  applyRubberBand(race) {
    const RB = RUBBER_BAND;
    const ranked = race.ranked || race.karts;
    const leader = ranked.find((k) => !k.finished);
    const second = ranked.find((k) => k !== leader && !k.finished);
    for (const k of race.karts) {
      let mul = 1;
      if (RB.enabled && leader && race.mode !== 'timetrial' && race.mode !== 'battle') {
        if (k !== leader) {
          const behind = clamp((leader.raceDist - k.raceDist) / RB.catchUpDistance, 0, 1);
          mul += RB.catchUpMax * behind * (k.human ? RB.humanScale : RB.aiCatchUpScale);
        } else if (second) {
          const lead = clamp((k.raceDist - second.raceDist) / RB.leaderLeadDistance, 0, 1);
          mul -= RB.leaderPenalty * lead * (k.human ? RB.humanScale : 1);
        }
      }
      k.rubberMul = mul;
    }
  }

  // ---------------------------------------------------------------------------
  drive(k, dt) {
    const w = this.world;
    const st = this.stateFor(k);
    const D = st.diff;
    if (!w.ribbons) return this.driveArena(k, st, dt);
    const R = w.ribbons[k.ribbon] || w.main;
    const line = this.lines[R.id] || this.lines[0];
    const speed = Math.abs(k.speed);
    let btn = BTN.ACCEL;

    // noise: slow random walk of lane offset (worse drivers wander more)
    st.noiseT -= dt;
    if (st.noiseT <= 0) { st.noiseT = 0.8 + this.rng() * 1.6; st.noiseTarget = (this.rng() - 0.5) * 2 * D.lineNoise; }
    st.noise += ((st.noiseTarget || 0) - st.noise) * Math.min(1, dt * 1.5);
    const impaired = k.ink > 0 || k.blind > 0;

    // occasional mistakes
    if (st.mistake <= 0 && this.rng() < D.mistake * dt) st.mistake = 0.4 + this.rng() * 0.6;
    st.mistake -= dt;

    // shortcut decision (hard+) when approaching a branch start
    let targetRibbon = R;
    if (R.closed && w.ribbons.length > 1) {
      for (const B of w.ribbons) {
        if (B.closed) continue;
        let d = B.mainFrom - (k.s ?? 0);
        if (d < -w.length / 2) d += w.length;
        if (d > 0 && d < 70) {
          if (st.shortcutLap !== `${k.lap}:${B.id}`) {
            st.shortcutLap = `${k.lap}:${B.id}`;
            const hasBoost = ['shroom', 'shroom3', 'goldShroom'].includes(k.item) || k.goldTime > 0 || k.star > 0;
            const offroadBranch = B.surf[Math.floor(B.n / 2)] !== 'road';
            const chance = !D.shortcuts ? 0 : offroadBranch ? (hasBoost ? 0.95 : 0.1) : (st.diff === AI.difficulties.expert ? 0.9 : 0.55);
            st.shortcut = this.rng() < chance ? B.id : null;
          }
          if (st.shortcut === B.id && d < 45) targetRibbon = B;
        }
      }
    }

    // look-ahead target on the chosen ribbon
    const look = (8 + speed * 0.42) * D.lookAhead * (impaired ? 0.6 : 1);
    let tgt;
    if (targetRibbon !== R) {
      tgt = w.at(Math.min(0.99, 12 / targetRibbon.total), 0, targetRibbon.id);
    } else if (R.closed) {
      const sAhead = (k.s ?? 0) + look;
      const i = Math.floor(((sAhead % w.length) + w.length) % w.length / R.step) % R.n;
      let lane = line.lane[i] + st.laneBias * 0.4 + st.noise + (st.avoid || 0);
      if (impaired) lane += Math.sin(this.race.time * 2.3 + k.id.length) * 0.5;
      tgt = w.at(sAhead / w.length, clamp(lane, -0.85, 0.85));
    } else {
      const i = Math.min(R.n - 1, (k.hint >= 0 ? k.hint : 0) + Math.round(look / R.step));
      tgt = w.at(i / (R.n - 1), clamp(st.noise * 0.5, -0.5, 0.5), R.id);
    }

    let want = Math.atan2(tgt.x - k.x, tgt.z - k.z);
    let err = wrapAngle(want - k.yaw);
    // wrong way / stuck recovery
    if (k.isWrongWay) err = wrapAngle(Math.atan2(k.tdx ?? 0, k.tdz ?? 1) - k.yaw);
    const derr = (err - st.prevErr) / Math.max(dt, 1e-3);
    st.prevErr = err;
    let steer = clamp(-(err * 2.6 + derr * 0.06), -1, 1);
    if (st.mistake > 0) steer = clamp(steer + Math.sin(this.race.time * 9) * 0.8, -1, 1);
    if (st.pers.wobble) steer = clamp(steer + Math.sin(this.race.time * 3 + k.x) * st.pers.wobble * 0.3, -1, 1);

    // stuck: back up and turn
    if (speed < 2 && k.grounded && k.rescue <= 0 && k.spin <= 0 && this.race.phase === 'racing') st.stuck += dt;
    else st.stuck = Math.max(0, st.stuck - dt * 2);
    if (st.stuck > 1.2) { st.reverse = 0.9; st.stuck = 0; }
    if (st.reverse > 0) {
      st.reverse -= dt;
      return { steer: -steer, btn: BTN.BRAKE };
    }

    // braking for very sharp corners on lower difficulties
    const idxNow = R.closed ? Math.floor((k.s ?? 0) / R.step) % R.n : Math.max(0, k.hint);
    const turnAhead = R.closed ? line.ahead[idxNow] || 0 : 0;
    if (Math.abs(err) > 0.9 && speed > 14 && !k.drift) btn = D.brakeTurns < 1 ? BTN.BRAKE : 0;

    // drifting through corners: hop -> hold drift -> release when charged/straightening
    st.driftCd = (st.driftCd || 0) - dt;
    if (D.driftTier > 0 && R.closed) {
      const turn = turnAhead;
      if (!k.drift) {
        if (st.driftPhase === 'hop') {
          st.hopT += dt;
          btn |= BTN.DRIFT;
          steer = st.driftDir * Math.max(0.65, Math.abs(steer));
          if (st.hopT > 0.7) { st.driftPhase = null; st.driftCd = 0.6; btn &= ~BTN.DRIFT; }
        } else if (st.driftPhase === 'drift') {
          st.driftPhase = null; st.driftCd = 0.4; // drift ended (released or cancelled)
        } else if (st.driftCd <= 0 && Math.abs(turn) > 0.6 && speed > 18 && k.grounded && !impaired && k.boostTime <= 0.2) {
          st.driftPhase = 'hop';
          st.hopT = 0;
          st.driftDir = turn > 0 ? -1 : 1; // left turn (positive curvature) -> steer left (negative)
          btn |= BTN.DRIFT;
        }
      } else {
        st.driftPhase = 'drift';
        btn |= BTN.DRIFT;
        const enough = k.driftTier >= D.driftTier;
        const straightening = Math.abs(turn) < 0.25;
        const wrong = Math.sign(-err) !== k.drift && Math.abs(err) > 0.45;
        if ((enough && Math.abs(turn) < 0.55) || straightening || wrong) btn &= ~BTN.DRIFT;
      }
    }

    // obstacle avoidance: hazards and slower karts ahead
    st.avoid = this.avoidance(k, st);

    btn |= this.itemLogic(k, st, dt, turnAhead);
    return { steer, btn };
  }

  avoidance(k, st) {
    const items = this.race.items;
    const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
    let push = 0;
    const consider = (x, z, r, weight) => {
      const dx = x - k.x, dz = z - k.z;
      const along = dx * fx + dz * fz;
      if (along < 2 || along > 28) return;
      const side = dx * -fz + dz * fx; // + = left of us
      if (Math.abs(side) > r + 2.2) return;
      push += (side > 0 ? 1 : -1) * weight * (1 - along / 30);
    };
    if (items && st.diff.lineNoise < 0.4) {
      for (const h of items.hazards) if (h.owner !== k.id || h.kind !== 'peel') consider(h.x, h.z, h.r, 0.8);
    }
    for (const o of this.race.karts) if (o !== k && !o.eliminated && o.speed < k.speed - 3) consider(o.x, o.z, 1.2, 0.35);
    return clamp(push, -0.6, 0.6);
  }

  // ---------------------------------------------------------------------------
  // Item tactics. Returns extra button bits (ITEM/BACK/FWD).
  itemLogic(k, st, dt, turnAhead) {
    const race = this.race;
    const items = race.items;
    if (!items || k.roulette > 0) { st.itemWait = -1; return 0; }
    const has = k.item || k.trailing || (k.orbit && k.orbit.count > 0) || k.goldTime > 0;
    if (!has) { st.itemWait = -1; st.pressT = 0; return 0; }
    if (st.itemWait < 0) {
      const [a, b] = st.diff.itemDelay;
      st.itemWait = (a + this.rng() * (b - a)) / (st.pers.itemEagerness || 1);
    }
    st.itemWait -= dt;
    // keep trailing items held (shield) until a release decision
    const holding = !!k.trailing;
    let btn = holding ? BTN.ITEM : 0;
    // horn/comet counterplay: react instantly to threats
    const threatened = items.projectiles.some((p) => p.target === k.id && (p.kind === 'comet' ? p.phase !== 'fly' : Math.hypot(p.x - k.x, p.z - k.z) < 25));
    if (st.itemWait > 0 && !(threatened && ['horn', 'star', 'tunnel', 'clone', 'flail', 'shroom', 'shroom3'].includes(k.item))) return btn;

    const near = (maxD, ahead = null) => {
      let best = null, bd = maxD;
      const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
      for (const o of race.karts) {
        if (o === k || o.eliminated || o.finished) continue;
        const dx = o.x - k.x, dz = o.z - k.z;
        const d = Math.hypot(dx, dz);
        if (d > bd) continue;
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (ahead === true && dot < 0.8) continue;
        if (ahead === false && dot > -0.5) continue;
        best = o; bd = d;
      }
      return best;
    };
    const straight = Math.abs(turnAhead) < 0.35;
    const press = () => { st.itemWait = -1; return BTN.ITEM; };

    // triple orbiters: fire at targets ahead
    if (k.orbit && k.orbit.count > 0) {
      const t = near(35, true);
      if (t && k.orbit.kind !== 'peel') return st.pressT++ % 2 === 0 ? BTN.ITEM : 0;
      const b = near(14, false);
      if (b) return (st.pressT++ % 2 === 0 ? BTN.ITEM : 0) | BTN.BACK;
      return 0;
    }
    if (k.goldTime > 0) return (st.pressT++ % 12 === 0) ? BTN.ITEM : 0;
    // release trailing item
    if (holding) {
      const kind = k.trailing;
      const shieldy = st.pers.holdShield;
      const front = near(kind === 'seeker' ? 90 : 32, true);
      const back = near(10, false);
      if (kind === 'peel') {
        if (back || (!shieldy && this.rng() < 0.01)) return 0; // release -> drop behind
        return BTN.ITEM;
      }
      if (front && this.rng() < st.pers.fireForward * 0.08) return 0;
      if (back && this.rng() < 0.05) return BTN.BACK; // release while aiming back
      return BTN.ITEM;
    }
    const item = k.item;
    const def = ITEM_DEFS[item];
    if (!def) return 0;
    switch (item) {
      case 'orb': case 'seeker': case 'peel':
        return press(); // start trailing; release logic above
      case 'orb3': case 'seeker3': case 'peel3':
        return press();
      case 'shroom': case 'shroom3': case 'goldShroom':
        if (straight || k.surface !== 'road' || threatened || st.shortcut != null) return press();
        return 0;
      case 'horn':
        if (threatened || near(9)) return press();
        return 0;
      case 'star': case 'tunnel': case 'clone': case 'flail':
        if (threatened || straight || this.rng() < 0.02) return press();
        return 0;
      case 'magnet':
        return near(12) ? press() : 0;
      case 'emp': case 'wave': case 'eruption':
        return near(item === 'eruption' ? 7 : 11) ? press() : 0;
      case 'harpoon': case 'vine': case 'tongue':
        return near(item === 'tongue' ? 28 : 42, true) ? press() : 0;
      case 'boulder': case 'tornado':
        return near(70, true) || this.rng() < 0.01 ? press() : 0;
      case 'roots': case 'flame':
        return near(25, false) || near(9, true) ? press() : 0;
      default:
        return press(); // comet, bolt, ink, flash, swap, drone, coinPack
    }
  }

  // Simple arena driving (battle mode): chase targets / items / coins.
  driveArena(k, st, dt) {
    const race = this.race;
    st.retarget = (st.retarget || 0) - dt;
    if (st.retarget <= 0 || !st.goal) {
      st.retarget = 2 + this.rng() * 2;
      const items = race.items;
      const opts = [];
      for (const o of race.karts) if (o !== k && !o.eliminated) opts.push({ x: o.x, z: o.z, w: st.pers.bumpiness + 0.5 });
      if (!k.item && items) for (const b of items.boxes) if (b.active) opts.push({ x: b.x, z: b.z, w: 1.2 });
      if (items) for (const c of items.loose) opts.push({ x: c.x, z: c.z, w: 1.4 });
      if (race.mode === 'battle' && race.battle?.variant === 'coins' && items) for (const c of items.coins) if (c.active) opts.push({ x: c.x, z: c.z, w: 1.3 });
      let best = null, bs = -Infinity;
      for (const o of opts) {
        const d = Math.hypot(o.x - k.x, o.z - k.z);
        const sc = o.w * 60 / (d + 10) + this.rng() * 0.8;
        if (sc > bs) { bs = sc; best = o; }
      }
      st.goal = best || { x: 0, z: 0 };
    }
    // wall feelers: steer away from walls using the world probe
    const want = Math.atan2(st.goal.x - k.x, st.goal.z - k.z);
    let err = wrapAngle(want - k.yaw);
    const probe = {};
    const agent = { radius: 1 };
    for (const side of [-1, 1]) {
      const a = k.yaw + side * 0.5;
      const px = k.x + Math.sin(a) * 9, pz = k.z + Math.cos(a) * 9;
      this.world.probe(agent, px, k.y + 1, pz, probe);
      if (probe.pen > 0.2) err -= side * 0.6;
    }
    let steer = clamp(-err * 2.2, -1, 1);
    let btn = BTN.ACCEL;
    if (Math.abs(k.speed) < 2 && race.phase === 'racing') st.stuck = (st.stuck || 0) + dt; else st.stuck = 0;
    if (st.stuck > 1) { st.reverse = 0.8; st.stuck = 0; }
    if (st.reverse > 0) { st.reverse -= dt; return { steer: -steer, btn: BTN.BRAKE }; }
    if (Math.abs(err) > 1.2 && k.speed > 12) btn |= BTN.DRIFT;
    btn |= this.itemLogic(k, st, dt, 0);
    return { steer, btn };
  }
}
