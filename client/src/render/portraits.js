// Portrait renderer: draws each racer's head/bust into a render target once and
// turns it into an <img> (data URL) with an element-coloured frame. Used by the
// HUD minimap, character select cards, results and the lobby.
import * as THREE from 'three';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { createToyMaterial, updateLighting } from './toyMaterial.js';
import { Animator } from './animator.js';
import { ELEMENT_COLORS } from '../ui/icons.js';
import { listOf } from '@shared/data/registry.js';

const SIZE = 160;

export class PortraitRenderer {
  constructor(renderer) {
    this.gl = renderer.gl || renderer;
    this.cache = new Map();
    this.rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#554466', 1.6));
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    this.sunDir = new THREE.Vector3(0.3, 0.7, 0.7).normalize();
    this.pixels = new Uint8Array(SIZE * SIZE * 4);
  }

  get(id) { return this.cache.get(id); }

  renderAll() {
    for (const r of listOf('racers')) this.render(r);
    return this.cache;
  }

  render(racer, { full = false } = {}) {
    if (!racer.figure) return null;
    const key = racer.id + (full ? ':full' : '');
    if (this.cache.has(key)) return this.cache.get(key);
    const tpl = buildFigureTemplate(racer.figure, { key: `racer:${racer.id}` });
    const mat = createToyMaterial();
    const fig = instantiateFigure(tpl, { material: mat, outline: true });
    const anim = new Animator(fig);
    anim.mode = 'select';
    anim.update(0.3);
    this.scene.add(fig.mesh);
    fig.mesh.rotation.y = 0.35;
    fig.mesh.updateMatrixWorld(true);
    const head = fig.bones.head || fig.bones.body || fig.bones.root;
    const hp = new THREE.Vector3();
    head.getWorldPosition(hp);
    const sphere = tpl.geometry.boundingSphere;
    if (full) {
      this.camera.position.set(sphere.center.x + 0.35, sphere.center.y + 0.15, sphere.radius * 3.6);
      this.camera.lookAt(sphere.center.x, sphere.center.y, sphere.center.z);
    } else {
      const pc = racer.figure.portrait || {};
      const dist = pc.dist ?? 1.2, dy = pc.y ?? 0.03;
      this.camera.position.set(hp.x + dist * 0.26, hp.y + dy + 0.1, hp.z + dist);
      this.camera.lookAt(hp.x, hp.y + dy, hp.z);
    }
    this.camera.updateMatrixWorld();
    updateLighting(this.camera, this.sunDir);
    const prevTarget = this.gl.getRenderTarget();
    const prevClear = new THREE.Color();
    this.gl.getClearColor(prevClear);
    const prevAlpha = this.gl.getClearAlpha();
    this.gl.setRenderTarget(this.rt);
    this.gl.setClearColor(0x000000, 0);
    this.gl.clear();
    this.gl.render(this.scene, this.camera);
    this.gl.readRenderTargetPixels(this.rt, 0, 0, SIZE, SIZE, this.pixels);
    this.gl.setRenderTarget(prevTarget);
    this.gl.setClearColor(prevClear, prevAlpha);
    this.scene.remove(fig.mesh);
    mat.dispose();
    fig.outline?.material.dispose();

    // compose: element-coloured radial frame + figure pixels (flipped vertically)
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    const col = ELEMENT_COLORS[racer.element] || '#888';
    const g = ctx.createRadialGradient(SIZE / 2, SIZE * 0.45, 10, SIZE / 2, SIZE / 2, SIZE * 0.7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, col);
    g.addColorStop(1, shadeHex(col, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // burst rays like the promo art
    ctx.save();
    ctx.translate(SIZE / 2, SIZE * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -SIZE); ctx.lineTo(10, -SIZE); ctx.fill();
    }
    ctx.restore();
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const src = (SIZE - 1 - y) * SIZE * 4, dst = y * SIZE * 4;
      img.data.set(this.pixels.subarray(src, src + SIZE * 4), dst);
    }
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = SIZE;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    const url = c.toDataURL('image/png');
    const image = new Image();
    image.src = url;
    const entry = { url, image, canvas: c };
    this.cache.set(key, entry);
    racer.portrait = racer.portrait || url;
    return entry;
  }

  dispose() { this.rt.dispose(); }
}

function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
