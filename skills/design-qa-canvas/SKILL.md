---
name: design-qa-canvas
description: Build and run a design-QA review canvas — numbered, prioritised issues with full screenshots on a pan/zoom canvas, a side pane (Issues with an Unread filter · To-dos; New screenshots and Deleted as sections at the end), threaded comments that are tasks for Claude, a live screenshot inbox, keep/drop for Claude's suggestions, and on-canvas editing. Use when the user wants to turn a recording, meeting, Desktop screenshots or a live page into a reviewable issue list, compare a build against a design, or set up the same review loop for another flow. Also runs its review loop: watching the user's comments and new screenshots ("watch comments", "work my comments", "pick up screenshots"). The UI is a finished template — copy it, never rebuild it. Default port 4200.
---

# design-qa-canvas

One canvas the user reviews and steers. The UI is **done**: `template/` is copied as-is into each project. You only write `issues.json`, run the server, and work the comments.

First build from a recording or a live page: read **`agent-references/evidence.md`** (transcript, speakers, frames, parallel live audit with subagents).

**Start both watchers whenever the canvas runs:** `watch-comments.py <port>` and `watch-inbox.py <port>`, each under its own Monitor. The canvas shows an amber warning while either one is off.

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

The first build with a page name (`python3 build.py <data> <page>.html`) is remembered in `canvas-page.txt`; after that a plain `python3 build.py` rebuilds the same page the server shows.

- **Don't restart the server casually**; the user sees "server stopped". Rebuilds need no restart; only `server.mjs` edits do.
- If the desktop app's preview tool keeps stopping it, keep it detached (`nohup … &`).
- The server watches the Desktop for new `Screenshot*.png` and **copies** each into its inbox (the Desktop file stays, so every running canvas gets its own copy; set `DESKTOP_WATCH=0` to turn this off, or `DESKTOP_DIR=…` to watch a different folder). Claude drops the copies that clearly don't belong to this canvas (see `agent-references/screenshot-watcher.md`).
- Keep recordings, transcripts and frames out of git with `.git/info/exclude`.

## `issues.json`

`{ title, port, highlight?: {label, chip}, sections: [app areas in product-flow order], issues: [...] }`

| field | notes |
|---|---|
| `section` | an app area (New order, Eligibility…), never a source |
| tags | written in the text: `@UX-Gap`, `@Dev-Gap`, `@Cosmetic-Gap` in the title or details (shown as a grey chip; the Tag filter reads them). When you're sure of the gap type, add one at the end of the title; otherwise leave it for the user. What they mean, judged against the design reference: **Dev-Gap** = the build differs from the design (the design is right); **UX-Gap** = the design itself has the problem, or has no answer for this case (only when the reference is wrong or silent); **Cosmetic-Gap** = a visual-only difference (spacing, type, colour, alignment). If the design gets it right, it is never a UX-Gap |
| `title` | the heading, and the presenting cue: a few words that say the issue on their own |
| `what` | details, only what the title can't say (often empty). Inline `<b> <i> <code> <br>` allowed. On the canvas, title and details edit as one box: the first line is the title, Enter goes to the details, Shift+Enter adds a line break inside the title |
| `img`, `ts` | screenshot path relative to the canvas; video time |
| `code` | `S1…` from screenshots, `A1…` from live audits. Otherwise the id is the number |
| `highlight` | flags the person in `highlight.chip` |
| `sugg` | `[["S1-a","text"],…]`: options for the user to keep or drop, mainly gaps against the design reference (see `agent-references/writing-issues.md`) |
| `screen` | optional key: issues with the same `screen` show as **one card** (at most 4 per card; more continue on a second card with the same screenshot), with the screenshot once and the issues listed under it. Use it only for the **same screen in the same state**; two states of one page stay separate cards. The user can Move an issue to its own card or Combine cards (⋯ menu) |
| `ref` | optional path to the design reference screenshot (`refLabel` optional). It belongs to the screenshot: on a shared card, set it on any one issue and the whole card uses it. Add one for every issue with a build screenshot: when filing it, or the next time you touch an issue that doesn't have one yet. It must show the same state as the build screenshot (same step, panel and data situation); if the prototype can't show that state, leave `ref` out and say so in the thread. The card's image button and **Alt** flip between the screenshot and the reference. If you replace an issue's screenshot, date it as the workflow skill says: just the date, or date + time on the same day, never a counter. |

Rules:
- **Compare against the design first. That is the job.** Before writing any issue, find the reference: a Figma file, a design/demo repo or a signed-off build. **If you don't know which one, ask** ("Which design should I compare against, Figma or <repo>?"). Record each one in `app.design` (any number: Figma, a branch, any URL) so it shows as a Design reference in the ⋯ menu.
  - Put the build's screenshot and the design's screenshot of the same screen side by side.
  - Most issues should be gaps (the build differs from the design) and cite where in the design.
  - If the build matches the design, there is usually no issue. You may still report an **obvious** problem the design has too (clearly broken or wrong for the user). Keep these few, and label them as a note for the design.
  - Don't add an issue whose intent is already covered by another issue.
