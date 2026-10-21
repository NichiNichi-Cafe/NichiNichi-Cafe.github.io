import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.mjs';

test('full take-away message follows existing seat clear and expiry', async () => {
  const {request,entries}=fixture();
  await request('/little-note','POST',{text:'keep note'});
  await request('/status','POST',{status:'full'});
  let seat=(await (await request('/status')).json()).status;
  assert.equal(seat.messages.de,'Zurzeit sind alle verfügbaren Plätze belegt. Take-away ist möglich.');
  assert.equal(seat.messages.en,'All available seats are currently occupied. Take-away is available.');
  await request('/status','DELETE');
  assert.deepEqual(await (await request('/status')).json(),{active:false,status:null});
  await request('/status','POST',{status:'full'});
  seat=JSON.parse(entries.get('seat-alert'));seat.expiresAt=Date.now()-1;entries.set('seat-alert',JSON.stringify(seat));
  assert.deepEqual(await (await request('/status')).json(),{active:false,status:null});
  assert.equal(entries.has('seat-alert'),false);
  for(const status of ['indoor-limited','garden-only']){
    await request('/status','POST',{status});
    const messages=(await (await request('/status')).json()).status.messages;
    assert(!messages.de.includes('Take-away'));assert(!messages.en.includes('Take-away'));
  }
  assert.equal((await (await request('/little-note')).json()).text,'keep note');
});

export function fixture() {
  const entries = new Map(), writes = [];
  const env = { ADMIN_TOKEN: 'local-test-only', STATUS_KV: {
    async get(key, format) { const v = entries.get(key); return v == null ? null : format === 'json' ? JSON.parse(v) : v; },
    async put(key, value, options) { entries.set(key, value); writes.push({key, options}); },
    async delete(key) { entries.delete(key); },
    async list({prefix}) { return { keys: [...entries.keys()].filter(k => k.startsWith(prefix)).map(name => ({name})), list_complete: true }; }
  }};
  const request = (path, method='GET', body, auth=true) => worker.fetch(new Request('https://local.test'+path, {
    method, headers: auth ? {Authorization: 'Bearer local-test-only'} : {},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  }), env);
  return { entries, writes, env, request };
}

test('persistent note overwrites, clears, and is separate from resets', async () => {
  const {request,entries,writes} = fixture();
  assert.equal((await (await request('/state')).json()).littleNote, '');
  assert.equal((await request('/little-note','POST',{text:'hello'},false)).status,401);
  assert.equal(entries.size,0);
  for (const text of ['first','<img src=x onerror=alert(1)>\n第二行']) {
    assert.equal((await request('/little-note','POST',{text})).status,200);
    assert.equal((await (await request('/state')).json()).littleNote,text);
  }
  assert.equal(writes.at(-1).options,undefined,'no expiration');
  await request('/status','POST',{status:'full'});
  await request('/notice','POST',{text:'operational'});
  await request('/reset-current','POST',{});
  const state=await (await request('/state')).json();
  assert.equal(state.seat.active,false); assert.equal(state.notice.active,false);
  assert.ok(state.littleNote.includes('第二行'));
  await request('/little-note','POST',{text:'  \n '});
  assert.equal((await (await request('/little-note')).json()).text,'');
  await request('/little-note','POST',{text:'again'});
  await request('/little-note','DELETE');
  assert.equal(entries.has('little-note'),false);
});

test('invalid input never overwrites the existing note; public CORS works', async () => {
  const {request}=fixture();
  await request('/little-note','POST',{text:'keep'});
  for(const text of [null,{},1,'x'.repeat(2001)]) assert.equal((await request('/little-note','POST',{text})).status,400);
  assert.equal((await (await request('/little-note')).json()).text,'keep');
  assert.equal((await request('/little-note','OPTIONS')).status,204);
  assert.equal((await request('/little-note')).headers.get('Access-Control-Allow-Origin'),'https://nichinichi-cafe.github.io');
});
