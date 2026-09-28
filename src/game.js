// The game: owns state (calendar, money, Genki, backpack, flags), the World, the clock, modal UI and
// scene flow (title <-> play). Systems talk back to it through the small service methods below.
import { Camera } from './core/camera.js';
import { Rng } from './core/rng.js';
import { makeDoc, writeSlot, readSlot, exportDoc, importDoc } from './core/save.js';
import { World } from './world/world.js';
import { drawWorld } from './world/draw.js';
import { Lighting } from './world/lighting.js';
import { Inventory } from './systems/inventory.js';
import { TICK_SECONDS, TICK_MINUTES, DAY_END, MIDNIGHT, dateLabel, weekday, parseTime, formatTime, dayIndex, SEASONS, WEEKDAYS } from './systems/calendar.js';
import { endDay } from './systems/day.js';
import { weatherFor, WEATHER } from './systems/weather.js';
import { WeatherFx } from './world/weatherfx.js';
import { newState } from './state.js';
import { summaryLines, drawSummary } from './ui/summary.js';
import { ShipMenu } from './ui/ship.js';
import { ShopMenu, ForgeMenu } from './ui/shop.js';
import { SHOPS, TRIP_MINUTES } from './data/shops.js';
import { itemDef } from './data/items.js';
import { Hud } from './ui/hud.js';
import { Dialog } from './ui/dialog.js';
import { Menu } from './ui/menu.js';
import { Title } from './ui/title.js';
import { InkWipe } from './ui/transition.js';
import { rect } from './ui/widgets.js';
import { t } from './data/strings.js';
import farmDef from './maps/farm.js';

const SETTINGS_KEY = 'ronin.settings';
const DEFAULT_SETTINGS = { sfx: 0.8, speed: 'normal', shake: true, flashes: true };

export class Game {
  constructor({ screen, input, atlas, cells, audio, params }) {
    Object.assign(this, { screen, input, atlas, cells, audio, params });
    this.camera = new Camera();
    this.lighting = new Lighting();
    this.weatherFx = new WeatherFx();
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
    const s = saved || newState(seed);
    this.state = s;
    this.seed = s.seed;
    this.money = s.money;
    this.genki = s.genki;
    this.genkiMax = s.genkiMax;
    this.can = s.can;
    this.cal = { ...s.cal };
    this.flags = { ...s.flags };
    this.weather = s.weather;
    this.tomorrow = s.tomorrow;
    this.tiers = { ...s.tiers };
    this.upgrade = s.upgrade ? { ...s.upgrade } : null;
    this.shipped = s.shipped.map((x) => ({ ...x }));
    this.stats = { ...s.stats };
    this.inventory = Inventory.from(s.inventory);
    this.rng = new Rng(s.rng);
    this.applyParams();
    this.world = new World(this, farmDef, s.maps.farm || null);
    if (s.player) Object.assign(this.world.player, s.player);
    this.clockAcc = 0;
  }

  get seasonId() { return SEASONS[this.cal.season].id; }

  /** URL overrides for repeatable screenshots: ?season=autumn&day=5&time=17:30 */
  applyParams() {
    const p = this.params;
    const season = SEASONS.findIndex((x) => x.id === p.get('season'));
    if (season >= 0) this.cal.season = season;
    if (p.get('day')) this.cal.day = Math.max(1, Math.min(28, Number(p.get('day'))));
    const mins = parseTime(p.get('time'));
    if (mins !== null) this.cal.minutes = mins - (mins % TICK_MINUTES);
    if (WEATHER[p.get('weather')]) this.weather = p.get('weather');
    else if (season >= 0 || p.get('day')) this.weather = weatherFor(this.seed, this.cal);
  }

