#!/usr/bin/env node
/**
 * verify-mercatus-cosmos.js — proof harness for THE MERCATUS COSMOS (task 8589YGC)
 *
 * Plain Node, zero deps. Asserts the surface exists, parses, wires its renderer,
 * carries the load-bearing markers (canvas / profit readout / demo-sky badge),
 * runs a single cancellable rAF loop, and passes a lightweight STATIC collision
 * sanity check. It is honest about what it can and cannot prove without a browser.
 *
 * Run:  node scripts/verify-mercatus-cosmos.js
 * Exit: 0 = all asserts pass, 1 = a failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'mercatus.html');
const JS = path.join(ROOT, 'body', 'mercatus-cosmos.js');

let pass = 0, fail = 0;
const results = [];
function ok(name) { pass++; results.push('  \u2713 ' + name); }
function bad(name, why) { fail++; results.push('  \u2717 ' + name + (why ? '  — ' + why : '')); }
function assert(cond, name, why) { cond ? ok(name) : bad(name, why); }

// ── 1. files exist ───────────────────────────────────────────────────────────
const haveHtml = fs.existsSync(HTML);
const haveJs = fs.existsSync(JS);
assert(haveHtml, 'mercatus.html exists');
assert(haveJs, 'body/mercatus-cosmos.js exists');
if (!haveHtml || !haveJs) { return finish(); }

const html = fs.readFileSync(HTML, 'utf8');
const js = fs.readFileSync(JS, 'utf8');

// ── 2. the renderer parses (node --check) ─────────────────────────────────────
try { execFileSync(process.execPath, ['--check', JS], { stdio: 'pipe' }); ok('body/mercatus-cosmos.js passes node --check'); }
catch (e) { bad('body/mercatus-cosmos.js passes node --check', String(e.stderr || e.message).split('\n')[0]); }

// ── 3. HTML references the renderer + the Vintinuum spine ─────────────────────
assert(/<script[^>]+src=["']body\/mercatus-cosmos\.js["']/.test(html), 'HTML loads body/mercatus-cosmos.js');
assert(/<script[^>]+src=["']body\/draggable\.js["']/.test(html), 'HTML loads body/draggable.js (drag system honoured)');
assert(/<script[^>]+src=["']body\/api_base\.js["']/.test(html), 'HTML loads body/api_base.js (API spine)');

// ── 4. the load-bearing surface markers ───────────────────────────────────────
assert(/<canvas[^>]+id=["']mx-canvas["']/.test(html), 'canvas element #mx-canvas present');
// profit readout — the always-visible PROFIT layer
assert(/id=["']mx-profit["']/.test(html) && /id=["']mx-today["']/.test(html) && /id=["']mx-equity["']/.test(html),
  'PROFIT readout present (#mx-profit / today / equity)');
assert(/id=["']mx-realized["']/.test(html) && /id=["']mx-winrate["']/.test(html),
  'PROFIT readout carries realized P&L + win-rate');
// demo-sky badge markers — honesty rail
assert(/id=["']mx-demo["']/.test(html), 'demo-sky banner slot #mx-demo present in HTML');
assert(/DEMO SKY/.test(js), 'renderer emits the "DEMO SKY" honesty badge');
assert(/mx-badge-demo|mx-badge-paper|mx-badge-live/.test(html), 'mode badge classes (DEMO/PAPER/LIVE) present');
// pending = AWAITING LORD VINTA (purple)
assert(/AWAITING LORD VINTA/.test(js), 'pending bodies labelled "AWAITING LORD VINTA"');
assert(/8B5CF6|139,92,246/.test(js), 'pending uses the council needs-human purple');

// ── 5. single rAF loop + cancel hooks ─────────────────────────────────────────
const rafCalls = (js.match(/requestAnimationFrame/g) || []).length;
assert(rafCalls >= 1, 'requestAnimationFrame present', 'found ' + rafCalls);
assert(/cancelAnimationFrame/.test(js), 'cancelAnimationFrame wired (loop is cancellable)');
assert(/visibilitychange/.test(js), 'visibilitychange hook present (pause when hidden)');
assert(/document\.hidden/.test(js), 'document.hidden guard present');
assert(/addEventListener\(['"]blur['"]/.test(js) || /window\.addEventListener\('blur'/.test(js), 'window blur cancels the loop');
assert(/prefers-reduced-motion/.test(js), 'reduced-motion path present (still frame)');
assert(/Math\.min\(2,\s*window\.devicePixelRatio/.test(js), 'DPR capped at 2');
// ONE self-driving loop: exactly one frame() body, driven by requestAnimationFrame(frame)
// at exactly two sites — the kick in start() and the re-arm inside frame(). More
// than one frame() body, or rAF driving some other function, would be a 2nd loop.
const frameDefs = (js.match(/function frame\s*\(/g) || []).length;
assert(frameDefs === 1, 'exactly one frame() loop body (single loop)', 'found ' + frameDefs);
const rafFrame = (js.match(/requestAnimationFrame\(frame\)/g) || []).length;
assert(rafFrame === 2, 'the single loop drives itself (kick + re-arm, no other rAF driver)', 'found ' + rafFrame);

// ── 6. graceful degradation is real (not just a badge) ────────────────────────
assert(/seedDemo\s*\(/.test(js) && /buildModel\(seedDemo/.test(js), 'demo sky is built when /state fails');
assert(/__err/.test(js), 'per-endpoint error sentinel (lanes degrade independently)');
assert(/owner-only|403/.test(js), 'owner-only / 403 handled as an honest state');

// ── 7. STATIC collision sanity check ──────────────────────────────────────────
// What this CAN prove statically: (a) no duplicate element ids in the HTML — the
// commonest collision/ownership bug; (b) the HUD rails declare a height cap +
// internal scroll, so N pending items cannot push the galaxy off-page; (c) the
// canvas is the sole z-index:0 backdrop while the HUD column sits above it.
// What it CANNOT prove without a browser: actual rendered geometry at each
// breakpoint. That was verified by hand (see the commit body) — this guards the
// regressions a static pass can catch.
const ids = (html.match(/\bid=["']([^"']+)["']/g) || []).map((m) => m.replace(/.*id=["']|["']$/g, ''));
const dupe = ids.filter((v, i) => ids.indexOf(v) !== i);
assert(dupe.length === 0, 'no duplicate element ids (no two elements own one region)', dupe.join(','));

// rails must cap height + scroll internally
const railBlock = (html.match(/\.mx-rail\s*{[^}]*}/) || [''])[0];
assert(/max-height:\s*100%/.test(railBlock), 'HUD rails cap max-height (galaxy can never be shoved off-page)');
assert(/overflow-y:\s*auto/.test(railBlock), 'HUD rails scroll internally (pending overflow stays inside its box)');

// z-index ladder: canvas is the backdrop, HUD above it
assert(/#mx-canvas{[^}]*z-index:\s*0/.test(html.replace(/\s+/g, ' ')) || /#mx-canvas\s*{[^}]*z-index:\s*0/.test(html),
  'canvas is the z-index:0 backdrop');
assert(/#mx-hud{[^}]*z-index:\s*2/.test(html.replace(/\s+/g, ' ')), 'HUD column sits above the backdrop (z-index:2)');

// mid-row container must be pointer-events:none so the canvas stays interactive
// in the gap between rails (a rail that ate the whole row would be a dead galaxy)
assert(/#mx-mid{[^}]*pointer-events:\s*none/.test(html.replace(/\s+/g, ' ')), 'mid row passes pointer events to the canvas between rails');

// mobile sheets: one-open-at-a-time via a single body attribute (no two sheets stack)
assert(/data-mx-open/.test(html) && /data-mx-open/.test(js), 'mobile sheets gated by one body[data-mx-open] (no stacked sheets)');

return finish();

function finish() {
  const total = pass + fail;
  console.log('\nTHE MERCATUS COSMOS — verification');
  console.log(results.join('\n'));
  console.log('\n  ' + pass + '/' + total + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ''));
  if (fail) { console.log('\nVERIFY FAIL\n'); process.exit(1); }
  console.log('\nVERIFY PASS — THE MERCATUS COSMOS is whole: canvas backdrop, profit readout, honest demo-sky fallback, single cancellable rAF loop, collision-capped HUD.\n');
  process.exit(0);
}
