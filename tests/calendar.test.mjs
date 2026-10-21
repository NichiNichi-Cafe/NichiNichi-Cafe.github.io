import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/calendar-data.js';
import { fixture } from './worker-fixture.mjs';
const model=globalThis.NICHI_CALENDAR;
const config={weeklyHours:{1:[{start:'12:00',end:'14:00',kind:'cafe'},{start:'18:00',end:'20:00',kind:'mondstube'}]}};

test('Monday-first month geometry includes four, five and six rows and leap day',()=>{
  assert.equal(model.month(2021,1,config,[]).rows,4);
  assert.equal(model.month(2026,9,config,[]).rows,5);
  assert.equal(model.month(2026,2,config,[]).rows,6);
  assert.equal(model.month(2024,1,config,[]).days.length,29);
  assert.equal(model.month(2026,11,config,[]).offset,1);
  assert.equal(model.month(2026,12,config,[]).year,2027);
  assert.equal(model.berlinToday(new Date('2026-10-20T22:30:00Z')),'2026-10-21');
});

test('overrides preserve separate cafe/evening periods and seasonal D&D is event-specific',()=>{
  const event={type:'dnd',title:'D&D',description:'Bring dice'};
  const periods=[...config.weeklyHours[1]];periods[1]={...periods[1],event};
  const result=model.periodsFor('2026-10-26',config,[{date:'2026-10-26',type:'special',periods}]);
  assert.equal(result.length,2);assert.equal(result[0].kind,'cafe');assert.equal(result[0].event,undefined);
  assert.deepEqual(model.periodsFor('2026-10-26',config,[{date:'2026-10-26',type:'closed'}]),[]);
  for(const month of [1,2,3,10,11,12])assert(model.eventText(event,`2026-${String(month).padStart(2,'0')}-01`,'en').some(t=>t.includes('recommend take-away')));
  for(const month of [4,5,6,7,8,9])assert(!model.eventText(event,`2026-${String(month).padStart(2,'0')}-01`,'en').some(t=>t.includes('recommend take-away')));
  assert(!model.eventText({...event,type:'other'},'2026-10-01','de').some(t=>t.includes('Innenraum')));
  assert(model.eventText(event,'2026-10-01','de').includes('D&D-Abend: Der Innenraum ist heute belegt.'));
  for(const title of ['', 'D&D']) assert(!model.eventText({...event,title},'2026-10-01','en').includes('D&D'));
});

test('Worker round-trips event metadata, rejects invalid events, and reset preserves schedule',async()=>{
  const {request,entries}=fixture();
  const date=model.plusDays(model.berlinToday(),1);
  const periods=[{start:'12:00',end:'14:00',kind:'cafe'},{start:'18:00',end:'20:00',kind:'mondstube',event:{type:'dnd',title:'Campaign',description:'Bring dice'}}];
  assert.equal((await request('/opening-exceptions','POST',{date,type:'special',periods})).status,200);
  assert.deepEqual((await (await request('/state')).json()).openingExceptions[0].periods,periods);
  const invalid=structuredClone(periods);invalid[1].event.type='invented';
  assert.equal((await request('/opening-exceptions','POST',{date,type:'special',periods:invalid})).status,400);
  await request('/reset-current','POST',{});assert(entries.has('opening:'+date));
});

test('Worker retains current-month past dates, removes older months, and reads every KV page',async()=>{
  const {request,env,entries}=fixture();const today=model.berlinToday(),first=today.slice(0,7)+'-01';
  const old=model.plusDays(first,-1),future=model.plusDays(today,10);
  for(const date of [old,first,future])entries.set('opening:'+date,JSON.stringify({date,type:'closed',periods:[]}));
  let calls=0;env.STATUS_KV.list=async({cursor})=>{calls++;return cursor?{keys:[{name:'opening:'+future}],list_complete:true}:{keys:[{name:'opening:'+old},{name:'opening:'+first}],list_complete:false,cursor:'page2'};};
  const data=await (await request('/opening-exceptions')).json();
  assert.equal(calls,2);assert.deepEqual(data.exceptions.map(e=>e.date),[first,future]);assert(!entries.has('opening:'+old));
});
