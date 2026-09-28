// Heart events (2/3): Kaito, Chōbei, Sōken, Rin, Toyo, Kinta.
const rinHere = (g) => g.flags.rin_arrived && ![0, 1].includes(g.dayIndex % 7);

export default {
  kaito: [
    {
      h: 2, map: 'village', from: 780, to: 1080, script: `
        placePlayer 55 20 left
        placeNpc kaito 54 20 right
        say kaito happy "Rival! Race you to the bridge. Loser weeds the winner's paddy for a day!"
        choice "You're on." @race "I'm not weeding your paddy." @no
        @race
        say "You run. Kaito runs. A chicken runs, for reasons of its own. At the bridge you are a head ahead."
        say kaito surprised "You cheated! You... did not cheat. Ugh. Fine. Your paddy. Tomorrow."
        virtue meiyo 2
        goto @end
        @no
        say kaito happy "Coward! Sensible coward. I respect it."
        @end
        bond kaito 30
      `,
    },
    {
      h: 4, map: 'kaito', from: 1080, to: 1260, script: `
        placePlayer 6 5 left
        placeNpc kaito 5 5 right
        say kaito happy "Look! A map of Edo. Real, from a book-seller. Nihonbashi, the castle, a thousand streets."
        say kaito neutral "In Edo you can buy anything. Be anyone. Here I am just the boy from the paddy by the river."
        choice "You could go." @go "The paddy by the river is not nothing." @stay
        @go
        say kaito happy "Maybe I will! One day. When the rice is in. When Mother is well. One day."
        virtue jin 1
        goto @end
        @stay
        say kaito surprised "...Huh. You make it sound like something."
        virtue chugi 2
        @end
        bond kaito 30
      `,
    },
    {
      h: 6, map: 'village', from: 480, to: 840, script: `
        placePlayer 60 52 up
        placeNpc kaito 61 52 up
        say kaito sad "Blight. Half the lower paddy. Brown at the root. I did everything right. I did everything right!"
        choice "Here. Take some of my rice." @rice "Let's pull the bad plants now, together." @pull
        @rice
        take rice 5 @norice
        say kaito surprised "I cannot take your... I will take your rice. Thank you. I will pay it back in autumn. Twice."
        virtue jin 3
        goto @end
        @norice
        say kaito happy "You do not even have any! Ha! Help me pull them, then."
        @pull
        say "You spend the morning knee-deep, pulling brown stalks. By noon the spread has stopped."
        virtue chugi 2
        @end
        bond kaito 40
      `,
    },
    {
      h: 8, map: 'village', from: 1020, to: 1200, script: `
        placePlayer 39 42 up
        placeNpc kaito 40 42 down
        say kaito neutral "The book-seller came back. He has a place for an apprentice in Edo. He asked me."
        say kaito neutral "I have been standing on this bridge for an hour. Upstream is Edo. Downstream is home. The river does not help."
        choice "Go. Come back and tell me everything." @go "Stay. There's a place for you here." @stay
        @go
        say kaito happy "...Maybe for a season. And then I will come back and be insufferable about it."
        setFlag kaito_edo
        virtue jin 2
        goto @end
        @stay
        say kaito happy "Stay. Yes. I think I wanted somebody to say it so I could stop arguing with myself."
        virtue chugi 2
        @end
        bond kaito 30
      `,
    },
    {
      h: 10, map: 'farm', from: 900, to: 1140, script: `
        placePlayer 29 15 right
        placeNpc kaito 30 15 left
        say kaito happy "I brought a sapling. A persimmon. It takes eight years to fruit. Where do you want it?"
        say "You plant it together at the edge of the field. Kaito stamps the earth down very seriously."
        say kaito happy "In eight years we eat persimmons under it and argue about whose paddy is better. Deal? Deal."
        emote kaito heart
        virtue chugi 3
      `,
    },
  ],

  chobei: [
    {
      h: 2, map: 'yorozuya', from: 540, to: 1020, script: `
        placePlayer 6 6 up
        placeNpc chobei 6 4 down
        say chobei neutral "You. Farmer. Your haggling is shameful. You accept the first price like a child."
        say chobei neutral "Lesson: the first price is a greeting. Say 'hm.' Look at the ceiling. Sigh. Watch."
        say "Chōbei sighs at the ceiling for a full ten breaths."
        say chobei happy "...There. Next time you may have one mon off. Only one. It is a matter of principle."
        bond chobei 20
      `,
    },
    {
      h: 4, map: 'yorozuya', from: 540, to: 1020, script: `
        placePlayer 6 6 up
        placeNpc chobei 6 4 down
        say chobei neutral "Your uncle's account. I found it while tidying. Four hundred mon. Seed, rope, a kettle."
        choice "I'll pay it." @pay "Could we... let it go?" @ask
        @pay
        pay 400 @broke
        say chobei surprised "You paid it. Nobody pays an old account. ...Here. The kettle was never collected. Take it. With my respects."
        virtue makoto 3
        give tea 2
        goto @end
        @broke
        say chobei neutral "You do not have four hundred. I can see it in your sleeves. Pay me when you do. I will remember. I always remember."
        goto @end
        @ask
        say chobei neutral "Let it go? Hm. Hm. ...Jirōbei did carry my mother's barrels up the hill every New Year. For free. It is gone."
        virtue jin 1
        @end
        bond chobei 30
      `,
    },
    {
      h: 6, map: 'village', from: 1020, to: 1140, script: `
        placePlayer 30 13 right
        placeNpc chobei 31 13 left
        say chobei angry "Kuroda wants my shop. His clerk said 'we will buy it, one way or another.' One way or another!"
        say chobei neutral "I am stingy. I am rude. I have never cheated a customer in thirty years. That shop is the only thing I ever built."
        choice "We won't let him take it." @fight "What will you do?" @ask
        @fight
        say chobei surprised "We. Hm. We. ...Fine. We."
        virtue gi 2
        goto @end
        @ask
        say chobei neutral "Raise my prices. Out of spite. And keep the door open. Out of more spite."
        @end
        bond chobei 30
      `,
    },
    {
      h: 8, map: 'yorozuya', from: 1020, to: 1140, script: `
        placePlayer 6 6 up
        placeNpc chobei 6 4 down
        say "Chōbei is polishing an old abacus, its beads worn smooth and pale."
        say chobei sad "My father's. He could count a whole cart of rice in the time it takes to sneeze. He died owing nobody anything."
        say chobei neutral "I would like to die owing nobody anything too. Though I would settle for a few people owing me."
        choice "Can I try it?" @try "He'd be proud of the shop." @proud
        @try
        say chobei happy "Carefully! ...Ha, you are terrible. Terrible! Again."
        virtue rei 2
        goto @end
        @proud
        say chobei happy "Hm. Proud. He would say I undercharge. And he would be right."
        virtue chugi 2
        @end
        bond chobei 30
      `,
    },
    {
      h: 10, map: 'yorozuya', from: 540, to: 1020, script: `
        placePlayer 6 6 up
        placeNpc chobei 6 4 down
        say chobei neutral "I have decided something. It is against every principle I hold. From today, you pay nine parts in ten."
        say chobei happy "Do not thank me! Do not tell anyone! If Kaito finds out he will expect the same and I will have to die."
        setFlag chobei_discount
        virtue gi 2
      `,
    },
  ],

  soken: [
    {
      h: 2, map: 'tera', from: 360, to: 720, script: `
        placePlayer 4 6 up
        placeNpc soken 4 5 up
        say soken neutral "Sit. Breathe in for four. Hold for four. Out for four. That is all."
        say "You breathe. A fly lands on your nose. Sōken does not move. The fly leaves. Somehow this is the lesson."
        say soken happy "Good. You fidgeted only eleven times. Kinta fidgets eleven times a breath."
        virtue rei 2
        bond soken 20
      `,
    },
    {
      h: 4, map: 'shrine', from: 540, to: 720, script: `
        placePlayer 10 7 up
        placeNpc soken 10 6 right
        placeNpc tomoe 11 6 left
        say tomoe neutral "The kami are in the mountain, the river, the rice. They were here before the Buddha came."
        say soken happy "And the Buddha, very politely, did not ask them to leave. He brought tea."
        say tomoe happy "...That is not doctrine."
        say soken happy "It is the best doctrine. {name}, settle it. Kami or Buddha?"
        choice "Both. They seem to get along." @both "Whoever brings the tea." @tea
        @both
        say tomoe happy "Hm. Yes. They do get along. Better than priests."
        virtue rei 2
        goto @end
        @tea
        say soken happy "Ha! The farmer understands theology."
        @end
        bond soken 20
        bond tomoe 20
      `,
    },
    {
      h: 6, map: 'tera', from: 1020, to: 1200, script: `
        placePlayer 4 6 up
        placeNpc soken 5 5 down
        say "Sōken lifts a lacquered box from beneath the altar. Inside is a helmet, black, dented over the left eye."
        say soken sad "Mine. I was sixteen. The dent is from a spear I did not see. The man I did not see it from, I did."
        say soken neutral "I keep it to remember that I was that boy too. Kindness is easier if you remember what you were."
        choice "You aren't that boy now." @now "Thank you for showing me." @thanks
        @now
        say soken happy "No. But he is still in here. I give him tea."
        virtue jin 2
        goto @end
        @thanks
        say soken neutral "Thank you for looking. Most people look away."
        virtue rei 2
        @end
        bond soken 30
      `,
    },
    {
      h: 8, map: 'village', from: 1080, to: 1260, script: `
        placePlayer 20 8 up
        placeNpc soken 20 7 down
        say "Sōken stands in the long grass by the old kura, lips moving, counting on his fingers."
        say soken sad "I am naming them. The men from the field. One a night. I am on four hundred and twelve."
        choice "Can I name one with you?" @name "Why do you do it?" @why
        @name
        say soken happy "...Four hundred and thirteen. Jirō, a potter's son from Tamba. He sang badly. Thank you."
        virtue jin 3
        goto @end
        @why
        say soken neutral "Because nobody else will, and because every name I say makes me a little less the boy with the spear."
        virtue makoto 2
        @end
        bond soken 30
      `,
    },
    {
      h: 10, map: 'tera', from: 1140, to: 1380, script: `
        placePlayer 4 6 up
        placeNpc soken 4 5 down
        say soken happy "I wrote a poem. A bad one. I said I would show you when I was dead. I have changed my mind."
        say soken happy "'Old sword in the rafters / the farmer's lantern goes by / even the rust warms.'"
        say soken happy "It is about you. Obviously. Monks are not supposed to be obvious. I am a poor monk."
        emote soken heart
        virtue rei 3
      `,
    },
  ],

  rin: [
    {
      h: 2, map: 'dojo', from: 360, to: 600, when: rinHere, script: `
        placePlayer 6 6 up
        placeNpc rin 6 4 down
        say rin neutral "You wear a sword. Draw with me. Once. I want to see what kind of person you are."
        duel rin @won @lost
        @won
        say rin surprised "...Clean. Cleaner than I expected. Again, another day."
        virtue meiyo 3
        goto @end
        @lost
        say rin neutral "Late. But you did not flinch at the crow. That is something. Again, another day."
        virtue meiyo 1
        @end
        bond rin 30
      `,
    },
    {
      h: 4, map: 'village', from: 600, to: 840, when: rinHere, script: `
        placePlayer 30 13 right
        placeNpc rin 31 13 left
        placeNpc kinta 32 13 left
        say kinta happy "Rin! Rin! Is it true you beat ten bandits at once? Kaito says it was nine."
        say rin neutral "It was three. One was asleep."
        say kinta surprised "Can you teach me? Please? I have a stance. It is called the Falling Tiger."
        choice "Show him something, Rin." @show "He needs to learn to sit still first." @still
        @show
        say rin happy "...Feet here. Weight low. Look at the eyes, not the sword. There. That is the only secret."
        bond kinta 30
        goto @end
        @still
        say rin happy "Correct. Sōken will teach you to sit. Then come to me."
        say kinta angry "Everybody wants me to SIT."
        @end
        bond rin 30
      `,
    },
    {
      h: 6, map: 'dojo', from: 1080, to: 1260, when: rinHere, script: `
        placePlayer 6 6 up
        placeNpc rin 6 5 down
        say rin sad "My village was called Kurohama. It is not on maps now. Men came with a crest of three hollyhock leaves."
        say rin sad "I was eight. I hid in a rice store and listened. I learned the sword so I would never have to listen again."
        choice "Do you still want revenge?" @revenge "You're not in the rice store now." @now
        @revenge
        say rin neutral "I did. Now I want to know why. That is harder to cut."
        virtue gi 2
        goto @end
        @now
        say rin happy "...No. I am in a dōjō in a valley with a farmer who asks the wrong questions. It is better."
        virtue jin 2
        @end
        setFlag rin_story
        bond rin 30
      `,
    },
    {
      h: 8, map: 'kurayama', from: 480, to: 900, when: rinHere, script: `
        placePlayer 14 10 up
        placeNpc rin 15 10 up
        say rin neutral "The mountain. I have been down to the cellars. The spirits there are sick, not wicked. Something is feeding on them."
        say rin neutral "I do not go down with people. I would go down with you."
        choice "Then we go together." @together "Let me handle the mountain." @alone
        @together
        say rin happy "Good. I will watch your left. You always forget your left."
        virtue yu 3
        goto @end
        @alone
        say rin angry "Stubborn. ...I am the same. Come back up."
        virtue yu 1
        @end
        bond rin 30
      `,
    },
    {
      h: 10, map: 'farm', from: 1020, to: 1200, when: rinHere, script: `
        placePlayer 29 15 right
        placeNpc rin 30 15 left
        say rin neutral "I asked Tatsu for a rack. For my sword. On a wall. Not a travelling case."
        say rin happy "I would like the wall to be somewhere on this farm. If you would have it there."
        emote rin heart
        say rin happy "I stopped looking at the road. I told you I would."
        virtue chugi 3
      `,
    },
  ],

  toyo: [
    {
      h: 2, map: 'toyo', from: 480, to: 720, script: `
        placePlayer 6 5 up
        placeNpc toyo 7 5 up
        say toyo happy "Good, you are here. Hands in the bran. No, deeper. It will not bite. It bites a little."
        say "The rice bran is cool and smells of forty summers. Toyo buries a daikon in it like a sleeping child."
        say toyo happy "Miso soup is next. Do not boil the miso. Write it on your hand if you must."
        learn miso_soup
        give tsukemono 1
        bond toyo 20
      `,
    },
    {
      h: 4, map: 'chaya', from: 900, to: 1080, script: `
        placePlayer 6 6 up
        placeNpc toyo 7 5 down
        placeNpc okiku 6 5 down
        say okiku neutral "Toyo says my dango are too sweet. Tell her they are not too sweet."
        say toyo neutral "Toyo says Okiku says that about everything she has ever made."
        choice "They're a little sweet, Okiku." @toyo "They're perfect. Sorry, Toyo." @okiku
        @toyo
        say toyo happy "Ha! Honest child. Okiku, give the honest child a dango."
        virtue makoto 2
        bond toyo 30
        goto @end
        @okiku
        say okiku happy "There! A person of taste."
        bond okiku 30
        @end
        say toyo happy "Forty years we have argued in this room. It is the best room in the valley."
      `,
    },
    {
      h: 6, map: 'toyo', from: 960, to: 1140, script: `
        placePlayer 6 5 up
        placeNpc toyo 5 5 right
        say toyo happy "Winter food. Oden. Daikon, egg, tofu, and a broth that has seen things. Watch."
        say "Toyo cooks with her nose, her hands, and a running commentary on every cook in the valley."
        say toyo happy "Now you know. Do not tell Okiku; she will put it on her menu and charge double."
        learn oden
        bond toyo 30
      `,
    },
    {
      h: 8, map: 'toyo', from: 1140, to: 1320, script: `
        placePlayer 6 5 up
        placeNpc toyo 5 5 right
        say "Kinta is asleep in the futon, one arm around a wooden sword. Toyo speaks very quietly."
        say toyo sad "I am old. My knees know it, my eyes know it. When I am gone, somebody must tell him the salt."
        choice "I'll look after him." @promise "You'll be here for years." @years
        @promise
        say toyo happy "Good. Then I can sleep. I have not slept well in eight years."
        virtue chugi 3
        setFlag toyo_promise
        goto @end
        @years
        say toyo happy "Liar. Kind liar. I will take it."
        virtue jin 2
        @end
        bond toyo 30
      `,
    },
    {
      h: 10, map: 'toyo', from: 480, to: 1080, script: `
        placePlayer 6 5 up
        placeNpc toyo 5 5 right
        say toyo happy "My mother's knife. It has cut ten thousand daikon and never a finger. Mostly."
        say toyo happy "And the tempura. I never teach the tempura. The batter must be cold and angry. There. Now you are family."
        give toyo_knife 1
        learn tempura
        virtue chugi 3
      `,
    },
  ],

  kinta: [
    {
      h: 2, map: 'village', from: 480, to: 720, script: `
        placePlayer 31 17 left
        placeNpc kinta 30 17 right
        say kinta happy "Watch! The Falling Tiger! HYAAAH!"
        say "Kinta leaps, spins, and lands flat on his back in the grass."
        choice "That was incredible." @cheer "Keep your weight low." @advice
        @cheer
        say kinta happy "I KNOW. I'm going to be the best samurai in Shinano."
        bond kinta 30
        goto @end
        @advice
        say kinta surprised "Low? Like a real samurai? ...Like this? HYAH! Oh! I didn't fall!"
        virtue meiyo 1
        @end
      `,
    },
    {
      h: 4, map: 'village', from: 780, to: 1020, script: `
        placePlayer 36 34 down
        placeNpc kinta 37 34 down
        say kinta sad "General's gone. The bucket fell over. He's probably in the river being eaten by a heron."
        say "You search the bank together. Under the third stone, a very small, very angry crab raises both claws."
        say kinta happy "GENERAL! You're alive! You're a hero! You're both heroes!"
        give sawagani 1
        bond kinta 30
      `,
    },
    {
      h: 6, map: 'village', from: 900, to: 1080, script: `
        placePlayer 20 13 right
        placeNpc kinta 21 13 left
        say kinta sad "The Suwa boys said my parents left because I'm a pest. They said samurai aren't pests."
        choice "Your parents left for work, not because of you." @truth "Samurai are sometimes pests. The good ones." @joke
        @truth
        say kinta sad "...Grandma says that too. Maybe it's true if two people say it."
        virtue makoto 2
        goto @end
        @joke
        say kinta happy "Really? Are you a pest? You ARE a pest! Ha!"
        virtue jin 2
        @end
        bond kinta 30
      `,
    },
    {
      h: 8, map: 'farm', from: 540, to: 900, script: `
        placePlayer 29 15 right
        placeNpc kinta 30 15 left
        say kinta happy "I came to help! Grandma said I could! I can pull weeds! I brought a stick for the weeds that fight back!"
        say "Kinta pulls weeds for an hour with tremendous violence and some accuracy. Then he sits in the furrow."
        say kinta neutral "My parents wrote. A real letter. They said they'll come at New Year. I told them about you."
        bond kinta 30
        virtue chugi 2
      `,
    },
    {
      h: 10, map: 'village', from: 480, to: 1080, script: `
        placePlayer 31 17 left
        placeNpc kinta 30 17 right
        say kinta happy "Kneel! No, stand. No, I kneel. That's how it goes."
        say "Kinta kneels in the grass and holds up his wooden sword, flat across both palms."
        say kinta happy "Kinta of Yamabuki swears to serve the house of Hinata. That's you. This is my sword. You keep it. I'll make another."
        give bokken 1
        virtue meiyo 3
      `,
    },
  ],
};
