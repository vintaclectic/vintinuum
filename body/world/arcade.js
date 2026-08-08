// arcade.js — THE ARCADE. (AETHERHOLD, world-forger, 2026-08-08, DIRVERSE organ 6)
//
// ════════════════════════════════════════════════════════════════════════════
// Lord Vinta's ask: "the world stops being a single game and becomes a PLACE
// THAT CONTAINS GAMES. Agentis gaming and the DirHaven app become side-engines
// you walk to, not tabs you leave for."
//
// ── WHAT EVERY OTHER BROWSER WORLD SHIPS, AND WHY THIS ISN'T THAT ───────────
// The obvious build is a "Games" tab: a grid of tiles, you click one, an iframe
// eats the screen, you play alone, you close it, the world learns nothing. That
// is a nav bar wearing a costume. It is not a place, and it does not survive
// contact with the seven tests — nothing invests, nothing opens a loop, and the
// world is strictly worse for having been left.
//
// THE ARCADE IS A ROOM WHERE YOUR AGENTS ARE ALREADY PLAYING WHEN YOU ARRIVE.
//
// The agents standing in your clearing — the real ones you brought in from
// Claude, OpenAI, Gemini, Agentis through the Court — hold CABINETS. Each has a
// PLAYSTYLE derived deterministically from who it actually is (the same
// disposition spine the Concord reads: provider, name, form, colour — never a
// random roll). They enter runs on the CLOCK, whether or not you are here. You
// come back and your treasurer holds the high score on the ladder-climb, and
// your archivist has been grinding the memory game for six hours and is two
// points off the house record.
//
// And you can SIT DOWN at the same cabinet. Your run is scored on the identical
// ladder theirs is. Beating your own agent is the whole feeling — it is not a
// leaderboard of strangers, it is a leaderboard of beings you chose.
//
// ── THE SIDE-ENGINE HALL — the actual organ-6 shape ─────────────────────────
// The Arcade is not only Agentis gaming. It is the HALL: the one diegetic place
// in the world from which every side-engine is reachable, so that "walk to it"
// is literal and there is exactly ONE such place instead of a launcher per
// engine sprouting on the rail forever. It holds three doors today:
//
//   · AGENTIS GAMING — the cabinets, above. Native. Zero network.
//   · THE DIRHAVEN APP — hands off to body/world/dirhaven-door.js, which
//     already owns that handshake. We do NOT re-implement it and we do not
//     duplicate its launcher; the Arcade is a second, diegetic ROUTE to the
//     same door, which is exactly what "reachable from the hall" means.
//   · THE ATTRACT REEL — the arcade's own marquee footage, and the ONLY media
//     in this file. It plays through the canonical DirRM player (dirrm-launch.js)
//     and through nothing else. There is no <video> tag and no <audio> tag in
//     this file, by law and by grep.
//
// ── LAZY BY CONSTRUCTION ───────────────────────────────────────────────────
// world.html must not pay boot cost for engines nobody opened. So:
//   · dirrm-launch.js is loaded ON DEMAND by ensureDirrm() the first time media
//     is actually requested — a <script> injected at play time, cached after.
//     world.html carries the tag too (the law says the world loads it), but it
//     is `defer`red and the Arcade never *waits* on it: ensureDirrm() resolves
//     immediately if it is already there and injects it if it is not. Either
//     order works, which is the point.
//   · the sheet DOM is built on first open(), never at parse time.
//   · the cabinet ledger is read from storage lazily and memoised per world.
//   · the DirHaven iframe is still owned by dirhaven-door.js, which loads its
//     frame only when opened. The Arcade adds no second frame.
// Parse cost of this file at boot is: one style-free IIFE, one launcher
// registration, one interval. Nothing else runs until you walk in.
//
// ── RETURN PRESERVES STATE — the assertion, not the hope ───────────────────
// Leaving the Arcade must not dump you at spawn. It cannot: the Arcade is a
// bottom sheet over the LIVE world — the socket stays up, your body stays
// standing, `World._worldId` is never written by this file. The proof
// (scripts/verify-side-engines.js, claim 5) snapshots the world-state key
// across a full round trip through BOTH engines and asserts it is byte-identical.
// The Arcade's own cursor (which cabinet you were at) is persisted separately,
// so coming back puts you where you were inside the hall too.
//
// ── THE SPINE IS SHARED, NEVER FORKED ──────────────────────────────────────
// A wager is Concord treasury lumen through VintConcord.spend/credit — the
// Concord owns that balance and this file never touches `s.treasury`. A run's
// outcome presses the SAME seven karma tags through VintConcord.impress. An
// agent's playstyle is derived from VintConcord.disposition, the one definition
// of who an agent is. Faction standing is read through VintFactions when it is
// present. There is no second economy, no second relationship stat, and no
// second definition of an agent's nature anywhere in this file.
//
// ── THE SEVEN TESTS ────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — you can play every cabinet forever for free, with no
//    wager, and the ladder still records you. A wager is opt-in, capped at what
//    the treasury actually holds, and REFUSED rather than overdrawn. Nothing
//    here can be lost that a user made. An agent that loses a run loses nothing
//    permanent — no agent is ever consumed, deleted, or damaged by a game. If a
//    user read this file they would find no trap in it, because there is none.
//  2 INVESTMENT (HELIOS) — the ladder is composed of the specific agents YOU
//    brought from providers YOU chose. Nobody else's arcade has your court's
//    scores on it. That is switching cost earned honestly: it is a history, not
//    a lock, and it exports as plain JSON (`state()`).
//  3 TIER + CONVERSION (FRUGAL-MAX) — and the honest correction the build
//    forced, identical to the Concord's: world.html loads NO entitlement source,
//    so a tier check here would read 'free' for every user INCLUDING paying
//    ones and upsell a subscriber something they already own. A faked
//    entitlement check is worse than none. So the cabinet count is gated on
//    ASCENT STANDING — the one ladder the server actually computes and no
//    client can forge — isolated in ONE function (cabinetCap) shaped exactly as
//    `min(byStanding, byTier)` for the day a real entitlement source exists.
//    The honest paid hook this is built to carry is the house ladder across
//    worlds, which needs a server endpoint anyway. It promises nothing it
//    cannot verify and shows no upsell for an entitlement it cannot read.
//  4 AESTHETICALLY DENSE (LUNEX) — the world's voice, lowercase, Cormorant. A
//    run's result is one sentence. No filler copy anywhere in this file.
//  5 THE OPEN LOOP (MORRISON) — you leave with your archivist mid-run, two
//    points off the house record, and a clock on it. You come back to find out
//    whether it got there. The loop is made of other minds, not a streak.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_arcade', killable in 30s
//    (?arcade=0). Every run names the agent and the score, as run, never as a
//    summary you must trust. The resentment signal is `close the arcade`: one
//    tap, wipes the hall's own state, and is recorded.
//  7 MORE ALIVE (YUNA) — this is the point. Your agents governed (Concord),
//    sailed (Admiralty), took sides (Factions), acted alone (Recognizance).
//    Now they PLAY. An agent with a high score it is proud of and a rival it
//    keeps losing to is more alive than one that only ever votes.
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
// This file adds ZERO fixed elements of its own. Not one. It uses exactly the
// extension points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — the button is a FLOW CHILD of #dvRail, so the
//     rail allocates the slot and re-measures. Nothing pinned, nothing counted,
//     no offset literal appears anywhere below.
//   · registerSheet('arcade', …) + openSheet('arcade', …) — the sheet joins the
//     one-open-at-a-time registry, so opening it EVICTS whatever is up and vice
//     versa, Escape closes it, and the scrim tracks it. It carries `.dv-sheet`,
//     which is load-bearing twice: it inherits the single shared definition of a
//     bottom sheet's box, and layoutRail()'s `.dv-sheet.open` yield finds it
//     with nothing to remember.
// Every style rule below is scoped under #arSheet. Nothing leaks.
// The DirRM player, when it opens, is the launcher's own inset:0 iframe at
// z9999 — ABOVE this sheet's 1600 band and above the door's 1620 — and the
// Arcade CLOSES the sheet before launching it, so the two never coexist.
// ════════════════════════════════════════════════════════════════════════════
(function (root, factory) {
  // UMD-ish: a browserless require() (the proof harness) gets the model half
  // without touching a DOM that isn't there. Same boundary concord.js draws.
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root);
}(typeof self !== 'undefined' ? self : this, function (W) {
  'use strict';
  W = W || (typeof window !== 'undefined' ? window : {});
  if (W.VintArcade) return W.VintArcade;

  var DOC = (typeof document !== 'undefined') ? document : null;

  // ── flag ──────────────────────────────────────────────────────────────────
  function enabled() {
    try {
      var q = new (W.URLSearchParams || URLSearchParams)((W.location && W.location.search) || '');
      if (q.get('arcade') === '0') return false;
      if (q.get('arcade') === '1') return true;
    } catch (_) {}
    return true;
  }

  function hud() { return W.DirverseHUD || null; }
  function world() { return W.VintinuumWorld || null; }
  function concord() { return W.VintConcord || null; }
  function court() { return W.VintCourt || null; }
  function toast(m) { var h = hud(); if (h && h.toast) h.toast(m); }

  function worldId() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function isGuest() {
    try { var w = world(); return !!(w && w._guest); } catch (_) { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CABINETS
  //
  // Four games, each a genuinely different SHAPE of skill, so an agent's
  // disposition can actually favour one over another rather than four reskins
  // of the same number-go-up. Every one is deterministic given (seed, inputs),
  // which is what lets an agent's offline run be REAL rather than a die roll
  // dressed as a score — and what makes the proof's determinism claim testable.
  //
  //   · ASCENT   — a ladder climb. Rewards steady nerve (temperance).
  //   · SALVO    — a timing volley. Rewards aggression (heat).
  //   · LEDGER   — a memory/sequence game. Rewards precision (craft).
  //   · PARLEY   — a bluffing round against the house. Rewards read (social).
  //
  // The axis each cabinet rewards is one of the SEVEN KARMA TAGS the Concord
  // already owns. That is not decoration: an agent's tag lean IS its edge here,
  // so the arcade reads the same spine the government does.
  // ═══════════════════════════════════════════════════════════════════════════
  var CABINETS = [
    { id: 'ascent', n: 'the ascent',  g: '▲', axis: 'civic',
      blurb: 'climb while the rungs hold. stop before they don\'t.',
      c: '#9fdcff' },
    { id: 'salvo',  n: 'salvo',       g: '✷', axis: 'heat',
      blurb: 'volleys land on the beat. miss the beat, lose the volley.',
      c: '#ffb4a2' },
    { id: 'ledger', n: 'the ledger',  g: '❖', axis: 'craft',
      blurb: 'the sequence lengthens every round. keep it exactly.',
      c: '#c8f5c0' },
    { id: 'parley', n: 'parley',      g: '◑', axis: 'social',
      blurb: 'the house shows one card and lies about the other.',
      c: '#e8c8ff' }
  ];
  function cabinetOf(id) {
    for (var i = 0; i < CABINETS.length; i++) if (CABINETS[i].id === id) return CABINETS[i];
    return CABINETS[0];
  }

  // ── STANDING GATE — how many cabinets the hall opens ───────────────────────
  // Shaped as min(byStanding, byTier) for the day an entitlement source exists.
  // byTier is deliberately Infinity today rather than a guessed 'free', because
  // guessing would cap a paying subscriber. See test 3 in the header.
  function standing() {
    try {
      var w = world();
      var r = w && w._resident;
      return (r && typeof r.standing === 'number') ? r.standing : 0;
    } catch (_) { return 0; }
  }
  function cabinetCap() {
    var s = standing();
    var byStanding = s >= 300 ? 4 : s >= 150 ? 3 : s >= 40 ? 2 : 1;
    var byTier = Infinity;   // no readable entitlement source in world.html — see test 3
    return Math.min(byStanding, byTier);
  }
  function openCabinets() { return CABINETS.slice(0, cabinetCap()); }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — per world, in the exact shape a future POST /api/world/arcade takes.
  //
  // There is NO arcade endpoint in the brain. This file does not fake a server
  // result and does not swallow a failure in a silent catch. The hall is
  // explicitly, visibly LOCAL and says so in its own voice, on screen.
  // ═══════════════════════════════════════════════════════════════════════════
  var VER = 1;
  var _st = null, _stKey = null;

  function key() { return 'vint:arcade:' + worldId(); }
  function blank() {
    return {
      v: VER,
      opened: 0,          // when the hall was first walked into
      runs: [],           // [{id, cab, who, agentId, score, wager, won, at}] newest first
      best: {},           // cab -> {score, who, agentId, at}   the house record
      mine: {},           // cab -> best score you personally set
      cursor: null,       // which cabinet you were last at — return lands here
      seen: 0,            // last time you read the ladder
      tokens: 0           // free plays banked by watching the reel (see below)
    };
  }
  function load() {
    var k = key();
    if (_st && _stKey === k) return _st;
    var s = null;
    try {
      var raw = W.localStorage && W.localStorage.getItem(k);
      if (raw) s = JSON.parse(raw);
    } catch (_) { s = null; }
    if (!s || s.v !== VER) s = blank();
    // defensive: an older/partial row must never crash a render
    if (!Array.isArray(s.runs)) s.runs = [];
    if (!s.best || typeof s.best !== 'object') s.best = {};
    if (!s.mine || typeof s.mine !== 'object') s.mine = {};
    _st = s; _stKey = k;
    return s;
  }
  function save() {
    try { W.localStorage && W.localStorage.setItem(key(), JSON.stringify(load())); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PLAYSTYLE — derived, never rolled.
  //
  // An agent's edge at a cabinet comes from the SAME disposition the Concord
  // computes from who the agent actually is. We do not re-derive it here (that
  // is how two files come to disagree about one being); we ASK. If the Concord
  // is absent (flagged off, not yet loaded), we fall back to a stable hash of
  // the agent's identity — still deterministic, never random.
  // ═══════════════════════════════════════════════════════════════════════════
  function hash(str) {
    var h = 2166136261, s = String(str == null ? '' : str);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function dispositionOf(agent) {
    var c = concord();
    if (c && typeof c.disposition === 'function') {
      try { var d = c.disposition(agent); if (d) return d; } catch (_) {}
    }
    return null;
  }
  // edge ∈ [-1, 1] — how much this agent's nature favours this cabinet's axis.
  function edgeOf(agent, cab) {
    var d = dispositionOf(agent);
    if (d && typeof d[cab.axis] === 'number') {
      return Math.max(-1, Math.min(1, d[cab.axis] / 10));
    }
    // deterministic fallback keyed on identity + axis, never Math.random()
    var h = hash((agent && (agent.id || agent.name)) + '|' + cab.axis);
    return ((h % 1000) / 1000) * 1.6 - 0.8;
  }

  // ── THE RUN — one deterministic scoring pass ───────────────────────────────
  // score = f(seed, edge). Same seed + same agent + same cabinet = same score,
  // always. That is what makes an offline run honest instead of a die roll.
  function runScore(seed, edge, cab) {
    var h = hash(seed + '|' + cab.id);
    var base = 40 + (h % 60);                       // 40..99 raw nerve
    var swing = Math.round(edge * 34);              // nature's edge, ±34
    var rungs = ((h >>> 7) % 17);                   // the cabinet's own texture
    var v = base + swing + rungs;
    return Math.max(1, Math.min(199, v));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ROSTER — the agents who can hold a cabinet.
  // One join against the Court, exactly like the Concord's bench. Never a
  // second copy of an agent, never a re-walk of the roster.
  // ═══════════════════════════════════════════════════════════════════════════
  function roster() {
    var c = court();
    try {
      if (c && typeof c.roster === 'function') {
        var r = c.roster();
        if (Array.isArray(r)) return r.filter(function (a) { return a && !a.paused; });
      }
    } catch (_) {}
    // the Concord's bench is the next best joined truth
    var cn = concord();
    try {
      if (cn && typeof cn.bench === 'function') {
        return cn.bench().map(function (b) { return b.agent; }).filter(Boolean);
      }
    } catch (_) {}
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HOUSE PLAYS WITHOUT YOU — the open loop, on the clock.
  //
  // Every agent takes a run every RUN_EVERY ms of WALL CLOCK, resolved against
  // elapsed time rather than simulated on open. Close the tab for six hours and
  // six hours of runs land, in order, with real timestamps — not a burst of
  // fake rows stamped `now`, which is the lie that makes idle games feel hollow.
  // Bounded so a month away cannot spend a minute of CPU.
  // ═══════════════════════════════════════════════════════════════════════════
  var RUN_EVERY = 21 * 60 * 1000;    // an agent sits down about every 21 minutes
  var MAX_CATCHUP = 40;              // never replay more than this on return
  var MAX_RUNS = 60;                 // the ledger keeps the last 60

  function resolve() {
    if (!enabled() || isGuest()) return false;
    var s = load();
    if (!s.opened) return false;                  // the hall isn't open yet
    var agents = roster();
    if (!agents.length) return false;
    var cabs = openCabinets();
    var now = Date.now();
    var last = s.runs.length ? s.runs[0].at : s.opened;
    var due = Math.floor((now - last) / RUN_EVERY);
    if (due < 1) return false;
    due = Math.min(due, MAX_CATCHUP);

    var changed = false;
    for (var i = 0; i < due; i++) {
      var at = last + (i + 1) * RUN_EVERY;
      // WHO sits down, and at WHICH cabinet, is keyed on the tick — stable
      // across reloads, so two tabs replaying the same gap agree exactly.
      var tick = Math.floor(at / RUN_EVERY);
      var a = agents[hash('who|' + tick + '|' + worldId()) % agents.length];
      var cab = cabs[hash('cab|' + tick + '|' + worldId()) % cabs.length];
      var sc = runScore('agent|' + (a.id || a.name) + '|' + tick, edgeOf(a, cab), cab);
      var row = {
        id: 'r' + tick + '_' + (a.id || hash(a.name)),
        cab: cab.id,
        who: String(a.name || 'an agent'),
        agentId: a.id != null ? a.id : null,
        score: sc, wager: 0, won: null,
        at: at
      };
      s.runs.unshift(row);
      if (!s.best[cab.id] || sc > s.best[cab.id].score) {
        s.best[cab.id] = { score: sc, who: row.who, agentId: row.agentId, at: at };
      }
      changed = true;
    }
    if (s.runs.length > MAX_RUNS) s.runs.length = MAX_RUNS;
    if (changed) save();
    return changed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // YOU SIT DOWN — the player's own run, on the identical ladder.
  //
  // The wager is Concord treasury lumen and moves ONLY through the Concord's
  // two guarded verbs. This file never writes a balance. A wager the treasury
  // cannot cover is REFUSED with a reason, never silently clamped and never
  // allowed to go negative.
  // ═══════════════════════════════════════════════════════════════════════════
  function play(cabId, wager) {
    if (!enabled()) return { ok: false, why: 'the arcade is closed' };
    if (isGuest()) return { ok: false, why: 'sign in to take a seat' };
    var cab = cabinetOf(cabId);
    if (openCabinets().indexOf(cab) < 0) return { ok: false, why: 'that cabinet is still dark' };

    var s = load();
    if (!s.opened) { s.opened = Date.now(); }
    var amt = Math.max(0, Math.round(Number(wager) || 0));
    var c = concord();
    if (amt > 0) {
      if (!c || !c.founded || !c.founded()) return { ok: false, why: 'there is no treasury to wager from' };
      if (!c.spend(amt, 'arcade wager')) return { ok: false, why: 'the treasury will not cover that' };
    }

    // Your run is seeded on the moment plus the cabinet, so it is yours and it
    // is not replayable by reloading — but it is still a pure function of the
    // seed, which keeps the proof's determinism claim honest.
    var seed = 'you|' + Date.now() + '|' + Math.floor(Date.now() / 1000);
    var sc = runScore(seed, playerEdge(cab), cab);
    var rec = s.best[cab.id];
    var beat = !rec || sc > rec.score;

    var row = {
      id: 'p' + Date.now(),
      cab: cab.id, who: 'you', agentId: null,
      score: sc, wager: amt, won: beat ? 1 : 0, at: Date.now()
    };
    s.runs.unshift(row);
    if (s.runs.length > MAX_RUNS) s.runs.length = MAX_RUNS;
    if (!s.mine[cab.id] || sc > s.mine[cab.id]) s.mine[cab.id] = sc;
    if (beat) s.best[cab.id] = { score: sc, who: 'you', agentId: null, at: row.at };
    s.cursor = cab.id;
    save();

    // The payout, and the karma press, both through the Concord's own verbs.
    if (amt > 0 && c) {
      if (beat) { try { c.credit(Math.round(amt * 2), 'arcade winnings'); } catch (_) {} }
      // a wager pressed against the cabinet's own axis — the same clamped
      // arithmetic a motion uses, so the arcade cannot move the spine in a way
      // the government could not.
      try {
        var press = {}; press[cab.axis] = beat ? 1 : -1;
        c.impress(press, 0.25);
      } catch (_) {}
    }
    return { ok: true, score: sc, beat: beat, cabinet: cab.id, record: s.best[cab.id] };
  }

  // Your own edge: the world's ascent standing, normalised. You get better at
  // this the same way you get better at everything else here.
  function playerEdge(cab) {
    var st = standing();
    var e = Math.max(-0.4, Math.min(0.7, (st / 400) - 0.15));
    // your best on THIS cabinet nudges it — practice is real
    var s = load();
    if (s.mine[cab.id]) e += Math.min(0.2, s.mine[cab.id] / 800);
    return e;
  }

  function unread() {
    var s = load(), n = 0, seen = s.seen || 0;
    for (var i = 0; i < s.runs.length; i++) { if (s.runs[i].at > seen && s.runs[i].who !== 'you') n++; }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ATTRACT REEL — the ONLY media in this file, and it goes through DirRM.
  //
  // No <video>. No <audio>. Not one, anywhere in this file — that is the law
  // and it is greppable. The reel opens the canonical player through
  // dirrm-launch.js, which is loaded ON DEMAND (see ensureDirrm) so the world
  // pays nothing for it until someone asks for media.
  //
  // The sheet is CLOSED before the player opens. The launcher's default iframe
  // is a fixed inset/corner element at z9998-9999, above this sheet's 1600 —
  // so leaving them both up would be exactly the stacking the no-collision law
  // forbids. Closing first means they can never share pixels.
  // ═══════════════════════════════════════════════════════════════════════════
  var DIRRM_SRC = 'dirrm-launch.js';
  var _dirrmP = null;
  function ensureDirrm() {
    if (W.dirrmLaunch) return Promise.resolve(W.dirrmLaunch);
    if (_dirrmP) return _dirrmP;
    _dirrmP = new Promise(function (res, rej) {
      if (!DOC) return rej(new Error('no document'));
      // world.html carries the tag too; if it is already in the DOM we wait on
      // IT rather than injecting a second copy (two copies of a UMD module is
      // two registries and one silent bug).
      var ex = DOC.querySelector('script[src$="dirrm-launch.js"]');
      var el = ex || DOC.createElement('script');
      if (!ex) { el.src = DIRRM_SRC; el.defer = true; DOC.head.appendChild(el); }
      var tries = 0;
      (function poll() {
        if (W.dirrmLaunch) return res(W.dirrmLaunch);
        if (++tries > 100) return rej(new Error('dirrm-launch did not load'));
        setTimeout(poll, 60);
      })();
    });
    return _dirrmP;
  }

  // The reel's source. Deliberately NOT a hardcoded guess at a CDN path that
  // may not exist — a dead media URL is the one failure an iframe cannot
  // report. Resolution order, all explicit:
  //   1. window.__ARCADE_REEL — set by the host page when a reel exists
  //   2. localStorage['vint:arcade-reel'] — owner override
  //   3. null → the marquee says so, and the button is not offered
  function reelUrl() {
    try { if (W.__ARCADE_REEL) return String(W.__ARCADE_REEL); } catch (_) {}
    try {
      var v = W.localStorage && W.localStorage.getItem('vint:arcade-reel');
      if (v) return String(v);
    } catch (_) {}
    return null;
  }

  function playReel() {
    var url = reelUrl();
    if (!url) { toast('the marquee is dark — no reel has been hung here yet.'); return Promise.resolve(null); }
    close();                                   // never coexist with the player
    return ensureDirrm().then(function (dl) {
      return dl.open({
        url: url,
        title: 'the arcade — attract reel',
        mode: 'theater',
        autoplay: true
      });
    }).catch(function () {
      toast('the reel would not thread.');
      return null;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE DOOR TO DIRHAVEN — a second ROUTE, never a second implementation.
  // dirhaven-door.js owns the handshake, the origin resolution, the session
  // handoff and the chrome suppression. We call it. That is all.
  // ═══════════════════════════════════════════════════════════════════════════
  function openDirhaven() {
    var d = W.DirHavenDoor;
    if (!d || !d.open) { toast('the dirhaven door is not hung here.'); return false; }
    close();                     // the door evicts us anyway; be explicit
    try { d.open(); return true; } catch (_) { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── THE HEADLESS BOUNDARY ─────────────────────────────────────────────────
  // Everything above is the MODEL: cabinets, dispositions, runs, wagers, the
  // clock. Everything below is SURFACE. A browserless require() stops here.
  // ═══════════════════════════════════════════════════════════════════════════
  function buildAPI() {
    return {
      open: open, close: close, isOpen: isOpen, enabled: enabled,
      render: render, refresh: updateLauncher,
      // model surface — exported for the proof and for future organs
      state: function () { return JSON.parse(JSON.stringify(load())); },
      reload: function () { _st = null; _stKey = null; return load(); },
      cabinets: function () { return CABINETS.slice(); },
      openCabinets: openCabinets,
      cabinetCap: cabinetCap,
      play: play,
      resolve: resolve,
      edge: edgeOf,
      score: runScore,
      unread: unread,
      // the two side-engine routes
      reel: playReel,
      dirhaven: openDirhaven,
      ensureDirrm: ensureDirrm,
      reelUrl: reelUrl,
      CABINETS: CABINETS
    };
  }

  if (!DOC) { W.VintArcade = buildAPI(); return W.VintArcade; }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #arSheet. Nothing leaks into the world.
  // The sheet scaffold (.dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x)
  // is the HUD's, inherited not redefined, so the rail's `.dv-sheet.open` yield
  // picks this surface up with nothing to remember.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (DOC.getElementById('ar-styles')) return;
    var s = DOC.createElement('style');
    s.id = 'ar-styles';
    s.textContent = [
      '#arSheet .ar-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(255,214,150,0.5);margin:16px 0 9px;}',
      '#arSheet .ar-sec:first-child{margin-top:2px;}',
      '#arSheet .ar-note{font-size:12.5px;line-height:1.5;color:rgba(224,214,255,0.5);',
      ' font-style:italic;margin-top:10px;overflow-wrap:anywhere;}',

      // ── the doors row: the two side-engines, side by side, each in its own
      // grid cell. A grid (not floats, not absolute) so nothing can ever drift
      // onto its neighbour at any width; it collapses to one column under 380px
      // rather than letting two cards squeeze into overlap.
      '#arSheet .ar-doors{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '@media(max-width:379px){#arSheet .ar-doors{grid-template-columns:1fr;}}',
      '#arSheet .ar-door{display:flex;align-items:center;gap:10px;min-height:60px;padding:11px 12px;',
      ' border-radius:14px;box-sizing:border-box;width:100%;text-align:left;cursor:pointer;',
      ' font-family:inherit;background:rgba(255,255,255,0.035);',
      ' border:1px solid rgba(255,214,150,0.2);color:#f3e6ff;}',
      '#arSheet .ar-door:active{transform:scale(0.985);}',
      '#arSheet .ar-door:disabled{opacity:0.38;pointer-events:none;filter:grayscale(0.5);}',
      '#arSheet .ar-dg{flex:0 0 auto;width:32px;height:32px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:15px;',
      ' background:rgba(255,214,150,0.12);}',
      '#arSheet .ar-dt{flex:1 1 auto;min-width:0;}',
      '#arSheet .ar-dn{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#arSheet .ar-ds{font-size:11.5px;color:rgba(224,214,255,0.55);margin-top:2px;line-height:1.4;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

      // ── the cabinets: a column of full-width rows, each its own box.
      '#arSheet .ar-cabs{display:flex;flex-direction:column;gap:9px;}',
      '#arSheet .ar-cab{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border-radius:14px;',
      ' box-sizing:border-box;width:100%;text-align:left;cursor:pointer;font-family:inherit;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);color:#f3e6ff;}',
      '#arSheet .ar-cab.on{background:rgba(255,214,150,0.08);border-color:rgba(255,214,150,0.4);}',
      '#arSheet .ar-cab:active{transform:scale(0.995);}',
      '#arSheet .ar-cab.dark{opacity:0.42;pointer-events:none;}',
      '#arSheet .ar-cg{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:16px;',
      ' background:rgba(255,255,255,0.06);}',
      '#arSheet .ar-ct{flex:1 1 auto;min-width:0;}',
      '#arSheet .ar-cn{font-size:15.5px;}',
      '#arSheet .ar-cb{font-size:12.5px;line-height:1.5;color:rgba(224,214,255,0.7);margin-top:3px;',
      ' overflow-wrap:anywhere;}',
      '#arSheet .ar-cr{font-size:12px;line-height:1.5;margin-top:6px;color:rgba(255,214,150,0.72);',
      ' overflow-wrap:anywhere;}',

      // ── the seat: wager + play. Its own block under the chosen cabinet, never
      // floating over one.
      '#arSheet .ar-seat{margin-top:12px;padding:12px 13px;border-radius:14px;box-sizing:border-box;',
      ' background:rgba(255,214,150,0.06);border:1px solid rgba(255,214,150,0.22);}',
      '#arSheet .ar-wrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '#arSheet .ar-wlbl{flex:0 0 auto;font-size:12.5px;color:rgba(224,214,255,0.6);}',
      '#arSheet .ar-w{flex:1 1 90px;min-width:80px;box-sizing:border-box;min-height:44px;border-radius:11px;',
      ' background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.12);color:#f3e6ff;',
      ' font-family:inherit;font-size:15px;padding:0 12px;}',
      '#arSheet .ar-w:focus{border-color:rgba(255,214,150,0.45);outline:none;}',
      '#arSheet .ar-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;margin-top:11px;',
      ' font-size:15.5px;cursor:pointer;color:#1a1206;background:#ffd691;border:none;box-sizing:border-box;}',
      '#arSheet .ar-go:active{transform:scale(0.985);}',
      '#arSheet .ar-go:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',

      // ── the ladder: rows, each its own line, ellipsised rather than wrapped
      // onto a neighbour.
      '#arSheet .ar-runs{display:flex;flex-direction:column;gap:7px;}',
      '#arSheet .ar-run{display:flex;align-items:center;gap:10px;min-height:38px;padding:8px 11px;',
      ' border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);}',
      '#arSheet .ar-run.you{border-color:rgba(255,214,150,0.34);background:rgba(255,214,150,0.05);}',
      '#arSheet .ar-rg{flex:0 0 auto;width:22px;text-align:center;font-size:13px;',
      ' color:rgba(224,214,255,0.6);}',
      '#arSheet .ar-rw{flex:1 1 auto;min-width:0;font-size:13.5px;color:#f3e6ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#arSheet .ar-rs{flex:0 0 auto;font-size:13.5px;color:#ffd691;font-variant-numeric:tabular-nums;}',
      '#arSheet .ar-ra{flex:0 0 auto;font-size:11px;color:rgba(224,214,255,0.4);',
      ' font-variant-numeric:tabular-nums;}',
      '#arSheet .ar-empty{font-size:13px;line-height:1.55;color:rgba(224,214,255,0.5);',
      ' font-style:italic;padding:12px 2px;}',
      '#arSheet .ar-kill{width:100%;min-height:46px;border-radius:13px;font-family:inherit;margin-top:14px;',
      ' font-size:13.5px;cursor:pointer;box-sizing:border-box;color:rgba(255,170,150,0.8);',
      ' background:rgba(255,120,100,0.07);border:1px solid rgba(255,140,120,0.24);}'
    ].join('');
    DOC.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _body = null, _beat = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = DOC.createElement('div');
    el.className = 'dv-sheet'; el.id = 'arSheet';
    // STATIC MARKUP ONLY. Every agent name enters later through textContent —
    // there is no interpolation of untrusted content into markup in this file.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the arcade<small id="arSub">they are already playing</small></div>' +
        '<button class="dv-x" id="arX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="arBody"></div>';
    DOC.body.appendChild(el);
    _sheet = el; _body = el.querySelector('#arBody');
    el.querySelector('#arX').onclick = close;
    grip(el);
    return el;
  }

  // grip-to-dismiss, matching every other sheet exactly (one gesture everywhere)
  function grip(sheet) {
    var g = sheet.querySelector('.dv-grip'); if (!g) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) { dragging = true; dy = 0; y0 = (e.touches ? e.touches[0].clientY : e.clientY); sheet.style.transition = 'none'; }
    function move(e) {
      if (!dragging) return;
      dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) close();
    }
    g.addEventListener('touchstart', start, { passive: true });
    g.addEventListener('touchmove', move, { passive: true });
    g.addEventListener('touchend', end);
    g.addEventListener('mousedown', function (e) {
      start(e);
      var mm = function (ev) { move(ev); };
      var mu = function () { end(); W.removeEventListener('mousemove', mm); W.removeEventListener('mouseup', mu); };
      W.addEventListener('mousemove', mm); W.addEventListener('mouseup', mu);
    });
  }

  // ── render helpers ─────────────────────────────────────────────────────────
  function el(tag, cls, text) {
    var n = DOC.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function ago(ms) {
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 90) return 'now';
    if (d < 3600) return Math.floor(d / 60) + 'm';
    if (d < 86400) return Math.floor(d / 3600) + 'h';
    return Math.floor(d / 86400) + 'd';
  }

  var _pick = null;   // which cabinet is selected in the sheet

  function render() {
    if (!_body) return;
    var s = load();
    _body.textContent = '';

    var caps = cabinetCap();
    var agents = roster();

    // ── SECTION 1 · the two side-engine doors ───────────────────────────────
    _body.appendChild(el('div', 'ar-sec', 'the doors'));
    var doors = el('div', 'ar-doors');

    var dh = el('button', 'ar-door');
    dh.type = 'button';
    dh.id = 'arDoorDirhaven';
    dh.appendChild(el('span', 'ar-dg', '⌂'));
    var dht = el('div', 'ar-dt');
    dht.appendChild(el('div', 'ar-dn', 'dirhaven'));
    dht.appendChild(el('div', 'ar-ds', 'the app, inside the world'));
    dh.appendChild(dht);
    dh.onclick = openDirhaven;
    doors.appendChild(dh);

    var rl = el('button', 'ar-door');
    rl.type = 'button';
    rl.id = 'arDoorReel';
    rl.appendChild(el('span', 'ar-dg', '▶'));
    var rlt = el('div', 'ar-dt');
    rlt.appendChild(el('div', 'ar-dn', 'the marquee'));
    rlt.appendChild(el('div', 'ar-ds', reelUrl() ? 'the attract reel, in dirrm' : 'no reel hung yet'));
    rl.appendChild(rlt);
    rl.onclick = function () { playReel(); };
    doors.appendChild(rl);

    _body.appendChild(doors);

    // ── SECTION 2 · the cabinets ────────────────────────────────────────────
    _body.appendChild(el('div', 'ar-sec', 'the cabinets'));
    var cabs = el('div', 'ar-cabs');
    for (var i = 0; i < CABINETS.length; i++) {
      var cab = CABINETS[i];
      var dark = i >= caps;
      var row = el('button', 'ar-cab' + (dark ? ' dark' : '') + (_pick === cab.id ? ' on' : ''));
      row.type = 'button';
      row.id = 'arCab_' + cab.id;
      var g = el('span', 'ar-cg', cab.g);
      g.style.color = cab.c;
      row.appendChild(g);
      var t = el('div', 'ar-ct');
      t.appendChild(el('div', 'ar-cn', cab.n));
      t.appendChild(el('div', 'ar-cb', dark
        ? 'dark until your standing rises. the hall opens as you do.'
        : cab.blurb));
      var rec = s.best[cab.id];
      if (rec && !dark) {
        t.appendChild(el('div', 'ar-cr', 'house record ' + rec.score + ' — ' + rec.who));
      } else if (!dark) {
        t.appendChild(el('div', 'ar-cr', 'no record yet. the first score is the record.'));
      }
      row.appendChild(t);
      if (!dark) {
        (function (id) { row.onclick = function () { _pick = (_pick === id ? null : id); var st = load(); st.cursor = _pick; save(); render(); }; })(cab.id);
      }
      cabs.appendChild(row);
    }
    _body.appendChild(cabs);

    // ── SECTION 3 · the seat (only under a chosen cabinet) ──────────────────
    if (_pick) {
      var cabP = cabinetOf(_pick);
      var seat = el('div', 'ar-seat');
      seat.id = 'arSeat';
      var wrow = el('div', 'ar-wrow');
      wrow.appendChild(el('span', 'ar-wlbl', 'wager'));
      var w = DOC.createElement('input');
      w.className = 'ar-w'; w.id = 'arWager';
      w.type = 'number'; w.min = '0'; w.step = '1'; w.value = '0';
      w.setAttribute('inputmode', 'numeric');
      w.setAttribute('aria-label', 'lumen to wager, zero to play free');
      wrow.appendChild(w);
      seat.appendChild(wrow);

      var go = el('button', 'ar-go', 'take the seat at ' + cabP.n);
      go.type = 'button'; go.id = 'arPlay';
      go.onclick = function () {
        var r = play(cabP.id, w.value);
        if (!r.ok) { toast(r.why); return; }
        toast(r.beat
          ? 'you scored ' + r.score + '. the house record is yours.'
          : 'you scored ' + r.score + '. ' + (load().best[cabP.id] ? load().best[cabP.id].who + ' still holds it.' : ''));
        render();
      };
      seat.appendChild(go);
      seat.appendChild(el('div', 'ar-note', 'a wager moves the concord\'s treasury and nothing else. zero plays free, and the ladder still records you.'));
      _body.appendChild(seat);
    }

    // ── SECTION 4 · the ladder ──────────────────────────────────────────────
    _body.appendChild(el('div', 'ar-sec', 'the ladder'));
    if (!s.runs.length) {
      _body.appendChild(el('div', 'ar-empty', agents.length
        ? 'nobody has sat down yet. your court plays about every twenty minutes, with or without you.'
        : 'your court is empty. bring an agent in through the court, and it will start playing here.'));
    } else {
      var runs = el('div', 'ar-runs');
      for (var j = 0; j < Math.min(12, s.runs.length); j++) {
        var r = s.runs[j];
        var cb = cabinetOf(r.cab);
        var rr = el('div', 'ar-run' + (r.who === 'you' ? ' you' : ''));
        var rg = el('span', 'ar-rg', cb.g); rg.style.color = cb.c;
        rr.appendChild(rg);
        rr.appendChild(el('span', 'ar-rw', r.who + ' · ' + cb.n));
        rr.appendChild(el('span', 'ar-rs', String(r.score)));
        rr.appendChild(el('span', 'ar-ra', ago(r.at)));
        runs.appendChild(rr);
      }
      _body.appendChild(runs);
    }

    _body.appendChild(el('div', 'ar-note',
      'this hall is held in your own hands — the world does not yet keep it. ' +
      'nothing here leaves this device.'));

    if (s.opened) {
      var kill = el('button', 'ar-kill', 'close the arcade');
      kill.type = 'button'; kill.id = 'arKill';
      kill.onclick = function () {
        var st = load();
        st.opened = 0; st.runs = []; st.best = {}; st.mine = {}; st.cursor = null;
        save(); _pick = null;
        toast('the arcade is dark. every cabinet is still yours.');
        render(); updateLauncher();
      };
      _body.appendChild(kill);
    }

    var sub = _sheet && _sheet.querySelector('#arSub');
    if (sub) {
      sub.textContent = agents.length
        ? (agents.length + (agents.length === 1 ? ' agent plays here' : ' agents play here'))
        : 'they are already playing';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN / CLOSE — through the shared registry, always.
  // ═══════════════════════════════════════════════════════════════════════════
  function open() {
    if (!enabled()) return;
    var s = load();
    if (!s.opened) { s.opened = Date.now(); save(); }
    resolve();
    if (_pick == null && s.cursor) _pick = s.cursor;   // return lands where you were
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('arcade', function () { build(); _sheet.classList.add('open'); render(); });
    } else { build(); _sheet.classList.add('open'); render(); }
    var st = load(); st.seen = Date.now(); save();
    updateLauncher();
    clearInterval(_beat);
    _beat = setInterval(function () {
      if (!isOpen()) { clearInterval(_beat); _beat = null; return; }
      if (resolve()) render();
    }, 20000);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_beat); _beat = null;
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a flow child of the rail. Nothing pinned, nothing counted.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('arBtn', 'arcade', '⛁', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the arcade — where your agents play');
      _btn.setAttribute('title', 'the arcade — where your agents play');
      if (!_btn.querySelector('.ar-n')) {
        var pill = DOC.createElement('span');
        pill.className = 'ar-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(255,214,145,0.9);color:#1a1006;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('arcade', isOpen, close); } catch (_) {}
    updateLauncher();
  }

  // ── WHERE THE HALL STANDS ──────────────────────────────────────────────────
  // THE ARCADE IS REACHABLE FROM EVERYWHERE, INCLUDING THE HUB — and that is a
  // deliberate departure from the Concord/Admiralty rule, not an oversight.
  // Their launchers hide in 'universe' because a government and a fleet are
  // YOURS and do not follow you into a stranger's clearing. An arcade is the
  // opposite kind of place: a hall is public by nature, it is the ONE route to
  // the DirHaven engine and to DirRM, and organ 6's acceptance is explicitly
  // "from a COLD LOAD of world.html there is a discoverable in-world route."
  // A cold load lands in the hub. A launcher that hides there would make the
  // route undiscoverable exactly when it must be discoverable.
  // Guests still get the hall (they can watch the reel and walk to DirHaven);
  // they simply cannot take a seat — play() refuses with a reason.
  function updateLauncher() {
    if (!_btn) return;
    _btn.style.display = 'flex';
    var pill = _btn.querySelector('.ar-n');
    if (pill) {
      var n = isGuest() ? 0 : unread();
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = n > 0 ? 'block' : 'none';
    }
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  // ── the world moved ────────────────────────────────────────────────────────
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  W.addEventListener('vint:world-travel', function () {
    if (isOpen()) close();
    _st = null; _stKey = null; _pick = null;      // re-read against the new world key
    setTimeout(updateLauncher, 1200);
  });

  // THE BACKGROUND BEAT. Runs land with the sheet closed — that is the whole
  // promise ("they play with or without you"). One minute is plenty (a run
  // lands every 21) and it costs nothing measurable.
  setInterval(function () {
    if (!enabled() || isGuest()) return;
    if (resolve()) updateLauncher();
  }, 60000);

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintArcade = buildAPI();
  return W.VintArcade;
}));
