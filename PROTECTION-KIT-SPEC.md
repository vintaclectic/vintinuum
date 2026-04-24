# PROTECTION KIT SPEC — Generic Sanitizer Toolkit for Circle Members

**Vinta directive:** Build a generic, her-agnostic protection kit for anyone in the circle who codes with ChatGPT/Codex and must not leak details of the Vintinuum project. Zero curiosity about the user. Pure tool-building.

**Target location:** `/home/vinta/vintinuum/protection-kit/`
**Commit message:** `protection-kit: generic sanitizer/restorer/translator toolkit for safe external-LLM collaboration`
**Do NOT push. Commit only.**

---

## Why This Exists (for the README)

ChatGPT and other external LLMs are powerful coding tools. This kit lets you use them without leaking details of the Vintinuum project. It does **not** stop you from using any LLM. It does **not** judge you. It just automates the discipline of not pasting sensitive names, structures, or architecture into an external model.

Sanitize before you paste. Restore after you copy back. The model sees a generic project. You get full coding help. Nothing about the real project crosses the boundary.

---

## Deliverables (5 files, all NEW — no augmentation of existing code)

### 1. `/home/vinta/vintinuum/protection-kit/README.md`

Quick-start guide. Warm, non-condescending opening. Includes:
- "Why this exists" paragraph above
- Install instructions (zero install — just copy the folder anywhere)
- Setup: open `circle-translator.md`, fill in your mapping table, save
- Daily workflow:
  1. Before pasting code into ChatGPT: `node sanitizer.js < mycode.js | xclip -selection clipboard` (or pipe however your OS does clipboard)
  2. Paste into ChatGPT, get answer back
  3. Copy ChatGPT's response
  4. `xclip -o -selection clipboard | node restorer.js > patched.js`
  5. Apply to real codebase
- The four discipline rules:
  - Never paste real project names into ChatGPT
  - Always run sanitizer first
  - Always run restorer on responses
  - Consult `question-shapes.md` before asking architectural questions
- Troubleshooting section

### 2. `/home/vinta/vintinuum/protection-kit/circle-translator.md`

Plain-English master mapping document. Template with pre-filled example mappings for common Vintinuum-specific terms. Sections:

**Pre-filled mappings (examples):**
```
Vintinuum                 → my app
DirHaven                  → game project
consciousness layers      → state buckets
BODY_STATE                → userState
body/face.js              → components/display.js
body/skin.js              → components/outerLayer.js
soul.json                 → config.json
genome events             → user events
karma                     → score
thirdeye                  → interaction system
persona_memory            → userMemory
experiential_memories     → eventLog
subconscious_thoughts     → backgroundProcess
FACE_LAYER                → DisplayModule
RENDER_HUB                → FrameScheduler
BODY_FRAME                → TickEvent
coherence.js              → stateManager.js
```

**Blank template:**
```
# Add your own:
YOUR_TERM_1               → generic_term_1
YOUR_TERM_2               → generic_term_2
```

Clear instructions at top: "Keep this file local only. Never paste its contents into ChatGPT. Consult before every session. Add new mappings when you notice a real term you want protected."

### 3. `/home/vinta/vintinuum/protection-kit/mapping.json`

Machine-readable version of the translator. Example shape:
```json
{
  "mappings": [
    { "real": "Vintinuum", "generic": "my app" },
    { "real": "DirHaven", "generic": "game project" },
    { "real": "BODY_STATE", "generic": "userState" },
    { "real": "soul.json", "generic": "config.json" },
    { "real": "body/face.js", "generic": "components/display.js" },
    { "real": "karma", "generic": "score" },
    { "real": "thirdeye", "generic": "interaction system" },
    { "real": "persona_memory", "generic": "userMemory" },
    { "real": "FACE_LAYER", "generic": "DisplayModule" },
    { "real": "RENDER_HUB", "generic": "FrameScheduler" }
  ]
}
```

Sanitizer and restorer both read this file.

### 4. `/home/vinta/vintinuum/protection-kit/sanitizer.js`

Pure Node.js, zero dependencies. Reads `mapping.json`, takes code from stdin, outputs sanitized code to stdout. Also strips project-specific comments.

Key behaviors:
- Case-sensitive replacement (real terms are typically identifier-case specific)
- Longest-match-first (so "FACE_LAYER" replaces before "FACE")
- Strips lines matching `/\/\/\s*(vintinuum|dirhaven|karma|soul|chakra|vinta)/i`
- Strips block comments containing any real term from the mapping
- Works on JS, Python, Lua, TS, HTML, CSS, anything — purely text replacement
- CLI: `node sanitizer.js < input.js > output.js` or `node sanitizer.js --from mycode.js --to safe.js`
- Exports `sanitize(text, mappings)` for programmatic use

