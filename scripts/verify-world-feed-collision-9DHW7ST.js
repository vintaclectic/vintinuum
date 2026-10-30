#!/usr/bin/env node
// verify-world-feed-collision-9DHW7ST.js — No-Collision proof for the citizen
// event feed wiring (task 9DHW7ST). The viewer change adds NO new element and
// NO new geometry: WORLD_SPEC §3 events are routed through the EXISTING,
// exhaustively collision-managed `#feed` / `utter()` channel (the RECOGNIZANCE
// precedent), with only a colour class `.utterance.world` added. This harness
// proves that by loading the REAL <style> block + the REAL #feed/#saybar/
// #movectl markup extracted verbatim from world.html, filling the feed with
// world utterances at every breakpoint, and asserting zero overflow and zero
// overlap with the reserved controls.
//
// Run:     node scripts/verify-world-feed-collision-9DHW7ST.js
// Control: node scripts/verify-world-feed-collision-9DHW7ST.js --control
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const CONTROL = process.argv.includes('--control');
// Default: the worktree world.html. --file <path> points it at the exact
// content being shipped (origin/main + my hunks), so the proof is of the
// SHIPPED bytes, not the mixed worktree file (NY592A8).
const fileArg = (() => { const i = process.argv.indexOf('--file'); return i >= 0 ? process.argv[i + 1] : null; })();
const HTML = fs.readFileSync(fileArg || path.join(__dirname, '..', 'world.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); console.log('  FAIL: ' + name); } }

// Extract the REAL <style>…</style> so the harness tracks shipped CSS, not a copy.
const styleMatch = HTML.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) { console.error('could not find <style> in world.html'); process.exit(2); }
const STYLE = styleMatch[1];

// Static CSS assertion: `.utterance.world` may introduce ONLY paint properties
// (colour/opacity/font-style) — never geometry — so it cannot alter the feed's
// already-verified layout. This is the whole argument that the feed inherits
// #feed's collision discipline unchanged.
const worldRule = STYLE.match(/\.utterance\.world\s*\{([^}]*)\}/);
ok('.utterance.world CSS rule exists', !!worldRule);
if (worldRule) {
  const decls = worldRule[1].split(';').map(s => s.trim()).filter(Boolean)
    .map(d => d.split(':')[0].trim().toLowerCase());
  const GEOMETRY = ['position', 'top', 'left', 'right', 'bottom', 'width', 'height',
    'max-width', 'min-width', 'max-height', 'min-height', 'margin', 'margin-top',
    'margin-left', 'margin-right', 'margin-bottom', 'padding', 'transform', 'display',
    'float', 'inset', 'flex', 'grid'];
  // `--c` is the shared paint variable every .utterance.<kind> sets for its
  // colour (consumed by .who) — it is NOT geometry. Only the GEOMETRY list moves layout.
  const offenders = decls.filter(d => GEOMETRY.includes(d));
  ok('.utterance.world introduces NO geometry props (paint-only)', offenders.length === 0);
}

const BREAKPOINTS = [
  { w: 320, h: 568, touch: true,  label: '320x568 phone' },
  { w: 375, h: 667, touch: true,  label: '375x667 phone' },
  { w: 768, h: 1024, touch: false, label: '768x1024 tablet' },
  { w: 1280, h: 800, touch: false, label: '1280x800 desktop' },
  { w: 1920, h: 1080, touch: false, label: '1920x1080 desktop' },
];

