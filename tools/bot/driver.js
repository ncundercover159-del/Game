// The two-year bot's hands, loaded into the page (tools/bot.mjs drives it a day at a time). It plays
// through the real game: it farms a plot beside the house (and ships the surplus), reads its mail,
// talks and gives gifts, goes where the day's rotation says and calls at villagers' homes, turns up
// to every festival, restores the altars one by one, dives the mountain every few days and fights
// the bosses, courts and marries, befriends kodama, trains at the dōjō, strikes at Genzō's anvil,
// fishes, and sleeps (or now and then passes out). Every scene, choice and minigame is pressed through
// with the real keys, choices picked at random; anything that will not close is a softlock.
// To reach two years of content in minutes it helps itself: bonds grow a little every day, money
// and materials appear when a purchase is due, bosses are worn down before the last blows.
import { till, water, plant, coverSoil, cropAt, isRipe, clearDead } from '../../src/systems/farming.js';
import { CROPS } from '../../src/data/crops.js';
import { festivalOn } from '../../src/systems/festivals.js';
import { dayIndex } from '../../src/systems/calendar.js';
import { restore, openShop, openMailbox } from '../../src/flow.js';
import { enterFloor } from '../../src/caves.js';
import { addBond, newBond, hearts } from '../../src/systems/bonds.js';
import { ForgeMenu } from '../../src/ui/forge.js';
import { donate, donatable } from '../../src/systems/archive.js';
import { NPCS } from '../../src/data/npcs.js';
import { ITEMS } from '../../src/data/items.js';
import { MAPS } from '../../src/maps/index.js';
import { Rng } from '../../src/core/rng.js';

