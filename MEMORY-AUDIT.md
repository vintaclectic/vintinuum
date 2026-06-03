# MEMORY-AUDIT — 2026-06-03 11:57 EDT

**Read-only advisory. No process was killed, no config was modified. Vinta + orchestrator decide what to trim.**

---

## Executive summary

WSL2 has a **20 GB cap** (`.wslconfig`) — currently **5.1 GB used / 14 GB available / 3.8 GB buff/cache / 0 B swap**. Load avg 6.06 is elevated because **two Ollama runner processes are pegged at ~140% CPU each** holding hot LLM weights resident. Top three RAM eaters: **Ollama qwen3 runner (1.09 GB)**, **Ollama qwen2.5 runner (561 MB)**, **clawdbot-gateway (408 MB)** — together ~2.0 GB (~40% of process RSS). Four concurrent `claude` CLI sessions add another **1.38 GB**. The system is *not* out of RAM — what makes new Claude sessions *feel* heavy is (a) CPU contention from Ollama runners, (b) accumulated `claude` sessions never reaped, and (c) the full dirhaven PM2 stack running even though Vinta has it nominally "paused" (no `~/.dirhaven-pause` flag exists, so PM2 brought it all back up).

---

## Top 15 processes by RSS (right now)

| Rank | RSS (MB) | Process | What it is |
|-----:|---------:|---------|------------|
| 1 | 1091 | `ollama runner` (qwen3:0.6b) | Hot LLM weights; **CPU 139%**, idle-timeout in ~3 min |
| 2 | 561 | `ollama runner` (qwen2.5:0.5b) | Hot LLM weights; **CPU 145%**, idle-timeout in ~5 min |
| 3 | 408 | `clawdbot-gateway` | Vinta's separate clawdbot service (not in PM2) |
| 4 | 391 | `claude` (PID 8904) | Claude Code session — `--agent vintinuum --resume` |
| 5 | 363 | `claude` (PID 13344) | Claude Code session — `--agent vintinuum --resume` |
| 6 | 345 | `node vite dev` (PID 1906) | A Vite dev server (likely dirhaven frontend) |
| 7 | 317 | `claude` (PID 5306) | Claude Code session — bare `--dangerously-skip-permissions` |
| 8 | 315 | `claude` (PID 11880) | Claude Code session — `--agent vintinuum --resume` |
| 9 | 238 | `node vintinuum-api/server.js` | **The brain** — keep |
| 10 | 182 | `node dirhaven/server/server.js` | `dirhaven-backend` (PM2); restarted 42x — crash loop |
| 11 | 152 | `ollama serve` | Ollama daemon (always-on) |
| 12 | 112 | `mariadbd` | MariaDB (dirhaven dep) |
| 13 | 111 | `node dirhaven/server/worker-service.js` | `dirhaven-worker` (PM2); restarted 29x |
| 14 | 104 | `warp-svc` | Cloudflare WARP (system) |
| 15 | 91 | `PM2 God Daemon` | PM2 supervisor itself |

Total of top 15: **~4.78 GB**. Matches `free -h` "used" figure within rounding.

### Dirhaven PM2 footprint (15 procs, all `online`, no pause flag found)

dirhaven-backend (149) + dirhaven-worker (110) + dirhaven-crawler (88) + dumps-worker (84) + dcms-service (83) + dumps-watchdog (77) + dirhaven-metrics (71) + dirhaven-monitor (70) + redis-watchdog (63) + obs-stream-watcher (62) + docker-watchdog (61) + warp-watchdog (61) + tor-watchdog (60) + aria2-daemon (58) + pm2-logrotate (70) = **~1.16 GB total**. Plus `dirhaven-backend` and `dirhaven-worker` are restart-looping (42 / 29 restarts in <10 min uptime) — every restart spikes CPU.

### Disk caches (bloat that pressures RAM via page cache)

- `~/.cache/vintinuum`: **2.8 GB** (puppeteer screenshots? brain artifacts? worth a look)
- `~/.cache/puppeteer`: 581 MB
- `~/.cache/huggingface`: 216 MB
- `~/.pm2/logs`: 251 MB
- `/tmp`: 15 MB (fine)

---

## Highest-ROI trims (ranked by MB-freed-per-disruption)

