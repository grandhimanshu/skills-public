#!/usr/bin/env bash
# Helper for Claude and its subagents to work the review thread. PORT defaults to 4200.
#   comments.sh list                         open comments (what to work on) — never read the resolved archive
#   comments.sh start  <id>                  status -> In progress (blue)
#   comments.sh reply  <id> "text" [--open]   reply as Claude and mark it done (--open: still working)
#   comments.sh done   <id>                  status -> Done (green)
#   comments.sh prio   <cardId> high|med|low set a card's priority
#   comments.sh seen   <cardId> <img>       mark this exact screenshot read (run in the canvas folder; key = id@sha1(img)[:8], as build.py does)
#   comments.sh new    <cardId> 1|0          1 = bring back the NEW mark, 0 = clear it
#   comments.sh inbox                        screenshots waiting for context (picked up from the Desktop by the server)
#   comments.sh discard <INid>             screenshot isn't relevant to this canvas: drop this canvas's copy (the Desktop file stays)
#   comments.sh inbox-done <INid> <code>     mark an inbox screenshot as added (code = the S<n> issue you created)
#   comments.sh move   <id> <cardId> "note"  move a thread to the step/issue it is now about (note says why; shown in the thread)
#   comments.sh fixes                        done items: which of issue / design / fix screenshots exist, the fix link, and the Fixed tab's switch
#   comments.sh fix <cardId> <img> [link]    attach the after-fix screenshot (copied into screenshots/fixes/; run in the canvas folder) and optionally where to test it
#   comments.sh fixlink <cardId> <url>       save where the fix can be tested (prod / staging link)
#   comments.sh ask <cardId> "text"         start a thread as Claude on an issue (e.g. ask where the fix can be tested); marked done so it waits for the user
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
  [ "${4:-}" = "--open" ] || "$0" done "$2"   # a reply is the answer, so the thread is done; pass --open if you're still working on it
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
  discard) curl -s -X POST "$B/api/inbox/$2/discard" -H "$J" -d '{}' && echo;;
  inbox-done) curl -s -X POST "$B/api/inbox/$2" -H "$J" -d "{\"processed\":true,\"issue\":\"$3\"}" >/dev/null && echo "inbox $2 -> $3";;
  move) python3 - "$B" "$2" "$3" "${4:-}" <<'PY'
import sys,json,urllib.request
b,i,c,n=sys.argv[1:5]
r=urllib.request.Request(f"{b}/api/comments/{i}/move",data=json.dumps({"target":"card:"+c,"note":n,"by":"Claude"}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("moved:",i,"->",c)
PY
  ;;
  fixes) python3 - "$B" <<'PY'
import sys,json,re,urllib.request
b=sys.argv[1]; g=lambda u: json.load(urllib.request.urlopen(b+u))
fixed=g('/api/fixed'); fx=g('/api/fixes'); on=g('/api/fixcheck').get('on')
iss={}; 
try:
    for i in g('/issues.json')['issues']: iss[str(i.get('code') or i['n'])]=i
except Exception: pass
try:
    for i in g('/api/added')['items']: iss[str(i['cid'])]=i
except Exception: pass
print('Fixed tab switch (fill in missing screenshots when nothing else is waiting):','ON' if on else 'OFF'); print(f'{len(fixed)} item(s) marked done')
for c in sorted(fixed, key=lambda k:(len(k),k)):
    i=iss.get(c,{}); s=fx.get(c,{}); a=i.get('fix'); a={'img':a} if isinstance(a,str) else (a or {})
    img=s.get('img') or a.get('img'); link=s.get('open') or a.get('open')
    miss=[n for n,ok in (('design',bool(i.get('ref'))),('fix',bool(img))) if not ok]
    t=re.sub('<[^>]+>','',i.get('title',''))[:60]
    print(f"{c} #{i.get('n','?')} \"{t}\" | issue: yes design: {'yes' if i.get('ref') else 'MISSING'} fix: {'yes' if img else 'MISSING'} | test link: {link or 'MISSING'}{' (asked)' if s.get('asked') and not link else ''}")
PY
  ;;
  fix) python3 - "$B" "$2" "$3" "${4:-}" <<'PY'
import sys,json,os,shutil,time,urllib.request
b,c,img,link=sys.argv[1:5]
if not os.path.isfile(img): sys.exit(f"no such file: {img}")
rel=os.path.relpath(os.path.abspath(img))
if rel.startswith('..'):   # outside this canvas folder: copy it in (run this in the canvas folder)
    os.makedirs('screenshots/fixes',exist_ok=True); rel=f"screenshots/fixes/{c}-{int(time.time())}{os.path.splitext(img)[1] or '.png'}"; shutil.copy(img,rel)
body={'cid':c,'img':rel}
if link: body['open']=link
r=urllib.request.Request(f"{b}/api/fixes",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
print("fix attached:",c,"->",rel,("| test link "+link) if link else "", "(rebuild the canvas to see it in the page's image metadata: python3 build.py)")
urllib.request.urlopen(r)
PY
  ;;
  fixlink) python3 - "$B" "$2" "$3" <<'PY'
import sys,json,urllib.request
b,c,u=sys.argv[1:4]
r=urllib.request.Request(f"{b}/api/fixes",data=json.dumps({"cid":c,"open":u}).encode(),headers={"Content-Type":"application/json"})
urllib.request.urlopen(r); print("fix link saved:",c,u)
PY
  ;;
  ask) python3 - "$B" "$2" "$3" <<'PY'
import sys,json,urllib.request
b,c,t=sys.argv[1:4]
def post(u,d): return json.load(urllib.request.urlopen(urllib.request.Request(b+u,data=json.dumps(d).encode(),headers={"Content-Type":"application/json"})))
th=post('/api/comments',{"target":"card:"+c,"text":t,"by":"Claude"})
post(f"/api/comments/{th['id']}/flags",{"status":"done"}); post('/api/fixes',{"cid":c,"asked":True}); print("asked on",c,"(thread",th['id']+"): waiting for the user's reply")
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
