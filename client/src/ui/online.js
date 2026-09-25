// Online screens: connect/create/join/quick-match menu and the room lobby
// (players + picks + ping, host settings, ready, track vote, results).
import { h, button, uiSound } from './ui.js';
import { ICONS, ELEMENT_COLORS } from './icons.js';
import { getRacer, getTrackDef, listOf, getVehicle } from '@shared/data/registry.js';
import { CLASSES } from '@shared/config.js';
import { NetClient, defaultServerUrl } from '../net/client.js';
import { getProfile, updateProfile } from '../core/profile.js';
import { RacerSelect, drawTrackThumb, racerCard } from './screens.js';
import { fmtTime, ordinal } from './hud.js';

const pingBars = (ms) => {
  const n = ms < 0 ? 0 : ms < 80 ? 4 : ms < 150 ? 3 : ms < 250 ? 2 : 1;
  const col = ms < 0 ? '#888' : n >= 3 ? '#6dff8a' : n === 2 ? '#ffd23f' : '#ff5a5a';
  return h('span.pingbars', { title: ms < 0 ? 'offline' : `${ms} ms` }, [1, 2, 3, 4].map((i) => h('i', { style: { height: `${i * 3 + 2}px`, background: i <= n ? col : 'rgba(255,255,255,.2)' } })));
};

export class OnlineMenu {
  build() {
    const prof = getProfile();
    this.nameIn = h('input.text-in', { value: prof.name || '', maxlength: 16, placeholder: 'Your name' });
    this.codeIn = h('input.text-in.code-in', { maxlength: 4, placeholder: 'CODE', autocapitalize: 'characters' });
    this.status = h('div.status');
    this.pub = h('input', { type: 'checkbox' });
    const wrap = (fn) => async () => {
      const name = this.nameIn.value.trim() || 'Racer';
      updateProfile((p) => { p.name = name; });
      try {
        this.status.textContent = 'Connecting…';
        const client = await this.app.connectOnline();
        this.status.textContent = '';
        fn(client, name);
      } catch (e) {
        this.status.textContent = `Couldn't reach the game server at ${defaultServerUrl()}. Start it with "npm run server".`;
      }
    };
    return h('div.dim-bg.online-menu', h('div.topbar', h('button.back-btn', { onclick: () => { uiSound.back(); this.manager.back(); }, html: ICONS.back }), h('h1', 'Online')),
      h('div.online-grid',
        h('div.panel', h('h2', 'Your name'), this.nameIn,
          h('div.row', button('Quick match', wrap((c, name) => c.send({ type: 'quick', name })), 'big green'))),
        h('div.panel', h('h2', 'Private room'),
          h('div.row', button('Create room', wrap((c, name) => c.send({ type: 'create', name, public: this.pub.checked })), 'big'), h('label.small', this.pub, ' public')),
          h('div.row', this.codeIn, button('Join', wrap((c, name) => c.send({ type: 'join', name, code: this.codeIn.value.toUpperCase() })), 'alt'))),
      ),
      this.status,
      h('div.small', { style: { opacity: 0.7 } }, `Server: ${defaultServerUrl()} · Same Wi-Fi? Share the room code with friends.`));
  }
  enter() { this.app.showMenuStage('title'); }
}

export class LobbyScreen {
  constructor(client) { this.client = client; this.room = null; }
  build() {
    this.el = h('div.dim-bg.lobby');
    this.unsub = [
      this.client.on('room', (m) => { this.room = m; this.render(); }),
      this.client.on('error', (m) => this.app.toast(m.message)),
      this.client.on('reconnecting', () => this.app.toast('Connection lost — reconnecting…')),
      this.client.on('lost', () => { this.app.toast('Disconnected from the server.'); this.app.goMenu(); }),
    ];
    this.render();
    return this.el;
  }

  me() { return this.room?.players.find((p) => p.id === this.app.onlineId); }

  sendPick() {
    const s = getProfile().selection;
    this.client.send({ type: 'pick', racerId: s.racerId, vehicleId: s.vehicleId, wheelsId: s.wheelsId, gliderId: s.gliderId });
  }

