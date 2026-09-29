import { C } from '../content';
import { play } from '../audio/audio';
import { S } from '../game/state';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(k));
  return el;
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function toast(msg: string) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2500);
}

/** Speak a UI string (menu item, button, prompt). */
export function speakUi(key: string) {
  const u = C.ui[key];
  if (u) void play(u.audio, { text: u.da, voice: 'narrator' });
}

/**
 * A button labelled in Danish with an English sub-label. Long-press (touch) or hovering
 * (mouse) reads the Danish label aloud, so every menu item has audio.
 */
export function uiBtn(key: string, onClick: () => void, cls = '', extra?: Child): HTMLButtonElement {
  const u = C.ui[key] ?? { da: key, en: '' };
  const b = h('button', { class: `btn ${cls}`, type: 'button', 'aria-label': `${u.da} (${u.en})` },
    h('span', {}, u.da), extra ?? null, h('span', { class: 'sub' }, u.en));
  attachSpeak(b, key);
  b.addEventListener('click', () => onClick());
  return b;
}

export function attachSpeak(el: HTMLElement, key: string) {
  let timer: number | undefined;
  const start = () => {
    if (!S.settings.speakUi) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => speakUi(key), 550);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') start(); });
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') start(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const ui = (key: string) => C.ui[key] ?? { da: key, en: key, audio: '' };

// ─── layers ─────────────────────────────────────────────────────────────────
function layer(id: string) {
  const el = document.getElementById(id)!;
  return {
    el,
    show(...content: Node[]) {
      clear(el).append(...content);
      el.classList.add('open');
    },
    hide() {
      el.classList.remove('open');
      clear(el);
    },
    get open() {
      return el.classList.contains('open');
    },
  };
}
export const panel = layer('panel');
export const overlay = layer('overlay');
export const popup = layer('popup');
popup.el.addEventListener('click', (e) => {
  if (e.target === popup.el) popup.hide();
});

/** Resolve on click of the returned button or on Enter/Space (when no popup is open). */
export function waitNext(btn: HTMLButtonElement): Promise<void> {
  return new Promise((resolve) => {
    const onKey = (e: KeyboardEvent) => {
      if (popup.open) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.key === 'Enter' || e.key === ' ') && !(t && t.tagName === 'BUTTON' && t !== btn)) {
        e.preventDefault();
        done();
      }
    };
    const done = () => {
      window.removeEventListener('keydown', onKey, true);
      resolve();
    };
    btn.addEventListener('click', done, { once: true });
    window.addEventListener('keydown', onKey, true);
  });
}
