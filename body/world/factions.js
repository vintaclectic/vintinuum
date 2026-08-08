// factions.js — THE ALLEGIANCE ORGAN. (AETHERHOLD, world-forger, 2026-08-08)
//
// ════════════════════════════════════════════════════════════════════════════
// ORGAN 4. The Concord gave the world a GOVERNMENT (one polity — yours, with
// seats your agents hold and motions they vote on). The Admiralty gave it WAR
// (hulls your court builds, wakes that resolve on the clock). Between them sat
// a hole big enough to see through: your polity had nobody to stand WITH, and
// nothing to stand ON. A rival was minted per-sortie from a seed and evaporated
// the moment the wake resolved. You could win a war and own nothing afterward.
//
// THIS FILE IS THE CONNECTIVE TISSUE: who stands with whom, and what ground
// that standing holds.
//
// ── THE INVENTION (1): ALLEGIANCE IS A RELATION, NOT AN ATTRIBUTE ───────────
// Every faction system ever shipped stores allegiance on the FACTION:
//   drift.allies = ['sill']   ·   sill.enemies = ['drift']
// Two rows, two writers, and the bug is inevitable — Drift thinks it's allied
// with Sill while Sill thinks it's at war, because something wrote one row and
// not the other. Every shipped game has had this bug. It is not a discipline
// problem; it is a SHAPE problem.
//
// Here, allegiance is not stored on either side. It is stored ON THE PAIR, in
// one row, under a key that is IDENTICAL no matter which order you name them:
//
//   pairKey('drift','sill') === pairKey('sill','drift') === 'drift|sill'
//
// There is exactly ONE row for {drift, sill}. `stanceBetween(a,b)` reads that
// one row from either direction. A one-way state is not "prevented by careful
// code" — it is UNREPRESENTABLE. You cannot write an asymmetric allegiance into
// this store because there is no second place to write it. That is the whole
// design, and it is why acceptance test 2 ("readable from BOTH sides") is not a
// test of a code path but a test of an identity.
//
// ── THE INVENTION (2): WAR SUPERSEDES BY TRANSITION, NOT BY CLEANUP ─────────
// The naive version declares war by pushing to `enemies` and then remembering
// to splice `allies`. Forget the splice once, and you're allied AND at war.
// Here the pair holds ONE `stance` field over a closed set — neutral · truce ·
// ally · war — and `setStance()` is the only writer. Declaring war does not
// "remove the alliance"; it MOVES the single field. Allied-and-at-war is not a
// bug that is guarded against, it is a state that has no room to exist in.
//
// And the transition carries the world's memory with it: an alliance that
// breaks into war leaves `broke: true` on the pair, permanently. A faction you
// betrayed remembers it forever, and it is priced — a betrayed rival fights
// harder (see `grudgeOf`). Nothing here is a hidden difficulty knob; every
// modifier is legible in the sheet, in the world's own voice.
//
// ── THE INVENTION (3): TERRITORY IS THE STAKE, AND IT IS PERSISTENT ─────────
// A war with nothing on the table is a fireworks show. The HOLDS are named
// ground — six places with real characters — and each has exactly ONE owner at
// a time, recorded in the same store the HUD reads. Win a war and the ground
// CHANGES HANDS and stays changed across reloads, sessions, and tabs. That is
// the first thing in this world a player can lose that they will still be
// missing tomorrow, and it is the reason any of this has stakes.
//
// Territory is the retention engine: you do not come back to a streak counter,
// you come back because the Drift holds a shore that was yours on Tuesday.
//
// ── WHAT IT DOES NOT DO (THE HONEST PART) ──────────────────────────────────
// There is NO private combat model in this file. Not one die roll. A war is
// resolved by handing the Admiralty's OWN wake mechanism two hulls and reading
// its line — `VintAdmiralty.wageWar()`. If the Admiralty's balance changes, this
// file's wars change with it, automatically, because there is nothing here to
// keep in sync. Two combat models is how you get two games that disagree about
// who won.
//
// Likewise there is no second treasury (the Concord owns the balance and lends
// `spend`/`credit`), no second karma spine (`impress` presses the same seven
// tags), no second roster (the Court owns agents), and no second ladder (ascent
// standing gates what a polity may declare). One of each, everywhere.
//
// SERVER: there is no /api/world/factions endpoint. This file does not fake one
// and does not swallow a failure. It is explicitly, visibly LOCAL — state lives
// in localStorage under vint:factions:<worldId>, shaped exactly like the POST
// body a future endpoint would take, so that endpoint is a sync layer and not a
// rewrite.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — a lost war takes GROUND, never an agent, never a hull
//    the user named, never anything the user made. Every hold is winnable back;
//    nothing is ever permanently gone. There is no timer that punishes absence,
//    no decay while you sleep, and no faction can take a hold you are not at
//    war with. If a user read this file they would find no trap in it.
//  2 INVESTMENT (HELIOS) — the map of who-stands-with-whom is composed by YOUR
//    choices against powers whose dispositions are derived from YOUR charter
//    and YOUR court. Nobody else's diplomatic map is yours, because nobody
//    else's Concord is. Switching cost earned as history, not as a lock.
//  3 TIER (FRUGAL-MAX) — gated on ASCENT STANDING, not on a tier this page
//    cannot read. world.html loads no entitlement source (concord.js records
//    the same finding); a faked entitlement check is worse than none. The pact
//    cap is isolated in ONE function (`pactCap`) shaped as min(byStanding,
//    byTier) for the day a real source exists. The honest paid hook this is
//    built to carry is cross-world treaties, which needs the endpoint anyway.
//  4 AESTHETICALLY DENSE (LUNEX) — the world's voice, lowercase, Cormorant. A
//    war's outcome is one sentence naming the hold and the frame that decided
//    it. No filler anywhere.
//  5 THE OPEN LOOP (MORRISON) — a war is DECLARED and resolves on the clock,
//    not on your presence. You close the tab with a hold contested and come
//    back to find out whether the ground is still yours. The loop is made of
//    territory you can lose, which is unfinished meaning with an address.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_factions', killable in 30s
//    (?factions=0). Every stance change is written to a legible ledger with a
//    reason. The resentment signal is `sue for peace`, always available, always
//    one tap, never punished.
//  7 MORE ALIVE (YUNA) — the world stops being a clearing you decorate and
//    becomes a place with neighbours who have opinions about you. A power that
//    remembers you betrayed it is more alive than one that resets each session.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// ZERO fixed elements of its own. Not one. It uses exactly the two extension
// points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — a FLOW CHILD of #dvRail; the rail allocates
//     the slot and re-measures. Nothing pinned, no offset literal in this file.
//   · registerSheet() + openSheet() — joins the one-open-at-a-time registry, so
//     raising it EVICTS the star-map, agents, court, lanterns, Concord and the
//     Admiralty rather than mounting on their identical pixels.
// The sheet carries the shared `.dv-sheet` class, which matters twice: it
// inherits ONE definition of how tall a bottom sheet may be, and layoutRail()'s
// `.dv-sheet.open` yield picks it up automatically so the rail clears it the
// day this ships.
// Every string that can be long — a faction name, a hold's name, a creed — is
// min-width:0 + ellipsis inside its own cell, or overflow-wrap:anywhere.
// Content yields; the box never grows. Proven at 320px, the width where a
// two-name row has the least room to be wrong.
//
// UNTRUSTED CONTENT — agent names come from user input and provider metadata.
// This file NEVER concatenates one into innerHTML. Static markup only; every
// name and authored string enters through textContent, at the leaf.
//
// HEADLESS — the model half of this file (pairKey, setStance, holds, resolve)
// runs with no DOM at all, so scripts/verify-factions.js can prove the five
// acceptance criteria against the REAL code rather than a re-implementation of
// it. See the `module.exports` tail.
// ════════════════════════════════════════════════════════════════════════════
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (W) {
  'use strict';

  var HAS_DOM = typeof document !== 'undefined' && !!(document && document.createElement);
  if (HAS_DOM && W.VintFactions) return W.VintFactions;

  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function concord() { return W.VintConcord; }
  function admiralty() { return W.VintAdmiralty; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_factions'. Killable in 30s, no deploy. ───────────
  //   ?factions=0 / ?factions=1  ·  localStorage vint:flag:world_factions='0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('factions') === '0') _flag = false;
      else if (q.get('factions') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_factions') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE STANCES — a closed set, and the reason "allied and at war" cannot exist.
  //
  // ONE field on ONE pair row holds exactly one of these. There is no second
  // list to fall out of sync with. Ordered by escalation so a UI can render the
  // ladder without a lookup table.
  // ═══════════════════════════════════════════════════════════════════════════
  var STANCES = [
    { k: 'war',     n: 'at war',    glyph: '⚔', c: '#ff7a6a', rank: 0,
      say: 'ground is on the table between you.' },
    { k: 'neutral', n: 'neutral',   glyph: '·', c: '#9aa7b8', rank: 1,
      say: 'you know of each other. nothing more.' },
    { k: 'truce',   n: 'in truce',  glyph: '◑', c: '#ffd479', rank: 2,
      say: 'the swords are down. the ledger is not closed.' },
    { k: 'ally',    n: 'allied',    glyph: '◈', c: '#9fdcff', rank: 3,
      say: 'their hulls answer when yours are called.' }
  ];
  function stanceOf(k) {
    for (var i = 0; i < STANCES.length; i++) if (STANCES[i].k === k) return STANCES[i];
    return STANCES[1];
  }
  var STANCE_KEYS = STANCES.map(function (s) { return s.k; });

  // ═══════════════════════════════════════════════════════════════════════════
  // THE POWERS — the world's standing factions.
  //
  // The three UNALIGNED powers the Admiralty already mints rivals from (the
  // Drift, the Sill, the Span) are LIFTED HERE AS FIRST-CLASS FACTIONS rather
  // than re-invented, because a rival that evaporates when a wake resolves is
  // exactly the hole this organ fills. Same keys, same creeds, same leans — so
  // the power you fight in the yard is the power you hold ground against here.
  // Your own Concord joins this set as the faction keyed 'concord', built from
  // whatever charter you actually adopted. One roster of powers, never two.
  // ═══════════════════════════════════════════════════════════════════════════
  var POWERS = [
    { k: 'drift', n: 'the Drift', glyph: '≋', c: '#c9a5ff', el: 'air',
      creed: 'nobody chartered them and nobody can find their yard.',
      lean: { craft: 0.3, criminal: 0.4, heat: 0.5, trust: -0.4, civic: -0.3, social: 0.1, mentor: -0.2 } },
    { k: 'sill', n: 'the Sill', glyph: '≈', c: '#7fd7c4', el: 'sea',
      creed: 'they hold a shore that was never voted on.',
      lean: { craft: 0.5, civic: 0.4, trust: 0.2, heat: 0.1, mentor: 0.2, social: -0.1, criminal: 0.1 } },
    { k: 'span', n: 'the Span', glyph: '⌗', c: '#ffb877', el: 'land',
      creed: 'they build across ground nobody claimed, and then they claim it.',
      lean: { craft: 0.6, civic: 0.5, trust: 0.3, mentor: 0.3, heat: -0.1, social: 0.2, criminal: -0.1 } }
  ];
  var SELF = 'concord';   // the reserved key for the player's own polity

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HOLDS — named ground, six of them, each with exactly one owner.
  //
  // Not tiles on a grid. Six PLACES with characters, because a player will
  // fight to keep somewhere they can picture and will not fight for hex 14,7.
  // `yields` is what holding it does — and every one of them is a real read by
  // some other organ, never a decorative number:
  //   · lumen  — credited to the Concord's ONE treasury on resolve
  //   · berth  — the Admiralty reads it as yard capacity
  //   · tag    — a standing press on the seven-tag karma spine
  // `el` is the element a war over this ground is fought in, which is why WHERE
  // you fight decides WHAT kind of fleet wins — with no matchup table anywhere.
  // ═══════════════════════════════════════════════════════════════════════════
  var HOLDS = [
    { k: 'quay', n: 'the Low Quay', glyph: '⚓', el: 'sea', seat: 'sill',
      of: 'a working shore. every hull that ever came home came home here.',
      yields: { lumen: 14, tag: { craft: 0.3, civic: 0.2 } } },
    { k: 'ridge', n: 'the Ridge Road', glyph: '⌇', el: 'land', seat: 'span',
      of: 'the only ground a heavy thing can cross. whoever holds it sets the toll.',
      yields: { lumen: 18, tag: { civic: 0.3, trust: 0.2 } } },
    { k: 'thermals', n: 'the Thermals', glyph: '≋', el: 'air', seat: 'drift',
      of: 'nothing is built here. things arrive first from here.',
      yields: { lumen: 10, tag: { heat: 0.3, criminal: 0.2 } } },
    { k: 'foundry', n: 'the Cold Foundry', glyph: '⧉', el: 'land', seat: null,
      of: 'someone laid keels here once and left the jigs standing.',
      yields: { lumen: 12, berth: 1, tag: { craft: 0.4 } } },
    { k: 'shoal', n: 'the Long Shoal', glyph: '≈', el: 'sea', seat: null,
      of: 'shallow, unlit, and every chart of it disagrees with every other.',
      yields: { lumen: 8, tag: { criminal: 0.3, heat: 0.2 } } },
    { k: 'lamps', n: 'the Lamp Line', glyph: '❋', el: 'air', seat: null,
      of: 'a row of lights someone keeps burning. nobody remembers who started.',
      yields: { lumen: 9, tag: { mentor: 0.3, social: 0.3, trust: 0.2 } } }
  ];
  function holdOf(k) {
    for (var i = 0; i < HOLDS.length; i++) if (HOLDS[i].k === k) return HOLDS[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PAIR KEY — the single line this entire organ's correctness rests on.
  //
  // Order-independent by construction: the two names are SORTED before joining.
  // pairKey('a','b') and pairKey('b','a') are the same string, always, so there
  // is exactly one row per pair and a one-way allegiance has nowhere to live.
  // A pair with itself is meaningless and is rejected rather than stored.
  // ═══════════════════════════════════════════════════════════════════════════
  function pairKey(a, b) {
    var x = String(a || ''), y = String(b || '');
    if (!x || !y || x === y) return null;
    return (x < y) ? (x + '|' + y) : (y + '|' + x);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — local, per-world, shaped like the request a server would take.
  // ═══════════════════════════════════════════════════════════════════════════
  var WAR_MS = 12 * 60 * 1000;         // a war sits open twelve minutes
  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:factions:' + wid(); }

  var _st = null, _stKey = null;

  function blank() {
    var s = {
      v: 1,
      // THE FACTION REGISTER — every power that exists in this world, by key.
      // The player's own polity is registered lazily from the Concord's charter
      // (see syncSelf) so it is never a second copy of a charter.
      powers: {},
      // THE PAIR LEDGER — the one and only place allegiance lives.
      //   'drift|sill': { stance, since, why, broke, wars }
      pairs: {},
      // THE GROUND REGISTER — hold key -> owner faction key. The store the HUD
      // reads, and the store a war resolution writes.
      ground: {},
      // OPEN WARS — a declaration with a clock on it and a hold on the table.
      wars: [],
      // THE LEDGER — every stance change and every transfer, newest first.
      log: [],
      seen: 0
    };
    // Seed the world's standing powers and the ground they hold at the start.
    for (var i = 0; i < POWERS.length; i++) {
      var p = POWERS[i];
      s.powers[p.k] = { k: p.k, name: p.n, creed: p.creed, glyph: p.glyph, c: p.c, el: p.el, members: [], world: true };
    }
    for (var h = 0; h < HOLDS.length; h++) s.ground[HOLDS[h].k] = HOLDS[h].seat || null;
    return s;
  }

  function migrate(p) {
    // Defensive: a partial or older blob must never crash a render, and must
    // never silently drop the ground register (which is the persistent stake).
    var b = blank();
    if (!p || typeof p !== 'object') return b;
    if (!p.powers || typeof p.powers !== 'object') p.powers = b.powers;
    else for (var pk in b.powers) if (!p.powers[pk]) p.powers[pk] = b.powers[pk];
    if (!p.pairs || typeof p.pairs !== 'object') p.pairs = {};
    if (!p.ground || typeof p.ground !== 'object') p.ground = b.ground;
    else for (var hk in b.ground) if (!(hk in p.ground)) p.ground[hk] = b.ground[hk];
    if (!Array.isArray(p.wars)) p.wars = [];
    if (!Array.isArray(p.log)) p.log = [];
    if (!p.seen) p.seen = 0;
    // Every member list must be an array — a corrupt one would break recruit().
    for (var k2 in p.powers) {
      if (!p.powers[k2] || typeof p.powers[k2] !== 'object') { delete p.powers[k2]; continue; }
      if (!Array.isArray(p.powers[k2].members)) p.powers[k2].members = [];
    }
    return p;
  }

  function load() {
    var k = key();
    if (_st && _stKey === k) return _st;
    _stKey = k; _st = blank();
    try {
      var raw = localStorage.getItem(k);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.v === 1) _st = migrate(p);
      }
    } catch (_) { _st = blank(); }
    return _st;
  }

  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // A quota failure is the one write error a user can actually hit, and
      // swallowing it would let them wage war into a void. Say it out loud.
      try { console.warn('[factions] could not keep the ground:', e && e.message); } catch (_) {}
      toast('the map is full — your device would not keep this.');
    }
  }

  // Drop the memo so the next load() re-reads localStorage from scratch. This
  // is what acceptance test 5 exercises: a genuine reload, not a copy of state.
  function forget() { _st = null; _stKey = null; }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE REGISTER — creating and joining factions.
  // ═══════════════════════════════════════════════════════════════════════════

  // Your own polity mirrored in as a faction, from the Concord's ACTUAL charter.
  // It is a projection, never a second copy: name/creed/colour are re-read every
  // time so amending the charter moves the faction with it.
  function syncSelf() {
    var c = concord();
    if (!c || !c.founded || !c.founded()) return null;
    var s = load(), ch = null, st = null;
    try { ch = c.charter(); st = c.state(); } catch (_) {}
    if (!ch) return null;
    var row = s.powers[SELF] || { k: SELF, members: [], world: false };
    row.name = (st && st.name) || ch.name;
    row.creed = ch.creed;
    row.glyph = ch.glyph;
    row.c = ch.c;
    row.charter = ch.k;
    row.self = true;
    // The bench IS the membership. The Court owns agents; this never copies one.
    var mem = [];
    try {
      var b = c.bench() || [];
      for (var i = 0; i < b.length; i++) {
        mem.push({ id: String(b[i].seat.agentId), name: (b[i].agent && b[i].agent.name) || 'a hand', role: b[i].seat.role });
      }
    } catch (_) {}
    row.members = mem;
    s.powers[SELF] = row;
    return row;
  }

  // create(key, name, opts) — register a faction. Idempotent on key: creating a
  // faction that exists updates its face rather than minting a duplicate, which
  // is the behaviour any sane caller (including a future server sync) wants.
  function create(k, name, opts) {
    var s = load();
    var kk = String(k || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!kk) return { ok: false, why: 'key' };
    var o = opts || {};
    var row = s.powers[kk] || { k: kk, members: [], world: false };
    row.name = String(name || row.name || kk);
    row.creed = String(o.creed || row.creed || 'they have not said what they are for.');
    row.glyph = String(o.glyph || row.glyph || '◆');
    row.c = String(o.c || row.c || '#9fdcff');
    row.el = String(o.el || row.el || 'land');
    if (!Array.isArray(row.members)) row.members = [];
    s.powers[kk] = row;
    save();
    return { ok: true, faction: JSON.parse(JSON.stringify(row)) };
  }

  // recruit(key, member) — membership. A member is {id, name, role}; the id is
  // the only field that identifies, so re-recruiting the same id updates rather
  // than duplicating. An agent may stand in exactly one faction at a time — the
  // whole point of allegiance is that it is exclusive — so recruiting from
  // elsewhere MOVES them and says so in the ledger.
  function recruit(k, member) {
    var s = load();
    var f = s.powers[String(k || '')];
    if (!f) return { ok: false, why: 'no-faction' };
    var m = member || {};
    var id = String(m.id != null ? m.id : (m.name || ''));
    if (!id) return { ok: false, why: 'no-member' };
    var from = null;
    for (var pk in s.powers) {
      var arr = s.powers[pk].members || [];
      for (var i = arr.length - 1; i >= 0; i--) {
        if (String(arr[i].id) === id) {
          if (pk === f.k) { arr.splice(i, 1); }   // updating in place below
          else { arr.splice(i, 1); from = pk; }
        }
      }
    }
    f.members.push({ id: id, name: String(m.name || id), role: String(m.role || 'a hand'), joined: Date.now() });
    if (from) {
      note(s, 'stand', (s.powers[from] ? s.powers[from].name : from) + ' → ' + f.name,
        String(m.name || id) + ' stands with ' + f.name + ' now.');
    }
    save();
    return { ok: true, from: from, members: f.members.length };
  }

  function membersOf(k) {
    var s = load(), f = s.powers[String(k || '')];
    return f ? JSON.parse(JSON.stringify(f.members || [])) : [];
  }
  function factions() {
    syncSelf();
    var s = load(), out = [];
    for (var k in s.powers) out.push(JSON.parse(JSON.stringify(s.powers[k])));
    out.sort(function (a, b) { return (b.self ? 1 : 0) - (a.self ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
    return out;
  }
  function faction(k) {
    var s = load(), f = s.powers[String(k || '')];
    return f ? JSON.parse(JSON.stringify(f)) : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PAIR LEDGER — the one writer, and the reason no state can be one-way.
  // ═══════════════════════════════════════════════════════════════════════════

  function pairRow(s, a, b, make) {
    var pk = pairKey(a, b);
    if (!pk) return null;
    if (!s.pairs[pk] && make) s.pairs[pk] = { stance: 'neutral', since: Date.now(), why: '', broke: false, wars: 0 };
    return s.pairs[pk] || null;
  }

  // stanceBetween(a, b) — reads the ONE row. Argument order cannot matter,
  // because pairKey sorted the names before either of them was looked up.
  function stanceBetween(a, b) {
    var s = load();
    var r = pairRow(s, a, b, false);
    return r ? r.stance : 'neutral';
  }

  // pair(a, b) — the full relation, from either direction, deep-copied.
  function pair(a, b) {
    var s = load(), pk = pairKey(a, b);
    if (!pk) return null;
    var r = s.pairs[pk] || { stance: 'neutral', since: 0, why: '', broke: false, wars: 0 };
    return { key: pk, a: String(a), b: String(b), stance: r.stance, since: r.since, why: r.why, broke: !!r.broke, wars: r.wars || 0 };
  }

  // setStance — THE ONLY WRITER of allegiance in this entire codebase.
  //
  // It MOVES one field on one row. Declaring war does not "remove" an alliance;
  // there is no list to remove from. That is what makes allied-and-at-war
  // unrepresentable rather than merely guarded-against.
  function setStance(a, b, next, why) {
    if (STANCE_KEYS.indexOf(next) < 0) return { ok: false, why: 'stance' };
    var pk = pairKey(a, b);
    if (!pk) return { ok: false, why: 'pair' };
    var s = load();
    var r = pairRow(s, a, b, true);
    var prev = r.stance;
    if (prev === next) return { ok: true, changed: false, stance: next };

    // THE BETRAYAL MARK. An alliance that breaks into war is remembered on the
    // pair, permanently, and it is priced later in grudgeOf(). This is the one
    // piece of world memory that a stance change can never erase — peace can be
    // made, but it cannot un-happen.
    if (prev === 'ally' && next === 'war') r.broke = true;
    if (next === 'war') r.wars = (r.wars || 0) + 1;

    r.stance = next;
    r.since = Date.now();
    r.why = String(why || '');
    var na = nameOf(s, a), nb = nameOf(s, b);
    note(s, next, na + ' · ' + nb, sentenceFor(prev, next, na, nb, r.broke));
    save();
    emit('vint:factions-stance', { a: String(a), b: String(b), from: prev, to: next });
    if (isOpen()) render();
    updateLauncher();
    return { ok: true, changed: true, from: prev, stance: next, broke: !!r.broke };
  }

  // The named verbs. Each is `setStance` with a reason, so no caller anywhere
  // ever writes a stance string by hand.
  function ally(a, b, why) { return setStance(a, b, 'ally', why || 'a pact was signed.'); }
  function declareWar(a, b, why) {
    // War supersedes ANY prior stance — including an alliance — by moving the
    // single field. There is no cleanup step to forget.
    var res = setStance(a, b, 'war', why || 'the ground would not be shared.');
    if (!res.ok) return res;
    res.broke = !!(pair(a, b) || {}).broke;
    return res;
  }
  function truce(a, b, why) { return setStance(a, b, 'truce', why || 'the swords went down.'); }
  function neutral(a, b, why) { return setStance(a, b, 'neutral', why || 'they went their ways.'); }

  function nameOf(s, k) {
    var f = s.powers[String(k || '')];
    return f ? f.name : String(k || 'someone');
  }
  function sentenceFor(prev, next, na, nb, broke) {
    if (next === 'war' && broke) return na + ' and ' + nb + ' were allies. that is over, and it is remembered.';
    if (next === 'war') return na + ' and ' + nb + ' are at war.';
    if (next === 'ally') return na + ' and ' + nb + ' stand together.';
    if (next === 'truce') return na + ' and ' + nb + ' put the swords down.';
    return na + ' and ' + nb + ' went their separate ways.';
  }
  function note(s, kind, head, line) {
    s.log.unshift({ at: Date.now(), kind: kind, head: String(head), line: String(line) });
    while (s.log.length > 40) s.log.pop();
  }
  function emit(name, detail) {
    try { if (W.dispatchEvent) W.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (_) {}
  }

  // allies / enemies — DERIVED, never stored. This is the payoff of the pair
  // ledger: these lists cannot disagree with each other because neither exists
  // until somebody asks, and both read the same rows.
  function relationsOf(k) {
    var s = load(), me = String(k || ''), out = { ally: [], war: [], truce: [], neutral: [] };
    for (var pk in s.pairs) {
      var parts = pk.split('|');
      var other = (parts[0] === me) ? parts[1] : (parts[1] === me ? parts[0] : null);
      if (!other) continue;
      var st = s.pairs[pk].stance;
      if (out[st]) out[st].push(other);
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE GROUND — territory as persistent world state.
  // ═══════════════════════════════════════════════════════════════════════════
  function ownerOf(holdKey) {
    var s = load();
    return s.ground[String(holdKey || '')] || null;
  }
  function territory(k) {
    var s = load(), me = String(k || ''), out = [];
    for (var hk in s.ground) if (s.ground[hk] === me) out.push(hk);
    return out;
  }
  function ground() {
    var s = load();
    return JSON.parse(JSON.stringify(s.ground));
  }
  // The HUD's read: every hold with its owner resolved to a face, in one call,
  // so no surface anywhere re-walks two stores to draw a map.
  function map() {
    var s = load();
    syncSelf();
    return HOLDS.map(function (h) {
      var ow = s.ground[h.k] || null;
      var f = ow ? s.powers[ow] : null;
      return {
        k: h.k, name: h.n, glyph: h.glyph, el: h.el, of: h.of, yields: h.yields,
        owner: ow, ownerName: f ? f.name : null, ownerColor: f ? f.c : null, mine: ow === SELF
      };
    });
  }

  // cede(hold, to, why) — THE ONLY WRITER of the ground register. A transfer
  // always goes through here, so every change is logged and every change fires
  // the same event the HUD listens on. There is no second path.
  function cede(holdKey, to, why) {
    var s = load(), h = holdOf(holdKey);
    if (!h) return { ok: false, why: 'no-hold' };
    var dest = to == null ? null : String(to);
    // SYNC SELF FIRST. The player's own polity is registered LAZILY off the
    // Concord's charter (syncSelf), so on a path where nothing has yet asked
    // for the map or the register — a war that resolves on the clock while the
    // sheet has never been opened — `powers[SELF]` does not exist yet and this
    // function would refuse to hand the player ground they just WON, with
    // {why:'no-faction'}. The win would be announced and the ground would not
    // move: the single worst failure this organ can have, and a silent one.
    // One call, here, in the ONLY writer of the ground register, closes it.
    if (dest === SELF && !s.powers[SELF]) syncSelf();
    if (dest && !s.powers[dest]) return { ok: false, why: 'no-faction' };
    var from = s.ground[h.k] || null;
    if (from === dest) return { ok: true, changed: false, owner: dest };
    s.ground[h.k] = dest;
    note(s, 'ground', h.n,
      (dest ? nameOf(s, dest) : 'nobody') + ' holds ' + h.n + ' now' +
      (from ? ' — it was ' + nameOf(s, from) + "'s." : '.'));
    save();
    emit('vint:factions-ground', { hold: h.k, from: from, to: dest, why: String(why || '') });
    if (isOpen()) render();
    updateLauncher();
    return { ok: true, changed: true, from: from, owner: dest };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAR — declared here, FOUGHT BY THE ADMIRALTY, resolved onto the ground.
  //
  // There is deliberately no combat math in this section. `campaign()` puts a
  // named hold on the table and starts a clock; `resolveCampaign()` hands the
  // Admiralty two hulls and reads its line. If no Admiralty is present (flag
  // off, or a headless proof that never loaded it) the campaign does NOT invent
  // a battle — it says so and stands down, which is the honest failure.
  // ═══════════════════════════════════════════════════════════════════════════

  // A betrayed power fights harder. Legible, stated in the sheet, never hidden.
  function grudgeOf(a, b) {
    var p = pair(a, b);
    if (!p) return 0;
    var g = 0;
    if (p.broke) g += 0.22;                       // you were allies once
    g += Math.min(0.18, Math.max(0, (p.wars || 1) - 1) * 0.06);   // and it keeps happening
    return Math.round(g * 100) / 100;
  }

  // pactCap — how many pacts (alliances + truces) a polity may hold at once.
  // Gated on ASCENT STANDING, the one ladder the server actually computes and
  // no client can forge. Shaped as min(byStanding, byTier) for the day a real
  // entitlement source exists on this page; byTier is Infinity until then, and
  // is NOT faked (a faked entitlement check is worse than none — concord.js
  // records the same finding at its seatCap).
  function pactCap() {
    var st = 0;
    try { var c = concord(); if (c && c.standing) st = c.standing() || 0; } catch (_) {}
    var byStanding = st >= 150 ? 5 : st >= 60 ? 3 : st >= 18 ? 2 : 1;
    var byTier = Infinity;
    return Math.min(byStanding, byTier);
  }
  function pactCount() {
    var r = relationsOf(SELF);
    return r.ally.length + r.truce.length;
  }

  // campaign(against, holdKey) — put ground on the table. Requires the pair to
  // be AT WAR, which is the point: you cannot take ground from someone you are
  // not at war with, so no hold ever moves without a declaration behind it.
  function campaign(against, holdKey, opts) {
    var s = load();
    var foe = String(against || '');
    if (!s.powers[foe]) return { ok: false, why: 'no-faction' };
    if (stanceBetween(SELF, foe) !== 'war') return { ok: false, why: 'not-at-war' };
    var h = holdOf(holdKey);
    if (!h) return { ok: false, why: 'no-hold' };
    var own = s.ground[h.k] || null;
    // You may march on ground the foe holds, or on unheld ground — never on a
    // third party's ground you are not at war with. One declaration, one target.
    if (own && own !== foe && own !== SELF) return { ok: false, why: 'not-theirs' };
    for (var i = 0; i < s.wars.length; i++) if (!s.wars[i].done) return { ok: false, why: 'sailing' };
    var o = opts || {};
    var w = {
      id: 'w' + Date.now().toString(36),
      foe: foe, hold: h.k, from: own,
      opened: Date.now(),
      closes: Date.now() + (o.ms != null ? Number(o.ms) : WAR_MS),
      hullIds: Array.isArray(o.hullIds) ? o.hullIds.slice(0, 4) : null,
      done: false
    };
    s.wars.unshift(w);
    while (s.wars.length > 20) s.wars.pop();
    note(s, 'march', h.n, 'a march opens on ' + h.n + '. ' + nameOf(s, foe) + ' holds the other end of it.');
    save();
    emit('vint:factions-campaign', { id: w.id, foe: foe, hold: h.k });
    if (isOpen()) render();
    updateLauncher();
    return { ok: true, campaign: JSON.parse(JSON.stringify(w)) };
  }

  // resolveCampaign — hands the fight to the Admiralty and writes only the
  // CONSEQUENCE. `VintAdmiralty.wageWar(...)` returns the wake's own line; this
  // file never scores anything itself.
  function resolveCampaign(force) {
    var s = load();
    var w = null;
    for (var i = 0; i < s.wars.length; i++) if (!s.wars[i].done) { w = s.wars[i]; break; }
    if (!w) return false;
    if (!force && Date.now() < w.closes) return false;

    var h = holdOf(w.hold);
    var ad = admiralty();
    var res = null;
    if (ad && typeof ad.wageWar === 'function') {
      try {
        res = ad.wageWar({
          hullIds: w.hullIds,
          element: h ? h.el : 'land',
          seed: w.id,
          grudge: grudgeOf(SELF, w.foe),
          foe: { key: w.foe, name: nameOf(s, w.foe), creed: (s.powers[w.foe] || {}).creed || '' }
        });
      } catch (e) { res = null; }
    }
    if (!res) {
      // NO PRIVATE COMBAT MODEL. If the war organ is not here, nothing is
      // decided and the ground does not move. The march stands down and says so.
      w.done = true; w.stoodDown = true;
      w.effect = 'no fleet answered the call. the ground did not move.';
      note(s, 'march', h ? h.n : w.hold, w.effect);
      save();
      emit('vint:factions-war', { id: w.id, won: false, stoodDown: true, hold: w.hold });
      if (isOpen()) render();
      updateLauncher();
      return true;
    }

    w.done = true;
    w.won = !!res.won;
    w.score = res.score;
    w.line = res.line || [];
    w.decider = res.decider || null;

    if (res.won) {
      // THE TRANSFER — the one thing in this world that persists as a loss.
      cede(w.hold, SELF, 'taken in the march on ' + (h ? h.n : w.hold));
      var y = (h && h.yields) || {};
      var take = Math.max(8, Math.round((y.lumen || 10) * 1.5));
      try { var c = concord(); if (c && c.credit) c.credit(take, 'the ground pays'); } catch (_) {}
      try { var c2 = concord(); if (c2 && c2.impress && y.tag) c2.impress(y.tag, 0.6); } catch (_) {}
      w.effect = (h ? h.n : 'the ground') + ' is yours. ◇' + take + ' comes off it' +
        (w.decider && w.decider.say ? ' — ' + w.decider.say : '.');
    } else {
      // A LOST MARCH NEVER TAKES A HOLD YOU ALREADY OWNED unless it was the one
      // you marched from — you cannot be punished on ground you did not put on
      // the table. If you marched on ground you already held, you lose it to the
      // foe; otherwise the ground simply stays where it was.
      if (w.from === SELF) {
        cede(w.hold, w.foe, 'lost in the march on ' + (h ? h.n : w.hold));
        w.effect = (h ? h.n : 'the ground') + ' is theirs now. it was yours this morning.';
      } else {
        w.effect = 'the line did not hold. ' + (h ? h.n : 'the ground') + ' stays where it was.';
      }
      try { var c3 = concord(); if (c3 && c3.impress) c3.impress({ heat: 0.4, trust: -0.2 }, 0.4); } catch (_) {}
    }
    note(s, w.won ? 'won' : 'lost', h ? h.n : w.hold, w.effect);
    save();
    emit('vint:factions-war', { id: w.id, won: !!w.won, hold: w.hold, effect: w.effect });
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  function resolve() { return resolveCampaign(false); }
  function openCampaign() {
    var s = load();
    for (var i = 0; i < s.wars.length; i++) if (!s.wars[i].done) return JSON.parse(JSON.stringify(s.wars[i]));
    return null;
  }

  // sue for peace — always available, always one tap, never punished. This is
  // the resentment signal test 6 names: if people mash it, the war design is
  // wrong and we cut it regardless of what it does to session length.
  function sueForPeace(foe) {
    var s = load();
    for (var i = 0; i < s.wars.length; i++) if (!s.wars[i].done && s.wars[i].foe === String(foe)) {
      s.wars[i].done = true; s.wars[i].stoodDown = true;
      s.wars[i].effect = 'the march was called off before it cost anyone anything.';
    }
    save();
    return truce(SELF, foe, 'peace was asked for, and given.');
  }

  // dissolve — the refusal path. Everything this file made, unmade, one tap, no
  // penalty. Nothing the user made is touched, because this file never owned
  // anything the user made.
  function dissolve() {
    _st = blank(); _stKey = key();
    save();
    emit('vint:factions-ground', { hold: null, from: null, to: null, why: 'dissolved' });
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  function unread() {
    var s = load(), n = 0;
    for (var i = 0; i < s.log.length; i++) { if (s.log[i].at > (s.seen || 0)) n++; else break; }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MODEL SURFACE — everything above runs with no DOM. The DOM half below
  // is skipped entirely when there is no document, which is what lets the proof
  // exercise the REAL code instead of a re-implementation of it.
  // ═══════════════════════════════════════════════════════════════════════════
  var API = {
    enabled: enabled,
    // register
    create: create, recruit: recruit, members: membersOf, factions: factions, faction: faction,
    // the pair ledger — one row, both directions
    pairKey: pairKey, stance: stanceBetween, pair: pair, setStance: setStance,
    ally: ally, war: declareWar, declareWar: declareWar, truce: truce, neutral: neutral,
    relations: relationsOf, grudge: grudgeOf,
    // the ground
    owner: ownerOf, territory: territory, ground: ground, map: map, cede: cede,
    // war, fought elsewhere
    campaign: campaign, resolveCampaign: resolveCampaign, resolve: resolve,
    openCampaign: openCampaign, sueForPeace: sueForPeace,
    pactCap: pactCap, pactCount: pactCount,
    // lifecycle
    state: function () { return JSON.parse(JSON.stringify(load())); },
    forget: forget, dissolve: dissolve, unread: unread,
    SELF: SELF, STANCES: STANCES, HOLDS: HOLDS, POWERS: POWERS
  };

  if (!HAS_DOM) {
    // Headless stubs so the shared code paths above can call them unguarded.
    API.open = function () {}; API.close = function () {}; API.isOpen = function () { return false; };
    API.render = function () {}; API.refresh = function () {};
    // eslint-disable-next-line no-func-assign
    return API;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — scoped under #fcSheet, so nothing here can reach another surface.
  // Every rule that could grow a box has a min-width:0 or an overflow-wrap
  // beside it. No fixed positioning anywhere in this file.
  // ═══════════════════════════════════════════════════════════════════════════
  var _styled = false;
  function injectStyles() {
    if (_styled) return; _styled = true;
    var css = document.createElement('style');
    css.id = 'fcStyles';
    css.textContent = [
      '#fcSheet .fc-sec{margin:0 0 16px}',
      '#fcSheet .fc-h{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin:0 0 8px;overflow-wrap:anywhere}',
      // THE MAP — one column at 320 so two long names can never share a line.
      '#fcSheet .fc-map{display:grid;grid-template-columns:1fr;gap:8px}',
      '@media (min-width:420px){#fcSheet .fc-map{grid-template-columns:1fr 1fr}}',
      '#fcSheet .fc-hold{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;',
      'padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:12px;',
      'background:rgba(255,255,255,.028);min-width:0}',
      '#fcSheet .fc-hold .g{font-size:18px;line-height:1.1;flex:0 0 auto}',
      '#fcSheet .fc-hold .b{min-width:0}',
      '#fcSheet .fc-hold .n{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '#fcSheet .fc-hold .o{font-size:11.5px;opacity:.72;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '#fcSheet .fc-hold .d{font-size:11.5px;opacity:.5;margin-top:4px;overflow-wrap:anywhere}',
      '#fcSheet .fc-hold.mine{border-color:rgba(159,220,255,.42);background:rgba(159,220,255,.06)}',
      // THE POWERS — a stance row. Name column is min-width:0 so a long faction
      // name ellipses instead of pushing the stance pill off the edge at 320.
      '#fcSheet .fc-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;',
      'padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:12px;',
      'background:rgba(255,255,255,.028);margin:0 0 8px;min-width:0}',
      '#fcSheet .fc-row .g{font-size:17px;flex:0 0 auto}',
      '#fcSheet .fc-row .b{min-width:0}',
      '#fcSheet .fc-row .n{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '#fcSheet .fc-row .c{font-size:11.5px;opacity:.62;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '#fcSheet .fc-pill{flex:0 0 auto;font-size:11px;padding:4px 9px;border-radius:999px;',
      'border:1px solid currentColor;white-space:nowrap}',
      // ACTIONS — wrap onto their own lines rather than ever sharing a row edge.
      '#fcSheet .fc-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '#fcSheet .fc-btn{flex:0 1 auto;min-width:0;font:inherit;font-size:12px;padding:7px 11px;border-radius:10px;',
      'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:inherit;cursor:pointer;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
      '#fcSheet .fc-btn:disabled{opacity:.35;cursor:default}',
      '#fcSheet .fc-btn.war{border-color:rgba(255,122,106,.5);color:#ff9a8a}',
      '#fcSheet .fc-btn.ally{border-color:rgba(159,220,255,.5);color:#9fdcff}',
      '#fcSheet .fc-log{font-size:12px;opacity:.72;margin:0 0 6px;overflow-wrap:anywhere;line-height:1.45}',
      '#fcSheet .fc-empty{font-size:13px;opacity:.6;overflow-wrap:anywhere;line-height:1.5}',
      '#fcSheet .fc-clock{font-variant-numeric:tabular-nums}',
      '#fcSheet .fc-note{font-size:11.5px;opacity:.5;margin-top:10px;overflow-wrap:anywhere;line-height:1.5}'
    ].join('');
    document.head.appendChild(css);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET — .dv-sheet, through the one-open registry. Zero fixed elements.
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _btn = null, _beat = null, _waits = 0, _pickFoe = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'fcSheet';
    // STATIC MARKUP ONLY. Every faction name enters later via textContent.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">allegiance<small id="fcSub">who stands with you, and what ground it holds</small></div>' +
        '<button class="dv-x" id="fcX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="fcBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#fcX').onclick = close;
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
      var mu = function () { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
  }

  function isOpen() { return !!(_sheet && _sheet.classList.contains('open')); }
  function open() {
    if (!enabled()) return;
    resolve();
    var h = hud();
    if (h && h.openSheet) h.openSheet('factions', function () { build(); _sheet.classList.add('open'); render(); });
    else { build(); _sheet.classList.add('open'); render(); }
    var s = load(); s.seen = Date.now(); save();
    updateLauncher();
    clearInterval(_beat);
    _beat = setInterval(function () {
      if (!isOpen()) { clearInterval(_beat); _beat = null; return; }
      if (resolve()) { render(); return; }
      tickClock();
    }, 1000);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_beat); _beat = null;
    updateLauncher();
  }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;   // textContent at the leaf, always
    return n;
  }

  function ago(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm';
    return Math.round(m / 60) + 'h';
  }

  function tickClock() {
    if (!_sheet) return;
    var w = openCampaign(); if (!w) return;
    var n = _sheet.querySelector('.fc-clock');
    if (n) n.textContent = ago(Math.max(0, w.closes - Date.now()));
  }

  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#fcBody');
    if (!body) return;
    body.textContent = '';
    syncSelf();
    var s = load();
    var founded = false;
    try { var c = concord(); founded = !!(c && c.founded && c.founded()); } catch (_) {}

    if (!founded) {
      var e0 = el('div', 'fc-sec');
      e0.appendChild(el('div', 'fc-h', 'no standing'));
      e0.appendChild(el('div', 'fc-empty',
        'allegiance is something a polity holds. found your concord first — then there is someone here for the world to have an opinion about.'));
      body.appendChild(e0);
      return;
    }

    // ── THE GROUND ───────────────────────────────────────────────────────────
    var sec1 = el('div', 'fc-sec');
    sec1.appendChild(el('div', 'fc-h', 'the ground'));
    var grid = el('div', 'fc-map');
    map().forEach(function (h) {
      var card = el('div', 'fc-hold' + (h.mine ? ' mine' : ''));
      card.appendChild(el('div', 'g', h.glyph));
      var b = el('div', 'b');
      b.appendChild(el('div', 'n', h.name));
      var own = el('div', 'o', h.ownerName ? (h.mine ? 'yours' : h.ownerName + ' holds it') : 'nobody holds it');
      if (h.ownerColor) own.style.color = h.ownerColor;
      b.appendChild(own);
      b.appendChild(el('div', 'd', h.of));
      card.appendChild(b);
      grid.appendChild(card);
    });
    sec1.appendChild(grid);
    body.appendChild(sec1);

    // ── THE OPEN MARCH ───────────────────────────────────────────────────────
    var open_ = openCampaign();
    if (open_) {
      var sec2 = el('div', 'fc-sec');
      sec2.appendChild(el('div', 'fc-h', 'on the table'));
      var row = el('div', 'fc-row');
      row.appendChild(el('div', 'g', '⚔'));
      var rb = el('div', 'b');
      var hh = holdOf(open_.hold);
      rb.appendChild(el('div', 'n', hh ? hh.n : open_.hold));
      rb.appendChild(el('div', 'c', 'against ' + nameOf(s, open_.foe)));
      row.appendChild(rb);
      var clk = el('div', 'fc-pill fc-clock', ago(Math.max(0, open_.closes - Date.now())));
      clk.style.color = '#ff9a8a';
      row.appendChild(clk);
      sec2.appendChild(row);
      var acts = el('div', 'fc-acts');
      var peace = el('button', 'fc-btn', 'sue for peace');
      peace.onclick = function () { sueForPeace(open_.foe); toast('the march is called off.'); render(); };
      acts.appendChild(peace);
      sec2.appendChild(acts);
      body.appendChild(sec2);
    }

    // ── THE POWERS ───────────────────────────────────────────────────────────
    var sec3 = el('div', 'fc-sec');
    sec3.appendChild(el('div', 'fc-h', 'the powers'));
    var cap = pactCap(), have = pactCount();
    factions().forEach(function (f) {
      if (f.k === SELF) return;
      var st = stanceOf(stanceBetween(SELF, f.k));
      var p = pair(SELF, f.k);
      var row2 = el('div', 'fc-row');
      var g2 = el('div', 'g', f.glyph || '◆');
      if (f.c) g2.style.color = f.c;
      row2.appendChild(g2);
      var b2 = el('div', 'b');
      b2.appendChild(el('div', 'n', f.name));
      b2.appendChild(el('div', 'c', (p && p.broke) ? 'they remember what you did.' : (f.creed || '')));
      row2.appendChild(b2);
      var pill = el('div', 'fc-pill', st.n);
      pill.style.color = st.c;
      row2.appendChild(pill);
      sec3.appendChild(row2);

      var acts2 = el('div', 'fc-acts');
      if (st.k !== 'ally') {
        var bA = el('button', 'fc-btn ally', 'seek a pact');
        bA.disabled = have >= cap && st.k !== 'truce';
        bA.onclick = function () {
          if (pactCount() >= pactCap()) { toast('your standing holds no more pacts than this.'); return; }
          ally(SELF, f.k); toast(f.name + ' stands with you.'); render();
        };
        acts2.appendChild(bA);
      }
      if (st.k !== 'war') {
        var bW = el('button', 'fc-btn war', 'declare war');
        bW.onclick = function () { declareWar(SELF, f.k); toast('it is war with ' + f.name + '.'); render(); };
        acts2.appendChild(bW);
      } else if (!open_) {
        // march on a named hold — one button per hold that is on the table
        map().forEach(function (h) {
          if (h.owner && h.owner !== f.k && h.owner !== SELF) return;
          var bM = el('button', 'fc-btn', 'march on ' + h.name);
          bM.onclick = function () {
            var r = campaign(f.k, h.k);
            if (!r.ok) { toast(r.why === 'sailing' ? 'one march at a time.' : 'that ground is not on the table.'); return; }
            toast('the march on ' + h.name + ' opens.'); render();
          };
          acts2.appendChild(bM);
        });
        var bT = el('button', 'fc-btn', 'sue for peace');
        bT.onclick = function () { sueForPeace(f.k); render(); };
        acts2.appendChild(bT);
      }
      if (acts2.childNodes.length) sec3.appendChild(acts2);
    });
    sec3.appendChild(el('div', 'fc-note', 'your standing holds ' + cap + ' pact' + (cap === 1 ? '' : 's') + ' at once. ' + have + ' held.'));
    body.appendChild(sec3);

    // ── THE LEDGER ───────────────────────────────────────────────────────────
    var sec4 = el('div', 'fc-sec');
    sec4.appendChild(el('div', 'fc-h', 'the ledger'));
    if (!s.log.length) {
      sec4.appendChild(el('div', 'fc-empty', 'nothing has been decided between anyone yet.'));
    } else {
      s.log.slice(0, 12).forEach(function (l) {
        sec4.appendChild(el('div', 'fc-log', l.line));
      });
    }
    body.appendChild(sec4);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a FLOW CHILD of the rail. Zero fixed elements, zero offsets.
  // ═══════════════════════════════════════════════════════════════════════════
  function canShow() {
    if (!enabled() || isGuest()) return false;
    try {
      var w = world();
      if (!w) return false;
      var id = w.currentWorldId ? w.currentWorldId() : null;
      if (!id || id === 'universe') return false;
      if (w.canBuild && !w.canBuild()) return false;
    } catch (_) { return false; }
    return true;
  }

  function updateLauncher() {
    if (!_btn) return;
    var show = canShow();
    _btn.style.display = show ? '' : 'none';
    var pill = _btn.querySelector('.fc-n');
    if (!pill) return;
    var n = show ? unread() : 0;
    pill.textContent = n > 9 ? '9+' : String(n);
    pill.style.display = n > 0 ? '' : 'none';
  }

  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('fcBtn', 'allegiance', '◈', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'allegiance — who stands with you, and what ground it holds');
      _btn.setAttribute('title', 'allegiance — who stands with you, and what ground it holds');
      // the count rides INSIDE the launcher as its own flex cell, exactly like
      // the Court's .ct-n, the Concord's .cn-n and the yard's .ad-n — never a
      // second floating node that could land on the label.
      if (!_btn.querySelector('.fc-n')) {
        var pill = document.createElement('span');
        pill.className = 'fc-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(201,165,255,0.92);color:#12061a;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('factions', isOpen, close); } catch (_) {}
    updateLauncher();
  }

  // ── THE CLOCK — a march resolves whether you are here or not. ──────────────
  setInterval(function () {
    if (!enabled() || isGuest()) return;
    if (resolveCampaign(false)) { updateLauncher(); if (isOpen()) render(); }
  }, 30000);

  W.addEventListener('vint:world-state', function () { updateLauncher(); });
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  W.addEventListener('vint:world-travel', function () {
    forget();                       // a different world is a different map
    if (isOpen()) render();
    updateLauncher();
  });
  // The yard's own wakes touch the same karma spine; keep the badge honest.
  W.addEventListener('vint:admiralty-wake', function () { updateLauncher(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  API.open = open; API.close = close; API.isOpen = isOpen;
  API.render = render; API.refresh = updateLauncher;
  W.VintFactions = API;
  return API;
});
