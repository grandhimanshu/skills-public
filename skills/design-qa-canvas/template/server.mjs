// Local server for a design-qa-canvas review canvas: serves this folder and stores review comments.
//   node server.mjs [port]      (default 4200, http://localhost:4200)
// Comments live in canvas-comments.json next to this file. Local only — nothing leaves the machine.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const STORE = path.join(ROOT, 'canvas-comments.json')           // open comments only — this is what Claude scans
const ARCHIVE = path.join(ROOT, 'canvas-resolved.json')          // resolved threads, kept for the UI, never scanned
const PRIO = path.join(ROOT, 'canvas-priorities.json')           // { [cardId]: 'high' | 'med' | 'low' } — the user or Claude can set
const STATE = path.join(ROOT, 'canvas-state.json')               // { seen: [cardId] } — cards NOT in seen carry the NEW mark
const SUGG = path.join(ROOT, 'canvas-suggestions.json')               // { [suggestionId]: 'accepted' | 'removed' } — pending when absent
const INBOX = path.join(ROOT, 'canvas-inbox.json')                    // screenshots picked up from the Desktop, waiting for Claude to add context
const DESKTOP = process.env.DESKTOP_DIR || path.join(os.homedir(), 'Desktop')
// Several canvases may run at once: only the one the user used last takes new Desktop screenshots (shared across servers)
const ACTIVE = path.join(os.homedir(), '.claude', 'design-qa-active.json')
const WATCH_DESKTOP = process.env.DESKTOP_WATCH !== '0'
const PAGE = process.env.CANVAS_PAGE || 'canvas.html'
const EDITS = path.join(ROOT, 'canvas-edits.json')
const ADDED = path.join(ROOT, 'canvas-added.json')                   // { items: [issue] } — issues the user added by hand on a screenshot (QA)                   // { [cardId]: { title, what, out } } — the user's edits; build.py/gen.py re-apply them on rebuild
const REMOVED = path.join(ROOT, 'canvas-removed.json')               // { [cardId]: { title, n } } — issues the user removed; hidden, never deleted, restorable
const PORT = Number(process.argv[2] || process.env.PORT || 4200)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }

const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')) } catch { return { comments: [] } } }
const save = (db) => fs.writeFileSync(STORE, JSON.stringify(db, null, 2))
const loadA = () => { try { return JSON.parse(fs.readFileSync(ARCHIVE, 'utf8')) } catch { return { comments: [] } } }
const saveA = (db) => fs.writeFileSync(ARCHIVE, JSON.stringify(db, null, 2))
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
const escRe = (t) => t.replace(/\$/g, '$$$$')
const SAFE = (t) => typeof t === 'string' && t.length < 8000 && !/<\s*(script|iframe|object|embed|style|link|meta)/i.test(t) && !/\son\w+\s*=/i.test(t) && !/javascript:/i.test(t)
// Write an edit straight into the built HTML so the page on disk is the updated one (ids/numbers are never touched).
function patchPage(cid, e) {
  const file = path.join(ROOT, PAGE); let h = fs.readFileSync(file, 'utf8')
  const start = h.indexOf(`<div id="card-${cid}" `); if (start < 0) return false
  let end = h.indexOf('<div id="card-', start + 10); if (end < 0) end = h.indexOf('</section>', start); if (end < 0) end = h.length
  let seg = h.slice(start, end)
  if (e.title !== undefined) seg = seg.replace(/(<span class="ttl">)[\s\S]*?(<\/span>)/, (_, a, b) => a + e.title + b)
  if (e.what !== undefined) seg = seg.replace(/(<p class="what">)[\s\S]*?(<\/p>)/, (_, a, b) => a + e.what + b)
  if (e.out !== undefined) seg = seg.replace(/(<span class="outv">)[\s\S]*?(<\/span><\/p>)/, (_, a, b) => a + e.out + b)
  h = h.slice(0, start) + seg + h.slice(end)
  if (e.title !== undefined) {                                           // sidebar row text
    const r = h.indexOf(`data-target="card:${cid}"><span class="sb-id`)
    if (r >= 0) { const tail = h.slice(r).replace(/(<span class="sb-t">(?:<span class="code">[^<]*<\/span>)?)[^<]*(<\/span>)/, (_, a, b) => a + e.title + b); h = h.slice(0, r) + tail }
  }
  fs.writeFileSync(file, h); return true
}
const WATCH = {}   // in memory: watcher status is live state, not worth persisting
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)) }
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || '{}')) } catch { ok({}) } }) })
const now = () => new Date().toISOString()
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const author = (v) => (v === 'Claude' ? 'Claude' : 'User')

