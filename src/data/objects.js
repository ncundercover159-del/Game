// World object types: what they look like, which tools affect them, what they drop.
import { ORES } from './caves.js';

// drops: [itemId, min, max, chance=1]. `tools` lists tools that damage it; `power` is per tool.
// `xp`: [skill, amount] earned when it is cleared.
// `flat` things lie on the floor and are drawn under everything that stands.

export const OBJECT_TYPES = {
  weed: {
    name: 'Weeds', solid: true, hp: 1, shadow: null, xp: ['foraging', 1],
    tools: { sickle: 1, hoe: 1, axe: 1, pickaxe: 1 },
    drops: { sickle: [['hay', 1, 1, 0.6]] },
    fx: 'fx_leaf', sfx: 'cut',
  },
  stone: {
    name: 'Stone', solid: true, hp: 1, shadow: 'shadow_s', xp: ['mining', 2],
    tools: { pickaxe: 1 }, drops: { any: [['stone', 1, 2]] }, fx: 'fx_pebble', sfx: 'rock', hint: 'pickaxe',
  },
  twig: {
    name: 'Twigs', solid: true, hp: 1, shadow: null, xp: ['foraging', 1],
    tools: { axe: 1 }, drops: { any: [['wood', 1, 2]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
  },
  stump: {
    name: 'Stump', solid: true, hp: 5, shadow: 'shadow_s', xp: ['foraging', 4],
    tools: { axe: 1 }, drops: { any: [['wood', 3, 5]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
  },
  tree: {
    name: 'Tree', solid: true, hp: 10, shadow: 'shadow_l', xp: ['foraging', 6],
    tools: { axe: 1 }, drops: { any: [['wood', 6, 10]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
    becomes: 'stump',
  },
  bamboo: {
    name: 'Bamboo', solid: true, hp: 3, shadow: 'shadow_m', xp: ['foraging', 3],
    tools: { axe: 1 }, drops: { any: [['bamboo', 2, 4]] }, fx: 'fx_leaf', sfx: 'chop', hint: 'axe',
  },
  log: {
    name: 'Large Log', solid: true, hp: 12, shadow: 'shadow_m', xp: ['foraging', 10], minTier: 1,
    tools: { axe: 1 }, drops: { any: [['wood', 10, 14]] }, fx: 'fx_chip', sfx: 'chop', hint: 'axe',
  },
  boulder: {
    name: 'Boulder', solid: true, hp: 12, shadow: 'shadow_m', xp: ['mining', 10], minTier: 1,
    tools: { pickaxe: 1 }, drops: { any: [['stone', 8, 12]] }, fx: 'fx_pebble', sfx: 'rock', hint: 'pickaxe',
  },
  sluice: {
    name: 'Sluice Gate', solid: false, hp: 1, shadow: null,
    tools: { pickaxe: 1 }, drops: { any: [['sluice', 1, 1]] }, fx: 'fx_chip', sfx: 'chop',
  },
  // Static props: not damageable.
  forest: { name: 'Old Tree', solid: true, static: true, shadow: 'shadow_l', say: 'forest' },
  thicket: { name: 'Bamboo Thicket', solid: true, static: true, shadow: 'shadow_m', say: 'thicket' },
  toro: { name: 'Stone Lantern', solid: true, static: true, shadow: 'shadow_s', say: 'toro' },
  sign: { name: 'Sign', solid: true, static: true, shadow: null },
  fence: { name: 'Fence', solid: true, static: true, shadow: null },
  crate: { name: 'Shipping Crate', solid: true, static: true, shadow: 'shadow_m' },
  ishigaki: { name: 'Terrace Wall', solid: true, static: true, shadow: null, say: 'terrace_wall' },

  // Forage lying on the ground (picked by hand) and dig spots (the hoe turns them over).
  forage: { name: 'Forage', solid: false, hp: 1, shadow: null },
  dig: { name: 'Dig Spot', solid: false, hp: 1, shadow: null },
  // Artisan machines (placed from the pack; picked up again with the axe or pickaxe when empty).
  machine: { name: 'Machine', solid: true, hp: 1, shadow: 'shadow_s' },
  // A fish trap set in the water; the axe takes it back up.
  trap: { name: 'Fish Trap', solid: true, hp: 1, shadow: null, tools: { axe: 1 }, drops: { any: [['uke', 1, 1]] }, fx: 'fx_chip', sfx: 'chop' },

  // Village and shrine props.
  notice: { name: 'Notice Board', solid: true, static: true, shadow: null },
  jizo: { name: 'Jizō', solid: true, static: true, shadow: 'shadow_s', say: 'jizo' },
  bench: { name: 'Bench', solid: true, static: true, shadow: null, say: 'bench' },
  parasol: { name: 'Parasol', solid: false, static: true, shadow: null },
  bales: { name: 'Rice Bales', solid: true, static: true, shadow: 'shadow_m', say: 'bales' },
  torii: { name: 'Torii', solid: false, static: true, shadow: null },
  ema: { name: 'Ema Rack', solid: true, static: true, shadow: null, say: 'ema' },
  sacred: { name: 'Sacred Cedar', solid: true, static: true, shadow: 'shadow_l', say: 'sacred' },
  gate: { name: 'Rear Gate', solid: true, static: true, shadow: null, say: 'gate_sealed' },
  mailbox: { name: 'Mailbox', solid: true, static: true, shadow: 'shadow_s' },

  // The coop: a hay hopper, nests, and whatever was laid overnight.
  hopper: { name: 'Hay Hopper', solid: true, static: true, shadow: null },
  nest: { name: 'Nest', solid: false, static: true, shadow: null, flat: true },
  produce: { name: 'Egg', solid: false, hp: 1, shadow: null },

  // Furniture.
  futon: { name: 'Futon', solid: false, static: true, shadow: null, flat: true },
  irori: { name: 'Hearth', solid: true, static: true, shadow: null, say: 'irori' },
  tansu: { name: 'Tansu', solid: true, static: true, shadow: null, say: 'tansu' },
  andon: { name: 'Andon', solid: true, static: true, shadow: null },
  counter: { name: 'Counter', solid: true, static: true, shadow: null },
  shelf: { name: 'Shelf', solid: false, static: true, shadow: null },
  teaTable: { name: 'Tea Table', solid: true, static: true, shadow: null },
  zabuton: { name: 'Cushion', solid: false, static: true, shadow: null, flat: true },
  forge: { name: 'Forge', solid: true, static: true, shadow: null, say: 'forge' },
  anvil: { name: 'Anvil', solid: true, static: true, shadow: null },
  drawers: { name: 'Medicine Drawers', solid: false, static: true, shadow: null },
  nets: { name: 'Nets', solid: false, static: true, shadow: null },
  altar: { name: 'Altar', solid: true, static: true, shadow: null },
  kamidana: { name: 'Kamidana', solid: false, static: true, shadow: null },

  // Mount Kurayama. Ore takes its hit points, drops and needed pickaxe tier from ORES by kind.
  ore: { name: 'Ore', solid: true, hp: 3, shadow: 'shadow_s', tools: { pickaxe: 1 }, byKind: ORES, fx: 'fx_pebble', sfx: 'rock', hint: 'pickaxe' },
  urn: { name: 'Urn', solid: true, hp: 1, shadow: 'shadow_s', tools: { pickaxe: 1, axe: 1, hoe: 1, sickle: 1 } },
  cracked: { name: 'Cracked Rock', solid: true, hp: 3, shadow: null, tools: { pickaxe: 1 }, xp: ['mining', 5], fx: 'fx_pebble', sfx: 'rock', hint: 'pickaxe' },
  chest: { name: 'Chest', solid: true, static: true, shadow: 'shadow_s' },
  ladder: { name: 'Ladder', solid: false, static: true, shadow: null, flat: true },
  rope: { name: 'Rope', solid: true, static: true, shadow: null },
  cave_lantern: { name: 'Lantern', solid: true, static: true, shadow: 'shadow_s' },
  timbers: { name: 'Pit-props', solid: false, static: true, shadow: null },
  deep: { name: 'Flooded Stair', solid: true, static: true, shadow: null, flat: true, say: 'deep' },
  brazier: { name: 'Brazier', solid: true, static: true, shadow: 'shadow_s' },
  bundle: { name: 'Lost Bundle', solid: true, static: true, shadow: 'shadow_s' },
  mouth: { name: 'Cave Mouth', solid: false, static: true, shadow: null, flat: true },

  // M6 fittings and the market stalls.
  butsudan: { name: 'Altar', solid: true, static: true, shadow: null, say: 'butsudan' },
  tub: { name: 'Bath', solid: true, static: true, shadow: null },
  barrels: { name: 'Pickling Barrels', solid: true, static: true, shadow: null, say: 'barrels' },
  sawhorse: { name: 'Sawhorse', solid: true, static: true, shadow: null, say: 'sawhorse' },
  desk: { name: 'Desk', solid: true, static: true, shadow: null, say: 'desk' },
  swordRack: { name: 'Sword Rack', solid: false, static: true, shadow: null, say: 'sword_rack' },
  yatai: { name: 'Stall', solid: true, static: true, shadow: 'shadow_l' },
  omamori: { name: 'Charm Stand', solid: true, static: true, shadow: 'shadow_s' },
  // Festival dressing, put up on the day (see festivals.js): `decor` can be walked past or under,
  // a `fixture` stands on the ground.
  decor: { name: 'Decoration', solid: false, static: true, shadow: null },
  fixture: { name: 'Festival Stand', solid: true, static: true, shadow: 'shadow_m' },
};
