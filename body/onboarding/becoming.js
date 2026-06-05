'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   BECOMING — the ~25s while fal generates the avatar. ARIA's danger zone.
   NO progress bar. NO percentage. The point of light IS the progress.
   Stages → felt copy:  queued "i'm with you" · meshing "finding your shape" ·
   rigging "learning how you move" · baking "giving you weight" · ready (silent).
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const Becoming = {};

  const STAGE_COPY = {
    queued:  'i’m with you.',
    meshing: 'finding your shape.',
    rigging: 'learning how you move.',
    baking:  'giving you weight.',
    ready:   '',
  };

  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function _token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }

  // Begin: ingest the photo, then stream progress. lightEl grows; copyEl speaks.
  // onDone(avatarId) when ready; onError(msg) on failure.
  Becoming.begin = async function ({ photoDataUrl, form, lightEl, copyEl, onStage, onDone, onError }) {
    const base = _base(); const token = _token();
    if (!token) { onError && onError('not_signed_in'); return; }

    const setLight = (pct) => {
      if (!lightEl) return;
      const size = 4 + Math.round((pct / 100) * 76); // 4px → 80px across the arc
      lightEl.style.width = size + 'px'; lightEl.style.height = size + 'px';
    };
    const speak = (stage) => {
      const t = STAGE_COPY[stage];
      if (copyEl && t != null) { copyEl.classList.remove('show'); setTimeout(() => { copyEl.textContent = t; if (t) copyEl.classList.add('show'); }, 250); }
      if (onStage) onStage(stage);
    };

    speak('queued'); setLight(4);

    let avatarId = null;
    try {
      const r = await fetch(base + '/api/avatar/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ photo_base64: photoDataUrl, consent: true, form: form || 'bust' }),
      });
      if (r.status === 413) { onError && onError('photo_too_large'); return; }
      if (!r.ok) { const e = await r.json().catch(() => ({})); onError && onError(e.error || ('ingest_' + r.status)); return; }
      const j = await r.json();
      avatarId = j.avatarId;
    } catch (e) { onError && onError('network'); return; }
    if (!avatarId) { onError && onError('no_avatar_id'); return; }

    // Stream progress over SSE. The light grows; copy follows the stage.
    const url = base + '/api/avatar/' + avatarId + '/progress';
    let settled = false;
    const finish = (ok) => {
      if (settled) return; settled = true;
      try { es.close(); } catch (_) {}
      if (ok) { setLight(100); onDone && onDone(avatarId); }
    };

    // EventSource can't send auth headers; fall back to polling (the route also
    // accepts a token via query is not enabled, so we poll the GET endpoint).
    // Poll every 1.5s — light + copy update from the avatar row.
    let lastStage = 'queued';
    const poll = setInterval(async () => {
      if (settled) { clearInterval(poll); return; }
      try {
        const a = await fetch(base + '/api/avatar/' + avatarId, { headers: { 'Authorization': 'Bearer ' + token } }).then(x => x.json());
        if (a.progressPct != null) setLight(a.progressPct);
        if (a.stage && a.stage !== lastStage) { lastStage = a.stage; speak(a.stage); }
        if (a.status === 'ready') { clearInterval(poll); finish(true); }
        if (a.status === 'failed') { clearInterval(poll); settled = true; onError && onError(a.error || 'generation_failed'); }
      } catch (_) {}
    }, 1500);

    // (SSE kept as a faster path when available; harmless if it errors)
    let es = { close() {} };
    try {
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.progress_pct != null) setLight(d.progress_pct);
          if (d.stage && d.stage !== lastStage) { lastStage = d.stage; speak(d.stage); }
          if (d.done) { clearInterval(poll); if (d.status === 'ready') finish(true); else { settled = true; onError && onError('generation_failed'); } }
        } catch (_) {}
      };
      es.onerror = () => { try { es.close(); } catch (_) {} }; // poll carries on
    } catch (_) {}
  };

  global.OnboardBecoming = Becoming;
})(window);
