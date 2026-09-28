// The playable world for one map: player control, targeting, tool use, interaction, drops and fx.
// Drawing lives in draw.js.
import { TILE } from '../config.js';
import { GameMap } from './gamemap.js';
import { GroundRenderer } from './ground.js';
import { decorate, populate } from './populate.js';
import { Fx } from './fx.js';
import { Drops } from './drops.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { itemDef } from '../data/items.js';
import { applyTool, plantSeed, placeItem, spreadStraw, swingArea, GENKI_COST } from '../systems/tools.js';
import { computeFlow } from '../systems/irrigation.js';
import { TIERS, CHARGE_STEP } from '../data/tools.js';
import { cropAt, isRipe, harvest, plant, canPlant, rollQuality } from '../systems/farming.js';
import { spawnSpots, digFind } from '../systems/forage.js';
import { dayIndex } from '../systems/calendar.js';
import { openNotice, openMailbox, openAltar } from '../flow.js';
import { Fishing } from './fishing.js';
import { XP } from '../data/skills.js';
import { buffAmount, hasPerk } from '../systems/skills.js';

const REACH = 1;
const CHARGEABLE = new Set(['hoe', 'can']);

export class World {
  constructor(game, def, saved) {
    this.game = game;
    this.rng = game.rng;
    this.map = new GameMap(def);
    decorate(this.map);
    if (saved) this.map.restore(saved);
    else if (def.wild) populate(this.map, game.seed);
    if (game.flags.restored_terraces) this.openTerraces();
    this.spawnSpots();
    computeFlow(this.map);
    this.ground = new GroundRenderer(this.map, game.cells, game.atlas, game.cal.season);
    this.fx = new Fx();
    this.fishing = new Fishing(this);
    this.drops = new Drops();
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
    if (this.fishing.active) {
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
      if (p.updateSwing(dt)) applyTool(this, sw.tool, swingArea(p.tx, p.ty, sw.tx, sw.ty, sw.level), sw.level);
      // Hold-to-repeat: keep swinging while the button stays down.
      if (!p.swing && input.isDown('use')) this.use();
    } else {
      const a = input.axis();
      const moved = p.walk(dt, a.x, a.y, this.map, this.game.genki <= 0, 1 + buffAmount(this.game.buffs, 'speed'));
      this.stepDist += moved;
      if (this.stepDist > 18) { this.stepDist = 0; this.game.sfx('step'); }
      if (input.pressed('use')) this.use();
      else if (input.pressed('interact')) this.interact();
      if (moved) this.warps();
      this.edges(a);
    }
    for (const o of this.map.objects) if (o.shake > 0) o.shake = Math.max(0, o.shake - dt);
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
    const g = this.game;
    const { x, y } = this.target;
    const map = this.map;
    const npc = g.villagers.at(map.id, x, y);
    if (npc) { g.talkTo(npc); return; }
    const spot = map.objectAt(x, y);
    if (spot && spot.type === 'forage') { this.pickForage(spot); return; }
    if (isRipe(cropAt(map, x, y))) { this.harvestAt(x, y); return; }
    const cur = g.inventory.current;
    if (cur && itemDef(cur.id).kind === 'seed' && canPlant(map, x, y, cur.id.slice(5))) { plantSeed(this, g.inventory.selected, x, y); return; }
    const o0 = map.objectAt(x, y);
    if (o0 && o0.type === 'sluice') {
      o0.open = !o0.open;
      computeFlow(map);
      g.sfx(o0.open ? 'refill' : 'chop');
      return;
    }
    if (o0 && o0.type === 'crate') { g.openShipping(); return; }
    if (o0 && o0.action === 'sleep') { g.askSleep(); return; }
    if (o0 && o0.shop) {
      // With the keeper behind the counter you can shop or chat; otherwise it's just the shop.
      const keeper = g.villagers.at(map.id, x, y - 1);
      if (keeper) g.counter(o0.shop, keeper); else g.openShop(o0.shop);
      return;
    }
    if (o0 && o0.type === 'jizo') { g.bow(); return; }
    if (o0 && o0.type === 'trap') {
      if (!o0.catch) { g.say('trap_empty'); return; }
      if (g.pickUp(o0.catch, 1) === 0) { o0.catch = null; g.xp('fishing', XP.trap); }
      return;
    }
    if (o0 && o0.type === 'notice') { openNotice(g); return; }
    if (o0 && o0.type === 'mailbox') { openMailbox(g); return; }
    if (o0 && o0.type === 'altar') { openAltar(g, o0.kind); return; }
    const b = map.buildingAt(x, y);
    if (b) {
      if (b.door?.say && b.door.tx === x && b.door.ty === y) g.say(b.door.say);
      else g.say(b.id === 'kura' ? 'kura' : b.id === 'well' ? 'well' : null);
      return;
    }
    const o = map.objectAt(x, y);
    if (o) {
      const def = OBJECT_TYPES[o.type];
      // Some signs read differently once a flag is set: textIf: [flag, key].
      const key = (o.textIf && g.flags[o.textIf[0]] ? o.textIf[1] : o.text) || def.say;
      if (key) g.say(key);
    }
  }

  harvestAt(x, y) {
    const g = this.game;
    const crop = cropAt(this.map, x, y);
    if (!crop) return false;
    if (g.inventory.room(crop.id) <= 0) { g.aside('tk_full'); return false; }
    const got = harvest(this.map, x, y, this.rng, g.qualityBonus('farming'));
    if (!got) return false;
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
    const wp = this.map.def.warps.find((r) => p.tx >= r.x && p.tx < r.x + r.w && p.ty >= r.y && p.ty < r.y + r.h);
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
    spawnSpots(this.map, { seed: g.seed, day, seasonId: g.seasonId, taken: g.foraged.keys, digMult: hasPerk(g.skills, 'tracker') ? 2 : 1 });
  }

  /** Pick up forage by hand: quality from Foraging, a second one sometimes (Gatherer). */
  pickForage(o) {
    const g = this.game;
    if (g.inventory.room(o.kind) <= 0) { g.aside('tk_full'); return; }
    let q = rollQuality(this.rng, g.qualityBonus('foraging'));
    if (hasPerk(g.skills, 'botanist')) q = Math.max(1, q);
    const n = hasPerk(g.skills, 'gatherer') && this.rng.next() < 0.2 ? 2 : 1;
    this.map.removeObject(o);
    g.foraged.keys.push(`${this.map.id}:${o.x},${o.y}`);
    g.pickUp(o.kind, n, q);
    g.xp('foraging', XP.forage);
    this.fx.burst('fx_leaf', o.x * TILE + 8, o.y * TILE + 10, 5);
    g.sfx('harvest');
  }

  /** The hoe turns over a dig spot: an artefact, or a winter root. */
  dig(o) {
    const g = this.game;
    this.map.removeObject(o);
    g.foraged.keys.push(`${this.map.id}:${o.x},${o.y}`);
    const id = digFind(this.rng, g.seasonId);
    this.drops.spawn(this.rng, id, 1, 0, o.x * TILE + 8, o.y * TILE + 10);
    this.fx.burst('fx_dirt', o.x * TILE + 8, o.y * TILE + 12, 8, { speed: 30, up: 60 });
    g.xp('foraging', XP.dig);
    g.sfx('till');
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

  lights() {
    return this.map.lights;
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
