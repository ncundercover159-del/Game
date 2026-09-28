# Rōnin no Sato: Working Design

Decisions only. The full brief is the source of intent; this file is what the code implements.

## Premise and tone
Shinano Province, 1780s. The player is a rōnin of the dissolved Aizawa clan who inherits uncle
Jirōbei's overgrown hillside farm in Yamabuki Valley, plus a rusted blade, Tsukikage, whose
tsukumogami speaks in dry text asides. Cozy first, dangerous second. No gore: defeated things
dissolve into light, petals or smoke.

## Pillars -> rules
1. The farm > village > nature loop always offers a short, a medium and a long goal.
2. Virtues (the seven of bushidō) rise from everyday acts, never only from combat.
3. Seasons restyle the same maps via palette swaps plus a few unique tiles.
4. Controls are snappy: fixed 60 Hz sim, 150 ms walk frames, input buffered per sim step.

## Tech
- Vanilla ES modules, Canvas 2D, WebAudio. No runtime dependencies, no bundler. `npm run dev`
  starts `server.js`. Relative paths only.
- Fixed 60 Hz simulation with accumulator (dt clamped to 250 ms); render on rAF.
  `window.__game.advance(ms)` steps deterministically.
- The simulation uses seeded RNG only (`src/core/rng.js`). Daily randomness is derived from
  `hash(seed, dayIndex, purpose)` so a day replays identically.
- Logical canvas (~480x270, integer-scaled). Static ground is pre-rendered into 32x32-tile chunk
  canvases; only dirty tiles are redrawn. Water is a separate animated layer underneath.
- Art is authored as palette-indexed grids or generated procedurally into grids, then compiled into
  one atlas at boot. Autotile variants are generated lazily into a cell cache.

## World scale and time
- Tile 16 px. Player walk speed 4.5 tiles/s (72 px/s); collision box 10x6 at the feet.
- Day runs 06:00 to 02:00. 10 in-game minutes = 7 real seconds (normal). The clock advances in
  10-minute ticks. Time is frozen in menus, dialogue and cutscenes.
- Calendar: 4 seasons x 28 days. Weekdays Getsu, Ka, Sui, Moku, Kin, Do, Nichi. Every 7th day
  (Nichi) is Ichi market day.
- HUD shows 24 h time plus the zodiac hour (子 at 23:00-01:00, then 丑 寅 卯 ... two hours each).

## Player resources
- Genki 200 max. Each tool swing costs 2 (skill reductions arrive with skills in M4). At 0 Genki
  tools can't be used. Sleeping before midnight restores fully; after midnight restores
  `max - (minutes past midnight / 120) * 25%`. Passing out at 02:00 restores 50%, costs 10% of
  money (cap 1000 mon), and wakes you at the farmhouse.
- Money: mon (文). Start with 500.
- Inventory: 12-slot backpack (= the hotbar row), upgrades to 24/36 in M4.

