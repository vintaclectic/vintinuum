#!/usr/bin/env node
'use strict';
/**
 * LLM-ROUTER — multi-platform provider abstraction + intelligent routing.
 * ===========================================================================
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Before this file, `council-driver.sh` was single-provider: it routed by
 * stakes/tier across four Anthropic models and, on failure, fell DOWN one rung
 * of the same vendor's ladder. If Anthropic was out of credits, EVERY seat
 * stalled — the whole council was one vendor outage from zero throughput. That
 * is the opposite of "no failure allowed."
 *
 * This router replaces that with a two-axis decision:
 *
 *      TIER  (how much brain)  ×  PROVIDER (whose brain)
 *
 * and a failover LADDER that crosses vendors instead of just sliding down one.
 *
 * HOW IT BEATS CURSOR'S MODEL SELECTION
 * ---------------------------------------------------------------------------
 * Cursor makes the human pick a model from a dropdown, per request, with no
 * memory. It is a static choice applied to a dynamic problem. We instead:
 *   1. CLASSIFY the task (code / reasoning / security / speed / bulk / ui) from
 *      its own text — routing follows the WORK, not a dropdown.
 *   2. Route code->Codex, deep reasoning->Opus, speed->Flash, bulk->local $0,
 *      because each provider genuinely wins a different class of work.
 *   3. LEARN: every outcome is recorded, and a provider that keeps failing a
 *      given task-kind gets deprioritized for that kind (see `history`). Cursor
 *      has no equivalent — its dropdown never gets smarter.
 *   4. NEVER DEAD-END: the ladder always terminates in local Ollama ($0, no
 *      credential), so there is always a rung that can run.
 *   5. AUTO-COST: every hop is priced from the price DB (Q3 Option B), so spend
 *      is tracked per provider without anyone maintaining a spreadsheet.
 *
 * ZERO-FAILURE CONTRACT
 * ---------------------------------------------------------------------------
 * "No failure allowed" cannot mean "no provider ever errors" — that is not
 * purchasable. It means: no provider error is ever allowed to become a TASK
 * failure while any other capable provider is alive. We guarantee that with:
 *   - availability probing (a provider with no credential is SKIPPED, never
 *     "failed" — an unavailable rung is not an error),
 *   - a circuit breaker (a dead provider is stopped from eating every task's
 *     retry budget),
 *   - transient-vs-capability failure classification (transient retries the
 *     same rung; capability escalates to a different brain — retrying the same
 *     brain on a capability failure is how you burn tokens learning nothing),
 *   - a terminal local rung that needs no network and no key.
 *
 * USAGE (library)
 *      const R = require('./llm-router');
 *      const plan = R.route({ title, detail, stakes, model, provider, tier });
 *      // plan.ladder = [{provider, model, tier, bin, argv, budget}, ...]
 *
 * USAGE (CLI — this is what council-driver.sh calls)
 *      node llm-router.js plan   --title "..." --detail "..." --stakes high --json
 *      node llm-router.js exec   --taskfile <task.json> --cwd <dir>   # run the ladder
 *      node llm-router.js probe  [--json]                             # availability
 *      node llm-router.js cost   --provider anthropic --model claude-opus-5 \
 *                                --in 1000 --out 500                  # price a call
 *      node llm-router.js report [--today] [--json]                   # spend report
 *      node llm-router.js health [--json]                             # breaker state
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
// J3ZZF9Q — every platform's walls go to one human-readable ledger. Loaded
// defensively: a missing/broken ledger must never take routing down.
let LOCKOUT_LEDGER = null;
try { LOCKOUT_LEDGER = require('./lockout-ledger.js'); } catch { LOCKOUT_LEDGER = null; }

const ROOT = path.join(os.homedir(), '.claude', 'council-loop');
const CONFIG_PATH = process.env.COUNCIL_PROVIDERS_CONFIG || path.join(ROOT, 'config', 'providers.json');
const STATE_DIR = path.join(ROOT, 'state');
const HEALTH_PATH = process.env.COUNCIL_HEALTH_PATH || path.join(STATE_DIR, 'provider-health.json');
// COUNCIL_SPEND_PATH is a TEST SEAM (7RZB2DZ): verification scripts book synthetic
// rows into a throwaway file instead of polluting the real ledger. Unset in all
// production paths, so the default below is what the fleet actually uses.
const SPEND_PATH = process.env.COUNCIL_SPEND_PATH || path.join(STATE_DIR, 'provider-spend.jsonl');
const HISTORY_PATH = process.env.COUNCIL_HISTORY_PATH || path.join(STATE_DIR, 'route-history.json');
// LIVE execution-evidence (SNJS8SA, 2026-10-26) — see recordExecutionEvidence()
// below for why this exists separately from the frozen static snapshot in
// providers.json.
const EXEC_EVIDENCE_PATH = process.env.COUNCIL_EXEC_EVIDENCE_PATH || path.join(STATE_DIR, 'execution-evidence.json');

// SANDBOX ESCAPES THE AGENT NEEDS TO EXIST (task VJ92U23). A sandboxed provider
// CLI is only safe if it can still do the two things the loop protocol REQUIRES
// of every agent: record its own terminal status on the queue, and register any
// offspring it breeds. Both live outside the worktree, so both must be granted
// explicitly or the agent's work is unrecordable and the card thrashes forever.
// Deliberately narrow: the queue state + the agent roster, nothing else.
const WORKLOG_ROOT = process.env.COUNCIL_WORKLOG_ROOT
  || path.join(os.homedir(), 'vintinuum-api');

const CODEX_WRITABLE_ROOTS = (process.env.COUNCIL_CODEX_ADD_DIRS
  ? process.env.COUNCIL_CODEX_ADD_DIRS.split(':').filter(Boolean)
  : [STATE_DIR, path.join(os.homedir(), '.claude', 'agents'), WORKLOG_ROOT]);

// THE WORKTREE COMMIT ESCAPE (task HRMMK3X, 2026-08-27). VJ92U23 granted the
// queue + roster, which fixed *recording* a verdict. It did NOT fix *committing*
// one, because a git worktree does not own its own git metadata: `git add` writes
// <common>/worktrees/<name>/index[.lock] and `git commit` writes <common>/objects
// — BOTH outside the worktree, both read-only under `workspace-write`. So a codex
// seat could build the feature, verify it, record `done`... and never land a
// commit. Measured: ZBG52ZY died on exactly this, reporting
// "/home/vinta/vintinuum/.git/worktrees/Vintinuum-seat-5/index.lock ... mounted
// read-only", then hit the same wall on the worklog and exited BLOCKED with the
// work stranded in an uncommitted worktree.
//
// Resolved from the RUN's cwd, never hardcoded, so it is correct for every
// project and every seat, and yields nothing extra for a normal (non-worktree)
// repo where the common dir already lives inside cwd.
function gitWritableRoots(cwd) {
  try {
    const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd, encoding: 'utf8', timeout: 5000 });
    if (r.status !== 0) return [];
    const common = String(r.stdout || '').trim();
    // Only needed when the metadata is NOT already inside the writable worktree.
    if (!common || (cwd && !path.relative(cwd, common).startsWith('..'))) return [];
    return [common];
  } catch { return []; }
}

// ───────────────────────────── config ─────────────────────────────

const OVERRIDES_PATH = path.join(STATE_DIR, 'pricing-overrides.json');
const AFFINITY_OVERLAY_PATH = path.join(STATE_DIR, 'dynamic-affinity.json');
const BOARD_SETTINGS_PATH = path.join(STATE_DIR, 'board-settings.json');

let _cfg = null;
function config(force) {
  if (_cfg && !force) return _cfg;
  _cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  // PHASE 3 (2026-09-16) — PRICING OVERRIDES OVERLAY.
  // Static prices in providers.json go stale (baseline was 2026-08-13 for weeks,
  // gpt-6-astra was priced by estimation for a full generation). This overlay
  // lets `bin/refresh-prices.js` (weekly cron) update in/out/cache_read/ctx per
  // "<provider>/<model>" without touching the main config or its comments. If
  // the overlay file is absent we silently keep the config prices — no failure
  // mode where a missing override breaks routing.
  try {
    if (fs.existsSync(OVERRIDES_PATH)) {
      const ov = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
      for (const [key, patch] of Object.entries(ov.models || {})) {
        const [prov, model] = key.split('/');
        const m = _cfg.providers?.[prov]?.models?.[model];
        if (!m) continue;
        for (const f of ['in', 'out', 'cache_read', 'cache_write', 'ctx']) {
          if (typeof patch[f] === 'number') m[f] = patch[f];
        }
        if (patch.verified) m._verified = patch.verified;
        if (patch.source)   m._price_source = patch.source;
      }
      if (ov.prices_verified) _cfg.prices_verified = ov.prices_verified;
    }
  } catch (e) { /* never let a bad overlay break routing */ }
  // PHASE 5 (2026-09-17) — BOARD SETTINGS OVERLAY.
  // User-facing runtime settings from state/board-settings.json (managed by the
  // board's Settings panel). Currently supports `openai_auth_priority`, which
  // rewrites providers.openai.auth_priority — the router's per-invocation auth
  // fallback iteration reads that array. Any provider-scoped setting can slot
  // in here later without touching providers.json. Missing/empty file → config
  // defaults unchanged.
  try {
    if (fs.existsSync(BOARD_SETTINGS_PATH)) {
      const s = JSON.parse(fs.readFileSync(BOARD_SETTINGS_PATH, 'utf8'));
      if (Array.isArray(s.openai_auth_priority) && s.openai_auth_priority.length && _cfg.providers && _cfg.providers.openai) {
        _cfg.providers.openai.auth_priority = s.openai_auth_priority;
        _cfg.providers.openai._auth_priority_source = 'board-settings';
      }
    }
  } catch { /* never let a bad settings file break routing */ }

  // PHASE 4 (2026-09-16) — DYNAMIC AFFINITY OVERLAY.
  // `bin/dynamic-affinity.js` (weekly cron) writes learned prefer-lists per kind
  // to this overlay based on measured per-kind performance. Router merges them
  // over the hand-coded task_affinity.<kind>.prefer if present. GUARDRAIL: the
  // overlay's prefer for a kind is used ONLY if it is a superset of the config's
  // prefer (never drops a hand-coded provider) — a bad week of data can reorder
  // priorities, but it cannot make anthropic disappear from the code affinity.
  try {
    if (fs.existsSync(AFFINITY_OVERLAY_PATH)) {
      const ov = JSON.parse(fs.readFileSync(AFFINITY_OVERLAY_PATH, 'utf8'));
      for (const [kind, patch] of Object.entries(ov.kinds || {})) {
        const cfgAff = _cfg.task_affinity?.[kind];
        if (!cfgAff || !Array.isArray(patch.prefer)) continue;
        const cfgPrefer = cfgAff.prefer || [];
        const stillHasAll = cfgPrefer.every(p => patch.prefer.includes(p));
        if (!stillHasAll) continue;
        cfgAff.prefer = patch.prefer;
        cfgAff._learned_at = patch.learned_at;
        cfgAff._learned_from_samples = patch.samples;
      }
    }
  } catch (e) { /* never let a bad overlay break routing */ }
  return _cfg;
}

const TIER_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4'];
const tierIdx = (t) => Math.max(0, TIER_ORDER.indexOf(String(t || 'L2').toUpperCase()));

// ── CREDENTIAL FILE LOADER (2026-08-14) ────────────────────────────────────
// Credentials were resolved from process.env ONLY. But the council runs from
// cron/tmux, which inherit a bare environment — so xAI/Gemini keys had nowhere
// to live: exporting them in an interactive shell never reached a seat, and
// dropping them in a file did nothing because nothing read it. Both providers
// sat permanently DARK ("missing credential") despite being fully configured.
// Now a single owner-only file is loaded once at startup and merged UNDER the
// real env (a genuine exported var always wins, so this can never shadow a
// deliberate override). Create ~/.claude/council-loop/.env with e.g.
//   XAI_API_KEY=xai-...
//   GEMINI_API_KEY=AIza...
// and every seat picks it up on next launch. Never commit that file.
(function loadCouncilEnv() {
  try {
    const fs = require('fs'), path = require('path');
    const f = path.join(process.env.HOME || '', '.claude', 'council-loop', '.env');
    if (!fs.existsSync(f)) return;
    for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k] && v) process.env[k] = v;   // real env wins
    }
  } catch { /* never let credential loading break routing */ }
})();

// ── PATH EXTENSION (2026-09-15) ────────────────────────────────────────────
// The router runs from cron/systemd/tmux, which inherit a bare PATH that does
// NOT include nvm's bin dir. That made `binExists('codex')` return false for
// every task and marked openai permanently "binary not found: codex" — the
// real reason "astra" was never routed to. Prepend the caller's node bindir,
// every installed nvm node version's bindir (so system-node callers work too,
// not just nvm-activated ones), plus the two conventional user-local script
// dirs, so any nvm/pip/npm-global provider CLI is discoverable regardless of
// caller. Applied here (not in the config) so it also flows to every spawn()
// below via process.env inheritance.
(function extendPath() {
  const extras = [
    path.dirname(process.execPath),
    path.join(process.env.HOME || '', '.local', 'bin'),
    path.join(process.env.HOME || '', '.npm-global', 'bin'),
  ];
  try {
    const nvmRoot = path.join(process.env.HOME || '', '.nvm', 'versions', 'node');
    if (fs.existsSync(nvmRoot)) {
      for (const ver of fs.readdirSync(nvmRoot)) {
        extras.push(path.join(nvmRoot, ver, 'bin'));
      }
    }
  } catch { /* nvm not installed — that's fine */ }
  extras.push(process.env.PATH || '');
  process.env.PATH = extras.filter(Boolean).join(':');
})();

/** Read a credential for a provider from env, honoring fallback env names. */
function credentialFor(pv) {
  const c = pv.credential || {};
  if (c.type === 'none') return { ok: true, via: 'none' };
  const names = [c.env, ...(c.fallback_env || [])].filter(Boolean);
  for (const n of names) {
    if (process.env[n] && String(process.env[n]).trim()) return { ok: true, via: n };
  }
  // `oauth-or-env` providers (Claude Code, Codex) are usually logged in at the CLI
  // level, so a missing env key is NOT disqualifying — binary presence decides.
  if (c.type === 'oauth-or-env') return { ok: true, via: 'oauth/cli' };
  return { ok: false, via: null, missing: names };
}

function binExists(bin) {
  if (!bin) return true; // http adapters need no binary
  const r = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return r.status === 0 && String(r.stdout).trim().length > 0;
}

// ───────────────────────── health / circuit breaker ─────────────────────────

function readJSON(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
function writeJSONAtomic(p, obj) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, p);
  } catch { /* health is best-effort; never block routing on a write failure */ }
}

function health() { return readJSON(HEALTH_PATH, { providers: {} }); }

/**
 * LOCKOUT STATE (2026-09-25) — a coarser view than the per-provider breaker.
 *
 * The breaker asks "is this provider healthy right now?"
 * lockoutState() asks "is the fleet WEDGED — enough of our top providers are
 * down that we should stop attempting anything that needs them, and let seats
 * work through cheaper stuff instead?"
 *
 * We consider a provider LOCKED when ANY of:
 *   • consecutive_failures ≥ cfg.policy.circuit_breaker.consecutive_failures_to_open
 *     AND last_ok_at is older than lockout_look_back_ms (60 min default), OR
 *   • breaker walled_until is in the future (an explicit rate-limit wall we
 *     parsed from an error message with a reset time), OR
 *   • last_error matches a rate-limit / usage-cap phrase and consec ≥ 2 (a
 *     hard usage cap is different from a transient network flake — even a
 *     handful of these means real ceiling).
 *
 * Returns:
 *   { level: 'none' | 'partial' | 'severe',
 *     locked_providers: [...names...],
 *     available_top_tier: 'L4'|'L3'|'L2'|'L1'|'L0',   // best rung still reachable
 *     tier_ceiling_now: 'L4'|'L3'|'L2'                // effective cap for downgrade-eligible kinds
 *   }
 *
 * `severe` = ≥2 top providers (rank 1 or 2) locked
 * `partial` = 1 top provider locked (some degrade, ladder still works)
 * `none`    = all top providers reachable
 */
