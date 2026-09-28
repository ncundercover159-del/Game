// Camera: follows a target, clamps to map bounds, and centres maps smaller than the view.
// Positions are floats for smooth follow; drawing uses the rounded values (no shimmer).
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 480;
    this.h = 270;
  }

  setView(w, h) {
    this.w = w;
    this.h = h;
  }

  follow(tx, ty, mapW, mapH, lerp = 1) {
    let x = tx - this.w / 2;
    let y = ty - this.h / 2;
    x = mapW <= this.w ? (mapW - this.w) / 2 : Math.max(0, Math.min(mapW - this.w, x));
    y = mapH <= this.h ? (mapH - this.h) / 2 : Math.max(0, Math.min(mapH - this.h, y));
    this.x += (x - this.x) * lerp;
    this.y += (y - this.y) * lerp;
  }

  get ix() { return Math.round(this.x); }
  get iy() { return Math.round(this.y); }
}