const server = http.createServer(async (req, res) => {
  // A canvas opened straight from disk (file:// -> Origin "null") or from another localhost port may talk to this server.
  // Any other website is refused, so a random page cannot resolve or delete comments.
  const origin = req.headers.origin
  if (origin && (origin === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Actor, X-Confirm-Delete')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://x')
  const p = decodeURIComponent(url.pathname)

  // Default GET = open comments only. ?all=1 (used by the canvas UI) also returns resolved ones.
  if (p === '/api/comments' && req.method === 'GET') {
    const open = load().comments
    return send(res, 200, { comments: url.searchParams.get('all') ? [...open, ...loadA().comments] : open })
  }

  if (p === '/api/priorities' && req.method === 'GET') {
    let d = {}; try { d = JSON.parse(fs.readFileSync(PRIO, 'utf8')) } catch {}
    return send(res, 200, d)
  }
  if (p === '/api/priorities' && req.method === 'POST') {
    const b = await readBody(req)
    if (!b.cid || !['high', 'med', 'low'].includes(b.level)) return send(res, 400, { error: 'cid and level (high|med|low) required' })
    let d = {}; try { d = JSON.parse(fs.readFileSync(PRIO, 'utf8')) } catch {}
    if (b.level === 'low') delete d[b.cid]; else d[b.cid] = b.level   // low is the default
    fs.writeFileSync(PRIO, JSON.stringify(d, null, 2)); return send(res, 200, d)
  }

  // Remove issue: hide-by-flag so it is instant, survives rebuilds, and can be restored from the canvas (the user only).
  if (p === '/api/removed' && req.method === 'GET') return send(res, 200, readJson(REMOVED, {}))
  if (p === '/api/removed' && req.method === 'POST') {
    const b = await readBody(req)
    if (!req.headers['x-actor'] === 'User' && !(b.removed === true && b.by === 'Claude')) return send(res, 403, { error: 'only the user restores; Claude may only soft-delete with by:"Claude"' })
    if (!/^[A-Za-z0-9_-]+$/.test(String(b.cid || '')) || typeof b.removed !== 'boolean') return send(res, 400, { error: 'cid and removed required' })
    const d = readJson(REMOVED, {})
    if (b.removed) d[b.cid] = { title: String(b.title || '').slice(0, 200), n: String(b.n || ''), at: now(), by: b.by === 'Claude' ? 'Claude' : 'User' }; else delete d[b.cid]
    fs.writeFileSync(REMOVED, JSON.stringify(d, null, 2)); return send(res, 200, d)
  }

  if (p === '/api/removed/purge' && req.method === 'POST') {
    if (!req.headers['x-actor'] === 'User') return send(res, 403, { error: 'only the user deletes for good' })
    const b = await readBody(req), d = readJson(REMOVED, {})
    for (const c of b.cids || []) if (d[c]) d[c].purged = true
    fs.writeFileSync(REMOVED, JSON.stringify(d, null, 2)); return send(res, 200, d)
  }

  // Claude's watchers report in: {name:'comments'|'screenshots', state:'on'|'off'}. A watcher that stops heartbeating for 30 s counts as off.
  if (p === '/api/watchers' && req.method === 'POST') {
    const b = await readBody(req)
    if (!['comments', 'screenshots'].includes(b.name) || !['on', 'off'].includes(b.state)) return send(res, 400, { error: 'name and state required' })
    WATCH[b.name] = { state: b.state, at: Date.now(), why: String(b.why || '').slice(0, 120) }; return send(res, 200, { ok: true })
  }
  if (p === '/api/watchers' && req.method === 'GET') {
    const out = {}; for (const n of ['comments', 'screenshots']) { const w = WATCH[n]; out[n] = !w ? { state: 'off', why: 'not started' } : (w.state === 'on' && Date.now() - w.at > 30000) ? { state: 'off', why: 'stopped responding' } : { state: w.state, why: w.why, since: w.at } }
    return send(res, 200, out)
  }

  // Lets an open canvas notice that its HTML changed on disk and patch itself in place (no reload, no lost view).
  if (p === '/api/version' && req.method === 'GET') {
    let m = 0; try { m = fs.statSync(path.join(ROOT, PAGE)).mtimeMs } catch {}
    return send(res, 200, { page: m })
  }
  if (p === '/api/state' && req.method === 'GET') {
    let d = { seen: [] }; try { d = JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch {}
    return send(res, 200, d)
  }
  if (p === '/api/state' && req.method === 'POST') {
    const b = await readBody(req)
    if (!b.cid || typeof b.new !== 'boolean') return send(res, 400, { error: 'cid and new (boolean) required' })
    let d = { seen: [] }; try { d = JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch {}
    const set = new Set(d.seen)
    if (b.new) set.delete(b.cid); else set.add(b.cid)       // new:false = the user has seen it; new:true = bring the mark back
    d.seen = [...set]; fs.writeFileSync(STATE, JSON.stringify(d, null, 2)); return send(res, 200, d)
  }

  if (p === '/api/edit' && req.method === 'POST') {
    if (!req.headers['x-actor'] === 'User') return send(res, 403, { error: 'only the user edits issues' })
    const b = await readBody(req)
    if (b.section && typeof b.section.from === 'string' && typeof b.section.to === 'string' && SAFE(b.section.to)) {
      const all = readJson(EDITS, {}); all.sections = { ...(all.sections || {}), [b.section.from]: b.section.to }
      fs.writeFileSync(EDITS, JSON.stringify(all, null, 2)); return send(res, 200, { ok: true })
    }
    if (!/^[A-Za-z0-9_-]+$/.test(String(b.cid || ''))) return send(res, 400, { error: 'bad cid' })
    const e = {}; for (const k of ['title', 'what', 'out', 'screen']) if (b[k] !== undefined) { if (b[k] !== '' && !SAFE(b[k])) return send(res, 400, { error: k + ' not allowed' }); e[k] = b[k] }
    if (!Object.keys(e).length) return send(res, 400, { error: 'nothing to save' })
    const all = readJson(EDITS, {}); all[b.cid] = { ...(all[b.cid] || {}), ...e }
    fs.writeFileSync(EDITS, JSON.stringify(all, null, 2))
    return send(res, 200, { ok: true })
  }
  if (p === '/api/edit' && req.method === 'GET') return send(res, 200, readJson(EDITS, {}))
  if (p === '/api/added' && req.method === 'GET') return send(res, 200, readJson(ADDED, { items: [] }))
  if (p === '/api/added' && req.method === 'POST') {
    if (req.headers['x-actor'] !== 'User') return send(res, 403, { error: 'only the user adds issues by hand' })
    const b = await readBody(req), d = readJson(ADDED, { items: [] })
    if (!b.section || !b.title) return send(res, 400, { error: 'section and title required' })
    const it = { cid: 'U' + (d.items.length + 1), n: Number(b.n) || 0, section: String(b.section), kind: 'gap', title: String(b.title), what: '', out: '', img: b.img || null, screen: String(b.screen || ''), v: b.v || '', sugg: [], by: 'User', at: now() }
    d.items.push(it); fs.writeFileSync(ADDED, JSON.stringify(d, null, 2)); return send(res, 200, it)
  }

  // Suggestions: the user accepts (locks) or removes Claude's suggestions. Deterministic — no model involved.
  if (p === '/api/suggestions' && req.method === 'GET') return send(res, 200, readJson(SUGG, {}))
  if (p === '/api/suggestions' && req.method === 'POST') {
    if (!req.headers['x-actor'] === 'User') return send(res, 403, { error: 'only the user accepts or removes suggestions' })
    const b = await readBody(req)
    if (!Array.isArray(b.ids) || !['accepted', 'removed', 'pending'].includes(b.status)) return send(res, 400, { error: 'ids[] and status required' })
    const d = readJson(SUGG, {})
    for (const id of b.ids) { if (b.status === 'pending') delete d[id]; else d[id] = b.status }
    fs.writeFileSync(SUGG, JSON.stringify(d, null, 2)); return send(res, 200, d)
  }

  // Screenshot inbox: new Desktop screenshots land here instantly; Claude later adds context and marks them processed.
  if (p === '/api/active' && req.method === 'POST') { try { fs.mkdirSync(path.dirname(ACTIVE), { recursive: true }); fs.writeFileSync(ACTIVE, JSON.stringify({ port: PORT, root: ROOT, at: now() })) } catch {} return send(res, 200, { ok: true }) }
  if (p === '/api/active' && req.method === 'GET') return send(res, 200, { ...readJson(ACTIVE, {}), me: PORT })
  if (p === '/api/inbox' && req.method === 'GET') return send(res, 200, readJson(INBOX, { items: [] }))
  const ib = p.match(/^\/api\/inbox\/([^/]+)$/)
  if (ib && req.method === 'POST') {
    const b = await readBody(req), d = readJson(INBOX, { items: [] }), it = d.items.find((x) => x.id === ib[1])
    if (!it) return send(res, 404, { error: 'not found' })
    if (typeof b.processed === 'boolean') it.processed = b.processed
    for (const k of ['deleted', 'resolved']) if (typeof b[k] === 'boolean') { if (!req.headers['x-actor'] === 'User') return send(res, 403, { error: 'only the user deletes or resolves screenshots' }); it[k] = b[k] }
    if (b.issue) it.issue = String(b.issue)
    fs.writeFileSync(INBOX, JSON.stringify(d, null, 2)); return send(res, 200, it)
  }

  if (p === '/api/comments' && req.method === 'POST') {
    const b = await readBody(req)
    if (!b.target || !String(b.text || '').trim()) return send(res, 400, { error: 'target and text required' })
    const db = load()
    const c = { id: uid(), target: String(b.target), title: String(b.title || ''), createdAt: now(), claudeDone: false, status: 'todo', resolved: false,
      thread: [{ by: author(b.by), text: String(b.text).trim(), at: now() }] }
    db.comments.push(c); save(db); return send(res, 200, c)
  }

  // Move a thread to the step/issue it is now about (e.g. the work split one screen into two). Claude may do this.
  const mv = p.match(/^\/api\/comments\/([^/]+)\/move$/)
  if (mv && req.method === 'POST') {
    const b = await readBody(req), db = load(), c = db.comments.find((x) => x.id === mv[1])
    if (!c) return send(res, 404, { error: 'not found' })
    if (!/^card:[\w-]+$/.test(String(b.target || ''))) return send(res, 400, { error: 'target must be card:<id>' })
    const from = c.target; if (from === b.target) return send(res, 200, c)
    c.movedFrom = from; c.target = String(b.target); if (b.title) c.title = String(b.title)
    c.thread.push({ by: author(b.by || 'Claude'), text: String(b.note || '').trim() || `Moved here from ${from.slice(5)}`, at: now(), moved: { from, to: c.target } })
    save(db); return send(res, 200, c)
  }

  const del = p.match(/^\/api\/comments\/([^/]+)$/)
  if (del && req.method === 'DELETE') {
    // Only on an explicit request from the user — Claude never deletes on its own.
    if (req.headers['x-confirm-delete'] !== 'yes') return send(res, 403, { error: 'explicit confirmation required' })
    const db = load(), ar = loadA()
    db.comments = db.comments.filter((x) => x.id !== del[1]); ar.comments = ar.comments.filter((x) => x.id !== del[1])
    save(db); saveA(ar); return send(res, 200, { ok: true })
  }

  const m = p.match(/^\/api\/comments\/([^/]+)\/(reply|flags)$/)
  if (m && req.method === 'POST') {
    const db = load(), ar = loadA()
    const b = await readBody(req)
    let c = db.comments.find((x) => x.id === m[1])
    const archived = !c ? ar.comments.find((x) => x.id === m[1]) : null
    if (!c && !archived) return send(res, 404, { error: 'not found' })
    if (m[2] === 'flags' && typeof b.resolved === 'boolean') {
      // Resolving is user-only: the canvas UI sends X-Actor: User; Claude never does.
      if (!req.headers['x-actor'] === 'User') return send(res, 403, { error: 'only the user can resolve or reopen' })
      if (b.resolved && c) { db.comments = db.comments.filter((x) => x.id !== c.id); c.resolved = true; c.resolvedAt = now(); ar.comments.push(c) }
      if (!b.resolved && archived) { ar.comments = ar.comments.filter((x) => x.id !== archived.id); archived.resolved = false; delete archived.resolvedAt; archived.claudeDone = false; archived.status = 'todo'; db.comments.push(archived) }
      save(db); saveA(ar); return send(res, 200, c || archived)
    }
    if (!c) return send(res, 409, { error: 'comment is resolved' })
    if (m[2] === 'reply') {
      if (!String(b.text || '').trim()) return send(res, 400, { error: 'text required' })
      c.thread.push({ by: author(b.by), text: String(b.text).trim(), at: now() })
      if (author(b.by) === 'User') { c.claudeDone = false; c.status = 'todo' }   // a new the user reply re-opens the task for Claude
    } else if (['todo', 'inprogress', 'done'].includes(b.status)) { c.status = b.status; c.claudeDone = b.status === 'done' }
    else if (typeof b.claudeDone === 'boolean') { c.claudeDone = b.claudeDone; c.status = b.claudeDone ? 'done' : 'todo' }
    save(db); return send(res, 200, c)
  }

  // static files from this folder
  let rel = p === '/' ? '/' + PAGE : p
  const file = path.normalize(path.join(ROOT, rel))
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain')
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(data)
  })
})

// --- Desktop watcher: moves screenshots taken AFTER the server started into screenshots/inbox/ -------------------------------
const started = Date.now() - 2000
if (WATCH_DESKTOP) setInterval(() => {
  const act = readJson(ACTIVE, null); if (!act || Number(act.port) !== Number(PORT)) return   // not the canvas in use (or none claimed yet): leave it on the Desktop
  let names = []; try { names = fs.readdirSync(DESKTOP) } catch { return }
  for (const n of names) {
    if (!/^(Screenshot|Screen Shot).*\.png$/.test(n)) continue
    const from = path.join(DESKTOP, n); let st; try { st = fs.statSync(from) } catch { continue }
    if (st.mtimeMs < started || Date.now() - st.mtimeMs < 700) continue          // ignore old files; let the write finish
    const d = readJson(INBOX, { items: [] })
    const k = d.items.reduce((m, x) => Math.max(m, Number(String(x.id).slice(2)) || 0), 0) + 1
    const dir = path.join(ROOT, 'screenshots', 'inbox'); fs.mkdirSync(dir, { recursive: true })
    const stamp = new Date(st.mtimeMs).toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const file = `IN${k}-${stamp}.png`
    try { fs.renameSync(from, path.join(dir, file)) } catch { try { fs.copyFileSync(from, path.join(dir, file)); fs.unlinkSync(from) } catch { continue } }
    d.items.push({ id: 'IN' + k, file: 'screenshots/inbox/' + file, at: new Date().toISOString(), processed: false })
    fs.writeFileSync(INBOX, JSON.stringify(d, null, 2)); console.log('inbox +', 'IN' + k, n)
  }
}, 2500)

server.listen(PORT, () => console.log(`design-qa-canvas on http://localhost:${PORT}  (comments: ${path.basename(STORE)})`))
