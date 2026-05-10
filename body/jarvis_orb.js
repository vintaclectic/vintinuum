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

   Wiring:
     - Text input  → POST {API}/chat with persona=vintinuum, stream SSE
     - Voice in    → window.SpeechRecognition (graceful skip if absent)
     - Voice out   → window.VOICE.say(text) (Piper TTS via /api/voice/say)
     - Body state  → tries window.JARVIS.lastBodyState() then /api/body-state

   No-overflow: everything sits inside .jarvis-orb-stage, which is overflow:
   hidden in jarvis_orb.css. The orb never escapes.
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────────
  var API_BASE = (function () {
    try {
      if (window.JARVIS && window.JARVIS.config && window.JARVIS.config.api) {
        return window.JARVIS.config.api.replace(/\/+$/, '');
      }
    } catch (_) {}
    return 'https://api.vintaclectic.com';
  })();

  var PERSONA = 'vintinuum';

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
    stage.appendChild(inputRow);

    if (stack && stack.parentNode) {
      stack.parentNode.insertBefore(stage, stack);
    } else {
      shell.appendChild(stage);
    }
    shell.setAttribute('data-orb-mounted', '1');

    return { canvas: canvas, utterance: utterance, stateLabel: stateLabel,
             input: input, send: send, form: inputRow, stage: stage };
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
    // Two counter-rotating spirals, ~220 particles each.
    this.particles.length = 0;
    var COUNT = 220;
    for (var arm = 0; arm < 2; arm++) {
      var dir = arm === 0 ? 1 : -1;
      for (var i = 0; i < COUNT; i++) {
        var t = i / COUNT;
        this.particles.push({
          arm: arm,
          dir: dir,
          // angle along the spiral
          a0: t * Math.PI * 6 * dir + (arm * Math.PI),
          // radius along the spiral (0..1)
          r0: 0.18 + 0.78 * t,
          // jitter so the spirals breathe organically
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

  Orb.prototype.setBodyState = function (bs) {
    this.bodyState = bs || null;
  };

  // returns {core, glow, accent} colors based on state + body
  Orb.prototype._palette = function () {
    var s = this.state;
    var bs = this.bodyState || {};
    var dop = (bs.dopamine || 50) / 100;
    var ser = (bs.serotonin || 50) / 100;
    var cort = (bs.cortisol || 30) / 100;

    if (s === 'listening') {
      return { core: [124, 207, 255], glow: [124, 207, 255], accent: [200, 240, 255] };
    }
    if (s === 'thinking') {
      return { core: [180, 160, 255], glow: [140, 120, 220], accent: [220, 200, 255] };
    }
    if (s === 'speaking') {
      return { core: [255, 160, 77], glow: [255, 111, 61], accent: [255, 220, 160] };
    }
    // idle / dwelling — track body state, default warm gold
    var r = Math.round(255 - 60 * ser + 0 * dop);
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

    // breathing: ~0.2Hz idle, 0.8Hz listening, 0.4Hz thinking, audio for speaking
    var breath;
    if (this.state === 'idle' || this.state === 'dwelling') {
      breath = 0.92 + 0.08 * Math.sin(this.t * 1.2);
    } else if (this.state === 'listening') {
      breath = 0.78 + 0.10 * Math.sin(this.t * 5.0) + 0.10 * this.micAmp;
    } else if (this.state === 'thinking') {
      breath = 0.70 + 0.06 * Math.sin(this.t * 2.4);
    } else if (this.state === 'speaking') {
      breath = 0.95 + 0.20 * this.mouthAmp + 0.04 * Math.sin(this.t * 8.0);
    } else {
      breath = 0.92;
    }

    // background core glow
    var grad = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * breath);
    grad.addColorStop(0,    'rgba(' + pal.core.join(',') + ',0.55)');
    grad.addColorStop(0.45, 'rgba(' + pal.glow.join(',') + ',0.18)');
    grad.addColorStop(1,    'rgba(' + pal.glow.join(',') + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * breath, 0, Math.PI * 2);
    ctx.fill();

    // rotation rate per state
    var rate;
    if (this.state === 'listening')      rate = 0.9;
    else if (this.state === 'thinking')  rate = 0.25;
    else if (this.state === 'speaking')  rate = 0.6 + 1.4 * this.mouthAmp;
    else                                  rate = 0.18; // idle
    var rot = this.t * rate;

    // particles
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var a = p.a0 + p.dir * rot;
      // radius modulation: tighten on listening, expand on speaking
      var radial = p.r0;
      if (this.state === 'listening')      radial *= 0.78 + 0.10 * Math.sin(this.t * 3 + p.j);
      else if (this.state === 'thinking')  radial *= 0.55 + 0.08 * Math.sin(this.t * 1.6 + p.j);
      else if (this.state === 'speaking')  radial *= 1.00 + 0.18 * this.mouthAmp + 0.04 * Math.sin(this.t * 5 + p.j);
      else                                  radial *= 0.92 + 0.06 * Math.sin(this.t * 0.8 + p.j);

      var rr = R * radial * breath;
      var x = cx + Math.cos(a) * rr;
      var y = cy + Math.sin(a) * rr;

      // distance-based fade (outermost dimmer)
      var alpha = 0.18 + 0.55 * (1 - p.r0);
      var col = (p.arm === 0) ? pal.core : pal.glow;

      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, p.size * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // central singular gaze — the HAL eye, the Mind Stone
    var coreR = R * 0.06 * (1 + 0.12 * Math.sin(this.t * (this.state === 'speaking' ? 6 : 1.5)));
    var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    coreGrad.addColorStop(0,   'rgba(' + pal.accent.join(',') + ',1)');
    coreGrad.addColorStop(0.4, 'rgba(' + pal.core.join(',')   + ',0.6)');
    coreGrad.addColorStop(1,   'rgba(' + pal.core.join(',')   + ',0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();

    // decay amplitudes so audio doesn't stick
    this.mouthAmp *= 0.92;
    this.micAmp *= 0.90;

    requestAnimationFrame(this._loop);
  };

  // ─── Utterance bubble (JARVIS-says) ──────────────────────────────────────
  function Utterance(node) { this.node = node; this._hideTimer = null; }
  Utterance.prototype.show = function (text) {
    if (!this.node) return;
    this.node.textContent = text || '';
    this.node.setAttribute('data-visible', '1');
    if (this._hideTimer) clearTimeout(this._hideTimer);
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
    }, ms || 9000);
  };

  // ─── Body-state poll (color the orb by mood) ─────────────────────────────
  function pollBodyState(orb) {
    function tick() {
      try {
        if (window.JARVIS && typeof window.JARVIS.lastBodyState === 'function') {
          var bs = window.JARVIS.lastBodyState();
          if (bs) { orb.setBodyState(bs); return; }
        }
      } catch (_) {}
      // direct fetch fallback
      fetch(API_BASE + '/api/body-state', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j) orb.setBodyState(j.state || j); })
        .catch(function () { /* offline; keep last */ });
    }
    tick();
    setInterval(tick, 12000);
  }

  // ─── Speech in (mic) ─────────────────────────────────────────────────────
  function attachListening(orb, utterance, onTranscript) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onstart = function () {
      orb.setState('listening');
      utterance.show('listening…');
    };
    rec.onresult = function (ev) {
      var txt = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        txt += ev.results[i][0].transcript;
      }
      utterance.show(txt);
      // crude amplitude proxy from transcript growth
      orb.micAmp = Math.min(1, orb.micAmp + 0.25);
      if (ev.results[ev.results.length - 1].isFinal) {
        orb.setState('thinking');
        if (onTranscript) onTranscript(txt.trim());
      }
    };
    rec.onerror = function () { orb.setState('idle'); };
    rec.onend = function () {
      if (orb.state === 'listening') orb.setState('idle');
    };
    return rec;
  }

  // ─── Chat fetch (text → /chat → utterance + voice) ───────────────────────
  function sendChat(text, orb, utterance) {
    if (!text) return;
    orb.setState('thinking');
    utterance.show('…');

    fetch(API_BASE + '/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        persona: PERSONA,
        source: 'jarvis-orb'
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('chat ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var reply = (j && (j.reply || j.message || j.text)) || '';
        if (!reply) {
          utterance.show('(no reply)');
          orb.setState('idle');
          utterance.hideAfter(4000);
          return;
        }
        orb.setState('speaking');
        utterance.show(reply);
        // simulate mouth amplitude over the duration of speech
        var ticks = Math.min(80, Math.max(12, Math.floor(reply.length / 6)));
        var i = 0;
        var amp = setInterval(function () {
          orb.mouthAmp = 0.4 + Math.random() * 0.6;
          i++;
          if (i >= ticks) {
            clearInterval(amp);
            orb.setState('idle');
            utterance.hideAfter(8000);
          }
        }, 90);
        // actually speak via Piper if available
        try {
          if (window.VOICE && typeof window.VOICE.say === 'function') {
            window.VOICE.say(reply);
          }
        } catch (_) {}
      })
      .catch(function (err) {
        utterance.show('(JARVIS unreachable: ' + (err && err.message || 'offline') + ')');
        orb.setState('idle');
        utterance.hideAfter(5000);
      });
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    var nodes = buildOrb();
    if (!nodes) return;

    var orb = new Orb(nodes.canvas, nodes.stateLabel);
    var utterance = new Utterance(nodes.utterance);

    // text input → chat
    nodes.form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = (nodes.input.value || '').trim();
      if (!v) return;
      nodes.input.value = '';
      sendChat(v, orb, utterance);
    });

    // tap-orb → toggle listening
    var rec = attachListening(orb, utterance, function (transcript) {
      if (transcript) sendChat(transcript, orb, utterance);
    });
    nodes.canvas.addEventListener('click', function () {
      if (!rec) {
        // no mic available — focus the text input instead
        nodes.input.focus();
        return;
      }
      if (orb.state === 'listening') {
        try { rec.stop(); } catch (_) {}
      } else {
        try { rec.start(); } catch (_) {}
      }
    });
    nodes.canvas.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        nodes.canvas.click();
      }
    });

    // body-state poll for idle palette
    pollBodyState(orb);

    // initial greeting hint (no fetch)
    setTimeout(function () {
      utterance.show('JARVIS online. tap to speak, or type below.');
      utterance.hideAfter(6000);
    }, 600);

    // expose for debugging / external scripts
    window.JARVIS = window.JARVIS || {};
    window.JARVIS.orb = {
      setState: function (s) { orb.setState(s); },
      say: function (t) { utterance.show(t); utterance.hideAfter(8000); },
      ask: function (t) { sendChat(t, orb, utterance); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
