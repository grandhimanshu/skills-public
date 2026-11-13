# comment-watcher

Tools: this skill's `scripts/` (`watch-comments.py`, `comments.sh`). Set `PORT` to the canvas port.

1. **Watch.** Run `watch-comments.py <port>` under **Monitor** (re-arm every 30 min; each re-arm also run `scripts/app-links.py <canvas folder>` so the toolbar links stay current). The watcher reports to the canvas: the user sees whether Claude is watching, and an amber warning as soon as it stops. **Re-arm promptly when Monitor times out**, so the warning doesn't stay up. Each new user comment or reply arrives as a `TASK <id> on <target> …` line. Open threads: `comments.sh list`. **Never read `canvas-resolved.json`.**
2. **Decide who does the work:**
   - **≤ 2 open tasks:** do them yourself.
   - **More than 2:** you become the **coordinator**. Hand each task to a background Sonnet subagent with a self-contained prompt: the comment id, target and text, the exact files, what "done" looks like, and the `comments.sh` commands.
   - **One writer at a time** for `issues.json` and rebuilds. Verify-and-reply tasks get read-only agents. Identical duplicate comments go to one agent.
3. **Per task:** `comments.sh start <id>` → do the work (edit `issues.json`, `python3 build.py`) → `comments.sh reply <id> "what changed, in one or two lines"` (this also marks it done; add `--open` only if you are still working on it). A new user reply puts the task back to To do automatically.
   - **One at a time, visible as you go:** prefer to `start` a task when you begin it, and to rebuild and `reply` as soon as its change is built, before starting the next, so the user sees each change land as it happens. As coordinator, prefer to rebuild and reply for each subagent's task as it reports.
4. **Never resolve, restore or purge anything.** The server refuses it from you; only the user resolves, in the To-dos.
   - If a comment asks you to delete an issue, `comments.sh remove <cid> "title"` moves it to the Deleted tab, where the user confirms.
   - Numbers never shift.
5. **Comments follow their subject.** If your work lands on another step (the comment asked for new screens, such as states, and you added them elsewhere; or you split a screen or moved what it's about), move each thread to where it is now relevant: `comments.sh move <id> <cardId> "Moved here from <n>: why"`. The thread keeps its history, and the old card shows a link to it. Move it to the new step (the first one if there are several). If a comment covers both screens, leave it on the original and mention the new one in your reply. Do this before replying, so the user doesn't have to ask.
6. **Verify** with `comments.sh list` and by checking the rebuilt page before you say a task is done.

A `TODOS n open…` line (once per start) counts your own to-dos still waiting for their screens: take them up when no comment is waiting, or remove ones no longer wanted.

Replies are short and factual: what you changed, where, and anything you couldn't verify. Refer to screens and issues by their number and title ("39 · Name the team"), the number the user sees; internal ids (`ca3`) stay out of replies and chat.
- **Long or cut-off comments:** the watcher line carries the first 6000 characters and ends with `…[cut: N more characters …]` when there was more. If a comment seems to stop mid-sentence, or you see that mark, read the whole text with `comments.sh list` before replying. Never answer about a missing ending.
- **Threads on deleted issues or steps:** reply if the user asks something there, but don't act on the deleted item itself; it's out of scope (see SKILL.md).
- **Removing a step:** use `comments.sh remove <id> "title"` (it moves to Deleted with its threads); never cut it out of the data file by hand. If one does go missing from the file, the next build brings it back as Deleted so its comments keep a home.
