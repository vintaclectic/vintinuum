#!/usr/bin/env bash
# COUNCIL DRIVER — the loop that lives OUTSIDE the agent.
# ---------------------------------------------------------------------------
# No prompt instruction can make an agent loop (the model always stops at end
# of turn). So the loop lives here: this script wakes `claude -p` (Opus 5),
# hands it ONE atomically-claimed task, lets it work to completion, reads the
# status line, and wakes it again for the next task — forever, until the queue
# is empty or Vinta stops it.
#
# Run one driver per parallel "seat". Each seat gets its own git worktree so
# they never stomp each other's files.
#
#   council-driver.sh <AGENT_ID> <PROJECT> <REPO_DIR> [MAX_ITERS]
#
# e.g.  council-driver.sh seat-1 Vintinuum /home/vinta/vintinuum 200
#
# Stop everything:  touch ~/.claude/council-loop/state/STOP   (or council-stop)
set -u

AGENT_ID="${1:-seat-1}"
PROJECT="${2:-general}"
REPO_DIR="${3:-/home/vinta/vintinuum}"
MAX_ITERS="${4:-500}"

ROOT="$HOME/.claude/council-loop"
BIN="$ROOT/bin"
STATE="$ROOT/state"
LOGS="$ROOT/logs"
LOCKS="$ROOT/locks"
PROTO="$ROOT/AUTONOMOUS_PROTOCOL.md"
STOP="$STATE/STOP"
mkdir -p "$STATE" "$LOGS" "$LOCKS"

export PATH="/home/vinta/.local/bin:/home/vinta/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin"
export HOME=/home/vinta
# The pid the queue stamps on any card THIS driver claims, so an abandoned card can
# be identified as an orphan by identity rather than by seat name — a seat name is
# reused by every relaunch and therefore proves nothing (task UHM5W3E).
export VINTASK_DRIVER_PID=$$
CLAUDE_BIN="$(command -v claude || echo /home/vinta/.local/bin/claude)"
VINTKEY_BIN="$HOME/.claude/council-loop/bin/vintkey"
NODE_BIN="$(command -v node || echo /home/vinta/.nvm/versions/node/v22.22.0/bin/node)"
VINTASK_JS="$BIN/vintask.js"
VINTASK="$NODE_BIN $BIN/vintask.js"

LOG="$LOGS/${AGENT_ID}.log"
log() { echo "[$(date -Iseconds)] [$AGENT_ID] $*" | tee -a "$LOG"; }

# ── ORACLE TOKEN EVENT (G7E4RF2 2026-10-20) ───────────────────────────────────
# Post ONE task_complete event to the token ledger carrying the model that
# ACTUALLY executed, not the planned top ladder rung. The old POST sat inline
# BEFORE the cross-vendor failover block and fired with the primary $ROUTE, so a
# task that fell through to a cheaper rung logged the WRONG model in
# token-events.jsonl. MEASURED: 97U4KB5 logged claude-opus-5-5 while it executed
# and recovered on claude-sonnet-4-5 (provider-spend.jsonl, cost_source
# anthropic-reported). Callers now invoke this from every terminal path with the
# FINAL $ROUTE and $FTOK, after failover has resolved the winning rung, so
# token-events model == the task's winning provider-spend row.
#   usage: oracle_log_tokens <model> <tokens>
# Self-guards on tokens>0 (preserving the old gate), fires at most once per path,
# backgrounded + time-capped + output discarded: recording usage must never delay
# or fail the task that produced it.
oracle_log_tokens() {
  _ol_model="$1"; _ol_tok="$2"
  [ "${_ol_tok:-0}" -gt 0 ] 2>/dev/null || return 0
  ( curl -s --max-time 3 -X POST "${TOKEN_API:-http://localhost:$(cat "$ROOT/state/gui-port" 2>/dev/null | tr -dc 0-9 || echo 8799)}/api/tokens/log-event" \
      -H 'Content-Type: application/json' \
      -d "{\"kind\":\"task_complete\",\"tokens_used\":${_ol_tok},\"model\":\"${_ol_model}\",\"task_id\":\"${TID}\",\"seat\":\"${AGENT_ID}\"}" \
      >/dev/null 2>&1 || true ) &
}

# ── CAPABILITY-TIER ARITHMETIC (SAWPNWX 2026-08-21) ────────────────────────────
# The router grades every model on L0..L4 ("how much brain"). A task's resolved
# plan tier is its FLOOR — the minimum brain the work needs. Failover deliberately
# walks below that floor (tier descent, then the local $0 last-resort rung) because
# a weak answer beats no answer. But when the chain BOTTOMS OUT below the floor and
# still fails, that is a nameable outcome — "capability exhausted" — not a mystery
# exit. tier_idx maps a tier to its rank so the failover loop can tell the two apart.
tier_idx() {
  case "$(printf '%s' "${1:-}" | tr '[:lower:]' '[:upper:]')" in
    L0) echo 0 ;; L1) echo 1 ;; L2) echo 2 ;; L3) echo 3 ;; L4) echo 4 ;;
    *)  echo -1 ;;   # unknown/legacy tier — never treated as below-floor
  esac
}
# below_floor <rung_tier> <floor_tier> → exit 0 when the rung is weaker than the floor
below_floor() {
  _r="$(tier_idx "${1:-}")"; _f="$(tier_idx "${2:-}")"
  [ "$_r" -ge 0 ] 2>/dev/null && [ "$_f" -ge 0 ] 2>/dev/null && [ "$_r" -lt "$_f" ] 2>/dev/null
}

# ── PER-SEAT SELF-LOCK — one driver per seat, structurally impossible to break ──
# (Vinta directive 2026-08-06, task CNR7FPA: two seat-3 drivers ran concurrently —
#  PIDs 2572481 @10:20 and 2972221 @17:04 — both claiming/working task FDQD59R,
#  producing 12 redundant "starting" updates, duplicate attempts, and one driver
#  committing+pushing work the other was still mid-verifying.)
#
# Every guard before this one lived in the LAUNCHER (council.sh / watchdog pgrep
# checks). Those are (a) racy — two launchers both pass the check during the
# seconds before send-keys becomes a real process — and (b) bypassable, since a
# driver started by hand or by any path that isn't council.sh is never checked at
# all. The only guard that cannot be raced or bypassed is one the driver takes on
# ITSELF, at startup, and holds for its entire life: if you are not holding your
# seat's lock, you are not that seat's driver, and you exit.
#
# fd 200 is opened on the seat lockfile and flock'd non-blocking. The kernel drops
# the lock automatically when this process dies (crash, kill -9, reboot, pane
# closed), so a stale lockfile can NEVER wedge a seat — there is no lock to reap,
# only an empty file. We still record our pid IN the file for human/watchdog
# diagnostics, and we report the live holder's pid when we lose the race.
SEAT_LOCK="$LOCKS/${AGENT_ID}.lock"
# ── SEAT LOCK ACQUISITION (Vinta directive 2026-08-14, task THPMQ9X) ────────────
# Open fd 200 on the seat's lock file and acquire an exclusive, non-blocking flock.
# If another driver already holds the lock, exit immediately. The kernel drops the
# lock when this process dies, so a crashed driver never wedges the seat.
exec 200>>"$SEAT_LOCK" || { log "FATAL: cannot open seat lock $SEAT_LOCK"; exit 1; }
if ! flock -n 200; then
  HOLDER="$(cat "$SEAT_LOCK" 2>/dev/null | tr -d '[:space:]')"
  log "duplicate driver refused — $AGENT_ID already has a live driver${HOLDER:+ (pid $HOLDER)}; exiting."
  exit 0
fi
# We own the seat. Stamp our pid so `council status`/watchdog/a human can see who
# holds it. (Diagnostic only — the flock, not this text, is the actual mutex.)
printf '%s\n' "$$" > "$SEAT_LOCK"
# ── FD 200 INHERITANCE PROTECTION (Vinta directive 2026-08-14 THPMQ9X; fixed 2026-09-15 KGT64E5) ──
# The concern: `exec bash "$0"` at the hot-reload point, and any child spawned by
# the driver (claude, git, agent tools), must NOT inherit fd 200 while it still
# holds the seat's flock — otherwise the child ends up "co-owning" the lock and
# nested/duplicate drivers can end up on one seat (observed 2026-09-14: seat-1
# 144781+146211 nested, seat-10 4844+140662, seat-6 4719+14442).
#
# The obvious fix was FD_CLOEXEC on fd 200, but bash has no builtin to set it,
# and the previous `python3 -c "fcntl.fcntl(200, F_SETFD, FD_CLOEXEC)"` was a
# no-op: F_SETFD is per-fd-per-process, so a subprocess sets the flag on ITS
# copy of fd 200 and then dies — the parent shell's fd table is untouched. The
# verify call in a fresh subprocess then always reported CLOEXEC unset, and
# every seat refused to start with "FD_CLOEXEC verification failed" (2026-09-15).
#
# Real protection is done EXPLICITLY at each leakage point instead:
#   • hot-reload (line 362-365): `( exec 200>&-; bash -n ... )` in subshell that
#     closes fd 200, THEN `flock -u 200; exec 200>&-` before `exec bash "$0"`.
#     The bug was that `bash -n "$0"` ran BEFORE closing fd 200, allowing that
#     syntax-check subprocess to inherit the flock and become a nested driver.
#   • agent spawns (line 894/900): `( exec 200>&-; ... )` subshell closes it.
# So no CLOEXEC dance is needed here — the fd is closed by name wherever it
# would otherwise leak. Leaving this comment as a landmine sign for future edits.
# Release + blank the stamp on any exit path so the file never lies about a dead pid.
#
# ── THE DEPARTURE STAMP (Vinta directive 2026-08-17, task K37KBKB) ────────────
# Blanking the lock was never enough. seats.json ALSO claims this seat is running,
# and until now NOTHING cleared that on the way out: the mode:"stop" branch below
# is the only clean retirement, so a driver killed by the STOP flag, an OOM, a
# reboot or any crash left mode:"run" behind FOREVER. That registration outlives
# the process it described, and a seat declared running with nobody behind it
# silently absorbs the council's apparent capacity — the board shows 8 seats of
# throughput while 3 do the work. Measured on the live council 2026-08-17: 5 of 8
# seats phantom, the oldest cold for 3.2 days, reported by nothing.
#
# So every exit path now stamps the truth: mode:"down" plus when and why. "down"
# is deliberately NOT "stop" — `stop` means Vinta parked this seat and it must
# stay parked, while `down` means the process died and the seat is free to be
# relaunched. Collapsing the two would let a crash silently retire a seat Vinta
# wanted running (or let a resurrection un-park one he deliberately stopped).
# Neither the phantom probe nor the scaler counts a `down` seat as running, so
# the registration can no longer lie about live capacity.
# LOCKED + ATOMIC (2026-08-26, task U44NJFD). This was the THIRD unlocked
# read-modify-write on seats.json and the most dangerous: a seat departing while
# another seat launches held a snapshot taken BEFORE that launch, so its
# writeFileSync erased the fresh registration — recreating the exact
# unregistered-driver state warden reports. Launch and departure now serialise
# against each other through the one mutex in bin/seat-register.js.
seat_departed() {
  "$NODE_BIN" "$BIN/seat-register.js" "$AGENT_ID" --depart "$1" --by seat-depart 2>/dev/null || true
}
# ── ORPHAN REAPER ON THE WAY OUT (Vinta directive 2026-08-21, task SBKWSRS) ────
# Vinta chose option (b) of SBKWSRS-collision-postmortem.md: "seat release should
# signal/kill in-flight subagents."
#
# The in-loop failstops (stall/killswitch/budget) can only fire while THIS script is
# still running its watcher. They do nothing for the case that actually caused the
# DirZombie collision: the driver itself is killed from outside — by the watchdog
# reaping a duplicate, by the STOP flag, by an OOM, by a closed tmux pane. In that
# case the driver vanishes instantly and its `claude` child (plus every subagent
# under it) is left running with no supervisor and no task lock, free to keep
# writing to the repo for as long as its `timeout` allows. seat-2's atlas-rp did
# exactly that for ~20 minutes on 2026-08-20 and clobbered four live files.
#
# So the agent tree is now reaped on EVERY exit path. This is defined at top level
# (the trap must be armed long before the per-iteration launch block defines its own
# helpers) and is a no-op when no agent is in flight, which is the common case.
#
# It signals the agent's PROCESS GROUP, so it reaches timeout -> claude -> every
# subagent in one shot. It refuses to signal its own group or pgid 0/1, so it can
# never take down the driver's siblings, the watchdog, or Vinta's shell.
#
# AGENT_PID MUST EXIST BEFORE THE TRAP CAN FIRE (task FRHRBGQ, 2026-10-02). This
# script runs under `set -u` and AGENT_PID was first assigned inside the launch
# block, ~850 lines down. A driver that exits before ever launching an agent — an
# idle seat retired by `fleet scale`, a duplicate refused, a STOP at boot — hit
# "AGENT_PID: unbound variable" on the first line of this function, and bash
# ABORTED THE WHOLE EXIT TRAP: the lock stamp was never blanked and seat_departed
# never ran. Observed: seat-8 retired cleanly at 02:50:56 and still left pid
# 3967151 in seat-8.lock for the watchdog to reap at 02:51:04.
AGENT_PID=""
reap_agent_tree_onexit() {
  [ -z "$AGENT_PID" ] && return 0
  kill -0 "$AGENT_PID" 2>/dev/null || return 0
  _xk="$(pgrep -P "$AGENT_PID" 2>/dev/null | head -1)"
  _xg=""
  [ -n "$_xk" ] && _xg="$(ps -o pgid= -p "$_xk" 2>/dev/null | tr -d ' ')"
  _xs="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"
  if [ -n "$_xg" ] && [ "$_xg" != "$_xs" ] && [ "$_xg" != "0" ] && [ "$_xg" != "1" ]; then
    kill -TERM -- "-$_xg" 2>/dev/null || true
    sleep 1
    kill -KILL -- "-$_xg" 2>/dev/null || true
  fi
  [ -n "$_xk" ] && { kill -KILL "$_xk" 2>/dev/null || true; pkill -KILL -P "$_xk" 2>/dev/null || true; }
  kill -KILL "$AGENT_PID" 2>/dev/null || true
  pkill -KILL -P "$AGENT_PID" 2>/dev/null || true
  log "reaped in-flight agent tree (pid $AGENT_PID${_xg:+, pgid $_xg}) on driver exit — no orphaned subagent survives the seat"
  return 0
}

# The reaper runs FIRST on the way out: kill the writers before releasing the lock,
# so the card can never be re-claimed by another seat while this seat's subagents
# are still touching the tree. That ordering IS the fix — releasing first is what
# created the DirZombie overlap window.
trap 'reap_agent_tree_onexit; printf "" > "$SEAT_LOCK" 2>/dev/null; seat_departed "driver-exit"; flock -u 200 2>/dev/null; exec 200>&- 2>/dev/null' EXIT
# A TERM/INT/HUP from the watchdog, `council stop`, or a closing pane must run the
# EXIT trap too — without these, bash dies on the signal and the trap never fires,
# which is precisely how the orphan survived.
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP

# ── per-seat worktree (parallel-safe) ─────────────────────────────────────────
# seat-1 uses the main checkout; every other seat gets its own worktree+branch so
# concurrent seats don't fight over the working tree.
WORKTREE="$REPO_DIR"
if [ "$AGENT_ID" != "seat-1" ] && git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  WT="$HOME/.council-worktrees/${PROJECT}-${AGENT_ID}"
  BR="council/${AGENT_ID}"
  if [ ! -d "$WT" ]; then
    log "creating worktree $WT on branch $BR"
    git -C "$REPO_DIR" worktree add -B "$BR" "$WT" HEAD >>"$LOG" 2>&1 \
      || { log "worktree add failed — falling back to main checkout"; WT="$REPO_DIR"; }
  fi
  WORKTREE="$WT"
fi

log "driver up — project=$PROJECT repo=$REPO_DIR worktree=$WORKTREE max=$MAX_ITERS"
log "Opus-5 headless via $CLAUDE_BIN"

# ── PER-TASK PROJECT ROUTING (task NRK2JXE, 2026-10-28) ──────────────────────
# A seat claims from the shared pool regardless of project (vintask.js:1675), but
# the driver historically worked in the SEAT's FIXED repo. Every seat is pinned to
# Vintinuum (/home/vinta/vintinuum), so a "DirHaven APP" task claimed by any seat
# ran in the Vintinuum checkout — the wrong repo entirely. Vinta: "WHEN I CHOOSE
# DIRHAVEN APP ... IT KEEPS TELLING ME ITS NOT THE RIGHT BRANCH WORKTREE". Fix:
# after each claim, resolve the repo from the CLAIMED TASK's project and work
# there. DECISION: unknown/ambiguous projects fall back to the seat's own repo
# (today's behaviour — never worse); only VERIFIED repos are mapped, no guessing.
# REVERSIBLE VIA: restore bin/council-driver.sh.bak-route-* / git revert.
SEAT_REPO="$REPO_DIR"
SEAT_WORKTREE="$WORKTREE"
repo_for_project() {
  # Echo the repo dir for a known project name (case/space/punct-insensitive),
  # else nothing. Every path here was verified to be a live git repo on 2026-10-28.
  local p; p="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
  case "$p" in
    vintinuum)                        echo /home/vinta/vintinuum ;;
    vintinuumapi)                     echo /home/vinta/vintinuum-api ;;
    dirhaven|dirhavenapp)             echo /home/vinta/dirhaven ;;
    dirmegle)                         echo /home/vinta/dirmegle ;;
    dircomedia)                       echo /home/vinta/dircomedia ;;
    direbay)                          echo /home/vinta/direbay ;;
    lios|lexdominus)                  echo /home/vinta/lios ;;
    *)                                echo "" ;;
  esac
}
ensure_task_worktree() {
  # $1 = repo dir. Echo the worktree THIS seat should use in that repo. seat-1 uses
  # the main checkout; every other seat gets its own parallel-safe worktree+branch,
  # mirroring the startup logic above so cross-project routing stays collision-safe.
  local repo="$1"
  if [ "$AGENT_ID" = "seat-1" ]; then echo "$repo"; return; fi
  local wt="$HOME/.council-worktrees/$(basename "$repo")-${AGENT_ID}"
  local br="council/${AGENT_ID}"
  if [ ! -d "$wt" ]; then
    git -C "$repo" worktree add -B "$br" "$wt" HEAD >>"$LOG" 2>&1 \
      || { echo "$repo"; return; }
  fi
  echo "$wt"
}

idle_streak=0
# INDEFINITE loop (Vinta directive 2026-08-01). The seat runs forever, claiming
# tasks the moment they arrive. MAX_ITERS is retained only as an informational
# label in the "driver up" line; it no longer terminates the seat. The ONLY exits
# are: the STOP flag (graceful `council stop`) or the killswitch/budget failstop
# on a runaway task. i is kept purely for log/iteration numbering.
i=0
# ── SEAT MODE (Vinta directive 2026-08-10, task A3RTJAQ: "ability to stop start
# just only queue etc for any") ──────────────────────────────────────────────
# The seat's mode lives in state/seats.json and is re-read EVERY iteration, so
# `fleet queue` / `fleet stop` take effect on the next claim without killing a
# working process. A task already in flight ALWAYS finishes — mode changes are
# honored at the claim boundary, never mid-task. Per-seat mode wins over the
# fleet-wide mode, so one seat can be parked while the rest keep running.
#   run   -> claim + execute (normal)
#   queue -> claim NOTHING; stay alive and idle. Work accumulates for later.
#   stop  -> exit cleanly (seat goes dark; queue untouched)
seat_mode() {
  $NODE_BIN -e '
    const fs=require("fs");
    const F=process.env.HOME+"/.claude/council-loop/state/seats.json";
    const seat=process.argv[1];
    let s=null; try{ s=JSON.parse(fs.readFileSync(F,"utf8")); }catch{}
    // No/!invalid state file => "run" (fail-open: a missing control file must never
    // silently park the whole fleet).
    const per=(s&&s.seats&&s.seats[seat]&&s.seats[seat].mode)||null;
    process.stdout.write(per||(s&&s.mode)||"run");
  ' "$AGENT_ID" 2>/dev/null || echo run
}
# STALE STOP-FLAG CLEAR ON LAUNCH (2026-08-14). A seat retired via `fleet down`
# (or by a one-off stop) had mode:"stop" written into state/seats.json — and
# NOTHING ever cleared it. So every later launch of that seat read the stale flag
# and immediately "retired cleanly" before claiming any work. Observed repeatedly:
# the board sat at 0 live seats with a full queue while launches "succeeded",
# because 4 of 8 seats were permanently dead by config. Being launched IS the
# instruction to run — an explicit stop is honored while running (the loop below
# re-reads mode every pass and still exits on a mid-flight stop), but it must not
# outlive the process it was aimed at.
#
# STALE REAP STAMP CLEAR ON LAUNCH (2026-08-19, task TPYBGGM). The block above
# cleared retired_at/down_at/down_reason but NEVER reaped_at/reaped_reason, so a
# seat the reaper had demoted came back to life still carrying "reaped: no live
# driver process" in state/seats.json. That is a seat record which simultaneously
# claims mode:"run" and asserts nobody is behind it — the exact contradiction this
# card was filed about, and it was true of ALL FOUR running seats when TPYBGGM was
# opened. Two concrete harms, not cosmetics:
#   1. Forensics invert. `reaped_at` is read as "this seat is dead"; left on a live
#      seat it makes every future phantom report unreadable, because the one stamp
#      that should distinguish a corpse from a worker is present on both.
#   2. The reaper shields real phantoms. fleet.sh anchors its grace window on
#      max(relaunched_at, launched_at, reaped_at) — so a stale reaped_at can keep a
#      genuinely dead seat inside the grace window and prevent its reap.
# Clearing is unconditional (not gated on mode==="stop") because a revived seat can
# reach this line by any path, and being launched IS the proof it is not reaped.
# The reap remains fully auditable while it matters: the stamp lives on the seat
# until that seat actually runs again, and every reap is logged by fleet.sh.
#
# SELF-REGISTER ON FIRST-EVER LAUNCH (2026-08-21, task Z59MBXP). The block below
# used to write seats.json ONLY when `dirty` — i.e. only when it had a stale
# stop/reap stamp to CLEAR. A seat launching for the very first time has no stamps
# to clear, so `dirty` stayed false and the write was skipped entirely: the driver
# ran forever as a seat the registry had never heard of.
#
# That is not theoretical. seats.json said desired:12/max_seats:12 while listing
# only seat-1..seat-10, with live drivers running as seat-11 (pid 2911694) and
# seat-12 (pid 2911742) — warden probe `unregistered-driver`, the exact mirror of
# phantom-seat. Why it went unnoticed: the two launch paths disagree.
#   • bin/fleet.sh launch_seat() DOES register (launched_at/project/repo) before
#     sending the tmux keys — so every seat fleet.sh ever started exists.
#   • bin/council.sh start() does NOT touch seats.json at all; it only sends the
#     tmux keys and trusts the driver to register itself. The driver didn't.
# So seats 1-10 exist purely because fleet.sh happened to launch them once, and
# any seat born via `council start` is invisible forever.
#
# Two concrete harms, not cosmetics:
#   1. Unmanageable. fleet.sh iterates s.seats for scale/shed/stop/reap, so an
#      unregistered seat can never be retired, shed or reaped by the council — it
#      can only be killed by hand.
#   2. The scaler double-counts. `fleet sync` compares live-vs-desired; an
#      unregistered live seat still holds a lock and burns budget while the
#      registry under-reports the fleet, so a sync can launch seats on top of it.
#
# The principle is the same one the reap-stamp clear already encodes: BEING
# LAUNCHED IS THE PROOF THE SEAT EXISTS. Registration is therefore unconditional
# on first launch, not contingent on having a corpse stamp to clean up. Mode is
# inherited from the fleet mode (matching launch_seat) so a seat born while the
# fleet is queue-only does not silently promote itself to run.
# LOCKED + ATOMIC (2026-08-26, task U44NJFD). This block used to be an inline
# read -> mutate -> writeFileSync with no lock, and so did council.sh start().
# `council start` fires all twelve launches in a loop, so those unlocked
# read-modify-write cycles raced and the loser's registration was stomped off the
# file — a live seat, holding a lock and burning budget, absent from the registry
# (warden probe `unregistered-driver`, second occurrence). The logic now lives in
# bin/seat-register.js: one implementation, lockfile + tmp+rename, snapshot taken
# INSIDE the lock so concurrent registrations merge instead of overwriting.
# It always exits 0 — a seat must still run if bookkeeping fails.
$NODE_BIN "$BIN/seat-register.js" "$AGENT_ID" "$PROJECT" "$REPO_DIR" --by driver-launch 2>/dev/null || true

