/* ==================================================================
   BIRTHDAY BASH — party-mode.js
   Everybody plays along. One device hosts (the laptop on the TV, or the
   birthday person's phone); guests join with a four-letter code. The host
   turns the pages and every phone follows; everyone answers the trivia
   on their own screen and plays each mini-game for a time; the host keeps
   a leaderboard and sends it to all. Guests can skip a game.

   Transport: WebRTC data channels through PeerJS (loaded from a CDN only
   when a room is started or joined; solo play never needs the network).
   Everything a peer sends is data: names are clipped and escaped, numbers
   are checked, and the only thing a guest can make the host do is record
   a score.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};
const esc = BB.esc;
const PEER_SRC = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'bbash-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const state = { role:null, code:'', peer:null, conns:new Map(), host:null, name:'', players:new Map(), quiz:{}, times:{}, i:0, panel:null, status:'' };
BB.mp = { get role() { return state.role; }, get following() { return state.role === 'guest'; } };

/* ---------- helpers ---------- */
const clean = (s, n = 24) => String(s == null ? '' : s).replace(/[\x00-\x1f<>]/g, '').trim().slice(0, n);
const code4 = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const fmt = (ms) => (ms / 1000).toFixed(1) + 's';
const myName = () => { try { return localStorage.getItem('bb-name') || ''; } catch (e) { return ''; } };
const joinURL = (code) => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('join', code); return u.toString(); };
let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLib) return peerLib;
  return (peerLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEER_SRC; s.onload = () => res(window.Peer); s.onerror = () => rej(new Error('Could not load the party-mode library. Is there internet?')); document.head.appendChild(s); }));
}
function makePeer(id) {
  return loadPeer().then(Peer => new Promise((res, rej) => {
    const p = new Peer(id, { debug: 0 });
    p.on('open', () => res(p));
    p.on('error', (e) => { if (e.type === 'unavailable-id') rej(new Error('taken')); else if (e.type === 'peer-unavailable') rej(new Error('No party with that code is open right now.')); else rej(new Error('Party mode could not connect (' + (e.type || e.message) + ').')); });
  }));
}

/* ---------- the panel everyone sees ---------- */
function ensurePanel() {
  if (state.panel) return state.panel;
  const el = document.createElement('div'); el.id = 'mp'; document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-mp]'); if (!a) return;
    if (a.dataset.mp === 'skip') skipGame();
    if (a.dataset.mp === 'leave') location.href = location.pathname;
    if (a.dataset.mp === 'toggle') el.classList.toggle('open');
  });
  return (state.panel = el);
}
function render() {
  if (!state.role) return;
  const el = ensurePanel(), cur = BB.current && BB.current(), screen = cur ? cur.screen : null, sid = screen ? screen.id : '';
  const n = state.players.size + 1;                 /* guests plus the host screen */
  let body = '';
  if (screen && screen.type === 'mini') {
    const rows = Object.entries(state.times[sid] || {}).map(([k, v]) => ({ name: v.name, ms: v.ms })).sort((a, b) => a.ms - b.ms);
    body = `<div class="mp-h">Leaderboard · ${esc(BB.party.chapters[screen.chapter].mini.title)}</div>` +
      (rows.length ? `<ol class="mp-board">${rows.slice(0, 8).map(r => `<li><span>${esc(r.name)}</span><b>${fmt(r.ms)}</b></li>`).join('')}</ol>` : `<div class="mp-dim">No times yet. ${n > 1 ? 'Everyone is playing...' : 'Waiting for players...'}</div>`) +
      `${rows.length < n ? `<div class="mp-dim">${n - rows.length} still playing</div>` : ''}` +
      (state.role === 'guest' && !state.skipped[sid] && !(state.times[sid] || {})[state.selfKey] ? `<button class="mp-btn" data-mp="skip">Skip this game</button>` : '');
  } else if (screen && screen.type === 'trivia') {
    const q = state.quiz[sid] || {}, got = Object.values(q), first = got.slice().sort((a, b) => a.at - b.at)[0];
    body = `<div class="mp-h">The room</div><div>${got.length} of ${n} got it${got.length ? `; first: <b>${esc(first.name)}</b>` : ''}</div>` +
      (got.some(g => g.tries > 1) ? `<div class="mp-dim">${got.filter(g => g.tries > 1).map(g => esc(g.name)).join(', ')} needed a second try</div>` : '');
  } else {
    body = `<div class="mp-h">${state.role === 'host' ? 'Hosting' : 'Following the host'}</div><div>${n} playing${state.role === 'host' && state.players.size ? ': ' + [...state.players.values()].map(esc).join(', ') : ''}</div>`;
  }
  const head = state.role === 'host'
    ? `<div class="mp-code">Join at <b>${esc(joinURL(state.code).replace(/^https?:\/\//, ''))}</b><span class="mp-dim"> · or open the show and enter code </span><b class="mp-big">${state.code}</b></div>`
    : `<div class="mp-code">Room <b>${esc(state.code)}</b> · you are <b>${esc(state.name)}</b> ${state.status ? `<span class="mp-dim">· ${esc(state.status)}</span>` : ''} <a data-mp="leave" class="mp-dim">leave</a></div>`;
  el.innerHTML = `<button class="mp-tab" data-mp="toggle" type="button">👥 ${n}</button><div class="mp-body">${head}${body}</div>`;
}

