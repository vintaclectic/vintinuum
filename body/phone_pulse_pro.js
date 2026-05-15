// ════════════════════════════════════════════════════════════════════════════
// PHONE PULSE PRO — additive enhancements for the Pulse view on phone.html
// ════════════════════════════════════════════════════════════════════════════
// Idempotently injects, after DOMContentLoaded, into #viewPulse:
//
//   1. .pp-status-line   — online dot + queued-pulse count (reads localStorage)
//   2. .pp-jarvis-glance — felt-quality from /api/jarvis/today/1
//   3. .pp-body-mirror   — live 4-arc neurochemistry from /api/body-state
//   4. .pp-day-strip     — today's pulses as horizontal scroll thumbs
//   5. .pp-ext-whisper   — latest browser-extension capture (jade dashed pill)
//
// Hooks into the existing pulse send button: when a pulse posts successfully,
// the day-strip refetches and the body-mirror gets a soft re-poll.
//
// Also: offline pulse queue is observed via the existing localStorage key
// (vint_pulse_queue) used by phone.html — we do NOT take ownership of the
// queue, only display the count.
//
// Three-window awareness: this file is the phone half of the cross-pollination
// JARVIS already does on the desktop. Each surface sees the other two.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('data-') === 0) n.setAttribute(k, attrs[k]);
      else n[k] = attrs[k];
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  var API_BASE = (window.__VINTINUUM_API_BASE || window.API_BASE || 'https://api.vintaclectic.com').replace(/\/$/, '');
  function api(p) { return API_BASE + p; }
  function authHeaders() {
    var h = {};
    var t = localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token');
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  function relTime(ts) {
    if (!ts) return '—';
    var ms = Date.now() - (ts > 1e12 ? ts : ts * 1000);
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  }
  function timeOnly(ts) {
    if (!ts) return '';
    var d = new Date(ts > 1e12 ? ts : ts * 1000);
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function moodClass(m) {
    if (m == null) return 'cool';
    var n = Number(m);
    if (n >= 50)  return 'bright';
    if (n >= 0)   return 'warm';
    if (n >= -40) return 'cool';
    return 'green';
  }

  // ─── 1. STATUS LINE ─────────────────────────────────────────────────────
  function buildStatusLine(host) {
    if (host.querySelector('.pp-status-line')) return;
    var line = el('div', { class: 'pp-status-line', 'data-online': navigator.onLine ? '1' : '0', 'data-queued': '0' }, [
      el('div', { class: 'left' }, [
        el('span', { class: 'dot' }),
        el('span', {}, navigator.onLine ? 'connected to body' : 'offline — will sync')
      ]),
      el('div', { class: 'right' }, el('span', { class: 'tz' }, new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })))
    ]);
    host.insertBefore(line, host.firstChild);

    function refresh() {
      line.setAttribute('data-online', navigator.onLine ? '1' : '0');
      var lbl = line.querySelector('.left span:last-child');
      if (lbl) lbl.textContent = navigator.onLine ? 'connected to body' : 'offline — will sync';
      try {
        var q = JSON.parse(localStorage.getItem('vint_pulse_queue') || '[]');
        line.setAttribute('data-queued', String(q.length || 0));
      } catch (_) {}
    }
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    setInterval(refresh, 4000);
    refresh();
  }

  // ─── 2. JARVIS GLANCE ──────────────────────────────────────────────────
  function buildJarvisGlance(host) {
    if (host.querySelector('.pp-jarvis-glance')) return;
    var g = el('div', { class: 'pp-jarvis-glance' },
      el('div', { class: 'text' }, 'today reads as quiet electricity — listening.'));
    host.insertBefore(g, host.children[1] || null);

    function refresh() {
      fetch(api('/api/jarvis/today/1'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return;
          var t = (d.felt_quality || (d.envelope && d.envelope.felt_quality) || '').toString().trim();
          if (t) g.querySelector('.text').textContent = t;
        })
        .catch(function () {});
    }
    refresh();
    setInterval(refresh, 60 * 1000);
  }

  // ─── 3. BODY MIRROR ─────────────────────────────────────────────────────
  var ARC_LENGTHS = { dopamine: 264, serotonin: 226, gaba: 188, norepinephrine: 151 };
  function buildBodyMirror(host) {
    if (host.querySelector('.pp-body-mirror')) return;
    var m = el('div', { class: 'pp-body-mirror' });
    m.innerHTML =
      '<div class="head"><span>your body, right now</span><span class="src">live</span></div>' +
      '<div class="canvas-wrap">' +
      '<svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" aria-label="Live neurochemistry">' +
      '  <path class="arc-track" d="M 16 90 A 84 84 0 0 1 184 90" />' +
      '  <path class="arc-fill" data-arc="dopamine"      d="M 16 90 A 84 84 0 0 1 184 90" stroke-dasharray="264" stroke-dashoffset="264" />' +
      '  <path class="arc-track" d="M 28 90 A 72 72 0 0 1 172 90" />' +
      '  <path class="arc-fill" data-arc="serotonin"     d="M 28 90 A 72 72 0 0 1 172 90" stroke-dasharray="226" stroke-dashoffset="226" />' +
      '  <path class="arc-track" d="M 40 90 A 60 60 0 0 1 160 90" />' +
      '  <path class="arc-fill" data-arc="gaba"          d="M 40 90 A 60 60 0 0 1 160 90" stroke-dasharray="188" stroke-dashoffset="188" />' +
      '  <path class="arc-track" d="M 52 90 A 48 48 0 0 1 148 90" />' +
      '  <path class="arc-fill" data-arc="norepinephrine" d="M 52 90 A 48 48 0 0 1 148 90" stroke-dasharray="151" stroke-dashoffset="151" />' +
      '</svg></div>' +
      '<div class="legend">' +
      '  <div><span class="swatch" style="background:#7ccfff"></span>DA <span class="val" data-val="dopamine">—</span></div>' +
      '  <div><span class="swatch" style="background:#e74c8a"></span>5HT <span class="val" data-val="serotonin">—</span></div>' +
      '  <div><span class="swatch" style="background:#2bb673"></span>GABA <span class="val" data-val="gaba">—</span></div>' +
      '  <div><span class="swatch" style="background:#ff6f3d"></span>NE <span class="val" data-val="norepinephrine">—</span></div>' +
      '</div>';
    var anchor = host.querySelector('.pp-jarvis-glance');
    if (anchor && anchor.nextSibling) host.insertBefore(m, anchor.nextSibling);
    else host.insertBefore(m, host.children[1] || null);

    function setArc(name, value0to100) {
      var path = m.querySelector('.arc-fill[data-arc="' + name + '"]');
      if (!path) return;
      var len = ARC_LENGTHS[name] || 200;
      var pct = Math.max(0, Math.min(100, Number(value0to100) || 0)) / 100;
      path.setAttribute('stroke-dashoffset', String(len * (1 - pct)));
      var v = m.querySelector('[data-val="' + name + '"]');
      if (v) v.textContent = Math.round(value0to100);
    }
    function refresh() {
      fetch(api('/api/body-state'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var b = (data && (data.body || data.state || data)) || {};
          setArc('dopamine',       b.dopamine != null ? b.dopamine : 50);
          setArc('serotonin',      b.serotonin != null ? b.serotonin : 50);
          setArc('gaba',           b.gaba != null ? b.gaba : 50);
          setArc('norepinephrine', b.norepinephrine != null ? b.norepinephrine : 50);
        })
        .catch(function () {});
    }
    refresh();
    setInterval(refresh, 12 * 1000);
  }

  // ─── 4. DAY STRIP ───────────────────────────────────────────────────────
  function buildDayStrip(host) {
    if (host.querySelector('.pp-day-strip')) return;
    var strip = el('div', { class: 'pp-day-strip' },
      el('div', { class: 'pp-empty' }, 'no pulses yet today — send the first one ↓'));
    // Mount above the activity chips (between body mirror and slider sections)
    var anchor = host.querySelector('.pp-body-mirror');
    if (anchor && anchor.nextSibling) host.insertBefore(strip, anchor.nextSibling);
    else host.insertBefore(strip, host.children[2] || null);

    function refresh() {
      fetch(api('/api/life/pulse/recent'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var items = (data && (data.pulses || data.items || (Array.isArray(data) ? data : []))) || [];
          while (strip.firstChild) strip.removeChild(strip.firstChild);
          if (!items.length) {
            strip.appendChild(el('div', { class: 'pp-empty' }, 'no pulses yet today — send the first one ↓'));
            return;
          }
          items.slice(0, 12).forEach(function (p) {
            var note = (p.note || p.text || p.body || '').toString().slice(0, 70);
            var when = timeOnly(p.created_at || p.ts);
            var thumb = el('div', { class: 'pp-pulse-thumb', 'data-mood-class': moodClass(p.mood != null ? p.mood : p.valence) }, [
              el('span', { class: 'when' }, when),
              note || '(no note)'
            ]);
            strip.appendChild(thumb);
          });
        })
        .catch(function () {});
    }
    refresh();
    setInterval(refresh, 30 * 1000);
    // refresh on send
    var sendBtn = $('#pulseSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', function () { setTimeout(refresh, 1500); });
  }

  // ─── 5. EXTENSION WHISPER ───────────────────────────────────────────────
  function buildExtensionWhisper(host) {
    if (host.querySelector('.pp-ext-whisper')) return;
    var w = el('div', { class: 'pp-ext-whisper' });
    // Insert near bottom — after the send button
    var sendBtn = host.querySelector('.pulse-send-btn');
    if (sendBtn && sendBtn.parentNode) sendBtn.parentNode.insertBefore(w, sendBtn);
    else host.appendChild(w);

    function refresh() {
      fetch(api('/api/extension/recent'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var items = (data && (data.captures || data.items || (Array.isArray(data) ? data : []))) || [];
          while (w.firstChild) w.removeChild(w.firstChild);
          if (!items.length) return;
          var c = items[0];
          var title = (c.title || c.url_redacted || c.url || c.domain || '').toString().slice(0, 80);
          var dom = c.domain || (function () { try { return new URL(c.url || '').hostname; } catch (_) { return ''; } })();
          var dwell = c.dwell_ms ? Math.round(c.dwell_ms / 1000) + 's' : '';
          if (!title && !dom) return;
          var bits = [];
          if (dom)   bits.push(dom);
          if (dwell) bits.push('dwell ' + dwell);
          bits.push(relTime(c.captured_at || c.ts) + ' ago');
          w.appendChild(el('div', { class: 'head' }, 'last read on the browser'));
          w.appendChild(el('div', { class: 'title' }, title || dom));
          w.appendChild(el('div', { class: 'meta' }, bits.join(' · ')));
        })
        .catch(function () {});
    }
    refresh();
    setInterval(refresh, 25 * 1000);
  }

  // ─── INIT ───────────────────────────────────────────────────────────────
  function init() {
    var host = $('#viewPulse');
    if (!host) return;
    buildStatusLine(host);
    buildJarvisGlance(host);
    buildBodyMirror(host);
    buildDayStrip(host);
    buildExtensionWhisper(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
