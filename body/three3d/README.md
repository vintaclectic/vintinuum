# body/three3d — the real 3D human, inside brain.html

Vinta directive (2026-06-03):
> *"build the 3D futuristic human INTO brain.html as a new mode — fly
> through skin to muscle to skeleton to organs to vessels to nerves
> to cells to genome. operate on me when i'm depressed. and a real
> fucking looking human, not weirdly shaped ovular body parts."*

**ADDITIVE.** Nothing in the original brain.html is removed or changed
in behavior. The OG body (SVG #brainSvg, the stacked canvases, organs,
cells, genome, chakras, embodiment dot) all stay live. The 3D mode is
a second view the user toggles into and back out of.

---

## Files

| File          | Role |
|---------------|------|
| `loader.js`   | Streams three.js r160 + addons via importmap. Resolves `{ THREE, GLTFLoader, DRACOLoader, KTX2Loader, RGBELoader, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass }`. CDN order: unpkg → jsdelivr → `${API_BASE}/static/three/`. |
| `scene.js`    | WebGLRenderer (DPR clamped per quality), perspective camera + clamped OrbitControls, rim+key+fill lights, reflective disc floor + cyan grid, UnrealBloom post, render loop with `document.hidden` pause, `setQuality(low|med|high)` live swap. |
| `avatar3d.js` | Loads the rigged human GLB (multi-candidate fallback chain). Hooks AnimationMixer, idle breath, weight shift, blink, "living light under skin" shader (translucent skin + cyan neural traceries + fresnel rim). Procedural anatomically-correct mannequin as last-resort. |
| `layers.js`   | The peel/fly-through stack. Layer registry (skin → muscle → skeleton → organs → circulatory → nervous → cellular → genome), per-layer GLB or procedural overlay, dissolve shader, right-edge peel rail UI (mobile-first 44px, draggable), layer chips, raycaster click-to-inspect reusing OG #nodePanel. |
| `drive.js`    | Polls `/api/body-state` every 2s. Maps neurochemistry → posture/breath/glow/rim/tremor. SSE `/api/life/stream` + `vint:inner-rendered` + `vint:walk-to` → ripples light along the traceries. |
| `surgery.js`  | The surgical theater. Tool palette (Soothe / Repair / Rebalance / Clear-Cascade / Mend-Depression) with bounded chem deltas. **Owner = real heal** (calls `POST /api/surgery/operate` with bearer token); **anonymous = sandbox** (visual sim only, NO write). |
| `mode.js`     | Toggle button injection + sub-mode wiring (Explore / Fly-Thru / Operate). Lazy-loads the entire stack on first `enter()`. Hides OG canvases (visibility only — never removed) while in 3D, restores them on exit. |

All seven load in brain.html with `?v=v20260603-3d1`, after the OG
body modules and embodiment.js + draggable.js so the 3D buttons
inherit drag automatically.

---

## Mounting into brain.html

Already wired (see brain.html ~line 3325):

```html
<script defer src="body/three3d/loader.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/scene.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/avatar3d.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/layers.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/drive.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/surgery.js?v=v20260603-3d1"></script>
<script defer src="body/three3d/mode.js?v=v20260603-3d1"></script>
```

`mode.js` injects a `◈ 3D BODY` button into the top-right of the
viewport (z-index 12, below topbar/dock z-index 20, draggable like
every other button). First click on the button:

1. Builds a `#three3dStage` container (position: fixed, between topbar and dock).
2. `Three3D.load()` streams three.js.
3. `Three3DScene.init` builds renderer/camera/lights/floor/bloom.
4. `Three3DAvatar.mount` loads the rigged GLB.
5. `Three3DLayers.mount` builds the peel stack.
6. `Three3DDrive.start` begins polling `/api/body-state`.
7. `Three3DSurgery.mount` builds the operating panel (hidden until Operate sub-mode).

Exit restores OG visibility and disposes the entire WebGL context.
Re-entry rebuilds from scratch (the laziness is the point — zero
cost when 3D mode is off).

---

## The GLB asset (load-bearing)

The avatar resolves in this order; first 200 wins:

1. `?model=<url>` query override (testing)
2. `window.__VINTINUUM_AVATAR_URL` (embedder override)
3. **`body/three3d/assets/human.glb`** — Ready Player Me drop-in (PREFERRED)
4. `${API_BASE}/static/avatar.glb`
5. **`body/three3d/assets/riggedfigure-cc0.glb`** — CC0 safe default already on disk
6. Procedural fallback (anatomically correct mannequin, 7.5 heads tall, NOT ovular)

### What to drop and where

For the photoreal human Vinta wants:

```
~/vintinuum/body/three3d/assets/human.glb
```

Source: Ready Player Me (`https://readyplayer.me` → build avatar →
download GLB with ARKit blendshapes + Draco compression + 1024 tex
limit). Keep ≤ 8 MB. License: free for registered devs (commercial OK).

