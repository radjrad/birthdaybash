/* ==================================================================
   BIRTHDAY BASH — engine.js
   The show itself: turns a normalized party into a list of screens and
   runs them. State machine, transitions, keyboard, HUD, sound, confetti.
   Generalized from the chuck65 / shannon37 engine; nothing in here knows
   whose birthday it is.

   Keyboard on a TV or laptop: Enter/Space activates, arrows move, 1-9
   pick an answer, F = fullscreen, R = restart, S = sound. On a phone
   everything is tap.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};
const esc = BB.esc;
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

/* Phones: coarse pointer means wording says "tap" */
const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const phoneLayout = () => window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1024px)').matches;
const PRESS = TOUCH ? 'Tap' : 'Press';

let party, screens, stage, hud, cur = null, lockUntil = 0;
const state = { i:0, hi:0, earned:new Set() };

/* ==================================================================
   1. SCREENS — the running order, built from the party file
   ================================================================== */
function buildScreens(p) {
  const out = [{ id:'title', type:'title' }];
  p.chapters.forEach((c, i) => {
    const n = i + 1;
    out.push({ id:`c${n}-arrival`, type:'arrival', chapter:i });
    if (c.choice) out.push({ id:`c${n}-choice`, type:'choice', chapter:i });
    c.trivia.forEach((t, k) => out.push({ id:`c${n}-trivia${k + 1}`, type:'trivia', chapter:i, trivia:t, award: k === c.trivia.length - 1 }));
    if (!c.trivia.length) out.push({ id:`c${n}-badge`, type:'badge', chapter:i });
    if (c.mini) out.push({ id:`c${n}-mini`, type:'mini', chapter:i, last: i === p.chapters.length - 1 });
  });
  const lastCh = p.chapters.length - 1;
  if (p.messages.length) out.push({ id:'messages', type:'messages', chapter:lastCh, finale:true });
  out.push({ id:'finale', type:'finale', chapter:lastCh, finale:true });
  out.push({ id:'closing', type:'closing', chapter:lastCh });
  return out;
}

/* ==================================================================
   2. SMALL HTML HELPERS
   ================================================================== */
const src = (id) => (id && party.photos[id]) || '';
const chapterOf = (s) => party.chapters[s.chapter];
const sceneFor = (s, mode) => { const c = chapterOf(s); return BB.sceneHTML(c.scene, c.palette, 'c' + s.chapter, mode); };
function polaroid(id, caption, rot, extra = '') {
  if (!src(id)) return '';
  return `<figure class="polaroid ${extra}" style="--rot:${rot}deg"><img src="${esc(src(id))}" alt=""><figcaption>${esc(caption || '')}</figcaption></figure>`;
}
function photosHTML(list) {
  list = list.filter(ph => src(ph.id));
  if (list.length <= 1) return list.length ? polaroid(list[0].id, list[0].caption, -3) : '';
  const rots = [-4, 2, -2];
  return `<div class="photos">${list.map((ph, i) => polaroid(ph.id, ph.caption, rots[i % 3], 'sm')).join('')}</div>`;
}
function badgeHTML(i, cls = '') { const c = party.chapters[i]; return `<div class="badge ${cls}">${BB.badgeSVG(c, 'c' + i)}<div class="bname">${esc(c.badge)}</div></div>`; }
function earnedHTML(s, reaction) {
  const c = chapterOf(s);
  return `<div class="earned ${c.photos.length > 1 ? 'multi' : ''}" hidden>
    <div class="earned-left">${badgeHTML(s.chapter)}<div class="kicker">Badge earned</div><div class="bname">${esc(c.badge)}</div><p class="rtext">${esc(reaction)}</p></div>
    ${photosHTML(c.photos)}
  </div>`;
}
const optsHTML = (labels) => `<div class="opts n${labels.length}">${labels.map((l, i) => `<button class="btn opt" data-action="pick" data-i="${i}"><span class="num">${i + 1}</span><span class="lbl">${esc(l)}</span></button>`).join('')}</div>`;
const NEXT = (label = 'Continue →', hidden = false) => `<button class="btn primary continue" data-action="next"${hidden ? ' hidden' : ''}>${esc(label)}</button>`;

