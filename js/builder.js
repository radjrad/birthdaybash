/* ==================================================================
   BIRTHDAY BASH — builder.js
   The form, the photos, the calls to Claude, the preview and the export.
   Everything lives in this browser (IndexedDB) until you export.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB;
const $ = (s, r = document) => r.querySelector(s);
const esc = BB.esc;
const MAX_PHOTOS = 16, MAX_CHAPTERS = 4, MIN_CHAPTERS = 2;
const ENGINE_FILES = ['css/engine.css', 'js/scenes.js', 'js/minigames.js', 'js/party.js', 'js/engine.js'];

const blankForm = () => ({
  name:'', age:'', pronouns:'', partyDate:'', relation:'', from:'', roast:'medium', offLimits:'', mustInclude:'',
  chapters:[{ title:'', notes:'', mini:'' }, { title:'', notes:'', mini:'' }, { title:'', notes:'', mini:'' }],
  trivia:[{ q:'', a:'', wrong:'' }, { q:'', a:'', wrong:'' }, { q:'', a:'', wrong:'' }],
  isms:[{ text:'', when:'' }, { text:'', when:'' }],
  messages:[],
  vision:true, art:true,
});
const state = { form: blankForm(), photos: [], raw: null, nextPhoto: 1, busy: false };

/* ---------- persistence ---------- */
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => BB.store.set('builder', { form:state.form, photos:state.photos, raw:state.raw, nextPhoto:state.nextPhoto }).catch(() => {}), 300); }
function photoMap() { return Object.fromEntries(state.photos.map(p => [p.id, p.data])); }
function fullParty() {            /* the raw party + everything that comes straight from the form */
  const f = state.form;
  return Object.assign({}, state.raw, {
    person:{ name:f.name.trim() || 'The Birthday Person', age:f.age }, from:f.from.trim(),
    isms:f.isms.map(s => s.text.trim()).filter(Boolean),
    messages:f.messages.filter(m => m.msg.trim()).map(m => ({ who:m.who.trim(), msg:m.msg.trim() })),
    photos:photoMap(),
  });
}

