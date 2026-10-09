
const D=JSON.parse(document.getElementById('qa-data').textContent),PORT=D.port||4200,Q=new URLSearchParams(location.search);
// opened from disk (file://) -> talk to the local server directly; ?asfile=1 / ?offline=1 preview those states
const ASFILE=location.protocol==='file:'||Q.has('asfile'),API=location.protocol==='file:'?`http://localhost:${PORT}/`:'';
const ic=(n,s='')=>`<svg class="i" ${s}><use href="#i-${n}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function srvState(){const b=document.getElementById('srv');if(!b)return;const off=S.offline||Q.has('offline');
  b.innerHTML=off?`<div class="srv warn"><b>${ASFILE?'Nothing is running on localhost:'+PORT:'The canvas server has stopped'}</b><span>Comments you write are kept in this browser and sent when it's back.</span><button data-copymsg>Copy message for Claude</button></div>`
   :ASFILE?`<div class="srv ok"><span class="dot"></span>Opened from disk · server live on localhost:${PORT}<a href="http://localhost:${PORT}/" target="_blank" rel="noopener">Open there ↗</a></div>`:'';
  b.hidden=!b.innerHTML;document.getElementById('srvToast').hidden=!(off&&S.touchedComments)}
const PL={high:'High',med:'Med',low:'Low'},PS={high:'H',med:'M',low:'L'};const num=i=>S.showIds?(i.n??i.sn):'#'+i.sn;   // list position gets a # so it never reads as an ID
const rk=i=>S.rank?.[i.cid]??S.items.indexOf(i);
function sortByPriority(){const r={};S.sections.forEach(sec=>S.items.filter(i=>i.section===sec).map((i,k)=>[i,k]).sort((a,b)=>RANK[pr(a[0])]-RANK[pr(b[0])]||rk(a[0])-rk(b[0])).forEach(([i],k)=>r[i.cid]=k));S.rank=r;render();if(S.sel)select(S.sel,false);toast('Sorted by priority')}
const RANK={high:0,med:1,low:2},OPEN=new Set(['gap','ux','ctx']);
const KIND={gap:'Dev ≠ design',ux:'Question',dec:'Decided',later:'Later',ctx:'Needs context'};
const FLOW=D.mode==='flow';
let S={items:[],sections:[],prio:{},comments:[],inbox:[],tab:FLOW?'inbox':'issues',sel:null,openOnly:false,fp:new Set(),fk:new Set(),fh:false,collapsed:new Set(),z:.5,x:0,y:0};
S.showIds=localStorage.qaShowIds!=='0';   // Show IDs (default on): permanent numbers; off = position in the current list

async function load(){
  const j=u=>fetch(API+u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(u);return r.json()});
  let p={},c={comments:[]},inb={items:[]},stt={seen:[]},ed={},rm={},sg={};
  try{[p,c,inb,stt,ed,rm,sg,ad]=await Promise.all(['api/priorities','api/comments','api/inbox','api/state','api/edit','api/removed','api/suggestions','api/added'].map(j))}catch{S.offline=true}
  const ren=ed.sections||{};document.getElementById('ttl').textContent=D.title;document.title=D.title;
  S.sections=D.sections.map(x=>ren[x]||x);
  const mk=i=>{const e=ed[i.cid]||{},acc=(i.sugg||[]).filter(([id])=>sg[id]==='accepted').map(([,t])=>'• '+t.replace(/^<b>[^<]*<\/b>\s*/,''));
    const what=(e.what??i.what??'');return {...i,screen:e.screen!==undefined?e.screen:(i.screen||''),section:ren[i.section]||i.section,title:e.title??i.title,out:e.out??i.out,
      what:acc.length&&!e.what?(what?what+'<br>':'')+acc.join('<br>'):what,sugg:(i.sugg||[]).filter(([id])=>!sg[id]).map(([,t])=>t),sids:(i.sugg||[]).filter(([id])=>!sg[id]).map(([id])=>id),...(!FLOW&&i.ref?{prev:{img:i.ref,label:i.refLabel||'',ref:true}}:{})}};
  if(FLOW){D.issues=D.steps}else if(ad?.items?.length){/* issues the user added by hand */D.issues=D.issues.concat(ad.items.filter(a=>!D.issues.some(i=>i.cid===a.cid)))}
  S.mk=mk;
  S.items=D.issues.filter(i=>!rm[i.cid]).map(mk);S.deleted=D.issues.filter(i=>rm[i.cid]&&!rm[i.cid].purged).map(mk);
  if(Q.has('offline'))S.offline=true;S.prio=p;S.seen=new Set(stt.seen||[]);S.readLocal=new Set();S.comments=c.comments||[];S.inbox=(inb.items||[]).filter(x=>!x.deleted&&!x.resolved);
  if(FLOW)flowLayout();S._c=JSON.stringify(S.comments);S.openSecs=new Set(S.sections);render();fit();srvState();flushOutbox();
}
const OUTBOX='qa-outbox:'+location.pathname;
async function post(u,body,{method='POST',asUser=true}={}){const req={method,headers:{'Content-Type':'application/json',...(asUser?{'X-Actor':'User'}:{})},body:JSON.stringify(body)};
  S.inflight=(S.inflight||0)+1;/* keepalive + inflight: a live reload never drops a save mid-send */
  try{const r=await fetch(API+u,{...req,keepalive:true});if(!r.ok)throw new Error(r.status);S.inflight--;S.offline=false;srvState();return await r.json()}
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
  if(S.openOnly&&!OPEN.has(it.kind))return false;
  if(S.fp.size&&!S.fp.has(pr(it)))return false;
  if(S.fk.size&&!S.fk.has(it.kind))return false;
  if(S.fh&&!it.hl)return false;return true;
}
// effective graph: a deleted step's predecessors connect straight to its successors; a deleted origin just drops (its successors become origins)
function flowLayout(){const ids=new Set(S.items.map(i=>i.cid));let E=(D.edges||[]).map(e=>[String(e[0]),String(e[1]),e[2]?String(e[2]):'']);
  for(const x of D.steps.map(i=>i.cid).filter(c=>!ids.has(c))){const P=E.filter(e=>e[1]===x).map(e=>e[0]),Q=E.filter(e=>e[0]===x).map(e=>e[1]);E=E.filter(e=>e[0]!==x&&e[1]!==x);for(const a of P)for(const b of Q)if(a!==b&&!E.some(e=>e[0]===a&&e[1]===b))E.push([a,b,''])}
  S.E=E;const par={};const f=x=>par[x]===x?x:(par[x]=f(par[x]));S.items.forEach(i=>par[i.cid]=i.cid);E.forEach(([a,b])=>{par[f(a)]=f(b)});
  const comp={};S.items.forEach(i=>(comp[f(i.cid)]=comp[f(i.cid)]||[]).push(i));
  const depth={};const preds=c=>E.filter(e=>e[1]===c).map(e=>e[0]);const dep=(c,seen=new Set())=>{if(depth[c]!=null)return depth[c];if(seen.has(c))return 0;seen.add(c);const p=preds(c);return depth[c]=p.length?1+Math.max(...p.map(x=>dep(x,seen))):0};
  S.items.forEach(i=>dep(i.cid));S.rank={};S.sections=[];let k=0;
  Object.values(comp).sort((a,b)=>D.steps.findIndex(x=>x.cid===a[0].cid)-D.steps.findIndex(x=>x.cid===b[0].cid)).forEach(g=>{
    g.sort((a,b)=>depth[a.cid]-depth[b.cid]||D.steps.findIndex(x=>x.cid===a.cid)-D.steps.findIndex(x=>x.cid===b.cid));
    const o=g[0],name=(D.flowNames||{})[o.cid]||o.flow||o.title.replace(/<[^>]+>/g,'');let nm=name,j=2;while(S.sections.includes(nm))nm=name+' ('+(j++)+')';
    S.sections.push(nm);g.forEach(i=>{i.section=nm;i.depth=depth[i.cid];S.rank[i.cid]=k++})})}
function drawArrows(){if(!FLOW)return;document.querySelectorAll('.fl').forEach(fl=>{const sv=fl.querySelector('svg.arrows'),z=S.z||1,o=fl.getBoundingClientRect();sv.setAttribute('width',fl.scrollWidth);sv.setAttribute('height',fl.scrollHeight);
  const pt=(id,side)=>{const e=document.querySelector(`#c-${id} .shot,#c-${id} .noshot`);if(!e||!fl.contains(e))return null;const r=e.getBoundingClientRect();return {x:((side?r.right:r.left)-o.left)/z,y:((r.top+r.bottom)/2-o.top)/z}};
  sv.innerHTML=(S.E||[]).map(([a,b,l])=>{const p=pt(a,1),q=pt(b,0);if(!p||!q)return '';const L=16,ax=p.x+6,bx=q.x-L,dx=Math.max(24,(bx-ax)/2),mx=(p.x+q.x)/2,my=(p.y+q.y)/2;
    return `<path d="M${p.x} ${p.y} L${ax} ${p.y} C${ax+dx} ${p.y} ${bx-dx} ${q.y} ${bx} ${q.y} L${q.x-1} ${q.y}" fill="none" stroke="#8F887E" stroke-width="1.6" stroke-linecap="round"/><path d="M${q.x-11} ${q.y-4.5} L${q.x-1} ${q.y} L${q.x-11} ${q.y+4.5}" fill="none" stroke="#8F887E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`+(l?`<text class="elabel" x="${mx}" y="${my-6}" text-anchor="middle">${esc(l)}</text>`:'')}).join('')})}