  render() {
    const r = this.room;
    const el = this.el;
    el.innerHTML = '';
    const leave = h('button.back-btn', { onclick: () => { uiSound.back(); this.client.leave(); this.app.goMenu(); }, html: ICONS.back });
    if (!r) { el.append(h('div.topbar', leave, h('h1', 'Joining…'))); return; }
    const me = this.me();
    const host = me?.host;
    const s = r.settings;
    el.append(h('div.topbar', leave, h('h1', 'Room '), h('button.room-code', { onclick: () => { navigator.clipboard?.writeText(r.code); this.app.toast('Room code copied!'); } }, r.code),
      h('div.phase-tag', { vote: `Vote! ${r.voteTimer}s`, race: 'Racing…', results: `Next in ${r.resultsTimer}s`, lobby: r.isPublic ? 'Public lobby' : 'Private lobby' }[r.phase])));
    // players
    const list = h('div.player-list', r.players.map((p) => {
      const racer = getRacer(p.racerId);
      return h(`div.prow${p.id === this.app.onlineId ? '.me' : ''}${p.connected ? '' : '.off'}`,
        h('img.pic', { src: racer?.portrait || '' }),
        h('div.pname', h('b', p.name), p.host ? ' 👑' : '', h('small', `${racer?.name || ''} · ${getVehicle(p.vehicleId)?.name || ''}`)),
        pingBars(p.connected ? p.ping : -1),
        h('span.ready', p.ready ? '✔' : p.connected ? '…' : '⏳'));
    }), h('div.small.bots', s.bots ? `+ ${Math.max(0, 12 - r.players.length)} bots fill the grid` : 'No bots'));
    // right column: phase specific
    let right;
    if (r.phase === 'vote') {
      right = h('div.panel.vote', h('h2', `Vote for a track · ${r.voteTimer}s`), h('div.track-grid', r.tracks.map((id) => {
        const def = getTrackDef(id);
        const votes = Object.values(r.votes).filter((v) => v === id).length;
        const c = h('canvas');
        const b = h(`button.tcard${r.votes[this.app.onlineId] === id ? '.sel' : ''}`, { style: { '--c': '#3d6fd8' }, onclick: () => { uiSound.click(); this.client.send({ type: 'vote', trackId: id }); } }, c, def?.name || id, votes ? h('b.votes', ` · ${votes}🗳`) : null);
        if (def?.points) drawTrackThumb(c, id);
        return b;
      })));
    } else if (r.phase === 'results' && this.app.lastOnlineResults) {
      right = h('div.panel', h('h2', 'Results'), h('table.rtable', this.app.lastOnlineResults.map((x) => h(`tr${x.id === this.app.onlineId ? '.me' : ''}`,
        h('td', `${x.place}`), h('td', x.name), h('td', x.time ? fmtTime(x.time) : ''), h('td', x.human ? '' : 'bot')))),
        button('Rematch!', () => this.client.send({ type: 'rematch' }), 'big green'));
    } else {
      const opt = (label, key, values, fmt = (v) => v) => h('div.opt', h('span', label), h('div.seg', values.map((v) => h(`button.segb${s[key] === v ? '.on' : ''}`, {
        disabled: !host, onclick: () => { uiSound.click(); this.client.send({ type: 'settings', [key]: v }); },
      }, fmt(v)))));
      right = h('div.panel.settings',
        h('h2', host ? 'Room settings' : 'Settings (host decides)'),
        opt('Mode', 'mode', ['race', 'battle'], (v) => (v === 'race' ? 'Race' : 'Battle')),
        s.mode === 'race' ? opt('Class', 'classId', ['50cc', '100cc', '150cc', 'mirror', '200cc'], (v) => CLASSES[v].label) : opt('Battle', 'battle', ['balloons', 'coins'], (v) => (v === 'coins' ? 'Coin Runners' : 'Balloons')),
        s.mode === 'race' ? opt('Laps', 'laps', [1, 3, 5]) : null,
        opt('Items', 'items', [true, false], (v) => (v ? 'On' : 'Off')),
        opt('Bots', 'bots', [true, false], (v) => (v ? 'Fill' : 'None')),
        h('div.row',
          button('Change racer', () => this.manager.push(new RacerSelect({ next: 'online', onDone: () => { this.sendPick(); this.manager.pop(); this.manager.pop(); } })), 'alt'),
          button(me?.ready ? 'Not ready' : 'Ready!', () => this.client.send({ type: 'ready', ready: !me?.ready }), me?.ready ? 'pink' : 'green big'),
          host ? button('Start', () => this.client.send({ type: 'start' }), 'big') : null));
    }
    el.append(h('div.lobby-grid', list, right));
  }

  enter() {
    this.app.showMenuStage('title');
    this.sendPick();
  }
  resume() { this.app.showMenuStage('title'); this.sendPick(); this.render(); }
  exit() { for (const u of this.unsub || []) u(); }
  onBack() { this.client.leave(); this.app.goMenu(); }
}

export { racerCard, ELEMENT_COLORS, listOf, ordinal };
