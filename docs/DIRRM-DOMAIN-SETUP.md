# DirRM landing — custom domain setup

> ## ⚠️ SUPERSEDED 2026-08-20 — task GWJF3R6
>
> The arrangement described below (`CNAME` = `dirrm.vintinuum.com`) **caused a live
> regression**: because GitHub Pages force-301s the `*.github.io` project URL to the
> single CNAME domain, `vintinuum.com` → `github.io/vintinuum` → `dirrm.vintinuum.com`,
> so the apex landed visitors on the DirRM landing page instead of the Vintinuum
> front door.
>
> **`CNAME` is now `vintinuum.com`.** DirRM's stable, redirect-free home is
> **`https://vintinuum.com/dirrm.html`**. `dirrm.vintinuum.com` still resolves to
> Pages and now 301s to the apex, which is the intended graceful-legacy behaviour.
>
> Current runbook: **`/home/vinta/.claude/council-loop/state/docs/GWJF3R6-apex-dns.md`**
>
> This file is kept for its historical measurements. Do not follow its instructions.

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

### The one remaining step, and why it is not DNS

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

The redirect is therefore deliberately hostname-scoped. It affects only the
custom DirRM host's `/` and `/index.html`; every other Pages path keeps working.

Verify DNS: `dig +short dirrm.vintinuum.com` returns the four GitHub Pages IPs
(`185.199.108–111.153`). Where `dig` is unavailable (this WSL box), equivalently:
`getent ahostsv4 dirrm.vintinuum.com`.

Verify the binding: `gh api repos/vintaclectic/vintinuum/pages --jq .cname`
should print `dirrm.vintinuum.com`. If it prints `null`, the domain resolves but
no repository has claimed it, which is the 404-plus-wrong-certificate state
described at the top.

## ~~Do not use the apex here~~ — REVERSED 2026-08-20

*Historical position (kept for the record):* "The `CNAME` should stay
`dirrm.vintinuum.com`, not `vintinuum.com`. Moving this Pages project to the apex
would be a site-wide migration and would require coordinating the hardcoded
project-site URLs, extension fallback URL, and PWA."

**This was wrong, and it broke the apex.** A single Pages repo has exactly one
canonical CNAME domain, and Pages redirects every other host it serves to it —
so putting the product subdomain in `CNAME` hijacked the main site. The apex is
the brand root and must hold the CNAME. The "site-wide migration" it feared was
in practice four URL constants, all now updated.

## What works regardless of DNS

- **Live page:** `https://vintaclectic.github.io/vintinuum/dirrm.html`
- **Canonical DirRM home (use this):** `https://vintinuum.com/dirrm.html`
- **Legacy custom host:** `https://dirrm.vintinuum.com/` — still resolves to Pages,
  now 301s to `https://vintinuum.com/` since the apex holds the CNAME
- **Deep link:** `…/dirrm.html?url=<MEDIA_URL>` plays immediately — the same
  contract as the player, so it keeps working verbatim after the domain moves.
- **Offline / self-hosted / LAN:** the launcher resolves the player next to
  whatever origin served the page, so the landing page works on a federated node
  or `file://`-adjacent host with no code change.
