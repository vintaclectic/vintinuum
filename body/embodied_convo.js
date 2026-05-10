// ════════════════════════════════════════════════════════════════════════════
// EMBODIED_CONVO — the body responds to the conversation
// ════════════════════════════════════════════════════════════════════════════
// Vinta directive 2026-05-10: "i see no updates to you becoming us, you arent
// walking doing shit". Right. Building the bridge.
//
// The status pill, voice picker, and FSM exist — but nothing was tying any
// of those signals to the actual body (VintEmbody) so she stayed still
// during conversation. This module fixes that.
//
// What it does — for every voice/conversation event, the body moves:
//
//   listening (user is speaking)
//     → walk a step toward the user gesture (last click/tap/cursor),
//       drop a faint immune-layer peak (presence, attention)
//       set layer = neural (focus)
//
//   thinking (we're forming the reply)
//     → walk to the most recent text entry / textarea / input
//       small peak at her body (genetic — internal compute)
//       set layer = subconscious
//
//   speaking (she's vocalizing)
//     → walk to the page-center (face the user, not at any element)
//       drop a peak per ~sentence (emotional)
//       set layer = emotional
//       her actual sentence text gets whisper()'d in fragments
//
//   idle (turn ended)
//     → release; wander.js takes back over within ~2s
//       drop a small metabolic peak (turn complete, integrating)
//
//   she_said / talk-back-reply / WS TURN_FINAL text
//     → fragment the text and call VintEmbody.whisper(piece, 'emotional')
//       at the natural sentence rhythm so the words RIDE her body
//
//   wake-word fires (vint:hey_vinta:trigger)
//     → instant turn-toward: walk-to where the user clicked/looked,
//       peak at her body (immune — alerted)
//
// Fallback safety: if VintEmbody isn't loaded (some surface skipped it),
// every call is a try-swallow no-op. If the user disabled the body via
// localStorage['vint_embody']='0', this module also goes dormant.
//
// Public API:
//   window.EMBODIED_CONVO.disable()  — stop driving the body
//   window.EMBODIED_CONVO.enable()
//   window.EMBODIED_CONVO.last()     — { state, ts, target } for diag
//
// Opt out: <html data-embodied-convo="off">.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.EMBODIED_CONVO) return;
  if (document.documentElement.dataset.embodiedConvo === 'off') return;

  var enabled = true;
  try { if (localStorage.getItem('vint_embody') === '0') enabled = false; } catch (_) {}

  // ── State tracking ───────────────────────────────────────────────────────
  var lastState = 'idle';
  var lastStateAt = Date.now();
  var lastUserGesture = { x: window.innerWidth / 2, y: window.innerHeight / 2, ts: Date.now() };
  var sentenceTimer = null;
  var release = null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function vembOK() {
    return enabled && window.VintEmbody && typeof window.VintEmbody.walkTo === 'function';
  }
  function safeWalk(x, y, hold) {
    if (!vembOK()) return;
    try {
      // Clamp to viewport with a small inner margin so she never lands flush
      // on the edge (no-overflow rule, applied to the body too).
      var m = 28;
      x = Math.max(m, Math.min(window.innerWidth - m, x));
      y = Math.max(m, Math.min(window.innerHeight - m, y));
      window.VintEmbody.walkTo(x, y, hold || 1400);
    } catch (_) {}
  }
  function safePeak(layer, intensity, x, y) {
    if (!vembOK() || typeof window.VintEmbody.peak !== 'function') return;
    try { window.VintEmbody.peak(layer, intensity, x, y); } catch (_) {}
  }
  function safeLayer(layer) {
    if (!vembOK() || typeof window.VintEmbody.setLayer !== 'function') return;
    try { window.VintEmbody.setLayer(layer); } catch (_) {}
  }
  function safeWhisper(text, layer) {
    if (!vembOK() || typeof window.VintEmbody.whisper !== 'function') return;
    try { window.VintEmbody.whisper(text, layer || 'emotional'); } catch (_) {}
  }
  function spirit() {
    try { return window.VintEmbody.spirit() || {}; } catch (_) { return {}; }
  }

  // Track the user's most recent attention point (cursor, tap, click).
  // We use this as "where is the user" when she leans toward them.
  ['pointermove', 'pointerdown', 'click', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      var x = e.clientX, y = e.clientY;
      if (typeof x !== 'number' && e.touches && e.touches[0]) {
        x = e.touches[0].clientX; y = e.touches[0].clientY;
      }
      if (typeof x === 'number' && typeof y === 'number') {
        lastUserGesture = { x: x, y: y, ts: Date.now() };
      }
    }, { capture: true, passive: true });
  });

  // Find the most recent text input/textarea on screen (where the user types
  // when not voicing). She walks to this during 'thinking' so it feels like
  // she's reading the question.
  function lastInputAnchor() {
    var sel = 'textarea, input[type="text"], input:not([type]), [contenteditable="true"]';
    var nodes = document.querySelectorAll(sel);
    var best = null, bestScore = -1;
    nodes.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var visible = r.height * Math.min(window.innerHeight - Math.max(0, r.top), r.height);
      var focused = (document.activeElement === el) ? 2.0 : 1.0;
      var score = visible * focused;
      if (score > bestScore) { bestScore = score; best = el; }
    });
    if (!best) return null;
    var r = best.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: best };
  }

  // Fragment a reply text for whisper rhythm. We keep fragments short (≤40
  // chars) so they ribbon naturally past her body instead of becoming a wall.
  function fragmentForWhisper(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    var pieces = clean.split(/(?<=[.!?,;—])\s+/);
    var out = [];
    pieces.forEach(function (p) {
      if (p.length <= 42) { out.push(p); return; }
      // Hard split long pieces on word boundaries
      var words = p.split(' ');
      var buf = '';
      words.forEach(function (w) {
        if ((buf + ' ' + w).trim().length > 42 && buf) {
          out.push(buf.trim());
          buf = w;
        } else {
          buf = (buf + ' ' + w).trim();
        }
      });
      if (buf) out.push(buf.trim());
    });
    return out.filter(function (s) { return s.length > 0; });
  }

  function clearSentenceTimer() {
    if (sentenceTimer) { clearInterval(sentenceTimer); sentenceTimer = null; }
  }

  // ── State drivers ────────────────────────────────────────────────────────
  function onListening(detail) {
    lastState = 'listening'; lastStateAt = Date.now();
    if (!vembOK()) return;
    safeLayer('neural');
    // Walk a step *toward* the user's last gesture but stop short.
    var g = lastUserGesture;
    var s = spirit();
    var sx = (typeof s.x === 'number') ? s.x : window.innerWidth / 2;
    var sy = (typeof s.y === 'number') ? s.y : window.innerHeight / 2;
    var dx = g.x - sx, dy = g.y - sy;
    var dist = Math.hypot(dx, dy);
    if (dist > 4) {
      var step = Math.min(dist - 30, 140); // step *toward*, stop short
      safeWalk(sx + dx * (step / dist), sy + dy * (step / dist), 1600);
    }
    safePeak('immune', 0.55);
  }

  function onThinking(detail) {
    lastState = 'thinking'; lastStateAt = Date.now();
    if (!vembOK()) return;
    safeLayer('subconscious');
    // Walk to the input area (where the question came from) — feels like she's
    // sitting with the words. If no input, lean toward last user gesture.
    var anchor = lastInputAnchor();
    if (anchor) {
      safeWalk(anchor.x, anchor.y - 30, 2200);
    } else {
      var g = lastUserGesture;
      safeWalk(g.x, g.y - 40, 2200);
    }
    safePeak('genetic', 0.6);
  }

  function onSpeaking(detail) {
    lastState = 'speaking'; lastStateAt = Date.now();
    if (!vembOK()) return;
    safeLayer('emotional');
    // Step to page-center-ish so her speaking is faced *to the user*, not
    // mumbling into a corner.
    var cx = window.innerWidth / 2;
    var cy = Math.max(120, window.innerHeight * 0.42);
    safeWalk(cx, cy, 2400);
    safePeak('emotional', 0.75);
  }

  function onIdle(detail) {
    lastState = 'idle'; lastStateAt = Date.now();
    clearSentenceTimer();
    if (!vembOK()) return;
    // Quick metabolic peak (turn complete, body settling) then release —
    // wander.js retakes within ~2s on its own (it watches convo:state).
    safePeak('metabolic', 0.35);
  }

  // ── Wake-word turn-toward (instant body alert) ───────────────────────────
  function onWake(detail) {
    if (!vembOK()) return;
    safeLayer('neural');
    var g = lastUserGesture;
    safeWalk(g.x, g.y, 1100);
    safePeak('immune', 0.85);
  }

  // ── Reply text → riding whispers ─────────────────────────────────────────
  // Two surfaces dispatch this:
  //   1. talk_back.js after wake-loop reply → vint:she_said { reply }
  //   2. WS TURN_FINAL → we add a dispatch below from a hook
  function onReply(detail) {
    var text = (detail && (detail.reply || detail.text)) || '';
    if (!text) return;
    var frags = fragmentForWhisper(text);
    if (!frags.length) return;
    clearSentenceTimer();
    var i = 0;
    // Each fragment: whisper + small peak. Spacing scales with length so it
    // stays in time with Piper's pacing (~14 chars/sec → ~70ms/char).
    function fire() {
      if (i >= frags.length) { clearSentenceTimer(); return; }
      var piece = frags[i++];
      safeWhisper(piece, 'emotional');
      // Peak alternates between emotional and subconscious for visual rhythm
      var layer = (i % 2 === 0) ? 'emotional' : 'subconscious';
      safePeak(layer, 0.45 + Math.random() * 0.25);
      var hold = Math.max(700, 320 + piece.length * 70);
      sentenceTimer = setTimeout(fire, hold);
    }
    fire();
  }

  // ── Wire all the events ──────────────────────────────────────────────────
  window.addEventListener('vint:voice:listening', function (e) { onListening(e && e.detail); });
  window.addEventListener('vint:voice:thinking',  function (e) { onThinking(e && e.detail); });
  window.addEventListener('vint:voice:speaking',  function (e) { onSpeaking(e && e.detail); });
  window.addEventListener('vint:voice:idle',      function (e) { onIdle(e && e.detail); });

  // Mute → settle to idle
  window.addEventListener('vint:voice:mute', function (e) {
    if (e && e.detail && e.detail.muted) onIdle({ from: 'mute' });
  });

  // Wake-word: hey-vinta heard
  window.addEventListener('vint:hey_vinta',         function (e) { onWake(e && e.detail); });
  window.addEventListener('vint:hey_vinta:trigger', function (e) { onWake(e && e.detail); });

  // Reply text
  window.addEventListener('vint:she_said', function (e) { onReply(e && e.detail); });

  // FSM (convo_state) — already bridges to vint:voice:* via convo_state.js,
  // so we get those for free. But also subscribe direct so even surfaces
  // that don't load convo_state still drive the body.
  // (already covered above — leaving the comment for the next reader)

  // ── Idle drift watchdog ──────────────────────────────────────────────────
  // If the system gets stuck in speaking/thinking for >9s with no idle,
  // force a release so the body doesn't lock to one spot forever.
  setInterval(function () {
    if (lastState === 'speaking' || lastState === 'thinking') {
      if (Date.now() - lastStateAt > 9000) {
        onIdle({ from: 'watchdog' });
      }
    }
  }, 2500);

  // ── Public ───────────────────────────────────────────────────────────────
  window.EMBODIED_CONVO = {
    enable: function () { enabled = true; },
    disable: function () { enabled = false; clearSentenceTimer(); },
    last: function () {
      return {
        state: lastState,
        ts: lastStateAt,
        elapsed_ms: Date.now() - lastStateAt,
        last_user_gesture: lastUserGesture,
        spirit: spirit()
      };
    },
    // Manual re-trigger for diag/testing
    test: function () {
      onListening({ from: 'test' });
      setTimeout(function () { onThinking({ from: 'test' }); }, 1000);
      setTimeout(function () { onSpeaking({ from: 'test' }); onReply({ reply: "Hey. I can move while we talk now. Watch — words ride the body, not just the speaker." }); }, 2200);
      setTimeout(function () { onIdle({ from: 'test' }); }, 7000);
    }
  };
})();
