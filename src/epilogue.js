// The end of Act III: back up the mountain to the shrine steps, a scene told from how your story
// went (the tolls, who you married, your truest friends, your strongest virtue, what you restored,
// the Archive, the sword), then the credits. The game carries on afterwards as it was.
import { EPILOGUE as E } from './data/epilogue.js';
import { NPCS } from './data/npcs.js';
import { RESTORATIONS } from './data/restorations.js';
import { TOTAL } from './systems/archive.js';
import { Credits } from './ui/credits.js';

const q = (s) => s.replace(/"/g, "'");

/** The lines of the epilogue for this game, in order. */
export function epilogueLines(g) {
  const lines = [E.open];
  lines.push(g.flags.petition_won ? E.petition_won : g.flags.kuroda_signed ? E.kuroda_signed : E.neither);
  const spouse = g.romance?.spouse;
  lines.push(spouse ? E.spouse.replace('{spouse}', NPCS[spouse].name) : E.alone);
  const friends = Object.entries(g.bonds).filter(([id, b]) => b.met && id !== spouse && NPCS[id]).sort((a, b) => b[1].pts - a[1].pts).slice(0, 3).map(([id]) => NPCS[id].name);
  if (friends.length === 3) lines.push(E.friends.replace('{a}', friends[0]).replace('{b}', friends[1]).replace('{c}', friends[2]));
  const top = Object.entries(g.virtues).sort((a, b) => b[1] - a[1])[0][0];
  lines.push(E.virtue[top]);
  const restored = Object.values(RESTORATIONS).filter((r) => g.flags[`restored_${r.id}`]).length;
  lines.push(E.restored[restored >= 6 ? 2 : restored >= 3 ? 1 : 0]);
  if (g.archive && g.archive.donated.length >= TOTAL * 0.75) lines.push(E.archive);
  lines.push(g.flags.sword_rest ? E.rest : E.carry);
  lines.push(E.close);
  return lines;
}

/** Out of the deep to the shrine at dawn, the epilogue, then the credits. */
export function startEpilogue(g) {
  const script = [...epilogueLines(g).map((l) => `say "${q(l)}"`), 'fade out 1.5'].join('\n');
  // The wipe hides the climb; the scene starts as soon as it clears.
  g.warp({ to: 'shrine', tx: 19, ty: 13, dir: 'down' });
  g.pendingScene = { script, onEnd: () => g.modals.push(new Credits(g, { onEnd: () => g.aside('tk_after_credits') })) };
}

