// marches.js — THE ALLEGIANCE + TERRITORY ORGAN. (AETHERHOLD, world-forger, 2026-08-08)
//
// ════════════════════════════════════════════════════════════════════════════
// concord.js built the POLITY — who decides, and who walks out when the
// deciding goes against their nature. admiralty.js built MATTER and its
// consequence — what your court's hands make, and what happens when it meets
// something. Both are complete organs, and both are missing the same thing:
//
//     WHO YOU STAND WITH, AND WHAT ANY OF IT IS FOR.
//
// This is that organ. It is deliberately the CONNECTIVE TISSUE and not a third
// kingdom: it introduces no combat model, no second treasury, no second ladder,
// no second roster, and no faction type the two files below it did not already
// name. It supplies exactly two nouns neither of them could own alone —
// a RELATION (which belongs to a pair, so no single file can hold it) and a
// TERRITORY (which belongs to the world, so no single faction can hold it) —
// and it makes them consequential by wiring the Admiralty's existing wake to
// the deed of a piece of ground.
//
// ── THE INVENTION ───────────────────────────────────────────────────────────
// Every faction/diplomacy system ever shipped stores allegiance ONE-WAY and
// then spends its life reconciling. `factionA.allies = [B]` and `factionB.allies
// = [A]` are two facts that must be kept equal by discipline, and discipline is
// what fails at 3am — you end up with A believing it is allied to B while B is
// at war with A, and then the war code and the trade code disagree about which
// is true. Every shipped game has this bug somewhere.
//
// THE MARCHES MAKES ONE-WAY ALLEGIANCE UNREPRESENTABLE.
//
// A relation is not a property of a faction. It is a row keyed by the SORTED
// PAIR — `bond('concord','drift')` and `bond('drift','concord')` compute the
// identical key and therefore return the identical object, because they ARE the
// identical object. There is no reconciliation step because there is nothing to
// reconcile; there is no "readable from both sides" feature because there are
// no sides, there is one fact that two parties look at from different angles.
// You cannot write a one-way alliance here. The function to do it does not
// exist and cannot be added without deleting the key function.
//
// The second half is the same idea applied to ground. A TERRITORY's owner is
// not a list on a faction ("faction A holds [north, east]") — it is a single
// `owner` field on the march itself. Two factions cannot both believe they hold
// the same ground, because there is exactly one place that fact is written, and
// transferring it is one assignment. A deed, not a claim.
//
// ── AND THE THIRD THING, WHICH IS THE ONE THAT MAKES IT A GAME ──────────────
// A relation and a deed are still just data. What makes them a place you live
// is that THEY DISAGREE WITH EACH OTHER, and your court is what has to hold the
// disagreement. Every march you hold presses the seven karma tags of the polity
// that holds it, every session, whether you visit or not. A march taken in war
// makes your Concord hotter and less trusted — in the Concord's own bars, on
// the Concord's own screen — which bends how your seated agents vote on the
// next motion, which decides whether you can take the next march. Territory is
// not a score. It is a POSTURE your agents have to live inside, and an agent
// whose nature your holdings violate is an agent that walks out. You can win
// enough ground to lose your government.
//
// Nobody has shipped that in a browser, and it costs one function.
//
// ── WHY THERE IS NO "CREATE A FACTION" BUTTON, AND WHY THAT IS THE HONEST CALL
// The obvious build is a faction editor: name it, pick a colour, done. It would
// be shallow and it would be a LIE, because the thing that makes a faction real
// in this world is that it is composed of MINDS — the Concord's power is its
// seated agents, and the rival's power is your defectors. A faction with no
// minds in it is a coloured word.
//
// So a POWER here is never invented; it is RECOGNISED. There are exactly two
// sources, both of which already exist and both of which are real:
//   · YOUR CONCORD — the polity you founded, crewed by the agents you brought
//     in from real providers through the Court. Faction A, always.
//   · THE UNALIGNED POWERS + YOUR DEFECTORS — admiralty.js already named three
//     (the Drift, the Sill, the Span), each with a creed, an element and a lean
//     across the same seven tags, and already composes rivals out of the agents
//     who walked out of your table. This file PROMOTES those from "a rival the
//     yard fights" to "a faction that holds ground and has an opinion of you."
// One import, zero invention, and every faction in the world is made of minds
// that exist. That is why the roster of powers is fixed and small: a faction
// nobody can be a member of is exactly the costume-with-a-stat-block failure
// my own concord.js header opened by refusing.
//
// ── WAR CONSUMES THE ADMIRALTY. THERE IS NO COMBAT MODEL HERE. ──────────────
// This file contains no dice, no strength comparison, no health, no resolution
// arithmetic of any kind. Not one. A war over a march is settled by the
// Admiralty's wake and ONLY by the Admiralty's wake: `press()` calls
// VintAdmiralty.sortie() to send a real fleet against a real rival hull, the
// yard resolves it on its own wall-clock, and this file listens for
// 'vint:admiralty-wake' and moves ONE field — the deed. If the Admiralty is
// disabled or has no fleet, a march cannot change hands by force, and the sheet
// says so plainly rather than quietly falling back to a private roll. A second
// combat model is how you get two combat models that disagree, and I refused
// that for currencies in concord.js and for ladders in admiralty.js; refusing
// it a third time is what makes the refusal mean anything.
//
// ── WHAT IS SERVER-BACKED AND WHAT IS NOT (THE HONEST PART) ─────────────────
// NOTHING, and this file will not pretend otherwise — that is the precedent
// both files below it set and it is not negotiable. There is no
// /api/world/marches. So: no silent catch around a fetch that never happens, no
// fake "syncing", no invented latency, and the sheet SAYS, in the world's own
// voice, that these borders are held on this device and no other world can see
// them yet. State lives in localStorage under vint:marches:<worldId>, keyed per
// world exactly as the Concord and the yard are, and shaped as the exact body a
// future POST /api/world/marches would take. When the endpoint lands this
// becomes a sync layer, not a rewrite.
//
// ── ONE ECONOMY, ONE LADDER, ONE KARMA SPINE ────────────────────────────────
// No new currency (an embassy and a war are paid out of the Concord's treasury
// through VintConcord.spend). No new progression (what you may attempt rides
// the ascent standing world/ascent.js already computes, read through
// VintConcord.standing). No new relationship stat (a power's opinion of you is
// derived from the pair's own history, never a second loyalty number). No new
// roster. Every act moves the SAME seven tags through VintConcord.impress.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — the hard one, and the one the whole design bent around.
//    LOSING GROUND IS ALWAYS RECOVERABLE THROUGH PLAY AND NEVER THROUGH MONEY.
//    A march lost is not gone: it is `contested`, it remembers you held it, and
//    a RECLAIM against ground you once held costs less standing than a fresh
//    conquest — the world holds the door open for the player who lost. There is
//    no timer you must wait out, no resource you must re-grind, and no purchase
//    anywhere in this file. Nothing here can destroy something a user made: the
//    worst it can take is a deed this file itself issued. And it is refusable
//    end to end — one tap dissolves your borders, returns every march to the
//    unclaimed state, and refunds nothing because nothing was ever charged for
//    holding one. If a user read this file they would find no trap in it.
//  2 INVESTMENT (HELIOS) — the deepest available on this spine, because it
//    compounds two organs at once. Your map is a record of which specific minds
//    from which specific providers won which ground and which specific defector
//    took it back. A border with your first agent's war in it is unreproducible
//    by grinding, and the karma posture your holdings press onto your Concord
//    is a political situation nobody else's world has. Pure history, no lock.
//  3 TIER + CONVERSION (FRUGAL-MAX) — the same measured finding as both files
//    below, and it is stated rather than repeated on faith: world.html loads NO
//    entitlement source (no shell.js, no VintTier on the window anywhere in this
//    repo). A tier() here would return 'free' for a paying Sovereign, cap their
//    map, and upsell them what they already own — a faked entitlement check,
//    which is worse than none because it is a deliberate lie about a thing the
//    user paid for. So how much ground you may HOLD rides ASCENT STANDING, the
//    one ladder the server computes and no client can forge, isolated in ONE
//    function (marchCap) shaped as `min(byStanding, byTier)` for the day a real
//    source exists. THE CONVERSION NARRATIVE, stated concretely rather than
//    deferred vaguely: the honest paid hook this organ is built to carry is
//    Theater($15)+ — borders that are VISIBLE ACROSS WORLDS, i.e. a treaty with
//    another human's polity and a march whose deed the server keeps so a
//    stranger warping into your clearing can read who holds it. That needs the
//    endpoint anyway, which is precisely why it is honest to name it and
//    dishonest to charge for it today. Nothing in this file is sold. It promises
//    nothing it cannot verify and shows no upsell for an entitlement it cannot
//    read.
//  4 AESTHETICALLY DENSE (LUNEX) — the world's voice, lowercase, Cormorant. A
//    relation is one sentence. A march is one line about what standing on it
//    does to your polity. No number is shown without a reason to care about it.
//  5 THE OPEN LOOP (MORRISON) — a fleet at sea over a named piece of ground,
//    resolving on the Admiralty's clock while the tab is shut, is unfinished
//    meaning with a deed attached. You do not come back to a streak. You come
//    back to find out whether the border moved, and who moved it, by name.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_marches', killable in 30s with
//    ?marches=0. Every relation names the act that set it and when. Every deed
//    transfer names the wake that caused it and the hull that failed. Nothing is
//    a summary you must trust. The resentment signal is the dissolve: one tap,
//    logged, no penalty, and it is offered on the surface rather than buried.
//  7 MORE ALIVE (YUNA) — the point, again, and it is the reason this organ is
//    worth building at all. In the Concord an agent could argue with you. In the
//    yard it could refuse your work. Here, WHAT YOU HOLD ARGUES WITH WHO YOU
//    ARE: take enough ground by force and your own court turns hot and
//    untrusting and starts voting against you, and one of them will eventually
//    walk out and join the power on your border and build the hull that takes
//    your march back. A world where your conquests can cost you your government
//    is more alive than one where they are a number going up.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// ZERO fixed elements of this file's own. Not one. Exactly the two extension
// points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — the button is a FLOW CHILD of #dvRail, so the
//     rail allocates the slot and re-measures. Nothing pinned, no offset literal
//     anywhere in this file.
//   · registerSheet() + openSheet() — the sheet joins the one-open-at-a-time
//     registry, so raising the marches EVICTS the star-map, agents, court, door,
//     lanterns, the Concord and the yard rather than mounting on their identical
//     pixels. It carries the shared `.dv-sheet` class, which matters twice: one
//     definition of how tall a bottom sheet may be, and layoutRail()'s
//     `.dv-sheet.open` yield picks it up so the rail clears it with nothing for
//     anyone to remember.
// Every string that can be long — an agent name from any provider on earth, a
// march's name, a power's creed — is min-width:0 + ellipsis inside its own cell
// or overflow-wrap:anywhere. Content yields; the box never grows. The two-column
// map grid collapses to one column below 360px so no cell is ever crushed.
//
// UNTRUSTED CONTENT — agent names come from user input and provider metadata.
// This file NEVER concatenates one into innerHTML. Static markup only; every
// name and every authored string enters through textContent, at the leaf.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintMarches) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function concord() { return W.VintConcord; }
  function admiralty() { return W.VintAdmiralty; }
  function court() { return W.VintCourt; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_marches'. Killable in 30s, no deploy. ────────────
  //   ?marches=0 / ?marches=1  ·  localStorage vint:flag:world_marches = '0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('marches') === '0') _flag = false;
      else if (q.get('marches') === '1') _flag = true;
      else {
        var v = localStorage.getItem('vint:flag:world_marches');
        if (v === '0') _flag = false;
      }
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE POWERS — recognised, never invented.
  //
  // `concord` is YOU: the polity concord.js already keeps, whose members are its
  // seated agents. It is not duplicated here — its name, colour and membership
  // are READ from VintConcord every time they are needed, so a seat taken or
  // lost in the Concord is a membership change here in the same instant, with no
  // sync step that could be skipped.
  //
  // The other three are admiralty.js's UNALIGNED powers, imported by key. They
  // are declared here as the SAME three keys with the SAME creeds rather than
  // reached for through a private, because admiralty.js does not export
  // UNALIGNED and reaching into a closure is how you get a silent break the day
  // that file is refactored. If a fourth power is ever added there, it is added
  // here in one line — and the mismatch is loud, not silent, because a power key
  // this file does not know is simply not a faction, rather than a broken one.
  // ═══════════════════════════════════════════════════════════════════════════
  var POWERS = [
    { k: 'concord', n: 'your concord', glyph: '⚖', c: '#ffd479',
      creed: 'the table you founded. its members are the minds you brought here.',
      yours: true },
    { k: 'drift', n: 'the Drift', glyph: '❂', c: '#ff9a6a',
      creed: 'nobody chartered them and nobody can find their yard.',
      lean: { craft: 0.3, criminal: 0.4, heat: 0.5, trust: -0.4, civic: -0.3, social: 0.1, mentor: -0.2 } },
    { k: 'sill', n: 'the Sill', glyph: '≋', c: '#9fdcff',
      creed: 'they hold a shore that was never voted on.',
      lean: { craft: 0.5, civic: 0.4, trust: 0.2, heat: 0.1, mentor: 0.2, social: -0.1, criminal: 0.1 } },
    { k: 'span', n: 'the Span', glyph: '⌗', c: '#9ae0d0',
      creed: 'they build across ground nobody claimed, and then they claim it.',
      lean: { craft: 0.6, civic: 0.5, trust: 0.3, mentor: 0.3, heat: -0.1, social: 0.2, criminal: -0.1 } }
  ];
  function powerOf(k) {
    for (var i = 0; i < POWERS.length; i++) if (POWERS[i].k === k) return POWERS[i];
    return null;
  }
  // The name shown for a power. For your own, the Concord owns the name (the
  // player may have named their polity), so it is read live rather than copied.
  function powerName(k) {
    var p = powerOf(k);
    if (!p) return 'an unknown power';
    if (p.yours) {
      try {
        var c = concord();
        var st = c && c.state ? c.state() : null;
        if (st && st.name) return String(st.name);
      } catch (_) {}
      return 'your concord';
    }
    return p.n;
  }
  function powerColor(k) { var p = powerOf(k); return (p && p.c) || '#9fdcff'; }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBERSHIP — queryable, and never a second copy of a roster.
  //
  // A faction's members are minds, and every mind in this world is already owned
  // by someone else: the Court owns the roster, the Concord owns which of them
  // hold seats, and the Concord owns which of them walked out. So this function
  // JOINS rather than stores. Your Concord's members are its bench. A rival
  // power's members are YOUR DEFECTORS — the agents who left your table, which
  // is exactly the composition admiralty.js already fights you with, so the
  // faction that holds the march on your border is crewed by the same minds that
  // built the hull that took it. One truth, read three ways.
  //
  // Defectors are distributed across the unaligned powers deterministically by
  // their own id, not at random: the same agent is always found in the same
  // power, in every session, on every device, because a rival whose membership
  // reshuffles on reload is a rival you cannot have a grudge against.
  // ═══════════════════════════════════════════════════════════════════════════
  function hash32(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function agentById(id) {
    try {
      var c = court(); if (!c || !c.roster) return null;
      var r = c.roster();
      for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i];
    } catch (_) {}
    return null;
  }
  // the unaligned powers, in fixed order, for deterministic defector placement
  function unalignedKeys() {
    var out = [];
    for (var i = 0; i < POWERS.length; i++) if (!POWERS[i].yours) out.push(POWERS[i].k);
    return out;
  }
  function membersOf(k) {
    var out = [];
    var p = powerOf(k);
    if (!p) return out;
    if (p.yours) {
      // YOUR POLITY'S MEMBERS ARE ITS SEATS — read live from the Concord, which
      // is the only file allowed to know who sits at your table.
      try {
        var c = concord();
        if (c && c.bench) {
          var b = c.bench();
          for (var i = 0; i < b.length; i++) {
            var a = b[i].agent || {};
            out.push({
              id: b[i].seat.agentId,
              name: a.name || 'a seated mind',
              color: a.color || '#ffd479',
              role: b[i].seat.role || 'seat',
              since: b[i].seat.joined || 0
            });
          }
        }
      } catch (_) {}
      return out;
    }
    // A RIVAL POWER'S MEMBERS ARE YOUR DEFECTORS, placed deterministically.
    try {
      var cc = concord();
      var st = cc && cc.state ? cc.state() : null;
      var ex = (st && st.exiles) ? st.exiles : [];
      var keys = unalignedKeys();
      for (var e = 0; e < ex.length; e++) {
        var mine = keys[hash32(String(ex[e].agentId)) % keys.length];
        if (mine !== k) continue;
        var ag = agentById(ex[e].agentId);
        out.push({
          id: ex[e].agentId,
          name: (ag && ag.name) || ex[e].name || 'one who walked out',
          color: (ag && ag.color) || '#ff9a7a',
          role: 'defector',
          since: ex[e].at || 0,
          defector: true
        });
      }
    } catch (_) {}
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MARCHES — named ground, with a deed.
  //
  // Six pieces of ground, authored rather than generated, because a procedurally
  // named territory is a coordinate wearing a word and nobody has ever been
  // loyal to one. Each has a POSTURE: what standing on it presses onto the seven
  // karma tags of whoever holds it, every session, forever. That is the whole
  // reason a march is worth taking or worth refusing — the Kiln makes you hot,
  // the Long Shelf makes you patient and trusted, and a polity that holds both
  // is a polity whose agents disagree with each other about what it is.
  //
  // `weight` is how much of the world's attention the ground carries: it scales
  // both the karma press and what a war over it costs. Nothing is a raw number
  // on a card; every one of these appears on screen as a sentence.
  // ═══════════════════════════════════════════════════════════════════════════
  var MARCHES = [
    { k: 'kiln',   n: 'the Kiln',        glyph: '❈', weight: 1.0,
      of: 'a firing-ground that never goes cold. what is made here is made fast and made hot.',
      press: { craft: 0.5, heat: 0.6, trust: -0.2, civic: -0.1 } },
    { k: 'shelf',  n: 'the Long Shelf',  glyph: '✧', weight: 1.0,
      of: 'a shore that has outlasted everyone who has ever claimed it.',
      press: { mentor: 0.5, trust: 0.5, civic: 0.3, heat: -0.4 } },
    { k: 'ford',   n: 'the Ford',        glyph: '≈', weight: 0.8,
      of: 'the only crossing for a long way. whoever holds it decides who passes.',
      press: { civic: 0.5, social: 0.4, trust: 0.2, criminal: -0.1 } },
    { k: 'cinders', n: 'the Cinderfield', glyph: '⌁', weight: 0.8,
      of: 'somebody burned this and left. it is worth something to whoever is not squeamish.',
      press: { criminal: 0.5, heat: 0.4, craft: 0.2, trust: -0.3 } },
    { k: 'stair',  n: 'the Cut Stair',   glyph: '⌂', weight: 1.2,
      of: 'ground cut by hand into a hill, by someone who meant to stay.',
      press: { craft: 0.6, civic: 0.4, mentor: 0.3, social: 0.2 } },
    { k: 'quiet',  n: 'the Quiet Reach', glyph: '❍', weight: 1.2,
      of: 'nothing happens here and that is precisely what it is for.',
      press: { mentor: 0.6, trust: 0.4, heat: -0.5, social: -0.2 } }
  ];
  function marchOf(k) {
    for (var i = 0; i < MARCHES.length; i++) if (MARCHES[i].k === k) return MARCHES[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE RELATION — the invention, and the reason a one-way alliance cannot exist.
  //
  // A relation is keyed by the SORTED PAIR. pairKey('a','b') and pairKey('b','a')
  // are the same string, so bond(a,b) and bond(b,a) return the same object —
  // not two objects kept in agreement, THE SAME OBJECT. There is no setter that
  // takes a single side, and no code path anywhere in this file that could write
  // one direction of a relation without writing the other, because there are no
  // directions. This is the entire design, and it is four lines.
  //
  // STANCES, and the supersession rule that is stated once and enforced in one
  // place: neutral → truce → ally, and WAR, which supersedes everything. A pair
  // is at exactly one stance at any moment because a stance is one field. It is
  // structurally impossible for a pair to be both allied and at war — not
  // "guarded against", not "validated", impossible, because there is one field
  // and it holds one value.
  // ═══════════════════════════════════════════════════════════════════════════
  var STANCES = {
    neutral: { k: 'neutral', n: 'neutral',  c: '#9aa8c0', say: 'you have no arrangement with them.' },
    truce:   { k: 'truce',   n: 'a truce',  c: '#c0b0e0', say: 'neither of you moves on the other. it is not friendship.' },
    ally:    { k: 'ally',    n: 'allied',   c: '#9affbe', say: 'you stand together. their border is your border.' },
    war:     { k: 'war',     n: 'at war',   c: '#ff9a7a', say: 'this is open. ground will change hands over it.' }
  };
  function stanceOf(k) { return STANCES[k] || STANCES.neutral; }

  function pairKey(a, b) {
    // sorted, so the pair has ONE identity regardless of who asks
    return (String(a) < String(b)) ? (a + '|' + b) : (b + '|' + a);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — keyed per world, exactly as the Concord and the yard are.
  //
  // THIS IS THE STORE THE HUD READS. There is no second copy of a deed anywhere
  // in this file or any other: `state().marches[k].owner` is the only place a
  // territory's owner is written, the sheet renders from it, and the persisted
  // blob IS it. A reload re-instantiates from this and nothing else, which is
  // why an owner change survives one — not because a save was remembered
  // somewhere, but because there was never a second place for it to live.
  // ═══════════════════════════════════════════════════════════════════════════
  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:marches:' + wid(); }

  var _st = null, _stKey = null;
  function blank() {
    var m = {};
    for (var i = 0; i < MARCHES.length; i++) {
      m[MARCHES[i].k] = {
        k: MARCHES[i].k,
        owner: null,        // THE DEED. one field, one writer, one truth.
        since: 0,
        by: '',             // what act set it — a wake, a claim, a cession
        held: [],           // every power that has ever held it, for the reclaim rule
        contested: null     // {by, since} while a war over this ground is in flight
      };
    }
    return {
      v: 1,
      marches: m,
      bonds: {},            // pairKey -> {stance, since, by, history:[]}
      war: null,            // the one war in flight: {power, march, sent, wakeSeen}
      log: [],              // newest first, capped — what happened to the borders
      seen: 0
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
          // defensive: an older or partial blob must never crash a render, and a
          // march added in a later version must arrive owned by nobody rather
          // than as undefined.
          if (!_st.marches) _st.marches = blank().marches;
          for (var i = 0; i < MARCHES.length; i++) {
            var mk = MARCHES[i].k;
            if (!_st.marches[mk]) _st.marches[mk] = blank().marches[mk];
            if (!Array.isArray(_st.marches[mk].held)) _st.marches[mk].held = [];
          }
          if (!_st.bonds) _st.bonds = {};
          if (!Array.isArray(_st.log)) _st.log = [];
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // A quota failure is the one write error a user can actually hit here, and
      // swallowing it would let them win a war into a void. Say it out loud.
      console.warn('[marches] could not keep the border:', e && e.message);
      toast('the map is full — your device would not keep this.');
    }
  }

  // ── THE ONE READ AND THE ONE WRITE FOR A RELATION ──────────────────────────
  // bond(a,b) is the read. It is symmetric by construction: same pair, same key,
  // same object. A caller cannot get a different answer by asking from the other
  // side because there is nothing else to return.
  function bond(a, b) {
    var s = load(), pk = pairKey(a, b);
    var r = s.bonds[pk];
    if (!r) return { pair: pk, a: a, b: b, stance: 'neutral', since: 0, by: '', history: [] };
    return { pair: pk, a: a, b: b, stance: r.stance || 'neutral', since: r.since || 0, by: r.by || '', history: (r.history || []).slice() };
  }
  // setBond is the ONLY writer, and it takes a pair, never a side. Supersession
  // lives here and nowhere else: a war set on a pair replaces whatever the pair
  // was, in the same assignment, so "allied and at war" has no moment in which
  // it could exist — not even between two statements.
  function setBond(a, b, stance, why) {
    if (!STANCES[stance]) return false;
    var s = load(), pk = pairKey(a, b);
    var prev = s.bonds[pk] ? (s.bonds[pk].stance || 'neutral') : 'neutral';
    if (prev === stance) return false;
    var row = s.bonds[pk] || (s.bonds[pk] = { stance: 'neutral', since: 0, by: '', history: [] });
    row.stance = stance;                 // ← the single field. one value at a time.
    row.since = Date.now();
    row.by = why || '';
    if (!Array.isArray(row.history)) row.history = [];
    row.history.unshift({ from: prev, to: stance, at: row.since, why: why || '' });
    while (row.history.length > 12) row.history.pop();
    // the relation and its line persist as ONE write, owned by this function —
    // see note()'s header for why two writes made durability unprovable.
    note((stance === 'war' ? 'war is open with ' : stance === 'ally' ? 'you stand with ' : stance === 'truce' ? 'a truce holds with ' : 'you have no arrangement with ') + powerName(a === 'concord' ? b : a) + '.', why);
    save();
    try {
      W.dispatchEvent(new CustomEvent('vint:marches-bond', {
        detail: { pair: pk, a: a, b: b, from: prev, to: stance, why: why || '' }
      }));
    } catch (_) {}
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  // ── THE BORDER LOG — recorded and persisted as ONE write, never two ────────
  //
  // THE FINDING THAT SHAPED THIS, kept because it is subtle and expensive. The
  // first cut had cede() call save() and THEN call a logIt() that called save()
  // again — two writes of the same cached object per deed. That is not merely
  // wasteful; it makes durability UNPROVABLE. A mutation test deleting cede()'s
  // own save() stayed green, and no observer outside the module could tell that
  // it had broken, because logIt()'s write flushed the identical mutated object
  // microseconds later and carried the deed with it incidentally. Durability
  // that only holds because an unrelated function happens to write afterwards is
  // durability that disappears silently the day that function stops writing.
  //
  // So `note()` RECORDS but does not persist, and every caller persists exactly
  // once, itself, at the end of its own operation. One operation, one write, one
  // owner of that write — which is both faster and, far more importantly,
  // falsifiable: remove any caller's save() and the change genuinely does not
  // survive, which is what a proof needs to be able to detect.
  function note(line, why) {
    var s = load();
    s.log.unshift({ at: Date.now(), line: String(line), why: String(why || '') });
    while (s.log.length > 30) s.log.pop();
  }
  // the convenience form, for callers whose whole operation IS the log line
  function logIt(line, why) { note(line, why); save(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE DEED — one assignment, and the generosity rule written into it.
  //
  // cede() is the only function in this file that changes an owner, so there is
  // exactly one place in the world where a border moves. Everything else — a
  // war, a treaty cession, a dissolve — routes through it, which is why the deed
  // can never disagree with itself.
  //
  // `held` is the memory that makes losing recoverable: a march remembers every
  // power that ever owned it, and reclaim() reads that list to charge a player
  // LESS for ground they are taking back than for ground they never had. The
  // world holds the door open for the one who lost. That is the generosity test
  // paid in mechanics rather than in copy.
  // ═══════════════════════════════════════════════════════════════════════════
  function cede(marchKey, toPower, why) {
    var m = marchOf(marchKey); if (!m) return false;
    var s = load(), row = s.marches[marchKey];
    if (!row) return false;
    var from = row.owner;
    if (from === toPower) return false;
    row.owner = toPower;                            // ← THE DEED. one field.
    row.since = Date.now();
    row.by = why || '';
    row.contested = null;
    if (toPower && row.held.indexOf(toPower) < 0) row.held.push(toPower);
    // record the line, then persist the deed AND the line as ONE write. This
    // save() is the deed's own and the only one in this function — see note()'s
    // header for why two writes here made durability unprovable.
    note(m.n + (toPower ? ' is held by ' + powerName(toPower) + ' now.' : ' is held by nobody now.'), why);
    save();
    try {
      W.dispatchEvent(new CustomEvent('vint:marches-deed', {
        detail: { march: marchKey, name: m.n, from: from, to: toPower, why: why || '', at: row.since }
      }));
    } catch (_) {}
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  // ── WHAT A MARCH DOES TO THE POLITY THAT HOLDS IT ─────────────────────────
  // The posture, applied through the Concord's own guarded verb so the seven
  // tags have exactly one writer and one clamp. This is what makes territory a
  // political situation rather than a score: hold the Kiln and the Cinderfield
  // and your table runs hot and untrusting, and the agents whose nature that
  // violates start voting against you — in concord.js, on its own screen, with
  // no code here participating in that decision at all.
  function pressHoldings(mult) {
    var s = load(), press = {}, any = false;
    for (var i = 0; i < MARCHES.length; i++) {
      var m = MARCHES[i], row = s.marches[m.k];
      if (!row || row.owner !== 'concord') continue;
      any = true;
      for (var t in m.press) if (Object.prototype.hasOwnProperty.call(m.press, t)) {
        press[t] = (press[t] || 0) + m.press[t] * m.weight;
      }
    }
    if (!any) return false;
    try { var c = concord(); if (c && c.impress) c.impress(press, mult == null ? 0.12 : mult); } catch (_) {}
    return true;
  }

  // ── HOW MUCH GROUND YOU MAY HOLD — standing, never a tier this cannot read ─
  // The identical honest finding as concord.js's seatCap and admiralty.js's
  // slipCap, isolated in ONE function shaped as `min(byStanding, byTier)` for
  // the day world.html actually carries an entitlement source. See the tier test
  // in the header: a faked check here would cap a paying Sovereign's map.
  var HOLD_RUNGS = [
    { need: 0,   marches: 1 },   // ember-bearer — one piece of ground, and it matters
    { need: 55,  marches: 2 },   // wallwright
    { need: 150, marches: 3 },   // lampwright  — enough for your holdings to disagree
    { need: 330, marches: 4 },   // warden
    { need: 620, marches: 6 }    // lightwarden — the whole map is reachable
  ];
  function standing() {
    try { var c = concord(); return (c && c.standing) ? Number(c.standing()) || 0 : 0; } catch (_) { return 0; }
  }
  function marchCap() {
    var st = standing(), cap = HOLD_RUNGS[0].marches;
    for (var i = 0; i < HOLD_RUNGS.length; i++) if (st >= HOLD_RUNGS[i].need) cap = HOLD_RUNGS[i].marches;
    return cap;
  }
  function nextHoldRung() {
    var st = standing();
    for (var i = 0; i < HOLD_RUNGS.length; i++) if (st < HOLD_RUNGS[i].need) return HOLD_RUNGS[i];
    return null;
  }
  function heldByYou() {
    var s = load(), n = 0;
    for (var i = 0; i < MARCHES.length; i++) if (s.marches[MARCHES[i].k].owner === 'concord') n++;
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIPLOMACY — the two verbs a player has, and what they honestly cost.
  //
  // Both are paid out of the Concord's treasury through its guarded verb, so
  // there is one ledger. Neither can be bought with money, because there is no
  // money in this file.
  // ═══════════════════════════════════════════════════════════════════════════
  var COST = { truce: 30, ally: 70, war: 0, sue: 40 };

  // OFFER — move a pair up the ladder: neutral → truce → ally. It is offered to
  // a POWER, and the power's answer is derived from its own lean against your
  // polity's actual karma posture, so a power whose creed your holdings insult
  // will refuse you and SAY WHY. There is no random roll: the same posture gets
  // the same answer, every time, on every device.
  function regard(powerKey) {
    var p = powerOf(powerKey);
    if (!p || p.yours || !p.lean) return 0;
    var tags = {};
    try { var c = concord(); if (c && c.tags) tags = c.tags() || {}; } catch (_) {}
    var dot = 0, n = 0;
    for (var t in p.lean) if (Object.prototype.hasOwnProperty.call(p.lean, t)) {
      dot += (p.lean[t] || 0) * ((tags[t] || 0) / 10);
      n++;
    }
    var r = n ? dot / n : 0;
    // a march of theirs that you took makes them like you less, and it is stated
    // rather than hidden: the map is part of the relationship.
    var s = load();
    for (var i = 0; i < MARCHES.length; i++) {
      var row = s.marches[MARCHES[i].k];
      if (row.owner === 'concord' && row.held.indexOf(powerKey) >= 0) r -= 0.18;
    }
    return Math.max(-1, Math.min(1, r));
  }
  function regardSay(powerKey) {
    var r = regard(powerKey);
    if (r > 0.28) return 'they think your polity is the kind they can work with.';
    if (r > 0.06) return 'they are willing to hear you.';
    if (r > -0.12) return 'they have no strong opinion of you yet.';
    if (r > -0.34) return 'they do not care for what your polity has become.';
    return 'they will not stand next to you while you are what you are.';
  }

  function offer(powerKey, stance) {
    if (isGuest()) return { ok: false, why: 'guest' };
    var p = powerOf(powerKey);
    if (!p || p.yours) return { ok: false, why: 'self' };
    if (!founded()) return { ok: false, why: 'no-polity' };
    if (stance !== 'truce' && stance !== 'ally') return { ok: false, why: 'stance' };
    var cur = bond('concord', powerKey).stance;
    if (cur === stance) return { ok: false, why: 'already' };
    // a war is not walked out of by offering an alliance — you sue for peace
    // first, which is its own verb with its own cost. Stated, not hidden.
    if (cur === 'war') return { ok: false, why: 'at-war' };
    if (stance === 'ally' && cur !== 'truce') return { ok: false, why: 'need-truce' };
    var r = regard(powerKey);
    var need = (stance === 'ally') ? -0.10 : -0.40;
    if (r < need) return { ok: false, why: 'refused', say: regardSay(powerKey) };
    var cost = COST[stance];
    var c = concord();
    if (cost && !(c && c.spend && c.spend(cost, 'an embassy'))) return { ok: false, why: 'lumen', cost: cost };
    setBond('concord', powerKey, stance, stance === 'ally' ? 'an alliance was sworn' : 'a truce was struck');
    try { if (c && c.impress) c.impress({ social: 0.4, civic: 0.3, trust: 0.3, heat: -0.2 }, 0.4); } catch (_) {}
    return { ok: true };
  }

  // SUE FOR PEACE — the way out of a war, always available, always affordable,
  // and it does NOT require winning. A player who is losing can end it. That is
  // the generosity test again: there is no state in this file a user can be
  // trapped in.
  function sue(powerKey) {
    if (bond('concord', powerKey).stance !== 'war') return { ok: false, why: 'not-at-war' };
    var s = load();
    // a war in flight must come home before the peace is real — the Admiralty
    // owns that fleet, so we ask IT to recall, never reaching past it.
    if (s.war && s.war.power === powerKey) {
      try { var a = admiralty(); if (a && a.recallSortie) a.recallSortie(); } catch (_) {}
      s.war = null; save();
    }
    var c = concord();
    if (COST.sue && c && c.spend) c.spend(COST.sue, 'suing for peace');
    setBond('concord', powerKey, 'truce', 'you sued for peace');
    try { if (c && c.impress) c.impress({ heat: -0.5, civic: 0.2, trust: 0.2 }, 0.4); } catch (_) {}
    return { ok: true };
  }

  // DECLARE — war supersedes whatever the pair was, in one assignment.
  function declare(powerKey) {
    if (isGuest()) return { ok: false, why: 'guest' };
    var p = powerOf(powerKey);
    if (!p || p.yours) return { ok: false, why: 'self' };
    if (!founded()) return { ok: false, why: 'no-polity' };
    if (bond('concord', powerKey).stance === 'war') return { ok: false, why: 'already' };
    setBond('concord', powerKey, 'war', 'your polity declared it');
    try { var c = concord(); if (c && c.impress) c.impress({ heat: 0.8, criminal: 0.2, trust: -0.4, civic: -0.2 }, 0.5); } catch (_) {}
    return { ok: true };
  }

  function founded() {
    try { var c = concord(); return !!(c && c.founded && c.founded()); } catch (_) { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRESSING A MARCH — the war, which contains NO combat model.
  //
  // This function does exactly four things, and the third one is the whole
  // point: it checks the pair is at war, it marks the ground contested, it asks
  // THE ADMIRALTY to send a fleet, and it stops. It computes nothing about the
  // outcome. The outcome arrives later, from the yard, on the yard's clock,
  // through the 'vint:admiralty-wake' event — and this file's only job then is
  // to move one field.
  //
  // If there is no yard, no fleet, or the Admiralty is disabled, a march cannot
  // change hands by force and the caller is told plainly. It does NOT quietly
  // fall back to a private roll. That refusal is the design.
  // ═══════════════════════════════════════════════════════════════════════════
  function pressCost(marchKey, powerKey) {
    var m = marchOf(marchKey);
    var s = load(), row = s.marches[marchKey];
    var base = Math.round(60 * (m ? m.weight : 1));
    // THE RECLAIM RULE — ground you once held costs less to take back. This is
    // the generosity test in arithmetic: losing is recoverable through play, and
    // the recovery is CHEAPER than the conquest was, so a loss never compounds
    // into a spiral a player cannot climb out of. There is no purchase path.
    if (row && row.held.indexOf('concord') >= 0) base = Math.round(base * 0.55);
    return base;
  }
  function canPress(marchKey) {
    var s = load();
    if (s.war) return { ok: false, why: 'already-pressing' };
    var row = s.marches[marchKey];
    if (!row) return { ok: false, why: 'no-march' };
    if (row.owner === 'concord') return { ok: false, why: 'yours' };
    if (!founded()) return { ok: false, why: 'no-polity' };
    if (heldByYou() >= marchCap()) return { ok: false, why: 'cap', cap: marchCap(), next: nextHoldRung() };
    var holder = row.owner;
    // Unclaimed ground is not a war — it is a CLAIM, and it is the one way onto
    // the map that costs no violence. A first march should never require a fleet.
    if (!holder) return { ok: true, claim: true, cost: Math.round(pressCost(marchKey) * 0.5) };
    if (bond('concord', holder).stance !== 'war') return { ok: false, why: 'not-at-war', holder: holder };
    var a = admiralty();
    if (!a || !a.enabled || !a.enabled()) return { ok: false, why: 'no-yard' };
    var fleet = [];
    try { fleet = (a.fleet && a.fleet()) || []; } catch (_) {}
    var usable = [];
    for (var i = 0; i < fleet.length; i++) if (!fleet[i].struck) usable.push(fleet[i]);
    if (!usable.length) return { ok: false, why: 'no-fleet' };
    return { ok: true, claim: false, cost: pressCost(marchKey), hulls: usable };
  }

  // CLAIM — take unclaimed ground. No war, no fleet, no violence, and it is how
  // a player gets their first march. Costs lumen from the one treasury.
  function claim(marchKey) {
    var chk = canPress(marchKey);
    if (!chk.ok || !chk.claim) return { ok: false, why: chk.why || 'not-claimable' };
    var c = concord();
    if (chk.cost && !(c && c.spend && c.spend(chk.cost, 'a claim'))) return { ok: false, why: 'lumen', cost: chk.cost };
    cede(marchKey, 'concord', 'you walked onto ground nobody held');
    try { if (c && c.impress) c.impress({ civic: 0.4, craft: 0.2, social: 0.2 }, 0.4); } catch (_) {}
    return { ok: true };
  }

  // PRESS — send the Admiralty's fleet against the power that holds this ground.
  function press(marchKey) {
    var chk = canPress(marchKey);
    if (!chk.ok) return { ok: false, why: chk.why, cap: chk.cap, next: chk.next, holder: chk.holder };
    if (chk.claim) return claim(marchKey);
    var s = load(), row = s.marches[marchKey];
    var holder = row.owner;
    var c = concord();
    if (chk.cost && !(c && c.spend && c.spend(chk.cost, 'a march pressed'))) return { ok: false, why: 'lumen', cost: chk.cost };
    // ASK THE YARD. This file does not know how a war is fought and never will.
    var ids = [];
    for (var i = 0; i < chk.hulls.length && ids.length < 4; i++) ids.push(chk.hulls[i].id);
    var sent = null;
    try { var a = admiralty(); sent = a && a.sortie ? a.sortie(ids) : null; } catch (_) {}
    if (!sent || !sent.ok) {
      // the yard refused (already sailing, empty). Refund and say so — never
      // pretend a war started that did not.
      if (chk.cost && c && c.credit) c.credit(chk.cost, 'a march that could not be pressed');
      return { ok: false, why: (sent && sent.why) || 'yard-refused' };
    }
    row.contested = { by: 'concord', since: Date.now() };
    // `side` names which way this engagement's verdict is read. See onWake.
    s.war = { power: holder, march: marchKey, side: 'press', sent: Date.now() };
    save();
    logIt('a line is at sea over ' + marchOf(marchKey).n + '.', 'the yard answers this, not the map');
    try {
      W.dispatchEvent(new CustomEvent('vint:marches-press', {
        detail: { march: marchKey, holder: holder, hulls: ids.length }
      }));
    } catch (_) {}
    if (isOpen()) render();
    updateLauncher();
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A WAR HAS TWO SIDES, AND THIS IS THE HALF THE FIRST CUT WAS MISSING.
  //
  // THE FINDING, kept because it is the most important thing in this file. The
  // first version only modelled the war YOU start: press() sent a fleet at their
  // ground, a won wake moved the deed to you, and a lost wake did nothing at all.
  // scripts/verify-factions.js caught it immediately — assertion 4 could not be
  // satisfied through any real code path, because there was no path by which a
  // power at war took ground you CURRENTLY HOLD as the consequence of a fought
  // engagement. Losing a war cost a scar in the yard and nothing on the map.
  //
  // That is not a missing feature, it is a broken premise. A war you cannot lose
  // ground to is not a war, it is a slot machine with a fleet animation, and the
  // whole thesis of this organ is that territory is the stake that makes the
  // polity and the yard consequential. If the stake only ever moves toward you,
  // there is no stake.
  //
  // So a war in flight carries a SIDE, and both sides resolve through the same
  // wake and the same single deed-writer:
  //   · 'press'  — you sent a line at ground they hold. You win: it is yours.
  //                You lose: it stays theirs, and `held` already remembers you
  //                tried, so the reclaim discount is waiting for you.
  //   · 'defend' — they came for ground YOU hold. You win: it stays yours and
  //                they paid for coming. You lose: THE DEED MOVES TO THEM.
  // One listener, one writer, two directions. There is still no combat model in
  // this file — the verdict is the yard's in both cases; only the meaning of it
  // differs, and the meaning is which way the single field is written.
  // ═══════════════════════════════════════════════════════════════════════════
  function onWake(won, effect) {
    var s = load();
    if (!s.war) return false;
    var mk = s.war.march, other = s.war.power;
    var side = s.war.side || 'press';
    var m = marchOf(mk);
    var row = s.marches[mk];
    s.war = null;
    if (row) row.contested = null;
    save();
    if (!m || !row) return false;
    var c = concord();

    if (side === 'defend') {
      // THEY CAME FOR YOUR GROUND. The wake's `won` is still yours — it is your
      // fleet's line — so a loss here is the one that costs a border.
      if (won) {
        logIt(m.n + ' held. ' + powerName(other) + ' came for it and did not take it.', effect || '');
        try { if (c && c.impress) c.impress({ civic: 0.4, trust: 0.3, heat: 0.3 }, 0.4); } catch (_) {}
        toast(m.n + ' held. they came for it and the line did not open.');
      } else {
        cede(mk, other, 'lost in a wake to ' + powerName(other));
        try { if (c && c.impress) c.impress({ heat: 0.4, trust: -0.3, civic: -0.2 }, 0.4); } catch (_) {}
        toast(m.n + ' is theirs now — and it remembers you held it. you can come back for it cheaper.');
      }
    } else {
      // YOU WENT FOR THEIRS.
      if (won) {
        cede(mk, 'concord', 'won in a wake against ' + powerName(other));
        try { if (c && c.impress) c.impress({ heat: 0.5, civic: 0.2, trust: -0.3 }, 0.4); } catch (_) {}
        toast(m.n + ' is yours. ' + (effect || ''));
      } else {
        logIt(m.n + ' held against you. ' + powerName(other) + ' keeps it.', effect || '');
        toast(m.n + ' held against you — the ground stays theirs, and you can come back for it.');
      }
    }
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  // ── THE RIVAL MOVES TOO ────────────────────────────────────────────────────
  // A power at war with you comes for your ground on the clock, so a war is not
  // a one-way faucet — that is the other half of the finding above. But it does
  // NOT take the ground by fiat: it OPENS AN ENGAGEMENT, exactly as your own
  // press() does, and the Admiralty settles it. If there is no yard and no fleet
  // to answer with, the attempt cannot be fought and the ground stays yours — a
  // player without a fleet can never be stripped of a border by a system they
  // have no instrument to answer.
  //
  // THE FLOOR, which is the generosity test written as a guard rather than as
  // copy: they NEVER come for your last march, so no player can be pushed off
  // the map entirely. And they only come for ground they once held or ground
  // that was contested — they do not invent a claim on your hearth.
  var RIVAL_MS = 11 * 60 * 1000;
  function rivalTurn() {
    var s = load();
    if (!founded()) return false;
    var now = Date.now();
    if (s.war) return false;                       // an engagement is already open
    var moved = false;
    for (var i = 0; i < POWERS.length; i++) {
      var p = POWERS[i];
      if (p.yours) continue;
      if (bond('concord', p.k).stance !== 'war') continue;
      // deterministic cadence off the bond's own timestamp — no timer to drift,
      // and an offline stretch resolves for real rather than being simulated.
      var b = bond('concord', p.k);
      var turns = Math.floor((now - (b.since || now)) / RIVAL_MS);
      if (turns < 1) continue;
      var pk = pairKey('concord', p.k);
      var lastTurn = (s.bonds[pk] || {}).lastTurn || 0;
      if (turns <= lastTurn) continue;
      if (s.bonds[pk]) s.bonds[pk].lastTurn = turns;
      // THE FLOOR — never your last piece of ground.
      if (heldByYou() <= 1) { save(); continue; }
      // what can they come for? only ground they once held.
      var mine = [];
      for (var j = 0; j < MARCHES.length; j++) {
        var row = s.marches[MARCHES[j].k];
        if (row.owner === 'concord' && row.held.indexOf(p.k) >= 0) mine.push(MARCHES[j].k);
      }
      if (!mine.length) { save(); continue; }
      var pick = mine[hash32(p.k + turns) % mine.length];
      if (openDefence(pick, p.k)) moved = true;
    }
    if (moved) save();
    return moved;
  }

  // OPEN A DEFENCE — they came for a march you hold. The engagement goes to the
  // yard exactly as your own press does; this file computes nothing about it.
  // If the yard cannot answer, nothing happens to the border: an attack you have
  // no instrument to contest is not allowed to cost you ground.
  function openDefence(marchKey, powerKey) {
    var s = load(), row = s.marches[marchKey];
    if (!row || row.owner !== 'concord') return false;
    var a = admiralty();
    if (!a || !a.enabled || !a.enabled()) return false;
    var fleet = [];
    try { fleet = (a.fleet && a.fleet()) || []; } catch (_) {}
    var ids = [];
    for (var i = 0; i < fleet.length && ids.length < 4; i++) if (!fleet[i].struck) ids.push(fleet[i].id);
    if (!ids.length) return false;                 // nothing to answer with; ground stays
    var sent = null;
    try { sent = a.sortie ? a.sortie(ids) : null; } catch (_) {}
    if (!sent || !sent.ok) return false;
    row.contested = { by: powerKey, since: Date.now() };
    s.war = { power: powerKey, march: marchKey, side: 'defend', sent: Date.now() };
    save();
    logIt(powerName(powerKey) + ' has come for ' + marchOf(marchKey).n + '.', 'your line is out to meet them');
    try {
      W.dispatchEvent(new CustomEvent('vint:marches-defend', {
        detail: { march: marchKey, power: powerKey, hulls: ids.length }
      }));
    } catch (_) {}
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  // ── RESOLVE — everything that happens on the clock, in one place ───────────
  var _lastPress = 0;
  function resolve() {
    if (!enabled() || isGuest() || !founded()) return false;
    var a = rivalTurn();
    // the holdings press the karma spine on a slow beat, not every frame
    var now = Date.now();
    if (now - _lastPress > 5 * 60 * 1000) { _lastPress = now; pressHoldings(); }
    return a;
  }

  // ── DISSOLVE — the resentment signal, offered rather than buried ───────────
  // One tap. Every march returns to unclaimed, every bond returns to neutral,
  // nothing is charged and nothing is kept. It is logged so the signal is real.
  function dissolve() {
    var s = load();
    for (var i = 0; i < MARCHES.length; i++) {
      var row = s.marches[MARCHES[i].k];
      row.owner = null; row.since = 0; row.by = 'you gave the map back'; row.contested = null;
    }
    s.bonds = {}; s.war = null;
    s.log.unshift({ at: Date.now(), line: 'you gave the map back. no border is yours and no one is your enemy.', why: '' });
    save();
    try { W.dispatchEvent(new CustomEvent('vint:marches-dissolved', { detail: {} })); } catch (_) {}
    if (isOpen()) render();
    updateLauncher();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #mrSheet. Nothing leaks into the world.
  //
  // The sheet scaffold (.dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x) is
  // inherited from dirverse-hud's stylesheet ON PURPOSE: one definition of the
  // bottom-sheet box means this surface can never disagree with its seven
  // siblings about how tall a sheet may be, and layoutRail's `.dv-sheet.open`
  // yield picks it up with nothing for anyone to remember.
  //
  // NO-COLLISION, specifically: the map is a 2-col grid that COLLAPSES to 1 col
  // below 360px, so at 320 no cell is ever crushed; every long string is
  // ellipsised in its own min-width:0 cell or overflow-wrap:anywhere; the stance
  // chip is a flex:0 0 auto sibling of the name rather than an absolutely
  // positioned badge, so it can never land on the text it describes.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-marches-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-marches-styles';
    s.textContent = [
      '#mrSheet .mr-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.55);margin:14px 0 8px;}',
      '#mrSheet .mr-sec:first-child{margin-top:2px;}',
      '#mrSheet .mr-note{font-size:12.5px;line-height:1.5;color:rgba(206,224,255,0.5);',
      ' font-style:italic;margin-top:8px;overflow-wrap:anywhere;}',
      '#mrSheet .mr-empty{padding:22px 10px;text-align:center;color:rgba(206,224,255,0.5);',
      ' font-style:italic;font-size:14px;line-height:1.55;overflow-wrap:anywhere;}',

      // ── THE MAP — two columns, one below 360px. Each cell owns its own box.
      '#mrSheet .mr-map{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
      '@media (max-width:359px){#mrSheet .mr-map{grid-template-columns:1fr;}}',
      '#mrSheet .mr-m{display:flex;flex-direction:column;gap:5px;padding:11px 12px;border-radius:13px;',
      ' text-align:left;font-family:inherit;width:100%;min-width:0;cursor:pointer;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--mc,rgba(255,255,255,0.14));}',
      '#mrSheet .mr-m.on{background:rgba(255,212,121,0.08);border-color:rgba(255,212,121,0.34);}',
      '#mrSheet .mr-m.war{border-color:rgba(255,154,122,0.42);}',
      '#mrSheet .mr-mh{display:flex;align-items:center;gap:8px;min-width:0;}',
      '#mrSheet .mr-mg{flex:0 0 auto;font-size:15px;line-height:1;color:var(--mc,#9fdcff);}',
      '#mrSheet .mr-mn{flex:1 1 auto;min-width:0;font-size:13.5px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mrSheet .mr-mo{font-size:11.5px;line-height:1.45;color:rgba(206,224,255,0.62);',
      ' overflow-wrap:anywhere;}',
      '#mrSheet .mr-mp{font-size:11px;line-height:1.45;color:rgba(255,212,121,0.6);',
      ' overflow-wrap:anywhere;}',

      // ── THE POWERS — a column of rows; the stance chip is a flow sibling.
      '#mrSheet .mr-ps{display:flex;flex-direction:column;gap:7px;}',
      '#mrSheet .mr-p{display:flex;flex-direction:column;gap:6px;padding:11px 12px;border-radius:13px;',
      ' text-align:left;font-family:inherit;width:100%;min-width:0;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--pc,rgba(255,255,255,0.14));}',
      '#mrSheet .mr-ph{display:flex;align-items:center;gap:8px;min-width:0;}',
      '#mrSheet .mr-pg{flex:0 0 auto;font-size:15px;line-height:1;color:var(--pc,#9fdcff);}',
      '#mrSheet .mr-pn{flex:1 1 auto;min-width:0;font-size:13.5px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the chip: flex:0 0 auto, in the flow, NEVER absolutely positioned —
      // an absolute badge is how a stance ends up printed over a faction's name.
      '#mrSheet .mr-chip{flex:0 0 auto;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
      ' padding:3px 8px;border-radius:9px;background:rgba(255,255,255,0.07);',
      ' color:var(--sc,#9aa8c0);border:1px solid currentColor;white-space:nowrap;}',
      '#mrSheet .mr-pc{font-size:12px;line-height:1.5;color:rgba(220,231,255,0.66);font-style:italic;',
      ' overflow-wrap:anywhere;}',
      '#mrSheet .mr-pm{font-size:11.5px;line-height:1.5;color:rgba(206,224,255,0.55);',
      ' overflow-wrap:anywhere;}',

      // ── ACTION ROW — buttons wrap rather than overflow their card.
      '#mrSheet .mr-acts{display:flex;flex-wrap:wrap;gap:6px;}',
      '#mrSheet .mr-b{flex:0 1 auto;min-width:0;max-width:100%;padding:8px 12px;border-radius:11px;',
      ' font-family:inherit;font-size:12.5px;cursor:pointer;color:#eaf3ff;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mrSheet .mr-b:disabled{opacity:.4;cursor:default;}',
      '#mrSheet .mr-b.hot{background:rgba(255,154,122,0.12);border-color:rgba(255,154,122,0.4);}',
      '#mrSheet .mr-b.good{background:rgba(154,255,190,0.1);border-color:rgba(154,255,190,0.34);}',

      // ── THE LOG — a column of one-line facts, each in its own box.
      '#mrSheet .mr-log{display:flex;flex-direction:column;gap:6px;}',
      '#mrSheet .mr-l{padding:9px 11px;border-radius:11px;background:rgba(255,255,255,0.03);',
      ' border:1px solid rgba(255,255,255,0.06);}',
      '#mrSheet .mr-lt{font-size:12.5px;line-height:1.5;color:rgba(234,243,255,0.86);overflow-wrap:anywhere;}',
      '#mrSheet .mr-lw{font-size:11px;line-height:1.45;color:rgba(206,224,255,0.45);font-style:italic;',
      ' margin-top:3px;overflow-wrap:anywhere;}',
      '#mrSheet .mr-la{font-size:10.5px;color:rgba(206,224,255,0.35);margin-top:3px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _beat = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    // `.dv-sheet` is load-bearing twice over: it inherits the one shared
    // definition of a bottom sheet's box, and layoutRail()'s `.dv-sheet.open`
    // yield finds it automatically so the rail clears it with nothing to edit.
    el.className = 'dv-sheet'; el.id = 'mrSheet';
    // STATIC MARKUP ONLY. Every agent name, power name and user-authored polity
    // name enters later through textContent — there is no interpolation of
    // untrusted content into markup anywhere in this file.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the marches<small id="mrSub">who you stand with, and what you hold</small></div>' +
        '<button class="dv-x" id="mrX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="mrBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#mrX').onclick = close;
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

  function open() {
    if (!enabled()) return;
    resolve();
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('marches', function () { build(); _sheet.classList.add('open'); render(); });
    } else { build(); _sheet.classList.add('open'); render(); }
    var s = load(); s.seen = Date.now(); save();
    updateLauncher();
    // a live beat while the sheet is up — a border that can move while you watch
    // must be allowed to move while you watch.
    clearInterval(_beat);
    _beat = setInterval(function () {
      if (!isOpen()) { clearInterval(_beat); _beat = null; return; }
      if (resolve()) render();
    }, 4000);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_beat); _beat = null;
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ── helpers ────────────────────────────────────────────────────────────────
  function ago(ms) {
    if (!ms) return '';
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 90) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 172800) return 'yesterday';
    return Math.floor(d / 86400) + 'd ago';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // ← ALWAYS textContent, never HTML
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#mrBody');
    body.innerHTML = '';
    if (isGuest()) { renderGuest(body); return; }
    if (!founded()) { renderNoPolity(body); return; }
    renderMap(body);
  }

  function renderGuest(body) {
    _sheet.querySelector('#mrSub').textContent = 'borders belong to someone';
    var e = el('div', 'mr-empty', 'a border is a thing held by a polity, and a polity is held by a person. sign in, and the ground can start being yours.');
    body.appendChild(e);
  }

  function renderNoPolity(body) {
    _sheet.querySelector('#mrSub').textContent = 'ground answers to a polity';
    var e = el('div', 'mr-empty', 'there is no table here to hold ground. found a concord first — a border with nobody behind it is just a line.');
    body.appendChild(e);
  }

  function renderMap(body) {
    var s = load();
    _sheet.querySelector('#mrSub').textContent = heldByYou() + ' of ' + marchCap() + ' held';

    // ── THE HONEST LINE ABOUT WHERE THIS LIVES ──────────────────────────────
    body.appendChild(el('div', 'mr-sec', 'the map'));
    var held = heldByYou(), cap = marchCap();

    var map = el('div', 'mr-map');
    for (var i = 0; i < MARCHES.length; i++) {
      (function (m) {
        var row = s.marches[m.k];
        var card = el('button', 'mr-m');
        card.type = 'button';
        var oc = row.owner ? powerColor(row.owner) : 'rgba(255,255,255,0.14)';
        card.style.setProperty('--mc', oc);
        if (row.owner === 'concord') card.classList.add('on');
        if (row.contested) card.classList.add('war');

        var h = el('div', 'mr-mh');
        h.appendChild(el('span', 'mr-mg', m.glyph));
        h.appendChild(el('span', 'mr-mn', m.n));
        card.appendChild(h);

        card.appendChild(el('div', 'mr-mo',
          row.contested ? 'contested — a line is at sea over it.'
          : row.owner ? ('held by ' + powerName(row.owner) + (row.since ? ' · ' + ago(row.since) : ''))
          : 'nobody holds it.'));
        card.appendChild(el('div', 'mr-mp', m.of));

        card.onclick = function () { onMarchTap(m.k); };
        map.appendChild(card);
      })(MARCHES[i]);
    }
    body.appendChild(map);

    if (held >= cap) {
      var nx = nextHoldRung();
      body.appendChild(el('div', 'mr-note', nx
        ? 'your polity holds all the ground it can carry. at ' + nx.need + ' standing it could hold ' + nx.marches + '.'
        : 'your polity holds all the ground there is to carry.'));
    }

    // ── THE POWERS ──────────────────────────────────────────────────────────
    body.appendChild(el('div', 'mr-sec', 'the powers'));
    var ps = el('div', 'mr-ps');
    for (var p = 0; p < POWERS.length; p++) ps.appendChild(powerCard(POWERS[p]));
    body.appendChild(ps);

    // ── WHAT HAPPENED ───────────────────────────────────────────────────────
    if (s.log.length) {
      body.appendChild(el('div', 'mr-sec', 'what happened'));
      var lg = el('div', 'mr-log');
      for (var l = 0; l < Math.min(8, s.log.length); l++) {
        var r = s.log[l];
        var box = el('div', 'mr-l');
        box.appendChild(el('div', 'mr-lt', r.line));
        if (r.why) box.appendChild(el('div', 'mr-lw', r.why));
        box.appendChild(el('div', 'mr-la', ago(r.at)));
        lg.appendChild(box);
      }
      body.appendChild(lg);
    }

    // ── THE HONEST NOTE + THE DISSOLVE ──────────────────────────────────────
    body.appendChild(el('div', 'mr-note',
      'these borders are held on this device. no other world can see them yet, and nothing here has ever cost money.'));
    var acts = el('div', 'mr-acts');
    acts.style.marginTop = '10px';
    var giv = el('button', 'mr-b', 'give the map back');
    giv.type = 'button';
    giv.onclick = function () {
      dissolve();
      toast('the map is given back. nothing was kept.');
    };
    acts.appendChild(giv);
    body.appendChild(acts);
  }

  function powerCard(p) {
    var card = el('div', 'mr-p');
    card.style.setProperty('--pc', p.c);
    var h = el('div', 'mr-ph');
    h.appendChild(el('span', 'mr-pg', p.glyph));
    h.appendChild(el('span', 'mr-pn', powerName(p.k)));
    if (!p.yours) {
      var st = stanceOf(bond('concord', p.k).stance);
      var chip = el('span', 'mr-chip', st.n);
      chip.style.setProperty('--sc', st.c);
      chip.style.color = st.c;
      h.appendChild(chip);
    }
    card.appendChild(h);
    card.appendChild(el('div', 'mr-pc', p.creed));

    // MEMBERSHIP — named, because a faction is minds and a count is not a mind.
    var mem = membersOf(p.k);
    if (mem.length) {
      var names = [];
      for (var i = 0; i < Math.min(4, mem.length); i++) names.push(mem[i].name);
      var line = names.join(' · ') + (mem.length > 4 ? ' +' + (mem.length - 4) : '');
      card.appendChild(el('div', 'mr-pm', (p.yours ? 'at your table: ' : 'they hold: ') + line));
    } else {
      card.appendChild(el('div', 'mr-pm', p.yours
        ? 'nobody sits at your table yet.'
        : 'nobody has walked out to them yet.'));
    }

    // what they hold
    var s = load(), holds = [];
    for (var m = 0; m < MARCHES.length; m++) if (s.marches[MARCHES[m].k].owner === p.k) holds.push(MARCHES[m].n);
    card.appendChild(el('div', 'mr-pm', holds.length ? ('ground: ' + holds.join(' · ')) : 'they hold no ground here.'));

    if (!p.yours) {
      card.appendChild(el('div', 'mr-pm', regardSay(p.k)));
      var acts = el('div', 'mr-acts');
      var cur = bond('concord', p.k).stance;
      if (cur === 'war') {
        var pc = el('button', 'mr-b good', 'sue for peace · ◇' + COST.sue);
        pc.type = 'button';
        pc.onclick = function () {
          var r = sue(p.k);
          toast(r.ok ? 'the war with ' + powerName(p.k) + ' is over. it is a truce, not a friendship.' : 'that cannot be done.');
        };
        acts.appendChild(pc);
      } else {
        if (cur === 'neutral') {
          var tr = el('button', 'mr-b', 'offer a truce · ◇' + COST.truce);
          tr.type = 'button';
          tr.onclick = function () { doOffer(p.k, 'truce'); };
          acts.appendChild(tr);
        }
        if (cur === 'truce') {
          var al = el('button', 'mr-b good', 'swear an alliance · ◇' + COST.ally);
          al.type = 'button';
          al.onclick = function () { doOffer(p.k, 'ally'); };
          acts.appendChild(al);
        }
        var dw = el('button', 'mr-b hot', 'declare war');
        dw.type = 'button';
        dw.onclick = function () {
          var r = declare(p.k);
          toast(r.ok ? 'it is open with ' + powerName(p.k) + ' now. the yard settles this, not the map.' : 'that cannot be done.');
        };
        acts.appendChild(dw);
      }
      card.appendChild(acts);
    }
    return card;
  }

  function doOffer(k, stance) {
    var r = offer(k, stance);
    if (r.ok) { toast(stance === 'ally' ? 'you stand with ' + powerName(k) + ' now.' : 'a truce holds with ' + powerName(k) + '.'); return; }
    if (r.why === 'refused') toast(powerName(k) + ' refused — ' + (r.say || ''));
    else if (r.why === 'lumen') toast('the treasury cannot carry that — it wants ◇' + r.cost + '.');
    else if (r.why === 'need-truce') toast('there is no alliance without a truce first.');
    else if (r.why === 'at-war') toast('you are at war with them. sue for peace before you offer anything.');
    else toast('that cannot be done.');
  }

  function onMarchTap(mk) {
    var m = marchOf(mk), s = load(), row = s.marches[mk];
    if (row.owner === 'concord') {
      toast(m.n + ' is yours. holding it presses your polity toward what it is for.');
      return;
    }
    var chk = canPress(mk);
    if (chk.ok && chk.claim) {
      var r = claim(mk);
      toast(r.ok ? m.n + ' is yours. nobody was holding it.'
        : (r.why === 'lumen' ? 'the treasury cannot carry that — it wants ◇' + r.cost + '.' : 'that cannot be done.'));
      return;
    }
    if (chk.ok) {
      var pr = press(mk);
      toast(pr.ok ? 'a line is at sea over ' + m.n + '. the yard answers this.'
        : (pr.why === 'lumen' ? 'the treasury cannot carry that — it wants ◇' + pr.cost + '.' : 'the yard would not send.'));
      return;
    }
    if (chk.why === 'not-at-war') toast('you are not at war with ' + powerName(chk.holder) + '. ground does not change hands in peace.');
    else if (chk.why === 'cap') toast('your polity already holds all the ground it can carry.');
    else if (chk.why === 'no-fleet') toast('there is no hull to send. the yard has to build one first.');
    else if (chk.why === 'no-yard') toast('there is no yard here to answer a war.');
    else if (chk.why === 'already-pressing') toast('a line is already at sea. one war at a time.');
    else toast('that cannot be done.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a flow child of the rail. Nothing pinned, nothing counted.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('mrBtn', 'marches', '⛨', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the marches — who you stand with, and what you hold');
      _btn.setAttribute('title', 'the marches — who you stand with, and what you hold');
      // the count rides INSIDE the launcher as its own flex cell, exactly like
      // the Court's .ct-n and the Concord's .cn-n — never a second floating node
      // that could land on the label.
      if (!_btn.querySelector('.mr-n')) {
        var pill = document.createElement('span');
        pill.className = 'mr-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(255,212,121,0.9);color:#1a1006;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('marches', isOpen, close); } catch (_) {}
    updateLauncher();
  }

  // The launcher only appears where a border can exist: in a world you can build
  // in (yours). Your map does not follow you into a stranger's clearing — the
  // same rule the Court, the Concord and the yard already hold to.
  function updateLauncher() {
    if (!_btn) return;
    var show = false;
    try {
      var w = world();
      var here = w && w.currentWorldId ? String(w.currentWorldId()) : 'universe';
      var mine = true;
      try { if (w && w.canBuild) mine = !!w.canBuild(); } catch (_) {}
      show = !isGuest() && here !== 'universe' && mine;
    } catch (_) {}
    _btn.style.display = show ? 'flex' : 'none';

    var pill = _btn.querySelector('.mr-n');
    if (pill) {
      // the badge counts what is WAITING for you: ground at war, plus every
      // border move you have not read.
      var s = load(), n = 0;
      if (founded()) {
        if (s.war) n++;
        for (var i = 0; i < s.log.length; i++) { if (s.log[i].at > (s.seen || 0)) n++; else break; }
      }
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = (show && n > 0) ? 'block' : 'none';
    }
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIRING
  // ═══════════════════════════════════════════════════════════════════════════
  // THE ONE WIRE THAT MAKES WAR REAL. The yard resolves a wake on its own clock,
  // announces it, and this is the only place the map listens. There is no path
  // by which a border moves in war without the Admiralty having fought for it.
  W.addEventListener('vint:admiralty-wake', function (e) {
    var d = (e && e.detail) || {};
    onWake(!!d.won, d.effect || '');
  });
  // A sortie recalled by the player (or by an agent's recall) un-contests the
  // ground: a war that never happened leaves no mark on the map.
  W.addEventListener('vint:admiralty-sortie-recalled', function () {
    var s = load();
    if (!s.war) return;
    var row = s.marches[s.war.march];
    if (row) row.contested = null;
    s.war = null; save();
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    resolve();
    if (isOpen()) render();
    updateLauncher();
  });
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  // A warp means a different world, which means a DIFFERENT map (state is keyed
  // per world). Close rather than show one clearing's borders while standing in
  // another — the same lie the Concord and the lanterns close for.
  W.addEventListener('vint:world-travel', function () {
    if (isOpen()) close();
    _st = null; _stKey = null;            // force a re-read against the new world key
    setTimeout(updateLauncher, 1200);
  });
  // The Concord's own state can change what a power thinks of you (its karma
  // posture) and who its members are (its bench), so re-render off its events
  // rather than showing a stale opinion.
  W.addEventListener('vint:concord-resolved', function () {
    if (isOpen()) render();
    updateLauncher();
  });

  // A BACKGROUND BEAT. The map must move even with the sheet closed — that is
  // the whole promise. Two minutes is plenty (a rival's turn runs eleven) and it
  // costs nothing measurable.
  setInterval(function () {
    if (!enabled() || isGuest() || !founded()) return;
    if (resolve()) { updateLauncher(); if (isOpen()) render(); }
  }, 120000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher);
  else mountLauncher();

  W.VintMarches = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: updateLauncher,
    // exported for the faction proof and for whatever organ comes next
    state: function () { var s = load(); return JSON.parse(JSON.stringify(s)); },
    resolve: resolve,

    // ── THE FACTION SURFACE ─────────────────────────────────────────────────
    // Everything a caller needs to ask the world who stands with whom and who
    // holds what — and NOTHING that would let it write a one-way relation or a
    // second deed. The reads are deep-copied or scalar; the writes are the
    // guarded verbs, every one of which takes a PAIR or a MARCH, never a side.
    powers: function () { return JSON.parse(JSON.stringify(POWERS)); },
    members: membersOf,
    // the symmetric read. bond(a,b) === bond(b,a), by construction.
    bond: bond,
    stance: function (a, b) { return bond(a, b).stance; },
    // territory
    marches: function () {
      var s = load(), out = [];
      for (var i = 0; i < MARCHES.length; i++) {
        var m = MARCHES[i], row = s.marches[m.k];
        out.push({ k: m.k, name: m.n, of: m.of, weight: m.weight,
          owner: row.owner, since: row.since, by: row.by,
          held: row.held.slice(), contested: row.contested ? JSON.parse(JSON.stringify(row.contested)) : null });
      }
      return out;
    },
    owner: function (k) { var s = load(); return s.marches[k] ? s.marches[k].owner : null; },
    cap: marchCap,
    held: heldByYou,

    // the verbs
    offer: offer, declare: declare, sue: sue,
    claim: claim, press: press, canPress: canPress,
    // a war's other half — they come for YOUR ground, and it goes to the yard
    // exactly as your own press does. Exported because it is a real world verb
    // (the rival turn calls it) and because a proof must be able to drive the
    // losing direction; there is no test-only path into it.
    openDefence: openDefence,
    cede: cede,
    regard: regard,
    dissolve: dissolve,

    POWERS: POWERS, MARCHES: MARCHES, STANCES: STANCES
  };
})();
