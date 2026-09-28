// Boot: fonts, atlas, screen, input, audio, game, loop.
import { Screen } from './core/screen.js';
import { Input } from './core/input.js';
import { Loop } from './core/loop.js';
import { Audio } from './core/audio.js';
import { loadFonts, initFonts } from './core/text.js';
import { Debug, exposeTestHooks } from './core/debug.js';
import { buildArt } from './art/index.js';
import { CellCache } from './art/compiler.js';
import { Game } from './game.js';

async function boot() {
  const params = new URLSearchParams(location.search);
  await loadFonts('./');
  initFonts();
  const atlas = buildArt();
  const cells = new CellCache(16, 64, 64);
  const screen = new Screen(document.getElementById('screen'));
  const input = new Input(window, screen);
  const audio = new Audio();
  const game = new Game({ screen, input, atlas, cells, audio, params });
  const debug = params.get('debug') === '1' ? new Debug(game, null) : null;
  const loop = new Loop({
    update: (dt) => { game.update(dt); debug?.update(); },
    render: () => { game.render(); debug?.draw(screen.ctx); screen.present(); },
  });
  if (debug) debug.loop = loop;
  exposeTestHooks(game, loop);
  // Pause when the tab is hidden or loses focus (accessibility / battery).
  const setPaused = (p) => { loop.paused = p; audio.suspend(p); if (p) input.releaseAll(); };
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));
  addEventListener('blur', () => setPaused(true));
  addEventListener('focus', () => setPaused(false));
  if (params.get('slot')) game.loadSlot(Number(params.get('slot')));
  else if (params.get('play') === '1') game.startNew(1);
  document.getElementById('boot')?.remove();
  loop.start();
  window.__ready = true;
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) el.textContent = `Failed to start: ${err.message}`;
});
