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
while True:
    report('on')
    try:
        for c in json.load(urllib.request.urlopen(f'http://localhost:{port}/api/comments', timeout=5))['comments']:
            last = c['thread'][-1]
            if last['by'] != 'Claude' and seen.get(c['id']) != len(c['thread']):
                seen[c['id']] = len(c['thread'])
                print(f"TASK {c['id']} on {c['target']} [{c.get('title','')[:50]}]: User: {last['text'][:300]}", flush=True)
    except Exception:
        pass
    time.sleep(4)
