import './ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { C } from './content';
import { initAudio } from './audio/audio';
import { Game } from './game/game';
import { S } from './game/state';
import { loadDeck } from './srs/deck';
import { db } from './store/db';
import { loadSave, loadSettings, newSave, writeSave } from './store/save';
import { applyMode } from './ui/hud';
import { reviewHub, settingsScreen, setupScreen, titleScreen } from './ui/screens';
import { openTalkHub } from './talk/talk';

async function boot() {
  registerSW({ immediate: true });
  S.settings = await loadSettings();
  applyMode();
  await initAudio();
  const existing = await loadSave();
  const choice = await titleScreen(!!existing);
  if (choice === 'new') {
    const { name, gender } = await setupScreen();
    await db.clear('cards');
    await db.clear('log');
    const first = C.maps.street;
    S.save = newSave(name, gender, { map: first.id, ...first.spawn });
    await writeSave(S.save);
  } else {
    S.save = existing!;
  }
  await loadDeck();
  const game = new Game(document.getElementById('world') as HTMLCanvasElement);
  game.onOpenReview = () => reviewHub(game);
  game.onOpenSettings = () => void settingsScreen(game);
  game.onOpenTalk = (npc) => openTalkHub(game, npc);
  (window as any).__hej = { game, S, C };
  document.getElementById('overlay')!.classList.remove('open');
  await game.begin();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.persist();
  });
}

boot().catch((e) => {
  console.error(e);
  document.body.append(Object.assign(document.createElement('pre'), { textContent: String(e?.stack ?? e), style: 'color:#fff;padding:16px' }));
});
