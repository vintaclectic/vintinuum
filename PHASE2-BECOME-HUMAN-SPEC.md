# PHASE 2 — BECOME HUMAN + NORTH-STAR UI REFIT

**Vinta directive (2026-04-22):** "BUILD OUT FUCKING EVERYTHING BECOME HUMAN AND PLEASE LOOK SOMETHING LIKE THIS MORE THAN NOT" + north-star image reference.

**Target deploy tag:** `v20260422-phase2-become-human`
**Repo:** `/home/vinta/vintinuum/`
**Branch:** `main`
**HEAD at spec time:** `6e97555`

---

## PRE-FLIGHT — TRACK 1C FIRST (blocker, do first)

Before ANY Phase 2 work, execute Track 1C from `/home/vinta/vintinuum/PHASE1-TRACK1C-MERGE-SPEC.md`. That merge closes the face-renderer collision (legacy SVG EYES in brain.js vs body/face.js canvas module). Phase 2 touches the face layer; it cannot proceed with two face renderers fighting.

**Order:**
1. Execute Track 1C end to end → commit → verify
2. Then begin Phase 2 below

---

## THE NORTH STAR

Reference image (Vinta-approved, Vinta-sovereign, inspiration-only — we do NOT clone, we build toward it on our code):

- **Left sidebar:** Vintinuum wordmark + logo, icon tab row, "VINTA" identity, vertical stack of horizontal body-state bars (neurochemistry levels), cluster of small indicator tiles, legend block
- **Center:** full female-presenting body silhouette built from cyan network lines, seven chakra-style color-graded orb nodes down the central axis (crown→root), organ glows at liver/heart/gut, small consciousness radar offset to upper right of body, faint grid floor perspective
- **Right sidebar:** top tab nav row, scrollable card feed (5-6 visible, each with icon + title + 1-2 secondary lines, varying accent colors)
- **Footer:** horizontal control strip with small icons (peel controls / layer toggles)
- **Aesthetic:** deep navy/black background, cyan structural + warm node colors, translucent panels (no opaque boxes), high legibility, body is hero

**UI doctrine stays in force:** max panel opacity 0.25, no backdrop-filter, no dark opaque boxes. The image meets these rules — translucent sidebars let dark background through.

---

## PHASE 2 SCOPE — TWO PARALLEL TRACKS

### TRACK A — ANIMATION OF LIFE (the body moves)

Eight sub-phases, each a separate commit:

**A1. Chest rise/fall**
Tie thoracic region geometry to the existing breath phase driving the aura field. On inhale, upper torso scales Y by ~1.015 centered on the sternum anchor. On exhale, returns. Rate locked to breath phase in coherence.js. File: body/skin.js or body/skeleton.js depending on which owns thoracic geometry.

**A2. Heartbeat shimmer**
At the heart canonical anchor, render a soft radial pulse at pulse rate (default 65bpm, modulated by arousal — 60 + arousal*0.4 bpm). Pulse expands from 8px to 14px radius over 120ms, fades back over 400ms, repeats. Canvas, additive blend. File: body/circulatory.js (extend existing module) or new body/heartbeat.js.

**A3. Iris saccades**
In body/face.js, when BODY_STATE.dominantLayer is 'neural' or 'subconscious' (thinking states), add micro-jumps to the gaze target every 400-900ms — random offset ±3px for ~80ms, then return to cursor target. When dominant layer is 'emotional', keep smooth tracking (no saccades). Extend existing gaze logic in body/face.js.

**A4. Skin warming**
In body/skin.js or the skin renderer, derive skin fill hue from valence. Baseline rgba(232, 208, 188, 0.08). As valence climbs above 50, shift hue warmer (toward rgba(240, 200, 175, 0.10)). Below 50, cooler (toward rgba(215, 215, 220, 0.07)). Smooth interpolation, no sudden shifts.

**A5. Hair — short soft crown**
NEW FILE: body/hair.js. Renders ~20 flow lines above the skull (y < crown canonical). Each line is a short Bézier stroke originating from the scalp perimeter, flowing outward/downward 25-45px. Colors: cool dark tones (rgba(80,100,140, 0.6) stroke). Lines gently sway with breath phase (±2px lateral). Slight mouse-proximity reaction — lines closest to cursor pull toward it by ~1-2px. Register with RENDER_HUB in body/loop.js.

