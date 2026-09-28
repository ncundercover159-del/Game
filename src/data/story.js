// The main story as map-entry scenes in the same form as data/events.js. Acts I and II ("Fallow
// Ground", "Tolls and Seals"): the magistrate's tolls in summer, Rin at the bridge, the Kuroda
// contract (sign it, or refuse and petition the castle), the cracking seal, and the day the
// petition comes back. Act III ("The Way"): an Aizawa retainer at the gate in the second year (or
// once Kurenai has named the Shade); the rest is told under the mountain (data/bosses.js). Letters (data/letters.js) carry the threads between them; the rules
// (tolls, signatures) are in systems/story.js. The Hyakki Yagyō is a festival (data/festivals.js).
import { dayIndex } from '../systems/calendar.js';

const year1Season = (g, s) => g.cal.year > 1 || g.cal.season >= s;

export const STORY = [
  {
    // Act I closes: Ōkubo posts the toll at the crossroads on the first summer day you come to town.
    map: 'village', flag: 'tolls', when: (g) => g.flags.met_heibei && year1Season(g, 1),
    script: `
      placePlayer 46 13 left
      placeNpc okubo 43 13 right
      placeNpc shinsuke 43 14 right
      placeNpc heibei 45 14 up
      say okubo neutral "Headman. By order of this office: from today, a toll on every bale and basket that leaves Yamabuki. One part in ten."
      say heibei surprised "One in ten? My lord, the rice is not even in the ground! The valley cannot..."
      say okubo neutral "The valley will bear what it is asked to bear. That is what valleys are for. Shinsuke, post the notice."
      emote shinsuke ...
      say shinsuke sad "...Yes, my lord."
      face okubo player
      say okubo happy "Ah, Jirōbei's heir. Your crate will be counted like everyone's: a tenth of what it fetches. Do not look at me like that. It is only arithmetic."
      choice "This is robbery." @rob "(Say nothing, and remember his face.)" @quiet
      @rob
      say okubo neutral "Robbery requires a thief. I am a magistrate. Good day."
      virtue yu 1
      goto @end
      @quiet
      virtue makoto 1
      @end
      say heibei sad "Forgive me. I should have argued harder. I am not a brave man. But I will think of something. I promise you that."
    `,
  },
  {
    // Act II opens: in autumn Rin walks up from the Nakasendō, and Shinsuke is on toll duty at the bridge.
    map: 'village', flag: 'rin_arrived', when: (g) => g.flags.tolls && year1Season(g, 2),
    script: `
      placePlayer 41 37 down
      placeNpc shinsuke 38 39 right
      placeNpc rin 40 45 up
      moveNpc rin 40 40 up
      say shinsuke neutral "H-halt. The toll. One part in ten of what you carry. By the magistrate's order."
      say rin neutral "I carry a sword, a bowl and a debt. Which tenth would you like?"
      emote shinsuke !
      say shinsuke sad "...The bowl? No. No. Pass. Please. I did not see you."
      say rin neutral "You did. Remember it. It is good to remember the people you let pass."
      moveNpc rin 41 38 up
      face rin player
      say rin neutral "You. You stand like someone who used to have a lord. I am Rin. I will be at the old dōjō, if its roof holds."
      say rin neutral "This valley is being bled a tenth at a time, and nobody here remembers how to stand up straight. Somebody should teach them."
      virtue rei 1
    `,
  },
  {
    // The branch of Act II: Kuroda's offer, after his clerk's letter has come.
    map: 'village', flag: 'kuroda_offer', when: (g) => g.mail.sent.includes('kuroda_invite'),
    script: `
      placePlayer 49 28 up
      placeNpc okubo 47 27 right
      say okubo neutral "Ah. Punctual. Kuroda-ya wishes to make you an offer. He does not come outside. The sun, he says, has no account with him."
      say kuroda neutral "Farmer. I buy everything that grows, at a better price than Chōbei, straight from your crate. My goods cross the bridge untaxed. Yours would too."
      say kuroda happy "A hired hand waters your fields each morning, at my expense. And five thousand mon today, for your seal on this paper."
      say kuroda neutral "Your neighbours will sell to me as well, in time, at my price. Those who cannot will sell me their fields instead. That is how a valley grows."
      choice "Sign the contract" @sign "Refuse, and stand with the village" @refuse
      @sign
      say "You press your seal to the paper. It feels heavier than paper should."
      money 5000
      virtue gi -10
      virtue jin -5
      bond all -120
      setFlag kuroda_signed
      say okubo happy "A sensible farmer. The valley could use more of those."
      say "Behind you, somebody in the street turns and walks away."
      goto @end
      @refuse
      say kuroda neutral "A pity. The door will be open when the snow comes. It always is."
      say okubo neutral "Refusing a merchant is free. Refusing a magistrate is not. Good day."
      virtue gi 5
      setFlag petition
      @end
    `,
  },
  {
    // The seal on the rear gate splits (or splits again), late in autumn.
    map: 'shrine', flag: 'seal_split', when: (g) => g.cal.year > 1 || (g.cal.season === 2 && g.cal.day >= 20) || g.cal.season > 2,
    script: `
      placePlayer 19 4 up
      placeNpc tomoe 21 4 left
      sfx chill
      ifFlag seal_cracked @again
      say tomoe sad "Look at the charm on the rear gate. It split in the night, top to bottom. Nobody touched it."
      goto @on
      @again
      say tomoe sad "The seal we wrote together... it has split again. Worse, this time. Top to bottom."
      @on
      say tomoe sad "The records say the seals hold the mountain's old anger down. But the anger is growing faster than I can write."
      say tomoe neutral "On the last night of autumn the spirits walk: the Hyakki Yagyō. Come to the shrine that night. Whatever is wrong below, perhaps we will see it with our own eyes."
      setFlag seal_cracked
      virtue chugi 2
    `,
  },
  {
    // The petition comes back from the castle, some days after it went.
    map: 'village', flag: 'petition_won', when: (g) => g.flags.petition_sent !== undefined && dayIndex(g.cal) >= g.flags.petition_sent + 5,
    script: `
      placePlayer 46 13 left
      placeNpc heibei 44 13 right
      placeNpc okubo 43 14 right
      placeNpc shinsuke 45 14 up
      say heibei happy "A rider from the castle! They read the petition. Every name on it. The tolls are overturned, and the magistrate's accounts are to be examined."
      say okubo angry "Examined. By clerks who cannot add. Very well. The valley has its little victory."
      ifFlag ledger_given @ledger
      goto @burn
      @ledger
      say okubo sad "...Shinsuke. It was your hand in that ledger. I know your sevens."
      say shinsuke neutral "Yes, my lord. I am sorry. ...No. I find I am not sorry."
      @burn
      say shinsuke happy "May I? The toll board. I have wanted to do this since summer."
      sfx fire
      say "The toll board burns at the crossroads. Half the village comes out to watch, and Toyo brings pickles."
      virtue gi 5
      bond all 60
    `,
  },
  {
    // Act III: the past catches up. A retainer of the dead clan waits at the farm gate.
    map: 'farm', flag: 'act3', when: (g) => g.cal.year >= 2 || !!g.flags.aizawa_named,
    script: `
      placePlayer 29 12 down
      say "A man in a travel-stained haori waits by your gate. You know the crest on his sleeve before you know his face."
      say soemon neutral "Five years, and you are growing radishes. Sōemon of the Aizawa greets you, as if there were still an Aizawa."
      say soemon sad "Our lord is dead, and will not stay dead. His shade walks the slope beneath Kurayama, the old road to Yomi, and calls the clan's dead to him. Soon he will call the living."
      say soemon neutral "Some of us would answer. A clan again, a war again. They sent me to ask you to lead them. You were his best."
      choice "The clan is gone. I farm now." @farm "I will go down and face him." @face
      @farm
      say soemon sad "...Then farm. But he will not stop at the dead, and you are the only one he ever listened to."
      virtue makoto 3
      goto @end
      @face
      say soemon happy "Of course you will. You never could leave a thing half finished. Neither could he."
      virtue chugi 3
      @end
      say "He bows the old way, very low, and walks back down the valley road."
    `,
  },
];
