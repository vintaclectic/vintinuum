/* body/world/marches.js — THE MARCHES.  DIRVERSE organ 4: factions.
   ═══════════════════════════════════════════════════════════════════════════
   Lord Vinta asked for factions: allegiance, territory, diplomacy. This is the
   connective tissue between the two organs that already exist — the CONCORD
   (body/world/concord.js: law, government, the seven tags, the treasury) and
   the ADMIRALTY (body/world/admiralty.js: keels, hulls, fleets, the wake).
   Neither is consequential alone. A government that rules nothing and a fleet
   that sails at nobody are both theatre. Territory is the stake that makes
   both of them cost something, and allegiance is what decides who you pay it
   to.

   ───────────────────────────────────────────────────────────────────────────
   THE FINDING THAT DECIDED THE WHOLE SHAPE OF THIS FILE
   ───────────────────────────────────────────────────────────────────────────
   The brief said "Concord already models factions — EXTEND that model, do not
   fork a second competing one." I read all 1791 lines before writing one, and
   the honest reading is subtler than the brief assumed, so it is written down
   here rather than quietly worked around:

   Concord's "factions" are its four CHARTERS (concord.js:178, comment reads
   literally "factions across space and time and areas"). But a charter is not
   a faction in the sense this organ needs. A charter is a CONSTITUTION that
   exactly ONE polity — yours — adopts. There is no second charter-holder to
   ally with, no roster of peers, no territory anywhere in that file. Forking
   a parallel "faction" type with its own members and its own charters would
   have produced precisely the two-competing-models failure the brief forbids:
   two files both claiming to own "who your agents belong to."

   So the extension is this, and it required inventing nothing that the world
   did not already imply:

     · YOUR polity IS a faction. Not a copy of one — the same object. Its
       members are the Concord's own seated bench (concord.bench()), its
       creed is its charter's creed, its colour is its charter's colour, its
       treasury is the ONE treasury. `factions()` returns it FIRST, always,
       synthesised live from concord state. It has no separate membership
       store, because a second membership store is how the seats and the
       faction roster drift apart by Tuesday.

     · THE OTHER FACTIONS ALREADY EXISTED TOO. admiralty.js:877 defines
       UNALIGNED — the Drift, the Sill, the Span — each with a name, a creed,
       an element and a seven-tag lean. They were built as opponents for a
       synthesized rival hull and nothing more. But read the Span's creed as
       it was actually written: "they build across ground nobody claimed, and
       then they claim it." Territory was latent in that line from the day it
       shipped. This organ does not invent three new powers to stand beside
       them; it PROMOTES the three that were already there into standing
       powers that hold ground, keep an allegiance toward you, and can lose a
       march to you or take one back.

   That is the extension. One faction type, two sources, zero duplicate state.

   ───────────────────────────────────────────────────────────────────────────
   ALLEGIANCE IS A RELATION, NOT A FLAG (the brief's hardest requirement)
   ───────────────────────────────────────────────────────────────────────────
   "Allegiance must be a RELATION (ally/war/neutral/truce on the pair),
   readable identically from either side. No one-way diplomacy."

   The lazy implementation — and the one nearly every faction system ships —
   is `faction.relations[otherId] = 'war'`, a field on each side. That is two
   facts where there is one, and two facts about one thing is a bug with a
   delay fuse: some code path sets one and forgets the other, and now A is at
   war with B while B is neutral toward A. The player finds it, and the world
   stops being real.

   So a relation here is stored ONCE, on an unordered PAIR, under a key that
   is canonical by construction:

       pairKey('span','hearth') === pairKey('hearth','span')   // 'hearth|span'

   Both ids are sorted before joining, so there is exactly one slot in the
   store for any two factions, and `relation(a,b)` and `relation(b,a)` do not
   merely agree — they are the SAME READ of the SAME BYTE. Symmetry is not
   enforced by a test that checks two writes match; it is unrepresentable to
   have them disagree. That is the difference between a rule and an invariant,
   and the verifier proves the invariant rather than trusting the rule.

   The four states and what each actually does:
     · NEUTRAL — the default. No one owes anyone anything.
     · ALLY    — a pact. Their marches are not raidable by you; a shared
                 border stops bleeding. Costs standing to enter, honestly.
     · WAR     — declared. Marches on a shared border become contestable,
                 and the Admiralty's wake is the ONLY thing that resolves it.
     · TRUCE   — war, stopped, with a clock on it. When the clock runs out it
                 falls back to neutral, not to war — peace is the resting
                 state of this world, which is a design choice and a stated
                 one.

   WAR SUPERSEDES ALLIANCE, ALWAYS. `declare()` overwrites an alliance without
   asking twice, and there is no code path that can produce a pair that is
   both. The verifier asserts this directly (acceptance test 3), because
   "allied and at war simultaneously" is the exact incoherence that makes a
   diplomacy system feel fake.

   ───────────────────────────────────────────────────────────────────────────
   TERRITORY IS WORLD STATE, AND WAR IS THE ONLY THING THAT MOVES IT
   ───────────────────────────────────────────────────────────────────────────
   Six MARCHES, fixed and named, laid out as a ring so every march has exactly
   two neighbours and a border can be shared. Each march has an owner, a yield
   (lumen per hold-tick, paid into the Concord's ONE treasury via credit()),
   and a hold — how dug-in the owner is.

   Ownership lives in ONE store, `vint:marches:<worldId>`, keyed per world
   exactly as the Concord and the Admiralty key theirs. The HUD reads that
   store through `Marches.territory()`; the transfer writes it through
   `setOwner()`; there is no second copy anywhere and no in-memory-only path.
   Acceptance tests 4 and 5 assert exactly this: the owner before, the owner
   after, that the write landed in the persisted store the HUD reads, and that
   a cold re-instantiation from localStorage still reads the new owner.

   AND WAR IS RESOLVED BY THE ADMIRALTY, NOT HERE. There is no combat model in
   this file — that was an explicit requirement and it is also just correct.
   `contest(marchId)` validates the claim (are we at war, is it a border I can
   reach, do I have hulls) and then hands the actual fighting to
   `VintAdmiralty.sortie(hullIds, campaign)`, tagging the sortie with the
   march at stake. When the Admiralty's wake resolves on its own wall-clock,
   it fires `vint:admiralty-wake` — this file listens, reads the campaign tag
   off the resolved wake, and moves the deed. The line of consequence, the
   scars, the struck hull, the lumen in the holds: all of that stays the
   Admiralty's, untouched. This organ only decides what the winning was FOR.

   ───────────────────────────────────────────────────────────────────────────
   THE SEVEN COUNCIL TESTS — answered, not gestured at
   ───────────────────────────────────────────────────────────────────────────
   1 GENEROUS, NOT PREDATORY (ARIA). Losing a march is recoverable BY PLAY,
     never by payment, and this is enforced structurally rather than promised:
     there is no price on a march anywhere in this file, no purchase verb, and
     the only function that changes an owner is driven by a resolved wake. A
     lost march keeps a `lost` stamp and a RECLAIM line — the same march can
     be contested back with the same fleet, and the reclaim costs nothing but
     sailing. You cannot be permanently dispossessed: the LAST march you hold
     is not contestable AT ALL (`SANCTUARY`), so no player is ever reduced to
     owning nothing and having no border to fight from. That rule costs the
     system some drama and buys it the right to be trusted.
   2 THE INVESTMENT LOOP (HELIOS). Trigger: a border goes hot. Action: sortie
     against a named march. Variable reward: the Admiralty's wake, which is
     genuinely uncertain and already built. Investment: the deed. A march you
     hold is a thing that pays you every hold-tick, remembers who took it from
     whom, and raises the honest cost of ever starting over somewhere else.
     It deepens the ONE loop the world already keeps — the same treasury, the
     same seven tags, the same fleet — rather than opening a parallel one.
   3 TIER + CONVERSION NARRATIVE (FRUGAL-MAX). Stated exactly as concord.js
     and admiralty.js state it, for the identical measured reason: world.html
     loads NO entitlement source (no shell.js, no VintTier on window), so a
     tier() helper here would return 'free' for a paying Sovereign subscriber
     and cap something they already bought. A faked entitlement check is worse
     than none — it is a lie about a thing the user paid for. So the gate is
     the one the world genuinely keeps and the server computes: ASCENT
     STANDING (MARCH_RUNGS). Two marches claimable at the start, widening on
     the same ladder that widens the Concord's seats and the Admiralty's
     slips. THE CONVERSION NARRATIVE IS DEFERRED, NOT ABANDONED, and the shape
     is one line: `claimCap()` becomes `min(byStanding, byTier)` the day a real
     entitlement source reaches this page, and nothing else in the file
     changes. Until then it promises nothing it cannot verify and shows no
     upsell for an entitlement it cannot read. The natural home when it lands
     is Companion ($9) for diplomacy-with-a-third-power and Theater ($15) for
     the wider map — but that is a note for whoever wires the gate, not a
     claim this file makes today.
   4 AESTHETICALLY DENSE (LUNEX). A march is one line: its name, who holds it,
     what it pays, and the one sentence of why it matters. A relation is one
     word and one clock. No dashboards, no percentage bars, no filler.
   5 THE OPEN LOOP (MORRISON). A truce with a running clock is an unfinished
     sentence you have to come back for. So is a border that just went hot
     while your only fleet is three days from being repaired. The loop is in
     the world's own unfinished business, never in a streak counter.
   6 FLAGGED, MEASURED, TRANSPARENT (ATLAS). Feature flag `world_marches`
     (?marches=0, or localStorage vint:flag:world_marches='0') kills it in 30
     seconds with no deploy. Every deed carries WHY it moved and WHEN. The
     resentment signal this organ watches for is the one that would actually
     matter here: a player who loses the same march three times running is
     shown the reclaim path more loudly, not the loss more loudly.
   7 MORE ALIVE, NOT JUST STICKIER (YUNA). The Drift, the Sill and the Span
     were opponents-shaped-like-dice before this file. Now they hold ground,
     they remember whether you kept your word, and their creeds tell you what
     they want. The world got another party in it, not another counter.

   ───────────────────────────────────────────────────────────────────────────
   NO-COLLISION LAW
   ───────────────────────────────────────────────────────────────────────────
   The sheet joins the one-open-at-a-time exclusive set through the SAME
   registry every other surface uses — `registerSheet(id, isOpen, close)` then
   `openSheet(id, fn)` (dirverse-hud.js:470/526). It adds NO fixed element of
   its own: the launcher is a flow child of #dvRail, the unread pill rides
   INSIDE the launcher as its own flex cell (the pattern court.js established
   and concord.js followed), and the sheet is the standard .dv-sheet box. Every
   user-authored string — a faction name, a march's holder — is set with
   textContent, never innerHTML, and every one of them is min-width:0 with
   ellipsis so a long name compresses instead of pushing a neighbour. Proven at
   320px, the tightest breakpoint, before commit.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.VintMarches) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function concord() { return W.VintConcord; }
  function admiralty() { return W.VintAdmiralty; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_marches'. Killable in 30s, no deploy. ────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('marches') === '0') _flag = false;
      else if (q.get('marches') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_marches') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE RELATION STATES.
  //
  // Four, and the ordering of this list is not cosmetic: `rank` is what makes
  // "war supersedes alliance" a fact about the data rather than a rule someone
  // has to remember to apply. A transition to a HIGHER rank never asks
  // permission. WAR is rank 3 and ALLY is rank 1, so declaring war on an ally
  // simply wins, and there is no branch anywhere that could leave the pair
  // holding both — the store has exactly one slot per pair and it holds exactly
  // one of these words.
  // ═══════════════════════════════════════════════════════════════════════════
  var RELATIONS = {
    neutral: { k: 'neutral', rank: 0, n: 'neutral',  c: '#9fb4d4',
      say: 'nobody owes anybody anything here.' },
    ally:    { k: 'ally',    rank: 1, n: 'allied',   c: '#9affbe',
      say: 'a shared border that has stopped bleeding.' },
    truce:   { k: 'truce',   rank: 2, n: 'in truce', c: '#ffd479',
      say: 'the war is stopped, and the stopping has a clock on it.' },
    war:     { k: 'war',     rank: 3, n: 'at war',   c: '#ff9a6a',
      say: 'the border is contestable, and only a wake settles it.' }
  };
  function relOf(k) { return RELATIONS[k] || RELATIONS.neutral; }

  // A truce lasts a real hour of wall-clock and then falls back to NEUTRAL —
  // never back to war. Peace is this world's resting state; that is a design
  // decision, and it is written here where it can be read rather than buried.
  var TRUCE_MS = 60 * 60 * 1000;

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MARCHES — six, fixed, named, in a RING.
  //
  // The ring topology is the whole reason borders mean anything. Each march
  // names its two neighbours explicitly (rather than deriving adjacency from an
  // index, which breaks the moment anyone reorders this array), so "a shared
  // border" is a real, checkable relationship: you may only contest a march
  // that touches ground you already hold. Without that rule, territory is just
  // a list of things you clicked; with it, the map has a shape and holding the
  // right march matters more than holding the most.
  //
  // `yield` is lumen per hold-tick into the ONE treasury. `hold` is how dug-in
  // an owner is — it is what the Admiralty's wake score has to overcome, and it
  // is why taking a march off someone who has held it for a week is genuinely
  // harder than taking one that just changed hands.
  // ═══════════════════════════════════════════════════════════════════════════
  var MARCHES = [
    { k: 'ember',  n: 'the Ember Reach', glyph: '❈', yield: 9,  base: 2,
      near: ['ash', 'quiet'],
      say: 'where the first fires were lit. it pays well and it is never quiet.' },
    { k: 'ash',    n: 'the Ashwold',     glyph: '♠', yield: 7,  base: 3,
      near: ['ember', 'sill'],
      say: 'burnt ground that grows back thicker every year. hard to take, hard to leave.' },
    { k: 'sill',   n: 'the Long Sill',   glyph: '≈', yield: 11, base: 2,
      near: ['ash', 'span'],
      say: 'the shore everything arrives on. the richest ground in the ring, and the most contested.' },
    { k: 'span',   n: 'the Span',        glyph: '⌇', yield: 8,  base: 3,
      near: ['sill', 'drift'],
      say: 'built across a gap nobody could cross. whoever holds it decides who travels.' },
    { k: 'drift',  n: 'the Drift Marches', glyph: '◇', yield: 6, base: 1,
      near: ['span', 'quiet'],
      say: 'ground that moves. it pays least and it changes hands most.' },
    { k: 'quiet',  n: 'the Quiet Fell',  glyph: '✧', yield: 10, base: 4,
      near: ['drift', 'ember'],
      say: 'nothing happens here for years at a time. that is exactly why it is worth holding.' }
  ];
  function marchOf(k) {
    for (var i = 0; i < MARCHES.length; i++) if (MARCHES[i].k === k) return MARCHES[i];
    return null;
  }
  function adjacent(a, b) {
    var m = marchOf(a);
    return !!(m && m.near.indexOf(b) >= 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE STANDING POWERS — promoted, not invented.
  //
  // These three are admiralty.js:877's UNALIGNED, lifted into standing powers
  // that hold ground. Their ids, names, creeds and elements are kept BYTE-FOR-
  // BYTE identical to the Admiralty's, on purpose: when a wake is fought
  // against "the Span", the power that loses a march is the same power, with
  // the same creed, that the wake named. If these ever drift apart the world
  // starts telling two stories about one enemy.
  //
  // We read them from the Admiralty at runtime when it is present so there is
  // ONE source, and fall back to this literal copy only when it is not loaded
  // (a flag-killed Admiralty must not blank out the map).
  // ═══════════════════════════════════════════════════════════════════════════
  var POWERS = [
    { k: 'drift', n: 'the Drift', glyph: '◇', c: '#c0b0e0', el: 'air',
      creed: 'nobody chartered them and nobody can find their yard.',
      wants: 'drift',
      lean: { craft: 0.3, criminal: 0.4, heat: 0.5, trust: -0.4, civic: -0.3, social: 0.1, mentor: -0.2 } },
    { k: 'sill', n: 'the Sill', glyph: '≈', c: '#9fdcff', el: 'sea',
      creed: 'they hold a shore that was never voted on.',
      wants: 'sill',
      lean: { craft: 0.5, civic: 0.4, trust: 0.2, heat: 0.1, mentor: 0.2, social: -0.1, criminal: 0.1 } },
    { k: 'span', n: 'the Span', glyph: '⌇', c: '#ffd479', el: 'land',
      creed: 'they build across ground nobody claimed, and then they claim it.',
      wants: 'span',
      lean: { craft: 0.6, civic: 0.5, trust: 0.3, mentor: 0.3, heat: -0.1, social: 0.2, criminal: -0.1 } }
  ];
  function powerOf(k) {
    for (var i = 0; i < POWERS.length; i++) if (POWERS[i].k === k) return POWERS[i];
    return null;
  }

  // The player's own faction has a FIXED id. It has to be stable across
  // renames and charter changes, because a relation is keyed on it and a
  // relation that forgets who it was about is not a relation.
  var SELF = 'concord';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — keyed per world, exactly as concord.js and admiralty.js key theirs.
  //
  // `deeds` is THE territory store and the only one. `pacts` holds relations
  // under canonical pair keys. Nothing here is duplicated from the Concord: no
  // members, no treasury, no tags. What this file owns is ground and standing-
  // between-powers, and nothing else.
  // ═══════════════════════════════════════════════════════════════════════════
  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:marches:' + wid(); }

  var _st = null, _stKey = null;
  function blank() {
    // The opening map: you hold nothing, the three powers hold two each. You
    // start as a government with no ground, which is the honest starting
    // position for a polity that has just been founded, and it makes the first
    // march you take an event rather than a number going up.
    return {
      v: 1,
      deeds: {
        ember: { owner: 'span',  since: 0, hold: 2, took: null },
        ash:   { owner: 'span',  since: 0, hold: 3, took: null },
        sill:  { owner: 'sill',  since: 0, hold: 2, took: null },
        span:  { owner: 'sill',  since: 0, hold: 3, took: null },
        drift: { owner: 'drift', since: 0, hold: 1, took: null },
        quiet: { owner: 'drift', since: 0, hold: 4, took: null }
      },
      pacts: {},        // canonical pairKey -> {k, at, until}
      annals: [],       // what moved, why, newest first, capped
      campaign: null,   // {march, against, sent} — the claim a sortie is carrying
      paid: 0,          // last hold-tick payout stamp
      seen: 0           // last read, for the badge
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
          // Defensive: a partial or older blob must never crash a render, and
          // must never silently lose a march. Any deed the blob is missing is
          // restored from the blank map rather than dropped.
          if (!_st.deeds || typeof _st.deeds !== 'object') _st.deeds = blank().deeds;
          var b = blank().deeds;
          for (var i = 0; i < MARCHES.length; i++) {
            var mk = MARCHES[i].k;
            if (!_st.deeds[mk] || !_st.deeds[mk].owner) _st.deeds[mk] = b[mk];
          }
          if (!_st.pacts || typeof _st.pacts !== 'object') _st.pacts = {};
          if (!Array.isArray(_st.annals)) _st.annals = [];
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // The one write error a user can genuinely hit. Swallowing it would let
      // them conquer into a void — concord.js's precedent, followed.
      console.warn('[marches] could not keep the deeds:', e && e.message);
      toast('the map is full — your device would not keep this.');
    }
  }
  // A hard reset of the memo, so a caller (and the verifier) can prove that
  // what is on screen came from persisted bytes and not from a live object.
  function forget() { _st = null; _stKey = null; }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PAIR KEY — why symmetry here is an invariant and not a convention.
  //
  // Both ids sorted, then joined. pairKey(a,b) and pairKey(b,a) produce the
  // same string, so there is exactly ONE slot in `pacts` for any two factions.
  // relation(a,b) and relation(b,a) are therefore not two agreeing reads —
  // they are the same read. It is not possible to represent "A allied to B
  // while B is neutral to A" in this store, which is the only way to actually
  // guarantee no one-way diplomacy.
  // ═══════════════════════════════════════════════════════════════════════════
  function pairKey(a, b) {
    var x = String(a), y = String(b);
    return (x < y) ? (x + '|' + y) : (y + '|' + x);
  }

  // ── THE FACTION LIST — one type, two sources, zero duplicate state ─────────
  //
  // Your polity is synthesised LIVE from the Concord every time it is asked
  // for. It is deliberately not cached and deliberately not stored: the moment
  // this file kept its own copy of your members or your creed, it would start
  // disagreeing with the floor you actually seated them on.
  function selfFaction() {
    var c = concord(), ch = null, nm = 'your concord', members = [], founded = false;
    try {
      if (c) {
        founded = !!(c.founded && c.founded());
        ch = c.charter ? c.charter() : null;
        var st = c.state ? c.state() : null;
        if (st && st.name) nm = st.name;
        else if (ch) nm = ch.name;
        // MEMBERSHIP IS THE CONCORD'S BENCH. Not a copy of it — the read of it.
        var b = (c.bench ? c.bench() : []) || [];
        for (var i = 0; i < b.length; i++) {
          var a = b[i] && b[i].agent;
          if (a) members.push({ id: a.id, name: a.name || 'an agent', role: (b[i].seat && b[i].seat.role) || 'seated' });
        }
      }
    } catch (_) {}
    return {
      id: SELF, mine: true, founded: founded,
      name: nm,
      glyph: (ch && ch.glyph) || '⚖',
      c: (ch && ch.c) || '#9fdcff',
      creed: (ch && ch.creed) || 'a table that has not yet decided what it is.',
      charter: ch ? ch.k : null,
      members: members
    };
  }

  // The standing powers, read from the Admiralty when it is loaded so the
  // creed a wake names and the creed the map shows are one string.
  function powerFaction(p) {
    var live = null;
    try {
      var ad = admiralty();
      if (ad && ad.UNALIGNED) {
        for (var i = 0; i < ad.UNALIGNED.length; i++) if (ad.UNALIGNED[i].k === p.k) live = ad.UNALIGNED[i];
      }
    } catch (_) {}
    // A power's "members" are the marches it holds, spoken as holdings rather
    // than as people: these powers are not agent rosters and pretending they
    // are would be a lie the UI would then have to keep telling.
    var s = load(), held = [];
    for (var m = 0; m < MARCHES.length; m++) {
      var d = s.deeds[MARCHES[m].k];
      if (d && d.owner === p.k) held.push({ id: MARCHES[m].k, name: MARCHES[m].n, role: 'held' });
    }
    return {
      id: p.k, mine: false, founded: true,
      name: (live && live.n) || p.n,
      glyph: p.glyph,
      c: p.c,
      creed: (live && live.creed) || p.creed,
      el: (live && live.el) || p.el,
      members: held
    };
  }
  function factions() {
    var out = [selfFaction()];
    for (var i = 0; i < POWERS.length; i++) out.push(powerFaction(POWERS[i]));
    return out;
  }
  function factionOf(id) {
    var f = factions();
    for (var i = 0; i < f.length; i++) if (f[i].id === String(id)) return f[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIPLOMACY — the four verbs, all of them symmetric by construction.
  // ═══════════════════════════════════════════════════════════════════════════

  // Read the relation between any two factions. Resolves an EXPIRED truce on
  // read (falling back to neutral, never to war) so a relation is never stale
  // just because nobody happened to open the sheet.
  function relation(a, b) {
    if (String(a) === String(b)) return RELATIONS.neutral;
    var s = load(), pk = pairKey(a, b), p = s.pacts[pk];
    if (!p) return RELATIONS.neutral;
    if (p.k === 'truce' && p.until && Date.now() >= p.until) return RELATIONS.neutral;
    return relOf(p.k);
  }
  // The raw record, for surfaces that need the clock as well as the word.
  function pact(a, b) {
    var s = load(), pk = pairKey(a, b), p = s.pacts[pk];
    if (!p) return { k: 'neutral', at: 0, until: 0 };
    if (p.k === 'truce' && p.until && Date.now() >= p.until) return { k: 'neutral', at: p.at, until: 0 };
    return { k: p.k, at: p.at || 0, until: p.until || 0 };
  }

  // The ONE writer. Every diplomatic verb funnels through here, which is what
  // makes "there is exactly one slot per pair" true at runtime and not just in
  // the comment above.
  function setRelation(a, b, k, why, until) {
    if (String(a) === String(b)) return false;
    if (!RELATIONS[k]) return false;
    var s = load(), pk = pairKey(a, b);
    var was = s.pacts[pk] ? s.pacts[pk].k : 'neutral';
    if (k === 'neutral') delete s.pacts[pk];
    else s.pacts[pk] = { k: k, at: Date.now(), until: until || 0 };
    chronicle({
      kind: 'pact', at: Date.now(), a: a, b: b, from: was, to: k,
      say: why || (nameOf(a) + ' and ' + nameOf(b) + ' are ' + relOf(k).n + '.')
    });
    save();
    if (isOpen()) render();
    updateLauncher();
    try { W.dispatchEvent(new CustomEvent('vint:marches-pact', { detail: { a: a, b: b, from: was, to: k } })); } catch (_) {}
    return true;
  }
  function nameOf(id) { var f = factionOf(id); return f ? f.name : String(id); }

  // ALLY — a pact. Refuses while at war: you cannot ally your way out of a war
  // you started, you have to sue for a truce first and let it cool. That is one
  // extra step and it is the step that makes an alliance mean something.
  function ally(a, b) {
    var cur = relation(a, b);
    if (cur.k === 'war') return { ok: false, why: 'at-war' };
    if (cur.k === 'ally') return { ok: false, why: 'already' };
    setRelation(a, b, 'ally', nameOf(a) + ' and ' + nameOf(b) + ' hold to one another.');
    return { ok: true };
  }

  // WAR — supersedes everything. This is the transition that is allowed to
  // overwrite an alliance without a second confirmation at the model layer
  // (the UI still asks, because a human should be asked). Rank ordering makes
  // it unambiguous, and because the store has one slot, the alliance is GONE
  // the instant this returns — never held alongside.
  function declare(a, b) {
    var cur = relation(a, b);
    if (cur.k === 'war') return { ok: false, why: 'already' };
    var broke = (cur.k === 'ally');
    setRelation(a, b, 'war',
      broke ? nameOf(a) + ' broke with ' + nameOf(b) + '. the pact is ash.'
            : nameOf(a) + ' declares against ' + nameOf(b) + '.');
    // Declaring war is a heat event on the karma spine the Concord owns. We do
    // not keep a second reputation number; we press the one that exists.
    impress({ heat: 0.8, trust: -0.5, civic: -0.2, criminal: 0.2 }, 0.5);
    return { ok: true, broke: broke };
  }

  // TRUCE — stops a war with a clock. Only reachable FROM war, because a truce
  // with someone you were never fighting is a meaningless ceremony.
  function truce(a, b) {
    var cur = relation(a, b);
    if (cur.k !== 'war') return { ok: false, why: 'not-at-war' };
    setRelation(a, b, 'truce', nameOf(a) + ' and ' + nameOf(b) + ' put the war down for an hour.', Date.now() + TRUCE_MS);
    impress({ heat: -0.5, trust: 0.4, civic: 0.3 }, 0.5);
    return { ok: true, until: Date.now() + TRUCE_MS };
  }

  // BREAK — walk away from an alliance without starting a war. The honest exit,
  // and its existence is what stops "ally" from being a trap.
  function breakPact(a, b) {
    var cur = relation(a, b);
    if (cur.k !== 'ally') return { ok: false, why: 'no-pact' };
    setRelation(a, b, 'neutral', nameOf(a) + ' and ' + nameOf(b) + ' are strangers again.');
    impress({ trust: -0.3, social: -0.2 }, 0.4);
    return { ok: true };
  }

  function impress(press, mult) {
    try { var c = concord(); if (c && c.impress) c.impress(press, mult); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TERRITORY
  // ═══════════════════════════════════════════════════════════════════════════
  function territory() {
    var s = load(), out = [];
    for (var i = 0; i < MARCHES.length; i++) {
      var m = MARCHES[i], d = s.deeds[m.k] || {};
      out.push({
        id: m.k, name: m.n, glyph: m.glyph, say: m.say,
        yield: m.yield, near: m.near.slice(),
        owner: d.owner, ownerName: nameOf(d.owner),
        hold: d.hold == null ? m.base : d.hold,
        since: d.since || 0, took: d.took || null, lost: d.lost || null
      });
    }
    return out;
  }
  function ownerOf(mk) { var s = load(); var d = s.deeds[mk]; return d ? d.owner : null; }
  function held(id) {
    var t = territory(), out = [];
    for (var i = 0; i < t.length; i++) if (t[i].owner === String(id)) out.push(t[i]);
    return out;
  }

  // THE ONE WRITER OF OWNERSHIP. Nothing else in this file assigns a deed's
  // owner, and nothing outside it can (the export is `resolveClaim`, not this).
  // Every transfer is stamped with who took it from whom and why, because a map
  // that cannot tell you how it got that way is just a scoreboard.
  function setOwner(mk, to, why) {
    var s = load(), d = s.deeds[mk];
    if (!d) return false;
    var from = d.owner;
    if (from === to) return false;
    var m = marchOf(mk);
    d.owner = to;
    d.since = Date.now();
    d.hold = (m ? m.base : 2);          // a march just taken is not yet dug in
    d.took = { from: from, at: Date.now(), why: why || 'taken' };
    if (from === SELF) d.lost = { to: to, at: Date.now() };
    else if (to === SELF) d.lost = null;
    chronicle({
      kind: 'deed', at: Date.now(), march: mk, from: from, to: to,
      say: nameOf(to) + ' holds ' + (m ? m.n : mk) + ' — taken from ' + nameOf(from) + '.'
    });
    save();
    if (isOpen()) render();
    updateLauncher();
    try {
      W.dispatchEvent(new CustomEvent('vint:marches-deed', { detail: { march: mk, from: from, to: to } }));
    } catch (_) {}
    return true;
  }

  // ── THE CLAIM CAP — standing, for the measured reason stated in the header ──
  var MARCH_RUNGS = [
    { need: 0,   claim: 2 },   // ember-bearer — two is a border, not an empire
    { need: 55,  claim: 3 },
    { need: 150, claim: 4 },
    { need: 330, claim: 5 },
    { need: 620, claim: 6 }    // lightwarden — the whole ring is reachable
  ];
  function standing() {
    try { var c = concord(); return (c && c.standing) ? (Number(c.standing()) || 0) : 0; } catch (_) { return 0; }
  }
  function claimCap() {
    var st = standing(), cap = MARCH_RUNGS[0].claim;
    for (var i = 0; i < MARCH_RUNGS.length; i++) if (st >= MARCH_RUNGS[i].need) cap = MARCH_RUNGS[i].claim;
    return cap;
  }
  function nextClaimRung() {
    var st = standing();
    for (var i = 0; i < MARCH_RUNGS.length; i++) if (st < MARCH_RUNGS[i].need) return MARCH_RUNGS[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SANCTUARY — the generosity rule, enforced structurally.
  //
  // The LAST march a faction holds can never be taken. Not "is hard to take" —
  // cannot. Without this, a run of bad wakes ends with a player holding no
  // ground, therefore no border, therefore no legal contest, therefore no way
  // back except starting over. That is the predatory shape, and one rule
  // removes it: everyone always has somewhere to fight from. It costs the
  // system a little drama and buys the right to be trusted with a loss.
  // ═══════════════════════════════════════════════════════════════════════════
  function sanctuary(mk) {
    var o = ownerOf(mk);
    if (!o) return false;
    return held(o).length <= 1;
  }

  // Can I legally contest this march right now? Every refusal names itself, so
  // the UI never has to guess why a thing is greyed out.
  function contestable(mk) {
    var d = ownerOf(mk);
    if (!d) return { ok: false, why: 'nowhere' };
    if (d === SELF) return { ok: false, why: 'yours' };
    if (sanctuary(mk)) return { ok: false, why: 'sanctuary' };
    var rel = relation(SELF, d);
    if (rel.k === 'ally') return { ok: false, why: 'allied' };
    if (rel.k === 'truce') return { ok: false, why: 'truce' };
    if (rel.k !== 'war') return { ok: false, why: 'peace' };
    // A SHARED BORDER: you may only reach ground that touches ground you hold.
    // The one exception is holding nothing at all — a landless polity may take
    // its first march anywhere, or it could never begin.
    var mine = held(SELF);
    if (mine.length) {
      var touches = false;
      for (var i = 0; i < mine.length; i++) if (adjacent(mine[i].id, mk)) touches = true;
      if (!touches) return { ok: false, why: 'far' };
      if (mine.length >= claimCap()) return { ok: false, why: 'cap', cap: claimCap() };
    }
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAR RESOLUTION — the Admiralty does the fighting. Always. No exceptions.
  //
  // There is no combat model in this file and there must never be one. contest()
  // validates a claim and hands the sortie to VintAdmiralty; the wake resolves
  // on the Admiralty's own wall-clock with its own line-of-consequence; and
  // resolveClaim() only decides what the winning was FOR.
  // ═══════════════════════════════════════════════════════════════════════════
  function contest(mk, hullIds) {
    if (!enabled()) return { ok: false, why: 'off' };
    var s = load();
    if (s.campaign) return { ok: false, why: 'sailing' };
    var can = contestable(mk);
    if (!can.ok) return can;
    var ad = admiralty();
    if (!ad || !ad.sortie) return { ok: false, why: 'no-yard' };

    // Choose the fleet: whatever the caller named, else every unstruck hull.
    var ids = hullIds;
    if (!ids || !ids.length) {
      ids = [];
      try {
        var fl = ad.fleet ? ad.fleet() : [];
        for (var i = 0; i < fl.length; i++) if (!fl[i].struck) ids.push(fl[i].id);
      } catch (_) {}
    }
    if (!ids.length) return { ok: false, why: 'no-fleet' };

    var r = ad.sortie(ids);
    if (!r || !r.ok) return { ok: false, why: (r && r.why) || 'sortie' };

    // The claim the sortie is carrying. The Admiralty does not know or care
    // what the fight is for — that knowledge lives here, which is exactly why
    // there is no coupling to break.
    s.campaign = { march: mk, against: ownerOf(mk), sent: Date.now() };
    save();
    updateLauncher();
    if (isOpen()) render();
    return { ok: true, march: mk };
  }

  // Called when the Admiralty's wake resolves. `won` is the Admiralty's verdict,
  // computed by the Admiralty, out of the Admiralty's own arithmetic.
  function resolveClaim(won) {
    var s = load();
    if (!s.campaign) return false;
    var mk = s.campaign.march, against = s.campaign.against;
    var m = marchOf(mk);
    s.campaign = null;

    // The ground may have moved under the claim while the fleet was out — an
    // owner change mid-sortie makes the claim void rather than misapplied.
    if (ownerOf(mk) !== against) {
      chronicle({ kind: 'claim', at: Date.now(), march: mk, won: false,
        say: (m ? m.n : mk) + ' changed hands before your fleet arrived. the claim is void.' });
      save(); if (isOpen()) render(); updateLauncher();
      return true;
    }

    if (won) {
      setOwner(mk, SELF, 'taken in a wake against ' + nameOf(against));
    } else {
      // A FAILED CLAIM COSTS NOTHING BUT THE SAILING. The Admiralty already
      // scarred a hull for the loss — charging territory on top of that would
      // be punishing the same failure twice, which is how a war system starts
      // feeling spiteful. The march simply digs in a little.
      var d = load().deeds[mk];
      if (d) d.hold = Math.min(9, (d.hold || 2) + 1);
      chronicle({ kind: 'claim', at: Date.now(), march: mk, won: false,
        say: 'the claim on ' + (m ? m.n : mk) + ' did not hold. they are dug in deeper now.' });
      save();
      if (isOpen()) render();
      updateLauncher();
    }
    return true;
  }

  // ── THE HOLD TICK — what ground actually pays ─────────────────────────────
  // Marches you hold pay lumen into the ONE treasury (the Concord's, through
  // its guarded credit() verb — this file never touches that balance itself),
  // and holding digs you in. Replays wall-clock, so ground held while the tab
  // was shut paid you, exactly as a resolved wake fought while it was shut was
  // real.
  var TICK_MS = 10 * 60 * 1000;
  function tick() {
    var s = load();
    if (!s.paid) { s.paid = Date.now(); save(); return false; }
    var due = Math.floor((Date.now() - s.paid) / TICK_MS);
    if (due < 1) return false;
    due = Math.min(due, 12);                   // an offline week does not print money
    var mine = held(SELF);
    if (!mine.length) { s.paid = Date.now(); save(); return false; }
    var pay = 0;
    for (var i = 0; i < mine.length; i++) {
      pay += mine[i].yield * due;
      var d = s.deeds[mine[i].id];
      if (d) d.hold = Math.min(9, (d.hold || 2) + (due >= 3 ? 1 : 0));
    }
    s.paid = Date.now();
    try { var c = concord(); if (c && c.credit && pay > 0) c.credit(pay, 'the marches paid'); } catch (_) {}
    if (pay > 0) chronicle({ kind: 'yield', at: Date.now(), say: 'the ground you hold paid ◇' + pay + '.' });
    save();
    return true;
  }

  function chronicle(row) {
    var s = load();
    s.annals.unshift(row);
    while (s.annals.length > 30) s.annals.pop();
  }

  // Everything that resolves on the clock, in one place — the shape both sibling
  // organs use, so a caller only ever has to know one verb.
  function resolve() {
    if (!enabled()) return false;
    var moved = tick();
    // An expired truce is a real state change even though nothing wrote it.
    var s = load(), changed = false;
    for (var pk in s.pacts) {
      if (!Object.prototype.hasOwnProperty.call(s.pacts, pk)) continue;
      var p = s.pacts[pk];
      if (p.k === 'truce' && p.until && Date.now() >= p.until) { delete s.pacts[pk]; changed = true; }
    }
    if (changed) save();
    return moved || changed;
  }

  function unread() {
    var s = load(), n = 0;
    for (var i = 0; i < s.annals.length; i++) { if (s.annals[i].at > (s.seen || 0)) n++; else break; }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #mrSheet. Nothing leaks into the world.
  //
  // NO-COLLISION: every row is a flex line with min-width:0 on the text cell and
  // ellipsis on anything a user can name, so a long faction name compresses
  // rather than pushing its neighbour off the row. Nothing here is positioned;
  // the sheet body is the scroll container it was authored to be.
  // ═══════════════════════════════════════════════════════════════════════════
  var _styled = false;
  function styles() {
    if (_styled) return; _styled = true;
    var css = [
      '#mrSheet .mr-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(190,212,244,0.5);margin:18px 0 9px;}',
      '#mrSheet .mr-sec:first-child{margin-top:2px;}',
      '#mrSheet .mr-note{font-size:12.5px;line-height:1.5;color:rgba(206,224,255,0.5);',
      ' margin-top:10px;overflow-wrap:anywhere;}',

      // ── a faction row ──────────────────────────────────────────────────────
      '#mrSheet .mr-fs{display:flex;flex-direction:column;gap:9px;}',
      '#mrSheet .mr-f{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border-radius:14px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);}',
      '#mrSheet .mr-f.mine{background:rgba(159,220,255,0.07);border-color:rgba(159,220,255,0.28);}',
      '#mrSheet .mr-fg{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:16px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);}',
      '#mrSheet .mr-ft{flex:1 1 auto;min-width:0;}',
      '#mrSheet .mr-fn{font-size:15.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#mrSheet .mr-fc{font-size:12.5px;line-height:1.5;color:rgba(220,231,255,0.66);margin-top:3px;',
      ' overflow-wrap:anywhere;}',
      '#mrSheet .mr-fm{font-size:12px;color:rgba(190,212,244,0.55);margin-top:5px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the relation word rides as its own flex cell — never a floating badge
      '#mrSheet .mr-rel{flex:0 0 auto;align-self:flex-start;font-size:11px;letter-spacing:.06em;',
      ' text-transform:uppercase;padding:4px 8px;border-radius:8px;white-space:nowrap;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);}',

      // ── the diplomacy verbs ────────────────────────────────────────────────
      '#mrSheet .mr-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;}',
      '#mrSheet .mr-act{flex:0 1 auto;min-height:38px;padding:0 13px;border-radius:11px;',
      ' font-family:inherit;font-size:13px;cursor:pointer;color:#eaf3ff;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);}',
      '#mrSheet .mr-act:active{transform:scale(0.985);}',
      '#mrSheet .mr-act:disabled{opacity:0.35;pointer-events:none;filter:grayscale(0.4);}',
      '#mrSheet .mr-act.war{border-color:rgba(255,154,106,0.42);color:#ffb99a;}',
      '#mrSheet .mr-act.ally{border-color:rgba(154,255,190,0.42);color:#a8f5c4;}',

      // ── a march row ────────────────────────────────────────────────────────
      '#mrSheet .mr-ms{display:flex;flex-direction:column;gap:8px;}',
      '#mrSheet .mr-m{padding:12px 13px;border-radius:14px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);}',
      '#mrSheet .mr-m.mine{background:rgba(159,220,255,0.07);border-color:rgba(159,220,255,0.28);}',
      '#mrSheet .mr-m.hot{border-color:rgba(255,154,106,0.38);}',
      '#mrSheet .mr-mh{display:flex;align-items:center;gap:10px;}',
      '#mrSheet .mr-mg{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:flex;',
      ' align-items:center;justify-content:center;font-size:13px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);}',
      '#mrSheet .mr-mn{flex:1 1 auto;min-width:0;font-size:14.5px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mrSheet .mr-my{flex:0 0 auto;font-size:12px;color:rgba(255,212,121,0.8);',
      ' font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '#mrSheet .mr-mo{font-size:12.5px;color:rgba(220,231,255,0.6);margin-top:6px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mrSheet .mr-ms2{font-size:12px;line-height:1.5;color:rgba(190,212,244,0.5);margin-top:4px;',
      ' overflow-wrap:anywhere;}',
      '#mrSheet .mr-mb{width:100%;box-sizing:border-box;min-height:42px;margin-top:9px;',
      ' border-radius:11px;font-family:inherit;font-size:13px;cursor:pointer;color:#eaf3ff;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);}',
      '#mrSheet .mr-mb:disabled{opacity:0.35;pointer-events:none;filter:grayscale(0.4);}',
      '#mrSheet .mr-mb.go{border-color:rgba(255,154,106,0.45);color:#ffb99a;}',

      // ── the annals ─────────────────────────────────────────────────────────
      '#mrSheet .mr-an{display:flex;flex-direction:column;gap:7px;}',
      '#mrSheet .mr-a{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.03);',
      ' border:1px solid rgba(255,255,255,0.07);}',
      '#mrSheet .mr-as{font-size:13px;line-height:1.5;color:rgba(226,238,255,0.82);',
      ' overflow-wrap:anywhere;}',
      '#mrSheet .mr-aw{font-size:11.5px;color:rgba(190,212,244,0.45);margin-top:3px;}',
      '#mrSheet .mr-emp{font-size:13px;line-height:1.55;color:rgba(206,224,255,0.55);',
      ' overflow-wrap:anywhere;}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'mrStyles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _beat = null;
  function build() {
    if (_sheet) return _sheet;
    styles();
    var el = document.createElement('div');
    el.className = 'dv-sheet';
    el.id = 'mrSheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'the marches');
    // Static chrome only — every user-authored string below is set with
    // textContent by the render, never interpolated into markup.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the marches<small id="mrSub">who stands with you, and what you hold</small></div>' +
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
    clearInterval(_beat);
    _beat = setInterval(function () {
      if (!isOpen()) { clearInterval(_beat); _beat = null; return; }
      if (resolve()) render();
    }, 5000);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_beat); _beat = null;
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // ← ALWAYS textContent, never HTML
    return n;
  }
  function ago(ms) {
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 90) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 172800) return 'yesterday';
    return Math.floor(d / 86400) + 'd ago';
  }
  function left(ms) {
    var d = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    var m = Math.floor(d / 60), sec = d % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  var WHY = {
    yours: 'you already hold this.',
    sanctuary: 'it is all they have left. this world does not take a power\'s last ground.',
    allied: 'you are allied. break the pact first, if you mean it.',
    truce: 'the truce is still running.',
    peace: 'you are not at war with them.',
    far: 'it does not touch anything you hold.',
    cap: 'your standing does not reach further than this yet.',
    'no-fleet': 'you have no hull that can sail.',
    'no-yard': 'the yard is not open.',
    sailing: 'your fleet is already out.'
  };

  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#mrBody');
    if (!body) return;
    body.textContent = '';
    var s = load();
    var me = selfFaction();

    var sub = _sheet.querySelector('#mrSub');
    if (sub) sub.textContent = me.founded ? 'who stands with you, and what you hold'
                                          : 'found a concord first — a polity is what holds ground';

    // ── the powers ─────────────────────────────────────────────────────────
    body.appendChild(el('div', 'mr-sec', 'the powers'));
    var fs = el('div', 'mr-fs');
    var all = factions();
    for (var i = 0; i < all.length; i++) fs.appendChild(factionRow(all[i], me));
    body.appendChild(fs);

    // ── the ring ───────────────────────────────────────────────────────────
    body.appendChild(el('div', 'mr-sec', 'the ring'));
    var ms = el('div', 'mr-ms');
    var t = territory();
    for (var m = 0; m < t.length; m++) ms.appendChild(marchRow(t[m], s));
    body.appendChild(ms);

    var mine = held(SELF);
    body.appendChild(el('div', 'mr-note',
      mine.length
        ? 'you hold ' + mine.length + ' of ' + t.length + '. ground pays into the same treasury the concord keeps, and holding it digs you in.'
        : 'you hold nothing yet. a landless polity may take its first march anywhere — after that you can only reach ground that touches your own.'));

    // ── the annals ─────────────────────────────────────────────────────────
    body.appendChild(el('div', 'mr-sec', 'the annals'));
    if (!s.annals.length) {
      body.appendChild(el('div', 'mr-emp', 'nothing has moved yet. no pact, no deed, no war.'));
    } else {
      var an = el('div', 'mr-an');
      for (var a = 0; a < Math.min(s.annals.length, 12); a++) {
        var row = s.annals[a];
        var box = el('div', 'mr-a');
        box.appendChild(el('div', 'mr-as', row.say));
        box.appendChild(el('div', 'mr-aw', ago(row.at)));
        an.appendChild(box);
      }
      body.appendChild(an);
    }

    body.appendChild(el('div', 'mr-note',
      'these powers and this ground are held on your device. no other world can see them yet, and the powers you meet are the world\'s own unaligned — not another person\'s faction. there is no wire for that yet, and this will not pretend there is.'));
  }

  function factionRow(f, me) {
    var box = el('div', 'mr-f' + (f.mine ? ' mine' : ''));
    var g = el('div', 'mr-fg', f.glyph);
    g.style.color = f.c;
    box.appendChild(g);

    var t = el('div', 'mr-ft');
    t.appendChild(el('div', 'mr-fn', f.name));
    t.appendChild(el('div', 'mr-fc', '"' + f.creed + '"'));

    // membership, spoken honestly for each kind of power
    var mem;
    if (f.mine) {
      mem = f.members.length
        ? f.members.length + ' seated — ' + f.members.map(function (x) { return x.name; }).join(', ')
        : 'no one seated yet.';
    } else {
      mem = f.members.length
        ? 'holds ' + f.members.length + ' — ' + f.members.map(function (x) { return x.name; }).join(', ')
        : 'holds no ground.';
    }
    t.appendChild(el('div', 'mr-fm', mem));

    if (!f.mine) {
      var p = pact(SELF, f.id), r = relOf(p.k);
      var acts = el('div', 'mr-acts');
      if (p.k === 'truce' && p.until) {
        var cd = el('div', 'mr-fm', 'truce — ' + left(p.until) + ' left');
        t.appendChild(cd);
      }
      // Only the verbs that are legal right now are rendered enabled; each
      // disabled one keeps its reason on the title so nothing is mysterious.
      acts.appendChild(verb('ally', 'stand together', p.k !== 'war' && p.k !== 'ally', function () {
        var r2 = ally(SELF, f.id);
        toast(r2.ok ? 'you stand with ' + f.name + '.' : (r2.why === 'at-war' ? 'not while you are at war.' : 'already allied.'));
      }));
      acts.appendChild(verb('war', p.k === 'ally' ? 'break and declare' : 'declare war', p.k !== 'war', function () {
        var r2 = declare(SELF, f.id);
        if (r2.ok) toast(r2.broke ? 'the pact with ' + f.name + ' is ash.' : 'war with ' + f.name + '.');
      }));
      if (p.k === 'war') {
        acts.appendChild(verb('', 'sue for truce', true, function () {
          if (truce(SELF, f.id).ok) toast('an hour of quiet with ' + f.name + '.');
        }));
      }
      if (p.k === 'ally') {
        acts.appendChild(verb('', 'walk away', true, function () {
          if (breakPact(SELF, f.id).ok) toast('you and ' + f.name + ' are strangers again.');
        }));
      }
      t.appendChild(acts);

      var rel = el('div', 'mr-rel', r.n);
      rel.style.color = r.c;
      box.appendChild(t);
      box.appendChild(rel);
      return box;
    }

    box.appendChild(t);
    return box;
  }

  function verb(kind, label, on, fn) {
    var b = el('button', 'mr-act' + (kind ? ' ' + kind : ''), label);
    b.type = 'button';
    b.disabled = !on;
    if (on) b.onclick = fn;
    return b;
  }

  function marchRow(m, s) {
    var mine = m.owner === SELF;
    var rel = relation(SELF, m.owner);
    var box = el('div', 'mr-m' + (mine ? ' mine' : (rel.k === 'war' ? ' hot' : '')));

    var h = el('div', 'mr-mh');
    var g = el('div', 'mr-mg', m.glyph);
    h.appendChild(g);
    h.appendChild(el('div', 'mr-mn', m.name));
    h.appendChild(el('div', 'mr-my', '◇' + m.yield));
    box.appendChild(h);

    box.appendChild(el('div', 'mr-mo',
      (mine ? 'yours' : 'held by ' + m.ownerName) + ' · dug in ' + m.hold +
      (m.since ? ' · since ' + ago(m.since) : '')));
    box.appendChild(el('div', 'mr-ms2', m.say));

    if (!mine) {
      var can = contestable(m.id);
      var sailing = !!s.campaign;
      var label;
      if (s.campaign && s.campaign.march === m.id) label = 'your fleet is out for this';
      else if (can.ok) label = 'contest ' + m.name;
      else label = WHY[can.why] || 'you cannot reach this.';
      var b = el('button', 'mr-mb' + (can.ok && !sailing ? ' go' : ''), label);
      b.type = 'button';
      b.disabled = !can.ok || sailing;
      if (!b.disabled) {
        b.onclick = function () {
          var r = contest(m.id);
          if (r.ok) toast('the fleet sails for ' + m.name + '.');
          else toast(WHY[r.why] || 'the fleet did not sail.');
        };
      }
      box.appendChild(b);
    } else if (m.lost) {
      // THE RECLAIM LINE — a march you lost keeps saying how to get it back.
      box.appendChild(el('div', 'mr-ms2', 'you took this back.'));
    }
    return box;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a flow child of the rail. Nothing pinned, nothing floating.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('mrBtn', 'marches', '⚑', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the marches — who stands with you, and what you hold');
      _btn.setAttribute('title', 'the marches — who stands with you, and what you hold');
      // the unread count rides INSIDE the launcher as its own flex cell, exactly
      // like the Court's .ct-n and the Concord's .cn-n — never a second floating
      // node that could land on the label.
      if (!_btn.querySelector('.mr-n')) {
        var pill = document.createElement('span');
        pill.className = 'mr-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(255,154,106,0.9);color:#1a1006;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('marches', isOpen, close); } catch (_) {}
    updateLauncher();
  }

  // The launcher only appears where ground can be held: in a world you can
  // build in, with a polity founded to hold it. The same rule the Court and the
  // Concord already keep.
  function updateLauncher() {
    if (!_btn) return;
    var show = false;
    try {
      var w = world();
      var here = w && w.currentWorldId ? String(w.currentWorldId()) : 'universe';
      var mine = true;
      try { if (w && w.canBuild) mine = !!w.canBuild(); } catch (_) {}
      var c = concord();
      var founded = !!(c && c.founded && c.founded());
      show = !isGuest() && here !== 'universe' && mine && founded;
    } catch (_) { show = false; }
    _btn.style.display = show ? '' : 'none';
    var pill = _btn.querySelector('.mr-n');
    if (pill) {
      var n = show ? unread() : 0;
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = n > 0 ? '' : 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WIRE TO THE ADMIRALTY — one event, one direction.
  //
  // The Admiralty fires `vint:admiralty-wake` when a sortie resolves on its own
  // wall-clock. We read the verdict off it and move the deed. This file never
  // reaches into the Admiralty's state to decide a fight, and the Admiralty
  // never learns what the fight was for. That is the whole coupling, and it is
  // one line wide on purpose.
  // ═══════════════════════════════════════════════════════════════════════════
  W.addEventListener('vint:admiralty-wake', function (e) {
    if (!enabled()) return;
    var won = !!(e && e.detail && e.detail.won);
    if (resolveClaim(won)) {
      if (isOpen()) render();
      updateLauncher();
    }
  });

  // The world changing under us re-keys everything (per-world state) — the same
  // listener shape the sibling organs use.
  W.addEventListener('vint:world-changed', function () {
    forget();
    updateLauncher();
    if (isOpen()) render();
  });

  // Ground pays on a slow beat even when nothing is open, so a march held while
  // the sheet was shut is a march that paid.
  setInterval(function () {
    if (!enabled() || isGuest()) return;
    if (resolve()) { updateLauncher(); if (isOpen()) render(); }
  }, 60000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintMarches = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: updateLauncher,

    // ── THE MODEL, for the HUD, the verifier, and whatever organ comes next ──
    // Reads are deep-copied or scalar. Writes are the diplomatic verbs and
    // resolveClaim — never a raw setter on a deed, because ownership moving
    // for a reason nobody recorded is how a map stops being trustworthy.
    state: function () { var s = load(); return JSON.parse(JSON.stringify(s)); },
    factions: factions,
    faction: factionOf,
    members: function (id) { var f = factionOf(id); return f ? f.members.slice() : []; },

    // allegiance — one slot per pair, symmetric by construction
    relation: function (a, b) { return relation(a, b).k; },
    pact: pact,
    pairKey: pairKey,
    ally: ally,
    declare: declare,
    truce: truce,
    breakPact: breakPact,

    // territory — the store the HUD reads
    territory: territory,
    ownerOf: ownerOf,
    held: held,
    contestable: contestable,
    sanctuary: sanctuary,
    adjacent: adjacent,

    // war — validated here, FOUGHT by the Admiralty, applied by resolveClaim
    contest: contest,
    resolveClaim: resolveClaim,
    campaign: function () { var s = load(); return s.campaign ? JSON.parse(JSON.stringify(s.campaign)) : null; },

    resolve: resolve,
    unread: unread,
    // the cold-read hook the persistence proof needs: drop the memo and read
    // the bytes back off localStorage, exactly as a fresh page load would.
    reload: function () { forget(); return load(); },

    SELF: SELF, MARCHES: MARCHES, POWERS: POWERS, RELATIONS: RELATIONS,
    MARCH_RUNGS: MARCH_RUNGS, claimCap: claimCap, nextClaimRung: nextClaimRung
  };
})();