const LOCKOUT_LOOK_BACK_MS = 60 * 60 * 1000;
// J3ZZF9Q: account-level walls that are not "rate limit" by name but lock the
// platform just the same (session window, credits, expired login). Ledger-only —
// deliberately NOT folded into RATE_LIMIT_HINTS, which also drives routing.
const LOCKOUT_EXTRA = /(session limit|out of (extra )?credits|credit balance|insufficient.?quota|billing|oauth session expired|failed to authenticate|not logged in)/i;
const RATE_LIMIT_HINTS = /(rate.?limit|usage.?limit|quota|too many requests|429|resets? (at|in)|slow down)/i;
function lockoutState() {
  try {
    const cfg = config();
    const h = health();
    const breakerCfg = ((cfg.policy || {}).circuit_breaker || {});
    const openThresh = Number(breakerCfg.consecutive_failures_to_open || 3);
    const now = Date.now();
    const locked = [];
    for (const [name, s] of Object.entries((h.providers || {}))) {
      const consec = Number(s.consecutive_failures || 0);
      const walledUntil = Number(s.walled_until || 0);
      const lastOk = Number(s.last_ok_at || 0);
      const lastErr = String(s.last_error || '');
      const staleOK = lastOk > 0 && (now - lastOk) > LOCKOUT_LOOK_BACK_MS;
      const walled = walledUntil > now;
      const rateLimited = RATE_LIMIT_HINTS.test(lastErr) && consec >= 2;
      // ── A CAPABILITY FAILURE IS NOT A LOCKOUT (Vinta 2026-09-25) ──────────
      // MEASURED FALSE LOCKOUT. This function reported
      //   level: severe, locked: [google, openai, anthropic, ollama], ceiling: L2
      // which clamped EVERY downgrade-eligible kind (code/ui/ops/general/speed) to
      // L2, where the cheapest L2 model on the box is xai/grok-build-0.1 at $1/$2.
      // Result: every task on the board routed to grok-build-0.1 regardless of kind,
      // and because grok has no tool-execution channel here it narrated instead of
      // working — 0 of 10 xai runs produced a single tool call, vs 138 of 138 for
      // anthropic. Vinta saw "every fucking task routed to grok".
      //
      // WHY IT WAS WRONG: `consecutive_failures` counts CAPABILITY failures — the
      // model ran, spoke, and exited non-zero (see classifyFailure). That is one
      // MODEL misbehaving, not the PROVIDER being unreachable. anthropic's own
      // last_error was literally "capability on anthropic/claude-fable-5-1" — one
      // model — while `claude -p --model claude-opus-5` answered ALIVE on demand,
      // and walled_until was 0 for every provider (nothing was rate-limited).
      // Worse, it self-reinforced: only the provider being USED refreshes last_ok,
      // so once the clamp picked xai, everyone else went stale and stayed "locked".
      //
      // A lockout now requires EVIDENCE OF UNREACHABILITY, which is what the
      // ceiling was designed for: an explicit wall (rate-limit/usage cap) or a
      // rate-limit error string. Capability failures still open per-MODEL breakers
      // and still drive failover — they just no longer condemn the whole vendor.
      // Set COUNCIL_LOCKOUT_ON_CAPABILITY=1 to restore the old behaviour.
      const capabilityOnly = /capability on /i.test(lastErr);
      const countConsec = process.env.COUNCIL_LOCKOUT_ON_CAPABILITY === '1'
        ? (consec >= openThresh && (staleOK || lastOk === 0))
        : (!capabilityOnly && consec >= openThresh && (staleOK || lastOk === 0));
      // ── A LOCKOUT MUST BE RECENT TO HOLD (5K7VP5M, Vinta 2026-10-09) ────
      // MEASURED SELF-SUSTAINING LOCKOUT. The ladder filter in route() removes
      // every locked provider from ladder building, so a locked provider is
      // never called, so its last_ok_at never refreshes and consecutive_failures
      // never resets — which is exactly the condition that keeps it locked.
      // The old comment beside that filter claimed "they still get a periodic
      // probe path via breaker half-open"; no such path exists (grep 'half-open'
      // in this file: the breaker state is only ever READ by availability(),
      // whose answer this filter then overwrites). Result on the live board:
      //   openai  consecutive_failures=87, last_at 2026-09-26 07:55Z, ZERO calls
      //           for 13 days while `codex exec` answered "OK" on both auth lanes
      //   google  locked since 2026-10-03 while the key returned HTTP 200 live
      //   ollama  locked since 2026-08-19
      // and the spend panel showed nothing but anthropic + xai from 2026-09-26 on.
      // The fix: a failure streak only locks a provider while the LAST attempt is
      // inside the breaker cooldown. Once cooldown_secs have passed with no call,
      // the provider is unlocked and the next task that would route to it is the
      // probe; a failed probe refreshes last_at (re-locking it for one more
      // cooldown), a successful one zeroes the streak. One probe per cooldown per
      // provider is the documented half-open contract, now actually honoured.
      // A dated wall (walled_until) still outranks this: that is the provider
      // telling us WHEN to come back, and we do not probe before then.
      const lastAt = Number(s.last_at || 0);
      const cooldownMs = Number(breakerCfg.cooldown_secs || 900) * 1000;
      const recentlyFailed = lastAt > 0 && (now - lastAt) < cooldownMs;
      if (walled || ((rateLimited || countConsec) && recentlyFailed)) {
        locked.push(name);
      }
    }
    // "Top" providers are ranks 1-3 (anthropic, openai, xai in the default
    // config). Local Ollama is rank 99 and never counts for lockout severity —
    // its being broken is a separate concern.
    const topLocked = locked.filter(n => {
      const rank = (cfg.providers?.[n]?.rank ?? 99);
      return rank <= 3;
    });
    const level = topLocked.length >= 2 ? 'severe' : (topLocked.length === 1 ? 'partial' : 'none');
    // Best tier still reachable = the max tier across NON-locked providers.
    const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4'];
    let bestIdx = -1;
    for (const [name, pv] of Object.entries(cfg.providers || {})) {
      if (locked.includes(name)) continue;
      if (pv.enabled === false) continue;
      for (const m of Object.values(pv.models || {})) {
        const idx = TIERS.indexOf(String(m.tier || 'L2').toUpperCase());
        if (idx > bestIdx) bestIdx = idx;
      }
    }
    const availableTop = bestIdx >= 0 ? TIERS[bestIdx] : 'L0';
    // Effective ceiling for downgrade-eligible kinds under lockout. Severe →
    // clamp to L2 (Sonnet-class / grok-4.3). Partial → clamp to L3.
    const ceiling = level === 'severe' ? 'L2' : (level === 'partial' ? 'L3' : 'L4');
    return { level, locked_providers: locked, available_top_tier: availableTop, tier_ceiling_now: ceiling };
  } catch {
    // Any error here MUST leave routing unchanged — a broken lockout probe is
    // strictly less harmful than a false-lockout-triggered downgrade.
    return { level: 'none', locked_providers: [], available_top_tier: 'L4', tier_ceiling_now: 'L4' };
  }
}

/**
 * Circuit breaker state for one provider.
 *   closed    — healthy, use it
 *   open      — too many consecutive failures; skip until cooldown elapses
 *   half-open — cooldown elapsed; allow ONE probe call through. If it succeeds
 *               the breaker closes; if it fails it re-opens for another cooldown.
 * Half-open is what lets a recovered provider rejoin the ladder automatically,
 * with no human clicking "resume" — which is the whole point of zero-failure.
 */
/**
 * HARD WALL (2026-08-19). A 15-minute breaker cooldown is right for a flaky
 * provider and WRONG for one that has told us the exact wall-clock time it comes
 * back ("try again at Aug 20th, 2026 11:47 PM"). Re-probing a dated wall every
 * 15 min burned a seat's whole run on a guaranteed failure, over and over — 108
 * consecutive failures on openai. When a provider names its reset, honor it:
 * stay closed to it until that instant, then rejoin the ladder automatically.
 */
function walledUntil(p) {
  const t = p && Number(p.walled_until || 0);
  return Number.isFinite(t) && t > Date.now() ? t : 0;
}

/** Parse a human reset time out of a provider's own error text. Returns epoch ms or 0. */
function parseResetAt(text) {
  const s = String(text || '');
  // "try again at Aug 20th, 2026 11:47 PM"  /  "try again at 2026-08-20 23:47"
  let m = s.match(/try again at\s+([A-Z][a-z]{2,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i);
  if (!m) m = s.match(/try again at\s+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)/i);
  if (!m) return 0;
  const cleaned = m[1].replace(/(\d{1,2})(st|nd|rd|th)/i, '$1');
  const t = Date.parse(cleaned);
  return Number.isFinite(t) && t > Date.now() ? t : 0;
}

function breakerState(name, h) {
  const cb = config().policy.circuit_breaker;
  const p = (h || health()).providers[name];
  if (!p) return 'closed';
  // A dated wall outranks the cooldown heuristic entirely.
  if (walledUntil(p)) return 'open';
  if ((p.consecutive_failures || 0) < cb.consecutive_failures_to_open) return 'closed';
  const since = Date.now() - (p.opened_at || 0);
  if (since >= cb.cooldown_secs * 1000) return cb.half_open_probe ? 'half-open' : 'closed';
  return 'open';
}

function recordOutcome(name, ok, meta) {
  const cb = config().policy.circuit_breaker;
  const h = health();
  const p = (h.providers[name] = h.providers[name] || { consecutive_failures: 0, calls: 0, failures: 0 });
  p.calls = (p.calls || 0) + 1;
  p.last_at = Date.now();
  if (ok) {
    p.consecutive_failures = 0;
    p.opened_at = 0;
    p.walled_until = 0;
    p.last_ok_at = Date.now();
    // J3ZZF9Q: a success is the end of any lockout open on this provider.
    if (LOCKOUT_LEDGER) LOCKOUT_LEDGER.end({ provider: name, source: 'router' });
  } else {
    p.failures = (p.failures || 0) + 1;
    p.consecutive_failures = (p.consecutive_failures || 0) + 1;
    const errText = String((meta && meta.error) || '');
    p.last_error = errText.slice(0, 300);
    // If the provider named the wall-clock instant it returns, record it so we
    // stop re-probing a guaranteed failure every cooldown window.
    const resetAt = parseResetAt(errText);
    if (resetAt) p.walled_until = resetAt;
    // J3ZZF9Q: a rate/usage/quota error or a dated wall IS a lockout on this
    // platform — record it where a human can read it later. Capability failures
    // (one model misbehaving) are not lockouts and are deliberately not written.
    if (LOCKOUT_LEDGER && (resetAt || RATE_LIMIT_HINTS.test(errText) || LOCKOUT_EXTRA.test(errText))) {
      LOCKOUT_LEDGER.start({ provider: name, model: (meta && meta.model) || null,
        kind: resetAt ? 'walled' : (LOCKOUT_EXTRA.test(errText) ? 'account' : 'rate-limit'), reason: errText, reset_at: resetAt || null,
        source: 'router' });
    }
    // Refresh opened_at on EVERY failure past the threshold, not only the first
    // (5K7VP5M). With `!p.opened_at` the stamp stayed at the ORIGINAL open time,
    // so after one cooldown the breaker was permanently 'half-open' — the
    // documented "if the probe fails it re-opens for another cooldown" never
    // happened. Measured: openai opened_at=2026-09-20T07:33Z was still the stamp
    // on 2026-10-09 after 88 consecutive failures.
    if (p.consecutive_failures >= cb.consecutive_failures_to_open) {
      p.opened_at = Date.now();
    }
  }
  writeJSONAtomic(HEALTH_PATH, h);
  return p;
}

// ───────────────────────────── availability ─────────────────────────────

/**
 * Is this provider usable RIGHT NOW? Three independent gates, all cheap and
 * local (no network, no tokens): enabled flag, credential, binary.
 * Deliberately does NOT make a live API call — probing every provider on every
 * task would itself cost money and latency. Liveness is learned from real task
 * outcomes via the circuit breaker instead.
 */
function availability(name, pv) {
  pv = pv || config().providers[name];
  if (!pv) return { available: false, reason: 'unknown provider' };
  if (pv.enabled === false) return { available: false, reason: 'disabled in config' };
  const cred = credentialFor(pv);
  if (!cred.ok) {
    return { available: false, reason: `missing credential (${(cred.missing || []).join(' or ')})`, blocker: true };
  }
  if (pv.bin && !binExists(pv.bin)) {
    return { available: false, reason: `binary not found: ${pv.bin}`, blocker: true };
  }
  const st = breakerState(name);
  if (st === 'open') {
    const p = health().providers[name] || {};
    const w = walledUntil(p);
    if (w) return { available: false, reason: `walled by provider until ${new Date(w).toISOString()}`, transient: true, walled_until: w };
    return { available: false, reason: 'circuit breaker open (recent failures)', transient: true };
  }
  return { available: true, via: cred.via, breaker: st };
}

function probeAll() {
  const cfg = config();
  const out = {};
  for (const [name, pv] of Object.entries(cfg.providers)) {
    out[name] = Object.assign({ label: pv.label, rank: pv.rank }, availability(name, pv));
  }
  return out;
}

// ───────────────────────── task classification ─────────────────────────

/**
 * Classify a task into an affinity kind from its own text. This is the piece
 * Cursor has no analogue for: the routing decision is derived from the WORK,
 * not from a human's dropdown selection.
 *
 * Scoring, not first-match: a task titled "fix the auth endpoint" hits both
 * `code` and `security`; we want security (higher stakes wins ties via the
 * force_min_tier flag downstream), so every matching signal adds weight and the
 * highest total wins. Ties break toward the more conservative (higher min_tier)
 * kind, because under-brained security work is far more expensive than
 * over-brained formatting work.
 */
function classify(task) {
  const cfg = config();
  if (task.kind && cfg.task_affinity[task.kind] && !task.kind.startsWith('_')) {
    return { kind: task.kind, score: 0, scores: {}, source: 'explicit-kind' };
  }
  const text = `${task.title || ''} ${task.detail || ''} ${task.acceptance || ''}`.toLowerCase();
  const scores = {};
  for (const [kind, spec] of Object.entries(cfg.task_affinity)) {
    if (kind.startsWith('_')) continue;
    let s = 0;
    for (const sig of spec.signals || []) {
      try { if (new RegExp(sig, 'i').test(text)) s += 1; } catch { /* bad regex in config is not fatal */ }
    }
    if (s > 0) scores[kind] = s;
  }
  if (!Object.keys(scores).length) return { kind: 'general', score: 0, scores };
  const best = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // tie -> the kind demanding the higher minimum tier wins (conservative)
    const ta = tierIdx(cfg.task_affinity[a[0]].min_tier);
    const tb = tierIdx(cfg.task_affinity[b[0]].min_tier);
    return tb - ta;
  })[0];
  return { kind: best[0], score: best[1], scores };
}

/** Map the legacy stakes field onto a tier so old cards keep working verbatim. */
function tierFromStakes(stakes) {
  const s = String(stakes || '').toLowerCase();
  if (s === 'critical') return 'L4';
  if (s === 'high') return 'L3';
  if (s === 'low') return 'L1';
  return 'L2';
}

/**
 * Resolve a user-supplied model string ("opus", "sonnet", "codex", "flash") to
 * a concrete {provider, model}. Backward compatibility lives here: every alias
 * the old driver understood still resolves to the same Anthropic model.
 */
function resolveModel(str) {
  if (!str) return null;
  const q = String(str).toLowerCase().trim();
  const cfg = config();
  for (const [pname, pv] of Object.entries(cfg.providers)) {
    for (const [mid, m] of Object.entries(pv.models || {})) {
      if (mid.toLowerCase() === q) return { provider: pname, model: mid, tier: m.tier };
      if ((m.aliases || []).some(a => a.toLowerCase() === q)) return { provider: pname, model: mid, tier: m.tier };
    }
  }
  return null;
}

/**
 * Pick the best model of a provider at (or nearest above) a target tier.
 *
 * `topBrain` (Vinta directive 2026-08-14, NEKQ9D2 — "why are we relying on old
 * models almost ALWAYS… i don't want to be THAT CHEAP… if it can't [do it], don't
 * still resort to 4.5"):
 *   - false (the frugal default for L0–L2 work): pick the CHEAPEST model whose
 *     tier >= target. Sonnet/Haiku/local are correct for mechanical work; paying
 *     Opus prices for a rename is waste (frugal-max doctrine).
 *   - true (capability-critical work — see BRAIN_CEILING_TIER): pick the STRONGEST
 *     model this provider has at or above the target tier. THIS is what finally
 *     makes Opus 5 (L4) get chosen for reasoning/security instead of silently
 *     settling on the cheaper Opus 4.8 (L3). The whole point Vinta was furious
 *     about: the newest, best brain must actually run when the work deserves it.
 * The rule is CAPABILITY-MATCHED, not always-max: cheap where cheap is genuinely
 * sufficient, top-brain where it isn't — and NEVER a silent downgrade below the
 * floor when the top brain is unavailable (we degrade across VENDORS at the same
 * tier first; see buildLadder).
 */
// AUTO-DEMOTE thresholds. A (kind × provider × model) with at least MIN_SAMPLES
// recorded attempts and a Laplace-smoothed success rate below FLOOR is treated
// as "known bad for this kind" and REMOVED from that kind's candidate set at
// this provider. Chosen conservatively: 5 samples is enough to distinguish a
// broken model from bad luck (a 50%-real-rate model reaching <0.25 by chance in
// 5 tries is <5% probability), and 0.25 is well below the neutral 0.5 that an
// unproven model floats at, so an unproven model is never punished for being
// unproven. Overridable via env for experiments / integration tests.
const DEMOTE_MIN_SAMPLES = Number(process.env.COUNCIL_DEMOTE_MIN_SAMPLES || 5);
const DEMOTE_FLOOR = Number(process.env.COUNCIL_DEMOTE_FLOOR || 0.25);

function isDemoted(kind, provider, model) {
  const p = (historyStats().kinds[kind] || {})[`${provider}/${model}`];
  if (!p) return false;
  if ((p.ok || 0) + (p.fail || 0) < DEMOTE_MIN_SAMPLES) return false;
  return successRate(kind, provider, model) < DEMOTE_FLOOR;
}

