// The dōjō's practice: kata with Rin at the makiwara (the rhythm engine) and kyūdō at the target.
// The first round of each a day earns Swordsmanship; Rin says what she thought of it, and a perfect
// round of four arrows (kaichū) earns a quiver the first time.
import { RhythmGame } from './ui/rhythm.js';
import { KyudoGame } from './ui/kyudo.js';
import { Cutscene } from './ui/cutscene.js';
import { dayIndex } from './systems/calendar.js';
import { ARROWS } from './systems/kyudo.js';
import { t } from './data/strings.js';

const XP = { kata: [60, 35, 15], kyudo: [50, 30, 10] };

// Rin's word after a round, by grade (0 best); she is only there to say it if she is in the dōjō.
const RIN = {
  kata: [
    'say rin happy "Clean. Your feet were where your sword was. That is most of it."',
    'say rin neutral "Your cuts were early on the third form. Again tomorrow."',
    'say rin sad "You fought the kata. The kata won. Breathe from lower down."',
  ],
  kyudo: [
    'say rin surprised "...All four. Do not look so pleased. Pleased archers miss."',
    'say rin neutral "You read the wind, mostly. The bow noticed."',
    'say rin neutral "Your arms gave before your eye did. Hold less; loose sooner."',
  ],
};

const rinHere = (g) => g.villagers.get('rin')?.map === 'dojo';

/** Is this the day's first round of `kind`? Marks it done. */
function firstToday(g, kind) {
  const key = `${kind}_day`, day = dayIndex(g.cal);
  if (g.flags[key] === day) return false;
  g.flags[key] = day;
  return true;
}

function after(g, kind, grade, extra = '') {
  const first = firstToday(g, kind);
  if (first) g.xp('sword', XP[kind][grade]);
  const lines = [rinHere(g) ? RIN[kind][grade] : '', rinHere(g) && first ? 'bond rin 15' : '', extra, first ? '' : `say "${t('dojo_again')}"`];
  const script = lines.filter(Boolean).join('\n');
  if (script) g.modals.push(new Cutscene(g, script));
}

/** Kata at the makiwara: Rin leads, so she must be in. */
export function startKata(g) {
  if (!rinHere(g)) { g.say('kata_no_rin'); return; }
  g.sfx('ui_ok');
  g.modals.push(new RhythmGame(g, { kind: 'kata', partner: 'rin', onEnd: (grade) => after(g, 'kata', grade) }));
}

/** Four arrows at the target. */
export function startKyudo(g) {
  g.sfx('ui_ok');
  g.modals.push(new KyudoGame(g, {
    onEnd: (grade, { hits }) => {
      const kaichu = hits === ARROWS && !g.flags.kaichu;
      if (kaichu) g.flags.kaichu = true;
      after(g, 'kyudo', grade, kaichu ? 'give arrow 20' : '');
    },
  }));
}
