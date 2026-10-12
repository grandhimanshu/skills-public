---
name: workflow-canvas
description: Lay out a product flow as screenshots joined by labelled arrows on a pan/zoom canvas, where the user leaves comments as tasks for Claude, marks steps read, deletes steps (the flow reconnects itself). Use when the user wants to map, review or document a user journey or workflow from screenshots, or says "workflow canvas", "flow canvas", "map this flow", "workflow board". Has its own template (same building blocks as design-qa-canvas) — copy it, never rebuild the UI. Also runs its review loop: watching the user's comments and new screenshots ("watch comments", "pick up screenshots"). Default port 4300.
---

# workflow-canvas

Built from the same components as **design-qa-canvas**, in **flow mode**: each card is a **step** (one screenshot), and arrows join steps left → right. Comments, the To-dos, priorities, the unread dot, Settings, Undo and the offline queue all work the same. The difference is the data file: `flows.json` with `steps` and `edges` instead of `issues`.

**Start both watchers whenever the canvas runs:** `watch-comments.py <port>` and `watch-inbox.py <port>`, each under its own Monitor. The canvas shows an amber warning while either one is off.

The review loop is part of this skill: **`agent-references/comment-watcher.md`** (every comment is a task) and **`agent-references/screenshot-watcher.md`** (the user's Desktop screenshots become steps, see below).

## Start

**Existing canvas on an older template?** Before working on it, update it to the latest template: copy `canvas.js`, `styles.css`, `body.html`, `build.py` and `server.mjs` from this skill's `template/` over the old ones (back the old ones up first). Keep its data files (`issues.json`/`flows.json`, `canvas-*.json`, screenshots). Then `node --check canvas.js`, rebuild, and restart its server.

```bash
cp -R ~/.claude/skills/workflow-canvas/template <project>/<folder>
cd <project>/<folder> && mv flows.example.json flows.json
python3 build.py flows.json canvas.html
nohup node server.mjs 4300 > server.log 2>&1 &     # http://localhost:4300
```

Rebuild after every `flows.json` change; the open page waits until the user stops typing, then reloads.

## `flows.json`

```json
{ "title": "Order journey", "port": 4300,
  "flows": { "start": "Create an order" },               // optional: name a flow by its first step
  "steps": [ { "id": "start", "title": "Open New order", "note": "• The ✏️ goes next to Patient, on open orders only.<br>• A closed order shows no pencil.", "img": "shots/s1.png" },
             { "id": "form",  "title": "Fill the form", "img": "shots/s2.png", "prev": { "img": "shots/s2-old.png", "label": "Oct 6" } } ],
  "edges": [ ["start", "form", "click New order"] ] }
```

- **Steps:** `id` is stable and used by comments, so never change it. Numbers (`n`) are assigned once and never reused.
- **Titles are the presenting cues.** The user presents from the canvas, and viewers read the titles, not the notes. Make each title say what happens on that screen in a few words ("Save waits for reason + tick", "Fails again: banner is back"), so a viewer gets the step from the title alone. The note is only for the detail a viewer needs when asked; many steps need one bullet or none.
- **Notes:** write each note as the handoff a developer gets: short, plain bullets (`• …`, joined with `<br>`: notes are HTML, so a newline collapses), about what the user sees and the rule behind it.
  - Say it the way you'd tell a teammate: "Save stays disabled until a field has changed, a reason is chosen and the box is ticked."
  - No change logs ("CHANGED …", "NEW …"), dates, file paths, component names or reasoning about the decision. The previous screenshot (`prev`) already records that something changed.
  - Quote on-screen copy exactly, in quotes.
- **Edges:** `[from, to, label?]`.
  - Labels sit horizontally on the arrow, in small text. **Keep labels short, about 30 characters**: the action that moves the user on ("click Save", "invalid input"). Longer labels wrap only when they don't fit between the two screens.
  - Branches: give a step several outgoing edges. Steps at the same depth stack in one column.
- **Flows** are the connected groups of steps, laid out top to bottom in the order of their first step.

- **Laying out or reorganising flows:** read `agent-references/layout.md` (keep flows linear; a default, not a hard rule).

## Deploying (optional)
Only when the user asks to deploy or publish, or to set up the toolbar links: read `agent-references/deploy.md`.

## What the user can do (don't re-implement)

- **Delete a step** (on hover, or ⋯ → Delete). Undo appears bottom-right.
  - A middle step's neighbours reconnect (A → B → C becomes A → C).
  - Deleting a flow's first step splits the flow: its next steps become starts.
  - Deleted steps wait in the Deleted tab until the user confirms.
- **New tab** (there is no Issues tab): steps the user hasn't seen, **including steps whose screenshot changed**. Read state is per screenshot version.
- **0** zooms to the step nearest the cursor; **0** again shows the whole canvas.
- **→** walks one whole path to its end, then the next branch; **←** goes back left along the arrows (on a flow's first step, to the last screen of the previous flow) (never sideways to another branch), and → after ← retraces the same branch; **↑ ↓** step through every card in canvas order. Pressing again within 0.7s switches instantly instead of animating, so you can flip between screens to spot the change. **Space** marks the selected step read and moves on, like →. Leaving a flow's end screen plays a soft red ring on it for 0.3s before moving. **Delete** removes the selected step (the flow reconnects; Undo).
- **Alt** flips a step that has `prev` to its previous screenshot (only those steps; not in the view build).
- Comments, priority H/M/L, double-click editing, Settings (Numbers, Titles, Canvas background, default #F4F4F4), and the Claude-watching line all work as in design-qa-canvas.

## Updating a step's screenshot (keep one previous)

When the screen changes, put the new image in `img` and the old one in `prev` (**one previous only**: `prev` replaces any older one).
- Which screenshot becomes `prev`: the one the user names. Otherwise use the step's screenshot from the last change in the flow.
- If nothing changed visually, leave the step alone. No `prev`, no new version.
- **A sharper copy of the same screen** (higher resolution only): replace `img`, no `prev`. The build sees it looks the same and keeps the step read (`canvas-imgver.json`); don't mark it New.
- **Keep it read when you're sure it needs no review:** if the user already reviewed this exact change (here, or the same change on another step) and you're really confident, keep the new screenshot read: after rebuilding, `comments.sh seen <cid> <img>`. When in doubt, leave it New.
- The step then shows up in **New** for the user.
- Dates in `prev.label`: just the date (`Oct 9`) when it differs from the previous version's. **On the same date, add the time** (`Oct 9, 16:58`), never a counter like `Oct 9 (3rd)`.

## New screenshots from the Desktop (flow mode; see `agent-references/screenshot-watcher.md`)

For each `INBOX IN<n>`:
- Decide whether it is a **new step** (add it to `steps` and connect it with an edge) or an **updated screen** of an existing step (move its old `img` to `prev`).
- Then rebuild and run `comments.sh inbox-done IN<n> <stepId>`.
- If you can't tell where the step goes, add it unconnected and ask in a reply on its comment.

Helper commands are in this skill's `scripts/` (`comments.sh`, `watch-comments.py`, `watch-inbox.py`); UI internals in `agent-references/ui.md`. Before changing this skill, read `agent-references/contribution-agents.md`.

## Backlog (ideas, not built or parked)

- **Viewers flag priority** in a deployed view, for the user to see. Needs a store the deployment can write to.
