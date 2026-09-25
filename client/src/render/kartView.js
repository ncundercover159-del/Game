// Visual kart: vehicle (skinned, wheels/steer/glider bones) + racer figure +
// blob shadow + effects (drift sparks, exhaust flames, element trails, dust).
import * as THREE from 'three';
import { buildFigureTemplate, instantiateFigure } from './figure.js';
import { createToyMaterial } from './toyMaterial.js';
import { Animator } from './animator.js';
import { TEX } from './textures.js';
import { KART } from '@shared/config.js';
import { getRacer, getVehicle, getWheels, getGlider } from '@shared/data/registry.js';
import { clamp, damp } from '@shared/math.js';

export const TIER_COLORS = [null, [0.24, 0.7, 1.0], [1.0, 0.55, 0.12], [0.78, 0.36, 1.0]];
const SIZE_SCALE = { light: 1.12, medium: 1.22, heavy: 1.32 };

// element trail emitters (colour, style)
export const ELEMENT_FX = {
  fire:   { c: [1.0, 0.45, 0.1], c1: [1.0, 0.85, 0.2], sys: 'glow', grav: -2, size: [0.5, 0.05], life: 0.5 },
  water:  { c: [0.5, 0.85, 1.0], c1: [0.9, 0.97, 1.0], sys: 'glow', grav: 14, size: [0.3, 0.1], life: 0.5, up: 3 },
  earth:  { c: [0.6, 0.45, 0.28], c1: [0.8, 0.7, 0.5], sys: 'chips', grav: 16, size: [0.35, 0.2], life: 0.6, up: 4 },
  air:    { c: [0.85, 1.0, 1.0], c1: [1.0, 1.0, 1.0], sys: 'smoke', grav: -1, size: [0.4, 1.2], life: 0.6 },
  life:   { c: [0.35, 0.85, 0.25], c1: [0.8, 1.0, 0.4], sys: 'chips', grav: 2, size: [0.35, 0.3], life: 0.9, up: 2 },
  undead: { c: [0.4, 1.0, 0.7], c1: [0.7, 0.7, 0.85], sys: 'glow', grav: -3, size: [0.5, 0.9], life: 0.8 },
  tech:   { c: [0.3, 0.9, 1.0], c1: [1.0, 0.8, 0.2], sys: 'glow', grav: 6, size: [0.25, 0.05], life: 0.35, up: 3 },
  magic:  { c: [0.75, 0.4, 1.0], c1: [1.0, 0.6, 0.95], sys: 'glow', grav: -1, size: [0.35, 0.02], life: 0.7 },
  light:  { c: [1.0, 0.95, 0.5], c1: [1.0, 1.0, 1.0], sys: 'glow', grav: 0, size: [0.4, 0.02], life: 0.5 },
  dark:   { c: [0.35, 0.15, 0.5], c1: [0.8, 0.25, 0.75], sys: 'smoke', grav: -1, size: [0.5, 1.1], life: 0.7 },
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _m = new THREE.Matrix4();

export function vehicleTemplate(vehicle, wheels, glider, opts = {}) {
  const fs = vehicle.wheelScale || { front: 1, back: 1 };
  const attach = [
    { bone: 'wheelFL', def: wheels.figure, scale: fs.front },
    { bone: 'wheelFR', def: wheels.figure, scale: fs.front },
    { bone: 'wheelBL', def: wheels.figure, scale: fs.back },
    { bone: 'wheelBR', def: wheels.figure, scale: fs.back },
  ];
  if (glider) attach.push({ bone: 'glider', def: glider.figure });
  const def = opts.kartColor ? { ...vehicle.figure, palette: { ...vehicle.figure.palette, primary: opts.kartColor } } : vehicle.figure;
  return buildFigureTemplate(def, {
    key: `veh:${vehicle.id}:${wheels.id}:${glider?.id}:${opts.kartColor || ''}`,
    attach, detail: opts.detail ?? 1,
  });
}

export function racerTemplate(racer, detail = 1) {
  return buildFigureTemplate(racer.figure, { key: `racer:${racer.id}`, detail });
}

export class KartView {
  constructor(scene, entrant, fx, opts = {}) {
    this.scene = scene;
    this.fx = fx;
    this.racer = getRacer(entrant.racerId);
    this.vehicle = getVehicle(entrant.vehicleId);
    this.wheels = getWheels(entrant.wheelsId);
    this.glider = getGlider(entrant.gliderId);
    this.element = this.racer.element;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    const detail = opts.detail ?? 1;
    this.kartMat = createToyMaterial();
    this.figMat = createToyMaterial();
    const vt = vehicleTemplate(this.vehicle, this.wheels, this.glider, { detail, kartColor: this.racer.kartColor });
    this.veh = instantiateFigure(vt, { material: this.kartMat, outline: opts.outlines !== false });
    this.body.add(this.veh.mesh);
    this.gliderBone = this.veh.bones.glider;
    if (this.gliderBone) this.gliderBone.scale.setScalar(0.001);

    this.fig = null;
    if (this.racer.figure) {
      const rt = racerTemplate(this.racer, detail);
      this.fig = instantiateFigure(rt, { material: this.figMat, outline: opts.outlines !== false });
      const seat = this.vehicle.seat || [0, 0.4, -0.2];
      this.fig.mesh.position.set(seat[0], seat[1], seat[2]);
      this.fig.mesh.scale.setScalar(SIZE_SCALE[this.racer.size] || 1);
      this.body.add(this.fig.mesh);
      this.anim = new Animator(this.fig, { racer: this.racer });
    }

    // blob shadow
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 3.2),
      new THREE.MeshBasicMaterial({ map: TEX.blob(), transparent: true, depthWrite: false, fog: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.renderOrder = 2;
    this.shadow = sh;
    scene.add(sh);

    // exhaust flame sprites
    this.flames = [];
    for (const ex of this.vehicle.exhausts || []) {
      // coloured outer flame (normal blend so it reads on bright skies) + white-hot core
      const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft(), color: 0xff8a1e, transparent: true, depthWrite: false }));
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      outer.position.set(ex[0], ex[1], ex[2] - 0.2);
      core.position.set(ex[0], ex[1], ex[2] - 0.12);
      outer.scale.setScalar(0.001); core.scale.setScalar(0.001);
      outer.renderOrder = 6; core.renderOrder = 7;
      this.body.add(outer, core);
      this.flames.push({ outer, core });
    }

    this.wheelSpin = 0;
    this.visDrift = 0;
    this.visLean = 0;
    this.tilt = new THREE.Quaternion();
    this.prevGrounded = true;
    this.spinAngle = 0;
    this.flashT = 0;
    this.gliderOpen = 0;
    this.sparkAcc = 0;
    this.local = !!opts.local;
    this.state = null;
  }

  // k: kart state (possibly interpolated) ; dt: render delta
  update(k, dt, time) {
    this.state = k;
    const hidden = k.eliminated;
    this.root.visible = !hidden;
    this.shadow.visible = !hidden && k.rescuePhase !== 0 || (!hidden && k.rescue <= 0);
    if (hidden) return;

    this.root.position.set(k.x, k.y, k.z);

    // tilt to ground normal (smoothed), yaw from heading
    _v.set(k.gnx ?? 0, k.gny ?? 1, k.gnz ?? 0);
    if (!k.grounded) _v.lerp(_up, 0.5).normalize();
    _q.setFromUnitVectors(_up, _v);
    this.tilt.slerp(_q, 1 - Math.exp(-10 * dt));
    _qy.setFromAxisAngle(_up, k.yaw);
    this.root.quaternion.copy(this.tilt).multiply(_qy);

    // drift yaw offset + lean
    this.visDrift = damp(this.visDrift, (k.drift || 0) * KART.driftVisualYaw, 8, dt);
    const steer = k.steer || 0;
    this.visLean = damp(this.visLean, -(steer * 0.06 + (k.drift || 0) * 0.1), 10, dt);

    // spin-out / tumble visuals
    let spinY = 0, flipX = 0;
    if (k.spin > 0) this.spinAngle += dt * 14 * Math.min(1, k.spin + 0.3);
    else this.spinAngle = damp(this.spinAngle, Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2, 10, dt);
    spinY = this.spinAngle;
    if (k.tumble > 0) flipX = (1 - k.tumble / KART.tumbleTime) * Math.PI * 2;
    this.body.rotation.set(flipX, this.visDrift + spinY, this.visLean, 'YXZ');

    // scale: shrink / squish / boost stretch
    let sx = 1, sy = 1, sz = 1;
    if (k.shrink > 0) { const s = k.shrink > 0.3 ? 0.55 : 1 - 0.45 * (k.shrink / 0.3); sx = sy = sz = s; }
    if (k.squish > 0) { sy *= 0.3; sx *= 1.35; sz *= 1.2; }
    if (k.boostTime > 0) { sz *= 1.04; sy *= 0.98; }
    this.body.scale.set(sx, sy, sz);

    // hop bounce is already in k.y; landing squash
    if (!this.prevGrounded && k.grounded) {
      this.anim?.landed(4);
      this.landT = 0.25;
    }
    this.prevGrounded = k.grounded;
    if (this.landT > 0) {
      this.landT -= dt;
      const p = Math.sin((this.landT / 0.25) * Math.PI) * 0.12;
      this.body.scale.y *= 1 - p;
      this.body.scale.x *= 1 + p * 0.5;
    }

    // wheels
    this.wheelSpin += (k.speed / 0.3) * dt;
    const B = this.veh.bones, bind = this.veh.bind;
    const wheelSteer = clamp(steer, -1, 1) * 0.42 + (k.drift || 0) * -0.15;
    for (const n of ['wheelFL', 'wheelFR', 'wheelBL', 'wheelBR']) {
      const b = B[n];
      if (!b) continue;
      const front = n[5] === 'F';
      b.rotation.set(this.wheelSpin, front ? wheelSteer : 0, 0, 'YXZ');
      b.position.copy(bind[n].pos);
      if (k.grounded) b.position.y += Math.sin(time * 40 + (front ? 0 : 1.3)) * 0.006 * Math.min(1, Math.abs(k.speed) / 20);
    }
    if (B.steer) {
      B.steer.quaternion.copy(bind.steer.quat);
      B.steer.rotateZ(steer * 0.9);
    }
    // glider
    this.gliderOpen = damp(this.gliderOpen, k.glider ? 1 : 0, 8, dt);
    if (this.gliderBone) this.gliderBone.scale.setScalar(Math.max(0.001, this.gliderOpen));

    // flashes: invulnerability blink, star rainbow, hit flash
    let flash = 0;
    const fc = this.figMat.uniforms.uFlashColor.value;
    if (k.star > 0) {
      fc.setHSL((time * 2.5) % 1, 1, 0.6);
      flash = 0.45;
    } else if (this.flashT > 0) {
      this.flashT -= dt;
      fc.setRGB(1, 1, 1);
      flash = this.flashT * 2;
    }
    this.figMat.uniforms.uFlash.value = flash;
    this.kartMat.uniforms.uFlash.value = flash;
    this.kartMat.uniforms.uFlashColor.value.copy(fc);
    const blink = k.invuln > 0 && k.spin <= 0 && k.tumble <= 0 && k.star <= 0 && Math.floor(time * 14) % 2 === 0;
    this.body.visible = !blink;

    // shadow
    const gh = k.groundH ?? k.y;
    const height = Math.max(0, k.y - gh);
    this.shadow.position.set(k.x, gh + 0.05, k.z);
    this.shadow.rotation.z = k.yaw;
    const ss = Math.max(0.4, 1 - height * 0.08) * (k.shrink > 0 ? 0.6 : 1);
    this.shadow.scale.set(ss, ss, 1);
    this.shadow.material.opacity = Math.max(0.15, 1 - height * 0.1);

    // character animation
    if (this.anim) {
      this.anim.update(dt, {
        steer, drift: k.drift || 0, speed01: clamp(Math.abs(k.speed) / 30, 0, 1),
        air: !k.grounded, boost: k.boostTime > 0, spin: k.spin > 0 || k.tumble > 0,
        dizzy: k.spin <= 0 && k.invuln > 0.6 && k.star <= 0, look: k.lookBack, glide: k.glider,
        trick: k.trickDone && !k.grounded,
      });
    }

    this.updateEffects(k, dt, time);
  }

  worldPoint(x, y, z, out) {
    out.set(x, y, z);
    this.body.updateWorldMatrix(true, false);
    return out.applyMatrix4(this.body.matrixWorld);
  }

  updateEffects(k, dt, time) {
    const fx = this.fx;
    if (!fx) return;
    // exhaust flames
    const boosting = k.boostTime > 0;
    let fcol = null;
    if (boosting) {
      const tier = k.boostKind?.startsWith('mt') ? +k.boostKind[2] : 0;
      fcol = tier ? TIER_COLORS[tier] : [1, 0.6, 0.15];
    }
    for (const f of this.flames) {
      const target = boosting ? 0.75 + Math.sin(time * 60) * 0.18 : k.speed > 3 ? 0.22 + Math.random() * 0.06 : 0.001;
      const s = damp(f.outer.scale.x, target, 20, dt);
      f.outer.scale.set(s, s, s);
      f.core.scale.setScalar(s * 0.45);
      if (fcol) f.outer.material.color.setRGB(fcol[0], fcol[1], fcol[2]);
      else f.outer.material.color.setRGB(1, 0.5, 0.15);
      f.outer.material.opacity = boosting ? 0.95 : 0.6;
      f.core.material.opacity = boosting ? 0.9 : 0.4;
    }
    if (!k.grounded && !boosting && k.drift === 0) return;

    this.sparkAcc += dt * 60;
    const n = Math.floor(this.sparkAcc);
    this.sparkAcc -= n;
    if (n <= 0) return;
    const back = -0.85;
    // drift sparks
    if (k.drift && k.grounded) {
      const col = TIER_COLORS[k.driftTier];
      for (let side = -1; side <= 1; side += 2) {
        this.worldPoint(0.62 * side, 0.08, back, _v);
        for (let i = 0; i < n; i++) {
          if (!fx.ok()) continue;
          if (col) {
            fx.spark.emit({
              x: _v.x, y: _v.y, z: _v.z,
              vx: (Math.random() - 0.5) * 4 + side * 1.5, vy: 1.5 + Math.random() * 3.5, vz: (Math.random() - 0.5) * 4,
              life: 0.2 + Math.random() * 0.14, size: [0.2 + k.driftTier * 0.05, 0.02],
              color: [col[0], col[1], col[2], 1], color1: [col[0] * 0.8 + 0.2, col[1] * 0.8 + 0.2, col[2] * 0.8 + 0.2, 0.2], gravity: 16, drag: 2,
            });
            if (Math.random() < 0.5) fx.glow.emit({
              x: _v.x, y: _v.y + 0.05, z: _v.z, vx: 0, vy: 0.5, vz: 0,
              life: 0.12, size: [0.5 + k.driftTier * 0.12, 0.1], color: [col[0], col[1], col[2], 0.9], color1: [col[0], col[1], col[2], 0],
            });
          } else if (Math.random() < 0.35) {
            fx.smoke.emit({
              x: _v.x, y: _v.y, z: _v.z, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 2,
              life: 0.5, size: [0.4, 1.4], color: [0.85, 0.85, 0.9, 0.45], color1: [0.9, 0.9, 0.95, 0], drag: 2,
            });
          }
        }
      }
    }
    // element trail while boosting or charged drift
    const efx = ELEMENT_FX[this.element];
    if (efx && (boosting || k.driftTier >= 2)) {
      this.worldPoint(0, 0.5, -1.1, _v);
      for (let i = 0; i < n; i++) {
        if (!fx.ok() || Math.random() < 0.4) continue;
        const sys = fx[efx.sys];
        sys.emit({
          x: _v.x + (Math.random() - 0.5) * 0.8, y: _v.y + (Math.random() - 0.5) * 0.4, z: _v.z + (Math.random() - 0.5) * 0.8,
          vx: (Math.random() - 0.5) * 3, vy: (efx.up || 0.5) * Math.random(), vz: (Math.random() - 0.5) * 3,
          life: efx.life * (0.7 + Math.random() * 0.6), size: efx.size,
          color: [...efx.c, 1], color1: [...efx.c1, 0], gravity: efx.grav, drag: 1.5, spin: (Math.random() - 0.5) * 8,
        });
      }
    }
    // off-road dust
    if (k.grounded && Math.abs(k.speed) > 6 && (k.surface === 'offroad' || k.surface === 'sand' || k.surface === 'snow')) {
      const c = k.surface === 'snow' ? [0.95, 0.97, 1] : k.surface === 'sand' ? [0.9, 0.8, 0.55] : [0.55, 0.45, 0.3];
      for (let side = -1; side <= 1; side += 2) {
        if (!fx.ok() || Math.random() < 0.5) continue;
        this.worldPoint(0.65 * side, 0.1, back, _v2);
        fx.smoke.emit({
          x: _v2.x, y: _v2.y, z: _v2.z, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
          life: 0.7, size: [0.6, 2.0], color: [...c, 0.7], color1: [...c, 0], drag: 2.5, gravity: 1,
        });
      }
    }
  }

  // bursts triggered by sim events
  burst(type, data = {}) {
    const fx = this.fx;
    const k = this.state;
    if (!fx || !k) return;
    if (type === 'miniTurbo' || type === 'boost') {
      const tier = data.tier || 0;
      const col = tier ? TIER_COLORS[tier] : [1, 0.7, 0.2];
      for (const ex of this.vehicle.exhausts || [[0, 0.5, -1.1]]) {
        this.worldPoint(ex[0], ex[1], ex[2], _v);
        for (let i = 0; i < 14; i++) {
          fx.glow.emit({
            x: _v.x, y: _v.y, z: _v.z,
            vx: (Math.random() - 0.5) * 6, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 6,
            life: 0.35, size: [0.8, 0.05], color: [...col, 1], color1: [1, 1, 1, 0], drag: 3,
          });
        }
      }
      this.anim?.boosted(tier ? 0.6 + tier * 0.3 : 1);
      if (tier >= 2 || type === 'boost') this.anim?.play('whoo');
    } else if (type === 'hit') {
      this.flashT = 0.35;
      this.anim?.play('hit');
      for (let i = 0; i < 20; i++) {
        fx.chips.emit({
          x: k.x, y: k.y + 1, z: k.z,
          vx: (Math.random() - 0.5) * 12, vy: 3 + Math.random() * 7, vz: (Math.random() - 0.5) * 12,
          life: 0.9, size: [0.35, 0.2], color: [1, 0.9, 0.3, 1], color1: [1, 0.5, 0.2, 0.8], gravity: 20, drag: 1, spin: 10,
        });
      }
    } else if (type === 'land' && data.air > 0.4) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        fx.smoke.emit({
          x: k.x + Math.cos(a) * 0.8, y: k.y + 0.1, z: k.z + Math.sin(a) * 0.8,
          vx: Math.cos(a) * 5, vy: 0.8, vz: Math.sin(a) * 5,
          life: 0.55, size: [0.7, 1.8], color: [0.95, 0.95, 1, 0.6], color1: [1, 1, 1, 0], drag: 4,
        });
      }
    } else if (type === 'trick') {
      this.anim?.play('cheer');
      for (let i = 0; i < 16; i++) {
        fx.glow.emit({
          x: k.x, y: k.y + 1, z: k.z,
          vx: (Math.random() - 0.5) * 8, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 8,
          life: 0.5, size: [0.5, 0.02], color: [1, 0.95, 0.4, 1], color1: [1, 1, 1, 0], drag: 2,
        });
      }
    } else if (type === 'mtTier') {
      const col = TIER_COLORS[data.tier];
      this.worldPoint(0, 0.3, -0.9, _v);
      for (let i = 0; i < 10; i++) {
        fx.glow.emit({
          x: _v.x, y: _v.y, z: _v.z, vx: (Math.random() - 0.5) * 7, vy: 1 + Math.random() * 4, vz: (Math.random() - 0.5) * 7,
          life: 0.3, size: [0.6, 0.02], color: [...col, 1], color1: [1, 1, 1, 0], drag: 2,
        });
      }
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.kartMat.dispose();
    this.figMat.dispose();
    for (const f of this.flames) { f.outer.material.dispose(); f.core.material.dispose(); }
    this.veh.outline?.material.dispose();
    this.fig?.outline?.material.dispose();
  }
}
