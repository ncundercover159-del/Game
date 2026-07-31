# 👑 Crown Quest

A **Royal Match** style match-3 puzzle game, built for mobile with vanilla
JavaScript and a single `<canvas>`. No frameworks, no build step, and no
binary assets — every gem, rocket, crate and particle is drawn with canvas
paths at runtime.

> **Mobile only.** The game is designed and laid out for portrait phones.
> On a desktop browser use the device toolbar / responsive mode; a landscape
> phone gets a "please rotate" screen instead of a squashed board.

---

## Running it

The whole game is static files and works straight from disk:

```bash
open index.html          # macOS
xdg-open index.html      # Linux
```

Or serve it (needed if you want to open it from a phone on your network):

```bash
npm start                # http://localhost:8080
# or
python3 -m http.server 8080
```

Then open the page on your phone, or in Chrome DevTools with device
emulation set to a phone (iPhone 12 / Pixel 5 are good choices).

---

## How to play

Swap two neighbouring pieces to line up **three or more** of the same jewel.
Clear the goals shown at the top of the screen before you run out of moves.

**Controls** — swipe a gem toward its neighbour, or tap one gem and then tap
an adjacent one. Tapping a rocket or TNT fires it immediately (that costs a
move).

### Power-ups

| Made by | Piece | Effect |
|---|---|---|
| 4 in a row | **Rocket** | Clears the whole row (or column, from a vertical match) |
| L or T shape | **TNT** | Blows up a 5×5 area |
| 5 in a row | **Light Ball** | Swap it with any gem to sweep that colour off the board |

Swapping two power-ups together combines them:

| Combo | Effect |
|---|---|
| Rocket + Rocket | Clears a full row **and** column |
| Rocket + TNT | Clears three rows and three columns |
| TNT + TNT | Enormous 7×7 blast |
| Light Ball + Rocket | Turns every gem of that colour into a rocket, then fires them all |
| Light Ball + TNT | Turns every gem of that colour into TNT, then detonates |
| Light Ball + Light Ball | Clears the entire board |

### Obstacles

| | | |
|---|---|---|
| **Crate** | Won't fall, blocks gems. Break it by clearing a match next to it. Reinforced crates take two hits. |
| **Ice** | Freezes a gem in place. It can still be matched by its neighbours — each match chips one layer away. |
| **Chain** | A chained gem can't be swapped. Match it with neighbours to snap the chain. |
| **Stone** | Permanent wall. It never breaks and gems fall around it. |

Finishing a level with moves to spare turns each leftover move into a rocket
that fires for bonus points. Score decides how many of the three stars you
take home.

### Meta

- **Lives** — 5 max, one is spent per attempt, one regenerates every 15
  minutes. You can refill with coins.
- **Coins** — earned for finishing levels; spent on in-level boosters
  (Hammer, Rocket, TNT), extra moves, and life refills.
- Progress, stars, coins and lives are saved to `localStorage`.

60 levels are available: 15 handmade, the rest generated deterministically
from the level number so they're the same on every device.

---

## Project layout

```
index.html          markup for both screens plus the dialog layer
css/styles.css      mobile-first styling, portrait-locked
js/utils.js         maths, easing, seeded RNG, small DOM helpers
js/audio.js         WebAudio synth — every sound effect is generated
js/storage.js       save file: progress, stars, coins, lives timer
js/art.js           canvas drawing for gems, power-ups, blockers, icons
js/levels.js        level table, layout DSL, procedural levels, validator
js/fx.js            particles, shockwaves, rocket trails, score popups
js/board.js         board state and rules: matching, blasts, gravity
js/game.js          the level itself: input, animation, resolution loop
js/ui.js            screens, level map, HUD, dialogs, boosters
js/main.js          boot + mobile viewport handling
tools/smoke.js      headless Chromium test that autoplays levels
```

### Level format

Levels live in `js/levels.js`. A layout is an array of equal-length strings,
one character per cell:

```
.  playable cell (random gem)      X  stone wall
#  void — not part of the board    b  crate (1 hit)    B  crate (2 hits)
i  gem in ice                      I  gem in double ice
c  chained gem                     1-6  a fixed gem colour
```

Goals are `{ type: 'color', color: 0, count: 20 }` or
`{ type: 'crate' | 'ice' | 'chain', count: 'all' }`, where `'all'` counts
every matching obstacle in the layout.

One rule the board relies on: **a column's playable cells must be vertically
contiguous**, otherwise gems can never reach the cells under a gap.
`Levels.validate()` runs at boot and logs any layout that breaks this.

---

## Tests

```bash
npm install     # playwright, only needed for the test
npm test
```

`tools/smoke.js` launches mobile-emulated Chromium, plays a real touch swipe,
then autoplays several levels while asserting after every turn that no
playable cell is empty, that render positions match the grid, and that no
unresolved match is left behind. It finishes by firing every power-up combo
and checking the board still settles. Any console or page error fails the run.

Set `SMOKE_LEVELS` to change how many levels it plays.

---

## License

MIT. Crown Quest is an original implementation written for learning purposes
and is not affiliated with Royal Match or Dream Games.
