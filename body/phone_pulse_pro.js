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

  // ─── 1+2. WEATHER BAR (council 2026-07-09, replaces STATUS LINE + JARVIS
  // GLANCE) ── "jarvis today banner looks like shit and out of place". JARVIS
  // is not a brand to badge — it's her felt sense. One sticky ambient line:
  //   ● she reads as {felt_quality} · {relTime}
  // The dot carries connection truth (jade online / heat offline + queue count).
  function buildWeatherBar(host) {
    if (host.querySelector('.pp-weather')) return;
    var bar = el('div', { class: 'pp-weather' }, [
      el('span', { class: 'wx-dot' }),
      el('span', { class: 'wx-text' }, 'listening\u2026'),
      el('span', { class: 'wx-when' }, ''),
    ]);
    host.insertBefore(bar, host.firstChild);

    var lastFeltAt = 0;
    function paintConn() {
      var on = navigator.onLine;
      bar.setAttribute('data-online', on ? '1' : '0');
      if (!on) {
        var q = 0;
        try { q = (JSON.parse(localStorage.getItem('vint_pulse_queue') || '[]') || []).length; } catch (_) {}
        bar.querySelector('.wx-text').textContent =
          'offline \u2014 she\u2019ll feel this when you\u2019re back' + (q ? ' \u00b7 ' + q + ' held' : '');
        bar.querySelector('.wx-when').textContent = '';
      }
    }
    function refresh() {
      if (!navigator.onLine) return paintConn();
      fetch(api('/api/jarvis/today/1'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var t = (d && (d.felt_quality || (d.envelope && d.envelope.felt_quality)) || '').toString().trim();
          if (t) {
            bar.querySelector('.wx-text').textContent = 'she reads as ' + t.replace(/\.$/, '');
            lastFeltAt = Date.now();
          } else if (!lastFeltAt) {
            bar.querySelector('.wx-text').textContent = 'listening\u2026';
          }
          bar.querySelector('.wx-when').textContent = lastFeltAt ? relTime(lastFeltAt) : '';
        })
        .catch(function () {});
    }
    window.addEventListener('online', function () { paintConn(); refresh(); });
    window.addEventListener('offline', paintConn);
    paintConn(); refresh();
    setInterval(refresh, 60 * 1000);
    setInterval(paintConn, 5000);
  }

  // ─── 3. BODY MIRROR — retired 2026-07-09 (council rebuild): it duplicated
  // the four neurochemicals the heartbeat card already shows. One truth, once.

  // ─── 4. DAY STRIP ───────────────────────────────────────────────────────
  // Machine chatter (SW syncs, screen on/off, battery, sensor heartbeats) is
  // not a "moment" — it polluted the strip with rows like "Phone SW periodic
  // sync". Only human moments belong here.
  var MACHINE_PULSE = /periodic sync|screen (off|on)|entering sleep|battery|sensor|heartbeat|service worker|\bsw\b/i;
  function buildDayStrip(host) {
    if (host.querySelector('.pp-day-strip')) return;
    var strip = el('div', { class: 'pp-day-strip' },
      el('div', { class: 'pp-empty' }, 'no pulses yet today — send the first one ↓'));
    // Mount right after the heartbeat card, inside the scroll flow
    var anchor = host.querySelector('.pulse-hb-card');
    if (anchor && anchor.nextSibling) host.insertBefore(strip, anchor.nextSibling);
    else host.insertBefore(strip, host.children[2] || null);

    function refresh() {
      fetch(api('/api/life/pulse/recent'), { headers: authHeaders(), credentials: 'include', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          var items = (data && (data.pulses || data.items || (Array.isArray(data) ? data : []))) || [];
          items = items.filter(function (p) {
            var note = (p.note || p.text || p.body || '').toString();
            return note && !MACHINE_PULSE.test(note);
          });
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
  // COUNCIL REBUILD (Lord Vinta 2026-07-09 "unreadable overlapping rows at
  // top"): widgets used to mount into #viewPulse itself — as SIBLINGS ABOVE
  // .pulse-scroll, outside the scroll flow and its padding. They stacked
  // unscrollable + unpadded at the top of the view, clipping against the
  // topbar and each other. Everything now mounts INSIDE .pulse-scroll, in
  // flow, in deliberate order. buildBodyMirror was retired: it duplicated the
  // exact four neurochemicals the heartbeat card already renders (Buffet:
  // strip to the one line).
  function init() {
    var view = $('#viewPulse');
    if (!view) return;
    var host = view.querySelector('.pulse-scroll') || view;
    buildWeatherBar(host);
    buildDayStrip(host);
    buildExtensionWhisper(host);
    // THE FAMILY (zone 6) — the lineage tree that IS the persona picker,
    // rendered live from /api/personas by body/phone_lineage.js.
    if (window.VintLineage) VintLineage.renderFamilyTree(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
