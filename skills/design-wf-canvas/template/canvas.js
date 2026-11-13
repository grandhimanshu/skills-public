
const D=JSON.parse(document.getElementById('qa-data').textContent),PORT=(/^https?:$/.test(location.protocol)&&+location.port)||D.port||4200,/* the port the page was actually served on; the data file's port is only the fallback (the server may have moved to the next free one) */Q=new URLSearchParams(location.search);
// View build (build.py --view): read-only for viewers, e.g. published to Vercel. No server or watchers there, so
// the page answers its own api/ reads from the snapshot baked in at build time, and every edit control is off.
const VIEW=!!D.view;
if(VIEW){const SN=D.snap||{},_f=window.fetch.bind(window),ok=b=>Promise.resolve(new Response(JSON.stringify(b),{status:200,headers:{'Content-Type':'application/json'}}));
  window.fetch=(u,o)=>{const m=String(u).match(/(?:^|\/)api\/([a-z/]+)/);if(!m)return _f(u,o);const k=m[1];
    return ok(k==='version'?{page:'view'}:k==='watchers'?{comments:{state:'on'},screenshots:{state:'on'}}:k in SN?SN[k]:k==='comments'?{comments:[]}:/^(inbox|added)$/.test(k)?{items:[]}:{})};
  document.documentElement.classList.add('view');
  const RO='[data-fix],[data-unfix],[data-open],[data-task],[data-read],[data-readall],[data-bulk],[data-prio],[data-menu],[data-mi],[data-del],[data-deltop],[data-delall],[data-delall-shot],[data-idel],[data-ires],[data-tres],[data-todoread],[data-tdel],[data-addiss],[data-sg],[data-sgok],[data-sgask],[data-sgtop],[data-sgbar],[data-acc],[data-restore],[data-rdel],[data-rdelall],[data-copywatch],[data-copymsg],[data-ed],[data-pick],[data-pres],#sortbtn';
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
  addEventListener('click',e=>{if(e.target.closest?.(RO))stop(e)},true);
  addEventListener('dblclick',e=>{if(e.target.closest?.('[data-secname],[data-ed],.ct h3,#list .rt[data-rted]'))stop(e)},true);
  addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace')stop(e)},true);
  addEventListener('paste',stop,true);addEventListener('drop',stop,true)}
// opened from disk (file://) -> talk to the local server directly; ?asfile=1 / ?offline=1 preview those states
const ASFILE=location.protocol==='file:'||Q.has('asfile'),API=location.protocol==='file:'?`http://localhost:${PORT}/`:'';
const ic=(n,s='')=>`<svg class="i" ${s}><use href="#i-${n}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function srvState(){const b=document.getElementById('srv');if(!b||VIEW)return;const off=S.offline||Q.has('offline');
  b.innerHTML=off?`<div class="srv warn"><b>${ASFILE?'Nothing is running on localhost:'+PORT:'The canvas server has stopped'}</b><span>Comments you write are kept in this browser and sent when it's back.</span><button data-copymsg>Copy message for Claude</button></div>`
   :ASFILE?`<div class="srv ok"><span class="dot"></span>Opened from disk · server live on localhost:${PORT}<a href="http://localhost:${PORT}/" target="_blank" rel="noopener">Open there ↗</a></div>`:'';
  b.hidden=!b.innerHTML;document.getElementById('srvToast').hidden=!(off&&S.touchedComments)}
const PL={high:'High',med:'Med',low:'Low'},PS={high:'H',med:'M',low:'L'};const num=i=>i.n??i.sn;   // always the permanent number: the one ID people and agents use
const rk=i=>S.rank?.[i.cid]??S.items.indexOf(i);
function sortByPriority(){const r={};S.sections.forEach(sec=>S.items.filter(i=>i.section===sec).map((i,k)=>[i,k]).sort((a,b)=>RANK[pr(a[0])]-RANK[pr(b[0])]||rk(a[0])-rk(b[0])).forEach(([i],k)=>r[i.cid]=k));S.rank=r;render();if(S.sel)select(S.sel,false);toast('Sorted by priority')}
const RANK={high:0,med:1,low:2},OPEN=new Set(['gap','ux','ctx']);
const KIND={gap:'Dev ≠ design',ux:'Question',dec:'Decided',later:'Later',ctx:'Needs context'};
const FLOW=D.mode==='flow';
let S={items:[],sections:[],prio:{},comments:[],inbox:[],tab:FLOW?'inbox':'issues',sel:null,openOnly:false,fp:new Set(),fk:new Set(),fh:false,collapsed:new Set(),z:.5,x:0,y:0};
S.showIds=true;   // numbers are always the permanent ones (the position option is gone)

async function load(){
  const j=u=>fetch(API+u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(u);return r.json()});
  let p={},c={comments:[]},inb={items:[]},stt={seen:[]},ed={},rm={},sg={};
  try{[p,c,inb,stt,ed,rm,sg,ad]=await Promise.all(['api/priorities','api/comments','api/inbox','api/state','api/edit','api/removed','api/suggestions','api/added'].map(j));S.fixed=new Set(Object.keys(await j('api/fixed').catch(()=>({}))))}catch{S.offline=true}
  const ren=ed.sections||{};if(ren.__title__)D.title=ren.__title__;/* the user's own page title (saved like a section rename) */document.getElementById('ttl').textContent=D.title;document.title=D.title;
  S.sections=D.sections.map(x=>ren[x]||x);
  const mk=i=>{const e0=ed[i.cid]||{},e=e0.out?{...e0,what:[e0.out,e0.what].filter(Boolean).join('<br>')}:e0,acc=(i.sugg||[]).filter(([id])=>sg[id]==='accepted').map(([,t])=>'• '+t.replace(/^<b>[^<]*<\/b>\s*/,''));
    const what=(e.what??i.what??'');return {...i,tags:e.tags||i.tags||[],screen:e.screen!==undefined?e.screen:(i.screen||''),section:ren[i.section]||i.section,title:e.title??i.title,out:'',
      what:acc.length&&!e.what?(what?what+'<br>':'')+acc.join('<br>'):what,sugg:(i.sugg||[]).filter(([id])=>!sg[id]).map(([,t])=>t),sids:(i.sugg||[]).filter(([id])=>!sg[id]).map(([id])=>id),...(!FLOW&&i.ref?{prev:{img:i.ref,label:i.refLabel||'',ref:true}}:{})}};
  if(FLOW){D.issues=D.steps}else if(ad?.items?.length){/* issues the user added by hand */D.issues=D.issues.concat(ad.items.filter(a=>!D.issues.some(i=>i.cid===a.cid)))}
  const mkT=i=>{const o=mk(i);if(!trimHtml(o.title)&&trimHtml(o.what)){/* no title but details: show the first line as the title */const [a,...r]=o.what.split(/<br\s*\/?>/);o.title=a.replace(/^\s*[•\-]\s*/,'').trim();o.what=r.join('<br>')}return o};
  S.mk=mkT;
  S.fixed=S.fixed||new Set();S.fixedItems=FLOW?[]:D.issues.filter(i=>!rm[i.cid]&&S.fixed.has(i.cid)).map(mkT);S.items=D.issues.filter(i=>!rm[i.cid]&&(FLOW||!S.fixed.has(i.cid))).map(mkT);S.deleted=D.issues.filter(i=>rm[i.cid]&&!rm[i.cid].purged).map(mkT);
  if(Q.has('offline'))S.offline=true;S.prio=p;S.seen=new Set(stt.seen||[]);S.readLocal=new Set();S.comments=c.comments||[];S.inbox=(inb.items||[]).filter(x=>!x.deleted&&!x.resolved);
  if(FLOW)flowLayout();S._c=JSON.stringify(S.comments);S.openSecs=new Set([...S.sections,'x:new']);/* New screenshots open, Deleted collapsed */render();fit();srvState();flushOutbox();
}
const OUTBOX='qa-outbox:'+location.pathname;
async function post(u,body,{method='POST',asUser=true}={}){const req={method,headers:{'Content-Type':'application/json',...(asUser?{'X-Actor':'User'}:{})},body:JSON.stringify(body)};
  S.inflight=(S.inflight||0)+1;/* keepalive + inflight: a live reload never drops a save mid-send */
  try{const r=await fetch(API+u,{...req,keepalive:req.body.length<60000/* the browser caps keepalive bodies at 64 KB: a pasted screenshot goes without */});if(!r.ok)throw new Error(r.status);S.inflight--;S.offline=false;srvState();return await r.json()}
  catch(e){S.inflight=Math.max(0,S.inflight-1);if(/^4\d\d$/.test(String(e.message))){toast('Couldn’t save — the server rejected it ('+e.message+'). Your change is only on this screen.',null,'err');return null}
    const q=JSON.parse(localStorage[OUTBOX]||'[]');q.push([u,body,method]);localStorage[OUTBOX]=JSON.stringify(q);S.offline=true;srvState();return null}}
async function flushOutbox(){const q=JSON.parse(localStorage[OUTBOX]||'[]');if(!q.length||S.offline)return;localStorage[OUTBOX]='[]';for(const [u,b,m] of q)await post(u,b,{method:m});toast(`Sent ${q.length} change${q.length>1?'s':''} saved while offline`);refresh()}
// pick up Claude's replies / new screenshots without touching what you're doing
async function refresh(){if(document.querySelector('[contenteditable=true]')||document.activeElement?.tagName==='TEXTAREA')return;
  try{const [c,inb]=await Promise.all([fetch(API+'api/comments',{cache:'no-store'}).then(r=>r.json()),fetch(API+'api/inbox',{cache:'no-store'}).then(r=>r.json())]);
    const nc=JSON.stringify(c.comments),ni=JSON.stringify(inb.items);if(nc!==S._c||ni!==S._i){S._c=nc;S._i=ni;S.comments=c.comments;S.inbox=inb.items.filter(x=>!x.deleted&&!x.resolved);render();if(S.popT&&document.getElementById('pop').classList.contains('open')){S.noFocus=1;openPop(S.popT,S.popAnchor);S.noFocus=0}}}catch{}}
setInterval(refresh,3000);
const stKey=cid=>{const it=S.items.find(i=>i.cid===cid)||S.deleted?.find(i=>i.cid===cid);return it&&it.v?cid+'@'+it.v:cid};
const unread=it=>S.seen&&!S.seen.has(stKey(it.cid))&&!S.readLocal?.has(it.cid);
const pr=it=>S.prio[it.cid]||'low';
const threads=t=>S.comments.filter(c=>c.target===t&&!c.resolved);
const st=c=>c.status||(c.claudeDone?'done':'todo');
function visible(it){
  if(S.showPrio&&S.fp.size&&!S.fp.has(pr(it)))return false;/* a priority filter applies only while priority is shown */
  if(S.ftag?.size){const t=FLOW?[]:tagsOf(it);if(!t.some(x=>S.ftag.has(x))&&!(S.ftag.has('none')&&!t.length))return false}
  if(S.fh&&!it.hl)return false;return true;
}
// effective graph: a deleted step's predecessors connect straight to its successors; a deleted origin just drops (its successors become origins)
function flowLayout(){const ids=new Set(S.items.map(i=>i.cid));let E=(D.edges||[]).map(e=>[String(e[0]),String(e[1]),e[2]?String(e[2]):'']);
  for(const x of D.steps.map(i=>i.cid).filter(c=>!ids.has(c))){const P=E.filter(e=>e[1]===x).map(e=>e[0]),Q=E.filter(e=>e[0]===x).map(e=>e[1]);E=E.filter(e=>e[0]!==x&&e[1]!==x);for(const a of P)for(const b of Q)if(a!==b&&!E.some(e=>e[0]===a&&e[1]===b))E.push([a,b,''])}
  S.E=E;const par={};const f=x=>par[x]===x?x:(par[x]=f(par[x]));S.items.forEach(i=>par[i.cid]=i.cid);E.forEach(([a,b])=>{par[f(a)]=f(b)});
  const comp={};S.items.forEach(i=>(comp[f(i.cid)]=comp[f(i.cid)]||[]).push(i));
  /* returning arrows must not decide a step's column: find them by walking from the first steps in listing order; an edge to a step that is still being walked is a return and is left out of the depth below */
  const back=new Set(),seenB={};{const out=c=>E.filter(e=>e[0]===c),walk=c=>{seenB[c]=1;out(c).forEach(e=>{const t=e[1];if(seenB[t]===1)back.add(e[0]+'>'+t);else if(!seenB[t])walk(t)});seenB[c]=2};
    S.items.map(i=>i.cid).filter(c=>!E.some(e=>e[1]===c)).forEach(c=>{if(!seenB[c])walk(c)});S.items.forEach(i=>{if(!seenB[i.cid])walk(i.cid)})}
  const depth={};const preds=c=>E.filter(e=>e[1]===c&&!back.has(e[0]+'>'+e[1])).map(e=>e[0]);const dep=(c,seen=new Set())=>{if(depth[c]!=null)return depth[c];if(seen.has(c))return 0;seen.add(c);const p=preds(c);return depth[c]=p.length?1+Math.max(...p.map(x=>dep(x,seen))):0};
  S.items.forEach(i=>dep(i.cid));S.rank={};S.sections=[];let k=0;
  /* unconnected steps with the same group (e.g. a component's states) share one grid section, placed where its first step is listed */
  S.grid=new Set();const gm={};Object.keys(comp).forEach(r=>{const g=comp[r];if(g.length===1&&g[0].group){const n=g[0].group;if(gm[n]){gm[n].push(g[0]);delete comp[r]}else gm[n]=g}});
  Object.values(comp).sort((a,b)=>D.steps.findIndex(x=>x.cid===a[0].cid)-D.steps.findIndex(x=>x.cid===b[0].cid)).forEach(g=>{
    g.sort((a,b)=>depth[a.cid]-depth[b.cid]||D.steps.findIndex(x=>x.cid===a.cid)-D.steps.findIndex(x=>x.cid===b.cid));
    const o=g[0],name=(g.length>1||o.group)&&g.every(i=>i.group&&i.group===o.group)&&!E.some(e=>e[0]===o.cid||e[1]===o.cid)?o.group:(D.flowNames||{})[o.cid]||o.flow||o.title.replace(/<[^>]+>/g,'');let nm=name,j=2;while(S.sections.includes(nm))nm=name+' ('+(j++)+')';
    S.sections.push(nm);if(o.group&&name===o.group)S.grid.add(nm);g.forEach(i=>{i.section=nm;i.depth=depth[i.cid];S.rank[i.cid]=k++})})}
/* ---- straight arrows. Each step sits level with the step before it (its screenshot's centre, so a longer caption never shifts it).
   Columns are already given (depth). Per flow: (1) order each column by the happy path: a step follows its "ref" (the topmost of its predecessors), siblings in the order their edges are listed, so the first-listed branch is on top;
   (2) the first-listed child of a step stays level with it; other children, and extra arrows into a join, bend if they have to;
   (3) solve top offsets by pushing down only (never up): a step pushed lower also pulls its ref (and so its whole chain) down so the arrow stays straight, unless that is more than BEND card heights, then the arrow bends.
   Only CSS `order` and margin-top change, so the DOM, comments and keyboard order are untouched. */
const BEND=2;
function alignFlows(){if(!FLOW)return;const z=S.z||1;
  document.querySelectorAll('.lane.flow .fl').forEach(fl=>{
    const N={},cols=[...fl.querySelectorAll(':scope>.fcol')].map((c,ci)=>[...c.querySelectorAll(':scope>.card')].map((el,di)=>{const sh=el.querySelector('.shot,.noshot');if(!sh||!el.id)return null;const er=el.getBoundingClientRect(),sr=sh.getBoundingClientRect();
      return N[el.id.slice(2)]={id:el.id.slice(2),el,ci,di,h:er.height/z,a:((sr.top+sr.bottom)/2-er.top)/z,T:0,ref:null,lvl:false,key:[di]}}).filter(Boolean));
    const P={};(S.E||[]).forEach(([a,b],idx)=>{if(N[a]&&N[b])(P[b]=P[b]||[]).push({n:N[a],idx})});
    const cmp=(x,y)=>{for(let i=0;i<Math.max(x.length,y.length);i++){if(x[i]===undefined)return -1;if(y[i]===undefined)return 1;if(x[i]!==y[i])return x[i]-y[i]}return 0};
    cols.forEach((col,ci)=>{col.forEach(n=>{const ps=(P[n.id]||[]).filter(x=>x.n.ci<ci);if(!ps.length)return;
        const b=ps.reduce((u,v)=>cmp(u.n.key,v.n.key)<=0?u:v);n.ref=b.n;n.key=[...b.n.key,b.idx]});
      col.sort((x,y)=>cmp(x.key,y.key))});
    /* the column's own spacing (gap and the cards' margins) is read, not assumed: put the cards in their new order with no extra margin and measure where they land */
    cols.forEach(col=>col.forEach((n,k)=>{n.el.style.order=k;n.el.style.marginTop=''}));
    cols.forEach(col=>col.forEach((n,k)=>{n.mt0=parseFloat(getComputedStyle(n.el).marginTop)||0;n.g=k?Math.max(0,(n.el.getBoundingClientRect().top-col[k-1].el.getBoundingClientRect().bottom)/z):0}));/* mt0: the card's own top margin (cards sit 6px outside their box), which an inline margin-top would replace */
    const first={};cols.flat().forEach(n=>{if(n.ref&&(!first[n.ref.id]||cmp(n.key,first[n.ref.id].key)<0))first[n.ref.id]=n});cols.flat().forEach(n=>{n.lvl=!!n.ref&&first[n.ref.id]===n});
    for(let pass=0;pass<60;pass++){let ch=false;
      cols.forEach(col=>col.forEach((n,k)=>{let lb=k?col[k-1].T+col[k-1].h+n.g:0;if(n.lvl)lb=Math.max(lb,n.ref.T+n.ref.a-n.a);if(n.T<lb-.5){n.T=lb;ch=true}
        if(n.lvl){const d=n.T+n.a-(n.ref.T+n.ref.a);if(d>.5&&d<=BEND*n.h){n.ref.T+=d;ch=true}}}));
      if(!ch)break}
    cols.forEach(col=>col.forEach((n,k)=>{const m=k?Math.max(0,n.T-(col[k-1].T+col[k-1].h)-n.g):n.T;n.el.style.marginTop=Math.round((n.mt0+m)*10)/10+'px'}))})}
/* reading order for ↑ ↓: every screen exactly once, row by row (left to right, then down), flow by flow, ignoring the arrows. Two screens are in one row when their screenshot centres are within 40% of the shorter one's height. A States grid keeps its own order */
function visualOrder(){const out=[];ordered().forEach(g=>{const ids=g.items.map(i=>i.cid);if(S.grid?.has(g.s)){out.push(...ids);return}
    const m=ids.map(id=>{const sh=document.querySelector(`#c-${CSS.escape(id)} .shot, #c-${CSS.escape(id)} .noshot`);if(!sh)return null;const r=sh.getBoundingClientRect();return{id,cy:(r.top+r.bottom)/2,l:r.left,h:r.height}});
    if(m.some(x=>!x)){out.push(...ids);return}
    m.sort((x,y)=>x.cy-y.cy);const rows=[];m.forEach(x=>{const r=rows.at(-1);if(r&&Math.abs(x.cy-r.cy)<=.4*Math.min(x.h,r.h))r.items.push(x);else rows.push({cy:x.cy,h:x.h,items:[x]})});
    rows.forEach(r=>r.items.sort((x,y)=>x.l-y.l).forEach(x=>out.push(x.id)))});return out}
