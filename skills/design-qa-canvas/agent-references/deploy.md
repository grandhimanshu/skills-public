# Deploying and toolbar links

Optional: read only when the user asks to deploy or publish the canvas, or to set up its toolbar links.

## Deploying (always the view build)

```bash
python3 build.py issues.json index.html --view
```
- Every deployment (Vercel, GitLab Pages, any host) uses `--view`; the live canvas with its server and watchers stays local.
- Viewers get the Issues list only: no comments, read/unread, priorities, editing, adding, deleting or paste. Design references (`ref`, Alt) stay.
- The user's live changes (edited titles, deletions, accepted suggestions, added issues) are baked in, so rebuild before each deploy.
- Deploy `index.html` with the screenshot folders. Put the deployed address in `"deploy": {"url": …}`.
- The version (v1, v2…) and date go up by themselves when a view build's content changed (`canvas-deploy.json`). The ⋯ menu shows them; on the live canvas it reads "Last deployed …" or "Not deployed yet".
- Every build records each screenshot's size and a tiny pixelated preview (Pillow, optional), so cards keep their place while images load.

## Toolbar links (`"app"` in issues.json)
`{"url": reference build under review, "repo": …, "branch": …, "dir": local repo folder, "localPort"?: …}`. All links sit in the ⋯ menu: Build under review (`url`), Branch (repo on `branch`), Local build (live canvas only), Published canvas (`deploy.url`). `scripts/app-links.py <canvas folder>` refreshes branch and local link from `dir`; the watchers run it when they re-arm.
