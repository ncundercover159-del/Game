// Tiny DOM helpers + screen manager with springy transitions.

// h('div.cls#id', {attrs/on*}, ...children)
export function h(sel, attrs = {}, ...children) {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m?.[1] || 'div');
  for (const part of (m?.[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = {}; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Global UI sound hook (set by the audio manager)
export const uiSound = { click: () => {}, back: () => {}, hover: () => {}, confirm: () => {} };

export function button(label, onClick, cls = '') {
  const b = h(`button.btn${cls ? '.' + cls.split(' ').join('.') : ''}`, { type: 'button' });
  if (typeof label === 'string') b.innerHTML = label; else b.appendChild(label);
  b.addEventListener('click', (e) => { uiSound.click(); onClick?.(e); });
  return b;
}

export class ScreenManager {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.stack = [];
    this.current = null;
  }

  // Replace the whole stack with a screen
  go(screen, params) {
    this.clear();
    return this.push(screen, params);
  }

  push(screen, params) {
    if (this.current) this.current.el.classList.add('covered');
    this.stack.push(screen);
    this.current = screen;
    screen.app = this.app;
    screen.manager = this;
    if (!screen.el) screen.el = screen.build(params);
    screen.el.classList.add('screen', 'enter');
    this.root.appendChild(screen.el);
    requestAnimationFrame(() => screen.el.classList.remove('enter'));
    screen.enter?.(params);
    return screen;
  }

  pop() {
    const s = this.stack.pop();
    if (s) this.remove(s);
    this.current = this.stack[this.stack.length - 1] || null;
    if (this.current) { this.current.el.classList.remove('covered'); this.current.resume?.(); }
    return s;
  }

  remove(s) {
    s.exit?.();
    s.el.classList.add('leave');
    setTimeout(() => s.el.remove(), 260);
  }

  clear() {
    while (this.stack.length) this.remove(this.stack.pop());
    this.current = null;
  }

  update(dt) { this.current?.update?.(dt); }

  back() {
    if (this.current?.onBack) return this.current.onBack();
    if (this.stack.length > 1) { uiSound.back(); this.pop(); }
  }
}

export function statBars(stats, keys = ['speed', 'accel', 'weight', 'handling', 'drift', 'offroad', 'miniTurbo']) {
  const labels = { speed: 'Speed', accel: 'Accel', weight: 'Weight', handling: 'Handling', drift: 'Drift', offroad: 'Off-road', miniTurbo: 'Mini-turbo' };
  return h('div.stats', keys.map((k) => h('div.stat', h('span', labels[k]), h('div.bar', h('i', { style: { width: `${(stats[k] / 10) * 100}%` } })))));
}
