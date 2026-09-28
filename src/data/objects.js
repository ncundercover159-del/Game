// World object types: what they look like, which tools affect them, what they drop.
// drops: [itemId, min, max, chance=1]. `tools` lists tools that damage it; `power` is per tool.

export const OBJECT_TYPES = {
  weed: {
    name: 'Weeds', solid: true, hp: 1, shadow: null,
    tools: { sickle: 1, hoe: 1, axe: 1, pickaxe: 1 },
    drops: { sickle: [['hay', 1, 1, 0.6]] },
    fx: 'fx_leaf', sfx: 'cut',
  },
  stone: {
    name: 'Stone', solid: true, hp: 1, shadow: 'shadow_s',
    tools: { pickaxe: 1 }, drops: { any: [['stone', 1, 2]] }, fx: 'fx_pebble', sfx: 'rock', hint: 'pickaxe',
  },
  twig: {
    name: 'Twigs', solid: true, hp: 1, shadow: null,
    tools: { axe: 1 }, drops: { any: [['wood', 1, 2]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
  },
  stump: {
    name: 'Stump', solid: true, hp: 5, shadow: 'shadow_s',
    tools: { axe: 1 }, drops: { any: [['wood', 3, 5]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
  },
  tree: {
    name: 'Tree', solid: true, hp: 10, shadow: 'shadow_l',
    tools: { axe: 1 }, drops: { any: [['wood', 6, 10]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
    becomes: 'stump',
  },
  bamboo: {
    name: 'Bamboo', solid: true, hp: 3, shadow: 'shadow_m',
    tools: { axe: 1 }, drops: { any: [['bamboo', 2, 4]] }, fx: 'fx_leaf', sfx: 'chop', hint: 'axe',
  },
  // Static props: not damageable.
  forest: { name: 'Old Tree', solid: true, static: true, shadow: 'shadow_l', say: 'forest' },
  toro: { name: 'Stone Lantern', solid: true, static: true, shadow: 'shadow_s', say: 'toro' },
  sign: { name: 'Sign', solid: true, static: true, shadow: null },
  fence: { name: 'Fence', solid: true, static: true, shadow: null },
};
