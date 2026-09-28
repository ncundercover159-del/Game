// Debug tools behind ?debug=1: F1 overlay, F2 skip day, F3 money + seed kit, F4 +1 hour
// (Shift+F4: next season, Ctrl+F4: next weather), F5 to the Kurayama mine mouth (Shift+F5: one floor
// down), F6 spawn the next enemy kind beside you. Also exposes window.__game for headless tests (always, not only debug).
import { fonts } from './text.js';
import { rect } from '../ui/widgets.js';
import { TILE } from '../config.js';
import { formatTime, TICK_MINUTES, DAY_END } from '../systems/calendar.js';
import { WEATHER } from '../systems/weather.js';
import { ENEMIES } from '../data/enemies.js';
import { enterFloor } from '../caves.js';

export class Debug {
  constructor(game, loop) {
    this.game = game;
    this.loop = loop;
    this.overlay = false;
    this.shift = false;
    this.ctrl = false;
    addEventListener('keydown', (e) => { if (e.key === 'Shift') this.shift = true; if (e.key === 'Control') this.ctrl = true; });
    addEventListener('keyup', (e) => { if (e.key === 'Shift') this.shift = false; if (e.key === 'Control') this.ctrl = false; });
  }

  update() {
    const g = this.game, input = g.input;
    if (input.pressed('debug1')) this.overlay = !this.overlay;
    if (g.scene !== 'play') return;
    if (input.pressed('debug2')) g.sleep(false);
    if (input.pressed('debug3')) {
      g.money += 1000;
      for (const id of ['seed_daikon', 'seed_komatsuna', 'seed_soramame', 'seed_strawberry']) g.pickUp(id, 10);
    }
    if (input.pressed('debug4')) {
      if (this.shift) {
        g.cal.season = (g.cal.season + 1) % 4;
        g.world.ground.setSeason(g.cal.season);
      } else if (this.ctrl) {
        const ids = Object.keys(WEATHER);
        g.weather = ids[(ids.indexOf(g.weather) + 1) % ids.length];
      } else g.cal.minutes = Math.min(DAY_END - TICK_MINUTES, g.cal.minutes + 60);
    }
    if (input.pressed('debug5')) {
      if (this.shift) enterFloor(g, (g.world.map.def.floor || 0) + 1);
      else g.enter('kurayama', 14, 7, 'down');
    }
    if (input.pressed('debug6')) {
      const kinds = Object.keys(ENEMIES);
      this.spawnIdx = ((this.spawnIdx ?? -1) + 1) % kinds.length;
      const t = g.player.facingTile();
      g.world.combat.spawn(kinds[this.spawnIdx], t.x, t.y).setState('approach');
    }
  }

  draw(ctx) {
    if (!this.overlay) return;
    const g = this.game, w = g.world, p = w.player;
    const lines = [
      `fps ${this.loop.fps}  frame ${this.loop.frameMs.toFixed(1)}ms  view ${g.screen.w}x${g.screen.h} x${g.screen.scale}`,
      `tile ${p.tx},${p.ty}  px ${p.x.toFixed(1)},${p.y.toFixed(1)}  ${p.dir}`,
      `time ${formatTime(g.cal.minutes)}  objects ${w.map.objects.length}  crops ${w.map.crops.size}  fx ${w.fx.count}  drops ${w.drops.list.length}`,
      `cells ${g.cells.next}/${g.cells.cols * g.cells.rows}  genki ${g.genki}  can ${g.can}  hp ${g.hp}  ki ${Math.round(g.ki)}  foes ${w.combat.foes.length}`,
    ];
    rect(ctx, 'ink0', 0, g.screen.h - 12 * lines.length - 4, 330, 12 * lines.length + 4);
    lines.forEach((l, i) => fonts.small.draw(ctx, l, 3, g.screen.h - 12 * lines.length + i * 12, 'gold3'));
    // Collision overlay for visible tiles.
    const cam = g.camera, map = w.map;
    ctx.globalAlpha = 0.3;
    for (let ty = Math.floor(cam.iy / TILE); ty <= (cam.iy + cam.h) / TILE; ty++) {
      for (let tx = Math.floor(cam.ix / TILE); tx <= (cam.ix + cam.w) / TILE; tx++) {
        if (map.solid(tx, ty)) rect(ctx, 'red2', tx * TILE - cam.ix, ty * TILE - cam.iy, TILE, TILE);
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Test/automation surface: deterministic stepping and synthetic input. */
export function exposeTestHooks(game, loop) {
  const input = game.input;
  window.__game = {
    game,
    advance: (ms) => loop.advance(ms),
    press: (code, ms = 50) => { input.keyDown(code); loop.advance(ms); input.keyUp(code); loop.advance(17); },
    hold: (code) => input.keyDown(code),
    release: (code) => input.keyUp(code),
    // Stop real-time stepping (rendering goes on) so screenshots catch exactly what advance() left.
    freeze: (on = true) => { loop.paused = on; },
    state: () => ({
      scene: game.scene,
      modals: game.modals.map((m) => m.constructor.name),
      cal: { ...game.cal },
      money: game.money,
      genki: game.genki,
      can: game.can,
      map: game.world.map.id,
      player: { x: game.player.x, y: game.player.y, tx: game.player.tx, ty: game.player.ty, dir: game.player.dir },
      target: { ...game.world.target },
      inventory: game.inventory.serialize(),
      selected: game.inventory.selected,
      weather: game.weather,
      tomorrow: game.tomorrow,
      tiers: { ...game.tiers },
      shipped: game.shipped.length,
      bonds: structuredClone(game.bonds),
      virtues: { ...game.virtues },
      requests: structuredClone(game.requests),
      mail: structuredClone(game.mail),
      hp: game.hp,
      ki: game.ki,
      difficulty: game.difficulty,
      caves: structuredClone(game.caves),
      foes: game.world.combat.foes.map((f) => ({ kind: f.kind, hp: f.hp, state: f.state, x: f.x, y: f.y })),
    }),
    tile: (x, y, map = game.world.map.id) => {
      const m = game.worldFor(map).map, k = m.i(x, y);
      return { ground: m.ground[k], soil: m.soil[k], wet: m.wet[k], crop: m.crops.get(k) || null, object: m.objectAt(x, y)?.type || null };
    },
  };
}
