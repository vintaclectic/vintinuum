// ════════════════════════════════════════════════════════════════════════════
// PULSE — the live work dashboard (Vinta directive 2026-08-14)
// ════════════════════════════════════════════════════════════════════════════
// The right sidebar's activity feed was passive: four tabs of "what already
// happened." This module adds the fifth tab — PULSE — which answers the only
// question a passive feed can't: *what is happening right now, and how far
// along is it?*
//
// THE HONESTY CONTRACT (Retention Doctrine test 1 — generous, not predatory):
//   Every bar on this surface is backed by a real counter from a real job.
//   There is NO synthetic creep, NO "fake it to 90% and wait" pattern, NO
//   time-based easing that pretends progress the backend never reported.
//   A job that reports 12/50 draws 24%. A job that reports nothing draws an
//   INDETERMINATE bar (a sweeping shimmer), never a number we invented.
//   If we can't prove it, we don't draw it. That's the whole doctrine here:
//   the bar is trustworthy precisely because it is sometimes disappointing.
//
// DATA SOURCES (all real, all already shipping in vintinuum-api/server.js):
//   - SSE  /api/life/stream          → `eval_progress` frames:
//         { type:'eval_progress', jobId, phase:'started'|'probe'|'gate'|'done',
//           gauntlet, i, n, probe, score, threshold, pass, exit_code, status }
//     `phase:'probe'` carries i/n — that IS the progress ratio. Nothing else
//     is invented. `gate` frames carry a score against a threshold — drawn as
//     a determinate bar of score/threshold, capped at 1.
//   - GET  /api/eval/job/:id         → reconciliation on reconnect, so a
//     refresh mid-job restores the true position instead of restarting at 0.
//   - Any surface may push its own real work in via the public API below.
//
// PUBLIC API (for any module with real, countable work):
//   VintPulse.track(id, { label, detail, total })   → declare a job
//   VintPulse.advance(id, done [, detail])          → move it (done/total)
//   VintPulse.indeterminate(id, { label, detail })  → work with no countable end
//   VintPulse.done(id, { ok, summary })             → settle it
//   VintPulse.fail(id, reason)                      → settle it as failed
// Anything tracked here appears in PULSE instantly. No backend change needed
// for a caller that already knows its own counts.
//
// NO-COLLISION LAW: this module renders ONLY inside #vtnCardList, the existing
// scroll container owned by sidebar_right.js. It creates no fixed/absolute
// element in the page coordinate space. The one absolutely-positioned thing it
// draws — the bar fill — is clipped inside its own `overflow:hidden` track,
// which is a normal flow child of a card. It cannot reach a sibling. Verified
// 320/375/768/1280/1920.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.VintPulse) return;

  // ── Config ────────────────────────────────────────────────────────────────
  var SETTLE_LINGER_MS = 45000;   // how long a finished job stays visible
  var STALE_MS         = 120000;  // a running job silent this long → "stalled"
  var TICK_MS          = 1000;    // elapsed-time repaint cadence
  var MAX_VISIBLE      = 24;      // hard cap; the list scrolls, never overflows

  // ── State ─────────────────────────────────────────────────────────────────
  // jobs: id → {
  //   id, label, detail, total, done, indeterminate, status, ok, summary,
  //   started, updated, finished, kind
  // }
  var jobs = new Map();
  var mounted = null;      // the DOM node we own inside #vtnCardList
  var rows = new Map();    // id → { el, fill, pct, detail, meta, state }
  var tickTimer = null;
  var es = null;
  var esRetry = 0;
  var listeners = [];

  // ── Small helpers ─────────────────────────────────────────────────────────
  function now() { return Date.now(); }

  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function apiBase() {
    try {
      if (window.__VINTINUUM_API_BASE) return String(window.__VINTINUUM_API_BASE).replace(/\/$/, '');
      if (window.VINTINUUM_API) return String(window.VINTINUUM_API).replace(/\/$/, '');
    } catch (_) {}
    return '';
  }

  // Elapsed, in the shortest honest form. "4s" / "2m 10s" / "1h 04m".
  function elapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + 'm ' + (r < 10 ? '0' : '') + r + 's';
    var h = Math.floor(m / 60), rm = m % 60;
    return h + 'h ' + (rm < 10 ? '0' : '') + rm + 'm';
  }

  // The open loop (Retention Doctrine test 5). We only project a finish time
  // once there's enough real signal to be honest about it: at least 3 steps
  // done and 6 seconds of history. Below that we say nothing rather than lie.
  function projectRemaining(j) {
    if (j.indeterminate || !j.total || j.done < 3) return null;
    var span = j.updated - j.started;
    if (span < 6000) return null;
    var rate = j.done / span;            // steps per ms
    if (!(rate > 0)) return null;
    var left = (j.total - j.done) / rate;
    if (!isFinite(left) || left <= 0) return null;
    if (left > 6 * 3600 * 1000) return null;  // absurd projection → stay quiet
    return left;
  }

  function ratio(j) {
    if (j.indeterminate) return null;
    if (!j.total) return null;
    return clamp01(j.done / j.total);
  }

  function isLive(j) {
    return j.status === 'running' || j.status === 'stalled';
  }

  // Sort: live work first (least complete first — the thing that needs the most
  // watching sits at the top), then stalled, then recently settled by recency.
  // This is the visual hierarchy: the most important work is literally first.
  function ordered() {
    var arr = Array.from(jobs.values());
    arr.sort(function (a, b) {
      var ar = a.status === 'running' ? 0 : a.status === 'stalled' ? 1 : 2;
      var br = b.status === 'running' ? 0 : b.status === 'stalled' ? 1 : 2;
      if (ar !== br) return ar - br;
      if (ar === 2) return (b.finished || b.updated) - (a.finished || a.updated);
      var ap = ratio(a), bp = ratio(b);
      if (ap == null && bp == null) return a.started - b.started;
      if (ap == null) return 1;
      if (bp == null) return -1;
      return ap - bp;
    });
    return arr.slice(0, MAX_VISIBLE);
  }

  function emit() {
    var live = 0;
    jobs.forEach(function (j) { if (isLive(j)) live++; });
    listeners.forEach(function (fn) { try { fn(live); } catch (_) {} });
    try {
      window.dispatchEvent(new CustomEvent('pulse:changed', { detail: { live: live } }));
    } catch (_) {}
  }

  // ── Mutation core ─────────────────────────────────────────────────────────
  function upsert(id, patch) {
    if (!id) return null;
    var j = jobs.get(id);
    if (!j) {
      j = {
        id: id, label: id, detail: '', kind: 'work',
        total: 0, done: 0, indeterminate: false,
        status: 'running', ok: null, summary: '',
        started: now(), updated: now(), finished: 0
      };
      jobs.set(id, j);
    }
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) j[k] = patch[k];
    j.updated = now();
    render();
    emit();
    return j;
  }

  function sweep() {
    var t = now(), changed = false;
    jobs.forEach(function (j, id) {
      if (j.status === 'running' && t - j.updated > STALE_MS) {
        j.status = 'stalled';
        changed = true;
      }
      if ((j.status === 'done' || j.status === 'failed') && j.finished && t - j.finished > SETTLE_LINGER_MS) {
        jobs.delete(id);
        var r = rows.get(id);
        if (r && r.el && r.el.parentNode) r.el.parentNode.removeChild(r.el);
        rows.delete(id);
        changed = true;
      }
    });
    if (changed) { render(); emit(); }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  // Rows are reused across renders (keyed by id) so the bar animates from its
  // last width instead of snapping — that continuity is what makes the motion
  // read as "the system is working" rather than "the DOM got replaced."
  function buildRow(j) {
    var el = document.createElement('div');
    el.className = 'vtn-pulse-row';
    el.setAttribute('data-pulse-id', j.id);

    var head = document.createElement('div');
    head.className = 'vtn-pulse-head';

    var label = document.createElement('div');
    label.className = 'vtn-pulse-label';

    var pct = document.createElement('div');
    pct.className = 'vtn-pulse-pct';

    head.appendChild(label);
    head.appendChild(pct);

    var track = document.createElement('div');
    track.className = 'vtn-pulse-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');

    var fill = document.createElement('div');
    fill.className = 'vtn-pulse-fill';
    track.appendChild(fill);

    var detail = document.createElement('div');
    detail.className = 'vtn-pulse-detail';

    var meta = document.createElement('div');
    meta.className = 'vtn-pulse-meta';

    el.appendChild(head);
    el.appendChild(track);
    el.appendChild(detail);
    el.appendChild(meta);

    return { el: el, label: label, pct: pct, track: track, fill: fill, detail: detail, meta: meta, state: '' };
  }

  function paintRow(r, j) {
    var p = ratio(j);
    var state = j.status;

    if (r.state !== state) {
      r.el.className = 'vtn-pulse-row is-' + state;
      r.state = state;
    }

    r.label.textContent = j.label || j.id;

    // The percentage readout. Determinate work shows a number; indeterminate
    // work shows a word, never a fabricated number.
    if (j.status === 'done') {
      r.pct.textContent = j.ok === false ? 'FAILED' : 'DONE';
    } else if (j.status === 'failed') {
      r.pct.textContent = 'FAILED';
    } else if (p != null) {
      r.pct.textContent = Math.round(p * 100) + '%';
    } else if (j.status === 'stalled') {
      r.pct.textContent = 'QUIET';
    } else {
      r.pct.textContent = 'WORKING';
    }

    // Bar geometry. Settled work pins to 100% so the eye gets the completion
    // payoff; indeterminate work uses a CSS shimmer with no width claim.
    var settled = (j.status === 'done' || j.status === 'failed');
    if (settled) {
      r.track.classList.remove('is-indeterminate');
      r.fill.style.width = '100%';
      r.track.setAttribute('aria-valuenow', '100');
    } else if (p != null) {
      r.track.classList.remove('is-indeterminate');
      // Floor at 1.5% so a just-started job still shows a visible seed of
      // progress rather than an empty trough that reads as "nothing happening."
      // This is presentational only — the number above it stays truthful.
      r.fill.style.width = Math.max(1.5, p * 100).toFixed(2) + '%';
      r.track.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    } else {
      r.track.classList.add('is-indeterminate');
      r.fill.style.width = '100%';
      r.track.removeAttribute('aria-valuenow');
    }

    r.track.setAttribute('aria-label', (j.label || j.id) + ' progress');

    // Detail line — the literal truth of the current step.
    var d = j.detail || '';
    if (!settled && j.total && !j.indeterminate) {
      d = (d ? d + ' · ' : '') + j.done + '/' + j.total;
    }
    if (settled && j.summary) d = j.summary;
    r.detail.textContent = d;
    r.detail.style.display = d ? '' : 'none';

    // Meta line — elapsed, and the open loop (projected remaining) when honest.
    var bits = [];
    if (settled) {
      bits.push('took ' + elapsed((j.finished || j.updated) - j.started));
    } else {
      bits.push(elapsed(now() - j.started));
      var left = projectRemaining(j);
      if (left != null) bits.push('~' + elapsed(left) + ' left');
      if (j.status === 'stalled') bits.push('no signal ' + elapsed(now() - j.updated));
    }
    r.meta.textContent = bits.join(' · ');
  }

  function render() {
    if (!mounted || !mounted.isConnected) return;
    var list = ordered();

    var head = mounted.querySelector('.vtn-pulse-summary');
    var body = mounted.querySelector('.vtn-pulse-rows');
    var empty = mounted.querySelector('.vtn-pulse-empty');
    if (!body) return;

    var live = 0, settledCount = 0;
    jobs.forEach(function (j) { if (isLive(j)) live++; else settledCount++; });

    if (head) {
      head.textContent = live > 0
        ? (live + (live === 1 ? ' job in flight' : ' jobs in flight'))
        : (settledCount > 0 ? 'all settled' : 'idle');
      head.className = 'vtn-pulse-summary' + (live > 0 ? ' is-live' : '');
    }

    if (empty) empty.style.display = list.length ? 'none' : '';

    // ── SCROLL PRESERVATION (Vinta 2026-08-17, task 2UCABMK) ──
    // Save scroll position before DOM manipulation so auto-updates don't
    // bounce the user back to top while they're reading. The scroll container
    // is #vtnCardList (mounted.parentNode), not the rows div itself.
    var scrollContainer = mounted.parentNode;
    var savedScroll = scrollContainer ? scrollContainer.scrollTop : 0;

    // Reconcile rows against the ordered list, reusing nodes.
    var seen = Object.create(null);
    list.forEach(function (j, i) {
      seen[j.id] = true;
      var r = rows.get(j.id);
      if (!r) { r = buildRow(j); rows.set(j.id, r); }
      paintRow(r, j);
      var at = body.children[i];
      if (at !== r.el) body.insertBefore(r.el, at || null);
    });
    // Drop rows that fell out of the visible window.
    rows.forEach(function (r, id) {
      if (!seen[id]) {
        if (r.el && r.el.parentNode) r.el.parentNode.removeChild(r.el);
        rows.delete(id);
      }
    });

    // Restore scroll position after DOM changes.
    if (scrollContainer && savedScroll > 0) {
      scrollContainer.scrollTop = savedScroll;
    }
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(function () {
      sweep();
      // Repaint elapsed/projection on live rows only — cheap, and it's what
      // makes the panel feel like it has a heartbeat between real events.
      var anyLive = false;
      jobs.forEach(function (j) { if (isLive(j)) anyLive = true; });
      if (anyLive) {
        rows.forEach(function (r, id) {
          var j = jobs.get(id);
          if (j && isLive(j)) paintRow(r, j);
        });
      }
    }, TICK_MS);
  }

  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  // ── Mount point (owned by sidebar_right's PULSE tab) ──────────────────────
  function mount(container) {
    if (!container) return;
    var wrap = document.createElement('div');
    wrap.className = 'vtn-pulse';
    wrap.innerHTML =
      '<div class="vtn-pulse-bar">' +
        '<span class="vtn-pulse-dot" aria-hidden="true"></span>' +
        '<span class="vtn-pulse-summary">idle</span>' +
      '</div>' +
      '<div class="vtn-pulse-rows"></div>' +
      '<div class="vtn-pulse-empty">' +
        '<div class="vtn-pulse-empty-t">Nothing in flight.</div>' +
        '<div class="vtn-pulse-empty-s">' +
          'When a job runs — an eval sweep, a corpus export, a training pass — ' +
          'it draws itself here, honestly, step by step.' +
        '</div>' +
      '</div>';
    container.appendChild(wrap);
    mounted = wrap;
    rows.clear();
    render();
    startTick();
  }

  function unmount() {
    mounted = null;
    rows.clear();
    stopTick();
  }

  // ── SSE ingest — the real progress wire ───────────────────────────────────
  // Reads `eval_progress` frames off the life stream. Every field consumed
  // here is one the server already emits (server.js ~7170-7208).
  function ingestEvalProgress(d) {
    if (!d || !d.jobId) return;
    var id = 'eval:' + d.jobId;

    if (d.phase === 'started') {
      upsert(id, {
        kind: 'eval',
        label: 'eval · ' + (d.engine || 'gauntlet'),
        detail: d.gauntlets && d.gauntlets !== 'all' ? String(d.gauntlets) : 'all gauntlets',
        indeterminate: true,     // no count until the first probe frame lands
        total: 0, done: 0,
        status: 'running',
        started: now()
      });
      return;
    }

    if (d.phase === 'probe') {
      var n = parseInt(d.n, 10), i = parseInt(d.i, 10);
      if (!isFinite(n) || !isFinite(i) || n <= 0) return;
      upsert(id, {
        kind: 'eval',
        label: 'eval · ' + (d.gauntlet || 'gauntlet'),
        detail: d.probe ? String(d.probe) : '',
        total: n, done: i,
        indeterminate: false,
        status: 'running'
      });
      return;
    }

    if (d.phase === 'gate') {
      // A gate frame is its own miniature progress statement: score against
      // the threshold it must clear. Drawn as a separate, short-lived row.
      var gid = id + ':gate:' + (d.gauntlet || '?');
      var score = parseFloat(d.score), thr = parseFloat(d.threshold);
      var pass = d.pass === true;
      if (isFinite(score) && isFinite(thr) && thr > 0) {
        upsert(gid, {
          kind: 'gate',
          label: 'gate · ' + (d.gauntlet || '?'),
          detail: score.toFixed(3) + ' vs ' + thr.toFixed(3) + (pass ? ' — clear' : ' — short'),
          total: 1000,
          done: Math.round(clamp01(score / thr) * 1000),
          indeterminate: false,
          status: 'done',
          ok: pass,
          summary: (pass ? 'cleared ' : 'missed ') + (d.gauntlet || '') + ' at ' + score.toFixed(3),
          finished: now()
        });
      }
      return;
    }

    if (d.phase === 'done') {
      var j = jobs.get(id);
      var ok = (d.status === 'complete' || d.exit_code === 0);
      upsert(id, {
        status: 'done',
        ok: ok,
        done: j && j.total ? j.total : (j ? j.done : 0),
        indeterminate: false,
        summary: d.summary
          ? String(d.summary)
          : (ok ? 'finished clean' : 'exited ' + (d.exit_code != null ? d.exit_code : '?')),
        finished: now()
      });
      return;
    }
  }

  function connect() {
    if (es) return;
    var base = apiBase();
    if (typeof EventSource === 'undefined') return;
    var url = base + '/api/life/stream';
    try {
      es = new EventSource(url);
    } catch (_) { es = null; return; }

    es.onmessage = function (m) {
      esRetry = 0;
      var d;
      try { d = JSON.parse(m.data); } catch (_) { return; }
      if (!d || !d.type) return;
      if (d.type === 'eval_progress') ingestEvalProgress(d);
    };

    es.onerror = function () {
      // The life stream is capacity-capped (503 + Retry-After) and tunneled;
      // both make transient drops normal. Back off, don't thrash it.
      try { es.close(); } catch (_) {}
      es = null;
      esRetry = Math.min(esRetry + 1, 6);
      var wait = Math.min(30000, 2000 * Math.pow(2, esRetry - 1));
      setTimeout(connect, wait);
    };
  }

  // Reconcile a known job from the REST side — used on reconnect so a page
  // refresh mid-run restores the true position rather than a blank panel.
  function reconcile(jobId) {
    var base = apiBase();
    if (!jobId) return Promise.resolve(null);
    return fetch(base + '/api/eval/job/' + encodeURIComponent(jobId), {
      cache: 'no-store', headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok) return null;
        var lp = data.last_progress || {};
        var id = 'eval:' + data.jobId;
        var running = data.status === 'running';
        upsert(id, {
          kind: 'eval',
          label: 'eval · ' + (lp.gauntlet || data.engine || 'gauntlet'),
          detail: lp.probe ? String(lp.probe) : '',
          total: parseInt(lp.n, 10) || 0,
          done: parseInt(lp.i, 10) || 0,
          indeterminate: !(parseInt(lp.n, 10) > 0),
          status: running ? 'running' : 'done',
          ok: running ? null : data.exit_code === 0,
          summary: running ? '' : (data.summary ? String(data.summary) : ''),
          started: data.started || now(),
          finished: running ? 0 : (data.finished || now())
        });
        return data;
      })
      .catch(function () { return null; });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  var API = {
    // Declare countable work. total>0 makes it determinate.
    track: function (id, opts) {
      opts = opts || {};
      var total = parseInt(opts.total, 10) || 0;
      return upsert(id, {
        label: opts.label || id,
        detail: opts.detail || '',
        kind: opts.kind || 'work',
        total: total,
        done: parseInt(opts.done, 10) || 0,
        indeterminate: total <= 0,
        status: 'running',
        ok: null,
        summary: '',
        started: now(),
        finished: 0
      });
    },

    // Move it. `done` is an absolute count, not a delta — callers always know
    // their own absolute position, and absolutes can't drift out of sync.
    advance: function (id, done, detail) {
      var j = jobs.get(id);
      if (!j) return null;
      var d = parseInt(done, 10);
      if (!isFinite(d)) return j;
      var patch = { done: Math.max(0, j.total ? Math.min(d, j.total) : d), status: 'running' };
      if (typeof detail === 'string') patch.detail = detail;
      return upsert(id, patch);
    },

    // Work with no countable end — draws the shimmer, claims no number.
    indeterminate: function (id, opts) {
      opts = opts || {};
      return upsert(id, {
        label: opts.label || (jobs.get(id) || {}).label || id,
        detail: opts.detail || '',
        indeterminate: true,
        total: 0,
        status: 'running'
      });
    },

    done: function (id, opts) {
      opts = opts || {};
      var j = jobs.get(id);
      if (!j) return null;
      return upsert(id, {
        status: 'done',
        ok: opts.ok !== false,
        done: j.total || j.done,
        indeterminate: false,
        summary: opts.summary || '',
        finished: now()
      });
    },

    fail: function (id, reason) {
      if (!jobs.get(id)) return null;
      return upsert(id, {
        status: 'failed',
        ok: false,
        summary: reason ? String(reason) : 'failed',
        finished: now()
      });
    },

    remove: function (id) {
      jobs.delete(id);
      var r = rows.get(id);
      if (r && r.el && r.el.parentNode) r.el.parentNode.removeChild(r.el);
      rows.delete(id);
      render(); emit();
    },

    // Count of live jobs — sidebar_right uses this to badge the PULSE tab.
    liveCount: function () {
      var n = 0;
      jobs.forEach(function (j) { if (isLive(j)) n++; });
      return n;
    },

    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },

    reconcile: reconcile,
    mount: mount,
    unmount: unmount,
    _jobs: jobs
  };

  window.VintPulse = API;

  // Any surface can announce work without importing anything:
  //   window.dispatchEvent(new CustomEvent('pulse:track',
  //     { detail: { id, label, total } }))
  window.addEventListener('pulse:track', function (e) {
    var d = e && e.detail; if (d && d.id) API.track(d.id, d);
  });
  window.addEventListener('pulse:advance', function (e) {
    var d = e && e.detail; if (d && d.id) API.advance(d.id, d.done, d.detail);
  });
  window.addEventListener('pulse:done', function (e) {
    var d = e && e.detail; if (d && d.id) API.done(d.id, d);
  });

  connect();
  startTick();
})();
