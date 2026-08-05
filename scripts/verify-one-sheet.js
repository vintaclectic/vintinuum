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

   DETERMINISM (task VMWTTKU) — this proof never guesses when the page is ready.
   Every measurement is taken only after the surfaces' OWN completion signals say
   the animation is over: transitionrun/animationstart vs. transitionend/-cancel
   counted from a listener installed before page scripts run, cross-checked
   against Element.getAnimations(), and cross-checked again against agreement
   between `.open` and the measured rect. It advances per animation frame and is
   bounded by a 15s deadline — ~40x the longest authored animation (.38s) — so a
   starved CPU makes it slower, never wrong, while a genuinely stuck page still
   ends the run instead of hanging it. Failure to settle exits 2 ("harness
   unsettled") instead of inventing a layout violation — a flaky verifier trains
   everyone to ignore it, which is worse than none.

   USAGE
     node scripts/verify-one-sheet.js
     VERIFY_WIDTHS=375,1280 node scripts/verify-one-sheet.js

   EXITS  0 = proven clean · 1 = real violation · 2 = harness could not settle
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

  // ── SETTLING: wait on the animation's OWN completion signal, never on a clock ─
  // A FLAT wait was a trap here, exactly as it was in verify-no-collision.js: the
  // sheets animate transform over .38s, an EVICTED sheet and a RISING one animate
  // at once, and the DirHaven door adds its own .34s entrance — so a fixed 620ms
  // sampled a sheet mid-slide (measured #dvAgentSheet at 803->1031, i.e. below an
  // 812px fold, half-way out) and reported both "open".
  //
  // The stability POLL that replaced it was a subtler trap, and it is what made
  // this proof flake at 320px under load (task VMWTTKU): it slept 90ms, then
  // demanded three consecutive identical getBoundingClientRect() samples. Under
  // CPU contention from parallel council seats, the compositor does not advance
  // the transition between polls — so three identical samples mean "the frame
  // stalled", which is indistinguishable from "the animation finished". The probe
  // then measured a sheet frozen mid-slide, or still parked at translateY(105%)
  // before its first frame had even been produced, and reported a violation that
  // did not exist: "agent survived, expected warp", "nothing is open". Different
  // fiction every run, because which frame got starved was random. A flaky
  // verifier trains everyone to ignore it, which is worse than no verifier.
  //
  // So we stop guessing from the outside and ask the engine. A surface is settled
  // when ALL THREE hold:
  //   1. no transition or animation is still running on any of the four surfaces
  //      (tracked by real transitionend/animationend/-cancel events, which fire
  //      exactly once per property per element no matter how starved the CPU is,
  //      plus getAnimations() as the authoritative in-flight census);
  //   2. the DOM's declared truth agrees with the pixels — a surface carrying
  //      `.open` is fully on-screen and one without it is fully off-fold. This is
  //      the cross-check the geometry-only poll never made, and it is what turns
  //      "I saw identical numbers" into "the state machine has arrived";
  //   3. two animation frames pass with nothing new starting, so a chained
  //      transition (evict-then-raise) cannot slip through the gap between them.
  // Timing out is a HARD FAILURE, not a shrug: an unsettled page cannot be
  // measured, and a proof that measures an unsettled page is the flake itself.
  await page.evaluateOnNewDocument((sels) => {
    // Installed before any page script runs, so no completion event can be
    // missed between load and the first settle() call.
    const W = window;
    W.__vintAnim = { running: 0, lastEnd: 0 };
    const bump = (d) => {
      W.__vintAnim.running = Math.max(0, W.__vintAnim.running + d);
      if (d < 0) W.__vintAnim.lastEnd = performance.now();
    };
    const isSurface = (t) => !!(t && t.closest && sels.some(s => t.matches && t.matches(s)));
    ['transitionrun', 'animationstart'].forEach(ev =>
      document.addEventListener(ev, e => { if (isSurface(e.target)) bump(+1); }, true));
    ['transitionend', 'transitioncancel', 'animationend', 'animationcancel'].forEach(ev =>
      document.addEventListener(ev, e => { if (isSurface(e.target)) bump(-1); }, true));
  }, SURFACES.map(s => s.sel));

  let settleTimeouts = 0;
  const navFailures = [];

  // Every interaction with the page can die for reasons that have NOTHING to do
  // with layout: the DirHaven door frames a third-party origin, so a click can
  // begin a navigation that destroys the execution context out from under the
  // very next evaluate ("Execution context was destroyed" — observed at 320px).
  // Left unguarded that propagates to the top-level catch and exits 1, the code
  // reserved for "a real violation was found". The whole point of this task is
  // that the proof must never accuse the world of a bug it did not observe, so
  // every page call funnels through here: a thrown context/target error is
  // recorded as an ENVIRONMENT fault (exit 2) and the caller gets a null it can
  // skip on, never a fabricated measurement.
  const ENV_ERR = /execution context|target closed|session closed|detached|frame got detached|navigating/i;
  const safeEval = async (fn, ...args) => {
    try {
      return await page.evaluate(fn, ...args);
    } catch (e) {
      if (ENV_ERR.test(e.message)) { navFailures.push(`${e.message.split('\n')[0]}`); return null; }
      throw e;
    }
  };

  const settle = async () => {
    const ok = await page.evaluate(async (sels) => {
      // A frame, or a timer if the compositor has stopped producing frames
      // entirely (a fully occluded/backgrounded tab). Racing the two means the
      // wait always advances, so the deadline below is always reachable and the
      // run fails loudly instead of hanging silently.
      const frame = () => new Promise(r => {
        let done = false;
        const fin = () => { if (!done) { done = true; r(); } };
        requestAnimationFrame(fin);
        setTimeout(fin, 250);
      });

      // Is every surface's declared state (.open) consistent with where it is
      // actually drawn? An opening sheet is flush to the bottom of the viewport;
      // a closed one is translated entirely below the fold. Anything in between
      // is mid-flight, whatever the event counters say.
      const agrees = () => sels.every(s => {
        const el = document.querySelector(s);
        if (!el) return true;                       // not built yet = not in flight
        const cs = getComputedStyle(el);
        if (cs.display === 'none') return true;     // #dhPanel closed: not rendered
        const r = el.getBoundingClientRect();
        const open = el.classList.contains('open');
        const onScreen = r.height > 2 && r.top < window.innerHeight - 1 && r.bottom > 1;
        // opacity must also have arrived, not be mid-fade
        const solid = parseFloat(cs.opacity) > 0.99;
        return open ? (onScreen && solid) : !onScreen;
      });

      // The authoritative census of what the engine is still animating. Event
      // counters can only be wrong in one direction (a listener attached late);
      // getAnimations() cannot — it IS the running set.
      const inFlight = () => sels.some(s => {
        const el = document.querySelector(s);
        if (!el || !el.getAnimations) return false;
        return el.getAnimations().some(a => a.playState === 'running');
      });

      // Wait for arrival, then for two clean frames on top of it.
      //
      // The budget is deliberately enormous relative to the work: the longest
      // authored animation in the world is .38s (.dv-sheet) and the door's
      // dh-rise is .34s, so 15s is ~40x headroom. That asymmetry IS the fix —
      // the old 90ms poll was tighter than the animation it measured, which is
      // why contention could beat it. Nothing legitimate takes 15s, so a page
      // that has not arrived by then is genuinely stuck, and saying "stuck" is
      // honest where reporting a layout violation would be fiction.
      //
      // Bounded by frames AND wall-clock: frames because a throttled tab may
      // coalesce rAF and a frame count alone could expire mid-slide; wall-clock
      // because a fully backgrounded tab may stop producing frames at all, and
      // a loop waiting on rAF forever would hang the run instead of failing it.
      const deadline = performance.now() + 15000;
      let quiet = 0;
      while (performance.now() < deadline) {
        await frame();
        const busy = window.__vintAnim.running > 0 || inFlight();
        quiet = (!busy && agrees()) ? quiet + 1 : 0;
        if (quiet >= 2) return true;
      }
      return false;
    }, SURFACES.map(s => s.sel)).catch((e) => {
      // Distinguish the two ways this can fail. A context that died mid-settle
      // is an ENVIRONMENT fault (the page navigated or the target closed), not
      // evidence that an animation ran long — counting it as a settle timeout
      // would blame the world's CSS for a harness casualty. Anything else is a
      // genuine failure to reach a settled state.
      if (ENV_ERR.test(e.message)) { navFailures.push(e.message.split('\n')[0]); return null; }
      return false;
    });
    if (ok === false) settleTimeouts++;
    return ok === true;
  };

  // Every check must start from a KNOWN-EMPTY page, and "I called closeSheets()"
  // is not the same as "the page is empty". world.html reveals a guest sheet on a
  // delay, an internal flow can re-raise one, and a close that lands while the
  // next open is issued produces exactly the phantom this task was filed for
  // ("nothing is open", "X survived, expected Y"). So: close, settle, VERIFY —
  // and if something is still up, close it again rather than measuring a dirty
  // page. Three tries is generous; failing to empty the page is a harness fault
  // and is reported as one.
  const reset = async () => {
    for (let i = 0; i < 3; i++) {
      await safeEval(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
      await settle();
      const st = await safeEval(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
      if (!st) continue;                       // context died mid-reset; try again
      if (!st.open.length && !st.scrim) return true;
    }
    settleTimeouts++;
    return false;
  };

  // Loading the page is an ENVIRONMENT step, not an assertion. At load average
  // 27+ (several council seats sweeping at once) a cold Chrome can exceed 25s
  // just reaching domcontentloaded — measured on this box. Left to throw, that
  // surfaces as a raw stack trace and exit 1, which is the code for "a real
  // layout violation was found": the harness would be accusing the world of a
  // bug when all that happened was a starved machine. Retry, then classify it
  // as unsettled (exit 2) — never as a violation.
  async function gotoWorld(w) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(`${base}/world.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000 * (i + 1),
        });
        return true;
      } catch (e) { lastErr = e; }
    }
    navFailures.push(`${w}px  world.html never reached domcontentloaded (${lastErr.message})`);
    return false;
  }

  for (const w of WIDTHS) {
    if (only.length && !only.includes(String(w))) continue;
    await page.setViewport({ width: w, height: 812, deviceScaleFactor: 1 });
    if (!await gotoWorld(w)) continue;
    // world.html mounts its rail and reveals a guest sheet on a delay; wait for
    // the modules that own the surfaces rather than for a flat clock.
    await page.waitForFunction(
      () => window.DirverseHUD && window.VintCourt && window.DirHavenDoor,
      { timeout: 20000 }
    ).catch(() => {});
    // The modules existing is not the same as their LAUNCHERS existing: court.js
    // and dirhaven-door.js retry `mount()` on an 80ms timer until the HUD's rail
    // is up, and world.html reveals a guest sheet on its own delay. The old flat
    // 2200ms sleep was a bet that all of that finished in time — a bet that loses
    // under contention, and loses SILENTLY (a missing launcher reads as
    // "launcher missing" or lets a self-opened sheet survive into the first pair
    // and become "X survived, expected Y"). Wait for the four buttons the proof
    // actually taps, plus registration in the sheet owner, then settle.
    await page.waitForFunction((btns) => {
      if (!btns.every(b => document.querySelector(b))) return false;
      const h = window.DirverseHUD;
      return !!(h && typeof h.anySheetOpen === 'function' && typeof h.closeSheets === 'function');
    }, { timeout: 20000, polling: 'raf' }, SURFACES.map(s => s.btn)).catch(() => {});
    // Clear whatever the page opened on its own so each pair starts from zero.
    await reset();

    for (const a of SURFACES) {
      for (const b of SURFACES) {
        if (a.id === b.id) continue;
        checks++;
        await reset();

        // Each open is verified to have LANDED before the next one is issued.
        // Firing b's open while a is still rising is a legitimate thing for a
        // human to do, but it is not what THIS assertion is about — this pair
        // proves eviction, and eviction can only be judged from a known start.
        // (The real racing gesture is proven by the tap loop below, which the
        // page's own openSheet() serialises.)
        await safeEval(fn => { eval('(' + fn + ')')(); }, a.open.toString());
        await settle();
        await safeEval(fn => { eval('(' + fn + ')')(); }, b.open.toString());
        await settle();

        const state = await safeEval(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
        if (!state) continue;   // context died: unmeasured, not violated

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
        const after = await safeEval(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
        if (!after) continue;
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
        await reset();
        const tapped = await safeEval((sa, sb) => {
          const ea = document.querySelector(sa), eb = document.querySelector(sb);
          if (!ea || !eb) return { ok: false, why: 'launcher missing: ' + (ea ? sb : sa) };
          ea.click();
          return { ok: true };
        }, a.btn, b.btn);
        if (!tapped) continue;
        if (!tapped.ok) { failures.push(`${w}px  tap ${a.id}->${b.id}: ${tapped.why}`); continue; }
        await settle();
        // Now B, hit-tested: click whatever is actually on top of B's centre, the
        // way a finger would — not eb.click(), which ignores the stacking order.
        //
        // The hit-test must distinguish a launcher that is COVERED from one that
        // was momentarily behind a sheet still leaving the screen. A single
        // elementFromPoint cannot tell those apart, and at 320px under load it
        // reported "#SMALL covers the launcher" — a <small> inside a sheet
        // mid-slide — while the settled truth was clean (measured: #dvWarpBtn
        // 526..572, #dvAgentSheet 584..812, no overlap, topmost element at the
        // launcher's centre its own SPAN.lbl). A real collision is PERMANENT, so
        // we re-test across frames and only fail if the obstruction persists.
        // Anything that clears was never a collision, and reporting it as one is
        // the flake this task exists to kill.
        const hit = await safeEval((sb) => new Promise(resolve => {
          const eb = document.querySelector(sb);
          if (!eb) return resolve({ ok: false, why: 'launcher vanished' });
          let tries = 0, lastWhy = '';
          const probe = () => {
            const r = eb.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (top && (eb.contains(top) || top === eb)) { top.click(); return resolve({ ok: true }); }
            lastWhy = top
              ? '#' + (top.id || top.className || top.tagName) + ' covers the launcher'
              : 'nothing at launcher centre';
            // ~30 frames (half a second at 60fps, longer when throttled) is far
            // more than the .38s slide needs to finish clearing the button.
            if (++tries >= 30) return resolve({ ok: false, why: lastWhy + ' (persisted 30 frames)' });
            requestAnimationFrame(probe);
          };
          requestAnimationFrame(probe);
        }), b.btn);
        if (!hit) continue;
        if (!hit.ok) { failures.push(`${w}px  tap ${a.id} then ${b.id}: ${hit.why}`); continue; }
        await settle();
        const st = await safeEval(PROBE, SURFACES.map(s => ({ id: s.id, sel: s.sel })));
        if (!st) continue;
        if (st.open.length !== 1 || st.open[0].id !== b.id) {
          const got = st.open.map(o => o.sel).join(',') || 'nothing';
          failures.push(`${w}px  TAP ${a.id} then TAP ${b.id}: expected only ${b.sel} open, got ${got}`);
        }
      }
    }
    await reset();

    // 7. the scrim IS raised while a bottom sheet is up (backdrop-to-close is
    //    half the fix; an invisible backdrop is a dead gesture). The DirHaven
    //    door is exempt: it is an opaque inset:0 panel and dims nothing.
    for (const s of SURFACES) {
      if (s.id === 'dirhaven') continue;
      checks++;
      await reset();
      await safeEval(fn => { eval('(' + fn + ')')(); }, s.open.toString());
      await settle();
      const st = await safeEval(PROBE, SURFACES.map(x => ({ id: x.id, sel: x.sel })));
      if (!st) continue;
      if (!st.scrim) failures.push(`${w}px  ${s.id} open but #dvScrim is not showing (backdrop-tap-to-close is dead)`);
      // tapping the scrim closes it
      await safeEval(() => { const e = document.getElementById('dvScrim'); if (e) e.click(); });
      await settle();
      const st2 = await safeEval(PROBE, SURFACES.map(x => ({ id: x.id, sel: x.sel })));
      if (!st2) continue;
      if (st2.open.length) failures.push(`${w}px  ${s.id}: tapping #dvScrim did not close it`);
    }
  }

  await browser.close();
  srv.close();

  // Report the widths ACTUALLY swept, not the full list — a filtered run must
  // never imply coverage it does not have (the false-green fix, 28b97b3).
  console.log(`\nONE-SHEET PROOF — ${checks} interaction checks across ${(only.length ? only : WIDTHS).join('/')}px\n`);
  // A surface that never reached a settled state was never measured, so every
  // assertion downstream of it is noise. Say that out loud instead of reporting
  // a layout violation we cannot stand behind — this is the difference between
  // "the world is broken" and "the harness could not see the world".
  if (settleTimeouts || navFailures.length) {
    if (settleTimeouts) {
      console.log(`✗ HARNESS UNSETTLED — ${settleTimeouts} surface(s) never finished animating`);
      console.log('   (the settle deadline elapsed with a transition still in flight, or .open');
      console.log('    disagreeing with the measured rect).');
    }
    if (navFailures.length) {
      console.log(`✗ HARNESS ENVIRONMENT — ${navFailures.length} page call(s) died outside layout:`);
      navFailures.slice(0, 6).forEach(f => console.log('   ' + f));
    }
    console.log('   Nothing above was measured on a settled page — this is NOT a layout verdict.\n');
    process.exit(2);
  }
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
})().catch(e => {
  // Last line of defence for the same principle: a crash in the DRIVER is not a
  // finding about the WORLD. Anything recognisably environmental (chrome refused
  // to start, the context/target vanished, a protocol timeout under load) exits
  // 2 — "the harness could not see the page" — so only a genuine, measured
  // layout violation is ever allowed to claim exit 1.
  const env = /execution context|target closed|session closed|detached|navigating|chrome would not start|protocoltimeout|timed out/i;
  console.error(e);
  process.exit(env.test(String(e && e.message)) ? 2 : 1);
});
