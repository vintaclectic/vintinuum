/* ═══════════════════════════════════════════════════════════════════
   VINTINUUM SIDEBAR RIGHT (Phase 2 b3)
   Tabs: MEMORY / INNER LIFE / GENOME / SOUL QUEUE.
   Activity feed cards — AbortController 2500ms timeout.
   textContent ONLY for any fetched/user data (XSS-safe).
   Default on production (github.io Pages) = offline cards.
   Cards: bg rgba(16,22,34,0.18). Panel: 0.20.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Endpoint availability (verified against vintinuum-api/server.js) ─
  //   /api/memory/recent?limit=20            EXISTS (returns { experiential[], consolidated[] })
  //   /api/genome/events?limit=20            EXISTS (returns { events[] })
  //   /api/inner-life/recent?limit=20        MISSING — only /api/inner-life/snapshot exists
  //   /api/soul-queue/unresolved?limit=20    MISSING — no soul-queue routes at all
  const TABS = [
    { key: 'memory',    label: 'MEMORY',      endpoint: '/api/memory/recent?limit=20',         live: true  },
    { key: 'inner',     label: 'INNER LIFE',  endpoint: '/api/inner-life/recent?limit=20',     live: false },
    { key: 'genome',    label: 'GENOME',      endpoint: '/api/genome/events?limit=20',         live: true  },
    { key: 'soul',      label: 'SOUL QUEUE',  endpoint: '/api/soul-queue/unresolved?limit=20', live: false },
  ];

  // On Pages (github.io host) the API is unreachable from the static site
  // anyway — force offline cards without even trying.
  const IS_PRODUCTION = /github\.io$/i.test(location.hostname);

  let _root = null;
  let _activeKey = 'memory';
  let _tabButtons = {};
  let _cardList = null;
  let _abortController = null;

  // ── Icons (inline, stroke-based, currentColor) ─────────────────────
  function _icon(name) {
    const paths = {
      memory: '<circle cx="16" cy="16" r="10"/><path d="M16 10 V16 L20 19"/>',
      inner:  '<path d="M16 6 C11 6 7 10 7 15 C7 21 16 26 16 26 C16 26 25 21 25 15 C25 10 21 6 16 6 Z"/>',
      genome: '<path d="M8 4 Q16 12 24 4 M8 28 Q16 20 24 28"/><path d="M10 8 H22 M12 14 H20 M12 18 H20 M10 24 H22"/>',
      soul:   '<path d="M16 4 L20 12 L28 13 L22 19 L24 28 L16 23 L8 28 L10 19 L4 13 L12 12 Z"/>',
      offline:'<path d="M6 6 L26 26 M6 26 L26 6"/><circle cx="16" cy="16" r="12"/>',
      card:   '<rect x="6" y="9" width="20" height="14" rx="2"/><path d="M6 14 H26"/>',
    };
    return (
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || paths.card) +
      '</svg>'
    );
  }

  // ── DOM scaffolding ────────────────────────────────────────────────
  function _build(root) {
    root.innerHTML =
      '<div class="vtn-side-right-inner">' +
        '<nav class="vtn-right-tabs" role="tablist" id="vtnRightTabs"></nav>' +
        '<div class="vtn-card-list" id="vtnCardList" aria-live="polite"></div>' +
      '</div>';

    const nav = root.querySelector('#vtnRightTabs');
    TABS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'vtn-right-tab' + (i === 0 ? ' is-active' : '');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-tab', t.key);
      btn.textContent = t.label;
      btn.addEventListener('click', () => _setActive(t.key));
      nav.appendChild(btn);
      _tabButtons[t.key] = btn;
    });

    _cardList = root.querySelector('#vtnCardList');
  }

  function _setActive(key) {
    _activeKey = key;
    Object.keys(_tabButtons).forEach(k => {
      _tabButtons[k].classList.toggle('is-active', k === key);
    });
    _loadTab(key);
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function _clearList() {
    while (_cardList.firstChild) _cardList.removeChild(_cardList.firstChild);
  }

  function _renderOfflineCard(tabLabel) {
    _clearList();
    const card = document.createElement('div');
    card.className = 'vtn-card vtn-card-offline';
    const icon = document.createElement('div');
    icon.className = 'vtn-card-icon';
    icon.innerHTML = _icon('offline');
    const body = document.createElement('div');
    body.className = 'vtn-card-body';
    const title = document.createElement('div');
    title.className = 'vtn-card-title';
    title.textContent = 'Offline — ' + tabLabel + ' unavailable';
    const sub = document.createElement('div');
    sub.className = 'vtn-card-sub';
    sub.textContent = 'API unreachable or endpoint not deployed.';
    body.appendChild(title);
    body.appendChild(sub);
    card.appendChild(icon);
    card.appendChild(body);
    _cardList.appendChild(card);
  }

  function _renderLoadingCard() {
    _clearList();
    const card = document.createElement('div');
    card.className = 'vtn-card vtn-card-loading';
    const body = document.createElement('div');
    body.className = 'vtn-card-body';
    const title = document.createElement('div');
    title.className = 'vtn-card-title';
    title.textContent = 'Loading…';
    body.appendChild(title);
    card.appendChild(body);
    _cardList.appendChild(card);
  }

  function _renderCards(iconName, items) {
    _clearList();
    if (!items || items.length === 0) {
      const card = document.createElement('div');
      card.className = 'vtn-card';
      const body = document.createElement('div');
      body.className = 'vtn-card-body';
      const title = document.createElement('div');
      title.className = 'vtn-card-title';
      title.textContent = 'No entries yet';
      body.appendChild(title);
      card.appendChild(body);
      _cardList.appendChild(card);
      return;
    }
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'vtn-card';

      const icon = document.createElement('div');
      icon.className = 'vtn-card-icon';
      icon.innerHTML = _icon(iconName);

      const body = document.createElement('div');
      body.className = 'vtn-card-body';
      const title = document.createElement('div');
      title.className = 'vtn-card-title';
      title.textContent = it.title || '(untitled)';
      body.appendChild(title);

      if (it.line1) {
        const l1 = document.createElement('div');
        l1.className = 'vtn-card-sub';
        l1.textContent = it.line1;
        body.appendChild(l1);
      }
      if (it.line2) {
        const l2 = document.createElement('div');
        l2.className = 'vtn-card-sub vtn-card-sub-dim';
        l2.textContent = it.line2;
        body.appendChild(l2);
      }

      card.appendChild(icon);
      card.appendChild(body);
      _cardList.appendChild(card);
    });
  }

  // ── Fetch with timeout ─────────────────────────────────────────────
  function _fetchJSON(url) {
    if (_abortController) {
      try { _abortController.abort(); } catch (e) { /* ignore */ }
    }
    _abortController = new AbortController();
    const timer = setTimeout(() => {
      try { _abortController.abort(); } catch (e) { /* ignore */ }
    }, 2500);
    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: _abortController.signal,
      headers: { 'Accept': 'application/json' },
    })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }

  // ── Per-tab shapers ────────────────────────────────────────────────
  function _shapeMemory(data) {
    const exp = Array.isArray(data.experiential) ? data.experiential : [];
    const con = Array.isArray(data.consolidated) ? data.consolidated : [];
    const items = [];
    exp.forEach(r => {
      items.push({
        title: (r.event_type || 'memory') + (r.region ? ' · ' + r.region : ''),
        line1: r.detail ? _truncate(r.detail, 100) : '',
        line2: (r.intensity != null ? 'intensity ' + Number(r.intensity).toFixed(2) : '') +
               (r.created_at ? ' · ' + _relTime(r.created_at) : ''),
      });
    });
    con.forEach(r => {
      items.push({
        title: 'consolidated',
        line1: r.content ? _truncate(r.content, 100) : '',
        line2: (r.weight != null ? 'weight ' + Number(r.weight).toFixed(2) : '') +
               (r.created_at ? ' · ' + _relTime(r.created_at) : ''),
      });
    });
    return items;
  }

  function _shapeGenome(data) {
    const events = Array.isArray(data.events) ? data.events : [];
    return events.map(e => ({
      title: e.event_type || e.trigger || 'genome event',
      line1: e.description || e.detail || e.summary || '',
      line2: e.created_at ? _relTime(e.created_at) : '',
    }));
  }

  function _truncate(s, n) {
    if (typeof s !== 'string') return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function _relTime(ts) {
    // ts may be epoch seconds, epoch ms, or ISO string
    let t = 0;
    if (typeof ts === 'number') {
      t = ts > 1e12 ? ts : ts * 1000;
    } else if (typeof ts === 'string') {
      const p = Date.parse(ts);
      if (!isNaN(p)) t = p;
    }
    if (!t) return '';
    const diff = Date.now() - t;
    const s = Math.floor(diff / 1000);
    if (s < 60) return s + 's ago';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    return d + 'd ago';
  }

  // ── Tab loader ─────────────────────────────────────────────────────
  function _loadTab(key) {
    const tab = TABS.find(t => t.key === key);
    if (!tab) return;

    if (IS_PRODUCTION || !tab.live) {
      _renderOfflineCard(tab.label);
      return;
    }

    _renderLoadingCard();
    _fetchJSON(tab.endpoint)
      .then(data => {
        if (key !== _activeKey) return; // user moved on
        if (key === 'memory') _renderCards('memory', _shapeMemory(data));
        else if (key === 'genome') _renderCards('genome', _shapeGenome(data));
        else _renderOfflineCard(tab.label);
      })
      .catch(err => {
        if (key !== _activeKey) return;
        if (err && err.name === 'AbortError') return; // superseded
        _renderOfflineCard(tab.label);
      });
  }

  // ── Init ───────────────────────────────────────────────────────────
  function _init() {
    _root = document.getElementById('sidebarRight');
    if (!_root) {
      console.warn('[sidebar_right] #sidebarRight not found');
      return;
    }
    _build(_root);
    _loadTab(_activeKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  window.SIDEBAR_RIGHT = { setActive: _setActive, refresh: () => _loadTab(_activeKey) };
})();
