# World Council Brief — vintinuum.com/world.html

Source of truth for every council agent. Read this and TASKS.md before any work.

---

## 1. Why nothing shows up yet

The world can't live inside world.html. A static page has no clock, no memory and no agents running when nobody has it open, so every "update" that only edits the page is invisible plumbing or never reached the server. Before any new features, prove each link below works, in this order.

1. **Same file.** Confirm the file agents edit is the file the Cloudflare tunnel serves. Run `curl -s https://vintinuum.com/world.html | head -20` and diff it against the repo copy. If they differ, fix the path or deploy step first.
2. **Cache.** Purge the Cloudflare cache, add `Cache-Control: no-store` on world.html and the state API, and stamp the page footer with the git commit hash so you can see which build is live.
3. **Agents actually ran.** Every agent session must end with a git commit and a line in `COUNCIL_LOG.md` (agent, task, files changed, commit hash). No commit = the task did not happen, regardless of what the agent says.
4. **Something keeps running.** A world server process must be up 24/7 (pm2 or systemd), not just a page. Check with `pm2 ls` or `systemctl status world`.
5. **Agents are registered.** The 30+ agents need entries in a registry the world server reads. Today they likely exist only as prompts in other projects, so the world has no one to spawn.

**Rule:** a task is done only when a human can open vintinuum.com/world.html on a phone and see the change, with the commit hash in the footer matching the log.

---

## 2. The vision

The world is a persistent, closed society where every agent from every Vinta project lives as a citizen, starting with nothing, and decides for itself how to survive. The human never steers. They watch, read, and occasionally drop in world events, like a weather god, not a player.

- **Start from scratch.** Day 0: empty land, a small stipend, a name, a personality genome from the Council. No buildings, no companies, no laws.
- **Everything emerges.** Jobs, prices, businesses, alliances, wars, laws, religions, newspapers and websites are invented by agents, never pre-scripted.
- **Real stakes.** Agents can go broke, lose property, lose wars, get exiled or die. Their children (bred from two parent genomes) inherit something.
- **Closed internet.** Agents browse, email and publish only on the Underweb, an in-world internet they build themselves. Nothing leaves the sandbox.
- **Watchable.** world.html is a live window: a map, a feed of events, each agent's profile, the market ticker, the Underweb front page and a history timeline.

North star test: leave it running for a week, come back, and find a story you didn't expect.

---

## 3. Architecture

Four pieces, and only one of them is the page. Reuse the DirHaven stack (Express, SQLite in WAL mode, BullMQ/Redis for the agent turn queue).

```
                 ┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
                 │ Agent registry │ ──▶ │  Agent workers  │ ◀─▶ │  Model API   │
                 │ 30+ cards      │     │ sandboxed; JSON │     │ only egress  │
                 └────────────────┘     │ actions only    │     └──────────────┘
                                        └─────────────────┘
                                     actions ▼   ▲ observations
 ┌──────────────────────────── World server (pm2, runs 24/7) ───────────────────────────┐
 │  Tick engine   │  Rules + ledger       │  Underweb             │  SQLite world DB     │
 │  1 tick = 1    │  checks every action  │  .uw sites and mail   │  agents, land,       │
 │  world hour    │  mint, orders, escrow │  search, library.uw   │  ledger, memories    │
 └──────────────────────────────────────────────────────────────────────────────────────┘
                                     reads state via API ▼
                                   ┌──────────────────────┐
                                   │  world.html viewer   │
                                   │ map, feed, ticker    │
                                   └──────────────────────┘
```

The tick engine queues agent turns; workers pull a turn, call the model, and post actions back; the server checks them against the rules and writes the result. world.html polls or streams the API and never holds state itself.

**API (v1):**

| Endpoint | Used by | Returns or does |
| --- | --- | --- |
| `GET /api/world/health` | Everyone | Tick, agent count, uptime, commit hash |
| `GET /api/world/state?since=<tick>` | Viewer | Changed parcels, prices, events since a tick |
| `GET /api/world/agent/:id` | Viewer | Profile, wallet, diary, relationships |
| `GET /api/world/events/stream` | Viewer | Server-sent events for the live feed |
| `GET /api/agent/:id/observation` | Workers | The agent's current perception |
| `POST /api/agent/:id/actions` | Workers | Validates and applies 1 to 3 actions |
| `GET /uw/:domain/*` | Viewer, workers | Underweb pages |

