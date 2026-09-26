// Versus rules (items, laps, CPUs, difficulty, teams) and the Credits screen.
import { h, button, uiSound } from '../ui/ui.js';
import { topbar } from '../ui/screens.js';
import { getTrackDef, getData } from '@shared/data/registry.js';

class VersusRules {
  constructor(params) { this.p = { items: true, laps: 3, count: 12, difficulty: null, teams: false, ...params }; }
  build() {
    const p = this.p;
    const seg = (label, key, values, fmt = (v) => v) => h('div.opt', h('span', label), h('div.seg', values.map((v) => h(`button.segb${p[key] === v ? '.on' : ''}`, {
      onclick: () => { uiSound.click(); p[key] = v; this.rerender(); },
    }, fmt(v)))));
    return h('div.dim-bg.battle-setup', topbar(this, `Versus · ${getTrackDef(p.trackId)?.name || ''}`),
      h('div.online-grid',
        h('div.panel.settings', h('h2', 'Rules'),
          seg('Items', 'items', [true, false], (v) => (v ? 'On' : 'Off')),
          seg('Laps', 'laps', [1, 2, 3, 5]),
          seg('Racers', 'count', [2, 4, 8, 12]),
          seg('CPU skill', 'difficulty', [null, 'easy', 'normal', 'hard', 'expert'], (v) => (v ? v[0].toUpperCase() + v.slice(1) : 'By class')),
          seg('Teams', 'teams', [false, true], (v) => (v ? 'Red vs Blue' : 'Free for all'))),
        h('div.panel', h('h2', 'Ready?'), button('Race!', () => this.app.startVersus(p), 'big green fight'), h('div.small', { style: { marginTop: '10px' } }, 'Teams: items never hit teammates; team points are added up by finishing position. Fewer racers = fewer items flying around.'))));
  }
  rerender() { const n = this.build(); this.el.replaceChildren(...n.childNodes); }
  enter() { this.app.showMenuStage('title'); }
}

class CreditsScreen {
  build() {
    const racers = Object.values(getData().racers).map((r) => r.name).join(' · ');
    return h('div.dim-bg.credits', topbar(this, 'Credits'),
      h('div.panel.credits-body',
        h('h2', 'SKYKART'),
        h('p', 'A mobile-first kart racer. Code, procedural art, music and sound are generated at runtime — no downloaded media.'),
        h('p', h('b', 'Roster: '), racers),
        h('p', h('b', 'Built with: '), 'three.js · Web Audio · Vite · Node + ws · Vitest · Playwright'),
        h('p', h('b', 'Fonts: '), 'Lilita One, Fredoka (SIL Open Font License)'),
        h('p', 'All character names, figures and voices live in client/assets/ and can be replaced wholesale with your own.'),
        h('p.small', 'Thanks for playing!')));
  }
  enter() { this.app.showMenuStage('title'); }
}

export function installVersus(App) {
  App.prototype.openVersusRules = function (manager, params) { manager.push(new VersusRules(params)); return true; };
  App.prototype.openCredits = function (manager) { manager.push(new CreditsScreen()); };
}
