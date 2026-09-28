// Heart events (1/3): Genzō, Okiku, Tomoe, Heibei, Ume, Daigo. Each villager has five, at 2, 4, 6,
// 8 and 10 hearts; they play in order when you enter `map` between `from` and `to` (minutes),
// optionally only when `when(game)` holds. Romanceable villagers' 10-heart scene needs courting.
export default {
  genzo: [
    {
      h: 2, map: 'kajiya', from: 540, to: 960, script: `
        placePlayer 4 6 up
        placeNpc genzo 5 5 left
        say genzo neutral "You. Come and see this. No, do not touch it. Look."
        say "Genzō lifts a short blade from a cloth. The steel is grey and cloudy, the edge a little wavy."
        say genzo neutral "My first blade my master did not throw in the river. It is ugly. It is also the most honest thing I ever made."
        choice "Why keep an ugly blade?" @why "It isn't ugly. It's yours." @kind
        @why
        say genzo happy "To remember that ugly and honest can live in the same steel. So can a man."
        virtue makoto 2
        goto @end
        @kind
        say genzo surprised "...Hm. Jirōbei said the same thing, once. Word for word. Get out of my forge before I get sentimental."
        bond genzo 30
        @end
      `,
    },
    {
      h: 4, map: 'shrine', from: 600, to: 840, when: (g) => g.dayIndex % 7 === 6, script: `
        placePlayer 18 13 up
        placeNpc genzo 19 12 up
        say "Genzō stands before the hall, hands together, head bowed a long while."
        face genzo down
        say genzo neutral "I pray for the fire. Every Nichi. The fire does not care, but the praying keeps my hands steady."
        say genzo neutral "That sword of yours. Tsukikage. The mark on the tang belongs to my master's master. It was forged for your clan."
        choice "Tell me more about my clan." @clan "It's just a rusty sword." @rusty
        @clan
        say genzo sad "The Aizawa were proud and unlucky. Pride you can fix. Luck, you can only outlast. Outlast it, then."
        virtue chugi 2
        goto @end
        @rusty
        say genzo angry "It is not rust. It is sleep. Some steel sleeps until the hand is worthy. Be worthy, and see."
        virtue yu 1
        @end
      `,
    },
    {
      h: 6, map: 'kajiya', from: 960, to: 1140, script: `
        placePlayer 4 6 up
        placeNpc genzo 5 5 left
        say genzo neutral "The bellows boy quit. Again. You have arms. Work the bellows."
        sfx fire
        say "You pump the bellows. The coals go from red to orange to a white that hurts to look at."
        say genzo happy "Good. Steady. The fire likes you. That is rarer than you think."
        choice "Can I strike the steel too?" @strike "I'll leave the hammer to you." @leave
        @strike
        sfx rock
        say "Your first blow skids. Your second rings true, and Genzō grunts, which from him is applause."
        give iron_bar 2
        goto @end
        @leave
        say genzo neutral "Wise. The hammer remembers every mistake. Here, for the bellows."
        give iron_bar 1
        @end
        bond genzo 20
      `,
    },
    {
      h: 8, map: 'chaya', from: 1080, to: 1320, script: `
        placePlayer 6 6 up
        placeNpc genzo 7 5 down
        say "Genzō sits over a cup that went cold an hour ago."
        say genzo sad "I made forty blades for the Aizawa retainers. I watched them ride out. Eleven rode back."
        say genzo sad "A smith does not choose where his steel goes. I tell myself that. Some nights it does not take."
        choice "Your blades brought eleven home." @eleven "My uncle never blamed you." @uncle
        @eleven
        say genzo surprised "...Eleven. Yes. I had never counted that way. Eleven."
        virtue jin 3
        goto @end
        @uncle
        say genzo happy "No. He brought daikon every week for thirty years instead. That was how he said it."
        virtue chugi 3
        @end
        bond genzo 30
      `,
    },
    {
      h: 10, map: 'kajiya', from: 480, to: 780, script: `
        placePlayer 4 6 up
        placeNpc genzo 5 5 left
        say genzo happy "Early. Good. Today I show you how to fold steel. Nobody in this valley has seen it but me."
        sfx rock
        say "The morning goes by in heat and rhythm: fold, strike, turn, quench. Genzō speaks only to correct your hands."
        say genzo happy "The anvil goes to you when I am gone. Do not argue; it is written down, and Heibei witnessed it."
        say genzo neutral "And take this. Jewel steel. I have kept it twenty years for a blade worth making. Make it."
        give tamahagane 1
        setFlag genzo_heir
        virtue chugi 3
      `,
    },
  ],

  okiku: [
    {
      h: 2, map: 'chaya', from: 600, to: 1080, script: `
        placePlayer 6 6 up
        placeNpc okiku 6 5 down
        say okiku happy "You! Sit. Taste this. New dango. Honey and a little salt. Be honest. No, be kind. No, be honest."
        choice "Honestly? Too sweet." @honest "Perfect. Don't change it." @kind
        @honest
        say okiku surprised "Too sweet! Chōbei said the same and I threw him out. ...Less honey, then. Thank you, truly."
        virtue makoto 2
        goto @end
        @kind
        say okiku happy "I knew it! Chōbei is a liar and a man with no tongue."
        bond okiku 20
        @end
        give dango 2
      `,
    },
    {
      h: 4, map: 'village', from: 540, to: 780, when: (g) => g.dayIndex % 7 === 3, script: `
        placePlayer 55 20 up
        placeNpc okiku 56 20 left
        say okiku sad "A letter from Kyōto. My old teacher opened a second teahouse. He asks if I will come and run it."
        say okiku neutral "Kyōto! Silk and temples and people who do not smell of rice straw. I would be very important."
        choice "You're important here." @stay "You should go. You'd be wonderful." @go
        @stay
        say okiku happy "...I am, aren't I. Who would tell Yuzu what happened in the morning? The valley would fall apart."
        bond okiku 40
        goto @end
        @go
        say okiku happy "You are sweet. I will not go. But I will keep the letter, and read it when Chōbei is rude."
        virtue jin 2
        @end
      `,
    },
    {
      h: 6, map: 'chaya', from: 1080, to: 1260, when: (g) => g.weather === 'rain', script: `
        placePlayer 6 6 up
        placeNpc okiku 6 5 down
        say "Rain drums on the teahouse roof. Okiku has put out two cups without asking."
        say okiku sad "My husband built this counter. He was terrible at carpentry. It has leaned to the left for twenty years."
        say okiku sad "Tatsu offered to fix it. I said no. Some crooked things are exactly right."
        say okiku happy "You are a good listener. The valley needs listeners more than it needs talkers, and I would know."
        bond okiku 30
        virtue rei 2
      `,
    },
    {
      h: 8, map: 'chaya', from: 540, to: 780, script: `
        placePlayer 6 6 up
        placeNpc okiku 6 5 down
        say okiku happy "Today you learn to make tea properly. Not the tea ceremony, I am not a monster. Just proper tea."
        say "Water not quite boiling. Leaves warmed first. Pour in three turns, not one. Okiku watches your wrist like a hawk."
        say okiku happy "There! Now you can make ochazuke that does not taste of regret."
        learn ochazuke
        give tea 3
        bond okiku 20
      `,
    },
    {
      h: 10, map: 'chaya', from: 600, to: 1080, script: `
        placePlayer 6 6 up
        placeNpc okiku 6 5 down
        say okiku happy "I have named a dango after you. Red bean and chestnut, for the red of your uncle's temper and the brown of your farm."
        say okiku happy "Everyone who orders it has to hear the story of how you came to the valley. I have added some dragons."
        say okiku neutral "And this is my mother's red-rice recipe. I never gave it to anybody. Now I have. Do not make me regret it."
        learn sekihan
        give azuki 3
        setFlag okiku_dango
        virtue rei 2
      `,
    },
  ],

  tomoe: [
    {
      h: 2, map: 'shrine', from: 420, to: 720, script: `
        placePlayer 12 6 right
        placeNpc tomoe 13 6 left
        say tomoe happy "Oh! Good morning. I was sweeping. The kodama used to help. They liked chasing the leaves."
        say tomoe neutral "Kodama are tree spirits, very small, very shy. When the shrine went quiet they went away. I leave rice out anyway."
        choice "I'll leave rice out too." @rice "Do you really believe in them?" @doubt
        @rice
        say tomoe happy "Would you? Just a little, by the cedar. They will know it was you."
        virtue jin 2
        goto @end
        @doubt
        say tomoe neutral "I believe in leaving rice out. What eats it is between the rice and the kodama."
        virtue makoto 1
        @end
        bond tomoe 20
      `,
    },
    {
      h: 4, map: 'honden', from: 840, to: 1080, script: `
        placePlayer 8 7 up
        placeNpc tomoe 8 5 down
        say "Tomoe turns slowly before the altars, sleeves lifting, a bell in one hand. She sees you and stops, very red."
        say tomoe surprised "You were not supposed to see that! It is the kagura. For the festival. I am not good yet."
        choice "It was beautiful." @beautiful "Keep going. I'll watch." @watch
        @beautiful
        say tomoe happy "...Thank you. Nobody has said that since my grandmother."
        bond tomoe 40
        goto @end
        @watch
        say tomoe neutral "Then sit very still and do not laugh. The kami are watching too."
        virtue rei 2
        @end
      `,
    },
    {
      h: 6, map: 'shamusho', from: 600, to: 1020, script: `
        placePlayer 5 6 up
        placeNpc tomoe 5 5 down
        say tomoe sad "Look. The seal talisman from the rear gate. It cracked in the night. Nobody touched it."
        say tomoe sad "The seals hold the mountain's old anger down. If they crack, the spirits in the tunnels suffer first."
        choice "I'll go down and see what's wrong." @go "We'll make a new seal together." @together
        @go
        say tomoe sad "Please be careful. The mountain is not wicked. Something inside it is hurting."
        virtue yu 3
        goto @end
        @together
        say tomoe happy "Together. Yes. I will write, you will hold the paper flat. Your hands are steadier than mine."
        virtue jin 3
        @end
        setFlag seal_cracked
        bond tomoe 20
      `,
    },
    {
      h: 8, map: 'shrine', from: 1020, to: 1200, script: `
        placePlayer 18 14 up
        placeNpc tomoe 19 14 up
        say "The torii throw long shadows down the stair. Tomoe sits on the top step, hugging her knees."
        say tomoe sad "I am the only one left. My grandmother, my mother, now me. If I fail, the shrine fails."
        choice "You don't have to carry it alone." @alone "You won't fail. I've seen you." @fail
        @alone
        say tomoe happy "...No. I suppose I do not, anymore."
        bond tomoe 40
        goto @end
        @fail
        say tomoe happy "You say it like a fact. I will try to believe it like one."
        virtue makoto 2
        @end
      `,
    },
    {
      h: 10, map: 'shrine', from: 1140, to: 1440, script: `
        placePlayer 12 6 up
        placeNpc tomoe 13 6 up
        say "The stars are thick over the shrine. Tomoe points out the Weaver and the Herdsman, and names the small ones only she knows."
        say tomoe happy "When I was little I asked the kami for someone to sit on these steps with. I thought they had not heard."
        face tomoe left
        say tomoe happy "They heard. They are just very slow. Like me."
        emote tomoe heart
        virtue rei 3
      `,
    },
  ],

  heibei: [
    {
      h: 2, map: 'heibei', from: 480, to: 900, script: `
        placePlayer 6 6 right
        placeNpc heibei 7 6 left
        say heibei happy "Ah, come in, come in! Look at this. The valley map my grandfather drew. Every field, every ditch, every argument."
        say heibei neutral "Here is Hinata. Your uncle's fields, and here, the terraces. And here, see? The old onsen, and the Nakasendō."
        say heibei sad "Half of what is on this map is closed or broken now. I keep it to remember what we are trying to get back."
        give kosen 1
        bond heibei 20
      `,
    },
    {
      h: 4, map: 'village', from: 480, to: 780, script: `
        placePlayer 42 13 left
        placeNpc heibei 40 13 right
        placeNpc shinsuke 41 12 down
        say shinsuke sad "Headman, the magistrate's orders. The new count of rice stores, by tomorrow."
        say heibei angry "A count by tomorrow! We are farmers, not abacuses!"
        choice "Shinsuke is only the messenger." @fair "The valley shouldn't bow to this." @stand
        @fair
        say heibei sad "...Yes. Yes, you are right. Forgive me, boy. It is not your paper."
        say shinsuke happy "Thank you. Truly."
        virtue rei 2
        bond shinsuke 30
        goto @end
        @stand
        say heibei happy "There! Somebody with a spine!"
        say shinsuke sad "I will... tell the magistrate the count may be late."
        virtue gi 2
        @end
        bond heibei 20
      `,
    },
    {
      h: 6, map: 'heibei', from: 1080, to: 1260, script: `
        placePlayer 6 6 right
        placeNpc heibei 7 6 left
        say "Heibei unfolds a letter so often folded that the creases have worn through."
        say heibei sad "My wife wrote this when she went to her sister's in Suwa. She never came back; the fever took her there."
        say heibei sad "She wrote: look after the village, and let the village look after you. I have managed half of that."
        choice "Let us look after you now." @us "She'd be proud of the half you managed." @proud
        @us
        say heibei happy "Hah. You sound like her. That is not fair of you."
        virtue jin 3
        goto @end
        @proud
        say heibei happy "Would she? I think she would say I talk too much. She would be right."
        virtue chugi 2
        @end
        bond heibei 30
      `,
    },
    {
      h: 8, map: 'village', from: 900, to: 1080, script: `
        placePlayer 55 20 up
        placeNpc heibei 56 20 left
        say heibei neutral "The tolls. The contract. Kuroda. I am an old man and I do not know how to fight men who fight with paper."
        say heibei neutral "But you came to this valley with nothing and made it answer. Stand with us. Whatever you decide about Kuroda, stand with us."
        choice "I'll stand with the valley." @stand "I'll decide when the time comes." @wait
        @stand
        say heibei happy "Then the valley stands a little taller."
        virtue gi 3
        setFlag heibei_promise
        goto @end
        @wait
        say heibei neutral "Fair. A promise made too early is a promise made twice."
        virtue makoto 2
        @end
        bond heibei 20
      `,
    },
    {
      h: 10, map: 'heibei', from: 480, to: 1080, script: `
        placePlayer 6 6 right
        placeNpc heibei 7 6 left
        say heibei happy "I have talked with the elders. It is decided. You are Yamabuki's honorary elder. The youngest we have ever had."
        say heibei happy "It means nothing and everything. You may sit at the front at festivals and argue about ditches with me. Congratulations."
        give onigiri 5
        setFlag village_elder
        virtue meiyo 5
      `,
    },
  ],

  ume: [
    {
      h: 2, map: 'yakuya', from: 600, to: 1080, script: `
        placePlayer 5 5 up
        placeNpc ume 5 3 down
        say ume neutral "You. Farmer. Test."
        say "She drops three dried leaves on the counter."
        say ume neutral "One settles a stomach, one stops bleeding, one kills a horse. Which is which?"
        choice "The grey one stops bleeding." @right "The green one settles a stomach?" @wrong
        @right
        say ume surprised "...Correct. How annoying. Somebody taught you something."
        virtue makoto 1
        bond ume 40
        goto @end
        @wrong
        say ume angry "That one kills the horse. Please do not treat any horses."
        say ume happy "Here. A salve, so you live long enough to learn."
        give salve 1
        @end
      `,
    },
    {
      h: 4, map: 'grove', from: 360, to: 660, script: `
        placePlayer 40 24 left
        placeNpc ume 38 24 right
        say ume neutral "Keep up. And do not step on anything green. Everything green is somebody's medicine."
        say "Ume moves through the grove like she owns it, pointing out roots and shoots with her chin."
        say ume happy "Warabi. The curled ones. Picked young they are sweet, picked old they are poison. Like people."
        give warabi 3
        give zenmai 2
        bond ume 30
      `,
    },
    {
      h: 6, map: 'yakuya', from: 780, to: 1080, script: `
        placePlayer 5 5 up
        placeNpc ume 5 3 down
        placeNpc kinta 4 5 up
        say kinta sad "It does not hurt. It does not hurt. It hurts a bit."
        say ume neutral "Hold him still. Kinta, look at the farmer, not at me. Tell the farmer about your crab."
        choice "Tell me about General." @crab "Be brave like a samurai." @brave
        @crab
        say kinta happy "General is the fiercest crab in the river and he ate a whole worm yesterday and-- done? Done already?"
        virtue jin 2
        goto @end
        @brave
        say kinta angry "I AM brave! OW. ...Oh. Done?"
        virtue yu 1
        @end
        say ume happy "You are useful. I will pretend I did not say that."
        bond ume 30
        bond kinta 30
      `,
    },
    {
      h: 8, map: 'village', from: 1140, to: 1320, script: `
        placePlayer 64 13 up
        placeNpc ume 65 13 up
        say "Laughter spills from the bathhouse. Ume stops outside it, arms folded."
        say ume neutral "Yuzu and I raced along this street every day when we were eight. She always won. She always will."
        say ume sad "She got the smiling and I got the herbs. People come to her to feel better and to me when they are worse."
        choice "People come to you to get better." @better "Go in. She'd like that." @go
        @better
        say ume surprised "...That is a kinder way of saying it than I deserve."
        bond ume 40
        goto @end
        @go
        say ume happy "Maybe I will. For one bath. Do not tell her I came because you told me to."
        bond yuzu 30
        virtue jin 2
        @end
      `,
    },
    {
      h: 10, map: 'yakuya', from: 1020, to: 1140, script: `
        placePlayer 5 5 up
        placeNpc ume 5 3 down
        say ume neutral "Hold out your hand. No, the other one."
        say "She ties a little bag of dried herbs around your wrist with a green cord."
        say ume happy "Mugwort, for courage. Shiso, for appetite. And something for the heart that I will not name, because then you would laugh."
        emote ume heart
        say ume happy "Do not take it off. I made it badly on purpose so I would have to make you another."
        virtue jin 3
      `,
    },
  ],

  daigo: [
    {
      h: 2, map: 'village', from: 400, to: 720, script: `
        placePlayer 30 39 down
        placeNpc daigo 31 39 down
        say daigo happy "Friend! Look at the water. No, really look. See where it goes smooth over the stones? That is where the fish rest."
        say daigo neutral "Cast above the smooth, let it drift in. The fish think it came from upstream. Fish are very trusting. Like me."
        give uke 1
        bond daigo 20
      `,
    },
    {
      h: 4, map: 'daigo', from: 1020, to: 1260, script: `
        placePlayer 4 5 right
        placeNpc daigo 5 5 left
        say daigo happy "Sit, sit! You want to hear about the flood year? Everyone has heard it. You have not. Wonderful."
        say daigo happy "The bridge went, the river was the colour of miso, and I rowed the whole village across. Chōbei twice; he forgot his abacus."
        choice "You're a hero, Daigo." @hero "Did you ever get paid?" @paid
        @hero
        say daigo happy "No, no. I was just the one with the boat. Everyone would have done it. ...Say it again, though."
        bond daigo 40
        goto @end
        @paid
        say daigo happy "Paid! Ha! Okiku gave me dango for a year. That is better than money."
        virtue makoto 1
        @end
      `,
    },
    {
      h: 6, map: 'village', from: 780, to: 1020, script: `
        placePlayer 30 39 down
        placeNpc daigo 31 39 down
        placeNpc kinta 29 39 down
        say kinta surprised "General! He's in the river! He escaped!"
        say daigo neutral "Kinta, stay on the bank! The current is fast under the bridge."
        choice "I'll grab the crab." @grab "Kinta, stay back. Daigo, go!" @daigo
        @grab
        say "You wade in to the knees, cold as snow, and scoop the indignant crab out with both hands."
        virtue yu 2
        bond kinta 40
        goto @end
        @daigo
        say "Daigo is in the river before you finish the sentence and comes up grinning, crab in hand."
        virtue jin 2
        bond daigo 30
        @end
        say daigo happy "The river gives, the river takes, the river gives back crabs. Good day."
      `,
    },
    {
      h: 8, map: 'daigo', from: 1080, to: 1320, when: (g) => g.weather === 'rain', script: `
        placePlayer 4 5 right
        placeNpc daigo 5 5 left
        say daigo sad "I had a brother. Taichi. Younger. He wanted to catch the moon carp at the falls."
        say daigo sad "One autumn he went up alone at night. The pool is deep there. I talk too much so I do not hear the quiet he left."
        choice "Tell me about him." @tell "I'll catch the moon carp. For him." @carp
        @tell
        say daigo happy "He laughed like a goose. He could not cook. He was the best of us."
        virtue jin 3
        goto @end
        @carp
        say daigo surprised "...You would? Then I will tell you the way he told me: clear night, full moon, autumn, late. And do not go alone."
        virtue yu 2
        setFlag daigo_carp
        @end
        bond daigo 30
      `,
    },
    {
      h: 10, map: 'village', from: 1140, to: 1380, script: `
        placePlayer 35 39 right
        placeNpc daigo 36 39 left
        say "Daigo has the ferry boat out under the bridge, a lantern hanging from its prow."
        say daigo happy "Get in. No, it will not sink. Probably. I want to show you the river at night."
        say "The water is black and full of stars. Daigo does not talk at all for a long time, which is the loudest thing he has ever said."
        say daigo happy "There. That quiet. I do not mind it, with you in the boat."
        emote daigo heart
        virtue jin 3
      `,
    },
  ],
};
