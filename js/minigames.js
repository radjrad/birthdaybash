/* ==================================================================
   BIRTHDAY BASH — minigames.js
   Nineteen mini-games. The mechanics never change; a party only supplies
   a "skin" — words and emoji — so a new birthday never needs new code.

   Every skin has the same shape:
     { kind, title, noun, intro, items[], emoji[], lines[], shout, label, win, photo }
   What each field means for each game is written in MINI_CATALOG[].spec
   (that text is also what Claude is given when it writes a skin).

   Every mini has build(T, ctx), init(el, local, api, T, ctx) and either
   step(el, local, T) (one big button) or act(action, btn, el, local, api, T)
   for custom clicks. The api object updates the note / button and
   finishes the screen: api.finish(text, doText, { score, unit }) reports a
   score to the party leaderboard; without a score the game is timed.
   Nobody can lose any of these; you can only be slow.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
BB.esc = esc;
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const Sound = () => BB.Sound, Confetti = () => BB.Confetti;
const CONTINUE = `<button class="btn primary big continue" data-action="next" hidden>Continue →</button>`;
const CARD_COLORS = ['#c0392b', '#2e7d32', '#1e6fb0', '#e67e22', '#8e44ad', '#00897b', '#d9a400', '#5b3a1e'];
const EMO = (e, cls = '') => `<span class="emo ${cls}">${esc(e)}</span>`;
/* the birthday person's face, or an emoji, as a round token */
const faceHTML = (ctx, fallback, cls = 'token') => ctx.heroPhoto ? `<img class="${cls} facepic" src="${esc(ctx.src(ctx.heroPhoto))}" alt="">` : `<span class="${cls} emo">${esc(fallback)}</span>`;
/* a held button or key: onDown / onUp */
function hold(el, local, onDown, onUp, sel) {
  const tgt = sel ? el.querySelector(sel) : el;
  tgt.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => tgt.addEventListener(t, onUp));
  local.onKey = (k) => { if (k === ' ' || k === 'Enter') { if (!local._held) { local._held = true; onDown(); } return true; } return false; };
  local.onKeyUp = (k) => { if ((k === ' ' || k === 'Enter') && local._held) { local._held = false; onUp(); } };
}
/* one rAF loop that stops when the screen is left */
function loop(local, fn) {
  let last = performance.now(); local.alive = true;
  const step = (now) => { if (!local.alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now; fn(dt, now); schedule(); };
  const schedule = () => { if (document.hidden) setTimeout(() => step(performance.now()), 16); else requestAnimationFrame(step); };   /* keep ticking when the page is covered */
  schedule();
  const prev = local.cleanup; local.cleanup = () => { local.alive = false; if (prev) prev(); };
}
const timers = (local) => { local.timers = local.timers || []; const prev = local.cleanup; local.cleanup = () => { local.timers.forEach(clearTimeout); if (prev) prev(); }; return (fn, ms) => { const t = setTimeout(fn, ms); local.timers.push(t); return t; }; };

BB.MINI_CATALOG = [
  { kind:'match', name:'Memory Match', blurb:'Flip cards to find 8 pairs against the clock. Best time is saved.',
    spec:'noun = plural name of the cards ("blue ribbons", "beer cans"). items = exactly 8 short pair labels (max 18 chars each) drawn from the chapter. emoji = 8 emoji, one per label. label = one emoji for the card backs. win = a line that contains {secs}.' },
  { kind:'echo', name:'Repeat After Me', blurb:'Three pads light up in a pattern; play it back. Three rounds, getting longer.',
    spec:'noun = what a pattern is called ("cadence", "order", "combo"). items = 3 pad names (max 10 chars). emoji = 3 emoji, one per pad. lines[0], lines[1] = praise after rounds one and two; lines[2] = the line when they get it wrong. win = line after round three.' },
  { kind:'order', name:'Right Order', blurb:'Five steps, one correct order, no hints. A wrong press resets everything.',
    spec:'items = exactly 5 steps IN THE CORRECT ORDER (max 38 chars each) of some procedure from their life (their morning routine, how they grill, how they tell That One Story). label = gauge caption in caps (max 16 chars, e.g. "GRILL TEMP"). lines[0..3] = progress lines after steps 1-4; lines[4] = the wrong-order line. shout = banner when done. win = closing line.' },
  { kind:'whack', name:'Whack-a-Thing', blurb:'Things pop up in nine holes. Bonk ten of the right ones; leave the decoys alone.',
    spec:'items[0] = plural name of the thing to bonk, items[1] = plural name of the decoy to leave alone. emoji[0] = the thing, emoji[1] = the decoy. lines = 2-3 lines for bonking a decoy. shout = banner when done. win = closing line.' },
  { kind:'brawl', name:'Boss Fight', blurb:'A fighting-game parody against their nemesis: block, dodge, punch when it drops its guard. Three rounds.',
    spec:'items[0] = the nemesis name in caps (their inbox, the HOA, IKEA instructions, the Cardinals offense). items[1..5] = five comic-book hit words. label = the boss body, one of: blob, robot, box, cloud, beast. emoji[0] = the boss face (one emoji drawn on the body), emoji[1] = an accessory it holds (one emoji). lines = 2-3 taunts the boss says when it lands a hit. shout = the K.O. line (max 40 chars). win = closing line.' },
  { kind:'pin', name:'Pin the Thing', blurb:'The thing circles the birthday person\'s photo; drop it on the top of their head. Three tries.', needsPhoto:true,
    spec:'noun = the thing being pinned ("cowboy hat"). emoji[0] = that thing as one emoji. lines = exactly 4: perfect placement, close, too low, way off. label = caption for the side card. photo = id of a clear head-and-shoulders photo of the birthday person.' },
  { kind:'clock', name:'Stop the Clock', blurb:'A needle whips around a dial; stop it in the green zone. Three rounds, the zone shrinks.',
    spec:'noun = what the needle measures ("grill temperature", "the moment to leave a party"). label = dial caption in caps (max 16 chars). items = exactly 3 zone names, one per round (max 14 chars, e.g. "Rare", "Medium", "Well done"). lines[0] = a perfect stop, lines[1] = a near miss, lines[2] = way off. win = closing line that contains {score}.' },
  { kind:'balance', name:'Balance the Tray', blurb:'Keep a wobbling stack from tipping with left/right taps. Three rounds, the stack grows.',
    spec:'noun = the tray ("the tray", "the top bunk", "the car roof"). emoji = 6 emoji for the things stacked, lightest first. lines[0] = what happens when it tips (max 60 chars), lines[1..2] = praise after rounds one and two. win = closing line.' },
  { kind:'popcorn', name:'Popcorn', blurb:'Things pop up from the pan faster and faster; catch each one before it lands. Twenty in all.',
    spec:'noun = plural of the thing popping ("shrimp tacos"). emoji[0] = the thing. lines = 2 lines for a miss. win = closing line that contains {score}.' },
  { kind:'redlight', name:'Red Light, Green Light', blurb:'Hold to run for the finish; let go the instant the lookout turns around. Caught means back to the start.',
    spec:'items[0] = who the lookout is (max 18 chars, "MOM", "THE BOSS", "THE HOA"). emoji[0] = the runner, emoji[1] = the lookout, emoji[2] = the finish line prize. lines = 2-3 lines for getting caught. win = closing line.' },
  { kind:'slice', name:'Cake Slice', blurb:'A knife sweeps back and forth; tap to cut equal slices for everyone. Scored on evenness.',
    spec:'noun = the thing being cut ("the birthday cake", "the last pizza"). emoji[0] = it as one emoji. label = who it is for, in caps (max 16 chars, "FOR 5 GUESTS"). lines[0] = an even cut, lines[1] = an uneven one. win = closing line that contains {score}.' },
  { kind:'balloon', name:'Inflate the Balloon', blurb:'Hold to inflate, let go before it pops. Bigger is better; the pop point is secret. Three rounds.',
    spec:'noun = the thing being inflated ("the pool floatie", "his ego"). emoji[0] = it as one emoji, emoji[1] = the sharp thing it must not touch (a cake with candles, a cactus). lines[0] = it popped, lines[1] = a safe release. win = closing line that contains {score}.' },
  { kind:'missing', name:"Who's Missing?", blurb:'Eight things from a bigger set are shown, the lights go out, one is gone. Which? Six rounds, faster each time.',
    spec:'noun = the group ("the Damn Fools", "the fridge"). items = exactly 16 names (max 12 chars); each round shows 8 of them. emoji = 16 emoji, one per name, all different. lines[0] = right, lines[1] = wrong. win = closing line.' },
  { kind:'shell', name:'Shell Game', blurb:'Their face hides under one of three cups; the cups shuffle. Where did they go? Three rounds, faster.',
    spec:'noun = the cups ("coffee cups", "Solo cups", "hard hats"). emoji[0] = the cup as one emoji, emoji[1] = what hides under it if there is no photo. lines[0] = found, lines[1] = wrong cup. win = closing line.' },
  { kind:'count', name:'Count the Crowd', blurb:'A flash of a crowd, then: how many? Three rounds: one second, two seconds, three seconds, and the crowd grows.',
    spec:'noun = what is being counted ("beer cans on the shelf", "cousins at Thanksgiving"). emoji[0] = the thing counted. lines[0] = right, lines[1] = wrong. win = closing line.' },
  { kind:'draw', name:'Draw It', blurb:'Three rounds of twenty-second drawings: the cake, the birthday person, their favorite thing. In party mode every drawing lands on the TV and the host crowns a winner.',
    spec:'items = exactly 3 drawing prompts, in order: round 1 the birthday cake, round 2 the birthday person, round 3 their favorite thing, each specific to them (max 40 chars, e.g. "Draw Sam\'s famous risotto"). lines[0] = shown while drawing, lines[1] = shown when time is up. win = closing line.' },
  { kind:'scramble', name:'Photo Puzzle', blurb:'A photo of them cut into sixteen pieces and scattered. Put each piece where it belongs, fast.', needsPhoto:true,
    spec:'noun = what got scrambled ("the family photo"). lines[0] = shown while solving. photo = id of a clear photo of them. win = closing line that contains {secs}.' },
  { kind:'flappy', name:'Flappy Them', blurb:'Their face flaps through the gaps. Tap to flap, count the gaps, crash laughing.',
    spec:'emoji[0] = the flyer if there is no photo, emoji[1] = one emoji drawn on the obstacles. items[0] = what the obstacles are (max 18 chars, "deadlines", "cactus"). lines = 2-3 crash lines. win = closing line that contains {score}.' },
];
BB.MINI_KINDS = BB.MINI_CATALOG.map(m => m.kind);

/* A complete, generic skin for each game: what normalize() falls back on, field by field. */
BB.miniDefaults = function (kind, c) {
  const n = c.name, ism = c.ism || 'Classic.';
  const D = {
    match: { title:'Memory Match', noun:'cards', intro:`Turn over two at a time. The clock starts on your first flip.`, items:['Cake', 'Candles', 'Balloons', 'Presents', 'Party Hat', 'Confetti', 'The Card', 'The Speech'], emoji:['🎂', '🕯️', '🎈', '🎁', '🥳', '🎊', '💌', '🎤'], label:'★', win:`All eight pairs in {secs} seconds. ${n} would have done it faster, according to ${n}.` },
    echo: { title:'Repeat After Me', noun:'pattern', intro:'Watch the pads light up, then play it back in order.', items:['Left', 'Middle', 'Right'], emoji:['🥁', '🔔', '🎺'], lines:['Round one. That was the easy one.', 'Round two. Now it gets real.', 'Off the beat. Watch it again.'], win:`Every beat in time. ${n} has never once been this coordinated.` },
    order: { title:'Right Order', noun:'steps', intro:'Five steps. One right order. A wrong press resets the whole thing.', items:['Wake up', 'Coffee', 'More coffee', 'Pretend to check email', 'Announce a plan'], label:'POWER', lines:['Step one confirmed. Four to go.', 'Two down.', 'Three. Momentum.', 'Four. One more.', `BZZT. Wrong order. "${ism}" Start from the top.`], shout:'NAILED IT', win:'Textbook. Nobody has any notes.' },
    whack: { title:'Whack-a-Thing', noun:'things', intro:'Bonk ten of them. Leave the decoys alone.', items:['candles', 'cakes'], emoji:['🕯️', '🎂'], lines:['Not that one!', 'That was the cake. We needed that.', 'Wrong thing. Classic.'], shout:'CLEARED!', win:'Ten for ten. Reflexes of a much younger person.' },
    brawl: { title:'Boss Fight', noun:'fight', intro:'FIGHT!', items:['THE ALARM CLOCK', 'POW!', 'BONK!', 'THWACK!', 'OOF!', 'WHAM!'], emoji:['⏰', '☕'], label:'robot', lines:['beep beep', 'snooze denied', 'rise and shine'], shout:'K.O.! Flawless victory.', win:`${n} does not lose on home turf.` },
    pin: { title:'Pin the Thing', noun:'party hat', intro:'The hat circles. Tap to drop it on the top of their head. Three tries.', emoji:['🥳'], lines:['Perfect fit. Frame it.', 'Close enough. It is a hat, not a helmet.', 'That is a chin-strap situation.', 'That one left the building.'], label:`${n}, now properly dressed for the occasion.`, win:'Hat placed. Party official.' },
    clock: { title:'Stop the Clock', noun:'timing', intro:'Stop the needle inside the green zone. Three rounds; the zone gets smaller.', label:'TIMING', items:['Warm-up', 'For real', 'Expert'], lines:['Dead center. Suspiciously good.', 'Close. The room will allow it.', 'Not even near it. Very on brand.'], win:`{score} out of 300. ${n} has been late to things with better timing than that.` },
    balance: { title:'Balance the Tray', noun:'the tray', intro:'Keep the tray level by tapping the side it is tipping away from, or the tilt buttons. Ten seconds a round; the stack grows.', emoji:['🍺', '🍕', '🎂', '🐈', '📦', '🪴'], lines:['CRASH. Everything on the floor. Keep it level this time.', 'Round one stays up. Adding more.', 'Round two. One more, and it is heavy.'], win:`Three rounds without a drop. ${n} could not do that sober.` },
    popcorn: { title:'Popcorn', noun:'kernels', intro:'Catch each one before it lands. They come faster.', emoji:['🍿'], lines:['Missed one. It is on the floor now.', 'Gone. The dog got it.'], win:`{score} of 20 caught. ${n} would have eaten them mid-air.` },
    redlight: { title:'Red Light, Green Light', noun:'the finish', intro:'Hold to run. Let go the instant the lookout turns around.', items:['THE LOOKOUT'], emoji:['🏃', '👀', '🏁'], lines:['CAUGHT. Back to the start.', 'Busted. Walk of shame.', 'Seen. Every time.'], win:`Made it to the finish. ${n} has been sneaking past people for years.` },
    slice: { title:'Cake Slice', noun:'the birthday cake', intro:'The knife sweeps. Tap to cut. Every slice should be the same size.', emoji:['🎂'], label:'FOR 5 GUESTS', lines:['Even. Nobody complains.', 'That slice is a lot bigger than the others.'], win:`{score}% even. ${n} takes the big one anyway.` },
    balloon: { title:'Inflate the Balloon', noun:'the balloon', intro:'Hold to inflate. The bigger the better, but if it touches the candles it pops. Let go first.', emoji:['🎈', '🎂'], lines:['POP. It touched the candles.', 'Safe. Could have gone bigger?'], win:`Best balloon: {score}%. ${n} always pushes it a little too far.` },
    missing: { title:"Who's Missing?", noun:'the party', intro:'Six rounds. It gets faster.', items:['Cake', 'Candles', 'Balloons', 'Presents', 'Hat', 'Confetti', 'Card', 'Karaoke', 'Pizza', 'Piñata', 'Sparkler', 'Cocktail', 'Camera', 'Speaker', 'Streamers', 'Cupcake'], emoji:['🎂', '🕯️', '🎈', '🎁', '🥳', '🎊', '💌', '🎤', '🍕', '🪅', '🎇', '🍹', '📷', '🔊', '🎀', '🧁'], lines:['Right. Sharp eyes.', 'Wrong one. Look again.'], win:`Six rounds, nothing gets past you. Unlike ${n}, who once lost a car.` },
    shell: { title:'Shell Game', noun:'cups', intro:'Watch the cup. The cups move. Where are they now?', emoji:['🥤', '🙂'], lines:['Found them!', 'Wrong cup.'], win:`Three for three. ${n} cannot hide from you.` },
    count: { title:'Count the Crowd', noun:'people', intro:'The crowd gets bigger, and you get a little longer to look.', emoji:['🧑'], lines:['Exactly right.', 'Off by a bit. Count again.'], win:`Five rounds counted. ${n} still cannot count drinks.` },
    draw: { title:'Draw It', noun:'portrait', intro:'Three rounds, twenty seconds each. Nobody is good at this.', items:['Draw the birthday cake', `Draw ${n}`, `Draw ${n}'s favorite thing`], lines:['Draw!', 'Time. Pencils down.'], win:`Three masterpieces. ${n} will frame them, or say they will.` },
    scramble: { title:'Photo Puzzle', noun:'the photo', intro:'Tap a piece, then tap where it goes. Sixteen pieces.', lines:['Tap a piece, then its spot on the grid.'], win:`Solved in {secs} seconds. ${n} has never once been this together.` },
    flappy: { title:'Flappy Them', noun:'flight', intro:'Tap to flap. Get through as many gaps as you can.', emoji:['🐦', '🚧'], items:['obstacles'], lines:['Crashed. Flew into it face first.', 'Down. Classic landing.', 'Splat.'], win:`{score} gaps. ${n} has flown further after a birthday dinner.` },
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

  /* ---- whack: things pop up in random spots; bonk ten of the right one, leave the decoys ---- */
  whack: {
    goal: 10,
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} the ${T.items[0]}. Leave the ${T.items[1]} alone. Ten to win.`,
    actions: () => CONTINUE,
    build(T) { return `<div class="sidewrap"><div class="whackfield"></div><div class="side"><div class="kicker">Bonked</div><div class="stat huge score">0 / ${this.goal}</div><div class="banner">${esc(T.shout)}</div></div></div>`; },
    init(el, local, api, T) {
      const field = el.querySelector('.whackfield'); const later = timers(local);
      Object.assign(local, { score:0, won:false, live:[] });
      api.note(T.intro);
      const spawn = () => {
        if (local.won) return;
        if (local.live.length < 4) {
          const good = Math.random() < .7, o = { good, dead:false };
          const h = document.createElement('button'); h.type = 'button'; h.className = 'popper emo' + (good ? '' : ' decoy'); h.textContent = good ? (T.emoji[0] || '🕯️') : (T.emoji[1] || '🎂');
          let x, y, tries = 0; do { x = rnd(6, 88); y = rnd(8, 84); tries++; } while (tries < 30 && local.live.some(q => Math.hypot(q.x - x, q.y - y) < 18));
          o.x = x; o.y = y; o.el = h; h.style.left = x + '%'; h.style.top = y + '%';
          h.addEventListener('pointerdown', (e) => { e.preventDefault(); this.bonk(o, el, local, api, T); });
          field.appendChild(h); requestAnimationFrame(() => h.classList.add('up')); local.live.push(o);
          later(() => { if (!o.dead) { o.dead = true; h.classList.remove('up'); setTimeout(() => h.remove(), 200); } local.live = local.live.filter(q => q !== o); }, 1300 - Math.min(500, local.score * 45));
        }
        later(spawn, 420 + Math.random() * 360);
      };
      later(spawn, 500);
      local.onKey = (k) => { if (k !== ' ' && k !== 'Enter') return false; const o = local.live.find(q => q.good && !q.dead); if (o) this.bonk(o, el, local, api, T); return true; };
    },
    bonk(o, el, local, api, T) {
      if (o.dead || local.won) return;
      o.dead = true; o.el.classList.add('bonk'); setTimeout(() => o.el.remove(), 160); local.live = local.live.filter(q => q !== o);
      if (!o.good) { Sound().buzzer(); api.note(pick(T.lines.length ? T.lines : ['Not that one!']), true); return; }
      local.score++; Sound().thud(); el.querySelector('.score').textContent = `${local.score} / ${this.goal}`; api.note(`${this.goal - local.score} to go.`);
      if (local.score >= this.goal) { local.won = true; local.live.forEach(q => q.el.remove()); local.live = []; el.querySelector('.banner').classList.add('show'); Sound().cheer(); Confetti().burst(170); api.finish(T.win); }
    },
  },

  /* ---- brawl: block, dodge, and punch the boss when its guard drops; three rounds ---- */
  brawl: {
    soft: true,
    doText: (T, touch) => touch ? `Move, block and punch. Hit ${T.items[0]} when its guard is down.` : `Arrows move, Down blocks, Space punches. Hit ${T.items[0]} when its guard drops.`,
    actions: () => `<div class="pad"><button class="btn ghostbtn" data-action="left">◀</button><button class="btn ghostbtn" data-action="block">BLOCK</button><button class="btn big" data-action="punch">PUNCH</button><button class="btn ghostbtn" data-action="right">▶</button></div>${CONTINUE}`,
    bodies: {
      blob:  (c) => `<path d="M20 150 q-14 -60 20 -96 q20 -30 60 -18 q40 22 24 78 q-8 40 -104 36z" fill="${c}"/><ellipse cx="60" cy="152" rx="48" ry="8" fill="rgba(0,0,0,.3)"/>`,
      robot: (c) => `<rect x="30" y="20" width="60" height="50" rx="8" fill="${c}"/><rect x="24" y="74" width="72" height="56" rx="10" fill="${c}"/><rect x="6" y="80" width="16" height="44" rx="6" fill="${c}"/><rect x="98" y="80" width="16" height="44" rx="6" fill="${c}"/><rect x="34" y="132" width="20" height="24" fill="${c}"/><rect x="66" y="132" width="20" height="24" fill="${c}"/><line x1="60" y1="20" x2="60" y2="6" stroke="${c}" stroke-width="4"/><circle cx="60" cy="4" r="5" fill="#ff5252"/>`,
      box:   (c) => `<rect x="14" y="30" width="92" height="92" rx="6" fill="${c}"/><path d="M14 30 l14 -14 h92 v92 l-14 14" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="4"/><rect x="30" y="122" width="18" height="30" fill="${c}"/><rect x="72" y="122" width="18" height="30" fill="${c}"/>`,
      cloud: (c) => `<circle cx="40" cy="80" r="30" fill="${c}"/><circle cx="72" cy="66" r="36" fill="${c}"/><circle cx="90" cy="96" r="28" fill="${c}"/><ellipse cx="62" cy="108" rx="52" ry="22" fill="${c}"/><path d="M40 134 l-6 22 M62 138 l0 22 M84 134 l6 22" stroke="#9ec9ff" stroke-width="5" stroke-linecap="round"/>`,
      beast: (c) => `<ellipse cx="60" cy="96" rx="50" ry="52" fill="${c}"/><polygon points="22,58 12,18 44,44" fill="${c}"/><polygon points="98,58 108,18 76,44" fill="${c}"/><rect x="28" y="140" width="22" height="18" rx="6" fill="${c}"/><rect x="70" y="140" width="22" height="18" rx="6" fill="${c}"/><path d="M40 118 q20 14 40 0" stroke="#111" stroke-width="4" fill="none"/><polygon points="46,118 50,130 54,118" fill="#fff"/><polygon points="66,118 70,130 74,118" fill="#fff"/>`,
    },
    build(T, ctx) {
      const p = ctx.palette, body = this.bodies[T.label] || this.bodies.blob;
      const boss = `<svg viewBox="0 0 120 160" class="bossbody">${body(p.accent2)}<text class="emo" x="60" y="86" text-anchor="middle" font-size="42">${esc(T.emoji[0] || '')}</text><text class="emo acc" x="106" y="120" text-anchor="middle" font-size="34">${esc(T.emoji[1] || '')}</text><rect class="shield" x="-4" y="30" width="20" height="100" rx="8" fill="#9ec9ff" opacity="0"/></svg>`;
      const hero = `<svg viewBox="0 0 120 160" class="herobody"><rect x="40" y="120" width="16" height="36" rx="6" fill="#2b2b2b"/><rect x="64" y="120" width="16" height="36" rx="6" fill="#2b2b2b"/><rect x="32" y="60" width="56" height="66" rx="16" fill="${p.accent}"/><g class="arm arm-l"><rect x="12" y="66" width="20" height="50" rx="10" fill="${p.accent}"/><circle cx="22" cy="118" r="12" fill="#c0392b"/></g><g class="arm arm-r"><rect x="88" y="66" width="20" height="50" rx="10" fill="${p.accent}"/><circle cx="98" cy="118" r="12" fill="#c0392b"/></g></svg>${ctx.heroPhoto ? `<img class="face" src="${esc(ctx.src(ctx.heroPhoto))}" alt="">` : `<span class="face emo">🙂</span>`}`;
      return `<div class="arena">
        <div class="hpbar you"><div class="fill" style="width:100%"></div></div><div class="hpname you">${esc(T._name || 'YOU')}</div>
        <div class="hpbar foe"><div class="fill" style="width:100%"></div></div><div class="hpname foe">${esc(T.items[0])}</div>
        <div class="roundtag">Round 1 of 3</div>
        <div class="fighter you">${hero}</div><div class="fighter foe">${boss}</div>
        <div class="bubble"></div><div class="fightmsg">${esc(T.intro || 'FIGHT!')}</div></div>`;
    },
    init(el, local, api, T, ctx) {
      const arena = el.querySelector('.arena'), you = el.querySelector('.fighter.you'), foe = el.querySelector('.fighter.foe'), msg = el.querySelector('.fightmsg');
      const W = () => arena.clientWidth, fw = () => you.clientWidth || 100, range = () => fw() * 1.15;
      const hits = T.items.slice(1).filter(Boolean), taunts = T.lines.filter(Boolean);
      const g = local.g = { px:0, ex:0, pHP:100, eHP:100, round:1, state:'idle', t:1.2, over:false, punching:false, blocking:0, down:0, keys:{}, cool:0 };
      g.px = W() * .16; g.ex = W() * .70;
      const place = () => { you.style.transform = `translateX(${g.px}px)`; foe.style.setProperty('--x', g.ex + 'px'); if (!g.over) foe.style.transform = `translateX(${g.ex}px)`; };
      const bubble = (txt, x) => { const b = el.querySelector('.bubble'); b.textContent = txt; b.style.left = x + 'px'; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); };
      const flash = (txt) => { msg.textContent = txt; msg.classList.remove('show'); void msg.offsetWidth; msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 1100); };
      const hp = () => { el.querySelector('.hpbar.you .fill').style.width = g.pHP + '%'; el.querySelector('.hpbar.foe .fill').style.width = g.eHP + '%'; };
      const setState = (s, t) => { g.state = s; g.t = t; foe.classList.toggle('guard', s === 'guard'); foe.classList.toggle('wind', s === 'wind'); foe.classList.toggle('open', s === 'open'); };
      place(); flash(T.intro || 'FIGHT!'); api.note(ctx.touch ? 'Blue shield = blocked. Wobble = about to swing: block or step back. Stagger = free hits.' : 'Shield up = blocked. Wobble = incoming: block (Down) or step back. Stagger = free hits.');
      g.block = () => { if (!g.over && !g.down) { g.blocking = .7; you.classList.add('blocking'); } };
      g.punch = () => {
        if (g.over || g.down || g.punching) return;
        g.punching = true; you.classList.add('punch'); Sound().blip(); setTimeout(() => { you.classList.remove('punch'); g.punching = false; }, 220);
        if (Math.abs(g.ex - g.px) > range()) return;
        if (g.state === 'guard') { Sound().thud(); bubble('BLOCKED', g.ex); g.px = Math.max(0, g.px - fw() * .5); place(); return; }
        const dmg = g.state === 'open' ? 25 : g.state === 'wind' ? 20 : 10;
        g.eHP = Math.max(0, g.eHP - dmg); hp(); Sound().thud();
        foe.classList.remove('hit'); void foe.offsetWidth; foe.classList.add('hit');
        g.ex = Math.min(W() - fw(), g.ex + 40); bubble(pick(hits.length ? hits : ['POW!']), g.ex + fw() * .1);
        if (g.state === 'wind') setState('open', .9);
        if (g.eHP <= 0) {
          if (g.round >= 3) { g.over = true; foe.classList.add('ko'); Sound().cheer(); Confetti().burst(160); msg.textContent = T.shout; msg.classList.add('show'); api.finish(T.win); return; }
          g.round++; el.querySelector('.roundtag').textContent = `Round ${g.round} of 3`; flash(`ROUND ${g.round}`); Sound().fanfare();
          g.eHP = 100; g.pHP = Math.min(100, g.pHP + 25); hp(); g.ex = W() * .70; setState('idle', 1.4); place();
        }
      };
      loop(local, (dt) => {
        if (g.over) return;
        const speed = 1 + (g.round - 1) * .35;
        if (g.blocking > 0) { g.blocking -= dt; if (g.blocking <= 0) you.classList.remove('blocking'); }
        if (g.down > 0) { g.down -= dt; if (g.down <= 0) { you.classList.remove('down'); g.pHP = 60; hp(); flash('BACK UP'); } place(); return; }
        const sp = W() * .45;
        if (g.keys.ArrowLeft) g.px -= sp * dt; if (g.keys.ArrowRight) g.px += sp * dt;
        g.px = clamp(g.px, 0, W() - fw());
        const d = g.ex - g.px, near = Math.abs(d) <= range();
        g.t -= dt * speed;
        if (g.state === 'idle') {
          if (!near) g.ex -= Math.sign(d) * W() * .14 * speed * dt;     /* closes in */
          if (g.t <= 0) setState(Math.random() < .45 ? 'guard' : 'wind', Math.random() < .45 ? 1.0 : .55);
        } else if (g.state === 'guard') { if (g.t <= 0) setState('idle', rnd(.6, 1.3)); }
        else if (g.state === 'wind') {
          if (g.t <= 0) {                                              /* the swing lands unless you block or step out of range */
            if (near && g.blocking <= 0) { g.pHP = Math.max(0, g.pHP - 18); hp(); you.classList.remove('hit'); void you.offsetWidth; you.classList.add('hit'); bubble(pick(taunts.length ? taunts : ['ha']), g.px + fw() * .2); Sound().wrong(); }
            else if (near) { Sound().blip(); bubble('BLOCKED', g.px + fw() * .2); }
            else bubble('WHIFF', g.ex);
            if (g.pHP <= 0) { g.down = 2.4; you.classList.add('down'); flash('DOWN! 1... 2... 3...'); Sound().buzzer(); }
            setState(g.pHP <= 0 ? 'idle' : 'open', .8);
          }
        } else if (g.state === 'open') { if (g.t <= 0) setState('idle', rnd(.8, 1.6)); }
        place();
      });
      local.onKey = (k) => {
        if (g.over) return false;
        if (k === 'ArrowLeft' || k === 'ArrowRight') { g.keys[k] = true; return true; }
        if (k === 'ArrowDown') { g.block(); return true; }
        if (k === ' ' || k === 'Enter') { g.punch(); return true; }
        return false;
      };
      local.onKeyUp = (k) => { delete g.keys[k]; };
    },
    act(action, btn, el, local) {
      const g = local.g; if (!g || g.over || g.down) return;
      const W = el.querySelector('.arena').clientWidth, fw = el.querySelector('.fighter.you').clientWidth;
      if (action === 'left') g.px = Math.max(0, g.px - W * .12);
      if (action === 'right') g.px = Math.min(W - fw, g.px + W * .12);
      if (action === 'block') g.block();
      if (action === 'punch') g.punch();
    },
  },

  /* ---- pin: the thing circles the photo; drop it on the top of their head; three tries ---- */
  pin: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click or press Space'} to drop the ${T.noun} on ${T._name || 'them'}. Three tries.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      return `<div class="sidewrap"><div class="pin"><img src="${esc(ctx.src(T.photo))}" alt=""><div class="target"></div><div class="thing emo">${esc(T.emoji[0] || '🥳')}</div><div class="ghost emo"></div></div>
        <div class="side"><div class="kicker">Try</div><div class="stat attempt">1 of 3</div><div class="stat huge score">—</div><div class="card"><p>${esc(T.label)}</p></div></div></div>`;
    },
    init(el, local, api, T, ctx) {
      const box = el.querySelector('.pin'), thing = box.querySelector('.thing'), tgt = box.querySelector('.target');
      const target = T.target || { x:.5, y:.2 };
      tgt.style.left = (target.x * 100) + '%'; tgt.style.top = (target.y * 100) + '%';
      Object.assign(local, { n:0, best:0, t:rnd(0, 6), speed:1, dropped:false });
      api.note(T.intro);
      loop(local, (dt) => {
        if (local.dropped) return;
        local.t += dt * local.speed;
        local.hx = .5 + .42 * Math.sin(local.t * 1.3); local.hy = .5 + .42 * Math.sin(local.t * .9 + 1.7);
        thing.style.left = (local.hx * 100) + '%'; thing.style.top = (local.hy * 100) + '%';
      });
      const drop = () => {
        if (local.dropped || local.n >= 3) return;
        local.dropped = true; local.n++; box.classList.add('pinned');
        const r = box.getBoundingClientRect(), dx = (local.hx - target.x) * (r.width / r.height), dy = local.hy - target.y, dist = Math.hypot(dx, dy);
        const pts = Math.round(clamp(100 - dist * 320, 0, 100)); local.best = Math.max(local.best, pts);
        const line = dist < .06 ? T.lines[0] : dist < .14 ? T.lines[1] : (dy > 0 && dist < .34) ? T.lines[2] : T.lines[3];
        el.querySelector('.score').textContent = pts + ' pts';
        if (dist < .06) { Sound().cheer(); Confetti().burst(120); } else if (dist < .14) Sound().chime(); else Sound().wrong();
        const ghost = box.querySelector('.ghost'); ghost.textContent = T.emoji[0] || '🥳'; ghost.style.left = thing.style.left; ghost.style.top = thing.style.top; ghost.classList.add('show');
        if (local.n >= 3) { api.finish(`${line} Best: ${local.best} pts.`, undefined, { score: local.best, unit:'pts' }); return; }
        api.note(line + ` (${local.n} of 3)`); el.querySelector('.attempt').textContent = `${local.n + 1} of 3`;
        setTimeout(() => { if (!local.alive) return; box.classList.remove('pinned'); local.speed += .5; local.dropped = false; }, 1200);
      };
      box.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
      local.onKey = (k) => { if (k === ' ' || k === 'Enter') { drop(); return true; } return false; };
    },
  },

  /* ---- clock: stop the needle in the zone; three rounds, the zone shrinks ---- */
  clock: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click or press Space'} to stop the needle in the green zone.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      let ticks = '';
      for (let k = 0; k < 24; k++) ticks += `<line x1="200" y1="30" x2="200" y2="${k % 6 === 0 ? 52 : 42}" stroke="#fff" stroke-width="4" opacity=".7" transform="rotate(${k * 15} 200 200)"/>`;
      return `<div class="sidewrap"><div class="dialwrap"><svg viewBox="0 0 400 400" class="dial"><circle cx="200" cy="200" r="184" fill="rgba(0,0,0,.55)" stroke="#fff" stroke-width="6"/>
        <path class="zone" d="" fill="#3ddc84" opacity=".85"/>${ticks}<line class="needle" x1="200" y1="200" x2="200" y2="40" stroke="${ctx.palette.accent}" stroke-width="10" stroke-linecap="round"/><circle cx="200" cy="200" r="18" fill="#fff"/>
        <text x="200" y="300" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" opacity=".8">${esc(T.label)}</text></svg></div>
        <div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3 · ${esc(T.items[0])}</div><div class="stat huge score">0</div><div class="pairs">points</div></div></div>`;
    },
    init(el, local, api, T) {
      Object.assign(local, { round:0, angle:0, score:0, stopped:false });
      const zone = el.querySelector('.zone'), needle = el.querySelector('.needle');
      const arc = (c, w) => { const a0 = (c - w / 2 - 90) * Math.PI / 180, a1 = (c + w / 2 - 90) * Math.PI / 180, r = 176; return `M200 200 L${200 + Math.cos(a0) * r} ${200 + Math.sin(a0) * r} A${r} ${r} 0 ${w > 180 ? 1 : 0} 1 ${200 + Math.cos(a1) * r} ${200 + Math.sin(a1) * r} Z`; };
      const start = () => { local.w = [70, 42, 24][local.round]; local.speed = [220, 320, 430][local.round]; local.c = rnd(30, 330); zone.setAttribute('d', arc(local.c, local.w)); local.stopped = false; el.querySelector('.round').textContent = `${local.round + 1} of 3 · ${T.items[local.round]}`; };
      start(); api.note(T.intro);
      loop(local, (dt) => { if (local.stopped) return; local.angle = (local.angle + local.speed * dt) % 360; needle.setAttribute('transform', `rotate(${local.angle.toFixed(2)} 200 200)`); });
      const stop = () => {
        if (local.stopped) return; local.stopped = true;
        let err = Math.abs(local.angle - local.c); err = Math.min(err, 360 - err);
        const half = local.w / 2, pts = err <= half ? Math.round(100 - (err / half) * 30) : Math.round(clamp(60 - (err - half) * 3, 0, 60));
        local.score += pts; el.querySelector('.score').textContent = local.score;
        const line = err <= half * .3 ? T.lines[0] : err <= half * 1.6 ? T.lines[1] : T.lines[2];
        if (err <= half * .3) { Sound().cheer(); Confetti().burst(90); } else if (err <= half) Sound().chime(); else Sound().wrong();
        local.round++;
        if (local.round >= 3) { api.finish(fill(T.win, { score: local.score }), undefined, { score: local.score, unit:'pts' }); return; }
        api.note(`${line} +${pts}`);
        setTimeout(() => { if (local.alive) start(); }, 1100);
      };
      el.querySelector('.dialwrap').addEventListener('pointerdown', (e) => { e.preventDefault(); stop(); });
      local.onKey = (k) => { if (k === ' ' || k === 'Enter') { stop(); return true; } return false; };
    },
  },

  /* ---- balance: keep the stack upright with left/right taps; three rounds, the stack grows ---- */
  balance: {
    doText: (T, touch) => touch ? `Tap the left or right side to keep ${T.noun} level. Ten seconds a round.` : `Left and Right arrows keep ${T.noun} level. Ten seconds a round.`,
    actions: () => `<div class="pad"><button class="btn big" data-action="left">◀ Tilt</button><button class="btn big" data-action="right">Tilt ▶</button></div>${CONTINUE}`,
    build(T) {
      return `<div class="balwrap"><div class="balfield"><div class="stack">${T.emoji.slice(0, 6).map((e, i) => `<span class="emo item" data-i="${i}" hidden>${esc(e)}</span>`).join('')}<div class="tray"></div></div><div class="hand emo">🫴</div></div>
        <div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3</div><div class="stat huge clock">10.0</div><div class="pairs">seconds left</div></div></div>`;
    },
    init(el, local, api, T) {
      const stack = el.querySelector('.stack');
      Object.assign(local, { round:0, theta:0, omega:0, left:10, drift:0, fallen:false });
      const start = () => { local.theta = rnd(-.08, .08); local.omega = 0; local.left = 10; local.fallen = false; el.querySelectorAll('.item').forEach((it, i) => { it.hidden = i >= (local.round + 1) * 2; }); el.querySelector('.round').textContent = `${local.round + 1} of 3`; stack.classList.remove('fall'); };
      start(); api.note(T.intro);
      loop(local, (dt, now) => {
        if (local.fallen || local.done) return;
        local.left -= dt; el.querySelector('.clock').textContent = Math.max(0, local.left).toFixed(1);
        const wob = .6 + local.round * .5;
        local.drift += (Math.sin(now / 900) + Math.sin(now / 370)) * .12 * wob * dt;
        local.omega += (local.theta * 2.2 + local.drift) * dt; local.theta += local.omega * dt;
        stack.style.transform = `rotate(${(local.theta * 57).toFixed(1)}deg)`;
        if (Math.abs(local.theta) > .55) {
          local.fallen = true; stack.classList.add('fall'); Sound().buzzer(); api.note(T.lines[0], true);
          setTimeout(() => { if (local.alive) start(); }, 1400); return;
        }
        if (local.left <= 0) {
          local.round++; Sound().chime();
          if (local.round >= 3) { local.done = true; Sound().cheer(); Confetti().burst(150); api.finish(T.win); return; }
          api.note(T.lines[local.round] || `Round ${local.round} held.`); start();
        }
      });
      local.nudge = (dir) => { if (!local.fallen && !local.done) { local.omega += dir * .55; local.drift *= .5; Sound().blip(); } };
      el.querySelector('.balfield').addEventListener('pointerdown', (e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); local.nudge(e.clientX < r.left + r.width / 2 ? -1 : 1); });
      local.onKey = (k) => { if (k === 'ArrowLeft') { local.nudge(-1); return true; } if (k === 'ArrowRight') { local.nudge(1); return true; } return false; };
    },
    act(action, btn, el, local) { if (action === 'left') local.nudge(-1); if (action === 'right') local.nudge(1); },
  },

  /* ---- popcorn: catch what pops out of the pan before it lands; twenty, faster and faster ---- */
  popcorn: {
    goal: 20,
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} each ${T.emoji[0] || 'one'} before it lands. Twenty of them.`,
    actions: () => CONTINUE,
    build(T) { return `<div class="sidewrap"><div class="popfield"></div><div class="side"><div class="kicker">Caught</div><div class="stat huge score">0 / ${this.goal}</div></div></div>`; },
    init(el, local, api, T) {
      const field = el.querySelector('.popfield'); const later = timers(local);
      Object.assign(local, { spawned:0, caught:0, landed:0, live:[] });
      api.note(T.intro);
      const spawn = () => {
        if (!local.alive || local.spawned >= this.goal) return;
        const k = document.createElement('span'); k.className = 'kernel emo'; k.textContent = T.emoji[0] || '🍿';
        const W = field.clientWidth, H = field.clientHeight;
        const o = { el:k, x: W / 2 + rnd(-W * .1, W * .1), y: H - 30, vx: rnd(-W * .35, W * .35), vy: -rnd(H * 1.25, H * 1.7), dead:false };
        k.addEventListener('pointerdown', (e) => { e.preventDefault(); catchIt(o); });
        field.appendChild(k); local.live.push(o); local.spawned++;
        later(spawn, Math.max(380, 1100 - local.spawned * 38));
      };
      const catchIt = (o) => { if (o.dead) return; o.dead = true; o.el.classList.add('caught'); local.caught++; Sound().blip(); el.querySelector('.score').textContent = `${local.caught} / ${this.goal}`; setTimeout(() => o.el.remove(), 250); check(); };
      const check = () => { if (local.caught + local.landed >= this.goal && !local.done) { local.done = true; Sound().cheer(); Confetti().burst(120); api.finish(fill(T.win, { score: local.caught }), undefined, { score: local.caught, unit:`/ ${this.goal}` }); } };
      later(spawn, 800);
      loop(local, (dt) => {
        const H = field.clientHeight;
        for (const o of local.live) {
          if (o.dead) continue;
          o.vy += H * 2.2 * dt; o.x += o.vx * dt; o.y += o.vy * dt;
          o.el.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.x}deg)`;
          if (o.y > H + 10) { o.dead = true; o.el.remove(); local.landed++; Sound().wrong(); api.note(pick(T.lines)); check(); }
        }
        local.live = local.live.filter(o => !o.dead);
      });
      local.onKey = (k) => { if (k !== ' ' && k !== 'Enter') return false; const top = local.live.filter(o => !o.dead).sort((a, b) => a.y - b.y)[0]; if (top) catchIt(top); return true; };
    },
  },

  /* ---- redlight: hold to run; let go when the lookout turns; caught means back to the start ---- */
  redlight: {
    doText: (T, touch) => `${touch ? 'Hold anywhere on the field' : 'Hold the field or Space'} to run. Let go the instant ${T.items[0]} turns around, or it is back to the start.`,
    actions: () => `<button class="btn big runbtn" type="button">HOLD TO RUN</button>${CONTINUE}`,
    key: (ctx) => `bb-${ctx.partyId}-redlight-best`,
    build(T, ctx) {
      return `<div class="rlwrap"><div class="lookout emo" data-face="away">${esc(T.emoji[1] || '👀')}</div><div class="light"></div><div class="rltimer"><span class="stat clockv">0.0s</span><span class="best"></span></div><div class="track"><div class="finish emo">${esc(T.emoji[2] || '🏁')}</div><div class="runner">${ctx.heroPhoto ? `<img class="runface" src="${esc(ctx.src(ctx.heroPhoto))}" alt=""><span class="legs emo">🏃</span>` : `<span class="emo solo">${esc(T.emoji[0] || '🏃')}</span>`}</div></div><div class="caughtmsg"></div></div>`;
    },
    init(el, local, api, T, ctx) {
      Object.assign(local, { pos:0, held:false, phase:'green', t:rnd(1.4, 3), caught:0, elapsed:0 });
      const key = this.key(ctx); let best = 0; try { best = +localStorage.getItem(key) || 0; } catch (e) {}
      el.querySelector('.best').textContent = best ? `best ${best.toFixed(1)}s` : '';
      const lookout = el.querySelector('.lookout'), light = el.querySelector('.light'), runner = el.querySelector('.runner'), track = el.querySelector('.track'), cm = el.querySelector('.caughtmsg');
      api.note(T.intro);
      const setPhase = (p, t) => { local.phase = p; local.t = t; light.dataset.phase = p; lookout.dataset.face = p === 'red' ? 'watching' : p === 'turning' ? 'turning' : 'away'; if (p === 'red') Sound().thud(); };
      loop(local, (dt) => {
        if (local.done) return;
        local.t -= dt; local.elapsed += dt; el.querySelector('.clockv').textContent = local.elapsed.toFixed(1) + 's';
        if (local.t <= 0) { if (local.phase === 'green') setPhase('turning', .38); else if (local.phase === 'turning') setPhase('red', rnd(1, 2.2)); else setPhase('green', rnd(1.2, 3)); }
        if (local.phase === 'red' && !local.redAt) local.redAt = performance.now();
        if (local.phase !== 'red') local.redAt = 0;
        if (local.held && local.phase === 'red' && performance.now() - local.redAt > 140) {   /* still running while watched: caught (a short grace right after the turn) */
          local.caught++; local.pos = 0; local.held = false;
          Sound().buzzer(); cm.textContent = pick(T.lines); cm.classList.remove('show'); void cm.offsetWidth; cm.classList.add('show'); api.note(pick(T.lines), true);
        } else if (local.held && local.phase !== 'red') { local.pos += .16 * dt; runner.classList.add('go'); }
        else runner.classList.remove('go');
        runner.style.left = (local.pos * (track.clientWidth - runner.clientWidth - 8)) + 'px';
        if (local.pos >= 1) {
          local.done = true; runner.classList.add('win'); Sound().cheer(); Confetti().burst(150);
          const secs = +local.elapsed.toFixed(1); let rec = '';
          if (!best || secs < best) { try { localStorage.setItem(key, String(secs)); } catch (e) {} rec = ` New fastest time: ${secs}s!`; el.querySelector('.best').textContent = `best ${secs}s`; }
          api.finish(`${T.win} ${secs}s${local.caught ? `, caught ${local.caught} time${local.caught > 1 ? 's' : ''}.` : ', never caught.'}${rec}`, 'Press Continue, or replay for a faster time.');
        }
      });
      hold(el, local, () => { local.held = true; }, () => { local.held = false; }, '.runbtn');
      const rl = el.querySelector('.rlwrap'); rl.addEventListener('pointerdown', (e) => { e.preventDefault(); local.held = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => rl.addEventListener(t, () => { local.held = false; }));
    },
  },

  /* ---- slice: the knife sweeps; tap to cut; equal slices for everyone ---- */
  slice: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click or press Space'} to cut ${T.noun} into equal slices.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      const candles = Array.from({ length: 7 }, (_, i) => `<span class="candle" style="left:${8 + i * 14}%"></span>`).join('');
      return `<div class="sidewrap"><div class="cakewrap"><div class="cake"><div class="candles">${candles}</div><div class="frosting"><div class="sprinkles"></div></div><div class="cakeside"></div><div class="slices"></div><div class="knife emo">🔪</div></div></div>
        <div class="side"><div class="kicker">${esc(T.label)}</div><div class="stat huge cuts">0 cuts</div></div></div>`;
    },
    init(el, local, api, T) {
      const N = clamp(parseInt((T.label.match(/\d+/) || [5])[0], 10) || 5, 3, 8), cake = el.querySelector('.cake'), knife = el.querySelector('.knife');
      Object.assign(local, { x:0, dir:1, cuts:[] });
      api.note(`${T.intro} ${N} slices, ${N - 1} cuts.`);
      loop(local, (dt) => { if (local.done) return; local.x += local.dir * .55 * dt; if (local.x > 1) { local.x = 1; local.dir = -1; } if (local.x < 0) { local.x = 0; local.dir = 1; } knife.style.left = (local.x * 100) + '%'; });
      const cut = () => {
        if (local.done) return;
        const x = local.x; local.cuts.push(x); Sound().thud();
        const line = document.createElement('div'); line.className = 'cutline'; line.style.left = (x * 100) + '%'; cake.querySelector('.slices').appendChild(line);
        el.querySelector('.cuts').textContent = `${local.cuts.length} cut${local.cuts.length > 1 ? 's' : ''}`;
        if (local.cuts.length < N - 1) return;
        local.done = true;
        const xs = [0, ...local.cuts.sort((a, b) => a - b), 1], ideal = 1 / N;
        let err = 0; for (let i = 1; i < xs.length; i++) err += Math.abs((xs[i] - xs[i - 1]) - ideal);
        const score = Math.round(clamp(100 - (err / (N - 1)) / ideal * 100, 0, 100));
        const sl = cake.querySelector('.slices'); for (let i = 1; i < xs.length; i++) { const d = document.createElement('div'); d.className = 'slicebit'; d.style.left = (xs[i - 1] * 100) + '%'; d.style.width = ((xs[i] - xs[i - 1]) * 100) + '%'; d.style.transform = `translateY(${(i % 2 ? -1 : 1) * .5}rem)`; sl.appendChild(d); }
        if (score >= 85) { Sound().cheer(); Confetti().burst(130); } else Sound().chime();
        api.finish(`${score >= 70 ? T.lines[0] : T.lines[1]} ${fill(T.win, { score })}`, undefined, { score, unit:'% even' });
      };
      el.querySelector('.cakewrap').addEventListener('pointerdown', (e) => { e.preventDefault(); cut(); });
      local.onKey = (k) => { if (k === ' ' || k === 'Enter') { cut(); return true; } return false; };
    },
  },

  /* ---- balloon: hold to inflate, let go before it pops; the pop point is secret; three rounds ---- */
  balloon: {
    doText: (T, touch) => `${touch ? 'Hold the button' : 'Hold Space'} to inflate ${T.noun}. Let go before it pops.`,
    actions: () => `<button class="btn big runbtn" type="button">HOLD TO INFLATE</button>${CONTINUE}`,
    build(T) { return `<div class="sidewrap"><div class="balloonfield"><span class="balloon emo">${esc(T.emoji[0] || '🎈')}</span><div class="pop">💥</div><span class="hazard emo">${esc(T.emoji[1] || '🎂')}</span></div><div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3</div><div class="stat huge size">—</div><div class="pairs best">best —</div></div></div>`; },
    init(el, local, api, T) {
      Object.assign(local, { round:0, size:0, held:false, best:0, busy:false });
      const b = el.querySelector('.balloon'), sizeEl = el.querySelector('.size');
      const hz = el.querySelector('.hazard'), field = el.querySelector('.balloonfield');
      const start = () => { local.size = 0; local.busy = false; b.classList.remove('gone'); el.querySelector('.pop').classList.remove('show'); el.querySelector('.round').textContent = `${local.round + 1} of 3`; sizeEl.textContent = '—'; b.style.transform = 'scale(.6)'; hz.style.right = rnd(4, 22).toFixed(0) + '%'; local.startRight = null; };
      const edges = () => { const br = b.getBoundingClientRect(), hr = hz.getBoundingClientRect(); return { right: br.right, cake: hr.left }; };
      start(); api.note(T.intro);
      const settle = (popped) => {
        local.busy = true; local.held = false;
        const e = edges(), got = popped ? 0 : Math.round(clamp((e.right - local.startRight) / (e.cake - local.startRight) * 100, 0, 100)); local.best = Math.max(local.best, got);
        sizeEl.textContent = popped ? 'POP' : got + '%'; el.querySelector('.best').textContent = `best ${local.best}%`;
        if (popped) { b.classList.add('gone'); el.querySelector('.pop').classList.add('show'); Sound().buzzer(); api.note(T.lines[0], true); } else { Sound().chime(); api.note(`${T.lines[1]} ${got}%.`); }
        local.round++;
        if (local.round >= 3) { setTimeout(() => { if (local.alive) { Confetti().burst(120); api.finish(fill(T.win, { score: local.best }), undefined, { score: local.best, unit:'%' }); } }, 900); return; }
        setTimeout(() => { if (local.alive) start(); }, 1300);
      };
      loop(local, (dt) => {
        if (local.busy) return;
        if (local.startRight === null) local.startRight = edges().right;
        if (local.held) { local.size += 24 * dt; b.style.transform = `scale(${(.6 + local.size / 100 * 4.2).toFixed(2)})`; if (edges().right >= edges().cake) { settle(true); return; } }   /* touching the candles pops it */
      });
      hold(el, local, () => { if (!local.busy) { local.held = true; local.wasHeld = true; } }, () => { if (local.held && !local.busy) settle(false); local.held = false; }, '.runbtn');
    },
  },

  /* ---- missing: eight things, lights out, one is gone; six rounds ---- */
  missing: {
    doText: (T, touch) => `Memorize the eight. The lights go out, one disappears: ${touch ? 'tap' : 'click'} which.`,
    actions: () => CONTINUE,
    build(T) { return `<div class="sidewrap"><div class="memgrid"></div>
      <div class="side"><div class="kicker">Round</div><div class="stat round">1 of 6</div><div class="choices"></div></div></div>`; },
    init(el, local, api, T) {
      const grid = el.querySelector('.memgrid'), choices = el.querySelector('.choices'); const later = timers(local);
      Object.assign(local, { round:0, phase:'show' });
      const pool = [...Array(Math.min(T.items.length, T.emoji.length)).keys()];
      const show = () => {
        local.phase = 'show'; choices.innerHTML = ''; grid.classList.remove('dark');
        local.board = shuffle(pool).slice(0, 8);            /* eight from the bigger set, new every round */
        grid.innerHTML = local.board.map(i => `<div class="memcell" data-i="${i}"><span class="emo">${esc(T.emoji[i] || '')}</span><span class="nm">${esc(T.items[i])}</span></div>`).join('');
        el.querySelector('.round').textContent = `${local.round + 1} of 6`; api.note('Memorize...');
        later(() => { grid.classList.add('dark'); local.phase = 'dark'; }, Math.max(1100, 2400 - local.round * 260));
        later(() => {
          local.gone = pick(local.board); grid.querySelector(`.memcell[data-i="${local.gone}"]`).hidden = true; grid.classList.remove('dark'); local.phase = 'ask';
          const offBoard = pool.filter(i => !local.board.includes(i));       /* decoys are never things still on the board */
          const opts = shuffle([local.gone, ...shuffle(offBoard).slice(0, 3)]);
          choices.innerHTML = `<div class="kicker">Who is missing?</div>` + opts.map(i => `<button class="btn opt" data-action="guess" data-i="${i}" type="button"><span class="num">${T.emoji[i] ? esc(T.emoji[i]) : ''}</span><span class="lbl">${esc(T.items[i])}</span></button>`).join('');
          api.note('Who is missing?');
        }, Math.max(1100, 2400 - local.round * 260) + 800);
      };
      show();
      local.guess = (i, btn) => {
        if (local.phase !== 'ask') return;
        if (i === local.gone) {
          Sound().chime(); local.round++; local.phase = 'show';
          if (local.round >= 6) { Confetti().burst(140); Sound().cheer(); api.finish(T.win); return; }
          api.note(T.lines[0]); later(show, 700);
        } else { Sound().wrong(); btn.disabled = true; btn.classList.add('wrong'); api.note(T.lines[1]); }
      };
    },
    act(action, btn, el, local) { if (action === 'guess') local.guess(+btn.dataset.i, btn); },
  },

  /* ---- shell: their face under a cup; the cups shuffle; three rounds, faster ---- */
  shell: {
    doText: (T, touch) => `Watch which ${T.noun.replace(/s$/, '')} hides them, follow the shuffle, then ${touch ? 'tap' : 'click or press 1-3 on'} the right one.`,
    actions: () => CONTINUE,
    build(T, ctx) { return `<div class="sidewrap"><div class="shellfield">${[0, 1, 2].map(i => `<div class="cup" data-i="${i}"><span class="emo cupemo">${esc(T.emoji[0] || '🥤')}</span><div class="under">${faceHTML(ctx, T.emoji[1] || '🙂', 'tokenpic')}</div></div>`).join('')}</div>
      <div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3</div></div></div>`; },
    init(el, local, api, T) {
      const cups = [...el.querySelectorAll('.cup')]; const later = timers(local);
      Object.assign(local, { round:0, pos:[0, 1, 2], phase:'wait' });   /* pos[cupIndex] = slot */
      const place = (ms) => cups.forEach((c, i) => { c.style.transition = `transform ${ms}ms ease-in-out`; c.style.transform = `translateX(${(local.pos[i] - i) * 100}%)`; });
      const start = () => {
        local.phase = 'wait'; local.pos = [0, 1, 2]; local.ball = Math.floor(Math.random() * 3); place(0);
        cups.forEach((c, i) => { c.classList.remove('up', 'wrong'); c.querySelector('.under').hidden = i !== local.ball; });
        el.querySelector('.round').textContent = `${local.round + 1} of 3`;
        api.note('Watch...'); cups[local.ball].classList.add('up');
        later(() => { cups[local.ball].classList.remove('up'); later(swaps, 500); }, 1300);
      };
      const swaps = () => {
        local.phase = 'shuffle'; const n = 4 + local.round * 3, ms = Math.max(240, 520 - local.round * 120); let k = 0;
        const one = () => {
          if (k++ >= n) { local.phase = 'ask'; api.note('Where are they?'); return; }
          const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 3); if (b === a) b = (a + 1) % 3;
          const ia = local.pos.indexOf(a), ib = local.pos.indexOf(b); local.pos[ia] = b; local.pos[ib] = a; place(ms); Sound().blip();
          later(one, ms + 60);
        };
        one();
      };
      start();
      local.pickSlot = (slot) => {
        if (local.phase !== 'ask') return;
        const cup = local.pos.indexOf(slot); cups[cup].classList.add('up');
        if (cup === local.ball) {
          local.phase = 'wait'; Sound().chime(); local.round++;
          if (local.round >= 3) { Sound().cheer(); Confetti().burst(140); api.finish(T.win); return; }
          api.note(T.lines[0]); later(start, 1100);
        } else { local.phase = 'wait'; cups[cup].classList.add('wrong'); cups[local.ball].classList.add('up'); Sound().wrong(); api.note(T.lines[1] + ' Again.'); later(start, 1400); }
      };
      el.querySelector('.shellfield').addEventListener('pointerdown', (e) => { const c = e.target.closest('.cup'); if (!c) return; e.preventDefault(); local.pickSlot(local.pos[+c.dataset.i]); });
      local.onKey = (k) => { if (/^[1-3]$/.test(k)) { local.pickSlot(+k - 1); return true; } return false; };
    },
  },

  /* ---- count: a one-second flash of a crowd; how many? five rounds ---- */
  count: {
    doText: (T) => `Count the ${T.noun} before they vanish, then pick the number. One second, then two, then three.`,
    actions: () => CONTINUE,
    build(T) { return `<div class="sidewrap"><div class="countfield"><div class="flashwrap"></div><div class="opts n4 countopts"></div></div><div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3</div><div class="pairs secs">1 second</div></div></div>`; },
    init(el, local, api, T) {
      const wrap = el.querySelector('.flashwrap'), opts = el.querySelector('.countopts'); const later = timers(local);
      Object.assign(local, { round:0, phase:'wait' });
      const show = () => {
        const [lo, hi] = [[4, 9], [10, 20], [18, 40]][local.round];
        local.n = lo + Math.floor(rnd(0, hi - lo + 1)); opts.innerHTML = ''; wrap.innerHTML = '';
        const W = wrap.clientWidth, H = wrap.clientHeight, pts = [];
        for (let i = 0; i < local.n; i++) { let p, tries = 0; do { p = [rnd(6, 94), rnd(8, 88)]; tries++; } while (tries < 40 && pts.some(q => Math.hypot(q[0] - p[0], (q[1] - p[1]) * H / W) < 7)); pts.push(p); wrap.insertAdjacentHTML('beforeend', `<span class="emo cnt" style="left:${p[0]}%;top:${p[1]}%">${esc(T.emoji[0] || '🧑')}</span>`); }
        el.querySelector('.round').textContent = `${local.round + 1} of 3`; el.querySelector('.secs').textContent = `${local.round + 1} second${local.round ? 's' : ''}`; api.note('Look!'); local.phase = 'show';
        later(() => {
          wrap.innerHTML = ''; local.phase = 'ask'; api.note('How many?');
          const spread = 2 + local.round * 3, cands = new Set([local.n]); while (cands.size < 4) { const v = local.n + Math.round(rnd(-spread, spread)); if (v >= 1 && v !== local.n) cands.add(v); }
          opts.innerHTML = shuffle([...cands]).map(v => `<button class="btn opt" data-action="guess" data-v="${v}" type="button"><span class="lbl">${v}</span></button>`).join('');
        }, 1000 * (local.round + 1));
      };
      later(show, 900); api.note(T.intro);
      local.guess = (v, btn) => {
        if (local.phase !== 'ask') return;
        if (v === local.n) { Sound().chime(); local.round++; local.phase = 'wait'; if (local.round >= 3) { Sound().cheer(); Confetti().burst(140); api.finish(T.win); return; } api.note(T.lines[0]); later(show, 800); }
        else { Sound().wrong(); btn.disabled = true; btn.classList.add('wrong'); api.note(T.lines[1]); }
      };
    },
    act(action, btn, el, local) { if (action === 'guess') local.guess(+btn.dataset.v, btn); },
  },

  /* ---- draw: three twenty-second rounds; in party mode every drawing lands on the host screen ---- */
  draw: {
    doText: (T, touch) => `${touch ? 'Draw with a finger' : 'Draw with the mouse'}. Three rounds, twenty seconds each: ${T.items.join('; ')}.`,
    actions: () => `<button class="btn big" data-action="done">Done</button>${CONTINUE}`,
    colors: (p) => ['#ffffff', '#111111', '#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e84393', '#8d5524', '#f5cba7', p.accent],
    build(T, ctx) {
      return `<div class="drawwrap"><div class="drawside"><div class="prompt"></div><canvas class="sketch" width="360" height="360"></canvas><div class="swatches">${this.colors(ctx.palette).map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-action="color" data-c="${c}" style="background:${c}" type="button"></button>`).join('')}<button class="sw clear" data-action="clear" type="button">↺</button></div></div>
        <div class="side"><div class="kicker">Round</div><div class="stat round">1 of 3</div><div class="stat huge clock">20</div>${ctx.heroPhoto ? `<img class="refpic" src="${esc(ctx.src(ctx.heroPhoto))}" alt="">` : ''}<div class="strip"></div></div>
        <div class="gallery" hidden></div></div>`;
    },
    init(el, local, api, T, ctx) {
      const cv = el.querySelector('.sketch'), cx = cv.getContext('2d'); cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.lineWidth = 7;
      Object.assign(local, { round:0, left:20, drawing:false, done:false, color:'#ffffff', pics:[] });
      const clear = () => { cx.fillStyle = '#1b2233'; cx.fillRect(0, 0, 360, 360); cx.strokeStyle = local.color; };
      const startRound = () => { local.left = 20; local.done = false; clear(); el.querySelector('.prompt').textContent = T.items[local.round]; el.querySelector('.round').textContent = `${local.round + 1} of 3`; el.querySelectorAll('[data-action="done"], .swatches').forEach(b => b.hidden = false); api.note(`${T.items[local.round]}. ${T.lines[0] || 'Draw!'}`); if (ctx.mp) { ctx.mp.onGallery = local.gallery; ctx.mp.requestGallery(local.round + 1); } };
      const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 360 / r.width, (e.clientY - r.top) * 360 / r.height]; };
      cv.addEventListener('pointerdown', (e) => { if (local.done) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); local.drawing = true; const [x, y] = pt(e); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + .1, y); cx.stroke(); });
      cv.addEventListener('pointermove', (e) => { if (!local.drawing || local.done) return; const [x, y] = pt(e); cx.lineTo(x, y); cx.stroke(); });
      ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { local.drawing = false; }));
      loop(local, (dt) => { if (local.done || local.finished) return; local.left -= dt; el.querySelector('.clock').textContent = Math.max(0, Math.ceil(local.left)); if (local.left <= 0) local.finish(); });
      local.finish = () => {
        if (local.done) return; local.done = true; Sound().chime(); el.querySelectorAll('[data-action="done"], .swatches').forEach(b => b.hidden = true);
        const png = cv.toDataURL('image/png'); local.pics.push(png);
        el.querySelector('.strip').insertAdjacentHTML('beforeend', `<img class="thumb" src="${png}" alt="">`);
        if (ctx.mp && ctx.mp.role) ctx.mp.drawing(png, local.round + 1);
        local.round++;
        if (local.round >= 3) { local.finished = true; Confetti().burst(120); api.finish(`${T.lines[1]} ${T.win}${ctx.mp && ctx.mp.role === 'host' ? ' Tap a drawing below to crown it.' : ''}`); return; }
        api.note(`${T.lines[1]} Next up: ${T.items[local.round]}.`);
        setTimeout(() => { if (local.alive) startRound(); }, 2200);
      };
      if (ctx.mp) {
        const gal = el.querySelector('.gallery');
        local.gallery = (rows, crown, sid) => {
          gal.hidden = false; const round = +(String(sid).split('-r')[1] || 1);
          gal.innerHTML = `<div class="kicker">Round ${round}: ${esc(T.items[round - 1] || '')}${crown ? ` · winner: ${esc(crown)}` : ''}</div><div class="galrow">${Object.entries(rows).map(([k, v]) => `<figure class="galpic ${crown === v.name ? 'crowned' : ''}" data-action="crown" data-k="${esc(k)}" data-r="${round}"><img src="${esc(v.png)}" alt=""><figcaption>${esc(v.name)}</figcaption></figure>`).join('')}</div>`;
        };
      }
      startRound();
    },
    act(action, btn, el, local, api, T, ctx) {
      if (action === 'done') local.finish();
      if (action === 'color') { local.color = btn.dataset.c; el.querySelector('.sketch').getContext('2d').strokeStyle = local.color; el.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s === btn)); }
      if (action === 'clear') { const cx = el.querySelector('.sketch').getContext('2d'); cx.fillStyle = '#1b2233'; cx.fillRect(0, 0, 360, 360); }
      if (action === 'crown' && ctx.mp && ctx.mp.role === 'host') ctx.mp.crown(btn.dataset.k, +btn.dataset.r);
    },
  },

  /* ---- scramble: sixteen pieces of their photo, scattered; tap a piece, then its spot ---- */
  scramble: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click'} a piece, then ${touch ? 'tap' : 'click'} the spot on the grid where it belongs. Rebuild ${T.noun}.`,
    actions: () => CONTINUE,
    build(T, ctx) {
      return `<div class="jigwrap"><div class="pile"></div><div class="jiggrid">${[...Array(16).keys()].map(i => `<div class="slot" data-s="${i}"></div>`).join('')}</div>
        <div class="side"><div class="kicker">Time</div><div class="stat huge timer">0 s</div><div class="pairs placed">0 of 16</div></div></div>`;
    },
    init(el, local, api, T, ctx) {
      const pile = el.querySelector('.pile'), grid = el.querySelector('.jiggrid');
      Object.assign(local, { sel:null, placed:0, t0:null });
      api.note(T.lines[0] || T.intro);
      const img = new Image(); img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2, P = 96;   /* centre square, 16 pieces of 96px */
        shuffle([...Array(16).keys()]).forEach(i => {
          const c = document.createElement('canvas'); c.width = P; c.height = P; c.className = 'piece'; c.dataset.i = i; c.style.setProperty('--r', rnd(-14, 14).toFixed(0) + 'deg');
          c.getContext('2d').drawImage(img, sx + (i % 4) * side / 4, sy + Math.floor(i / 4) * side / 4, side / 4, side / 4, 0, 0, P, P);
          c.addEventListener('pointerdown', (e) => { e.preventDefault(); if (c.classList.contains('in')) return; if (!local.t0) local.t0 = performance.now(); pile.querySelectorAll('.piece.sel').forEach(p => p.classList.remove('sel')); local.sel = c; c.classList.add('sel'); Sound().blip(); });
          pile.appendChild(c);
        });
      };
      img.onerror = () => api.note('That photo could not be loaded.'); img.src = ctx.src(T.photo || ctx.heroPhoto);
      grid.addEventListener('pointerdown', (e) => {
        const slot = e.target.closest('.slot'); if (!slot || !local.sel || slot.classList.contains('full')) return; e.preventDefault();
        if (+slot.dataset.s !== +local.sel.dataset.i) { Sound().wrong(); slot.classList.remove('nope'); void slot.offsetWidth; slot.classList.add('nope'); return; }
        slot.appendChild(local.sel); local.sel.classList.remove('sel'); local.sel.classList.add('in'); slot.classList.add('full'); local.sel = null; local.placed++; Sound().blip();
        el.querySelector('.placed').textContent = `${local.placed} of 16`;
        if (local.placed >= 16) { local.done = true; grid.classList.add('solved'); const secs = Math.max(1, Math.round((performance.now() - local.t0) / 1000)); el.querySelector('.timer').textContent = secs + ' s'; Sound().cheer(); Confetti().burst(150); api.finish(fill(T.win, { secs })); }
      });
      local.timer = setInterval(() => { if (local.t0 && !local.done) el.querySelector('.timer').textContent = Math.floor((performance.now() - local.t0) / 1000) + ' s'; }, 200); local.cleanup = () => clearInterval(local.timer);
    },
  },

  /* ---- flappy: their face flaps through the gaps; score is gaps passed ---- */
  flappy: {
    doText: (T, touch) => `${touch ? 'Tap' : 'Click or press Space'} to flap. Get through the ${T.items[0] || 'gaps'}.`,
    actions: () => `<button class="btn ghostbtn" data-action="again" hidden>Fly again</button>${CONTINUE}`,
    build(T, ctx) { return `<div class="sidewrap"><div class="sky"><div class="bird">${faceHTML(ctx, T.emoji[0] || '🐦', 'birdpic')}</div><div class="pipes"></div><div class="tapmsg">${ctx.touch ? 'Tap to start' : 'Click or Space to start'}</div></div><div class="side"><div class="kicker">Gaps</div><div class="stat huge score">0</div><div class="pairs best"></div></div></div>`; },
    init(el, local, api, T, ctx) {
      const sky = el.querySelector('.sky'), bird = el.querySelector('.bird'), pipes = el.querySelector('.pipes');
      const reset = () => { Object.assign(local, { y:.45, vy:0, flying:false, dead:false, score:0, dist:0, list:[] }); pipes.innerHTML = ''; bird.style.transform = ''; el.querySelector('.score').textContent = '0'; el.querySelector('.tapmsg').hidden = false; el.querySelectorAll('[data-action="again"], .continue').forEach(b => b.hidden = true); api.reset(T.intro, this.doText(T, ctx.touch)); };
      reset(); local.best = 0;
      const flap = () => { if (local.dead) return; if (!local.flying) { local.flying = true; el.querySelector('.tapmsg').hidden = true; } local.vy = -.62; Sound().blip(); };
      const addPipe = () => { const gapY = rnd(.22, .78), gap = .3; const p = document.createElement('div'); p.className = 'pipe'; p.innerHTML = `<div class="top" style="height:${(gapY - gap / 2) * 100}%"><span class="emo">${esc(T.emoji[1] || '')}</span></div><div class="bot" style="top:${(gapY + gap / 2) * 100}%"><span class="emo">${esc(T.emoji[1] || '')}</span></div>`; pipes.appendChild(p); local.list.push({ el:p, x:1.05, gapY, gap, passed:false }); };
      loop(local, (dt) => {
        if (!local.flying || local.dead) return;
        local.vy += 1.9 * dt; local.y += local.vy * dt; local.dist += dt;
        bird.style.top = (local.y * 100) + '%'; bird.style.transform = `rotate(${clamp(local.vy * 60, -25, 70)}deg)`;
        if (local.list.length === 0 || local.list[local.list.length - 1].x < .55) addPipe();
        const H = sky.clientHeight, W = sky.clientWidth, bw = bird.clientWidth / W, bh = bird.clientHeight / H, bx = .22;
        for (const p of local.list) {
          p.x -= .36 * dt; p.el.style.left = (p.x * 100) + '%';
          const pw = 64 / W;
          if (!p.passed && p.x + pw < bx) { p.passed = true; local.score++; el.querySelector('.score').textContent = local.score; Sound().chime(); }
          const overlapX = bx + bw * .8 > p.x && bx + bw * .2 < p.x + pw;
          if (overlapX && (local.y + bh * .2 < p.gapY - p.gap / 2 || local.y + bh * .8 > p.gapY + p.gap / 2)) local.dead = true;
        }
        local.list = local.list.filter(p => { if (p.x < -.2) { p.el.remove(); return false; } return true; });
        if (local.y > 1 - bh || local.y < 0) local.dead = true;
        if (local.dead) {
          Sound().buzzer(); bird.classList.add('crash'); local.best = Math.max(local.best, local.score); el.querySelector('.best').textContent = `best ${local.best}`;
          if (local.score >= 3) Confetti().burst(80);
          api.finish(`${pick(T.lines)} ${fill(T.win, { score: local.score })}`, 'Press Continue, or fly again.', { score: local.best, unit:'gaps' });
          el.querySelectorAll('[data-action="again"]').forEach(b => b.hidden = false);
        }
      });
      sky.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
      local.onKey = (k) => { if (k === ' ' || k === 'Enter') { if (local.dead) return false; flap(); return true; } return false; };
      local.again = () => { bird.classList.remove('crash'); reset(); };
    },
    act(action, btn, el, local) { if (action === 'again') local.again(); },
  },
};
})();
