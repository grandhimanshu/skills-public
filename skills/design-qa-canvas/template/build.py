#!/usr/bin/env python3
"""Build canvas.html from issues.json (same folder).

    python3 build.py [issues.json] [canvas.html]

issues.json is the single source of truth. Each issue gets a unique, stable number `n`
(assigned on first build and written back, never renumbered). Card ids (comments, priorities,
read state) are `code` if given (e.g. "S4", "A2") else str(n).

The page is static: body.html + styles.css + canvas.js inlined, plus the issues as one JSON block.
Everything the reviewer changes on the canvas is stored by server.mjs in canvas-*.json and applied
by canvas.js at load, so a rebuild never loses it.
"""
import json, sys, pathlib

HERE = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'issues.json'
out = HERE / (sys.argv[2] if len(sys.argv) > 2 else 'canvas.html')
cfg = json.load(open(src, encoding='utf-8'))
KINDS = {'gap', 'ux', 'dec', 'later', 'ctx'}
FLOW = 'steps' in cfg                # workflow-canvas: {steps:[{id,title,note,img,prev?}], edges:[[from,to]], flows?:{startId:name}}
if FLOW:
    import hashlib
    steps = cfg['steps']; nxt = max([x['n'] for x in steps if 'n' in x], default=0)
    for st in steps:
        if 'n' not in st: nxt += 1; st['n'] = nxt
        st.setdefault('id', str(st['n']))
    json.dump(cfg, open(src, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    def ver(img):   # changes when the screenshot file changes -> the step shows as New again
        f = HERE / img if img else None
        return hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f and f.exists() else ''
    cfg.setdefault('sections', []); cfg['issues'] = []

PORT = cfg.get('port', 4200)
hl = cfg.get('highlight')            # optional: {"label": "Alex’s points", "chip": "Alex"}
sections = list(cfg['sections'])
issues = cfg['issues']

nxt = max([i['n'] for i in issues if 'n' in i], default=0)
for it in issues:
    if 'n' not in it:
        nxt += 1; it['n'] = nxt
    if it['kind'] not in KINDS: raise SystemExit(f"issue {it.get('code') or it['n']}: kind must be one of {sorted(KINDS)}")
    if it['section'] not in sections: sections.append(it['section'])
json.dump(cfg, open(src, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

if FLOW:
    data = {'mode': 'flow', 'title': cfg.get('title', 'Flow'), 'port': PORT, 'highlight': None, 'sections': [],
            'flowNames': cfg.get('flows', {}), 'edges': cfg.get('edges', []), 'issues': [],
            'steps': [{'cid': str(st['id']), 'n': st['n'], 'title': st.get('title', ''), 'out': st.get('note', ''), 'what': st.get('what', ''),
                       'img': st.get('img'), 'prev': st.get('prev'), 'v': ver(st.get('img')), 'kind': 'gap', 'section': '', 'sugg': st.get('sugg', [])} for st in steps]}
else:
  data = {'title': cfg.get('title', 'Design QA'), 'port': PORT, 'highlight': hl, 'sections': sections,
          'issues': [{'cid': str(it.get('code') or it['n']), 'n': it['n'], 'section': it['section'], 'kind': it['kind'],
                    'title': it['title'], 'what': it.get('what', ''), 'out': it.get('out', ''), 'img': it.get('img'),
                    'ts': it.get('ts', ''), 'hl': bool(it.get('highlight')), 'sugg': it.get('sugg', []), 'screen': it.get('screen', '')} for it in issues]}
data['app'] = cfg.get('app')   # optional {url, repo, branch}: the Open app button
blob = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')

body = (HERE / 'body.html').read_text(encoding='utf-8')
body = body.replace('__HL_LABEL__', (hl or {}).get('label', 'Flagged')).replace('__PORT__', str(PORT))
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="canvas-port" content="{PORT}" /><title>{data['title']}</title>
<style>
{(HERE / 'styles.css').read_text(encoding='utf-8')}
</style></head><body>
{body}
<script id="qa-data" type="application/json">{blob}</script>
<script>
{(HERE / 'canvas.js').read_text(encoding='utf-8')}
</script></body></html>'''
out.write_text(page, encoding='utf-8')

state = HERE / 'canvas-state.json'      # first build: everything present counts as read
if not state.exists():
    json.dump({'seen': [d['cid'] + ('@' + d['v'] if d.get('v') else '') for d in (data.get('steps') or data['issues'])]}, open(state, 'w'), indent=2)
print(f'built {out.name}: ' + (f"{len(data['steps'])} steps" if FLOW else f'{len(issues)} issues in {len(sections)} sections') + f' -> http://localhost:{PORT}')
