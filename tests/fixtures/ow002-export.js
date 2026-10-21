// Frozen seven-column OW002 renderer; comparison only, never loaded by the site.
/* Fixed-size, print-safe artwork. The calendar snapshot remains the only data input. */
(() => {
  'use strict';
  window.NICHI_CALENDAR_EXPORT_OW002 = function (snapshot, config, language) {
    const de = language === 'de', model = window.NICHI_CALENDAR;
    const locale = de ? 'de-DE' : 'en-GB';
    const shortTime = time => time.replace(/:00$/, '');
    const range = period => `${shortTime(period.start)}–${shortTime(period.end)}`;
    const weekdays = Array.from({length:7}, (_,i) => new Intl.DateTimeFormat(locale, {
      weekday:'short', timeZone:'UTC'
    }).format(new Date(Date.UTC(2026,0,5+i))).replace(/\.$/, ''));
    const orderedDays = [1,2,3,4,5,6,0];
    function dayNames(days) {
      const indexes=days.map(day=>orderedDays.indexOf(day)).sort((a,b)=>a-b), groups=[];
      for(let i=0;i<indexes.length;i++){
        let end=i;
        while(end+1<indexes.length && indexes[end+1]===indexes[end]+1)end++;
        groups.push(weekdays[indexes[i]]+(end>i?'–'+weekdays[indexes[end]]:''));i=end;
      }
      return groups.join(', ');
    }
    const summary=[];
    for(const kind of ['cafe','mondstube']){
      const groups=new Map();
      for(const day of orderedDays)for(const period of config.weeklyHours?.[day] || []){
        if(period.kind!==kind)continue;
        const time=range(period); if(!groups.has(time))groups.set(time,[]);groups.get(time).push(day);
      }
      if(groups.size)summary.push((kind==='cafe'?'Café':'Mondstube')+' · '+[...groups].map(([time,days])=>dayNames(days)+' '+time).join(' · '));
    }
    const closed=orderedDays.filter(day=>!(config.weeklyHours?.[day] || []).length);
    if(closed.length)summary.push(dayNames(closed)+' · '+(de?'Ruhetage':'Closed'));
    const name = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(snapshot.year,snapshot.monthIndex,1)));
    const eventDetails=snapshot.days.flatMap(day=>day.periods.filter(p=>p.event).map(p=>day.key+' · '+model.periodLabel(p)+'\n'+model.eventText(p.event,day.key,language).join('\n')));
    // Every day's exact times remain available as text, including compact-image exceptions.
    const caption=[name,...summary,...snapshot.days.filter(d=>d.exception).map(d=>d.key+' · '+(d.closed?(de?'Geschlossen':'Closed'):d.periods.map(model.periodLabel).join(' · '))),...(config.weeklyActivities || []).map(a=>a[language]),...eventDetails,'https://nichinichi-cafe.github.io/kalender/'].join('\n\n');
    function draw(format) {
      const square=format==='ig', canvas=document.createElement('canvas');
      canvas.width=square?1080:2480;canvas.height=square?1080:3508;
      const ctx=canvas.getContext('2d'),scale=canvas.width/1080,height=canvas.height/scale;
      ctx.scale(scale,scale);ctx.textBaseline='top';
      const colors={paper:'#f4f0e7',ink:'#171310',muted:'#72685f',line:'#c9c1b4',cafe:'#f0e0d9',evening:'#f2e9c7',closed:'#e5e2dc',event:'#dce6ce'};
      ctx.fillStyle=colors.paper;ctx.fillRect(0,0,1080,height);
      const text=(value,x,y,font,color=colors.ink)=>{ctx.font=font;ctx.fillStyle=color;ctx.fillText(value,x,y);};
      function lines(value,maxWidth,font) {
        ctx.font=font;const result=[];
        for(const paragraph of value.split('\n')){
          let line='';
          for(const word of paragraph.split(' ')){
            if(line && ctx.measureText(line+' '+word).width>maxWidth){result.push(line);line=word;}
            else line+=(line?' ':'')+word;
            if(ctx.measureText(line).width>maxWidth){
              let chunk='';
              for(const char of line){
                if(chunk && ctx.measureText(chunk+char).width>maxWidth){result.push(chunk);chunk=char;}
                else chunk+=char;
              }
              line=chunk;
            }
          }
          result.push(line);
        }
        return result;
      }
      text('日日珈琲  /  NICHINICHI CAFÉ',48,32,'22px Georgia');
      text(name,48,77,'bold 64px Georgia');
      let y=162;
      for(const row of summary)for(const line of lines(row,984,'22px sans-serif')){text(line,48,y,'22px sans-serif');y+=30;}
      const top=Math.max(294,y+42), bottom=square?980:1090;
      const gap=6,cellW=(984-6*gap)/7,cellH=(bottom-top-(snapshot.rows-1)*gap)/snapshot.rows;
      ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(48,top-38);ctx.lineTo(1032,top-38);ctx.stroke();
      weekdays.forEach((day,i)=>text(day.toUpperCase(),48+i*(cellW+gap)+10,top-30,'bold 24px sans-serif'));
      const denseDays=[];
      for(const day of snapshot.days){
        const pos=snapshot.offset+day.day-1,x=48+(pos%7)*(cellW+gap),cy=top+Math.floor(pos/7)*(cellH+gap);
        ctx.fillStyle=day.closed?colors.closed:day.periods.some(p=>p.kind==='mondstube')?colors.evening:colors.cafe;
        ctx.fillRect(x,cy,cellW,cellH);ctx.strokeStyle=colors.line;ctx.strokeRect(x,cy,cellW,cellH);
        ctx.font='bold 34px sans-serif';ctx.fillStyle=colors.ink;ctx.fillText(String(day.day),x+cellW-12-ctx.measureText(String(day.day)).width,cy+8);
        const events=day.periods.filter(p=>p.event);
        if(day.closed)text(de?'ZU':'Closed',x+9,cy+cellH-46,'bold 36px sans-serif');
        else if(day.exception || events.length){
          const available=cellW-16;
          const weekday=new Date(day.key+'T12:00:00Z').getUTCDay();
          const baseline=config.weeklyHours?.[weekday] || [];
          // Do not repeat unchanged daytime hours already printed in the header.
          const changed=day.periods.filter(p=>p.event || !baseline.some(b=>b.kind===p.kind && b.start===p.start && b.end===p.end));
          let labels=changed.flatMap(p=>[p.event?(p.event.type==='dnd'?'D&D':'Event'):p.kind==='mondstube'?'Mondstube':'Café',range(p)]);
          ctx.font='bold 28px sans-serif';
          if(labels.length*30>cellH-46 || labels.some(label=>ctx.measureText(label).width>available)){
            // Fixed square images cannot fit unlimited exceptions. Keep type readable,
            // refer to full date detail/caption, and list dense dates explicitly on A4.
            denseDays.push(day);
            labels=[events.some(p=>p.event.type==='dnd')?'D&D':de?'Info':'Change','Details'];
          }
          labels.forEach((label,i)=>{
            const ey=cy+cellH-4-30*(labels.length-i);
            if(events.length){ctx.fillStyle=colors.event;ctx.fillRect(x+1,ey-2,cellW-2,30);}
            text(label,x+8,ey,'bold 28px sans-serif');
          });
        }
      }
      let fy=bottom+20;
      const legend=[[colors.cafe,'Café'],[colors.evening,'Mondstube'],[colors.closed,de?'ZU':'Closed']];
      let lx=48;
      legend.forEach(([color,label])=>{ctx.fillStyle=color;ctx.fillRect(lx,fy+4,22,22);text(label,lx+30,fy,'bold 26px sans-serif');ctx.font='bold 26px sans-serif';lx+=ctx.measureText(label).width+80;});
      if(!square){
        fy+=49;
        for(const item of config.weeklyActivities || []){text(item[language],48,fy,'21px sans-serif');fy+=30;}
        if(eventDetails.length || denseDays.length){
          fy+=16;
          text(de?'Besondere Abende':'Special evenings',48,fy,'bold 24px Georgia');fy+=38;
          // A4 is a noticeboard overview. Full, unbounded event prose lives at the printed URL.
          const compact=snapshot.days.flatMap(d=>d.periods.filter(p=>p.event || denseDays.includes(d)).map(p=>`${d.day}. · ${p.event?.title || (p.event?.type==='dnd'?'D&D':p.kind==='mondstube'?'Mondstube':'Café')} · ${p.start}–${p.end}`));
          for(const row of compact){
            const wrapped=lines(row,984,'20px sans-serif');
            if(fy+wrapped.length*27>height-100){text(de?'Weitere Details online (Adresse unten).':'More details online (address below).',48,fy,'18px sans-serif');break;}
            wrapped.forEach(line=>{text(line,48,fy,'20px sans-serif');fy+=27;});
          }
        }
      }
      if(!square)text(de?'Details & aktuelle Hinweise':'Details & current updates',48,height-67,'22px sans-serif');
      text('nichinichi-cafe.github.io/kalender/',48,height-40,'19px sans-serif');
      return canvas;
    }
    return {draw,caption};
  };
})();
