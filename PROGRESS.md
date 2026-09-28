# Progress

## How to run
`npm run dev`, open http://localhost:8080/. `npm test` for unit tests; `npm install` once, then
`npm run test:e2e` and `npm run shots` for the headless smoke test and screenshots.

## Milestones
- [x] **M0 Foundation and look**: references studied, STYLE_GUIDE.md, 63-colour palette, indexed-grid
  sprite pipeline + atlas, gallery and animation preview, integer-scaled canvas, fixed-step loop,
  input abstraction, camera, procedural autotiled terrain (47 blob cases), layered player with
  walk/idle/tool animations.
- [x] **M1 Farm vertical slice**: 64x48 overgrown farm (seeded weeds, stones, twigs, stumps,
  trees, bamboo; forest edge; pond; river with banks; minka, kura, well, lanterns, fenced terraces),
  movement with corner-sliding collision, 5 tools with swing animations and effects, target tile +
  mouse reach, 12-slot hotbar and backpack menu, till > plant > water > grow > harvest for daikon,
  komatsuna, soramame and strawberry (regrows), item drops with magnet pickup, Genki, day/night
  lighting with window and lantern pools, clock with sun/moon dial and zodiac hour, sleep via the
  farmhouse door with ink-wipe day card, pass-out at 02:00, 3-slot saves (checksum, backup,
  migrations, export/import), autosave on sleep, Tsukikage tutorial asides, procedural SFX,
  title screen, options (sound, time speed, screen shake), debug keys and URL parameters.
  Feedback after M1: "I really like them. Continue."
- [x] **M2 Seasons and economy**: four seasons restyle the farm in place (turf palettes, maple and
  ginkgo, bare winter branches, snow on thatch and weeds, seasonal decals and drifting petals or
  leaves); deterministic weather forecast the evening before (clear, cloudy, rain, wind, summer
  storms with lightning, tsuyu rains, two typhoons per autumn, snow, blizzards) with rain watering
  the fields and dimming the light; irrigation channels dug with the hoe, flood-fill flow from the
  pond or river, sluice gates, flooded paddies and rice; all 22 starter crops (18 with generated
  art), season withering, straw-covered winter beds (hay), typhoon damage; shipping crate and an
  itemised end-of-day screen with forecast and a seasonal verse; Chōbei's Yorozuya (buy by season
  with a Saturday seed discount, sell) and Genzō's forge (iron bars, two-day tool upgrades) reached
  by the valley road; tool tiers with charged hoe/can swings (3, 5, 9 tiles), heavier axe and
  pickaxe hits, large logs and boulders that need an upgrade; HUD weather icon, tier icons, charge
  pips; save v2 with a v1 migration.
- [x] **M3 Village and people**: a multi-map world (one player, a World per visited map, the farm
  saved; doors and roads warp behind a quick ink wipe); Yamabuki Village (80x60: street shops,
  magistrate's office, back lane with dōjō and rice broker, festival square, river bridge, flooded
  paddies, houses and an old kura) and Shrine Hill (40x50: torii stair, shrine hall, office,
  sealed rear gate); ten interiors (farmhouse with a futon to sleep in, four shops, three homes,
  the shrine office, the hall with seven altars); eight villagers (Genzō, Okiku, Tomoe, Heibei,
  Ume, Daigo, Kaito, Chōbei) with outfits and hairstyles, 48x48 portraits in five expressions,
  homes, birthdays, gift tastes and schedules by season, weekday and rain, walking A* paths and
  crossing maps through doors; dialogue with six lines per heart tier plus conditional, gift and
  birthday lines, voice blips and emote bubbles; bonds (talk, gifts with weekly limits and
  birthday x8, neglect decay, discovered tastes, Bonds tab); an event script language (say,
  choice, give/take, flags, moveNpc, emotes, camera pans, fades) and the headman's welcome
  scene; shops opened at their counters when the keeper is in and the hour is right (Shop / Talk
  / Leave), teahouse food and the apothecary's tonic; the notice board (daily bring and deliver
  requests paying mon, bond and virtue); letters in the farm mailbox (uncle's letters, villagers,
  birthday gossip) with attachments; Shrine Offerings v1 (seven altars x four sets, rewards, and
  restorations: the terraces open, the bell rings again, the rest set flags for M5-M7); a
  minimal virtue store (Jin, Rei, Makoto from everyday acts); save v3 with a v2 migration.
