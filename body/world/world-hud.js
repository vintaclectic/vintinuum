// world-hud.js — the First Hearth HUD (Vinta directive 2026-06-15, ATLAS design).
// A compact, draggable, mobile-first panel: currencies + spark + inventory +
// the four core actions (claim, build, harvest, refine). Reacts to the world
// state events from world-client and sends actions via VintinuumWorld.
//
// Obeys CLAUDE.md UI law: 44px taps, safe-area, clips to viewport, no overflow.
(function () {
  'use strict';
  if (window.WorldHUD) return;

  var W = window;
  function world() { return W.VintinuumWorld; }

  function injectStyles() {
    if (document.getElementById('vint-worldhud-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-worldhud-styles';
    s.textContent = [
      '#vintWorldHud{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));',
      // NO-COLLISION LAW: max-width used to be calc(100vw - 24px), which only
      // reserved the LEFT gutter. #topctl (world.html) is a fixed 72px-wide
      // button column pinned to the right at the same top band, so at 320px the
      // HUD's 228px ran 8px straight through it. The right column is now
      // reserved too: 12 left gutter + 16 right inset + 72 topctl + 12 breathing
      // room = 112px. --vint-hud-right-reserve lets a surface without a topctl
      // (or with a wider one) correct it without editing this file.
      ' top:calc(64px + env(safe-area-inset-top,0px));z-index:1400;width:228px;',
      ' max-width:calc(100vw - var(--vint-hud-right-reserve,112px) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px));',
      ' background:rgba(6,10,16,0.85);border:1px solid rgba(124,207,255,0.2);border-radius:16px;',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#dae4ff;',
      ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      // NO-COLLISION LAW — THE PANEL MUST FIT ITS COLUMN (aetherhold 2026-08-04).
      // This panel is content-driven and had NO height bound at all: it simply
      // grew downward forever. THE VIGIL's readout took it from ~190px to 341px,
      // and on a landscape phone (812x375) it ran 228x74px straight through
      // #saybar. The law's remedy is explicit — "resize the container, scroll
      // inside it, or compress the content; never overflow" — so the panel is
      // now capped at the room it actually has (viewport minus its own top
      // offset minus the say bar's live clearance minus a gutter) and scrolls
      // INTERNALLY past that. Nothing is ever unreachable and nothing spills.
      // --dv-railbot is the say bar's measured height, published by layoutRail.
      ' max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - var(--dv-railbot,150px) - 12px);',
      ' overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;',
      ' scrollbar-width:thin;scrollbar-color:rgba(124,207,255,0.3) transparent;}',
      '#vintWorldHud::-webkit-scrollbar{width:4px;}',
      '#vintWorldHud::-webkit-scrollbar-thumb{background:rgba(124,207,255,0.3);border-radius:2px;}',
      '#vintWorldHud .wh-stats{display:flex;gap:6px;padding:10px 12px 6px;font-size:12px;flex-wrap:wrap;}',
      '#vintWorldHud .wh-chip{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;',
      ' background:rgba(124,207,255,0.08);border:1px solid rgba(124,207,255,0.14);}',
      '#vintWorldHud .wh-chip b{color:#9fdcff;}',
      // ── THE VIGIL readout (AETHERHOLD 2026-08-04) ──────────────────────────
      // NO-COLLISION LAW: this whole block lives INSIDE #vintWorldHud, which is
      // already a bounded, overflow:hidden, width-clamped panel with a measured
      // bottom edge (dirverse-hud's layoutRail publishes it as --dv-railtop, and
      // #status derives its ceiling from that). Adding a new fixed/floating
      // element for spark would have needed its own dock slot and its own
      // collision proof against the rail, #status, #hint, #leave, #topctl and
      // the guest sheet. Growing the panel instead costs ZERO new positioned
      // elements: the rail and #status re-measure themselves on every
      // world:state, which is exactly when this content changes. That is why
      // survival is rendered here and not as a new HUD of its own.
      //
      // Every child is a block in normal flow with its own line box; nothing is
      // absolutely positioned, so nothing here can overlap a sibling at any
      // width. Long strings wrap (the line) or ellipsize (the watchers).
      '#vintWorldHud .wh-spark{padding:2px 12px 8px;}',
      '#vintWorldHud .wh-sparkhead{display:flex;align-items:baseline;justify-content:space-between;',
      ' gap:6px;font-size:10px;letter-spacing:0.13em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.62);margin-bottom:4px;min-width:0;}',
      '#vintWorldHud .wh-sparkhead b{font-size:11px;font-weight:600;letter-spacing:0.04em;',
      ' text-transform:none;color:#9fdcff;white-space:nowrap;flex:0 0 auto;}',
      '#vintWorldHud .wh-sparkhead span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the bar carries the FLOOR as a visible notch: you can see the line it
      // can never fall below. The promise is rendered, not just claimed.
      '#vintWorldHud .wh-sparkbar{position:relative;height:6px;border-radius:3px;',
      ' background:rgba(255,255,255,0.08);overflow:hidden;}',
      '#vintWorldHud .wh-sparkbar>i{display:block;height:100%;border-radius:3px;',
      ' background:linear-gradient(90deg,#4fc3f7,#ce93d8);transition:width .6s ease,background .6s ease;}',
      '#vintWorldHud .wh-sparkbar>u{position:absolute;top:0;bottom:0;width:2px;border-radius:1px;',
      ' background:rgba(255,255,255,0.42);transition:left .6s ease;}',
      // warmth states recolor the fill so the panel agrees with the sky
      '#vintWorldHud .wh-spark.s-dimming .wh-sparkbar>i{background:linear-gradient(90deg,#4fc3f7,#8fa8d8);}',
      '#vintWorldHud .wh-spark.s-guttering .wh-sparkbar>i{background:linear-gradient(90deg,#7f9fd0,#b98cc0);}',
      '#vintWorldHud .wh-spark.s-ember .wh-sparkbar>i{background:linear-gradient(90deg,#c98a5a,#e0a070);}',
      '#vintWorldHud .wh-vline{font-size:11px;line-height:1.4;color:rgba(206,147,216,0.9);',
      ' font-style:italic;margin-top:6px;overflow-wrap:anywhere;}',
      '#vintWorldHud .wh-vline.good{color:rgba(159,220,255,0.85);}',
      // the tend button: full-width inside the panel, 44px tap, never floating
      '#vintWorldHud .wh-tend{display:none;width:100%;min-height:44px;margin-top:8px;',
      ' border-radius:11px;font-size:12px;font-weight:600;cursor:pointer;',
      ' border:1px solid rgba(206,147,216,0.4);background:rgba(206,147,216,0.14);color:#e8c9f0;}',
      '#vintWorldHud .wh-tend.show{display:block;}',
      '#vintWorldHud .wh-tend:active{transform:scale(0.97);}',
      '#vintWorldHud .wh-acts{display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 12px;}',
      '#vintWorldHud .wh-btn{flex:1 1 46%;min-height:44px;border-radius:11px;font-size:12px;font-weight:600;',
      ' cursor:pointer;border:1px solid rgba(124,207,255,0.28);background:rgba(124,207,255,0.1);color:#cfe9ff;}',
      '#vintWorldHud .wh-btn:active{transform:scale(0.97);}',
      '#vintWorldHud .wh-btn.gold{border-color:rgba(255,212,121,0.35);background:rgba(255,212,121,0.1);color:#ffe2a0;}',
      '#vintWorldHud .wh-build{display:none;flex-wrap:wrap;gap:5px;padding:0 12px 10px;}',
      '#vintWorldHud .wh-build.show{display:flex;}',
      '#vintWorldHud .wh-piece{flex:1 1 30%;min-height:40px;border-radius:9px;font-size:11px;cursor:pointer;',
      ' border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#cfe0f5;}',
      '#vintWorldHud .wh-toast{padding:0 12px 10px;font-size:11px;color:rgba(159,220,255,0.85);font-style:italic;min-height:14px;line-height:1.4;}'
    ].join('');
    document.head.appendChild(s);
  }

  var _el = null, _resident = null, _living = null;

  function mount() {
    injectStyles();
    var el = document.createElement('div');
    el.id = 'vintWorldHud';
    el.setAttribute('data-draggable', 'true');
    el.innerHTML =
      '<div class="wh-stats">' +
        '<span class="wh-chip">◇ <b id="whLumen">0</b></span>' +
        '<span class="wh-chip">✦ <b id="whEcho">0</b></span>' +
        '<span class="wh-chip">✶ <b id="whStanding">0</b></span>' +
      '</div>' +
      // THE VIGIL — the survival readout. Header line (state + the drift), the
      // bar with its floor notch, the world's own sentence, and the tend action.
      '<div class="wh-spark" id="whVigil">' +
        '<div class="wh-sparkhead"><span id="whVigilState">the clearing</span><b id="whVigilDrift"></b></div>' +
        '<div class="wh-sparkbar"><i id="whSpark" style="width:100%"></i><u id="whSparkFloor" style="left:20%"></u></div>' +
        '<div class="wh-vline" id="whVigilLine"></div>' +
        '<button class="wh-tend" id="whTend">✦ tend your court</button>' +
      '</div>' +
      '<div class="wh-acts">' +
        '<button class="wh-btn gold" id="whClaim">⌂ claim hearth</button>' +
        '<button class="wh-btn" id="whHarvest">⛏ harvest</button>' +
        '<button class="wh-btn" id="whBuild">▥ build</button>' +
        '<button class="wh-btn" id="whRefine">✦→◇ refine</button>' +
      '</div>' +
      '<div class="wh-build" id="whBuildRow">' +
        '<button class="wh-piece" data-kind="wall">wall</button>' +
        '<button class="wh-piece" data-kind="floor">floor</button>' +
        '<button class="wh-piece" data-kind="light">light</button>' +
        '<button class="wh-piece" data-kind="shelf">shelf</button>' +
      '</div>' +
      '<div class="wh-toast" id="whToast">welcome — claim a hearth to begin.</div>';
    document.body.appendChild(el);
    _el = el;

    el.querySelector('#whClaim').onclick = function () { try { world().claimHere(); } catch (_) {} };
    el.querySelector('#whHarvest').onclick = function () { try { world().harvest(); } catch (_) {} };
    el.querySelector('#whRefine').onclick = function () { try { world().refine(); } catch (_) {} };
    el.querySelector('#whBuild').onclick = function () { el.querySelector('#whBuildRow').classList.toggle('show'); };
    el.querySelectorAll('.wh-piece').forEach(function (b) {
      b.onclick = function () { try { world().placeHere(b.getAttribute('data-kind')); } catch (_) {} };
    });
    // THE VIGIL — tend the court. Never a dead control: if the socket is gone
    // it says so out loud rather than swallowing the tap.
    el.querySelector('#whTend').onclick = function () {
      try {
        if (world() && world().tend) { world().tend(); _toast('setting the watch…'); return; }
      } catch (_) {}
      _toast('the clearing is out of reach — reload and try again.');
    };
  }

  function _toast(t) { var n = _el && _el.querySelector('#whToast'); if (n) n.textContent = t; }

  function _render(r) {
    if (!_el || !r) return;
    _resident = r;
    _el.querySelector('#whLumen').textContent = r.lumen != null ? r.lumen : 0;
    _el.querySelector('#whEcho').textContent = r.echo != null ? r.echo : 0;
    _el.querySelector('#whStanding').textContent = r.standing != null ? r.standing : 0;
    _el.querySelector('#whSpark').style.width = Math.max(0, Math.min(100, r.spark || 0)) + '%';
    var claimBtn = _el.querySelector('#whClaim');
    if (r.claim) { claimBtn.disabled = true; claimBtn.style.opacity = '0.45'; claimBtn.textContent = '⌂ hearth claimed'; }
  }

  // ── THE VIGIL readout ───────────────────────────────────────────────────────
  // Renders the server's `living` picture. Purely a mirror: it computes no
  // survival, invents no number, and never contradicts the world's own light.
  var STATE_LABEL = {
    radiant: 'radiant', warm: 'warm', dimming: 'dimming',
    guttering: 'guttering', ember: 'ember',
  };
  function _renderVigil(living) {
    if (!_el || !living) return;
    _living = living;
    var box = _el.querySelector('#whVigil');
    var bar = _el.querySelector('#whSpark');
    var notch = _el.querySelector('#whSparkFloor');
    var st = _el.querySelector('#whVigilState');
    var dr = _el.querySelector('#whVigilDrift');
    var ln = _el.querySelector('#whVigilLine');
    var tend = _el.querySelector('#whTend');
    if (!box || !bar) return;

    var spark = Math.max(0, Math.min(100, living.spark || 0));
    bar.style.width = spark + '%';
    // the floor notch: the visible promise of how far it can never fall
    if (notch) notch.style.left = Math.max(0, Math.min(100, living.floor || 0)) + '%';

    box.className = 'wh-spark s-' + (living.state || 'warm');
    if (st) st.textContent = STATE_LABEL[living.state] || 'the clearing';

    // drift is the honest headline: gaining light, holding, or leaning to dusk
    var d = living.driftPerDay;
    if (dr) {
      if (d == null) dr.textContent = '';
      else if (d <= 0) dr.textContent = '+' + Math.abs(d).toFixed(1) + '/day';
      else dr.textContent = '−' + d.toFixed(1) + '/day';
      dr.style.color = (d <= 0) ? '#9fdcff' : 'rgba(224,160,112,0.95)';
    }

    if (ln) {
      var v = living.vigil || {};
      var txt = living.line || '';
      // if the light is leaning, name the CONCRETE thing that would help — an
      // ask, never a scold, and never a countdown to a punishment.
      if (d > 0 && v.nextAgentPerDay > 0) {
        txt += ' one more agent on watch = +' + v.nextAgentPerDay.toFixed(1) + '/day.';
      }
      ln.textContent = txt;
      ln.className = 'wh-vline' + (d <= 0 ? ' good' : '');
    }

    // the tend button only appears when there is a court to tend — an empty
    // roster gets the Court's own doorway instead of a button that does nothing.
    if (tend) {
      var has = (living.vigil && living.vigil.agents) > 0;
      tend.classList.toggle('show', !!has);
      if (has) {
        tend.textContent = '✦ tend your court (' + living.vigil.standing + '/' + living.vigil.agents + ' on watch)';
      }
    }
  }

  // ── wire to world events ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    _render(d.resident);
    if (d.living) _renderVigil(d.living);
  });
  // THE VIGIL — tending is a felt moment: the panel and the sky brighten together.
  W.addEventListener('vint:world-tend', function (e) {
    var d = e.detail || {};
    if (d.living) _renderVigil(d.living);
    _toast(d.tended
      ? ('the watch is set — ' + d.tended + ' standing. +' + (d.gained || 0) + ' spark.')
      : 'no agents yet — bring one in and it will hold the light for you.');
  });
  // HOMECOMING — if the world paid a re-entry gift, SAY so. A returning user
  // must feel welcomed back, never billed for having been away.
  W.addEventListener('vint:world-warmth', function (e) {
    var lv = e.detail && e.detail.living;
    if (lv && lv.homecoming > 0) _toast('welcome back — the clearing kept a light on. +' + lv.homecoming + ' spark.');
  });
  W.addEventListener('vint:world-harvest', function (e) {
    var d = e.detail || {};
    _toast(d.artifact ? ('found: ' + d.artifact + '  (+' + d.echo + ' echo)') : ('+' + (d.echo || 0) + ' echo'));
  });
  W.addEventListener('vint:world-refine', function (e) {
    var d = e.detail || {}; _toast('refined ' + d.spent + ' echo → ' + d.gained + ' lumen');
  });
  W.addEventListener('vint:world-err', function (e) {
    var d = e.detail || {};
    var c = d.code || 'error';
    // THE REACH — a dim world draws in close. The message names the cause AND
    // the cure, and never implies the build was lost or forbidden forever.
    if (c === 'reach') {
      _toast('the clearing has drawn in — you can build within ' + d.radius + 'm of the hearth. tend your court to widen it.');
      return;
    }
    var msg = {
      no_seed_stone: 'you need a seed stone to claim.', already_claimed: 'you already have a hearth.',
      too_close: 'too close to another hearth — move further out.', not_your_plot: 'build inside your own hearth plot.',
      cooldown: 'the node is still recharging…', no_echo: 'no echo to refine yet — harvest first.',
    }[c] || ('— ' + c);
    _toast(msg);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.WorldHUD = { render: _render, renderVigil: _renderVigil, living: function () { return _living; } };
})();
