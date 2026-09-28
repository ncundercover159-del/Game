// Fishing in the world: hold to charge a cast, the float flies out and settles, wait for the dip,
// strike in time and the reel minigame opens. Owned by a World; drawn by draw.js.
import { TILE } from '../config.js';
import { DIRS } from './player.js';
import { waterKind, fishFor, rollCatch, biteDelay } from '../systems/fishing.js';
import { levelOf } from '../systems/skills.js';
import { FISH } from '../data/fish.js';
import { XP } from '../data/skills.js';
import { itemDef } from '../data/items.js';
import { ReelMenu } from '../ui/reel.js';

export const CAST_GENKI = 4;
const CHARGE_PER_TILE = 0.35;
const MAX_TILES = 4;
const FLIGHT = 0.4;
const BITE_WINDOW = 0.75;

export class Fishing {
  constructor(world) {
    this.w = world;
    this.state = null;   // { phase: charge|cast|wait|bite|reel, t, ... }
    this.shown = null;   // { id, t } fish held up after a catch
  }

  get active() { return !!this.state; }

  start() {
    const g = this.w.game;
    if (g.genki < CAST_GENKI) { g.sfx('deny'); g.aside('tk_tired', { once: 'tired' }); return; }
    this.state = { phase: 'charge', t: 0 };
    this.w.player.anim = 'tool';
  }

  /** Tiles the cast would reach at the current charge. */
  reach() {
    return Math.min(MAX_TILES, 1 + Math.floor(this.state.t / CHARGE_PER_TILE));
  }

  update(dt) {
    if (this.shown && (this.shown.t -= dt) <= 0) this.shown = null;
    const s = this.state;
    if (!s) return;
    const g = this.w.game, input = g.input, p = this.w.player;
    s.t += dt;
    switch (s.phase) {
      case 'charge':
        if (!input.isDown('use')) this.cast();
        break;
      case 'cast':
        if (s.t >= FLIGHT) {
          if (!s.kind) { g.aside('tk_snag', { once: 'snag' }); this.reset(); return; }
          g.sfx('water');
          this.w.fx.burst('fx_drop', s.bx, s.by, 4, { speed: 14, up: 20 });
          Object.assign(s, { phase: 'wait', t: 0, bite: biteDelay(this.w.rng, levelOf(g.skills.fishing.xp)) });
        }
        break;
      case 'wait':
        if (input.pressed('use') || input.pressed('interact')) { this.reset(); return; }
        if (s.t >= s.bite) { Object.assign(s, { phase: 'bite', t: 0 }); g.sfx('pickup'); this.w.fx.burst('fx_drop', s.bx, s.by, 6, { speed: 20, up: 30 }); }
        break;
      case 'bite':
        if (input.pressed('use')) this.strike();
        else if (s.t >= BITE_WINDOW) { g.aside('tk_fish_away', { once: 'fish_away' }); this.reset(); }
        break;
      default: break;
    }
    p.anim = 'tool';
  }

  cast() {
    const g = this.w.game, p = this.w.player, map = this.w.map;
    g.spendGenki(CAST_GENKI);
    const [dx, dy] = DIRS[p.dir];
    const n = this.reach();
    const tx = p.tx + dx * n, ty = p.ty + dy * n;
    const kind = waterKind(map, tx, ty);
    Object.assign(this.state, { phase: 'cast', t: 0, tx, ty, kind, bx: tx * TILE + 8, by: ty * TILE + 9 });
    g.sfx('swing');
    g.aside('tk_first_cast', { once: true });
  }

  strike() {
    const g = this.w.game, s = this.state;
    const ids = fishFor(s.kind, { season: g.seasonId, minutes: g.cal.minutes, weather: g.weather, cal: g.cal, caught: g.flags });
    const id = rollCatch(this.w.rng, ids, levelOf(g.skills.fishing.xp));
    s.phase = 'reel';
    if (!FISH[id]) { this.land(id, false); return; }   // junk comes straight up
    g.modals.push(new ReelMenu(g, id, (won, perfect) => (won ? this.land(id, perfect) : this.lose())));
  }

  land(id, perfect) {
    const g = this.w.game;
    const f = FISH[id];
    let q = 0;
    if (f) {
      q = perfect ? 2 : this.w.rng.next() < g.qualityBonus('fishing') * 3 ? 1 : 0;
      g.xp('fishing', XP.fish(f.diff));
      if (f.legendary) { g.flags[id] = true; g.addVirtue('yu', 5); }
      g.stats.fish = (g.stats.fish || 0) + 1;
    }
    g.pickUp(id, 1, q);
    g.toast(f ? 'fish_caught' : 'fish_junk', { fish: itemDef(id).name }, `icon_${id}`);
    g.sfx(f ? 'harvest' : 'deny');
    this.shown = { id, t: 1.4 };
    this.reset();
  }

  lose() {
    this.w.game.aside('tk_fish_lost', { once: 'fish_lost' });
    this.w.game.sfx('deny');
    this.reset();
  }

  reset() {
    this.state = null;
    this.w.player.anim = 'idle';
  }

  /** Pose for the held rod: drawn back while charging, out over the water after casting. */
  pose() {
    return this.state && this.state.phase === 'charge' ? 'raise' : 'strike';
  }
}