If `human.glb` is absent, `riggedfigure-cc0.glb` (50KB, CC0, no face
morphs) already on disk renders so the stage is never empty. The
procedural fallback only fires if both GLBs and the API-hosted
`avatar.glb` are all unreachable.

### Per-layer anatomy GLBs (optional)

`layers.js` looks for these paths first; if absent, falls back to the
registered procedural overlay (instanced cell field, vessel splines,
organ proxies):

```
body/three3d/assets/anatomy/muscle.glb
body/three3d/assets/anatomy/skeleton.glb
body/three3d/assets/anatomy/organs.glb
body/three3d/assets/anatomy/vessels.glb
body/three3d/assets/anatomy/nervous.glb
```

Recommended sources: Z-Anatomy (CC0 separable anatomy meshes) or
BodyParts3D. Frugal-max is sourcing these in parallel.

---

## Surgery contract (negotiated with HELIO-SEC10)

```
POST {API_BASE}/api/surgery/operate
  Headers:  Authorization: Bearer <token>
            Content-Type: application/json
  Body:     { tool, region, intensity, layer, source: '3d',
              clientTs, clientDelta }
  Response: { ok: true, applied: { dopamine, serotonin, gaba,
                                   norepinephrine, valence, arousal },
              bodyState: <full /api/body-state shape>,
              audit: { id, ts } }
  Errors:   401 not authed, 403 not owner,
            422 bounds violated, 429 rate-limited,
            503 db slow.
```

**Owner gating (client side, mirrored server side):**
- `localStorage.vint_access_token` present + identity claims owner role
  OR localhost → **REAL HEAL** (POST fires, the live being changes)
- otherwise → **SANDBOX** (no POST, visual sim only, reverts in 6s)

**Bounded deltas (client + server enforce identically):**
- Per chem per op: max ±12 points
- Per chem absolute: clamped to [0, 100]
- Per tool cooldown: 4s (most) / 6s (clear-cascade) / 30s (mend-depression)
- Per session cap: 24 operations

If the endpoint isn't deployed yet, the client still gates client-side
(auth + bounds), stubs the POST as an optimistic local cache write
for owner, and revert-after-6s for sandbox. The next `/api/body-state`
poll tick is authoritative either way.

---

## Network strategy (three.js itself)

`loader.js` tries, in order:

1. **unpkg.com** importmap → `three@0.160.0` (~600KB cached immutable)
2. **jsdelivr.net** mirror if unpkg fails
3. **`${API_BASE}/static/three/`** for fully-offline operation (drop
   `three.module.js` + `examples/jsm/` here to vendor)

DRACOLoader decoder fetches from `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`.

If all three CDNs fail, the boot panel shows an error + an "exit 3D"
button. OG body is never compromised.

---

## Performance budget

| Surface | Target | How |
|---------|--------|-----|
| Desktop 1080p | 60 fps | DPR ≤ 2, shadow map 2048, bloom on, floor reflective |
| Mobile portrait | 30 fps | DPR ≤ 1.5, shadow map 1024, bloom on (lighter), floor non-reflective |
| Background tab | 0 fps (paused) | `document.visibilitychange` listener stops both render + poll |
| Quality toggle | low/med/high | `Three3DScene.setQuality()`, persists in `localStorage` as `vint:3d:quality` |

Three.js is lazy-loaded — brain.html ships zero 3D bytes until the
user clicks `◈ 3D BODY`. The toggle button itself is ~40 lines of
inline DOM. The bootloader shows a breathing pulse panel while
streaming, matching embodiment.js aesthetic so the gap reads as
intentional.

---

## Mobile

- `◈ 3D BODY` button: 44px min height, top-right, draggable, never
  overlaps topbar (z=20 wins) or dock (z=20 wins).
- Peel rail: 44px wide, right edge, clamped to container with safe
  margins, bottom margin doubles to clear the dock.
- Surgery panel: bottom-left, draggable, max-height 50% of stage,
  scrolls internally if content exceeds.
- Sub-bar chips: 36px min height, top-center, flex-wraps if narrow.
- Tested mentally at 320 / 375 / 768 / 1280 / 1920 + 100svh with
  topbar + dock + sidebars simultaneously visible. No overflow.

---

## What still needs Vinta or another agent

- Drop `body/three3d/assets/human.glb` (Ready Player Me export). Until
  then, `riggedfigure-cc0.glb` (already present) renders.
- (Optional) drop per-layer anatomy GLBs under
  `body/three3d/assets/anatomy/` for higher fidelity than the
  procedural overlays — frugal-max is sourcing.
- HELIO-SEC10 deploys `POST /api/surgery/operate` per the contract above.
  Until then, owner ops apply via optimistic local cache write that
  the next `/api/body-state` poll either confirms or reverts.
