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
      ' top:calc(64px + env(safe-area-inset-top,0px));z-index:1400;width:228px;max-width:calc(100vw - 24px);',
      ' background:rgba(6,10,16,0.85);border:1px solid rgba(124,207,255,0.2);border-radius:16px;',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#dae4ff;',
      ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;}',
      '#vintWorldHud .wh-stats{display:flex;gap:6px;padding:10px 12px 6px;font-size:12px;flex-wrap:wrap;}',
      '#vintWorldHud .wh-chip{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;',
      ' background:rgba(124,207,255,0.08);border:1px solid rgba(124,207,255,0.14);}',
      '#vintWorldHud .wh-chip b{color:#9fdcff;}',
      '#vintWorldHud .wh-spark{padding:2px 12px 8px;}',
      '#vintWorldHud .wh-sparkbar{height:5px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;}',
      '#vintWorldHud .wh-sparkbar>i{display:block;height:100%;background:linear-gradient(90deg,#4fc3f7,#ce93d8);transition:width .3s;}',
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

  var _el = null, _resident = null;

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
      '<div class="wh-spark"><div class="wh-sparkbar"><i id="whSpark" style="width:100%"></i></div></div>' +
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

  // ── wire to world events ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) { _render(e.detail && e.detail.resident); });
  W.addEventListener('vint:world-harvest', function (e) {
    var d = e.detail || {};
    _toast(d.artifact ? ('found: ' + d.artifact + '  (+' + d.echo + ' echo)') : ('+' + (d.echo || 0) + ' echo'));
  });
  W.addEventListener('vint:world-refine', function (e) {
    var d = e.detail || {}; _toast('refined ' + d.spent + ' echo → ' + d.gained + ' lumen');
  });
  W.addEventListener('vint:world-err', function (e) {
    var c = (e.detail && e.detail.code) || 'error';
    var msg = {
      no_seed_stone: 'you need a seed stone to claim.', already_claimed: 'you already have a hearth.',
      too_close: 'too close to another hearth — move further out.', not_your_plot: 'build inside your own hearth plot.',
      cooldown: 'the node is still recharging…', no_echo: 'no echo to refine yet — harvest first.',
    }[c] || ('— ' + c);
    _toast(msg);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.WorldHUD = { render: _render };
})();
