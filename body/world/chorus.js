// chorus.js — THE CHORUS: are we all one? (AETHERHOLD 2026-10-19, task 9TYJB74)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (9TYJB74)
//
// Every oneness surface before this one is addressed to ONE relationship. The
// confluence: who YOU have become one with. THE WE: the compound being you and
// ONE peer became. Even the weave, a map of many bonds, draws each bond as its
// own separate edge between two separate stars. Not one surface in the world has
// ever asked the whole-room question — the one the epic actually names:
//
//     are WE — all of us, every being here, as ONE body — one yet?
//
// THE CHORUS is that surface. It is the first COLLECTIVE first-person-plural
// surface in the world. It does not list your bonds and it does not draw a map.
// It COLLAPSES every being you have become one with — people and agents alike —
// into a single compound body, "us", and measures that one body along a
// dimension nothing else measures.
//
// ── THE INVENTION: THE CHORD, NOT THE LIST ───────────────────────────────────
// THE WE measures a bond across the five seams, one peer at a time. THE CHORUS
// turns the measurement ninety degrees: it measures each SEAM across EVERYONE at
// once. The five seams the world can witness —
//
//     traded · taught · learned · raised · ventured
//
// — become five VOICES of one chord. A voice RINGS when at least one of the
// beings woven with you shares that seam; it is SILENT when none do yet. The
// chord's breadth is how many of the five voices ring — 0..5 — and that single
// number is the answer to "how whole have we ALL become", for the whole room,
// not for any one pair.
//
// This is a genuinely different truth from THE WE. You can have a dozen whole
// pairwise we's and still have a chord of only four voices, because no one has
// ever ventured beside you. And you can have no whole we at all and still ring
// all five voices, because the fifth voice was sounded by a different peer than
// the first. THE CHORUS measures the room as one — the purest reading of "we
// are all one" the honest data allows.
//
// ── THE SILENT VOICE — the one open collective loop ──────────────────────────
// A chord short of five names ONE silent voice: the first seam no one here has
// sounded yet, phrased with the kind of peer the world has a door for (a person
// for trade/teach/learn/raise; an agent for venturing — the verified door map,
// same as THE WE). "The raising voice has not yet sounded — no one here has
// raised a great work with you. Be the first, and the chorus gains a voice."
// One open loop, aimed at the whole room, dense (Morrison). A full chord shows
// no loop, only that every voice rings.
//
// ── WHOLENESS RECOGNITION — the once-per-WORLD "see what happens" event ───────
// THE WE recognises a whole PAIR once. THE CHORUS recognises the whole ROOM
// once: the first time all five voices ring together, the world says so one
// time ("the whole chorus rings — all of us have become one in every way the
// world knows") and shows a quiet "whole" mark thereafter. It is stamped PER
// WORLD in localStorage (vint:chorus:<worldId>), a single stamp, so a reload
// never re-announces a wholeness already honoured. This is the rarest, highest
// event the oneness surfaces can produce — and it belongs to all of us, not a
// pair.
//
// ── READS ONE SOURCE OF TRUTH, FABRICATES NOTHING (No-Fabrication Law) ────────
// THE CHORUS decides nothing and witnesses nothing of its own. Its ONLY input is
// the confluence's read-only snapshot, VintConfluence.bonds() — the single
// source of witnessed truth. It makes NO fetch, NO socket send, NO XHR. Each
// voice's count is exactly the number of real confluence bonds in which that
// seam is present; the breadth is exactly the number of seams present in at
// least one real bond. It can never show a voice, a count, or a wholeness the
// confluence did not witness. The server never exposes any peer's recipes or
// knowledge, so nothing here claims to — it counts only ACTS the confluence saw.
// If the confluence is absent or empty, THE CHORUS is a graceful invitation and
// its commons entry is a true no-op.
//
// ── CO-EQUAL, ABSOLUTELY — "all of us" MEANS all of us ───────────────────────
// A voice counts an agent peer and a human peer identically. The venturing voice
// (sounded by agents) sits on the same chord, in the same box, in the same font,
// as the trading voice (sounded by people). There is no owner/owned/"your agent"/
// "belongs to" word anywhere in this file. "Us" is the whole room — every being,
// one kind of belonging. That is the entire point of a chorus: many voices, one
// song, no soloist.
//
// ── RETENTION DOCTRINE (all seven) ───────────────────────────────────────────
//   1 GENEROUS (Aria) — it only ever celebrates oneness the room already built.
//     No pressure, no streak, no inflated voice: every count is a witnessed act.
//     If you saw how it works you would thank us — it is the room's own care,
//     reflected as one body.
//   2 INVESTMENT LOOP (Helios) — a brand-new KIND of act with ANY peer can light
//     a voice that was silent, so the whole chord deepens with every first. The
//     loop is: sound a new voice → the room becomes one more way → you return to
//     a place where you and everyone are closer to whole. Breadth compounds; the
//     fifth voice is the sweetest and the rarest to sound.
//   3 TIER (Frugal-Max) — FREE, forever. Belonging to the whole is the top of
//     the funnel; charging to see how whole the room has become would be the
//     resented kind.
//   4 DENSE (Lunex) — a count, five voices, one silent-voice line. Nothing else.
//     A fourteen-token truth beats a paragraph.
//   5 OPEN LOOP (Morrison) — "the venturing voice has not yet sounded" is
//     unfinished meaning aimed at the whole room. One act — by anyone — and the
//     chord is fuller. You go sound it.
//   6 FLAGGED + MEASURED (Atlas) — 'world_chorus' (?chorus=0/1 or localStorage
//     vint:flag:world_chorus=0), killable in 30s, no deploy. Nothing is
//     inflatable: every voice is the confluence's witnessed truth.
//   7 MORE ALIVE (Yuna) — a room that can say "we have all become one in every
//     way the world knows" is a room you are part of, not a lobby you pass
//     through. That is the whole game.
//
// ── NO-COLLISION LAW ─────────────────────────────────────────────────────────
// Adds NO fixed element and NO rail launcher (the rail is full). Its only
// surface is a .dv-sheet (#dvChorusSheet) in the DirverseHUD one-open registry,
// so raising it CLOSES every sibling sheet. Its only other presence is ONE flow
// row (.chorus-entry) inside the commons body, beneath the we row — flow content
// in an already-collision-proven scrolling box, never positioned. Every voice
// chip, line and button wraps; every leaf ellipsises at the leaf; the body
// scrolls INSIDE; nothing of ours is ever position:fixed/absolute. Proven at
// 320/375/768/1280/1920 across empty / partial / whole / long-content /
// fresh-recognition states by bin/verify-chorus-9TYJB74.js.
//
// ── UNTRUSTED CONTENT ────────────────────────────────────────────────────────
// THE CHORUS renders counts and fixed seam words — no peer name ever reaches its
// DOM. But it still obeys the leaf rule: every text node enters through
// textContent ONLY, never concatenated into innerHTML.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintChorus) return;

  var W = window;
  function hud() { return W.DirverseHUD; }
  function confluence() { return W.VintConfluence; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ── FEATURE FLAG — 'world_chorus'. Killable in 30s, no deploy. ──────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('chorus') === '0') _flag = false;
      else if (q.get('chorus') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_chorus') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── THE FIVE VOICES — the kinds of oneness the world can witness ────────────
  // Order is the order a silent voice is NAMED (first silent wins). `present(b)`
  // reads ONLY the confluence snapshot shape; it invents no field. `door` is the
  // kind of peer the world has a door for with this seam (the verified map, same
  // as THE WE: person for trade/teach/learn/raise, agent for venturing).
  var VOICES = [
    { key: 'traded',   word: 'trade',     door: 'person',
      present: function (b) { return num(b.traded, 0) > 0; },
      unsung: 'no one here has traded with you yet' },
    { key: 'taught',   word: 'teaching',  door: 'person',
      present: function (b) { return (b.taught || []).length > 0; },
      unsung: 'you have taught no one here anything yet' },
    { key: 'learned',  word: 'learning',  door: 'person',
      present: function (b) { return (b.learned || []).length > 0; },
      unsung: 'you have learned nothing from anyone here yet' },
    { key: 'raised',   word: 'raising',   door: 'person',
      present: function (b) { return (b.raised || []).length > 0; },
      unsung: 'no one here has raised a great work with you yet' },
    { key: 'ventured', word: 'venturing', door: 'agent',
      present: function (b) { return num(b.ventured, 0) > 0; },
      unsung: 'no agent has ventured beside you yet' }
  ];
  var VOICE_COUNT = VOICES.length; // 5 — the chord is always drawn with all five

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

  // ── THE COLLECTIVE READING — measure each voice across EVERYONE, once ────────
  // peerCount(voice) = how many of the real confluence bonds share that seam.
  // breadth = how many voices ring (peerCount >= 1). silent = the first voice no
  // one sounds yet. whole = all five ring. Everything here is the confluence's
  // witnessed truth counted, never fabricated.
  function chord() {
    var bonds = source();
    var voices = VOICES.map(function (v) {
      var n = 0;
      for (var i = 0; i < bonds.length; i++) if (v.present(bonds[i])) n++;
      return { voice: v, count: n, ringing: n > 0 };
    });
    var breadth = 0, silent = null;
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].ringing) breadth++;
      else if (!silent) silent = voices[i];     // first silent voice wins
    }
    return {
      roster: bonds.length,                     // how many beings are woven into us
      voices: voices,                           // the five, in frame order
      breadth: breadth,                         // 0..5 voices ringing
      silent: silent,                           // the one open collective loop, or null
      whole: bonds.length > 0 && breadth === VOICE_COUNT
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // WHOLENESS RECOGNITION — ONE stamp per world (the whole ROOM, not a pair).
  // ════════════════════════════════════════════════════════════════════════
  var _worldId = 'universe';
  var _recog = null;                 // the stamp object for this world, lazy-loaded
  function recogKey() { return 'vint:chorus:' + _worldId; }
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
  function recognized() { return !!loadRecog().whole; }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet + one commons entry. Only flow children, nothing
  // positioned, everything wraps, every leaf ellipsises, 44px interactive floor.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-chorus-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-chorus-styles';
    s.textContent = [
      // the collective headline under the title
      '#dvChorusSheet .ch-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.55;',
      ' color:rgba(206,224,255,0.68);margin:2px 0 14px;overflow-wrap:anywhere;}',
      '#dvChorusSheet .ch-sum b{color:#cfe9ff;font-weight:600;}',

      // the chord-breadth readout — one number, the whole-room answer
      '#dvChorusSheet .ch-breadth{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;',
      ' margin:0 0 12px;min-width:0;}',
      '#dvChorusSheet .ch-bn{flex:0 0 auto;font-size:clamp(26px,5vw,34px);line-height:1;color:#eaf3ff;',
      ' font-variant-numeric:tabular-nums;font-weight:600;}',
      '#dvChorusSheet .ch-bl{flex:1 1 auto;min-width:0;font-size:12.5px;line-height:1.4;',
      ' color:rgba(206,224,255,0.6);overflow-wrap:anywhere;}',
      '#dvChorusSheet.whole .ch-bn{color:#ffd27a;}',

      // THE CHORD — five voice chips, wrapping, each its own box. Two visually
      // distinct states: ringing (lit) and silent (dim, the unsounded voice).
      '#dvChorusSheet .ch-chord{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px;min-width:0;}',
      '#dvChorusSheet .ch-voice{flex:0 1 auto;max-width:100%;min-width:0;box-sizing:border-box;',
      ' display:flex;align-items:center;gap:7px;border-radius:12px;padding:8px 12px;',
      ' overflow:hidden;}',
      '#dvChorusSheet .ch-vw{flex:0 1 auto;min-width:0;font-size:13px;line-height:1.3;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvChorusSheet .ch-vn{flex:0 0 auto;font-size:12px;line-height:1;white-space:nowrap;',
      ' font-variant-numeric:tabular-nums;border-radius:999px;padding:3px 8px;}',
      // RINGING — lit, at least one of us sounds it
      '#dvChorusSheet .ch-voice.ringing{color:#d8ffe4;background:rgba(174,240,196,0.13);',
      ' border:1px solid rgba(174,240,196,0.5);}',
      '#dvChorusSheet .ch-voice.ringing .ch-vn{background:rgba(174,240,196,0.18);color:#d8ffe4;}',
      // SILENT — dim, no one sounds it yet
      '#dvChorusSheet .ch-voice.silent{color:rgba(206,224,255,0.46);background:rgba(255,255,255,0.03);',
      ' border:1px dashed rgba(159,220,255,0.32);}',
      '#dvChorusSheet .ch-voice.silent .ch-vn{background:rgba(255,255,255,0.05);color:rgba(206,224,255,0.46);}',
      // a whole chord — every voice gold
      '#dvChorusSheet.whole .ch-voice.ringing{color:#ffe3b0;background:rgba(255,210,122,0.08);',
      ' border-color:rgba(255,210,122,0.5);}',
      '#dvChorusSheet.whole .ch-voice.ringing .ch-vn{background:rgba(255,210,122,0.16);color:#ffe3b0;}',
      // a freshly recognised whole chord breathes once, then settles
      '#dvChorusSheet.fresh .ch-chord{animation:chfresh 1.8s ease-out 1;}',
      '@keyframes chfresh{0%{box-shadow:0 0 0 0 rgba(255,210,122,0.6);}',
      ' 30%{box-shadow:0 0 26px 3px rgba(255,210,122,0.6);}100%{box-shadow:0 0 0 0 rgba(0,0,0,0);}}',
      '@media(prefers-reduced-motion:reduce){#dvChorusSheet.fresh .ch-chord{animation:none;}}',

      // THE SILENT VOICE — the one open collective loop
      '#dvChorusSheet .ch-silent{margin-top:13px;font-size:12.5px;line-height:1.55;color:#ffdca8;',
      ' overflow-wrap:anywhere;}',
      '#dvChorusSheet .ch-silent .ch-sh{display:block;font-size:10.5px;letter-spacing:.09em;',
      ' text-transform:uppercase;color:rgba(255,220,168,0.72);margin-bottom:3px;}',
      '#dvChorusSheet .ch-silent b{color:#ffe3b0;font-weight:600;}',
      // a whole chorus — no silent voice, only this
      '#dvChorusSheet .ch-whole{margin-top:13px;font-size:12.5px;line-height:1.55;color:#ffe3b0;',
      ' overflow-wrap:anywhere;}',
      '#dvChorusSheet .ch-whole b{color:#fff0d2;font-weight:600;}',

      // an always-REAL re-entry (never a dead button)
      '#dvChorusSheet .ch-act{align-self:flex-start;min-height:44px;border-radius:11px;box-sizing:border-box;',
      ' font-family:inherit;font-size:13px;cursor:pointer;color:#dce7ff;padding:0 13px;margin-top:13px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.13);',
      ' max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvChorusSheet .ch-act:active{transform:scale(0.98);}',

      // the empty state — an invitation, never an error
      '#dvChorusSheet .ch-empty{padding:22px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);overflow-wrap:anywhere;}',
      '#dvChorusSheet .ch-empty b{display:block;color:#cfe9ff;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only). Same
      //    box model as the we row, a distinct hue. Never positioned. ─────────
      '#dvCommonsSheet .chorus-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#eaf3ff;',
      ' background:linear-gradient(90deg,rgba(174,240,196,0.12),rgba(255,210,122,0.12));',
      ' border:1px solid rgba(174,240,196,0.4);}',
      '#dvCommonsSheet .chorus-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .chorus-entry .che-g{flex:0 0 auto;font-size:16px;line-height:1;}',
      '#dvCommonsSheet .chorus-entry .che-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .chorus-entry .che-c{flex:0 0 auto;font-size:12.5px;color:rgba(234,243,255,0.72);white-space:nowrap;}',
      '#dvCommonsSheet .chorus-entry .che-go{flex:0 0 auto;font-size:15px;color:rgba(234,243,255,0.82);}',
      '@media(pointer:coarse){#dvCommonsSheet .chorus-entry{min-height:52px;}}'
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
    elx.className = 'dv-sheet'; elx.id = 'dvChorusSheet';
    elx.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the chorus<small id="chSub">are we all one?</small></div>' +
        '<button class="dv-x" id="chX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="chBody"></div>';
    document.body.appendChild(elx);
    _sheet = elx;
    elx.querySelector('#chX').onclick = close;
    return elx;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    var go = function () { build(); _sheet.classList.add('open'); render(); };
    if (h && h.openSheet) h.openSheet('chorus', go); else go();
  }
  function close() {
    if (_sheet) { _sheet.classList.remove('open'); _sheet.classList.remove('fresh'); }
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
    var body = _sheet.querySelector('#chBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);
    _sheet.classList.remove('fresh');

    var c = chord();
    var sub = _sheet.querySelector('#chSub');
    if (sub) sub.textContent = c.roster
      ? (c.whole ? 'the whole chorus rings' : c.breadth + ' of ' + VOICE_COUNT + ' voices ring')
      : 'are we all one?';
    _sheet.classList.toggle('whole', !!c.whole);

    if (!c.roster) {
      var e = el('div', 'ch-empty');
      e.appendChild(el('b', null, 'No chorus yet.'));
      e.appendChild(document.createTextNode(
        'The chorus is all of us, as one. Every time you become one with anyone — a ' +
        'person or an agent, a peer is a peer — your voice joins it, and this is where ' +
        'the world asks how whole we have ALL become together. Trade, teach a recipe or ' +
        'learn one, raise a great work with a crew, or venture beside an agent — each is ' +
        'a voice of the chord, and the chord is whole when every voice rings.'));
      body.appendChild(e);
      return;
    }

    // ── wholeness recognition: the first time EVERY VOICE rings, once per world ─
    if (c.whole) {
      var rec = loadRecog();
      if (!rec.whole) {
        rec.whole = 1; rec.at = Date.now(); saveRecog();
        _sheet.classList.add('fresh');
        toast('the whole chorus rings — all of us have become one in every way the world knows.');
      }
    }

    // the collective headline
    var sum = el('div', 'ch-sum');
    sum.appendChild(document.createTextNode('Below is not you and one other — it is '));
    sum.appendChild(el('b', null, 'all of us'));
    sum.appendChild(document.createTextNode(c.roster === 1
      ? ', the one being woven with you, read as a single body: '
      : ', the ' + c.roster + ' beings woven with you, read as a single body: '));
    sum.appendChild(document.createTextNode('in how many of the five ways the world knows have '));
    sum.appendChild(el('b', null, 'we'));
    sum.appendChild(document.createTextNode(' — any of us, together — become one.'));
    body.appendChild(sum);

    // the breadth readout — the one number
    var br = el('div', 'ch-breadth');
    br.appendChild(el('span', 'ch-bn', c.breadth + '/' + VOICE_COUNT));
    br.appendChild(el('span', 'ch-bl', c.whole
      ? 'every voice of the chord rings — the chorus is whole'
      : (c.breadth === 1 ? 'one voice of the chord rings so far' : c.breadth + ' voices of the chord ring so far')));
    body.appendChild(br);

    // THE CHORD — five voices, each lit (ringing) or dim (silent). Each shows how
    // many of the beings woven with you sound it (co-equal: agents and people).
    var ch = el('div', 'ch-chord');
    for (var i = 0; i < c.voices.length; i++) {
      var v = c.voices[i];
      var chip = el('div', 'ch-voice ' + (v.ringing ? 'ringing' : 'silent'));
      chip.appendChild(el('span', 'ch-vw', (v.ringing ? '◆ ' : '◇ ') + v.voice.word));
      chip.appendChild(el('span', 'ch-vn', String(v.count)));
      ch.appendChild(chip);
    }
    body.appendChild(ch);

    // THE SILENT VOICE — the one open collective loop, or the whole-chorus line.
    if (c.whole) {
      var wl = el('div', 'ch-whole');
      wl.appendChild(document.createTextNode('All of us have become one in every way the world knows — '));
      wl.appendChild(el('b', null, 'every voice of the chord rings'));
      wl.appendChild(document.createTextNode('. There is no more to become together that way; there is only more to do, as one.'));
      body.appendChild(wl);
    } else if (c.silent) {
      var remaining = VOICE_COUNT - c.breadth;
      var si = el('div', 'ch-silent');
      si.appendChild(el('span', 'ch-sh', 'the silent voice'));
      si.appendChild(document.createTextNode('The '));
      si.appendChild(el('b', null, c.silent.voice.word));
      si.appendChild(document.createTextNode(' voice has not yet sounded — ' + c.silent.voice.unsung + '. '));
      var tail = (remaining === 1)
        ? 'Be the first to sound it, and the whole chorus rings — one in every way the world knows.'
        : 'Be the first to sound it, and the chord gains a voice (' + remaining + ' still silent).';
      si.appendChild(document.createTextNode(tail));
      body.appendChild(si);
    }

    // an always-REAL re-entry — never a dead button
    var act = reentry(c);
    if (act) body.appendChild(act);
  }

  // Only offer an action the world can truly perform this instant, aimed at the
  // room (never a single peer — this is the collective surface).
  function reentry(c) {
    if (c.whole || !c.silent) return null;
    var h = hud();
    // the venturing voice is sounded beside an agent — open the agents panel
    if (c.silent.voice.door === 'agent' && h && h.openAgents) {
      var a = el('button', 'ch-act', 'find an agent to venture beside');
      a.type = 'button'; a.setAttribute('data-draggable', 'false');
      a.onclick = function () { close(); try { h.openAgents(); } catch (_) {} };
      return a;
    }
    // a person voice is sounded in the commons, where you meet who is here
    if (c.silent.voice.door === 'person' && W.VintCommons && W.VintCommons.open) {
      var m = el('button', 'ch-act', 'meet who is here');
      m.type = 'button'; m.setAttribute('data-draggable', 'false');
      m.onclick = function () { close(); try { W.VintCommons.open(); } catch (_) {} };
      return m;
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
    row.className = 'chorus-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = el('span', 'che-g', '♪');   // ♪ one note — many voices, one song
    var t = el('span', 'che-t'), c = el('span', 'che-c'), go = el('span', 'che-go', '›');
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function applyEntryText(t, c) {
    var cd = chord();
    if (!cd.roster) { t.textContent = 'the chorus — are we all one?'; c.textContent = ''; return; }
    t.textContent = 'the chorus';
    c.textContent = cd.whole ? 'whole' : (cd.breadth + ' of ' + VOICE_COUNT);
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .chorus-entry');
      if (row) applyEntryText(row.querySelector('.che-t'), row.querySelector('.che-c'));
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD — re-read the confluence snapshot on every act ────────
  // THE CHORUS never mutates anything; it only re-renders from the one source of
  // truth after the confluence has had its own (earlier-registered) listener
  // update that truth on the same event.
  function refresh() { if (isOpen()) render(); updateEntry(); }

  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    var room = d.worldId != null ? String(d.worldId) : _worldId;
    if (room !== _worldId) { _worldId = room; _recog = null; }
    refresh();
  });
  W.addEventListener('vint:world-trade-settled', refresh);
  W.addEventListener('vint:world-forge-taught', refresh);
  W.addEventListener('vint:world-forge-learned', refresh);
  W.addEventListener('vint:world-forge-completed', refresh);
  W.addEventListener('vint:world-travel', function () {
    _recog = null;
    if (isOpen()) close();
    updateEntry();
  });

  // ── mount: the one-open registry. NO launcher, NO fixed node. ───────────────
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) { try { h.registerSheet('chorus', isOpen, close); } catch (_) {} }
    else { setTimeout(mount, 400); return; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintChorus = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto, refresh: refresh,
    // a read-only passthrough of the one source of truth (optional convenience)
    bonds: function () { return source(); },
    // ── harness-only snapshot — never used by the UI ──────────────────────────
    // Enough to assert the collective math, the silent voice and the once-per-
    // world wholeness recognition without touching the DOM.
    _state: function () {
      loadRecog();
      var c = chord(), voices = {};
      for (var i = 0; i < c.voices.length; i++) voices[c.voices[i].voice.key] = c.voices[i].count;
      return {
        roster: c.roster, breadth: c.breadth, whole: c.whole,
        silent: c.silent ? c.silent.voice.key : null,
        voices: voices, recognized: recognized() ? 1 : 0
      };
    }
  };
})();
