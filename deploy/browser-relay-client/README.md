# PC browser client after the brain migration (2MH3CNU)

The browser stays on the Windows PC; the brain and the authoritative audit
ledger stay on brain-srv (2.29.194.240, since 2026-11-17). `vintbrowse` goes
through the brain's owner-authenticated routes — a direct relay connection would
bypass the capability gate, the owner check and the audit ledger.

## The chain, and who repairs each link

```
agent -> vintbrowse -> COUNCIL_AGENT_TOKEN -> owner JWT
      -> PC 127.0.0.1:18767 ──ssh -L──> brain-srv 127.0.0.1:8767   (the brain)
      -> brain-srv 127.0.0.1:9009 ──ssh -R──> PC 127.0.0.1:9009     (the relay)
      -> Windows Playwright Chromium
```

| link | kept alive by |
|---|---|
| Windows relay process | Task Scheduler at logon, **and** `relay-watchdog.sh` mid-session |
| SSH channel both ways | `browser-relay-tunnel.sh ensure`, called by `relay-watchdog.sh` |
| brain's view of the relay | the brain's own retry (never abandons) + `vintbrowse resume` |
| crashed Chromium renderer | the relay replaces the page and retries the command |

`relay-watchdog.sh` already runs from cron every 5 minutes and `@reboot`, so it
is the supervisor for all of the above. **No systemd unit and no sudo are
needed** — the council sandbox has no root (measured 2026-11-26), so a unit in
`/etc/systemd/system` is not installable by an agent. If you later want systemd
to own the SSH channel instead, `vintinuum-api/deploy/browser-relay/browser-relay-tunnel.service`
is the equivalent unit; the cron path and the unit do the same job, so install
one, not both.

## Install

```sh
bash deploy/browser-relay-client/install.sh
```

It syntax-checks everything, backs up what it replaces as
`.before-2MH3CNU-<timestamp>`, installs `vintbrowse.js`, `relay-watchdog.sh` and
`browser-relay-tunnel.sh` into `~/.claude/council-loop/bin`, and brings the SSH
channel up. The `vintbrowse` wrapper and the cron entry keep their paths.
`~/.vintinuum/brain-remote` selects port 18767; an explicit `BRAIN_URL` wins but
must be loopback HTTP (the CLI refuses anything else, because the token would
otherwise leave the machine in the clear).

## Verify

```sh
node deploy/browser-relay-client/verify-client.js     # 32/32
bash ~/.claude/council-loop/bin/browser-relay-tunnel.sh status
vintbrowse status      # connected: true
vintbrowse goto https://example.com && vintbrowse read
vintbrowse audit 5     # rows land in browser_relay_audit ON BRAIN-SRV
curl -s http://127.0.0.1:9009/health   # pageReady, crashesRecovered
```

Every command needs the API's `auditLogged: true` before it is treated as
successful. Audit reads hit the remote owner-only endpoint; this client never
touches the obsolete PC SQLite database. Payload values and page text are
deliberately never stored.

## Exposure

Nothing binds a public interface. Measured 2026-11-26: the Windows relay listens
on `127.0.0.1:9009` only (`Get-NetTCPConnection`), brain-srv shows
`LISTEN 127.0.0.1:9009` only (`ss -lnt`), brain-srv's public address **refuses**
:9009 while its loopback accepts it, and the PC's public address does not answer
:9009 probed from brain-srv. No `GatewayPorts` directive is set in brain-srv's
sshd config, so sshd uses its default of `no` — keep it that way.

## Rollback

Restore both `.before-2MH3CNU-<timestamp>` files beside the installed CLI,
`browser-relay-tunnel.sh stop`, and revert the companion API commits. The
previous configuration has no working path to a remote brain at all.
