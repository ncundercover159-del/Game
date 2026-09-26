// Dev track editor (open with ?edit=<trackId>, or the "Editor" button in dev mode).
// Top-down fly camera over the real track; click the road to place item-box
// rows, boost pads, coin lines, ramps and hazards; delete/undo; drive-test;
// export the edited track JSON (download + clipboard).
import * as THREE from 'three';
import { h, button } from '../ui/ui.js';
import { getTrackDef } from '@shared/data/registry.js';
import { formatJson } from '@shared/data/jsonFormat.js';
import { LocalSession } from '../core/session.js';
import { getProfile } from '../core/profile.js';

const TOOLS = [
  ['itemRows', 'Item row'], ['pads', 'Boost pad'], ['coins', 'Coin line'], ['ramps', 'Ramp'],
  ['geyser', 'Geyser'], ['boulder', 'Boulder'], ['crusher', 'Crusher'], ['laser', 'Laser'], ['piston', 'Piston'],
  ['ghost', 'Sweeper'], ['door', 'Door'], ['carousel', 'Carousel'], ['windGust', 'Wind zone'], ['conveyor', 'Conveyor'],
  ['fog', 'Fog zone'], ['collapse', 'Collapse'], ['delete', 'Delete'],
];
const ZONES = new Set(['coins', 'windGust', 'conveyor', 'fog', 'collapse']);
const r3 = (v) => Math.round(v * 1000) / 1000;

export class TrackEditor {
  constructor(app, trackId) {
    this.app = app;
    this.trackId = trackId;
    const src = getTrackDef(trackId);
    if (!src) throw new Error(`No track ${trackId}`);
    this.def = structuredClone(src);
    this.history = [];
    this.tool = 'itemRows';
    this.pending = null;   // first click of a zone tool
    this.cam = { x: 0, z: 0, height: 220, yaw: 0 };
    this.drive = false;
    this.buildUi();
    this.rebuild(true);
  }

