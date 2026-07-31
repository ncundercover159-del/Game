'use strict';

const POWER = {
  ROCKET_H: 'rocketH',
  ROCKET_V: 'rocketV',
  TNT: 'tnt',
  LIGHT: 'light',
};

let __gemSeq = 0;

class Gem {
  constructor(color, power = null) {
    this.id = ++__gemSeq;
    this.color = color;      // 0..5, or -1 for the colourless light ball
    this.power = power;      // null | POWER.*
    this.ice = 0;            // frost layers; absorb one hit each
    this.chain = 0;          // chain links; absorb one hit each
    this.x = 0;              // render position in cell units (col)
    this.y = 0;              // render position in cell units (row)
    this.scale = 1;
    this.alpha = 1;
    this.spin = 0;
    this.triggered = false;  // power already fired, awaiting removal
    this.dying = false;
  }

  get locked() { return this.ice > 0 || this.chain > 0; }
}

/* Pure board state + rules. All visuals/animation live in Game; the board
 * only reports what happened through `events`. */
class Board {
  constructor(level) {
    this.level = level;
    this.rows = level.rows;
    this.cols = level.cols;
    this.colors = level.colors;
    this.events = [];
    this.cells = [];

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({ void: false, blocker: null, gem: null });
      }
      this.cells.push(row);
    }

    this.applyLayout(level.layout);
    this.computeSpawners();
    this.fillInitial();
  }

  // ------------------------------------------------------------- setup

  applyLayout(layout) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = layout[r][c];
        const cell = this.cells[r][c];
        switch (ch) {
          case '#': case ' ':
            cell.void = true; break;
          case 'X':
            cell.blocker = { type: 'stone', hp: Infinity, maxHp: Infinity }; break;
          case 'b':
            cell.blocker = { type: 'crate', hp: 1, maxHp: 1 }; break;
          case 'B':
            cell.blocker = { type: 'crate', hp: 2, maxHp: 2 }; break;
          case 'i':
            cell.pendingIce = 1; break;
          case 'I':
            cell.pendingIce = 2; break;
          case 'c':
            cell.pendingChain = 1; break;
          default:
            if (ch >= '1' && ch <= '6') cell.pendingColor = Number(ch) - 1;
            break;
        }
      }
    }
  }

  /* A column refills from its topmost playable cell, as long as only void
   * cells sit above it. A blocker at the top seals the column. */
  computeSpawners() {
    this.spawners = [];
    for (let c = 0; c < this.cols; c++) {
      let spawn = -1;
      for (let r = 0; r < this.rows; r++) {
        const cell = this.cells[r][c];
        if (cell.void) continue;
        if (cell.blocker) break;
        spawn = r;
        break;
      }
      this.spawners.push(spawn);
    }
  }

  fillInitial() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.void || cell.blocker) continue;
        const gem = new Gem(cell.pendingColor !== undefined ? cell.pendingColor : this.safeColor(r, c));
        gem.ice = cell.pendingIce || 0;
        gem.chain = cell.pendingChain || 0;
        gem.x = c; gem.y = r;
        cell.gem = gem;
      }
    }
    // Guarantee the opening board has something to do.
    let guard = 0;
    while (this.findMatches().length && guard++ < 40) this.rerollMatches();
    guard = 0;
    while (!this.findAllMoves().length && guard++ < 40) this.shuffleBoard();
  }

  /* Pick a colour that cannot complete a line with what is already placed. */
  safeColor(r, c) {
    const banned = new Set();
    const g1 = this.gemAt(r, c - 1), g2 = this.gemAt(r, c - 2);
    if (g1 && g2 && g1.color === g2.color) banned.add(g1.color);
    const v1 = this.gemAt(r - 1, c), v2 = this.gemAt(r - 2, c);
    if (v1 && v2 && v1.color === v2.color) banned.add(v1.color);
    const options = [];
    for (let i = 0; i < this.colors; i++) if (!banned.has(i)) options.push(i);
    return Utils.pick(options.length ? options : [Utils.randInt(0, this.colors - 1)]);
  }

  rerollMatches() {
    for (const group of this.findMatches()) {
      for (const p of group.cells) {
        const gem = this.gemAt(p.r, p.c);
        if (gem && !gem.power) gem.color = Utils.randInt(0, this.colors - 1);
      }
    }
  }

  // ------------------------------------------------------------ queries

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }

  cellAt(r, c) { return this.inBounds(r, c) ? this.cells[r][c] : null; }

  gemAt(r, c) { const cell = this.cellAt(r, c); return cell ? cell.gem : null; }

  /* Playable = part of the board and not occupied by a blocker. */
  isPlayable(r, c) {
    const cell = this.cellAt(r, c);
    return !!cell && !cell.void && !cell.blocker;
  }

  isVoid(r, c) { const cell = this.cellAt(r, c); return !cell || cell.void; }

  eachGem(fn) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const gem = this.cells[r][c].gem;
        if (gem) fn(gem, r, c);
      }
    }
  }

  countByColor() {
    const counts = new Array(this.colors).fill(0);
    this.eachGem(g => { if (g.color >= 0 && !g.power) counts[g.color]++; });
    return counts;
  }

  mostCommonColor() {
    const counts = this.countByColor();
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
    return best;
  }

  // ------------------------------------------------------------ matching

  /* Two gems match if both carry a real colour — light balls never do. */
  matchable(gem) { return !!gem && gem.color >= 0 && gem.power !== POWER.LIGHT && !gem.dying; }

  sameColor(a, b) { return this.matchable(a) && this.matchable(b) && a.color === b.color; }

  findRuns() {
    const runs = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const gem = this.gemAt(r, c);
        if (!this.matchable(gem)) { c++; continue; }
        let end = c + 1;
        while (end < this.cols && this.sameColor(this.gemAt(r, end), gem)) end++;
        if (end - c >= 3) runs.push({ dir: 'h', r, c, len: end - c, color: gem.color });
        c = end;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const gem = this.gemAt(r, c);
        if (!this.matchable(gem)) { r++; continue; }
        let end = r + 1;
        while (end < this.rows && this.sameColor(this.gemAt(end, c), gem)) end++;
        if (end - r >= 3) runs.push({ dir: 'v', r, c, len: end - r, color: gem.color });
        r = end;
      }
    }
    return runs;
  }

  runCells(run) {
    const out = [];
    for (let i = 0; i < run.len; i++) {
      out.push(run.dir === 'h' ? { r: run.r, c: run.c + i } : { r: run.r + i, c: run.c });
    }
    return out;
  }

  /* Overlapping runs (L and T shapes) are merged into a single group so
   * they award one combined power-up. */
  findMatches() {
    const runs = this.findRuns();
    if (!runs.length) return [];

    const owner = new Map();          // cell key -> run indices
    const cellsOf = runs.map(run => this.runCells(run));
    cellsOf.forEach((cells, i) => {
      for (const p of cells) {
        const key = p.r * this.cols + p.c;
        if (!owner.has(key)) owner.set(key, []);
        owner.get(key).push(i);
      }
    });

    const seen = new Array(runs.length).fill(false);
    const groups = [];
    for (let i = 0; i < runs.length; i++) {
      if (seen[i]) continue;
      const stack = [i];
      seen[i] = true;
      const groupRuns = [];
      const cellKeys = new Set();
      while (stack.length) {
        const ri = stack.pop();
        groupRuns.push(runs[ri]);
        for (const p of cellsOf[ri]) {
          const key = p.r * this.cols + p.c;
          cellKeys.add(key);
          for (const other of owner.get(key)) {
            if (!seen[other]) { seen[other] = true; stack.push(other); }
          }
        }
      }
      const cells = [...cellKeys].map(k => ({ r: Math.floor(k / this.cols), c: k % this.cols }));
      groups.push(this.describeGroup(groupRuns, cells));
    }
    return groups;
  }

  describeGroup(runs, cells) {
    let longest = runs[0];
    for (const run of runs) if (run.len > longest.len) longest = run;
    const hasH = runs.some(r => r.dir === 'h');
    const hasV = runs.some(r => r.dir === 'v');

    let power = null;
    if (longest.len >= 5) power = POWER.LIGHT;
    else if (hasH && hasV) power = POWER.TNT;
    else if (longest.len === 4) power = longest.dir === 'h' ? POWER.ROCKET_H : POWER.ROCKET_V;

    // Where the new power-up appears when the player did not pick the spot.
    let anchor = null;
    if (power === POWER.TNT && hasH && hasV) {
      const hRun = runs.find(r => r.dir === 'h');
      const vRun = runs.find(r => r.dir === 'v');
      const hCells = this.runCells(hRun);
      const vSet = new Set(this.runCells(vRun).map(p => p.r * this.cols + p.c));
      anchor = hCells.find(p => vSet.has(p.r * this.cols + p.c)) || null;
    }
    if (!anchor) {
      const mid = this.runCells(longest)[Math.floor(longest.len / 2)];
      anchor = mid;
    }

    return { runs, cells, color: longest.color, power, anchor, size: cells.length };
  }

  // ------------------------------------------------------------- moves

  /* Locked gems (ice/chain) and gems inside blockers cannot be dragged. */
  canSelect(r, c) {
    const gem = this.gemAt(r, c);
    return !!gem && !gem.locked && !gem.dying;
  }

  areAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  swapGems(a, b) {
    const ca = this.cellAt(a.r, a.c), cb = this.cellAt(b.r, b.c);
    const tmp = ca.gem;
    ca.gem = cb.gem;
    cb.gem = tmp;
  }

  /* A swap is legal if it forms a line, or if a power-up is involved
   * (rocket/TNT/light ball combos always fire). */
  isValidSwap(a, b) {
    if (!this.areAdjacent(a, b)) return false;
    if (!this.canSelect(a.r, a.c) || !this.canSelect(b.r, b.c)) return false;
    const ga = this.gemAt(a.r, a.c), gb = this.gemAt(b.r, b.c);
    if (!ga || !gb) return false;
    if (ga.power === POWER.LIGHT || gb.power === POWER.LIGHT) return true;
    if (ga.power && gb.power) return true;
    return this.wouldFormMatch(a, b);
  }

  wouldFormMatch(a, b) {
    this.swapGems(a, b);
    const ok = this.hasMatchAt(a.r, a.c) || this.hasMatchAt(b.r, b.c);
    this.swapGems(a, b);
    return ok;
  }

  hasMatchAt(r, c) {
    const gem = this.gemAt(r, c);
    if (!this.matchable(gem)) return false;
    let count = 1;
    for (let c2 = c - 1; c2 >= 0 && this.sameColor(this.gemAt(r, c2), gem); c2--) count++;
    for (let c2 = c + 1; c2 < this.cols && this.sameColor(this.gemAt(r, c2), gem); c2++) count++;
    if (count >= 3) return true;
    count = 1;
    for (let r2 = r - 1; r2 >= 0 && this.sameColor(this.gemAt(r2, c), gem); r2--) count++;
    for (let r2 = r + 1; r2 < this.rows && this.sameColor(this.gemAt(r2, c), gem); r2++) count++;
    return count >= 3;
  }

  findAllMoves() {
    const moves = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.canSelect(r, c)) continue;
        const gem = this.gemAt(r, c);
        // A tappable power-up is always a legal move on its own.
        if (gem.power && gem.power !== POWER.LIGHT) { moves.push({ a: { r, c }, b: null, tap: true }); continue; }
        const right = { r, c: c + 1 }, down = { r: r + 1, c };
        if (this.inBounds(right.r, right.c) && this.isValidSwap({ r, c }, right)) moves.push({ a: { r, c }, b: right });
        if (this.inBounds(down.r, down.c) && this.isValidSwap({ r, c }, down)) moves.push({ a: { r, c }, b: down });
      }
    }
    return moves;
  }

  /* Reshuffle every free gem until at least one move exists again. */
  shuffleBoard() {
    const free = [];
    this.eachGem((gem, r, c) => { if (!gem.locked && !gem.power) free.push({ gem, r, c }); });
    const colors = free.map(f => f.gem.color);
    Utils.shuffle(colors);
    free.forEach((f, i) => { f.gem.color = colors[i]; });

    let guard = 0;
    while ((this.findMatches().length || !this.findAllMoves().length) && guard++ < 60) {
      free.forEach(f => { f.gem.color = Utils.randInt(0, this.colors - 1); });
    }
  }

  // ------------------------------------------------------------- damage

  /* One unit of damage to a cell. Returns a power-up that should now fire,
   * or null. Everything else is reported through `events`. */
  damage(r, c, opts = {}) {
    const cell = this.cellAt(r, c);
    if (!cell || cell.void) return null;

    if (cell.blocker) {
      if (cell.blocker.type === 'stone') return null;
      cell.blocker.hp--;
      if (cell.blocker.hp <= 0) {
        cell.blocker = null;
        // A crate sitting at the top of a column seals it; once it is gone
        // that column can feed gems in again.
        this.computeSpawners();
        this.events.push({ type: 'crateBreak', r, c });
      } else {
        this.events.push({ type: 'crateHit', r, c });
      }
      return null;
    }

    const gem = cell.gem;
    if (!gem || gem.dying) return null;

    if (gem.chain > 0) {
      gem.chain--;
      this.events.push({ type: 'chainBreak', r, c });
      return null;
    }
    if (gem.ice > 0) {
      gem.ice--;
      this.events.push({ type: 'iceBreak', r, c, left: gem.ice });
      return null;
    }
    if (gem.power && !gem.triggered && !opts.noTrigger) {
      gem.triggered = true;
      return { r, c, gem, power: gem.power, color: gem.color };
    }

    cell.gem = null;
    gem.dying = true;
    this.events.push({ type: 'clear', r, c, gem, color: gem.color, cause: opts.cause || 'match' });
    this.damageNeighbourBlockers(r, c, opts);
    return null;
  }

  /* Crates break when a gem clears next to them, not on top of them. */
  damageNeighbourBlockers(r, c, opts = {}) {
    if (opts.noSplash) return;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const cell = this.cellAt(r + dr, c + dc);
      if (cell && cell.blocker && cell.blocker.type === 'crate') {
        this.damage(r + dr, c + dc, { noSplash: true });
      }
    }
  }

  // -------------------------------------------------------------- blasts

  /* Which cells a firing power-up hits. */
  blastCells(act) {
    if (act.cells) return act.cells;
    const out = [];
    const push = (r, c) => { if (this.inBounds(r, c) && !this.isVoid(r, c)) out.push({ r, c }); };

    switch (act.power) {
      case POWER.ROCKET_H:
        for (let c = 0; c < this.cols; c++) push(act.r, c);
        break;
      case POWER.ROCKET_V:
        for (let r = 0; r < this.rows; r++) push(r, act.c);
        break;
      case POWER.TNT: {
        const rad = act.radius || 2;
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) push(act.r + dr, act.c + dc);
        }
        break;
      }
      case POWER.LIGHT: {
        const target = act.targetColor === undefined ? this.mostCommonColor() : act.targetColor;
        this.eachGem((gem, r, c) => {
          if (gem.color === target || gem.power) push(r, c);
        });
        break;
      }
    }
    return out;
  }

  // ------------------------------------------------------------- gravity

  /* One settle pass. Gems drop straight down within their column segment,
   * then slide diagonally past blockers, then the top is refilled.
   * Returns the list of gems that moved (for animation). */
  settleStep() {
    const moved = [];

    // 1. straight fall, respecting blockers and voids as floors
    for (let c = 0; c < this.cols; c++) {
      let dest = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const cell = this.cells[r][c];
        if (cell.void || cell.blocker) { dest = r - 1; continue; }
        if (cell.gem) {
          if (dest !== r) {
            const gem = cell.gem;
            cell.gem = null;
            this.cells[dest][c].gem = gem;
            moved.push(gem);
          }
          dest--;
        }
      }
    }

    // 2. diagonal slide into cells that have no supply straight above
    for (let r = this.rows - 1; r >= 1; r--) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.void || cell.blocker || cell.gem) continue;
        const above = this.cells[r - 1][c];
        const suppliedFromAbove = !above.void && !above.blocker;
        if (suppliedFromAbove) continue;

        for (const dc of (Math.random() < .5 ? [-1, 1] : [1, -1])) {
          const src = this.cellAt(r - 1, c + dc);
          if (!src || src.void || src.blocker || !src.gem) continue;
          const gem = src.gem;
          src.gem = null;
          cell.gem = gem;
          moved.push(gem);
          break;
        }
      }
    }

    return moved;
  }

  /* Drops new gems in from above every open spawner column. */
  refillStep() {
    const spawned = [];
    for (let c = 0; c < this.cols; c++) {
      const top = this.spawners[c];
      if (top < 0) continue;
      // contiguous empties from the spawner downwards
      const targets = [];
      for (let r = top; r < this.rows; r++) {
        const cell = this.cells[r][c];
        if (cell.void || cell.blocker) break;
        if (cell.gem) break;
        targets.push(r);
      }
      if (!targets.length) continue;
      // fill bottom-up so the stack above the board is ordered naturally
      for (let i = targets.length - 1; i >= 0; i--) {
        const r = targets[i];
        const gem = new Gem(Utils.randInt(0, this.colors - 1));
        gem.x = c;
        gem.y = top - (targets.length - i);   // starts above the board
        this.cells[r][c].gem = gem;
        spawned.push(gem);
      }
    }
    return spawned;
  }

  isSettled() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (!cell.void && !cell.blocker && !cell.gem) return false;
      }
    }
    return true;
  }

  /* Remaining obstacles, used to decide whether goals can still be met. */
  countRemaining() {
    let crate = 0, ice = 0, chain = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.blocker && cell.blocker.type === 'crate') crate += cell.blocker.hp;
        if (cell.gem) { ice += cell.gem.ice; chain += cell.gem.chain; }
      }
    }
    return { crate, ice, chain };
  }

  takeEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
