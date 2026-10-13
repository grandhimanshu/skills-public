# Deploying and toolbar links

Optional: read only when the user asks to deploy or publish the canvas, or to set up its toolbar links.

## Deploying (always the view build)

```bash
python3 build.py flows.json index.html --view
```
- Every deployment (Vercel, GitLab Pages, any host) uses `--view`; the live canvas with its server and watchers stays local.
- Viewers get the Screens list only, current state only: no comments, read/unread, editing, deleting or paste, and no previous screenshots (Alt is off).
- The user's live changes (titles, details, deleted steps) are baked in, so rebuild before each deploy.
- Deploy `index.html` with `shots/`. Put the deployed address in `"deploy": {"url": …}`.
- The version (v1, v2…) and date go up by themselves when a view build's content changed (`canvas-deploy.json`). The ⋯ menu shows them; on the live canvas it reads "Last deployed …" or "Not deployed yet".
- Every build records each screenshot's size and a tiny pixelated preview (Pillow, optional), so cards keep their place while images load.

## Toolbar links (`"app"` in flows.json)
`{"repo": …, "branch": …, "dir": local repo folder, "localPort"?: …, "url"?: hosted app}`. `"design"`: design references the build is compared against, any number, each a URL or `{"label": "Figma", "url": …}` (a Figma file, a design branch, any page). All links sit in the ⋯ menu, design references included: Branch (repo on `branch`, ships in the view), Local build (live canvas only), Live app (`url`, if set), Published canvas (`deploy.url`). `scripts/app-links.py <canvas folder>` refreshes branch and local link from `dir`; the watchers run it when they re-arm.
