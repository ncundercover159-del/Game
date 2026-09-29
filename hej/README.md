# Hej!

A pixel-art life sim set in Aarhus. You have just moved to Denmark, and the aim is to
take an English speaker from zero to conversational Danish (CEFR A1 → B2). It is a
language-learning tool first and a game second: every mechanic either exposes you to
real Danish, makes you produce it, or makes you review it.

**Status: vertical slice.** Chapter 1 (*Ankomst*, A1) is playable end to end: walking,
dialogue with replies you choose or build, tap-to-look-up on every word, the audio
pipeline, pattern spotlights, listen-and-choose and word-order exercises, spaced
repetition woven into the world, the chapter pass gate, and free conversation (*Snak*).

```bash
cd hej
npm install
npm run dev          # compiles content, then serves at http://localhost:5173
npm test             # content integrity, SRS, answer matcher, TTS cache
npm run build        # typecheck + production PWA in dist/
```

## Playing

- **Touch:** tap a tile to walk there. Tap a person, sign, door or mailbox to go to it and interact.
- **Keyboard:** arrows/WASD to move, Space/E to interact, Enter for *Videre* (next),
  1–4 to pick a reply, R to replay a line, T to replay it slowly.
- **Every Danish word is tappable.** The popup shows the meaning in context, the dictionary
  form, part of speech, en/et, inflections (each one voiced), a pronunciation note, and
  *Læg i bunken* (add to my deck).
- **EN / DA / —** (top bar) switches scaffolding: English subtitles → Danish only (tap EN
  to peek) → no hints.
- **Long-press** (or hover) any button to hear its Danish label.
- **💬 Snak:** free conversation, where you build your own sentences from scratch. See below.
- **📚 Øv:** your deck, a practice session, and the chapter test.

## How it teaches

| Rule | Where it lives |
|---|---|
| Real, spoken Danish | `content/chapters/*.yaml`. Every line has an optional `say:` "how it's actually said" note, shown under the line. |
| Audio for everything | Lines, words, every inflection, signs, menu items and prompts are voiced at build time (`scripts/tts.ts`). Normal and slow speed everywhere. |
| Word lookup | Sentences are pre-tokenised at build time with lemma links into `content/lexicon.yaml`. The build **fails** on any word that isn't in the lexicon. |
| Progressive difficulty | Chapters carry a CEFR level and a pass gate (80% on a mixed test). Scene 1 starts with 2–4 word present-tense sentences. |
| Frequency and recycling | `content/REPORT.md` (generated) lists words that haven't reached 5 contexts yet and words above frequency rank 3000. |
| Structure through play | Pattern spotlight cards (`content/grammar.yaml`) show 3 examples *from lines you just heard*, with the key form highlighted, then drill them straight away with word tiles. |
| Spaced repetition | FSRS-4.5 (`src/srs/fsrs.ts`). Every word and sentence you meet becomes a card. Reviews happen when neighbours quiz you (💬 marker over their head), in the daily post in the mailbox, after each scene, and on the Øv screen. |

**Chapter 1 contents:** 4 scenes (keys from the landlord, meeting the older neighbour,
the teenager with slang, a visit from your best friend), 4 pattern spotlights (yes/no
questions, question words, definite endings, verb-second), numbers (door codes, phone
numbers read in pairs), 4 NPCs with their own speech registers, relationship meters and
memory. For example, Grethe asks after "Chicago" if you told her you're from the US.
There are also 3 free-conversation topics.

## Audio (Google Cloud Text-to-Speech)

Clips are generated at build time with Google's da-DK neural voices, one voice per
character (`content/voices.yaml`). Until they exist, the game falls back to the
browser's Danish `speechSynthesis`.

1. In Google Cloud, enable the **Cloud Text-to-Speech API** and create an **API key**
   (restrict it to that API).
2. Put it in `hej/.env` (git-ignored): `GOOGLE_TTS_API_KEY=...`
3. `npm run audio:voices` lists the da-DK voices your key can use. Adjust
   `content/voices.yaml` if any are missing.
4. `npm run audio:dry` shows how many clips and characters would be generated
   (Chapter 1 is about 1,400 files and 16k characters).
5. `npm run audio` generates `public/audio/<hash>.mp3`, `<hash>.slow.mp3` and `manifest.json`.

