// Heart events (3/3): Tatsu, Yuzu, Sakuya, Ōkubo, Shinsuke, Kon.
const market = (g) => [3, 4].includes(g.dayIndex % 7);
const doNight = (g) => g.dayIndex % 7 === 5;

export default {
  tatsu: [
    {
      h: 2, map: 'tatsu', from: 540, to: 1020, script: `
        placePlayer 4 6 right
        placeNpc tatsu 5 6 left
        say tatsu neutral "Here. The plane. Long strokes. Do not push down. Let the blade find the grain."
        say "Your first curl of wood tears. Your fifth comes off whole, thin enough to see light through."
        say tatsu happy "...There. That one. Keep that one."
        choice "Keep the shaving?" @keep "Can I try the joinery?" @join
        @keep
        say tatsu neutral "Yes. The first good one. I kept mine for twenty years. It is in the drawer with my father's chisel."
        bond tatsu 30
        goto @end
        @join
        say tatsu happy "Next time. Joinery is not a thing you try. It is a thing you give a year to."
        virtue makoto 1
        @end
      `,
    },
    {
      h: 4, map: 'shrine', from: 480, to: 960, when: (g) => g.dayIndex % 7 === 6, script: `
        placePlayer 24 7 up
        placeNpc tatsu 24 6 up
        say "Tatsu is on his knees by the hall's back steps, fitting a new tread into the old stone without a single nail."
        say tatsu neutral "The shrine pays nothing. The shrine does not need to. When the bell tower fell, I made a promise to the kami."
        choice "What promise?" @promise "Need a hand?" @help
        @promise
        say tatsu neutral "That I would keep it standing as long as my hands work. It is a small promise. My hands are strong."
        virtue chugi 2
        goto @end
        @help
        say tatsu happy "Hold this. Do not move. ...Good. You are very good at not moving."
        virtue rei 2
        @end
        bond tatsu 30
      `,
    },
    {
      h: 6, map: 'tatsu', from: 1020, to: 1140, script: `
        placePlayer 4 6 right
        placeNpc tatsu 5 6 left
        say tatsu sad "My father built the Kuroda-ya. The best joinery in the valley. Kuroda paid him half and called it generous."
        say tatsu sad "He did not argue. He never argued. He died with the other half still owed. I do not go into that building."
        choice "Kuroda should pay what he owes." @owed "Your father's work still stands." @stands
        @owed
        say tatsu neutral "Yes. He should. I have stopped expecting should."
        virtue gi 3
        goto @end
        @stands
        say tatsu happy "...It does. Every beam true. That is the other half. Kuroda cannot keep that."
        virtue jin 2
        @end
        bond tatsu 30
      `,
    },
    {
      h: 8, map: 'farm', from: 900, to: 1080, script: `
        placePlayer 29 15 right
        placeNpc tatsu 30 15 left
        say tatsu neutral "A bench. For outside your house. For sitting and looking at the fields. You never sit."
        say "Tatsu sets it by the door: cedar, pegged, the seat smoothed to the curve of a person."
        say tatsu happy "Sit. ...See? The fields look better from here. That is carpentry."
        setFlag tatsu_bench
        bond tatsu 30
      `,
    },
    {
      h: 10, map: 'house_farm', from: 1080, to: 1320, script: `
        placePlayer 6 7 up
        placeNpc tatsu 7 7 up
        say tatsu neutral "I said I left a hidden joint in every house I build. Yours is here. The post by the hearth."
        say "He shows you: a tiny dovetail, perfect, invisible unless you know. Carved into it, smaller than a rice grain, two characters."
        say tatsu happy "Your name. And mine. Nobody else will ever see it. That is how I sign the things that matter."
        emote tatsu heart
        virtue makoto 3
      `,
    },
  ],

  yuzu: [
    {
      h: 2, map: 'sento', from: 900, to: 1320, script: `
        placePlayer 5 6 up
        placeNpc yuzu 6 6 left
        say yuzu happy "First bath is free for new friends! Get in, get in. I will stand outside and tell you everything."
        say "You soak. Yuzu, through the screen, explains Chōbei's singing, Kaito's crush on a heron, and why Okiku will not sit near the window."
        say yuzu happy "Half of that was true! You will never know which half. Welcome to Yamabuki."
        bond yuzu 30
      `,
    },
    {
      h: 4, map: 'village', from: 540, to: 720, script: `
        placePlayer 64 17 left
        placeNpc yuzu 63 17 right
        say yuzu sad "I told Okiku that Daigo was going to propose to the heron. As a joke! Now half the valley thinks Daigo is marrying a heron."
        say yuzu sad "Daigo is very upset. The heron is also upset. I think. It is hard to tell with herons."
        choice "Tell everyone it was a joke." @truth "It'll blow over. Let it." @let
        @truth
        say yuzu neutral "...Yes. You are right. It will be very embarrassing. Come with me so I do not run away."
        virtue makoto 3
        bond daigo 20
        goto @end
        @let
        say yuzu happy "It will! By next week it will be a crane. Then a stork. Then nothing."
        @end
        bond yuzu 30
      `,
    },
    {
      h: 6, map: 'sento', from: 1320, to: 1440, script: `
        placePlayer 5 6 up
        placeNpc yuzu 6 6 left
        say "Closing time. Yuzu sits on the edge of the empty tub, feet in the cooling water."
        say yuzu sad "My mother ran the onsen up the mountain. Real springs, three pools, travellers from Edo. Then the rocks came down."
        say yuzu sad "She built this little bath to have somewhere to put her hands. She never stopped looking up the mountain."
        choice "Maybe the onsen can be opened again." @onsen "She built something good here." @good
        @onsen
        say yuzu happy "Do you think so? The shrine... Tomoe says the Altar of Meiyo remembers the springs. Maybe."
        virtue meiyo 2
        goto @end
        @good
        say yuzu happy "She did. Tatsu keeps the tub. I keep the gossip. She would laugh."
        virtue jin 2
        @end
        bond yuzu 30
      `,
    },
    {
      h: 8, map: 'village', from: 1080, to: 1260, script: `
        placePlayer 39 39 down
        placeNpc yuzu 38 39 down
        say yuzu happy "The river goes to the sea. Did you know? All of it. This exact water, in a few weeks, will be salt."
        say yuzu neutral "I have never seen the sea. I tell everybody's secrets. That one is mine."
        choice "We'll go and see it. One day." @sea "The sea's too big. The river suits you." @river
        @sea
        say yuzu happy "Promise? No, do not promise. Just say 'one day' again."
        virtue jin 2
        setFlag yuzu_sea
        goto @end
        @river
        say yuzu happy "Hm. Small, and gossipy, and always going somewhere. Yes. I am a river."
        @end
        bond yuzu 30
      `,
    },
    {
      h: 10, map: 'sento', from: 1320, to: 1440, script: `
        placePlayer 5 6 up
        placeNpc yuzu 6 6 left
        say yuzu happy "Closing time again. I saved the best rumour for you. Ready? It is about someone in this room."
        say yuzu happy "The rumour is that the bathhouse keeper has been in love with a certain farmer since the first free bath."
        emote yuzu heart
        say yuzu happy "That one is completely true. You may tell everyone."
        virtue makoto 3
      `,
    },
  ],

  sakuya: [
    {
      h: 2, map: 'village', from: 480, to: 1020, when: market, script: `
        placePlayer 50 19 up
        placeNpc sakuya 50 17 down
        say sakuya happy "A haggling lesson, free, because you are hopeless. I say three hundred for this fan. You say?"
        choice "One hundred." @low "Two hundred and eighty." @high
        @low
        say sakuya happy "Insulting! Wonderful! Now we meet at two hundred, I pretend it hurts, you pretend you won. Business."
        virtue meiyo 1
        goto @end
        @high
        say sakuya sad "You are going to be robbed in every market in Japan. Come to me first; I will rob you gently."
        @end
        bond sakuya 30
      `,
    },
    {
      h: 4, map: 'chaya', from: 1080, to: 1260, when: market, script: `
        placePlayer 6 6 up
        placeNpc sakuya 7 5 down
        say sakuya neutral "My husband ran boats out of Sakai. He was always late for everything. It was charming until it was not."
        say sakuya sad "A storm, a buyer in a hurry, a boat that should have waited in harbour. I have not been late for anything since."
        choice "You're allowed to be late sometimes." @late "You carry him with you on the road." @road
        @late
        say sakuya happy "...Allowed. Nobody has ever allowed me anything. I might try it. Once."
        virtue jin 2
        goto @end
        @road
        say sakuya neutral "I do. He is very heavy and complains about the prices."
        virtue chugi 2
        @end
        bond sakuya 30
      `,
    },
    {
      h: 6, map: 'village', from: 480, to: 1020, when: market, script: `
        placePlayer 50 19 up
        placeNpc sakuya 50 17 down
        say sakuya happy "A proposition. Jade from your mountain fetches a fortune in Ōsaka. Bring me some, we split the profit."
        choice "Here, take this jade." @jade "I'll bring some later." @later
        @jade
        take jade 1 @none
        money 600
        say sakuya happy "Six hundred, and the trip is mine. Partner."
        virtue meiyo 1
        goto @end
        @none
        say sakuya happy "You do not have any. Ha. Come back with green in your pockets."
        goto @end
        @later
        say sakuya neutral "Later, the rarest coin. I will wait. Not long."
        @end
        bond sakuya 30
      `,
    },
    {
      h: 8, map: 'farm', from: 1020, to: 1140, when: market, script: `
        placePlayer 29 15 right
        placeNpc sakuya 30 15 left
        say sakuya neutral "So this is where it grows. The daikon I sell in Suwa, the rice in Matsumoto. This mud."
        say sakuya happy "I have sold ten thousand things and never once seen where one came from. It is prettier than I expected. So are you."
        bond sakuya 40
        virtue rei 2
      `,
    },
    {
      h: 10, map: 'chaya', from: 1080, to: 1260, when: market, script: `
        placePlayer 6 6 up
        placeNpc sakuya 7 5 down
        say sakuya neutral "I sold my best silk in Kōfu and felt nothing. Then I bought you this, and felt everything."
        say "A hairpin of dark wood, with a single red bead like a berry."
        say sakuya happy "That is how I knew. A merchant who stops counting. It has never happened in the history of merchants."
        emote sakuya heart
        virtue makoto 3
      `,
    },
  ],

  okubo: [
    {
      h: 2, map: 'daikansho', from: 360, to: 600, script: `
        placePlayer 7 6 up
        placeNpc okubo 6 3 down
        say okubo neutral "Hinata. Sit. The land register shows three terraces. My surveyor counts four. Explain."
        choice "It's three terraces and a ditch." @honest "Your surveyor needs glasses." @rude
        @honest
        say okubo neutral "A ditch. Hm. Very well. The register stands. Honesty is inconvenient but it files neatly."
        virtue makoto 2
        goto @end
        @rude
        say okubo angry "My surveyor is my nephew. His glasses are excellent. Get out."
        virtue gi 1
        @end
        bond okubo 20
      `,
    },
    {
      h: 4, map: 'daikansho', from: 690, to: 1080, script: `
        placePlayer 7 6 up
        placeNpc okubo 6 3 down
        say okubo sad "My father farmed four tan of poor rice in Musashi. He died owing a clerk forty bales. I went to the funeral in borrowed sandals."
        say okubo neutral "I decided then to be the clerk. It is better to be the one holding the ledger. You understand."
        choice "I understand. I don't agree." @disagree "You could hold it differently." @differently
        @disagree
        say okubo neutral "Nobody agrees with me. That is how I know I am doing my job."
        virtue gi 2
        goto @end
        @differently
        say okubo surprised "...Differently. What a strange word to say to a magistrate."
        virtue jin 2
        @end
        bond okubo 30
      `,
    },
    {
      h: 6, map: 'village', from: 600, to: 690, script: `
        placePlayer 45 7 right
        placeNpc okubo 46 7 left
        placeNpc toyo 47 7 left
        say "Toyo walks away from the magistrate's gate with a sack of rice she did not arrive with. Ōkubo sees you see."
        say okubo angry "That did not happen. It is a clerical error. There is no record of it."
        choice "I didn't see anything." @keep "Why hide being kind?" @why
        @keep
        say okubo neutral "Good. You are learning how the valley works."
        virtue rei 2
        goto @end
        @why
        say okubo sad "Because a kind magistrate is a weak magistrate, and weak magistrates are replaced by worse ones."
        virtue makoto 2
        @end
        bond okubo 30
      `,
    },
    {
      h: 8, map: 'daikansho', from: 690, to: 1080, script: `
        placePlayer 7 6 up
        placeNpc okubo 6 3 down
        say okubo neutral "Kuroda's numbers. Look at them. No, do not touch. Look."
        say okubo neutral "The toll receipts, the rice he says he bought, the rice the castle says it received. Three numbers. They should be one."
        say okubo sad "I built this valley's arithmetic. It no longer adds up. I do not know whose sleeve the difference is in. I fear it is partly mine."
        virtue gi 2
        setFlag okubo_doubts
        bond okubo 30
      `,
    },
    {
      h: 10, map: 'daikansho', from: 360, to: 600, script: `
        placePlayer 7 6 up
        placeNpc okubo 6 3 down
        say okubo neutral "The salt tax is lowered. A clerical error. And this, the office garden. The deed is in your name. I tended it myself."
        say okubo happy "Tea? Yes. During office hours. Let the expectations fall where they may."
        setFlag okubo_garden
        virtue rei 3
      `,
    },
  ],

  shinsuke: [
    {
      h: 2, map: 'village', from: 480, to: 720, script: `
        placePlayer 41 13 left
        placeNpc shinsuke 40 13 right
        say shinsuke neutral "Nothing to report. Nothing is ever to report. I have written 'nothing' four hundred times this year."
        say shinsuke happy "Sōken lent me a poetry book. Do you understand poetry? I read one about a frog for an hour."
        choice "The frog is the point." @frog "Nobody understands poetry." @nobody
        @frog
        say shinsuke surprised "The frog is the point! ...I am going to go and look at a frog."
        virtue rei 1
        goto @end
        @nobody
        say shinsuke happy "Oh, thank goodness."
        @end
        bond shinsuke 30
      `,
    },
    {
      h: 4, map: 'chaya', from: 720, to: 840, when: (g) => g.weather === 'rain', script: `
        placePlayer 6 6 up
        placeNpc shinsuke 7 5 down
        say shinsuke happy "Burnt dango! Okiku saves them for me. I pretend I prefer them. I do prefer them now. That is how pretending works."
        say shinsuke sad "My father wanted a son with a sword. My mother wanted a son with a post. They both got something in between."
        choice "Something in between is fine." @fine "What did you want?" @want
        @fine
        say shinsuke happy "Is it? Maybe it is. Have a burnt dango."
        give dango 1
        virtue jin 2
        goto @end
        @want
        say shinsuke neutral "...Books. A small house. A garden. Nobody has ever asked. Thank you for asking."
        virtue rei 2
        @end
        bond shinsuke 30
      `,
    },
    {
      h: 6, map: 'daikansho', from: 1200, to: 1380, script: `
        placePlayer 9 6 right
        placeNpc shinsuke 10 6 left
        say shinsuke sad "Please close the door. I need to show someone this or I will be sick."
        say "He opens a thin ledger. The real counts of rice, the real toll receipts, in his small careful hand."
        say shinsuke sad "The magistrate writes the smaller number. The difference goes to Kuroda. I have written it all down. I do not know why."
        choice "You know why." @why "Keep it safe. For now." @safe
        @why
        say shinsuke sad "...Yes. I do. I am afraid of what I know."
        virtue gi 2
        goto @end
        @safe
        say shinsuke neutral "For now. Yes. I can do 'for now'."
        virtue makoto 2
        @end
        setFlag shinsuke_ledger
        bond shinsuke 30
      `,
    },
    {
      h: 8, map: 'village', from: 900, to: 1080, script: `
        placePlayer 61 13 left
        placeNpc shinsuke 60 13 right
        say shinsuke neutral "I am practising saying no. To small things. The magistrate asked me to fetch his sandals. I said no."
        say shinsuke happy "He was so surprised he fetched them himself. I have not been this frightened or this happy in years."
        choice "Next, a bigger no." @bigger "Careful. Little by little." @careful
        @bigger
        say shinsuke neutral "A bigger no. Yes. I know which one. Give me until the harvest."
        virtue gi 2
        goto @end
        @careful
        say shinsuke happy "Little by little. Like a garden."
        virtue jin 1
        @end
        bond shinsuke 30
      `,
    },
    {
      h: 10, map: 'village', from: 780, to: 1080, script: `
        placePlayer 55 20 up
        placeNpc shinsuke 56 20 left
        placeNpc heibei 57 20 left
        say shinsuke neutral "Headman. This is the true ledger of the valley. Every bale, every toll. It belongs to you, not to me."
        say heibei surprised "Boy... you know what this costs you."
        say shinsuke happy "I know what it cost everybody else. That is enough arithmetic."
        setFlag ledger_given
        virtue gi 5
        bond heibei 30
      `,
    },
  ],

  kon: [
    {
      h: 2, map: 'village', from: 1080, to: 1440, when: doNight, script: `
        placePlayer 60 19 up
        placeNpc kon 60 17 down
        say kon happy "A riddle for my best customer! What has a tail, walks on the shrine steps, and never leaves footprints?"
        choice "A fox." @fox "The wind." @wind
        @fox
        say kon surprised "...What a clever customer. Too clever. Have an inari. Forget you said that."
        give inari 1
        goto @end
        @wind
        say kon happy "Ha! The wind! Yes. Exactly the wind. Nothing else at all."
        @end
        bond kon 30
      `,
    },
    {
      h: 4, map: 'grove', from: 1080, to: 1440, script: `
        placePlayer 10 29 left
        placeNpc kon 11 29 left
        say "At the little Jizō in the grove someone has left a plate of fried tofu. Kon is looking at it very hard."
        say kon neutral "Who leaves fried tofu at a Jizō? Jizō does not eat tofu. Somebody else must eat it. Somebody small and hungry."
        choice "Leave it. Somebody small and hungry needs it." @leave "Eat it. It'll go to waste." @eat
        @leave
        say kon happy "...Yes. Yes, somebody does. Thank you. From somebody."
        virtue jin 3
        goto @end
        @eat
        say kon sad "Oh. Well. Waste is a sin. Enjoy it. Very much. I am not jealous at all."
        @end
        bond kon 30
      `,
    },
    {
      h: 6, map: 'village', from: 1200, to: 1440, when: doNight, script: `
        placePlayer 60 19 up
        placeNpc kon 60 17 down
        say kon neutral "Look at my lamp. It burns without oil. It always has. Now look at my shadow."
        say "On the stall's awning, Kon's shadow has a tail. Just one, long and curling. Kon's eyes are gold in the dark."
        choice "I think I knew." @knew "You're a fox." @fox
        @knew
        say kon happy "You did, didn't you. And you still bought my tofu every week."
        virtue jin 2
        goto @end
        @fox
        say kon happy "One tail. Very young. Very respectable. Please do not tell Chōbei; he will want to sell my lamp."
        virtue makoto 2
        @end
        setFlag kon_fox
        bond kon 30
      `,
    },
    {
      h: 8, map: 'shrine', from: 1260, to: 1440, script: `
        placePlayer 12 6 up
        placeNpc kon 13 6 left
        say kon sad "Listen. The small spirits are crying under the mountain. Something old is leaning on the seals and feeding on their fear."
        say kon sad "They are not wicked. The umbrellas, the lanterns, the drowned ones. They are frightened, and fear makes teeth."
        choice "Then I'll fight gently." @gentle "How do we stop it?" @stop
        @gentle
        say kon happy "Gently. Yes. Put them to rest, do not destroy them. They remember kindness longer than we do."
        virtue jin 3
        goto @end
        @stop
        say kon neutral "Mend the seals. Wake the shrine. And go down, deep, to whatever is leaning. Not yet. Soon."
        virtue yu 2
        @end
        setFlag kon_warning
        bond kon 30
      `,
    },
    {
      h: 10, map: 'village', from: 1080, to: 1440, when: doNight, script: `
        placePlayer 60 19 up
        placeNpc kon 60 17 down
        say kon happy "I have decided you are my person. Foxes do this. It is very serious and you cannot refuse."
        say kon happy "Here. One whisker, wrapped in paper. If you are ever lost, it points home. It has never been wrong. Mostly."
        give fox_whisker 1
        virtue chugi 3
      `,
    },
  ],
};