function drawArrows(){if(!FLOW)return;alignFlows();const z=S.z||1;
  /* measure everything first, then draw: interleaving reads and writes forced a full layout per flow, and a document-wide selector per edge per flow froze big canvases for seconds */
  const jobs=[...document.querySelectorAll('.fl')].map(fl=>{const o=fl.getBoundingClientRect(),R={},C={},CL={},w=fl.scrollWidth;
    fl.querySelectorAll('.card[id^="c-"]').forEach(c=>{const id=c.id.slice(2),e=c.querySelector('.shot,.noshot');if(e){R[id]=e.getBoundingClientRect();C[id]=c.getBoundingClientRect();CL[id]=c.parentNode}});
    const pt=(id,side)=>{const r=R[id];return r?{x:((side?r.right:r.left)-o.left)/z,y:((r.top+r.bottom)/2-o.top)/z}:null};
    const E=(S.E||[]).map((e,i)=>({a:e[0],b:e[1],l:e[2],i})).filter(e=>R[e.a]&&R[e.b]),ids=Object.keys(C);
    const bx=ids.map(id=>{const c=C[id];return{id,l:(c.left-o.left)/z+6,r:(c.right-o.left)/z-6,t:(c.top-o.top)/z+6,b:(c.bottom-o.top)/z-6}}),B={};bx.forEach(x=>B[x.id]=x);
    let base=0;bx.forEach(x=>{base=Math.max(base,x.b+6)});/* lowest card bottom (not scrollHeight: that includes this very svg) */
    const hits=(pts,skip)=>bx.some(x=>!skip.includes(x.id)&&pts.some(([px,py])=>px>x.l&&px<x.r&&py>x.t&&py<x.b));
    const freeBelow=id=>!bx.some(x=>x.id!==id&&CL[x.id]===CL[id]&&x.t>=B[id].b-2),freeAbove=id=>!bx.some(x=>x.id!==id&&CL[x.id]===CL[id]&&x.b<=B[id].t+2);
    let top0=1e9;bx.forEach(x=>{top0=Math.min(top0,x.t-6)});const padT=+fl.dataset.rett||0,topBase=top0;/* top of the cards, inside the flow's top padding */
    /* routing: a clear curve when there is one; otherwise (it would run behind a card, or it returns to an earlier screen) a detour out of the bottom of one card and into the bottom of the other, along a lane under the flow; if something sits below them, the same over the top. Returns are dashed. Last resort: the direct curve. */
    const info=E.map(e=>{const p=pt(e.a,1),q=pt(e.b,0),back=q.x<p.x+12,L=16,ax=p.x+6,bx2=q.x-L,dx=Math.max(24,(bx2-ax)/2);
      const dir=cub([ax,p.y],[ax+dx,p.y],[bx2-dx,q.y],[bx2,q.y]);
      const sx=((R[e.a].left+R[e.a].right)/2-o.left)/z,tx=((R[e.b].left+R[e.b].right)/2-o.left)/z;let mode='direct';
      if(back||hits(dir,[e.a,e.b])){
        if(freeBelow(e.a)&&freeBelow(e.b)&&!hits(hammock(sx,B[e.a].b+2,tx,B[e.b].b+2,base+46).pts,[e.a,e.b]))mode='bottom';
        else if(freeAbove(e.a)&&freeAbove(e.b)&&!hits(hammock(sx,B[e.a].t-2,tx,B[e.b].t-2,topBase-46).pts,[e.a,e.b]))mode='top'}
      return{e,p,q,back,ax,bx2,dx,sx,tx,mode}});
    const lanes=m=>{const s=info.filter(x=>x.mode===m).sort((u,v)=>Math.abs(u.sx-u.tx)-Math.abs(v.sx-v.tx));return new Map(s.map((x,k)=>[x.e.i,k]))},LB=lanes('bottom'),LT=lanes('top');
    const ret=+fl.dataset.ret||0,extra=LB.size?18*LB.size+56:0;if(extra!==ret){fl.dataset.ret=extra;fl.style.paddingBottom=(8+extra)+'px'}
    const extT=LT.size?18*LT.size+56:0;if(extT!==padT){fl.dataset.rett=extT;fl.style.paddingTop=(4+extT)+'px';requestAnimationFrame(drawArrows)}
    const html=info.map(x=>{const {e,p,q,ax,bx2,dx}=x,l=e.l;
      if(x.mode!=='direct'){const bot=x.mode==='bottom',s=bot?B[e.a].b+2:B[e.a].t-2,tt=bot?B[e.b].b+2:B[e.b].t-2,ly=bot?base+46+LB.get(e.i)*18:topBase-46-LT.get(e.i)*18,h=hammock(x.sx,s,x.tx,tt,ly),c='#8F887E',d=bot?1:-1;
        return `<path d="${h.d}" fill="none" stroke="${c}" stroke-width="1.8" ${x.back?'stroke-dasharray="7 5"':''} stroke-linecap="round" stroke-linejoin="round"/><path d="M${x.tx-5} ${tt+11*d} L${x.tx} ${tt+d} L${x.tx+5} ${tt+11*d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`+(l?`<text class="elabel" x="${h.mx}" y="${ly+(bot?-8:14)}" text-anchor="middle">${esc(l)}</text>`:'')}
      return `<path d="M${p.x} ${p.y} L${ax} ${p.y} C${ax+dx} ${p.y} ${bx2-dx} ${q.y} ${bx2} ${q.y} L${q.x-1} ${q.y}" fill="none" stroke="#8F887E" stroke-width="1.6" stroke-linecap="round"/><path d="M${q.x-11} ${q.y-4.5} L${q.x-1} ${q.y} L${q.x-11} ${q.y+4.5}" fill="none" stroke="#8F887E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`+(l?elabel(l,p,q):'')}).join('');
    return {sv:fl.querySelector('svg.arrows'),w,h:base+extra+8,html}});
  jobs.forEach(j=>{if(!j.sv)return;j.sv.setAttribute('width',j.w);j.sv.setAttribute('height',j.h);j.sv.innerHTML=j.html})}
/* helpers for arrow routing: points on a cubic, and the "hammock" detour (leaves the bottom of one card vertically, sags to a level lowest point at y=ly, comes up vertically into the bottom of the other) */
function cub(a,b,c,d,n=24){const out=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;out.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]])}return out}
function hammock(sx,s,tx,tt,ly){const mx=(sx+tx)/2,dv=ly-s,du=ly-tt,sg=du<0?-1:1,P=[[sx,s],[sx,s+dv*.7],[sx+(mx-sx)*.5,ly],[mx,ly]],Q=[[mx,ly],[mx+(tx-mx)*.5,ly],[tx,ly-sg*Math.min(Math.abs(du)*.6,240)],[tx,tt-sg*4*-1]];
  /* lane at y=ly: below the cards (du>0, arrives pointing up) or above them (du<0, arrives pointing down) */
  const e=tt+(du>0?4:-4);Q[3]=[tx,e];
  return{mx,d:`M${sx} ${s} C${P[1][0]} ${P[1][1]} ${P[2][0]} ${P[2][1]} ${mx} ${ly} C${Q[1][0]} ${Q[1][1]} ${Q[2][0]} ${Q[2][1]} ${tx} ${e}`,pts:[...cub(...P),...cub(...Q)]}}
/* arrow label: small, right-aligned just before the arrowhead (where each arrow is on its own), wrapped only when wider than the gap between the two screens */
function elabel(l,p,q){const cw=2.9,room=Math.max(40,(q.x-p.x)*.6),max=Math.max(8,Math.floor(room/cw)),words=String(l).split(/\s+/),lines=[];let cur='';words.forEach(w=>{if(cur&&(cur+' '+w).length>max){lines.push(cur);cur=w}else cur=cur?cur+' '+w:w});if(cur)lines.push(cur);
  const x=q.x-14,y=q.y-4-(lines.length-1)*6.2;return `<text class="elabel" x="${x}" y="${y}" text-anchor="end">${lines.map((t,k)=>`<tspan x="${x}" dy="${k?6.2:0}">${esc(t)}</tspan>`).join('')}</text>`}
/* issues sharing a screenshot stay together (placed where the first of them ranks), so stepping finishes one screenshot before the next */
function byScreen(arr){if(FLOW)return arr;const m=new Map();arr.forEach(i=>{const k=i.screen?'s:'+i.screen:'#'+i.cid;(m.get(k)||m.set(k,[]).get(k)).push(i)});return [...m.values()].flat()}
function ordered(){ // per section, highest priority first; one serial across the canvas
  let n=0;return S.sections.map(s=>({s,items:byScreen(S.items.filter(i=>i.section===s&&visible(i)).sort((a,b)=>rk(a)-rk(b))).map(i=>(i.sn=++n,i))})).filter(g=>g.items.length);
}
function ccBadge(t){const th=threads(t);if(!th.length)return'';const todo=th.some(c=>st(c)!=='done');return `<span class="cc ${todo?'todo':''}">${ic('ai')}${th.length}</span>`}
/* redraw only what changed: cards are collected while the canvas HTML is built; when the layout around them is the same as last time, just the cards whose HTML differs are replaced (screenshots elsewhere are untouched), otherwise everything is rebuilt */
function keep(cid,h){if(!S.cc)return h;S.cc[cid]=h;return `<!--c:${cid}-->`}
function patchWorld(W,skel){const C=S.cc||{};S.cc=null;const full=()=>skel.replace(/<!--c:(.*?)-->/g,(m,id)=>C[id]??'');let n=0;
  if(S.wSkel===skel&&S.wCards&&W.firstChild){for(const id in C){if(S.wCards[id]===C[id])continue;const el=W.querySelector(`.card[data-cid="${CSS.escape(id)}"]`);if(!el){n=-1;break}el.outerHTML=C[id];n++}}else n=-1;
  if(n<0){W.innerHTML=full();n=1}S.wSkel=skel;S.wCards=C;if(n)requestAnimationFrame(()=>typeof drawArrows==='function'&&drawArrows())}