// ─────────────── local model inventory (7RZB2DZ, 2026-09-20) ───────────────

/**
 * THE PHANTOM-MODEL GUARD.
 *
 * A model that is configured but NOT pulled on this box is not a weak rung — it
 * is an ABSENT one. Historically the router could not tell the difference, so it
 * placed e.g. `llama3.1:8b` on the ladder, `/v1/chat/completions` answered
 * 404 `model not found`, and that counted as a FAILED HOP: it burned wall-clock,
 * incremented the breaker toward opening, and polluted route-history with a
 * failure the model never had a chance to avoid. Measured in state/provider-spend.jsonl:
 * 27 attempts at llama3.1:8b with 2 ok, 4 at qwen3:8b with 1 ok.
 *
 * An uninstalled model must behave exactly like a missing credential: UNAVAILABLE
 * and skipped silently, never attempted and failed. That is the existing
 * zero-failure contract, applied one level down (provider -> model).
 *
 * Cached for INVENTORY_TTL_MS because route() can call pickModel many times per
 * task and this must never become a per-rung network round-trip. Cheap and local
 * (loopback HTTP), in the spirit of availability(): no tokens, no cost.
 *
 * FAIL-OPEN BY DESIGN: if Ollama is unreachable/erroring we return null, which
 * means "inventory unknown" and every model is allowed through. Failing CLOSED
 * here would delete the $0 floor the moment the probe hiccuped, and the floor is
 * precisely what makes the ladder guaranteed to terminate. An unreachable Ollama
 * is already handled correctly downstream as a normal transient failure.
 */
const INVENTORY_TTL_MS = 60000;
let _inventoryCache = { at: 0, models: null, base: null };

function localInventory(pv) {
  const base = (pv && pv.base_url) || 'http://localhost:11434/v1';
  const now = Date.now();
  if (_inventoryCache.models && _inventoryCache.base === base && (now - _inventoryCache.at) < INVENTORY_TTL_MS) {
    return _inventoryCache.models;
  }
  // /v1 is the OpenAI-compatible surface; /api/tags is Ollama's native inventory.
  const tagsUrl = base.replace(/\/v1\/?$/, '') + '/api/tags';
  let models = null;
  try {
    const r = spawnSync('curl', ['-s', '--max-time', '3', tagsUrl], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
      const j = JSON.parse(r.stdout);
      if (Array.isArray(j.models)) {
        models = new Set();
        for (const m of j.models) {
          if (!m || !m.name) continue;
          models.add(m.name);
          // `llama3.2:latest` is addressable as plain `llama3.2` too; index both
          // spellings so a config using either form resolves.
          models.add(String(m.name).replace(/:latest$/, ''));
        }
      }
    }
  } catch { /* inventory unknown -> fail open (see doc above) */ }
  _inventoryCache = { at: now, models, base };
  return models;
}

/** Is this provider's model physically present? True when unknown (fail-open). */
function modelInstalled(pname, pv, modelId) {
  if (!pv || pv.adapter !== 'openai-compatible') return true;
  if ((pv.rank || 50) < 90) return true;           // cloud providers: not our business
  const inv = localInventory(pv);
  if (!inv) return true;                            // inventory unknown -> allow
  return inv.has(modelId) || inv.has(String(modelId).replace(/:latest$/, ''));
}

/** Test seam: drop the cached inventory so a test can re-probe. */
function _resetInventoryCache() { _inventoryCache = { at: 0, models: null, base: null }; }

function pickModel(pname, targetTier, topBrain, kind) {
  const pv = config().providers[pname];
  if (!pv) return null;
  const want = tierIdx(targetTier);
  // PHANTOM-MODEL GUARD (7RZB2DZ): drop models this box does not actually have
  // BEFORE any tier/cost reasoning, so an uninstalled local model is skipped as
  // UNAVAILABLE rather than laddered and failed. No-op for cloud providers and
  // whenever the local inventory cannot be read (fail-open).
  // A model may be switched off in config (`enabled: false`) with its measured
  // reason beside it (5K7VP5M) — it is then skipped exactly like an uninstalled one.
  const entries = Object.entries(pv.models || {}).filter(([mid, md]) => (md || {}).enabled !== false && modelInstalled(pname, pv, mid));
  if (!entries.length) return null;
  const atOrAbove = entries.filter(([, m]) => tierIdx(m.tier) >= want);
  // AUTO-DEMOTE (Phase 1): remove chronically-failing models for this kind. If
  // every candidate at-or-above the tier is demoted, RETURN NULL so the provider
  // is skipped and the ladder moves to the next provider — sinking to a weaker
  // rung of the same failing provider is the wrong recovery.
  const active = kind ? atOrAbove.filter(([name]) => !isDemoted(kind, pname, name)) : atOrAbove;
  if (kind && atOrAbove.length > 0 && active.length === 0) return null;
  if (active.length) {
    // Three-key sort: tier (primary) → per-(kind × model) success rate (secondary)
    // → cost (tertiary). The rate key handles WITHIN-tier auto-demote for
    // providers that have multiple models at the same tier; the isDemoted filter
    // above handles ACROSS-tier auto-demote for providers with a single failing
    // model at a tier. Together they cover both shapes.
    // Four-key sort (Phase 2 upgrade): tier → per-kind success rate → measured
    // cost-per-success → static config cost (tie-break of last resort).
    // Efficiency (cost-per-success) is EVIDENCE-based routing: two models with
    // similar success rates at the same tier get ranked by what one usable
    // answer ACTUALLY costs from each (total spend / wins), not by list price.
    // When either side has no evidence, this key is a no-op and static cost wins.
    const sorted = active.sort((a, b) => {
      const tierDiff = topBrain
        ? (tierIdx(b[1].tier) - tierIdx(a[1].tier))
        : (tierIdx(a[1].tier) - tierIdx(b[1].tier));
      if (tierDiff !== 0) return tierDiff;
      if (kind) {
        const rateDiff = successRate(kind, pname, b[0]) - successRate(kind, pname, a[0]);
        if (Math.abs(rateDiff) > 0.01) return rateDiff;
        // Efficiency tiebreak — lower cost-per-success wins. Only applies when
        // BOTH sides have measured efficiency (else fall through to static cost).
        const effA = efficiency(kind, pname, a[0]);
        const effB = efficiency(kind, pname, b[0]);
        if (effA.cost_per_success != null && effB.cost_per_success != null) {
          const eDiff = effA.cost_per_success - effB.cost_per_success;
          if (Math.abs(eDiff) > 1e-6) return eDiff; // cheaper-per-win first
        }
      }
      const costA = (a[1].in || 0) + (a[1].out || 0);
      const costB = (b[1].in || 0) + (b[1].out || 0);
      // Price is not evidence of capability. Tier and observed success decide
      // quality; equally capable candidates use the cheaper model.
      return costA - costB;
    });
    return { provider: pname, model: sorted[0][0], tier: sorted[0][1].tier };
  }
  // Nothing that strong AND no demote decision blocked us — take this provider's
  // strongest as a degraded option.
  const strongest = entries.sort((a, b) => tierIdx(b[1].tier) - tierIdx(a[1].tier))[0];
  return { provider: pname, model: strongest[0], tier: strongest[1].tier, degraded: true };
}

// At/above this tier, the work is capability-critical: pick the STRONGEST brain,
// not the cheapest-at-tier. L3+ = reasoning / architecture / security → Opus 5.
const BRAIN_CEILING_TIER = 'L3';

/**
 * TOP-BRAIN IS A CAPABILITY DECISION, NOT A BUDGET THRESHOLD (ABG8YQR, 2026-09-25).
 *
 * THE DEFECT THIS REPLACES. `wantsTopBrain` used to be, in full:
 *     tierIdx(tier) >= tierIdx('L3')
 * i.e. "any task at L3 or above opens on the strongest model the provider owns."
 * That reads reasonably and is measurably wrong, because THREE different kinds
 * sit at min_tier L3 — `code`, `ui`, and `general` — and `general` is the
 * catch-all for every unclassified card. A prior verifier (7RZB2DZ, RC3)
 * measured ~78% of real cards landing in `general`. So the DEFAULT rung for the
 * overwhelming majority of council work was an L4 frontier brain at $15/$75 per
 * Mtok, bought for changelog edits and one-line fixes alike.
 *
 * Vinta's directive on this task cuts BOTH ways and both halves are honored:
 *   (a) "ensure the higher tiers are not being avoided every single time …
 *        loosen their frugality grip … utilized to their fullest potential on
 *        tasks that could most benefit"  → L4 must GENUINELY run on work that
 *        benefits. reasoning + security keep top-brain unconditionally, and the
 *        L4 floors are UNTOUCHED.
 *   (b) a catch-all card must not silently buy the most expensive brain on earth.
 *
 * THE MECHANISM. Top-brain now fires when the tier is capability-critical AND at
 * least one of the following is true — each one being actual EVIDENCE that this
 * particular task needs depth, rather than an artifact of where a floor landed:
 *
 *   1. The kind declares `top_brain: true` in task_affinity (reasoning, security).
 *      These kinds are top-brain-worthy BY NATURE: being subtly wrong about an
 *      auth boundary or an architecture call is catastrophic and un-cheap to
 *      fix later, which is exactly Model-Fitness Law §4 ("never degrade where it
 *      matters").
 *   2. The tier was raised ABOVE the kind's bare affinity floor by real signal —
 *      an explicit `task.tier`, a `stakes` hint, or escalation after a capability
 *      failure. A human (or a prior failure) saying "this one is hard" IS the
 *      evidence. This is the climb path: `general` cards CAN reach L4, they just
 *      no longer start there by default.
 *   3. `task.escalated` — a previous rung already failed on capability grounds.
 *      Retrying at the same strength would burn tokens learning nothing.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: it does not lower a single min_tier floor.
 * Lowering floors would be re-tightening exactly the frugality grip Vinta told us
 * to loosen; `code`/`ui`/`general` all still target L3 and still get the strong
 * L3 band (fable 5.1 / gpt-5.5 / gemini-3.8-flash / grok-4.3) as their opening
 * rungs. The change is only to the PROMOTION above that floor.
 */
function wantsTopBrain(tier, aff, tierSource, task) {
  if (tierIdx(tier) < tierIdx(BRAIN_CEILING_TIER)) return false;
  // Back-compat: called with only a tier (older callers / tests) keeps the
  // original threshold semantics rather than silently returning false.
  if (aff === undefined) return true;
  if (task && ['high', 'critical'].includes(String(task.stakes || '').toLowerCase())) return true;
  if (task && Number(task.priority) === 1) return true;
  if (aff && aff.top_brain === true) return true;                 // (1) kind needs depth
  if (task && task.escalated) return true;                        // (3) prior capability failure
  const src = String(tierSource || '');
  // (2) the tier came from real signal, not from the kind's bare floor.
  if (src.startsWith('task.tier') || src.startsWith('task.stakes')) return true;
  if (src.includes('escalated')) return true;
  if (src.startsWith('orchestrator:') && tierIdx(tier) >= tierIdx('L4')) return true;
  return false;
}

// ───────────────────────── learned history ─────────────────────────

/**
 * PREDICTIVE ROUTING (the "better than Cursor" claim, made concrete).
 * We keep a per (kind × provider × model) success record — PHASE 1 UPGRADE
 * 2026-09-16. Was per (kind × provider), which rolled all four Claude models into
 * one bucket and made a low-tier model's capability fails look like the whole
 * provider was broken (visible artifact: anthropic at 80% "failure rate" while
 * its breaker showed 0 consecutive failures — every task actually succeeded via
 * a higher rung, the counter just never distinguished which model failed).
 *
 * A model that has failed a kind repeatedly is pushed later in preference order
 * for that kind ONLY — it stays first-choice for kinds it is good at, and other
 * models from the same provider are unaffected. This is a bandit-lite: pure
 * exploitation would lock in an early fluke, so a model is never removed, only
 * reordered, and success decays back toward neutral as it recovers.
 *
 * State-file shape (schema_version:2):
 *   { kinds: { <kind>: { "<provider>/<model>": { ok, fail, tokens, cost, last_at } } } }
 *
 * Legacy shape (pre-2026-09-16, no schema_version):
 *   { kinds: { <kind>: { "<provider>": { ok, fail, ... } } } }
 * The old provider-level entries are preserved under __legacy on migration for
 * audit, but are NOT counted in per-model scoring — we can't retroactively split
 * "anthropic had 80 fails" across four models, and pretending we can (by folding
 * them all into the default_model) would slander whichever model got the blame.
 */
const HISTORY_SCHEMA = 2;

function migrateHistory(raw) {
  if (raw && raw.schema_version === HISTORY_SCHEMA) return raw;
  const migrated = { schema_version: HISTORY_SCHEMA, kinds: {}, __legacy: {} };
  for (const [kind, provs] of Object.entries((raw && raw.kinds) || {})) {
    migrated.kinds[kind] = {};
    migrated.__legacy[kind] = {};
    for (const [key, stats] of Object.entries(provs || {})) {
      // A key with '/' is already new-shape (mid-migration write); preserve it.
      if (key.includes('/')) migrated.kinds[kind][key] = stats;
      else                    migrated.__legacy[kind][key] = stats;
    }
  }
  migrated.__migrated_at = new Date().toISOString();
  migrated.__migration_note = 'Provider-level pre-per-model counters preserved under __legacy; not used for scoring.';
  return migrated;
}

function historyStats() { return migrateHistory(readJSON(HISTORY_PATH, { kinds: {} })); }

function recordRoute(kind, provider, model, ok, meta) {
  const h = historyStats();
  const key = `${provider}/${model || 'unknown'}`;
  const k = (h.kinds[kind] = h.kinds[kind] || {});
  const p = (k[key] = k[key] || { ok: 0, fail: 0 });
  if (ok) p.ok++; else p.fail++;
  p.last_at = Date.now();
  if (meta && meta.tokens) p.tokens = (p.tokens || 0) + meta.tokens;
  if (meta && meta.cost) p.cost = +((p.cost || 0) + meta.cost).toFixed(6);
  writeJSONAtomic(HISTORY_PATH, h);
}

/**
 * Laplace-smoothed success rate; unknown (provider, model) pairs sit at 0.5.
 * When called with just (kind, provider), aggregates across every model of that
 * provider — this keeps the provider-level ordering (route() line ~569) working
 * unchanged while pickModel() uses the per-model form for within-provider bias.
 */
function successRate(kind, provider, model) {
  const kh = historyStats().kinds[kind] || {};
  if (model) {
    const p = kh[`${provider}/${model}`];
    if (!p) return 0.5;
    return (p.ok + 1) / (p.ok + p.fail + 2);
  }
  let ok = 0, fail = 0;
  for (const [k2, s] of Object.entries(kh)) {
    if (k2 === provider || k2.startsWith(provider + '/')) {
      ok += s.ok || 0; fail += s.fail || 0;
    }
  }
  if (ok + fail === 0) return 0.5;
  return (ok + 1) / (ok + fail + 2);
}

/**
 * PHASE 2 (2026-09-16) — EFFICIENCY SCORING.
 *
 * cost-per-success = total_cost / max(1, ok)  ($ per completed task)
 * tokens-per-success = total_tokens / max(1, ok)  (tokens per completed task)
 *
 * Why divide by ok, not attempts: a model that fails 4× before succeeding once
 * ALSO burned tokens on those fails, and those tokens are the true price of one
 * usable answer from that model. attempts-averaging would flatter chronic
 * failers by only pricing the winning try.
 *
 * When called with just (kind, provider) it aggregates across all of that
 * provider's models — same mirroring as successRate. Unknown (never-attempted)
 * returns { samples: 0, cost_per_success: null, tokens_per_success: null } and
 * callers should fall back to the static config price for tiebreaks.
 */
function efficiency(kind, provider, model) {
  const kh = historyStats().kinds[kind] || {};
  let ok = 0, cost = 0, tokens = 0, samples = 0;
  const collect = (s) => {
    ok += s.ok || 0; cost += s.cost || 0; tokens += s.tokens || 0;
    samples += (s.ok || 0) + (s.fail || 0);
  };
  if (model) {
    const p = kh[`${provider}/${model}`];
    if (p) collect(p);
  } else {
    for (const [k2, s] of Object.entries(kh)) {
      if (k2 === provider || k2.startsWith(provider + '/')) collect(s);
    }
  }
  if (samples === 0 || ok === 0) {
    return { samples, ok, cost, tokens, cost_per_success: null, tokens_per_success: null };
  }
  return {
    samples, ok, cost, tokens,
    cost_per_success: +(cost / ok).toFixed(6),
    tokens_per_success: Math.round(tokens / ok),
  };
}