- **Your own judgement comes second and stays low.** UX opinions not backed by the design ("consider X", conventions, best practice):
  - Add them only when they are **major**: data loss, wrong state, a blocked flow. No best-practice opinions (load time, accessibility, contrast) unless major.
  - Give them priority **low**, and start the title or details with "Claude's judgement:".
  - Never let them outnumber or bury the design gaps. Never report a comparison you haven't actually done.
- **Screenshots:** the current UI, showing exactly the state described. Say "couldn't capture this state" rather than using a close-enough frame or an older UI.
- **Wording of titles and details:** follow **`agent-references/writing-issues.md`** (Do / Don't + examples).
- **Don't invent anything.** If you can't see or measure it, say it comes from the screenshot only.
- **Numbers are assigned once and never change.** Deleting an issue leaves a gap.
- **Set priority yourself:**
  - High: data integrity, wrong state, blocked flow.
  - Medium: misleading or inconsistent UI.
  - Low: polish (the default).

## Fixed issues
Only the user marks an issue fixed (✓ on the issue row, or on a shared screenshot for all its issues; Reopen undoes it). Fixed issues sit in their own Fixed section at the end (`canvas-fixed.json`) and show in the published view. If a new screenshot suggests something is fixed, say so in its thread; don't mark it yourself.

## Deleted issues are out of scope
Issues in the Deleted section (`canvas-removed.json`) and ones deleted for good (`canvas-purged.json`, which keeps their details and threads) aren't part of the work: leave them out of edits, filing, counts and reports. Read them only as context, for example to avoid raising again something the user deleted, or to see why it went.

## Deploying (optional)
Only when the user asks to deploy or publish, or to set up the toolbar links: read `agent-references/deploy.md`.

## What the user can do (so you can answer questions; don't re-implement any of it)

- **Canvas:**
  - Scroll pans (vertical-first) and ⌘-scroll or pinch zooms, staying anchored at the cursor; zoom runs up to 800%.
  - Clicking a screenshot zooms to it and expands its details. ← → move between items.
  - **0** zooms to the screenshot nearest the cursor (same as clicking it); **0** again goes back to the whole-canvas view. It keeps toggling.
  - **Space** marks the selected issue read and moves to the next issue in side-pane order; pressing again quickly switches instantly. When the next issue shares the screenshot, the zoom stays and that issue moves up right under the screenshot (seen ones go to the bottom); otherwise the next screenshot is fitted in view. Issues sharing a screenshot are listed together in the side pane.
  - **← →** step to the previous / next issue without marking it read (same screenshot rule as Space).
- **Enter** edits the selected issue's title and details (deleted and fixed ones too); Esc or ⌘Enter saves.
  - **+ Add issue** (hover, the last row under a card's issues) adds an issue on that screenshot by hand: same section and screenshot, title open for typing. Saved in `canvas-added.json` (merged in at load); treat these like any issue.
  - Shared cards also have screenshot-level priority (shows the highest among its issues; changing it moves every issue at that level), read-all, menu (first issue), delete (the top issue only) and chat (first issue). Single cards have the same row buttons (menu, delete, chat) on hover.
  - **Cmd+V** on the canvas pastes a screenshot straight into this canvas's To-dos (toast with a thumbnail and Add comment).
  - **Delete** (or Backspace) deletes the selected issue, one at a time even on a shared screenshot, with Undo.
  - **Alt** flips the selected card to its design reference (`ref`). The keyboard button by the zoom controls lists every shortcut.
  - Double-click any text to edit it in place; this saves to `canvas-edits.json`.
- **Card actions:**
  - Priority H/M/L and the unread dot are always visible.
  - Expand, menu, delete and chat appear on hover. Comment counts stay visible.
- **Side pane:**
  - Issues are grouped in collapsible sections. ⌘-click shows only that section; double-click a name to rename it.
  - The Sort button sorts by priority, only when clicked.
  - Filters: one row of chips at the top of Issues — Unread · N, Priority ▾, Tag ▾ (multi-select dropdowns). Tags are `@` chips in the text: type `@` while editing to pick one, Backspace removes a chip whole, pasted `@UX-Gap` text becomes a chip (Settings → Tags: Basic / Colourful).
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

- **Viewers flag priority**: in a deployed view, viewers suggest a priority and the user sees it. Needs a store the deployment can write to.
- **Markers on the screenshot** for cards with several issues: numbered pins pointing at the exact spot. Parked because placing them reliably is fiddly. Revisit if "which field?" keeps coming up.
