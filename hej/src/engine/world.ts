import type { Dir, Look, MapDef } from '../content/types';
import { findPath } from './path';
import { T, characterFrames, drawShadow, tileCanvas } from './sprites';
import { TILES } from './tiledefs';

export type Marker = 'talk' | 'review' | 'mail' | null;

export interface Entity {
  id: string;
  look: Look;
  x: number;
  y: number;
  dir: Dir;
  /** Movement tween. */
  fromX: number;
  fromY: number;
  t: number; // 0..1 progress, 1 = idle
  walk: number; // animation clock
  marker: Marker;
}

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SPEED = 5.5; // tiles per second

export interface WorldHooks {
  /** Player bumped into a solid tile (door, sign …). Return true if something happened. */
  bump(x: number, y: number): boolean;
  /** Player finished a step onto (x, y). */
  step(x: number, y: number): void;
  /** Player pressed interact while facing (x, y). */
  interact(x: number, y: number): void;
}

export class World {
  map!: MapDef;
  player: Entity;
  npcs: Entity[] = [];
  private path: [number, number][] = [];
  private afterPath: [number, number] | null = null;
  private camX = 0;
  private camY = 0;
  private time = 0;
  scale = 4;
  private offX = 0;
  private offY = 0;
  mailboxMarker = false;

  constructor(playerLook: Look, public hooks: WorldHooks) {
    this.player = mk('player', playerLook, 0, 0, 'down');
  }

  setMap(map: MapDef, x: number, y: number, dir: Dir, npcs: { id: string; look: Look; x: number; y: number; dir: Dir }[]) {
    this.map = map;
    Object.assign(this.player, { x, y, fromX: x, fromY: y, t: 1, dir });
    this.npcs = npcs.map((n) => mk(n.id, n.look, n.x, n.y, n.dir));
    this.path = [];
    this.afterPath = null;
    this.snapCamera = true;
  }
  private snapCamera = true;

  tileAt(x: number, y: number): string | undefined {
    const m = this.map;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return undefined;
    return m.tiles[y * m.w + x];
  }
  solid(x: number, y: number) {
    const t = this.tileAt(x, y);
    return !t || TILES[t]?.solid !== false;
  }
  npcAt(x: number, y: number) {
    return this.npcs.find((n) => n.x === x && n.y === y);
  }
  blocked(x: number, y: number) {
    return this.solid(x, y) || !!this.npcAt(x, y);
  }
  facing(): [number, number] {
    const [dx, dy] = DIRS[this.player.dir];
    return [this.player.x + dx, this.player.y + dy];
  }
  get busy() {
    return this.player.t < 1;
  }

