// Mobile virtual joystick (left thumb, floats to where you touch) + a round
// hold-to-squish action button (right thumb). WASD / arrows + Space on desktop.

export function createControls({ hud, stick, knob, zone, button, keysHelp, onFirstInput }) {
  const state = { x: 0, y: 0, act: false };
  const keys = new Set();
  const RADIUS = 52;
  let touchId = null;
  let origin = { x: 0, y: 0 };
  let stickVec = { x: 0, y: 0 };
  let buttonDown = false;
  let first = true;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function firstInput() { if (first) { first = false; onFirstInput && onFirstInput(); } }
  function setDesktop(on) {
    hud.classList.toggle('desktop', on);
    keysHelp.classList.toggle('hidden', !on);
  }
  setDesktop(fine);

  function placeKnob(dx, dy) { knob.style.transform = `translate(${dx}px, ${dy}px)`; }

  zone.addEventListener('pointerdown', (e) => {
    if (touchId !== null) return;
    firstInput();
    if (e.pointerType === 'touch') setDesktop(false);
    touchId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    const parent = hud.getBoundingClientRect();
    stick.classList.add('floating');
    stick.style.left = `${e.clientX - r.width / 2 - parent.left}px`;
    stick.style.top = `${e.clientY - r.height / 2 - parent.top}px`;
    stick.style.bottom = 'auto';
    origin = { x: e.clientX, y: e.clientY };
    stickVec = { x: 0, y: 0 };
    placeKnob(0, 0);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touchId) return;
    let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    placeKnob(dx, dy);
    const m = Math.min(1, d / RADIUS);
    // small dead zone, then ease in so fine steering is possible
    const mag = m < 0.12 ? 0 : Math.min(1, (m - 0.12) / 0.8);
    const a = Math.atan2(dy, dx);
    stickVec = { x: Math.cos(a) * mag, y: -Math.sin(a) * mag };
  });
  const release = (e) => {
    if (e.pointerId !== touchId) return;
    touchId = null;
    stickVec = { x: 0, y: 0 };
    placeKnob(0, 0);
    stick.classList.remove('floating');
    stick.style.left = stick.style.top = stick.style.bottom = '';
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);

  const press = (e) => {
    firstInput();
    if (e.pointerType === 'touch') setDesktop(false);
    buttonDown = true;
    button.classList.add('down');
    button.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const unpress = () => { buttonDown = false; button.classList.remove('down'); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', unpress);
  button.addEventListener('pointercancel', unpress);
  button.addEventListener('lostpointercapture', unpress);
  button.addEventListener('contextmenu', (e) => e.preventDefault());

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'act',
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = KEYMAP[e.code];
    if (!k) return;
    firstInput();
    keys.add(k);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => { keys.clear(); unpress(); });

  return {
    state,
    sample() {
      let kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      let ky = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
      if (kx && ky) { kx *= Math.SQRT1_2; ky *= Math.SQRT1_2; }
      state.x = kx || stickVec.x;
      state.y = ky || stickVec.y;
      state.act = buttonDown || keys.has('act');
      return state;
    },
    reset() { keys.clear(); unpress(); stickVec = { x: 0, y: 0 }; placeKnob(0, 0); },
  };
}