# Fingerprint of the driver AS LOADED. Compared each iteration against what is on
# disk, so a shipped fix reaches seats that are already running (task RRQJ5RU).
DRIVER_SIG="$(cksum "$0" 2>/dev/null | awk '{print $1"-"$2}')"

mode_note=""
while true; do
  i=$((i+1))
  [ -f "$STOP" ] && { log "STOP flag present — driver halting."; break; }

  # ── HOT-RELOAD THE DRIVER WHEN IT CHANGES ON DISK (task RRQJ5RU, 2026-08-19) ──
  # THE THIRD DEFECT behind Vinta's "why do you stop?" — and the one that made the
  # first two look unfixed.
  #
  # RRQJ5RU shipped a real fix at 17:38 (lib/outage-signal.js + the driver call
  # site). At 17:43 seat-3 false-stopped ANYWAY, on this very task, with the exact
  # symptom the fix removed. The fix was not wrong. It was never loaded.
  #
  # bash does not read a script into memory. It reads it INCREMENTALLY, by byte
  # offset, as execution advances. A driver that started at 16:54 keeps executing
  # the bytes that were on disk then, for its entire multi-day life. Every seat
  # running at the moment of a fix therefore keeps the bug — and because the seats
  # are long-lived by design, that is nearly always ALL of them. Proven forensically:
  # the 17:43 log line printed "OUTAGE detected — marking", a paren-less format that
  # exists ONLY in commits BEFORE edd6db3; the post-fix line carries "(reason)".
  # Replaying that same stall evidence through the shipped classifier returns
  # NO_OUTAGE. Old code, still running.
  #
  # This is the general failure, not a one-off: EVERY driver fix the council has
  # ever shipped — the failover classifier, the seat-lock guard, the departure
  # stamp — only reached seats started afterwards. Vinta kept seeing fixed bugs
  # because the running fleet was frozen at whatever revision it booted on.
  #
  # THE FIX: checkpoint the driver's fingerprint at startup, and at the TOP OF EACH
  # ITERATION compare it to what is on disk now. If it changed, re-exec ourselves so
  # the next task runs the new code. Safety properties that make this non-negotiable:
  #   - BETWEEN TASKS ONLY. This runs before a task is claimed, so no in-flight
  #     agent is ever killed and no claimed card is ever orphaned by a reload.
  #   - LOCK IS HANDED OVER CLEANLY. exec() replaces this process, so the EXIT trap
  #     does NOT fire (no false "down" stamp, no blanked lock). We explicitly release
  #     the flock and blank the stamp first, so the re-exec'd self re-acquires it as
  #     a normal startup instead of refusing itself as a duplicate.
  #   - SYNTAX-GATED. A driver mid-edit on disk can be truncated or invalid. We
  #     `bash -n` the new file first and skip the reload if it does not parse, so a
  #     half-written script can never take down the fleet.
  #   - SELF-LIMITING. Reload only fires when the fingerprint actually differs, so a
  #     stable fleet reloads exactly zero times and this costs one `cksum` per task.
  DRIVER_SIG_NOW="$(cksum "$0" 2>/dev/null | awk '{print $1"-"$2}')"
  if [ -n "${DRIVER_SIG:-}" ] && [ -n "$DRIVER_SIG_NOW" ] && [ "$DRIVER_SIG_NOW" != "$DRIVER_SIG" ]; then
    # Close fd 200 BEFORE syntax-checking the new driver, so `bash -n` doesn't inherit the flock
    ( exec 200>&-; bash -n "$0" >/dev/null 2>&1 ) && _syntax_ok=1 || _syntax_ok=0
    if [ "$_syntax_ok" = "1" ]; then
      log "driver changed on disk (${DRIVER_SIG} → ${DRIVER_SIG_NOW}) — hot-reloading between tasks so the fix actually takes effect"
      printf "" > "$SEAT_LOCK" 2>/dev/null || true
      flock -u 200 2>/dev/null || true
      exec 200>&- 2>/dev/null || true
      exec bash "$0" "$AGENT_ID" "$PROJECT" "$REPO_DIR" "$MAX_ITERS"
    else
      log "driver changed on disk but does NOT parse (bash -n failed) — staying on the loaded copy until it is valid"
      DRIVER_SIG="$DRIVER_SIG_NOW"
    fi
  fi

  # ── RE-STAMP THE SEAT LOCK (Vinta directive 2026-08-18, task KKBABCD) ────────
  # The pid stamp is diagnostic, not the mutex — but it is the ONLY way a human,
  # `council status` or a watchdog can name who holds a seat, and until now nothing
  # ever rewrote it after startup. That made the stamp a write-once fact about a
  # process that lives for days, so anything which blanked the file left the seat
  # anonymous for the rest of its life. Warden's own autofix did exactly that to
  # seats 1-3 on 2026-08-18 (it blanked live seats; guard fixed on its side too),
  # and the seats had no way to say "still me" afterwards.
  #
  # We hold the flock, so whatever the file says, this seat is OURS — an empty stamp
  # is simply missing and a stamp naming any other pid is simply WRONG. Both are
  # unambiguously ours to correct.
  #
  # CORPSE-STAMP SELF-HEAL (Vinta directive 2026-09-20, task XA5MMB9). Until now
  # this healed only the EMPTY case, so a stamp naming a DEAD pid survived every
  # iteration of a perfectly healthy driver, forever. That is exactly how seat-12
  # kept advertising pid 221004 (dead) long after its log said "driver done after
  # loop": a SIGKILL / OOM kill / host reset runs no EXIT trap, so the corpse pid
  # was left behind, and nothing downstream ever overwrote it. The kernel had long
  # since released the flock, so nothing was wedged — but `council status`, the
  # watchdog and every human read a lie, and warden had to file a card to say so.
  #
  # Comparing against our own pid (rather than only testing for empty) closes that
  # hole: a wrong stamp now self-heals within one iteration instead of needing a
  # monitor, a card and a human. We still write ONLY when the value actually
  # differs, which preserves the no-churn property this block was built for — no
  # mtime noise for warden to misread in the overwhelmingly common case where the
  # stamp is already correct.
  CUR_STAMP="$(cat "$SEAT_LOCK" 2>/dev/null | tr -d '[:space:]')"
  if [ "$CUR_STAMP" != "$$" ]; then
    printf '%s\n' "$$" > "$SEAT_LOCK" 2>/dev/null || true
    [ -n "$CUR_STAMP" ] && log "seat lock stamped a foreign pid ($CUR_STAMP, not alive or not us) while we hold the flock — corrected to $$"
  fi

  MODE="$(seat_mode)"; [ -z "$MODE" ] && MODE="run"
  if [ "$MODE" = "stop" ]; then
    log "seat mode=stop — retiring this seat cleanly (queue untouched)."
    break
  fi
  if [ "$MODE" = "queue" ]; then
    # QUEUE-ONLY: alive but claiming nothing. Zero tokens burned while parked.
    # Log the transition once, then stay quiet so a parked seat can't spam the log.
    [ "$mode_note" != "queue" ] && { log "seat mode=queue-only — accepting no work; tasks accumulate until 'fleet start'."; mode_note="queue"; }
    sleep 10
    continue
  fi
  [ "$mode_note" = "queue" ] && { log "seat mode=run — resuming claims."; mode_note="run"; }

  # ── RUNTIME DAILY-CEILING GATE (Vinta directive 2026-08-25, task YT4TH3V) ────
  # frugal-guard.sh is THE GATE — but it is a LAUNCH-time gate only: council.sh
  # calls it once, before seats exist, and nothing ever re-checks the daily ceiling
  # again for the entire multi-day life of a driver. Combined with the budget
  # failstop being advisory-only (see ~line 958: a per-task overage logs a warning
  # and CONTINUES), the council had no runtime brake at all. Measured 2026-08-25:
  # the daily total hit 11,464,867 tokens against a 15M ceiling, and TWO cards
  # (HB6H3YW 4.43M, FGJ3XMZ 3.89M) accounted for 8.3M of it — 73% of the day's burn
  # from 2 of 11 tasks. Both sailed past their own 5M/4M budgets without being
  # stopped, because "advisory" means nothing stops them. That is the exhaustion
  # Vinta named: not too many seats, but no ceiling that binds once work is moving.
  #
  # This gate re-asks the launch question at every claim: seats stay ALIVE (so the
  # instant tomorrow's window opens, or Vinta raises the ceiling, work resumes with
  # no relaunch) but claim NOTHING while the day's ceiling is breached. It is
  # deliberately placed BEFORE the claim, never during a run: a task already
  # in-flight is never killed mid-work (that was the 9A85T9G mistake — an arbitrary
  # cap killing real work 8% over). We stop STARTING new burn, we never abort
  # committed burn. Zero tokens are spent while held.
  #
  # COUNCIL_IGNORE_DAILY_CEILING=1 disables this for a seat (escape hatch, same
  # spirit as COUNCIL_BUDGET_HARD). Reversible: revert this hunk, or set that var.
  if [ "${COUNCIL_IGNORE_DAILY_CEILING:-0}" != "1" ]; then
    CEIL_STATE="$($NODE_BIN "$BIN/capacity.js" --json 2>/dev/null | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const c=JSON.parse(d);const t=c.gauges&&c.gauges.tokens||{};const u=c.gauges&&c.gauges.budget||{};const overTok=(Number(t.used)||0)>=(Number(t.limit)||Infinity);const overUsd=(Number(u.used)||0)>=(Number(u.limit)||Infinity);console.log((overTok||overUsd?"over":"ok")+" "+Math.round(t.used||0)+" "+Math.round(t.limit||0)+" "+(u.used||0)+" "+(u.limit||0));}catch(e){console.log("ok 0 0 0 0")}})' 2>/dev/null)"
    # Parse without `set --`: clobbering the positional params would be a global
    # side effect on a long-lived script, and read keeps the fields seat-local.
    CEIL_VERDICT=ok; CEIL_TOK=0; CEIL_TOKLIM=0; CEIL_USD=0; CEIL_USDLIM=0
    read -r CEIL_VERDICT CEIL_TOK CEIL_TOKLIM CEIL_USD CEIL_USDLIM <<EOF_CEIL
$CEIL_STATE
EOF_CEIL
    CEIL_VERDICT="${CEIL_VERDICT:-ok}"
    if [ "$CEIL_VERDICT" = "over" ]; then
      if [ "${ceil_note:-}" != "over" ]; then
        log "DAILY CEILING REACHED — holding claims (tokens ${CEIL_TOK}/${CEIL_TOKLIM}, \$${CEIL_USD}/\$${CEIL_USDLIM}). Seat stays alive; in-flight work untouched; claims resume when the day rolls or the ceiling is raised in state/frugal.conf."
        ceil_note="over"
      fi
      sleep 60
      continue
    fi
    [ "${ceil_note:-}" = "over" ] && { log "daily ceiling cleared — resuming claims."; ceil_note=""; }
  fi

  # ── DISK-PRESSURE CLAIM GATE (task E9AR7FX, 2026-10-20) ──────────────────────
  # Measured 2026-10-20 ~10:02: 14+ council-driver.sh/claude processes across
  # seats 1-7 plus puppeteer/ollama/verifier child work drove /proc/pressure/io
  # ("full avg10") to ~48-99% on this box's shared /dev/sdd, externally SIGTERM'ing
  # DirHaven's paced DB backup 3x in ~10 minutes (backup.log 09:51:46/09:53/09:59)
  # and risking the exact "backend wedges under disk contention" failure 2NQ9VNT /
  # T52ZJ8X / WUE46FG were filed to fix — from the council's own side this time.
  #
  # fleet-autoscale.sh already sheds a seat when io is the worst gauge, but it
  # ticks every 3 min via cron AND sheds gracefully (an in-flight task is never
  # killed mid-work, by design — FRHRBGQ), so live concurrency barely drops
  # during an active spike. This gate is the fast brake: checked on EVERY claim
  # attempt (far more often than the 3-min cron — this loop re-polls every ~15s
  # even on an empty queue), it holds NEW claims the instant the shared disk is
  # saturated, without touching any task already running. Same shape as the
  # RUNTIME DAILY-CEILING GATE above: stop STARTING new load, never abort
  # committed work.
  #
  # Read /proc/pressure/io directly rather than spawning capacity.js — this gate
  # runs on every idle poll too, and a raw /proc read is ~free where capacity.js's
  # full snapshot (tasks.jsonl + seats.json + frugal.conf + spend ledger) is not.
  # Ceiling matches capacity.js's own io wall (35% full avg10 — see capacity.js:
  # "past it, fsyncs and port binds start failing"), so this gate and the
  # autoscaler's shed trigger at the same threshold: one layer reacts in seconds,
  # the other reduces seat count over the following minutes.
  #
  # ionice is a NO-OP on this box's [none]-scheduler disks (J54EDMX, 6WCR9PY) —
  # not starting more concurrent disk-heavy work is the only lever that actually
  # throttles here, which is exactly what this gate does.
  #
  # COUNCIL_IGNORE_IO_CEILING=1 disables this for a seat (escape hatch, same
  # spirit as COUNCIL_IGNORE_DAILY_CEILING). Reversible: revert this hunk, or set
  # that var. COUNCIL_IO_CEILING_PCT overrides the threshold (default 35).
  if [ "${COUNCIL_IGNORE_IO_CEILING:-0}" != "1" ]; then
    IO_CEIL="${COUNCIL_IO_CEILING_PCT:-35}"
    IO_PRESSURE_FILE="${COUNCIL_IO_PRESSURE_FILE:-/proc/pressure/io}"
    IO_FULL="$(awk -F'avg10=' '/^full/{split($2,a," ");print a[1]+0; exit}' "$IO_PRESSURE_FILE" 2>/dev/null)"
    IO_FULL="${IO_FULL:-0}"
    IO_OVER="$(awk -v u="$IO_FULL" -v l="$IO_CEIL" 'BEGIN{print (u>=l)?1:0}' 2>/dev/null)"
    if [ "${IO_OVER:-0}" = "1" ]; then
      if [ "${io_note:-}" != "over" ]; then
        log "DISK PRESSURE CRITICAL — holding claims (io full-stall ${IO_FULL}%/${IO_CEIL}%). Seat stays alive; in-flight work untouched; claims resume the instant the disk clears. ionice is a no-op here (J54EDMX) — this hold is the actual brake."
        io_note="over"
      fi
      sleep 30
      continue
    fi
    [ "${io_note:-}" = "over" ] && { log "disk pressure cleared (io full-stall ${IO_FULL}%/${IO_CEIL}%) — resuming claims."; io_note=""; }
  fi

  # atomically claim the best task for this seat
  # `next --agent <seat>` ALREADY claims from the shared pool: a seat takes any task
  # pinned to it, ELSE any open unpinned task regardless of assignee (vintask.js:1675).
  # So the old second attempt — `next --agent claude` — bought nothing: it could only
  # ever match cards hard-pinned to a seat literally named `claude`, and none exist.
  # What it DID do was stamp `claimed_by: 'claude'` onto real work, minting the retired
  # agent (sacrificed 2026-08-14, SEHP2A4) as a live owner on every idle seat. That is
  # how HCK8ECA got claimed and run to done while looking like `update --detail` had
  # claimed it. Removed with the guard in claimantOf() as a belt-and-braces backstop
  # (task A97D2N3, 2026-09-16).
  TASK_JSON="$($VINTASK next --agent "$AGENT_ID" 2>/dev/null)"

  if [ -z "$TASK_JSON" ]; then
    idle_streak=$((idle_streak+1))
    # empty queue: idle-wait (cheap) and re-check — FOREVER. Per Vinta directive
    # 2026-08-01 ("should automatically start on all tasks indefinitely when they
    # arrive"), a seat NEVER sleeps out on an empty queue. It idles cheaply (no
    # tokens burned while waiting) and claims the instant a task lands. A one-line
    # heartbeat every ~10min proves it's alive without spamming the log.
    if [ $((idle_streak % 40)) -eq 0 ]; then log "queue empty — idling, alive, waiting for tasks (streak=$idle_streak)"; fi
    sleep 15
    continue
  fi
  idle_streak=0

  TID="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).id)}catch{console.log("")}})')"
  TITLE="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).title)}catch{console.log("")}})')"
  log "iter $i — claimed [$TID] $TITLE"

  # ── route to the CLAIMED TASK's project repo (task NRK2JXE, 2026-10-28) ──────
  # Reset to the seat's own repo first, then reroute if the task names a different
  # verified project repo. Resetting every iteration guarantees no leakage from a
  # prior task's reroute into the next claim.
  REPO_DIR="$SEAT_REPO"; WORKTREE="$SEAT_WORKTREE"
  TASK_PROJECT="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).project||"")}catch{console.log("")}})')"
  _troute="$(repo_for_project "$TASK_PROJECT")"
  if [ -n "$_troute" ] && [ "$_troute" != "$SEAT_REPO" ] && git -C "$_troute" rev-parse --git-dir >/dev/null 2>&1; then
    REPO_DIR="$_troute"
    WORKTREE="$(ensure_task_worktree "$_troute")"
    log "iter $i — ROUTED [$TID] project='$TASK_PROJECT' -> repo=$REPO_DIR worktree=$WORKTREE (seat repo was $SEAT_REPO)"
  fi

  # ── INTAKE AIRLOCK (PR-A, FDJQ4EC 2026-09-26) ───────────────────────────────
  # Before ANY compute is allocated (even L1), the card must define its contract:
  # where (file paths / surface), what's wrong (error log / repro, for defects), and
  # what done looks like (acceptance). "Fix this issue." with nothing else stops HERE
  # as a needs-info card — the $11-on-a-vague-card failure is caught at the boundary
  # instead of inside the ladder. Deterministic rules first; askJev only for the
  # borderline band. DEGRADE-NEVER-DIE: a missing/crashing airlock returns "pass".
  # Kill switch: COUNCIL_INTAKE=0.
  if [ -f "$BIN/intake.js" ] && [ "${COUNCIL_INTAKE:-1}" != "0" ]; then
    printf '%s' "$TASK_JSON" > "$LOGS/task-${TID}.card.json"
    INTAKE_JSON="$(timeout 20 "$NODE_BIN" "$BIN/intake.js" check --taskfile "$LOGS/task-${TID}.card.json" --json 2>/dev/null | tail -1)"
    INTAKE_V="$(printf '%s' "$INTAKE_JSON" | "$NODE_BIN" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).verdict||"pass")}catch{console.log("pass")}})' 2>/dev/null)"
    if [ "$INTAKE_V" = "needs_info" ]; then
      INTAKE_Q="$(printf '%s' "$INTAKE_JSON" | "$NODE_BIN" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log(j.question||("NEEDS-INFO (intake airlock): missing "+(j.missing||[]).join(", ")))}catch{console.log("NEEDS-INFO (intake airlock): card does not define its contract")}})' 2>/dev/null)"
      $VINTASK need "$TID" "$INTAKE_Q" >/dev/null 2>&1
      log "iter $i — ⛔ INTAKE AIRLOCK held [$TID] at the boundary — needs-info, ZERO compute allocated"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ INTAKE AIRLOCK — card does not define what done looks like; kicked back as needs-info before any model ran. ${INTAKE_JSON}" >> "$LOGS/task-${TID}.log"
      sleep 1
      continue
    fi
  fi

  # ── STRUCTURAL RETRY GATE (PR-D, FDJQ4EC 2026-09-26) ────────────────────────
  # A re-claimed card is a RETRY. Before it can spend an Opus-class model again,
  # the deterministic verifier must agree the prior attempts were not structural
  # regressions (syntax-broken edits, reverting prior work, circular diffs, the same
  # test failing the same way twice). Two regressions break the loop here — the
  # CORRECTNESS backstop fires before the financial one (budget circuit) ever has to.
  if [ -f "$BIN/verify-diff.js" ] && [ "${COUNCIL_VERIFY_DIFF:-1}" != "0" ]; then
    GATE_LINE="$(timeout 20 "$NODE_BIN" "$BIN/verify-diff.js" gate --task "$TID" 2>/dev/null)"; GATE_RC=$?
    if [ "$GATE_RC" -eq 3 ]; then
      GATE_WHY="$(printf '%s' "$GATE_LINE" | cut -f3- | head -c 300)"
      $VINTASK block "$TID" "STRUCTURAL REGRESSION ×$(printf '%s' "$GATE_LINE" | cut -f2) — retry refused before spending another model: ${GATE_WHY}. Inspect state/diffs/${TID}.jsonl; after fixing the approach reset with: node $BIN/verify-diff.js reset --task $TID" >/dev/null 2>&1
      log "iter $i — ⛔ STRUCTURAL GATE broke the retry loop [$TID]: ${GATE_WHY:0:120}"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ STRUCTURAL GATE — ${GATE_LINE}" >> "$LOGS/task-${TID}.log"
      sleep 1
      continue
    fi
  fi

  # ── CAPABILITY TASK GATE (task 826C38V, Vinta 2026-09-25) ────────────────────
  # Vinta's if-then rules from ⚙ Settings → Capabilities that target TASKS run
  # here, before routing: block / require-approval stop the card with the rule's
  # own reason; use_model / route_agent / an agent's model pin rewrite the card
  # the router is about to read. An explicit model on the card always wins. The
  # gate is advisory-safe: missing engine or unreadable output = run as before.
  export AGENT_ID VINTASK_ID="$TID" COUNCIL_PROJECT="$PROJECT"
  if [ -f "$ROOT/lib/capabilities.js" ]; then
    CAP_CARD="$LOGS/task-${TID}.capgate.json"
    printf '%s' "$TASK_JSON" > "$CAP_CARD"
    CAP_JSON="$(timeout 20 "$NODE_BIN" "$ROOT/lib/capabilities.js" task-gate --taskfile "$CAP_CARD" --write 2>/dev/null | tail -1)"
    CAP_VERDICT="$(printf '%s' "$CAP_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log(j.verdict+"\t"+(j.applied||[]).join("; ")+"\t"+(j.reason||""))}catch{console.log("run\t\t")}})' 2>/dev/null)"
    CAP_V="$(printf '%s' "$CAP_VERDICT" | cut -f1)"; CAP_APPLIED="$(printf '%s' "$CAP_VERDICT" | cut -f2)"; CAP_WHY="$(printf '%s' "$CAP_VERDICT" | cut -f3-)"
    if [ "$CAP_V" = "block" ]; then
      $VINTASK block "$TID" "CAPABILITY RULE — ${CAP_WHY:0:400}" >/dev/null 2>&1
      log "iter $i — ✋ CAPABILITY GATE held [$TID]: ${CAP_WHY:0:160}"
      echo "[$(date -Iseconds)] [$AGENT_ID] ✋ CAPABILITY GATE — ${CAP_WHY}" >> "$LOGS/task-${TID}.log"
      sleep 1
      continue
    elif [ -n "$CAP_APPLIED" ]; then
      TASK_JSON="$(cat "$CAP_CARD")"
      log "iter $i — capability routing [$TID]: $CAP_APPLIED"
      echo "[$(date -Iseconds)] [$AGENT_ID] 🧭 capability routing — ${CAP_APPLIED}" >> "$LOGS/task-${TID}.log"
    fi
  fi

  # ── RATE-LIMIT FORECAST (task 4QBY759, Vinta 2026-08-13) ────────────────────
  # Vinta lost 9:12am→1pm to an unforeseen lockout. The seat now asks the oracle
  # what this task is likely to cost against Anthropic's rolling window BEFORE it
  # burns a token, and records the answer on the card.
  #
  # ADVISORY ONLY — BY DIRECT ORDER: "Never BLOCK tasks — only WARN and
  # RECOMMEND." This never skips, defers, or refuses a claim. It writes one
  # progress line so that when a lockout DOES land, Vinta can look at the card
  # and see it was called in advance. Wrapped in `|| true` with a hard timeout so
  # a broken or slow oracle can never wedge a seat: the forecast is a courtesy,
  # never a dependency in the execution path.
  FORECAST="$(timeout 10 $NODE_BIN -e '
    try{
      const T=require(process.argv[1]+"/token-limits.js");
      const t=JSON.parse(process.argv[2]);
      const r=T.filterTasks({tasks:[t]});
      const c=(r.safe_tasks[0]||r.risky_tasks[0]||r.blocked_tasks[0]);
      const p=r.prediction;
      // LOW-CONFIDENCE SUPPRESSION (2026-08-14). This banner was screaming
      // "WILL TIMEOUT · 248%" on every task while the AUTHORITATIVE rate API
      // said allowed at 17% of the 5h window. Cause: the ceiling it measures
      // against is a GUESSED conservative prior (limit_is_prior=true,
      // confidence 0.26, learned from ONE event whose spend-at-trip was never
      // recorded) — and token-limits own prediction said level=green,
      // will_hit_limit=false at the same moment. A low-confidence guess that
      // reads like an outage trains everyone to ignore the warning, which is
      // worse than no warning. When the limit is a prior or confidence is
      // weak, downgrade the verdict to an explicitly-labelled estimate and
      // never print the alarming WILL TIMEOUT wording.
      const a=(T.analyzeLimits?T.analyzeLimits():{})||{};  // filterTasks does NOT expose analysis
      const weak=(a.limit_is_prior===true)||(((a.confidence!=null?a.confidence:a.confidence_score)||0)<0.5);
      if(c){
        const pct=Math.round(p.pct_of_limit*100);
        if(weak){
          // RRQJ5RU 2026-08-19 — PREFER THE AUTHORITATIVE NUMBER OVER THE GUESS.
          // Printing "~72% of the window · 145K safe headroom" while the real Anthropic
          // own headers reported the 5h window at 17% allowed is not a cautious
          // estimate, it is a wrong fact, and Vinta reads these lines. When
          // state/rate-reset.json (sourced from real response headers) is fresh,
          // report ITS utilization and label the source. The guess is only shown
          // when there is nothing authoritative to show.
          let real=null;
          try{
            const rr=JSON.parse(require("fs").readFileSync(process.argv[1]+"/../state/rate-reset.json","utf8"));
            // stale data is worse than none — only trust a reading under 30min old
            if(rr && rr.ok===true && (Date.now()-(rr.at||0))<30*60*1000){
              const w=(rr.windows&&rr.windows[rr.binding_window])||null;
              if(w && w.utilization!=null) real={util:Math.round(w.utilization*100),win:rr.binding_window,st:w.status};
            }
          }catch(e){}
          if(real){
            console.log(`${real.st} · ${real.util}% of the ${real.win.replace("_","-")} window used (authoritative, from Anthropic headers)`);
          } else {
            const conf=Math.round(((a.confidence!=null?a.confidence:a.confidence_score)||0)*100);
            console.log(`estimate only (${conf}% confidence, ceiling is a guess) · ~${pct}% of the ~${p.window.hours}h window · ${T.fmtTok(p.tokens_remaining_safe)} safe headroom`);
          }
        } else {
          console.log(`${c.safety} · ${pct}% of the ~${p.window.hours}h window used · ${T.fmtTok(p.tokens_remaining_safe)} safe headroom`);
        }
      }
    }catch(e){}
  ' "$BIN" "$TASK_JSON" 2>/dev/null)" || true
  if [ -n "${FORECAST:-}" ]; then
    log "iter $i — rate-limit forecast for [$TID]: $FORECAST"
    echo "[$(date -Iseconds)] [$AGENT_ID] 📊 forecast: $FORECAST" >> "$LOGS/task-${TID}.log" 2>/dev/null || true
  fi

  # per-task live log — the GUI tails THIS to show a task's own CLI/terminal output
  TASK_LOG="$LOGS/task-${TID}.log"
  : > "$TASK_LOG"
  echo "[$(date -Iseconds)] [$AGENT_ID] ▶ START [$TID] $TITLE" >> "$TASK_LOG"
  # flip to 'doing' + attach the log file + a starting progress note (GUI reads these)
  $VINTASK update "$TID" --status doing --logfile "$TASK_LOG" --progress "starting — reading the task" >/dev/null 2>&1

  # ── SKILLS (task ACAVWXR) ──────────────────────────────────────────────────
  # A skill is HOW the work is done well. If Vinta attached any to this card, their
  # directives are rendered here and land in the wake prompt VERBATIM, so attaching
  # one actually changes the work instead of decorating the board. Empty when the
  # card carries no skills — and a missing/broken registry yields empty rather than
  # failing the wake, because a seat must never be blocked by an advisory feature.
  SKILL_BLOCK="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      try{
        const t=JSON.parse(d);
        if(!Array.isArray(t.skills)||!t.skills.length) return;
        const S=require(process.env.HOME+"/.claude/council-loop/lib/skills.js");
        const out=S.renderSkillBlock(t.skills);
        if(out) process.stdout.write(out);
      }catch(e){}
    })' 2>/dev/null)" || true
  if [ -n "${SKILL_BLOCK:-}" ]; then
    echo "[$(date -Iseconds)] [$AGENT_ID] ✦ skills attached: $(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log((JSON.parse(d).skills||[]).join(", "))}catch{console.log("")}})' 2>/dev/null)" >> "$TASK_LOG" 2>/dev/null || true
  fi

  # build the wake prompt: the protocol + this seat's identity + the claimed task.
  # Add a PROGRESS PROTOCOL so the agent narrates its progress into the queue as it
  # works — this is what fills the progress bar + the task's update feed.
  PROMPT="$(cat "$PROTO")

