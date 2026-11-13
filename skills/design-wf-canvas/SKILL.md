---
name: design-wf-canvas
description: Lay out a product flow as screenshots joined by labelled arrows on a pan/zoom canvas, where the user leaves comments as tasks for Claude, marks steps read, deletes steps (the flow reconnects itself). Use when the user wants to map, review or document a user journey or workflow from screenshots, or says "workflow canvas", "flow canvas", "map this flow", "workflow board". Has its own template (same building blocks as design-qa-canvas) — copy it, never rebuild the UI. Also runs its review loop: watching the user's comments and new screenshots ("watch comments", "pick up screenshots"). Default port 4300.
---

# design-wf-canvas

Built from the same components as **design-qa-canvas**, in **flow mode**: each card is a **step** (one screenshot), and arrows join steps left → right. Comments, the To-dos, priorities, the unread dot, Settings, Undo and the offline queue all work the same. The difference is the data file: `flows.json` with `steps` and `edges` instead of `issues`.

**Start both watchers whenever the canvas runs:** `watch-comments.py <port>` and `watch-inbox.py <port>`, each under its own Monitor. The canvas shows an amber warning while either one is off.

The review loop is part of this skill: **`agent-references/comment-watcher.md`** (every comment is a task) and **`agent-references/screenshot-watcher.md`** (the user's Desktop screenshots become steps, see below).

## Start

**Existing canvas on an older template?** Before working on it, update it to the latest template: copy `canvas.js`, `styles.css`, `body.html`, `build.py` and `server.mjs` from this skill's `template/` over the old ones (back the old ones up first). Keep its data files (`issues.json`/`flows.json`, `canvas-*.json`, screenshots). Then `node --check canvas.js`, rebuild, and restart its server.

```bash
cp -R ~/.claude/skills/design-wf-canvas/template <project>/<folder>
cd <project>/<folder> && mv flows.example.json flows.json
python3 build.py flows.json canvas.html
nohup node server.mjs > server.log 2>&1 &     # then: cat canvas-port.txt
```

**Port:** leave it out. The server takes this canvas's own port (`canvas-port.txt`, else 4300), moves to the next free one when another canvas has it, and saves its choice; if this canvas is already running, it says so instead. Read the port from `canvas-port.txt` (or the server's first line) for the URL and the watchers.

The first build with a page name (`python3 build.py <data> <page>.html`) is remembered in `canvas-page.txt`; after that a plain `python3 build.py` rebuilds the same page the server shows.

The server listens on `127.0.0.1` only (`CANVAS_HOST=0.0.0.0` opens it to the network; only on a network you trust).

Rebuild after every `flows.json` change; the open page waits until the user stops typing, then reloads.

## `flows.json`

```json
{ "title": "Order journey", "port": 4300,
  "flows": { "start": "Create an order" },               // optional: name a flow by its first step
  "steps": [ { "id": "start", "title": "Open New order", "note": "• The ✏️ goes next to Patient, on open orders only.<br>• A closed order shows no pencil.", "img": "shots/s1.png" },
             { "id": "form",  "title": "Fill the form", "img": "shots/s2.png", "prev": { "img": "shots/s2-old.png", "label": "Oct 6" } } ],
  "edges": [ ["start", "form", "click New order"] ] }
```