Each file name is a hash of provider + voice + rate + text. Editing one line regenerates
only that clip, and changing a character's voice regenerates only that character's
clips. `npm run audio -- --prune` deletes clips that are no longer referenced. Commit
`public/audio/` so the deployed PWA works offline without the key.

## Snak: free conversation

Build your own sentences by typing (with æ/ø/å keys), tapping words from your **word
bank** (everything you've met), or speaking (🎤, where the browser supports da-DK speech
recognition).

- **Offline (always available):** topics in `content/talk.yaml`. Your answer is checked
  against flexible patterns (`[optional] (alt|alt) {slot}`), and a coach catches typical
  English-speaker mistakes: *jeg er fin*, *tak meget*, missing *det* in short answers,
  verb-second after *i morgen*, *ikke* placement, *min navn*. Unknown words get "did you
  mean …?" suggestions, including for missing æ/ø/å.
- **Generated (optional):** add your own Anthropic API key in Settings to talk about
  anything with the characters you've met. The model stays in character at your CEFR
  level, sticks mostly to words you know, and corrects each message with a natural
  version and a short explanation. The key is stored only in this browser and sent only
  to `api.anthropic.com`. The SDK is loaded lazily, so the offline game never downloads it.

## Content

Everything is YAML in `content/`. Nothing is hard-coded. `npm run content` compiles it to
`src/generated/content.json` (the only thing the game reads) and validates it.

```yaml
# content/chapters/ch1.yaml: a line
- id: ch1.s1.keys            # only needed if something refers to it
  henrik: Her er nøglerne.   # speaker: npc id, `you` or `narrator`
  en: Here are the keys.
  say: "'nøglerne' is 'NOY-la-neh'."
  tags: [v2, definite]
  lx: { så: "så#adv" }       # resolve an ambiguous form
  ctx: { står: "is (lit. stands)" }  # meaning in this context
  reviewed: false            # flip once a native speaker approves it
```

The script also supports `choose:` (replies with `q: natural | ok | awkward | wrong` and a
`why:` explanation), `build:` (assemble your reply from tiles), `exercise:`,
`spotlight:`, `set:` (flags the NPCs remember) and `if:`. The header of `ch1.yaml`
documents all of them.

**Native-speaker review:** every line has `reviewed: false` until approved. Settings shows
the count. Players can **⚑ report a mistake** on any line, word or generated reply.
Reports are stored locally and exported as JSON from Settings. In word-order exercises,
*"Mine was also correct"* files a report so valid alternative orders can be added to `accept:`.

## Architecture

```
content/            YAML sources (chapters, lexicon, grammar, npcs, talk, ui, maps, voices)
scripts/            build-content.ts (compile + validate), tts.ts (Google TTS), make-icons.ts
src/content/        types, tokenizer (shared by build and runtime)
src/engine/         canvas renderer, procedural 16×16 pixel art, grid movement, BFS paths
src/game/           game loop, scene interpreter, scene triggers, SRS weaving, chapter gate
src/srs/            FSRS scheduler + deck (IndexedDB)
src/talk/           Snak: pattern matcher/coach, chat UI, optional AI partner
src/ui/             dialogue, word lookup, exercises, spotlight, HUD, menus
```

Art is palette-based and drawn in code (`src/engine/sprites.ts`), so there are no asset
licences to track. To swap in a CC0 tileset such as Kenney's, replace `tileCanvas()` and
`characterFrames()` with atlas lookups. Progress lives in IndexedDB. There is no backend.

## Known gaps in the slice

- **Audio clips are not generated yet.** The pipeline is tested with a mock synthesizer,
  but it needs your Google key for the real voices. Until then, audio uses the browser's
  Danish voice.
- **Recycling:** 150 words introduced in Chapter 1 appear in fewer than 5 contexts so far.
  `content/REPORT.md` lists them. Chapters 2–3 are meant to recycle them.
- **Generated conversation** has only been built and type-checked. It hasn't been run
  against the live API (no key in the build environment).
- Frequency ranks are approximate, and no Danish has been native-reviewed yet
  (`reviewed: false` everywhere).
- Still to come in step 2: dictation, cloze, speak-aloud with shadowing, audio-to-picture,
  and Chapters 2–3.
