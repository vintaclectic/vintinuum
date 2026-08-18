# 9A85T9G DirRM Board Handoff

The live Council Task Board files are under `/home/vinta/.claude/council-loop/bin`, which this Codex sandbox can read but cannot write. Direct writes fail with `Read-only file system`.

Ready patch:

`/home/vinta/vintinuum/docs/9A85T9G-dirrm-task-board.patch`

What it adds:

- Whitelisted board-server routes for `/dirrm-launch.js` and `/dirrm-player.html`, served from the canonical `/home/vinta/vintinuum` DirRM files.
- A normal-flow `DirRM Player` card inside the task board with URL, title, media type, `main/mini/pip/theater` mode controls, play/reload/window/close actions, and an embedded player slot.
- Client logic that uses `window.dirrmLaunch.open()` and the returned handle (`load`, `setMode`, `close`, events), with no raw `<video>` or `<audio>` and no second player implementation.

Decision:

DECISION: Put the media desk in the board's left work rail rather than as another queue tab, because listening/watching while working should remain available across Active, Review, Archive, Library, Updates, Spend, and Roster views.

Undo:

Revert the patch or remove the `DIRRM_ROUTES`, `.dirrm-*` styles, `DirRM Player` card, `/dirrm-launch.js` script tag, and `DIRRM_DESK` client block.

Verification after applying:

1. `node --check /home/vinta/.claude/council-loop/bin/vintask-gui.js`
2. Open `http://localhost:8799/`.
3. Confirm DevTools network returns `200` for `/dirrm-launch.js` and `/dirrm-player.html`.
4. Paste a direct media or YouTube URL, press `Play here`, switch `PIP`, `Mini`, `Main`, and `Theater`, then close.
