# Bitmagnet IO Throttling Implementation
**Task:** G3D9RUV  
**Date:** 2026-10-22  
**Agent:** helios-sec10

## Problem
DirHaven backend boot times vary wildly (13s to 551s) due to IO contention on /dev/sdd. At peak contention:
- IO pressure: some avg300=67.7%, full avg300=12.6%
- /dev/sdd activity: 66MB read + 35MB write per 15s
- Bitmagnet postgres backends in D state (disk wait)
- The 551s boot left app.dirhaven.com unavailable for 10+ minutes

## Root Cause Analysis
**CONFIRMED:** Bitmagnet postgres is the primary IO consumer on /dev/sdd
- 6 active postgres connections to bitmagnet database
- Multiple backends observed in D state during high IO pressure
- /dev/sdd (rotational HDD) hosts both:
  - PostgreSQL data directory (/var/lib/postgresql)
  - DirHaven server/node_modules

**IO Contention Pattern:**
- Intermittent: varies from minimal IO (current: 0 MB/15s) to heavy (66MB/15s)
- Correlates with bitmagnet crawler activity
- Backend boot import-graph hits contention randomly depending on timing

## Solution Implemented

### 1. PostgreSQL Configuration Tuning
Modified `/etc/postgresql/16/main/postgresql.conf` to throttle bitmagnet queries:

```conf
# --- IO Throttling for bitmagnet (added 2026-10-22, task G3D9RUV) ---
# Reduce work_mem to lower per-query memory usage and reduce spill-to-disk IO
work_mem = 2MB

# Disable prefetching to reduce IO contention during heavy load
effective_io_concurrency = 0
```

**Rationale:**
- **work_mem 2MB** (down from default 4MB): Reduces per-query memory allocation, decreasing likelihood of sorts/hashes spilling to disk
- **effective_io_concurrency 0**: Disables kernel prefetching, which can amplify IO under contention on [none]-scheduler HDDs

### 2. Configuration Reload Required
**Manual step needed (requires sudo):**
```bash
./reload-postgres-throttle.sh
```

This will:
1. Reload postgres configuration (no restart needed)
2. Verify settings took effect
3. Show current work_mem and effective_io_concurrency values

## Verification Steps

### 1. Check Settings Applied
```bash
sudo -u postgres psql -c "SHOW work_mem;"
sudo -u postgres psql -c "SHOW effective_io_concurrency;"
```
Expected: `2MB` and `0`

### 2. Monitor IO Impact
```bash
./monitor-io-impact.sh
```
This monitors /dev/sdd IO and pressure for 60 seconds, showing:
- IO pressure metrics (some/full avg)
- Data read from /dev/sdd
- Active postgres connections
- Backends in D state

### 3. Test Backend Boot Times
After reload, monitor DirHaven backend restart times in `server/logs/pm2-out.log`:
```bash
cd ~/dirhaven
pm2 restart dirhaven-backend
tail -f server/logs/pm2-out.log | grep 'process.uptime'
```
Expected: More consistent boot times, ideally <20s even under bitmagnet load

## Reversibility
**To revert if needed:**
1. Edit `/etc/postgresql/16/main/postgresql.conf`
2. Remove the "IO Throttling" section (last 4 lines)
3. Run `sudo systemctl reload postgresql@16-main`

**Backup:** `/etc/postgresql/16/main/postgresql.conf.backup-20261022-HHMM`

## Alternative Solutions (if throttling insufficient)

### Option A: Move Postgres Data Directory
Move bitmagnet's postgres data to a different device:
- Pros: Complete IO isolation, best performance
- Cons: Requires postgres data migration, more complex setup
- Steps: Create new data dir on different device, pg_dumpall, initdb, restore

### Option B: Increase work_mem with IO limits
- Set work_mem higher but add postgres IO limiting via:
  - `max_parallel_workers_per_gather = 0` (disable parallel queries)
  - `max_worker_processes = 2` (limit background workers)
  - Tune `checkpoint_timeout` and `checkpoint_completion_target`

### Option C: Bitmagnet Crawler Rate Limiting
Investigate bitmagnet's own configuration for crawler throttling:
- Check for rate limiting options in bitmagnet config
- May require looking at bitmagnet source/docs
- Could complement postgres tuning

## Monitoring

**Key metrics to watch:**
1. Backend boot times (pm2-out.log)
2. `/proc/pressure/io` some avg300 (target: <30%)
3. `/dev/sdd` read throughput (target: <20MB/15s during boots)
4. Postgres backends in D state (target: 0 during steady state)

**Long-term:**
- Add prometheus/grafana metrics for IO pressure
- Alert on backend boot time >30s
- Track bitmagnet query performance (pg_stat_statements)

## References
- Task G3D9RUV
- 6WCR9PY: ionice ineffective on [none]-scheduler
- /proc/pressure/io: kernel IO pressure stall information
- Postgres work_mem: https://www.postgresql.org/docs/16/runtime-config-resource.html
