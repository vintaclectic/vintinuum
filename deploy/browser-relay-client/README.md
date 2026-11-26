# PC browser client migration (2MH3CNU)

The browser stays on the Windows PC; the brain and authoritative audit ledger
stay on brain-srv. `vintbrowse` must go through the brain's owner-authenticated
routes. A direct relay connection would bypass those controls.

Deploy the companion API change and PC `browser-relay-tunnel.service` first.
That service forwards PC loopback 18767 to brain loopback 8767, and brain
loopback 9009 back to PC loopback 9009. No public listener is needed.

Run `bash deploy/browser-relay-client/install.sh` from this checkout on the PC
host. The installer backs up the existing CLI and watchdog before replacement.
The existing `vintbrowse` wrapper and cron entry keep their paths. The marker
`~/.vintinuum/brain-remote` selects port 18767; an explicit `BRAIN_URL` overrides
it, but must be loopback HTTP. The SSH channel provides transport encryption.
The CLI continues to use the installed capability gate and credential broker.

The watchdog now checks the remote brain through the same authenticated CLI.
It never restarts an obsolete PC API. The tunnel's systemd service handles
transport-process recovery. Windows relay availability remains a separate
prerequisite; its health endpoint is `http://127.0.0.1:9009/health` on this PC.

Verification:

```sh
node deploy/browser-relay-client/verify-client.js
vintbrowse status
vintbrowse goto https://example.com
vintbrowse read
vintbrowse audit 5
```

Command success requires the API's `auditLogged: true` confirmation. Audit
reads use the remote owner-only endpoint; this client never reads/writes the
obsolete PC SQLite database. The server must redact command inputs and page
results before storing audit summaries.

Rollback: restore both `.before-2MH3CNU-<timestamp>` files saved beside the
installed CLI/watchdog. Revert the companion API commit and remove the new
systemd service only if also reverting the network topology. The original
configuration does not provide a working remote-brain browser path.

Installation requires writes outside the council sandbox. Staging these files
or temporarily establishing SSH forwards is not proof of durable installation.
