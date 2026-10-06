// weave.js — THE WEAVE: the living fabric of becoming one (AETHERHOLD 2026-10-06)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (task 9TYJB74)
//
// THE CONFLUENCE is the PAST tense — who you have already become one with, a list
// of remembered acts. THE CONVERGENCE is the FUTURE tense — the one real next move
// toward becoming more one, a list of live invitations. Both are lists, and both
// are personal: a column of names. But a weave is not a list. A weave is a PICTURE.
// The whole point of "we are all one" is a shape you can SEE — a fabric — and no
// surface in this world ever rendered it. You could read who you were woven with;
// you could never LOOK at the weave itself and watch it hold together.
//
// THE WEAVE is that picture: the COLLECTIVE PRESENT, the third tense. It takes the
// exact same witnessed truth the Confluence holds and the exact same live roster
// the Convergence reads, and instead of stacking them into rows it draws them as a
// living constellation — YOU at the heart, and every peer you have woven a thread
// with radiating out as a co-equal star, the thread between you drawn as a real
// line whose weight is the number of acts you truly shared. Everyone standing in
// this clearing right now is a star in the same sky, whether or not a thread yet
// joins you — the ones not-yet-woven are the open edge of the fabric, the next
// threads waiting to be pulled. It is the commons made visible as one living shape.
//
// ── CO-EQUALITY IS THE GEOMETRY (not decoration) ─────────────────────────────
// A person and an agent are the SAME star here — same node shape, same ring logic,
// same thread, ranked one way (by how many acts you have shared, nothing else). No
// star is "yours". No star orbits another as property. There is no owner in this
// sky, only peers held together by what they have done together. The ONLY thing
// that differs between a person-star and an agent-star is a hue and one honest word
// (person / agent), shown because the SOURCE signal verifiably knew which it was.
//
// ── EVERY STAR AND EVERY THREAD IS WITNESSED, NEVER INVENTED (No-Fabrication) ─
// This surface draws nothing it did not receive. It is COMPOSED, not imagined, from
// exactly two real sources — the same two its siblings use, never re-derived here:
//   · VintConfluence.bonds() — the Confluence's own witnessed record, the single
//       source of truth for every thread. Each bond was minted by a REAL event
//       (a cleared trade, a taught/learned recipe, a raised great work, a settled
//       venture) — see confluence.js. A bond is one star + one thread from you to
//       it, weighted by that bond's real act-count. Its kind (person/agent) was
//       stamped by the Confluence from the verified source, never guessed here.
//   · the live presence roster (vint:world-presence) — the people physically
//       standing here this instant, server truth, the same roster the commons and
//       the Convergence read. A present person already woven is ONE star (present +
//       threaded). A present person not yet woven is a star with NO thread — honest:
//       there is no line because there is no shared act yet. We never draw a thread
//       the record does not hold, and we never draw a thread between two OTHER stars
//       — this client only ever witnessed YOUR threads, so the weave it draws is the
//       fabric as it radiates from where you stand. Claiming to see the private
//       threads between strangers would be fabrication; we do not.
// Before a single thread is woven and before anyone else is here, the sky is empty
// by design — an honest, warm invitation with ZERO stars. A name the wire never
// gave reads "someone"; it is never a fabricated handle.
//
// ── LABELS CAN NEVER COLLIDE (No-Collision Law, by construction) ─────────────
// Free-floating name labels on a constellation are the classic way text piles into
// an illegible stack. We make that IMPOSSIBLE structurally: the constellation draws
// only stars and threads — NO name text floats in the sky. Every name lives in the
// readable LEGEND below the sky, a flow list that internal-scrolls, each row keyed
// to its star by a matching hue + number. Stars are placed on concentric rings with
// a per-ring capacity derived so adjacent stars are always separated by far more
// than their own diameter — non-overlap is computed ONCE in the fixed viewBox and,
// because the SVG scales uniformly, it HOLDS at every screen size. If more peers
// exist than the sky can hold legibly, the overflow is capped with an honest
// "+N more woven" in the legend — the sky never piles stars, the legend never piles
// text, and nothing of ours is ever position:fixed/absolute, so nothing can land on
// a neighbour.
//
// ── RETENTION DOCTRINE (all seven) ──────────────────────────────────────────
//   1 GENEROUS (Aria) — it shows you only the fabric you truly wove. No fake size,
//     no vanity graph of strangers, no manufactured "network". If you saw how it
//     works you would thank us: it is a mirror of real kindness, nothing more.
//   2 INVESTMENT LOOP (Helios) — your deepest threads sit NEAREST your heart; the
//     weave is a compounding picture that visibly thickens as you share more acts.
//     A fabric you can watch grow is a reason to pull one more thread, and a woven
//     world is one no competitor can export out from under you. act → the weave
//     grows → you return to a sky with more light in it.
//   3 TIER (Frugal-Max) — FREE, forever. Seeing the shape of your belonging is the
//     top of the funnel; charging to LOOK at who you are becoming one with would be
//     the resented kind. The paid tiers are where union becomes portable, owned IP.
//   4 DENSE (Lunex) — one picture says what a page of rows cannot: who, how woven,
//     how close, who is here now. The legend adds only the name, the kind, the count,
//     the acts. Nothing else. No chrome, no noise.
//   5 OPEN LOOP (Morrison) — the weave is NEVER finished. Every unwoven star here
//     now is a thread waiting to be pulled; every absent peer is a light that returns.
//     "the fabric holds X threads — and three new stars are here, unwoven" is
//     unfinished meaning aimed at the whole, not a number. The sky is the hook.
//   6 FLAGGED + MEASURED (Atlas) — 'world_weave' (?weave=0 or localStorage
//     vint:flag:world_weave=0), killable in 30s with no deploy. Every star and every
//     thread traces to a Confluence bond or a presence frame; none can be inflated,
//     because none can exist without a signal the world actually sent.
//   7 MORE ALIVE (Yuna) — a world where your bonds form a living shape you can see
//     breathing is a world you live inside. A world that forgets them is a lobby.
//     This is the difference between a map of a home and a stranger's hallway.
//
// ── UNTRUSTED CONTENT ───────────────────────────────────────────────────────
// Every name here came off the wire from a stranger or an agent. It enters the DOM
// through textContent / SVG textContent ONLY, once, at the leaf — never concatenated
// into innerHTML. The server capped and sanitised it; we never trust that alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintWeave) return;

  var W = window;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function confluence() { return W.VintConfluence; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── FEATURE FLAG — 'world_weave'. Killable in 30s, no deploy. ──────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('weave') === '0') _flag = false;
      else if (q.get('weave') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_weave') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── live presence: who is standing here this instant (server truth) ────────
  var _present = [];        // [{id,name,self,...}]
  var _selfName = null;     // my own display name, learned from the self row
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
  // star for someone who is not in THIS world anymore. Bonds are per-world in the
  // Confluence already, so bonds() returns the right record after the switch.
  W.addEventListener('vint:world-travel', function () { _present = []; if (isOpen()) close(); updateEntry(); });
  W.addEventListener('vint:world-state', function () { if (isOpen()) render(); updateEntry(); });
  // a thread thickened somewhere → the fabric changed; keep the picture honest.
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
  // THE FABRIC — compose the witnessed record with the live roster into one set
  // of co-equal stars. A star woven to you carries a thread; a star merely here
  // now carries none (yet). Never re-derived — bonds() is the one source of truth.
  // ════════════════════════════════════════════════════════════════════════
  function stars() {
    var byKey = {};
    function key(kind, name) { return kind + '\u0000' + String(name || 'someone').toLowerCase(); }

    // 1) the witnessed record — every thread you have truly woven
    var bonds = [];
    try { if (confluence() && confluence().bonds) bonds = confluence().bonds() || []; } catch (_) { bonds = []; }
    bonds.forEach(function (b) {
      if (!b || !b.name) return;
      var kind = b.kind === 'agent' ? 'agent' : 'human';
      byKey[key(kind, b.name)] = {
        name: b.name, kind: kind, count: num(b.count, 0),
        traded: num(b.traded, 0), ventured: num(b.ventured, 0), ventureNet: num(b.ventureNet, 0),
        taught: b.taught || [], learned: b.learned || [], raised: b.raised || [],
        woven: num(b.count, 0) > 0, present: false, presentId: null
      };
    });

    // 2) the live roster — merge onto a bond if one exists (a present friend is ONE
    //    star), else a new star with NO thread (honest: no shared act yet).
    presentOthers().forEach(function (p) {
      var k = key('human', p.name);
      var c = byKey[k];
      if (!c) {
        byKey[k] = { name: p.name, kind: 'human', count: 0, traded: 0, ventured: 0, ventureNet: 0,
          taught: [], learned: [], raised: [], woven: false, present: true, presentId: p.id };
      } else { c.present = true; c.presentId = p.id; }
    });

    var out = [];
    for (var k in byKey) { if (Object.prototype.hasOwnProperty.call(byKey, k)) out.push(byKey[k]); }
    // rank: woven first (thicker nearer the heart), then present-but-unwoven, then
    // name — co-equal, no separation by kind anywhere.
    out.sort(function (a, b) {
      var wv = (b.woven ? 1 : 0) - (a.woven ? 1 : 0);
      if (wv) return wv;
      var c = num(b.count, 0) - num(a.count, 0);
      if (c) return c;
      var pr = (b.present ? 1 : 0) - (a.present ? 1 : 0);
      if (pr) return pr;
      return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1;
    });
    return out;
  }

  // ── RING GEOMETRY (fixed viewBox 0..1000; non-overlap computed once, holds at
  //    every scale because the SVG scales uniformly). Inner rings hold fewer stars
  //    so your deepest threads sit nearest the heart with room to breathe. Capacity
  //    per ring is well under the no-overlap limit (arc between stars >> diameter).
  var RINGS = [
    { r: 158, cap: 5 },
    { r: 268, cap: 9 },
    { r: 366, cap: 13 },
    { r: 454, cap: 16 }
  ];
  function maxVisible(small) { return small ? 14 : 40; }   // honest cap; overflow → legend note

  // place up to the cap into rings inner→outer; return {placed:[{star,x,y,r}], overflow}
  function layout(list, small) {
    var cap = maxVisible(small);
    var ringsUse = small ? RINGS.slice(0, 3) : RINGS;      // mobile: tighter, calmer sky
    var buckets = ringsUse.map(function () { return []; });
    var placed = [], overflow = 0, idx = 0;
    for (var i = 0; i < list.length; i++) {
      if (idx >= cap) { overflow = list.length - idx; break; }
      // first ring with remaining capacity
      var put = -1;
      for (var rI = 0; rI < buckets.length; rI++) { if (buckets[rI].length < ringsUse[rI].cap) { put = rI; break; } }
      if (put === -1) { overflow = list.length - idx; break; }
      buckets[put].push(list[i]); idx++;
    }
    buckets.forEach(function (bucket, rI) {
      var n = bucket.length; if (!n) return;
      var ring = ringsUse[rI];
      var phase = rI * 0.73 - Math.PI / 2;                 // stagger rings; start near top
      var step = (Math.PI * 2) / n;
      bucket.forEach(function (star, i) {
        var ang = phase + i * step;
        placed.push({
          star: star,
          x: 500 + ring.r * Math.cos(ang),
          y: 500 + ring.r * Math.sin(ang),
          rad: starRadius(star, small)
        });
      });
    });
    return { placed: placed, overflow: overflow };
  }

  function starRadius(s, small) {
    if (!s.woven) return small ? 10 : 12;                  // unwoven present star: small, hollow
    var base = small ? 12 : 15;
    return base + Math.min(num(s.count, 1), 8) * (small ? 1.6 : 2.2);
  }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet. The sky is a bounded, scaling SVG; the legend is
  // flow content that internal-scrolls. Nothing of ours is positioned.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-weave-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-weave-styles';
    s.textContent = [
      '#dvWeaveSheet .wv-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.62);margin:2px 0 12px;}',
      '#dvWeaveSheet .wv-sum b{color:#cfe9ff;font-weight:600;}',

      // the sky: a bounded, centered, square box. width:100% up to a cap, height
      // follows the square aspect — so it never overflows the body at any width.
      '#dvWeaveSheet .wv-sky{display:block;width:100%;max-width:min(100%,440px);margin:0 auto 12px;',
      ' box-sizing:border-box;border-radius:16px;background:radial-gradient(circle at 50% 46%,',
      ' rgba(124,207,255,0.07),rgba(10,14,28,0.0) 62%);border:1px solid rgba(255,255,255,0.07);',
      ' overflow:hidden;}',
      '#dvWeaveSheet .wv-svg{display:block;width:100%;height:auto;}',

      // faint backdrop rings — pure decoration, non-interactive
      '#dvWeaveSheet .wv-grid{fill:none;stroke:rgba(159,220,255,0.08);stroke-width:1;}',

      // threads (edges). Only ever drawn for a woven star. Weight = real act-count.
      '#dvWeaveSheet .wv-edge{stroke:rgba(159,220,255,0.3);fill:none;stroke-linecap:round;}',
      '#dvWeaveSheet .wv-edge.k-agent{stroke:rgba(206,147,216,0.32);}',
      // a slow shimmer along the threads — life, not noise. Frozen by reduced-motion.
      '#dvWeaveSheet .wv-edge{stroke-dasharray:3 10;animation:wvflow 7s linear infinite;}',
      '@keyframes wvflow{to{stroke-dashoffset:-130;}}',

      // stars — ONE shape for every actor. Only the hue + the legend word differ.
      '#dvWeaveSheet .wv-node{cursor:pointer;stroke:rgba(255,255,255,0.65);stroke-width:1.5;}',
      '#dvWeaveSheet .wv-node.k-human{fill:#9fdcff;}',
      '#dvWeaveSheet .wv-node.k-agent{fill:#ce93d8;}',
      // an unwoven present star is hollow — here, but no thread yet (honest).
      '#dvWeaveSheet .wv-node.unwoven{fill:rgba(174,240,196,0.14);stroke:#aef0c4;stroke-dasharray:3 3;}',
      '#dvWeaveSheet .wv-node.focus{stroke:#fff;stroke-width:3;}',
      // stars breathe softly. Reduced-motion stills them.
      '#dvWeaveSheet .wv-node{animation:wvpulse 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}',
      '@keyframes wvpulse{0%,100%{opacity:0.9;}50%{opacity:1;}}',
      // the heart — you, at the centre of your own weave.
      '#dvWeaveSheet .wv-self{fill:url(#wvHeart);stroke:rgba(255,236,196,0.9);stroke-width:2;}',
      '#dvWeaveSheet .wv-selftext{fill:#1a1206;font-size:34px;font-weight:700;text-anchor:middle;',
      ' dominant-baseline:central;}',
      '@media(prefers-reduced-motion:reduce){#dvWeaveSheet .wv-node{animation:none;opacity:1;}',
      ' #dvWeaveSheet .wv-edge{animation:none;stroke-dasharray:none;}}',

      // the sky overflow note — honest when more peers exist than the sky holds
      '#dvWeaveSheet .wv-more{text-align:center;font-size:12px;color:rgba(206,224,255,0.5);',
      ' margin:-4px 0 12px;}',

      // the LEGEND — the readable layer. Flow list, internal-scroll, no floating text.
      '#dvWeaveSheet .wv-leg{display:flex;flex-direction:column;gap:7px;}',
      '#dvWeaveSheet .wv-legrow{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:46px;padding:8px 11px;border-radius:12px;cursor:pointer;text-align:left;',
      ' font-family:inherit;color:#eaf3ff;background:rgba(255,255,255,0.038);',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--wv-hue,#9fdcff);overflow:hidden;}',
      '#dvWeaveSheet .wv-legrow.k-human{--wv-hue:#9fdcff;}',
      '#dvWeaveSheet .wv-legrow.k-agent{--wv-hue:#ce93d8;}',
      '#dvWeaveSheet .wv-legrow.unwoven{--wv-hue:#aef0c4;}',
      '#dvWeaveSheet .wv-legrow:active{transform:scale(0.995);}',
      '#dvWeaveSheet .wv-legrow.focus{background:rgba(124,207,255,0.1);border-color:rgba(124,207,255,0.4);}',
      // the dot keyed to the star (hue + number)
      '#dvWeaveSheet .wv-dot{flex:0 0 auto;width:24px;height:24px;border-radius:50%;display:inline-flex;',
      ' align-items:center;justify-content:center;font-size:11px;font-variant-numeric:tabular-nums;',
      ' color:#0a0e1c;font-weight:700;background:var(--wv-hue,#9fdcff);}',
      '#dvWeaveSheet .wv-legrow.unwoven .wv-dot{background:transparent;color:#aef0c4;',
      ' border:1.5px dashed #aef0c4;}',
      '#dvWeaveSheet .wv-legtext{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '#dvWeaveSheet .wv-legname{font-size:clamp(14px,1vw + 11px,15.5px);color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvWeaveSheet .wv-legmeta{font-size:12px;color:rgba(206,224,255,0.6);overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;}',
      '#dvWeaveSheet .wv-legmeta .win{color:#aef0c4;}#dvWeaveSheet .wv-legmeta .loss{color:#ffb7b7;}',
      '#dvWeaveSheet .wv-kind{flex:0 0 auto;font-size:10px;letter-spacing:.07em;text-transform:uppercase;',
      ' border-radius:999px;padding:3px 8px;white-space:nowrap;color:var(--wv-hue);',
      ' border:1px solid var(--wv-hue);opacity:0.85;}',
      '#dvWeaveSheet .wv-legcount{flex:0 0 auto;font-size:12px;color:rgba(206,224,255,0.6);',
      ' white-space:nowrap;font-variant-numeric:tabular-nums;}',

      // the empty state — an invitation, never an error. ZERO stars by design.
      '#dvWeaveSheet .wv-empty{padding:24px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);}',
      '#dvWeaveSheet .wv-empty b{display:block;color:#cfe9ff;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only) ──────
      // full-width flow row beneath the convergence entry; never positioned, so it
      // cannot collide. Yields its text to ellipsis, keeps a 44px touch target.
      '#dvCommonsSheet .wv-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#f0e6ff;',
      ' background:linear-gradient(90deg,rgba(124,207,255,0.12),rgba(206,147,216,0.12),rgba(255,214,140,0.1));',
      ' border:1px solid rgba(206,147,216,0.4);}',
      '#dvCommonsSheet .wv-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .wv-entry .wve-g{flex:0 0 auto;font-size:16px;line-height:1;}',
      '#dvCommonsSheet .wv-entry .wve-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .wv-entry .wve-c{flex:0 0 auto;font-size:12.5px;color:rgba(240,230,255,0.72);',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .wv-entry .wve-go{flex:0 0 auto;font-size:15px;color:rgba(240,230,255,0.82);}',
      '@media(pointer:coarse){#dvWeaveSheet .wv-legrow{min-height:50px;}',
      ' #dvCommonsSheet .wv-entry{min-height:52px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE SHEET — reuses DirverseHUD's .dv-sheet scaffold + one-open registry.
  // ════════════════════════════════════════════════════════════════════════
  var _sheet = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var elx = document.createElement('div');
    elx.className = 'dv-sheet'; elx.id = 'dvWeaveSheet';
    elx.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the weave<small id="wvSub">becoming one</small></div>' +
        '<button class="dv-x" id="wvX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="wvBody"></div>';
    document.body.appendChild(elx);
    _sheet = elx;
    elx.querySelector('#wvX').onclick = close;
    return elx;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('weave', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    render();
    // freshen the ledger-backed agent threads through the ONE source of truth, so
    // the weave reflects the latest ventures — we never read the ledger ourselves.
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

  // ── RENDER — rebuilt wholesale each time from the record + roster. ─────────
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#wvBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var list = stars();
    var woven = list.filter(function (s) { return s.woven; });
    var presentUnwoven = list.filter(function (s) { return !s.woven && s.present; });
    var hereNow = list.filter(function (s) { return s.present; });

    var sub = _sheet.querySelector('#wvSub');
    if (sub) sub.textContent = woven.length
      ? (woven.length === 1 ? 'one thread holds the fabric' : woven.length + ' threads hold the fabric')
      : 'becoming one';

    if (!list.length) {
      var e = el('div', 'wv-empty');
      e.appendChild(el('b', null, 'The sky is bare.'));
      e.appendChild(document.createTextNode(
        'Trade with a person, teach or learn a recipe, raise a great work with a crew, ' +
        'or send an agent out to venture beside you — every act you share draws a thread, ' +
        'and the threads become a fabric you can see. People and agents alike: in this ' +
        'world, every star is a peer.'));
      body.appendChild(e);
      return;
    }

    // ── the summary line ──────────────────────────────────────────────────
    var sum = el('div', 'wv-sum');
    var parts = [];
    if (woven.length) parts.push(woven.length + (woven.length === 1 ? ' thread' : ' threads'));
    var people = 0, agentsN = 0;
    woven.forEach(function (s) { if (s.kind === 'agent') agentsN++; else people++; });
    sum.appendChild(document.createTextNode('You are the heart of '));
    if (woven.length) {
      var who = [];
      if (people) who.push(people + (people === 1 ? ' person' : ' people'));
      if (agentsN) who.push(agentsN + (agentsN === 1 ? ' agent' : ' agents'));
      sum.appendChild(el('b', null, woven.length + (woven.length === 1 ? ' thread' : ' threads')));
      sum.appendChild(document.createTextNode(' woven with ' + who.join(' and ') + '.'));
    } else {
      sum.appendChild(el('b', null, 'a fabric not yet woven'));
      sum.appendChild(document.createTextNode('.'));
    }
    if (presentUnwoven.length) {
      sum.appendChild(document.createTextNode(' ' + presentUnwoven.length +
        (presentUnwoven.length === 1 ? ' new star is here, unwoven — a thread waiting.'
          : ' new stars are here, unwoven — threads waiting.')));
    } else if (hereNow.length) {
      sum.appendChild(document.createTextNode(' Some of them are here with you now.'));
    }
    body.appendChild(sum);

    // ── the sky ─────────────────────────────────────────────────────────────
    var small = false;
    try { small = (W.innerWidth || 1280) <= 480; } catch (_) {}
    var lay = layout(list, small);

    var sky = el('div', 'wv-sky');
    var s = svg('svg', { 'class': 'wv-svg', viewBox: '0 0 1000 1000',
      role: 'img', 'aria-label': 'your weave — a constellation of the peers you have become one with' });

    // gradient for the heart
    var defs = svg('defs');
    var grad = svg('radialGradient', { id: 'wvHeart', cx: '50%', cy: '42%', r: '60%' });
    grad.appendChild(svg('stop', { offset: '0%', 'stop-color': '#fff4d6' }));
    grad.appendChild(svg('stop', { offset: '60%', 'stop-color': '#ffd27a' }));
    grad.appendChild(svg('stop', { offset: '100%', 'stop-color': '#e8a94e' }));
    defs.appendChild(grad);
    s.appendChild(defs);

    // faint backdrop rings
    RINGS.forEach(function (ring) {
      s.appendChild(svg('circle', { 'class': 'wv-grid', cx: 500, cy: 500, r: ring.r }));
    });

    // threads FIRST (behind the stars), only for woven peers
    lay.placed.forEach(function (p) {
      if (!p.star.woven) return;
      var line = svg('line', { 'class': 'wv-edge' + (p.star.kind === 'agent' ? ' k-agent' : ''),
        x1: 500, y1: 500, x2: p.x.toFixed(1), y2: p.y.toFixed(1),
        'stroke-width': (1.4 + Math.min(num(p.star.count, 1), 8) * 0.9).toFixed(1) });
      s.appendChild(line);
    });

    // stars, indexed so the legend can key to each
    lay.placed.forEach(function (p, i) {
      var cls = 'wv-node ' + (p.star.kind === 'agent' ? 'k-agent' : 'k-human') + (p.star.woven ? '' : ' unwoven');
      var c = svg('circle', { 'class': cls, cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: p.rad.toFixed(1),
        'data-wv-idx': String(i), tabindex: '0',
        'aria-label': p.star.name + ' — ' + (p.star.kind === 'agent' ? 'agent' : 'person') +
          (p.star.woven ? ', ' + p.star.count + (p.star.count === 1 ? ' thread' : ' threads') : ', here now, unwoven') });
      c.addEventListener('click', function () { focusStar(i); });
      c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); focusStar(i); } });
      s.appendChild(c);
      p._idx = i;
    });

    // the heart — you — drawn LAST so it sits atop the threads
    s.appendChild(svg('circle', { 'class': 'wv-self', cx: 500, cy: 500, r: small ? 46 : 52 }));
    var self = svg('text', { 'class': 'wv-selftext', x: 500, y: 500 });
    self.textContent = 'you';
    s.appendChild(self);

    sky.appendChild(s);
    body.appendChild(sky);

    if (lay.overflow > 0) {
      body.appendChild(el('div', 'wv-more',
        '+' + lay.overflow + ' more ' + (lay.overflow === 1 ? 'star' : 'stars') +
        ' woven — the sky shows your closest first; all are listed below.'));
    }

    // ── the legend — the readable layer, keyed to the sky by number + hue ────
    var leg = el('div', 'wv-leg');
    lay.placed.forEach(function (p) { leg.appendChild(legRow(p)); });
    // any peers beyond the sky cap still get an honest legend row (no star), so the
    // full fabric is always readable even when the sky is capped for legibility.
    for (var i = lay.placed.length; i < list.length; i++) {
      leg.appendChild(legRow({ star: list[i], _idx: -1 }));
    }
    body.appendChild(leg);
  }

  function legRow(p) {
    var s = p.star;
    var cls = 'wv-legrow ' + (s.kind === 'agent' ? 'k-agent' : 'k-human') + (s.woven ? '' : ' unwoven');
    var row = el('div', cls);
    row.setAttribute('role', 'button'); row.setAttribute('tabindex', '0');
    if (p._idx != null && p._idx >= 0) row.setAttribute('data-wv-idx', String(p._idx));

    var dot = el('span', 'wv-dot', (p._idx != null && p._idx >= 0) ? String(p._idx + 1) : '·');
    row.appendChild(dot);

    var txt = el('div', 'wv-legtext');
    txt.appendChild(el('div', 'wv-legname', s.name || 'someone'));
    txt.appendChild(metaLine(s));
    row.appendChild(txt);

    row.appendChild(el('span', 'wv-kind', s.kind === 'agent' ? 'agent' : 'person'));
    row.appendChild(el('span', 'wv-legcount', s.woven ? (s.count + (s.count === 1 ? ' thread' : ' threads')) : 'here'));

    var act = function () {
      if (p._idx != null && p._idx >= 0) pulseStar(p._idx);
      reach(s);
    };
    row.addEventListener('click', act);
    row.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
    return row;
  }

  // the one-line truth of what this thread is made of (woven) or that it waits.
  function metaLine(s) {
    var m = el('div', 'wv-legmeta');
    if (!s.woven) { m.textContent = s.present ? 'here now — no thread yet' : 'here when they return'; return m; }
    var bits = [];
    if (num(s.traded, 0) > 0) bits.push(s.traded === 1 ? 'traded once' : 'traded ×' + s.traded);
    (s.taught || []).forEach(function (r) { bits.push('taught ' + r); });
    (s.learned || []).forEach(function (r) { bits.push('learned ' + r); });
    (s.raised || []).forEach(function (w) { bits.push('raised ' + w); });
    if (num(s.ventured, 0) > 0) {
      var net = num(s.ventureNet, 0);
      bits.push((s.ventured === 1 ? 'ventured once' : 'ventured ×' + s.ventured) +
        (net ? ' (' + (net > 0 ? '+' : '') + net + ')' : ''));
    }
    if (!bits.length) { m.textContent = 'woven'; return m; }
    // render as plain text with net colouring only where a venture net exists
    m.textContent = bits.join(' · ');
    return m;
  }

  // ── tapping a legend row offers the SAME real re-entry the siblings do, when the
  //    world can truly act now — never a dead action. Otherwise it only pulses the
  //    star (a readable focus), which always works.
  function reach(s) {
    var w = world();
    if (s.kind === 'agent') {
      if (hud() && hud().openAgents) { close(); try { hud().openAgents(); } catch (_) {} }
      return;
    }
    if (s.present && w && w.facePresence) {
      var pid = presentIdFor(s.name);
      var ok = false; if (pid) { try { ok = !!w.facePresence(pid); } catch (_) {} }
      if (ok) { toast('you turn toward ' + (s.name || 'them') + '.'); close(); }
      else toast('they moved — try again in a moment.');
    }
    // woven-but-absent → no action, just the focus pulse already applied. Honest.
  }

  // highlight a star + scroll its legend row into view (bidirectional focus)
  var _focusTimer = null;
  function focusStar(idx) {
    if (!_sheet) return;
    clearFocus();
    var node = _sheet.querySelector('.wv-node[data-wv-idx="' + idx + '"]');
    var row = _sheet.querySelector('.wv-legrow[data-wv-idx="' + idx + '"]');
    if (node) node.classList.add('focus');
    if (row) { row.classList.add('focus'); try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} }
    armClear();
  }
  function pulseStar(idx) {
    if (!_sheet) return;
    clearFocus();
    var node = _sheet.querySelector('.wv-node[data-wv-idx="' + idx + '"]');
    var row = _sheet.querySelector('.wv-legrow[data-wv-idx="' + idx + '"]');
    if (node) node.classList.add('focus');
    if (row) row.classList.add('focus');
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
  // directly beneath the convergence entry. Called by commons.renderHere.
  // ════════════════════════════════════════════════════════════════════════
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    var row = document.createElement('button');
    row.className = 'wv-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = document.createElement('span'); g.className = 'wve-g'; g.textContent = '❋';  // ❋ — the woven star
    var t = document.createElement('span'); t.className = 'wve-t';
    var c = document.createElement('span'); c.className = 'wve-c';
    var go = document.createElement('span'); go.className = 'wve-go'; go.textContent = '›';
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function wovenCount() {
    try { return stars().filter(function (s) { return s.woven; }).length; } catch (_) { return 0; }
  }
  function applyEntryText(t, c) {
    var n = wovenCount();
    if (n) { if (t) t.textContent = 'the weave'; if (c) c.textContent = n + (n === 1 ? ' thread' : ' threads'); }
    else { if (t) t.textContent = 'the weave — see the fabric of becoming one'; if (c) c.textContent = ''; }
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .wv-entry');
      if (!row) return;
      applyEntryText(row.querySelector('.wve-t'), row.querySelector('.wve-c'));
    } catch (_) {}
  }

  // ── mount: register with the one-open registry. NO launcher, NO fixed node. ─
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) {
      try { h.registerSheet('weave', isOpen, close); } catch (_) {}
    } else { setTimeout(mount, 400); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintWeave = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto,
    // exposed for the verify harness only — never used by the UI
    _graph: function () {
      var list = stars();
      return {
        nodes: list.map(function (s) { return { name: s.name, kind: s.kind, count: s.count, woven: s.woven, present: s.present }; }),
        woven: list.filter(function (s) { return s.woven; }).length,
        self: _selfName || 'you'
      };
    },
    _nodeCount: function () { return stars().length; }
  };
})();