  // --- session ------------------------------------------------------------------------------
  rebuild(recenter = false) {
    const app = this.app;
    app.endRaceView();
    const sel = getProfile().selection;
    const session = new LocalSession({
      trackDef: this.def, trackId: this.trackId, mode: 'freeplay', laps: 99, classId: '150cc', introTime: 0, skipCountdown: true,
      entrants: [{ ...sel, id: 'p1', human: true, name: 'Editor' }], localId: 'p1', items: true,
    });
    session.inputFn = () => (this.drive ? app.lastInput : { steer: 0, btn: 0 });
    app.flow = { mode: 'editor' };
    app.attachSession(session, { mode: 'race' }, 0);
    app.hud.setVisible(this.drive);
    app.touch.setVisible(this.drive);
    app.stage.editor = this;
    if (recenter) {
      const R = session.world.main;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < R.n; i++) { x0 = Math.min(x0, R.x[i]); x1 = Math.max(x1, R.x[i]); z0 = Math.min(z0, R.z[i]); z1 = Math.max(z1, R.z[i]); }
      this.cam = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, height: Math.max(x1 - x0, z1 - z0) * 0.75, yaw: 0 };
    }
    this.refreshList();
  }

  // called by RaceStage.update instead of the chase camera while editing
  updateCamera(camera, dt) {
    if (this.drive) return false;
    const k = this.keys;
    const sp = this.cam.height * 0.9 * dt;
    if (k.has('KeyW') || k.has('ArrowUp')) this.cam.z += sp;
    if (k.has('KeyS') || k.has('ArrowDown')) this.cam.z -= sp;
    if (k.has('KeyA') || k.has('ArrowLeft')) this.cam.x += sp;
    if (k.has('KeyD') || k.has('ArrowRight')) this.cam.x -= sp;
    camera.position.set(this.cam.x, this.cam.height, this.cam.z - this.cam.height * 0.35);
    camera.lookAt(this.cam.x, 0, this.cam.z);
    camera.fov = 55;
    camera.far = Math.max(1400, this.cam.height * 4);
    camera.updateProjectionMatrix();
    return true;
  }

  // --- UI ---------------------------------------------------------------------------------------
  buildUi() {
    this.keys = new Set();
    this.onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.type === 'keydown') this.keys.add(e.code); else this.keys.delete(e.code); if (e.type === 'keydown' && e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.undo(); };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.status = h('div.ed-status', 'Click the road to place. WASD/drag = pan, wheel = zoom.');
    this.list = h('div.ed-list');
    this.el = h('div.editor-panel',
      h('div.ed-title', `Editor · ${this.def.name}`),
      h('div.ed-tools', TOOLS.map(([id, label]) => h(`button.ed-tool${id === this.tool ? '.on' : ''}`, { onclick: (e) => { this.tool = id; this.pending = null; this.el.querySelectorAll('.ed-tool').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); this.say(`${label}${ZONES.has(id) ? ': click start, then end' : ''}`); } }, label))),
      h('div.ed-row', button('Undo', () => this.undo(), 'alt'), button(this.drive ? 'Stop driving' : 'Drive test', () => this.toggleDrive(), 'alt'), button('Export', () => this.export(), 'green')),
      this.status, this.list,
      h('div.ed-row', button('Quit', () => this.close(), 'pink')));
    this.app.uiEl.appendChild(this.el);
    // picking + camera drag on the canvas
    const cv = this.app.renderer.gl.domElement;
    let drag = null;
    this.onDown = (e) => { if (this.drive) return; drag = { x: e.clientX, y: e.clientY, cx: this.cam.x, cz: this.cam.z, moved: false }; };
    this.onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      const s = this.cam.height / cv.clientHeight * 1.2;
      this.cam.x = drag.cx + dx * s; this.cam.z = drag.cz + dy * s;
    };
    this.onUp = (e) => { if (drag && !drag.moved) this.pick(e); drag = null; };
    this.onWheel = (e) => { e.preventDefault(); this.cam.height = Math.max(25, Math.min(1500, this.cam.height * (e.deltaY > 0 ? 1.12 : 0.89))); };
    cv.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    cv.addEventListener('wheel', this.onWheel, { passive: false });
  }

  say(t) { this.status.textContent = t; }

  pick(e) {
    const st = this.app.stage;
    const cv = this.app.renderer.gl.domElement;
    const r = cv.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, st.camera);
    const hits = ray.intersectObjects(st.worldView.group.children, true).filter((hh) => hh.object.isMesh && !hh.object.isInstancedMesh);
    if (!hits.length) return this.say('Missed — click on the road.');
    const p = hits[0].point;
    const w = this.app.session.world;
    const pj = w.nearestMain(p.x, p.y, p.z);
    const t = r3(pj.s / w.length), lane = r3(Math.max(-1, Math.min(1, pj.L / pj.hw)));
    if (this.tool === 'delete') return this.deleteNear(p);
    if (ZONES.has(this.tool)) {
      if (!this.pending) { this.pending = { t, lane }; return this.say(`Start at t=${t}. Now click the end.`); }
      const a = this.pending; this.pending = null;
      return this.place(this.tool, a, { t, lane });
    }
    this.place(this.tool, { t, lane });
  }

  place(tool, a, b) {
    const d = this.def;
    this.history.push(structuredClone(d));
    const push = (key, obj) => { (d[key] ||= []).push(obj); };
    switch (tool) {
      case 'itemRows': push('itemRows', { t: a.t, lanes: [-0.6, -0.2, 0.2, 0.6] }); break;
      case 'pads': push('pads', { t: a.t, lane: a.lane }); break;
      case 'ramps': push('ramps', { t: a.t, len: 12, h: 2.2, kick: 1.5 }); break;
      case 'coins': push('coins', { t0: a.t, t1: b.t, lane: a.lane, lane1: b.lane, n: 5 }); break;
      case 'boulder': push('hazards', { type: 'boulder', t0: a.t, t1: a.t, lane0: -1.7, lane1: 1.7, duration: 3.2, period: 7, r: 2.3 }); break;
      case 'crusher': push('hazards', { type: 'crusher', t: a.t, lane: a.lane, w: 9, d: 4, period: 3.4, down: 0.9 }); break;
      case 'piston': push('hazards', { type: 'piston', t: a.t, side: a.lane < 0 ? 'left' : 'right', period: 3, out: 1.3, reach: 0.55, d: 3 }); break;
      case 'ghost': push('hazards', { type: 'ghost', t: a.t, lane0: -0.8, lane1: 0.8, speed: 0.8 }); break;
      case 'door': push('hazards', { type: 'door', t: a.t, lane: 0, period: 5, open: 3 }); break;
      case 'windGust': push('hazards', { type: 'windGust', t0: a.t, t1: b.t, dir: 1, period: 5, on: 2, force: 9 }); break;
      case 'conveyor': push('hazards', { type: 'conveyor', t0: a.t, t1: b.t, speed: 8, dir: 1 }); break;
      case 'fog': push('hazards', { type: 'fog', t0: a.t, t1: b.t, density: 0.8 }); break;
      case 'collapse': push('hazards', { type: 'collapse', t0: a.t, t1: b.t, safeLane: 0.3 }); break;
      default: push('hazards', { type: tool, t: a.t, lane: a.lane, period: 5 }); break;
    }
    this.say(`Placed ${tool} at t=${a.t}${b ? `…${b.t}` : ''}`);
    this.rebuild();
  }

  deleteNear(p) {
    const w = this.app.session.world;
    let best = null, bd = 12;
    for (const key of ['itemRows', 'pads', 'coins', 'ramps', 'hazards']) {
      (this.def[key] || []).forEach((o, i) => {
        if (o.ribbon) return;
        const t = o.t ?? o.t0;
        if (t === undefined || typeof t !== 'number') return;
        const q = w.at(t, o.lane ?? 0);
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < bd) { bd = d; best = [key, i]; }
      });
    }
    if (!best) return this.say('Nothing placed near there.');
    this.history.push(structuredClone(this.def));
    const [key, i] = best;
    const [gone] = this.def[key].splice(i, 1);
    this.say(`Deleted ${gone.type || key}`);
    this.rebuild();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return this.say('Nothing to undo');
    this.def = prev;
    this.rebuild();
    this.say('Undone');
  }

  toggleDrive() {
    this.drive = !this.drive;
    this.el.querySelector('.ed-row .btn:nth-child(2)').textContent = this.drive ? 'Stop driving' : 'Drive test';
    this.app.hud.setVisible(this.drive);
    this.app.touch.setVisible(this.drive);
    if (this.drive) { const k = this.app.session.localKart(); this.app.stage.chase.snap(k); }
  }

  refreshList() {
    const d = this.def;
    const n = (k) => (d[k] || []).length;
    this.list.textContent = `${n('itemRows')} item rows · ${n('pads')} pads · ${n('coins')} coin lines · ${n('ramps')} ramps · ${n('hazards')} hazards`;
  }

  exportJson() {
    const d = structuredClone(this.def);
    delete d._resolved; delete d._pathInfo;
    if (d.path) delete d.points; // points are regenerated from the path
    for (const b of d.branches || []) if (b.from !== undefined) delete b.points;
    return formatJson(d) + '\n';
  }

  async export() {
    const json = this.exportJson();
    try { await navigator.clipboard?.writeText(json); } catch { /* clipboard blocked */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `${this.trackId}.json`;
    a.click();
    this.say(`Exported ${this.trackId}.json (also copied). Drop it into client/src/data/tracks/.`);
  }

  close() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    const cv = this.app.renderer.gl.domElement;
    cv.removeEventListener('pointerdown', this.onDown);
    cv.removeEventListener('wheel', this.onWheel);
    this.el.remove();
    this.app.editor = null;
    this.app.goMenu();
  }
}
