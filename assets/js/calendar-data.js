/* Shared by public calendar, exports and the existing Cockpit. No network writes. */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  function dateKey(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  function berlinToday(now = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function plusDays(key, count) {
    const [y,m,d] = key.split('-').map(Number);
    return dateKey(new Date(Date.UTC(y,m-1,d+count)));
  }
  function periodsFor(key, config, exceptions) {
    const override = exceptions.find(item => item.date === key);
    if (override?.type === 'closed') return [];
    if (override?.type === 'special') return structuredClone(override.periods || []);
    const legacy = (config.specialDates || []).find(item => item.date === key);
    if (legacy?.closed) return [];
    const weekday = new Date(key+'T12:00:00Z').getUTCDay();
    return structuredClone(legacy?.hours || config.weeklyHours?.[weekday] || []);
  }
  function eventText(event, key, language) {
    if (!event) return [];
    const text = [event.title || (event.type === 'dnd' ? 'D&D' : ''), event.description || ''].filter(Boolean);
    if (event.type === 'dnd') {
      text.push(language === 'de' ? 'D&D-Abend: Der Innenraum ist heute belegt.' : 'D&D evening: Indoor seating is occupied tonight.');
      const month = Number(key.slice(5,7));
      if (month >= 10 || month <= 3) text.push(language === 'de'
        ? 'Von Oktober bis März empfehlen wir an D&D-Abenden Take-away.'
        : 'From October to March, we recommend take-away on D&D evenings.');
    }
    return text;
  }
  function month(year, monthIndex, config, exceptions) {
    const first = new Date(Date.UTC(year,monthIndex,1));
    const last = new Date(Date.UTC(year,monthIndex+1,0));
    const offset = (first.getUTCDay()+6)%7;
    const rows = Math.ceil((offset+last.getUTCDate())/7);
    const days = Array.from({length:last.getUTCDate()},(_,i)=>{
      const key=dateKey(new Date(Date.UTC(year,monthIndex,i+1)));
      const periods=periodsFor(key,config,exceptions);
      const exception=exceptions.find(e=>e.date===key);
      return {key,day:i+1,periods,closed:periods.length===0,exception:Boolean(exception),hasEvent:periods.some(p=>p.event)};
    });
    return {year:first.getUTCFullYear(),monthIndex:first.getUTCMonth(),offset,rows,days};
  }
  function periodLabel(p) { return `${p.kind === 'mondstube' ? 'Mondstube' : 'Café'} ${p.start}–${p.end}`; }
  root.NICHI_CALENDAR = {berlinToday,plusDays,periodsFor,eventText,month,periodLabel};
})(typeof window === 'undefined' ? globalThis : window);
