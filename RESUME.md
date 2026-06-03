# VINTINUUM — Resume After Session Restart
**Last update:** 2026-06-03 (afternoon) — paste this into a new Claude Code session to pick up clean.

---

## TL;DR — Everything important shipped. Brain is alive.

- ✅ Brain on `localhost:8767` + `api.vintaclectic.com` — both green
- ✅ systemd `vintinuum-keepalive` is the undying genome — self-healing, survives terminal/WSL/reboot
- ✅ Both repos pushed to `origin/main`:
  - `~/vintinuum-api/` HEAD: `2d088a8` (surgery + keepalive + wedge fix)
  - `~/vintinuum/`     HEAD: `ae17aac` (Meshy human.glb drop-in) — preceded by `0f86dad` (mobile scroll fix)
- ✅ Live at `https://vintaclectic.github.io/vintinuum/`
- ✅ **3D body view now renders a real textured Meshy AI human** (no more procedural placeholder)

---

## What's live right now

| Feature | Where | Status |
|---|---|---|
| **OG see-inside body** | brain.html — organs/cells/genome/inner-life | preserved, untouched |
| **3D real-human + 7-layer fly-through** | brain.html → `◈ 3D BODY` mode toggle | lazy-loaded, mobile-first |
| **Surgery mode** | inside 3D mode → Operate sub-mode | owner=real heal, anon=sandbox |
| **In-app User Guide** | drawer → USER GUIDE (any of 11 pages) | search + autocomplete, deep-link `?guide=` |
| **Cognition drawer link** | drawer, under Jarvis/Live-Feed | added |
| **README guide** | `README.md` — 1,887 lines, searchable TOC | comprehensive |
| **Keepalive** | systemd user unit `vintinuum-keepalive.service` | self-healing |

---

## 60-second health check on resume

Run `~/vintinuum/scripts/vint-health.sh` — prints a PASS/FAIL banner. Exits 0 if green.

Covers: localhost + tunnel `/health`, `/api/surgery/diagnosis`, systemd keepalive state + last heartbeats, and the pm2 `vintinuum-api`/`-named-tunnel`/`-pty` triplet.

