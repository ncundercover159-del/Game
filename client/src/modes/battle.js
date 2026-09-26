// Battle mode: setup screen (Balloon Battle / Coin Runners, arena, CPUs,
// time limit) and launcher. Rules live in shared/sim/battle.js.
import { h, button, uiSound } from '../ui/ui.js';
import { topbar } from '../ui/screens.js';
import { listOf } from '@shared/data/registry.js';
import { BATTLE } from '@shared/config.js';
import { buildField } from '../core/grandprix.js';
import { bumpStat } from '../core/profile.js';

function drawArenaThumb(canvas, def) {
  canvas.width = 160; canvas.height = 110;
  const ctx = canvas.getContext('2d');
  const b = def.bounds;
  const R = b.shape === 'circle' ? b.r : Math.max(b.w, b.d) / 2;
  const s = 48 / R;
  ctx.translate(80, 55);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.strokeStyle = '#1a1426'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (b.shape === 'circle') ctx.arc(0, 0, b.r * s, 0, Math.PI * 2); else ctx.rect(-b.w / 2 * s, -b.d / 2 * s, b.w * s, b.d * s);
  ctx.fill(); ctx.stroke();
  for (const f of def.floors || []) {
    ctx.fillStyle = f.surface === 'lava' ? '#ff6a1a' : f.surface === 'ice' ? '#bfe9ff' : f.surface === 'offroad' ? '#5cb842' : f.shape === 'ramp' ? '#ffd23f' : 'rgba(26,20,38,.55)';
    ctx.beginPath();
    if (f.shape === 'circle') ctx.arc(f.x * s, -f.z * s, Math.max(1.5, f.r * s), 0, Math.PI * 2);
    else { ctx.save(); ctx.translate(f.x * s, -f.z * s); ctx.rotate(f.rot || 0); ctx.rect(-f.w / 2 * s, -f.d / 2 * s, f.w * s, f.d * s); ctx.restore(); }
    ctx.fill();
  }
}

class BattleSetup {
  constructor(params) {
    this.params = params;
    this.variant = 'balloons';
    this.arenas = listOf('arenas').filter((a) => !a.dev);
    this.arena = this.arenas[0]?.id;
    this.cpus = 5;
    this.time = BATTLE.timeLimit;
  }
  build() {
    const seg = (label, values, get, set, fmt = (v) => v) => h('div.opt', h('span', label), h('div.seg', values.map((v) => h(`button.segb${get() === v ? '.on' : ''}`, {
      onclick: () => { uiSound.click(); set(v); this.rerender(); },
    }, fmt(v)))));
    const grid = h('div.track-grid', this.arenas.map((a) => {
      const c = h('canvas');
      drawArenaThumb(c, a);
      return h(`button.tcard${this.arena === a.id ? '.sel' : ''}`, { style: { '--c': '#8a6ad8' }, onclick: () => { uiSound.click(); this.arena = a.id; this.rerender(); } }, c, a.name);
    }));
    return h('div.dim-bg.battle-setup', topbar(this, 'Battle'),
      h('div.online-grid',
        h('div.panel.settings', h('h2', 'Rules'),
          seg('Mode', ['balloons', 'coins'], () => this.variant, (v) => { this.variant = v; this.time = v === 'coins' ? BATTLE.coinRunnersTime : BATTLE.timeLimit; }, (v) => (v === 'coins' ? 'Coin Runners' : 'Balloon Battle')),
          seg('CPUs', [3, 5, 7], () => this.cpus, (v) => { this.cpus = v; }),
          seg('Time', [90, 120, 180, 240], () => this.time, (v) => { this.time = v; }, (v) => `${v / 60 | 0}:${String(v % 60).padStart(2, '0')}`),
          h('div.small', this.variant === 'coins' ? 'Grab the most coins. Getting hit scatters yours!' : 'Pop rival balloons with items. Lose all 3 and you are out!'),
          button('Fight!', () => this.app.startBattle({ arenaId: this.arena, variant: this.variant, cpus: this.cpus, time: this.time, classId: this.params.classId }), 'big green fight')),
        h('div.panel', h('h2', 'Arena'), grid)));
  }
  rerender() { const n = this.build(); this.el.replaceChildren(...n.childNodes); }
  enter() { this.app.showMenuStage('title'); }
}

export function installBattle(App) {
  const P = App.prototype;
  P.openBattleSetup = function (manager, params) { manager.push(new BattleSetup(params || {})); return true; };
  P.startBattle = function ({ arenaId, variant = 'balloons', cpus = 5, time, classId = '100cc' }) {
    const player = this.playerEntrant();
    const field = buildField(player, { count: cpus + 1, seed: Date.now() % 100000 });
    this.flow = { mode: 'battle', variant };
    this.startRace({ trackId: arenaId, classId, mode: 'battle', battle: variant, items: true, entrants: field, localId: 'p1', intro: true, laps: 1 });
    if (time && this.session?.race?.battle) this.session.race.battle.timeLeft = time;
    bumpStat('battles');
  };
}
