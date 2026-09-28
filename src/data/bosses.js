// What happens when a boss of the deep falls: the scene (the story's beats from Act II into III),
// what they leave you, and the Inochi the fight hardens into you. The Shade of Lord Aizawa's scene
// ends Act III with the choice of the sword, then the epilogue (src/epilogue.js). Jūbei's fate is
// chosen in caves.js; every boss also sets `boss_<kind>`, raises Yū and opens the ladder down.
export const OUTCOMES = {
  kappa_elder: {
    items: [['kappa_dish', 1]], inochi: 15, virtue: ['rei', 5],
    script: `
      say "The Kappa Elder sits down heavily in the shallows and bows until his dish nearly touches the water."
      say "'Strong. And polite, which is rarer. For a hundred years my people kept this water sweet for the valley. Then it soured from below, and so did we.'"
      say "'Something burns under the mountain. Its smoke comes down the old channels and into our heads. Go deeper, samurai. Tell the foxes the kappa are sorry for the noise.'"
      say "The water in the moat clears all at once, as if the mountain had let out a breath."
      setFlag kappa_promise
    `,
  },
  kyubi: {
    items: [['kyubi_tail', 1]], inochi: 15, virtue: ['jin', 5],
    script: `
      placeNpc kon 15 14 right
      emote kon !
      say kon sad "...Elder."
      say "The great white fox lowers her head. The foxfire around her gutters and goes out."
      say kon neutral "She went down to find what was souring the halls, and it soured her. We say mother. She is older than that."
      say kon happy "You did not kill her, you know. You only beat the poison out. Foxes remember that sort of thing for a very long time."
      say "Kyūbi breathes once on your hands; it is warm. Then she is gone, and a tuft of white fur lies on the stones."
      say kon neutral "Below us is the foundry. Someone down there is forging weapons out of spirits' anger. Someone who was a lord, once."
      setFlag kyubi_freed
      bond kon 120
    `,
  },
  kurenai: {
    items: [['kanabo', 1]], inochi: 20, virtue: ['yu', 5],
    script: `
      say "Kurenai goes down on one knee. Her armour smokes and ticks as it cools."
      say "'I forged for him. A lord with no body, who came up the Yomi Slope with his banners still wet. He promised us a war worth the name.'"
      say "'Aizawa. You know the name. I can see it in your face, little rōnin.'"
      say "Tsukikage has gone very quiet at your side."
      say "'Take my club. Go down, if you mean to. He waits at the bottom of everything, and he has been asking for you.'"
      setFlag aizawa_named
    `,
  },
  aizawa: {
    items: [], inochi: 0, virtue: ['meiyo', 10], epilogue: true,
    script: `
      say aizawa neutral "Enough. Enough. You were always too stubborn to lose properly."
      say aizawa sad "I brought the clan to ruin for a war the shogun had already forgotten. Then I died, and could not stop giving orders. The dead obey. I wanted them to."
      say aizawa neutral "And you: you planted radishes. Your uncle's blade talks now, I hear. Tsukikage. Moon-shadow."
      say "Tsukikage speaks aloud, for once: 'He is asking what the sword is for.'"
      choice "Lay the sword to rest" @rest "Carry it on" @carry
      @rest
      say "You kneel and lay the blade on the stone between you and your lord, hilt toward him, the way a retainer returns a sword."
      say aizawa happy "Then there is nothing left to command. Good. That is good."
      setFlag sword_rest
      virtue jin 10
      goto @end
      @carry
      say "You sheathe the blade. For the valley, you tell him. For the living, who have fields to bring in."
      say aizawa happy "A sword with a reason. I never had one. Keep it well."
      setFlag sword_carry
      virtue chugi 10
      @end
      say "The shade of Lord Aizawa bows to you, deeper than a lord ever bows, and the dark takes him like morning takes a lantern."
      setFlag act3_done
    `,
  },
};
