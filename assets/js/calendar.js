(() => {
  'use strict';
  const model = window.NICHI_CALENDAR, config = window.NICHI_SITE;
  const el = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'de';
  const t = (de,en) => lang() === 'de' ? de : en;
  const today = model.berlinToday();
  let year = Number(today.slice(0,4)), month = Number(today.slice(5,7))-1;
  let selected = today, exceptions = [], ready = false, snapshot;
  const locale = () => lang() === 'de' ? 'de-DE' : 'en-GB';
  const monthName = () => new Intl.DateTimeFormat(locale(),{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1)));
  const weekNames = () => Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale(),{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,5+i))));
  const retained = () => `${year}-${String(month+1).padStart(2,'0')}` >= today.slice(0,7);
  const append = (parent,tag,text,className) => {
    const node=document.createElement(tag); node.textContent=text;
    if(className)node.className=className; parent.appendChild(node);return node;
  };
  function detail(day) {
    const box=el('calendar-detail');box.replaceChildren();
    append(box,'h3',new Intl.DateTimeFormat(locale(),{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(day.key+'T12:00:00Z')));
    if(!ready || !retained()) { append(box,'p',t('Vollständige Tagesdaten sind nicht verfügbar.','Complete day information is unavailable.'));return; }
    if(day.closed)append(box,'p',t('Geschlossen','Closed'));
    for(const p of day.periods){
      append(box,'h4',model.periodLabel(p));
      for(const text of model.eventText(p.event,day.key,lang()))append(box,'p',text);
    }
    if(day.hasEvent)append(box,'p',t('Diese Angaben gelten für die Zeit der Aktivität.','These details apply to the event time only.'));
  }
  function render() {
    if(!config || !model)return;
    snapshot=model.month(year,month,config,ready && retained()?exceptions:[]);
    const complete=ready && retained();
    el('calendar-month').textContent=monthName();
    el('calendar-message').textContent=!retained()?t('Für vergangene Monate gibt es kein Veranstaltungsarchiv.','There is no event archive for past months.')
      :ready?''
      :t('Live-Kalenderdaten nicht geladen. Aktivitäten und Ausnahmen können fehlen. Bitte erneut laden.','Live calendar data has not loaded. Events and exceptions may be missing. Please reload.');
    const grid=el('calendar-grid');grid.replaceChildren();
    for(const name of weekNames())append(grid,'div',name,'calendar-weekday');
    for(let i=0;i<snapshot.offset;i++)append(grid,'div','','calendar-empty');
    if(!snapshot.days.some(d=>d.key===selected))selected=snapshot.days[0].key;
    for(const day of snapshot.days){
      const button=append(grid,'button','','calendar-day');button.type='button';button.dataset.date=day.key;
      button.setAttribute('aria-pressed',String(day.key===selected));
      const marker=complete?(day.hasEvent?'●':day.closed?'×':day.exception?'◇':''):'';
      button.setAttribute('aria-label',`${day.key}${complete?': '+(day.closed?t('Geschlossen','Closed'):day.periods.map(model.periodLabel).join(', '))+(day.hasEvent?', '+t('Aktivität','Event'):''):''}`);
      append(button,'strong',String(day.day));append(button,'span',marker,'calendar-day__marker');
      append(button,'span',complete?(day.closed?t('Geschlossen','Closed'):day.periods.map(p=>model.periodLabel(p)+(p.event?' · '+(p.event.title || (p.event.type==='dnd'?'D&D':t('Aktivität','Event'))):'')).join('\n')):'—','calendar-day__summary');
      button.addEventListener('click',()=>{
        selected=day.key;
        grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.date===selected)));
        detail(day);
      });
    }
    for(let i=snapshot.offset+snapshot.days.length;i<snapshot.rows*7;i++)append(grid,'div','','calendar-empty');
    detail(snapshot.days.find(d=>d.key===selected));
    const weekly=el('calendar-weekly');weekly.replaceChildren();
    for(const item of config.weeklyActivities || [])append(weekly,'li',item[lang()]);
    el('calendar-caption').value=[monthName(),...(config.weeklyActivities || []).map(a=>a[lang()]),t('Aktuelle Informationen:','Current information:')+' https://nichinichi-cafe.github.io/kalender/'].join('\n');
    el('export-ig').disabled=!complete;el('export-a4').disabled=!complete;
  }
  // Artwork uses the same frozen month model as the public calendar.
  async function exportImage(format) {
    if(!ready || !retained())return;
    const frozen=structuredClone(snapshot), language=lang();
    const artwork=window.NICHI_CALENDAR_EXPORT(frozen,config,language);
    const canvas=artwork.draw(format);
    el('calendar-caption').value=artwork.caption;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    a.download=`NichiNichi-${frozen.year}-${String(frozen.monthIndex+1).padStart(2,'0')}-${language}-${format}.png`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  for(const [id,step] of [['calendar-prev',-1],['calendar-next',1]])el(id).addEventListener('click',()=>{
    const next=new Date(Date.UTC(year,month+step,1));year=next.getUTCFullYear();month=next.getUTCMonth();render();
  });
  el('export-ig').addEventListener('click',()=>exportImage('ig'));
  el('export-a4').addEventListener('click',()=>exportImage('a4'));
  window.addEventListener('nichinichi-language',render);
  el('calendar-export-tools').hidden = !new URLSearchParams(location.search).has('export');
  render();
  fetch(config.liveStateEndpoint,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).then(data=>{
    if(!Array.isArray(data.openingExceptions))throw Error('invalid state');
    exceptions=data.openingExceptions;ready=true;render();
  }).catch(()=>{ready=false;render();});
})();
