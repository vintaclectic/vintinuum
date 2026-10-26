#!/usr/bin/env node
/**
 * verify-archive-frozen.js — Test frozen card → archive workflow (task GPYSY83, FIXED 2026-10-26)
 *
 * REFACTOR HISTORY:
 *  • 2026-08-26 (GPYSY83): OLD behavior — frozen card offered ✕ Cancel button, which set
 *    status='cancelled' with cancel_reason, THEN archive ran and set archived=true.
 *    DISCOVERY: Q3JYBBY refactored to archive frozen cards DIRECTLY (no cancel step),
 *    and taskIsFiled() refactored to filter active view via archived flag + done status checks.
 *    Five stale regexes were matching old Cancel-path strings.
 *  • 2026-10-26: FIXED — updated regexes to match NEW behavior:
 *    frozen card → 🗄 Archive button → action='archive' direct → archived=true.
 *
 * BEHAVIOUR UNDER TEST:
 *  • Frozen cards render 🗄 Archive button (not ✕ Cancel).
 *  • Clicking Archive on a frozen card sends action='archive' direct (no cancel_reason).
 *  • Archive action sets archived=true + adds to the filed set.
 *  • Active view filters via taskIsFiled(t): t.archived || (t.status==='done' && !t.needs && !t.blocked_reason).
 *  • Archived tasks disappear from active feeds, visible only in the archive view.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the board HTML as the source of truth
const boardHtml = fs.readFileSync('/home/vinta/.claude/council-loop/bin/vintask-gui.html', 'utf-8');

// The taskIsFiled function as defined in the board
const taskIsFiled = (t) => {
  if (!t) return false;
  if (t.archived) return true;
  return (t.status === 'done') && !t.needs && !t.blocked_reason;
};

// Check 1: Frozen card renders Archive button (not Cancel)
// Looking for the pattern: cardFrozen generates data-a="archive" data-frozen="1"
const frozenArchiveButton = /if\(cardFrozen\)[\s\S]{0,200}data-a="archive"[\s\S]{0,50}data-frozen="1"/.test(boardHtml);
const oldCancelOnFrozen = /if\(cardFrozen\)[\s\S]{0,200}data-a="cancel"[\s\S]{0,50}data-frozen="1"/.test(boardHtml);

// Check 2: Archive action for frozen cards goes DIRECTLY (not cancel-then-archive)
const frozenArchiveAction = /action:\s*['"]archive['"].*archived from the board/.test(boardHtml);
const noFrozenCancelStep = !/cancel.*then.*archive|cancel-first/.test(boardHtml.toLowerCase());

// Check 3: Frozen archive doesn't need cancel_reason (reason is sent as 'archived from board…')
const archiveReasonText = /'archived from the board — progress had been frozen/.test(boardHtml);
const noFrozenCancelReason = !/cancel_reason.*frozen/.test(boardHtml);

// Check 4: Active view filters via taskIsFiled (archived flag check)
const taskIsFiledDef = /function taskIsFiled\(t\)\{[\s\S]*?if\(t\.archived\) return true;/.test(boardHtml);
const doneCheckInFiled = /status===\s*['"]done['"].*!t\.needs.*!t\.blocked_reason/.test(boardHtml);

// Check 5: Active feed filters out archived/filed tasks via !taskIsFiled(t)
// Archive view filters TO SHOW ONLY filed tasks: tasks.filter(taskIsFiled)
const activeFilterUsesTaskIsFiled = /visible=tasks\.filter\(\s*t\s*=>\s*!taskIsFiled\(t\)\s*\)/.test(boardHtml);
const archiveViewFilterWorks = /if\(VIEW===\s*['"]archive['"][\s\S]{0,500}tasks\.filter\(taskIsFiled\)/.test(boardHtml);

// Detailed checks: Parse and verify
const checks = [
  {
    name: 'frozen card offers Archive button (not Cancel)',
    pass: frozenArchiveButton && !oldCancelOnFrozen,
    evidence: `Found data-a="archive" data-frozen="1": ${frozenArchiveButton}, No old Cancel: ${!oldCancelOnFrozen}`
  },
  {
    name: 'Archive action for frozen cards is DIRECT (no cancel step)',
    pass: frozenArchiveAction && noFrozenCancelStep,
    evidence: `Found archive action: ${frozenArchiveAction}, No cancel-first logic: ${noFrozenCancelStep}`
  },
  {
    name: 'frozen archive sends reason inline, not cancel_reason',
    pass: archiveReasonText && noFrozenCancelReason,
    evidence: `Found archive reason text: ${archiveReasonText}, No cancel_reason for frozen: ${noFrozenCancelReason}`
  },
  {
    name: 'taskIsFiled() correctly defines filed status via archived flag + done checks',
    pass: taskIsFiledDef && doneCheckInFiled,
    evidence: `taskIsFiled checks archived: ${taskIsFiledDef}, checks done + !needs + !blocked_reason: ${doneCheckInFiled}`
  },
  {
    name: 'active view filters via !taskIsFiled(t) to hide archived/done cards',
    pass: activeFilterUsesTaskIsFiled && archiveViewFilterWorks,
    evidence: `Active filter uses !taskIsFiled: ${activeFilterUsesTaskIsFiled}, Archive view filters taskIsFiled: ${archiveViewFilterWorks}`
  }
];

// Report
let pass = 0;
let fail = 0;

console.log('\n🔍 verify-archive-frozen.js — frozen→archive workflow\n');

checks.forEach((check, i) => {
  const status = check.pass ? '✓' : '✕';
  const result = check.pass ? 'PASS' : 'FAIL';
  console.log(`${status} Check ${i + 1} (${check.name})\n   ${result}: ${check.evidence}\n`);
  if (check.pass) pass++; else fail++;
});

console.log(`\n━━━ RESULT: ${pass}/${checks.length} pass ${fail > 0 ? `(${fail} FAIL)` : '(green)'}\n`);

// Exit code
process.exit(fail > 0 ? 1 : 0);
