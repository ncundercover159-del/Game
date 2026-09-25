// Item system (server-authoritative, deterministic). Handles item boxes,
// roulette, coins, projectiles, dropped hazards, timed effects and every
// core + signature item. Runs inside Race.step via preStep/postStep.
import { ITEMS, ITEM_ODDS, KART, RACE } from '../config.js';
import { BTN } from '../physics/input.js';
import { hitKart, applyBoost, cancelDrift } from '../physics/kart.js';
import { getRacer } from '../data/registry.js';
import { weightedPick, clamp, wrapAngle, fwdX, fwdZ, rightX, rightZ } from '../math.js';

// use: trail (hold behind, release to throw) | orbit (triple orbiters) |
//      boost (count uses) | gold (timed boosts) | instant
export const ITEM_DEFS = {
  orb:        { name: 'Elemental Orb',  use: 'trail', proj: 'orb' },
  orb3:       { name: 'Triple Orbs',    use: 'orbit', count: 3, proj: 'orb' },
  seeker:     { name: 'Seeker Orb',     use: 'trail', proj: 'seeker' },
  seeker3:    { name: 'Triple Seekers', use: 'orbit', count: 3, proj: 'seeker' },
  peel:       { name: 'Slippy Peel',    use: 'trail', drop: 'peel' },
  peel3:      { name: 'Triple Peels',   use: 'orbit', count: 3, drop: 'peel' },
  shroom:     { name: 'Zoom Shroom',    use: 'boost', count: 1 },
  shroom3:    { name: 'Triple Zoom',    use: 'boost', count: 3 },
  goldShroom: { name: 'Golden Zoom',    use: 'gold' },
  comet:      { name: 'Sky Comet',      use: 'instant' },
  bolt:       { name: 'Shrink Bolt',    use: 'instant' },
  ink:        { name: 'Gloom Ink',      use: 'instant' },
  star:       { name: 'Prism Star',     use: 'instant' },
  magnet:     { name: 'Coin Magnet',    use: 'instant' },
  horn:       { name: 'Boom Horn',      use: 'instant' },
  coinPack:   { name: 'Coin Pack',      use: 'instant' },
  // signature items (one per racer)
  swap:     { name: 'Swap Spell',      use: 'instant', sig: true },
  harpoon:  { name: 'Harpoon Hook',    use: 'instant', sig: true },
  tongue:   { name: 'Tongue Lash',     use: 'instant', sig: true },
  drone:    { name: 'Turret Drone',    use: 'instant', sig: true },
  flail:    { name: 'Chain Flail',     use: 'instant', sig: true },
  flame:    { name: 'Flame Puff',      use: 'instant', sig: true },
  eruption: { name: 'Eruption',        use: 'instant', sig: true },
  wave:     { name: 'Wave Surge',      use: 'instant', sig: true },
  boulder:  { name: 'Rolling Boulder', use: 'instant', sig: true },
  tunnel:   { name: 'Tunnel Dash',     use: 'instant', sig: true },
  tornado:  { name: 'Tornado',         use: 'instant', sig: true },
  vine:     { name: 'Vine Grapple',    use: 'instant', sig: true },
  roots:    { name: 'Root Barrier',    use: 'instant', sig: true },
  emp:      { name: 'EMP Burst',       use: 'instant', sig: true },
  flash:    { name: 'Flash',           use: 'instant', sig: true },
  clone:    { name: 'Shadow Clone',    use: 'instant', sig: true },
};

export const ITEM_IDS = Object.keys(ITEM_DEFS);

const HIT = {
  orb: 'spin', seeker: 'tumble', peel: 'spin', comet: 'tumble', boulder: 'squish', tornado: 'tumble',
  bolt: 'spin', harpoon: 'spin', fire: 'spin', roots: 'spin', flail: 'spin',
};

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export function initKartItems(k) {
  k.item = null;
  k.itemCount = 0;
  k.roulette = 0;
  k.rouletteItem = null;
  k.trailing = null;
  k.orbit = null;
  k.orbitAngle = 0;
  k.goldTime = 0;
  k.goldCd = 0;
  k.flail = 0;
  k.cloneShield = 0;
  k.magnetTime = 0;
  k.magnetCd = 0;
  k.itemHeld = false;
  k.coinsTotal = 0;
  k.itemsUsed = 0;
  k.hitsLanded = 0;
}

