/* ==================================================================
   BIRTHDAY BASH — scenes.js
   Layered SVG backdrops (far / mid / near) for parallax, plus badges.
   A chapter's backdrop is either three Claude-made layers (sanitized
   here before they touch the DOM) or one of the procedural presets
   below, tinted with the chapter's palette.
   ================================================================== */
(() => {
'use strict';
const BB = window.BB = window.BB || {};

function rng(seed) { let s = seed || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const L = (inner) => `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;

/* ---------- color helpers ---------- */
function hex(c) {
  c = String(c || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + c.slice(1).split('').map(x => x + x).join('');
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null;
}
function rgb(c) { const h = hex(c) || '#888888'; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
const dark = (c, t = .3) => mix(c, '#000000', t);
const light = (c, t = .3) => mix(c, '#ffffff', t);
function luminance(c) { const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
BB.color = { hex, mix, dark, light, luminance, contrast };

/* ---------- procedural presets: (palette, seed) => [far, mid, near] ---------- */
const sky = (p, id, top, bottom) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#${id})"/>`;
function stars(r, n, maxY) { let s = ''; for (let i = 0; i < n; i++) s += `<circle class="tw" style="animation-delay:-${(r() * 3).toFixed(1)}s" cx="${(r() * 1920).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${(1 + r() * 2).toFixed(1)}" fill="#fff"/>`; return s; }
function clouds(r, n, col) { let s = ''; for (let i = 0; i < n; i++) { const x = r() * 1920, y = 90 + r() * 220, k = .7 + r() * .8; s += `<g class="drift" style="animation-delay:-${(r() * 18).toFixed(1)}s"><g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${k.toFixed(2)})" fill="${col}" opacity=".8"><ellipse cx="0" cy="0" rx="90" ry="34"/><ellipse cx="-50" cy="8" rx="50" ry="26"/><ellipse cx="55" cy="6" rx="60" ry="30"/></g></g>`; } return s; }
function bunting(r, y, cols) { let s = `<path d="M0 ${y} Q960 ${y + 120} 1920 ${y}" stroke="rgba(255,255,255,.7)" stroke-width="4" fill="none"/>`; for (let i = 0; i < 16; i++) { const t = (i + .5) / 16, x = t * 1920, yy = y + 4 * 120 * t * (1 - t) / 2; s += `<polygon class="swing" style="animation-delay:-${(r() * 3).toFixed(1)}s" points="${x - 34},${yy} ${x + 34},${yy} ${x},${yy + 84}" fill="${cols[i % cols.length]}"/>`; } return s; }
function balloons(r, n, cols) { let s = ''; for (let i = 0; i < n; i++) { const x = 100 + r() * 1720, y = 250 + r() * 420, c = cols[i % cols.length]; s += `<g class="floaty" style="animation-delay:-${(r() * 5).toFixed(1)}s"><path d="M${x} ${y + 70} q14 60 -6 130 q-16 60 6 120" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="56" ry="70" fill="${c}"/><ellipse cx="${x - 18}" cy="${y - 24}" rx="12" ry="20" fill="#fff" opacity=".35"/><polygon points="${x - 9},${y + 68} ${x + 9},${y + 68} ${x},${y + 82}" fill="${c}"/></g>`; } return s; }

const PRESETS = {
  /* rolling countryside, a sun, a fence */
  hills(p, seed) {
    const r = rng(seed), id = 'skH' + seed;
    let tufts = '';
    for (let i = 0; i < 26; i++) { const x = r() * 1920, h = 120 + r() * 160; tufts += `<g class="swing" style="animation-delay:-${(r() * 3).toFixed(1)}s"><path d="M${x} 1080 q-10 -${h * .6} -30 -${h} M${x} 1080 q0 -${h * .7} 8 -${h * 1.1} M${x} 1080 q14 -${h * .5} 36 -${h * .9}" stroke="${dark(p.bg2, .3)}" stroke-width="7" fill="none" stroke-linecap="round"/></g>`; }
    const g = p.bg2;                                 /* the land takes the chapter's second color, the barn and sun take the accents */
    return [
      L(`${sky(p, id, mix(p.bg2, '#9fd0ff', .7), light(p.accent, .6))}<circle cx="380" cy="250" r="110" fill="${light(p.accent, .6)}"/>${clouds(r, 6, '#fff')}<path d="M0 660 Q480 560 960 640 T1920 600 V1080 H0Z" fill="${light(g, .25)}"/>`),
      L(`<path d="M0 760 Q420 660 900 740 T1920 700 V1080 H0Z" fill="${g}"/><path d="M0 860 Q600 780 1200 850 T1920 820 V1080 H0Z" fill="${dark(g, .25)}"/><g fill="${p.accent2}"><rect x="1380" y="560" width="200" height="150"/></g><polygon points="1360,570 1480,480 1600,570" fill="${dark(p.accent2, .35)}"/><rect x="1455" y="630" width="50" height="80" fill="${p.accent}"/>`),
      L(`<rect x="0" y="1010" width="1920" height="70" fill="${dark(g, .5)}"/>${tufts}${[120, 400, 680].map(x => `<rect x="${x}" y="880" width="16" height="200" fill="${light(p.bg, .55)}"/>`).join('')}<rect x="100" y="915" width="600" height="12" fill="${light(p.bg, .55)}"/><rect x="100" y="975" width="600" height="12" fill="${light(p.bg, .55)}"/>`),
    ];
  },
  /* a skyline at dusk, windows lit */
  city(p, seed) {
    const r = rng(seed), id = 'skC' + seed;
    let far = '', mid = '';
    for (let x = 0; x < 1920; x += 70 + r() * 60) { const h = 140 + r() * 330, w = 60 + r() * 60; far += `<rect x="${x.toFixed(0)}" y="${(760 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${mix(p.bg, p.bg2, .55)}"/>`; }
    for (let x = -20; x < 1920; x += 150 + r() * 90) {
      const h = 220 + r() * 420, w = 120 + r() * 70; mid += `<rect x="${x.toFixed(0)}" y="${(900 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${dark(p.bg, .25)}"/>`;
      for (let wy = 900 - h + 24; wy < 870; wy += 46) for (let wx = x + 16; wx < x + w - 24; wx += 34) if (r() < .55) mid += `<rect class="${r() < .25 ? 'tw' : ''}" style="animation-delay:-${(r() * 3).toFixed(1)}s" x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="16" height="24" fill="${p.accent}" opacity=".85"/>`;
    }
    return [
      L(`${sky(p, id, dark(p.bg, .35), mix(p.bg2, p.accent, .35))}${stars(r, 70, 420)}<circle cx="1560" cy="220" r="74" fill="${light(p.accent, .7)}" opacity=".9"/>${far}`),
      L(`${mid}<rect x="0" y="900" width="1920" height="180" fill="${dark(p.bg, .5)}"/>`),
      L(`<rect x="0" y="1000" width="1920" height="80" fill="#111"/>${[260, 900, 1540].map(x => `<rect x="${x}" y="700" width="14" height="380" fill="#2a2a2a"/><circle class="tw" cx="${x + 7}" cy="690" r="24" fill="${light(p.accent, .5)}"/>`).join('')}<g fill="${p.accent}" opacity=".85">${Array.from({ length: 12 }, (_, i) => `<rect x="${60 + i * 160}" y="1036" width="80" height="8"/>`).join('')}</g>`),
    ];
  },
  /* big peaks, pines, a summit flag */
  mountains(p, seed) {
    const r = rng(seed), id = 'skM' + seed;
    const peak = (x, w, h, col, snow) => `<polygon points="${x - w / 2},820 ${x},${820 - h} ${x + w / 2},820" fill="${col}"/>${snow ? `<polygon points="${x - w * .1},${820 - h * .8} ${x},${820 - h} ${x + w * .1},${820 - h * .8} ${x + w * .04},${820 - h * .74} ${x},${820 - h * .82} ${x - w * .05},${820 - h * .73}" fill="#fff" opacity=".9"/>` : ''}`;
    let pines = '';
    for (let i = 0; i < 18; i++) { const x = r() * 1920, s = .7 + r() * .9, y = 1080; pines += `<g transform="translate(${x.toFixed(0)} ${y}) scale(${s.toFixed(2)})"><rect x="-8" y="-60" width="16" height="60" fill="#2a1a10"/><polygon points="-70,-50 0,-210 70,-50" fill="${dark(p.accent2, .5)}"/><polygon points="-54,-130 0,-270 54,-130" fill="${dark(p.accent2, .4)}"/></g>`; }
    return [
      L(`${sky(p, id, mix(p.bg, p.bg2, .4), light(p.accent, .5))}<circle cx="1420" cy="300" r="96" fill="${light(p.accent, .65)}"/>${clouds(r, 4, '#fff')}${peak(500, 900, 470, mix(p.bg2, '#ffffff', .25), true)}${peak(1300, 1100, 560, mix(p.bg2, '#ffffff', .15), true)}`),
      L(`${peak(900, 1400, 420, p.accent2, false)}${peak(200, 900, 330, dark(p.accent2, .2), false)}${peak(1700, 900, 360, dark(p.accent2, .2), false)}<rect x="0" y="815" width="1920" height="265" fill="${dark(p.accent2, .35)}"/><line x1="900" y1="400" x2="900" y2="340" stroke="#fff" stroke-width="5"/><polygon class="swing" points="900,340 948,356 900,372" fill="${p.accent}"/>`),
      L(`<rect x="0" y="1030" width="1920" height="50" fill="${dark(p.bg, .5)}"/>${pines}`),
    ];
  },
  /* sea, sun, palms */
  beach(p, seed) {
    const r = rng(seed), id = 'skB' + seed;
    const palm = (x, s) => `<g transform="translate(${x} 1080) scale(${s})"><path d="M0 0 q30 -260 -20 -520" stroke="#5a3d1e" stroke-width="26" fill="none" stroke-linecap="round"/><g class="swing" transform="translate(-20 -520)" fill="${dark(p.accent2, .2)}">${[-150, -100, -40, 20, 80, 140].map(a => `<path d="M0 0 q120 -90 250 -10 q-130 -20 -250 10z" transform="rotate(${a})"/>`).join('')}</g></g>`;
    let waves = '';
    for (let i = 0; i < 6; i++) waves += `<path class="drift" style="animation-delay:-${(r() * 18).toFixed(1)}s" d="M${(r() * 1500).toFixed(0)} ${(640 + i * 34).toFixed(0)} q60 -16 120 0 t120 0" stroke="#fff" stroke-width="5" fill="none" opacity=".55"/>`;
    return [
      L(`${sky(p, id, mix(p.bg2, '#ffffff', .2), light(p.accent, .6))}<circle cx="960" cy="520" r="150" fill="${light(p.accent, .5)}"/>${clouds(r, 5, '#fff')}<rect x="0" y="600" width="1920" height="480" fill="${mix(p.bg2, p.bg, .3)}"/>${waves}`),
      L(`<path d="M0 860 Q700 780 1920 880 V1080 H0Z" fill="${light(p.accent, .45)}"/><g transform="translate(1320 800)"><rect x="-6" y="-170" width="12" height="230" fill="#ddd"/><path class="swing" d="M-170 -160 Q0 -300 170 -160 Z" fill="${p.accent2}"/></g>`),
      L(`${palm(180, 1.1)}${palm(1760, .9)}<path d="M0 1000 Q960 950 1920 1010 V1080 H0Z" fill="${light(p.accent, .3)}"/>`),
    ];
  },
  /* indoors: a wall, a window, a shelf, a rug — for school, work, home, the bar */
  room(p, seed) {
    const r = rng(seed), id = 'skR' + seed;
    let frames = '';
    for (let i = 0; i < 5; i++) { const x = 160 + i * 190 + r() * 40, y = 200 + r() * 160, w = 110 + r() * 50; frames += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(w * 1.2).toFixed(0)}" fill="${light(p.bg2, .2)}" stroke="${p.accent}" stroke-width="10"/>`; }
    return [
      L(`${sky(p, id, mix(p.bg, p.bg2, .5), p.bg2)}<g opacity=".18" stroke="#fff" stroke-width="3">${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 128}" y1="0" x2="${i * 128}" y2="760"/>`).join('')}</g><rect x="1240" y="170" width="440" height="420" rx="8" fill="${light(p.accent, .55)}" stroke="#fff" stroke-width="16"/><line x1="1460" y1="170" x2="1460" y2="590" stroke="#fff" stroke-width="12"/><line x1="1240" y1="380" x2="1680" y2="380" stroke="#fff" stroke-width="12"/>${frames}`),
      L(`<rect x="0" y="760" width="1920" height="320" fill="${dark(p.bg, .35)}"/><rect x="0" y="750" width="1920" height="22" fill="${light(p.bg, .25)}"/><rect x="120" y="640" width="760" height="18" fill="${dark(p.accent2, .2)}"/>${[180, 270, 360, 470, 600, 720].map((x, i) => `<rect x="${x}" y="${640 - 70 - (i % 3) * 22}" width="${44 + (i % 2) * 22}" height="${70 + (i % 3) * 22}" fill="${[p.accent, p.accent2, light(p.bg2, .3)][i % 3]}"/>`).join('')}<ellipse cx="960" cy="960" rx="620" ry="90" fill="${p.accent2}" opacity=".7"/>`),
      L(`${bunting(r, 40, [p.accent, p.accent2, '#ffffff'])}<g transform="translate(1660 1080)"><rect x="-50" y="-150" width="100" height="150" rx="10" fill="${dark(p.accent2, .3)}"/><g class="swing"><ellipse cx="-40" cy="-230" rx="30" ry="90" transform="rotate(-24 -40 -230)" fill="#2f7d32"/><ellipse cx="0" cy="-260" rx="30" ry="100" fill="#3a9a3f"/><ellipse cx="44" cy="-226" rx="30" ry="90" transform="rotate(24 44 -226)" fill="#2f7d32"/></g></g>`),
    ];
  },
  /* stars, a moon, a campfire */
  night(p, seed) {
    const r = rng(seed), id = 'skN' + seed;
    let ff = '';
    for (let i = 0; i < 14; i++) ff += `<circle class="tw" style="animation-delay:-${(r() * 3).toFixed(1)}s" cx="${(r() * 1920).toFixed(0)}" cy="${(700 + r() * 300).toFixed(0)}" r="5" fill="${light(p.accent, .4)}"/>`;
    return [
      L(`${sky(p, id, dark(p.bg, .5), mix(p.bg, p.bg2, .7))}${stars(r, 130, 640)}<circle cx="1500" cy="230" r="86" fill="#fff5c2"/><circle cx="1470" cy="212" r="76" fill="${dark(p.bg, .42)}" opacity=".35"/>`),
      L(`<path d="M0 760 Q500 640 1000 740 T1920 690 V1080 H0Z" fill="${dark(p.accent2, .45)}"/><path d="M0 880 Q700 800 1920 870 V1080 H0Z" fill="${dark(p.accent2, .62)}"/>`),
      L(`<rect x="0" y="1020" width="1920" height="60" fill="#0a0a0a"/>${ff}<g transform="translate(1500 1030)"><path class="bl" d="M-46 0 q-10 -90 46 -150 q56 60 46 150z" fill="${p.accent}"/><path d="M-24 0 q-4 -50 24 -86 q28 36 24 86z" fill="#fff1b8"/><rect x="-80" y="-8" width="160" height="18" rx="9" fill="#3a2414" transform="rotate(12)"/><rect x="-80" y="-8" width="160" height="18" rx="9" fill="#3a2414" transform="rotate(-12)"/><circle class="smoke" cx="0" cy="-170" r="26" fill="#ccc"/></g>`),
    ];
  },
  /* bunting and balloons — the title screen, the finale, and the fallback for anything else */
  party(p, seed) {
    const r = rng(seed), id = 'skP' + seed;
    const cols = [p.accent, p.accent2, light(p.bg2, .4), '#ffffff'];
    let dots = '';
    for (let i = 0; i < 60; i++) dots += `<rect class="leaf" style="animation-delay:-${(r() * 8).toFixed(1)}s" x="${(r() * 1920).toFixed(0)}" y="0" width="12" height="8" fill="${cols[i % 4]}" opacity=".8"/>`;
    return [
      L(`${sky(p, id, p.bg, p.bg2)}${stars(r, 50, 1080)}`),
      L(`${balloons(r, 9, cols)}`),
      L(`${bunting(r, 30, cols)}${bunting(r, 150, cols.slice().reverse())}${dots}`),
    ];
  },
};
BB.SCENE_PRESETS = Object.keys(PRESETS);

/* ---------- sanitizer for SVG that came from a model or a pasted file ---------- */
const OK_TAGS = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern']);
const OK_CLASSES = new Set(['spin', 'leaf', 'tw', 'star', 'bl', 'smoke', 'swing', 'drift', 'floaty']);
const OK_ATTRS = new Set(['id', 'class', 'style', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'points', 'transform', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits', 'patterntransform', 'clip-path', 'mask', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'letter-spacing', 'dominant-baseline', 'paint-order', 'viewbox', 'preserveaspectratio', 'maskunits']);
function cleanNode(node, prefix) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;                                  /* text is fine (it is set as text, never parsed) */
    if (child.nodeType !== 1 || !OK_TAGS.has(child.localName.toLowerCase())) { child.remove(); continue; }
    for (const a of [...child.attributes]) {
      const name = a.name.toLowerCase(), val = a.value;
      let keep = OK_ATTRS.has(name);
      if (keep && /url\s*\(/i.test(val)) keep = /^\s*url\(\s*['"]?#[\w-]+['"]?\s*\)\s*$/i.test(val);   /* only local paint-server refs */
      if (keep && /javascript:|expression|@import|<|&#/i.test(val)) keep = false;
      if (keep && name === 'class') { const cls = val.split(/\s+/).filter(c => OK_CLASSES.has(c)); if (cls.length) child.setAttribute('class', cls.join(' ')); else keep = false; }
      if (keep && name === 'style') { const m = /animation-delay\s*:\s*(-?[\d.]+s)/i.exec(val); if (m) child.setAttribute('style', `animation-delay:${m[1]}`); else keep = false; }
      if (!keep) child.removeAttribute(a.name);
    }
    /* namespace ids per layer so two chapters' gradients never collide */
    if (child.id) child.id = prefix + child.id;
    for (const a of ['fill', 'stroke', 'clip-path', 'mask']) { const v = child.getAttribute(a); if (v && /url\(/.test(v)) child.setAttribute(a, v.replace(/#([\w-]+)/, '#' + prefix + '$1')); }
    cleanNode(child, prefix);
  }
}
/* Returns safe inner markup, or '' when the input does not parse as SVG. */
BB.sanitizeSVG = function (inner, prefix = 's') {
  if (typeof inner !== 'string' || !inner.trim() || inner.length > 60000) return '';
  inner = inner.replace(/^\s*<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');   /* tolerate a wrapping <svg> */
  let doc;
  try { doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`, 'image/svg+xml'); } catch (e) { return ''; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return '';
  const root = doc.documentElement;
  cleanNode(root, prefix + '-');
  if (!root.querySelector('path, rect, circle, ellipse, polygon, line, polyline')) return '';
  const out = new XMLSerializer().serializeToString(root);
  return out.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
};

/* ---------- scene + badge HTML ---------- */
const cache = new Map();
BB.sceneLayers = function (scene, palette, key) {
  const k = key + '|' + JSON.stringify(palette) + '|' + (scene && scene.preset) + '|' + (scene && scene.layers ? scene.layers.join('').length : 0);
  if (cache.has(k)) return cache.get(k);
  let layers = null;
  if (scene && Array.isArray(scene.layers) && scene.layers.length === 3) {
    const clean = scene.layers.map((l, i) => BB.sanitizeSVG(l, `${key}l${i}`));
    if (clean.every(Boolean)) layers = clean.map(L);
  }
  if (!layers) { const name = scene && PRESETS[scene.preset] ? scene.preset : 'party'; let seed = 0; for (const ch of String(key)) seed = (seed * 31 + ch.charCodeAt(0)) % 9973; layers = PRESETS[name](palette, seed + 11); }
  cache.set(k, layers);
  return layers;
};
BB.sceneHTML = function (scene, palette, key, mode = '') {   /* mode: '' (full), 'dim' (behind text), 'soft' (games) */
  const depth = [0.25, 0.55, 1];
  return `<div class="scene ${mode}">${BB.sceneLayers(scene, palette, key).map((l, i) => `<div class="layer" data-depth="${depth[i]}">${l}</div>`).join('')}</div>`;
};

/* Badge: a Claude-made 200x200 emblem, or a ring with the chapter's emoji inside */
BB.badgeSVG = function (ch, key) {
  const p = ch.palette;
  const custom = ch.emblem ? BB.sanitizeSVG(ch.emblem, key + 'b') : '';
  const inner = custom || `<circle cx="100" cy="100" r="92" fill="${p.bg}"/><circle cx="100" cy="100" r="80" fill="none" stroke="${p.accent}" stroke-width="8"/><circle cx="100" cy="100" r="66" fill="${p.accent2}" opacity=".55"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<circle cx="${(100 + Math.cos(a) * 80).toFixed(1)}" cy="${(100 + Math.sin(a) * 80).toFixed(1)}" r="4" fill="#fff"/>`; }).join('')}
    <text x="100" y="128" text-anchor="middle" font-size="78" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${BB.esc ? BB.esc(ch.glyph || '🎂') : '🎂'}</text>`;
  return `<svg viewBox="0 0 200 200" aria-hidden="true">${inner}</svg>`;
};
})();
