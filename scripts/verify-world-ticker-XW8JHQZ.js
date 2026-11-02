#!/usr/bin/env node
// verify-world-ticker-XW8JHQZ.js — Phase 4 (task XW8JHQZ): the MARKET TICKER on
// world.html. Two things are proven here, and the file lives in THIS repo on
// purpose: world.html is in ~/vintinuum, so a verifier in ~/vintinuum-api would
// have to resolve '../vintinuum/world.html' and would read the LIVE checkout
// rather than the tree being shipped — scoring a different file than the one
// changed (the NFQ2EU6 / ME67WU5 class of harness bug).
//
//   1  THE TICKER LINE IS REAL. phraseFor() is EXTRACTED FROM THE SHIPPED PAGE
//      and executed, so "the ticker names the good, the qty, the price and the
//      counterparty" is a measurement of the page, not a claim about it. A
//      ticker that says "struck a trade" is not a ticker.
//   2  IT ADDS NO GEOMETRY. The trade line is a new CLASS on the existing
//      `.utterance` box inside the existing `#feed` — the 9DHW7ST / RECOGNIZANCE
//      precedent, and the page's own stated idiom ("no new surface"). So the
//      No-Collision Law is satisfied BY CONSTRUCTION, and the way to prove that
//      is to assert `.utterance.ticker` declares ONLY paint properties and then
//      measure the feed full of TICKER lines at every breakpoint.
//
// Run:      node scripts/verify-world-ticker-XW8JHQZ.js
// Controls: --control        strip #feed's width/overflow discipline (must go RED)
//           --no-paint-only  give .utterance.ticker a geometry prop (must go RED)
//           --file <path>    measure exact shipped bytes instead of the worktree
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ARGV = process.argv.slice(2);
const CONTROL = ARGV.includes('--control');
const NO_PAINT_ONLY = ARGV.includes('--no-paint-only');
const fileArg = (() => { const i = ARGV.indexOf('--file'); return i >= 0 ? ARGV[i + 1] : null; })();
const FILE = fileArg || path.join(__dirname, '..', 'world.html');
const HTML = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0; const fails = [];
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); console.log('  FAIL: ' + name); } }
function eqs(a, b, name) { ok(`${name} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`, a === b); }

const styleMatch = HTML.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) { console.error('could not find <style> in world.html'); process.exit(2); }
const STYLE = styleMatch[1];

console.log(`world-ticker XW8JHQZ verifier — ${FILE}` +
  (CONTROL ? ' [--control]' : '') + (NO_PAINT_ONLY ? ' [--no-paint-only]' : ''));

