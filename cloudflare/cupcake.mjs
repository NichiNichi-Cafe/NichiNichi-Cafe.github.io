// Good Day Cupcake: one stable SQLite Durable Object ledger per environment.
// Issuance gate is enforced by the Worker; old cards remain redeemable when disabled.
const randomInt=n=>{const b=new Uint32Array(1),limit=4294967296-(4294967296%n);do{crypto.getRandomValues(b)}while(b[0]>=limit);return b[0]%n;};const token=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
const WORDS='MOND MOOS BACH FUCHS KLEE STERN FARN QUELLE DACHS ASTER SONNE LINDE KIESEL IGEL TULPE WOLKE EICHE STEIN EULE WIESE REGEN BIRKE FELS MEISE BLATT NEBEL ERLE PFAD SPATZ ZWEIG TAU BUCHE FUNKE REH FEDER WIND HASE FALTER KATZE FROSCH'.split(' ');
function berlinDate(now){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function week(day){const d=new Date(day+'T12:00:00Z');return addDays(day,-((d.getUTCDay()+6)%7));}
const normalize=s=>String(s||'').toUpperCase().replace(/[\s-]/g,'');
class Ledger{
 constructor(storage,options={}){this.storage=storage;this.test=options.test===true;this.db={exec:sql=>{for(const q of sql.split(';').filter(q=>q.trim()))storage.sql.exec(q)},prepare:sql=>({get:(...a)=>storage.sql.exec(sql,...a).toArray()[0],all:(...a)=>storage.sql.exec(sql,...a).toArray(),run:(...a)=>{const c=storage.sql.exec(sql,...a);return {changes:c.rowsWritten};}})};this.now=options.now||(()=>Date.now());this.p=options.p??0.01;this.random=options.random||Math.random;this.db.exec(`CREATE TABLE IF NOT EXISTS cards(code TEXT PRIMARY KEY, norm TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, request_id TEXT UNIQUE NOT NULL, browser_id TEXT NOT NULL, issued_day TEXT NOT NULL, expires_day TEXT NOT NULL, week TEXT NOT NULL, redeemed_at TEXT);CREATE TABLE IF NOT EXISTS attempts(request_id TEXT PRIMARY KEY, browser_id TEXT NOT NULL, day TEXT NOT NULL, outcome TEXT NOT NULL, code TEXT, UNIQUE(browser_id,day));CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,event TEXT NOT NULL,code TEXT,created_at TEXT NOT NULL);`);}
 tx(fn){return this.storage.transactionSync(fn);}
 event(event,code=null){this.db.prepare('INSERT INTO events(event,code,created_at) VALUES(?,?,?)').run(event,code,new Date(this.now()).toISOString());}
 state(card){return card.redeemed_at?'redeemed':berlinDate(this.now())>card.expires_day?'expired':'unredeemed';}
 public(card){return {test:this.test,code:card.code,issuedDay:card.issued_day,expiresDay:card.expires_day,status:this.state(card)};}
 claim(input){return this.tx(()=>{
  const {requestId,browserId,page}=input;const day=berlinDate(this.now());
  if(!/^[a-zA-Z0-9_-]{24,128}$/.test(requestId||'')||!/^[a-zA-Z0-9_-]{24,128}$/.test(browserId||''))return {httpStatus:400,error:'invalid_request'};
  if(!['/jeden-tag-neu.html','/selbstgemacht.html','/ruhiger-tisch.html'].includes(page))return {httpStatus:400,error:'ineligible_page'};
  const old=this.db.prepare('SELECT * FROM attempts WHERE request_id=?').get(requestId);
  if(old){if(old.browser_id!==browserId)return {httpStatus:403,error:'wrong_browser'};const card=old.code&&this.db.prepare('SELECT * FROM cards WHERE code=?').get(old.code);return card?{httpStatus:200,outcome:'issued',...this.public(card),token:card.token,retry:true}:{httpStatus:200,outcome:old.outcome,retry:true};}
  if(this.db.prepare('SELECT 1 FROM attempts WHERE browser_id=? AND day=?').get(browserId,day))return {httpStatus:200,outcome:'already_tried'};
  const recent=this.db.prepare('SELECT * FROM cards WHERE browser_id=? ORDER BY issued_day DESC').all(browserId);
  if(recent.some(c=>this.state(c)==='unredeemed'||c.issued_day.slice(0,7)===day.slice(0,7)))return {httpStatus:200,outcome:'already_has_card'};
  this.event('egg_eligible');let outcome='not_selected',code=null,card;
  if(this.random()<this.p){if(this.db.prepare('SELECT COUNT(*) AS n FROM cards WHERE week=?').get(week(day)).n>=3)outcome='week_full';else{
   const used=new Set(this.db.prepare('SELECT code FROM cards').all().map(c=>c.code));const available=[];for(const w of WORDS)for(let a=2;a<=9;a++)for(let b=2;b<=9;b++){const c=`${w}-${a}${b}`;if(!used.has(c))available.push(c);}
   if(!available.length)outcome='codes_exhausted';else{code=available[randomInt(available.length)];const readToken=token();this.db.prepare('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,NULL)').run(code,normalize(code),readToken,requestId,browserId,day,addDays(day,14),week(day));card=this.db.prepare('SELECT * FROM cards WHERE code=?').get(code);outcome='issued';}
  }}
  this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(requestId,browserId,day,outcome,code);return card?{httpStatus:200,outcome,eligible:true,...this.public(card),token:card.token}:{httpStatus:200,outcome,eligible:true};
 });}
 shown(token){return this.tx(()=>{const c=this.db.prepare('SELECT * FROM cards WHERE token=?').get(token);if(!c)return {httpStatus:404,error:'not_found'};const first=!this.db.prepare("SELECT 1 FROM events WHERE event='egg_shown' AND code=?").get(c.code);if(first)this.event('egg_shown',c.code);return {httpStatus:200,ok:true,first};});}
 lookupToken(token){const c=this.db.prepare('SELECT * FROM cards WHERE token=?').get(token);return c?{httpStatus:200,...this.public(c)}:{httpStatus:404,error:'not_found'};}
 list(code='',filter='unredeemed'){return this.db.prepare('SELECT * FROM cards ORDER BY issued_day DESC,code').all().filter(c=>code?c.norm===normalize(code):filter==='all'||this.state(c)===filter).map(c=>this.public(c));}
 redeem(code){return this.tx(()=>{const c=this.db.prepare('SELECT * FROM cards WHERE norm=?').get(normalize(code));if(!c)return {httpStatus:404,error:'not_found'};const status=this.state(c);if(status!=='unredeemed')return {httpStatus:409,error:status,...this.public(c)};const changed=this.db.prepare('UPDATE cards SET redeemed_at=? WHERE code=? AND redeemed_at IS NULL').run(new Date(this.now()).toISOString(),c.code);if(changed.changes!==1)return {httpStatus:409,error:'redeemed'};this.event('egg_redeemed',c.code);return {httpStatus:200,...this.public(this.db.prepare('SELECT * FROM cards WHERE code=?').get(c.code))};});}
}




export {Ledger,berlinDate,addDays,week};
const publicPaths=new Set(['/cupcake/claim','/cupcake/status','/cupcake/shown']);
const origins=new Set(['https://nichinichi-cafe.de','https://www.nichinichi-cafe.de','https://nichinichi-cafe.github.io']);
export class CupcakeLedger {
 constructor(ctx,env){this.storage=ctx.storage;const p=Number(env.CUPCAKE_PROBABILITY??'.02');this.ledger=new Ledger(ctx.storage,{p:Number.isFinite(p)&&p>=0&&p<=1?p:.02,test:env.CUPCAKE_TEST_MODE==='true'});}
 async fetch(request){try{const u=new URL(request.url),route=u.pathname,ledger=request.headers.get('X-Cupcake-Verification')==='1'?new Ledger(this.storage,{p:1,test:true}):this.ledger;let result;
 if(route==='/claim'&&request.method==='POST'){const text=await request.text();if(text.length>4096)return Response.json({error:'too_large'},{status:413});result=ledger.claim(JSON.parse(text));}
 else if(route==='/status'&&request.method==='GET')result=ledger.lookupToken((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
 else if(route==='/shown'&&request.method==='POST')result=ledger.shown((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
 else if(route==='/admin/cards'&&request.method==='GET')return Response.json({cards:ledger.list(u.searchParams.get('code'),u.searchParams.get('filter')||'unredeemed')});
 else if(route==='/admin/redeem'&&request.method==='POST'){const text=await request.text();if(text.length>1024)return Response.json({error:'too_large'},{status:413});result=ledger.redeem(JSON.parse(text).code);}
 else return Response.json({error:'not_found'},{status:404});
 return Response.json(result,{status:result.httpStatus||200});
 }catch{return Response.json({error:'service_unavailable'},{status:503});}}
}
const verificationSign=async(secret,text)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('cupcake-verification:'+text)))].map(b=>b.toString(16).padStart(2,'0')).join('');};
export async function handleCupcake(request,env,isAdmin){
 const u=new URL(request.url);let verificationId=null;
 if(u.pathname==='/cupcake/admin/verification'&&request.method==='POST'){
  if(!isAdmin||!env.ADMIN_TOKEN)return Response.json({error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  const payload=crypto.randomUUID()+'.'+String(Date.now()+3600000);return Response.json({run:payload+'.'+await verificationSign(env.ADMIN_TOKEN,payload)},{headers:{'Cache-Control':'no-store'}});
 }
 if(u.pathname.startsWith('/cupcake/verify/')){
  const m=u.pathname.match(/^\/cupcake\/verify\/([a-f0-9-]{36})\.([0-9]{13})\.([a-f0-9]{64})(\/cupcake\/.*)$/);
  if(!m||!env.ADMIN_TOKEN||Number(m[2])<Date.now()||Number(m[2])>Date.now()+3600000)return Response.json({error:'invalid_verification'},{status:403});
  const expected=await verificationSign(env.ADMIN_TOKEN,m[1]+'.'+m[2]);let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^m[3].charCodeAt(i);
  if(diff)return Response.json({error:'invalid_verification'},{status:403});verificationId=m[1];u.pathname=m[4];
 }
 const isPublic=publicPaths.has(u.pathname),isManagement=['/cupcake/admin/cards','/cupcake/admin/redeem'].includes(u.pathname);
 const origin=request.headers.get('Origin');const allowed=origin&&(origins.has(origin)||(env.CUPCAKE_TEST_MODE==='true'&&env.CUPCAKE_PREVIEW_ORIGIN?.split(',').includes(origin)));
 const cors=isPublic&&allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}:{};
 const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
 if(!isPublic&&!isManagement)return reply({error:'not_found'},404);
 if(isManagement&&!(isAdmin&&typeof env.ADMIN_TOKEN==='string'&&env.ADMIN_TOKEN.length))return reply({error:'unauthorized'},401);
 if(isPublic&&request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors});
 if(isPublic&&!allowed)return reply({error:'origin_denied'},403);
 if(u.pathname==='/cupcake/claim'&&request.method==='POST'&&env.CUPCAKE_ENABLED!=='true'&&!verificationId)return reply({outcome:'disabled'});
 if(!env.CUPCAKE_LEDGER)return reply({error:'not_configured'},503);
 const target=new URL('https://cupcake.internal'+u.pathname.slice('/cupcake'.length));for(const key of ['code','filter'])if(u.searchParams.has(key))target.searchParams.set(key,u.searchParams.get(key));
 const forwarded=new Headers(request.headers);forwarded.delete('X-Cupcake-Verification');if(verificationId)forwarded.set('X-Cupcake-Verification','1');
 try{const r=await env.CUPCAKE_LEDGER.get(env.CUPCAKE_LEDGER.idFromName(verificationId?'verification:'+verificationId:'good-day-cupcake-global-v1')).fetch(new Request(target,{method:request.method,headers:forwarded,...(['GET','HEAD'].includes(request.method)?{}:{body:request.body})}));const headers=new Headers(r.headers);headers.set('Cache-Control','no-store');for(const[k,v]of Object.entries(cors))headers.set(k,v);return new Response(r.body,{status:r.status,headers});}catch{return reply({error:'service_unavailable'},503);}
}
