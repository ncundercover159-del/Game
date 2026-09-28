// Action-mapped input: keyboard, mouse, gamepad and touch feed one set of actions.
// Events are buffered and latched at the start of each sim step, so a tap between two steps is
// seen as `pressed` for exactly one step. The main keys can be rebound (their first code); a text
// listener, when set, takes printable keys for name entry instead.

export const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  use: ['KeyJ'],
  interact: ['KeyK', 'KeyE'],
  dodge: ['Space'],
  parry: ['KeyL'],
  run: ['ShiftLeft', 'ShiftRight'],
  menu: ['Escape', 'Tab'],
  map: ['KeyM'],
  confirm: ['Enter', 'KeyK', 'KeyE', 'KeyJ', 'Space'],
  cancel: ['Escape', 'Backspace'],
  prev: ['BracketLeft'],
  next: ['BracketRight'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'],
  slot5: ['Digit5'], slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'],
  slot9: ['Digit9'], slot10: ['Digit0'], slot11: ['Minus'], slot12: ['Equal'],
  debug1: ['F1'], debug2: ['F2'], debug3: ['F3'], debug4: ['F4'], debug5: ['F5'], debug6: ['F6'],
};

// The actions whose first key can be rebound, in the order the Controls list shows them.
export const REBINDABLE = ['up', 'down', 'left', 'right', 'use', 'interact', 'dodge', 'parry', 'run', 'menu'];

