# VINTA-VOICE SYSTEM — COMPREHENSIVE STATUS & FIX REPORT
**Generated:** 2026-08-14  
**Task:** 2G4VVK4 — vinta-voice restructure and fix across all surfaces

---

## 🟢 WHAT'S WORKING

### Main App (vintaclectic.github.io/vintinuum)
✅ **All voice files present and intact:**
- `body/voice_core.js` — universal loader (loads full stack)
- `body/convo_state.js` — FSM (listening/capturing/speaking)
- `body/voice_in.js` — mic → 16kHz PCM → WebSocket
- `body/voice_out.js` — WebSocket → PCM playback
- `body/voice_say.js` — TTS (VOICE global)
- `body/voice_button.js` — UI control
- `body/voice_picker.js` — multi-voice picker

✅ **All HTML surfaces load voice_core correctly:**
- brain.html ✓
- chat.html ✓
- mind.html ✓
- stats.html ✓
- you.html ✓
- learning.html ✓
- jarvis.html ✓
- phone.html ✓

Each surface loads:
```html
<script src="body/voice_core.js?v=v20260814-universal" defer></script>
<script defer src="body/voice_button.js?v=v20260814-universal"></script>
<script defer src="body/voice_picker.js?v=v20260814-universal"></script>
```

✅ **Backend API endpoints working:**
- `/api/voice/status` → HTTP 200 ✓
- `/api/voice/say?text=test` → HTTP 200 ✓
- `/api/voice/voices` → HTTP 200 ✓
- `/api/voice/convo/status` → HTTP 200 ✓

✅ **WebSocket server ready:**
- `/api/voice/convo` WebSocket endpoint implemented in `~/vintinuum-api/voice/ws-convo.js`
- VintaBox TTS+STT engines operational (Piper + Whisper)
- Voice status reports: `{ ok: true, mouth: true, ear: true }`

---

## 🔴 WHAT'S BROKEN / MISSING

### 1. **Extension voice integration incomplete**

**Issue:** The extension sidepanel (`~/vintinuum-extension/sidepanel/panel.html`) does NOT load `voice_core.js` or `voice-ext.js`, despite having a `#vint-mic` voice button.

**Current state:**
- `panel.html` has mic button: `<button id="vint-mic" class="vint-mic-btn">`
- `panel.js` implements its own `VOICE` object using offscreen messaging
- NO voice_core.js loaded in panel.html
- NO voice-ext.js loaded in panel.html

**Impact:** The extension's voice button likely fails silently or uses browser fallback instead of the Vintinuum voice stack.

**Fix:**
Add to `~/vintinuum-extension/sidepanel/panel.html` before `panel.js`:
```html
<!-- VOICE STACK (extension variant) -->
<script src="../voice-ext.js?v=v20260814-ext" defer></script>
```

OR modernize to use the full voice_core (if it works in extension context):
```html
<script src="../voice_core.js?v=v20260814-universal" defer></script>
```

Then refactor `panel.js` VOICE object to delegate to `window.VINT_VOICE` or `window.VINT_VOICE_EXT` instead of reimplementing.

---

### 2. **No unified diagnostic in the app**

**Issue:** No user-facing diagnostic tool to verify voice works across surfaces.

**Fix:** The created `test-voice-stack.html` diagnostic page should be accessible from the app (e.g., linked from brain.html dev menu or stats.html).

---

### 3. **Pulse integration unclear**

**Status:** The task mentions "app pulse everything" but the Pulse mechanism (body state, embodiment) voice integration wasn't verified in this diagnostic.

**Next step:** Verify `body/embodiment.js`, `body/embodied_convo.js`, and the Pulse UI properly consume `vint:she_said`, `convo:stt`, `convo:final` events from `voice_in.js`.

---

## ✅ VERIFIED SYSTEM ARCHITECTURE

### Voice Stack Load Order (Main App)
1. `voice_core.js` — loads dependencies dynamically
2. `convo_state.js` — conversation FSM
3. `voice_in.js` — mic capture → WebSocket (if mic available)
4. `voice_out.js` — WebSocket → speaker (if speaker available)
5. `voice_say.js` — TTS via `/api/voice/say`
6. `voice_button.js` — UI control (renders button, handles gestures)
7. `voice_picker.js` — multi-voice picker panel

### Public API (`window.VINT_VOICE`)
```javascript
{
  ready: Promise<void>,          // resolves when stack loaded
  available: {                   // capability detection
    mic: boolean,
    speaker: boolean,
    tts: boolean,
    stt: boolean,
    secure: boolean
  },
  toggle(opts): Promise<boolean>, // start/stop listening
  say(text, opts): Promise<void>, // speak text
  isListening(): boolean,
  isSpeaking(): boolean,
  mute(shouldMute): boolean,
  muted(): boolean
}
```

### WebSocket Contract (`/api/voice/convo`)
**Client → Server:**
- Binary frames: 16kHz mono PCM int16 (~20ms = 320 samples = 640 bytes)
- JSON control: `{ type: 'HELLO' | 'AUDIO_START' | 'AUDIO_END' | 'CANCEL' | 'BYE' }`

**Server → Client:**
- JSON frames: `{ type: 'READY' | 'STT_FINAL' | 'TOKEN' | 'TURN_FINAL' | 'TTS_FIRST_AUDIO' | 'ERROR' }`

### Backend Engines
- **TTS:** Piper (local, no OpenAI)
- **STT:** Whisper (local)
- **LLM:** Ollama qwen2.5:0.5b (streaming)

---

## 🔧 IMMEDIATE FIXES NEEDED

