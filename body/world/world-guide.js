// ════════════════════════════════════════════════════════════════════════════
// THE GUIDE — "what is this?" for every control in the world (task 9TYJB74)
// AETHERHOLD, 2026-09-26.
//
// Vinta: "nobody can tell what each button does." The answer is not tooltips
// (hover does not exist on a phone) — it is one always-reachable sheet that
// names every control that is ON SCREEN RIGHT NOW and says what it does.
//
// HONEST BY CONSTRUCTION: the list is built from the live DOM each time the
// sheet opens. A control that is hidden (guest mode, not your world, desktop-
// only) is not listed as if you could tap it. Dock entries read their words
// from DirverseHUD.launchMeta(), the same registry that labels the buttons, so
// the help text and the button can never drift apart.
//
// NO-COLLISION: zero fixed geometry of its own. The launcher is PINNED in the
// dock (#dvPin, outside the scroller, so it can never scroll away); the sheet is
// a .dv-sheet registered with the one-open-at-a-time owner, so it sits on the
// dock, evicts any other sheet, and closes on Escape / scrim / re-tap.
// Keyboard: "?" opens it on desktop.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;
  var _sheet = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hud() { return W.DirverseHUD || null; }
  function shown(el) {
    if (!el) return false;
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  var coarse = function () { try { return W.matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };

  // The fixed controls world.html / welcome-gate.js / world-hud.js put on screen.
  // Text is written from what each control's handler actually does (see
  // world.html's inline script); `sel` is checked live, so absent = unlisted.
  var FIXED = [
    { sel: '#leave',       g: '↩', l: 'leave',        d: 'Leave the world and go back to the brain page.' },
    { sel: '#editHeadBtn', g: '◐', l: 'edit head',    d: 'Open the Being Forge: shape how your face and colours sit on your body.' },
    { sel: '#btnView',     g: '👁', l: 'view',         d: 'Cycle the camera: behind you, through your eyes, selfie.' },
    { sel: '#btnMic',      g: '🎤', l: 'hold to talk', d: 'Hold to speak out loud to whoever is near you. Right-click or long-press switches whisper / normal / shout.' },
    { sel: '#btnRun',      g: '»', l: 'run',          d: 'Hold to run.' },
    { sel: '#btnJump',     g: '⤒', l: 'jump',         d: 'Tap to jump.' },
    { sel: '#sayBtn',      g: '✎', l: 'say',          d: 'Type into the clearing. Everyone nearby, people and agents, hears it.' },
    { sel: '#vwg-dot',     g: '✦', l: 'account',      d: 'Your account, and installing Vintinuum as an app.' },
    { sel: '#vwg-pill',    g: '✦', l: 'Begin',        d: 'Sign in or create your account so you can join the living world.' },
    { sel: '#inviteCta',   g: '→', l: 'claim your world', d: 'Create an account and get a clearing of your own.' }
  ];
  var PANEL = [
    { sel: '#whLumen',    g: '◇', l: 'lumen',        d: 'The world’s working currency. Your agents’ ventures are staked in it, and vessels cost it.' },
    { sel: '#whEcho',     g: '✦', l: 'echo',         d: 'Knowledge gathered by harvesting. Refine turns it into lumen.' },
    { sel: '#whStanding', g: '✶', l: 'standing',     d: 'Earned from deeds and never goes down. It widens what you can build, how far you can reach, and how many can keep watch.' },
    { sel: '#whClaim',    g: '⌂', l: 'claim hearth', d: 'Set your seed stone down here and claim a small hearth plot of your own.' },
    { sel: '#whHarvest',  g: '⛏', l: 'harvest',      d: 'Strike a knowledge node for echo (and sometimes an artifact). It has a cooldown.' },
    { sel: '#whBuild',    g: '▥', l: 'build',        d: 'Show the quick pieces (wall, floor, light, shelf). Each one costs strand and goes on your own plot.' },
    { sel: '#whRefine',   g: '✦→◇', l: 'refine',     d: 'Turn echo into lumen at the refinery. A dimmer clearing gives a worse rate.' }
  ];

  function row(g, l, d, openId) {
    return '<div class="wg-row">' +
      '<div class="wg-g" aria-hidden="true">' + esc(g) + '</div>' +
      '<div class="wg-t"><div class="wg-l">' + esc(l) + '</div><div class="wg-d">' + esc(d) + '</div></div>' +
      (openId ? '<button class="wg-open" type="button" data-open="' + esc(openId) + '">open</button>' : '') +
    '</div>';
  }

  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('.dv-body');
    var h = hud();
    var html = '';

    // 1) THE DOCK — what is in it right now, in the order it is shown
    var dock = document.querySelectorAll('#dvRail .dv-launch');
    var dockRows = '', hidden = [];
    for (var i = 0; i < dock.length; i++) {
      var b = dock[i];
      var m = (h && h.launchMeta && h.launchMeta(b.id)) || {};
      var lbl = m.l || (b.querySelector('.lbl') || {}).textContent || b.id;
      var gl = m.g || (b.querySelector('.gl') || {}).textContent || '';
      if (b.id === 'wvGuideBtn') continue;           // you are in it
      if (!shown(b)) { hidden.push(lbl); continue; }
      dockRows += row(gl, lbl, m.d || '', b.id);
    }
    html += '<div class="wg-sec"><div class="wg-h">The dock <small>along the bottom. Swipe it sideways if there is more.</small></div>' +
      (dockRows || '<div class="dv-empty">nothing in the dock yet.</div>') +
      (hidden.length ? '<div class="wg-note">Not available here: ' + esc(hidden.join(', ')) + '. (For example, build only appears in a world you are allowed to build in.)</div>' : '') +
      '<div class="wg-note">A lit dock button is the panel that is open. Tap it again, tap the dimmed world, or press Esc to close it. Tapping a different button swaps panels.</div>' +
      '</div>';

    // 2) GETTING AROUND — the fixed controls actually on screen
    var fx = '';
    FIXED.forEach(function (f) { if (shown(document.querySelector(f.sel))) fx += row(f.g, f.l, f.d); });
    if (!coarse()) fx += row('⌨', 'keyboard', 'W A S D move · Q / E or drag to turn · Shift run · Space jump · V view · hold T to talk · R voice range · ? this guide');
    html += '<div class="wg-sec"><div class="wg-h">Getting around</div>' + (fx || '<div class="dv-empty">no controls on screen.</div>') + '</div>';

    // 3) YOUR PANEL — the top-left panel (signed-in only)
    var px = '';
    PANEL.forEach(function (p) { if (shown(document.querySelector(p.sel))) px += row(p.g, p.l, p.d); });
    if (px) html += '<div class="wg-sec"><div class="wg-h">Your panel <small>top left</small></div>' + px + '</div>';

    body.innerHTML = html;
    body.querySelectorAll('.wg-open').forEach(function (btn) {
      btn.onclick = function () {
        var t = document.getElementById(btn.getAttribute('data-open'));
        close();
        if (t) setTimeout(function () { t.click(); }, 0);
      };
    });
  }

  function injectStyles() {
    if (document.getElementById('wg-styles')) return;
    var s = document.createElement('style');
    s.id = 'wg-styles';
    s.textContent = [
      '#wgSheet .wg-sec{margin:4px 0 16px;}',
      '#wgSheet .wg-h{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,226,160,0.85);margin:0 0 8px;}',
      '#wgSheet .wg-h small{display:block;text-transform:none;letter-spacing:.02em;font-size:12.5px;color:rgba(206,224,255,0.55);margin-top:2px;}',
      '#wgSheet .wg-row{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid rgba(255,255,255,0.06);}',
      '#wgSheet .wg-g{flex:0 0 40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;',
      ' font-size:17px;background:rgba(124,207,255,0.08);border:1px solid rgba(124,207,255,0.18);color:#dce7ff;overflow:hidden;}',
      '#wgSheet .wg-t{flex:1 1 auto;min-width:0;}',
      '#wgSheet .wg-l{font-size:16px;color:#eaf3ff;}',
      '#wgSheet .wg-d{font-size:13.5px;line-height:1.35;color:rgba(206,224,255,0.7);overflow-wrap:anywhere;}',
      '#wgSheet .wg-open{flex:0 0 auto;min-height:40px;min-width:56px;padding:0 12px;border-radius:11px;cursor:pointer;',
      ' font-family:inherit;font-size:13.5px;color:#cfe8ff;background:rgba(124,207,255,0.1);border:1px solid rgba(124,207,255,0.3);}',
      '#wgSheet .wg-note{font-size:13px;line-height:1.4;color:rgba(206,224,255,0.55);font-style:italic;margin-top:8px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'wgSheet';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'what is this — the guide');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">what is this?<small>every control on your screen, and what it does</small></div>' +
        '<button class="dv-x" id="wgX" type="button" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body"></div>';
    document.body.appendChild(el);
    el.querySelector('#wgX').onclick = close;
    _sheet = el;
    return el;
  }

  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }
  function close() {
    if (!_sheet) return;
    _sheet.classList.remove('open');
    try { hud() && hud().syncSheets(); } catch (_) {}
  }
  function open() {
    var h = hud();
    var raise = function () { build(); render(); _sheet.classList.add('open'); };
    if (h && h.openSheet) h.openSheet('guide', raise); else raise();
  }

  function mount() {
    var h = hud();
    if (!h || !h.addLauncher) return;
    try { h.registerSheet('guide', isOpen, close); } catch (_) {}
    try { h.addLauncher('wvGuideBtn', 'guide', '?', function () { isOpen() ? close() : open(); }); } catch (_) {}
    W.addEventListener('keydown', function (e) {
      if (e.key !== '?') return;
      var a = document.activeElement;
      if (a && /input|textarea|select/i.test(a.tagName)) return;
      e.preventDefault();
      isOpen() ? close() : open();
    });
  }

  W.VintGuide = { open: open, close: close, isOpen: isOpen, render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
