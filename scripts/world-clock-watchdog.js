#!/usr/bin/env node
'use strict';

// Run separately from vintinuum-api: blocked main-thread timers cannot warn.
// Only sqlite3 opens the live DB; a bounded read child keeps this observer alive
// even if the disk blocks. Never start a second reader before the first exits.
const { spawn } = require('node:child_process');
const { createObserver } = require('./lib/world-clock-watchdog');
const path = require('node:path');

function startWatchdog({ dbPath, intervalMs = 15000, timeoutMs = 5000,
  once = false, log = console.error, spawnReader = spawn, now = Date.now } = {}) {
  if (!path.isAbsolute(dbPath || '')) throw new Error('absolute --db path required');
  const observe = createObserver(log);
  let active = null;
  let stopped = false;
  let timer;
  let blockedReadAt = null;
  function probe() {
    if (stopped) return;
    if (active) {
      if (blockedReadAt !== null && now() - blockedReadAt >= 60000) {
        log('[world-clock-watchdog] READ_STILL_BLOCKED clock state unknown; prior reader has not exited; cause=unknown');
        blockedReadAt = now();
      }
      return;
    }
    const child = spawnReader('sqlite3', ['-readonly', '-json', '-cmd', '.timeout 1000',
      dbPath, 'SELECT tick,tick_ms,last_tick_at FROM world_clock WHERE id=1;'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    active = child;
    let output = '';
    let error = '';
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      blockedReadAt = now();
      log('[world-clock-watchdog] READ_TIMEOUT clock state unknown; reader exceeded deadline; cause=unknown');
      child.kill('SIGKILL');
      // D-state processes may not exit immediately. Keep active until close.
    }, timeoutMs);
    child.stdout.on('data', data => { output = (output + data).slice(0, 16384); });
    child.stderr.on('data', data => { error = (error + data).slice(0, 2048); });
    child.on('error', err => log(`[world-clock-watchdog] READ_ERROR ${err.message}`));
    child.on('close', code => {
      clearTimeout(deadline);
      active = null;
      blockedReadAt = null;
      if (!timedOut && !stopped) {
        try {
          if (code !== 0) throw new Error(`sqlite3 exit=${code}: ${error.trim()}`);
          const sample = observe(JSON.parse(output)[0]);
          if (once) log(`[world-clock-watchdog] SAMPLE ${JSON.stringify(sample)}`);
        } catch (err) { log(`[world-clock-watchdog] READ_ERROR ${err.message}`); }
      }
    });
  }
  if (!once) timer = setInterval(probe, intervalMs);
  probe();
  return { probe, stop() { stopped = true; clearInterval(timer); if (active) active.kill('SIGKILL'); } };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dbIndex = args.indexOf('--db');
  if (dbIndex < 0 || !args[dbIndex + 1]) {
    console.error('Usage: node scripts/world-clock-watchdog.js --db /absolute/vintinuum.db [--once]');
    process.exitCode = 2;
  } else {
    const watchdog = startWatchdog({ dbPath: args[dbIndex + 1], once: args.includes('--once') });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => watchdog.stop());
  }
}
module.exports = { startWatchdog };
