// The game: owns state (calendar, money, Genki, backpack, flags), the World, the clock, modal UI and
// scene flow (title <-> play). Systems talk back to it through the small service methods below.
import { Camera } from './core/camera.js';
import { Rng } from './core/rng.js';
import { makeDoc, writeSlot, readSlot, exportDoc, importDoc } from './core/save.js';
import { World } from './world/world.js';
import { drawWorld } from './world/draw.js';
import { Lighting } from './world/lighting.js';
import { Inventory } from './systems/inventory.js';
import { newCalendar, TICK_SECONDS, TICK_MINUTES, DAY_END, MIDNIGHT, dateLabel, weekday, SEASONS } from './systems/calendar.js';
import { endDay } from './systems/day.js';
import { CAN_CAPACITY } from './systems/tools.js';
import { Hud } from './ui/hud.js';
import { Dialog } from './ui/dialog.js';
import { Menu } from './ui/menu.js';
import { Title } from './ui/title.js';
import { InkWipe } from './ui/transition.js';
import { rect } from './ui/widgets.js';
import { t } from './data/strings.js';
import { START } from './data/start.js';
import farmDef from './maps/farm.js';

const SETTINGS_KEY = 'ronin.settings';
const DEFAULT_SETTINGS = { sfx: 0.8, speed: 'normal', shake: true };

export class Game {
  constructor({ screen, input, atlas, cells, audio, params }) {
    Object.assign(this, { screen, input, atlas, cells, audio, params });
    this.camera = new Camera();
    this.lighting = new Lighting();
    this.hud = new Hud(this);
    this.modals = [];
    this.clockTime = 0;
    this.clockAcc = 0;
    this.shakeT = 0;
    this.settings = { ...DEFAULT_SETTINGS, ...readSettings() };
    this.audio.setVolume({ sfx: this.settings.sfx });
    this.slot = 1;
    this.setup(Number(params.get('seed')) || 20260928);
    this.scene = 'title';
    this.title = new Title(this);
  }

  // ------------------------------------------------------------------ lifecycle

  /** Fresh farm state (also used as the title-screen backdrop). */
  setup(seed, saved = null) {
    const s = saved || {
      seed, name: START.name, farm: START.farm, money: START.money,
      genki: START.genkiMax, genkiMax: START.genkiMax, can: CAN_CAPACITY,
      cal: newCalendar(), inventory: { size: 12, slots: START.inventory, selected: 0 },
      flags: {}, rng: seed ^ 0x5bd1e995, maps: {},
    };
    this.state = s;
    this.seed = s.seed;
    this.money = s.money;
    this.genki = s.genki;
    this.genkiMax = s.genkiMax;
    this.can = s.can;
    this.cal = { ...s.cal };
    this.flags = { ...s.flags };
    this.inventory = Inventory.from(s.inventory);
    this.rng = new Rng(s.rng);
    this.world = new World(this, farmDef, s.maps.farm || null);
    if (s.player) Object.assign(this.world.player, s.player);
    this.clockAcc = 0;
    this.applyParams();
  }

  /** URL overrides for repeatable screenshots: ?season=autumn&day=5&time=17:30 */
  applyParams() {
    const p = this.params;
    const season = SEASONS.findIndex((x) => x.id === p.get('season'));
    if (season >= 0) this.cal.season = season;
    if (p.get('day')) this.cal.day = Math.max(1, Math.min(28, Number(p.get('day'))));
    if (p.get('time')) {
      const [h, m] = p.get('time').split(':').map(Number);
      let mins = h * 60 + (m || 0);
      if (mins < 360) mins += MIDNIGHT;
      this.cal.minutes = Math.min(DAY_END - TICK_MINUTES, Math.max(360, mins - (mins % TICK_MINUTES)));
    }
  }

