// The eleven festivals of the year. Each has a day, a place and hours; on the day the place is
// dressed (`decor`: see objects.js decor/fixture), the villagers gather on `spots` (in cast order,
// `who` limits the cast), and walking in during the hours plays the festival's scene once. Scenes
// use the script language (systems/script.js); `play` starts a minigame and branches on its grade.

const row = (x0, x1, y, dir, step = 1) => { const out = []; for (let x = x0; x <= x1; x += step) out.push([x, y, dir]); return out; };
const SQUARE = [...row(47, 63, 22, 'up', 2), ...row(48, 62, 17, 'down', 2)];
const PRECINCT = [...row(5, 33, 14, 'up', 2), ...row(6, 12, 11, 'right', 2), ...row(26, 34, 11, 'left', 2)];
const LANTERNS = [[50, 16], [56, 16], [62, 16]].map(([tx, ty]) => ({ type: 'decor', kind: 'lanterns', tx, ty, light: [0, -8] }));
const BANNERS = [[46, 19], [68, 19]].map(([tx, ty], i) => ({ type: 'decor', kind: i ? 'nobori_indigo' : 'nobori_red', tx, ty }));

export const FESTIVALS = [
  {
    id: 'otaue', name: 'Otaue', jp: '御田植', season: 0, day: 8, map: 'village', from: 9 * 60, to: 14 * 60,
    decor: [{ type: 'fixture', kind: 'taiko', tx: 6, ty: 52 }, { type: 'decor', kind: 'nobori_red', tx: 34, ty: 52 }],
    spots: row(8, 32, 52, 'up', 2),
    script: `
      placePlayer 18 52 up
      placeNpc kaito 19 51 left
      placeNpc heibei 16 51 right
      say heibei happy "The first rice of the year goes in by hand, to the drum, all of us in one line. The kami of the field likes a steady beat."
      say kaito happy "Try not to plant them upside down. I did, my first year. The whole valley still remembers."
      say "Plant a seedling on each drumbeat (Use). When the drum beats alone, step back and wait."
      play otaue @best @good @poor
      @best
      say kaito surprised "Straight as a ruler! Did you practise? You practised."
      give rice 20
      virtue rei 3
      bond kaito 60
      goto @end
      @good
      say kaito happy "Not bad. A few of them lean. They'll straighten up. Rice is forgiving."
      give rice 10
      virtue rei 2
      bond kaito 30
      goto @end
      @poor
      say heibei neutral "Well. The field has been planted. That is the main thing."
      give rice 5
      virtue rei 1
      @end
      say heibei happy "Rice-planting songs until sundown, and dango for everyone who got their knees wet."
      give dango 2
    `,
  },
  {
    id: 'hanami', name: 'Hanami', jp: '花見', season: 0, day: 14, map: 'village', from: 10 * 60, to: 16 * 60,
    decor: [{ type: 'decor', kind: 'goza', tx: 52, ty: 20, flat: true }, { type: 'decor', kind: 'goza', tx: 59, ty: 20, flat: true }, ...BANNERS],
    spots: [...row(50, 54, 21, 'up', 2), ...row(57, 61, 21, 'up', 2), ...row(50, 54, 19, 'down', 2), ...row(57, 61, 19, 'down', 2), ...SQUARE],
    script: `
      placePlayer 56 20 up
      placeNpc soken 56 18 down
      placeNpc okiku 55 19 down
      say okiku happy "Sit, sit! Petals in your tea is the whole point. Oh, and Sōken is judging the verses this year."
      say soken happy "Three lines: five, seven, five. One season word of now. Say what you see, not what you think you should feel."
      choice "Compose a verse" @play "Just watch the blossoms" @watch
      @play
      play haiku @first @second @none
      @first
      say soken surprised "...Read it again. Slowly. Yes. That is the valley in spring. First prize."
      give haiku_scroll 1
      money 1000
      virtue meiyo 3
      bond soken 80
      goto @end
      @second
      say soken happy "A good verse, honestly made. Second prize, and a cup of the good tea."
      money 400
      virtue meiyo 2
      bond soken 40
      goto @end
      @none
      say soken neutral "Every verse is a step on the path. This one was... a step. Come back next spring."
      virtue makoto 1
      goto @end
      @watch
      say "You lie back on the mat. The petals do what petals do."
      virtue rei 1
      @end
      say okiku happy "Dango for the poets and the petal-watchers alike."
      give dango 3
    `,
  },
  {
    id: 'tanabata', name: 'Tanabata', jp: '七夕', season: 1, day: 7, map: 'shrine', from: 18 * 60, to: 23 * 60,
    decor: [{ type: 'fixture', kind: 'sasa', tx: 10, ty: 12 }, { type: 'fixture', kind: 'sasa', tx: 33, ty: 12 }],
    spots: PRECINCT,
    script: `
      placePlayer 19 13 up
      placeNpc tomoe 20 12 down
      say tomoe happy "Tonight the weaver star crosses the river of heaven to meet the herdsman. Once a year. They never miss it."
      say tomoe neutral "Write a wish on a strip and tie it to the bamboo. Be honest. The stars read slowly, but they read everything."
      choice "A good harvest" @harvest "Peace for the valley" @peace "The strength to protect them" @strength "(Write nothing)" @none
      @harvest
      virtue jin 2
      goto @tie
      @peace
      virtue gi 2
      goto @tie
      @strength
      virtue yu 2
      goto @tie
      @none
      say tomoe surprised "Nothing? ...Maybe that is the wisest wish. Or you are shy. The stars can tell which."
      virtue makoto 1
      @tie
      sfx harvest
      say "You tie the strip to the bamboo. Overhead, the river of stars is very bright."
      wait 0.8
      say tomoe surprised "Oh! A falling star. There, by the stair. Go on, it came for you."
      give star_fragment 1
      bond tomoe 40
    `,
  },
  {
    id: 'obon', name: 'Obon', jp: 'お盆', season: 1, day: 20, map: 'village', from: 18 * 60, to: 24 * 60,
    decor: [{ type: 'fixture', kind: 'yagura', tx: 55, ty: 20, ox: 16, block: [3, 2], light: [16, -44] }, ...LANTERNS],
    spots: [...row(52, 60, 22, 'up'), [53, 19, 'right'], [53, 20, 'right'], [59, 19, 'left'], [59, 20, 'left'], ...row(54, 58, 17, 'down')],
    script: `
      placePlayer 56 21 up
      placeNpc toyo 57 22 left
      say toyo happy "The dead come home for three nights. We light the way, feed them, and dance so they know we are all right."
      say toyo neutral "Your uncle Jirōbei danced like a scarecrow in a gale. I expect you to do better. For him."
      say "Dance the Bon Odori: follow the steps on the arrow keys, and clap (Use) on the drum."
      play bonodori @best @good @poor
      @best
      say toyo happy "Ha! Jirōbei is laughing somewhere. The good kind. Here. The best dancer gets the fan."
      give festival_fan 1
      virtue rei 3
      bond toyo 80
      goto @end
      @good
      say toyo happy "Better than your uncle. Not saying much. Still, the dead were pleased."
      virtue rei 2
      bond toyo 40
      goto @end
      @poor
      say toyo neutral "Well. The dead have seen worse. Your uncle, for one."
      virtue rei 1
      @end
      say "Later, lanterns float down the river, one for each house. One of them has your uncle's name on it, in Toyo's hand."
      virtue chugi 2
    `,
  },
  {
    id: 'hanabi', name: 'Hanabi', jp: '花火', season: 1, day: 27, map: 'village', from: 19 * 60, to: 24 * 60,
    decor: [...[[31, 37], [52, 37]].map(([tx, ty]) => ({ type: 'decor', kind: 'lanterns', tx, ty, light: [0, -8] }))],
    spots: [...row(28, 36, 38, 'down'), ...row(49, 54, 38, 'down'), ...row(29, 35, 36, 'down', 2)],
    script: `
      placePlayer 40 39 down
      placeNpc daigo 39 39 down
      placeNpc kon 41 39 down
      say daigo happy "Best seat in the valley: the bridge. I rowed the fireworks man up from Suwa myself. He was sick twice. Worth it."
      say kon happy "Kakigōri? Plum syrup. The ice came down from the mountain this morning, very fast, by... a friend."
      give kakigori 1
      fade out 0.4
      fade in 0.4
      fireworks 5
      say "Chrysanthemums of fire open over the river, and the water opens them again underneath."
      choice "Watch with Daigo" @daigo "Watch with Kon" @kon
      @daigo
      bond daigo 60
      say daigo happy "My brother Taichi loved these. He would have liked you. Sit. Watch the next one."
      goto @end
      @kon
      bond kon 60
      say kon happy "Humans make stars out of powder and fire, for one moment, just to watch them go. I have never understood it. I come every year."
      @end
      fireworks 3
      virtue jin 1
    `,
  },
  {
    id: 'tsukimi', name: 'Tsukimi', jp: '月見', season: 2, day: 15, map: 'shrine', from: 18 * 60, to: 24 * 60,
    decor: [{ type: 'fixture', kind: 'tsukimi', tx: 24, ty: 11 }, { type: 'fixture', kind: 'tsukimi', tx: 15, ty: 11 }],
    spots: PRECINCT,
    script: `
      placePlayer 19 12 up
      placeNpc tomoe 22 12 left
      placeNpc ume 17 12 right
      say tomoe happy "Fifteen dango for the fifteenth night, and pampas grass for the rice spirits. Then we just... look."
      say ume neutral "The moon is not doing anything. That is the point, apparently. I am trying."
      wait 1
      say "The full moon rises over the cedars. Nobody speaks for a long time. It is not awkward at all."
      choice "Share your dango" @share "Keep looking at the moon" @look
      @share
      bond tomoe 40
      bond ume 40
      virtue jin 2
      say ume happy "...Fine. This is nice. Do not tell anyone I said so."
      goto @end
      @look
      virtue rei 2
      @end
      say tomoe neutral "They say on a clear full-moon night, a silver fish rises under Ryūjin Falls. Only on nights like this."
      give dango 2
    `,
  },
  {
    id: 'niiname', name: 'Niiname-sai', jp: '新嘗祭', season: 2, day: 24, map: 'village', from: 9 * 60, to: 16 * 60,
    decor: [...BANNERS, { type: 'fixture', kind: 'taiko', tx: 56, ty: 18 }, ...LANTERNS],
    spots: SQUARE,
    script: `
      placePlayer 56 20 up
      placeNpc heibei 55 19 down
      placeNpc kaito 58 19 down
      say heibei happy "The first rice of the harvest is offered to the kami, and then, ahem, the crop judging! Best crop wins the ribbon."
      say kaito happy "My daikon is the size of a baby this year. You are not winning. I say that with respect."
      say heibei neutral "Present your finest crop. The judges will look at quality first, then kind."
      play judge @first @second @none
      @first
      say heibei surprised "Magnificent! The finest in the valley. First prize to Hinata Farm!"
      money 1500
      virtue meiyo 3
      bond heibei 60
      goto @end
      @second
      say kaito happy "Second! Behind... wait, behind you? No. Behind me. Hah! Next year, rival."
      money 500
      virtue meiyo 2
      bond kaito 40
      goto @end
      @none
      say heibei neutral "Next year, perhaps. Bring something from the field, and bring your best."
      @end
      say "The rest of the day is sumo on the riverbank and archery at a straw target. Genzō wins the archery, as he does every year."
      give mochi 2
    `,
  },
  {
    id: 'hyakki', name: 'Hyakki Yagyō', jp: '百鬼夜行', season: 2, day: 28, map: 'shrine', from: 20 * 60, to: 25 * 60,
    decor: [...[[8, 13], [33, 13], [14, 6], [26, 6]].map(([tx, ty]) => ({ type: 'decor', kind: 'yukidoro', tx, ty, light: [0, -4] }))],
    who: ['tomoe', 'soken', 'kon'],
    spots: [[18, 13, 'up'], [21, 13, 'up'], [23, 14, 'up']],
    script: `
      placePlayer 19 14 up
      say tomoe sad "Stay by the lanterns. Tonight the hundred spirits walk the hill, and it is not wise to walk with them."
      say soken neutral "Do not draw your sword. Whatever you see. Watch, and remember."
      fade out 0.8
      sfx chill
      fade in 1.2
      say "A procession comes down the stair from the sealed gate: umbrellas with one eye, lanterns with tongues, a tea kettle on fox legs."
      say "They should be laughing. The old stories say they laugh. These do not. Their eyes are clouded, and they walk as if pulled."
      emote kon !
      say kon sad "...They are not wicked. Something below is souring them. Like well water gone bad."
      say tomoe surprised "Kon, you can see them clearly? How?"
      say kon neutral "Ah. Good eyes. Foxes have... never mind. Ask me another night."
      say soken sad "Then the seals are not keeping evil in. They are keeping something from hurting what lives up there."
      setFlag spirits_corrupted
      virtue gi 3
      bond kon 60
    `,
  },
  {
    id: 'setsubun', name: 'Setsubun', jp: '節分', season: 3, day: 8, map: 'village', from: 10 * 60, to: 15 * 60,
    decor: [...BANNERS],
    spots: SQUARE,
    script: `
      placePlayer 56 20 up
      placeNpc genzo 56 18 down
      placeNpc kinta 55 21 up
      say kinta happy "The oni is coming! It's Genzō in a mask. Don't tell him I know. He thinks nobody knows."
      emote genzo anger
      say genzo angry "RAAAH. I am a terrifying ONI. Give me your... your rice. And your children's homework."
      say "Throw beans at the oni when he leaps out (Use). Not at Kinta, when he pops up to help."
      play mamemaki @best @good @poor
      @best
      say genzo surprised "Oof! Ow! Fine! The oni is defeated! Fortune in, demons out! ...You have a good arm."
      virtue yu 2
      bond genzo 60
      bond kinta 40
      goto @end
      @good
      say genzo happy "The oni retreats! For this year! Heh."
      virtue yu 1
      bond genzo 30
      goto @end
      @poor
      say kinta surprised "You hit ME. Twice. The oni is fine. The oni is laughing."
      @end
      say genzo happy "Now eat one bean for every year you have lived, and one more for luck."
      give fuku_mame 5
    `,
  },
  {
    id: 'yukimi', name: 'Yukimi', jp: '雪見', season: 3, day: 25, map: 'village', from: 17 * 60, to: 23 * 60,
    decor: [{ type: 'fixture', kind: 'kamakura', tx: 55, ty: 20, ox: 8, block: [2, 1], light: [0, -6] },
      ...[[49, 20], [52, 21], [60, 21], [63, 20], [49, 17], [63, 17]].map(([tx, ty]) => ({ type: 'decor', kind: 'yukidoro', tx, ty, light: [0, -4] }))],
    spots: SQUARE,
    script: `
      placePlayer 56 21 up
      placeNpc yuzu 58 21 left
      placeNpc kinta 54 21 right
      say yuzu happy "Snow lanterns! Kinta built the kamakura. It leaks. Don't tell him. Amazake is free, the bathhouse is open late."
      say kinta happy "Snowball fight! You and me against Kaito! Starting... NOW."
      emote kinta note
      choice "Throw a snowball" @throw "Retreat into the kamakura" @hide
      @throw
      say "Your snowball arcs over the square and lands on Kaito's hat with a very satisfying sound."
      bond kinta 40
      virtue yu 1
      goto @end
      @hide
      say "You duck into the kamakura. It is warm, and it does leak, and it is wonderful."
      virtue rei 1
      @end
      give amazake 2
      bond yuzu 40
    `,
  },
  {
    id: 'omisoka', name: 'Ōmisoka', jp: '大晦日', season: 3, day: 28, map: 'village', from: 20 * 60, to: 25 * 60,
    decor: [{ type: 'fixture', kind: 'usu', tx: 56, ty: 20 }, ...LANTERNS],
    spots: SQUARE,
    script: `
      placePlayer 55 20 right
      placeNpc okiku 57 20 left
      say okiku happy "Last night of the year: we pound the mochi for the New Year, and Sōken rings the bell one hundred and eight times."
      say okiku neutral "You pound, I turn. Strike on the beat, and wait while my hand is in the mortar. My fingers are very dear to me."
      play mochi @best @good @poor
      @best
      say okiku happy "Smooth as silk! That is the best mochi this valley has had in years. Take a stack, you earned it."
      give mochi 8
      virtue rei 2
      bond okiku 80
      goto @end
      @good
      say okiku happy "Good mochi. A little lumpy. Lumpy mochi has character."
      give mochi 5
      bond okiku 40
      goto @end
      @poor
      say okiku surprised "My hand! ...It is fine. It is mostly fine. We'll call this rustic mochi."
      give mochi 3
      @end
      sfx bell
      say "Across the valley, the bell begins. One for each of the hundred and eight worldly desires."
      wait 1.2
      sfx bell
      wait 1.2
      sfx bell
      say "By the last stroke the snow has stopped, and the year is new."
      virtue makoto 2
    `,
  },
];