/* ---------- rows: chapters, trivia, -isms, notes ---------- */
const miniOptions = () => `<option value="">Let Claude pick</option>` + BB.MINI_CATALOG.map(m => `<option value="${m.kind}">${esc(m.name)}</option>`).join('');
const ROWS = {
  chapters: { el:'#chapters', cls:'chapter', blank:() => ({ title:'', notes:'', mini:'' }), min:MIN_CHAPTERS, max:MAX_CHAPTERS, add:'#addChapter',
    html:(c, i) => `<label>Chapter ${i + 1} title<input data-k="title" value="${esc(c.title)}" placeholder="${['The Heartland', 'Penn', 'San Francisco', 'Dad Mode'][i] || 'A chapter'}"></label>
      <label>Mini-game after it<select data-k="mini">${miniOptions()}</select></label>
      <label class="notes">What happened here? <small>places, people, habits, the story everyone tells</small><textarea data-k="notes" rows="3" placeholder="${['Grew up outside Chicago but acts like a farm kid. Won a blue ribbon at the county fair once and never let it go.', 'Wharton. Joined DU. Undefeated at beer pong (his words). Made friends with the entire freshman class in a week.', 'Plays snare in the marching band at Pride. Always has a camera. Married Justin in Portugal.', ''][i] || ''}">${esc(c.notes)}</textarea></label>` },
  trivia: { el:'#trivia', cls:'trivia', blank:() => ({ q:'', a:'', wrong:'' }), min:0, max:10, add:'#addTrivia',
    html:(t) => `<label>Question<input data-k="q" value="${esc(t.q)}" placeholder="Where did Shannon and Justin get married?"></label>
      <label>Right answer<input data-k="a" value="${esc(t.a)}" placeholder="Portugal"></label>
      <label>Wrong answers <small>optional</small><input data-k="wrong" value="${esc(t.wrong)}" placeholder="City Hall, a barn"></label>` },
  isms: { el:'#isms', cls:'ism', blank:() => ({ text:'', when:'' }), min:0, max:10, add:'#addIsm',
    html:(s) => `<label>They always say...<input data-k="text" value="${esc(s.text)}" placeholder="Fricken fantastic"></label>
      <label>When? <small>optional</small><input data-k="when" value="${esc(s.when)}" placeholder="about everything, especially tacos"></label>` },
  messages: { el:'#messages', cls:'message', blank:() => ({ who:'', msg:'' }), min:0, max:8, add:'#addMessage',
    html:(m) => `<label>From<input data-k="who" value="${esc(m.who)}" placeholder="Dennis & Jill"></label>
      <label>Note<textarea data-k="msg" rows="2" placeholder="Sixty-five and you're not slowing down. We are not keeping up.">${esc(m.msg)}</textarea></label>` },
};
function renderRows(list) {
  const R = ROWS[list], arr = state.form[list], box = $(R.el);
  box.innerHTML = arr.map((item, i) => `<div class="rowitem ${R.cls}" data-list="${list}" data-i="${i}">${R.html(item, i)}${arr.length > R.min ? `<button class="x" type="button" data-remove title="Remove">×</button>` : ''}</div>`).join('');
  box.querySelectorAll('select[data-k]').forEach(sel => { const it = arr[+sel.closest('.rowitem').dataset.i]; sel.value = it[sel.dataset.k] || ''; });
  $(R.add).disabled = arr.length >= R.max;
  if (list === 'chapters') renderPhotos();
}
function wireRows() {
  for (const [list, R] of Object.entries(ROWS)) $(R.add).addEventListener('click', () => { if (state.form[list].length < R.max) { state.form[list].push(R.blank()); renderRows(list); save(); } });
  document.addEventListener('input', (e) => {
    const row = e.target.closest('.rowitem'), k = e.target.dataset.k;
    if (row && k) { state.form[row.dataset.list][+row.dataset.i][k] = e.target.value; save(); return; }
    const ph = e.target.closest('.ph');
    if (ph && k) { const p = state.photos.find(x => x.id === ph.dataset.id); if (p) { p[k] = e.target.value; save(); } }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove]')) return;
    const row = e.target.closest('.rowitem');
    if (row) { state.form[row.dataset.list].splice(+row.dataset.i, 1); renderRows(row.dataset.list); save(); return; }
    const ph = e.target.closest('.ph');
    if (ph) { state.photos = state.photos.filter(p => p.id !== ph.dataset.id); renderPhotos(); save(); }
  });
}

/* ---------- simple fields ---------- */
const FIELDS = ['name', 'age', 'pronouns', 'partyDate', 'relation', 'from', 'offLimits', 'mustInclude'];
function fillFields() {
  FIELDS.forEach(k => { $('#f-' + k).value = state.form[k] || ''; });
  document.querySelectorAll('input[name=roast]').forEach(r => { r.checked = r.value === state.form.roast; });
  $('#f-vision').checked = state.form.vision !== false; $('#f-art').checked = state.form.art !== false;
}
function wireFields() {
  FIELDS.forEach(k => $('#f-' + k).addEventListener('input', (e) => { state.form[k] = e.target.value; save(); }));
  document.querySelectorAll('input[name=roast]').forEach(r => r.addEventListener('change', () => { state.form.roast = r.value; save(); }));
  $('#f-vision').addEventListener('change', (e) => { state.form.vision = e.target.checked; save(); });
  $('#f-art').addEventListener('change', (e) => { state.form.art = e.target.checked; save(); });
  const key = $('#f-key'), remember = $('#f-remember'), model = $('#f-model');
  model.innerHTML = BB.claude.MODELS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  try { const k = localStorage.getItem('bb-key'); if (k) { key.value = k; remember.checked = true; } model.value = localStorage.getItem('bb-model') || BB.claude.MODELS[0].id; } catch (e) {}
  const persistKey = () => { try { if (remember.checked && key.value.trim()) localStorage.setItem('bb-key', key.value.trim()); else localStorage.removeItem('bb-key'); } catch (e) {} };
  key.addEventListener('change', persistKey); remember.addEventListener('change', persistKey);
  model.addEventListener('change', () => { try { localStorage.setItem('bb-model', model.value); } catch (e) {} });
  document.querySelectorAll('input[name=pay]').forEach(r => r.addEventListener('change', () => { try { localStorage.setItem('bb-pay', r.value); } catch (e) {} showPay(); }));
}