---
AGENT_ID=$AGENT_ID
PROJECT=${TASK_PROJECT:-$PROJECT}
WORKTREE=$WORKTREE

TASK:
$TASK_JSON
${SKILL_BLOCK:+
$SKILL_BLOCK
}
PROGRESS PROTOCOL (do this as you go so Lord Vinta can watch live):
As you work, emit progress updates to the queue at each meaningful step:
  node $VINTASK_JS update $TID --progress \"<one short line: what you're doing now>\" --percent <0-100>
Call it when you start, at ~25/50/75%, and just before finishing. Keep each line
short and human. This drives the live progress bar and the task's update feed.

Execute the AUTONOMOUS LOOP PROTOCOL above for exactly this one task, then exit
with your one-line status (DONE/BLOCKED/NEEDS-HUMAN <id>). You are in worktree
$WORKTREE. Lord Vinta is not watching — do not ask him anything mid-task; if you
need a human decision, run: node $VINTASK_JS need $TID \"<the exact question>\" and exit."

  # ── TURN CONTRACT (PR-C, FDJQ4EC 2026-09-26) ────────────────────────────────
  # Every turn must END by calling the transition tool (bin/turn-schema.js emit),
  # which validates {verdict, evidence[], next} against config/turn-schema.json.
  # The payload is the PRIMARY verdict path below; stdout prose is only a floor.
  # COUNCIL_TURN_SCHEMA=strict (default) | floor (prose still acts) | off.
  TURN_MODE="${COUNCIL_TURN_SCHEMA:-strict}"
  if [ -f "$BIN/turn-schema.js" ] && [ "$TURN_MODE" != "off" ]; then
    TURN_BLOCK="$("$NODE_BIN" "$BIN/turn-schema.js" prompt-block --task "$TID" 2>/dev/null)"
    [ -n "$TURN_BLOCK" ] && PROMPT="$PROMPT

