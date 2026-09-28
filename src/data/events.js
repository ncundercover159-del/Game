// Story events that play when you first enter a map (the main story's are in data/story.js).
// Scripts use the language in systems/script.js; `flag` marks the event as seen; `when(game)` can
// hold it back.
import { STORY } from './story.js';

export const EVENTS = [
  {
    // Heibei meets you on the road the first time you walk in from the farm.
    map: 'village', flag: 'ev_welcome', when: (g) => g.player.tx >= 70,
    script: `
      placeNpc heibei 72 13 right
      emote heibei !
      moveNpc heibei 76 13 right
      say heibei surprised "Ah! Ah, you must be Jirōbei's heir! Forgive me, I saw you on the road and my legs ran before my manners."
      say heibei happy "I am Heibei, headman of Yamabuki. Welcome, truly. We have been hoping someone would take up Hinata."
      say heibei neutral "The shops are along this street: Chōbei's store, Okiku's teahouse, Genzō's forge, Ume's apothecary."
      say heibei sad "And the notice board by the crossroads. People post small requests there. There are always more than there are hands."
      choice "I'll help where I can." @help "I came to farm, not to run errands." @farm
      @help
      say heibei happy "Ha! Jirōbei said the same thing, forty years ago. He meant it, too. Here, for the road."
      give dango 2
      virtue jin 2
      bond heibei 40
      goto @end
      @farm
      say heibei neutral "Of course, of course. The land comes first. It always does. Still, the board will be there."
      @end
      say heibei neutral "The shrine is up the stair to the north. Tomoe tends it. If you have a moment, the kami would appreciate a visitor. So would she."
      setFlag met_heibei
    `,
  },
  ...STORY,
];
