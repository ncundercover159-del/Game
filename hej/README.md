# Hej!

A pixel-art life sim set in Aarhus. You have just moved to Denmark, and the aim is to
take an English speaker from zero to conversational Danish (CEFR A1 → B2). It is a
language-learning tool first and a game second: every mechanic either exposes you to
real Danish, makes you produce it, or makes you review it.

**Status: all ten chapters are playable (A1 → B2).** 31 scenes, about 1,200 voiced lines,
a 900-word lexicon, 27 grammar spotlights, 7 exercise types, 16 characters, 16 maps
connected by bus and letbane, and free conversation with every main character. An
automated playthrough completes every scene and passes every chapter test on a new game.

| # | CEFR | Chapter | Scenes |
|---|---|---|---|
| 1 | A1 | Ankomst · Arrival | Nøglerne · Naboen · Den nye · Tak for sidst |
| 2 | A1 | Indkøb · Shopping | Hos bageren · På caféen · I Netto |
| 3 | A2 | Rundt i byen · Getting around | Rejsekortet · Hvor er indgangen? · Hvad er klokken? |
| 4 | A2 | Papirer og piller · Paperwork and pills | Telefonbutikken · Borgerservice · På apoteket |
| 5 | A2 | Det nye job · The new job | Første dag · Frokostpausen · Fredagsbar |
| 6 | B1 | Nye venner · New friends | En sms fra Sara · I byen · Padel |
| 7 | B1 | Hos lægen · At the doctor's | Syg · Hos lægen · Recepten |
| 8 | B1 | Søndagsmiddag · Sunday dinner | Velkommen · Ved bordet · Kaffe og kage |
| 9 | B2 | Meninger · Opinions | Klagen · Diskussionen · Byttet |
| 10 | B2 | Julefrokost · The Christmas party | Gode råd fra Mads · Julefrokosten · Dagen derpå |

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
- **Bus and letbane:** once you have a Rejsekort (Chapter 3), walk to a stop sign to travel
  between Jægergårdsgade (home), Dokk1 in the city centre, and Risskov.
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

**Exercise types**, mixed by the scheduler (recognition while a card is new, production
once it's known):

| Type | What you do |
|---|---|
| Listen and choose | Hear a sentence or word, pick the meaning (or the number or time you heard) |
| Word-order tiles | Put the words in order. Also used to build your own replies in conversations |
| Dictation | Type what you hear, with æ/ø/å keys and word-by-word feedback |
| Cloze | Fill the gap. Great for inflections: *boede / bor / boet* |
| Pick the natural reply | Choose what a Dane would say back, with an explanation for the unnatural options |
| Speak aloud / shadowing | Record yourself. Speech recognition checks your words (Chrome, Edge, Safari), then you compare with the native clip. Self-rating is available without a mic |
| Match audio to picture | Hear a word, pick the picture (50 picturable words) |

**Grammar spotlights (27):** yes/no questions, question words, definite endings, verb
second, *vil gerne*, adjective endings, numbers above 20, *ikke* placement, modal verbs,
imperative, telling the time, past tense, perfect, *fordi* sub-clauses, time
expressions, inversion after a sub-clause, comparison, reflexive verbs,
*må / behøver*, *da / når*, past vs perfect, topicalisation, *synes / tror / mener*,
agreeing and disagreeing, the passive, particle verbs, and conditions without *hvis*.

**Characters (16)**, each with their own register and voice: Henrik (landlord), Grethe
(older neighbour), Mads (teenager, slang), Amalie (best friend), Hanne (baker), Emil
(Netto cashier), Sara (barista and friend), Yasmin (student), Ali (phone shop), Pia
(Borgerservice), Birgit (pharmacist), Jonas and Mette (colleague and boss), Karen (GP),
and Lise and Bent (Amalie's parents). They remember your choices. For example, Grethe
asks after Chicago if you told her you're from the US, and Amalie mentions Grethe's
coffee if you accepted the invitation. Their greetings change with your relationship.
When nothing is scheduled, they make chapter-appropriate small talk that recycles
everyday words (`content/idle.yaml`).

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
   (the full game is about 5,000 files and 94k characters).
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

## Testing

```bash
npm test          # content integrity, FSRS, answer matcher, Snak model answers,
                  # TTS cache, and a reachability check that every scene can be walked to
```

For end-to-end runs, `?test` in the URL marks correct answers in the DOM, and
`?test&ch=N` starts a new game at chapter N with earlier chapters completed. The
Playwright driver used during development plays every scene of every chapter, including
real bus travel, and passes each chapter test. It isn't included in the repo.

## Known gaps

- **Audio clips are not generated yet.** The pipeline is tested with a mock synthesizer,
  but it needs your Google key for the real voices. Until then, audio uses the browser's
  Danish voice.
- **Recycling isn't complete.** Among the ~1,000 most common words, 141 still appear in
  fewer than 5 different sentences. `content/REPORT.md` lists every word below target.
  The fix is more small talk in `content/idle.yaml` using only words already in the lexicon.
- **Generated conversation** has only been built and type-checked. It hasn't been run
  against the live API (no key in the build environment).
- **No native review yet.** Frequency ranks are approximate, and no Danish has been
  reviewed by a native speaker (`reviewed: false` everywhere). The Danish was written
  carefully, but a native pass is the next step.
- **Speech recognition** depends on the browser. Firefox has none, so the speak exercise
  falls back to record, compare and self-rate.
