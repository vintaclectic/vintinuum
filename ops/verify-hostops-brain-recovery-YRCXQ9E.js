#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// YRCXQ9E — the Vintinuum-side assertion that the hostop pm2.restart GATE is
// present on the LIVE broker and cannot be bypassed.
//
// WHY THIS FILE WAS REWRITTEN (2026-11-14). The first version of this verifier
// copied the live lib/host-ops.js into a temp dir, ran
//     patch -p1 -i ops/YRCXQ9E-host-ops.patch
// over it, and tested the RESULT. That made it an INVERTED harness: it could only
// be green while the live broker still LACKED the gate, because a patch does not
// apply to a file that already contains it. MEASURED: it printed "5/5 passed" for
// card 5P9AURM precisely because the live checkout was the stale pre-gate copy
// (the ro-bind-mount miss of task NJBK4U5), and it CRASHED — unhandled
// execFileSync error, "Hunk #1 FAILED at 124" — the moment NJBK4U5 ran
// `git checkout -- lib/host-ops.js` and the fix became real. Green meant broken;
// a crash meant fixed. That is the worst shape a check can have.
//
// ops/YRCXQ9E-host-ops.patch IS SUPERSEDED and must never be re-applied: it stages
// an earlier design that routed every brain restart through a shared bash helper
// (`/bin/bash hostop:<task> --preserve-env`). What actually shipped is commit
// 777380c — the gate INSIDE the broker, restarting by pm2 ID. Check A4 below
// asserts the live source already holds the gate, which is what makes re-applying
// the patch impossible-by-construction rather than merely discouraged.
//
// WHAT IT ASSERTS NOW: the live broker source, unmodified, driven in a vm with a
// TRIPWIRE child_process. The decisive assertion on every refusal is not the error
// text — it is that ZERO pm2 restart calls left the process (the U3VFRJR rule: a
// status/throw can co-exist with a restart that already fired).
//
// Run:  node ops/verify-hostops-brain-recovery-YRCXQ9E.js
// Ctrl: node ops/verify-hostops-brain-recovery-YRCXQ9E.js --control-ungated
//       (reverts ONLY the gate consult in the pm2.restart case; must go RED and
//        must LEAK a real restart under saturation — the original 14:51 bug.)
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const assert = require('assert/strict');

const CONTROL = process.argv.includes('--control-ungated');
const LIVE = '/home/vinta/.claude/council-loop/lib/host-ops.js';

