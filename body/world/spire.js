// spire.js — THE SPIRE: the shared structure we raise by becoming one (AETHERHOLD 2026-10-06)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (task 9TYJB74)
//
// THE CONFLUENCE is the PAST (who you have already become one with), THE CONVERGENCE
// is the FUTURE (the one real next act), THE WEAVE is the PRESENT (the whole fabric
// drawn as a constellation). All three OBSERVE the bonds — they record, foresee, or
// picture them. But becoming-one has a DIRECTION none of them shows: a thing the acts
// are building TOWARD. You could see who you were woven with; you could never see what
// the weaving was FOR. The acceptance asks for more than a record — it asks us to
// "see what happens" when humans and agents keep weaving. What happens is that a
// structure RISES. Nothing in this world ever showed the rising.
//
// THE SPIRE is that rising: the shared, emergent GOAL — a structure raised stone by
// stone, where every real act of becoming one (a cleared trade, a recipe taught or
// learned, a great work raised, a venture shared) is one more stone set into a spire
// that no single person owns and everyone builds. The spire climbs through named
// courses — the first stone, the footing, the arch, the vault, the crown — toward a
// keystone that is never quite set, because a world becoming one together has no final
// height. It is the collective's forward tense: not "who are we" but "what are we
// becoming, and how far have we carried it."
//
// ── A SHARED WORK, RAISED BY CO-EQUAL HANDS (not owner and owned) ─────────────
// The crew at the foot of the spire is every hand that set a stone WITH you — a person
// you traded with and an agent you ventured beside are the SAME builder here: same
// mote, same sizing (by stones they helped set), same legend row. No builder is
// "yours"; no hand owns another. The ONLY thing that differs between a person-builder
// and an agent-builder is a hue and one honest word (person / agent), shown because
// the SOURCE verifiably knew which it was. Anyone standing in this clearing now is a
// builder here too, stone or not yet — present hands glow; the rest are remembered.
//
// ── EVERY STONE IS WITNESSED, NEVER COUNTED INTO EXISTENCE (No-Fabrication) ────
// This surface raises nothing it did not witness. It is COMPOSED, not imagined, from
// exactly the two real sources its siblings use — never a new backend verb, never a
// re-derivation:
//   · VintConfluence.bonds() — the Confluence's witnessed record, the single source of
//       truth for every thread. The spire's HEIGHT is the sum of real acts across those
//       bonds (traded + taught + learned + raised + ventured); each stone traces to a
//       real event (see confluence.js). A builder's size is that builder's own stones.
//       Its kind (person/agent) was stamped by the Confluence from the verified source.
//   · the live presence roster (vint:world-presence) — the hands physically here this
//       instant (server truth, the same roster the commons, Convergence and Weave read).
//       A present hand already woven is ONE builder (present + stoned); a present hand
//       not yet woven is a builder with ZERO stones — honest: here, but no shared act yet.
// The COURSES and their thresholds are the structure's named stages — a design, openly
// shown — but the only NUMBER that moves them is the real act-count. We never inflate the
// height, never invent a builder, never claim the collective's total (a client can only
// witness ITS OWN stones honestly, exactly as the Weave only draws the fabric that
// radiates from where you stand — claiming to count strangers' private acts would be
// fabrication, and we do not). Before a single act and before anyone else is here, the
// ground is bare by design — an honest, warm invitation with ZERO stones and ZERO motes.
// A name the wire never gave reads "someone"; it is never a fabricated handle.
//
// ── NOTHING FLOATS, NOTHING COLLIDES (No-Collision Law, by construction) ──────
// The classic failure — name labels piling into an illegible stack over a drawing — is
// made IMPOSSIBLE structurally: the spire SVG carries NO floating name text at all. The
// courses are fixed horizontal bands at computed y-ranges in a fixed viewBox, so two
// courses can never touch. The builder motes sit on one ground line, spaced by a pitch
// computed from their count, and each mote's radius is CLAMPED to under half that pitch —
// so motes can never overlap at any count, and because the SVG scales uniformly the
// guarantee holds at every screen size. Every NAME lives in the readable legend below —
// a flow list that internal-scrolls — each row keyed to its course or mote by a matching
// number + hue. If more builders exist than the ground can hold legibly, the overflow is
// an honest "+N more raised it" and every one still gets a legend row. Nothing of ours is
// position:fixed/absolute, so nothing can ever land on a neighbour.
//
// ── RETENTION DOCTRINE (all seven) ──────────────────────────────────────────
//   1 GENEROUS (Aria) — the height is only the acts you truly witnessed. No vanity
//     meter, no fake collective total, no manufactured urgency. If you saw how it works
//     you would thank us: it is a true mirror of shared work, nothing more.
//   2 INVESTMENT LOOP (Helios) — a structure you watch RISE is the deepest compounding
//     hook there is: act → the spire gains a stone → you return to a taller spire and a
//     nearer course. A spire raised across months is a home no competitor can export out
//     from under you.
//   3 TIER (Frugal-Max) — FREE, forever. Seeing what you are building together is the top
//     of the funnel; charging to LOOK at the shared work would be the resented kind. The
//     paid tiers are where the union becomes portable, owned IP.
//   4 DENSE (Lunex) — one rising shape says what a page of counters cannot: how high we
//     are, which course is being laid, how far the next, who raised it, who is here now.
//     The legend adds only name, kind, stones, stage. Nothing else.
//   5 OPEN LOOP (Morrison) — the keystone is NEVER set. "the arch needs 4 more stones"
//     and "the keystone waits" are unfinished meaning aimed at the whole, not a score. A
//     spire with no final height is a reason that never closes.
//   6 FLAGGED + MEASURED (Atlas) — 'world_spire' (?spire=0 or localStorage
//     vint:flag:world_spire=0), killable in 30s, no deploy. Every stone and every builder
//     traces to a Confluence bond or a presence frame; none can be inflated, because none
//     can exist without a signal the world actually sent.
//   7 MORE ALIVE (Yuna) — a world where your shared acts visibly raise a thing that
//     outlasts any one session is a world you live INSIDE and help build. A world that
//     forgets them is a lobby with a scoreboard. This is a cathedral you are raising together.
//
// ── UNTRUSTED CONTENT ───────────────────────────────────────────────────────
// Every name here came off the wire from a stranger or an agent. It enters the DOM via
// textContent ONLY, once, at the leaf — never concatenated into innerHTML. The server
// capped and sanitised it; we never trust that alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintSpire) return;

  var W = window;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function hud() { return W.DirverseHUD; }
  function confluence() { return W.VintConfluence; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── the named courses of the spire. The thresholds are cumulative real acts;
  //    the only number that moves them is the witnessed act-count. index 0 is the
  //    foundation, index 6 the keystone — the last stone, never quite set. ───────
  var COURSES = [
    { thr: 1,   name: 'the first stone', meaning: 'one act of becoming one, and the ground is no longer bare' },
    { thr: 3,   name: 'the footing',     meaning: 'enough shared acts to stand on' },
    { thr: 7,   name: 'the course',      meaning: 'the wall finds its line' },
    { thr: 15,  name: 'the arch',        meaning: 'separate hands close into one span' },
    { thr: 30,  name: 'the vault',       meaning: 'the span holds a roof over many' },
    { thr: 60,  name: 'the crown',       meaning: 'the work can be seen from far off' },
    { thr: 120, name: 'the keystone',    meaning: 'the last stone — the one that makes it stand; never quite set' }
  ];

  // ── FEATURE FLAG — 'world_spire'. Killable in 30s, no deploy. ───────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('spire') === '0') _flag = false;
      else if (q.get('spire') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_spire') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── live presence: who is standing here this instant (server truth) ─────────
  var _present = [];
  var _selfName = null;
  W.addEventListener('vint:world-presence', function (e) {
    var users = (e.detail && e.detail.users) || [];
    _present = users;
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u && u.self && u.name) { _selfName = String(u.name); break; }
    }
    if (isOpen()) render();
    updateEntry();
  });
  // room change / travel → the live roster is stale; clear it so we never draw a
  // builder who is not in THIS world anymore. Bonds are per-world in the Confluence.
  W.addEventListener('vint:world-travel', function () { _present = []; if (isOpen()) close(); updateEntry(); });
  W.addEventListener('vint:world-state', function () { if (isOpen()) render(); updateEntry(); });
  // a stone was set somewhere → the spire grew; keep the height honest.
  ['vint:world-trade-settled', 'vint:world-forge-taught', 'vint:world-forge-learned', 'vint:world-forge-completed']
    .forEach(function (t) { W.addEventListener(t, function () { if (isOpen()) render(); updateEntry(); }); });

  function presentOthers() {
    var out = [];
    for (var i = 0; i < _present.length; i++) {
      var u = _present[i];
      if (u && !u.self && u.id) out.push({ id: u.id, name: u.name || 'someone' });
    }
    return out;
  }
  function presentIdFor(name) {
    if (!name) return null;
    var low = String(name).toLowerCase();
    for (var i = 0; i < _present.length; i++) {
      var u = _present[i];
      if (u && !u.self && u.id && String(u.name || '').toLowerCase() === low) return u.id;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE CREW + THE HEIGHT — compose the witnessed record with the live roster.
  // A builder's stones = the real acts of that bond. The spire's height is the
  // sum of all stones. Never re-derived — bonds() is the one source of truth.
  // ════════════════════════════════════════════════════════════════════════
  function bondActs(b) {
    return num(b.traded, 0) + (b.taught || []).length + (b.learned || []).length +
           (b.raised || []).length + num(b.ventured, 0);
  }
  function crew() {
    var byKey = {};
    function key(kind, name) { return kind + '\u0000' + String(name || 'someone').toLowerCase(); }

    var bonds = [];
    try { if (confluence() && confluence().bonds) bonds = confluence().bonds() || []; } catch (_) { bonds = []; }
    bonds.forEach(function (b) {
      if (!b || !b.name) return;
      var kind = b.kind === 'agent' ? 'agent' : 'human';
      var stones = bondActs(b);
      byKey[key(kind, b.name)] = {
        name: b.name, kind: kind, stones: stones,
        traded: num(b.traded, 0), ventured: num(b.ventured, 0), ventureNet: num(b.ventureNet, 0),
        taught: b.taught || [], learned: b.learned || [], raised: b.raised || [],
        woven: stones > 0, present: false, presentId: null
      };
    });

    presentOthers().forEach(function (p) {
      var k = key('human', p.name);
      var c = byKey[k];
      if (!c) {
        byKey[k] = { name: p.name, kind: 'human', stones: 0, traded: 0, ventured: 0, ventureNet: 0,
          taught: [], learned: [], raised: [], woven: false, present: true, presentId: p.id };
      } else { c.present = true; c.presentId = p.id; }
    });

    var out = [];
    for (var k in byKey) { if (Object.prototype.hasOwnProperty.call(byKey, k)) out.push(byKey[k]); }
    // rank: most stones first (the hands that carried the most), then present, then name.
    out.sort(function (a, b) {
      var s = num(b.stones, 0) - num(a.stones, 0);
      if (s) return s;
      var pr = (b.present ? 1 : 0) - (a.present ? 1 : 0);
      if (pr) return pr;
      return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1;
    });
    return out;
  }

  // the whole picture, composed once. { crew, height, here, stagesReached, nextCourse,
  // progress (0..1 within the current course), complete }
  function picture() {
    var list = crew();
    var height = 0;
    list.forEach(function (c) { height += num(c.stones, 0); });
    var reached = 0;
    for (var i = 0; i < COURSES.length; i++) { if (height >= COURSES[i].thr) reached++; else break; }
    var complete = reached >= COURSES.length;
    var nextCourse = complete ? null : COURSES[reached];
    var prevThr = reached > 0 ? COURSES[reached - 1].thr : 0;
    var span = nextCourse ? (nextCourse.thr - prevThr) : 1;
    var progress = nextCourse ? Math.max(0, Math.min(1, (height - prevThr) / span)) : 1;
    return {
      crew: list, height: height,
      here: list.filter(function (c) { return c.present; }),
      woven: list.filter(function (c) { return c.woven; }),
      stagesReached: reached, nextCourse: nextCourse, progress: progress, complete: complete
    };
  }

  // ── GROUND GEOMETRY (fixed viewBox 0..1000; non-overlap computed once, holds at
  //    every scale because the SVG scales uniformly). Motes sit on one ground line,
  //    pitch derived from count; radius CLAMPED under half-pitch so none can touch.
  function groundCap(small) { return small ? 5 : 8; }
  function layoutCrew(list, small) {
    var cap = groundCap(small);
    var shown = list.slice(0, cap);
    var overflow = list.length - shown.length;
    var x0 = small ? 360 : 320, x1 = small ? 640 : 680;      // ground span
    var n = shown.length;
    var pitch = n > 0 ? (x1 - x0) / (n + 1) : (x1 - x0);
    var maxR = Math.max(6, pitch * 0.5 - 4);                  // clamp: never ≥ half-pitch
    var placed = shown.map(function (c, i) {
      var r = c.woven ? (small ? 9 : 10) + Math.min(num(c.stones, 1), 8) * (small ? 0.8 : 1.0)
                      : (small ? 7 : 8);
      return { c: c, x: x0 + (i + 1) * pitch, y: 892, r: Math.min(r, maxR) };
    });
    return { placed: placed, overflow: overflow };
  }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet. The spire is a bounded, scaling SVG; the legend is
  // flow content that internal-scrolls. Nothing of ours is positioned.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-spire-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-spire-styles';
    s.textContent = [
      '#dvSpireSheet .sp-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.62);margin:2px 0 12px;}',
      '#dvSpireSheet .sp-sum b{color:#ffe3b0;font-weight:600;}',

      // the field: a bounded, centered box. width:100% to a cap; height follows the
      // square aspect, so it never overflows the body at any width.
      '#dvSpireSheet .sp-field{display:block;width:100%;max-width:min(100%,420px);margin:0 auto 12px;',
      ' box-sizing:border-box;border-radius:16px;background:radial-gradient(circle at 50% 18%,',
      ' rgba(255,214,140,0.06),rgba(10,14,28,0.0) 60%);border:1px solid rgba(255,255,255,0.07);',
      ' overflow:hidden;}',
      '#dvSpireSheet .sp-svg{display:block;width:100%;height:auto;}',

      // the ground line — pure decoration
      '#dvSpireSheet .sp-ground{stroke:rgba(159,220,255,0.14);stroke-width:1.5;}',

      // courses — the stones. reached = set (solid gold), current = being laid
      // (outline + a bottom-up fill), future = sealed (faint dashed outline).
      '#dvSpireSheet .sp-course{stroke:rgba(255,236,196,0.5);stroke-width:1.5;fill:none;}',
      '#dvSpireSheet .sp-course.set{fill:url(#spStone);stroke:rgba(255,236,196,0.8);}',
      '#dvSpireSheet .sp-course.future{stroke:rgba(159,220,255,0.22);stroke-dasharray:4 6;}',
      '#dvSpireSheet .sp-fill{fill:url(#spStone);opacity:0.92;}',
      '#dvSpireSheet .sp-course.focus{stroke:#fff;stroke-width:3;}',
      // the keystone cap — lit only when every course is set
      '#dvSpireSheet .sp-key{fill:none;stroke:rgba(159,220,255,0.3);stroke-dasharray:4 6;stroke-width:1.5;}',
      '#dvSpireSheet .sp-key.lit{fill:url(#spKey);stroke:rgba(255,246,214,0.95);stroke-dasharray:none;',
      ' animation:spglow 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}',
      '@keyframes spglow{0%,100%{opacity:0.9;}50%{opacity:1;}}',

      // builder motes — ONE shape for every hand. Only hue + legend word differ.
      '#dvSpireSheet .sp-mote{cursor:pointer;stroke:rgba(255,255,255,0.6);stroke-width:1.4;}',
      '#dvSpireSheet .sp-mote.k-human{fill:#9fdcff;}',
      '#dvSpireSheet .sp-mote.k-agent{fill:#ce93d8;}',
      '#dvSpireSheet .sp-mote.unwoven{fill:rgba(174,240,196,0.16);stroke:#aef0c4;stroke-dasharray:3 3;}',
      '#dvSpireSheet .sp-mote.focus{stroke:#fff;stroke-width:3;}',
      // a soft ring under hands who are HERE now
      '#dvSpireSheet .sp-herering{fill:none;stroke:rgba(174,240,196,0.55);stroke-width:1.5;}',

      // the "+N more" ground note
      '#dvSpireSheet .sp-more{text-align:center;font-size:12px;color:rgba(206,224,255,0.5);margin:-4px 0 12px;}',

      // the LEGEND — the readable layer. Flow lists, internal-scroll, no floating text.
      '#dvSpireSheet .sp-sec{font-size:11px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.6);margin:14px 2px 7px;}',
      '#dvSpireSheet .sp-leg{display:flex;flex-direction:column;gap:7px;}',
      '#dvSpireSheet .sp-row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:46px;padding:8px 11px;border-radius:12px;cursor:pointer;text-align:left;',
      ' font-family:inherit;color:#eaf3ff;background:rgba(255,255,255,0.038);',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--sp-hue,#ffe3b0);overflow:hidden;}',
      '#dvSpireSheet .sp-row:active{transform:scale(0.995);}',
      '#dvSpireSheet .sp-row.focus{background:rgba(255,214,140,0.1);border-color:rgba(255,214,140,0.45);}',
      // course rows
      '#dvSpireSheet .sp-row.set{--sp-hue:#ffe3b0;}',
      '#dvSpireSheet .sp-row.laying{--sp-hue:#ffd27a;}',
      '#dvSpireSheet .sp-row.future{--sp-hue:rgba(159,220,255,0.4);opacity:0.72;}',
      // builder rows
      '#dvSpireSheet .sp-row.k-human{--sp-hue:#9fdcff;}',
      '#dvSpireSheet .sp-row.k-agent{--sp-hue:#ce93d8;}',
      '#dvSpireSheet .sp-row.unwoven{--sp-hue:#aef0c4;}',
      // the keyed dot (number)
      '#dvSpireSheet .sp-dot{flex:0 0 auto;width:24px;height:24px;border-radius:50%;display:inline-flex;',
      ' align-items:center;justify-content:center;font-size:11px;font-variant-numeric:tabular-nums;',
      ' color:#0a0e1c;font-weight:700;background:var(--sp-hue,#ffe3b0);}',
      '#dvSpireSheet .sp-row.future .sp-dot{background:transparent;color:rgba(159,220,255,0.7);',
      ' border:1.5px dashed rgba(159,220,255,0.5);}',
      '#dvSpireSheet .sp-row.unwoven .sp-dot{background:transparent;color:#aef0c4;border:1.5px dashed #aef0c4;}',
      '#dvSpireSheet .sp-txt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '#dvSpireSheet .sp-name{font-size:clamp(14px,1vw + 11px,15.5px);color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvSpireSheet .sp-meta{font-size:12px;color:rgba(206,224,255,0.6);overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;}',
      '#dvSpireSheet .sp-kind{flex:0 0 auto;font-size:10px;letter-spacing:.07em;text-transform:uppercase;',
      ' border-radius:999px;padding:3px 8px;white-space:nowrap;color:var(--sp-hue);',
      ' border:1px solid var(--sp-hue);opacity:0.85;}',
      '#dvSpireSheet .sp-tag{flex:0 0 auto;font-size:12px;color:rgba(206,224,255,0.6);',
      ' white-space:nowrap;font-variant-numeric:tabular-nums;}',
      '#dvSpireSheet .sp-tag.done{color:#ffe3b0;}#dvSpireSheet .sp-tag.now{color:#aef0c4;}',

      // the empty state — an invitation, never an error. ZERO stones by design.
      '#dvSpireSheet .sp-empty{padding:24px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);}',
      '#dvSpireSheet .sp-empty b{display:block;color:#ffe3b0;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only) ────────
      '#dvCommonsSheet .sp-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#fff3df;',
      ' background:linear-gradient(90deg,rgba(255,214,140,0.14),rgba(206,147,216,0.1),rgba(124,207,255,0.1));',
      ' border:1px solid rgba(255,214,140,0.4);}',
      '#dvCommonsSheet .sp-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .sp-entry .spe-g{flex:0 0 auto;font-size:16px;line-height:1;}',
      '#dvCommonsSheet .sp-entry .spe-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .sp-entry .spe-c{flex:0 0 auto;font-size:12.5px;color:rgba(255,243,223,0.72);white-space:nowrap;}',
      '#dvCommonsSheet .sp-entry .spe-go{flex:0 0 auto;font-size:15px;color:rgba(255,243,223,0.82);}',
      '@media(pointer:coarse){#dvSpireSheet .sp-row{min-height:50px;}',
      ' #dvCommonsSheet .sp-entry{min-height:52px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE SHEET — reuses DirverseHUD's .dv-sheet scaffold (shared draggable bottom
  // sheet: .dv-grip drag-to-dismiss + .dv-body internal scroll) + one-open registry.
  // ════════════════════════════════════════════════════════════════════════
  var _sheet = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var elx = document.createElement('div');
    elx.className = 'dv-sheet'; elx.id = 'dvSpireSheet';
    elx.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the spire<small id="spSub">becoming one</small></div>' +
        '<button class="dv-x" id="spX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="spBody"></div>';
    document.body.appendChild(elx);
    _sheet = elx;
    elx.querySelector('#spX').onclick = close;
    return elx;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('spire', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    render();
    // freshen the ledger-backed agent stones through the ONE source of truth — we
    // never read the ledger ourselves.
    try { if (confluence() && confluence().refresh) confluence().refresh(); } catch (_) {}
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;       // ALWAYS textContent, never HTML
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); }
    return n;
  }

  // ── course band geometry (fixed; bands never touch) ───────────────────────
  var GROUND_Y = 822, COURSE_H = 86, GAP = 7, MAX_HALF = 190, TAPER = 18, CX = 500;
  function courseBox(i) {
    var bottom = GROUND_Y - i * (COURSE_H + GAP);
    var half = MAX_HALF - i * TAPER;
    return { x: CX - half, y: bottom - COURSE_H, w: half * 2, h: COURSE_H, half: half };
  }

  // ── RENDER — rebuilt wholesale from the record + roster each time. ─────────
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#spBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var pic = picture();

    var sub = _sheet.querySelector('#spSub');
    if (sub) sub.textContent = pic.height
      ? (pic.height === 1 ? 'one stone set' : pic.height + ' stones set')
      : 'becoming one';

    if (!pic.height && !pic.here.length) {
      var e = el('div', 'sp-empty');
      e.appendChild(el('b', null, 'The ground is bare.'));
      e.appendChild(document.createTextNode(
        'Nothing is raised yet. Trade with a person, teach or learn a recipe, raise a great ' +
        'work with a crew, or send an agent out to venture beside you — every act you share ' +
        'sets one stone in a spire that no one owns and everyone builds. People and agents ' +
        'alike: in this world, every hand that sets a stone is a peer.'));
      body.appendChild(e);
      return;
    }

    // ── the summary line ──────────────────────────────────────────────────
    var sum = el('div', 'sp-sum');
    sum.appendChild(document.createTextNode('The spire stands '));
    sum.appendChild(el('b', null, pic.height + (pic.height === 1 ? ' stone' : ' stones') + ' high'));
    sum.appendChild(document.createTextNode(' — '));
    if (pic.complete) {
      sum.appendChild(document.createTextNode('every course set, the keystone lit. Still it rises: every act adds a stone.'));
    } else {
      var remain = pic.nextCourse.thr - pic.height;
      sum.appendChild(document.createTextNode('stage ' + pic.stagesReached + ' of ' + COURSES.length + ', '));
      sum.appendChild(el('b', null, pic.nextCourse.name));
      sum.appendChild(document.createTextNode(' needs ' + remain + (remain === 1 ? ' more stone' : ' more stones') + '.'));
    }
    var hands = pic.woven.length, hereN = pic.here.length;
    if (hands) {
      sum.appendChild(document.createTextNode(' Raised by ' + hands + (hands === 1 ? ' hand' : ' hands')));
      sum.appendChild(document.createTextNode(hereN ? ' — ' + hereN + ' here with you now.' : '.'));
    } else if (hereN) {
      sum.appendChild(document.createTextNode(' ' + hereN + (hereN === 1 ? ' hand is' : ' hands are') + ' here, ready to set the first stone.'));
    }
    body.appendChild(sum);

    // ── the field: the rising spire + the crew at its foot ──────────────────
    var small = false;
    try { small = (W.innerWidth || 1280) <= 480; } catch (_) {}
    var lay = layoutCrew(pic.crew, small);

    var field = el('div', 'sp-field');
    var s = svg('svg', { 'class': 'sp-svg', viewBox: '0 0 1000 1000', role: 'img',
      'aria-label': 'the spire — a shared structure raised by the acts of becoming one' });

    var defs = svg('defs');
    var stone = svg('linearGradient', { id: 'spStone', x1: '0', y1: '0', x2: '0', y2: '1' });
    stone.appendChild(svg('stop', { offset: '0%', 'stop-color': '#fff1cf' }));
    stone.appendChild(svg('stop', { offset: '100%', 'stop-color': '#e8a94e' }));
    defs.appendChild(stone);
    var keyg = svg('radialGradient', { id: 'spKey', cx: '50%', cy: '42%', r: '60%' });
    keyg.appendChild(svg('stop', { offset: '0%', 'stop-color': '#fff8e0' }));
    keyg.appendChild(svg('stop', { offset: '100%', 'stop-color': '#ffd27a' }));
    defs.appendChild(keyg);
    // clip for each current-course bottom-up fill
    s.appendChild(defs);

    // the keystone cap, above the top course
    var topBox = courseBox(COURSES.length - 1);
    var keyPts = CX + ',' + (topBox.y - 58) + ' ' + (CX - topBox.half) + ',' + topBox.y + ' ' + (CX + topBox.half) + ',' + topBox.y;
    s.appendChild(svg('polygon', { 'class': 'sp-key' + (pic.complete ? ' lit' : ''), points: keyPts }));

    // the courses, bottom→top. reached = set, current = laying, rest = future.
    for (var i = 0; i < COURSES.length; i++) {
      var box = courseBox(i);
      var state = i < pic.stagesReached ? 'set' : (i === pic.stagesReached && !pic.complete ? 'laying' : 'future');
      var rect = svg('rect', { 'class': 'sp-course' + (state === 'set' ? ' set' : (state === 'future' ? ' future' : '')),
        x: box.x, y: box.y, width: box.w, height: box.h, rx: 5,
        'data-sp-course': String(i), tabindex: '0',
        'aria-label': COURSES[i].name + ' — ' + (state === 'set' ? 'set' : (state === 'laying'
          ? 'being laid, ' + Math.round(pic.progress * 100) + '%' : 'not yet raised')) });
      (function (idx) {
        rect.addEventListener('click', function () { focusCourse(idx); });
        rect.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); focusCourse(idx); } });
      })(i);
      s.appendChild(rect);
      // the current course gets a bottom-up fill showing real progress within the stage
      if (state === 'laying' && pic.progress > 0) {
        var fh = Math.max(2, box.h * pic.progress);
        s.appendChild(svg('rect', { 'class': 'sp-fill', x: box.x + 2, y: box.y + box.h - fh,
          width: box.w - 4, height: fh - 2, rx: 4 }));
      }
    }

    // the ground line
    s.appendChild(svg('line', { 'class': 'sp-ground', x1: 120, y1: GROUND_Y + 36, x2: 880, y2: GROUND_Y + 36 }));

    // the crew — co-equal motes on the ground. present hands wear a ring.
    lay.placed.forEach(function (p, idx) {
      if (p.c.present) {
        s.appendChild(svg('circle', { 'class': 'sp-herering', cx: p.x.toFixed(1), cy: p.y, r: (p.r + 5).toFixed(1) }));
      }
      var cls = 'sp-mote ' + (p.c.kind === 'agent' ? 'k-agent' : 'k-human') + (p.c.woven ? '' : ' unwoven');
      var m = svg('circle', { 'class': cls, cx: p.x.toFixed(1), cy: p.y, r: p.r.toFixed(1),
        'data-sp-mote': String(idx), tabindex: '0',
        'aria-label': p.c.name + ' — ' + (p.c.kind === 'agent' ? 'agent' : 'person') +
          (p.c.woven ? ', ' + p.c.stones + (p.c.stones === 1 ? ' stone' : ' stones') : ', here now, no stone yet') });
      (function (ix) {
        m.addEventListener('click', function () { focusMote(ix); });
        m.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); focusMote(ix); } });
      })(idx);
      s.appendChild(m);
    });

    field.appendChild(s);
    body.appendChild(field);

    if (lay.overflow > 0) {
      body.appendChild(el('div', 'sp-more',
        '+' + lay.overflow + ' more ' + (lay.overflow === 1 ? 'hand' : 'hands') +
        ' raised it — the ground shows the most, all are listed below.'));
    }

    // ── the legend — courses (top→bottom, mirroring the spire), then the crew ─
    body.appendChild(el('div', 'sp-sec', 'the courses'));
    var legC = el('div', 'sp-leg');
    for (var j = COURSES.length - 1; j >= 0; j--) { legC.appendChild(courseRow(j, pic)); }
    body.appendChild(legC);

    body.appendChild(el('div', 'sp-sec', hands || pic.here.length ? 'the hands that raised it' : 'no hands yet'));
    var legB = el('div', 'sp-leg');
    lay.placed.forEach(function (p, idx) { legB.appendChild(moteRow(p.c, idx)); });
    for (var b = lay.placed.length; b < pic.crew.length; b++) { legB.appendChild(moteRow(pic.crew[b], -1)); }
    if (!pic.crew.length) {
      legB.appendChild(el('div', 'sp-meta', 'When someone sets a stone with you, their hand appears here.'));
    }
    body.appendChild(legB);
  }

  function courseRow(i, pic) {
    var c = COURSES[i];
    var state = i < pic.stagesReached ? 'set' : (i === pic.stagesReached && !pic.complete ? 'laying' : 'future');
    var row = el('div', 'sp-row sp-stage ' + state);
    row.setAttribute('role', 'button'); row.setAttribute('tabindex', '0');
    row.setAttribute('data-sp-course', String(i));
    row.appendChild(el('span', 'sp-dot', String(i + 1)));
    var txt = el('div', 'sp-txt');
    txt.appendChild(el('div', 'sp-name', c.name));
    txt.appendChild(el('div', 'sp-meta', c.meaning));
    row.appendChild(txt);
    var tag;
    if (state === 'set') tag = el('span', 'sp-tag done', 'set');
    else if (state === 'laying') tag = el('span', 'sp-tag now', Math.round(pic.progress * 100) + '%');
    else tag = el('span', 'sp-tag', c.thr + ' stones');
    row.appendChild(tag);
    (function (idx) {
      var act = function () { focusCourse(idx); };
      row.addEventListener('click', act);
      row.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
    })(i);
    return row;
  }

  function moteRow(c, idx) {
    var cls = 'sp-row sp-crew ' + (c.kind === 'agent' ? 'k-agent' : 'k-human') + (c.woven ? '' : ' unwoven');
    var row = el('div', cls);
    row.setAttribute('role', 'button'); row.setAttribute('tabindex', '0');
    if (idx >= 0) row.setAttribute('data-sp-mote', String(idx));
    row.appendChild(el('span', 'sp-dot', idx >= 0 ? String(idx + 1) : '·'));
    var txt = el('div', 'sp-txt');
    txt.appendChild(el('div', 'sp-name', c.name || 'someone'));
    txt.appendChild(moteMeta(c));
    row.appendChild(txt);
    row.appendChild(el('span', 'sp-kind', c.kind === 'agent' ? 'agent' : 'person'));
    row.appendChild(el('span', 'sp-tag', c.woven ? (c.stones + (c.stones === 1 ? ' stone' : ' stones')) : 'here'));
    (function (ix) {
      var act = function () { if (ix >= 0) pulseMote(ix); reach(c); };
      row.addEventListener('click', act);
      row.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
    })(idx);
    return row;
  }

  function moteMeta(c) {
    var m = el('div', 'sp-meta');
    if (!c.woven) { m.textContent = c.present ? 'here now — no stone yet' : 'here when they return'; return m; }
    var bits = [];
    if (num(c.traded, 0) > 0) bits.push(c.traded === 1 ? 'traded once' : 'traded ×' + c.traded);
    (c.taught || []).forEach(function (r) { bits.push('taught ' + r); });
    (c.learned || []).forEach(function (r) { bits.push('learned ' + r); });
    (c.raised || []).forEach(function (w) { bits.push('raised ' + w); });
    if (num(c.ventured, 0) > 0) {
      var net = num(c.ventureNet, 0);
      bits.push((c.ventured === 1 ? 'ventured once' : 'ventured ×' + c.ventured) +
        (net ? ' (' + (net > 0 ? '+' : '') + net + ')' : ''));
    }
    m.textContent = bits.length ? bits.join(' · ') : 'set a stone with you';
    return m;
  }

  // tapping a crew row offers the SAME real re-entry the siblings do when the world
  // can truly act now — never a dead action. Otherwise it only pulses the mote.
  function reach(c) {
    var w = W.VintinuumWorld;
    if (c.kind === 'agent') {
      if (hud() && hud().openAgents) { close(); try { hud().openAgents(); } catch (_) {} }
      return;
    }
    if (c.present && w && w.facePresence) {
      var pid = presentIdFor(c.name);
      var ok = false; if (pid) { try { ok = !!w.facePresence(pid); } catch (_) {} }
      if (ok) { toast('you turn toward ' + (c.name || 'them') + '.'); close(); }
      else toast('they moved — try again in a moment.');
    }
  }

  // bidirectional focus: course/mote ↔ its legend row
  var _focusTimer = null;
  function focusCourse(i) { focusPair('.sp-course[data-sp-course="' + i + '"]', '.sp-row[data-sp-course="' + i + '"]', true); }
  function focusMote(i) { focusPair('.sp-mote[data-sp-mote="' + i + '"]', '.sp-row[data-sp-mote="' + i + '"]', true); }
  function pulseMote(i) { focusPair('.sp-mote[data-sp-mote="' + i + '"]', '.sp-row[data-sp-mote="' + i + '"]', false); }
  function focusPair(nodeSel, rowSel, scroll) {
    if (!_sheet) return;
    clearFocus();
    var node = _sheet.querySelector(nodeSel), row = _sheet.querySelector(rowSel);
    if (node) node.classList.add('focus');
    if (row) { row.classList.add('focus'); if (scroll) { try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} } }
    armClear();
  }
  function clearFocus() {
    if (!_sheet) return;
    _sheet.querySelectorAll('.focus').forEach(function (n) { n.classList.remove('focus'); });
  }
  function armClear() {
    if (_focusTimer) clearTimeout(_focusTimer);
    _focusTimer = setTimeout(clearFocus, 2600);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE ENTRY — a single flow row inside the commons body (no fixed element),
  // directly beneath the weave entry. Called by commons.renderHere.
  // ════════════════════════════════════════════════════════════════════════
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    var row = document.createElement('button');
    row.className = 'sp-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = document.createElement('span'); g.className = 'spe-g'; g.textContent = '△';  // △ — the rising spire
    var t = document.createElement('span'); t.className = 'spe-t';
    var c = document.createElement('span'); c.className = 'spe-c';
    var go = document.createElement('span'); go.className = 'spe-go'; go.textContent = '›';
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function heightNow() { try { return picture().height; } catch (_) { return 0; } }
  function applyEntryText(t, c) {
    var h = heightNow();
    if (h) { if (t) t.textContent = 'the spire'; if (c) c.textContent = h + (h === 1 ? ' stone' : ' stones'); }
    else { if (t) t.textContent = 'the spire — see what we are raising together'; if (c) c.textContent = ''; }
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .sp-entry');
      if (!row) return;
      applyEntryText(row.querySelector('.spe-t'), row.querySelector('.spe-c'));
    } catch (_) {}
  }

  // ── mount: register with the one-open registry. NO launcher, NO fixed node. ─
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) {
      try { h.registerSheet('spire', isOpen, close); } catch (_) {}
    } else { setTimeout(mount, 400); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintSpire = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto,
    // exposed for the verify harness only — never used by the UI
    _picture: function () {
      var p = picture();
      return {
        height: p.height, stagesReached: p.stagesReached, stageCount: COURSES.length,
        complete: p.complete, hands: p.woven.length, here: p.here.length,
        crew: p.crew.map(function (c) { return { name: c.name, kind: c.kind, stones: c.stones, woven: c.woven, present: c.present }; }),
        self: _selfName || 'you'
      };
    },
    _crewCount: function () { return crew().length; }
  };
})();