/* flows are numbered by the canvas, in order (state groups aren't); a number typed into a flow's name is dropped, so names stay just names */
function flowNo(sec){if(!FLOW||S.grid?.has(sec))return 0;return S.sections.filter(x=>!S.grid?.has(x)).indexOf(sec)+1}
function bareSec(sec){return String(sec).replace(/^\s*\d+[a-z]?\s*[·.:)\-]\s*/i,'')}
function render(){
  const groups=ordered(),all=groups.flatMap(g=>g.items);
  const open=S.items.filter(i=>OPEN.has(i.kind)).length,hi=S.items.filter(i=>OPEN.has(i.kind)&&pr(i)==='high').length;
  const todo=S.comments.filter(c=>!c.resolved&&st(c)!=='done').length;
  void `<span><b>${open}</b> open</span><span><b style="color:var(--high)">${hi}</b> high</span><span><b>${todo}</b> comments to do</span>`;
  document.getElementById('cI').textContent=all.length;document.getElementById('cN').textContent=all.filter(unread).length;document.getElementById('cD').textContent=(S.deleted||[]).length;document.querySelector('[data-tab="deleted"]').hidden=true;/* deleted issues live in their own section at the end */requestAnimationFrame(fitTabs);
  const waiting=S.inbox.filter(i=>!i.processed).length;const cIn=document.getElementById('cIn');{/* To-dos badge: "completed · in progress", or just completed when nothing is in progress */const op=S.comments.filter(c=>!c.resolved),shot=t=>S.inbox.some(i=>'card:'+i.id===t);let dn=0,td=0;{const G={};op.filter(c=>!shot(c.target)).forEach(c=>(G[c.target]=G[c.target]||[]).push(c));Object.values(G).forEach(th=>th.every(c=>st(c)==='done')?dn++:td++)}S.inbox.forEach(i=>{const th=op.filter(c=>c.target==='card:'+i.id);(i.processed&&th.every(c=>st(c)==='done'))?dn++:td++});(D.todos||[]).forEach(t=>{const its=(t.steps||[]).map(id=>S.items.find(i=>i.cid===String(id))).filter(Boolean);if(!its.length)td++;else if(its.some(unread))dn++});cIn.textContent=td?`${dn} · ${td}`:dn;cIn.title=`${dn} completed${td?` · ${td} in progress`:''}`}cIn.className='c'+(waiting?' blue':'');
  document.getElementById('fdot').hidden=!((S.showPrio&&S.fp.size)||S.unreadOnly||S.ftag?.size);/* the dot: only while a filter is really applied */
  const L=document.getElementById('list');
  if(S.tab==='issues'){
    L.innerHTML=groups.map(g=>{const op=S.openSecs.has(g.s);return `<div class="secw ${op?'open':''}" data-secw="${esc(g.s)}"><div class="sec" data-sec="${esc(g.s)}">${ic('chev')}<span class="stt">${FLOW&&flowNo(g.s)?`<span class="fno">${flowNo(g.s)} · </span>`:''}<span data-secname="${esc(g.s)}">${FLOW&&flowNo(g.s)?bareSec(g.s):g.s}</span></span><span class="n">${g.items.length}</span></div>`+
      `<div class="secb"><div class="secin">`+g.items.map(i=>`<div class="row ${S.sel===i.cid?'sel':''}" data-cid="${i.cid}"><span class="sn">${num(i)}</span><button class="pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button>${unread(i)?`<button class="nd" data-read="${i.cid}" title="Unread — click to mark read"></button>`:''}<span class="rt" data-rted="${i.cid}">${sideTitle(i.title)}</span><span class="ra"><button class="ib" data-menu="${i.cid}" title="More">${ic('more')}</button></span>${(()=>{const th=threads('card:'+i.cid),todo=th.some(c=>st(c)!=='done');return `<button class="ib cmb ${th.length?'has':''} ${todo?'todo':''}" data-open="card:${i.cid}" title="Comments for Claude">${ic('ai')}${th.length?`<em>${th.length}</em>`:''}</button>`})()}</div>`).join('')+`</div></div></div>`}).join('')+xSide()||`<div class="empty">Nothing matches these filters.</div>`;
  }else if(S.tab==='new'){const nu=all.filter(unread);
    L.innerHTML=nu.length?nu.map(i=>`<div class="row ${S.sel===i.cid?'sel':''}" data-cid="${i.cid}"><span class="sn">${num(i)}</span><button class="pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button><button class="nd" data-read="${i.cid}" title="Unread — click to mark read"></button><span class="rt" data-rted="${i.cid}">${sideTitle(i.title)}</span><span class="ra"><button class="ib" data-menu="${i.cid}" title="More">${ic('more')}</button></span>${(()=>{const th=threads('card:'+i.cid),ai=th.some(t=>(t.thread||[]).at(-1)?.by==='Claude');return `<button class="ib cmb ${th.length?'has':''} ${ai?'ai':''}" data-open="card:${i.cid}" title="${ai?'Claude replied — this is why it shows as new':'Comments'}">${ic('ai')}${th.length?`<em>${th.length}</em>`:''}</button>`})()}</div>`).join(''):`<div class="empty">Nothing new — you've read everything.</div>`;
  }else if(S.tab==='inbox'){
    const sn=Object.fromEntries(ordered().flatMap(g=>g.items).map(i=>[i.cid,num(i)]));
    const open=S.comments.filter(c=>!c.resolved),isShot=t=>S.inbox.some(i=>'card:'+i.id===t);
    const nm=c=>{const t=c.target;if(t==='page')return '<span class="rt">General</span>';const id=t.replace(/^card:|^lane:/,''),it=S.items.find(i=>i.cid===id);
      return it?`<span class="sn">${num(it)}</span><span class="rt">${it.title.replace(/<[^>]+>/g,'')}</span>`:`<span class="rt">${esc(c.title||'Removed issue')}</span>`};
    const msgs=c=>{const me=c.thread.filter(m=>m.by!=='Claude').slice(-1)[0],cl=c.thread.filter(m=>m.by==='Claude').slice(-1)[0];
      return (me?`<div class="l2 u">${esc(me.text)}</div>`:'')+(cl?`<div class="l2"><b>Claude:</b> ${esc(cl.text)}</div>`:'')};
    // actions, right to left: Resolve (enabled once Claude is done) · Chat · Delete (new screenshots only)
    const res=(attr,done)=>`<button class="oa ok res ${done?'on':''}" ${attr} title="Archive chat — you've reviewed it; it moves to Archived">${ic('archive')}</button>`;
    const pill=c=>st(c)==='inprogress'?'<span class="st inprogress">In progress</span>':'';
    const items=[];
    { /* one row per issue/screen: its threads are counted, opened and resolved one by one in the popover */
      const G=new Map();open.filter(c=>!isShot(c.target)).forEach(c=>{if(!G.has(c.target))G.set(c.target,[]);G.get(c.target).push(c)});
      G.forEach((th,t)=>{const last=th.slice().sort((a,b)=>((b.thread.at(-1)?.at||b.createdAt)>(a.thread.at(-1)?.at||a.createdAt)?1:-1))[0],all=th.every(c=>st(c)==='done'),k=all?'done':th.some(c=>st(c)==='inprogress')?'inprogress':'todo',
        cnt=th.length>1?`<span class="tcnt">${th.length} threads</span>`:'',btn=th.length>1?`<button class="oa ok res ${all?'on':''}" data-tresg="${th.map(c=>c.id).join(',')}" ${all?'':'disabled'} title="${all?`Archive all ${th.length} chats`:'Waiting on Claude — archive once every chat is done, or one by one in the chat'}">${ic('archive')}<em>${th.length}</em></button>`:res(`data-tres="${last.id}"`,all);
        items.push({k,at:last.thread.at(-1)?.at||last.createdAt,h:`<div class="task" data-task="${t}"><div class="th1">${nm(last)}${cnt}${k==='inprogress'?'<span class="st inprogress">In progress</span>':''}</div>${msgs(last)}
        <div class="ovr tr"><button class="oa" data-open="${t}" title="Chat">${ic('ai')}</button>${btn}</div></div>`})})}
    S.inbox.forEach(i=>{const th=open.filter(c=>c.target==='card:'+i.id),p=S.prio[i.id]||'low',done=!!i.processed&&th.every(c=>st(c)==='done');
      items.push({k:done?'done':th.some(c=>st(c)==='inprogress')?'inprogress':'todo',at:i.at,h:`<div class="irow" ${i.issue&&sn[i.issue]?`data-goto="${i.issue}"`:''}><div class="iimg"><img src="${esc(i.file)}">
        <div class="lacts"><button class="a pp ${p}" data-prio="${i.id}" title="${PL[p]} priority — click to change">${PS[p]}</button></div>
        <div class="ovr br"><button class="oa" data-idel="${i.id}" title="Delete — taken by mistake">${ic('trash')}</button><button class="oa" data-open="card:${i.id}" title="Chat">${ic('ai')}</button>${th.length>1||!done?`<button class="oa ok res ${done?'on':''}" data-ires="${i.id}" ${done?'':'disabled'} title="${done?`Archive the screenshot and its ${th.length} thread${th.length===1?'':'s'}`:'Waiting on Claude — resolve once every thread is done'}">${ic('archive')}${th.length>1?`<em>${th.length}</em>`:''}</button>`:res(`data-ires="${i.id}"`,done)}</div></div>
        <div class="l2 meta2">${i.processed?(sn[i.issue]?'Became issue '+sn[i.issue]+' · <span class="lk">Show on canvas →</span>':'Added as an issue'):'Screenshot lined up to be assessed'}</div>
        ${th.map(c=>`<div class="ithread" data-task="${c.target}">${pill(c)}${msgs(c)}</div>`).join('')}</div>`})});
    /* Claude's own to-dos (flows.json "todos"): no chat; in progress until their screens are added, then completed until the user has read them all, then gone */
    (D.todos||[]).forEach(t=>{const its=(t.steps||[]).map(id=>S.items.find(i=>i.cid===String(id))).filter(Boolean);if(its.length&&!its.some(unread))return;
      items.push({k:its.length?'done':'inprogress',at:t.at||'',h:`<div class="task" ${its.length?`data-goto="${its[0].cid}"`:''}><div class="th1"><span class="rt">${esc(t.text)}</span>${its.length?'':'<span class="st inprogress">In progress</span>'}</div><div class="l2"><b>Claude:</b> ${its.length?`${its.length} screen${its.length>1?'s':''} added`:'working on it'}</div>${its.length?`<div class="ovr tr"><button class="oa" data-open="card:${its[0].cid}" title="Chat about these screens">${ic('ai')}</button><button class="oa tdr" data-todoread="${its.map(i=>i.cid).join(',')}" title="Mark read — clears this to-do"><span class="nd"></span></button></div>`:''}</div>`})});
    // order: what Claude is on now, then in the order it will pick things up (oldest first)
    const done=items.filter(x=>x.k==='done'),todo=items.filter(x=>x.k!=='done').sort((x,y)=>(x.k==='inprogress'?0:1)-(y.k==='inprogress'?0:1)||String(x.at).localeCompare(String(y.at)));
    const grp=(key,title,arr,empty)=>`<div class="secw ${S.openSecs.has('ib:'+key)?'open':''}" data-secw="ib:${key}"><div class="sec" data-sec="ib:${key}">${ic('chev')}<span class="stt">${title}</span><span class="n">${arr.length}</span></div><div class="secb"><div class="secin">${arr.map(x=>x.h).join('')||`<div class="ihint">${empty}</div>`}</div></div></div>`;
    if(!S.ibInit){S.ibInit=1;S.openSecs.add('ib:done');S.openSecs.add('ib:todo')}
    /* one list, three sections (always shown); the chips jump to a section and light up as you scroll */
    const nres=(S.resolved||[]).length,secs=[['done','Completed',done.length],['todo','In progress',todo.length],['resolved','Archived',nres]];
    const ndone=doneThreads().length;
    const sec=(k,l,n,body,empty,extra='')=>{const shut=n&&(S.ibShut?S.ibShut.has(k):k==='resolved'&&!S.resOpen);/* each section collapses; Resolved starts collapsed */return `<div class="ibsec ${shut?'shut':''}" data-ibsec="${k}"><div class="ibh" ${n?`data-ibtog="${k}"`:''}>${n?ic('chev'):''}<span>${l}</span><span class="n">${n}</span>${extra}</div>${shut?'':n?body:`<div class="ihint">${empty}</div>`}</div>`};
    L.innerHTML=`<div class="subtabs">${secs.map(([k,l,n])=>`<button class="subtab ${(S.sub||'done')===k?'on':''}" data-sub="${k}">${l} <span class="c">${n}</span></button>`).join('')}</div>`+
      sec('done','Completed',done.length,done.map(x=>x.h).join(''),'Nothing waiting for you to check.',ndone?`<button class="chip" data-bulk="resolve">Archive all · ${ndone}</button>`:'')+
      sec('todo','In progress',todo.length,todo.map(x=>x.h).join(''),'Nothing queued. Comments and new screenshots show up here.')+
      sec('resolved','Archived',nres,resolvedHTML(),'Nothing archived yet.');
  }else if(S.tab==='resolved'){L.innerHTML=resolvedHTML();
  }else{
    L.innerHTML=(S.deleted||[]).length?`<div class="delbar"><span>${S.deleted.length} waiting to be deleted</span><button class="chip danger" data-delall>Delete all</button></div>`+S.deleted.map(i=>`<div class="row drow" ${i.img?`data-exp="${esc(i.img)}" title="Open the screenshot"`:''}>${i.img?`<img class="dthumb" src="${esc(i.img)}" alt="">`:''}<span class="rt">${sideTitle(i.title)}</span><button class="chip" data-restore="${i.cid}">Restore</button></div>`).join(''):`<div class="empty">${ic('trash')}<br><b>Nothing deleted</b><br>When Claude deletes an issue it moves here with its thread, and stays until you resolve that thread. You can restore it from here.</div>`;
  }
  const W=document.getElementById('world');S.cc={};
  patchWorld(W,`<div class="hdr"><h1 data-ptitle title="Double-click to rename">${esc(document.getElementById('ttl').textContent)}</h1></div>`+(FLOW?groups.map((g,gi)=>{if(S.grid?.has(g.s)){/* "States / Views dropdown": consecutive groups with the same parent share one section, one sub-heading each */const sp=x=>(x.match(/^(.+?) (?:\/|·) (.+)$/)||[]),par=sp(g.s)[1]||null,sub=par?sp(g.s)[2]:g.s,pv=groups[gi-1],nx=groups[gi+1],pp=s=>S.grid?.has(s)&&sp(s)[1]||null,first=!par||pp(pv?.s)!==par,last=!par||pp(nx?.s)!==par,cnt=n=>`${n} screen${n>1?'s':''}`;
      const tot=par?groups.filter(x=>pp(x.s)===par).reduce((n,x)=>n+x.items.length,0):0;
      return (first?`<section class="lane flow sgrid ${/^states\b/i.test(par||g.s)?'sth':''}">`+(par?`<h2 class="bigh"><b class="lt">${esc(par)}</b><span>${cnt(tot)}</span></h2>`:''):'')+(par?`<h2 class="sub"><b class="lt" data-secname="${esc(g.s)}">${esc(sub)}</b><span>${cnt(g.items.length)}</span></h2>`:`<h2><b class="lt" data-secname="${esc(g.s)}">${g.s}</b><span>${cnt(g.items.length)}</span></h2>`)+`<div class="grid">${g.items.map(card).join('')}</div>`+(last?'</section>':'')}const cols=[];g.items.forEach(i=>(cols[i.depth]=cols[i.depth]||[]).push(i));return `<section class="lane flow"><h2><b class="lt"><span class="fno">${flowNo(g.s)} · </span><span data-secname="${esc(g.s)}">${bareSec(g.s)}</span></b><span>${g.items.length} step${g.items.length>1?'s':''}</span></h2><div class="fl"><svg class="arrows"></svg>${cols.filter(Boolean).map(c=>`<div class="fcol">${c.map(card).join('')}</div>`).join('')}</div></section>`}).join('')
      :groups.map(g=>`<section class="lane"><h2><b class="lt" data-secname="${esc(g.s)}">${g.s}</b><span>${g.items.length}</span></h2><div class="grid">${units(g.items)}</div></section>`).join(''))+xLanes());
;document.querySelectorAll('[data-sgbar]').forEach(b=>sgBar(b.dataset.sgbar));bulkBar(all);(S.prevOn||[]).forEach(cid=>{const it=S.items.find(i=>i.cid===cid);if(it)showPrev(it,true,true)});if(FLOW){const inc=new Set((S.E||[]).map(e=>e[1]));document.querySelectorAll('#world [data-cid]').forEach(el=>el.classList.toggle('fstart',!inc.has(el.dataset.cid)))}requestAnimationFrame(markStuck);requestAnimationFrame(fitAll)}
const LH=1.45,LINES=2;
function clampH(el){return Math.ceil(parseFloat(getComputedStyle(el).fontSize)*LH*LINES)}
function fitAll(){document.querySelectorAll('.body[data-body]').forEach(el=>{const it=S.items.find(i=>i.cid===el.dataset.body)||S.deleted?.find(i=>i.cid===el.dataset.body);const o=!!(it&&it.expanded);el.classList.toggle('shut',!o);o?el.removeAttribute('hidden'):el.setAttribute('hidden','until-found');el.style.maxHeight='';el.closest('.gi,.card')?.querySelector(`[data-more="${el.dataset.body}"]`)?.classList.toggle('up',o)})}
function syncSecs(cid){document.querySelectorAll('.secw').forEach(w=>w.classList.toggle('open',S.openSecs.has(w.dataset.secw)));
  if(cid)setTimeout(()=>document.querySelector(`.row[data-cid="${cid}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}),240)}
function closeMenu(){const M=document.getElementById('menu');M.hidden=true;M.dataset.for=''}
function placeMenu(M,btn){S.menuAnchor=btn;M.hidden=false;const r=btn.getBoundingClientRect();M.style.left=Math.min(r.left,innerWidth-200)+'px';M.style.top=(r.bottom+4+M.offsetHeight>innerHeight?r.top-M.offsetHeight-4:r.bottom+4)+'px'}
function openPicker(cid,btn){const M=document.getElementById('menu'),p=pr({cid});M.className='picker';
  M.innerHTML=['high','med','low'].map(v=>`<button data-pick="${v}" class="pp ${v} ${p===v?'on':''}" title="${PL[v]}">${PS[v]}</button>`).join('');M.dataset.for=cid;placeMenu(M,btn)}
function openMenu(cid,btn){const M=document.getElementById('menu'),it=S.items.find(i=>i.cid===cid);M.className='';
  const inG=!!document.getElementById('c-'+cid)?.closest('.grp');
  M.innerHTML=(inG?`<button data-mi="split">${ic('split')}Move to its own card</button>`:`<button data-mi="combine">${ic('merge')}Combine with another card…</button>`)+(FLOW?'':`<button data-mi="fix">${ic('cfix')}Mark fixed</button>`)+`<hr><button data-mi="read">${ic('dot')}${unread(it)?'Mark as read':'Mark as unread'}</button><hr><button data-mi="del" class="danger">${ic('trash')}Delete issue</button>`;
  M.dataset.for=cid;placeMenu(M,btn)}
function menuAct(a,v){const cid=document.getElementById('menu').dataset.for,it=S.items.find(i=>i.cid===cid);closeMenu();
  if(a==='fix'){setFixed([cid],true);return}
  if(a==='prio'){S.prio[cid]=v;render();toast('Priority set to '+PL[v]+'')}
  else if(a==='edit'){const h=document.querySelector(`#c-${cid} .ttl`);h?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))}
  else if(a==='split'){const was=it.screen;it.screen='';render();post('api/edit',{cid,screen:''});toast('Moved to its own card',()=>{it.screen=was;render();post('api/edit',{cid,screen:was})})}
  else if(a==='combine'){const M=document.getElementById('menu'),others=S.items.filter(x=>x.section===it.section&&x.cid!==cid&&(!x.screen||x.screen!==it.screen));
    M.innerHTML=`<div class="mh">Show on the same card as…</div>`+others.map(x=>`<button data-comb="${x.cid}"><span class="snt">${num(x)}</span> ${x.title.replace(/<[^>]+>/g,'').slice(0,46)}</button>`).join('')||'<div class="mh">No other cards in this section</div>';M.hidden=false;M.dataset.for=cid;return}
  else if(a==='read'){const was=unread(it);if(was)S.readLocal.add(cid);else{S.readLocal.delete(cid);S.seen.delete(cid)}render();post('api/state',{cid,new:!was})}
  else if(a==='del'){const ids0=ordered().flatMap(g=>g.items.map(i=>i.cid)),di=ids0.indexOf(cid),nx=ids0[di+1]||ids0[di-1],wasSel=S.sel===cid;S.items=S.items.filter(i=>i!==it);if(FLOW)flowLayout();(S.deleted=S.deleted||[]).push(it);render();post('api/removed',{cid,removed:true,title:it.title.replace(/<[^>]+>/g,''),n:String(it.n||'')});if(wasSel&&nx&&!FLOW)stepTo(null,nx);else if(wasSel&&!FLOW)S.sel=null;toast(FLOW?'Step deleted — flow reconnected':'Moved to Deleted',()=>{S.deleted=S.deleted.filter(x=>x!==it);S.items.push(it);if(FLOW)flowLayout();render();post('api/removed',{cid,removed:false});if(!FLOW)stepTo(null,cid)})}}
function sgBar(cid,ask){const bar=document.querySelector(`[data-sgbar="${cid}"]`);if(!bar)return;const n=bar.parentNode.querySelectorAll('[data-sg]:checked').length,all=bar.parentNode.querySelectorAll('[data-sg]').length;
  if(ask){const m={acc:`Move ${n} to details?`,rej:`Reject ${n}?`,rejall:`Reject all ${all} suggestions?`}[ask];bar.innerHTML=`<span class="q">${m}</span><button class="pri" data-sgok="${ask}">Confirm</button><button data-sgcancel>Cancel</button>`;return}
  bar.innerHTML=n?`<button class="pri" data-sgok="keep">Keep ${n} · drop ${all-n}</button>`:''}
function sgApply(cid,how){const it=S.items.find(i=>i.cid===cid),box=document.querySelector(`[data-sgbar="${cid}"]`).parentNode;
  const ks=how==='rejall'||how==='keep'?it.sugg.map((_,k)=>k):[...box.querySelectorAll('[data-sg]:checked')].map(c=>+c.dataset.sg.split(':')[1]);
  const ids=how==='keep'?[...box.querySelectorAll('[data-sg]:checked')].map(c=>it.sids[+c.dataset.sg.split(':')[1]]):ks.map(k=>it.sids[k]),drop=it.sids.filter(x=>!ids.includes(x));
  const picked=how==='keep'?[...box.querySelectorAll('[data-sg]:checked')].map(c=>it.sugg[+c.dataset.sg.split(':')[1]]):ks.map(k=>it.sugg[k]);it.sugg=it.sugg.filter((_,k)=>!ks.includes(k));it.sids=it.sids.filter((_,k)=>!ks.includes(k));
  if(how==='keep'){post('api/suggestions',{ids,status:'accepted'});if(drop.length)post('api/suggestions',{ids:drop,status:'removed'})}else post('api/suggestions',{ids,status:'removed'});
  if(how==='acc'||how==='keep'){it.what=(it.what?it.what+'<br>':'')+picked.map(t=>'• '+t.replace(/^<b>[^<]*<\/b>\s*/,'')).join('<br>');it.expanded=true}
  render();toast(how==='rejall'?`Rejected all ${picked.length}`:`Moved ${picked.length} to details, dropped the rest`)}
// text that is only line breaks / spaces counts as empty (no Show more, no blank lines)
const trimHtml=h=>String(h||'').replace(/^(\s|&nbsp;|<br\s*\/?>|<div>\s*<\/div>)+|(\s|&nbsp;|<br\s*\/?>|<div>\s*<\/div>)+$/gi,'');
// ---- card layout v2 (reference: issue row = [#] [priority][unread] Title [Details ⌄] … hover: [menu][delete][comment]) ----
const MAXG=4;   // more than 4 issues on one screen -> the rest continue on another card with the same screenshot
const hasDet=i=>!!trimHtml(i.what);
function addRow(i){return FLOW?'':`<button class="addrow" data-addiss="${i.cid}" title="Add an issue on this screenshot">+ Add issue</button>`}
function hoverActs(i,cls){const T=threads('card:'+i.cid),n=T.length,ai=T.some(t=>(t.thread||[]).at(-1)?.by==='Claude');return `<span class="${cls}">${FLOW?'':`<button class="a hv fx" data-fix="${i.cid}" title="Mark fixed">${ic('cfix')}</button>`}${i.prev&&cls!=='racts'?`<button class="a hv cmp" data-cmp="${i.cid}" title="${i.prev.ref?'Show the design reference (Alt)':'Compare with the previous screenshot (Alt)'}${i.prev.label?' ('+esc(i.prev.label)+')':''}">${ic(i.prev.ref?'gaph':'history')}</button>`:''}<button class="a hv" data-menu="${i.cid}" title="More">${ic('more')}</button><button class="a hv del" data-del="${i.cid}" title="Delete issue">${ic('trash')}</button><button class="a cmi ${n?'has':'hv'} ${ai?'ai':''}" data-open="card:${i.cid}" title="Comments for Claude">${ic('ai')}${n?`<em>${n}</em>`:''}</button></span>`}
/* a thread moved from this issue to the one it is now about leaves a link behind */
function movedNote(i){const m=S.comments.filter(c=>c.movedFrom==='card:'+i.cid&&!c.resolved);if(!m.length)return '';const to=m[0].target.slice(5),it=(S.items||[]).find(x=>x.cid===to);return `<button class="moved" data-goto="${to}">${m.length>1?m.length+' comments':'Comment'} moved to ${it?num(it)+' · '+esc(it.title):to} →</button>`}
function issueRow(i){return `<div class="trow"><h3><span class="snt">${num(i)}</span><button class="a pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button>${unread(i)?`<button class="a rd" data-read="${i.cid}" title="Unread — click to mark read"><i></i></button>`:''}<span class="ttl" data-ed="title">${FLOW?i.title:tokHtml(i.title)}</span>${hasDet(i)?`<button class="dtog ${i.expanded?'up':''}" data-more="${i.cid}" title="Details">Details ${ic('chev')}</button>`:''}</h3></div>${movedNote(i)}
    <div class="body ${i.expanded?'':'shut'}" ${i.expanded?'':'hidden="until-found"'} data-body="${i.cid}"><div class="fix" data-ed="what">${FLOW?trimHtml(i.what):tokHtml(trimHtml(i.what))}</div></div>
    ${i.sugg.length?`<div class="sugg"><div class="sh">Claude’s suggestions · ${i.sugg.length}<button class="rjall" data-sgtop="${i.cid}">Reject all</button></div><ul>${i.sugg.map((s,k)=>`<li><input type="checkbox" data-sg="${i.cid}:${k}" aria-label="Select suggestion"><span style="flex:1">${s.replace(/^<b>[^<]*<\/b>\s*/,'')}</span></li>`).join('')}</ul><div class="sg-bar" data-sgbar="${i.cid}"></div></div>`:''}`}
const LOADED=new Set();   // screenshots already loaded once: re-renders skip the preview
const isrc=p=>esc(p)+(D.iv?.[p]?'?v='+D.iv[p]:'');/* image URL with its file fingerprint */
/* workflow: screenshots share one scale: a 1440px-wide page (at any pixel density) fills the card, a 400px close-up shows at 400/1440 of it, so text is the same size everywhere. A step can set "scale" (e.g. 0.8) or "dpr" */
const SHOTW=380,REFW=1440;function shotW(f){const m=D.imgs?.[f.img];if(!FLOW)return 0;if(!m)return SHOTW;/* no size known (file missing, or no Pillow): a full 1440-wide box */const css=m[0]/(f.dpr||m[3]||1);return Math.round(SHOTW*css/REFW*(f.scale||1))}
/* ---- Open this screen in the app: the button follows the screenshot that is showing. open = path of the build screen, refOpen = path of the design reference (or older version) screen. Local first (probed once), else the hosted app's closest page (dotted); the design reference has no hosted fallback. */
const ONET=u=>{try{return new URL(u).origin}catch{return ''}};
function openOrigin(ref){const A=D.app||{};if(VIEW)return '';if(!ref)return A.local?ONET(A.local):'';const d=[].concat(A.design||[]).map(x=>typeof x==='string'?x:x.url).find(u=>/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u||''));return d?ONET(d):''}
function openTarget(f,ref){const P=ref?f.refOpen:f.open,A=D.app||{};if(!P)return null;if(/^https?:\/\//.test(P))return {href:P,dot:false};
  const o=openOrigin(ref);if(o&&S.up&&S.up[o])return {href:o+(P.startsWith('/')?'':'/')+P,dot:false};
  if(ref||!A.url)return null;try{return {href:new URL(P.split(/[?#]/)[0].replace(/^\//,''),A.url).href,dot:true}}catch{return null}}
function openBtn(f){if(!f||!f.img||(!f.open&&!f.refOpen))return '';const b=openTarget(f,false),r=f.prev?openTarget(f,true):null;
  return `<button class="a opn ${b?'':'noo'} ${b&&b.dot?'dot':''} ${r?'':'nor'}" data-opn="${f.cid}" title="${b&&b.dot?'Open the closest page in the app (the exact screen is not available)':'Open this screen in the app'}">${ic('ext')}</button>`}
function probeLocal(){if(VIEW)return;S.up=S.up||{};const os=[...new Set([openOrigin(false),openOrigin(true)].filter(Boolean))];
  Promise.all(os.map(o=>fetch(o,{mode:'no-cors',signal:AbortSignal.timeout(1500)}).then(()=>{S.up[o]=true},()=>{S.up[o]=false}))).then(()=>{if(os.length)render()})}
function shotBox(f,acts,one,extraL){const gone=f.img&&D.iv&&!D.iv[f.img];/* the build found no file: keep the screenshot's space and say so */return `<div class="shotw">${gone?`<div class="noshot missing" style="width:${shotW(f)||SHOTW}px;height:${Math.round((shotW(f)||SHOTW)*900/1440)}px" title="${esc(f.img)}">Screenshot missing<br><small>${esc(f.img)}</small></div>`:f.img?`${(m=>m&&!LOADED.has(f.img)?`<img class="shot lq" src="${isrc(f.img)}" width="${m[0]}" height="${m[1]}" style="${shotW(f)?`width:${shotW(f)}px;`:''}aspect-ratio:${m[0]}/${m[1]};background-image:url(${m[2]})" onload="this.classList.remove('lq');LOADED.add(this.getAttribute('src').split('?')[0])" draggable="false" decoding="async">`:`<img class="shot" src="${isrc(f.img)}"${shotW(f)?` style="width:${shotW(f)}px"`:''} draggable="false" decoding="async">`)(D.imgs?.[f.img])}`:'<div class="noshot">No screenshot</div>'}<div class="lacts">${one?`<button class="a pp ${pr(f)}" data-prio="${f.cid}" title="${PL[pr(f)]} priority — click to change">${PS[pr(f)]}</button>`:''}${one&&unread(f)?`<button class="a rd" data-read="${f.cid}" title="Unread — click to mark read"><i></i></button>`:''}${extraL||''}${openBtn(f)}</div>${f.prev?`<span class="prevtag">${f.prev.ref&&/^design\b/i.test(f.prev.label||'')?esc(f.prev.label):(f.prev.ref?'Design':'Before')+(f.prev.label&&!/^before$/i.test(f.prev.label)?' · '+esc(f.prev.label):'')}</span>`:''}${acts||''}</div>`}
/* shared card, screenshot level: read marks every issue on it read; chat opens the first issue's thread */
function grpRead(g){const ur=g.filter(unread),rank={high:0,med:1,low:2},hi=g.map(pr).sort((a,b)=>rank[a]-rank[b])[0],tops=g.filter(i=>pr(i)===hi);
  /* screenshot-level priority = the highest among its issues; changing it moves every issue at that level */
  return `<button class="a pp ${hi}" data-prio="${tops[0].cid}" data-prio-grp="${tops.map(i=>i.cid).join(',')}" title="Highest priority here: ${PL[hi]} (${tops.length} of ${g.length}) — click to change those">${PS[hi]}</button>`+(ur.length?`<button class="a rd" data-readall="${ur.map(i=>i.cid).join(',')}" title="Mark all ${g.length} issues on this screenshot read"><i></i></button>`:'')}
function grpActs(g){const ur=g.filter(unread),f=g[0],n=threads('card:'+f.cid).length,rf=g.find(i=>i.prev);return `<span class="acts">${FLOW?'':`<button class="a hv fx" data-fix="${g.map(i=>i.cid).join(',')}" title="Mark all ${g.length} fixed">${ic('cfix')}</button>`}${rf?`<button class="a hv cmp" data-cmp="${rf.cid}" title="${rf.prev.ref?'Show the design reference (Alt)':'Compare with the previous screenshot (Alt)'}${rf.prev.label?' ('+esc(rf.prev.label)+')':''}">${ic(rf.prev.ref?'gaph':'history')}</button>`:''}<button class="a hv" data-menu="${f.cid}" title="More (issue ${num(f)})">${ic('more')}</button><button class="a hv del" data-deltop="1" title="Delete the top issue">${ic('trash')}</button><button class="a cmi ${n?'has':'hv'}" data-open="card:${f.cid}" title="Comments on issue ${num(f)}">${ic('ai')}${n?`<em>${n}</em>`:''}</button></span>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-readall]');if(!b)return;e.stopPropagation();const ids=b.dataset.readall.split(','),its=ids.map(c=>S.items.find(i=>i.cid===c)).filter(Boolean);its.forEach(i=>setRead(i,true));render();toast(`Marked ${its.length} read`,()=>{its.forEach(i=>setRead(i,false));render()})},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-delall-shot]');if(!b)return;e.stopPropagation();const ids=b.dataset.delallShot.split(',');
  confirmBox(`Delete all ${ids.length} issues on this screenshot? They move to Deleted, where you can restore them.`,'Delete all',()=>ids.forEach(c=>{document.getElementById('menu').dataset.for=c;menuAct('del')}))},true);
function cardGroup(g){return keep(g[0].cid,cardGroup0(g))}
function cardGroup0(g){const f=g[0];return `<div class="card grp ${g.some(i=>S.sel===i.cid)?'sel':''}" data-cid="${f.cid}">${shotBox(f,grpActs(g),0,grpRead(g))}
  <div class="gitems">${(k=>k>0?[...g.slice(k),...g.slice(0,k)]:g)(S.rotSel&&S.rotSel===S.sel?g.findIndex(i=>i.cid===S.sel):-1).map(i=>`<div class="gi ${S.sel===i.cid?'sel':''}" id="c-${i.cid}" data-cid="${i.cid}">${issueRow(i)}${hoverActs(i,'racts')}</div>`).join('')}</div>${addRow(g[0])}</div>`}
function units(items){const m=new Map(),out=[];items.forEach(i=>{const k=i.screen;if(k){if(!m.has(k)){m.set(k,[]);out.push(m.get(k))}m.get(k).push(i)}else out.push([i])});
  const chunks=[];out.forEach(u=>{for(let k=0;k<u.length;k+=MAXG)chunks.push(u.slice(k,k+MAXG))});return chunks.map(u=>u.length>1?cardGroup(u):card(u[0])).join('')}
function card(i){const w=shotW(i),h=card0(i);return keep(i.cid,w?h.replace('<div class="card ',`<div style="width:${w+12}px" class="card `):h)/* +12: the card's 6px padding each side */}
function card0(i){return `<div class="card ${S.sel===i.cid?'sel':''}" id="c-${i.cid}" data-cid="${i.cid}">${shotBox(i,hoverActs(i,'acts'),1)}<div class="cap gi1">${issueRow(i)}${FLOW?'':hoverActs(i,'racts')}${addRow(i)}</div></div>`}
function openPop(t,anchor){S.popAnchor=anchor;
  const P=document.getElementById('pop'),it=S.items.find(i=>'card:'+i.cid===t);
  const name=t==='page'?'General':it?`${num(it)} · ${it.title.replace(/<[^>]+>/g,'')}`:t;
  const th=threads(t),rs=(S.resolved||[]).filter(c=>c.target===t),showR=rs.length&&S.popRes===t;if(!rs.length&&S.popRes===t)S.popRes=null;
  P.innerHTML=`<div class="ph"><b>${esc(name)}</b>${rs.length?`<button class="chip prv ${showR?'on':''}" data-pres-view title="Archived chats on this screen">Archived · ${rs.length}</button>`:''}<button class="ib" data-close>${ic('x')}</button></div><div class="pb">${showR?rs.map(c=>`<div class="th rsv"><div class="thh"><span class="st done">Archived ${c.resolvedAt?new Date(c.resolvedAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}</span></div>${c.thread.map(m=>`<div class="msg ${m.by}"><span class="who">${m.by!=='Claude'?'You':m.by}</span>${esc(m.text).replace(/\n/g,'<br>')}</div>`).join('')}</div>`).join(''):''}${!showR&&th.length?th.map(c=>`<div class="th"><div class="thh"><span class="st ${st(c)}">${{todo:'To do',inprogress:'In progress',done:'Done'}[st(c)]}</span><button class="res ${st(c)==='done'?'on':''}" data-pres="${c.id}" title="Archive chat — you've reviewed it; it moves to Archived">${ic('archive')}Archive chat</button></div>${c.thread.map(m=>`<div class="msg ${m.by}"><span class="who">${m.by!=='Claude'?'You':m.by}</span>${esc(m.text).replace(/\n/g,'<br>')}</div>`).join('')}<div class="compose" style="border-top:1px solid var(--line)"><textarea rows="1" placeholder="Reply — Enter to send" data-reply="${c.id}"></textarea><button class="send" data-rsend title="Send">${ic('send')}</button></div></div>`).join(''):''}</div>
  <div class="compose"><textarea rows="2" placeholder="Comment — a task for Claude · Enter to send" data-newc="${t}"></textarea><button class="send" data-send>${ic('send')}</button></div>`;
  P.classList.add('open');const r=anchor?.getBoundingClientRect();P.style.top=Math.max(12,Math.min((r?.top||80)-10,innerHeight-P.offsetHeight-12))+'px';const pb=P.querySelector('.pb');if(pb)pb.scrollTop=pb.scrollHeight;if(!S.noFocus)requestAnimationFrame(()=>P.querySelector('[data-newc]')?.focus());
}
// events
document.addEventListener('click',e=>{
  if(e.target.closest('[data-copymsg]')){navigator.clipboard?.writeText(`The design-QA canvas server isn't running. Please start it: cd ${location.pathname.replace(/\/[^/]*$/,'')} && node server.mjs ${PORT}`);toast('Copied — paste it to Claude');return}
  const o=e.target.closest('[data-open]');if(o){S.touchedComments=true;srvState();e.stopPropagation();closeMenu();const P=document.getElementById('pop');
    if(P.classList.contains('open')&&S.popT===o.dataset.open){P.classList.remove('open');S.popT=null}else{S.popT=o.dataset.open;openPop(o.dataset.open,o.closest('.row')||o)}return}
  const mb=e.target.closest('[data-menu]');if(mb){e.stopPropagation();const M=document.getElementById('menu');if(!M.hidden&&M.dataset.for===mb.dataset.menu){closeMenu()}else openMenu(mb.dataset.menu,mb);return}
  const tdr=e.target.closest('[data-todoread]');if(tdr){/* Claude's own to-do: marking its screens read clears it, then on to the next one, like Archive */const ids=tdr.dataset.todoread.split(',').filter(c=>S.items.some(i=>i.cid===c&&unread(i))),ti=[...document.querySelectorAll('#list .task')].indexOf(tdr.closest('.task'));
    ids.forEach(c=>{S.readLocal.add(c);post('api/state',{cid:stKey(c),new:false})});render();openNextTask(ti);
    toast(ids.length>1?`Marked ${ids.length} screens read`:'Marked read',()=>{ids.forEach(c=>{S.readLocal.delete(c);S.seen.delete(stKey(c));post('api/state',{cid:stKey(c),new:true})});render()});return}
  const tre=e.target.closest('[data-tres],[data-tdel]');if(tre){const id=tre.dataset.tres||tre.dataset.tdel,k=S.comments.findIndex(c=>c.id===id),ti=[...document.querySelectorAll('#list .task')].indexOf(tre.closest('.task')),[gone]=S.comments.splice(k,1);render();
    markReadT(gone.target);popAfterResolve(gone.target);if(tre.dataset.tres)openNextTask(ti);post(`api/comments/${gone.id}/flags`,{resolved:true});toast('Chat archived',()=>{S.comments.splice(k,0,gone);render();post(`api/comments/${gone.id}/flags`,{resolved:false})});return}
  const ire=e.target.closest('[data-ires]');if(ire){document.getElementById('pop').classList.remove('open');S.popT=null;const k=S.inbox.findIndex(i=>i.id===ire.dataset.ires),[gone]=S.inbox.splice(k,1);const tc=S.comments.filter(c=>c.target==='card:'+gone.id);S.comments=S.comments.filter(c=>c.target!=='card:'+gone.id);render();post('api/inbox/'+gone.id,{resolved:true});tc.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:true}));toast(tc.length>1?`Archived the screenshot and its ${tc.length} threads`:'Resolved',()=>{S.inbox.splice(k,0,gone);S.comments.push(...tc);render();post('api/inbox/'+gone.id,{resolved:false});tc.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:false}))});return}
  const idl=e.target.closest('[data-idel]');if(idl){const k=S.inbox.findIndex(i=>i.id===idl.dataset.idel),[gone]=S.inbox.splice(k,1);render();post('api/inbox/'+gone.id,{deleted:true});const pt=setTimeout(()=>{post('api/removed/purge',{cids:[gone.id]});S.comments=S.comments.filter(c=>c.target!=='card:'+gone.id);render()},10000);
    toast('Screenshot deleted',()=>{clearTimeout(pt);S.inbox.splice(k,0,gone);render();post('api/inbox/'+gone.id,{deleted:false})});return}
  const tk=!e.target.closest('[data-tres],[data-ires],[data-tdel],[data-idel],[data-open],[data-prio]')&&e.target.closest('[data-task]');if(tk){const t=tk.dataset.task,id=t.replace(/^card:/,'');if(t.startsWith('card:')&&document.getElementById('c-'+id)){const again=S.sel===id;select(id);goTo(id,again)/* a second click zooms in, like the side pane */}S.popT=t;S.popRes=tk.classList.contains('rsv')?t:null;/* an archived row opens with its archived chats showing */openPop(t,tk);return}
  const gt=e.target.closest('[data-goto]');if(gt){const id=gt.dataset.goto;if(!document.getElementById('c-'+id)){S.openOnly=false;S.fp.clear();S.fk.clear();S.fh=false;render()}select(id);goTo(id);return}
  if(e.target.closest('[data-delall]')){const g=S.deleted;S.deleted=[];render();let t=setTimeout(()=>post('api/removed/purge',{cids:g.map(i=>i.cid)}),10000);toast(`Deleted ${g.length} for good`,()=>{clearTimeout(t);S.deleted=g;render()});return}
  const rs=e.target.closest('[data-restore]');if(rs){const k=S.deleted.findIndex(i=>i.cid===rs.dataset.restore);S.items.push(...S.deleted.splice(k,1));if(FLOW)flowLayout();render();post('api/removed',{cid:rs.dataset.restore,removed:false});toast('Restored');return}
  const op=e.target.closest('[data-opn]');if(op){const f=[...S.items,...(S.fixedItems||[])].find(i=>i.cid===op.dataset.opn);const t=f&&openTarget(f,!!op.closest('.card.showprev'));if(t)window.open(t.href,'_blank','noopener');return}
  const ex=e.target.closest('[data-exp]');if(ex){const L=document.getElementById('lb');L.querySelector('img').src=ex.dataset.exp;L.classList.add('open');return}
  const pk=e.target.closest('[data-pick]');if(pk){const M=document.getElementById('menu'),ids=(M.dataset.grp||M.dataset.for).split(',');M.dataset.grp='';ids.forEach(cid=>{S.prio[cid]=pk.dataset.pick;post('api/priorities',{cid,level:pk.dataset.pick})});closeMenu();render();return}
  const cm=e.target.closest('[data-cmp]');if(cm){const it=S.items.find(i=>i.cid===cm.dataset.cmp);if(!it)return;S.prevOn=S.prevOn||new Set();S.prevOn.has(it.cid)?S.prevOn.delete(it.cid):S.prevOn.add(it.cid);showPrev(it,S.prevOn.has(it.cid));return}
  const dl=e.target.closest('[data-del]');if(dl){document.getElementById('menu').dataset.for=dl.dataset.del;menuAct('del');return}
  const cb=e.target.closest('[data-comb]');if(cb){const cid=document.getElementById('menu').dataset.for,it=S.items.find(i=>i.cid===cid),t=S.items.find(i=>i.cid===cb.dataset.comb),was=it.screen;closeMenu();
    const key=t.screen||('scr-'+t.cid);if(!t.screen){t.screen=key;post('api/edit',{cid:t.cid,screen:key})}it.screen=key;render();post('api/edit',{cid,screen:key});toast('Combined on one card',()=>{it.screen=was;render();post('api/edit',{cid,screen:was})});return}
  const mi=e.target.closest('[data-mi]');if(mi){menuAct(mi.dataset.mi,mi.dataset.v);return}
  closeMenu();
  if(e.target.closest('[data-close]')){document.getElementById('pop').classList.remove('open');S.popT=null;return}
  if(e.target.closest('#pop'))return;
  const tab=e.target.closest('[data-tab]');if(tab){S.tab=tab.dataset.tab==='issues'&&S.unreadOnly?'new':tab.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===tab));render();requestAnimationFrame(markStuck);return}
  if(e.target.closest('#sortbtn')){sortByPriority();return}
  if(e.target.closest('#fbtn')){document.getElementById('filters').classList.toggle('open');document.getElementById('fbtn').classList.toggle('on');return}
  const sec=e.target.closest('[data-sec]');if(e.target.closest('#todoJump')){const L=document.getElementById('list'),h=document.querySelector('[data-secw="ib:todo"]');L.scrollTo({top:h.offsetTop-L.offsetTop,behavior:'smooth'});if(!S.openSecs.has('ib:todo')){S.openSecs.add('ib:todo');syncSecs()}return}
  if(sec&&!e.target.closest('[contenteditable=true]')){if(e.detail>1&&e.target.closest('.stt'))return;const n=sec.dataset.sec,O=S.openSecs,meta=e.metaKey||e.ctrlKey;
    S.secUndo=new Set(O);if(meta){const only=O.size===1&&O.has(n);O.clear();if(!only)O.add(n)}else O.has(n)?O.delete(n):O.add(n);syncSecs();return}
  const f=e.target.closest('.chip');if(f){
    if(f.hasAttribute('data-open-only')){S.openOnly=true}else if(f.hasAttribute('data-all')){S.openOnly=false}
    else if(f.dataset.fp){S.fp.has(f.dataset.fp)?S.fp.delete(f.dataset.fp):S.fp.add(f.dataset.fp)}
    else if(f.dataset.fk){S.fk.has(f.dataset.fk)?S.fk.delete(f.dataset.fk):S.fk.add(f.dataset.fk)}
    else if(f.hasAttribute('data-fh'))S.fh=!S.fh;
    
    document.querySelectorAll('[data-fp]').forEach(c=>c.classList.toggle('on',S.fp.has(c.dataset.fp)));
    document.querySelectorAll('[data-fk]').forEach(c=>c.classList.toggle('on',S.fk.has(c.dataset.fk)));
    render();return}
  const mo=e.target.closest('[data-more]');if(mo){const it=S.items.find(i=>i.cid===mo.dataset.more);if(!it)return;it.expanded=!it.expanded;fitAll();return}
  const sgc=e.target.closest('[data-sg]');if(sgc){sgBar(sgc.dataset.sg.split(':')[0]);return}
  const ska=e.target.closest('[data-sgask]');if(ska){sgBar(ska.closest('[data-sgbar]').dataset.sgbar,ska.dataset.sgask);return}
  const sgt=e.target.closest('[data-sgtop]');if(sgt){sgApply(sgt.dataset.sgtop,'rejall');return}
  const sko=e.target.closest('[data-sgok]');if(sko){sgApply(sko.closest('[data-sgbar]').dataset.sgbar,sko.dataset.sgok);return}
  if(e.target.closest('[data-sgcancel]')){sgBar(e.target.closest('[data-sgbar]').dataset.sgbar);return}
  const ac=e.target.closest('[data-acc]');if(ac){const [c,k]=ac.dataset.acc.split(':'),it=S.items.find(i=>i.cid===c);const [t]=it.sugg.splice(+k,1);
    it.what=(it.what?it.what+'<br>':'')+'• '+t.replace(/^<b>[^<]*<\/b>\s*/,'');it.expanded=true;render();toast('Accepted — moved into the details');return}
  const mvg=e.target.closest('[data-goto]');if(mvg){select(mvg.dataset.goto);goTo(mvg.dataset.goto,true);return}const rd=e.target.closest('[data-read]');if(rd){const ri=S.tab==='new'&&rd.closest('#list')?[...document.querySelectorAll('#list .row[data-cid]')].indexOf(rd.closest('.row')):-1;S.readLocal.add(rd.dataset.read);quickRead(rd.dataset.read,ri>=0?rd.closest('.row'):null);post('api/state',{cid:stKey(rd.dataset.read),new:false});
    /* New tab: go straight to the next new item */if(ri>=0){const R=[...document.querySelectorAll('#list .row[data-cid]')],nx=(R[ri]||R[ri-1])?.dataset.cid;if(nx){select(nx);goTo(nx,true);requestAnimationFrame(()=>document.querySelector(`#list .row[data-cid="${nx}"]`)?.scrollIntoView({block:'nearest'}))}}return}
  const pp=e.target.closest('[data-prio]');if(pp){e.stopPropagation();openPicker(pp.dataset.prio,pp);document.getElementById('menu').dataset.grp=pp.dataset.prioGrp||'';return;toast('Priority changed');return}
  const row=e.target.closest('.row[data-cid]');if(row){if(e.detail>1)return;const id=row.dataset.cid,again=S.sel===id;clearTimeout(S.zt);S.zt=setTimeout(()=>{select(id);goTo(id,again)},again?260:0);return}
  const z=e.target.closest('[data-z]');if(z){z.dataset.z==='fit'?fit():zoom(z.dataset.z==='in'?1.2:1/1.2);return}
  document.getElementById('pop').classList.remove('open');
});

const W=()=>document.getElementById('world'),VP=document.getElementById('vp');
let raf=0;function apply(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint()})}
// keep content on screen: min zoom = everything fits; never pan past the content edges
function size(){const w=W(),r=w.getBoundingClientRect(),k=S.cz||1;return {w:r.width/k,h:r.height/k}}
function minZ(){const z=size();return Math.min(1,VP.clientWidth/z.w,VP.clientHeight/z.h)}
function clampView(){S.z=Math.max(minZ(),Math.min(8,S.z))}  // pan is free; only zoom is bounded
// zooming changes heading size -> reflow; keep the item that was under the cursor exactly where it was
function reanchor(){const a=S.anchor;if(!a||!a.el.isConnected)return;const d=a.el.offsetTop-a.top;if(d){S.y-=d*S.z;a.top=a.el.offsetTop;W().style.transform=`translate(${S.x}px,${S.y}px) scale(${S.z})`}}
function paint(){clampView();{const w=W();w.classList.add('moving');clearTimeout(S.mt);S.mt=setTimeout(()=>w.classList.remove('moving'),180)}if(S.menuAnchor&&!document.getElementById('menu').hidden){const M=document.getElementById('menu'),r=S.menuAnchor.getBoundingClientRect();requestAnimationFrame(()=>{M.style.left=Math.min(r.left,innerWidth-200)+'px';M.style.top=(r.bottom+4)+'px'})}W().style.transform=`translate(${Math.round(S.x)}px,${Math.round(S.y)}px) scale(${S.z})`;/* whole-pixel offset keeps text and shadows crisp */S.cz=S.z;const hp=17;/* fixed heading size in canvas units: it scales with zoom like the screenshot, so lines never re-wrap */W().style.setProperty('--inv',1/S.z);W().style.setProperty('--rad',Math.max(8,8/S.z)+'px');W().style.setProperty('--acs',Math.min(1,40/(22*S.z)));setZW();if(hp!==S.hp){S.hp=hp;W().style.setProperty('--hfs',hp+'px');reanchor();clearTimeout(S.ft);S.ft=setTimeout(fitAll,160)}document.getElementById('zl').textContent=Math.round(S.z*100)+'%';S.ripF?.()}
function zoom(k,cx=VP.clientWidth/2,cy=VP.clientHeight/2){{const r=VP.getBoundingClientRect(),hit=document.elementFromPoint(cx+r.left,cy+r.top)?.closest('.card,.lane');S.anchor=hit?{el:hit,top:hit.offsetTop}:null}const z=Math.min(8,Math.max(minZ(),S.z*k));S.x=cx-(cx-S.x)*z/S.z;S.y=cy-(cy-S.y)*z/S.z;S.z=z;apply()}
function fit(){/* the whole canvas, every flow, width and height */S.z=minZ();S.x=Math.max(0,(VP.clientWidth-size().w*S.z)/2);S.y=0;apply()}
function fitAllView(){S.z=minZ();apply()}
const wpos=el=>{const r=el.getBoundingClientRect(),w=W().getBoundingClientRect();return {x:(r.left-w.left)/S.z,y:(r.top-w.top)/S.z,w:r.width/S.z,h:r.height/S.z}};
/* measure after this frame's fitAll() has resized cards, or the view lands off the screenshot */
function goTo(cid,zoomIn){const ins=S.instant;requestAnimationFrame(()=>{const o=S.instant;S.instant=ins;goTo0(cid,zoomIn);S.instant=o})}
function goTo0(cid,zoomIn){const el=document.getElementById('c-'+cid);if(!el)return;const ep=wpos(el);
  if(zoomIn==='card'){const cd=el.closest('.card')||el,cp=wpos(cd),z=Math.min(4,(VP.clientWidth-64)/cp.w,(VP.clientHeight-48)/cp.h);return animTo(VP.clientWidth/2-(cp.x+cp.w/2)*z,24-cp.y*z,z)}
  if(zoomIn){const sh=el.querySelector('.shot,.noshot')||el.closest('.grp')?.querySelector('.shot,.noshot'),sp=wpos(sh),sx=sp.x,sy=sp.y;
    const z=Math.min(4,(VP.clientWidth-64)/sp.w,(VP.clientHeight-140)/sp.h); // image fills the view, title peeks below
    return animTo(VP.clientWidth/2-(sx+sp.w/2)*z,32-sy*z,z)}
  animTo(VP.clientWidth/2-(ep.x+ep.w/2)*S.z,24-ep.y*S.z,S.z)}
