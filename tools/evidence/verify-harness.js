#!/usr/bin/env node
/**
 * Regression verifier for the evidence preservation harness.
 * Exercises the full lifecycle plus every tamper vector in a temp dir.
 * Exit 0 = all checks pass. Exit 1 = something regressed.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const P = path.join(__dirname, 'preserve.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'evharness-'));
const PKGS = path.join(TMP, 'pkgs');
const CASE = 'regression';
const env = { ...process.env, EVIDENCE_OPERATOR: 'Regression Declarant' };

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
function run(args) {
  return execFileSync('node', [P, ...args], { env, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
}
function runExpectFail(args, wantCode) {
  try { execFileSync('node', [P, ...args], { env, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }); }
  catch (e) {
    if (wantCode !== undefined && e.status !== wantCode) {
      throw new Error(`expected exit ${wantCode}, got ${e.status}`);
    }
    return (e.stdout || '') + (e.stderr || '');
  }
  throw new Error('expected failure, but command succeeded');
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const pkg = (...p) => path.join(PKGS, CASE, ...p);
const base = ['--case', CASE, '--out', PKGS];

console.log(`evidence harness regression suite\nworkdir: ${TMP}\n`);

// fixtures
const fx = path.join(TMP, 'fx');
fs.mkdirSync(fx, { recursive: true });
const f1 = path.join(fx, 'a.png'); fs.writeFileSync(f1, 'artifact one');
const f2 = path.join(fx, 'b.mp4'); fs.writeFileSync(f2, 'artifact two');
const f3 = path.join(fx, 'c.csv'); fs.writeFileSync(f3, 'artifact three');

console.log('lifecycle');
check('init creates manifest', () => {
  run(['init', ...base, '--title', 'Regression Case']);
  assert(fs.existsSync(pkg('manifest.json')), 'manifest.json missing');
});
check('init refuses to clobber existing case', () => {
  runExpectFail(['init', ...base], 1);
});
check('add preserves and hashes three items', () => {
  run(['add', ...base, '--file', f1, '--label', 'one', '--occurred', '2026-09-08T10:00:00Z']);
  run(['add', ...base, '--file', f2, '--label', 'two', '--occurred', '2026-09-08T11:00:00Z']);
  run(['add', ...base, '--file', f3, '--label', 'three', '--occurred', '2026-09-09T10:00:00Z']);
  const m = JSON.parse(fs.readFileSync(pkg('manifest.json'), 'utf8'));
  assert(m.items.length === 3, `expected 3 items, got ${m.items.length}`);
});
check('preserved bytes match source exactly', () => {
  assert(fs.readFileSync(pkg('items','E001','E001.png'),'utf8') === 'artifact one', 'E001 content differs');
});
check('duplicate content is skipped, not double-stored', () => {
  const out = run(['add', ...base, '--file', f1, '--label', 'dupe']);
  assert(/already preserved as E001/.test(out), 'dup not reported');
  const m = JSON.parse(fs.readFileSync(pkg('manifest.json'), 'utf8'));
  assert(m.items.length === 3, 'duplicate was stored');
});
check('missing source file is rejected', () => {
  runExpectFail(['add', ...base, '--file', path.join(fx,'nope.png'), '--label','x'], 1);
});
check('add requires --file', () => { runExpectFail(['add', ...base, '--label','x'], 1); });
check('--case is required', () => { runExpectFail(['init', '--out', PKGS], 1); });

console.log('\nderived documents');
check('all package documents generated', () => {
  for (const f of ['MANIFEST.txt','CHAIN_OF_CUSTODY.md','AFFIDAVIT.md','SHA256SUMS']) {
    assert(fs.existsSync(pkg(f)), `${f} missing`);
  }
});
check('SHA256SUMS has one line per item', () => {
  const lines = fs.readFileSync(pkg('SHA256SUMS'),'utf8').trim().split('\n');
  assert(lines.length === 3, `expected 3 lines, got ${lines.length}`);
});
check('manifest is ordered by date of event', () => {
  const txt = fs.readFileSync(pkg('MANIFEST.txt'),'utf8');
  assert(txt.indexOf('[E001]') < txt.indexOf('[E003]'), 'chronological order wrong');
});
check('affidavit carries item digests', () => {
  const m = JSON.parse(fs.readFileSync(pkg('manifest.json'),'utf8'));
  const a = fs.readFileSync(pkg('AFFIDAVIT.md'),'utf8');
  assert(a.includes(m.items[0].sha256), 'digest absent from affidavit');
});
check('custody handoff is logged', () => {
  run(['custody', ...base, '--action','handed to officer','--who','Det. Test','--org','PD']);
  assert(/handed to officer/.test(fs.readFileSync(pkg('CHAIN_OF_CUSTODY.md'),'utf8')), 'custody entry missing');
});
check('custody requires --action and --who', () => {
  runExpectFail(['custody', ...base, '--action','x'], 1);
});

console.log('\nreports');
for (const kind of ['platform','police','counsel']) {
  check(`report --kind ${kind} generates`, () => {
    run(['report', ...base, '--kind', kind]);
    assert(fs.existsSync(pkg(`REPORT_${kind.toUpperCase()}.md`)), 'report file missing');
  });
}
check('police report cites both Ohio statutes', () => {
  const r = fs.readFileSync(pkg('REPORT_POLICE.md'),'utf8');
  assert(r.includes('2917.21') && r.includes('2903.211'), 'statute references missing');
});
check('police report disclaims private identity attribution', () => {
  const r = fs.readFileSync(pkg('REPORT_POLICE.md'),'utf8');
  assert(/no attempt to identify/i.test(r), 'attribution disclaimer missing');
});
check('unknown report kind rejected', () => {
  runExpectFail(['report', ...base, '--kind','nonsense'], 1);
});

console.log('\nseal + integrity');
check('seal succeeds on a clean package', () => {
  const out = run(['seal', ...base]);
  assert(/SEALED/.test(out), 'seal not confirmed');
  assert(fs.existsSync(pkg('package.sha256')), 'package.sha256 missing');
});
check('verify passes clean (exit 0)', () => {
  const out = run(['verify', ...base]);
  assert(/all 3 items verified/.test(out), 'verify did not confirm');
});
check('sealed package refuses new items', () => {
  runExpectFail(['add', ...base, '--file', f2, '--label','late'], 1);
});
check('TAMPER: altered artifact detected (exit 2)', () => {
  const t = pkg('items','E002','E002.mp4');
  const orig = fs.readFileSync(t);
  fs.writeFileSync(t, 'TAMPERED');
  const out = runExpectFail(['verify', ...base], 2);
  assert(/HASH MISMATCH/.test(out), 'mismatch not reported');
  fs.writeFileSync(t, orig);
});
check('TAMPER: deleted artifact detected (exit 2)', () => {
  const t = pkg('items','E003','E003.csv');
  const orig = fs.readFileSync(t);
  fs.unlinkSync(t);
  const out = runExpectFail(['verify', ...base], 2);
  assert(/MISSING file/.test(out), 'missing file not reported');
  fs.writeFileSync(t, orig);
});
check('recovers to clean after tampering is reverted', () => {
  const out = run(['verify', ...base]);
  assert(/all 3 items verified/.test(out), 'did not return to clean');
});
check('TAMPER: edited manifest breaks the seal (exit 2)', () => {
  const mf = pkg('manifest.json');
  const orig = fs.readFileSync(mf, 'utf8');
  fs.writeFileSync(mf, orig.replace('"label": "two"', '"label": "EDITED"'));
  const out = runExpectFail(['verify', ...base], 2);
  assert(/SEAL BROKEN/.test(out), 'broken seal not reported');
  fs.writeFileSync(mf, orig);
});
check('seal intact again after manifest restored', () => {
  const out = run(['verify', ...base]);
  assert(/seal:   INTACT/.test(out), 'seal not intact after restore');
});

console.log(`\n${pass}/${pass + fail} checks passed`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