  startNew(slot) {
    this.slot = slot;
    this.setup(Number(this.params.get('seed')) || (Date.now() % 2147483647));
    this.play();
    this.modals.push(new InkWipe(this, { hold: 0.1, onCovered: () => {} }));
    this.aside('tk_intro');
    this.flags.intro = true;
  }

  loadSlot(n) {
    const r = readSlot(n);
    if (!r.doc) { this.sfx('deny'); return false; }
    this.slot = n;
    this.setup(r.doc.state.seed, r.doc.state);
    this.play();
    if (r.backup) this.toast('menu_corrupt', { n });
    return true;
  }

  play() {
    this.scene = 'play';
    this.modals = [];
    this.hud = new Hud(this);
  }

  toTitle() {
    this.scene = 'title';
    this.modals = [];
    this.setup(this.seed);
    this.title = new Title(this);
  }

  // ------------------------------------------------------------------ saving

  snapshot() {
    return {
      seed: this.seed, name: this.state.name, farm: this.state.farm,
      money: this.money, genki: this.genki, genkiMax: this.genkiMax, can: this.can,
      cal: { ...this.cal }, inventory: this.inventory.serialize(), flags: { ...this.flags },
      rng: this.rng.state(), player: this.world.player.serialize(),
      maps: { farm: this.world.map.serialize() },
    };
  }

  doc() {
    const c = this.cal;
    return makeDoc(this.snapshot(), { name: this.state.name, farm: this.state.farm, day: c.day, season: c.season, year: c.year, money: this.money });
  }

  saveNow(quiet = false) {
    const ok = writeSlot(this.slot, this.doc());
    if (!quiet) this.toast(ok ? 'toast_saved' : 'menu_corrupt', { n: this.slot });
    return ok;
  }

  exportSave() {
    exportDoc(this.doc(), `ronin-no-sato-slot${this.slot}.json`);
  }

  importSave() {
    importDoc().then((doc) => {
      writeSlot(this.slot, doc);
      this.loadSlot(this.slot);
    }).catch(() => this.sfx('deny'));
  }

  get menuOpen() { return this.modals.some((m) => m instanceof Menu); }

  // ------------------------------------------------------------------ services for systems and UI

  sfx(name) { this.audio.play(name); }
  toast(key, vars, icon = null) { this.hud.toast(t(key, vars), icon); }
  shake(time) { if (this.settings.shake) this.shakeT = Math.max(this.shakeT, time); }

  /** Tsukikage's aside. `once` makes it show only once per save (flag key or true = the string key). */
  aside(key, { once = false, vars } = {}) {
    if (once) {
      const flag = `aside_${once === true ? key : once}`;
      if (this.flags[flag]) return;
      this.flags[flag] = true;
    }
    this.hud.say(t(key, vars));
  }

  say(key) {
    if (key) this.modals.push(new Dialog(this, { text: t(key) }));
  }

  tutorial(ev) {
    const next = { till: 'tk_first_till', plant: 'tk_first_plant', water: 'tk_first_water' }[ev];
    if (next) this.aside(next, { once: true });
  }

  spendGenki(n) {
    this.genki = Math.max(0, this.genki - n);
    if (this.genki <= 20) this.hud.flash = 0.6;
    if (this.genki === 0) this.aside('tk_tired', { once: `tired${this.cal.day}` });
  }

  /** Put items in the backpack; returns how many did not fit. */
  pickUp(id, n, q = 0) {
    const left = this.inventory.add(id, n, q);
    if (n - left > 0) { this.hud.pickup(id, n - left); this.sfx('pickup'); }
    if (left > 0) this.aside('tk_full', { once: `full${this.cal.day}` });
    return left;
  }

  askSleep() {
    this.modals.push(new Dialog(this, {
      text: t('sleep_ask'),
      choices: [t('yes'), t('no')],
      onChoose: (i) => { if (i === 0) this.sleep(false); },
    }));
  }

