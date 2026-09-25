// WebGL renderer wrapper: resize, pixel ratio from quality level, draw stats.
import * as THREE from 'three';

export class Renderer {
  constructor(container, quality) {
    this.quality = quality;
    const lowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    this.gl = new THREE.WebGLRenderer({
      antialias: !lowEnd && (window.devicePixelRatio || 1) < 2.5,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.setClearColor(0x87c8ff, 1);
    container.appendChild(this.gl.domElement);
    this.canvas = this.gl.domElement;
    this.width = 1; this.height = 1;
    this.applyQuality();
    quality.onChange(() => this.applyQuality());
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();
  }

  applyQuality() {
    const q = this.quality.q;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * q.pixelRatio;
    this.gl.setPixelRatio(dpr);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w; this.height = h;
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.onResize?.(w, h);
  }

  get aspect() { return this.width / Math.max(1, this.height); }

  render(scene, camera) {
    this.gl.render(scene, camera);
  }

  stats() {
    const i = this.gl.info;
    return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures };
  }
}
