#!/usr/bin/env node
'use strict';
// Diagnostic reproducer, NOT feature acceptance. A passing run means the unsafe
// double-writer behavior was reproduced. --control suppresses standby admission
// to prove the double-writer assertions detect its absence (expected exit 1).
// Uses the original module with separate temporary state dirs; no SSH/live writes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const modulePath = process.env.MACHINE_LEASE_MODULE ||
  '/home/vinta/.claude/council-loop/lib/machine-lease.js';
const ML = require(modulePath);
const control = process.argv.includes('--control');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'HFUG89N-partition-'));
const envKeys = ['COUNCIL_MACHINE_ROLE', 'COUNCIL_MACHINE_ID', 'COUNCIL_LEASE_TTL_MS'];
const saved = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
let passed = 0, total = 0;
function check(label, truth) {
  total++;
  if (truth) passed++;
  console.log(`${truth ? 'PASS' : 'FAIL'} ${label}`);
}
function gate(dir, id, role, now) {
  process.env.COUNCIL_MACHINE_ROLE = role;
  process.env.COUNCIL_MACHINE_ID = id;
  process.env.COUNCIL_LEASE_TTL_MS = '1000';
  const g = ML.gate(dir, { now: () => now });
  if (control && role === 'standby') g.canClaim = () => false;
  return g;
}
try {
  const pc = path.join(root, 'pc'), vps = path.join(root, 'vps');
  fs.mkdirSync(pc); fs.mkdirSync(vps);
  const initial = gate(pc, 'pc', 'primary', 1000).renew();
  fs.copyFileSync(ML.leaseFile(pc), ML.leaseFile(vps));
  const taskFile = dir => path.join(dir, 'tasks.jsonl');
  for (const dir of [pc, vps]) fs.writeFileSync(taskFile(dir), JSON.stringify({ id: 'TEST', status: 'todo' }) + '\n');
  check('fresh replicated primary lease blocks standby', !gate(vps, 'vps', 'standby', 1500).canClaim());
  // Partition starts: primary keeps renewing, standby receives no new snapshots.
  const p = gate(pc, 'pc', 'primary', 3001);
  p.renew();
  const s = gate(vps, 'vps', 'standby', 3001);
  check('PC lease is fresh while VPS replica is expired',
    ML.readLease(pc).expires_at > 3001 && ML.readLease(vps).expires_at < 3001);
  check('partition admits BOTH machines at the same logical instant', p.canClaim() && s.canClaim());
  // Minimal cmdNext transaction model: gate, renew, mutate local task while
  // holding a local lock. Deliberately NOT a claim to execute the full CLI.
  function claim(dir, g, owner) {
    const lock = path.join(dir, '.tasks.lock');
    const fd = fs.openSync(lock, 'wx');
    try {
      if (!g.canClaim()) return null;
      g.renew();
      const task = JSON.parse(fs.readFileSync(taskFile(dir), 'utf8'));
      if (task.status !== 'todo') return null;
      task.status = 'doing'; task.owner = owner;
      fs.writeFileSync(taskFile(dir), JSON.stringify(task) + '\n');
      return task;
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  const claims = [claim(pc, p, 'pc-seat'), claim(vps, s, 'vps-seat')].filter(Boolean);
  check('two separate local-lock transactions claim the SAME replicated card',
    claims.length === 2 && claims.every(t => t.id === 'TEST'));
  console.log(`OBSERVED claims=${claims.length}, unique_task_ids=${new Set(claims.map(t => t.id)).size}`);
  check('fresh gate instances after restart still admit both local stores',
    gate(pc, 'pc', 'primary', 3100).canClaim() && gate(vps, 'vps', 'standby', 3100).canClaim());
  const standbyLease = ML.readLease(vps);
  // Even after handback sync, primary ignores an unexpired standby owner.
  check('primary admits itself against a fresh foreign standby lease',
    ML.canClaimWith({ ...initial, holder: 'vps', role: 'standby', expires_at: 9000 }, 'pc', 'primary', 3100));
  check('independent local stores retain conflicting task ownership',
    JSON.parse(fs.readFileSync(taskFile(pc))).owner === 'pc-seat' &&
    JSON.parse(fs.readFileSync(taskFile(vps))).owner === 'vps-seat');
  check('lease writes remained confined to temporary directories',
    ML.leaseFile(pc).startsWith(root + path.sep) && ML.leaseFile(vps).startsWith(root + path.sep));
  console.log(`${passed}/${total} diagnostic checks pass${control ? ' (negative control: expected failures)' : ' (vulnerability reproduced; NOT acceptance)'}`);
  process.exitCode = passed === total ? 0 : 1;
} finally {
  for (const k of envKeys) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  fs.rmSync(root, { recursive: true, force: true });
}
