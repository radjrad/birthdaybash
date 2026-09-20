# Birthday Bash

Turn anyone's life into a playable birthday roast for the TV at the party.
The generalized version of [chuck65](https://github.com/radjrad/chuck65) and
[shannon37](https://github.com/radjrad/shannon37): same engine, but the person,
the jokes, the backdrops and the mini-game skins all come from one party file
that Claude writes for you.

No build step. Plain HTML, CSS and JS.

## How it works

1. **`builder.html`**: you fill in the form.
   - their name and age
   - 2 to 4 chapter titles with notes (eras or themes of their life)
   - a few trivia questions with the right answers
   - the -isms they always say (these become running gags)
   - a roast level, anything off-limits, inside jokes that must make it in
   - up to 16 photos, each with a few words of context
   - optionally, which mini-game follows which chapter, and notes from guests
2. **Claude writes the show.** One request writes every word as JSON (and, if
   you allow it, looks at the photos to caption and place them). Then one
   request per chapter, in parallel, paints a three-layer SVG parallax backdrop
   and a badge emblem.
3. **Preview, tweak, export.** The preview runs the real engine. You can repaint
   a backdrop, click where the hat goes for the pin game, or edit any word in
   the JSON. **Export** gives you one self-contained `.html` file with the
   photos inside. It runs offline.

The show: title → for each chapter (arrival card → pick-one → trivia → badge →
**mini-game intermission**) → notes from the room → a sincere finale and toast →
closing photo. Endearing first, roast second; the last two screens never joke.

Keyboard on a TV or laptop: Enter/Space activates, arrows move, 1-9 pick an
answer, F = fullscreen, R = restart, S = sound. On a phone everything is tap.

## Hooking up Claude

In step 9 of the builder, paste an API key from
[console.anthropic.com](https://console.anthropic.com) (Settings → API keys).
The page calls the API directly from your browser with the official
`@anthropic-ai/sdk`; the key is sent only to `api.anthropic.com`, and is stored
(in this browser's localStorage) only if you tick "Remember".

- Default model is Claude Opus 5; Sonnet 5 is cheaper and faster, Fable 5.1 is
  the most capable.
- **No API key?** Open "No API key? Use your Claude app instead": it copies the
  same prompt for you to paste into claude.ai, and you paste the JSON answer
  back. Backdrops fall back to the built-in scenes on that path.
- **No Claude at all?** "Quick draft" builds a playable show from your own words
  with stock jokes. Useful for checking photos and flow.

Everything Claude returns is treated as untrusted: text is escaped, SVG goes
through an allow-list sanitizer (`BB.sanitizeSVG` in `js/scenes.js`), and
anything missing or malformed is repaired by `BB.normalize` in `js/party.js`.

## The ten mini-games

The mechanics never change. A party only supplies a skin with the same fields
for every game: `kind, title, noun, intro, items[], emoji[], lines[], shout, label, win, photo`.
What each field means per game is in `MINI_CATALOG` in `js/minigames.js` (that
same text is what Claude reads). Nobody can lose any of them.

| kind | Game | From | Reskin examples |
|------|------|------|-----------------|
| `match` | Memory Match: 8 pairs against the clock, best time saved | chuck65 beer cans, shannon37 blue ribbons | concert tees, exes' names, lost things |
| `flick` | Flick Shot: drag back, let go; misses twice, scores on the third | paper football, beer pong | free throw, champagne cork, parallel parking |
| `echo` | Repeat After Me: watch three pads, play the pattern back, three rounds | shannon37 drum cadence | dance moves, coffee order, toddler demands |
| `order` | Right Order: five steps, one order, no hints, a wrong press resets | chuck65 reactor startup | how they grill, how they tell That One Story |
| `crowd` | Fill the Room: tap eight sections until the place roars | chuck65 Big House | wedding dance floor, their one-person show |
| `chart` | Org Chart: build the org chart of their life, dotted lines included | chuck65 org chart | any job, any family |
| `pin` | Pin the Thing: blindfolded, on a photo of them | chuck65 pin-the-hat | cowboy hat, crown, toupee |
| `brawl` | Boss Fight: Street Fighter parody vs. their nemesis | chuck65 cactus fight | the inbox, IKEA instructions, the HOA |
| `trek` | The Long Road: press to advance, an -ism interrupts, photo reveal | chuck65 climb + sneeze | marathon, commute, road trip |
| `whack` | Whack-a-Thing: bonk ten of the right thing, leave the decoys | new | emails vs. compliments, weeds vs. tomatoes |

Try any of them with its stock skin: `play.html?party=demo&mini=brawl`.

To add an eleventh: add an entry to `BB.MINI` (with `doText`, `build`, `init`
and `act` or `step`), its defaults in `BB.miniDefaults`, its spec line in
`BB.MINI_CATALOG`, its required array lengths in `MINI_NEEDS` (`js/party.js`),
its `kind` in the schema enum in `js/claude.js`, and its CSS in `css/engine.css`.

## Files

| File | What it is |
|------|------------|
| `index.html` | Landing page |
| `builder.html`, `js/builder.js`, `css/builder.css` | The form, photos, preview and export |
| `js/claude.js` | Prompts, output schema, the two API jobs, the paste fallback |
| `play.html` | The player: `?party=demo`, `?draft` (the builder's draft), `&screen=c2-mini`, `&mini=kind` |
| `js/engine.js`, `css/engine.css` | State machine, screens, HUD, keyboard, sound, confetti |
| `js/minigames.js` | The ten games, their stock skins and their specs |
| `js/scenes.js` | Built-in backdrops (hills, city, mountains, beach, room, night, party), SVG sanitizer, badges |
| `js/party.js` | The party format, `BB.normalize`, draft storage |
| `parties/demo.json` | "Sam at 40", a fictional demo and a hand-editable example of the format |
| `tools/serve.mjs` | Tiny local static server |

An exported show is `play.html` with the five engine files and the party JSON
inlined. The builder and `claude.js` are never part of it.

## Running it locally

The builder fetches the engine files to make an export, so it needs `http://`,
not `file://`:

```bash
node tools/serve.mjs
```

Then open <http://localhost:8766/builder.html>. Exported shows need no server.

## Hosting a finished show

Make a repo for it (like `shannon37`), add the exported file as `index.html`
plus an empty `.nojekyll`, and turn on GitHub Pages for `main`. Remember the file
contains the photos; a public Pages site is public.
