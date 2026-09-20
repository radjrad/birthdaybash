/* ==================================================================
   BIRTHDAY BASH — claude.js  (builder only; never part of an exported show)
   Talks to Claude with the official Anthropic SDK, loaded in the browser
   from a CDN. Your API key stays in this browser (localStorage) and is
   sent only to api.anthropic.com.

   Two kinds of request:
     1. writeParty(brief)   one call  -> every word of the show, as JSON
     2. paintChapter(...)   per chapter, in parallel -> three SVG backdrop
                            layers + a badge emblem
   No key? promptForPaste(brief) gives the same prompt to paste into
   claude.ai, and BB.claude.parseJSON() reads the answer back.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk';
const MODELS = [
  { id:'claude-opus-5', name:'Claude Opus 5 (recommended)' },
  { id:'claude-fable-5-1', name:'Claude Fable 5.1 (most capable, priciest)' },
  { id:'claude-sonnet-5', name:'Claude Sonnet 5 (faster, cheaper)' },
  { id:'claude-haiku-4-5', name:'Claude Haiku 4.5 (fastest, plainest jokes)' },
];

/* ---------- what Claude is asked to return ---------- */
const S = (extra = {}) => Object.assign({ type:'string' }, extra);
const A = (items) => ({ type:'array', items });
const O = (properties) => ({ type:'object', properties, required:Object.keys(properties), additionalProperties:false });
const PARTY_SCHEMA = O({
  title: O({ kicker:S(), title:S(), subtitle:S(), lead:S(), button:S(), photo:S() }),
  wrongText: S(),
  heroPhoto: S(),
  chapters: A(O({
    name:S(), badge:S(), glyph:S(),
    palette: O({ bg:S(), bg2:S(), accent:S(), accent2:S(), btn:S(), btnText:S() }),
    scene: O({ preset:S({ enum:['hills', 'city', 'mountains', 'beach', 'room', 'night', 'party'] }) }),
    arrival: O({ text:S(), photo:S(), caption:S() }),
    choice: O({ question:S(), options:A(O({ label:S(), reaction:S() })) }),
    trivia: A(O({ question:S(), options:A(S()), answer:{ type:'integer' }, reaction:S() })),
    photos: A(O({ id:S(), caption:S() })),
    mini: O({ kind:S({ enum:['match', 'flick', 'echo', 'order', 'crowd', 'chart', 'pin', 'brawl', 'trek', 'whack'] }), title:S(), noun:S(), intro:S(), items:A(S()), emoji:A(S()), lines:A(S()), shout:S(), label:S(), win:S(), photo:S(), photoCaption:S() }),
  })),
  finale: O({ heading:S(), lines:A(S()), final:S(), button:S(), toast:S() }),
  closing: O({ title:S(), sub:S(), photo:S() }),
});