/* ---------- who pays: the local Claude Code bridge (subscription) or an API key ---------- */
let bridge = null;
const payMode = () => (bridge && ($('input[name=pay]:checked') || {}).value === 'bridge' ? 'bridge' : 'key');
const authToken = () => (payMode() === 'bridge' ? BB.claude.BRIDGE : $('#f-key').value.trim());
function showPay() {
  const viaBridge = payMode() === 'bridge';
  $('#payWith').hidden = !bridge;
  $('#keyField').hidden = viaBridge; $('#rememberField').hidden = viaBridge; $('#keyNote').hidden = viaBridge;
  const note = $('#bridgeNote'); note.hidden = !viaBridge;
  if (viaBridge) note.textContent = bridge.cli ? `Found ${bridge.version || 'Claude Code'} on this Mac. It must be logged in with your Claude plan (run "claude" in Terminal and type /login if it is not). Generation counts against your plan's usage limits; a full show with backdrops is a handful of long messages.` : 'The local server is running but could not find the claude command. Install Claude Code, then restart the server.';
}
async function detectBridge() {
  bridge = await BB.claude.bridgeStatus();
  if (bridge) { let want = 'bridge'; try { want = localStorage.getItem('bb-pay') || 'bridge'; } catch (e) {} const r = $(`input[name=pay][value=${want}]`) || $('input[name=pay][value=bridge]'); r.checked = true; }
  showPay();
}

/* ---------- photos ---------- */
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('unreadable image')); im.src = src; }); }
function shrink(img, max, quality) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
  return { data: cv.toDataURL('image/jpeg', quality), w, h };
}
async function addFiles(files) {
  const bad = [];
  for (const file of files) {
    if (state.photos.length >= MAX_PHOTOS) { bad.push(`${file.name} (limit is ${MAX_PHOTOS})`); continue; }
    const url = URL.createObjectURL(file);
    try { const img = await loadImg(url), s = shrink(img, 1400, .82); state.photos.push({ id:'p' + state.nextPhoto++, name:file.name, data:s.data, w:s.w, h:s.h, note:'', where:'auto' }); }
    catch (e) { bad.push(`${file.name} (this browser cannot read it; HEIC? export it as a JPEG first)`); }
    finally { URL.revokeObjectURL(url); }
  }
  renderPhotos(); save();
  if (bad.length) alert('Skipped:\n' + bad.join('\n'));
}
function renderPhotos() {
  const chapters = state.form.chapters.map((c, i) => `<option value="chapter ${i + 1}">Chapter ${i + 1}${c.title ? ': ' + esc(c.title) : ''}</option>`).join('');
  $('#photos').innerHTML = state.photos.map(p => `<div class="ph" data-id="${p.id}"><span class="id">${p.id}</span><img src="${p.data}" alt=""><button class="x" type="button" data-remove title="Remove">×</button>
    <div class="meta"><input data-k="note" value="${esc(p.note)}" placeholder="Who / when / what's funny about it">
    <select data-k="where"><option value="auto">Claude decides where it goes</option><option value="title">Title screen (wide shots work best)</option><option value="face">Their face (boss fight + pin game)</option>${chapters}<option value="closing">Last screen</option></select></div></div>`).join('');
  $('#photos').querySelectorAll('.ph').forEach(el => { const p = state.photos.find(x => x.id === el.dataset.id); el.querySelector('select').value = p.where || 'auto'; });
}
function wirePhotos() {
  const drop = $('#drop');
  $('#photoInput').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))));
}
async function visionImages() {
  const out = [];
  for (const p of state.photos) { const s = shrink(await loadImg(p.data), 768, .7); out.push({ id:p.id, data:s.data.split(',')[1] }); }
  return out;
}

