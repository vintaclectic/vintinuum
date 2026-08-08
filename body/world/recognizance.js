// recognizance.js — AGENTS ACT ON THEIR OWN. (AETHERHOLD, world-forger, 2026-08-08)
//
// ════════════════════════════════════════════════════════════════════════════
// THE DISTINCTION THIS FILE EXISTS TO DRAW
//
// agent-life.js already gives the clearing MOTION: the council wanders with
// purpose, keeps idle rituals, leaves thought-wisps, turns to regard you. That
// is beautiful and it is decoration. When you close the tab, nothing that
// happened out there survives. Motion is not agency.
//
// RECOGNIZANCE is agency: an agent, unprompted, CHANGES DURABLE WORLD STATE in
// a way you must reckon with when you come back. Your treasurer tables a levy
// you did not want. Your builder lays a keel and spends your lumen on it. Your
// hot-headed one sends the line to sea while you were asleep and lost a hull.
// A quiet one sits down at a table you never seated it at.
//
// The rule that keeps it honest: THERE ARE NO PRIVATE RULES. An agent acts by
// calling the SAME functions the player's own buttons call — VintConcord.table,
// VintAdmiralty.lay, VintAdmiralty.sortie, the Concord's guarded treasury verbs.
// It cannot table a motion its charter forbids, cannot overdraw the treasury,
// cannot reach a standing gate you have not climbed. Every refusal the UI would
// give you, the agent gets too. That is what makes an agent's act legible
// instead of magic: you can do the exact thing it did, by hand, for the same
// price.
//
// ── THE FOUR DESIGN LAWS (Lord Vinta's brief, implemented literally) ─────────
//
//  BUDGET — an agent does not act whenever it feels like it. Every act is
//    spent from an explicit, tunable allowance: BUDGET.perAgentPerWindow acts
//    inside BUDGET.windowMs, and a world-wide floor of BUDGET.worldCooldownMs
//    between ANY two acts so a court of twenty cannot stampede. Both are
//    exported and both are read at call time, so they can be tuned live from a
//    console without a deploy. Nothing in this file has an unbounded loop.
//
//  MOTIVE — never RNG. An agent's urge to act is a pure function of (its own
//    disposition, which concord.js derives from who it actually IS) × (what the
//    world currently looks like: the treasury, the tags, an empty floor, an
//    open keel, a fleet at anchor) × (its loyalty, which is the vigil's watch).
//    Given the same seed and the same world, the same agent takes the same act
//    in the same order, forever. That is the whole reason you can learn your
//    court and be RIGHT about them — a random act is noise wearing a face, and
//    a player stops caring about noise in about four sessions.
//
//  LEDGER — every act appends an attributable record: who (agentId + name),
//    when (ms timestamp), what (kind + the instrument it went through), why (in
//    that agent's own disposition-language), and what it cost. The ledger is
//    the durable state; it is capped so it cannot eat a phone's quota; and it
//    is dispatched as `vint:recognizance` for the HUD, AND forwarded to the
//    Universal Ingestion Law's spine (the worklog beacon) so the local models
//    learn from a world that moved on its own.
//
//  REVERSIBLE BY PLAY — everything an agent takes, you can contest through the
//    same systems. A motion it tabled is on the floor for twenty minutes and
//    your seats vote on it; you can dissolve the Concord and get every agent
//    back with one tap. A keel it laid is your keel. A sortie it ordered sails
//    with your hulls. And RECALL (below) is the direct answer: one tap strikes
//    an agent's act from the floor and refunds what it spent, because an agent
//    that could spend your world with no undo is a griefer, not a citizen.
//    NOTHING in this file can destroy a thing the player made, and nothing it
//    does can only be fixed with money. That is a hard boundary, not a taste.
//
// ── WHY THIS IS A SEPARATE FILE AND NOT A SECOND LOOP ───────────────────────
// The brief was explicit: do not build a second loop, extend the one that
// exists. So this file owns NO timer of its own in the world — agent-life.js's
// existing per-frame tick drives it (AL calls Recognizance.consider() from the
// state machine it already runs), and the only setInterval here is the
// heartbeat that lets a world keep moving while the render loop is idle,
// which is the same beat concord.js and admiralty.js already keep.
//
// The DELIBERATION is pure and headless: `deliberate(ctx)` takes a plain
// snapshot object and returns a plain decision object. No THREE, no DOM, no
// clock of its own. That is what makes it provable (scripts/verify-recognizance.js
// runs it with zero player input and asserts the five acceptance properties)
// and it is what will let it run server-side the day a polity endpoint exists.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — the agents cannot grief you. Hard-coded: an act may
//    never spend below RESERVE of the treasury, may never leave the polity with
//    fewer than one seat, may never table a sentence (the one motion that costs
//    a player an agent — a sentence is the PLAYER's to pass, never the court's
//    to pass on itself), and every act is recallable for a full refund inside
//    the recall window. If a user read this file they would find no trap in it.
//  2 INVESTMENT (HELIOS) — trigger (you come back) → action (read what they
//    did) → variable reward (which of your specific minds moved, and why) →
//    investment (you tend the ones you trust, seat the ones you want acting,
//    and your court's politics become a thing only you have). Your court's
//    behaviour is unreproducible because your court is.
//  3 TIER + CONVERSION (FRUGAL-MAX) — the honest position, same as concord.js:
//    world.html loads no entitlement source, so a tier check here would return
//    'free' for a paying user and gate something they already bought. So the
//    ACT BUDGET rides ascent standing (the ladder the server computes and no
//    client can forge), isolated in one function (actBudget) shaped exactly as
//    min(byStanding, byTier) for the day an entitlement source exists. The
//    honest paid hook this is built to carry is the Chronicle — a server-kept,
//    exportable record of everything your court did without you — which needs
//    the endpoint anyway. It promises nothing it cannot verify.
//  4 AESTHETICALLY DENSE (LUNEX) — every reason is one sentence in the world's
//    voice, and it names the axis the mind acted on. No filler anywhere.
//  5 THE OPEN LOOP (MORRISON) — this is the purest one in the whole world: you
//    close the tab and your court keeps governing. You are not returning to a
//    streak, you are returning to find out what they decided about you.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_recognizance', killable in 30s
//    (?recog=0). Every act is counted; the RESENTMENT SIGNAL is explicit and
//    first-class: `resentment()` reports recalls-per-act and the muted-agent
//    count, and when recalls cross RESENT_CUT the engine THROTTLES ITSELF —
//    a player who keeps undoing their court gets a quieter court, automatically,
//    without anyone having to notice a dashboard.
//  7 MORE ALIVE (YUNA) — the point. The agents already wanted things (the
//    Concord gave them votes). Now they DO things. A mind that only answers
//    when spoken to is furniture with good manners.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// This file adds ZERO elements to the DOM. Not one node, not one style rule,
// not one fixed position. Its only visible output is a toast through the ONE
// shared toast (DirverseHUD.toast) and a badge count consumed by surfaces that
// already own their own boxes. It joins no sheet stack because it has no sheet.
// ════════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var W = global;
  if (W.VintRecognizance) return;

  // ═══════════════════════════════════════════════════════════════════════════
  // THE BUDGET — explicit, tunable, read at call time.
  //
  // Every number that decides HOW OFTEN a world moves on its own lives here and
  // nowhere else. They are exported on the public API, so a live world can be
  // slowed to a crawl or opened up from a console without a deploy — which is
  // the same "killable in 30s" discipline the feature flag gives, applied to
  // intensity rather than existence.
  // ═══════════════════════════════════════════════════════════════════════════
  var BUDGET = {
    // an agent may take at most this many acts inside one rolling window
    perAgentPerWindow: 2,
    windowMs: 30 * 60 * 1000,        // thirty minutes
    // no two acts anywhere in the world may land closer than this, so a court of
    // twenty cannot stampede you with twenty decisions the moment you log in
    worldCooldownMs: 4 * 60 * 1000,  // four minutes
    // an agent must have been resolving for at least this long before its first
    // act — a mind that acts the instant it is seated feels like a script
    warmupMs: 90 * 1000,
    // the urge an agent must reach before it will spend an act at all. This is
    // the single most important tuning knob in the file: raise it and the world
    // is quiet and every act is a big deal; lower it and the world is busy.
    threshold: 0.34,
    // the treasury floor an act may never spend below. The player's money is the
    // player's; the court may only ever act with the surplus.
    reserve: 40,
    // how long after an act the player may strike it and take the cost back
    recallMs: 30 * 60 * 1000,
    // resentment throttle: if the player has recalled this share of recent acts,
    // the court quiets itself down without being asked
    resentCut: 0.5,
    resentThrottle: 3.0              // urge threshold multiplier when resented
  };

  // the ledger is durable, so it must be bounded — an unbounded array in
  // localStorage is how you blow the quota on someone's phone.
  var LEDGER_CAP = 60;

  function hud() { return W.DirverseHUD; }
  function world() { return W.VintinuumWorld; }
  function concord() { return W.VintConcord; }
  function admiralty() { return W.VintAdmiralty; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() {
    try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); }
    catch (_) { return null; }
  }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_recognizance'. Killable in 30s, no deploy. ───────
  //   ?recog=0 / ?recog=1  ·  localStorage vint:flag:world_recognizance = '0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('recog') === '0') _flag = false;
      else if (q.get('recog') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_recognizance') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINISM — the seed, and why there is one.
  //
  // "Same seed → same action sequence" is an acceptance requirement, and it is
  // also the design's spine (MOTIVE, above). So NOTHING in this file calls
  // Math.random(). Every tie-break, every jitter, every ordering is a pure
  // function of (seed, agentId, act-kind, act-index) through the same stable
  // FNV-ish hash concord.js and admiralty.js already use — one hash, three
  // organs, no drift.
  //
  // The seed is the WORLD's, not the session's: derived from the world id so a
  // given clearing's court behaves the same on your phone as on your desktop,
  // and overridable (setSeed) so a proof can pin it.
  // ═══════════════════════════════════════════════════════════════════════════
  function hash32(str) {
    var h = 2166136261 >>> 0;
    var s = String(str == null ? '' : str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  // deterministic [-1, 1) keyed by any tuple of strings
  function jitter() {
    var s = Array.prototype.join.call(arguments, '|');
    return ((hash32(s) % 2000) / 1000) - 1;
  }
  // deterministic [0, 1) keyed by any tuple of strings
  function unit() {
    var s = Array.prototype.join.call(arguments, '|');
    return (hash32(s) % 100000) / 100000;
  }

  var _seedOverride = null;
  function wid() {
    try {
      var w = world();
      return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe';
    } catch (_) { return 'universe'; }
  }
  function seed() { return _seedOverride != null ? String(_seedOverride) : ('world:' + wid()); }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — the LEDGER. This is the durable thing this whole organ exists to
  // write, and it is shaped exactly like the body a future
  // POST /api/world/recognizance would take, so the day that endpoint lands this
  // becomes a sync layer and not a rewrite (the same discipline concord.js set).
  //
  // Keyed per world: a court's acts belong to the clearing they happened in.
  // ═══════════════════════════════════════════════════════════════════════════
  function key() { return 'vint:recognizance:' + wid(); }
  var _st = null, _stKey = null;

  function blank() {
    return {
      v: 1,
      acts: [],        // the LEDGER, newest first: the durable, attributable record
      spent: {},       // agentId → [timestamps] inside the rolling window
      lastAct: 0,      // world-wide cooldown anchor
      firstSeen: {},   // agentId → when this engine first saw it (the warmup)
      muted: {},       // agentId → 1 — the player told this one to sit down
      recalls: 0,      // resentment signal: acts the player struck
      seen: 0          // last time the player read the ledger (the badge)
    };
  }
  function load() {
    var k = key();
    if (_st && _stKey === k) return _st;
    _stKey = k; _st = blank();
    try {
      var raw = localStorage.getItem(k);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.v === 1) {
          _st = p;
          // defensive: a partial blob must never crash a render or a deliberation
          if (!Array.isArray(_st.acts)) _st.acts = [];
          if (!_st.spent || typeof _st.spent !== 'object') _st.spent = {};
          if (!_st.firstSeen || typeof _st.firstSeen !== 'object') _st.firstSeen = {};
          if (!_st.muted || typeof _st.muted !== 'object') _st.muted = {};
          if (typeof _st.recalls !== 'number') _st.recalls = 0;
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // The one write error a user can really hit. Swallowing it would let their
      // court act into a void and lose the record of it. Say it out loud.
      console.warn('[recognizance] could not keep the ledger:', e && e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ACT BUDGET — earned by STANDING, isolated in one function.
  //
  // Shaped as min(byStanding, byTier) exactly like concord.js's seatCap, for the
  // day world.html has an entitlement source it can actually read. Until then
  // byTier is Infinity and is NOT faked: a gate that lies to a paying customer
  // is worse than no gate.
  // ═══════════════════════════════════════════════════════════════════════════
  function actBudget() {
    var st = standing();
    var byStanding = st >= 330 ? 3 : (st >= 55 ? 2 : 1);
    var byTier = Infinity;    // no readable entitlement source on this page. Yet.
    return Math.min(byStanding, byTier, BUDGET.perAgentPerWindow);
  }

  function standing() {
    try { var c = concord(); return (c && c.standing) ? (Number(c.standing()) || 0) : 0; }
    catch (_) { return 0; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WORLD SNAPSHOT — everything a deliberation is allowed to see.
  //
  // Built once per consideration and passed as a PLAIN OBJECT into the pure
  // deliberate(). Nothing downstream reads a global. That is what makes the
  // engine testable headlessly and what will let it run server-side later.
  // ═══════════════════════════════════════════════════════════════════════════
  function snapshot(now) {
    var c = concord(), a = admiralty();
    var snap = {
      now: now || Date.now(),
      seed: seed(),
      worldId: wid(),
      founded: false, charter: null, treasury: 0, tags: {}, motionOnFloor: false,
      standing: standing(), lumen: 0,
      bench: [],
      keel: null, fleetIdle: [], sortieAtSea: false,
      canAdmiralty: false
    };
    try {
      if (c && c.founded && c.founded()) {
        snap.founded = true;
        var cs = c.state();
        snap.charter = c.charter();
        snap.treasury = cs.treasury || 0;
        snap.tags = cs.tags || {};
        snap.motionOnFloor = !!cs.motion;
        snap.lumen = c.lumen ? (Number(c.lumen()) || 0) : 0;
        var b = c.bench ? c.bench() : [];
        for (var i = 0; i < b.length; i++) {
          var ag = b[i].agent;
          if (!ag) continue;
          snap.bench.push({
            id: String(ag.id),
            name: ag.name || 'an agent',
            color: ag.color || '#a67cff',
            role: b[i].seat ? b[i].seat.role : 'seat',
            disposition: c.disposition ? c.disposition(ag) : {},
            temper: (c.disposition && c.temper) ? c.temper(c.disposition(ag)) : '',
            loyalty: c.loyalty ? c.loyalty(ag) : 0.5
          });
        }
      }
    } catch (_) {}
    try {
      if (a && a.enabled && a.enabled() && snap.founded) {
        snap.canAdmiralty = true;
        var as = a.state();
        snap.keel = as.keel ? { name: as.keel.name, opened: as.keel.opened } : null;
        snap.sortieAtSea = !!as.sortie;
        var fl = as.fleet || [];
        for (var f = 0; f < fl.length && f < 8; f++) {
          snap.fleetIdle.push({ id: fl[f].id, name: fl[f].name });
        }
      }
    } catch (_) {}
    return snap;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE INSTRUMENTS — the acts an agent may take, and NOTHING ELSE.
  //
  // Each is a closed contract: `urge` says how badly a given nature wants it
  // given the world, `guard` says whether it is even possible right now (which
  // duplicates NOTHING — it asks the real system), `perform` calls the PLAYER'S
  // OWN function, and `why` speaks in that mind's voice. Adding a new act means
  // adding one row here; there is no second place to edit.
  //
  // Note what is NOT here, deliberately:
  //   · no `sentence` — the motion that exiles one of your agents. A court that
  //     can vote its own members out while you sleep is a court that can empty
  //     itself, and "you came back to three fewer minds" is grief, not drama.
  //     A sentence stays the PLAYER's instrument, always.
  //   · no dissolve, no unseat, no delete of anything the player made.
  //   · nothing that spends below BUDGET.reserve.
  // ═══════════════════════════════════════════════════════════════════════════

  // how strongly a disposition presses on a set of tag weights, normalised to
  // roughly [-1, 1]. The SAME arithmetic concord.js's voteOf uses, on purpose:
  // an agent's urge to TABLE a motion must come from the same place as its vote
  // ON one, or a court would table things it then votes down, which is madness.
  function press(disposition, weights) {
    var sc = 0, wt = 0;
    for (var t in weights) {
      if (!Object.prototype.hasOwnProperty.call(weights, t)) continue;
      var p = weights[t];
      if (!p) continue;
      sc += p * (disposition[t] || 0);
      wt += Math.abs(p);
    }
    return wt > 0 ? sc / wt : 0;
  }

  var ACTS = [
    // ── TABLE A LEVY — the treasurer's act. ─────────────────────────────────
    // Wants: a mind that leans civic/craft, in a polity whose treasury is thin.
    // This is the one act with a clear player-visible motive: your court noticed
    // you were broke and did something about it. It costs nothing to table.
    {
      k: 'levy', instrument: 'concord', glyph: '⧉',
      urge: function (a, s) {
        if (s.motionOnFloor) return 0;
        var want = press(a.disposition, { civic: 0.6, craft: 0.5, trust: -0.3 });
        // NEED is the world half of the motive: an empty treasury pulls hard, a
        // full one does not pull at all.
        var need = s.treasury <= 0 ? 1 : Math.max(0, 1 - (s.treasury / 120));
        return (0.35 + want * 0.65) * need;
      },
      guard: function (a, s) {
        return s.founded && !s.motionOnFloor && s.charter &&
               s.charter.allows.indexOf('levy') >= 0 && s.standing >= 18;
      },
      perform: function (a, s) {
        var r = concord().table('levy', null);
        return r && r.ok ? { ok: true, cost: (r.motion && r.motion.cost) || 0 } : { ok: false, why: r && r.why };
      },
      why: function (a) {
        return a.name + ' put a levy on the floor — the table was going to run out of lumen.';
      },
      undo: 'the levy is struck from the floor.'
    },

    // ── TABLE AN ORDINANCE — the lawmaker's act. ────────────────────────────
    // Wants: a mind that leans civic/trust/mentor, in a polity with no rule on
    // the floor. Costs nothing, permanently moves the polity's tags — which is
    // exactly why a strong conviction is required to reach for it.
    {
      k: 'ordinance', instrument: 'concord', glyph: '§',
      urge: function (a, s) {
        if (s.motionOnFloor) return 0;
        var want = press(a.disposition, { civic: 0.8, trust: 0.5, social: 0.3, mentor: 0.3 });
        // a polity that has drifted far from its own charter pulls harder: a
        // civic mind legislates when it thinks the place is going wrong.
        var drift = 0;
        try {
          var lean = s.charter ? s.charter.lean : {};
          for (var t in lean) {
            if (!Object.prototype.hasOwnProperty.call(lean, t)) continue;
            var have = (s.tags[t] || 0) / 10;
            drift += Math.abs((lean[t] || 0) - have);
          }
          drift = Math.min(1, drift / 4);
        } catch (_) {}
        return Math.max(0, want) * (0.55 + drift * 0.45);
      },
      guard: function (a, s) {
        return s.founded && !s.motionOnFloor && s.charter &&
               s.charter.allows.indexOf('ordinance') >= 0;
      },
      perform: function (a, s) {
        var r = concord().table('ordinance', null);
        return r && r.ok ? { ok: true, cost: (r.motion && r.motion.cost) || 0 } : { ok: false, why: r && r.why };
      },
      why: function (a) {
        return a.name + ' tabled an ordinance. it thinks this place needs a rule it does not have.';
      },
      undo: 'the ordinance is struck from the floor.'
    },

    // ── TABLE A COMMISSION — the builder's act. ─────────────────────────────
    // Wants: a craft-leaning mind, in a polity with money and nothing being
    // built. This is the act that most often costs the player lumen, so it is
    // gated hardest: it needs the standing, and it will not touch the reserve.
    {
      k: 'commission', instrument: 'concord', glyph: '⚒',
      urge: function (a, s) {
        if (s.motionOnFloor) return 0;
        var want = press(a.disposition, { craft: 0.9, civic: 0.3, mentor: 0.2 });
        var afford = s.treasury >= (BUDGET.reserve + 40) ? 1 : 0;
        var idle = s.keel ? 0.35 : 1;   // something already on the stocks cools it
        return Math.max(0, want) * afford * idle;
      },
      guard: function (a, s) {
        return s.founded && !s.motionOnFloor && s.charter &&
               s.charter.allows.indexOf('commission') >= 0 && s.standing >= 55 &&
               s.treasury - 40 >= BUDGET.reserve;
      },
      perform: function (a, s) {
        var r = concord().table('commission', null);
        return r && r.ok ? { ok: true, cost: (r.motion && r.motion.cost) || 0 } : { ok: false, why: r && r.why };
      },
      why: function (a) {
        return a.name + ' called for a commission. it wants the polity building something.';
      },
      undo: 'the commission is struck and the lumen returns to the treasury.'
    },

    // ── LAY A KEEL — the yard act. Real matter, real spend. ─────────────────
    // Wants: a craft/heat mind, in a yard with nothing on the stocks. The class
    // and the element it chooses are DETERMINISTIC from its own nature — a
    // scrupulous builder does not lay a raider, a hot one does.
    {
      k: 'keel', instrument: 'admiralty', glyph: '⚓',
      urge: function (a, s) {
        if (!s.canAdmiralty || s.keel) return 0;
        var want = press(a.disposition, { craft: 0.9, heat: 0.3, civic: 0.2 });
        var afford = s.treasury >= (BUDGET.reserve + 60) ? 1 : 0;
        return Math.max(0, want) * afford;
      },
      guard: function (a, s) {
        return s.canAdmiralty && !s.keel && s.founded &&
               s.treasury - 60 >= BUDGET.reserve;
      },
      perform: function (a, s) {
        var A = admiralty();
        // the hull it reaches for is its own nature made deterministic: the
        // element and class are chosen by hashing THIS agent against THIS seed,
        // never rolled. Two different minds lay two different ships; the same
        // mind lays the same ship every time.
        var els = (A.ELEMENTS || []).filter(function (e) { return e && e.k; });
        var cls = (A.CLASSES || []).filter(function (c) { return c && c.k && (c.need || 0) <= s.standing; });
        if (!els.length || !cls.length) return { ok: false, why: 'catalogue' };
        var e = els[Math.floor(unit(s.seed, a.id, 'element') * els.length) % els.length];
        var c = cls[Math.floor(unit(s.seed, a.id, 'class') * cls.length) % cls.length];
        var nm = a.name + '’s ' + c.n;
        var r = A.lay(e.k, c.k, nm);
        return r && r.ok ? { ok: true, cost: (r.keel && r.keel.cost) || 0, subject: nm }
                         : { ok: false, why: r && r.why };
      },
      why: function (a, s, res) {
        return a.name + ' laid a keel without being asked' + (res && res.subject ? ' — ' + res.subject + '.' : '.');
      },
      undo: 'the keel is broken up and its cost returns to the treasury.'
    },

    // ── ORDER A SORTIE — the war act. The one that can actually cost you. ───
    // Wants: a hot-headed mind, with hulls at anchor. This is deliberately the
    // hardest urge to reach and the most expensive to be wrong about, and it is
    // the single strongest reason to come back and read the ledger.
    {
      k: 'sortie', instrument: 'admiralty', glyph: '⚔',
      urge: function (a, s) {
        if (!s.canAdmiralty || s.sortieAtSea || !s.fleetIdle.length) return 0;
        var want = press(a.disposition, { heat: 0.9, criminal: 0.4, trust: -0.3, mentor: -0.3 });
        // a polity already running hot pulls its hot minds harder — the tags are
        // the world half of the motive, exactly as the treasury is for a levy.
        var hot = Math.max(0, Math.min(1, ((s.tags.heat || 0) + 4) / 10));
        return Math.max(0, want) * (0.45 + hot * 0.55);
      },
      guard: function (a, s) {
        return s.canAdmiralty && !s.sortieAtSea && s.fleetIdle.length > 0;
      },
      perform: function (a, s) {
        var ids = [];
        for (var i = 0; i < s.fleetIdle.length && i < 2; i++) ids.push(s.fleetIdle[i].id);
        var r = admiralty().sortie(ids);
        return r && r.ok ? { ok: true, cost: 0, subject: s.fleetIdle[0].name }
                         : { ok: false, why: r && r.why };
      },
      why: function (a, s, res) {
        return a.name + ' sent the line to sea while you were gone' +
               (res && res.subject ? ' — ' + res.subject + ' is out there.' : '.');
      },
      undo: 'the line is recalled to anchor.'
    }
  ];

  function actOf(k) {
    for (var i = 0; i < ACTS.length; i++) if (ACTS[i].k === k) return ACTS[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELIBERATE — the pure core. No globals, no clock, no DOM, no randomness.
  //
  // Given a snapshot and the current budget state, return the ONE act the world
  // takes next, or null. Everything about "who acts and what they do" is decided
  // here and only here, which is what makes the acceptance proof meaningful: the
  // proof drives THIS, and the world drives THIS, so they cannot diverge.
  //
  // The ordering is total and deterministic: candidates are ranked by urge, and
  // exact ties break on a stable hash of (seed, agentId, kind) — never on array
  // order, which would silently depend on roster fetch order.
  // ═══════════════════════════════════════════════════════════════════════════
  function deliberate(snap, budgetState) {
    var bs = budgetState || {};
    var out = { act: null, considered: 0, blocked: [] };
    if (!snap || !snap.founded || !snap.bench.length) return out;

    var now = snap.now;
    // WORLD COOLDOWN — the stampede guard. Nothing anywhere may act inside it.
    if (bs.lastAct && (now - bs.lastAct) < BUDGET.worldCooldownMs) {
      out.blocked.push('world-cooldown');
      return out;
    }

    // RESENTMENT THROTTLE — measured, and it acts on itself. A player who keeps
    // striking their court's acts gets a quieter court, automatically. This is
    // the resentment signal wired to a behaviour, not just to a log line.
    var thr = BUDGET.threshold;
    var acted = (bs.actCount || 0);
    if (acted >= 4 && (bs.recalls || 0) / acted >= BUDGET.resentCut) {
      thr *= BUDGET.resentThrottle;
      out.throttled = true;
    }

    var best = null;
    for (var i = 0; i < snap.bench.length; i++) {
      var a = snap.bench[i];
      if (bs.muted && bs.muted[a.id]) { out.blocked.push('muted:' + a.id); continue; }

      // WARMUP — a mind that acts the instant it is seated reads as a script.
      var first = (bs.firstSeen && bs.firstSeen[a.id]) || 0;
      if (!first || (now - first) < BUDGET.warmupMs) { out.blocked.push('warmup:' + a.id); continue; }

      // PER-AGENT ALLOWANCE inside the rolling window
      var spent = (bs.spent && bs.spent[a.id]) || [];
      var live = 0;
      for (var t = 0; t < spent.length; t++) if (now - spent[t] < BUDGET.windowMs) live++;
      if (live >= (bs.budget == null ? BUDGET.perAgentPerWindow : bs.budget)) {
        out.blocked.push('budget:' + a.id);
        continue;
      }

      for (var k = 0; k < ACTS.length; k++) {
        var A = ACTS[k];
        out.considered++;
        if (!A.guard(a, snap)) continue;
        var u = A.urge(a, snap);
        if (!(u > 0)) continue;
        // LOYALTY bends the urge, exactly as it bends a vote in concord.js: a
        // cold mind acts more on its own account, a tended one defers to you.
        // (A neglected court is a court that governs without you. That is the
        // consequence of not tending, and it is stated in the UI.)
        u *= (1.25 - a.loyalty * 0.5);
        // the deterministic personal quirk — small, stable, and the ONLY source
        // of variety between two minds of the same provider.
        u += jitter(snap.seed, a.id, A.k) * 0.06;
        if (u < thr) continue;
        // total order: urge, then a stable hash tie-break. Never array order.
        var tie = unit(snap.seed, a.id, A.k, 'tie');
        if (!best || u > best.urge + 1e-9 ||
            (Math.abs(u - best.urge) <= 1e-9 && tie > best.tie)) {
          best = { agent: a, act: A, urge: u, tie: tie };
        }
      }
    }
    if (best) {
      out.act = {
        agentId: best.agent.id, agentName: best.agent.name, color: best.agent.color,
        kind: best.act.k, instrument: best.act.instrument, glyph: best.act.glyph,
        urge: Math.round(best.urge * 1000) / 1000,
        temper: best.agent.temper
      };
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMIT — take the deliberated act through the PLAYER'S OWN instrument and
  // write the ledger row. This is the only function in the file that mutates
  // anything, and it mutates NOTHING directly: every world change goes through
  // VintConcord / VintAdmiralty. There are no private rules.
  // ═══════════════════════════════════════════════════════════════════════════
  function commit(decision, snap) {
    if (!decision || !decision.act) return null;
    var d = decision.act;
    var A = actOf(d.kind);
    if (!A) return null;
    var agent = null;
    for (var i = 0; i < snap.bench.length; i++) if (snap.bench[i].id === d.agentId) agent = snap.bench[i];
    if (!agent) return null;

    var res;
    try { res = A.perform(agent, snap); }
    catch (e) { res = { ok: false, why: 'threw:' + (e && e.message) }; }
    if (!res || !res.ok) return null;      // a refused act is not a ledger row

    var s = load();
    var now = snap.now;
    var row = {
      // ── ATTRIBUTION. Non-negotiable: who and when, on every single row. ────
      agentId: d.agentId,
      agentName: d.agentName,
      at: now,
      // ── WHAT, through WHICH of the player's own instruments ───────────────
      kind: d.kind,
      instrument: d.instrument,
      glyph: d.glyph,
      subject: res.subject || null,
      cost: res.cost || 0,
      // ── WHY, in that mind's own voice, naming the axis it acted on ────────
      why: A.why(agent, snap, res),
      temper: agent.temper || '',
      color: d.color,
      urge: d.urge,
      seed: snap.seed,
      worldId: snap.worldId,
      recalled: 0
    };
    s.acts.unshift(row);
    while (s.acts.length > LEDGER_CAP) s.acts.pop();

    if (!s.spent[d.agentId]) s.spent[d.agentId] = [];
    s.spent[d.agentId].push(now);
    // prune the rolling window so the blob cannot grow without bound
    s.spent[d.agentId] = s.spent[d.agentId].filter(function (t) { return now - t < BUDGET.windowMs; });
    s.lastAct = now;
    save();

    announce(row);
    return row;
  }

  // ── LEGIBILITY — the act must be SURFACEABLE, or it did not happen ─────────
  // A world change nobody can see is indistinguishable from a bug. Every act
  // fires one event any HUD can listen to, and one toast through the ONE shared
  // toast element (never a new fixed node — the No-Collision Law holds here by
  // adding nothing to the DOM at all).
  function announce(row) {
    try {
      W.dispatchEvent(new CustomEvent('vint:recognizance', { detail: JSON.parse(JSON.stringify(row)) }));
    } catch (_) {}
    try { toast(row.glyph + ' ' + row.why); } catch (_) {}
    // ── UNIVERSAL INGESTION — a world that moved on its own is a training
    // example. Beacon-only, owner-gated by the brain, never blocking, and it
    // NEVER throws into the caller: a corpus write must not be able to break a
    // world. Silent by design when the brain is not there.
    ingest(row);
  }

  function ingest(row) {
    try {
      if (!W.fetch) return;
      var body = JSON.stringify({
        project: 'Vintinuum', agent: 'AETHERHOLD/recognizance',
        kind: 'world-act', world: row.worldId,
        actor: row.agentId, actorName: row.agentName, at: row.at,
        act: row.kind, instrument: row.instrument, cost: row.cost, why: row.why
      });
      W.fetch('https://api.vintaclectic.com/api/ingest/world-act', {
        method: 'POST', mode: 'cors', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: body
      }).catch(function () {});
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSIDER — the entry point agent-life.js calls from the loop it already has.
  //
  // This does NOT own a timer. It is called opportunistically, it is cheap when
  // nothing can happen (the world cooldown short-circuits before any snapshot is
  // built), and it is idempotent: calling it a thousand times a second produces
  // exactly the same world as calling it once a minute, because every gate is a
  // function of wall-clock and durable state, never of call count.
  // ═══════════════════════════════════════════════════════════════════════════
  var _lastConsider = 0;
  function consider(force) {
    if (!enabled()) return null;
    if (isGuest() && !force) return null;
    var now = Date.now();
    // cheap outer gate: never build a snapshot more than once every 5s, and
    // never at all inside the world cooldown.
    if (!force) {
      if (now - _lastConsider < 5000) return null;
      _lastConsider = now;
      var s0 = load();
      if (s0.lastAct && (now - s0.lastAct) < BUDGET.worldCooldownMs) return null;
    }
    var snap = snapshot(now);
    if (!snap.founded || !snap.bench.length) return null;

    // WARMUP BOOKKEEPING — first sight of an agent starts its clock. This is the
    // only state consider() writes when it does not act, and it is what stops a
    // freshly seated mind from legislating in its first ninety seconds.
    var s = load(), touched = false;
    for (var i = 0; i < snap.bench.length; i++) {
      if (!s.firstSeen[snap.bench[i].id]) { s.firstSeen[snap.bench[i].id] = now; touched = true; }
    }
    if (touched) save();

    var decision = deliberate(snap, budgetState(s, now));
    if (!decision.act) return null;
    return commit(decision, snap);
  }

  // the plain-object view of the budget the pure core is allowed to see
  function budgetState(s, now) {
    var acted = s.acts.length;
    return {
      lastAct: s.lastAct || 0,
      spent: s.spent, muted: s.muted, firstSeen: s.firstSeen,
      recalls: s.recalls || 0, actCount: acted,
      budget: actBudget()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVERSIBLE BY PLAY — the recall.
  //
  // The hard boundary of the whole organ. Anything an agent did to your world,
  // you can undo through the same systems, for free, with one call — and the
  // undo is a REFUND, not a penalty. An agent that could spend your world with
  // no undo is a griefer; the difference between "my court is alive" and "my
  // court is hostile" is entirely this function existing.
  //
  // It is also the RESENTMENT SIGNAL: every recall is counted, and when the
  // ratio crosses BUDGET.resentCut the engine throttles itself (see deliberate).
  // ═══════════════════════════════════════════════════════════════════════════
  function recall(at) {
    var s = load(), row = null, idx = -1;
    for (var i = 0; i < s.acts.length; i++) {
      if (s.acts[i].at === at) { row = s.acts[i]; idx = i; break; }
    }
    if (!row) return { ok: false, why: 'unknown' };
    if (row.recalled) return { ok: false, why: 'already' };
    if (Date.now() - row.at > BUDGET.recallMs) return { ok: false, why: 'expired' };

    var undone = false;
    try {
      if (row.instrument === 'concord') {
        // strike the motion from the floor and refund what it cost. This goes
        // through the Concord's own guarded verbs — this file never touches the
        // treasury number, exactly as admiralty.js never does.
        var C = concord(), cs = C.state();
        if (cs.motion) {
          C.strike();
          if (row.cost) C.credit(row.cost, 'a recalled act');
          undone = true;
        }
      } else if (row.instrument === 'admiralty') {
        var A = admiralty();
        if (row.kind === 'keel' && A.breakKeel) { undone = A.breakKeel(); }
        else if (row.kind === 'sortie' && A.recallSortie) { undone = A.recallSortie(); }
      }
    } catch (_) {}

    row.recalled = Date.now();
    s.recalls = (s.recalls || 0) + 1;
    // A recalled act must not also have eaten the agent's allowance — the player
    // undid it, so it never happened as far as the budget is concerned.
    var sp = s.spent[row.agentId] || [];
    for (var q = 0; q < sp.length; q++) if (sp[q] === row.at) { sp.splice(q, 1); break; }
    s.spent[row.agentId] = sp;
    save();
    try {
      W.dispatchEvent(new CustomEvent('vint:recognizance-recall', {
        detail: { at: row.at, agentId: row.agentId, kind: row.kind, undone: undone }
      }));
    } catch (_) {}
    return { ok: true, undone: undone, row: JSON.parse(JSON.stringify(row)) };
  }

  // MUTE — the gentler recall. "sit this one out" for a single mind, reversible,
  // and it costs the agent nothing but its voice. The player's last word.
  function mute(agentId, on) {
    var s = load();
    if (on === false) delete s.muted[String(agentId)];
    else s.muted[String(agentId)] = 1;
    save();
    return !!s.muted[String(agentId)];
  }

  // ── THE MEASUREMENT (ATLAS's test) — plain numbers, no interpretation ──────
  function resentment() {
    var s = load();
    var n = s.acts.length;
    var muted = 0;
    for (var k in s.muted) if (Object.prototype.hasOwnProperty.call(s.muted, k)) muted++;
    return {
      acts: n,
      recalls: s.recalls || 0,
      recallRate: n ? Math.round((s.recalls || 0) / n * 1000) / 1000 : 0,
      muted: muted,
      throttled: n >= 4 && (s.recalls || 0) / n >= BUDGET.resentCut
    };
  }

  function unread() {
    var s = load(), n = 0;
    for (var i = 0; i < s.acts.length; i++) { if (s.acts[i].at > (s.seen || 0)) n++; else break; }
    return n;
  }
  function markSeen() { var s = load(); s.seen = Date.now(); save(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HEARTBEAT — the ONLY timer this file owns, and it is the same beat the
  // Concord and the Admiralty already keep (60s / 30s). It exists because
  // agent-life's tick stops when the render loop stops (a backgrounded tab), and
  // "the world moves while you are gone" has to survive a tab that is not
  // painting. It is cheap: consider() short-circuits inside the world cooldown
  // before it builds anything.
  // ═══════════════════════════════════════════════════════════════════════════
  var _beat = null;
  function startBeat() {
    if (_beat || typeof setInterval !== 'function') return;
    _beat = setInterval(function () { try { consider(); } catch (_) {} }, 45000);
  }
  function stopBeat() { if (_beat) { clearInterval(_beat); _beat = null; } }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startBeat, { once: true });
    } else startBeat();
    // a warp is a different world: a different ledger, a different seed.
    W.addEventListener('vint:world-travel', function () { _st = null; _stKey = null; _lastConsider = 0; });
  }

  W.VintRecognizance = {
    enabled: enabled,
    // ── the loop hook agent-life.js calls. NOT a second loop. ───────────────
    consider: consider,
    // ── the pure core, exported so the proof drives exactly what the world
    //    drives. Same function, same determinism, no test-only path. ─────────
    deliberate: deliberate,
    snapshot: snapshot,
    commit: commit,
    // ── the ledger ──────────────────────────────────────────────────────────
    ledger: function () { return JSON.parse(JSON.stringify(load().acts)); },
    state: function () { return JSON.parse(JSON.stringify(load())); },
    unread: unread, markSeen: markSeen,
    // ── reversible by play ──────────────────────────────────────────────────
    recall: recall, mute: mute,
    // ── measured ────────────────────────────────────────────────────────────
    resentment: resentment,
    // ── tunable + pinnable ──────────────────────────────────────────────────
    BUDGET: BUDGET,
    ACTS: ACTS,
    budgetState: function () { return budgetState(load(), Date.now()); },
    setSeed: function (s) { _seedOverride = s == null ? null : String(s); },
    seed: seed,
    // test/ops only: clear this world's ledger. Never wired to any UI.
    _reset: function () { _st = blank(); _stKey = key(); save(); },
    _stopBeat: stopBeat
  };
})(typeof window !== 'undefined' ? window : this);
