import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.mjs';
import {fixture} from './worker-fixture.mjs';
test('migration public API allows exact old and new origins without authorizing writes',async()=>{
 const {env,entries}=fixture();
 for(const origin of ['https://nichinichi-cafe.github.io','https://nichinichi-cafe.de','https://www.nichinichi-cafe.de','https://evil.example','https://nichinichi-cafe.de.evil.example','null']){
  for(const route of ['/status','/notice','/opening-exceptions','/state','/little-note'])for(const method of ['GET','OPTIONS']){
   const r=await worker.fetch(new Request('https://worker.test'+route,{method,headers:{Origin:origin}}),env);
   assert.equal(r.status,method==='GET'?200:204);
   assert.equal(r.headers.get('Access-Control-Allow-Origin'),['https://nichinichi-cafe.github.io','https://nichinichi-cafe.de','https://www.nichinichi-cafe.de'].includes(origin)?origin:null);
   assert.equal(r.headers.get('Vary'),'Origin');
  }
  const denied=await worker.fetch(new Request('https://worker.test/little-note',{method:'POST',headers:{Origin:origin},body:JSON.stringify({text:'must not write'})}),env);assert.equal(denied.status,401);
 }
 assert.equal(entries.size,0);
});
