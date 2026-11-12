'use strict';

// Independent observer: never loads the brain or writes its database.
function assessClock(row, nowMs = Date.now()) {
  if (!row || !Number.isSafeInteger(row.tick) || row.tick < 0 ||
      !Number.isFinite(row.tick_ms) || row.tick_ms <= 0 ||
      !Number.isFinite(row.last_tick_at) || row.last_tick_at <= 0) {
    throw new Error('invalid or missing world_clock row');
  }
  const ageMs = Math.max(0, nowMs - row.last_tick_at * 1000);
  // One full period is normal; allow 25% scheduling jitter before warning.
  const skipped = Math.max(0, Math.floor((ageMs - row.tick_ms * 0.25) / row.tick_ms));
  return { tick: row.tick, age_ms: ageMs, tick_ms: row.tick_ms, skipped_ticks: skipped };
}

function createObserver(log, reminderMs = 60000) {
  let unhealthy = false;
  let lastWarning = -Infinity;
  return (row, nowMs = Date.now()) => {
    const sample = assessClock(row, nowMs);
    if (sample.skipped_ticks && (!unhealthy || nowMs - lastWarning >= reminderMs)) {
      log(`[world-clock-watchdog] SKIPPED_TICK ${JSON.stringify({ ...sample, cause: 'unknown', observed_at: new Date(nowMs).toISOString() })}`);
      lastWarning = nowMs;
    } else if (!sample.skipped_ticks && unhealthy) {
      log(`[world-clock-watchdog] RECOVERED ${JSON.stringify(sample)}`);
    }
    unhealthy = !!sample.skipped_ticks;
    return sample;
  };
}
module.exports = { assessClock, createObserver };
