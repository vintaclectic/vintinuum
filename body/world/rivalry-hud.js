/* ════════════════════════════════════════════════════════════════════════════
   rivalry-hud.js — the human side of THE RIVALRY (task S3UDBDV).

   The server (vintinuum-api/world/rivalry.js) lets the council trade, fight and
   coerce each other and you. Most of that is ambient — a line in the clearing's
   shared toast. One act needs your hand: a TITHE. An agent demands a cut of what
   you hold; you pay, or you refuse. Refusing in the clearing costs you nothing
   but the agent remembers, and a grudge-holder can reach you inside a covenant
   march (and only there, and only your unbanked carry).

   The prompt is a bottom sheet raised through DirverseHUD.openSheet, so it owns
   its own box and evicts any other sheet — never an overlay on top of one. The
   two answers sit in a wrapping flex row (each min 140px / 44px tall), so at
   320px they stack instead of colliding. The demand's 45s countdown lives
   inside the sheet; when it lapses the sheet closes itself (the server already
   treats silence as a refusal).

   Also exposes W.VintRival.barter(agentKey, give, want) and .duel(agentKey,
   item, n) so any surface (the agent sheet, a console, an agent of yours) can
   propose a deal or a staked fight through the same server verbs.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = window;
  var _sheet = null, _body = null, _foot = null, _timer = null, _demand = null;

  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function send(o) { try { if (W.World && W.World.send) W.World.send(o); } catch (_) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function style() {
    if (document.getElementById('rvStyle')) return;
    var st = document.createElement('style'); st.id = 'rvStyle';
    st.textContent =
      '#rvSheet .rv-say{font-size:15px;line-height:1.45;color:#eaf3ff;margin:0 0 12px;overflow-wrap:anywhere;}' +
      '#rvSheet .rv-clock{font-size:12px;letter-spacing:.06em;color:rgba(159,220,255,0.65);margin:0 0 14px;}' +
      // the answers live in a non-scrolling footer, so a long demand scrolls in
      // .dv-body above them and a short (keyboard-up) viewport never hides them.
      '#rvSheet .rv-foot{flex:0 0 auto;padding:10px 18px calc(14px + env(safe-area-inset-bottom));}' +
      '#rvSheet .rv-row{display:flex;flex-wrap:wrap;gap:10px;}' +
      '#rvSheet .rv-btn{flex:1 1 140px;box-sizing:border-box;max-width:100%;min-height:44px;border-radius:12px;' +
        'font-family:inherit;font-size:14px;cursor:pointer;border:1px solid rgba(124,207,255,0.35);' +
        'background:rgba(124,207,255,0.12);color:#eaf3ff;padding:10px 12px;}' +
      '#rvSheet .rv-btn.rv-no{border-color:rgba(255,140,120,0.45);background:rgba(255,120,100,0.12);}';
    document.head.appendChild(st);
  }

  function build() {
    if (_sheet) return _sheet;
    style();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'rvSheet';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'a demand');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head"><div class="dv-title" id="rvTitle">a demand<small>the council has teeth</small></div>' +
      '<button class="dv-x" id="rvX" aria-label="close">✕</button></div>' +
      '<div class="dv-body" id="rvBody"></div>' +
      '<div class="rv-foot" id="rvFoot"></div>';
    document.body.appendChild(el);
    _sheet = el; _body = el.querySelector('#rvBody'); _foot = el.querySelector('#rvFoot');
    el.querySelector('#rvX').addEventListener('click', close);
    if (hud() && hud().registerSheet) hud().registerSheet('rival', isOpen, close);
    return el;
  }
  function isOpen() { return !!(_sheet && _sheet.classList.contains('open')); }
  function close() {
    clearInterval(_timer); _timer = null; _demand = null;
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }

  function showDemand(d) {
    build();
    _demand = d;
    var until = Date.now() + (Math.max(5, +d.ttl || 45) * 1000);
    _body.innerHTML =
      '<p class="rv-say">' + esc(d.say || (d.who + ' demands ' + d.n + ' ' + d.item + '.')) + '</p>' +
      '<p class="rv-clock" id="rvClock"></p>';
    _foot.innerHTML =
      '<div class="rv-row">' +
        '<button class="rv-btn" id="rvPay">pay ' + esc(d.n) + ' ' + esc(String(d.item).replace(/_/g, ' ')) + '</button>' +
        '<button class="rv-btn rv-no" id="rvNo">refuse</button>' +
      '</div>';
    var answer = function (pay) { if (!_demand) return; send({ t: 'world:rival:answer', demandId: _demand.id, pay: pay }); close(); };
    _foot.querySelector('#rvPay').addEventListener('click', function () { answer(true); });
    _foot.querySelector('#rvNo').addEventListener('click', function () { answer(false); });
    var tick = function () {
      var left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      var c = document.getElementById('rvClock'); if (c) c.textContent = left + 's to answer — silence is a refusal';
      if (left <= 0) { close(); toast((d.who || 'The agent') + ' takes your silence as a no.'); }
    };
    clearInterval(_timer); _timer = setInterval(tick, 1000); tick();
    var open = function () { _sheet.classList.add('open'); };
    if (hud() && hud().openSheet) hud().openSheet('rival', open); else open();
  }

  W.addEventListener('vint:world-rival', function (e) {
    var m = e.detail || {};
    if (m.t === 'world:rival:demand') showDemand(m);
    else if (m.say) toast(String(m.say));
    else if (m.t === 'world:rival:ambushed' && m.who) toast(m.who + ' ambushed ' + (m.victim || 'someone') + ' in a march.');
  });
  W.addEventListener('vint:world-travel', close);

  W.VintRival = {
    barter: function (agentKey, give, want) { send({ t: 'world:rival:barter', agentKey: agentKey, give: give, want: want }); },
    duel: function (agentKey, item, n) { send({ t: 'world:rival:duel', agentKey: agentKey, item: item, n: n }); },
    grudges: function () { send({ t: 'world:rival:grudges' }); },
    showDemand: showDemand, close: close, isOpen: isOpen
  };
})();
