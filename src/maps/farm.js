// Hinata Farm (日向農場), 64x48. Uncle Jirōbei's overgrown hillside farm.
//
// Ground legend:
//   T forest edge (grass, trees, impassable)   . grass          o grass, overgrown
//   , bare earth                               : earth, overgrown
//   ~ water                                    = cobbled path
//   f bamboo fence (grass, impassable)         s sakura tree    t broadleaf tree
// "Overgrown" cells are filled with weeds, stones, twigs, stumps, trees and bamboo from the save
// seed (see world/populate.js), so every new farm is a little different.
export default {
  id: 'farm',
  name: 'Hinata Farm',
  jp: '日向農場',
  ground: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.....................s.TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................TooooooooooooooooooooooTT',
    'TToooooooooooooo.......................ffffffffffffffffffffffTTT',
    'TToooooooooooooo............===........oooooooooooooooooooooooTT',
    'TToooooooooooooo.s..........===.....s..oooooooooooooooooooooooTT',
    'TToooooooooooooooooooooooooo===oooooooooooooooooooooooooooooooTT',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,oooooooooooooooooooooooooooooooTT',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,oooooooooooooooooooooooooooooooTT',
    'TToooooooooooooooooo.........oooooooooooooooooooooooooooooooooTT',
    'TToooooooooooooooooo.,,,,,,,.oooooooooooooooooo.........ooooooTT',
    'TToooooooooooooooooo.,,,,,,,.ooooooooooooooooo...~~~~~...oooooTT',
    'TToooooooooooooooooo.,,,,,,,.oooooooooooooooo..~~~~~~~~~..ooooTT',
    'TToooooooooooooooooo.,,,,,,,.ooooooooooooooo...~~~~~~~~~...oooTT',
    'TToooooooooooooooooo.,,,,,,,.ooooooooooooooo..~~~~~~~~~~~..oooTT',
    'TToooooooooooooooooo.,,,,,,,.ooooooooooooooo...~~~~~~~~~...oooTT',
    'TToooooooooooooooooo.........oooooooooooooooo..~~~~~~~~~..ooooTT',
    'TTooooooootooooooooooooooooooooooooooooooooooo...~~~~~...oooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooo.........ooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TToooooooooooooooooooooooooooooooo::::::ooooooooooooooootoooooTT',
    'TToooooooooooooooooooooooooooooooo::::::ooooooooooooooooooooooTT',
    'TToooooooooooooooooooooooooooooooo::::::ooooooooooooooooooooooTT',
    'TToooooooooooooooooooooooooooooooo::::::ooootoooooooooooooooooTT',
    'TToooooooooooooooooooooooooooooooo::::::ooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TToooooooooooootooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TTooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooTT',
    'TT............................................................TT',
    'TT.....~~~~.........~~~~~~..........~~~~.............~~~~~....TT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  // Buildings: sprite top-left in pixels relative to the footprint's top-left tile, footprint in
  // tiles (impassable), and interaction spots.
  buildings: [
    { id: 'house', sprite: 'minka', tx: 26, ty: 8, w: 7, h: 3, px: -1, py: -64, door: { tx: 29, ty: 11, action: 'sleep' },
      lights: [[20, 84], [38, 84], [76, 84], [92, 84], [56, 88]] },
    { id: 'kura', sprite: 'kura', tx: 19, ty: 8, w: 3, h: 3, px: -5, py: -32, door: { tx: 20, ty: 11, action: 'kura' } },
    { id: 'well', sprite: 'well', tx: 34, ty: 10, w: 2, h: 1, px: -2, py: -24, water: true },
  ],
  props: [
    { type: 'toro', tx: 27, ty: 12, light: [6, 6] },
    { type: 'toro', tx: 31, ty: 12, light: [6, 6] },
    { type: 'sign', tx: 3, ty: 13, text: 'sign_road' },
    { type: 'sign', tx: 50, ty: 11, text: 'sign_terraces' },
  ],
  // Walking into these tiles triggers a message instead of a map change (other maps arrive in M3).
  edges: [{ tx: 0, ty: 14, h: 2, text: 'edge_village' }],
  spawn: { tx: 29, ty: 12, dir: 'down' },
};
