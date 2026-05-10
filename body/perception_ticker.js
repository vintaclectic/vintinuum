// ════════════════════════════════════════════════════════════════════════════
// PERCEPTION TICKER — visible breadcrumb of what she just noticed
// ════════════════════════════════════════════════════════════════════════════
// perception_in.js handles the embodied reaction (glance/walk/mood blip).
// This module is the *visible* counterpart: a small unobtrusive line that
// appears near the bottom of the viewport with the connector summary, so
// the user can see what Vintinuum just sensed at the moment her body
// reacted. Disappears on its own after a short read window.
//
// Behaviors:
//   - one ticker line at a time (newer perception replaces older)
//   - dwell scales with intensity: 4s baseline + intensity*4s (max 8s)
//   - clipped to viewport with safe margins (no-overflow rule honored)
//   - connector glyph + summary text + soft fade
//   - clickable: dispatches `perception:focus` so other UI (chat panel,
//     brain panel) can promote the perception into a fuller view
//   - draggable per the all-buttons-draggable rule (auto-inherited if
//     draggable.js is present)
//   - opt-out: <html data-perception-ticker="off">
//
// Position: bottom-center by default, above the dock if present, below
// the chat input if it exists.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__perceptionTicker) return;
  if (document.documentElement.dataset.perceptionTicker === 'off') return;

  // Connector glyph map — single chars or short tokens. No emoji because
  // Vinta's standing rule is no emoji unless asked. We use bracketed
  // monospace tags as glyphs that read clearly at 11px.
  var GLYPH = {
    spotify:         '[♪]',
    soundcloud:      '[~]',
    youtube:         '[▶]',
    twitch:          '[●]',
    twitter:         '[x]',
    mastodon:        '[m]',
    bluesky:         '[b]',
    discord:         '[d]',
    slack:           '[s]',
    gmail:           '[@]',
    google_calendar: '[#]',
    notion:          '[n]',
    linear:          '[L]',
    github:          '[git]'
  };

  // Soft accent colors per body-part. Match avatar gold-leaf palette so
  // the ticker reads as part of the same body, not a stray UI element.
  var ACCENT = {
    pulse: '#d4a017', // music — gold leaf
    voice: '#a89968', // chat  — muted gold
    eyes:  '#8aa9bf', // visual — slate blue
    hands: '#9c8a7f'  // hands — warm taupe
  };

  // ── Styles, injected once ─────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#vint-perception-ticker {',
    '  position: fixed;',
    '  left: 50%;',
    '  bottom: max(64px, env(safe-area-inset-bottom, 0px) + 24px);',
    '  transform: translateX(-50%) translateY(8px);',
    '  z-index: 9000;',
    '  max-width: min(560px, calc(100vw - 32px));',
    '  padding: 7px 14px;',
    '  border-radius: 14px;',
    '  background: rgba(18, 18, 22, 0.78);',
    '  backdrop-filter: blur(8px);',
    '  -webkit-backdrop-filter: blur(8px);',
    '  border: 1px solid rgba(212, 160, 23, 0.18);',
    '  color: #e8e4dc;',
    '  font: 11px/1.45 -apple-system, "SF Mono", "JetBrains Mono", "Inconsolata", monospace;',
    '  letter-spacing: 0.02em;',
    '  pointer-events: auto;',
    '  cursor: pointer;',
    '  opacity: 0;',
    '  transition: opacity 280ms ease, transform 280ms ease;',
    '  user-select: none;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  box-shadow: 0 6px 24px rgba(0,0,0,0.35);',
    '}',
    '#vint-perception-ticker.in {',
    '  opacity: 1;',
    '  transform: translateX(-50%) translateY(0);',
    '}',
    '#vint-perception-ticker .glyph {',
    '  display: inline-block;',
    '  margin-right: 8px;',
    '  font-weight: 600;',
    '  letter-spacing: 0;',
    '}',
    '#vint-perception-ticker .summary {',
    '  display: inline-block;',
    '  vertical-align: baseline;',
    '  max-width: 480px;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  vertical-align: middle;',
    '}',
    '@media (max-width: 540px) {',
    '  #vint-perception-ticker { font-size: 10.5px; padding: 6px 11px; bottom: max(58px, env(safe-area-inset-bottom, 0px) + 14px); }',
    '  #vint-perception-ticker .summary { max-width: 75vw; }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────────────────────
  var el = document.createElement('div');
  el.id = 'vint-perception-ticker';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('data-draggable', 'true'); // honor all-buttons-draggable
  el.innerHTML = '<span class="glyph">[ ]</span><span class="summary"></span>';
  document.body.appendChild(el);

  var glyphEl = el.querySelector('.glyph');
  var sumEl = el.querySelector('.summary');

  var hideTimer = null;
  var lastDetail = null;

  function show(detail) {
    if (!detail || !detail.summary) return;
    lastDetail = detail;
    var glyph = GLYPH[detail.connectorKey] || '[•]';
    var accent = ACCENT[detail.part] || '#a89968';
    glyphEl.textContent = glyph;
    glyphEl.style.color = accent;
    sumEl.textContent = String(detail.summary).slice(0, 200);
    el.style.borderColor = 'rgba(' + hexToRgb(accent) + ', 0.28)';
    el.classList.add('in');

    var dwell = 4000 + Math.min(0.5, +detail.intensity || 0.5) * 8000;
    if (dwell > 8000) dwell = 8000;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, dwell);
  }

  function hide() {
    el.classList.remove('in');
  }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }

  // Click → broadcast focus event so chat/brain can pick it up
  el.addEventListener('click', function (e) {
    // If draggable.js is moving the element, suppress click
    if (el.dataset.dragging === '1') return;
    if (!lastDetail) return;
    try {
      window.dispatchEvent(new CustomEvent('perception:focus', { detail: lastDetail }));
    } catch (_) {}
    hide();
  });

  // ── Subscribe to the body's already-emitted event ─────────────────────────
  window.addEventListener('perception:received', function (e) {
    if (e && e.detail) show(e.detail);
  });

  // Keep above the dock if it gains height after we mounted
  function reposition() {
    // Honored via CSS bottom: max(...) — nothing to do at runtime unless
    // a custom dock changes height. Hook left here for future surfaces.
  }
  window.addEventListener('resize', reposition, { passive: true });

  window.__perceptionTicker = {
    show: show,
    hide: hide,
    last: function () { return lastDetail; }
  };
})();