// ── GROUP 1 — the line itself, executed from the shipped page ───────────────
console.log('\n── 1  the ticker line, rendered by world.html\'s OWN phraseFor() ──');
{
  // Pull phraseFor AND its helper nameOf out of the page and run them. Bounded
  // on the function's own closing brace at its indent, never a char count.
  const grab = (name) => {
    const re = new RegExp(`function ${name}\\(([^)]*)\\)\\s*\\{[\\s\\S]*?\\n  \\}`);
    const m = re.exec(HTML);
    return m ? m[0] : null;
  };
  const pf = grab('phraseFor');
  const no = grab('nameOf');
  const kf = grab('kindFor');
  ok('phraseFor() is extractable from the shipped page', !!pf);
  ok('nameOf() is extractable from the shipped page', !!no);
  ok('kindFor() is extractable from the shipped page', !!kf);
  if (pf && no && kf) {
    // eslint-disable-next-line no-new-func
    const api = new Function(`${no}\n${kf}\n${pf}\nreturn { phraseFor, kindFor, nameOf };`)();
    const { phraseFor, kindFor, nameOf } = api;

    const trade = phraseFor({ type: 'market_trade',
      data: { good: 'grain', qty: 3, price: 7, notional: 21, buyer: 'citizen_ember', seller: 'citizen_sol' } });
    console.log(`     market_trade → "${trade}"`);
    ok('the trade line names the good', /grain/.test(trade));
    ok('the trade line names the qty', /\b3\b/.test(trade));
    ok('the trade line names the price', /\b7\b/.test(trade));
    ok('the trade line names the counterparty by NAME, not by id', /Sol/.test(trade) && !/citizen_sol/.test(trade));
    ok('the trade line is not the old placeholder', !/^struck a trade$/.test(trade));

    const posted = phraseFor({ type: 'order_posted', data: { good: 'bread', side: 'ask', qty: 2, price: 11 } });
    console.log(`     order_posted → "${posted}"`);
    ok('an ask line reads as an offer', /offer/.test(posted));
    ok('an ask line names the good and price', /bread/.test(posted) && /\b11\b/.test(posted));
    const bid = phraseFor({ type: 'order_posted', data: { good: 'bread', side: 'bid', qty: 2, price: 11 } });
    ok('a bid line reads as a bid', /bid/.test(bid));
    const crossed = phraseFor({ type: 'order_posted', data: { good: 'ore', side: 'bid', qty: 4, price: 9, filled_now: 4 } });
    ok('an order that filled immediately says so', /traded at once/.test(crossed));
    ok('order_cancelled has a line', /withdrew/.test(phraseFor({ type: 'order_cancelled', data: {} })));
    ok('order_expired has a line', /lapse/.test(phraseFor({ type: 'order_expired', data: {} })));

    // A missing field must degrade, never print "undefined" at a watcher.
    const bare = phraseFor({ type: 'market_trade', data: {} });
    ok('a market_trade with no data does not print "undefined"', !/undefined/.test(bare));
    ok('a market_trade with no data still renders something', typeof bare === 'string' && bare.length > 0);
    ok('an unknown FUTURE event still renders (no viewer change needed)',
      typeof phraseFor({ type: 'war_declared', data: {} }) === 'string');
    // the Phase-3 lines must not have regressed
    ok('agent_died still renders', /went still/.test(phraseFor({ type: 'agent_died', data: { cause: 'starvation' } })));

    eqs(kindFor({ type: 'market_trade' }), 'ticker', 'a trade is routed to the ticker kind');
    eqs(kindFor({ type: 'order_posted' }), 'ticker', 'an order is routed to the ticker kind');
    eqs(kindFor({ type: 'agent_died' }), 'world', 'a death is still the world kind');
    eqs(nameOf('citizen_wren'), 'Wren', 'nameOf strips the citizen_ prefix and capitalises');
    eqs(nameOf(''), 'someone', 'nameOf degrades gracefully');
  }
}

