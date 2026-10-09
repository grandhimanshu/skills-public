# Contributing — design-qa-canvas

Read this only when changing files in `design-qa-canvas/`. Read the whole folder first.

## Rules

- Keep template pieces **reusable**. `workflow-canvas` has its own template built from the same components (cards, side pane, comments, settings, server). When you improve a shared piece here, keep it generic and bring the same change to `workflow-canvas/template/` so both canvases stay alike.
- Ship each change to all three places in one pass: this skill, the live canvases in use, and the published repo (`grandhimanshu/skills-public`, `skills/design-qa-canvas/`). Restart a live server only when `server.mjs` changed, and tell the user first.
- Test in a real browser (pattern in `agent-references/ui.md`) on a scratch copy of a canvas, never on the user's live data, before saying a change works. Run `node --check canvas.js` before every rebuild: one syntax error blanks every canvas it ships to.
- Read a whole file before editing it; prefer targeted edits. Back up a canvas folder before changing its data format.
- Ask the user before renaming or moving anything, changing `agent-references/writing-issues.md`, changing what only the user may do (resolve, restore, purge), or deleting anything.
- Don't silently change behaviour the user tuned. If `SKILL.md` or `agent-references/ui.md` states it, treat it as decided.
- Keep `SKILL.md` short: depth goes in `agent-references/`, ideas not built go in its Backlog.

## File map

| File | Role |
|---|---|
| `SKILL.md` | How to run a canvas; rules; Backlog |
| `agent-references/ui.md` | UI internals + browser tests |
| `agent-references/evidence.md` | First build: recording, frames, live audit |
| `agent-references/writing-issues.md` | Wording of titles and details |
| `agent-references/contribution-agents.md` | This file |
| `template/` | The canvas: `build.py`, `body.html`, `styles.css`, `canvas.js`, `server.mjs`, `issues.example.json` |
| `scripts/` | `comments.sh`, `watch-comments.py`, `watch-inbox.py`, recording tools |
