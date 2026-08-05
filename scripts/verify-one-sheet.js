#!/usr/bin/env node
/* verify-one-sheet.js — THE ONE-SHEET PROOF (task 3YVX72Z, Lord Vinta's call: A).
   ────────────────────────────────────────────────────────────────────────────
   scripts/verify-no-collision.js measures world.html in its RESTING state — it
   proves nothing about what happens once a human taps two launchers, because a
   sheet only exists on screen after an interaction. That blind spot is exactly
   where the bug lived: #dvWarpSheet and #dvAgentSheet are both position:fixed
   left:0 right:0 bottom:0 at z-index 1600, so opening ◈ while ✦ was up left
   BOTH mounted on identical pixels (measured 375x812: each top 584 -> bottom
   812, opacity 1). #ctSheet and #dhPanel follow the same pattern; four could
   stack.

   This script drives the real page: for every ordered PAIR of surfaces it opens
   the first, opens the second, and asserts that exactly one is open and that no
   two sheet rectangles intersect. It then asserts Escape closes whatever is up,
   and that the scrim is present while a sheet is open and gone after.

   USAGE
     node scripts/verify-one-sheet.js
     VERIFY_WIDTHS=375,1280 node scripts/verify-one-sheet.js

   Exits non-zero on any violation, so it can gate a commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

// Every full-width surface in the world and how to raise it. `open` runs in the
// page. DirHaven is included because although it is inset:0 at z1620 (it COVERS
// rather than visibly collides), leaving a sheet mounted under it means you come
// back out to a surface you never asked to still be there.
const SURFACES = [
  { id: 'warp',     sel: '#dvWarpSheet',  btn: '#dvWarpBtn',  open: () => window.DirverseHUD.open() },
  { id: 'agent',    sel: '#dvAgentSheet', btn: '#dvAgentBtn', open: () => window.DirverseHUD.openAgent() },
  { id: 'court',    sel: '#ctSheet',      btn: '#ctBtn',      open: () => window.VintCourt.open() },
  { id: 'dirhaven', sel: '#dhPanel',      btn: '#dhDoorBtn',  open: () => window.DirHavenDoor.open() },
  // THE LANTERNS. A fifth full-width sheet at the same z-band as the others, so
  // it belongs in this proof or the proof is stale the day it shipped: the whole
  // reason this script exists is that a NEW surface silently joined a stack it
  // was never measured against. It goes through the same registry (openSheet /
  // registerSheet), and this is what holds that claim to the same standard as
  // the four that came before it.
  { id: 'traces',   sel: '#dvTraceSheet', btn: '#dvTraceBtn', open: () => window.VintTraces.open() },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Which of the four surfaces are visibly up, with their rects. "Visible" means
// on-screen area, not merely `.open` — a sheet mid-transition at translateY(80%)
// is still partly drawn, so we measure the rectangle the user can actually see
// rather than trusting a class.
const PROBE = (selectors) => {
  const out = [];
  selectors.forEach(({ id, sel }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    // Off-screen (a closed sheet is translated fully below the fold).
    if (r.top >= window.innerHeight - 1 || r.bottom <= 1) return;
    out.push({
      id, sel, z: cs.zIndex,
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
    });
  });
  const scrim = document.getElementById('dvScrim');
  return {
    open: out,
    scrim: !!(scrim && scrim.classList.contains('show')),
  };
};

function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const TOKEN_KEYS = ['vint_token', 'vintinuum_token', 'token', 'vint_jwt'];

(async () => {
  const only = process.argv.slice(2);
  // THE FALSE GREEN (2026-08-05). The positional args are WIDTHS to restrict the
  // sweep to — but nothing said so, and this harness only ever loads world.html
  // (hardcoded below), so the natural `verify-one-sheet.js world.html` invocation
  // matched no width, skipped every iteration, and printed a green
  // "0 interaction checks" PASS over a page it never opened. A verifier that
  // reports success for work it did not do is worse than no verifier: it hides
  // exactly the breakage it exists to catch. So an argument that is not a known
  // width is now a loud non-zero failure, never a silent no-op.
  const bad = only.filter(a => !WIDTHS.includes(Number(a)));
  if (bad.length) {
    console.error(`\n✗ not a width: ${bad.join(', ')}`);
    console.error(`  usage: verify-one-sheet.js [width ...]   (this harness only tests world.html)`);
    console.error(`  known widths: ${WIDTHS.join(', ')}\n`);
    process.exit(2);
  }
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  // Chrome refuses to start on this box when several council seats sweep at once
  // (load average 20+): "Timed out waiting for the WS endpoint URL". That is an
  // environment failure, not a layout failure, and a run that dies there reports
  // nothing — which looks exactly like a run that found nothing. Retry with
  // backoff, and if it still cannot start, say so loudly and exit non-zero
  // rather than printing a green tick over an unverified page.
  async function launch() {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        return await puppeteer.launch({
          headless: 'new',
          protocolTimeout: 120000,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 4000 * (i + 1)));
      }
    }
    throw new Error('chrome would not start after 4 attempts: ' + lastErr.message);
  }
  const browser = await launch();

  const failures = [];
  let checks = 0;

  const page = await browser.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
    return req.abort();   // offline by design: the brain isn't running here
  });
  // Signed-in, so the Court renders its roster rather than the guest doorway and
  // every launcher is reachable. The guest paths open the same sheets.
  await page.evaluateOnNewDocument((keys) => {
    const fake = 'verify.' + 'a'.repeat(40) + '.token';
    keys.forEach(k => { try { localStorage.setItem(k, fake); } catch (_) {} });
    try {
      localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
      localStorage.setItem('vint_onboarded', '1');
      localStorage.setItem('vwg_seen', '1');
    } catch (_) {}
  }, TOKEN_KEYS);

  // A FLAT wait is a trap here, exactly as it was in verify-no-collision.js. The
  // sheets animate transform over .38s, but an EVICTED sheet and a RISING one
  // animate at once, and the DirHaven door adds its own .34s entrance — so a
  // fixed 620ms sampled a sheet mid-slide (measured #dvAgentSheet at 803->1031,
  // i.e. below an 812px fold, half-way out) and reported both "open". Worse, it
  // reported false PASSES on slower renders. So: poll every surface rect until
  // two consecutive samples are identical, then measure the settled truth.
  const settle = async () => {
    await page.evaluate(async (sels) => {
      const snap = () => sels.map(s => {
        const el = document.querySelector(s);
        if (!el) return s + ':-';
        const r = el.getBoundingClientRect();
        return `${s}:${Math.round(r.top)},${Math.round(r.bottom)},${getComputedStyle(el).opacity}`;
      }).join('|');
      let prev = '', stable = 0;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 90));
        const cur = snap();
        stable = (cur === prev) ? stable + 1 : 0;
        prev = cur;
        if (stable >= 3) break;      // ~270ms of no movement = animations done
      }
    }, SURFACES.map(s => s.sel)).catch(() => {});
  };

  for (const w of WIDTHS) {
    if (only.length && !only.includes(String(w))) continue;
    await page.setViewport({ width: w, height: 812, deviceScaleFactor: 1 });
    await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // world.html mounts its rail and reveals a guest sheet on a delay; wait for
    // the modules that own the surfaces rather than for a flat clock.
    await page.waitForFunction(
      () => window.DirverseHUD && window.VintCourt && window.DirHavenDoor,
      { timeout: 20000 }
    ).catch(() => {});
    await new Promise(r => setTimeout(r, 2200));
    // Clear whatever the page opened on its own so each pair starts from zero.
    await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
    await settle();

    for (const a of SURFACES) {
      for (const b of SURFACES) {
        if (a.id === b.id) continue;
        checks++;
        await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
        await settle();

        await page.evaluate(fn => { eval('(' + fn + ')')(); }, a.open.toString());
        await settle();
        await page.evaluate(fn => { eval('(' + fn + ')')(); }, b.open.toString());
        await settle();

        const state = await page.evaluate(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));

        // 1. exactly one surface visible
        if (state.open.length > 1) {
          const names = state.open.map(o => `${o.sel}[z${o.z} ${o.top}->${o.bottom}]`).join(' + ');
          failures.push(`${w}px  open ${a.id} then ${b.id}: ${state.open.length} surfaces up at once — ${names}`);
        }
        // 2. and none of them intersect (belt and braces: if two ever coexist
        //    deliberately later, they still may not share pixels)
        for (let i = 0; i < state.open.length; i++) {
          for (let j = i + 1; j < state.open.length; j++) {
            if (intersects(state.open[i], state.open[j])) {
              failures.push(`${w}px  open ${a.id} then ${b.id}: ${state.open[i].sel} INTERSECTS ${state.open[j].sel}`);
            }
          }
        }
        // 3. the second surface is the one that survived
        if (state.open.length === 1 && state.open[0].id !== b.id) {
          failures.push(`${w}px  open ${a.id} then ${b.id}: ${state.open[0].id} survived, expected ${b.id}`);
        }
        if (state.open.length === 0) {
          failures.push(`${w}px  open ${a.id} then ${b.id}: nothing is open — ${b.id} failed to raise`);
        }

        // 4. ESCAPE closes it (none of the four sheets implemented this before)
        await page.keyboard.press('Escape');
        await settle();
        const after = await page.evaluate(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
        if (after.open.length) {
          failures.push(`${w}px  after ${a.id}->${b.id}: Escape left ${after.open.map(o => o.sel).join(',')} open`);
        }
        // 5. the scrim never outlives the sheet it dims
        if (after.scrim) {
          failures.push(`${w}px  after ${a.id}->${b.id}: #dvScrim still showing with no sheet open`);
        }
      }
    }

    // 6. THE REAL GESTURE — tap launcher A, then TAP launcher B. Calling the API
    //    proves the eviction logic; only a real tap proves the button is still
    //    reachable. The scrim is a full-screen inset:0 layer, so if the rail sits
    //    below it, every launcher goes dead the moment a sheet opens and this
    //    exact interaction silently becomes "close" instead of "switch".
    for (const a of SURFACES) {
      for (const b of SURFACES) {
        if (a.id === b.id) continue;
        // The DirHaven door is deliberately NOT switch-from: it is an opaque
        // inset:0 panel that hides the whole rail on purpose (suppressWorldChrome),
        // because a launcher floating over a framed third-party page is its own
        // collision. You leave the door by Escape / its own close, which the pair
        // checks above already prove evicts it. So "door → X" has no launcher to
        // tap by design; only "X → door" and sheet↔sheet are switch gestures.
        if (a.id === 'dirhaven') continue;
        checks++;
        await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
        await settle();
        const tapped = await page.evaluate((sa, sb) => {
          const ea = document.querySelector(sa), eb = document.querySelector(sb);
          if (!ea || !eb) return { ok: false, why: 'launcher missing: ' + (ea ? sb : sa) };
          ea.click();
          return { ok: true };
        }, a.btn, b.btn);
        if (!tapped.ok) { failures.push(`${w}px  tap ${a.id}->${b.id}: ${tapped.why}`); continue; }
        await settle();
        // Now B, hit-tested: click whatever is actually on top of B's centre, the
        // way a finger would — not eb.click(), which ignores the stacking order.
        const hit = await page.evaluate((sb) => {
          const eb = document.querySelector(sb);
          if (!eb) return { ok: false, why: 'launcher vanished' };
          const r = eb.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top) return { ok: false, why: 'nothing at launcher centre' };
          if (!eb.contains(top) && top !== eb) {
            return { ok: false, why: '#' + (top.id || top.className || top.tagName) + ' covers the launcher' };
          }
          top.click();
          return { ok: true };
        }, b.btn);
        if (!hit.ok) { failures.push(`${w}px  tap ${a.id} then ${b.id}: ${hit.why}`); continue; }
        await settle();
        const st = await page.evaluate(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
        if (st.open.length !== 1 || st.open[0].id !== b.id) {
          const got = st.open.map(o => o.sel).join(',') || 'nothing';
          failures.push(`${w}px  TAP ${a.id} then TAP ${b.id}: expected only ${b.sel} open, got ${got}`);
        }
      }
    }
    await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
    await settle();

    // 7. the scrim IS raised while a bottom sheet is up (backdrop-to-close is
    //    half the fix; an invisible backdrop is a dead gesture). The DirHaven
    //    door is exempt: it is an opaque inset:0 panel and dims nothing.
    for (const s of SURFACES) {
      if (s.id === 'dirhaven') continue;
      checks++;
      await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
      await settle();
      await page.evaluate(fn => { eval('(' + fn + ')')(); }, s.open.toString());
      await settle();
      const st = await page.evaluate(PROBE, SURFACES.map(x => ({ id: x.id, sel: x.sel })));
      if (!st.scrim) failures.push(`${w}px  ${s.id} open but #dvScrim is not showing (backdrop-tap-to-close is dead)`);
      // tapping the scrim closes it
      await page.evaluate(() => { const e = document.getElementById('dvScrim'); if (e) e.click(); });
      await settle();
      const st2 = await page.evaluate(PROBE, SURFACES.map(x => ({ id: x.id, sel: x.sel })));
      if (st2.open.length) failures.push(`${w}px  ${s.id}: tapping #dvScrim did not close it`);
    }
  }

  await browser.close();
  srv.close();

  console.log(`\nONE-SHEET PROOF — ${checks} interaction checks across ${(only.length ? only : WIDTHS).join('/')}px\n`);
  if (failures.length) {
    console.log('✗ VIOLATIONS\n');
    failures.forEach(f => console.log('   ' + f));
    console.log(`\n${failures.length} violation(s).\n`);
    process.exit(1);
  }
  // NO CHECKS IS NOT A PASS. Zero violations out of zero checks means the sweep
  // never ran — a launcher renamed out from under SURFACES, a page that failed
  // to mount, an interception that killed the load. Every one of those is real
  // breakage that would otherwise print the same green tick as a clean run.
  if (checks === 0) {
    console.error('✗ 0 interaction checks ran — nothing was verified.\n');
    console.error('  the sweep found no launchers to drive: the page did not mount,\n' +
                  '  or SURFACES no longer matches the DOM. This is a failure, not a pass.\n');
    process.exit(1);
  }
  console.log('✓ exactly one surface open at a time, Escape closes it, scrim tracks it.\n');
})().catch(e => { console.error(e); process.exit(1); });
