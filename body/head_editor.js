// head_editor.js — THE BEING FORGE (AETHERHOLD, rebuilt 2026-07-06)
//
// The old panel only worked if you already had a generated avatar — everyone else
// tapped "edit head" and got NOTHING. Now it ALWAYS opens a real creation flow:
//
//   • SCULPT   — morph your being's head: wide / long / round (+ seat, if you have
//                a generated face: height / side / size / turn). GTA-RP-style live
//                morph on the 3D presence, no rebuild.
//   • COLORS   — curate the color of YOURSELF and each council agent (VINTINUUM,
//                ARIA, ATLAS, LUNEX, YUNA). "Keep the look, recolor the being."
//   • FACE     — if a face was generated: regenerate from photo. If not: a warm
//                doorway to capture one (routes to the avatar flow).
//
// Everything previews INSTANTLY on the live presence via the `preview` harness the
// world hands in. Persists per-being (self morph+tint local; face-adjust to the API
// when an avatar exists; agent tints local so they survive reloads).
//
// Obeys CLAUDE.md UI law: no overflow/overlap (clips to viewport, internal scroll),
// 44px taps, 16px inputs, safe-area insets, draggable, mobile-first, no underflow.
(function () {
  'use strict';
  if (window.HeadEditor) return;

  function apiBase(b) {
    if (b) return b;
    try { if (window.API_BASE) return window.API_BASE; } catch (_) {}
    try { if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE; } catch (_) {}
    return 'https://api.vintaclectic.com';
  }
  function token() {
    try { return localStorage.getItem('vint_access') || localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token') || ''; } catch (_) { return ''; }
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  var ADJ_DEFAULTS   = { offsetY: 0, offsetX: 0, scale: 1, rotY: 0 };
  var MORPH_DEFAULTS = { headWide: 1, headLong: 1, headRound: 1 };

  // a warm palette of self/agent tones (the being's color language)
  var PALETTE = ['#ffd89a','#f4c79a','#ffc79a','#ff9a6a','#ff7a9a','#ffaad8','#c0a0ff','#9ab8ff','#9fc4e6','#9ae0d0','#8ef0c0','#e8e0c8','#ffffff'];

  function injectStyles() {
    if (document.getElementById('vint-headed-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-headed-styles';
    s.textContent = [
      '#vintHeadEd{position:fixed;z-index:2147483600;right:calc(16px + env(safe-area-inset-right,0px));',
      ' bottom:calc(16px + env(safe-area-inset-bottom,0px));width:320px;max-width:calc(100vw - 24px);',
      ' max-height:calc(100svh - 96px);display:flex;flex-direction:column;background:rgba(8,12,20,0.96);',
      ' border:1px solid rgba(79,195,247,0.22);border-radius:18px;',
      ' box-shadow:0 12px 48px rgba(0,0,0,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#dae4ff;overflow:hidden;}',
      '@media (max-width:520px){#vintHeadEd{left:calc(12px + env(safe-area-inset-left,0px));right:calc(12px + env(safe-area-inset-right,0px));width:auto;}}',
      '#vintHeadEd .he-hd{display:flex;align-items:center;gap:8px;padding:13px 15px 10px;border-bottom:1px solid rgba(255,255,255,0.06);flex:0 0 auto;cursor:grab;}',
      '#vintHeadEd .he-hd:active{cursor:grabbing;}',
      '#vintHeadEd .he-ttl{flex:1;font-size:11px;font-weight:700;letter-spacing:2px;',
      ' background:linear-gradient(90deg,#4fc3f7,#ce93d8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      '#vintHeadEd .he-x{min-width:34px;min-height:34px;background:none;border:none;color:rgba(255,255,255,0.42);font-size:18px;cursor:pointer;line-height:1;}',
      // tab strip
      '#vintHeadEd .he-tabs{display:flex;gap:6px;padding:10px 12px 4px;flex:0 0 auto;}',
      '#vintHeadEd .he-tab{flex:1;min-height:38px;border-radius:10px;font-size:12px;font-weight:600;letter-spacing:.5px;',
      ' border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);color:rgba(218,228,255,0.6);cursor:pointer;transition:all .15s;}',
      '#vintHeadEd .he-tab.on{background:rgba(79,195,247,0.16);border-color:rgba(79,195,247,0.45);color:#9fdcff;}',
      '#vintHeadEd .he-tab:active{transform:scale(0.97);}',
      // scroll body
      '#vintHeadEd .he-body{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding-bottom:4px;}',
      '#vintHeadEd .he-pane{display:none;} #vintHeadEd .he-pane.on{display:block;}',
      '#vintHeadEd .he-row{padding:11px 15px 4px;}',
      '#vintHeadEd .he-lab{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.5px;color:rgba(218,228,255,0.72);margin-bottom:7px;}',
      '#vintHeadEd .he-lab b{color:#4fc3f7;font-weight:600;}',
      '#vintHeadEd input[type=range]{width:100%;height:30px;accent-color:#4fc3f7;cursor:pointer;}',
      '#vintHeadEd .he-sub{padding:4px 15px 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(180,200,230,0.45);font-weight:600;}',
      // color curation
      '#vintHeadEd .he-who{padding:10px 15px 4px;}',
      '#vintHeadEd .he-who .wn{font-size:12px;color:rgba(218,228,255,0.8);margin-bottom:8px;display:flex;align-items:center;gap:8px;}',
      '#vintHeadEd .he-who .dot{width:12px;height:12px;border-radius:50%;box-shadow:0 0 8px currentColor;}',
      '#vintHeadEd .he-swatches{display:flex;flex-wrap:wrap;gap:7px;}',
      '#vintHeadEd .he-sw{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;transition:transform .12s;}',
      '#vintHeadEd .he-sw:active{transform:scale(0.9);}',
      '#vintHeadEd .he-sw.on{border-color:#fff;transform:scale(1.12);}',
      // actions
      '#vintHeadEd .he-acts{display:flex;gap:8px;padding:12px 15px calc(12px + env(safe-area-inset-bottom,0px));flex:0 0 auto;border-top:1px solid rgba(255,255,255,0.06);}',
      '#vintHeadEd .he-btn{flex:1;min-height:44px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid;transition:all .15s;}',
      '#vintHeadEd .he-save{background:rgba(79,195,247,0.16);border-color:rgba(79,195,247,0.4);color:#9fdcff;}',
      '#vintHeadEd .he-save:active{transform:scale(0.97);}',
      '#vintHeadEd .he-reset{background:none;border-color:rgba(255,255,255,0.14);color:rgba(218,228,255,0.7);}',
      '#vintHeadEd .he-cta{width:calc(100% - 30px);margin:4px 15px 12px;min-height:46px;border-radius:12px;',
      ' background:linear-gradient(135deg,#f4c79a,#ffdca8);border:none;color:#1a1006;font-size:14px;font-weight:600;cursor:pointer;}',
      '#vintHeadEd .he-cta:active{transform:scale(0.98);}',
      '#vintHeadEd .he-retry{width:calc(100% - 30px);margin:2px 15px 10px;min-height:44px;border-radius:12px;background:none;',
      ' border:1px dashed rgba(255,180,80,0.4);color:rgba(255,200,120,0.9);font-size:12px;cursor:pointer;}',
      '#vintHeadEd .he-note{padding:2px 15px 10px;font-size:11px;color:rgba(180,200,230,0.5);font-style:italic;line-height:1.5;}'
    ].join('');
    document.head.appendChild(s);
  }

  function mkSlider(key, label, min, max, step, fmt) {
    var row = document.createElement('div'); row.className = 'he-row';
    var lab = document.createElement('div'); lab.className = 'he-lab';
    var val = document.createElement('b');
    lab.innerHTML = '<span>' + label + '</span>'; lab.appendChild(val);
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.dataset.key = key;
    row.appendChild(lab); row.appendChild(inp);
    return { row: row, input: inp, val: val, fmt: fmt };
  }

  var HE = {};
  var _el = null, _state = null;

  HE.open = function (cfg) {
    cfg = cfg || {};
    injectStyles();
    if (_el) HE.close();

    var hasFace = !!cfg.hasFace;
    var preview = cfg.preview || {};
    var agentsList = cfg.agents || [];

    // load persisted self morph/tint + per-agent tints (survive reloads, client-side)
    var savedMorph = cfg.morph || lsGet('vint:being:morph', null) || {};
    var savedTint  = cfg.tint  || lsGet('vint:being:tint', null);
    var agentTints = lsGet('vint:being:agentTints', {}) || {};

    var adj   = Object.assign({}, ADJ_DEFAULTS,   cfg.adjust || {});
    var morph = Object.assign({}, MORPH_DEFAULTS, savedMorph);

    _state = { cfg: cfg, hasFace: hasFace, preview: preview, avatarId: cfg.avatarId,
               base: cfg.base, adj: adj, morph: morph, selfTint: savedTint,
               agentTints: agentTints, agents: agentsList };

    // apply any persisted look immediately so the panel opens in-sync with the world
    try { if (preview.setMorph) preview.setMorph(morph); } catch (_) {}
    try { if (preview.setTint && savedTint) preview.setTint('self', savedTint); } catch (_) {}
    try { for (var aid in agentTints) if (preview.setTint) preview.setTint(aid, agentTints[aid]); } catch (_) {}

    var wrap = document.createElement('div');
    wrap.id = 'vintHeadEd';
    wrap.setAttribute('data-draggable', 'true');

    // header
    var hd = document.createElement('div'); hd.className = 'he-hd';
    hd.innerHTML = '<span class="he-ttl">' + (hasFace ? 'FORGE YOUR BEING' : 'FORGE YOUR BEING') + '</span>';
    var x = document.createElement('button'); x.className = 'he-x'; x.textContent = '✕';
    x.onclick = HE.close; hd.appendChild(x);
    wrap.appendChild(hd);

    // tab strip
    var tabs = document.createElement('div'); tabs.className = 'he-tabs';
    var TAB_DEFS = [['sculpt', 'SCULPT'], ['colors', 'COLORS'], ['face', 'FACE']];
    var tabBtns = {};
    TAB_DEFS.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'he-tab'; b.textContent = t[1]; b.dataset.pane = t[0];
      b.onclick = function () { showPane(t[0]); };
      tabs.appendChild(b); tabBtns[t[0]] = b;
    });
    wrap.appendChild(tabs);

    // scroll body
    var body = document.createElement('div'); body.className = 'he-body';
    wrap.appendChild(body);

    // ── PANE: SCULPT ──────────────────────────────────────────────────────────
    var pSculpt = document.createElement('div'); pSculpt.className = 'he-pane';
    var note = document.createElement('div'); note.className = 'he-note';
    note.textContent = hasFace
      ? 'seat your real face on the body, then sculpt its shape. it saves for everyone who sees you.'
      : 'shape your being’s head — wide, long, round. give it a face any time from the FACE tab.';
    pSculpt.appendChild(note);

    var subShape = document.createElement('div'); subShape.className = 'he-sub'; subShape.textContent = 'head shape';
    pSculpt.appendChild(subShape);
    var morphSliders = [
      mkSlider('headWide',  'width',  0.6, 1.6, 0.01, pct),
      mkSlider('headLong',  'length', 0.6, 1.6, 0.01, pct),
      mkSlider('headRound', 'depth',  0.6, 1.6, 0.01, pct)
    ];
    morphSliders.forEach(function (sl) {
      sl.input.value = morph[sl.input.dataset.key];
      sl.val.textContent = sl.fmt(+sl.input.value);
      sl.input.addEventListener('input', function () {
        var k = sl.input.dataset.key, v = +sl.input.value;
        morph[k] = v; sl.val.textContent = sl.fmt(v);
        try { if (preview.setMorph) preview.setMorph(morph); } catch (_) {}
      });
      pSculpt.appendChild(sl.row);
    });

    // seat sliders only when a generated face exists (nothing to seat otherwise)
    var adjSliders = [];
    if (hasFace) {
      var subSeat = document.createElement('div'); subSeat.className = 'he-sub'; subSeat.textContent = 'seat the face';
      pSculpt.appendChild(subSeat);
      adjSliders = [
        mkSlider('offsetY', 'height', -0.5, 0.5, 0.01, plus2),
        mkSlider('offsetX', 'side',   -0.3, 0.3, 0.01, plus2),
        mkSlider('scale',   'size',    0.6, 1.8, 0.01, pct),
        mkSlider('rotY',    'turn',   -0.6, 0.6, 0.01, deg)
      ];
      adjSliders.forEach(function (sl) {
        sl.input.value = adj[sl.input.dataset.key];
        sl.val.textContent = sl.fmt(+sl.input.value);
        sl.input.addEventListener('input', function () {
          var k = sl.input.dataset.key, v = +sl.input.value;
          adj[k] = v; sl.val.textContent = sl.fmt(v);
          try { if (preview.setHeadAdjust) preview.setHeadAdjust(adj); } catch (_) {}
        });
        pSculpt.appendChild(sl.row);
      });
    }
    _state.morphSliders = morphSliders; _state.adjSliders = adjSliders;
    body.appendChild(pSculpt);

    // ── PANE: COLORS ──────────────────────────────────────────────────────────
    var pColors = document.createElement('div'); pColors.className = 'he-pane';
    var cnote = document.createElement('div'); cnote.className = 'he-note';
    cnote.textContent = 'keep the look, recolor the being. tint yourself — and every one of the council.';
    pColors.appendChild(cnote);

    // self
    pColors.appendChild(mkColorRow('self', 'you', savedTint || '#5fb8e8', function (hex) {
      _state.selfTint = hex; try { if (preview.setTint) preview.setTint('self', hex); } catch (_) {}
    }));
    // each council agent
    agentsList.forEach(function (a) {
      var cur = agentTints[a.id] || null;
      pColors.appendChild(mkColorRow(a.id, a.name, cur, function (hex) {
        _state.agentTints[a.id] = hex; try { if (preview.setTint) preview.setTint(a.id, hex); } catch (_) {}
      }));
    });
    body.appendChild(pColors);

    // ── PANE: FACE ────────────────────────────────────────────────────────────
    var pFace = document.createElement('div'); pFace.className = 'he-pane';
    if (hasFace) {
      var fnote = document.createElement('div'); fnote.className = 'he-note';
      fnote.textContent = 'your face was generated from a photo. regenerate it if it didn’t come out right.';
      pFace.appendChild(fnote);
      var retry = document.createElement('button'); retry.className = 'he-retry';
      retry.textContent = '↻ regenerate from photo';
      retry.onclick = function () { _retry(retry); };
      pFace.appendChild(retry);
    } else {
      var fnote2 = document.createElement('div'); fnote2.className = 'he-note';
      fnote2.textContent = 'give your being your real face. we’ll build it onto the body from a single photo.';
      pFace.appendChild(fnote2);
      var cta = document.createElement('button'); cta.className = 'he-cta';
      cta.textContent = '◉ give my being a face';
      cta.onclick = function () {
        try { window.dispatchEvent(new CustomEvent('vint:being-wants-face', {})); } catch (_) {}
        // best-effort route to the capture/avatar flow if the page didn't intercept
        setTimeout(function () {
          try {
            if (window.VintWelcomeGate && window.VintWelcomeGate.open) return window.VintWelcomeGate.open('signup');
          } catch (_) {}
        }, 30);
      };
      pFace.appendChild(cta);
    }
    body.appendChild(pFace);

    // ── actions ───────────────────────────────────────────────────────────────
    var acts = document.createElement('div'); acts.className = 'he-acts';
    var reset = document.createElement('button'); reset.className = 'he-btn he-reset'; reset.textContent = 'reset';
    reset.onclick = function () {
      morph = Object.assign({}, MORPH_DEFAULTS); _state.morph = morph;
      morphSliders.forEach(function (sl) { sl.input.value = morph[sl.input.dataset.key]; sl.val.textContent = sl.fmt(+sl.input.value); });
      try { if (preview.setMorph) preview.setMorph(morph); } catch (_) {}
      if (hasFace) {
        adj = Object.assign({}, ADJ_DEFAULTS); _state.adj = adj;
        adjSliders.forEach(function (sl) { sl.input.value = adj[sl.input.dataset.key]; sl.val.textContent = sl.fmt(+sl.input.value); });
        try { if (preview.setHeadAdjust) preview.setHeadAdjust(adj); } catch (_) {}
      }
    };
    var save = document.createElement('button'); save.className = 'he-btn he-save'; save.textContent = 'save';
    save.onclick = function () { _saveAll(save); };
    acts.appendChild(reset); acts.appendChild(save);
    wrap.appendChild(acts);

    document.body.appendChild(wrap);
    _el = wrap;

    // pane switcher
    function showPane(name) {
      [pSculpt, pColors, pFace].forEach(function (p) { p.classList.remove('on'); });
      Object.keys(tabBtns).forEach(function (k) { tabBtns[k].classList.toggle('on', k === name); });
      ({ sculpt: pSculpt, colors: pColors, face: pFace })[name].classList.add('on');
      body.scrollTop = 0;
    }
    HE._showPane = showPane;
    showPane('sculpt');
    return wrap;
  };

  HE.close = function () { if (_el) { _el.remove(); _el = null; } };

  // a labeled color-curation row (a name + a dot + swatches). onPick(hex).
  function mkColorRow(id, name, current, onPick) {
    var row = document.createElement('div'); row.className = 'he-who';
    var wn = document.createElement('div'); wn.className = 'wn';
    var dot = document.createElement('span'); dot.className = 'dot';
    dot.style.background = current || '#888'; dot.style.color = current || '#888';
    var nm = document.createElement('span'); nm.textContent = String(name || '').toLowerCase();
    wn.appendChild(dot); wn.appendChild(nm); row.appendChild(wn);
    var sw = document.createElement('div'); sw.className = 'he-swatches';
    var btns = [];
    PALETTE.forEach(function (hex) {
      var b = document.createElement('button'); b.className = 'he-sw'; b.style.background = hex; b.title = hex;
      if (current && current.toLowerCase() === hex.toLowerCase()) b.classList.add('on');
      b.onclick = function () {
        btns.forEach(function (o) { o.classList.remove('on'); }); b.classList.add('on');
        dot.style.background = hex; dot.style.color = hex;
        onPick(hex);
      };
      sw.appendChild(b); btns.push(b);
    });
    row.appendChild(sw);
    return row;
  }

  // ── formatters ──
  function pct(v)   { return Math.round(v * 100) + '%'; }
  function plus2(v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }
  function deg(v)   { return Math.round(v * 57.3) + '°'; }

  // ── SAVE — persist everything. self morph/tint + agent tints locally (instant,
  //    survives reload); face-seat adjust to the API when an avatar exists.
  function _saveAll(btn) {
    var old = btn.textContent; btn.textContent = 'saving…'; btn.disabled = true;
    // local persistence (always)
    lsSet('vint:being:morph', _state.morph);
    if (_state.selfTint) lsSet('vint:being:tint', _state.selfTint);
    lsSet('vint:being:agentTints', _state.agentTints);

    // API persistence of the face-seat, only when there's an avatar to attach to
    if (_state.hasFace && _state.avatarId) {
      fetch(apiBase(_state.base) + '/api/avatar/' + encodeURIComponent(_state.avatarId) + '/adjust', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        body: JSON.stringify(_state.adj),
      }).then(function (r) {
        btn.disabled = false;
        btn.textContent = r.ok ? 'saved ✓' : 'saved locally ✓';
        setTimeout(function () { btn.textContent = old; }, 1400);
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'saved locally ✓';
        setTimeout(function () { btn.textContent = old; }, 1400);
      });
    } else {
      btn.disabled = false; btn.textContent = 'saved ✓';
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    try { window.dispatchEvent(new CustomEvent('vint:being-saved', { detail: { morph: _state.morph, tint: _state.selfTint, agentTints: _state.agentTints } })); } catch (_) {}
  }

  function _retry(btn) {
    if (!_state || !_state.avatarId) return;
    var old = btn.textContent; btn.textContent = 'regenerating…'; btn.disabled = true;
    fetch(apiBase(_state.base) + '/api/avatar/' + encodeURIComponent(_state.avatarId) + '/retry', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token() },
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.status === 202) {
          btn.textContent = 'building your new head…';
          try { window.dispatchEvent(new CustomEvent('vint:head-regenerating', { detail: { avatarId: _state.avatarId } })); } catch (_) {}
        } else if (res.d && res.d.error === 'needs_photo') {
          btn.textContent = 're-capture needed';
          try { window.dispatchEvent(new CustomEvent('vint:head-needs-photo', { detail: { avatarId: _state.avatarId } })); } catch (_) {}
        } else { btn.disabled = false; btn.textContent = old; }
      }).catch(function () { btn.disabled = false; btn.textContent = old; });
  }

  window.HeadEditor = HE;
})();