let anim=0;function animTo(x,y,z){cancelAnimationFrame(anim);if(S.anim==='instant'||(S.anim!=='pan'&&S.instant)){S.x=x;S.y=y;S.z=z;paint();return}/* rapid arrow presses: switch instantly so the change between screens is visible */const a={x:S.x,y:S.y,z:S.z},t0=performance.now(),D=320;
  const step=t=>{const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,3);S.x=a.x+(x-a.x)*e;S.y=a.y+(y-a.y)*e;S.z=a.z+(z-a.z)*e;paint();if(k<1)anim=requestAnimationFrame(step)};anim=requestAnimationFrame(step)}
VP.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey){const r=VP.getBoundingClientRect();const d=Math.max(-40,Math.min(40,e.deltaMode?e.deltaY*16:e.deltaY));zoom(Math.exp(-d*0.012),e.clientX-r.left,e.clientY-r.top)}else{S.anchor=null;const g=axisFor(e.deltaX,e.deltaY);if(g!=='y')S.x-=e.deltaX;S.y-=e.deltaY;apply()}},{passive:false});
let dr=null;VP.addEventListener('pointerdown',e=>{if(document.querySelector('[contenteditable=true]'))return;S.anchor=null;const eh=e.target.closest('.ct h3');if(eh){const ce=eh.querySelector('[contenteditable=true]');if(ce&&!e.target.closest('[contenteditable=true]')){e.preventDefault();ce.focus();const r=document.createRange();r.selectNodeContents(ce);r.collapse(false);const sl=getSelection();sl.removeAllRanges();sl.addRange(r);return}}if(e.target.closest('button,input,summary,a,[contenteditable=true]'))return;dr={x:e.clientX,y:e.clientY,ox:S.x,oy:S.y,m:0};VP.classList.add('drag')});
addEventListener('pointermove',e=>{if(!dr)return;if(e.buttons===0||document.querySelector('[contenteditable=true]')){dr=null;VP.classList.remove('drag');return}const dx=e.clientX-dr.x,dy=e.clientY-dr.y;
  if(!dr.ax&&Math.hypot(dx,dy)>6)dr.ax=Math.abs(dx)>Math.abs(dy)*0.9?'xy':'y';if(dr.ax==='y'&&Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx)>24)dr.ax='xy';
  if(dr.ax==='xy')S.x=dr.ox+dx;S.y=dr.oy+dy;dr.m=1;apply()});
// wheel/trackpad gesture: lock to vertical unless the first ~80ms are clearly sideways; 160ms idle ends the gesture
let G={ax:null,sx:0,sy:0,t:0,free:0};function axisFor(dx,dy){const now=performance.now();if(now-G.t>160)G={ax:null,sx:0,sy:0,free:0};G.t=now;G.sx+=Math.abs(dx);G.sy+=Math.abs(dy);
  if(!G.ax&&G.sx+G.sy>6)G.ax=G.sx>G.sy*0.9?'xy':'y';if(G.ax==='y'&&G.sx>G.sy*1.2&&G.sx>16)G.ax='xy';return G.ax||'y'}
addEventListener('pointercancel',()=>{dr=null;VP.classList.remove('drag')});
addEventListener('blur',()=>{dr=null;VP.classList.remove('drag')});
addEventListener('pointerup',e=>{if(dr&&!dr.m){const sh=e.target.closest('.shot');if(sh){const c=sh.closest('.card');select(c.dataset.cid);goTo(c.dataset.cid,true)}else{const c=e.target.closest('.gi')||e.target.closest('.card');if(c){const id=c.dataset.cid;if(e.detail>1)return;if(S.sel===id){clearTimeout(S.zt);S.zt=setTimeout(()=>{select(id);goTo(id,true)},260)}else select(id,false)}}}dr=null;VP.classList.remove('drag')});
document.getElementById('lb').onclick=e=>e.currentTarget.classList.remove('open');
addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('lb').classList.remove('open');closeMenu();document.getElementById('pop').classList.remove('open');S.popT=null}
  if(e.code==='Space'&&!e.repeat&&!e.target.closest('input,textarea,[contenteditable=true]')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();spaceKey();return}
  if(!e.target.closest('input,textarea,[contenteditable=true]')&&!e.metaKey&&!e.ctrlKey){if(e.key==='='||e.key==='+')zoom(1.25);if(e.key==='-')zoom(1/1.25);if(e.key==='0')zeroKey()}
  if(FLOW&&/^Arrow(Right|Left|Up|Down)$/.test(e.key)&&!busyField(e)){e.preventDefault();flowKey(e.key);return}
  if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&!busyField(e)){e.preventDefault();
    const ids=ordered().flatMap(g=>g.items.map(i=>i.cid)),k0=ids.indexOf(S.sel),k=k0<0?Math.min(S.lastK??-1,ids.length):k0,n=Math.min(ids.length-1,Math.max(0,k0<0&&e.key==='ArrowRight'?k:k+(e.key==='ArrowRight'?1:-1)));
    if(k0>=0&&n===k0){endRipple(S.sel);return}/* first or last issue: nothing further, show the end */
    rapidKey();stepTo(S.sel,ids[n])}});
