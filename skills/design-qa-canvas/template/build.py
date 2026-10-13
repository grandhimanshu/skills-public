#!/usr/bin/env python3
"""Build canvas.html from issues.json (same folder).

    python3 build.py [issues.json] [canvas.html]          # live canvas, with server.mjs
    python3 build.py issues.json view.html --view        # read-only page for viewers (e.g. Vercel)

issues.json is the single source of truth. Each issue gets a unique, stable number `n`
(assigned on first build and written back, never renumbered). Card ids (comments, priorities,
read state) are `code` if given (e.g. "S4", "A2") else str(n).

The page is static: body.html + styles.css + canvas.js inlined, plus the issues as one JSON block.
Everything the reviewer changes on the canvas is stored by server.mjs in canvas-*.json and applied
by canvas.js at load, so a rebuild never loses it.
"""
import json, sys, pathlib

HERE = pathlib.Path(__file__).parent
VIEW = '--view' in sys.argv          # read-only: the server's state is baked in, no comments, no editing
sys.argv = [a for a in sys.argv if a != '--view']
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / ('issues.json' if (HERE / 'issues.json').exists() else 'flows.json')
PAGE = HERE / 'canvas-page.txt'   # the page the server shows: a later plain `python3 build.py` writes the same file
out = HERE / (sys.argv[2] if len(sys.argv) > 2 else (PAGE.read_text().strip() if PAGE.exists() else 'canvas.html'))
if len(sys.argv) > 2 and not VIEW: PAGE.write_text(sys.argv[2])
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
    VERS = HERE / 'canvas-imgver.json'   # {stepId: [v, look]}: v only changes when the screenshot really changes
    vers = json.load(open(VERS)) if VERS.exists() else {}
    def look(f):   # 16x16 grey thumbnail: the same screen at a higher resolution looks the same
        try:
            from PIL import Image
            with Image.open(f) as im: return list(im.convert('L').resize((16, 16)).getdata())
        except Exception: return None
    def ver(img, sid):   # changes when the screenshot changes -> the step shows as New again; a sharper copy of the same screen stays read
        f = HERE / img if img else None
        if not (f and f.exists()): return ''
        v, lk = hashlib.sha1(f.read_bytes()).hexdigest()[:8], look(f)
        old = vers.get(sid)
        if old and old[0] != v and lk and old[1] and sum(abs(a - b) for a, b in zip(lk, old[1])) / 256 < 6: v = old[0]
        vers[sid] = [v, lk]
        return v
    cfg.setdefault('sections', []); cfg['issues'] = []