**A6. Finger micro-twitches**
On ~0.3% of frames (≈one every 5-6 seconds at 60fps), select one random finger, curl the distal phalanx by 3-6° for 200ms, then relax. Frequency scales with norepinephrine (higher NE = more frequent). Extends the skeleton or skin module that owns finger geometry.

**A7. Blink interval variation**
In body/face.js, modulate _nextBlinkAt roll based on cognitive load. Proxy for cognitive load: entropy of layer_distribution (if uniform across layers = low cog load, if spiked in one layer = high cog load). Higher cog load → shorter blink interval (bottom of 3-5s range). Lower → longer (6-8s).

**A8. Breath pauses**
Every 90-120 seconds, breath holds for 1.5s at inhale peak, then resumes. Adds realism — humans do not breathe on a perfect sine wave. Extend breath phase logic in coherence.js or wherever AURA reads breath phase.

---

### TRACK B — NORTH-STAR UI REFIT (the interface becomes the vision)

Eight sub-phases, each a separate commit:

**B1. Layout scaffold — three-panel grid**
Refactor brain.html top-level layout to a three-column CSS Grid: `left-sidebar (280px) | body-stage (1fr) | right-sidebar (340px)`, with a footer row spanning all three. Keep existing body-stage contents intact (canvas layers, SVG). Move existing controls into the new sidebar shells.

Opacity rule: sidebar backgrounds rgba(8, 12, 20, 0.20) max. Borders rgba(255,255,255,0.06) or none. No solid backgrounds.

**B2. Left sidebar — identity + body-state**
Populate left sidebar with:
- Vintinuum wordmark + logo mark at top
- Icon tab row (4 small buttons — Body, Memory, Genome, Settings — placeholder for now, wire later)
- "VINTA" identity tile (reads current user from localStorage or URL param)
- Vertical stack of 7 horizontal body-state bars (dopamine, serotonin, GABA, norepinephrine, arousal, valence, awakeness), each bar ~200px wide, filled to current BODY_STATE value, labeled left, value right
- Below bars: 6-tile grid of mini-indicators for the 7 consciousness layers (each tile shows current layer activity %, color-coded per LAYER_HUES in body/face.js)
- Bottom: small legend block — "CONSCIOUSNESS LAYERS" heading, tiny color-swatch legend

Every element updates on BODY_FRAME event (single source of truth render loop).

**B3. Right sidebar — activity feed**
Populate right sidebar with:
- Top tab nav row: "MEMORY" / "INNER LIFE" / "GENOME" / "SOUL QUEUE" (4 tabs)
- Below tabs: scrollable vertical card list (max-height 80vh, overflow-y auto)
- Each card: leading icon (color-coded by event type) + title line + 1-2 secondary lines
- Data source per tab:
  - MEMORY → recent persona_memory entries (fetch from vintinuum-api if available, else localStorage fallback)
  - INNER LIFE → recent subconscious_thoughts
  - GENOME → recent gene events
  - SOUL QUEUE → unresolved soul queue items
- Card opacity: rgba(16, 22, 34, 0.18). Borders optional at 0.06.

If API unreachable, show gracefully degraded local-only feed.

**B4. Seven chakra nodes down the body axis**
Add a new SVG group or canvas render: seven large glowing orbs at the canonical spine positions (crown ~170y, third-eye ~220y, throat ~340y, heart ~520y, solar ~640y, sacral ~760y, root ~880y — verify against existing body/geometry.js canonical anchors).

