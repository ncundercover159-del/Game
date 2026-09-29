import type { Line } from '../content/types';
import { fill } from '../content';
import { S, who } from '../game/state';
import type { Mode } from '../store/save';
import { writeSettings } from '../store/save';
import { attachSpeak, clear, h } from './dom';
import { playLine, sentence } from './sentence';

const MODES: { m: Mode; label: string; title: string }[] = [
  { m: 'en', label: 'EN', title: 'English subtitles' },
  { m: 'da', label: 'DA', title: 'Danish only (tap EN to reveal)' },
  { m: 'bare', label: '—', title: 'No hints' },
];

export function applyMode() {
  document.body.classList.remove('mode-en', 'mode-da', 'mode-bare');
  document.body.classList.add(`mode-${S.settings.mode}`);
}

export function renderHud(o: {
  objective?: Line;
  due: number;
  onReview: () => void;
  onTalk: () => void;
  onSettings: () => void;
  /** Tapping the goal starts something (e.g. the chapter test) instead of replaying it. */
  onObjective?: () => void;
}) {
  const hud = clear(document.getElementById('hud')!);
  const { name } = who();
  if (o.objective) {
    const l = o.objective;
    const chip = h('div', { class: 'panel objective', role: 'button', 'aria-label': `Objective: ${fill(l.en, name)}` },
      h('div', { class: 'label' }, 'Mål', h('span', { class: 'en' }, ' · Goal')),
      sentence(l),
      h('div', { class: 'en' }, fill(l.en, name)),
      o.onObjective ? h('div', { class: 'small', style: { fontWeight: '800', color: 'var(--red)' } }, '▶ Tap to start') : null);
    chip.querySelector('.sent')!.setAttribute('style', 'font-size:15px;line-height:1.3');
    chip.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.w')) return;
      void playLine(l);
      o.onObjective?.();
    });
    hud.append(chip);
  } else hud.append(h('div', { class: 'grow' }));

  const mode = MODES.find((x) => x.m === S.settings.mode)!;
  const modeBtn = h('button', {
    class: 'btn icon hud-btn', type: 'button', title: `Subtitles: ${mode.title}`, 'aria-label': `Subtitles: ${mode.title}. Tap to change.`,
    onclick: async () => {
      const i = MODES.findIndex((x) => x.m === S.settings.mode);
      S.settings.mode = MODES[(i + 1) % MODES.length].m;
      applyMode();
      await writeSettings(S.settings);
      renderHud(o);
    },
  }, h('span', { style: { fontSize: '13px', fontWeight: '900' } }, mode.label));
  attachSpeak(modeBtn, 'subtitles');
  const talk = h('button', { class: 'btn icon hud-btn', type: 'button', title: 'Snak — free conversation', 'aria-label': 'Chat (free conversation)', onclick: o.onTalk }, '💬');
  attachSpeak(talk, 'talk');
  const rev = h('button', { class: 'btn icon hud-btn', type: 'button', title: 'Øv — practise', 'aria-label': `Practise, ${o.due} due`, onclick: o.onReview },
    '📚', o.due ? h('span', { class: 'badge' }, String(o.due)) : null);
  attachSpeak(rev, 'review');
  const set = h('button', { class: 'btn icon hud-btn', type: 'button', title: 'Indstillinger — settings', 'aria-label': 'Settings', onclick: o.onSettings }, '⚙');
  attachSpeak(set, 'settings');
  hud.append(h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, modeBtn, talk, rev, set));
}
