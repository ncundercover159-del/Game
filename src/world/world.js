// The playable world for one map: player control, targeting, tool use, interaction, drops and fx.
// Drawing lives in draw.js.
import { TILE } from '../config.js';
import { GameMap, G } from './gamemap.js';
import { GroundRenderer } from './ground.js';
import { decorate, populate } from './populate.js';
import { Fx } from './fx.js';
import { Drops } from './drops.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { itemDef } from '../data/items.js';
import { applyTool, plantSeed, placeItem, spreadStraw, swingArea, fertilise, GENKI_COST } from '../systems/tools.js';
import { computeFlow } from '../systems/irrigation.js';
import { TIERS, CHARGE_STEP } from '../data/tools.js';
import { cropAt, harvest, plant } from '../systems/farming.js';
import { spawnSpots } from '../systems/forage.js';
import { dayIndex } from '../systems/calendar.js';
import { Fishing } from './fishing.js';
import { Flock } from './flock.js';
import { interact } from './interact.js';
import { learnRecipe } from '../flow.js';
import { XP } from '../data/skills.js';
import { buffAmount, hasPerk } from '../systems/skills.js';
import { hasDucks } from '../systems/animals.js';
import { Combat } from './combat.js';
import { placeKodama, kodamaLights } from './kodama.js';
import { LAYOUTS } from '../data/layouts.js';

const REACH = 1;
const RUN = 1.35;
const CHARGEABLE = new Set(['hoe', 'can']);

// What your feet sound like on each ground (grass and earth outdoors crunch in winter).
const FOOTING = { [G.DIRT]: 'dirt', [G.DOMA]: 'dirt', [G.PATH]: 'stone', [G.STEPS]: 'stone', [G.ROCK]: 'stone', [G.CAVE]: 'stone', [G.WOOD]: 'wood', [G.BRIDGE]: 'wood', [G.TATAMI]: 'mat', [G.TATAMI_R]: 'mat' };
function footing(map, x, y, season) {
  const g = map.inside(x, y) ? map.ground[map.i(x, y)] : G.GRASS;
  const f = FOOTING[g] || 'grass';
  return season === 'winter' && !map.def.indoor && !map.def.cave && (f === 'grass' || f === 'dirt') ? 'snow' : f;
}

export class World {
  constructor(game, def, saved) {
    this.game = game;
    this.rng = game.rng;
    this.map = new GameMap(def);
    decorate(this.map);
    if (saved) this.map.restore(saved);
    else if (def.wild) populate(this.map, game.seed, LAYOUTS[game.state.layout] || LAYOUTS.hinata);
    // Anything growing where a building now stands (older saves predate the coop) is cleared.
    for (const o of this.map.objects.filter((x) => !OBJECT_TYPES[x.type].static && this.map.buildingAt(x.x, x.y))) this.map.removeObject(o);
    if (game.flags.restored_terraces) this.openTerraces();
    for (const o of this.map.objects) if (o.openIf && game.flags[o.openIf]) this.openProp(o);
    this.spawnSpots();
    computeFlow(this.map);
    this.ground = new GroundRenderer(this.map, game.cells, game.atlas, game.cal.season);
    this.fx = new Fx();
    this.fishing = new Fishing(this);
    this.flock = def.id === 'coop' ? new Flock(this) : null;
    this.drops = new Drops();
    this.combat = new Combat(this);
    for (const s of def.spawns || []) this.combat.spawn(s.kind, s.tx, s.ty);
    this.time = 0;
    this.target = { x: -1, y: -1 };
    this.mouseTarget = false;
    this.edgeLatch = false;
    this.stepDist = 0;
  }

  /** The one player, shared by every map. */
  get player() { return this.game.player; }

  // ------------------------------------------------------------------ simulation

