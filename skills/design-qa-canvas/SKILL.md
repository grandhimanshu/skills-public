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
nohup node server.mjs > server.log 2>&1 &     # then: cat canvas-port.txt
```

**Port:** leave it out. The server takes this canvas's own port (`canvas-port.txt`, else 4200), moves to the next free one when another canvas has it, and saves its choice; if this canvas is already running, it says so instead. Read the port from `canvas-port.txt` (or the server's first line) for the URL and the watchers.

The first build with a page name (`python3 build.py <data> <page>.html`) is remembered in `canvas-page.txt`; after that a plain `python3 build.py` rebuilds the same page the server shows.

- **Local only.** The server listens on `127.0.0.1`, so nothing else on the network can reach it; `CANVAS_HOST=0.0.0.0` opens it up (only on a network you trust: its "only the user" check is a request header, not a login).
- **Don't restart the server casually**; the user sees "server stopped". Rebuilds need no restart; only `server.mjs` edits do.
- If the desktop app's preview tool keeps stopping it, keep it detached (`nohup … &`).
- **Desktop screenshots are off by default.** To have new `Screenshot*.png` files copied into the inbox, start the server with `DESKTOP_WATCH=1` or create a file named `desktop-watch.on` in the canvas folder (it survives restarts; `DESKTOP_WATCH=0` forces it off, `DESKTOP_DIR=…` watches another folder). When on, it **copies** each (the Desktop file stays, so every running canvas gets its own copy) and Claude drops the copies that clearly don't belong to this canvas (see `agent-references/screenshot-watcher.md`). Pasting with ⌘V works either way.
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
| `ref` | optional path to the design reference screenshot (`refLabel` optional). It belongs to the screenshot: on a shared card, set it on any one issue and the whole card uses it. Add one for every issue with a build screenshot: when filing it, or the next time you touch an issue that doesn't have one yet. It must show the same state as the build screenshot (same step, panel and data situation); if the prototype can't show that state, leave `ref` out and say so in the thread. The Issue | Design | Fix control in the screenshot's top-left corner (and **Alt**) switch between the screenshot and the reference (see `fix`). If you replace an issue's screenshot, date it as the workflow skill says: just the date, or date + time on the same day, never a counter. |
| `fix` | optional: the after-fix screenshot, `"path"` or `{img, open, label, at}`; `open` is where the fix can be tested (a prod / staging link). Usually not authored by hand: it is saved from the canvas's Fixed tab or with `comments.sh fix` / `fixlink` into `canvas-fixes.json`, which wins. Same viewport rules as any screenshot. It belongs to the screenshot like `ref` does. |
| `open`, `refOpen` | optional addresses of the screens the screenshots were captured from: `open` for the build screenshot, `refOpen` for the design reference. A path in the app (`/orders?ui-state=O-A1`) or a full URL. **Fill them whenever you capture or replace a screenshot**, from the address you actually captured: on a shared card, set them on any one issue. They give each card a hover button (top-right) that opens the screen the card is showing (Alt flips it between the two). If the app has no per-state addresses yet, set them up with the handoff-states skill. Paths join to `app.local` (open) or the first localhost entry of `app.design` (refOpen); with no local answer, `open` falls back to the hosted `app.url` page with query dropped (the button's border turns dotted: closest page, not the exact screen). No address, no button. The published view only ever shows the hosted fallback. |

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
- **Screenshots:** the current UI, showing exactly the state described, captured at a 1440px-wide viewport (any pixel density; another width only when the user asks or the screen needs it). Say "couldn't capture this state" rather than using a close-enough frame or an older UI. **Check the saved file's real pixel width** (e.g. `sips -g pixelWidth <file>`): under 1440 means the capture is wrong, so recapture. Don't use the desktop app's preview-pane tool for these captures: it shrinks the page to the pane (about 800px) before shooting. Capture in a separate browser (scripted Playwright, or the signed-in Chrome), at 2x density when you can. Never stretch a small capture with `scale` to fill the card.
- **Wording of titles and details:** follow **`agent-references/writing-issues.md`** (Do / Don't + examples).
- **Don't invent anything.** If you can't see or measure it, say it comes from the screenshot only.
- **Numbers are assigned once and never change.** Deleting an issue leaves a gap.
- **Set priority yourself:**
  - High: data integrity, wrong state, blocked flow.
  - Medium: misleading or inconsistent UI.
  - Low: polish (the default).

## Fixed issues
Only the user marks an issue fixed (✓ on the issue row, or on a shared screenshot for all its issues; Reopen undoes it). Fixed issues sit in their own Fixed section at the end (`canvas-fixed.json`) and show in the published view. If a new screenshot suggests something is fixed, say so in its thread; don't mark it yourself.

## Fixed items (done, with proof)
The user marks an issue fixed (✓) as before; every such issue is listed in the **Fixed** tab with which of its three screenshots exist (issue, design, fix) and a field for **where the fix can be tested** (a prod / staging link). The chat that does the fix attaches its proof; the canvas keeps the state, so any chat (new, or after compaction) picks it up with one command. How a screenshot is captured is up to the chat; the usual screenshot rules apply.
- `comments.sh fixes`: done items, what each is missing, the test link, and the tab's switch.
- `comments.sh fix <id> <image> [link]` attaches the after-fix screenshot (and the link); `comments.sh fixlink <id> <url>` saves just the link.
- **Where to test:** when the watcher prints `FIXLINK`, a done item has no test link: ask in its thread with `comments.sh ask <id> "Where can I test this fix? Paste a prod or staging link."` and save the reply with `fixlink`.
- **The Fixed tab's switch (default off, the user's):** when it is on and nothing else is waiting (no open comments, no inbox), the watcher prints one `FIXES` line listing done items that lack a design or fix screenshot; capture them then, never before the pending to-dos. Off: leave done items alone.

## Deleted issues are out of scope
Issues in the Deleted section (`canvas-removed.json`) and ones deleted for good (`canvas-purged.json`, which keeps their details and threads) aren't part of the work: leave them out of edits, filing, counts and reports. Read them only as context, for example to avoid raising again something the user deleted, or to see why it went.

## Private notes (optional)
If a skill named `design-canvases-internal` is installed, read it first before changing, updating or deploying this skill: it holds the decision log, contribution rules, UI internals and setup that are not part of this public copy, and its rules win over this file. If it isn't installed, ignore this line.

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
  - **Alt** cycles the selected card Issue → Design → Fix (a view the issue lacks is skipped); the three-way control in the screenshot's top-left corner jumps straight to one (a missing view is greyed out). The keyboard button by the zoom controls lists every shortcut.
  - Double-click any text to edit it in place; this saves to `canvas-edits.json`.
- **Card actions:**
  - Priority H/M/L and the unread dot are always visible.
  - Expand, menu, delete and chat appear on hover. Comment counts stay visible.
- **Side pane:**
  - Issues are grouped in collapsible sections. ⌘-click shows only that section; double-click a name to rename it.
  - The Sort button sorts by priority, only when clicked.
  - Filters: one row of chips at the top of Issues — Unread · N, Priority ▾, Tag ▾ (multi-select dropdowns). Tags are `@` chips in the text: type `@` while editing to pick one, Backspace removes a chip whole, pasted `@UX-Gap` text becomes a chip (Settings → Tags: Basic / Colourful).
  - Settings (knobs icon, inline panel): **Numbers** ID (permanent, the default) ↔ # (position in the list; shifts when issues are removed). **Titles** One line ↔ Full. Links (`#issue=`), the address and the Sheets export always use the permanent ID, whichever is shown.
  - Rows: priority and unread dot are clickable. Click a selected row again to zoom to it; double-click a title to edit it.
