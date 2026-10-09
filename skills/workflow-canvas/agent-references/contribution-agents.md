# Contributing — workflow-canvas

Read this only when changing files in `workflow-canvas/`. Read the whole folder first.

## Rules

- Keep template pieces **reusable**. `design-qa-canvas` has its own template built from the same components (cards, side pane, comments, settings, server). When you improve a shared piece here, keep it generic and bring the same change to `design-qa-canvas/template/` so both canvases stay alike. Flow-only pieces (layout, arrows, compare) stay here.
- Ship each change to all three places in one pass: this skill, the live workflow canvases in use, and the published repo (`grandhimanshu/skills-public`, `skills/workflow-canvas/`). Restart a live server only when `server.mjs` changed, and tell the user first.
- Test in a real browser (pattern in `design-qa-canvas/agent-references/ui.md`) on a scratch copy of a flow, never on the user's live data, before saying a change works.
- Read a whole file before editing it; prefer targeted edits. Back up a canvas folder before changing its data format.
- Ask the user before renaming or moving anything, changing how deleting a step reconnects or splits a flow, changing what only the user may do (resolve, restore, purge), or deleting anything.
- Don't silently change behaviour the user tuned. If `SKILL.md` states it, treat it as decided.
- Keep `SKILL.md` short: depth goes in `agent-references/`.

## File map

| File | Role |
|---|---|
| `SKILL.md` | How to run a flow canvas; `flows.json`; updating a step's screenshot |
| `agent-references/contribution-agents.md` | This file |
| `template/` | The canvas: `build.py` (flow mode when the data has `steps`), `body.html`, `styles.css`, `canvas.js`, `server.mjs`, `flows.example.json` |