/* issues sharing a screenshot stay together (placed where the first of them ranks), so stepping finishes one screenshot before the next */
function byScreen(arr){if(FLOW)return arr;const m=new Map();arr.forEach(i=>{const k=i.screen?'s:'+i.screen:'#'+i.cid;(m.get(k)||m.set(k,[]).get(k)).push(i)});return [...m.values()].flat()}
function ordered(){ // per section, highest priority first; one serial across the canvas
  let n=0;return S.sections.map(s=>({s,items:byScreen(S.items.filter(i=>i.section===s&&visible(i)).sort((a,b)=>rk(a)-rk(b))).map(i=>(i.sn=++n,i))})).filter(g=>g.items.length);
}
function ccBadge(t){const th=threads(t);if(!th.length)return'';const todo=th.some(c=>st(c)!=='done');return `<span class="cc ${todo?'todo':''}">${ic('msg')}${th.length}</span>`}
function render(){
  const groups=ordered(),all=groups.flatMap(g=>g.items);
  const open=S.items.filter(i=>OPEN.has(i.kind)).length,hi=S.items.filter(i=>OPEN.has(i.kind)&&pr(i)==='high').length;
  const todo=S.comments.filter(c=>!c.resolved&&st(c)!=='done').length;
  void `<span><b>${open}</b> open</span><span><b style="color:var(--high)">${hi}</b> high</span><span><b>${todo}</b> comments to do</span>`;
  document.getElementById('cI').textContent=all.length;document.getElementById('cN').textContent=all.filter(unread).length;document.getElementById('cD').textContent=(S.deleted||[]).length;document.querySelector('[data-tab="deleted"]').hidden=!(S.deleted||[]).length&&S.tab!=='deleted';requestAnimationFrame(fitTabs);
  const waiting=S.inbox.filter(i=>!i.processed).length;const cIn=document.getElementById('cIn');{/* To-dos badge: "completed · in progress", or just completed when nothing is in progress */const op=S.comments.filter(c=>!c.resolved),shot=t=>S.inbox.some(i=>'card:'+i.id===t);let dn=0,td=0;op.filter(c=>!shot(c.target)).forEach(c=>st(c)==='done'?dn++:td++);S.inbox.forEach(i=>{const th=op.filter(c=>c.target==='card:'+i.id);(i.processed&&th.every(c=>st(c)==='done'))?dn++:td++});cIn.textContent=td?`${dn} · ${td}`:dn;cIn.title=`${dn} completed${td?` · ${td} in progress`:''}`}cIn.className='c'+(waiting?' blue':'');
  document.getElementById('fdot').hidden=!S.fp.size;
  const L=document.getElementById('list');
  if(S.tab==='issues'){
    L.innerHTML=groups.map(g=>{const op=S.openSecs.has(g.s);return `<div class="secw ${op?'open':''}" data-secw="${esc(g.s)}"><div class="sec" data-sec="${esc(g.s)}">${ic('chev')}<span class="stt" data-secname="${esc(g.s)}">${g.s}</span><span class="n">${g.items.length}</span></div>`+
      `<div class="secb"><div class="secin">`+g.items.map(i=>`<div class="row ${S.sel===i.cid?'sel':''}" data-cid="${i.cid}"><span class="sn">${num(i)}</span><button class="pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button>${unread(i)?`<button class="nd" data-read="${i.cid}" title="Unread — click to mark read"></button>`:''}<span class="rt" data-rted="${i.cid}">${i.title.replace(/<[^>]+>/g,'')}</span><span class="ra"><button class="ib" data-menu="${i.cid}" title="More">${ic('more')}</button></span>${(()=>{const th=threads('card:'+i.cid),todo=th.some(c=>st(c)!=='done');return `<button class="ib cmb ${th.length?'has':''} ${todo?'todo':''}" data-open="card:${i.cid}" title="Comments">${ic('msg')}${th.length?`<em>${th.length}</em>`:''}</button>`})()}</div>`).join('')+`</div></div></div>`}).join('')||`<div class="empty">Nothing matches these filters.</div>`;
  }else if(S.tab==='new'){const nu=all.filter(unread);
    L.innerHTML=nu.length?nu.map(i=>`<div class="row ${S.sel===i.cid?'sel':''}" data-cid="${i.cid}"><span class="sn">${num(i)}</span><button class="pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button><button class="nd" data-read="${i.cid}" title="Unread — click to mark read"></button><span class="rt" data-rted="${i.cid}">${i.title.replace(/<[^>]+>/g,'')}</span><span class="ra"><button class="ib" data-menu="${i.cid}" title="More">${ic('more')}</button></span>${(()=>{const th=threads('card:'+i.cid),ai=th.some(t=>(t.thread||[]).at(-1)?.by==='Claude');return `<button class="ib cmb ${th.length?'has':''} ${ai?'ai':''}" data-open="card:${i.cid}" title="${ai?'Claude replied — this is why it shows as new':'Comments'}">${ic('msg')}${th.length?`<em>${th.length}</em>`:''}</button>`})()}</div>`).join(''):`<div class="empty">Nothing new — you've read everything.</div>`;
  }else if(S.tab==='inbox'){
    const sn=Object.fromEntries(ordered().flatMap(g=>g.items).map(i=>[i.cid,num(i)]));
    const open=S.comments.filter(c=>!c.resolved),isShot=t=>S.inbox.some(i=>'card:'+i.id===t);
    const nm=c=>{const t=c.target;if(t==='page')return '<span class="rt">General</span>';const id=t.replace(/^card:|^lane:/,''),it=S.items.find(i=>i.cid===id);
      return it?`<span class="sn">${num(it)}</span><span class="rt">${it.title.replace(/<[^>]+>/g,'')}</span>`:`<span class="rt">${esc(c.title||'Removed issue')}</span>`};
    const msgs=c=>{const me=c.thread.filter(m=>m.by!=='Claude').slice(-1)[0],cl=c.thread.filter(m=>m.by==='Claude').slice(-1)[0];
      return (me?`<div class="l2 u">${esc(me.text)}</div>`:'')+(cl?`<div class="l2"><b>Claude:</b> ${esc(cl.text)}</div>`:'')};
    // actions, right to left: Resolve (enabled once Claude is done) · Chat · Delete (new screenshots only)
    const res=(attr,done)=>`<button class="oa ok res ${done?'on':''}" ${attr} ${done?'':'disabled'} title="${done?'Resolve — clears this thread':'Resolve — available once Claude has worked on it'}">${ic('check')}</button>`;
    const pill=c=>st(c)==='inprogress'?'<span class="st inprogress">In progress</span>':'';
    const items=[];
    open.filter(c=>!isShot(c.target)).forEach(c=>items.push({k:st(c),at:c.createdAt,h:`<div class="task" data-task="${c.target}"><div class="th1">${nm(c)}${pill(c)}</div>${msgs(c)}
        <div class="ovr tr"><button class="oa" data-open="${c.target}" title="Chat">${ic('msg')}</button>${res(`data-tres="${c.id}"`,st(c)==='done')}</div></div>`}));
    S.inbox.forEach(i=>{const th=open.filter(c=>c.target==='card:'+i.id),p=S.prio[i.id]||'low',done=!!i.processed&&th.every(c=>st(c)==='done');
      items.push({k:done?'done':th.some(c=>st(c)==='inprogress')?'inprogress':'todo',at:i.at,h:`<div class="irow" ${i.issue&&sn[i.issue]?`data-goto="${i.issue}"`:''}><div class="iimg"><img src="${esc(i.file)}">
        <div class="lacts"><button class="a pp ${p}" data-prio="${i.id}" title="${PL[p]} priority — click to change">${PS[p]}</button></div>
        <div class="ovr br"><button class="oa" data-idel="${i.id}" title="Delete — taken by mistake">${ic('trash')}</button><button class="oa" data-open="card:${i.id}" title="Chat">${ic('msg')}</button>${res(`data-ires="${i.id}"`,done)}</div></div>
        <div class="l2 meta2">${i.processed?(sn[i.issue]?'Became issue '+sn[i.issue]+' · <span class="lk">Show on canvas →</span>':'Added as an issue'):'Screenshot lined up to be assessed'}</div>
        ${th.map(c=>`<div class="ithread" data-task="${c.target}">${pill(c)}${msgs(c)}</div>`).join('')}</div>`})});
    // order: what Claude is on now, then in the order it will pick things up (oldest first)
    const done=items.filter(x=>x.k==='done'),todo=items.filter(x=>x.k!=='done').sort((x,y)=>(x.k==='inprogress'?0:1)-(y.k==='inprogress'?0:1)||String(x.at).localeCompare(String(y.at)));
    const grp=(key,title,arr,empty)=>`<div class="secw ${S.openSecs.has('ib:'+key)?'open':''}" data-secw="ib:${key}"><div class="sec" data-sec="ib:${key}">${ic('chev')}<span class="stt">${title}</span><span class="n">${arr.length}</span></div><div class="secb"><div class="secin">${arr.map(x=>x.h).join('')||`<div class="ihint">${empty}</div>`}</div></div></div>`;
    if(!S.ibInit){S.ibInit=1;S.openSecs.add('ib:done');S.openSecs.add('ib:todo')}
    /* sub-tabs: Completed · In progress · Resolved — each hidden when empty */
    const subs=[['done','Completed',done.length],['todo','In progress',todo.length],['resolved','Resolved',(S.resolved||[]).length]].filter(x=>x[2]);
    if(!subs.some(x=>x[0]===S.sub))S.sub=subs[0]?.[0];
    const body=S.sub==='done'?done.map(x=>x.h).join(''):S.sub==='todo'?todo.map(x=>x.h).join(''):S.sub==='resolved'?resolvedHTML():'';
    L.innerHTML=subs.length?`<div class="subtabs">${subs.map(([k,l,n])=>`<button class="subtab ${S.sub===k?'on':''}" data-sub="${k}">${l} <span class="c">${n}</span></button>`).join('')}</div>`+body:'<div class="empty">Nothing here yet. Comments and new screenshots show up here.</div>';
  }else if(S.tab==='resolved'){L.innerHTML=resolvedHTML();
  }else{
    L.innerHTML=(S.deleted||[]).length?`<div class="delbar"><span>${S.deleted.length} waiting to be deleted</span><button class="chip danger" data-delall>Delete all</button></div>`+S.deleted.map(i=>`<div class="row drow" ${i.img?`data-exp="${esc(i.img)}" title="Open the screenshot"`:''}>${i.img?`<img class="dthumb" src="${esc(i.img)}" alt="">`:''}<span class="rt">${i.title.replace(/<[^>]+>/g,'')}</span><button class="chip" data-restore="${i.cid}">Restore</button></div>`).join(''):`<div class="empty">${ic('trash')}<br><b>Nothing deleted</b><br>When Claude deletes an issue it moves here with its thread, and stays until you resolve that thread. You can restore it from here.</div>`;
  }
  const W=document.getElementById('world');
  W.innerHTML=`<div class="hdr"><h1>${esc(document.getElementById('ttl').textContent)}</h1></div>`+(FLOW?groups.map(g=>{const cols=[];g.items.forEach(i=>(cols[i.depth]=cols[i.depth]||[]).push(i));return `<section class="lane flow"><h2><b class="lt" data-secname="${esc(g.s)}">${g.s}</b><span>${g.items.length} step${g.items.length>1?'s':''}</span></h2><div class="fl"><svg class="arrows"></svg>${cols.filter(Boolean).map(c=>`<div class="fcol">${c.map(card).join('')}</div>`).join('')}</div></section>`}).join('')
      :groups.map(g=>`<section class="lane"><h2><b class="lt" data-secname="${esc(g.s)}">${g.s}</b><span>${g.items.length}</span></h2><div class="grid">${units(g.items)}</div></section>`).join(''));requestAnimationFrame(drawArrows);
;document.querySelectorAll('[data-sgbar]').forEach(b=>sgBar(b.dataset.sgbar));bulkBar(all);requestAnimationFrame(markStuck);requestAnimationFrame(fitAll)}
const LH=1.45,LINES=2;
function clampH(el){return Math.ceil(parseFloat(getComputedStyle(el).fontSize)*LH*LINES)}
function fitAll(){document.querySelectorAll('.body[data-body]').forEach(el=>{const it=S.items.find(i=>i.cid===el.dataset.body)||S.deleted?.find(i=>i.cid===el.dataset.body);const o=!!(it&&it.expanded);el.classList.toggle('shut',!o);el.style.maxHeight='';el.closest('.gi,.card')?.querySelector(`[data-more="${el.dataset.body}"]`)?.classList.toggle('up',o)})}
function syncSecs(cid){document.querySelectorAll('.secw').forEach(w=>w.classList.toggle('open',S.openSecs.has(w.dataset.secw)));
  if(cid)setTimeout(()=>document.querySelector(`.row[data-cid="${cid}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'}),240)}
function closeMenu(){const M=document.getElementById('menu');M.hidden=true;M.dataset.for=''}
function placeMenu(M,btn){S.menuAnchor=btn;M.hidden=false;const r=btn.getBoundingClientRect();M.style.left=Math.min(r.left,innerWidth-200)+'px';M.style.top=(r.bottom+4+M.offsetHeight>innerHeight?r.top-M.offsetHeight-4:r.bottom+4)+'px'}
function openPicker(cid,btn){const M=document.getElementById('menu'),p=pr({cid});M.className='picker';
  M.innerHTML=['high','med','low'].map(v=>`<button data-pick="${v}" class="pp ${v} ${p===v?'on':''}" title="${PL[v]}">${PS[v]}</button>`).join('');M.dataset.for=cid;placeMenu(M,btn)}
function openMenu(cid,btn){const M=document.getElementById('menu'),it=S.items.find(i=>i.cid===cid);M.className='';
  const inG=!!document.getElementById('c-'+cid)?.closest('.grp');
  M.innerHTML=(inG?`<button data-mi="split">${ic('split')}Move to its own card</button>`:`<button data-mi="combine">${ic('merge')}Combine with another card…</button>`)+`<hr><button data-mi="read">${ic('dot')}${unread(it)?'Mark as read':'Mark as unread'}</button><hr><button data-mi="del" class="danger">${ic('trash')}Delete issue</button>`;
  M.dataset.for=cid;placeMenu(M,btn)}
function menuAct(a,v){const cid=document.getElementById('menu').dataset.for,it=S.items.find(i=>i.cid===cid);closeMenu();
  if(a==='prio'){S.prio[cid]=v;render();toast('Priority set to '+PL[v]+'')}
  else if(a==='edit'){const h=document.querySelector(`#c-${cid} .ttl`);h?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))}
  else if(a==='split'){const was=it.screen;it.screen='';render();post('api/edit',{cid,screen:''});toast('Moved to its own card',()=>{it.screen=was;render();post('api/edit',{cid,screen:was})})}
  else if(a==='combine'){const M=document.getElementById('menu'),others=S.items.filter(x=>x.section===it.section&&x.cid!==cid&&(!x.screen||x.screen!==it.screen));
    M.innerHTML=`<div class="mh">Show on the same card as…</div>`+others.map(x=>`<button data-comb="${x.cid}"><span class="snt">${num(x)}</span> ${x.title.replace(/<[^>]+>/g,'').slice(0,46)}</button>`).join('')||'<div class="mh">No other cards in this section</div>';M.hidden=false;M.dataset.for=cid;return}
  else if(a==='read'){const was=unread(it);if(was)S.readLocal.add(cid);else{S.readLocal.delete(cid);S.seen.delete(cid)}render();post('api/state',{cid,new:!was})}
  else if(a==='del'){S.items=S.items.filter(i=>i!==it);if(FLOW)flowLayout();(S.deleted=S.deleted||[]).push(it);render();post('api/removed',{cid,removed:true,title:it.title.replace(/<[^>]+>/g,''),n:String(it.n||'')});toast(FLOW?'Step deleted — flow reconnected':'Moved to Deleted',()=>{S.deleted=S.deleted.filter(x=>x!==it);S.items.push(it);if(FLOW)flowLayout();render();post('api/removed',{cid,removed:false})})}}
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
const hasDet=i=>[i.out,i.what].map(trimHtml).some(Boolean);
function addBtn(i){return FLOW?'':`<button class="a hv" data-addiss="${i.cid}" title="Add an issue on this screenshot">${ic('plus')}</button>`}
function hoverActs(i,cls){const T=threads('card:'+i.cid),n=T.length,ai=T.some(t=>(t.thread||[]).at(-1)?.by==='Claude');return `<span class="${cls}">${cls==='acts'?addBtn(i):''}${i.prev?`<button class="a hv cmp" data-cmp="${i.cid}" title="${i.prev.ref?'Show the design reference (Alt)':'Compare with the previous screenshot (Alt)'}${i.prev.label?' ('+esc(i.prev.label)+')':''}">${ic(i.prev.ref?'image':'history')}</button>`:''}<button class="a hv" data-menu="${i.cid}" title="More">${ic('more')}</button><button class="a hv del" data-del="${i.cid}" title="Delete issue">${ic('trash')}</button><button class="a cmi ${n?'has':'hv'} ${ai?'ai':''}" data-open="card:${i.cid}" title="Comments">${ic('msg')}${n?`<em>${n}</em>`:''}</button></span>`}
/* a thread moved from this issue to the one it is now about leaves a link behind */
function movedNote(i){const m=S.comments.filter(c=>c.movedFrom==='card:'+i.cid&&!c.resolved);if(!m.length)return '';const to=m[0].target.slice(5),it=(S.items||[]).find(x=>x.cid===to);return `<button class="moved" data-goto="${to}">${m.length>1?m.length+' comments':'Comment'} moved to ${it?num(it)+' · '+esc(it.title):to} →</button>`}
function issueRow(i){return `<div class="trow"><h3><span class="snt">${num(i)}</span><button class="a pp ${pr(i)}" data-prio="${i.cid}" title="${PL[pr(i)]} priority — click to change">${PS[pr(i)]}</button>${unread(i)?`<button class="a rd" data-read="${i.cid}" title="Unread — click to mark read"><i></i></button>`:''}<span class="ttl" data-ed="title">${i.title}</span>${hasDet(i)?`<button class="dtog ${i.expanded?'up':''}" data-more="${i.cid}" title="Details">Details ${ic('chev')}</button>`:''}</h3></div>${movedNote(i)}
    <div class="body ${i.expanded?'':'shut'}" data-body="${i.cid}"><div class="fix" data-ed="out">${[i.out,i.what].map(trimHtml).filter(Boolean).join('<br><br>')}</div></div>
    ${i.sugg.length?`<div class="sugg"><div class="sh">Claude’s suggestions · ${i.sugg.length}<button class="rjall" data-sgtop="${i.cid}">Reject all</button></div><ul>${i.sugg.map((s,k)=>`<li><input type="checkbox" data-sg="${i.cid}:${k}" aria-label="Select suggestion"><span style="flex:1">${s.replace(/^<b>[^<]*<\/b>\s*/,'')}</span></li>`).join('')}</ul><div class="sg-bar" data-sgbar="${i.cid}"></div></div>`:''}`}
function shotBox(f,acts,one,extraL){return `<div class="shotw">${f.img?`<img class="shot" src="${esc(f.img)}" draggable="false" decoding="async">`:'<div class="noshot">No screenshot</div>'}<div class="lacts">${one?`<button class="a pp ${pr(f)}" data-prio="${f.cid}" title="${PL[pr(f)]} priority — click to change">${PS[pr(f)]}</button>`:''}${one&&unread(f)?`<button class="a rd" data-read="${f.cid}" title="Unread — click to mark read"><i></i></button>`:''}${extraL||''}${f.img?`<button class="a exp2" data-exp="${esc(f.img)}" title="Open full size">${ic('expand')}</button>`:''}</div>${f.prev?`<span class="prevtag">${f.prev.ref?'Design':'Before'}${f.prev.label&&!/^before$/i.test(f.prev.label)?' · '+esc(f.prev.label):''}</span>`:''}${acts||''}</div>`}
/* shared card, screenshot level: read marks every issue on it read; chat opens the first issue's thread */
function grpRead(g){const ur=g.filter(unread);return ur.length?`<button class="a rd" data-readall="${ur.map(i=>i.cid).join(',')}" title="Mark all ${g.length} issues on this screenshot read"><i></i></button>`:''}
function grpActs(g){const ur=g.filter(unread),f=g[0],n=threads('card:'+f.cid).length;return `<span class="acts">${addBtn(f)}<button class="a hv" data-menu="${f.cid}" title="More (issue ${num(f)})">${ic('more')}</button><button class="a hv del" data-delall-shot="${g.map(i=>i.cid).join(',')}" title="Delete all ${g.length} issues on this screenshot">${ic('trash')}</button><button class="a cmi ${n?'has':'hv'}" data-open="card:${f.cid}" title="Comments on issue ${num(f)}">${ic('msg')}${n?`<em>${n}</em>`:''}</button></span>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-readall]');if(!b)return;e.stopPropagation();const ids=b.dataset.readall.split(','),its=ids.map(c=>S.items.find(i=>i.cid===c)).filter(Boolean);its.forEach(i=>setRead(i,true));render();toast(`Marked ${its.length} read`,()=>{its.forEach(i=>setRead(i,false));render()})},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-delall-shot]');if(!b)return;e.stopPropagation();const ids=b.dataset.delallShot.split(',');
  confirmBox(`Delete all ${ids.length} issues on this screenshot? They move to Deleted, where you can restore them.`,'Delete all',()=>ids.forEach(c=>{document.getElementById('menu').dataset.for=c;menuAct('del')}))},true);
function cardGroup(g){const f=g[0];return `<div class="card grp ${g.some(i=>S.sel===i.cid)?'sel':''}" data-cid="${f.cid}">${shotBox(f,grpActs(g),0,grpRead(g))}
  <div class="gitems">${(k=>k>0?[...g.slice(k),...g.slice(0,k)]:g)(S.rotSel&&S.rotSel===S.sel?g.findIndex(i=>i.cid===S.sel):-1).map(i=>`<div class="gi ${S.sel===i.cid?'sel':''}" id="c-${i.cid}" data-cid="${i.cid}">${issueRow(i)}${hoverActs(i,'racts')}</div>`).join('')}</div></div>`}
function units(items){const m=new Map(),out=[];items.forEach(i=>{const k=i.screen;if(k){if(!m.has(k)){m.set(k,[]);out.push(m.get(k))}m.get(k).push(i)}else out.push([i])});
  const chunks=[];out.forEach(u=>{for(let k=0;k<u.length;k+=MAXG)chunks.push(u.slice(k,k+MAXG))});return chunks.map(u=>u.length>1?cardGroup(u):card(u[0])).join('')}
function card(i){return `<div class="card ${S.sel===i.cid?'sel':''}" id="c-${i.cid}" data-cid="${i.cid}">${shotBox(i,hoverActs(i,'acts'),1)}<div class="cap">${issueRow(i)}</div></div>`}
function openPop(t,anchor){S.popAnchor=anchor;
  const P=document.getElementById('pop'),it=S.items.find(i=>'card:'+i.cid===t);
  const name=t==='page'?'General':it?`${num(it)} · ${it.title.replace(/<[^>]+>/g,'')}`:t;
  const th=threads(t),rs=(S.resolved||[]).filter(c=>c.target===t),showR=rs.length&&S.popRes===t;if(!rs.length&&S.popRes===t)S.popRes=null;
  P.innerHTML=`<div class="ph"><b>${esc(name)}</b>${rs.length?`<button class="chip prv ${showR?'on':''}" data-pres-view title="Resolved threads on this screen">Resolved · ${rs.length}</button>`:''}<button class="ib" data-close>${ic('x')}</button></div><div class="pb">${showR?rs.map(c=>`<div class="th rsv"><div class="thh"><span class="st done">Resolved ${c.resolvedAt?new Date(c.resolvedAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}</span></div>${c.thread.map(m=>`<div class="msg ${m.by}"><span class="who">${m.by!=='Claude'?'You':m.by}</span>${esc(m.text).replace(/\n/g,'<br>')}</div>`).join('')}</div>`).join(''):''}${!showR&&th.length?th.map(c=>`<div class="th"><div class="thh"><span class="st ${st(c)}">${{todo:'To do',inprogress:'In progress',done:'Done'}[st(c)]}</span><button class="res" data-pres="${c.id}" ${st(c)==='done'?'':'disabled'} title="${st(c)==='done'?'Resolve — clears this thread':'Available once Claude has worked on it'}">${ic('check')}Resolve</button></div>${c.thread.map(m=>`<div class="msg ${m.by}"><span class="who">${m.by!=='Claude'?'You':m.by}</span>${esc(m.text).replace(/\n/g,'<br>')}</div>`).join('')}<div class="compose" style="border-top:1px solid var(--line)"><textarea rows="1" placeholder="Reply — Enter to send" data-reply="${c.id}"></textarea><button class="send" data-rsend title="Send">${ic('send')}</button></div></div>`).join(''):''}</div>
  <div class="compose"><textarea rows="2" placeholder="Comment — a task for Claude · Enter to send" data-newc="${t}"></textarea><button class="send" data-send>${ic('send')}</button></div>`;
  P.classList.add('open');const r=anchor?.getBoundingClientRect();P.style.top=Math.max(12,Math.min((r?.top||80)-10,innerHeight-P.offsetHeight-12))+'px';const pb=P.querySelector('.pb');if(pb)pb.scrollTop=pb.scrollHeight;if(!S.noFocus)requestAnimationFrame(()=>P.querySelector('[data-newc]')?.focus());
}
// events
document.addEventListener('click',e=>{
  if(e.target.closest('[data-copymsg]')){navigator.clipboard?.writeText(`The design-QA canvas server isn't running. Please start it: cd ${location.pathname.replace(/\/[^/]*$/,'')} && node server.mjs ${PORT}`);toast('Copied — paste it to Claude');return}
  const o=e.target.closest('[data-open]');if(o){S.touchedComments=true;srvState();e.stopPropagation();closeMenu();const P=document.getElementById('pop');
    if(P.classList.contains('open')&&S.popT===o.dataset.open){P.classList.remove('open');S.popT=null}else{S.popT=o.dataset.open;openPop(o.dataset.open,o.closest('.row')||o)}return}
  const mb=e.target.closest('[data-menu]');if(mb){e.stopPropagation();const M=document.getElementById('menu');if(!M.hidden&&M.dataset.for===mb.dataset.menu){closeMenu()}else openMenu(mb.dataset.menu,mb);return}
  const tre=e.target.closest('[data-tres],[data-tdel]');if(tre){const id=tre.dataset.tres||tre.dataset.tdel,k=S.comments.findIndex(c=>c.id===id),ti=[...document.querySelectorAll('#list .task')].indexOf(tre.closest('.task')),[gone]=S.comments.splice(k,1);render();
    markReadT(gone.target);popAfterResolve(gone.target);if(tre.dataset.tres)openNextTask(ti);post(`api/comments/${gone.id}/flags`,{resolved:true});toast('Resolved — thread cleared',()=>{S.comments.splice(k,0,gone);render();post(`api/comments/${gone.id}/flags`,{resolved:false})});return}
  const ire=e.target.closest('[data-ires]');if(ire){document.getElementById('pop').classList.remove('open');S.popT=null;const k=S.inbox.findIndex(i=>i.id===ire.dataset.ires),[gone]=S.inbox.splice(k,1);const tc=S.comments.filter(c=>c.target==='card:'+gone.id);S.comments=S.comments.filter(c=>c.target!=='card:'+gone.id);render();post('api/inbox/'+gone.id,{resolved:true});tc.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:true}));toast('Resolved',()=>{S.inbox.splice(k,0,gone);S.comments.push(...tc);render();post('api/inbox/'+gone.id,{resolved:false});tc.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:false}))});return}
  const idl=e.target.closest('[data-idel]');if(idl){const k=S.inbox.findIndex(i=>i.id===idl.dataset.idel),[gone]=S.inbox.splice(k,1);render();post('api/inbox/'+gone.id,{deleted:true});
    toast('Screenshot deleted',()=>{S.inbox.splice(k,0,gone);render();post('api/inbox/'+gone.id,{deleted:false})});return}
  const tk=!e.target.closest('[data-tres],[data-ires],[data-tdel],[data-idel],[data-open],[data-prio]')&&e.target.closest('[data-task]');if(tk){const t=tk.dataset.task,id=t.replace(/^card:/,'');if(t.startsWith('card:')&&document.getElementById('c-'+id)){select(id);goTo(id)}S.popT=t;openPop(t,tk);return}
  const gt=e.target.closest('[data-goto]');if(gt){const id=gt.dataset.goto;if(!document.getElementById('c-'+id)){S.openOnly=false;S.fp.clear();S.fk.clear();S.fh=false;render()}select(id);goTo(id);return}
  if(e.target.closest('[data-delall]')){const g=S.deleted;S.deleted=[];render();let t=setTimeout(()=>post('api/removed/purge',{cids:g.map(i=>i.cid)}),10000);toast(`Deleted ${g.length} for good`,()=>{clearTimeout(t);S.deleted=g;render()});return}
  const rs=e.target.closest('[data-restore]');if(rs){const k=S.deleted.findIndex(i=>i.cid===rs.dataset.restore);S.items.push(...S.deleted.splice(k,1));if(FLOW)flowLayout();render();post('api/removed',{cid:rs.dataset.restore,removed:false});toast('Restored');return}
  const ex=e.target.closest('[data-exp]');if(ex){const L=document.getElementById('lb');L.querySelector('img').src=ex.dataset.exp;L.classList.add('open');return}
  const pk=e.target.closest('[data-pick]');if(pk){const cid=document.getElementById('menu').dataset.for;S.prio[cid]=pk.dataset.pick;closeMenu();render();post('api/priorities',{cid,level:pk.dataset.pick});return}
  const cm=e.target.closest('[data-cmp]');if(cm){const c=document.getElementById('c-'+cm.dataset.cmp),it=S.items.find(i=>i.cid===cm.dataset.cmp),im=c.querySelector('.shot');const on=!c.classList.contains('showprev');c.classList.toggle('showprev',on);if(im)im.src=on?it.prev.img:it.img;return}
  const dl=e.target.closest('[data-del]');if(dl){document.getElementById('menu').dataset.for=dl.dataset.del;menuAct('del');return}
  const cb=e.target.closest('[data-comb]');if(cb){const cid=document.getElementById('menu').dataset.for,it=S.items.find(i=>i.cid===cid),t=S.items.find(i=>i.cid===cb.dataset.comb),was=it.screen;closeMenu();
    const key=t.screen||('scr-'+t.cid);if(!t.screen){t.screen=key;post('api/edit',{cid:t.cid,screen:key})}it.screen=key;render();post('api/edit',{cid,screen:key});toast('Combined on one card',()=>{it.screen=was;render();post('api/edit',{cid,screen:was})});return}
  const mi=e.target.closest('[data-mi]');if(mi){menuAct(mi.dataset.mi,mi.dataset.v);return}
  closeMenu();
  if(e.target.closest('[data-close]')){document.getElementById('pop').classList.remove('open');S.popT=null;return}
  if(e.target.closest('#pop'))return;
  const tab=e.target.closest('[data-tab]');if(tab){S.tab=tab.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t===tab));render();requestAnimationFrame(markStuck);return}
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
  const mvg=e.target.closest('[data-goto]');if(mvg){select(mvg.dataset.goto);goTo(mvg.dataset.goto,true);return}const rd=e.target.closest('[data-read]');if(rd){const ri=S.tab==='new'&&rd.closest('#list')?[...document.querySelectorAll('#list .row[data-cid]')].indexOf(rd.closest('.row')):-1;S.readLocal.add(rd.dataset.read);render();post('api/state',{cid:stKey(rd.dataset.read),new:false});
    /* New tab: go straight to the next new item */if(ri>=0){const R=[...document.querySelectorAll('#list .row[data-cid]')],nx=(R[ri]||R[ri-1])?.dataset.cid;if(nx){select(nx);goTo(nx,true);requestAnimationFrame(()=>document.querySelector(`#list .row[data-cid="${nx}"]`)?.scrollIntoView({block:'nearest'}))}}return}
  const pp=e.target.closest('[data-prio]');if(pp){e.stopPropagation();openPicker(pp.dataset.prio,pp);return;toast('Priority changed');return}
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
function fit(){S.z=Math.min(1,VP.clientWidth/W().offsetWidth);S.x=0;S.y=0;apply()}
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
  if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&!e.target.closest('input,textarea,[contenteditable=true]')){e.preventDefault();
    const ids=ordered().flatMap(g=>g.items.map(i=>i.cid)),k=ids.indexOf(S.sel),n=k<0?0:Math.min(ids.length-1,Math.max(0,k+(e.key==='ArrowRight'?1:-1)));
    rapidKey();stepTo(S.sel,ids[n])}});
