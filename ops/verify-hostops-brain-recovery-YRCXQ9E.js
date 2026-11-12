#!/usr/bin/env node
'use strict';
// Test the staged broker patch without modifying or invoking the live broker.
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const assert = require('assert/strict');
const {execFileSync} = require('child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-hostops-'));
let passed = 0;
try {
  fs.mkdirSync(path.join(temp, 'lib'));
  fs.copyFileSync('/home/vinta/.claude/council-loop/lib/host-ops.js', path.join(temp, 'lib/host-ops.js'));
  execFileSync('patch', ['-p1', '--batch', '-i', path.join(root, 'patches/YRCXQ9E-host-ops.patch')], {cwd: temp});
  const source = fs.readFileSync(path.join(temp, 'lib/host-ops.js'), 'utf8');
  let calls = [], fail = false;
  const mod = {exports: {}};
  vm.runInNewContext(source, {
    module: mod, process: {env: {}}, console, Buffer,
    require(name) {
      if (name !== 'child_process') return require(name);
      return {execFileSync(cmd, args, options) {
        calls.push({cmd, args, options});
        if (args[0] === 'jlist') return JSON.stringify([
          {pm_id: 1, name: 'vintinuum-api', pid: 123, pm2_env: {}},
          {pm_id: 2, name: 'other', pid: 124, pm2_env: {}},
        ]);
        if (fail) {const e = new Error('exit 75'); e.stdout = 'HOLDING io_avg60=80\n'; throw e;}
        return 'RESULT exit=0\n';
      }};
    },
  });
  const run = name => mod.exports.runOp('pm2.restart', {name}, {tid: 'YRCXQ9E', allowed: ['pm2.restart']});
  const check = (name, fn) => {fn(); passed++; console.log(`PASS ${name}`);};
  check('API name routes through shared operation', () => {
    const result = run('vintinuum-api');
    assert.equal(result.restarted, 'vintinuum-api');
    assert.equal(calls.at(-1).cmd, '/bin/bash');
    assert.equal(calls.at(-1).args[1], 'hostop:YRCXQ9E');
    assert.equal(calls.at(-1).args[3], '--preserve-env');
    assert.equal(calls.at(-1).options.timeout, 90000);
  });
  check('numeric API id cannot bypass policy', () => {
    calls = []; run('1'); assert.equal(calls.at(-1).cmd, '/bin/bash');
  });
  check('hold is reported without direct restart fallback', () => {
    calls = []; fail = true;
    assert.throws(() => run('vintinuum-api'), /HOLDING io_avg60=80/);
    assert.equal(calls.length, 2); assert.equal(calls.at(-1).cmd, '/bin/bash');
    fail = false;
  });
  check('other services retain numeric restart', () => {
    calls = []; run('other'); assert.equal(calls.at(-1).args.join(' '), 'restart 2');
  });
  check('ungranted operations rejected before subprocess', () => {
    calls = [];
    assert.throws(() => mod.exports.runOp('pm2.restart', {name: '1'}, {tid: 'x', allowed: []}), /not granted/);
    assert.equal(calls.length, 0);
  });
  console.log(`${passed}/5 passed; staged patch only, live broker unchanged`);
} finally {fs.rmSync(temp, {recursive: true, force: true});}
