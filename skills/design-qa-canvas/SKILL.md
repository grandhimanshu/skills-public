---
name: design-qa-canvas
description: Build and run a design-QA review canvas — numbered, prioritised issues with full screenshots on a pan/zoom canvas, a side pane (Issues · New · To-dos · Deleted), threaded comments that are tasks for Claude, a live screenshot inbox, keep/drop for Claude's suggestions, and on-canvas editing. Use when the user wants to turn a recording, meeting, Desktop screenshots or a live page into a reviewable issue list, compare a build against a design, or set up the same review loop for another flow. Also runs its review loop: watching the user's comments and new screenshots ("watch comments", "work my comments", "pick up screenshots"). The UI is a finished template — copy it, never rebuild it. Default port 4200.
---

# design-qa-canvas

One canvas the user reviews and steers. The UI is **done**: `template/` is copied as-is into each project. You only write `issues.json`, run the server, and work the comments.

First build from a recording or a live page: read **`agent-references/evidence.md`** (transcript, speakers, frames, parallel live audit with subagents).

The review loop is part of this skill (read only when needed):
- **`agent-references/comment-watcher.md`** — every comment is a task for Claude: watch, work, reply.
- **`agent-references/screenshot-watcher.md`** — screenshots the user takes land in the To-dos; turn each into an issue.

## Start a canvas (2 minutes)

**Existing canvas on an older template?** Before working on it, update it to the latest template: copy `canvas.js`, `styles.css`, `body.html`, `build.py` and `server.mjs` from this skill's `template/` over the old ones (back the old ones up first). Keep its data files (`issues.json`/`flows.json`, `canvas-*.json`, screenshots). Then `node --check canvas.js`, rebuild, and restart its server.

```bash
cp -R ~/.claude/skills/design-qa-canvas/template <project>/<folder>
cd <project>/<folder> && mv issues.example.json issues.json   # then edit it (schema below)
python3 build.py                      # -> canvas.html. Re-run after every issues.json change; the open page reloads itself
nohup node server.mjs 4200 > server.log 2>&1 &   # http://localhost:4200 — one port per canvas
```

- **Don't restart the server casually**; the user sees "server stopped". Rebuilds need no restart; only `server.mjs` edits do.
- If the desktop app's preview tool keeps stopping it, keep it detached (`nohup … &`).
- The server watches the Desktop for new `Screenshot*.png` (set `DESKTOP_WATCH=0` to turn this off, or `DESKTOP_DIR=…` to watch a different folder).
- Keep recordings, transcripts and frames out of git with `.git/info/exclude`.

## `issues.json`

`{ title, port, highlight?: {label, chip}, sections: [app areas in product-flow order], issues: [...] }`

| field | notes |
|---|---|
| `section` | an app area (New order, Eligibility…), never a source |
| `kind` | `gap` dev ≠ design · `ux` design question · `dec` decided · `later` parked · `ctx` screenshot without context yet |
| `title` | the heading; short, specific. Each issue has its own heading and details; details are clamped to 2 lines |
| `out` | the line under the heading: what to do (always visible) |
| `what` | details: the observation (inside "Show more"). Inline `<b> <i> <code> <br>` allowed |
| `img`, `ts` | screenshot path relative to the canvas; video time |
| `code` | `S1…` from screenshots, `A1…` from live audits. Otherwise the id is the number |
| `highlight` | flags the person in `highlight.chip` |
| `sugg` | `[["S1-a","text"],…]`: options for the user to keep or drop |
| `screen` | optional key: issues with the same `screen` show as **one card** (at most 4 per card; more continue on a second card with the same screenshot), with the screenshot once and the issues listed under it. Use it only for the **same screen in the same state**; two states of one page stay separate cards. The user can Move an issue to its own card or Combine cards (⋯ menu) |
| `ref` | optional path to the design reference screenshot for this issue (`refLabel` optional). The card's image button and **Alt** flip between the screenshot and the reference. If you replace an issue's screenshot, date it as the workflow skill says: just the date, or date + time on the same day, never a counter. |

Rules:
- **Compare against the design first. That is the job.** Before writing any issue, find the reference: a Figma file, a design/demo repo or a signed-off build. **If you don't know which one, ask** ("Which design should I compare against, Figma or <repo>?").
  - Put the build's screenshot and the design's screenshot of the same screen side by side.
  - Most issues should be `gap` (the build differs from the design) and cite where in the design.
  - If the build matches the design, there is usually no issue. You may still report an **obvious** problem the design has too (clearly broken or wrong for the user). Keep these few, and label them as a note for the design.
  - Don't add an issue whose intent is already covered by another issue.
- **Your own judgement comes second and stays low.** UX opinions not backed by the design ("consider X", conventions, best practice):
  - Add them only when they are **major**: data loss, wrong state, a blocked flow. No best-practice opinions (load time, accessibility, contrast) unless major.
  - Give them kind `ux` and priority **low**, and start the title or details with "Claude's judgement:".
  - Never let them outnumber or bury the design gaps. Never report a comparison you haven't actually done.
