#!/usr/bin/env python3
"""Emit one line per NEW screenshot in the canvas inbox (the server moves new Desktop screenshots there). Run under Monitor.
Usage: watch-inbox.py [port=4200].  On each event: read the image, add an issue (code S<next>) to issues.json / the generator,
rebuild, then `comments.sh inbox-done <INid> <code>`. Do not ask the user to drop screenshots anywhere else."""
import json, sys, time, signal, atexit, urllib.request
port = sys.argv[1] if len(sys.argv) > 1 else '4200'

def report(state, why=''):   # tell the canvas whether Claude is watching (shown in the side pane)
    try: urllib.request.urlopen(urllib.request.Request(f'http://localhost:{port}/api/watchers', data=json.dumps({'name': 'screenshots', 'state': state, 'why': why}).encode(), headers={'Content-Type': 'application/json'}), timeout=3)
    except Exception: pass
atexit.register(report, 'off', 'watcher stopped')
for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT): signal.signal(sig, lambda *_: sys.exit(0))
seen = None
while True:
    report('on')
    try:
        items = json.load(urllib.request.urlopen(f'http://localhost:{port}/api/inbox', timeout=5))['items']
        live = [i for i in items if not (i.get('processed') or i.get('deleted') or i.get('resolved'))]   # deleted/resolved by the user = nothing to do
        ids = {i['id'] for i in live}
        if seen is None: seen = set()          # report everything still waiting on the first poll
        for i in live:
            if i['id'] not in seen:
                print(f"INBOX {i['id']} {i['file']} (taken {i['at']})", flush=True)
        seen |= ids
    except Exception:
        pass
    time.sleep(4)
