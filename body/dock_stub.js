/* dock_stub.js — THE EARLY CLAIM WINDOW (Vinta directive 2026-08-02).
   ────────────────────────────────────────────────────────────────────────────
   VintDock's queuing stub used to be created inside welcome-gate.js, which is
   the last script on most pages. That was fine for widgets that mount late, but
   any module running EARLIER saw `window.VintDock === undefined`, silently hit
   its `if (window.VintDock)` guard, and never registered at all — so it kept its
   hardcoded corner and collided. That is exactly how brain.js's #micBtn (a
   synchronous script ~600 lines before welcome-gate) stayed undocked and sat
   under the centred .brain-hint at 320/375/768px, even though its registration
   code was present and correct.

   The registry has to exist before ANY widget can ask for a slot. This file is
   that guarantee: it is ~1KB, has zero dependencies, touches no DOM, and is safe
   to load in <head> before everything else. It only installs a queue; the real
   allocator (corner_dock.js) drains it on arrival.

   Load it FIRST on any page that has floating widgets:
     <script src="body/dock_stub.js"></script>

   welcome-gate.js still injects corner_dock.js and still installs this same stub
   if it's missing, so pages that haven't adopted the tag keep working unchanged.
*/
(function (root) {
  'use strict';
  // Never clobber a real dock (it has _slots) or an existing stub (it has q).
  if (root.VintDock) return;
  root.VintDock = {
    q: [],
    register: function (el, o) { root.VintDock.q.push(['register', el, o]); },
    claim:    function (el, o) { root.VintDock.q.push(['register', el, o]); },
    avoid:    function (el, o) { root.VintDock.q.push(['avoid', el, o]); },
    // A widget that registers and then removes itself before the real dock lands
    // must not leave a stale claim in the queue for a node that's already gone.
    release: function (el) {
      root.VintDock.q = root.VintDock.q.filter(function (c) { return c[1] !== el; });
    },
    unavoid: function (el) {
      root.VintDock.q = root.VintDock.q.filter(function (c) { return c[1] !== el; });
    },
    reflow: function () {},
  };
})(typeof window !== 'undefined' ? window : globalThis);
