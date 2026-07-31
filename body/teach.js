// ═══════════════════════════════════════════════════════════════════════════
// TEACH — rate + rewrite ANY reply she gives, on every surface.
//
// Vinta directive 2026-07-31: "let users rate/modify any AI response so local
// + all models learn." This is the hand on the shoulder — the user says "no,
// say it like THIS," and she carries the correction forward forever.
//
// The loop it closes (Universal Ingestion Law):
//   reply → user rates/rewrites → POST /api/local-brain/feedback
//        → local_brain_feedback (DB) + training_data/local-brain/feedback.jsonl
//        → fewShotBlock() steers the NEXT local reply (immediate)
//        → normalize/dpo.js builds preference pairs (chosen/rejected)
//        → corpus/build-corpus.js folds it into corpus_latest.jsonl (nightly)
//   The correction lands in the next sentence, not the next quarter.
//
// ── USAGE — two ways, both one line ────────────────────────────────────────
//   1. Explicit (preferred — you know the prompt that produced the reply):
//        TEACH.attach(replyEl, { prompt: userText, model, persona, surface });
//      Call it AFTER the reply finishes streaming; text is read at click time,
//      so a still-streaming element is fine.
//   2. Automatic (zero-wiring for existing surfaces):
//        TEACH.observe(containerEl, { replySelector, promptSelector, ... });
//      Watches for added reply nodes and attaches the bar itself, pairing each
//      reply with the nearest preceding user message for the prompt.
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
// The bar is an INLINE BLOCK inside the reply's own box — never absolute,
// never fixed, never floating. It occupies its own row and pushes nothing.
// The editor expands in flow (the container grows / scrolls internally). At
// no width does anything overlap: everything here is normal-flow layout.
//
// ── CONSENT ────────────────────────────────────────────────────────────────
// The ACT of rating is consent for THAT datum (the user deliberately pressed
// it — Atlas transparency). Whether it compounds the trainable corpus is
// gated server-side by the 'data_union' preference, same as mark-moment.
// We surface that plainly in the UI: the user always knows what they gave.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.TEACH) return;

  var API = function () {
    return window.__VINTINUUM_API_BASE || window.VINTINUUM_API || window.__VINT_API || '';
  };

  // Reply text is the element's text MINUS the teach bar itself (and any
  // persona name label), so we never train her on her own UI chrome.
  function replyTextOf(el) {
    if (!el) return '';
    if (el._teachTextEl) return (el._teachTextEl.textContent || '').trim();
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.teach-bar, .teach-editor, .ai-name, .vint-witness-badge')
      .forEach(function (n) { n.remove(); });
    return (clone.textContent || '').trim();
  }

  function token() {
    try {
      return localStorage.getItem('vint_access_token') ||
             localStorage.getItem('access_token') ||
             (window.IDENTITY && IDENTITY.token && IDENTITY.token()) || '';
    } catch (_) { return ''; }
  }

  // ── The one network call. Fire-and-forget; never blocks the conversation. ──
  function send(payload) {
    var headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' };
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    return fetch(API() + '/api/local-brain/feedback', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); });
  }

  // ── Styles — scoped, injected once, all normal-flow ───────────────────────
  var STYLE_ID = 'teach-styles';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.teach-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;',
      '  margin:8px 0 0;padding:0;background:none;border:none;',
      '  opacity:0;transition:opacity .18s ease;position:static;}',
      '.teach-bar.teach-show,.teach-bar:focus-within{opacity:1;}',
      '@media (hover:none){.teach-bar{opacity:.75;}}',
      '.teach-btn{appearance:none;-webkit-appearance:none;cursor:pointer;',
      '  font:inherit;font-size:12px;line-height:1;padding:6px 9px;min-height:32px;',
      '  border-radius:8px;border:1px solid rgba(240,230,211,.18);',
      '  background:rgba(240,230,211,.05);color:rgba(240,230,211,.72);',
      '  transition:background .15s,border-color .15s,color .15s;}',
      '.teach-btn:hover{background:rgba(245,166,35,.12);border-color:rgba(245,166,35,.4);',
      '  color:#f0e6d3;}',
      '.teach-btn:focus-visible{outline:2px solid rgba(245,166,35,.7);outline-offset:2px;}',
      '.teach-btn.teach-on{background:rgba(245,166,35,.2);border-color:rgba(245,166,35,.6);',
      '  color:#F5A623;}',
      '.teach-btn.teach-on.teach-down{background:rgba(200,80,80,.18);',
      '  border-color:rgba(200,80,80,.55);color:#e08a8a;}',
      '.teach-note{font-size:11px;line-height:1.35;color:rgba(240,230,211,.45);',
      '  flex:1 1 100%;margin:2px 0 0;min-width:0;overflow-wrap:anywhere;}',
      '.teach-editor{display:block;margin:8px 0 0;padding:0;position:static;}',
      '.teach-editor textarea{display:block;box-sizing:border-box;width:100%;max-width:100%;',
      '  min-height:76px;max-height:40vh;overflow:auto;resize:vertical;',
      '  font:inherit;font-size:13px;line-height:1.5;padding:10px 12px;',
      '  border-radius:10px;border:1px solid rgba(245,166,35,.35);',
      '  background:rgba(10,10,12,.55);color:#f0e6d3;}',
      '.teach-editor textarea:focus{outline:none;border-color:rgba(245,166,35,.7);}',
      '.teach-editor .teach-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}',
      '.teach-editor .teach-why{flex:1 1 160px;min-width:0;box-sizing:border-box;',
      '  font:inherit;font-size:12px;padding:8px 10px;min-height:32px;border-radius:8px;',
      '  border:1px solid rgba(240,230,211,.18);background:rgba(10,10,12,.4);',
      '  color:rgba(240,230,211,.85);}',
      '.teach-btn.teach-save{background:rgba(245,166,35,.22);',
      '  border-color:rgba(245,166,35,.55);color:#F5A623;}',
      '@media (max-width:420px){.teach-editor .teach-why{flex:1 1 100%;}}',
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Attach the bar to one reply element ───────────────────────────────────
  function attach(el, opts) {
    if (!el || el.nodeType !== 1) return null;
    if (el._teachBar) return el._teachBar;      // idempotent — never double-attach
    opts = opts || {};
    ensureStyles();

    var state = { rating: 0, sent: false };

    var bar = document.createElement('div');
    bar.className = 'teach-bar';
    // Not draggable: this is inline content bound to its reply, not a floating
    // control (draggable.js opt-out — moving it would break the pairing).
    bar.setAttribute('data-draggable', 'false');

    var note = document.createElement('p');
    note.className = 'teach-note';

    function setNote(msg) { note.textContent = msg || ''; }

    function basePayload() {
      var p = (typeof opts.prompt === 'function' ? opts.prompt() : opts.prompt) || '';
      return {
        prompt: String(p || ''),
        original_reply: replyTextOf(el),
        model: (typeof opts.model === 'function' ? opts.model() : opts.model) || 'unknown',
        persona: (typeof opts.persona === 'function' ? opts.persona() : opts.persona) || 'vintinuum',
        source: opts.surface ? ('ui:' + opts.surface) : 'ui_feedback',
        metadata: Object.assign({ surface: opts.surface || 'unknown', url: location.pathname }, opts.metadata || {}),
      };
    }

    function rate(value, btn, otherBtn) {
      var next = state.rating === value ? 0 : value;   // click again to undo
      state.rating = next;
      [btn, otherBtn].forEach(function (b) { if (b) b.classList.remove('teach-on', 'teach-down'); });
      if (next !== 0) {
        btn.classList.add('teach-on');
        if (next < 0) btn.classList.add('teach-down');
      }
      if (next === 0) { setNote('rating cleared.'); return; }
      var payload = basePayload();
      payload.rating = next;
      setNote(next > 0 ? 'saved — more like that.' : 'saved — less like that. rewrite it to teach her the better line.');
      send(payload).then(function (r) {
        if (!r || r.ok === false) setNote('held locally — she\'ll learn it when the signal returns.');
        else if (next < 0 && !state.sent) setNote('noted. rewrite it and she learns the words themselves.');
      }).catch(function () {
        setNote('held locally — she\'ll learn it when the signal returns.');
      });
    }

    var up = document.createElement('button');
    up.type = 'button'; up.className = 'teach-btn'; up.textContent = '▲ good';
    up.setAttribute('aria-label', 'This reply was good');

    var down = document.createElement('button');
    down.type = 'button'; down.className = 'teach-btn'; down.textContent = '▼ off';
    down.setAttribute('aria-label', 'This reply missed');

    up.addEventListener('click', function () { rate(1, up, down); });
    down.addEventListener('click', function () { rate(-1, down, up); });

    var edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'teach-btn'; edit.textContent = '✎ say it better';
    edit.setAttribute('aria-label', 'Rewrite this reply to teach her');

    var editor = null;
    edit.addEventListener('click', function () {
      if (editor) {                       // toggle closed
        editor.remove(); editor = null;
        edit.classList.remove('teach-on');
        return;
      }
      edit.classList.add('teach-on');
      editor = document.createElement('div');
      editor.className = 'teach-editor';

      var ta = document.createElement('textarea');
      ta.value = replyTextOf(el);
      ta.setAttribute('aria-label', 'Rewrite her reply');
      ta.placeholder = 'Say it the way she should have said it…';

      var row = document.createElement('div');
      row.className = 'teach-row';

      var why = document.createElement('input');
      why.type = 'text'; why.className = 'teach-why'; why.maxLength = 240;
      why.placeholder = 'why? (optional — "too formal", "wrong fact")';
      why.setAttribute('aria-label', 'Why was this better');

      var save = document.createElement('button');
      save.type = 'button'; save.className = 'teach-btn teach-save'; save.textContent = 'teach her';

      var cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'teach-btn'; cancel.textContent = 'cancel';

      cancel.addEventListener('click', function () {
        editor.remove(); editor = null; edit.classList.remove('teach-on');
      });

      save.addEventListener('click', function () {
        var edited = (ta.value || '').trim();
        if (!edited) { setNote('write the better version first.'); ta.focus(); return; }
        if (edited === replyTextOf(el)) { setNote('that\'s the same words — change something so she can learn.'); ta.focus(); return; }
        save.disabled = true; save.textContent = 'teaching…';
        var payload = basePayload();
        payload.edited_reply = edited;
        payload.reason = (why.value || '').trim();
        // A rewrite is an implicit "the original was wrong" unless they said good.
        payload.rating = state.rating || -1;
        send(payload).then(function (r) {
          state.sent = true;
          if (editor) { editor.remove(); editor = null; }
          edit.classList.remove('teach-on');
          edit.textContent = '✎ taught';
          if (r && r.ok === false) {
            setNote('held locally — she\'ll learn it when the signal returns.');
          } else {
            // Morrison open loop: the correction has somewhere to go.
            setNote('she has it. that\'s how she\'ll say it next time.');
          }
        }).catch(function () {
          save.disabled = false; save.textContent = 'teach her';
          setNote('couldn\'t reach her just now — try again in a moment.');
        });
      });

      row.appendChild(why); row.appendChild(save); row.appendChild(cancel);
      editor.appendChild(ta); editor.appendChild(row);
      bar.parentNode.insertBefore(editor, bar.nextSibling);
      ta.focus();
      // Keep the newly-opened editor in view without any fixed positioning.
      try { editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
    });

    bar.appendChild(up); bar.appendChild(down); bar.appendChild(edit); bar.appendChild(note);

    // Reveal on hover/focus so the bar never competes with her words, but is
    // always one gesture away. Touch devices get it at .75 opacity always.
    el.addEventListener('mouseenter', function () { bar.classList.add('teach-show'); });
    el.addEventListener('mouseleave', function () { if (!editor) bar.classList.remove('teach-show'); });

    (opts.mount || el).appendChild(bar);
    el._teachBar = bar;
    return bar;
  }

  // ── Automatic attachment for surfaces we don't want to hand-wire ──────────
  // Watches a container; when a reply node appears, pairs it with the nearest
  // preceding user node and attaches the bar.
  function observe(container, opts) {
    if (!container) return null;
    opts = opts || {};
    var replySel  = opts.replySelector  || '[data-role="assistant"]';
    var promptSel = opts.promptSelector || '[data-role="user"]';

    function priorPrompt(el) {
      var n = el.previousElementSibling;
      while (n) {
        if (n.matches && n.matches(promptSel)) return (n.textContent || '').trim();
        n = n.previousElementSibling;
      }
      return '';
    }

    function consider(node) {
      if (!node || node.nodeType !== 1) return;
      var els = node.matches && node.matches(replySel) ? [node]
              : (node.querySelectorAll ? Array.prototype.slice.call(node.querySelectorAll(replySel)) : []);
      els.forEach(function (el) {
        if (el._teachBar) return;
        attach(el, Object.assign({}, opts, { prompt: function () { return priorPrompt(el); } }));
      });
    }

    Array.prototype.slice.call(container.querySelectorAll(replySel)).forEach(consider);

    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.slice.call(m.addedNodes).forEach(consider);
      });
    });
    mo.observe(container, { childList: true, subtree: true });
    return mo;
  }

  window.TEACH = { attach: attach, observe: observe, send: send, replyTextOf: replyTextOf };
})();
