// Mount Kurayama's foot (鞍山), 30x24, beyond the shrine's rear gate: a mountain path climbing to the
// old mine mouth under a shimenawa. The mouth leads down into the generated floors (see caves.js);
// the lost bundle waits by the mouth after a defeat. Legend as in world/gamemap.js; C cliff.
export default {
  id: 'kurayama',
  name: 'Mount Kurayama',
  jp: '鞍山',
  ground: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTCCCCCCCCCCCCCCCCCCCTTTTTT',
    'TTTTCCCCCCCCCCCCCCCCCCCCCTTTTT',
    'TTTCCCCCCCCCCCCCCCCCCCCCCCTTTT',
    'TTTCCCCCCCCCCCCCCCCCCCCCCCTTTT',
    'TTT..........,,,..........TTTT',
    'TTT.t.......,,,,,.......t.TTTT',
    'TT..........,,,,,..........TTT',
    'TT.....t.....,,,.....t.....TTT',
    'TTt..........,,,...........tTT',
    'TT...........,,,............TT',
    'TT....t.......,,,.......t...TT',
    'TTT...........,,,...........TT',
    'TTTt.........,,,..........tTTT',
    'TTT..........,,,...........TTT',
    'TT.....t.....,,,.....t......TT',
    'TT...........,,,............TT',
    'TTT...........,,,..........TTT',
    'TTTt..........,,,.........tTTT',
    'TTT...........,,,...........TT',
    'TT....t.......,,,......t....TT',
    'TTT..........,,,,...........TT',
    'TTTTTTTTTTTTT,,,,TTTTTTTTTTTTT',
    'TTTTTTTTTTTTT,,,,TTTTTTTTTTTTT',
  ],
  buildings: [
    { id: 'mouth', sprite: 'cave_mouth', tx: 13, ty: 2, w: 4, h: 3 },
  ],
  props: [
    { type: 'toro', tx: 11, ty: 6, light: [0, 6] },
    { type: 'toro', tx: 18, ty: 6, light: [0, 6] },
    { type: 'sign', tx: 10, ty: 9, text: 'sign_kurayama' },
    { type: 'jizo', tx: 20, ty: 10 },
  ],
  // Walking into the dark of the mouth goes down (floor choice when lanterns are lit).
  warps: [
    { x: 14, y: 5, w: 2, h: 1, cave: true },
    { x: 13, y: 23, w: 4, h: 1, to: 'shrine', tx: 19, ty: 2, dir: 'down' },
  ],
  bundleAt: { tx: 17, ty: 7 },
  spawn: { tx: 14, ty: 21, dir: 'up' },
};