function select(cid,expand=true){/* moving to another screen turns its Before / Design view off */document.querySelectorAll('.card.showprev').forEach(c=>{if(c.contains(document.getElementById('c-'+cid)))return;c.classList.remove('showprev');const id=(c.querySelector('[data-cmp]')||{}).dataset?.cmp,it=id&&S.items.find(i=>i.cid===id),im=c.querySelector('.shot');if(it&&im)im.src=it.img});S.sel=cid;document.querySelectorAll('.grp.sel').forEach(x=>x.classList.remove('sel'));setTimeout(()=>document.getElementById('c-'+cid)?.closest('.grp')?.classList.add('sel'));const si=S.items.find(i=>i.cid===cid);if(si&&!S.openSecs.has(si.section)){S.openSecs.add(si.section);syncSecs(cid)}if(expand){let ch=false;S.items.forEach(i=>{const v=i.cid===cid;if(!!i.expanded!==v){i.expanded=v;ch=true}});if(ch)fitAll()}document.querySelectorAll('.row.sel,.card.sel,.gi.sel').forEach(x=>x.classList.remove('sel'));document.querySelector(`.row[data-cid="${cid}"]`)?.classList.add('sel');document.getElementById('c-'+cid)?.classList.add('sel')}
function toast(t,undo,kind){const T=document.getElementById('toast');T.innerHTML=esc(t)+(undo?' <button class="undo">Undo</button>':'');T.classList.toggle('err',kind==='err');T.style.display='block';
  if(undo)T.querySelector('.undo').onclick=()=>{T.style.display='none';undo()};clearTimeout(T._t);T._t=setTimeout(()=>T.style.display='none',undo?10000:kind==='err'?6000:2200)}
