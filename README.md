# Rōnin no Sato (浪人の里)

A cozy samurai farming-life sim in pixel art. Edo-period Shinano, the 1780s: a masterless samurai
inherits an overgrown hillside farm, a rusted sword with opinions, and a valley that needs help.

Vanilla JavaScript (ES modules), Canvas 2D and WebAudio. No runtime dependencies, no bundler.

## Run

```sh
npm run dev          # zero-dependency static server on http://localhost:8080
```

Then open http://localhost:8080/. Any static host works too (itch.io, GitHub Pages): all paths are
relative.

Useful URL parameters:

| Param | Effect |
|-------|--------|
| `?play=1` | skip the title and start a new farm in slot 1 |
| `?slot=2` | load save slot 2 |
| `?seed=7` | farm seed (overgrowth layout) |
| `?season=summer&day=5&time=17:30&weather=rain` | set the calendar, clock and weather |
| `?map=village` | start on another map (`farm`, `village`, `shrine`, or an interior such as `chaya`) |
| `?debug=1` | debug keys: F1 overlay, F2 skip day, F3 +1000 mon and seeds, F4 +1 hour (Shift+F4 next season, Ctrl+F4 next weather), F5 to the Kurayama mine mouth (Shift+F5 one floor down), F6 spawn an enemy |

## Controls

| Action | Keyboard / mouse | Gamepad |
|--------|------------------|---------|
| Move | WASD / arrows | left stick, d-pad |
| Use tool / plant / attack | J, left click (hold to repeat; hold with a blade for a heavy strike) | X |
| Dodge step (caves) | Space | B |
| Parry (caves) | L | Y |
| Interact / harvest / talk / give | K, E, right click | A |
| Hotbar | 1-9, 0, -, =, mouse wheel, [ ] | LB / RB |
| Menu (items, options, save) | Esc, Tab | Start |

With the mouse, any tile next to the player can be targeted directly.

Farming tips: hoe a tilled tile again to dig an irrigation channel (water flows from the pond or
river; interact with a sluice gate to open or shut it). Soil beside running water floods into a
paddy for rice. Use Hay on tilled soil to lay straw for winter crops. Upgraded hoes and cans charge
while the button is held. Sleep in the futon inside the farmhouse.

Village tips: walk west along the valley road to Yamabuki Village. Shops open at their counters
while the keeper is in. Talk to villagers once a day; interact while holding an item to offer it
as a gift (the Bonds tab in the menu remembers what they like). The notice board at the
crossroads posts small requests every morning, and letters arrive in the mailbox by your gate.
Climb the stair north of the village to the shrine: the seven altars in the hall take offerings,
and a full altar restores part of the valley. Use food from the hotbar to recover Genki.

Nature tips: the Hollow Grove lies west of the village, with forage every morning (and dig spots:
hoe them). Daigo sends a rod once you have met him: hold Use to cast, press it when the float
dips, then hold to lift the bar and keep the fish inside it. Chicks and ducklings from the
Yorozuya live in the coop beside the farmhouse; keep hay in the hopper and pet them daily. Craft
machines from the Craft tab in the menu, place them, and interact while holding their input.
Cook at the irori in the farmhouse; teahouse scrolls teach new dishes, and dishes give buffs.

Mountain tips: fill the Altar of Yū in the shrine hall (timber, stone, iron bars, road rations)
and the rear gate opens onto Mount Kurayama. Walk into the mine mouth to go down; ladders lead
deeper, the rope climbs out, and a lit lantern on every fifth floor lets you start from there.
Watch for the tell (a wind-up and a glint): step aside with Space, or press L as it lands to
parry, which refunds Ki and leaves the foe open. Food mends Inochi (命); Ume sells salves. Take
iron bars and your uncle's rusted katana to Genzō for a real blade, and ore and charcoal to be
smelted. If you fall, you wake in Ume's care; what you dropped waits in a bundle by the mouth.

## Test

```sh
npm install          # dev only: Playwright for headless tests
npm test             # unit tests (Node's built-in runner)
npm run test:e2e     # headless tests: farm day, save/load, village; forage, fish, coop, cook; caves, combat, boss
npm run shots        # regenerate the latest milestone's screenshots (shots/m5; `-- m1` to `m4` for older sets)
```

Tools: `tools/gallery.html` (every palette colour, sprite, tile and autotile case at 1x and 4x) and
`tools/anim-preview.html` (all character animations and tool swings), served by `npm run dev`.

## Project docs

- `DESIGN.md`: working spec (decisions only)
- `STYLE_GUIDE.md`: art rules measured from the references
- `PROGRESS.md`: done / next / decisions / known bugs
- `CREDITS.md`: licences

## Also in this repo

`orbit/index.html` is ORBIT, an earlier one-file arcade game that lived at the repository root.
It was moved to its own folder, unchanged, when this project started.
