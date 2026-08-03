// RERUN 2D — screens and HUD. Plain DOM over the plate.

import { TOTAL_ROUNDS } from './constants.js';
import { PLATES } from './arena.js';

const $ = (id) => document.getElementById(id);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export class UI {
  constructor() {
    this.el = {
      home: $('screen-home'), results: $('screen-results'),
      hud: $('hud'), score: $('score'), centre: $('centre'),
      controls: $('controls'), rotate: $('rotate'),
      stamp: $('selves').parentElement, selves: $('selves'),
      exposure: $('exposure'), timer: $('timer'), title: $('title'),
      pips: $('pips'), roundScore: $('round-score'), total: $('total'),
      rScore: $('r-score'), rAwards: $('r-awards'), rSplit: $('r-split'), rStrip: $('r-strip'),
    };
    this.pipEls = [];
    this.lastSelves = -1;
    this.armRotate();
  }

  armRotate() {
    const check = () => {
      const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 520;
      this.el.rotate.classList.toggle('hidden', !landscape);
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 120));
    check();
  }

  show(name) {
    this.el.home.classList.toggle('hidden', name !== 'home');
    this.el.results.classList.toggle('hidden', name !== 'results');
    this.el.hud.classList.toggle('hidden', name !== 'game');
    this.el.score.classList.toggle('hidden', name !== 'game');
    this.el.controls.classList.toggle('hidden', name !== 'game');
  }

  buildPips(required, turnstiles) {
    this.el.pips.innerHTML = '';
    this.pipEls = [];
    for (const idx of required) {
      const d = document.createElement('div');
      const turn = turnstiles.has(idx);
      d.className = turn ? 'pip turn' : 'pip';
      d.title = PLATES[idx].name + (turn ? ' — turnstile' : '');
      this.el.pips.appendChild(d);
      this.pipEls.push({ el: d, idx });
    }
  }

  updatePips(mask) {
    for (const p of this.pipEls) p.el.classList.toggle('on', (mask & (1 << p.idx)) !== 0);
  }

  setSelves(n) {
    if (n === this.lastSelves) return;
    this.lastSelves = n;
    this.el.selves.textContent = n;
    this.el.stamp.classList.remove('bumped');
    void this.el.stamp.offsetWidth;
    this.el.stamp.classList.add('bumped');
  }

  setRound(round, title) {
    this.el.exposure.textContent =
      `EXPOSURE ${String(round).padStart(2, '0')} / ${TOTAL_ROUNDS}`;
    this.el.title.textContent = title;
  }

  setTimer(sec, urgent) {
    this.el.timer.textContent = Math.max(0, sec).toFixed(1);
    this.el.timer.classList.toggle('urgent', !!urgent);
  }

  setScore(round, total) {
    this.el.roundScore.textContent = round.toFixed(1);
    this.el.total.textContent = Math.round(total);
  }

  centre(html, dim) {
    this.el.centre.innerHTML = html;
    this.el.centre.classList.toggle('hidden', !html);
    this.el.centre.classList.toggle('dim', !!dim);
  }

  countdown(n, title, goal) {
    this.centre(
      `<div class="count">${n}</div><div class="head">${esc(title)}</div>` +
      `<div class="sub">${esc(goal)}</div>`,
    );
  }

  settling(total, shown, eulogies) {
    const eul = eulogies.length
      ? `<div class="eul">${eulogies.map((e) =>
        `RETIRED &middot; GENERATION ${ROMAN[e.gen] || e.gen}<br>` +
        `IT HELD ${e.plateSeconds.toFixed(1)} PLATE-SECONDS. THE PLATE IS FULL.`,
      ).join('<br><br>')}</div>`
      : '';
    this.centre(
      '<div class="head">DEVELOPING</div>' +
      '<div class="sub">The exposure is being fixed. It does not come off again.</div>' +
      `<div class="pop">${shown} / ${total} PAST SELVES</div>${eul}`,
      true,
    );
  }

  /** Shown the first time a past self is knifed, so the rule lands once. */
  murdered(gen) {
    this.centre(
      '<div class="head">YOU KILLED YOURSELF</div>' +
      `<div class="sub">Generation ${gen} dies there now. It will walk up to that ` +
      'moment and die again every twenty seconds, for the rest of the plate.</div>',
      true,
    );
  }

  dead() {
    this.centre(
      '<div class="head">YOU FELL</div>' +
      '<div class="sub">So does the ghost. Every twenty seconds. For the rest of the plate.</div>',
      true,
    );
  }

  results(r) {
    this.el.rScore.innerHTML =
      `${r.score.toFixed(1)}<small>PLATE-SECONDS &middot; ${r.ghosts} GHOST${r.ghosts === 1 ? '' : 'S'} STILL RUNNING</small>`;

    this.el.rAwards.innerHTML = r.awards.map((a) =>
      `<div class="award"><div class="t">${esc(a.title)}</div>` +
      `<div class="w">${esc(a.who)}</div><div class="d">${esc(a.detail)}</div></div>`).join('');

    this.el.rSplit.innerHTML =
      `<div><div class="k">BY YOU, LIVING</div><div class="v">${r.live.toFixed(1)}</div></div>` +
      `<div><div class="k">BY WHO YOU WERE</div><div class="v">${r.ghostSeconds.toFixed(1)}</div></div>` +
      `<div><div class="k">FULL SETS</div><div class="v">${r.solvedRounds}</div></div>` +
      `<div><div class="k">MURDERED</div><div class="v${r.murders ? ' red' : ''}">${r.murders}</div></div>`;

    this.el.rStrip.innerHTML = r.history.map((h) =>
      `<div class="cell${h.solved ? ' solved' : ''}">` +
      `<div class="n">${String(h.round).padStart(2, '0')}</div>` +
      `<div class="v">${h.score.toFixed(0)}</div></div>`).join('');
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
