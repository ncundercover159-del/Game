'use strict';

/* ------------------------------------------------------------------ *
 * Level definitions.
 *
 * Layout characters (one per cell, every row must be the same length):
 *   .  playable cell, filled with a random gem
 *   #  void — not part of the board
 *   X  stone wall (never breaks, blocks falling gems)
 *   b  crate, 1 hit      B  crate, 2 hits
 *   i  gem in ice, 1 layer      I  gem in ice, 2 layers
 *   c  gem wrapped in a chain
 *
 * A column's playable cells must be vertically contiguous so that gems
 * can always reach them; `Levels.validate()` checks this at boot.
 * ------------------------------------------------------------------ */

const Levels = {
  GOAL_LABELS: {
    color: 'Collect',
    crate: 'Crates',
    ice: 'Ice',
    chain: 'Chains',
  },

  RAW: [
    // 1 — gentle introduction
    {
      moves: 20, colors: 5,
      goals: [{ type: 'color', color: 0, count: 20 }],
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    // 2 — two colours at once
    {
      moves: 22, colors: 5,
      goals: [
        { type: 'color', color: 1, count: 18 },
        { type: 'color', color: 2, count: 18 },
      ],
      layout: [
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
      ],
    },
    // 3 — meet the crates
    {
      moves: 24, colors: 5,
      goals: [{ type: 'crate', count: 'all' }],
      layout: [
        '.........',
        '.bb...bb.',
        '.........',
        '....b....',
        '...bbb...',
        '....b....',
        '.........',
        '.bb...bb.',
        '.........',
      ],
    },
    // 4 — frozen ring
    {
      moves: 26, colors: 5,
      goals: [{ type: 'ice', count: 'all' }],
      layout: [
        '.........',
        '..iiiii..',
        '..i...i..',
        '..i...i..',
        '..i...i..',
        '..i...i..',
        '..iiiii..',
        '.........',
        '.........',
      ],
    },
    // 5 — chained treasure
    {
      moves: 22, colors: 5,
      goals: [
        { type: 'chain', count: 'all' },
        { type: 'color', color: 3, count: 15 },
      ],
      layout: [
        '.........',
        '.........',
        '..ccccc..',
        '.........',
        '..c...c..',
        '.........',
        '..ccccc..',
        '.........',
        '.........',
      ],
    },
    // 6 — stone pillars
    {
      moves: 25, colors: 5,
      goals: [
        { type: 'color', color: 3, count: 22 },
        { type: 'color', color: 4, count: 22 },
      ],
      layout: [
        '.........',
        '..X...X..',
        '.........',
        'X.......X',
        '.........',
        'X.......X',
        '.........',
        '..X...X..',
        '.........',
      ],
    },
    // 7 — crates on ice
    {
      moves: 26, colors: 5,
      goals: [
        { type: 'crate', count: 'all' },
        { type: 'ice', count: 'all' },
      ],
      layout: [
        '.........',
        '.iii.iii.',
        '.bb...bb.',
        '.........',
        '...bbb...',
        '.........',
        '.bb...bb.',
        '.iii.iii.',
        '.........',
      ],
    },
    // 8 — the royal diamond
    {
      moves: 24, colors: 5,
      goals: [
        { type: 'color', color: 0, count: 20 },
        { type: 'color', color: 3, count: 20 },
      ],
      layout: [
        '###...###',
        '##.....##',
        '#.......#',
        '.........',
        '.........',
        '.........',
        '#.......#',
        '##.....##',
        '###...###',
      ],
    },
    // 9 — the cross
    {
      moves: 26, colors: 5,
      goals: [
        { type: 'crate', count: 'all' },
        { type: 'chain', count: 'all' },
      ],
      layout: [
        '###...###',
        '###.c.###',
        '..bb.bb..',
        '.........',
        '....c....',
        '.........',
        '..bb.bb..',
        '###.c.###',
        '###...###',
      ],
    },
    // 10 — deep freeze
    {
      moves: 26, colors: 5,
      goals: [{ type: 'ice', count: 'all' }],
      layout: [
        '.........',
        '.........',
        '..IIIII..',
        '..I...I..',
        '..I.X.I..',
        '..I...I..',
        '..IIIII..',
        '.........',
        '.........',
      ],
    },
    // 11 — reinforced crates
    {
      moves: 28, colors: 5,
      goals: [{ type: 'crate', count: 'all' }],
      layout: [
        '.........',
        '..BB.BB..',
        '..BB.BB..',
        '.........',
        '.........',
        '.........',
        '..BB.BB..',
        '..BB.BB..',
        '.........',
      ],
    },
    // 12 — the goblet
    {
      moves: 26, colors: 6,
      goals: [
        { type: 'color', color: 1, count: 24 },
        { type: 'color', color: 4, count: 24 },
      ],
      layout: [
        '..#...#..',
        '..#...#..',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.#.....#.',
        '.#.....#.',
      ],
    },
    // 13 — three of a kind
    {
      moves: 30, colors: 6,
      goals: [
        { type: 'color', color: 0, count: 20 },
        { type: 'color', color: 2, count: 20 },
        { type: 'color', color: 5, count: 20 },
      ],
      layout: [
        '.........',
        '.........',
        '.X.....X.',
        '.........',
        '.........',
        '.........',
        '.X.....X.',
        '.........',
        '.........',
      ],
    },
    // 14 — castle walls
    {
      moves: 28, colors: 5,
      goals: [
        { type: 'crate', count: 'all' },
        { type: 'ice', count: 'all' },
      ],
      layout: [
        '.#.#.#.#.',
        '.........',
        '.iBiBiBi.',
        '.........',
        '..X...X..',
        '.........',
        '.bbb.bbb.',
        '.........',
        '.........',
      ],
    },
    // 15 — the king's vault
    {
      moves: 30, colors: 6,
      goals: [
        { type: 'crate', count: 'all' },
        { type: 'chain', count: 'all' },
        { type: 'ice', count: 'all' },
      ],
      layout: [
        '##.....##',
        '#.......#',
        '.ccIIIcc.',
        '.b.....b.',
        '.b..X..b.',
        '.b.....b.',
        '.ccIIIcc.',
        '#.......#',
        '##.....##',
      ],
    },
  ],

  /* Templates reused (with harder goals) once the handmade levels run out. */
  TEMPLATES: [
    ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'],
    ['###...###', '##.....##', '#.......#', '.........', '.........', '.........', '#.......#', '##.....##', '###...###'],
    ['.........', '..X...X..', '.........', 'X.......X', '.........', 'X.......X', '.........', '..X...X..', '.........'],
    ['###...###', '###...###', '.........', '.........', '.........', '.........', '.........', '###...###', '###...###'],
    ['.........', '.bb...bb.', '.........', '....b....', '...bbb...', '....b....', '.........', '.bb...bb.', '.........'],
    ['.........', '..iiiii..', '..i...i..', '..i...i..', '..i...i..', '..i...i..', '..iiiii..', '.........', '.........'],
    ['.........', '.........', '..ccccc..', '.........', '..c...c..', '.........', '..ccccc..', '.........', '.........'],
    ['..#...#..', '..#...#..', '.........', '.........', '.........', '.........', '.........', '.#.....#.', '.#.....#.'],
  ],

  _cache: new Map(),

  /* Levels past the handmade set are generated deterministically from `n`. */
  generate(n) {
    const rng = Utils.mulberry32(n * 9176 + 13);
    const layout = this.TEMPLATES[Math.floor(rng() * this.TEMPLATES.length)].slice();
    const tier = n - this.RAW.length;
    const colors = rng() < 0.45 ? 6 : 5;
    const moves = 22 + Math.floor(rng() * 8) - Math.min(6, Math.floor(tier / 8));

    const counts = this.countObstacles(layout);
    const goals = [];
    if (counts.crate) goals.push({ type: 'crate', count: 'all' });
    if (counts.ice) goals.push({ type: 'ice', count: 'all' });
    if (counts.chain) goals.push({ type: 'chain', count: 'all' });
    if (goals.length < 2) {
      const used = new Set();
      const extra = goals.length ? 1 : 2;
      for (let i = 0; i < extra; i++) {
        let col;
        do { col = Math.floor(rng() * colors); } while (used.has(col));
        used.add(col);
        goals.push({ type: 'color', color: col, count: 18 + Math.floor(tier * 0.6) + Math.floor(rng() * 8) });
      }
    }
    return { moves: Math.max(16, moves), colors, goals, layout };
  },

  countObstacles(layout) {
    const c = { crate: 0, ice: 0, chain: 0 };
    for (const row of layout) {
      for (const ch of row) {
        if (ch === 'b') c.crate += 1;
        else if (ch === 'B') c.crate += 2;
        else if (ch === 'i') c.ice += 1;
        else if (ch === 'I') c.ice += 2;
        else if (ch === 'c') c.chain += 1;
      }
    }
    return c;
  },

  /* Returns a fully normalised, immutable-ish level description. */
  get(id) {
    if (this._cache.has(id)) return this._cache.get(id);

    const raw = id <= this.RAW.length ? this.RAW[id - 1] : this.generate(id);
    const layout = raw.layout.slice();
    const rows = layout.length;
    const cols = layout[0].length;
    const counts = this.countObstacles(layout);

    const goals = raw.goals.map(g => {
      const goal = Object.assign({}, g);
      if (goal.count === 'all') goal.count = counts[goal.type] || 0;
      return goal;
    }).filter(g => g.count > 0);

    const base = raw.moves * 420;
    const level = {
      id,
      rows, cols, layout,
      moves: raw.moves,
      colors: raw.colors || 5,
      goals,
      starScores: raw.starScores || [Math.round(base * 0.45), Math.round(base * 0.8), Math.round(base * 1.2)],
    };
    this._cache.set(id, level);
    return level;
  },

  /* Sanity check run once at boot — catches ragged rows and unreachable
   * cells that would let the board deadlock. */
  validate() {
    const problems = [];
    const check = (label, layout) => {
      const cols = layout[0].length;
      layout.forEach((row, r) => {
        if (row.length !== cols) problems.push(`${label}: row ${r} has ${row.length} cells, expected ${cols}`);
      });
      for (let c = 0; c < cols; c++) {
        let seenPlayable = false, gapAfter = false;
        for (let r = 0; r < layout.length; r++) {
          const ch = layout[r][c];
          const isVoid = ch === '#' || ch === ' ';
          if (isVoid) { if (seenPlayable) gapAfter = true; }
          else {
            if (gapAfter) { problems.push(`${label}: column ${c} is split by a gap — cells below row ${r} can never be filled`); break; }
            seenPlayable = true;
          }
        }
      }
    };
    this.RAW.forEach((lv, i) => check('level ' + (i + 1), lv.layout));
    this.TEMPLATES.forEach((t, i) => check('template ' + i, t));

    // A goal asking for a colour the level never spawns is unwinnable.
    this.RAW.forEach((lv, i) => {
      const colors = lv.colors || 5;
      for (const goal of lv.goals) {
        if (goal.type === 'color' && goal.color >= colors) {
          problems.push(`level ${i + 1}: goal wants colour ${goal.color} but the level only uses ${colors} colours`);
        }
      }
      const counts = this.countObstacles(lv.layout);
      for (const goal of lv.goals) {
        if (goal.type !== 'color' && goal.count !== 'all' && goal.count > (counts[goal.type] || 0)) {
          problems.push(`level ${i + 1}: goal wants ${goal.count} ${goal.type} but the layout only has ${counts[goal.type] || 0}`);
        }
      }
    });

    if (problems.length && typeof console !== 'undefined') {
      problems.forEach(p => console.warn('[Levels]', p));
    }
    return problems;
  },

  goalIcon(goal, px) {
    if (goal.type === 'color') return Art.iconNode('gem', goal.color, px);
    return Art.iconNode(goal.type, 0, px);
  },
};