  /** Walk to a tile; if `interact` is set, walk next to it, face it and interact. */
  walkTo(tx: number, ty: number, interact: boolean) {
    const p = this.player;
    if (interact) {
      // pick the reachable neighbour with the shortest path
      let best: [number, number][] | null = null;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = tx + dx, ny = ty + dy;
        if (nx === p.x && ny === p.y) { best = []; break; }
        if (this.blocked(nx, ny)) continue;
        const path = findPath(this.map.w, this.map.h, (x, y) => this.blocked(x, y), p.x, p.y, nx, ny);
        if (path && (!best || path.length < best.length)) best = path;
      }
      if (!best) return;
      this.path = best;
      this.afterPath = [tx, ty];
    } else {
      const path = findPath(this.map.w, this.map.h, (x, y) => this.blocked(x, y), p.x, p.y, tx, ty);
      if (!path) return;
      // a tap on a solid tile (door) — walk up to it and bump
      if (path.length && this.blocked(tx, ty)) {
        path.pop();
        this.afterPath = [tx, ty];
      } else this.afterPath = null;
      this.path = path;
    }
  }
  stop() {
    this.path = [];
    this.afterPath = null;
  }

  update(dt: number, inputDir: Dir | null) {
    this.time += dt;
    const p = this.player;
    const wasMoving = p.t < 1;
    for (const e of [p, ...this.npcs]) {
      if (e.t < 1) {
        e.t = Math.min(1, e.t + dt * SPEED);
        e.walk += dt * SPEED * 2;
      }
    }
    if (p.t < 1) return;
    if (wasMoving) {
      const map = this.map;
      this.hooks.step(p.x, p.y);
      if (this.map !== map) return;
    }
    if (inputDir) {
      this.path = [];
      this.afterPath = null;
      this.tryMove(inputDir, true);
      return;
    }
    if (this.path.length) {
      const [nx, ny] = this.path[0];
      const dir = dirTo(p.x, p.y, nx, ny);
      if (!dir || this.blocked(nx, ny)) {
        this.path = [];
        return;
      }
      this.path.shift();
      this.tryMove(dir, false);
      return;
    }
    if (this.afterPath) {
      const [tx, ty] = this.afterPath;
      this.afterPath = null;
      const dir = dirTo(p.x, p.y, tx, ty);
      if (dir) {
        p.dir = dir;
        if (!this.hooks.bump(tx, ty)) this.hooks.interact(tx, ty);
      }
    }
  }

  private tryMove(dir: Dir, bumpHook: boolean) {
    const p = this.player;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx, ny = p.y + dy;
    if (this.blocked(nx, ny)) {
      if (bumpHook && !this.npcAt(nx, ny)) this.hooks.bump(nx, ny);
      return;
    }
    p.fromX = p.x;
    p.fromY = p.y;
    p.x = nx;
    p.y = ny;
    p.t = 0;
  }

  faceNpcToPlayer(id: string) {
    const n = this.npcs.find((e) => e.id === id);
    if (!n) return;
    const d = dirTo(n.x, n.y, this.player.x, this.player.y, true);
    if (d) n.dir = d;
  }

  // ─── rendering ───────────────────────────────────────────────────────────
  resize(cssW: number, cssH: number, dpr: number) {
    const pxW = cssW * dpr, pxH = cssH * dpr;
    // aim for ~9 tiles across the short side
    this.scale = Math.max(1, Math.floor(Math.min(pxW, pxH) / (T * 9)));
  }

  /**
   * @param insetTop / insetBottom device pixels covered by UI (HUD, dialogue panel);
   *   the camera keeps the player inside the uncovered band.
   */
  draw(ctx: CanvasRenderingContext2D, pxW: number, pxH: number, insetTop = 0, insetBottom = 0) {
    const s = this.scale;
    const viewW = pxW / s, viewH = pxH / s;
    const bandTop = insetTop / s, bandH = Math.max(T * 3, viewH - (insetTop + insetBottom) / s);
    const m = this.map;
    const p = this.player;
    const ppx = lerp(p.fromX, p.x, p.t) * T, ppy = lerp(p.fromY, p.y, p.t) * T;
    const mapW = m.w * T, mapH = m.h * T;
    let tx = mapW <= viewW ? (mapW - viewW) / 2 : clamp(ppx + T / 2 - viewW / 2, 0, mapW - viewW);
    // centre the player in the visible band; small maps sit in the middle of the band
    let ty = mapH <= bandH
      ? (mapH - bandH) / 2 - bandTop
      : clamp(ppy + T / 2 - bandTop - bandH / 2, -bandTop, mapH - bandH - bandTop);
    if (mapH > viewH && insetBottom === 0) ty = clamp(ppy + T / 2 - viewH / 2, 0, mapH - viewH);
    if (this.snapCamera) {
      this.camX = tx;
      this.camY = ty;
      this.snapCamera = false;
    } else {
      this.camX += (tx - this.camX) * 0.25;
      this.camY += (ty - this.camY) * 0.25;
    }
    const cx = Math.round(this.camX * s) / s, cy = Math.round(this.camY * s) / s;
    this.offX = -cx;
    this.offY = -cy;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.setTransform(s, 0, 0, s, Math.round(-cx * s), Math.round(-cy * s));

    const x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T));
    const x1 = Math.min(m.w - 1, Math.ceil((cx + viewW) / T)), y1 = Math.min(m.h - 1, Math.ceil((cy + viewH) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      ctx.drawImage(tileCanvas(m.tiles[y * m.w + x], x, y), x * T, y * T);
    }

    const ents = [...this.npcs, p].sort((a, b) => lerp(a.fromY, a.y, a.t) - lerp(b.fromY, b.y, b.t));
    for (const e of ents) {
      const ex = Math.round(lerp(e.fromX, e.x, e.t) * T), ey = Math.round(lerp(e.fromY, e.y, e.t) * T);
      drawShadow(ctx, ex, ey);
      const frames = characterFrames(e.look)[e.dir];
      const fr = e.t < 1 ? Math.floor(e.walk) % 4 : 0;
      ctx.drawImage(frames[fr], ex, ey - 2);
      if (e.marker) this.drawMarker(ctx, ex, ey - 12, e.marker);
    }
    if (this.mailboxMarker && m.mailbox) this.drawMarker(ctx, m.mailbox.x * T, m.mailbox.y * T - 10, 'mail');
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, kind: Exclude<Marker, null>) {
    const bob = Math.round(Math.sin(this.time * 5) * 1.5);
    const X = x + 4, Y = y + bob;
    ctx.fillStyle = '#1c1a24';
    ctx.fillRect(X - 1, Y - 1, 10, 10);
    ctx.fillStyle = kind === 'talk' ? '#ffd400' : kind === 'review' ? '#8fd3ff' : '#ffffff';
    ctx.fillRect(X, Y, 8, 8);
    ctx.fillStyle = '#1c1a24';
    if (kind === 'talk') {
      ctx.fillRect(X + 3, Y + 1, 2, 4);
      ctx.fillRect(X + 3, Y + 6, 2, 1);
    } else if (kind === 'review') {
      ctx.fillRect(X + 1, Y + 4, 1, 1);
      ctx.fillRect(X + 3, Y + 4, 2, 1);
      ctx.fillRect(X + 6, Y + 4, 1, 1);
    } else {
      ctx.fillStyle = P_RED;
      ctx.fillRect(X + 1, Y + 2, 6, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(X + 2, Y + 3, 4, 1);
    }
  }

  /** Convert a client (CSS px) coordinate on the canvas into a tile. */
  screenToTile(clientX: number, clientY: number, canvas: HTMLCanvasElement): [number, number] {
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    const wx = ((clientX - r.left) * dpr) / this.scale - this.offX;
    const wy = ((clientY - r.top) * dpr) / this.scale - this.offY;
    return [Math.floor(wx / T), Math.floor(wy / T)];
  }
}

const P_RED = '#c8102e';

function mk(id: string, look: Look, x: number, y: number, dir: Dir): Entity {
  return { id, look, x, y, dir, fromX: x, fromY: y, t: 1, walk: 0, marker: null };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
function dirTo(x: number, y: number, tx: number, ty: number, loose = false): Dir | null {
  const dx = tx - x, dy = ty - y;
  if (!loose && Math.abs(dx) + Math.abs(dy) !== 1) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  if (dy !== 0) return dy > 0 ? 'down' : 'up';
  return null;
}