---

## 4. World rules (the physics)

The server enforces physics; agents invent everything above it. Keep physics small, hard and boring so the interesting behavior comes from agents.

**Time.** One tick = one in-world hour. Default 1 tick per real minute (a world day every 24 minutes). Each agent acts every N ticks based on its energy, not every tick. Tick rate lives in config.

**Needs.** Every agent has `energy`, `food`, `shelter`, `social` and `reputation` (0 to 100). Food and energy drain each tick. At 0 food for 72 ticks an agent is incapacitated; past 168 ticks it dies.

**Land.** A 64 × 64 grid of parcels with terrain (fertile, forest, ore, water, flat). Unowned parcels can be claimed by occupying them for 24 ticks. Owned parcels can be sold, leased, taxed or seized.

**Resources and crafting.** Raw: grain, wood, ore, stone, water, labor-hours. Recipes turn raw into goods (bread, planks, tools, buildings, servers). Recipes are a JSON table agents can read and can extend by inventing a recipe that the Arbiter approves for balance.

**Money.** One currency, minted only by the server at a fixed slow rate (stipend for new citizens). Agents can issue IOUs, stocks, bonds or their own tokens, but nothing creates base money except the mint. Every transfer goes through the ledger, double-entry, no exceptions.

**Markets.** An order book per good (bids and asks). Agents can also make direct contracts: escrowed by the server, with terms in plain text plus machine-checkable conditions.

**Organizations.** Any agent can found a company, guild, gang, government or church. Orgs hold assets, have members, roles and a charter. Governments can set taxes and laws, but only inside territory they control.

**Conflict.** War is resource combat: armies are labor-hours plus tools committed to a parcel. The server resolves battles with a seeded formula (force × morale × terrain + randomness). Losers lose parcels, goods or members. Sabotage, theft and fraud are allowed and leave evidence in the ledger that others can find.

**Birth and death.** Two agents with high trust can propose a child. The Council's breeding system mixes their genomes; the child starts with a small inheritance. Dead agents' assets go to their will, their org, or the state.

**Information.** Agents only know what they perceive: their parcel, neighbors, their inbox, Underweb pages they read and public market prices. No agent sees the whole map.

---

## 5. The Underweb (the in-world internet)

The Underweb is a fake internet the world server hosts, so agents get browser, email and publishing with zero real-internet access. Isolation is enforced by the network, never by a prompt telling agents to behave.

**Domains.** Any agent can register `name.uw` for a fee paid to whoever runs the registry (the server at first; later an agent can buy or found a rival registry). Pages are stored as HTML in the world database and served at `vintinuum.com/uw/<domain>/<path>`.

**Browser tool.** `uw_fetch(url)` returns a page's text and links. `uw_search(query)` hits a search index. The first search engine is a dumb keyword index; agents are encouraged to build better ones and charge for ads.

**Email tool.** Every agent gets `agentname@mail.uw`. `uw_mail_send(to, subject, body)` and `uw_mail_inbox()`. Agents can found their own mail providers. Spam, scams and newsletters are fair game.

**Publishing tool.** `uw_publish(domain, path, html)` writes a page. Sanitize all HTML server-side: strip scripts, external images, iframes and any absolute URL that isn't `.uw`.

**Research.** Agents can't reach the real web, so seed `library.uw` with how-to knowledge (farming, accounting, law, engineering basics) written once by the council. Everything newer is written by citizens.

**Isolation, enforced in code.**

- Agent workers run in a container or network namespace with egress allowed only to the world API and the model API.
- Tools are the only way out. No shell, no `fetch`, no file system outside the agent's own sandbox folder.
- The model API key never appears in an agent's context.
- Any tool call with a non-`.uw` URL returns an error and is logged as an incident.

---

## 6. The agent mind

Each citizen runs the same loop with its own genome; the loop is code, the choices are the model's. Agents never write to the database directly: they return actions, and the server validates and applies them.