- **Claude-watching line** under the pane header: green when both watchers are running. Amber "Claude isn't watching your comments / new screenshots" (with Copy message for Claude) when a watcher stopped. Watchers report in every poll and say "off" when they exit; 30 s of silence also counts as off.
  - To-dos = Done (persistent Resolve) on top, then To do in the order Claude will pick it up, including new screenshots.
  - Deleted = soft-deleted items with Restore and Delete all.
- **Suggestions:** the user ticks the ones to keep, then presses Keep. The ticked ones move into details and the rest are dropped. Reject all is in the corner.
- **Resolve** belongs to the user alone. It clears the thread and archives it in `canvas-resolved.json`, which you never read.
- **Export:** the table icon at the end of the icon row opens a menu: **Copy for Google Sheets** (tab-separated, so it pastes into separate columns; a toast button opens a new sheet) and **Download as CSV** (a real comma-separated file). Rows: ID, Name, Module / stage, Priority, Link. Links are `…#issue=<number>`: opening one selects that issue, and the address follows whichever issue is selected, so a refresh stays on it.
- **Offline:** if the server is down, the canvas shows a banner and toast with "Copy message for Claude", and queues changes in the browser until the server is back. Opened from disk, it shows "Open there ↗".

## Helper commands (`scripts/comments.sh`, PORT=…)

