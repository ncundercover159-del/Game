import { C, audioKey, fill, lex } from '../content';
import { audioStatus, play } from '../audio/audio';
import type { Game } from '../game/game';
import { S } from '../game/state';
import { allCards, deckStats } from '../srs/deck';
import { State } from '../srs/fsrs';
import { db } from '../store/db';
import { allReports, writeSettings } from '../store/save';
import { attachSpeak, h, overlay, speakUi, toast, ui, uiBtn, waitNext } from './dom';
import { applyMode } from './hud';
import { sentence } from './sentence';

function sheet(...kids: (Node | null)[]) {
  return h('div', { class: 'panel sheet' }, ...kids.filter(Boolean) as Node[]);
}
function closeRow(onClose: () => void) {
  return h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, uiBtn('close', onClose));
}

// ─── title & setup ─────────────────────────────────────────────────────────
export function titleScreen(hasSave: boolean): Promise<'new' | 'continue'> {
  return new Promise((resolve) => {
    const cont = hasSave ? uiBtn('continue', () => resolve('continue'), 'primary') : null;
    const fresh = uiBtn('newGame', async () => {
      if (hasSave && !confirm('Start over? Your current progress and deck will be replaced.')) return;
      resolve('new');
    }, hasSave ? '' : 'primary');
    const logo = h('div', { class: 'logo', role: 'heading', 'aria-level': '1' }, 'Hej!');
    logo.addEventListener('click', () => speakUi('title'));
    const tag = h('div', { class: 'tag', lang: 'da' }, ui('tagline').da, h('div', { class: 'small', style: { opacity: '0.7' } }, ui('tagline').en));
    attachSpeak(tag, 'tagline');
    overlay.show(h('div', { class: 'title-screen' }, logo, tag, cont, h('br'), fresh,
      h('p', { class: 'small', style: { opacity: '0.6', marginTop: '28px', padding: '0 16px' } },
        'Headphones recommended · tap any Danish word to look it up · long-press a button to hear it')));
    (cont ?? fresh).focus();
  });
}

export function setupScreen(): Promise<{ name: string; gender: 'f' | 'm' }> {
  return new Promise((resolve) => {
    let name = C.names[0];
    let gender: 'f' | 'm' = 'f';
    const sample = () => {
      const l = Object.values(C.lines).find((x) => x.who === 'you' && x.da === 'Jeg hedder {name}.');
      if (l) void play(audioKey(l, gender, name), { text: `Jeg hedder ${name}.`, voice: gender === 'f' ? 'you_f' : 'you_m' });
    };
    const names = h('div', { class: 'row' });
    const genders = h('div', { class: 'seg', role: 'radiogroup' });
    const render = () => {
      names.replaceChildren(...C.names.map((n) => h('button', {
        class: `btn ${n === name ? 'primary' : ''}`, type: 'button', 'aria-pressed': String(n === name),
        onclick: () => { name = n; render(); void play(C.nameAudio[n], { text: n, voice: 'narrator' }); },
      }, n)));
      genders.replaceChildren(...(['f', 'm'] as const).map((g) => {
        const b = uiBtn(g === 'f' ? 'voiceF' : 'voiceM', () => { gender = g; render(); sample(); });
        b.className = g === gender ? 'on' : '';
        return b;
      }));
    };
    render();
    const start = uiBtn('start', () => resolve({ name, gender }), 'primary');
    overlay.show(sheet(
      h('div', { class: 'kicker' }, 'Ny start', h('span', { class: 'en' }, ' · New game')),
      h('h2', { lang: 'da' }, ui('pickName').da), h('div', { class: 'muted' }, 'Pick a name Danes can say (so every line can be voiced).'),
      h('div', { style: { margin: '10px 0' } }, names),
      h('h3', { lang: 'da' }, ui('pickVoice').da), h('div', { class: 'muted small' }, 'Your replies are spoken in this voice.'),
      genders,
      h('h3', {}, 'Subtitles'),
      modeSeg(),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '16px' } }, start)));
  });
}

