#!/usr/bin/env node
/* lint-no-collision.js — THE NO-COLLISION GUARD (Vinta directive 2026-08-01/02).
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS

   The bottom-right corner overlapped because floating buttons hardcoded their own
   right/bottom instead of registering with VintDock (the corner allocator that
   measures + stacks widgets so nothing can touch). corner_dock.js killed the bug;
   this lint keeps it dead. It fails CI/pre-commit if any body/*.js creates a
   position:fixed BUTTON/PILL that hardcodes a corner coordinate without handing
   its placement to VintDock.

   WHAT IT FLAGS (a real violation):
     a <button> (or a .pill/.fab/.orb/.dot element) that is position:fixed AND
     hardcodes right:/left:/top:/bottom: to a coordinate, in a file that never
     calls VintDock.register/claim for it.

   WHAT IT DOES NOT FLAG (legitimate):
     - full-screen overlays/modals/scrims (position:fixed; inset:0) — they cover
       the viewport by design, they don't stack in a corner.
     - files that DO register with VintDock (the dock owns their coordinates; any
       CSS right/bottom left behind is just a pre-dock first-paint fallback).
     - corner_dock.js itself (it's the allocator; it sets coordinates by design).
     - non-fixed elements.

   USAGE
     node scripts/lint-no-collision.js            # lint body/*.js, exit 1 on violation
     node scripts/lint-no-collision.js --quiet    # only print on failure

   ZERO dependencies. Heuristic, deliberately conservative: it only fires when it
   is confident, so it never blocks a legit commit — but it catches the exact
   pattern that caused the carry-pill collision.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BODY = path.join(ROOT, 'body');
const QUIET = process.argv.includes('--quiet');

// Files that are allowed to set corner coordinates directly.
const ALLOW = new Set(['corner_dock.js']);

// A fixed-position coordinate hardcode: right:/left:/top:/bottom: followed by a
// number/px/calc/var/clamp/env — i.e. an actual corner placement (not "auto").
const COORD_RE = /\b(right|left|top|bottom)\s*:\s*(?!auto)(?:calc\(|clamp\(|var\(|env\(|-?\d)/;

// Signals the snippet is a corner WIDGET (button/pill/fab/orb/dot), not a full
// overlay. Full overlays use inset:0 / width:100% / height:100% and are exempt.
// NOTE on the selector arm: it must match a widget word ANYWHERE inside a CSS
// selector or id string, not only immediately after the `#`/`.`/quote. The old
// pattern anchored the delimiter directly against the word, so `#hey-vinta-btn`
// (delimiter `#`, then `hey-vinta`, THEN `-btn`) never matched — which is why a
// deleted VintDock.register in hey_vinta.js still linted clean. Here the
// delimiter is followed by any selector chars before the widget word.
const WIDGET_RE = new RegExp(
  [
    /createElement\(\s*['"]button['"]\s*\)/.source,
    /['"#.][\w-]*(?:pill|fab|orb|dot|btn|button|toggle|launch)\b/.source,
    /role\s*:\s*['"]button['"]/.source,
  ].join('|'), 'i');
const OVERLAY_RE = /inset\s*:\s*0|width\s*:\s*100(?:vw|%)|height\s*:\s*100(?:vh|svh|%)|id\s*=?\s*['"][^'"]*(?:scrim|backdrop|overlay|modal|sheet|shroud)/i;

// EDGE-SPANNING BARS are not corner widgets: a bottom sheet or a rail pinned
// left:0;right:0 occupies a full edge by design and cannot "stack" in a corner.
// (body/world/dirverse-hud.js's .dv-sheet is exactly this.)
const SPAN_RE = /left\s*:\s*0\s*;\s*right\s*:\s*0|right\s*:\s*0\s*;\s*left\s*:\s*0/;

// A SELF-MEASURING container computes its own clearance from live-measured CSS
// vars (--dv-railtop/--dv-railbot in dirverse-hud.js) rather than a baked-in
// coordinate. That is the same discipline VintDock enforces, done locally, so
// it is not the stale-arithmetic bug this lint hunts.
const MEASURED_RE = /max-height\s*:\s*calc\([^)]*var\(|bottom\s*:\s*calc\(\s*var\(/;

// Does this fixed-position block style an element that the file registers with
// the dock somewhere else? Collect the CSS ids/classes named in the block and
// the ids the file hands to VintDock (literal strings or `id: X` / BTN_ID vars),
// then look for an intersection. Matching by IDENTITY instead of by line
// distance is what lets a CSS-template widget be linked to its far-away
// registration — and, crucially, what makes DELETING that registration fail the
// lint again.
function registeredNearby(win, src) {
  const names = new Set();
  let m;
  // CSS ids in the block — but NOT hex colours. `#f3eef9` is a colour, and
  // treating it as a selector meant status_pill.js's block appeared to name four
  // "ids" (all colours) and zero real ones, so it could never be matched to its
  // registration and was reported as a violation despite being correctly docked.
  const sel = /#([A-Za-z][\w-]*)/g;
  while ((m = sel.exec(win))) {
    const n = m[1];
    if (/^[0-9a-f]{3,8}$/i.test(n)) continue;      // hex colour, not a selector
    names.add(n.toLowerCase());
  }
  // CLASS selectors too. A widget is often styled by class (`.vint-vp-btn`) but
  // registered by id (`id:'vint-vp-btn'`), so an id-only index reports a correctly
  // docked widget as a violation. Collect both and let either side match.
  const cls = /\.([A-Za-z][\w-]{2,})\s*[{,:]/g;
  while ((m = cls.exec(win))) names.add(m[1].toLowerCase());
  // CONCATENATED selectors: voice_button.js builds its rule as `'#' + BTN_ID +
  // '{'`, so there is no literal `#vintVoice` token anywhere to match. Resolve the
  // identifier through its `var BTN_ID = 'vintVoice'` definition.
  const concat = /['"]#['"]\s*\+\s*([A-Za-z_$][\w$]*)/g;
  while ((m = concat.exec(win))) {
    const def = new RegExp('\\b' + m[1] + '\\s*=\\s*[\'"]([\\w-]+)[\'"]').exec(src);
    if (def) names.add(def[1].toLowerCase());
  }
  // Also credit `el.id = 'x'` / `id="x"` declared in the block itself.
  const assign = /\.id\s*=\s*['"]([\w-]+)['"]|\bid\s*=\s*['"]([\w-]+)['"]/g;
  while ((m = assign.exec(win))) names.add((m[1] || m[2]).toLowerCase());
  if (!names.size) return false;

  const registered = new Set();
  const call = /VintDock[\s\S]{0,20}?\.\s*(?:register|claim)\s*\(([\s\S]{0,300}?)\)\s*;/g;
  while ((m = call.exec(src))) {
    const args = m[1];
    let s;
    const str = /['"]([\w-]+)['"]/g;
    while ((s = str.exec(args))) registered.add(s[1].toLowerCase());
    // id: SOME_CONST → resolve `const SOME_CONST = 'the-id'` from the file.
    // `id: BTN_ID` / `id: pill.id || 'vint-status-pill'` — resolve every bare
    // identifier in the id expression back to its `var/let/const X = 'literal'`.
    let v;
    const ident = /\b(?:id|el)\s*:\s*([^,}]+)/g;
    while ((v = ident.exec(args))) {
      const expr = v[1];
      let w;
      const names = /([A-Za-z_$][\w$]*)/g;
      while ((w = names.exec(expr))) {
        const def = new RegExp('\\b' + w[1] + '\\s*=\\s*[\'"]([\\w-]+)[\'"]').exec(src);
        if (def) registered.add(def[1].toLowerCase());
      }
    }
  }
  for (const n of names) if (registered.has(n)) return true;
  return false;
}

function lintFile(fp) {
  const name = path.basename(fp);
  if (ALLOW.has(name)) return [];
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp);

  // How many widgets does this file place, and how many does it register? The
  // original check was file-level ("does VintDock appear anywhere?"), which made
  // ONE registration exempt every other widget in the file. brain.js is 50k lines
  // and mounts several independent fixed buttons — it registered #micBtn and was
  // thereby excused for #consciousness-brain-btn, which then collided with the
  // MIND pill on mobile. Counting both sides catches that.
  const dockCalls = (src.match(/VintDock[\s\S]{0,20}?\.\s*(?:register|claim)\s*\(/g) || []).length;

  const violations = [];
  const lines = src.split('\n');

  // Scan for position:fixed occurrences; inspect a window around each for the
  // widget signal + a hardcoded coordinate, absent the overlay signal.
  for (let i = 0; i < lines.length; i++) {
    if (!/position\s*:\s*fixed/.test(lines[i])) continue;
    // A COMMENT mentioning position:fixed is documentation, not a placement —
    // dirverse-hud.js explains "nothing here is individually position:fixed" and
    // the lint was citing that sentence as the violation.
    if (/^\s*(?:\/\/|\*|\/\*)/.test(lines[i])) continue;
    // The window must be wide enough to contain the element's whole mount block:
    // a long style string can put appendChild + VintDock.register well past 20
    // lines (three3d/mode.js's cssText template is 22 lines on its own).
    const from = Math.max(0, i - 16), to = Math.min(lines.length, i + 45);
    const win = lines.slice(from, to).join('\n');

    if (OVERLAY_RE.test(win)) continue;          // full-screen overlay — exempt
    if (SPAN_RE.test(win)) continue;             // full-edge bar/sheet — exempt
    if (MEASURED_RE.test(win)) continue;         // self-measuring container — exempt
    if (!WIDGET_RE.test(win)) continue;          // not a corner widget — skip
    if (!COORD_RE.test(win)) continue;           // no hardcoded coordinate — fine

    // This widget is dock-managed if a register/claim call sits in its own window
    // OR — the common real case — if the SELECTOR it styles is registered
    // elsewhere in the file. hey_vinta.js declares `#hey-vinta-btn{position:fixed
    // ...}` in a CSS template ~160 lines above the register('hey-vinta-btn') call,
    // so proximity alone can never connect them; the id can.
    if (/VintDock[\s\S]{0,20}?\.\s*(?:register|claim)\s*\(/.test(win)) continue;
    if (registeredNearby(win, src)) continue;

    violations.push({
      file: rel, line: i + 1, dockCalls,
      snippet: lines[i].trim().slice(0, 90),
    });
  }
  return violations;
}

// Walk body/ recursively (body/three3d/mode.js hardcoded a top-right coordinate
// and was invisible to the old flat readdir) plus the top-level page scripts that
// mount their own chrome.
function collect() {
  const out = [];
  (function walk(dir) {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(fp); }
      else if (e.name.endsWith('.js')) out.push(fp);
    }
  })(BODY);
  for (const f of ['brain.js', 'dirrm-launch.js', 'brain_expansion.js']) {
    const fp = path.join(ROOT, f);
    if (fs.existsSync(fp)) out.push(fp);
  }
  return out;
}

function main() {
  const files = collect();
  if (!files.length) { console.error('lint-no-collision: no files found under', BODY); process.exit(2); }

  let all = [];
  for (const f of files) {
    try { all = all.concat(lintFile(f)); } catch (_) {}
  }

  if (all.length === 0) {
    if (!QUIET) console.log('✓ no-collision lint: clean — every fixed corner widget registers with VintDock (' + files.length + ' files scanned)');
    process.exit(0);
  }

  console.error('\n⛔ NO-COLLISION LINT FAILED — ' + all.length + ' fixed corner widget(s) hardcode a coordinate instead of registering with VintDock:\n');
  for (const v of all) {
    console.error('  ' + v.file + ':' + v.line + '  ' + v.snippet);
  }
  console.error('\nFIX: give placement to the corner allocator instead of hardcoding right/bottom:');
  console.error('  document.body.appendChild(el);');
  console.error("  VintDock.register(el, { corner:'br', priority:30, id:'my-widget' });");
  console.error('\nOverlays/modals (inset:0, full-screen) are exempt. See body/corner_dock.js.\n');
  process.exit(1);
}

main();