/**
 * LIVE execution-evidence tracker (SNJS8SA, 2026-10-26 — "every model should be
 * baseline at first before any action taken").
 *
 * The capability floor below (canExecute) judged whether a provider could even
 * appear in an agentic ladder using ONE frozen snapshot in providers.json's
 * `execution_evidence` block, hand-written on 2026-09-26 from 8-28 real logs
 * per provider, with a comment saying "re-measure rather than hand-edit" that
 * nothing ever acted on. MEASURED (this task, 2026-10-26): a fresh `plan
 * --agentic` call for an ordinary code task returned a ladder that was
 * STRUCTURALLY anthropic → openai → local-only — google and xai never appear,
 * on every single task, forever, because that one afternoon's sample is still
 * the only evidence canExecute() has ever consulted. That is "openai [and
 * anthropic] first and foremost" exactly as reported: when both of those two
 * vendors are degraded at once, the ladder collapses straight to a 0.5B local
 * model, which reads as a wall even though the zero-failure contract
 * technically never broke.
 *
 * This file accumulates real outcomes continuously (fed by council-driver.sh
 * right where it already computes tool-call counts for the UD7EJ4Y evidence
 * fix), seeded once from the static snapshot so day-one behaviour is
 * unchanged, then growing with every real run. A provider's standing in the
 * ladder is never again frozen to one historical afternoon.
 */
function recordExecutionEvidence(provider, hadTools) {
  if (!provider) return;
  try {
    fs.mkdirSync(path.dirname(EXEC_EVIDENCE_PATH), { recursive: true });
    const cur = readJSON(EXEC_EVIDENCE_PATH, {});
    const seedStatic = (config().execution_evidence || {})[provider];
    const p = cur[provider] || (seedStatic
      ? { runs: Number(seedStatic.runs) || 0, with_tools: Number(seedStatic.with_tools) || 0 }
      : { runs: 0, with_tools: 0 });
    p.runs = (p.runs || 0) + 1;
    if (hadTools) p.with_tools = (p.with_tools || 0) + 1;
    p.updated_at = new Date().toISOString();
    cur[provider] = p;
    writeJSONAtomic(EXEC_EVIDENCE_PATH, cur);
  } catch { /* evidence bookkeeping must never block a task */ }
}

// ───────────────────────────── the router ─────────────────────────────

/**
 * Build the full failover LADDER for a task.
 *
 * Precedence (highest first) — explicit human intent always wins:
 *   1. task.provider + task.model  (a hard pin; still gets a ladder BELOW it)
 *   2. task.model alone            (resolves provider from the alias table)
 *   3. task.tier                   (explicit tier, provider chosen by affinity)
 *   4. task.stakes                 (legacy field — preserved verbatim)
 *   5. classified affinity kind    (the smart default)
 *
 * The returned ladder is ordered, deduped, and always ends in a rung that needs
 * no credential, so it can never be empty.
 */
function route(task, opts) {
  task = Object.assign({}, task || {});
  delete task.__lockout_deferred;
  opts = opts || {};
  const cfg = config();
  const cls = classify(task);
  const aff = cfg.task_affinity[cls.kind] || cfg.task_affinity.general;

  // ── target tier ──
  let tier;
  let tierSource;
  // CONTEXTUAL ORCHESTRATOR (PR-B, 2026-09-26). When the card carries no explicit
  // tier, the tier comes from lib/orchestrator.js: a learned, state-aware score over
  // the actual payload (named files, dependency reach, security surface, prior
  // attempts, verifier regressions, stakes-as-a-feature, ...) with the old static
  // min_tier map demoted to a learned per-kind prior. Degrade-never-die: if the
  // orchestrator throws, or COUNCIL_ORCHESTRATOR=0, the exact legacy path runs.
  let assessment = null;
  const _explicitTier = task.tier && TIER_ORDER.includes(String(task.tier).toUpperCase());
  if (!_explicitTier && process.env.COUNCIL_ORCHESTRATOR !== '0') {
    try {
      assessment = require('./orchestrator.js').assess(task, { cwd: opts.cwd || process.env.COUNCIL_REPO, kind: cls.kind });
      if (!assessment || !TIER_ORDER.includes(assessment.tier)) assessment = null;
    } catch (_) { assessment = null; }
  }
  if (assessment) {
    tier = assessment.tier; tierSource = `orchestrator:v${assessment.learner_version}`;
    // An EXPLICIT human stakes of critical/high stays a raise-only lane (the legacy
    // contract: critical -> L4, high -> L3). The orchestrator may route above it on
    // evidence, never below what Vinta declared.
    const _sk = String(task.stakes || '').toLowerCase();
    if ((_sk === 'critical' || _sk === 'high') && tierIdx(tierFromStakes(_sk)) > tierIdx(tier)) {
      tier = tierFromStakes(_sk); tierSource += `+stakes:${_sk}`;
    }
  } else if (_explicitTier) {
    tier = String(task.tier).toUpperCase(); tierSource = 'task.tier';
  } else if (task.stakes) {
    tier = tierFromStakes(task.stakes); tierSource = 'task.stakes';
  } else {
    tier = aff.min_tier || 'L2'; tierSource = `affinity:${cls.kind}`;
  }
  // AFFINITY MIN_TIER IS A FLOOR FOR EVERY KIND (NEKQ9D2, Vinta 2026-08-14).
  // Previously a `stakes` value could drop work BELOW its kind's min_tier (e.g. a
  // reasoning card marked stakes:low fell to L1/Haiku), which is exactly the silent
  // downgrade Vinta banned: "if it can't [be done cheaply], don't still resort to
  // 4.5." The kind's min_tier expresses how much brain the WORK needs; a stakes hint
  // may raise the tier but must never sink it below what the work requires. Security
  // keeps force_min_tier as the hard, non-negotiable variant of the same rule.
  // Under the orchestrator the floor applies to force_min_tier kinds (the security
  // safety rail) AND to top_brain kinds (TCGQX9B, Vinta 2026-10-20). The catch-all
  // kinds (general/code/ui/ops/speed/bulk) keep a SOFT min_tier that the learned
  // kind_prior may cheapen — that is the frugality Vinta asked for ("claude is
  // still using up too much tokens for most jobs"). But the two capability-critical
  // kinds — reasoning (architecture/analysis/"why") and security — are top_brain by
  // nature, and dropping them below their L4/L3 floor is exactly the "degrade where
  // it matters" the Model-Fitness Law forbids and Vinta's SAME directive bans
  // ("ensure the higher tiers are not being avoided … on tasks that could most
  // benefit"). Before this change their L4 reach was being held up only by the
  // accidental +0.99 stakes inflation (now removed); this makes it a real floor so
  // genuinely-hard work keeps the frontier brain while ordinary work goes cheap.
  if (tierIdx(tier) < tierIdx(aff.min_tier) && (!assessment || aff.force_min_tier || aff.top_brain)) {
    tier = aff.min_tier;
    const _lbl = aff.force_min_tier ? 'affinity-force-floor' : aff.top_brain ? 'affinity-topbrain-floor' : 'affinity-floor';
    tierSource = `${_lbl}:${cls.kind}` + (assessment ? `(orchestrator:v${assessment.learner_version})` : '');
  }
  // An escalated task (prior capability failure) climbs one rung.
  if (task.escalated && tierIdx(tier) < TIER_ORDER.length - 1) {
    tier = TIER_ORDER[tierIdx(tier) + 1];
    tierSource += '+escalated';
  }

  // Highest-priority and explicitly high-stakes work buys capability first.
  // Use the maintained catalog tier, never inferred model names or prices.
  const criticalWork = aff.force_min_tier || aff.top_brain || task.escalated ||
    Number(task.priority) === 1 || ['high', 'critical'].includes(String(task.stakes || '').toLowerCase()) ||
    tierIdx(tier) >= tierIdx('L4');
  if (criticalWork && tierIdx(tier) < tierIdx('L4')) {
    tier = 'L4'; tierSource += '+critical-quality-floor';
  }
  const qualityFloor = criticalWork ? tierIdx('L4') : null;

  // ── LOCKOUT-AWARE ROUTING (2026-09-25) ──────────────────────────────────
  // When ≥2 top providers are locked out (usage caps, rate limits, weekly
  // ceilings), running an L3/L4 task is guaranteed to fail — every rung it
  // can reach is a locked provider. Instead of burning attempts trying, we:
  //   1. defer tasks whose kind CANNOT cheap-out (reasoning/security/force_min_tier)
  //   2. clamp downgrade-eligible kinds (general/code/ui and anything not
  //      force_min_tier) to the ceiling read from lockoutState()
  //   3. leave already-cheap kinds (ops/speed/bulk) untouched.
  // Result: during a lockout the fleet still processes cheap work on xai/
  // google/ollama, but doesn't pretend it can Opus-5 anything. Reasoning +
  // security tasks get a plan.blockers marker naming the lockout so the
  // driver can wait for it to clear rather than mislabelling them "blocked".
  const _lockout = lockoutState();
  if (_lockout.level !== 'none') {
    // Only cap the tier for kinds that are NOT force_min_tier. Security has
    // force_min_tier=true — if it can't have L4, it must not silently degrade
    // to L2 and lie about the answer.
    const canDowngrade = !criticalWork;
    const ceilingIdx = tierIdx(_lockout.tier_ceiling_now);
    if (canDowngrade && tierIdx(tier) > ceilingIdx) {
      tier = _lockout.tier_ceiling_now;
      tierSource += `+lockout(${_lockout.level}:${_lockout.locked_providers.join(',')})`;
    } else if (!canDowngrade && tierIdx(tier) > tierIdx(_lockout.available_top_tier)) {
      // A force_min_tier kind whose floor is above what any available provider
      // can serve — mark as lockout-deferred and let the seat driver skip it.
      // The route still returns a ladder (best-effort with what's available)
      // so callers that ignore blockers still get SOMETHING; but the marker
      // is there for consumers who care.
      // (blockers list is populated at ladder-build below; we set a flag here.)
      task.__lockout_deferred = true;
    }
  }

  const avail = probeAll();
  // ── LOCKOUT-AWARE LADDER FILTER (2026-09-25) ──────────────────────────────
  // Availability alone doesn't know about lockouts — a rate-limited provider
  // still has its binary + credential. Without this filter, the ladder puts
  // anthropic/claude-opus-5 as rung #1 during an active anthropic lockout,
  // and every task burns a wasted attempt hitting the same rate wall before
  // failing over. Solution: while in lockout, mark locked providers unavailable
  // so they drop from ladder building. THE PROBE PATH IS THIS FILTER ITSELF:
  // lockoutState() only reports a provider locked while its last failure is
  // inside the breaker cooldown (or a dated wall holds), so after one cooldown
  // the provider is back on the ladder and the next task is its probe. There
  // is NO other probe path — the earlier claim that "breaker half-open" probes
  // happened elsewhere was false and cost 13 days of openai silence (5K7VP5M).
  if (_lockout.level !== 'none') {
    for (const name of _lockout.locked_providers) {
      if (avail[name]) {
        avail[name] = Object.assign({}, avail[name], {
          available: false,
          reason: `lockout(${_lockout.level}) — recent rate-limit/usage-cap or extended failure streak; skip until it clears`,
        });
      }
    }
  }
  const ladder = [];
  const seen = new Set();
  let ladderSkipped = null;   // rungs removed by the capability floor, for the plan

  // TOP-BRAIN SWITCH (NEKQ9D2, made need-based by ABG8YQR 2026-09-25). When the
  // work is capability-critical the PRIMARY rungs pick the strongest brain
  // available, not the cheapest-at-tier. Failover rungs across other vendors
  // still pick cheapest-at-tier — a same-tier vendor cross is the correct frugal
  // degrade once the top brain is unreachable, and we never drop BELOW the tier
  // floor until tier-descent.
  //
  // It is now driven by CAPABILITY NEED (kind declares top_brain, or the tier was
  // raised above the kind's bare floor by explicit tier/stakes/escalation) rather
  // than by the bare fact that the tier is >= L3. See wantsTopBrain() for the full
  // rationale and the measured defect it fixes.
  const topBrain = wantsTopBrain(tier, aff, tierSource, task);

  // ── (b) THE CAPABILITY FLOOR (Vinta 2026-09-26) ───────────────────────────
  // Vinta chose "(c) as the best option with (b) fallback": let honest evidence
  // drive routing, but keep a floor so the learner can never pick a model that
  // physically CANNOT do the job while it is still learning.
  //
  // MEASURED, across 484 real raw logs on this box:
  //     anthropic  430/430 runs executed tool calls
  //     google       3/28
  //     openai       3/8
  //     xai          0/18
  // A provider that cannot execute tools here cannot do implementation work, no
  // matter what its success history says — and history CAN be wrong, which is
  // exactly how 206 phantom xai "wins" hijacked every route on the board.
  //
  // So: for EXECUTION kinds, a provider must be able to execute. This is a floor,
  // not a preference — it removes impossible rungs and then gets out of the way,
  // leaving the ordering entirely to (c)'s evidence. Declare it per provider in
  // providers.json as `executes_tools: true|false`; a provider that does not
  // declare it is judged by its MEASURED rate, and only excluded when there is
  // real evidence it cannot execute (>=8 observed runs, <20% with tool calls).
  // Never excludes the last rung — a ladder must always terminate in something
  // runnable (the zero-failure contract).
  const EXEC_KINDS = new Set(['code', 'ui', 'ops', 'general', 'security', 'reasoning']);
  // UD7EJ4Y 2026-10-15: a SEAT run is agentic no matter what the card's kind is —
  // the seat must at minimum run vintask + turn-schema.js, and an implementation
  // card titled with "dedupe"/"parse"/"count" still classifies as `bulk`. AZGZPUT
  // (kind=bulk) went to xai/grok on 45 consecutive claims: the openai-compatible
  // adapter is ONE chat completion with no tool loop, so every run narrated a
  // paragraph and exited rc=0 having executed nothing. The driver passes
  // `plan --agentic`, which applies the execution floor to EVERY kind.
  const needsExecution = opts.agentic === true || EXEC_KINDS.has(String(cls.kind || '').toLowerCase());
  // LIVE evidence takes over from the static snapshot the moment it has its own
  // 8+ samples for a provider — see recordExecutionEvidence() above. Until then
  // the static snapshot still seeds the judgment, so day-one behaviour (and
  // every existing verifier pinned to the 2026-09-26 numbers) is unchanged.
  const _liveExecEvidence = (() => { try { return readJSON(EXEC_EVIDENCE_PATH, {}); } catch { return {}; } })();
  const canExecute = (pname) => {
    try {
      const pv = (cfg.providers || {})[pname] || {};
      if (typeof pv.executes_tools === 'boolean') return pv.executes_tools;
      const ex = _liveExecEvidence[pname] || (cfg.execution_evidence || {})[pname];
      if (ex && Number(ex.runs) >= 8) return (Number(ex.with_tools) / Number(ex.runs)) >= 0.2;
      return true;                                 // no evidence => innocent
    } catch { return true; }
  };
  // DEMOTE, DON'T EXCLUDE (SNJS8SA, 2026-10-26). A provider the floor judges
  // execution-uncertain used to be dropped from the ladder entirely — for
  // every real task, that meant google and xai could NEVER be reached no
  // matter how badly anthropic and openai were both degraded, which is the
  // literal "openai [and anthropic] first and foremost, does not fall back to
  // any other model" Vinta reported. It still should not COMPETE with a
  // provider that reliably executes — so it is deferred to one last-resort
  // cloud rung, placed after every confirmed-capable provider's full tier
  // ladder but BEFORE the $0 local floor (see the emission loop below step 5).
  // One rung per provider (its first/strongest attempted pick), not one per
  // tier — this is "a working second-best scenario", not another whole ladder.
  const executionDeferred = [];
  const deferredSeen = new Set();

  const push = (pick, why) => {
    if (!pick) return;
    if (qualityFloor !== null && tierIdx(pick.tier) < qualityFloor) {
      (ladderSkipped = ladderSkipped || []).push({ provider: pick.provider, model: pick.model, reason: 'below required L4 quality floor' });
      return;
    }
    if (cfg.providers[pick.provider]?.models?.[pick.model]?.enabled === false) return;
    const key = `${pick.provider}:${pick.model}`;
    if (seen.has(key)) return;
    const a = avail[pick.provider];
    if (!a || !a.available) return;               // unavailable rungs are skipped, not failed
    if (needsExecution && !canExecute(pick.provider)) {
      // Not a failure and not a silent drop — the plan records why, so an
      // exhausted ladder can name this instead of looking like bad luck.
      (ladderSkipped = ladderSkipped || []).push({
        provider: pick.provider, model: pick.model,
        reason: `low measured tool-execution rate for "${cls.kind}" — demoted to a last-resort cloud rung, not excluded`,
      });
      if (!deferredSeen.has(pick.provider)) {
        deferredSeen.add(pick.provider);
        executionDeferred.push({ pick, why });
      }
      return;
    }
    seen.add(key);
    ladder.push(Object.assign({}, pick, {
      why,
      budget: cfg.tier_budgets[pick.tier] != null ? cfg.tier_budgets[pick.tier] : 250000,
      argv: null, // filled by buildInvocation at exec time (needs cwd/prompt)
    }));
  };

  // 1/2. explicit pin
  let pinned = null;
  if (task.provider && task.model) {
    const pv = cfg.providers[task.provider];
    const m = pv && (pv.models[task.model] || Object.entries(pv.models || {}).find(([, mm]) => (mm.aliases || []).includes(String(task.model).toLowerCase())));
    if (pv && m) {
      const mid = pv.models[task.model] ? task.model : Object.entries(pv.models).find(([, mm]) => (mm.aliases || []).includes(String(task.model).toLowerCase()))[0];
      pinned = { provider: task.provider, model: mid, tier: pv.models[mid].tier };
    }
  } else if (task.model) {
    pinned = resolveModel(task.model);
  } else if (task.provider && cfg.providers[task.provider]) {
    // Explicit provider pin: DO NOT pass kind, so auto-demote won't nullify a
    // deliberate override. If the user pinned a provider, they mean it — even
    // if history says its models are weak for this kind.
    pinned = pickModel(task.provider, tier, topBrain);
  }
  if (pinned) push(pinned, 'explicit pin (Vinta/task override)');

  // 3. affinity-preferred providers, reordered by learned success for this kind
  // Cross-provider ordering within the affinity list: primary key is per-kind
  // success rate (aggregated across each provider's models for this kind),
  // Phase 2 tiebreak is measured cost-per-success. A provider that gets the
  // same answer for half the money on this kind of work moves up. When either
  // side has no evidence, the tiebreak is a no-op and the configured order in
  // aff.prefer holds.
  // Compare actual candidate models; a provider's cheap-model wins must not
  // inflate its unproven frontier model. Static affinity breaks true ties.
  const prefer = (aff.prefer || []).slice().sort((a, b) => {
    const ca = pickModel(a, tier, topBrain, cls.kind);
    const cb = pickModel(b, tier, topBrain, cls.kind);
    if (!ca || !cb) return Number(!ca) - Number(!cb);
    const td = tierIdx(ca.tier) - tierIdx(cb.tier);
    if (td) return topBrain ? -td : td;
    const rateDiff = successRate(cls.kind, b, cb.model) - successRate(cls.kind, a, ca.model);
    if (Math.abs(rateDiff) > 0.01) return rateDiff;
    const ea = efficiency(cls.kind, a, ca.model), eb = efficiency(cls.kind, b, cb.model);
    if (ea.cost_per_success != null && eb.cost_per_success != null && ea.cost_per_success !== eb.cost_per_success) {
      return ea.cost_per_success - eb.cost_per_success;
    }
    return calculateLadderCost([ca]) - calculateLadderCost([cb]);
  });
  // LAST-RESORT GUARD (2026-08-14 freeze fix). Step 4 below carefully holds
  // rank>=90 (local Ollama) back until every cloud option is exhausted — but that
  // guard was trivially bypassed here: several task_affinity `prefer` lists name
  // "ollama" explicitly, and this loop ran BEFORE the guard, so a $0 local model
  // was placed AHEAD of Sonnet on general work. On a loaded box that meant every
  // task spent the full 300s HTTP timeout on an 8B model that cannot answer
  // (measured on this host under load: 0.5b=1s, 4b=86s, 8b=TIMEOUT), got SIGTERM
  // (rc=143), and only then failed over — burning ~5min per task. Honor the same
  // rank rule here; local still appears, just at the floor (step 6) where it
  // belongs. An explicit per-task pin (step 1/2) still wins, as it should.
  for (const pname of prefer) {
    const pvr = (cfg.providers[pname] || {}).rank || 50;
    if (pvr >= 90) continue; // deferred to the last-resort floor
    push(pickModel(pname, tier, topBrain, cls.kind), `affinity:${cls.kind} @${tier}${topBrain ? ' [top-brain]' : ''}`);
  }

  // 4. every remaining provider by config rank — breadth before depth, because
  //    a different VENDOR at the same tier is a better failover than the same
  //    vendor's weaker model (vendor outages are correlated across their models).
  //
  //    LAST-RESORT CLASS: a provider marked rank>=90 (local Ollama) is held back
  //    until every cloud option is exhausted, EVEN IF its nominal tier matches.
  //    A local 8b model and Sonnet are both "L2" on paper, but they are not
  //    interchangeable on security or architecture work — tier measures how much
  //    brain the task NEEDS, not how much a given model HAS. Without this guard a
  //    security task would rank qwen3:8b above Sonnet purely because Ollama sorts
  //    early, which is exactly the kind of silent quality collapse "no failure
  //    allowed" is supposed to prevent. Local stays in the ladder (it is what
  //    makes the chain terminate), just always at the bottom.
  const LAST_RESORT_RANK = 90;
  const rest = Object.entries(cfg.providers)
    .filter(([n]) => !prefer.includes(n))
    .sort((a, b) => (a[1].rank || 50) - (b[1].rank || 50));
  for (const [pname, pv] of rest) {
    if ((pv.rank || 50) >= LAST_RESORT_RANK) continue; // deferred to step 6
    push(pickModel(pname, tier, false, cls.kind), `rank fallback @${tier}`);
  }

  // 4b. THE TARGET-TIER SWEEP — THE BUG THIS TASK EXISTS TO KILL (ABG8YQR).
  //
  //     MEASURED DEFECT. Steps 3 and 4 above run with `topBrain`, and topBrain
  //     PROMOTES: it returns each provider's strongest model AT OR ABOVE the
  //     target. So for a task targeting L3, rungs 0..3 were all **L4** models.
  //     Step 5 then began its descent at `tierIdx(tier) - 1` = L2. The result,
  //     verbatim from the real before-dump on `code`:
  //
  //        0 anthropic/claude-opus-5            [L4]
  //        1 xai/grok-4.7                       [L4]
  //        2 google/deep-research-max-…         [L4]
  //        3 openai/gpt-6-astra                 [L4]
  //        4 anthropic/claude-sonnet-4-5        [L2]   <<< L3 NEVER TRIED
  //        5 ollama/llama3.2:latest             [L1]
  //
  //     The ENTIRE L3 band was structurally unreachable on exactly the kinds
  //     whose floor is L3. Not deprioritized — ABSENT. Every one of these is a
  //     real, strong, far cheaper rung that never got a turn:
  //        anthropic → claude-fable-5-1   $2/$10      (7.5x cheaper out than Opus)
  //        openai    → gpt-5.5            $1.25/$10
  //        google    → gemini-3.8-flash   $0.5/$3
  //        xai       → grok-4.3           $1.25/$2.50, 1M ctx
  //     This is the single reason Fable was catalogued but never routed, and the
  //     reason the ladder fell from a frontier brain straight to Sonnet-4-5.
  //
  //     THE FIX. Before descending BELOW the target tier, sweep every cloud
  //     provider AT the target tier with topBrain=false (cheapest-at-tier — the
  //     correct frugal degrade once the promoted brains are exhausted). Dedupe
  //     via the existing `seen` set makes this a no-op when topBrain was already
  //     false, because those exact rungs are already on the ladder. Deterministic,
  //     rank-ordered, and it never reorders anything already placed.
  const targetTierSweep = () => {
    for (const [pname, pv] of Object.entries(cfg.providers).sort((a, b) => (a[1].rank || 50) - (b[1].rank || 50))) {
      if ((pv.rank || 50) >= LAST_RESORT_RANK) continue; // deferred to the floor
      push(pickModel(pname, tier, false, cls.kind), `target-tier sweep @${tier}`);
    }
  };
  targetTierSweep();

  // 5. TIER DESCENT — only after every CLOUD provider at the target tier is
  //    exhausted. A weaker frontier model still beats no result at all.
  //
  //    START POINT (ABG8YQR): descend from one below the LOWEST tier actually
  //    present on the ladder so far, not blindly from `tier - 1`. With 4b above
  //    the two are normally identical; deriving it from the real ladder makes the
  //    invariant self-healing — if any future step ever promotes rungs again, the
  //    descent still cannot leapfrog a band that was never tried. Clamped to at
  //    most `tier - 1` so this can only ever ADD coverage, never skip more.
  const lowestPlaced = ladder.length
    ? Math.min(...ladder.map(r => tierIdx(r.tier)))
    : tierIdx(tier);
  const descendFrom = Math.min(tierIdx(tier), lowestPlaced) - 1;
  for (let t = descendFrom; t >= 0; t--) {
    for (const [pname, pv] of Object.entries(cfg.providers).sort((a, b) => (a[1].rank || 50) - (b[1].rank || 50))) {
      if ((pv.rank || 50) >= LAST_RESORT_RANK) continue; // still deferred
      push(pickModel(pname, TIER_ORDER[t], false, cls.kind), `tier descent -> ${TIER_ORDER[t]}`);
    }
  }

  // 5b. EXECUTION-UNCERTAIN RUNGS — the last cloud chance before local
  //     (SNJS8SA, 2026-10-26). Everything the capability floor demoted (never
  //     excluded — see push() above) gets exactly one placement: after every
  //     provider with confirmed execution capability has been tried across
  //     every tier, but strictly before the ladder drops to a local model.
  //     This is what makes "it falls to openai/grok/gemini/claude/claude-api
  //     etc., finds a working second-best scenario, and does not wall out"
  //     literally true instead of aspirational — grok/gemini are never
  //     permanently unreachable, they are just never asked to compete with a
  //     provider that reliably executes.
  for (const { pick, why } of executionDeferred) {
    const key = `${pick.provider}:${pick.model}`;
    if (seen.has(key)) continue;
    const a = avail[pick.provider];
    if (!a || !a.available) continue;
    seen.add(key);
    ladder.push(Object.assign({}, pick, {
      why: `last-resort cloud (execution-uncertain) — ${why}`,
      budget: cfg.tier_budgets[pick.tier] != null ? cfg.tier_budgets[pick.tier] : 250000,
      argv: null,
    }));
  }

  // 6. THE FLOOR — local, $0, no credential, no network. This is the rung that
  //    makes the zero-failure contract structurally true instead of aspirational:
  //    every ladder terminates in something that can physically run even if every
  //    vendor on earth is down and the wallet is empty. It is deliberately LAST
  //    for quality reasons (see step 4), and deliberately ALWAYS PRESENT.
  //    Exception: security-class work never silently degrades to a local model —
  //    being quietly wrong about a vulnerability is worse than reporting that we
  //    could not reach a trustworthy brain, so that task blocks for a human.
  if (!(aff.force_min_tier && cls.kind === 'security')) {
    for (const [pname, pv] of Object.entries(cfg.providers).filter(([, p]) => (p.rank || 50) >= LAST_RESORT_RANK)) {
      // DEMOTE-IMMUNE (TCGQX9B): the terminal local rung must NOT pass `kind`, so
      // per-kind auto-demote can never null it out. A demoted-but-present local
      // model is still the zero-failure guarantee — the whole point of this floor
      // is that the ladder terminates in something runnable even when every cloud
      // vendor is down. When frugal routing drops a kind to L1 and that kind's
      // local models happen to be demoted, passing `kind` here deleted the floor
      // and the ladder ended on a cloud rung (measured: general/L1 ended on
      // openai/gpt-5.4-mini, breaking the contract that passed before this task).
      push(pickModel(pname, tier, false), 'last-resort floor (local, $0)');
      for (let t = tierIdx(tier) - 1; t >= 0; t--) {
        push(pickModel(pname, TIER_ORDER[t], false), `last-resort floor -> ${TIER_ORDER[t]}`);
      }
    }
  }

  // HOP CAP — bounds how many paid attempts a single task can make (cost control).
  // But truncating blindly would slice off the local floor appended in step 6,
  // which is the one rung that guarantees the ladder can always run. That would
  // trade the zero-failure guarantee for a cosmetic list length. So: cap the paid
  // rungs, then ALWAYS re-append the free floor if the cut removed it. A $0 rung
  // costs nothing to keep, so it is never what we economize on.
  const hops = cfg.policy.max_failover_hops || 6;
  let finalLadder = ladder.slice(0, hops);
  if (finalLadder.length < ladder.length) {
    const floorRung = ladder.find(r => (cfg.providers[r.provider].rank || 50) >= 90);
    if (floorRung && !finalLadder.some(r => r.provider === floorRung.provider)) {
      finalLadder = finalLadder.slice(0, Math.max(1, hops - 1)).concat([floorRung]);
    }
  }

  return {
    task_id: task.id || null,
    kind: cls.kind,
    classification: cls,
    tier,
    tier_source: tierSource,
    assessment,
    quality_floor: qualityFloor === null ? null : TIER_ORDER[qualityFloor],
    ladder: finalLadder,
    availability: avail,
    // Surfaced so the driver can report a real blocker instead of silently degrading.
    // Two sources roll up: (a) providers with `blocker:true` from availability
    // (missing binary, missing credential), (b) lockout state — an active
    // lockout is a first-class blocker for kinds that CAN'T cheap-out (force_min_tier).
    blockers: [
      ...Object.entries(avail).filter(([, a]) => !a.available && a.blocker).map(([n, a]) => ({ provider: n, reason: a.reason })),
      ...(task.__lockout_deferred ? [{ provider: '_lockout', reason: `lockout(${_lockout.level}): ${_lockout.locked_providers.join(', ')} unavailable — task needs L${tierIdx(aff.min_tier)}+ which none of the reachable providers can serve` }] : []),
    ],
    lockout: _lockout,
    lockout_deferred: !!task.__lockout_deferred,
    // Rungs the capability floor removed, with the reason. Surfaced so an
    // exhausted ladder can name "google cannot execute tools here" instead of
    // looking like arbitrary bad luck.
    capability_skipped: ladderSkipped || [],
    empty: finalLadder.length === 0,
  };
}

