# DirRM landing — custom domain setup

Status as of **2026-08-14**: the landing page is **live and working** at

```
https://vintaclectic.github.io/vintinuum/dirrm.html
```

The custom domain is **not** wired up yet, deliberately. This document explains
exactly why, and the exact steps to finish it.

---

## What the task asked for vs. what is actually true

The task specified `dirrm.vintinuum.co`. Three facts, all measured, not assumed:

| Domain | Resolves? | Evidence |
|---|---|---|
| `vintinuum.co` | **NO — NXDOMAIN** | `socket.gethostbyname` → `Name or service not known` |
| `dirrm.vintinuum.co` | **NO — NXDOMAIN** | same |
| `vintinuum.com` | **YES** | `3.33.251.168` |
| `dirrm.vintinuum.com` | **NO record** | NXDOMAIN (apex exists, subdomain does not) |

So `vintinuum.co` is not a domain anyone owns. `vintinuum.com` **is** registered
(and is what the page's own comments referenced), but has no `dirrm` subdomain.

**Nothing was invented to paper over this.** A `CNAME` file pointing at a domain
that does not resolve would not have made the site reachable — it would have
taken the *working* site down (see below). The page therefore ships at its real,
verified URL, and flipping it to the custom domain is a two-step change once DNS
exists.

## Why no `CNAME` file was committed

**A `CNAME` file in this repo would break the entire live site**, not just add a
new address for DirRM.

GitHub Pages serves this repo as a **project site** at
`vintaclectic.github.io/vintinuum/`. Adding a repo-root `CNAME` moves the whole
site to that custom domain's **root**, so every existing path changes:

- `vintaclectic.github.io/vintinuum/brain.html` → `<domain>/brain.html`

That breaks **15 hardcoded `vintaclectic.github.io/vintinuum` URLs across 8
files** (`index.html`, `gallery.html`, `referral.html`, `lineage.html`,
`adapter-preview.html`, `dirrm-launch.js`, `body/onboarding/arrival-card.js`,
and `dirrm.html` itself) — plus the browser extension and the PWA, which are not
in this repo and would need coordinated redeploys.

`dirrm-launch.js` is the sharpest edge: its `CANONICAL_URL` constant is
`https://vintaclectic.github.io/vintinuum/dirrm-player.html`, the fallback every
off-origin caller (the extension, any federated node) uses to find the player.

This is the one part of the task that is **not cheaply reversible** — DNS
propagation and a broken extension in users' browsers are not a `git revert`.
Per the Decision Doctrine that makes it a reserved decision, so it is documented
here rather than guessed at.

## Recommended: a dedicated repo (keeps everything working)

A subdomain like `dirrm.vintinuum.com` is cleanest as its **own** Pages repo, so
the main site keeps its project-path URLs and nothing breaks:

1. Create repo `vintaclectic/dirrm`.
2. Copy in `dirrm.html` (renamed `index.html`), `dirrm-player.html`,
   `dirrm-launch.js`, `favicon.svg`.
   The launcher resolves the player as its **sibling**
   (`siblingPlayerUrl()` in `dirrm-launch.js`), so co-locating those three is all
   that is required — no code change.
3. Add a `CNAME` file containing exactly: `dirrm.vintinuum.com`
4. DNS at the registrar for `vintinuum.com`:
   `CNAME  dirrm  →  vintaclectic.github.io.`
5. Settings → Pages → Custom domain → `dirrm.vintinuum.com`, then tick
   **Enforce HTTPS** once the cert is issued (can take ~15 min).
6. In `dirrm.html`, update `og:url` + `<link rel="canonical">` to
   `https://dirrm.vintinuum.com/`.

Verify: `dig +short dirrm.vintinuum.com` returns the four GitHub Pages IPs
(`185.199.108–111.153`).

## Alternative: apex domain on THIS repo (breaks paths)

Only if the whole Vintinuum site should move to `vintinuum.com`. Then a root
`CNAME` here is correct — but it is a **site-wide migration**, and the 14 URLs
above, the extension's `CANONICAL_URL`, and the PWA must all be updated in the
same change. Do not do this just to give DirRM a subdomain.

## What already works today, with no DNS at all

- **Live page:** `https://vintaclectic.github.io/vintinuum/dirrm.html`
- **Deep link:** `…/dirrm.html?url=<MEDIA_URL>` plays immediately — the same
  contract as the player, so it keeps working verbatim after the domain moves.
- **Offline / self-hosted / LAN:** the launcher resolves the player next to
  whatever origin served the page, so the landing page works on a federated node
  or `file://`-adjacent host with no code change.
