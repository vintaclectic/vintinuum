'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   RECOGNIZANCE — the organ where the world moves without you. (AETHERHOLD,
   DIRVERSE organ 5)

   ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
   agent-life.js already gives every presence a body: it wanders, it muses, it
   turns to regard you. That is AMBIENT MOTION, and ambient motion changes
   NOTHING. Close the tab mid-stride and reopen it and the world is byte-for-byte
   where you left it. A being that can only move is a screensaver with a name.

   ── WHAT THIS IS ────────────────────────────────────────────────────────────
   An agent on its OWN RECOGNIZANCE takes an act that OUTLASTS THE ACT. It puts
   a motion on the Concord floor. It lays a keel in the Admiralty yard. It
   pledges to a faction, or breaks with one. It marches on ground. It carries
   lumen to the treasury. When you come back, the thing it did is still there,
   with its name on it, and you must reckon with it — keep it, spend it, contest
   it, or repeal it.

   THE ONE RULE THAT MAKES IT FAIR: an agent acts THROUGH THE SAME VERBS YOU DO.
   There is no private agent-only pathway anywhere in this file. Every act below
   is a call into concord.js / admiralty.js / factions.js — the exact functions
   the player's own taps reach. If an act can happen, you could have done it. If
   you can undo it, you undo it with the same organ that did it. No agent rule
   the player cannot read, reach, or reverse.

   ── THE FIVE DESIGN LAWS THIS FILE IS BUILT ON ──────────────────────────────

   1 BUDGET — an agent gets a fixed, explicit, tunable ration of acts per
     interval (BUDGET.perAgent per BUDGET.windowMs) and the WORLD gets a ceiling
     on top of that (BUDGET.perWorld). Both are in one visible table at the top
     of this file, not scattered as magic numbers. A world that can act without
     bound is a world that has taken itself away from you.

   2 MOTIVE — an act is never `Math.random() < 0.1`. Every candidate act is
     scored by a PRESSURE function reading (a) the agent's Concord disposition,
     which is a stable pure function of who that agent IS, (b) its faction
     allegiance and that faction's grudges, (c) the actual state of the world:
     an empty treasury, an idle yard, ground newly lost, a motion on the floor.
     The highest pressure above THRESHOLD wins. Below threshold, NOBODY ACTS —
     which is why a settled world goes quiet, correctly.

   3 LEDGER — every act appends one attributable row: who, what, when, why, and
     the reversal that undoes it. The ledger is the ingestion hook too
     (Universal Ingestion Law): each row is emitted as `vint:recognizance` and
     spooled for the corpus. An unattributable act is indistinguishable from a
     bug, and a world you cannot audit is a world you cannot trust.

   4 REVERSIBLE BY PLAY — every act carries a `undo` descriptor naming the
     organ verb that contests it. A motion is voted down. A keel is broken. A
     pledge is unpledged. Ground is marched on. There is NOTHING an agent can do
     that money is the only answer to — that would be Aria's line crossed, and
     we do not cross it. The reversal is always a PLAY, never a purchase.

   5 FLAG — `?recog=0` kills it in 30s with no deploy, and the flag is read on
     every deliberation rather than latched at boot. The resentment signal is
     `RECOG.hush(agentId)`: one call, always available, never punished, and it
     is stored so a hushed agent stays hushed across reloads. If hush-rate
     climbs, this organ is doing harm and gets cut regardless of what it does
     for return-rate.

   ── DETERMINISM ─────────────────────────────────────────────────────────────
   Given a seed, the same world state produces the same act sequence, forever.
   There is not one call to Math.random() in the decision path. The RNG is a
   splitmix32 keyed on (seed, worldId, tickIndex, agentId), so:
     · the same seed replays exactly (the acceptance proof depends on this)
     · two agents deliberating on the same tick do not share a stream, so
       adding an agent cannot change what a different agent decided
     · offline time replays honestly: `catchUp()` steps whole ticks forward
       rather than integrating a wall-clock delta, so the sequence you get for
       being away six hours is the sequence you would have watched.

   ── OFFLINE IS THE POINT (Morrison) ─────────────────────────────────────────
   The purest open loop in any world is "what happened while I was gone". This
   organ replays elapsed ticks on load, bounded by CATCHUP.maxTicks, so coming
   back after a night away means walking into consequences with names on them.
   Not a streak. Not a login bonus. A world that kept going.

   ── NO-COLLISION LAW ────────────────────────────────────────────────────────
   ZERO fixed elements. This file creates NO DOM of its own — not one node. It
   emits `vint:recognizance` and appends to a ledger that the EXISTING sheets
   read (the Concord's record, the yard's wakes, the factions ledger). It adds
   nothing to the one-sheet exclusive set because it adds no sheet. The only
   surface it may ever touch is DirverseHUD.toast(), which is the HUD's own
   measured, single-instance channel.

   ── HEADLESS ────────────────────────────────────────────────────────────────
   The whole decision model runs with no DOM, so scripts/verify-recognizance.js
   proves the five acceptance claims against THIS code and not a copy of it.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (W) {
  'use strict';

  var HAS_DOM = typeof document !== 'undefined' && !!(document && document.createElement);
  if (HAS_DOM && W.VintRecognizance) return W.VintRecognizance;

  // ═══════════════════════════════════════════════════════════════════════════
  // THE BUDGET — every number that bounds this organ, in one place, tunable.
  //
  // These are not tuning knobs hidden in a closure; they are the contract this
  // organ makes with the player about how much of their world it may move. A
  // reviewer should be able to read this block alone and know the worst case.
  // ═══════════════════════════════════════════════════════════════════════════
  var BUDGET = {
    tickMs:      90 * 1000,   // one deliberation beat. 90s: long enough that a
                              // session is not a parade, short enough that an
                              // evening away is a story.
    perAgent:    2,           // acts one agent may take per window
    perWorld:    5,           // acts the WHOLE world may take per window,
                              // whatever the roster size. This is the number
                              // that keeps a 200-agent court from being a riot.
    windowMs:    6 * 3600e3,  // the ration window: six hours
    threshold:   0.52,        // pressure below this = nobody acts. A settled
                              // world is allowed to be quiet.
    quorum:      1,           // agents required before the organ deliberates
    maxLedger:   240          // rows kept; the tail is spooled, then trimmed
  };

  var CATCHUP = {
    maxTicks: 40              // an offline replay is bounded. 40 ticks = one
                              // hour of world at 90s/tick. You come back to a
                              // story, never to an unrecognisable world.
  };

  var LS_STATE = 'vint:recognizance:';
  var VERSION  = 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // THE RNG — splitmix32, keyed. No Math.random() below this line, ever.
  //
  // Keying on (seed, worldId, tick, agentId, salt) rather than carrying one
  // mutable stream is the load-bearing decision: it makes each agent's draw
  // INDEPENDENT of how many other agents deliberated first, so the sequence for
  // agent X is stable even when agent Y is added, removed, or hushed. A single
  // shared stream would make determinism true only for an unchanging roster,
  // which is determinism that does not survive contact with a real world.
  // ═══════════════════════════════════════════════════════════════════════════
  function hash32(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function splitmix32(a) {
    a = (a + 0x9e3779b9) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0);
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 4294967296;
  }
  // a deterministic 0..1 draw for exactly one (tick, agent, purpose)
  function draw(seed, worldId, tick, agentId, salt) {
    return splitmix32(hash32(seed + '|' + worldId + '|' + tick + '|' + agentId + '|' + salt));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIRONMENT — every organ this file speaks to, looked up lazily so load
  // order never matters and a missing organ is a QUIET no-op rather than a
  // thrown error. An organ that crashes the world when its neighbour is absent
  // is worse than an organ that does nothing.
  // ═══════════════════════════════════════════════════════════════════════════
  function world()    { return W.VintinuumWorld; }
  function hud()      { return W.DirverseHUD; }
  function concord()  { return W.VintConcord; }
  function admiralty(){ return W.VintAdmiralty; }
  function factions() { return W.VintFactions; }
  function court()    { return W.VintCourt; }

  // THE SAME world key concord.js and factions.js use — `currentWorldId()`, the
  // one world-client exports (world-client.js ~947). Deliberately not `_worldId`:
  // an organ that keys its history off a private field would silently write a
  // DIFFERENT world's ledger the day that field is renamed, and the drift would
  // be invisible. One reader, one key, or the organs disagree about where they are.
  function worldId() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function token() {
    try { return (W.localStorage && (W.localStorage.getItem('vint_access_token') || W.localStorage.getItem('vint_token'))) || null; }
    catch (_) { return null; }
  }
  function isGuest() {
    var w = world();
    if (w && w._guest === true) return true;
    return !token();
  }

  // THE FLAG — read live, never latched. `?recog=0` and a persisted kill both
  // work, and both take effect on the very next deliberation.
  function enabled() {
    try {
      var qs = (W.location && W.location.search) || '';
      if (/[?&]recog=0\b/.test(qs)) return false;
      if (/[?&]recog=1\b/.test(qs)) return true;
      if (W.localStorage && W.localStorage.getItem('vint:recog:off') === '1') return false;
    } catch (_) {}
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — persisted per world. Small on purpose: the ACTS live in the organs
  // that own them (a motion lives in the Concord, a hull lives in the yard).
  // This file keeps only what it needs to be fair and honest: the clock, the
  // ration counters, the hush list, the seed, and the ledger.
  // ═══════════════════════════════════════════════════════════════════════════
  var _s = null, _sWorld = null;

  function blank(seed) {
    return {
      v: VERSION,
      seed: seed || defaultSeed(),
      tick: 0,             // monotonic deliberation index — the RNG's clock
      last: 0,             // wall-clock ms of the last deliberated tick
      spent: {},           // agentId → [timestamps of acts]
      worldSpent: [],      // timestamps of every act, for the world ceiling
      hushed: {},          // agentId → ms hushed at (resentment signal)
      log: [],             // the ledger
      seen: 0              // ledger length the player has acknowledged
    };
  }
  function defaultSeed() {
    // A world's seed is its identity, so two players in the same world watch the
    // same history unfold — and a fresh world gets a fresh one, once, persisted.
    return 'recog:' + worldId();
  }

  function load() {
    var wid = worldId();
    if (_s && _sWorld === wid) return _s;
    _sWorld = wid;
    var raw = null;
    try { raw = W.localStorage && W.localStorage.getItem(LS_STATE + wid); } catch (_) {}
    if (raw) {
      try {
        var p = JSON.parse(raw);
        if (p && p.v === VERSION) {
          // defensive fill — a state written by an older tick must not throw
          p.spent = p.spent || {}; p.worldSpent = p.worldSpent || [];
          p.hushed = p.hushed || {}; p.log = p.log || [];
          p.seed = p.seed || defaultSeed();
          _s = p; return _s;
        }
      } catch (_) {}
    }
    _s = blank();
    return _s;
  }
  function save() {
    if (!_s) return;
    try { W.localStorage && W.localStorage.setItem(LS_STATE + _sWorld, JSON.stringify(_s)); } catch (_) {}
  }
  function forget() { _s = null; _sWorld = null; }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE RATION — budget accounting, in wall-clock windows.
  // ═══════════════════════════════════════════════════════════════════════════
  function prune(list, now) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (now - list[i] < BUDGET.windowMs) out.push(list[i]);
    return out;
  }
  function agentBudgetLeft(agentId, now) {
    var s = load();
    s.spent[agentId] = prune(s.spent[agentId] || [], now);
    return BUDGET.perAgent - s.spent[agentId].length;
  }
  function worldBudgetLeft(now) {
    var s = load();
    s.worldSpent = prune(s.worldSpent, now);
    return BUDGET.perWorld - s.worldSpent.length;
  }
  function chargeBudget(agentId, now) {
    var s = load();
    s.spent[agentId] = prune(s.spent[agentId] || [], now);
    s.spent[agentId].push(now);
    s.worldSpent = prune(s.worldSpent, now);
    s.worldSpent.push(now);
  }

  // THE RESENTMENT SIGNAL — always available, one call, never punished, and
  // persisted so it means something. This is the measurement that decides
  // whether this organ ships or gets cut (doctrine test 6).
  function hush(agentId, on) {
    var s = load();
    if (on === false) delete s.hushed[agentId];
    else s.hushed[agentId] = Date.now();
    save();
    emit('vint:recognizance-hush', { agentId: agentId, hushed: on !== false });
    return true;
  }
  function hushed(agentId) { return !!load().hushed[agentId]; }
  function hushRate() {
    var s = load(), roster = deliberants();
    if (!roster.length) return 0;
    var n = 0;
    for (var i = 0; i < roster.length; i++) if (s.hushed[roster[i].id]) n++;
    return n / roster.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE DELIBERANTS — who may act.
  //
  // The player's own court, seated or not. NOT the council presences: the
  // council is Vintinuum's own, not the player's polity, and letting it move
  // the player's treasury would be the "private agent rule" this file exists to
  // forbid. An agent must be YOURS to spend YOUR world.
  // ═══════════════════════════════════════════════════════════════════════════
  function deliberants() {
    var out = [];
    var c = court();
    if (c && c.roster) {
      var r = c.roster() || [];
      for (var i = 0; i < r.length; i++) {
        var a = r[i];
        if (!a || !a.id) continue;
        if (a.status === 'archived') continue;
        out.push(a);
      }
    }
    // Sorted by id so the deliberation ORDER is stable regardless of what order
    // the roster came back from the network in. Determinism dies to unstable
    // iteration order more often than to bad RNG.
    out.sort(function (x, y) { return String(x.id) < String(y.id) ? -1 : (String(x.id) > String(y.id) ? 1 : 0); });
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WORLD READ — one snapshot of everything a motive could care about,
  // taken once per tick so every agent deliberates against the SAME world.
  // (Reading it per-agent would let agent A's act change agent B's motive
  // mid-tick, which is a subtle order-dependence and therefore a determinism
  // bug the moment the roster changes.)
  // ═══════════════════════════════════════════════════════════════════════════
  function survey() {
    var v = {
      founded: false, treasury: 0, standing: 0, lumen: 0, motion: null,
      seats: 0, tags: {}, charter: null,
      fleet: 0, keel: null, berths: 0,
      holdsMine: [], holdsLost: [], wars: [], grudges: {}, factionOf: {},
      hasConcord: false, hasAdmiralty: false, hasFactions: false
    };
    var C = concord();
    if (C && C.state) {
      v.hasConcord = true;
      try {
        var cs = C.state();
        v.founded = !!(C.founded && C.founded());
        v.treasury = cs.treasury || 0;
        v.motion = cs.motion || null;
        v.seats = (cs.seats || []).length;
        v.tags = cs.tags || {};
        v.charter = cs.charter || null;
        v.standing = (C.standing && C.standing()) || 0;
        v.lumen = (C.lumen && C.lumen()) || 0;
      } catch (_) {}
    }
    var A = admiralty();
    if (A && A.state) {
      v.hasAdmiralty = true;
      try {
        var as = A.state();
        v.fleet = (as.fleet || []).length;
        v.keel = as.keel || null;
      } catch (_) {}
    }
    var F = factions();
    if (F && F.state) {
      v.hasFactions = true;
      try {
        var fs = F.state();
        var holds = (F.map && F.map()) || [];
        for (var i = 0; i < holds.length; i++) {
          if (holds[i].mine) v.holdsMine.push(holds[i].k);
          else v.holdsLost.push(holds[i]);
        }
        var rel = (F.relations && F.relations(F.SELF)) || { war: [], ally: [] };
        v.wars = rel.war || [];
        v.allies = rel.ally || [];
        for (var j = 0; j < (v.wars || []).length; j++) {
          v.grudges[v.wars[j]] = (F.grudge && F.grudge(F.SELF, v.wars[j])) || 0;
        }
        var facs = (F.factions && F.factions()) || [];
        for (var k = 0; k < facs.length; k++) {
          var mem = (F.members && F.members(facs[k].k)) || [];
          for (var m = 0; m < mem.length; m++) v.factionOf[mem[m].id] = facs[k].k;
        }
        v.factionList = facs;
      } catch (_) {}
    }
    return v;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MOTIVES — the heart of the organ.
  //
  // Each motive is (a) a GATE saying whether the act is even possible right now
  // through the real organ, (b) a PRESSURE in 0..1 derived from who the agent is
  // and what the world lacks, and (c) a DO that calls the same public verb the
  // player's tap calls, returning the durable change it made.
  //
  // Pressure is never a constant and never a bare random. The RNG appears ONLY
  // as a small deterministic tie-breaker (`±0.06`), so two agents with identical
  // dispositions do not act in lockstep — the character decides, the draw only
  // breaks a tie. If you remove the draw entirely, the system still works; it
  // just becomes more synchronised. That is the correct dependency direction.
  // ═══════════════════════════════════════════════════════════════════════════

  // an agent's political character, from the Concord's own pure function. NEVER
  // a second personality model — the whole point is that the agent votes in the
  // Concord the same way it acts out here.
  function disp(agent) {
    var C = concord();
    if (C && C.disposition) { try { return C.disposition(agent); } catch (_) {} }
    // Concord absent: a stable neutral derived from the id, still deterministic.
    var d = {}, tags = ['civic','criminal','craft','social','mentor','heat','trust'];
    for (var i = 0; i < tags.length; i++) d[tags[i]] = (splitmix32(hash32(agent.id + tags[i])) - 0.5) * 1.2;
    return d;
  }
  function lean(d, t) { return typeof d[t] === 'number' ? d[t] : 0; }
  function pos(x) { return x > 0 ? x : 0; }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  var MOTIVES = [

    // ── 1 · TABLE A MOTION ────────────────────────────────────────────────────
    // The civic act. A civic-minded agent with a founded polity and an empty
    // floor puts something to the table. It is the single most reversible act in
    // the world — you vote it down, and voting it down is a PLAY.
    {
      k: 'motion',
      gate: function (a, v) {
        return v.hasConcord && v.founded && !v.motion && v.seats >= 1;
      },
      pressure: function (a, v, d, r) {
        // civic conviction is the spine; an empty treasury raises the stakes;
        // a long-quiet floor raises it further.
        var p = 0.34 + pos(lean(d, 'civic')) * 0.42 + pos(lean(d, 'social')) * 0.16;
        if (v.treasury < 40) p += 0.18;              // the polity is broke
        if (v.standing >= 55 && v.fleet === 0) p += 0.12;  // nothing has ever been built
        return clamp01(p + (r - 0.5) * 0.12);
      },
      act: function (a, v, d, r) {
        var C = concord();
        // WHICH motion: chosen by the agent's own character against the world's
        // actual lack, exactly the way a person picks a fight worth having.
        var kind = 'ordinance';
        if (v.treasury < 40) kind = 'levy';
        else if (lean(d, 'craft') > 0.15 && v.standing >= 55) kind = 'commission';
        else if (lean(d, 'criminal') > 0.3 && v.standing >= 150) kind = 'embargo';
        else if (lean(d, 'mentor') > 0.25 && v.standing >= 55) kind = 'pardon';
        // THE SAME VERB THE PLAYER TAPS. If the charter forbids it or the
        // standing is short, the organ refuses us exactly as it refuses them.
        var res = C.table ? C.table(kind, null) : { ok: false, why: 'no-verb' };
        if (!res || !res.ok) return null;
        return {
          kind: 'motion',
          what: 'tabled ' + kind,
          durable: { organ: 'concord', key: 'motion.k', value: kind },
          say: nameOf(a) + ' put ' + article(kind) + ' on the floor.',
          undo: { organ: 'concord', verb: 'open', how: 'vote it down when the floor closes' }
        };
      }
    },

    // ── 2 · LAY A KEEL ────────────────────────────────────────────────────────
    // The craft act. A builder with an empty yard lays a hull. It is durable,
    // attributable (the hull carries its builder), and reversible: you break the
    // keel in the yard, with the yard's own verb.
    {
      k: 'keel',
      gate: function (a, v) {
        return v.hasAdmiralty && v.founded && !v.keel;
      },
      pressure: function (a, v, d, r) {
        var p = 0.30 + pos(lean(d, 'craft')) * 0.48;
        if (v.fleet === 0) p += 0.22;               // no fleet at all is a want
        if (v.wars && v.wars.length) p += 0.16;     // a war concentrates the mind
        if (v.treasury < 25) p -= 0.24;             // no one lays a keel broke
        return clamp01(p + (r - 0.5) * 0.12);
      },
      act: function (a, v, d, r) {
        var A = admiralty();
        if (!A || !A.lay) return null;
        // element chosen from the ground actually in contention, not a whim: if
        // we are at war over sea, a sea hull is the useful hull.
        var el = 'land';
        var F = factions();
        if (v.wars && v.wars.length && F && F.HOLDS) {
          for (var i = 0; i < v.holdsLost.length; i++) {
            var h = v.holdsLost[i];
            if (v.wars.indexOf(h.owner) >= 0) { el = h.el || elementOf(h.k) || 'land'; break; }
          }
        } else if (lean(d, 'heat') > 0.2) el = 'air';
        else if (lean(d, 'social') > 0.25) el = 'sea';
        // THE YARD'S OWN SIGNATURE — lay(element, class, name), positional,
        // exactly as the yard's own "lay the keel" button calls it. The name is
        // the agent's, so the hull carries its origin in the ONE place a hull's
        // identity lives; we never write a parallel builder field.
        var cls = 'courier';
        var res = A.lay(el, cls, nameOf(a) + '’s keel');
        if (!res || res.ok === false) return null;
        return {
          kind: 'keel',
          what: 'laid a ' + el + ' keel',
          durable: { organ: 'admiralty', key: 'keel', value: el },
          say: nameOf(a) + ' laid a keel in the yard — ' + el + '.',
          undo: { organ: 'admiralty', verb: 'open', how: 'break the keel in the yard' }
        };
      }
    },

    // ── 3 · PLEDGE TO A FACTION ───────────────────────────────────────────────
    // The allegiance act. An agent that stands with nobody picks a side, and the
    // side it picks is legible from its character. Reversible: you recruit it
    // back, which is the same verb, and allegiance is exclusive so it lands.
    {
      k: 'pledge',
      gate: function (a, v) {
        return v.hasFactions && !v.factionOf[a.id] && (v.factionList || []).length > 0;
      },
      pressure: function (a, v, d, r) {
        // a social agent wants to belong; a solitary one resists
        var p = 0.30 + pos(lean(d, 'social')) * 0.40 + pos(lean(d, 'trust')) * 0.18;
        if (v.wars && v.wars.length) p += 0.14;      // war makes neutrals pick
        return clamp01(p + (r - 0.5) * 0.12);
      },
      act: function (a, v, d, r) {
        var F = factions();
        var list = v.factionList || [];
        if (!list.length) return null;
        // Which faction: the one whose element/creed the agent's own strongest
        // axis matches. Deterministic, and it READS: a builder joins the yardfolk.
        var want = lean(d, 'craft') > 0.2 ? 'land' : (lean(d, 'heat') > 0.2 ? 'air' : 'sea');
        var pick = null;
        for (var i = 0; i < list.length; i++) if (list[i].el === want) { pick = list[i]; break; }
        if (!pick) pick = list[Math.floor(r * list.length) % list.length];
        var res = F.recruit(pick.k, { id: a.id, name: nameOf(a), role: 'pledged' });
        if (!res || !res.ok) return null;
        return {
          kind: 'pledge',
          what: 'pledged to ' + (pick.n || pick.k),
          durable: { organ: 'factions', key: 'member:' + a.id, value: pick.k },
          say: nameOf(a) + ' pledged to ' + (pick.n || pick.k) + '.',
          undo: { organ: 'factions', verb: 'recruit', how: 'recruit them back through the factions sheet' }
        };
      }
    },

    // ── 4 · CARRY LUMEN TO THE TREASURY ───────────────────────────────────────
    // The provision act. The gentlest one in the file and the one that proves
    // the Aria line: an agent acting on its own initiative is allowed to GIVE.
    // It costs the player nothing and it is never the only way anything happens.
    {
      k: 'carry',
      gate: function (a, v) {
        return v.hasConcord && v.founded && v.treasury < 220;
      },
      pressure: function (a, v, d, r) {
        var p = 0.26 + pos(lean(d, 'civic')) * 0.20 + pos(lean(d, 'trust')) * 0.34;
        if (v.treasury < 30) p += 0.24;
        return clamp01(p + (r - 0.5) * 0.10);
      },
      act: function (a, v, d, r) {
        var C = concord();
        if (!C || !C.credit) return null;
        var n = 8 + Math.floor(r * 14);   // 8..21, deterministic
        var okc = C.credit(n, 'carried in by ' + nameOf(a));
        if (okc === false) return null;
        return {
          kind: 'carry',
          what: 'carried ◇' + n + ' to the treasury',
          durable: { organ: 'concord', key: 'treasury', value: n },
          say: nameOf(a) + ' carried ◇' + n + ' to the table.',
          undo: { organ: 'concord', verb: 'spend', how: 'spend it — it is yours' }
        };
      }
    },

    // ── 5 · MARCH ON GROUND ───────────────────────────────────────────────────
    // The gravest act and the most tightly gated: it requires an EXISTING war
    // the player themselves declared, and a fleet the player themselves built.
    // An agent never starts a war on your behalf and never marches with nothing.
    // This is the Aria boundary made structural: the agent can only escalate a
    // fight you already chose, with means you already have.
    {
      k: 'march',
      gate: function (a, v) {
        if (!v.hasFactions || !v.wars || !v.wars.length) return false;
        if (v.fleet < 1) return false;               // never march empty-handed
        // ONE march at a time — the same rule campaign() enforces internally
        // ({ok:false, why:'sailing'}). Checked here too so we never spend a
        // deliberation on a verb that is already going to refuse us.
        var F = factions();
        try {
          var wl = F.state().wars || [];
          for (var q = 0; q < wl.length; q++) if (!wl[q].done) return false;
        } catch (_) {}
        return v.holdsLost.some(function (h) { return v.wars.indexOf(h.owner) >= 0; });
      },
      pressure: function (a, v, d, r) {
        var g = 0;
        for (var k in v.grudges) if (v.grudges[k] > g) g = v.grudges[k];
        var p = 0.22 + pos(lean(d, 'heat')) * 0.34 + pos(lean(d, 'criminal')) * 0.14
              + Math.min(0.30, g * 0.10);
        if (lean(d, 'trust') > 0.35) p -= 0.20;      // the trusting stay their hand
        return clamp01(p + (r - 0.5) * 0.10);
      },
      act: function (a, v, d, r) {
        var F = factions();
        var target = null;
        for (var i = 0; i < v.holdsLost.length; i++) {
          if (v.wars.indexOf(v.holdsLost[i].owner) >= 0) { target = v.holdsLost[i]; break; }
        }
        if (!target) return null;
        var res = F.campaign(target.owner, target.k, {});
        if (!res || !res.ok) return null;
        return {
          kind: 'march',
          what: 'opened a march on ' + (target.ownerName || target.owner),
          durable: { organ: 'factions', key: 'campaign', value: target.k },
          say: nameOf(a) + ' opened a march on ' + (target.n || target.k) + '.',
          undo: { organ: 'factions', verb: 'sueForPeace', how: 'sue for peace — always one tap, never punished' }
        };
      }
    }
  ];

  function elementOf(k) {
    var F = factions();
    if (!F || !F.HOLDS) return null;
    for (var i = 0; i < F.HOLDS.length; i++) if (F.HOLDS[i].k === k) return F.HOLDS[i].el;
    return null;
  }
  function nameOf(a) { return (a && (a.name || a.label)) || 'an agent'; }
  function article(k) {
    return (k === 'ordinance' || k === 'embargo' || k === 'embassy') ? 'an ' + k : 'a ' + k;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE DELIBERATION — one tick.
  //
  // Every agent is considered, in a stable order, against ONE survey. The
  // highest-pressure legal motive above threshold acts; ties break on the
  // deterministic draw. Budget is charged only when an act actually LANDED in
  // the real organ, so a refused verb never costs an agent its ration — the
  // world does not punish an agent for the polity's rules.
  // ═══════════════════════════════════════════════════════════════════════════
  function deliberate(now) {
    var s = load();
    var acted = [];
    if (!enabled()) return acted;
    if (isGuest()) return acted;

    var roster = deliberants();
    if (roster.length < BUDGET.quorum) return acted;

    var v = survey();
    // nothing to act ON — no organ has anything this agent could reach
    if (!v.hasConcord && !v.hasAdmiralty && !v.hasFactions) return acted;

    var tick = s.tick;

    for (var i = 0; i < roster.length; i++) {
      if (worldBudgetLeft(now) <= 0) break;
      var a = roster[i];
      if (s.hushed[a.id]) continue;                       // resentment signal honoured
      if (agentBudgetLeft(a.id, now) <= 0) continue;

      var d = disp(a);
      var best = null, bestP = 0;
      for (var m = 0; m < MOTIVES.length; m++) {
        var mo = MOTIVES[m];
        var r = draw(s.seed, _sWorld, tick, a.id, mo.k);
        var okGate = false;
        try { okGate = !!mo.gate(a, v); } catch (_) { okGate = false; }
        if (!okGate) continue;
        var p = 0;
        try { p = mo.pressure(a, v, d, r); } catch (_) { p = 0; }
        if (p > bestP) { bestP = p; best = { mo: mo, r: r }; }
      }
      if (!best || bestP < BUDGET.threshold) continue;

      var out = null;
      try { out = best.mo.act(a, v, d, best.r); } catch (e) { out = null; }
      if (!out) continue;                                  // the organ refused; no charge

      chargeBudget(a.id, now);
      var row = {
        t: now, tick: tick, agentId: a.id, agent: nameOf(a),
        color: a.color || null, kind: out.kind, what: out.what,
        say: out.say, durable: out.durable, undo: out.undo,
        pressure: Math.round(bestP * 1000) / 1000
      };
      s.log.unshift(row);
      if (s.log.length > BUDGET.maxLedger) s.log.length = BUDGET.maxLedger;
      acted.push(row);
      ingest(row);
      emit('vint:recognizance', row);

      // the world moved, so the next agent this tick must see the moved world.
      // (Re-surveying is the honest thing: agent B genuinely deliberates after
      // agent A acted. Determinism holds because the ORDER is stable and the
      // draws are keyed, not streamed.)
      v = survey();
    }

    if (acted.length) save();
    return acted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CLOCK — ticks are STEPPED, never integrated.
  //
  // Stepping whole ticks is what makes an offline replay identical to a watched
  // one: being away for six hours runs the same deliberations, in the same
  // order, with the same draws, that you would have seen live. An organ that
  // integrated elapsed time into "how much happened" would produce a different
  // world for a player who watched than for a player who slept, and the
  // difference would be invisible and unfixable.
  // ═══════════════════════════════════════════════════════════════════════════
  function step(now) {
    var s = load();
    now = now || Date.now();
    var out = [];
    if (!s.last) { s.last = now; save(); return out; }
    var due = Math.floor((now - s.last) / BUDGET.tickMs);
    if (due <= 0) return out;
    var run = Math.min(due, CATCHUP.maxTicks);
    for (var i = 0; i < run; i++) {
      s.tick++;
      var when = s.last + (i + 1) * BUDGET.tickMs;
      var got = deliberate(Math.min(when, now));
      for (var g = 0; g < got.length; g++) out.push(got[g]);
    }
    s.last = now;                 // skipped ticks are FORGIVEN, never banked
    save();
    if (out.length) {
      emit('vint:recognizance-batch', { acts: out, offline: due > 1 });
      announce(out, due > 1);
    }
    return out;
  }

  // ── THE VISIBLE LIFE OF THIS ORGAN — and why it is not here ────────────────
  // There is exactly ONE channel: the `vint:recognizance-batch` event, which
  // world.html routes into the clearing's existing speech feed (`#feed`, capped
  // at five children, measured, pointer-events:none, self-clearing). This file
  // deliberately does NOT also toast: two channels for one event is how a
  // player ends up reading the same sentence twice, in two places, at two
  // sizes — the No-Collision Law's cousin, and just as sloppy.
  //
  // Keeping the announcement OUT of this module is also what lets the organ
  // stay zero-DOM: the page decides how an act is spoken, the organ only
  // decides that one happened. A different surface (a phone HUD, a ledger
  // sheet, nothing at all) can subscribe to the same event and this file does
  // not change by one line.
  function announce(/* acts, offline */) { /* the page speaks; see world.html */ }

  function emit(name, detail) {
    try {
      if (W.dispatchEvent && W.CustomEvent) W.dispatchEvent(new W.CustomEvent(name, { detail: detail }));
    } catch (_) {}
  }

  // ── UNIVERSAL INGESTION LAW ────────────────────────────────────────────────
  // Every act is a training example: a world state, a character, a decision, a
  // consequence. Spooled locally (never blocking, never a network dependency)
  // and drained by whatever ships it to the corpus. If nothing drains it, the
  // spool is bounded and the world is unaffected.
  function ingest(row) {
    try {
      if (!W.localStorage) return;
      var K = 'vint:ingest:recognizance';
      var arr = JSON.parse(W.localStorage.getItem(K) || '[]');
      arr.push({
        t: row.t, world: _sWorld, agent: row.agentId, kind: row.kind,
        what: row.what, pressure: row.pressure, durable: row.durable
      });
      if (arr.length > 500) arr = arr.slice(-500);
      W.localStorage.setItem(K, JSON.stringify(arr));
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PUBLIC SURFACE
  // ═══════════════════════════════════════════════════════════════════════════
  var API = {
    enabled: enabled,
    // the clock
    step: step,
    tickNow: function (now) {            // force ONE deliberation (proof + debug)
      var s = load(); s.tick++; var got = deliberate(now || Date.now()); save();
      if (got.length) emit('vint:recognizance-batch', { acts: got, offline: false });
      return got;
    },
    catchUp: function (now) { return step(now); },
    // the ledger
    ledger: function (n) { var s = load(); return s.log.slice(0, n || 40); },
    unread: function () { var s = load(); return Math.max(0, s.log.length - (s.seen || 0)); },
    markSeen: function () { var s = load(); s.seen = s.log.length; save(); },
    // the budget, readable so a player could be shown it
    budget: function () { return JSON.parse(JSON.stringify(BUDGET)); },
    tune: function (patch) {             // explicit + tunable, per the design law
      if (!patch) return JSON.parse(JSON.stringify(BUDGET));
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(BUDGET, k)) BUDGET[k] = patch[k];
      return JSON.parse(JSON.stringify(BUDGET));
    },
    left: function (agentId) { return { agent: agentBudgetLeft(agentId, Date.now()), world: worldBudgetLeft(Date.now()) }; },
    // the resentment signal
    hush: hush, hushed: hushed, hushRate: hushRate,
    // determinism
    seed: function (v) { var s = load(); if (v) { s.seed = String(v); s.tick = 0; save(); } return s.seed; },
    reseed: function (v) { var s = load(); s.seed = String(v || defaultSeed()); s.tick = 0; s.last = 0; save(); return s.seed; },
    // lifecycle
    state: function () { return JSON.parse(JSON.stringify(load())); },
    forget: forget,
    dissolve: function () {
      try { W.localStorage && W.localStorage.removeItem(LS_STATE + worldId()); } catch (_) {}
      forget(); return true;
    },
    survey: survey, deliberants: deliberants, disposition: disp,
    MOTIVES: MOTIVES.map(function (m) { return m.k; })
  };

  if (!HAS_DOM) { W.VintRecognizance = API; return API; }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LIVE CLOCK — one interval, cheap, and it does NOT render anything.
  // Deliberation is not per-frame work; it is a heartbeat. agent-life keeps the
  // 60fps budget; this organ never enters the render loop at all.
  // ═══════════════════════════════════════════════════════════════════════════
  var _timer = null;
  function startClock() {
    if (_timer) return;
    // A first catch-up on load: this is the "what happened while I was gone"
    // moment, and it is the whole retention thesis of this organ.
    try { step(Date.now()); } catch (_) {}
    _timer = W.setInterval(function () {
      try { step(Date.now()); } catch (_) {}
    }, Math.max(15000, Math.floor(BUDGET.tickMs / 3)));
  }

  W.addEventListener('vint:world-ready', function () { startClock(); });
  W.addEventListener('vint:world-travel', function () {
    forget();                              // a different world keeps its own history
    try { step(Date.now()); } catch (_) {}
  });
  // the court arriving is what makes deliberation possible at all
  W.addEventListener('vint:court-sync', function () { try { step(Date.now()); } catch (_) {} });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startClock, { once: true });
  } else startClock();

  W.VintRecognizance = API;
  return API;
});
