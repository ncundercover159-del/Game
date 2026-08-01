'use strict';

/* The playable level: rendering, touch input, and the match/blast/settle
 * pipeline. All animation is sequenced with async/await on tweens that are
 * stepped from one requestAnimationFrame loop. */
class Game {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};

    this.tweens = [];
    this.dying = [];
    this.board = null;
    this.level = null;
    this.state = 'idle';       // idle | playing | busy | ending | over
    this.busy = false;
    this.paused = false;

    this.cell = 40;
    this.ox = 0;
    this.oy = 0;
    this.pad = 8;

    this.selected = null;
    this.drag = null;
    this.hint = null;
    this.idleTime = 0;
    this.armedBooster = null;
    this.time = 0;
    this.shakeUntil = 0;
    this.shakeMag = 0;
    this.speed = 1;

    this._lastTs = 0;
    this._raf = null;
    this._onResize = () => this.resize();

    this.bindInput();
  }

  // ------------------------------------------------------------- lifecycle

  start(levelId) {
    this.level = Levels.get(levelId);
    this.board = new Board(this.level);
    this.movesLeft = this.level.moves;
    this.score = 0;
    this.cascade = 0;
    this.goals = this.level.goals.map(g => Object.assign({ done: 0 }, g));
    this.selected = null;
    this.drag = null;
    this.hint = null;
    this.idleTime = 0;
    this.armedBooster = null;
    this.dying.length = 0;
    this.tweens.length = 0;
    this.busy = false;
    this.paused = false;
    this.shakeUntil = 0;
    this.state = 'playing';
    FX.clear();

    this.resize();
    this.emitHud();
    this.run();
  }

  stop() {
    this.state = 'idle';
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
  }

  run() {
    window.addEventListener('resize', this._onResize);
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (window.ResizeObserver && this.canvas.parentElement) {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this.canvas.parentElement);
    }
    if (this._raf) cancelAnimationFrame(this._raf);
    this._lastTs = performance.now();
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
      this._lastTs = ts;
      this.update(dt);
      this.render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  // --------------------------------------------------------------- tweens

  /* `speed` scales every animation; the smoke test cranks it up so it can
   * play whole levels in seconds. */
  tween(ms, fn, ease) {
    ms = ms / (this.speed || 1);
    if (ms <= 0) { if (fn) fn(1); return Promise.resolve(); }
    return new Promise(resolve => {
      this.tweens.push({ t: 0, dur: ms / 1000, fn: fn || null, ease: ease || Utils.linear, resolve });
    });
  }

  delay(ms) { return this.tween(ms, null); }

  tweenProps(obj, to, ms, ease) {
    const from = {};
    for (const k in to) from[k] = obj[k];
    return this.tween(ms, p => {
      for (const k in to) obj[k] = Utils.lerp(from[k], to[k], p);
    }, ease);
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const raw = Utils.clamp(tw.t / tw.dur, 0, 1);
      const p = tw.ease(raw);
      if (tw.fn) tw.fn(p);
      if (raw >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.updateTweens(dt);
    FX.update(dt);

    if (this.state === 'playing' && !this.busy && !this.paused) {
      this.idleTime += dt;
      if (this.idleTime > 5 && !this.hint) this.showHint();
    } else {
      this.idleTime = 0;
    }
  }

  // --------------------------------------------------------------- layout

  resize() {
    const wrap = this.canvas.parentElement;
    if (!wrap || !this.board) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pad = 8;
    const cell = Math.floor(Math.min(
      (rect.width - pad * 2) / this.board.cols,
      (rect.height - pad * 2) / this.board.rows,
    ));
    this.cell = Math.max(18, cell);
    this.pad = pad;

    const w = this.cell * this.board.cols + pad * 2;
    const h = this.cell * this.board.rows + pad * 2;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ox = pad;
    this.oy = pad;
  }

  cellToPx(x, y) {
    return { x: this.ox + (x + 0.5) * this.cell, y: this.oy + (y + 0.5) * this.cell };
  }

  pxToCell(px, py) {
    return {
      r: Math.floor((py - this.oy) / this.cell),
      c: Math.floor((px - this.ox) / this.cell),
    };
  }

  // ---------------------------------------------------------------- input

  bindInput() {
    const cv = this.canvas;
    const local = (e) => {
      const rect = cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      SFX.resume();
      const p = local(e);
      cv.setPointerCapture(e.pointerId);
      this.onDown(p.x, p.y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      e.preventDefault();
      const p = local(e);
      this.onMove(p.x, p.y);
    });
    const up = (e) => {
      if (!this.drag) return;
      e.preventDefault();
      this.onUp();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  canInput() {
    return this.state === 'playing' && !this.busy && !this.paused;
  }

  onDown(px, py) {
    const p = this.pxToCell(px, py);
    if (!this.board.inBounds(p.r, p.c)) return;

    if (this.armedBooster) {
      this.useBooster(p);
      return;
    }
    if (!this.canInput()) return;

    this.idleTime = 0;
    this.hint = null;

    if (this.selected && this.board.areAdjacent(this.selected, p)) {
      const from = this.selected;
      this.selected = null;
      this.attemptSwap(from, p);
      return;
    }
    this.drag = { cell: p, sx: px, sy: py, moved: false };
  }

  onMove(px, py) {
    if (!this.drag || this.drag.moved || !this.canInput()) return;
    const dx = px - this.drag.sx;
    const dy = py - this.drag.sy;
    if (Math.hypot(dx, dy) < this.cell * 0.34) return;

    this.drag.moved = true;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? { r: 0, c: dx > 0 ? 1 : -1 }
      : { r: dy > 0 ? 1 : -1, c: 0 };
    const from = this.drag.cell;
    const to = { r: from.r + dir.r, c: from.c + dir.c };
    this.selected = null;
    this.drag = null;
    this.attemptSwap(from, to);
  }

  onUp() {
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.moved || !this.canInput()) return;

    const p = drag.cell;
    const gem = this.board.gemAt(p.r, p.c);
    if (!gem || gem.locked) { this.selected = null; return; }

    // Tapping a rocket or TNT fires it straight away, Royal Match style.
    if (gem.power && gem.power !== POWER.LIGHT) {
      this.selected = null;
      this.tapPower(p, gem);
      return;
    }
    if (this.selected && this.selected.r === p.r && this.selected.c === p.c) {
      this.selected = null;
    } else {
      this.selected = p;
      SFX.select();
      Native.haptic('select');
    }
  }

  // ----------------------------------------------------------- core turns

  useMove() {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.emitHud();
  }

  async attemptSwap(a, b) {
    if (!this.canInput()) return;
    if (!this.board.inBounds(b.r, b.c) || !this.board.isPlayable(b.r, b.c)) {
      this.bumpInvalid(a, b);
      return;
    }
    const ga = this.board.gemAt(a.r, a.c);
    const gb = this.board.gemAt(b.r, b.c);
    if (!ga || !gb || ga.locked || gb.locked) {
      this.bumpInvalid(a, b);
      return;
    }

    this.busy = true;
    this.hint = null;
    const valid = this.board.isValidSwap(a, b);

    SFX.swap();
    await this.animateSwap(ga, gb, a, b);

    if (!valid) {
      SFX.invalid();
      Native.haptic('warning');
      await this.animateSwap(ga, gb, b, a);
      this.busy = false;
      return;
    }

    this.board.swapGems(a, b);
    this.useMove();

    const combo = this.buildCombo(a, b);
    if (combo) {
      await this.detonate(combo);
      await this.settle();
      await this.resolve(null);
    } else {
      await this.resolve([a, b]);
    }
    await this.finishTurn();
  }

  async bumpInvalid(a, b) {
    const ga = this.board.gemAt(a.r, a.c);
    if (!ga) return;
    SFX.invalid();
    Native.haptic('warning');
    this.busy = true;
    const dx = (b.c - a.c) * 0.22, dy = (b.r - a.r) * 0.22;
    await this.tweenProps(ga, { x: a.c + dx, y: a.r + dy }, 90, Utils.easeOutQuad);
    await this.tweenProps(ga, { x: a.c, y: a.r }, 130, Utils.easeOutBack);
    this.busy = false;
  }

  animateSwap(ga, gb, from, to) {
    const dur = 150;
    const a0 = { x: ga.x, y: ga.y }, b0 = { x: gb.x, y: gb.y };
    return this.tween(dur, p => {
      ga.x = Utils.lerp(a0.x, to.c, p); ga.y = Utils.lerp(a0.y, to.r, p);
      gb.x = Utils.lerp(b0.x, from.c, p); gb.y = Utils.lerp(b0.y, from.r, p);
    }, Utils.easeInOutQuad);
  }

  async tapPower(p, gem) {
    this.busy = true;
    this.useMove();
    const act = { r: p.r, c: p.c, gem, power: gem.power, color: gem.color };
    await this.detonate([act]);
    await this.settle();
    await this.resolve(null);
    await this.finishTurn();
  }

  /* Runs after every player action: shuffles a dead board, then checks
   * for win / loss. */
  async finishTurn() {
    this.busy = true;
    await this.ensurePlayable();

    if (this.goalsComplete()) {
      await this.winSequence();
    } else if (this.movesLeft <= 0) {
      await this.loseSequence();
    } else {
      this.busy = false;
      this.idleTime = 0;
    }
    this.emitHud();
  }

  async ensurePlayable() {
    let guard = 0;
    while (!this.board.findAllMoves().length && guard++ < 8) {
      this.showBanner('No moves — shuffling!');
      SFX.shuffle();
      await this.delay(500);
      this.board.shuffleBoard();
      await this.animateShuffle();
      this.hideBanner();
      await this.resolve(null);
    }
  }

  async animateShuffle() {
    const gems = [];
    this.board.eachGem((gem, r, c) => gems.push({ gem, r, c }));
    const cx = this.board.cols / 2 - 0.5, cy = this.board.rows / 2 - 0.5;
    await this.tween(220, p => {
      for (const g of gems) {
        g.gem.x = Utils.lerp(g.c, cx, p * 0.55);
        g.gem.y = Utils.lerp(g.r, cy, p * 0.55);
        g.gem.spin = p * 3;
      }
    }, Utils.easeInQuad);
    await this.tween(300, p => {
      for (const g of gems) {
        g.gem.x = Utils.lerp(Utils.lerp(g.c, cx, 0.55), g.c, p);
        g.gem.y = Utils.lerp(Utils.lerp(g.r, cy, 0.55), g.r, p);
        g.gem.spin = (1 - p) * 3;
      }
    }, Utils.easeOutBack);
    for (const g of gems) g.gem.spin = 0;
  }

  // ------------------------------------------------------------- resolving

  /* Repeatedly clears matches, spawns power-ups and settles until the
   * board is quiet. `preferred` holds the cells the player just touched so
   * new power-ups appear under their finger. */
  async resolve(preferred) {
    let guard = 0;
    let matched = false;

    while (guard++ < 60) {
      const groups = this.board.findMatches();
      if (!groups.length) break;
      matched = true;
      this.cascade++;
      SFX.match(this.cascade);
      Native.haptic('light');

      const creations = [];
      const toClear = new Map();

      for (const group of groups) {
        let keep = null;
        if (group.power) {
          // If every gem in the shape is locked there is nowhere safe to put
          // the power-up, so the match just clears normally.
          keep = this.choosePowerCell(group, preferred);
          if (keep) creations.push({ r: keep.r, c: keep.c, power: group.power, color: group.color });
        }
        for (const p of group.cells) {
          if (keep && p.r === keep.r && p.c === keep.c) continue;
          toClear.set(p.r * this.board.cols + p.c, p);
        }
      }
      preferred = null;

      const triggers = [];
      for (const p of toClear.values()) {
        const t = this.board.damage(p.r, p.c, { cause: 'match' });
        if (t) triggers.push(t);
      }
      this.consumeEvents();
      await this.delay(150);

      for (const cr of creations) this.spawnPower(cr);
      if (creations.length) await this.delay(150);

      if (triggers.length) await this.detonate(triggers);
      await this.settle();
    }

    if (matched) this.cascade = 0;
    return matched;
  }

  /* Where a newly made power-up lands. Prefer the cell the player just
   * touched, then the shape's anchor — but never overwrite a locked gem,
   * which would wipe out ice/chain progress for free. */
  choosePowerCell(group, preferred) {
    const usable = (p) => {
      const g = this.board.gemAt(p.r, p.c);
      return g && !g.power && !g.locked;
    };
    if (preferred) {
      for (const want of preferred) {
        if (!want) continue;
        const hit = group.cells.find(p => p.r === want.r && p.c === want.c);
        if (hit && usable(hit)) return hit;
      }
    }
    if (usable(group.anchor)) return group.anchor;
    return group.cells.find(usable) || null;
  }

  spawnPower(cr) {
    const cell = this.board.cellAt(cr.r, cr.c);
    if (!cell) return;
    const gem = new Gem(cr.power === POWER.LIGHT ? -1 : cr.color, cr.power);
    gem.x = cr.c;
    gem.y = cr.r;
    gem.scale = 0.2;
    cell.gem = gem;
    this.tweenProps(gem, { scale: 1 }, 320, Utils.easeOutBack);

    const px = this.cellToPx(cr.c, cr.r);
    FX.sparkle(px.x, px.y, 10);
    FX.flash(px.x, px.y, this.cell * 0.9, 'rgba(255,255,255,.75)', 0.35);
    this.addScore(200, px, '+200');
    SFX.coin();
    Native.haptic('medium');
  }

  /* Fires power-ups in waves so chain reactions read clearly. */
  async detonate(activations) {
    let wave = activations;
    let guard = 0;

    while (wave.length && guard++ < 40) {
      const affected = new Map();

      for (const act of wave) {
        const cell = this.board.cellAt(act.r, act.c);
        if (cell && act.gem && cell.gem === act.gem) {
          cell.gem = null;
          act.gem.dying = true;
        }
        this.playBlastFx(act);
        for (const p of this.board.blastCells(act)) {
          affected.set(p.r * this.board.cols + p.c, p);
        }
      }

      const heavy = wave.some(a => a.power === POWER.TNT || a.visual);
      this.shake(heavy ? 9 : 5, 0.28);
      Native.haptic(heavy ? 'heavy' : 'medium');
      await this.delay(230);

      const next = [];
      for (const p of affected.values()) {
        const t = this.board.damage(p.r, p.c, { cause: 'blast' });
        if (t) next.push(t);
      }
      this.consumeEvents();
      await this.delay(110);
      wave = next;
    }
  }

  playBlastFx(act) {
    const px = this.cellToPx(act.c, act.r);
    const visual = act.visual || act.power;
    const span = Math.max(this.board.cols, this.board.rows) * this.cell;

    switch (visual) {
      case POWER.ROCKET_H:
        SFX.rocket();
        FX.trail(px.x, px.y, -1, 0, span, '#ffd76e');
        FX.trail(px.x, px.y, 1, 0, span, '#ffd76e');
        FX.sparkle(px.x, px.y, 8);
        break;
      case POWER.ROCKET_V:
        SFX.rocket();
        FX.trail(px.x, px.y, 0, -1, span, '#ffd76e');
        FX.trail(px.x, px.y, 0, 1, span, '#ffd76e');
        FX.sparkle(px.x, px.y, 8);
        break;
      case POWER.TNT:
        SFX.tnt();
        FX.ring(px.x, px.y, this.cell * 2.6, '#ffb347', 0.5);
        FX.flash(px.x, px.y, this.cell * 2, 'rgba(255,220,150,.9)', 0.35);
        FX.shards(px.x, px.y, ['#ff6b6b', '#ffd76e', '#ffffff', '#8d1f22'], 26, 1.3);
        break;
      case POWER.LIGHT: {
        SFX.light();
        FX.flash(px.x, px.y, this.cell * 2.4, 'rgba(255,255,255,.95)', 0.4);
        const targets = this.board.blastCells(act).slice(0, 30);
        for (const p of targets) {
          const q = this.cellToPx(p.c, p.r);
          FX.zap(px.x, px.y, q.x, q.y, '#ffe9a3', 0.4);
        }
        break;
      }
      case 'cross':
        SFX.rocket();
        FX.trail(px.x, px.y, -1, 0, span, '#ffd76e');
        FX.trail(px.x, px.y, 1, 0, span, '#ffd76e');
        FX.trail(px.x, px.y, 0, -1, span, '#ffd76e');
        FX.trail(px.x, px.y, 0, 1, span, '#ffd76e');
        FX.ring(px.x, px.y, this.cell * 1.6, '#fff3c0', 0.4);
        break;
      case 'bigCross':
        SFX.rocket(); SFX.tnt();
        for (let i = -1; i <= 1; i++) {
          const q = this.cellToPx(act.c, act.r + i);
          FX.trail(q.x, q.y, -1, 0, span, '#ffd76e');
          FX.trail(q.x, q.y, 1, 0, span, '#ffd76e');
          const s = this.cellToPx(act.c + i, act.r);
          FX.trail(s.x, s.y, 0, -1, span, '#ffd76e');
          FX.trail(s.x, s.y, 0, 1, span, '#ffd76e');
        }
        FX.ring(px.x, px.y, this.cell * 3, '#ffb347', 0.55);
        break;
      case 'mega':
        SFX.tnt();
        FX.ring(px.x, px.y, this.cell * 4, '#ffb347', 0.6);
        FX.ring(px.x, px.y, this.cell * 2.4, '#fff3c0', 0.45);
        FX.flash(px.x, px.y, this.cell * 3.2, 'rgba(255,220,150,.95)', 0.45);
        FX.shards(px.x, px.y, ['#ff6b6b', '#ffd76e', '#ffffff'], 40, 1.6);
        break;
      case 'rainbow':
        SFX.light();
        FX.flash(px.x, px.y, this.cell * 4, 'rgba(255,255,255,.95)', 0.5);
        FX.ring(px.x, px.y, this.cell * 5, '#ffffff', 0.6);
        break;
      default:
        FX.sparkle(px.x, px.y, 8);
        break;
    }
  }

  // ------------------------------------------------------------- combos

  /* Power-up + power-up (or light ball + anything) special interactions. */
  buildCombo(a, b) {
    const ga = this.board.gemAt(a.r, a.c);
    const gb = this.board.gemAt(b.r, b.c);
    if (!ga || !gb) return null;
    if (!ga.power && !gb.power) return null;

    const at = b;   // detonate where the player dropped the piece
    const other = a;
    const consume = (p, g) => {
      const cell = this.board.cellAt(p.r, p.c);
      if (cell && cell.gem === g) { cell.gem = null; g.dying = true; }
    };

    const aIsLight = ga.power === POWER.LIGHT;
    const bIsLight = gb.power === POWER.LIGHT;

    // ---- light ball combos
    if (aIsLight || bIsLight) {
      const lightPos = aIsLight ? a : b;
      const lightGem = aIsLight ? ga : gb;
      const partnerPos = aIsLight ? b : a;
      const partnerGem = aIsLight ? gb : ga;

      // two light balls: clear everything
      if (aIsLight && bIsLight) {
        consume(a, ga); consume(b, gb);
        const cells = [];
        this.board.eachGem((g, r, c) => cells.push({ r, c }));
        return [{ r: at.r, c: at.c, cells, visual: 'rainbow', power: POWER.LIGHT }];
      }

      // light ball + rocket / TNT: convert a whole colour, then fire it all
      if (partnerGem.power === POWER.ROCKET_H || partnerGem.power === POWER.ROCKET_V || partnerGem.power === POWER.TNT) {
        consume(lightPos, lightGem);
        consume(partnerPos, partnerGem);
        const target = partnerGem.color >= 0 ? partnerGem.color : this.board.mostCommonColor();
        const acts = [];
        this.board.eachGem((g, r, c) => {
          if (g.color !== target || g.power || g.locked) return;
          g.power = partnerGem.power === POWER.TNT
            ? POWER.TNT
            : (Math.random() < .5 ? POWER.ROCKET_H : POWER.ROCKET_V);
          g.triggered = true;
          acts.push({ r, c, gem: g, power: g.power, color: g.color });
        });
        FX.flash(this.cellToPx(at.c, at.r).x, this.cellToPx(at.c, at.r).y, this.cell * 3, 'rgba(255,255,255,.9)', 0.4);
        if (!acts.length) acts.push({ r: at.r, c: at.c, cells: [], visual: 'rainbow', power: POWER.LIGHT });
        return acts;
      }

      // light ball + plain gem: sweep that colour off the board
      const target = partnerGem.color;
      consume(lightPos, lightGem);
      consume(partnerPos, partnerGem);
      const cells = [];
      this.board.eachGem((g, r, c) => { if (g.color === target || g.power) cells.push({ r, c }); });
      return [{ r: lightPos.r, c: lightPos.c, cells, visual: POWER.LIGHT, power: POWER.LIGHT, targetColor: target }];
    }

    // ---- rocket / TNT pairs
    if (ga.power && gb.power) {
      const isRocket = g => g.power === POWER.ROCKET_H || g.power === POWER.ROCKET_V;
      consume(a, ga); consume(b, gb);
      const cells = [];
      const push = (r, c) => { if (this.board.inBounds(r, c) && !this.board.isVoid(r, c)) cells.push({ r, c }); };

      if (isRocket(ga) && isRocket(gb)) {
        for (let c = 0; c < this.board.cols; c++) push(at.r, c);
        for (let r = 0; r < this.board.rows; r++) push(r, at.c);
        return [{ r: at.r, c: at.c, cells, visual: 'cross', power: POWER.ROCKET_H }];
      }
      if (ga.power === POWER.TNT && gb.power === POWER.TNT) {
        for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) push(at.r + dr, at.c + dc);
        return [{ r: at.r, c: at.c, cells, visual: 'mega', power: POWER.TNT }];
      }
      // rocket + TNT: three full rows and three full columns
      for (let i = -1; i <= 1; i++) {
        for (let c = 0; c < this.board.cols; c++) push(at.r + i, c);
        for (let r = 0; r < this.board.rows; r++) push(r, at.c + i);
      }
      return [{ r: at.r, c: at.c, cells, visual: 'bigCross', power: POWER.TNT }];
    }

    void other;
    return null;
  }

  // ------------------------------------------------------------- gravity

  async settle() {
    let guard = 0;
    while (guard++ < 40) {
      const moved = this.board.settleStep();
      const spawned = this.board.refillStep();
      if (!moved.length && !spawned.length) break;
      await this.animateDrop();
    }
  }

  /* Everything whose render position no longer matches its cell falls. */
  animateDrop() {
    const items = [];
    let maxDist = 0;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const gem = this.board.cells[r][c].gem;
        if (!gem) continue;
        const dx = c - gem.x, dy = r - gem.y;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) continue;
        items.push({ gem, x0: gem.x, y0: gem.y, x1: c, y1: r });
        maxDist = Math.max(maxDist, Math.hypot(dx, dy));
      }
    }
    if (!items.length) return Promise.resolve();

    const dur = Utils.clamp(110 + maxDist * 52, 130, 430);
    const fall = t => t * t * 0.72 + t * 0.28;
    SFX.land();
    return this.tween(dur, p => {
      for (const it of items) {
        it.gem.x = Utils.lerp(it.x0, it.x1, p);
        it.gem.y = Utils.lerp(it.y0, it.y1, p);
      }
    }, fall);
  }

  // -------------------------------------------------------------- scoring

  consumeEvents() {
    const mult = Math.min(this.cascade || 1, 6);
    for (const ev of this.board.takeEvents()) {
      const px = this.cellToPx(ev.c, ev.r);
      switch (ev.type) {
        case 'clear': {
          const gem = ev.gem;
          gem.x = ev.c; gem.y = ev.r;
          this.dying.push(gem);
          this.tweenProps(gem, { scale: 0.05, alpha: 0 }, 230, Utils.easeInQuad).then(() => {
            const i = this.dying.indexOf(gem);
            if (i >= 0) this.dying.splice(i, 1);
          });
          FX.burst(px.x, px.y, gem.color < 0 ? 3 : gem.color, 9);
          this.addScore(60 * mult);
          if (gem.color >= 0) this.progressGoal('color', gem.color);
          break;
        }
        case 'crateHit':
          SFX.crate();
          FX.shards(px.x, px.y, ['#d19a5b', '#a86c33', '#7a4a1d'], 10);
          this.addScore(80 * mult);
          this.progressGoal('crate');
          break;
        case 'crateBreak':
          SFX.crate();
          FX.shards(px.x, px.y, ['#d19a5b', '#a86c33', '#7a4a1d', '#ffd76e'], 18, 1.2);
          this.addScore(120 * mult);
          this.progressGoal('crate');
          break;
        case 'iceBreak':
          SFX.ice();
          FX.shards(px.x, px.y, ['#d6f4ff', '#96d6ff', '#ffffff'], 14, 1.1);
          this.addScore(100 * mult);
          this.progressGoal('ice');
          break;
        case 'chainBreak':
          SFX.chain();
          FX.shards(px.x, px.y, ['#9aa6bd', '#4a5468', '#2c3242'], 12, 1.1);
          this.addScore(100 * mult);
          this.progressGoal('chain');
          break;
      }
    }
    this.emitHud();
  }

  addScore(points, px, label) {
    this.score += points;
    if (px && label) FX.float(px.x, px.y, label, '#fff3c0', Math.max(14, this.cell * 0.42));
  }

  progressGoal(type, color) {
    const goal = this.goals.find(g => g.type === type && (type !== 'color' || g.color === color) && g.done < g.count);
    if (!goal) return;
    goal.done++;
    if (this.hooks.onGoal) this.hooks.onGoal(goal);
  }

  goalsComplete() { return this.goals.every(g => g.done >= g.count); }

  emitHud() {
    if (this.hooks.onHud) this.hooks.onHud({
      moves: this.movesLeft,
      score: this.score,
      goals: this.goals,
    });
  }

  // -------------------------------------------------------------- endings

  async winSequence() {
    this.state = 'ending';
    this.showBanner('Level Complete!');
    SFX.win();
    Native.haptic('success');
    await this.delay(900);
    this.hideBanner();

    // Leftover moves turn into rockets and fire — the classic finale.
    if (this.movesLeft > 0) {
      this.showBanner('Move Bonus!');
      await this.delay(500);
      const acts = [];
      while (this.movesLeft > 0) {
        const candidates = [];
        this.board.eachGem((g, r, c) => { if (!g.power && !g.locked) candidates.push({ g, r, c }); });
        if (!candidates.length) break;
        const pick = Utils.pick(candidates);
        pick.g.power = Math.random() < .5 ? POWER.ROCKET_H : POWER.ROCKET_V;
        pick.g.triggered = true;
        pick.g.scale = 0.3;
        this.tweenProps(pick.g, { scale: 1 }, 200, Utils.easeOutBack);
        acts.push({ r: pick.r, c: pick.c, gem: pick.g, power: pick.g.power, color: pick.g.color });
        this.movesLeft--;
        this.emitHud();
        SFX.select();
        await this.delay(70);
      }
      this.hideBanner();
      await this.delay(200);
      // fire them a few at a time so the screen stays readable
      for (let i = 0; i < acts.length; i += 3) {
        await this.detonate(acts.slice(i, i + 3));
        await this.settle();
      }
      await this.resolve(null);
    }

    await this.delay(400);
    this.state = 'over';
    const stars = this.starsEarned();
    if (this.hooks.onWin) this.hooks.onWin({ score: this.score, stars, level: this.level });
  }

  async loseSequence() {
    this.state = 'over';
    this.showBanner('Out of Moves!');
    SFX.lose();
    Native.haptic('error');
    await this.delay(1100);
    this.hideBanner();
    if (this.hooks.onLose) this.hooks.onLose({ score: this.score, level: this.level, goals: this.goals });
  }

  starsEarned() {
    const t = this.level.starScores;
    let stars = 1;
    if (this.score >= t[1]) stars = 2;
    if (this.score >= t[2]) stars = 3;
    return stars;
  }

  /* Used by the "keep playing" purchase on the lose screen. */
  grantMoves(n) {
    this.movesLeft += n;
    this.state = 'playing';
    this.busy = false;
    this.emitHud();
  }

  // ------------------------------------------------------------- boosters

  armBooster(type) {
    this.armedBooster = this.armedBooster === type ? null : type;
    return this.armedBooster;
  }

  async useBooster(p) {
    const type = this.armedBooster;
    if (!type || !this.board.inBounds(p.r, p.c)) return;
    if (this.busy || this.state !== 'playing') return;

    const cell = this.board.cellAt(p.r, p.c);
    if (!cell || cell.void) return;
    if (type !== 'hammer' && (!cell.gem || cell.gem.locked)) {
      if (this.hooks.onToast) this.hooks.onToast('Pick a free gem');
      return;
    }
    if (type === 'hammer' && !cell.gem && !cell.blocker) return;

    if (this.hooks.onBoosterUsed && !this.hooks.onBoosterUsed(type)) return;

    this.armedBooster = null;
    if (this.hooks.onBoosterDone) this.hooks.onBoosterDone();
    this.busy = true;
    this.hint = null;

    if (type === 'hammer') {
      const px = this.cellToPx(p.c, p.r);
      FX.flash(px.x, px.y, this.cell, 'rgba(255,255,255,.9)', 0.3);
      this.shake(7, 0.25);
      const trigger = this.board.damage(p.r, p.c, { cause: 'booster' });
      this.consumeEvents();
      await this.delay(200);
      if (trigger) await this.detonate([trigger]);
    } else {
      const gem = cell.gem;
      gem.power = type === 'tnt' ? POWER.TNT : (Math.random() < .5 ? POWER.ROCKET_H : POWER.ROCKET_V);
      gem.triggered = true;
      gem.scale = 0.3;
      await this.tweenProps(gem, { scale: 1 }, 240, Utils.easeOutBack);
      await this.detonate([{ r: p.r, c: p.c, gem, power: gem.power, color: gem.color }]);
    }

    await this.settle();
    await this.resolve(null);
    await this.finishTurn();
  }

  // ---------------------------------------------------------------- hints

  showHint() {
    const moves = this.board.findAllMoves();
    if (!moves.length) return;
    this.hint = Utils.pick(moves);
  }

  shake(mag, dur) {
    this.shakeMag = mag;
    this.shakeUntil = this.time + dur;
  }

  showBanner(text) { if (this.hooks.onBanner) this.hooks.onBanner(text); }
  hideBanner() { if (this.hooks.onBanner) this.hooks.onBanner(null); }

  // --------------------------------------------------------------- render

  render() {
    const ctx = this.ctx;
    if (!this.board) return;
    const w = this.cell * this.board.cols;
    const h = this.cell * this.board.rows;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();

    if (this.time < this.shakeUntil) {
      const k = (this.shakeUntil - this.time) / 0.3;
      ctx.translate(Utils.rand(-1, 1) * this.shakeMag * k, Utils.rand(-1, 1) * this.shakeMag * k);
    }

    this.drawCells(ctx);

    // gems are clipped to the grid so pieces falling in are hidden
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.ox, this.oy, w, h);
    ctx.clip();
    this.drawGems(ctx);
    ctx.restore();

    this.drawHighlights(ctx);
    FX.draw(ctx);
    ctx.restore();
  }

  drawCells(ctx) {
    const cell = this.cell;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const info = this.board.cells[r][c];
        if (info.void) continue;
        const x = this.ox + c * cell, y = this.oy + r * cell;
        ctx.save();
        ctx.beginPath();
        const rad = cell * 0.16;
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + cell, y, x + cell, y + cell, rad);
        ctx.arcTo(x + cell, y + cell, x, y + cell, rad);
        ctx.arcTo(x, y + cell, x, y, rad);
        ctx.arcTo(x, y, x + cell, y, rad);
        ctx.closePath();
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.045)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawGems(ctx) {
    const cell = this.cell;

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const info = this.board.cells[r][c];
        if (info.void) continue;
        const px = this.cellToPx(c, r);
        if (info.blocker) {
          if (info.blocker.type === 'stone') Art.drawStone(ctx, px.x, px.y, cell);
          else Art.drawCrate(ctx, px.x, px.y, cell, info.blocker.hp, info.blocker.maxHp);
        }
      }
    }

    const drawGem = (gem) => {
      const px = this.cellToPx(gem.x, gem.y);
      const opts = { alpha: gem.alpha, scale: gem.scale, rot: gem.spin };
      if (gem.power === POWER.ROCKET_H || gem.power === POWER.ROCKET_V) {
        ctx.save();
        ctx.globalAlpha = gem.alpha;
        ctx.translate(px.x, px.y);
        ctx.scale(gem.scale, gem.scale);
        Art.drawRocket(ctx, 0, 0, cell, gem.color, gem.power === POWER.ROCKET_V);
        ctx.restore();
      } else if (gem.power === POWER.TNT) {
        ctx.save();
        ctx.globalAlpha = gem.alpha;
        ctx.translate(px.x, px.y);
        ctx.scale(gem.scale, gem.scale);
        Art.drawTNT(ctx, 0, 0, cell, this.time);
        ctx.restore();
      } else if (gem.power === POWER.LIGHT) {
        ctx.save();
        ctx.globalAlpha = gem.alpha;
        ctx.translate(px.x, px.y);
        ctx.scale(gem.scale, gem.scale);
        Art.drawLightBall(ctx, 0, 0, cell, this.time);
        ctx.restore();
      } else {
        Art.drawGem(ctx, px.x, px.y, cell, gem.color, opts);
      }

      if (gem.chain > 0) Art.drawChain(ctx, px.x, px.y, cell * gem.scale);
      if (gem.ice > 0) Art.drawIce(ctx, px.x, px.y, cell * gem.scale, gem.ice);
    };

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const gem = this.board.cells[r][c].gem;
        if (gem) drawGem(gem);
      }
    }
    for (const gem of this.dying) drawGem(gem);
  }

  drawHighlights(ctx) {
    const cell = this.cell;
    const outline = (r, c, color, width, inset) => {
      const x = this.ox + c * cell + inset, y = this.oy + r * cell + inset;
      const s = cell - inset * 2;
      const rad = cell * 0.2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + s, y, x + s, y + s, rad);
      ctx.arcTo(x + s, y + s, x, y + s, rad);
      ctx.arcTo(x, y + s, x, y, rad);
      ctx.arcTo(x, y, x + s, y, rad);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.restore();
    };

    if (this.selected) {
      const pulse = 0.6 + Math.sin(this.time * 8) * 0.25;
      outline(this.selected.r, this.selected.c, `rgba(255,255,255,${pulse})`, 3, 2);
    }

    if (this.hint && this.state === 'playing' && !this.busy) {
      const pulse = 0.35 + Math.sin(this.time * 5) * 0.3;
      outline(this.hint.a.r, this.hint.a.c, `rgba(255,214,90,${pulse})`, 3, 3);
      if (this.hint.b) outline(this.hint.b.r, this.hint.b.c, `rgba(255,214,90,${pulse})`, 3, 3);
    }

    if (this.armedBooster) {
      const pulse = 0.25 + Math.sin(this.time * 6) * 0.12;
      ctx.save();
      ctx.fillStyle = `rgba(255,214,90,${pulse})`;
      ctx.fillRect(this.ox, this.oy, cell * this.board.cols, cell * this.board.rows);
      ctx.restore();
    }
  }
}
