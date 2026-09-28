// The playable world for one map: player control, targeting, tool use, interaction, drops and fx.
// Drawing lives in draw.js.
import { TILE } from '../config.js';
import { GameMap } from './gamemap.js';
import { GroundRenderer } from './ground.js';
import { decorate, populate } from './populate.js';
import { Player } from './player.js';
import { Fx } from './fx.js';
import { Drops } from './drops.js';
import { OBJECT_TYPES } from '../data/objects.js';
import { itemDef } from '../data/items.js';
import { applyTool, plantSeed, GENKI_COST } from '../systems/tools.js';
import { cropAt, isRipe, harvest, plant, canPlant } from '../systems/farming.js';
import { CROPS } from '../data/crops.js';

const REACH = 1;

export class World {
  constructor(game, def, saved) {
    this.game = game;
    this.rng = game.rng;
    this.map = new GameMap(def);
    decorate(this.map);
    if (saved) this.map.restore(saved);
    else populate(this.map, game.seed);
    this.ground = new GroundRenderer(this.map, game.cells, game.atlas);
    this.player = new Player({ x: 0, y: 0 });
    this.placeAtHome();
    this.fx = new Fx();
    this.drops = new Drops();
    this.time = 0;
    this.target = this.player.facingTile();
    this.mouseTarget = false;
    this.edgeLatch = false;
    this.stepDist = 0;
  }

  // ------------------------------------------------------------------ simulation

  update(dt) {
    const { input } = this.game;
    const p = this.player;
    this.time += dt;
    p.tick(dt);
    this.aim();
    if (p.swing) {
      const sw = p.swing;
      if (p.updateSwing(dt)) applyTool(this, sw.tool, sw.tx, sw.ty);
      // Hold-to-repeat: keep swinging while the button stays down.
      if (!p.swing && input.isDown('use')) this.use();
    } else {
      const a = input.axis();
      const moved = p.walk(dt, a.x, a.y, this.map, this.game.genki <= 0);
      this.stepDist += moved;
      if (this.stepDist > 18) { this.stepDist = 0; this.game.sfx('step'); }
      if (input.pressed('use')) this.use();
      else if (input.pressed('interact')) this.interact();
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
    if (def.kind !== 'tool') return;
    const refill = def.tool === 'can' && this.isWaterSource(t.x, t.y);
    if (!refill && g.genki < GENKI_COST) {
      g.sfx('deny');
      g.aside('tk_tired', { once: 'tired' });
      return;
    }
    if (this.mouseTarget) this.player.face(t.x, t.y);
    this.player.startSwing(def.tool, t.x, t.y);
    g.sfx('swing');
  }

  isWaterSource(x, y) {
    const b = this.map.buildingAt(x, y);
    return (this.map.inside(x, y) && this.map.isWater(x, y)) || !!(b && b.water);
  }

  interact() {
    const g = this.game;
    const { x, y } = this.target;
    const map = this.map;
    if (isRipe(cropAt(map, x, y))) { this.harvestAt(x, y); return; }
    const cur = g.inventory.current;
    if (cur && itemDef(cur.id).kind === 'seed' && canPlant(map, x, y)) { plantSeed(this, g.inventory.selected, x, y); return; }
    const b = map.buildingAt(x, y);
    if (b) {
      if (b.door && b.door.tx === x && b.door.ty - 1 === y && b.door.action === 'sleep') { g.askSleep(); return; }
      g.say(b.id === 'kura' ? 'kura' : b.id === 'well' ? 'well' : null);
      return;
    }
    const o = map.objectAt(x, y);
    if (o) {
      const def = OBJECT_TYPES[o.type];
      const key = o.text || def.say;
      if (key) g.say(key);
    }
  }

  harvestAt(x, y) {
    const g = this.game;
    const crop = cropAt(this.map, x, y);
    if (!crop) return false;
    if (g.inventory.room(CROPS[crop.id].item) <= 0) { g.aside('tk_full'); return false; }
    const got = harvest(this.map, x, y, this.rng);
    if (!got) return false;
    g.pickUp(got.item, 1, got.q);
    this.fx.burst('fx_sparkle', x * TILE + 8, y * TILE + 4, 3, { speed: 20, up: 40 });
    this.fx.burst('fx_leaf', x * TILE + 8, y * TILE + 10, 4);
    g.sfx('harvest');
    return true;
  }

  plant(x, y, crop) {
    return plant(this.map, x, y, crop);
  }

  /** Walking into a map edge that leads elsewhere shows its message (maps arrive in M3). */
  edges(a) {
    const p = this.player;
    const e = (this.map.def.edges || []).find((ed) => p.tx === ed.tx && p.ty >= ed.ty && p.ty < ed.ty + ed.h);
    if (!e) { this.edgeLatch = false; return; }
    const pushing = (e.tx === 0 && a.x < 0) || (e.tx === this.map.w - 1 && a.x > 0);
    if (pushing && !this.edgeLatch) {
      this.edgeLatch = true;
      this.game.say(e.text);
    }
  }

  lights() {
    return this.map.lights;
  }

  /** Put the player on the doorstep facing the fields (morning, or after passing out). */
  placeAtHome() {
    const sp = this.map.def.spawn;
    const p = this.player;
    p.x = sp.tx * TILE + 8;
    p.y = sp.ty * TILE + 14;
    p.dir = sp.dir;
    p.swing = null;
    p.anim = 'idle';
  }
}
