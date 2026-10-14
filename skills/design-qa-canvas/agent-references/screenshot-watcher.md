# screenshot-watcher

Tools: this skill's `scripts/` (`watch-inbox.py`, `comments.sh`).

1. Run `watch-inbox.py <port>` under **Monitor** (re-arm every 30 min). **Each re-arm, also run `comments.sh inbox`** and file any screenshot still waiting: one that arrived while you were busy isn't announced again. The watcher reports to the canvas: the user sees whether Claude is watching, and an amber warning as soon as it stops. **Re-arm promptly when Monitor times out**, so the warning doesn't stay up. Each new screenshot arrives as `INBOX IN<n> <file> …`. Screenshots the user **deleted or resolved** in the To-dos, and ones you discarded, are skipped automatically.
2. **For each one:**
   - Read the image and check it is relevant to this canvas (see below). If it clearly isn't, `comments.sh discard <INid>` and stop: no issue, no thread.
   - **No comment on it?** Check the screenshots just before and after it (a few minutes apart). If one shows the same screen and has the user's comment, that comment is this screenshot's context too: file them together (`comments.sh inbox-done` both onto the same issue) instead of waiting for a reply.
   - If the user commented on it (target `card:IN<n>`, see `comments.sh list`), their words are the issue: make them the title, written as theirs (not "Reported by…").
   - Write it the way `writing-issues.md` says: details only for what the title can't say, so usually empty apart from the Reporter line. Describing the screenshot, restating the comment, or saying what you can't tell adds reading, not information; if you need to know something, ask in the thread.
   - Add the issue to `issues.json` with `code: "S<next>"`, a tag (`@UX-Gap` / `@Dev-Gap` / `@Cosmetic-Gap` at the end of the title) only if the comment makes the gap type clear, `img` pointing at the file and the right app-area `section`. Suggestions are optional: what you're sure of goes in the title; `sugg` is for gaps against the design reference you're only fairly sure of (see `writing-issues.md`).
   - **Add the design reference screenshot** (`ref`, `refLabel`): open the same screen in the design reference (`app.design` in issues.json, e.g. the prototype on its local dev server), capture it, save it next to the canvas, and set `ref` on the issue.
     - **Same state, not just the same screen.** Reproduce what the build screenshot shows: the same step, the same open panel or dialog, and the same data situation (e.g. the same pharmacy holding the same roles, the same number of plans, the same error). Pick or set up prototype data that matches. A reference in a different state is a different issue, so don't attach it.
     - If the prototype can't show that state, don't attach a reference; say so in the thread ("the prototype has no case with one pharmacy as both Prescribed and Preferred") and let the user decide. If you can't get it now (the reference isn't running, the screen is hard to reach), file the issue anyway and add the reference the next time you work on that issue.
   - `python3 build.py`, then `comments.sh inbox-done IN<n> S<next>`.
   - Reply and mark done on its comment thread, if any (see `comment-watcher.md`).
3. **More than 2 waiting:** coordinate subagents, one per screenshot. They draft issue JSON; you are the single writer of `issues.json`.
4. Never ask the user to put screenshots anywhere else. Never delete a screenshot file from the user's Desktop (`discard` only drops this canvas's own copy).

## Every canvas gets a copy; only relevant ones stay
- The server **copies** each new Desktop screenshot into every running canvas's inbox. The Desktop file is never moved or deleted, so no canvas "grabs" it from another.
- **Pasted screenshots** (`pasted: true`, the user pressed Cmd+V in this canvas) were put here on purpose: never discard them, just decide where they go.
- **Check relevance first** (Desktop screenshots). Read the image and compare it with this canvas: its title, sections and issues, and any app or URL visible in the screenshot. If it **clearly** belongs to something else (a different app or URL, an unrelated tool or document), drop this canvas's copy: `comments.sh discard <INid>`. Don't add an issue, a step or a comment thread for it. The user can add it by hand (paste) if you were wrong. If it could plausibly belong here, or the user has already commented on it, keep it and file it.

- **One thread per screenshot:** when you mark a screenshot done with `comments.sh inbox-done <INid> <code>`, the server moves its threads onto that issue or step and closes the screenshot item, so the user resolves the conversation once, on the card.