- **One scale for all screenshots:** a 1440px-wide page fills a card (1x); every other screenshot shows at the same scale, so a 400px close-up is small and text is the same size everywhere. Pixel density is read from the file (or a very wide capture counts as 2x). Rarely, a step sets `"scale": 0.8` (e.g. to show a responsive width) or `"dpr": 2`; prefer leaving both out unless the user asks.
- **Steps:** each step's number (`n`) is its ID: assigned once, never reused, and the only ID used with the user. Leave `id` out on new steps; the build sets it to the number. Older canvases keep their existing `id`s internally (comments point to them). Renumber only when the user asks (for example when the gaps between numbers get large).
- **Screen addresses:** optional `open` (the screen the screenshot was captured from) and `refOpen` (for a step's `prev` screenshot): a path in the app (`/orders?ui-state=O-A1`) or a full URL. **Fill them whenever you capture or replace a screenshot**, from the address you actually captured. They give each step a hover button (top-right) that opens the screen it is showing (Alt flips to the previous screenshot). If the app has no per-state addresses yet, set them up with the handoff-states skill. Paths join to `app.local` (`refOpen`: the first localhost entry of `app.design`); with no local answer, `open` falls back to the hosted `app.url` page with query dropped (dotted border: closest page, not exact). No address, no button. The published view only shows the hosted fallback.
- **Titles are the presenting cues.** The user presents from the canvas, and viewers read the titles, not the notes. Make each title say what happens on that screen in a few words ("Save waits for reason + tick", "Fails again: banner is back"), so a viewer gets the step from the title alone. The note is only for the detail a viewer needs when asked; many steps need one bullet or none.
- **Notes:** write each note as the handoff a developer gets: short, plain bullets (`• …`, joined with `<br>`: notes are HTML, so a newline collapses), about what the user sees and the rule behind it.
  - Say it the way you'd tell a teammate: "Save stays disabled until a field has changed, a reason is chosen and the box is ticked."
  - No change logs ("CHANGED …", "NEW …"), dates, file paths, component names or reasoning about the decision. The previous screenshot (`prev`) already records that something changed.
  - Quote on-screen copy exactly, in quotes.
- **Edges:** `[from, to, label?]`.
  - **Happy path first:** when a step has several outgoing edges, list the most common outcome first and the rarer cases after it. The canvas puts the first-listed branch on top and level with its parent, and the rarer ones below, so the top of every branch orients a new viewer and keeps a presentation clean.
  - Labels sit horizontally on the arrow, in small text. **Keep labels short, about 30 characters**: the action that moves the user on ("click Save", "invalid input"). Longer labels wrap only when they don't fit between the two screens.
  - Branches: give a step several outgoing edges. Steps at the same depth stack in one column.
  - **Arrows run straight where they can.** The canvas lines each step up with the step before it (a join lines up with its topmost predecessor), pushing a step down, and its chain with it, when something is in the way. Only extra branches and joins bend. An arrow that would run behind a card, or that returns to an earlier screen, is drawn as a detour under (or, if cards are below, over) the flow: out of the bottom of one card, into the bottom of the other; returns are dashed.
- **Flows** are the connected groups of steps, laid out top to bottom in the order of their first step. The canvas numbers them (1 · , 2 · …) itself, so flow names in `flows` are plain names, no number; group sections aren't numbered.
- **Groups:** unconnected steps with the same `"group": "<name>"` share one section shown as a grid (like the QA canvas), placed where its first step is listed in `steps`. Use it for screens that explain themselves without arrows, such as a component's states. **Subsections:** name groups `"States / Views dropdown"` (or `"States · Views dropdown"`), listed one after another: they share one section under a big black "States" heading, like the page title, with a blue heading per subsection that doesn't repeat "States". Use them when there are many screens or a clear grouping, so the section stays scannable.
- **`todos`:** your own to-dos, no chat thread: `"todos": [{"id": "t1", "text": "Views dropdown: hover, disabled, empty", "steps": ["s51", "s52"]}]`. In progress until its `steps` exist; then completed, with Chat (on its first screen) and an unread dot instead of Archive. The dot marks its screens read and moves to the next to-do, like Archive; reading the screens on the canvas clears it too.

## Building or rebuilding a canvas

The same canvas goes through three stages: first the design is finalised through comments, then it's shown to PMs and leads, then it's used for grooming. Write it for PMs and designers first, devs second, QA last.

- **Main flows are PM- and designer-centric:** one flow per user journey, main path left → right; unrelated journeys are separate flows, not forced into one (a guideline, see `agent-references/layout.md`). Keep edge cases off the main path, as short branches near the end or as their own flows.
- **Avoid repetition:** show each screen or concept once, unless repeating it makes a journey clearer.
- **Backward edges are fine, but rare:** only when one saves many screens or makes the flow clearer.
- **Notes are like slide text:** a short guide to what the screenshot shows, not a spec. Add detail only where a state would be confusing without it.
- **Capture fresh screenshots from the current build** when building or rebuilding, at a **1440px-wide viewport** (any pixel density), so every screen shows the same layout. Use another width only when the user asks for it or a screen needs it. Data doesn't need to match across steps. **Check the saved file's real pixel width** (e.g. `sips -g pixelWidth <file>`): under 1440 means the capture is wrong, so recapture. Don't use the desktop app's preview-pane tool for these captures: it shrinks the page to the pane (about 800px) before shooting. Capture in a separate browser (scripted Playwright, or the signed-in Chrome), at 2x density when you can. Never stretch a small capture with `scale` to fill the card.
- **No history** on a rebuilt canvas unless the user asks to keep it.
- **Larger work** (a rebuild, a batch of states): prefer rebuilding the canvas as each piece is finished, so the user can review along the way.
- **No tags** (`@UX-Gap` etc.): those are for design-qa-canvas only.

### States (for devs at grooming)
Hover, focus, pressed, disabled, loading, empty, error, success, long text: whatever applies to each component or screen, when the build has it.
- **Flows and comments come first.** Finish the flow work, tell the user it's done, then work on states until they ask for something else. Comments and feature work always interrupt state work.
- Add each batch of states as a `todos` entry before starting it, so the user sees what's coming.
- **Where they go:**
  - self-explanatory states: plain screens in a `group` section;
  - states that are really an edge case, or need steps to reach: a flow;
  - only one or two states: put them next to the screen they belong to (a short branch), no section;
  - many states for one component get their own section; fewer can share a section across several components or pages.

- **Laying out or reorganising flows:** read `agent-references/layout.md` (keep flows linear; a default, not a hard rule).

## Deleted steps are out of scope
Steps in the Deleted section (`canvas-removed.json`) and ones deleted for good (`canvas-purged.json`, which keeps their details and threads) aren't part of the work: leave them out of edits, filing, counts and reports. Read them only as context, for example to avoid raising again something the user deleted, or to see why it went.

## Private notes (optional)
If a skill named `design-canvases-internal` is installed, read it first before changing, updating or deploying this skill: it holds the decision log, contribution rules, UI internals and setup that are not part of this public copy, and its rules win over this file. If it isn't installed, ignore this line.

## Deploying (optional)
Only when the user asks to deploy or publish, or to set up the toolbar links: read `agent-references/deploy.md`.

## What the user can do (don't re-implement)

- **Delete a step** (on hover, or ⋯ → Delete). Undo appears bottom-right.
  - A middle step's neighbours reconnect (A → B → C becomes A → C).
  - Deleting a flow's first step splits the flow: its next steps become starts.
  - Deleted steps wait in the Deleted section at the end of the canvas (collapsed) until the user restores them or deletes them for good.
- **Unread** (the chip at the top of Screens, also in Filters): steps the user hasn't seen, **including steps whose screenshot changed**. Read state is per screenshot version.
- **Double-click the page title** (on the canvas or in the side pane) to rename it.
- **0** zooms to the step nearest the cursor; **0** again shows the whole canvas.
- **→** walks one whole path to its end, then the next branch; **←** goes back left along the arrows (on a flow's first step, to the last screen of the previous flow) (never sideways to another branch), and → after ← retraces the same branch; **↑ ↓** read every card once, row by row like a grid (left to right, then down, flow by flow), ignoring the arrows. In a group section (a grid), ← → move one screen and ↑ ↓ one row, carrying on into the next or previous section at its edges. Pressing again within 0.7s switches instantly instead of animating, so you can flip between screens to spot the change. **Space** marks the selected step read and moves on, like →. Going forward (→ or ↓) past the end of a path or out of a section plays a subtle blue glow on the canvas's right edge; it never delays moving, and going back never plays it. **Delete** removes the selected step (the flow reconnects; Undo).
- **Enter** edits the selected issue's title and details (deleted and fixed ones too); Esc or ⌘Enter saves.
- **Alt** flips a step that has `prev` to its previous screenshot (only those steps; not in the view build).
- Comments, priority H/M/L, double-click editing, Settings (Numbers, Titles, Canvas background, default #F4F4F4), and the Claude-watching line all work as in design-qa-canvas.

## Updating a step's screenshot (keep one previous)

When the screen changes, put the new image in `img` and the old one in `prev` (**one previous only**: `prev` replaces any older one).
- Which screenshot becomes `prev`: the one the user names. Otherwise use the step's screenshot from the last change in the flow.
- If nothing changed visually, leave the step alone. No `prev`, no new version.
- **A sharper copy of the same screen** (higher resolution only): replace `img`, no `prev`. The build sees it looks the same and keeps the step read (`canvas-imgver.json`); don't mark it New.
- **Keep it read when you're sure it needs no review:** if the user already reviewed this exact change (here, or the same change on another step) and you're really confident, keep the new screenshot read: after rebuilding, `comments.sh seen <cid> <img>`. When in doubt, leave it New.
- The step then shows up as unread for the user.
- Dates in `prev.label`: just the date (`Oct 9`) when it differs from the previous version's. **On the same date, add the time** (`Oct 9, 16:58`), never a counter like `Oct 9 (3rd)`.

## New screenshots from the Desktop (flow mode; see `agent-references/screenshot-watcher.md`)

Desktop screenshots are copied in only when the user has turned that on: start the server with `DESKTOP_WATCH=1`, or create a file named `desktop-watch.on` in the canvas folder (`DESKTOP_WATCH=0` forces it off). Pasting with ⌘V works either way.

For each `INBOX IN<n>`:
- Decide whether it is a **new step** (add it to `steps` and connect it with an edge) or an **updated screen** of an existing step (move its old `img` to `prev`).
- Then rebuild and run `comments.sh inbox-done IN<n> <stepId>`.
- If you can't tell where the step goes, add it unconnected and ask in a reply on its comment.

Helper commands are in this skill's `scripts/` (`comments.sh`, `watch-comments.py`, `watch-inbox.py`).

## All canvases (find and start them)
`node ~/.claude/skills/<design-qa-canvas|design-wf-canvas>/scripts/canvases.mjs …` (same script in both skills):
- `list`: every canvas built from these skills (QA, workflow, derived ones), running or not, with unread and to-do counts. `start <name>`: start a stopped one on its own port. `scan`: find older canvases on disk. Canvases register themselves when they start.
- `serve`: the "All canvases" page, **always on port 4100** (a link in each canvas's ⋯ menu points to it). If it exits with `PORT_BUSY` (code 3), never pick another port: tell the user what is using 4100 and ask them to free it, or to let you move that canvas (`move-port 4100 --yes`, only after a yes).

## Backlog (ideas, not built or parked)

- **Batch screenshot capture.** Capture a whole list of screens in one scripted run (Playwright, 1440px, parallel) instead of one at a time in the browser. A manifest of name + URL + wait + optional clicks, generated from handoff-states `states.md` / `workflows.md` (`?ui-state=` / `?ui-workflow=&step=` links). It saves into `shots/` and fills `img` / `ref` (and moves the old `img` to `prev`). Capture the design reference with the build. **Must not add user actions:** the design side (mock login) needs none; the build side (a signed-in app) needs a saved session, so any screen the script can't reach falls back to the signed-in browser path used today. Still look at every capture. Unknowns to test first: whether a workflow step's fresh URL reproduces the stepped-through data, and the real time saved. Not started.

- **One review list: Unread + To-dos.** Combine the Unread list and the To-dos into one queue of things to review. Marking all read also archives the completed chats in it. Newly unread items join at the bottom, in arrival order, rather than being sorted in by canvas order.

- **Live screens instead of screenshots**: each step shows the real screen rather than a picture: an HTML copy of the page (snapshot of its DOM and styles, so text stays crisp and selectable at any zoom), or the matching Figma frame if the flow lives in Figma (or the canvas itself moves to Figma/FigJam). Open questions: keeping HTML copies faithful (fonts, scripts, auth-only data), file size, and how comments and Before/After would attach.
- **Viewers flag priority** in a deployed view, for the user to see. Needs a store the deployment can write to.
