#!/usr/bin/env python3
"""Publish a canvas's view build to an HTML-pages host as ONE self-contained file (screenshots embedded once, compressed).

    python3 publish-pages.py <canvas folder> "<document name>" [--dry]

Reads <canvas folder>/index.html (build it first: python3 build.py <data> index.html --view).
Host and key: env PAGES_URL and PAGES_KEY, or the files ~/.config/pages/url and ~/.config/pages/api-key (mode 600).
The same name overwrites the same page. --dry writes <canvas folder>/publish.html and stops.
"""
import base64, io, json, os, re, sys, urllib.request, pathlib
d = pathlib.Path(sys.argv[1]); name = sys.argv[2]; dry = '--dry' in sys.argv
s = (d / 'index.html').read_text(encoding='utf-8')
data = json.loads(re.search(r'qa-data" type="application/json">(.*?)</script>', s, re.S).group(1))
rm = (data.get('snap') or {}).get('removed', {})
items = (data.get('issues') or []) + (data.get('steps') or []) + ((data.get('snap') or {}).get('added') or {}).get('items', [])
paths = {p for i in items if not rm.get(i.get('cid')) for p in (i.get('img'), i.get('ref'), (i.get('prev') or {}).get('img')) if p}
try:
    from PIL import Image
except ImportError:
    Image = None
M = {}
for p in paths:
    f = d / p
    if not f.exists(): continue
    if Image:
        im = Image.open(f).convert('RGB')
        if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'JPEG', quality=78, optimize=True); M[p] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    else:
        M[p] = 'data:image/' + f.suffix.lstrip('.').replace('jpg', 'jpeg') + ';base64,' + base64.b64encode(f.read_bytes()).decode()
hook = ("<script>/* screenshots embedded once: swap paths for the data before the canvas reads them */(()=>{const M=" + json.dumps(M) +
        ",el=document.getElementById('qa-data'),d=JSON.parse(el.textContent),f=o=>{if(!o)return;for(const k of ['img','ref'])if(M[o[k]])o[k]=M[o[k]];if(o.prev&&M[o.prev.img])o.prev.img=M[o.prev.img]};"
        "(d.issues||[]).forEach(f);(d.steps||[]).forEach(f);((d.snap||{}).added||{items:[]}).items.forEach(f);d.imgs={};el.textContent=JSON.stringify(d)})()</script>\n<script>")
i = s.rfind('<script>'); html = s[:i] + hook + s[i + len('<script>'):]
print(f'{len(M)} screenshots, {len(html) / 1e6:.1f} MB')
if dry: (d / 'publish.html').write_text(html, encoding='utf-8'); sys.exit()
cfg = pathlib.Path.home() / '.config/pages'
key = os.environ.get('PAGES_KEY') or (cfg / 'api-key').read_text().strip()
url = (os.environ.get('PAGES_URL') or (cfg / 'url').read_text().strip()).rstrip('/') + '/api/v1/publish'
req = urllib.request.Request(url, data=json.dumps({'name': name, 'html_content': html, 'overwrite': True}).encode(),
                             headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}, method='POST')
try:
    r = urllib.request.urlopen(req, timeout=120); print(r.status, r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print('error', e.code, e.read().decode()[:500]); sys.exit(1)