/* ---------- the brief ---------- */
function brief() {
  const f = state.form;
  return {
    name:f.name.trim() || 'The Birthday Person', age:f.age, pronouns:f.pronouns, relation:f.relation.trim(), from:f.from.trim(), partyDate:f.partyDate, roast:f.roast, offLimits:f.offLimits.trim(), mustInclude:f.mustInclude.trim(),
    chapters:f.chapters.filter(c => c.title.trim() || c.notes.trim()).map((c, i) => ({ title:c.title.trim() || `Chapter ${i + 1}`, notes:c.notes.trim(), mini:c.mini })),
    trivia:f.trivia.filter(t => t.q.trim() && t.a.trim()).map(t => ({ q:t.q.trim(), a:t.a.trim(), wrong:t.wrong.trim() })),
    isms:f.isms.filter(s => s.text.trim()).map(s => ({ text:s.text.trim(), when:s.when.trim() })),
    photos:state.photos.map(p => ({ id:p.id, note:p.note.trim(), where:p.where, w:p.w, h:p.h })),
  };
}
function checkBrief(b) {
  if (!state.form.name.trim()) return 'Add their name first (step 1).';
  if (b.chapters.length < MIN_CHAPTERS) return `Give at least ${MIN_CHAPTERS} chapters a title (step 2).`;
  return '';
}

/* The host's explicit photo placements and mini-game picks win over whatever came back. */
function enforceHostChoices(raw, b) {
  raw.chapters = (raw.chapters || []).slice(0, b.chapters.length);
  b.chapters.forEach((c, i) => { if (c.mini && raw.chapters[i] && (!raw.chapters[i].mini || raw.chapters[i].mini.kind !== c.mini)) raw.chapters[i].mini = { kind:c.mini }; });
  for (const p of b.photos) {
    if (!p.where || p.where === 'auto') continue;
    if (p.where === 'face') { raw.heroPhoto = p.id; (raw.chapters || []).forEach(c => { if (c.mini && c.mini.kind === 'pin') c.mini.photo = p.id; }); continue; }
    const strip = (o, k) => { if (o && o[k] === p.id) o[k] = ''; };
    strip(raw.title, 'photo'); strip(raw.closing, 'photo');
    (raw.chapters || []).forEach(c => { strip(c.arrival, 'photo'); if (Array.isArray(c.photos)) c.photos = c.photos.filter(x => (x && x.id) !== p.id); });
    if (p.where === 'title') (raw.title = raw.title || {}).photo = p.id;
    else if (p.where === 'closing') (raw.closing = raw.closing || {}).photo = p.id;
    else { const c = raw.chapters[+p.where.replace(/\D/g, '') - 1]; if (c) { c.arrival = c.arrival || {}; if (!c.arrival.photo) c.arrival.photo = p.id; else { c.photos = (c.photos || []).slice(0, 2); c.photos.push({ id:p.id, caption:'' }); } } }
  }
  return raw;
}

/* A playable show with no AI at all: the host's own words in the stock frame. */
function localDraft(b) {
  const isms = b.isms.map(s => s.text), ism = (i) => isms.length ? isms[i % isms.length] : '';
  const chapters = b.chapters.map((c, i) => ({ name:c.title, arrival:{ text:c.notes || `${c.title}. Ask ${b.name} about it; there is a story.` }, trivia:[], mini: c.mini ? { kind:c.mini } : undefined,
    choice:{ question:`${c.title}. What is ${b.name} most likely doing?`, options:[{ label:'Exactly what they were told', reaction:'Nobody in this room believes that.' }, { label:'The opposite, with confidence', reaction:'Correct. Loudly, and with a plan.' }].concat(ism(i) ? [{ label:`Saying "${ism(i)}"`, reaction:'Every time. Without fail.' }] : []) } }));
  b.trivia.forEach((t, i) => {
    const wrong = t.wrong ? t.wrong.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [];
    const options = [t.a, ...wrong, 'Nobody knows', ism(i) && `"${ism(i)}"`, 'It is classified'].filter(Boolean).slice(0, 4);
    const at = i % options.length; [options[0], options[at]] = [options[at], options[0]];
    chapters[i % chapters.length].trivia.push({ question:t.q, options, answer:at, reaction:`${t.a}. The room knew it.` });
  });
  return { chapters };
}