function select(cid,expand=true){/* moving to another screen turns its Before / Design view off */document.querySelectorAll('.card.showprev').forEach(c=>{if(c.contains(document.getElementById('c-'+cid)))return;c.classList.remove('showprev');const id=(c.querySelector('[data-cmp]')||{}).dataset?.cmp;S.prevOn?.delete(id);const id2=id,it=id&&S.items.find(i=>i.cid===id),im=c.querySelector('.shot');if(it&&im)im.src=it.img});S.sel=cid;document.querySelectorAll('.grp.sel').forEach(x=>x.classList.remove('sel'));setTimeout(()=>document.getElementById('c-'+cid)?.closest('.grp')?.classList.add('sel'));const si=S.items.find(i=>i.cid===cid);if(si&&!S.openSecs.has(si.section)){S.openSecs.add(si.section);syncSecs(cid)}if(expand){let ch=false;S.items.forEach(i=>{const v=i.cid===cid;if(!!i.expanded!==v){i.expanded=v;ch=true}});if(ch)fitAll()}document.querySelectorAll('.row.sel,.card.sel,.gi.sel').forEach(x=>x.classList.remove('sel'));document.querySelector(`.row[data-cid="${cid}"]`)?.classList.add('sel');document.getElementById('c-'+cid)?.classList.add('sel')}
function toast(t,undo,kind){const T=document.getElementById('toast');T.innerHTML=esc(t)+(undo?' <button class="undo">Undo</button>':'');T.classList.toggle('err',kind==='err');T.style.display='block';
  if(undo)T.querySelector('.undo').onclick=()=>{T.style.display='none';undo()};clearTimeout(T._t);T._t=setTimeout(()=>T.style.display='none',undo?10000:kind==='err'?6000:2200)}
// double-click any text to edit in place; Enter (or click away) saves, Esc cancels
document.addEventListener('dblclick',e=>{clearTimeout(S.zt);const sn=e.target.closest('[data-secname]');if(sn&&!sn.isContentEditable){if(S.secUndo&&sn.closest('.sec')){S.openSecs=S.secUndo;syncSecs()}{const k0=sn;setTimeout(()=>{const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);if(r&&k0.contains(r.startContainer)){const sl=getSelection();sl.removeAllRanges();r.collapse(true);sl.addRange(r)}},0)}e.preventDefault();e.stopPropagation();const old=sn.dataset.secname,before=sn.innerHTML;sn.contentEditable='true';sn.focus();
    const end=save=>{sn.contentEditable='false';sn.removeEventListener('keydown',k);sn.removeEventListener('blur',b);const nv=sn.innerHTML.trim();
      if(!save||!nv){sn.innerHTML=before;return}if(nv!==before){S.sections=S.sections.map(x=>x===old?nv:x);S.items.forEach(i=>{if(i.section===old)i.section=nv});if(S.openSecs.delete(old))S.openSecs.add(nv);render();post('api/edit',{section:{from:old,to:nv}});toast('Section renamed')}};
    const k=ev=>{if(ev.key==='Enter'){ev.preventDefault();end(true)}else if(ev.key==='Escape')end(true)/* Esc saves too; undo with Cmd/Ctrl+Z while editing */},b=()=>end(true);sn.addEventListener('keydown',k);sn.addEventListener('blur',b);return}
  clearTimeout(S.ct);if(e.target.closest('#world [data-ed]')&&!e.target.isContentEditable){e.preventDefault();editCard(e);return}const el=e.target.closest('[data-ed]')||e.target.closest('.ct h3')?.querySelector('.ttl');if(!el||el.isContentEditable)return;e.preventDefault();
  const before=el.innerHTML;el.contentEditable='true';el.focus();{const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);const sl=getSelection();sl.removeAllRanges();if(r&&el.contains(r.startContainer)){r.collapse(true);sl.addRange(r)}else{const q=document.createRange();q.selectNodeContents(el);q.collapse(false);sl.addRange(q)}}
  const end=save=>{el.contentEditable='false';el.removeEventListener('keydown',k);el.removeEventListener('blur',b);
    if(!save)el.innerHTML=before;else if(el.innerHTML!==before){const it=S.items.find(i=>i.cid===(el.closest('.gi')||el.closest('.card')).dataset.cid);const f=el.dataset.ed,v=el.innerHTML.replace(/^(<br>|\s|&nbsp;)+|(<br>|\s|&nbsp;)+$/g,'');it[f]=v;if(f==='out')it.what='';(unread(it)&&(S.readLocal.add(it.cid),post('api/state',{cid:stKey(it.cid),new:false}),render()),post('api/edit',f==='out'?{cid:it.cid,out:v,what:''}:{cid:it.cid,[f]:v})).then(r=>r&&toast('Saved'))}};
  const k=ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();end(true);fitAll()}else if(ev.key==='Escape'){end(true);fitAll()}},b=()=>{end(true);fitAll()};
  el.addEventListener('keydown',k);el.addEventListener('blur',b)});
VP.addEventListener('pointerover',e=>{const c=e.target.closest('.gi')||e.target.closest('.card');document.querySelectorAll('.row.hov').forEach(r=>r.classList.remove('hov'));if(c)document.querySelector(`.row[data-cid="${c.dataset.cid}"]`)?.classList.add('hov')});
VP.addEventListener('pointerleave',()=>document.querySelectorAll('.row.hov').forEach(r=>r.classList.remove('hov')));
document.getElementById('list').addEventListener('pointerover',e=>{const r=e.target.closest('.row[data-cid]');document.querySelectorAll('.card.hov').forEach(c=>c.classList.remove('hov'));if(r)document.getElementById('c-'+r.dataset.cid)?.classList.add('hov')});
document.getElementById('list').addEventListener('pointerleave',()=>document.querySelectorAll('.card.hov').forEach(c=>c.classList.remove('hov')));
// live reload: when this file changes on disk, reload and land on the same view
let ver=null;setInterval(async()=>{try{const h=(await (await fetch(API+'api/version',{cache:'no-store'})).json()).page;
  if(ver&&h!==ver){if(busy()){if(!S.updWait){S.updWait=1;toast('Canvas updated — it will show when you finish typing')}return}
    S.updWait=0;if(await hotUpdate())ver=h;else{saveView();location.reload()}return}ver=h}catch{}},1500);
function busy(){return !!(S.inflight>0||document.querySelector('[contenteditable=true]')||document.activeElement?.matches?.('textarea,input[type=text]')||[...document.querySelectorAll('#pop textarea')].some(t=>t.value.trim()))}
{const R=document.getElementById('sbrz');let d=null;const set=w=>{w=Math.max(240,Math.min(560,w));document.documentElement.style.setProperty('--sbw',w+'px');localStorage.mockSbw=w};
  if(localStorage.mockSbw)set(+localStorage.mockSbw);
  R.addEventListener('pointerdown',e=>{d=e.clientX;R.classList.add('on');R.setPointerCapture(e.pointerId)});R.addEventListener('pointermove',e=>{if(d!==null){set(e.clientX);apply()}});
  R.addEventListener('pointerup',()=>{d=null;R.classList.remove('on')})}
document.addEventListener('pointerdown',e=>{const M=document.getElementById('menu');if(!M.hidden&&!e.target.closest('#menu,[data-menu],[data-prio],#setbtn'))closeMenu();
  const P=document.getElementById('pop');if(P.classList.contains('open')&&!e.target.closest('#pop,[data-open],[data-task]')){P.classList.remove('open');S.popT=null}},true);
{const f0=fitAll;fitAll=function(){f0();reanchor();requestAnimationFrame(drawArrows)}}
setInterval(async()=>{try{await fetch(API+'api/comments',{cache:'no-store'});if(S.offline&&!Q.has('offline')){S.offline=false;srvState();flushOutbox()}}catch{if(!S.offline){S.offline=true;srvState()}}},5000);
// tab labels replace icons whenever they fit
function fitTabs(){const t=document.querySelector('.tabs');if(!S.tabNeed){const d=document.querySelector('[data-tab="deleted"]'),h=d.hidden;d.hidden=false;t.classList.add('lbl');S.tabNeed=t.scrollWidth;d.hidden=h}
  t.classList.toggle('lbl',t.clientWidth>=S.tabNeed)}
addEventListener('resize',fitTabs);new ResizeObserver(fitTabs).observe(document.getElementById('sb'));
document.getElementById('list').addEventListener('scroll',markStuck);
function markStuck(){const j=document.getElementById('todoJump'),h=S.tab==='inbox'&&document.querySelector('[data-sec="ib:todo"]');if(!h){j.hidden=true;return}
  const L=document.getElementById('list').getBoundingClientRect(),r=h.getBoundingClientRect();j.hidden=r.top<L.bottom-8;j.querySelector('b').textContent=h.querySelector('.n').textContent}
const CMAX=6000;/* the watcher tells Claude the first CMAX characters of a comment (watch-comments.py); the rest is read from the thread. The note shows only when a comment goes past it */
document.addEventListener('input',e=>{const ta=e.target.closest&&e.target.closest('textarea[data-newc],textarea[data-reply]');if(!ta)return;const host=ta.closest('.compose')||ta.parentElement;let h=host.nextElementSibling;if(h&&!h.classList.contains('cmax'))h=null;
  if(ta.value.length>CMAX){if(!h){h=document.createElement('div');h.className='cmax';host.insertAdjacentElement('afterend',h)}h.textContent=`Over ${CMAX.toLocaleString()} characters: Claude is told the first ${CMAX.toLocaleString()} and reads the rest from the thread.`}else if(h)h.remove()});
load().then(()=>{probeLocal();const q=new URLSearchParams(location.search);const v=readView();
  if(v)applyView(v,true);if(q.get('z')){S.z=+q.get('z');paint()}if(q.get('sugg')){const it=ordered().flatMap(g=>g.items).find(i=>i.sugg.length);select(it.cid);goTo(it.cid);paint()}if(q.get('sel')){const id=ordered().flatMap(g=>g.items)[+q.get('sel')-1]?.cid;select(id);goTo(id);paint()}});

// ---- comments: Enter sends (Shift+Enter = new line); a reply re-opens the task for Claude
async function sendFrom(ta){const v=ta.value.trim();if(!v)return;const t=S.popT;delete localStorage[DKEY(ta)];ta.value='';
  if(ta.dataset.reply){const c=S.comments.find(x=>x.id===ta.dataset.reply);c.thread.push({by:'User',text:v,at:new Date().toISOString()});markReadT(c.target);c.status='todo';c.claudeDone=false;document.getElementById('pop').classList.remove('open');S.popT=null;render();toast('Reply sent');post(`api/comments/${c.id}/reply`,{by:'User',text:v},{asUser:false})}
  else{const it=S.items.find(i=>'card:'+i.cid===t),tmp={id:'tmp'+Date.now(),target:t,title:it?it.title.replace(/<[^>]+>/g,''):t,createdAt:new Date().toISOString(),status:'todo',thread:[{by:'User',text:v,at:new Date().toISOString()}]};
    S.comments.push(tmp);markReadT(t);openPop(t,S.popAnchor);render();const r=await post('api/comments',{target:t,title:tmp.title,text:v,by:'User'},{asUser:false});if(r)Object.assign(tmp,r)}}
document.addEventListener('keydown',e=>{const ta=e.target.closest?.('#pop textarea');if(ta&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendFrom(ta)}});
document.addEventListener('click',e=>{const sb=e.target.closest('#pop [data-send],#pop [data-rsend]');if(sb){sendFrom(sb.previousElementSibling);return}
  const pr=e.target.closest('#pop [data-pres]');if(pr&&!pr.disabled){const k=S.comments.findIndex(c=>c.id===pr.dataset.pres),[gone]=S.comments.splice(k,1);render();markReadT(gone.target);popAfterResolve(gone.target);post(`api/comments/${gone.id}/flags`,{resolved:true});
    toast('Chat archived',()=>{S.comments.splice(k,0,gone);render();post(`api/comments/${gone.id}/flags`,{resolved:false})})}});

const DKEY=ta=>'qa-draft:'+location.pathname+':'+(ta.dataset.reply?'r:'+ta.dataset.reply:'n:'+ta.dataset.newc);
document.addEventListener('input',e=>{const ta=e.target.closest?.('#pop textarea');if(ta){const k=DKEY(ta);if(ta.value)localStorage[k]=ta.value;else delete localStorage[k]}});
new MutationObserver(()=>document.querySelectorAll('#pop textarea').forEach(ta=>{const d=localStorage[DKEY(ta)];if(d&&!ta.value)ta.value=d})).observe(document.getElementById('pop'),{childList:true});

// ---- is Claude watching? (watch-comments.py / watch-inbox.py report in; silent for 30 s = off)
async function watchState(){const el=document.getElementById('wst');if(S.offline){el.hidden=true;return}
  let w;try{w=await (await fetch(API+'api/watchers',{cache:'no-store'})).json()}catch{return}
  const off=['comments','screenshots'].filter(n=>w[n]?.state!=='on'),label={comments:'your comments',screenshots:'new screenshots'};
  el.hidden=!off.length;/* only shown when a watcher is off */el.className=off.length?'wst off':'wst on';
  el.innerHTML=off.length?`<span class="dot"></span><span class="t"><b>Claude isn’t watching ${off.map(n=>label[n]).join(' or ')}</b>${off.length<2?' · watching '+label[['comments','screenshots'].find(n=>!off.includes(n))]:''}<small>They’ll wait here until it’s back.</small></span><span class="wbtns"><button data-copywatch="${off.join(',')}">Copy message for Claude</button><button data-copywatch="${off.join(',')}" data-withskill title="Also tells Claude where to get the skills, for someone who doesn't have them yet">Copy with skill setup</button></span>`
   :`<span class="dot"></span><span class="t">Claude is watching your comments and screenshots</span>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-copywatch]');if(!b)return;const n=b.dataset.copywatch.split(',');
  const sk=FLOW?'design-wf-canvas':'design-qa-canvas',ws=b.hasAttribute('data-withskill')?`\n\nIf you don't have the ${sk} skill yet, install it first, then follow its agent-references/${n.map(x=>x==='comments'?'comment-watcher.md':'screenshot-watcher.md').join(' and ')}.`:'';navigator.clipboard?.writeText(`Please restart the design-QA ${n.map(x=>x==='comments'?'comment watcher':'screenshot watcher').join(' and ')} (${FLOW?'design-wf-canvas':'design-qa-canvas'} skill) for the canvas on localhost:${PORT} (${decodeURIComponent(location.pathname.replace(/\/[^/]*$/,''))||'/'}).`+ws);toast('Copied — paste it to Claude')});
setInterval(watchState,5000);setTimeout(watchState,800);

// ---- side pane: double-click a title to edit it (Enter saves, Esc cancels); caret lands where you clicked
document.addEventListener('dblclick',e=>{const t=e.target.closest('#list .rt[data-rted]');if(!t||t.isContentEditable)return;e.preventDefault();e.stopPropagation();clearTimeout(S.zt);
  const it=S.items.find(i=>i.cid===t.dataset.rted);if(!it)return;const before=t.textContent;t.contentEditable='true';t.classList.add('editing');t.focus();
  const r=document.caretRangeFromPoint?.(e.clientX,e.clientY),sl=getSelection();sl.removeAllRanges();if(r&&t.contains(r.startContainer)){r.collapse(true);sl.addRange(r)}
  const end=save=>{t.contentEditable='false';t.classList.remove('editing');t.removeEventListener('keydown',k);t.removeEventListener('blur',b);const v=t.textContent.trim();
    if(!save||!v||v===before){t.textContent=before;return}it.title=esc(v);if(unread(it)){S.readLocal.add(it.cid);post('api/state',{cid:stKey(it.cid),new:false})}render();post('api/edit',{cid:it.cid,title:esc(v)}).then(x=>x&&toast('Saved'))};
  const k=ev=>{if(ev.key==='Enter'){ev.preventDefault();end(true)}else if(ev.key==='Escape')end(true)/* Esc saves too; undo with Cmd/Ctrl+Z while editing */},b=()=>end(true);t.addEventListener('keydown',k);t.addEventListener('blur',b)},true);
// ---- settings panel (inline, like Filters)
function setsPanel(){const P=document.getElementById('settings');P.innerHTML=`
    <div class="frow"><span class="l">Canvas</span><span class="bgs">${BGS.map(([v,n])=>`<button data-bg="${v}" class="${S.bg===v?'on':''}" style="background:${v}" title="${n}"></button>`).join('')}<span class="hexw">#<input class="hex" data-hex value="${S.bg.replace('#','').toUpperCase()}" maxlength="7" spellcheck="false" aria-label="Canvas colour (hex)"></span></span></div>
  <div class="frow"><span class="l">Screen switch</span><span class="seg">${[['auto','Auto','Slides; quick repeat presses switch instantly'],['pan','Pan','Always slides'],['instant','Instant','Always jumps']].map(([v,n,t])=>`<button data-anim="${v}" class="${S.anim===v?'on':''}" title="${t}">${n}</button>`).join('')}</span></div>
  <div class="frow"><span class="l">Priority</span><button class="sw" data-showprio role="switch" aria-checked="${S.showPrio}"><span class="swt"><span>Shown</span><span>Hidden</span></span><small>${S.showPrio?'H / M / L badges everywhere':'Hidden on the canvas and in the side pane'}</small></button></div>
  ${FLOW?'':`<div class="frow"><span class="l">Tags</span><span class="seg">${[['0','Basic'],['1','Colourful']].map(([v,n])=>`<button data-tagclr="${v}" class="${(S.tagClr?'1':'0')===v?'on':''}">${n}</button>`).join('')}</span></div>`}</div>`;
  P.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-checked',b.hasAttribute('data-wrap')?!S.wrap:b.hasAttribute('data-showprio')?S.showPrio:S.showIds));document.getElementById('sb').classList.toggle('wrapt',S.wrap)}
S.wrap=false;   // full titles in the side pane: setting removed
const BGS=[['#F4F4F4','Light grey (default)'],['#FAFAFA','Off-white'],['#FFFFFF','White'],['#ECEEF1','Cool grey'],['#2A2724','Dark']];
S.bg=localStorage.qaBg||'#F4F4F4';const applyBg=()=>{document.documentElement.style.setProperty('--bg',S.bg);document.documentElement.classList.toggle('dark-canvas',S.bg==='#2A2724')};applyBg();
document.addEventListener('click',e=>{if(e.target.closest('#setbtn')){const P=document.getElementById('settings'),o=!P.classList.contains('open');P.classList.toggle('open',o);document.getElementById('setbtn').classList.toggle('on',o);if(o)setsPanel();e.stopImmediatePropagation();return}
  const bgb=e.target.closest('#settings [data-bg]');if(bgb){S.bg=bgb.dataset.bg;localStorage.qaBg=S.bg;applyBg();setsPanel();e.stopImmediatePropagation();return}
  const w=e.target.closest('#settings [data-wrap]');if(w){S.wrap=!S.wrap;localStorage.qaWrap=S.wrap?'1':'0';setsPanel();e.stopImmediatePropagation();return}
  const san=e.target.closest('#settings [data-anim]');if(san){S.anim=san.dataset.anim;localStorage.qaAnim=S.anim;setsPanel();e.stopImmediatePropagation();return}
  const spr=e.target.closest('#settings [data-showprio]');if(spr){S.showPrio=!S.showPrio;localStorage.qaPrio=S.showPrio?'1':'0';applyPrio();setsPanel();render();e.stopImmediatePropagation();return}
  const sid=e.target.closest('#settings [data-showids]');if(sid){S.showIds=!S.showIds;localStorage.qaShowIds=S.showIds?'1':'0';setsPanel();render();e.stopImmediatePropagation();return}},true);
requestAnimationFrame(()=>document.getElementById('sb').classList.toggle('wrapt',S.wrap));

// flow mode: no Issues tab or Sort (steps follow the flow); arrows redraw when screenshots finish loading
if(FLOW){/* flow mode: the Issues tab becomes a Screens tree; To-dos opens first */const it=document.querySelector('[data-tab="issues"]');it.firstChild.textContent='Screens ';document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab==='inbox'));S.tab='inbox';document.getElementById('sortbtn').hidden=true;document.documentElement.classList.add('flow-mode');
  document.addEventListener('load',e=>{if(e.target.matches?.('img.shot'))requestAnimationFrame(drawArrows)},true)}

// ---- "0" cycles: zoom to the screenshot nearest the cursor (same as clicking it) ↔ the whole-canvas view (Fit)
VP.addEventListener('pointermove',e=>{S.mx=e.clientX;S.my=e.clientY},{passive:true});
/* --zw: on-screen width a card's screenshot gets when 0 zooms to it, so text sized N/--zw of the card shows at N px there */
function setZW(){const k=VP.clientWidth+'x'+VP.clientHeight+':'+document.querySelectorAll('#world .card').length;if(k===S.zwk)return;S.zwk=k;
  document.querySelectorAll('#world .card').forEach(c=>{const im=c.querySelector('.shot,.noshot');if(!im)return;const w=im.offsetWidth,h=im.offsetHeight;if(!w||!h){S.zwk=null;return}
    c.style.setProperty('--zw',Math.min(4*w,VP.clientWidth-64,(VP.clientHeight-140)*w/h))})}
