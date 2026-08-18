// galactic-time.js — a pleasure clock for tasks, thoughts, and connections.
//
// It borrows DirverseHUD's rail and one-sheet registry. No fixed launcher, no
// free-floating panel: the rail allocates the button and the sheet owns its
// scroll box, matching the collision discipline of the world surfaces around it.
(function () {
  'use strict';
  if (window.VintGalacticTime) return;

  var W = window;
  var _sheet = null;
  var _canvas = null;
  var _ctx = null;
  var _raf = 0;
  var _waits = 0;
  var _tasks = [];
  var _nodes = [];
  var _links = [];
  var _born = Date.now();

  function hud() { return W.DirverseHUD; }
  function toast(msg) { try { if (hud() && hud().toast) hud().toast(msg); } catch (_) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('galactic_time') === '0') return false;
      if (q.get('galactic_time') === '1') return true;
      return localStorage.getItem('vint:flag:galactic_time') !== '0';
    } catch (_) { return true; }
  }

  function injectStyles() {
    if (document.getElementById('vint-galactic-time-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-galactic-time-styles';
    s.textContent = [
      '#gtSheet .gt-wrap{display:grid;gap:12px;}',
      '#gtSheet .gt-sky{position:relative;min-height:340px;aspect-ratio:16/10;border-radius:18px;',
      ' overflow:hidden;border:1px solid rgba(128,222,234,.2);background:',
      ' radial-gradient(circle at 50% 50%,rgba(128,222,234,.14),transparent 18%),',
      ' radial-gradient(circle at 24% 22%,rgba(139,92,246,.18),transparent 21%),',
      ' radial-gradient(circle at 78% 76%,rgba(255,212,121,.14),transparent 24%),',
      ' linear-gradient(180deg,#050713,#09070d 58%,#030306);',
      ' box-shadow:0 0 0 1px rgba(255,255,255,.025) inset,0 20px 70px -42px rgba(128,222,234,.58);}',
      '#gtCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;}',
      '#gtSheet .gt-readout{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:7px;',
      ' flex-wrap:wrap;z-index:2;}',
      '#gtSheet .gt-chip{background:rgba(4,8,16,.64);border:1px solid rgba(128,222,234,.22);',
      ' border-radius:999px;padding:6px 10px;color:#dcefff;font-size:11px;font-weight:700;',
      ' letter-spacing:.06em;text-transform:uppercase;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
      ' font-variant-numeric:tabular-nums;}',
      '#gtSheet .gt-chip b{color:#80deea;}',
      '#gtSheet .gt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;}',
      '#gtSheet .gt-card{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:13px;',
      ' background:linear-gradient(155deg,rgba(128,222,234,.07),rgba(255,255,255,.035));padding:11px 12px;}',
      '#gtSheet .gt-card h3{margin:0 0 7px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9fdcff;}',
      '#gtSheet .gt-card p{margin:0;font-size:13px;line-height:1.45;color:rgba(220,231,255,.74);overflow-wrap:anywhere;}',
      '#gtSheet .gt-orbits{display:flex;flex-wrap:wrap;gap:6px;}',
      '#gtSheet .gt-orbit{display:inline-flex;align-items:center;gap:6px;min-height:32px;max-width:100%;',
      ' border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.04);',
      ' color:rgba(220,231,255,.78);font-size:12px;}',
      '#gtSheet .gt-star{width:7px;height:7px;border-radius:50%;flex:none;background:currentColor;box-shadow:0 0 10px currentColor;}',
      '#gtSheet .gt-empty{padding:20px 8px;text-align:center;color:rgba(206,224,255,.5);font-style:italic;}',
      '@media(max-width:560px){#gtSheet .gt-sky{min-height:300px;aspect-ratio:4/5;}',
      '#gtSheet .gt-readout{position:relative;left:auto;right:auto;bottom:auto;padding:10px;}',
      '#gtSheet .gt-chip{font-size:10px;}}',
      '@media(prefers-reduced-motion:reduce){#gtCanvas{opacity:.86;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function statusColor(status) {
    if (status === 'done') return '#14b8a6';
    if (status === 'doing' || status === 'claimed') return '#80deea';
    if (status === 'needs-human' || status === 'blocked') return '#ff8fa3';
    if (status === 'paused') return '#ffd479';
    return '#c4b5fd';
  }

  function fallbackTasks() {
    return [
      { id: 'THOUGHT', title: 'thoughts looking for form', status: 'doing', project: 'Vintinuum', priority: 1 },
      { id: 'TASKS', title: 'tasks waiting in orbit', status: 'todo', project: 'Council', priority: 2 },
      { id: 'BONDS', title: 'connections pulling meaning into lines', status: 'done', project: 'Memory', priority: 3 },
      { id: 'TIME', title: 'galactic clock breathing in the background', status: 'claimed', project: 'World', priority: 4 },
      { id: 'FUN', title: 'pleasure section for no reason except aliveness', status: 'done', project: 'World', priority: 1 }
    ];
  }

  async function loadTasks() {
    var candidates = ['/api/tasks', '/api/list'];
    for (var i = 0; i < candidates.length; i++) {
      try {
        var r = await fetch(candidates[i], { credentials: 'include' });
        if (!r.ok) continue;
        var j = await r.json();
        var arr = Array.isArray(j) ? j : (Array.isArray(j.tasks) ? j.tasks : []);
        if (arr.length) {
          _tasks = arr.slice(0, 48);
          return;
        }
      } catch (_) {}
    }
    _tasks = fallbackTasks();
  }

  function buildNodes() {
    var cx = 0.5, cy = 0.5;
    var tasks = _tasks.length ? _tasks : fallbackTasks();
    _nodes = [{
      id: 'core', kind: 'core', label: 'now', x: cx, y: cy, r: 26, color: '#ffd479', phase: 0
    }];
    tasks.forEach(function (t, i) {
      var band = (i % 3) + 1;
      var angle = (i / Math.max(1, tasks.length)) * Math.PI * 2 + band * 0.46;
      var radius = 0.16 + band * 0.095 + ((i % 5) * 0.008);
      _nodes.push({
        id: t.id || String(i),
        kind: 'task',
        task: t,
        label: t.title || t.id || 'task',
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.78,
        r: Math.max(6, 13 - band * 1.5 - Math.min(4, (Number(t.priority) || 3))),
        color: statusColor(t.status),
        phase: angle
      });
    });
    var groups = {};
    tasks.forEach(function (t) {
      var k = t.project || t.assignee || 'unbound';
      if (!groups[k]) groups[k] = [];
      groups[k].push(t.id);
    });
    _links = _nodes.slice(1).map(function (n) { return ['core', n.id]; });
    Object.keys(groups).forEach(function (k) {
      var ids = groups[k].filter(Boolean).slice(0, 8);
      for (var i = 1; i < ids.length; i++) _links.push([ids[i - 1], ids[i]]);
    });
  }

  function resizeCanvas() {
    if (!_canvas) return;
    var rect = _canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (_canvas.width !== w || _canvas.height !== h) {
      _canvas.width = w;
      _canvas.height = h;
    }
    _ctx = _canvas.getContext('2d');
  }

  function draw() {
    if (!_canvas || !_ctx) return;
    resizeCanvas();
    var Wd = _canvas.width, Hd = _canvas.height;
    var t = (Date.now() - _born) / 1000;
    _ctx.clearRect(0, 0, Wd, Hd);

    for (var s = 0; s < 90; s++) {
      var x = ((Math.sin(s * 91.7) * 43758.5453) % 1 + 1) % 1;
      var y = ((Math.sin(s * 57.3) * 29123.331) % 1 + 1) % 1;
      var a = 0.12 + 0.25 * Math.abs(Math.sin(t * 0.45 + s));
      _ctx.fillStyle = 'rgba(220,240,255,' + a.toFixed(3) + ')';
      _ctx.fillRect(x * Wd, y * Hd, s % 7 === 0 ? 2 : 1, s % 7 === 0 ? 2 : 1);
    }

    var byId = {};
    _nodes.forEach(function (n) { byId[n.id] = n; });
    _links.forEach(function (l, i) {
      var a = byId[l[0]], b = byId[l[1]];
      if (!a || !b) return;
      var ax = a.x * Wd, ay = a.y * Hd, bx = b.x * Wd, by = b.y * Hd;
      _ctx.beginPath();
      _ctx.moveTo(ax, ay);
      _ctx.lineTo(bx, by);
      _ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,212,121,.18)' : 'rgba(128,222,234,.16)';
      _ctx.lineWidth = Math.max(1, Wd / 1200);
      _ctx.stroke();
    });

    _nodes.forEach(function (n) {
      var wob = Math.sin(t * 0.8 + n.phase) * (n.kind === 'core' ? 0 : 4);
      var x = n.x * Wd + wob, y = n.y * Hd + Math.cos(t * 0.7 + n.phase) * 3;
      var r = n.r * (Wd < 500 ? 0.82 : 1);
      var g = _ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 1, x, y, r * 3.8);
      g.addColorStop(0, n.color);
      g.addColorStop(0.24, n.color + 'aa');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      _ctx.fillStyle = g;
      _ctx.beginPath();
      _ctx.arc(x, y, r * 3.8, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.fillStyle = n.color;
      _ctx.beginPath();
      _ctx.arc(x, y, Math.max(2.5, r * 0.42), 0, Math.PI * 2);
      _ctx.fill();
      if (n.kind === 'core') {
        _ctx.strokeStyle = 'rgba(255,212,121,.36)';
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.arc(x, y, r * (1.15 + Math.sin(t) * 0.04), 0, Math.PI * 2);
        _ctx.stroke();
      }
    });

    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      _raf = requestAnimationFrame(draw);
    }
  }

  function renderMeta() {
    var counts = _tasks.reduce(function (m, t) {
      m[t.status || 'unknown'] = (m[t.status || 'unknown'] || 0) + 1;
      return m;
    }, {});
    var projects = Array.from(new Set(_tasks.map(function (t) { return t.project || 'unbound'; }))).slice(0, 8);
    var live = (counts.doing || 0) + (counts.claimed || 0);
    var readout = document.getElementById('gtReadout');
    var orbits = document.getElementById('gtOrbits');
    var pulse = document.getElementById('gtPulse');
    if (readout) {
      readout.innerHTML = [
        '<span class="gt-chip"><b>' + _tasks.length + '</b> bodies</span>',
        '<span class="gt-chip"><b>' + live + '</b> in motion</span>',
        '<span class="gt-chip"><b>' + _links.length + '</b> lines</span>',
        '<span class="gt-chip"><b>' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</b> local</span>'
      ].join('');
    }
    if (orbits) {
      orbits.innerHTML = projects.map(function (p, i) {
        var c = ['#80deea', '#ffd479', '#c4b5fd', '#14b8a6', '#ff8fa3'][i % 5];
        return '<span class="gt-orbit" style="color:' + c + '"><span class="gt-star"></span><span>' + esc(p) + '</span></span>';
      }).join('') || '<div class="gt-empty">no project orbits yet.</div>';
    }
    if (pulse) {
      pulse.textContent = _tasks.some(function (t) { return t.status === 'needs-human' || t.status === 'blocked'; })
        ? 'A red node means a task is asking for attention; cyan means active motion.'
        : 'The clock is decorative, but every line is derived from task kinship when task data is reachable.';
    }
  }

  function build() {
    if (_sheet) return;
    injectStyles();
    _sheet = document.createElement('section');
    _sheet.id = 'gtSheet';
    _sheet.className = 'dv-sheet';
    _sheet.setAttribute('aria-label', 'Galactic time');
    _sheet.innerHTML = [
      '<div class="dv-grip"></div>',
      '<div class="dv-head"><div class="dv-title">galactic time<small>tasks, thoughts, connections</small></div>',
      '<button type="button" class="dv-x" id="gtClose" aria-label="Close galactic time">x</button></div>',
      '<div class="dv-body"><div class="gt-wrap">',
      '<div class="gt-sky"><canvas id="gtCanvas" width="900" height="560" aria-hidden="true"></canvas>',
      '<div class="gt-readout" id="gtReadout"></div></div>',
      '<div class="gt-grid">',
      '<div class="gt-card"><h3>orb dwelling</h3><p id="gtPulse">The center is now; every task becomes a small planet pulled by project, status, and priority.</p></div>',
      '<div class="gt-card"><h3>orbits</h3><div class="gt-orbits" id="gtOrbits"></div></div>',
      '<div class="gt-card"><h3>pleasure clock</h3><p>Nothing here queues work or changes data. It is a star-studded room for seeing the council breathe.</p></div>',
      '</div>',
      '</div></div>'
    ].join('');
    document.body.appendChild(_sheet);
    document.getElementById('gtClose').addEventListener('click', close);
    _canvas = document.getElementById('gtCanvas');
    addEventListener('resize', resizeCanvas);
  }

  async function open() {
    build();
    var h = hud();
    var raise = function () {
      _sheet.classList.add('open');
      loadTasks().then(function () {
        if (!isOpen()) return;
        buildNodes();
        renderMeta();
        resizeCanvas();
        cancelAnimationFrame(_raf);
        draw();
      });
    };
    if (h && h.openSheet) h.openSheet('galactic-time', raise);
    else raise();
  }

  function close() {
    if (!_sheet) return;
    _sheet.classList.remove('open');
    cancelAnimationFrame(_raf);
    _raf = 0;
  }

  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) {
      if (_waits++ < 25) setTimeout(mountLauncher, 90);
      return;
    }
    try { h.registerSheet('galactic-time', isOpen, close); } catch (_) {}
    h.addLauncher('gtBtn', 'galactic time', '◌', open);
  }

  W.VintGalacticTime = { open: open, close: close, enabled: enabled };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();
})();
