#!/usr/bin/env bash
# Helper for Claude and its subagents to work the review thread. PORT defaults to 4200.
#   comments.sh list                         open comments (what to work on) — never read the resolved archive
#   comments.sh start  <id>                  status -> In progress (blue)
#   comments.sh reply  <id> "text"           reply as Claude
#   comments.sh done   <id>                  status -> Done (green)
#   comments.sh prio   <cardId> high|med|low set a card's priority
#   comments.sh seen   <cardId> <img>       mark this exact screenshot read (run in the canvas folder; key = id@sha1(img)[:8], as build.py does)
#   comments.sh new    <cardId> 1|0          1 = bring back the NEW mark, 0 = clear it
#   comments.sh inbox                        screenshots waiting for context (picked up from the Desktop by the server)
#   comments.sh return <INid>              screenshot isn't in this canvas's scope: put it back on the Desktop for the other canvases
#   comments.sh inbox-done <INid> <code>     mark an inbox screenshot as added (code = the S<n> issue you created)
#   comments.sh move   <id> <cardId> "note"  move a thread to the step/issue it is now about (note says why; shown in the thread)
#   comments.sh remove <cardId> "title"     soft-delete an issue: it moves to the Deleted tab until the user confirms (Restore / Delete all)
# There is deliberately NO resolve/delete command: only the user resolves (the canvas UI), and only on request is anything deleted.
set -euo pipefail
B="http://localhost:${PORT:-4200}"; J='Content-Type: application/json'
case "${1:-}" in
  list)  curl -s "$B/api/comments" | python3 -c "import sys,json
for c in json.load(sys.stdin)['comments']:
    print(c['id'], c['target'], c.get('status','todo'), '|', ' / '.join(m['by']+': '+m['text'] for m in c['thread']))";;
  start) curl -s -X POST "$B/api/comments/$2/flags" -H "$J" -d '{"status":"inprogress"}' >/dev/null && echo "in progress: $2";;
  reply) python3 - "$B" "$2" "$3" <<'PY'
import sys,json,urllib.request
b,i,t=sys.argv[1:4]
r=urllib.request.Request(f"{b}/api/comments/{i}/reply",data=json.dumps({"by":"Claude","text":t}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("replied:",i)
PY
  ;;
  done)  curl -s -X POST "$B/api/comments/$2/flags" -H "$J" -d '{"status":"done"}' >/dev/null && echo "done: $2";;
  prio)  curl -s -X POST "$B/api/priorities" -H "$J" -d "{\"cid\":\"$2\",\"level\":\"$3\"}" >/dev/null && echo "priority $2 = $3";;
  new)   curl -s -X POST "$B/api/state" -H "$J" -d "{\"cid\":\"$2\",\"new\":$( [ "$3" = 1 ] && echo true || echo false )}" >/dev/null && echo "new-mark $2 = $3";;
  seen) python3 - "$B" "$2" "$3" <<'PY'
import sys,json,hashlib,pathlib,urllib.request
b,c,img=sys.argv[1:4];f=pathlib.Path(img);h=hashlib.sha1(f.read_bytes()).hexdigest()[:8]
r=urllib.request.Request(f"{b}/api/state",data=json.dumps({"cid":f"{c}@{h}","new":False}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("kept read:",c,"@",h)
PY
  ;;
  inbox) curl -s "$B/api/inbox" | python3 -c "import sys,json
for i in json.load(sys.stdin)['items']:
    print(i['id'], 'added as '+i.get('issue','?') if i.get('processed') else 'WAITING', i['file'])";;
  return) curl -s -X POST "$B/api/inbox/$2/return" -H "$J" -d '{}' && echo;;
  inbox-done) curl -s -X POST "$B/api/inbox/$2" -H "$J" -d "{\"processed\":true,\"issue\":\"$3\"}" >/dev/null && echo "inbox $2 -> $3";;
  move) python3 - "$B" "$2" "$3" "${4:-}" <<'PY'
import sys,json,urllib.request
b,i,c,n=sys.argv[1:5]
r=urllib.request.Request(f"{b}/api/comments/{i}/move",data=json.dumps({"target":"card:"+c,"note":n,"by":"Claude"}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("moved:",i,"->",c)
PY
  ;;
  remove) python3 - "$B" "$2" "${3:-}" <<'PY'
import sys,json,urllib.request
b,c,t=sys.argv[1:4]
r=urllib.request.Request(f"{b}/api/removed",data=json.dumps({"cid":c,"removed":True,"by":"Claude","title":t}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("moved to Deleted:",c)
PY
  ;;
  *) sed -n '2,20p' "$0"; exit 1;;
esac