/* ---------- host ---------- */
function broadcast(msg, except) { const s = JSON.stringify(msg); for (const [id, c] of state.conns) if (id !== except && c.open) { try { c.send(s); } catch (e) {} } }
function hostSnapshot() { return { t:'sync', i: state.i, players: [...state.players.values()], times: state.times, quiz: state.quiz, pid: BB.party.id }; }
async function host() {
  for (let tries = 0; tries < 5; tries++) {
    const code = code4();
    try { state.peer = await makePeer(PREFIX + code); state.code = code; break; } catch (e) { if (e.message !== 'taken') throw e; }
  }
  if (!state.peer) throw new Error('Could not open a room. Try again.');
  state.role = 'host'; state.skipped = {}; state.selfKey = 'host'; state.name = clean(BB.party.person.name) || 'TV';
  document.body.classList.add('mp-host');
  state.peer.on('connection', (c) => {
    c.on('open', () => { state.conns.set(c.peer, c); c.send(JSON.stringify(hostSnapshot())); });
    c.on('data', (raw) => onHostData(c, raw));
    const drop = () => { state.conns.delete(c.peer); state.players.delete(c.peer); broadcast({ t:'players', players:[...state.players.values()] }); render(); };
    c.on('close', drop); c.on('error', drop);
  });
  state.peer.on('disconnected', () => { try { state.peer.reconnect(); } catch (e) {} });
  render();
}
function onHostData(c, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') { state.players.set(c.peer, clean(m.name) || 'Guest'); broadcast({ t:'players', players:[...state.players.values()] }); render(); return; }
  const name = state.players.get(c.peer) || 'Guest', sid = clean(m.screen, 40);
  if (m.t === 'time' && Number.isFinite(m.ms) && m.ms > 0 && m.ms < 36e5) { (state.times[sid] = state.times[sid] || {})[c.peer] = { name, ms: Math.round(m.ms) }; broadcast({ t:'board', screen:sid, rows: state.times[sid] }); render(); }
  if (m.t === 'quiz' && Number.isFinite(m.tries)) { (state.quiz[sid] = state.quiz[sid] || {})[c.peer] = { name, tries: Math.max(1, Math.min(9, Math.round(m.tries))), at: Date.now() }; broadcast({ t:'quiz', screen:sid, rows: state.quiz[sid] }); render(); }
}

