/* ==================================================================
   BIRTHDAY BASH — minigames.js
   Ten mini-games. The mechanics never change; a party only supplies a
   "skin" — words and emoji — so a new birthday never needs new code.

   Every skin has the same shape:
     { kind, title, noun, intro, items[], emoji[], lines[], shout, label, win, photo }
   What each field means for each game is written in MINI_CATALOG[].spec
   (that text is also what Claude is given when it writes a skin).

   Every mini has build(T, ctx), init(el, local, api, T, ctx) and either
   step(el, local, T) (one big button) or act(action, btn, el, local, api, T)
   for custom clicks. The api object updates the note / button and
   finishes the screen. Nobody can lose any of these.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
BB.esc = esc;
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const Sound = () => BB.Sound, Confetti = () => BB.Confetti;
const CONTINUE = `<button class="btn primary big continue" data-action="next" hidden>Continue →</button>`;
const CARD_COLORS = ['#c0392b', '#2e7d32', '#1e6fb0', '#e67e22', '#8e44ad', '#00897b', '#d9a400', '#5b3a1e'];

BB.MINI_CATALOG = [
  { kind:'match', name:'Memory Match', blurb:'Flip cards to find 8 pairs against the clock. Best time is saved.',
    spec:'noun = plural name of the cards ("blue ribbons", "beer cans"). items = exactly 8 short pair labels (max 18 chars each) drawn from the chapter. emoji = 8 emoji, one per label. label = one emoji for the card backs. win = a line that contains {secs}.' },
  { kind:'flick', name:'Flick Shot', blurb:'Drag back and let go. Misses twice, scores on the third. Paper football, beer pong, free throw...',
    spec:'noun = the thing being launched ("ping-pong ball"). emoji[0] = the projectile, emoji[1] = the target. label = short text printed on the table/field (max 28 chars, caps). lines[0], lines[1] = the two misses, roast-flavored. shout = 1-2 word yell on the score ("SPLASH!"). win = the line after it finally goes in.' },
  { kind:'echo', name:'Repeat After Me', blurb:'Three pads light up in a pattern; play it back. Three rounds, getting longer.',
    spec:'noun = what a pattern is called ("cadence", "order", "combo"). items = 3 pad names (max 10 chars). emoji = 3 emoji, one per pad. lines[0], lines[1] = praise after rounds one and two; lines[2] = the line when they get it wrong. win = line after round three.' },
  { kind:'order', name:'Right Order', blurb:'Five steps, one correct order, no hints. A wrong press resets everything.',
    spec:'items = exactly 5 steps IN THE CORRECT ORDER (max 38 chars each) of some procedure from their life (their morning routine, how they grill, how they tell That One Story). label = gauge caption in caps (max 16 chars, e.g. "GRILL TEMP"). lines[0..3] = progress lines after steps 1-4; lines[4] = the wrong-order line. shout = banner when done. win = closing line.' },
  { kind:'crowd', name:'Fill the Room', blurb:'Tap eight sections of an arena until the whole place is packed and roaring.',
    spec:'noun = what is being filled ("the stadium", "the wedding dance floor"). label = what the middle is (max 14 chars caps, "THE STAGE"). emoji[0] = optional emoji for the crowd. lines = 7 running-commentary lines, one after each of the first seven sections. shout = what the full room yells (max 12 chars). win = closing line.' },
  { kind:'chart', name:'Org Chart', blurb:'Build the org chart of their life one box at a time, dotted lines included.',
    spec:'items = exactly 7 boxes, each "Title | subtitle": item 0 is the birthday person with a fake job title; items 1-4 are their four "departments" (family, hobbies, friend group...); items 5-6 are dotted-line boxes (the real boss, the thing they answer to). lines = 7 notes, one read out as each box appears. win = closing line.' },
  { kind:'pin', name:'Pin the Thing', blurb:'Blindfolded pin-the-tail, but on a photo of the birthday person. Needs a photo.', needsPhoto:true,
    spec:'noun = the thing being pinned ("cowboy hat"). emoji[0] = that thing as one emoji. lines = exactly 4: perfect placement, close, too low, way off. label = caption for the side card. photo = id of a clear head-and-shoulders photo of the birthday person.' },
  { kind:'brawl', name:'Boss Fight', blurb:'A Street Fighter parody against their sworn nemesis. They cannot lose.',
    spec:'items[0] = the nemesis name in caps (their inbox, a barrel cactus, IKEA instructions, the Cardinals offense). items[1..5] = five comic-book hit words. emoji[0] = the nemesis as one emoji, emoji[1] = one emoji for the hero body. lines = 2-3 feeble attack words from the nemesis. shout = the K.O. line (max 40 chars). win = closing line.' },
  { kind:'trek', name:'The Long Road', blurb:'Press to advance up the trail. Halfway there, an -ism interrupts. Photo reveal at the top.',
    spec:'lines = exactly 8: lines[0..2] three steps of the journey, lines[3] the build-up to an interruption (a sneeze, a phone call, a tangent), lines[4] the -ism itself in CAPS, lines[5..6] two more steps, lines[7] the arrival. label = the text on the interruption button (the -ism, max 20 chars). emoji[0] = the traveler, emoji[1] = a big emoji to reveal if there is no photo. photo = id of the photo revealed at the top. win = caption for that reveal.' },
  { kind:'whack', name:'Whack-a-Thing', blurb:'Things pop up in nine holes. Bonk ten of the right ones; leave the decoys alone.',
    spec:'items[0] = plural name of the thing to bonk, items[1] = plural name of the decoy to leave alone. emoji[0] = the thing, emoji[1] = the decoy. lines = 2-3 lines for bonking a decoy. shout = banner when done. win = closing line.' },
];
BB.MINI_KINDS = BB.MINI_CATALOG.map(m => m.kind);

/* A complete, generic skin for each game: what normalize() falls back on, field by field. */
BB.miniDefaults = function (kind, c) {
  const n = c.name, ism = c.ism || 'Classic.';
  const D = {
    match: { title:'Memory Match', noun:'cards', intro:`Turn over two at a time. The clock starts on your first flip.`, items:['Cake', 'Candles', 'Balloons', 'Presents', 'Party Hat', 'Confetti', 'The Card', 'The Speech'], emoji:['🎂', '🕯️', '🎈', '🎁', '🥳', '🎊', '💌', '🎤'], label:'★', win:`All eight pairs in {secs} seconds. ${n} would have done it faster, according to ${n}.` },
    flick: { title:'Flick Shot', noun:'paper football', intro:'Three tries. Pull it back and let it fly.', emoji:['🏈', '🥅'], label:'THE BIG GAME', lines:['Wide right. Years of practice, apparently.', 'Wide left. The crowd is being polite about it.'], shout:"IT'S GOOD!", win:`It's good! ${n} has already started telling the story.` },
    echo: { title:'Repeat After Me', noun:'pattern', intro:'Watch the pads light up, then play it back in order.', items:['Left', 'Middle', 'Right'], emoji:['🥁', '🔔', '🎺'], lines:['Round one. That was the easy one.', 'Round two. Now it gets real.', 'Off the beat. Watch it again.'], win:`Every beat in time. ${n} has never once been this coordinated.` },
    order: { title:'Right Order', noun:'steps', intro:'Five steps. One right order. A wrong press resets the whole thing.', items:['Wake up', 'Coffee', 'More coffee', 'Pretend to check email', 'Announce a plan'], label:'POWER', lines:['Step one confirmed. Four to go.', 'Two down.', 'Three. Momentum.', 'Four. One more.', `BZZT. Wrong order. "${ism}" Start from the top.`], shout:'NAILED IT', win:'Textbook. Nobody has any notes.' },
    crowd: { title:'Fill the Room', noun:'the room', intro:'Pack the place, one section at a time.', label:'THE STAGE', emoji:[], lines:['One section in. It is already loud.', 'Two. Somebody brought a cowbell.', 'Three.', 'Halfway. The line for snacks is out the door.', 'Five.', 'Six.', 'One more.'], shout:'HAPPY BIRTHDAY', win:`A full house, all here for ${n}.` },
    chart: { title:'Org Chart', noun:'boxes', intro:'Every life needs an org chart.', items:[`${n} | Chief Executive of Saturday`, 'Family | direct reports', 'Hobbies | over budget', 'Friends | meets at the bar', 'Snacks | department of one', 'The Group Chat | (dotted line)', 'The Real Boss | (everybody knows)'], lines:['At the top, where they have always assumed they belong.', 'Family: frequent unscheduled meetings.', 'Hobbies: a department with no oversight.', 'Friends: attendance enthusiastic.', 'Snacks: no delegation. Ever.', 'Dotted line, as required by every real org chart.', 'One more dotted line. Everybody knows who the real boss is.'], win:'Chart complete. HR has no notes.' },
    pin: { title:'Pin the Thing', noun:'party hat', intro:'Blindfold on. Find the top of their head.', emoji:['🥳'], lines:['Perfect fit. Frame it.', 'Close enough. It is a hat, not a helmet.', 'That is a chin-strap situation. Try again?', 'That one left the building. Try again?'], label:`${n}, now properly dressed for the occasion.` },
    brawl: { title:'Boss Fight', noun:'fight', intro:'FIGHT!', items:['THE ALARM CLOCK', 'POW!', 'BONK!', 'THWACK!', 'OOF!', 'WHAM!'], emoji:['⏰', '🕺'], lines:['beep', 'snooze?'], shout:'K.O.! Flawless victory.', win:`${n} does not lose on home turf.` },
    trek: { title:'The Long Road', noun:'road', intro:'One step at a time.', lines:['Step one. Shoes on, snacks packed.', 'Step two. Making good time.', `Step three. ${n} has not stopped talking once.`, 'Wait. Hold on. Something is coming...', String(ism).toUpperCase(), 'Anyway. Onward.', 'Nearly there.', 'The top.'], label:String(ism).slice(0, 22), emoji:['🚶', '🏆'], win:`Made it. ${n}, in their natural habitat.` },
    whack: { title:'Whack-a-Thing', noun:'things', intro:'Bonk ten of them. Leave the decoys alone.', items:['candles', 'cakes'], emoji:['🕯️', '🎂'], lines:['Not that one!', 'That was the cake. We needed that.', 'Wrong thing. Classic.'], shout:'CLEARED!', win:'Ten for ten. Reflexes of a much younger person.' },
  };
  return Object.assign({ kind, title:'', noun:'', intro:'', items:[], emoji:[], lines:[], shout:'', label:'', win:'', photo:null }, D[kind] || D.match);
};

