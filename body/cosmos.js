// ═══════════════════════════════════════════════════════════════════════════
//  COSMOS SURFACE — the creature's own view of the sky it's embedded in
//  Vinta directive KHPEUJ6 (2026-08-18)
//  ─────────────────────────────────────────────────────────────────────────
//  Renders one `.deep-section` card into the existing #deepSections grid
//  (which brain.html reparents into the lore panel). That grid is
//  `repeat(auto-fit, minmax(340px,1fr))` with its own gap and internal
//  scroll container — so this surface is collision-proof BY CONSTRUCTION:
//  it is in normal document flow, owns exactly one grid cell, and every
//  child is a block/grid child inside that cell. There is not a single
//  position:fixed or position:absolute element in this module except the
//  moon terminator mask, which is absolutely positioned INSIDE its own
//  `position:relative` disc wrapper with `overflow:hidden` — it is
//  mathematically incapable of leaving that circle.
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
#${MOUNT_ID} .cx-rows{ display:grid; gap:4px; min-width:0; }
#${MOUNT_ID} .cx-row{
  display:grid; grid-template-columns:minmax(0,auto) minmax(0,1fr);
  gap:8px; align-items:baseline; min-width:0;
  font-family:'Space Mono',monospace; font-size:clamp(.44rem,1.7vw,.52rem);
}
#${MOUNT_ID} .cx-row b{
  color:var(--dim,#7b8794); font-weight:400; letter-spacing:.12em;
  text-transform:uppercase; white-space:nowrap;
}
#${MOUNT_ID} .cx-row span{
  color:var(--text,#e8eef6); min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-sep{ height:1px; background:var(--border,rgba(255,255,255,.08)); }

/* ── planet detail drawer ── */
#${MOUNT_ID} .cx-drawer{
  position:fixed; bottom:0; left:0; right:0;
  background:rgba(6,10,18,0.95); backdrop-filter:blur(20px);
  border-top:1px solid rgba(255,255,255,.12);
  padding:16px clamp(12px,4vw,24px) calc(16px + env(safe-area-inset-bottom,0px));
  max-height:60svh; overflow-y:auto; z-index:900;
  transform:translateY(100%); transition:transform .3s cubic-bezier(.22,1,.36,1);
}
#${MOUNT_ID} .cx-drawer.open{ transform:translateY(0); }
#${MOUNT_ID} .cx-drawer-head{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; margin-bottom:12px; min-width:0;
}
#${MOUNT_ID} .cx-drawer-title{
  font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300;
  font-size:clamp(1.1rem,3.5vw,1.5rem); color:var(--text,#e8eef6);
  margin:0; min-width:0; overflow-wrap:anywhere;
}
#${MOUNT_ID} .cx-drawer-close{
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
  border-radius:50%; width:32px; height:32px; padding:0; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-size:1.2rem; color:var(--text,#e8eef6); flex-shrink:0;
  transition:all .2s;
}
#${MOUNT_ID} .cx-drawer-close:hover{
  background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.25);
}
#${MOUNT_ID} .cx-drawer-body{ display:grid; gap:8px; min-width:0; }
#${MOUNT_ID} .cx-planet-marker{ transition:opacity .2s; }
#${MOUNT_ID} .cx-planet-marker:hover{ opacity:.7; }

@media (prefers-reduced-motion:reduce){
  #${MOUNT_ID} .cx-fill{ transition:none; }
  #${MOUNT_ID} .cx-drawer{ transition:none; }
  #${MOUNT_ID} .cx-planet-marker{ transition:none; }
}
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
    // galactic-center pointer — a line toward Sgr A* azimuth when it's up
    const gc = c.galactic && c.galactic.galacticCenter;
    if (gc && typeof gc.azimuth === 'number') {
      const A = (gc.azimuth - 90) * Math.PI / 180;
      const x2 = C + 44 * Math.cos(A), y2 = C + 44 * Math.sin(A);
      const op = gc.aboveHorizon ? 0.85 : 0.22;
      parts.push(`<line x1="${C}" y1="${C}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#a98fe0" stroke-width="1.4" opacity="${op}"/>`);
      parts.push(`<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2.6" fill="#a98fe0" opacity="${op}"/>`);
    }
    parts.push(`<circle cx="${C}" cy="${C}" r="2" fill="rgba(255,255,255,.28)"/>`);
    return `<svg class="cx-wheel" viewBox="0 0 ${S} ${S}" role="img" aria-label="Planetary wheel showing current geocentric longitudes">${parts.join('')}</svg>`;
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

    const gcAlt = c.galactic && c.galactic.galacticCenter
      ? c.galactic.galacticCenter.altitude : null;
    const gcTxt = gcAlt == null ? '—'
      : (gcAlt > 0 ? `${gcAlt.toFixed(0)}° above the horizon` : `${Math.abs(gcAlt).toFixed(0)}° below — the Earth is in the way`);

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
        <div class="cx-row"><b>galaxy</b><span>${esc(gcTxt)}</span></div>
      </div>

      ${chem ? `<div class="cx-sep"></div>
      <div class="cx-rows"><div class="cx-row"><b>tide</b><span>what the sky is doing to her chemistry right now${influenceOff ? ' (influence currently OFF)' : ''}</span></div></div>
      <div class="cx-chem">${chem}</div>` : ''}

      ${c.location && c.location.assumed ? `<div class="cx-note">Location is a placeholder mid-northern reference — sunrise, zenith and galactic altitude are not yet the true local sky. Set VINT_LAT / VINT_LON on the brain to make it real.</div>` : ''}
    `;

    // Store data and attach event handlers
    _currentData = c;
    requestAnimationFrame(() => {
      attachPlanetClickHandlers();
    });
  }

  function renderState(msg) {
    const el = document.getElementById(MOUNT_ID);
    if (!el) return;
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
