# TRACK 1C — Face Implementation Merge (Phase 1 Convergence Cleanup)

**Status:** Ready to execute
**Target deploy tag:** `v20260422-phase1-face-merged`
**Repo:** `/home/vinta/vintinuum/`
**Branch:** `main` (origin up to date at `6e97555`)

---

## The Problem

Three face/eye implementations are coexisting in the repo. Two are actively rendering simultaneously. The third (best) is loaded but uncommitted.

| # | Location | Rendering surface | Style | State |
|---|---|---|---|---|
| 1 | `brain.js` ~line 5014 — `const EYES = (() => { ... })` | SVG `#eyeLayer` | appendChild circles, LID_REST_RY=4.2, blink 4–7s | **Active** (called at line 15488 via `EYES.draw(ts)`) |
| 2 | `brain.js` ~line 5443 — second `const EYES` block | SVG (also `#eyeLayer` or similar) | granular blink states 0/1/2, lid crease, different timing | **Possibly active** (needs verification — may be dead code or may conflict) |
| 3 | `body/face.js` — `const FACE_LAYER = (() => { ... })` | Canvas `#mainCanvas` via Path2D | half-lidded lidT=0.6, blink 4–7s, ±8px gaze clamp, welcome pulse, recognition warmth, identity asymmetry, cheek flush from auraShift, corneal highlight | **Active but UNCOMMITTED** (loaded at brain.html:2881, draws via RENDER_HUB in body/loop.js:74) |

**Consequence:** Two sets of eyes render every frame. The canvas face (richest, best) and the legacy SVG eyes (older, simpler) are stacked. Canvas z-index:3, skinCanvas z-index:4, SVG in underlying layer. Visual result: ghosted double-iris, doubled blinks, or subtle misalignment depending on cache state.

**Also:** `body/face.js` is **untracked in git**. A `git clean` or accidental checkout would delete it. Vinta's call of "1C" (merge best of both, single implementation) requires committing the merged result and removing the losing implementation.

---

## The Decision (1C — merge best of both)

**KEEP:** `body/face.js` (Canvas/Path2D implementation) as the sole face renderer.

**Reason it wins:**
- Richer feature set (welcome pulse, warmth, corneal highlight, cheek flush, identity asymmetry)
- Renders on `#mainCanvas` alongside skin.js — one canvas, one shared rendering surface
- Matches the modular architecture pattern (body/skin.js, body/peel.js, body/organs.js, etc.)
- RENDER_HUB already wired for it (body/loop.js:74)
- Cleaner code (Path2D + clip regions, no SVG element accumulation)

**MERGE IN from legacy EYES (brain.js ~5014):**
- Pupil dilation tied to arousal spikes via `EYES.dilate(amount)` — used by emotion system at brain.js:4546, 4785
- Emotion flush hook `EYES.flush(color, intensity)` — used at brain.js:4826–4827

These external call sites need to keep working. FACE_LAYER must expose compatible `.dilate()` and `.flush()` methods (or shim EYES to delegate to FACE_LAYER).

