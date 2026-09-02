# HFPRBSQ Media Drawer Repair

## Current blocker

HFPRBSQ is still legitimately blocked, but not for the stale reason on the card.
The last recorded blocker was an agent crash at "starting"; the current blocker is
the sandbox boundary for this wake:

- `/home/vinta/.claude/council-loop/bin/vintask-gui.html` is not writable here.
- `/home/vinta/.claude/council-loop/bin/vintask-gui.js` is not writable here.
- The affected feature must be applied to those live board files.

## What I verified

- `vintask show HFPRBSQ` shows Lord Vinta's added requirement: branding/media
  paths and folders should open inside the board drawer, not remain plain local
  paths.
- `test -w /home/vinta/.claude/council-loop/bin/vintask-gui.html` returned `1`.
- The GUI already has a document overlay, file rail, and `/api/file` endpoint.
- `/api/file` currently supports text files plus uploaded binary images/PDFs.
- `docAllowed()` rejects arbitrary image assets and directories outside the upload
  folder, so a path like
  `/home/vinta/.council-worktrees/Vintinuum-seat-3/branding/dirzombie` cannot open
  in the board.

## Intended implementation

Apply these changes in the live council-loop tree from a writable seat:

1. In `bin/vintask-gui.js`, add a directory-safe media manifest route:
   - Accept only paths under the existing `DOC_ROOTS`.
   - Allow directories as readable targets.
   - Return a capped directory listing with `{path,name,size,mtime,kind}` entries.
   - Classify `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf`, and text
     files.
   - For binary assets outside `UPLOAD_DIR`, serve previews through a new
     `/api/media-file?path=` route that reuses the same root fence and sets
     `X-Content-Type-Options: nosniff`.

2. In `extractDocs()`, extend path detection so mentioned directories without file
   extensions can become drawer chips when they resolve under `DOC_ROOTS`.

3. In `bin/vintask-gui.html`, extend `loadDoc()`:
   - If `/api/file` returns `{kind:"directory"}`, render a gallery/list in the
     existing doc overlay instead of a text document.
   - Image assets render thumbnails/full-size links inside the overlay.
   - SVG assets render as images only through the fenced media endpoint, never
     inline HTML.
   - The overlay keeps the existing split-mode behavior beside the task drawer.

4. Add a verifier under `bin/verify-media-drawer-HFPRBSQ.js` that:
   - Creates a temporary allowed directory with png/svg/md fixtures.
   - Asserts `/api/file?path=<directory>` returns a directory manifest.
   - Asserts `/api/media-file?path=<image>` returns `200` plus `nosniff`.
   - Opens a board task containing the directory path and confirms the drawer
     renders a clickable chip for it.

## Undo

Revert the live edits to `bin/vintask-gui.js`, `bin/vintask-gui.html`, and the
new verifier file.