- [x] **M4 Nature and craft**: six skills (Farming, Foraging, Fishing, Mining, Swordsmanship,
  Craftsmanship) at levels 1-10 with XP from everyday work, a perk choice at 5 and 10 (twelve
  perks with real effects: prices, drops, quality, machine speed, catch bar) and a Skills tab
  with the virtue heptagon; the Hollow Grove west of the village (56x44: cliff and waterfall,
  pool, stream, bamboo with light shafts, cedar and mixed wood); 20 seasonal forage items and 4
  artifacts on daily seeded spots (grove, shrine woods, village, farm) plus dig spots for the
  hoe; fishing with Daigo's bamboo rod (sent by letter; charged cast 1-4 tiles, bite, strike) and a reel minigame
  whose catch bar grows with skill, 24 river, pond, stream and pool fish by season, hour and
  weather, junk, the Moon Carp legendary (clear autumn full moon, under the falls, 22:00-02:00)
  and bamboo fish traps; the coop (chicks and ducklings from the Yorozuya, hay hopper, petting,
  affection, eggs by morning, duck eggs, ducks in the paddies); a Craft tab with nine recipes
  gated by Craftsmanship and seven artisan machines (compost, tofu, pickles, smoked fish,
  charcoal, miso, sake) with progress bars and ready bubbles; compost as fertiliser; cooking
  15 dishes at the farmhouse irori from 12 teahouse recipe scrolls, dishes with Genki and timed
  buffs (speed, farming, foraging, fishing) shown on the HUD; 24- and 36-slot backpacks; save v4
  with a v3 migration.