- **Screenshots:** the current UI, showing exactly the state described. Say "couldn't capture this state" rather than using a close-enough frame or an older UI.
- **Wording of titles and details:** follow **`agent-references/writing-issues.md`** (Do / Don't + examples).
- **Don't invent anything.** If you can't see or measure it, say it comes from the screenshot only.
- **Numbers are assigned once and never change.** Deleting an issue leaves a gap.
- **Set priority yourself:**
  - High: data integrity, wrong state, blocked flow.
  - Medium: misleading or inconsistent UI.
  - Low: polish (the default).

## What the user can do (so you can answer questions; don't re-implement any of it)

- **Canvas:**
  - Scroll pans (vertical-first) and ⌘-scroll or pinch zooms, staying anchored at the cursor; zoom runs up to 800%.
  - Clicking a screenshot zooms to it and expands its details. ← → move between items.
  - **0** zooms to the screenshot nearest the cursor (same as clicking it); **0** again goes back to the whole-canvas view. It keeps toggling.
  - **Space** marks the selected issue read and moves to the next issue in side-pane order; pressing again quickly switches instantly. When the next issue shares the screenshot, the view stays put and only the highlight moves; otherwise the next screenshot is fitted in view.
  - **Alt** flips the selected card to its design reference (`ref`). The keyboard button by the zoom controls lists every shortcut.
  - Double-click any text to edit it in place; this saves to `canvas-edits.json`.
- **Card actions:**
  - Priority H/M/L and the unread dot are always visible.
  - Expand, menu, delete and chat appear on hover. Comment counts stay visible.
- **Side pane:**
  - Issues are grouped in collapsible sections. ⌘-click shows only that section; double-click a name to rename it.
  - The Sort button sorts by priority, only when clicked.
  - Filters: priority only. New = the unread items.
  - Settings (knobs icon, inline panel): **Numbers** ID (permanent) ↔ # (list position) · **Titles** One line ↔ Full.
  - Rows: priority and unread dot are clickable. Click a selected row again to zoom to it; double-click a title to edit it.
- **Claude-watching line** under the pane header: green when both watchers are running. Amber "Claude isn't watching your comments / new screenshots" (with Copy message for Claude) when a watcher stopped. Watchers report in every poll and say "off" when they exit; 30 s of silence also counts as off.
  - To-dos = Done (persistent Resolve) on top, then To do in the order Claude will pick it up, including new screenshots.
  - Deleted = soft-deleted items with Restore and Delete all.
- **Suggestions:** the user ticks the ones to keep, then presses Keep. The ticked ones move into details and the rest are dropped. Reject all is in the corner.
- **Resolve** belongs to the user alone. It clears the thread and archives it in `canvas-resolved.json`, which you never read.
- **Offline:** if the server is down, the canvas shows a banner and toast with "Copy message for Claude", and queues changes in the browser until the server is back. Opened from disk, it shows "Open there ↗".

## Helper commands (`scripts/comments.sh`, PORT=…)

`list` · `start <id>` · `reply <id> "text"` · `done <id>` · `prio <cid> high|med|low` · `new <cid> 1|0` · `inbox` · `inbox-done <INid> <code>` · `remove <cid> "title"` (soft-delete → Deleted tab until the user confirms).

The server refuses resolve, restore, purge, edits and suggestion changes unless the request comes from the canvas UI (`X-Actor: User`). Claude can't do those, by design.

## Files

```
template/  build.py · body.html · styles.css · canvas.js · server.mjs · issues.example.json
           (canvas.html is generated; every user change lives in canvas-*.json next to it)
scripts/   comments.sh · watch-comments.py · watch-inbox.py · transcribe.sh · speaker-labels.sh · grab-frame.sh
agent-references/ui.md       — how the UI is built; read ONLY when changing the template itself
agent-references/evidence.md — first build: recording → transcript/frames, live-page audit
agent-references/writing-issues.md — how to word titles and details (Do / Don't, examples)
agent-references/contribution-agents.md — read before changing this skill
```

## Backlog (ideas, not built)

- **Reference screenshot on the card**: show the design's screenshot of the same screen next to (or toggled with) the build's, so a gap can be checked at a glance.
- **Add an issue yourself, from the canvas**: on an existing screenshot (it joins that card) or with no screenshot at all (a text-only card). Until this exists, ask Claude in a comment ("add an issue here: …"); Claude adds it to `issues.json` and rebuilds.
- **See deleted issues in full**: clicking an item in the Deleted tab shows the whole card (screenshot, title, details, comments), e.g. on a separate "Deleted" canvas view, with **Restore** right there. Today the Deleted tab only lists titles with Restore.
- **Markers on the screenshot** for cards with several issues: numbered pins pointing at the exact spot. Parked because placing them reliably is fiddly. Revisit if "which field?" keeps coming up.
