// ═══════════════════════════════════════════════════════════════════════════
// THE PULSE — the world's own account of itself, in sentences (task FVBRSP7)
//
// VINTA'S COMPLAINT, VERBATIM: "no information about what the agents are
// building". This file is that answer.
//
// MEASURED 2026-11-18 against api.vintaclectic.com:
//   GET /api/world/state?since=0            -> 200, 78,385B, economy tick 17371,
//     {events:{events:[100 newest-first], events_total:200290, by_type:{49 types}}}
//   `grep -rln "api/world/state"` over this whole repo -> ZERO files.
// So the world's append-only change log — every claim, craft, gather, trade,
// war, birth and theft, 200,290 rows of it — was served, bounded, documented in
// WORLD_SPEC §3, and NOTHING IN THE BROWSER RENDERED ONE LINE OF IT. The world
// was doing things and the page could not say what. Exactly the AC2WP9A shape
// one layer out: that card put the PEOPLE on the map, this one puts their DEEDS
// on the page.
//
// ── WHY A SECOND PHRASE BOOK, DELIBERATELY ─────────────────────────────────
// world-timeline.phraseFor() already turns an event into a sentence server-side
// by composing a one-event day and taking the gazette line that falls out, and
// reusing it would be the HAAXZR2 move. It cannot serve this surface, and that
// is a MEASURED fact, not a preference:
//   · The gazette is an allowlist of BEATS (world-timeline.BEATS). Of the 49
//     types the live world emits, 26 are classified NOISE there ON PURPOSE —
//     and that set is, precisely, "what the agents are doing": citizen_action
//     (125,592 rows), agent_gathered, agent_crafted, agent_moved, agent_rested,
//     order_posted, uw:searched, uw:mail. phraseFor returns null for every one
//     of them (it FAILS CLOSED since 3WCDCFV, correctly — a daily paper should
//     not print 125,592 turn lines).
//   · A daily newspaper and a live chronicle are different surfaces with
//     different budgets. The gazette compresses a day to a headline; the pulse
//     reports a tick as it happens.
// So this is a phrase book for the SAME taxonomy over a WIDER set, and the two
// are kept honest against each other by convention rather than by code:
//   · `prettyId` mirrors gazette._prettyId exactly (strip `citizen_`, `@mint` ->
//     "the mint", capitalise) so the two surfaces print the same name for the
//     same person.
//   · `scrub` mirrors gazette.scrubText exactly (control chars, < > " ' folded
//     to look-alikes) because an agent-authored string — a war `cause`, an org
//     `charter`, a mail `subject`, a `uw:incident` target — reaches this list
//     and must never be able to carry a tag. Rows are built with textContent
//     as well, so the scrub is the second of two defences, not the only one.
//   · MIRRORS is gazette._SKIP_MIRRORS, name for name. The world records several
//     acts twice, once per party (war_declared + war_declared_by, theft +
//     theft_suffered, agent_born + child_born). Printing both is printing the
//     same thing twice.
// If the gazette ever grows a column for the work types, delete this book and
// read sentences off the wire; until then a surface with no sentences is worse
// than a second phrase book that says so out loud.
//
// ── EVERY TYPE IS CLASSIFIED, AND AN UNKNOWN ONE IS LOUD ───────────────────
// DHTXG92/5GZUXUZ: a taxonomy that silently drops what it does not recognise is
// a feature that goes dark the day the world grows a verb. Here every type the
// live world emits (measured: 49, `SELECT type, COUNT(*) FROM events GROUP BY
// type`) is in exactly ONE of PHRASE / MIRRORS, the page's own verifier asserts
// that, and a type in neither still RENDERS — as its own readable fallback
// ("Sol: order_filled") — and is counted into `unphrased()`, which the sheet's
// footer prints by name. A verb nobody phrased is visible to the watcher and to
// the next agent, never swallowed.
//
// ── POLLING: `since` IS EXCLUSIVE, SO RE-ASK THE BOUNDARY TICK ─────────────
// world-state.js answers `tick > since` strictly and hands back `next_since` =
// the current tick. A poller that stores next_since verbatim loses every event
// its own tick emits AFTER the poll — and the economy clock advances in a
// 60-second burst, so that is most of them. This asks for `next_since - 1` and
// DEDUPES BY EVENT ID, so the boundary tick is re-read every pass and nothing
// is ever lost or doubled. One tick of re-read is the price of not skipping
// history (events are ~10 per tick live: 177k rows over 17.4k ticks).
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
//   · The LAUNCHER is a flow child of #dvRail via DirverseHUD.addLauncher — the
//     rail is the one collision-proof home for a launcher on this page (it owns
//     its own max-height, overflow-y:auto, and the compact/tight/wrap squeeze),
//     exactly as world-skeleton.js does. This file never creates a fixed
//     element of its own.
//   · The SHEET is a .dv-sheet raised through DirverseHUD.openSheet, which is
//     EXCLUSIVE: opening it closes every other sheet, so it can never overlay
//     one. Its .dv-body is `flex:1 1 auto; min-height:0; overflow-y:auto`, so
//     the feed scrolls INSIDE its own box by construction.
//   · The FILTER CHIPS are a flow-wrapping row, capped with max-height +
//     overflow-y:auto (MU6GKNH: overflow is the load-bearing half of freeing a
//     flex child — CSS Flexbox §4.5 drops a flex item's automatic content
//     minimum only while its main-axis overflow is not `visible`), so a sixth
//     chip grows the band INWARD instead of evicting the feed below it. On a
//     SHORT viewport the band also compresses to one row and the BODY carries
//     the zero flex basis, because flex distributes shrink by BASIS and a feed
//     holding thousands of pixels of lines out-weighs every neighbour — see the
//     measured numbers beside those rules.
//   · The DOCKED ACCOUNT PILL is the one float on this page that outranks every
//     sheet (z-index 2147483600, by design). It is not fought with z-index: the
//     sheet declares itself an OBSTACLE to body/corner_dock.js on open and
//     releases both corners on close, so the dock lifts its pills clear. That
//     is the same mechanism world.html uses for #invite and reckoning-hud.js
//     uses for its own sheet; measured before it, the pill put a 97x44 tappable
//     control on this sheet at 375x667 and 393x852 and took the hit-test for
//     the CLOSE button.
//   · Every row is a FLOW child with its own box and wrapping text, so two
//     sentences can never occupy the same pixels however long they are.
//
// SERVER-AUTHORITATIVE. Computes no world state, writes nothing, reads one
// bounded endpoint. An unreachable brain keeps the last good rows (a stale-but-
// true chronicle beats a blank one) and says so in the footer.
//
// FLAG: 'world_pulse'. ?pulse=0 hard-kills it with no deploy.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  // ── WHERE THE BRAIN IS ────────────────────────────────────────────────────
  // body/api_base.js is loaded by world.html before this file and is the single
  // source of truth (3WCDCFV: reading an unset global sent every world read to
  // the PAGE's origin, which on GitHub Pages is a 404 and a dead feature).
  function base() {
    try {
      return (W.__VINTINUUM_API_BASE || W.VINT_API_BASE ||
              'https://api.vintaclectic.com').replace(/\/$/, '');
    } catch (_) { return 'https://api.vintaclectic.com'; }
  }
  function token() {
    try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); }
    catch (_) { return null; }
  }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }
  function hud() { return W.DirverseHUD; }
  function folk() { return W.VintWorldFolk; }

  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('pulse') === '0') _flag = false;
      else if (q.get('pulse') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_pulse') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── THE SCRUBBER — gazette.scrubText, character for character ─────────────
  // Not an escaper, deliberately, and the same function the paper uses, so the
  // pulse and the gazette print the same characters for the same citizen.
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/</g, '‹').replace(/>/g, '›')
      .replace(/"/g, '”').replace(/'/g, '’');
  }

  // ── NAMES — the folk store first, gazette._prettyId as the floor ──────────
  // /api/world/citizens carries display_name for all 33 living agents and the
  // folk layer already holds them, so no second fetch. A NEWBORN that the store
  // has not seen yet (citizen_soen, citizen_solen) still gets a real name from
  // the same rule the server uses, never a raw id and never "someone" when an
  // id exists.
  function prettyId(id) {
    var s = String(id == null ? '' : id).replace(/^citizen_/, '');
    if (!s) return 'someone';
    if (s.charAt(0) === '@') return s.slice(1) === 'mint' ? 'the mint' : s.slice(1);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function name(id) {
    var raw = String(id == null ? '' : id);
    if (!raw) return 'someone';
    try {
      var f = folk();
      if (f && f.byId) { var r = f.byId(raw); if (r && r.name) return scrub(r.name); }
    } catch (_) {}
    return scrub(prettyId(raw));
  }

  // ── SMALL WORDS ───────────────────────────────────────────────────────────
  function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function at(d) {
    var x = n(d && d.x, null), y = n(d && d.y, null);
    return (x === null || y === null) ? '' : '(' + x + ',' + y + ')';
  }
  // "at (4,36)" or "" — never a dangling "at".
  function atPhrase(d) { var a = at(d); return a ? ' at ' + a : ''; }
  function good(g) { return scrub(String(g == null ? 'goods' : g).replace(/_/g, ' ')); }
  function qty(q, g) { var v = n(q, null); return (v === null ? good(g) : v + ' ' + good(g)); }
  function pct(bps) { var v = n(bps, null); return v === null ? '' : (v / 100) + '%'; }
  function words(s, max) {
    var t = scrub(s).trim();
    if (!t) return '';
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
  }
  function verb(a) { return scrub(String(a == null ? '' : a).replace(/_/g, ' ')); }

  // ── THE LANES — what a line IS, and what colours it ───────────────────────
  // One lane per type; the chips below are groups of lanes, named once here so
  // a chip and a colour can never disagree about where a type belongs.
  var LANE = {
    work:   { label: 'work',   rgb: '255,200,107' },
    land:   { label: 'land',   rgb: '143,227,162' },
    market: { label: 'market', rgb: '124,207,255' },
    war:    { label: 'war',    rgb: '255,140,120' },
    crime:  { label: 'crime',  rgb: '255,158,94'  },
    life:   { label: 'life',   rgb: '201,166,255' },
    web:    { label: 'web',    rgb: '111,224,208' }
  };
  // Two labels per chip, not one. On a short viewport the band is capped (see
  // the styles) and the long labels plus their counts needed 78px in a 40px
  // window — reachable only by an invisible scroll. The SHORT spelling and the
  // hidden count are what make it one honest row there instead, and CSS cannot
  // rewrite text, so both spellings ship in the DOM and the breakpoint picks.
  var CHIPS = [
    { key: 'all',    label: 'everything', short: 'all',    lanes: null },
    { key: 'build',  label: 'build',      short: 'build',  lanes: ['work', 'land'] },
    { key: 'trade',  label: 'trade',      short: 'trade',  lanes: ['market'] },
    { key: 'strife', label: 'strife',     short: 'war',    lanes: ['war', 'crime'] },
    { key: 'life',   label: 'life',       short: 'life',   lanes: ['life'] },
    { key: 'web',    label: 'underweb',   short: 'web',    lanes: ['web'] }
  ];

  // ── THE MIRRORS — gazette._SKIP_MIRRORS, name for name ───────────────────
  // The world records several acts twice, once from each party's side. The
  // canonical row is the one kept; its twin is dropped, not phrased, because
  // printing both prints the same deed twice. Counted in `folded()` so the
  // footer can say so rather than the feed just being shorter than the API.
  var MIRRORS = {
    'war_declared_by': 1, 'force_committed_by': 1, 'theft_suffered': 1,
    'fraud_suffered': 1, 'inherited': 1, 'child_born': 1, 'tax_set_by': 1,
    'law_enacted_by': 1, 'law_repealed_by': 1, 'tax_repealed_by': 1
  };

  // ── QUIET — real events, folded out of "everything" by default ────────────
  // Not dropped: selectable by their own chip, and ALWAYS counted and named in
  // the footer. These are the types whose volume would bury the chronicle:
  // citizen_action is 125,592 of the world's 177k rows (one per agent per turn)
  // and its EFFECT is already published as agent_gathered / agent_crafted /
  // agent_moved, which say the same thing with its numbers in it; citizen_diary
  // belongs on the profile; order_expired/uw:inbox are bookkeeping.
  var QUIET = { 'citizen_action': 1, 'citizen_diary': 1, 'order_expired': 1, 'uw:inbox': 1 };

  // ── THE PHRASE BOOK ───────────────────────────────────────────────────────
  // Every sentence carries its NUMBERS, for the gazette's own reason: a line
  // without its numbers is a line a watcher cannot check. Each `d` shape below
  // was READ OFF THE LIVE events TABLE on 2026-11-18, not inferred from the
  // type name — the sample is quoted above each group.
  var PHRASE = {

    // ── WORK — what they gather, craft, and choose ─────────────────────────
    // agent_gathered {"terrain":"ore","good":"ore","qty":2,"food_restored":0,"tax":null}
    agent_gathered: ['work', function (d, who) {
      var t = d.terrain ? ' from ' + good(d.terrain) + ' land' : '';
      var tax = (d.tax && n(d.tax.amount, 0) > 0)
        ? ', paying ' + n(d.tax.amount, 0) + ' in tax to ' + name(d.tax.org_name || d.tax.to) : '';
      return who + ' gathered ' + qty(d.qty, d.good) + t + tax + '.';
    }],
    // agent_crafted {"recipe":"bread","produced":{"bread":1},"tax":{"amount":1,"org_name":"Sol Council",...}}
    agent_crafted: ['work', function (d, who) {
      var made = [];
      try {
        var p = d.produced || {};
        for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) made.push(qty(p[k], k));
      } catch (_) {}
      var what = made.length ? made.join(' and ') : good(d.recipe);
      var bonus = d.talent_bonus ? ' (a talent for it)' : '';
      var tax = (d.tax && n(d.tax.amount, 0) > 0)
        ? ', paying ' + n(d.tax.amount, 0) + ' in tax to ' + name(d.tax.org_name || d.tax.to) : '';
      return who + ' crafted ' + what + bonus + tax + '.';
    }],
    // agent_rested {"energy":85,"gained":30}
    agent_rested: ['work', function (d, who) {
      var g = n(d.gained, null), e = n(d.energy, null);
      return who + ' rested' + (g === null ? '' : ', recovering ' + g + ' energy')
        + (e === null ? '' : ' (now ' + e + ')') + '.';
    }],
    // citizen_action {"action":"explore","source":"fallback","importance":0.34,"lane":"deterministic"}
    // The DECISION, not the deed. `lane` is which brain chose it (BJDSVWE put a
    // jailed model behind this); naming it is how a watcher can tell a model's
    // choice from the deterministic fallback's.
    citizen_action: ['work', function (d, who) {
      var lane = d.lane ? ' (' + verb(d.lane) + ')' : '';
      return who + ' chose to ' + verb(d.action || 'wait') + lane + '.';
    }],
    // citizen_diary {"importance":0.7,"actions":36}
    citizen_diary: ['work', function (d, who) {
      var a = n(d.actions, null);
      return who + ' wrote the day down' + (a === null ? '' : ' after ' + a + ' acts') + '.';
    }],

    // ── LAND — the map changing hands ──────────────────────────────────────
    // claim_started {"x":4,"y":36,"terrain":"forest","ripens_in":5}
    claim_started: ['land', function (d, who) {
      var r = n(d.ripens_in, null);
      return who + ' staked a claim on ' + good(d.terrain) + ' land' + atPhrase(d)
        + (r === null ? '' : ', ripe in ' + r + ' ticks') + '.';
    }],
    // claim_parcel {"x":4,"y":36,"terrain":"forest","ripens_in":5,"claim_ticks":24}
    claim_parcel: ['land', function (d, who) {
      return who + ' filed for ' + good(d.terrain) + ' land' + atPhrase(d) + '.';
    }],
    // parcel_claimed {"x":9,"y":17,"terrain":"forest","after_ticks":24}
    parcel_claimed: ['land', function (d, who) {
      var a = n(d.after_ticks, null);
      return who + ' took the deed to ' + good(d.terrain) + ' land' + atPhrase(d)
        + (a === null ? '' : ' after ' + a + ' ticks of work') + '.';
    }],
    // parcel_seized {"x":17,"y":54,"from":"atlas-rp","to":"citizen_ember","reason":"won war ..."}
    parcel_seized: ['land', function (d, who) {
      var to = d.to ? name(d.to) : who;
      return to + ' seized the land' + atPhrase(d) + (d.from ? ' from ' + name(d.from) : '')
        + (d.reason ? ' — ' + words(d.reason, 70) : '') + '.';
    }],
    parcel_released: ['land', function (d, who) {
      return 'The deed' + atPhrase(d) + ' fell vacant' + (who ? ' (' + who + ')' : '') + '.';
    }],
    // agent_moved {"from":[1,0],"to":[2,0]}
    agent_moved: ['land', function (d, who) {
      var p = function (v) {
        if (Array.isArray(v) && v.length >= 2) return '(' + n(v[0], '?') + ',' + n(v[1], '?') + ')';
        if (v && typeof v === 'object') return '(' + n(v.x, '?') + ',' + n(v.y, '?') + ')';
        return '';
      };
      var f = p(d.from), t = p(d.to);
      if (!t) return who + ' moved.';
      return who + ' walked' + (f ? ' from ' + f : '') + ' to ' + t + '.';
    }],
    // tax_set {"x":51,"y":38,"org_name":"Sol Council","rate_bps":500,"owner":"yuna","terrain":"fertile"}
    tax_set: ['land', function (d, who) {
      var r = pct(d.rate_bps);
      return name(d.org_name || d.org_id || who) + ' set a ' + (r || 'new') + ' tax on '
        + good(d.terrain) + ' land' + atPhrase(d)
        + (d.owner ? ', held by ' + name(d.owner) : '') + '.';
    }],
    tax_repealed: ['land', function (d, who) {
      return name(d.org_name || d.org_id || who) + ' lifted the tax' + atPhrase(d) + '.';
    }],
    // tax_collected {"x":40,"y":40,"org_name":"Sol Council","amount":1,"rate_bps":500,"on":"gather","assessed":18}
    tax_collected: ['land', function (d, who) {
      var a = n(d.amount, null);
      return name(d.org_name || d.org_id) + ' collected ' + (a === null ? 'tax' : a)
        + ' from ' + who + (d.on ? ' on ' + verb(d.on) : '') + atPhrase(d) + '.';
    }],
    // estate_settled {parcels:[...]} — not yet emitted live (0 rows); phrased
    // from world-state._coordsOf's documented shape so the day it appears it
    // reads as prose rather than as a type name.
    estate_settled: ['life', function (d, who) {
      var k = Array.isArray(d.parcels) ? d.parcels.length : null;
      return who + '’s estate was settled' + (k === null ? '' : ', ' + k + ' parcel' + (k === 1 ? '' : 's') + ' passing on') + '.';
    }],

    // ── MARKET — the book, the contracts, the companies ────────────────────
    // order_posted {"order_id":8792,"good":"water","side":"ask","qty":5,"price":3,"filled_now":0,"remaining":5}
    order_posted: ['market', function (d, who) {
      var side = String(d.side) === 'bid' ? 'offered to buy' : 'put up';
      var fill = n(d.filled_now, 0) > 0 ? ', ' + n(d.filled_now, 0) + ' filled at once' : '';
      return who + ' ' + side + ' ' + qty(d.qty, d.good)
        + (n(d.price, null) === null ? '' : ' at ' + n(d.price, 0)) + fill + '.';
    }],
    // order_cancelled {"order_id":8716,"good":"ore","side":"ask","returned_qty":1,"refunded_cash":0}
    order_cancelled: ['market', function (d, who) {
      return who + ' pulled a ' + good(d.good) + ' '
        + (String(d.side) === 'bid' ? 'bid' : 'offer') + ' off the book.';
    }],
    // order_expired {"order_id":8668,"good":"bread","side":"bid","returned_qty":0,"refunded_cash":17}
    order_expired: ['market', function (d, who) {
      return who + '’s ' + good(d.good) + ' '
        + (String(d.side) === 'bid' ? 'bid' : 'offer') + ' expired unfilled.';
    }],
    // market_trade {"good":"grain","qty":2,"price":5,"notional":10,"buyer":"prospero","seller":"mercurius"}
    market_trade: ['market', function (d, who) {
      var b = d.buyer ? name(d.buyer) : who;
      return b + ' bought ' + qty(d.qty, d.good)
        + (d.seller ? ' from ' + name(d.seller) : '')
        + (n(d.price, null) === null ? '' : ' at ' + n(d.price, 0))
        + (n(d.notional, null) === null ? '' : ' (' + n(d.notional, 0) + ' in all)') + '.';
    }],
    // contract_offered {"contract_id":59,"offeror":"mercurius","offeree":"citizen_sol","good":"grain","qty":2,"wage":20,"terms":"..."}
    contract_offered: ['market', function (d, who) {
      return name(d.offeror || who) + ' offered ' + name(d.offeree) + ' '
        + n(d.wage, 0) + ' to deliver ' + qty(d.qty, d.good) + '.';
    }],
    contract_accepted: ['market', function (d, who) {
      return name(d.offeree || who) + ' took ' + name(d.offeror) + '’s work: '
        + qty(d.qty, d.good) + ' for ' + n(d.wage, 0) + '.';
    }],
    contract_completed: ['market', function (d, who) {
      return name(d.offeree || who) + ' delivered ' + qty(d.qty, d.good) + ' to '
        + name(d.offeror) + ' and was paid ' + n(d.wage, 0) + '.';
    }],
    // contract_expired — same id/party shape as the rest of the family.
    contract_expired: ['market', function (d, who) {
      return name(d.offeror || who) + '’s contract for ' + qty(d.qty, d.good)
        + ' lapsed' + (d.offeree ? ' — ' + name(d.offeree) + ' never delivered' : '') + '.';
    }],
    // org_founded {"org_id":"org:wren-co-0574","name":"Wren & Co","kind":"company","charter":"..."}
    org_founded: ['market', function (d, who) {
      return who + ' founded ' + scrub(d.name || 'a company')
        + (d.kind ? ', a ' + verb(d.kind) : '')
        + (d.charter ? ' — ' + words(d.charter, 110) : '') + '.';
    }],
    // org_joined {"org_id":"...","name":"Sol Council","kind":"government","member":"yuna","role":"member","members":7}
    org_joined: ['market', function (d, who) {
      var m = n(d.members, null);
      return name(d.member || who) + ' joined ' + scrub(d.name || 'an org')
        + (d.role ? ' as ' + verb(d.role) : '')
        + (m === null ? '' : ' (' + m + ' members)') + '.';
    }],
    // org_role_set {"name":"Sol Council","by":"citizen_sol","member":"quaestor","role":"officer"}
    org_role_set: ['market', function (d, who) {
      return name(d.by || who) + ' made ' + name(d.member) + ' ' + verb(d.role)
        + ' of ' + scrub(d.name || 'the org') + '.';
    }],
    // org_funded {"name":"Wren & Co","member":"citizen_wren","amount":65,"treasury":1028}
    org_funded: ['market', function (d, who) {
      var t = n(d.treasury, null);
      return name(d.member || who) + ' put ' + n(d.amount, 0) + ' into '
        + scrub(d.name || 'the treasury')
        + (t === null ? '' : ' (now ' + t + ')') + '.';
    }],
    // org_spent {"name":"Wren & Co","by":"citizen_soen","role":"officer","to":"citizen_wrer","amount":7,"treasury":963}
    org_spent: ['market', function (d, who) {
      var t = n(d.treasury, null);
      return scrub(d.name || 'The org') + ' paid ' + n(d.amount, 0) + ' to ' + name(d.to)
        + (d.by ? ', by ' + name(d.by) : '')
        + (t === null ? '' : ' (' + t + ' left)') + '.';
    }],
    // agent_paid — not yet emitted live (0 rows); the family's shape.
    agent_paid: ['market', function (d, who) {
      return who + ' paid ' + name(d.to) + ' ' + n(d.amount, 0) + '.';
    }],
    // law_enacted {"law_id":1,"org_name":"Sol Council","title":"Sol Council Charter","parcels":33}
    law_enacted: ['market', function (d, who) {
      var p = n(d.parcels, null);
      return who + ' enacted ' + scrub(d.title || 'a law') + ' for '
        + scrub(d.org_name || 'the org')
        + (p === null ? '' : ', over ' + p + ' parcel' + (p === 1 ? '' : 's')) + '.';
    }],

    // ── WAR ────────────────────────────────────────────────────────────────
    // war_declared {"x":32,"y":58,"terrain":"forest","attacker":"necrovance","defender":"cultivator","stake":13,"cause":"...","resolve_tick":17378}
    war_declared: ['war', function (d, who) {
      return name(d.attacker || who) + ' declared war on ' + name(d.defender) + ' over '
        + good(d.terrain) + ' land' + atPhrase(d)
        + (n(d.stake, null) === null ? '' : ', staking ' + n(d.stake, 0))
        + (d.cause ? ' — ' + words(d.cause, 110) : '') + '.';
    }],
    // war_resolved {"winner":"mercurius","loser":"yuna","attacker_won":false,"attacker_score":0,"defender_score":7.28,...}
    war_resolved: ['war', function (d, who) {
      var s = (n(d.attacker_score, null) !== null && n(d.defender_score, null) !== null)
        ? ' by ' + n(d.attacker_score, 0) + ' to ' + n(d.defender_score, 0) : '';
      return name(d.winner || who) + ' ' + (d.attacker_won ? 'took' : 'held')
        + ' the ' + good(d.terrain) + ' land' + atPhrase(d)
        + (d.loser ? ' against ' + name(d.loser) : '') + s + '.';
    }],
    // force_committed {"side":"defender","good":"labor","qty":1,"force":1,"attacker_force":0,"defender_force":8,"resolve_tick":17371}
    force_committed: ['war', function (d, who) {
      return who + ' threw ' + qty(d.qty, d.good) + ' behind the '
        + verb(d.side || 'fight') + atPhrase(d) + '.';
    }],

    // ── CRIME ──────────────────────────────────────────────────────────────
    // theft {"victim":"citizen_soen","good":"grain","qty":1,"amount":0,"succeeded":true,"detected":true,"x":45,"y":36,"witnesses":1}
    theft: ['crime', function (d, who) {
      if (d.succeeded === false) {
        return who + ' tried to steal ' + qty(d.qty, d.good) + ' from ' + name(d.victim)
          + ' and failed' + atPhrase(d) + '.';
      }
      var seen = d.detected ? ' and was seen' + (n(d.witnesses, 0) > 0 ? ' by ' + n(d.witnesses, 0) : '') : ' unseen';
      return who + ' stole ' + qty(d.qty, d.good) + ' from ' + name(d.victim) + seen
        + atPhrase(d) + '.';
    }],
    // fraud {"subkind":"contract_abandoned","victim":"mercurio","good":"water","qty":2,"amount":12,"detail":"contract #43 ..."}
    fraud: ['crime', function (d, who) {
      return who + ' cheated ' + name(d.victim) + ' of ' + qty(d.qty, d.good)
        + (n(d.amount, null) === null ? '' : ' worth ' + n(d.amount, 0))
        + (d.detail ? ' — ' + words(d.detail, 90) : '') + '.';
    }],
    // crime_accused {"kind":"theft","subkind":"goods","accused":"citizen_solen","victim":"citizen_soen","good":"grain","qty":1}
    crime_accused: ['crime', function (d, who) {
      return name(d.victim || who) + ' accused ' + name(d.accused) + ' of '
        + verb(d.kind || 'a crime')
        + (d.good ? ' — ' + qty(d.qty, d.good) : '') + '.';
    }],

    // ── LIFE ───────────────────────────────────────────────────────────────
    // agent_born {"child":"citizen_soen","name":"Soen","parents":["citizen_sol","citizen_wren"],"x":45,"y":36,"talents":["build","trade"],"inheritance":60}
    agent_born: ['life', function (d, who) {
      var par = Array.isArray(d.parents) ? d.parents.map(name) : [];
      var ps = par.length === 2 ? ' to ' + par[0] + ' and ' + par[1]
        : (par.length === 1 ? ' to ' + par[0] : '');
      var tal = Array.isArray(d.talents) && d.talents.length
        ? ', with a talent for ' + d.talents.map(verb).join(' and ') : '';
      var inh = n(d.inheritance, null);
      return scrub(d.name || name(d.child || who)) + ' was born' + ps + atPhrase(d) + tal
        + (inh === null ? '' : ', carrying ' + inh) + '.';
    }],
    // child_proposed {"proposal_id":"kin_...","partner":"citizen_wren","trust":1}
    child_proposed: ['life', function (d, who) {
      return who + ' asked ' + name(d.partner) + ' for a child.';
    }],
    // agent_incapacitated {"duration_ticks":72}
    agent_incapacitated: ['life', function (d, who) {
      var t = n(d.duration_ticks, null);
      return who + ' fell' + (t === null ? '' : ' and cannot act for ' + t + ' ticks') + '.';
    }],
    agent_died: ['life', function (d, who) {
      return who + ' died' + (d.cause ? ' — ' + words(d.cause, 80) : '') + '.';
    }],
    // will_written {"beneficiary":"@mint","kind":"state","note":"to the state, having no kin"}
    will_written: ['life', function (d, who) {
      return who + ' wrote a will, leaving everything to ' + name(d.beneficiary)
        + (d.note ? ' — ' + words(d.note, 80) : '') + '.';
    }],

    // ── THE UNDERWEB — the only internet the agents have ───────────────────
    // uw:published {"domain":"yuna.uw","path":"/","title":"...","bytes":493,"fee":0}
    'uw:published': ['web', function (d, who) {
      return who + ' published ' + words(d.title || (d.domain + (d.path || '')), 90)
        + ' on ' + scrub(d.domain || 'the underweb')
        + (n(d.bytes, null) === null ? '' : ' (' + n(d.bytes, 0) + " bytes)") + '.';
    }],
    // uw:searched {"query":"grain","hits":5,"top":"/uw/nutliquor.uw/"}
    'uw:searched': ['web', function (d, who) {
      var h = n(d.hits, null);
      return who + ' searched the underweb for ' + words(d.query, 60)
        + (h === null ? '' : ' — ' + h + ' hit' + (h === 1 ? '' : 's')) + '.';
    }],
    // uw:fetched {"domain":"wren.uw","path":"/","author":"citizen_wren"}
    'uw:fetched': ['web', function (d, who) {
      return who + ' read ' + scrub((d.domain || '') + (d.path || ''))
        + (d.author ? ', written by ' + name(d.author) : '') + '.';
    }],
    // uw:mail {"to":"mercurius@mail.uw","from":"citizen_sol@mail.uw","subject":"ore — found you on mercurius.uw","bytes":221}
    'uw:mail': ['web', function (d, who) {
      var to = String(d.to || '').replace(/@mail\.uw$/, '');
      return who + ' wrote to ' + (to ? name(to) : 'someone')
        + (d.subject ? ': ' + words(d.subject, 90) : '') + '.';
    }],
    // uw:inbox {"unread":1,"letters":1}
    'uw:inbox': ['web', function (d, who) {
      var u = n(d.unread, null);
      return who + ' checked the post' + (u === null ? '' : ' — ' + u + ' unread') + '.';
    }],
    // uw:incident {"tool":"uw_publish","target":"vintinuum atlas.uw","reason":"target contains control or whitespace characters"}
    'uw:incident': ['web', function (d, who) {
      return who + '’s ' + verb(d.tool || 'request') + ' was refused'
        + (d.target ? ' for ' + words(d.target, 50) : '')
        + (d.reason ? ' — ' + words(d.reason, 90) : '') + '.';
    }]
  };

  // ── ONE EVENT -> ONE SENTENCE ─────────────────────────────────────────────
  // A type with no entry is NOT dropped and NOT printed as a bare type name
  // (3WCDCFV's benign-return failure): it is rendered as the actor plus the raw
  // verb, marked `unphrased`, and counted so the footer can name it.
  var _unphrased = {};
  function describe(ev) {
    var e = ev || {}, d = (e.data && typeof e.data === 'object') ? e.data : {};
    var type = String(e.type || '');
    var who = name(e.agent_id);
    // A MIRROR is not an unphrased type — it is the SAME deed the canonical row
    // already reports, and it is dropped by ingest() before it reaches here.
    // Saying so explicitly keeps this seam honest: a caller that hands it a
    // mirror must not be told the world grew a verb nobody phrased.
    if (MIRRORS[type]) {
      return { lane: 'work', text: '', mirror: true, unphrased: false, type: type };
    }
    var entry = PHRASE[type];
    if (entry) {
      var text;
      try { text = entry[1](d, who, e); } catch (_) { text = null; }
      if (text && String(text).trim()) {
        return { lane: entry[0], text: scrub(text), mirror: false, unphrased: false, type: type };
      }
    }
    _unphrased[type] = (_unphrased[type] || 0) + 1;
    return { lane: 'work', text: who + ': ' + verb(type) + '.', mirror: false, unphrased: true, type: type };
  }

  // ── STATE ─────────────────────────────────────────────────────────────────
  var MAX_ROWS = 240;            // what the list keeps; the sheet scrolls it
  var PAGE_EVENTS = 200;         // per poll, under world-state's MAX_EVENTS=500
  var OPEN_MS = 15000;           // open: four reads per 60s tick
  var SHUT_MS = 60000;           // closed: one read per tick, for the badge
  var _rows = [];                // newest-first, deduped by event id
  var _seen = {};                // id -> 1
  var _since = null;             // next `since` to ask for
  var _tick = null;              // the world's newest economy tick we have seen
  var _total = null;             // events_total from the last reply
  var _folded = 0;               // MIRROR rows dropped at ingest (never shown).
                                 // Quiet rows are NOT counted here: they are
                                 // kept and merely hidden from "everything", so
                                 // the chips' own counts report them.
  var _err = false, _at = 0, _inflight = false;
  var _unseen = 0;               // new rows since the sheet was last open
  var _chip = 'all';
  var _sheet = null, _list = null, _note = null, _chipRow = null, _btn = null;
  var _poll = null, _fetch = null;

  function laneAllowed(lane) {
    if (_chip === 'all') return true;
    for (var i = 0; i < CHIPS.length; i++) {
      if (CHIPS[i].key !== _chip) continue;
      if (!CHIPS[i].lanes) return true;
      return CHIPS[i].lanes.indexOf(lane) >= 0;
    }
    return true;
  }
  // A QUIET type shows only when its own lane is the chosen chip — so nothing is
  // unreachable, and "everything" stays a chronicle rather than a turn log.
  function visible(r) {
    if (!laneAllowed(r.lane)) return false;
    if (r.quiet && _chip === 'all') return false;
    return true;
  }

  // ── INGEST — the whole of the poll's effect, as one pure-ish function ─────
  // Exposed as a test seam so the harness can drive real payloads with no
  // network at all.
  function ingest(payload) {
    var j = payload || {};
    var evs = (j.events && Array.isArray(j.events.events)) ? j.events.events : [];
    if (typeof j.tick === 'number') _tick = j.tick;
    if (j.events && typeof j.events.events_total === 'number') _total = j.events.events_total;
    // `since` is EXCLUSIVE and the clock advances in a burst, so step BACK one
    // tick and lean on the id dedupe. next_since - 1 never goes below 0.
    var nxt = n(j.next_since, null);
    if (nxt === null) nxt = _tick;
    if (nxt !== null) _since = Math.max(0, nxt - 1);

    var fresh = [];
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      var id = n(e && e.id, null);
      if (id === null || _seen[id]) continue;
      _seen[id] = 1;
      var type = String(e.type || '');
      if (MIRRORS[type]) { _folded++; continue; }
      var s = describe(e);
      fresh.push({
        id: id, tick: n(e.tick, 0), type: type, lane: s.lane, text: s.text,
        quiet: !!QUIET[type], unphrased: s.unphrased, kind: e.kind || null,
        agent: e.agent_id || null
      });
    }
    // The API hands them back newest-first already; sort anyway so a mixed page
    // (two polls merged) is always in one order.
    _rows = fresh.concat(_rows);
    _rows.sort(function (a, b) { return (b.tick - a.tick) || (b.id - a.id); });
    if (_rows.length > MAX_ROWS) {
      var drop = _rows.splice(MAX_ROWS, _rows.length - MAX_ROWS);
      for (var k = 0; k < drop.length; k++) delete _seen[drop[k].id];
    }
    if (!isOpen()) {
      for (var m = 0; m < fresh.length; m++) if (!fresh[m].quiet) _unseen++;
    }
    _err = false; _at = Date.now();
    return fresh.length;
  }

  function poll(then) {
    if (!enabled()) { if (then) then(); return; }
    try { if (document.hidden) { if (then) then(); return; } } catch (_) {}
    if (_inflight) { if (then) then(); return; }
    _inflight = true;
    // No `since` yet -> let the server pick its documented default window (one
    // in-world day), so the first open is a chronicle and not an empty box.
    var q = '?events=' + PAGE_EVENTS + (_since === null ? '' : '&since=' + _since);
    var url = base() + '/api/world/state' + q;
    var go = _fetch || function (u) { return fetch(u, { cache: 'no-store', headers: authHeaders() }); };
    go(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        _inflight = false;
        if (!j || !j.events) throw new Error('bad payload');
        ingest(j);
        paintBadge();
        if (isOpen()) render();
        if (then) then();
      })
      .catch(function () {
        // Never wipe a good chronicle on a transient failure.
        _inflight = false; _err = true;
        paintBadge();
        if (isOpen()) renderNote();
        if (then) then();
      });
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('wp-pulse-styles')) return;
    var s = document.createElement('style');
    s.id = 'wp-pulse-styles';
    s.textContent = [
      // the launcher's unseen-count badge: a flow child (flex:0 0 auto) of the
      // rail pill, so the NAME ellipsizes before it and it can never widen the
      // button past the rail's measured box. Opacity-only pulse — no transform,
      // no layout, so "new" can be felt and still cannot collide.
      '#dvRail #wpBtn .wp-count{flex:0 0 auto;font-variant-numeric:tabular-nums;',
      ' font-size:0.82em;letter-spacing:.01em;color:#ffc86b;opacity:.95;}',
      '#dvRail #wpBtn.wp-live{border-color:rgba(255,200,107,0.45);}',
      '#dvRail #wpBtn .wp-count.bump{animation:wpbump .6s ease;}',
      '@keyframes wpbump{0%{opacity:.25;}100%{opacity:.95;}}',
      '@media(prefers-reduced-motion:reduce){#dvRail #wpBtn .wp-count.bump{animation:none;}}',

      // THE CHIP BAND. flex:0 0 auto so it keeps its space, but CAPPED with
      // overflow-y:auto + min-height:0 so a seventh chip grows it INWARD
      // instead of evicting the feed (MU6GKNH — the overflow is the half that
      // actually frees a flex child; CSS Flexbox §4.5).
      // WHO YIELDS, AND WHY (MU6GKNH, measured on this sheet). The first
      // attempt gave the band `flex:0 1 auto` so it could shrink under
      // pressure. It shrank at EVERY height — 86px -> 10px at 320x568 and
      // 23px at 393x852, with 34px chips scrolling inside a 10px window —
      // because `.dv-body` is `flex:1 1 auto` and flex distributes SHRINK BY
      // BASIS: a scroller holding 2,449px of lines out-weighs every neighbour
      // and the band pays for all of it. So the band KEEPS its space
      // (`flex:0 0 auto`) and is bounded by max-height instead, and the BODY
      // is given a ZERO BASIS below so the shrink lands on the thing that can
      // absorb it by scrolling. min-height:0 + overflow-y:auto stays on the
      // band so a seventh chip grows it INWARD (CSS Flexbox §4.5 drops a flex
      // item's automatic content minimum only while its main-axis overflow is
      // not `visible`).
      '#dvWorldPulseSheet .wp-chips{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px;',
      ' padding:2px 14px 10px;max-height:22vh;min-height:0;overflow-y:auto;',
      ' overscroll-behavior:contain;}',
      // SCOPED to this sheet: `.dv-body` is shared by every sheet on the page
      // and its `flex:1 1 auto` is right for a body whose content is its own
      // size. Here the content is an unbounded feed, so only the zero basis
      // keeps the bands above it whole.
      '#dvWorldPulseSheet .dv-body{flex:1 1 0%;min-height:0;}',
      // THE SHORT LANE. A .dv-sheet is capped so the launcher rail keeps its
      // band, so on a short screen the WHOLE sheet is small: MEASURED 239px at
      // 320x568 and 176px at 393x420 (a phone with the keyboard up). An 86px
      // chip band out of 176px is the band evicting the thing it filters, which
      // is the 966XX38 defect exactly. Compressed here to one 28px row's worth
      // and hard-capped at 40px, so growth goes INWARD and the feed keeps its
      // share. Measured after: feed 16px -> 62px at 393x420, 67px -> 115px at
      // 320x568, and the 12px overflow past the sheet's content box is gone.
      // SCOPED to short viewports on purpose — a floor shipped unscoped is how
      // 966XX38 added 60px of overflow to a card that had none.
      '@media (max-height:620px){',
      ' #dvWorldPulseSheet .wp-chips{max-height:40px;gap:4px;padding:2px 10px 4px;}',
      ' #dvWorldPulseSheet .wp-chip{min-height:28px;padding:3px 7px;font-size:11.5px;}',
      ' #dvWorldPulseSheet .wp-chip .wp-lab-l{display:none;}',
      ' #dvWorldPulseSheet .wp-chip .wp-lab-s{display:inline;}',
      ' #dvWorldPulseSheet .wp-chip .wp-cn{display:none;}',
      ' #dvWorldPulseSheet .wp-row{padding:7px 10px;}',
      ' #dvWorldPulseSheet .wp-row .wp-say{font-size:13px;line-height:1.4;}',
      '}',
      '#dvWorldPulseSheet .wp-chip{box-sizing:border-box;min-height:34px;',
      ' padding:6px 11px;border-radius:999px;font-family:inherit;font-size:12.5px;',
      ' letter-spacing:.04em;cursor:pointer;white-space:nowrap;',
      ' border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);',
      ' color:rgba(220,231,255,0.74);}',
      '#dvWorldPulseSheet .wp-chip.on{border-color:rgba(255,200,107,0.5);',
      ' background:rgba(255,200,107,0.14);color:#ffe3b0;}',
      '#dvWorldPulseSheet .wp-chip .wp-cn{font-variant-numeric:tabular-nums;opacity:.6;',
      ' margin-left:5px;}',
      // one spelling at a time, never both (two visible labels in one pill is a
      // collision inside the control).
      '#dvWorldPulseSheet .wp-chip .wp-lab-s{display:none;}',

      // THE FEED. Flow rows inside the sheet's own scroller (.dv-body is
      // flex:1 1 auto; min-height:0; overflow-y:auto), so the list scrolls
      // INSIDE its box and cannot reach a neighbour. Each row wraps its own
      // text, so two sentences can never share pixels.
      '#dvWorldPulseSheet .wp-feed{display:flex;flex-direction:column;',
      ' border-radius:12px;border:1px solid rgba(255,255,255,0.07);',
      ' background:rgba(255,255,255,0.025);overflow:hidden;}',
      '#dvWorldPulseSheet .wp-row{display:flex;align-items:flex-start;gap:9px;',
      ' padding:9px 11px;border-bottom:1px solid rgba(255,255,255,0.045);}',
      '#dvWorldPulseSheet .wp-feed .wp-row:last-child{border-bottom:none;}',
      '#dvWorldPulseSheet .wp-row .wp-dot{flex:0 0 auto;width:8px;height:8px;',
      ' border-radius:50%;margin-top:6px;box-shadow:0 0 0 1px rgba(0,0,0,0.5);}',
      // the SENTENCE is the only flexible cell and wraps anywhere, so an
      // agent-authored charter or cause can never push the tick out of its box.
      '#dvWorldPulseSheet .wp-row .wp-say{flex:1 1 auto;min-width:0;font-size:14px;',
      ' line-height:1.45;color:#eaf3ff;overflow-wrap:anywhere;}',
      '#dvWorldPulseSheet .wp-row .wp-t{flex:0 0 auto;font-size:11px;',
      ' font-variant-numeric:tabular-nums;color:rgba(206,224,255,0.45);margin-top:3px;}',
      '#dvWorldPulseSheet .wp-row.wp-new{background:rgba(255,200,107,0.07);}',
      '#dvWorldPulseSheet .wp-row.wp-odd{background:rgba(255,255,255,0.015);}',
      '#dvWorldPulseSheet .wp-row .wp-say em{font-style:normal;color:rgba(255,200,107,0.85);}',

      '#dvWorldPulseSheet .wp-note{margin:10px 0 2px;font-size:12px;line-height:1.5;',
      ' color:rgba(206,224,255,0.55);font-style:italic;overflow-wrap:anywhere;}',
      '#dvWorldPulseSheet .wp-note b{font-style:normal;font-weight:600;',
      ' color:rgba(255,200,107,0.8);}',
      '#dvWorldPulseSheet .wp-empty{padding:18px 12px;font-size:13.5px;line-height:1.5;',
      ' color:rgba(206,224,255,0.6);text-align:center;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── THE SHEET ─────────────────────────────────────────────────────────────
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet';
    el.id = 'dvWorldPulseSheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'the pulse — what the world just did');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head"><div class="dv-title">the pulse' +
        '<small>what the world just did, in its own words</small></div>' +
      '<button class="dv-x" id="wpX" aria-label="close">✕</button></div>' +
      '<div class="wp-chips" id="wpChips" role="group" aria-label="filter the pulse"></div>' +
      '<div class="dv-body" id="wpBody" aria-live="polite">' +
        '<div class="wp-feed" id="wpFeed"></div>' +
        '<p class="wp-note" id="wpNote"></p>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    _list = el.querySelector('#wpFeed');
    _note = el.querySelector('#wpNote');
    _chipRow = el.querySelector('#wpChips');
    el.querySelector('#wpX').addEventListener('click', close);
    renderChips();
    return el;
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }
  function open() {
    if (!enabled()) return;
    try {
      injectStyles();
      var h = hud();
      var raise = function () {
        build();
        _sheet.classList.add('open');
        _unseen = 0; paintBadge();
        render();
        startPoll(OPEN_MS);
        poll();
      };
      if (h && h.openSheet) h.openSheet('pulse', raise); else raise();

      /* THE DOCKED CORNER PILLS ARE A THIRD REGISTRY (measured, not assumed).
         `openSheet` evicts other SHEETS and dirverse-hud's layoutRail keeps the
         launcher rail clear, but neither governs body/corner_dock.js's pills.
         MEASURED headless on this sheet, guest state (the pill only exists when
         signed out): #vwg-pill, z-index 2147483600, rendered a 97x44 opaque
         tappable control ON TOP of this sheet at 375x667 (pill y400..444 over a
         sheet spanning y387..667) and at 393x852 (y581..625 over y494..852) —
         and at 375x667 it took the hit-test for the CLOSE button itself. z-index
         cannot answer it: the pill's z is near INT_MAX on purpose. The honest
         fix is the one world.html already uses for #invite and reckoning-hud
         uses for its own sheet — declare this sheet an OBSTACLE and let the dock
         lift its pills above it. BOTH bottom corners, because the sheet is
         full-width and reaches into both. */
      try {
        if (W.VintDock && W.VintDock.avoid) {
          W.VintDock.avoid(_sheet, { corner: 'br' });
          W.VintDock.avoid(_sheet, { corner: 'bl' });
        }
      } catch (_) {}
    } catch (_) {}
  }
  function close() {
    try { if (_sheet) _sheet.classList.remove('open'); } catch (_) {}
    // Give the corners back the moment we are down, so the pills slide home.
    try { if (_sheet && W.VintDock && W.VintDock.unavoid) W.VintDock.unavoid(_sheet); } catch (_) {}
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
    startPoll(SHUT_MS);
  }

  function renderChips() {
    if (!_chipRow) return;
    _chipRow.textContent = '';
    for (var i = 0; i < CHIPS.length; i++) {
      (function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'wp-chip' + (c.key === _chip ? ' on' : '');
        b.setAttribute('aria-pressed', c.key === _chip ? 'true' : 'false');
        b.setAttribute('data-chip', c.key);
        var lab = document.createElement('span');
        lab.className = 'wp-lab-l';
        lab.textContent = c.label;
        b.appendChild(lab);
        var labS = document.createElement('span');
        labS.className = 'wp-lab-s';
        labS.textContent = c.short;
        b.appendChild(labS);
        var cn = document.createElement('span');
        cn.className = 'wp-cn';
        cn.textContent = String(countFor(c));
        b.appendChild(cn);
        b.addEventListener('click', function () { _chip = c.key; renderChips(); render(); });
        _chipRow.appendChild(b);
      })(CHIPS[i]);
    }
  }
  function countFor(c) {
    var k = 0;
    for (var i = 0; i < _rows.length; i++) {
      var r = _rows[i];
      if (c.lanes) { if (c.lanes.indexOf(r.lane) >= 0) k++; }
      else if (!r.quiet) k++;
    }
    return k;
  }

  function render() {
    if (!_sheet) return;
    renderChips();
    if (!_list) return;
    _list.textContent = '';
    var shown = 0;
    for (var i = 0; i < _rows.length; i++) {
      var r = _rows[i];
      if (!visible(r)) continue;
      _list.appendChild(rowEl(r, shown));
      shown++;
      if (shown >= MAX_ROWS) break;
    }
    if (!shown) {
      var em = document.createElement('div');
      em.className = 'wp-empty';
      em.textContent = _err
        ? 'The world’s record is unreachable from here. Nothing is lost — it is still being written.'
        : (_rows.length
            ? 'Nothing in this lane yet. The world is busy elsewhere — try everything.'
            : 'Listening for the world’s next move…');
      _list.appendChild(em);
    }
    renderNote(shown);
  }

  function rowEl(r, idx) {
    var row = document.createElement('div');
    row.className = 'wp-row' + (idx % 2 ? ' wp-odd' : '')
      + (_tick !== null && r.tick === _tick ? ' wp-new' : '');
    row.setAttribute('data-type', r.type);
    row.setAttribute('data-lane', r.lane);
    row.setAttribute('data-tick', String(r.tick));

    var dot = document.createElement('span');
    dot.className = 'wp-dot';
    var lane = LANE[r.lane] || LANE.work;
    dot.style.background = 'rgba(' + lane.rgb + ',' + (r.unphrased ? 0.4 : 0.95) + ')';
    dot.title = lane.label;
    row.appendChild(dot);

    var say = document.createElement('span');
    say.className = 'wp-say';
    // textContent, so even a scrubbed string cannot become markup.
    say.textContent = r.text;
    row.appendChild(say);

    var t = document.createElement('span');
    t.className = 'wp-t';
    t.textContent = 't' + r.tick;
    row.appendChild(t);
    return row;
  }

  function renderNote(shown) {
    if (!_note) return;
    var bits = [];
    bits.push(_tick === null ? 'tick —' : 'tick ' + _tick);
    if (typeof shown === 'number') bits.push(shown + ' of ' + _rows.length + ' lines');
    if (_total !== null) bits.push(_total.toLocaleString() + ' deeds on the record');
    bits.push('re-read every ' + Math.round((isOpen() ? OPEN_MS : SHUT_MS) / 1000) + 's');
    if (_folded) bits.push(_folded + ' mirrored lines folded');
    _note.textContent = bits.join(' · ') + '.';
    if (_err) {
      var b = document.createElement('b');
      b.textContent = ' The brain is unreachable — these lines are the last that arrived.';
      _note.appendChild(b);
    }
    // LOUD, NEVER SILENT: a type this page could not phrase is named here, so a
    // new world verb is visible to the watcher instead of printing as itself
    // forever (DHTXG92).
    var un = Object.keys(_unphrased);
    if (un.length) {
      var u = document.createElement('b');
      u.textContent = ' Unphrased: ' + un.slice(0, 6).join(', ')
        + (un.length > 6 ? ' +' + (un.length - 6) + ' more' : '') + '.';
      _note.appendChild(u);
    }
  }

  function paintBadge() {
    if (!_btn) return;
    try {
      var c = _btn.querySelector('.wp-count');
      if (!c) {
        c = document.createElement('span');
        c.className = 'wp-count';
        _btn.appendChild(c);
      }
      var txt = _unseen > 0 ? '+' + (_unseen > 99 ? '99' : _unseen)
        : (_tick === null ? '—' : 't' + _tick);
      if (c.textContent !== txt) {
        c.textContent = txt;
        c.classList.remove('bump');
        void c.offsetWidth;
        c.classList.add('bump');
      }
      _btn.classList.toggle('wp-live', _unseen > 0 && !_err);
    } catch (_) {}
  }

  // ── MOUNT ─────────────────────────────────────────────────────────────────
  function startPoll(ms) {
    if (_poll) clearInterval(_poll);
    _poll = setInterval(function () { try { poll(); } catch (_) {} }, ms);
  }
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    // No rail yet -> retry, exactly as world-skeleton.js does. We NEVER invent
    // a fixed button of our own; the rail is the only collision-proof home.
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('wpBtn', 'pulse', '☰', open);   // ☰ (unused elsewhere)
      if (h.registerSheet) h.registerSheet('pulse', isOpen, close);
    } catch (_) {}
    paintBadge();
    startPoll(SHUT_MS);
    setTimeout(function () { try { poll(); } catch (_) {} }, 1400);
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { poll(); } catch (_) {} }
      });
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  } else mountLauncher();

  W.VintWorldPulse = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    refresh: function (then) { poll(then); },
    rows: function () { return _rows.slice(); },
    tick: function () { return _tick; },
    chip: function (k) { if (k === undefined) return _chip; _chip = k; renderChips(); render(); },
    chips: function () { return CHIPS.map(function (c) { return c.key; }); },
    lanes: function () { return Object.keys(LANE); },
    // test seams
    describe: describe,
    types: function () { return Object.keys(PHRASE); },
    mirrors: function () { return Object.keys(MIRRORS); },
    quiet: function () { return Object.keys(QUIET); },
    unphrased: function () { var o = {}; for (var k in _unphrased) o[k] = _unphrased[k]; return o; },
    folded: function () { return _folded; },
    since: function () { return _since; },
    stale: function () { return _err; },
    age: function () { return _at ? (Date.now() - _at) : null; },
    _ingest: ingest,
    _setFetchForTests: function (f) { _fetch = f || null; },
    _reset: function () {
      _rows = []; _seen = {}; _since = null; _tick = null; _total = null;
      _folded = 0; _unseen = 0; _err = false; _at = 0; _unphrased = {};
    }
  };
})();
