import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {handleCupcake} from '../cloudflare/cupcake.mjs';
const source=fs.readFileSync(new URL('../assets/js/cupcake.js',import.meta.url),'utf8');
async function runWidget(initial,analyticsFailure=false){
 const data=new Map(Object.entries(initial)),calls=[],timers=[],elements=new Map();let created=0;
 const node=()=>({textContent:'',hidden:false,dataset:{},setAttribute(){},querySelector(){return {};},querySelectorAll(){return [];},set className(v){},set id(v){}});
 const document={currentScript:{dataset:{api:'https://worker.test',analytics:analyticsFailure?'on':'off'},src:'https://site.test/assets/js/cupcake.js'},documentElement:{lang:'de'},body:{append(){}},createElement(){created++;return node();},getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},addEventListener(){}};
 const context={document,location:{pathname:'/jeden-tag-neu.html',search:''},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},URL,URLSearchParams,Intl,Date,JSON,crypto,MutationObserver:class{observe(){}},window:{addEventListener(){},NICHI_CUPCAKE_METRIC(){throw Error('Analytics unavailable');}},setInterval(){},setTimeout:fn=>timers.push(fn),fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({outcome:'not_selected',eligible:true,test:!analyticsFailure})};}};
 vm.runInNewContext(source,context);for(const fn of timers)await fn();return {created,calls,data};
}
test('owner opt-out and same-origin Cockpit login stop before UI or claim',async()=>{
 for(const initial of [{'nichinichi-cupcake-owner-skip':'1'},{'nichinichi-status-admin-token':'fixture-only'}]){const r=await runWidget(initial);assert.equal(r.created,0);assert.equal(r.calls.length,0);}
});
test('ordinary browser still makes one claim and stores its daily outcome',async()=>{const r=await runWidget({});assert.equal(r.calls.length,1);assert.equal(r.calls[0].url,'https://worker.test/cupcake/claim');assert.equal(r.calls[0].options.method,'POST');assert(JSON.parse(r.data.get('nichinichi-good-day-cupcake-v1')).attemptDay);});
test('analytics failure cannot turn a completed draw into a pending retry',async()=>{const r=await runWidget({},true);const state=JSON.parse(r.data.get('nichinichi-good-day-cupcake-v1'));assert.equal(r.calls.length,1);assert.equal(state.pending,false);assert(state.attemptDay);});
const request=(path,method='GET',body,headers={})=>new Request('https://worker.test'+path,{method,headers:{Origin:'https://nichinichi-cafe.de',...headers},...(body?{body:JSON.stringify(body)}:{})});
test('verification sessions require admin, are signed, and cannot change customer ledger',async()=>{
 const seen=[];const env={ADMIN_TOKEN:'fixture-only',CUPCAKE_ENABLED:'false',CUPCAKE_LEDGER:{idFromName:name=>(seen.push({name}),name),get:()=>({fetch:async r=>{seen.push({verification:r.headers.get('X-Cupcake-Verification')});return Response.json({ok:true});}})}};
 assert.equal((await handleCupcake(request('/cupcake/admin/verification','POST',{}),env,false)).status,401);
 const start=await handleCupcake(request('/cupcake/admin/verification','POST',{}),env,true);const {run}=await start.json();assert.match(run,/^[a-f0-9-]{36}\.[0-9]{13}\.[a-f0-9]{64}$/);
 const valid=await handleCupcake(request('/cupcake/verify/'+run+'/cupcake/claim','POST'),env,false);assert.equal(valid.status,200);assert(seen[0].name.startsWith('verification:'));assert.equal(seen[1].verification,'1');
 assert.equal((await handleCupcake(request('/cupcake/verify/'+run.slice(0,-1)+(run.endsWith('0')?'1':'0')+'/cupcake/claim','POST',{}),env,false)).status,403);
 assert.equal((await handleCupcake(request('/cupcake/verify/'+run+'/cupcake/admin/cards'),env,false)).status,401);
});
test('customer gate stays off and forged verification header is stripped',async()=>{
 const seen=[];const env={ADMIN_TOKEN:'fixture-only',CUPCAKE_ENABLED:'false',CUPCAKE_LEDGER:{idFromName:name=>(seen.push(name),name),get:()=>({fetch:async r=>{assert.equal(r.headers.get('X-Cupcake-Verification'),null);return Response.json({ok:true});}})}};
 const r=await handleCupcake(request('/cupcake/claim','POST',{}, {'X-Cupcake-Verification':'1'}),env,false);assert.equal((await r.json()).outcome,'disabled');assert.equal(seen.length,0);
 env.CUPCAKE_ENABLED='true';const allowed=await handleCupcake(request('/cupcake/claim','POST',undefined, {'X-Cupcake-Verification':'1'}),env,false);assert.equal(allowed.status,200);assert.deepEqual(seen,['good-day-cupcake-global-v1']);
});
