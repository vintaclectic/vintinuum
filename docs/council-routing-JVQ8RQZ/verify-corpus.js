#!/usr/bin/env node
'use strict';
// Applies the review artifact exclusively to a temporary directory. No live writes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const root = process.env.VINTINUUM_API_ROOT || '/home/vinta/vintinuum-api';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-corpus-'));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
try {
  fs.mkdirSync(path.join(tmp, 'corpus'));
  fs.copyFileSync(path.join(root, 'corpus/sources-extra.js'), path.join(tmp, 'corpus/sources-extra.js'));
  execFileSync('git', ['apply', path.join(__dirname, 'corpus.patch')], { cwd: tmp });
  const ledger = path.join(tmp, 'ledger.jsonl');
  const secret = 'PRIVATE_USER_TEXT_password=sk-123456789012345678901234567890';
  const good = { kind: 'triage', provider: 'xai', model: secret, ok: true, tokens: 54, ms: 81, cost_usd: 0.02,
    task_id: secret, at: secret, error: secret, why: secret,
    answer: { shape: 'feature', tier_delta: -1, read_fraction: 0.4, brief: secret, phases: [secret] },
    handoff: { why: secret } };
  const invalidFields = { kind: 'triage', provider: secret, ok: secret, tokens: secret, ms: -2, cost_usd: Infinity,
    answer: { shape: secret, tier_delta: '1', read_fraction: 2 } };
  fs.writeFileSync(ledger, [JSON.stringify(good), '{bad', 'null', JSON.stringify({ kind: secret }),
    JSON.stringify(invalidFields), JSON.stringify({ kind: 'triage-skip', why: secret }),
    JSON.stringify({ kind: 'triage-error', error: secret })].join('\n'));
  let writes = 0, closed = false;
  const mod = { exports: {} };
  const source = fs.readFileSync(path.join(tmp, 'corpus/sources-extra.js'), 'utf8');
  const context = { module: mod, exports: mod.exports, console,
    process: { argv: ['node', 'fixture', '--dry-run', '--only', 'council_relay'], env: { HOME: tmp, COUNCIL_RELAY_LEDGER: ledger } },
    require(name) {
      if (name === './shards') return { writeShard() { writes++; } };
      if (name === './gates') return require(path.join(root, 'corpus/gates.js'));
      if (name === 'better-sqlite3') return class {
        pragma() {} prepare() { return { all: () => [] }; } close() { closed = true; }
      };
      return require(name);
    },
  };
  vm.runInNewContext(source, context, { filename: 'sources-extra.js' });
  const rows = [];
  mod.exports.SOURCES.council_relay(null, { push(r, userId) { rows.push({ r, userId }); } });
  check('patch applies and lane is registered in default SOURCES iteration', () => {
    assert.equal(typeof mod.exports.SOURCES.council_relay, 'function');
    assert.match(source, /Object.entries\(SOURCES\)/);
    assert.match(fs.readFileSync(path.join(root, 'corpus/refresh-all.sh'), 'utf8'), /step 10m corpus\/sources-extra\.js/);
  });
  check('valid events exported; malformed JSON/null/unknown kinds skipped', () => assert.equal(rows.length, 4));
  check('free text and invalid typed telemetry excluded', () => {
    assert.ok(!JSON.stringify(rows).includes(secret));
    const clean = JSON.parse(rows[1].r.messages[2].content);
    assert.deepEqual(clean, { event: 'triage', task_outcome: 'unverified' });
  });
  check('numeric telemetry preserved and predictions explicitly advisory', () => {
    const r = JSON.parse(rows[0].r.messages[2].content);
    assert.equal(r.tokens, 54); assert.equal(r.cost_usd, 0.02);
    assert.equal(r.advisory_tier_delta, -1); assert.equal(r.task_outcome, 'unverified');
    assert.equal(r.triage_parse_ok, true); assert.equal(r.success, undefined);
  });
  check('system-only identity; no user-derived content exported', () => rows.forEach(({r, userId}) => {
    assert.equal(userId, 0); assert.equal(r.user_id, 0);
  }));
  check('dry-run uses real consent/PII gate without shard writes', () => {
    const report = mod.exports.run();
    assert.equal(report.council_relay.written, 4);
    assert.equal(writes, 0); assert.equal(closed, true);
  });
  fs.unlinkSync(ledger);
  check('missing ledger is harmless', () => {
    const empty = []; mod.exports.SOURCES.council_relay(null, { push: r => empty.push(r) });
    assert.equal(empty.length, 0);
  });
  console.log(`${checks}/${checks} checks passed`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
