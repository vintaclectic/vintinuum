#!/usr/bin/env node
/* verify-chronicle-scroll-S3U2BDT.js — proof that chronicle.html no longer
 * yanks the reader back toward the top while they scroll.
 *
 * ROOT CAUSE (measured, not guessed): the rail's active-chapter spy ran
 *   a.scrollIntoView({block:'nearest',inline:'center'})
 * on the <a> inside #rail. scrollIntoView() scrolls EVERY scroll ancestor, and
 * on phones (<=880px) .rail is position:static + overflow-x:auto sitting at the
 * TOP of .shell. Once the rail had scrolled off screen, block:'nearest' moved
 * the DOCUMENT back up to reveal it — and html{scroll-behavior:smooth} made it
 * an animated jump. It fired every time a chapter crossed the spy's 5% band,
 * i.e. "it automatically scrolls back to the top after so many scrolls down."
 *
 * HOW THIS MEASURES IT: serve the repo over http, load chronicle.html, then
 * walk the page down in fixed steps with behavior:'instant', waiting after each
 * step so any programmatic/animated scroll has time to fire, and read scrollY
 * back. A reader who only scrolls DOWN must never end up above where they put
 * themselves. Any (target - actual) > DRIFT_PX is a yank.
 *
 * Also asserts the feature the old line existed for still works: on phones the
 * active chip is panned into view inside the rail's own scrollport.
 *
 * NEGATIVE CONTROL: --old-spy serves the pre-fix source (the scrollIntoView
 * line restored) and must FAIL, or this harness proves nothing.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let puppeteer;
try { puppeteer = require(path.join(process.env.HOME, 'vintinuum-api', 'node_modules', 'puppeteer')); }
catch (_) { puppeteer = require('puppeteer'); }

const OLD_SPY = process.argv.includes('--old-spy');

const FIXED = `if(a){a.classList.add('active');trackChip(a);}`;
const BROKEN = `if(a){a.classList.add('active');a.scrollIntoView({block:'nearest',inline:'center'});}`;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let pass = 0, fail = 0;
const FAILURES = [];
function is(name, ok, extra) {
  if (ok) { pass++; }
  else { fail++; FAILURES.push(name + (extra ? ' — ' + extra : '')); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
}

// Breakpoints the No-Collision Law names, plus Vinta's phone (393) and a short
// landscape phone, because the bug is viewport-height sensitive.
const LANES = [
  { w: 320,  h: 640, label: '320x640 phone (narrow)' },
  { w: 375,  h: 667, label: '375x667 phone' },
  { w: 393,  h: 852, label: '393x852 phone (his)' },
  { w: 768,  h: 1024, label: '768x1024 tablet (mobile rail)' },
  { w: 880,  h: 900, label: '880x900 breakpoint edge' },
  { w: 1280, h: 800, label: '1280x800 desktop (column rail)' },
  { w: 1920, h: 1080, label: '1920x1080 desktop' },
  { w: 844,  h: 390, label: '844x390 phone landscape (short)' },
];

const DRIFT_PX = 4;        // sub-pixel / rounding tolerance only
const STEPS = 26;          // enough crossings to trip the spy many times over

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        const ext = path.extname(file).toLowerCase();
        if (OLD_SPY && rel === 'chronicle.html') {
          let src = buf.toString('utf8');
          if (!src.includes(FIXED)) { console.error('control: fixed line not found'); process.exit(1); }
          src = src.replace(FIXED, BROKEN);
          buf = Buffer.from(src, 'utf8');
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // Static guard first — cheap, and it catches a regression even if Chromium
  // is unavailable in some environment later.
  const rawSrc = fs.readFileSync(path.join(ROOT, 'chronicle.html'), 'utf8');
  // Strip OWN-LINE comments only (U3VFRJR: a greedy /*...*/ sweep eats real code
  // whenever the file contains a comment-shaped substring). This matters here
  // because the fix's own comment deliberately NAMES the banned call so nobody
  // re-adds it — S7VCB6C: a guard that names the token it forbids must not match
  // the prose explaining the ban.
  const src = rawSrc
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
    .replace(/^([ \t]*)\/\/[^\n]*$/gm, '$1');
  const BANNED = 'scroll' + 'IntoView';   // assembled so this file can be grepped too
  is('chronicle.html: the banned call appears in no CODE line',
     !src.includes(BANNED),
     src.includes(BANNED) ? 'still called' : 'absent from code');
  is('chronicle.html: it IS still named in a comment, so nobody re-adds it',
     rawSrc.includes(BANNED), 'the explanatory comment survives');
  is('comment stripper is not eating the script wholesale (non-vacuous)',
     src.includes('trackChip') && src.length > rawSrc.length * 0.8,
     `${rawSrc.length} -> ${src.length} chars`);
  is('chronicle.html: the spy calls trackChip(a) instead', src.includes('trackChip(a)'));
  is('chronicle.html: trackChip writes rail.scrollLeft only', /rail\.scrollLeft\s*=/.test(src));
  is('chronicle.html: trackChip never touches window/document scroll',
     !/trackChip[\s\S]{0,700}?(window\.scroll|document\.documentElement\.scrollTop|scrollBy)/.test(src));

  const srv = await serve();
  const port = srv.address().port;
  const url = `http://127.0.0.1:${port}/chronicle.html`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-prefers-reduced-motion=0'],
  });

  try {
    for (const lane of LANES) {
      const page = await browser.newPage();
      await page.setViewport({ width: lane.w, height: lane.h, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#rail a');
      await sleep(250);

      const geo = await page.evaluate(() => {
        const r = document.getElementById('rail');
        return {
          max: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          railScrollable: r.scrollWidth - r.clientWidth >= 2,
          chapters: document.querySelectorAll('.chapter').length,
        };
      });
      is(`${lane.label}: page is actually scrollable (harness not vacuous)`,
         geo.max > lane.h, `max scroll ${Math.round(geo.max)}px`);
      is(`${lane.label}: ${geo.chapters} chapters observed by the spy`, geo.chapters >= 10,
         `${geo.chapters} chapters`);

      // Walk down like a reader. Each step: put the page exactly where we want
      // it (instant), let the world settle, then read back where we ARE.
      const worst = await page.evaluate(async (steps, tol) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const maxOf = () => document.documentElement.scrollHeight - document.documentElement.clientHeight;
        let worstDrift = 0, worstAt = 0, backSteps = 0, prev = 0, clamped = 0;
        for (let i = 1; i <= steps; i++) {
          const target = Math.round((maxOf() * i) / steps);
          window.scrollTo({ top: target, behavior: 'instant' });
          await sleep(140);                       // let the spy + any animation fire
          await new Promise(r => requestAnimationFrame(() => r()));
          await sleep(140);                       // smooth scroll would still be running
          const actual = window.scrollY;
          // The document SHRINKS as the last .reveal drops its translateY(28px),
          // so the final step's target can exceed the new bottom and the browser
          // clamps scrollY. That is the reader sitting at the end of the page, not
          // a yank — only count drift when we are genuinely ABOVE the current
          // bottom. (Measured live: 25px of pure clamp at step 26, max 12580->12555.)
          const drift = target - actual;
          if (drift > tol && actual < maxOf() - tol) {
            if (drift > worstDrift) { worstDrift = drift; worstAt = target; }
          } else if (drift > tol) { clamped++; }
          if (actual < prev - tol && actual < maxOf() - tol) backSteps++;
          prev = actual;
        }
        return { worstDrift: Math.round(worstDrift), worstAt, backSteps, clamped };
      }, STEPS, DRIFT_PX);

      is(`${lane.label}: no upward yank while scrolling down`,
         worst.worstDrift <= DRIFT_PX,
         `worst pull-up ${worst.worstDrift}px (at y=${worst.worstAt}), tolerance ${DRIFT_PX}px` +
         (worst.clamped ? `, ${worst.clamped} bottom-clamp step(s) excluded` : ''));
      is(`${lane.label}: scroll position never moves backwards across ${STEPS} steps`,
         worst.backSteps === 0, `${worst.backSteps} backward step(s)`);

      // The feature the broken line was there for must still work.
      const chip = await page.evaluate(() => {
        const r = document.getElementById('rail');
        const a = r.querySelector('a.active');
        if (!a) return { active: false };
        const ar = a.getBoundingClientRect(), rr = r.getBoundingClientRect();
        return {
          active: true,
          inside: ar.left >= rr.left - 1 && ar.right <= rr.right + 1,
          scrollable: r.scrollWidth - r.clientWidth >= 2,
          scrollLeft: Math.round(r.scrollLeft),
          text: a.textContent.trim().slice(0, 24),
        };
      });
      is(`${lane.label}: a chapter is still marked active in the rail`,
         chip.active, chip.active ? chip.text : 'none');
      if (chip.active) {
        is(`${lane.label}: active chip sits inside the rail's own box`,
           chip.inside, `scrollLeft=${chip.scrollLeft}, scrollable=${chip.scrollable}`);
        if (chip.scrollable) {
          is(`${lane.label}: rail panned horizontally to follow the chapter`,
             chip.scrollLeft > 0, `scrollLeft=${chip.scrollLeft}px`);
        }
      }

      // Clicking a rail link must STILL jump to that chapter — the fix must not
      // have killed anchor navigation.
      const jumped = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        window.scrollTo({ top: 0, behavior: 'instant' });
        await sleep(120);
        document.querySelector('.rail a[data-t="c6"]').click();
        await sleep(900); // scroll-behavior:smooth needs to land
        const t = document.getElementById('c6').getBoundingClientRect().top;
        return { top: Math.round(t), y: Math.round(window.scrollY) };
      });
      is(`${lane.label}: clicking rail chapter VI still navigates there`,
         jumped.y > 100 && Math.abs(jumped.top) < 140,
         `y=${jumped.y}, #c6 top=${jumped.top}px`);

      await page.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }

  console.log('');
  if (FAILURES.length) { console.log('FAILURES:'); FAILURES.forEach(f => console.log('  - ' + f)); }
  console.log(`${pass}/${pass + fail} pass${OLD_SPY ? '   [--old-spy NEGATIVE CONTROL: failures are REQUIRED]' : ''}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
