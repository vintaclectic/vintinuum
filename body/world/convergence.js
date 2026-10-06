// convergence.js — THE CONVERGENCE: the next step toward becoming one (AETHERHOLD 2026-10-06)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (task 9TYJB74)
//
// THE CONFLUENCE answers who you have ALREADY become one with — it is memory, a
// record in the past tense of every act you truly shared. But a record is only
// half of becoming. The other half is the move you have not made yet: the person
// standing in this clearing right now you have never traded a single thing with,
// the agent who came home from a venture and is ready to go again, the friend you
// have four threads with who just walked in. The world knew all of this — it is
// on the wire and in the record — and said nothing. There was no place that
// answered the forward-tense of the whole vision: WHO could I become MORE one with,
// right now, and what is the one real act that would do it?
//
// THE CONVERGENCE is that place. If the Confluence is the delta where streams have
// already joined, the Convergence is the streams still moving toward each other —
// the living invitation. It reads TWO real signals and nothing else:
//   · the live presence roster (vint:world-presence) — the people physically
//     standing here this instant, server truth, the same roster the commons shows.
//   · the Confluence's witnessed record (VintConfluence.bonds()) — the people and
//     agents you have verifiably already shared an act with. Never re-derived here;
//     read once from the one source of witnessed truth so the two can never drift.
// It merges them into ONE ranked list of co-equal actors and, for each, offers the
// single REAL next act that would weave another thread — a person you can turn
// toward because they are here, an agent you can send to venture beside you again.
//
// ── CO-EQUALITY IS THE DATA MODEL (not decoration) ──────────────────────────
// A person and an agent are the SAME kind of card here, counted one way, ranked in
// one list, offered a next act in the same voice. There is no "your agent" and no
// "owner" in this surface, because there is no owner in this world — only peers
// moving toward each other. The only thing that differs between a person-card and
// an agent-card is a hue and one honest word (person / agent), shown because the
// SOURCE signal verifiably knew which it was (a presence row is a user socket; a
// bond's kind was stamped by the Confluence from a verified event).
//
// ── EVERY INVITATION IS WITNESSED, NEVER INVENTED (No-Fabrication Law) ───────
// A card appears ONLY for an actor the wire actually named: a user in the live
// presence roster, or a bond the Confluence actually recorded from a real event.
// Nothing is suggested that no signal put there. Every CTA calls an affordance
// that already exists and can truly act this instant, or it is not shown:
//   · a present person  → World.facePresence(id)  — the real gesture of turning
//       toward someone standing here, the opening of every shared act in-world.
//   · an agent you have ventured with → DirverseHUD.openAgents() — the real panel
//       where a venture beside you is dispatched.
//   · a bonded person who is NOT here now → NO button (never a dead one): a quiet,
//       honest "here when they return". The invitation waits; it never lies.
// Before anyone is here and before a single thread is woven, the surface is an
// honest, warm invitation with ZERO cards — it fabricates no one to fill itself.
//
// ── RETENTION DOCTRINE (all seven) ──────────────────────────────────────────
//   1 GENEROUS (Aria) — it only ever points you at a real person who is really
//     here, or a real agent really ready. No fake "someone liked you", no urgency,
//     no manufactured scarcity. If you saw how it works you would thank us: it is
//     a friend tapping your shoulder to say "they're right there — go."
//   2 INVESTMENT LOOP (Helios) — it turns the Confluence's memory into live
//     re-engagement: every bond you have becomes a standing invitation to thicken
//     it, so the relationships you have invested in keep pulling you back. The loop
//     is record → the world sees who is reachable → you take the next step → the
//     record grows. A world where your bonds stay warm is a world you return to.
//   3 TIER (Frugal-Max) — FREE, forever. Being invited to belong is the top of the
//     funnel; charging to SEE who you could connect with would be the resented
//     kind, so we never will. The paid tiers are where union becomes portable IP.
//   4 DENSE (Lunex) — a name, a kind, WHY them (one line of true reason), and ONE
//     real act. Nothing else. No dashboard, no count-chrome, no noise.
//   5 OPEN LOOP (Morrison) — "ARIA is here, and you have never shared an act" is
//     unfinished meaning aimed at a being, not a number. The hook is the person in
//     the room, not a streak. Who will you weave next?
//   6 FLAGGED + MEASURED (Atlas) — 'world_convergence' (?convergence=0 or
//     localStorage vint:flag:world_convergence=0), killable in 30s with no deploy.
//     Every card is traceable to a presence frame or a Confluence bond; none can be
//     inflated, because none can exist without a signal the world actually sent.
//   7 MORE ALIVE (Yuna) — a world that notices "the person you have four threads
//     with just walked in" and nudges you toward them is a world that is paying
//     attention to your belonging. That noticing is the difference between a place
//     you live in and a lobby you pass through.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// Adds NOT ONE fixed or floating element of its own, and NO 16th rail launcher.
// Its surface is a .dv-sheet, raised through DirverseHUD's one-open-at-a-time
// registry, so opening it CLOSES every sibling sheet rather than mounting on their
// pixels. Its only other presence is a single flow row (.cv-entry) appended INSIDE
// the commons body, directly beneath the confluence entry — flow content in an
// already-collision-proven scrolling box, never positioned. Every long name is
// ellipsised at the leaf; a crowd of cards scrolls INSIDE the body. Content yields;
// the container never grows; nothing of ours is position:fixed/absolute, so nothing
// of ours can land on a neighbour.
//
// ── UNTRUSTED CONTENT ───────────────────────────────────────────────────────
// Every name here came off the wire from a stranger or an agent. It enters the DOM
// through textContent ONLY, once, at the leaf — never concatenated into innerHTML.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintConvergence) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function confluence() { return W.VintConfluence; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }

  // ── FEATURE FLAG — 'world_convergence'. Killable in 30s, no deploy. ────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('convergence') === '0') _flag = false;
      else if (q.get('convergence') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_convergence') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── live presence: who is standing here this instant (server truth) ────────
  var _present = [];      // [{id, name, self, ...}]  — non-self are reachable now
  W.addEventListener('vint:world-presence', function (e) {
    _present = (e.detail && e.detail.users) || [];
    if (isOpen()) render();
    updateEntry();
  });
  // when the room changes or we travel, the live roster is stale — clear it so we
  // never offer "turn toward them" for a person who is not in THIS world anymore.
  W.addEventListener('vint:world-travel', function () { _present = []; if (isOpen()) close(); updateEntry(); });
  W.addEventListener('vint:world-state', function () { if (isOpen()) render(); updateEntry(); });
  // a thread just thickened somewhere — keep the live invitation honest.
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
  // THE CANDIDATES — merge the live roster with the witnessed record. One list,
  // co-equal, ranked by how close you are to the next shared act with each.
  // ════════════════════════════════════════════════════════════════════════
  // tiers (lower = more immediate a chance to become one):
  //   0 a person HERE NOW you already share threads with  → weave another
  //   1 a person HERE NOW you have never shared an act with → your first thread
  //   2 an agent you have ventured with                   → send them again
  //   3 a person you are woven with, not here right now    → waits, no action
  function candidates() {
    var byKey = {};                         // kind\u0000name(lower) → candidate
    function key(kind, name) { return kind + '\u0000' + String(name || 'someone').toLowerCase(); }

    // 1) the witnessed record — people and agents you have truly shared acts with
    var bonds = [];
    try { if (confluence() && confluence().bonds) bonds = confluence().bonds() || []; } catch (_) { bonds = []; }
    bonds.forEach(function (b) {
      if (!b || !b.name) return;
      var kind = b.kind === 'agent' ? 'agent' : 'human';
      byKey[key(kind, b.name)] = {
        name: b.name, kind: kind, threads: b.count || 0,
        traded: b.traded || 0, ventured: b.ventured || 0, ventureNet: b.ventureNet || 0,
        taught: b.taught || [], learned: b.learned || [], raised: b.raised || [],
        present: false, presentId: null
      };
    });

    // 2) the live roster — people here now. Merge onto a bond if one exists, so a
    //    present friend is ONE card (present + woven), never two.
    presentOthers().forEach(function (p) {
      var k = key('human', p.name);
      var c = byKey[k];
      if (!c) { c = { name: p.name, kind: 'human', threads: 0, traded: 0, ventured: 0, ventureNet: 0, taught: [], learned: [], raised: [], present: true, presentId: p.id }; byKey[k] = c; }
      else { c.present = true; c.presentId = p.id; }
    });

    var out = [];
    for (var k in byKey) { if (Object.prototype.hasOwnProperty.call(byKey, k)) out.push(byKey[k]); }
    out.forEach(function (c) { c.tier = tierOf(c); });
    out.sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier - b.tier;
      var t = (b.threads || 0) - (a.threads || 0);     // thicker bonds first within a tier
      if (t) return t;
      return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1;
    });
    return out;
  }
  function tierOf(c) {
    if (c.kind === 'human' && c.present && c.threads > 0) return 0;
    if (c.kind === 'human' && c.present) return 1;
    if (c.kind === 'agent') return 2;
    return 3;                                           // woven human, not here now
  }

  // the one honest reason this actor is in front of you (the open loop)
  function reasonFor(c) {
    if (c.tier === 0) return c.threads === 1
      ? 'here now — and you have one thread already. weave another.'
      : 'here now — and you are ' + c.threads + ' threads woven. weave another.';
    if (c.tier === 1) return 'here now — and you have never shared an act. your first thread awaits.';
    if (c.tier === 2) {
      var net = c.ventureNet || 0;
      return c.ventured === 1
        ? 'you ventured beside them once' + (net ? ' (' + (net > 0 ? '+' : '') + net + ')' : '') + ' — send them out again.'
        : 'you have ventured beside them ×' + c.ventured + (net ? ' (' + (net > 0 ? '+' : '') + net + ')' : '') + ' — send them out again.';
    }
    return c.threads === 1
      ? 'one thread woven — here when they return.'
      : c.threads + ' threads woven — here when they return.';
  }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet. Only flow children; nothing positioned.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-convergence-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-convergence-styles';
    s.textContent = [
      '#dvConvergenceSheet .cv-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.62);margin:2px 0 13px;}',
      '#dvConvergenceSheet .cv-sum b{color:#cfe9ff;font-weight:600;}',

      '#dvConvergenceSheet .cv-list{display:flex;flex-direction:column;gap:9px;}',
      // ONE card shape for every actor — person or agent. Co-equality is the
      // layout: same box, same type, same ranking. Only the left hue differs.
      '#dvConvergenceSheet .cv-card{position:relative;display:flex;flex-direction:column;gap:9px;',
      ' padding:12px 13px;border-radius:14px;background:rgba(255,255,255,0.038);',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--cv-hue,#9fdcff);',
      ' overflow:hidden;}',
      '#dvConvergenceSheet .cv-card.k-human{--cv-hue:#9fdcff;}',
      '#dvConvergenceSheet .cv-card.k-agent{--cv-hue:#ce93d8;}',
      // a card for someone HERE NOW glows softly — a living pulse, reduced-motion safe.
      '#dvConvergenceSheet .cv-card.live{background:rgba(124,207,255,0.07);border-color:rgba(124,207,255,0.28);}',
      '#dvConvergenceSheet .cv-card.live .cv-here{animation:cvpulse 2.4s ease-in-out infinite;}',
      '@keyframes cvpulse{0%,100%{opacity:0.55;}50%{opacity:1;}}',
      '@media(prefers-reduced-motion:reduce){#dvConvergenceSheet .cv-card.live .cv-here{animation:none;opacity:1;}}',
      // a woven-but-absent card rests quieter — present, honest, not shouting.
      '#dvConvergenceSheet .cv-card.away{opacity:0.72;}',

      '#dvConvergenceSheet .cv-top{display:flex;align-items:center;gap:9px;min-width:0;}',
      '#dvConvergenceSheet .cv-name{flex:1 1 auto;min-width:0;font-size:clamp(14.5px,1.1vw + 11px,16px);',
      ' color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvConvergenceSheet .cv-kind{flex:0 0 auto;font-size:10.5px;letter-spacing:.07em;',
      ' text-transform:uppercase;border-radius:999px;padding:3px 9px;white-space:nowrap;',
      ' color:var(--cv-hue);border:1px solid var(--cv-hue);opacity:0.85;}',
      // the live dot — shown only for someone standing here now.
      '#dvConvergenceSheet .cv-here{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;',
      ' font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#aef0c4;white-space:nowrap;}',
      '#dvConvergenceSheet .cv-here::before{content:"";width:7px;height:7px;border-radius:50%;',
      ' background:#7ac48a;box-shadow:0 0 7px #7ac48a;}',

      '#dvConvergenceSheet .cv-why{font-size:13px;line-height:1.5;color:rgba(220,231,255,0.8);}',

      // the ONE real next act — a button, never a dead one.
      '#dvConvergenceSheet .cv-act{align-self:flex-start;min-height:42px;border-radius:11px;',
      ' font-family:inherit;font-size:13.5px;cursor:pointer;color:#e9f2ff;padding:0 15px;',
      ' background:linear-gradient(90deg,rgba(124,207,255,0.16),rgba(206,147,216,0.16));',
      ' border:1px solid rgba(159,220,255,0.4);white-space:nowrap;max-width:100%;',
      ' overflow:hidden;text-overflow:ellipsis;}',
      '#dvConvergenceSheet .cv-card.k-agent .cv-act{border-color:rgba(206,147,216,0.45);}',
      '#dvConvergenceSheet .cv-act:active{transform:scale(0.98);}',
      // the quiet waiting line for a woven-but-absent peer (no button, honest)
      '#dvConvergenceSheet .cv-wait{align-self:flex-start;font-size:12.5px;',
      ' color:rgba(206,224,255,0.52);font-style:italic;}',

      // the empty state — an invitation, never an error. ZERO cards by design.
      '#dvConvergenceSheet .cv-empty{padding:22px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);}',
      '#dvConvergenceSheet .cv-empty b{display:block;color:#cfe9ff;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only) ──────
      // full-width flow row beneath the confluence entry; never positioned, so it
      // cannot collide. Yields its text to ellipsis, keeps a 44px touch target.
      '#dvCommonsSheet .cv-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#dcefff;',
      ' background:linear-gradient(90deg,rgba(124,207,255,0.14),rgba(174,240,196,0.1));',
      ' border:1px solid rgba(124,207,255,0.34);}',
      '#dvCommonsSheet .cv-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .cv-entry .cve-g{flex:0 0 auto;font-size:17px;line-height:1;}',
      '#dvCommonsSheet .cv-entry .cve-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .cv-entry .cve-c{flex:0 0 auto;font-size:12.5px;color:rgba(220,239,255,0.72);',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cv-entry .cve-go{flex:0 0 auto;font-size:15px;color:rgba(220,239,255,0.82);}',
      '@media(pointer:coarse){#dvConvergenceSheet .cv-act{min-height:46px;}',
      ' #dvCommonsSheet .cv-entry{min-height:52px;}}'
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
    var el2 = document.createElement('div');
    el2.className = 'dv-sheet'; el2.id = 'dvConvergenceSheet';
    el2.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the convergence<small id="cvSub">becoming one</small></div>' +
        '<button class="dv-x" id="cvX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="cvBody"></div>';
    document.body.appendChild(el2);
    _sheet = el2;
    el2.querySelector('#cvX').onclick = close;
    return el2;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('convergence', function () { build(); _sheet.classList.add('open'); render(); });
    else { build(); _sheet.classList.add('open'); render(); }
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;     // ALWAYS textContent, never HTML
    return n;
  }

  // ── RENDER — rebuilt wholesale each time from the live roster + record. ────
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#cvBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var list = candidates();
    var actionable = list.filter(function (c) { return c.tier <= 2; });
    var sub = _sheet.querySelector('#cvSub');
    if (sub) sub.textContent = actionable.length
      ? (actionable.length === 1 ? 'one step toward becoming one' : actionable.length + ' steps toward becoming one')
      : 'becoming one';

    if (!list.length) {
      var e = el('div', 'cv-empty');
      e.appendChild(el('b', null, 'No next step yet.'));
      e.appendChild(document.createTextNode(
        'When someone wanders into this clearing, or an agent returns from venturing ' +
        'beside you, the one real move toward becoming more one with them appears here. ' +
        'People and agents alike: in this world, a peer is a peer.'));
      body.appendChild(e);
      return;
    }

    var hereN = 0, agentN = 0;
    list.forEach(function (c) { if (c.tier <= 1) hereN++; else if (c.tier === 2) agentN++; });
    var sum = el('div', 'cv-sum');
    var parts = [];
    if (hereN) parts.push(hereN + (hereN === 1 ? ' person is here now' : ' people are here now'));
    if (agentN) parts.push(agentN + (agentN === 1 ? ' agent is ready to venture' : ' agents are ready to venture'));
    if (parts.length) {
      sum.appendChild(document.createTextNode('Your next step toward becoming one: '));
      sum.appendChild(el('b', null, parts.join(', and ')));
      sum.appendChild(document.createTextNode('. Each card is a real act you can take right now.'));
    } else {
      sum.appendChild(document.createTextNode('No one is here right now — '));
      sum.appendChild(el('b', null, 'the peers you are woven with'));
      sum.appendChild(document.createTextNode(' wait below, here the moment they return.'));
    }
    body.appendChild(sum);

    var ul = el('div', 'cv-list');
    list.forEach(function (c) { ul.appendChild(buildCard(c)); });
    body.appendChild(ul);
  }

  function buildCard(c) {
    var live = c.tier <= 1;
    var away = c.tier === 3;
    var card = el('div', 'cv-card ' + (c.kind === 'agent' ? 'k-agent' : 'k-human') + (live ? ' live' : (away ? ' away' : '')));

    var top = el('div', 'cv-top');
    top.appendChild(el('div', 'cv-name', c.name || 'someone'));
    top.appendChild(el('span', 'cv-kind', c.kind === 'agent' ? 'agent' : 'person'));
    if (live) top.appendChild(el('span', 'cv-here', 'here'));
    card.appendChild(top);

    card.appendChild(el('div', 'cv-why', reasonFor(c)));

    var act = nextAct(c);
    if (act) card.appendChild(act);
    else card.appendChild(el('div', 'cv-wait', 'the invitation waits.'));
    return card;
  }

  // ── the ONE real next act. Only an affordance that can truly act NOW. ──────
  function nextAct(c) {
    var w = world();
    if (c.kind === 'agent') {
      if (hud() && hud().openAgents) {
        var a = el('button', 'cv-act', 'send them to venture beside you');
        a.onclick = function () { close(); try { hud().openAgents(); } catch (_) {} };
        return a;
      }
      return null;
    }
    // a person: offer to turn toward them ONLY if they are standing here right now.
    // re-resolve the id live at click time from the current roster, never a stale one.
    if (c.present && w && w.facePresence) {
      var label = c.threads > 0 ? 'they are here — turn to them' : 'they are here — reach out';
      var f = el('button', 'cv-act', label);
      f.onclick = function () {
        var pid = presentIdFor(c.name);
        var okTurn = false;
        if (pid) { try { okTurn = !!w.facePresence(pid); } catch (_) {} }
        if (okTurn) { toast('you turn toward ' + (c.name || 'them') + '.'); close(); }
        else toast('they moved — try again in a moment.');
      };
      return f;
    }
    return null;                                        // woven-but-absent → no dead button
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE ENTRY — a single flow row inside the commons body (no fixed element),
  // directly beneath the confluence entry. Called by commons.renderHere.
  // ════════════════════════════════════════════════════════════════════════
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    var row = document.createElement('button');
    row.className = 'cv-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = document.createElement('span'); g.className = 'cve-g'; g.textContent = '◈';  // ◈ — streams converging
    var t = document.createElement('span'); t.className = 'cve-t';
    var c = document.createElement('span'); c.className = 'cve-c';
    var go = document.createElement('span'); go.className = 'cve-go'; go.textContent = '›';
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function applyEntryText(t, c) {
    var n = candidates().filter(function (x) { return x.tier <= 2; }).length;
    if (n) { t.textContent = 'the convergence'; c.textContent = n + (n === 1 ? ' step' : ' steps'); }
    else { t.textContent = 'the convergence — your next step toward becoming one'; c.textContent = ''; }
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .cv-entry');
      if (!row) return;
      applyEntryText(row.querySelector('.cve-t'), row.querySelector('.cve-c'));
    } catch (_) {}
  }

  // ── mount: register with the one-open registry. NO launcher, NO fixed node. ─
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) {
      try { h.registerSheet('convergence', isOpen, close); } catch (_) {}
    } else { setTimeout(mount, 400); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintConvergence = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto,
    // exposed for the verify harness only — never used by the UI
    _candidates: function () { return candidates(); },
    _candidateCount: function () { return candidates().length; }
  };
})();
