# World clock watchdog (BAJQEVG)

Run independently of the brain so a blocked brain event loop cannot silence
its own alarm. The watchdog never restarts the brain or writes its database.

```sh
node scripts/world-clock-watchdog.js --db /home/vinta/vintinuum-api/vintinuum.db
```

Use `--once` for a single diagnostic. Continuous mode samples every 15 seconds,
warns after one tick period plus 25% scheduling grace, repeats warnings at most
once per minute, and logs recovery when the persisted clock becomes current.
The period is read from `world_clock.tick_ms`, never assumed to be 60 seconds.
`SKIPPED_TICK` means a persisted tick deadline was missed, not that its cause is
known. `READ_ERROR` and `READ_TIMEOUT` mean the clock could not be observed;
they never imply it is healthy. Read failures are logged, not repaired.

Each probe runs read-only sqlite3 in a separate process, with a 1-second SQLite
busy timeout and a 5-second parent deadline. On timeout the parent logs loudly
and sends SIGKILL. If disk sleep prevents that child from exiting, it retains
the active-reader slot instead of accumulating blocked readers, logging
`READ_STILL_BLOCKED` reminders every minute. In `--once` mode a reader stuck
in uninterruptible disk sleep may retain pipe handles after SIGKILL: use an
outer `timeout --kill-after=2s 10s node scripts/world-clock-watchdog.js --db
/home/vinta/vintinuum-api/vintinuum.db --once` for a bounded calling shell.
The kernel may retain the blocked reader until disk I/O returns. A watchdog
subject to whole-host starvation can itself run late; no userspace monitor can
promise immediate detection when the operating system cannot schedule it.

For durable operation install this command as its own supervised service,
using an absolute script path and logging stderr. Do not put the observer in
the brain's main process. Service installation is a separate operational step;
the files alone do not install or enable it.

Verification:

```sh
node scripts/verify-world-clock-watchdog-BAJQEVG.js
```

The verifier checks warning thresholds, rate limiting, recovery, missing data,
reader timeouts, prevention of blocked-reader accumulation, and independent
read-only SQLite probes with healthy and stale-clock negative controls.

Host installation (run on the host after placing the committed scripts at the
paths below; not performed by this change):

```sh
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/vintinuum-world-clock-watchdog.service" <<'UNIT'
[Unit]
Description=Read-only Vintinuum world clock watchdog

[Service]
Type=simple
ExecStart=/usr/bin/node /home/vinta/.council-worktrees/Vintinuum-seat-2/scripts/world-clock-watchdog.js --db /home/vinta/vintinuum-api/vintinuum.db
Restart=on-failure
RestartSec=15
MemoryMax=96M
TasksMax=8
NoNewPrivileges=yes
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now vintinuum-world-clock-watchdog.service
systemctl --user status vintinuum-world-clock-watchdog.service
journalctl --user -u vintinuum-world-clock-watchdog.service -n 20 --no-pager
```

Verify `/usr/bin/node` exists before installation. Keep the script path stable
(or replace it with a stable release checkout). This assumes a running systemd
user manager; boot persistence without a login additionally requires user
lingering already enabled. Undo with `systemctl --user disable --now
vintinuum-world-clock-watchdog.service`, remove the unit, then daemon-reload.
