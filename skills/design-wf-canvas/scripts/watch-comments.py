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
        for c in json.load(urllib.request.urlopen(f'http://localhost:{port}/api/comments', timeout=5))['comments']:
            last = c['thread'][-1]
            if last['by'] != 'Claude' and seen.get(c['id']) != len(c['thread']):
                seen[c['id']] = len(c['thread'])
                txt = ' ⏎ '.join(last['text'].split(chr(10)))   # keep in step with CMAX in canvas.js
                cut = f" …[cut: {len(txt) - 6000} more characters. Read the whole comment with comments.sh list before replying]" if len(txt) > 6000 else ''
                print(f"TASK {c['id']} on {c['target']} [{c.get('title','')[:50]}]: User: {txt[:6000]}{cut}", flush=True)
    except Exception:
        pass
    time.sleep(4)
