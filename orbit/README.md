# ORBIT

A one-thumb arcade game for killing five minutes — built for phones, in a single
file with no dependencies, no build step and no network calls.

**Play:** open `index.html` in any browser. That's it.

## How to play

You are the cyan dot, orbiting the core.

- **Tap anywhere** to reverse your spin direction.
- **Dodge the pink spikes** flying in at the ring. One touch ends the run.
- **Grab the gold motes** on the ring — worth 2 points each.
- Every spike you survive is +1. The game speeds up every 10 points.

Your best score is kept in `localStorage`.

Space / arrow keys work on desktop, if you're not actually in a cinema.

## Built for a dark room

- Near-black palette so the screen isn't a nuisance to the row behind you.
- Everything reachable with one thumb; taps anywhere on the screen count.
- Pinch-zoom, double-tap-zoom, text selection and overscroll are all disabled,
  so a fast tap never scrolls or selects anything.
- `env(safe-area-inset-*)` padding keeps the HUD clear of notches and home bars.
- Layout adapts to portrait, landscape and short screens; the orbit is sized to
  stay clear of the score readout.
- Canvas is DPR-scaled (capped at 2x) and runs at 60fps; glow is drawn with
  layered fills rather than `shadowBlur` to keep it cheap on mobile GPUs.
- Light haptics via the Vibration API where supported, and it honours
  `prefers-reduced-motion`.

## Adding it to your home screen

It ships with the `mobile-web-app-capable` and `apple-mobile-web-app-capable`
meta tags, so "Add to Home Screen" gives you a fullscreen, chrome-free launcher.

## Files

- `index.html` — the whole game: markup, styles, and logic.
