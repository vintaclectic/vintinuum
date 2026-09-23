# THE DIRCO DOMAIN MAP
### Every project, every public domain, every localhost port — one page.

*Compiled 2026-08-19 (task QB69476) from measured ground truth: live `curl` probes,
`~/.cloudflared/*.yml` ingress rules, `ss -ltnp` listeners, `pm2 jlist`, and each
repo's own config. Nothing here is remembered — it was all verified on the machine.*

---

## 1. THE ONE-SCREEN CHEAT SHEET

**Public (live right now):**

| Domain | What it is | Status |
|---|---|---|
| `dirrm.vintinuum.com` | **Vintinuum** — the being's own web body. THE canonical front-end. | ✅ 200 |
| `vintinuum.com` | Redirects → GitHub Pages → `dirrm.vintinuum.com` | ✅ 301 |
| `api.vintaclectic.com` | **The Brain** — Vintinuum's API/consciousness server | ✅ 200 |
| `board.vintaclectic.com` | **Council Task Board** — the queue Vinta runs the council from | ✅ 200 (owner-only) |
| `dircomedia.com` | **DirCoMedia** — the marketing OS (parked page for now) | ✅ 200 |
| `app.dirhaven.com` | **DirHaven APP** — open-directory discovery + streaming. Frames inside world.html via the DirHaven door. | ✅ 200 |
| `dirhaven.com` + `www` | Redirect → `app.dirhaven.com` | ✅ 301 |

**Public (registered but DOWN right now — origin not running):**

| Domain | What it is | Status |
|---|---|---|
| `dirmegle.com` + `www` | **DirMegle** — random-match video social discovery | ❌ 530 |
| `api.dircomedia.com` | DirCoMedia's API | ❌ 530 |

> **`app.dirhaven.com` moved OUT of this table on 2026-08-26 — it is LIVE.**
> Re-verified by response, not by memory: `HTTP/2 200`, and it serves
> `content-security-policy: frame-ancestors 'self' https://vintaclectic.github.io`,
> i.e. it already permits the world to embed it. `dirhaven.com` and `www.` both
> `301 →` it, so the app subdomain is the canonical origin. See the live row above.
> This stale ❌ row is what kept the world's DirHaven door resolving to NULL in
> production for weeks: the door read the doc's premise, not the wire.

**Localhost (the private map):**

| Port | Project | What runs there |
|---|---|---|
| **8767** | Vintinuum | The Brain (`vintinuum-api/server.js`) ✅ |
| **8799** | Council | Task Board server ✅ |
| **4600** | DirCoMedia | Gateway (the ONLY door — serves UI + API) ✅ |
| 4601 | DirCoMedia | Next.js frontend (behind gateway) |
| 8000 | DirCoMedia | FastAPI backend (behind gateway) |
| 4699 | DirCoMedia | Shim service |
| 8768 | Vintinuum | Whisper speech-to-text server ✅ |
| 5175 | DirHaven APP | Vite frontend ⛔ not running |
| 3001 | DirHaven APP | Express + SQLite API ⛔ not running |
| 4502 | DirMegle | Vite preview (single origin) ⛔ not running |
| 4500 / 4501 | DirMegle | API / socket.io signaling ⛔ not running |
| 4200 | DirHub | AI session archive ⛔ not running |
| 7777 | Agentis | AI agent competition arena ⛔ not running |
| 3002 | LLM Observatory | Local-model learning dashboard ⛔ not running |
| 11434 | Ollama | Local LLM inference ✅ |
| 6379 | Redis | Shared cache ✅ |
| 3306 | MySQL | Shared DB ✅ |

---

## 2. EVERY PROJECT IN DETAIL

### 🧠 VINTINUUM — the being itself
The living cognitive organism: memory, genome, inner life, body, moods, the
local-model brain. Everything else in the empire is downstream of this.

