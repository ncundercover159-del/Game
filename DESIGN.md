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
- Shipping crate by the house: stacks put in are paid overnight at full price with quality
  multipliers, itemised on the end-of-day screen. Selling at the Yorozuya pays the same, now.
- Yorozuya (09:00-17:00, closed Sui): the season's seeds, sluice gates; Do is 10% off seeds.
- Kajiya (09:00-16:00, closed Nichi): iron bars (150), tool upgrades (2 days, tool is away):
  Iron 2000 + 5 iron bars, Steel 5000 + 5 steel bars, Tamahagane 12000 + 5 tamahagane.
- Tool tiers: can 40/55/70/85; hoe and can charge (hold): 3-line, 5-line, 3x3; axe and pickaxe deal
  1 + tier per hit; large logs and boulders need tier 1.

## Farm map (Hinata Farm, 64x48)
Forest border all round; the farmhouse (minka) top-centre with a kura storehouse to its west and a
well by the door; a pond to the east; the river along the south edge; the northern terraces are
fenced off (locked until the shrine is restored); a cleared 6x6 patch by the house; everything else
is overgrown with weeds, stones, twigs, stumps, young trees and bamboo placed deterministically
from the save seed.

## Saving
- localStorage, 3 slots, key `ronin.slot{n}`; JSON `{ version, checksum, meta, state }`.
- Migrations run in order from the file's version to `SAVE_VERSION`. A checksum mismatch or parse
  failure falls back to the slot's `.bak` copy (written before every save).
- Autosave on sleep. Export/import as a `.json` file from the pause menu.

## Debug (`?debug=1`)
F1 overlay (fps, frame ms, tile, collision, entity counts), F2 skip day, F3 +1000 mon and a seed
kit, F4 cycle time +1 h (Shift: cycle season). URL params: `map, season, day, time, seed, slot`
(and `weather` once weather exists in M2). `window.__game` exposes state getters, `advance(ms)`,
`press(code)`, `hold(code)`, `release(code)`.

## Milestones
M0 foundation -> M1 farm slice (stop for feedback) -> M2 seasons/economy -> M3 village/people ->
M4 nature/craft -> M5 combat/caves -> M6 story/festivals -> M7 content/polish. See PROGRESS.md.
