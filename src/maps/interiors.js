// Interiors. Each room is built from its floor rows: a void border, two wall rows (the cap seen
// from above, then the plaster face), the floor, and a doorway in the bottom wall. The doorway links
// back to the building that owns it (see maps/index.js). Floor legend: m tatami, n tatami turned,
// w planks, d doma (tamped earth). Props are furniture from data/objects.js; `block` makes a
// multi-tile piece solid, `ox`/`oy` shift its sprite, `light` gives it a glow at night.

/** Build a room definition from its floor rows (all the same width) and doorway column. */
function room(id, name, jp, floor, doorX, rest) {
  const w = floor[0].length + 2;
  const edge = 'x'.repeat(w);
  const wall = `x${'#'.repeat(w - 2)}x`;
  const doorRow = [...edge];
  doorRow[doorX] = floor[floor.length - 1][doorX - 1];
  const ground = [edge, wall, wall, ...floor.map((r) => `x${r}x`), doorRow.join(''), edge];
  const doorY = floor.length + 3;
  return { id, name, jp, indoor: true, ground, door: { tx: doorX, ty: doorY }, spawn: { tx: doorX, ty: doorY - 1, dir: 'up' }, ...rest };
}

const WALL = 2; // y of the wall face row, where shelves and kamidana hang

// The farmhouse, and the extended one Tatsu builds (a second room to the right; the door, bed
// and every original piece stay where they were). maps/index.js swaps them by the house_upgraded flag.
const FARMHOUSE_PROPS = [
  { type: 'futon', tx: 2, ty: 5, action: 'sleep' },
  { type: 'andon', tx: 4, ty: 3, light: [0, 4] },
  { type: 'tansu', tx: 1, ty: 3 },
  { type: 'kamidana', tx: 9, ty: WALL },
  { type: 'irori', tx: 8, ty: 5, ox: 8, block: [2, 2], light: [8, 0] },
  { type: 'zabuton', tx: 7, ty: 6, kind: 'red' },
  { type: 'zabuton', tx: 10, ty: 4, kind: 'indigo' },
];
const HOUSE_SMALL = room('house_farm', 'Farmhouse', '母屋', [
  'mmmmmmwwwww',
  'mmmmmmwwwww',
  'mmmmmmwwwww',
  'mmmmmmwwwww',
  'ddddddddddd',
  'ddddddddddd',
], 6, { props: FARMHOUSE_PROPS, wake: { tx: 3, ty: 5, dir: 'down' } });
export const HOUSE_BIG = room('house_farm', 'Farmhouse', '母屋', [
  'mmmmmmwwwwwwmmm',
  'mmmmmmwwwwwwmmm',
  'mmmmmmwwwwwwmmm',
  'mmmmmmwwwwwwmmm',
  'ddddddddddddddd',
  'ddddddddddddddd',
], 6, {
  props: [
    ...FARMHOUSE_PROPS,
    { type: 'futon', tx: 13, ty: 5 },
    { type: 'andon', tx: 15, ty: 3, light: [0, 4] },
    { type: 'shelf', tx: 13, ty: WALL, ox: 8, kind: 'goods' },
    { type: 'barrels', tx: 14, ty: 8 },
    { type: 'tansu', tx: 12, ty: 3 },
  ],
  wake: { tx: 3, ty: 5, dir: 'down' },
});
export const HOUSE_PLAN = { small: HOUSE_SMALL, big: HOUSE_BIG };