  startNew(slot) {
    this.slot = slot;
    this.setup(Number(this.params.get('seed')) || (Date.now() % 2147483647));
    this.play();
    this.modals.push(new InkWipe(this, { hold: 0.2, covered: true }));
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
      cal: { ...this.cal }, weather: this.weather, tomorrow: this.tomorrow, tiers: { ...this.tiers },
      upgrade: this.upgrade, shipped: this.shipped.map((x) => ({ ...x })), stats: { ...this.stats },
      inventory: this.inventory.serialize(), flags: { ...this.flags },
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

  say(key, vars) {
    if (key) this.modals.push(new Dialog(this, { text: t(key, vars) }));
  }

  tutorial(ev) {
    const next = { till: 'tk_first_till', plant: 'tk_first_plant', water: 'tk_first_water', channel: 'tk_first_channel' }[ev];
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
    let summary = null;
    const wipe = new InkWipe(this, {
      onCovered: () => {
        const season = this.cal.season;
        const r = endDay(this, passedOut);
        if (this.cal.season !== season) this.world.ground.setSeason(this.cal.season);
        this.saveNow(true);
        summary = summaryLines(r, this);
        this.morning(r, passedOut);
      },
      card: (ctx) => summary && drawSummary(ctx, this, summary),
      minCard: 0.8,
      waitConfirm: true,
    });
    this.modals.push(wipe);
  }

  /** Tsukikage's morning lines: what happened, what the day holds. */
  morning(r, passedOut) {
    if (passedOut) this.aside('tk_passout', { vars: { lost: r.lost } });
    else this.aside('tk_morning', { vars: { date: dateLabel(this.cal), weekday: weekday(this.cal).name } });
    if (r.newSeason) this.aside('tk_new_season', { vars: { season: `${SEASONS[this.cal.season].en} (${SEASONS[this.cal.season].jp})` } });
    if (WEATHER[this.weather].rain) this.aside('tk_rain', { once: 'rain' });
    if (this.tomorrow === 'typhoon') this.aside('tk_typhoon_warn');
    if (r.upgraded) this.aside('tk_upgrade_ready', { vars: { tool: itemDef(r.upgraded).name } });
  }

  openShipping() {
    this.modals.push(new ShipMenu(this));
  }

  /** The valley road: until the village map exists (M3), a trip opens the shop directly. */
  edgeAction(e) {
    if (e.action !== 'village') { this.say(e.text); return; }
    this.modals.push(new Dialog(this, {
      text: t('village_ask'),
      choices: [t('village_yorozuya'), t('village_kajiya'), t('village_stay')],
      onChoose: (i) => { if (i < 2) this.visitShop(i === 0 ? 'yorozuya' : 'kajiya'); },
    }));
  }

  visitShop(id) {
    const shop = SHOPS[id];
    const arrive = this.cal.minutes + TRIP_MINUTES / 2;
    const closedToday = dayIndex(this.cal) % 7 === shop.closedDay;
    if (closedToday || arrive < shop.open || arrive >= shop.close) {
      const day = WEEKDAYS[shop.closedDay];
      this.say('shop_closed', { name: shop.name, open: formatTime(shop.open), close: formatTime(shop.close), closed: t('shop_closed_day', { day: `${day.name} ${day.jp}` }) });
      return;
    }
    this.cal.minutes = Math.min(DAY_END - TICK_MINUTES, this.cal.minutes + TRIP_MINUTES);
    this.modals.push(id === 'yorozuya' ? new ShopMenu(this) : new ForgeMenu(this));
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
      this.weatherFx.update(dt, this.weather, this.cal.season, this.screen.w, this.screen.h, this.cal.minutes, false);
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
    if (this.weatherFx.update(dt, this.weather, this.cal.season, this.screen.w, this.screen.h, this.cal.minutes, this.settings.flashes) === 'thunder') this.sfx('fall');
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
    this.lighting.apply(ctx, w, h, this.smoothMinutes(), this.world.lights(), cam, WEATHER[this.weather].tint || 0);
    this.weatherFx.draw(ctx, this.clockTime, w, h);
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