// double-click any text to edit in place; Enter (or click away) saves, Esc cancels
document.addEventListener('dblclick',e=>{clearTimeout(S.zt);const sn=e.target.closest('[data-secname]');if(sn&&!sn.isContentEditable){if(S.secUndo&&sn.closest('.sec')){S.openSecs=S.secUndo;syncSecs()}{const k0=sn;setTimeout(()=>{const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);if(r&&k0.contains(r.startContainer)){const sl=getSelection();sl.removeAllRanges();r.collapse(true);sl.addRange(r)}},0)}e.preventDefault();e.stopPropagation();const old=sn.dataset.secname,before=sn.innerHTML;sn.contentEditable='true';sn.focus();
    const end=save=>{sn.contentEditable='false';sn.removeEventListener('keydown',k);sn.removeEventListener('blur',b);const nv=sn.innerHTML.trim();
      if(!save||!nv){sn.innerHTML=before;return}if(nv!==before){S.sections=S.sections.map(x=>x===old?nv:x);S.items.forEach(i=>{if(i.section===old)i.section=nv});if(S.openSecs.delete(old))S.openSecs.add(nv);render();post('api/edit',{section:{from:old,to:nv}});toast('Section renamed')}};
    const k=ev=>{if(ev.key==='Enter'){ev.preventDefault();end(true)}else if(ev.key==='Escape')end(false)},b=()=>end(true);sn.addEventListener('keydown',k);sn.addEventListener('blur',b);return}
  clearTimeout(S.ct);const el=e.target.closest('[data-ed]')||e.target.closest('.ct h3')?.querySelector('.ttl');if(!el||el.isContentEditable)return;e.preventDefault();
  const before=el.innerHTML;el.contentEditable='true';el.focus();{const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);const sl=getSelection();sl.removeAllRanges();if(r&&el.contains(r.startContainer)){r.collapse(true);sl.addRange(r)}else{const q=document.createRange();q.selectNodeContents(el);q.collapse(false);sl.addRange(q)}}
  const end=save=>{el.contentEditable='false';el.removeEventListener('keydown',k);el.removeEventListener('blur',b);
    if(!save)el.innerHTML=before;else if(el.innerHTML!==before){const it=S.items.find(i=>i.cid===(el.closest('.gi')||el.closest('.card')).dataset.cid);const f=el.dataset.ed,v=el.innerHTML.replace(/^(<br>|\s|&nbsp;)+|(<br>|\s|&nbsp;)+$/g,'');it[f]=v;if(f==='out')it.what='';(unread(it)&&(S.readLocal.add(it.cid),post('api/state',{cid:stKey(it.cid),new:false}),render()),post('api/edit',f==='out'?{cid:it.cid,out:v,what:''}:{cid:it.cid,[f]:v})).then(r=>r&&toast('Saved'))}};
  const k=ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();end(true);fitAll()}else if(ev.key==='Escape'){end(false);fitAll()}},b=()=>{end(true);fitAll()};
  el.addEventListener('keydown',k);el.addEventListener('blur',b)});