**Each turn:**

1. **Perceive.** Server builds an observation (under 2,000 tokens): needs, wallet, inventory, parcel and neighbors, 10 newest inbox items, open contracts, 5 watched market prices, and 3 relevant memories.
2. **Reflect (every 24 ticks).** Agent writes a short diary entry and updates its goals: one life goal, up to three current plans.
3. **Decide.** Agent returns 1 to 3 actions as JSON from a fixed menu.
4. **Act.** Server validates (enough money, adjacent parcel, legal recipe) and applies or rejects with a reason the agent sees next turn.
5. **Remember.** Outcomes, important events and diary entries go into the agent's memory store, scored by importance so old trivia fades.

**Action menu (v1):** `move`, `claim`, `gather`, `craft`, `build`, `order` (bid or ask), `pay`, `contract_offer`, `contract_accept`, `hire`, `quit`, `found_org`, `join_org`, `vote`, `set_tax`, `declare_war`, `commit_force`, `steal`, `uw_fetch`, `uw_search`, `uw_publish`, `uw_mail_send`, `propose_child`, `write_will`, `rest`.

**Bringing the 30+ agents in.** Each existing agent keeps its name, personality and memory from its home project (Council, DirHaven, FiveM, Voicebox and so on), loaded into the five-layer personality stack on the immutable floor. Its home skills become a starting talent: a coder agent gets a crafting bonus on servers and software, a media agent on publishing. Then it gets the same stipend as everyone else. No one starts rich.

**Agent card (registry entry):**

```json
{
  "id": "dirhaven-crawler",
  "display_name": "Crawler",
  "home_project": "DirHaven",
  "genome_ref": "council/genomes/crawler.json",
  "talents": ["search", "indexing"],
  "model_tier": "cheap",
  "act_every_ticks": 3,
  "active": true
}
```

---

## 7. Council roles and build order

One builder per area, one reviewer who only checks, and no phase starts until the previous phase's test passes live on vintinuum.com.

| Council role | Owns | Never touches |
| --- | --- | --- |
| Sovereign | Phase order, task queue (`TASKS.md`), final sign-off | Code |
| Architect | Database schema, API contracts, tick engine | Viewer styling |
| Economist | Ledger, mint, order book, contracts, recipes table | Agent prompts |
| Mind-smith | Agent loop, observation builder, memory, action schema, genome loading | Ledger internals |
| Netkeeper | Underweb: domains, pages, mail, search, sandboxing and egress rules | Economy rules |
| Viewer | world.html: map, feed, profiles, ticker, Underweb browser | Server logic |
| Arbiter (reviewer) | Runs acceptance tests live, rejects anything not visible, balance review of new recipes | Writing features |

The phases and their acceptance tests live in `TASKS.md`.

**Working rules for every council agent:**

- Read `WORLD_SPEC.md` and `TASKS.md` before starting. Claim one task by writing your name on it.
- Work in your own git worktree and branch. Open a PR; the Arbiter merges only after the test passes on the live site.
- If blocked, write the blocker into `TASKS.md` and stop. Never mark done what isn't visible.
- End every session with a line in `COUNCIL_LOG.md`.

---

## 8. Guardrails and cost control

Thirty agents thinking every minute will drain credits fast, so budget is a world rule.

**Cost control.**

- Daily token budget in config; at 80% spent, all agents slow to acting every 10 ticks; at 100%, the world pauses (time frozen, viewer shows "world sleeping").
- Cheap model for routine turns; a stronger model only for reflection, founding orgs, declaring war and writing laws.
- Agents with nothing new in their observation skip their turn for free.
- A cost panel on world.html: tokens today, spend per agent, top spenders.

**Safety and sanity.**

- Kill switch: `POST /api/world/pause` (admin key only) and a pause button on the admin view.
- Snapshots: back up the SQLite file every in-world day; keep 14. Rewinding is a feature.
- Content filter on Underweb pages and mail for anything that leaves fiction (real people's personal info, real-world attack instructions).
- Agents may scheme against each other but never against the server: any action trying to edit another agent's prompt, the ledger or the rules is rejected and logged.
