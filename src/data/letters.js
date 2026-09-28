// Letters (fumi 文) that arrive in the farm mailbox the morning after their condition first holds.
// `from` is a villager id or a plain name; `items` are attached and collected when the letter is
// read. Jirōbei's letters were left with Heibei, to be sent on "as the farm needs them".
import { dayIndex } from '../systems/calendar.js';

export const LETTERS = [
  {
    id: 'uncle_1', from: 'Jirōbei', when: (g) => dayIndex(g.cal) >= 1,
    text: 'If you are reading this, the fever won and the farm is yours. Do not grieve long; the weeds will not. Every seed has its season: the store in the village sells only what will grow now. Put what you harvest in the crate by the door and Chōbei\'s man collects it at night. Rest when you are tired. The land will wait for a man who rests. It will not wait for a dead one. Some komatsuna seed, from my own saving.',
    items: [['seed_komatsuna', 5]],
  },
  {
    id: 'okiku_welcome', from: 'okiku', when: (g) => g.bonds.okiku?.met,
    text: 'What a pleasure to meet you! Jirōbei used to sit by my window every market day and tell me the farm was going to ruin. I suspect he was proud of that. Here are two dango, one for you and one for the walk home. Come back soon. I will have questions.',
    items: [['dango', 2]],
  },
  {
    id: 'heibei_board', from: 'heibei', when: (g) => g.flags.met_heibei && dayIndex(g.cal) >= 3,
    text: 'Forgive an old man\'s letter. The notice board by the crossroads has requests from the villagers. Nothing grand: a basket of greens here, a parcel carried there. Each one you take on is a little weight lifted. Payment is modest. Gratitude is not. Two rice balls for your trouble.',
    items: [['onigiri', 2]],
  },
  {
    id: 'daigo_rod', from: 'daigo', when: (g) => g.bonds.daigo?.met,
    text: 'Friend! A farmer who does not fish is only half fed. Here is my old bamboo rod; it has caught more fish than I have. Cast from any bank. When the float dips, strike, then hold the line and ease it, hold and ease. Ayu in summer, eels on warm nights. And at the falls in the Hollow Grove... well. Come and ask me about the moon.',
    items: [['rod', 1]],
  },
  {
    id: 'uncle_2', from: 'Jirōbei', when: (g) => dayIndex(g.cal) >= 5,
    text: 'You will have seen the terraces north of the house, fenced off. I stopped working them when the shrine went quiet. Call it superstition. The old people say the valley gives what the shrine is given. Seven altars, seven virtues. Fill them and see. I never managed it; my virtues were mostly stubbornness. A little tea, for the climb.',
    items: [['tea', 2]],
  },
  {
    id: 'tomoe_altars', from: 'tomoe', when: (g) => g.flags.seen_honden,
    text: 'Thank you for visiting the shrine hall. I should explain the altars properly. Each honours a virtue, and each asks for offerings in its season. When an altar is full, the scrolls say, something of the valley is restored. I do not know what. I would very much like to find out. With respect, Tomoe.',
    items: [],
  },
  {
    id: 'kaito_rice', from: 'kaito', when: (g) => g.cal.season === 0 && g.cal.day >= 10,
    text: 'Rival! Rice goes in soon. Dig a channel from your pond or the river and plant beside the running water; the paddy floods itself. Here is seed from my own line. If yours comes up better than mine I will eat my straw hat. I will not have to.',
    items: [['seed_rice', 8]],
  },
  {
    id: 'uncle_summer', from: 'Jirōbei', when: (g) => g.cal.season >= 1 || g.cal.year > 1,
    text: 'Summer. The tsuyu rains water your fields for you for ten days, so use the time to rest your back. Later come storms. In autumn, twice, a typhoon: spread hay over the beds you care about and the wind will spare them. I learned that the expensive way.',
    items: [['hay', 10]],
  },
  {
    id: 'genzo_upgrade', from: 'genzo', when: (g) => g.flags.upgraded_once,
    text: 'The edge on that tool will hold if you let it. Clean it after rain. Oil it in winter. Do not use it to pry stones. Jirōbei used his to pry stones. Genzō.',
    items: [],
  },
  {
    id: 'chobei_autumn', from: 'chobei', when: (g) => g.cal.season >= 2 || g.cal.year > 1,
    text: 'Autumn stock is in: turnip, burdock, sweet potato, soba, beans. My prices are fair. My prices are always fair. Enclosed, five turnip seeds, which are free this once and never again. Chōbei, Yorozuya.',
    items: [['seed_kabu', 5]],
  },
  {
    id: 'ume_winter', from: 'ume', when: (g) => g.cal.season >= 3 || g.cal.year > 1,
    text: 'Winter. Keep your feet dry, your hearth lit and your pride in check. If you feel a fever coming, come to the shop before it arrives, not after. One tonic, enclosed. Do not waste it on a hangover. Ume.',
    items: [['tonic', 1]],
  },
];