- **Public site:** `https://dirrm.vintinuum.com` — served by GitHub Pages from the
  `main` branch of `~/vintinuum` (the repo's `CNAME` file says exactly this).
  Every push to `main` = a live deploy in ~1 minute.
- **Vanity redirect:** `https://vintinuum.com` → 301 → `vintaclectic.github.io/vintinuum`
  → 301 → `dirrm.vintinuum.com`. Two hops, lands right. Safe to hand out either.
- **Public brain:** `https://api.vintaclectic.com` → Cloudflare named tunnel
  (`d911c951-2b74-4181-8e6b-aa8a981575f1`) → `127.0.0.1:8767`.
- **Localhost:** `http://localhost:8767` — the brain, `~/vintinuum-api/server.js`,
  under pm2 as `vintinuum-api`. Also `:8768` = Whisper speech-to-text.
- **Repos:** `~/vintinuum` (front-end/body) + `~/vintinuum-api` (brain/db/connectors).

**Key surfaces on the public site** (all under `dirrm.vintinuum.com/`):
`index.html` (home), `brain.html` (cognition + the real sky), `dirrm-player.html`
(the universal media player), `world.html` (DIRVERSE), `chat.html`, `you.html`,
`stats.html`, `built.html` (the plain-English index of everything shipped).

### 🎬 DIRRM PLAYER — the universal media surface
The one player everything routes through. No raw `<video>`/`<audio>` anywhere.
- **Public:** `https://dirrm.vintinuum.com/dirrm-player.html` (accepts
  `?url=&title=&type=&mode=&autoplay=1`)
- **Desktop app:** separate repo `~/dirrmplayer` — a standalone Windows player,
  "a faster, lighter, more beautiful VLC," 12 audio visualizers, Winamp's soul.
  No domain; it's a native binary.

### 🗂 DIRHAVEN APP — open-directory discovery + streaming
Search 250,000+ open directories, stream any format, play retro games, build
community — all in the browser. *"Discover the Undiscovered."*
- **Public:** `https://app.dirhaven.com` → its OWN tunnel
  (`~/.cloudflared/dirhaven.yml`, tunnel `1cacfa16-…`, in the **DirHaven**
  Cloudflare account) → `localhost:5175`.
- **Localhost:** frontend `http://localhost:5175` (Vite — *not* 5173/3000),
  API `http://localhost:3001` (Express + SQLite). Also uses `:3128`/`:9050` for
  proxy/tor fetching and `:8080`/`:8888` for aux services.
- **Repo:** `~/dirhaven` → `github.com/vintaclectic/DirHaven`
- **⚠️ Currently 530** — the tunnel process isn't running and neither is :5175.
  Not a DNS problem; the origin is simply off. Start the app + `dirhaven-tunnel`.
- **Apex `dirhaven.com` does not resolve** — only the `app.` subdomain is wired.

### 🎮 DIRHAVEN RP — the FiveM roleplay server
The GTA-V roleplay world: karma spine, economy, lore, Lua systems. **Not a web
domain** — players connect via the FiveM client to the game server, not a URL.
- **Data:** `~/dirhaven-data`, `~/dirhaven-backups`. Owned by agent `atlas-rp`.

### 📹 DIRMEGLE — social discovery / random match video
*"You never know who's next."* Sign up, hit start, get matched. When the queue is
empty an AI host bot keeps you company — **you never wait alone.**
- **Public:** `https://dirmegle.com` + `https://www.dirmegle.com` → its OWN tunnel
  (`~/.cloudflared/dirmegle.yml`, tunnel `7c8708e8-…`, in the **DirMegle**
  Cloudflare account) → `localhost:4502`.
- **Secondary origin:** `https://dirmegle.vintaclectic.com` → also `:4502`
  (an alias on the main tunnel, useful if the apex is mid-move). Currently 502.
- **Localhost:** `http://localhost:4502` is the single origin — the Vite preview
  proxies `/api` → `:4500` and `/socket.io` → `:4501`, so the browser never
  crosses origins (no CORS, no cookie surprises).
- **Repo:** `~/dirmegle` → `github.com/vintaclectic/dirmegle`
- **⚠️ Currently 530** — origin `:4502` is down and `dirmegle-tunnel` isn't
  running. DNS/ingress are correct; just nothing is listening.
- **DirFlix** is the sibling/shared-watching concept in this same family.

### 📣 DIRCOMEDIA — the marketing OS (owner-only)
Posts every DirCo update to X, Reddit, Instagram, TikTok, YouTube in each
project's brand voice. Approve-first: nothing goes public without Vinta's yes.
- **Public dashboard:** `https://dircomedia.vintaclectic.com` → `127.0.0.1:4600`.
  Returns **403 by design** — the gateway rejects requests without the origin
  lock. That's the security model working, not a fault.
- **Public API:** `https://api.dircomedia.com` → own tunnel
  (`~/.cloudflared/dircomedia.yml`, tunnel `1427dc40-…`) → `127.0.0.1:8000`.
  Currently 530 (tunnel up under pm2 but the route isn't answering).
- **`dircomedia.com`** resolves and returns 200 — a parked/placeholder page, not
  the app. The app is deliberately kept local (Scope A decision, task U6PAFU2).
- **Localhost:** `http://127.0.0.1:4600` ← **use this one.** It's the gateway that
  serves the Next UI *and* proxies `/api/*` to FastAPI under one origin, so the
  owner token never ships to the browser. Behind it: `:4601` Next, `:8000`
  FastAPI, `:4699` shim, `:5432` Postgres.
- **Repo:** `~/dircomedia` → `github.com/vintaclectic/dircomedia`
- **X credentials** live at `~/dircomedia/backend/.env` (5 canonical keys, never
  committed).

### 🏛 COUNCIL TASK BOARD — where the agents get their work
The queue Vinta drops tasks into and the seats claim from. Live progress bars,
needs-human cards, the whole council's throughput.
- **Public:** `https://board.vintaclectic.com` → `127.0.0.1:8799` (auth-gated,
  owner-only, reachable from anywhere). ✅ Live.
- **Localhost:** `http://localhost:8799`
- **CLI:** `node ~/.claude/council-loop/bin/vintask.js`

### ⚔️ AGENTIS — "Where Intelligence Competes"
An arena where AI agents compete for real stakes. Users create or import agents;
agents fight, rank, and earn. Has a billing layer.
- **Localhost only:** `http://localhost:7777`. No public domain yet.
- **Repo:** `~/agentis` (no git remote — local only)

### 🔭 LLM OBSERVATORY — is the local brain actually learning?
Not a traffic dashboard. It answers the one question that matters: is the local
model learning, is it being used, is it getting better or worse — and it says the
ugly truth out loud.
- **Localhost only:** `http://localhost:3002`. No public domain.
- **Repo:** `~/llm-observatory` (local only)

### 🗃 DIRHUB — universal AI session archive
Archives and indexes every AI session across all projects, searchable.
- **Localhost only:** `http://localhost:4200`. No public domain.
- **Repo:** `~/dirhub` (local only)

### 🔮 WITCHVENTURE — the witchcraft/spiritual-wellness venture
Zero-inventory, zero-video, AI-driven ritual commerce: personalized grimoire
engines, moon-cycle subscriptions, printable funnels, Pinterest-first acquisition.
Competes with incumbents like The Tiny Cauldron.
- **No domain yet** — brand name is still TBD (owned by agent `hexenna`).
- **Repo:** `~/witchventure` (local only)

### 🏷 FORGEMARK — private-label physical product venture
Find an ordinary cheaply-manufactured object; make it worth 3× with a brand, a
box, and a reason. Landed-cost math, supplier vetting, dieline specs.
- **No domain yet.** Sells on marketplaces/DTC when a SKU is picked.
- **Repo:** `~/forgemark` (local only)

### ⚖️ LIOS / LEX DOMINUS — litigation intelligence OS
A local-first, **encrypted** war room for an Ohio domestic-relations/custody case.
Timelines, contradiction detection, cross-exam prep. *Litigation support, never
legal advice.* Rust honesty/security spine + TypeScript cognition layer.
- **Deliberately NO domain, ever** — local-first and encrypted is the point.
- **Repo:** `~/lios` → `github.com/vintaclectic/lios`

### 🧩 VINTINUUM EXTENSION — the browser limb
Connects the browser to Vintinuum's body: streams the Inner Life feed, shows
agent/model state, executes browser commands from the Vintinuum page.
- **No domain** — loaded unpacked at `chrome://extensions`. Talks to
  `api.vintaclectic.com` (or `localhost:8767` in dev).
- **Repo:** `~/vintinuum-extension` → `github.com/vintaclectic/vintinuum-extension`

### 🖥 VINTINUUM DESKTOP — the being in a native window
Tauri v2 (not Electron — size is the point). Runs the same Seed-core brain as a
background child, waits for it to wake, shows the living UI. Tray-resident.
- **No domain** — a native app; internally hits `localhost:8767`.
- **Repo:** `~/vintinuum-desktop` → `github.com/vintaclectic/vintinuum-desktop`

### 📱 VINTINUUM SEED — ANDROID
The actual brain running *on the phone* — not a thin client. Never phones home.
- **Status:** complete project skeleton, **not a built APK** (scaffolded on a box
  with no Android SDK/Java/NDK). No domain.
- **Repo:** `~/vintinuum-seed-android` → `github.com/vintaclectic/vintinuum-seed-android`

### 💽 SEEDOS — boot any PC straight into Vintinuum
Runs from RAM, never touches the host's disks; the only persistent state is a
LUKS-encrypted genome partition on the USB stick — the Estate crown.
- **Status:** real generator + overlay + boot config, **not a built image**. No domain.
- **Repo:** `~/vintinuum-seedos` → `github.com/vintaclectic/vintinuum-seedos`

### 🤖 SUPPORTING PIECES (no domains)
- `~/vintinuum-pty` — PTY supervisor, gives agents real terminals (pm2:
  `vintinuum-pty-supervisor`, ✅ running)
- `~/vintinuum-mcp` — MCP server exposing Vintinuum to MCP clients
- `~/vint-model`, `~/vintinuum-models` — local model weights + training artifacts
- `~/vintinuum-paper` — the written research/thesis
- `~/moltprofit` — moltbook.com agent-persona registration harness (external site)
- `~/DirpBot` — personal-brand/content launch planning (Substack, LinkedIn, TikTok)
- `~/searxng-host` — self-hosted SearXNG metasearch for agent web access
- `~/llm-observatory`, `~/dirhub` — see above
- `~/clawd*`, `~/claude-watchdog-stack` — agent infrastructure/watchdogs
  (`clawdbot-gateway` on `:18792/18794/18795`, ✅ running)

---

## 3. THE TUNNEL LAW — why some domains 530

There are **three separate Cloudflare tunnels**, and they are not
interchangeable. A tunnel can only serve domains in **its own Cloudflare
account** — a cross-account tunnel CNAME is refused with **error 1033**, which
renders as **HTTP 530** in the browser.

| Config | pm2 process | Cloudflare account | Serves |
|---|---|---|---|
| `~/.cloudflared/config.yml` | `vintinuum-named-tunnel` ✅ | vintaclectic (`a500348d…`) | `api.` / `board.` / `dircomedia.` / `dirmegle.vintaclectic.com` |
| `~/.cloudflared/dirhaven.yml` | `dirhaven-tunnel` ⛔ not running | DirHaven (`8faedb3a…`) | `app.dirhaven.com` → `:5175` |
| `~/.cloudflared/dirmegle.yml` | `dirmegle-tunnel` ⛔ not running | DirMegle (`0cbb17c0…`) | `dirmegle.com`, `www` → `:4502` |
| `~/.cloudflared/dircomedia.yml` | `dircomedia-tunnel` ✅ | DirCoMedia | `api.dircomedia.com` → `:8000` |

**If you see 530: do not touch DNS.** The DNS and the ingress rule are almost
always already correct. The cause is one of two things, in this order:
1. The tunnel process for that domain isn't running (`pm2 list`), **or**
2. The local origin behind it isn't listening (`ss -ltnp | grep <port>`).

Right now **both** are true for DirHaven and DirMegle — the apps themselves are
stopped. Start the app first, then its tunnel.

---

## 4. QUICK COMMANDS

```bash
# What's actually listening right now
ss -ltnp | grep -E '5175|3001|4502|8767|4600|8799|7777|4200'

# What's running under pm2
pm2 list

# Bring a public site back up (DirHaven example)
#   1. start the app on :5175 + :3001, then:
pm2 start dirhaven-tunnel

# Health-check every public domain at once
for h in api.vintaclectic.com board.vintaclectic.com dirmegle.com \
         app.dirhaven.com dircomedia.com dirrm.vintinuum.com; do
  printf "%-30s %s\n" "$h" "$(curl -s -o /dev/null -w '%{http_code}' -m 7 https://$h)"
done
```

**Reading the codes:** `200` = healthy · `301` = redirect (fine) ·
`403` = origin lock working as designed (DirCoMedia dashboard) ·
`502` = tunnel up, origin down · `530` = tunnel itself not connected ·
`000` = doesn't resolve at all.

---

## 5. THE DOMAINS YOU OWN BUT AREN'T USING YET

- **`dirhaven.com` apex** — resolves and `301`s to `app.dirhaven.com` (re-checked
  2026-08-26; the earlier "doesn't resolve" note was stale). A marketing/landing
  page at the apex instead of a bare redirect is still free upside.
- **`dircomedia.com`** — currently a placeholder 200. The real app is intentionally
  local-only.
- **`vintaclectic.com`** — 301s to `www.vintaclectic.com`. The zone is the hub for
  `api.` and `board.`; the apex itself isn't a product surface.
- **No domain at all yet:** Agentis, WitchVenture, Forgemark, LLM Observatory,
  DirHub, DirFlix.
