# UB4BB8K: diagnose the secrets-copy failure

The old helper uses quiet `scp`. `scp: Connection closed` alone does not
establish whether SSH authentication, connectivity, or the remote transfer
subsystem failed. This helper uses the SSH shell directly so an SFTP subsystem
is not required; it does not weaken host-key verification.

Run the read-only check first from the home machine:

```bash
bash /home/vinta/.council-worktrees/Vintinuum-seat-2/docs/migrations/UB4BB8K/vinta-push-secrets.sh --check
```

If SSH fails, stop and use its error to diagnose connectivity/authentication.
Do not remove known-host entries or bypass host-key verification. If both files
already exist, the previous upload may have succeeded; investigate application
health before overwriting them. Only if credentials need copying, Vinta runs:

```bash
bash /home/vinta/.council-worktrees/Vintinuum-seat-2/docs/migrations/UB4BB8K/vinta-push-secrets.sh --push
```

The helper checks SSH before opening local credentials, checks both source files
before uploading, stages each file with mode 600, verifies its SHA256, and
atomically replaces that destination. Each file is independent: if the second
transfer fails the first may already be updated; fix the error and rerun. No
credential contents or hashes are printed. No services restart and no cutover
runs. The helper has not been installed over the original script.

Local verification on 2026-10-27:

- `bash -n vinta-push-secrets.sh`: passed.
- `python3 test-push-helper.py`: temporary mock hosts passed read-only check,
  rejected SSH, truncated-upload checksum rejection retaining original files,
  exact transfers, mode 600, secret-free output, empty-source and invalid-mode
  rejection, and temporary-file cleanup. No real credentials were opened.
- Strict, bounded live SSH failed before connection: `socket: Operation not
  permitted`, exit 255. Live destination state is therefore unverified.
- Local `seed.log` contains `2026-10-21T12:58:22-04:00 SEED_DONE`; the task's
  “seed still running” statement is stale.
- Local `cutover.log` last failure is `2026-10-22T12:28:53-04:00 FATAL: VPS
  loopback smoke failed (DB left at ~/dirhaven-data/dirhaven.db on VPS, VPS apps
  stopped, home writers restored)`. Earlier “cutover never attempted” notes are
  stale too. These historical records do not prove current remote health.

The migration remains incomplete pending live SSH diagnostics, confirmation of
credential presence, and investigation of the failed VPS application smoke
test. This repair does not authorize or perform a production cutover.
