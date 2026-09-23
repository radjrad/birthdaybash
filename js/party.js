/* ==================================================================
   BIRTHDAY BASH — party.js
   The party file: one JSON object that holds every word, color,
   backdrop and photo of a show. BB.normalize() turns anything vaguely
   party-shaped (from Claude, from a paste, from an old export) into a
   complete, safe party the engine can play without checking anything.

   party = {
     v, id, person:{name, age}, from,
     title:{kicker, title, subtitle, lead, button, photo},
     wrongText,
     chapters:[{ name, badge, glyph, palette, scene:{preset, layers}, emblem,
                 arrival:{text, photo, caption}, choice:{question, options:[{label, reaction}]},
                 trivia:[{question, options[], answer, reaction}], photos:[{id, caption}],
                 mini:{kind, ...skin} }],
     messages:[{who, msg}], finale:{heading, lines[], final, button, toast}, closing:{title, sub, photo},
     photos:{ id: dataURL | relative path }
   }
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};
const C = BB.color;

const str = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
BB.ordinal = ord;

BB.PALETTES = [
  { bg:'#22391a', bg2:'#7fb24a', accent:'#ffcc33', accent2:'#b3382b', btn:'#ffcc33', btnText:'#3a2a05' },
  { bg:'#011f5b', bg2:'#1a3d8f', accent:'#f0c040', accent2:'#990000', btn:'#f0c040', btnText:'#0a1a3a' },
  { bg:'#1c2b4a', bg2:'#5b7fb8', accent:'#ff9f43', accent2:'#e84393', btn:'#ff9f43', btnText:'#2b1508' },
  { bg:'#3b1a2e', bg2:'#8f3d6a', accent:'#ffd98a', accent2:'#5a2a80', btn:'#ffd98a', btnText:'#2b1d0e' },
  { bg:'#0f2f31', bg2:'#2f7f7a', accent:'#f2b134', accent2:'#c62828', btn:'#f2b134', btnText:'#1a1405' },
  { bg:'#2b2b2b', bg2:'#5a5a66', accent:'#ff6b6b', accent2:'#97233f', btn:'#ff6b6b', btnText:'#2b0808' },
];
/* a stand-in face for photo games when a party has no photos (the demo, or a show built without any) */
BB.PLACEHOLDER_FACE = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="#3b4a6b"/><circle cx="300" cy="270" r="150" fill="#f1c27d"/><path d="M150 260 q150 -190 300 0 q-20 -70 -150 -80 q-130 10 -150 80z" fill="#5a3a1e"/><circle cx="250" cy="260" r="16" fill="#222"/><circle cx="350" cy="260" r="16" fill="#222"/><path d="M240 330 q60 50 120 0" stroke="#222" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M120 800 v-200 q0 -120 180 -120 q180 0 180 120 v200z" fill="#c0392b"/><text x="300" y="720" text-anchor="middle" font-size="60" font-weight="900" fill="#fff" font-family="sans-serif">YOU</text></svg>`);
BB.TITLE_PALETTE = { bg:'#0b1626', bg2:'#22304d', accent:'#ffd98a', accent2:'#3b4a6b', btn:'#ffd98a', btnText:'#2b1d0e' };