$TURN_BLOCK"
  fi

  # per-task token budget (failstop ceiling) — read from the task
  BUDGET="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).token_budget||400000)}catch{console.log(400000)}})')"

  # ── THE TOKEN ECONOMIST — adaptive per-task budget (wired 2026-09-10) ────────
  # Vinta directive 2026-08-18 (task 964B3QS) asked for budgets that "intelligently
  # increase and decrease" per task. bin/token-economist.js was WRITTEN to do exactly
  # that and then never called by anything — a seat on gemini-3.5-flash-lite narrated
  # the wiring, printed "DONE 2526DSM", and closed the card without making the edit
  # (see the PHANTOM DONE gate below, which exists because of this very task, and
  # whose comment records `grep -c token-economist bin/council-driver.sh = 0`).
  # This is that missing call site. The card was closed; the work was not done.
  #
  # It predicts from REAL cohort evidence — the agent's own completed-task
  # distribution (p90 × headroom), adjusted for priority and prior attempts — instead
  # of the blanket constant every card was minted with. Measured on ZBG52ZY:
  # recommended 2.0M against a static 6.0M, from a helios-fusion cohort of n=43.
  #
  # DEGRADE-NEVER-DIE, same contract as the router above: any failure, timeout, or
  # unparseable output leaves BUDGET exactly as the card set it. An advisory layer
  # must never be able to stop a seat from working. Disable with
  # COUNCIL_NO_ECONOMIST=1.
  if [ "${COUNCIL_NO_ECONOMIST:-0}" != "1" ] && [ -f "$BIN/token-economist.js" ]; then
    ECON_BUDGET="$(timeout 20 "$NODE_BIN" "$BIN/token-economist.js" predict "$TID" --json 2>/dev/null \
      | "$NODE_BIN" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const n=Number(j.recommended);console.log(Number.isFinite(n)&&n>0?Math.round(n):"")}catch{console.log("")}})' 2>/dev/null)"
    if [ -n "${ECON_BUDGET:-}" ] && [ "$ECON_BUDGET" -gt 0 ] 2>/dev/null; then
      if [ "$ECON_BUDGET" != "$BUDGET" ] 2>/dev/null; then
        log "iter $i — [$TID] economist: budget ${BUDGET} → ${ECON_BUDGET} (cohort-predicted)"
      fi
      BUDGET="$ECON_BUDGET"
    fi
  fi
  # per-task wall-clock timeout (seconds) — read from the task; default 3600 (60min,
  # up from the old hard 30min). Vinta directive 2026-08-01: the 30-min guillotine
  # was too small a scope for real tasks. Big tasks can set a larger timeout_secs on
  # the card; 0 disables the wall-clock limit entirely (killswitch + token budget
  # still bound it). Set per card via: node vintask.js timeout <id> <secs>.
  TIMEOUT_SECS="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const v=JSON.parse(d).timeout_secs; console.log(v==null?3600:v)}catch{console.log(3600)}})')"

  # ── MODEL ROUTING — MULTI-PROVIDER (AZGKUMK 2026-08-14, supersedes 2026-08-08) ──
  # Routing is no longer "which Anthropic model?" but "which PROVIDER × which TIER?",
  # decided by lib/llm-router.js from the task's own text + stakes. This is the layer
  # that beats Cursor: Cursor makes a human pick a model from a dropdown once and
  # applies that static choice to every request. We classify the WORK (code /
  # reasoning / security / speed / bulk / ui) and send code->Codex, deep reasoning->
  # Opus, bulk->local $0 — then LEARN from the outcome so the next route is better.
  #
  # The router returns a full failover LADDER, not one model. We take rung 1 here and
  # hand the rest to the failover loop below, so a dead vendor costs us a hop instead
  # of the task.
  #
  # DEGRADE-NEVER-DIE: if the router is missing, broken, or returns nothing usable,
  # we fall back to the original Anthropic stakes map. A routing layer must never be
  # able to take the council offline — an unroutable task still runs on Sonnet.
  ROUTER_JS="$ROOT/lib/llm-router.js"
  ROUTE=""; PROVIDER=""; TIER=""; PLAN_JSON=""
  # SAWPNWX 2026-08-21: the plan's RESOLVED tier is the task's CAPABILITY FLOOR —
  # how much brain the work needs, independent of which rung we happen to be on.
  # The failover loop walks BELOW it during tier-descent/last-resort, and when the
  # bottom rung also fails the seat used to die with a generic "exited without
  # recording a result". Holding the floor here lets us name the real cause.
  FLOOR_TIER=""; FLOOR_KIND=""
  # Failover hop ceiling comes from providers.json so the bound is configurable in
  # one place rather than hardcoded in the shell.
  MAX_HOPS="$($NODE_BIN -e 'try{console.log(require(process.argv[1]).policy.max_failover_hops||6)}catch{console.log(6)}' "$ROOT/config/providers.json" 2>/dev/null || echo 6)"
  [ -z "$MAX_HOPS" ] && MAX_HOPS=6
  if [ -f "$ROUTER_JS" ]; then
    printf '%s' "$TASK_JSON" > "$LOGS/task-${TID}.card.json"
    PLAN_JSON="$(COUNCIL_REPO="$WORKTREE" $NODE_BIN "$ROUTER_JS" plan --agentic --taskfile "$LOGS/task-${TID}.card.json" --json 2>>"$TASK_LOG" || true)"
    if [ -n "$PLAN_JSON" ]; then
      # JVQ8RQZ: an intentional capability hold is not a router outage.
      # Never turn an empty protected ladder into the legacy weaker-model route.
      QUALITY_HOLD="$(printf '%s' "$PLAN_JSON" | "$NODE_BIN" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);if(p.quality_floor && Array.isArray(p.ladder) && p.ladder.length===0)console.log(p.quality_floor)}catch{}})' 2>/dev/null)"
      if [ -n "$QUALITY_HOLD" ]; then
        $VINTASK block "$TID" "No available model meets required ${QUALITY_HOLD} quality floor; retry when a capable provider recovers." >/dev/null 2>&1
        log "iter $i — [$TID] held at ${QUALITY_HOLD} quality floor; no legacy downgrade"
        continue
      fi
      RLINE="$(printf '%s' "$PLAN_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);const r=(p.ladder||[])[0];if(!r){console.log("");}else console.log([r.provider,r.model,r.tier,r.budget,p.kind].join(" "))}catch{console.log("")}})' 2>/dev/null)"
      FLOOR_TIER="$(printf '%s' "$PLAN_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);console.log(p.tier||"")}catch{console.log("")}})' 2>/dev/null)"
      FLOOR_KIND="$(printf '%s' "$PLAN_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);console.log(p.kind||"")}catch{console.log("")}})' 2>/dev/null)"
      if [ -n "$RLINE" ]; then
        PROVIDER="$(printf '%s' "$RLINE" | cut -d" " -f1)"
        ROUTE="$(printf '%s'    "$RLINE" | cut -d" " -f2)"
        TIER="$(printf '%s'     "$RLINE" | cut -d" " -f3)"
        RBUDGET="$(printf '%s'  "$RLINE" | cut -d" " -f4)"
        RKIND="$(printf '%s'    "$RLINE" | cut -d" " -f5)"
        # The router's per-tier budget only LOWERS the card's budget, never raises it:
        # an explicit token_budget on the card is Vinta's ceiling and stays authoritative.
        if [ -n "$RBUDGET" ] && [ "$RBUDGET" -gt 0 ] 2>/dev/null && [ "$RBUDGET" -lt "$BUDGET" ] 2>/dev/null; then
          BUDGET="$RBUDGET"
        fi
      fi
    fi
  fi
  # ── INTELLIGENT ROUTING VIA LLM-ROUTER (T3RRBGX, 2026-10-22) ────────────────
  # Lord Vinta directive: "all our agents are only on the very single same ai model
  # claude-opus-5 and thats deffnitely not okay, i want our routying algorithm
  # system somehow integrated into the ai agentic motion"
  #
  # The hardcoded stakes→model map (opus-5 for everything but explicit low/trivial)
  # is REPLACED by llm-router.js, which:
  #   • Classifies task kind (code/reasoning/security/ui/bulk)
  #   • Routes per learned affinity + orchestrator assessment
  #   • Returns a LADDER of providers/models (anthropic, openai, xai, ollama)
  #   • Handles lockouts, circuit breakers, and multi-provider failover
  #   • Learns from outcomes to get smarter over time
  #
  # The router is now the SOURCE OF TRUTH for routing. The old hardcoded path below
  # survives as a fallback ONLY when the router itself is unreachable.

  if [ -z "$ROUTE" ]; then
    # 897WZ7N 2026-10-27 FIX: PLAN_JSON used to be cleared HERE unconditionally,
    # before checking whether the FIRST (--agentic) router call above already
    # succeeded and set ROUTE/PROVIDER/TIER + a usable ladder. Since this block
    # only re-plans when ROUTE is still empty, the unconditional clear threw
    # away a successful first plan's ladder before the failover loop further
    # down (`if [ -n "$PLAN_JSON" ]`) ever got to read it — so ANY task whose
    # first router call succeeded got ZERO cross-vendor failover: a mid-run
    # Claude lockout had no ladder left to fall back through, and the fix in
    # DUBHNJY (skip same-vendor rungs) never got a chance to run. Moving the
    # clear inside this if-block means PLAN_JSON is only reset when it is
    # about to be replaced by a fresh plan, never when the first plan already
    # succeeded.
    PLAN_JSON=""  # The failover logic at line 1534+ reads this variable
    # Call llm-router.js to get the full ladder with multi-provider failover
    PLAN_JSON="$(timeout 10 "$NODE_BIN" "$ROUTER_JS" plan \
      --title "$(printf '%s' "$TASK_JSON" | $NODE_BIN -pe 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).title||"")}catch{}})')" \
      --detail "$(printf '%s' "$TASK_JSON" | $NODE_BIN -pe 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).detail||"")}catch{}})')" \
      --stakes "$(printf '%s' "$TASK_JSON" | $NODE_BIN -pe 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).stakes||"")}catch{}})')" \
      --json 2>/dev/null || echo "")"

    if [ -n "$PLAN_JSON" ]; then
      # JVQ8RQZ: an intentional capability hold is not a router outage.
      # Never turn an empty protected ladder into the legacy weaker-model route.
      QUALITY_HOLD="$(printf '%s' "$PLAN_JSON" | "$NODE_BIN" -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);if(p.quality_floor && Array.isArray(p.ladder) && p.ladder.length===0)console.log(p.quality_floor)}catch{}})' 2>/dev/null)"
      if [ -n "$QUALITY_HOLD" ]; then
        $VINTASK block "$TID" "No available model meets required ${QUALITY_HOLD} quality floor; retry when a capable provider recovers." >/dev/null 2>&1
        log "iter $i — [$TID] held at ${QUALITY_HOLD} quality floor; no legacy downgrade"
        continue
      fi
      # Router succeeded — extract rung 0 (first/best choice) and set up capability floor
      # The existing failover loop (line 1534+) automatically walks the ladder on failure
      RUNG0="$(printf '%s' "$PLAN_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);const r0=(p.ladder||[])[0];if(!r0)console.log("");else console.log([r0.provider,r0.model,r0.tier,p.kind||"unclassified"].join(" "))}catch{console.log("")}})' 2>/dev/null)"

      if [ -n "$RUNG0" ]; then
        PROVIDER="$(printf '%s' "$RUNG0" | cut -d' ' -f1)"
        ROUTE="$(printf '%s' "$RUNG0" | cut -d' ' -f2)"
        TIER="$(printf '%s' "$RUNG0" | cut -d' ' -f3)"
        RKIND="$(printf '%s' "$RUNG0" | cut -d' ' -f4)"
        # Capability floor for below-floor detection in failover (line 1588)
        FLOOR_TIER="$TIER"
        FLOOR_KIND="${RKIND:-general}"
        LADDER_COUNT="$(printf '%s' "$PLAN_JSON" | $NODE_BIN -pe 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);console.log((p.ladder||[]).length)}catch{console.log(0)}})' 2>/dev/null)"
        log "iter $i — [$TID] router: ${PROVIDER}/${ROUTE} [${TIER}] kind=${RKIND} (${LADDER_COUNT}-rung ladder)"
        echo "[$(date -Iseconds)] [$AGENT_ID] ROUTER ${PROVIDER}/${ROUTE} [${TIER}] kind=${RKIND} — ${LADDER_COUNT}-rung failover ladder" >> "$TASK_LOG"
      else
        # Ladder was empty — clear PLAN_JSON to trigger legacy fallback
        PLAN_JSON=""
        log "iter $i — [$TID] router returned empty ladder, falling back to legacy"
      fi
    fi

    # Legacy fallback: router unavailable/failed, or returned empty ladder
    if [ -z "$PLAN_JSON" ]; then
      log "iter $i — [$TID] router unavailable, using legacy hardcoded routing"
      ROUTE="$(printf '%s' "$TASK_JSON" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const t=JSON.parse(d);
        const map={"opus-5":"claude-opus-5","opus5":"claude-opus-5","opus-4-8":"claude-opus-4-8","opus":"claude-opus-4-8","sonnet":"claude-sonnet-4-5","haiku":"claude-haiku-4-5"};
        let m = t.model && map[String(t.model).toLowerCase()];
        if(!m){ const s=String(t.stakes||"").toLowerCase();
          m = s==="low"||s==="trivial"||s==="mechanical" ? "claude-sonnet-4-5"
            : s==="minor" ? "claude-opus-4-8"
            : "claude-opus-5"; }
        console.log(m);
      }catch{console.log("claude-opus-5")}})')"
      [ -z "$ROUTE" ] && ROUTE="claude-opus-5"
      PROVIDER="anthropic"; TIER="legacy"; RKIND="unclassified"
      log "iter $i — [$TID] legacy: ${PROVIDER}/${ROUTE} [${TIER}]"
      echo "[$(date -Iseconds)] [$AGENT_ID] LEGACY ${PROVIDER}/${ROUTE} [${TIER}]" >> "$TASK_LOG"
    fi
  fi

  # Set Anthropic fallback models for same-vendor in-process failback (--fallback-model)
  case "$ROUTE" in
    claude-opus-5*)    FALLBACK="claude-opus-4-8" ;;
    claude-opus-4-8)   FALLBACK="claude-sonnet-4-5" ;;
    claude-sonnet-4-5|claude-sonnet-5) FALLBACK="claude-haiku-4-5" ;;
    *)                 FALLBACK="claude-haiku-4-5" ;;
  esac
  # (2026-09-25, CORRECTED 2026-09-26) RECORD WHAT RAN — WITHOUT PINNING IT.
  #
  # The original version of this wrote --provider/--model, which was my bug: those
  # are the card's USER-PIN fields. vintask.js's own schema comment says they exist
  # "for the times Vinta knows better than the heuristic", and llm-router.js treats
  # them as an explicit pin that becomes rung 0 AND BYPASSES the capability floor.
  # So recording "what ran" silently became "what must run forever": every route the
  # broken router made turned into a sticky pin. 826C38V was hand-fixed, ran once,
  # and came back pinned to openai/gpt-5.5 — proof the stamp re-pinned on every run.
  # Two different questions were sharing one field:
  #     provider/model  = what model MUST run this   (Vinta's override — his alone)
  #     ran_provider/ran_model = what model DID run it (accounting — ours to write)
  # They are now separate. The accounting Vinta asked for is preserved; the pin is
  # left untouched unless he sets it himself.
  $VINTASK update "$TID" --ran-provider "$PROVIDER" --ran-model "$ROUTE" >/dev/null 2>&1

  RAW_LOG="$LOGS/task-${TID}.raw.jsonl"; : > "$RAW_LOG"

  # LAST-LOOK BEFORE SPENDING A SEAT (XBPUDNT, 2026-08-06). `next` claims only open
  # tasks, but seconds pass between that claim and this launch — enough for Vinta to
  # cancel from the GUI. Launching anyway spends a whole Opus-5 context on work that
  # is already dead, and the agent's own first act is to discover that and stand down.
  # `update --status doing` above is a no-op on a terminal task (cmdUpdate freezes
  # terminal status), so re-read the record and skip the wake entirely if it settled.
  PRESTAT="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
  if [ "$PRESTAT" = "cancelled" ] || [ "$PRESTAT" = "done" ]; then
    log "iter $i — [$TID] settled ($PRESTAT) between claim and launch — skipping wake, no tokens spent"
    echo "[$(date -Iseconds)] [$AGENT_ID] SKIPPED — task was $PRESTAT before the agent started" >> "$TASK_LOG"
    continue
  fi

  # ── RATE-LIMIT FORECAST BEFORE SPENDING THE SEAT (4QBY759, 2026-08-13) ──────
  # Vinta was locked out 9:12am→1pm because nothing saw Anthropic's wall coming.
  # This is the seat's last chance to notice. It asks token-limits.js "can I
  # afford this card right now?" and writes the answer where Vinta will see it:
  # the task's own log and the driver log.
  #
  # ⚠ THIS WARNS. IT NEVER BLOCKS — deliberately, and this must stay true.
  # The ceiling is INFERRED from a black box (currently ~26% confidence off a
  # single observed lockout), so a wrong estimate is not a remote possibility, it
  # is the expected early state. A driver that refused work on a low-confidence
  # guess would silently strand Vinta's P1 queue while the board looked healthy —
  # far more expensive than the lockout it was trying to dodge. So the forecast
  # buys foresight at zero risk: worst case, a noisy log line.
  #
  # Failure is non-fatal by construction: if the board is down, curl times out,
  # or jq is missing, FORECAST stays empty and the seat proceeds exactly as it
  # did before this block existed. A monitoring system must never be able to take
  # the thing it monitors offline.
  if [ -n "${TOKEN_API:-}" ] || [ -z "${TOKEN_FORECAST_OFF:-}" ]; then
    # J3ZZF9Q — the board moved :8799 → :8798 on 2026-10-18 (state/gui-port) and
    # this hardcoded port silently emptied FORECAST from then on, which skipped
    # the rate-probe refresh below, which froze the lockout history at 10-16.
    # Resolve the live port the same way the watchdog/tunnel do.
    TOKEN_API="${TOKEN_API:-http://localhost:$(cat "$ROOT/state/gui-port" 2>/dev/null | tr -dc 0-9 | head -c 5 || true)}"
    case "$TOKEN_API" in *:) TOKEN_API="http://localhost:8799" ;; esac
    FORECAST="$(curl -s --max-time 3 \
      "$TOKEN_API/api/tokens/predict-timeout?planned=${BUDGET}&model=${ROUTE}" 2>/dev/null || true)"
    if [ -n "$FORECAST" ]; then
      TOK_LEVEL="$(printf '%s' "$FORECAST" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).level||"")}catch{console.log("")}})' 2>/dev/null)"
      TOK_ADVICE="$(printf '%s' "$FORECAST" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).advice||"")}catch{console.log("")}})' 2>/dev/null)"
      TOK_HIT="$(printf '%s' "$FORECAST" | $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).will_hit_limit===true?"yes":"no")}catch{console.log("no")}})' 2>/dev/null)"
      # LABEL THE RIGHT THING. `level` grades spend ALREADY BURNED; will_hit_limit
      # grades THE PLAN. Early in a window those disagree constantly — a 2M-token
      # card at 8% used is a green level and a doomed plan — and printing
      # "RATE-LIMIT green" next to a lockout warning reads as a broken instrument.
      # Name whichever one actually triggered the warning.
      # LOW-CONFIDENCE GATE (2026-08-14). will_hit_limit is computed against a
      # ceiling that is currently a GUESS (limit_is_prior=true, ~26% confidence
      # off ONE observed lockout). That produced a "⚠ RATE-LIMIT budget" line on
      # essentially every card while the authoritative rate API reported the 5h
      # window at 17% and allowed. A warning that fires always is noise, and
      # noise is what makes a real warning get ignored. Below the confidence
      # floor we downgrade budget-warnings to an informational estimate line;
      # genuine window pressure (orange/red, which is graded on tokens ACTUALLY
      # burned, not on the guessed ceiling) still warns loudly as before.
      TOK_WEAK="$(timeout 6 $NODE_BIN -e '
        try{const T=require(process.argv[1]+"/token-limits.js");
          const a=(T.analyzeLimits?T.analyzeLimits():{})||{};
          const conf=(a.confidence!=null?a.confidence:a.confidence_score)||0;
          console.log((a.limit_is_prior===true||conf<0.5)?"yes":"no");
        }catch(e){console.log("no")}
      ' "$BIN" 2>/dev/null)" || TOK_WEAK="no"
      # ── TRUST THE AUTHORITATIVE RATE API OVER THE GUESS (2026-08-17) ─────────
      # predict-timeout grades the plan against a GUESSED ceiling (limit_is_prior,
      # ~26% confidence off ONE lockout). state/rate-reset.json is the real thing:
      # it comes from Anthropic's own response headers. On 2026-08-17 the guess
      # screamed "163% of the window, expect a 4h lockout" while the real 5h window
      # sat at 17% utilization, status `allowed`. When the real API says we are
      # allowed and the binding window is under 80% used, the guess is noise —
      # suppress it entirely rather than crying wolf on every card.
      # RRQJ5RU 2026-08-19 — STALE GROUND TRUTH IS NOT GROUND TRUTH.
      # This read had NO freshness check. state/rate-reset.json was found 36 HOURS
      # old (2165 min) holding util=0.17 while a live probe returned util=0.72 —
      # so the gate was silently green-lighting cards off day-and-a-half-old data,
      # and would keep saying "authoritative: allowed, <80%" straight through a
      # real wall. A cached number this important must expire. Refresh it first
      # (bounded, non-fatal), then require the reading to be recent to count.
      if [ -x "$BIN/rate-reset.js" ] || [ -f "$BIN/rate-reset.js" ]; then
        RR_AGE="$(timeout 4 $NODE_BIN -e '
          try{const fs=require("fs");
            const r=JSON.parse(fs.readFileSync(process.argv[1]+"/../state/rate-reset.json","utf8"));
            console.log(Math.round((Date.now()-(r.at||0))/60000));
          }catch(e){console.log(99999)}
        ' "$BIN" 2>/dev/null)" || RR_AGE=99999
        # only pay for a live probe when the cache has actually gone stale (>10min)
        if [ "${RR_AGE:-99999}" -gt 10 ] 2>/dev/null; then
          timeout 25 $NODE_BIN "$BIN/rate-reset.js" --refresh --json >/dev/null 2>&1 || true
        fi
      fi
      RATE_REAL_OK="$(timeout 4 $NODE_BIN -e '
        try{const fs=require("fs");
          const r=JSON.parse(fs.readFileSync(process.argv[1]+"/../state/rate-reset.json","utf8"));
          const w=(r.windows&&r.windows[r.binding_window])||{};
          const util=(w.utilization!=null?w.utilization:1);
          const ageMin=(Date.now()-(r.at||0))/60000;
          const fresh=ageMin<30;   // older than 30min cannot vouch for "right now"
          console.log((fresh && r.ok===true && r.status==="allowed" && r.walled!==true && util<0.8)?"yes":"no");
        }catch(e){console.log("no")}
      ' "$BIN" 2>/dev/null)" || RATE_REAL_OK="no"
      if [ "$TOK_HIT" = "yes" ] && [ "$RATE_REAL_OK" = "yes" ] && [ "$TOK_LEVEL" != "orange" ] && [ "$TOK_LEVEL" != "red" ]; then
        log "iter $i — [$TID] rate-limit ok (authoritative API: allowed, binding window <80%) — ignoring low-confidence forecast"
      elif [ "$TOK_HIT" = "yes" ] && [ "$TOK_WEAK" = "yes" ] && [ "$TOK_LEVEL" != "orange" ] && [ "$TOK_LEVEL" != "red" ]; then
        log "iter $i — [$TID] rate-limit estimate (low confidence — ceiling is a guess): ${TOK_ADVICE}"
      elif [ "$TOK_HIT" = "yes" ] || [ "$TOK_LEVEL" = "orange" ] || [ "$TOK_LEVEL" = "red" ]; then
        if [ "$TOK_HIT" = "yes" ]; then TOK_TAG="budget"; else TOK_TAG="window-${TOK_LEVEL}"; fi
        log "iter $i — [$TID] ⚠ RATE-LIMIT ${TOK_TAG}: ${TOK_ADVICE} (proceeding — warn only)"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ RATE-LIMIT ${TOK_TAG} — ${TOK_ADVICE}" >> "$TASK_LOG"
      else
        log "iter $i — [$TID] rate-limit ok (${TOK_LEVEL:-unknown}): ${TOK_ADVICE}"
      fi
    fi
  fi

  # LAUNCH THE ROUTED PROVIDER. Anthropic keeps its exact original invocation (the
  # watcher below depends on stream-json), and every other provider is launched by
  # the router, which normalizes its stream into the same raw log the watcher reads.
  # `launch_rung <provider> <model>` sets AGENT_PID; the watcher is provider-agnostic
  # because both parse-usage.js and extract-text.js now sniff all three formats.
  #
  # NOTE the `exec 200>&-`: the agent subshell (and the child it spawns) MUST NOT
  # inherit the seat lock fd. An inherited fd keeps the lock open in a process that
  # outlives us, so after this driver died the seat would look permanently occupied
  # and NO replacement driver could ever start — a self-healing mutex turned into a
  # permanent seat wedge. Closing it here keeps the lock's lifetime exactly equal to
  # the driver's. It is repeated in EVERY launch path below for that reason.
  # ── REAP THE WHOLE AGENT TREE, NOT JUST THE SUBSHELL ────────────────────────
  # (Vinta directive 2026-08-21, task SBKWSRS — he chose option (b) from
  # SBKWSRS-collision-postmortem.md: "seat release should signal/kill in-flight
  # subagents".)
  #
  # THE BUG THIS KILLS: every failstop below used to run `kill -TERM $AGENT_PID`,
  # which signals ONLY the `( ... ) &` subshell. But that subshell runs `timeout`,
  # and timeout calls setpgid() — so `timeout`, the `claude`/router process under
  # it, and EVERY subagent claude spawns live in a DIFFERENT process group that the
  # signal never reaches. The subshell died instantly and the real agent kept
  # running, unsupervised and unaware it had lost its task lock.
  #
  # That is not theoretical. On 2026-08-20 seat-2 lost the SBKWSRS lock at 40%;
  # its atlas-rp subagent went on writing to /home/vinta/dirzombie for ~20 more
  # minutes and overwrote four live files belonging to the seat that had taken
  # over. Only the subagent's own collision check prevented permanent loss.
  #
  # THE FIX: signal the agent's PROCESS GROUP (`kill -TERM -PGID`), which reaches
  # timeout + claude + every subagent at once. This is surgical, not a blunderbuss:
  # that PGID belongs solely to this one agent invocation, so it can never touch
  # the driver, the watchdog, another seat, or Vinta's own shell — and we verify it
  # differs from our own PGID before signalling. Fallbacks (direct pid, then a
  # pkill -P descent) cover the case where no separate group was created, e.g. if
  # timeout is ever dropped from the launch line.
  reap_agent_tree() {
    _rt_sig="${1:-TERM}"
    [ -z "$AGENT_PID" ] && return 0
    # The agent's group leader is the direct child of our subshell (`timeout ...`).
    # Ask the kernel for its PGID rather than assuming one.
    _rt_kid="$(pgrep -P "$AGENT_PID" 2>/dev/null | head -1)"
    _rt_pgid=""
    [ -n "$_rt_kid" ] && _rt_pgid="$(ps -o pgid= -p "$_rt_kid" 2>/dev/null | tr -d ' ')"
    # Only group-kill a group that is genuinely the agent's own. Never signal our
    # own group (that would take down this driver and its whole seat), never 0/1.
    _rt_self="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"
    if [ -n "$_rt_pgid" ] && [ "$_rt_pgid" != "$_rt_self" ] \
       && [ "$_rt_pgid" != "0" ] && [ "$_rt_pgid" != "1" ]; then
      kill -"$_rt_sig" -- "-$_rt_pgid" 2>/dev/null || true
    fi
    # Belt and suspenders: the subshell itself, plus a descent through any children
    # that were NOT in that group (no-setpgid launch paths).
    [ -n "$_rt_kid" ] && kill -"$_rt_sig" "$_rt_kid" 2>/dev/null || true
    kill -"$_rt_sig" "$AGENT_PID" 2>/dev/null || true
    pkill -"$_rt_sig" -P "$AGENT_PID" 2>/dev/null || true
    [ -n "$_rt_kid" ] && pkill -"$_rt_sig" -P "$_rt_kid" 2>/dev/null || true
    return 0
  }

  # TERM, give the tree a moment to unwind, then KILL anything still standing.
  # Replaces the old `kill -TERM $PID; sleep 2; kill -9 $PID` couplet everywhere.
  stop_agent() {
    reap_agent_tree TERM
    sleep 2
    reap_agent_tree KILL
  }

  # 897WZ7N 2026-10-27: $RAW_LOG/$TASK_LOG/$TASK_LOG.routerout are never
  # truncated between failover hops — they accumulate across the WHOLE task.
  # So the outage/failure classifiers below used to read EVERY earlier rung's
  # output too, which meant a resolved first-rung Claude lockout error was
  # still sitting in the window after a LATER rung recovered, and got
  # reclassified as a live outage. attempt_offset()/current_attempt_evidence()
  # scope each classification to ONLY the bytes written since the CURRENT
  # rung's launch_rung() call, by byte offset (not line count, so a single
  # huge JSON line can't throw off a `tail -N` window either).
  attempt_offset() {
    [ -f "$1" ] && wc -c < "$1" 2>/dev/null || printf '0'
  }
  current_attempt_evidence() {
    tail -c "+$(( ${ATTEMPT_RAW_START:-0} + 1 ))" "$RAW_LOG" 2>/dev/null
    tail -c "+$(( ${ATTEMPT_TASKLOG_START:-0} + 1 ))" "$TASK_LOG" 2>/dev/null
    tail -c "+$(( ${ATTEMPT_ROUTER_START:-0} + 1 ))" "$TASK_LOG.routerout" 2>/dev/null
  }
  launch_rung() {
    _lp="$1"; _lm="$2"
    ATTEMPT_RAW_START="$(attempt_offset "$RAW_LOG")"
    ATTEMPT_TASKLOG_START="$(attempt_offset "$TASK_LOG")"
    ATTEMPT_ROUTER_START="$(attempt_offset "$TASK_LOG.routerout")"
    if [ "$_lp" = "anthropic" ]; then
      # TWO-LANE AUTH (task 5VD8U2V, 2026-10-24): "we walked out of tokens for the
      # week but I still have $110 API Claude credits so it should've ran off that
      # why did it not figure it out." Before this, EVERY anthropic launch used the
      # Claude Code subscription (CLAUDE_CODE_OAUTH_TOKEN) only — there was no path
      # to the separate pay-as-you-go Console API credit balance, so a subscription
      # usage-limit outage went dark until the weekly window reset instead of
      # drawing on the $110 already sitting there. bin/credit-probe.sh now probes
      # both lanes and persists the winner in lib/anthropic-lane.js; check it here
      # so a task launched WHILE the subscription is known-exhausted bills the API
      # key lane instead of repeating the same exhausted OAuth call.
      _authwrap=()
      _alane="oauth"
      if [ -f "$ROOT/lib/anthropic-lane.js" ]; then
        _alane="$("$NODE_BIN" "$ROOT/lib/anthropic-lane.js" get 2>/dev/null || echo oauth)"
      fi
      # LANE ISOLATION (5VD8U2V follow-up 2026-10-24). MEASURED on claude 2.1.310:
      # ANTHROPIC_API_KEY "takes precedence over your claude.ai login" (the CLI says
      # so verbatim when one is set). So the lane decision only decides the WALLET if
      # the other lane's credential is absent from the child env — otherwise a
      # lane=oauth launch would still bill the API key whenever one happened to be
      # exported. Each branch therefore strips the other lane's credential.
      _envwrap=()
      if [ "$_alane" = "api" ] && "$VINTKEY_BIN" has provider:anthropic 2>/dev/null; then
        _authwrap=("$VINTKEY_BIN" exec provider:anthropic=ANTHROPIC_API_KEY --)
        _envwrap=(env -u CLAUDE_CODE_OAUTH_TOKEN)
        log "iter $i — [$TID] anthropic lane=api (subscription lane marked exhausted) — billing the \$ Console API credit balance for this launch"
      else
        _envwrap=(env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN)
        # Long-lived Claude token (2026-10-05): if Vinta ran `claude setup-token` and
        # stored it as provider:claude_code_oauth_token, inject it through vintkey so
        # seats survive the ~daily claude.ai OAuth expiry that blocked 92NZ2RQ.
        # Absent → plain CLI login, exactly as before.
        if "$VINTKEY_BIN" has provider:claude_code_oauth_token 2>/dev/null; then
          _authwrap=("$VINTKEY_BIN" exec provider:claude_code_oauth_token=CLAUDE_CODE_OAUTH_TOKEN --)
        fi
      fi
      ( exec 200>&-; cd "$WORKTREE" && printf '%s' "$PROMPT" | "${_authwrap[@]}" "${_envwrap[@]}" timeout "$TIMEOUT_SECS" "$CLAUDE_BIN" \
            --print --verbose --output-format stream-json \
            --model "$_lm" --fallback-model "$FALLBACK" \
            --dangerously-skip-permissions >> "$RAW_LOG" 2>>"$TASK_LOG" ) &
      AGENT_PID=$!
    else
      ( exec 200>&-; cd "$WORKTREE" && printf '%s' "$PROMPT" | timeout "$TIMEOUT_SECS" \
            "$NODE_BIN" "$ROUTER_JS" exec \
            --taskfile "$LOGS/task-${TID}.card.json" \
            --cwd "$WORKTREE" --rawlog "$RAW_LOG" \
            --provider "$_lp" --model "$_lm" --single \
            >> "$TASK_LOG.routerout" 2>>"$TASK_LOG" ) &
      AGENT_PID=$!
    fi
  }
  # PR-D: every model attempt is recorded structurally against the HEAD it started
  # from, so the retry gate can see reverts / circular diffs / broken syntax.
  verify_attempt() {
    [ -f "$BIN/verify-diff.js" ] && [ "${COUNCIL_VERIFY_DIFF:-1}" != "0" ] || return 0
    [ -n "${DIFF_BASE:-}" ] || return 0
    # Only an attempt that actually EXECUTED tools is structural evidence; a provider
    # outage that never ran must never count as a regression.
    _va_tools="$(grep -c '"tool_use"\|"function_call"\|"tool_call"\|"local_shell_call"\|"exec_command"\|"shell_call"' "$RAW_LOG" 2>/dev/null | tr -cd '0-9')"
    [ "${_va_tools:-0}" -gt 0 ] 2>/dev/null || return 0
    VERIFY_JSON="$(timeout 180 "$NODE_BIN" "$BIN/verify-diff.js" record --task "$TID" --repo "$WORKTREE" --base "$DIFF_BASE" --attempt "${HOP:-1}" --model "${PROVIDER}/${ROUTE}" 2>/dev/null | tail -1)"
    case "$VERIFY_JSON" in
      *'"regression":true'*) LAST_REGRESSION=1
        log "iter $i — ⚠ structural regression recorded [$TID] on ${PROVIDER}/${ROUTE}"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ STRUCTURAL REGRESSION — $(printf '%s' "$VERIFY_JSON" | head -c 600)" >> "$TASK_LOG" ;;
      *) LAST_REGRESSION=0 ;;
    esac
  }
  LAST_REGRESSION=0
  DIFF_BASE="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null)"
  TURN_SINCE="$(date +%s%3N)"
  launch_rung "$PROVIDER" "$ROUTE"

  # Merge this seat's branch into main after a verified completion. Deliberately
  # conservative: it NEVER force-pushes, NEVER resolves a conflict, and NEVER
  # touches main if anything is unexpected — on any doubt it leaves the branch
  # exactly as-is and says so, so a human still has clean material to work with.
  merge_back_to_main() {
    _mb_tid="$1"
    [ -d "$WORKTREE/.git" ] || [ -f "$WORKTREE/.git" ] || return 0
    _mb_branch="$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD 2>/dev/null)"
    case "${_mb_branch:-}" in
      ''|HEAD|main|master) return 0 ;;   # already on main, or detached — nothing to do
    esac
    # Nothing to merge?
    _mb_ahead="$(git -C "$WORKTREE" rev-list --count "main..${_mb_branch}" 2>/dev/null || echo 0)"
    case "${_mb_ahead:-0}" in ''|*[!0-9]*) _mb_ahead=0 ;; esac
    [ "$_mb_ahead" -eq 0 ] && return 0
    # Uncommitted work in the seat tree means the agent left the tree dirty; merging
    # would silently drop it. Leave it for a human rather than lose it.
    if [ -n "$(git -C "$WORKTREE" status --porcelain 2>/dev/null | head -1)" ]; then
      log "iter $i — merge-back SKIPPED [$_mb_tid]: ${_mb_branch} has uncommitted changes; not merging (nothing lost, branch intact)"
      return 0
    fi
    # Merge in the MAIN checkout, never in the seat worktree.
    if ! git -C "$REPO_DIR" merge --no-ff --no-edit "$_mb_branch" \
           -m "merge(${_mb_branch}): ${_mb_tid} completed [deploy v$(date +%Y%m%d-%H%M)]" >/dev/null 2>&1; then
      git -C "$REPO_DIR" merge --abort >/dev/null 2>&1 || true
      log "iter $i — ⚠ merge-back CONFLICTED [$_mb_tid] on ${_mb_branch} — aborted cleanly, main untouched, branch preserved for a human"
      # THE MERGE-CONFLICT FREEZE FIX (task KGQM5CU, 2026-09-16): returning 0 here let
      # the driver continue to `vintask done`, leaving the card green when the work is
      # NOT on main and cannot be without Vinta resolving the conflict. Cards like
      # QHWADHV froze in `doing` status, claimed forever. Fix: mark needs-human instead
      # of just updating progress, and return 1 so the driver knows merge failed.
      $VINTASK need "$_mb_tid" "Work is committed on ${_mb_branch} but conflicts with main — resolve the conflict manually, then: git -C $REPO_DIR checkout main && git merge --no-ff ${_mb_branch} && git push origin main && vintask done $_mb_tid --proof 'merged and pushed'" >/dev/null 2>&1
      return 1
    fi
    log "iter $i — ✅ merge-back [$_mb_tid]: ${_mb_branch} (${_mb_ahead} commit(s)) → main"
    # Push only if a reachable remote exists; a missing remote is not a failure.
    if git -C "$REPO_DIR" remote get-url origin >/dev/null 2>&1; then
      if git -C "$REPO_DIR" push origin main >/dev/null 2>&1; then
        log "iter $i — ✅ pushed main after merge-back [$_mb_tid]"
      else
        log "iter $i — merge-back landed on local main but push failed [$_mb_tid] (network or auth) — will ship on the next successful push"
      fi
    fi
  }

  classify_provider_failure() {
    # WADGY4E 2026-10-06: the failure text is PIPED to this function on stdin, but
    # the node program itself was ALSO read from stdin (`node - <<'NODE'`). The
    # heredoc wins fd 0, so `process.stdin` was the SCRIPT, never the piped text —
    # its 'end' never fired, `text` stayed '', and classifyFailure('', rc) returned
    # {kind:'capability'} for every non-zero exit. That is why a "You've hit your
    # session limit" 429 was logged "failed (capability)" and walked the ladder down
    # to haiku. Fix: capture the piped text to a temp file and hand its PATH to the
    # script (no fd-0 collision, no env/ARG_MAX ceiling on huge raw-jsonl tails).
    _cp_rc="$1"
    _cp_tmp="$(mktemp 2>/dev/null || echo /tmp/cpf.$$)"
    cat > "$_cp_tmp"
    "$NODE_BIN" - "$ROUTER_JS" "$_cp_rc" "$_cp_tmp" <<'NODE' 2>/dev/null || true
const fs = require('fs');
const router = require(process.argv[2]);
const rc = Number(process.argv[3] || 0);
let text = '';
try { text = fs.readFileSync(process.argv[4], 'utf8'); } catch {}
const f = router.classifyFailure(text, rc);
if (f && f.failover) console.log(f.kind || 'outage');
NODE
    rm -f "$_cp_tmp" 2>/dev/null || true
  }

  record_provider_outcome() {
    # PHASE 1 UPGRADE 2026-09-16: previously wrote provider-level health only, so the
    # driver's failover chain never touched route-history (route-history was only
    # updated by router.exec, which the driver bypasses). That left per-kind
    # per-model history blind to everything the driver actually did — and made the
    # anthropic "80% failure rate" invisible per-model (all four Claude models rolled
    # into one bucket that only the router knew about, not driver-mediated calls).
    # Now we also write route-history keyed by kind + provider/model, so the same
    # bandit-lite that ranks router-exec models also ranks driver-mediated ones.
    _ro_provider="$1"; _ro_ok="$2"; _ro_error="$3"; _ro_model="${4:-unknown}"; _ro_kind="${5:-general}"
    "$NODE_BIN" - "$ROUTER_JS" "$_ro_provider" "$_ro_ok" "$_ro_error" "$_ro_model" "$_ro_kind" <<'NODE' >/dev/null 2>&1 || true
// argv layout: [0]=node [1]="-" [2]=ROUTER_JS [3]=provider [4]=okStr [5]=err
// [6]=model [7]=kind. Earlier version destructured only 2 leading elements
// (missed the "-" that node inserts when the script comes from stdin), which
// shifted EVERY field by one — the router path was logged as the "provider",
// the actual provider was logged as "ok", the ok bool was logged as "err",
// the error string was logged as the "model", and the model as the "kind".
// Confirmed 2026-09-16 by finding /home/vinta/.claude/council-loop/lib/llm-router.js
// in provider-health.json as a "provider" and model names as "kinds". Fixed by
// skipping THREE leading argv elements — node, "-", ROUTER_JS — before the
// caller-supplied args start at argv[3].
const router = require(process.argv[2]);
const [, , , provider, okStr, err, model, kind] = process.argv;
const ok = okStr === 'true';
router.recordOutcome(provider, ok, { error: err || '' });
try { router.recordRoute(kind || 'general', provider, model || 'unknown', ok, {}); } catch {}
NODE
  }

  # LIVE EXECUTION-EVIDENCE RECORDER (SNJS8SA, 2026-10-26). Feeds
  # lib/llm-router.js's recordExecutionEvidence() from exactly the tool-call
  # counts this driver already computes for the UD7EJ4Y evidence fix (primary
  # success/narration check, and the failover-recovery check), so the
  # capability floor that decides whether google/xai can even appear on a
  # future ladder keeps re-measuring from real runs instead of trusting the
  # one frozen 2026-09-26 snapshot forever. Never blocks or fails a task.
  record_exec_evidence() {
    _re_provider="$1"; _re_had="$2"
    "$NODE_BIN" - "$ROUTER_JS" "$_re_provider" "$_re_had" <<'NODE' >/dev/null 2>&1 || true
const router = require(process.argv[2]);
const [, , , provider, hadStr] = process.argv;
try { router.recordExecutionEvidence(provider, hadStr === 'true'); } catch {}
NODE
  }

  # WATCHER: while the agent runs, every 5s — (1) parse cumulative tokens/cost from
  # the stream and update the task (drives the credit bar), (2) if the killswitch
  # is set OR the token budget is exceeded, terminate the agent (failstop).
  KILLED=""
  BUDGET_WARNED=""   # per-run latch: advisory budget overage logs once, never kills
  # STALL DETECTOR (Vinta directive 2026-08-04: "make sure something like this never
  # happens and wastes tokens"). A polling-wedged agent (re-reading an unchanged file,
  # "waiting for a monitor" that already exited) keeps its token count essentially
  # FLAT while burning wall-clock. If tokens don't grow by >STALL_DELTA for
  # STALL_SECS, the agent is wedged, not working — terminate + reclaim.
  STALL_SECS=480          # 8 min of no meaningful progress = wedged
  STALL_DELTA=1500        # fewer than this many new tokens over the window = flat
  # DEAD-PROVIDER FASTPATH (FREEZE-FIX 2026-08-14): a provider that emits NOTHING
  # AT ALL is not "wedged mid-thought", it's dead/misconfigured (wrong adapter,
  # reasoning model writing to `thinking` instead of stdout, model not pulled).
  # Waiting the full 8 min to learn that burned 65 zombie runs. If nothing at all has
  # come out after DEAD_SECS, cut it loose early so failover happens fast.
  DEAD_SECS=120
  #
  # ⚠ LIVENESS IS STREAM ACTIVITY, NOT TOKEN COUNT (8VPGK77, 2026-08-17).
  # Both detectors above used to ask parse-usage.js for a TOKEN COUNT and treat 0 as
  # "the provider is dead". That is only true on Anthropic, which reports cumulative
  # usage on EVERY message. The Codex-family providers on the router ladder report
  # usage exactly ONCE, in the final `turn.completed` line — so a Codex-routed seat
  # reads literally 0 tokens for its entire run no matter how hard it is working.
  # DEAD_SECS then fired at 120s and SIGKILLed healthy agents mid-thought. Observed
  # on JXF7NUN: "DEAD-PROVIDER failstop — 0 tokens in 120s" over a raw log holding
  # 619,722 real tokens of correct work. Each wrongful kill bumped stall_attempts,
  # and 3 of them tripped the cap and BLOCKED the card with "provider produced no
  # tokens; check: ollama up? model pulled?" — pointing Vinta at a healthy provider
  # while the actual defect was this meter. Several cards died this way.
  #
  # So liveness is now judged by STREAM EVENTS + BYTE GROWTH (stream-liveness.js),
  # which every provider produces while working, and tokens are used only as an
  # additional progress signal. A provider that is streaming IS alive, whether or
  # not it has told us the bill yet.
  LAST_TOK=0; STALL_ACC=0; ALIVE_ACC=0; _TOK_SENT=; _TOK_AT=0
  LAST_EV=0; LAST_BYTES=0
  while kill -0 "$AGENT_PID" 2>/dev/null; do
    sleep 5
    # tokens/cost so far from the stream-json (helper sums usage across blocks)
    USAGE="$($NODE_BIN "$BIN/parse-usage.js" "$RAW_LOG" 2>/dev/null || echo "0 0")"
    TOK="${USAGE%% *}"; COST="${USAGE##* }"
    # Only write when the meter moved (UGETFAG): every update rewrites + fsyncs the
    # whole 3.2MB tasks.jsonl, and an unchanged value every 5s x every seat was the
    # top writer on the root VHDX (tracefs: ~27 rewrites / 30s). It is also the claim
    # heartbeat (updated_at), so an unchanged value is still re-sent every 60s.
    if [ "${TOK:-0} ${COST:-0}" != "${_TOK_SENT:-}" ] || [ $((SECONDS - ${_TOK_AT:-0})) -ge 60 ]; then
      $VINTASK update "$TID" --tokens "${TOK:-0}" --cost "${COST:-0}" >/dev/null 2>&1 && { _TOK_SENT="${TOK:-0} ${COST:-0}"; _TOK_AT=$SECONDS; }
    fi
    # PROVIDER-AGNOSTIC LIVENESS (8VPGK77): stream events + bytes, not token count.
    LIVE="$($NODE_BIN "$BIN/stream-liveness.js" "$RAW_LOG" 2>/dev/null || echo "0 0")"
    EV="${LIVE%% *}"; BYTES="${LIVE##* }"
    case "$EV"    in ''|*[!0-9]*) EV=0 ;; esac
    case "$BYTES" in ''|*[!0-9]*) BYTES=0 ;; esac

    # dead-provider fastpath: NOTHING AT ALL out of the provider after DEAD_SECS.
    # "Nothing" now means zero stream events AND zero bytes AND zero tokens — a
    # genuinely silent provider. A Codex seat mid-work has events and bytes but no
    # tokens yet, and must never be mistaken for dead again.
    ALIVE_ACC=$((ALIVE_ACC + 5))
    if [ "$EV" -le 0 ] && [ "$BYTES" -le 0 ] && [ "${TOK:-0}" -le 0 ] 2>/dev/null \
       && [ "$ALIVE_ACC" -ge "$DEAD_SECS" ]; then
      log "iter $i — DEAD PROVIDER: [$TID] emitted no stream output at all in ${DEAD_SECS}s — provider silent, terminating early for failover"
      echo "[$(date -Iseconds)] [$AGENT_ID] DEAD-PROVIDER failstop — no stream output in ${DEAD_SECS}s" >> "$TASK_LOG"
      stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
      KILLED="stall"; break
    fi

    # stall accounting: progress = new tokens OR new stream events OR a growing log.
    # Any one of the three means the agent is still doing something; only when ALL
    # THREE are flat for STALL_SECS is it genuinely wedged (the polling-loop case
    # this detector was built for, where nothing new is produced at all).
    if [ "$(( ${TOK:-0} - LAST_TOK ))" -gt "$STALL_DELTA" ] 2>/dev/null \
       || [ "$EV" -gt "$LAST_EV" ] 2>/dev/null \
       || [ "$BYTES" -gt "$LAST_BYTES" ] 2>/dev/null; then
      STALL_ACC=0; LAST_TOK="${TOK:-0}"; LAST_EV="$EV"; LAST_BYTES="$BYTES"
    else
      STALL_ACC=$((STALL_ACC + 5))
      if [ "$STALL_ACC" -ge "$STALL_SECS" ]; then
        log "iter $i — STALL: no tokens, no stream events, no log growth in ${STALL_SECS}s for [$TID] — wedged, terminating + reclaiming"
        echo "[$(date -Iseconds)] [$AGENT_ID] STALL failstop — agent wedged (no progress ${STALL_SECS}s), reclaimed" >> "$TASK_LOG"
        stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
        KILLED="stall"; break
      fi
    fi
    # LIVE task output: extract readable text from the stream so "Task output" fills
    # DURING the run (not just at the end). Overwrite the readable portion each cycle.
    $NODE_BIN "$BIN/extract-text.js" "$RAW_LOG" 2>/dev/null > "$TASK_LOG.live" && \
      { head -1 "$TASK_LOG" > "$TASK_LOG.tmp" 2>/dev/null; cat "$TASK_LOG.live" >> "$TASK_LOG.tmp" 2>/dev/null; mv "$TASK_LOG.tmp" "$TASK_LOG" 2>/dev/null; }
    # killswitch? — but a HOLD trips this too, and the two must NOT be conflated
    # (task 7RXS2K9). `vintask pause` sets kill=true DELIBERATELY, as the only way
    # to tell this driver to let go of a running agent — and it ALSO atomically sets
    # status=paused in the same write. A kill (the "Stop the agent" button) sets
    # ONLY kill=true; status stays doing/claimed. So kill=true with status=paused is
    # Vinta HOLDING the card (keep it paused, keep its progress, resumable), never
    # killing it. Before this, both landed in the killswitch branch and the card was
    # stamped `blocked` below — so "Hold" killed the run instead of pausing it.
    KFLAG="$($VINTASK show "$TID" --field kill 2>/dev/null)"
    if [ "$KFLAG" = "true" ]; then
      KSTAT="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
      if [ "$KSTAT" = "paused" ]; then
        log "iter $i — HELD by Vinta (pause) for [$TID] — stopping agent, keeping it paused + resumable"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⏸ HELD by Vinta via pause — agent stopped, progress kept; resume with: vintask resume $TID" >> "$TASK_LOG"
        stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
        KILLED="paused"; break
      fi
      log "iter $i — KILLSWITCH tripped for [$TID] — terminating agent"
      echo "[$(date -Iseconds)] [$AGENT_ID] KILLED by Vinta via killswitch" >> "$TASK_LOG"
      stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
      KILLED="killswitch"; break
    fi
    # CANCELLED / SETTLED MID-FLIGHT? (XBPUDNT, 2026-08-06.) The loop polled `kill`
    # but never `status`, so `vintask cancel` on a RUNNING task did nothing to the
    # live seat: the agent kept burning Opus-5 tokens on work its owner had already
    # pulled, and only discovered it was dead by reading the record itself. That is
    # what looked like "the dispatcher hands out cancelled tasks" — the claim was
    # clean; the cancel simply arrived after dispatch and nothing enforced it.
    # Cancel is now a real failstop, on the same 5s cadence as the killswitch.
    # `done` is included because a duplicate/late runner on an already-finished task
    # is pure waste too. Only cancel is treated as owner intent to stop.
    LSTAT="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
    if [ "$LSTAT" = "cancelled" ] || [ "$LSTAT" = "done" ]; then
      log "iter $i — [$TID] went $LSTAT mid-flight — terminating agent (no more tokens on settled work)"
      echo "[$(date -Iseconds)] [$AGENT_ID] STOPPED — task $LSTAT while running; agent terminated" >> "$TASK_LOG"
      stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
      KILLED="settled"; break
    fi
    # ── BUDGET: WARN-ONLY, NEVER A HARD KILL (Vinta directive 2026-08-17, option b) ──
    # This used to `kill -9` the agent the instant TOK > BUDGET. That guillotine
    # killed 9A85T9G at 431925/400000 — 8% over an ARBITRARY ceiling — while the
    # authoritative rate API reported the real 5h window at 17% and `allowed`.
    # A cap calibrated at 26% confidence off ONE observed lockout must never be
    # allowed to terminate real work. The budget is now an ADVISORY line: we log
    # the overage once and let the agent finish. The only things that may still
    # stop a run are the killswitch (owner intent), cancel/done (settled work),
    # the wall-clock timeout, and a genuinely dead provider.
    # Set COUNCIL_BUDGET_HARD=1 to restore the old kill behavior for a seat.
    if [ -n "${TOK:-}" ] && [ "${TOK:-0}" -gt "$BUDGET" ] 2>/dev/null; then
      if [ "${COUNCIL_BUDGET_HARD:-0}" = "1" ]; then
        log "iter $i — TOKEN BUDGET exceeded: $TOK over $BUDGET for [$TID] — failstop (COUNCIL_BUDGET_HARD=1)"
        echo "[$(date -Iseconds)] [$AGENT_ID] FAILSTOP token budget $BUDGET exceeded at $TOK" >> "$TASK_LOG"
        stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
        KILLED="budget"; break
      fi
      # RUNAWAY BACKSTOP (2026-08-26). Warn-only is right for a MIS-CALIBRATED budget
      # and catastrophic for a LOOPING one. CHXPFQB ran 3x, each time blowing past its
      # advisory line, each time dying with "no status recorded", each time reclaimed at
      # 0% — 5,236,554 tokens total. DQDY9QQ did the same for 4,530,246. Together they
      # tripped the 8M daily ceiling and froze all 12 seats: the board "wedging".
      # A task at 4x its advisory budget is not under-estimated, it is running away.
      # Keep warn-only for ordinary overage; hard-stop only at the runaway multiple, so
      # a genuinely big task still finishes but a loop cannot eat the day.
      RUNAWAY_MULT="${COUNCIL_RUNAWAY_MULT:-4}"
      RUNAWAY_AT=$(( BUDGET * RUNAWAY_MULT ))
      if [ "${TOK:-0}" -gt "$RUNAWAY_AT" ] 2>/dev/null; then
        log "iter $i — RUNAWAY [$TID]: $TOK tokens is ${RUNAWAY_MULT}x its $BUDGET budget — hard-stopping before it eats the daily ceiling"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ RUNAWAY STOP at $TOK tokens (${RUNAWAY_MULT}x budget $BUDGET) — this task loops instead of landing" >> "$TASK_LOG"
        stop_agent
        KILLED="runaway"; break
      fi
      if [ -z "${BUDGET_WARNED:-}" ]; then
        BUDGET_WARNED=1
        log "iter $i — [$TID] over advisory budget ($TOK > $BUDGET) — CONTINUING (warn-only; killswitch/timeout still bind; hard stop at ${RUNAWAY_MULT}x = $RUNAWAY_AT)"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ over advisory token budget $BUDGET at $TOK — continuing, not killed" >> "$TASK_LOG"
      fi
    fi
  done
  wait "$AGENT_PID" 2>/dev/null; RC=$?
  AGENT_PID=""   # reaped — clear so the EXIT trap never targets a recycled pid (SBKWSRS)

  # human-readable text of the run for status detection (from the stream)
  OUT="$($NODE_BIN "$BIN/extract-text.js" "$RAW_LOG" 2>/dev/null)"
  echo "$OUT" | tail -20 >> "$TASK_LOG"
  # final usage write
  FUSAGE="$($NODE_BIN "$BIN/parse-usage.js" "$RAW_LOG" 2>/dev/null || echo "0 0")"
  FTOK="${FUSAGE%% *}"; FCOST="${FUSAGE##* }"
  $VINTASK update "$TID" --tokens "${FTOK:-0}" --cost "${FCOST:-0}" >/dev/null 2>&1
  echo "[$(date -Iseconds)] [$AGENT_ID] ■ END rc=$RC tokens=${FTOK:-0} cost=\$${FCOST:-0}" >> "$TASK_LOG"
  verify_attempt

  # ── BOOK ANTHROPIC SPEND (7RZB2DZ, 2026-09-20) ─────────────────────────────
  # launch_rung() execs $CLAUDE_BIN directly for anthropic and only routes OTHER
  # providers through llm-router.js exec — and recordSpend() lives inside the
  # router's execute(). So Claude work was real but structurally invisible to
  # provider-spend.jsonl (measured: 484 rows, anthropic=0). Book it here, from the
  # same RAW_LOG the usage above came from, so an Anthropic rung reports exactly
  # like every other provider. Idempotent per (task, rung) and never fatal.
  if [ "$PROVIDER" = "anthropic" ]; then
    _bk_ok=false; [ "${RC:-1}" -eq 0 ] && _bk_ok=true
    "$NODE_BIN" "$BIN/book-anthropic-spend.js" "$RAW_LOG" "$TID" "$ROUTE" \
      "${FLOOR_KIND:-general}" "$_bk_ok" "primary" >/dev/null 2>&1 || true
  fi

  # ── FEED THE ORACLE (4QBY759) ───────────────────────────────────────────────
  # The forecast above is only as good as the spend it can see. Every finished
  # run is a real datapoint about what this box actually burns per task, so post
  # it to the token ledger. Without this the analyzer only ever learns from
  # lockouts — the rare, painful events — instead of from ordinary work, and the
  # burn-rate that drives "minutes to the wall" would read as zero.
  # Backgrounded, time-capped, output discarded: recording usage must never
  # delay or fail the task that produced it.
  # G7E4RF2 2026-10-20: the POST used to fire HERE, inline, with the primary
  # $ROUTE — but this is BEFORE the cross-vendor failover block below, so a task
  # that fell through to a cheaper rung logged the planned model, not the one
  # that ran. The oracle event is now deferred to the terminal paths (via
  # oracle_log_tokens), each of which carries the FINAL $ROUTE after failover has
  # resolved the winning rung. Nothing is posted here anymore.

  # if we killed it, record + move on (don't fall through to status detection)
  if [ -n "$KILLED" ]; then
    if [ "$KILLED" = "killswitch" ]; then
      $VINTASK update "$TID" --status blocked --reason "stopped by Vinta via killswitch at ${FTOK:-0} tokens" --unkill >/dev/null 2>&1
    elif [ "$KILLED" = "paused" ]; then
      # A HOLD, not a kill (task 7RXS2K9). pause() already set status=paused with the
      # percent/notes intact; the agent is now stopped. Do NOT touch the status — the
      # whole point of Hold is that it stays `paused` and resumable. Only clear the
      # kill flag pause set (so a later `resume` isn't instantly re-killed) and note
      # what the stopped run cost, so the card stays honest without ever going blocked.
      $VINTASK update "$TID" --unkill --progress "⏸ held by Lord Vinta — agent stopped at ${FTOK:-0} tokens, progress kept; resume to continue" >/dev/null 2>&1
      log "iter $i — [$TID] HELD (paused) by Vinta — left paused + resumable (${FTOK:-0} tokens), status untouched"
    elif [ "$KILLED" = "settled" ]; then
      # The owner cancelled it (or it finished elsewhere). Leave the terminal status
      # exactly as they set it — do NOT blocked-stamp a deliberate cancel. Just note
      # what it cost before we caught it, so the board tells the truth.
      $VINTASK update "$TID" --progress "agent terminated: task was ${LSTAT} mid-flight (stopped at ${FTOK:-0} tokens)" >/dev/null 2>&1
      log "iter $i — [$TID] left as $LSTAT after mid-flight stop (${FTOK:-0} tokens)"
    elif [ "$KILLED" = "stall" ]; then
      # A wedge is transient (polling loop, dead monitor) — not a real blocker.
      # Bump attempts; reopen for a fresh try, unless it has already stalled out
      # its attempts cap, in which case surface to Vinta rather than loop forever.
      # FREEZE-FIX 2026-08-14: this used to read `attempts`, but `reopen` zeroes
      # `attempts` — so the >=3 cap could NEVER be reached and a wedged task
      # reopened forever (140 stall/reopen cycles + 65 zombie routers observed,
      # load avg 12 on 8 cores). Count stalls in `stall_attempts`, which reopen
      # deliberately preserves, so the cap actually bites.
      SATT="$($VINTASK show "$TID" --field stall_attempts 2>/dev/null || echo 0)"
      case "$SATT" in ''|*[!0-9]*) SATT=0 ;; esac
      SATT=$((SATT + 1))
      $VINTASK update "$TID" --set-stall-attempts "$SATT" >/dev/null 2>&1
      if [ "$SATT" -ge 3 ] 2>/dev/null; then
        # The reason line must describe what we ACTUALLY observed. It used to assert
        # "provider produced no tokens" and send Vinta to check ollama/model pulls —
        # but under the 8VPGK77 bug that sentence was simply false (the provider had
        # produced hundreds of thousands of tokens; only the meter read zero), so it
        # pointed him at a healthy provider five separate times. Report the measured
        # facts and let them speak.
        $VINTASK update "$TID" --status blocked --reason "wedged/stalled ${STALL_SECS}s with no measurable progress across ${SATT} stall attempts (last run: ${FTOK:-0} tokens, ${LAST_EV:-0} stream events) — needs human review; if the stream shows real work, the agent was likely wedged in a polling loop rather than the provider being down. Resume with \`vintask unstall $TID\`." >/dev/null 2>&1
        log "iter $i — [$TID] BLOCKED after ${SATT} stalls (loop guard) — not reopening"
      else
        $VINTASK reopen "$TID" >/dev/null 2>&1
        log "iter $i — reopened [$TID] after stall (stall attempt ${SATT}/3)"
      fi
    else
      # BUDGET OUTAGE, not a failure (task KUMRT35). This used to write a plain
      # `blocked`, which was a trap: the ceiling that killed the task is still in
      # place, so hitting Reopen re-queued it into another instant failstop — the
      # task looked un-continuable and quietly burned an attempt each round. Marking
      # it as a `budget` outage lets the card offer Continue, which grants fresh
      # headroom ON TOP of what was already spent so the resumed run can finish.
      $VINTASK outage "$TID" budget "failstop: token budget $BUDGET exhausted at ${FTOK:-0} — needs more headroom to finish" >/dev/null 2>&1
    fi
    oracle_log_tokens "$ROUTE" "${FTOK:-0}"   # G7E4RF2: no failover ran, $ROUTE == the model that executed
    sleep 2; continue
  fi

  # ── CROSS-VENDOR FAILOVER (AZGKUMK 2026-08-14) — "no failure allowed" ───────
  # Before this block, a credit/usage outage parked the seat for up to TWO HOURS
  # waiting for Anthropic to come back. That was the only option when Anthropic was
  # the only vendor. It no longer is: if Codex/Grok/Gemini/local can do this work,
  # waiting is a choice to be down. So on a provider-level failure we walk the
  # router's ladder to the NEXT VENDOR and re-run the same task, and only fall
  # through to the credit-wait if the entire ladder is exhausted.
  #
  # WHAT COUNTS AS A FAILOVER TRIGGER: provider-level failures only — credit/usage
  # limits, auth, 429/5xx, "never ran". NOT a task the agent legitimately finished,
  # and NOT killswitch/cancel/budget/stall (those are handled above and `continue`
  # before reaching here) — retrying those on another vendor would burn a second
  # wallet on work Vinta deliberately stopped or that is genuinely too big.
  #
  # The hop is bounded by max_failover_hops from providers.json (default 6) so a
  # systemically broken task cannot walk every vendor on the planet.
  if [ -n "$PLAN_JSON" ] && [ -z "$KILLED" ]; then
    FAILED_OVER=""
    # SAWPNWX: remembers the weakest rung we were forced onto and whether it was
    # below the task's capability floor, so an exhausted chain can name its cause.
    BELOW_FLOOR_MODEL=""; BELOW_FLOOR_TIER=""; LADDER_EXHAUSTED=""
    # 897WZ7N 2026-10-27: colon-delimited set of providers that have ALREADY
    # failed with a real usage/credit/auth outage SOMEWHERE in this chain — not
    # just "different from the immediately-previous rung" (DUBHNJY's scan-ahead
    # below only compares against the one provider that just failed). Without
    # this, a ladder that cycles back to an already-outaged vendor later on
    # (e.g. [anthropic, openai, anthropic] with both anthropic and openai
    # locked out) would see anthropic as "different from openai" and retry the
    # exact account that already failed, instead of recognizing the whole
    # ladder is exhausted and deferring to the credit-outage guard.
    UNAVAILABLE_PROVIDERS=""
    # 897WZ7N: counts real launches only (the primary rung is attempt 1), so
    # skipped-ahead ladder positions never eat into the attempt-cap budget.
    ATTEMPTS_RUN=1
    HOP=1
    while :; do
      # Provider-level failure? (either the CLI itself errored, or the text says outage)
      PROVIDER_FAILED=""
      # XPY68KN 2026-08-19: the raw stream MUST be part of the evidence. Codex/Gemini
      # emit their fatal {"type":"error","message":"...usage limit..."} ONLY into the
      # raw jsonl — it never reaches $OUT or $TASK_LOG. Classifying on those two alone
      # saw empty text with rc=0, returned "ok", skipped failover, and killed the seat
      # 10s after launch (seats.json down_reason=driver-exit). Reading the raw tail too
      # lets classifyFailure see the real error and hop vendors as designed.
      FAIL_TEXT="$(current_attempt_evidence | tail -200)"
      PROVIDER_FAILED="$(printf '%s' "$FAIL_TEXT" | classify_provider_failure "$RC")"
      if [ -z "$PROVIDER_FAILED" ] && [ "$RC" -ne 0 ] && [ "$RC" -ne 124 ]; then
        PROVIDER_FAILED="capability"
      fi
      [ -z "$PROVIDER_FAILED" ] && break
      record_provider_outcome "$PROVIDER" false "$PROVIDER_FAILED on ${PROVIDER}/${ROUTE}" "$ROUTE" "${FLOOR_KIND:-general}"
      # 897WZ7N: a real usage/credit/auth outage marks the WHOLE account down —
      # remember it so a later rung never retries the same locked-out provider.
      if printf '%s' "$FAIL_TEXT" | "$NODE_BIN" "$ROOT/lib/outage-signal.js" 2>/dev/null | grep -q "^OUTAGE:"; then
        case "${UNAVAILABLE_PROVIDERS}:" in
          *":${PROVIDER}:"*) ;;
          *) UNAVAILABLE_PROVIDERS="${UNAVAILABLE_PROVIDERS}:${PROVIDER}" ;;
        esac
      fi

      NEXT="$(printf '%s' "$PLAN_JSON" | HOP="$HOP" $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);const h=+process.env.HOP||1;const r=(p.ladder||[])[h];if(!r){console.log("")}else console.log([r.provider,r.model,r.tier].join(" "))}catch{console.log("")}})' 2>/dev/null)"
      [ -z "$NEXT" ] && { LADDER_EXHAUSTED="yes"; log "iter $i — [$TID] ladder exhausted after $HOP hop(s) — no vendor left to try"; break; }

      NPROV="$(printf '%s' "$NEXT" | cut -d' ' -f1)"
      NMODEL="$(printf '%s' "$NEXT" | cut -d' ' -f2)"
      NTIER="$(printf '%s' "$NEXT" | cut -d' ' -f3)"

      # WADGY4E 2026-10-06, FIXED DUBHNJY 2026-10-26: a credit/usage/SESSION-limit
      # outage is an ACCOUNT/window wall, not a per-model weakness — retrying a
      # DIFFERENT MODEL of the SAME provider just re-hits the identical 429. Walking
      # opus→fable→sonnet→haiku all on Anthropic burned four rungs and then
      # mislabeled the result "capability exhausted", blocking the card (and a
      # crash_attempt). So if this failure is a real usage outage, SKIP over all
      # same-vendor rungs to find the first DIFFERENT vendor. Only if the ENTIRE
      # remaining ladder is the same vendor, defer to the CREDIT-OUTAGE GUARD below
      # (pause + auto-resume). The original WADGY4E logic broke on the FIRST
      # same-vendor rung, which prevented cross-vendor failover when the ladder held
      # non-Anthropic providers further down (e.g. xai, openai, google). The fix:
      # walk past all same-vendor rungs, try the first different one.
      # 897WZ7N: also re-scan when the naive NEXT above already points at a
      # provider that failed with a real outage EARLIER in this same chain
      # (tracked in UNAVAILABLE_PROVIDERS), even if THIS attempt's own failure
      # was a different kind (e.g. capability) — a ladder that cycles back to
      # an account we already know is down must not retry it.
      _nprov_already_unavailable=0
      case "${UNAVAILABLE_PROVIDERS}:" in
        *":${NPROV}:"*) _nprov_already_unavailable=1 ;;
      esac
      if [ "$_nprov_already_unavailable" -eq 1 ] || printf '%s' "$FAIL_TEXT" | "$NODE_BIN" "$ROOT/lib/outage-signal.js" 2>/dev/null | grep -q "^OUTAGE:"; then
        # Find the first rung whose provider is BOTH different from the one that
        # just failed AND not already marked unavailable earlier in this same
        # chain (897WZ7N — see UNAVAILABLE_PROVIDERS above). A provider that
        # already failed with a real outage stays skipped even if the ladder
        # cycles back to it later.
        DIFF_PROV_HOP=""
        _check_hop="$HOP"
        while [ "$_check_hop" -lt "${MAX_HOPS:-6}" ]; do
          _check_next="$(printf '%s' "$PLAN_JSON" | HOP="$_check_hop" $NODE_BIN -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const p=JSON.parse(d);const h=+process.env.HOP||1;const r=(p.ladder||[])[h];if(!r){console.log("")}else console.log([r.provider,r.model,r.tier].join(" "))}catch{console.log("")}})' 2>/dev/null)"
          [ -z "$_check_next" ] && break
          _check_prov="$(printf '%s' "$_check_next" | cut -d' ' -f1)"
          _check_skip=0
          [ "$_check_prov" = "$PROVIDER" ] && _check_skip=1
          case "${UNAVAILABLE_PROVIDERS}:" in
            *":${_check_prov}:"*) _check_skip=1 ;;
          esac
          if [ "$_check_skip" -eq 0 ]; then
            DIFF_PROV_HOP="$_check_hop"
            break
          fi
          _check_hop=$((_check_hop+1))
        done

        if [ -z "$DIFF_PROV_HOP" ]; then
          # No different provider found in remaining ladder — defer to credit-outage guard
          log "iter $i — [$TID] usage/credit outage on ${PROVIDER}; entire remaining ladder is ${PROVIDER} — deferring to credit-outage guard (pause + auto-resume)"
          break
        else
          # Found a different provider — skip to it
          _skipped_count=$((_check_hop - HOP))
          log "iter $i — [$TID] usage/credit outage on ${PROVIDER}; skipping $_skipped_count same-vendor rung(s) to reach $(printf '%s' "$_check_next" | cut -d' ' -f1)"
          HOP="$DIFF_PROV_HOP"
          NEXT="$_check_next"
          NPROV="$(printf '%s' "$NEXT" | cut -d' ' -f1)"
          NMODEL="$(printf '%s' "$NEXT" | cut -d' ' -f2)"
          NTIER="$(printf '%s' "$NEXT" | cut -d' ' -f3)"
        fi
      fi

      log "iter $i — [$TID] ⤳ FAILOVER hop $HOP ($PROVIDER_FAILED on ${PROVIDER}/${ROUTE}) → ${NPROV}/${NMODEL} [${NTIER}]"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⤳ FAILOVER ${PROVIDER}/${ROUTE} → ${NPROV}/${NMODEL} (${PROVIDER_FAILED})" >> "$TASK_LOG"
      # Breadcrumb INTO the raw log so the live view explains the change of voice
      # instead of looking like the agent restarted itself for no reason.
      printf '%s\n' "{\"type\":\"__router_note\",\"note\":\"[router] ${PROVIDER}/${ROUTE} failed (${PROVIDER_FAILED}) — failing over to ${NPROV}/${NMODEL}\"}" >> "$RAW_LOG"
      $VINTASK update "$TID" --progress "failover → ${NPROV}/${NMODEL} (${PROVIDER_FAILED} on ${PROVIDER})" >/dev/null 2>&1

      # SAWPNWX: note when this hop drops the work BELOW the tier the router said
      # it needs. We still RUN the rung (a weak answer beats none) — we just stop
      # forgetting that we did, so an exhausted chain reports the real reason.
      if below_floor "$NTIER" "$FLOOR_TIER"; then
        BELOW_FLOOR_MODEL="${NPROV}/${NMODEL}"; BELOW_FLOOR_TIER="$NTIER"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ below capability floor — ${NPROV}/${NMODEL} is ${NTIER}, this task needs ${FLOOR_TIER}" >> "$TASK_LOG"
      fi
      PROVIDER="$NPROV"; ROUTE="$NMODEL"; TIER="$NTIER"
      # (2026-09-25, CORRECTED 2026-09-26) RE-RECORD after failover, still without
      # pinning. Observed on real cards 5DHUGET / 7RZB2DZ / Q4BQZ95 / TAZ6676: each
      # was stamped model=gpt-6-astra, yet its raw log shows OpenAI turn.failed with
      # ZERO __router_usage lines and 300-400 Anthropic events. The tokens were
      # Anthropic's, earned after failover; the card named the model that only ever
      # FAILED. So the card must name the model that ACTUALLY ran — but as
      # accounting (ran_*), never as a pin. See the note at the initial stamp.
      $VINTASK update "$TID" --ran-provider "$PROVIDER" --ran-model "$ROUTE" >/dev/null 2>&1
      case "$ROUTE" in
        claude-opus-5)     FALLBACK="claude-opus-4-8" ;;
        claude-opus-4-8)   FALLBACK="claude-sonnet-4-5" ;;
        claude-sonnet-4-5) FALLBACK="claude-haiku-4-5" ;;
        *)                 FALLBACK="claude-haiku-4-5" ;;
      esac

      # PR-D: a failover hop is a retry on a different brain — gate it first.
      if [ -f "$BIN/verify-diff.js" ] && [ "${COUNCIL_VERIFY_DIFF:-1}" != "0" ]; then
        GATE_LINE="$(timeout 20 "$NODE_BIN" "$BIN/verify-diff.js" gate --task "$TID" 2>/dev/null)"
        if [ $? -eq 3 ]; then
          $VINTASK block "$TID" "STRUCTURAL REGRESSION ×$(printf '%s' "$GATE_LINE" | cut -f2) — failover to ${PROVIDER}/${ROUTE} refused: $(printf '%s' "$GATE_LINE" | cut -f3- | head -c 300)" >/dev/null 2>&1
          log "iter $i — ⛔ STRUCTURAL GATE refused failover hop [$TID]"
          KILLED="structural"; break
        fi
      fi
      DIFF_BASE="$(git -C "$WORKTREE" rev-parse HEAD 2>/dev/null)"
      launch_rung "$PROVIDER" "$ROUTE"
      # Re-watch the new rung with the same failstops. Deliberately a lean watcher:
      # the killswitch/cancel/budget checks below mirror the main loop so a failed-over
      # run is exactly as interruptible and as bounded as the first attempt.
      while kill -0 "$AGENT_PID" 2>/dev/null; do
        sleep 5
        USAGE="$($NODE_BIN "$BIN/parse-usage.js" "$RAW_LOG" 2>/dev/null || echo "0 0")"
        TOK="${USAGE%% *}"; COST="${USAGE##* }"
        # Only write when the meter moved (UGETFAG): every update rewrites + fsyncs the
        # whole 3.2MB tasks.jsonl, and an unchanged value every 5s x every seat was the
        # top writer on the root VHDX (tracefs: ~27 rewrites / 30s). It is also the claim
        # heartbeat (updated_at), so an unchanged value is still re-sent every 60s.
        if [ "${TOK:-0} ${COST:-0}" != "${_TOK_SENT:-}" ] || [ $((SECONDS - ${_TOK_AT:-0})) -ge 60 ]; then
          $VINTASK update "$TID" --tokens "${TOK:-0}" --cost "${COST:-0}" >/dev/null 2>&1 && { _TOK_SENT="${TOK:-0} ${COST:-0}"; _TOK_AT=$SECONDS; }
        fi
        $NODE_BIN "$BIN/extract-text.js" "$RAW_LOG" 2>/dev/null > "$TASK_LOG.live" && \
          { head -1 "$TASK_LOG" > "$TASK_LOG.tmp" 2>/dev/null; cat "$TASK_LOG.live" >> "$TASK_LOG.tmp" 2>/dev/null; mv "$TASK_LOG.tmp" "$TASK_LOG" 2>/dev/null; }
        KFLAG="$($VINTASK show "$TID" --field kill 2>/dev/null)"
        if [ "$KFLAG" = "true" ]; then
          stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
          KILLED="killswitch"; break
        fi
        LSTAT="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
        if [ "$LSTAT" = "cancelled" ] || [ "$LSTAT" = "done" ]; then
          stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
          KILLED="settled"; break
        fi
        # BUDGET WARN-ONLY on failover rungs too (2026-08-17, option b). A failover
        # run is already a recovery attempt; killing it on an advisory ceiling turns
        # one dead vendor into a dead task.
        if [ -n "${TOK:-}" ] && [ "${TOK:-0}" -gt "$BUDGET" ] 2>/dev/null; then
          if [ "${COUNCIL_BUDGET_HARD:-0}" = "1" ]; then
            stop_agent   # group-kill: reaches claude + every subagent (SBKWSRS)
            KILLED="budget"; break
          fi
          if [ -z "${BUDGET_WARNED:-}" ]; then
            BUDGET_WARNED=1
            echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ over advisory token budget $BUDGET at $TOK (failover rung) — continuing" >> "$TASK_LOG"
          fi
        fi
      done
      wait "$AGENT_PID" 2>/dev/null; RC=$?
      AGENT_PID=""   # reaped — clear so the EXIT trap never targets a recycled pid (SBKWSRS)
      OUT="$($NODE_BIN "$BIN/extract-text.js" "$RAW_LOG" 2>/dev/null)"
      FUSAGE="$($NODE_BIN "$BIN/parse-usage.js" "$RAW_LOG" 2>/dev/null || echo "0 0")"
      FTOK="${FUSAGE%% *}"; FCOST="${FUSAGE##* }"
      $VINTASK update "$TID" --tokens "${FTOK:-0}" --cost "${FCOST:-0}" >/dev/null 2>&1
      verify_attempt
      # Book this failover rung too when it was an Anthropic one (7RZB2DZ). Keyed
      # by HOP so each rung of a failed-over task books exactly once.
      if [ "$PROVIDER" = "anthropic" ]; then
        _bk_ok=false; [ "${RC:-1}" -eq 0 ] && _bk_ok=true
        "$NODE_BIN" "$BIN/book-anthropic-spend.js" "$RAW_LOG" "$TID" "$ROUTE" \
          "${FLOOR_KIND:-general}" "$_bk_ok" "hop${HOP:-0}" >/dev/null 2>&1 || true
      fi
      FAILED_OVER="yes"
      [ -n "$KILLED" ] && break
      HOP=$((HOP+1))
      # 897WZ7N 2026-10-27: the ceiling must bound REAL attempts, not ladder
      # POSITION. The scan-ahead above can jump HOP forward by several rungs in
      # one step to skip already-unavailable providers, so a 5-same-vendor-rung
      # ladder reached HOP=6 after only its 2nd real launch and hit this ceiling
      # before ever trying the vendor that was actually available. ATTEMPTS_RUN
      # counts launches, never skips, so skipped rungs stay free.
      ATTEMPTS_RUN=$((${ATTEMPTS_RUN:-1}+1))
      [ "$ATTEMPTS_RUN" -ge "${MAX_HOPS:-6}" ] && { log "iter $i — [$TID] hit max provider attempts ($ATTEMPTS_RUN)"; break; }
    done
    if [ -n "$FAILED_OVER" ] && [ "$RC" -eq 0 ]; then
      # Same evidence rule on the recovery path — a failover that "recovered" into
      # narration is not a recovery, and must not teach the router that it was.
      _ev_tools2="$(grep -c '"tool_use"\|"function_call"\|"tool_call"\|"local_shell_call"\|"exec_command"\|"shell_call"' "$RAW_LOG" 2>/dev/null | tr -cd '0-9' || true)"
      _ev_tools2="${_ev_tools2:-0}"
      # UD7EJ4Y: every SEAT card needs tools (vintask + turn-schema emit are tool
      # calls), so bulk/speed are no longer exempt — narration on them is a failure.
      _ev_needs2=1
      if [ "$_ev_needs2" = "1" ] && [ "${_ev_tools2:-0}" -eq 0 ] 2>/dev/null; then
        record_provider_outcome "$PROVIDER" false "narrated after failover: 0 tool calls" "$ROUTE" "${FLOOR_KIND:-general}"
        record_exec_evidence "$PROVIDER" false
      else
        record_provider_outcome "$PROVIDER" true "recovered after failover (${_ev_tools2} tool calls)" "$ROUTE" "${FLOOR_KIND:-general}"
        record_exec_evidence "$PROVIDER" true
      fi
      log "iter $i — [$TID] ✅ recovered via failover on ${PROVIDER}/${ROUTE}"
      echo "[$(date -Iseconds)] [$AGENT_ID] ✅ recovered on ${PROVIDER}/${ROUTE} after failover" >> "$TASK_LOG"
    elif [ -z "$FAILED_OVER" ] && [ "$RC" -eq 0 ] && [ -z "$KILLED" ]; then
      # PRIMARY-RUNG SUCCESS (2026-09-17). Before this branch, per-model history
      # only got written on failovers/recoveries (lines above). Tasks that
      # succeeded on the first rung — the common case for a healthy fleet — were
      # invisible to the learner: 24h of steady traffic yielded zero recordings
      # because the shim was only ever reached from the failure path. Now we
      # also record the primary rung's success, so healthy Opus 5 traffic
      # accrues evidence that keeps its per-(kind × model) score honest and lets
      # dynamic-affinity.js hit its 20-samples-per-kind guardrail from real work
      # instead of only from crashes.
      # ── EVIDENCE MUST MEAN EXECUTION, NOT A CLEAN EXIT (Vinta 2026-09-26) ──
      # Vinta: "i want a fucking intelligent routing system entirely" — option (c),
      # let honest evidence drive routing. This line was the poison pump: the ONLY
      # test above is `RC -eq 0`, i.e. the process exited cleanly. A model that
      # NARRATES the work ("Running searches now…") and exits 0 scored a win here.
      # That is how xai/grok-build-0.1 accrued 78 ok / 2 fail on kind=code while
      # executing ZERO tool calls, which then made evidence-based routing rank it
      # 96.6% vs anthropic 25% and send every task on the board to it.
      #
      # A learner is only as good as its reward signal. So the reward is now
      # EXECUTION: tool calls present in the raw stream. Measured baseline across
      # 484 real logs — anthropic 430/430 runs executed, google 3/28, openai 3/8,
      # xai 0/18. Narration is recorded as a FAILURE, which is what it is.
      #
      # Kinds that legitimately need no tools (a drafted post, an explanation) are
      # exempt: for those, a clean exit IS the deliverable.
      _ev_tools="$(grep -c '"tool_use"\|"function_call"\|"tool_call"\|"local_shell_call"\|"exec_command"\|"shell_call"' "$RAW_LOG" 2>/dev/null | tr -cd '0-9' || true)"
      _ev_tools="${_ev_tools:-0}"
      # UD7EJ4Y: every SEAT card needs tools (vintask + turn-schema emit are tool
      # calls), so bulk/speed are no longer exempt — narration on them is a failure.
      _ev_needs_tools=1
      if [ "$_ev_needs_tools" = "1" ] && [ "${_ev_tools:-0}" -eq 0 ] 2>/dev/null; then
        record_provider_outcome "$PROVIDER" false "narrated: exited 0 with 0 tool calls on an execution kind" "$ROUTE" "${FLOOR_KIND:-general}"
        record_exec_evidence "$PROVIDER" false
        log "iter $i — [$TID] ⚠ evidence: ${PROVIDER}/${ROUTE} exited 0 but executed NOTHING (0 tool calls, kind=${FLOOR_KIND:-general}) — recorded as a FAILURE so routing learns the truth"
      else
        record_provider_outcome "$PROVIDER" true "primary-success (${_ev_tools} tool calls)" "$ROUTE" "${FLOOR_KIND:-general}"
        record_exec_evidence "$PROVIDER" true
      fi
    fi
    # ── CAPABILITY EXHAUSTED — RECORD IT, NEVER EXIT SILENT (SAWPNWX 2026-08-21) ──
    # The zero-failure contract guarantees the ladder always TERMINATES in something
    # that can physically run. It never guaranteed that rung is smart enough. When
    # tier descent + the local $0 floor put the work on a model BELOW the tier the
    # router said it needs, and that rung fails too, the loop used to just `break`
    # with RC!=0 — and the seat fell through to the generic
    # "agent exited without recording a result" handler. Cards 9AA3ZBZ and SBKWSRS
    # both died exactly there: their last breath was "failover → ollama/qwen3:0.6b
    # (capability on anthropic)" and the board was handed a blocked card with no
    # actionable reason, while the real cause — every capable vendor was unreachable
    # and a 0.6B model cannot do L3 work — was sitting in the log nobody reads.
    # So: name it. A blocked card that says WHY is retryable by the council the
    # moment a real brain is reachable again; a mystery one is dead weight.
    # The below-floor descent is the COMMON shape, but not the only one: a chain can
    # also exhaust while still sitting AT the floor (unknown/legacy tiers, or a floor
    # of L0), and that is just as unrecorded a death. Either way the honest answer is
    # the same — every vendor we could reach failed — so both shapes record a block.
    if [ -z "$KILLED" ] && [ -n "$FAILED_OVER" ] && [ "$RC" -ne 0 ] \
       && { [ -n "$BELOW_FLOOR_MODEL" ] || [ -n "$LADDER_EXHAUSTED" ]; }; then
      # WADGY4E 2026-10-06: a chain that exhausted because every reachable rung hit a
      # usage/credit/session-limit OUTAGE is NOT capability exhaustion. Blocking it
      # burns a crash_attempt and hides the real cause (the account's 5h window). If
      # the accumulated failure text reads as a real outage, defer to the CREDIT-
      # OUTAGE GUARD below — it pauses, polls credit-probe, and auto-resumes without
      # spending an attempt. Only a genuine capability wall falls through to `block`.
      CAP_OUTAGE_TEXT="$(current_attempt_evidence | tail -300)"
      if printf '%s' "$CAP_OUTAGE_TEXT" | "$NODE_BIN" "$ROOT/lib/outage-signal.js" 2>/dev/null | grep -q "^OUTAGE:"; then
        log "iter $i — [$TID] chain exhausted but the cause is a usage/credit OUTAGE, not capability — deferring to credit-outage guard (pause + auto-resume), not blocking"
      else
      CAP_TOK="${FTOK:-0}"
      if [ -n "$BELOW_FLOOR_MODEL" ]; then
        CAP_WHY="provider capability exhausted: fell to ${BELOW_FLOOR_MODEL} (${BELOW_FLOOR_TIER}), below the ${FLOOR_TIER} floor for this ${FLOOR_KIND:-task} work"
      else
        CAP_WHY="provider capability exhausted: every reachable vendor failed on this ${FLOOR_KIND:-task} work; last rung tried was ${PROVIDER}/${ROUTE}"
      fi
      if [ -n "$LADDER_EXHAUSTED" ]; then
        CAP_WHY="$CAP_WHY — every rung on the ladder was tried and the chain bottomed out"
      else
        CAP_WHY="$CAP_WHY — stopped at the ${MAX_HOPS:-6}-hop ceiling"
      fi
      CAP_WHY="$CAP_WHY. Retry when a capable vendor is reachable (check credits/auth), or pin a model: node vintask.js update $TID --model <model>. Log: $LOG"
      log "iter $i — ⛔ CAPABILITY EXHAUSTED [$TID] — ${BELOW_FLOOR_MODEL} (${BELOW_FLOOR_TIER}) is below the ${FLOOR_TIER} floor; recording block instead of exiting unrecorded"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ capability exhausted — ${BELOW_FLOOR_MODEL} is ${BELOW_FLOOR_TIER}, this ${FLOOR_KIND:-task} work needs ${FLOOR_TIER}. Blocking with a reason rather than dying silent." >> "$TASK_LOG"
      $VINTASK update "$TID" --progress "capability exhausted — fell to ${BELOW_FLOOR_MODEL} (${BELOW_FLOOR_TIER}), below the ${FLOOR_TIER} floor" >/dev/null 2>&1
      # A report the dying rung already wrote is worth rescuing — same as the
      # unrecorded-exit path does, so an exhausted chain never loses real work.
      CAP_DOC=""
      for d in "$STATE/docs/$TID"-*.md; do [ -f "$d" ] && CAP_DOC="$d"; done
      if [ -n "$CAP_DOC" ]; then
        $VINTASK block "$TID" "$CAP_WHY" --doc "$CAP_DOC" >/dev/null 2>&1 || $VINTASK block "$TID" "$CAP_WHY" >/dev/null 2>&1
      else
        $VINTASK block "$TID" "$CAP_WHY" >/dev/null 2>&1
      fi
      oracle_log_tokens "$ROUTE" "${FTOK:-0}"   # G7E4RF2: $ROUTE == the last (weakest) rung actually tried
      sleep 2; continue
      fi   # WADGY4E: close the outage-defer / capability-block branch
    fi

    # A failover that got killed mid-flight must honor the kill, exactly like a first run.
    if [ -n "$KILLED" ]; then
      if [ "$KILLED" = "killswitch" ]; then
        $VINTASK update "$TID" --status blocked --reason "stopped by Vinta via killswitch at ${FTOK:-0} tokens" --unkill >/dev/null 2>&1
      elif [ "$KILLED" = "budget" ]; then
        $VINTASK outage "$TID" budget "failstop: token budget $BUDGET exhausted at ${FTOK:-0} — needs more headroom to finish" >/dev/null 2>&1
      elif [ "$KILLED" = "runaway" ]; then
        # A runaway is NOT an outage — more headroom would only let it burn more.
        # `block` counts the crash (crash_attempts) so the 3-try cap can end the loop.
        $VINTASK block "$TID" "RUNAWAY: burned ${FTOK:-0} tokens (${RUNAWAY_MULT:-4}x the $BUDGET budget) without recording a result. This task loops instead of landing — it needs a smaller scope, not more tokens. Reset with: vintask unstall $TID" >/dev/null 2>&1
      fi
      oracle_log_tokens "$ROUTE" "${FTOK:-0}"   # G7E4RF2: killed mid-failover — $ROUTE == the rung running when killed
      sleep 2; continue
    fi
  fi

  # CREDIT-OUTAGE GUARD: if the model was out of credits / hit session limit, the
  # agent never ran — do NOT falsely flag the task needs-human. Return it to the
  # queue untouched and PAUSE this seat (sleep) until credits reset, instead of
  # burning the whole queue into needs-human noise (the exact failure Vinta saw).
  # XPY68KN 2026-08-19: same raw-log blindness as the failover classifier above.
  # A codex/gemini usage-limit error exists ONLY in the raw jsonl, so grepping $OUT
  # alone missed it and the seat fell through to exit instead of pausing + auto-resuming.
  OUTAGE_TEXT="$(current_attempt_evidence | tail -200)"
  # RRQJ5RU 2026-08-19 — the grep that used to live here read the RAW JSON STREAM
  # as if it were prose, and its `rate.?limit.*reset` arm matched Anthropic's
  # routine health frame {"subtype":"rate_limit_event","rate_limit_info":{"status":
  # "allowed","reset...}}. A frame whose payload literally says "allowed" stopped the
  # seat: observed live the same day (b2qkeu → "⏸ OUTAGE" → "✅ RESTORED after 0s").
  # The council stopped itself on good news. Detection now goes through
  # lib/outage-signal.js, which parses frames, throws out anything reporting a
  # healthy status, ignores agent prose, and only fires on a real fatal error.
  # Covered by bin/verify-false-outage-RRQJ5RU.js.
  OUTAGE_VERDICT="$(printf '%s' "$OUTAGE_TEXT" | "$NODE_BIN" "$ROOT/lib/outage-signal.js" 2>/dev/null || true)"
  # 897WZ7N 2026-10-27 FIX: $OUT and $RAW_LOG are accumulated across the WHOLE
  # task, including every earlier failed rung, not just the one that just ran.
  # So after a Claude lockout successfully fails over to a different vendor
  # (RC=0, "recovered via failover" a few dozen lines above — it falls through
  # to here with no `continue`), the stale "usage limit" text from the FIRST,
  # failed rung was still sitting in that window and got reclassified as a
  # live outage — pausing the seat on a task that had already succeeded, and
  # never recording its real result. The guard below only pauses for credits
  # when the run actually did NOT succeed; a successful recovery (RC=0) is a
  # completed task, never a stall, no matter what an earlier rung's error text
  # said. Covered by task-artifacts/897WZ7N/verify-failover.py.
  if [ "${RC:-1}" -ne 0 ] && printf '%s' "$OUTAGE_VERDICT" | grep -q "^OUTAGE:"; then
    log "iter $i — ⏸ CREDIT/USAGE OUTAGE detected (${OUTAGE_VERDICT#OUTAGE: }) — marking [$TID] outage-stalled, waiting for usage to restore"
    # J3ZZF9Q — every outage is a lockout on that platform; write it to the
    # all-platform ledger (idempotent across seats: N seats → one start row).
    "$NODE_BIN" "$ROOT/lib/lockout-ledger.js" start --provider "${PROVIDER:-anthropic}" --model "${ROUTE:-}" \
      --kind outage --reason "${OUTAGE_VERDICT#OUTAGE: }" --seat "$AGENT_ID" --task "$TID" --source driver >/dev/null 2>&1 || true
    # MARK, don't erase (task KUMRT35). This used to call `reopen`, which nulls
    # blocked_reason and drops the task to plain `todo` — making an outage-stalled
    # task byte-identical to normal queued work. Vinta could not tell what the outage
    # ate, and the board had nothing to hang a Continue button off of. `outage` records
    # it as evidence (kind/tokens/percent/prev status) WITHOUT burning an attempt, so
    # the card can offer a real one-click resume. Auto-resume below still works: the
    # continue is issued the moment the probe says usage is back.
    $VINTASK outage "$TID" credits "Claude unavailable (${OUTAGE_VERDICT#OUTAGE: }) — agent never ran (seat $AGENT_ID)" >/dev/null 2>&1
    echo "[$(date -Iseconds)] [$AGENT_ID] ⏸ paused — out of credits, auto-resuming when usage restores" >> "$TASK_LOG"
    # AUTO-RESUME ON RESTORE (Vinta 2026-08-08: "recognize usage has been restored").
    # Instead of a blind 5-min sleep, POLL the cheap credit probe every 60s. The
    # instant it says credits are live again, break and let the loop re-claim — so
    # the council recovers on its own the moment the outage lifts, without a click.
    # (Still honors STOP so a manual halt during an outage stays halted.)
    PROBE="$ROOT/bin/credit-probe.sh"
    waited=0
    while :; do
      [ -f "$STOP" ] && { log "iter $i — STOP during credit wait — halting."; break 2; }
      # Keep the probe's own verdict (5VD8U2V follow-up): it distinguishes
      # CREDITS_OK (free subscription recovered) from CREDITS_OK_VIA_API (we are now
      # drawing on the paid Console balance). That is a billing-relevant event, and
      # discarding it to /dev/null meant the log could never say which wallet resumed
      # the council. The lane itself is persisted by the probe via lib/anthropic-lane.js.
      # NOTE: the probe's status must be read WITHOUT a pipe. `$(probe | tail -1)`
      # yields the PIPELINE's status, which is tail's — always 0 — so the loop would
      # declare usage restored on its very first poll, every time. Capture, then trim.
      _probe_out=""; _probe_rc=1
      if [ -x "$PROBE" ]; then
        _probe_out="$(bash "$PROBE" 2>/dev/null)"
        _probe_rc=$?
      fi
      if [ "$_probe_rc" -eq 0 ]; then
        log "iter $i — ✅ usage RESTORED after ${waited}s [$(printf '%s' "$_probe_out" | tail -1)] — continuing [$TID]"
        "$NODE_BIN" "$ROOT/lib/lockout-ledger.js" end --provider "${PROVIDER:-anthropic}" --source driver >/dev/null 2>&1 || true
        echo "[$(date -Iseconds)] [$AGENT_ID] ▶ usage restored — continuing" >> "$TASK_LOG"
        # The task is now `blocked` with an outage marker (see above), so it is NOT
        # claimable — the loop would spin past it forever. `continue` clears the marker
        # into history, restores it to todo at the front of the queue, and preserves the
        # percent it had reached. Same code path the board's Continue button calls, so
        # automatic recovery and a manual click behave identically.
        $VINTASK continue "$TID" >/dev/null 2>&1
        break
      fi
      sleep 60; waited=$((waited+60))
      # Safety ceiling: after 2h of probing, loop anyway (a claim attempt is cheap and
      # will just re-pause if still out) so a wedged probe never traps the seat forever.
      [ "$waited" -ge 7200 ] && { log "iter $i — credit-wait ceiling (2h) — looping to retry"; break; }
    done
    oracle_log_tokens "$ROUTE" "${FTOK:-0}"   # G7E4RF2: no-op when the agent never ran (FTOK 0); posts $ROUTE if work was burned before the outage
    continue
  fi

  # ── ORACLE TOKEN EVENT — WINNING RUNG (G7E4RF2) ─────────────────────────────
  # Every path that reaches here RAN to completion (primary success, or a
  # recovered failover): $ROUTE and $FTOK now hold the FINAL executed model and
  # its cumulative token count, so this is the one place the task's winning rung
  # is known. Post it exactly once. The terminal-exit paths above (killed,
  # capability-exhausted, credit-outage) each post their own with the rung they
  # died on; none of them fall through to here, so there is no double-post.
  oracle_log_tokens "$ROUTE" "${FTOK:-0}"

  # safety net: if the agent forgot to record status, decide from its output/status.
  # Read the STATUS FIELD OFF THE RECORD — never scrape `list` output. The old line
  # grepped colorized, human-formatted `list` text for the first status-looking word
  # on the matching line, which is wrong the moment a task's TITLE contains one of
  # those words (several cards have GUI text like "blocked"/"1 tries" pasted into the
  # title). A mis-read here makes the driver mislabel a finished task or re-drive a
  # closed one — a task that never settles.
  CUR="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
  # ── TURN SCHEMA — the PRIMARY verdict path (PR-C) ───────────────────────────
  TURN_KIND="none"; TURN_V=""; TURN_EVID=""; TURN_NEXT=""
  if [ -f "$BIN/turn-schema.js" ] && [ "${TURN_MODE:-strict}" != "off" ]; then
    TURN_LINE="$("$NODE_BIN" "$BIN/turn-schema.js" verdict --task "$TID" --since "${TURN_SINCE:-0}" 2>/dev/null | head -1)"
    TURN_KIND="$(printf '%s' "$TURN_LINE" | cut -f1)"; [ -z "$TURN_KIND" ] && TURN_KIND="none"
    if [ "$TURN_KIND" = "ok" ]; then
      TURN_V="$(printf '%s' "$TURN_LINE" | cut -f2)"
      TURN_EVID="$(printf '%s' "$TURN_LINE" | cut -f3 | head -c 400)"
      TURN_NEXT="$(printf '%s' "$TURN_LINE" | cut -f4 | head -c 300)"
      echo "[$(date -Iseconds)] [$AGENT_ID] ✓ TURN SCHEMA ok — verdict=${TURN_V}" >> "$TASK_LOG"
    elif [ "$TURN_KIND" = "invalid" ]; then
      TURN_EVID="$(printf '%s' "$TURN_LINE" | cut -f2- | head -c 400)"
    fi
  fi
  # schema compliance for the learner: a valid payload, or the agent moved the card
  # itself through the vintask transition CLI (also a structured tool call).
  TURN_SCHEMA_OK=0
  { [ "$TURN_KIND" = "ok" ] || { [ "$CUR" != "claimed" ] && [ "$CUR" != "doing" ]; }; } && TURN_SCHEMA_OK=1
  PROSE_VERDICT=""
  if [ "$TURN_KIND" != "ok" ]; then
    if echo "$OUT" | grep -qE "^[*_#>\`~[:space:]-]*(✅[[:space:]]*)?DONE([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then PROSE_VERDICT="DONE"
    elif echo "$OUT" | grep -qE "^[*_#>\`~[:space:]-]*(⛔[[:space:]]*)?BLOCKED([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then PROSE_VERDICT="BLOCKED"
    elif echo "$OUT" | grep -qiE "^[*_#>\`~[:space:]-]*(🔴[[:space:]]*)?(NEEDS-HUMAN|NEEDS_HUMAN|NEED)([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then PROSE_VERDICT="NEEDS-HUMAN"
    fi
  fi
  if [ "$CUR" = "claimed" ] || [ "$CUR" = "doing" ]; then
    if [ "$TURN_KIND" = "invalid" ]; then
      $VINTASK block "$TID" "TURN SCHEMA VIOLATION — the turn's transition payload failed validation (${TURN_EVID}). Turn killed; card returned for retry." >/dev/null 2>&1
      log "iter $i — ⛔ TURN SCHEMA VIOLATION (invalid payload) [$TID] on ${PROVIDER}/${ROUTE}"
    elif [ "$TURN_KIND" = "ok" ] && [ "$TURN_V" = "blocked" ]; then
      $VINTASK block "$TID" "${TURN_NEXT:-blocked} — evidence: ${TURN_EVID}" >/dev/null 2>&1
      log "iter $i — turn contract BLOCKED [$TID]: ${TURN_NEXT:0:80}"
    elif [ "$TURN_KIND" = "ok" ] && [ "$TURN_V" = "needs-human" ]; then
      $VINTASK need "$TID" "${TURN_NEXT:-agent requested a human decision} — evidence: ${TURN_EVID}" >/dev/null 2>&1
      log "iter $i — turn contract NEEDS-HUMAN [$TID]: ${TURN_NEXT:0:80}"
    elif [ "$TURN_KIND" = "ok" ] && [ "$TURN_V" = "progress" ]; then
      # PROGRESS is "real work landed, more remains" — NOT a block (task 84UDJJP).
      # The old `block` here stranded honestly-reporting cards in Vinta's BLOCKED
      # list forever (9TYJB74 >24h) because nothing ever consumed the reason string.
      # `checkpoint` returns the card to `todo` with the note preserved so the next
      # wake continues it; attempts still count (the 3-cap protects against a card
      # that only ever "progresses" and never lands).
      $VINTASK checkpoint "$TID" "turn contract — not finished; next: ${TURN_NEXT} — evidence so far: ${TURN_EVID}" >/dev/null 2>&1
      log "iter $i — turn contract PROGRESS checkpoint [$TID] — requeued (todo) for another turn"
    elif [ "${TURN_MODE:-strict}" = "strict" ] && [ -n "$PROSE_VERDICT" ] && [ -f "$BIN/turn-schema.js" ]; then
      # Prose "DONE/BLOCKED/NEEDS-HUMAN" without the transition tool call fails the
      # turn schema check. The prose is preserved as a clue, never acted on.
      PROSE_LINE="$(printf '%s' "$OUT" | grep -E "^[*_#>\`~[:space:]-]*(✅|⛔|🔴)?[[:space:]]*(DONE|BLOCKED|NEEDS-HUMAN|NEEDS_HUMAN|NEED)" | tail -1 | head -c 300)"
      $VINTASK block "$TID" "TURN SCHEMA VIOLATION — agent narrated '${PROSE_VERDICT}' in prose instead of calling the transition tool (bin/turn-schema.js emit). Turn killed. Its prose line: ${PROSE_LINE}" >/dev/null 2>&1
      log "iter $i — ⛔ TURN SCHEMA VIOLATION (prose ${PROSE_VERDICT}, no tool call) [$TID] on ${PROVIDER}/${ROUTE}"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ TURN SCHEMA VIOLATION — prose ${PROSE_VERDICT} without transition tool; turn killed" >> "$TASK_LOG"
    # SEALED-QUESTION LAW (SEHP2A4, 2026-08-14). This regex used to include the bare
    # alternative `task (complete|done)`, unanchored — so ANY sentence anywhere in the
    # agent's prose containing "task complete" or "task done" auto-closed the card,
    # including a sentence explaining what still needed Vinta's decision. The exit
    # line is a PROTOCOL token, not prose: require it at the start of a line, naming
    # this task or standing alone. An agent that wants a card closed says so exactly.
    # Belt-and-braces: `vintask done` itself now refuses to bury an unanswered
    # question (exit 3), so even a false positive here can no longer silence a `need`.
    elif { [ "$TURN_KIND" = "ok" ] && [ "$TURN_V" = "done" ]; } || echo "$OUT" | grep -qE "^[*_#>\`~[:space:]-]*(✅[[:space:]]*)?DONE([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then
      # ── PROOF-OF-WORK GATE (2026-08-19) ──────────────────────────────────────
      # A cheap rung can NARRATE the job instead of doing it: gemini-3.5-flash-lite
      # printed a tidy markdown script of the commands it "would" run, ended with
      # "DONE 2526DSM", and this branch closed the card. The claimed edit was never
      # made (grep -c token-economist bin/council-driver.sh = 0). Same shape closed
      # X9JKRX9. Saying DONE is not evidence of DONE — a real run leaves TOOL CALLS
      # in the raw stream. Every genuine task in logs/ carries 8–116 of them; the
      # two phantoms carry ZERO. So: no tool call in the raw stream ⇒ refuse to
      # close, requeue with the evidence. Provider-agnostic (anthropic tool_use,
      # openai/codex function_call|local_shell_call|exec_command, generic tool_call).
      TOOL_EVIDENCE=0
      # (2026-09-25) THE GATE WAS DEAD FOR EVERY PHANTOM IT EXISTED TO CATCH.
      # `grep -c` PRINTS "0" *and* exits rc=1 when nothing matches, so the old
      # `|| echo 0` fallback appended a SECOND zero: TOOL_EVIDENCE became the
      # two-line string "0\n0". `[ "0\n0" -eq 0 ]` is not an integer comparison,
      # so it failed, the refusal never fired, and the card closed anyway —
      # carrying the newline into its own proof text ("after 0\n0 executed tool
      # calls", visible on card PXVFW4Q). Every zero-tool-call DONE passed the
      # very check meant to stop it. `tr -d` collapses grep's output to digits and
      # the `|| true` keeps rc=1 from tripping `set -e`.
      [ -f "$RAW_LOG" ] && TOOL_EVIDENCE="$(grep -c '"tool_use"\|"function_call"\|"tool_call"\|"local_shell_call"\|"exec_command"\|"shell_call"' "$RAW_LOG" 2>/dev/null | tr -cd '0-9' || true)"
      TOOL_EVIDENCE="${TOOL_EVIDENCE:-0}"
      if [ "${TOOL_EVIDENCE:-0}" -eq 0 ] 2>/dev/null; then
        log "iter $i — ⚠ PHANTOM DONE refused [$TID] — said DONE with ZERO tool calls in the raw stream (narrated, never executed)"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ PHANTOM DONE refused — the model described the work instead of doing it (0 tool calls on ${PROVIDER}/${ROUTE}). Card returned to the queue." >> "$TASK_LOG"
        $VINTASK update "$TID" --progress "phantom DONE refused — ${PROVIDER}/${ROUTE} narrated the work with 0 tool calls; requeued for a rung that can execute" >/dev/null 2>&1
        $VINTASK reopen "$TID" >/dev/null 2>&1
        sleep 2; continue
      fi
      # ── ACCEPTANCE GATE (Vinta 2026-09-25, "go") ─────────────────────────────
      # Vinta: "it keeps marking tasks done without doing shit."
      # Measured at the time: of 438 done cards, 397 carried NO acceptance
      # criteria at all. A card with nothing to test CANNOT FAIL, so the gate
      # above (did it act?) and the Completion Proof Law below (did it check the
      # right thing?) both had nothing to check it against, and "the agent stopped
      # talking" became "done". PXVFW4Q closed at 100% having executed zero tools.
      #
      # An agent may not invent the definition of done for a card that never had
      # one. So: no acceptance text => do NOT auto-close. Ask Vinta what done
      # means, carrying the work already performed so nothing is lost or redone.
      # `need` (not `block`) is deliberate — this IS a question only he can answer,
      # and it keeps the card out of the retry pool that would just re-run it.
      # Escape hatch: COUNCIL_REQUIRE_ACCEPTANCE=0 restores the old behaviour.
      if [ "${COUNCIL_REQUIRE_ACCEPTANCE:-1}" = "1" ]; then
        ACC="$($VINTASK show "$TID" --field acceptance 2>/dev/null | tr -d '[:space:]')"
        if [ -z "$ACC" ]; then
          log "iter $i — ⚠ auto-DONE withheld [$TID] — card has NO acceptance criteria; asking Vinta to define done (${TOOL_EVIDENCE} tool calls of work preserved)"
          echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ auto-DONE withheld — this card never had acceptance criteria, so nothing could verify it. The work IS done (${TOOL_EVIDENCE} tool calls on ${PROVIDER}/${ROUTE}); it is the DEFINITION of done that is missing." >> "$TASK_LOG"
          $VINTASK need "$TID" "The agent finished work on this card (${TOOL_EVIDENCE} executed tool calls on ${PROVIDER}/${ROUTE}) but the card has NO acceptance criteria, so nothing can verify it is actually done. Review the log and either (a) accept it: node vintask.js done $TID --proof \"<what you checked>\", or (b) add criteria and reopen: node vintask.js update $TID --acceptance \"<what done means>\" then node vintask.js reopen $TID. Log: $LOG" >/dev/null 2>&1
          sleep 2; continue
        fi
      fi
      # ── COMPLETION PROOF LAW (ERAXJ6D, 2026-08-25) ───────────────────────────
      # `vintask done` now demands EVIDENCE, not just a status flip. The proof-of-work
      # gate above proves the agent DID something (tool calls); this proves it CHECKED
      # THE RIGHT THING. They are different failures: VG8U73N had plenty of tool calls
      # and still closed "parallel seats are not going up and down" by adding CSS hover
      # effects to phase rungs.
      #
      # An agent states its proof on the exit line:  DONE <id> (proof: <what it showed>)
      # We lift that when present. When ABSENT we do NOT fabricate one — we pass a
      # factual, provider-attributed statement of what the driver itself can vouch for,
      # so a card is never closed on a claim nobody actually made. The driver therefore
      # never jams: it always has this honest fallback.
      AGENT_PROOF="$(printf '%s' "$OUT" | grep -oiE "^[*_#>\`~[:space:]-]*(✅[[:space:]]*)?DONE([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*\((proof|verified)[:[:space:]][^)]*\)" | head -1 | sed -E "s/.*\((proof|verified)[:[:space:]]+//I; s/\)[[:space:]]*$//" | cut -c1-400)"
      [ "$TURN_KIND" = "ok" ] && [ "$TURN_V" = "done" ] && [ -n "$TURN_EVID" ] && AGENT_PROOF="$TURN_EVID"
      if [ -z "$AGENT_PROOF" ]; then
        AGENT_PROOF="driver-verified: agent ran to completion on ${PROVIDER}/${ROUTE} and emitted the DONE token after ${TOOL_EVIDENCE} executed tool calls (agent supplied no proof line — this attests execution, NOT verification of the acceptance criteria)"
      fi
      if $VINTASK done "$TID" --proof "$AGENT_PROOF" >/dev/null 2>&1; then
        log "iter $i — auto-marked DONE [$TID] (${TOOL_EVIDENCE} tool calls verified)"
        # ── MERGE-BACK (2026-08-30) ────────────────────────────────────────────
        # THE MISSING RETURN PATH. Each seat works in its own git worktree on its
        # own branch — correct isolation, 12 seats must not collide on one tree.
        # But NOTHING ever merged those branches back, so finished work simply
        # accumulated off main forever. Found live: 12 stranded branches holding
        # ~77 commits — DirZombie logo/anticheat/game, world build-kinds, auth
        # password reset, cognition, funnel instrumentation — none shipped, and
        # three cards sat BLOCKED waiting on a push that could never satisfy them
        # from main. The board looked wedged; it was actually starved.
        #
        # A task is only DONE when its work is on main. Merge here, at the single
        # verified success path, after the proof-of-work gate has already passed.
        # THE MERGE-CONFLICT FREEZE FIX (KGQM5CU): if merge fails (conflicts), it now
        # marks needs-human and returns 1. Don't mark done if merge failed.
        if merge_back_to_main "$TID"; then
          : # merge succeeded, continue to mark done below
        else
          log "iter $i — merge-back FAILED for [$TID] — card marked needs-human, not closing as done"
          sleep 2; continue  # skip marking done, move to next iteration
        fi
      else
        # done was REFUSED — either the card is sealed on an unanswered question, or the
        # proof did not survive the Completion Proof Law. Both are legitimate
        # non-closures, and both belong in front of Vinta rather than silently green.
        log "iter $i — auto-DONE refused for [$TID] (sealed question, or proof failed the Completion Proof Law) — left for Vinta"
        echo "[$(date -Iseconds)] [$AGENT_ID] ⚠ auto-DONE refused — the card is sealed on a question only Vinta can answer, or its completion proof did not hold. Left open on purpose." >> "$TASK_LOG"
      fi
    # ── SELF-DECLARED VERDICT: BLOCKED / NEEDS-HUMAN (2026-09-25) ──────────
    # Grok agents (and older Anthropic/OpenAI ones too) reliably PRINT a
    # protocol-shaped exit line — "BLOCKED <id> (reason)" — but often fail to
    # CALL the vintask CLI, so the driver's "no status recorded" fallback used
    # to block them with a useless "review the log" message. Forensic pass
    # 2026-09-25: card RVXWKYT printed literally
    #   BLOCKED RVXWKYT (merge conflicts still present — need live worktree)
    # and lost the reason because the driver saw no CLI call and generated its
    # own generic message.
    #
    # Fix: after DONE detection, also accept self-declared BLOCKED and
    # NEEDS-HUMAN verdicts at line start. Same anchoring rules as DONE
    # (start-of-line, optional emoji prefix, optional TID) so prose sentences
    # can never trigger. The reason/question is extracted from whatever
    # separator follows: `(reason)`, `: reason`, `— reason`, or newline.
    elif echo "$OUT" | grep -qE "^[*_#>\`~[:space:]-]*(⛔[[:space:]]*)?BLOCKED([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then
      BLK_REASON="$(printf '%s' "$OUT" | grep -oiE "^[*_#>\`~[:space:]-]*(⛔[[:space:]]*)?BLOCKED([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*[:(—][^)]*(\)|\$)" | tail -1 | sed -E "s/^[[:space:]]*(⛔[[:space:]]*)?BLOCKED([[:space:]]+$TID)?[[:space:]]*[:(—][[:space:]]*//; s/[[:space:])]+$//" | head -c 400)"
      [ -z "$BLK_REASON" ] && BLK_REASON="agent self-declared BLOCKED (no reason on the exit line — see log $LOG)"
      $VINTASK block "$TID" "$BLK_REASON" >/dev/null 2>&1
      log "iter $i — self-declared BLOCKED accepted [$TID] on ${PROVIDER}/${ROUTE}: ${BLK_REASON:0:80}"
      echo "[$(date -Iseconds)] [$AGENT_ID] ⛔ BLOCKED recorded from agent's own exit line — reason preserved instead of generic 'no status recorded'" >> "$TASK_LOG"
    elif echo "$OUT" | grep -qiE "^[*_#>\`~[:space:]-]*(🔴[[:space:]]*)?(NEEDS-HUMAN|NEEDS_HUMAN|NEED)([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*($|\(|:|—)"; then
      NH_Q="$(printf '%s' "$OUT" | grep -oiE "^[*_#>\`~[:space:]-]*(🔴[[:space:]]*)?(NEEDS-HUMAN|NEEDS_HUMAN|NEED)([[:space:]]+[A-Za-z0-9]+)?[*_\`~[:space:]]*[:(—][^)]*(\)|\$)" | tail -1 | sed -E "s/^[[:space:]]*(🔴[[:space:]]*)?(NEEDS-HUMAN|NEEDS_HUMAN|NEED)([[:space:]]+$TID)?[[:space:]]*[:(—][[:space:]]*//; s/[[:space:])]+$//" | head -c 400)"
      [ -z "$NH_Q" ] && NH_Q="agent asked for human input (no question on the exit line — see log $LOG)"
      $VINTASK need "$TID" "$NH_Q" >/dev/null 2>&1
      log "iter $i — self-declared NEEDS-HUMAN accepted [$TID] on ${PROVIDER}/${ROUTE}: ${NH_Q:0:80}"
      echo "[$(date -Iseconds)] [$AGENT_ID] 🔴 NEEDS-HUMAN recorded from agent's own exit line — question preserved" >> "$TASK_LOG"
    elif [ $RC -eq 124 ]; then
      $VINTASK block "$TID" "driver timeout (${TIMEOUT_SECS}s / $((TIMEOUT_SECS/60))min) — split into smaller cards, or raise this card's limit: node vintask.js timeout $TID <secs> (0 = no limit), then reopen" >/dev/null 2>&1
      log "iter $i — TIMEOUT, blocked [$TID]"
    else
      # NEVER RE-FORCE A CARD AS A BLANK SLATE (JFVPS5T, 2026-08-18). This used to
      # fire one generic "agent exited without recording a result" no matter how far
      # the card actually got. JFVPS5T died here at 100% — with a full work log AND a
      # finished report already written to state/docs/ — and Vinta was handed a card
      # that read as if nothing had ever happened. A re-queue must carry forward the
      # evidence sitting in the card's own feed, so a reporting failure never
      # masquerades as a work failure.
      PCT="$($VINTASK show "$TID" --field percent 2>/dev/null | tr -d '[:space:]')"
      LASTPROG="$($VINTASK show "$TID" --field progress 2>/dev/null | head -c 240)"
      # A report the dead agent already wrote is the single most valuable artifact to
      # rescue — attach it so Vinta reads the answer instead of an error message.
      ORPHAN_DOC=""
      for d in "$STATE/docs/$TID"-*.md; do [ -f "$d" ] && ORPHAN_DOC="$d"; done

      REQ_MSG="TURN SCHEMA VIOLATION (no transition tool call) — agent exited without recording a result — review its log at $LOG"
      if [ -n "$PCT" ] && [ "$PCT" -ge 50 ] 2>/dev/null; then
        REQ_MSG="agent died at ${PCT}% WITH WORK ALREADY DONE — this is a reporting failure, not a blank slate. Last recorded step: \"${LASTPROG}\". Check that work before redoing any of it; log: $LOG"
      elif [ -n "$LASTPROG" ]; then
        REQ_MSG="agent exited without recording a result. Last recorded step: \"${LASTPROG}\" — log: $LOG"
      fi

      # A CRASH IS NOT A QUESTION (JPPBZFU, 2026-08-19). This used to fire
      # `vintask need`, which put a red NEEDS-A-HUMAN-DECISION card on Vinta's
      # board saying only "agent exited — review its log". He owns no decision
      # there: the agent died, and the answer is to run it again. Card W84PNK2 sat
      # red for exactly this reason. `block` is the honest status — "the council
      # could not proceed" — and blocked cards are retryable by the council instead
      # of being homework for Vinta. The rescued report still rides along on --doc.
      if [ -n "$ORPHAN_DOC" ]; then
        $VINTASK block "$TID" "$REQ_MSG" --doc "$ORPHAN_DOC" >/dev/null 2>&1 \
          || $VINTASK block "$TID" "$REQ_MSG" >/dev/null 2>&1
        log "iter $i — no status recorded, BLOCKED for retry [$TID] (rescued orphaned doc: $ORPHAN_DOC)"
      else
        $VINTASK block "$TID" "$REQ_MSG" >/dev/null 2>&1
        log "iter $i — no status recorded, BLOCKED for retry [$TID] (at ${PCT:-0}%)"
      fi
    fi
  else
    log "iter $i — task [$TID] now: $CUR"
  fi

  # ── LEARNER FEEDBACK (PR-B) — the router is the learner ─────────────────────
  # Every settled turn becomes an observation (card features × tier × model ×
  # outcome × schema compliance × structural regression). The nightly rebalance
  # (bin/learner-rebalance.js) turns these into weight updates with an audit trail.
  if [ -f "$ROOT/lib/orchestrator.js" ]; then
    _lo_final="$($VINTASK show "$TID" --field status 2>/dev/null | tr -d '[:space:]')"
    _lo_ok=""
    case "$_lo_final" in done) _lo_ok=1 ;; blocked|todo|doing|claimed) _lo_ok=0 ;; esac
    if [ -n "$_lo_ok" ]; then
      ( timeout 30 "$NODE_BIN" "$ROOT/lib/orchestrator.js" outcome --task "$TID" --kind "${FLOOR_KIND:-general}" \
          --tier "${FLOOR_TIER:-$TIER}" --provider "$PROVIDER" --model "$ROUTE" --ok "$_lo_ok" \
          --tokens "${FTOK:-0}" --schema-ok "${TURN_SCHEMA_OK:-0}" --regression "${LAST_REGRESSION:-0}" \
          --taskfile "$LOGS/task-${TID}.card.json" >/dev/null 2>&1 & )
    fi
  fi

  sleep 3
done

log "driver done after loop."
