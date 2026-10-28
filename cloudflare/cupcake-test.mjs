// Isolated Cloudflare SQLite Durable Object TEST ledger.
// Real cupcake issuance is not enabled; this Worker serves TEST cards only.
const randomInt=n=>{const b=new Uint32Array(1),limit=4294967296-(4294967296%n);do{crypto.getRandomValues(b)}while(b[0]>=limit);return b[0]%n;};const token=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
const WORDS='MOND MOOS BACH FUCHS KLEE STERN FARN QUELLE DACHS ASTER SONNE LINDE KIESEL IGEL TULPE WOLKE EICHE STEIN EULE WIESE REGEN BIRKE FELS MEISE BLATT NEBEL ERLE PFAD SPATZ ZWEIG TAU BUCHE FUNKE REH FEDER WIND HASE FALTER KATZE FROSCH'.split(' ');
function berlinDate(now){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function week(day){const d=new Date(day+'T12:00:00Z');return addDays(day,-((d.getUTCDay()+6)%7));}
const normalize=s=>String(s||'').toUpperCase().replace(/[\s-]/g,'');
class Ledger{
 constructor(storage,options={}){this.storage=storage;this.db={exec:sql=>{for(const q of sql.split(';').filter(q=>q.trim()))storage.sql.exec(q)},prepare:sql=>({get:(...a)=>storage.sql.exec(sql,...a).toArray()[0],all:(...a)=>storage.sql.exec(sql,...a).toArray(),run:(...a)=>{const c=storage.sql.exec(sql,...a);return {changes:c.rowsWritten};}})};this.now=options.now||(()=>Date.now());this.p=options.p??0.01;this.random=options.random||Math.random;this.db.exec(`CREATE TABLE IF NOT EXISTS cards(code TEXT PRIMARY KEY, norm TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, request_id TEXT UNIQUE NOT NULL, browser_id TEXT NOT NULL, issued_day TEXT NOT NULL, expires_day TEXT NOT NULL, week TEXT NOT NULL, redeemed_at TEXT);CREATE TABLE IF NOT EXISTS attempts(request_id TEXT PRIMARY KEY, browser_id TEXT NOT NULL, day TEXT NOT NULL, outcome TEXT NOT NULL, code TEXT, UNIQUE(browser_id,day));CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,event TEXT NOT NULL,code TEXT,created_at TEXT NOT NULL);`);}
 tx(fn){return this.storage.transactionSync(fn);}
 event(event,code=null){this.db.prepare('INSERT INTO events(event,code,created_at) VALUES(?,?,?)').run(event,code,new Date(this.now()).toISOString());}
 state(card){return card.redeemed_at?'redeemed':berlinDate(this.now())>card.expires_day?'expired':'unredeemed';}
 public(card){return {test:true,code:card.code,issuedDay:card.issued_day,expiresDay:card.expires_day,status:this.state(card)};}
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
   const available=[];for(const w of WORDS)for(let a=2;a<=9;a++)for(let b=2;b<=9;b++){const c=`${w}-${a}${b}`;if(!this.db.prepare('SELECT 1 FROM cards WHERE code=?').get(c))available.push(c);}
   if(!available.length)outcome='codes_exhausted';else{code=available[randomInt(available.length)];const readToken=token();this.db.prepare('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,NULL)').run(code,normalize(code),readToken,requestId,browserId,day,addDays(day,14),week(day));card=this.db.prepare('SELECT * FROM cards WHERE code=?').get(code);outcome='issued';}
  }}
  this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(requestId,browserId,day,outcome,code);return card?{httpStatus:200,outcome,...this.public(card),token:card.token}:{httpStatus:200,outcome};
 });}
 shown(token){return this.tx(()=>{const c=this.db.prepare('SELECT * FROM cards WHERE token=?').get(token);if(!c)return {httpStatus:404,error:'not_found'};if(!this.db.prepare("SELECT 1 FROM events WHERE event='egg_shown' AND code=?").get(c.code))this.event('egg_shown',c.code);return {httpStatus:200,ok:true};});}
 lookupToken(token){const c=this.db.prepare('SELECT * FROM cards WHERE token=?').get(token);return c?{httpStatus:200,...this.public(c)}:{httpStatus:404,error:'not_found'};}
 list(code='',filter='unredeemed'){return this.db.prepare('SELECT * FROM cards ORDER BY issued_day DESC,code').all().filter(c=>code?c.norm===normalize(code):filter==='all'||this.state(c)===filter).map(c=>this.public(c));}
 redeem(code){return this.tx(()=>{const c=this.db.prepare('SELECT * FROM cards WHERE norm=?').get(normalize(code));if(!c)return {httpStatus:404,error:'not_found'};const status=this.state(c);if(status!=='unredeemed')return {httpStatus:409,error:status,...this.public(c)};const changed=this.db.prepare('UPDATE cards SET redeemed_at=? WHERE code=? AND redeemed_at IS NULL').run(new Date(this.now()).toISOString(),c.code);if(changed.changes!==1)return {httpStatus:409,error:'redeemed'};this.event('egg_redeemed',c.code);return {httpStatus:200,...this.public(this.db.prepare('SELECT * FROM cards WHERE code=?').get(c.code))};});}
}



