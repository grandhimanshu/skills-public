#!/usr/bin/env node
// All canvases: one list of every canvas built from the design-qa / design-wf skills (QA, workflow, and derived ones),
// whether it is running, what is waiting in it, and a Start button. No dependencies.
//
//   node canvases.mjs list [--json]        table of every canvas (running or not)
//   node canvases.mjs scan                 look for canvases on disk and add them to the registry
//   node canvases.mjs start <name|folder>  start a stopped canvas on its own port
//   node canvases.mjs serve                the "All canvases" page, always on port 4100 (CANVASES_PORT to change)
//   node canvases.mjs move-port <port> [--yes]   if a canvas sits on a port you need, move it to a free one
//
// The directory keeps ONE port. If it is taken it never picks another: it says what is using it and exits with code 3.
// Registry: ~/.claude/design-qa-canvases.json (CANVAS_REGISTRY). Folders searched: ~/Documents and ~/Desktop (CANVAS_ROOTS, ':'-separated).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import { execFileSync, spawn } from 'node:child_process'

const HOME = os.homedir()
const REG = process.env.CANVAS_REGISTRY || path.join(HOME, '.claude', 'design-qa-canvases.json')
const DIR_PORT = Number(process.env.CANVASES_PORT || 4100)
const ROOTS = (process.env.CANVAS_ROOTS || [path.join(HOME, 'Documents'), path.join(HOME, 'Desktop')].join(path.delimiter)).split(path.delimiter).filter(Boolean)
const SKIP = new Set(['node_modules', 'Library', 'scratchpad', 'shots', 'build', 'live-review', '_old-canvas'])
const SERVER_FILES = ['server.mjs', 'canvas-server.mjs']

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const real = p => { try { return fs.realpathSync(p) } catch { return p } }
const short = p => p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p

