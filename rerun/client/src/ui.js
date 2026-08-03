// RERUN — screens, HUD, overlays. Plain DOM; the GPU has enough to do.

import { TOTAL_ROUNDS, SLOT_COLORS } from '@shared/constants.js';
import { PLATES } from '@shared/arena.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      home: $('screen-home'),
      lobby: $('screen-lobby'),
      results: $('screen-results'),
      hud: $('hud'),
      centre: $('centre'),
      controls: $('controls'),
      rotate: $('rotate'),
      net: $('net-status'),
      pastSelves: $('past-selves'),
      pastSelvesN: $('past-selves').querySelector('b'),
      roundLabel: $('round-label'),
      roundTimer: $('round-timer'),
      roundTitle: $('round-title'),
      pips: $('plate-pips'),
      roundScore: $('round-score'),
      teamScore: $('team-score'),
      toast: $('toast'),
      lobbyCode: $('lobby-code'),
      lobbyPlayers: $('lobby-players'),
      lobbyHint: $('lobby-hint'),
      btnStart: $('btn-start'),
      btnShare: $('btn-share'),
      btnAgain: $('btn-again'),
      homeError: $('home-error'),
      nameInput: $('name-input'),
      codeInput: $('code-input'),
      resultsScore: $('results-score'),
      resultsAwards: $('results-awards'),
      resultsPlayers: $('results-players'),
      resultsRounds: $('results-rounds'),
      resultsHint: $('results-hint'),
    };
    this.pipEls = [];
    this.lastGhostCount = 0;
    this.toastTimer = 0;
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

  showScreen(name) {
    this.el.home.classList.toggle('hidden', name !== 'home');
    this.el.lobby.classList.toggle('hidden', name !== 'lobby');
    this.el.results.classList.toggle('hidden', name !== 'results');
    this.el.hud.classList.toggle('hidden', name !== 'game');
    this.el.controls.classList.toggle('hidden', name !== 'game');
  }

  error(msg) {
    this.el.homeError.textContent = msg || '';
  }

  netStatus(msg) {
    this.el.net.textContent = msg || '';
    this.el.net.classList.toggle('hidden', !msg);
  }

  // ---------------------------------------------------------------- lobby
  renderLobby(room, myId) {
    this.el.lobbyCode.textContent = room.code;
    this.el.lobbyPlayers.innerHTML = '';
    for (const p of room.players) {
      const d = document.createElement('div');
      d.className = 'lp' + (p.connected ? '' : ' gone');
      d.innerHTML =
        `<span class="dot" style="background:#${SLOT_COLORS[p.slot % 8].toString(16).padStart(6, '0')}"></span>` +
        `<span>${escapeHtml(p.name)}</span>` +
        (p.id === room.hostId ? '<span class="host">HOST</span>' : '');
      this.el.lobbyPlayers.appendChild(d);
    }
    const isHost = room.hostId === myId;
    const n = room.players.filter((p) => p.connected).length;
    const need = room.minPlayers || 3;
    this.el.btnStart.classList.toggle('hidden', !isHost);
    this.el.btnStart.disabled = n < need;
    this.el.lobbyHint.textContent = isHost
      ? (n < need ? `NEED ${need - n} MORE. Below three there aren't enough bodies for the plates to be interesting.` : 'Six rounds. Twenty seconds each. No take-backs.')
      : `Waiting for the host. ${n}/${need} in the room.`;
  }

  // ------------------------------------------------------------------ HUD
  buildPips(required) {
    this.el.pips.innerHTML = '';
    this.pipEls = [];
    for (const idx of required) {
      const d = document.createElement('div');
      d.className = 'pip';
      d.title = PLATES[idx].name;
      this.el.pips.appendChild(d);
      this.pipEls.push({ el: d, idx });
    }
  }

  updatePips(mask) {
    for (const p of this.pipEls) {
      p.el.classList.toggle('on', (mask & (1 << p.idx)) !== 0);
    }
  }

  setGhostCount(n) {
    if (n === this.lastGhostCount) return;
    this.lastGhostCount = n;
    this.el.pastSelvesN.textContent = n;
    this.el.pastSelves.classList.remove('bumped');
    void this.el.pastSelves.offsetWidth;
    this.el.pastSelves.classList.add('bumped');
  }

  setRound(round, title) {
    this.el.roundLabel.textContent = `ROUND ${round} / ${TOTAL_ROUNDS}`;
    this.el.roundTitle.textContent = title || '';
  }

  setTimer(seconds, urgent) {
    this.el.roundTimer.textContent = Math.max(0, seconds).toFixed(1);
    this.el.roundTimer.classList.toggle('urgent', !!urgent);
  }

  setScores(round, team) {
    this.el.roundScore.textContent = round.toFixed(1);
    this.el.teamScore.textContent = Math.round(team);
  }

  toast(text, ms = 1800) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------- overlays
  centre(html, dim) {
    this.el.centre.innerHTML = html;
    this.el.centre.classList.toggle('hidden', !html);
    this.el.centre.classList.toggle('dim', !!dim);
  }

  countdown(n, title, goal) {
    this.centre(
      `<div class="count">${n}</div>` +
      `<div class="headline">${escapeHtml(title)}</div>` +
      `<div class="sub">${escapeHtml(goal)}</div>`,
    );
  }

  settling(count, revealed, eulogies) {
    const eul = eulogies && eulogies.length
      ? `<div class="eulogy">${eulogies.map((e) =>
        `RETIRED &middot; ${escapeHtml(e.name)}'S GEN ${e.gen} GHOST<br>` +
        `IT CONTRIBUTED ${e.plateSeconds.toFixed(1)} PLATE-SECONDS AND IS NOW AT REST.`).join('<br><br>')}</div>`
      : '';
    this.centre(
      '<div class="headline">SETTLING</div>' +
      '<div class="sub">Your past selves are taking their positions.</div>' +
      `<div class="pop-count">POPULATION ${revealed} / ${count}</div>` +
      eul,
      true,
    );
  }

  dead() {
    this.centre(
      '<div class="headline">YOU FELL</div>' +
      '<div class="sub">So does your ghost. Every twenty seconds. For the rest of the match.</div>',
      true,
    );
  }

  catchingUp() {
    this.centre(
      '<div class="headline">CATCHING UP</div>' +
      '<div class="sub">Downloading everyone else\'s mistakes.</div>',
      true,
    );
  }

  // -------------------------------------------------------------- results
  renderResults(res, isHost) {
    this.el.resultsScore.innerHTML =
      `${res.teamScore.toFixed(1)}<small>TOTAL PLATE-SECONDS &middot; ${res.ghosts} GHOSTS STILL RUNNING</small>`;

    this.el.resultsAwards.innerHTML = res.awards.map((a) =>
      `<div class="award"><div class="t">${escapeHtml(a.title)}</div>` +
      `<div class="w">${escapeHtml(a.who)}</div>` +
      `<div class="d">${escapeHtml(a.detail)}</div></div>`).join('');

    this.el.resultsPlayers.innerHTML =
      '<div class="sect">PLATE-SECONDS BY PLAYER (LIVING + GHOSTS)</div>' +
      res.players.map((p) =>
        `<div class="rrow">` +
        `<span class="dot" style="background:#${SLOT_COLORS[p.slot % 8].toString(16).padStart(6, '0')}"></span>` +
        `<span class="n">${escapeHtml(p.name)}</span>` +
        `<span class="s">${p.ghost.toFixed(1)} ghost</span>` +
        `<span class="v">${p.total.toFixed(1)}</span></div>`).join('');

    this.el.resultsRounds.innerHTML =
      '<div class="sect">BY ROUND</div>' +
      res.rounds.map((r) =>
        `<div class="rrow"><span class="n">ROUND ${r.round}${r.solved ? ' &middot; FULL SET' : ''}</span>` +
        `<span class="s">${r.ghosts} ghosts</span>` +
        `<span class="v">${r.plateSeconds.toFixed(1)}</span></div>`).join('');

    this.el.btnAgain.classList.toggle('hidden', !isHost);
    this.el.resultsHint.textContent = isHost
      ? 'Going again clears every ghost. That is the only way it ever happens.'
      : 'Waiting for the host.';
  }
}


function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
