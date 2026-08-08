// HAZARD PAY — the overlay.
//
// Plain DOM over the canvas. Everything here is read from the room, never
// computed twice: if the HUD and the simulation ever disagree about the money,
// the HUD is wrong by construction.

import { PHASE, HEALTH_MAX, STAMINA_MAX } from '../../shared/tune.js';
import { PROP_BY_ID } from '../../shared/props.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(level) {
    this.level = level;
    this.el = {
      quotaFigure: $('quota-figure'), quotaBar: $('quota-bar'), clock: $('clock'),
      tasks: $('tasks'), health: $('health-bar'), stamina: $('stamina-bar'),
      held: $('held'), crosshair: $('crosshair'), toast: $('banner'),
      results: $('results'), resultsBody: $('results-body'), fps: $('netstat'),
      water: $('water'), prompt: $('prompt'),
    };
    this.el.promptLabel = this.el.prompt.querySelector('.p-label');
    this.el.promptBar = this.el.prompt.querySelector('.p-bar b');
    this.lastTasks = '';
    this.toastUntil = 0;
    this.buildTasks();
  }

  buildTasks() {
    this.el.tasks.innerHTML = this.level.tasks.map((t) => `
      <li data-id="${t.id}">
        <i></i>
        <span class="t">${esc(t.title)}${t.bonus ? ` <b>+£${t.bonus}</b>` : ''}</span>
        <span class="d">${esc(t.detail)}</span>
        <b class="p"></b>
      </li>`).join('');
    this.taskBars = [...this.el.tasks.querySelectorAll('.p')];
  }

  update(room, me, fps, draws) {
    const quota = this.level.quota;
    this.el.quotaFigure.textContent = `£${room.banked.toLocaleString()} / £${quota.toLocaleString()}`;
    const pct = Math.min(1, room.banked / quota);
    this.el.quotaBar.style.width = `${(pct * 100).toFixed(1)}%`;
    this.el.quotaBar.classList.toggle('met', room.banked >= quota);

    const left = room.phaseEndsAt ? Math.max(0, (room.phaseEndsAt - performance.now()) / 1000) : 0;
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    this.el.clock.textContent = room.phase === PHASE.BRIEFING
      ? `STARTS IN ${Math.ceil(left)}`
      : `${mm}:${String(ss).padStart(2, '0')}`;
    this.el.clock.classList.toggle('urgent', room.phase === PHASE.ACTIVE && left < 30);

    // Task ticks. Serialised first so the DOM is only touched when it changes —
    // this runs every frame.
    const sig = room.taskState.map((s) => `${s.done ? 1 : 0}${Math.round(s.progress * 40)}`).join('');
    if (sig !== this.lastTasks) {
      this.lastTasks = sig;
      const lis = this.el.tasks.children;
      for (let i = 0; i < lis.length; i++) {
        const st = room.taskState[i];
        lis[i].classList.toggle('done', st.done);
        if (this.taskBars[i]) {
          this.taskBars[i].style.width = `${Math.min(100, (st.progress || 0) * 100).toFixed(0)}%`;
        }
      }
    }

    if (me) {
      this.el.health.style.width = `${(me.health / HEALTH_MAX * 100).toFixed(0)}%`;
      this.el.health.classList.toggle('low', me.health < 35);
      this.el.stamina.style.width = `${(me.stamina / STAMINA_MAX * 100).toFixed(0)}%`;
      this.el.stamina.classList.toggle('low', me.stamina < 18);

      const held = me.held ? PROP_BY_ID[me.held.kind] : null;
      this.el.held.textContent = held ? `${held.name} · ${held.mass}kg · £${held.value}` : '';
      this.el.held.classList.toggle('hidden', !held);

      const target = room.target === undefined ? null : me.held ? null : null;
      const grabbable = !!(!me.held && me.canGrab);
      this.el.crosshair.className = me.held ? 'ch-holding'
        : grabbable ? 'ch-target' : 'ch-idle';
      void target;
    }

    this.el.fps.textContent = `${Math.round(fps)}fps \u00b7 ${draws} draws`;
    this.el.fps.classList.remove('hidden');

    if (this.toastUntil && performance.now() > this.toastUntil) {
      this.el.toast.classList.add('hidden');
      this.toastUntil = 0;
    }
  }

  /**
   * The hold-to-use prompt.
   *
   * Driven from the actor's own turn timer rather than a local one, so the bar
   * is the server's opinion of your progress and not the client's — a bar that
   * fills and then does nothing is worse than no bar.
   */
  setPrompt(label, progress) {
    const on = !!label;
    this.el.prompt.classList.toggle('hidden', !on);
    if (!on) return;
    if (this.promptLabel !== label) {
      this.promptLabel = label;
      this.el.promptLabel.textContent = label;
    }
    this.el.promptBar.style.width = `${Math.min(100, progress * 100).toFixed(0)}%`;
  }

  /** Head under water. Opacity tracks depth so going under has a moment. */
  setSubmerged(depth) {
    const on = depth > 0;
    this.el.water.classList.toggle('hidden', !on);
    if (on) this.el.water.style.opacity = Math.min(1, 0.45 + depth * 0.4).toFixed(2);
  }

  flash(text, kind = 'note') {
    this.el.toast.textContent = text;
    this.el.toast.className = `toast ${kind}`;
    this.toastUntil = performance.now() + 1900;
  }

  results(r) {
    this.el.resultsBody.innerHTML = `
      <div class="big ${r.met ? 'good' : 'bad'}">${r.met ? 'QUOTA MET' : 'QUOTA MISSED'}</div>
      <dl>
        <div><dt>BANKED</dt><dd>£${r.banked.toLocaleString()}</dd></div>
        <div><dt>BONUSES</dt><dd>£${r.bonus.toLocaleString()}</dd></div>
        <div><dt>TOTAL</dt><dd>£${r.total.toLocaleString()}</dd></div>
        <div><dt>BREAKAGES</dt><dd class="${r.breakages ? 'bad' : ''}">${r.breakages}</dd></div>
        <div><dt>ON SITE</dt><dd>${r.seconds}s</dd></div>
      </dl>
      ${r.bonuses.length ? `<ul class="bonus">${r.bonuses
        .map((b) => `<li>${esc(b.title)} <b>+£${b.paid}</b></li>`).join('')}</ul>` : ''}`;
    this.el.results.classList.remove('hidden');
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