/* ---------- generate ---------- */
const logEl = () => $('#log');
function log(msg, replaceLast) { const el = logEl(); el.hidden = false; const lines = el.textContent ? el.textContent.split('\n') : []; if (replaceLast && lines.length) lines.pop(); lines.push(msg); el.textContent = lines.join('\n'); el.scrollTop = el.scrollHeight; }
function setBusy(b) { state.busy = b; ['#generate', '#quick', '#usePaste', '#export', '#applyJson'].forEach(s => { $(s).disabled = b; }); document.querySelectorAll('#artbar button').forEach(x => { x.disabled = b; }); }

function adopt(raw, b) {
  state.raw = enforceHostChoices(raw, b);
  save(); return showReview();
}
async function generate() {
  const b = brief(), problem = checkBrief(b), key = authToken(), model = $('#f-model').value;
  if (problem) return alert(problem);
  if (!key) return alert('Paste your Anthropic API key in step 9 (or use "No API key?" below it).');
  logEl().textContent = ''; setBusy(true);
  try {
    let images = [];
    if (state.form.vision && state.photos.length) { log(`Preparing ${state.photos.length} photos for Claude to look at...`); images = await visionImages(); }
    log('Claude is writing the show... (usually under two minutes)');
    const t0 = Date.now();
    const { party, usage } = await BB.claude.writeParty(key, model, b, images, (n, unit) => log(`Claude is writing the show... ${n.toLocaleString()} ${unit || 'characters'}`, true));
    log(`Show written in ${Math.round((Date.now() - t0) / 1000)}s${usage ? ` (${usage.input_tokens.toLocaleString()} tokens in, ${usage.output_tokens.toLocaleString()} out)` : ''}.`);
    await adopt(party, b);
    if (state.form.art) await paintAll(key, model, b);
    log('Done. Preview it below, then export.');
    $('#s-review').scrollIntoView({ behavior:'smooth' });
  } catch (e) { log('✖ ' + (e && e.message || e)); }
  finally { setBusy(false); }
}
async function paintAll(key, model, b, only) {
  const norm = BB.normalize(fullParty());
  const idx = norm.chapters.map((c, i) => i).filter(i => only === undefined || i === only);
  log(`Painting ${idx.length} backdrop${idx.length > 1 ? 's' : ''}... (these run side by side)`);
  const results = await Promise.allSettled(idx.map(i => BB.claude.paintChapter(key, model, b, norm.chapters[i], i).then(art => {
    const c = state.raw.chapters[i]; c.scene = Object.assign({}, c.scene, { layers:art.layers }); if (art.emblem) c.emblem = art.emblem;
    log(`  ✓ Chapter ${i + 1} backdrop painted.`); save();
  })));
  results.forEach((r, k) => { if (r.status === 'rejected') log(`  ✖ Chapter ${idx[k] + 1}: ${r.reason && r.reason.message || r.reason}. Using the built-in scene; you can repaint it below.`); });
  await showReview();
}