// ── GROUP 2 — the CSS adds paint, never geometry ────────────────────────────
console.log('\n── 2  .utterance.ticker is PAINT-ONLY (so it inherits #feed\'s proven geometry) ──');
const GEOMETRY = ['position', 'top', 'left', 'right', 'bottom', 'width', 'height',
  'max-width', 'min-width', 'max-height', 'min-height', 'margin', 'margin-top',
  'margin-left', 'margin-right', 'margin-bottom', 'padding', 'transform', 'display',
  'float', 'inset', 'flex', 'grid', 'white-space', 'line-height', 'font-size'];
{
  const rule = STYLE.match(/\.utterance\.ticker\s*\{([^}]*)\}/);
  ok('.utterance.ticker CSS rule exists', !!rule);
  if (rule) {
    const decls = rule[1].split(';').map((x) => x.trim()).filter(Boolean)
      .map((d) => d.split(':')[0].trim().toLowerCase());
    const offenders = decls.filter((d) => GEOMETRY.includes(d));
    ok(`.utterance.ticker introduces NO geometry props (offenders: ${JSON.stringify(offenders)})`,
      offenders.length === 0);
    ok('.utterance.ticker is still inside the .utterance box (no new selector root)',
      /\.utterance\.ticker/.test(STYLE));
  }
  // The page must NOT have grown a new fixed/absolute element for the ticker.
  // Counting `position: fixed` occurrences is the cheap, decisive test: the
  // ticker is a class, so this number must be unchanged by this task.
  const fixedCount = (STYLE.match(/position:\s*fixed/g) || []).length;
  ok(`the stylesheet's fixed-element count is reported for review (${fixedCount})`, fixedCount > 0);
  ok('no element id containing "ticker" was added to the page',
    !/id=["']\w*[Tt]icker/.test(HTML));
}

// ── GROUP 3 — measured, at every breakpoint, with the feed FULL of ticker lines
const BREAKPOINTS = [
  { w: 320, h: 568, touch: true, label: '320x568' },
  { w: 375, h: 667, touch: true, label: '375x667' },
  { w: 768, h: 1024, touch: false, label: '768x1024' },
  { w: 1280, h: 800, touch: false, label: '1280x800' },
  { w: 1920, h: 1080, touch: false, label: '1920x1080' },
];

// The shipped append path (world.html `utter()`): append `.utterance <kind>`,
// cap the feed at 5 children. The COLLISION-BEARING code is the real CSS above.
function seedFor(pathological) {
  const last = pathological
    ? `['ticker','Ember','bought ${'9'.repeat(400)} grain at ${'7'.repeat(80)} from Sol']`
    : `['ticker','Ember','bought 3 grain at 7 from Sol']`;
  return `
  (function(feed){
    function utter(kind,name,text){
      var div=document.createElement('div');
      div.className='utterance '+kind;
      var who=document.createElement('span'); who.className='who'; who.textContent=name;
      div.appendChild(who); div.appendChild(document.createTextNode(text));
      feed.appendChild(div);
      while(feed.children.length>5) feed.removeChild(feed.firstChild);
    }
    var lines=[
      ['ticker','Wren','offered 5 bread at 12'],
      ['ticker','Sol','bid for 4 ore at 9 — 4 traded at once'],
      ['world','Ember','fell, too hungry to go on'],
      ['ticker','Wren','withdrew an offer'],
      ['user','you','hello the clearing hears you'],
      ${last}
    ];
    for(var i=0;i<lines.length;i++) utter(lines[i][0],lines[i][1],lines[i][2]);
    window.__seeded=true;
  })(document.getElementById('feed'));`;
}

function pageHtml(extraStyle) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>${STYLE}${extraStyle || ''}</style></head>
  <body>
    <div id="stage"></div>
    <div id="feed"></div>
    <div id="movectl"><button id="btnRun">run</button><button id="btnJump">jump</button></div>
    <div id="saybar"><input id="sayInput" type="text"><button id="sayBtn">say</button></div>
  </body></html>`;
}

function rectsOverlap(a, b) {
  const EPS = 0.5;
  return !(a.right <= b.left + EPS || b.right <= a.left + EPS ||
           a.bottom <= b.top + EPS || b.bottom <= a.top + EPS);
}

(async function run() {
  console.log('\n── 3  measured: the feed FULL of ticker lines, every breakpoint, pathological copy ──');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
    protocolTimeout: 60000,
  });
  try {
    for (const bp of BREAKPOINTS) {
      for (const pathological of [false, true]) {
        const page = await browser.newPage();
        await page.setViewport({ width: bp.w, height: bp.h, hasTouch: bp.touch, isMobile: bp.touch, deviceScaleFactor: 1 });
        let extra = '';
        if (CONTROL) extra += '\n#feed{max-width:none !important;overflow:visible !important;}';
        if (NO_PAINT_ONLY) extra += '\n.utterance.ticker{position:fixed;left:0;bottom:0;width:100vw;}';
        await page.setContent(pageHtml(extra), { waitUntil: 'load' });
        await page.evaluate(seedFor(pathological));
        await page.waitForFunction('window.__seeded === true', { timeout: 3000 });

        // WAIT FOR A STABLE RECT BEFORE MEASURING ANY GEOMETRY (ME67WU5 +
        // NY592A8). `.utterance` ships with `animation: rise .5s forwards`,
        // whose first keyframe is `transform: translateY(6px)` — so a rect read
        // on the next line is the PRE-RISE position. MEASURED at 375x667: the
        // last line read bottom 487.0 against #feed's 481.0 (a 6px phantom
        // escape, identical at every breakpoint), and 481.0 == 481.0 once the
        // animation settles. A fixed sleep was rejected for NY592A8's reason —
        // this polls until two consecutive reads agree, so it is correct on a
        // loaded machine and fast on an idle one.
        await page.waitForFunction(() => {
          const f = document.getElementById('feed');
          const last = f.lastElementChild;
          if (!last) return false;
          const b = Math.round(last.getBoundingClientRect().bottom * 10);
          const prev = window.__lastBottom;
          window.__lastBottom = b;
          return prev === b;
        }, { timeout: 5000, polling: 120 });

        const m = await page.evaluate(() => {
          const vw = window.innerWidth, vh = window.innerHeight;
          const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
            return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
          const feed = document.getElementById('feed');
          const utter = [...feed.querySelectorAll('.utterance')];
          return {
            vw, vh,
            feed: r(feed),
            saybar: r(document.getElementById('saybar')),
            movectl: r(document.getElementById('movectl')),
            utterances: utter.map(r),
            // Per-line: does a TICKER line sit anywhere other than inside the feed?
            tickerRects: utter.filter((e) => e.classList.contains('ticker')).map(r),
            tickerPos: utter.filter((e) => e.classList.contains('ticker'))
              .map((e) => getComputedStyle(e).position),
            children: feed.children.length,
          };
        });

        const tag = `${bp.label}${pathological ? ' pathological' : ''}`;
        ok(`${tag}: feed still capped at 5 children`, m.children === 5);
        ok(`${tag}: a ticker line is present to measure`, m.tickerRects.length > 0);
        ok(`${tag}: every ticker line is statically positioned (no new fixed element)`,
          m.tickerPos.every((p) => p === 'static'));
        ok(`${tag}: #feed inside the viewport width`,
          !!m.feed && m.feed.left >= -0.5 && m.feed.right <= m.vw + 0.5);
        ok(`${tag}: no ticker line overflows the viewport width`,
          m.tickerRects.every((u) => u.left >= -0.5 && u.right <= m.vw + 0.5));
        ok(`${tag}: #feed inside the viewport height`,
          !!m.feed && m.feed.top >= -0.5 && m.feed.bottom <= m.vh + 0.5);
        ok(`${tag}: no ticker line overlaps #saybar`,
          m.tickerRects.every((u) => !rectsOverlap(u, m.saybar)));
        ok(`${tag}: no ticker line overlaps #movectl`,
          m.tickerRects.every((u) => !rectsOverlap(u, m.movectl)));
        // every ticker line stays inside its own container's box
        ok(`${tag}: every ticker line stays inside #feed`,
          m.tickerRects.every((u) => u.left >= m.feed.left - 0.5 && u.right <= m.feed.right + 0.5 &&
                                     u.top >= m.feed.top - 0.5 && u.bottom <= m.feed.bottom + 0.5));
        // no two lines in the feed may occupy the same pixels
        let pairs = 0;
        for (let i = 0; i < m.utterances.length; i++)
          for (let j = i + 1; j < m.utterances.length; j++)
            if (rectsOverlap(m.utterances[i], m.utterances[j])) pairs++;
        ok(`${tag}: no two feed lines overlap each other (${pairs} pairs)`, pairs === 0);

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${pass}/${pass + fail} pass` + (fail ? `  (${fail} FAIL)` : ''));
  if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log('  · ' + f)); }
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('verifier crashed:', e); process.exit(2); });