VP.addEventListener('pointerover',e=>{const c=e.target.closest('.gi')||e.target.closest('.card');document.querySelectorAll('.row.hov').forEach(r=>r.classList.remove('hov'));if(c)document.querySelector(`.row[data-cid="${c.dataset.cid}"]`)?.classList.add('hov')});
VP.addEventListener('pointerleave',()=>document.querySelectorAll('.row.hov').forEach(r=>r.classList.remove('hov')));
document.getElementById('list').addEventListener('pointerover',e=>{const r=e.target.closest('.row[data-cid]');document.querySelectorAll('.card.hov').forEach(c=>c.classList.remove('hov'));if(r)document.getElementById('c-'+r.dataset.cid)?.classList.add('hov')});
document.getElementById('list').addEventListener('pointerleave',()=>document.querySelectorAll('.card.hov').forEach(c=>c.classList.remove('hov')));
// live reload: when this file changes on disk, reload and land on the same view
let ver=null;setInterval(async()=>{try{const h=(await (await fetch(API+'api/version',{cache:'no-store'})).json()).page;
  if(ver&&h!==ver){if(busy()){if(!S.updWait){S.updWait=1;toast('Canvas updated — it will refresh when you finish typing')}return}
    sessionStorage.qaView=JSON.stringify({x:S.x,y:S.y,z:S.z,sel:S.sel,tab:S.tab,popT:document.getElementById('pop').classList.contains('open')?S.popT:null});location.reload()}ver=h}catch{}},1500);
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
load().then(()=>{const q=new URLSearchParams(location.search);const v=sessionStorage.qaView&&JSON.parse(sessionStorage.qaView);delete sessionStorage.qaView;
  if(v){S.z=v.z;S.x=v.x;S.y=v.y;paint();if(v.sel)select(v.sel,false);if(v.tab&&v.tab!=='issues')document.querySelector(`[data-tab="${v.tab}"]`)?.click();if(v.popT){S.popT=v.popT;openPop(v.popT,document.querySelector(`.row[data-cid="${v.popT.replace('card:','')}"]`))}}if(q.get('z')){S.z=+q.get('z');paint()}if(q.get('sugg')){const it=ordered().flatMap(g=>g.items).find(i=>i.sugg.length);select(it.cid);goTo(it.cid);paint()}if(q.get('sel')){const id=ordered().flatMap(g=>g.items)[+q.get('sel')-1]?.cid;select(id);goTo(id);paint()}});