function modeSeg() {
  const seg = h('div', { class: 'seg' });
  const render = () => seg.replaceChildren(...([['en', 'modeEn'], ['da', 'modeDa'], ['bare', 'modeBare']] as const).map(([m, key]) => {
    const b = uiBtn(key, async () => {
      S.settings.mode = m;
      applyMode();
      await writeSettings(S.settings);
      render();
    });
    b.className = S.settings.mode === m ? 'on' : '';
    return b;
  }));
  render();
  return seg;
}

// ─── practice hub ──────────────────────────────────────────────────────────
export function reviewHub(game: Game) {
  const st = deckStats();
  const ch = game.chapter();
  const canTest = game.chapterComplete();
  const passed = game.save.passed.includes(ch.id);
  const close = () => overlay.hide();
  overlay.show(sheet(
    h('div', { class: 'kicker' }, ui('review').da, h('span', { class: 'en' }, ' · Practise')),
    h('h2', {}, 'Din bunke', h('span', { class: 'en muted', style: { fontSize: '15px', fontWeight: '400' } }, ' · Your deck')),
    h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('b', {}, String(st.due)), 'due now'),
      h('div', { class: 'stat' }, h('b', {}, String(st.fresh)), 'new'),
      h('div', { class: 'stat' }, h('b', {}, String(st.known)), 'well known')),
    h('p', { class: 'small muted' }, `${st.words} words and ${st.sentences} sentences met. Reviews also happen in the world: neighbours quiz you (💬 marker) and the mailbox has daily post.`),
    h('div', { class: 'list' },
      uiBtn('start', () => { close(); void game.practice(); }, 'primary', h('span', { class: 'small' }, ' · 10 cards')),
      uiBtn('deck', () => deckScreen(game)),
      canTest ? uiBtn('chapterTest', () => { close(); void game.runChapterTest(); }, passed ? '' : 'good',
        h('span', { class: 'small' }, passed ? ' ✓ passed — retake' : ` · Kapitel ${ch.n}`)) : null,
      !canTest ? h('div', { class: 'small muted' }, `The chapter ${ch.n} test unlocks after the last scene.`) : null),
    closeRow(close)));
}

export function deckScreen(game: Game) {
  const cards = allCards().sort((a, b) => a.due - b.due);
  const now = Date.now();
  const stateName = (s: number) => ['new', 'learning', 'review', 'relearning'][s];
  const rows = cards.map((c) => {
    const due = c.state === State.New ? 'new' : c.due <= now ? 'due' : `in ${Math.max(1, Math.round((c.due - now) / 86_400_000))}d`;
    if (c.kind === 'w') {
      const e = lex(c.ref);
      if (!e) return null;
      return h('div', { class: 'item' },
        h('button', { class: 'btn tool', type: 'button', 'aria-label': `Play ${e.lemma}`, onclick: () => play(e.audio, { text: e.lemma, voice: 'narrator' }) }, '🔊'),
        h('div', { class: 'grow' }, h('b', { lang: 'da' }, e.lemma), c.starred ? ' ★' : '', h('div', { class: 'small muted' }, e.en)),
        h('span', { class: 'small' }, `${stateName(c.state)} · ${due}`));
    }
    const l = C.lines[c.ref];
    if (!l) return null;
    return h('div', { class: 'item' },
      h('div', { class: 'grow' }, sentence(l), h('div', { class: 'small muted' }, fill(l.en, game.save.name))),
      h('span', { class: 'small' }, `${stateName(c.state)} · ${due}`));
  });
  overlay.show(sheet(
    h('div', { class: 'kicker' }, ui('deck').da, h('span', { class: 'en' }, ' · My words')),
    h('h2', {}, `${cards.length} cards`),
    h('div', { class: 'list' }, rows.filter(Boolean) as Node[]),
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '12px' } },
      h('button', { class: 'btn', type: 'button', onclick: () => reviewHub(game) }, '← Back'),
      uiBtn('close', () => overlay.hide()))));
  (overlay.el.querySelectorAll('.sent') as NodeListOf<HTMLElement>).forEach((s) => (s.style.fontSize = '16px'));
}