import re
EDITS = HERE / 'canvas-edits.json'
if EDITS.exists():
    ed = json.load(open(EDITS, encoding='utf-8')); before = json.dumps(ed)
    def tidy(h): return re.sub(r'\s(style|class|color|face|size)="[^"]*"', '', re.sub(r'</?(span|font)\b[^>]*>', '', h)) if isinstance(h, str) else h
    for k, e in ed.items():
        if not isinstance(e, dict) or k == 'sections': continue
        if 'out' in e:
            o = e.pop('out')
            if o or e.get('what'): e['what'] = '<br>'.join(x for x in (o, e.get('what', '')) if x)
        for f in ('title', 'what'):
            if f in e: e[f] = tidy(e[f])
    if json.dumps(ed) != before: json.dump(ed, open(EDITS, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
PORT = cfg.get('port', 4200)
hl = cfg.get('highlight')            # optional: {"label": "Alex’s points", "chip": "Alex"}
sections = list(cfg['sections'])
issues = cfg['issues']

nxt = max([i['n'] for i in issues if 'n' in i], default=0)
for it in issues:
    if 'out' in it:   # older issues had a separate line under the heading: it is now the first line of the details
        o = it.pop('out'); it['what'] = '<br>'.join(x for x in (o, it.get('what', '')) if x)
    if 'n' not in it:
        nxt += 1; it['n'] = nxt
    if it['kind'] not in KINDS: raise SystemExit(f"issue {it.get('code') or it['n']}: kind must be one of {sorted(KINDS)}")
    if it['section'] not in sections: sections.append(it['section'])
json.dump(cfg, open(src, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

refOf, refLb = {}, {}   # a design reference on one issue of a shared screenshot serves the whole card
for it in issues:
    if it.get('ref') and it.get('screen'): refOf.setdefault(it['screen'], it['ref']); refLb.setdefault(it['screen'], it.get('refLabel', ''))
if FLOW:
    data = {'mode': 'flow', 'title': cfg.get('title', 'Flow'), 'port': PORT, 'highlight': None, 'sections': [],
            'flowNames': cfg.get('flows', {}), 'edges': cfg.get('edges', []), 'issues': [],
            'steps': [{'cid': str(st['id']), 'n': st['n'], 'title': st.get('title', ''), 'what': '<br>'.join(x for x in (st.get('note', ''), st.get('what', '')) if x),
                       'img': st.get('img'), 'prev': st.get('prev'), 'v': ver(st.get('img'), str(st['id'])), 'kind': 'gap', 'section': '', 'sugg': st.get('sugg', [])} for st in steps]}
else:
  data = {'title': cfg.get('title', 'Design QA'), 'port': PORT, 'highlight': hl, 'sections': sections,
          'issues': [{'cid': str(it.get('code') or it['n']), 'n': it['n'], 'section': it['section'], 'kind': it['kind'],
                    'title': it['title'], 'what': it.get('what', ''), 'img': it.get('img'),
                    'ts': it.get('ts', ''), 'hl': bool(it.get('highlight')), 'sugg': it.get('sugg', []), 'screen': it.get('screen', ''),
                    'ref': it.get('ref') or refOf.get(it.get('screen') or '\0'), 'refLabel': it.get('refLabel') or refLb.get(it.get('screen') or '\0', '')} for it in issues]}
if VIEW:   # bake in what the server would answer, so titles, notes, deletions and priorities match the live canvas
    rd = lambda n, d: json.load(open(HERE / n, encoding='utf-8')) if (HERE / n).exists() else d
    data['view'] = True
    data['snap'] = {'edit': rd('canvas-edits.json', {}), 'removed': rd('canvas-removed.json', {}), 'priorities': rd('canvas-priorities.json', {}),
                    'suggestions': rd('canvas-suggestions.json', {}), 'added': rd('canvas-added.json', {'items': []}),
                    'state': {'seen': [d['cid'] + ('@' + d['v'] if d.get('v') else '') for d in (data.get('steps') or data['issues'])]}}
def imgmeta(img):   # [w, h, tiny pixelated preview]: the card keeps its size while the screenshot loads, nothing jumps
    f = HERE / img
    try:
        from PIL import Image
        import base64, io
        with Image.open(f) as im:
            w, h = im.size; t = im.convert('RGB'); t.thumbnail((24, 24 * h // max(w, 1) or 1))
            buf = io.BytesIO(); t.save(buf, 'PNG', optimize=True)
            return [w, h, 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()]
    except Exception:
        return None   # no Pillow or no file: the page falls back to sizing on load
data['imgs'] = {}
for d in (data.get('steps') or data['issues']):
    for im in (d.get('img'), (d.get('prev') or {}).get('img'), d.get('ref')):
        if im and im not in data['imgs'] and (m := imgmeta(im)): data['imgs'][im] = m
if FLOW: json.dump(vers, open(VERS, 'w'))
if VIEW and FLOW:   # viewers see the current state only
    for st in data['steps']: st['prev'] = None
import hashlib as _h, datetime as _dt
DEP = HERE / 'canvas-deploy.json'   # {version, at, hash}: goes up once per view build whose content changed
dep = json.load(open(DEP)) if DEP.exists() else {}
if VIEW:
    hv = _h.sha1((json.dumps(data, sort_keys=True, ensure_ascii=False) + ''.join((HERE / f).read_text(encoding='utf-8') for f in ('body.html', 'styles.css', 'canvas.js'))).encode()).hexdigest()[:12]   # content or template changed
    if dep.get('hash') != hv:
        dep = {'version': dep.get('version', 0) + 1, 'at': _dt.datetime.now().strftime('%b %-d, %Y, %H:%M'), 'hash': hv}
        json.dump(dep, open(DEP, 'w'), indent=2)
data['deploy'] = {'version': dep.get('version'), 'at': dep.get('at'), 'url': (cfg.get('deploy') or {}).get('url')}
app = dict(cfg.get('app') or {}); app.pop('dir', None)   # dir: local repo folder, used by scripts/app-links.py only
if VIEW: app.pop('local', None)
data['app'] = app or None   # optional {url, repo, branch}: the Open app button
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
if not VIEW and not state.exists():
    json.dump({'seen': [d['cid'] + ('@' + d['v'] if d.get('v') else '') for d in (data.get('steps') or data['issues'])]}, open(state, 'w'), indent=2)
print(f'built {out.name}: ' + (f"{len(data['steps'])} steps" if FLOW else f'{len(issues)} issues in {len(sections)} sections') + f' -> http://localhost:{PORT}')
