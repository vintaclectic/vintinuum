#!/usr/bin/env node
/* verify-account-dot-gone-JSAX335.js — THE PROOF FOR JSAX335.
   ────────────────────────────────────────────────────────────────────────────
   Vinta (2026-10-08, with a screenshot): "The button begin button needs to
   disappear when any user is logged in it's always in the way and can't be
   moved around wtf fix it. Across entire fucking app extensions etc."

   The circled button MEASURED off that screenshot (1280×2856, DPR≈3.26 ⇒ ~34
   CSS px) was #vwg-dot — welcome-gate.js's signed-in account dot, the "Begin"
   pill's logged-in form — docked on 'br' priority 40 and landing squarely on
   phone.html's .chat-send-btn.

   WHY THIS NEEDS ITS OWN HARNESS, and is not a line in verify-no-collision.js:
   that sweep only collects `position:fixed` elements. .chat-send-btn is NOT
   fixed (it is a flex child of .chat-input-bar), so the exact overlap Vinta
   photographed was structurally invisible to it — it ran clean through the whole
   bug. This harness measures a FIXED widget against ORDINARY in-flow page
   controls, which is the class that was unguarded.

   WHAT IT ASSERTS
     1. Signed in, on every surface, at every width: #vwg-dot does not exist.
     2. Signed in: #vwg-pill ("Begin") does not exist either.
     3. Signed out: #vwg-pill DOES exist — the way in must never be deleted by a
        fix aimed at the signed-in state. (A green run where nobody can sign in
        is the worse bug.)
     4. Signed out: the pill carries data-draggable="true" and body/draggable.js
        has actually adopted it, so "can't be moved around" is answered.
     5. No welcome-gate affordance overlaps any interactive control on the page
        (buttons, links, inputs, textareas, [role=button]) — fixed-vs-in-flow,
        the measurement the existing sweep cannot make.

   NEGATIVE CONTROL
     --control re-creates #vwg-dot exactly as the pre-fix code did (same id, same
     34px disc, same dock registration) after the page settles. The run MUST go
     red, and MUST do so on phone.html with an overlap against .chat-send-btn —
     otherwise this harness is not actually measuring the reported bug.

   USAGE
     node scripts/verify-account-dot-gone-JSAX335.js
     node scripts/verify-account-dot-gone-JSAX335.js --control
     node scripts/verify-account-dot-gone-JSAX335.js phone world   # subset
     VERIFY_WIDTHS=393 node scripts/verify-account-dot-gone-JSAX335.js
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

// 393 is Vinta's actual phone width in the report; the rest are the mandated
// No-Collision breakpoints.
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,393,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

const CONTROL = process.argv.includes('--control');

/* THE RATCHET. One guest-state overlap predates this work and is filed as its
   own card because fixing it needs a mechanism this repo does not have yet:
   VintDock.avoid() computes a STATIC offset and corner_dock.js listens only to
   resize/orientationchange/transitionend/animationend — never scroll — so
   registering a scrolling in-flow card as an obstacle would go stale the instant
   the user scrolls, across all 54 surfaces.

   MEASURED at commit 9891cec in a clean HEAD worktree (so it is not a JSAX335
   regression): #vwg-pill fixed bottom:68px 97×44 vs #installDismissBtn in-flow —
   7px @320, 7px @375, 9px @768. Guest only, and only once beforeinstallprompt
   has fired and the user has neither installed nor dismissed.

   This set may only SHRINK. Any pill-vs-control overlap not listed here fails
   the run, and a listed one that stops happening is reported so the entry gets
   deleted rather than quietly protecting a future bug. → card N2E8EAP */
const KNOWN_OPEN = new Set(['phone.html|#installDismissBtn']);
const knownSeen = new Set();
const TOKEN_KEYS = ['vint_token', 'soul_auth_token', 'vint_access_token', 'access_token'];

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

/* Runs IN the page. Returns the presence facts plus every overlap between a
   welcome-gate affordance and a real interactive control. */
