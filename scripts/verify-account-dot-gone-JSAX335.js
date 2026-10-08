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
     node scripts/verify-account-dot-gone-JSAX335.js --no-occlusion   # N2E8EAP
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
/* NEGATIVE CONTROL for the collidability filter itself (N2E8EAP). --no-occlusion
   reverts isCollidable() to the bare rect test the harness shipped with, and the
   guest phone.html run MUST go red on #vwg-pill × #installDismissBtn — that is
   what proves the filter is load-bearing and is what closed the ratchet, rather
   than the ratchet having been deleted on an argument.
   The complementary direction is already covered by --control: there, the
   signed-in lane has a token, #pairScreen is down, and the SAME pair is reported
   as a real failure (#vwg-dot × #installDismissBtn) — so the filter tracks
   reachability, not convenience. */
const NO_OCCLUSION = process.argv.includes('--no-occlusion');

/* THE RATCHET — NOW EMPTY (closed by card N2E8EAP, 2026-10-08).
   It briefly held `phone.html|#installDismissBtn`, a 7-9px #vwg-pill overlap
   this harness reported on the guest render of phone.html. N2E8EAP measured it
   and found TWO separate things wrong, neither of them a missing dock feature:

   1. THE PROBE WAS NOT MEASURING WHAT A PERSON CAN TOUCH. On a guest render
      phone.html shows #pairScreen — `position:fixed; inset:0; background:#050812`,
      an OPAQUE full-screen overlay — because the pill exists only while
      welcome-gate's token() is empty, which is exactly when phone.html's TOKEN()
      is empty, which calls showPairScreen(). So the install card was buried:
      MEASURED, document.elementFromPoint at #installDismissBtn's centre returned
      #pairScreen at 320/375/768px. A float cannot collide with something nobody
      can see or tap. isCollidable() below now clips each control to its scroll
      ancestors and requires it to be the element actually painted there.

   2. THERE WAS STILL A REAL BUG, in one narrow window. redeemCode() wrote the
      pair tokens straight to localStorage and dispatched nothing, so
      welcome-gate never heard the auth flip (`storage` does not fire in the tab
      that wrote it) and hidePairScreen() 800ms later exposed the body view with
      the guest pill still on top of it — the 7px overlap, now on a reachable
      button, until the next reload. Fixed by dispatching 'vint:auth' on pair
      success; the PAIRED-IN-SESSION lane below is the proof.

   The set may only ever SHRINK, and it is now empty: ANY #vwg-pill overlap with
   a collidable control fails the run. Do not add an entry here to make a red run
   green — fix the collision, or prove the control is not collidable. */
const KNOWN_OPEN = new Set();
const knownSeen = new Set();
/* Rect-overlaps the probe FILTERED OUT as not collidable, surfaced at the end of
   the run. This exists so the filter can never hide something quietly: if a pair
   shows up here that a person can actually touch, isCollidable() is the bug. */