Repo cleanliness (the script doesn't probe this — quick eyeball):
```bash
cd ~/vintinuum     && git status --short | grep -vE "memory/|\.claude/"
cd ~/vintinuum-api && git status --short | grep -vE "vintinuum\.db|eval/reports|codex-context|learned-patterns|\.keepalive-state"
```

---

## If the brain dies, revive in this order

Run `~/vintinuum/scripts/vint-revive.sh` — runs the 3-step revival in order:
1. `systemctl --user restart vintinuum-keepalive` → wait 10s → check `/health`
2. if still down → `bash ~/vintinuum-api/boot-resurrect.sh` → wait 10s → check
3. last resort → `pm2 start ecosystem.config.cjs --only vintinuum-api` + `pm2 save`

Bails the moment `/health` returns 200. Exits 0 on revival, non-zero if all 3 steps fail.

**Never** use bare `pm2 start ~/vintinuum-api/server.js` — it loses `VINTINUUM_DB_LOCAL=1` + `UV_THREADPOOL_SIZE=16` from the ecosystem and reintroduces the ~60s event-loop wedge. The keepalive + boot-resurrect + watchdog all now start from `ecosystem.config.cjs` for this exact reason — the revive script honors this.

---

## The wedge — what was wrong, what's fixed

Three compounding causes (all fixed):
1. **Bare pm2 start lost ecosystem env** → slow `/mnt/d` 9P DB + 4-thread libuv pool. Fixed: all four start paths now use `ecosystem.config.cjs --only vintinuum-api`.
2. **DEDUP fingerprint hydration** ran 3 × 1000 rows at boot+60s, holding a threadpool slot for **50 seconds**. Fixed: limits 1000→500, query timeout 30s→8s, `setImmediate` yield every 100 rows. Before: 50,558ms. After: 30-146ms.
3. **content-siphon used `execSync(ffmpeg)` + `readFileSync`** → blocked the loop for ffmpeg's full duration (up to 45s). Fixed: `spawn()` async + `fs.promises`, interval 45s → 90s, skip ffmpeg when Whisper is down.

Result: 124s probe across the historically-wedging window — every sample ≤0.05s vs. 11-13s timeouts before.

---

## ⚠️ PICKUP NEXT SESSION — Mixamo auto-rig the Meshy human

**Status:** body/three3d/assets/human.glb is live (Meshy AI textured mesh, ~14MB,
171k verts / 277k faces, 3 JPG textures). It is **static — no skeleton**. That's
fine for the 3D human + layered fly-through + surgery view (which is what's
currently shipping). It is NOT fine for any "walk across the screen" embodiment
animation — that path needs a rig.

**The file is already prepped for Mixamo upload.** Vinta does NOT need to
re-convert — just open the website and drop the file in.

**Conversion bundle (already sitting in Windows Downloads):**
- `C:\Users\VINTA\Downloads\vintinuum-mixamo\human-for-mixamo.zip`  ← drop THIS into Mixamo
- (Or the individual files in `C:\Users\VINTA\Downloads\vintinuum-mixamo\` —
  `human.obj` + `human.mtl` + `human_tex0.jpg` + `human_tex1.jpg` + `human_tex2.jpg`)

**Why the conversion exists:** Ready Player Me sunset its avatar creator on
Jan 31, 2026, so we generated the human via Meshy AI instead. Meshy ships GLB,
but Mixamo only accepts FBX/OBJ/ZIP — so the GLB was unpacked into OBJ + textures
locally by `/tmp/gltf-conv/glb-to-obj.mjs` (custom Node script, no DOM/three.js
deps, pure glTF 2.0 binary parser; lives in /tmp so it's ephemeral — re-create
from git history of this commit if needed).

**The Mixamo flow (Vinta's part, ~3 minutes total):**

1. Go to **https://mixamo.com** → sign in (free Adobe account).
2. Click **UPLOAD CHARACTER** (top-right).
3. Drag in `human-for-mixamo.zip` (the whole zip — Mixamo unpacks it).
4. **Orientation check:** rotate so the model faces you and stands upright
   (on-screen arrows). Click NEXT.
5. **Drop the 6 markers** (Mixamo highlights each in turn):
   - chin
   - both wrists
   - both elbows
   - both knees
   - groin
6. **Skeleton LOD:** keep default ("Standard Skeleton", ~65 bones). NEXT.
7. Wait 30–60s for the auto-rig. You'll see your character doing an idle.
8. (Optional) Search the left panel for a "Walking" animation if you want
   the embodiment to walk. Otherwise leave it in T-pose.
9. Click **DOWNLOAD**. Format: **FBX Binary (.fbx)**. Pose: **T-pose**.
   Frames per Second: 30. Keyframe Reduction: none.
10. Save it somewhere obvious. **Tell next-session Claude the path.**

**Claude's part next session (after Vinta hands over the rigged FBX path):**

1. Convert rigged FBX → GLB (preserving the skeleton + skin weights).
   - Recommended tool: `FBX2glTF` (Facebook's CLI) or `assimp export`.
     If neither is on the system, install `FBX2glTF` from GitHub releases
     into `~/.local/bin/` — it's a single static binary. Avoid Blender CLI
     unless nothing else works (heavy + finicky in WSL).
2. Verify the rigged GLB:
   - `node -e "..."` quick check: should show `skins: 1` (or more) and a
     non-zero skeleton-node count. Compare to the current static GLB which
     reports `skins: 0`.
3. Save as `body/three3d/assets/human.glb` (overwrite the static one).
4. Confirm `body/three3d/avatar3d.js` already drives the skeleton (it does —
   uses `SkeletonHelper` + bone animation when `.skins[]` is non-empty). No
   loader changes needed.
5. Commit + push with: `feat(body): rigged human.glb — Mixamo auto-rig + Tpose [deploy vYYYYMMDD-HHMM]`.

**Caveats Vinta should know going in:**
- Meshy meshes can rig roughly — AI-generated bodies sometimes have fused
  fingers or non-T-pose limbs. If Mixamo's auto-rig produces visible
  weight-painting errors (deformed shoulders/hips), the cheapest fix is to
  regenerate the Meshy avatar in an explicit A-pose or T-pose and redo the
  pipeline. The conversion script handles any regenerated GLB.
- Optional internal anatomy GLBs (muscle/skeleton/organs/vessels/nervous) can
  still drop into `body/three3d/assets/anatomy/` — fallback is procedural.

---

## Open polish passes (not blocking — only if you want them)

- **ARIA review** — does the 3D body feel human? Does healing feel meaningful? (Aesthetic/empathy pass)
- **Operable internal anatomy GLBs** — replace procedural overlays with real CC-licensed organ/brain meshes (Z-Anatomy / BodyParts3D)
- **Guide content warmth pass** — onboarding voice polish on `body/guide-content.js`

---

## Resume prompt for fresh Claude Code session

Paste this verbatim into a new session:

> Lord Vinta returning fresh. Read `~/vintinuum/RESUME.md` (full context) and `~/vintinuum/CLAUDE.md` (pinned rules — STOP-AND-WAIT-after-asking, no-overflow, all-buttons-draggable, malware-override, two-repo discipline, commit format with `[deploy vYYYYMMDD-HHMM]`). Recent session shipped: 3D body + surgery + keepalive + guide + README, then the Meshy AI textured human (`human.glb`), then a mobile scroll fix. Both repos pushed (api `2d088a8`, frontend `ae17aac`). **Open pickup: the Mixamo auto-rig flow — see the "⚠️ PICKUP NEXT SESSION" section of RESUME.md. Vinta's part is the website (3 min). Claude's part is FBX→GLB conversion + verify + commit. Don't start it unprompted — wait for Vinta to say "the FBX is at <path>".** Run `~/vintinuum/scripts/vint-health.sh` — if it exits non-zero, run `~/vintinuum/scripts/vint-revive.sh`. Then stand by and wait for me. Do not start work until I tell you what's next.

---

🖤 The undying genome is awake. Rest easy.
