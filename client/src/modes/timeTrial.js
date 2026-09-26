// Time Trial: ghost selection (staff / your best / shared code), ghost
// recording, medals vs the staff ghost, best times and ghost sharing.
// Installed onto App (the App calls these hooks if present).
import { h, button, uiSound } from '../ui/ui.js';
import { topbar } from '../ui/screens.js';
import { fmtTime } from '../ui/hud.js';
import { getData, getTrackDef, getRacer } from '@shared/data/registry.js';
import { GhostRecorder, encodeGhost, decodeGhost, medalFor } from '@shared/sim/ghost.js';
import { getProfile, updateProfile, bumpStat } from '../core/profile.js';
import { httpBase } from '../net/client.js';

const MEDAL = { gold: '🥇', silver: '🥈', bronze: '🥉' };

async function loadStaff(trackId) {
  const fn = getData().staff?.[trackId];
  if (!fn) return null;
  const j = await fn();
  return { ...decodeGhost(j.code), name: 'Staff' };
}

// Resolve a code: 6-char server code or a full "G1." ghost string.
export async function fetchGhost(code) {
  code = String(code || '').trim();
  if (code.startsWith('G')) {
    if (code.includes('.')) return decodeGhost(code);
  }
  const r = await fetch(`${httpBase()}/api/ghosts/${encodeURIComponent(code.toUpperCase())}`);
  if (!r.ok) throw new Error(r.status === 404 ? 'No ghost with that code' : `Server error ${r.status}`);
  const j = await r.json();
  return { ...decodeGhost(j.data), name: j.name || 'Shared' };
}