// ---- comments: Enter sends (Shift+Enter = new line); a reply re-opens the task for Claude
async function sendFrom(ta){const v=ta.value.trim();if(!v)return;const t=S.popT;delete localStorage[DKEY(ta)];ta.value='';
  if(ta.dataset.reply){const c=S.comments.find(x=>x.id===ta.dataset.reply);c.thread.push({by:'User',text:v,at:new Date().toISOString()});markReadT(c.target);c.status='todo';c.claudeDone=false;document.getElementById('pop').classList.remove('open');S.popT=null;render();toast('Reply sent');post(`api/comments/${c.id}/reply`,{by:'User',text:v},{asUser:false})}
  else{const it=S.items.find(i=>'card:'+i.cid===t),tmp={id:'tmp'+Date.now(),target:t,title:it?it.title.replace(/<[^>]+>/g,''):t,createdAt:new Date().toISOString(),status:'todo',thread:[{by:'User',text:v,at:new Date().toISOString()}]};
    S.comments.push(tmp);markReadT(t);openPop(t,S.popAnchor);render();const r=await post('api/comments',{target:t,title:tmp.title,text:v,by:'User'},{asUser:false});if(r)Object.assign(tmp,r)}}
document.addEventListener('keydown',e=>{const ta=e.target.closest?.('#pop textarea');if(ta&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendFrom(ta)}});
document.addEventListener('click',e=>{const sb=e.target.closest('#pop [data-send],#pop [data-rsend]');if(sb){sendFrom(sb.previousElementSibling);return}
  const pr=e.target.closest('#pop [data-pres]');if(pr&&!pr.disabled){const k=S.comments.findIndex(c=>c.id===pr.dataset.pres),[gone]=S.comments.splice(k,1);render();markReadT(gone.target);popAfterResolve(gone.target);post(`api/comments/${gone.id}/flags`,{resolved:true});
    toast('Resolved — thread cleared',()=>{S.comments.splice(k,0,gone);render();post(`api/comments/${gone.id}/flags`,{resolved:false})})}});

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
  const sk=FLOW?'workflow-canvas':'design-qa-canvas',ws=b.hasAttribute('data-withskill')?`\n\nIf you don't have the skill yet: copy the ${sk} folder from https://github.com/grandhimanshu/skills-public (skills/${sk}) into ~/.claude/skills/, then follow its agent-references/${n.map(x=>x==='comments'?'comment-watcher.md':'screenshot-watcher.md').join(' and ')}.`:'';navigator.clipboard?.writeText(`Please restart the design-QA ${n.map(x=>x==='comments'?'comment watcher':'screenshot watcher').join(' and ')} (${FLOW?'workflow-canvas':'design-qa-canvas'} skill) for the canvas on localhost:${PORT} (${decodeURIComponent(location.pathname.replace(/\/[^/]*$/,''))||'/'}).`+ws);toast('Copied — paste it to Claude')});
setInterval(watchState,5000);setTimeout(watchState,800);

// ---- side pane: double-click a title to edit it (Enter saves, Esc cancels); caret lands where you clicked
document.addEventListener('dblclick',e=>{const t=e.target.closest('#list .rt[data-rted]');if(!t||t.isContentEditable)return;e.preventDefault();e.stopPropagation();clearTimeout(S.zt);
  const it=S.items.find(i=>i.cid===t.dataset.rted);if(!it)return;const before=t.textContent;t.contentEditable='true';t.classList.add('editing');t.focus();
  const r=document.caretRangeFromPoint?.(e.clientX,e.clientY),sl=getSelection();sl.removeAllRanges();if(r&&t.contains(r.startContainer)){r.collapse(true);sl.addRange(r)}
  const end=save=>{t.contentEditable='false';t.classList.remove('editing');t.removeEventListener('keydown',k);t.removeEventListener('blur',b);const v=t.textContent.trim();
    if(!save||!v||v===before){t.textContent=before;return}it.title=esc(v);if(unread(it)){S.readLocal.add(it.cid);post('api/state',{cid:stKey(it.cid),new:false})}render();post('api/edit',{cid:it.cid,title:esc(v)}).then(x=>x&&toast('Saved'))};
  const k=ev=>{if(ev.key==='Enter'){ev.preventDefault();end(true)}else if(ev.key==='Escape')end(false)},b=()=>end(true);t.addEventListener('keydown',k);t.addEventListener('blur',b)},true);
