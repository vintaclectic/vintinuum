#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { assessClock, createObserver } = require('./lib/world-clock-watchdog');
const { startWatchdog } = require('./world-clock-watchdog');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
(async () => {
  const now = 1800000000000;
  const row = { tick: 10, tick_ms: 60000, last_tick_at: now / 1000 };
  check('healthy negative control: no skipped tick', () => assert.equal(assessClock(row, now + 60000).skipped_ticks, 0));
  check('one skipped tick after scheduling grace', () => assert.equal(assessClock(row, now + 75000).skipped_ticks, 1));
  check('multiple skipped ticks measured', () => assert.equal(assessClock(row, now + 195000).skipped_ticks, 3));
  check('future timestamp does not invent skipped ticks', () => assert.equal(assessClock(row, now - 1000).skipped_ticks, 0));
  check('configurable tick period respected', () => assert.equal(assessClock({ ...row, tick_ms: 10000 }, now + 25000).skipped_ticks, 2));
  check('missing row is unknown, never healthy', () => assert.throws(() => assessClock(null)));
  check('invalid tick period rejected', () => assert.throws(() => assessClock({ ...row, tick_ms: 0 })));
  const logs = [];
  const observe = createObserver(line => logs.push(line));
  observe(row, now + 1000);
  check('healthy observer stays quiet', () => assert.equal(logs.length, 0));
  observe(row, now + 80000);
  check('stall emits loud log without guessing cause', () => assert.match(logs[0], /SKIPPED_TICK.*"cause":"unknown"/));
  observe(row, now + 90000);
  check('warning rate limited', () => assert.equal(logs.length, 1));
  observe(row, now + 140000);
  check('continued stall emits reminder', () => assert.equal(logs.length, 2));
  observe({ ...row, tick: 13, last_tick_at: (now + 140000) / 1000 }, now + 141000);
  check('fresh persisted tick emits recovery', () => assert.match(logs[2], /RECOVERED/));
  let spawned = 0;
  let killed = 0;
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.kill = () => { killed++; };
  const timeoutLogs = [];
  let fakeNow = 1000;
  const watcher = startWatchdog({ dbPath: '/tmp/unused-test.db', timeoutMs: 10,
    intervalMs: 100000, now: () => fakeNow, log: line => timeoutLogs.push(line),
    spawnReader: () => { spawned++; return child; } });
  await new Promise(resolve => setTimeout(resolve, 30));
  check('blocked read emits explicit unknown timeout', () => assert.match(timeoutLogs[0], /READ_TIMEOUT.*unknown/));
  check('timed out read receives kill', () => assert.equal(killed, 1));
  watcher.probe();
  check('unkillable reader does not create subprocess pileup', () => assert.equal(spawned, 1));
  fakeNow += 60000;
  watcher.probe();
  check('blocked reader emits recurring loud reminder', () => assert.match(timeoutLogs[1], /READ_STILL_BLOCKED/));
  watcher.probe();
  check('blocked reader reminders are rate limited without pileup', () => { assert.equal(timeoutLogs.length, 2); assert.equal(spawned, 1); });
  child.emit('close', null);
  watcher.stop();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'world-watchdog-'));
  try {
    const db = path.join(dir, 'fixture.db');
    execFileSync('sqlite3', [db, 'CREATE TABLE world_clock(id INTEGER, tick INTEGER,tick_ms INTEGER,last_tick_at INTEGER); INSERT INTO world_clock VALUES(1,42,60000,unixepoch()-600);']);
    const script = path.join(__dirname, 'world-clock-watchdog.js');
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, [script, '--db', db, '--once'], { encoding: 'utf8', timeout: 10000 });
    check('separate process reads stale persisted clock and logs skipped tick', () => { assert.equal(result.status, 0); assert.match(result.stderr, /SKIPPED_TICK.*"tick":42/); });
    execFileSync('sqlite3', [db, 'UPDATE world_clock SET last_tick_at=unixepoch(),tick=43;']);
    const fresh = spawnSync(process.execPath, [script, '--db', db, '--once'], { encoding: 'utf8', timeout: 10000 });
    check('live DB negative control does not warn on healthy clock', () => { assert.equal(fresh.status, 0); assert.doesNotMatch(fresh.stderr, /SKIPPED_TICK/); assert.match(fresh.stderr, /SAMPLE.*"tick":43/); });
    check('observer never changes database', () => assert.equal(execFileSync('sqlite3', [db, 'SELECT tick FROM world_clock;'], { encoding: 'utf8' }).trim(), '43'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`${passed}/${passed} passed (includes healthy-clock negative controls)`);
})().catch(err => { console.error(err); process.exitCode = 1; });
