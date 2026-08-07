# THE LUMPS — RERUN, from above

A top-down rewrite of [RERUN](../rerun/) as a single 60KB HTML file. Same rules,
same room, same simulation — and a look and a cast entirely of its own.

Twenty observations of twenty seconds. At the end of each one, everything you
did is decanted into the tank as a solid past self that repeats it forever.
Past selves are solid. The shelf is 2.1m up and you can jump 1.36m, so **the
only way onto it is somebody you used to be.**

## Why it shares the 3D game's simulation

A top-down view needs X/Z movement with a height axis. That is not a second,
simpler physics — it is exactly the simulation `../rerun/shared` already runs,
already argued with, and already has harnesses for. So this build imports the
arena, the physics, the recordings and the plates wholesale, and owns only two
things: the knife, and how it looks. `rerun2d/src/` contains no simulation.

The one thing added to the shared code is `killFrom()` in `ghostbuf.js`, which
rewrites a recording's tail into a death.

## The look — a specimen tank, in plan

The room is drawn as a page out of somebody's observation notebook: measured,
hatched, annotated, dimensioned, entirely in one ink on aged graph paper. The
specimens are the only saturated thing on it. The whole joke is that gap —
deadpan laboratory apparatus, absurd tenants.

- Paper `#e6dcc4`, floor `#f3ecda`, ink `#241d1c`. Red is the objective, blue is
  a turnstile, amber means a plate is bearing weight.
- Walls are **plan-view hatched bars** and are never lifted off the floor.
  Lifting a wall in an oblique view hides the room behind it, and the closet is
  a room behind a wall.
- The shelf is a contoured slab with a drop shadow and a `+2.10` spot height.
  The pit is a hole with rim ticks stepping into it and the word NO FLOOR.
- Ruler ticks, a halved scale bar, a north arrow, a sheet number, and rotated
  marginalia down both edges, all of it kept clear of the HUD.
- **Every death stains the page**, permanently, on its own layer. By observation
  fifteen the floor is a crime scene.

### Height, in a view that has no horizon

Exactly one trick: a body is shifted up the screen in proportion to how far it
is above *whatever it is standing on*, and leaves its shadow behind on the
floor. The gap between body and shadow is the entire height cue, so the shadow
shrinks with altitude and disappears over the pit — where the body is instead
clipped to the hole, and drops out of sight into it.

## The cast

Nothing here is human. From directly overhead a person is a disc with
shoulders, which is not a character.

A **Lump** is a pear-shaped blob with a googly eye cluster that migrates around
the body to face wherever it is going, a fringe of scuttling legs along its
flanks, three wagging tufts at the back, a permanently astonished mouth that
opens wider the faster it goes, and an antenna with no self-control.

Every frame of it is derived from the recorded transform — position, height,
grounded, dead — plus cumulative distance travelled, which drives the scuttle so
the legs match the ground instead of skating. **No animation data is authored,
stored or transmitted.** Specifically:

| what you see | what drives it |
| --- | --- |
| leg cycle, tuft wag, body lumps crawling | distance travelled |
| heading (eased, and held when stationary) | velocity |
| lean and stretch along the direction of travel | speed |
| pinch when rising, splat when falling | vertical velocity |
| landing squash | the grounded transition |
| pupils lagging behind the body | velocity |
| antenna whip | velocity, opposed |
| blinks | wall clock, per-specimen phase offset |
| X eyes, splayed legs, flopped hat | the dead flag |

**Generations escalate.** Four legs become ten. One eye becomes three. A party
hat arrives at generation three and does not stop growing. The lumps get
lumpier. Nobody decided that on purpose; it just kept happening. The title card
shows generations 1, 9 and 18 side by side, live, because no sentence conveys
that as fast as the things themselves do.

Specimens are drawn at 1.45× their collision radius. At true scale a Lump is
0.69m across in a 10.4m room, which on a phone is a dot, and a dot cannot have a
face. They squash into their neighbours a little. Blobs should.

## The knife

Stand against a past self and press KNIFE. Reach is barely more than touching
distance and it works in every direction — aiming a knife with a thumbstick is
not a game.

It is **not** deleted. Its tape is rewritten from that instant onward: it
scuttles the same route up to exactly the spot where you killed it, and dies
there, and lies there — and does it again in twenty seconds, and again, for the
rest of the experiment. Everything before the knife is untouched.

A corpse is neither solid nor heavy: it stops being a step and stops being a
weight, permanently. So the knife is a trade and never an undo. You destroy
every future in which that self was useful, which is the same thing you always
do. It gets a chalk outline, and the page keeps the stain.

## Controls

A floating stick anywhere in the left half — it appears under your thumb and
drags its own origin, so a long swipe never pushes against an invisible wall.
HOP and KNIFE bottom right. KNIFE is grey until somebody is actually in reach.

Keyboard: WASD/arrows, space to hop, K or J to knife.

## Build

```bash
cd rerun/client && npm install
npm run build:2d      # -> ../../rerun2d/dist/rerun-2d.html
```

Canvas 2D throughout — no WebGL, no dependencies, no Three.js. 60KB total
against 546KB for the 3D build. The static page (paper, apparatus, annotation)
and the stain layer are each drawn once and blitted, so a frame costs the
plates, the specimens and nothing else.

## Checked, not assumed

The simulation's own harnesses live with the 3D build; these are the ones this
build adds:

- a full twenty-observation bot run: no NaN, no escape from the arena, the
  ghost count reaches its cap and retires correctly
- the knife rewrites the loop rather than deleting the ghost — everything
  before the stab is byte-identical, and the corpse stops holding plates and
  stops being climbable only from that instant
- the canvas sizes itself off the window, never off its own backing store
  (`inset: 0` does not stretch a replaced element, and a renderer that measures
  `clientWidth` will double its own scale on every resize)

## Manual checklist

- [ ] Observation 3 is impossible until you leave somebody beside the shelf.
- [ ] Walking into the hole kills you, and the ghost goes in every loop after.
- [ ] Knifing a past self that is standing on a plate drops the plate at that
      instant, and only from that instant.
- [ ] By observation 10 the tank has a rhythm of distant screams.
- [ ] The KNIFE button is grey until somebody is in reach.
- [ ] The SUBJECT caret makes you findable in a crowd of sixty.
- [ ] Portrait only.
