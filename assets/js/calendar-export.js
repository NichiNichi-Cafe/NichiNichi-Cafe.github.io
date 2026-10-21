/* Fixed-size, print-safe artwork. The calendar snapshot remains the only data input. */
(() => {
  'use strict';
  window.NICHI_CALENDAR_EXPORT = function (snapshot, config, language) {
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
      const colors={paper:'#f4f0e7',ink:'#25221f',muted:'#72685f',line:'#c9c1b4',cafe:'#ead8d1',evening:'#eee4bd',closed:'#dedbd5',event:'#56634b'};
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
      const top=Math.max(320,y+64), bottom=square?938:1090;
      const gap=6,cellW=(984-6*gap)/7,cellH=(bottom-top-(snapshot.rows-1)*gap)/snapshot.rows;
      ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(48,top-52);ctx.lineTo(1032,top-52);ctx.stroke();
      weekdays.forEach((day,i)=>text(day.toUpperCase(),48+i*(cellW+gap)+10,top-35,'bold 18px sans-serif',colors.muted));
      for(const day of snapshot.days){
        const pos=snapshot.offset+day.day-1,x=48+(pos%7)*(cellW+gap),cy=top+Math.floor(pos/7)*(cellH+gap);
        ctx.fillStyle=day.closed?colors.closed:day.periods.some(p=>p.kind==='mondstube')?colors.evening:colors.cafe;
        ctx.fillRect(x,cy,cellW,cellH);ctx.strokeStyle=colors.line;ctx.strokeRect(x,cy,cellW,cellH);
        ctx.font='bold 30px sans-serif';ctx.fillStyle=day.closed?colors.muted:colors.ink;ctx.fillText(String(day.day),x+cellW-12-ctx.measureText(String(day.day)).width,cy+12);
        const events=day.periods.filter(p=>p.event);
        if(day.closed)text(de?'Geschlossen':'Closed',x+9,cy+cellH-28,'16px sans-serif',colors.muted);
        else if(day.exception || events.length){
          const available=cellW-16;
          // Event type and time are always explicit; no unexplained lunar symbols.
          day.periods.forEach((p,i)=>{
            const label=(p.event?(p.event.type==='dnd'?'D&D':'Event'):p.kind==='mondstube'?(de?'Abend':'Evening'):'Café')+' '+range(p);
            let size=16;ctx.font='bold '+size+'px sans-serif';
            while(size>12 && ctx.measureText(label).width>available){size--;ctx.font='bold '+size+'px sans-serif';}
            const font='bold '+size+'px sans-serif';
            const ey=cy+cellH-25*(day.periods.length-i);
            if(p.event){ctx.fillStyle=colors.event;ctx.fillRect(x+1,ey-3,cellW-2,25);}
            text(label,x+8,ey,font,p.event?'#ffffff':colors.ink);
          });
        }
      }
      let fy=bottom+25;
      const legend=[[colors.cafe,'Café'],[colors.evening,'Mondstube'],[colors.closed,de?'Geschlossen':'Closed']];
      let lx=48;
      legend.forEach(([color,label])=>{ctx.fillStyle=color;ctx.fillRect(lx,fy+2,16,16);text(label,lx+24,fy,'18px sans-serif');ctx.font='18px sans-serif';lx+=ctx.measureText(label).width+62;});
      if(!square){
        fy+=49;
        for(const item of config.weeklyActivities || []){text(item[language],48,fy,'21px sans-serif');fy+=30;}
        if(eventDetails.length){
          fy+=16;
          text(de?'Besondere Abende':'Special evenings',48,fy,'bold 24px Georgia');fy+=38;
          // A4 is a noticeboard overview. Full, unbounded event prose lives at the printed URL.
          const compact=snapshot.days.flatMap(d=>d.periods.filter(p=>p.event).map(p=>`${d.day}. · ${p.event.title || (p.event.type==='dnd'?'D&D':de?'Aktivität':'Event')} · ${p.start}–${p.end}`));
          for(const row of compact){
            const wrapped=lines(row,984,'20px sans-serif');
            if(fy+wrapped.length*27>height-100){text(de?'Weitere Details online (Adresse unten).':'More details online (address below).',48,fy,'18px sans-serif');break;}
            wrapped.forEach(line=>{text(line,48,fy,'20px sans-serif');fy+=27;});
          }
        }
      }
      text(de?'Details & aktuelle Hinweise':'Details & current updates',48,height-67,'17px sans-serif',colors.muted);
      text('nichinichi-cafe.github.io/kalender/',48,height-40,'19px sans-serif');
      return canvas;
    }
    return {draw,caption};
  };
})();