document.addEventListener('load',e=>{if(e.target.classList?.contains('shot')){S.zwk=null;clearTimeout(S.zwt);S.zwt=setTimeout(setZW,50)}},true);addEventListener('resize',()=>{S.zwk=null;setZW()});setInterval(setZW,1500);new MutationObserver(()=>{S.zwk=null;setZW()}).observe(W(),{childList:true,subtree:true});/* redrawn cards get --zw before they paint, so text never jumps */
/* resolving a thread keeps the comments popover open while that target still has unresolved threads */
/* commenting, replying or resolving on a card marks that card read */
function markReadT(t){const cid=(t||'').startsWith('card:')?t.slice(5):null;if(!cid||S.readLocal.has(cid))return;S.readLocal.add(cid);render();post('api/state',{cid:stKey(cid),new:false})}
function popAfterResolve(t){setTimeout(loadResolved,600);const P=document.getElementById('pop');if(P.classList.contains('open')&&S.popT===t&&threads(t).length){S.popAnchor=[...document.querySelectorAll(`[data-open="${t}"]`)].find(x=>x.offsetParent)||S.popAnchor;S.noFocus=1;openPop(S.popT,S.popAnchor);S.noFocus=0;return}P.classList.remove('open');S.popT=null}
/* trackpad pinch (ctrl+wheel) outside the canvas would zoom the whole page and hide the panels; block it. Cmd +/- browser zoom still works */
document.addEventListener('wheel',e=>{if(e.ctrlKey&&!e.target.closest('#vp'))e.preventDefault()},{passive:false});['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));
/* side-pane bulk actions: New tab = mark all read / unread (with Undo); Inbox = resolve every thread Claude has finished (confirm first, then Undo) */
document.addEventListener('click',e=>{const bk=e.target.closest('[data-bulk]');if(bk){e.stopPropagation();bulk(bk.dataset.bulk)}},true);
function bulkBar(all){S.bulkAll=all;const L=document.getElementById('list');let h='';const nu0=all.filter(unread).length;
  if(S.tab==='issues'||S.tab==='new'){const lb=(set,names,all)=>set.size?[...set].map(k=>names[k]).join(', '):all;
    h=`<button class="chip ${S.unreadOnly?'on':''}" data-funread title="Show only unread">Unread · ${nu0}</button>`+(!FLOW&&S.showPrio?`<button class="chip dd ${S.fp.size?'on':''}" data-fdd="prio">${lb(S.fp,PL,'Priority')} ${ic('chev')}</button>`:'')+(FLOW?'':`<button class="chip dd ${S.ftag?.size?'on':''}" data-fdd="tag">${lb(S.ftag||new Set,{...TAGS,none:'No tag'},'Tag')} ${ic('chev')}</button>`)}/* filters: one row of chips */
  if(S.tab==='new'||(FLOW&&S.tab!=='inbox'&&S.tab!=='deleted'&&S.tab!=='resolved')){const nu=nu0;h+=(nu?`<button class="chip" data-bulk="read">Mark all read</button>`:'')+(all.length>nu?`<button class="chip" data-bulk="unread">Mark all unread</button>`:'')}
  else if(false){const n=S.comments.filter(c=>!c.resolved&&st(c)==='done').length;if(n)h=`<button class="chip" data-bulk="resolve">Archive all · ${n}</button>`}
  if(h){const sbt=L.querySelector('.subtabs'),x=`<div class="bulk">${h}</div>`;sbt?sbt.insertAdjacentHTML('afterend',x):L.insertAdjacentHTML('afterbegin',x)}fitChips()}
/* marking read: drop just that card's dots (and its Unread-list row) instead of redrawing the canvas, so moving on starts at once; a full redraw follows when idle */
function quickRead(cid,row){document.querySelectorAll(`[data-read="${cid}"]`).forEach(d=>d.remove());row?.remove();const n=document.getElementById('cN');if(n)n.textContent=Math.max(0,(+n.textContent||1)-1);clearTimeout(S.qrT);S.qrT=setTimeout(()=>(window.requestIdleCallback||setTimeout)(()=>render()),900)}
function setRead(i,read){const k=stKey(i.cid);if(read)S.readLocal.add(i.cid);else{S.readLocal.delete(i.cid);S.seen.delete(k)}post('api/state',{cid:k,new:!read})}
/* chats in Completed rows: every open thread on that screen is done (a screen still in progress keeps its done threads) */
function doneThreads(){const op=S.comments.filter(c=>!c.resolved);return op.filter(c=>st(c)==='done'&&op.filter(x=>x.target===c.target).every(x=>st(x)==='done')&&!S.inbox.some(i=>'card:'+i.id===c.target&&!i.processed))}
function bulk(a){if(a==='read'||a==='unread'){const read=a==='read',ch=(S.bulkAll||[]).filter(i=>unread(i)===read);ch.forEach(i=>setRead(i,read));render();
    toast(`Marked ${ch.length} ${read?'read':'unread'}`,()=>{ch.forEach(i=>{if(read)setRead(i,false);else{S.seen.add(stKey(i.cid));post('api/state',{cid:stKey(i.cid),new:false})}});render()});return}
  if(a==='resolve'){const g=doneThreads();if(!g.length)return;
    confirmBox(`Archive ${g.length} chat${g.length>1?'s':''} Claude has finished? They move to Archived.`,'Archive all',()=>{g.forEach(c=>markReadT(c.target));S.comments=S.comments.filter(c=>!g.includes(c));render();g.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:true}));
      toast(`Archived ${g.length}`,()=>{S.comments.push(...g);render();g.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:false}))})})}}
function confirmBox(msg,yes,fn){const m=document.createElement('div');m.className='cfm';m.innerHTML=`<div class="cfm-b" role="dialog" aria-modal="true"><p>${esc(msg)}</p><div class="cfm-a"><button class="chip" data-cfno>Cancel</button><button class="chip dark" data-cfyes>${esc(yes)}</button></div></div>`;document.body.append(m);
  const close=()=>{m.remove();removeEventListener('keydown',k,true)},k=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};addEventListener('keydown',k,true);
  m.onclick=e=>{if(e.target.closest('[data-cfyes]')){close();fn()}else if(e.target===m||e.target.closest('[data-cfno]'))close()};m.querySelector('[data-cfyes]').focus()}
/* Space: mark the selected card read, then go to the next one (workflow: same as →; QA: next issue in side-pane order) */
function rapidKey(){const now=performance.now();S.instant=now-(S.lastKey||0)<700;S.lastKey=now;setTimeout(()=>S.instant=false)}
/* QA: stepping to an issue on the same screenshot only moves the highlight, so the screenshot stays in view; another screenshot: fit it */
/* keyboard stepping in a shared card: the current issue sits right under the screenshot, the ones already seen move to the bottom */
function rotGrp(cid){const gi=document.getElementById('c-'+cid);if(!gi||!gi.classList.contains('gi'))return;const box=gi.parentElement;let n=0;while(box.firstElementChild!==gi&&n++<9)box.appendChild(box.firstElementChild)}
function stepTo(from,to){{const k=ordered().flatMap(g=>g.items.map(i=>i.cid)).indexOf(to);if(k>=0)S.lastK=k}const card=c=>document.getElementById('c-'+c)?.closest('.card'),cd=card(to),same=from&&card(from)&&card(from)===cd;
  /* same screenshot already in view: keep the zoom, rotate the issue up under it; otherwise fit the next screenshot */
  const inView=el=>{if(!el)return false;const r=el.getBoundingClientRect(),v=VP.getBoundingClientRect();return r.top>=v.top-2&&r.bottom<=v.bottom+2&&r.left>=v.left-2&&r.right<=v.right+2&&(r.width>=v.width*.6||r.height>=v.height*.6)};/* …and big enough to read */
  S.rotSel=to;select(to);rotGrp(to);if(!(same&&inView(cd?.querySelector('.shot,.noshot'))))goTo(to,true);requestAnimationFrame(()=>document.querySelector(`#list .row[data-cid="${to}"]`)?.scrollIntoView({block:'nearest'}))}
function spaceKey(){const cur=S.sel,it=cur&&S.items.find(i=>i.cid===cur);if(S.tab==='new'){rapidKey();/* on the New tab, Space walks the New list: mark read, go to the next changed screen */const R0=[...document.querySelectorAll('#list .row[data-cid]')].map(r=>r.dataset.cid),ri=R0.indexOf(cur);if(it&&unread(it)){setRead(it,true);render()}const R=[...document.querySelectorAll('#list .row[data-cid]')].map(r=>r.dataset.cid),nx=ri<0?R[0]:(R[ri]===cur?R[ri+1]:R[ri])||R[ri-1];if(nx)stepTo(cur,nx);return}if(it&&unread(it)){setRead(it,true);render()}
  if(typeof flowKey==='function'&&FLOW){flowKey('ArrowRight');return}
  rapidKey();const o=ordered().flatMap(g=>g.items).map(i=>i.cid),j=o.indexOf(cur),nx=o[j<0?0:j+1];if(nx)stepTo(cur,nx)}
/* Resolved tab: resolved threads for reference (they live in canvas-resolved.json, which Claude never reads). Delete = gone for good, after an Undo window */
function loadResolved(){fetch(API+'api/comments?all=1',{cache:'no-store'}).then(r=>r.json()).then(d=>{const n=(d.comments||[]).filter(c=>c.resolved&&!(S.rdel||[]).includes(c.id));const k=JSON.stringify(n.map(c=>c.id));if(k!==S._rk){S._rk=k;S.resolved=n.sort((a,b)=>(b.resolvedAt||'').localeCompare(a.resolvedAt||''));render()}}).catch(()=>{})}
setTimeout(loadResolved,300);setInterval(loadResolved,5000);
function resolvedHTML(){const R=S.resolved||[];if(!R.length)return '<div class="empty">Nothing archived yet.</div>';
  const nm=c=>{const it=S.items.find(i=>'card:'+i.cid===c.target);return it?`<span class="sn">${num(it)}</span><span class="rt">${it.title.replace(/<[^>]+>/g,'')}</span>`:`<span class="rt">${esc(c.title||'General')}</span>`};
  const when=t=>t?new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  return `<div class="delbar"><span>${R.length} archived · kept for your reference</span><button class="chip danger" data-rdelall>Delete all</button></div>`+R.map(c=>`<div class="task rsv" data-task="${c.target}"><div class="th1">${nm(c)}<span class="rwhen">${when(c.resolvedAt)}</span><button class="ib" data-rdel="${c.id}" title="Delete for good">${ic('trash')}</button></div>${c.thread.map(m=>`<div class="l2 ${m.by==='Claude'?'':'u'}">${m.by==='Claude'?'<b>Claude:</b> ':''}${esc(m.text)}</div>`).join('')}</div>`).join('')}
function delResolved(ids){S.rdel=[...(S.rdel||[]),...ids];const g=S.resolved.filter(c=>ids.includes(c.id));S.resolved=S.resolved.filter(c=>!ids.includes(c.id));render();
  const t=setTimeout(()=>ids.forEach(id=>fetch(API+'api/comments/'+id,{method:'DELETE',headers:{'X-Confirm-Delete':'yes','X-Actor':'User'},keepalive:true})),8000);
  toast(`Deleted ${ids.length} for good`,()=>{clearTimeout(t);S.rdel=S.rdel.filter(x=>!ids.includes(x));S.resolved=[...S.resolved,...g].sort((a,b)=>(b.resolvedAt||'').localeCompare(a.resolvedAt||''));render()})}
document.addEventListener('click',e=>{const d1=e.target.closest('[data-rdel]');if(d1){e.stopPropagation();delResolved([d1.dataset.rdel]);return}
  if(e.target.closest('[data-rdelall]')){e.stopPropagation();const n=(S.resolved||[]).length;confirmBox(`Delete all ${n} resolved thread${n>1?'s':''} for good? This can't be undone after a few seconds.`,'Delete all',()=>delResolved(S.resolved.map(c=>c.id)))}},true);
/* resolving from the Inbox list opens the next item (the one that took its place, else the one above) so review is one click per thread */
function openNextTask(ti){if(ti<0)return;const T=[...document.querySelectorAll('#list .task')],el=T[ti]||T[ti-1];if(!el)return;const t=el.dataset.task;if(!t){/* one of Claude's own to-dos: no chat, just show its first screen */const g=el.dataset.goto;if(g){select(g);goTo(g,true);el.scrollIntoView({block:'nearest'})}return}
  const cid=t.startsWith('card:')?t.slice(5):null;if(cid&&S.items.some(i=>i.cid===cid)){select(cid);goTo(cid,true)}
  requestAnimationFrame(()=>{const a=document.querySelector(`#list .task[data-task="${t}"]`)||el;el.scrollIntoView({block:'nearest'});S.popT=t;openPop(t,a)})}
document.addEventListener('click',e=>{const ro=e.target.closest('[data-resopen]');if(ro&&!e.target.closest('button')){e.stopPropagation();S.resOpen=!S.resOpen;render();return}
  const sb0=e.target.closest('[data-sub]');if(sb0){e.stopPropagation();if(sb0.dataset.sub==='resolved'&&!S.resOpen){S.resOpen=true;render()}const sb=document.querySelector(`.subtab[data-sub="${sb0.dataset.sub}"]`)||sb0;S.sub=sb.dataset.sub;sb.parentElement.querySelectorAll('.subtab').forEach(b=>b.classList.toggle('on',b===sb));const L=document.getElementById('list'),t=L.querySelector(`[data-ibsec="${sb.dataset.sub}"]`),h=L.querySelector('.subtabs');if(t)L.scrollTo({top:t.offsetTop-(h?h.offsetHeight:0),behavior:'smooth'});return}
  const pr=e.target.closest('[data-pres-view]');if(pr){e.stopPropagation();S.popRes=S.popRes===S.popT?null:S.popT;S.noFocus=1;openPop(S.popT,S.popAnchor);S.noFocus=0}},true);
/* Alt: flip the selected card between its screenshot and its reference / previous one */
addEventListener('keydown',e=>{if(e.key!=='Alt'||e.repeat||e.target.closest?.('input,textarea,[contenteditable=true]'))return;const c=document.getElementById('c-'+S.sel)?.closest('.card'),b=c?.querySelector('.shotw [data-cmp]')||c?.querySelector('[data-cmp]');if(b){e.preventDefault();b.click()}});
/* ---- keyboard shortcuts, from the ? button by the zoom controls */
function kbList(){const r=[['0','Zoom to the screenshot under the cursor · again: whole canvas'],['Enter','Edit the selected '+(FLOW?'step':'issue')+' (title and details)'],['Space','Mark read and go to the next'+(FLOW?' step':' issue')+(FLOW?'':'')],['Alt',FLOW?'Flip to the previous screenshot':'Flip to the design reference'],['+ / −','Zoom in / out'],['⌘ + scroll','Zoom at the cursor']];
  if(!FLOW)r.splice(2,0,['← →','Previous / next issue (doesn’t mark read)']);if(FLOW)r.splice(2,0,['→','Next step along the flow (then the next branch)'],['←','Back along the arrows · on a first step: end of the previous flow'],['↑ ↓','Previous / next card in canvas order']);
  r.push(['Delete','Delete the selected '+(FLOW?'step':'issue')+' (one at a time)'],['Esc','Close a popover']);return r.map(([k,t])=>`<div class="kbr"><kbd>${k}</kbd><span>${t}</span></div>`).join('')}
document.addEventListener('click',e=>{const b=e.target.closest('#kbbtn'),P=document.getElementById('kbpop');if(b){e.stopPropagation();if(P.hidden||P.dataset.k==='more'){P.innerHTML=`<div class="kbh">Shortcuts</div>${kbList()}`;P.hidden=false}else P.hidden=true;P.dataset.k='';return}if(P&&!P.hidden&&!e.target.closest('#kbpop,#morebtn'))P.hidden=true},true);
/* custom canvas colour: shorthand expands — f → FFFFFF, f4 → F4F4F4, abc → AABBCC */
function hexNorm(v){v=String(v||'').trim().replace(/^#/,'');if(!/^[0-9a-f]+$/i.test(v))return null;
  const h=v.length===1?v.repeat(6):v.length===2?v.repeat(3):v.length===3?v.split('').map(c=>c+c).join(''):v.length===6?v:null;return h&&'#'+h.toUpperCase()}
document.addEventListener('keydown',e=>{const x=e.target.closest?.('[data-hex]');if(!x)return;e.stopPropagation();if(e.key==='Enter'){e.preventDefault();x.blur()}if(e.key==='Escape'){x.value=S.bg.replace('#','');x.blur()}},true);
document.addEventListener('focusout',e=>{const x=e.target.closest?.('[data-hex]');if(!x)return;const h=hexNorm(x.value);if(!h){x.value=S.bg.replace('#','').toUpperCase();toast('Use 1, 2, 3 or 6 hex digits, like f4 or F4F4F4');return}S.bg=h;localStorage.qaBg=h;applyBg();setsPanel()},true);
/* add an issue by hand on a screenshot (QA): same section and screenshot, grouped on the same card, title opens for typing */
document.addEventListener('click',async e=>{const b=e.target.closest('[data-addiss]');if(!b)return;e.stopPropagation();const src=S.items.find(i=>i.cid===b.dataset.addiss);if(!src)return;
  let scr=src.screen;if(!scr){scr='scr-'+src.cid;src.screen=scr;post('api/edit',{cid:src.cid,screen:scr})}
  const n=Math.max(0,...S.items.concat(S.deleted||[]).map(i=>+i.n||0))+1;
  const r=await post('api/added',{section:src.section,img:src.img,screen:scr,v:src.v,n,title:'New issue'});if(!r){toast('Couldn’t add the issue');return}
  const it=S.mk?S.mk(r):{...r,sugg:[],sids:[]};S.items.push(it);S.readLocal.add(it.cid);post('api/state',{cid:stKey(it.cid),new:false});/* you added it: it starts read */render();select(it.cid);
  requestAnimationFrame(()=>{const t=document.querySelector(`#c-${it.cid} .ttl`);if(t){const q=t.getBoundingClientRect();t.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:q.left+2,clientY:q.top+q.height/2}));const sel=getSelection(),rg=document.createRange();rg.selectNodeContents(t);sel.removeAllRanges();sel.addRange(rg)}})},true);
function zeroKey(){if(S.zoomedTo){S.zoomedTo=null;fit();return}
  const x=S.mx??innerWidth/2,y=S.my??innerHeight/2;let best=null,bd=Infinity;
  document.querySelectorAll('#world .card').forEach(c=>{const im=c.querySelector('.shot,.noshot');if(!im)return;const r=im.getBoundingClientRect();
    const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}});
  if(!best)return;const id=(best.querySelector('.gi')||best).dataset.cid;S.zoomedTo=id;select(id);goTo(id,true)}
// any manual pan/zoom ends the "zoomed to a screenshot" state, so the next 0 zooms in again
VP.addEventListener('wheel',()=>{S.zoomedTo=null},{passive:true});VP.addEventListener('pointerdown',()=>{S.zoomedTo=null});

// ---- flow navigation: → walks one whole path to its end, then the next branch (depth-first); ← goes back the way you came;
//      (← always moves left to a step that leads here, never sideways to another branch); ↑ ↓ read the cards row by row like a grid (visualOrder)
function flowOrder(){const rk=i=>S.rank?.[i]??0,succ=c=>(S.E||[]).filter(e=>e[0]===c).map(e=>e[1]).sort((a,b)=>rk(a)-rk(b));
  const ids=S.items.map(i=>i.cid),hasPred=new Set((S.E||[]).map(e=>e[1])),out=[],seen=new Set();
  const dfs=c=>{if(seen.has(c))return;seen.add(c);out.push(c);succ(c).forEach(dfs)};
  ids.filter(c=>!hasPred.has(c)).sort((a,b)=>rk(a)-rk(b)).forEach(dfs);ids.forEach(dfs);return out}
/* leaving a flow's end screen: a quick red ripple on it (an overlay, so re-renders can't cut it short) */
/* end of a path or section: a soft dark glow on the canvas's right edge (on the frame, not the screen, so it never blocks moving on); pressing again restarts it */
function edgeGlow(){let g=document.getElementById('edgeglow');if(!g){g=document.createElement('div');g.id='edgeglow';VP.append(g)}g.classList.remove('on');void g.offsetWidth;g.classList.add('on')}
function endRipple(){edgeGlow()}
function oldRipple(cid){const q=()=>document.getElementById('c-'+cid)?.closest('.card')?.querySelector('.shot,.noshot');if(!q())return;const o=document.createElement('div');o.className='endrip';VP.append(o);
  /* a soft ring spreading from the end screen's centre; re-pinned to it on every paint */
  const V=VP.getBoundingClientRect(),f=S.ripF=()=>{const el=q();if(!el)return;const q0=el.getBoundingClientRect(),l=Math.max(q0.left,V.left),t=Math.max(q0.top,V.top),rr=Math.min(q0.right,V.right),bb=Math.min(q0.bottom,V.bottom);/* centre of the part you can see */o.style.left=(l+rr)/2-V.left+'px';o.style.top=(t+bb)/2-V.top+'px';o.style.setProperty('--d',Math.max(160,Math.min(rr-l,bb-t))*.9+'px')};f();setTimeout(()=>{o.remove();if(S.ripF===f)S.ripF=null},850)}
function flowKey(k){const now=performance.now();S.instant=now-(S.lastKey||0)<700;S.lastKey=now;setTimeout(()=>S.instant=false);const go=id=>{if(!id)return;select(id);goTo(id);document.querySelector(`.row[data-cid="${id}"]`)?.scrollIntoView({block:'nearest'})};
  const cur=S.sel,E=S.E||[],secOf=c=>S.items.find(i=>i.cid===c)?.section;S.trail=S.trail||[];S.fwd=S.fwd||[];/* trail: path walked with →; fwd: steps left with ←, so → retraces the same branch */
  const snake=visualOrder(),j=snake.indexOf(cur),gs=secOf(cur),grid=S.grid?.has(gs),fwdKey=k==='ArrowRight'||k==='ArrowDown';
  let nx,how='snake';
  if(!cur)nx=snake[0];
  else if(grid){/* a States section is a grid: ← → move one screen, ↑ ↓ one row; at its edges they carry on into the next or previous section */
    const ids=snake.filter(c=>secOf(c)===gs),p=ids.indexOf(cur),cols=Math.max(1,getComputedStyle(document.querySelector(`#c-${cur}`)?.closest('.grid')||document.body).gridTemplateColumns.split(' ').length);
    const step=k==='ArrowRight'?1:k==='ArrowLeft'?-1:k==='ArrowDown'?cols:-cols,q=p+step;
    nx=q>=0&&q<ids.length?ids[q]:k==='ArrowDown'&&Math.floor(p/cols)<Math.floor((ids.length-1)/cols)?ids.at(-1):snake[step>0?snake.indexOf(ids.at(-1))+1:snake.indexOf(ids[0])-1]}
  else if(k==='ArrowRight'){how='path';const f=S.fwd.at(-1);if(f&&E.some(e=>e[0]===cur&&e[1]===f)){S.fwd.pop();nx=f;how='retrace'}else{S.fwd=[];const o=flowOrder();nx=o[o.indexOf(cur)+1]}}
  else if(k==='ArrowLeft'){how='back';const p=E.filter(e=>e[1]===cur).map(e=>e[0]);if(p.length){nx=p.find(x=>S.trail.includes(x))||p[0]}else{/* first step of a flow: the last screen of the previous section */const G=ordered(),gi=G.findIndex(g=>g.items.some(i=>i.cid===cur)),pg=G[gi-1];if(pg){const ids=new Set(pg.items.map(i=>i.cid));nx=S.grid?.has(pg.s)?pg.items.at(-1).cid:flowOrder().filter(c=>ids.has(c)).pop()}}}
  else nx=snake[k==='ArrowDown'?j+1:j-1];
  /* red ring: only going forward, once, where a path or section really ends (a branch's last step, or leaving a section) */
  const end=cur&&fwdKey&&(!nx||secOf(nx)!==gs||(how==='path'&&!E.some(e=>e[0]===cur)));
  if(end)edgeGlow();/* never waits: the glow is on the canvas frame, so you can keep moving while it plays */
  if(!nx)return;
  if(how==='path'||how==='retrace'){if(cur)S.trail.push(cur)}else if(how==='back'&&E.some(e=>e[0]===nx&&e[1]===cur)){const t=S.trail.lastIndexOf(nx);if(t>=0)S.trail.length=t;S.fwd.push(cur)}else{S.trail=[];S.fwd=[]}
  go(nx)}

