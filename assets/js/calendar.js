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
    if(day.hasEvent)append(box,'p',t('Die Angaben betreffen den jeweiligen Aktivitätszeitraum, nicht den gesamten Café-Tag.','These details apply to the event time, not the entire café day.'));
  }
  function render() {
    if(!config || !model)return;
    snapshot=model.month(year,month,config,ready && retained()?exceptions:[]);
    const complete=ready && retained();
    el('calendar-month').textContent=monthName();
    el('calendar-message').textContent=!retained()?t('Für vergangene Monate gibt es kein Veranstaltungsarchiv.','There is no event archive for past months.')
      :ready?t('Geplante Zeiten. Kurzfristige Hinweise stehen auf der Startseite.','Planned hours. See the homepage for short-notice updates.')
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
  // PNG content uses the same frozen month model as the on-screen calendar.
  async function exportImage(format) {
    if(!ready || !retained())return;
    const frozen=structuredClone(snapshot), language=lang(), name=monthName();
    const canvas=document.createElement('canvas');
    canvas.width=format==='ig'?1080:2480;canvas.height=format==='ig'?1080:3508;
    const ctx=canvas.getContext('2d'), scale=canvas.width/1080;
    ctx.scale(scale,scale);
    const height=canvas.height/scale;
    ctx.fillStyle='#f4efe4';ctx.fillRect(0,0,1080,height);
    ctx.fillStyle='#171310';ctx.textBaseline='top';
    ctx.font='24px Georgia';ctx.fillText('日日珈琲 · NichiNichi Café',48,32);
    ctx.font='38px Georgia';ctx.fillText(name,48,74);
    ctx.font='17px sans-serif';ctx.fillText(language==='de'?'● Aktivität · × Geschlossen · ◇ Geänderte Zeiten':'● Event · × Closed · ◇ Changed hours',48,130);
    const startY=195, cellW=984/7, cellH=format==='ig'?(950-startY)/frozen.rows:160;
    ctx.font='18px sans-serif';weekNames().forEach((s,i)=>ctx.fillText(s,48+i*cellW,166));
    function wrap(text,x,y,maxWidth,lineHeight,maxLines) {
      // Break long words as well as sentences; canvas clips no neighboring cell.
      let line='',lines=[];
      for(const char of text){if(char==='\n'||ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char==='\n'?'':char;}else line+=char;}
      if(line)lines.push(line);
      const overflow=lines.length>maxLines;lines=lines.slice(0,maxLines);
      if(overflow && lines.length){let last=lines.at(-1);while(ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[lines.length-1]=last+'…';}
      lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));return overflow;
    }
    const descriptions=[];
    for(const day of frozen.days){
      const pos=frozen.offset+day.day-1,x=48+(pos%7)*cellW,y=startY+Math.floor(pos/7)*cellH;
      ctx.strokeStyle='#c4bdb4';ctx.strokeRect(x,y,cellW,cellH);
      ctx.fillStyle='#171310';ctx.font='bold 22px sans-serif';ctx.fillText(String(day.day)+(day.hasEvent?' ●':day.closed?' ×':day.exception?' ◇':''),x+8,y+7);
      const lines=day.closed?[language==='de'?'Geschlossen':'Closed']:day.periods.flatMap(p=>[p.kind==='mondstube'?'Mondstube':'Café',`${p.start}–${p.end}`,...(p.event?[p.event.type==='dnd'?'D&D ●':language==='de'?'Aktivität ●':'Event ●']:[])]);
      ctx.font=(format==='ig'?'14':'17')+'px sans-serif';
      const overflow=wrap(lines.join('\n'),x+8,y+36,cellW-16,format==='ig'?17:22,Math.floor((cellH-42)/(format==='ig'?17:22)));
      if(overflow)descriptions.push(day.key+': '+lines.join('; '));
      for(const p of day.periods)if(p.event)descriptions.push(day.key+' · '+model.periodLabel(p)+'\n'+model.eventText(p.event,day.key,language).join('\n'));
    }
    const bottom=startY+frozen.rows*cellH+24;
    ctx.font='19px sans-serif';
    if(format==='a4')wrap((config.weeklyActivities || []).map(a=>a[language]).join(' · '),48,bottom,984,28,3);
    ctx.font='18px sans-serif';wrap(language==='de'?'Details und aktuelle Hinweise: nichinichi-cafe.github.io/kalender/':'Details and current updates: nichinichi-cafe.github.io/kalender/',48,format==='ig'?1000:height-90,984,26,2);
    // Complete text accompanies a compact picture; no event detail is silently lost.
    el('calendar-caption').value=[name,...(config.weeklyActivities || []).map(a=>a[language]),...descriptions,'https://nichinichi-cafe.github.io/kalender/'].join('\n\n');
    if(format==='a4'){
      ctx.font='16px sans-serif';
      const room=height-120-(bottom+100);
      const overflow=wrap(descriptions.join('\n'),48,bottom+100,984,23,Math.max(0,Math.floor(room/23)));
      if(overflow){el('calendar-message').textContent=t('Die ausführlichen Texte stehen zusätzlich im Begleittext unter den Download-Schaltflächen.','Full text is also available in the caption below the download buttons.');}
    }
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`NichiNichi-${frozen.year}-${String(frozen.monthIndex+1).padStart(2,'0')}-${language}-${format}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  for(const [id,step] of [['calendar-prev',-1],['calendar-next',1]])el(id).addEventListener('click',()=>{
    const next=new Date(Date.UTC(year,month+step,1));year=next.getUTCFullYear();month=next.getUTCMonth();render();
  });
  el('export-ig').addEventListener('click',()=>exportImage('ig'));
  el('export-a4').addEventListener('click',()=>exportImage('a4'));
  window.addEventListener('nichinichi-language',render);
  render();
  fetch(config.liveStateEndpoint,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).then(data=>{
    if(!Array.isArray(data.openingExceptions))throw Error('invalid state');
    exceptions=data.openingExceptions;ready=true;render();
  }).catch(()=>{ready=false;render();});
})();
