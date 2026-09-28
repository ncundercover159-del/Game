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
    id: 'genzo_katana', from: 'genzo', when: (g) => g.flags.needs_katana,
    text: 'Your uncle left his sword with me to mend and never came back for it. I have not mended it. Rust is honest, at least. It is yours now. Bring it to the forge with some iron when you want it to be a sword again. And listen: if it starts talking, you are not going mad. It does that.',
    items: [['katana_rusted', 1]],
  },
  {
    id: 'tomoe_mountain', from: 'tomoe', when: (g) => g.flags.restored_bridge,
    text: 'The gate behind the hall stands open now. Beyond it the path climbs to the old mine of Kurayama, where the seals are weakest. Things live there that used to be kinder. If you go down, take food, and the salve Ume sells, and do not go deeper than you can climb back from. The lanterns in the tunnels, if you can light them, will remember you. Please come back.',
    items: [['salve', 2]],
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

  // Act I-II: the first harvest, the tolls, Kuroda's invitation, the petition.
  {
    id: 'chobei_first', from: 'chobei', when: (g) => g.stats.shippedValue > 0,
    text: 'My man collected your crate last night. Not bad. Not good either, but not bad. Your uncle\'s first crate was three turnips and a frog. The frog was not intentional. Keep shipping and keep the crate dry. Chōbei.',
    items: [],
  },
  {
    id: 'heibei_tolls', from: 'heibei', when: (g) => g.flags.tolls,
    text: 'I am ashamed of this morning. A tenth of everything, and the magistrate smiling as he said it. The villages below pay nothing like it. I do not yet know what to do, but I know it is wrong, and I will not pretend otherwise. If the valley stands together, perhaps we can be heard at the castle. Keep your eyes open, and your crate honest.',
    items: [],
  },
  {
    id: 'kuroda_invite', from: 'Kuroda-ya', when: (g) => g.flags.rin_arrived && dayIndex(g.cal) >= 2 && (g.cal.year > 1 || g.cal.season >= 2) && g.cal.day >= 4,
    text: 'Kuroda-ya, rice merchants of Yamabuki, request the honour of the farmer of Hinata at their door, at the farmer\'s convenience, regarding an arrangement of mutual profit. The magistrate will attend. Tolls, it is understood, are a burden. Burdens can be lifted. By our clerk.',
    items: [],
  },
  {
    id: 'heibei_petition', from: 'heibei', when: (g) => g.flags.petition,
    text: 'You refused Kuroda. The whole street heard. Then let us do this properly: a petition to the castle, against the tolls, with the names of those who will stand behind it. Eight names, and I will send it by rider. Talk to the people who trust you. Not the children, and not, obviously, the magistrate. I have signed first. My hand shook. I signed anyway.',
    items: [],
  },
  {
    id: 'heibei_sent', from: 'heibei', when: (g) => g.flags.petition_sent !== undefined,
    text: 'The rider left at dawn with the petition in oilcloth. Eight names, and one of them mine. Now we wait. The castle is slow, but the castle reads. Pray the magistrate\'s friends there are fewer than he thinks.',
    items: [],
  },
  {
    id: 'kuroda_hand', from: 'Kuroda-ya', when: (g) => g.flags.kuroda_signed,
    text: 'Our arrangement stands. A hand will water the farmer\'s fields at dawn, and all goods in the crate will be bought at the house price, ten parts in a hundred over the village rate, untaxed. Kuroda-ya thanks the farmer for a sensible decision. The weather, the house notes, is turning cold.',
    items: [],
  },

  // Act III.
  {
    id: 'tomoe_yomi', from: 'tomoe', when: (g) => g.flags.act3,
    text: 'The old scrolls call it Yomotsu Hirasaka: the slope between the living and the dead, sealed with a great stone when the world was young. If the shade of your lord walks it, then the seals on our gate were never meant for yōkai at all. They were meant for him. I have written you a charm. It will not stop a sword. It might stop you from forgetting who you are down there. With respect, and worry, Tomoe.',
    items: [['salve', 3]],
  },
  {
    id: 'genzo_tsukikage', from: 'genzo', when: (g) => g.flags.boss_kurenai,
    text: 'So it was the oni forging for someone. I thought as much; their iron was too good. Listen. Bring me your uncle\'s blade, five of tamahagane and five spirit stones, and I will fold them into something that can cut a ghost. I have been waiting forty years to make that sword. Do not make me wait forty-one. Genzō.',
    items: [],
  },
];