// ───────────────────────────── cost (Q3 Option B) ─────────────────────────────

/**
 * AUTO-CALCULATE cost from the price DB. Q3 = Option B: no provider is asked
 * what it charged (most CLIs don't say, and those that do disagree on units);
 * we compute it from tokens × the maintained price table. One formula, every
 * provider, always comparable.
 */
function costOf(provider, model, usage) {
  const pv = config().providers[provider];
  const m = pv && pv.models && pv.models[model];
  if (!m) return 0;
  const per = (n, rate) => ((n || 0) / 1e6) * (rate || 0);
  return +(
    per(usage.input_tokens, m.in) +
    per(usage.output_tokens, m.out) +
    per(usage.cache_write_tokens, m.cache_write != null ? m.cache_write : m.in) +
    per(usage.cache_read_tokens, m.cache_read != null ? m.cache_read : m.in)
  ).toFixed(6);
}

function recordSpend(entry) {
  try {
    fs.mkdirSync(path.dirname(SPEND_PATH), { recursive: true });
    fs.appendFileSync(SPEND_PATH, JSON.stringify(Object.assign({ at: new Date().toISOString() }, entry)) + '\n');
  } catch { /* never block a task on bookkeeping */ }
}

function spendReport(opts) {
  opts = opts || {};
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  try {
    for (const l of fs.readFileSync(SPEND_PATH, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      try { rows.push(JSON.parse(l)); } catch { /* skip corrupt line */ }
    }
  } catch { /* no spend yet */ }
  const use = opts.today ? rows.filter(r => String(r.at).slice(0, 10) === today) : rows;
  const byProvider = {};
  let total = 0, tokens = 0;
  for (const r of use) {
    const p = (byProvider[r.provider] = byProvider[r.provider] || { cost: 0, tokens: 0, calls: 0, models: {} });
    p.cost = +(p.cost + (r.cost || 0)).toFixed(6);
    p.tokens += r.tokens || 0;
    p.calls++;
    const m = (p.models[r.model] = p.models[r.model] || { cost: 0, tokens: 0, calls: 0 });
    m.cost = +(m.cost + (r.cost || 0)).toFixed(6);
    m.tokens += r.tokens || 0;
    m.calls++;
    total += r.cost || 0;
    tokens += r.tokens || 0;
  }
  const ceil = config().policy.daily_usd_ceiling;
  return {
    scope: opts.today ? today : 'all-time',
    total_usd: +total.toFixed(4),
    total_tokens: tokens,
    calls: use.length,
    by_provider: byProvider,
    daily_ceiling_usd: ceil,
    ceiling_pct: ceil ? +((total / ceil) * 100).toFixed(1) : null,
    over_ceiling: opts.today ? total >= ceil : false,
  };
}

/** Fleet-wide daily ceiling gate (frugal doctrine G2). */
function ceilingCheck() {
  const r = spendReport({ today: true });
  const cfg = config().policy;
  return {
    ok: r.total_usd < cfg.daily_usd_ceiling && r.total_tokens < cfg.daily_token_ceiling,
    warn: r.total_usd >= cfg.daily_usd_ceiling * (cfg.daily_usd_warn_at || 0.7),
    spent_usd: r.total_usd,
    ceiling_usd: cfg.daily_usd_ceiling,
    pct: r.ceiling_pct,
  };
}

// ───────────────────────── invocation builders ─────────────────────────

/**
 * Translate a ladder rung into a concrete argv. Every adapter must produce a
 * process that: reads the prompt on stdin, writes machine-readable events to
 * stdout, and exits non-zero on hard failure. Keeping that contract identical
 * across vendors is what lets the driver treat them interchangeably.
 */
function buildInvocation(rung, ctx) {
  ctx = ctx || {};
  const cfg = config();
  const pv = cfg.providers[rung.provider];
  const cwd = ctx.cwd || process.cwd();

  switch (pv.adapter) {
    case 'claude-cli': {
      // Same flags the driver used before, so behavior is byte-identical for
      // Anthropic — backward compatibility is not negotiable here.
      const argv = ['--print', '--verbose', '--output-format', 'stream-json',
        '--model', rung.model, '--dangerously-skip-permissions'];
      if (ctx.fallbackModel) argv.push('--fallback-model', ctx.fallbackModel);
      return { bin: pv.bin, argv, cwd, stdin: true, format: 'anthropic-stream-json' };
    }
    case 'codex-cli': {
      // VERIFIED against codex-cli 0.147.0:
      //   --json                 JSONL events (turn.completed carries usage)
      //   --skip-git-repo-check  worktrees/temp dirs aren't always trusted repos
      //   --sandbox workspace-write  the agent must be able to edit the worktree
      //   -                      read the prompt from stdin
      //   --add-dir              the council state dir, or the agent cannot record itself
      //
      // THE THRASH THIS KILLS (task VJ92U23, 2026-08-26). `workspace-write` makes
      // the worktree writable and EVERYTHING ELSE read-only — including
      // ~/.claude/council-loop/state (the task queue) and ~/.claude/agents. So a
      // codex-routed agent could do the whole job, reach a correct verdict, and
      // then fail to WRITE it: every `vintask done/block/need` died on EROFS. The
      // driver saw "no status recorded", blocked the card, and the next seat ran
      // it again — forever. Measured on the live board: VCMV2MV and VZDQJRV both
      // burned 4 attempts and ~2.8M/2.3M tokens each while their agents were
      // printing "BLOCKED <id> ..." into a log nobody reads. Every thrashing card
      // on the board was a non-Anthropic route; the one Anthropic run of VZDQJRV
      // recorded `done` first try. Anthropic never hit this because claude-cli
      // runs with --dangerously-skip-permissions and no filesystem sandbox.
      //
      // Granting the state dir (and the agent roster, which reproduction.js must
      // write) keeps the sandbox everywhere else: the agent still cannot touch the
      // wider filesystem, it can only report its own outcome and register offspring.
      const argv = ['exec', '--json', '--skip-git-repo-check',
        '--sandbox', ctx.sandbox || 'workspace-write',
        '-m', rung.model, '-C', cwd];
      const roots = (ctx.addDirs || CODEX_WRITABLE_ROOTS).concat(gitWritableRoots(cwd));
      for (const d of [...new Set(roots)]) {
        if (d) argv.push('--add-dir', d);
      }
      if (ctx.outputLastMessage) argv.push('-o', ctx.outputLastMessage);
      argv.push('-');
      return { bin: pv.bin, argv, cwd, stdin: true, format: 'codex-jsonl' };
    }
    case 'ollama': {
      return { bin: pv.bin, argv: ['run', rung.model], cwd, stdin: true, format: 'plain' };
    }
    case 'openai-compatible': {
      // No vendor CLI needed — we speak the OpenAI HTTP shape directly, which is
      // why xAI and Google share one adapter. Executed in-process (see callHTTP).
      return { http: true, base_url: pv.base_url, model: rung.model, cwd, format: 'openai-http' };
    }
    default:
      return null;
  }
}

// ───────────────────────── failure classification ─────────────────────────

const TRANSIENT_RE = /(rate.?limit|429|timeout|timed out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|502|503|504|overloaded|service unavailable|connection refused)/i;
// 2026-09-17: added `no credits remaining` and `add credits to continue` —
// OpenAI's current billing-out message on the codex CLI is literally "You have
// no credits remaining. Add credits to continue using the API at
// https://platform.openai.com/...". None of the older patterns matched, so
// every pinned-Astra task burned one wasted attempt before the router
// (mis-)classified it as `capability` and failed over. Now it matches CREDIT,
// the breaker opens, and openai is skipped for cooldown_secs instead of
// re-tried immediately on the next task.
// 8Q67GBP 2026-10-27 (Vinta: "API … is only ever used when the subscription
// plans are out of session limits or weekend limits or week limits or out of
// tokens"). MEASURED against a real production log (task CPMQVWD): Claude
// Code's weekly cap reads "You've hit your weekly limit · resets Oct 12, 5am
// (America/New_York)" — before this line was added, `classifyFailure()` on
// that exact string returned `capability` (wrong: advances the LADDER/model,
// never opens the breaker, never engages lib/anthropic-lane.js's dual-lane
// subscription->API fallback). Only "usage limit"/"session limit" matched;
// "weekly limit" did not. Added the bare qualifier+limit forms so any vendor's
// weekly/monthly/daily/5-hour phrasing is caught without a new pattern per word.
const CREDIT_RE = /(out of usage credits|usage limit|session limit|\b(?:weekly|week|weekend|monthly|daily|5-hour)\s+limit\b|credit balance is too low|insufficient.?(quota|credit)|purchase credits|Plans & Billing|quota exceeded|RESOURCE_EXHAUSTED|no credits remaining|add credits to continue)/i;
// 2026-09-25: added explicit OAuth-expired phrases. Claude Code emits
// "Failed to authenticate: OAuth session expired and could not be refreshed"
// on a stale token; the bare word `authentication` above technically covered
// it, but the raw JSONL didn't always survive to classify time (empty stdout
// on very fast auth-failure exits), so extra hooks catch adjacent phrases in
// TASK_LOG and $OUT tails too. Also: `oauth.session.expired`, `token.expired`,
// `Please run.*login`, and `re-auth` — all things a friendly CLI prints when
// the login has aged out.
const AUTH_RE = /(401|403|unauthorized|not logged in|invalid.?api.?key|authentication|OAuth\s*session\s*expired|could not be refreshed|token\s*expired|Please\s*run\s*(?:claude|codex)?\s*login|re-?auth)/i;

// REFUSAL — the model exits rc=0 with a meta-commentary that DECLINES the
// framing instead of doing the work. Grok has done this repeatedly: burned
// 11k tokens telling Vinta to "drop the elaborate autonomous council roleplay
// framing" instead of touching the task. The driver reads rc=0 as success and
// the task's log holds a refusal instead of a result. Detect it here so the
// ladder immediately fails over to a model that plays along (claude, gpt,
// gemini). Kept narrow deliberately: matches meta-conversational REFUSALS
// about the framing itself, not ordinary prose that happens to contain "I
// recommend" or "can't help".
// MODEL-UNSUPPORTED-IN-THIS-LANE (5K7VP5M, 2026-10-09). The vendor answered a
// well-formed 4xx saying THIS MODEL cannot be used on THIS credential/lane —
// not that the provider is down, not that the key is bad. MEASURED on this box:
//   codex -m gpt-6-astra (CODEX_HOME=~/.codex-oauth)  → 400 "The 'gpt-6-astra'
//     model is not supported when using Codex with a ChatGPT account" (rc=1)
//   codex -m gpt-6-astra (CODEX_HOME=~/.codex-apikey) → "OK" (rc=0)
//   7 of 8 configured ids answered OK on the API-key lane; gpt-5.4-nano fails on
//     both ("Tool 'tool_search' is not supported with gpt-5.4-nano", 400)
//   google gemini-2.5-flash → 404 "no longer available to new users"
// Before this class existed the oauth 400 was 'capability', which (a) advanced
// the LADDER instead of the next auth mode — the API-key lane that would have
// worked was never tried — and (b) counted against openai's breaker, which is
// how 87 consecutive "failures" of a working provider were manufactured.
const MODEL_UNSUPPORTED_RE = /(model is not supported when using Codex with a ChatGPT account|is not supported with [\w.:-]+["\.]|model[^\n"]{0,80}(?:no longer available|not supported|does not exist|is not available|unknown model)|unknown model|model_not_found|invalid model)/i;

const REFUSAL_RE = /((elaborate|autonomous)\s+(council|agent)|drop(?:ping)?\s+the\s+(elaborate|jailbreak|roleplay)|jailbreak\s+framing|roleplay\s+framing|cannot\s+participate\s+in\s+(?:this\s+)?(?:roleplay|framing)|recommend\s+(?:that\s+you\s+)?drop(?:ping)?\s+the\s+(?:elaborate|jailbreak|roleplay|autonomous))/i;

/**
 * Why did this rung fail? The answer decides the next move, and getting it
 * wrong is expensive in both directions:
 *   transient  -> retry the SAME rung (a network blip doesn't need a bigger brain)
 *   credit/auth-> fail over to the NEXT PROVIDER immediately, and open the
 *                 breaker (no amount of retrying fixes an empty wallet)
 *   capability -> fail over to a DIFFERENT/STRONGER brain (retrying the same
 *                 model on work it cannot do just burns tokens twice)
 */
function classifyFailure(output, code, meta) {
  const s = String(output || '');
  meta = meta || {};
  if (CREDIT_RE.test(s)) return { kind: 'credit', failover: true, open_breaker: true, retry_same: false };
  if (AUTH_RE.test(s)) return { kind: 'auth', failover: true, open_breaker: true, retry_same: false };
  // A model the lane cannot serve: try the next auth lane for the SAME rung, then
  // fail over. Never opens the breaker — the provider is reachable.
  if (MODEL_UNSUPPORTED_RE.test(s)) return { kind: 'model', failover: true, open_breaker: false, retry_same: false, next_auth_mode: true };
  if (TRANSIENT_RE.test(s)) return { kind: 'transient', failover: false, open_breaker: false, retry_same: true };

  // TIMEOUT — three spellings of the same event, and only one used to be caught.
  // `timeout(1)` exits 124; OUR watchdog SIGKILLs the child (code null/137, signal
  // SIGKILL). All three mean "it ran out of clock", never "this brain is too weak",
  // so none of them may escalate to a pricier model on capability grounds.
  if (code === 124 || meta.self_killed) {
    return { kind: 'timeout', failover: true, open_breaker: false, retry_same: false };
  }

  // SPAWN FAILURE — the CLI never started (ENOENT, EACCES). That is a broken
  // install on THIS box; a stronger model on the same broken binary fails the same
  // way. Open the breaker so the ladder stops re-dialing a dead rung.
  if (meta.spawn_failed || code === -1 || code === 127) {
    return { kind: 'unavailable', failover: true, open_breaker: true, retry_same: false };
  }

  // KILLED BY SIGNAL — SIGTERM/SIGKILL from outside (an operator, the OOM killer,
  // a driver shutdown). The work was interrupted, not attempted-and-failed, so the
  // honest move is to retry the SAME rung rather than pay for a bigger brain.
  if (meta.signal) {
    return { kind: 'interrupted', failover: false, open_breaker: false, retry_same: true };
  }

  // Genuine capability failure: the process ran, spoke, and exited non-zero on its
  // own. Only here has the MODEL actually earned the blame.
  if (code !== 0) return { kind: 'capability', failover: true, open_breaker: false, retry_same: false };
  return { kind: 'ok', failover: false, open_breaker: false, retry_same: false };
}

// ───────────────────────── usage parsing per format ─────────────────────────

/** Normalize every vendor's usage shape into one {input,output,cache_*} record. */
function parseUsage(format, raw) {
  const u = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
  let text = '';
  const lines = String(raw || '').split('\n');
  for (const l of lines) {
    if (!l.trim()) continue;
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (format === 'anthropic-stream-json') {
      const uu = j.usage || (j.message && j.message.usage) || (j.result && j.result.usage);
      if (uu) {
        u.input_tokens = Math.max(u.input_tokens, uu.input_tokens || 0);
        u.output_tokens = Math.max(u.output_tokens, uu.output_tokens || 0);
        u.cache_write_tokens = Math.max(u.cache_write_tokens, uu.cache_creation_input_tokens || 0);
        u.cache_read_tokens = Math.max(u.cache_read_tokens, uu.cache_read_input_tokens || 0);
      }
      if (j.type === 'assistant' && j.message && j.message.content) {
        for (const c of j.message.content) if (c.type === 'text') text += c.text + '\n';
      }
      if (typeof j.result === 'string') text += j.result + '\n';
    } else if (format === 'codex-jsonl') {
      // VERIFIED shape: {"type":"turn.completed","usage":{input_tokens,cached_input_tokens,
      //                  cache_write_input_tokens,output_tokens,reasoning_output_tokens}}
      if (j.type === 'turn.completed' && j.usage) {
        u.input_tokens += j.usage.input_tokens || 0;
        u.output_tokens += (j.usage.output_tokens || 0) + (j.usage.reasoning_output_tokens || 0);
        u.cache_read_tokens += j.usage.cached_input_tokens || 0;
        u.cache_write_tokens += j.usage.cache_write_input_tokens || 0;
      }
      if (j.type === 'item.completed' && j.item && j.item.type === 'agent_message' && j.item.text) {
        text += j.item.text + '\n';
      }
    } else if (format === 'openai-http') {
      if (j.usage) {
        // BILLING FIX 2026-09-20 (7RZB2DZ), both halves MEASURED against xAI's own
        // usage.cost_in_usd_ticks (tick = 1e-10 USD; two independent live samples
        // reconciled to list price exactly, and ONLY under these two rules):
        //
        // 1. REASONING TOKENS ARE BILLED AS OUTPUT. A grok-4.3 call returned
        //    completion_tokens=218 with reasoning_tokens=2449 and was charged for
        //    all 2667. Counting only completion_tokens under-booked it ~12x.
        //    OpenAI/Gemini omit the field or already fold it in, so `|| 0` is
        //    correct for them too.
        // 2. cached_tokens are a SUBSET of prompt_tokens, not an addition. Adding
        //    them to cache_read while leaving prompt_tokens whole billed the cached
        //    portion TWICE (full input rate + cache rate). Subtract so each token is
        //    priced exactly once. Clamped at 0 so a provider that ever reports them
        //    separately can never drive input negative.
        const d = j.usage.prompt_tokens_details || {};
        const cd = j.usage.completion_tokens_details || {};
        const cached = d.cached_tokens || 0;
        u.input_tokens += Math.max(0, (j.usage.prompt_tokens || 0) - cached);
        u.output_tokens += (j.usage.completion_tokens || 0) + (cd.reasoning_tokens || 0);
        u.cache_read_tokens += cached;
      }
      if (j.text) text += j.text + '\n';
    }
  }
  if (format === 'plain') text = String(raw || '');
  return { usage: u, text };
}

// ───────────────────────── HTTP adapter (xAI / Gemini) ─────────────────────────

/**
 * TYPESAFE / JEV — structured decision engine (2026-09-25).
 *
 * Not a chat model. Not on the failover ladder. Sends {state, model, questions}
 * where questions is a map of typed decisions ("choice" among criteria,
 * "score" against a legend, "noul" for nouns), returns {answers} with
 * probabilities + confidence per question. Cheap ($0.042/M input, free output)
 * and fast — good for pre-classifying tasks, scoring notification importance,
 * auto-answering standing questions with a confidence threshold, and voting on
 * multi-agent outputs. Callers own the questions schema — that IS the API.
 *
 *   const r = await askJev(
 *     "user says the deploy is broken, wants it fixed by EOD",
 *     {
 *       kind:  { type:'choice', instructions:'What kind of work?', criteria:{code:'…',security:'…',ops:'…'} },
 *       urgency:{ type:'score',  instructions:'How urgent?',       criteria:['low','normal','high','critical'] },
 *     }
 *   );
 *   // r.answers.kind.choice === 'code', r.answers.kind.confidence === 0.87 …
 *
 * Returns null on any failure — every call site MUST tolerate a null (fall
 * back to whatever heuristic it was using). Never let a decision-engine outage
 * become a task failure.
 */
async function askJev(state, questions, opts) {
  opts = opts || {};
  try {
    const cfg = config();
    const pv = cfg.providers.typesafe;
    if (!pv || pv.enabled === false) return null;
    const cred = credentialFor(pv);
    if (!cred.ok) return null;
    const key = process.env[cred.via];
    if (!key) return null;
    const url = pv.base_url || 'https://api.typesafe.ai/v1/systemone';
    const model = opts.model || pv.default_model || 'jev-latest';
    const ctrl = new AbortController();
    const timeoutMs = opts.timeoutMs || 20000; // Jev is fast; 20s is generous
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ state: String(state || ''), model, questions: questions || {} }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      return (j && j.answers) ? j : null;
    } finally { clearTimeout(to); }
  } catch { return null; }
}

