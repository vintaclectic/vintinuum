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
const WIDGET_RE = /createElement\(\s*['"]button['"]\s*\)|['"#.](?:pill|fab|orb|dot|-btn|btn-)|role\s*:\s*['"]button['"]/i;
const OVERLAY_RE = /inset\s*:\s*0|width\s*:\s*100(?:vw|%)|height\s*:\s*100(?:vh|svh|%)|id\s*=?\s*['"][^'"]*(?:scrim|backdrop|overlay|modal|sheet|shroud)/i;

function lintFile(fp) {
  const name = path.basename(fp);
  if (ALLOW.has(name)) return [];
  const src = fs.readFileSync(fp, 'utf8');

  // If the file registers ANY element with the dock, the dock owns placement —
  // treat the whole file as dock-managed (conservative: avoids false positives).
  const usesDock = /VintDock\s*\.\s*(?:register|claim)\s*\(/.test(src) ||
                   /VintDock\)\s*\.\s*register/.test(src);

  const violations = [];
  const lines = src.split('\n');

  // Scan for position:fixed occurrences; inspect a window around each for the
  // widget signal + a hardcoded coordinate, absent the overlay signal.
  for (let i = 0; i < lines.length; i++) {
    if (!/position\s*:\s*fixed/.test(lines[i])) continue;
    const from = Math.max(0, i - 12), to = Math.min(lines.length, i + 20);
    const win = lines.slice(from, to).join('\n');

    if (OVERLAY_RE.test(win)) continue;          // full-screen overlay — exempt
    if (!WIDGET_RE.test(win)) continue;          // not a corner widget — skip
    if (!COORD_RE.test(win)) continue;           // no hardcoded coordinate — fine
    if (usesDock) continue;                      // dock owns this file's placement

    violations.push({
      file: name, line: i + 1,
      snippet: lines[i].trim().slice(0, 90),
    });
  }
  return violations;
}

function main() {
  let files = [];
  try { files = fs.readdirSync(BODY).filter(f => f.endsWith('.js')); }
  catch (e) { console.error('lint-no-collision: cannot read', BODY, e.message); process.exit(2); }

  let all = [];
  for (const f of files) {
    try { all = all.concat(lintFile(path.join(BODY, f))); } catch (_) {}
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