/* ---- priority badges: shown by default on QA canvases, hidden on workflow canvases; Settings switches it everywhere */
S.showPrio=localStorage.qaPrio?localStorage.qaPrio==='1':!FLOW;function applyPrio(){document.documentElement.classList.toggle('noprio',!S.showPrio)}applyPrio();
/* ---- collapse the side pane for more canvas */
function setSbCol(v){S.sbCol=v;localStorage.qaSbCol=v?'1':'0';document.documentElement.classList.toggle('sbcol',v);requestAnimationFrame(()=>{typeof drawArrows==='function'&&FLOW&&drawArrows();paint()})}
document.addEventListener('click',e=>{if(e.target.closest('#sbcol')){e.stopPropagation();setSbCol(true)}else if(e.target.closest('#sbopen')){e.stopPropagation();setSbCol(false)}},true);
if(localStorage.qaSbCol==='1')setSbCol(true);

S.anim=localStorage.qaAnim||'auto';   // screen switch: auto (slide; quick repeats instant) · pan · instant

/* ---- Open app: the live app if it answers, else the repo on its branch (data.app = {url, repo, branch}) */
/* ---- toolbar links: reference / live build (globe), local build (live canvas only), git branch; the ⋯ menu has the version and every link */
{const A=D.app||{},P=D.deploy||{},gh=/github\.com/.test(A.repo||''),repoUrl=A.repo?(A.branch?A.repo.replace(/\/$/,'')+(gh?'/tree/':'/-/tree/')+encodeURI(A.branch):A.repo):null;
  const L=[['refbtn',A.url,FLOW?'Live app':'Build under review'],['locbtn',VIEW?null:A.local,'Local build'],['gitbtn',repoUrl,A.branch?'Branch · '+A.branch:(gh?'GitHub':'GitLab')],...[].concat(A.design||[]).map((x,k,a)=>{const u=typeof x==='string'?x:x.url,l=typeof x==='string'?'':x.label||'';return [null,u,'Design reference'+(l?' · '+l:a.length>1?' '+(k+1):'')]})];/* design references: Figma, a branch, any URL; as many as needed */
  /* links live in the ⋯ menu only; the toolbar stays quiet */L.forEach(([id,u,l])=>{const b=id&&document.getElementById(id);if(!b||!u||1)return;b.hidden=false;b.title=l+'\n'+u;b.onclick=()=>window.open(u,'_blank','noopener')});
  document.getElementById('morebtn')?.addEventListener('click',e=>{e.stopPropagation();const K=document.getElementById('kbpop');if(!K.hidden&&K.dataset.k==='more'){K.hidden=true;return}
    const ver=P.version?(VIEW?`Version v${P.version} · ${esc(P.at)}`:`Last deployed v${P.version} · ${esc(P.at)}`):'Not deployed yet',lk=(l,u)=>`<div class="mrow"><span>${l}</span>${u?`<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${esc(u.replace(/^https?:\/\//,''))}</a>`:'<i>Not set</i>'}</div>`;
    K.innerHTML=`<div class="kbh">${esc(D.title)}</div><div class="mrow"><span>${ver}</span></div>${lk('Published canvas',P.url||(P.version?'':null))}${VIEW?'':`<div class="mrow"><span>All canvases</span><a href="http://localhost:4100" target="canvas:all" title="The list of your local canvases (local only)">localhost:4100</a></div>`}${L.filter(x=>x[1]).map(([,u,l])=>lk(l,u)).join('')}`.replace('<i>Not set</i>',P.version?'<i>Not set</i>':'<i>Not deployed yet</i>');
    K.dataset.k='more';K.hidden=false});
  document.addEventListener('click',e=>{const K=document.getElementById('kbpop');if(K.dataset.k==='more'&&!e.target.closest('#kbpop,#morebtn')){K.hidden=true;K.dataset.k=''}})}

/* ---- this canvas claims new Desktop screenshots while it's the one you use (focus / click; refreshed at most every 10 s) */
{let last=0;const claim=()=>{if(document.visibilityState!=='visible'||S.offline)return;const t=Date.now();if(t-last<10000)return;last=t;fetch(API+'api/active',{method:'POST'}).catch(()=>{})};
  claim();addEventListener('focus',claim);document.addEventListener('visibilitychange',claim);document.addEventListener('pointerdown',claim,true)}

/* To-dos spy scroll: the chip of the section under the pinned chips lights up */
document.getElementById('list').addEventListener('scroll',()=>{if(S.tab!=='inbox')return;const L=document.getElementById('list'),h=L.querySelector('.subtabs');if(!h)return;const y=L.scrollTop+h.offsetHeight+8;let cur='done';L.querySelectorAll('[data-ibsec]').forEach(x=>{if(x.offsetTop<=y)cur=x.dataset.ibsec});if(L.scrollTop+L.clientHeight>=L.scrollHeight-2)cur=[...L.querySelectorAll('[data-ibsec]')].pop()?.dataset.ibsec||cur;if(cur!==S.sub){S.sub=cur;h.querySelectorAll('.subtab').forEach(b=>b.classList.toggle('on',b.dataset.sub===cur))}},{passive:true});
/* paste a screenshot (Cmd+V) straight into this canvas's To-dos — no scope check needed */
document.addEventListener('paste',e=>{if(e.target.closest?.('input,textarea,[contenteditable=true]'))return;const f=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(!f)return;e.preventDefault();
  const r=new FileReader();r.onload=async()=>{const it=await post('api/inbox/paste',{data:r.result});if(!it?.id){toast('Couldn’t add the screenshot');return}S.inbox.push(it);render();
    toast('Screenshot added to To-dos');const T=document.getElementById('toast');T.insertAdjacentHTML('afterbegin','<img class="tthumb" src="'+r.result+'" alt="">');T.insertAdjacentHTML('beforeend',' <button class="undo" data-open="card:'+it.id+'">Add comment</button>');clearTimeout(T._t);T._t=setTimeout(()=>T.style.display='none',10000);/* open its chat right away; a newer paste replaces it */requestAnimationFrame(()=>{const a=document.querySelector(`[data-task="card:${it.id}"]`)||T.querySelector('[data-open]');S.popT='card:'+it.id;openPop('card:'+it.id,a)})};/* thumbnail + 10 s so you can see what went in */r.readAsDataURL(f)});

/* delete buttons get their own early listener (the general click handler was catching these first) */
document.addEventListener('click',e=>{const dl=e.target.closest('[data-del],[data-deltop]');if(!dl)return;e.stopPropagation();e.preventDefault();
  const cid=dl.dataset.del||dl.closest('.card')?.querySelector('.gi')?.dataset.cid;if(!cid)return;document.getElementById('menu').dataset.for=cid;menuAct('del')},true);

/* popover stays on screen as it grows (typing, new replies): it slides up while there's room above; beyond the screen height its thread list scrolls inside */
function fitPop(){const P=document.getElementById('pop');if(!P.classList.contains('open'))return;const h=P.offsetHeight,top=parseFloat(P.style.top)||12,lim=innerHeight-12;if(top+h>lim)P.style.top=Math.max(12,lim-h)+'px'}
document.addEventListener('input',e=>{if(e.target.closest?.('#pop'))requestAnimationFrame(fitPop)},true);addEventListener('resize',fitPop);
new MutationObserver(()=>requestAnimationFrame(fitPop)).observe(document.getElementById('pop'),{childList:true,subtree:true});

/* Delete / Backspace: delete the selected issue or step — one at a time, even on a shared screenshot (Undo in the toast) */
addEventListener('keydown',e=>{if((e.key!=='Delete'&&e.key!=='Backspace')||e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;if(e.target.closest?.('input,textarea,[contenteditable=true]')||document.querySelector('.cfm'))return;const cid=S.sel;if(!cid||!S.items.some(i=>i.cid===cid))return;e.preventDefault();document.getElementById('menu').dataset.for=cid;menuAct('del')});

if(VIEW){/* view build: only the Screens / Issues list; To-dos, New and Deleted need the server */S.tab='issues';document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab==='issues'))}

// ---- edit a card's title + details as one box (Slack-style): first line is the title, Enter goes to the details
function caretAt(el,start){const r=document.createRange();r.selectNodeContents(el);r.collapse(!!start);const sl=getSelection();sl.removeAllRanges();sl.addRange(r)}
function caretOff(el){const sl=getSelection();if(!sl.rangeCount)return -1;const r=sl.getRangeAt(0),q=document.createRange();q.selectNodeContents(el);q.setEnd(r.startContainer,r.startOffset);const d=document.createElement('div');d.appendChild(q.cloneContents());return d.innerHTML.length?d.textContent.length+(d.querySelector('br,img')?1:0):0}
function editCard(e){const box=e.target.closest('.gi')||e.target.closest('.card'),T=box?.querySelector('.ttl[data-ed]'),F=box?.querySelector('.fix[data-ed]');if(!T||!F)return;
  const cid0=String(box.dataset.cid||'').replace(/^x-/,''),it=[...S.items,...(S.deleted||[]),...(S.fixedItems||[])].find(i=>i.cid===cid0);if(!it)return;const b0=T.innerHTML,f0=F.innerHTML,body=F.closest('.body'),shut=body.classList.contains('shut');body.classList.remove('shut');body.removeAttribute('hidden');box.classList.add('editing');
  T.contentEditable=F.contentEditable='true';const tgt=e.target.closest('.fix')?F:T;tgt.focus();{const r=document.caretRangeFromPoint?.(e.clientX,e.clientY),sl=getSelection();sl.removeAllRanges();if(r&&tgt.contains(r.startContainer)){r.collapse(true);sl.addRange(r)}else caretAt(tgt,false)}
  let done=false;const clean=h=>h.replace(/^(<br>|\s|&nbsp;)+|(<br>|\s|&nbsp;)+$/g,'').replace(/<div>(.*?)<\/div>/g,'<br>$1');
  let end=save=>{if(done)return;done=true;T.contentEditable=F.contentEditable='false';box.classList.remove('editing');T.removeEventListener('keydown',kt);F.removeEventListener('keydown',kf);box.removeEventListener('focusout',fo);
    if(!save){T.innerHTML=b0;F.innerHTML=f0}else{let t=untok(clean(T.innerHTML)),w=untok(clean(F.innerHTML));const ch={};if(!trimHtml(t)&&trimHtml(w)){/* no title but details: the first line becomes the title */const [a,...r]=w.split(/<br\s*\/?>/);t=a.replace(/^\s*[•\-]\s*/,'').trim();w=r.join('<br>').replace(/^(<br>|\s)+/,'');F.innerHTML=w;T.innerHTML=t}if(t!==untok(b0)&&t!==it.title){it.title=t;ch.title=t}if(w!==it.what){it.what=w;ch.what=w}
      if(Object.keys(ch).length){if(unread(it)){S.readLocal.add(it.cid);post('api/state',{cid:stKey(it.cid),new:false})}post('api/edit',{cid:it.cid,...ch}).then(r=>r&&toast('Saved'));render()}}
    if(shut&&!it.expanded)body.classList.add('shut');fitAll()};
  const kt=ev=>{if(ev.key==='Escape'){end(true);return}if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();end(true);return}
    if(ev.key==='Enter'&&ev.shiftKey){ev.preventDefault();document.execCommand('insertLineBreak');return}/* Shift+Enter: a line break inside the title */
    if(ev.key==='Enter'){ev.preventDefault();/* split at the caret: the rest of the title becomes the first line of the details */const sl=getSelection(),r=sl.getRangeAt(0);r.deleteContents();const q=document.createRange();q.selectNodeContents(T);q.setStart(r.startContainer,r.startOffset);
      const d=document.createElement('div');d.appendChild(q.extractContents());const rest=d.innerHTML.replace(/^\s+/,''),has=!!trimHtml(F.innerHTML);T.innerHTML=T.innerHTML.replace(/\s+$/,'');F.innerHTML=rest+(has?'<br>'+F.innerHTML:'');F.focus();caretAt(F,true);return}
    if(ev.key==='ArrowDown'&&caretOff(T)>=T.textContent.length){ev.preventDefault();F.focus();caretAt(F,true)}};
  const kf=ev=>{if(ev.key==='Escape'){end(true);return}if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();end(true);return}
    if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();const sl=getSelection(),r=sl.getRangeAt(0),q=document.createRange();q.selectNodeContents(F);q.setEnd(r.startContainer,r.startOffset);const d=document.createElement('div');d.appendChild(q.cloneContents());
      const line=d.innerHTML.split(/<br\s*\/?>/).pop().replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();document.execCommand('insertHTML',false,/^[•\-]/.test(line)?'<br>• ':'<br>');return}
    if((ev.key==='Backspace'||ev.key==='ArrowUp')&&caretOff(F)===0&&!getSelection().toString()){ev.preventDefault();if(ev.key==='ArrowUp'){T.focus();caretAt(T,false);return}
      const [first,...rest]=F.innerHTML.split(/<br\s*\/?>/),at=T.textContent.length+(first.trim()&&T.textContent&&!/\s$/.test(T.textContent)?1:0);const add=first.replace(/^\s*[•\-]\s*/,'');T.innerHTML=T.innerHTML+(add&&T.textContent&&!/\s$/.test(T.textContent)?' ':'')+add;F.innerHTML=rest.join('<br>');T.focus();
      const tn=[...T.childNodes].reduce((a,n)=>a||(n.nodeType===3?n:null),null);caretAt(T,false);if(tn&&at<=tn.length){const r=document.createRange();r.setStart(tn,at);r.collapse(true);const sl=getSelection();sl.removeAllRanges();sl.addRange(r)}}};
  const fo=()=>setTimeout(()=>{if(!box.contains(document.activeElement)&&!S.atHold){atClose();end(true)}},0);
  const ka=ev=>{if(!FLOW&&atKey(ev))ev.stopImmediatePropagation()};T.addEventListener('keydown',ka,true);F.addEventListener('keydown',ka,true);
  const ia=()=>{if(!FLOW)atInput()};T.addEventListener('input',ia);F.addEventListener('input',ia);
  /* a click on empty space inside the box keeps editing: the caret goes to the end of the nearer field */
  const zone=T.closest('.gi')||T.closest('.cap')||box,md=ev=>{if(document.getElementById('atpop')?.contains(ev.target))return;if(!zone.contains(ev.target)){end(true);return}/* outside: save and close */if(T.contains(ev.target)||F.contains(ev.target)||ev.target.closest('button,a,input'))return;ev.preventDefault();const tr=T.getBoundingClientRect(),el=ev.clientY>tr.bottom?F:T;el.focus();caretAt(el,false)};document.addEventListener('mousedown',md,true);
  const endWrap=end;end=save=>{document.removeEventListener('mousedown',md,true);atClose&&atClose();endWrap(save)};
  T.addEventListener('keydown',kt);F.addEventListener('keydown',kf);box.addEventListener('focusout',fo)}
// ---- paste into any text box comes in as plain text (the canvas's own size and colour); copy keeps only basic formatting
document.addEventListener('paste',e=>{const ce=e.target.closest?.('[contenteditable=true]');if(!ce)return;const t=e.clipboardData?.getData('text/plain');if(t==null||[...(e.clipboardData.items||[])].some(i=>i.type.startsWith('image/'))&&!t)return;
  e.preventDefault();e.stopImmediatePropagation();document.execCommand('insertHTML',false,FLOW?esc(t).replace(/\r?\n/g,'<br>'):tokHtml(esc(t).replace(/\r?\n/g,'<br>')))},true);
function basicHtml(node){const OK={B:'b',STRONG:'b',I:'i',EM:'i',A:'a',BR:'br',UL:'ul',OL:'ol',LI:'li'};let h='';
  node.childNodes.forEach(n=>{if(n.nodeType===3){h+=esc(n.textContent);return}if(n.nodeType!==1)return;const c=getComputedStyle?.(n),tag=OK[n.tagName],inner=basicHtml(n);
    if(n.matches?.('button,svg,img,.snt,.pp,.rd,.dtog,.lacts,.acts,.racts'))return;
    if(tag==='br')h+='<br>';else if(tag==='a'&&/^https?:/.test(n.getAttribute('href')||''))h+=`<a href="${esc(n.getAttribute('href'))}">${inner}</a>`;else if(tag&&tag!=='a')h+=`<${tag}>${inner}</${tag}>`;
    else if(/^(DIV|P|H\d)$/.test(n.tagName))h+=(h&&!/<br>$/.test(h)?'<br>':'')+inner;else h+=inner});return h}
document.addEventListener('copy',e=>{const sl=getSelection();if(!sl.rangeCount||sl.isCollapsed)return;const r=sl.getRangeAt(0);if(!document.getElementById('world')?.contains(r.commonAncestorContainer)&&!document.getElementById('sb')?.contains(r.commonAncestorContainer)&&!document.getElementById('pop')?.contains(r.commonAncestorContainer))return;
  const d=document.createElement('div');d.appendChild(r.cloneContents());e.clipboardData.setData('text/html',basicHtml(d));e.clipboardData.setData('text/plain',sl.toString());e.preventDefault()});

document.addEventListener('click',e=>{const h=e.target.closest('[data-ibtog]');if(!h||e.target.closest('button'))return;e.stopImmediatePropagation();const k=h.dataset.ibtog;
  S.ibShut=S.ibShut||new Set(S.resOpen?[]:['resolved']);S.ibShut.has(k)?S.ibShut.delete(k):S.ibShut.add(k);if(k==='resolved')S.resOpen=!S.ibShut.has(k);render()},true);

// ⌘F finds collapsed details too (hidden="until-found"): a match opens that card and brings it into view
document.addEventListener('beforematch',e=>{const b=e.target.closest?.('[data-body]');if(!b)return;const cid=b.dataset.body;requestAnimationFrame(()=>{select(cid);goTo(cid,true)})},true);
VP.addEventListener('scroll',()=>{if(!VP.scrollTop&&!VP.scrollLeft)return;/* find-in-page scrolled the canvas to a match (it centres it): take the card under the centre, undo the scroll, pan there our way */
  const v=VP.getBoundingClientRect(),el=document.elementFromPoint(v.left+v.width/2,v.top+v.height/2),c=el?.closest?.('.gi')||el?.closest?.('.card');VP.scrollTop=0;VP.scrollLeft=0;
  const cid=c?.dataset.cid||c?.querySelector('.gi')?.dataset.cid;if(cid&&S.items.some(i=>i.cid===cid))requestAnimationFrame(()=>{select(cid);goTo(cid,true)})});

// unread only: the Issues tab shows just the unread ones (the old New tab's list), from the chip at its top or from Filters
document.addEventListener('click',e=>{const b=e.target.closest('[data-funread]');if(!b)return;e.stopImmediatePropagation();S.unreadOnly=!S.unreadOnly;
  if(S.tab==='issues'||S.tab==='new')S.tab=S.unreadOnly?'new':'issues';document.querySelectorAll('#filters [data-funread]').forEach(c=>c.classList.toggle('on',!!S.unreadOnly));render()},true);

// ---- QA tags (UX gap · Dev gap · Cosmetic gap): at the end of the heading on the canvas; several per issue
const TAGS={ux:'UX gap',dev:'Dev gap',cos:'Cosmetic gap'};S.tagClr=localStorage.qaTagClr==='1';S.ftag=S.ftag||new Set();
function tagLine(i){const t=(i.tags||[]).filter(x=>TAGS[x]);return `<span class="tagl ${S.tagClr?'clr':''}" data-tagfor="${i.cid}" title="Tags — click to change">${t.length?'· '+t.map(x=>`<span class="tg tg-${x}">${TAGS[x]}</span>`).join(', '):'<span class="tgadd">+ Tag</span>'}</span>`}
function openTagMenu(cid,btn){const M=document.getElementById('menu'),it=S.items.find(i=>i.cid===cid);if(!it)return;M.className='tagmenu';M.dataset.for=cid;
  M.innerHTML=Object.entries(TAGS).map(([k,l])=>`<button data-tagset="${k}" class="${(it.tags||[]).includes(k)?'on':''}"><span class="ck">${(it.tags||[]).includes(k)?ic('check'):''}</span>${l}</button>`).join('');placeMenu(M,btn)}
function openFilterDD(kind,btn){const M=document.getElementById('menu');M.className='tagmenu';M.dataset.for='';M.dataset.ddk=kind;
  const opts=kind==='prio'?Object.entries(PL):[...Object.entries(TAGS),['none','No tag']],set=kind==='prio'?S.fp:S.ftag;
  M.innerHTML=opts.map(([k,l])=>`<button data-fset="${k}" class="${set.has(k)?'on':''}"><span class="ck">${set.has(k)?ic('check'):''}</span>${l}</button>`).join('')+(set.size?`<button data-fclear>Clear</button>`:'');placeMenu(M,btn)}
