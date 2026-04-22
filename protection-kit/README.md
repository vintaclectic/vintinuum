# Circle Protection Kit

A zero-dependency toolkit for safely using external LLMs (ChatGPT, Codex, others) without leaking project-specific architecture, names, or structure.

## Why This Exists

External LLMs are powerful coding tools. This kit lets you keep using them — fully, productively — while keeping project specifics private. It does not block you from any tool. It does not judge workflow choices. It just automates the discipline of not pasting sensitive identifiers into an external model.

**The rhythm:**

1. Sanitize before you paste
2. Paste into the LLM, get an answer
3. Restore the answer back to your real identifiers
4. Apply to your real codebase

The model sees a generic project. You get full coding help. Nothing specific crosses the boundary.

## Install

There is no install. This is a folder of files. Copy it anywhere you can run Node.js.

Minimum: Node 14 or higher. No npm packages. No dependencies.

## Setup

1. Open `circle-translator.md` and read the pre-filled example mappings
2. Open `mapping.json` and edit the mappings list — add your own real-term → generic-term pairs
3. Save

## Daily Workflow

**Sanitize code before pasting into an external LLM:**

```bash
# Linux / macOS
cat mycode.js | node sanitizer.js | xclip -selection clipboard

# macOS (alternative)
cat mycode.js | node sanitizer.js | pbcopy

# Windows (PowerShell)
Get-Content mycode.js | node sanitizer.js | Set-Clipboard

# Or just write to a file:
node sanitizer.js --from mycode.js --to safe.js
```

Then paste the safe version into ChatGPT.

**Restore the LLM's response:**

```bash
# Linux / macOS
xclip -o -selection clipboard | node restorer.js > patched.js

# macOS
pbpaste | node restorer.js > patched.js

# Windows (PowerShell)
Get-Clipboard | node restorer.js | Out-File patched.js

# Or from a file:
node restorer.js --from gpt-response.js --to patched.js
```

Apply `patched.js` to your real codebase.

## The Four Discipline Rules

1. Never paste real project names into an external LLM — ever
2. Always run sanitizer before pasting
3. Always run restorer on responses before applying to real code
4. Consult `question-shapes.md` before asking architectural questions

## Troubleshooting

- **Sanitizer not replacing a term:** add it to `mapping.json`
- **Restorer missing a term:** the LLM may have transformed the generic name. Add an alias entry for the transformed form in `mapping.json`
- **Comments leaking sensitive words:** the sanitizer strips common project-comment patterns automatically. Add more patterns in `sanitizer.js` if needed
- **Performance slow on large files:** the sanitizer processes linearly; files over 100k lines may take a moment. Run once per chunk

## Files

- `README.md` — this file
- `circle-translator.md` — plain-English mapping reference (for humans to read and edit)
- `mapping.json` — machine-readable mapping table (used by sanitizer and restorer)
- `sanitizer.js` — pre-paste cleaner
- `restorer.js` — post-copy translator
- `question-shapes.md` — how to ask coding questions without leaking architecture