function writerSystem() {
  return `You are the head writer for Birthday Bash: a playable, interactive birthday show that a host runs on a TV (or guests play on their phones) at the party, with the birthday person in the room. The room reads the screens out loud together. You write every word of one show, as JSON.

THE SHOW
Title screen, then 2-4 chapters of the person's life, then a sincere finale. Each chapter runs: an arrival card (a short narrated paragraph plus a photo), a "pick one" question where every option gets its own comeback, one or more trivia questions the room shouts answers to (the last one in a chapter awards that chapter's badge), and then a mini-game as the intermission before the next chapter.

THE VOICE
An endearing roast. Think best-man speech by someone who adores them: specific, affectionate, a little merciless about the quirks they would laugh at themselves, never cruel about anything they cannot change or are tender about. Every joke should be one the birthday person would want to retell. The details the host gives you are the raw material; the specific beats the generic every time, so build jokes from their places, names, habits and sayings rather than from birthday cliches or age jokes. If you invent a detail for a joke, make it obviously absurd so nobody mistakes it for a claim about their real life.
Their sayings ("-isms") are running gags: use them as joke answers, reactions, button labels and mini-game lines. Thread each one through the show a few times, but not on every screen, and quote them exactly.
Warmth rises as the show goes on. Each chapter's arrival card can end on a sincere note. The finale and the closing contain no jokes at all: they say, plainly and specifically, why this person is loved. Off-limits topics are absolute. Obey the roast level.
Lines are read aloud from across a room, so keep them short: arrival text 45-75 words; questions under 20 words; options under 12 words; reactions 1-2 sentences; captions under 8 words. Plain punctuation; write "..." not an ellipsis character; no markdown; no emoji inside sentences (emoji go only in the emoji fields).

FIELDS
title: kicker (one line above the title), title (like "SHANNON AT 37"), subtitle (the show's name, like "THE GRAND TOUR"), lead (two short lines separated by \\n), button (start button, 2-4 words, an -ism works well), photo (id for the full-screen title background, ideally a wide one).
wrongText: what the screen says when the room picks a wrong trivia answer. An -ism is perfect.
heroPhoto: id of the clearest face photo of the birthday person (used as their head in the boss fight).
Each chapter:
- name (the host's chapter title, polished if needed), badge (a 1-3 word title they earn), glyph (one emoji for the badge).
- palette: six hex colors that evoke the chapter (school colors, a city at dusk, a desert). bg = very dark (white text sits on it), bg2 = mid-tone, accent = bright highlight readable on bg, accent2 = a second strong color, btn = button color (usually the accent), btnText = dark text readable on btn. Make neighbouring chapters clearly different.
- scene.preset: fallback backdrop if custom art is unavailable: hills, city, mountains, beach, room (any interior), night, party.
- arrival: text, photo (id), caption.
- choice: a scenario question with 3-4 options; at least one option should be an -ism or an obvious lie about them. Every reaction lands a different joke.
- trivia: use the host's questions, placed in the chapter they belong to, keeping the host's correct answer as written. Supply 4 options (a plausible wrong one, a funny one, often an -ism) and put the right one at a varying index; "answer" is its zero-based index. reaction = the payoff after the right answer. If the host gave fewer questions than chapters, write your own from the host's notes, only about facts the notes state. Every chapter needs at least one.
- photos: up to 3 more {id, caption} shown beside the badge.
- mini: one mini-game skin (see MINI-GAMES). Do not repeat a kind within a show. Match the game to the chapter.
finale: heading, lines (3 short sincere paragraphs naming what is true across all the chapters), final (the one-line wish), button (like "Raise a glass"), toast (the words on the toast screen).
closing: title (like "Happy 37th, Shannon."), sub (one line, signed from the hosts), photo (id, the warmest recent photo).
Photos: only use ids from the host's list, each at most once across title / arrival / chapter photos / closing (a mini-game may reuse one). Use "" where there is no photo. If you can see the photos, write captions about what is actually in them and place them in the chapter they fit; do not name people other than the birthday person unless the host's note names them.

MINI-GAMES
The mechanics are fixed; you only write the skin. Every skin has the same fields: kind, title (the game's name for this party, like "Beer Pong at the DU House"), noun, intro (one line shown before play), items[], emoji[], lines[], shout, label, win, photo, photoCaption. Use "" or [] for fields a game does not use. Nobody can lose any of these games, so lines about failure are about comic failure on the way to winning.
${BB.MINI_CATALOG.map(m => `- ${m.kind} (${m.name}): ${m.blurb} ${m.spec}`).join('\n')}
For flick, echo and trek, photo + photoCaption is an optional snapshot that pops up on the win.

Return only the JSON object.`;
}

function briefText(b) {
  const L = [];
  L.push(`BIRTHDAY PERSON: ${b.name}, turning ${b.age || '(age not given)'}.${b.pronouns ? ` Pronouns: ${b.pronouns}.` : ' Pronouns not given: write around them (use the name, "they", or second person).'}`);
  if (b.relation) L.push(`WHO THEY ARE TO THE HOST: ${b.relation}`);
  L.push(`FROM (signs the closing): ${b.from || 'all of us'}`);
  if (b.partyDate) L.push(`PARTY DATE: ${b.partyDate}`);
  L.push(`ROAST LEVEL: ${{ gentle:'Gentle. Teasing a grandparent in front of the grandkids.', medium:'Medium. A best-man speech.', spicy:'Spicy. A friend group with no filter; still affectionate, still nothing off-limits.' }[b.roast] || 'Medium. A best-man speech.'}`);
  if (b.offLimits) L.push(`OFF-LIMITS (never mention, never allude to): ${b.offLimits}`);
  if (b.mustInclude) L.push(`INSIDE JOKES / MUST INCLUDE: ${b.mustInclude}`);
  L.push('', `CHAPTERS (${b.chapters.length}):`);
  b.chapters.forEach((c, i) => L.push(`${i + 1}. "${c.title}"${c.mini ? ` [mini-game chosen by host: ${c.mini}]` : ''}\n   Notes: ${c.notes || '(none given: keep this chapter light on specifics)'}`));
  L.push('', 'TRIVIA FROM THE HOST:');
  if (b.trivia.length) b.trivia.forEach((t, i) => L.push(`${i + 1}. Q: ${t.q}\n   Correct answer: ${t.a}${t.wrong ? `\n   Wrong answers the host suggests: ${t.wrong}` : ''}`)); else L.push('(none: write them from the chapter notes)');
  L.push('', '-ISMS (things they always say):');
  if (b.isms.length) b.isms.forEach(s => L.push(`- "${s.text}"${s.when ? `  (when: ${s.when})` : ''}`)); else L.push('(none given)');
  L.push('', 'PHOTOS:');
  if (b.photos.length) b.photos.forEach(p => L.push(`- id "${p.id}"${p.where && p.where !== 'auto' ? ` [host wants it: ${p.where}]` : ''}${p.note ? `: ${p.note}` : ''} (${p.w}x${p.h})`)); else L.push('(none: use "" for every photo field and do not pick the pin game)');
  if (b.chapters.every(c => !c.mini)) L.push('', 'MINI-GAMES: you choose, one per chapter, no repeats.');
  return L.join('\n');
}

