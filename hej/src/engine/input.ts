import type { Dir } from '../content/types';

// Keyboard: arrows / WASD to move, Space / Enter / E to interact.
// Touch & mouse: tap a tile to walk there, tap a person or sign to go and talk/read.

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

export class Input {
  private held: Dir[] = [];
  onInteract: () => void = () => {};
  onTap: (clientX: number, clientY: number) => void = () => {};
  enabled = true;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        if (!this.held.includes(d)) this.held.push(d);
      } else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') && this.enabled && !e.repeat) {
        const t = e.target as HTMLElement;
        if (t && t.tagName === 'BUTTON') return;
        e.preventDefault();
        this.onInteract();
      }
    });
    window.addEventListener('keyup', (e) => {
      const d = KEYS[e.key];
      if (d) this.held = this.held.filter((x) => x !== d);
    });
    window.addEventListener('blur', () => (this.held = []));
    canvas.addEventListener('pointerup', (e) => {
      if (!this.enabled) return;
      this.onTap(e.clientX, e.clientY);
    });
  }

  /** Most recently pressed direction still held. */
  dir(): Dir | null {
    return this.enabled ? (this.held[this.held.length - 1] ?? null) : null;
  }
  clear() {
    this.held = [];
  }
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
