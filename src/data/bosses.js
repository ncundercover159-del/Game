// What happens when a boss of the deep falls: the scene (the story's beats between Acts II and III),
// what they leave you, and the Inochi the fight hardens into you. Jūbei's fate is chosen in
// caves.js; every boss also sets `boss_<kind>`, raises Yū and opens the ladder down.
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
};
