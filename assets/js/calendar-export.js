/* Fixed-size, print-safe artwork. The calendar snapshot remains the only data input. */
(() => {
  'use strict';
  window.NICHI_CALENDAR_EXPORT = function (snapshot, config, language) {
    const de = language === 'de', model = window.NICHI_CALENDAR;
    const locale = de ? 'de-DE' : 'en-GB';
    const shortTime = time => time.replace(/:00$/, '');
    const range = period => `${shortTime(period.start)}–${shortTime(period.end)}`;
    const {weekdays,orderedDays,columns,breaks,summary}=model.operatingLayout(config,language);
    const dayWeekday=day=>new Date(day.key+'T12:00:00Z').getUTCDay();
    const omittedOpenDays=snapshot.days.filter(day=>!columns.includes(dayWeekday(day)) && !day.closed);
    const name = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(snapshot.year,snapshot.monthIndex,1)));
    const captionDate=key=>new Intl.DateTimeFormat(locale, de
      ? {day:'2-digit',month:'2-digit',timeZone:'UTC'}
      : {day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'));
    const samePeriod=(a,b)=>a.kind===b.kind && a.start===b.start && a.end===b.end;
    const dateDetails=snapshot.days.filter(day=>day.exception || day.hasEvent).flatMap(day=>{
      const baseline=config.weeklyHours?.[dayWeekday(day)] || [];
      const periods=day.periods.filter(p=>p.event || !baseline.some(b=>samePeriod(p,b)));
      // Include removed/reduced hours when they are the only change to the day.
      const removed=baseline.some(b=>!day.periods.some(p=>samePeriod(p,b)));
      if(!day.closed && !periods.length && !removed)return [];
      const shown=periods.length?periods:day.periods;
      return [captionDate(day.key)+' · '+(day.closed?(de?'Geschlossen':'Closed'):shown.map(model.periodLabel).join(' · '))+
        shown.filter(p=>p.event).map(p=>'\n'+model.eventText(p.event,day.key,language).join('\n')).join('')];
    });
    const caption=[name,...summary,...(config.weeklyActivities || []).map(a=>a[language]),...dateDetails,'https://nichinichi-cafe.de/kalender/'].join('\n\n');
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
      text('日日珈琲  /  NICHINICHI CAFÉ',48,24,'26px Georgia');
      text(name,48,61,'bold 62px Georgia');
      let y=140;
      for(const row of summary)for(const line of lines(row,984,'30px sans-serif')){text(line,48,y,'30px sans-serif');y+=36;}
      const specialHint=omittedOpenDays.length?(de?'+ Sonderöffnung: ':'+ Special opening: ')+omittedOpenDays.map(d=>d.key.slice(8,10)+'.'+d.key.slice(5,7)+'.').join(', '):'';
      const hintLines=specialHint?lines(specialHint,984,'28px sans-serif'):[];
      const top=Math.max(284,y+36), bottom=square?950-Math.max(0,hintLines.length-1)*32:1050;
      const gap=6,breakGap=28;
      const cellW=(984-Math.max(0,columns.length-1)*gap-breaks.filter(Boolean).length*breakGap)/Math.max(1,columns.length);
      const cellH=(bottom-top-(snapshot.rows-1)*gap)/snapshot.rows;
      const columnX=i=>48+i*(cellW+gap)+breaks.slice(0,i+1).filter(Boolean).length*breakGap;
      ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(48,top-38);ctx.lineTo(1032,top-38);ctx.stroke();
      columns.forEach((day,i)=>{
        text(weekdays[orderedDays.indexOf(day)].toUpperCase(),columnX(i)+10,top-30,'bold 26px sans-serif');
        if(breaks[i]){const bx=columnX(i)-gap-breakGap/2;ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(bx,top-30);ctx.lineTo(bx,bottom);ctx.stroke();}
      });
      if(!columns.length)text(de?'Keine regulären Öffnungstage':'No regular opening days',48,top+40,'30px sans-serif');
      const denseDays=[];
      for(const day of snapshot.days){
        const col=columns.indexOf(dayWeekday(day));
        if(col<0)continue;
        const pos=snapshot.offset+day.day-1,x=columnX(col),cy=top+Math.floor(pos/7)*(cellH+gap);
        ctx.fillStyle=day.closed?colors.closed:day.periods.some(p=>p.kind==='mondstube')?colors.evening:colors.cafe;
        ctx.fillRect(x,cy,cellW,cellH);ctx.strokeStyle=colors.line;ctx.strokeRect(x,cy,cellW,cellH);
        ctx.font='bold 32px sans-serif';ctx.fillStyle=colors.ink;ctx.fillText(String(day.day),x+cellW-12-ctx.measureText(String(day.day)).width,cy+6);
        const events=day.periods.filter(p=>p.event);
        if(day.closed){
          ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
          text(de?'Zu':'Closed',x+cellW/2,cy+cellH*.58,'38px Georgia');ctx.restore();
        }
        else if(day.exception || events.length){
          const available=cellW-16;
          const weekday=new Date(day.key+'T12:00:00Z').getUTCDay();
          const baseline=config.weeklyHours?.[weekday] || [];
          // Do not repeat unchanged daytime hours already printed in the header.
          const changed=day.periods.filter(p=>p.event || !baseline.some(b=>b.kind===p.kind && b.start===p.start && b.end===p.end));
          let labels=changed.flatMap(p=>[p.event?(p.event.type==='dnd'?'D&D':'Event'):p.kind==='mondstube'?'Mondstube':'Café',range(p)]);
          ctx.font='bold 28px sans-serif';
          if(labels.length*28>cellH-42 || labels.some(label=>ctx.measureText(label).width>available)){
            // Fixed square images cannot fit unlimited exceptions. Keep type readable,
            // refer to full date detail/caption, and list dense dates explicitly on A4.
            denseDays.push(day);
            labels=[events.some(p=>p.event.type==='dnd')?'D&D':de?'Info':'Change','Details'];
          }
          labels.forEach((label,i)=>{
            const ey=cy+cellH-4-28*(labels.length-i);
            if(events.length){ctx.fillStyle=colors.event;ctx.fillRect(x+1,ey-2,cellW-2,28);}
            text(label,x+8,ey,'bold 28px sans-serif');
          });
        }
      }
      let fy=bottom+20;
      const legend=[[colors.cafe,'Café'],[colors.evening,'Mondstube']];
      if(snapshot.days.some(d=>columns.includes(dayWeekday(d)) && d.closed))legend.push([colors.closed,de?'Zu':'Closed']);
      let lx=48;
      legend.forEach(([color,label])=>{ctx.fillStyle=color;ctx.fillRect(lx,fy+4,22,22);text(label,lx+30,fy,label==='Zu'?'30px Georgia':'26px sans-serif');ctx.font='26px sans-serif';lx+=ctx.measureText(label).width+80;});
      if(square)hintLines.forEach((line,i)=>text(line,48,fy+38+i*32,'28px sans-serif'));
      if(!square){
        fy+=49;
        for(const item of config.weeklyActivities || []){text(item[language],48,fy,'21px sans-serif');fy+=30;}
        if(snapshot.days.some(day=>day.hasEvent) || denseDays.length || omittedOpenDays.length){
          fy+=16;
          text(de?'Besondere Abende':'Special evenings',48,fy,'bold 24px Georgia');fy+=38;
          // A4 is a noticeboard overview. Full, unbounded event prose lives at the printed URL.
          const compact=snapshot.days.flatMap(d=>d.periods.filter(p=>p.event || denseDays.includes(d) || omittedOpenDays.includes(d)).map(p=>`${d.day}.${d.key.slice(5,7)}. · ${p.event?.title || (p.event?.type==='dnd'?'D&D':p.kind==='mondstube'?'Mondstube':'Café')} · ${p.start}–${p.end}`));
          for(const row of compact){
            const wrapped=lines(row,984,'20px sans-serif');
            if(fy+wrapped.length*27>height-100){text(de?'Weitere Details online (Adresse unten).':'More details online (address below).',48,fy,'18px sans-serif');break;}
            wrapped.forEach(line=>{text(line,48,fy,'20px sans-serif');fy+=27;});
          }
        }
      }
      if(!square)text(de?'Details & aktuelle Hinweise':'Details & current updates',48,height-80,'28px sans-serif');
      text('nichinichi-cafe.github.io/kalender/',48,height-38,'28px sans-serif');
      return canvas;
    }
    return {draw,caption};
  };
})();
