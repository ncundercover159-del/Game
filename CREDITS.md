# Credits and licences

## Original work
All sprites, tiles, UI art, maps, characters, names, dialogue and code in this repository are
original, authored for this project as palette-indexed grids or procedural generators in
`src/art/`. No reference image is shipped or traced; the references were used for style analysis
only (see STYLE_GUIDE.md).

## Music and sound
There are no audio files. Every sound effect, the music and the valley's ambience are synthesised
at run time with the Web Audio API (`src/core/audio.js`, `instruments.js`, `ambience.js`):
oscillators, filtered noise and envelopes. The tunes are composed procedurally in the game's
scales from its own theme definitions (`src/data/music.js`, `src/systems/music.js`).

## Third-party assets
| Asset | Files | Author | Licence |
|-------|-------|--------|---------|
| Fusion Pixel Font (8px, 10px, 12px, proportional, Japanese) | `assets/fonts/fusion-pixel-*-jp.woff2` | TakWolf and contributors (built on Ark Pixel Font and other open pixel fonts) | SIL Open Font License 1.1, `assets/fonts/LICENSE-OFL.txt` |

The font files were taken unmodified from the `@fontsource/fusion-pixel-*-proportional-jp`
5.3.0 npm packages.

## Development tools (not shipped)
- Playwright (Apache-2.0) for headless tests and screenshots.
