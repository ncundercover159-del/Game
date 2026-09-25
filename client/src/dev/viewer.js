// Dev-only figure viewer: renders racers / vehicles in per-item viewport cells
// so figure JSONs can be compared against the reference art.
//   /viewer.html?racer=draxo&angle=front          single racer
//   /viewer.html?grid=1&angle=30[&kart=1]          all racers (optionally in karts)
//   /viewer.html?vehicles=1&racer=draxo            all vehicles
//   /viewer.html?portraits=1[&full=1]              portrait renders
import * as THREE from 'three';
import { loadClientData } from '../data/load.js';
import { listOf, getRacer } from '@shared/data/registry.js';
import { buildFigureTemplate, instantiateFigure } from '../render/figure.js';
import { createToyMaterial, updateLighting } from '../render/toyMaterial.js';
import { KartView } from '../render/kartView.js';
import { Animator } from '../render/animator.js';
import { PortraitRenderer } from '../render/portraits.js';

loadClientData();
const p = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
const info = document.getElementById('info');
const sunDir = new THREE.Vector3(0.4, 0.8, 0.6).normalize();
const angle = (({ front: 0, back: 180, side: 90 })[p.get('angle')] ?? +(p.get('angle') ?? 30)) * Math.PI / 180;

if (p.has('portraits')) {
  const pr = new PortraitRenderer(renderer);
  renderer.domElement.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:26px 8px';
  for (const r of listOf('racers')) {
    const e = pr.render(r, { full: p.has('full') });
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;text-align:center';
    fig.innerHTML = `<img src="${e.url}" width="${p.get('size') || 160}" style="border-radius:16px;border:3px solid #1a1426"><figcaption>${r.name}</figcaption>`;
    wrap.appendChild(fig);
  }
  document.body.appendChild(wrap);
} else {
  const cells = [];
  const mkScene = () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#554466', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(3, 6, 5);
    scene.add(sun);
    return scene;
  };
  const fake = () => ({ x: 0, y: 0, z: 0, yaw: angle, speed: 0, grounded: true, gnx: 0, gny: 1, gnz: 0, groundH: 0, boostTime: 0, spin: 0, tumble: 0, squish: 0, shrink: 0, star: 0, invuln: 0, rescue: 0, ghost: 0, burrow: 0, flail: 0 });
  const addCell = (label, inKart, racerId, vehicleId) => {
    const scene = mkScene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    let update;
    if (inKart) {
      const kv = new KartView(scene, { racerId, vehicleId }, null, {});
      if (kv.anim) kv.anim.mode = p.get('mode') || 'drive';
      const st = fake();
      update = (dt, t) => kv.update(st, dt, t);
      camera.position.set(0, 2.2, 6.2);
      camera.lookAt(0, 0.75, 0);
    } else {
      const r = getRacer(racerId);
      const tpl = buildFigureTemplate(r.figure, { key: 'v:' + r.id });
      const fig = instantiateFigure(tpl, { material: createToyMaterial() });
      fig.mesh.rotation.y = angle;
      scene.add(fig.mesh);
      const anim = new Animator(fig);
      anim.mode = p.get('mode') || 'select';
      if (p.get('play')) anim.play(p.get('play'));
      update = (dt) => anim.update(dt);
      const bs = tpl.geometry.boundingSphere;
      camera.position.set(0, bs.center.y + 0.2, bs.radius * 4.2);
      camera.lookAt(0, bs.center.y, 0);
    }
    cells.push({ scene, camera, update, label });
  };
  if (p.has('vehicles')) for (const v of listOf('vehicles')) addCell(v.name, true, p.get('racer') || 'draxo', v.id);
  else if (p.has('grid')) for (const r of listOf('racers')) addCell(r.name, p.has('kart'), r.id, p.get('kart') && p.get('kart') !== '1' ? p.get('kart') : null);
  else addCell(p.get('racer') || 'draxo', p.has('kart'), p.get('racer') || 'draxo', p.get('kart') && p.get('kart') !== '1' ? p.get('kart') : null);
  const cols = +(p.get('cols') || Math.ceil(Math.sqrt(cells.length * (innerWidth / innerHeight))));
  const rows = Math.ceil(cells.length / cols);
  const cw = Math.floor(innerWidth / cols), ch = Math.floor((innerHeight - 20) / rows);
  cells.forEach((c) => { c.camera.aspect = cw / ch; c.camera.updateProjectionMatrix(); });
  info.textContent = cells.map((c) => c.label).join(' · ');
  let last = performance.now(), t = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    renderer.setScissor(0, 0, innerWidth, innerHeight);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    renderer.setClearColor('#2a1d5c');
    renderer.clear();
    cells.forEach((c, i) => {
      const x = (i % cols) * cw, y = innerHeight - 20 - (Math.floor(i / cols) + 1) * ch;
      c.update(dt, t);
      renderer.setViewport(x, y, cw, ch);
      renderer.setScissor(x + 2, y + 2, cw - 4, ch - 4);
      renderer.setClearColor(i % 2 ? '#6a4fc0' : '#7a5fd0');
      renderer.clear();
      updateLighting(c.camera, sunDir);
      renderer.render(c.scene, c.camera);
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
window.__viewerReady = true;