/* ---------- finding canvases ---------- */
function isCanvas(dir) {
  for (const f of SERVER_FILES) {
    const p = path.join(dir, f)
    if (!fs.existsSync(p)) continue
    try { if (/design-qa/i.test(fs.readFileSync(p, 'utf8').slice(0, 6000))) return f } catch {}
  }
  return null
}
function walk(dir, depth, out) {
  if (depth > 10) return
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  const sf = isCanvas(dir); if (sf) out.push({ root: real(dir), serverFile: sf })
  for (const e of ents) if (e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_old') && !/^old[-_]|-old$|^template|-backup/i.test(e.name) && !SKIP.has(e.name)) walk(path.join(dir, e.name), depth + 1, out)
}
function describe(root, serverFile) {
  const flows = path.join(root, 'flows.json'), issues = path.join(root, 'issues.json')
  const kind = fs.existsSync(flows) ? 'Workflow' : fs.existsSync(issues) ? 'QA' : 'Other'
  const d = readJson(kind === 'Workflow' ? flows : issues, {})
  const portFile = fs.readdirSync(root).find(f => /-port\.txt$/.test(f))
  const saved = portFile ? Number(fs.readFileSync(path.join(root, portFile), 'utf8').trim()) || null : null
  let src = ''; try { src = fs.readFileSync(path.join(root, serverFile), 'utf8') } catch {}
  const cf = (src.match(/STORE\s*=\s*path\.join\(ROOT,\s*'([^']+)'/) || [])[1] || 'canvas-comments.json'
  const renamed = (readJson(path.join(root, 'canvas-edits.json'), {}).sections || {}).__title__   // the name shown in the canvas and its browser tab (the user can rename it there)
  return { root, serverFile, kind, title: String(renamed || d.title || path.basename(root)).replace(/<[^>]+>/g, ''), items: (d.steps || d.issues || []).length || null,
    savedPort: saved, ownsPortFile: /PORT_FILE/.test(src), commentsFile: cf }
}
/* unread = items the user has not seen, from the built page's embedded data and the canvas's seen-list (a workflow step counts as seen per screenshot version) */
function unread(c) {
  try {
    const pageName = (fs.existsSync(path.join(c.root, 'canvas-page.txt')) ? fs.readFileSync(path.join(c.root, 'canvas-page.txt'), 'utf8').trim() : '') || 'canvas.html'
    const html = fs.readFileSync(path.join(c.root, pageName), 'utf8'), m = html.match(/<script id="qa-data" type="application\/json">([\s\S]*?)<\/script>/); if (!m) return null
    const D = JSON.parse(m[1].replace(/<\\\//g, '</')), items = D.steps || D.issues || []
    const stateFile = (fs.readFileSync(path.join(c.root, c.serverFile), 'utf8').match(/STATE\s*=\s*path\.join\(ROOT,\s*'([^']+)'/) || [])[1] || 'canvas-state.json'
    const seen = new Set(readJson(path.join(c.root, stateFile), {}).seen || [])
    const gone = new Set(Object.keys(readJson(path.join(c.root, 'canvas-removed.json'), {}) || {}).filter(k => (readJson(path.join(c.root, 'canvas-removed.json'), {})[k] || {}).removed !== false))
    const fixed = new Set(Object.keys(readJson(path.join(c.root, 'canvas-fixed.json'), {}) || {}))
    return items.filter(i => { const id = String(i.cid ?? i.id); return !gone.has(id) && !fixed.has(id) && !seen.has(D.steps ? id + '@' + i.v : id) }).length
  } catch { return null }
}
function counts(c) {
  /* like the canvas's To-dos tab: one row per screen (threads on the same screen share a row), plus Claude's own to-dos that still wait for their screens */
  const d = readJson(path.join(c.root, c.commentsFile), {}); const list = (Array.isArray(d) ? d : (d.comments || [])).filter(x => !x.resolved)
  const st = x => x.status || (x.claudeDone ? 'done' : 'todo'), byTarget = new Map()
  for (const x of list) (byTarget.get(x.target) || byTarget.set(x.target, []).get(x.target)).push(x)
  let toDo = 0, toReview = 0; for (const th of byTarget.values()) { if (th.some(x => st(x) !== 'done')) toDo++; else toReview++ }
  const own = readJson(path.join(c.root, 'flows.json'), {}).todos || [], ids = new Set((readJson(path.join(c.root, 'flows.json'), {}).steps || []).map(s => String(s.id)))
  toDo += own.filter(o => !(o.steps || []).length || (o.steps || []).every(s => !ids.has(String(s)))).length
  const inbox = readJson(path.join(c.root, 'canvas-inbox.json'), {}), q = Array.isArray(inbox) ? inbox : (inbox.items || [])
  toDo += q.filter(i => !i.processed && !i.deleted && !i.resolved).length   // new screenshots waiting to be filed count as to-dos, like in the canvas
  return { unread: unread(c), toDo, toReview }
}

/* ---------- registry ---------- */
const loadReg = () => readJson(REG, { version: 1, canvases: {} })
function saveReg(r) { fs.mkdirSync(path.dirname(REG), { recursive: true }); fs.writeFileSync(REG, JSON.stringify(r, null, 2)) }
function scan() {
  const found = []; for (const r of ROOTS) if (fs.existsSync(r)) walk(r, 0, found)
  const reg = loadReg(), now = new Date().toISOString()
  for (const f of found) { const prev = reg.canvases[f.root] || {}; reg.canvases[f.root] = { ...prev, serverFile: f.serverFile, addedAt: prev.addedAt || now } }
  saveReg(reg); return found.length
}

/* ---------- what is running (by process and folder, so old servers without /api/whoami are found too) ---------- */
function listeners() {
  const map = new Map()
  let out = ''; try { out = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'], { encoding: 'utf8', maxBuffer: 1 << 24 }) } catch { return map }
  const byPid = new Map(); let pid = null
  for (const l of out.split('\n')) { if (l[0] === 'p') pid = l.slice(1); else if (l[0] === 'n' && pid) { const m = l.match(/:(\d+)$/); if (m) (byPid.get(pid) || byPid.set(pid, []).get(pid)).push(Number(m[1])) } }
  if (!byPid.size) return map
  const cwd = new Map(); try { const o = execFileSync('lsof', ['-a', '-d', 'cwd', '-Fpn', '-p', [...byPid.keys()].join(',')], { encoding: 'utf8', maxBuffer: 1 << 24 }); let p = null; for (const l of o.split('\n')) { if (l[0] === 'p') p = l.slice(1); else if (l[0] === 'n' && p) cwd.set(p, l.slice(1)) } } catch {}
  for (const [p, ports] of byPid) {
    let cmd = ''; try { cmd = execFileSync('ps', ['-o', 'command=', '-p', p], { encoding: 'utf8' }).trim() } catch {}
    for (const port of ports) map.set(port, { pid: Number(p), cwd: cwd.get(p) ? real(cwd.get(p)) : null, cmd })
  }
  return map
}
function portOf(root, L) { for (const [port, h] of L) if (h.cwd === root && /node/.test(h.cmd)) return port; return null }

function entries() {
  const reg = loadReg(), L = listeners(), out = []
  for (const [root, meta] of Object.entries(reg.canvases)) {
    if (!fs.existsSync(root)) { delete reg.canvases[root]; reg._dirty = true; continue }   // deleted by the user: drop it from the list
    const d = describe(root, meta.serverFile || 'server.mjs'), port = portOf(root, L)
    out.push({ ...d, running: !!port, port: port || null, lastPort: port || meta.lastPort || d.savedPort || null, ...counts(d) })
    if (port && meta.lastPort !== port) { meta.lastPort = port; reg._dirty = true }
  }
  if (reg._dirty) { delete reg._dirty; saveReg(reg) }
  return out.sort((a, b) => (b.running - a.running) || ((a.port || a.lastPort || 1e9) - (b.port || b.lastPort || 1e9)) || a.title.localeCompare(b.title))
}

/* is Claude watching it? (the canvas server keeps this: both watchers must be reporting in; silent for 30 s = off). Older servers without the endpoint count as not watched. */
async function watchState(port) {
  try {
    const w = await (await fetch(`http://127.0.0.1:${port}/api/watchers`, { signal: AbortSignal.timeout(700) })).json()
    const off = ['comments', 'screenshots'].filter(n => !w[n] || w[n].state !== 'on')
    return { watched: off.length === 0, off }
  } catch { return { watched: false, off: ['comments', 'screenshots'], unknown: true } }
}
async function fullEntries() {
  const all = entries(); await Promise.all(all.filter(e => e.running).map(async e => { e.watch = await watchState(e.port) })); return all
}

/* ---------- starting / moving ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms))
function findEntry(q) {
  const all = entries(), real1 = fs.existsSync(q) ? real(q) : null
  const hit = all.filter(e => e.root === real1 || e.root === q || e.title.toLowerCase().includes(String(q).toLowerCase()) || path.basename(e.root).toLowerCase().includes(String(q).toLowerCase()))
  return hit
}
async function startCanvas(e, opts = {}) {
  if (e.running) return { ok: true, already: true, port: e.port }
  if (e.gone) return { ok: false, error: 'that folder no longer exists' }
  const args = [e.serverFile]
  /* servers with saved-port logic pick their own free port; older ones (no PORT_FILE) take whatever they are given or 4200, so give them the port they last had, or a free one */
  let want = opts.port || (!e.ownsPortFile ? (e.lastPort || e.savedPort) : null)
  if (want && !opts.port && listeners().has(want)) want = freePort()
  if (!want && !e.ownsPortFile) want = freePort()
  if (want) args.push(String(want))
  const log = fs.openSync(path.join(e.root, 'server.log'), 'a')
  const ch = spawn(process.execPath, args, { cwd: e.root, detached: true, stdio: ['ignore', log, log] }); ch.unref()
  for (let i = 0; i < 24; i++) { await wait(250); const p = portOf(e.root, listeners()); if (p) return { ok: true, port: p } }
  return { ok: false, error: 'it did not come up in 6 s; see server.log in its folder' }
}
function freePort(avoid = []) {
  const L = listeners(), taken = new Set([...L.keys(), DIR_PORT, ...avoid]); for (const e of Object.values(loadReg().canvases)) if (e.lastPort) taken.add(e.lastPort)
  for (let p = 4200; p < 4400; p++) if (!taken.has(p)) return p
  return null
}

/* ---------- the page ---------- */
// Open / Start use one named browser tab per canvas (target "canvas:<port>"): clicking again goes to the tab it opened before instead of a new one. A browser only finds tabs opened this way from this page (or from a link with the same name); a tab you opened yourself by typing the address is not found and a new one opens.
const PAGE = `<!doctype html><meta charset="utf-8"><title>All canvases</title><meta name="viewport" content="width=device-width">
<style>
:root{--ink:#26231f;--mut:#8a8378;--line:#e4dfd6;--bg:#f4f4f4;--blue:#2b5fd9;--ok:#2f9e5b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 24px 60px}h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 18px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}input{font:inherit;padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;min-width:260px}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;cursor:pointer;font:inherit}.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
th{white-space:nowrap;text-align:left;font-weight:600;color:var(--mut);font-size:12px;padding:10px 14px;border-bottom:1px solid var(--line);background:#faf9f6}td{padding:11px 14px;white-space:nowrap;border-bottom:1px solid #f0ece4;vertical-align:middle}tr:last-child td{border-bottom:0}
.k{font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:#eef2fd;color:var(--blue)}.k.QA{background:#fdf1e6;color:#b4601a}.k.Other{background:#eee;color:#666}
.t{font-weight:600;white-space:normal}.f{white-space:normal}.f{color:var(--mut);font-size:12px;word-break:break-all}.dot{display:inline-block;box-sizing:border-box;width:10px;height:10px;border-radius:50%;border:2px solid #c9c2b6;background:transparent;margin-right:7px}.dot.on{background:var(--ok);border-color:var(--ok)}.dot.warn{background:#f0922b;border-color:#f0922b}.legend{color:var(--mut);font-size:12px;margin:-8px 0 14px}.legend .dot{margin:0 4px 0 12px;width:9px;height:9px;vertical-align:-1px}.legend .dot:first-child{margin-left:0}
a.btn,button.btn{font:inherit;padding:6px 13px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;text-decoration:none;color:var(--ink);display:inline-block}a.btn.p,button.btn.p{background:var(--blue);color:#fff;border-color:var(--blue)}button.btn[disabled]{opacity:.5;cursor:default}
.n{display:inline-block;min-width:22px;text-align:center;padding:1px 7px;border-radius:999px;background:#f0ece4;font-size:12px}.n.hot{background:#fff1d6;color:#8a5a00}.n.rev{background:#e6f4ea;color:#1e6b3c}.go{cursor:pointer;transition:background .12s}.go:hover,.go:focus-visible{background:#f3f6ff;outline:none}.go.stop:hover,.go.stop:focus-visible{background:#faf7f0}.hint{opacity:0;font-size:12px;font-weight:600;color:var(--blue);padding:5px 10px;border-radius:999px;background:#e8eefc;transition:opacity .12s}.go.stop .hint{color:#7a6a3a;background:#f3ecd9}.go:hover .hint,.go:focus-visible .hint{opacity:1}.msg{color:var(--mut);font-size:12px;margin-left:8px}
table{table-layout:fixed}.pt{font-weight:600;font-variant-numeric:tabular-nums}.pt .off{color:var(--mut);font-weight:400}.cv{overflow:hidden}
.t{display:flex;gap:6px;min-width:0;font-weight:600;white-space:nowrap}.t b{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}.t i{flex:none;color:var(--mut);font-style:normal;font-weight:400}
.cv .f{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut);font-size:12px;word-break:normal;margin-top:1px}
</style><div class=wrap><h1>All canvases</h1><p class=sub id=sub></p><p class=legend><span class="dot on"></span>running, watched by Claude<span class="dot warn"></span>running, not watched<span class=dot></span>stopped</p>
<div class=bar><input id=q placeholder="Search by name or folder" autofocus><button class="chip on" data-f=all>All</button><button class=chip data-f=run>Running</button><button class=chip data-f=stop>Stopped</button><button class=chip id=scan>Scan folders</button></div>
<table><colgroup><col style=width:118px><col style=width:104px><col><col style=width:84px><col style=width:84px><col style=width:96px><col style=width:112px></colgroup><thead><tr><th>Port</th><th>Type</th><th>Canvas</th><th title="Items you have not seen yet">Unread</th><th title="Comments waiting for Claude">To do</th><th title="Claude replied; waiting for you">To review</th><th></th></tr></thead><tbody id=rows></tbody></table></div>
<script>
window.name='canvas:all';/* the canvases' menu link targets this name, so it comes back to this tab */let D=[],F='all';const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const H={'X-Actor':'User','Content-Type':'application/json'};
function draw(){const q=$('#q').value.toLowerCase();const rows=D.filter(e=>(F==='all'||(F==='run')===e.running)&&(!q||(e.title+' '+e.root).toLowerCase().includes(q)));
 $('#sub').textContent=D.filter(e=>e.running).length+' running ('+D.filter(e=>e.watch&&e.watch.watched).length+' watched) of '+D.length+' canvases';
 $('#rows').innerHTML=rows.map(e=>{const home=e.root.replace(/^\\/Users\\/[^/]+/,'~'),num=(v,c)=>v?'<span class="n '+c+'">'+v+'</span>':(v===0?'<span class="n">0</span>':'');
 return '<tr class="go '+(e.running?'run':'stop')+'" tabindex=0 data-go="'+esc(e.root)+'" data-port="'+(e.port||'')+'">'
  +'<td class=pt><span class="dot '+(e.running?(e.watch&&e.watch.watched?'on':'warn'):'')+'" title="'+(e.running?(e.watch&&e.watch.watched?'Running and watched by Claude':'Running, but Claude is not watching '+(e.watch?e.watch.off.join(' or '):'it')+(e.watch&&e.watch.unknown?' (this canvas\\'s server is too old to say)':'')):'Stopped')+'"></span>'+(e.port?':'+e.port:'<span class=off title="Stopped; the port it last used">'+(e.lastPort?':'+e.lastPort:'—')+'</span>')+'</td>'
  +'<td><span class="k '+e.kind+'">'+e.kind+'</span></td>'
  +'<td class=cv><div class=t title="'+esc(e.title)+'"><b>'+esc(e.title)+'</b>'+(e.items?'<i>· '+e.items+'</i>':'')+'</div><div class=f title="'+esc(home)+'">'+esc(home)+'</div></td>'
  +'<td>'+num(e.unread,'hot')+'</td><td>'+(e.running||e.toDo?num(e.toDo,'hot'):'')+'</td><td>'+(e.running||e.toReview?num(e.toReview,'rev'):'')+'</td>'
  +'<td style=text-align:right><span class=hint>'+(e.running?'Open ↗':'Start ▶')+'</span><span class=msg></span></td></tr>'}).join('')||'<tr><td colspan=7 style="padding:30px;color:var(--mut)">Nothing matches.</td></tr>'}
async function load(){try{const r=await fetch('/api/canvases');D=(await r.json()).canvases;draw()}catch{ $('#sub').textContent='The directory server stopped.'}}
async function go(row,e){const root=row.dataset.go;let port=row.dataset.port;const hint=row.querySelector('.hint');
 if(!port){hint.style.opacity=1;hint.textContent='Starting…';const r=await fetch('/api/start',{method:'POST',headers:H,body:JSON.stringify({root})});const j=await r.json();if(!j.ok||!j.port){hint.textContent='Could not start';alert(j.error||'Could not start');load();return}port=j.port;load()}
 const url='http://localhost:'+port+'/';if(e.shiftKey)location.href=url;else if(e.metaKey||e.ctrlKey)window.open(url,'_blank');else window.open(url,'canvas:'+port)}
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr.go')){e.preventDefault();go(e.target,e)}});
document.addEventListener('click',async e=>{const row=e.target.closest('tr.go');if(row){go(row,e);return}const b=e.target.closest('[data-start]');if(b){b.disabled=true;b.textContent='Starting…';const r=await fetch('/api/start',{method:'POST',headers:H,body:JSON.stringify({root:b.dataset.start})});const j=await r.json();if(j.ok&&j.port){window.open('http://localhost:'+j.port+'/','canvas:'+j.port)}else{b.disabled=false;b.textContent='Start';alert(j.error||'Could not start')}load();return}
 const c=e.target.closest('[data-f]');if(c){F=c.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.classList.toggle('on',x===c));draw();return}
 if(e.target.id==='scan'){e.target.textContent='Scanning…';await fetch('/api/scan',{method:'POST',headers:H});e.target.textContent='Scan folders';load()}});
$('#q').addEventListener('input',draw);load();setInterval(load,4000);
</script>`

async function serve() {
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), send = (c, o, t = 'application/json') => { res.writeHead(c, { 'content-type': t + '; charset=utf-8', 'x-canvas-directory': '1' }); res.end(typeof o === 'string' ? o : JSON.stringify(o)) }
    if (req.method === 'GET' && u.pathname === '/') return send(200, PAGE, 'text/html')
    if (req.method === 'GET' && u.pathname === '/api/canvases') return send(200, { port: DIR_PORT, at: new Date().toISOString(), canvases: await fullEntries() })
    if (req.method === 'POST' && req.headers['x-actor'] === 'User' && /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || '')) {
      if (u.pathname === '/api/scan') return send(200, { found: scan() })
      if (u.pathname === '/api/start') {
        let body = ''; for await (const c of req) body += c; const { root } = JSON.parse(body || '{}')
        const e = entries().find(x => x.root === root); if (!e) return send(404, { ok: false, error: 'not a registered canvas' })
        return send(200, await startCanvas(e))
      }
    } else if (req.method === 'POST') return send(403, { error: 'only the page itself may do this' })
    send(404, { error: 'not found' })
  })
  srv.on('error', async e => {
    if (e.code !== 'EADDRINUSE') { console.error(e.message); process.exit(1) }
    try { const r = await fetch(`http://127.0.0.1:${DIR_PORT}/api/canvases`); if (r.headers.get('x-canvas-directory')) { console.log(`already running: http://localhost:${DIR_PORT}`); process.exit(0) } } catch {}
    const h = listeners().get(DIR_PORT), mine = h && entries().find(x => x.root === h.cwd)
    console.error(`PORT_BUSY ${DIR_PORT}: the canvas directory always uses port ${DIR_PORT} and does not pick another.`)
    console.error(h ? `It is used by pid ${h.pid}${h.cwd ? ' in ' + short(h.cwd) : ''}${mine ? ' (the canvas "' + mine.title + '")' : ''}: ${h.cmd.slice(0, 120)}` : 'Something is using it.')
    console.error(mine ? `Ask the user, then run:  node canvases.mjs move-port ${DIR_PORT} --yes   (moves that canvas to a free port) — or stop it yourself.` : 'Ask the user to stop it (or free the port), then run serve again.')
    process.exit(3)
  })
  srv.listen(DIR_PORT, '127.0.0.1', () => { scan(); console.log(`All canvases: http://localhost:${DIR_PORT}`) })
}

/* ---------- command line ---------- */
const [cmd, ...rest] = process.argv.slice(2)
const flag = f => rest.includes(f), arg = rest.filter(a => !a.startsWith('--'))[0]
if (cmd === 'scan') { console.log(`${scan()} canvases found; registry: ${short(REG)}`) }
else if (cmd === 'list') {
  if (!Object.keys(loadReg().canvases).length) scan()
  const all = await fullEntries(); if (flag('--json')) console.log(JSON.stringify(all, null, 2)); else {
    console.log(`${all.filter(e => e.running).length} running (${all.filter(e => e.watch?.watched).length} watched by Claude) of ${all.length} canvases;  ● running and watched   ◐ running, not watched   ○ stopped\n`)
    for (const e of all) console.log(`${e.running ? (e.watch?.watched ? '●' : '◐') : '○'} ${e.kind.padEnd(8)} ${e.title.slice(0, 42).padEnd(42)} ${(e.running ? ':' + e.port : e.lastPort ? 'last :' + e.lastPort : '—').padEnd(11)} unread ${String(e.unread ?? '').padEnd(3)} todo ${String(e.toDo ?? '').padEnd(3)} review ${String(e.toReview ?? '').padEnd(3)} ${short(e.root)}`)
  }
}
else if (cmd === 'start') {
  if (!arg) { console.error('usage: canvases.mjs start <name|folder>'); process.exit(1) }
  if (!Object.keys(loadReg().canvases).length) scan()
  const hit = findEntry(arg); if (!hit.length) { console.error(`no canvas matches "${arg}"`); process.exit(1) }
  if (hit.length > 1) { console.error(`"${arg}" matches ${hit.length} canvases; be more specific:\n` + hit.map(e => '  ' + short(e.root)).join('\n')); process.exit(1) }
  const r = await startCanvas(hit[0]); console.log(r.ok ? `${r.already ? 'already running' : 'started'}: http://localhost:${r.port}  (${hit[0].title})` : `could not start: ${r.error}`); process.exit(r.ok ? 0 : 1)
}
else if (cmd === 'serve') await serve()
else if (cmd === 'move-port') {
  const port = Number(arg); if (!port) { console.error('usage: canvases.mjs move-port <port> [--yes]'); process.exit(1) }
  const h = listeners().get(port); if (!h) { console.log(`port ${port} is free`); process.exit(0) }
  const e = entries().find(x => x.root === h.cwd)
  if (!e) { console.error(`port ${port} is used by something that is not a registered canvas (pid ${h.pid}: ${h.cmd.slice(0, 100)}). Stop it yourself.`); process.exit(2) }
  const to = freePort([port]); if (!to) { console.error('no free port in 4200-4399'); process.exit(2) }
  console.log(`"${e.title}" is on :${port}. It would stop and restart on :${to}; its saved port changes to ${to}.`)
  if (!flag('--yes')) { console.log('Dry run. Ask the user, then add --yes.'); process.exit(0) }
  try { process.kill(h.pid, 'SIGTERM') } catch {}
  for (let i = 0; i < 20 && listeners().get(port)?.pid === h.pid; i++) await wait(150)
  const portFile = fs.readdirSync(e.root).find(f => /-port\.txt$/.test(f)); if (e.ownsPortFile) fs.writeFileSync(path.join(e.root, portFile || 'canvas-port.txt'), String(to))
  const r = await startCanvas({ ...e, running: false }, { port: to }); console.log(r.ok ? `moved: http://localhost:${r.port}` : `stopped, but could not restart: ${r.error}`)
}
else { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n')) }