  sleep(passedOut) {
    this.sfx('sleep');
    const wipe = new InkWipe(this, {
      onCovered: () => {
        const day = this.cal.day;
        const r = endDay(this, passedOut);
        this.saveNow(true);
        wipe.card = [t('day_end', { n: day }), `${dateLabel(this.cal)} · ${weekday(this.cal).name} ${weekday(this.cal).jp}`];
        if (passedOut) this.aside('tk_passout', { vars: { lost: r.lost } });
        else this.aside('tk_morning', { vars: { date: dateLabel(this.cal), weekday: weekday(this.cal).name } });
      },
      card: [''],
    });
    this.modals.push(wipe);
  }

  smoothMinutes() {
    return this.cal.minutes + (this.clockAcc / TICK_SECONDS[this.settings.speed]) * TICK_MINUTES;
  }

  setSetting(k, v) {
    this.settings[k] = v;
    if (k === 'sfx') this.audio.setVolume({ sfx: v });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* private mode */ }
  }

  // ------------------------------------------------------------------ loop

  update(dt) {
    const input = this.input;
    input.latch();
    this.clockTime += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.scene === 'title') {
      this.world.time += dt;
      this.title.update(dt, input);
      this.titleCamera();
      return;
    }
    this.hud.update(dt);
    if (this.modals.length) {
      const m = this.modals[this.modals.length - 1];
      if (!m.update(dt, input)) this.modals.splice(this.modals.indexOf(m), 1);
      return;
    }
    this.hotbarInput(input);
    if (input.pressed('menu')) { this.sfx('ui'); this.modals.push(new Menu(this)); return; }
    this.world.update(dt);
    this.tickClock(dt);
    const p = this.world.player;
    this.camera.setView(this.screen.w, this.screen.h);
    this.camera.follow(p.x, p.y - 12, this.world.map.pw, this.world.map.ph);
  }

  hotbarInput(input) {
    const inv = this.inventory;
    for (let i = 1; i <= 12; i++) if (input.pressed(`slot${i}`) && i <= inv.size) inv.select(i - 1);
    if (input.pressed('next') || input.mouse.wheel > 0) inv.select(inv.selected + 1);
    if (input.pressed('prev') || input.mouse.wheel < 0) inv.select(inv.selected - 1);
    if (input.pressed('click')) {
      const i = this.hud.slotAt(input.mouse.x, input.mouse.y);
      if (i >= 0) { inv.select(i); input.consume('use'); input.down.delete('use'); this.sfx('ui'); }
    }
  }

  tickClock(dt) {
    this.clockAcc += dt;
    const per = TICK_SECONDS[this.settings.speed];
    while (this.clockAcc >= per) {
      this.clockAcc -= per;
      this.cal.minutes += TICK_MINUTES;
      if (this.cal.minutes === MIDNIGHT) this.aside('tk_late');
      if (this.cal.minutes >= DAY_END) { this.sleep(true); break; }
    }
  }

  titleCamera() {
    const map = this.world.map;
    this.camera.setView(this.screen.w, this.screen.h);
    const tx = map.pw / 2 + Math.sin(this.clockTime * 0.05) * map.pw * 0.3;
    this.camera.follow(tx, 190 + Math.sin(this.clockTime * 0.037) * 60, map.pw, map.ph, 1);
  }

  render() {
    const ctx = this.screen.ctx;
    const { w, h } = this.screen;
    rect(ctx, 'ink0', 0, 0, w, h);
    const cam = this.camera;
    const sx = this.shakeT > 0 ? Math.round(Math.sin(this.clockTime * 90) * 2) : 0;
    cam.x += sx;
    drawWorld(this.world, ctx, cam);
    cam.x -= sx;
    this.lighting.apply(ctx, w, h, this.smoothMinutes(), this.world.lights(), cam);
    if (this.scene === 'title') this.title.draw(ctx);
    else {
      this.hud.draw(ctx);
      for (const m of this.modals) m.draw(ctx);
    }
  }
}

function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