import art from './cupcake-test-art.png';
import {guest as GUEST,css as CSS,ui as UI} from './cupcake-test-assets.mjs';
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const hmac=async(secret,text)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');};
async function validRun(value,secret){if(!secret||!/^[-a-f0-9]{36}\.[a-f0-9]{64}$/.test(value||''))return null;const [id,sig]=value.split('.'),actual=await hmac(secret,'cupcake-test:'+id);let mismatch=0;for(let i=0;i<sig.length;i++)mismatch|=sig.charCodeAt(i)^actual.charCodeAt(i);return mismatch?null:id;}
export class CupcakeTestLedger{
 constructor(ctx,env){this.ledger=new Ledger(ctx.storage,{p:1});}
 async fetch(request){try{const u=new URL(request.url);let result;
 if(u.pathname==='/claim'&&request.method==='POST'){const text=await request.text();if(text.length>4096)return respond({error:'too_large'},413);result=this.ledger.claim(JSON.parse(text));}
 else if(u.pathname==='/status'&&request.method==='GET')result=this.ledger.lookupToken((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
 else if(u.pathname==='/shown'&&request.method==='POST')result=this.ledger.shown((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
 else if(u.pathname==='/cards'&&request.method==='GET')return respond({cards:this.ledger.list(u.searchParams.get('code'),u.searchParams.get('filter')||'unredeemed')});
 else if(u.pathname==='/redeem'&&request.method==='POST'){const text=await request.text();if(text.length>1024)return respond({error:'too_large'},413);result=this.ledger.redeem(JSON.parse(text).code);}
 else return respond({error:'not_found'},404);
 return respond(result,result.httpStatus||200);
 }catch{return respond({error:'service_unavailable'},503);}}
}
export async function handleCupcakeTest(request,env,isAdmin){
 const u=new URL(request.url),p=u.pathname;
 const html=value=>new Response(value,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
 if(request.method==='GET'&&(p==='/cupcake-test'||p==='/cupcake-test/'))return html(UI);
 if(request.method==='GET'&&p==='/cupcake-test/ui.css')return new Response(CSS,{headers:{'Content-Type':'text/css','Cache-Control':'no-store'}});
 if(request.method==='GET'&&p==='/cupcake-test/art.png')return new Response(art,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}});
 if(p==='/cupcake-test/api/start'&&request.method==='POST'){if(!isAdmin)return respond({error:'unauthorized'},401);const id=crypto.randomUUID();return respond({run:id+'.'+await hmac(env.ADMIN_TOKEN,'cupcake-test:'+id)});}
 const id=await validRun(u.searchParams.get('run'),env.ADMIN_TOKEN);if(!id)return respond({error:'invalid_test_run'},403);
 if(p==='/cupcake-test/card'&&request.method==='GET')return html(GUEST);
 const route=p.replace('/cupcake-test/api','');
 if(!['/claim','/status','/shown','/cards','/redeem'].includes(route))return respond({error:'not_found'},404);
 if(['/cards','/redeem'].includes(route)&&!isAdmin)return respond({error:'unauthorized'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return respond({error:'origin_denied'},403);
 if(!env.CUPCAKE_TEST)return respond({error:'test_service_unavailable'},503);
 const dest=new URL('https://cupcake.internal'+route);for(const key of ['code','filter'])if(u.searchParams.has(key))dest.searchParams.set(key,u.searchParams.get(key));
 try{return await env.CUPCAKE_TEST.get(env.CUPCAKE_TEST.idFromName('test:'+id)).fetch(new Request(dest,{method:request.method,headers:request.headers,...(['GET','HEAD'].includes(request.method)?{}:{body:request.body})}));}catch{return respond({error:'test_service_unavailable'},503);}
}
