// Crafting (Craft tab), artisan machines, and cooking at the irori.

// Things you can make from materials; `lv` is the Craftsmanship level that unlocks the recipe.
export const CRAFTS = {
  compost_bin: { lv: 1, needs: [['wood', 15], ['hay', 10]] },
  tofu_press: { lv: 1, needs: [['wood', 15], ['stone', 15]] },
  tsukemono_tub: { lv: 1, needs: [['wood', 20], ['stone', 5]] },
  uke: { lv: 1, needs: [['bamboo', 5], ['hay', 5]] },
  sluice: { lv: 1, needs: [['wood', 10], ['stone', 10]] },
  arrow: { lv: 1, needs: [['bamboo', 1], ['stone', 1]], n: 5 },
  smoker: { lv: 2, needs: [['wood', 20], ['bamboo', 5]] },
  charcoal_kiln: { lv: 2, needs: [['stone', 30], ['wood', 10]] },
  miso_barrel: { lv: 3, needs: [['wood', 25], ['stone', 10]] },
  sake_barrel: { lv: 4, needs: [['wood', 30], ['iron_bar', 1]] },
  // Shown once the kodama are back on the shrine hill (`flag`).
  hokora: { lv: 1, needs: [['wood', 20], ['stone', 20], ['bamboo', 5]], flag: 'restored_kodama' },
};

// Artisan machines: what goes in (`input`: item ids, or a test), how many, how long, what comes out.
export const MACHINES = {
  compost_bin: { name: 'Compost Bin', jp: '堆肥箱', input: ['hay'], n: 10, days: 3, out: 'compost', outN: 5 },
  tofu_press: { name: 'Tofu Press', jp: '豆腐箱', input: ['daizu'], n: 1, days: 1, out: 'tofu' },
  tsukemono_tub: { name: 'Pickling Tub', jp: '漬物樽', input: 'vegetable', n: 1, days: 4, out: 'tsukemono' },
  smoker: { name: 'Smoking Rack', jp: '燻製棚', input: 'fish50', n: 1, days: 1, out: 'kunsei' },
  charcoal_kiln: { name: 'Charcoal Kiln', jp: '炭窯', input: ['wood'], n: 10, days: 2, out: 'sumi' },
  miso_barrel: { name: 'Miso Barrel', jp: '味噌樽', input: ['daizu'], n: 3, days: 14, out: 'miso' },
  sake_barrel: { name: 'Sake Barrel', jp: '酒樽', input: ['rice'], n: 5, days: 7, out: 'sake' },
};

// Artisan goods and fertiliser.
export const GOODS = {
  compost: { name: 'Compost', jp: '堆肥', kind: 'fertiliser', sell: 5, desc: 'Rotted hay. Worked into tilled soil, it makes finer crops.' },
  tofu: { name: 'Tofu', jp: '豆腐', kind: 'artisan', sell: 110, desc: 'Pressed soybean curd, soft as fresh snow.' },
  tsukemono: { name: 'Tsukemono', jp: '漬物', kind: 'artisan', sell: 120, desc: 'Vegetables pickled in rice bran. No meal is complete without them.' },
  kunsei: { name: 'Smoked Fish', jp: '燻製魚', kind: 'artisan', sell: 160, desc: 'Cedar-smoked river fish. It keeps for months.' },
  sumi: { name: 'Charcoal', jp: '炭', kind: 'artisan', sell: 70, desc: 'Clean-burning charcoal. Genzō uses it by the sack.' },
  miso: { name: 'Miso', jp: '味噌', kind: 'artisan', sell: 420, desc: 'Fermented soybean paste, deep and salty. It took two weeks of patience.' },
  sake: { name: 'Sake', jp: '酒', kind: 'artisan', sell: 650, desc: 'Rice wine from your own paddies. The valley\'s pride.' },
};