## Tools (M1)
| Tool | Effect | Genki |
|------|--------|-------|
| Kuwa (hoe) | Till dirt or cleared grass | 2 |
| Jōro (watering can) | Water a soil tile; refill at pond, river or well. 40 uses | 2 |
| Kama (sickle) | Cut weeds (drops hay), harvest ripe crops | 2 |
| Ono (axe) | Twigs (1 hit), stumps (5), trees (10, then stump), bamboo (3) | 2 |
| Tsuruhashi (pickaxe) | Stones (1 hit); breaks tilled soil back to dirt | 2 |
Any tool clears a weed. Using a tool on nothing still costs Genki (it's a swing).
Targeting: the tile in front of the player; with the mouse, any tile within 1 tile of the player.

## Farming
- Till -> plant seed (use or interact with seed selected) -> water daily -> harvest (interact).
- Each night: a watered crop gains one growth day; when growth reaches `days` it is ripe.
  Regrowing crops drop back `regrow` days after harvest. Soil dries every morning.
- Quality on harvest (M1 base chance): Fine 12%, Excellent 3%. Farming skill modifies this in M4.
- M1 crops: Daikon (4 d), Komatsuna (5 d), Soramame (6 d), Strawberry (8 d, regrows every 4).

## Seasons and weather (M2)
- Season turn: crops not in the new season wither overnight (any tool clears them). Rice grows in
  spring and summer. Winter crops need straw-covered beds (Hay on tilled soil).
- Weather per day from `hash(seed, date)`: spring clear/cloudy/rain/wind; summer days 1-10 are
  tsuyu (mostly rain), then clear/cloudy/rain/thunderstorm; autumn like spring plus exactly two
  typhoon days; winter snow/clear/cloudy/blizzard. Forecast = tomorrow's roll, shown at day end.
- Rain (incl. storm, tsuyu, typhoon) waters every tilled tile in the morning. A typhoon night tears
  out 20% of unprotected crops (straw protects).

## Irrigation (M2)
Hoe on empty tilled soil -> channel. Water flood-fills 4-connected channel tiles from any channel
tile touching natural water; a shut sluice gate blocks its tile. Tilled soil beside running water
(channel or natural) is a flooded paddy: always watered, required for rice. Pickaxe fills a channel.

## Economy (M2)
- (Since M3 the shops are in the village; see Villagers.)
- Shipping crate by the house: stacks put in are paid overnight at full price with quality
  multipliers, itemised on the end-of-day screen. Selling at the Yorozuya pays the same, now.
- Yorozuya (09:00-17:00, closed Sui): the season's seeds, sluice gates; Do is 10% off seeds.
- Kajiya (09:00-16:00, closed Nichi): iron bars (150), tool upgrades (2 days, tool is away):
  Iron 2000 + 5 iron bars, Steel 5000 + 5 steel bars, Tamahagane 12000 + 5 tamahagane.
- Tool tiers: can 40/55/70/85; hoe and can charge (hold): 3-line, 5-line, 3x3; axe and pickaxe deal
  1 + tier per hit; large logs and boulders need tier 1.

## World and maps (M3)
- Maps: Hinata Farm 64x48, Yamabuki Village 80x60, Shrine Hill 40x50, ten interiors
  (`src/maps/`). `src/maps/index.js` links doors both ways: a building door with `to` is a warp
  into that room; the room's doorway warps back to the tile below the door. Roads between outdoor
  maps are warps along the map edge. Walking onto a warp tile plays a 0.28 s ink wipe.
- One Player; a World (map, ground renderer, drops, effects) per visited map, created on first
  visit and kept. Only maps with `persist` (the farm) are saved; the player's map is saved.
- Only `farmable` maps (the farm) can be tilled; tools do nothing to village soil.
- Interiors are dimmed a little by day and lit by their hearths and lamps at night; no weather.
- Sleep in the farmhouse futon; you wake beside it (also after passing out).

## Villagers (M3)
Genzō (swordsmith, forge), Okiku (teahouse), Tomoe (shrine maiden, romanceable), Heibei (headman),
Ume (herbalist, apothecary, R), Daigo (fisherman, R), Kaito (neighbouring farmer, R), Chōbei
(storekeeper). Data in `src/data/npcs.js` (home, birthday, gift tastes, schedules) and
`src/data/dialogue/*.js` (intro, 5 heart tiers x 6+ lines, conditional lines, gift reactions,
birthday line). Lines may start with an expression tag: neutral, happy, sad, angry, surprised.
- Schedules: variants chosen by season, weekday and rain; each is a list of timed stops
  `[minutes, map, x, y, facing]`. Villagers walk at 40 px/s along A* paths, crossing maps through
  doors and roads. Rain sends everyone indoors. Positions are derived, not saved.
- Shops: open from their counters in opening hours, never on the closed day, only with the keeper
  in the room. Yorozuya 9-17 (closed Sui), Chaya 8-20 (closed Moku: tea 30, dango 60, onigiri 90),
  Kajiya 9-16 (closed Nichi), Yakuya 10-18 (closed Getsu: tonic 320). Food restores Genki.

## Bonds (M3)
250 points a heart, 10 hearts. Talk once a day +20. Gifts: loved +80, liked +45, neutral +20,
disliked -20, hated -40; x8 on birthdays; one a day and two a week per villager. A bond you have
not tended for 7 days loses 10 points a night. Dialogue tier = hearts / 2 (0-1, 2-3, 4-5, 6-7,
8-10).

## Event scripts (M3)
Line-based language in `src/systems/script.js`: `say who face "text"`, `choice "a" @x "b" @y`,
`goto`, labels `@x`, `end`, `give`, `take item n @else`, `money`, `bond`, `virtue`, `setFlag`,
`ifFlag [!]flag @x`, `wait`, `moveNpc`, `placeNpc`, `face`, `emote`, `cameraPan`, `fade`. Map
events (`src/data/events.js`) play once on entering a map, after the door wipe.

## Requests, letters, offerings (M3)
- Notice board: 1-2 postings a day from the seed: "bring" (n of an in-season crop or common goods;
  pays ~1.6x sell value + 60, +60 bond, Jin +2) and "deliver" (a parcel to another villager; 120
  mon, +60 bond, Makoto +2). Up to 3 active; 3 days to finish; lapsed requests cost nothing.
- Mailbox by the farmhouse: letters arrive the morning after their condition holds (Jirōbei's
  posthumous letters, villagers), plus Okiku's birthday gossip the day before a known villager's
  birthday. Attachments are collected when the letter is first read.
- Shrine Offerings v1: seven altars (one per virtue) x four sets. A set pays its reward and +3 to
  the altar's virtue; a full altar gives +10 and restores part of the valley: Jin opens the farm
  terraces, Rei rehangs the shrine bell (rings at 06:00 and 18:00), Yū repairs the shrine bridge,
  Makoto the Archive, Meiyo the onsen, Chūgi brings back the kodama, Gi clears the Nakasendō.

## Skills and buffs (M4)
- Six skills, Lv 1-10 at 0/100/250/450/700/1000/1400/1900/2500/3200 XP. XP comes from the act:
  harvests (by crop value), forage and digging, landing fish, breaking rock, crafting and cooking,
  machine goods, petting. At Lv 5 and Lv 10 a modal asks for one of two perks (table in
  `src/data/skills.js`). Farming, Foraging and Fishing levels add 1.2% per level to quality odds.
- Buffs from dishes: `{ kind, amount, until }` with `until` an absolute minute stamp
  (day x 1440 + minute); a new buff of the same kind replaces the old one; the HUD shows each
  with the hours left. Speed adds walk speed; farming/foraging/fishing add quality odds (fishing
  also widens the catch bar).

## Foraging and fishing (M4)
- Spots per map per dawn from `seed + day`: grove 12 forage / 3 dig, shrine 5/1, village 4/1,
  farm 3/1, on free grass or earth. Forage is seasonal (`src/data/forage.js`); dig spots give
  artifacts, clay or roots. Taken spots are recorded for the day in `foraged`.
- Water has a kind by map region (river, pond, pool, falls, stream). Fish are picked by kind,
  season, hour and weather, weighted towards easy fish at low skill; junk 12% (minus 1% per level, at least 3%).
- Cast: hold Use to charge (1-4 tiles), 4 Genki. The float waits 1.4 s plus up to 5.5 s (shorter
  with skill); then 0.75 s to strike.
  The reel: a 108 px track, a catch bar (26 + 2 per level px, x1.33 Steady Hands) lifted
  while Use is held; progress fills while the fish is in the bar and drains outside; the fish moves
  by style (smooth, dart, sinker, floater, mixed) and difficulty.
- Traps (uke) placed in water hold one catch each morning.

## Animals (M4)
- Chicks and ducklings from the Yorozuya live in the coop (six places). Each night an animal eats
  one hay from the hopper; fed animals gain affection (petting daily adds more) and lay once
  grown; quality rises with affection. Unfed animals lose affection and do not lay.
- With ducks in the coop, harvested rice has a 50% chance of one extra.

## Crafting, machines, cooking (M4)
- The Craft tab lists `CRAFTS`; a recipe above your Craftsmanship level shows its level.
- Machines take `n` of an input and finish at dawn on day `start + days` (Patient Hands: x0.75).
  Output quality follows input quality (Master Maker: at least Fine). Interacting shows progress;
  a ready machine is collected by interacting, room permitting.
- Compost on tilled soil marks it fertilised until harvest: +20% quality odds.
- Cooking only at the farmhouse irori from known recipes (onigiri, yaki-imo and tamagoyaki are
  known from the start; the others come from 250-mon scrolls at the teahouse, three unknown ones
  on sale at a time).
- Backpacks: 24 and 36 slots from the Yorozuya.

## Farm map (Hinata Farm, 64x48)
Forest border all round; the farmhouse (minka) top-centre with a kura storehouse to its west and a
well by the door; a pond to the east; the river along the south edge; the northern terraces are
fenced off (locked until the shrine is restored); a cleared 6x6 patch by the house; everything else
is overgrown with weeds, stones, twigs, stumps, young trees and bamboo placed deterministically
from the save seed.

## Saving
- localStorage, 3 slots, key `ronin.slot{n}`; JSON `{ version, checksum, meta, state }`. Version 3
  (M3) adds bonds, virtues, requests, mail and offerings; version 4 (M4) adds skills, buffs,
  foraged spots, animals and known recipes (the coop is a persistent map like the farm).
- Migrations run in order from the file's version to `SAVE_VERSION`. A checksum mismatch or parse
  failure falls back to the slot's `.bak` copy (written before every save).
- Autosave on sleep. Export/import as a `.json` file from the pause menu.

## Debug (`?debug=1`)
F1 overlay (fps, frame ms, tile, collision, entity counts), F2 skip day, F3 +1000 mon and a seed
kit, F4 cycle time +1 h (Shift: cycle season, Ctrl: cycle weather). URL params: `map, season, day,
time, weather, seed, slot`. `window.__game` exposes state getters, `advance(ms)`,
`press(code)`, `hold(code)`, `release(code)`.

## Milestones
M0 foundation -> M1 farm slice (stop for feedback) -> M2 seasons/economy -> M3 village/people ->
M4 nature/craft -> M5 combat/caves -> M6 story/festivals -> M7 content/polish. See PROGRESS.md.
