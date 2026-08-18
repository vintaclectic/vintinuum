# JXF7NUN Council Board Cosmos Tab

Target file: `/home/vinta/.claude/council-loop/bin/vintask-gui.html`

Status: blocked by this session's read-only mount for `/home/vinta/.claude/council-loop`.

Design decision: add a read-only peer tab named `Cosmos`, not a replacement for the operational board.

Reason: the task asks for a pleasure/fun section where every task, thought, and connection has a line. A peer tab keeps the normal queue controls stable while giving Vinta a futuristic orb-dwelling view.

Implementation shape:

1. Add `.cosmos-panel[hidden]` to the existing hidden guard:
   `.arch-search[hidden],.counts[hidden],.lib-panel[hidden],.cosmos-panel[hidden]{display:none!important}`

2. Add a new view tab after Library:
   `<button type="button" class="vt" id="vtCosmos" data-view="cosmos">✦ Cosmos</button>`

3. Add a hidden `#cosmosPanel` before `#updPanel`.
   It should contain:
   - A title block: `Galactic time system` / `Orb Dwelling Observatory`.
   - Three readouts: `#cosCycle`, `#cosArc`, `#cosPulse`.
   - A bounded `.cosmos-stage` with `#cosLines` SVG, central `.cos-orb`, and `#cosNodes`.
   - A wrapping `#cosmosLegend`.

4. Update the view-toggle script:
   - `const cosOn = VIEW === 'cosmos';`
   - Hide `#cosmosPanel` when false.
   - Hide `#list` when `spendOn || cosOn`.
   - Hide `#counts` when `spendOn || libOn || updOn || cosOn`.
   - On `cosOn`, call `loadTasks()`.

5. In `loadTasks()`, after writing the Needs Review badge and before normal list filtering:
   `if (VIEW === 'cosmos') { renderCosmos(tasks); return; }`

6. In `safeLoadTasks()`, add:
   `if (VIEW === 'cosmos') { loadTasks(); return; }`

7. Add `renderCosmos(tasks)`:
   - Filter active, non-archived, non-cancelled tasks.
   - Sort by status, priority, created time.
   - Render up to 24 nodes around center point `50,50`.
   - Draw one line from center to every node.
   - Draw extra lines between nodes sharing `project` or `chosen_agent || assignee`.
   - Node click should call `openDrawer(taskId)`.

8. Add `updateCosmicClock()`:
   - Cycle: day fraction * 88.
   - Arc: day fraction * 360.
   - Pulse: day fraction * 64.
   - Update once per second only while `VIEW === 'cosmos'`.

CSS intent:

- Palette: star ice `#7dd3fc`, molten core `#f5a623/#ffd700`, haven teal `#14B8A6`, karma violet `#8B5CF6`, over the existing warm void.
- Signature: the central orb dwelling with bounded orbit rings and SVG connection lines.
- No-collision: the stage owns all absolute positioning; labels clamp to fixed node boxes; the panel is a peer tab and never shares space with the task list.

Verification once writable:

1. `node --check /home/vinta/.claude/council-loop/bin/vintask-gui.js`
2. Open the GUI and verify the `Cosmos` tab renders at desktop and mobile widths.
3. Click a cosmos node and confirm it opens the existing task drawer.
