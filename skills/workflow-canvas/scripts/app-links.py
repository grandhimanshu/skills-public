#!/usr/bin/env python3
"""Keep a canvas's toolbar links current. Run it each time the watchers re-arm (about every 30 min).

    python3 app-links.py <canvas folder> [flows.json|issues.json] [page.html]

Reads `app.dir` (the app's local repo folder) from the data file and updates:
  app.repo / app.branch  from that repo's origin remote and current branch (the git button)
  app.local              the local dev server, only while one answers (the local button; never in a view build)
                         tried in order: app.localPort, then portless (http://<branch-slug>.localhost:1355)
Rebuilds the page only when something changed. Prints what changed, or nothing.
"""
import json, re, subprocess, sys, pathlib, urllib.request

d = pathlib.Path(sys.argv[1]).resolve()
data = d / (sys.argv[2] if len(sys.argv) > 2 else ('flows.json' if (d / 'flows.json').exists() else 'issues.json'))
page = sys.argv[3] if len(sys.argv) > 3 else 'canvas.html'
cfg = json.load(open(data, encoding='utf-8'))
app = cfg.get('app') or {}
repo_dir = app.get('dir')
if not repo_dir: sys.exit(0)
git = lambda *a: subprocess.run(['git', '-C', repo_dir, *a], capture_output=True, text=True).stdout.strip()
new = dict(app)
remote = git('remote', 'get-url', 'origin')
if remote:
    m = re.match(r'^(?:git@|ssh://git@)([^:/]+)[:/](.+?)(?:\.git)?$', remote)
    new['repo'] = f'https://{m.group(1)}/{m.group(2)}' if m else re.sub(r'\.git$', '', re.sub(r'//[^@/]+@', '//', remote))
br = git('branch', '--show-current')
if br: new['branch'] = br
def up(u):
    try: urllib.request.urlopen(u, timeout=2); return True
    except Exception as e: return getattr(e, 'code', None) is not None   # any HTTP answer means a server is there
cands = ([f"http://localhost:{app['localPort']}/"] if app.get('localPort') else []) + ([f"http://{re.sub(r'[^a-z0-9]+', '-', br.lower()).strip('-')}.localhost:1355/"] if br else [])
loc = next((u for u in cands if up(u)), None)
if loc: new['local'] = loc
else: new.pop('local', None)
if new != app:
    cfg['app'] = new
    json.dump(cfg, open(data, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    print('links updated:', ', '.join(f'{k}={new.get(k)}' for k in ('repo', 'branch', 'local') if new.get(k) != app.get(k)))
    subprocess.run([sys.executable, str(d / 'build.py'), data.name, page], cwd=d, check=True)
