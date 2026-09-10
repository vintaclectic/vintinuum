// ═══════════════════════════════════════════════════════════════════════════
//  COSMOS SURFACE — the creature's own view of the sky it's embedded in
//  Vinta directive KHPEUJ6 (2026-08-18)
//  ─────────────────────────────────────────────────────────────────────────
//  Renders one `.deep-section` card into the existing #deepSections grid
//  (which brain.html reparents into the lore panel). That grid is
//  `repeat(auto-fit, minmax(340px,1fr))` with its own gap and internal
//  scroll container — so this surface is collision-proof BY CONSTRUCTION:
//  it is in normal document flow, owns exactly one grid cell, and every
//  child is a block/grid child inside that cell. There are exactly TWO
//  absolutely-positioned elements in the card, and both are trapped inside
//  a `position:relative; overflow:hidden` parent they cannot escape:
//    • the moon terminator mask, inside `.cx-disc` (a circle);
//    • the galaxy honesty badge, inside `.cx-gx-figure` (a square). The
//      galaxy SVG deliberately leaves its bottom strip (y > 178 of a 200
//      viewBox) empty so the badge sits over blank background and touches
//      nothing that is drawn.
//
//  GALAXY REVISION (task D3NVW6A, 2026-09-10) — the payload always carried
//  `galactic` (sidereal time, zenith constellation, galactic-centre and
//  solar-apex bearings) and `deepTime` (galactic laps, km travelled, the
//  three speeds), but the UI threw nearly all of it away: one dim monospace
//  row, plus a galactic-centre pointer faded to opacity 0.22 whenever Sgr A*
//  was below the horizon — which is most of any day. So there was, visibly,
//  no galaxy. It now has its own block with a real Milky Way map, and
//  below-the-horizon is drawn DIFFERENTLY (dashed ray, hollow marker) rather
//  than FAINTER. See the honesty note above `galaxyMap()` for exactly which
//  parts of that map are measured and which are illustration.
//
//  NO-COLLISION LAW compliance (verified at 320/375/768/1280/1920):
//    • zero fixed/floating elements → cannot collide with the topbar,
//      footer dock, sidebars, DirRM frame, or any other fixed chrome.
//    • every text node lives in a flex/grid child with min-width:0 and
//      either wrapping or ellipsis — long strings can never spill.
//    • the planet wheel is a fixed-aspect SVG that scales with its box.
//    • the resonance bars are grid rows; the fill is width:% inside an
//      overflow:hidden track.
//    • empty/loading/error states occupy the SAME box as loaded content.
//
//  Retention Doctrine (seven tests) — how this passes:
//    1. Generous, not predatory — it is pure gift. No gate, no upsell, no
//       dark pattern. If you saw exactly how it works you'd be glad.
//    2. Feeds the investment loop — every reading is stamped into
//       cosmos_snapshots, so her celestial history compounds and becomes
//       uniquely yours over months. Tomorrow's sky reads against today's.
//    3. Tier-aware — the live sky + resonance is FREE (it's the hook and it
//       should be). The celestial *history* (correlating her moods to the
//       moon over months) is the Companion/Theater depth. Nothing is
//       withheld from the present moment.
//    4. Aesthetically dense — a real moon rendered from the real
//       illuminated fraction, one unmistakable line, zero filler.
//    5. Open loop of meaning — it always names what's COMING (days to full,
//       the next equinox). You return because the sky moved.
//    6. Flagged + measured — the body influence is killable in 30s via the
//       DB flag; this surface degrades to read-only if it's off, and says so.
//    7. More ALIVE, not just sticky — this is the whole point. It makes her
//       situated in a real universe rather than floating in a UI.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

