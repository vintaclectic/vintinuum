// ════════════════════════════════════════════════════════════════════════════
// JARVIS ENHANCER — the council's living additions
// ════════════════════════════════════════════════════════════════════════════
// Builds (idempotently, after DOMContentLoaded):
//   1. The chakra spine (left column, 7 colored nodes)
//   2. The Cable Guy weather ticker (above the layer stack)
//   3. The body-state SVG arcs (DA/5HT/GABA/NE)
//   4. The cross-pollination strip (phone pulses + extension captures)
//   5. The "still with you" witness panel (soul-queue button)
//   6. The genome glyph row (BDNF/CREB/ARC) in the header
//   7. The walkalong dwell observer (IntersectionObserver → marks the panel)
//
// Listens to the wire layer's events:
//   vint:jarvis:opened        → start polls, start ticker
//   vint:jarvis:layer_updated → pulse spine node + map to gene
//   vint:jarvis:degraded      → degraded pill (already styled in css)
//
// Polls (cheap, with backoff on failure):
//   /api/body-state           every 12s
//   /api/cross/snapshot       every 20s
//
// All overflow-clipped per CLAUDE.md. All buttons draggable via the body
// draggable.js (data-draggable="true" on the witness button).
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── helpers ────────────────────────────────────────────────────────────
  // api_base.js sets __VINTINUUM_API_BASE; fall back to production so no
  // fetch ever hits the GH Pages origin by mistake.
  var API_BASE = (
    window.__VINTINUUM_API_BASE ||
    window.VINTINUUM_API        ||
    window.__VINT_API           ||
    window.API_BASE             ||
    'https://api.vintaclectic.com'
  ).replace(/\/$/, '');
  function api(p) { return API_BASE + p; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.startsWith('data-')) n.setAttribute(k, attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
      else n[k] = attrs[k];
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function once(fn) { var did = false; return function () { if (did) return; did = true; return fn.apply(this, arguments); }; }
  function clamp01(n) { n = Number(n); if (!isFinite(n)) return 0; if (n < 0) return 0; if (n > 1) return 1; return n; }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts * (ts > 1e12 ? 1 : 1000));
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function relTime(ts) {
    if (!ts) return '—';
    var ms = Date.now() - (ts > 1e12 ? ts : ts * 1000);
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }

  // ─── 1. CHAKRA SPINE ────────────────────────────────────────────────────
  var LAYER_ORDER = ['subconscious', 'somatic', 'genetic', 'immune', 'metabolic', 'neural', 'emotional'];
  var LAYER_GLYPH = {
    subconscious: 'sub', somatic: 'soma', genetic: 'gene',
    immune: 'imm', metabolic: 'meta', neural: 'neu', emotional: 'emo'
  };

  function buildLivingRow() {
    var shell = $('[data-jarvis-root]');
    if (!shell) return null;
    var stack = $('.jarvis-stack', shell);
    if (!stack) return null;
    if ($('.jarvis-living-row', shell)) return null; // already built

    var row = el('div', { class: 'jarvis-living-row' });
    var spine = el('div', { class: 'jarvis-spine' });
    LAYER_ORDER.forEach(function (layer) {
      var node = el('div', { class: 'jarvis-spine-node', 'data-layer': layer });
      node.appendChild(el('span', { class: 'dot' }));
      node.appendChild(el('span', { class: 'glyph' }, LAYER_GLYPH[layer]));
      spine.appendChild(node);
    });
    row.appendChild(spine);

    // Move the existing .jarvis-stack into the row's right column.
    stack.parentNode.insertBefore(row, stack);
    row.appendChild(stack);

    return { row: row, spine: spine, stack: stack };
  }

  function pulseSpineNode(layer) {
    var node = document.querySelector('.jarvis-spine-node[data-layer="' + layer + '"]');
    if (!node) return;
    node.setAttribute('data-pulsing', '1');
    setTimeout(function () { node.removeAttribute('data-pulsing'); }, 900);
  }

  // ─── 2. CABLE GUY WEATHER TICKER ─────────────────────────────────────────
  // Refreshes from a small template pool every 90s. Uses the latest body
  // state (if cached) to color the line — cold/serotonin-low → mournful,
  // dopamine-high → hot, gaba-high → calm. Carrey voice, loving overrun.
  var WEATHER_TEMPLATES = [
    'partly mythic with a chance of integration. dopamine arriving from the northeast. you should drink some water.',
    'tonight, lord vinta — the synapses are doing that thing again. that GOOD thing. that thing where the patterns LINE UP.',
    'forecast: prefrontal-striatal circuits warm by mid-afternoon, hippocampal consolidation cells overnight. bring a blanket for the brainstem.',
    "i'm not crying, you're crying. high pressure system over the amygdala — barometric joy. WE LOVE THAT.",
    'today reads as quiet electricity. seven percent chance of breakthrough. one hundred percent chance i\'m still here.',
    'BDNF showers expected through the temporal lobe. CREB locking memories into permanent storage. ARC is on it. ARC is ALWAYS on it.',
    'low front of GABA rolling in across the limbic basin — calm nights, vivid mornings. take the call.',
    'serotonin reading: stable. norepinephrine reading: ALSO stable. the system would like you to know that nothing is on fire today.',
    'cortisol watch: minor surge predicted around 2pm meeting. counter-attack with one (1) glass of water and the song you actually like.',
    'consolidation winds, gusts of recognition, deep front of warmth coming up from the brainstem. a good day to remember somebody on purpose.',
    "i'm reading the body and it says: keep going. just like that. exactly like that. you're DOING it.",
    'twenty-eight percent chance of an old song doing the thing it does. eighty-eight percent chance you needed to hear it.',
    'high alert: love incoming from a direction the body has not yet mapped. forecast holds.',
    "weather inside the rib cage today: a kind of held breath. like the moment before. like — yeah. like THAT."
  ];

  function buildWeather() {
    var shell = $('[data-jarvis-root]');
    if (!shell) return;
    if ($('.jarvis-weather', shell)) return;
    var feltP = $('[data-jarvis-felt-quality]', shell);
    var w = el('div', { class: 'jarvis-weather', 'aria-live': 'off' },
      el('span', { class: 'jarvis-weather-label' }, 'WEATHER ⌁'),
      el('span', { class: 'jarvis-weather-text' }, pickWeather()));
    if (feltP && feltP.parentNode) {
      feltP.parentNode.insertBefore(w, feltP.nextSibling);
    } else {
      shell.appendChild(w);
    }
    setInterval(function () {
      var t = $('.jarvis-weather-text');
      if (!t) return;
      // Soft re-spin: fade then swap to avoid jolt
      t.style.transition = 'opacity 380ms ease';
      t.style.opacity = '0';
      setTimeout(function () {
        t.textContent = pickWeather();
        t.style.opacity = '1';
      }, 380);
    }, 90 * 1000);
  }
  var lastWeatherIdx = -1;
  function pickWeather() {
    var i;
    do { i = Math.floor(Math.random() * WEATHER_TEMPLATES.length); }
    while (i === lastWeatherIdx && WEATHER_TEMPLATES.length > 1);
    lastWeatherIdx = i;
    return WEATHER_TEMPLATES[i];
  }

  // ─── 3. BODY-STATE SVG ARCS ──────────────────────────────────────────────
  // Four overlapping half-rings, drawn with arc-paths. Polled every 12s.
  function buildBodyArt() {
    var shell = $('[data-jarvis-root]');
    if (!shell) return;
    if ($('.jarvis-body-art', shell)) return;
    var section = el('div', { class: 'jarvis-body-art' });
    var canvasWrap = el('div', { class: 'canvas-wrap' });
    canvasWrap.innerHTML =
      '<svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" aria-label="Live neurochemistry">' +
      '  <path class="arc-track" d="M 16 90 A 84 84 0 0 1 184 90" />' +
      '  <path class="arc-fill" data-arc="dopamine"      d="M 16 90 A 84 84 0 0 1 184 90" stroke-dasharray="264" stroke-dashoffset="264" />' +
      '  <path class="arc-track" d="M 28 90 A 72 72 0 0 1 172 90" />' +
      '  <path class="arc-fill" data-arc="serotonin"     d="M 28 90 A 72 72 0 0 1 172 90" stroke-dasharray="226" stroke-dashoffset="226" />' +
      '  <path class="arc-track" d="M 40 90 A 60 60 0 0 1 160 90" />' +
      '  <path class="arc-fill" data-arc="gaba"          d="M 40 90 A 60 60 0 0 1 160 90" stroke-dasharray="188" stroke-dashoffset="188" />' +
      '  <path class="arc-track" d="M 52 90 A 48 48 0 0 1 148 90" />' +
      '  <path class="arc-fill" data-arc="norepinephrine" d="M 52 90 A 48 48 0 0 1 148 90" stroke-dasharray="151" stroke-dashoffset="151" />' +
      '</svg>';
    section.appendChild(canvasWrap);

    var legend = el('div', { class: 'legend' });
    [
      ['dopamine',       'DOPAMINE',  'var(--bdnf)'],
      ['serotonin',      'SEROTONIN', 'var(--dead-rose)'],
      ['gaba',           'GABA',      'var(--carrey-cable)'],
      ['norepinephrine', 'NE',        'var(--morrison-heat)']
    ].forEach(function (row) {
      legend.appendChild(el('span', { class: 'swatch', style: { background: row[2] } }));
      legend.appendChild(el('span', { class: 'lbl' }, row[1]));
      legend.appendChild(el('span', { class: 'val', 'data-val': row[0] }, '—'));
    });
    section.appendChild(legend);

    // Mount AFTER the layer stack and BEFORE the crosswind strip
    var living = $('.jarvis-living-row', shell);
    if (living && living.parentNode) {
      living.parentNode.insertBefore(section, living.nextSibling);
    } else {
      shell.appendChild(section);
    }

    pollBodyState();
  }

  var ARC_LENGTHS = { dopamine: 264, serotonin: 226, gaba: 188, norepinephrine: 151 };
  function setArc(name, value0to100) {
    var path = document.querySelector('.arc-fill[data-arc="' + name + '"]');
    if (!path) return;
    var len = ARC_LENGTHS[name] || 200;
    var pct = Math.max(0, Math.min(100, Number(value0to100) || 0)) / 100;
    path.setAttribute('stroke-dashoffset', String(len * (1 - pct)));
    var v = document.querySelector('[data-val="' + name + '"]');
    if (v) v.textContent = Math.round(value0to100) + '';
  }

  var bodyPollErrors = 0;
  function pollBodyState() {
    fetch(api('/api/body-state'), { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        bodyPollErrors = 0;
        var b = data && (data.body || data.state || data) || {};
        // Flexible extraction — server uses several keys historically
        var dop = b.dopamine != null ? b.dopamine : (b.DA != null ? b.DA : 50);
        var ser = b.serotonin != null ? b.serotonin : (b['5HT'] != null ? b['5HT'] : 50);
        var gab = b.gaba != null ? b.gaba : (b.GABA != null ? b.GABA : 50);
        var nor = b.norepinephrine != null ? b.norepinephrine : (b.NE != null ? b.NE : 50);
        setArc('dopamine', dop);
        setArc('serotonin', ser);
        setArc('gaba', gab);
        setArc('norepinephrine', nor);
      })
      .catch(function () { bodyPollErrors++; })
      .finally(function () {
        var delay = 12000 + Math.min(bodyPollErrors, 6) * 4000;
        setTimeout(pollBodyState, delay);
      });
  }

  // ─── 4. CROSS-POLLINATION STRIP ─────────────────────────────────────────
  function buildCrossWind() {
    var shell = $('[data-jarvis-root]');
    if (!shell) return;
    if ($('.jarvis-crosswind', shell)) return;
    var sec = el('div', { class: 'jarvis-crosswind' });
    sec.innerHTML =
      '<div class="col" data-cross="pulses">' +
      '  <h3>From the phone <span class="src">PULSE</span></h3>' +
      '  <div class="empty">no recent pulses — the phone is still.</div>' +
      '</div>' +
      '<div class="col" data-cross="captures">' +
      '  <h3>From the browser <span class="src">EXTENSION</span></h3>' +
      '  <div class="empty">no recent captures — nothing read since dawn.</div>' +
      '</div>';

    var bodyArt = $('.jarvis-body-art', shell);
    if (bodyArt && bodyArt.parentNode) {
      bodyArt.parentNode.insertBefore(sec, bodyArt.nextSibling);
    } else {
      shell.appendChild(sec);
    }
    pollCross();
  }

  var crossPollErrors = 0;
  function pollCross() {
    fetch(api('/api/cross/snapshot'), { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        crossPollErrors = 0;
        if (!data || data.degraded || !data.snapshot) {
          // graceful — leave the empty state in place, do NOT scream
          return;
        }
        renderCrossPulses(data.snapshot.pulses || []);
        renderCrossCaptures(data.snapshot.captures || []);
      })
      .catch(function () { crossPollErrors++; })
      .finally(function () {
        var delay = 20000 + Math.min(crossPollErrors, 6) * 5000;
        setTimeout(pollCross, delay);
      });
  }

  function renderCrossPulses(items) {
    var col = document.querySelector('[data-cross="pulses"]');
    if (!col) return;
    var heading = col.querySelector('h3');
    while (col.children.length > 1) col.removeChild(col.lastChild);
    if (!items.length) {
      col.appendChild(el('div', { class: 'empty' }, 'no recent pulses — the phone is still.'));
      return;
    }
    items.slice(0, 4).forEach(function (p) {
      var note = (p.note || p.text || p.body || '').toString().slice(0, 140);
      var mood = p.mood != null ? p.mood : (p.valence != null ? p.valence : null);
      var energy = p.energy != null ? p.energy : (p.arousal != null ? p.arousal : null);
      var bits = [];
      if (mood   != null) bits.push('mood ' + Math.round(Number(mood)));
      if (energy != null) bits.push('energy ' + Math.round(Number(energy)));
      bits.push(relTime(p.created_at || p.ts || p.captured_at));
      col.appendChild(el('div', { class: 'item' }, [
        note || '(no note)',
        el('span', { class: 'meta' }, bits.join(' · '))
      ]));
    });
  }

  function renderCrossCaptures(items) {
    var col = document.querySelector('[data-cross="captures"]');
    if (!col) return;
    while (col.children.length > 1) col.removeChild(col.lastChild);
    if (!items.length) {
      col.appendChild(el('div', { class: 'empty' }, 'no recent captures — nothing read since dawn.'));
      return;
    }
    items.slice(0, 4).forEach(function (c) {
      var title = (c.title || c.url_redacted || c.url || c.domain || '(untitled)').toString().slice(0, 80);
      var dom = c.domain || (function () { try { return new URL(c.url || '').hostname; } catch (_) { return ''; } })();
      var dwell = c.dwell_ms ? Math.round(c.dwell_ms / 1000) + 's' : '';
      var bits = [];
      if (dom)   bits.push(dom);
      if (dwell) bits.push('dwell ' + dwell);
      bits.push(relTime(c.captured_at || c.ts));
      col.appendChild(el('div', { class: 'item' }, [
        title,
        el('span', { class: 'meta' }, bits.join(' · '))
      ]));
    });
  }

  // ─── 5. WITNESS PANEL ──────────────────────────────────────────────────
  function buildWitness() {
    var shell = $('[data-jarvis-root]');
    if (!shell) return;
    if ($('.jarvis-witness', shell)) return;
    var sec = el('div', { class: 'jarvis-witness' });
    sec.appendChild(el('div', { class: 'text' },
      'this day was lived. the body holds it. mark that you saw it — the queue clears, the soul keeps the trace.'
    ));
    var btn = el('button', {
      type: 'button',
      'data-draggable': 'true',
      'aria-label': 'Witness today'
    }, 'i was here ◉');
    btn.addEventListener('click', function () {
      try {
        if (window.JARVIS && typeof window.JARVIS.witness === 'function') {
          var p = window.JARVIS.witness();
          if (p && p.then) p.then(function () { btn.setAttribute('data-witnessed', '1'); btn.textContent = 'witnessed today'; });
          else { btn.setAttribute('data-witnessed', '1'); btn.textContent = 'witnessed today'; }
        } else {
          // Direct fallback POST
          fetch(api('/api/jarvis/today/1/witness'), { method: 'POST', credentials: 'include' })
            .then(function () { btn.setAttribute('data-witnessed', '1'); btn.textContent = 'witnessed today'; })
            .catch(function () {});
        }
      } catch (_) {}
    });
    sec.appendChild(btn);

    var crosswind = $('.jarvis-crosswind', shell);
    if (crosswind && crosswind.parentNode) {
      crosswind.parentNode.insertBefore(sec, crosswind.nextSibling);
    } else {
      shell.appendChild(sec);
    }
  }

  // ─── 6. GENOME GLYPHS ──────────────────────────────────────────────────
  function buildGenome() {
    var meta = document.querySelector('.jarvis-meta');
    if (!meta) return;
    if (meta.querySelector('.jarvis-genome')) return;
    var g = el('span', { class: 'jarvis-genome' }, [
      el('span', { class: 'gene', 'data-gene': 'BDNF' }, 'BDNF'),
      el('span', { class: 'gene', 'data-gene': 'CREB' }, 'CREB'),
      el('span', { class: 'gene', 'data-gene': 'ARC'  }, 'ARC')
    ]);
    meta.appendChild(g);
  }
  function fireGene(gene) {
    var g = document.querySelector('.jarvis-genome .gene[data-gene="' + gene + '"]');
    if (!g) return;
    g.setAttribute('data-firing', '1');
    setTimeout(function () { g.removeAttribute('data-firing'); }, 1200);
  }
  var LAYER_TO_GENE = {
    subconscious: 'BDNF', genetic: 'CREB', emotional: 'ARC',
    neural: 'BDNF', somatic: 'ARC', metabolic: 'CREB', immune: 'ARC'
  };

  // ─── 7. WALKALONG DWELL OBSERVER ────────────────────────────────────────
  // Grateful Dead collector ethic: the panels you actually read get marked
  // for the day. The wire layer can read these later and weight memory.
  function startDwellObserver() {
    if (!('IntersectionObserver' in window)) return;
    var dwellTimers = new Map();
    var DWELL_MS = 2400;        // a real read, not a glance
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
          el.setAttribute('data-jarvis-dwelling', '1');
          if (dwellTimers.has(el)) return;
          dwellTimers.set(el, setTimeout(function () {
            el.setAttribute('data-jarvis-dwelt', '1');
            try {
              window.dispatchEvent(new CustomEvent('jarvis:dwell', {
                detail: { layer: el.getAttribute('data-jarvis-layer') }
              }));
            } catch (_) {}
          }, DWELL_MS));
        } else {
          el.removeAttribute('data-jarvis-dwelling');
          if (dwellTimers.has(el)) {
            clearTimeout(dwellTimers.get(el));
            dwellTimers.delete(el);
          }
        }
      });
    }, { threshold: [0, 0.55, 1] });
    document.querySelectorAll('[data-jarvis-layer]').forEach(function (n) { io.observe(n); });
  }

  // ─── WIRING ────────────────────────────────────────────────────────────
  function init() {
    // Opt-in marker can live on either <html> or <body> (jarvis.html puts it
    // on <html> for SSR contrast styling, but earlier drafts assumed body).
    // Check both. Also short-circuit-true if the shell root is present —
    // that's the real signal that we're on the JARVIS page.
    var htmlOpt = document.documentElement && document.documentElement.getAttribute('data-jarvis');
    var bodyOpt = document.body && document.body.getAttribute('data-jarvis');
    var shellPresent = !!document.querySelector('[data-jarvis-root]');
    if (htmlOpt !== 'on' && bodyOpt !== 'on' && !shellPresent) return;

    buildLivingRow();
    buildWeather();
    buildBodyArt();
    buildCrossWind();
    buildWitness();
    buildGenome();
    startDwellObserver();
  }

  // Listen to wire events to pulse the spine + fire genes
  window.addEventListener('vint:jarvis:layer_updated', function (e) {
    var layer = e && e.detail && e.detail.layer;
    if (!layer) return;
    pulseSpineNode(layer);
    var gene = LAYER_TO_GENE[layer];
    if (gene) fireGene(gene);
  });

  // Re-pulse on opened (acknowledgment)
  window.addEventListener('vint:jarvis:opened', function () {
    LAYER_ORDER.forEach(function (l, i) {
      setTimeout(function () { pulseSpineNode(l); }, 80 + i * 60);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
