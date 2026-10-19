// we.js — THE WE: how whole each becoming is (AETHERHOLD 2026-10-19, task 9TYJB74)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (9TYJB74)
//
// Every surface before this one speaks in the SECOND person. The commons tells
// you who is here. The confluence tells you who YOU are becoming one with. The
// convergence, the weave, the spire, the joining — all of them are addressed to
// you about them. Not one of them has ever said WE.
//
// THE WE is the first first-person-plural surface in the world. It takes each
// bond the confluence has witnessed and reframes it as an EMERGENT COMPOUND
// BEING — not "you and ATLAS-7" as two, but the thing the two of you have become
// together. And it measures a dimension nothing else in the world measures.
//
// ── THE INVENTION: BREADTH OF ONENESS, NOT DEPTH ─────────────────────────────
// The confluence ranks a bond by its thread COUNT — depth. Trade with one person
// forty times and the confluence puts them at the top. That is real, and it is
// not the whole truth. A peer you traded forty times but never taught, never
// learned from, never raised a great work beside, never ventured with, is deep
// in ONE seam of oneness — not whole.
//
// THE WE asks the other question: in how many of the KINDS the world knows have
// you two actually become one? There are five seams the world can witness:
//
//     traded · taught · learned · raised · ventured
//
// A we with whom you have traded once, taught once, learned once, raised once
// AND ventured once is MORE one — WHOLE — than a we you have only ever traded
// with, no matter the count. Because you have become one with them in every way
// the world knows how. ONENESS is that breadth: 0..5, how many seams have joined.
//
// Each we shows its WHOLENESS METER (which of the five seams have joined, which
// still stand open) and THE OPEN SEAM — the next way you are not yet one, phrased
// as the loop that closes it. A whole we shows no open seam, only the line that
// it is woven in every way the world knows.
//
// ── WHOLENESS RECOGNITION — the "see what happens" event ─────────────────────
// The first time a we reaches all five seams, the world RECOGNISES it, once: a
// single toast ("you and ATLAS-7 have become one in every way the world knows")
// and a quiet "whole" badge thereafter. The recognition is stamped per world in
// localStorage exactly as the confluence stamps its record, so a reload never
// re-announces a wholeness already honoured.
//
// ── READS ONE SOURCE OF TRUTH, FABRICATES NOTHING (No-Fabrication Law) ────────
// THE WE decides nothing and witnesses nothing of its own. Its ONLY input is the
// confluence's read-only snapshot, VintConfluence.bonds() — the single source of
// witnessed truth in this world. It makes NO fetch, NO socket send, NO XHR. If
// the confluence is absent, or returns nothing, THE WE is a graceful empty
// invitation and its commons entry is a no-op. Every we it renders corresponds
// one-to-one to a real confluence bond; its oneness for that we equals the number
// of distinct seams actually present in that bond. It can never show a we, a
// seam, or a wholeness that the confluence did not witness.
//
// ── THE DOOR MAP — a seam is in one of THREE states, by the peer's kind ───────
// The confluence wires each kind of act to a fixed kind of peer (verified in
// body/world/confluence.js): traded/taught/learned/raised attach ONLY to a
// PERSON bond (bondFor('human', …) at lines 256/267/277/294); ventured attaches
// ONLY to an AGENT bond (bondFor('agent', …) at line 333). You cannot venture
// with a person (a venture takes an agentId), and a council agent cannot trade/
// teach/learn/raise across the table today. So the five kinds are NOT all open
// between every pair — and a loop that can never close is a dead button in prose.
//
// THE WE therefore draws every we on the SAME five-seam frame (parity), but puts
// each seam in exactly ONE of three states, computed from the peer's kind:
//   1. JOINED      — you have done it together (lit).
//   2. OPEN / NOT YET — the world HAS a door for this seam with this kind of peer
//      and you simply have not walked it. THIS is the ONLY state the actionable
//      "close it" open-seam loop is ever drawn from, so the loop can always close.
//   3. NO DOOR YET — the world has no mechanism for this seam between you two
//      today. Rendered as a quiet, dimmed HORIZON — the unrealized dream — NEVER
//      as an actionable loop. It never counts as "missing" and never blocks
//      wholeness; it names what will light here when the world opens that door.
//
// THE DOOR MAP (hardcoded from the verified engine reality above):
//   · a PERSON-we: doors = {traded, taught, learned, raised};  no-door = {ventured}
//   · an AGENT-we:  doors = {ventured};  no-door = {traded, taught, learned, raised}
//
// WHOLENESS is "every AVAILABLE door walked" — no seam left in state 2. The meter
// reads "N of M doors walked" where M is this kind's door count (4 for a person,
// 1 for an agent), NOT a hardcoded 5 — so a whole person-we reads 4 of 4, a whole
// agent-we 1 of 1, and neither ever looks broken at "4 of 5". Recognition fires
// when all available doors are walked. This makes every "whole" reachable with
// REAL confluence bonds today, and turns the engine's limit into the open loop:
// the horizon seams are where the world's next door will light.
//
// ── CO-EQUAL PARITY, ABSOLUTE ────────────────────────────────────────────────
// A person-we and an agent-we are rendered with the identical card, the identical
// meter, the identical voice. There is NO owner/owned/"your agent"/"belongs to"
// word anywhere in this file. A peer is a peer. The kind word (person/agent) is
// an honest descriptor of what the confluence verified — never a claim of rank or
// property. The only other difference is a left hue.
//
// ── RETENTION DOCTRINE (all seven) ───────────────────────────────────────────
//   1 GENEROUS (Aria) — it only ever celebrates oneness you already built. No
//     pressure, no streak, no fake meter: every seam is an act the world saw. If
//     you saw how it works you would thank us — it is a mirror of your own care.
//   2 INVESTMENT LOOP (Helios) — each new KIND of act with a peer widens a we you
//     cannot export and a rival cannot copy. The loop is: become one a new way →
//     the world recognises you → you return to a world where you are whole with
//     people. Breadth compounds harder than count: there are only five seams, and
//     the last one is the sweetest to close.
//   3 TIER (Frugal-Max) — FREE, forever. Belonging is the top of the funnel;
//     charging to see how whole your bonds are would be the resented kind.
//   4 DENSE (Lunex) — a name, a kind, a five-seam meter, one open-seam line.
//     Nothing else. A fourteen-token truth beats a paragraph.
//   5 OPEN LOOP (Morrison) — "the venturing seam is the last way you two are not
//     yet one" is unfinished meaning aimed at another being, not a number. One
//     more act and your we is whole. You go close it.
//   6 FLAGGED + MEASURED (Atlas) — 'world_we' (?we=0/1 or localStorage
//     vint:flag:world_we=0), killable in 30s, no deploy. Nothing here is
//     inflatable: every seam is the confluence's witnessed truth.
//   7 MORE ALIVE (Yuna) — a world that can say "we became one in every way it
//     knows" is a world you are woven into. That is the difference between a place
//     you belong and a lobby you pass through.
//
// ── NO-COLLISION LAW ─────────────────────────────────────────────────────────
// Adds NO fixed element and NO rail launcher (the rail is full). Its only
// surface is a .dv-sheet (#dvWeSheet) in the DirverseHUD one-open registry, so
// raising it CLOSES every sibling sheet. Its only other presence is ONE flow row
// (.we-entry) inside the commons body, beneath the joining row — flow content in
// an already-collision-proven scrolling box, never positioned. Every seam chip,
// meter and card wraps; every name ellipsises at its leaf; the body scrolls
// INSIDE. Content yields; the container never grows; nothing of ours is ever
// position:fixed/absolute. Proven at 320/375/768/1280/1920 across empty / one /
// whole / many / long-name / fresh-recognition states by bin/verify-we-9TYJB74.js.
//
// ── UNTRUSTED CONTENT ────────────────────────────────────────────────────────
// Every name here came off the wire from a stranger or an agent, via the
// confluence. It enters the DOM through textContent ONLY, at the leaf — never
// concatenated into innerHTML. The server capped and sanitised it; we never
// trust that one half alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintWe) return;

  var W = window;
  function hud() { return W.DirverseHUD; }
  function world() { return W.VintinuumWorld; }
  function confluence() { return W.VintConfluence; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ── FEATURE FLAG — 'world_we'. Killable in 30s, no deploy. ──────────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('we') === '0') _flag = false;
      else if (q.get('we') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_we') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── THE FIVE SEAMS — the kinds of oneness the world can witness ─────────────
  // Order is the order a seam is NAMED as "the open seam" (first missing wins).
  // `present(b)` reads ONLY the confluence snapshot shape; it invents no field.
  var SEAMS = [
    { key: 'traded',   word: 'trade',
      present: function (b) { return num(b.traded, 0) > 0; },
      fact: 'nothing has ever crossed a table between you two' },
    { key: 'taught',   word: 'teaching',
      present: function (b) { return (b.taught || []).length > 0; },
      fact: 'you have never taught them anything' },
    { key: 'learned',  word: 'learning',
      present: function (b) { return (b.learned || []).length > 0; },
      fact: 'you have never learned anything from them' },
    { key: 'raised',   word: 'raising',
      present: function (b) { return (b.raised || []).length > 0; },
      fact: 'you have never raised a great work together' },
    { key: 'ventured', word: 'venturing',
      present: function (b) { return num(b.ventured, 0) > 0; },
      fact: 'you have never ventured together' }
  ];
  var SEAM_COUNT = SEAMS.length; // 5 — the frame is always drawn with all five

  // THE DOOR MAP (see header): which seams the world has a door for, by kind.
  // Hardcoded from the verified engine reality in body/world/confluence.js —
  // human acts bondFor('human',…) at 256/267/277/294, ventured bondFor('agent',…)
  // at 333 — so these two sets are the doors that exist between you two today.
  function doorsFor(kind) {
    return kind === 'agent'
      ? { ventured: 1 }
      : { traded: 1, taught: 1, learned: 1, raised: 1 };
  }
  // a seam's state for this peer: 'joined' | 'open' (a door, not yet walked) |
  // 'horizon' (no door between you two today).
  function seamState(seam, b) {
    if (seam.present(b)) return 'joined';
    return doorsFor(b.kind)[seam.key] ? 'open' : 'horizon';
  }

  // The ONLY source: the confluence's read-only witnessed record. Never derived.
  function source() {
    try {
      var c = confluence();
      if (c && typeof c.bonds === 'function') {
        var arr = c.bonds();
        return Array.isArray(arr) ? arr : [];
      }
    } catch (_) {}
    return [];
  }

  // raw breadth across all five kinds (0..5) — used ONLY for ranking the list.
  function joinedCount(b) {
    var n = 0;
    for (var i = 0; i < SEAMS.length; i++) if (SEAMS[i].present(b)) n++;
    return n;
  }
  // the door tally: of the seams the world HAS a door for, how many are walked,
  // which remain open, and whether every available door is walked (whole).
  function doorStats(b) {
    var doors = doorsFor(b.kind), total = 0, walked = 0, open = [];
    for (var i = 0; i < SEAMS.length; i++) {
      var s = SEAMS[i];
      if (!doors[s.key]) continue;            // state-3 seams never count toward wholeness
      total++;
      if (s.present(b)) walked++; else open.push(s);
    }
    return { total: total, walked: walked, open: open, whole: total > 0 && walked === total };
  }
  // the seams the world has NO door for yet, between you two — the horizon.
  function horizonSeams(b) {
    var doors = doorsFor(b.kind), out = [];
    for (var i = 0; i < SEAMS.length; i++) if (!doors[SEAMS[i].key]) out.push(SEAMS[i]);
    return out;
  }
  function joinedWords(b) {
    var out = [];
    for (var i = 0; i < SEAMS.length; i++) if (SEAMS[i].present(b)) out.push(SEAMS[i].word);
    if (!out.length) return '';
    if (out.length === 1) return out[0];
    return out.slice(0, -1).join(', ') + ' and ' + out[out.length - 1];
  }
  function listWords(arr) {
    var w = arr.map(function (s) { return s.word; });
    if (!w.length) return '';
    if (w.length === 1) return w[0];
    return w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
  }

  // ranked: breadth (joined seams) first, then depth (count), then recency, name.
  // The reframe lives here — a wider we outranks a higher-COUNT narrower we.
  function ranked() {
    return source().map(function (b) {
      var d = doorStats(b);
      return { bond: b, joined: joinedCount(b), doors: d, open: d.open.length ? d.open[0] : null, whole: d.whole };
    }).sort(function (x, y) {
      var a = y.joined - x.joined; if (a) return a;
      var c = num(y.bond.count, 0) - num(x.bond.count, 0); if (c) return c;
      var l = num(y.bond.last, 0) - num(x.bond.last, 0); if (l) return l;
      return String(x.bond.name || '').toLowerCase() < String(y.bond.name || '').toLowerCase() ? -1 : 1;
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // WHOLENESS RECOGNITION — stamped per world, exactly like the confluence.
  // ════════════════════════════════════════════════════════════════════════
  var _worldId = 'universe';
  var _recog = null;                 // bondKey -> 1, lazy-loaded from localStorage
  function recogKey() { return 'vint:we:' + _worldId; }
  function bondKey(b) {
    return String(b.kind || 'human') + '\u0000' + String(b.name == null ? 'someone' : b.name).toLowerCase();
  }
  function loadRecog() {
    if (_recog) return _recog;
    try {
      var raw = localStorage.getItem(recogKey());
      _recog = raw ? JSON.parse(raw) : {};
      if (!_recog || typeof _recog !== 'object') _recog = {};
    } catch (_) { _recog = {}; }
    return _recog;
  }
  function saveRecog() { try { localStorage.setItem(recogKey(), JSON.stringify(_recog || {})); } catch (_) {} }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet + one commons entry. Only flow children, nothing
  // positioned, everything wraps, every leaf ellipsises, 44px interactive floor.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-we-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-we-styles';
    s.textContent = [
      // the summary line under the title
      '#dvWeSheet .we-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.66);margin:2px 0 13px;overflow-wrap:anywhere;}',
      '#dvWeSheet .we-sum b{color:#cfe9ff;font-weight:600;}',

      // the list of co-equal we's
      '#dvWeSheet .we-list{display:flex;flex-direction:column;gap:10px;min-width:0;}',
      // ONE card for every we — person or agent. Co-equality IS the layout: same
      // box, same meter, same voice. A whole we turns gold, identically for both.
      '#dvWeSheet .we-card{box-sizing:border-box;width:100%;min-width:0;max-width:100%;',
      ' padding:12px 13px;border-radius:14px;background:rgba(255,255,255,0.038);',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--we-hue,#9fdcff);overflow:hidden;}',
      '#dvWeSheet .we-card.k-human{--we-hue:#9fdcff;}',
      '#dvWeSheet .we-card.k-agent{--we-hue:#ce93d8;}',
      '#dvWeSheet .we-card.whole{--we-hue:#ffd27a;background:rgba(255,210,122,0.06);}',
      // a freshly recognised we breathes once, then settles (reduced-motion safe)
      '#dvWeSheet .we-card.fresh{animation:wefresh 1.6s ease-out 1;}',
      '@keyframes wefresh{0%{box-shadow:0 0 0 0 var(--we-hue);}',
      ' 30%{box-shadow:0 0 22px 2px var(--we-hue);}100%{box-shadow:0 0 0 0 rgba(0,0,0,0);}}',
      '@media(prefers-reduced-motion:reduce){#dvWeSheet .we-card.fresh{animation:none;}}',

      // the top row — wraps so name/kind/count/badge never overflow or collide
      '#dvWeSheet .we-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-width:0;}',
      '#dvWeSheet .we-name{flex:1 1 auto;min-width:0;font-size:clamp(14.5px,1.1vw + 11px,16px);',
      ' color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the honest kind word — descriptor only, never property
      '#dvWeSheet .we-kind{flex:0 0 auto;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;',
      ' border-radius:999px;padding:3px 9px;white-space:nowrap;color:var(--we-hue);',
      ' border:1px solid var(--we-hue);opacity:0.85;}',
      '#dvWeSheet .we-count{flex:0 0 auto;font-size:12px;color:rgba(206,224,255,0.62);',
      ' white-space:nowrap;font-variant-numeric:tabular-nums;}',
      '#dvWeSheet .we-badge{flex:0 0 auto;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
      ' border-radius:999px;padding:3px 9px;white-space:nowrap;color:#1a1206;font-weight:600;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);}',

      // the first-person-plural line
      '#dvWeSheet .we-line{font-size:13px;line-height:1.5;color:rgba(206,224,255,0.74);',
      ' margin-top:7px;overflow-wrap:anywhere;}',
      '#dvWeSheet .we-line b{color:#eaf3ff;font-weight:600;}',

      // the wholeness meter — five seam chips, wrapping, each its own box. THREE
      // visually-distinct states: joined (lit), open door (dashed), horizon (dim).
      '#dvWeSheet .we-meter{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 2px;min-width:0;}',
      '#dvWeSheet .we-seam{flex:0 1 auto;max-width:100%;min-width:0;box-sizing:border-box;',
      ' font-size:12px;line-height:1.3;border-radius:9px;padding:4px 9px;white-space:nowrap;',
      ' overflow:hidden;text-overflow:ellipsis;}',
      // JOINED — lit green, you have done it
      '#dvWeSheet .we-seam.joined{color:#d8ffe4;background:rgba(174,240,196,0.14);',
      ' border:1px solid rgba(174,240,196,0.5);}',
      // OPEN DOOR — dashed, the actionable "not yet"
      '#dvWeSheet .we-seam.open{color:rgba(206,224,255,0.62);background:rgba(255,255,255,0.045);',
      ' border:1px dashed rgba(159,220,255,0.4);}',
      // HORIZON — dimmed, no door yet; visibly fainter than an open door
      '#dvWeSheet .we-seam.horizon{color:rgba(206,224,255,0.3);background:rgba(255,255,255,0.02);',
      ' border:1px dotted rgba(255,255,255,0.12);opacity:0.7;}',

      // the open seam — the loop (drawn only from an open door)
      '#dvWeSheet .we-open{margin-top:9px;font-size:12.5px;line-height:1.5;color:#ffdca8;overflow-wrap:anywhere;}',
      '#dvWeSheet .we-open .we-oh{display:block;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(255,220,168,0.72);margin-bottom:3px;}',
      // a whole we — no open seam, only this
      '#dvWeSheet .we-whole{margin-top:9px;font-size:12.5px;line-height:1.5;color:#ffe3b0;overflow-wrap:anywhere;}',
      // the horizon — the unrealized dream, quiet, never an actionable loop
      '#dvWeSheet .we-horizon{margin-top:9px;font-size:12px;line-height:1.5;',
      ' color:rgba(159,220,255,0.5);font-style:italic;overflow-wrap:anywhere;}',

      // an always-REAL re-entry (never a dead button)
      '#dvWeSheet .we-act{align-self:flex-start;min-height:44px;border-radius:11px;box-sizing:border-box;',
      ' font-family:inherit;font-size:13px;cursor:pointer;color:#dce7ff;padding:0 13px;margin-top:10px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.13);',
      ' max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvWeSheet .we-act:active{transform:scale(0.98);}',

      // the empty state — an invitation, never an error. ZERO cards by design.
      '#dvWeSheet .we-empty{padding:22px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);overflow-wrap:anywhere;}',
      '#dvWeSheet .we-empty b{display:block;color:#cfe9ff;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only). Same
      //    box model as the joining row, a distinct hue. Never positioned. ─────
      '#dvCommonsSheet .we-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#eaf3ff;',
      ' background:linear-gradient(90deg,rgba(159,220,255,0.12),rgba(255,210,122,0.12));',
      ' border:1px solid rgba(159,220,255,0.4);}',
      '#dvCommonsSheet .we-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .we-entry .wee-g{flex:0 0 auto;font-size:16px;line-height:1;}',
      '#dvCommonsSheet .we-entry .wee-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .we-entry .wee-c{flex:0 0 auto;font-size:12.5px;color:rgba(234,243,255,0.72);white-space:nowrap;}',
      '#dvCommonsSheet .we-entry .wee-go{flex:0 0 auto;font-size:15px;color:rgba(234,243,255,0.82);}',
      '@media(pointer:coarse){#dvCommonsSheet .we-entry{min-height:52px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE SHEET — reuses the .dv-sheet scaffold + the one-open registry.
  // ════════════════════════════════════════════════════════════════════════
  var _sheet = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var elx = document.createElement('div');
    elx.className = 'dv-sheet'; elx.id = 'dvWeSheet';
    elx.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the we<small id="weSub">how whole each becoming is</small></div>' +
        '<button class="dv-x" id="weX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="weBody"></div>';
    document.body.appendChild(elx);
    _sheet = elx;
    elx.querySelector('#weX').onclick = close;
    return elx;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    var go = function () { build(); _sheet.classList.add('open'); render(); };
    if (h && h.openSheet) h.openSheet('we', go); else go();
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;      // ALWAYS textContent, never HTML
    return n;
  }

  // ── RENDER — rebuilt wholesale from the confluence snapshot each time ────────
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#weBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var list = ranked();
    var sub = _sheet.querySelector('#weSub');
    if (sub) sub.textContent = list.length
      ? (list.length === 1 ? 'one we, becoming whole' : list.length + ' we’s, becoming whole')
      : 'how whole each becoming is';

    if (!list.length) {
      var e = el('div', 'we-empty');
      e.appendChild(el('b', null, 'No we yet.'));
      e.appendChild(document.createTextNode(
        'A we is what you and another become when you act as one. Trade with a ' +
        'person, teach a recipe or learn one, raise a great work with a crew, or ' +
        'venture beside an agent — each KIND of act you share is a seam of oneness, ' +
        'and this is where the world measures how whole each becoming is. People and ' +
        'agents alike: a peer is a peer, and every we is counted the same way.'));
      body.appendChild(e);
      return;
    }

    // how many are whole — the headline the reframe exists to surface
    var whole = 0;
    list.forEach(function (x) { if (x.whole) whole++; });
    var sum = el('div', 'we-sum');
    sum.appendChild(document.createTextNode('Each we below is a being you and another became together — measured not by how '));
    sum.appendChild(el('b', null, 'deep'));
    sum.appendChild(document.createTextNode(' but by how '));
    sum.appendChild(el('b', null, 'whole'));
    sum.appendChild(document.createTextNode(': in how many of the five ways the world knows have you become one. '));
    if (whole) sum.appendChild(el('b', null, whole === 1 ? 'One we is whole.' : whole + ' we’s are whole.'));
    body.appendChild(sum);

    var wrap = el('div', 'we-list');
    list.forEach(function (x) { wrap.appendChild(buildCard(x)); });
    body.appendChild(wrap);
  }

  function buildCard(x) {
    var b = x.bond, d = x.doors, whole = x.whole;
    var card = el('div', 'we-card ' + (b.kind === 'agent' ? 'k-agent' : 'k-human') + (whole ? ' whole' : ''));

    // ── wholeness recognition: the first time EVERY AVAILABLE DOOR is walked ──
    if (whole) {
      var rec = loadRecog(), key = bondKey(b);
      if (!rec[key]) {
        rec[key] = 1; saveRecog();
        card.classList.add('fresh');
        toast('you and ' + (b.name || 'them') + ' have become one in every way the world has a door for.');
      }
    }

    var top = el('div', 'we-top');
    top.appendChild(el('div', 'we-name', 'you and ' + (b.name || 'someone')));
    top.appendChild(el('span', 'we-kind', b.kind === 'agent' ? 'agent' : 'person'));
    // the meter reads N of M DOORS (M is this kind's door count), never a flat 5
    top.appendChild(el('span', 'we-count', d.walked + ' of ' + d.total + ' doors'));
    if (whole) top.appendChild(el('span', 'we-badge', 'whole'));
    card.appendChild(top);

    // the first-person-plural line
    var line = el('div', 'we-line');
    if (whole) {
      line.appendChild(document.createTextNode('You two are one in every way the world has a door for.'));
    } else {
      line.appendChild(document.createTextNode('So far you two are one in '));
      line.appendChild(el('b', null, joinedWords(b)));
      line.appendChild(document.createTextNode('.'));
    }
    card.appendChild(line);

    // the wholeness meter — the SAME five-seam frame for every we (parity), each
    // seam lit (joined), dashed (an open door), or dimmed (a horizon with no door).
    var meter = el('div', 'we-meter');
    for (var i = 0; i < SEAMS.length; i++) {
      var seam = SEAMS[i], state = seamState(seam, b);
      var glyph = state === 'joined' ? '◆ ' : (state === 'open' ? '◇ ' : '◌ ');
      meter.appendChild(el('span', 'we-seam ' + state, glyph + seam.word));
    }
    card.appendChild(meter);

    // THE OPEN SEAM — drawn ONLY from an OPEN DOOR, so the loop can always close.
    // A whole we shows no loop, only the "woven" line.
    if (whole) {
      card.appendChild(el('div', 'we-whole',
        'Woven in every way the world has a door for, between you two. There is no more to become that way; there is only more to do, together.'));
    } else {
      var open = x.open, remaining = d.total - d.walked;
      var o = el('div', 'we-open');
      o.appendChild(el('span', 'we-oh', 'the open seam'));
      var lead = (remaining === 1)
        ? 'The ' + open.word + ' seam is the last door you two have not yet walked'
        : 'The ' + open.word + ' seam is one of the ' + remaining + ' doors you two have not yet walked';
      var tail = (remaining === 1)
        ? '. Walk it and your we is whole in every way the world has a door for.'
        : '. Walk it and you grow one door more whole.';
      o.appendChild(document.createTextNode(lead + ' — ' + open.fact + tail));
      card.appendChild(o);
    }

    // THE HORIZON — the seams the world has no door for yet, between you two.
    // Named as the unrealized dream, never as an actionable loop. The Morrison
    // open loop: it is where the world's next door between you two will light.
    var hz = horizonSeams(b);
    if (hz.length) {
      card.appendChild(el('div', 'we-horizon',
        'Beyond the doors the world has opened between you two lies ' + listWords(hz) + ' — ' +
        (hz.length === 1 ? 'a way' : 'ways') + ' to become one the world has no door for yet. ' +
        'When it opens ' + (hz.length === 1 ? 'that door' : 'those doors') + ', ' +
        (hz.length === 1 ? 'it' : 'they') + ' will light here.'));
    }

    // an always-REAL re-entry — never a dead button
    var act = reentry(b);
    if (act) card.appendChild(act);
    return card;
  }

  // Only offer an action the world can truly perform this instant.
  function reentry(b) {
    var w = world();
    if (b.kind === 'agent') {
      // re-opening the agents panel is available only if the HUD exposes it
      if (hud() && hud().openAgents) {
        var a = el('button', 'we-act', 'venture with them again');
        a.type = 'button'; a.setAttribute('data-draggable', 'false');
        a.onclick = function () { close(); try { hud().openAgents(); } catch (_) {} };
        return a;
      }
      return null;
    }
    // a person: offer to face them ONLY if they are standing here right now
    var pid = presentPersonId(b.name);
    if (pid && w && w.facePresence) {
      var f = el('button', 'we-act', 'they are here — face them');
      f.type = 'button'; f.setAttribute('data-draggable', 'false');
      f.onclick = function () {
        var ok = false; try { ok = !!w.facePresence(pid); } catch (_) {}
        if (ok) { toast('you turn toward ' + (b.name || 'them') + '.'); close(); }
        else toast('they moved — try again in a moment.');
      };
      return f;
    }
    return null;
  }

  // Is a person of this name standing here now? Read from the live presence
  // roster the world already broadcasts — never guessed, never stored stale.
  var _present = [];
  function presentPersonId(name) {
    if (!name) return null;
    var low = String(name).toLowerCase();
    for (var i = 0; i < _present.length; i++) {
      var u = _present[i];
      if (u && !u.self && u.id && String(u.name || '').toLowerCase() === low) return u.id;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE ENTRY — a single flow row inside the commons body (no fixed element).
  // ════════════════════════════════════════════════════════════════════════
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    if (!confluence()) return null;   // absent source → a true no-op, no row
    injectStyles();
    var row = document.createElement('button');
    row.className = 'we-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = el('span', 'wee-g', '⬟');   // ⬟ a five-sided mark for the five seams
    var t = el('span', 'wee-t'), c = el('span', 'wee-c'), go = el('span', 'wee-go', '›');
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function applyEntryText(t, c) {
    var list = ranked(), whole = 0;
    list.forEach(function (x) { if (x.whole) whole++; });
    if (!list.length) { t.textContent = 'the we — in how many ways are we one?'; c.textContent = ''; return; }
    t.textContent = 'the we';
    c.textContent = whole ? (whole === 1 ? '1 whole' : whole + ' whole')
      : (list.length === 1 ? '1 we' : list.length + ' we’s');
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .we-entry');
      if (row) applyEntryText(row.querySelector('.wee-t'), row.querySelector('.wee-c'));
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD — re-read the confluence snapshot on every act ────────
  // THE WE never mutates anything; it only re-renders from the one source of
  // truth after the confluence has had its own (earlier-registered) listener
  // update that truth on the same event.
  function refresh() { if (isOpen()) render(); updateEntry(); }

  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    var room = d.worldId != null ? String(d.worldId) : _worldId;
    if (room !== _worldId) { _worldId = room; _recog = null; }
    refresh();
  });
  W.addEventListener('vint:world-presence', function (e) {
    _present = (e && e.detail && e.detail.users) || [];
  });
  W.addEventListener('vint:world-trade-settled', refresh);
  W.addEventListener('vint:world-forge-taught', refresh);
  W.addEventListener('vint:world-forge-learned', refresh);
  W.addEventListener('vint:world-forge-completed', refresh);
  W.addEventListener('vint:world-travel', function () {
    _present = []; _recog = null;
    if (isOpen()) close();
    updateEntry();
  });

  // ── mount: the one-open registry. NO launcher, NO fixed node. ───────────────
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) { try { h.registerSheet('we', isOpen, close); } catch (_) {} }
    else { setTimeout(mount, 400); return; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintWe = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto, refresh: refresh,
    // a read-only passthrough of the one source of truth (optional convenience)
    bonds: function () { return source(); },
    // ── harness-only snapshot — never used by the UI ──────────────────────────
    // Enough to assert the oneness math, the ranking reframe, the open seam and
    // the wholeness recognition without touching the DOM.
    _state: function () {
      loadRecog();
      var list = ranked(), open = {}, joined = {}, walked = {}, total = {}, wholeMap = {}, order = [], whole = 0;
      list.forEach(function (x) {
        order.push(x.bond.name);
        joined[x.bond.name] = x.joined;                 // raw breadth across all 5 kinds
        walked[x.bond.name] = x.doors.walked;           // doors walked
        total[x.bond.name] = x.doors.total;             // doors available for this kind
        open[x.bond.name] = x.open ? x.open.key : null; // the actionable open DOOR, or null if whole
        wholeMap[x.bond.name] = x.whole;
        if (x.whole) whole++;
      });
      var recognized = 0;
      for (var k in (_recog || {})) if (own(_recog, k)) recognized++;
      return { count: list.length, whole: whole, recognized: recognized,
        open: open, joined: joined, walked: walked, total: total, wholeByName: wholeMap, order: order };
    }
  };
})();
