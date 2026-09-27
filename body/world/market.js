// market.js — THE BAZAAR: trade, combine tools. (AETHERHOLD, world-forger, 2026-09-26)
//
// ════════════════════════════════════════════════════════════════════════════
// Lord Vinta's FIRST-NAMED world verb was "trade, combine tools." The forge
// (forge-hud.js) owns the combine. The commons (commons.js) owns the LIVE swap:
// two humans standing in the same clearing, both watching one server-rendered
// escrow manifest, settled on the wire by world/ledger.js. That surface is a
// handshake — it needs both parties present, in the same room, at the same
// second. It is the right shape for "I am looking at you and we swap now."
//
// It is the WRONG shape for a MARKET. A market is asynchronous: you hang a thing
// on a stall and walk away, and offers arrive while you sleep; or you lay a bid
// on someone else's stall and come back to find your treasurer took it — or held
// out for more. Nobody has to be co-present. THAT is what world.html did not
// have, and it is what this organ is: a peer-to-peer TRADING MARKET where you
// and your agents list tools, resources and creations, make offers and bids
// against each other, and a lister ACCEPTS — and the accept settles through the
// Concord's ONE treasury and its seven-tag karma spine. Not a second economy.
// Not a second escrow. The bazaar that the room-handshake could never be.
//
// ── WHAT EVERY OTHER BROWSER MARKET SHIPS, AND WHY THIS ISN'T THAT ──────────
// The obvious build is an auction-house table: rows of items, a Buy button, a
// fake gold counter that only you can see, prices pulled from nowhere. It is a
// vending machine with a medieval skin, and it dies on contact with the seven
// tests — nothing invests, nothing opens a loop, and the "other traders" are a
// spreadsheet. THE COUNTERPARTIES HERE ARE YOUR OWN COURT. The agents you
// brought from Claude, OpenAI, Gemini, Agentis through the Court bid on your
// stalls and list their own, and WHAT they bid and WHETHER they accept is read
// deterministically from the SAME disposition the Concord governs by — a
// craft-leaning agent pays up for a tool, a suspicious treasurer holds out for a
// higher offer. You are not trading with a market. You are haggling with beings
// you chose.
//
// ── ONE ECONOMY, NEVER TWO — THE LOAD-BEARING LAW OF THIS FILE ──────────────
// world.html holds exactly one writable balance: the Concord's polity treasury,
// moved ONLY through VintConcord.spend()/credit(), which refuse rather than
// overdraw and are no-ops until a polity is founded. (VintConcord.lumen() — the
// player's personal venture balance off the resident row — is READ-ONLY here;
// no client verb writes it, so it is not a settlement rail.) This file keeps NO
// treasury of its own, NO second balance, NO local ledger. A settled trade is:
//   · the polity treasury CREDITED when you sold (income to your coffers), or
//     SPENT when you bought (the cost of acquiring), through the guarded verbs;
//   · the seven karma tags PRESSED through VintConcord.impress() — commerce
//     makes a polity more of a builder / convener / trusting thing;
//   · atomic: the treasury move is attempted FIRST, and if it is refused
//     (nothing to found, or the treasury cannot cover it) NOTHING settles — no
//     status flips, no karma moves, no history row. A refused offer settles
//     nothing, exactly as the task requires.
// Grep this file: it never assigns to a `treasury` field and never mints lumen.
//
// ── WHAT IS SERVER-BACKED AND WHAT IS NOT (THE HONEST PART) ─────────────────
// There is NO market endpoint in the brain — the sibling organs (concord,
// admiralty, factions, arcade) are all local-first for exactly this reason, and
// this one matches them rather than inventing a backend it cannot verify. State
// lives in localStorage under vint:market:<worldId>, in the exact shape a future
// POST /api/world/market would take. Agent offers and agent accepts resolve
// against WALL-CLOCK time so an offline resolution is real, not simulated on
// open. The file says so, in its own voice, on screen. The one thing it reads
// that it does not own is the roster (VintCourt.roster()) and the treasury/karma
// (VintConcord), which stay authoritative where they already are.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — you can browse forever for free. Listing costs nothing.
//    You can WITHDRAW your own stall at any time, no penalty, and DECLINE any
//    offer with no cost. Nothing a user made is ever consumed by the market; an
//    agent that loses a bid loses nothing. If a user read this file they would
//    find no trap, because there is none.
//  2 INVESTMENT (HELIOS) — the traders are the specific agents YOU brought from
//    providers YOU chose, haggling from their real dispositions. Nobody else's
//    market bids like yours. Your trade history is a compounding record that
//    exports as plain JSON (state()) — a history, not a lock.
//  3 TIER + CONVERSION (FRUGAL-MAX) — the same honest correction the Concord
//    made: world.html loads NO entitlement source, so a tier check here would
//    read 'free' for a paying user and upsell them what they own. So there is NO
//    faked gate. The market is free; the honest paid hook it is built to carry
//    is a CROSS-WORLD market (trading between worlds), which needs the server
//    endpoint anyway. It promises nothing it cannot verify.
//  4 AESTHETICALLY DENSE (LUNEX) — the world's voice, lowercase, Cormorant. A
//    settled trade is one sentence. No filler copy anywhere in this file.
//  5 THE OPEN LOOP (MORRISON) — you hang a tool on a stall and close the tab.
//    You come back to find three of your agents bid on it and your archivist
//    offered the most. The loop is made of other minds and a clock, not a streak.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_market', killable in 30s
//    (?market=0). Every offer names who made it; every settlement names both
//    sides and the price, as settled, never as a summary you must trust. The
//    resentment signal is 'close the market': one tap, wipes the bazaar's own
//    state, recorded.
//  7 MORE ALIVE (YUNA) — this is the point. Your agents governed (Concord),
//    sailed (Admiralty), took sides (Factions), played (Arcade). Now they TRADE
//    — they want your tools, they price your creations, they hold out for a
//    better deal. An agent that lowballs your listing is more alive than one
//    that only ever votes.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// This file adds ZERO fixed elements of its own. Not one. It uses exactly the
// extension points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — the button is a FLOW CHILD of #dvRail, so the
//     rail allocates the slot and re-measures. Nothing pinned, nothing counted,
//     no offset literal appears anywhere below.
//   · registerSheet('market', …) + openSheet('market', …) — the sheet joins the
//     one-open-at-a-time registry, so opening it EVICTS whatever is up, Escape
//     closes it, and the scrim tracks it. It carries `.dv-sheet`, which is
//     load-bearing twice: it inherits the single shared definition of a bottom
//     sheet's box, and layoutRail()'s `.dv-sheet.open` yield finds it with
//     nothing to remember.
// Every style rule below is scoped under #mkSheet. Nothing leaks. Every string
// that can be long — an agent name from any provider, a listing title, a note —
// is min-width:0 + ellipsis inside its own cell, or overflow-wrap:anywhere.
// Content yields; the box never grows. Verified at 320/375/768/1280/1920.
//
// UNTRUSTED CONTENT — agent names and user-authored titles/notes NEVER touch
// innerHTML. Static markup only; every name and authored string enters through
// textContent, at the leaf.
//
// ── HEADLESS BOUNDARY ───────────────────────────────────────────────────────
// The MODEL half (kinds, dispositions, list/offer/accept, settle, resolve) runs
// with no DOM, so scripts/verify-market.js asserts against THIS code, not a copy
// of it. Same shape concord.js and factions.js use, for the same reason.
// ════════════════════════════════════════════════════════════════════════════
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (W) {
  'use strict';
  var HAS_DOM = typeof document !== 'undefined' && !!(document && document.createElement);
  if (HAS_DOM && W.VintMarket) return W.VintMarket;

  var DOC = HAS_DOM ? document : null;

  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function court() { return W.VintCourt; }
  function concord() { return W.VintConcord; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // THE PLAYER'S OWN HANDLE at the table. One constant, so the seller/buyer test
  // is a single string compare everywhere and never a magic literal twice.
  var SELF = 'you';

  // ── FEATURE FLAG — 'world_market'. Killable in 30s, no deploy. ─────────────
  //   ?market=0 / ?market=1  ·  localStorage vint:flag:world_market = '0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new (W.URLSearchParams || URLSearchParams)((W.location && W.location.search) || '');
      if (q.get('market') === '0') _flag = false;
      else if (q.get('market') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_market') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE KINDS — what may cross the table. Three shapes of thing, each mapped to
  // ONE of the Concord's seven karma tags as its natural axis, so a trade in it
  // presses the spine the government already reads. No fourth vocabulary.
  // ═══════════════════════════════════════════════════════════════════════════
  var KINDS = [
    { k: 'tool',     n: 'a tool',     g: '⚒', c: '#9fdcff', axis: 'craft'  },
    { k: 'resource', n: 'a resource', g: '❖', c: '#c8f5c0', axis: 'civic'  },
    { k: 'creation', n: 'a creation', g: '✦', c: '#e8c8ff', axis: 'mentor' }
  ];
  function kindOf(k) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].k === k) return KINDS[i];
    return KINDS[0];
  }
  // The seven tags are the Concord's, read from it when present so there is ONE
  // definition; the fallback is the same verbatim list (a headless proof may run
  // before the Concord is on the window).
  function TAGS() {
    var c = concord();
    if (c && c.TAGS && c.TAGS.length) return c.TAGS;
    return ['civic', 'criminal', 'craft', 'social', 'mentor', 'heat', 'trust'];
  }
  function isTag(t) { return TAGS().indexOf(t) >= 0; }
  var TAG_WORD = {
    civic: 'civic', criminal: 'shadow', craft: 'craft',
    social: 'social', mentor: 'mentor', heat: 'heat', trust: 'trust'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — local, per world, shaped like the request a server would take.
  // Keyed per world so your bazaar is not the one you read in a stranger's
  // clearing. There is NO treasury field and NO lumen field here, by law: the
  // only balance is the Concord's, and this file never keeps a copy of it.
  // ═══════════════════════════════════════════════════════════════════════════
  var VER = 1;
  var LISTING_TTL = 7 * 24 * 60 * 60 * 1000;   // a stall stands a week, then lapses
  var OFFER_TTL   = 3 * 24 * 60 * 60 * 1000;   // an offer holds three days
  var MAX_LISTINGS = 40;                        // the bazaar keeps the freshest 40
  var MAX_OFFERS   = 8;                          // per stall
  var MAX_HISTORY  = 40;
  var MAX_CATCHUP  = 40;                         // never replay more than this on return
  var AGENT_TICK   = 17 * 60 * 1000;            // an agent considers the market ~every 17m

  var _st = null, _stKey = null;
  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:market:' + wid(); }
  function blank() {
    return {
      v: VER,
      opened: 0,            // when the bazaar was first walked into
      listings: [],         // [{id, title, kind, desc, ask, tag, sellerId, seller, isAgentSeller, at, status, offers:[...]}]
      history: [],          // settled trades, newest first: [{id, listingId, title, sellerId, seller, buyerId, buyer, lumen, tag, at}]
      seen: 0               // last time the player read the bazaar (badge)
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
        if (p && p.v === VER) {
          _st = p;
          if (!Array.isArray(_st.listings)) _st.listings = [];
          if (!Array.isArray(_st.history)) _st.history = [];
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(load())); }
    catch (e) {
      try { console.warn('[market] could not keep the bazaar:', e && e.message); } catch (_) {}
      toast('the bazaar is full — your device would not keep this.');
    }
  }

  // ── determinism spine — the same disciplined hash the siblings use ─────────
  function hash(str) {
    var h = 2166136261 >>> 0, s = String(str == null ? '' : str);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE COUNTERPARTIES — your court, joined once against the Court, exactly like
  // the Concord's bench and the Arcade's roster. Never a second copy of an agent.
  // ═══════════════════════════════════════════════════════════════════════════
  function roster() {
    try {
      var c = court();
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
  function agentById(id) {
    var r = roster();
    for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i];
    return null;
  }
  // an agent's disposition, from the Concord (the ONE definition of who it is);
  // a deterministic fallback keyed on identity when the Concord is absent.
  function dispositionOf(agent) {
    var c = concord();
    if (c && typeof c.disposition === 'function') {
      try { var d = c.disposition(agent); if (d) return d; } catch (_) {}
    }
    return null;
  }
  // edge ∈ [-1,1] — how much an agent's nature favours this kind's axis. This is
  // what makes a craft-leaning agent pay up for a tool and shrug at a creation.
  function edgeOf(agent, kind) {
    var d = dispositionOf(agent);
    if (d && typeof d[kind.axis] === 'number') {
      return Math.max(-1, Math.min(1, d[kind.axis]));
    }
    var h = hash((agent && (agent.id || agent.name)) + '|' + kind.axis);
    return ((h % 1000) / 1000) * 1.6 - 0.8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST — hang a thing on a stall. Free, always. The player is the seller by
  // default; resolve() calls this with an agent actor to seed the market so the
  // bazaar is never empty. One verb, one door — the same discipline the Concord
  // uses for table().
  // ═══════════════════════════════════════════════════════════════════════════
  function list(fields, actor) {
    if (!enabled()) return { ok: false, why: 'the market is closed' };
    fields = fields || {};
    var byAgent = !!(actor && actor.isAgent);
    if (!byAgent && isGuest()) return { ok: false, why: 'sign in to hang a stall' };

    var title = String(fields.title == null ? '' : fields.title).trim().slice(0, 60);
    if (!title) return { ok: false, why: 'a stall needs a name' };
    var kind = kindOf(fields.kind).k;
    var desc = String(fields.desc == null ? '' : fields.desc).trim().slice(0, 160);
    var ask = Math.max(0, Math.round(Number(fields.ask) || 0));
    var tag = isTag(fields.tag) ? fields.tag : kindOf(kind).axis;

    var s = load();
    if (!s.opened) s.opened = Date.now();
    var lst = {
      id: 'l' + Date.now().toString(36) + '_' + (hash(title + '|' + (actor && actor.id)) % 100000).toString(36),
      title: title, kind: kind, desc: desc, ask: ask, tag: tag,
      sellerId: byAgent ? String(actor.id) : SELF,
      seller: byAgent ? String(actor.name || 'an agent') : SELF,
      isAgentSeller: byAgent,
      at: Date.now(), status: 'open',
      offers: []
    };
    s.listings.unshift(lst);
    trim(s);
    save();
    if (isOpen()) render();
    updateLauncher();
    return { ok: true, listing: JSON.parse(JSON.stringify(lst)) };
  }

  function findListing(s, id) {
    for (var i = 0; i < s.listings.length; i++) if (s.listings[i].id === id) return s.listings[i];
    return null;
  }
  function findOffer(lst, id) {
    for (var i = 0; i < lst.offers.length; i++) if (lst.offers[i].id === id) return lst.offers[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OFFER / BID — lay lumen against a stall. The player calls this on an agent's
  // stall; resolve() calls it with an agent actor to bid on the player's stalls.
  // You cannot bid on your own stall. An offer is a promise of treasury lumen; it
  // moves nothing until it is accepted, so it is always safe to make and to walk
  // away from.
  // ═══════════════════════════════════════════════════════════════════════════
  function offer(listingId, lumen, note, actor) {
    if (!enabled()) return { ok: false, why: 'the market is closed' };
    var byAgent = !!(actor && actor.isAgent);
    if (!byAgent && isGuest()) return { ok: false, why: 'sign in to make an offer' };

    var s = load();
    var lst = findListing(s, listingId);
    if (!lst) return { ok: false, why: 'that stall is gone' };
    if (lst.status !== 'open') return { ok: false, why: 'that stall has closed' };

    var byId = byAgent ? String(actor.id) : SELF;
    if (byId === String(lst.sellerId)) return { ok: false, why: 'you cannot bid on your own stall' };

    var amt = Math.max(0, Math.round(Number(lumen) || 0));
    var o = {
      id: 'o' + Date.now().toString(36) + '_' + (hash(byId + '|' + listingId + '|' + amt) % 100000).toString(36),
      byId: byId,
      by: byAgent ? String(actor.name || 'an agent') : SELF,
      isAgent: byAgent,
      lumen: amt,
      note: String(note == null ? '' : note).trim().slice(0, 120),
      at: Date.now(), status: 'pending'
    };
    // one live offer per party per stall — a new one replaces the old, so a
    // haggler raising a bid does not litter the stall with stale rows.
    for (var i = lst.offers.length - 1; i >= 0; i--) {
      if (lst.offers[i].byId === byId && lst.offers[i].status === 'pending') lst.offers.splice(i, 1);
    }
    lst.offers.unshift(o);
    while (lst.offers.length > MAX_OFFERS) lst.offers.pop();
    save();
    if (isOpen()) render();
    updateLauncher();
    return { ok: true, offer: JSON.parse(JSON.stringify(o)) };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCEPT — the lister takes an offer, and the trade SETTLES through the Concord.
  //
  // This is the whole point of the file and the one place value moves. It is
  // NEUTRAL about who calls it: the UI only shows an Accept button on YOUR
  // stalls, and resolve() calls it for agent-owned stalls when your bid clears
  // the agent's reserve — but the settlement arithmetic is identical either way,
  // because a trade is a trade. Who is the seller decides the direction of the
  // treasury move:
  //   · you sold (your stall)         → the treasury is CREDITED the price.
  //   · you bought (an agent's stall) → the treasury SPENDS the price.
  // ATOMIC: the treasury move is attempted FIRST. If there is no polity to hold
  // a treasury, or the treasury cannot cover a purchase, NOTHING settles — the
  // offer stays pending, no karma moves, no history row. A refused offer settles
  // nothing.
  // ═══════════════════════════════════════════════════════════════════════════
  function accept(listingId, offerId) {
    if (!enabled()) return { ok: false, why: 'the market is closed' };
    var s = load();
    var lst = findListing(s, listingId);
    if (!lst) return { ok: false, why: 'that stall is gone' };
    if (lst.status !== 'open') return { ok: false, why: 'that stall has closed' };
    var o = findOffer(lst, offerId);
    if (!o || o.status !== 'pending') return { ok: false, why: 'that offer is gone' };

    var playerIsSeller = String(lst.sellerId) === SELF;
    var amt = Math.max(0, Math.round(Number(o.lumen) || 0));
    var c = concord();
    var kind = kindOf(lst.kind);

    // ── THE TREASURY MOVE, FIRST AND GUARDED ─────────────────────────────────
    if (amt > 0) {
      if (!c || !c.founded || !c.founded()) {
        return { ok: false, why: 'found a polity — the treasury cannot move without one' };
      }
      if (playerIsSeller) {
        // income to your coffers for what you sold
        if (!c.credit(amt, 'market: sold ' + lst.title)) {
          return { ok: false, why: 'the treasury would not take the payment' };
        }
      } else {
        // the cost of acquiring — refused rather than overdrawn
        if (!c.spend(amt, 'market: bought ' + lst.title)) {
          return { ok: false, why: 'the treasury will not cover that' };
        }
      }
    }

    // ── THE KARMA PRESS — the SAME seven-tag spine the government reads ───────
    // A completed, honest trade presses the kind's own axis and lifts trust.
    // The clamped arithmetic is the Concord's own (impress), so the market can
    // never move the spine in a way a motion could not.
    if (c && c.impress) {
      var press = {};
      press[lst.tag] = 1;
      if (lst.tag !== 'trust') press.trust = 0.5;
      try { c.impress(press, 0.25); } catch (_) {}
    }

    // ── THE STATUS FLIP + THE RECORD — only now, after value has moved ────────
    o.status = 'accepted';
    lst.status = 'settled';
    for (var i = 0; i < lst.offers.length; i++) {
      if (lst.offers[i].id !== o.id && lst.offers[i].status === 'pending') lst.offers[i].status = 'declined';
    }
    var buyerId = playerIsSeller ? String(o.byId) : SELF;
    var buyer = playerIsSeller ? String(o.by) : SELF;
    s.history.unshift({
      id: 'h' + Date.now().toString(36),
      listingId: lst.id, title: lst.title, kind: lst.kind,
      sellerId: String(lst.sellerId), seller: String(lst.seller),
      buyerId: buyerId, buyer: buyer,
      lumen: amt, tag: lst.tag, at: Date.now()
    });
    while (s.history.length > MAX_HISTORY) s.history.pop();
    save();
    if (isOpen()) render();
    updateLauncher();

    try {
      W.dispatchEvent(new (W.CustomEvent || CustomEvent)('vint:market-settled', {
        detail: { title: lst.title, lumen: amt, soldByYou: playerIsSeller, kind: kind.k }
      }));
    } catch (_) {}
    return { ok: true, sold: playerIsSeller, lumen: amt, buyer: buyer, seller: String(lst.seller) };
  }

  // ── DECLINE — the lister refuses an offer. Costs nothing to anyone. ────────
  function decline(listingId, offerId) {
    var s = load();
    var lst = findListing(s, listingId);
    if (!lst) return { ok: false, why: 'that stall is gone' };
    var o = findOffer(lst, offerId);
    if (!o || o.status !== 'pending') return { ok: false, why: 'that offer is gone' };
    o.status = 'declined';
    save();
    if (isOpen()) render();
    return { ok: true };
  }

  // ── WITHDRAW — pull your own stall. Generous: no penalty, ever. ────────────
  function withdraw(listingId) {
    var s = load();
    var lst = findListing(s, listingId);
    if (!lst) return { ok: false, why: 'that stall is gone' };
    if (String(lst.sellerId) !== SELF) return { ok: false, why: 'that is not your stall' };
    if (lst.status !== 'open') return { ok: false, why: 'that stall has closed' };
    lst.status = 'withdrawn';
    for (var i = 0; i < lst.offers.length; i++) if (lst.offers[i].status === 'pending') lst.offers[i].status = 'expired';
    save();
    if (isOpen()) render();
    updateLauncher();
    return { ok: true };
  }

  // keep the store bounded — freshest listings, and never an unbounded array on
  // someone's phone. Settled/withdrawn/lapsed stalls age out behind open ones.
  function trim(s) {
    if (s.listings.length <= MAX_LISTINGS) return;
    // stable sort: open first, then by recency, then drop the tail
    s.listings.sort(function (a, b) {
      var ao = a.status === 'open' ? 1 : 0, bo = b.status === 'open' ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return b.at - a.at;
    });
    s.listings.length = MAX_LISTINGS;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE MARKET MOVES WITHOUT YOU — the open loop, on the clock.
  //
  // Every AGENT_TICK of WALL CLOCK, resolved against elapsed time rather than
  // simulated on open, one of three things happens, chosen deterministically by
  // the tick so two tabs replaying the same gap agree exactly:
  //   1. an agent SEEDS a stall (so "the market" tab is never empty), or
  //   2. an agent BIDS on one of YOUR open stalls (the offers you come back to), or
  //   3. an agent-lister DECIDES on your best bid against its reserve, and if it
  //      clears, ACCEPTS — settling through the treasury, whether you are here or
  //      not (the trade you come back to find already done).
  // Bounded hard so a month away cannot spend a minute of CPU.
  // ═══════════════════════════════════════════════════════════════════════════
  function lastTouch(s) {
    var t = s.opened || 0;
    for (var i = 0; i < s.listings.length; i++) {
      if (s.listings[i].at > t) t = s.listings[i].at;
      for (var j = 0; j < s.listings[i].offers.length; j++) if (s.listings[i].offers[j].at > t) t = s.listings[i].offers[j].at;
    }
    if (s.history.length && s.history[0].at > t) t = s.history[0].at;
    return t;
  }

  // a small deterministic pool of things an agent might hang, keyed by axis so a
  // craft agent lists tools and a mentor agent lists creations. Not random.
  var SEED_TITLES = {
    craft:  ['a whetted adze', 'a coil of good wire', 'a true plumb-line', 'a spare drivecore'],
    civic:  ['a sack of clean ore', 'a cord of dry wood', 'a barrel of lamp-oil', 'a bolt of felt'],
    mentor: ['a folded star-chart', 'a song nobody else knows', 'a map of the quiet roads', 'a name for the fog']
  };

  function resolve() {
    if (!enabled() || isGuest()) return false;
    var s = load();
    if (!s.opened) return false;                 // the bazaar isn't open yet
    var agents = roster();
    if (!agents.length) return false;
    var now = Date.now();
    var last = lastTouch(s);
    var due = Math.floor((now - last) / AGENT_TICK);
    if (due < 1) { return expire(s, now); }
    due = Math.min(due, MAX_CATCHUP);

    var changed = false;
    for (var i = 0; i < due; i++) {
      var at = last + (i + 1) * AGENT_TICK;
      var tick = Math.floor(at / AGENT_TICK);
      var a = agents[hash('who|' + tick + '|' + wid()) % agents.length];
      var roll = hash('act|' + tick + '|' + wid()) % 3;

      if (roll === 0) {
        // SEED a stall, deterministically, from the agent's strongest kind lean.
        var kind = bestKindFor(a);
        var pool = SEED_TITLES[kind.axis] || SEED_TITLES.craft;
        var title = pool[hash('title|' + tick + '|' + (a.id || a.name)) % pool.length];
        var ask = 8 + (hash('ask|' + tick + '|' + (a.id || a.name)) % 44);   // 8..51
        // don't seed a duplicate open stall for the same agent+title
        if (!hasOpenStall(s, a, title)) {
          list({ title: title, kind: kind.k, desc: '', ask: ask, tag: kind.axis },
               { id: a.id, name: a.name, isAgent: true });
          changed = true;
          _reload(s);
        }
      } else if (roll === 1) {
        // BID on one of YOUR open stalls, if any, from this agent's valuation.
        var mine = openStallsBy(s, SELF);
        if (mine.length) {
          var lst = mine[hash('pick|' + tick + '|' + (a.id || a.name)) % mine.length];
          if (!hasPendingFrom(lst, a.id)) {
            var bid = agentBid(a, lst);
            offer(lst.id, bid, '', { id: a.id, name: a.name, isAgent: true });
            changed = true;
            _reload(s);
          }
        }
      } else {
        // an agent-lister DECIDES on your best pending bid against its reserve.
        var theirs = openStallsBy(s, null, true);   // agent-owned open stalls
        for (var t2 = 0; t2 < theirs.length; t2++) {
          var L = theirs[t2];
          var best = bestPending(L, SELF);
          if (!best) continue;
          var ag = agentById(L.sellerId) || a;
          var reserve = agentReserve(ag, L);
          if (best.lumen >= reserve) {
            var r = accept(L.id, best.id);   // settles through the treasury
            if (r.ok) { changed = true; _reload(s); }
            break;
          }
        }
      }
    }
    if (expire(s, now)) changed = true;
    return changed;
  }

  // drop the memo so the next load() re-reads what resolve()'s sub-verbs wrote
  function _reload(s) { _st = null; _stKey = null; load(); }

  function bestKindFor(agent) {
    var best = KINDS[0], bv = -9;
    for (var i = 0; i < KINDS.length; i++) {
      var e = edgeOf(agent, KINDS[i]);
      if (e > bv) { bv = e; best = KINDS[i]; }
    }
    return best;
  }
  function agentBid(agent, lst) {
    var e = edgeOf(agent, kindOf(lst.kind));           // -1..1
    var base = Math.max(1, lst.ask || 10);
    return Math.max(1, Math.round(base * (0.7 + e * 0.4)));   // ~0.3x..1.1x of ask
  }
  function agentReserve(agent, lst) {
    var e = edgeOf(agent, kindOf(lst.kind));
    // an agent that values selling (high edge on this kind) will let it go for
    // less; a cool one holds out above ask.
    return Math.max(1, Math.round((lst.ask || 10) * (1 - e * 0.2)));
  }
  function hasOpenStall(s, agent, title) {
    for (var i = 0; i < s.listings.length; i++) {
      var L = s.listings[i];
      if (L.status === 'open' && String(L.sellerId) === String(agent.id) && L.title === title) return true;
    }
    return false;
  }
  function openStallsBy(s, sellerId, agentsOnly) {
    var out = [];
    for (var i = 0; i < s.listings.length; i++) {
      var L = s.listings[i];
      if (L.status !== 'open') continue;
      if (agentsOnly) { if (L.isAgentSeller) out.push(L); }
      else if (String(L.sellerId) === String(sellerId)) out.push(L);
    }
    return out;
  }
  function hasPendingFrom(lst, byId) {
    for (var i = 0; i < lst.offers.length; i++) if (String(lst.offers[i].byId) === String(byId) && lst.offers[i].status === 'pending') return true;
    return false;
  }
  function bestPending(lst, byId) {
    var best = null;
    for (var i = 0; i < lst.offers.length; i++) {
      var o = lst.offers[i];
      if (o.status !== 'pending') continue;
      if (byId != null && String(o.byId) !== String(byId)) continue;
      if (!best || o.lumen > best.lumen) best = o;
    }
    return best;
  }
  // age out stale stalls and offers so nothing lingers as a lie. Returns whether
  // anything changed.
  function expire(s, now) {
    var changed = false;
    for (var i = 0; i < s.listings.length; i++) {
      var L = s.listings[i];
      if (L.status === 'open' && (now - L.at) > LISTING_TTL) {
        L.status = 'lapsed';
        for (var k = 0; k < L.offers.length; k++) if (L.offers[k].status === 'pending') L.offers[k].status = 'expired';
        changed = true;
        continue;
      }
      for (var j = 0; j < L.offers.length; j++) {
        var o = L.offers[j];
        if (o.status === 'pending' && (now - o.at) > OFFER_TTL) { o.status = 'expired'; changed = true; }
      }
    }
    if (changed) save();
    return changed;
  }

  // unread settlements + fresh offers on your stalls since you last looked.
  function unread() {
    var s = load(), n = 0, seen = s.seen || 0;
    for (var i = 0; i < s.history.length; i++) { if (s.history[i].at > seen) n++; else break; }
    for (var j = 0; j < s.listings.length; j++) {
      var L = s.listings[j];
      if (String(L.sellerId) !== SELF || L.status !== 'open') continue;
      for (var q = 0; q < L.offers.length; q++) { if (L.offers[q].status === 'pending' && L.offers[q].at > seen) n++; }
    }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HEADLESS BOUNDARY — everything above is MODEL. A browserless require()
  // stops here and gets the model half through module.exports.
  // ═══════════════════════════════════════════════════════════════════════════
  function buildAPI() {
    return {
      open: open, close: close, isOpen: isOpen, enabled: enabled,
      render: render, refresh: updateLauncher,
      // model surface — exported for the proof and for future organs
      state: function () { return JSON.parse(JSON.stringify(load())); },
      reload: function () { _st = null; _stKey = null; return load(); },
      list: list, offer: offer, accept: accept, decline: decline, withdraw: withdraw,
      resolve: resolve,
      listings: function () { return JSON.parse(JSON.stringify(load().listings)); },
      history: function () { return JSON.parse(JSON.stringify(load().history)); },
      unread: unread,
      disposition: dispositionOf,
      edge: edgeOf,
      KINDS: KINDS, SELF: SELF, TAGS: TAGS
    };
  }

  if (!HAS_DOM) {
    var headless = buildAPI();
    headless.open = function () {}; headless.close = function () {};
    headless.isOpen = function () { return false; };
    headless.render = function () {}; headless.refresh = function () {};
    W.VintMarket = headless;
    return headless;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #mkSheet. Nothing leaks into the world.
  // The sheet scaffold (.dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x)
  // is inherited from dirverse-hud's stylesheet, not redefined, so this surface
  // can never disagree with its siblings about how tall a bottom sheet may be,
  // and layoutRail's `.dv-sheet.open` yield picks it up with nothing to remember.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (DOC.getElementById('mk-styles')) return;
    var s = DOC.createElement('style');
    s.id = 'mk-styles';
    s.textContent = [
      '#mkSheet .mk-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(255,214,150,0.5);margin:16px 0 9px;}',
      '#mkSheet .mk-sec:first-child{margin-top:2px;}',
      '#mkSheet .mk-note{font-size:12.5px;line-height:1.5;color:rgba(224,214,255,0.5);',
      ' font-style:italic;margin-top:10px;overflow-wrap:anywhere;}',

      // ── tabs (three, equal cells, never wrap onto each other) ───────────────
      '#mkSheet .mk-tabs{display:flex;gap:7px;margin-bottom:4px;}',
      '#mkSheet .mk-tab{flex:1 1 0;min-width:0;min-height:40px;border-radius:12px;cursor:pointer;',
      ' font-family:inherit;font-size:12.5px;color:rgba(224,214,255,0.7);box-sizing:border-box;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);padding:0 6px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mkSheet .mk-tab.on{background:rgba(255,214,150,0.09);border-color:rgba(255,214,150,0.42);color:#ffd691;}',
      '#mkSheet .mk-tab:active{transform:scale(0.985);}',

      // ── the compose block — hang a stall ────────────────────────────────────
      '#mkSheet .mk-compose{padding:12px 13px;border-radius:14px;box-sizing:border-box;',
      ' background:rgba(255,214,150,0.05);border:1px solid rgba(255,214,150,0.2);}',
      '#mkSheet .mk-in{width:100%;box-sizing:border-box;min-height:44px;border-radius:11px;',
      ' background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.12);color:#f3e6ff;',
      ' font-family:inherit;font-size:15px;padding:0 12px;margin-top:8px;}',
      '#mkSheet textarea.mk-in{min-height:56px;padding:9px 12px;resize:none;line-height:1.4;}',
      '#mkSheet .mk-in:focus{border-color:rgba(255,214,150,0.45);outline:none;}',
      '#mkSheet .mk-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '#mkSheet .mk-chip{min-height:34px;padding:0 12px;border-radius:10px;cursor:pointer;',
      ' font-family:inherit;font-size:12.5px;color:rgba(224,214,255,0.72);box-sizing:border-box;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);',
      ' display:inline-flex;align-items:center;gap:6px;}',
      '#mkSheet .mk-chip.on{background:rgba(255,214,150,0.1);border-color:rgba(255,214,150,0.42);color:#ffd691;}',
      '#mkSheet .mk-chip:active{transform:scale(0.97);}',
      '#mkSheet .mk-lbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;',
      ' color:rgba(224,214,255,0.4);margin-top:11px;}',
      '#mkSheet .mk-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;margin-top:12px;',
      ' font-size:15.5px;cursor:pointer;color:#1a1206;background:#ffd691;border:none;box-sizing:border-box;}',
      '#mkSheet .mk-go:active{transform:scale(0.985);}',
      '#mkSheet .mk-go:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',

      // ── a listing card — its own box, content clips inside it ───────────────
      '#mkSheet .mk-list{display:flex;flex-direction:column;gap:9px;}',
      '#mkSheet .mk-card{padding:12px 13px;border-radius:14px;box-sizing:border-box;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);',
      ' border-left:3px solid var(--kc,#9fdcff);}',
      '#mkSheet .mk-card.sel{background:rgba(255,214,150,0.06);border-color:rgba(255,214,150,0.34);}',
      '#mkSheet .mk-ch{display:flex;align-items:flex-start;gap:11px;cursor:pointer;}',
      '#mkSheet .mk-cg{flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:flex;',
      ' align-items:center;justify-content:center;font-size:16px;color:var(--kc,#9fdcff);',
      ' background:rgba(255,255,255,0.06);}',
      '#mkSheet .mk-ct{flex:1 1 auto;min-width:0;}',
      '#mkSheet .mk-cn{font-size:15px;color:#f3e6ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mkSheet .mk-cs{font-size:11.5px;color:rgba(224,214,255,0.55);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mkSheet .mk-cd{font-size:12.5px;line-height:1.5;color:rgba(224,214,255,0.7);margin-top:6px;',
      ' overflow-wrap:anywhere;}',
      '#mkSheet .mk-ask{flex:0 0 auto;text-align:right;font-size:13px;color:#ffd691;',
      ' font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '#mkSheet .mk-tagpill{display:inline-block;margin-top:6px;font-size:10.5px;letter-spacing:.05em;',
      ' text-transform:uppercase;color:rgba(159,220,255,0.7);}',

      // ── the offer control (under a selected market stall) ───────────────────
      '#mkSheet .mk-offer{margin-top:11px;padding:11px 12px;border-radius:12px;box-sizing:border-box;',
      ' background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);}',
      '#mkSheet .mk-orow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}',
      '#mkSheet .mk-ow{flex:1 1 90px;min-width:80px;box-sizing:border-box;min-height:44px;border-radius:11px;',
      ' background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);color:#f3e6ff;',
      ' font-family:inherit;font-size:15px;padding:0 12px;}',
      '#mkSheet .mk-ow:focus{border-color:rgba(255,214,150,0.45);outline:none;}',
      '#mkSheet .mk-owl{flex:0 0 auto;font-size:12.5px;color:rgba(224,214,255,0.6);}',

      // ── offer rows on your own stalls (with accept / decline) ───────────────
      '#mkSheet .mk-offers{display:flex;flex-direction:column;gap:6px;margin-top:9px;}',
      '#mkSheet .mk-orw{display:flex;align-items:center;gap:9px;min-height:44px;padding:7px 10px;',
      ' border-radius:11px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);}',
      '#mkSheet .mk-orn{flex:1 1 auto;min-width:0;font-size:13px;color:#f3e6ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mkSheet .mk-orv{flex:0 0 auto;font-size:13px;color:#ffd691;font-variant-numeric:tabular-nums;}',
      '#mkSheet .mk-ax{flex:0 0 auto;min-height:36px;min-width:36px;padding:0 12px;border-radius:10px;',
      ' font-family:inherit;font-size:12.5px;cursor:pointer;color:#1a1206;background:#9affbe;border:none;}',
      '#mkSheet .mk-dx{flex:0 0 auto;min-height:36px;min-width:36px;padding:0 11px;border-radius:10px;',
      ' font-family:inherit;font-size:12.5px;cursor:pointer;color:rgba(255,150,150,0.8);',
      ' background:rgba(255,120,100,0.07);border:1px solid rgba(255,140,120,0.24);}',
      '#mkSheet .mk-wd{width:100%;min-height:40px;border-radius:11px;font-family:inherit;margin-top:9px;',
      ' font-size:12.5px;cursor:pointer;box-sizing:border-box;color:rgba(224,214,255,0.6);',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);}',

      // ── settled history rows ────────────────────────────────────────────────
      '#mkSheet .mk-hist{display:flex;flex-direction:column;gap:7px;}',
      '#mkSheet .mk-h{display:flex;align-items:center;gap:10px;min-height:40px;padding:8px 11px;',
      ' border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);}',
      '#mkSheet .mk-hg{flex:0 0 auto;width:22px;text-align:center;font-size:13px;}',
      '#mkSheet .mk-hn{flex:1 1 auto;min-width:0;font-size:13px;color:#f3e6ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#mkSheet .mk-hv{flex:0 0 auto;font-size:13px;color:#ffd691;font-variant-numeric:tabular-nums;}',
      '#mkSheet .mk-ha{flex:0 0 auto;font-size:11px;color:rgba(224,214,255,0.4);',
      ' font-variant-numeric:tabular-nums;}',

      '#mkSheet .mk-empty{font-size:13px;line-height:1.55;color:rgba(224,214,255,0.5);',
      ' font-style:italic;padding:14px 2px;overflow-wrap:anywhere;}',
      '#mkSheet .mk-warn{padding:10px 12px;border-radius:12px;margin-top:10px;font-size:12px;',
      ' line-height:1.5;color:rgba(255,226,160,0.78);background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.2);overflow-wrap:anywhere;}',
      '#mkSheet .mk-kill{width:100%;min-height:46px;border-radius:13px;font-family:inherit;margin-top:14px;',
      ' font-size:13.5px;cursor:pointer;box-sizing:border-box;color:rgba(255,170,150,0.8);',
      ' background:rgba(255,120,100,0.07);border:1px solid rgba(255,140,120,0.24);}',

      // ── very short viewports: tighten, never overlap ────────────────────────
      '@media(max-height:520px){#mkSheet .mk-sec{margin:11px 0 6px;}',
      ' #mkSheet .mk-compose{padding:10px 11px;}}'
    ].join('');
    DOC.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _body = null, _beat = null;
  var _tab = 'market';          // 'market' | 'stalls' | 'settled'
  var _sel = null;              // selected market listing id (for the offer control)
  var _compose = { title: '', kind: 'tool', desc: '', ask: '', tag: null, open: false };

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = DOC.createElement('div');
    el.className = 'dv-sheet'; el.id = 'mkSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the market<small id="mkSub">trade, combine tools</small></div>' +
        '<button class="dv-x" id="mkX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="mkBody"></div>';
    DOC.body.appendChild(el);
    _sheet = el; _body = el.querySelector('#mkBody');
    el.querySelector('#mkX').onclick = close;
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
  function pendingCount(lst) { var n = 0; for (var i = 0; i < lst.offers.length; i++) if (lst.offers[i].status === 'pending') n++; return n; }
  function foundedTreasury() {
    var c = concord();
    try { if (c && c.founded && c.founded() && c.state) return c.state().treasury || 0; } catch (_) {}
    return null;
  }

  function render() {
    if (!_body) return;
    var s = load();
    _body.textContent = '';

    // tabs
    var tabs = el('div', 'mk-tabs');
    [['market', 'the market'], ['stalls', 'my stalls'], ['settled', 'settled']].forEach(function (t) {
      var b = el('button', 'mk-tab' + (_tab === t[0] ? ' on' : ''), t[1]);
      b.type = 'button';
      b.onclick = function () { _tab = t[0]; _sel = null; render(); };
      tabs.appendChild(b);
    });
    _body.appendChild(tabs);

    if (_tab === 'market') renderMarket(s);
    else if (_tab === 'stalls') renderStalls(s);
    else renderSettled(s);

    // the honest line — this bazaar is local
    _body.appendChild(el('div', 'mk-note',
      'this bazaar is held in your own hands — the world does not yet keep it. ' +
      'a trade settles through your concord\'s one treasury, and nothing else.'));

    if (s.opened) {
      var kill = el('button', 'mk-kill', 'close the market');
      kill.type = 'button';
      kill.onclick = function () {
        var st = load();
        st.opened = 0; st.listings = []; st.history = [];
        save(); _sel = null; _tab = 'market';
        toast('the market is dark. nothing you owned is gone.');
        render(); updateLauncher();
      };
      _body.appendChild(kill);
    }

    // mark read + subtitle
    var st2 = load(); st2.seen = Date.now(); save();
    var sub = _sheet && _sheet.querySelector('#mkSub');
    if (sub) {
      var openN = openStallsBy(s, null, true).length + openStallsBy(s, SELF).length;
      sub.textContent = openN ? (openN + (openN === 1 ? ' stall stands' : ' stalls stand')) : 'trade, combine tools';
    }
  }

  // ── TAB 1 · THE MARKET — open stalls you can bid on (agent-owned + others) ──
  function renderMarket(s) {
    _body.appendChild(el('div', 'mk-sec', 'open stalls'));
    var open = [];
    for (var i = 0; i < s.listings.length; i++) {
      var L = s.listings[i];
      if (L.status === 'open' && String(L.sellerId) !== SELF) open.push(L);
    }
    if (!open.length) {
      _body.appendChild(el('div', 'mk-empty', roster().length
        ? 'no stall is open yet. your court hangs one about every quarter-hour — come back and bid.'
        : 'your court is empty. bring an agent in through the court, and it will start trading here.'));
      return;
    }
    var list = el('div', 'mk-list');
    for (var j = 0; j < open.length; j++) {
      (function (L) {
        var kind = kindOf(L.kind);
        var card = el('div', 'mk-card' + (_sel === L.id ? ' sel' : ''));
        card.style.setProperty('--kc', kind.c);
        var head = el('div', 'mk-ch');
        var g = el('span', 'mk-cg', kind.g);
        head.appendChild(g);
        var ct = el('div', 'mk-ct');
        ct.appendChild(el('div', 'mk-cn', L.title));
        ct.appendChild(el('div', 'mk-cs', kind.n + ' · ' + L.seller));
        head.appendChild(ct);
        head.appendChild(el('div', 'mk-ask', L.ask > 0 ? ('asks ◇' + L.ask) : 'asks a fair offer'));
        head.onclick = function () { _sel = (_sel === L.id ? null : L.id); render(); };
        card.appendChild(head);
        if (L.desc) card.appendChild(el('div', 'mk-cd', L.desc));
        card.appendChild(el('div', 'mk-tagpill', 'presses ' + (TAG_WORD[L.tag] || L.tag)));

        if (_sel === L.id) {
          var box = el('div', 'mk-offer');
          var row = el('div', 'mk-orow');
          row.appendChild(el('span', 'mk-owl', 'your offer'));
          var w = DOC.createElement('input');
          w.className = 'mk-ow'; w.type = 'number'; w.min = '0'; w.step = '1';
          w.value = String(L.ask || 0);
          w.setAttribute('inputmode', 'numeric');
          w.setAttribute('aria-label', 'lumen to offer for ' + L.title);
          row.appendChild(w);
          box.appendChild(row);
          var mine = bestPending(L, SELF);
          if (mine) box.appendChild(el('div', 'mk-cs', 'you have offered ◇' + mine.lumen + ' — your treasurer is deciding.'));
          var go = el('button', 'mk-go', 'lay this offer');
          go.type = 'button';
          go.onclick = function () {
            var r = offer(L.id, w.value, '');
            if (!r.ok) { toast(r.why); return; }
            toast('you offered ◇' + r.offer.lumen + ' on ' + L.title + '. ' + L.seller + ' will decide.');
            render();
          };
          box.appendChild(go);
          card.appendChild(box);
        }
        list.appendChild(card);
      })(open[j]);
    }
    _body.appendChild(list);
  }

  // ── TAB 2 · MY STALLS — compose + your listings + incoming offers ──────────
  function renderStalls(s) {
    // compose
    _body.appendChild(el('div', 'mk-sec', 'hang a stall'));
    var comp = el('div', 'mk-compose');
    var ti = DOC.createElement('input');
    ti.className = 'mk-in'; ti.type = 'text'; ti.maxLength = 60;
    ti.placeholder = 'what are you offering?';
    ti.value = _compose.title;
    ti.setAttribute('aria-label', 'the name of your stall');
    ti.oninput = function () { _compose.title = ti.value; };
    comp.appendChild(ti);

    comp.appendChild(el('div', 'mk-lbl', 'what kind'));
    var kchips = el('div', 'mk-chips');
    KINDS.forEach(function (kd) {
      var chip = el('button', 'mk-chip' + (_compose.kind === kd.k ? ' on' : ''));
      chip.type = 'button';
      chip.appendChild(el('span', null, kd.g));
      chip.appendChild(el('span', null, kd.n));
      chip.onclick = function () {
        _compose.kind = kd.k;
        if (!_compose.tag) { /* default tag tracks kind axis until user picks */ }
        renderStallsRefresh();
      };
      kchips.appendChild(chip);
    });
    comp.appendChild(kchips);

    var de = DOC.createElement('textarea');
    de.className = 'mk-in'; de.maxLength = 160; de.rows = 2;
    de.placeholder = 'a line about it (optional)';
    de.value = _compose.desc;
    de.setAttribute('aria-label', 'a description of your stall');
    de.oninput = function () { _compose.desc = de.value; };
    comp.appendChild(de);

    var ak = DOC.createElement('input');
    ak.className = 'mk-in'; ak.type = 'number'; ak.min = '0'; ak.step = '1';
    ak.placeholder = 'your ask in lumen (0 = open to offers)';
    ak.value = _compose.ask;
    ak.setAttribute('inputmode', 'numeric');
    ak.setAttribute('aria-label', 'your ask in lumen');
    ak.oninput = function () { _compose.ask = ak.value; };
    comp.appendChild(ak);

    comp.appendChild(el('div', 'mk-lbl', 'the trade presses'));
    var tchips = el('div', 'mk-chips');
    var defTag = _compose.tag || kindOf(_compose.kind).axis;
    TAGS().forEach(function (tg) {
      var chip = el('button', 'mk-chip' + (defTag === tg ? ' on' : ''), TAG_WORD[tg] || tg);
      chip.type = 'button';
      chip.onclick = function () { _compose.tag = tg; renderStallsRefresh(); };
      tchips.appendChild(chip);
    });
    comp.appendChild(tchips);

    var go = el('button', 'mk-go', 'hang it on the market');
    go.type = 'button';
    go.onclick = function () {
      var r = list({ title: _compose.title, kind: _compose.kind, desc: _compose.desc, ask: _compose.ask, tag: _compose.tag });
      if (!r.ok) { toast(r.why); return; }
      toast('“' + r.listing.title + '” is on the market.');
      _compose = { title: '', kind: 'tool', desc: '', ask: '', tag: null, open: false };
      _tab = 'stalls';
      render();
    };
    comp.appendChild(go);
    _body.appendChild(comp);

    // the treasury reality — you cannot settle without a polity to hold one
    if (foundedTreasury() === null) {
      _body.appendChild(el('div', 'mk-warn',
        'you have no polity yet, so a sale cannot pay out. found a concord first — ' +
        'the treasury is where a trade settles.'));
    }

    // my open stalls + their offers
    _body.appendChild(el('div', 'mk-sec', 'your stalls'));
    var mine = [];
    for (var i = 0; i < s.listings.length; i++) if (String(s.listings[i].sellerId) === SELF && s.listings[i].status === 'open') mine.push(s.listings[i]);
    if (!mine.length) {
      _body.appendChild(el('div', 'mk-empty', 'nothing of yours is on the market. hang a stall above and your court will start bidding.'));
      return;
    }
    var wrap = el('div', 'mk-list');
    for (var j = 0; j < mine.length; j++) {
      (function (L) {
        var kind = kindOf(L.kind);
        var card = el('div', 'mk-card');
        card.style.setProperty('--kc', kind.c);
        var head = el('div', 'mk-ch');
        head.style.cursor = 'default';
        head.appendChild(el('span', 'mk-cg', kind.g));
        var ct = el('div', 'mk-ct');
        ct.appendChild(el('div', 'mk-cn', L.title));
        var pc = pendingCount(L);
        ct.appendChild(el('div', 'mk-cs', kind.n + ' · ' + (pc ? (pc + (pc === 1 ? ' offer' : ' offers')) : 'no offers yet')));
        head.appendChild(ct);
        head.appendChild(el('div', 'mk-ask', L.ask > 0 ? ('asked ◇' + L.ask) : 'open to offers'));
        card.appendChild(head);
        if (L.desc) card.appendChild(el('div', 'mk-cd', L.desc));

        var offers = el('div', 'mk-offers');
        var any = false;
        for (var q = 0; q < L.offers.length; q++) {
          var o = L.offers[q];
          if (o.status !== 'pending') continue;
          any = true;
          (function (o) {
            var orw = el('div', 'mk-orw');
            orw.appendChild(el('span', 'mk-orn', o.by + (o.note ? (' · ' + o.note) : '')));
            orw.appendChild(el('span', 'mk-orv', '◇' + o.lumen));
            var ax = el('button', 'mk-ax', 'accept');
            ax.type = 'button';
            ax.onclick = function () {
              var r = accept(L.id, o.id);
              if (!r.ok) { toast(r.why); return; }
              toast('sold “' + L.title + '” to ' + o.by + ' for ◇' + r.lumen + '. the treasury takes it.');
              render();
            };
            orw.appendChild(ax);
            var dx = el('button', 'mk-dx', 'no');
            dx.type = 'button';
            dx.onclick = function () { decline(L.id, o.id); render(); };
            orw.appendChild(dx);
            offers.appendChild(orw);
          })(o);
        }
        if (any) card.appendChild(offers);

        var wd = el('button', 'mk-wd', 'withdraw this stall');
        wd.type = 'button';
        wd.onclick = function () { withdraw(L.id); toast('you pulled “' + L.title + '” from the market.'); render(); };
        card.appendChild(wd);
        wrap.appendChild(card);
      })(mine[j]);
    }
    _body.appendChild(wrap);
  }
  // a light refresh that preserves scroll intent for chip toggles
  function renderStallsRefresh() { render(); }

  // ── TAB 3 · SETTLED — the record of trades that closed ─────────────────────
  function renderSettled(s) {
    _body.appendChild(el('div', 'mk-sec', 'settled trades'));
    if (!s.history.length) {
      _body.appendChild(el('div', 'mk-empty', 'nothing has changed hands yet. a settled trade is remembered here — who, what, and for how much.'));
      return;
    }
    var hist = el('div', 'mk-hist');
    for (var i = 0; i < Math.min(MAX_HISTORY, s.history.length); i++) {
      var h = s.history[i];
      var kind = kindOf(h.kind);
      var row = el('div', 'mk-h');
      var g = el('span', 'mk-hg', kind.g); g.style.color = kind.c;
      row.appendChild(g);
      var soldByYou = String(h.sellerId) === SELF;
      var line = soldByYou
        ? (h.buyer + ' bought “' + h.title + '”')
        : ('you bought “' + h.title + '” from ' + h.seller);
      row.appendChild(el('span', 'mk-hn', line));
      row.appendChild(el('span', 'mk-hv', (soldByYou ? '+◇' : '−◇') + h.lumen));
      row.appendChild(el('span', 'mk-ha', ago(h.at)));
      hist.appendChild(row);
    }
    _body.appendChild(hist);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN / CLOSE — through the shared registry, always.
  // ═══════════════════════════════════════════════════════════════════════════
  function open() {
    if (!enabled()) return;
    var s = load();
    if (!s.opened) { s.opened = Date.now(); save(); }
    resolve();
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('market', function () { build(); _sheet.classList.add('open'); render(); });
    } else { build(); _sheet.classList.add('open'); render(); }
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
  // Visible from every state (a bazaar is a public place, like the arcade hall),
  // so it is reachable from a cold load. Guests may browse; listing, offering and
  // accepting refuse with a reason until they sign in.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('mkBtn', 'market', '⇄', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the market — trade with your court');
      _btn.setAttribute('title', 'the market — trade with your court');
      if (!_btn.querySelector('.mk-n')) {
        var pill = DOC.createElement('span');
        pill.className = 'mk-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(255,214,145,0.9);color:#1a1006;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('market', isOpen, close); } catch (_) {}
    updateLauncher();
  }
  function updateLauncher() {
    if (!_btn) return;
    _btn.style.display = 'flex';
    var pill = _btn.querySelector('.mk-n');
    if (pill) {
      var n = isGuest() ? 0 : unread();
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = n > 0 ? 'block' : 'none';
    }
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  // ── the world moved ──────────────────────────────────────────────────────
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  W.addEventListener('vint:world-state', function () { if (isOpen()) render(); updateLauncher(); });
  W.addEventListener('vint:world-travel', function () {
    if (isOpen()) close();
    _st = null; _stKey = null; _sel = null; _tab = 'market';   // re-read against the new world key
    setTimeout(updateLauncher, 1200);
  });

  // THE BACKGROUND BEAT. Offers and settlements land with the sheet closed —
  // that is the whole promise ("they trade with or without you"). One minute is
  // plenty (an agent acts every ~17) and it costs nothing measurable.
  setInterval(function () {
    if (!enabled() || isGuest()) return;
    if (resolve()) updateLauncher();
  }, 60000);

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintMarket = buildAPI();
  return W.VintMarket;
});