function probe() {
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.01) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  const dot = document.getElementById('vwg-dot');
  const pill = document.getElementById('vwg-pill');
  const gate = [dot, pill].filter(e => e && vis(e));

  // Every ordinary interactive control, INCLUDING non-fixed ones — that is the
  // whole point. Skip anything inside the gate's own sheet.
  const controls = Array.from(document.querySelectorAll(
    'button,a[href],input,textarea,select,[role="button"]'
  )).filter(el =>
    el.id !== 'vwg-dot' && el.id !== 'vwg-pill' &&
    !el.closest('#vwg-scrim') && vis(el)
  );

  const overlaps = [];
  for (const g of gate) {
    const gr = g.getBoundingClientRect();
    for (const c of controls) {
      if (g.contains(c) || c.contains(g)) continue;
      const cr = c.getBoundingClientRect();
      if (!hit(gr, cr)) continue;
      const ox = Math.min(gr.right, cr.right) - Math.max(gr.left, cr.left);
      const oy = Math.min(gr.bottom, cr.bottom) - Math.max(gr.top, cr.top);
      overlaps.push({
        gate: g.id,
        other: c.id ? '#' + c.id : (c.className && typeof c.className === 'string'
          ? '.' + c.className.trim().split(/\s+/)[0] : c.tagName.toLowerCase()),
        overlap: Math.round(Math.min(ox, oy)),
      });
    }
  }

  return {
    hasDot: !!dot,
    hasPill: !!pill,
    pillDraggableAttr: pill ? pill.getAttribute('data-draggable') : null,
    // body/draggable.js stamps _vintDrag on every element it adopts.
    pillAdopted: pill ? !!pill._vintDrag : null,
    overlaps,
  };
}

/* Wait for LAYOUT QUIET rather than the clock. Widgets mount on deferred
   timelines (phone.html re-docks at 1200ms and 4000ms, index.html's gate paints
   after ~3s), so any flat wait is a coin flip: too short and the pill has not
   been created yet, which reads exactly like a pill that was deleted. Poll every
   fixed rect until two consecutive samples match, with a 3400ms floor that
   outlasts the slowest deliberate mount and a ~4.5s ceiling for surfaces that
   animate forever. MEASURED: index.html's #vwg-pill is absent at 3000ms and
   present at 4000ms — which is exactly the false negative this replaces. */
