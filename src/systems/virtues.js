// What the seven virtues do. Each virtue (0-100) counts in tiers of 25; every tier adds a small,
// never punishing, benefit to the systems it belongs to. Story branches read the raw values.
import { VIRTUES } from '../data/virtues.js';

export const virtueTier = (virtues, id) => Math.min(4, Math.floor((virtues?.[id] || 0) / 25));

// One line per virtue for the Skills tab: what a tier gives.
export const VIRTUE_EFFECTS = {
  gi: { per: 2, text: 'Shop prices -{n}%' },
  yu: { per: 5, text: 'Max Ki +{n}' },
  jin: { per: 10, text: 'Petting affection +{n}%' },
  rei: { per: 2, text: 'Bond from talks +{n}' },
  makoto: { per: 5, text: 'Request pay +{n}%' },
  meiyo: { per: 1, text: 'Crit chance +{n}%' },
  chugi: { per: 25, text: 'Bond neglect -{n}%' },
};

/** The effect line for a virtue at its current tier (null at tier 0). */
export function effectText(virtues, id) {
  const tier = virtueTier(virtues, id);
  if (!tier) return null;
  const e = VIRTUE_EFFECTS[id];
  return e.text.replace('{n}', e.per * tier);
}

export const buyMult = (v) => 1 - 0.02 * virtueTier(v, 'gi');
export const talkBonus = (v) => 2 * virtueTier(v, 'rei');
export const rewardMult = (v) => 1 + 0.05 * virtueTier(v, 'makoto');
export const petMult = (v) => 1 + 0.1 * virtueTier(v, 'jin');
export const decayMult = (v) => 1 - 0.25 * virtueTier(v, 'chugi');

export const VIRTUE_NAMES = VIRTUES;