export async function shareGhost(ghostCode, meta) {
  try {
    const r = await fetch(`${httpBase()}/api/ghosts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...meta, data: ghostCode }) });
    if (!r.ok) throw new Error('server');
    return { short: (await r.json()).code };
  } catch {
    return { long: ghostCode }; // offline: the full code works anywhere
  }
}

class TimeTrialSetup {
  constructor(trackId) { this.trackId = trackId; this.choice = 'staff'; this.custom = null; }
  build() {
    const def = getTrackDef(this.trackId);
    const prof = getProfile();
    const best = prof.bestTimes[this.trackId];
    const staffT = getData().staffTimes?.[this.trackId];
    const medal = prof.medals[this.trackId];
    this.status = h('div.small.status');
    this.codeIn = h('input.text-in', { placeholder: 'Ghost code (ABC123 or G1.…)', maxlength: 60000 });
    const opts = [
      ['staff', `Staff ghost${staffT ? ` · ${fmtTime(staffT)}` : ''}`, !!getData().staff?.[this.trackId]],
      ['best', `Your best${best ? ` · ${fmtTime(best.time)}` : ''}`, !!prof.ghosts[this.trackId]],
      ['both', 'Staff + your best', !!prof.ghosts[this.trackId] && !!getData().staff?.[this.trackId]],
      ['none', 'No ghost', true],
    ];
    this.optEl = h('div.seg.vertical', opts.map(([id, label, ok]) => h(`button.segb${this.choice === id ? '.on' : ''}${ok ? '' : '.disabled'}`, {
      disabled: !ok,
      onclick: () => { uiSound.click(); this.choice = id; this.custom = null; this.rerender(); },
    }, label)));
    const medals = staffT ? h('div.small', `🥇 ≤ ${fmtTime(staffT)} · 🥈 ≤ ${fmtTime(staffT * 1.05)} · 🥉 ≤ ${fmtTime(staffT * 1.12)}`) : null;
    return h('div.dim-bg.tt-setup', topbar(this, `Time Trial · ${def?.name || ''}`),
      h('div.online-grid',
        h('div.panel', h('h2', 'Race against'), this.optEl, medals,
          h('div', { style: { marginTop: '8px' } }, best ? `Best ${fmtTime(best.time)} ${medal ? MEDAL[medal] : ''}` : 'No time set yet')),
        h('div.panel', h('h2', 'Shared ghost'), this.codeIn,
          h('div.row', button('Load code', () => this.loadCode(), 'alt'), prof.ghosts[this.trackId] ? button('Share my best', () => this.shareBest(), 'alt') : null),
          this.status, button('Start!', () => this.start(), 'big green fight'))));
  }

  rerender() { const n = this.build(); this.el.replaceChildren(...n.childNodes); }

  async loadCode() {
    this.status.textContent = 'Loading…';
    try {
      const g = await fetchGhost(this.codeIn.value);
      if (g.track !== this.trackId) throw new Error(`That ghost is for ${getTrackDef(g.track)?.name || g.track}`);
      this.custom = g;
      this.status.textContent = `Loaded ${g.name || 'ghost'} · ${getRacer(g.racer)?.name || ''} · ${fmtTime(g.time)}`;
    } catch (e) { this.status.textContent = `⚠ ${e.message}`; }
  }

  async shareBest() {
    const prof = getProfile();
    const code = prof.ghosts[this.trackId];
    const best = prof.bestTimes[this.trackId];
    this.status.textContent = 'Sharing…';
    const res = await shareGhost(code, { track: this.trackId, time: best?.time, name: prof.name, racer: best?.racer, vehicle: best?.vehicle });
    const text = res.short || res.long;
    try { await navigator.clipboard?.writeText(text); } catch { /* clipboard blocked */ }
    this.status.textContent = res.short ? `Code ${res.short} copied — friends enter it here.` : 'Server offline: the full ghost code was copied instead (paste it into "Ghost code").';
  }

  async start() {
    const ghosts = [];
    const prof = getProfile();
    try {
      if (this.custom) ghosts.push({ g: this.custom, color: '#ffb0ff' });
      else {
        if (this.choice === 'staff' || this.choice === 'both') { const s = await loadStaff(this.trackId); if (s) ghosts.push({ g: s, color: '#ffe08a' }); }
        if ((this.choice === 'best' || this.choice === 'both') && prof.ghosts[this.trackId]) ghosts.push({ g: { ...decodeGhost(prof.ghosts[this.trackId]), name: 'You' }, color: '#8fd0ff' });
      }
    } catch (e) { console.warn('[tt] ghost load failed', e); }
    this.app.startTimeTrial({ trackId: this.trackId, ghosts });
  }
  enter() { this.app.showMenuStage('title'); }
}

export function installTimeTrial(App) {
  const P = App.prototype;

  P.openTimeTrialSetup = function (manager, trackId) { manager.push(new TimeTrialSetup(trackId)); return true; };

  P.startTimeTrial = function ({ trackId, ghosts = [] }) {
    const player = { ...this.playerEntrant(), id: 'p1', human: true };
    this.flow = { mode: 'tt', trackId, ghosts };
    this.startRace({ trackId, classId: '150cc', laps: getTrackDef(trackId)?.laps || 3, mode: 'timetrial', items: false, entrants: [player], localId: 'p1', intro: true });
    const s = this.session;
    const k = s.localKart();
    const sel = getProfile().selection;
    this.ttRecorder = new GhostRecorder(k, { track: trackId, racer: sel.racerId, vehicle: sel.vehicleId, wheels: sel.wheelsId, glider: sel.gliderId, name: getProfile().name || 'You' });
    s.stepHooks.push((race) => { if (race.phase === 'racing' && !k.finished) this.ttRecorder.step(); });
    for (const { g, color } of ghosts) this.stage.addGhost(g, color);
    this.ttGhostsInfo = ghosts.map(({ g }) => ({ name: g.name, time: g.time }));
  };

  P.onTimeTrialDone = function (session) {
    const k = session.localKart();
    const id = session.def.id;
    if (!k?.finished || k.estimated) return;
    const time = k.finishTime;
    const prof = getProfile();
    const prev = prof.bestTimes[id];
    const staffT = getData().staffTimes?.[id];
    const medal = medalFor(time, staffT);
    const rank = { gold: 3, silver: 2, bronze: 1 };
    this.ttResult = { time, prev: prev?.time, newBest: !prev || time < prev.time, medal, staffT };
    updateProfile((p) => {
      if (this.ttResult.newBest) {
        p.bestTimes[id] = { time, laps: k.lapTimes, racer: p.selection.racerId, vehicle: p.selection.vehicleId };
        p.ghosts[id] = encodeGhost(this.ttRecorder.finish(time, k.lapTimes));
      }
      if (medal && (!p.medals[id] || rank[medal] > rank[p.medals[id]])) p.medals[id] = medal;
    });
    bumpStat('timeTrials');
    if (this.ttResult.newBest) this.toast(prev ? `New record! −${(prev.time - time).toFixed(3)} s` : 'First time set!');
    if (medal) this.toast(`${MEDAL[medal]} ${medal[0].toUpperCase() + medal.slice(1)} medal!`);
    this.checkProgress?.();
  };

  P.timeTrialButtons = function () {
    const r = this.ttResult;
    const id = this.flow?.trackId;
    const out = [];
    if (r) {
      out.push(h('div.tt-summary', `${fmtTime(r.time)} ${r.medal ? MEDAL[r.medal] : ''}${r.staffT ? ` · staff ${fmtTime(r.staffT)}` : ''}${r.newBest ? ' · NEW BEST' : r.prev ? ` · best ${fmtTime(r.prev)}` : ''}`));
    }
    out.push(button('Retry', () => this.startTimeTrial({ trackId: id, ghosts: (this.flow.ghosts || []) }), 'alt'));
    if (getProfile().ghosts[id]) {
      out.push(button('Race my ghost', () => this.startTimeTrial({ trackId: id, ghosts: [{ g: { ...decodeGhost(getProfile().ghosts[id]), name: 'You' }, color: '#8fd0ff' }] }), 'alt'));
      out.push(button('Share', async () => {
        const best = getProfile().bestTimes[id];
        const res = await shareGhost(getProfile().ghosts[id], { track: id, time: best?.time, name: getProfile().name, racer: best?.racer, vehicle: best?.vehicle });
        try { await navigator.clipboard?.writeText(res.short || res.long); } catch { /* ignore */ }
        this.toast(res.short ? `Ghost code ${res.short} copied!` : 'Server offline — full ghost code copied.');
      }, 'alt'));
    }
    return out;
  };
}
