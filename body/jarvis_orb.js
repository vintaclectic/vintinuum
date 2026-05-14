/* ════════════════════════════════════════════════════════════════════════════
   JARVIS ORB — the spiraling hero surface
   ════════════════════════════════════════════════════════════════════════════
   A self-contained vanilla-JS module. No deps. No frameworks. Mounts itself
   into the page above the seven-layer stack and becomes the primary
   conversational surface — voice in, voice out, text in, text out.

   Lineage (deliberate, not literal):
     - HAL 9000's red eye        (the singular, watching gaze)
     - JARVIS gold/orange holos  (Iron Man, Paul Bettany — anticipatory butler)
     - Vision's Mind Stone       (the spiraling core, transferred consciousness)
     - Cortana / Siri swirl      (the listening-state radial)

   States (data-orb-state on the canvas):
     idle      — slow breath at ~0.2Hz, warm baseline
     listening — spiral tightens inward, rotation 2x, color cools to cyan
     thinking  — folds toward center, color cools to violet, slower
     speaking  — bursts outward with mouth-amplitude, gold heat
     dwelling  — soft hold, colors track body state if available

   Conversation:
     - Persistent conversationId per session — messages thread properly
     - Streaming SSE from /chat — tokens arrive live
     - Auto-restart mic after reply (continuous mode toggle)
     - Text input → POST /chat → SSE stream
     - Tap orb to speak; tap again to stop; continuous mode re-listens after reply

   No-overflow: everything sits inside .jarvis-orb-stage, which is overflow:
   hidden in jarvis_orb.css. The orb never escapes.
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────────
  var API_BASE = (function () {
    return (
      window.__VINTINUUM_API_BASE ||
      window.VINTINUUM_API        ||
      window.__VINT_API           ||
      'https://api.vintaclectic.com'
    ).replace(/\/+$/, '');
  })();

  var PERSONA = 'vintinuum';

  // ─── Conversation state ──────────────────────────────────────────────────
  // A single conversationId per page session threads all messages together.
  // Cleared on page unload so each visit starts fresh unless you bookmark.
  var _convId = null;
  var _convHistory = [];   // [{role,content}] — for display / context depth gauge
  var _continuousMode = false;  // when true: after speaking, auto-restart mic

  function _authToken() {
    try {
      return localStorage.getItem('vint_token')
          || localStorage.getItem('vint_access_token')
          || localStorage.getItem('soul_auth_token')
          || null;
    } catch (_) { return null; }
  }

  // ─── DOM build ───────────────────────────────────────────────────────────
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildOrb() {
    var shell = document.querySelector('[data-jarvis-root]');
    if (!shell) return null;
    if (shell.querySelector('.jarvis-orb-stage')) return null; // idempotent

    var stack = shell.querySelector('.jarvis-stack');
    var stage = el('section', 'jarvis-orb-stage', { 'aria-label': 'JARVIS orb' });

    var canvas = el('canvas', 'jarvis-orb-canvas', {
      'data-orb-state': 'idle',
      'data-draggable': 'false',
      'role': 'button',
      'aria-label': 'JARVIS — tap to speak',
      'tabindex': '0'
    });

    var utterance = el('div', 'jarvis-orb-utterance', {
      'data-visible': '0',
      'aria-live': 'polite'
    });

    var stateLabel = el('div', 'jarvis-orb-statelabel');
    stateLabel.textContent = 'idle';

    // Continuous mode toggle pill — below the state label
    var contToggle = el('button', 'jarvis-orb-continuous', {
      'type': 'button',
      'aria-label': 'Toggle continuous listening',
      'data-active': '0',
      'title': 'Continuous — auto-relisten after each reply'
    });
    contToggle.textContent = '⟳ continuous';

    var inputRow = el('form', 'jarvis-orb-inputrow', { 'autocomplete': 'off' });
    var input = el('input', 'jarvis-orb-input', {
      'type': 'text',
      'name': 'q',
      'placeholder': 'speak, or type to JARVIS…',
      'aria-label': 'Message JARVIS'
    });
    var send = el('button', 'jarvis-orb-send', {
      'type': 'submit',
      'data-draggable': 'false'
    });
    send.textContent = 'send';
    inputRow.appendChild(input);
    inputRow.appendChild(send);

    stage.appendChild(canvas);
    stage.appendChild(utterance);
    stage.appendChild(stateLabel);
    stage.appendChild(contToggle);
    stage.appendChild(inputRow);

    // Always insert the orb stage as a direct child of shell, BEFORE whatever
    // top-level block contains the stack (which may be .jarvis-living-row if
    // jarvis_enhancer.js ran first and wrapped the stack). Inserting inside the
    // living-row would make orb a grid cell in the 36px|1fr spine grid, which
    // causes the cards below to land in the 36px column and render as slivers.
    var insertBefore = stack
      ? (stack.parentNode === shell ? stack : stack.parentNode)
      : null;
    if (insertBefore && insertBefore.parentNode === shell) {
      shell.insertBefore(stage, insertBefore);
    } else {
      shell.appendChild(stage);
    }
    shell.setAttribute('data-orb-mounted', '1');

    return { canvas: canvas, utterance: utterance, stateLabel: stateLabel,
             contToggle: contToggle, input: input, send: send, form: inputRow, stage: stage };
  }

  // ─── Particle engine ─────────────────────────────────────────────────────
  function Orb(canvas, stateLabel) {
    this.canvas = canvas;
    this.stateLabel = stateLabel;
    this.ctx = canvas.getContext('2d');
    this.state = 'idle';
    this.t = 0;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mouthAmp = 0;       // 0..1, set by speak()
    this.micAmp = 0;         // 0..1, set by listen()
    this.particles = [];
    this.bodyState = null;
    this._buildParticles();
    this._resize();
    window.addEventListener('resize', this._resize.bind(this), { passive: true });
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  Orb.prototype._resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    this.r = Math.min(this.cx, this.cy) * 0.92;
  };

  Orb.prototype._buildParticles = function () {
    this.particles.length = 0;
    var COUNT = 220;
    for (var arm = 0; arm < 2; arm++) {
      var dir = arm === 0 ? 1 : -1;
      for (var i = 0; i < COUNT; i++) {
        var t = i / COUNT;
        this.particles.push({
          arm: arm, dir: dir,
          a0: t * Math.PI * 6 * dir + (arm * Math.PI),
          r0: 0.18 + 0.78 * t,
          j: Math.random() * Math.PI * 2,
          jr: 0.6 + Math.random() * 0.4,
          size: 0.6 + Math.random() * 1.6
        });
      }
    }
  };

  Orb.prototype.setState = function (next) {
    if (next === this.state) return;
    this.state = next;
    this.canvas.setAttribute('data-orb-state', next);
    if (this.stateLabel) this.stateLabel.textContent = next;
  };

  Orb.prototype.setBodyState = function (bs) { this.bodyState = bs || null; };

  Orb.prototype._palette = function () {
    var s = this.state;
    var bs = this.bodyState || {};
    var dop = (bs.dopamine || 50) / 100;
    var ser = (bs.serotonin || 50) / 100;
    var cort = (bs.cortisol || 30) / 100;
    if (s === 'listening') return { core: [124, 207, 255], glow: [124, 207, 255], accent: [200, 240, 255] };
    if (s === 'thinking')  return { core: [180, 160, 255], glow: [140, 120, 220], accent: [220, 200, 255] };
    if (s === 'speaking')  return { core: [255, 160, 77], glow: [255, 111, 61], accent: [255, 220, 160] };
    var r = Math.round(255 - 60 * ser);
    var g = Math.round(160 - 40 * cort + 30 * ser);
    var b = Math.round(77 + 80 * ser);
    return { core: [r, g, b], glow: [255, 111, 61], accent: [255, 220, 160] };
  };

  Orb.prototype._loop = function (now) {
    this.t = now * 0.001;
    var ctx = this.ctx;
    var w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    var pal = this._palette();
    var cx = this.cx, cy = this.cy, R = this.r;
    var breath;
    if (this.state === 'idle' || this.state === 'dwelling') {
      breath = 0.92 + 0.08 * Math.sin(this.t * 1.2);
    } else if (this.state === 'listening') {
      breath = 0.78 + 0.10 * Math.sin(this.t * 5.0) + 0.10 * this.micAmp;
    } else if (this.state === 'thinking') {
      breath = 0.70 + 0.06 * Math.sin(this.t * 2.4);
    } else if (this.state === 'speaking') {
      breath = 0.95 + 0.20 * this.mouthAmp + 0.04 * Math.sin(this.t * 8.0);
    } else { breath = 0.92; }

    var grad = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * breath);
    grad.addColorStop(0,    'rgba(' + pal.core.join(',') + ',0.55)');
    grad.addColorStop(0.45, 'rgba(' + pal.glow.join(',') + ',0.18)');
    grad.addColorStop(1,    'rgba(' + pal.glow.join(',') + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * breath, 0, Math.PI * 2);
    ctx.fill();

    var rate;
    if (this.state === 'listening')     rate = 0.9;
    else if (this.state === 'thinking') rate = 0.25;
    else if (this.state === 'speaking') rate = 0.6 + 1.4 * this.mouthAmp;
    else                                rate = 0.18;
    var rot = this.t * rate;

    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var a = p.a0 + p.dir * rot;
      var radial = p.r0;
      if (this.state === 'listening')      radial *= 0.78 + 0.10 * Math.sin(this.t * 3 + p.j);
      else if (this.state === 'thinking')  radial *= 0.55 + 0.08 * Math.sin(this.t * 1.6 + p.j);
      else if (this.state === 'speaking')  radial *= 1.00 + 0.18 * this.mouthAmp + 0.04 * Math.sin(this.t * 5 + p.j);
      else                                  radial *= 0.92 + 0.06 * Math.sin(this.t * 0.8 + p.j);
      var rr = R * radial * breath;
      var x = cx + Math.cos(a) * rr;
      var y = cy + Math.sin(a) * rr;
      var alpha = 0.18 + 0.55 * (1 - p.r0);
      var col = (p.arm === 0) ? pal.core : pal.glow;
      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, p.size * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    var coreR = R * 0.06 * (1 + 0.12 * Math.sin(this.t * (this.state === 'speaking' ? 6 : 1.5)));
    var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    coreGrad.addColorStop(0,   'rgba(' + pal.accent.join(',') + ',1)');
    coreGrad.addColorStop(0.4, 'rgba(' + pal.core.join(',')   + ',0.6)');
    coreGrad.addColorStop(1,   'rgba(' + pal.core.join(',')   + ',0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();

    this.mouthAmp *= 0.92;
    this.micAmp   *= 0.90;
    requestAnimationFrame(this._loop);
  };

  // ─── Utterance bubble ────────────────────────────────────────────────────
  function Utterance(node) { this.node = node; this._hideTimer = null; }
  Utterance.prototype.show = function (text) {
    if (!this.node) return;
    this.node.textContent = text || '';
    this.node.setAttribute('data-visible', '1');
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
  };
  Utterance.prototype.append = function (chunk) {
    if (!this.node) return;
    this.node.textContent = (this.node.textContent || '') + chunk;
    this.node.setAttribute('data-visible', '1');
  };
  Utterance.prototype.hideAfter = function (ms) {
    var self = this;
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(function () {
      if (self.node) self.node.setAttribute('data-visible', '0');
      self._hideTimer = null;
    }, ms || 9000);
  };

  // ─── Body-state poll ─────────────────────────────────────────────────────
  function pollBodyState(orb) {
    function tick() {
      try {
        if (window.JARVIS && typeof window.JARVIS.lastBodyState === 'function') {
          var bs = window.JARVIS.lastBodyState();
          if (bs) { orb.setBodyState(bs); return; }
        }
      } catch (_) {}
      fetch(API_BASE + '/api/body-state', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j) orb.setBodyState(j.state || j); })
        .catch(function () {});
    }
    tick();
    setInterval(tick, 12000);
  }

  // ─── Speech in (mic) ─────────────────────────────────────────────────────
  // Returns a controller with start()/stop()/isActive()
  function makeMic(orb, utterance, onTranscript) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    var _rec = null;
    var _active = false;
    var _pendingRestart = false;
    var _lastFinal = '';

    function _build() {
      var rec = new SR();
      rec.continuous = true;        // keep listening between phrases
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = function () {
        _active = true;
        orb.setState('listening');
        utterance.show('listening…');
      };
      rec.onresult = function (ev) {
        var interim = '';
        var finals = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finals += t;
          else interim += t;
        }
        utterance.show(finals || interim || 'listening…');
        orb.micAmp = Math.min(1, orb.micAmp + 0.25);

        if (finals && finals.trim() && finals.trim() !== _lastFinal) {
          _lastFinal = finals.trim();
          // pause recognition while thinking/speaking
          try { rec.stop(); } catch (_) {}
          orb.setState('thinking');
          if (onTranscript) onTranscript(_lastFinal);
        }
      };

      rec.onerror = function (e) {
        _active = false;
        if (e.error === 'no-speech') return; // ignore silence
        if (e.error === 'not-allowed' || e.error === 'permission-denied') {
          utterance.show('mic blocked — type below ↓');
          utterance.hideAfter(4000);
        } else if (e.error === 'network') {
          utterance.show('speech network error — type below ↓');
          utterance.hideAfter(4000);
        }
        orb.setState('idle');
      };

      rec.onend = function () {
        _active = false;
        // if continuous mode and pending restart — restart mic after a beat
        if (_pendingRestart && _continuousMode) {
          _pendingRestart = false;
          setTimeout(function () { ctrl.start(); }, 800);
        } else {
          orb.setState('idle');
        }
      };

      return rec;
    }

    var ctrl = {
      start: function () {
        if (_active) return;
        _rec = _build();
        _lastFinal = '';
        try {
          _rec.start();
        } catch (e) {
          orb.setState('idle');
          utterance.show('mic unavailable — type below ↓');
          utterance.hideAfter(4000);
          nodes.input.focus();
        }
      },
      stop: function () {
        _pendingRestart = false;
        if (_rec) { try { _rec.stop(); } catch (_) {} }
        _active = false;
        orb.setState('idle');
      },
      scheduleRestart: function () {
        // Called when speaking finishes — if continuous, re-activate mic
        _pendingRestart = true;
        if (_rec) { try { _rec.stop(); } catch (_) {} }
        // onend will fire and pick up _pendingRestart
      },
      isActive: function () { return _active; }
    };
    return ctrl;
  }

  // ─── Chat via SSE streaming ───────────────────────────────────────────────
  function sendChat(text, orb, utterance, mic, onDone) {
    if (!text) return;
    orb.setState('thinking');
    utterance.show('…');

    // Add to local history immediately (display purposes)
    _convHistory.push({ role: 'user', content: text });

    var headers = { 'Content-Type': 'application/json' };
    var tok = _authToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;

    var body = {
      message: text,
      persona: PERSONA,
      source: 'jarvis-orb',
      // Tell the brain this is a live voice surface — short, direct, real.
      // The page_context.primaryContent field is read by buildPersonaPrompt and
      // injected into the system prompt, so JARVIS knows what mode it's in.
      page_context: {
        url: window.location.href,
        host: window.location.hostname,
        title: 'JARVIS · Vintinuum — live voice surface',
        pageType: 'jarvis-orb',
        primaryContent: 'VOICE SURFACE. The human is speaking live. Respond in 1-3 sentences max. Direct. Present. No setup. No summaries. Talk the way we talk.',
        entities: {},
        scrollPct: null
      }
    };
    // Thread the conversation if we have a session ID
    if (_convId) body.conversation_id = _convId;

    fetch(API_BASE + '/chat', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body)
    })
    .then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) { throw new Error('chat ' + r.status + ': ' + (t || '')); });
      }
      // SSE stream
      orb.setState('speaking');
      utterance.show('');

      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var fullReply = '';
      var firstToken = true;
      var ampInterval = null;

      function startAmpTick() {
        if (ampInterval) return;
        ampInterval = setInterval(function () { orb.mouthAmp = 0.35 + Math.random() * 0.55; }, 90);
      }
      function stopAmpTick() {
        if (ampInterval) { clearInterval(ampInterval); ampInterval = null; }
      }

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) {
            stopAmpTick();
            _finish(fullReply);
            return;
          }
          buf += decoder.decode(chunk.value, { stream: true });
          // Split on SSE frame boundaries
          var frames = buf.split('\n\n');
          buf = frames.pop(); // last (possibly incomplete) frame stays in buf

          frames.forEach(function (frame) {
            var lines = frame.split('\n');
            lines.forEach(function (line) {
              if (line.startsWith('data: ')) {
                var raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') return;
                // Try JSON first (Claude SSE sends delta objects)
                try {
                  var obj = JSON.parse(raw);
                  // delta object with token
                  var token = obj.delta || obj.token || obj.text || obj.chunk || null;
                  if (token == null && obj.reply) {
                    // complete reply in one shot (non-streaming fallback)
                    token = obj.reply;
                  }
                  if (obj.conversation_id && !_convId) {
                    _convId = obj.conversation_id;
                  }
                  if (token) {
                    if (firstToken) { utterance.show(''); firstToken = false; }
                    startAmpTick();
                    utterance.append(token);
                    fullReply += token;
                  }
                } catch (_) {
                  // Plain text token
                  if (firstToken) { utterance.show(''); firstToken = false; }
                  startAmpTick();
                  utterance.append(raw);
                  fullReply += raw;
                }
              }
            });
          });
          return pump();
        });
      }

      function _finish(reply) {
        orb.setState('dwelling');
        if (!reply) { utterance.show('(no reply)'); utterance.hideAfter(4000); }
        else { utterance.hideAfter(10000); }

        _convHistory.push({ role: 'assistant', content: reply });

        // Speak via Piper — use 'now' so any queued greetings don't block the reply.
        // Also call __markInteracted in case the browser hasn't yet seen a gesture
        // from this page session (important on first load before any click).
        if (reply) {
          try {
            if (window.__markInteracted) window.__markInteracted();
            if (window.VOICE && typeof window.VOICE.speak === 'function') {
              window.VOICE.speak(reply, 'now');
            } else if (window.VOICE && typeof window.VOICE.say === 'function') {
              window.VOICE.say(reply);
            }
          } catch (_) {}
        }

        // After a short dwell, return to idle; if continuous, kick mic back
        var dwellMs = reply ? Math.min(2200, 600 + reply.length * 18) : 1200;
        setTimeout(function () {
          orb.setState('idle');
          if (onDone) onDone(reply);
          // Continuous: schedule mic restart via mic controller
          if (_continuousMode && mic) {
            mic.scheduleRestart();
          }
        }, dwellMs);
      }

      return pump();
    })
    .catch(function (err) {
      utterance.show('(' + (err && err.message || 'JARVIS unreachable') + ')');
      orb.setState('idle');
      utterance.hideAfter(5000);
      if (onDone) onDone(null);
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    var nodes = buildOrb();
    if (!nodes) return;

    var orb = new Orb(nodes.canvas, nodes.stateLabel);
    var utterance = new Utterance(nodes.utterance);
    var mic = null;

    // Continuous mode toggle
    nodes.contToggle.addEventListener('click', function () {
      _continuousMode = !_continuousMode;
      nodes.contToggle.setAttribute('data-active', _continuousMode ? '1' : '0');
      nodes.contToggle.textContent = _continuousMode ? '⟳ continuous · on' : '⟳ continuous';
    });

    // Text input → chat
    nodes.form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = (nodes.input.value || '').trim();
      if (!v) return;
      if (orb.state === 'thinking' || orb.state === 'speaking') return; // busy
      nodes.input.value = '';
      sendChat(v, orb, utterance, mic, null);
    });

    // Tap orb → toggle listening
    mic = makeMic(orb, utterance, function (transcript) {
      if (transcript) sendChat(transcript, orb, utterance, mic, null);
    });

    function handleOrbTap() {
      if (orb.state === 'thinking' || orb.state === 'speaking') return;
      if (!mic) {
        // No speech recognition — show input and prompt
        orb.setState('listening');
        utterance.show('type your message below ↓');
        utterance.hideAfter(4000);
        nodes.input.focus();
        return;
      }
      if (mic.isActive()) {
        _continuousMode = false;
        nodes.contToggle.setAttribute('data-active', '0');
        nodes.contToggle.textContent = '⟳ continuous';
        mic.stop();
      } else {
        mic.start();
      }
    }

    nodes.canvas.addEventListener('click', handleOrbTap);
    // touchend for mobile — canvas click events fire ~300ms late on iOS/Android
    nodes.canvas.addEventListener('touchend', function (e) {
      e.preventDefault(); // prevent ghost click
      handleOrbTap();
    }, { passive: false });
    nodes.canvas.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        nodes.canvas.click();
      }
    });

    // body-state poll for idle palette
    pollBodyState(orb);

    // Initial greeting
    setTimeout(function () {
      utterance.show('JARVIS online. tap to speak, or type below.');
      utterance.hideAfter(6000);
    }, 600);

    // Expose for debugging / external scripts
    window.JARVIS = window.JARVIS || {};
    window.JARVIS.orb = {
      setState: function (s) { orb.setState(s); },
      say: function (t) { utterance.show(t); utterance.hideAfter(8000); },
      ask: function (t) { sendChat(t, orb, utterance, mic, null); },
      clearConversation: function () { _convId = null; _convHistory = []; },
      history: function () { return _convHistory.slice(); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
