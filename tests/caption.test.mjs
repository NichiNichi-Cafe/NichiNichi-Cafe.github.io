import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/js/calendar-data.js';
globalThis.window={NICHI_CALENDAR:globalThis.NICHI_CALENDAR};
await import('../assets/js/calendar-export.js');
const config={weeklyHours:{1:[{kind:'cafe',start:'12:00',end:'14:00'},{kind:'mondstube',start:'18:00',end:'20:00'}]}};
const exceptions=[
  {date:'2026-10-22',type:'special',periods:[{kind:'mondstube',start:'17:00',end:'19:00',event:{type:'other',title:'Autumn TEST',description:'Special opening'}}]},
  {date:'2026-10-23',type:'closed',periods:[]},
  {date:'2026-10-26',type:'special',periods:[config.weeklyHours[1][0],{...config.weeklyHours[1][1],event:{type:'dnd',title:'D&D',description:'Bring dice'}}]}
];
test('IG caption localizes dates and groups each date once, omitting unchanged cafe slots',()=>{
  for(const [lang,dates] of [['de',['22.10.','23.10.','26.10.']],['en',['22 Oct','23 Oct','26 Oct']]]){
    const snap=window.NICHI_CALENDAR.month(2026,9,config,exceptions);
    const text=window.NICHI_CALENDAR_EXPORT(snap,config,lang).caption;
    for(const date of dates)assert.equal(text.split(date+' · ').length-1,1,text);
    assert(!text.includes('2026-10-'));
    const section=text.split('\n\n').find(s=>s.startsWith(dates[2]+' · '));
    assert(section.includes('Mondstube 18:00–20:00\nBring dice'));
    assert(!section.includes('Café'));
    assert(section.includes(lang==='de'?'Von Oktober bis März':'From October to March'));
    assert(text.includes('Autumn TEST\nSpecial opening'));
  }
});
test('changed non-event hours and removed baseline periods remain represented',()=>{
  for(const periods of [[{kind:'cafe',start:'13:00',end:'14:00'}],[config.weeklyHours[1][0]],[]]){
    const snap=window.NICHI_CALENDAR.month(2026,9,config,[{date:'2026-10-26',type:'special',periods}]);
    const text=window.NICHI_CALENDAR_EXPORT(snap,config,'de').caption;
    assert(text.includes('26.10. · '+(periods.length?'Café '+periods[0].start+'–14:00':'Geschlossen')));
  }
});