BB.MINI = {
  /* ---- 1 · match: 4x4 memory, 8 pairs, timed, best time kept per party ---- */
  match: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} the ${T.noun} to find all 8 matching pairs, fast.`,
    actions: () => `<button class="btn ghostbtn" data-action="reset">Play again</button>${CONTINUE}`,
    build(T) {
      const cards = Array.from({ length: 16 }, (_, i) => `<button class="mcard" data-action="flip" data-i="${i}" type="button" tabindex="-1"><div class="inner"><div class="face back emo">${esc(T.label || '★')}</div><div class="face front"></div></div></button>`).join('');
      return `<div class="sidewrap"><div class="cards">${cards}</div>
        <div class="side"><div class="kicker">Time</div><div class="stat huge timer">0 s</div><div class="pairs">Pairs: 0 of 8</div><div class="best"></div></div></div>`;
    },
    key: (ctx) => `bb-${ctx.partyId}-match-best`,
    best(ctx) { try { return +localStorage.getItem(this.key(ctx)) || 0; } catch (e) { return 0; } },
    showBest(el, ctx) { const b = this.best(ctx); el.querySelector('.best').textContent = b ? `Fastest time: ${b} s` : 'No record yet. Set one.'; },
    deal(el, local, T, ctx) {
      const deck = shuffle([...Array(8).keys(), ...Array(8).keys()]);
      el.querySelectorAll('.mcard').forEach((c, i) => {
        const p = deck[i]; c.dataset.p = p; c.classList.remove('up', 'matched', 'hi');
        const f = c.querySelector('.front'); f.style.setProperty('--c', CARD_COLORS[p]);
        f.innerHTML = `${T.emoji[p] ? `<span class="emo">${esc(T.emoji[p])}</span>` : ''}<span>${esc(T.items[p])}</span>`;
      });
      Object.assign(local, { open:[], pairs:0, t0:null, busy:false, doneFlag:false, cursor:0 });
      el.querySelector('.timer').textContent = '0 s'; el.querySelector('.pairs').textContent = 'Pairs: 0 of 8';
      this.showBest(el, ctx);
    },
    init(el, local, api, T, ctx) {
      this.deal(el, local, T, ctx);
      api.note(T.intro);
      local.timer = setInterval(() => { if (local.t0 && !local.doneFlag) el.querySelector('.timer').textContent = Math.floor((performance.now() - local.t0) / 1000) + ' s'; }, 200);
      local.cleanup = () => clearInterval(local.timer);
      local.onKey = (k) => {                       /* arrows move the highlight, Enter/Space flips */
        if (local.doneFlag) return false;
        const cards = [...el.querySelectorAll('.mcard')];
        const move = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-4, ArrowDown:4 }[k];
        if (move !== undefined) { local.cursor = ((local.cursor + move) % 16 + 16) % 16; cards.forEach((c, i) => c.classList.toggle('hi', i === local.cursor)); return true; }
        if (k === 'Enter' || k === ' ') { this.flip(cards[local.cursor], el, local, api, T, ctx); return true; }
        return false;
      };
    },
    flip(card, el, local, api, T, ctx) {
      if (!card || local.busy || local.doneFlag || card.classList.contains('up')) return;
      if (!local.t0) local.t0 = performance.now();
      card.classList.add('up'); Sound().blip(); local.open.push(card);
      if (local.open.length < 2) return;
      const [a, b] = local.open; local.open = [];
      if (a.dataset.p === b.dataset.p) {
        a.classList.add('matched'); b.classList.add('matched'); local.pairs++;
        el.querySelector('.pairs').textContent = `Pairs: ${local.pairs} of 8`; Sound().chime();
        if (local.pairs === 8) {
          local.doneFlag = true;
          const secs = Math.max(1, Math.round((performance.now() - local.t0) / 1000));
          el.querySelector('.timer').textContent = secs + ' s';
          const best = this.best(ctx); let msg = fill(T.win, { secs });
          if (!best || secs < best) { try { localStorage.setItem(this.key(ctx), String(secs)); } catch (e) {} msg += ` New fastest time: ${secs} seconds!`; }
          this.showBest(el, ctx); Sound().cheer(); Confetti().burst(150);
          api.finish(msg, 'Press Continue, or play again for a faster time.');
        }
      } else {
        local.busy = true;
        setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); local.busy = false; }, 750);
      }
    },
    act(action, btn, el, local, api, T, ctx) {
      if (action === 'flip') this.flip(btn, el, local, api, T, ctx);
      if (action === 'reset') { this.deal(el, local, T, ctx); api.reset(T.intro, this.doText(T, ctx.touch)); }
    },
  },

  /* ---- 2 · flick: drag back, let go; misses right, misses left, scores on the third ---- */
  flick: {
    doText: (T, touch) => `${touch ? 'Drag' : 'Pull'} the ${T.noun} back, let go, and hit the target.`,
    actions: () => `<button class="btn big" data-action="flick">Let it fly</button>${CONTINUE}`,
    build(T, ctx) {
      return `<div class="sidewrap"><div class="flick"><svg viewBox="0 0 1200 600">
        <rect width="1200" height="600" rx="16" fill="${ctx.palette.accent2}"/><rect width="1200" height="600" rx="16" fill="rgba(0,0,0,.35)"/>
        <rect x="24" y="24" width="1152" height="552" rx="10" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="6"/><line x1="40" y1="330" x2="1160" y2="330" stroke="rgba(255,255,255,.22)" stroke-width="6" stroke-dasharray="20 16"/>
        <text x="600" y="420" text-anchor="middle" font-size="34" font-weight="900" fill="rgba(255,255,255,.4)">${esc(T.label)}</text>
        <circle cx="600" cy="140" r="104" fill="rgba(0,0,0,.35)" stroke="${ctx.palette.accent}" stroke-width="8" stroke-dasharray="18 12"/>
        <text class="tgt emo" x="600" y="190" text-anchor="middle" font-size="140">${esc(T.emoji[1] || '🎯')}</text>
        <line class="meter" x1="600" y1="510" x2="600" y2="510" stroke="#fff" stroke-width="6" stroke-dasharray="14 10" opacity="0"/>
        <g class="ball" style="transform:translate(600px,510px)"><text class="emo" text-anchor="middle" y="22" font-size="64">${esc(T.emoji[0] || '🏈')}</text></g>
        <text class="shout" x="600" y="350" style="font-size:${Math.min(110, Math.floor(1500 / Math.max(1, T.shout.length)))}px">${esc(T.shout)}</text></svg></div>
        <div class="side"><div class="kicker">Attempt</div><div class="stat attempt">1 of 3</div>${ctx.polaroid(T.photo, T.photoCaption, 3, 'sm')}</div></div>`;
    },
    init(el, local, api, T) {
      Object.assign(local, { n:0, flying:false, drag:null, power:0 });
      api.note(T.intro);
      const svg = el.querySelector('.flick svg'), ball = el.querySelector('.ball'), meter = el.querySelector('.meter');
      const toSvg = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
      const setPull = (p) => { local.power = p; ball.style.opacity = 1; ball.style.transform = `translate(600px, ${510 + p * 70}px) scale(${1 + p * .1})`; meter.setAttribute('y2', 510 + p * 70); meter.setAttribute('opacity', p > 0 ? .9 : 0); };
      svg.addEventListener('pointerdown', (e) => { if (local.flying || local.n >= 3) return; local.drag = toSvg(e); svg.setPointerCapture(e.pointerId); });
      svg.addEventListener('pointermove', (e) => { if (!local.drag) return; const q = toSvg(e); setPull(Math.max(0, Math.min(1, (q.y - local.drag.y) / 140))); });
      const release = () => { if (!local.drag) return; local.drag = null; if (local.power > .12) this.launch(el, local, api, T); else setPull(0); };
      svg.addEventListener('pointerup', release); svg.addEventListener('pointercancel', release);
      local.onKey = (k) => {                       /* hold Space to pull back, release to flick */
        if (local.flying || local.n >= 3) return false;
        if (k === ' ' || k === 'Enter') { if (!local.hold) { local.hold = true; local.holdT = performance.now(); const tick = () => { if (!local.hold) return; setPull(Math.min(1, (performance.now() - local.holdT) / 900)); requestAnimationFrame(tick); }; tick(); } return true; }
        return false;
      };
      local.onKeyUp = (k) => { if ((k === ' ' || k === 'Enter') && local.hold) { local.hold = false; this.launch(el, local, api, T); } };
      local.setPull = setPull; local.alive = true; local.cleanup = () => { local.alive = false; local.hold = false; };
    },
    launch(el, local, api, T) {
      if (local.flying || local.n >= 3) return;
      local.flying = true; Sound().blip();
      const ball = el.querySelector('.ball'); el.querySelector('.meter').setAttribute('opacity', 0);
      const shot = [{ end:[1010, 70], ctrl:[900, 260] }, { end:[190, 70], ctrl:[300, 260] }, { end:[600, 150], ctrl:[600, 250] }][local.n];
      const start = [600, 510 + local.power * 70], t0 = performance.now(), ms = 950;
      const frame = (now) => {
        if (!local.alive) return;
        const t = Math.min(1, (now - t0) / ms), u = 1 - t;
        const x = u*u*start[0] + 2*u*t*shot.ctrl[0] + t*t*shot.end[0], y = u*u*start[1] + 2*u*t*shot.ctrl[1] + t*t*shot.end[1];
        ball.style.transform = `translate(${x}px, ${y}px) rotate(${t * 540}deg) scale(${1 + Math.sin(Math.PI * t) * .7 - t * .35})`;
        if (t < 1) requestAnimationFrame(frame); else this.landed(el, local, api, T);
      };
      requestAnimationFrame(frame);
    },
    landed(el, local, api, T) {
      local.n++; local.flying = false; local.power = 0;
      el.querySelector('.attempt').textContent = `${Math.min(local.n + 1, 3)} of 3`;
      if (local.n >= 3) {
        el.querySelector('.ball').style.opacity = 0; el.querySelector('.tgt').classList.add('scored');
        el.querySelector('.shout').classList.add('show'); const pol = el.querySelector('.side .polaroid'); if (pol) pol.classList.add('show');
        Sound().cheer(); Confetti().burst(150); api.finish(T.win);
        el.querySelectorAll('[data-action="flick"]').forEach(b => b.hidden = true);
      } else {
        Sound().wrong(); api.note(T.lines[local.n - 1] || 'Miss.');
        setTimeout(() => { if (local.alive) local.setPull(0); }, 700);
      }
    },
    act(action, btn, el, local, api, T) { if (action === 'flick' && !local.flying && local.n < 3) { local.setPull(.7); setTimeout(() => this.launch(el, local, api, T), 150); } },
  },

  /* ---- 3 · echo: watch the pads, play them back; three rounds ---- */
  echo: {
    patterns: [[0, 0, 1, 0], [0, 1, 0, 1, 2, 0], [0, 0, 1, 0, 0, 1, 2, 2]],
    doText: (T, touch) => `Watch the ${T.noun}, then ${touch ? 'tap' : 'play'} it back.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      const pads = [0, 1, 2].map(i => `<button class="epad p${i}" data-action="hit" data-p="${i}" type="button"><span class="emo">${esc(T.emoji[i] || '')}</span><span>${esc(T.items[i])}</span><span class="k">key ${i + 1}</span></button>`).join('');
      return `<div class="echowrap"><div class="kit"><div class="round">Round 1 of 3</div><div class="pads">${pads}</div><div class="beatdots"></div></div>
        <div class="side">${ctx.polaroid(T.photo, T.photoCaption, -3, 'sm')}</div></div>`;
    },
    init(el, local, api, T) {
      Object.assign(local, { round:0, pos:0, showing:false, won:false, timers:[] });
      local.cleanup = () => local.timers.forEach(clearTimeout);
      api.note(T.intro);
      local.timers.push(setTimeout(() => this.show(el, local, api, T), 1400));
      local.onKey = (k) => {
        if (local.won) return false;
        const p = { '1':0, '2':1, '3':2 }[k];
        if (p !== undefined) { this.hit(p, el, local, api, T); return true; }
        return false;
      };
    },
    light(el, p, ms = 260) { const pad = el.querySelector(`.epad[data-p="${p}"]`); pad.classList.add('lit'); Sound().drum(p); setTimeout(() => pad.classList.remove('lit'), ms); },
    show(el, local, api, T) {
      const pat = this.patterns[local.round];
      local.showing = true; local.pos = 0;
      el.querySelector('.round').textContent = `Round ${local.round + 1} of 3`;
      el.querySelector('.beatdots').innerHTML = pat.map(() => '<span></span>').join('');
      el.querySelectorAll('.epad').forEach(b => b.disabled = true);
      api.note('Watch...');
      const step = 480;
      pat.forEach((p, i) => local.timers.push(setTimeout(() => { this.light(el, p); el.querySelectorAll('.beatdots span').forEach((d, k) => d.classList.toggle('cue', k === i)); }, 500 + i * step)));
      local.timers.push(setTimeout(() => {
        local.showing = false; el.querySelectorAll('.beatdots span').forEach(d => d.classList.remove('cue'));
        el.querySelectorAll('.epad').forEach(b => b.disabled = false); api.note('Your turn. Play it back.');
      }, 500 + pat.length * step + 200));
    },
    hit(p, el, local, api, T) {
      if (local.showing || local.won) return;
      const pat = this.patterns[local.round];
      this.light(el, p, 160);
      if (p !== pat[local.pos]) {                   /* wrong pad: buzz, then replay this round */
        Sound().buzzer(); api.note(T.lines[2] || 'Not quite. Watch it again.', true);
        el.querySelectorAll('.beatdots span').forEach(d => d.classList.remove('hit'));
        local.showing = true; el.querySelectorAll('.epad').forEach(b => b.disabled = true);
        local.timers.push(setTimeout(() => this.show(el, local, api, T), 1100));
        return;
      }
      el.querySelectorAll('.beatdots span')[local.pos].classList.add('hit');
      local.pos++;
      if (local.pos < pat.length) return;
      local.round++;
      if (local.round >= this.patterns.length) {
        local.won = true; el.querySelectorAll('.epad').forEach(b => b.disabled = true);
        const pol = el.querySelector('.side .polaroid'); if (pol) pol.classList.add('show');
        Sound().cheer(); Confetti().burst(180); api.finish(T.win);
        return;
      }
      Sound().chime(); api.note(T.lines[local.round - 1] || 'Nice.');
      local.showing = true; el.querySelectorAll('.epad').forEach(b => b.disabled = true);
      local.timers.push(setTimeout(() => this.show(el, local, api, T), 1500));
    },
    act(action, btn, el, local, api, T) { if (action === 'hit') this.hit(+btn.dataset.p, el, local, api, T); },
  },

  /* ---- 4 · order: five steps, correct order only, no hints ---- */
  order: {
    doText: () => 'Press the five steps in the correct order. No hints.',
    actions: () => CONTINUE,
    build(T, ctx) {
      let ticks = '';
      for (let k = 0; k <= 12; k++) ticks += `<line x1="200" y1="46" x2="200" y2="${k % 3 === 0 ? 70 : 60}" stroke="#8fa0b0" stroke-width="5" transform="rotate(${-120 + k * 20} 200 200)"/>`;
      const shown = T._shown || (T._shown = (() => { let s; do { s = shuffle([0, 1, 2, 3, 4]); } while (s.every((v, i) => v === i)); return s; })());
      return `<div class="orderbox">
        <div class="seq">
          <div class="opts n5">${shown.map((idx, k) => `<button class="btn opt" data-action="press" data-step="${idx}" type="button"><span class="num">${k + 1}</span><span class="lbl">${esc(T.items[idx])}</span></button>`).join('')}</div>
          <div class="lamps">${[0, 1, 2, 3, 4].map(() => `<span class="lamp"></span>`).join('')}</div>
        </div>
        <div class="gaugebox"><svg viewBox="0 0 400 300"><path d="M52 290 A160 160 0 1 1 348 290" fill="none" stroke="#0b0f14" stroke-width="44"/><path d="M52 290 A160 160 0 1 1 348 290" fill="none" stroke="#3a4653" stroke-width="30"/>
          <path d="M270 62 A160 160 0 0 1 348 290" fill="none" stroke="${ctx.palette.accent}" stroke-width="30" opacity=".85"/>${ticks}
          <line class="needle" x1="200" y1="200" x2="200" y2="58" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="200" cy="200" r="16" fill="${ctx.palette.accent}"/>
          <text x="200" y="262" text-anchor="middle" font-size="26" font-weight="800" fill="#c9d3dc">${esc(T.label)}</text></svg>
          <div class="readout">0%</div></div>
        <div class="banner">${esc(T.shout)}</div></div>`;
    },
    init(el, local, api, T) { local.n = 0; api.note(T.intro); },
    setPower(el, n) { el.querySelector('.needle').style.transform = `rotate(${-120 + n * 48}deg)`; el.querySelector('.readout').textContent = (n * 20) + '%'; el.querySelectorAll('.lamp').forEach((l, i) => l.classList.toggle('on', i < n)); },
    act(action, btn, el, local, api, T) {
      if (action !== 'press' || local.won) return;
      const got = +btn.dataset.step;
      if (got === local.n) {
        local.n++; this.setPower(el, local.n); Sound().blip();
        if (local.n >= 5) { local.won = true; el.querySelector('.banner').classList.add('show'); Sound().fanfare(); Confetti().burst(140); api.finish(T.win); el.querySelectorAll('.opt').forEach(b => b.disabled = true); }
        else api.note(T.lines[local.n - 1] || `${local.n} down.`);
      } else {
        local.n = 0; this.setPower(el, 0); Sound().buzzer();
        const box = el.querySelector('.orderbox'); box.classList.remove('bzzt'); void box.offsetWidth; box.classList.add('bzzt');
        btn.style.animation = 'shake .45s'; setTimeout(() => btn.style.animation = '', 500);
        api.note(T.lines[4] || 'BZZT. Wrong order. Start from the top.', true);
      }
    },
  },

  /* ---- 5 · crowd: fill eight sections of an arena ---- */
  crowd: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} each section to fill ${T.noun}.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      const cx = 600, cy = 360, rxO = 560, ryO = 300, rxI = 300, ryI = 140, r = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const em = T.emoji[0];
      let secs = '', fans = '';
      for (let s = 0; s < 8; s++) {
        const a0 = s / 8 * Math.PI * 2, a1 = (s + 1) / 8 * Math.PI * 2, pts = [];
        for (let k = 0; k <= 6; k++) { const a = a0 + (a1 - a0) * k / 6; pts.push(`${(cx + Math.cos(a) * rxO).toFixed(0)},${(cy + Math.sin(a) * ryO).toFixed(0)}`); }
        for (let k = 6; k >= 0; k--) { const a = a0 + (a1 - a0) * k / 6; pts.push(`${(cx + Math.cos(a) * rxI).toFixed(0)},${(cy + Math.sin(a) * ryI).toFixed(0)}`); }
        secs += `<polygon class="section" data-action="fill" data-s="${s}" points="${pts.join(' ')}"/>`;
        let f = '';
        for (let i = 0; i < (em ? 12 : 46); i++) {
          const a = a0 + (a1 - a0) * (.08 + r() * .84), t = .14 + r() * .72, x = (cx + Math.cos(a) * (rxI + t * (rxO - rxI))).toFixed(0), y = (cy + Math.sin(a) * (ryI + t * (ryO - ryI))).toFixed(0), d = (r() * .2).toFixed(2);
          f += em ? `<text class="fan emo" x="${x}" y="${+y + 12}" text-anchor="middle" font-size="36" style="animation-delay:${d}s">${esc(em)}</text>` : `<circle class="fan" cx="${x}" cy="${y}" r="5" fill="${r() < .6 ? ctx.palette.accent : '#e8eefc'}" style="animation-delay:${d}s"/>`;
        }
        fans += `<g class="fans" data-s="${s}">${f}</g>`;
      }
      return `<svg class="crowd" viewBox="0 0 1200 720"><ellipse cx="${cx}" cy="${cy + 10}" rx="${rxO + 16}" ry="${ryO + 16}" fill="rgba(0,0,0,.55)"/>${secs}
        <ellipse class="stagefloor" cx="${cx}" cy="${cy}" rx="${rxI}" ry="${ryI}" pointer-events="none"/>
        <text x="600" y="372" text-anchor="middle" font-size="34" font-weight="900" fill="rgba(255,255,255,.5)" pointer-events="none">${esc(T.label)}</text>
        ${fans}<text class="shout" x="600" y="400" style="font-size:${Math.min(110, Math.floor(1500 / Math.max(1, T.shout.length)))}px">${esc(T.shout)}</text></svg>`;
    },
    init(el, local, api, T) {
      local.n = 0; api.note(T.intro || 'Sections filled: 0 of 8');
      local.onKey = (k) => {                       /* Enter/Space fills the next empty section */
        if (k !== 'Enter' && k !== ' ') return false;
        const next = el.querySelector('.section:not(.full)'); if (!next) return false;
        this.act('fill', next, el, local, api, T); return true;
      };
    },
    act(action, poly, el, local, api, T) {
      if (action !== 'fill' || poly.classList.contains('full')) return;
      const svg = el.querySelector('.crowd');
      poly.classList.add('full');
      svg.querySelectorAll(`.fans[data-s="${poly.dataset.s}"] .fan`).forEach(f => f.classList.add('show'));
      Sound().blip(); local.n++;
      if (local.n >= 8) { svg.classList.add('roar'); svg.querySelector('.shout').classList.add('show'); Sound().cheer(); Confetti().burst(160); api.finish(T.win); }
      else api.note(`${local.n} of 8. ${T.lines[local.n - 1] || ''}`);
    },
  },

  /* ---- 6 · chart: build the org chart of their life with one big button ---- */
  chart: {
    doText: () => 'Press the big button to build the org chart.',
    pos: [[50, 14], [14, 72], [38, 72], [62, 72], [86, 72], [84, 16], [84, 42]],
    split: (s) => { const [t, ...rest] = String(s).split('|'); return [t.trim(), rest.join('|').trim()]; },
    first: (T) => `Place ${BB.MINI.chart.split(T.items[0])[0]} at the top`,
    build(T) {
      const P = this.pos;
      const boxes = T.items.slice(0, 7).map((it, i) => { const [t, s] = this.split(it); return `<div class="obox ${i === 0 ? 'top' : i >= 5 ? 'dotted' : ''}" data-i="${i}" style="left:${P[i][0]}%;top:${P[i][1]}%"><div class="t">${esc(t)}</div><div class="s">${esc(s)}</div></div>`; }).join('');
      const lines = [1, 2, 3, 4, 5, 6].map(i => { const l = i === 5 ? [50, 14, 84, 16] : i === 6 ? [84, 22, 84, 36] : [50, 22, P[i][0], 62]; return `<line data-i="${i}" class="${i >= 5 ? 'dotted' : ''}" x1="${l[0]}%" y1="${l[1]}%" x2="${l[2]}%" y2="${l[3]}%"/>`; }).join('');
      return `<div class="org"><svg>${lines}</svg>${boxes}</div>`;
    },
    init(el, local, api, T) { local.n = 0; api.note(T.intro); },
    step(el, local, T) {
      const i = local.n;
      el.querySelector(`.obox[data-i="${i}"]`).classList.add('show');
      const line = el.querySelector(`line[data-i="${i}"]`); if (line) line.classList.add('show');
      Sound().blip(); local.n++;
      if (local.n >= 7) { Sound().chime(); Confetti().burst(100); return { note:`${T.lines[i] || ''} ${T.win}`.trim(), done:true }; }
      const next = this.split(T.items[local.n])[0];
      return { note:T.lines[i] || '', label: local.n >= 5 ? `Add the dotted line: ${next}` : `Add: ${next}` };
    },
  },

  /* ---- 7 · pin: pin the thing on a photo of the birthday person ---- */
  pin: {
    doText: (T, touch) => `Pin the ${T.noun} on ${T._name || 'them'}. Aim, then ${touch ? 'tap' : 'click'}.`,
    actions: () => `<button class="btn ghostbtn" data-action="retry" hidden>Try again</button>${CONTINUE}`,
    build(T, ctx) {
      return `<div class="sidewrap"><div class="pin"><img src="${esc(ctx.src(T.photo))}" alt=""><div class="target"></div><div class="blind">Blindfold on.<br>Where is the top of their head?</div><div class="thing emo">${esc(T.emoji[0] || '🥳')}</div></div>
        <div class="side"><div class="kicker">Placement</div><div class="stat huge score">—</div><div class="card"><p>${esc(T.label)}</p></div></div></div>`;
    },
    init(el, local, api, T, ctx) {
      const box = el.querySelector('.pin'), thing = box.querySelector('.thing'), tgt = box.querySelector('.target');
      const target = local.target = { x: T.target ? T.target.x : .5, y: T.target ? T.target.y : .2 };
      tgt.style.left = (target.x * 100) + '%'; tgt.style.top = (target.y * 100) + '%';
      const place = (x, y) => { local.hx = Math.max(0, Math.min(1, x)); local.hy = Math.max(0, Math.min(1, y)); thing.style.left = (local.hx * 100) + '%'; thing.style.top = (local.hy * 100) + '%'; };
      const reset = () => { box.classList.remove('pinned'); local.pinned = false; place(.15 + Math.random() * .7, .45 + Math.random() * .45); el.querySelector('.score').textContent = '—'; api.reset(T.intro, this.doText(T, ctx.touch)); el.querySelectorAll('[data-action="retry"]').forEach(b => b.hidden = true); };
      local.reset = reset; reset();
      const rel = (e) => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
      box.addEventListener('pointermove', e => { if (!local.pinned && e.pointerType === 'mouse') place(...rel(e)); });
      box.addEventListener('pointerdown', e => { if (!local.pinned) { place(...rel(e)); this.pinIt(el, local, api, T); } });
      local.onKey = (k) => {
        if (local.pinned) return false;
        const d = { ArrowLeft:[-.03, 0], ArrowRight:[.03, 0], ArrowUp:[0, -.03], ArrowDown:[0, .03] }[k];
        if (d) { place(local.hx + d[0], local.hy + d[1]); return true; }
        if (k === 'Enter' || k === ' ') { this.pinIt(el, local, api, T); return true; }
        return false;
      };
    },
    pinIt(el, local, api, T) {
      const box = el.querySelector('.pin'), r = box.getBoundingClientRect();
      local.pinned = true; box.classList.add('pinned');
      const dx = (local.hx - local.target.x) * (r.width / r.height), dy = local.hy - local.target.y;   /* scale x so a miss counts the same in both directions */
      const dist = Math.hypot(dx, dy);
      let msg, score;
      if (dist < .06) { msg = T.lines[0]; score = 'Bullseye'; Sound().cheer(); Confetti().burst(140); }
      else if (dist < .14) { msg = T.lines[1]; score = 'Close'; Sound().chime(); }
      else if (dy > 0 && dist < .34) { msg = T.lines[2]; score = 'Low'; Sound().wrong(); }
      else { msg = T.lines[3]; score = 'Way off'; Sound().wrong(); }
      el.querySelector('.score').textContent = score;
      api.finish(msg, 'Press Continue, or try again.');
      el.querySelectorAll('[data-action="retry"]').forEach(b => b.hidden = false);
    },
    act(action, btn, el, local) { if (action === 'retry') local.reset(); },
  },

  /* ---- 8 · brawl: arrows move, space punches, the nemesis never wins ---- */
  brawl: {
    soft: true,
    doText: (T, touch) => touch ? `Use the buttons to move and punch. Beat ${T.items[0]}.` : `Arrow keys move. Space punches. Beat ${T.items[0]}.`,
    actions: () => `<div class="pad"><button class="btn ghostbtn" data-action="left">◀ Move</button><button class="btn big" data-action="punch">PUNCH</button><button class="btn ghostbtn" data-action="right">Move ▶</button></div>${CONTINUE}`,
    build(T, ctx) {
      const face = ctx.heroPhoto ? `<img class="face" src="${esc(ctx.src(ctx.heroPhoto))}" alt="">` : '';
      return `<div class="arena">
        <div class="hpbar you"><div class="fill" style="width:100%"></div></div><div class="hpname you">${esc(T._name || 'YOU')}</div>
        <div class="hpbar foe"><div class="fill" style="width:100%"></div></div><div class="hpname foe">${esc(T.items[0])}</div>
        <div class="fighter you">${face}<div class="body emo">${esc(T.emoji[1] || '🕺')}</div><div class="glove emo">🥊</div></div>
        <div class="fighter foe"><div class="body emo">${esc(T.emoji[0] || '⏰')}</div></div>
        <div class="bubble"></div><div class="fightmsg">${esc(T.intro || 'FIGHT!')}</div>
      </div>`;
    },
    init(el, local, api, T, ctx) {
      const arena = el.querySelector('.arena'), you = el.querySelector('.fighter.you'), foe = el.querySelector('.fighter.foe');
      const W = () => arena.clientWidth, fw = () => you.clientWidth;
      const g = local.g = { px:0, ex:0, pHP:100, eHP:100, cool:1.2, over:false, punching:false, down:{} };
      const hits = T.items.slice(1).filter(Boolean), pokes = T.lines.filter(Boolean);
      const place = () => { you.style.transform = `translateX(${g.px}px)`; foe.style.setProperty('--x', g.ex + 'px'); if (!g.over) foe.style.transform = `translateX(${g.ex}px)`; };
      g.px = W() * .18; g.ex = W() * .68; place();
      api.note(ctx.touch ? 'Get close, then PUNCH.' : '← → move · SPACE punch');
      const msg = el.querySelector('.fightmsg'); msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 1200);
      const bubble = (txt, x) => { const b = el.querySelector('.bubble'); b.textContent = txt; b.style.left = x + 'px'; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); };
      g.place = place;
      g.punch = () => {
        if (g.over || g.punching) return;
        g.punching = true; you.classList.add('punch'); Sound().blip();
        setTimeout(() => { you.classList.remove('punch'); g.punching = false; }, 220);
        if (Math.abs(g.ex - g.px) <= fw() * 1.15) {
          g.eHP = Math.max(0, g.eHP - 20); el.querySelector('.hpbar.foe .fill').style.width = g.eHP + '%';
          foe.classList.remove('hit'); void foe.offsetWidth; foe.classList.add('hit');
          g.ex = Math.min(W() - fw(), g.ex + 50); place();
          bubble(pick(hits.length ? hits : ['POW!']), g.ex + fw() * .1); Sound().thud();
          if (g.eHP <= 0) { g.over = true; foe.classList.add('ko'); Sound().cheer(); Confetti().burst(160); msg.textContent = T.shout; msg.classList.add('show'); api.finish(T.win); }
        }
      };
      let last = performance.now();
      const loop = (now) => {
        if (!local.alive) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        if (!g.over) {
          const sp = W() * .45;
          if (g.down.ArrowLeft) g.px -= sp * dt; if (g.down.ArrowRight) g.px += sp * dt;
          g.px = Math.max(0, Math.min(W() - fw(), g.px));
          const d = g.ex - g.px;
          if (Math.abs(d) > fw() * 1.05) g.ex -= Math.sign(d) * W() * .09 * dt;   /* the nemesis waddles over slowly */
          g.cool -= dt;
          if (Math.abs(d) <= fw() * 1.2 && g.cool <= 0) {
            g.cool = 1.7; foe.classList.remove('poke'); void foe.offsetWidth; foe.classList.add('poke');
            g.pHP = Math.max(1, g.pHP - 4); el.querySelector('.hpbar.you .fill').style.width = g.pHP + '%';   /* the hero can never actually lose */
            bubble(pick(pokes.length ? pokes : ['poke']), g.px + fw() * .2);
          }
          place();
        }
        requestAnimationFrame(loop);
      };
      local.alive = true; requestAnimationFrame(loop);
      local.cleanup = () => { local.alive = false; };
      local.onKey = (k) => {
        if (g.over) return false;
        if (k === 'ArrowLeft' || k === 'ArrowRight') { g.down[k] = true; return true; }
        if (k === ' ' || k === 'Enter') { g.punch(); return true; }
        return false;
      };
      local.onKeyUp = (k) => { delete g.down[k]; };
    },
    act(action, btn, el, local) {
      const g = local.g; if (!g || g.over) return;
      const W = el.querySelector('.arena').clientWidth, fw = el.querySelector('.fighter.you').clientWidth;
      if (action === 'left') g.px = Math.max(0, g.px - W * .12);
      if (action === 'right') g.px = Math.min(W - fw, g.px + W * .12);
      if (action === 'punch') g.punch();
      g.place();
    },
  },

  /* ---- 9 · trek: press to advance; an -ism interrupts midway; reveal at the top ---- */
  trek: {
    soft: true,
    pts: [[140, 640], [440, 600], [260, 520], [560, 470], [400, 400], [700, 340], [540, 280], [700, 150]],
    doText: () => 'Press the big button to keep going.',
    first: () => 'Go',
    build(T, ctx) {
      const P = this.pts;
      let segs = '';
      for (let i = 1; i < P.length; i++) segs += `<line class="trailseg" data-i="${i}" x1="${P[i - 1][0]}" y1="${P[i - 1][1]}" x2="${P[i][0]}" y2="${P[i][1]}"/>`;
      const src = T.photo ? ctx.src(T.photo) : '';
      return `<div class="trek"><svg viewBox="0 0 1200 700">
        <polygon class="hill" points="0,700 700,120 1200,700"/><polygon class="hill2" opacity=".55" points="0,700 700,120 740,170 640,430 500,560 360,640 260,700"/>
        ${segs}
        <g class="dust" transform="translate(400 400)"><circle cx="-30" cy="0" r="18" fill="#fff" opacity=".7"/><circle cx="10" cy="-14" r="24" fill="#fff" opacity=".7"/><circle cx="40" cy="4" r="16" fill="#fff" opacity=".7"/></g>
        <line x1="700" y1="120" x2="700" y2="62" stroke="#fff8e6" stroke-width="5"/><polygon class="flagc" points="700,62 748,78 700,94"/>
        <g id="walker" style="transform:translate(${P[0][0]}px, ${P[0][1]}px)"><ellipse cx="0" cy="4" rx="30" ry="8" fill="rgba(0,0,0,.35)"/><text class="emo" text-anchor="middle" y="0" font-size="120">${esc(T.emoji[0] || '🚶')}</text></g></svg>
        <div class="reveal">${src ? `<div class="frame"><img src="${esc(src)}" alt=""></div>` : `<div class="bigemo emo">${esc(T.emoji[1] || '🏆')}</div>`}<div class="cap">${esc(T.win)}</div></div></div>`;
    },
    init(el, local, api, T) { local.n = 0; local.stage = 'go'; api.note(T.intro); },
    step(el, local, T) {
      const P = this.pts;
      if (local.stage === 'ism') {              /* the -ism button was pressed */
        local.stage = 'go'; el.querySelector('.dust').classList.remove('show'); Sound().chime();
        return { note:T.lines[4], label:'Keep going', bigNote:true };
      }
      local.n++;
      const p = P[local.n];
      el.querySelector('#walker').style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      el.querySelector(`.trailseg[data-i="${local.n}"]`).classList.add('done');
      Sound().blip();
      if (local.n === 4) { local.stage = 'ism'; el.querySelector('.dust').classList.add('show'); return { note:T.lines[3], label:T.label || '...', bigNote:true }; }
      if (local.n >= P.length - 1) {            /* the top: reveal */
        const c = el.querySelector('.trek'); c.classList.add('revealed'); c.querySelector('.reveal').classList.add('show');
        Sound().fanfare(); Confetti().burst(140);
        return { note:T.lines[7], done:true };
      }
      return { note:T.lines[local.n <= 3 ? local.n - 1 : local.n], label:'Keep going' };
    },
  },

  /* ---- 10 · whack: bonk ten of the right thing; decoys only cost you dignity ---- */
  whack: {
    goal: 10,
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} ${BB.MINI.whack.goal} ${T.items[0]}. Leave the ${T.items[1]} alone.`,
    actions: () => CONTINUE,
    build(T) {
      const holes = Array.from({ length: 9 }, (_, i) => `<button class="hole" data-action="bonk" data-h="${i}" type="button" tabindex="-1"><span class="pop emo"></span><span class="key">${i + 1}</span></button>`).join('');
      return `<div class="sidewrap"><div class="whack">${holes}</div>
        <div class="side"><div class="kicker">Bonked</div><div class="stat huge score">0 / ${this.goal}</div></div><div class="banner">${esc(T.shout)}</div></div>`;
    },
    init(el, local, api, T) {
      Object.assign(local, { score:0, won:false, alive:true, up:{}, timers:[] });
      api.note(T.intro);
      const holes = [...el.querySelectorAll('.hole')];
      const spawn = () => {
        if (!local.alive || local.won) return;
        const free = holes.filter((h, i) => !local.up[i]);
        if (free.length > 5) {
          const h = pick(free), i = +h.dataset.h, good = Math.random() < .72;
          local.up[i] = good ? 'good' : 'decoy';
          h.querySelector('.pop').textContent = good ? (T.emoji[0] || '🕯️') : (T.emoji[1] || '🎂');
          h.classList.remove('bonk'); h.classList.add('up');
          local.timers.push(setTimeout(() => { if (local.up[i]) { delete local.up[i]; h.classList.remove('up'); } }, 1250));
        }
        local.timers.push(setTimeout(spawn, 520 + Math.random() * 380));
      };
      local.timers.push(setTimeout(spawn, 900));
      local.cleanup = () => { local.alive = false; local.timers.forEach(clearTimeout); };
      local.onKey = (k) => { if (local.won || !/^[1-9]$/.test(k)) return false; this.bonk(holes[+k - 1], el, local, api, T); return true; };
    },
    bonk(h, el, local, api, T) {
      const i = +h.dataset.h, what = local.up[i];
      if (!what || local.won) return;
      delete local.up[i]; h.classList.add('bonk'); setTimeout(() => h.classList.remove('up', 'bonk'), 140);
      if (what === 'decoy') { Sound().buzzer(); api.note(pick(T.lines.length ? T.lines : ['Not that one!']), true); return; }
      local.score++; Sound().thud(); el.querySelector('.score').textContent = `${local.score} / ${this.goal}`;
      api.note(`${this.goal - local.score} to go.`);
      if (local.score >= this.goal) {
        local.won = true; el.querySelectorAll('.hole').forEach(x => x.classList.remove('up'));
        el.querySelector('.banner').classList.add('show'); Sound().cheer(); Confetti().burst(170); api.finish(T.win);
      }
    },
    act(action, btn, el, local, api, T) { if (action === 'bonk') this.bonk(btn, el, local, api, T); },
  },
};
})();