/* ---------- guest ---------- */
async function join(code) {
  code = clean(code, 4).toUpperCase();
  if (!/^[A-Z2-9]{4}$/.test(code)) throw new Error('A room code is four letters or numbers.');
  let name = myName();
  if (!name) { name = clean(prompt('Your name, for the leaderboard:') || ''); if (!name) throw new Error('Party mode needs a name.'); try { localStorage.setItem('bb-name', name); } catch (e) {} }
  state.name = name; state.code = code; state.role = 'guest'; state.skipped = {}; state.selfKey = null;
  document.body.classList.add('following');
  state.peer = await makePeer(undefined);
  state.selfKey = state.peer.id;
  connectHost();
  state.peer.on('disconnected', () => { try { state.peer.reconnect(); } catch (e) {} });
  render();
}
function connectHost() {
  const c = state.peer.connect(PREFIX + state.code, { reliable: true });
  state.host = c; state.status = 'connecting...'; render();
  c.on('open', () => { state.status = ''; c.send(JSON.stringify({ t:'hello', name: state.name })); render(); });
  c.on('data', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'sync') { if (m.pid && BB.party.id && m.pid !== BB.party.id) { state.status = 'this room is playing a different show'; render(); return; } state.players = new Map((m.players || []).map((n, i) => ['p' + i, clean(n)])); state.times = sane(m.times); state.quiz = sane(m.quiz); follow(m.i); }
    if (m.t === 'go') follow(m.i);
    if (m.t === 'players') state.players = new Map((m.players || []).map((n, i) => ['p' + i, clean(n)]));
    if (m.t === 'board') state.times[clean(m.screen, 40)] = sane({ x: m.rows }).x || {};
    if (m.t === 'quiz') state.quiz[clean(m.screen, 40)] = sane({ x: m.rows }).x || {};
    render();
  });
  const lost = () => { state.status = 'reconnecting...'; render(); setTimeout(() => { if (state.role === 'guest' && (!state.host || !state.host.open)) connectHost(); }, 3000); };
  c.on('close', lost); c.on('error', lost);
}
function sane(obj) {   /* per-screen tables of { name, ms|tries } from the host, cleaned */
  const out = {};
  for (const [sid, rows] of Object.entries(obj && typeof obj === 'object' ? obj : {})) {
    if (!rows || typeof rows !== 'object') continue;
    out[clean(sid, 40)] = Object.fromEntries(Object.entries(rows).filter(([k, v]) => v && typeof v === 'object').map(([k, v]) => [clean(k, 64), { name: clean(v.name) || 'Guest', ms: Number.isFinite(v.ms) ? v.ms : undefined, tries: Number.isFinite(v.tries) ? v.tries : undefined, at: Number.isFinite(v.at) ? v.at : 0 }]));
  }
  return out;
}
function follow(i) { if (Number.isInteger(i) && i !== state.i && BB.go) { state.i = i; BB.go(i); } else state.i = i; }
function send(msg) { if (state.host && state.host.open) { try { state.host.send(JSON.stringify(msg)); } catch (e) {} } }
function skipGame() {
  const cur = BB.current && BB.current(); if (!cur || cur.screen.type !== 'mini') return;
  state.skipped[cur.screen.id] = true;
  if (cur.local.cleanup) cur.local.cleanup();
  const pf = cur.el.querySelector('.playfield'); if (pf) pf.innerHTML = `<div class="card mp-skipped"><p>Skipped. Watch the leaderboard; the host will move on.</p></div>`;
  cur.el.querySelectorAll('.actions .btn').forEach(b => b.hidden = true);
  render();
}

/* ---------- hooks the engine calls ---------- */
BB.mp.onScreen = (screen, i) => {
  state.i = i;
  if (state.role === 'host') broadcast({ t:'go', i });
  if (state.role === 'host' && screen.type === 'mini') state.miniT0 = performance.now();
  if (state.role === 'guest' && screen.type === 'mini') state.miniT0 = performance.now();
  render();
};
BB.mp.finished = (screen) => {      /* a mini-game was won on this device */
  if (!state.role || !state.miniT0) return;
  const ms = Math.round(performance.now() - state.miniT0); state.miniT0 = 0;
  if (state.role === 'host') { (state.times[screen.id] = state.times[screen.id] || {}).host = { name: state.name, ms }; broadcast({ t:'board', screen: screen.id, rows: state.times[screen.id] }); render(); }
  else send({ t:'time', screen: screen.id, ms });
};
BB.mp.answered = (screen, tries) => {
  if (!state.role) return;
  if (state.role === 'host') { (state.quiz[screen.id] = state.quiz[screen.id] || {}).host = { name: state.name, tries, at: Date.now() }; broadcast({ t:'quiz', screen: screen.id, rows: state.quiz[screen.id] }); render(); }
  else send({ t:'quiz', screen: screen.id, tries });
};

/* ---------- the "play together" panel on the title screen ---------- */
BB.mp.titleHTML = () => `<div class="together">
  <div class="kicker">Play together</div>
  <button class="btn ghostbtn" type="button" data-action="mp-host">Host on this screen</button>
  <form class="joinform" data-action="mp-join"><input name="code" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code"><button class="btn ghostbtn" type="submit">Join</button></form>
  <div class="together-note"></div></div>`;
BB.mp.act = async (action, el) => {
  const note = el.querySelector('.together-note');
  try {
    if (action === 'mp-host') { note.textContent = 'Opening a room...'; await host(); note.textContent = ''; el.querySelector('.together').hidden = true; }
    if (action === 'mp-join') { const code = el.querySelector('.joinform input').value; note.textContent = 'Joining...'; await join(code); note.textContent = ''; el.querySelector('.together').hidden = true; }
  } catch (e) { note.textContent = e.message || String(e); }
};
BB.mp.autostart = () => {
  const q = new URLSearchParams(location.search);
  if (q.has('host')) host().catch(e => alert(e.message));
  else if (q.get('join')) join(q.get('join')).catch(e => alert(e.message));
};
})();
