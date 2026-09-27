// Trivia modal: rendered from the server's synced trivia state. Both players
// see the same card; picks show as little squishy avatars.

import { COLORS } from './squishy.js';

const GATE_NAMES = ['The Bamboo Gate asks…', 'The Torii asks…', 'The Shrine asks…'];

export function createTrivia(el, { onPick, onContinue, sfx }) {
  let lastKey = '';
  let you = 0;

  const av = (slot) => `<span class="av p${slot}" title="${COLORS[slot].name}"></span>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.opt !== undefined) { sfx?.('tap'); onPick(+b.dataset.opt); }
    if (b.dataset.cont !== undefined) { sfx?.('tap'); onContinue(); }
  });

  function render(tr, slot) {
    you = slot;
    if (!tr) {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
      lastKey = '';
      return;
    }
    const key = JSON.stringify(tr);
    if (key === lastKey) return;
    const fresh = el.classList.contains('hidden');
    lastKey = key;
    const partner = 1 - you;
    const ask = tr.phase === 'ask';
    const result = tr.phase === 'result';

    const opts = tr.options.map((o, i) => {
      const who = [];
      for (const s of [0, 1]) {
        const p = tr.picks[s];
        if (p === i && (s === you || !ask)) who.push(av(s));
      }
      const cls = ['topt'];
      if (tr.picks[you] === i) cls.push('mine');
      if (result && tr.correct === i) cls.push('correct');
      if (result && tr.correct !== i) cls.push('dim');
      return `<button class="${cls.join(' ')}" data-opt="${i}" ${ask ? '' : 'disabled'}>${esc(o)}<span class="avatars">${who.join('')}</span></button>`;
    }).join('');

    let status = '';
    if (ask) {
      const mine = tr.picks[you] !== null;
      const theirs = tr.picks[partner] !== null;
      const pName = COLORS[partner].name;
      if (tr.attempt === 2 && !mine) status = 'One more try — talk it over together!<br>';
      status += theirs
        ? `<span class="ready">${av(partner)} ${pName} has chosen ✓</span>`
        : `<span class="ready">${av(partner)} ${pName} is thinking…</span>`;
      if (mine && !theirs) status += '<br>You can still change your mind.';
    } else if (tr.phase === 'reveal') {
      status = tr.picks[0] === tr.picks[1] ? 'You both chose the same answer…' : 'Two different answers…';
    } else if (tr.phase === 'retry') {
      status = tr.outcome === 'disagree'
        ? 'You picked differently! Chat it through and choose once more.'
        : 'Hmm — not quite. Have another think together.';
    }

    let resultHtml = '';
    if (result) {
      const title = tr.outcome === 'harmony' ? '✿ In harmony! ✿' : 'The gate opens all the same';
      const conts = [0, 1].filter((s) => tr.cont[s]).map(av).join('');
      resultHtml = `<div class="tresult">${title}</div><div class="tfact">${esc(tr.fact || '')}</div>
        <button class="btn green" data-cont ${tr.cont[you] ? 'disabled' : ''}>${tr.cont[you] ? 'Waiting for your partner…' : 'Continue'}</button>
        <div class="tstatus">${conts}</div>`;
    }

    el.innerHTML = `<div class="tcard" role="dialog" aria-modal="true" ${fresh ? '' : 'style="animation:none"'}>
      <div class="tgate">${GATE_NAMES[tr.gate] || 'A question'}${tr.attempt === 2 && !result ? ' · second try' : ''}</div>
      <div class="tq">${esc(tr.text)}</div>
      ${opts}
      ${result ? resultHtml : `<div class="tstatus">${status}</div>`}
    </div>`;
    el.classList.remove('hidden');
  }

  return { render };
}
