// Rules of the Act II branch, kept pure: the magistrate's toll on shipping, Kuroda's better price
// once you sign with him, and the petition's signatures if you refuse.

export const TOLL = 0.1;            // the magistrate's tenth
export const KURODA_BONUS = 0.1;    // Kuroda pays over Chōbei's price
export const PETITION_NEEDED = 8;
export const SIGN_HEARTS = 3;       // villagers who trust you this much will sign
export const LEDGER_WEIGHT = 3;     // Shinsuke's true ledger counts for three names
// Who will not (or cannot) put a name to it.
const WONT_SIGN = new Set(['okubo', 'kinta']);

export const tollsActive = (flags) => !!flags.tolls && !flags.petition_won && !flags.kuroda_signed;

/** What the night's shipping gains or loses: { toll, bonus } in mon. */
export function shippingAdjust(flags, total) {
  return {
    toll: tollsActive(flags) ? Math.floor(total * TOLL) : 0,
    bonus: flags.kuroda_signed ? Math.floor(total * KURODA_BONUS) : 0,
  };
}

export const signed = (flags) => Object.keys(flags).filter((k) => k.startsWith('signed_') && flags[k]);

/** Names on the petition, with the ledger's weight. */
export const signatures = (flags) => signed(flags).length + (flags.ledger_given ? LEDGER_WEIGHT : 0);

/** Would this villager sign now? */
export function canSign(flags, npc, hearts) {
  return !!flags.petition && flags.petition_sent === undefined && !flags[`signed_${npc}`] && !WONT_SIGN.has(npc) && hearts >= SIGN_HEARTS;
}