  update(dt) {
    const { input } = this.game;
    const p = this.player;
    this.time += dt;
    p.tick(dt);
    this.aim();
    this.fishing.update(dt);
    this.flock?.update(dt);
    const fighting = this.combat.update(dt, input);
    if (fighting) {
      // A swing, dodge, parry or knockback (or the hit-stop of a blow) has the player.
    } else if (this.fishing.active) {
      // Rooted to the bank while the line is out.
    } else if (p.charge) {
      p.charge.t += dt;
      const level = this.chargeLevel();
      if (level !== p.charge.shown) { p.charge.shown = level; if (level) this.game.sfx('ui'); }
      if (!input.isDown('use')) {
        const t = p.facingTile();
        p.charge = null;
        p.startSwing(p.chargeTool, t.x, t.y, level);
        this.game.sfx('swing');
      }
    } else if (p.swing) {
      const sw = p.swing;
      if (p.updateSwing(dt)) {
        applyTool(this, sw.tool, swingArea(p.tx, p.ty, sw.tx, sw.ty, sw.level), sw.level);
        this.combat.toolStrike(sw.tool);
      }
      // Hold-to-repeat: keep swinging while the button stays down.
      if (!p.swing && input.isDown('use')) this.use();
    } else {
      const a = input.axis();
      // Running: hold the run key, or the reverse with auto-run on.
      const run = this.game.settings.autorun !== input.isDown('run') ? RUN : 1;
      const moved = p.walk(dt, a.x, a.y, this.map, this.game.genki <= 0, (1 + buffAmount(this.game.buffs, 'speed')) * run);
      this.stepDist += moved;
      if (this.stepDist > 18) { this.stepDist = 0; this.game.sfx(`step_${footing(this.map, p.tx, p.ty, this.game.seasonId)}`); }
      if (input.pressed('use')) this.use();
      else if (input.pressed('interact')) this.interact();
      else if (this.map.def.cave && input.pressed('dodge')) this.combat.fighter.dodge(a.x, a.y);
      else if (this.map.def.cave && input.pressed('parry')) this.combat.fighter.parry();
      if (moved) this.warps();
      this.edges(a);
    }
    for (const o of this.map.objects) {
      if (o.shake > 0) o.shake = Math.max(0, o.shake - dt);
      if (o.rattle > 0) o.rattle -= dt;
    }
    this.fx.update(dt);
    this.drops.update(dt, p, (d) => this.game.pickUp(d.id, d.n, d.q));
  }

  /** Target tile: the one in front, or the tile under the mouse when it is within reach. */
  aim() {
    const { input, camera } = this.game;
    const p = this.player;
    this.target = p.facingTile();
    this.mouseTarget = false;
    if (!input.mouseAiming()) return;
    const mx = Math.floor((input.mouse.x + camera.ix) / TILE);
    const my = Math.floor((input.mouse.y + camera.iy) / TILE);
    const d = Math.max(Math.abs(mx - p.tx), Math.abs(my - p.ty));
    if (d <= REACH && d > 0) {
      this.target = { x: mx, y: my };
      this.mouseTarget = true;
    }
  }

  use() {
    const g = this.game;
    const slot = g.inventory.selected;
    const item = g.inventory.slots[slot];
    if (!item) return;
    const def = itemDef(item.id);
    const t = this.target;
    if (def.kind === 'seed') { plantSeed(this, slot, t.x, t.y); return; }
    if (def.kind === 'food') { g.eat(slot); return; }
    if (def.kind === 'recipe') { learnRecipe(g, slot); return; }
    if (def.kind === 'machine') { placeItem(this, slot, t.x, t.y); return; }
    if (def.kind === 'fertiliser') { fertilise(this, slot, t.x, t.y); return; }
    if (def.kind === 'weapon') { if (this.mouseTarget) this.player.face(t.x, t.y); this.combat.fighter.attack(); return; }
    if (def.tool === 'rod') { if (this.mouseTarget) this.player.face(t.x, t.y); this.fishing.start(); return; }
    if (def.kind === 'place') { placeItem(this, slot, t.x, t.y); return; }
    if (item.id === 'hay') { spreadStraw(this, slot, t.x, t.y); return; }
    if (def.kind !== 'tool') return;
    const refill = def.tool === 'can' && this.isWaterSource(t.x, t.y);
    if (!refill && g.genki < GENKI_COST) {
      g.sfx('deny');
      g.aside('tk_tired', { once: 'tired' });
      return;
    }
    if (this.mouseTarget) this.player.face(t.x, t.y);
    const max = TIERS[g.tiers[def.tool] || 0].charge;
    if (max > 0 && CHARGEABLE.has(def.tool) && !refill && !this.mouseTarget) {
      this.player.charge = { t: 0, max, shown: 0 };
      this.player.chargeTool = def.tool;
      return;
    }
    this.player.startSwing(def.tool, t.x, t.y);
    g.sfx('swing');
  }

  /** Charge level 0..max of the swing being held. */
  chargeLevel() {
    const c = this.player.charge;
    if (!c) return 0;
    const affordable = Math.floor(this.game.genki / GENKI_COST) - 1;
    return Math.max(0, Math.min(c.max, Math.floor(c.t / CHARGE_STEP), affordable));
  }