export class ItemSystem {
  constructor(race, opts = {}) {
    this.race = race;
    this.world = race.world;
    this.enabled = opts.items !== false;
    this.battle = race.mode === 'battle';
    const pl = this.world.placements || { itemBoxes: [], coins: [] };
    this.boxes = pl.itemBoxes.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: this.enabled, t: 0 }));
    this.coins = pl.coins.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, active: true, t: 0 }));
    this.loose = [];       // coins dropped by hits (battle coin runners, magnet)
    this.projectiles = [];
    this.hazards = [];
    this.effects = [];
    this.nextId = 1;
    this.treasure = pl.treasure ? { ...pl.treasure, taken: new Set() } : null;
    for (const k of race.karts) initKartItems(k);
  }

  emit(type, id, data) { this.race.emit(type, id, data); }
  rng() { return this.race.rng(); }

  // Deterministic, position-weighted roll (better items further back).
  roll(k) {
    const race = this.race;
    const n = race.karts.length;
    if (this.battle) {
      const pool = { orb: 20, orb3: 10, seeker: 12, peel: 14, peel3: 8, shroom: 12, star: 5, horn: 6, ink: 5, magnet: 6, bolt: 2 };
      return weightedPick(pool, this.rng());
    }
    let pos = n > 1 ? (k.place - 1) / (n - 1) : 0;
    // far behind the leader: bump up a bucket (rubber-banding via items)
    const leader = race.ranked?.[0];
    if (leader && leader !== k && leader.raceDist - k.raceDist > 260) pos = Math.min(1, pos + 0.25);
    let row = ITEM_ODDS[ITEM_ODDS.length - 1][1];
    for (const [max, weights] of ITEM_ODDS) { if (pos <= max + 1e-9) { row = weights; break; } }
    if (k.place === 1 && n > 1) row = ITEM_ODDS[0][1];
    // signature item replaces the roll sometimes
    const racer = getRacer(k.racerId);
    if (racer?.signature && ITEM_DEFS[racer.signature] && this.rng() < ITEMS.signatureChance) {
      if (!(racer.signature === 'swap' && k.place === 1)) return racer.signature;
    }
    let pick = weightedPick(row, this.rng());
    // only one comet in flight at a time
    if (pick === 'comet' && this.projectiles.some((p) => p.kind === 'comet')) pick = 'seeker';
    return pick;
  }

  // ---------------------------------------------------------------------------
  preStep(race, dt) {
    for (const k of race.karts) {
      if (k.eliminated) continue;
      const inp = race.inputs.get(k.id) || { btn: 0 };
      const held = (inp.btn & BTN.ITEM) !== 0;
      const pressed = held && !k.itemHeld;
      const released = !held && k.itemHeld;
      k.itemHeld = held;
      if (race.phase !== 'racing' || k.rescue > 0 || k.finished) continue;
      const aim = inp.btn & BTN.BACK ? -1 : inp.btn & BTN.FWD ? 1 : 0;
      const stunned = k.spin > 0 || k.tumble > 0;
      if (pressed && !stunned) this.onPress(k, aim);
      if (released && k.trailing && !stunned) {
        const kind = k.trailing;
        k.trailing = null;
        this.throwItem(k, kind, aim);
      }
    }
  }

  onPress(k, aim) {
    if (k.orbit && k.orbit.count > 0) {
      const kind = k.orbit.kind;
      k.orbit.count--;
      if (k.orbit.count <= 0) k.orbit = null;
      this.throwItem(k, kind, aim);
      return;
    }
    if (k.goldTime > 0) {
      if (k.goldCd <= 0) {
        applyBoost(k, KART.shroomBoostTime * 0.85, KART.shroomBoostMul, 'shroom', this.race.emit);
        k.goldCd = 0.3;
        this.emit('itemUse', k.id, { item: 'goldShroom' });
      }
      return;
    }
    if (!k.item || k.roulette > 0) return;
    const item = k.item;
    const def = ITEM_DEFS[item];
    k.itemsUsed++;
    switch (def.use) {
      case 'trail':
        k.trailing = def.proj || def.drop;
        k.item = null;
        this.emit('itemUse', k.id, { item, trail: true });
        break;
      case 'orbit':
        k.orbit = { kind: def.proj || def.drop, count: def.count };
        k.item = null;
        this.emit('itemUse', k.id, { item, orbit: true });
        break;
      case 'boost':
        applyBoost(k, KART.shroomBoostTime, KART.shroomBoostMul, 'shroom', this.race.emit);
        k.itemCount--;
        if (k.itemCount <= 0) k.item = null;
        this.emit('itemUse', k.id, { item });
        break;
      case 'gold':
        k.goldTime = ITEMS.goldShroomTime;
        k.item = null;
        applyBoost(k, KART.shroomBoostTime, KART.shroomBoostMul, 'shroom', this.race.emit);
        k.goldCd = 0.3;
        this.emit('itemUse', k.id, { item });
        break;
      default:
        k.item = null;
        this.useInstant(k, item, aim);
        this.emit('itemUse', k.id, { item });
    }
  }

  // ---------------------------------------------------------------------------
  spawnProjectile(o) {
    const p = {
      id: this.nextId++, kind: o.kind, owner: o.owner, x: o.x, y: o.y, z: o.z, vy: o.vy || 0,
      yaw: o.yaw, speed: o.speed, life: o.life, bounces: o.bounces ?? 0, target: o.target ?? null,
      safe: o.safe ?? 0.35, radius: o.radius ?? 0.6, hint: o.hint ?? -1, ribbon: o.ribbon ?? 0,
      grounded: o.grounded ?? true, phase: o.phase || 'fly', t: 0, lane: o.lane ?? 0, element: o.element,
      s: o.s, dist: o.dist ?? 0, hover: o.hover ?? 0.55, pierce: !!o.pierce, hitSet: o.pierce ? [] : null,
    };
    this.projectiles.push(p);
    return p;
  }

  spawnHazard(o) {
    const h = { id: this.nextId++, kind: o.kind, owner: o.owner, x: o.x, y: o.y, z: o.z, r: o.r ?? ITEMS.peelRadius, life: o.life ?? 9999, safe: o.safe ?? 0.4, persist: !!o.persist, element: o.element };
    this.hazards.push(h);
    return h;
  }

  aheadOf(k, maxDist = 1e9) {
    // the racer one place ahead (or nearest ahead in race distance)
    const ranked = this.race.ranked || this.race.karts;
    let best = null;
    for (const o of ranked) {
      if (o === k || o.finished || o.eliminated || o.rescue > 0) continue;
      const d = o.raceDist - k.raceDist;
      if (this.battle) {
        const dd = Math.sqrt(dist2(o, k));
        if (dd < maxDist && (!best || dd < best.d)) best = { k: o, d: dd };
        continue;
      }
      if (d > 0 && d < maxDist && (!best || d < best.d)) best = { k: o, d };
    }
    return best?.k || null;
  }

  throwItem(k, kind, aim) {
    const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
    const back = aim < 0 || (kind === 'peel' && aim === 0);
    if (kind === 'peel') {
      if (back) {
        this.spawnHazard({ kind: 'peel', owner: k.id, x: k.x - fx * ITEMS.trailDistance, y: k.groundH ?? k.y, z: k.z - fz * ITEMS.trailDistance, element: k.element });
        this.emit('drop', k.id, { kind });
      } else {
        this.spawnProjectile({ kind: 'peelThrow', owner: k.id, x: k.x + fx * 2, y: k.y + 1.2, z: k.z + fz * 2, yaw: k.yaw, speed: Math.max(0, k.speed) + 14, vy: 7, life: 3, grounded: false, hint: k.hint, ribbon: k.ribbon, element: k.element });
        this.emit('throw', k.id, { kind, dir: 1 });
      }
      return;
    }
    const dir = back ? -1 : 1;
    const yaw = dir > 0 ? k.yaw : wrapAngle(k.yaw + Math.PI);
    const off = dir > 0 ? 2.4 : -ITEMS.trailDistance;
    const base = { owner: k.id, x: k.x + fx * off, y: (k.groundH ?? k.y) + 0.55, z: k.z + fz * off, yaw, hint: k.hint, ribbon: k.ribbon, element: k.element, lane: k.lane || 0 };
    if (kind === 'orb') {
      this.spawnProjectile({ ...base, kind: 'orb', speed: ITEMS.orbSpeed + Math.max(0, k.speed) * 0.3, life: ITEMS.orbLife, bounces: ITEMS.orbBounces });
    } else if (kind === 'seeker') {
      const target = dir > 0 ? this.aheadOf(k)?.id ?? null : null;
      this.spawnProjectile({ ...base, kind: target ? 'seeker' : 'orb', target, speed: ITEMS.seekerSpeed + Math.max(0, k.speed) * 0.3, life: ITEMS.seekerLife, bounces: target ? 99 : ITEMS.orbBounces });
      if (target) this.emit('homing', target, { by: k.id });
    }
    this.emit('throw', k.id, { kind, dir });
  }

  // ---------------------------------------------------------------------------
  useInstant(k, item, aim) {
    const race = this.race;
    const others = race.karts.filter((o) => o !== k && !o.eliminated && !o.finished);
    const emit = race.emit;
    switch (item) {
      case 'coinPack':
        this.giveCoins(k, 3);
        break;
      case 'star':
        k.star = ITEMS.starTime;
        applyBoost(k, 1.0, 1.2, 'star', emit);
        break;
      case 'bolt': {
        const n = race.karts.length;
        for (const o of others) {
          if (o.star > 0 || o.burrow > 0) continue;
          const t = ITEMS.boltShrink * (1.25 - 0.6 * ((o.place - 1) / Math.max(1, n - 1)));
          this.dropHeld(o);
          if (this.hit(o, 'shrink', { by: k.id, time: t, src: 'bolt' })) { /* counted in hit */ }
        }
        this.emit('bolt', k.id, {});
        break;
      }
      case 'ink':
        for (const o of others) if (o.raceDist > k.raceDist || this.battle) o.ink = ITEMS.inkTime;
        this.emit('ink', k.id, {});
        break;
      case 'magnet':
        k.magnetTime = ITEMS.magnetTime;
        k.magnetCd = 0;
        break;
      case 'horn':
        this.shockwave(k, ITEMS.hornRadius, 'horn', { destroy: true, hitKind: 'spin', push: 14 });
        break;
      case 'comet': {
        const leader = (race.ranked || race.karts).find((o) => !o.finished && !o.eliminated) || k;
        const s = k.s ?? 0;
        this.spawnProjectile({ kind: 'comet', owner: k.id, x: k.x, y: k.y + 6, z: k.z, yaw: k.yaw, speed: ITEMS.cometSpeed, life: 40, target: leader.id, s, dist: k.raceDist, grounded: false, radius: 1.5 });
        this.emit('cometWarn', leader.id, { by: k.id });
        break;
      }
      // --- signature items -------------------------------------------------------
      case 'swap': {
        const ahead = (race.ranked || race.karts).filter((o) => o !== k && !o.finished && !o.eliminated && o.raceDist > k.raceDist && o.place >= k.place - 3);
        if (!ahead.length) { this.giveCoins(k, 3); break; }
        const target = ahead[Math.floor(this.rng() * ahead.length)];
        this.effects.push({ id: this.nextId++, kind: 'swap', owner: k.id, target: target.id, t: 2.0 });
        this.emit('swapWarn', k.id, { target: target.id });
        break;
      }
      case 'harpoon': {
        const target = this.nearestAhead(k, 70, 0.3);
        const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
        this.spawnProjectile({ kind: 'harpoon', owner: k.id, x: k.x + fx * 2, y: k.y + 1, z: k.z + fz * 2, yaw: k.yaw, speed: 68, life: 1.4, target: target?.id ?? null, hint: k.hint, ribbon: k.ribbon, bounces: 0, element: k.element });
        break;
      }
      case 'tongue': {
        const target = this.nearestAhead(k, 32, 0.55);
        if (target) {
          let stolen = null;
          if (target.item && target.roulette <= 0) { stolen = target.item; k.item = target.item; k.itemCount = target.itemCount; target.item = null; }
          else if (target.trailing) { stolen = target.trailing === 'peel' ? 'peel' : target.trailing === 'seeker' ? 'seeker' : 'orb'; k.item = stolen; k.itemCount = 1; target.trailing = null; }
          else { const n = Math.min(2, target.coins); target.coins -= n; this.giveCoins(k, n); }
          this.emit('steal', k.id, { target: target.id, item: stolen, kind: 'tongue' });
        } else this.emit('steal', k.id, { target: null, kind: 'tongue' });
        break;
      }
      case 'drone':
        this.effects.push({ id: this.nextId++, kind: 'drone', owner: k.id, t: 8, cd: 0.6, x: k.x, y: k.y + 2.5, z: k.z });
        break;
      case 'flail':
        k.flail = 5;
        break;
      case 'flame': {
        this.effects.push({ id: this.nextId++, kind: 'fireTrail', owner: k.id, t: 1.5, cd: 0 });
        // forward puff scorches racers just ahead
        for (const o of others) {
          const dx = o.x - k.x, dz = o.z - k.z;
          const d = Math.hypot(dx, dz);
          if (d < 10 && (dx * fwdX(k.yaw) + dz * fwdZ(k.yaw)) / (d || 1) > 0.6) this.hit(o, 'spin', { by: k.id, src: 'fire', time: 0.9 });
        }
        applyBoost(k, 0.6, 1.18, 'flame', emit);
        break;
      }
      case 'eruption':
        this.shockwave(k, 9, 'eruption', { hitKind: 'tumble', push: 10 });
        break;
      case 'wave': {
        for (const o of others) {
          const dx = o.x - k.x, dz = o.z - k.z;
          const d = Math.hypot(dx, dz);
          if (d > 14 || o.star > 0 || o.burrow > 0) continue;
          // push sideways relative to the caster's heading
          const side = dx * rightX(k.yaw) + dz * rightZ(k.yaw) >= 0 ? 1 : -1;
          o.ex += rightX(k.yaw) * side * 16;
          o.ez += rightZ(k.yaw) * side * 16;
          o.speed *= 0.8;
          cancelDrift(o);
        }
        applyBoost(k, 0.9, 1.26, 'wave', emit);
        this.emit('shock', k.id, { x: k.x, y: k.y, z: k.z, r: 14, kind: 'wave' });
        break;
      }
      case 'boulder': {
        const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
        this.spawnProjectile({ kind: 'boulder', owner: k.id, x: k.x + fx * 3.5, y: (k.groundH ?? k.y) + 2.2, z: k.z + fz * 3.5, yaw: k.yaw, speed: 44, life: 8, hint: k.hint, ribbon: k.ribbon, radius: 2.3, hover: 2.2, bounces: 99, pierce: true, lane: k.lane || 0 });
        break;
      }
      case 'tunnel':
        k.burrow = 2.5;
        applyBoost(k, 2.5, 1.14, 'tunnel', emit);
        this.effects.push({ id: this.nextId++, kind: 'tunnel', owner: k.id, t: 2.5 });
        break;
      case 'tornado': {
        const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
        this.spawnProjectile({ kind: 'tornado', owner: k.id, x: k.x + fx * 3, y: (k.groundH ?? k.y) + 0.2, z: k.z + fz * 3, yaw: k.yaw, speed: 40, life: 6, hint: k.hint, ribbon: k.ribbon, radius: 1.8, hover: 0.2, bounces: 99, lane: k.lane || 0 });
        break;
      }
      case 'vine': {
        const target = this.nearestAhead(k, 48, 0.2);
        if (target && target.star <= 0 && target.burrow <= 0) {
          target.speed *= 0.35;
          target.ex -= fwdX(target.yaw) * 9;
          target.ez -= fwdZ(target.yaw) * 9;
          cancelDrift(target);
          applyBoost(k, 1.0, 1.3, 'vine', emit);
          this.emit('vine', k.id, { target: target.id });
        } else this.emit('vine', k.id, { target: null });
        break;
      }
      case 'roots': {
        const fx = fwdX(k.yaw), fz = fwdZ(k.yaw), rx = rightX(k.yaw), rz = rightZ(k.yaw);
        const hw = 9;
        for (let i = -2; i <= 2; i++) {
          const L = (i / 2) * hw * 0.85;
          this.spawnHazard({ kind: 'roots', owner: k.id, x: k.x - fx * 7 + rx * L, y: k.groundH ?? k.y, z: k.z - fz * 7 + rz * L, r: 2.1, life: 6, persist: true, safe: 0.8 });
        }
        this.emit('roots', k.id, {});
        break;
      }
      case 'emp':
        for (const o of others) {
          if (Math.sqrt(dist2(o, k)) > 14 || o.star > 0 || o.burrow > 0) continue;
          this.dropHeld(o);
          o.boostTime = 0;
          o.speed *= 0.75;
          cancelDrift(o);
          this.emit('emped', o.id, { by: k.id });
        }
        this.emit('shock', k.id, { x: k.x, y: k.y, z: k.z, r: 14, kind: 'emp' });
        break;
      case 'flash':
        for (const o of others) o.blind = 2.5;
        this.emit('flash', k.id, {});
        break;
      case 'clone':
        k.ghost = 6;
        k.cloneShield = 1;
        break;
      default:
        console.warn('[items] unhandled item', item);
    }
  }

  nearestAhead(k, maxD, minDot) {
    let best = null, bd = maxD;
    const fx = fwdX(k.yaw), fz = fwdZ(k.yaw);
    for (const o of this.race.karts) {
      if (o === k || o.eliminated || o.finished || o.rescue > 0) continue;
      const dx = o.x - k.x, dz = o.z - k.z;
      const d = Math.hypot(dx, dz);
      if (d > bd || d < 0.5) continue;
      if ((dx * fx + dz * fz) / d < minDot) continue;
      best = o; bd = d;
    }
    return best;
  }

  dropHeld(o) {
    o.item = null; o.itemCount = 0; o.roulette = 0; o.rouletteItem = null;
    o.trailing = null; o.orbit = null; o.goldTime = 0;
  }

  giveCoins(k, n) {
    if (n <= 0) return;
    const before = k.coins;
    k.coins = Math.min(this.battle ? 99 : KART.coinMax, k.coins + n);
    k.coinsTotal += n;
    this.emit('coin', k.id, { n, total: k.coins, gained: k.coins - before });
  }

  shockwave(k, r, kind, { destroy = false, hitKind = 'spin', push = 0 } = {}) {
    for (const o of this.race.karts) {
      if (o === k || o.eliminated) continue;
      const d = Math.sqrt(dist2(o, k));
      if (d > r) continue;
      if (push && d > 0.1) { o.ex += ((o.x - k.x) / d) * push; o.ez += ((o.z - k.z) / d) * push; }
      this.hit(o, hitKind, { by: k.id, src: kind });
    }
    if (destroy) {
      for (const p of this.projectiles) {
        if (p.owner !== k.id && Math.sqrt(dist2(p, k)) < r + (p.kind === 'comet' ? 6 : 0)) { p.dead = true; this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind }); }
      }
      for (const h of this.hazards) if (Math.sqrt(dist2(h, k)) < r) { h.dead = true; this.emit('pop', null, { x: h.x, y: h.y, z: h.z, kind: h.kind }); }
    }
    this.emit('shock', k.id, { x: k.x, y: k.y, z: k.z, r, kind });
  }

  // Central hit resolution with shields. Returns true if the hit landed.
  hit(o, kind, opts = {}) {
    if (o.eliminated || o.rescue > 0 || o.burrow > 0) return false;
    if (o.star > 0 && kind !== 'shrink') return false;
    if (opts.projectile && o.flail > 0) { this.emit('shielded', o.id, { by: opts.by, kind: 'flail' }); return false; }
    if (o.cloneShield > 0 && kind !== 'shrink') {
      o.cloneShield = 0; o.ghost = 0;
      this.emit('shielded', o.id, { by: opts.by, kind: 'clone' });
      return false;
    }
    if (opts.projectile && o.orbit?.count > 0) {
      o.orbit.count--;
      if (o.orbit.count <= 0) o.orbit = null;
      this.emit('shielded', o.id, { by: opts.by, kind: 'orbit' });
      return false;
    }
    if (opts.projectile && o.trailing && opts.fromBehind) {
      o.trailing = null;
      this.emit('shielded', o.id, { by: opts.by, kind: 'trail' });
      return false;
    }
    const landed = hitKart(o, kind, this.race.emit, { by: opts.by, time: opts.time, ignoreInvuln: opts.ignoreInvuln });
    if (landed) {
      if (kind !== 'shrink') { o.trailing = null; if (o.orbit) o.orbit = null; o.goldTime = 0; }
      const by = opts.by != null ? this.race.kart(opts.by) : null;
      if (by && by !== o) by.hitsLanded++;
      this.emit('itemHit', o.id, { by: opts.by, src: opts.src || kind, kind });
      for (const fn of this.race.hitHooks || []) fn(o, kind, opts);
      // coins scatter as loose pickups in battle
      if (this.battle && opts.dropCoins !== false) this.scatterCoins(o);
    }
    return landed;
  }

  scatterCoins(o) {
    const n = Math.min(o.coins, 5);
    o.coins -= n;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + o.yaw;
      this.loose.push({ id: this.nextId++, x: o.x + Math.cos(a) * 3, y: (o.groundH ?? o.y) + 0.9, z: o.z + Math.sin(a) * 3, t: 12, delay: 0.6 });
    }
  }

  // ---------------------------------------------------------------------------
  postStep(race, dt) {
    if (race.phase === 'countdown') return;
    this.updateKarts(race, dt);
    this.updateBoxes(race, dt);
    this.updateCoins(race, dt);
    this.updateProjectiles(race, dt);
    this.updateHazards(race, dt);
    this.updateEffects(race, dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.hazards = this.hazards.filter((h) => !h.dead);
    this.effects = this.effects.filter((e) => !e.dead);
  }

  updateKarts(race, dt) {
    for (const k of race.karts) {
      if (k.roulette > 0) {
        k.roulette -= dt;
        if (k.roulette <= 0) {
          k.roulette = 0;
          k.item = k.rouletteItem;
          k.itemCount = ITEM_DEFS[k.item]?.count || 1;
          k.rouletteItem = null;
          this.emit('itemReady', k.id, { item: k.item });
        }
      }
      if (k.goldTime > 0) { k.goldTime -= dt; k.goldCd -= dt; if (k.goldTime <= 0) k.goldTime = 0; }
      if (k.orbit) k.orbitAngle += dt * 4.2;
      if (k.flail > 0) {
        k.flail -= dt;
        k.orbitAngle += dt * 5;
        const a = k.orbitAngle * 1.6;
        const bx = k.x + Math.cos(a) * 2.6, bz = k.z + Math.sin(a) * 2.6;
        for (const o of race.karts) {
          if (o === k || o.eliminated) continue;
          if ((o.x - bx) ** 2 + (o.z - bz) ** 2 < 2.2 && Math.abs(o.y - k.y) < 2) this.hit(o, 'spin', { by: k.id, src: 'flail' });
        }
        for (const p of this.projectiles) {
          if (p.owner !== k.id && (p.x - bx) ** 2 + (p.z - bz) ** 2 < 3 && p.kind !== 'comet') { p.dead = true; this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind }); }
        }
      }
      if (k.magnetTime > 0) {
        k.magnetTime -= dt;
        k.magnetCd -= dt;
        if (k.magnetCd <= 0) {
          k.magnetCd = 0.5;
          for (const o of race.karts) {
            if (o === k || o.coins <= 0 || o.eliminated) continue;
            if (Math.sqrt(dist2(o, k)) < ITEMS.magnetRadius) {
              o.coins--;
              this.giveCoins(k, 1);
              this.emit('steal', k.id, { target: o.id, kind: 'magnet' });
            }
          }
        }
        // vacuum nearby track coins
        for (const c of this.coins) if (c.active && dist2(c, k) < 100 && Math.abs(c.y - k.y) < 4) this.collectCoin(k, c);
      }
    }
  }

  updateBoxes(race, dt) {
    for (const b of this.boxes) {
      if (!b.active) {
        b.t -= dt;
        if (b.t <= 0) { b.active = true; this.emit('boxRespawn', null, { box: b.id }); }
        continue;
      }
      for (const k of race.karts) {
        if (k.eliminated || k.rescue > 0 || k.burrow > 0) continue;
        if ((k.x - b.x) ** 2 + (k.z - b.z) ** 2 < 5.3 && Math.abs(k.y + 0.8 - b.y) < 2.6) {
          b.active = false;
          b.t = ITEMS.boxRespawn;
          const canTake = !k.item && k.roulette <= 0 && k.goldTime <= 0 && !(k.orbit?.count > 0) && !k.finished;
          if (canTake) {
            k.roulette = ITEMS.rouletteTime;
            k.rouletteItem = this.roll(k);
          }
          this.emit('itemBox', k.id, { box: b.id, got: canTake });
          break;
        }
      }
    }
  }

  collectCoin(k, c) {
    c.active = false;
    c.t = 18;
    this.giveCoins(k, 1);
    this.emit('coinPick', k.id, { coin: c.id, x: c.x, y: c.y, z: c.z });
  }

  updateCoins(race, dt) {
    for (const c of this.coins) {
      if (!c.active) { c.t -= dt; if (c.t <= 0) c.active = true; continue; }
      for (const k of race.karts) {
        if (k.eliminated || k.rescue > 0) continue;
        if ((k.x - c.x) ** 2 + (k.z - c.z) ** 2 < 3.2 && Math.abs(k.y + 0.6 - c.y) < 2.2) { this.collectCoin(k, c); break; }
      }
    }
    for (const c of this.loose) {
      c.t -= dt;
      c.delay -= dt;
      if (c.delay > 0) continue;
      for (const k of race.karts) {
        if (k.eliminated || k.rescue > 0) continue;
        if ((k.x - c.x) ** 2 + (k.z - c.z) ** 2 < 3.6) { c.t = 0; this.giveCoins(k, 1); this.emit('coinPick', k.id, { x: c.x, y: c.y, z: c.z }); break; }
      }
    }
    this.loose = this.loose.filter((c) => c.t > 0);
    // hidden treasure chest (progression collectible)
    if (this.treasure) {
      for (const k of race.karts) {
        if (!k.human || this.treasure.taken.has(k.id)) continue;
        if ((k.x - this.treasure.x) ** 2 + (k.z - this.treasure.z) ** 2 < 6 && Math.abs(k.y - this.treasure.y) < 3) {
          this.treasure.taken.add(k.id);
          this.emit('treasure', k.id, {});
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  updateProjectiles(race, dt) {
    const w = this.world;
    const pr = this._pr || (this._pr = {});
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.t += dt;
      p.life -= dt;
      p.safe -= dt;
      if (p.life <= 0) { p.dead = true; if (p.kind !== 'comet') this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind }); continue; }
      if (p.kind === 'comet') { this.updateComet(p, race, dt); continue; }
      if (p.kind === 'peelThrow') {
        p.vy -= KART.gravity * dt;
        p.x += fwdX(p.yaw) * p.speed * dt;
        p.z += fwdZ(p.yaw) * p.speed * dt;
        p.y += p.vy * dt;
        w.probe(p, p.x, p.y, p.z, pr);
        if (pr.ground && p.y <= pr.h && p.vy < 0) {
          p.dead = true;
          this.spawnHazard({ kind: 'peel', owner: p.owner, x: p.x, y: pr.h, z: p.z, safe: 0, element: p.element });
        } else if (!pr.ground && p.y < (w.minY ?? 0) - 30) p.dead = true;
        continue;
      }
      // steering
      const target = p.target != null ? race.kart(p.target) : null;
      if ((p.kind === 'seeker' || p.kind === 'harpoon' || p.kind === 'bolt') && target && !target.finished && target.rescue <= 0) {
        const d = Math.sqrt(dist2(p, target));
        let ax = target.x, az = target.z;
        if (p.kind === 'seeker' && d > 30 && w.at && p.s !== undefined) {
          const a = w.at(((p.s + 14) % w.length) / w.length, clamp(target.lane || 0, -0.7, 0.7));
          ax = a.x; az = a.z;
        }
        const want = Math.atan2(ax - p.x, az - p.z);
        const turn = (p.kind === 'harpoon' ? 7 : p.kind === 'bolt' ? 6 : ITEMS.seekerTurn) * dt;
        p.yaw = wrapAngle(p.yaw + clamp(wrapAngle(want - p.yaw), -turn, turn));
      } else if ((p.kind === 'boulder' || p.kind === 'tornado') && w.at && p.s !== undefined) {
        // roll along the track, keeping its lane
        const a = w.at(((p.s + 12) % w.length) / w.length, clamp(p.lane, -0.75, 0.75));
        const want = Math.atan2(a.x - p.x, a.z - p.z);
        const turn = 2.6 * dt;
        p.yaw = wrapAngle(p.yaw + clamp(wrapAngle(want - p.yaw), -turn, turn));
      }
      p.x += fwdX(p.yaw) * p.speed * dt;
      p.z += fwdZ(p.yaw) * p.speed * dt;
      w.probe(p, p.x, p.y, p.z, pr);
      if (pr.pen > 0) {
        p.x += pr.wnx * pr.pen;
        p.z += pr.wnz * pr.pen;
        if (p.bounces <= 0 || p.kind === 'harpoon') { p.dead = true; this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind }); continue; }
        p.bounces--;
        // reflect heading about the wall normal
        const vx = fwdX(p.yaw), vz = fwdZ(p.yaw);
        const vn = vx * pr.wnx + vz * pr.wnz;
        if (vn < 0) p.yaw = Math.atan2(vx - 2 * vn * pr.wnx, vz - 2 * vn * pr.wnz);
        this.emit('bounce', null, { x: p.x, y: p.y, z: p.z });
      }
      if (pr.ground && p.y - p.hover <= pr.h + 1.5) {
        p.y += (pr.h + p.hover - p.y) * Math.min(1, dt * 20);
        p.vy = 0;
      } else {
        p.vy -= KART.gravity * dt;
        p.y += p.vy * dt;
        if (pr.ground && p.y < pr.h + p.hover) { p.y = pr.h + p.hover; p.vy = 0; }
        if (p.y < (w.minY ?? 0) - 25) { p.dead = true; continue; }
      }
      // hits
      for (const k of race.karts) {
        if (k.eliminated || k.rescue > 0 || k.burrow > 0) continue;
        if (k.id === p.owner && p.safe > 0) continue;
        if (p.hitSet && p.hitSet.includes(k.id)) continue;
        const rr = (ITEMS.hitRadius + p.radius * 0.5) * (k.shrink > 0 ? 0.7 : 1) * (k.ghost > 0 ? 1.4 : 1);
        if (dist2(p, k) < rr * rr && Math.abs(p.y - (k.y + 0.5)) < 2.2 + p.radius) {
          const fromBehind = fwdX(p.yaw) * fwdX(k.yaw) + fwdZ(p.yaw) * fwdZ(k.yaw) > 0;
          const kind = HIT[p.kind] || 'spin';
          const landed = this.hit(k, kind, { by: p.owner, projectile: true, fromBehind, src: p.kind, time: p.kind === 'bolt' || p.kind === 'harpoon' ? 0.6 : undefined });
          if (landed && p.kind === 'tornado') { k.vy = 13; k.grounded = false; }
          if (landed && p.kind === 'harpoon') {
            const owner = race.kart(p.owner);
            if (owner) applyBoost(owner, 1.2, 1.36, 'reel', race.emit);
          }
          if (p.hitSet) p.hitSet.push(k.id);
          else { p.dead = true; this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind, hit: landed }); }
          if (p.kind === 'tornado' && landed) { p.dead = true; }
          break;
        }
      }
      if (p.dead) continue;
      // projectile vs hazards / other projectiles
      for (const h of this.hazards) {
        if (h.dead) continue;
        if (dist2(p, h) < (h.r + p.radius) ** 2) {
          if (h.kind === 'roots') { p.dead = true; }
          else if (p.kind !== 'tornado') { h.dead = true; if (!p.pierce) p.dead = true; }
          this.emit('pop', null, { x: h.x, y: h.y, z: h.z, kind: h.kind });
          break;
        }
      }
      if (p.dead) continue;
      if (p.kind === 'orb' || p.kind === 'seeker') {
        for (const q of this.projectiles) {
          if (q === p || q.dead || q.kind === 'comet' || q.kind === 'peelThrow') continue;
          if (dist2(p, q) < (p.radius + q.radius + 0.4) ** 2) {
            if (!q.pierce) q.dead = true;
            p.dead = true;
            this.emit('pop', null, { x: p.x, y: p.y, z: p.z, kind: p.kind });
            break;
          }
        }
      }
      // orbiters / trailing items on karts also block projectiles by contact
      if (!p.dead) {
        for (const k of race.karts) {
          if (k.id === p.owner || (!k.orbit && !k.trailing)) continue;
          if (k.orbit) {
            const n = k.orbit.count;
            for (let i = 0; i < n; i++) {
              const a = k.orbitAngle + (i / n) * Math.PI * 2;
              const ox = k.x + Math.cos(a) * ITEMS.orbitRadius, oz = k.z + Math.sin(a) * ITEMS.orbitRadius;
              if ((p.x - ox) ** 2 + (p.z - oz) ** 2 < 1.4) {
                p.dead = true; k.orbit.count--; if (k.orbit.count <= 0) k.orbit = null;
                this.emit('shielded', k.id, { kind: 'orbit' });
                break;
              }
            }
          }
          if (p.dead) break;
        }
      }
    }
  }

  updateComet(p, race, dt) {
    const w = this.world;
    let target = race.kart(p.target);
    // retarget to the current leader if the old one finished
    if (!target || target.finished || target.eliminated) {
      target = (race.ranked || race.karts).find((o) => !o.finished && !o.eliminated);
      if (!target) { p.dead = true; return; }
      p.target = target.id;
    }
    if (p.phase === 'fly') {
      p.dist += p.speed * dt;
      p.s = (p.s + p.speed * dt) % (w.length || 1);
      if (w.at && !this.battle) {
        const a = w.at(p.s / w.length, 0, 0, 7);
        p.x = a.x; p.y = a.y; p.z = a.z;
      } else {
        const d = Math.sqrt(dist2(p, target)) || 1;
        p.x += ((target.x - p.x) / d) * p.speed * dt;
        p.z += ((target.z - p.z) / d) * p.speed * dt;
        p.y += (target.y + 7 - p.y) * dt * 3;
      }
      if ((w.at && !this.battle ? target.raceDist - p.dist < 8 : Math.sqrt(dist2(p, target)) < 8)) { p.phase = 'hover'; p.t = 0; }
    } else if (p.phase === 'hover') {
      p.x += (target.x - p.x) * Math.min(1, dt * 8);
      p.z += (target.z - p.z) * Math.min(1, dt * 8);
      p.y += (target.y + 6 - p.y) * Math.min(1, dt * 6);
      if (p.t > 0.8) { p.phase = 'dive'; p.t = 0; p.tx = target.x; p.ty = target.y; p.tz = target.z; }
    } else if (p.phase === 'dive') {
      const f = Math.min(1, p.t / 0.32);
      p.x += (p.tx - p.x) * f; p.z += (p.tz - p.z) * f; p.y += (p.ty + 0.5 - p.y) * f;
      if (p.t >= 0.32) {
        p.dead = true;
        this.emit('explosion', null, { x: p.tx, y: p.ty, z: p.tz, r: ITEMS.cometRadius, kind: 'comet' });
        for (const k of race.karts) {
          if (k.eliminated) continue;
          if ((k.x - p.tx) ** 2 + (k.z - p.tz) ** 2 < ITEMS.cometRadius ** 2 && Math.abs(k.y - p.ty) < 5) {
            this.hit(k, 'tumble', { by: p.owner, src: 'comet', ignoreInvuln: true });
          }
        }
      }
    }
  }

  updateHazards(race, dt) {
    for (const h of this.hazards) {
      h.life -= dt;
      h.safe -= dt;
      if (h.life <= 0) { h.dead = true; continue; }
      for (const k of race.karts) {
        if (k.eliminated || k.rescue > 0 || k.burrow > 0) continue;
        if (k.id === h.owner && h.safe > 0) continue;
        const rr = h.r + KART.radius * 0.7;
        if (dist2(h, k) < rr * rr && Math.abs(k.y - h.y) < 2) {
          const landed = this.hit(k, HIT[h.kind] || 'spin', { by: h.owner, src: h.kind, time: h.kind === 'peel' ? 0.95 : 0.85 });
          if (h.kind === 'peel' && (landed || k.star > 0)) { h.dead = true; this.emit('pop', null, { x: h.x, y: h.y, z: h.z, kind: h.kind }); }
          if (h.kind === 'roots') { const d = Math.sqrt(dist2(h, k)) || 1; k.ex += ((k.x - h.x) / d) * 8; k.ez += ((k.z - h.z) / d) * 8; }
          if (h.dead) break;
        }
      }
    }
  }

  updateEffects(race, dt) {
    for (const e of this.effects) {
      e.t -= dt;
      const owner = race.kart(e.owner);
      if (!owner) { e.dead = true; continue; }
      if (e.kind === 'drone') {
        e.x += (owner.x - fwdX(owner.yaw) * 1.5 + rightX(owner.yaw) * 1.6 - e.x) * Math.min(1, dt * 6);
        e.z += (owner.z - fwdZ(owner.yaw) * 1.5 + rightZ(owner.yaw) * 1.6 - e.z) * Math.min(1, dt * 6);
        e.y += (owner.y + 2.6 - e.y) * Math.min(1, dt * 6);
        e.cd -= dt;
        if (e.cd <= 0) {
          const target = this.nearestAhead(owner, 50, 0.2);
          if (target) {
            e.cd = 1.1;
            const yaw = Math.atan2(target.x - e.x, target.z - e.z);
            this.spawnProjectile({ kind: 'bolt', owner: owner.id, x: e.x, y: e.y - 1.5, z: e.z, yaw, speed: 62, life: 2.4, target: target.id, hint: owner.hint, ribbon: owner.ribbon, bounces: 0, radius: 0.35, hover: 0.8 });
            this.emit('droneShot', owner.id, { x: e.x, y: e.y, z: e.z });
          } else e.cd = 0.3;
        }
      } else if (e.kind === 'fireTrail') {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 0.12;
          this.spawnHazard({ kind: 'fire', owner: owner.id, x: owner.x - fwdX(owner.yaw) * 2.6, y: owner.groundH ?? owner.y, z: owner.z - fwdZ(owner.yaw) * 2.6, r: 1.6, life: 5, persist: true, safe: 99 });
        }
      } else if (e.kind === 'swap') {
        if (e.t <= 0) {
          const a = owner, b = race.kart(e.target);
          if (b && !b.finished && !a.finished && a.rescue <= 0 && b.rescue <= 0) {
            swapKartState(a, b);
            this.emit('swap', a.id, { target: b.id });
          }
        }
      } else if (e.kind === 'tunnel') {
        if (e.t <= 0) {
          for (const o of race.karts) {
            if (o === owner || o.eliminated) continue;
            if (Math.sqrt(dist2(o, owner)) < 4.5) this.hit(o, 'spin', { by: owner.id, src: 'tunnel' });
          }
          this.emit('shock', owner.id, { x: owner.x, y: owner.y, z: owner.z, r: 4.5, kind: 'tunnel' });
        }
      }
      if (e.t <= 0) e.dead = true;
    }
  }
}

// Exchange physical and progress state between two karts (Swap Spell).
const SWAP_KEYS = ['x', 'y', 'z', 'yaw', 'speed', 'lat', 'vy', 'ex', 'ez', 'grounded', 'ribbon', 'hint', 's', 'lastS', 'raceDist', 'lap', 'lapStart',
  'safeRibbon', 'safeHint', 'lastGroundY', 'groundH', 'gnx', 'gny', 'gnz', 'surface'];
export function swapKartState(a, b) {
  for (const key of SWAP_KEYS) {
    const t = a[key]; a[key] = b[key]; b[key] = t;
  }
  cancelDrift(a); cancelDrift(b);
  a.invuln = Math.max(a.invuln, 0.8);
  b.invuln = Math.max(b.invuln, 0.8);
}

export { RACE };