// Dishes cooked at the irori. `buff`: [kind, amount, hours]; kinds: speed, farming, foraging, fishing.
export const DISHES = {
  onigiri: { needs: [['rice', 1]], known: true },
  yakiimo: { name: 'Yaki-imo', jp: '焼き芋', genki: 80, needs: [['satsumaimo', 1]], known: true, desc: 'Sweet potato roasted in the hearth ash.' },
  tamagoyaki: { name: 'Tamagoyaki', jp: '卵焼き', genki: 90, needs: [['egg', 2]], buff: ['farming', 0.06, 4], known: true, desc: 'A rolled, sweet omelette.' },
  miso_soup: { name: 'Miso Soup', jp: '味噌汁', genki: 90, needs: [['miso', 1], ['negi', 1]], buff: ['speed', 0.08, 3], desc: 'Miso and spring onion in a warm bowl.' },
  shioyaki: { name: 'Shioyaki', jp: '塩焼き', genki: 100, needs: [['ayu', 1]], buff: ['fishing', 0.1, 4], desc: 'Salt-grilled ayu on a bamboo skewer.' },
  tempura: { name: 'Sansai Tempura', jp: '山菜天ぷら', genki: 110, needs: [['taranome', 1], ['egg', 1]], buff: ['foraging', 0.1, 4], desc: 'Mountain greens in a lace of crisp batter.' },
  soba_noodles: { name: 'Soba Noodles', jp: 'かけ蕎麦', genki: 120, needs: [['soba', 2]], buff: ['speed', 0.12, 4], desc: 'Buckwheat noodles in a clear broth.' },
  sekihan: { name: 'Sekihan', jp: '赤飯', genki: 150, needs: [['rice', 2], ['azuki', 1]], buff: ['farming', 0.1, 6], desc: 'Red bean rice for celebrations.' },
  yudofu: { name: 'Yudōfu', jp: '湯豆腐', genki: 100, needs: [['tofu', 1], ['negi', 1]], desc: 'Tofu simmered with kelp. Plain and perfect.' },
  kinpira: { name: 'Kinpira Gobō', jp: 'きんぴらごぼう', genki: 80, needs: [['gobo', 1]], buff: ['foraging', 0.06, 3], desc: 'Burdock strips stir-fried sweet and sharp.' },
  ochazuke: { name: 'Ochazuke', jp: 'お茶漬け', genki: 70, needs: [['rice', 1], ['tea', 1]], buff: ['speed', 0.05, 2], desc: 'Green tea poured over rice. Supper for tired farmers.' },
  kurigohan: { name: 'Kuri Gohan', jp: '栗ご飯', genki: 130, needs: [['rice', 1], ['kuri', 2]], buff: ['farming', 0.08, 5], desc: 'Rice steamed with chestnuts.' },
  matsutake_gohan: { name: 'Matsutake Gohan', jp: '松茸ご飯', genki: 180, needs: [['rice', 1], ['matsutake', 1]], buff: ['foraging', 0.15, 6], desc: 'Rice perfumed with the king of mushrooms.' },
  unadon: { name: 'Unadon', jp: '鰻丼', genki: 200, needs: [['unagi', 1], ['rice', 1]], buff: ['speed', 0.15, 6], desc: 'Grilled eel on rice. Summer stamina in a bowl.' },
  inari: { name: 'Inari-zushi', jp: '稲荷寿司', genki: 90, needs: [['rice', 1], ['tofu', 1]], buff: ['foraging', 0.06, 3], desc: 'Sweet fried tofu pouches packed with rice. Foxes are said to love them.' },
  oden: { name: 'Oden', jp: 'おでん', genki: 160, needs: [['daikon', 1], ['egg', 1], ['tofu', 1]], buff: ['fishing', 0.12, 6], desc: 'A winter pot of simmered daikon, egg and tofu.' },
  // M7: more of Okiku's kitchen, Kon's soba, and the dishes a traveller carries into the mountain
  // (`might`: harder blows, `guard`: blows land softer).
  zenzai: { name: 'Zenzai', jp: '善哉', genki: 110, needs: [['azuki', 1], ['mochi', 1]], buff: ['speed', 0.08, 3], desc: 'Sweet red-bean soup with a toasted mochi floating in it. Winter\'s reward for going outside.' },
  chawanmushi: { name: 'Chawanmushi', jp: '茶碗蒸し', genki: 120, needs: [['egg', 2], ['ebi', 1]], buff: ['farming', 0.08, 4], desc: 'Egg custard steamed in a lidded cup, a prawn hiding at the bottom.' },
  dengaku: { name: 'Tofu Dengaku', jp: '田楽', genki: 110, needs: [['tofu', 1], ['miso', 1]], buff: ['guard', 0.08, 4], desc: 'Tofu on bamboo skewers, grilled under sweet miso. Named for the planting dances; the tofu stands like a dancer on stilts.' },
  kenchin: { name: 'Kenchin-jiru', jp: 'けんちん汁', genki: 150, needs: [['daikon', 1], ['gobo', 1], ['tofu', 1]], buff: ['foraging', 0.1, 5], desc: 'A temple soup of root vegetables and crumbled tofu. Sōken makes it without looking.' },
  kabocha_nimono: { name: 'Simmered Kabocha', jp: '南瓜の煮物', genki: 120, needs: [['kabocha', 1]], buff: ['farming', 0.08, 5], desc: 'Pumpkin simmered in soy and dashi until it gives up entirely.' },
  kappamaki: { name: 'Kappa-maki', jp: 'かっぱ巻き', genki: 70, needs: [['kyuri', 1], ['rice', 1]], buff: ['fishing', 0.06, 3], desc: 'Cucumber rolled in rice and nori. Named for a certain river spirit\'s favourite food.' },
  yamakake: { name: 'Yamakake', jp: '山かけ', genki: 130, needs: [['yamaimo', 1], ['rice', 1]], buff: ['speed', 0.1, 4], desc: 'Grated mountain yam over hot rice, white and silky. It sticks to your ribs and your chopsticks.' },
  kitsune_soba: { name: 'Kitsune Soba', jp: 'きつね蕎麦', genki: 150, needs: [['soba', 2], ['tofu', 1]], buff: ['foraging', 0.12, 5], desc: 'Soba under a sheet of sweet fried tofu. Kon claims to have invented it and will not hear otherwise.' },
  hoba_miso: { name: 'Hoba Miso', jp: '朴葉味噌', genki: 140, needs: [['miso', 1], ['negi', 1], ['shiitake', 1]], buff: ['might', 0.12, 6], desc: 'Miso, onion and mushroom grilled on a magnolia leaf over the coals. Mountain food, for mountain work.' },
  kasujiru: { name: 'Kasu-jiru', jp: '粕汁', genki: 180, needs: [['sake', 1], ['daikon', 1], ['salmon', 1]], buff: ['guard', 0.15, 6], desc: 'Salmon and daikon in a soup of sake lees. It warms you so thoroughly that blows seem to land on someone else.' },
  ishikari_nabe: { name: 'Ishikari Nabe', jp: '石狩鍋', genki: 220, needs: [['salmon', 1], ['miso', 1], ['hakusai', 1]], buff: ['fishing', 0.15, 6], desc: 'A northern hotpot of salmon, cabbage and miso. Sakuya learned it from a fisherman who owed her money.' },
  jinchu_bento: { name: 'Warrior\'s Bentō', jp: '陣中弁当', genki: 220, needs: [['onigiri', 1], ['tsukemono', 1], ['kunsei', 1]], buff: ['might', 0.2, 8], desc: 'Rice balls, pickles and smoked fish wrapped in bamboo bark, as soldiers carried on campaign.' },
};

/** Recipe scrolls: using one teaches the dish. Okiku sells a few each day at the teahouse, Kon his
 * two at the night market, and Sakuya one of the travelling dishes each market day. */
export const CHAYA_SCROLLS = ['miso_soup', 'shioyaki', 'tempura', 'soba_noodles', 'sekihan', 'yudofu', 'kinpira', 'ochazuke', 'kurigohan', 'matsutake_gohan', 'unadon', 'oden', 'inari', 'zenzai', 'chawanmushi', 'dengaku', 'kenchin', 'kabocha_nimono', 'kappamaki', 'yamakake'];
export const KON_SCROLLS = ['inari', 'kitsune_soba'];
export const SAKUYA_SCROLLS = ['hoba_miso', 'kasujiru', 'ishikari_nabe', 'jinchu_bento'];
export const SCROLLS = [...new Set([...CHAYA_SCROLLS, ...KON_SCROLLS, ...SAKUYA_SCROLLS])];
export const SCROLL_PRICE = 250;

// Vegetables for the pickling tub: crops that are not grain or fruit.
export const PICKLE_EXCLUDE = new Set(['rice', 'soba', 'daizu', 'azuki', 'strawberry', 'suika']);
