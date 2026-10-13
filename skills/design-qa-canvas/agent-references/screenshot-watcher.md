# screenshot-watcher

Tools: this skill's `scripts/` (`watch-inbox.py`, `comments.sh`).

1. Run `watch-inbox.py <port>` under **Monitor** (re-arm every 30 min). The watcher reports to the canvas: the user sees whether Claude is watching, and an amber warning as soon as it stops. **Re-arm promptly when Monitor times out**, so the warning doesn't stay up. Each new screenshot arrives as `INBOX IN<n> <file> …`. Screenshots the user **deleted or resolved** in the To-dos, and ones you discarded, are skipped automatically.
2. **For each one:**
   - Read the image and check it is relevant to this canvas (see below). If it clearly isn't, `comments.sh discard <INid>` and stop: no issue, no thread.
   - If the user commented on it (target `card:IN<n>`, see `comments.sh list`), their words are the issue: make them the title, written as theirs (not "Reported by…").
   - Write it the way `writing-issues.md` says: details only for what the title can't say, so usually empty apart from the Reporter line. Describing the screenshot, restating the comment, or saying what you can't tell adds reading, not information; if you need to know something, ask in the thread.
   - Add the issue to `issues.json` with `code: "S<next>"` and kind `ctx` (or `gap`/`ux` if the comment makes it clear), `img` pointing at the file and the right app-area `section`. Add `sugg` only for clear gaps against the design reference (see `writing-issues.md`).
   - `python3 build.py`, then `comments.sh inbox-done IN<n> S<next>`.
   - Reply and mark done on its comment thread, if any (see `comment-watcher.md`).
3. **More than 2 waiting:** coordinate subagents, one per screenshot. They draft issue JSON; you are the single writer of `issues.json`.
4. Never ask the user to put screenshots anywhere else. Never delete a screenshot file from the user's Desktop (`discard` only drops this canvas's own copy).

## Every canvas gets a copy; only relevant ones stay
- The server **copies** each new Desktop screenshot into every running canvas's inbox. The Desktop file is never moved or deleted, so no canvas "grabs" it from another.
- **Pasted screenshots** (`pasted: true`, the user pressed Cmd+V in this canvas) were put here on purpose: never discard them, just decide where they go.
- **Check relevance first** (Desktop screenshots). Read the image and compare it with this canvas: its title, sections and issues, and any app or URL visible in the screenshot. If it **clearly** belongs to something else (a different app or URL, an unrelated tool or document), drop this canvas's copy: `comments.sh discard <INid>`. Don't add an issue, a step or a comment thread for it. The user can add it by hand (paste) if you were wrong. If it could plausibly belong here, or the user has already commented on it, keep it and file it.

- **One thread per screenshot:** when you mark a screenshot done with `comments.sh inbox-done <INid> <code>`, the server moves its threads onto that issue or step and closes the screenshot item, so the user resolves the conversation once, on the card.