function miniCtx(s) {
  return { src, palette: chapterOf(s).palette, partyId: party.id, touch: TOUCH, heroPhoto: party.heroPhoto, polaroid, mp: BB.mp };
}

/* ==================================================================
   3. SCREEN BUILDERS — one HTML template per screen type
   ================================================================== */
const BUILD = {
  title: () => {
    const t = party.title, photo = src(t.photo);
    return `
    ${photo ? `<div class="scene photo-scene"><img class="kb" src="${esc(photo)}" alt=""><div class="shade"></div></div>` : BB.sceneHTML({ preset:'party' }, party.palette, 'title', 'soft')}
    <div class="content center">
      <div class="do">${PRESS} the big button.</div>
      <div class="kicker">${esc(t.kicker)}</div>
      <h1 class="giant">${esc(t.title)}</h1>
      <div class="sub">${esc(t.subtitle)}</div>
      <p class="lead">${nl2br(t.lead)}</p>
      ${BB.mp ? BB.mp.titleHTML() : ''}
    </div>
    <div class="actions"><button class="btn primary big" data-action="next">${esc(t.button)}</button></div>
    <div class="hints">F = fullscreen · R = restart · ♪ sound toggle is top right</div>`;
  },

  arrival: s => { const c = chapterOf(s); return `
    ${sceneFor(s)}
    <div class="content">
      <div class="do">Read it out loud, then ${PRESS.toLowerCase()} Continue.</div>
      <div class="row">
        <div class="card narration"><div class="kicker">Chapter ${s.chapter + 1} of ${party.chapters.length}</div><h2>${esc(c.name)}</h2><p>${nl2br(c.arrival.text)}</p></div>
        ${polaroid(c.arrival.photo, c.arrival.caption, 3)}
      </div>
    </div>
    <div class="actions">${NEXT()}</div>`; },

  choice: s => { const c = chapterOf(s); return `
    ${sceneFor(s, 'dim')}
    <div class="content">
      <div class="do">Pick one:</div>
      <h2 class="q">${esc(c.choice.question)}</h2>
      ${optsHTML(c.choice.options.map(o => o.label))}
      <div class="reaction card" hidden><div class="kicker">You picked: <span class="picked"></span></div><p class="rtext"></p></div>
    </div>
    <div class="actions"><button class="btn ghostbtn" data-action="again" hidden>Pick another answer</button>${NEXT('Continue →', true)}</div>`; },

  trivia: s => `
    ${sceneFor(s, 'dim')}
    <div class="content">
      <div class="do">Ask the room, then pick the answer:</div>
      <div class="qwrap" style="display:contents">
        <div class="kicker">Party trivia · Chapter ${s.chapter + 1}</div>
        <h2 class="q">${esc(s.trivia.question)}</h2>
        ${optsHTML(s.trivia.options)}
        <div class="reaction card wrongbox" hidden><p class="rtext">${esc(party.wrongText)}</p></div>
      </div>
      ${s.award ? earnedHTML(s, s.trivia.reaction) : `<div class="reaction card right" hidden><div class="kicker">Correct</div><p class="rtext">${esc(s.trivia.reaction)}</p></div>`}
    </div>
    <div class="actions">${NEXT('Continue →', true)}</div>`,

  badge: s => `
    ${sceneFor(s, 'dim')}
    <div class="content">
      <div class="do">Badge earned. ${PRESS} Continue.</div>
      ${earnedHTML(s, chapterOf(s).badgeLine)}
    </div>
    <div class="actions">${NEXT()}</div>`,

  mini: s => {
    const T = chapterOf(s).mini, m = BB.MINI[T.kind], ctx = miniCtx(s);
    const actions = m.actions ? m.actions(T) : `<button class="btn primary big" data-action="step">${esc(m.first ? m.first(T) : 'Go')}</button>`;
    return `
    ${sceneFor(s, m.soft ? 'soft' : 'dim')}
    <div class="content mini">
      <div class="do">${esc(m.doText(T, TOUCH))}</div>
      <div class="kicker">${s.last ? 'Final round' : 'Intermission'} · ${esc(T.title)}</div>
      <div class="note"></div>
      <div class="playfield">${m.build(T, ctx)}</div>
    </div>
    <div class="actions">${actions}<button class="btn ghostbtn skip" data-action="next">Skip game →</button></div>`;
  },

  messages: s => `
    ${sceneFor(s, 'dim')}
    <div class="content">
      <div class="do">${PRESS} the big button to open the next note.</div>
      <h2>Notes from the room</h2>
      <div class="entries">${party.messages.map((m, i) => `<div class="entry" style="--rot:${[-1.5, 1, -1, 1.5][i % 4]}deg"><div class="who">${esc(m.who)}</div><div class="msg">${nl2br(m.msg)}</div></div>`).join('')}</div>
    </div>
    <div class="actions"><button class="btn primary big" data-action="open">Open the first note</button></div>`,

  finale: s => { const f = party.finale; return `
    ${sceneFor(s, 'dim')}
    <div class="content">
      <div class="do">Read the last page, then raise a glass.</div>
      <div class="logwrap">
        <div class="card log"><div class="kicker">${esc(f.heading)}</div>${f.lines.map(l => `<p>${esc(l)}</p>`).join('')}<p class="final">${esc(f.final)}</p>
          <div class="badgerow">${party.chapters.map((c, i) => badgeHTML(i, 'small')).join('')}</div></div>
        ${f.photos.length ? `<div class="filmstrip">${f.photos.map(id => `<img src="${esc(src(id))}" alt="">`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="actions"><button class="btn primary big" data-action="toast">${esc(f.button)}</button></div>
    <div class="toast"><div class="glasses emo"><span class="glass l">🥂</span><span class="glass r">🥂</span></div><div class="spark">✨</div><div class="cheers">${esc(f.toast)}</div></div>`; },

  closing: s => { const c = party.closing; return `
    ${sceneFor(s)}
    <div class="closing">
      <h1>${esc(c.title)}</h1>
      ${src(c.photo) ? `<div class="frame"><img src="${esc(src(c.photo))}" alt=""></div>` : `<div class="cake emo">🎂</div>`}
      <div class="sub2">${esc(c.sub)}</div>
    </div>
    <a class="restart-link" data-action="restart">restart</a>`; },
};

/* Small helper handed to each mini-game */
function miniApi(el) {
  const note = el.querySelector('.note');
  return {
    note(txt, big) { note.textContent = txt || ''; note.classList.toggle('big', !!big); },
    finish(txt, doText, extra) {
      note.textContent = txt || ''; note.classList.remove('big');
      el.querySelector('.do').textContent = doText || `${PRESS} Continue.`;
      const stepBtn = el.querySelector('[data-action="step"]');
      if (stepBtn) { stepBtn.textContent = 'Continue →'; stepBtn.dataset.action = 'next'; stepBtn.classList.add('continue'); }
      el.querySelectorAll('.actions [data-action="next"]').forEach(b => b.hidden = false);
      el.querySelectorAll('.actions .pad, .actions .skip').forEach(p => p.hidden = true);
      setHi(0); showOnPhone(note);
      if (BB.mp && cur) BB.mp.finished(cur.screen, extra);
    },
    reset(txt, doText) { note.textContent = txt || ''; note.classList.remove('big'); el.querySelector('.do').textContent = doText; el.querySelectorAll('.actions [data-action="next"]').forEach(b => b.hidden = true); },
  };
}

/* Per-type setup after the HTML is in the DOM */
const INIT = {
  mini(s, el, local) { const T = chapterOf(s).mini; local.api = miniApi(el); BB.MINI[T.kind].init(el, local, local.api, T, miniCtx(s)); },
  badge(s, el) { const e = el.querySelector('.earned'); e.hidden = false; e.querySelector('.badge').classList.add('stamp'); earn(s.chapter); BB.Sound.fanfare(); BB.Confetti.burst(120); },
  messages(s, el, local) { local.n = 0; },
  closing() { BB.Confetti.burst(260); BB.Confetti.ambient(true); },
};

/* On a phone the screen scrolls, so bring a freshly revealed block into view (a no-op on the TV layout) */
function showOnPhone(node) { if (node && phoneLayout() && node.scrollIntoView) node.scrollIntoView({ behavior:'smooth', block:'nearest' }); }

/* Per-type click actions (data-action values other than next/restart) */
const ACT = {
  choice(action, btn, s, el) {
    const c = chapterOf(s);
    if (action === 'again') {                       /* back to the options, so the room can see the other answers */
      el.querySelector('.reaction').hidden = true; el.querySelector('.opts').hidden = false;
      el.querySelector('.do').textContent = 'Pick one:';
      el.querySelectorAll('.actions .btn').forEach(b => b.hidden = true);
      BB.Sound.blip(); setHi(0); return;
    }
    if (action !== 'pick') return;
    const o = c.choice.options[+btn.dataset.i];
    el.querySelector('.opts').hidden = true;
    el.querySelector('.reaction .picked').textContent = '"' + o.label + '"';
    el.querySelector('.reaction .rtext').textContent = o.reaction;
    el.querySelector('.reaction').hidden = false;
    el.querySelector('.do').textContent = `${PRESS} Continue, or try another answer.`;
    el.querySelectorAll('.actions .btn').forEach(b => b.hidden = false);
    BB.Sound.chime(); setHi(0); showOnPhone(el.querySelector('.reaction'));
  },
  trivia(action, btn, s, el) {
    if (action !== 'pick') return;
    if (+btn.dataset.i === s.trivia.answer) {
      el.querySelector('.primary').hidden = false;
      if (BB.mp) BB.mp.answered(s, el.querySelectorAll('.opt.wrong').length + 1);
      if (s.award) {
        el.querySelector('.qwrap').hidden = true;
        el.querySelector('.do').textContent = `Badge earned. ${PRESS} Continue.`;
        const e = el.querySelector('.earned'); e.hidden = false; e.querySelector('.badge').classList.add('stamp');
        earn(s.chapter); BB.Sound.fanfare(); BB.Confetti.burst(120); setHi(0); showOnPhone(e);
      } else {
        el.querySelector('.opts').hidden = true; el.querySelector('.wrongbox').hidden = true;
        const r = el.querySelector('.reaction.right'); r.hidden = false;
        el.querySelector('.do').textContent = `${PRESS} Continue.`;
        BB.Sound.chime(); BB.Confetti.burst(60); setHi(0); showOnPhone(r);
      }
    } else {
      btn.classList.add('wrong'); btn.disabled = true;
      el.querySelector('.wrongbox').hidden = false;
      BB.Sound.wrong(); setHi(0); showOnPhone(el.querySelector('.wrongbox'));
    }
  },
  mini(action, btn, s, el, local) {
    const T = chapterOf(s).mini, m = BB.MINI[T.kind];
    if (action === 'step' && m.step) {
      const r = m.step(el, local, T);
      const note = el.querySelector('.note');
      if (r.note !== undefined) note.textContent = r.note;
      note.classList.toggle('big', !!r.bigNote);
      if (r.done) { btn.textContent = 'Continue →'; btn.dataset.action = 'next'; btn.classList.add('continue'); el.querySelector('.do').textContent = `${PRESS} Continue.`; el.querySelectorAll('.actions .skip').forEach(b => b.hidden = true); if (BB.mp) BB.mp.finished(s); }
      else if (r.label) btn.textContent = r.label;
      return;
    }
    if (m.act) m.act(action, btn, el, local, local.api, T, miniCtx(s));
  },
  messages(action, btn, s, el, local) {
    if (action !== 'open') return;
    const entries = el.querySelectorAll('.entry');
    entries[local.n].classList.add('show'); BB.Sound.blip(); showOnPhone(entries[local.n]); local.n++;
    if (local.n >= entries.length) { btn.textContent = 'Continue →'; btn.dataset.action = 'next'; btn.classList.add('continue'); el.querySelector('.do').textContent = `${PRESS} Continue.`; }
    else btn.textContent = 'Open the next note';
  },
  finale(action, btn, s, el) {
    if (action !== 'toast') return;
    const t = el.querySelector('.toast');
    t.classList.add('show'); BB.Sound.clink(); BB.Confetti.burst(200);
    party.chapters.forEach((c, i) => earn(i));
    btn.textContent = 'One more thing →'; btn.dataset.action = 'next'; btn.classList.add('continue');
    el.querySelector('.do').textContent = `${PRESS} Continue.`;
  },
};

/* ==================================================================
   4. ENGINE — state machine, transitions, input, HUD
   ================================================================== */
function applyPalette(p) { for (const k of ['bg', 'bg2', 'accent', 'accent2', 'btn', 'btnText', 'card']) document.body.style.setProperty('--' + k, p[k]); }

function go(i) {
  if (i < 0 || i >= screens.length) return;
  if (cur && cur.local.cleanup) cur.local.cleanup();   /* stop timers / game loops of the screen we are leaving */
  const old = cur ? cur.el : null;
  state.i = i;
  const screen = screens[i];
  applyPalette(screen.type === 'title' ? party.palette : chapterOf(screen).palette);
  document.body.classList.toggle('closing', screen.type === 'closing');
  lockUntil = performance.now() + 450;
  const el = document.createElement('section');
  el.className = 'screen' + (screen.type === 'title' && src(party.title.photo) ? ' title-photo' : ''); el.dataset.screen = screen.id;
  el.innerHTML = BUILD[screen.type](screen);
  stage.appendChild(el);
  cur = { screen, el, local:{} };
  el.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { const f = img.closest('figure, .frame'); if (f) f.hidden = true; else img.hidden = true; }));
  if (BB.mp) BB.mp.onGallery = null;            /* a game that wants room drawings re-registers in its init */
  if (INIT[screen.type]) INIT[screen.type](screen, el, cur.local);
  void el.offsetWidth;                            /* force layout so the fade-in transition runs */
  el.classList.add('in');
  if (old) { old.classList.remove('in'); old.classList.add('out'); setTimeout(() => old.remove(), 450); }
  if (screen.type !== 'closing') BB.Confetti.ambient(false);
  updateHUD(screen);
  setHi(0);
  if (BB.mp) BB.mp.onScreen(screen, i);
  try { window.parent !== window && window.parent.postMessage({ bb:'screen', id:screen.id, i, total:screens.length }, '*'); } catch (e) {}
}
function restart() { state.earned.clear(); go(0); }
function earn(ch) { state.earned.add(ch); updateHUD(cur.screen); }

function buildTrail(n) {
  const step = 125, x = (k) => 40 + k * step;
  let h = '';
  for (let k = 0; k < n; k++) h += `<path class="path" id="tp${k}" d="M${x(k)} 40 L${k === n - 1 ? x(k) + 50 : x(k + 1)} 40"/>`;
  for (let k = 0; k < n; k++) h += `<g id="tn${k}"><circle class="node" cx="${x(k)}" cy="40" r="14"/><text class="lbl" x="${x(k)}" y="48">${k + 1}</text></g>`;
  const fx = x(n - 1) + 48;
  h += `<g class="flag"><rect x="${fx}" y="14" width="4" height="52"/><polygon points="${fx + 4},14 ${fx + 44},26 ${fx + 4},38"/></g>`;
  const svg = document.getElementById('trail'); svg.setAttribute('viewBox', `0 0 ${fx + 60} 80`); svg.innerHTML = h;
}
function updateHUD(screen) {
  const hidden = screen.type === 'title' || screen.type === 'closing';
  hud.hidden = hidden;
  if (hidden) return;
  const ch = screen.chapter, n = party.chapters.length;
  document.getElementById('hud-chapter').textContent = screen.finale ? party.finale.heading : screen.type === 'mini' ? `${screen.last ? 'Final round' : 'Intermission'} · ${chapterOf(screen).mini.title}` : `Chapter ${ch + 1} of ${n} · ${party.chapters[ch].name}`;
  for (let k = 0; k < n; k++) {
    const g = document.getElementById('tn' + k), node = g.querySelector('.node'), lbl = g.querySelector('.lbl');
    const done = state.earned.has(k) || k < ch, now = k === ch && !done;
    node.classList.toggle('done', done); node.classList.toggle('now', now);
    lbl.classList.toggle('done', done); lbl.classList.toggle('now', now);
    document.getElementById('tp' + k).classList.toggle('done', k < ch || (k === ch && state.earned.has(k)));
  }
}

function act(action, btn) {
  if (performance.now() < lockUntil) return;
  BB.Sound.unlock();
  if (action === 'next') return go(state.i + 1);
  if (action === 'restart') return restart();
  if (action.startsWith('mp-')) return BB.mp && BB.mp.act(action, cur.el);
  const h = ACT[cur.screen.type];
  if (h) h(action, btn, cur.screen, cur.el, cur.local);
}

/* ---- Keyboard: numbers pick, arrows move, Enter/Space activate; games get first look ---- */
function optButtons() { return [...cur.el.querySelectorAll('.opt')].filter(b => !b.disabled && b.offsetParent !== null); }
function setHi(n) {
  if (!cur) return;
  const opts = optButtons();
  cur.el.querySelectorAll('.opt.hi').forEach(b => b.classList.remove('hi'));
  if (!opts.length) { state.hi = 0; return; }
  state.hi = ((n % opts.length) + opts.length) % opts.length;
  opts[state.hi].classList.add('hi');
}
function activate() {
  const opts = optButtons();
  if (opts.length) { opts[state.hi].click(); return; }
  const p = [...cur.el.querySelectorAll('.primary')].find(b => !b.hidden && !b.disabled && b.offsetParent !== null);
  if (p) p.click();
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
function wire() {
  stage.addEventListener('click', e => {             /* one delegated listener */
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    if (b.blur) b.blur();                           /* keep native focus off buttons so Enter/Space only go through our handler */
    act(b.dataset.action, b);
  });
  stage.addEventListener('submit', e => { const f = e.target.closest('form[data-action]'); if (!f) return; e.preventDefault(); act(f.dataset.action, f); });
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;   /* a held key must not race through screens */
    if (e.target.matches('input, textarea')) return;              /* typing a room code */
    const k = e.key;
    if (k === 'f' || k === 'F') { toggleFullscreen(); return; }
    if (k === 'r' || k === 'R') { if (!(BB.mp && BB.mp.following)) restart(); return; }
    if (k === 's' || k === 'S') { toggleSound(); return; }
    if (performance.now() < lockUntil) { e.preventDefault(); return; }
    if (cur.local.onKey && cur.local.onKey(k)) { e.preventDefault(); BB.Sound.unlock(); return; }
    if (/^[1-9]$/.test(k)) { const b = [...cur.el.querySelectorAll('.opt')][+k - 1]; if (b && !b.disabled && b.offsetParent !== null) b.click(); return; }
    const cols = optButtons().length === 4 ? 2 : 1;                 /* 4 options sit in a 2x2 grid */
    if (k === 'ArrowLeft')  { e.preventDefault(); setHi(state.hi - 1); return; }
    if (k === 'ArrowRight') { e.preventDefault(); setHi(state.hi + 1); return; }
    if (k === 'ArrowUp')    { e.preventDefault(); setHi(state.hi - cols); return; }
    if (k === 'ArrowDown')  { e.preventDefault(); setHi(state.hi + cols); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); activate(); }
  });
  document.addEventListener('keyup', e => { if (cur && cur.local.onKeyUp) cur.local.onKeyUp(e.key); });
  stage.addEventListener('mouseover', e => { const b = e.target.closest('.opt'); if (!b) return; const k = optButtons().indexOf(b); if (k >= 0) setHi(k); });

  /* idle cursor + parallax */
  let idleTimer = null;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000); };
  document.addEventListener('mousemove', e => {
    wake();
    const dx = e.clientX / window.innerWidth - .5, dy = e.clientY / window.innerHeight - .5;
    if (cur) cur.el.querySelectorAll('.layer').forEach(l => { const d = +l.dataset.depth; l.style.transform = `translate(${(-dx * 44 * d).toFixed(1)}px, ${(-dy * 26 * d).toFixed(1)}px)`; });
  });
  wake();
  document.getElementById('sound').addEventListener('click', (e) => { toggleSound(); e.currentTarget.blur(); });
}

/* ==================================================================
   5. SOUND — gentle WebAudio chimes, off by default, no audio files
   ================================================================== */
BB.Sound = {
  on:false, ctx:null,
  unlock() { if (!this.on) return; if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, at, dur, type = 'sine', gain = .09) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
    o.connect(g).connect(c.destination); o.start(at); o.stop(at + dur + .05);
  },
  ready() { if (!this.on) return false; this.unlock(); return !!this.ctx; },
  blip()    { if (!this.ready()) return; const t = this.ctx.currentTime; this.tone(660, t, .14, 'triangle', .07); },
  thud()    { if (!this.ready()) return; const t = this.ctx.currentTime; this.tone(120, t, .18, 'square', .08); this.tone(90, t + .02, .22, 'sine', .1); },
  chime()   { if (!this.ready()) return; const t = this.ctx.currentTime; this.tone(660, t, .35); this.tone(880, t + .12, .5); },
  clink()   { if (!this.ready()) return; const t = this.ctx.currentTime; [2093, 2637, 3136].forEach((f, i) => this.tone(f, t + .7 + i * .09, .9, 'sine', .06)); },
  wrong()   { if (!this.ready()) return; const t = this.ctx.currentTime; this.tone(330, t, .22, 'triangle', .07); this.tone(247, t + .18, .35, 'triangle', .07); },
  buzzer()  { if (!this.ready()) return; const t = this.ctx.currentTime; this.tone(110, t, .5, 'sawtooth', .14); this.tone(93, t, .5, 'square', .09); },
  drum(p)   {                                        /* 0 snare, 1 bass, 2 cymbal */
    if (!this.ready()) return; const t = this.ctx.currentTime;
    if (p === 0)      { this.tone(220, t, .12, 'triangle', .11); this.tone(190, t, .07, 'square', .05); }
    else if (p === 1) { this.tone(82, t, .32, 'sine', .18); this.tone(55, t + .01, .3, 'sine', .1); }
    else              { [3000, 4300, 5200].forEach((f, i) => this.tone(f, t, .55 - i * .1, 'triangle', .03)); }
  },
  fanfare() { if (!this.ready()) return; const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * .11, .5)); },
  cheer()   {
    if (!this.ready()) return;
    const c = this.ctx, n = c.sampleRate * 1.3, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / n), 1.4);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .6;
    const g = c.createGain(); g.gain.value = .12;
    s.connect(f).connect(g).connect(c.destination); s.start();
    this.fanfare();
  },
};
function toggleSound() { const S = BB.Sound; S.on = !S.on; document.getElementById('sound').textContent = S.on ? '♪ Sound: On' : '♪ Sound: Off'; if (S.on) { S.unlock(); S.chime(); } }

/* ==================================================================
   6. CONFETTI — canvas overlay; bursts last 1.5s, ambient drift optional
   ================================================================== */
function makeConfetti() {
  const cv = document.getElementById('confetti'), cx = cv.getContext('2d');
  let parts = [], ambientOn = false, running = false;
  const colors = () => { const p = cur ? (cur.screen.type === 'title' ? party.palette : chapterOf(cur.screen).palette) : party.palette; return [p.accent, p.accent2, p.bg2, '#ffffff', '#ffd98a', '#ff6b6b', '#4caf50']; };
  function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function spawn(n, burst) {
    const cols = colors();
    for (let i = 0; i < n; i++) parts.push({
      x: burst ? cv.width / 2 + (Math.random() - .5) * cv.width * .5 : Math.random() * cv.width,
      y: burst ? cv.height * .45 : -20,
      vx: burst ? (Math.random() - .5) * 14 : (Math.random() - .5) * 1.2,
      vy: burst ? -Math.random() * 14 - 2 : 1 + Math.random() * 1.5,
      w: 8 + Math.random() * 8, h: 5 + Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
      col: cols[Math.floor(Math.random() * cols.length)], born: performance.now(), life: burst ? 1500 : 9000,
    });
  }
  function loop(now) {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => now - p.born < p.life && p.y < cv.height + 30);
    for (const p of parts) {
      p.vy += .25; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.rot += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.col; cx.globalAlpha = Math.max(0, 1 - (now - p.born) / p.life); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    }
    if (ambientOn && Math.random() < .12) spawn(1, false);
    if (parts.length || ambientOn) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
  return { burst(n) { spawn(n, true); start(); }, ambient(on) { ambientOn = on; if (on) start(); } };
}

/* ==================================================================
   7. GO
   ================================================================== */
BB.start = function (rawParty, opts = {}) {
  party = BB.normalize(rawParty);
  if (opts.mini && BB.MINI[opts.mini]) {            /* ?mini=kind: try one game with its stock skin, straight away */
    const c = party.chapters[0], photo = party.heroPhoto;
    c.mini = BB.normalize({ person: party.person, isms: party.isms, photos: party.photos, chapters: [{ mini: { kind: opts.mini, photo } }] }).chapters[0].mini;
    if (!opts.screen) opts.screen = 'c1-mini';
  }
  screens = buildScreens(party);
  document.title = `${party.title.title}: ${party.title.subtitle}`;
  document.body.innerHTML = `
    <div id="app">
      <header id="hud" hidden><div id="hud-chapter"></div><svg id="trail" viewBox="0 0 390 80" aria-hidden="true"></svg></header>
      <button id="sound" class="tiny" type="button">♪ Sound: Off</button>
      <main id="stage"></main>
    </div>
    <canvas id="confetti"></canvas>`;
  stage = document.getElementById('stage'); hud = document.getElementById('hud');
  buildTrail(party.chapters.length);
  BB.Confetti = makeConfetti();
  wire();
  BB.party = party; BB.screens = screens; BB.go = go; BB.current = () => cur;
  const want = opts.screen ? screens.findIndex(s => s.id === opts.screen) : -1;
  go(want >= 0 ? want : 0);
  if (BB.mp) BB.mp.autostart();
};

BB.fatal = function (msg) { document.body.innerHTML = `<div class="fatal"><div><p>${esc(msg)}</p><p><a href="./">Back to Birthday Bash</a></p></div></div>`; };

/* play.html and exported single-file shows both end with BB.boot() */
BB.boot = async function () {
  const q = new URLSearchParams(location.search), opts = { screen: q.get('screen'), mini: q.get('mini') };
  try {
    if (window.BB_PARTY) return BB.start(window.BB_PARTY, opts);
    if (q.has('draft')) { const p = await BB.store.get('party'); if (!p) return BB.fatal('No draft found in this browser yet. Build one first.'); return BB.start(p, opts); }
    const name = (q.get('party') || 'demo').replace(/[^\w-]/g, '');
    const res = await fetch(`parties/${name}.json`); if (!res.ok) throw new Error(`parties/${name}.json: ${res.status}`);
    BB.start(await res.json(), opts);
  } catch (e) { BB.fatal('Could not load that party. ' + (e && e.message || e)); }
};
})();
