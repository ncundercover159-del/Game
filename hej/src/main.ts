import './ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { C } from './content';
import type { ScriptNode } from './content/types';
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
    // Test-only: ?test&ch=N starts at chapter N with earlier chapters done.
    const jump = /[?&]test\b/.test(location.search) ? Number(new URLSearchParams(location.search).get('ch') ?? 0) : 0;
    if (jump > 1) skipTo(jump);
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

function skipTo(n: number) {
  const save = S.save!;
  const collect = (nodes: ScriptNode[]) => {
    for (const x of nodes) {
      if (x.k === 'set') Object.assign(save.flags, x.flags);
      if (x.k === 'choice') for (const o of x.opts) { if (o.set) Object.assign(save.flags, o.set); collect(o.then); }
      if (x.k === 'if') collect(x.then);
    }
  };
  for (const ch of C.chapters.slice(0, n - 1)) {
    collect(ch.intro);
    for (const sc of ch.scenes) { collect(sc.script); save.done.push(sc.id); }
    save.passed.push(ch.id);
  }
  save.chapter = n - 1;
}

boot().catch((e) => {
  console.error(e);
  document.body.append(Object.assign(document.createElement('pre'), { textContent: String(e?.stack ?? e), style: 'color:#fff;padding:16px' }));
});
