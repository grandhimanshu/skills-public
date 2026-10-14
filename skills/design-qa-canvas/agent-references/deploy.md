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
- **Unread for viewers:** what's new since the previous deployment shows as unread on the published page (dots and the Unread chip, not clickable); everything else is read. The live canvas keeps its own read state. `canvas-deploy.json` keeps each version's ids (`cids`, `prevCids`).
- The version (v1, v2…) and date go up by themselves when a view build's content changed (`canvas-deploy.json`). The ⋯ menu shows them; on the live canvas it reads "Last deployed …" or "Not deployed yet".
- Every build records each screenshot's size and a tiny pixelated preview (Pillow, optional), so cards keep their place while images load.

## Publishing to a pages host (one self-contained file)
For a host that takes a single HTML file over an API (e.g. an internal "publish document" service), build the view first, then:
```bash
python3 scripts/publish-pages.py <canvas folder> "<document name>"
```
- Embeds each screenshot once (compressed JPEG), so the page needs nothing else. `--dry` writes `publish.html` without sending.
- The same name overwrites the same page, so the link stays.
- Host and key: `PAGES_URL` / `PAGES_KEY`, or the files `~/.config/pages/url` and `~/.config/pages/api-key` (mode 600). Never put the key in a repo, a chat, or the page.

## Toolbar links (`"app"` in issues.json)
`{"url": reference build under review, "repo": …, "branch": …, "dir": local repo folder, "localPort"?: …}`. `"design"`: design references the build is compared against, any number, each a URL or `{"label": "Figma", "url": …}` (a Figma file, a design branch, any page). All links sit in the ⋯ menu, design references included: Build under review (`url`), Branch (repo on `branch`), Local build (live canvas only), Published canvas (`deploy.url`). `scripts/app-links.py <canvas folder>` refreshes branch and local link from `dir`; the watchers run it when they re-arm.
