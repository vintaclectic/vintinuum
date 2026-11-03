'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.resolve(__dirname, '../runtime/lib/spawn-agent.js');
const source = fs.readFileSync(filename, 'utf8');
let calls = 0;
let taskfile;
let behavior = 'ok';
const task = {
  title: 'Bounded implementation', detail: 'x'.repeat(5000), acceptance: 'security review required',
  priority: 1, escalated: true, model: 'chosen-model', provider: 'anthropic',
  checkpoint: { next: 'review', evidence: ['unit tests pass'] },
};
const sandbox = {
  module: { exports: {} }, __dirname: path.dirname(filename), process,
  console: { error() {}, warn() {} },
  require(name) {
    if (name !== 'child_process') return require(name);
    return { spawnSync(bin, args, options) {
      calls++;
      taskfile = args[args.indexOf('--taskfile') + 1];
      assert.equal(bin, process.execPath);
      assert(args.includes('--agentic'));
      assert.equal(options.timeout, 10000);
      assert.equal(fs.statSync(taskfile).mode & 0o777, 0o600);
      assert.deepEqual(JSON.parse(fs.readFileSync(taskfile, 'utf8')), task);
      if (behavior === 'throw') throw new Error('spawn test failure');
      if (behavior === 'failure') return { status: 1, stderr: 'unavailable' };
      if (behavior === 'hold') return { status: 0, stdout: JSON.stringify({ quality_floor: 'L4', ladder: [] }) };
      return { status: 0, stdout: JSON.stringify({ kind: 'security', ladder: [
        { provider: 'anthropic', model: 'claude-opus-5', tier: 'L4' },
      ] }) };
    } };
  },
};
vm.runInNewContext(source, sandbox, { filename });
const routed = sandbox.module.exports.route(task);
assert.equal(routed.model, 'opus');
assert.equal(routed.kind, 'security');
assert(!fs.existsSync(path.dirname(taskfile)));
behavior = 'failure';
assert.equal(sandbox.module.exports.route(task).fallback, true);
assert(!fs.existsSync(path.dirname(taskfile)));
behavior = 'throw';
assert.throws(() => sandbox.module.exports.route(task), /spawn test failure/);
assert(!fs.existsSync(path.dirname(taskfile)));
behavior = 'hold';
assert.throws(() => sandbox.module.exports.route(task), /required L4 quality floor/);
assert(!fs.existsSync(path.dirname(taskfile)));
assert.equal(calls, 4);
console.log('spawn metadata: 4/4 scenarios pass; metadata preserved, temporary files cleaned, quality hold respected');