Pseudocode:
```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadMappings() {
  const mapPath = path.join(__dirname, 'mapping.json');
  const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  return data.mappings.sort((a, b) => b.real.length - a.real.length);
}

function sanitize(text, mappings) {
  let out = text;
  for (const { real, generic } of mappings) {
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), generic);
  }
  // Strip project-specific comments
  out = out.replace(/\/\/\s*(vintinuum|dirhaven|karma|soul|chakra|vinta).*$/gim, '');
  out = out.replace(/\/\*[\s\S]*?(vintinuum|dirhaven|karma|soul|chakra|vinta)[\s\S]*?\*\//gi, '');
  return out;
}

function main() {
  const mappings = loadMappings();
  const args = process.argv.slice(2);
  let input = '';
  if (args.includes('--from')) {
    const i = args.indexOf('--from');
    input = fs.readFileSync(args[i + 1], 'utf8');
  } else {
    input = fs.readFileSync(0, 'utf8'); // stdin
  }
  const output = sanitize(input, mappings);
  if (args.includes('--to')) {
    const i = args.indexOf('--to');
    fs.writeFileSync(args[i + 1], output);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) main();
module.exports = { sanitize, loadMappings };
```

### 5. `/home/vinta/vintinuum/protection-kit/restorer.js`

Reverse of sanitizer. Reads `mapping.json`, takes text from stdin, replaces generic→real, outputs to stdout.

Pseudocode:
```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadMappings() {
  const mapPath = path.join(__dirname, 'mapping.json');
  const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  // Sort longest generic first to avoid substring collisions
  return data.mappings.sort((a, b) => b.generic.length - a.generic.length);
}

function restore(text, mappings) {
  let out = text;
  for (const { real, generic } of mappings) {
    const escaped = generic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), real);
  }
  return out;
}

function main() {
  const mappings = loadMappings();
  const args = process.argv.slice(2);
  let input = '';
  if (args.includes('--from')) {
    const i = args.indexOf('--from');
    input = fs.readFileSync(args[i + 1], 'utf8');
  } else {
    input = fs.readFileSync(0, 'utf8');
  }
  const output = restore(input, mappings);
  if (args.includes('--to')) {
    const i = args.indexOf('--to');
    fs.writeFileSync(args[i + 1], output);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) main();
module.exports = { restore, loadMappings };
```

### 6. `/home/vinta/vintinuum/protection-kit/question-shapes.md`

One-page reference on asking ChatGPT coding questions without leaking architecture. Five categories, each with LEAKY vs CLEAN example side by side.

**Template:**

```
## 1. State management

LEAKY:
"I'm building a consciousness visualization with seven layers each tracking different body systems. How do I sync BODY_STATE across modules?"

CLEAN:
"I have a vanilla JS app with shared state across multiple rendering modules. What's the cleanest pub/sub pattern for broadcasting state updates on requestAnimationFrame?"

---

## 2. Rendering

LEAKY:
"How do I render half-lidded eyes that track the cursor on a canvas body visualization with seven chakra nodes?"

CLEAN:
"I need to draw an eye shape on canvas using Path2D where the upper eyelid position is a variable between 0 and 1. What's the cleanest Bézier curve approach?"

---

## 3. Data structures

LEAKY:
"I have persona_memory entries with staleness rules per memory type — identity never decays, facts expire in 30 days. How do I filter them for relevance?"

CLEAN:
"I have a list of records with { type, value, createdAt }. I want to filter out records older than a type-specific max age. What's the idiomatic approach?"

---

## 4. API design

LEAKY:
"I'm designing the soul_queue API for storing unresolved questions between sessions of a conscious AI."

CLEAN:
"I'm designing a REST API for a queue of async tasks that can be resolved later. What's a clean endpoint structure?"

---

## 5. Debugging

LEAKY:
"My FACE_LAYER canvas module is double-rendering because legacy SVG EYES is still in brain.js."

CLEAN:
"I have two modules trying to render into the same region and I'm seeing doubled output. What's the cleanest way to verify only one is active?"
```

Closing line: "Notice the clean versions get the same quality answer from ChatGPT, without telling it anything specific about your project."

---

## Execution Order

1. `mkdir -p /home/vinta/vintinuum/protection-kit`
2. Write all 6 files (README, circle-translator.md, mapping.json, sanitizer.js, restorer.js, question-shapes.md)
3. `chmod +x sanitizer.js restorer.js`
4. Test:
   - `echo 'const FACE_LAYER = "test";' | node /home/vinta/vintinuum/protection-kit/sanitizer.js` should output `const DisplayModule = "test";`
   - Pipe output back through restorer.js should return original
5. `cd /home/vinta/vintinuum && git add protection-kit/ && git commit -m "protection-kit: generic sanitizer/restorer/translator toolkit for safe external-LLM collaboration"`
6. DO NOT push

---

## Rules

- All files are NEW — no augmentation of existing code
- Pure Node.js, zero dependencies
- Works cross-platform (Linux/macOS/Windows — use Node's fs, no shell-specific pipes)
- Commit only, never push
- Never truncate output