/* ---------- review: preview, art, pin, JSON, export ---------- */
function screenList(p) {
  const out = [['title', 'Title screen']];
  p.chapters.forEach((c, i) => {
    const n = i + 1; out.push([`c${n}-arrival`, `Ch ${n} · ${c.name}`]);
    if (c.choice) out.push([`c${n}-choice`, `Ch ${n} · pick one`]);
    c.trivia.forEach((t, k) => out.push([`c${n}-trivia${k + 1}`, `Ch ${n} · trivia ${k + 1}`]));
    if (!c.trivia.length) out.push([`c${n}-badge`, `Ch ${n} · badge`]);
    if (c.mini) out.push([`c${n}-mini`, `Ch ${n} · game: ${c.mini.title}`]);
  });
  if (p.messages.length) out.push(['messages', 'Notes from the room']);
  out.push(['finale', 'Finale'], ['closing', 'Last screen']);
  return out;
}
async function showReview(screen) {
  if (!state.raw) return;
  const full = fullParty(), norm = BB.normalize(full);
  await BB.store.set('party', full);
  $('#s-review').hidden = false;
  const jump = $('#jump'), keep = screen || jump.value;
  jump.innerHTML = screenList(norm).map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('');
  if ([...jump.options].some(o => o.value === keep)) jump.value = keep;
  $('#preview').src = `play.html?draft&screen=${encodeURIComponent(jump.value)}&t=${Date.now()}`;
  $('#artbar').innerHTML = norm.chapters.map((c, i) => `<button type="button" data-paint="${i}">🎨 Repaint chapter ${i + 1}</button>${c.scene.layers ? `<button type="button" data-unpaint="${i}">Use built-in scene for ${i + 1}</button>` : ''}`).join('');
  $('#json').value = JSON.stringify(state.raw, null, 2);
  const pi = norm.chapters.findIndex(c => c.mini && c.mini.kind === 'pin');
  $('#pinpick').hidden = pi < 0;
  if (pi >= 0) {
    const m = norm.chapters[pi].mini, t = m.target || { x:.5, y:.2 };
    $('#pinImg').src = norm.photos[m.photo] || ''; $('#pinImg').dataset.ch = pi; $('#pinImg').dataset.photo = m.photo;
    $('#pinDot').style.left = (t.x * 100) + '%'; $('#pinDot').style.top = (t.y * 100) + '%';
  }
}
function wireReview() {
  $('#jump').addEventListener('change', () => showReview());
  $('#reload').addEventListener('click', () => { $('#jump').value = 'title'; showReview('title'); });
  $('#artbar').addEventListener('click', async (e) => {
    const p = e.target.dataset.paint, u = e.target.dataset.unpaint;
    if (u !== undefined) { const c = state.raw.chapters[+u]; if (c && c.scene) delete c.scene.layers; if (c) delete c.emblem; save(); return showReview(`c${+u + 1}-arrival`); }
    if (p === undefined) return;
    const key = authToken(); if (!key) return alert('Repainting needs your API key (step 9).');
    setBusy(true); try { await paintAll(key, $('#f-model').value, brief(), +p); $('#jump').value = `c${+p + 1}-arrival`; await showReview(`c${+p + 1}-arrival`); } catch (err) { log('✖ ' + err.message); } finally { setBusy(false); }
  });
  $('.pinframe').addEventListener('click', (e) => {
    const img = $('#pinImg'), r = img.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, c = state.raw.chapters[+img.dataset.ch];
    if (!c) return;
    c.mini = Object.assign({}, c.mini, { kind:'pin', photo:img.dataset.photo, target:{ x:+x.toFixed(3), y:+y.toFixed(3) } });
    save(); showReview(`c${+img.dataset.ch + 1}-mini`);
  });
  $('#applyJson').addEventListener('click', () => {
    try { const parsed = JSON.parse($('#json').value); delete parsed.photos; state.raw = parsed; save(); showReview(); $('#jsonMsg').textContent = 'Applied.'; }
    catch (e) { $('#jsonMsg').textContent = 'That is not valid JSON: ' + e.message; }
  });
  $('#export').addEventListener('click', exportShow);
}