// ---- settings panel (inline, like Filters)
function setsPanel(){const P=document.getElementById('settings');P.innerHTML=`
  <div class="frow"><span class="l">Numbers</span><button class="sw" data-showids role="switch" aria-checked="${S.showIds}"><span class="swt"><span>ID</span><span>#</span></span><small>${S.showIds?'Permanent — never changes':'Position in the list — changes with sort and deletes'}</small></button></div>
  <div class="frow"><span class="l">Canvas</span><span class="bgs">${BGS.map(([v,n])=>`<button data-bg="${v}" class="${S.bg===v?'on':''}" style="background:${v}" title="${n}"></button>`).join('')}<span class="hexw">#<input class="hex" data-hex value="${S.bg.replace('#','').toUpperCase()}" maxlength="7" spellcheck="false" aria-label="Canvas colour (hex)"></span></span></div>
  <div class="frow"><span class="l">Screen switch</span><span class="seg">${[['auto','Auto','Slides; quick repeat presses switch instantly'],['pan','Pan','Always slides'],['instant','Instant','Always jumps']].map(([v,n,t])=>`<button data-anim="${v}" class="${S.anim===v?'on':''}" title="${t}">${n}</button>`).join('')}</span></div>
  <div class="frow"><span class="l">Priority</span><button class="sw" data-showprio role="switch" aria-checked="${S.showPrio}"><span class="swt"><span>Shown</span><span>Hidden</span></span><small>${S.showPrio?'H / M / L badges everywhere':'Hidden on the canvas and in the side pane'}</small></button></div>
  <div class="frow"><span class="l">Titles</span><button class="sw" data-wrap role="switch" aria-checked="${S.wrap}"><span class="swt"><span>One line</span><span>Full</span></span><small>${S.wrap?'Full titles in the side pane':'Long titles are cut with …'}</small></button></div>`;
  P.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-checked',b.hasAttribute('data-wrap')?!S.wrap:b.hasAttribute('data-showprio')?S.showPrio:S.showIds));document.getElementById('sb').classList.toggle('wrapt',S.wrap)}
S.wrap=localStorage.qaWrap==='1';
const BGS=[['#F4F4F4','Light grey (default)'],['#FAFAFA','Off-white'],['#FFFFFF','White'],['#ECEEF1','Cool grey'],['#2A2724','Dark']];
S.bg=localStorage.qaBg||'#F4F4F4';const applyBg=()=>{document.documentElement.style.setProperty('--bg',S.bg);document.documentElement.classList.toggle('dark-canvas',S.bg==='#2A2724')};applyBg();
document.addEventListener('click',e=>{if(e.target.closest('#setbtn')){const P=document.getElementById('settings'),o=!P.classList.contains('open');P.classList.toggle('open',o);document.getElementById('setbtn').classList.toggle('on',o);if(o)setsPanel();e.stopImmediatePropagation();return}
  const bgb=e.target.closest('#settings [data-bg]');if(bgb){S.bg=bgb.dataset.bg;localStorage.qaBg=S.bg;applyBg();setsPanel();e.stopImmediatePropagation();return}
  const w=e.target.closest('#settings [data-wrap]');if(w){S.wrap=!S.wrap;localStorage.qaWrap=S.wrap?'1':'0';setsPanel();e.stopImmediatePropagation();return}
  const san=e.target.closest('#settings [data-anim]');if(san){S.anim=san.dataset.anim;localStorage.qaAnim=S.anim;setsPanel();e.stopImmediatePropagation();return}
  const spr=e.target.closest('#settings [data-showprio]');if(spr){S.showPrio=!S.showPrio;localStorage.qaPrio=S.showPrio?'1':'0';applyPrio();setsPanel();e.stopImmediatePropagation();return}
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
function bulkBar(all){S.bulkAll=all;const L=document.getElementById('list');let h='';
  if(S.tab==='new'||(FLOW&&S.tab!=='inbox'&&S.tab!=='deleted'&&S.tab!=='resolved')){const nu=all.filter(unread).length;h=(nu?`<button class="chip" data-bulk="read">Mark all read</button>`:'')+(all.length>nu?`<button class="chip" data-bulk="unread">Mark all unread</button>`:'')}
  else if(S.tab==='inbox'&&S.sub==='done'){const n=S.comments.filter(c=>!c.resolved&&st(c)==='done').length;if(n)h=`<button class="chip" data-bulk="resolve">Resolve all · ${n}</button>`}
  if(h){const sbt=L.querySelector('.subtabs'),x=`<div class="bulk">${h}</div>`;sbt?sbt.insertAdjacentHTML('afterend',x):L.insertAdjacentHTML('afterbegin',x)}}
function setRead(i,read){const k=stKey(i.cid);if(read)S.readLocal.add(i.cid);else{S.readLocal.delete(i.cid);S.seen.delete(k)}post('api/state',{cid:k,new:!read})}
function bulk(a){if(a==='read'||a==='unread'){const read=a==='read',ch=(S.bulkAll||[]).filter(i=>unread(i)===read);ch.forEach(i=>setRead(i,read));render();
    toast(`Marked ${ch.length} ${read?'read':'unread'}`,()=>{ch.forEach(i=>{if(read)setRead(i,false);else{S.seen.add(stKey(i.cid));post('api/state',{cid:stKey(i.cid),new:false})}});render()});return}
  if(a==='resolve'){const g=S.comments.filter(c=>!c.resolved&&st(c)==='done');if(!g.length)return;
    confirmBox(`Resolve ${g.length} thread${g.length>1?'s':''} Claude has finished? They leave the Inbox.`,'Resolve all',()=>{g.forEach(c=>markReadT(c.target));S.comments=S.comments.filter(c=>!g.includes(c));render();g.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:true}));
      toast(`Resolved ${g.length}`,()=>{S.comments.push(...g);render();g.forEach(c=>post(`api/comments/${c.id}/flags`,{resolved:false}))})})}}
function confirmBox(msg,yes,fn){const m=document.createElement('div');m.className='cfm';m.innerHTML=`<div class="cfm-b" role="dialog" aria-modal="true"><p>${esc(msg)}</p><div class="cfm-a"><button class="chip" data-cfno>Cancel</button><button class="chip dark" data-cfyes>${esc(yes)}</button></div></div>`;document.body.append(m);
  const close=()=>{m.remove();removeEventListener('keydown',k,true)},k=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};addEventListener('keydown',k,true);
  m.onclick=e=>{if(e.target.closest('[data-cfyes]')){close();fn()}else if(e.target===m||e.target.closest('[data-cfno]'))close()};m.querySelector('[data-cfyes]').focus()}
/* Space: mark the selected card read, then go to the next one (workflow: same as →; QA: next issue in side-pane order) */
function rapidKey(){const now=performance.now();S.instant=now-(S.lastKey||0)<700;S.lastKey=now;setTimeout(()=>S.instant=false)}
/* QA: stepping to an issue on the same screenshot only moves the highlight, so the screenshot stays in view; another screenshot: fit it */
/* keyboard stepping in a shared card: the current issue sits right under the screenshot, the ones already seen move to the bottom */
function rotGrp(cid){const gi=document.getElementById('c-'+cid);if(!gi||!gi.classList.contains('gi'))return;const box=gi.parentElement;let n=0;while(box.firstElementChild!==gi&&n++<9)box.appendChild(box.firstElementChild)}
function stepTo(from,to){const card=c=>document.getElementById('c-'+c)?.closest('.card'),cd=card(to),same=from&&card(from)&&card(from)===cd;
  /* same screenshot already in view: keep the zoom, rotate the issue up under it; otherwise fit the next screenshot */
  const inView=el=>{if(!el)return false;const r=el.getBoundingClientRect(),v=VP.getBoundingClientRect();return r.top>=v.top-2&&r.bottom<=v.bottom+2&&r.left>=v.left-2&&r.right<=v.right+2&&(r.width>=v.width*.6||r.height>=v.height*.6)};/* …and big enough to read */
  S.rotSel=to;select(to);rotGrp(to);if(!(same&&inView(cd?.querySelector('.shot,.noshot'))))goTo(to,true);requestAnimationFrame(()=>document.querySelector(`#list .row[data-cid="${to}"]`)?.scrollIntoView({block:'nearest'}))}
function spaceKey(){const cur=S.sel,it=cur&&S.items.find(i=>i.cid===cur);if(S.tab==='new'){rapidKey();/* on the New tab, Space walks the New list: mark read, go to the next changed screen */const R0=[...document.querySelectorAll('#list .row[data-cid]')].map(r=>r.dataset.cid),ri=R0.indexOf(cur);if(it&&unread(it)){setRead(it,true);render()}const R=[...document.querySelectorAll('#list .row[data-cid]')].map(r=>r.dataset.cid),nx=ri<0?R[0]:(R[ri]===cur?R[ri+1]:R[ri])||R[ri-1];if(nx)stepTo(cur,nx);return}if(it&&unread(it)){setRead(it,true);render()}
  if(typeof flowKey==='function'&&FLOW){flowKey('ArrowRight');return}
  rapidKey();const o=ordered().flatMap(g=>g.items).map(i=>i.cid),j=o.indexOf(cur),nx=o[j<0?0:j+1];if(nx)stepTo(cur,nx)}