const buriedSeen = new Map();
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

  /* CLIP TO EVERY SCROLL ANCESTOR, THEN ASK WHO IS ACTUALLY PAINTED THERE
     (N2E8EAP; the rule from task NFQ2EU6). A rect is not a thing a person can
     collide with. Two ways it lies:

       • CLIPPING — getBoundingClientRect() reports geometry even for the part
         of an element its `overflow:auto` ancestor has scrolled out of view.
         phone.html's cards live in #viewBody, a scrolling column.
       • OCCLUSION — an opaque overlay above the control (phone.html's
         #pairScreen, z-index 9999, inset:0) makes it unreachable. A float
         "overlapping" it overlaps nothing the user has.

     So: intersect the control's rect with every clipping ancestor, and require
     the surviving centre to actually hit that control. Returns the clipped rect
     (truthy) or null.

     This is deliberately NARROW so it cannot launder a real collision:
       — only the control is tested, never the float;
       — the hit must be the control itself or something INSIDE it, so a sibling
         painted on top disqualifies it;
       — the float is temporarily made pointer-transparent for the test, so the
         float covering the control can never be the reason the control is
         judged unreachable. That one inversion would have made this harness
         bless the exact JSAX335 bug it exists to catch, and `--control`
         (which re-creates #vwg-dot on .chat-send-btn) is what proves it does not. */
  const clipToScrollers = el => {
    const r = el.getBoundingClientRect();
    let top = r.top, bottom = r.bottom, left = r.left, right = r.right;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowY !== 'visible') { top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); }
      if (cs.overflowX !== 'visible') { left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
      if (bottom - top <= 0 || right - left <= 0) return null;
    }
    // ...and clipped to the viewport, which clips everything.
    top = Math.max(top, 0); left = Math.max(left, 0);
    bottom = Math.min(bottom, innerHeight); right = Math.min(right, innerWidth);
    if (bottom - top <= 0 || right - left <= 0) return null;
    return { top, bottom, left, right };
  };

  const isCollidable = (el, floats) => {
    if (window.__N2E_NO_OCCLUSION) return el.getBoundingClientRect();
    const box = clipToScrollers(el);
    if (!box) return null;
    const saved = floats.map(f => [f, f.style.pointerEvents]);
    saved.forEach(([f]) => { f.style.pointerEvents = 'none'; });
    let painted = null;
    try {
      painted = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    } catch (_) {}
    saved.forEach(([f, v]) => { f.style.pointerEvents = v; });
    if (!painted) return null;
    return (painted === el || el.contains(painted)) ? box : null;
  };

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
  const buried = [];
  for (const g of gate) {
    const gr = g.getBoundingClientRect();
    for (const c of controls) {
      if (g.contains(c) || c.contains(g)) continue;
      const cr = c.getBoundingClientRect();
      if (!hit(gr, cr)) continue;
      const name = c.id ? '#' + c.id : (c.className && typeof c.className === 'string'
        ? '.' + c.className.trim().split(/\s+/)[0] : c.tagName.toLowerCase());
      // Rect-overlap is necessary but not sufficient — see isCollidable.
      const box = isCollidable(c, gate);
      if (!box) { buried.push({ gate: g.id, other: name }); continue; }
      const ox = Math.min(gr.right, box.right) - Math.max(gr.left, box.left);
      const oy = Math.min(gr.bottom, box.bottom) - Math.max(gr.top, box.top);
      if (ox <= 0 || oy <= 0) { buried.push({ gate: g.id, other: name }); continue; }
      overlaps.push({ gate: g.id, other: name, overlap: Math.round(Math.min(ox, oy)) });
    }
  }

  return {
    hasDot: !!dot,
    hasPill: !!pill,
    pillDraggableAttr: pill ? pill.getAttribute('data-draggable') : null,
    // body/draggable.js stamps _vintDrag on every element it adopts.
    pillAdopted: pill ? !!pill._vintDrag : null,
    overlaps,
    // Reported, never asserted: rect-overlaps that are NOT collidable (clipped
    // out of a scroller, or under an opaque overlay). Printed at the end so a
    // filtered pair can never vanish silently — if one of these is real, it is
    // visible in the run output and this filter is what to re-examine.
    buried,
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
      if (NO_OCCLUSION) await page.evaluateOnNewDocument(() => { window.__N2E_NO_OCCLUSION = true; });

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

        (r.buried || []).forEach(b => {
          const k = `${file}|#${b.gate} × ${b.other}`;
          buriedSeen.set(k, (buriedSeen.get(k) || 0) + 1);
        });

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

  // ── N2E8EAP LANE 1: THE PAIRED-IN-SESSION WINDOW ──────────────────────────
  // The ONLY state in which the reported #vwg-pill × #installDismissBtn overlap
  // is reachable by a person. Steady-state guest has #pairScreen (opaque,
  // inset:0) over the whole body view, so nothing the pill covers there is
  // touchable; but redeemCode() used to write the pair tokens with no
  // announcement, so hidePairScreen() exposed the body view 800ms later with the
  // guest pill still floating on it. We reproduce the flip the way the pairing
  // code does it — write the token, dispatch 'vint:auth', hide the pair screen —
  // and assert the pill is gone BEFORE the card is exposed.
  if (!only.length || only.some(o => 'phone.html'.includes(o))) {
    for (const w of [320, 375, 393, 768]) {
      const p = await newPageSafe();
      p.on('dialog', d => d.dismiss().catch(() => {}));
      await p.setRequestInterception(true);
      p.on('request', req => {
        const u = req.url();
        if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
        return req.abort();
      });
      await p.evaluateOnNewDocument((keys) => {
        try {
          keys.forEach(k => localStorage.removeItem(k));
          localStorage.removeItem('vint_user');
          localStorage.setItem('vwg_seen', '1');
        } catch (_) {}
      }, TOKEN_KEYS);
      await p.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
      try { await p.goto(`${base}/phone.html`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
      catch (_) { await p.close(); continue; }
      await settle(p);

      const before = await p.evaluate(() => {
        const ps = document.getElementById('pairScreen');
        return { pill: !!document.getElementById('vwg-pill'), pair: ps ? getComputedStyle(ps).display : 'absent' };
      });
      ok(before.pill, `phone.html @${w}px pre-pair: the guest pill is up`, JSON.stringify(before));
      ok(before.pair === 'flex', `phone.html @${w}px pre-pair: #pairScreen covers the body view`, `display=${before.pair}`);

      const after = await p.evaluate(async () => {
        // Exactly what redeemCode() does on success, in order.
        localStorage.setItem('vint_access_token', 'paired.' + 'a'.repeat(40) + '.token');
        window.dispatchEvent(new Event('vint:auth'));
        await new Promise(r => setTimeout(r, 400));
        const ps = document.getElementById('pairScreen');
        if (ps) ps.style.display = 'none';          // hidePairScreen()
        await new Promise(r => setTimeout(r, 400));
        const pill = document.getElementById('vwg-pill');
        const dis = document.getElementById('installDismissBtn');
        let overlap = 0;
        if (pill && dis) {
          const a = pill.getBoundingClientRect(), b = dis.getBoundingClientRect();
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0 && oy > 0) overlap = Math.round(Math.min(ox, oy));
        }
        return { pill: !!pill, dot: !!document.getElementById('vwg-dot'), overlap };
      });
      ok(!after.pill, `phone.html @${w}px paired in-session: the guest pill is GONE`, JSON.stringify(after));
      ok(!after.dot, `phone.html @${w}px paired in-session: no account dot takes its place`, JSON.stringify(after));
      ok(after.overlap === 0, `phone.html @${w}px paired in-session: nothing overlaps #installDismissBtn`,
         `overlap=${after.overlap}px`);
      await p.close();
    }
  }

  // ── N2E8EAP LANE 2: THE DOCK TRACKS AN IN-FLOW OBSTACLE THROUGH SCROLL ────
  // corner_dock.js gained avoid()-for-in-flow-obstacles for this card. The
  // capability is dormant in shipped code (phone.html's own fix turned out to be
  // the auth announcement above, and lifting a float inside a tall scroller was
  // MEASURED to chase content into NEW collisions — see the warning in
  // corner_dock.js). Dormant is not untested: exercise it directly, or the next
  // agent inherits code nobody ever ran.
  {
    const p = await newPageSafe();
    p.on('dialog', d => d.dismiss().catch(() => {}));
    await p.setRequestInterception(true);
    p.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    await p.evaluateOnNewDocument((keys) => {
      try { keys.forEach(k => localStorage.removeItem(k)); localStorage.setItem('vwg_seen', '1'); } catch (_) {}
    }, TOKEN_KEYS);
    await p.setViewport({ width: 375, height: 800, deviceScaleFactor: 1 });
    await p.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(p);

    const dock = await p.evaluate(async () => {
      if (!window.VintDock || !window.VintDock.avoid) return { api: false };
      // A scroller with an in-flow obstacle 600px down it.
      const sc = document.createElement('div');
      sc.id = 'n2e-scroller';
      sc.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:300px;overflow-y:auto;z-index:1;';
      const inner = document.createElement('div');
      inner.style.cssText = 'height:1200px;position:relative;';
      const obs = document.createElement('div');
      obs.id = 'n2e-obstacle';
      obs.style.cssText = 'position:absolute;top:600px;left:0;width:100%;height:40px;background:#123;';
      inner.appendChild(obs); sc.appendChild(inner); document.body.appendChild(sc);

      const pill = document.getElementById('vwg-pill');
      if (!pill) { sc.remove(); return { api: true, pill: false }; }

      const flowBefore = window.VintDock._hasFlowAvoid();
      window.VintDock.avoid(obs, { corner: 'br' });
      window.VintDock.reflow();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const flowAfter = window.VintDock._hasFlowAvoid();

      // Obstacle is scrolled far out of the scroller's visible box → CLIPPED
      // away → it must not lift anything.
      const clipped = parseFloat(getComputedStyle(pill).bottom);

      // Scroll it into view. No reflow() call — the dock's own scroll listener
      // must do this, which is the whole point of the lane.
      sc.scrollTop = 480;                       // obstacle now at ~120px in the box
      await new Promise(r => setTimeout(r, 300));
      const lifted = parseFloat(getComputedStyle(pill).bottom);

      // Scroll it back out; the lift must be given back.
      sc.scrollTop = 0;
      await new Promise(r => setTimeout(r, 300));
      const released = parseFloat(getComputedStyle(pill).bottom);

      window.VintDock.unavoid(obs);
      sc.remove();
      window.VintDock.reflow();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { api: true, pill: true, flowBefore, flowAfter, clipped, lifted, released };
    });

    ok(dock.api === true, 'VintDock exposes avoid()/unavoid()', JSON.stringify(dock));
    if (dock.pill) {
      ok(dock.flowBefore === false && dock.flowAfter === true,
         'dock: registering an in-flow obstacle arms scroll tracking (and fixed-only does not)',
         `before=${dock.flowBefore} after=${dock.flowAfter}`);
      ok(dock.lifted > dock.clipped + 20,
         'dock: scrolling an in-flow obstacle INTO view lifts the stack, with no reflow() call',
         `clipped=${dock.clipped}px lifted=${dock.lifted}px`);
      ok(Math.abs(dock.released - dock.clipped) < 2,
         'dock: scrolling it back out gives the lift back (clipped obstacle is not an obstacle)',
         `clipped=${dock.clipped}px released=${dock.released}px`);
    }
    await p.close();
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

  // Everything the collidability filter removed, in the open.
  if (buriedSeen.size) {
    console.log(`ℹ ${buriedSeen.size} rect-overlap(s) filtered as NOT collidable`);
    console.log(`  (clipped out of a scroller, or under an opaque overlay — a float cannot`);
    console.log(`   collide with something nobody can see or tap. If one of these IS reachable,`);
    console.log(`   isCollidable() in this file is the defect, not the ratchet.)`);
    [...buriedSeen.entries()].sort().forEach(([k, n]) => console.log(`    ${k}  ×${n} render(s)`));
  }

  if (!failures.length) {
    console.log(`${pass}/${checks} pass — ${pages.length} pages × ${WIDTHS.length} widths × 2 auth states`);
    console.log(`  ratchet: KNOWN_OPEN is EMPTY (closed by N2E8EAP) — zero tolerated overlaps`);
    const bad = CONTROL || NO_OCCLUSION;
    console.log(`  widths: ${WIDTHS.join(', ')}${bad ? '   [CONTROL RUN — this SHOULD have failed]' : ''}`);
    process.exit(bad ? 1 : (skipped.length ? 2 : 0));
  }

  console.log(`${pass}/${checks} pass\n\nFAILURES:`);
  failures.slice(0, 60).forEach(f => console.log(`  ✗ ${f.label}${f.detail ? '  — ' + f.detail : ''}`));
  if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
  process.exit((CONTROL || NO_OCCLUSION) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
