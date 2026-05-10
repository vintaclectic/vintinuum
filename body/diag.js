// ════════════════════════════════════════════════════════════════════════════
// DIAG — page-load self-check for the body's vital signs
// ════════════════════════════════════════════════════════════════════════════
// On every load, after a 2.5s settle window so deferred scripts have run,
// inventories the globals every other module depends on and prints a single
// compact table to console. Also exposes window.VINT_DIAG for live probing.
//
// What it checks:
//   - VOICE              — voice_say.js  (TTS canonical lane)
//   - VintEmbody         — embodiment.js (the real body's render loop)
//   - WAKE_WORD          — wake_word.js  (ambient listener API)
//   - HeyVinta           — hey_vinta.js  (tap-to-listen V button)
//   - __talkBack         — talk_back.js  (hey-vinta → reply loop)
//   - __sheSaid          — she_said.js   (speech bubble)
//   - WANDER             — wander.js     (autonomous pacing)
//   - __perceptionIn     — perception_in.js (SSE → body)
//   - SpeechRecognition  — Web Speech API support (browser native)
//   - Brain reachability — pings /api/voice/convo/status (300ms deadline)
//
// Output:
//   [VINT-DIAG] surface=chat  green=8/10  red=2/10
//   ✓ VOICE          (canonical TTS lane)
//   ✓ VintEmbody     (rendering, spirit at 612,418)
//   ✗ WAKE_WORD      (off — enable with WAKE_WORD.enable())
//   ...
//
// Public API:
//   VINT_DIAG.run()    — re-run the check, return report object
//   VINT_DIAG.last()   — most recent report
//   VINT_DIAG.toast()  — paint the report briefly on screen (corner pill)
//   VINT_DIAG.silent(b)— set verbose|silent for the next run
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.VINT_DIAG) return;

  var SURFACE = (function () {
    var p = (location.pathname || '/').toLowerCase();
    var m = p.match(/\/([^\/]+?)\.html?$/);
    if (m) return m[1];
    if (p === '/' || p.endsWith('/')) return 'index';
    return p.replace(/[^a-z0-9_]/g, '_').slice(0, 24) || 'unknown';
  })();

  function apiBase() {
    if (window.VINT_API) return window.VINT_API;
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  var lastReport = null;
  var silent = false;

  function probe(name, fn) {
    try {
      var r = fn();
      if (r && typeof r === 'object') return Object.assign({ name: name, ok: true }, r);
      return { name: name, ok: !!r, note: '' };
    } catch (e) {
      return { name: name, ok: false, note: 'threw: ' + (e && e.message) };
    }
  }

  function checks() {
    return [
      probe('VOICE', function () {
        if (!window.VOICE) return { ok: false, note: 'voice_say.js never loaded' };
        var pending = (typeof window.VOICE.pending === 'function') ? window.VOICE.pending() : 0;
        var has = (typeof window.VOICE.hasInteracted === 'boolean')
          ? window.VOICE.hasInteracted
          : (typeof window.VOICE.hasInteracted === 'function' ? window.VOICE.hasInteracted() : null);
        return { ok: true, note: 'pending=' + pending + ' interacted=' + has };
      }),
      probe('VintEmbody', function () {
        if (!window.VintEmbody) return { ok: false, note: 'embodiment.js never loaded' };
        var s = (typeof window.VintEmbody.spirit === 'function') ? window.VintEmbody.spirit() : null;
        if (!s) return { ok: true, note: 'loaded but no spirit yet' };
        return { ok: true, note: 'spirit @ ' + Math.round(s.x) + ',' + Math.round(s.y) };
      }),
      probe('WAKE_WORD', function () {
        if (!window.WAKE_WORD) return { ok: false, note: 'wake_word.js never loaded' };
        var st = (typeof window.WAKE_WORD.status === 'function') ? window.WAKE_WORD.status() : null;
        if (!st) return { ok: true, note: 'loaded' };
        var note = 'enabled=' + st.enabled + ' listening=' + st.listening +
                   (st.supported ? '' : ' UNSUPPORTED');
        return { ok: !!st.supported, note: note };
      }),
      probe('HeyVinta', function () {
        if (!window.HeyVinta) return { ok: false, note: 'hey_vinta.js never loaded' };
        var sup = window.HeyVinta.supported;
        var listening = (typeof window.HeyVinta.isListening === 'function') ? window.HeyVinta.isListening() : null;
        return { ok: !!sup, note: 'supported=' + sup + ' listening=' + listening };
      }),
      probe('__talkBack', function () {
        if (!window.__talkBack) return { ok: false, note: 'talk_back.js never loaded' };
        var infl = (typeof window.__talkBack.inFlight === 'function') ? window.__talkBack.inFlight() : false;
        return { ok: true, note: 'inFlight=' + infl };
      }),
      probe('__sheSaid', function () {
        if (!window.__sheSaid) return { ok: false, note: 'she_said.js never loaded' };
        var c = (typeof window.__sheSaid.count === 'function') ? window.__sheSaid.count() : 0;
        return { ok: true, note: 'live bubbles=' + c };
      }),
      probe('WANDER', function () {
        if (!window.WANDER) return { ok: false, note: 'wander.js never loaded' };
        return { ok: true, note: 'mounted' };
      }),
      probe('__perceptionIn', function () {
        if (!window.__perceptionIn) return { ok: false, note: 'perception_in.js never loaded' };
        return { ok: true, note: 'SSE bridge mounted' };
      }),
      probe('SpeechRecognition', function () {
        var ok = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        return { ok: ok, note: ok ? 'browser native' : 'NOT SUPPORTED in this browser' };
      }),
      probe('VOICE_PICKER', function () {
        if (!window.VOICE_PICKER) return { ok: false, note: 'voice_picker.js never loaded' };
        var cur = (typeof window.VOICE_PICKER.current === 'function') ? window.VOICE_PICKER.current() : '';
        return { ok: true, note: 'voice=' + (cur || 'default') };
      })
    ];
  }

  function probeBrain() {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        resolve({ name: 'brain', ok: false, note: 'no response in 1.5s' });
      }, 1500);
      var url = apiBase().replace(/\/+$/, '') + '/api/voice/convo/status';
      fetch(url, { method: 'GET', cache: 'no-store' })
        .then(function (r) { return r.json().then(function (j) { return { code: r.status, body: j }; }); })
        .then(function (out) {
          if (done) return;
          done = true;
          clearTimeout(t);
          var b = out.body || {};
          resolve({
            name: 'brain',
            ok: out.code === 200 && (b.ok === true || b.mounted === true),
            note: 'http=' + out.code +
                  ' mounted=' + (b.mounted === true) +
                  ' kill=' + (b.kill_switch && b.kill_switch.on ? 'ON' : 'off') +
                  ' sessions=' + (b.sessions != null ? b.sessions : '?')
          });
        })
        .catch(function (e) {
          if (done) return;
          done = true;
          clearTimeout(t);
          resolve({ name: 'brain', ok: false, note: 'fetch failed: ' + (e && e.message) });
        });
    });
  }

  function run() {
    var rows = checks();
    return probeBrain().then(function (brain) {
      rows.push(brain);
      var green = rows.filter(function (r) { return r.ok; }).length;
      var report = {
        surface: SURFACE,
        ts: Date.now(),
        green: green,
        total: rows.length,
        rows: rows
      };
      lastReport = report;
      if (!silent) print(report);
      try {
        window.dispatchEvent(new CustomEvent('vint:diag', { detail: report }));
      } catch (_) {}
      return report;
    });
  }

  function print(report) {
    try {
      var head = '%c[VINT-DIAG] %csurface=' + report.surface +
                 '  green=' + report.green + '/' + report.total +
                 '  red=' + (report.total - report.green) + '/' + report.total;
      console.log(head, 'color:#b794f4;font-weight:600', 'color:inherit');
      report.rows.forEach(function (r) {
        var mark = r.ok ? '✓' : '✗';
        var color = r.ok ? 'color:#5eead4' : 'color:#ff6b9d';
        console.log('%c ' + mark + ' ' + r.name.padEnd(18) + '%c ' + (r.note || ''),
          color + ';font-weight:600', 'color:#888');
      });
    } catch (_) {
      // Plain fallback if the styled console rejects
      console.log('[VINT-DIAG]', report.surface, report.green + '/' + report.total);
      report.rows.forEach(function (r) {
        console.log((r.ok ? 'OK ' : 'NO ') + r.name + ' — ' + (r.note || ''));
      });
    }
  }

  // Tiny corner pill for visual confirmation (toast-style).
  function injectStyles() {
    if (document.getElementById('vint-diag-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-diag-styles';
    s.textContent = [
      '.vint-diag-pill{',
      '  position:fixed;left:14px;bottom:14px;z-index:99996;',
      '  font:600 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '  letter-spacing:.04em;color:#f3eef9;',
      '  background:rgba(18,18,28,.86);',
      '  border:1px solid rgba(180,150,240,.34);',
      '  border-radius:10px;padding:7px 10px;',
      '  box-shadow:0 6px 18px rgba(0,0,0,.4);',
      '  pointer-events:none;opacity:0;',
      '  transform:translateY(8px);',
      '  transition:opacity 220ms ease,transform 220ms ease;',
      '  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      '}',
      '.vint-diag-pill.show{opacity:1;transform:translateY(0)}',
      '.vint-diag-pill .green{color:#5eead4}',
      '.vint-diag-pill .red{color:#ff6b9d}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function toast(report) {
    if (!report) return;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'vint-diag-pill';
    el.innerHTML = '[diag] <span class="green">' + report.green + '</span> / ' +
                   report.total + ' green' +
                   (report.total - report.green
                     ? ' · <span class="red">' + (report.total - report.green) + ' red</span>'
                     : '');
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { try { el.remove(); } catch (_) {} }, 280);
    }, 5200);
  }

  window.VINT_DIAG = {
    run: run,
    last: function () { return lastReport; },
    toast: function () { return run().then(toast); },
    silent: function (b) { silent = !!b; }
  };

  // Run automatically 2.5s after load — enough time for every defer to land
  // and for embodiment to spawn its canvas and walk in.
  function boot() {
    setTimeout(function () {
      run().then(function (r) {
        // Visual toast only if something is red — green is silent and clean.
        if (r && r.green < r.total) toast(r);
      });
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