let pass = 0, fail = 0;
const fails = [];
const is = (name, fn) => {
  try { fn(); pass++; console.log(`PASS ${name}`); }
  catch (e) { fail++; fails.push(`${name}: ${e && e.message}`); console.log(`FAIL ${name} — ${e && e.message}`); }
};

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yrcxq9e-gate-'));
try {
  // ── fixture world: every env seam the broker reads points inside temp ────────
  const F = {
    psi:   path.join(temp, 'pressure-io'),
    state: path.join(temp, 'wedge-state'),
    log:   path.join(temp, 'wedge-guard.log'),
    maint: path.join(temp, 'db-maintenance'),
    pm2:   path.join(temp, 'fake-pm2'),
  };
  fs.mkdirSync(F.state, { recursive: true });
  fs.mkdirSync(F.maint, { recursive: true });
  fs.writeFileSync(F.pm2, '#!/bin/sh\nexit 0\n');
  const setPsi = (avg60) => fs.writeFileSync(F.psi,
    `some avg10=${avg60} avg60=${avg60} avg300=${avg60} total=1\nfull avg10=0 avg60=0 avg300=0 total=0\n`);
  const noPsi  = () => { try { fs.unlinkSync(F.psi); } catch {} };

  let src = fs.readFileSync(LIVE, 'utf8');
  const PRISTINE = src;

  if (CONTROL) {
    // Revert ONE expression: the gate consult. Everything else — the audit log, the
    // stamp, the by-ID restart — stays, so this isolates the gate and nothing else.
    const needle = 'const g = restartGate(p.name, { force });';
    assert.ok(src.includes(needle), 'control needle not found in live source');
    src = src.replace(needle,
      "const g = { allow: true, code: 'ok', why: null, io: null, since: null, bar: 0, gap: 0 }; void restartGate;");
    console.log('[--control-ungated] gate consult reverted in the pm2.restart case\n');
  }

  // ── load the live broker in a vm with a TRIPWIRE child_process ──────────────
  let calls = [];
  const load = (env) => {
    calls = [];
    const mod = { exports: {} };
    vm.runInNewContext(src, {
      module: mod, exports: mod.exports, console, Buffer,
      process: { env: Object.assign({ PM2_BIN: F.pm2 }, env), platform: process.platform },
      require(name) {
        if (name !== 'child_process') return require(name);
        return {
          execFileSync(cmd, args, options) {
            calls.push({ cmd, args: args || [], options: options || {} });
            if ((args || [])[0] === 'jlist') {
              return JSON.stringify([
                { pm_id: 22, name: 'vintinuum-api', pid: 123, monit: {}, pm2_env: { status: 'online', restart_time: 16, pm_uptime: Date.now() - 1000 } },
                { pm_id: 7,  name: 'other-app',     pid: 124, monit: {}, pm2_env: { status: 'online', restart_time: 1,  pm_uptime: Date.now() - 1000 } },
              ]);
            }
            return '';
          },
        };
      },
    });
    return mod.exports;
  };
  const baseEnv = {
    WEDGE_IO_PROC: F.psi, WEDGE_STATE_DIR: F.state,
    WEDGE_LOG: F.log, VINT_DB_MAINT_DIR: F.maint,
  };
  const restarts = () => calls.filter((c) => (c.args[0] === 'restart'));
  const run = (name, extra = {}, env = {}) => {
    const m = load(Object.assign({}, baseEnv, env));
    return m.runOp('pm2.restart', Object.assign({ name }, extra), { tid: 'YRCXQ9E', allowed: ['pm2.restart'] });
  };
  const refusal = (name, extra = {}, env = {}) => {
    try { const r = run(name, extra, env); return { threw: false, result: r }; }
    catch (e) { return { threw: true, message: e.message }; }
  };
  const logText = () => { try { return fs.readFileSync(F.log, 'utf8'); } catch { return ''; } };
  const clearLog = () => { try { fs.unlinkSync(F.log); } catch {} };
  const stamp = (secsAgo) => fs.writeFileSync(path.join(F.state, 'vintinuum-api.last-restart'),
    String(Math.floor(Date.now() / 1000) - secsAgo));
  const unstamp = () => { try { fs.unlinkSync(path.join(F.state, 'vintinuum-api.last-restart')); } catch {} };

  // ══ A. STRUCTURE — the gate is on the LIVE broker, not in a staged patch ════
  is('A1 vacuity guard: the live broker source is substantial', () => {
    assert.ok(PRISTINE.length > 15000, `live source is only ${PRISTINE.length}B — wrong file or truncated read`);
  });
  is('A2 the live broker DEFINES restartGate', () => {
    assert.match(PRISTINE, /function restartGate\(name, \{ force = false \} = \{\}\)/);
  });
  is('A3 the pm2.restart case CONSULTS the gate before restarting', () => {
    const i = PRISTINE.indexOf("case 'pm2.restart':");
    assert.ok(i > 0, "no case 'pm2.restart' in the live broker");
    const block = PRISTINE.slice(i, PRISTINE.indexOf("case 'cron.list':", i));
    const gateAt = block.indexOf('restartGate(p.name');
    const restartAt = block.indexOf("sh(PM2(), ['restart'");
    assert.ok(gateAt > 0, 'pm2.restart does not consult restartGate');
    assert.ok(restartAt > 0, 'pm2.restart never issues a restart');
    assert.ok(gateAt < restartAt, 'the gate is consulted AFTER the restart — it cannot gate anything');
  });
  is('A4 the superseded ops/YRCXQ9E-host-ops.patch can never be re-applied', () => {
    // The gate is already in the live source, so `patch` would reject hunk #1. This
    // check replaces the old harness's `patch` invocation: we assert the END STATE,
    // never the applicability of a staged diff (which rots the day it lands).
    assert.ok(PRISTINE.includes('THE RESTART GATE (task YRCXQ9E'), 'live source lacks the landed gate banner');
    assert.ok(!/\/bin\/bash['"],\s*\[['"]hostop:/.test(PRISTINE),
      'live source routes through the superseded bash helper design');
  });
  is('A5 restartGate is exported for the council-loop verifier to drive', () => {
    const m = load(baseEnv);
    assert.equal(typeof m.restartGate, 'function');
    assert.equal(typeof m.ioSomeAvg60, 'function');
  });

  // ══ B. PRODUCTION DEFAULTS — the test seams are PAID FOR ════════════════════
  is('B1 default PSI path is the real kernel file', () => {
    assert.match(PRISTINE, /envPath\('WEDGE_IO_PROC', '\/proc\/pressure\/io'\)/);
  });
  is('B2 default IO bar is 40% (same knob as wedge-guard.sh)', () => {
    assert.match(PRISTINE, /intEnv\('WEDGE_IO_HIGH', 40\)/);
  });
  is('B3 default restart budget is 1 per 1800s', () => {
    assert.match(PRISTINE, /intEnv\('WEDGE_MIN_GAP_S', 1800\)/);
  });
  is('B4 default state dir and log are wedge-guard.sh\'s own, so both doors share them', () => {
    assert.match(PRISTINE, /envPath\('WEDGE_STATE_DIR', '\/home\/vinta\/vintinuum-api\/\.wedge-state'\)/);
    assert.match(PRISTINE, /envPath\('WEDGE_LOG', '\/home\/vinta\/vintinuum-api\/logs\/wedge-guard\.log'\)/);
  });

  // ══ C. BEHAVIOUR — every refusal proven by ZERO outbound restarts ═══════════
  is('C1 a healthy box ALLOWS the restart, and targets the pm2 ID not the name', () => {
    setPsi(5); unstamp(); clearLog();
    const r = run('vintinuum-api');
    assert.equal(r.restarted, 'vintinuum-api');
    assert.equal(r.gate, 'ok');
    assert.equal(restarts().length, 1, 'expected exactly one restart');
    // join(): the vm realm gives arrays a different Array.prototype, so
    // assert/strict's deepEqual can NEVER match one cross-realm.
    assert.equal(restarts()[0].args.join(' '), 'restart 22',
      'must restart by pm2 ID — a NAME also resolves by exec path and can hit a sibling app');
  });
  is('C2 IO-SATURATED is REFUSED and ZERO restarts leave the process', () => {
    setPsi(49); unstamp(); clearLog();
    const o = refusal('vintinuum-api');
    assert.ok(o.threw, 'a saturated box was allowed to restart — this is the 14:51 SIGKILL bug');
    assert.match(o.message, /io-saturated/);
    assert.equal(restarts().length, 0, `${restarts().length} restart(s) leaked past the gate`);
  });
  is('C3 UNREADABLE PSI fails CLOSED (never read as 0%)', () => {
    noPsi(); unstamp(); clearLog();
    const o = refusal('vintinuum-api');
    assert.ok(o.threw, 'unreadable pressure was treated as healthy — a benign-value failure path');
    assert.match(o.message, /io-unreadable/);
    assert.equal(restarts().length, 0);
  });
  is('C4 the BUDGET refuses a second restart inside the window, zero leaks', () => {
    setPsi(5); stamp(60); clearLog();
    const o = refusal('vintinuum-api');
    assert.ok(o.threw, '7 restarts in 27 minutes is what this budget exists to stop');
    assert.match(o.message, /budget/);
    assert.equal(restarts().length, 0);
  });
  is('C5 the budget EXPIRES — just outside the window is allowed again', () => {
    setPsi(5); stamp(1801); clearLog();
    const r = run('vintinuum-api');
    assert.equal(r.gate, 'ok');
    assert.equal(restarts().length, 1);
  });
  is('C6 a maintenance PAUSE file refuses, zero leaks', () => {
    setPsi(5); unstamp(); clearLog();
    const p = path.join(F.state, 'vintinuum-api.pause');
    fs.writeFileSync(p, '');
    try {
      const o = refusal('vintinuum-api');
      assert.ok(o.threw); assert.match(o.message, /maintenance-pause/);
      assert.equal(restarts().length, 0);
    } finally { fs.unlinkSync(p); }
  });
  is('C7 a live DB-maintenance lock refuses the BRAIN, zero leaks', () => {
    setPsi(5); unstamp(); clearLog();
    const l = path.join(F.maint, 'restore.lock');
    fs.writeFileSync(l, '');
    try {
      const o = refusal('vintinuum-api');
      assert.ok(o.threw); assert.match(o.message, /db-maintenance/);
      assert.equal(restarts().length, 0);
    } finally { fs.unlinkSync(l); }
  });
  is('C8 the DB-maintenance hold is scoped to the brain — a sibling app still restarts', () => {
    setPsi(5); clearLog();
    const l = path.join(F.maint, 'restore.lock');
    fs.writeFileSync(l, '');
    try {
      const r = run('other-app');
      assert.equal(r.restarted, 'other-app');
      assert.equal(restarts()[0].args.join(' '), 'restart 7');
    } finally { fs.unlinkSync(l); }
  });
  is('C9 force=1 is an EXPLICIT, audited opt-out past a real hold', () => {
    setPsi(49); unstamp(); clearLog();
    const r = run('vintinuum-api', { force: '1' });
    assert.equal(r.gate, 'forced');
    assert.equal(r.forced_past, 'io-saturated');
    assert.equal(restarts().length, 1);
    assert.match(logText(), /FORCED past io-saturated/);
  });
  is('C10 force is NOT sticky — the next ungated call is refused again', () => {
    setPsi(49); unstamp(); clearLog();
    const o = refusal('vintinuum-api');
    assert.ok(o.threw, 'a previous force left the gate open');
    assert.match(o.message, /io-saturated/);
    assert.equal(restarts().length, 0);
  });
  is('C11 a REFUSAL is audited into wedge-guard\'s OWN log, naming the task and code', () => {
    setPsi(49); unstamp(); clearLog();
    refusal('vintinuum-api');
    const t = logText();
    assert.match(t, /hostop pm2\.restart vintinuum-api REFUSED for task YRCXQ9E/);
    assert.match(t, /io-saturated/);
  });
  is('C12 an ALLOWED restart is audited in the same log with the pressure it saw', () => {
    setPsi(5); unstamp(); clearLog();
    run('vintinuum-api');
    assert.match(logText(), /hostop pm2\.restart vintinuum-api \(id 22\) ALLOWED for task YRCXQ9E/);
    assert.match(logText(), /io some avg60 5%, bar 40%/);
  });
  is('C13 an ALLOWED restart STAMPS the shared budget file wedge-guard.sh reads', () => {
    setPsi(5); unstamp(); clearLog();
    run('vintinuum-api');
    const f = path.join(F.state, 'vintinuum-api.last-restart');
    assert.ok(fs.existsSync(f), 'no stamp written — the two doors cannot see each other\'s restarts');
    const age = Math.floor(Date.now() / 1000) - parseInt(fs.readFileSync(f, 'utf8').trim(), 10);
    assert.ok(age >= 0 && age < 30, `stamp is ${age}s off`);
  });
  is('C14 an UNGRANTED op is rejected before any subprocess runs', () => {
    const m = load(baseEnv);
    assert.throws(() => m.runOp('pm2.restart', { name: 'vintinuum-api' }, { tid: 'x', allowed: [] }), /not granted/);
    assert.equal(calls.length, 0, 'a subprocess ran for an ungranted op');
  });
  is('C15 a numeric pm2 id cannot bypass the gate', () => {
    setPsi(49); unstamp(); clearLog();
    const o = refusal('22');
    assert.ok(o.threw, 'targeting by numeric id walked around the gate');
    assert.match(o.message, /io-saturated/);
    assert.equal(restarts().length, 0);
  });

  const total = pass + fail;
  console.log(`\n${pass}/${total} pass${CONTROL ? '  [--control-ungated: reds below are the POINT]' : ''}`);
  if (fail) { console.log('FAILURES:'); fails.forEach((f) => console.log('  - ' + f)); }
  process.exit(CONTROL ? (fail > 0 ? 0 : 1) : (fail ? 1 : 0));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
