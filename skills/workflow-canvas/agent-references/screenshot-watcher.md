# screenshot-watcher

Tools: this skill's `scripts/` (`watch-inbox.py`, `comments.sh`).

1. Run `watch-inbox.py <port>` under **Monitor** (re-arm every 30 min). The watcher reports to the canvas: the user sees whether Claude is watching, and an amber warning as soon as it stops. **Re-arm promptly when Monitor times out**, so the warning doesn't stay up. Each new screenshot arrives as `INBOX IN<n> <file> …`. Screenshots the user **deleted or resolved** in the To-dos are skipped automatically.
2. **For each one:**
   - Read the image.
   - If the user commented on it (target `card:IN<n>`, see `comments.sh list`), their words are the context. Otherwise describe only what you can see.
   - Add an issue to `issues.json` with `code: "S<next>"` and kind `ctx` (or `gap`/`ux` if the comment makes it clear), `img` pointing at the file, the right app-area `section`, and `sugg` options when the intent is unclear.
   - `python3 build.py`, then `comments.sh inbox-done IN<n> S<next>`.
   - Reply and mark done on its comment thread, if any (see `comment-watcher.md`).
3. **More than 2 waiting:** coordinate subagents, one per screenshot. They draft issue JSON; you are the single writer of `issues.json`.
4. Never ask the user to put screenshots anywhere else. Never delete a screenshot file.

## Which canvas gets a screenshot
- Only the canvas the user used last (focus or click; `~/.claude/design-qa-active.json`) takes new Desktop screenshots. Until a canvas is used, they stay on the Desktop.
- **Check scope first.** Before turning a screenshot into an issue or step, check that it belongs to this canvas: the same app or URL, and the same flow or area this canvas covers. If it clearly doesn't, or you're not sure, don't file it: `comments.sh return <INid>`. That puts it back on the Desktop under its original name, and the other running canvases may take it; the canvases that returned it never take it again. Only file it when you're sure it's in scope.