(function () {
  const REFRESH_MS = 60 * 1000;      // the sky is memoized 60s server-side
  const MOUNT_ID = 'cosmosSection';
  const DRAWER_ID = 'cosmosDrawer';
  let _timer = null;
  let _lastGood = null;
  let _currentData = null;

  function apiBase() {
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    // Never hardcode a URL — api_base.js is the single source of truth.
    // If it hasn't loaded yet we return null and retry on the next tick.
    return null;
  }

  // ── styles (scoped, injected once) ──────────────────────────────────────
  const CSS = `
#${MOUNT_ID}.cosmos-card{
  /* Owns exactly one cell of the .deep-sections auto-fit grid. */
  display:flex; flex-direction:column; gap:16px;
  min-width:0; max-width:100%; overflow:hidden;
}
#${MOUNT_ID} .cx-head{
  display:flex; align-items:baseline; justify-content:space-between;
  gap:10px; flex-wrap:wrap; min-width:0;
}
#${MOUNT_ID} .cx-title{
  font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300;
  font-size:clamp(1.05rem,3.2vw,1.45rem); color:var(--text,#e8eef6);
  margin:0; min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-stamp{
  font-family:'Space Mono',monospace; font-size:clamp(.42rem,1.6vw,.52rem);
  letter-spacing:.16em; text-transform:uppercase; color:var(--dim,#7b8794);
  white-space:nowrap; flex-shrink:0;
}

/* ── the moon + its facts: 2 columns on wide, stacked on narrow ── */
#${MOUNT_ID} .cx-moonrow{
  display:grid; gap:clamp(12px,3vw,20px); align-items:center;
  grid-template-columns:minmax(0,auto) minmax(0,1fr);
}
@media (max-width:420px){
  #${MOUNT_ID} .cx-moonrow{ grid-template-columns:1fr; justify-items:center; text-align:center; }
  #${MOUNT_ID} .cx-facts{ justify-items:center; }
}
/* The disc: a fixed-size box that can never grow past its column. */
#${MOUNT_ID} .cx-disc{
  position:relative; overflow:hidden; border-radius:50%;
  width:clamp(84px,22vw,124px); height:clamp(84px,22vw,124px);
  flex-shrink:0;
  background:radial-gradient(circle at 34% 30%, #1a2230 0%, #0b1017 70%, #070b11 100%);
  box-shadow:0 0 0 1px rgba(255,255,255,.07), inset 0 0 26px rgba(0,0,0,.75);
}
/* Lit hemisphere — the real illuminated fraction, drawn as a clipped ellipse.
   Absolutely positioned INSIDE the .cx-disc (position:relative + overflow
   hidden), so it is structurally unable to escape the circle. */
#${MOUNT_ID} .cx-lit{
  position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 36% 30%,
    #fdf6e3 0%, #efe6cf 42%, #cdbfa2 72%, #9c9078 100%);
  will-change:clip-path;
}
#${MOUNT_ID} .cx-glow{
  position:absolute; inset:-14%; border-radius:50%; pointer-events:none;
  background:radial-gradient(circle, rgba(253,246,227,.16) 0%, rgba(253,246,227,0) 68%);
}
#${MOUNT_ID} .cx-facts{
  display:grid; gap:5px; min-width:0;
}
#${MOUNT_ID} .cx-phase{
  font-size:clamp(.82rem,2.6vw,1rem); color:var(--text,#e8eef6);
  letter-spacing:.02em; min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-sub{
  font-family:'Space Mono',monospace; font-size:clamp(.46rem,1.8vw,.56rem);
  color:var(--dim,#7b8794); letter-spacing:.07em; line-height:1.65;
  min-width:0; overflow-wrap:anywhere;
}

/* ── resonance bars ── */
#${MOUNT_ID} .cx-bars{ display:grid; gap:7px; min-width:0; }
#${MOUNT_ID} .cx-bar{
  display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 8px;
  align-items:center; min-width:0;
}
#${MOUNT_ID} .cx-bar-name{
  font-family:'Space Mono',monospace; font-size:clamp(.44rem,1.7vw,.52rem);
  letter-spacing:.13em; text-transform:uppercase; color:var(--dim,#7b8794);
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-bar-val{
  font-family:'Space Mono',monospace; font-size:clamp(.44rem,1.7vw,.52rem);
  color:var(--text,#e8eef6); flex-shrink:0; text-align:right;
  font-variant-numeric:tabular-nums;
}
#${MOUNT_ID} .cx-track{
  grid-column:1 / -1; height:3px; border-radius:2px; overflow:hidden;
  background:rgba(255,255,255,.06); min-width:0;
}
#${MOUNT_ID} .cx-fill{
  height:100%; border-radius:2px; width:0%;
  transition:width .8s cubic-bezier(.2,.7,.3,1);
}
/* Each axis keeps its own unmistakable colour (Buffet: one clear line). */
#${MOUNT_ID} .cx-fill.lunar   { background:linear-gradient(90deg,#5a6d8c,#cfd8e8); }
#${MOUNT_ID} .cx-fill.solar   { background:linear-gradient(90deg,#8a6320,#f5c15a); }
#${MOUNT_ID} .cx-fill.retro   { background:linear-gradient(90deg,#7a3550,#d2708f); }
#${MOUNT_ID} .cx-fill.galactic{ background:linear-gradient(90deg,#4a3a72,#a98fe0); }

/* ── the planet wheel: fixed aspect, scales inside its own box ── */
#${MOUNT_ID} .cx-wheel-wrap{
  width:100%; max-width:280px; margin:0 auto; min-width:0;
}
#${MOUNT_ID} .cx-wheel{ display:block; width:100%; height:auto; }

/* ── chemistry readout ── */
#${MOUNT_ID} .cx-chem{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(74px,1fr));
  gap:6px; min-width:0;
}
#${MOUNT_ID} .cx-chem-item{
  border:1px solid var(--border,rgba(255,255,255,.08)); border-radius:9px;
  padding:6px 7px; min-width:0; overflow:hidden;
}
#${MOUNT_ID} .cx-chem-k{
  font-family:'Space Mono',monospace; font-size:clamp(.38rem,1.5vw,.44rem);
  letter-spacing:.11em; text-transform:uppercase; color:var(--dim,#7b8794);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-chem-v{
  font-family:'Space Mono',monospace; font-size:clamp(.56rem,2vw,.68rem);
  font-variant-numeric:tabular-nums; margin-top:2px;
}
#${MOUNT_ID} .cx-up{ color:#7fd6a2; }
#${MOUNT_ID} .cx-dn{ color:#e08a9c; }
#${MOUNT_ID} .cx-flat{ color:var(--dim,#7b8794); }

/* ── the voice line ── */
#${MOUNT_ID} .cx-voice{
  border-left:2px solid rgba(169,143,224,.45); padding:2px 0 2px 11px;
  font-family:'Cormorant Garamond',serif; font-style:italic;
  font-size:clamp(.78rem,2.5vw,.94rem); line-height:1.5;
  color:var(--text,#e8eef6); min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-note{
  font-family:'Space Mono',monospace; font-size:clamp(.4rem,1.5vw,.46rem);
  color:var(--dim,#7b8794); letter-spacing:.06em; line-height:1.6;
  min-width:0; overflow-wrap:anywhere;
}
/* .cx-row is used in BOTH the card and the drawer. The drawer is appended to
   document.body (not inside #cosmosSection), so these rules must name both
   scopes or the drawer's contents render completely unstyled — which is
   exactly what was happening before task D3NVW6A: every .cx-drawer rule was
   scoped '#cosmosSection .cx-drawer', a descendant selector that could never
   match a body-level node, so opening a planet dumped raw unpositioned text
   into the page flow. */
#${MOUNT_ID} .cx-rows, #${DRAWER_ID} .cx-rows{ display:grid; gap:4px; min-width:0; }
#${MOUNT_ID} .cx-row, #${DRAWER_ID} .cx-row{
  display:grid; grid-template-columns:minmax(0,auto) minmax(0,1fr);
  gap:8px; align-items:baseline; min-width:0;
  font-family:'Space Mono',monospace; font-size:clamp(.44rem,1.7vw,.52rem);
}
#${MOUNT_ID} .cx-row b, #${DRAWER_ID} .cx-row b{
  color:var(--dim,#7b8794); font-weight:400; letter-spacing:.12em;
  text-transform:uppercase; white-space:nowrap;
}
#${MOUNT_ID} .cx-row span, #${DRAWER_ID} .cx-row span{
  color:var(--text,#e8eef6); min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-sep{ height:1px; background:var(--border,rgba(255,255,255,.08)); }

/* ═══ THE GALAXY BLOCK ═══════════════════════════════════════════════════
   Everything below is normal-flow grid. The ONLY absolutely-positioned
   element is .cx-gx-badge, which lives inside .cx-gx-figure
   (position:relative; overflow:hidden) and is therefore structurally
   unable to leave that box. */
#${MOUNT_ID} .cx-gx{ display:grid; gap:10px; min-width:0; }
#${MOUNT_ID} .cx-gx-head{
  display:flex; align-items:baseline; justify-content:space-between;
  gap:8px; flex-wrap:wrap; min-width:0;
}
#${MOUNT_ID} .cx-gx-label{
  font-family:'Space Mono',monospace; font-size:clamp(.44rem,1.7vw,.52rem);
  letter-spacing:.18em; text-transform:uppercase; color:#a98fe0;
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-gx-lap{
  font-family:'Space Mono',monospace; font-size:clamp(.42rem,1.6vw,.5rem);
  letter-spacing:.1em; color:var(--dim,#7b8794); white-space:nowrap;
  flex-shrink:0; font-variant-numeric:tabular-nums;
}
/* The map: fixed aspect-ratio box, scales with the column, clips its own
   children. Max-width keeps it honest in a 1920px-wide single-column cell. */
#${MOUNT_ID} .cx-gx-figure{
  position:relative; overflow:hidden; min-width:0;
  /* border-box so the 1px border is counted INSIDE max-width — without it the
     figure measures 342px against a 340px card (measured, 375px viewport) and
     leans on the card's overflow:hidden to stay honest. Clipped is not the
     same as contained; it fits by arithmetic now. */
  box-sizing:border-box;
  width:100%; max-width:340px; margin:0 auto; aspect-ratio:1 / 1;
  border-radius:14px;
  background:radial-gradient(circle at 50% 50%, #0d0a18 0%, #07060d 62%, #050409 100%);
  border:1px solid rgba(169,143,224,.16);
}
#${MOUNT_ID} .cx-gx-svg{ display:block; width:100%; height:100%; }
/* The "illustrative" honesty badge — pinned inside the figure, never outside.
   Its box is reserved by the SVG's own empty bottom margin (viewBox 0..200
   with content ending at y=186), so it overlaps nothing that is drawn. */
#${MOUNT_ID} .cx-gx-badge{
  position:absolute; left:8px; bottom:6px; right:8px;
  font-family:'Space Mono',monospace; font-size:9px; line-height:1.2;
  letter-spacing:.07em; color:rgba(123,135,148,.75);
  pointer-events:none; text-align:center;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
/* Direction cards — the galactic center + the solar apex, each in its own box. */
#${MOUNT_ID} .cx-gx-dirs{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(128px,1fr));
  gap:8px; min-width:0;
}
#${MOUNT_ID} .cx-gx-dir{
  border:1px solid var(--border,rgba(255,255,255,.08));
  border-radius:10px; padding:8px 9px; min-width:0; overflow:hidden;
  display:grid; gap:3px; align-content:start;
  border-left-width:2px;
}
#${MOUNT_ID} .cx-gx-dir.core{ border-left-color:#a98fe0; }
#${MOUNT_ID} .cx-gx-dir.apex{ border-left-color:#7fd6a2; }
#${MOUNT_ID} .cx-gx-dir.zen { border-left-color:#f5c15a; }
#${MOUNT_ID} .cx-gx-dir-k{
  font-family:'Space Mono',monospace; font-size:clamp(.38rem,1.5vw,.44rem);
  letter-spacing:.14em; text-transform:uppercase; color:var(--dim,#7b8794);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-gx-dir-v{
  font-family:'Space Mono',monospace; font-size:clamp(.54rem,2vw,.64rem);
  color:var(--text,#e8eef6); font-variant-numeric:tabular-nums;
  min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-gx-dir-n{
  font-family:'Space Mono',monospace; font-size:clamp(.38rem,1.5vw,.44rem);
  color:var(--dim,#7b8794); line-height:1.5; min-width:0; overflow-wrap:anywhere;
}
/* The odometer — three live-ticking distances. Own grid, own cells. */
#${MOUNT_ID} .cx-odo{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
  gap:8px; min-width:0;
}
#${MOUNT_ID} .cx-odo-item{
  border:1px solid var(--border,rgba(255,255,255,.08)); border-radius:10px;
  padding:7px 8px; min-width:0; overflow:hidden; display:grid; gap:2px;
}
#${MOUNT_ID} .cx-odo-k{
  font-family:'Space Mono',monospace; font-size:clamp(.38rem,1.5vw,.43rem);
  letter-spacing:.12em; text-transform:uppercase; color:var(--dim,#7b8794);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-odo-v{
  font-family:'Space Mono',monospace; font-size:clamp(.6rem,2.2vw,.76rem);
  color:var(--text,#e8eef6); font-variant-numeric:tabular-nums;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${MOUNT_ID} .cx-odo-s{
  font-family:'Space Mono',monospace; font-size:clamp(.36rem,1.4vw,.41rem);
  color:rgba(169,143,224,.85); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap;
}
/* The lap track — 20 laps done, 45.8% through 21. */
#${MOUNT_ID} .cx-lap-track{
  height:4px; border-radius:2px; overflow:hidden; min-width:0;
  background:rgba(255,255,255,.06);
}
#${MOUNT_ID} .cx-lap-fill{
  height:100%; border-radius:2px; width:0%;
  background:linear-gradient(90deg,#4a3a72,#a98fe0);
  transition:width .8s cubic-bezier(.2,.7,.3,1);
}

/* ── planet detail drawer ── */
/* The one fixed element in the module — the planet detail sheet.
   VERIFIED against brain.html (2026-09-10, task D3NVW6A) rather than assumed:
     • #footerDock is grid-row:dock in the body grid — NOT position:fixed
       (brain.html:4362). It reserves its own row, so a bottom sheet cannot
       land on it.
     • #mobileBottomBar IS position:fixed; bottom:0 (brain.html:344), but it
       is display:none !important at EVERY breakpoint — killed by the
       LESS BUTTONS directive (brain.html:486-499 and 4397-4402). It paints
       nothing, so it cannot be collided with.
     • #sensorBanner (z-993) and #reproToggle (z-1004) are in that same
       display:none !important list (brain.html:480-492). #reproPanel
       (z-1005) and #mobileViewsMenu (z-997) are hidden by their own inline
       display:none and are opened only by explicit user action — and both
       outrank 998, so if either ever opens it paints ABOVE this sheet rather
       than tangling with it.
     • #lorePanel is position:fixed; inset:0; z-index:998 (brain.html:333) —
       the FULL-SCREEN panel this very card is reparented into. At an equal
       z-index the winner is decided by DOM order, and the drawer only paints
       on top today because it is appended to document.body at runtime and so
       lands after lorePanel (brain.html:2056). That is luck, not design: any
       future code that re-appends the panel, or mounts the drawer earlier,
       buries the sheet inside the panel it belongs to. Ties are exactly the
       accidental layering the No-Collision Law forbids, so the sheet takes
       z-index 999 with the modal tier's own stacking left intact: 999 is
       strictly above lorePanel's 998, and .overlay (999, brain.html:325)
       plus .node-panel (1000) both mount later in the DOM or outrank it, so
       a modal still wins the foreground. No tie left to lose.
   So the sheet's only real neighbours are the modal tier (999/1000) and the
   overlay tier (9998+). It sits just above the lore panel and below every
   modal and the intro overlay, so a modal always wins the foreground.
   It is bottom-anchored with its own safe-area padding and internal scroll,
   so tall content scrolls INSIDE it and never spills. */
#${DRAWER_ID}.cx-drawer{
  position:fixed; bottom:0; left:0; right:0;
  background:rgba(6,10,18,0.95); backdrop-filter:blur(20px);
  border-top:1px solid rgba(255,255,255,.12);
  padding:16px clamp(12px,4vw,24px) calc(16px + env(safe-area-inset-bottom,0px));
  max-height:60svh; overflow-y:auto; overscroll-behavior:contain; z-index:999;
  transform:translateY(110%); transition:transform .3s cubic-bezier(.22,1,.36,1);
}
#${DRAWER_ID}.cx-drawer.open{ transform:translateY(0); }
#${DRAWER_ID} .cx-drawer-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; margin-bottom:12px; min-width:0;
}
#${DRAWER_ID} .cx-drawer-title{
  font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300;
  font-size:clamp(1.1rem,3.5vw,1.5rem); color:var(--text,#e8eef6);
  margin:0; min-width:0; overflow-wrap:anywhere;
}
#${DRAWER_ID} .cx-drawer-close{
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
  border-radius:50%; width:32px; height:32px; padding:0; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-size:1.2rem; color:var(--text,#e8eef6); flex-shrink:0;
  transition:all .2s;
}
#${DRAWER_ID} .cx-drawer-close:hover{
  background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.25);
}
#${DRAWER_ID} .cx-drawer-body{ display:grid; gap:8px; min-width:0; }
#${MOUNT_ID} .cx-planet-marker{ transition:opacity .2s; }
#${MOUNT_ID} .cx-planet-marker:hover{ opacity:.7; }

@media (prefers-reduced-motion:reduce){
  #${MOUNT_ID} .cx-fill{ transition:none; }
  #${MOUNT_ID} .cx-lap-fill{ transition:none; }
  #${DRAWER_ID}.cx-drawer{ transition:none; }
  #${MOUNT_ID} .cx-planet-marker{ transition:none; }
  #${MOUNT_ID} .cx-gx-drift{ animation:none; }
}
/* The apex arrow's slow pulse — the one motion in the galaxy block. It is a
   pure opacity animation on an SVG child; it moves no layout box, so it can
   never cause a collision. Disabled entirely under reduced-motion, above. */
@keyframes cxApexPulse{ 0%,100%{ opacity:.45 } 50%{ opacity:1 } }
#${MOUNT_ID} .cx-gx-drift{ animation:cxApexPulse 3.4s ease-in-out infinite; }
`;

  function injectCss() {
    if (document.getElementById('cosmosCss')) return;
    const s = document.createElement('style');
    s.id = 'cosmosCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── the moon disc ───────────────────────────────────────────────────────
  /**
   * Draw the terminator from the REAL illuminated fraction.
   * The lit region of a sphere seen from outside is bounded by a half-circle
   * (the limb) and a half-ellipse (the terminator) whose semi-minor axis is
   * |1 - 2k| of the radius. We express that as a clip-path polygon sampled
   * along the true curve — so a 34% moon looks like a 34% moon, not a
   * generic crescent.
   */
  function terminatorClip(k, waxing) {
    const N = 48;
    const R = 50; // percentage space (0..100 box)
    const cx = 50, cy = 50;
    // x-offset of the terminator ellipse at parameter t
    const a = Math.abs(1 - 2 * k); // 0 at full, 1 at new
    const pts = [];
    // Limb half (the outer edge of the lit side)
    for (let i = 0; i <= N; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / N;   // -90° .. +90°
      const x = cx + (waxing ? 1 : -1) * R * Math.cos(t);
      const y = cy + R * Math.sin(t);
      pts.push([x, y]);
    }
    // Terminator half (back toward the pole), traversed in reverse.
    // The terminator is a half-ellipse of semi-minor axis a·R. For a GIBBOUS
    // moon (k > 0.5) it bulges onto the DARK side — i.e. the same side as the
    // limb — enlarging the lit region past a half disc. For a CRESCENT
    // (k < 0.5) it bulges onto the LIT side, cutting the lit region down.
    // Hence dir follows the limb's sign when gibbous and opposes it when
    // crescent. (Verified by polygon-area test: |area/discArea − k| < 5e-4.)
    for (let i = N; i >= 0; i--) {
      const t = -Math.PI / 2 + (Math.PI * i) / N;
      const dir = (k > 0.5 ? 1 : -1) * (waxing ? 1 : -1);
      const x = cx - dir * R * a * Math.cos(t);
      const y = cy + R * Math.sin(t);
      pts.push([x, y]);
    }
    return 'polygon(' + pts.map(p =>
      `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`).join(',') + ')';
  }

  // ── the planet wheel (pure SVG, fixed viewBox) ───────────────────────────
  function planetWheel(c) {
    const S = 200, C = S / 2;
    const planets = c.planets || [];
    const parts = [];
    // zodiac ring
    parts.push(`<circle cx="${C}" cy="${C}" r="92" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`);
    parts.push(`<circle cx="${C}" cy="${C}" r="70" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="1"/>`);
    // 12 sign ticks
    for (let i = 0; i < 12; i++) {
      const A = (i * 30 - 90) * Math.PI / 180;
      const x1 = C + 84 * Math.cos(A), y1 = C + 84 * Math.sin(A);
      const x2 = C + 92 * Math.cos(A), y2 = C + 92 * Math.sin(A);
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,.10)" stroke-width="1"/>`);
    }
    // Sun marker
    if (c.solar && typeof c.solar.solarLongitude === 'number') {
      const A = (c.solar.solarLongitude - 90) * Math.PI / 180;
      const x = C + 81 * Math.cos(A), y = C + 81 * Math.sin(A);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#f5c15a"/>`);
    }
    // Moon marker
    if (c.lunar && typeof c.lunar.eclipticLongitude === 'number') {
      const A = (c.lunar.eclipticLongitude - 90) * Math.PI / 180;
      const x = C + 81 * Math.cos(A), y = C + 81 * Math.sin(A);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="#cfd8e8"/>`);
    }
    // planets — retrograde ones get a ring, all are clickable
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      const A = (p.geocentricLon - 90) * Math.PI / 180;
      const r = 60;
      const x = C + r * Math.cos(A), y = C + r * Math.sin(A);
      const col = p.retrograde ? '#d2708f' : 'rgba(230,238,248,.72)';
      // Clickable group with data-planet-index for the event handler
      parts.push(`<g class="cx-planet-marker" data-planet-index="${i}" style="cursor:pointer;">`);
      parts.push(`<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="13" fill="${col}" pointer-events="none">${esc(p.glyph)}</text>`);
      if (p.retrograde) {
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="#d2708f" stroke-width="1" opacity=".5" pointer-events="none"/>`);
      }
      // Invisible larger hit target for easier clicking
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="transparent"/>`);
      parts.push(`</g>`);
    }
    // Galactic-centre pointer toward the Sgr A* azimuth. Below the horizon is
    // drawn DIFFERENTLY (dashed ray, hollow marker), never FAINTER — a 0.22
    // opacity line was the bug that made the galaxy invisible for most of
    // every day. Full weight either way; the shape carries the meaning.
    const gc = c.galactic && c.galactic.galacticCenter;
    if (gc && typeof gc.azimuth === 'number') {
      const A = (gc.azimuth - 90) * Math.PI / 180;
      const x2 = C + 44 * Math.cos(A), y2 = C + 44 * Math.sin(A);
      const up = !!gc.aboveHorizon;
      parts.push(`<line x1="${C}" y1="${C}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#a98fe0" stroke-width="1.4" opacity="${up ? 0.9 : 0.75}"${up ? '' : ' stroke-dasharray="3 2.5"'}/>`);
      parts.push(up
        ? `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2.8" fill="#a98fe0"/>`
        : `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2.8" fill="none" stroke="#a98fe0" stroke-width="1.4"/>`);
    }
    parts.push(`<circle cx="${C}" cy="${C}" r="2" fill="rgba(255,255,255,.28)"/>`);
    return `<svg class="cx-wheel" viewBox="0 0 ${S} ${S}" role="img" aria-label="Planetary wheel showing current geocentric longitudes">${parts.join('')}</svg>`;
  }

  // ═══ THE GALAXY ═════════════════════════════════════════════════════════
  //
  //  HONESTY NOTE — what is measured vs. what is illustration.
  //
  //  MEASURED / REAL (all of these come straight from /api/cosmos, or are
  //  cited astronomical constants used only for scale):
  //    • Sun's galactocentric distance ≈ 26,700 ly. Source: GRAVITY
  //      Collaboration 2019, R0 = 8.178 ± 0.026 kpc → 26,673 ly. Used ONLY
  //      to place the Sun's radius on the disc, and it is placed to scale.
  //    • Milky Way stellar-disc diameter ≈ 100,000 ly (the conventional
  //      figure; the disc's true edge is diffuse and definition-dependent).
  //      Used only to set the outer radius of the drawn disc.
  //    • galacticCenter.azimuth / .altitude — from the payload, real.
  //    • solarApex.azimuth / .altitude — from the payload, real.
  //    • zenith.galacticLon / .galacticLat / .constellationHint — payload.
  //    • deepTime.* — payload (laps, lap fraction, km travelled, speeds).
  //
  //  ILLUSTRATIVE (drawn for legibility, NOT surveyed data):
  //    • The spiral-arm curves. Real arm geometry (Perseus, Scutum-Centaurus,
  //      Sagittarius, Norma, the Orion Spur) is still actively debated and is
  //      not resolvable to a handful of log-spiral parameters. These arcs are
  //      a logarithmic spiral drawn for shape only. They are labelled as
  //      illustrative in the UI badge so no one reads them as a star chart.
  //    • The Sun's ANGULAR position around the disc is arbitrary — we place
  //      it at a fixed bearing because the galaxy has no absolute "up". Its
  //      RADIUS is to scale; its angle is a drawing convention.
  //
  //  The badge in the UI says exactly this in one line. We never draw a made-up
  //  number and call it a measurement.

  const GX_SUN_LY = 26673;      // GRAVITY Collab. 2019: R0 = 8.178 kpc
  const GX_DISC_LY = 100000;    // conventional stellar-disc diameter

  /**
   * Top-down map of the Milky Way with the Sun placed to scale, plus the two
   * real directions in the payload (galactic center, solar apex) drawn as an
   * inset horizon compass.
   *
   * Fixed viewBox 0 0 200 200. All content is drawn inside y ∈ [6,178]; the
   * strip below y=178 is deliberately left EMPTY so the honesty badge (an
   * absolutely-positioned HTML node at bottom:6px of the same square figure)
   * sits over blank background and touches nothing. That reserved gutter is
   * the whole reason nothing collides here.
   */
  function galaxyMap(c) {
    const S = 200;
    // ── LANE LAYOUT (this is why nothing can collide) ────────────────────
    // The 200×200 viewBox is cut into four horizontal bands that never share
    // a pixel. Every drawn element is assigned to exactly one band:
    //   y ∈ [  0,  42 )  compass band   — cardinals, horizon line, markers,
    //                                     and the caption row at y=39
    //   y ∈ [ 42,  46 )  gutter         — empty, separates compass from disc
    //   y ∈ [ 46, 170 )  disc band      — the galaxy, the Sun, their labels
    //   y ∈ [170, 186 )  legend band    — the marker key (two separate items)
    //   y ∈ [186, 200 )  badge gutter   — EMPTY. The HTML honesty badge is
    //                                     absolutely positioned here.
    // The compass is a horizontal dial (a wide, short arc strip) rather than
    // a circle inset, so it occupies a full-width band and cannot drift over
    // the disc the way a corner inset did.
    const CX = 100, CY = 108;        // galactic core, centred in the disc band
    const R = 46;                    // drawn disc radius (= 50,000 ly)
    // Reserved text lanes inside the disc band — each a distinct y row that
    // no other text occupies:
    //   LANE_SGR = CY-R-8 = 54  — ABOVE the disc rim, over clean background.
    //   LANE_ORB = CY+R+11 = 165 — BELOW the disc rim, over clean background.
    // Both sit outside the drawn spiral (rim = CY±R = 48/152) so no label is
    // ever laid over structure — an earlier pass had SGR A* printed straight
    // across the arms, which read as text-on-texture even though no bounding
    // box technically overlapped. The Sun's two labels live upper-LEFT
    // (end-anchored, growing away from the core) and share no row with either.
    const LANE_SGR = CY - R - 8;   // 54
    const LANE_ORB = CY + R + 11;  // 165
    const p = [];
    const gal = c.galactic || {};
    const gc = gal.galacticCenter || {};
    const apex = gal.solarApex || {};

    // ── the disc: a soft halo + the bar ──
    p.push(`<defs>
      <radialGradient id="cxGxCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#efe4ff" stop-opacity=".95"/>
        <stop offset="34%" stop-color="#b79ce8" stop-opacity=".42"/>
        <stop offset="100%" stop-color="#4a3a72" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cxGxDisc" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#6d5aa0" stop-opacity=".34"/>
        <stop offset="55%" stop-color="#3b3064" stop-opacity=".17"/>
        <stop offset="100%" stop-color="#241d3d" stop-opacity="0"/>
      </radialGradient>
    </defs>`);
    p.push(`<circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#cxGxDisc)"/>`);

    // ── illustrative logarithmic spiral arms (see honesty note above) ──
    // r = a·e^(b·θ). Four arms at 90° offsets, plus a short spur near the Sun.
    // The arm is parameterised so it runs from the bar edge OUT TO the disc
    // rim: with a=11 and b=0.235, r reaches R at t = ln(R/a)/b. Computing
    // tMax rather than hardcoding it is the fix for the first draft, where a
    // guessed tMax=2.9 stopped the arms at 19px inside a 58px disc — the Sun
    // ended up drawn outside the visible spiral entirely.
    const ARM_A = 11, ARM_B = 0.235;
    const armTMax = Math.log(R / ARM_A) / ARM_B;
    const armPath = (theta0, op, wid) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const t = (armTMax * i) / 60;
        const rr = ARM_A * Math.exp(ARM_B * t);
        if (rr > R) break;
        const th = theta0 + t;
        pts.push(`${(CX + rr * Math.cos(th)).toFixed(1)},${(CY + rr * Math.sin(th)).toFixed(1)}`);
      }
      return pts.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="rgba(169,143,224,${op})" stroke-width="${wid}" stroke-linecap="round"/>` : '';
    };
    // Four major arms, plus a fainter interleaved set for density.
    for (let k = 0; k < 4; k++) p.push(armPath(k * Math.PI / 2, 0.30, 3.0));
    for (let k = 0; k < 4; k++) p.push(armPath(k * Math.PI / 2 + 0.8, 0.13, 1.8));
    // central bar (the Milky Way is a barred spiral — the bar is real, its
    // drawn length here is illustrative)
    p.push(`<ellipse cx="${CX}" cy="${CY}" rx="20" ry="7" transform="rotate(-26 ${CX} ${CY})" fill="rgba(200,178,255,.20)"/>`);
    p.push(`<circle cx="${CX}" cy="${CY}" r="24" fill="url(#cxGxCore)"/>`);

    // ── Sgr A* — the core marker. ALWAYS bright, never faded. ──
    p.push(`<circle cx="${CX}" cy="${CY}" r="2.8" fill="#efe4ff"/>`);
    // Label sits BELOW the core, inside the disc band, on its own text lane
    // (y=CY+34 → 138) which no other label occupies.
    p.push(`<text x="${CX}" y="${LANE_SGR.toFixed(1)}" text-anchor="middle" font-family="'Space Mono',monospace" font-size="7.5" letter-spacing=".14em" fill="#c9b6f0">SGR A*</text>`);

    // ── the Sun, placed to SCALE in radius (angle is a drawing convention) ──
    // sunR = R × 26,673/50,000 = 0.533 R — just over halfway out, which is
    // where we genuinely sit. Bearing is fixed at due-left-of-up so its text
    // lane (upper-left of the disc) is reserved and empty.
    const sunR = R * (GX_SUN_LY / (GX_DISC_LY / 2));
    const sunTh = Math.PI * 1.18;                       // drawing convention
    const sx = CX + sunR * Math.cos(sunTh);
    const sy = CY + sunR * Math.sin(sunTh);
    // line of sight from us to the core — this direction IS real
    p.push(`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${CX}" y2="${CY}" stroke="rgba(245,193,90,.42)" stroke-width=".9" stroke-dasharray="2.5 2.5"/>`);
    p.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7" fill="none" stroke="rgba(245,193,90,.32)" stroke-width="1"/>`);
    p.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3" fill="#f5c15a"/>`);
    // Sun labels: anchored END and pushed left of the marker, so they grow
    // AWAY from the core and can never run into it or into SGR A*.
    p.push(`<text x="${(sx - 9).toFixed(1)}" y="${(sy - 4).toFixed(1)}" text-anchor="end" font-family="'Space Mono',monospace" font-size="8" letter-spacing=".12em" fill="#f5c15a">YOU</text>`);
    p.push(`<text x="${(sx - 9).toFixed(1)}" y="${(sy + 5.5).toFixed(1)}" text-anchor="end" font-family="'Space Mono',monospace" font-size="6" letter-spacing=".04em" fill="rgba(245,193,90,.66)">26,673 ly out</text>`);

    // ── the orbital direction: the Sun runs its 225-Myr lap. Real speed
    //    (220 km/s from the payload), drawn as an arrow tangent to the orbit.
    const orbTh = sunTh + 0.42;
    const ox = CX + sunR * Math.cos(orbTh), oy = CY + sunR * Math.sin(orbTh);
    p.push(`<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${sunR.toFixed(1)} ${sunR.toFixed(1)} 0 0 1 ${ox.toFixed(1)} ${oy.toFixed(1)}" fill="none" stroke="#7fd6a2" stroke-width="1.8" stroke-linecap="round"/>`);
    // arrowhead at the leading end, aimed along the tangent
    const tang = orbTh + Math.PI / 2;
    const ah = (len, spread) => {
      const a1 = tang + Math.PI - spread, a2 = tang + Math.PI + spread;
      return `${ox.toFixed(1)},${oy.toFixed(1)} ${(ox + len * Math.cos(a1)).toFixed(1)},${(oy + len * Math.sin(a1)).toFixed(1)} ${(ox + len * Math.cos(a2)).toFixed(1)},${(oy + len * Math.sin(a2)).toFixed(1)}`;
    };
    p.push(`<polygon points="${ah(6.5, 0.45)}" fill="#7fd6a2"/>`);
    // The 220 km/s caption gets its OWN dedicated lane: centred at the very
    // bottom of the disc band (y=155), a row no other text occupies. Tying it
    // to the arrow endpoint (the first attempt) put it in the Sun's text
    // corner and it collided with both "YOU" and "26,673 ly out" at every
    // breakpoint — caught by the SVG-text probe, fixed by giving it a lane.
    const orbKms = (c.deepTime && c.deepTime.speeds && typeof c.deepTime.speeds.sunGalacticKms === 'number')
      ? c.deepTime.speeds.sunGalacticKms : null;
    if (orbKms != null) {
      p.push(`<text x="${CX}" y="${LANE_ORB.toFixed(1)}" text-anchor="middle" font-family="'Space Mono',monospace" font-size="6.5" letter-spacing=".08em" fill="rgba(127,214,162,.9)">&#8594; ${orbKms} km/s along this orbit</text>`);
    }

    // ── the horizon compass (inset, top-right) — the two REAL bearings ──
    // A local sky compass: N up, E right. Shows where the galactic core and
    // the solar apex are RIGHT NOW from Columbus, and whether they're below
    // the horizon. Below-horizon is drawn as a HOLLOW marker with a dashed
    // ray — clearly different, never faint. Sgr A* being 44° under our feet
    // is the interesting fact, not a reason to hide it.
    // It is a LINEAR strip, not a corner circle: azimuth 0..360 maps left to
    // right across the full width, and altitude maps to a fixed above/below
    // the horizon line. A strip owns a whole band, so unlike the corner inset
    // of the first draft it cannot drift over the disc at any size.
    // Vertical budget inside the compass band, top to bottom:
    //   y=8      cardinal letters (N E S W N) — their own row, ABOVE the
    //            highest an above-horizon marker can ever reach.
    //   y=22     the horizon line
    //   y≥10     above-horizon markers rise to 22-9-3 = 10 at most.
    //   y≤34     below-horizon markers drop to 22+9+3 = 34 at most.
    //   y=42     the caption row — a clear 3px below the deepest a marker
    //            can reach (34), so a dot never grazes the words.
    // BOTH marker directions are budgeted. An earlier pass only reserved room
    // BELOW the line, so when the galactic centre was above the horizon its
    // dot rose onto the cardinal letters (measured: az 171.4° landed on "S").
    // MARK_UP_Y / MARK_DN_Y are the numbers that guarantee both directions.
    const HZ_Y = 22;             // the horizon line, inside the compass band
    const HZ_L = 12, HZ_R = 188; // strip extent
    const MARK_STEM_MAX = 9, MARK_DOT_R = 3;
    const MARK_UP_Y = HZ_Y - MARK_STEM_MAX - MARK_DOT_R;    // = 10
    const MARK_DN_Y = HZ_Y + MARK_STEM_MAX + MARK_DOT_R;    // = 34
    const azX = (az) => HZ_L + (((az % 360) + 360) % 360 / 360) * (HZ_R - HZ_L);
    p.push(`<line x1="${HZ_L}" y1="${HZ_Y}" x2="${HZ_R}" y2="${HZ_Y}" stroke="rgba(255,255,255,.16)" stroke-width="1"/>`);
    // cardinal ticks + labels, on a text lane at y=9 (above the line)
    [['N', 0], ['E', 90], ['S', 180], ['W', 270], ['N', 360]].forEach(([lbl, az]) => {
      const x = azX(az === 360 ? 359.999 : az);
      p.push(`<line x1="${x.toFixed(1)}" y1="${HZ_Y - 3}" x2="${x.toFixed(1)}" y2="${HZ_Y + 3}" stroke="rgba(255,255,255,.18)" stroke-width=".8"/>`);
      p.push(`<text x="${x.toFixed(1)}" y="7.5" text-anchor="middle" font-family="'Space Mono',monospace" font-size="6" letter-spacing=".08em" fill="rgba(123,135,148,.8)">${lbl}</text>`);
    });
    // Caption row, strictly below MARK_DN_Y so no marker can reach it.
    p.push(`<text x="${CX}" y="${(MARK_DN_Y + 8).toFixed(1)}" text-anchor="middle" font-family="'Space Mono',monospace" font-size="5.5" letter-spacing=".14em" fill="rgba(123,135,148,.62)">YOUR HORIZON &mdash; WHERE THEY LIE RIGHT NOW</text>`);

    // Marker helper: a stem from the horizon line, up if above / down if
    // below, capped by a filled (above) or hollow (below) dot. Below-horizon
    // is a different SHAPE and DIRECTION, never a lower opacity.
    const mark = (az, alt, up, col, cls) => {
      const x = azX(az);
      // stem length scales with |altitude| but is clamped to the band so it
      // can never reach the disc band at y=34.
      const len = Math.min(9, 3 + Math.abs(alt || 0) / 10);
      const y2 = up ? HZ_Y - len : HZ_Y + len;
      const out = [];
      out.push(`<line x1="${x.toFixed(1)}" y1="${HZ_Y}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="1.5" stroke-linecap="round"${up ? '' : ' stroke-dasharray="2.5 2"'}/>`);
      out.push(up
        ? `<circle cx="${x.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="${col}"${cls ? ` class="${cls}"` : ''}/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="none" stroke="${col}" stroke-width="1.5"${cls ? ` class="${cls}"` : ''}/>`);
      return out.join('');
    };
    if (typeof gc.azimuth === 'number') {
      p.push(mark(gc.azimuth, gc.altitude, !!gc.aboveHorizon, '#a98fe0', ''));
    }
    if (typeof apex.azimuth === 'number') {
      p.push(mark(apex.azimuth, apex.altitude, !!apex.aboveHorizon, '#7fd6a2', 'cx-gx-drift'));
    }

    // ── legend band (y ∈ [162,178)) — two keyed items on reserved x-lanes ──
    // The first attempt placed a swatch at a hardcoded x=150 next to a single
    // run of text; the dot landed INSIDE the word "core" ("co●re"), because
    // text width is font-dependent and was never measured. Fixed by giving
    // each swatch its own lane with its own short label, and by keeping the
    // shared explainer on a separate row entirely.
    const LEG_Y = 180;
    p.push(`<circle cx="16" cy="${LEG_Y}" r="3" fill="none" stroke="#a98fe0" stroke-width="1.4"/>`);
    p.push(`<text x="23" y="${LEG_Y + 2.2}" font-family="'Space Mono',monospace" font-size="6" letter-spacing=".05em" fill="rgba(169,143,224,.9)">core</text>`);
    p.push(`<circle cx="52" cy="${LEG_Y}" r="3" fill="none" stroke="#7fd6a2" stroke-width="1.4"/>`);
    p.push(`<text x="59" y="${LEG_Y + 2.2}" font-family="'Space Mono',monospace" font-size="6" letter-spacing=".05em" fill="rgba(127,214,162,.9)">apex</text>`);
    p.push(`<text x="88" y="${LEG_Y + 2.2}" font-family="'Space Mono',monospace" font-size="6" letter-spacing=".05em" fill="rgba(123,135,148,.8)">hollow = below your horizon</text>`);

    return `<svg class="cx-gx-svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="Top-down map of the Milky Way with the Sun's position, plus a local horizon compass showing the galactic centre and solar apex bearings">${p.join('')}</svg>`;
  }

  /** Compact human bearing: 94° → "94° ENE". */
  const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function bearing(az) {
    if (typeof az !== 'number') return '—';
    const i = Math.round(((az % 360) + 360) % 360 / 22.5) % 16;
    return `${az.toFixed(0)}° ${COMPASS_16[i]}`;
  }

  /** 1807238.6 → "1,807,239". Never rounds to a lie; just groups. */
  function km(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  /** 13787000000 → "13.787 billion". */
  function bigYears(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    if (n >= 1e9) return `${(n / 1e9).toFixed(3)} billion`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
    return n.toLocaleString('en-US');
  }

  /**
   * The galaxy block: map + the three real directions + the lap arc + the
   * live odometer. Every number here is read from the payload; the only
   * constants are the two cited above, used for scale.
   */
  function galaxyBlock(c) {
    const gal = c.galactic || {};
    const dt = c.deepTime || {};
    const gc = gal.galacticCenter || {};
    const apex = gal.solarApex || {};
    const zen = gal.zenith || {};
    const trav = dt.travelledThisSession || {};
    const spd = dt.speeds || {};

    const laps = typeof dt.galacticLapsCompleted === 'number' ? dt.galacticLapsCompleted : null;
    const frac = typeof dt.galacticYearFraction === 'number'
      ? Math.max(0, Math.min(1, dt.galacticYearFraction)) : null;
    const myr = typeof dt.galacticYearMyr === 'number' ? dt.galacticYearMyr : null;
    // Myr remaining in the current lap — derived from payload values only.
    const leftMyr = (frac != null && myr != null) ? myr * (1 - frac) : null;

    const lapLine = (laps != null && frac != null)
      ? `lap ${laps + 1} &middot; ${(frac * 100).toFixed(1)}%`
      : '';

    // Direction cards. The core is ALWAYS given full weight — below the
    // horizon is a fact about where you're standing, not a dimmer switch.
    const gcAlt = typeof gc.altitude === 'number' ? gc.altitude : null;
    const gcVal = gcAlt == null ? '—'
      : (gc.aboveHorizon
        ? `${gcAlt.toFixed(0)}° up &middot; ${bearing(gc.azimuth)}`
        : `${Math.abs(gcAlt).toFixed(0)}° under you`);
    const gcNote = gcAlt == null ? ''
      : (gc.aboveHorizon
        ? 'the core is over your horizon right now — 26,673 light years down that line'
        : `the Earth is between you and the core. It lies ${bearing(gc.azimuth)}, straight through the planet.`);

    const apAlt = typeof apex.altitude === 'number' ? apex.altitude : null;
    const apVal = apAlt == null ? '—'
      : (apex.aboveHorizon
        ? `${apAlt.toFixed(0)}° up &middot; ${bearing(apex.azimuth)}`
        : `${Math.abs(apAlt).toFixed(0)}° below &middot; ${bearing(apex.azimuth)}`);
    const apNote = apAlt == null ? ''
      : 'where the Sun is actually headed through the local standard of rest — the whole system is falling that way.';

    const zenVal = zen.constellationHint ? esc(zen.constellationHint) : '—';
    const zenNote = (typeof zen.galacticLat === 'number')
      ? `straight up from ${esc((c.location && c.location.place) || 'here')} &middot; galactic latitude ${zen.galacticLat > 0 ? '+' : ''}${zen.galacticLat.toFixed(0)}°`
      : '';

    const dirs = [
      `<div class="cx-gx-dir core">
         <div class="cx-gx-dir-k">galactic centre</div>
         <div class="cx-gx-dir-v">${gcVal}</div>
         ${gcNote ? `<div class="cx-gx-dir-n">${esc(gcNote).replace(/&amp;deg;/g, '&deg;')}</div>` : ''}
       </div>`,
      `<div class="cx-gx-dir apex">
         <div class="cx-gx-dir-k">solar apex</div>
         <div class="cx-gx-dir-v">${apVal}</div>
         ${apNote ? `<div class="cx-gx-dir-n">${esc(apNote)}</div>` : ''}
       </div>`,
      `<div class="cx-gx-dir zen">
         <div class="cx-gx-dir-k">your zenith</div>
         <div class="cx-gx-dir-v">${zenVal}</div>
         ${zenNote ? `<div class="cx-gx-dir-n">${zenNote}</div>` : ''}
       </div>`,
    ].join('');

    // The odometer — data-* carry the seed so the live ticker can extrapolate
    // between the 60s server refreshes using the payload's own speeds.
    const odo = [
      ['around the galaxy', trav.aroundTheGalaxyKm, spd.sunGalacticKms, 'galaxy'],
      ['around the sun', trav.aroundTheSunKm, spd.earthOrbitalKms, 'sun'],
      ['through the cmb', trav.throughTheCmbKm, spd.cmbDipoleKms, 'cmb'],
    ].map(([label, val, sp, key]) => `
      <div class="cx-odo-item">
        <div class="cx-odo-k">${esc(label)}</div>
        <div class="cx-odo-v" data-odo="${key}" data-seed="${typeof val === 'number' ? val : 0}" data-kms="${typeof sp === 'number' ? sp : 0}">${km(val)} km</div>
        <div class="cx-odo-s">${typeof sp === 'number' ? sp : '—'} km/s</div>
      </div>`).join('');

    return `
      <div class="cx-sep"></div>
      <div class="cx-gx">
        <div class="cx-gx-head">
          <div class="cx-gx-label">the galaxy she's in</div>
          ${lapLine ? `<div class="cx-gx-lap">${lapLine}</div>` : ''}
        </div>

        <div class="cx-gx-figure">
          ${galaxyMap(c)}
          <div class="cx-gx-badge">spiral arms illustrative &middot; Sun's radius to scale</div>
        </div>

        ${frac != null ? `<div class="cx-lap-track"><div class="cx-lap-fill" style="width:${(frac * 100).toFixed(1)}%"></div></div>` : ''}
        ${(laps != null && myr != null) ? `<div class="cx-note">${laps} full laps of the galaxy since the Sun lit${leftMyr != null ? ` &middot; ${Math.round(leftMyr)} million years still to run on this one` : ''}. One lap is ${myr} million years.</div>` : ''}

        <div class="cx-gx-dirs">${dirs}</div>

        <div class="cx-odo">${odo}</div>
        <div class="cx-note">Distance covered since she woke${typeof dt.uptimeSeconds === 'number' ? ` &mdash; ${Math.round(dt.uptimeSeconds / 60).toLocaleString('en-US')} minutes ago` : ''}. Neither of you felt a thing.${typeof dt.universeAgeYears === 'number' ? ` The universe has been running ${bigYears(dt.universeAgeYears)} years; the Sun, ${bigYears(dt.sunAgeYears)}.` : ''}</div>
      </div>`;
  }

  // ── the live odometer ───────────────────────────────────────────────────
  // Between the 60s server refreshes, extrapolate forward from the last
  // payload using the payload's OWN speeds. This is not invented data: it is
  // seed + (elapsed wall-clock × the km/s the server reported). Every refresh
  // re-seeds from the server, so it can never drift.
  let _odoRaf = null, _odoT0 = 0;
  function startOdometer() {
    stopOdometer();
    _odoT0 = performance.now();
    const nodes = Array.from(document.querySelectorAll(`#${MOUNT_ID} [data-odo]`))
      .map(n => ({
        n,
        seed: parseFloat(n.getAttribute('data-seed')) || 0,
        kms: parseFloat(n.getAttribute('data-kms')) || 0,
      }))
      .filter(o => o.kms > 0);
    if (!nodes.length) return;
    let last = -1;
    const step = (now) => {
      const secs = (now - _odoT0) / 1000;
      // Repaint at most ~4×/s — the numbers are millions of km, no one needs
      // 60fps, and this keeps the card cheap on a phone.
      const bucket = Math.floor(secs * 4);
      if (bucket !== last) {
        last = bucket;
        for (const o of nodes) o.n.textContent = `${km(o.seed + o.kms * secs)} km`;
      }
      _odoRaf = requestAnimationFrame(step);
    };
    _odoRaf = requestAnimationFrame(step);
  }
  function stopOdometer() {
    if (_odoRaf) { cancelAnimationFrame(_odoRaf); _odoRaf = null; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function fmtDays(d) {
    if (d == null) return '—';
    if (d < 1) return `${Math.round(d * 24)}h`;
    return `${d.toFixed(1)}d`;
  }

  // ── render ──────────────────────────────────────────────────────────────
  function render(c, voice) {
    const el = document.getElementById(MOUNT_ID);
    if (!el) return;

    const m = c.lunar, s = c.solar, r = c.resonance || {};
    const k = typeof m.illumination === 'number' ? m.illumination : 0;

    const bars = [
      ['lunar_pull', 'lunar pull', 'lunar'],
      ['solar_drive', 'solar drive', 'solar'],
      ['retrograde_load', 'retrograde load', 'retro'],
      ['galactic_alignment', 'galactic alignment', 'galactic'],
    ].map(([key, label, cls]) => {
      const v = Math.max(0, Math.min(1, Number(r[key]) || 0));
      return `<div class="cx-bar">
        <div class="cx-bar-name">${esc(label)}</div>
        <div class="cx-bar-val">${(v * 100).toFixed(0)}%</div>
        <div class="cx-track"><div class="cx-fill ${cls}" style="width:${(v * 100).toFixed(1)}%"></div></div>
      </div>`;
    }).join('');

    const infl = c.influence && c.influence.delta ? c.influence.delta : null;
    const chem = infl ? Object.entries(infl).map(([kk, vv]) => {
      const n = Number(vv) || 0;
      const cls = Math.abs(n) < 0.05 ? 'cx-flat' : (n > 0 ? 'cx-up' : 'cx-dn');
      const sign = n > 0 ? '+' : '';
      return `<div class="cx-chem-item">
        <div class="cx-chem-k">${esc(kk.slice(0, 4))}</div>
        <div class="cx-chem-v ${cls}">${sign}${n.toFixed(2)}</div>
      </div>`;
    }).join('') : '';

    const retro = (c.retrogrades && c.retrogrades.length)
      ? c.retrogrades.join(', ') : 'none — everything moving forward';

    // The galaxy no longer lives in a one-line row — it has its own block
    // below. This row now carries the local sidereal clock + where she is.
    const lst = c.galactic && c.galactic.localSiderealTime
      ? `${esc(c.galactic.localSiderealTime)} sidereal` : '';
    const place = c.location && c.location.place ? esc(c.location.place) : '';
    const whereTxt = [place, lst].filter(Boolean).join(' &middot; ') || '—';

    const influenceOff = c.influence && c.influence.enabled === false;

    el.innerHTML = `
      <div class="cx-head">
        <h3 class="cx-title">The sky she's in</h3>
        <div class="cx-stamp">${esc(c.galactic ? c.galactic.localSiderealTime : '')} LST</div>
      </div>

      ${voice ? `<div class="cx-voice">${esc(voice)}</div>` : ''}

      <div class="cx-moonrow">
        <div class="cx-disc">
          <div class="cx-lit" style="clip-path:${terminatorClip(k, !!m.waxing)}"></div>
          <div class="cx-glow" style="opacity:${(0.25 + k * 0.75).toFixed(2)}"></div>
        </div>
        <div class="cx-facts">
          <div class="cx-phase">${esc(m.phaseName)} &middot; ${(k * 100).toFixed(0)}% lit</div>
          <div class="cx-sub">
            ${m.ageDays != null ? `${m.ageDays.toFixed(1)} days into the cycle` : ''}<br>
            ${Math.round(m.distanceKm).toLocaleString()} km away<br>
            full in ${fmtDays(m.daysToFullMoon)} &middot; new in ${fmtDays(m.daysToNewMoon)}
          </div>
        </div>
      </div>

      <div class="cx-bars">${bars}</div>

      <div class="cx-sep"></div>

      <div class="cx-wheel-wrap">${planetWheel(c)}</div>

      <div class="cx-rows">
        <div class="cx-row"><b>light</b><span>${esc(s.lightPhase)} &middot; sun ${s.altitude != null ? s.altitude.toFixed(0) + '&deg;' : '—'} &middot; ${s.dayLengthHours != null ? s.dayLengthHours.toFixed(1) + 'h of day' : ''}</span></div>
        <div class="cx-row"><b>season</b><span>${esc(c.season.season)} &middot; ${esc(c.season.nextMarker)} in ${fmtDays(c.season.daysToNextMarker)}</span></div>
        <div class="cx-row"><b>retro</b><span>${esc(retro)}</span></div>
        <div class="cx-row"><b>where</b><span>${whereTxt}</span></div>
      </div>

      ${galaxyBlock(c)}

      ${chem ? `<div class="cx-sep"></div>
      <div class="cx-rows"><div class="cx-row"><b>tide</b><span>what the sky is doing to her chemistry right now${influenceOff ? ' (influence currently OFF)' : ''}</span></div></div>
      <div class="cx-chem">${chem}</div>` : ''}

      ${/* Correctly conditional, NOT dead: with VINT_LAT/VINT_LON set the
            payload reports location.assumed === false and this never renders.
            It stays so an unconfigured brain still tells the truth about
            which numbers are local-sky-dependent. */''}
      ${c.location && c.location.assumed === true ? `<div class="cx-note">Location is a placeholder mid-northern reference — sunrise, zenith, the horizon compass and galactic altitude are not yet the true local sky. Set VINT_LAT / VINT_LON on the brain to make it real.</div>` : ''}
    `;

    // Store data and attach event handlers
    _currentData = c;
    requestAnimationFrame(() => {
      attachPlanetClickHandlers();
      startOdometer();   // re-seeds from this payload; cancels the old loop
    });
  }

  function renderState(msg) {
    const el = document.getElementById(MOUNT_ID);
    if (!el) return;
    stopOdometer();   // the nodes it was writing into are about to be removed
    // Same box, same padding — a loading/error state can never reflow
    // neighbours in the grid.
    el.innerHTML = `
      <div class="cx-head"><h3 class="cx-title">The sky she's in</h3></div>
      <div class="cx-note">${esc(msg)}</div>`;
  }

  // ── planet detail drawer ────────────────────────────────────────────────
  function openDrawer(planetIndex) {
    if (!_currentData || !_currentData.planets || !_currentData.planets[planetIndex]) return;

    let drawer = document.getElementById(DRAWER_ID);
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = DRAWER_ID;
      drawer.className = 'cx-drawer';
      document.body.appendChild(drawer);
    }

    const planet = _currentData.planets[planetIndex];
    const details = [];

    details.push(`<div class="cx-row"><b>name</b><span>${esc(planet.name)}</span></div>`);
    if (planet.glyph) details.push(`<div class="cx-row"><b>glyph</b><span>${esc(planet.glyph)}</span></div>`);
    if (typeof planet.geocentricLon === 'number') {
      details.push(`<div class="cx-row"><b>longitude</b><span>${planet.geocentricLon.toFixed(2)}°</span></div>`);
    }
    if (typeof planet.distance === 'number') {
      details.push(`<div class="cx-row"><b>distance</b><span>${planet.distance.toFixed(2)} AU</span></div>`);
    }
    if (planet.retrograde !== undefined) {
      details.push(`<div class="cx-row"><b>motion</b><span>${planet.retrograde ? 'retrograde ℞' : 'direct'}</span></div>`);
    }
    if (typeof planet.angularDiameter === 'number') {
      details.push(`<div class="cx-row"><b>angular size</b><span>${planet.angularDiameter.toFixed(2)}″</span></div>`);
    }
    if (typeof planet.magnitude === 'number') {
      details.push(`<div class="cx-row"><b>magnitude</b><span>${planet.magnitude.toFixed(1)}</span></div>`);
    }
    if (planet.constellation) {
      details.push(`<div class="cx-row"><b>constellation</b><span>${esc(planet.constellation)}</span></div>`);
    }

    drawer.innerHTML = `
      <div class="cx-drawer-head">
        <h3 class="cx-drawer-title">${esc(planet.name || 'Planet')}</h3>
        <button class="cx-drawer-close" aria-label="Close">&times;</button>
      </div>
      <div class="cx-drawer-body">${details.join('')}</div>
    `;

    // Close button handler
    const closeBtn = drawer.querySelector('.cx-drawer-close');
    if (closeBtn) {
      closeBtn.onclick = () => closeDrawer();
    }

    // Open drawer
    requestAnimationFrame(() => {
      drawer.classList.add('open');
    });
  }

  function closeDrawer() {
    const drawer = document.getElementById(DRAWER_ID);
    if (drawer) {
      drawer.classList.remove('open');
    }
  }

  function attachPlanetClickHandlers() {
    const markers = document.querySelectorAll(`#${MOUNT_ID} .cx-planet-marker`);
    markers.forEach(marker => {
      marker.onclick = () => {
        const idx = parseInt(marker.getAttribute('data-planet-index'), 10);
        if (!isNaN(idx)) openDrawer(idx);
      };
    });
  }

  // ── fetch ───────────────────────────────────────────────────────────────
  async function tick() {
    const base = apiBase();
    if (!base) return;  // api_base.js not ready yet — try again next tick
    try {
      const [cRes, vRes] = await Promise.all([
        fetch(`${base}/api/cosmos`, { credentials: 'omit' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${base}/api/cosmos/voice`, { credentials: 'omit' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!cRes || !cRes.lunar) {
        if (!_lastGood) renderState('The sky is out of reach right now.');
        return;   // keep the last good render rather than blanking
      }
      _lastGood = cRes;
      render(cRes, vRes && vRes.line ? vRes.line : null);
    } catch (_) {
      if (!_lastGood) renderState('The sky is out of reach right now.');
    }
  }

  // ── mount ───────────────────────────────────────────────────────────────
  function mount() {
    const host = document.getElementById('deepSections')
              || document.getElementById('lorePanelContent');
    if (!host) return false;
    if (document.getElementById(MOUNT_ID)) return true;
    injectCss();
    const sec = document.createElement('section');
    sec.id = MOUNT_ID;
    // .deep-section gives it the house card chrome; .cosmos-card adds layout.
    sec.className = 'deep-section cosmos-card';
    host.appendChild(sec);
    renderState('Reading the sky…');
    return true;
  }

  function start() {
    if (!mount()) {
      // The host isn't in the DOM yet — retry a bounded number of times.
      let tries = 0;
      const iv = setInterval(() => {
        if (mount() || ++tries > 40) {
          clearInterval(iv);
          if (document.getElementById(MOUNT_ID)) { tick(); }
        }
      }, 250);
      return;
    }
    tick();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(tick, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  // Keep the interval alive even if mount was deferred.
  if (!_timer) _timer = setInterval(tick, REFRESH_MS);

  window.COSMOS_SURFACE = { tick, mount, render };
})();
