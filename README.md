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
| `?season=summer&day=5&time=17:30` | set the calendar and clock |
| `?debug=1` | debug keys: F1 overlay, F2 skip day, F3 +1000 mon and seeds, F4 +1 hour (Shift+F4 next season) |

## Controls

| Action | Keyboard / mouse | Gamepad |
|--------|------------------|---------|
| Move | WASD / arrows | left stick, d-pad |
| Use tool / plant | J, left click (hold to repeat) | X |
| Interact / harvest / talk | K, E, right click | A |
| Hotbar | 1-9, 0, -, =, mouse wheel, [ ] | LB / RB |
| Menu (items, options, save) | Esc, Tab | Start |

With the mouse, any tile next to the player can be targeted directly.

## Test

```sh
npm install          # dev only: Playwright for headless tests
npm test             # unit tests (Node's built-in runner)
npm run test:e2e     # headless smoke test: new game, till, plant, water, sleep, grow, save/load
npm run shots        # regenerate milestone screenshots into shots/
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