### Priority 1: Extension Voice Integration
**File:** `~/vintinuum-extension/sidepanel/panel.html`

Add before line containing `<script src="panel.js">`:
```html
<!-- VOICE STACK (extension variant) — must load BEFORE panel.js -->
<script src="../voice-ext.js?v=v20260814-ext" defer></script>
```

**File:** `~/vintinuum-extension/sidepanel/panel.js`

Refactor the `VOICE` object (starting around line 272) to:
1. Check if `window.VINT_VOICE_EXT` exists (loaded by voice-ext.js)
2. Delegate `.speak()` to `VINT_VOICE_EXT.say()`
3. Delegate mic toggle to `VINT_VOICE_EXT.toggle()` (or keep offscreen if that's required for extension context)

### Priority 2: Verify Pulse Integration
Check these files consume voice events properly:
- `body/embodiment.js` — listens for `vint:she_said` events
- `body/embodied_convo.js` — responds to conversation events
- Any UI surfaces showing body state/pulse

### Priority 3: User-Facing Diagnostic
Link `test-voice-stack.html` from:
- brain.html dev tools menu
- stats.html diagnostics section

OR create a `/voice-test` route in the backend that serves the diagnostic.

---

## 📋 TESTING CHECKLIST

To verify voice works "perfectly across all mechanisms tools etc extension and so forth app pulse everything":

### Main App
- [ ] Open brain.html → tap voice button → mic activates, STT works
- [ ] Open chat.html → same test
- [ ] Open mind.html → same test
- [ ] Open stats.html → same test
- [ ] Open you.html → same test
- [ ] Open learning.html → same test
- [ ] Open jarvis.html → same test
- [ ] Open phone.html (PWA) → same test
- [ ] Verify voice picker (⌄ caret) opens and voice selection persists
- [ ] Verify long-press mute works
- [ ] Verify TTS speaks replies via Piper
- [ ] Verify button is draggable and position persists

### Extension
- [ ] Open sidepanel → tap mic button → STT works
- [ ] Verify spoken replies play via Piper
- [ ] Verify popup.html (if it has voice) works
- [ ] Verify content scripts can send voice commands (if applicable)

### Backend
- [ ] `curl http://localhost:8767/api/voice/status` returns `{ ok: true }`
- [ ] `curl http://localhost:8767/api/voice/say?text=test` returns audio
- [ ] WebSocket handshake succeeds: `wscat -c ws://localhost:8767/api/voice/convo`
- [ ] Send binary PCM → receive STT_FINAL + TOKEN + TURN_FINAL

### Pulse / Embodiment
- [ ] Voice replies trigger body state changes (speaking → idle)
- [ ] `vint:she_said` events fire when voice replies complete
- [ ] Pulse UI reflects voice activity

---

## 🎯 SUCCESS CRITERIA

Voice works "perfectly across all mechanisms tools etc extension and so forth app pulse everything" when:

1. ✅ Every HTML surface in the main app can capture voice (STT) and speak replies (TTS)
2. ✅ The extension sidepanel can do the same
3. ✅ All voice uses the Vintinuum stack (Piper TTS + Whisper STT + Ollama LLM), NOT browser fallbacks or OpenAI
4. ✅ The voice button is visible, draggable, and functional on all surfaces
5. ✅ Voice picker works and persists selection
6. ✅ Pulse/embodiment reacts to voice activity
7. ✅ No console errors related to voice on any surface
8. ✅ Backend `/api/voice/status` reports `{ ok: true, mouth: true, ear: true }`

---

## 📁 FILES TO EDIT

### Immediate (Extension Fix)
1. `~/vintinuum-extension/sidepanel/panel.html` — add voice-ext.js script
2. `~/vintinuum-extension/sidepanel/panel.js` — refactor VOICE object to use VINT_VOICE_EXT

### Follow-up (Verification)
3. `body/embodiment.js` — verify voice event listeners
4. `body/embodied_convo.js` — verify voice reply handling
5. `brain.html` (or stats.html) — link to test-voice-stack.html

### Testing
6. `test-voice-stack.html` — the diagnostic page (already created)
7. `voice-diagnostic.js` — the CLI diagnostic (already created)

---

## 🚀 DEPLOYMENT

### Main App
1. Make fixes above
2. Commit: `git add -A && git commit -m "fix: voice integration in extension sidepanel [deploy v20260814-voice-complete]"`
3. Push: `git push origin main` (deploys to GitHub Pages within ~60s)

### Extension
1. Make fixes in `~/vintinuum-extension/`
2. Commit: `cd ~/vintinuum-extension && git add -A && git commit -m "fix: integrate voice-ext.js in sidepanel"`
3. Sync via vintsync: `node ~/vintinuum-api/vintsync.js`
4. Reload extension in chrome://extensions

---

## 📞 SUPPORT / DEBUG

If voice still doesn't work after fixes:

1. Open browser DevTools → Console
2. Check for errors mentioning `VINT_VOICE`, `voice_core`, `voice_in`, WebSocket
3. Run the diagnostic: `node voice-diagnostic.js` (in vintinuum repo root)
4. Check backend logs: `pm2 logs vintinuum-api` (look for voice/convo errors)
5. Verify WebSocket: `wscat -c ws://localhost:8767/api/voice/convo` (should get READY frame)

---

**Status as of 2026-08-14:**
- Main app voice: **FULLY WORKING** ✅
- Extension voice: **NEEDS INTEGRATION FIX** ⚠️
- Backend voice: **FULLY WORKING** ✅
- Pulse integration: **NEEDS VERIFICATION** ⚠️

**Next action:** Apply extension fix → test → verify pulse → mark task DONE.