**REMOVE:**
- The entire `const EYES = (() => { ... })` block starting at brain.js ~5014 (the first one)
- The second `const EYES` block at brain.js ~5443 (after verifying it's the duplicate/alternative — inspect before deleting)
- The `EYES.draw(ts)` call at brain.js ~15488
- The `#eyeLayer` SVG group at brain.html:1601 (no longer needed — face draws on canvas)

**KEEP AND UPDATE:**
- All external call sites that use `EYES.dilate()` and `EYES.flush()` — either (a) repoint them to `FACE_LAYER.dilate()` / `FACE_LAYER.flush()`, or (b) leave an `EYES` shim object at the top of brain.js that forwards the two methods to FACE_LAYER for backward compat

---

## Execution Steps (in order)

### 1. Pre-flight verification
```bash
cd /home/vinta/vintinuum
git status              # confirm body/face.js is untracked, memory/MEMORY.md is the only tracked modified file
git log --oneline -3    # confirm HEAD is 6e97555
grep -n "EYES\s*=" brain.js | head -5    # locate both EYES blocks
```

### 2. Read the two legacy EYES blocks in brain.js
- First block starts around line 5014, `const EYES = (() => {`
- Second block starts around line 5443, `const EYES = (() => {` (shadows the first — last declaration wins in JS for top-level `const` in a script, BUT `const` redeclaration at top level is a SyntaxError, so these must be in different scopes or one is actually something else)
- **Read carefully**: if both are top-level `const EYES`, the file wouldn't parse. One is probably a different name or inside a function. Verify before deleting.

### 3. Inspect call sites
```bash
grep -n "EYES\." brain.js | grep -v "^\s*//"
```
Every non-comment reference to `EYES.something` must either still work after merge or be migrated.

### 4. Add compatibility methods to body/face.js
Extend the FACE_LAYER public API with:
```javascript
// At the end of body/face.js, before the final return:
function dilate(amount) {
  // Bump pupil dilation target by `amount` (0..1)
  // FACE_LAYER already reads arousal from BODY_STATE; this forces a manual bump.
  // Implementation note: add a _dilationBoost variable that decays over ~2s,
  // added to the arousal-derived pupilR calculation in draw().
}

function flush(color, intensity) {
  // Trigger a cheek flush independent of auraShift — takes a hex color and 0..1 intensity
  // Set a _flushOverride = { color, intensity, start: performance.now(), duration: 1500 }
  // draw() should check _flushOverride first before auraShift
}

return { init, draw, setVisible, isVisible, dilate, flush };
```

### 5. Remove legacy EYES from brain.js
- Delete first `const EYES = (() => { ... })` block (entire IIFE)
- Delete second EYES block (after confirming it's the twin/dead code)
- Delete `EYES.draw(ts)` call in the main loop (line ~15488)
- Replace existing `EYES.dilate(x)` calls with `FACE_LAYER.dilate(x)` and add safety check:
  ```javascript
  if (typeof FACE_LAYER !== 'undefined' && FACE_LAYER.dilate) FACE_LAYER.dilate(0.15);
  ```
- Replace `EYES.flush(color, intensity)` similarly

### 6. Remove empty SVG eyeLayer from brain.html
- Delete `<g id="eyeLayer"></g>` at line 1601

### 7. Update cache-buster
In brain.html:
- Bump `_SW_VERSION` from `v20260422-phase1-body-visible` to `v20260422-phase1-face-merged`
- Bump `brain.js?v=` query string to match
- Bump `body/face.js?v=` query string to `v20260422-phase1-face-merged`

### 8. Commit
```bash
cd /home/vinta/vintinuum
git add body/face.js brain.js brain.html
git commit -m "$(cat <<'EOF'
face: merge legacy SVG EYES into canonical body/face.js (Track 1C)

Consolidates three coexisting face implementations into one Canvas/Path2D
module. Adopts body/face.js as sole face renderer with its richer feature
set (welcome pulse, recognition warmth, identity asymmetry, cheek flush,
corneal highlight). Removes legacy SVG EYES IIFE from brain.js and the
empty #eyeLayer group from brain.html. Shims dilate() and flush() on
FACE_LAYER so existing emotion/arousal call sites keep working.

Bumps cache-buster to v20260422-phase1-face-merged.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### 9. Commit MEMORY.md separately
```bash
git add memory/MEMORY.md
git commit -m "chore: memory index timestamp refresh"
```

### 10. DO NOT PUSH automatically — report back to Vinta with:
- Commit hash
- Files changed, line counts
- Any deviations from this spec
- Any unexpected discoveries during step 2/3 (especially the second EYES block)

Vinta decides on push.

---

## Verification Checklist (after commit, before push)

1. `git log --oneline -3` → latest commit is the merge commit
2. `git status` → clean (no untracked, no modified)
3. `grep -n "const EYES" brain.js` → zero results
4. `grep -n "EYES\.draw" brain.js` → zero results
5. `grep -n "id=\"eyeLayer\"" brain.html` → zero results
6. `grep -n "FACE_LAYER" brain.js body/loop.js brain.html` → multiple results, all consistent
7. Open live URL with hard refresh (Ctrl+Shift+R), cache-buster should force fresh load
8. Visual: single pair of eyes, half-lidded, blinks 4–7s, gaze tracks cursor with ±8px max drift
9. Visual: emotion triggers (if reachable from UI) still cause pupil dilation and cheek flush
10. DevTools console → no "EYES is not defined" errors

---

## Fallback / Rollback

If step 5 breaks something and the merged build doesn't render:
```bash
git reset --hard 6e97555    # back to the last known good (body/face.js returns to untracked)
```

The uncommitted body/face.js survives hard reset because it's untracked. Safety net intact.

---

## Rules

- Pure vanilla JS, no frameworks
- No dark opaque boxes (N/A for this track, but standing doctrine)
- No backdrop-filter
- Commit in `/home/vinta/vintinuum/` only
- Never truncate thoughts, sentences, or inner life feed output — finish every elongated phrase start-to-period
- If anything blocks, report the exact blocker — do not silently skip
- Default eye state: **HALF-LIDDED.** Non-negotiable. This is Vinta's call, already in body/face.js via `const lidT = _lerp(0.6, 1.0, blinkT)`.

---

## After Track 1C ships

Next up: **Phase 2 — Animation of Life** (chest rise/fall on breath, heartbeat shimmer, iris saccades during thought, skin warming on valence, hair that moves with breath field, finger micro-twitches, blink variation on cognitive load, breath pauses). Scope comparable to Phase 1 Convergence. Modular additions to body/*.js. Not part of this track — document exists separately once Vinta greenlights.