`list` · `start <id>` · `reply <id> "text"` · `done <id>` · `fixes` · `fix <cid> <img> [link]` · `fixlink <cid> <url>` · `ask <cid> "text"` · `prio <cid> high|med|low` · `new <cid> 1|0` · `inbox` · `inbox-done <INid> <code>` · `remove <cid> "title"` (soft-delete → Deleted tab until the user confirms).

The server refuses resolve, restore, purge, edits and suggestion changes unless the request comes from the canvas UI (`X-Actor: User`). Claude can't do those, by design.

## All canvases (find and start them)
`node ~/.claude/skills/<design-qa-canvas|design-wf-canvas>/scripts/canvases.mjs …` (same script in both skills):
- `list`: every canvas built from these skills (QA, workflow, derived ones), running or not, with unread and to-do counts. `start <name>`: start a stopped one on its own port. `scan`: find older canvases on disk. Canvases register themselves when they start.
- `serve`: the "All canvases" page, **always on port 4100** (a link in each canvas's ⋯ menu points to it). If it exits with `PORT_BUSY` (code 3), never pick another port: tell the user what is using 4100 and ask them to free it, or to let you move that canvas (`move-port 4100 --yes`, only after a yes).

## Files

```
template/  build.py · body.html · styles.css · canvas.js · server.mjs · issues.example.json
           (canvas.html is generated; every user change lives in canvas-*.json next to it)
scripts/   comments.sh · watch-comments.py · watch-inbox.py · transcribe.sh · speaker-labels.sh · grab-frame.sh
agent-references/evidence.md — first build: recording → transcript/frames, live-page audit
agent-references/writing-issues.md — how to word titles and details (Do / Don't, examples)
```

## Backlog (ideas, not built)

- **Viewers flag priority**: in a deployed view, viewers suggest a priority and the user sees it. Needs a store the deployment can write to.
- **Markers on the screenshot** for cards with several issues: numbered pins pointing at the exact spot. Parked because placing them reliably is fiddly. Revisit if "which field?" keeps coming up.

## Backlog (ideas, not built or parked)

- **Faster published page** (in progress): store each screenshot once in the view build (a large published page shrank about 5× in one test) and share it between cards; keep card sizes known up front so the layout doesn't move; load the screenshot of the issue being opened first and show a loading state on the others. Needs the publish script and `canvas.js` changed together. Also parked: the next-number fix so UI-added issues never reuse a number (`build.py` and `canvas.js` both).

- **Batch screenshot capture.** Capture a whole list of screens in one scripted run (Playwright, 1440px, parallel) instead of one at a time in the browser. A manifest of name + URL + wait + optional clicks, generated from handoff-states `states.md` / `workflows.md` (`?ui-state=` / `?ui-workflow=&step=` links). It saves into `shots/` and fills `img` / `ref` (and moves the old `img` to `prev`). Capture the design reference with the build. **Must not add user actions:** the design side (mock login) needs none; the build side (a signed-in app) needs a saved session, so any screen the script can't reach falls back to the signed-in browser path used today. Still look at every capture. Unknowns to test first: whether a workflow step's fresh URL reproduces the stepped-through data, and the real time saved. Not started.

- **One review list: Unread + To-dos.** Combine the Unread list and the To-dos into one queue of things to review. Marking all read also archives the completed chats in it. Newly unread items join at the bottom, in arrival order, rather than being sorted in by canvas order.