function palette(raw, fallback) {
  const p = {};
  for (const k of ['bg', 'bg2', 'accent', 'accent2', 'btn', 'btnText']) p[k] = C.hex(raw && raw[k]) || fallback[k];
  if (!C.hex(raw && raw.btn) && C.hex(raw && raw.accent)) p.btn = p.accent;
  let guard = 0;
  while (C.luminance(p.bg) > .1 && guard++ < 10) p.bg = C.dark(p.bg, .25);            /* white text sits on bg */
  if (C.contrast(p.btn, p.btnText) < 4.5) p.btnText = C.luminance(p.btn) > .4 ? C.dark(p.btn, .82) : '#ffffff';
  if (C.contrast(p.accent, p.bg) < 3) p.accent = C.light(p.accent, .45);              /* accent text sits on bg too */
  p.card = (() => { const h = C.dark(p.bg, .35); return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},.86)`; })();
  return p;
}

const MINI_NEEDS = { match:{ items:8, emoji:8 }, echo:{ items:3, emoji:3, lines:3 }, order:{ items:5, lines:5 }, whack:{ items:2, emoji:2, lines:2 }, brawl:{ items:6, emoji:2, lines:2 }, pin:{ emoji:1, lines:4 }, clock:{ items:3, lines:3 }, balance:{ emoji:6, lines:3 }, popcorn:{ emoji:1, lines:2 }, redlight:{ items:1, emoji:3, lines:2 }, slice:{ emoji:1, lines:2 }, balloon:{ emoji:2, lines:2 }, missing:{ items:16, emoji:16, lines:2 }, shell:{ emoji:2, lines:2 }, count:{ emoji:1, lines:2 }, draw:{ items:3, lines:2 }, scramble:{ lines:1 }, flappy:{ emoji:2, items:1, lines:2 } };
const NEEDS_PHOTO = new Set(['pin', 'scramble']);
function mini(raw, ctx, hasPhoto, used) {
  raw = raw && typeof raw === 'object' ? raw : {};
  let kind = BB.MINI_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) kind = BB.MINI_KINDS.find(k => !used.has(k) && !NEEDS_PHOTO.has(k)) || 'match';
  let photo = hasPhoto(raw.photo) ? raw.photo : null;
  if (NEEDS_PHOTO.has(kind) && !photo) photo = ctx.heroPhoto || ctx.anyPhoto || ctx.placeholder();
  used.add(kind);
  const D = BB.miniDefaults(kind, ctx), need = MINI_NEEDS[kind] || {}, T = { kind, photo };
  for (const k of ['title', 'noun', 'intro', 'shout', 'label', 'win']) T[k] = str(raw[k], D[k]);
  for (const k of ['items', 'emoji', 'lines']) {
    const got = arr(raw[k]).map(x => str(String(x == null ? '' : x))), n = Math.max(need[k] || 0, 0);
    T[k] = n ? Array.from({ length: n }, (_, i) => got[i] || D[k][i] || '') : got.filter(Boolean);
    if (!n && !T[k].length) T[k] = D[k].slice();
  }
  if (kind === 'brawl') T.label = ['blob', 'robot', 'box', 'cloud', 'beast'].includes(String(T.label).toLowerCase()) ? String(T.label).toLowerCase() : 'blob';
  if (kind === 'match' && !/\{secs\}/.test(T.win)) T.win = 'All eight pairs in {secs} seconds. ' + T.win;
  T.photoCaption = str(raw.photoCaption);
  const t = raw.target; T.target = t && isFinite(t.x) && isFinite(t.y) ? { x: Math.min(1, Math.max(0, +t.x)), y: Math.min(1, Math.max(0, +t.y)) } : null;
  T._name = ctx.name;
  return T;
}

function trivia(raw) {
  const out = [];
  for (const t of arr(raw)) {
    if (!t || !str(t.question)) continue;
    const options = arr(t.options).map(o => str(String(o == null ? '' : o))).filter(Boolean).slice(0, 5);
    if (options.length < 2) continue;
    let answer = Number.isInteger(t.answer) ? t.answer : options.findIndex(o => o.toLowerCase() === str(String(t.answer || '')).toLowerCase());
    if (answer < 0 || answer >= options.length) answer = 0;
    out.push({ question:str(t.question), options, answer, reaction:str(t.reaction, `Correct. It was always going to be "${options[answer]}".`) });
  }
  return out;
}

BB.normalize = function (raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const photos = {};
  for (const [id, v] of Object.entries(raw.photos && typeof raw.photos === 'object' ? raw.photos : {})) if (typeof v === 'string' && v && !/^\s*javascript:/i.test(v)) photos[id] = v;
  const ids = Object.keys(photos), hasPhoto = (id) => typeof id === 'string' && id in photos;
  const name = str(raw.person && raw.person.name, 'The Birthday Person'), age = parseInt(raw.person && raw.person.age, 10) || null;
  const isms = arr(raw.isms).map(String).filter(Boolean);
  const party = { v:1, id: str(raw.id, name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (age ? '-' + age : ''), person:{ name, age }, from:str(raw.from, 'all of us'), isms, photos };

  const chaptersRaw = arr(raw.chapters).filter(c => c && typeof c === 'object').slice(0, 6);
  if (!chaptersRaw.length) chaptersRaw.push({ name:'The Early Years' }, { name:'The Glory Days' }, { name:'Right Now' });
  const usedPhotos = new Set(), usedKinds = new Set();
  const take = (id) => { if (hasPhoto(id)) { usedPhotos.add(id); return id; } return null; };

  const t = raw.title || {};
  party.title = {
    kicker: str(t.kicker, `The official record · a birthday in ${chaptersRaw.length} chapters`),
    title: str(t.title, age ? `${name} at ${age}` : `${name}'s Birthday`).toUpperCase(),
    subtitle: str(t.subtitle, 'THE BIRTHDAY BASH').toUpperCase(),
    lead: str(t.lead, `One legend. ${age ? age + ' years of material.' : 'Years of material.'}\nToday: the birthday.`),
    button: str(t.button, "Let's go →"),
    photo: take(t.photo),
  };
  party.palette = palette(raw.palette, BB.TITLE_PALETTE);
  party.wrongText = str(raw.wrongText, isms[0] ? `"${isms[0]}" Wrong. The room says try again.` : 'Wrong. The room says try again.');

  const ctx = { name, ism: isms[0] || '', anyPhoto: ids[0] || null, heroPhoto: hasPhoto(raw.heroPhoto) ? raw.heroPhoto : null, placeholder() { photos._face = BB.PLACEHOLDER_FACE; return '_face'; } };
  party.chapters = chaptersRaw.map((c, i) => {
    const p = palette(c.palette, BB.PALETTES[i % BB.PALETTES.length]);
    const a = c.arrival || {}, ch = c.choice || {};
    const options = arr(ch.options).map(o => (o && typeof o === 'object' ? { label:str(o.label), reaction:str(o.reaction, 'Bold choice.') } : null)).filter(o => o && o.label).slice(0, 5);
    const triv = trivia(c.trivia);
    const chapterName = str(c.name, `Chapter ${i + 1}`);
    return {
      name: chapterName, badge: str(c.badge, chapterName), glyph: str(c.glyph, ['🌱', '🎓', '🏙️', '🏆', '🚀', '🎂'][i % 6]),
      palette: p,
      scene: { preset: BB.SCENE_PRESETS.includes(c.scene && c.scene.preset) ? c.scene.preset : ['hills', 'room', 'city', 'mountains', 'beach', 'night'][i % 6], layers: c.scene && Array.isArray(c.scene.layers) && c.scene.layers.length === 3 && c.scene.layers.every(l => typeof l === 'string') ? c.scene.layers : null },
      emblem: typeof c.emblem === 'string' ? c.emblem : null,
      arrival: { text: str(a.text || c.text, `${chapterName}. This is where the ${name} story picks up speed.`), photo: take(a.photo), caption: str(a.caption) },
      choice: str(ch.question) && options.length >= 2 ? { question:str(ch.question), options } : null,
      trivia: triv,
      badgeLine: str(c.badgeLine, triv.length ? '' : `${chapterName}: survived, more or less.`),
      photos: arr(c.photos).map(ph => (typeof ph === 'string' ? { id:ph, caption:'' } : ph)).filter(ph => ph && take(ph.id)).slice(0, 3).map(ph => ({ id:ph.id, caption:str(ph.caption) })),
      mini: c.mini === false ? null : mini(c.mini, Object.assign({ palette:p }, ctx), hasPhoto, usedKinds),
    };
  });
  /* a chapter with no quiz still has to hand out its badge */
  party.chapters.forEach(c => { if (!c.trivia.length && !c.badgeLine) c.badgeLine = `${c.name}: survived, more or less.`; });

  party.messages = arr(raw.messages).map(m => (m && str(m.msg) ? { who:str(m.who, 'A friend'), msg:str(m.msg) } : null)).filter(Boolean).slice(0, 8);
  const f = raw.finale || {}, happy = age ? `Happy ${ord(age)}, ${name}.` : `Happy birthday, ${name}.`;
  party.finale = {
    heading: str(f.heading, 'The last page'),
    lines: arr(f.lines).map(String).filter(Boolean).slice(0, 5),
    final: str(f.final, happy),
    button: str(f.button, 'Raise a glass'),
    toast: str(f.toast, `Cheers, ${name}.`),
  };
  if (!party.finale.lines.length) party.finale.lines = [`${party.chapters.map(c => c.name).join('. ')}.`, `Every chapter built the person in this room today, surrounded by the people who showed up for every one of them.`, 'The story so far is good. The next part is better.'];
  const cl = raw.closing || {};
  party.closing = { title:str(cl.title, happy), sub:str(cl.sub, `Love, ${party.from}.`), photo: take(cl.photo) };

  /* photos nobody placed: closing first, then title, then spread across the chapters */
  const spare = ids.filter(id => !usedPhotos.has(id));
  if (!party.closing.photo && spare.length) party.closing.photo = spare.pop();
  if (!party.title.photo && spare.length) party.title.photo = spare.shift();
  party.chapters.forEach(c => { if (!c.arrival.photo && spare.length) c.arrival.photo = spare.shift(); });
  let k = 0; while (spare.length && party.chapters.some(c => c.photos.length < 3)) { const c = party.chapters[k++ % party.chapters.length]; if (c.photos.length < 3) c.photos.push({ id:spare.shift(), caption:'' }); }
  party.finale.photos = [...new Set(party.chapters.flatMap(c => [c.arrival.photo, ...c.photos.map(p => p.id)]).filter(Boolean))].slice(0, 4);
  party.heroPhoto = hasPhoto(raw.heroPhoto) ? raw.heroPhoto : party.title.photo || party.closing.photo || (party.chapters.some(c => c.mini && c.mini.photo === '_face') ? '_face' : null);
  return party;
};

/* ---------- tiny IndexedDB key-value store: the builder's draft lives here (photos are too big for localStorage) ---------- */
BB.store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const rq = indexedDB.open('birthdaybash', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('kv', mode), rq = fn(t.objectStore('kv')); t.oncomplete = () => res(rq.result); t.onerror = () => rej(t.error); }));
  return { get: (k) => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: (k) => tx('readwrite', s => s.delete(k)) };
})();
})();
