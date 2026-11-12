# YRCXQ9E: identified restart caller; deployment and observation remain

## Attribution

Times below are America/New_York (UTC-05:00), except the explicitly UTC broker records.

The caller was the host-operations broker servicing **3Z8UMZQ, World build — Phase 7: Society**. Its `pm2.restart` branch calls PM2 directly and does not consult wedge-guard's IO policy.

* `/home/vinta/.pm2/pm2.log`: API stop requested November 5 at **14:51:23**, then SIGKILL and replacement start at **14:51:35**.
* `/home/vinta/.claude/council-loop/logs/host-ops.log:79`: `2026-11-05T19:51:35.662Z`, task `3Z8UMZQ`, operation `pm2.restart`, name `vintinuum-api`, `ok:true`. The broker logs **after** synchronous PM2 returns, accounting for the 12-second stop-to-SIGKILL interval.
* Line 74 records the separate known S4CKZJM deploy at `2026-11-05T19:30:20.025Z`.
* Wedge-guard held November 5 at **14:50:23, IO avg60 76%**, and **14:51:23, IO avg60 80%**. Thus the broker bypassed an actual IO hold.
* November 4 held at **14:50:29, 92%**, and **14:51:24, 95%**, without a matching 14:51 API stop. November 3 also had no 14:51 API stop. A daily same-minute kill is **not** supported.
* Boot-resurrect explicitly left the API online, skipped resurrect, and reported clean deduplication in the November 3 (14:51:37–14:51:50), November 4 (14:50:41–14:51:09), and November 5 (14:51:13–14:51:25) runs. It is not the identified caller.

## Prepared fix and verification

`/home/vinta/vintinuum-api/scripts/recover-brain.sh` implements the shared restart operation: live process IO >=40% hold, unreadable-pressure hold, D-state hold, persistent flock and 30-minute budget, exact numeric PM2 ID, and caller audit. Existing boot/resurrect/watchdog/keepalive/wedge scripts use it. There is no new scheduled guard. Missing/dead processes can recover even during high IO; only confirmed recovery arms keepalive grace. Safe-save remains guarded.

`bin/verify-brain-recovery-YRCXQ9E.js`: 20/20 fake-PM2 behavioral checks passed. `scripts/verify-hostops-brain-recovery.js`: 5/5 staged-broker checks passed, including API name/numeric-ID policy routing, HOLD without fallback, other-service preservation, and permission refusal before subprocess execution. No live restart was used as a test.

**The responsible live broker is not patched yet.** Its source `/home/vinta/.claude/council-loop/lib/host-ops.js` lies outside this session's writable roots. `hostop help` grants only PM2 inspect/restart and process inspect/locks; it has no deployment or file-edit operation. The patch is ready at `/home/vinta/vintinuum-api/patches/YRCXQ9E-host-ops.patch`.

## Remaining deployment

From an authorized host session, apply the patch to the council-loop repository:

```sh
cd /home/vinta/.claude/council-loop
git apply --check /home/vinta/vintinuum-api/patches/YRCXQ9E-host-ops.patch
git apply /home/vinta/vintinuum-api/patches/YRCXQ9E-host-ops.patch
node --check lib/host-ops.js
```

Commit that change. Existing broker processes retain their loaded module: allow existing seats to finish and ensure subsequent seat brokers load the patched module. Reload the long-running keepalive through its service manager after checking its stop action; do not stop a PM2-owning service with `ExecStop=pm2 kill`. Do not restart the API merely to activate these shell/broker changes. The staged-patch verifier is intended for **before** installation; after installation the patch no longer applies cleanly by design.

## Required observation — not satisfied

Preserve complete PM2/wedge/recovery log coverage after deployment. On two **consecutive local dates** with actual wedge HOLDING at IO avg60 >=40%, record exact hold timestamps and figures, PM2 restart counter immediately before/after the relevant window, and establish zero `Stopping app:vintinuum-api` entries within that window. A day without the required pressure event is not a qualifying day. Missing log coverage or counter samples is not a pass. November 4–5 cannot count: November 5 contains the confirmed stop. Current host inspection during this wake reported API online, PID 3190454, restart count 5; this single sample does not establish stability.

Keep the task open until installation, broker/keepalive activation, and both qualifying days are verified. Do not fabricate future evidence or weaken the acceptance to unit tests.

## Decisions and skill applicability

DECISION: share one recovery policy across existing callers, including council deploys; ALT: add another watchdog or blame boot-resurrect; UNDO: revert the scoped API commits and broker patch. No new daemon or PM2 save was introduced.

Token-frugality and safe-save guidance applied. Phase-world-citizen and rescue-conflict-merge are not functional requirements here: no world UI or merge-conflict work was needed; their targeted-verifier precedent was useful. Required precedent proofs were inspected. Board sweep found no empty needs-human cards or listed spurious provider/schema blocks in Vintinuum; unrelated dependency/cap/external-test cards were left untouched.

## Commit boundary

The API repository Git index is read-only in this sandbox (`index.lock: Read-only file system`), while its seven changed runtime/test files are writable. The seat worktree `ops/YRCXQ9E-api-recovery.patch` preserves exactly those seven files; `ops/YRCXQ9E-host-ops.patch` preserves the broker fix. `ops/verify-hostops-brain-recovery-YRCXQ9E.js` is an archival copy of the API verifier: run the installed API `scripts/verify-hostops-brain-recovery.js`, or copy this archival script there before running it. Commit the runtime API files from an authorized host session, without staging unrelated existing changes. The broker uses `--preserve-env` to retain its previous PM2 restart environment behavior.