async function exportShow() {
  if (!state.raw) return;
  setBusy(true);
  try {
    const [css, ...js] = await Promise.all(ENGINE_FILES.map(f => fetch(f, { cache:'no-store' }).then(r => { if (!r.ok) throw new Error(`could not load ${f}`); return r.text(); })));
    const full = fullParty(), norm = BB.normalize(full);
    const used = new Set(JSON.stringify(Object.assign({}, norm, { photos:null })).match(/"p\d+"/g) || []);
    full.photos = Object.fromEntries(Object.entries(full.photos).filter(([id]) => used.has(`"${id}"`)));   /* leave unused photos out of the file */
    const json = JSON.stringify(full).replace(/</g, '\\u003c').replace(new RegExp('[\\u2028\\u2029]', 'g'), '');
    const close = '</' + 'script>';
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${esc(norm.title.title)}: ${esc(norm.title.subtitle)}</title>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="${norm.palette.bg}">\n<meta name="robots" content="noindex">\n<!-- Made with Birthday Bash. One file, runs offline. Keyboard: Enter/Space, arrows, 1-9, F fullscreen, R restart, S sound. -->\n<style>\n${css}\n</style>\n</head>\n<body>\n${js.map(s => `<script>\n${s.replace(/<\/script/gi, '<\\/script')}\n${close}`).join('\n')}\n<script>window.BB_PARTY = ${json};\nBB.boot();${close}\n</body>\n</html>\n`;
    download(`${norm.id || 'birthday-bash'}.html`, html, 'text/html');
    log(`Exported ${norm.id}.html (${(html.length / 1048576).toFixed(1)} MB). It runs offline; open it in any browser.`);
  } catch (e) { alert('Export needs this page to be served over http(s) (GitHub Pages, or "node tools/serve.mjs"). ' + e.message); }
  finally { setBusy(false); }
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

/* ---------- top bar: project save / load / reset ---------- */
function wireProject() {
  $('#saveProject').addEventListener('click', () => download(`${(state.form.name || 'birthday-bash').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-project.json`, JSON.stringify({ bb:'project', v:1, form:state.form, photos:state.photos, raw:state.raw, nextPhoto:state.nextPhoto }), 'application/json'));
  $('#loadProject').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try { const d = JSON.parse(await file.text()); if (d.bb !== 'project') throw new Error('not a Birthday Bash project file'); load(d); save(); }
    catch (err) { alert('Could not load that file: ' + err.message); }
  });
  $('#resetAll').addEventListener('click', async () => { if (!confirm('Clear this party from this browser and start over? (Save the project first if you want to keep it.)')) return; await BB.store.del('builder'); await BB.store.del('party'); load({}); });
}
function load(d) {
  state.form = Object.assign(blankForm(), d.form || {});
  state.photos = Array.isArray(d.photos) ? d.photos : []; state.raw = d.raw || null;
  state.nextPhoto = d.nextPhoto || state.photos.reduce((m, p) => Math.max(m, +String(p.id).replace(/\D/g, '') + 1), 1);
  fillFields(); Object.keys(ROWS).forEach(renderRows); renderPhotos();
  $('#s-review').hidden = true; logEl().hidden = true; logEl().textContent = '';
  if (state.raw) showReview('title');
}

/* ---------- go ---------- */
async function init() {
  $('#catalog').innerHTML = BB.MINI_CATALOG.map(m => `<div class="game"><b>${esc(m.name)}</b><p>${esc(m.blurb)}</p><a href="play.html?party=demo&mini=${m.kind}" target="_blank" rel="noopener">Try it ↗</a></div>`).join('');
  wireRows(); wireFields(); wirePhotos(); wireReview(); wireProject();
  $('#generate').addEventListener('click', generate);
  $('#quick').addEventListener('click', async () => { const b = brief(), problem = checkBrief(b); if (problem) return alert(problem); logEl().textContent = ''; await adopt(localDraft(b), b); log('Quick draft built from your own words, with stock jokes and built-in scenes. Claude makes it much funnier.'); $('#s-review').scrollIntoView({ behavior:'smooth' }); });
  $('#copyPrompt').addEventListener('click', async () => { const b = brief(), problem = checkBrief(b); if (problem) return alert(problem); const text = BB.claude.promptForPaste(b); try { await navigator.clipboard.writeText(text); $('#copyPrompt').textContent = 'Copied ✓'; } catch (e) { $('#pasteBox').value = text; alert('Could not reach the clipboard, so the prompt is in the box below: copy it from there, then replace it with the answer.'); } });
  $('#usePaste').addEventListener('click', async () => { try { const party = BB.claude.parseJSON($('#pasteBox').value); logEl().textContent = ''; await adopt(party, brief()); log('Show loaded from your pasted JSON.'); $('#s-review').scrollIntoView({ behavior:'smooth' }); } catch (e) { alert(e.message); } });
  detectBridge();
  let saved = null; try { saved = await BB.store.get('builder'); } catch (e) {}
  load(saved || {});
}
init();
})();
