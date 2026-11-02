'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const driver = path.resolve(__dirname, '../runtime/bin/council-driver.sh');
const source = fs.readFileSync(driver, 'utf8');
const snippets = [...source.matchAll(/      # JVQ8RQZ:[\s\S]*?        continue\n      fi\n/g)].map(m => m[0]);
assert.equal(snippets.length, 2, 'both route entry points guard quality holds');
const syntax = spawnSync('bash', ['-n', driver], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr);
let checks = 0;
for (const snippet of snippets) {
  for (const [plan, hold] of [
    [{ quality_floor: 'L4', ladder: [] }, true],
    [{ quality_floor: 'L4', ladder: [{ model: 'capable', tier: 'L4' }] }, false],
    [{ quality_floor: null, ladder: [] }, false],
  ]) {
    const program = [
      'NODE_BIN="$TEST_NODE"; PLAN_JSON="$TEST_PLAN"; TID=JVQ8RQZ; i=1',
      'queue() { printf "QUEUE:%s\\n" "$*"; }',
      'log() { :; }; VINTASK=queue',
      'for attempt in once; do', snippet,
      'printf "EXECUTE\\n"', 'done',
    ].join('\n');
    // Guard redirects its queue stdout, so trace the real queue call on fd 3.
    const traced = program.replace('printf "QUEUE:%s\\n" "$*";', 'printf "QUEUE:%s\\n" "$*" >&3;');
    const result = spawnSync('bash', ['-c', `exec 3>&1\n${traced}`], {
      encoding: 'utf8', env: { ...process.env, TEST_NODE: process.execPath, TEST_PLAN: JSON.stringify(plan) },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes('QUEUE:block JVQ8RQZ No available model meets required L4'), hold);
    assert.equal(result.stdout.includes('EXECUTE'), !hold);
    checks++;
  }
}
console.log(`driver quality: ${checks}/${checks} branch scenarios pass; bash syntax valid`);