window.addEventListener('click',e=>{/* window capture: runs before the menu's own close-on-click */
  const tl=e.target.closest('[data-tagfor]');if(tl&&!tl.closest('[contenteditable=true]')){e.stopImmediatePropagation();openTagMenu(tl.dataset.tagfor,tl);return}
  const ts=e.target.closest('#menu [data-tagset]');if(ts){e.stopImmediatePropagation();const M=document.getElementById('menu'),cid=M.dataset.for,it=S.items.find(i=>i.cid===cid),k=ts.dataset.tagset;if(!it)return;
    const t=new Set(it.tags||[]);t.has(k)?t.delete(k):t.add(k);it.tags=[...t];post('api/edit',{cid,tags:it.tags});render();const a=document.querySelector(`[data-tagfor="${cid}"]`);if(a)openTagMenu(cid,a);else closeMenu();return}
  const fd=e.target.closest('[data-fdd]');if(fd){e.stopImmediatePropagation();const M=document.getElementById('menu');if(!M.hidden&&M.dataset.ddk===fd.dataset.fdd){closeMenu();M.dataset.ddk='';return}openFilterDD(fd.dataset.fdd,fd);return}
  const fs=e.target.closest('#menu [data-fset],#menu [data-fclear]');if(fs){e.stopImmediatePropagation();const M=document.getElementById('menu'),kind=M.dataset.ddk,set=kind==='prio'?S.fp:S.ftag;
    if(fs.hasAttribute('data-fclear'))set.clear();else{const k=fs.dataset.fset;set.has(k)?set.delete(k):set.add(k)}render();const a=document.querySelector(`[data-fdd="${kind}"]`);if(a)openFilterDD(kind,a);return}
  const tc=e.target.closest('#settings [data-tagclr]');if(tc){e.stopImmediatePropagation();S.tagClr=tc.dataset.tagclr==='1';localStorage.qaTagClr=S.tagClr?'1':'0';document.documentElement.classList.toggle('tagclr',S.tagClr);setsPanel();render();return}
},true);

// ---- @tags (QA): @UX-Gap · @Dev-Gap · @Cosmetic-Gap live in the title or details text; shown as a grey chip that deletes as one
const TAGN={ux:'UX-Gap',dev:'Dev-Gap',cos:'Cosmetic-Gap'},TAGRX=/@(ux|dev|cos(?:metic)?)[-\s]?gap\b/gi;
const tagKey=w=>w.toLowerCase().startsWith('cos')?'cos':w.toLowerCase();
function tokHtml(h){return String(h||'').replace(TAGRX,(m,w)=>{const k=tagKey(w);return `<span class="tok tok-${k}" contenteditable="false" data-tag="${k}">@${TAGN[k]}</span>`})}
function untok(h){return String(h||'').replace(/<span class="tok[^"]*"[^>]*>(@[\w-]+)<\/span>/g,'$1').replace(/&nbsp;/g,' ').replace(/ {2,}/g,' ').replace(/ +$/,'')}
function tagsOf(i){const t=new Set();(String(i.title||'')+' '+String(i.what||'')).replace(TAGRX,(m,w)=>{t.add(tagKey(w));return m});return [...t]}
function sideTitle(h){return String(h||'').replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').replace(/^(\s*@(ux|dev|cos(?:metic)?)[-\s]?gap\b)+\s*/i,'')}
function atState(){const sl=getSelection();if(!sl.rangeCount)return null;const r=sl.getRangeAt(0),n=r.startContainer;if(n.nodeType!==3)return null;const before=n.textContent.slice(0,r.startOffset),m=before.match(/(^|\s)@([\w-]*)$/);return m?{node:n,end:r.startOffset,start:r.startOffset-m[2].length-1,q:m[2].toLowerCase()}:null}
function atOpts(q){return Object.entries(TAGN).filter(([k,l])=>!q||l.toLowerCase().replace('-','').startsWith(q.replace('-',''))||l.toLowerCase().startsWith(q))}
function atInput(){const a=atState();if(!a){atClose();return}const o=atOpts(a.q);if(!o.length){atClose();return}let P=document.getElementById('atpop');if(!P){P=document.createElement('div');P.id='atpop';document.body.append(P)}
  S.atSel=Math.min(S.atSel||0,o.length-1);P.innerHTML=o.map(([k,l],j)=>`<button data-atk="${k}" class="${j===S.atSel?'on':''}"><span class="tok tok-${k}">@${l}</span></button>`).join('');
  const r=getSelection().getRangeAt(0).getBoundingClientRect();P.style.left=Math.min(r.left,innerWidth-200)+'px';P.style.top=(r.bottom+6)+'px';P.hidden=false;S.atOpen=o}
function atClose(){const P=document.getElementById('atpop');if(P)P.hidden=true;S.atOpen=null;S.atSel=0}
function atPick(k){const a=atState();if(!a)return atClose();const r=document.createRange();r.setStart(a.node,a.start);r.setEnd(a.node,a.end);const sl=getSelection();sl.removeAllRanges();sl.addRange(r);
  document.execCommand('insertHTML',false,tokHtml('@'+TAGN[k])+'&nbsp;');atClose()}
function atKey(ev){if(!S.atOpen)return false;const n=S.atOpen.length;
  if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();S.atSel=(S.atSel+(ev.key==='ArrowDown'?1:n-1))%n;atInput();return true}
  if(ev.key==='Enter'||ev.key==='Tab'){ev.preventDefault();atPick(S.atOpen[S.atSel][0]);return true}
  if(ev.key==='Escape'){ev.preventDefault();atClose();return true}return false}
document.addEventListener('pointerdown',e=>{const b=e.target.closest('#atpop [data-atk]');if(!b)return;e.preventDefault();S.atHold=1;atPick(b.dataset.atk);setTimeout(()=>S.atHold=0,0)},true);
document.documentElement.classList.toggle('tagclr',!!S.tagClr);

// ---- New screenshots (not filed yet) and Deleted: their own sections at the end of the canvas and the side pane, shown only when not empty
function xNew(){return VIEW?[]:(S.inbox||[]).filter(i=>!i.processed&&!i.deleted&&!i.resolved)}
function xDel(){return VIEW?[]:(S.deleted||[])}
function xFix(){return FLOW?[]:(S.fixedItems||[])}
function xCnt(t){const n=threads(t).length;return `<button class="a cmi ${n?'has':'hv'}" data-open="${t}" title="Comments for Claude">${ic('ai')}${n?`<em>${n}</em>`:''}</button>`}
function xLanes(){const N=xNew(),Dl=xDel(),lane=(k,l,n,body)=>`<section class="lane xl ${S.openSecs.has(k)?'':'shut'}" data-xl="${k}"><h2 data-xltog="${k}">${ic('chev')}<b class="lt">${l}</b><span>${n}</span>${k==='x:del'?`<button class="chip danger xdall" data-delallc>Delete all for good</button>`:''}</h2><div class="grid">${body}</div></section>`;
  return (N.length?lane('x:new','New screenshots',N.length,N.map(i=>`<div class="card xcard" id="c-x-${i.id}" data-cid="x-${i.id}">${shotBox({cid:i.id,img:i.file},`<span class="acts">${xCnt('card:'+i.id)}<button class="a hv del" data-idel="${i.id}" title="Delete — taken by mistake">${ic('trash')}</button></span>`,0)}<div class="cap"><div class="trow"><h3><span class="ttl xt">${i.pasted?'Pasted':'From the Desktop'} · waiting for Claude</span></h3></div></div></div>`).join('')):'')
   +(xFix().length?lane('x:fix','Fixed',xFix().length,xFix().map(i=>`<div class="card xcard xfix" id="c-x-${i.cid}" data-cid="x-${i.cid}">${shotBox({cid:i.cid,img:i.img},VIEW?'':`<span class="acts">${xCnt('card:'+i.cid)}<button class="a" data-unfix="${i.cid}" title="Reopen — not fixed after all">${ic('history')}</button></span>`,0)}<div class="cap"><div class="trow"><h3><span class="snt">${i.n??''}</span> <span class="ttl" data-ed="title">${tokHtml(i.title)}</span></h3></div><div class="body shut" hidden="until-found" data-body="x-${i.cid}"><div class="fix" data-ed="what">${tokHtml(trimHtml(i.what))}</div></div></div></div>`).join('')):'')
   +(Dl.length?lane('x:del','Deleted',Dl.length,Dl.map(i=>`<div class="card xcard xdel" id="c-x-${i.cid}" data-cid="x-${i.cid}">${shotBox({cid:i.cid,img:i.img},`<span class="acts">${unread(i)?`<button class="a rd" data-read="${i.cid}" title="Unread — click to mark read"><i></i></button>`:''}${xCnt('card:'+i.cid)}<button class="a" data-restore="${i.cid}" title="Restore">${ic('history')}</button><button class="a del" data-purge1="${i.cid}" title="Delete for good (its comments too)">${ic('trash')}</button></span>`,0)}<div class="cap"><div class="trow"><h3><span class="snt">${i.n??''}</span> <span class="ttl" data-ed="title">${FLOW?i.title:tokHtml(i.title)}</span></h3></div><div class="body shut" hidden="until-found" data-body="x-${i.cid}"><div class="fix" data-ed="what">${FLOW?trimHtml(i.what):tokHtml(trimHtml(i.what))}</div></div></div></div>`).join('')):'')}
function xSide(){if(S.tab!=='issues')return '';const N=xNew(),Dl=xDel(),sec=(k,l,n,rows,extra='')=>`<div class="secw ${S.openSecs.has(k)?'open':''}" data-secw="${k}"><div class="sec" data-sec="${k}">${ic('chev')}<span class="stt">${l}</span><span class="n">${n}</span>${extra}</div><div class="secb"><div class="secin">${rows}</div></div></div>`;
  return (N.length?sec('x:new','New screenshots',N.length,N.map(i=>`<div class="row xrow" data-xgo="x-${i.id}"><img class="dthumb" src="${esc(i.file)}" alt=""><span class="rt">${i.id} · ${i.pasted?'Pasted':'From the Desktop'}</span><button class="ib cmb ${threads('card:'+i.id).length?'has':''}" data-open="card:${i.id}" title="Comments for Claude">${ic('ai')}</button></div>`).join('')):'')
   +(xFix().length?sec('x:fix','Fixed',xFix().length,xFix().map(i=>`<div class="row xrow" data-xgo="x-${i.cid}"><span class="rt">${sideTitle(i.title)}</span>${VIEW?'':`<button class="chip" data-unfix="${i.cid}">Reopen</button>`}</div>`).join('')):'')
   +(Dl.length?sec('x:del','Deleted',Dl.length,Dl.map(i=>`<div class="row xrow" data-xgo="x-${i.cid}">${unread(i)?`<button class="nd" data-read="${i.cid}" title="Unread — click to mark read"></button>`:''}<span class="rt">${sideTitle(i.title)}</span><button class="chip" data-restore="${i.cid}">Restore</button><button class="ib" data-purge1="${i.cid}" title="Delete for good">${ic('trash')}</button></div>`).join(''),`<button class="chip danger xsdall" data-delallc title="Delete all for good">Delete all</button>`):'')}
function purge(ids){const g=S.deleted.filter(i=>ids.includes(i.cid));S.deleted=S.deleted.filter(i=>!ids.includes(i.cid));render();const t=setTimeout(()=>{post('api/removed/purge',{cids:ids});S.comments=S.comments.filter(c=>!ids.includes(c.target.replace(/^card:/,'')));render()},10000);
  toast(`Deleted ${g.length} for good`,()=>{clearTimeout(t);S.deleted.push(...g);render()})}
window.addEventListener('click',e=>{
  const p1=e.target.closest('[data-purge1]');if(p1){e.stopImmediatePropagation();e.preventDefault();purge([p1.dataset.purge1]);return}
  const pa=e.target.closest('[data-delallc]');if(pa){e.stopImmediatePropagation();e.preventDefault();const ids=S.deleted.map(i=>i.cid);confirmBox(`Delete all ${ids.length} for good? Their comments go too.`,'Delete all',()=>purge(ids));return}
  const xt=e.target.closest('[data-xltog]');if(xt&&!e.target.closest('button')){e.stopImmediatePropagation();const k=xt.dataset.xltog;S.openSecs.has(k)?S.openSecs.delete(k):S.openSecs.add(k);render();return}
  const xg=e.target.closest('[data-xgo]');if(xg&&!e.target.closest('button')){e.stopImmediatePropagation();const k=xg.closest('[data-secw]')?.dataset.secw,id=xg.dataset.xgo;/* open the section on the canvas too, so the card has a place to pan to */if(k){S.openSecs.add(k);if(document.querySelector(`[data-xl="${k}"]`)?.classList.contains('shut'))render()}requestAnimationFrame(()=>requestAnimationFrame(()=>{select(id,false);goTo(id,true)}));return}
},true);

// ---- your view is yours: filters, zoom, selection, open sections and tab survive updates and reloads (per canvas, in this browser)
const VIEWK='qaView:'+location.pathname;
function viewState(){return {x:S.x,y:S.y,z:S.z,sel:S.sel,tab:S.tab==='new'?'issues':S.tab,popT:document.getElementById('pop').classList.contains('open')?S.popT:null,fp:[...S.fp],ftag:[...(S.ftag||[])],unread:!!S.unreadOnly,open:[...(S.openSecs||[])],res:!!S.resOpen,ib:S.ibShut?[...S.ibShut]:null}}
function saveView(){try{localStorage[VIEWK]=JSON.stringify(viewState())}catch{}}
function readView(){try{return JSON.parse(localStorage[VIEWK]||sessionStorage.qaView||'null')}catch{return null}finally{delete sessionStorage.qaView}}
function applyView(v,move){S.fp=new Set(v.fp||[]);S.ftag=new Set(v.ftag||[]);S.unreadOnly=!!v.unread;if(v.open)S.openSecs=new Set(v.open);S.resOpen=!!v.res;if(v.ib)S.ibShut=new Set(v.ib);
  const tab=v.tab||'issues';S.tab=tab==='issues'&&S.unreadOnly?'new':tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
  if(move&&v.z){S.z=v.z;S.x=v.x;S.y=v.y}render();paint();if(v.sel&&document.getElementById('c-'+v.sel))select(v.sel,false);
  if(v.popT&&move){S.popT=v.popT;openPop(v.popT,document.querySelector(`.row[data-cid="${v.popT.replace('card:','')}"]`))}}
addEventListener('beforeunload',saveView);setInterval(saveView,4000);
// ---- updates arrive in place (like a shared doc): the new data replaces the old and your view stays; only a template change reloads the page
async function hotUpdate(){if(ASFILE)return false;let html;try{html=await (await fetch(location.pathname+'?_='+Date.now(),{cache:'no-store'})).text()}catch{return false}
  const doc=new DOMParser().parseFromString(html,'text/html'),code=doc.querySelector('meta[name="canvas-code"]')?.content,mine=document.querySelector('meta[name="canvas-code"]')?.content;
  if(!code||code!==mine)return false;let nd;try{nd=JSON.parse(doc.getElementById('qa-data').textContent)}catch{return false}
  const sig=i=>[i.title,i.what||i.out,i.img,i.section].join('\u0001'),before=new Map(S.items.map(i=>[i.cid,sig(i)])),v=viewState();
  Object.keys(D).forEach(k=>delete D[k]);Object.assign(D,nd);await load();applyView(v,true);
  let add=0,upd=0;S.items.forEach(i=>{if(!before.has(i.cid))add++;else if(before.get(i.cid)!==sig(i))upd++});const gone=[...before.keys()].filter(c=>!S.items.some(i=>i.cid===c)).length;
  const parts=[add&&`${add} added`,upd&&`${upd} updated`,gone&&`${gone} removed`].filter(Boolean);if(parts.length)toast('Canvas updated · '+parts.join(' · '));return true}

// ---- flip a card to its design reference / previous screenshot; survives redraws. The box keeps the screenshot's size: a smaller design sits at its bottom, a bigger one may grow it
function showPrev(it,on,again){const c=document.getElementById('c-'+it.cid)?.closest('.card'),im=c?.querySelector('.shot');if(!im)return;c.classList.toggle('showprev',on);
  const clear=()=>{im.style.height='';im.style.objectFit='';im.style.objectPosition='';im.style.aspectRatio=''};
  if(!on){im.onload=null;im.src=it.img;clear();return}
  const fit=()=>{const w=im.offsetWidth,h=S.prevH?.[it.cid]||im.offsetHeight,nh=w*im.naturalHeight/(im.naturalWidth||1);if(nh<=h+1){im.style.height=h+'px';im.style.objectFit='contain';im.style.objectPosition='center bottom'}else{im.style.height='';im.style.objectFit='';im.style.objectPosition=''}im.style.aspectRatio='auto'};
  if(!again){S.prevH=S.prevH||{};S.prevH[it.cid]=im.offsetHeight}if(S.prevH?.[it.cid])im.style.height=S.prevH[it.cid]+'px';
  im.onload=()=>{im.onload=null;fit()};im.src=it.prev.img;if(im.complete&&im.naturalWidth&&im.getAttribute('src')===it.prev.img)fit()}

window.addEventListener('click',e=>{const b=e.target.closest('[data-tresg]');if(!b)return;e.stopImmediatePropagation();e.preventDefault();if(b.disabled)return;
  const ids=b.dataset.tresg.split(','),gone=S.comments.filter(c=>ids.includes(c.id));S.comments=S.comments.filter(c=>!ids.includes(c.id));render();gone.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:true}));
  toast(`Archived ${gone.length} chat${gone.length>1?"s":""}`,()=>{S.comments.push(...gone);render();gone.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:false}))})},true);


// ---- Fixed: the user marks an issue (or every issue on a screenshot) fixed; it moves to the Fixed section, Reopen brings it back
function setFixed(ids,on){/* like delete: if the selected issue goes, move to the next one (or the previous at the end) */let nx=null;if(on&&ids.includes(S.sel)){const L=ordered().flatMap(g=>g.items.map(i=>i.cid)),k=L.indexOf(S.sel);nx=L.slice(k+1).find(c=>!ids.includes(c))||L.slice(0,k).reverse().find(c=>!ids.includes(c))||null}const mv=on?S.items.filter(i=>ids.includes(i.cid)):(S.fixedItems||[]).filter(i=>ids.includes(i.cid));if(!mv.length)return;
  S.fixedItems=S.fixedItems||[];if(on){S.items=S.items.filter(i=>!ids.includes(i.cid));S.fixedItems.push(...mv);ids.forEach(c=>S.fixed.add(c))}else{S.fixedItems=S.fixedItems.filter(i=>!ids.includes(i.cid));S.items.push(...mv);ids.forEach(c=>S.fixed.delete(c))}
  render();if(nx)stepTo(null,nx);else if(on&&ids.includes(S.sel))S.sel=null;post('api/fixed',{cids:ids,fixed:on});toast(on?(mv.length>1?`${mv.length} issues marked fixed`:'Marked fixed'):'Reopened',()=>setFixed(ids,!on))}
window.addEventListener('click',e=>{const f=e.target.closest('[data-fix]');if(f){e.stopImmediatePropagation();e.preventDefault();setFixed(f.dataset.fix.split(','),true);return}
  const u=e.target.closest('[data-unfix]');if(u){e.stopImmediatePropagation();e.preventDefault();setFixed([u.dataset.unfix],false)}},true);

// ---- Enter edits the selected issue (also deleted / fixed ones); Esc or ⌘Enter saves
addEventListener('keydown',e=>{if(e.key!=='Enter'||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||e.repeat||VIEW)return;if(e.target.closest?.('input,textarea,[contenteditable=true]')||document.querySelector('.cfm')||!document.getElementById('menu').hidden||document.getElementById('pop').classList.contains('open'))return;
  const el=S.sel&&document.getElementById('c-'+S.sel),box=el&&(el.closest('.gi')||el.closest('.card')),T=box?.querySelector('.ttl[data-ed]');if(!T)return;e.preventDefault();editCard({target:T,clientX:-1,clientY:-1})});

// an empty text box doesn't hold the arrow keys: ← → leave it and move to the previous / next screen
function busyField(e){const f=e.target.closest?.('input,textarea,[contenteditable=true]');if(!f)return false;if(String(f.value??f.textContent).trim())return true;f.blur();return false}

/* page title: double-click the canvas heading (or the side pane's) to rename; Enter or Esc saves */
document.addEventListener('dblclick',e=>{const h=e.target.closest('[data-ptitle],#ttl');if(!h||h.isContentEditable||document.documentElement.classList.contains('view'))return;e.preventDefault();e.stopPropagation();const before=h.textContent;h.contentEditable='true';h.focus();getSelection().selectAllChildren(h);
  const end=()=>{h.contentEditable='false';h.removeEventListener('keydown',k);h.removeEventListener('blur',end);const v=h.textContent.trim();if(!v||v===before){h.textContent=before;return}
    D.title=v;document.getElementById('ttl').textContent=v;document.title=v;render();post('api/edit',{section:{from:'__title__',to:v}});toast('Title renamed')};
  const k=ev=>{if(ev.key==='Enter'||ev.key==='Escape'){ev.preventDefault();end()}};h.addEventListener('keydown',k);h.addEventListener('blur',end)},true);

/* chip rows (filters, To-dos tabs) stay on one line so the list below never shifts; chips that don't fit fold into "+N", which opens the rest on the next line */
function fitChips(){requestAnimationFrame(()=>document.querySelectorAll('#list .bulk,#list .subtabs').forEach(r=>{const key=r.classList.contains('bulk')?'bulk':'subtabs';r.querySelector('[data-chipmore]')?.remove();[...r.children].forEach(c=>c.hidden=false);
  const open=S.chipOpen?.has(key);r.classList.toggle('chipopen',!!open);if(open){r.insertAdjacentHTML('beforeend','<button class="chip chipmore" data-chipmore title="Show fewer">Less</button>');return}
  const W=r.clientWidth-parseFloat(getComputedStyle(r).paddingRight||0),kids=[...r.children];if(kids.every(c=>c.offsetLeft+c.offsetWidth<=W+1))return;
  const more=document.createElement('button');more.className='chip chipmore';more.dataset.chipmore='';r.append(more);let hid=0;
  for(let i=kids.length-1;i>=0;i--){more.textContent='+'+(hid||1);const last=kids.filter(c=>!c.hidden).pop();if(!last||last.offsetLeft+last.offsetWidth+more.offsetWidth+6<=W)break;last.hidden=true;hid++}
  more.textContent='+'+hid;more.title=`${hid} more`;}))}
document.addEventListener('click',e=>{const m=e.target.closest('[data-chipmore]');if(!m)return;e.stopPropagation();const r=m.parentElement,key=r.classList.contains('bulk')?'bulk':'subtabs';S.chipOpen=S.chipOpen||new Set();S.chipOpen.has(key)?S.chipOpen.delete(key):S.chipOpen.add(key);fitChips()},true);
if(window.ResizeObserver)new ResizeObserver(()=>fitChips()).observe(document.getElementById('sb')||document.body);
