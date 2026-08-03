# RERUN 2D — A Chronophotograph

A side-on rewrite of [RERUN](../rerun/) as a single 51KB HTML file. Same rules,
different dimension, and a look of its own.

Twenty exposures of twenty seconds. At the end of each one, everything you did
is developed into a ghost that repeats it forever. Ghosts are solid. A storey
is 2.8m and you can jump 1.8m, so **the only way up is to stand on somebody you
used to be.**

## Why side-on

The core verb is *stand on your past self to reach the thing.* In a cutaway
section, a stack of five bodies climbing a tower is the clearest possible
picture of that. Top-down hides it; side-on is the whole idea in one glance.

## The look

Étienne-Jules Marey photographed motion as overlapping exposures of one figure
on a black plate. That is literally what a ghost is here, so the game is drawn
as a chronophotograph rather than as a game with a filter on it.

- Soot black `#0b0a0d` — a warm silver-gelatin ground, not blue-black.
- Bone `#efe7d8` for every line. Amber `#f5a623` is the objective; cold
  `#6fd3ff` is a turnstile; blood `#e0483b` is death and the knife.
- The tower is an **architectural section**: struck floor lines with hatched
  undersides, drawn with a slight tremor so it reads as inked rather than
  plotted. No fills anywhere, so bodies are the only solid things in the room.
- **Ghosts are exposures** — outline figures trailing their own previous
  positions, sampled straight out of the recording, with Marey's joint dots.
- **Generation decays the exposure.** Gen 1 is a whole figure; by gen 14 it has
  burned down to a stick-and-dot diagram. The art direction and the frame
  budget pull the same way: the older the crowd gets, the cheaper it is to draw.
- Register marks at the corners, because a plate gets trimmed.

Canvas 2D throughout — no WebGL, no dependencies, no Three.js. 51KB total
against 546KB for the 3D build.

## The tower

Six storeys, 2.8m apart, 9m wide. **Every floor has a hole and the holes
alternate sides.** That is the whole route: stand a past self under the hole,
climb it, walk to the next one. Under a hole the clearance is two storeys,
which is the only place a body is tall enough to be stood on — 2.5m of headroom
is not.

The ground floor stops short of the right wall. The drop is wide on purpose: a
narrower one and a running player strolls across it without noticing, because
step-up assist catches them on the far lip.

Fourteen plates. Rounds 1–14 escalate by count, climbing a storey at a time;
15–20 hold all fourteen and convert one more into a turnstile each round.

## The knife

Stand against a past self and press KNIFE.

It is **not** deleted. Its tape is rewritten from that instant onward: it walks
its old route up to the moment you killed it, then dies and falls out of the
building — and does it again every twenty seconds for the rest of the plate.
Everything before the knife is untouched.

So it is a trade, never an undo. You lose whatever that ghost was holding for
the rest of its loop, permanently, and you gain a corpse that screams on a
schedule. The button only lights when somebody is actually in reach.

## Build

```bash
cd rerun/client && npm install
npm run build:2d      # -> ../../rerun2d/dist/rerun-2d.html
```

## Checked, not assumed

`scratchpad` harnesses verify the things the design rests on:

- jump apex 1.30m; a 2.8m storey unreachable alone (1.75m of reach)
- you can stand on a ghost, and from there reach the next floor
- the drop kills; the shell holds; the door blocks and passes
- all 14 plates rest on a floor and none overlap
- consecutive spawns never sit inside each other
- every round is strictly harder than the one before
- 60 shoving ghosts for a simulated minute produce no NaN
- the knife rewrites the loop rather than deleting the ghost: everything before
  it is byte-identical, the ghost is alive again next loop, and it stops
  holding plates only after the stab point

## Manual checklist

- [ ] Round 3 is impossible until you leave somebody under the left hole.
- [ ] Walking off the ground floor's right edge kills you; jumping it does not
      save you.
- [ ] Knifing a past self standing on a plate drops the plate at that instant,
      and only from that instant.
- [ ] By exposure 10 the tower has a rhythm of distant screams.
- [ ] The KNIFE button is dark until somebody is in reach.
- [ ] Portrait only; the register marks stay clear of the notch.
