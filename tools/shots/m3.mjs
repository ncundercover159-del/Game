// Milestone 3 screenshots: the village, the shrine, interiors, villagers and their systems.
import { writeFileSync } from 'node:fs';

/** Settle into a scene: skip the intro aside and any welcome scene, then place the player. */
const place = (map, tx, ty, dir, setup = '') => `(() => {
  const G = window.__game, g = G.game;
  G.advance(1200);
  g.flags.ev_welcome = true; g.flags.met_heibei = true;
  g.modals = []; g.hud.aside = null;
  g.enter('${map}', ${tx}, ${ty}, '${dir}');
  ${setup}
  G.advance(120);
  g.hud.aside = null;
})()`;

/** Render a whole map at 1x through the game's own drawer (villagers included). */
async function overview(page, OUT, map, name) {
  const url = await page.evaluate(async (id) => {
    const { drawWorld } = await import('/src/world/draw.js');
    const { MAPS } = await import('/src/maps/index.js');
    const g = window.__game.game, sp = MAPS[id].spawn;
    g.enter(id, sp.tx, sp.ty, sp.dir);
    const m = g.world.map;
    const c = document.createElement('canvas');
    c.width = m.pw; c.height = m.ph;
    drawWorld(g.world, c.getContext('2d'), { x: 0, y: 0, ix: 0, iy: 0, w: m.pw, h: m.ph });
    return c.toDataURL('image/png');
  }, map);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`  ${OUT}/${name}.png`);
}

export default async function m3({ page, base, boot, shot, OUT }) {
  // Getsu morning: Heibei at the notice board, Chōbei opening up, the street waking.
  await boot(page, base, 'play=1&seed=7&time=08:40&weather=clear');
  await page.evaluate(place('village', 45, 13, 'left'));
  await shot('22-village-street');
  await overview(page, OUT, 'village', '23-village-overview');

  await boot(page, base, 'play=1&seed=7&time=08:00&weather=clear');
  await page.evaluate(() => { const G = window.__game, g = G.game; G.advance(1200); g.modals = []; g.hud.aside = null; g.enter('village', 78, 13, 'left'); G.advance(2600); });
  await shot('24-welcome-cutscene');

  await boot(page, base, 'play=1&seed=7&time=10:30&day=2&weather=clear');
  await page.evaluate(place('chaya', 2, 5, 'up', "g.bonds.okiku = { met: true, pts: 300, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0 };"));
  await page.evaluate(() => { const G = window.__game; G.press('KeyK'); G.advance(1200); });
  await shot('25-teahouse-counter');

  await boot(page, base, 'play=1&seed=7&time=10:00&day=2&weather=clear');
  await page.evaluate(place('kajiya', 8, 6, 'up', `
    g.bonds.genzo = { met: true, pts: 900, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0 };
    g.inventory.add('iron_bar', 1); g.inventory.select(g.inventory.find('iron_bar'));`));
  await page.evaluate(() => { const G = window.__game, g = G.game; g.talkTo(g.villagers.get('genzo')); G.press('Enter'); G.advance(60); G.press('Enter'); G.advance(1500); });
  await shot('26-gift-loved');

  await page.evaluate(() => {
    const G = window.__game, g = G.game;
    g.modals = [];
    const mk = (pts, known = {}) => ({ met: true, pts, talkedDay: -1, giftDay: -1, giftWeek: -1, giftsThisWeek: 0, lastSeen: 0, known });
    Object.assign(g.bonds, { heibei: mk(520), okiku: mk(760, { strawberry: 'loved', tea: 'liked' }), tomoe: mk(300), kaito: mk(130) });
    G.press('Tab'); G.press('BracketRight'); G.press('BracketRight'); G.press('ArrowDown'); G.advance(150);
  });
  await shot('27-bonds-tab');

  await boot(page, base, 'play=1&seed=7&time=09:30&day=4&weather=clear');
  await page.evaluate(place('village', 43, 12, 'up'));
  await page.evaluate(() => { const G = window.__game; G.press('KeyK'); G.advance(100); G.press('Enter'); G.advance(100); });
  await shot('28-notice-board');

  await boot(page, base, 'play=1&seed=7&time=07:00&day=8&weather=clear');
  await page.evaluate(place('farm', 32, 12, 'right', "g.bonds.okiku = { met: true, pts: 60 };"));
  await page.evaluate(async () => {
    const G = window.__game, g = G.game;
    const { deliverMail } = await import('/src/systems/mail.js');
    deliverMail(g);
    G.press('KeyK'); G.advance(200); G.press('ArrowDown'); G.advance(100);
  });
  await shot('29-letters');

  // Tomoe on the shrine stair at dusk, lanterns lit.
  await boot(page, base, 'play=1&seed=7&time=17:40&day=3&weather=clear');
  await page.evaluate(place('shrine', 20, 25, 'up'));
  await shot('30-shrine-stair-dusk');
  await overview(page, OUT, 'shrine', '33-shrine-overview');

  await boot(page, base, 'play=1&seed=7&time=11:00&day=3&season=summer&weather=clear');
  await page.evaluate(place('honden', 8, 5, 'up', `
    g.offerings.rei[0] = [3, 1, 0]; g.offerings.rei[1] = [6, 1];
    g.inventory.add('dango', 1);`));
  await page.evaluate(() => { const G = window.__game; G.press('KeyK'); G.advance(150); G.press('Enter'); G.advance(100); });
  await shot('31-altar-offering');

  await boot(page, base, 'play=1&seed=7&time=21:30&day=3&weather=clear');
  await page.evaluate(place('house_farm', 5, 7, 'up'));
  await shot('32-farmhouse-night');

  // A rainy afternoon: fishermen and farmers take shelter in the teahouse.
  await boot(page, base, 'play=1&seed=7&time=15:40&day=2&weather=rain');
  await page.evaluate(place('chaya', 6, 7, 'up'));
  await shot('34-teahouse-rain');
}
