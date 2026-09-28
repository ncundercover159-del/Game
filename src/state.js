// The saveable game state: a fresh farm, and migrations for saves from older versions.
import { MIGRATIONS } from './core/save.js';
import { newCalendar, nextDay } from './systems/calendar.js';
import { weatherFor } from './systems/weather.js';
import { TIERS } from './data/tools.js';
import { START } from './data/start.js';
import { newVirtues } from './data/virtues.js';
import { newRequests } from './systems/requests.js';
import { newMail } from './systems/mail.js';
import { newOfferings } from './systems/offerings.js';
import { newSkills } from './systems/skills.js';
import { newAnimals } from './systems/animals.js';
import { DISHES } from './data/recipes.js';

const START_RECIPES = () => Object.keys(DISHES).filter((id) => DISHES[id].known);

export const TOOL_TIERS = () => ({ hoe: 0, can: 0, axe: 0, pickaxe: 0, sickle: 0 });

export function newState(seed) {
  const cal = newCalendar();
  return {
    seed, name: START.name, farm: START.farm, money: START.money,
    genki: START.genkiMax, genkiMax: START.genkiMax, can: TIERS[0].can,
    cal, weather: weatherFor(seed, cal), tomorrow: weatherFor(seed, nextDay(cal).t),
    tiers: TOOL_TIERS(), upgrade: null, shipped: [],
    inventory: { size: 12, slots: START.inventory, selected: 0 },
    flags: {}, stats: { shippedValue: 0 }, rng: seed ^ 0x5bd1e995, maps: {},
    bonds: {}, virtues: newVirtues(), requests: newRequests(), mail: newMail(), offerings: newOfferings(),
    skills: newSkills(), buffs: [], foraged: { day: -1, keys: [] }, animals: newAnimals(),
    recipes: START_RECIPES(),
  };
}

// v1 (M1) -> v2 (M2): weather, tool tiers, shipping crate, stats.
MIGRATIONS[1] = (s) => ({
  ...s,
  weather: weatherFor(s.seed, s.cal),
  tomorrow: weatherFor(s.seed, nextDay(s.cal).t),
  tiers: TOOL_TIERS(),
  upgrade: null,
  shipped: [],
  stats: { shippedValue: 0 },
});

// v2 (M2) -> v3 (M3): bonds, virtues, notice-board requests, mail, shrine offerings. The player's
// map defaults to the farm.
MIGRATIONS[2] = (s) => ({ ...s, bonds: {}, virtues: newVirtues(), requests: newRequests(), mail: newMail(), offerings: newOfferings() });

// v3 (M3) -> v4 (M4): skills and XP, food buffs, today's picked forage, coop animals, recipes.
MIGRATIONS[3] = (s) => ({ ...s, skills: newSkills(), buffs: [], foraged: { day: -1, keys: [] }, animals: newAnimals(), recipes: START_RECIPES() });
