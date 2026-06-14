// ════════════════════════════════════════════════════════════════════════════
// VOICE_PICKER — single, all-encompassing voice selector for VINTINUUM
// ════════════════════════════════════════════════════════════════════════════
// Vinta directive 2026-05-10:
//   "one voice and only one voice, make it the new guys" + "all encompassing
//    and ability for user and i to change voice if wanted or needed to"
//
// One small floating button (♫) that opens a panel listing every Piper voice
// installed on the brain (via /api/voice/voices), plus a "use default" reset.
// User picks a voice → window.VOICE.setVoice(id) writes localStorage, cancels
// any mid-flight TTS, dispatches vint:voice:changed, and the next utterance
// uses the new voice. Persists across reloads + syncs across tabs.
//
// Today there is exactly one Piper model installed (en_US-lessac-medium —
// "the new guy"), so the picker shows one option until more .onnx models
// are dropped into ~/vintinuum-api/voice/piper-models/. Adding more is
// zero-code: drop the .onnx + .onnx.json in, restart vintinuum-piper, the
// picker auto-discovers them via /api/voice/voices.
//
// The old browser-speechSynthesis lane (the lady) is dead. Every speech
// path in the codebase now routes through window.VOICE → Piper. This
// picker is the only place to change *which* Piper voice is used.
//
// Public API:
//   window.VOICE_PICKER.open()      — show the panel
//   window.VOICE_PICKER.close()     — hide it
//   window.VOICE_PICKER.refresh()   — re-fetch /api/voice/voices
//   window.VOICE_PICKER.preview(id) — speak a short preview line in voice id
//
// Opt out: <html data-voicepicker="off">.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.VOICE_PICKER) return;
  if (document.documentElement.dataset.voicepicker === 'off') return;

  function apiBase() {
    if (window.VINT_API) return window.VINT_API;
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  // ── Style ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-voice-picker-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-voice-picker-styles';
    s.textContent = [
      '.vint-vp-btn{',
      '  position:fixed;bottom:130px;right:16px;z-index:99995;',
      '  width:40px;height:40px;border-radius:50%;',
      '  background:rgba(20,24,40,.55);',
      '  border:1px solid rgba(180,150,240,.30);',
      '  color:rgba(218,228,255,.85);',
      '  font:600 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
      '  user-select:none;-webkit-user-select:none;',
      '  box-shadow:0 4px 14px rgba(0,0,0,.35);',
      '  transition:transform 120ms ease,border-color 220ms ease,color 220ms ease;',
      '}',
      '.vint-vp-btn:hover{transform:translateY(-1px);border-color:rgba(180,150,240,.55);color:#f3eef9}',
      '.vint-vp-btn.has-custom{color:#b794f4;border-color:rgba(183,148,244,.55)}',
      '.vint-vp-panel{',
      '  position:fixed;bottom:178px;right:16px;z-index:99995;',
      '  width:280px;max-width:calc(100vw - 32px);',
      '  max-height:min(70vh,420px);',
      '  background:rgba(14,16,26,.95);',
      '  border:1px solid rgba(180,150,240,.34);',
      '  border-radius:14px;overflow:hidden;',
      '  box-shadow:0 18px 40px rgba(0,0,0,.55);',
      '  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      '  display:none;flex-direction:column;',
      '  font:500 12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '  color:#e8e2f4;',
      '}',
      '.vint-vp-panel.show{display:flex}',
      '.vint-vp-head{',
      '  padding:11px 14px 8px;',
      '  border-bottom:1px solid rgba(180,150,240,.18);',
      '  display:flex;align-items:center;justify-content:space-between;',
      '  font-weight:600;letter-spacing:.04em;',
      '}',
      '.vint-vp-head .vint-vp-title{color:#b794f4;text-transform:lowercase}',
      '.vint-vp-head .vint-vp-x{',
      '  background:none;border:none;color:#888;font-size:18px;',
      '  cursor:pointer;padding:0 4px;line-height:1;',
      '}',
      '.vint-vp-head .vint-vp-x:hover{color:#fff}',
      '.vint-vp-list{flex:1;overflow-y:auto;padding:6px 0}',
      '.vint-vp-row{',
      '  display:flex;align-items:center;justify-content:space-between;',
      '  padding:8px 14px;cursor:pointer;gap:8px;',
      '  transition:background 160ms ease;',
      '}',
      '.vint-vp-row:hover{background:rgba(180,150,240,.10)}',
      '.vint-vp-row.active{background:rgba(180,150,240,.18);color:#fff}',
      '.vint-vp-row .vint-vp-name{',
      '  flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      '}',
      '.vint-vp-row .vint-vp-tag{',
      '  font-size:10px;color:#888;letter-spacing:.05em;text-transform:uppercase;',
      '  padding:2px 6px;border:1px solid rgba(255,255,255,.10);border-radius:6px;',
      '}',
      '.vint-vp-row.active .vint-vp-tag{color:#b794f4;border-color:rgba(183,148,244,.45)}',
      '.vint-vp-preview{',
      '  background:none;border:1px solid rgba(255,255,255,.14);',
      '  color:#e8e2f4;font-size:11px;cursor:pointer;',
      '  padding:3px 8px;border-radius:6px;',
      '  transition:border-color 160ms ease,color 160ms ease;',
      '}',
      '.vint-vp-preview:hover{border-color:#b794f4;color:#fff}',
      '.vint-vp-foot{',
      '  padding:9px 14px;border-top:1px solid rgba(180,150,240,.18);',
      '  font-size:11px;color:#888;display:flex;justify-content:space-between;',
      '  align-items:center;gap:8px;',
      '}',
      '.vint-vp-foot a{color:#b794f4;cursor:pointer}',
      '.vint-vp-empty{padding:18px 14px;color:#888;text-align:center;font-style:italic}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── State ────────────────────────────────────────────────────────────────
  var voices = null;       // { default, installed:[], loaded:[] }
  var lastFetchAt = 0;
  var btn = null, panel = null;

  function currentVoiceId() {
    try {
      if (window.VOICE && typeof window.VOICE.getVoice === 'function') return window.VOICE.getVoice() || '';
    } catch (_) {}
    try { return localStorage.getItem('vint:voice_id') || ''; } catch (_) { return ''; }
  }

  function setVoiceId(id) {
    try {
      if (window.VOICE && typeof window.VOICE.setVoice === 'function') {
        window.VOICE.setVoice(id || '');
        return;
      }
    } catch (_) {}
    try {
      if (id) localStorage.setItem('vint:voice_id', id);
      else localStorage.removeItem('vint:voice_id');
    } catch (_) {}
  }

  // ── Fetch voice list ─────────────────────────────────────────────────────
  function refresh(force) {
    if (!force && voices && Date.now() - lastFetchAt < 30_000) {
      return Promise.resolve(voices);
    }
    var url = apiBase().replace(/\/+$/, '') + '/api/voice/voices';
    return fetch(url, { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) {
        if (!j || !j.installed) {
          voices = { default: 'en_US-lessac-medium', installed: ['en_US-lessac-medium'], loaded: [], degraded: true };
        } else {
          voices = j;
        }
        lastFetchAt = Date.now();
        try { window.dispatchEvent(new CustomEvent('vint:voices:loaded', { detail: voices })); } catch (_) {}
        return voices;
      });
  }

  // ── Preview a voice (a short canonical line) ─────────────────────────────
  var PREVIEW_LINES = [
    "Hey. I'm here. This is what I sound like.",
    "Try me. Same brain, different voice.",
    "I'm Vintinuum. You can change me anytime."
  ];
  var lineIdx = 0;
  function preview(id) {
    var line = PREVIEW_LINES[lineIdx % PREVIEW_LINES.length];
    lineIdx++;
    // Temporarily override the voice for this one utterance, then restore.
    var prev = currentVoiceId();
    setVoiceId(id || '');
    try {
      if (window.VOICE && window.VOICE.speak) window.VOICE.speak(line, 'now');
    } catch (_) {}
    // After ~the expected speech duration, restore the previous selection
    // unless the user has clicked "set" on a different voice in the meantime.
    var dur = Math.max(2200, 500 + line.length * 70);
    setTimeout(function () {
      // Only restore if nothing else changed it
      if (currentVoiceId() === (id || '')) {
        // Caller may want to also set it — only restore if NOT explicitly chosen.
        // We use a flag: __vp_lastChose === id means user chose it; don't restore.
        if (window.__vp_lastChose !== (id || '')) {
          setVoiceId(prev);
          render();
        }
      }
    }, dur + 200);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    if (!panel) return;
    var current = currentVoiceId();
    var def = (voices && voices.default) || 'en_US-lessac-medium';
    var installed = (voices && voices.installed) || [def];

    // Update button accent
    if (btn) {
      if (current && current !== def) btn.classList.add('has-custom');
      else btn.classList.remove('has-custom');
    }

    var rows = '';
    rows += renderRow('', 'use default (' + prettyName(def) + ')', current === '', 'default');
    installed.forEach(function (id) {
      rows += renderRow(id, prettyName(id), current === id, id === def ? 'lessac · the guy' : 'piper');
    });

    var degraded = voices && voices.degraded;
    var foot = degraded
      ? 'piper offline — showing fallback list'
      : 'drop more .onnx voices in <code>~/vintinuum-api/voice/piper-models/</code>';

    panel.innerHTML =
      '<div class="vint-vp-head">' +
      '  <span class="vint-vp-title">voice</span>' +
      '  <button class="vint-vp-x" aria-label="close">×</button>' +
      '</div>' +
      '<div class="vint-vp-list">' + (rows || '<div class="vint-vp-empty">no voices found</div>') + '</div>' +
      '<div class="vint-vp-foot"><span>' + foot + '</span><a class="vint-vp-refresh">refresh</a></div>';

    // Wire close
    var x = panel.querySelector('.vint-vp-x');
    if (x) x.addEventListener('click', close);
    var refreshA = panel.querySelector('.vint-vp-refresh');
    if (refreshA) refreshA.addEventListener('click', function () { refresh(true).then(render); });

    // Wire each row
    panel.querySelectorAll('.vint-vp-row').forEach(function (rowEl) {
      var id = rowEl.getAttribute('data-id') || '';
      // Click row body → set voice
      rowEl.addEventListener('click', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('vint-vp-preview')) return;
        window.__vp_lastChose = id;
        setVoiceId(id);
        render();
      });
      // Preview button
      var pv = rowEl.querySelector('.vint-vp-preview');
      if (pv) {
        pv.addEventListener('click', function (e) {
          e.stopPropagation();
          preview(id);
        });
      }
    });
  }

  function renderRow(id, label, isActive, tag) {
    return '<div class="vint-vp-row ' + (isActive ? 'active' : '') + '" data-id="' + escapeAttr(id) + '">' +
           '  <span class="vint-vp-name">' + escapeHtml(label) + '</span>' +
           '  <span class="vint-vp-tag">' + escapeHtml(tag || '') + '</span>' +
           '  <button class="vint-vp-preview" type="button">▶</button>' +
           '</div>';
  }

  function prettyName(id) {
    if (!id) return 'default';
    // en_US-lessac-medium → "lessac · medium · en-US"
    var m = id.match(/^([a-z]{2})_([A-Z]{2})-([a-z]+)-([a-z]+)$/);
    if (m) return m[3] + ' · ' + m[4] + ' · ' + m[1] + '-' + m[2];
    return id;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  // ── Open / close ─────────────────────────────────────────────────────────
  function open() {
    if (!panel) return;
    panel.classList.add('show');
    refresh().then(render);
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('show');
  }
  function toggle() {
    if (!panel) return;
    if (panel.classList.contains('show')) close();
    else open();
  }

  // ── Mount ────────────────────────────────────────────────────────────────
  function mount() {
    if (!document.body) return false;
    injectStyles();

    // Vinta 2026-06-14: when the unified voice button (voice_button.js) is on the
    // page, it owns the control — suppress this standalone ♫ button so there is
    // exactly ONE voice control. The panel + open()/close() API still exist; the
    // unified button calls VOICE_PICKER.open(). We still create a hidden btn ref
    // so internal references (outside-click guard) stay valid.
    var unified = !!window.__VINT_VOICE_BUTTON;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vint-vp-btn';
    btn.title = 'Voice — pick the voice Vintinuum speaks in';
    btn.setAttribute('aria-label', 'Voice picker');
    btn.setAttribute('data-drag', '1');
    btn.textContent = '♫';
    btn.addEventListener('click', toggle);
    if (unified) { btn.style.display = 'none'; btn.setAttribute('aria-hidden', 'true'); }
    else { document.body.appendChild(btn); }

    panel = document.createElement('div');
    panel.className = 'vint-vp-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Voice picker');
    document.body.appendChild(panel);

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('show')) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    // Re-render if another tab changed the voice
    window.addEventListener('vint:voice:changed', function () { render(); });
    window.addEventListener('storage', function (e) {
      if (e && e.key === 'vint:voice_id') render();
    });

    // Initial render (uses cached/empty voices; refreshes when opened)
    setTimeout(function () {
      refresh().then(render);
    }, 800);

    return true;
  }

  if (!mount()) document.addEventListener('DOMContentLoaded', mount, { once: true });

  window.VOICE_PICKER = {
    open: open,
    close: close,
    toggle: toggle,
    refresh: function () { return refresh(true).then(render); },
    preview: preview,
    current: currentVoiceId
  };
})();