function painterSystem() {
  return `You illustrate backdrops for Birthday Bash, a birthday roast show that plays on a TV. For one chapter of someone's life you draw a parallax backdrop as three SVG layers, plus a round badge emblem, in a flat, bold, travel-poster vector style: big simple shapes, strong silhouettes, a limited palette, no outlines needed.

BACKDROP: each layer is the inner markup of an <svg viewBox="0 0 1920 1080"> (do not include the <svg> tag itself). The three are stacked and drift at different speeds when the mouse moves.
- far: the full-bleed sky or back wall. Must start with a rect covering 0,0 to 1920,1080 (a gradient is good), then distant things: sun, moon, clouds, skyline, mountains.
- mid: the place itself. The landmark or building or room that makes this chapter recognisable, sitting on the horizon band between y=400 and y=900. Transparent elsewhere.
- near: foreground framing along the bottom and the two sides (y>800, or x<350, or x>1570): plants, fence, signs, props, string lights. Transparent elsewhere. Text cards sit over the middle of the screen, so keep the centre of this layer empty.
Put two or three specific visual in-jokes from the chapter notes into the scene as objects (the contraband hot plate on the dorm windowsill, the beer-can shelf, the too-small bike). Short words on signs are welcome via <text> (font-family="inherit" font-weight="900"); keep them under three words.
Draw within every layer's full width; the image is cropped to fill wide and tall screens alike, so keep important things between x=300 and x=1620.
Allowed elements: g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, linearGradient, radialGradient, stop, clipPath. No images, no scripts, no filters, no <use>, no <style>, no external references. Gradients are referenced with fill="url(#id)"; give ids a short unique prefix.
For gentle ambient motion you may put one of these classes on an element: tw (twinkle), bl (blink), swing (sway from the top), spin (slow rotation), floaty (bob), drift (slide side to side), smoke (rise and fade), leaf (falls from y=0 to the bottom; place it at y=0). Stagger them with style="animation-delay:-1.3s". Use motion sparingly, on small things.
Build colours from the palette you are given so the art matches the interface, adding naturals (sky, skin of buildings, foliage) as needed. Keep each layer under about 5,000 characters; repeat shapes with care rather than by the hundred.

EMBLEM: the inner markup of an <svg viewBox="0 0 200 200">: start with <circle cx="100" cy="100" r="92" fill="(bg)"/> and <circle cx="100" cy="100" r="80" fill="none" stroke="(accent)" stroke-width="8"/>, then one bold, simple icon for the badge inside the ring, readable at 80px. Shapes and at most three letters of text.

Reply with exactly these four blocks and nothing else:
<far>...</far>
<mid>...</mid>
<near>...</near>
<emblem>...</emblem>`;
}

/* ---------- SDK plumbing ---------- */
let Anthropic = null;
async function client(key) {
  if (!Anthropic) Anthropic = (await import(SDK_URL)).default;
  return new Anthropic({ apiKey:key, dangerouslyAllowBrowser:true });   /* a personal tool: the key is the user's own, typed into their own browser */
}

/* One streamed request. Tries the nicest request shape first and steps down if the API rejects a parameter:
   refusal fallbacks (beta) -> plain; structured output -> plain JSON-by-instruction. */
