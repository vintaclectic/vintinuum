// head_editor.js — let the user fine-tune how their molded head sits on the body.
// (Vinta directive 2026-06-15: "allow them to edit it afterward")
//
// One reusable panel. Call HeadEditor.open({ avatarId, presence, base }) where:
//   avatarId  → the avatar to persist adjustments to (PUT /api/avatar/:id/adjust)
//   presence  → optional RiggedPresence handle for LIVE preview (setHeadAdjust)
//   base      → optional API base override
//
// Controls: height (offsetY), side (offsetX), size (scale), turn (rotY), retry.
// Sliders preview instantly on the 3D head; Save persists; Retry regenerates from
// the source photo (or routes to re-capture if the photo was released).
//
// Obeys CLAUDE.md UI law: no overflow/overlap (panel clips to viewport, internal
// scroll), 44px taps, 16px inputs, safe-area insets, draggable, mobile-first.
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
    try { return localStorage.getItem('vint_access') || localStorage.getItem('vint_access_token') || ''; } catch (_) { return ''; }
  }

  var DEFAULTS = { offsetY: 0, offsetX: 0, scale: 1, rotY: 0 };

  function injectStyles() {
    if (document.getElementById('vint-headed-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-headed-styles';
    s.textContent = [
      '#vintHeadEd{position:fixed;z-index:2147483600;right:calc(16px + env(safe-area-inset-right,0px));',
      ' bottom:calc(16px + env(safe-area-inset-bottom,0px));width:300px;max-width:calc(100vw - 32px);',
      ' max-height:calc(100svh - 120px);overflow-y:auto;background:rgba(8,12,20,0.96);',
      ' border:1px solid rgba(79,195,247,0.22);border-radius:18px;',
      ' box-shadow:0 12px 48px rgba(0,0,0,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
      ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#dae4ff;}',
      '#vintHeadEd .he-hd{display:flex;align-items:center;gap:8px;padding:13px 15px 10px;border-bottom:1px solid rgba(255,255,255,0.06);}',
      '#vintHeadEd .he-ttl{flex:1;font-size:11px;font-weight:700;letter-spacing:2px;',
      ' background:linear-gradient(90deg,#4fc3f7,#ce93d8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      '#vintHeadEd .he-x{min-width:32px;min-height:32px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;line-height:1;}',
      '#vintHeadEd .he-row{padding:11px 15px 4px;}',
      '#vintHeadEd .he-lab{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.5px;color:rgba(218,228,255,0.7);margin-bottom:7px;}',
      '#vintHeadEd .he-lab b{color:#4fc3f7;font-weight:600;}',
      '#vintHeadEd input[type=range]{width:100%;height:28px;accent-color:#4fc3f7;cursor:pointer;}',
      '#vintHeadEd .he-acts{display:flex;gap:8px;padding:12px 15px calc(14px + env(safe-area-inset-bottom,0px));}',
      '#vintHeadEd .he-btn{flex:1;min-height:44px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid;transition:all .15s;}',
      '#vintHeadEd .he-save{background:rgba(79,195,247,0.16);border-color:rgba(79,195,247,0.4);color:#9fdcff;}',
      '#vintHeadEd .he-save:active{transform:scale(0.97);}',
      '#vintHeadEd .he-reset{background:none;border-color:rgba(255,255,255,0.14);color:rgba(218,228,255,0.7);}',
      '#vintHeadEd .he-retry{width:100%;min-height:44px;margin-top:2px;border-radius:12px;background:none;',
      ' border:1px dashed rgba(255,180,80,0.4);color:rgba(255,200,120,0.9);font-size:12px;cursor:pointer;}',
      '#vintHeadEd .he-note{padding:0 15px 10px;font-size:11px;color:rgba(180,200,230,0.5);font-style:italic;line-height:1.5;}'
    ].join('');
    document.head.appendChild(s);
  }

  function mkSlider(key, label, min, max, step, fmt) {
    var row = document.createElement('div'); row.className = 'he-row';
    var lab = document.createElement('div'); lab.className = 'he-lab';
    var val = document.createElement('b');
    lab.innerHTML = '<span>' + label + '</span>'; lab.appendChild(val);
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.dataset.key = key;
    row.appendChild(lab); row.appendChild(inp);
    return { row: row, input: inp, val: val, fmt: fmt };
  }

  var HE = {};
  var _el = null, _state = null;

  HE.open = function (cfg) {
    cfg = cfg || {};
    injectStyles();
    if (_el) HE.close();

    var adj = Object.assign({}, DEFAULTS, cfg.adjust || {});
    _state = { avatarId: cfg.avatarId, presence: cfg.presence || null, base: cfg.base, adj: adj };

    var wrap = document.createElement('div');
    wrap.id = 'vintHeadEd';
    wrap.setAttribute('data-draggable', 'true');

    var hd = document.createElement('div'); hd.className = 'he-hd';
    hd.innerHTML = '<span class="he-ttl">ADJUST YOUR HEAD</span>';
    var x = document.createElement('button'); x.className = 'he-x'; x.textContent = '✕';
    x.onclick = HE.close; hd.appendChild(x);
    wrap.appendChild(hd);

    var note = document.createElement('div'); note.className = 'he-note';
    note.textContent = 'slide to seat your face right on the body. it saves for everyone who sees you.';
    wrap.appendChild(note);

    var sliders = [
      mkSlider('offsetY', 'height',  -0.5, 0.5,  0.01, function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }),
      mkSlider('offsetX', 'side',    -0.3, 0.3,  0.01, function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }),
      mkSlider('scale',   'size',     0.6, 1.8,  0.01, function (v) { return Math.round(v * 100) + '%'; }),
      mkSlider('rotY',    'turn',    -0.6, 0.6,  0.01, function (v) { return Math.round(v * 57.3) + '°'; })
    ];
    sliders.forEach(function (sl) {
      sl.input.value = adj[sl.input.dataset.key];
      sl.val.textContent = sl.fmt(+sl.input.value);
      sl.input.addEventListener('input', function () {
        var k = sl.input.dataset.key, v = +sl.input.value;
        adj[k] = v; sl.val.textContent = sl.fmt(v);
        _preview(adj);
      });
      wrap.appendChild(sl.row);
    });
    _state.sliders = sliders;

    var acts = document.createElement('div'); acts.className = 'he-acts';
    var reset = document.createElement('button'); reset.className = 'he-btn he-reset'; reset.textContent = 'reset';
    reset.onclick = function () {
      adj = Object.assign({}, DEFAULTS); _state.adj = adj;
      sliders.forEach(function (sl) { sl.input.value = adj[sl.input.dataset.key]; sl.val.textContent = sl.fmt(+sl.input.value); });
      _preview(adj);
    };
    var save = document.createElement('button'); save.className = 'he-btn he-save'; save.textContent = 'save';
    save.onclick = function () { _save(adj, save); };
    acts.appendChild(reset); acts.appendChild(save);
    wrap.appendChild(acts);

    var retry = document.createElement('button'); retry.className = 'he-retry';
    retry.textContent = '↻ regenerate from photo';
    retry.onclick = function () { _retry(retry); };
    var rwrap = document.createElement('div'); rwrap.style.cssText = 'padding:0 15px calc(14px + env(safe-area-inset-bottom,0px));';
    rwrap.appendChild(retry); wrap.appendChild(rwrap);

    document.body.appendChild(wrap);
    _el = wrap;
    return wrap;
  };

  HE.close = function () { if (_el) { _el.remove(); _el = null; } };

  function _preview(adj) {
    try { if (_state && _state.presence && _state.presence.setHeadAdjust) _state.presence.setHeadAdjust(adj); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:head-adjust-preview', { detail: { adjust: adj } })); } catch (_) {}
  }

  function _save(adj, btn) {
    if (!_state || !_state.avatarId) { HE.close(); return; }
    var old = btn.textContent; btn.textContent = 'saving…'; btn.disabled = true;
    fetch(apiBase(_state.base) + '/api/avatar/' + encodeURIComponent(_state.avatarId) + '/adjust', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify(adj),
    }).then(function (r) {
      btn.disabled = false;
      if (r.ok) { btn.textContent = 'saved ✓'; setTimeout(HE.close, 700); }
      else { btn.textContent = 'try again'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'offline'; });
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