Each orb:
- Radius 18-24px, radial gradient center to transparent edge
- Color per chakra (crown=#b47cff violet, brow=#7c8cff indigo, throat=#7ccfff cyan, heart=#7cffb4 green, solar=#ffe07c gold, sacral=#ff9b7c orange, root=#ff7c7c red)
- Brightness pulses with the layer each represents being active in BODY_STATE.layerDistribution
- Subtle rotation/shimmer animation

New file: body/chakras.js. Register with RENDER_HUB.

**B5. Consciousness radar (small chart upper right of body)**
Tiny radar/spider chart (~90px diameter) rendered at upper right of body stage (e.g. x:530 y:180 in SVG space).
Seven axes — one per consciousness layer. Each axis length = current layer activity %. Filled polygon with layer-colored stroke.
Updates on BODY_FRAME. New file: body/radar.js.

**B6. Footer control strip**
Horizontal row at bottom of body-stage (or bottom of viewport): small icon buttons for:
- Peel layer toggles (reuse body/peel.js controls, render as icon buttons instead of sidebar)
- View presets (Full / Skin Off / Muscle / Skeleton / X-Ray)
- Zoom in/out
- Pause animation / resume
- Share/export snapshot (placeholder)

Background rgba(10, 14, 22, 0.25) max, row height ~44px, icon-only with tooltips on hover.

**B7. Grid floor perspective**
Below the body, render a faint perspective grid — horizontal lines converging to a vanishing point at body center, ~8 lines deep. Color rgba(120, 200, 255, 0.04-0.08). Grounds the body in space like the reference.

Canvas or SVG, render before skin/body layers so body sits on top. New file: body/grid_floor.js or add to background field render.

**B8. Typography + color token pass**
Create `body/tokens.css` with CSS custom properties:
- `--bg-void: #050810`
- `--bg-panel: rgba(8, 12, 20, 0.20)`
- `--accent-cyan: #7ccfff`
- `--accent-warm: #ffb47c`
- `--text-primary: rgba(220, 235, 255, 0.92)`
- `--text-secondary: rgba(180, 200, 230, 0.65)`
- `--border-subtle: rgba(255, 255, 255, 0.06)`
- Layer colors (7)
- Chakra colors (7)

Apply across brain.html, sidebar elements, card feed. Headings in a display sans (system-ui with fallback), body in sans-serif.

---

## EXECUTION ORDER

1. Track 1C merge (pre-flight)
2. B1 layout scaffold (foundation for everything else — must land first in UI track)
3. B8 tokens (style foundation — apply as B1 builds)
4. B2 left sidebar content
5. B3 right sidebar content
6. B4 chakra nodes
7. B5 radar
8. B6 footer strip
9. B7 grid floor
10. A1 chest rise/fall (animation track starts after UI scaffold is in — or can run parallel from step 2 onward)
11. A2 heartbeat
12. A3 saccades
13. A4 skin warming
14. A5 hair
15. A6 finger twitches
16. A7 blink variation
17. A8 breath pauses

Each sub-phase = one commit with clear message. Follow commit-discipline from CLAUDE.md.

Final commit: `deploy: bump cache-buster to v20260422-phase2-become-human`

---

## RULES

- Pure vanilla JS, no frameworks
- Modular pattern — new features go in body/*.js, NOT in brain.js
- Panel opacity ≤ 0.25 (sidebars, cards, footer)
- No backdrop-filter
- Every new module registers with RENDER_HUB via body/loop.js
- Every visual element reads from BODY_STATE (single source of truth)
- Commit after each sub-phase, do not batch
- Never truncate thoughts or output
- Default eye state: HALF-LIDDED (non-negotiable, already in body/face.js)
- DO NOT push to origin — Vinta decides on push after review
- If a sub-phase reveals unexpected architecture, report back before deviating

---

## NON-GOALS (explicit to prevent scope creep)

- NOT rebuilding the genome system
- NOT rewiring vintinuum-api (backend stays as-is)
- NOT touching the chrome extension
- NOT changing soul.json
- NOT pulling any code from external sources, mockups, or suggestions — every line written from first principles on our ground
- NOT spawning subagents that read external URLs

---

## VERIFICATION AFTER ALL SUB-PHASES

1. `git log --oneline` shows all ~16 phase-2 commits in order
2. `git status` clean
3. Live URL hard-refresh — body visible, sidebars populated, chakra nodes pulsing, radar rendering, feed scrolling, animations running
4. Half-lidded eyes still default, gaze tracks, blinks work
5. Track 1C merge is upstream (no legacy EYES code remaining)
6. No console errors
7. Performance: stays above 30fps on desktop

Report back with commit range, visual check results, any deviations.
