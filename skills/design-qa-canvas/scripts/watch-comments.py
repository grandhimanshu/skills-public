#!/usr/bin/env python3
"""Emit one line per NEW the user comment/reply (a task for Claude). Run under the Monitor tool.  Usage: watch-comments.py [port=4200]
Reads only the OPEN comments endpoint — resolved threads are archived server-side and never appear here."""
import json, sys, time, signal, atexit, urllib.request
port = sys.argv[1] if len(sys.argv) > 1 else '4200'

def report(state, why=''):   # tell the canvas whether Claude is watching (shown in the side pane)
    try: urllib.request.urlopen(urllib.request.Request(f'http://localhost:{port}/api/watchers', data=json.dumps({'name': 'comments', 'state': state, 'why': why}).encode(), headers={'Content-Type': 'application/json'}), timeout=3)
    except Exception: pass
atexit.register(report, 'off', 'watcher stopped')
for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT): signal.signal(sig, lambda *_: sys.exit(0))
seen = {}
asked_here, fixes_sig, fixes_at, fx_check = set(), None, 0, 0

def get(u):
    return json.load(urllib.request.urlopen(f'http://localhost:{port}{u}', timeout=5))

def fix_lines(open_comments):
    """Fixed tab: (1) a done item with no link to test the fix: Claude should ask the user where to test it (comments.sh ask).
    (2) only when the Fixed tab's switch is ON and nothing else is waiting: done items that lack a design or fix screenshot."""
    global fixes_sig, fixes_at
    fixed, fx = get('/api/fixed'), get('/api/fixes')
    iss = {}
    try:
        for i in get('/issues.json')['issues']: iss[str(i.get('code') or i['n'])] = i
    except Exception: pass
    try:
        for i in get('/api/added')['items']: iss[str(i['cid'])] = i
    except Exception: pass
    def title(c): return ' '.join(str(iss.get(c, {}).get('title', '')).replace(chr(10), ' ').split())[:60]
    for c in sorted(fixed):
        a = (iss.get(c, {}).get('fix')); a = {'img': a} if isinstance(a, str) else (a or {})
        s = fx.get(c, {})
        if not (s.get('open') or a.get('open')) and not s.get('asked') and c not in asked_here:
            asked_here.add(c)
            print(f'FIXLINK {c} #{iss.get(c, {}).get("n", "?")} "{title(c)}" is marked done but there is no link to test the fix. Ask the user in its thread where to test it (prod / staging link): comments.sh ask {c} "Where can I test this fix? Paste a prod or staging link."', flush=True)
    if get('/api/fixcheck').get('on') and not open_comments:
        try: waiting = [i for i in get('/api/inbox')['items'] if not i.get('processed') and not i.get('deleted') and not i.get('resolved')]
        except Exception: waiting = []
        if not waiting:
            miss = []
            for c in sorted(fixed):
                i = iss.get(c, {}); s = fx.get(c, {}); a = i.get('fix'); a = {'img': a} if isinstance(a, str) else (a or {})
                lack = [n for n, ok in (('design', bool(i.get('ref'))), ('fix', bool(s.get('img') or a.get('img')))) if not ok]
                if lack: miss.append(f"{c} ({'+'.join(lack)})")
            sig = ','.join(miss)
            if miss and (sig != fixes_sig or time.time() - fixes_at > 1200):
                fixes_sig, fixes_at = sig, time.time()
                print(f"FIXES {len(miss)} done item{'s' if len(miss) > 1 else ''} lack a design or fix screenshot: {', '.join(miss)}. Nothing else is waiting: capture them (comments.sh fixes shows the details, comments.sh fix <id> <image> [link] attaches one).", flush=True)

try:   # once per start (each re-arm): a count of your own to-dos still waiting for their screens, so forgotten ones get picked up
    cfg = json.load(urllib.request.urlopen(f'http://localhost:{port}/flows.json', timeout=5))
    ids = {str(s.get('id')) for s in cfg.get('steps', [])}
    n = sum(1 for t in cfg.get('todos', []) if not any(str(x) in ids for x in t.get('steps', [])))
    if n: print(f"TODOS {n} open to-do{'s' if n > 1 else ''} in flows.json: take a look if nothing else is on your plate", flush=True)
except Exception:
    pass
while True:
    report('on')
    try:
        cs = json.load(urllib.request.urlopen(f'http://localhost:{port}/api/comments', timeout=5))['comments']
        pending = [c for c in cs if c.get('status', 'todo') in ('todo', 'inprogress') and c['thread'][-1]['by'] != 'Claude']
        if time.time() - fx_check > 20:
            fx_check = time.time()
            try: fix_lines(pending)
            except Exception: pass
        for c in cs:
            last = c['thread'][-1]
            if last['by'] != 'Claude' and seen.get(c['id']) != len(c['thread']):
                seen[c['id']] = len(c['thread'])
                txt = ' ⏎ '.join(last['text'].split(chr(10)))   # keep in step with CMAX in canvas.js
                cut = f" …[cut: {len(txt) - 6000} more characters. Read the whole comment with comments.sh list before replying]" if len(txt) > 6000 else ''
                print(f"TASK {c['id']} on {c['target']} [{c.get('title','')[:50]}]: User: {txt[:6000]}{cut}", flush=True)
    except Exception:
        pass
    time.sleep(4)