// Standard-mapping gamepad buttons -> actions.
const PAD = { 0: ['interact', 'confirm'], 1: ['dodge', 'cancel'], 2: ['use'], 3: ['parry'],
  4: ['prev'], 5: ['next'], 7: ['run'], 8: ['map'], 9: ['menu'], 12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'] };

// Mouse buttons: left uses the tool / clicks UI, right interacts.
const MOUSE = { 0: ['use', 'click'], 2: ['interact', 'rclick'] };

export class Input {
  constructor(target, screen) {
    this.screen = screen;
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.codeMap = new Map();
    this.rebuild();
    this.held = new Set();        // raw sources currently down ("key:KeyW", "mouse:0", "pad:2")
    this.queued = new Set();      // actions pressed since the last latch
    this.releasedQ = new Set();
    this.down = new Set();        // actions down this step
    this.pressedSet = new Set();  // actions pressed this step
    this.releasedSet = new Set();
    this.mouse = { x: -1, y: -1, active: false, moved: 0, wheel: 0 };
    this.wheelQ = 0;
    this.textListener = null;     // when set, receives printable keys (name entry etc.)
    this.padAxes = { x: 0, y: 0 };
    this.touchActions = new Map();// touch source id -> actions (see ui/touch.js)
    this.lastKey = null;          // the last key code pressed (for rebinding)
    if (target) this.attach(target);
  }

  /** Rebind an action's first key; a key already first on another action swaps over to it. */
  rebind(action, code) {
    const b = this.bindings, old = b[action][0];
    for (const a of REBINDABLE) if (a !== action && b[a][0] === code) b[a][0] = old;
    b[action][0] = code;
    // Confirm follows the keys you use and interact with.
    b.confirm = [...new Set(['Enter', 'Space', b.use[0], ...b.interact])];
    this.rebuild();
  }

  /** The rebound first keys, for saving: { action: code } where it differs from the default. */
  customKeys() {
    return Object.fromEntries(REBINDABLE.filter((a) => this.bindings[a][0] !== DEFAULT_BINDINGS[a][0]).map((a) => [a, this.bindings[a][0]]));
  }

  resetKeys() {
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.rebuild();
  }

  rebuild() {
    this.codeMap.clear();
    for (const [action, codes] of Object.entries(this.bindings)) {
      for (const code of codes) {
        if (!this.codeMap.has(code)) this.codeMap.set(code, []);
        this.codeMap.get(code).push(action);
      }
    }
  }

  attach(target) {
    target.addEventListener('keydown', (e) => {
      if (this.textListener && (e.key.length === 1 || e.key === 'Backspace')) {
        e.preventDefault();
        this.textListener(e.key);
        return;
      }
      if (this.codeMap.has(e.code) || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.lastKey = e.code;
      this.sourceDown('key:' + e.code, this.codeMap.get(e.code));
    });
    target.addEventListener('keyup', (e) => this.sourceUp('key:' + e.code, this.codeMap.get(e.code)));
    const canvas = this.screen?.display;
    if (canvas) {
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('pointermove', (e) => this.pointer(e));
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.pointer(e);
        if (e.button === 0) this.sourceDown('mouse:0', MOUSE[0]);
        if (e.button === 2) this.sourceDown('mouse:2', MOUSE[2]);
      });
      addEventListener('pointerup', (e) => {
        if (e.button === 0) this.sourceUp('mouse:0', MOUSE[0]);
        if (e.button === 2) this.sourceUp('mouse:2', MOUSE[2]);
      });
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheelQ += Math.sign(e.deltaY); }, { passive: false });
    }
    addEventListener('blur', () => this.releaseAll());
  }

  pointer(e) {
    if (e.pointerType !== 'mouse' || !this.screen) return;
    const p = this.screen.toLogical(e.clientX, e.clientY);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    this.mouse.active = true;
    this.mouse.moved = performance.now();
  }

  actionsOf(src) {
    const [kind, code] = src.split(':');
    return kind === 'key' ? this.codeMap.get(code) : kind === 'mouse' ? MOUSE[code] : kind === 'touch' ? this.touchActions.get(code) : PAD[code];
  }

  /** A touch control goes down or up (ui/touch.js): `id` names it, `actions` are what it means. */
  touchDown(id, actions) {
    this.touchActions.set(id, actions);
    this.sourceDown('touch:' + id, actions);
  }

  touchUp(id) {
    this.sourceUp('touch:' + id, this.touchActions.get(id));
  }

  /** A tap on the screen outside the controls: a click at (x, y) for menus and lists. */
  tap(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.queued.add('click');
  }

  sourceDown(src, actions) {
    if (this.held.has(src)) return;
    this.held.add(src);
    if (actions) for (const a of actions) this.queued.add(a);
  }

  sourceUp(src, actions) {
    if (!this.held.delete(src)) return;
    if (actions) for (const a of actions) this.releasedQ.add(a);
  }

  releaseAll() {
    for (const src of [...this.held]) {
      this.sourceUp(src, this.actionsOf(src));
    }
  }

  pollGamepad() {
    const pads = navigator.getGamepads?.() || [];
    const pad = [...pads].find((p) => p && p.connected);
    this.padAxes.x = 0;
    this.padAxes.y = 0;
    if (!pad) return;
    for (const [b, actions] of Object.entries(PAD)) {
      const pressed = pad.buttons[b]?.pressed;
      if (pressed) this.sourceDown('pad:' + b, actions);
      else this.sourceUp('pad:' + b, actions);
    }
    const dead = 0.3;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    this.padAxes.x = Math.abs(ax) > dead ? ax : 0;
    this.padAxes.y = Math.abs(ay) > dead ? ay : 0;
  }

  /** Called at the start of every sim step. */
  latch() {
    this.pollGamepad();
    this.pressedSet = this.queued;
    this.queued = new Set();
    this.releasedSet = this.releasedQ;
    this.releasedQ = new Set();
    this.down.clear();
    for (const src of this.held) {
      const actions = this.actionsOf(src);
      if (actions) for (const a of actions) this.down.add(a);
    }
    for (const a of this.pressedSet) this.down.add(a);
    this.mouse.wheel = this.wheelQ;
    this.wheelQ = 0;
  }

  isDown(a) { return this.down.has(a); }
  pressed(a) { return this.pressedSet.has(a); }
  released(a) { return this.releasedSet.has(a); }

  /** Consume a press so later handlers in the same step don't also react to it. */
  consume(a) { this.pressedSet.delete(a); }

  /** Movement vector from keys, d-pad and left stick. */
  axis() {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (!x && !y) { x = this.padAxes.x; y = this.padAxes.y; }
    return { x, y };
  }

  /** True when the mouse was the last thing to aim (moved within the last 3 s). */
  mouseAiming() {
    return this.mouse.active && performance.now() - this.mouse.moved < 3000;
  }

  // Test hooks: synthesise key presses by code.
  keyDown(code) { this.lastKey = code; this.sourceDown('key:' + code, this.codeMap.get(code)); }
  keyUp(code) { this.sourceUp('key:' + code, this.codeMap.get(code)); }
}