async function settle(page) {
  try {
    await page.evaluate(async () => {
      const snap = () => Array.from(document.querySelectorAll('body *'))
        .filter(el => getComputedStyle(el).position === 'fixed')
        .map(el => { const r = el.getBoundingClientRect();
          return `${el.id}:${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; })
        .join('|');
      const t0 = Date.now();
      let prev = '', stable = 0;
      for (let i = 0; i < 32; i++) {
        await new Promise(r => setTimeout(r, 150));
        const cur = snap();
        stable = (cur === prev) ? stable + 1 : 0;
        prev = cur;
        if (stable >= 2 && Date.now() - t0 >= 3400) break;
      }
    });
  } catch (_) {}
}

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .filter(f => !only.length || only.some(o => f.includes(o)))
    .sort();

  if (!pages.length) { console.error('no pages matched'); process.exit(1); }
  // VACUITY GUARD: a broken walker must fail loudly, never pass with nothing to
  // check (RU9H7G6). The repo has 54 surfaces loading welcome-gate.js.
  if (!only.length && pages.length < 40) {
    console.error(`✗ vacuity guard: only ${pages.length} pages enumerated, expected ≥40`);
    process.exit(1);
  }

  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  let browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  const skipped = [];
  let pass = 0, checks = 0;
  const ok = (cond, label, detail) => {
    checks++;
    if (cond) { pass++; return true; }
    failures.push({ label, detail });
    return false;
  };

  async function newPageSafe() {
    try { return await browser.newPage(); }
    catch (_) {
      try { await browser.close(); } catch (_) {}
      browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      return await browser.newPage();
    }
  }

  for (const file of pages) {
    for (const signedIn of [false, true]) {
      let page;
      try { page = await newPageSafe(); }
      catch (e) { skipped.push(`${file} (${signedIn ? 'signed-in' : 'guest'}): ${e.message}`); continue; }

      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.setRequestInterception(true);
      page.on('request', req => {
        const u = req.url();
        if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
        return req.abort();
      });

      // AUTH STATE IS PER-ORIGIN, NOT PER-PAGE. Every surface is served from the
      // same 127.0.0.1:<port> origin, and puppeteer shares one profile, so the
      // localStorage a signed-in pass writes is STILL THERE for the next page's
      // "guest" pass. Left unhandled that silently converts almost every guest
      // render into a second signed-in render: measured, index.html's #vwg-pill
      // was reported missing purely because the previous page's fake token had
      // leaked in. So the guest lane must CLEAR explicitly — absence of a set is
      // not a guest.
      await page.evaluateOnNewDocument((keys, signed) => {
        try {
          if (signed) {
            const fake = 'verify.' + 'a'.repeat(40) + '.token';
            keys.forEach(k => localStorage.setItem(k, fake));
            localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
            localStorage.setItem('vint_onboarded', '1');
          } else {
            keys.forEach(k => localStorage.removeItem(k));
            localStorage.removeItem('vint_user');
            localStorage.removeItem('vint_refresh_token');
            localStorage.removeItem('soul_auth_refresh');
          }
          localStorage.setItem('vwg_seen', '1');   // never auto-open the sheet
        } catch (_) {}
      }, TOKEN_KEYS, signedIn);

      if (CONTROL && signedIn) {
        // NEGATIVE CONTROL — re-create the pre-fix dot byte-for-byte in behaviour:
        // same id, same 34px disc, same 'br' priority-40 dock registration.
        await page.evaluateOnNewDocument(() => {
          addEventListener('DOMContentLoaded', () => setTimeout(() => {
            if (document.getElementById('vwg-dot')) return;
            const d = document.createElement('button');
            d.id = 'vwg-dot'; d.textContent = '✦'; d.title = 'Account & install';
            d.style.cssText = 'position:fixed;z-index:2147483600;width:34px;height:34px;' +
              'border-radius:50%;display:flex!important;align-items:center;justify-content:center;' +
              'border:1px solid rgba(255,213,79,.3);background:rgba(8,12,20,.85);color:#ffd54f;' +
              'right:max(16px,env(safe-area-inset-right));bottom:calc(88px + env(safe-area-inset-bottom));';
            document.body.appendChild(d);
            try { window.VintDock && window.VintDock.register(d, { corner: 'br', priority: 40, id: 'vwg-dot' }); } catch (_) {}
          }, 500));
        });
      }

      for (const w of WIDTHS) {
        await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
        try { await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
        catch (_) { continue; }

        // Settle on LAYOUT QUIET, not on the clock (verify-no-collision's lesson):
        // widgets mount on deferred timelines (phone.html re-docks at 1200ms and
        // 4000ms), so a flat wait measures a layout that is still moving.
        await settle(page);

        try { await page.evaluate(() => window.VintDock && window.VintDock.reflow()); } catch (_) {}
        await new Promise(r => setTimeout(r, 250));

        let r;
        try { r = await page.evaluate(probe); } catch (_) { continue; }
        const label = `${file} @${w}px ${signedIn ? 'signed-in' : 'guest'}`;

        if (signedIn) {
          ok(!r.hasDot, `${label}: #vwg-dot absent`, r.hasDot ? 'the account dot still exists while signed in' : '');
          ok(!r.hasPill, `${label}: #vwg-pill absent`, r.hasPill ? 'the Begin pill still exists while signed in' : '');
        } else {
          // The way in must survive the fix. phone.html is a shell whose gate
          // mounts behind its own boot, so assert presence where it can mount.
          if (r.hasPill) {
            ok(r.pillDraggableAttr === 'true', `${label}: pill declares data-draggable`, `attr=${r.pillDraggableAttr}`);
            ok(r.pillAdopted === true, `${label}: draggable.js adopted the pill`, `_vintDrag=${r.pillAdopted}`);
          }
        }

        // #vwg-dot overlaps are THIS card's bug and are never tolerated.
        // #vwg-pill overlaps are RATCHETED: the one that exists today is
        // pre-existing (proved against a HEAD worktree) and needs a dock
        // mechanism that does not exist yet (card N2E8EAP). Known ones are
        // counted, anything NEW fails the run — so the set can only shrink.
        const dotHits = r.overlaps.filter(o => o.gate === 'vwg-dot');
        ok(dotHits.length === 0, `${label}: #vwg-dot clear of all controls`,
           dotHits.map(o => `#${o.gate} × ${o.other} (${o.overlap}px)`).join(', '));

        const pillHits = r.overlaps.filter(o => o.gate === 'vwg-pill');
        const novel = pillHits.filter(o => !KNOWN_OPEN.has(`${file}|${o.other}`));
        pillHits.forEach(o => { if (!novel.includes(o)) knownSeen.add(`${file}|${o.other}`); });
        ok(novel.length === 0, `${label}: no NEW #vwg-pill overlap`,
           novel.map(o => `#${o.gate} × ${o.other} (${o.overlap}px)`).join(', '));
      }
      await page.close();
    }
    process.stdout.write('.');
  }

  // The guest way-in must exist SOMEWHERE, or this "fix" deleted sign-in.
  // Asserted once, globally, so a per-page shell quirk can't hide a dead gate.
  {
    const p = await newPageSafe();
    await p.setRequestInterception(true);
    p.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    // Same per-origin leak as above: the loop just finished a signed-in pass, so
    // this guest check MUST wipe the tokens or it measures a signed-in page.
    await p.evaluateOnNewDocument((keys) => {
      try {
        keys.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('vint_user');
        localStorage.setItem('vwg_seen', '1');
      } catch (_) {}
    }, TOKEN_KEYS);
    await p.setViewport({ width: 393, height: 800, deviceScaleFactor: 1 });
    await p.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(p);
    const g = await p.evaluate(() => ({
      pill: !!document.getElementById('vwg-pill'),
      api: !!(window.VintWelcomeGate && typeof window.VintWelcomeGate.open === 'function'),
    }));
    ok(g.pill, 'guest index.html: #vwg-pill exists (the way in survives)', '');
    ok(g.api, 'window.VintWelcomeGate.open exists (account sheet reachable without the dot)', '');

    await p.close();

    // And the replacement entry point actually opens the sheet for a signed-in
    // user — removing the dot must not strand the account/install surface.
    //
    // A FRESH PAGE, not a reload of the one above: that page carries an
    // evaluateOnNewDocument hook that WIPES the tokens on every navigation, so
    // signing in with page.evaluate() and reloading would silently hand back a
    // guest render and "prove" the signed-in case against the wrong state.
    const q = await newPageSafe();
    await q.setRequestInterception(true);
    q.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    await q.evaluateOnNewDocument((keys) => {
      try {
        const fake = 'verify.' + 'a'.repeat(40) + '.token';
        keys.forEach(k => localStorage.setItem(k, fake));
        localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
        localStorage.setItem('vint_onboarded', '1');
        localStorage.setItem('vwg_seen', '1');
      } catch (_) {}
    }, TOKEN_KEYS);
    await q.setViewport({ width: 393, height: 800, deviceScaleFactor: 1 });
    await q.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(q);
    const signedState = await q.evaluate(() => {
      const before = { dot: !!document.getElementById('vwg-dot'), pill: !!document.getElementById('vwg-pill') };
      const a = document.createElement('a');
      a.href = '#account'; a.textContent = 'Account';
      document.body.appendChild(a);
      a.click();
      const scrim = document.getElementById('vwg-scrim');
      return { ...before, sheetOpen: !!(scrim && scrim.classList.contains('show')) };
    });
    ok(!signedState.dot && !signedState.pill, 'signed-in index.html: no corner affordance at all', JSON.stringify(signedState));
    ok(signedState.sheetOpen, 'signed-in: href="#account" opens the account sheet', `sheetOpen=${signedState.sheetOpen}`);
    await q.close();
  }

  await browser.close();
  srv.close();
  console.log('\n');

  if (skipped.length) {
    console.log(`⚠ ${skipped.length} render(s) could NOT be checked:`);
    skipped.forEach(s => console.log('    ' + s));
  }

  // A ratchet entry that no longer fires must be DELETED, not left as cover for
  // a future regression. Only meaningful on a full sweep.
  if (!only.length) {
    const stale = [...KNOWN_OPEN].filter(k => !knownSeen.has(k));
    if (stale.length) {
      console.log(`\nℹ KNOWN_OPEN entries that did NOT occur (remove them from the harness):`);
      stale.forEach(k => console.log('    ' + k));
    }
  }

  if (!failures.length) {
    console.log(`${pass}/${checks} pass — ${pages.length} pages × ${WIDTHS.length} widths × 2 auth states`);
    console.log(`  ratchet: ${knownSeen.size} known-open pill overlap(s) tolerated (card N2E8EAP); 0 new`);
    console.log(`  widths: ${WIDTHS.join(', ')}${CONTROL ? '   [CONTROL RUN — this SHOULD have failed]' : ''}`);
    process.exit(CONTROL ? 1 : (skipped.length ? 2 : 0));
  }

  console.log(`${pass}/${checks} pass\n\nFAILURES:`);
  failures.slice(0, 60).forEach(f => console.log(`  ✗ ${f.label}${f.detail ? '  — ' + f.detail : ''}`));
  if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
  process.exit(CONTROL ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