// ─── settings ──────────────────────────────────────────────────────────────
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function settingsScreen(game: Game) {
  const s = S.settings;
  const save = async () => writeSettings(s);
  const check = (label: string, key: 'autoplay' | 'speakUi' | 'speaking') =>
    h('label', { class: 'check' }, h('input', {
      type: 'checkbox', checked: s[key], onchange: async (e: Event) => { s[key] = (e.target as HTMLInputElement).checked; await save(); },
    }), label);
  const au = audioStatus();
  const lines = Object.values(C.lines).filter((l) => l.src !== 'ui');
  const reviewed = lines.filter((l) => l.reviewed).length;
  const reports = await allReports();
  const aiKey = h('input', { type: 'password', value: s.aiKey, placeholder: 'sk-ant-… (optional)', autocomplete: 'off' }) as HTMLInputElement;
  aiKey.addEventListener('change', async () => { s.aiKey = aiKey.value.trim(); await save(); toast('Saved on this device'); });
  const newPer = h('input', { type: 'number', min: '5', max: '100', value: String(s.newPerDay), style: { width: '90px' } }) as HTMLInputElement;
  newPer.addEventListener('change', async () => { s.newPerDay = Math.max(5, Math.min(100, Number(newPer.value) || 25)); await save(); });

  overlay.show(sheet(
    h('div', { class: 'kicker' }, ui('settings').da, h('span', { class: 'en' }, ' · Settings')),
    h('h3', {}, 'Scaffolding'), modeSeg(),
    h('p', { class: 'small muted' }, 'English subtitles → Danish only (tap EN to peek) → no hints at all. Switch any time from the top bar.'),
    check('Play each line automatically', 'autoplay'),
    check('Read buttons aloud on long-press / hover', 'speakUi'),
    check('Speaking exercises (microphone: speech recognition + shadowing)', 'speaking'),
    h('label', { class: 'check' }, 'New cards per day ', newPer),
    h('h3', {}, 'Audio'),
    h('p', { class: 'small' }, au.clips
      ? `${au.clips} neural voice clips installed.`
      : 'No neural clips generated yet — using your browser’s Danish voice as a fallback. Run `npm run audio` with a Google Cloud TTS key to generate them.',
    h('br'), au.fallbackVoice ? `Fallback voice: ${au.fallbackVoice}` : 'No Danish system voice found — fallback audio may use a non-Danish voice.'),
    h('h3', {}, 'Free conversation (optional AI)'),
    h('p', { class: 'small' }, 'Snak works offline with built-in conversations. Add an Anthropic API key to also get open-ended, generated conversations. The key stays in this browser and is sent only to api.anthropic.com.'),
    aiKey,
    h('h3', {}, 'Content review'),
    h('p', { class: 'small' }, `${reviewed} of ${lines.length} lines approved by a native speaker. ${reports.length} mistake report${reports.length === 1 ? '' : 's'} saved on this device.`),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => download(`hej-reports-${Date.now()}.json`, { version: C.version, reports }) }, 'Export reports'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => download(`hej-save-${Date.now()}.json`, { save: game.save, cards: await db.all('cards') }),
      }, 'Export progress')),
    h('h3', {}, 'Danger zone'),
    h('button', {
      class: 'btn', type: 'button',
      onclick: async () => {
        if (!confirm('Delete all progress, deck and reports on this device?')) return;
        await db.clear('cards'); await db.clear('kv'); await db.clear('log');
        location.reload();
      },
    }, 'Reset everything'),
    closeRow(() => overlay.hide())));
}

export async function notice(title: string, body: string) {
  const ok = uiBtn('next', () => {}, 'primary');
  overlay.show(sheet(h('h2', {}, title), h('p', {}, body), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, ok)));
  await waitNext(ok);
  overlay.hide();
}
