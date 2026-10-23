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
    const layout=model.operatingLayout(config,lang());
    const complete=ready && retained();
    el('calendar-month').textContent=monthName();
    el('calendar-message').textContent=!retained()?t('Für vergangene Monate gibt es kein Veranstaltungsarchiv.','There is no event archive for past months.')
      :ready?''
      :t('Live-Kalenderdaten nicht geladen. Aktivitäten und Ausnahmen können fehlen. Bitte erneut laden.','Live calendar data has not loaded. Events and exceptions may be missing. Please reload.');
    const hours=el('calendar-hours');hours.replaceChildren();
    for(const line of layout.summary){
      const row=append(hours,'p','');
      line.split(' · ').forEach((part,i)=>{
        if(i)row.appendChild(document.createTextNode(' · '));
        append(row,'span',part,'calendar-hours__part');
      });
    }
    const grid=el('calendar-grid');grid.replaceChildren();
    const tracks=[],positions=[];
    for(const [i,weekday] of layout.columns.entries()){
      if(layout.breaks[i])tracks.push('clamp(10px,2vw,28px)');
      positions.push(tracks.length+1);tracks.push('minmax(0,1fr)');
      const header=append(grid,'div',layout.weekdays[layout.orderedDays.indexOf(weekday)],'calendar-weekday');header.style.gridColumn=positions[i];
    }
    grid.style.gridTemplateColumns=tracks.join(' ') || '1fr';
    const select=day=>{
      selected=day.key;
      document.querySelectorAll('#calendar-grid button, #calendar-special-openings button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.date===selected)));
      detail(day);
    };
    if(!snapshot.days.some(d=>d.key===selected))selected=snapshot.days[0].key;
    for(const day of snapshot.days){
      const weekday=new Date(day.key+'T12:00:00Z').getUTCDay(),col=layout.columns.indexOf(weekday);
      if(col<0)continue;
      const button=append(grid,'button','','calendar-day');button.type='button';button.dataset.date=day.key;
      button.style.gridColumn=positions[col];button.style.gridRow=Math.floor((snapshot.offset+day.day-1)/7)+2;
      button.setAttribute('aria-pressed',String(day.key===selected));
      const marker=complete?(day.closed?t('Zu','Closed'):(day.hasEvent || day.exception)?'●':''):'';
      button.setAttribute('aria-label',`${day.key}${complete?': '+(day.closed?t('Geschlossen','Closed'):day.periods.map(model.periodLabel).join(', '))+(day.hasEvent?', '+t('Aktivität','Event'):''):''}`);
      append(button,'strong',String(day.day));append(button,'span',marker,'calendar-day__marker'+(complete && day.closed?' calendar-day__marker--closed':''));
      button.addEventListener('click',()=>select(day));
    }
    for(let row=0;row<snapshot.rows;row++)for(const [col,weekday] of layout.columns.entries()){
      const day=row*7+layout.orderedDays.indexOf(weekday)-snapshot.offset+1;
      if(day>=1 && day<=snapshot.days.length)continue;
      const empty=append(grid,'div','','calendar-empty');empty.style.gridColumn=positions[col];empty.style.gridRow=row+2;
    }
    const special=el('calendar-special-openings');special.replaceChildren();
    if(complete)for(const day of snapshot.days.filter(d=>!layout.columns.includes(new Date(d.key+'T12:00:00Z').getUTCDay()) && !d.closed)){
      const label=t('+ Sonderöffnung: ','+ Special opening: ')+day.key.slice(8,10)+'.'+day.key.slice(5,7)+'.';
      const button=append(special,'button',label);button.type='button';button.dataset.date=day.key;button.setAttribute('aria-pressed',String(day.key===selected));
      button.addEventListener('click',()=>select(day));
    }
    detail(snapshot.days.find(d=>d.key===selected));
    const weekly=el('calendar-weekly');weekly.replaceChildren();
    for(const item of config.weeklyActivities || [])append(weekly,'li',item[lang()]);
    el('calendar-caption').value=[monthName(),...(config.weeklyActivities || []).map(a=>a[lang()]),t('Aktuelle Informationen:','Current information:')+' https://nichinichi-cafe.de/kalender/'].join('\n');
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