### 1. Stop the dirhaven PM2 stack — **~1.16 GB freed, low risk**
The pause flag (`~/.dirhaven-pause`) Vinta uses to gate dirhaven **does not exist on disk right now**, so PM2 resurrected the full stack on boot. dirhaven-backend and dirhaven-worker are crash-looping (42 / 29 restarts), wasting CPU on top of the RAM.
```
touch ~/.dirhaven-pause                                # re-arm the pause gate
pm2 stop /^dirhaven-/ /^dumps-/ /^docker-watchdog$/ /^warp-watchdog$/ /^tor-watchdog$/ /^redis-watchdog$/ /^aria2-daemon$/ /^dcms-service$/ /^obs-stream-watcher$/
pm2 save
```
Risk: **low** — dirhaven is the paused subsystem by Vinta's own design. Vintinuum (brain + tunnel + pty) stays up.

### 2. Reap stale `claude` CLI sessions — **~700-1100 MB freed, low risk**
Four `claude` processes are alive: PIDs 8904 / 13344 / 11880 / 5306. The current session is one of them. The other three are likely orphaned `--resume`-able sessions from earlier today. Each carries its own conversation transcript in RAM.
```
ps -eo pid,etime,args | grep '^[[:space:]]*[0-9]* .* claude '   # confirm which are stale
# Then close stale terminals or: kill <pid>   (sessions stay resumable on disk)
```
Risk: **low** — Claude Code sessions are persisted; killing a process only ends the live transcript, you can `claude --resume` it.

### 3. Set Ollama `OLLAMA_KEEP_ALIVE=2m` (or `0`) — **~1.65 GB freed when idle, low risk**
Both runners are pegged at 139-145% CPU **right now** (they were probably just used by a Vintinuum thought-tick). Default keep-alive is 5 min; the qwen3 runner alone is 1.09 GB. Drop keep-alive aggressively so models unload between calls.
```
# /etc/systemd/system/ollama.service.d/keepalive.conf
[Service]
Environment="OLLAMA_KEEP_ALIVE=2m"
```
Then `sudo systemctl daemon-reload && sudo systemctl restart ollama`.
Risk: **low** — first call after idle pays ~1-2s reload cost. Vintinuum's brain doesn't hit Ollama on every request.

### 4. Add a `.wslconfig` memory floor / cap tune — **prevents future bloat, no immediate MB**
Current `.wslconfig` is already healthy: `memory=20GB processors=8 swap=8GB vmIdleTimeout=86400000`. **No change needed** unless Windows host is under pressure — in which case lower to `memory=16GB` to force WSL to be tighter.
Risk: **none** if left alone; **medium** if lowered while dirhaven stack is running (would OOM).

### 5. Investigate / trim `~/.cache/vintinuum` (2.8 GB) — **disk freed, indirect RAM win, low risk**
Not RAM directly, but a 2.8 GB cache pressures the page cache and slows D:-drive contention.
```
du -sh /home/vinta/.cache/vintinuum/*   # see what's in there before deleting
```
Risk: **low** — it's a cache by definition. Inspect before nuking.

### 6. `pm2 flush` to clear 251 MB of log files — **disk freed, none in RAM, none risk**
```
pm2 flush
```

---

## Safe to act on right now (no Vinta call needed)

- **`pm2 flush`** — clears 251 MB of PM2 log files. Zero risk.
- **Close any unused terminal tabs running stale `claude` CLI sessions** — frees ~300 MB each, resumable later.

## Needs Vinta's call

- **Stopping the dirhaven PM2 stack** (~1.16 GB) — Vinta owns the pause-flag protocol; orchestrator should not unilaterally `pm2 stop` dirhaven services.
- **Setting `OLLAMA_KEEP_ALIVE=2m`** (~1.65 GB when idle) — touches a systemd unit; needs sudo + Vinta sign-off on the trade-off (slight cold-start latency on Vintinuum thought-ticks).
- **Trimming `~/.cache/vintinuum`** (2.8 GB disk) — could contain artifacts the brain re-reads; inspect before deleting.
- **Lowering `.wslconfig memory=20GB` → `16GB`** — only if Windows host itself is RAM-starved.

---

## TL;DR for the orchestrator

The system isn't OOM (14 GB free). What's making Claude sessions *feel* heavy is **CPU contention from the two Ollama runners (~285% CPU combined)** plus **four concurrent `claude` CLI processes**. The highest-ROI single move is **stopping the dirhaven PM2 stack** (~1.16 GB + kills the restart-loop CPU churn) once Vinta confirms — closely followed by **OLLAMA_KEEP_ALIVE=2m** which would auto-recover ~1.65 GB any time the brain isn't actively thinking.