  /** Tiles the current swing or charge would touch (for the target highlight). */
  targetTiles() {
    const p = this.player;
    if (p.charge) { const t = p.facingTile(); return swingArea(p.tx, p.ty, t.x, t.y, this.chargeLevel()); }
    return [[this.target.x, this.target.y]];
  }

  isWaterSource(x, y) {
    const b = this.map.buildingAt(x, y);
    return (this.map.inside(x, y) && this.map.isWater(x, y)) || !!(b && b.water);
  }

  interact() {
    interact(this);
  }

  harvestAt(x, y) {
    const g = this.game;
    const crop = cropAt(this.map, x, y);
    if (!crop) return false;
    if (g.inventory.room(crop.id) <= 0) { g.aside('tk_full'); return false; }
    const compost = this.map.fert[this.map.i(x, y)] ? 0.2 : 0;
    const got = harvest(this.map, x, y, this.rng, g.qualityBonus('farming') + compost);
    if (!got) return false;
    // Ducks weeding and paddling in the paddies: rice sometimes comes in heavier.
    if (got.item === 'rice' && hasDucks(g.animals) && this.rng.next() < 0.5) got.n++;
    g.pickUp(got.item, got.n, got.q);
    g.xp('farming', XP.harvest(itemDef(got.item).sell));
    this.fx.burst('fx_sparkle', x * TILE + 8, y * TILE + 4, 3, { speed: 20, up: 40 });
    this.fx.burst('fx_leaf', x * TILE + 8, y * TILE + 10, 4);
    g.sfx('harvest');
    return true;
  }

  plant(x, y, crop) {
    return plant(this.map, x, y, crop, this.game.seasonId);
  }

  /** Stepping onto a warp tile (a doorway or a road out of the map) moves to its destination. */
  warps() {
    const p = this.player;
    const wp = this.map.def.warps.find((r) => p.tx >= r.x && p.tx < r.x + r.w && p.ty >= r.y && p.ty < r.y + r.h && (!r.ifFlag || this.game.flags[r.ifFlag]));
    if (wp) this.game.warp(wp);
  }

  /** Pushing against a map edge that leads nowhere yet shows its message once per push. */
  edges(a) {
    const p = this.player, m = this.map;
    const e = (m.def.edges || []).find((ed) => p.tx >= ed.tx && p.tx < ed.tx + (ed.w || 1) && p.ty >= ed.ty && p.ty < ed.ty + (ed.h || 1));
    const pushing = e && ((p.tx === 0 && a.x < 0) || (p.tx === m.w - 1 && a.x > 0) || (p.ty === 0 && a.y < 0) || (p.ty === m.h - 1 && a.y > 0));
    if (!pushing) { this.edgeLatch = false; return; }
    if (!this.edgeLatch) {
      this.edgeLatch = true;
      this.game.say(e.textIf && this.game.flags[e.textIf[0]] ? e.textIf[1] : e.text);
    }
  }

  /** Today's forage and dig spots (called on creation and every morning). */
  spawnSpots() {
    const g = this.game, day = dayIndex(g.cal);
    if (g.foraged.day !== day) g.foraged = { day, keys: [] };
    placeKodama(this);
    const extra = this.map.id === 'farm' ? LAYOUTS[g.state.layout]?.forage || 0 : 0;
    spawnSpots(this.map, { seed: g.seed, day, seasonId: g.seasonId, taken: g.foraged.keys, digMult: hasPerk(g.skills, 'tracker') ? 2 : 1, extra });
  }

  /** The terraces' fence comes down (the Altar of Jin restores them). */
  openTerraces() {
    const row = this.map.def.terraces?.fenceRow;
    if (row === undefined) return;
    for (const o of this.map.objects.filter((x) => x.type === 'fence' && x.y === row)) {
      this.map.removeObject(o);
      this.map.blocked[this.map.i(o.x, o.y)] = 0;
    }
  }

  /** A gate or door prop opens for good (its flag is set): drawn open, walked through. */
  openProp(o) {
    o.open = true;
    o.passable = true;
    for (const [k, owner] of this.map.blockOwner) if (owner === o) { this.map.blocked[k] = 0; this.map.blockOwner.delete(k); }
  }

  lights() {
    const k = kodamaLights(this);
    return k.length ? this.map.lights.concat(k) : this.map.lights;
  }

  /** Drop the player on a tile, facing `dir`, with any swing cancelled. */
  place(tx, ty, dir) {
    const p = this.player;
    p.x = tx * TILE + 8;
    p.y = ty * TILE + 14;
    p.dir = dir;
    p.swing = null;
    p.charge = null;
    p.anim = 'idle';
    this.target = p.facingTile();
    this.edgeLatch = true;
  }
}
