// The farm mailbox. Letters from data/letters.js arrive the morning after their condition holds;
// Okiku also sends word the day before a villager's birthday (once you have met them).
import { LETTERS } from '../data/letters.js';
import { NPCS, NPC_IDS } from '../data/npcs.js';
import { nextDay } from './calendar.js';

const INBOX_MAX = 30;

export function newMail() {
  return { inbox: [], sent: [] };
}

/** Put any newly due letters in the box; returns how many arrived. */
export function deliverMail(g) {
  const m = g.mail;
  let n = 0;
  const send = (letter) => {
    m.sent.push(letter.id);
    m.inbox.unshift({ ...letter, read: false });
    n++;
  };
  for (const l of LETTERS) if (!m.sent.includes(l.id) && l.when(g)) send({ id: l.id });
  const tomorrow = nextDay(g.cal).t;
  for (const id of NPC_IDS) {
    const bd = NPCS[id].birthday;
    const key = `bday_${id}_${g.cal.year}`;
    if (g.bonds[id]?.met && bd.season === tomorrow.season && bd.day === tomorrow.day && !m.sent.includes(key)) send({ id: key, npc: id });
  }
  m.inbox.length = Math.min(m.inbox.length, INBOX_MAX);
  return n;
}

export const unread = (m) => m.inbox.filter((l) => !l.read).length;

/** Sender, text and attachments of an inbox entry. */
export function letterOf(entry) {
  if (entry.npc) {
    const npc = NPCS[entry.npc];
    const loved = npc.gifts.loved[0];
    // Okiku hears everything, except about her own birthday: then Heibei writes.
    return { from: entry.npc === 'okiku' ? 'heibei' : 'okiku', text: null, gossip: { npc: entry.npc, name: npc.name, loved }, items: [] };
  }
  const l = LETTERS.find((x) => x.id === entry.id);
  return { from: l.from, text: l.text, items: l.items };
}
