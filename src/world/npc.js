// Villagers in the world: each follows today's schedule, walking tile paths (A*) and taking doors
// and roads between maps. Everyone is simulated whether or not the player is on their map, so they
// are where they should be when you arrive. Scripts can take a villager over (moveNpc) for a while.
import { TILE } from '../config.js';
import { NPCS, NPC_IDS, routeFor, stopAt } from '../data/npcs.js';
import { navMap, findPath, mapRoute, warpTile } from '../systems/nav.js';
import { dayIndex } from '../systems/calendar.js';
import { WEATHER } from '../systems/weather.js';

const SPEED = 40;            // px/s, a stroll
const WALK_FRAME = 0.18;
const PAUSE_TALK = 4;        // s a villager stands still after being spoken to
const EMOTE_TIME = 1.6;

export class Npc {
  constructor(id) {
    this.id = id;
    this.def = NPCS[id];
    this.map = this.def.home;
    this.x = 0;
    this.y = 0;
    this.dir = 'down';
    this.moving = false;
    this.animT = 0;
    this.path = [];
    this.stop = null;         // [minutes, map, tx, ty, dir] currently heading for
    this.script = null;       // { tx, ty, dir, handle } while a cutscene moves them
    this.pause = 0;
    this.emote = null;        // { kind, t }
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor((this.y - 3) / TILE); }

  placeAt(map, tx, ty, dir) {
    this.map = map;
    this.x = tx * TILE + 8;
    this.y = ty * TILE + 14;
    if (dir) this.dir = dir;
    this.path = [];
    this.moving = false;
  }

  frame() {
    const flip = this.dir === 'left';
    const d = flip ? 'right' : this.dir;
    const name = this.moving ? `${this.id}_${d}_walk${Math.floor(this.animT / WALK_FRAME) % 4}` : `${this.id}_${d}_idle${Math.floor(this.animT / 0.6) % 2}`;
    return { name, flip };
  }

  face(tx, ty) {
    const dx = tx - this.tx, dy = ty - this.ty;
    if (!dx && !dy) return;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  showEmote(kind) { this.emote = { kind, t: EMOTE_TIME }; }
}

export class Villagers {
  constructor(game) {
    this.game = game;
    this.list = NPC_IDS.map((id) => new Npc(id));
    this.byId = Object.fromEntries(this.list.map((n) => [n.id, n]));
    this.routes = {};
  }

  get(id) { return this.byId[id]; }

  /** Today's schedule for everyone (call at dawn, after loading, and when the weather changes). */
  planDay() {
    const g = this.game;
    const ctx = { season: g.seasonId, weekday: dayIndex(g.cal) % 7, rain: !!WEATHER[g.weather].rain };
    for (const n of this.list) this.routes[n.id] = routeFor(n.id, ctx);
  }

  /** Put everyone where their schedule says they are right now (no walking). */
  snap() {
    this.planDay();
    for (const n of this.list) {
      const s = stopAt(this.routes[n.id], this.game.cal.minutes);
      n.stop = s;
      n.script = null;
      n.placeAt(s[1], s[2], s[3], s[4]);
    }
  }

  onMap(map) { return this.list.filter((n) => n.map === map); }

  /** The villager standing on a tile of a map, if any. */
  at(map, tx, ty) {
    return this.list.find((n) => n.map === map && n.tx === tx && n.ty === ty) || null;
  }

  update(dt) {
    const minutes = this.game.cal.minutes;
    for (const n of this.list) {
      n.animT += dt;
      if (n.emote && (n.emote.t -= dt) <= 0) n.emote = null;
      if (n.pause > 0) { n.pause -= dt; n.moving = false; continue; }
      if (n.script) { this.follow(n, dt); continue; }
      const s = stopAt(this.routes[n.id], minutes);
      if (s !== n.stop) { n.stop = s; n.path = []; }
      this.follow(n, dt);
    }
  }

  /** Talking to a villager stops them for a moment and turns them toward you. */
  greet(n, px, py) {
    n.pause = PAUSE_TALK;
    n.moving = false;
    n.face(px, py);
  }

  /** Script control: walk to (tx, ty) on the villager's current map. Returns a { done } handle. */
  scriptMove(n, tx, ty, dir) {
    const handle = { done: false };
    n.script = { map: n.map, tx, ty, dir, handle };
    n.path = [];
    n.pause = 0;
    return handle;
  }

  release(n) { n.script = null; n.path = []; }

  /** Walk toward the current goal: the scripted spot, else the schedule stop (maybe via warps). */
  follow(n, dt) {
    const goal = n.script || { map: n.stop[1], tx: n.stop[2], ty: n.stop[3], dir: n.stop[4] };
    const live = (id) => this.game.worlds.get(id)?.map || null;
    if (!n.path.length) {
      let tx = goal.tx, ty = goal.ty, warp = null;
      if (n.map !== goal.map) {
        warp = mapRoute(n.map, goal.map)?.[0];
        if (!warp) { n.placeAt(goal.map, goal.tx, goal.ty, goal.dir); return; }
        [tx, ty] = warpTile(warp, n.tx, n.ty);
      }
      if (n.tx === tx && n.ty === ty) {
        if (warp) { n.placeAt(warp.to, warp.tx, warp.ty, warp.dir); return; }
        this.arrive(n, goal);
        return;
      }
      const p = findPath(navMap(n.map, live(n.map)), n.tx, n.ty, tx, ty);
      // No way through (something new in the way): step there directly rather than get stuck.
      if (!p) { if (warp) n.placeAt(warp.to, warp.tx, warp.ty, warp.dir); else n.placeAt(goal.map, tx, ty, goal.dir); return; }
      n.path = p;
    }
    const [nx, ny] = n.path[0];
    const gx = nx * TILE + 8, gy = ny * TILE + 14;
    const dx = gx - n.x, dy = gy - n.y;
    const d = Math.hypot(dx, dy), step = SPEED * dt;
    if (d <= step) {
      n.x = gx; n.y = gy;
      n.path.shift();
    } else {
      n.x += (dx / d) * step;
      n.y += (dy / d) * step;
    }
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    n.moving = true;
  }

  arrive(n, goal) {
    if (n.moving && goal.dir) n.dir = goal.dir;
    n.moving = false;
    if (n.script && !n.script.handle.done) {
      if (goal.dir) n.dir = goal.dir;
      n.script.handle.done = true;
    }
  }
}