/* Resolved tab: resolved threads for reference (they live in canvas-resolved.json, which Claude never reads). Delete = gone for good, after an Undo window */
function loadResolved(){fetch(API+'api/comments?all=1',{cache:'no-store'}).then(r=>r.json()).then(d=>{const n=(d.comments||[]).filter(c=>c.resolved&&!(S.rdel||[]).includes(c.id));const k=JSON.stringify(n.map(c=>c.id));if(k!==S._rk){S._rk=k;S.resolved=n.sort((a,b)=>(b.resolvedAt||'').localeCompare(a.resolvedAt||''));render()}}).catch(()=>{})}
setTimeout(loadResolved,300);setInterval(loadResolved,5000);
function resolvedHTML(){const R=S.resolved||[];if(!R.length)return '<div class="empty">Nothing resolved yet.</div>';
  const nm=c=>{const it=S.items.find(i=>'card:'+i.cid===c.target);return it?`<span class="sn">${num(it)}</span><span class="rt">${it.title.replace(/<[^>]+>/g,'')}</span>`:`<span class="rt">${esc(c.title||'General')}</span>`};
  const when=t=>t?new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  return `<div class="delbar"><span>${R.length} resolved · kept for your reference</span><button class="chip danger" data-rdelall>Delete all</button></div>`+R.map(c=>`<div class="task rsv" data-task="${c.target}"><div class="th1">${nm(c)}<span class="rwhen">${when(c.resolvedAt)}</span><button class="ib" data-rdel="${c.id}" title="Delete for good">${ic('trash')}</button></div>${c.thread.map(m=>`<div class="l2 ${m.by==='Claude'?'':'u'}">${m.by==='Claude'?'<b>Claude:</b> ':''}${esc(m.text)}</div>`).join('')}</div>`).join('')}
function delResolved(ids){S.rdel=[...(S.rdel||[]),...ids];const g=S.resolved.filter(c=>ids.includes(c.id));S.resolved=S.resolved.filter(c=>!ids.includes(c.id));render();
  const t=setTimeout(()=>ids.forEach(id=>fetch(API+'api/comments/'+id,{method:'DELETE',headers:{'X-Confirm-Delete':'yes','X-Actor':'User'},keepalive:true})),8000);
  toast(`Deleted ${ids.length} for good`,()=>{clearTimeout(t);S.rdel=S.rdel.filter(x=>!ids.includes(x));S.resolved=[...S.resolved,...g].sort((a,b)=>(b.resolvedAt||'').localeCompare(a.resolvedAt||''));render()})}
document.addEventListener('click',e=>{const d1=e.target.closest('[data-rdel]');if(d1){e.stopPropagation();delResolved([d1.dataset.rdel]);return}
  if(e.target.closest('[data-rdelall]')){e.stopPropagation();const n=(S.resolved||[]).length;confirmBox(`Delete all ${n} resolved thread${n>1?'s':''} for good? This can't be undone after a few seconds.`,'Delete all',()=>delResolved(S.resolved.map(c=>c.id)))}},true);
/* resolving from the Inbox list opens the next item (the one that took its place, else the one above) so review is one click per thread */
function openNextTask(ti){if(ti<0)return;const T=[...document.querySelectorAll('#list .task')],el=T[ti]||T[ti-1];if(!el)return;const t=el.dataset.task;if(!t)return;
  const cid=t.startsWith('card:')?t.slice(5):null;if(cid&&S.items.some(i=>i.cid===cid)){select(cid);goTo(cid,true)}
  requestAnimationFrame(()=>{const a=document.querySelector(`#list .task[data-task="${t}"]`)||el;el.scrollIntoView({block:'nearest'});S.popT=t;openPop(t,a)})}
document.addEventListener('click',e=>{const sb=e.target.closest('[data-sub]');if(sb){e.stopPropagation();S.sub=sb.dataset.sub;render();return}
  const pr=e.target.closest('[data-pres-view]');if(pr){e.stopPropagation();S.popRes=S.popRes===S.popT?null:S.popT;S.noFocus=1;openPop(S.popT,S.popAnchor);S.noFocus=0}},true);
/* Alt: flip the selected card between its screenshot and its reference / previous one */
addEventListener('keydown',e=>{if(e.key!=='Alt'||e.repeat||e.target.closest?.('input,textarea,[contenteditable=true]'))return;const b=document.querySelector(`[data-cmp="${S.sel}"]`);if(b){e.preventDefault();b.click()}});
/* ---- keyboard shortcuts, from the ? button by the zoom controls */
function kbList(){const r=[['0','Zoom to the screenshot under the cursor · again: whole canvas'],['Space','Mark read and go to the next'+(FLOW?' step':' issue')+(FLOW?'':'')],['Alt',FLOW?'Flip to the previous screenshot':'Flip to the design reference'],['+ / −','Zoom in / out'],['⌘ + scroll','Zoom at the cursor']];
  if(!FLOW)r.splice(2,0,['← →','Previous / next issue (doesn’t mark read)']);if(FLOW)r.splice(2,0,['→','Next step along the flow (then the next branch)'],['←','Back along the arrows · on a first step: end of the previous flow'],['↑ ↓','Previous / next card in canvas order']);
  r.push(['Esc','Close a popover']);return r.map(([k,t])=>`<div class="kbr"><kbd>${k}</kbd><span>${t}</span></div>`).join('')}
document.addEventListener('click',e=>{const b=e.target.closest('#kbbtn'),P=document.getElementById('kbpop');if(b){e.stopPropagation();if(P.hidden){P.innerHTML=`<div class="kbh">Shortcuts</div>${kbList()}`;P.hidden=false}else P.hidden=true;return}if(P&&!P.hidden&&!e.target.closest('#kbpop'))P.hidden=true},true);
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
  const it=S.mk?S.mk(r):{...r,sugg:[],sids:[]};S.items.push(it);S.readLocal.add(it.cid);render();select(it.cid);
  requestAnimationFrame(()=>{const t=document.querySelector(`#c-${it.cid} .ttl`);if(t){const q=t.getBoundingClientRect();t.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:q.left+2,clientY:q.top+q.height/2}));const sel=getSelection(),rg=document.createRange();rg.selectNodeContents(t);sel.removeAllRanges();sel.addRange(rg)}})},true);
function zeroKey(){if(S.zoomedTo){S.zoomedTo=null;fit();return}
  const x=S.mx??innerWidth/2,y=S.my??innerHeight/2;let best=null,bd=Infinity;
  document.querySelectorAll('#world .card').forEach(c=>{const im=c.querySelector('.shot,.noshot');if(!im)return;const r=im.getBoundingClientRect();
    const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}});
  if(!best)return;const id=(best.querySelector('.gi')||best).dataset.cid;S.zoomedTo=id;select(id);goTo(id,true)}
// any manual pan/zoom ends the "zoomed to a screenshot" state, so the next 0 zooms in again
VP.addEventListener('wheel',()=>{S.zoomedTo=null},{passive:true});VP.addEventListener('pointerdown',()=>{S.zoomedTo=null});

/* ---- priority badges: shown by default on QA canvases, hidden on workflow canvases; Settings switches it everywhere */
S.showPrio=localStorage.qaPrio?localStorage.qaPrio==='1':!FLOW;function applyPrio(){document.documentElement.classList.toggle('noprio',!S.showPrio)}applyPrio();
/* ---- collapse the side pane for more canvas */
function setSbCol(v){S.sbCol=v;localStorage.qaSbCol=v?'1':'0';document.documentElement.classList.toggle('sbcol',v);requestAnimationFrame(()=>{typeof drawArrows==='function'&&FLOW&&drawArrows();paint()})}
document.addEventListener('click',e=>{if(e.target.closest('#sbcol')){e.stopPropagation();setSbCol(true)}else if(e.target.closest('#sbopen')){e.stopPropagation();setSbCol(false)}},true);
if(localStorage.qaSbCol==='1')setSbCol(true);

S.anim=localStorage.qaAnim||'auto';   // screen switch: auto (slide; quick repeats instant) · pan · instant

/* ---- Open app: the live app if it answers, else the repo on its branch (data.app = {url, repo, branch}) */
{const A=D.app,b=document.getElementById('appbtn');if(b&&A&&(A.url||A.repo)){b.hidden=false;
  const repoUrl=()=>A.repo?(A.branch?A.repo.replace(/\/$/,'')+(/github\.com/.test(A.repo)?'/tree/':'/-/tree/')+encodeURIComponent(A.branch):A.repo):null;
  b.title=A.url?`Open the app (${A.url})${A.repo?' · falls back to the repo if it isn’t running':''}`:'Open the repo'+(A.branch?' on '+A.branch:'');
  b.addEventListener('click',async()=>{const w=window.open('about:blank','_blank');let up=false;
    if(A.url){try{const c=new AbortController();setTimeout(()=>c.abort(),1500);await fetch(A.url,{mode:'no-cors',signal:c.signal});up=true}catch{}}
    const to=up?A.url:repoUrl();if(to){w.location=to;if(!up&&A.url)toast('The app isn’t running — opened the repo instead')}else{w.close();toast('The app isn’t running, and no repo is set')}})}}
