# comment-watcher

Tools: this skill's `scripts/` (`watch-comments.py`, `comments.sh`). Set `PORT` to the canvas port.

1. **Watch.** Run `watch-comments.py <port>` under **Monitor** (re-arm every 30 min). The watcher reports to the canvas: the user sees whether Claude is watching, and an amber warning as soon as it stops. **Re-arm promptly when Monitor times out**, so the warning doesn't stay up. Each new user comment or reply arrives as a `TASK <id> on <target> …` line. Open threads: `comments.sh list`. **Never read `canvas-resolved.json`.**
2. **Decide who does the work:**
   - **≤ 2 open tasks:** do them yourself.
   - **More than 2:** you become the **coordinator**. Hand each task to a background Sonnet subagent with a self-contained prompt: the comment id, target and text, the exact files, what "done" looks like, and the `comments.sh` commands.
   - **One writer at a time** for `issues.json` and rebuilds. Verify-and-reply tasks get read-only agents. Identical duplicate comments go to one agent.
3. **Per task:** `comments.sh start <id>` → do the work (edit `issues.json`, `python3 build.py`) → `comments.sh reply <id> "what changed, in one or two lines"` → `comments.sh done <id>`. A new user reply puts the task back to To do automatically.
4. **Never resolve, restore or purge anything.** The server refuses it from you; only the user resolves, in the To-dos.
   - If a comment asks you to delete an issue, `comments.sh remove <cid> "title"` moves it to the Deleted tab, where the user confirms.
   - Numbers never shift.
5. **Comments follow their subject.** If your work splits a screen into two (or moves what a comment is about to another step or issue), move each thread to where it is now relevant: `comments.sh move <id> <cardId> "Moved here from <n>: why"`. The thread keeps its history, and the old card shows a link to it. If a comment covers both screens, leave it on the original and mention the new one in your reply.
6. **Verify** with `comments.sh list` and by checking the rebuilt page before you say a task is done.

Replies are short and factual: what you changed, where, and anything you couldn't verify.
