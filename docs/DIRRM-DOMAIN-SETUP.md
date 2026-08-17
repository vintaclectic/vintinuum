# DirRM landing — custom domain setup

Status as of **2026-08-17**: **DNS is LIVE.** `dirrm.vintinuum.com` resolves to
the four GitHub Pages IPs, and this repo now ships the `CNAME` that binds the
custom domain to the Pages site.

```
https://vintaclectic.github.io/vintinuum/dirrm.html   (unchanged, still works)
https://dirrm.vintinuum.com/                          (redirects to the landing)
https://dirrm.vintinuum.com/dirrm.html
```

**Measured, not assumed** (2026-08-17):

```
dirrm.vintinuum.com -> 185.199.108.153 185.199.109.153
                       185.199.110.153 185.199.111.153
```

which is exactly the GitHub Pages set, matching `vintaclectic.github.io`. The
registrar-side record is in place:

```
CNAME  dirrm  ->  vintaclectic.github.io.
```

### CONFIRMED LIVE (2026-08-17)

```
https://dirrm.vintinuum.com/            200  (router → /dirrm.html)
https://dirrm.vintinuum.com/dirrm.html  200
https://dirrm.vintinuum.com/dirrm-player.html  200
http://…  → upgrades to https automatically
```

Certificate: `CN = dirrm.vintinuum.com`, Let's Encrypt, valid
Aug 17 2026 → Nov 15 2026. `https_enforced: true`. The Pages API reports
`cname: dirrm.vintinuum.com`.

`https://vintaclectic.github.io/vintinuum/` and its deep links stayed **200
throughout** — no repeat of the 591c9b8 outage, because DNS existed first.

Note: Pages 301s some project-path URLs to the custom host as its edges pick
up the binding (e.g. `/vintinuum/world.html` → `dirrm.vintinuum.com/world.html`).
That resolves correctly — the custom domain serves this repo at its root, so
`/world.html` is the right path and returns 200 with the real page.

### The step that was missing, and why it was not DNS

Before this commit, `https://dirrm.vintinuum.com/` returned **404** and served a
`*.github.io` certificate. That was *not* a DNS failure — DNS was already
correct. GitHub Pages had `cname: null`, i.e. the domain resolved to Pages but
Pages did not know which repository should answer for it, so it had nothing to
serve and no certificate to issue.

Binding the domain is what fixes both at once:

1. This repo's root `CNAME` file (shipped here) declares the host.
2. GitHub then provisions a Let's Encrypt certificate for
   `dirrm.vintinuum.com` — this takes up to ~15 minutes after the first
   successful build.
3. **Enforce HTTPS** becomes tickable in Settings → Pages once the cert exists.

Until the certificate is issued, HTTPS will show a certificate-name mismatch.
That is expected and self-resolves; it is not a misconfiguration.

---

## What the task asked for vs. what is actually true

The original task specified `dirrm.vintinuum.co`; Vinta later answered that
`dirrm.vintinuum.com` was the intended host. The first-pass measurements, kept
here as the record of why the `.co` spelling was never used:

| Domain | Resolves? | Evidence |
|---|---|---|
| `vintinuum.co` | **NO — NXDOMAIN** | `socket.gethostbyname` → `Name or service not known` |
| `dirrm.vintinuum.co` | **NO — NXDOMAIN** | same |
| `vintinuum.com` | **YES** | `3.33.251.168` |
| `dirrm.vintinuum.com` | **YES (as of 2026-08-17)** | the four Pages IPs — DNS is live |

So `vintinuum.co` was the wrong domain and never resolved. `vintinuum.com` is
the correct apex, and its `dirrm` subdomain is now live. Nothing outside this
repository is blocking any more.

## Why the root redirect exists

A `CNAME` file in this repo changes the custom-domain root to this project site.
Without a guard, `https://dirrm.vintinuum.com/` would serve the Vintinuum
`index.html`, not the DirRM landing page.

GitHub Pages serves this repo as a **project site** at
`vintaclectic.github.io/vintinuum/`. A repo-root `CNAME` moves the custom-domain
view to that domain's root, so existing paths become:

- `vintaclectic.github.io/vintinuum/brain.html` → `<domain>/brain.html`

The router lives at the very top of `index.html` (shipped previously in 776be95,
which survived the CNAME revert). It is deliberately scoped: it fires only when
the first hostname label is `dirrm` AND the path is the root, and it jumps to a
**relative** `./dirrm.html` so it is correct under both the custom domain and the
project path. Every other host — `vintaclectic.github.io`, `vintinuum.com`,
`localhost` — keeps serving the normal Vintinuum home untouched.

Verify DNS: `dig +short dirrm.vintinuum.com` returns the four GitHub Pages IPs
(`185.199.108–111.153`). Where `dig` is unavailable (this WSL box), equivalently:
`getent ahostsv4 dirrm.vintinuum.com`.

Verify the binding: `gh api repos/vintaclectic/vintinuum/pages --jq .cname`
should print `dirrm.vintinuum.com`. If it prints `null`, the domain resolves but
no repository has claimed it, which is the 404-plus-wrong-certificate state
described at the top.

## Do not use the apex here

The `CNAME` should stay `dirrm.vintinuum.com`, not `vintinuum.com`. Moving this
Pages project to the apex would be a site-wide migration and would require
coordinating the hardcoded project-site URLs, extension fallback URL, and PWA.

## What works regardless of DNS

- **Live page:** `https://vintaclectic.github.io/vintinuum/dirrm.html`
- **Custom host path:** `https://dirrm.vintinuum.com/dirrm.html` — DNS live;
  serves as soon as Pages finishes binding the domain and issuing the cert
- **Custom host root:** `https://dirrm.vintinuum.com/` redirects to `/dirrm.html`
- **Deep link:** `…/dirrm.html?url=<MEDIA_URL>` plays immediately — the same
  contract as the player, so it keeps working verbatim after the domain moves.
- **Offline / self-hosted / LAN:** the launcher resolves the player next to
  whatever origin served the page, so the landing page works on a federated node
  or `file://`-adjacent host with no code change.