- [x] **M5 Combat and caves**: Inochi (命) and Ki (気) gauges; the rusted katana in the starting
  pack; a three-hit light combo with small lunges and a swept slash arc, a held heavy kiai that
  costs Ki and breaks guards, a dodge step with invulnerability, a parry that turns a blow on the
  glint, refunds Ki, staggers the foe and opens a counter window (crits), hit-stop, white hit
  flashes, knockback, sparks, damage numbers and screen kick; spears, glaives, the bow and
  craftable arrows; six enemies, each with its own tell (nobushi guard and raise, karakasa squat
  and leap, bake-danuki drum and roll into walls, kappa lurk-splash-lunge from pools,
  chōchin-obake glow and foxfire that a parry sends back, yūrei fade and gather as cold wisps)
  and no touch damage; the Yū altar opens the shrine's rear gate onto Mount Kurayama (30x24) and
  its mine mouth; a seeded floor generator (rooms, two-wide tunnels with loops, the rope up and
  the ladder down in the farthest room, ore veins, urns, chests, secret rooms behind cracked
  rock, pools in the cellars, depth-scaled foes) for zone 1 Old Mine Tunnels (1-20) and zone 2
  Flooded Cellars (21-40); darkness with a carried lantern and lit lanterns every fifth floor to
  start from; Kurogane no Jūbei on floor 20 in three phases (cut combos and a dash, calling his
  men and vanishing in smoke, then an iai stand-off best of three with feints) and a choice of
  his fate by virtue; Genzō's forge with Tools, Blades and Smelt tabs (reforging the old sword,
  six more blades, copper, iron and steel bars from ore and charcoal); Ume's salves; defeat
  (wake in the apothecary, lose a capped share of mon and a few stacks to a bundle at the mine
  mouth) and Relaxed/Standard/Warrior difficulty; virtues wired into systems (seven tiered
  effects, Tsukikage's remarks, shown on the Skills tab); save v5 with a v4 migration.
- [x] **M6 Story and festivals**: ten more villagers (Sōken, Rin, Toyo, Kinta, Tatsu, Yuzu,
  Sakuya, Ōkubo, Shinsuke, Kon) with looks, portraits, homes (hermitage, dōjō, Toyo's house,
  carpenter's, bathhouse, magistrate's office), schedules with flags and trips out of the valley,
  dialogue, gift tastes and new shops (Sakuya's market stall, Kon's night stall, Tatsu, the
  bathhouse, the shrine's charm stand); five heart events for all eighteen villagers (90 scenes,
  with choices, iai bouts, keepsakes and recipes); romance and marriage (the Red Thread, Tatsu's
  farmhouse extension, the Shrine Vow, a wedding at the shrine, a spouse who lives at the farm,
  keeps their work, has married lines and helps in the morning); all eleven festivals with
  dressing, crowds and scenes, and their minigames (the haiku composer; one rhythm engine for
  mochi pounding, Bon Odori, Otaue planting and mamemaki; crop judging; fireworks); Acts I-II
  (the tolls, Rin's arrival, Kuroda's contract signed or refused, the petition, the splitting
  seal, the Hyakki Yagyō) with letters; the Village Archive (82 pieces in five collections,
  milestone rewards); save v6 with a v5 migration.
- [ ] M7 Content and polish

## Next
M7 Content and polish: cave zones 3-5 and bosses 2-5, Act III and the ending, the remaining
minigames (goldfish scooping, kyūdō, dango stacking, snowball skirmish, dōjō kata, forging,
calligraphy), kodama helpers, the procedural soundscape and music, the title and new-game flow
(name, farm, appearance, layout), touch controls and rebinding, Jūbei's return if he was offered
work, polish.

## Verification (M1)
- `npm test`: 36 unit tests (calendar, farming rules and regrowth, inventory, save checksum and
  migrations, day rules, autotile masks, art integrity, RNG/population determinism, collision).
- `npm run test:e2e`: title -> new farm -> walk the path -> till, plant, water -> sickle a weed and
  collect the drop -> sleep through the door dialogue -> overnight growth -> hand harvest -> refill
  at the well -> save from the menu -> reload the slot -> pass out at 02:00 (10% penalty, half
  Genki, wake at home). Zero console errors.
- `npm run shots`: shots/m1/01-10 (title, first morning, crop stages, axe strike, golden hour,
  night, menu, day card, whole-farm overview, 720p window).
- Performance (headless Chromium, software rendering, night with lighting): simulation step
  0.03 ms, update + render 2.8 ms per frame; JS heap ~10 MB; atlas ~1024x~900; 219 autotile cells.

## Verification (M2)
- `npm test`: 48 unit tests, adding irrigation flow/sluices/paddies, season withering, rain and
  typhoons, planting rules (season, paddy, straw), multi-yield harvests, weather determinism
  (tsuyu, exactly two typhoons), shipping value, charged swing areas, v1 -> v2 save migration.
- `npm run test:e2e` adds: shipping a stack in the crate and being paid overnight; an Iron hoe
  charged for a second tilling three tiles in a line.
- `npm run shots` writes shots/m2 (seasons, rain, storm at night, irrigated paddies, shop, forge,
  end-of-day screen, every crop ripe).

## Verification (M3)
- `npm test`: 77 unit tests, adding map integrity (rectangular maps, text keys, every warp
  walkable at both ends, interiors reachable and linked back), A* and map routes, every schedule
  stop walkable and reachable from the previous one for all eight villagers, bonds (hearts,
  talks, gift tastes, one a day and two a week, birthdays, decay), dialogue completeness (5 tiers
  of 6+ lines, conditionals, gift lines, valid expressions), deterministic line choice, the script
  parser and runner (all verbs, branching, errors with line numbers), requests (postings, accept,
  settle, expiry, cap), offerings (partial offers, set and altar completion, all items
  obtainable), mail (due once, birthday gossip), v1 -> v3 save migration.
- `npm run test:e2e` now: sleeps in the futon indoors and wakes there, reads uncle's letter from
  the mailbox (seeds attached), walks the valley road into the village, plays through Heibei's
  welcome scene (a choice, a gift), takes a notice-board request, buys at the teahouse counter
  from Okiku and eats, talks to Kaito (bond grows), passes out and wakes beside the futon.
- `npm run shots` writes shots/m3 (village street and 1x overview, welcome scene, teahouse
  counter, a loved gift, Bonds tab, notice board, letters, shrine stair at dusk and 1x overview,
  altar offerings, the farmhouse at night, a rainy afternoon in the teahouse).
- Performance: eight villagers simulated on every map cost ~0.01 ms per step; render ~0.6 ms.

## Verification (M4)
- `npm test`: 101 unit tests, adding skills (levels, XP, perks at 5 and 10, price and quality
  effects, buffs and expiry), forage (season tables, seeded spots, dig finds, no repeats in a
  day), fishing (water kinds, fish tables by season/hour/weather, legendary conditions, reel
  physics, traps), animals (adoption, hay, affection, laying and quality, coop size), crafting
  and machines (needs, Thrifty, accepted inputs, timing, Patient Hands, collection), cooking and
  recipes, duplicate item ids, v3 -> v4 save migration.
- `npm run test:e2e` runs the M3 smoke test and a new nature test: picks forage in the grove for
  XP; casts into the pond, strikes and plays the reel to land a fish; buys a chick and fills the
  hopper; crafts a compost bin, places it and loads hay; three nights later collects compost and
  an egg; cooks tamagoyaki at the irori and eats it for a farming buff. Zero console errors.
- `npm run shots` writes shots/m4 (the falls, autumn bamboo, a cast, the reel, the coop, a row of
  machines, the Craft tab, the irori, Skills and virtues with buffs running, recipe scrolls).

## Verification (M5)
- `npm test`: 124 unit tests, adding combat rules (combo, heavy and crit damage, guards and
  facing, elements, difficulty and Unmoving Mountain, Ki regeneration, the parry window and
  Guardian, Kensei and Meiyo crits, defeat costs), virtue tiers and effects, the cave generator
  over three seeds and all 40 floors (determinism, the ladder and every prop reachable from the
  rope, lanterns every five floors, the boss floor, no ladder on the last, foes from their zone
  on floor or water and away from the rope, maps build), the iai duel (early, late, on the bell,
  best of three), and for every enemy and Jūbei a simulation that every blow follows a tell of
  at least 0.28 s within the last 1.2 s; v1 -> v5 migration.
- `npm run test:e2e` adds a combat test: through the open rear gate and into the mine mouth; a
  combo kills a karakasa for XP; a parry on a nobushi's glint staggers him with no damage and a Ki
  refund; a dodge spends Ki for invulnerability; the pickaxe breaks a copper vein; the ladder to
  floor 2 and the rope back up; a defeat wakes you in the apothecary with 10% less mon and the
  bundle at the mouth, taken back; Jūbei's stand-off won on the bell twice, spared, his blade
  and Yū; Genzō reforges the rusted katana. Zero console errors.
- A scripted bot (approach, cut, parry glints) cleared floors 1, 3, 6, 21 and 26 losing about a
  third of its Inochi per floor, and beat Jūbei with the Tetsu Katana at 24 Inochi.
- `npm run shots` writes shots/m5 (the open gate, the mine mouth, a combo with a nobushi's
  glint, a parry, the flooded cellars with foxfire, a yūrei's omen, Jūbei's hall, the
  stand-off, the forge's blades, waking in Ume's care, virtues on the Skills tab).

## Verification (M6)
- `npm test`: 147 unit tests, adding heart events (five per villager at 2-10 hearts, every scene
  parses and stages on open ground, order, place, hour, weekday and weather gates, the 8-heart
  romance ceiling, nobody away), romance (courting rules, the vow's needs, the wedding date, the
  extended farmhouse keeps door, spawn and bed, every spouse's day walkable and never away, the
  wedding staging, married lines about half the time), festivals (eleven on the brief's dates,
  decor, spots and scenes on open ground and never on a fixture, the cast and their routes, crop
  judging), the rhythm judge (perfect play is splendid for every chart, silence is clumsy,
  pounding the hand ruins mochi, timing windows), the haiku rules (tray always fillable, 5-7-5,
  scoring), the story (scene staging, order of beats, tolls and Kuroda's price, petition
  signatures), the Archive (collections, once each, milestones and completions), v1 -> v6
  migration.
- `npm run test:e2e` adds three tests. Romance: Tatsu refuses without materials, builds in three
  days; the Red Thread refused at 7 hearts, taken at 8; the Shrine Vow; the wedding at the shrine
  with Heibei officiating; the spouse's route and lines; the save round-trips. Festivals:
  Ōmisoka's square dressed and the cast gathered; mochi pounded on the beat through the J key
  for a splendid grade; a haiku composed tile by tile with arrows for a prize; a kabocha wins the
  crop judging; the reminder on the end-of-day screen. Story: no tolls in spring, posted in
  summer; a tenth taken from the crate; Rin at the bridge; Kuroda's letter and offer refused;
  eight friends sign by talking (Kinta doesn't); the castle's answer and no more toll; the
  Archive desk takes an ayu; the signing branch pays 5,000, cools the bonds and waters the
  fields. Zero console errors in all six e2e tests.
- `npm run shots` writes shots/m6 (market square, Rin's iai heart event, the wedding, the
  extended farmhouse, the haiku composer, the Bon Odori, mochi pounding, fireworks, Tanabata,
  the Hyakki Yagyō, the tolls, Kuroda's offer, the Archive).

## Decisions
- The repository already contained ORBIT (a small arcade game) at the root; it was moved to
  `orbit/index.html` unchanged so the new game can own `index.html`.
- Font: Fusion Pixel (OFL) 8/10/12 px with full Japanese coverage, from the npm fontsource
  packages (GitHub release downloads are blocked in this environment). Glyphs are rasterised once
  and alpha-thresholded, so all text is 1-bit crisp.
- Art is a mix of hand-typed indexed grids (characters, crops, icons, props) and procedural
  generators that output the same indexed grids (terrain, trees, weeds, buildings). Everything is
  compiled into one atlas at boot; autotile variants are generated lazily into a cell cache.
- Terrain edges: blurred 3x3 occupancy thresholded against tileable noise, reduced to the 47
  canonical blob masks. Texture period is 64 px (16 windows per terrain) to avoid visible repeats.
- The bank of a pond or river is drawn by the water tile below the land (3/4 view), not by the land
  tile.
- Head is ~45% of character height, following reference 1 instead of the brief's "a third"
  (references win on looks).
- Tsukikage's asides are non-modal (a dark box, top-left, 7 s) so tutorial hints never block play;
  signs and prompts use the modal dialogue box.
- (M1) Sleeping happened at the farmhouse door; since M3 it is the futon inside.
- Any tool clears a weed (only the sickle yields hay); every swing costs 2 Genki except refilling
  the Jōro; the pickaxe turns empty soil back to earth but never destroys a planted tile.
- Items left on the ground at the end of the day are collected automatically (drops are not saved).
- Harvest quality in M1 uses base odds (Fine 12%, Excellent 3%); farming skill modifies it in M4.
- No crop withering at season change yet: seasons as a system arrive in M2.
- Every new game draws its overgrowth from the seed (`?seed=` for reproducible layouts).
- (M2) The Yorozuya and the forge were reached from a valley-road trip menu; M3 replaced it
  with the walkable village.
- (M2) Irrigation: hoe on empty tilled soil digs a channel; the pickaxe fills it; channels carry
  water only when connected (4-way) to natural water; a tilled tile beside running water is a
  paddy and counts as watered. Rice only grows in paddies.
- (M2) Winter crops need straw-covered soil: use Hay on tilled soil. Straw also protects crops
  from typhoons (bamboo windbreaks join in M4 with crafting).
- (M2) Charged swings exist for the hoe and can only (Iron 3-line, Steel 5-line, Tamahagane 3x3);
  axe and pickaxe tiers add damage per hit. Steel bars and tamahagane come from the caves (M5), so
  in M2 only Iron upgrades are reachable.
- (M2) Crop art: the four M1 crops stay hand-drawn; the other 18 are generated from plant forms
  (rosette, bush, vine, trellis, grass) and shaded produce blobs, so every crop has 5 stages and
  an icon from the same style rules.
- (M3) The village is 80x60 as specified. Villagers are not solid (they never block a doorway);
  interacting with the tile they stand on talks to them. Positions are not saved: on load and at
  dawn everyone is placed at their scheduled stop and walks from there.
- (M3) Villagers navigate a static copy of maps nobody is on (buildings, props, scenery) and the
  live map where one exists. If a path is ever blocked they step to the next stop.
- (M3) Shops open from their counters. With the keeper behind it, the counter asks Shop / Talk /
  Leave; talking across a counter is the only way to chat with a keeper during opening hours.
- (M3) Talking to someone twice in a day repeats the day's line (lines are chosen from the seed and
  the day). A third of the time a matching conditional line (season, weather, weekday, hour, place,
  flag, stop) wins over the heart-tier line.
- (M3) Gifts: holding a giftable item when you interact asks "Give / Just talk". Discovered likes
  show on the Bonds tab. Parcels (request deliveries) cannot be gifted or sold.
- (M3) Requests never punish: an unfinished one simply lapses after its deadline.
- (M3) Offerings v1 use goods the valley already produces (crops, wood, stone, hay, bamboo, iron,
  teahouse food, tonic). Each altar's restoration sets a `restored_*` flag; the terraces (Jin) and
  the bell (Rei) take effect now, the bridge/caves (Yū) in M5, the Archive (Makoto) in M6, the
  onsen (Meiyo), kodama (Chūgi) and the Nakasendō traffic (Gi) in M7.
- (M3) Heart events (5 per villager) are story content and arrive with M6; the script engine that
  runs them is in place and drives the welcome scene now.
- (M3) Virtues are stored and rise from bows at Jizō (Rei), gifts and requests (Jin, Makoto),
  birthdays (Rei) and offerings (each altar's virtue); the heptagon chart and virtue effects are M5.
- (M2) Seasons restyle by recolouring atlas frames (`name@summer|autumn|winter`) and by per-season
  turf palettes; the ground chunks are redrawn once when the season turns.

- (M4) Skills level from 1 to 10 (100 to 3200 XP). Each skill offers a choice of two perks at 5
  and two at 10; Swordsmanship perks are chosen now and take effect with combat in M5.
- (M4) Forage and dig spots are placed each dawn from the seed and the day, so a day's forage is
  the same on reload; picked spots are remembered for the day only.
- (M4) Daigo sends his old rod by letter the day after you meet him (a full teaching scene
  belongs with his M6 heart events). Casting costs 4 Genki; a missed strike just reels in.
- (M4) The reel follows the classic keep-the-fish-in-the-bar design but with our own rules: the
  bar is lifted by holding Use and falls with gravity; fish have four movement styles.
- (M4) Animals live in the coop only (no outdoor pasture yet); they eat hay from the hopper each
  night and lay by morning when fed. Ducks on the farm raise rice yields by chance.
- (M4) Cooking is only at the farmhouse irori; onigiri and the other teahouse foods keep their
  M3 shop definitions so the teahouse and the irori share them.
- (M4) Machines are placed like any object and keep their state in the farm save; they finish at
  dawn of their ready day.

- (M5) The Yū altar's last set asks for soramame (spring) instead of edamame so the mountain can
  open in the first season. Its restoration opens the shrine's rear gate (an `openIf` prop).
- (M5) Parry is a stance (L) whose first 150 ms turn any told blow; parrying earlier or later is
  just a guard that gets hit. Dodge and parry work in the caves only, where fights happen.
- (M5) Holding J with a blade starts a light cut and then charges the heavy kiai (release when
  the sparkle shows); the sickle stays a tool but its swings cut foes in front.
- (M5) Cave floors are not saved: they regenerate on each visit (the same layout per seed and
  floor); chests opened today stay open today. Saving underground records the mine mouth.
- (M5) Weapons are forged on the spot (tool upgrades still take two days); the Blades tab lists
  what Genzō can make now, later blades after Jūbei.
- (M5) Defeat on Standard costs 10% of your mon (at most 1000) and two random stacks (never tools
  or weapons), which wait in a bundle at the mine mouth; Warrior costs more, Relaxed nothing.
  You wake in Ume's apothecary two hours later at half Inochi. Food mends 30% of its Genki as
  Inochi; sleeping restores all of it.
- (M5) Virtues work in tiers of 25 (Gi shop prices, Yū max Ki, Jin petting, Rei talk bonds,
  Makoto request pay, Meiyo crits, Chūgi slower bond neglect). Jūbei's third option (honest work)
  needs Jin tier 1. Iai rivals and dojo kata use the same duel rules in M6.
- (M5) Floor 40 ends in a drowned stair; the Kappa Elder and deeper zones are M7.

- (M6) Romance never looks at the player's gender. Romanceable bonds stop at 8 hearts until the
  Red Thread; one person is courted at a time; the vow needs the extended farmhouse. The extension
  is a data swap of the farmhouse map (same door, spawn and bed), applied from a flag on load.
- (M6) The spouse keeps their own work (shops stay open) from 9:00 to 21:00 and lives at the farm
  the rest of the day; they never leave the valley.
- (M6) Festivals are one scene per year, played on arrival during the hours (or as they start
  while you are there); the cast stand on festival spots in order, so nobody is double-booked.
  Only the MVP minigames are full games (haiku, mochi); the rhythm engine also gives the Bon
  Odori, Otaue and mamemaki; the others (goldfish, kyūdō, sumo, snowballs) are told in scenes
  until M7.
- (M6) Kuroda never leaves his counting house: he speaks from behind the noren (portrait only).
- (M6) The Kuroda branch is decided once, at his door. Signing is not undone in M6; its
  consequences (and the refusal's) carry into Act III.
- (M6) Petition signatures are taken as you talk to villagers with 3+ hearts; Shinsuke's ledger
  (his 10-heart scene) counts for three names.
- (M6) The Archive holds one of each: fish, forage, crops, relics (artifacts, gems, spirit
  drops, star fragments) and metals; rewards pay at once, no claiming step.

## Reference conflicts (logged)
- Brief: head about a third of body height. Reference 1: ~45%. Followed the reference.

## Art comparison passes
**M0 pass 1** (game at 1x/3x next to reference 1):
1. Grass a step darker and cooler than the reference's yellow-green -> grass ramp retuned
   (`grass3/4/5`), texture now weighted to the lighter tones.
2. Character outlines weaker than the reference's near-black silhouettes -> kosode and hakama
   outlines moved to `ink0`.
3. Drop shadows too faint -> alpha 0.28 -> 0.36.
4. Bare earth flat, no shadow under grass edges -> sparse lit lumps in the dirt, 1 px turf shadow.
5. Weeds read as repeated "shells" -> redrawn as fans of pointed leaves with midribs.

**M2 pass** (seasonal art; the references only show spring, so the fallback direction in the brief
leads): maple reds and ginkgo gold follow ref 1's foliage clustering; winter uses `ink4-6` snow
with violet shadows per the palette rules. Fixes from the pass: day-time light pools showing
under snow (threshold raised), bare trees too short (longer first branch), thatch too bright
under snow (snowy thatch variant), clock plate too narrow for two-digit days (widened).

**M3 pass** (village, shrine, interiors and villagers next to refs 1, 3 and 4): the first village
draft was sparse and grid-like (wide lawns, evenly spaced trees) against ref 1's density -> rebuilt
with a back lane, festival square, paddies, homes and a kura, trees placed by hand; plank floors
read as brick -> long 4 px floorboards with rare butt joints; portrait faces used checker
dithering for shade (the guide allows dithering only for fog, sky and water) -> solid shadow band;
beards likewise; Ume's hair was a saturated purple -> ink with a violet highlight. Architecture
follows refs 3-4: plaster walls, dark tile roofs, vermilion torii and pillars, cypress-bark hall.

**M0 pass 2**: grass brightness/saturation and silhouettes now match the family; remaining gaps are
content density (flowers, props), not style. Tool swing windup was hidden behind the head -> tools
raised higher and drawn behind the body only while raised.

## Known issues
- The thatch roof is serviceable but plain (M7 polish).
- Animals have no outdoor pasture or barn animals yet; the coop holds six.
- The Skills tab leaves space between the bars and the heptagon (the virtue effects now run along
  the bottom).
- Enemies steer straight at you and slide along walls; in winding tunnels they can get stuck
  behind a corner until you come around it.
- Cave light pools show their stepped rings clearly on water; acceptable, but could be softened.
- Touch controls for Dodge/Parry arrive with the touch layer (M7).
- Weather has no audio yet (the procedural soundscape is M7); thunder uses a stand-in rumble.
- The shrine precinct is sparse (gravel, hall, office, ema rack, sacred cedar); the chōzuya basin,
  bell tower and kodama groves arrive with their restorations.
- Villagers sit by standing on cushions; a seated pose would read better (M7 polish).
- A married Yuzu leaves the bathhouse at 21:00, two hours before it closes (her shop is shut
  then).
- Festival crowds stand still on their spots; small idle gestures and seated poses are M7 polish.
- Snow lanterns double as the Hyakki Yagyō's spirit lights (a dedicated sprite would read better).
- Touch controls, rebinding UI and the fuller title/new-game flow are M7 items.
