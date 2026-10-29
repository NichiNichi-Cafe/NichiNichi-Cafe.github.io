import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import runtime from '../cloudflare/calendar-runtime.mjs';
import {fixture} from './worker-fixture.mjs';

test('Cockpit bundles the exact shared schedule and model without external calendar dependencies',async()=>{
  const source=['site-data.js','calendar-data.js'].map(name=>fs.readFileSync(new URL('../assets/js/'+name,import.meta.url),'utf8')).join('\n');
  assert.equal(runtime,source,'Rebuild cloudflare/calendar-runtime.mjs after shared data changes');
  const {request}=fixture();const html=await (await request('/admin')).text();
  assert(html.includes(runtime));assert(!/<script src="[^"\n]+\/(site-data|calendar-data)\.js/.test(html));
  assert(html.includes('hours-24h-summary'));assert(!html.includes('今日公告'));assert(!html.includes('notice-custom'));
});

test('old stored notices never appear and cached clients cannot republish them',async()=>{
  const {entries,request,writes}=fixture();
  entries.set('daily-notice',JSON.stringify({messages:{de:'OLD PRIVATE NOTICE',en:'OLD PRIVATE NOTICE'},expiresAt:Date.now()+3600000}));
  assert.deepEqual(await (await request('/notice')).json(),{active:false,notice:null});
  const state=await (await request('/state')).json();assert.deepEqual(state.notice,{active:false,notice:null});assert(!JSON.stringify(state).includes('OLD PRIVATE NOTICE'));
  assert.equal((await request('/notice','POST',{text:'new'},false)).status,401);
  assert.equal((await request('/notice','POST',{text:'new'})).status,410);assert.equal(writes.length,0);
  await request('/notice','DELETE');assert(!entries.has('daily-notice'));
});