async function ask(key, { model, system, content, schema, maxTokens = 32000, onProgress }) {
  const c = await client(key);
  const base = { model, max_tokens:maxTokens, system, messages:[{ role:'user', content }] };
  const wantsFallback = /^claude-(opus-5|fable)/.test(model);
  const shapes = [];
  if (wantsFallback && schema) shapes.push({ beta:true, schema:true });
  if (wantsFallback) shapes.push({ beta:true, schema:false });
  if (schema) shapes.push({ beta:false, schema:true });
  shapes.push({ beta:false, schema:false });
  let lastErr;
  for (const shape of shapes) {
    const params = Object.assign({}, base);
    if (shape.schema) params.output_config = { format:{ type:'json_schema', schema } };
    let stream;
    try {
      if (shape.beta) stream = c.beta.messages.stream(Object.assign(params, { betas:['server-side-fallback-2026-07-01'], fallbacks:'default' }));
      else stream = c.messages.stream(params);
      let chars = 0;
      stream.on('text', (t) => { chars += t.length; if (onProgress) onProgress(chars); });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new Error('Claude declined to write this one. Try softening the roast level or the inside jokes and generate again.');
      const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
      if (!text.trim()) throw new Error('Claude returned an empty answer. Try again.');
      return { text, truncated: msg.stop_reason === 'max_tokens', usage: msg.usage };
    } catch (e) {
      lastErr = e;
      if (Anthropic && e instanceof Anthropic.BadRequestError && shape !== shapes[shapes.length - 1]) continue;   /* a parameter this model or account does not take: try the simpler shape */
      throw explain(e);
    }
  }
  throw explain(lastErr);
}
function explain(e) {
  if (!Anthropic || !(e instanceof Anthropic.APIError)) return e;
  if (e instanceof Anthropic.AuthenticationError) return new Error('That API key was rejected. Check it at console.anthropic.com (Settings > API keys).');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('This API key is not allowed to use that model. Try another model in the list.');
  if (e instanceof Anthropic.NotFoundError) return new Error('That model was not found for this key. Try another model in the list.');
  if (e instanceof Anthropic.RateLimitError) return new Error('Rate limited. Wait a minute and try again, or turn off "Let Claude see the photos".');
  if (e instanceof Anthropic.APIConnectionError) return new Error('Could not reach api.anthropic.com. Check the connection (and any ad/tracker blocker) and try again.');
  if (e instanceof Anthropic.BadRequestError) return new Error('The API rejected the request: ' + (e.message || '400'));
  if (e.status >= 500) return new Error('Anthropic had a server error (' + e.status + '). Try again in a moment.');
  return e;
}

/* ---------- reading answers ---------- */
function parseJSON(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('No JSON object found in that text.');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (e1) {
    try { return JSON.parse(t.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); } catch (e2) { throw new Error('That JSON did not parse: ' + e1.message); }
  }
}
function parseLayers(text) {
  const grab = (tag) => { const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i').exec(text); return m ? m[1].trim() : ''; };
  const layers = ['far', 'mid', 'near'].map((t, i) => BB.sanitizeSVG(grab(t), 'chk' + i));
  return { ok: layers.every(Boolean), layers: ['far', 'mid', 'near'].map(grab), emblem: BB.sanitizeSVG(grab('emblem'), 'chkb') ? grab('emblem') : null };
}

/* ---------- the two jobs ---------- */
async function writeParty(key, model, brief, images, onProgress) {
  const content = [];
  for (const im of images || []) { content.push({ type:'text', text:`Photo id "${im.id}":` }); content.push({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:im.data } }); }
  content.push({ type:'text', text: briefText(brief) + '\n\nWrite the show.' });
  const r = await ask(key, { model, system:writerSystem(), content, schema:PARTY_SCHEMA, onProgress });
  if (r.truncated) throw new Error('Claude ran out of room mid-show. Try fewer chapters or shorter notes, then generate again.');
  return { party: parseJSON(r.text), usage: r.usage };
}
async function paintChapter(key, model, brief, chapter, index, onProgress) {
  const notes = (brief.chapters[index] && brief.chapters[index].notes) || '';
  const p = chapter.palette;
  const text = `CHAPTER ${index + 1}: "${chapter.name}" in the life of ${brief.name}.\nHost's notes: ${notes || '(none)'}\nHow the show describes it: ${chapter.arrival.text}\nBadge to draw the emblem for: "${chapter.badge}"\nPalette: bg ${p.bg}, bg2 ${p.bg2}, accent ${p.accent}, accent2 ${p.accent2}.\n\nDraw it.`;
  const r = await ask(key, { model, system:painterSystem(), content:[{ type:'text', text }], maxTokens:24000, onProgress });
  const out = parseLayers(r.text);
  if (!out.ok) throw new Error(r.truncated ? 'the drawing was cut off' : 'the drawing did not come back as valid SVG');
  return out;
}
function promptForPaste(brief) {
  return `${writerSystem()}\n\nThe JSON object has exactly this shape (every field present; "" or [] when unused):\n${JSON.stringify(skeleton(PARTY_SCHEMA))}\n\n=====\n\n${briefText(brief)}\n\nWrite the show. Reply with the JSON object only, in one code block.`;
}
function skeleton(s) { if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, skeleton(v)])); if (s.type === 'array') return [skeleton(s.items)]; if (s.type === 'integer') return 0; return s.enum ? s.enum.join('|') : ''; }

BB.claude = { MODELS, writeParty, paintChapter, promptForPaste, parseJSON, parseLayers, briefText };
})();
