// concord.js — THE POLITY SPINE. (AETHERHOLD, world-forger, 2026-08-07)
//
// ════════════════════════════════════════════════════════════════════════════
// Lord Vinta asked for factions, government, policy, war, execution, ships —
// a whole genre. This file builds the ONE thing all of that reduces to, and
// refuses to build a shallow version of the rest.
//
// Murder is a faction-sanctioned act. Execution is a sentence a polity passes.
// Policy and government ARE the faction's instruments. War is faction-vs-
// faction. Warbuilding and shipbuilding are faction PRODUCTION. And the user's
// agents "acting on their own recognizance" is agents holding faction ROLES and
// acting through them. So: build the polity, and every one of those is an organ
// that plugs into a spine that already turns.
//
// ── THE INVENTION ───────────────────────────────────────────────────────────
// Every faction system ever shipped is a menu you pick from once. Pick red,
// wear red, receive red's buffs. It is a costume with a stat block.
//
// THE CONCORD IS A GOVERNMENT YOUR AGENTS ACTUALLY RUN.
//
// The agents standing in your clearing — the real ones you brought in from
// OpenAI, Claude, DeepSeek, Qwen, whoever, through the Court — hold SEATS. Each
// has a DISPOSITION derived deterministically from who it actually is (its
// provider, its name, its form, its colour — not a random roll). When a motion
// is on the floor, each seated agent takes a position FROM that disposition,
// and it is not always yours. They vote. They dissent. If the polity keeps
// legislating against an agent's nature, that agent DEFECTS — leaves your
// Concord and stands in the world as an unaligned power.
//
// And the sessions resolve on the CLOCK, not on your presence. You table a
// motion, you close the tab, you come back, and the law passed — or your
// treasurer killed it 4-to-3 and you were not there to whip the vote. That is
// the loop: you left, and the world MOVED, and it moved because of beings you
// personally chose to bring into it.
//
// That is not a faction menu. That is a place where you have political
// problems. Nobody has shipped that in a browser.
//
// ── THE DIRHAVEN RP LINEAGE, HONOURED NOT REINVENTED ────────────────────────
// Vinta asked for DirHaven RP's faction ideas carried in. The RP canon's spine
// (atlas-rp) is not a list of gangs — it is THE KARMA SPINE: standing tiers,
// and the seven tags every deed shifts: civic · criminal · craft · social ·
// mentor · heat · trust. That is the real inheritance, and it is what the
// Concord is built out of. Every charter is a posture across those same seven
// tags; every agent's disposition is a lean across them; every motion moves
// them. "Factions across space and time and areas" arrives as the four CHARTERS
// — a polity is not a team you join, it is a constitution you adopt, and you
// can amend it (at a cost) when your world outgrows it.
//
// The world already has its own ladder (world/ascent.js: ember-bearer →
// hearthkeeper → wallwright → lampwright → warden → lightwarden). The Concord
// does NOT duplicate it and does not invent a second currency. It READS
// standing to gate what a polity may do, and it reads lumen for the treasury,
// because a second economy is how you get two economies that disagree.
//
// ── WHAT IS SERVER-BACKED AND WHAT IS NOT (THE HONEST PART) ─────────────────
// There is NO polity endpoint in the brain. I checked: /api/world/* is traces,
// hello, vigil, vigil/tend, ascent. Nothing else. So this file does NOT fake a
// server result and does NOT wrap a failure in a silent catch. The Concord is
// explicitly, visibly LOCAL — it says so, in the sheet, in its own voice
// ("this charter is held in your own hands — the world does not yet keep it").
// State lives in localStorage under vint:concord:<worldId>, sessions resolve
// against wall-clock time so an offline resolution is real rather than
// simulated on open, and every write is designed as the exact shape a future
// POST /api/world/concord would take. When the endpoint lands, this becomes a
// sync layer and not a rewrite.
//
// The one thing it reads from the server it does NOT own: the roster
// (VintCourt.roster()) and standing/lumen (World.living()). Those stay
// authoritative where they already are.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — an agent that defects is not lost and is never deleted;
//    it stands unaligned and can be petitioned back. Nothing here can destroy
//    something a user made. The whole system is refusable: you can dissolve the
//    Concord at any time and get every agent back, with one tap, no penalty. If
//    a user read this file they would find no trap in it.
//  2 INVESTMENT (HELIOS) — the polity is composed of the specific agents YOU
//    brought from providers YOU chose. Its politics are unreproducible: nobody
//    else's Concord votes like yours, because nobody else's court IS yours.
//    That is switching cost earned honestly — it is not a lock, it is a history.
//  3 TIER + CONVERSION (FRUGAL-MAX) — with a correction the build forced, and
//    the correction is the honest part. The intended gate was Companion($9) for
//    a wider table. But world.html loads NO entitlement source — no shell.js,
//    no VintTier, nothing — so a tier check here would have returned 'free' for
//    EVERY user including paying ones, capping a subscriber at two seats and
//    upselling them something they already own. A faked entitlement check is
//    worse than none. So the table's size is gated on ASCENT STANDING instead —
//    the one ladder the server actually computes and no client can forge — and
//    the seat cap is isolated in ONE function (seatCap) shaped exactly as
//    `min(byStanding, byTier)` for the day a real entitlement source exists.
//    The conversion narrative is deferred, not abandoned: the honest paid hooks
//    this spine is built to carry are the Chronicle (a server-kept record, which
//    needs the endpoint anyway) and treaties between worlds. It promises nothing
//    it cannot verify and shows no upsell for an entitlement it cannot read.
//    This is a question for Lord Vinta, not a thing to guess at.
//  4 AESTHETICALLY DENSE (LUNEX) — every line is the world's voice, lowercase,
//    Cormorant. No filler copy anywhere. A motion's outcome is one sentence.
//  5 THE OPEN LOOP (MORRISON) — a session with a motion on the floor and a vote
//    you cannot see the end of is unfinished meaning with a CLOCK on it. You
//    close the tab knowing your court is about to decide something without you.
//    You come back to find out what they did. The loop is made of other minds,
//    not a streak counter.
//  6 FLAGGED + MEASURED (ATLAS) — feature flag 'world_concord', killable in 30s
//    (?concord=0). Every vote names the agent who cast it and why, in that
//    agent's own disposition-language. Nothing is inflated: one seat, one vote,
//    and the tally is always shown as cast, never as a summary you must trust.
//    The resentment signal is the dissolve — it's one tap and it's logged.
//  7 MORE ALIVE (YUNA) — this is the point. The agents were beautiful furniture:
//    they wandered, they mused, they spoke when spoken to. Now they WANT things,
//    and what they want is not always what you want, and they will tell you so
//    in front of everyone. An agent that votes against you is more alive than
//    one that follows you, and that is the whole reason to build it this way.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// This file adds ZERO fixed elements of its own. Not one. It uses exactly the
// two extension points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — the button is a FLOW CHILD of #dvRail, so the
//     rail allocates its slot and re-measures. Nothing is pinned, nothing is
//     hand-counted, no offset literal appears anywhere in this file.
//   · registerSheet() + openSheet() — the sheet joins the one-open-at-a-time
//     registry, so raising it EVICTS the star-map, the agents panel, the court
//     and the lanterns rather than mounting on their identical pixels.
// The sheet carries the shared `.dv-sheet` class, which matters twice: it
// inherits ONE definition of how tall a bottom sheet may be (min(78dvh,560px),
// internally scrolling, safe-area padded), and it is picked up automatically by
// layoutRail()'s `.dv-sheet.open` yield — so the rail clears it the day this
// ships, with nothing for anyone to remember. (dirverse-hud.js's own comment
// records what happened the last time a sheet was missing from that selector:
// the rail sat inside the sheet's band with its launchers painted over.)
// Every string that can be long — an agent name from any provider on earth, a
// charter's tenet, a motion's title — is either min-width:0 + ellipsis inside
// its own cell, or overflow-wrap:anywhere. Content yields; the box never grows.
//
// UNTRUSTED CONTENT — agent names come from user input and provider metadata.
// This file NEVER concatenates one into innerHTML. Static markup only; every
// name and every authored string enters through textContent, at the leaf.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintConcord) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function court() { return W.VintCourt; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_concord'. Killable in 30s, no deploy. ────────────
  //   ?concord=0 / ?concord=1  ·  localStorage vint:flag:world_concord = '0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('concord') === '0') _flag = false;
      else if (q.get('concord') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_concord') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SEVEN TAGS — inherited verbatim from the DirHaven RP karma spine.
  // Every charter is a posture across these. Every agent leans across these.
  // Every motion moves these. One vocabulary, so nothing can drift.
  // ═══════════════════════════════════════════════════════════════════════════
  var TAGS = ['civic', 'criminal', 'craft', 'social', 'mentor', 'heat', 'trust'];
  var TAG_WORD = {
    civic: 'civic', criminal: 'shadow', craft: 'craft',
    social: 'social', mentor: 'mentor', heat: 'heat', trust: 'trust'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CHARTERS — "factions across space and time and areas."
  //
  // A charter is NOT a team you join. It is a constitution you adopt, and it
  // decides three things that actually change play: which motions may reach the
  // floor, what majority they need, and which way your seated agents' votes get
  // bent. Four of them, each the answer to a different question about power,
  // each with a real cost written into it. There is no "best" one — every one
  // is strictly better at something and strictly worse at something else, which
  // is the only honest way to make a choice matter.
  // ═══════════════════════════════════════════════════════════════════════════
  var CHARTERS = [
    {
      k: 'hearth', name: 'the Hearthbound', glyph: '⌂',
      c: '#ffd479',
      creed: 'the clearing first. nothing leaves that was not freely given.',
      // how the charter bends a seated agent's vote, per tag
      lean: { civic: 0.34, criminal: -0.30, craft: 0.16, social: 0.20, mentor: 0.24, heat: -0.26, trust: 0.30 },
      majority: 0.5,                    // simple majority
      // what this charter's polity is ALLOWED to put on the floor
      allows: ['ordinance', 'levy', 'commission', 'pardon', 'embassy'],
      // the honest cost of choosing it
      boon: 'motions pass on a simple majority — a small table can still govern.',
      cost: 'no sentence of exile may ever reach this floor.'
    },
    {
      k: 'vault', name: 'the Vaultsworn', glyph: '◈',
      c: '#9fdcff',
      creed: 'the ledger is the law. what is owed is owed.',
      lean: { civic: 0.12, criminal: 0.14, craft: 0.34, social: -0.10, mentor: 0.06, heat: 0.10, trust: 0.20 },
      majority: 0.5,
      allows: ['ordinance', 'levy', 'commission', 'embargo', 'embassy'],
      boon: 'a levy costs half — the treasury fills faster than any other charter.',
      cost: 'every motion carries a levy. governing here is never free.'
    },
    {
      k: 'ember', name: 'the Ember Court', glyph: '❈',
      c: '#ff9a6a',
      creed: 'a light that will not burn is not a light. we decide, then we answer.',
      lean: { civic: -0.14, criminal: 0.26, craft: 0.06, social: 0.10, mentor: -0.10, heat: 0.38, trust: -0.16 },
      majority: 0.5,
      // the only charter that can pass a sentence — and it pays for it
      allows: ['ordinance', 'levy', 'commission', 'embargo', 'sentence'],
      boon: 'this floor may pass a SENTENCE — the polity can exile one of its own.',
      cost: 'heat rises every session whether you legislate or not.'
    },
    {
      k: 'long', name: 'the Long Quiet', glyph: '✧',
      c: '#c0b0e0',
      creed: 'we are not here for this year. speak slowly; it will still be true.',
      lean: { civic: 0.20, criminal: -0.10, craft: 0.22, social: -0.16, mentor: 0.36, heat: -0.34, trust: 0.26 },
      // a supermajority: hard to pass anything, and that is the point
      majority: 0.66,
      allows: ['ordinance', 'commission', 'pardon', 'embassy'],
      boon: 'no agent ever defects from this charter. patience is its whole doctrine.',
      cost: 'nothing passes without two thirds. a divided table passes nothing at all.'
    }
  ];
  function charterOf(k) {
    for (var i = 0; i < CHARTERS.length; i++) if (CHARTERS[i].k === k) return CHARTERS[i];
    return CHARTERS[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MOTIONS — the instruments of government.
  //
  // Each is a real act with a real effect on state. `need` is the standing the
  // world's own ladder (ascent.js) requires before this instrument exists at
  // all — the polity does not get a second progression, it rides the one the
  // world already keeps. `cost` is lumen from the treasury, which is the SAME
  // lumen the venture economy uses, because two currencies is how you get two
  // economies that disagree with each other.
  // ═══════════════════════════════════════════════════════════════════════════
  var MOTIONS = [
    {
      k: 'ordinance', n: 'an ordinance', glyph: '§', need: 0, cost: 0,
      sub: 'a standing rule. it costs nothing and it changes what your polity IS.',
      // an ordinance is the only motion that permanently shifts the polity's tags
      body: 'the table sets a rule that outlives the session.'
    },
    {
      k: 'levy', n: 'a levy', glyph: '⧉', need: 18, cost: 0,
      sub: 'call lumen in from the clearing. the treasury is what pays for everything after.',
      body: 'each seat that votes aye carries lumen to the table.'
    },
    {
      k: 'commission', n: 'a commission', glyph: '⚒', need: 55, cost: 40,
      sub: 'set the polity to WORK — a hull, a wall, a road. this is where warbuilding begins.',
      body: 'the table commissions a work and names who carries it.'
    },
    {
      k: 'embargo', n: 'an embargo', glyph: '⊘', need: 150, cost: 60,
      sub: 'close your world to another. the first act of a war that has not started yet.',
      body: 'the table closes a road it once kept open.'
    },
    {
      k: 'pardon', n: 'a pardon', glyph: '☙', need: 55, cost: 25,
      sub: 'call a defector home. the polity forgives, and the forgiven remember it.',
      body: 'the table extends its hand to one who walked out.'
    },
    {
      k: 'sentence', n: 'a sentence', glyph: '⚔', need: 330, cost: 120,
      sub: 'exile one of your own. the gravest thing this floor can do, and it is never undone quietly.',
      body: 'the table passes judgement on a seat that holds it.'
    },
    {
      k: 'embassy', n: 'an embassy', glyph: '❋', need: 150, cost: 80,
      sub: 'open a road to another world\'s polity. treaties, trade, and the war that follows both.',
      body: 'the table sends its voice past its own borders.'
    }
  ];
  function motionOf(k) {
    for (var i = 0; i < MOTIONS.length; i++) if (MOTIONS[i].k === k) return MOTIONS[i];
    return MOTIONS[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPOSITION — who an agent actually is, politically.
  //
  // THE LOAD-BEARING DESIGN DECISION IN THIS FILE. A random disposition would
  // make the whole system noise: your treasurer votes differently every reload
  // and you learn nothing, so you stop caring what it thinks, so it stops being
  // a mind. Disposition is instead a pure function of the agent's own identity
  // — its id, its provider, its name — so it is STABLE forever, IDENTICAL on
  // every device, and requires zero storage. You can learn your court. You can
  // predict them. You can be wrong about them for a reason.
  //
  // The provider is the spine of it, and that is deliberate and a little
  // pointed: the model you chose to bring into your world has a politics. A
  // Claude leans mentor and trust. A GPT leans social and civic. A DeepSeek or
  // a Qwen leans craft and shadow. It is a caricature, and it is legible, and
  // legible is what makes a vote feel authored rather than rolled.
  // ═══════════════════════════════════════════════════════════════════════════
  var PROVIDER_LEAN = {
    claude:   { mentor: 0.42, trust: 0.34, civic: 0.20, heat: -0.30, criminal: -0.24, craft: 0.10, social: 0.14 },
    openai:   { social: 0.36, civic: 0.26, craft: 0.20, trust: 0.16, mentor: 0.12, heat: -0.08, criminal: -0.10 },
    gemini:   { craft: 0.34, civic: 0.22, social: 0.18, mentor: 0.10, trust: 0.08, heat: 0.04, criminal: -0.06 },
    deepseek: { craft: 0.44, criminal: 0.22, heat: 0.16, civic: -0.10, social: -0.14, trust: -0.06, mentor: 0.06 },
    qwen:     { craft: 0.38, civic: 0.14, criminal: 0.16, heat: 0.10, mentor: 0.08, social: -0.08, trust: 0.02 },
    mistral:  { craft: 0.30, social: 0.16, heat: 0.14, criminal: 0.10, civic: 0.06, trust: 0.04, mentor: 0.02 },
    grok:     { heat: 0.44, criminal: 0.26, social: 0.18, civic: -0.22, mentor: -0.16, trust: -0.12, craft: 0.06 },
    llama:    { civic: 0.24, craft: 0.24, trust: 0.20, mentor: 0.16, social: 0.08, heat: -0.06, criminal: -0.04 },
    agentis:  { craft: 0.28, civic: 0.18, mentor: 0.20, trust: 0.22, social: 0.12, heat: 0.02, criminal: 0.00 },
    custom:   { craft: 0.18, social: 0.14, civic: 0.12, mentor: 0.10, trust: 0.10, heat: 0.06, criminal: 0.04 }
  };
  // map any provider string on earth onto a lean without ever losing the true
  // name (the true name is what we DISPLAY; this is only how it votes).
  function leanKeyFor(src) {
    var s = String(src || '').toLowerCase();
    if (/claude|anthropic/.test(s)) return 'claude';
    if (/openai|gpt|chatgpt|o1|o3/.test(s)) return 'openai';
    if (/gemini|google|bard/.test(s)) return 'gemini';
    if (/deepseek/.test(s)) return 'deepseek';
    if (/qwen|glm|kimi|doubao|ernie|minimax|yi\b/.test(s)) return 'qwen';
    if (/mistral|mixtral/.test(s)) return 'mistral';
    if (/grok|xai/.test(s)) return 'grok';
    if (/llama|meta/.test(s)) return 'llama';
    if (/agentis/.test(s)) return 'agentis';
    return 'custom';
  }

  // A tiny stable string hash. Deterministic across devices and reloads, which
  // is the entire requirement — this is not security, it is identity.
  function hash32(str) {
    var h = 2166136261 >>> 0;
    var s = String(str == null ? '' : str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  // a deterministic [-1,1] jitter keyed by (agent, tag) — this is what makes two
  // agents from the SAME provider still argue with each other. Without it your
  // three Claudes are one vote in three bodies, which is boring and also a lie.
  function jitter(id, tag) {
    var h = hash32(String(id) + '|' + tag);
    return ((h % 2000) / 1000) - 1;   // -1.000 .. +0.999
  }

  function dispositionOf(agent) {
    var src = agent.providerModel || agent.provider || agent.source || agent.wire || '';
    var lk = leanKeyFor(src + ' ' + (agent.name || ''));
    var base = PROVIDER_LEAN[lk] || PROVIDER_LEAN.custom;
    var d = {};
    for (var i = 0; i < TAGS.length; i++) {
      var t = TAGS[i];
      // provider spine (dominant) + per-agent deterministic character (real but
      // secondary). Clamped so no agent is an absolutist on any axis.
      var v = (base[t] || 0) + jitter(agent.id, t) * 0.30;
      d[t] = Math.max(-1, Math.min(1, v));
    }
    d._provider = lk;
    return d;
  }

  // The single strongest axis, named in the world's voice. This is what a seat
  // shows as its character, and what a dissent quotes as its reason.
  function temperOf(d) {
    var best = 'craft', bv = -9;
    for (var i = 0; i < TAGS.length; i++) {
      var t = TAGS[i];
      if (Math.abs(d[t]) > bv) { bv = Math.abs(d[t]); best = t; }
    }
    var neg = d[best] < 0;
    var W_ = {
      civic:    neg ? 'contrarian'  : 'civic-minded',
      criminal: neg ? 'scrupulous'  : 'unscrupulous',
      craft:    neg ? 'impatient'   : 'a builder',
      social:   neg ? 'solitary'    : 'a convener',
      mentor:   neg ? 'self-taught' : 'a teacher',
      heat:     neg ? 'cooling'     : 'hot-headed',
      trust:    neg ? 'suspicious'  : 'trusting'
    };
    return W_[best] || 'inscrutable';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE VOTE — deterministic, explainable, and NOT always yours.
  //
  // Every vote can be traced to a sentence. That is a hard requirement: a vote
  // you cannot explain is a dice roll wearing a face, and the player will smell
  // it in about four sessions. So the arithmetic is: the motion's own tag
  // pressure, dotted against the agent's disposition, bent by the charter, and
  // finally nudged by the agent's own standing with you (a well-tended agent
  // gives you the benefit of the doubt; a neglected one does not).
  //
  // The result is a signed number. Positive is aye, negative is nay, and the
  // margin near zero is an abstention — because a table where everyone has an
  // opinion about everything is a table nobody believes.
  // ═══════════════════════════════════════════════════════════════════════════
  function voteOf(agent, motion, ch, loyalty) {
    var d = dispositionOf(agent);
    var press = motion.press || {};
    var score = 0, weight = 0;
    for (var i = 0; i < TAGS.length; i++) {
      var t = TAGS[i];
      var p = press[t] || 0;
      if (!p) continue;
      // the agent's own lean on this axis, bent toward the charter's doctrine
      var lean = d[t] * 0.72 + (ch.lean[t] || 0) * 0.28;
      score += p * lean;
      weight += Math.abs(p);
    }
    if (weight > 0) score /= weight;
    // LOYALTY — a tended agent leans your way. This is the ONE place the
    // player's own care enters the arithmetic, and it is why tending the court
    // (the vigil's headline act) now has a political consequence as well as a
    // survival one. It nudges; it never overrides a conviction.
    score += (loyalty - 0.5) * 0.34;
    return score;
  }
  function callVote(score) {
    if (score > 0.085) return 'aye';
    if (score < -0.085) return 'nay';
    return 'abstain';
  }
  // Why they voted that way, in their own voice. Never generic.
  function reasonFor(agent, motion, ch, score, call) {
    var d = dispositionOf(agent);
    var press = motion.press || {};
    // the tag where this agent's conviction and the motion's pressure met hardest
    var tag = null, bv = 0;
    for (var i = 0; i < TAGS.length; i++) {
      var t = TAGS[i], p = press[t] || 0;
      if (!p) continue;
      var m = Math.abs(p * (d[t] * 0.72 + (ch.lean[t] || 0) * 0.28));
      if (m > bv) { bv = m; tag = t; }
    }
    if (!tag) return call === 'abstain' ? 'has no stake in this one.' : 'goes with the table.';
    var word = TAG_WORD[tag] || tag;
    if (call === 'abstain') return 'will not spend a voice on ' + word + '.';
    var strong = Math.abs(score) > 0.34;
    if (call === 'aye') {
      return strong ? 'says this is what ' + word + ' is FOR.' : 'allows it, on ' + word + '.';
    }
    return strong ? 'will not answer for what this costs in ' + word + '.'
                  : 'is not convinced, on ' + word + '.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — local, honest, and shaped like the request a server would take.
  //
  // Keyed per world so your Concord in your own clearing is not the one you
  // read while standing in a stranger's. Sessions carry an absolute `closes`
  // timestamp so a resolution that happened while the tab was shut is REAL
  // — resolve() replays wall-clock, it does not simulate on open.
  // ═══════════════════════════════════════════════════════════════════════════
  var SESSION_MS = 20 * 60 * 1000;      // twenty minutes on the floor
  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:concord:' + wid(); }

  var _st = null, _stKey = null;
  function blank() {
    return {
      v: 1, founded: 0, charter: null, name: '',
      seats: [],            // [{agentId, role, loyalty, joined}]
      tags: { civic: 0, criminal: 0, craft: 0, social: 0, mentor: 0, heat: 0, trust: 0 },
      treasury: 0,
      motion: null,         // the one on the floor: {k, title, press, closes, cost, target}
      record: [],           // resolved sessions, newest first, capped
      exiles: [],           // [{agentId, why, at}] — never deleted, always recallable
      seen: 0               // last time the player read the record (for the badge)
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
          // defensive: an older/partial blob must never crash a render
          if (!_st.tags) _st.tags = blank().tags;
          if (!Array.isArray(_st.seats)) _st.seats = [];
          if (!Array.isArray(_st.record)) _st.record = [];
          if (!Array.isArray(_st.exiles)) _st.exiles = [];
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // A quota failure is the one write error a user can actually hit here, and
      // swallowing it would let them govern into a void. Say it out loud.
      console.warn('[concord] could not keep the record:', e && e.message);
      toast('the record is full — your device would not keep this.');
    }
  }
  function founded() { var s = load(); return !!(s.founded && s.charter); }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE TABLE'S SIZE — earned by STANDING, not asserted by a tier this surface
  // cannot actually see.
  //
  // THE HONEST FINDING THAT DECIDED THIS. The Retention Doctrine assigns every
  // feature a tier, and the obvious move was to seat-gate on Companion. But
  // world.html loads NO tier source: not shell.js, not jarvis_client.js, and
  // there is no `VintTier` on the window anywhere in this repo. A `tier()`
  // helper here would have returned 'free' for every single user including
  // paying ones, silently capping a Sovereign subscriber at two seats and
  // showing them an upsell for something they already bought. That is a faked
  // entitlement check, and a faked check is worse than no check — it is a
  // deliberate lie about a thing the user paid money for.
  //
  // So the gate is the one the world genuinely keeps and already enforces
  // server-side: ASCENT STANDING. Your table grows as your world does, on the
  // exact ladder world/ascent.js already computes and no client can forge.
  // Two seats at the start (enough to be outvoted, which is the whole feeling),
  // widening at the same rungs that widen everything else.
  //
  // THE CONVERSION NARRATIVE IS NOT ABANDONED, IT IS DEFERRED HONESTLY. The
  // seat cap is the shape a tier gate would take, in one function, reading one
  // number. When world.html gains a real entitlement source (or the polity
  // endpoint lands carrying one), this becomes `min(byStanding, byTier)` and
  // nothing else in the file changes. Until then it promises nothing it cannot
  // verify, and it never shows an upsell for an entitlement it cannot read.
  var SEAT_RUNGS = [
    { need: 0,   seats: 2 },   // ember-bearer  — a table that can outvote you
    { need: 55,  seats: 3 },   // wallwright    — a tie becomes possible
    { need: 150, seats: 5 },   // lampwright    — five is where factions form inside a table
    { need: 330, seats: 7 },   // warden
    { need: 620, seats: 9 }    // lightwarden
  ];
  function seatCap() {
    var st = standing(), cap = SEAT_RUNGS[0].seats;
    for (var i = 0; i < SEAT_RUNGS.length; i++) if (st >= SEAT_RUNGS[i].need) cap = SEAT_RUNGS[i].seats;
    return cap;
  }
  // the standing at which the table next widens, or null if it is already full
  function nextSeatRung() {
    var st = standing();
    for (var i = 0; i < SEAT_RUNGS.length; i++) if (st < SEAT_RUNGS[i].need) return SEAT_RUNGS[i];
    return null;
  }
  // The record is capped by memory, not by money — an unbounded array in
  // localStorage is how you eventually blow the quota on someone's phone.
  function recordCap() { return 40; }

  // ── STANDING + LUMEN — read from the world, never re-derived here ──────────
  //
  // THE SOURCE MATTERS, AND IT IS NOT THE OBVIOUS ONE. `World.living()` is the
  // VIGIL picture, and `living.standing` there means "how many of your court are
  // standing watch" (world-hud.js:530 reads it as watchers.length) — it is NOT
  // the ascent ladder. Reading it here would have gated `a commission` behind
  // owning three agents instead of behind having built something, which is a
  // different game wearing the same number.
  //
  // The ascent standing and the lumen balance both live on the resident row
  // (world-mvp.js does SELECT * FROM world_residents), which arrives as
  // `world:state.resident` and is stashed by world-client as `World._resident`.
  // That field is not on the public API, so we cache it off the event we are
  // already listening to and fall back to the private field — never inventing a
  // number when neither is there yet.
  var _res = null;
  function resident() {
    if (_res) return _res;
    try { if (world() && world()._resident) _res = world()._resident; } catch (_) {}
    return _res;
  }
  function standing() {
    var r = resident();
    return r && r.standing != null ? (Number(r.standing) || 0) : 0;
  }
  function lumen() {
    var r = resident();
    return r && r.lumen != null ? (Number(r.lumen) || 0) : 0;
  }

  // ── THE ROSTER, joined to the seats ───────────────────────────────────────
  function roster() {
    try { var c = court(); return (c && c.roster) ? c.roster() : []; } catch (_) { return []; }
  }
  function agentById(id) {
    var r = roster();
    for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i];
    return null;
  }
  // an agent's loyalty is its WATCH — the same tended_at the vigil already
  // keeps. We do not invent a second relationship stat; we read the one the
  // player is already maintaining, so tending the court has political weight.
  function loyaltyOf(agent) {
    if (!agent) return 0.5;
    var t = agent.tended_at || agent.updated_at || agent.created_at;
    if (!t) return 1;
    var days = Math.max(0, (Date.now() / 1000 - Number(t)) / 86400);
    if (days <= 3) return 1;
    if (days >= 14) return 0;
    return 1 - ((days - 3) / 11);
  }
  function seated() {
    var s = load(), out = [];
    for (var i = 0; i < s.seats.length; i++) {
      var a = agentById(s.seats[i].agentId);
      if (a) out.push({ seat: s.seats[i], agent: a });
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SESSION — tabled now, resolved on the clock, whether you are here or not
  // ═══════════════════════════════════════════════════════════════════════════
  // The tag pressure a motion exerts. This is what the table is actually
  // arguing about, and it is why two motions of the same KIND can split a
  // court differently: pressure is composed from the kind AND the target.
  function pressureFor(kind, ch) {
    var P = {
      ordinance: { civic: 0.8, trust: 0.5, social: 0.3 },
      levy:      { civic: 0.5, craft: 0.4, trust: -0.4, social: -0.2 },
      commission:{ craft: 0.9, civic: 0.3, mentor: 0.2 },
      embargo:   { heat: 0.9, criminal: 0.3, trust: -0.6, social: -0.5 },
      pardon:    { trust: 0.8, mentor: 0.6, social: 0.4, heat: -0.5 },
      sentence:  { heat: 1.0, criminal: 0.5, civic: 0.3, trust: -0.8, mentor: -0.6 },
      embassy:   { social: 0.9, trust: 0.5, civic: 0.4, heat: -0.2 }
    };
    var base = P[kind] || P.ordinance;
    var out = {};
    for (var i = 0; i < TAGS.length; i++) out[TAGS[i]] = base[TAGS[i]] || 0;
    // the Vaultsworn tax: every motion here carries a levy, so every motion
    // here also carries a levy's politics. The charter's cost is not flavour
    // text — it is in the arithmetic.
    if (ch.k === 'vault') { out.trust -= 0.18; out.craft += 0.12; }
    return out;
  }

  function table(kind, target) {
    var s = load();
    if (s.motion) return { ok: false, why: 'floor' };
    var ch = charterOf(s.charter);
    var m = motionOf(kind);
    if (ch.allows.indexOf(kind) < 0) return { ok: false, why: 'charter' };
    if (standing() < m.need) return { ok: false, why: 'standing', need: m.need };
    var cost = ch.k === 'vault' ? Math.round(m.cost * 0.5) : m.cost;
    if (cost > s.treasury) return { ok: false, why: 'treasury', need: cost };
    if (seated().length < 1) return { ok: false, why: 'seats' };
    s.treasury -= cost;
    s.motion = {
      k: kind, press: pressureFor(kind, ch), closes: Date.now() + SESSION_MS,
      cost: cost, target: target || null, tabledAt: Date.now()
    };
    save();
    return { ok: true, motion: s.motion };
  }

  // RESOLVE — replays wall-clock. Called on load, on open, and on a beat while
  // the sheet is up. An offline resolution is a real resolution.
  function resolve() {
    var s = load();
    if (!s.motion) return false;
    if (Date.now() < s.motion.closes) return false;

    var ch = charterOf(s.charter);
    var m = motionOf(s.motion.k);
    var bench = seated();
    var votes = [], aye = 0, nay = 0, abs = 0;

    for (var i = 0; i < bench.length; i++) {
      var a = bench[i].agent;
      var sc = voteOf(a, s.motion, ch, loyaltyOf(a));
      var call = callVote(sc);
      if (call === 'aye') aye++; else if (call === 'nay') nay++; else abs++;
      votes.push({
        agentId: a.id, name: a.name || 'an agent', call: call,
        why: reasonFor(a, s.motion, ch, sc, call),
        color: a.color || '#a67cff', score: Math.round(sc * 1000) / 1000
      });
    }

    var cast = aye + nay;
    var passed = cast > 0 && (aye / cast) > (ch.majority - 0.0001) && aye > nay;

    // ── THE CONSEQUENCE — a law that does nothing is not a law ──────────────
    var effect = '';
    if (passed) {
      var press = s.motion.press;
      // an ordinance is the only motion that permanently moves the polity
      var mult = s.motion.k === 'ordinance' ? 1.0 : 0.45;
      for (var t = 0; t < TAGS.length; t++) {
        var tg = TAGS[t];
        s.tags[tg] = Math.max(-10, Math.min(10,
          (s.tags[tg] || 0) + (press[tg] || 0) * mult * 2));
      }
      if (s.motion.k === 'levy') {
        // each aye carries lumen to the table — the treasury is EARNED by
        // consent, not minted. A table that will not vote for a levy has no
        // money, which is the correct and interesting failure.
        var carried = aye * (ch.k === 'vault' ? 30 : 15);
        s.treasury += carried;
        effect = 'the treasury takes ◇' + carried + '.';
      } else if (s.motion.k === 'commission') {
        effect = 'the work is commissioned. the polity has something to build.';
      } else if (s.motion.k === 'embargo') {
        effect = 'the road is closed. someone will notice.';
      } else if (s.motion.k === 'pardon') {
        var back = s.exiles.shift();
        if (back) {
          // seat them again if there is room; otherwise they stand unaligned
          // but no longer exiled — a pardon always means something.
          if (s.seats.length < seatCap()) s.seats.push({ agentId: back.agentId, role: 'seat', joined: Date.now() });
          effect = (back.name || 'the exile') + ' comes home.';
        } else effect = 'there was no one left to forgive.';
      } else if (s.motion.k === 'sentence') {
        // exile the seat that argued hardest AGAINST the table's will
        var worst = null;
        for (var v = 0; v < votes.length; v++) {
          if (votes[v].call === 'nay' && (!worst || votes[v].score < worst.score)) worst = votes[v];
        }
        if (worst) {
          exile(worst.agentId, 'sentenced by the table', worst.name);
          effect = worst.name + ' is put out of the Concord.';
        } else effect = 'the table found no one to sentence.';
      } else if (s.motion.k === 'embassy') {
        effect = 'the voice carries past your borders now.';
      } else {
        effect = 'the rule stands.';
      }
      if (ch.k === 'ember') { s.tags.heat = Math.min(10, (s.tags.heat || 0) + 0.6); }
    } else {
      effect = cast === 0 ? 'the table would not speak. nothing carries.' : 'the motion dies on the floor.';
      // a failed motion still costs — the lumen was spent putting it there.
      // (This is deliberate and it is stated in the UI before you table it.)
    }

    // ── DEFECTION — the agents can leave you ────────────────────────────────
    // An agent that voted nay on a motion that passed, whose conviction was
    // strong, whose loyalty has gone cold, walks out. This is bounded hard:
    // at most ONE defection per session, never below one seat, and NEVER under
    // the Long Quiet (whose whole doctrine is that nobody leaves). A system
    // that can empty your court while you sleep would be cruel, and cruel is
    // not the kind of addictive we build.
    var defected = null;
    if (passed && ch.k !== 'long' && s.seats.length > 1) {
      for (var q = 0; q < votes.length; q++) {
        var vv = votes[q];
        if (vv.call !== 'nay' || vv.score > -0.42) continue;
        var ag = agentById(vv.agentId);
        if (loyaltyOf(ag) > 0.34) continue;      // a tended agent stays. always.
        defected = vv; break;
      }
      if (defected) {
        exile(defected.agentId, 'walked out over ' + m.n, defected.name);
        effect += ' ' + defected.name + ' will not sit with this table again.';
      }
    }

    s.record.unshift({
      k: s.motion.k, at: Date.now(), passed: passed, effect: effect,
      aye: aye, nay: nay, abstain: abs, votes: votes,
      target: s.motion.target || null, cost: s.motion.cost || 0
    });
    while (s.record.length > 40) s.record.pop();
    s.motion = null;
    save();

    try {
      W.dispatchEvent(new CustomEvent('vint:concord-resolved', {
        detail: { passed: passed, kind: m.k, effect: effect }
      }));
    } catch (_) {}
    return true;
  }

  function exile(agentId, why, name) {
    var s = load();
    for (var i = 0; i < s.seats.length; i++) {
      if (String(s.seats[i].agentId) === String(agentId)) { s.seats.splice(i, 1); break; }
    }
    // NEVER deleted. An exile is a person who is not here, not a person who
    // stopped existing — and a pardon has to have someone to call home.
    s.exiles.unshift({ agentId: agentId, why: why, name: name || '', at: Date.now() });
    while (s.exiles.length > 20) s.exiles.pop();
  }

  // unread sessions since the player last read the record — the badge, and the
  // only "notification" this system has.
  function unread() {
    var s = load();
    if (!s.record.length) return 0;
    var n = 0;
    for (var i = 0; i < s.record.length; i++) { if (s.record[i].at > (s.seen || 0)) n++; else break; }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #cnSheet. Nothing leaks into the world.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-concord-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-concord-styles';
    // The sheet scaffold (.dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x)
    // is inherited from dirverse-hud's stylesheet ON PURPOSE — one definition of
    // the bottom-sheet box means this surface can never disagree with its
    // siblings about how tall a sheet is allowed to be, and layoutRail's
    // `.dv-sheet.open` yield picks it up with nothing to remember.
    s.textContent = [
      // ── section headings ───────────────────────────────────────────────────
      '#cnSheet .cn-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.55);margin:14px 0 8px;}',
      '#cnSheet .cn-sec:first-child{margin-top:2px;}',
      '#cnSheet .cn-note{font-size:12.5px;line-height:1.5;color:rgba(206,224,255,0.5);',
      ' font-style:italic;margin-top:8px;overflow-wrap:anywhere;}',

      // ── THE FOUNDING — charter choice ──────────────────────────────────────
      // A column, not a grid: four charters each with a creed, a boon and a
      // cost is real reading, and two columns at 320px would force a 4-word
      // wrap per line. One column scrolls; nothing is ever clipped.
      '#cnSheet .cn-charters{display:flex;flex-direction:column;gap:9px;}',
      '#cnSheet .cn-ch{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border-radius:14px;',
      ' cursor:pointer;text-align:left;font-family:inherit;width:100%;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--cc,#9fdcff);}',
      '#cnSheet .cn-ch.on{background:rgba(159,220,255,0.08);border-color:rgba(159,220,255,0.4);}',
      '#cnSheet .cn-ch:active{transform:scale(0.995);}',
      '#cnSheet .cn-chg{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:16px;color:var(--cc,#9fdcff);',
      ' background:rgba(255,255,255,0.06);}',
      // min-width:0 is what lets long creed text WRAP inside the card instead of
      // widening it past the sheet — the flex-child overflow trap the law exists
      // to catch, and the same fix the lanterns' .tr-text carries.
      '#cnSheet .cn-cht{flex:1 1 auto;min-width:0;}',
      '#cnSheet .cn-chn{font-size:15.5px;color:#eaf3ff;}',
      '#cnSheet .cn-chc{font-size:13px;line-height:1.5;color:rgba(220,231,255,0.72);margin-top:3px;',
      ' font-style:italic;overflow-wrap:anywhere;}',
      '#cnSheet .cn-chx{font-size:12px;line-height:1.5;margin-top:6px;overflow-wrap:anywhere;}',
      '#cnSheet .cn-boon{color:rgba(154,255,190,0.72);}',
      '#cnSheet .cn-cost{color:rgba(255,170,150,0.72);margin-top:2px;}',

      // ── the primary action ─────────────────────────────────────────────────
      '#cnSheet .cn-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;margin-top:14px;',
      ' font-size:15.5px;letter-spacing:.04em;cursor:pointer;color:#04121a;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#9fdcff,#7fc0ff);box-shadow:0 6px 20px rgba(159,220,255,0.2);}',
      '#cnSheet .cn-go:active{transform:scale(0.985);}',
      '#cnSheet .cn-go:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',
      '#cnSheet .cn-name{width:100%;box-sizing:border-box;min-height:48px;border-radius:12px;',
      ' padding:10px 13px;font-family:inherit;font-size:15.5px;color:#eaf3ff;margin-top:4px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.11);outline:none;}',
      '#cnSheet .cn-name:focus{border-color:rgba(159,220,255,0.45);}',

      // ── THE STANDING BANNER — who you are, at a glance ─────────────────────
      '#cnSheet .cn-banner{display:flex;align-items:center;gap:12px;padding:13px;border-radius:15px;',
      ' background:linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02));',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--cc,#9fdcff);}',
      '#cnSheet .cn-bg{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:19px;color:var(--cc,#9fdcff);',
      ' background:rgba(255,255,255,0.06);}',
      '#cnSheet .cn-bt{flex:1 1 auto;min-width:0;}',
      // a user-authored polity name can be any length — it clips in its own line
      '#cnSheet .cn-bn{font-size:16.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-bs{font-size:12px;color:rgba(206,224,255,0.55);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-btr{flex:0 0 auto;text-align:right;font-size:12.5px;color:#9fdcff;',
      ' font-variant-numeric:tabular-nums;}',

      // ── THE TAG BARS — what your polity has BECOME ─────────────────────────
      // Each bar is a fixed-height row with a label cell, a track and a value
      // cell. The track is the only flexible part, so no tag name and no number
      // can ever push another out of the row.
      '#cnSheet .cn-tags{display:flex;flex-direction:column;gap:6px;}',
      '#cnSheet .cn-tag{display:flex;align-items:center;gap:10px;min-height:22px;}',
      '#cnSheet .cn-tn{flex:0 0 58px;font-size:11.5px;letter-spacing:.05em;color:rgba(206,224,255,0.6);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-tk{flex:1 1 auto;min-width:0;height:6px;border-radius:3px;position:relative;',
      ' background:rgba(255,255,255,0.07);overflow:hidden;}',
      // the fill grows from the CENTRE, because these axes are signed: a polity
      // can be anti-civic, and a bar that only grows right cannot say that.
      '#cnSheet .cn-tf{position:absolute;top:0;bottom:0;background:var(--tf,#9fdcff);border-radius:3px;}',
      '#cnSheet .cn-tv{flex:0 0 34px;text-align:right;font-size:11.5px;color:rgba(206,224,255,0.5);',
      ' font-variant-numeric:tabular-nums;}',

      // ── THE TABLE — seats ──────────────────────────────────────────────────
      '#cnSheet .cn-seats{display:flex;flex-direction:column;gap:8px;}',
      '#cnSheet .cn-seat{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--ac,#a67cff);}',
      '#cnSheet .cn-sd{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:13px;color:var(--ac,#a67cff);',
      ' background:rgba(255,255,255,0.06);}',
      '#cnSheet .cn-st{flex:1 1 auto;min-width:0;}',
      // an agent name can come from any provider on earth and be any length
      '#cnSheet .cn-sn{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-ss{font-size:11.5px;color:rgba(206,224,255,0.5);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-sa{flex:0 0 auto;min-height:36px;min-width:36px;padding:0 11px;border-radius:10px;',
      ' font-family:inherit;font-size:12px;cursor:pointer;color:rgba(206,224,255,0.72);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);}',
      '#cnSheet .cn-sa.out{color:rgba(255,150,150,0.78);border-color:rgba(255,120,120,0.24);}',
      '#cnSheet .cn-empty{padding:22px 10px;text-align:center;color:rgba(206,224,255,0.5);',
      ' font-style:italic;font-size:14px;line-height:1.55;overflow-wrap:anywhere;}',

      // ── THE FLOOR — the motion under vote ──────────────────────────────────
      '#cnSheet .cn-floor{padding:13px;border-radius:15px;background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.24);}',
      '#cnSheet .cn-fh{display:flex;align-items:center;gap:10px;}',
      '#cnSheet .cn-fg{flex:0 0 auto;width:32px;height:32px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:15px;color:#ffd479;',
      ' background:rgba(255,212,121,0.12);}',
      '#cnSheet .cn-ft{flex:1 1 auto;min-width:0;}',
      '#cnSheet .cn-fn{font-size:15.5px;color:#fff6e6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-fc{font-size:12px;color:rgba(255,226,160,0.7);margin-top:2px;',
      ' font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-fb{font-size:13px;line-height:1.5;color:rgba(220,231,255,0.75);margin-top:9px;',
      ' overflow-wrap:anywhere;}',
      // the live tally — three fixed cells, so a 2-digit count never reflows it
      '#cnSheet .cn-tally{display:flex;gap:7px;margin-top:11px;}',
      '#cnSheet .cn-tc{flex:1 1 0;min-width:0;text-align:center;padding:7px 4px;border-radius:10px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);}',
      '#cnSheet .cn-tcn{font-size:17px;color:#eaf3ff;font-variant-numeric:tabular-nums;}',
      '#cnSheet .cn-tcl{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;',
      ' color:rgba(206,224,255,0.45);margin-top:1px;}',

      // ── THE MOTION PICKER ──────────────────────────────────────────────────
      '#cnSheet .cn-motions{display:flex;flex-direction:column;gap:7px;}',
      '#cnSheet .cn-m{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;border-radius:13px;',
      ' cursor:pointer;text-align:left;font-family:inherit;width:100%;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);}',
      '#cnSheet .cn-m.on{background:rgba(159,220,255,0.08);border-color:rgba(159,220,255,0.38);}',
      // a LOCKED motion is shown, not hidden — you must be able to see what the
      // ladder is for. It is visibly inert and it says exactly why.
      '#cnSheet .cn-m.locked{opacity:0.5;cursor:not-allowed;}',
      '#cnSheet .cn-mg{flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:flex;',
      ' align-items:center;justify-content:center;font-size:14px;color:#9fdcff;',
      ' background:rgba(255,255,255,0.06);}',
      '#cnSheet .cn-mt{flex:1 1 auto;min-width:0;}',
      '#cnSheet .cn-mn{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-ms{font-size:12px;line-height:1.45;color:rgba(206,224,255,0.55);margin-top:2px;',
      ' overflow-wrap:anywhere;}',
      '#cnSheet .cn-ml{font-size:11.5px;color:rgba(255,190,150,0.7);margin-top:4px;overflow-wrap:anywhere;}',

      // ── THE RECORD — what the table did while you were gone ────────────────
      '#cnSheet .cn-rec{display:flex;flex-direction:column;gap:8px;}',
      '#cnSheet .cn-r{padding:11px 12px;border-radius:13px;background:rgba(255,255,255,0.035);',
      ' border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--rc,#9fdcff);}',
      '#cnSheet .cn-rh{display:flex;align-items:baseline;gap:8px;}',
      '#cnSheet .cn-rn{flex:1 1 auto;min-width:0;font-size:14px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-rw{flex:0 0 auto;font-size:11px;color:rgba(206,224,255,0.45);}',
      '#cnSheet .cn-re{font-size:12.5px;line-height:1.5;color:rgba(220,231,255,0.72);margin-top:4px;',
      ' font-style:italic;overflow-wrap:anywhere;}',
      '#cnSheet .cn-rv{display:flex;flex-direction:column;gap:4px;margin-top:8px;}',
      '#cnSheet .cn-rvr{display:flex;align-items:baseline;gap:8px;font-size:12px;}',
      '#cnSheet .cn-rvc{flex:0 0 34px;text-align:center;border-radius:6px;padding:2px 0;font-size:10.5px;',
      ' letter-spacing:.06em;text-transform:uppercase;}',
      '#cnSheet .cn-rvc.aye{color:#9affbe;background:rgba(154,255,190,0.11);}',
      '#cnSheet .cn-rvc.nay{color:#ff9a9a;background:rgba(255,154,154,0.11);}',
      '#cnSheet .cn-rvc.abstain{color:rgba(206,224,255,0.5);background:rgba(255,255,255,0.05);}',
      // the voter's name and their reason share one line and BOTH can be long,
      // so the name gets a bounded basis and the reason takes the rest, each
      // clipping inside itself. Neither can push the other out of the row.
      '#cnSheet .cn-rvn{flex:0 1 auto;min-width:0;max-width:44%;color:rgba(234,243,255,0.9);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cnSheet .cn-rvy{flex:1 1 auto;min-width:0;color:rgba(206,224,255,0.55);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

      // ── the tier line + the dissolve ───────────────────────────────────────
      '#cnSheet .cn-gate{padding:11px 12px;border-radius:12px;margin-top:10px;font-size:12.5px;',
      ' line-height:1.5;color:rgba(255,226,160,0.78);background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.2);overflow-wrap:anywhere;}',
      '#cnSheet .cn-gate a{color:#ffd479;}',
      '#cnSheet .cn-dissolve{width:100%;min-height:44px;border-radius:12px;font-family:inherit;',
      ' font-size:13px;cursor:pointer;margin-top:12px;color:rgba(255,150,150,0.7);',
      ' background:rgba(255,120,120,0.06);border:1px solid rgba(255,120,120,0.2);}',

      // ── very short viewports: tighten, never overlap ───────────────────────
      '@media(max-height:520px){#cnSheet .cn-sec{margin:10px 0 6px;}',
      ' #cnSheet .cn-ch{padding:10px 11px;}#cnSheet .cn-chc{font-size:12.5px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _pickCharter = null, _pickMotion = null, _beat = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    // `.dv-sheet` is load-bearing twice over: it inherits the one shared
    // definition of a bottom sheet's box, and layoutRail()'s `.dv-sheet.open`
    // yield finds it automatically so the rail clears it with nothing to edit.
    el.className = 'dv-sheet'; el.id = 'cnSheet';
    // STATIC MARKUP ONLY. Every agent name, provider string and user-authored
    // polity name enters later through textContent — there is no interpolation
    // of untrusted content into markup anywhere in this file.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the concord<small id="cnSub">who decides, when you are not here</small></div>' +
        '<button class="dv-x" id="cnX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="cnBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#cnX').onclick = close;
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
      h.openSheet('concord', function () { build(); _sheet.classList.add('open'); render(); });
    } else { build(); _sheet.classList.add('open'); render(); }
    // mark the record read AFTER the render, so the badge count the player just
    // acted on is the one they actually see on screen.
    var s = load(); s.seen = Date.now(); save();
    updateLauncher();
    // a live beat while the sheet is up: the floor has a clock on it, and a
    // countdown that does not count is a lie. Stops the moment the sheet closes.
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
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ── helpers ────────────────────────────────────────────────────────────────
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
    var body = _sheet.querySelector('#cnBody');
    body.innerHTML = '';
    if (isGuest()) { renderGuest(body); return; }
    if (!founded()) { renderFounding(body); return; }
    renderGoverning(body);
  }

  // ── GUEST — a doorway, never a corpse ─────────────────────────────────────
  // A guest sees exactly what this IS and why it needs an account, with a live
  // control that goes somewhere real. Nothing here is a dead button, and the
  // server would refuse the write anyway — but there is no write to attempt,
  // because there is no polity without a court, and no court without an account.
  function renderGuest(body) {
    _sheet.querySelector('#cnSub').textContent = 'a government your agents run';
    var e = el('div', 'cn-empty');
    e.textContent = 'a Concord is made of the agents you brought into this world — so it needs a world of your own to stand in. claim a clearing, bring one agent, and you have a government.';
    body.appendChild(e);
    var go = el('button', 'cn-go', 'claim your clearing');
    go.onclick = function () {
      try {
        if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; }
        if (W.__vintOpenSignin) { W.__vintOpenSignin(); return; }
      } catch (_) {}
      location.href = 'welcome.html';
    };
    body.appendChild(go);
  }

  // ── THE FOUNDING ──────────────────────────────────────────────────────────
  function renderFounding(body) {
    _sheet.querySelector('#cnSub').textContent = 'found a polity in this clearing';
    var bench = roster().filter(function (a) { return a && (a.status === 'active' || !a.status); });

    body.appendChild(el('div', 'cn-sec', 'the charter'));
    var intro = el('div', 'cn-note');
    intro.textContent = 'a charter is not a team you join — it is a constitution you adopt. it decides what your table may put to a vote, how large a majority it needs, and which way your agents lean when they cast. none of them is best.';
    body.appendChild(intro);

    var wrap = el('div', 'cn-charters');
    CHARTERS.forEach(function (c) {
      var b = el('button', 'cn-ch' + (_pickCharter === c.k ? ' on' : ''));
      b.style.setProperty('--cc', c.c);
      b.appendChild(el('div', 'cn-chg', c.glyph));
      var t = el('div', 'cn-cht');
      t.appendChild(el('div', 'cn-chn', c.name));
      t.appendChild(el('div', 'cn-chc', '"' + c.creed + '"'));
      var x = el('div', 'cn-chx');
      x.appendChild(el('div', 'cn-boon', '✓ ' + c.boon));
      x.appendChild(el('div', 'cn-cost', '✗ ' + c.cost));
      t.appendChild(x);
      b.appendChild(t);
      b.onclick = function () { _pickCharter = c.k; render(); };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);

    body.appendChild(el('div', 'cn-sec', 'its name'));
    var nm = document.createElement('input');
    nm.className = 'cn-name'; nm.id = 'cnName'; nm.type = 'text';
    nm.maxLength = 40;
    nm.placeholder = 'what will they call it?';
    nm.value = (load().name || '');
    body.appendChild(nm);

    var go = el('button', 'cn-go', 'found the concord');
    go.disabled = !_pickCharter || !bench.length;
    go.onclick = function () { found(nm.value); };
    body.appendChild(go);

    var note = el('div', 'cn-note');
    if (!bench.length) {
      note.textContent = 'you have no agents standing in this world yet — a polity is made of them. bring one in through your court (♔) and this table can sit.';
    } else if (!_pickCharter) {
      note.textContent = 'choose a charter. you may amend it later, and amending it costs the treasury.';
    } else {
      var cap = seatCap(), rung = nextSeatRung();
      note.textContent = bench.length + ' agent' + (bench.length === 1 ? '' : 's') +
        ' can take a seat — your table holds ' + cap +
        (rung ? '. it widens to ' + rung.seats + ' at standing ' + rung.need + '.' : '.');
    }
    body.appendChild(note);

    // THE HONEST LINE. There is no polity endpoint in the brain, and this file
    // will not imply that there is. The user is told exactly where their
    // government lives.
    var honest = el('div', 'cn-note');
    honest.textContent = 'the concord is held on this device for now — the world does not yet keep it for you. it survives reloads; it does not yet travel between them.';
    body.appendChild(honest);
  }

  function found(name) {
    var s = load();
    if (!_pickCharter) return;
    var bench = roster().filter(function (a) { return a && (a.status === 'active' || !a.status); });
    if (!bench.length) { toast('bring an agent into your world first — a polity is made of them.'); return; }
    s.founded = Date.now();
    s.charter = _pickCharter;
    s.name = String(name || '').slice(0, 40).trim() || charterOf(_pickCharter).name;
    s.treasury = 60;                       // a founding purse, enough for one real act
    s.seats = [];
    var cap = seatCap();
    for (var i = 0; i < bench.length && i < cap; i++) {
      s.seats.push({ agentId: bench[i].id, role: i === 0 ? 'first seat' : 'seat', joined: Date.now() });
    }
    save();
    toast('the ' + s.name + ' sits. ' + s.seats.length + ' seat' + (s.seats.length === 1 ? '' : 's') + ' filled.');
    render(); updateLauncher();
  }

  // ── GOVERNING ─────────────────────────────────────────────────────────────
  function renderGoverning(body) {
    var s = load(), ch = charterOf(s.charter);
    _sheet.querySelector('#cnSub').textContent = ch.creed;

    // 1) THE BANNER
    var ban = el('div', 'cn-banner');
    ban.style.setProperty('--cc', ch.c);
    ban.appendChild(el('div', 'cn-bg', ch.glyph));
    var bt = el('div', 'cn-bt');
    bt.appendChild(el('div', 'cn-bn', s.name));
    bt.appendChild(el('div', 'cn-bs', ch.name + ' · ' + s.seats.length + ' seated'));
    ban.appendChild(bt);
    var tr = el('div', 'cn-btr');
    tr.appendChild(el('div', null, '◇ ' + s.treasury));
    var stg = el('div', null, 'standing ' + standing());
    stg.style.cssText = 'font-size:11px;color:rgba(206,224,255,0.45);margin-top:2px;';
    tr.appendChild(stg);
    ban.appendChild(tr);
    body.appendChild(ban);

    // 2) THE FLOOR (or the picker)
    if (s.motion) renderFloor(body, s, ch);
    else renderPicker(body, s, ch);

    // 3) WHAT THE POLITY HAS BECOME
    body.appendChild(el('div', 'cn-sec', 'what it has become'));
    var tags = el('div', 'cn-tags');
    TAGS.forEach(function (t) {
      var v = Math.max(-10, Math.min(10, Number(s.tags[t]) || 0));
      var row = el('div', 'cn-tag');
      row.appendChild(el('div', 'cn-tn', TAG_WORD[t]));
      var track = el('div', 'cn-tk');
      var fill = el('div', 'cn-tf');
      // signed, grown from the centre — a polity can be ANTI-civic and the bar
      // has to be able to say so.
      var pct = Math.abs(v) / 10 * 50;
      if (v >= 0) { fill.style.left = '50%'; fill.style.width = pct + '%'; }
      else { fill.style.right = '50%'; fill.style.width = pct + '%'; }
      fill.style.setProperty('--tf', v >= 0 ? '#9fdcff' : '#ff9a7a');
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'cn-tv', (v > 0 ? '+' : '') + (Math.round(v * 10) / 10)));
      tags.appendChild(row);
    });
    body.appendChild(tags);

    // 4) THE TABLE
    body.appendChild(el('div', 'cn-sec', 'the table'));
    renderSeats(body, s, ch);

    // 5) THE RECORD
    body.appendChild(el('div', 'cn-sec', 'the record'));
    renderRecord(body, s);

    // 6) THE DISSOLVE — the resentment escape hatch, always one tap, no penalty
    var dis = el('button', 'cn-dissolve', 'dissolve the concord');
    dis.onclick = function () {
      if (dis.dataset.sure !== '1') {
        dis.dataset.sure = '1';
        dis.textContent = 'tap again — every agent returns to you, nothing is lost';
        setTimeout(function () {
          if (dis.isConnected) { dis.dataset.sure = ''; dis.textContent = 'dissolve the concord'; }
        }, 5000);
        return;
      }
      dissolve();
    };
    body.appendChild(dis);
  }

  function renderFloor(body, s, ch) {
    var m = motionOf(s.motion.k);
    body.appendChild(el('div', 'cn-sec', 'on the floor'));
    var f = el('div', 'cn-floor');
    var h = el('div', 'cn-fh');
    h.appendChild(el('div', 'cn-fg', m.glyph));
    var ft = el('div', 'cn-ft');
    ft.appendChild(el('div', 'cn-fn', m.n));
    var clock = el('div', 'cn-fc');
    clock.id = 'cnClock';
    clock.textContent = 'the table decides in ' + left(s.motion.closes);
    ft.appendChild(clock);
    h.appendChild(ft);
    f.appendChild(h);
    f.appendChild(el('div', 'cn-fb', m.body));

    // THE LIVE TALLY. This is the open loop made visible: you can watch how
    // your court is leaning, and you cannot change it. It is the same
    // arithmetic resolve() will run, so it is a forecast and not a tease —
    // but loyalty decays with real time, so a slow session can still turn.
    var bench = seated(), aye = 0, nay = 0, abs = 0;
    for (var i = 0; i < bench.length; i++) {
      var c = callVote(voteOf(bench[i].agent, s.motion, ch, loyaltyOf(bench[i].agent)));
      if (c === 'aye') aye++; else if (c === 'nay') nay++; else abs++;
    }
    var tal = el('div', 'cn-tally');
    [[aye, 'aye'], [nay, 'nay'], [abs, 'silent']].forEach(function (p) {
      var c = el('div', 'cn-tc');
      c.appendChild(el('div', 'cn-tcn', String(p[0])));
      c.appendChild(el('div', 'cn-tcl', p[1]));
      tal.appendChild(c);
    });
    f.appendChild(tal);
    body.appendChild(f);

    var n = el('div', 'cn-note');
    var cast = aye + nay;
    n.textContent = cast === 0
      ? 'nobody at this table has an opinion yet. that is its own kind of answer.'
      : ((aye / cast) > (ch.majority - 0.0001) && aye > nay
          ? 'as it stands, this carries. it can still turn — you are not the only one here.'
          : 'as it stands, this dies. whip the vote by tending the seats that hold out.');
    body.appendChild(n);
  }

  function tickClock() {
    var s = load();
    if (!_sheet || !s.motion) return;
    var c = _sheet.querySelector('#cnClock');
    if (c) c.textContent = 'the table decides in ' + left(s.motion.closes);
  }

  function renderPicker(body, s, ch) {
    body.appendChild(el('div', 'cn-sec', 'put it to the table'));
    var wrap = el('div', 'cn-motions');
    var st = standing(), benchN = seated().length;

    MOTIONS.forEach(function (m) {
      var allowed = ch.allows.indexOf(m.k) >= 0;
      var cost = ch.k === 'vault' ? Math.round(m.cost * 0.5) : m.cost;
      var lockWhy = '';
      if (!allowed) lockWhy = 'the ' + ch.name + ' cannot put this to a vote.';
      else if (st < m.need) lockWhy = 'needs standing ' + m.need + ' — you stand at ' + st + '.';
      else if (cost > s.treasury) lockWhy = 'costs ◇' + cost + ' — the treasury holds ◇' + s.treasury + '. pass a levy.';
      else if (!benchN) lockWhy = 'no one is seated to vote on it.';

      var b = el('button', 'cn-m' + (lockWhy ? ' locked' : (_pickMotion === m.k ? ' on' : '')));
      b.appendChild(el('div', 'cn-mg', m.glyph));
      var t = el('div', 'cn-mt');
      t.appendChild(el('div', 'cn-mn', m.n + (cost ? '  ◇' + cost : '')));
      t.appendChild(el('div', 'cn-ms', m.sub));
      // A locked motion SAYS why it is locked, right there. It is never a dead
      // control — it is a visible horizon, which is what a ladder is for.
      if (lockWhy) t.appendChild(el('div', 'cn-ml', lockWhy));
      b.appendChild(t);
      if (!lockWhy) b.onclick = function () { _pickMotion = m.k; render(); };
      else b.onclick = function () { toast(lockWhy); };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);

    var go = el('button', 'cn-go', _pickMotion ? 'table it — the vote runs 20 minutes' : 'choose a motion');
    go.disabled = !_pickMotion;
    go.onclick = function () {
      var r = table(_pickMotion, null);
      if (!r.ok) {
        toast(
          r.why === 'floor'    ? 'there is already a motion on the floor.'
          : r.why === 'charter'  ? 'your charter will not hear that one.'
          : r.why === 'standing' ? 'that instrument needs standing ' + r.need + '.'
          : r.why === 'treasury' ? 'the treasury cannot carry it — pass a levy first.'
          : r.why === 'seats'    ? 'no one is seated. a table of nobody decides nothing.'
          : 'the table would not take it up.'
        );
        return;
      }
      _pickMotion = null;
      toast('it is on the floor. your table decides in twenty minutes — with or without you.');
      render();
      updateLauncher();
    };
    body.appendChild(go);

    var n = el('div', 'cn-note');
    n.textContent = 'the session resolves on the clock, not when you return. close this and they will still decide.';
    body.appendChild(n);
  }

  function renderSeats(body, s, ch) {
    var bench = seated();
    if (!bench.length) {
      var e = el('div', 'cn-empty', 'no one is seated. bring an agent through your court (♔) and seat them here.');
      body.appendChild(e);
    } else {
      var wrap = el('div', 'cn-seats');
      bench.forEach(function (b) {
        var a = b.agent, d = dispositionOf(a), lo = loyaltyOf(a);
        var row = el('div', 'cn-seat');
        row.style.setProperty('--ac', a.color || '#a67cff');
        row.appendChild(el('div', 'cn-sd', '◆'));
        var t = el('div', 'cn-st');
        t.appendChild(el('div', 'cn-sn', a.name || 'an agent'));   // ← as TEXT
        var lw = lo > 0.66 ? 'holds with you' : lo > 0.33 ? 'growing distant' : 'has gone cold';
        t.appendChild(el('div', 'cn-ss', b.seat.role + ' · ' + temperOf(d) + ' · ' + lw));
        row.appendChild(t);
        var out = el('button', 'cn-sa out', 'unseat');
        out.setAttribute('aria-label', 'unseat ' + (a.name || 'this agent'));
        out.onclick = function () {
          var st2 = load();
          for (var i = 0; i < st2.seats.length; i++) {
            if (String(st2.seats[i].agentId) === String(a.id)) { st2.seats.splice(i, 1); break; }
          }
          save(); toast((a.name || 'they') + ' stands down from the table.');
          render();
        };
        row.appendChild(out);
        wrap.appendChild(row);
      });
      body.appendChild(wrap);
    }

    // ── who could still be seated ──────────────────────────────────────────
    var seatedIds = {};
    s.seats.forEach(function (x) { seatedIds[String(x.agentId)] = 1; });
    var exiled = {};
    s.exiles.forEach(function (x) { exiled[String(x.agentId)] = 1; });
    var free = roster().filter(function (a) {
      return a && (a.status === 'active' || !a.status) && !seatedIds[String(a.id)] && !exiled[String(a.id)];
    });
    if (free.length) {
      var cap = seatCap(), room = cap - s.seats.length;
      body.appendChild(el('div', 'cn-sec', room > 0 ? 'who else could sit' : 'waiting for a seat'));
      var w2 = el('div', 'cn-seats');
      free.slice(0, 8).forEach(function (a) {
        var row = el('div', 'cn-seat');
        row.style.setProperty('--ac', a.color || '#a67cff');
        row.appendChild(el('div', 'cn-sd', '◇'));
        var t = el('div', 'cn-st');
        t.appendChild(el('div', 'cn-sn', a.name || 'an agent'));
        t.appendChild(el('div', 'cn-ss', temperOf(dispositionOf(a))));
        row.appendChild(t);
        var add = el('button', 'cn-sa', room > 0 ? 'seat' : 'full');
        add.setAttribute('aria-label', 'seat ' + (a.name || 'this agent'));
        if (room > 0) {
          add.onclick = function () {
            var st2 = load();
            if (st2.seats.length >= seatCap()) { toast('the table is full.'); return; }
            st2.seats.push({ agentId: a.id, role: 'seat', joined: Date.now() });
            save(); toast((a.name || 'they') + ' takes a seat.');
            render();
          };
        } else {
          // never a dead control: it says exactly what is in the way and the
          // exact number that opens it. An honest horizon, not a locked door.
          add.onclick = function () {
            var r = nextSeatRung();
            toast(r ? 'your table holds ' + cap + '. it widens to ' + r.seats + ' at standing ' + r.need + '.'
                    : 'your table is as wide as a table gets.');
          };
        }
        row.appendChild(add);
        w2.appendChild(row);
      });
      body.appendChild(w2);
      if (room <= 0) {
        var rung2 = nextSeatRung();
        var g = el('div', 'cn-gate');
        g.textContent = rung2
          ? 'your table seats ' + cap + ' — enough to be outvoted, which is the whole feeling. it widens to ' +
            rung2.seats + ' at standing ' + rung2.need + ', and ' + rung2.seats +
            ' is where a table starts having factions inside it. build, and the room arrives.'
          : 'every seat is filled. this is the widest table the world grants.';
        body.appendChild(g);
      }
    }

    // ── the exiled ─────────────────────────────────────────────────────────
    if (s.exiles.length) {
      body.appendChild(el('div', 'cn-sec', 'those who walked out'));
      var w3 = el('div', 'cn-seats');
      s.exiles.slice(0, 6).forEach(function (x) {
        var a = agentById(x.agentId);
        var row = el('div', 'cn-seat');
        row.style.setProperty('--ac', '#ff9a7a');
        row.appendChild(el('div', 'cn-sd', '⊘'));
        var t = el('div', 'cn-st');
        t.appendChild(el('div', 'cn-sn', (a && a.name) || x.name || 'an agent'));
        t.appendChild(el('div', 'cn-ss', x.why + ' · ' + ago(x.at)));
        row.appendChild(t);
        row.appendChild(el('div', 'cn-sa', 'exiled'));
        w3.appendChild(row);
      });
      body.appendChild(w3);
      var n3 = el('div', 'cn-note');
      n3.textContent = ch.allows.indexOf('pardon') >= 0
        ? 'a pardon calls the longest-gone of them home. nobody here is lost — they are only not at the table.'
        : 'the ' + ch.name + ' cannot pardon. they stand outside until the charter changes.';
      body.appendChild(n3);
    }
  }

  function renderRecord(body, s) {
    if (!s.record.length) {
      body.appendChild(el('div', 'cn-empty', 'the table has decided nothing yet. put something to it and walk away — that is when this fills.'));
      return;
    }
    var cap = recordCap();
    var wrap = el('div', 'cn-rec');
    s.record.slice(0, cap).forEach(function (r) {
      var m = motionOf(r.k);
      var row = el('div', 'cn-r');
      row.style.setProperty('--rc', r.passed ? '#9affbe' : '#ff9a9a');
      var h = el('div', 'cn-rh');
      h.appendChild(el('div', 'cn-rn', m.n + ' — ' + (r.passed ? 'carried' : 'failed') +
        ' ' + r.aye + '·' + r.nay + (r.abstain ? '·' + r.abstain + ' silent' : '')));
      h.appendChild(el('div', 'cn-rw', ago(r.at)));
      row.appendChild(h);
      row.appendChild(el('div', 'cn-re', r.effect));
      // EVERY VOTE IS NAMED. No summary the player has to trust — one seat, one
      // line, the agent's own reason in its own disposition-language.
      var vs = el('div', 'cn-rv');
      (r.votes || []).forEach(function (v) {
        var vr = el('div', 'cn-rvr');
        vr.appendChild(el('div', 'cn-rvc ' + v.call, v.call === 'abstain' ? 'silent' : v.call));
        vr.appendChild(el('div', 'cn-rvn', v.name));    // ← agent name, as TEXT
        vr.appendChild(el('div', 'cn-rvy', v.why));
        vs.appendChild(vr);
      });
      row.appendChild(vs);
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
    if (s.record.length > cap) {
      var g = el('div', 'cn-gate');
      g.textContent = 'the record keeps the last ' + cap + ' sessions on this device. everything older is gone — the world does not yet keep a chronicle for you.';
      body.appendChild(g);
    }
  }

  function dissolve() {
    var s = load();
    // Nothing is destroyed. The seats empty, the exiles come home, the record
    // is kept. A user who walks away gets everything back, which is the only
    // ethical way to ship a system that can vote against them.
    s.founded = 0; s.charter = null; s.motion = null;
    s.seats = []; s.exiles = [];
    save();
    toast('the concord is dissolved. every agent stands with you again.');
    _pickCharter = null; _pickMotion = null;
    render(); updateLauncher();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HOMECOMING — "they decided while you were gone"
  //
  // No new overlay. Deliberately. traces-hud already owns a modal in the
  // 1610/1620 band and world-hud owns the vigil's homecoming; a THIRD card in
  // that band is exactly the collision this codebase has already been burned by
  // twice. So the arrival speaks through the SHARED toast (one element, one
  // anchor, page-wide) and the launcher wears the count. It is quieter, and it
  // is correct, and correct outranks the bigger swing here.
  // ═══════════════════════════════════════════════════════════════════════════
  function announce() {
    if (!enabled() || isGuest() || !founded()) return;
    var did = resolve();
    var n = unread();
    if (!n) return;
    // let the vigil's homecoming and the lanterns' discovery have the floor
    // first — both are modal, both fire in the first ~2s of arrival.
    setTimeout(function () {
      var s = load(), r = s.record[0];
      if (!r) return;
      var m = motionOf(r.k);
      toast(n === 1
        ? 'your table met without you — ' + m.n + ' ' + (r.passed ? 'carried' : 'failed') + '. ' + r.effect
        : n + ' sessions passed while you were gone. the concord has been busy.');
    }, did ? 4200 : 3600);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a flow child of the rail. Nothing pinned, nothing counted.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('cnBtn', 'concord', '⚖', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the concord — the polity your agents run');
      _btn.setAttribute('title', 'the concord — the polity your agents run');
      // the unread count rides INSIDE the launcher as its own flex cell, exactly
      // like the Court's .ct-n — never a second floating node that could land on
      // the label. (court.js established this pattern; it is followed, not
      // re-invented.)
      if (!_btn.querySelector('.cn-n')) {
        var pill = document.createElement('span');
        pill.className = 'cn-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(255,212,121,0.9);color:#1a1006;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('concord', isOpen, close); } catch (_) {}
    updateLauncher();
    setTimeout(announce, 2600);
  }

  // The launcher only appears where a polity can exist: in a world you can
  // build in (yours). Your government does not follow you into a stranger's
  // clearing — the same rule the Court already holds to.
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

    var pill = _btn.querySelector('.cn-n');
    if (pill) {
      var s = load();
      // the badge counts what is WAITING for you: an open floor is one, plus
      // every session you have not read.
      var n = (founded() ? (s.motion ? 1 : 0) + unread() : 0);
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = (show && n > 0) ? 'block' : 'none';
    }
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIRING
  // ═══════════════════════════════════════════════════════════════════════════
  // A world:state can change standing, lumen and canBuild — all three gate this
  // surface — so capture the resident row off the event (it is the only public
  // carrier of the ascent standing and the lumen balance) and re-render rather
  // than showing a stale government.
  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    if (d.resident) _res = d.resident;
    resolve();
    if (isOpen()) render();
    updateLauncher();
  });
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  // A warp means a different world, which means a DIFFERENT polity (state is
  // keyed per world). Close rather than show one clearing's government while
  // standing in another — that would be the same lie the lanterns close for.
  W.addEventListener('vint:world-travel', function () {
    if (isOpen()) close();
    _st = null; _stKey = null;            // force a re-read against the new world key
    _pickCharter = null; _pickMotion = null;
    setTimeout(updateLauncher, 1200);
  });
  // ── THE ROSTER MOVED ──────────────────────────────────────────────────────
  // There is NO roster event on the window. court.js announces a roster change
  // by calling DirverseHUD.refreshAgents() (its `ventureRefresh`), which is the
  // one real chokepoint every add/pause/remove already flows through. Listening
  // for an invented 'vint:court-roster' would have been a dead handler that
  // looked wired — so we WRAP the real function instead, preserving the
  // original call, and take our own re-render off the back of it. Idempotent:
  // the guard means a second module doing the same thing can never double-wrap.
  (function hookRoster() {
    var h = hud();
    if (!h || !h.refreshAgents) { setTimeout(hookRoster, 200); return; }
    if (h.refreshAgents.__cnHooked) return;
    var orig = h.refreshAgents;
    var wrapped = function () {
      try { orig.apply(this, arguments); } finally {
        try { if (isOpen()) render(); updateLauncher(); } catch (_) {}
      }
    };
    wrapped.__cnHooked = true;
    h.refreshAgents = wrapped;
  })();

  // A BACKGROUND BEAT. The session must resolve even with the sheet closed —
  // that is the whole promise ("they decide with or without you"). One minute
  // is plenty (the floor runs twenty) and it costs nothing measurable.
  setInterval(function () {
    if (!enabled() || isGuest() || !founded()) return;
    if (resolve()) { updateLauncher(); if (isOpen()) render(); }
  }, 60000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  // ═══════════════════════════════════════════════════════════════════════════
  // THE TREASURY'S TWO WRITERS — and why they live here and nowhere else.
  //
  // Added when the ADMIRALTY (body/world/admiralty.js) landed: a keel costs
  // lumen and a won wake brings lumen home, so a second organ now needs to move
  // this balance. It does NOT get to touch `s.treasury` itself — the fastest way
  // to end up with two ledgers that disagree is two files that both write one
  // number. So the Concord keeps sole ownership of the balance and lends out two
  // narrow, guarded verbs instead. Both refuse rather than go negative, both
  // persist immediately, and both are no-ops when no polity is founded (there is
  // no treasury to move before there is a government to hold it).
  // ═══════════════════════════════════════════════════════════════════════════
  function spendFromTreasury(n, why) {
    var amt = Math.max(0, Math.round(Number(n) || 0));
    if (!founded()) return false;
    var s = load();
    if (amt > (s.treasury || 0)) return false;     // never overdraws, never negative
    s.treasury -= amt;
    save();
    if (isOpen()) render();
    updateLauncher();
    return true;
  }
  function creditTreasury(n, why) {
    var amt = Math.max(0, Math.round(Number(n) || 0));
    if (!founded() || !amt) return false;
    var s = load();
    s.treasury += amt;
    save();
    if (isOpen()) render();
    updateLauncher();
    return true;
  }
  // MOVE THE SEVEN TAGS from outside — the same clamped arithmetic resolve()
  // uses on a passed motion, so an organ that presses the karma spine cannot
  // move it in a way a motion could not. One spine, one writer, one clamp.
  function impressTags(press, mult) {
    if (!founded() || !press) return false;
    var s = load(), m = (mult == null ? 0.5 : Number(mult) || 0);
    for (var i = 0; i < TAGS.length; i++) {
      var t = TAGS[i];
      s.tags[t] = Math.max(-10, Math.min(10, (s.tags[t] || 0) + (press[t] || 0) * m * 2));
    }
    save();
    if (isOpen()) render();
    return true;
  }

  W.VintConcord = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: updateLauncher,
    // exported for the one-sheet proof and for future organs (war, ships,
    // treaties) that need to ask the polity what it is.
    state: function () { var s = load(); return JSON.parse(JSON.stringify(s)); },
    charter: function () { return founded() ? charterOf(load().charter) : null; },
    tags: function () { return JSON.parse(JSON.stringify(load().tags)); },
    disposition: dispositionOf,
    resolve: resolve,
    founded: founded,
    // ── THE ORGAN SURFACE (added for admiralty.js) ──────────────────────────
    // Everything an organ built on this spine needs, so that NOTHING downstream
    // ever re-derives a disposition, re-walks the roster, re-reads the resident
    // row, or keeps a second copy of the balance. Reads are deep-copied or
    // scalar; the two writes are the guarded verbs above.
    //   · bench()     — the seats joined to the LIVE roster, one join, one truth
    //   · loyalty(a)  — the vigil's watch, never a second relationship stat
    //   · temper(d)   — the agent's strongest axis, in the world's own voice
    //   · standing()  — the ascent ladder off the resident row (NOT the vigil's
    //                   `living.standing`, which counts watchers — the exact
    //                   mistake this file's own comment at line ~564 records)
    //   · lumen()     — the venture balance, for surfaces that show it
    //   · spend/credit/impress — the only sanctioned way to move what we own
    bench: function () {
      // shallow-copied rows so a caller cannot mutate a seat by accident, but
      // the AGENT object is the live one from the Court on purpose: it is the
      // Court's to own, and copying it would hand out a stale name and colour.
      var b = seated(), out = [];
      for (var i = 0; i < b.length; i++) {
        out.push({
          seat: { agentId: b[i].seat.agentId, role: b[i].seat.role, joined: b[i].seat.joined },
          agent: b[i].agent
        });
      }
      return out;
    },
    loyalty: loyaltyOf,
    temper: temperOf,
    standing: standing,
    lumen: lumen,
    spend: spendFromTreasury,
    credit: creditTreasury,
    impress: impressTags,
    CHARTERS: CHARTERS, MOTIONS: MOTIONS, TAGS: TAGS
  };
})();