const G = () => window.__game;
const game = () => window.__game.game;
const PLOT = { x0: 22, y0: 17, w: 6, h: 4 };
const ALTARS = [[14, 'jin'], [21, 'rei'], [28, 'yu'], [35, 'chugi'], [42, 'makoto'], [49, 'gi'], [56, 'meiyo']];
const ROTATION = ['village', 'shrine', 'grove', 'village', 'farm'];
const KEYS = { use: 'KeyJ', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

export class Bot {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.log = { scenes: 0, choices: 0, minigames: {}, festivals: [], dives: 0, deepest: 0, gifts: 0, talks: 0, harvested: 0, fishCaught: 0, passedOut: 0 };
  }

  pick(n) { return Math.floor(this.rng.next() * n); }

  // ---------------------------------------------------------------- pressing through

  /** Press through whatever is open until nothing is (or throw: a softlock). */
  resolve(label) {
    const g = game();
    let last = null, same = 0;
    for (let i = 0; i < 4000; i++) {
      if (!g.modals.length && !g.pendingScene) return;
      if (!g.modals.length) { G().advance(50); continue; }
      const top = g.modals.at(-1), name = top.constructor.name;
      same = top === last ? same + 1 : 0;
      last = top;
      if (same > 900) throw new Error(`softlock in ${label}: ${name} will not close`);
      this.handle(top, name);
    }
    throw new Error(`softlock in ${label}: modals never cleared (${g.modals.map((m) => m.constructor.name).join(', ')})`);
  }

  handle(top, name) {
    switch (name) {
      case 'RhythmGame': return this.rhythm(top);
      case 'KyudoGame': return this.kyudo(top);
      case 'KingyoGame': return this.kingyo(top);
      case 'IaiDuel': return this.iai(top);
      case 'HaikuComposer': return this.haiku(top);
      case 'ReelMenu': return this.reel(top);
      case 'Credits': case 'ShopMenu': case 'ForgeMenu': case 'Menu': case 'ArchiveMenu': case 'MailMenu':
      case 'NoticeMenu': case 'CookMenu': case 'OfferingMenu': case 'ShipMenu':
        G().press('Escape', 30); G().advance(60); return;
      case 'InkWipe': G().advance(150); G().press('Enter', 30); return;   // the day card waits for a key
      case 'Dialog': {
        if (top.choices && top.finished) {
          // A random answer, to walk every branch in time.
          for (let k = this.pick(top.choices.length); k > 0; k--) G().press('ArrowDown', 20);
          this.log.choices++;
        }
        G().press('Enter', 30); G().advance(90); return;
      }
      case 'Cutscene': this.log.scenes += top.logged ? 0 : 1; top.logged = true; G().advance(120); G().press('Enter', 30); return;
      default: G().press('Enter', 30); G().advance(90);
    }
  }

  count(kind) { this.log.minigames[kind] = (this.log.minigames[kind] || 0) + 1; }

  rhythm(m) {
    const r = m.r;
    if (!m.counted) { m.counted = true; this.count(`rhythm_${m.kind}`); }
    for (let guard = 0; guard < 4000 && !r.done; guard++) {
      const n = r.notes.find((x) => !x.judge && !x.rest);
      if (!n) { G().advance(100); continue; }
      const wait = (n.t - r.t) * 1000;
      if (wait > 20) { G().advance(wait - 8); continue; }
      G().hold(KEYS[n.key]); G().advance(17); G().release(KEYS[n.key]); G().advance(17);
    }
    G().advance(1500);
  }

  kyudo(m) {
    const k = m.k, held = new Set();
    if (!m.counted) { m.counted = true; this.count('kyudo'); }
    const set = (c, on) => { if (on && !held.has(c)) { G().hold(c); held.add(c); } if (!on && held.has(c)) { G().release(c); held.delete(c); } };
    for (let i = 0; i < 60 * 40 && !k.done; i++) {
      const ex = -k.wind.x - k.aim.x, ey = -k.wind.y - k.aim.y, full = k.phase === 'full';
      set(KEYS.right, full && ex > 0.03); set(KEYS.left, full && ex < -0.03); set(KEYS.down, full && ey > 0.03); set(KEYS.up, full && ey < -0.03);
      set(KEYS.use, (k.phase === 'ready' || k.phase === 'draw' || full) && !(full && Math.hypot(ex, ey) < 0.05));
      G().advance(17);
    }
    for (const c of held) G().release(c);
    G().advance(700); G().press('Enter', 30);
  }

  kingyo(m) {
    const k = m.k;
    if (!m.counted) { m.counted = true; this.count('kingyo'); }
    // A few honest dips, then time.
    for (let d = 0; d < 3 && !k.done; d++) { G().hold('KeyJ'); G().advance(600); G().release('KeyJ'); G().advance(300); }
    k.t = 999;
    G().advance(800); G().press('Enter', 30);
  }

  iai(m) {
    if (!m.counted) { m.counted = true; this.count('iai'); }
    for (let i = 0; i < 2000 && !m.duel.done; i++) {
      const r = m.duel.round;
      if (r.phase === 'cue') { G().press('KeyJ', 10); G().advance(400); } else G().advance(30);
    }
    G().advance(1500); G().press('Enter', 30);
  }

  haiku(m) {
    if (!m.counted) { m.counted = true; this.count('haiku'); m.tries = 0; }
    m.tries++;
    if (m.tries > 120) { G().press('Escape', 20); G().advance(40); return; }   // gives up, tile by tile
    G().press('ArrowRight', 20); G().press('Enter', 20); G().advance(40);
  }

  reel(m) {
    const r = m.reel;
    for (let i = 0; i < 60 * 30 && !r.done; i++) {
      const hold = r.fish > r.bar + r.barH / 2;
      if (hold) G().hold('KeyJ'); else G().release('KeyJ');
      G().advance(17);
    }
    G().release('KeyJ');
    if (r.done === 'caught') this.log.fishCaught++;
    G().advance(1500); G().press('Enter', 30);
  }

  // ---------------------------------------------------------------- the day

  go(map, tx, ty, dir = 'down') {
    const g = game();
    g.enter(map, tx, ty, dir);
    this.resolve(`arriving at ${map}`);
  }

  /** Skip ahead to a time of day; the villagers go to where their day has them by then. */
  at(minutes) {
    const g = game();
    if (minutes <= g.cal.minutes) return;
    g.cal.minutes = minutes;
    g.villagers.snap();
  }

  day() {
    const g = game(), d = dayIndex(g.cal), notes = [];
    this.resolve('morning');
    if (g.romance.spouse && !this.log.married) { this.log.married = g.romance.spouse; notes.push(`married ${g.romance.spouse}`); }
    // A little help: the valley warms to you steadily.
    for (const id of Object.keys(NPCS)) { g.bonds[id] ||= newBond(); g.bonds[id].met = true; addBond(g.bonds[id], 22); g.bonds[id].lastSeen = d; }
    this.tidy();
    this.farm();
    this.readMail();
    this.walkAbout();
    for (const [day, altar] of ALTARS) if (d === day) { restore(g, altar); this.resolve(`restoring ${altar}`); notes.push(`restored ${altar}`); }
    this.romance(d, notes);
    const f = festivalOn(g.cal);
    if (f) { this.festival(f); notes.push(`festival ${f.id}`); }
    else if (g.flags.restored_bridge && d % 5 === 2) this.dive(notes);
    else {
      if (d % 7 === 6 && g.flags.rin_arrived) this.dojo();
      const where = ROTATION[d % ROTATION.length];
      this.at(10 * 60 + (d % 3) * 90);
      if (where !== 'farm') { const sp = MAPS[where].spawn; this.go(where, sp.tx, sp.ty, sp.dir); }
      this.social(d);
      if (d % 4 === 1) this.fish();
      if (where === 'shrine' || d % 6 === 3) this.kodama();
      if (d % 11 === 5) { this.at(11 * 60); try { openShop(g, 'yorozuya'); } catch { /* closed */ } this.resolve('the shop'); }
      if (d % 5 === 3) this.visitHome();
      if (d === 50) this.forge();
    }
    this.bedtime(d, notes);
    return notes;
  }

  /** The plot by the house: tilled, planted with the season's seeds, watered, harvested, shipped. */
  farm() {
    const g = game();
    this.go('farm', 29, 14, 'down');
    const m = g.world.map, season = g.seasonId;
    const choices = Object.keys(CROPS).filter((id) => CROPS[id].seasons.includes(season) && !CROPS[id].paddy);
    for (let y = PLOT.y0; y < PLOT.y0 + PLOT.h; y++) for (let x = PLOT.x0; x < PLOT.x0 + PLOT.w; x++) {
      const o = m.objectAt(x, y);
      if (o && o.type !== 'hokora') m.removeObject(o);
      if (o?.type === 'hokora') continue;
      till(m, x, y);
      if (season === 'winter') coverSoil(m, x, y);
      clearDead(m, x, y);
      const c = cropAt(m, x, y);
      if (c && isRipe(c) && (g.world.harvestAt(x, y) || (this.tidy(), g.world.harvestAt(x, y)))) this.log.harvested++;
      if (!cropAt(m, x, y) && choices.length) plant(m, x, y, choices[(x + y) % choices.length], season);
      water(m, x, y);
    }
  }

  /** Keep the pack from filling up: give the Archive what it lacks, ship what sells (one each of
   * three crops, forage or fish kept for gifts), drop the rest (seeds too: the plot is sown by
   * hand), and buy the bigger packs when there is money for them. */
  tidy() {
    const g = game();
    const KEEP = new Set(['tool', 'weapon', 'romance', 'keepsake', 'quest', 'upgrade', 'place', 'machine', 'ammo', 'recipe', 'food']);
    if (g.flags.restored_archive) this.archive();
    let gifts = 0;
    for (let i = 0; i < g.inventory.size; i++) {
      const s = g.inventory.slots[i];
      if (!s || KEEP.has(ITEMS[s.id].kind)) continue;
      const keep = gifts < 3 && ['crop', 'forage', 'fish'].includes(ITEMS[s.id].kind) ? 1 : 0;
      gifts += keep;
      if (s.n > keep && ITEMS[s.id].sell) g.shipped.push({ id: s.id, n: s.n - keep, q: s.q || 0 });
      if (keep) s.n = Math.min(s.n, keep); else g.inventory.slots[i] = null;
    }
    for (const [size, price] of [[24, 2000], [36, 10000]]) {
      if (g.inventory.size < size && g.money >= price + 500) { g.money -= price; g.inventory.resize(size); this.log.pack = size; }
    }
  }

  /** Read every unread letter (their attachments come with them). */
  readMail() {
    const g = game();
    if (!g.mail.inbox.some((l) => !l.read)) return;
    openMailbox(g);
    for (let i = 0; i < g.mail.inbox.length; i++) { G().press('ArrowDown', 30); G().advance(40); }
    this.resolve('the mailbox');
  }

  /** Kata with Rin at dawn, then four arrows at the target. */
  dojo() {
    const g = game(), p = g.player;
    this.at(7 * 60);
    this.go('dojo', 3, 5, 'up');
    Object.assign(p, { x: 3 * 16 + 8, y: 5 * 16 + 12, dir: 'up' });
    G().advance(30); G().press('KeyE', 40);
    this.resolve('kata');
    Object.assign(p, { x: 12 * 16 + 8, y: 5 * 16 + 12, dir: 'up' });
    G().advance(30); G().press('KeyE', 40);
    this.resolve('kyudo');
  }

  /** Call on a villager at home at some hour: heart events wait in homes too. */
  visitHome() {
    const ids = Object.keys(NPCS), home = NPCS[ids[this.pick(ids.length)]].home, sp = MAPS[home]?.spawn;
    if (!sp) return;
    this.at(8 * 60 + this.pick(12) * 60);
    this.go(home, sp.tx, sp.ty, sp.dir);
  }

  /** Have Genzō make a Tetsu katana, and strike at the anvil with him (or not: the choice is random). */
  forge() {
    const g = game();
    if (g.inventory.count('katana_tetsu')) return;
    g.money += 1000;
    if (!g.inventory.count('katana_rusted')) g.inventory.add('katana_rusted', 1);
    g.inventory.add('iron_bar', 3);
    this.at(10 * 60);
    const m = new ForgeMenu(g);
    m.tab = 1;
    m.sel = Math.max(0, m.bladeRows().findIndex((r) => r.label === 'Tetsu Katana'));
    g.modals.push(m);
    G().advance(30); G().press('Enter', 40);
    this.count('forge');
    this.resolve('the forge');
  }

  /** Real keys: a stroll with the hoe, a swing, a look around. */
  walkAbout() {
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    game().inventory.select(0);
    for (let i = 0; i < 4; i++) { const k = dirs[this.pick(4)]; G().hold(k); G().advance(250 + this.pick(300)); G().release(k); }
    G().press('KeyJ', 40); G().advance(400);
    G().press('KeyE', 40); this.resolve('looking around');
  }

  /** Talk to two villagers on this map; every third day with a gift in hand. */
  social(d) {
    const g = game(), here = g.villagers.onMap(g.world.map.id);
    for (const n of here.slice(0, 2)) {
      const p = g.player;
      p.x = n.x; p.y = n.y + 16; p.dir = 'up';
      G().advance(20);
      const gift = d % 3 === 0 && g.inventory.slots.findIndex((s) => s && ['crop', 'forage', 'fish'].includes(ITEMS[s.id].kind));
      if (gift !== false && gift >= 0) { g.inventory.select(gift); this.log.gifts++; } else g.inventory.select(0);
      G().press('KeyE', 40);
      this.log.talks++;
      this.resolve(`talking to ${n.id}`);
    }
  }

  festival(f) {
    const g = game();
    this.at(f.from + 20);
    this.go(f.map, MAPS[f.map].spawn.tx, MAPS[f.map].spawn.ty, 'up');
    this.resolve(`festival ${f.id}`);
    this.log.festivals.push(`${f.id} Y${g.cal.year}`);
  }

  /** Down the mountain: five floors further each time, a fight, and the boss when it is there. */
  dive(notes) {
    const g = game();
    // The next fifth floor down, past the Shade into the Yomi Slope's modifiers.
    const floor = Math.min(125, Math.floor(g.caves.deepest / 5) * 5 + 5);
    g.hp = g.hpMax; g.ki = 100;
    const blade = ['tsukikage', 'onikiri', 'kitsunebi', 'kurogane', 'katana_tetsu', 'katana_rusted'].find((id) => g.inventory.count(id)) || 'katana_rusted';
    if (!g.inventory.count(blade)) g.inventory.add(blade, 1);
    this.at(9 * 60);
    enterFloor(g, floor);
    this.resolve(`floor ${floor}`);
    this.log.dives++;
    const c = g.world.combat, p = g.player;
    g.inventory.select(g.inventory.find(blade));
    for (let t = 0; t < 400 && c.foes.length && g.world.map.def.cave && !g.defeating; t++) {
      const f = c.foes.find((x) => !x.hidden) || c.foes[0];
      if (f.def.boss && f.hp > f.maxHp * 0.05) f.hp = Math.max(1, Math.round(f.maxHp * 0.03));
      if (f.def.boss && f.mem) { f.mem.duelCd = 99; }
      f.setState?.('recover');
      p.x = f.x - 20; p.y = f.y; p.dir = 'right';
      g.hp = g.hpMax;
      G().press('KeyJ', 40); G().advance(200);
      if (g.modals.length || g.pendingScene) this.resolve(`fighting on ${floor}`);
    }
    this.resolve(`after floor ${floor}`);
    this.log.deepest = Math.max(this.log.deepest, g.caves.deepest);
    if (!c.foes.length) notes.push(`cleared B${floor}`);
    if (g.world.map.def.cave) this.go('kurayama', 14, 7, 'down');
  }

  /** Court Tomoe in the first summer, extend the house, propose, marry. */
  romance(d, notes) {
    const g = game(), tomoe = g.villagers.get('tomoe');
    const give = (id) => {
      if (!tomoe || !MAPS[tomoe.map]) return;
      this.tidy();
      if (!g.inventory.count(id)) g.inventory.add(id, 1);
      this.go(tomoe.map, tomoe.tx, tomoe.ty + 1, 'up');
      const p = g.player;
      p.x = tomoe.x; p.y = tomoe.y + 16; p.dir = 'up';
      g.inventory.select(g.inventory.find(id));
      G().advance(20); G().press('KeyE', 40);
      // "Offer it?" The first answer, not a random one: the bot means it.
      const ask = g.modals.at(-1);
      if (ask?.choices) {
        for (let i = 0; i < 30 && g.modals.at(-1) === ask && !ask.finished; i++) { G().press('Enter', 30); G().advance(60); }
        if (g.modals.at(-1) === ask) { G().press('Enter', 30); G().advance(90); }
      }
      this.resolve(`giving ${id}`);
    };
    // Retry until the hearts allow it: the thread at eight, the vow at ten with the house built.
    const b = g.bonds.tomoe;
    if (d >= 60 && d % 4 === 0 && !b?.courting && !g.romance.spouse && hearts(b?.pts || 0) >= 8) {
      this.at(11 * 60); give('red_thread');
      if (g.bonds.tomoe.courting) notes.push('courting Tomoe');
    }
    if (d === 66 && !g.flags.house_upgraded) {
      this.tidy();
      g.money += 12000; g.inventory.add('wood', 150); g.inventory.add('stone', 50);
      this.at(10 * 60);
      try { openShop(g, 'tatsu'); } catch { /* closed today */ }
      if (g.modals.at(-1)?.constructor.name === 'ShopMenu') { G().press('Enter', 40); G().advance(200); }
      this.resolve('the carpenter');
      notes.push('house ordered');
    }
    if (d >= 72 && d % 4 === 2 && b?.courting && g.flags.house_upgraded && !g.romance.engaged && !g.romance.spouse && hearts(b.pts) >= 10) {
      this.at(11 * 60); give('shrine_vow');
      if (g.romance.engaged) notes.push('engaged');
    }
  }

  fish() {
    const g = game();
    if (!g.inventory.count('rod')) return;
    this.go('farm', 50, 22, 'right');
    const m = g.world.map, p = g.player;
    // Stand on the pond's bank, facing the water.
    for (let x = 43; x > 30; x--) if (!m.solid(x, 21) && m.isWater(x + 1, 21)) { p.x = x * 16 + 8; p.y = 21 * 16 + 12; p.dir = 'right'; break; }
    g.inventory.select(g.inventory.find('rod'));
    G().hold('KeyJ'); G().advance(700); G().release('KeyJ'); G().advance(500);
    for (let i = 0; i < 400; i++) {
      const s = g.world.fishing.state;
      if (!s) break;
      if (s.phase === 'bite') { G().press('KeyJ', 20); break; }
      G().advance(50);
    }
    this.resolve('fishing');
  }

  kodama() {
    const g = game();
    if (!g.flags.restored_kodama || (g.flags.kodama_friends || 0) >= 5) return;
    this.at(18 * 60);
    this.go('shrine', 19, 30, 'down');
    g.world.spawnSpots();
    const k = g.world.map.objects.find((o) => o.type === 'kodama');
    if (k) {
      g.inventory.add('warabi', 1);
      g.player.x = (k.x - 1) * 16 + 8; g.player.y = k.y * 16 + 12; g.player.dir = 'right';
      g.inventory.select(g.inventory.find('warabi'));
      G().advance(20); G().press('KeyE', 40);
      this.resolve('a kodama');
    }
    // A hokora for each friend, at the corners of the plot.
    const farm = g.worldFor('farm').map, have = farm.objects.filter((o) => o.type === 'hokora').length;
    const corners = [[PLOT.x0 - 1, PLOT.y0], [PLOT.x0 + PLOT.w, PLOT.y0], [PLOT.x0 - 1, PLOT.y0 + PLOT.h - 1], [PLOT.x0 + PLOT.w, PLOT.y0 + PLOT.h - 1], [PLOT.x0 + 2, PLOT.y0 - 1]];
    for (let i = have; i < (g.flags.kodama_friends || 0) && i < corners.length; i++) {
      const [x, y] = corners[i], o = farm.objectAt(x, y);
      if (o) farm.removeObject(o);
      farm.soil[farm.i(x, y)] = 0;
      farm.addObject({ type: 'hokora', x, y, v: 0 });
    }
  }

  archive() {
    const g = game();
    for (const s of g.inventory.slots) if (s && donatable(g.archive, s.id)) { donate(g.archive, s.id); g.inventory.remove(s.id, 1); }
  }

  bedtime(d, notes) {
    const g = game();
    this.resolve('evening');
    if (g.world.map.def.cave) this.go('kurayama', 14, 7, 'down');
    if (d % 10 === 9) {
      // Stay out too late and pass out at two.
      g.cal.minutes = 25 * 60 + 50;
      G().advance(8000);
      this.log.passedOut++;
      notes.push('passed out');
    } else g.sleep(false);
    this.resolve('the night');
  }
}