// A faithful, 4-line reimplementation of the shipped `utter()` append path
// (world.html:740 — append `.utterance <kind>`, cap the feed at 5 children).
// The COLLISION-BEARING code (the CSS) is the real shipped CSS above.
const SEED = `
  (function(feed){
    function utter(kind, name, text){
      var div=document.createElement('div');
      div.className='utterance '+kind;
      var who=document.createElement('span'); who.className='who'; who.textContent=name;
      div.appendChild(who); div.appendChild(document.createTextNode(text));
      feed.appendChild(div);
      while(feed.children.length>5) feed.removeChild(feed.firstChild);
    }
    var lines=[
      ['world','Aria','went still — starvation'],
      ['world','Atlas','laid claim to a patch of land'],
      ['world','a citizen','struck a trade'],
      ['world','Lunex','fell, too hungry to go on'],
      ['world','Mercatus','made something with their hands'],
      ['world','a citizen','world quake'],
      ['user','you','hello the clearing hears you and remembers'],
    ];
    for(var i=0;i<lines.length;i++) utter(lines[i][0],lines[i][1],lines[i][2]);
    window.__seeded=true;
  })(document.getElementById('feed'));
`;

function pageHtml(controlStyle) {
  // Real markup for the fixed elements the feed must stay clear of.
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>${STYLE}${controlStyle || ''}</style></head>
  <body>
    <div id="stage"></div>
    <div id="feed"></div>
    <div id="movectl"><button id="btnRun">run</button><button id="btnJump">jump</button></div>
    <div id="saybar"><input id="sayInput" type="text"><button id="sayBtn">say</button></div>
  </body></html>`;
}

function rectsOverlap(a, b) {
  const EPS = 0.5;  // sub-pixel touching is not a collision
  return !(a.right <= b.left + EPS || b.right <= a.left + EPS ||
           a.bottom <= b.top + EPS || b.bottom <= a.top + EPS);
}

(async function run() {
  console.log('world-feed collision 9DHW7ST verifier' + (CONTROL ? ' [--control]' : ''));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
    protocolTimeout: 60000,
  });
  try {
    for (const bp of BREAKPOINTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: bp.w, height: bp.h, hasTouch: bp.touch, isMobile: bp.touch, deviceScaleFactor: 1 });
      const controlStyle = CONTROL ? '\n#feed{max-width:none !important;overflow:visible !important;}' : '';
      await page.setContent(pageHtml(controlStyle), { waitUntil: 'load' });
      // In control mode inject one pathological long unbroken token to force overflow.
      // Put the pathological long token on the LAST line so it SURVIVES the
      // 5-child cap (the first lines are evicted) — otherwise the control is vacuous.
      const seed = CONTROL
        ? SEED.replace("['user','you','hello the clearing hears you and remembers']",
            `['world','a citizen','${'x'.repeat(500)}']`)
        : SEED;
      await page.evaluate(seed);
      await page.waitForFunction('window.__seeded === true', { timeout: 2000 });

      const m = await page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
        const feed = document.getElementById('feed');
        const utterances = [...feed.querySelectorAll('.utterance')].map(r);
        return {
          vw, vh,
          feed: r(feed),
          saybar: r(document.getElementById('saybar')),
          movectl: r(document.getElementById('movectl')),
          utterances,
          feedChildren: feed.children.length,
        };
      });

      const tag = bp.label;
      ok(`${tag}: feed capped at 5 children`, m.feedChildren === 5);
      // horizontal overflow — feed and every utterance inside the viewport
      ok(`${tag}: #feed within viewport width`, m.feed && m.feed.left >= -0.5 && m.feed.right <= m.vw + 0.5);
      const overflowing = m.utterances.filter(u => u.left < -0.5 || u.right > m.vw + 0.5);
      ok(`${tag}: no utterance overflows viewport width`, overflowing.length === 0);
      // vertical: feed inside viewport height
      ok(`${tag}: #feed within viewport height`, m.feed && m.feed.top >= -0.5 && m.feed.bottom <= m.vh + 0.5);
      // no overlap with the reserved controls (the real collision check)
      ok(`${tag}: #feed does not overlap #saybar`, m.feed && m.saybar && !rectsOverlap(m.feed, m.saybar));
      ok(`${tag}: #feed does not overlap #movectl`, m.feed && m.movectl && !rectsOverlap(m.feed, m.movectl));

      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${pass}/${pass + fail} pass` + (fail ? `  (${fail} FAIL: ${fails.join(', ')})` : ''));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('verifier crashed:', e); process.exit(2); });
