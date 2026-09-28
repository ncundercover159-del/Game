// Crop definitions. `days` = watered nights until ripe; `regrow` = nights until the next harvest
// for crops that keep producing. Sprites: `crop_<id>_<stage>`, stages 0 (seeds) to 4 (ripe).
export const CROPS = {
  daikon: { item: 'daikon', seed: 'seed_daikon', seasons: ['spring'], days: 4, regrow: 0 },
  komatsuna: { item: 'komatsuna', seed: 'seed_komatsuna', seasons: ['spring'], days: 5, regrow: 0 },
  soramame: { item: 'soramame', seed: 'seed_soramame', seasons: ['spring'], days: 6, regrow: 0 },
  strawberry: { item: 'strawberry', seed: 'seed_strawberry', seasons: ['spring'], days: 8, regrow: 4 },
};

export const RIPE = 4;

/** Growth stage 0-4 for a crop that has grown `growth` watered nights. */
export function stageOf(id, growth) {
  const { days } = CROPS[id];
  if (growth >= days) return RIPE;
  if (growth <= 0) return 0;
  return 1 + Math.floor(((growth - 1) * 3) / Math.max(1, days - 1));
}

// Base harvest quality odds before skills (M4) and fertiliser: [fine, excellent].
export const QUALITY_ODDS = [0.12, 0.03];