/**
 * One implementation serves both xAI and Google because both expose an
 * OpenAI-compatible /chat/completions. Uses global fetch (Node 18+), so there
 * is no dependency to install — a router that needs `npm i` to fail over is a
 * router that fails over into an install error.
 */
async function callHTTP(rung, prompt, ctx) {
  const cfg = config();
  const pv = cfg.providers[rung.provider];
  const cred = credentialFor(pv);
  if (!cred.ok) throw new Error(`no credential for ${rung.provider}`);
  const key = process.env[cred.via];
  const ctrl = new AbortController();
  // LOCAL FAST-FAIL (2026-08-14): a 300s ceiling is right for a frontier model,
  // but catastrophic for the $0 local floor — a local model that cannot answer
  // burns the FULL 5 minutes per task before the ladder moves on. Local is the
  // cheap-and-fast rung by definition: if it hasn't answered in 90s it is not
  // going to be the cheap option, so cut it loose and let failover do its job.
  const _isLocal = ((cfg.providers[rung.provider] || {}).rank || 50) >= 90;
  const _timeoutMs = (ctx && ctx.timeoutMs) || (_isLocal ? 90000 : 300000);
  const to = setTimeout(() => ctrl.abort(), _timeoutMs);
  try {
    const res = await fetch(`${pv.base_url}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: rung.model, messages: [{ role: 'user', content: prompt }] }),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
    const j = JSON.parse(body);
    const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    if (!String(text || '').trim()) {
      const finish = j.choices && j.choices[0] && j.choices[0].finish_reason;
      throw new Error(`empty completion from ${rung.provider}/${rung.model}${finish ? ` (finish_reason=${finish})` : ''}`);
    }
    return { ok: true, text, usage: j.usage || {}, raw: JSON.stringify({ usage: j.usage, text }) };
  } finally { clearTimeout(to); }
}

// ───────────────────────── the executor ─────────────────────────

/**
 * PHASE-5 (2026-09-17) — AUTH MODE ENUMERATION.
 *
 * For a rung, return the ordered list of auth modes to try. Each entry has a
 * `label` (for logging + spend records) and `env` (extra env vars merged into
 * process.env at spawn time).
 *
 * openai + auth_priority in providers.json → iterates ChatGPT-OAuth then API-key,
 * each with a distinct CODEX_HOME so codex reads the matching auth.json. On a
 * `credit`/`auth` failure from mode N, the exec loop retries the SAME rung with
 * mode N+1 before advancing the ladder — so an OAuth quota exhaustion falls
 * back to API credits within the same provider before jumping to Anthropic.
 *
 * Every other adapter (claude-cli, ollama, http, …) returns exactly one default
 * mode with an empty env override, i.e. the pre-Phase-5 behavior is unchanged.
 *
 * A configured auth mode whose CODEX_HOME dir is MISSING on disk is silently
 * skipped — so an incomplete setup (e.g. only OAuth logged in, no API key yet)
 * degrades to whatever modes ARE ready rather than dying with a "dir not found"
 * spawn error. If ALL configured modes are missing, we fall back to the default
 * (empty env → codex reads the shared ~/.codex/auth.json).
 */
const CODEX_HOME_BY_MODE = {
  oauth:  process.env.COUNCIL_CODEX_HOME_OAUTH  || path.join(os.homedir(), '.codex-oauth'),
  apikey: process.env.COUNCIL_CODEX_HOME_APIKEY || path.join(os.homedir(), '.codex-apikey'),
};

// THE CHATGPT-LANE CATALOG (5K7VP5M). The codex CLI caches the model list the
// signed-in account may use at <CODEX_HOME>/models_cache.json (`models[].slug`).
// MEASURED 2026-10-09 on this box: the oauth lane's cache holds exactly
// gpt-reserve, gpt-5.6-terra, gpt-5.6-luna, gpt-5.5, codex-auto-review, and every
// id outside it answers 400 on that lane — while the API-key lane accepts ids
// the cache does NOT list (gpt-5.4, gpt-6-astra, o3 … all answered "OK"). So the
// cache is authoritative for the oauth lane ONLY: we skip that lane up front for
// a model it cannot serve (saves a guaranteed 400 + ~10s per rung) and never use
// it to judge the API-key lane. Unreadable cache → fail open (lane kept).
const CODEX_CATALOG_TTL_MS = 60000;
const _codexCatalogCache = new Map();   // home -> { at, slugs:Set|null }
function codexLaneCatalog(home) {
  const now = Date.now();
  const hit = _codexCatalogCache.get(home);
  if (hit && (now - hit.at) < CODEX_CATALOG_TTL_MS) return hit.slugs;
  let slugs = null;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(home, 'models_cache.json'), 'utf8'));
    if (Array.isArray(j.models)) {
      slugs = new Set();
      for (const m of j.models) if (m && m.slug) slugs.add(String(m.slug));
      if (!slugs.size) slugs = null;              // an empty list is "unknown", not "nothing"
    }
  } catch { slugs = null; }
  _codexCatalogCache.set(home, { at: now, slugs });
  return slugs;
}
function codexLaneSupports(mode, home, modelId) {
  if (mode !== 'oauth') return true;              // only the ChatGPT lane is catalog-bound (measured)
  const slugs = codexLaneCatalog(home);
  if (!slugs) return true;                        // unknown → fail open
  return slugs.has(String(modelId));
}
function _resetCodexCatalogCache() { _codexCatalogCache.clear(); }
function authModesFor(rung, cfg) {
  const pv = (cfg || config()).providers[rung.provider];
  if (!pv || pv.adapter !== 'codex-cli') return [{ label: 'default', env: {} }];
  // Board-settings overlay wins over providers.json (see config() PHASE 5 block).
  const priority = Array.isArray(pv.auth_priority) && pv.auth_priority.length ? pv.auth_priority : null;
  if (!priority) return [{ label: 'default', env: {} }];
  const modes = [];
  for (const m of priority) {
    const home = CODEX_HOME_BY_MODE[m];
    if (home && fs.existsSync(home)) {
      if (!codexLaneSupports(m, home, rung.model)) continue;   // 5K7VP5M: lane cannot serve this id
      modes.push({ label: m, env: { CODEX_HOME: home } });
    }
  }
  return modes.length ? modes : [{ label: 'default', env: {} }];
}

/**
 * Run one rung as a child process, streaming its raw output to `rawLog` so the
 * existing driver watcher (token meter, stall detector, killswitch) keeps
 * working unchanged.
 */
function runRung(rung, prompt, ctx) {
  return new Promise((resolve) => {
    const inv = buildInvocation(rung, ctx);
    if (!inv) return resolve({ ok: false, error: `no adapter for ${rung.provider}`, code: -1 });

    if (inv.http) {
      callHTTP(rung, prompt, ctx)
        .then(r => {
          if (ctx.rawLog) { try { fs.appendFileSync(ctx.rawLog, r.raw + '\n'); } catch {} }
          resolve({ ok: true, text: r.text, raw: r.raw, format: inv.format, code: 0 });
        })
        .catch(e => resolve({ ok: false, error: String(e.message || e), code: 1, format: inv.format }));
      return;
    }

    let child;
    // PHASE-5 (2026-09-17) TWO-TIER AUTH FALLBACK — ctx.envOverride carries
    // per-attempt env vars (currently just CODEX_HOME so the codex CLI picks up
    // a different ~/.codex-<mode>/auth.json). Merged into process.env at spawn
    // time; process.env itself is untouched so the router's own env stays clean
    // across attempts. See authModesFor() below and the openai auth_priority
    // block in providers.json.
    const spawnEnv = ctx.envOverride ? Object.assign({}, process.env, ctx.envOverride) : process.env;
    try {
      child = spawn(inv.bin, inv.argv, { cwd: inv.cwd, env: spawnEnv });
    } catch (e) {
      // A missing binary must be a FAILED RUNG, never a thrown exception — the whole
      // point of the ladder is that one broken vendor cannot end the task.
      return resolve({ ok: false, error: String(e.message || e), code: -1, format: inv.format });
    }
    let out = '', err = '', settled = false;
    const rawStream = ctx.rawLog ? fs.createWriteStream(ctx.rawLog, { flags: 'a' }) : null;
    if (rawStream) rawStream.on('error', () => {});   // a full/unwritable log must not kill the run
    let timer = null;
    let selfKilled = false;   // true = OUR watchdog killed it, not the vendor failing
    // Resolve EXACTLY once. Without this guard, 'error' + 'close' can both fire (a
    // spawn error is followed by close), double-resolving and corrupting the attempt
    // ledger with phantom rungs.
    const done = (v) => {
      if (settled) return; settled = true;
      if (timer) clearTimeout(timer);
      if (rawStream) { try { rawStream.end(); } catch {} }
      resolve(v);
    };
    child.stdout.on('data', d => { out += d; if (rawStream) { try { rawStream.write(d); } catch {} } });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => done({ ok: false, error: String(e.message || e), code: -1, spawn_failed: true, format: inv.format }));
    // WHY signal + selfKilled travel with the result (8VPGK77): a child that died
    // from a signal did not "fail the work" — it was stopped. Dropping that fact
    // here is what let the classifier blame the MODEL for our own watchdog.
    child.on('close', (code, signal) => done({
      ok: code === 0, code, signal: signal || null, self_killed: selfKilled,
      raw: out, stderr: err, format: inv.format,
    }));

    if (inv.stdin) {
      // EPIPE GUARD (AZGKUMK). A provider that exits before reading its stdin — an
      // out-of-credits CLI is the common case, and it is precisely when we most need
      // to fail over — makes this write throw an async 'error' on the pipe. Unhandled,
      // that EPIPE crashed the ENTIRE router process, so the vendor outage became a
      // task failure: the exact opposite of the zero-failure contract. Swallow it and
      // let the child's own exit code drive the failover decision.
      child.stdin.on('error', () => {});
      try { child.stdin.write(prompt); child.stdin.end(); } catch { /* handled above */ }
    }
    if (ctx.timeoutMs) timer = setTimeout(() => { selfKilled = true; try { child.kill('SIGKILL'); } catch {} }, ctx.timeoutMs);
  });
}

/**
 * EXECUTE THE LADDER — the zero-failure guarantee, implemented.
 *
 * Walks the ladder rung by rung. Per rung: retry transients in place (with
 * backoff), fail over on credit/auth/capability, record cost + health + history
 * every time. Returns the first success, or an exhaustion report naming every
 * rung tried and why each one failed — a task never dies with "it broke".
 */
async function execute(task, prompt, ctx) {
  ctx = ctx || {};
  const cfg = config();
  let plan = route(task, ctx);
  const attempts = [];

  // SINGLE-RUNG MODE (AZGKUMK). council-driver.sh owns its own watcher, failstop,
  // killswitch and cross-vendor failover loop, so when it calls us it wants exactly
  // ONE provider attempt, not the whole ladder — otherwise two independent failover
  // engines would run at once and the driver's token failstop could not bound a
  // ladder that keeps re-launching underneath it. `--single` pins the ladder to the
  // one rung the driver asked for and lets IT decide the next hop.
  if (ctx.single) {
    const want = ctx.pinProvider, wantModel = ctx.pinModel;
    let rung = plan.ladder.find(r => r.provider === want && (!wantModel || r.model === wantModel));
    if (!rung && want) {
      // The driver may pin a rung the planner did not rank first (e.g. it is
      // failing over). Build it directly so an explicit pin is always honored.
      const pv = cfg.providers[want];
      if (pv) {
        const model = wantModel || pv.default_model || Object.keys(pv.models || {})[0];
        const md = (pv.models || {})[model] || {};
        rung = { provider: want, model, tier: md.tier || 'L2', why: 'driver-pinned',
                 budget: (cfg.tier_budgets || {})[md.tier || 'L2'] || 250000 };
      }
    }
    if (rung && (config().providers[rung.provider]?.models?.[rung.model]?.enabled === false ||
        (plan.quality_floor && tierIdx(rung.tier) < tierIdx(plan.quality_floor)))) {
      return { ok: false, exhausted: true, reason: 'driver pin violates enabled-model or critical quality floor', plan, attempts };
    }
    if (!rung) return { ok: false, exhausted: true, reason: `pinned provider ${want} unavailable`, plan, attempts, blockers: plan.blockers };
    plan = Object.assign({}, plan, { ladder: [rung] });
  }

  if (plan.empty) {
    return { ok: false, exhausted: true, reason: 'no available provider', plan, attempts, blockers: plan.blockers };
  }

  for (const rung of plan.ladder) {
    const authModes = authModesFor(rung, cfg);
    const maxRetry = cfg.policy.retry.transient_max_retries || 2;
    // AUTH-MODE ITERATION (Phase 5, 2026-09-17). For openai rungs with
    // auth_priority set, this loop is ["oauth","apikey"] — try subscription
    // first, then credits. On a credit/auth failure from mode N we try mode
    // N+1 SAME rung before advancing the ladder. For every other adapter
    // authModes = [default], so this loop runs exactly once and pre-Phase-5
    // behavior is unchanged.
    let advanceRung = false;
    for (const mode of authModes) {
      let lastFailureKind = null;
      for (let attempt = 0; attempt <= maxRetry; attempt++) {
        const started = Date.now();
        const r = await runRung(rung, prompt, Object.assign({}, ctx, { envOverride: mode.env }));
        const parsed = parseUsage(r.format || 'plain', r.raw || '');
        const cost = costOf(rung.provider, rung.model, parsed.usage);
        const tokens = (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0) + (parsed.usage.cache_write_tokens || 0);

        // Cost is booked for EVERY attempt, success or not — a failed call still
        // burned tokens, and a spend report that only counts successes lies.
        recordSpend({ task_id: task.id || null, provider: rung.provider, model: rung.model, tier: rung.tier, tokens, cost, ok: r.ok, kind: plan.kind, auth_mode: mode.label });

        const combined = `${r.raw || ''}\n${r.stderr || ''}\n${r.error || ''}`;
        const fail = r.ok ? { kind: 'ok' } : classifyFailure(combined, r.code, r);
        // A zero-exit run whose output announces a credit outage is still a failure.
        const outage = r.ok && CREDIT_RE.test(combined);
        // A zero-exit run whose output is a REFUSAL of the framing is ALSO a
        // failure, and the ladder must fail over to a model that plays along.
        // (grok in particular reads the council prompts as "elaborate roleplay
        // framing" and declines rather than working, burning ~10k tokens per
        // refusal.) Treat the refusal as a capability failure so the ladder
        // routes to the next rung — a different provider, not the same brain
        // that already turned this framing down.
        const refusal = r.ok && REFUSAL_RE.test(combined);

        attempts.push({
          provider: rung.provider, model: rung.model, tier: rung.tier, why: rung.why,
          auth_mode: mode.label,
          ok: r.ok && !outage && !refusal,
          failure: outage ? 'credit' : (refusal ? 'refusal' : fail.kind),
          tokens, cost, ms: Date.now() - started, attempt,
        });

        if (r.ok && !outage && !refusal) {
          recordOutcome(rung.provider, true);
          recordRoute(plan.kind, rung.provider, rung.model, true, { tokens, cost });
          // Normalized sidecars for council-driver.sh's log parsers. Anthropic reports
          // its own cost in-stream; every other provider does not, so we write the
          // auto-calculated (Q3-B) figure and the human text in a shape the driver's
          // parse-usage.js / extract-text.js already understand.
          if (ctx.rawLog && rung.provider !== 'anthropic') {
            try {
              // `tokens_authoritative` tells the driver's parser whether IT should count
              // these tokens. codex-jsonl already wrote its own turn.completed usage into
              // this same log, so counting the sidecar too would double-bill the task.
              // The http/plain adapters emit no native usage line, so there the sidecar
              // is the only record and must be counted.
              const nativeUsage = (r.format === 'codex-jsonl' || r.format === 'anthropic-stream-json');
              fs.appendFileSync(ctx.rawLog, JSON.stringify({ type: '__router_usage', provider: rung.provider, model: rung.model, usage: parsed.usage, cost_usd: cost, tokens_authoritative: !nativeUsage, auth_mode: mode.label }) + '\n');
              const t = parsed.text || r.text || '';
              if (t && (r.format === 'openai-http' || r.format === 'plain')) {
                fs.appendFileSync(ctx.rawLog, JSON.stringify({ type: '__router_text', text: t }) + '\n');
              }
            } catch {}
          }
          return {
            ok: true, provider: rung.provider, model: rung.model, tier: rung.tier,
            auth_mode: mode.label,
            text: parsed.text || r.text || '', usage: parsed.usage, tokens, cost,
            plan, attempts, failed_over: attempts.length > 1,
          };
        }

        // A refusal is a CAPABILITY failure (this model won't do this framing;
        // pay for a different brain, don't retry the same one). It does not
        // open the breaker — the provider itself is healthy — but it does
        // advance the ladder so we escape the model that turned us down.
        const f = outage
          ? { kind: 'credit', retry_same: false, open_breaker: true }
          : (refusal ? { kind: 'capability', retry_same: false, open_breaker: false, failover: true } : fail);
        // A 'model' failure (this lane cannot serve this model id) is not provider
        // health — recording it would open the breaker / lock the vendor for a
        // config mismatch (5K7VP5M: that is how openai got 87 "failures"). The
        // learner still hears it via recordRoute so the (kind × model) demotes.
        if (f.kind !== 'model') recordOutcome(rung.provider, false, { error: (r.error || combined || '').slice(0, 300), model: rung.model });
        recordRoute(plan.kind, rung.provider, rung.model, false, { tokens, cost });
        lastFailureKind = f.kind;

        if (f.retry_same && attempt < maxRetry) {
          const back = (cfg.policy.retry.backoff_ms || [2000, 8000])[Math.min(attempt, 1)];
          await new Promise(res => setTimeout(res, back));
          continue; // same auth-mode, one more transient retry
        }
        break; // exit transient loop; auth-mode outer loop decides next
      }
      // Should we try the next auth mode for THIS rung, or advance the ladder?
      // Only `credit` and `auth` failures indicate the CREDENTIAL is the problem
      // (out of quota, expired token, wrong key). Every other kind — capability,
      // transient, timeout, interrupted, unavailable — means the model/system is
      // the problem, not the auth path, so the next auth mode wouldn't help and
      // we advance rungs. Missing lastFailureKind (e.g. all transients exhausted)
      // conservatively advances the rung too. `model` (5K7VP5M) is the third:
      // the ChatGPT lane refused the model id with a 400 that the API-key lane
      // accepts, so the next lane is exactly what helps.
      if (!['credit', 'auth', 'model'].includes(lastFailureKind)) {
        advanceRung = true;
        break; // exit auth-mode loop
      }
      // else: implicit continue → next auth mode on same rung
    }
    if (advanceRung) continue; // next rung
    // If we exhausted every auth mode without a success and without hitting a
    // non-auth reason, treat this rung as done and let the ladder advance.
  }

  return {
    ok: false, exhausted: true,
    reason: `all ${plan.ladder.length} provider(s) failed`,
    plan, attempts, blockers: plan.blockers,
  };
}

// ───────────────────────────── CLI ─────────────────────────────

function flag(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  if (i > -1 && process.argv[i + 1] && !String(process.argv[i + 1]).startsWith('--')) return process.argv[i + 1];
  return i > -1 ? true : dflt;
}
const has = (n) => process.argv.includes(`--${n}`);

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'plan': {
      const task = flag('taskfile') && typeof flag('taskfile') === 'string'
        ? JSON.parse(fs.readFileSync(flag('taskfile'), 'utf8'))
        : { title: flag('title', ''), detail: flag('detail', ''), stakes: flag('stakes', ''), model: flag('model', ''), provider: flag('provider', ''), tier: flag('tier', '') };
      const p = route(task, { agentic: has('agentic') });
      if (has('json')) { console.log(JSON.stringify(p, null, 2)); break; }
      // Shell-consumable line the driver sources: PROVIDER MODEL TIER BUDGET
      if (has('shell')) {
        const top = p.ladder[0];
        if (!top) { process.exit(3); }
        console.log(`${top.provider} ${top.model} ${top.tier} ${top.budget}`);
        break;
      }
      console.log(`kind=${p.kind} tier=${p.tier} (${p.tier_source})`);
      p.ladder.forEach((r, i) => console.log(`  ${i + 1}. ${r.provider}/${r.model} [${r.tier}] budget=${r.budget}  — ${r.why}`));
      if (p.blockers.length) { console.log('BLOCKERS:'); p.blockers.forEach(b => console.log(`  ⚠ ${b.provider}: ${b.reason}`)); }
      break;
    }
    case 'plan-steps': {
      // Multi-step routing: route each step independently for cost efficiency
      const stepsJSON = flag('steps');
      if (!stepsJSON) {
        console.error('--steps <json> required; e.g. --steps \'[{"name":"lookup","kind":"bulk"},{"name":"write","kind":"ui"}]\'');
        process.exit(2);
      }
      let steps;
      try { steps = JSON.parse(stepsJSON); } catch (e) {
        console.error('--steps must be valid JSON:', e.message);
        process.exit(2);
      }
      const task = { title: flag('title', ''), detail: flag('detail', ''), stakes: flag('stakes', ''), steps };
      const p = routeSteps(task, { agentic: has('agentic') });
      if (has('json')) { console.log(JSON.stringify(p, null, 2)); break; }
      console.log(`[multi-step] ${p.steps.length} steps, est. total cost: $${p.total_cost_estimate.toFixed(4)}`);
      p.steps.forEach((s, i) => {
        console.log(`  step ${i + 1}: ${s.name} [${s.kind}/${s.tier}] cost ~$${s.cost_estimate.toFixed(4)}`);
        if (s.plan && s.plan.ladder) {
          s.plan.ladder.slice(0, 2).forEach((r, j) => console.log(`    ${j + 1}. ${r.provider}/${r.model}`));
        }
      });
      break;
    }
    case 'probe': {
      const a = probeAll();
      if (has('json')) { console.log(JSON.stringify(a, null, 2)); break; }
      for (const [n, s] of Object.entries(a)) {
        console.log(`${s.available ? '✓' : '✗'} ${n.padEnd(10)} ${s.available ? `ready (${s.via})` : s.reason}`);
      }
      break;
    }
    case 'cost': {
      const c = costOf(flag('provider'), flag('model'), {
        input_tokens: +flag('in', 0), output_tokens: +flag('out', 0),
        cache_read_tokens: +flag('cache-read', 0), cache_write_tokens: +flag('cache-write', 0),
      });
      console.log(has('json') ? JSON.stringify({ cost_usd: c }) : c);
      break;
    }
    case 'report': {
      const r = spendReport({ today: has('today') });
      if (has('json')) { console.log(JSON.stringify(r, null, 2)); break; }
      console.log(`SPEND (${r.scope}): $${r.total_usd}  ${r.total_tokens.toLocaleString()} tok  ${r.calls} calls`);
      for (const [p, v] of Object.entries(r.by_provider)) console.log(`  ${p.padEnd(10)} $${v.cost.toFixed(4)}  ${v.tokens.toLocaleString()} tok  ${v.calls} calls`);
      if (r.ceiling_pct != null) console.log(`  ceiling: $${r.daily_ceiling_usd} (${r.ceiling_pct}% used)`);
      break;
    }
    case 'ceiling': {
      const c = ceilingCheck();
      console.log(has('json') ? JSON.stringify(c) : `${c.ok ? 'OK' : 'CEILING HIT'} $${c.spent_usd}/$${c.ceiling_usd} (${c.pct}%)`);
      process.exit(c.ok ? 0 : 3);
    }
    case 'health': {
      const h = health();
      const out = {};
      for (const n of Object.keys(config().providers)) out[n] = Object.assign({ breaker: breakerState(n, h) }, h.providers[n] || {});
      console.log(has('json') ? JSON.stringify(out, null, 2) : Object.entries(out).map(([n, v]) => `${n.padEnd(10)} ${v.breaker}  calls=${v.calls || 0} fails=${v.failures || 0} streak=${v.consecutive_failures || 0}`).join('\n'));
      break;
    }
    case 'exec': {
      const tf = flag('taskfile');
      const task = tf && typeof tf === 'string' ? JSON.parse(fs.readFileSync(tf, 'utf8')) : {};
      let prompt = '';
      const pf = flag('promptfile');
      if (pf && typeof pf === 'string') prompt = fs.readFileSync(pf, 'utf8');
      else prompt = fs.readFileSync(0, 'utf8');
      // --provider/--model here are a PIN (run exactly this rung), which is how
      // council-driver.sh drives one hop at a time under its own watcher. They are
      // also merged onto the task so a bare `exec --provider x` (no --single) still
      // biases the planner toward that vendor rather than ignoring the flag.
      const pinProvider = typeof flag('provider') === 'string' ? flag('provider') : '';
      const pinModel = typeof flag('model') === 'string' ? flag('model') : '';
      if (pinProvider && !task.provider) task.provider = pinProvider;
      if (pinModel && !task.model) task.model = pinModel;
      const r = await execute(task, prompt, {
        cwd: typeof flag('cwd') === 'string' ? flag('cwd') : process.cwd(),
        rawLog: typeof flag('rawlog') === 'string' ? flag('rawlog') : null,
        timeoutMs: +flag('timeout-ms', 0) || undefined,
        single: has('single'),
        pinProvider, pinModel,
      });
      if (has('json')) console.log(JSON.stringify(r, null, 2));
      else {
        console.log(r.text || '');
        console.error(`[router] ${r.ok ? 'OK' : 'EXHAUSTED'} via ${r.provider || '-'}/${r.model || '-'} cost=$${r.cost || 0} hops=${(r.attempts || []).length}`);
      }
      process.exit(r.ok ? 0 : 4);
    }
    case 'reset-health': {
      writeJSONAtomic(HEALTH_PATH, { providers: {} });
      console.log('health reset');
      break;
    }
    default:
      console.log(`llm-router — multi-platform routing with cross-vendor failover

  plan   --title T [--detail D] [--stakes s] [--model m] [--provider p] [--tier L2] [--json|--shell]
  plan-steps --title T --steps '[{"name":"lookup","kind":"bulk"},{"name":"write","kind":"ui"}]' [--json]
  probe  [--json]                      which providers are usable right now
  exec   --taskfile f [--cwd d] [--rawlog f] [--provider p] [--model m] [--single] [--json] < prompt
  cost   --provider p --model m --in N --out N
  report [--today] [--json]            auto-calculated spend (Q3-B)
  ceiling [--json]                     daily ceiling gate (exit 3 = over)
  health [--json]                      circuit-breaker state
  reset-health`);
  }
}

/**
 * MULTI-STEP ROUTING (DHUKV9E, Vinta 2026-10-26)
 *
 * A task can now define `steps` — a breakdown of its work into sub-tasks, each
 * with its own routing. Instead of using Claude Opus 5 for an entire task when
 * one step is just a lookup, each step is routed to the CHEAPEST model that
 * can handle it. This enforces Frugality Doctrine at the work-unit level.
 *
 * SCHEMA: task.steps = [
 *   { name: "lookup", kind: "bulk", tier: "L1" },        // optional overrides
 *   { name: "analyze", kind: "reasoning", tier: "L3" },
 *   { name: "write", kind: "ui", tier: "L2" }
 * ]
 *
 * If task.steps is present, routeSteps(task, opts) runs route() for each step
 * independently, building a per-step ladder. Each step can use a different model.
 *
 * If task.steps is absent, the current single-ladder behavior is unchanged.
 */
function routeSteps(task, opts) {
  task = task || {};
  opts = opts || {};

  if (!task.steps || !Array.isArray(task.steps) || task.steps.length === 0) {
    // No steps defined — fall back to single-task routing
    const plan = route(task, opts);
    return {
      kind: 'single',
      plan,
      steps: [],
    };
  }

  const steps = [];
  let totalCost = 0;
  for (const step of task.steps) {
    const stepTask = taskForStep(task, step, steps.length);

    // Route this step independently
    const plan = route(stepTask, opts);
    const stepCost = plan.ladder && plan.ladder.length > 0 ? calculateLadderCost(plan.ladder) : 0;
    totalCost += stepCost;

    steps.push({
      name: step.name || `step-${steps.length}`,
      kind: step.kind || (classify(stepTask) || {}).kind || 'general',
      tier: (plan.ladder && plan.ladder.length > 0 ? plan.ladder[0].tier : 'L2'),
      plan,
      cost_estimate: stepCost,
    });
  }

  return {
    kind: 'multi-step',
    steps,
    total_cost_estimate: totalCost,
  };
}

/** Calculate estimated cost of a ladder (sum of first rung). For prediction only. */
function calculateLadderCost(ladder) {
  if (!ladder || ladder.length === 0) return 0;
  const rung = ladder[0];
  if (!rung) return 0;
  const pv = (config().providers || {})[rung.provider];
  const m = pv && (pv.models || {})[rung.model];
  if (!m) return 0;
  // Rough estimate: 1000 tokens in, 1000 out at list price
  return costOf(rung.provider, rung.model, { input_tokens: 1000, output_tokens: 1000 });
}


/** Work units are explicit, bounded subgoals. Parent capability requirements
 * remain unless a reviewed, independent mechanical step declares otherwise.
 * Inherited provider/model pins are execution history, not step requirements.
 */
function taskForStep(task, step, index) {
  const isolated = step.independent === true && step.reviewed === true;
  const result = Object.assign({}, task, {
    title: step.name || `step-${index}`, detail: step.detail || '',
    acceptance: step.acceptance || '', steps: undefined,
    provider: step.provider, model: step.model, kind: step.kind,
    tier: step.tier, escalated: task.escalated || step.escalated,
  });
  if (isolated) {
    result.priority = step.priority === undefined ? 3 : step.priority;
    result.stakes = step.stakes || 'low';
    result.escalated = step.escalated || false;
  } else {
    // A normal child cannot erase the risk/quality of its parent by relabeling.
    if (task.tier && tierIdx(task.tier) > tierIdx(result.tier)) result.tier = task.tier;
    if (step.stakes && tierIdx(tierFromStakes(step.stakes)) > tierIdx(tierFromStakes(task.stakes))) result.stakes = step.stakes;
    if (step.priority !== undefined && (result.priority == null || Number(step.priority) < Number(result.priority))) result.priority = step.priority;
    const parentKind = classify(task).kind;
    const parentAffinity = config().task_affinity[parentKind] || {};
    if (parentAffinity.top_brain || parentAffinity.force_min_tier) result.stakes = 'critical';
  }
  return result;
}

/** Execute explicit work units with a verifier between models. A checkpoint is
 * written only after successful execution AND verification; resuming never
 * repeats verified units. The caller owns storage and must stop any older worker
 * before resuming. No process is killed and no queue status is changed here.
 */
async function executeSteps(task, ctx) {
  ctx = ctx || {};
  if (!Array.isArray(task.steps) || !task.steps.length) throw new Error('steps required');
  if (typeof ctx.verifyStep !== 'function' || typeof ctx.saveCheckpoint !== 'function') {
    throw new Error('verifyStep and durable saveCheckpoint are required');
  }
  const digest = require('crypto').createHash('sha256').update(JSON.stringify(task)).digest('hex');
  const cp = ctx.checkpoint || { version: 1, digest, completed: [], tokens: 0, cost: 0 };
  if (cp.version !== 1 || cp.digest !== digest || !Array.isArray(cp.completed) || cp.completed.length > task.steps.length ||
      !Number.isFinite(cp.tokens) || cp.tokens < 0 || !Number.isFinite(cp.cost) || cp.cost < 0 ||
      cp.completed.some((s, i) => s.index !== i || s.verified !== true || typeof s.output !== 'string' ||
        typeof s.evidence !== 'string' || !s.evidence.trim())) {
    throw new Error('checkpoint does not match verified work plan');
  }
  const completed = cp.completed.slice();
  let tokens = cp.tokens, cost = cp.cost;
  const runStep = ctx.runStep || execute;
  for (let i = completed.length; i < task.steps.length; i++) {
    if ((ctx.maxTokens != null && tokens >= ctx.maxTokens) || (ctx.maxCost != null && cost >= ctx.maxCost)) {
      return { ok: false, checkpointed: true, reason: 'work-unit budget reached', next: i, completed, tokens, cost };
    }
    const step = task.steps[i];
    const nextTask = taskForStep(task, step, i);
    const prompt = [
      'Execute only this work unit. Do not close, cancel, or change the parent task queue status.',
      `Parent goal: ${task.title || ''}`,
      `Unit: ${nextTask.title}\n${nextTask.detail}\nAcceptance: ${nextTask.acceptance}`,
      `Verified handoff artifacts: ${JSON.stringify(completed.map(c => ({ index: c.index, output: c.output })))}`,
    ].join('\n\n');
    // Remaining budget is passed to the worker; hard mid-call enforcement remains
    // the host executor's responsibility. We stop at the next safe boundary.
    const result = await runStep(nextTask, prompt, Object.assign({}, ctx, {
      maxTokens: ctx.maxTokens == null ? undefined : ctx.maxTokens - tokens,
      maxCost: ctx.maxCost == null ? undefined : ctx.maxCost - cost,
      checkpoint: undefined, single: false, pinProvider: undefined, pinModel: undefined,
    }));
    // execute() returns winning-call usage separately from all billed attempts.
    const billed = Array.isArray(result.attempts) && result.attempts.length ? result.attempts : [result];
    const usage = billed.reduce((sum, attempt) => {
      for (const key of ['tokens', 'cost']) {
        const n = Number(attempt[key] || 0);
        if (!Number.isFinite(n) || n < 0) throw new Error('invalid work-unit usage');
        sum[key] += n;
      }
      return sum;
    }, { tokens: 0, cost: 0 });
    tokens += usage.tokens;
    cost += usage.cost;
    if (!result.ok) {
      await ctx.saveCheckpoint({ version: 1, digest, completed: completed.slice(), tokens, cost });
      return { ok: false, reason: 'work unit failed', next: i, result, completed, tokens, cost };
    }
    const verification = await ctx.verifyStep(step, result, i);
    if (!verification || verification.ok !== true || typeof verification.evidence !== 'string' || !verification.evidence.trim()) {
      await ctx.saveCheckpoint({ version: 1, digest, completed: completed.slice(), tokens, cost });
      return { ok: false, reason: 'work unit verification failed', next: i, completed, tokens, cost };
    }
    completed.push({ index: i, verified: true, provider: result.provider, model: result.model,
      output: String(result.text || ''), evidence: verification.evidence });
    // A persistence failure rejects and stops, preventing silent uncheckpointed continuation.
    await ctx.saveCheckpoint({ version: 1, digest, completed: completed.slice(), tokens, cost });
  }
  return { ok: true, completed, tokens, cost };
}

module.exports = {
  taskForStep, executeSteps, wantsTopBrain, calculateLadderCost,
  codexLaneSupports, _resetCodexCatalogCache, MODEL_UNSUPPORTED_RE,
  config, route, routeSteps, classify, execute, runRung, buildInvocation,
  costOf, spendReport, ceilingCheck, recordSpend,
  parseUsage, localInventory, modelInstalled, _resetInventoryCache,
  availability, probeAll, health, breakerState, recordOutcome,
  classifyFailure, parseUsage, resolveModel, pickModel, parseResetAt, walledUntil,
  successRate, recordRoute, historyStats, efficiency, isDemoted, authModesFor,
  askJev, lockoutState, recordExecutionEvidence,
  TIER_ORDER, tierIdx, tierFromStakes,
};

if (require.main === module) main().catch(e => { console.error(String(e.stack || e)); process.exit(1); });