export const INTERIORS = [
  HOUSE_SMALL,
  room('yorozuya', 'Yorozuya', '万屋', [
    'wwwwwwwwwww',
    'wwwwwwwwwww',
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
  ], 6, {
    props: [
      { type: 'shelf', tx: 2, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'shelf', tx: 6, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'shelf', tx: 9, ty: WALL, ox: 8, kind: 'herbs' },
      ...counter(3, 9, 5, 'yorozuya'),
      { type: 'bales', tx: 10, ty: 7 },
      { type: 'andon', tx: 1, ty: 6, light: [0, 4] },
    ],
    keeper: { npc: 'chobei', tx: 6, ty: 4 },
  }),
  room('chaya', 'Teahouse', '茶屋', [
    'wwwwwwwwwww',
    'wwwwwwwwwww',
    'nnnnnnnnnnn',
    'nnnnnnnnnnn',
    'ddddddddddd',
  ], 6, {
    props: [
      ...counter(1, 4, 4, 'chaya'),
      { type: 'shelf', tx: 2, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'teaTable', tx: 8, ty: 5, ox: 8, block: [2, 1] },
      { type: 'zabuton', tx: 7, ty: 5, kind: 'red' },
      { type: 'zabuton', tx: 10, ty: 5, kind: 'red' },
      { type: 'teaTable', tx: 8, ty: 3, ox: 8, block: [2, 1] },
      { type: 'zabuton', tx: 10, ty: 3, kind: 'indigo' },
      { type: 'andon', tx: 6, ty: 3, light: [0, 4] },
    ],
    keeper: { npc: 'okiku', tx: 2, ty: 3 },
  }),
  room('kajiya', 'Forge', '鍛冶屋', [
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
  ], 6, {
    props: [
      { type: 'forge', tx: 2, ty: 4, ox: 8, block: [2, 2], light: [8, -10] },
      { type: 'anvil', tx: 5, ty: 4 },
      ...counter(6, 10, 5, 'kajiya'),
      { type: 'shelf', tx: 8, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'bales', tx: 1, ty: 7 },
    ],
    keeper: { npc: 'genzo', tx: 8, ty: 4 },
  }),
  room('yakuya', 'Apothecary', '薬屋', [
    'wwwwwwwww',
    'wwwwwwwww',
    'ddddddddd',
    'ddddddddd',
  ], 5, {
    props: [
      { type: 'drawers', tx: 2, ty: WALL, ox: 8 },
      { type: 'drawers', tx: 6, ty: WALL, ox: 8 },
      ...counter(2, 8, 4, 'yakuya'),
      { type: 'andon', tx: 1, ty: 6, light: [0, 4] },
    ],
    keeper: { npc: 'ume', tx: 5, ty: 3 },
  }),
  room('heibei', 'Heibei\'s House', '平兵衛の家', [
    'mmmmmwwwwww',
    'mmmmmwwwwww',
    'mmmmmwwwwww',
    'ddddddddddd',
    'ddddddddddd',
  ], 6, {
    props: [
      { type: 'futon', tx: 2, ty: 4 },
      { type: 'tansu', tx: 4, ty: 3 },
      { type: 'kamidana', tx: 2, ty: WALL },
      { type: 'irori', tx: 8, ty: 5, ox: 8, block: [2, 2], light: [8, 0] },
      { type: 'zabuton', tx: 7, ty: 4, kind: 'indigo' },
      { type: 'bales', tx: 10, ty: 7 },
    ],
  }),
  room('kaito', 'Kaito\'s House', '海斗の家', [
    'mmmmwwwww',
    'mmmmwwwww',
    'ddddddddd',
    'ddddddddd',
  ], 5, {
    props: [
      { type: 'futon', tx: 1, ty: 4 },
      { type: 'tansu', tx: 4, ty: 3 },
      { type: 'shelf', tx: 7, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'bales', tx: 8, ty: 6 },
      { type: 'andon', tx: 5, ty: 4, light: [0, 4] },
    ],
  }),
  room('daigo', 'Daigo\'s Hut', '大吾の小屋', [
    'mmmmwwwww',
    'mmmmwwwww',
    'ddddddddd',
    'ddddddddd',
  ], 5, {
    props: [
      { type: 'nets', tx: 6, ty: WALL, ox: 8 },
      { type: 'futon', tx: 1, ty: 4 },
      { type: 'zabuton', tx: 3, ty: 4, kind: 'indigo' },
      { type: 'andon', tx: 8, ty: 3, light: [0, 4] },
    ],
  }),
  room('shamusho', 'Shrine Office', '社務所', [
    'mmmmmmmmm',
    'mmmmmmmmm',
    'wwwwwwwww',
    'wwwwwwwww',
  ], 5, {
    props: [
      { type: 'kamidana', tx: 5, ty: WALL },
      { type: 'shelf', tx: 1, ty: WALL, ox: 8, kind: 'herbs' },
      { type: 'teaTable', tx: 4, ty: 4, ox: 8, block: [2, 1] },
      { type: 'zabuton', tx: 3, ty: 4, kind: 'red' },
      { type: 'zabuton', tx: 6, ty: 4, kind: 'red' },
      { type: 'andon', tx: 8, ty: 3, light: [0, 4] },
    ],
  }),
  // M6 homes. Sōken's hermitage: a small hall with the altar he tends.
  room('tera', 'Hermitage', '庵', [
    'mmmmmmmmm',
    'mmmmmmmmm',
    'wwwwwwwww',
    'wwwwwwwww',
  ], 5, {
    props: [
      { type: 'butsudan', tx: 4, ty: 3, ox: 8, block: [2, 1] },
      { type: 'zabuton', tx: 4, ty: 5, kind: 'indigo' },
      { type: 'andon', tx: 1, ty: 4, light: [0, 4] },
      { type: 'andon', tx: 8, ty: 4, light: [0, 4] },
      { type: 'futon', tx: 8, ty: 5 },
    ],
  }),
  // Toyo and her grandson Kinta: pickling barrels along the wall, the family futon.
  room('toyo', 'Toyo\'s House', 'トヨの家', [
    'mmmmwwwww',
    'mmmmwwwww',
    'ddddddddd',
    'ddddddddd',
  ], 5, {
    props: [
      { type: 'barrels', tx: 6, ty: 3, ox: 8, block: [2, 1] },
      { type: 'futon', tx: 1, ty: 3 },
      { type: 'kamidana', tx: 3, ty: WALL },
      { type: 'zabuton', tx: 3, ty: 4, kind: 'red' },
      { type: 'andon', tx: 5, ty: 3, light: [0, 4] },
    ],
  }),
  // Tatsu's workshop: timber, a sawhorse, and a counter for commissions.
  room('tatsu', 'Carpenter', '大工', [
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
    'ddddddddddd',
  ], 6, {
    props: [
      { type: 'sawhorse', tx: 2, ty: 4, ox: 8, block: [2, 1] },
      ...counter(6, 9, 5, 'tatsu'),
      { type: 'shelf', tx: 7, ty: WALL, ox: 8, kind: 'goods' },
      { type: 'bales', tx: 1, ty: 7 },
      { type: 'andon', tx: 10, ty: 7, light: [0, 4] },
    ],
    keeper: { npc: 'tatsu', tx: 7, ty: 4 },
  }),
  // Yuzu's bathhouse: pay at the counter, soak in the cypress tub.
  room('sento', 'Bathhouse', '銭湯', [
    'wwwwwwwwwww',
    'wwwwwwwwwww',
    'wwwwwwwwwww',
    'ddddddddddd',
    'ddddddddddd',
  ], 6, {
    props: [
      { type: 'tub', tx: 7, ty: 4, ox: 8, block: [2, 1] },
      ...counter(1, 3, 5, 'sento'),
      { type: 'shelf', tx: 1, ty: WALL, ox: 8, kind: 'herbs' },
      { type: 'andon', tx: 10, ty: 6, light: [0, 4] },
    ],
    keeper: { npc: 'yuzu', tx: 2, ty: 4 },
  }),
  // The magistrate's office: a desk, his swords, and a very clean floor.
  room('daikansho', 'Magistrate\'s Office', '代官所', [
    'nnnnnnnnnnnnn',
    'nnnnnnnnnnnnn',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
  ], 7, {
    props: [
      { type: 'desk', tx: 6, ty: 4, ox: 8, block: [2, 1] },
      { type: 'swordRack', tx: 10, ty: WALL, ox: 8 },
      { type: 'kamidana', tx: 3, ty: WALL },
      { type: 'zabuton', tx: 6, ty: 3, kind: 'indigo' },
      { type: 'andon', tx: 1, ty: 3, light: [0, 4] },
      { type: 'andon', tx: 13, ty: 3, light: [0, 4] },
    ],
  }),
  // The dōjō: bare boards, racks of practice swords. Rin trains here when she is in the valley.
  room('dojo', 'Dōjō', '道場', [
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
    'wwwwwwwwwwwww',
  ], 7, {
    props: [
      { type: 'swordRack', tx: 2, ty: WALL, ox: 8 },
      { type: 'swordRack', tx: 10, ty: WALL, ox: 8 },
      { type: 'kamidana', tx: 6, ty: WALL },
      { type: 'andon', tx: 1, ty: 7, light: [0, 4] },
      { type: 'andon', tx: 13, ty: 7, light: [0, 4] },
    ],
  }),
  // Uncle's coop: a hay hopper by the wall and straw nests. Eggs laid overnight lie on the floor.
  room('coop', 'Coop', '鶏小屋', [
    'ddddddddd',
    'ddddddddd',
    'ddddddddd',
    'ddddddddd',
  ], 5, {
    persist: true,
    props: [
      { type: 'hopper', tx: 1, ty: 3 },
      { type: 'nest', tx: 7, ty: 3 },
      { type: 'nest', tx: 9, ty: 3 },
      { type: 'bales', tx: 8, ty: 6 },
    ],
  }),
  // The shrine hall: seven altars, one for each virtue, along the back wall.
  room('honden', 'Shrine Hall', '本殿', [
    'wwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwww',
  ], 8, {
    props: [
      ...['gi', 'yu', 'jin', 'rei', 'makoto', 'meiyo', 'chugi'].map((virtue, i) => ({ type: 'altar', tx: 2 + i * 2, ty: 4, kind: virtue })),
      { type: 'andon', tx: 1, ty: 6, light: [0, 4] },
      { type: 'andon', tx: 15, ty: 6, light: [0, 4] },
    ],
  }),
];

/** A shop counter running x0..x1 on row y; talking across it opens the shop. */
function counter(x0, x1, y, shop) {
  const out = [];
  for (let x = x0; x <= x1; x++) out.push({ type: 'counter', tx: x, ty: y, shop });
  return out;
}
