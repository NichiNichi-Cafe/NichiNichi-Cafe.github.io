(() => {
 'use strict';
 const loader=document.currentScript,verification=new URLSearchParams(location.search).get('cupcake-verification'),verificationMode=/^[a-f0-9-]{36}\.[0-9]{13}\.[a-f0-9]{64}$/.test(verification||''),base=loader.dataset.api||'https://nichinichi-status.fangphaedra.workers.dev',apiBase=base+(verificationMode?'/cupcake/verify/'+verification:''),metrics=loader.dataset.analytics!=='off'&&!verificationMode;
 // The management password never crosses origins; only a non-privileged opt-out flag does.
 try{if(!verificationMode&&(localStorage.getItem('nichinichi-cupcake-owner-skip')==='1'||localStorage.getItem('nichinichi-status-admin-token')))return;}catch{return;}
 const eligible=['/jeden-tag-neu.html','/selbstgemacht.html'].includes(location.pathname),key='nichinichi-good-day-cupcake-v1'+(verificationMode?'-verification-'+verification.split('.')[0]:'');let memory={},card=null,storageOK=true,busy=false;
 try{memory=JSON.parse(localStorage.getItem(key)||'{}')}catch{storageOK=false}
 const $=id=>document.getElementById('cupcake-'+id),lang=()=>document.documentElement.lang==='en'?'en':'de',t=(de,en)=>lang()==='de'?de:en;
 const day=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(memory));return true}catch{storageOK=false;return false}};
 const dialog=document.createElement('dialog');dialog.id='cupcake-card';dialog.className='cupcake-card';dialog.setAttribute('aria-label','Good Day Cupcake');
 dialog.innerHTML='<div class="cupcake-toolbar"><button type="button" data-cupcake-lang="de" aria-pressed="false">DE</button><span aria-hidden="true">|</span><button type="button" data-cupcake-lang="en" aria-pressed="false">EN</button><button id="cupcake-close" type="button" aria-label="Close">×</button></div><div class="cupcake-content"><div class="cupcake-kicker">A LITTLE FIND</div><h2>Good Day Cupcake</h2><div id="cupcake-copy"><p id="cupcake-copy-intro"></p><p id="cupcake-copy-invitation"></p></div><div class="cupcake-art" aria-hidden="true"><img alt=""></div><small class="cupcake-test" hidden>PREVIEW · NOT REDEEMABLE</small><p id="cupcake-code"></p><p id="cupcake-expiry"></p><div class="cupcake-status"><small id="cupcake-clock"></small><small id="cupcake-sync" role="status"></small></div></div>';
 dialog.querySelector('.cupcake-art img').src=new URL('../images/good-day-cupcake.png',loader.src).href;
 dialog.querySelectorAll('[data-cupcake-lang]').forEach(button=>button.onclick=()=>document.querySelector('[data-lang-btn="'+button.dataset.cupcakeLang+'"]').click());
 const recover=document.createElement('button');recover.id='cupcake-recover';recover.type='button';recover.hidden=true;recover.setAttribute('aria-haspopup','dialog');document.body.append(dialog,recover);
 function render(){recover.textContent=t('Dein Fundstück','Your little find');$('close').setAttribute('aria-label',t('Schließen','Close'));dialog.querySelectorAll('[data-cupcake-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cupcakeLang===lang())));if(!card)return;
  $('code').textContent=card.code;dialog.querySelector('.cupcake-test').hidden=!card.test;
  if($('sync').textContent)$('sync').textContent=$('sync').textContent.startsWith('Offline')?t('Offline – Status nicht aktualisiert.','Offline – status not updated.'):t('Status aktualisiert.','Status updated.');
  const date=new Intl.DateTimeFormat(lang()==='de'?'de-DE':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(card.expiresDay+'T12:00:00Z'));
  $('expiry').textContent=t('gültig bis ','valid until ')+date+(card.status==='unredeemed'?t(' · einfach per Screenshot speichern',' · take a screenshot to keep it'):'');
  $('copy-intro').textContent=card.status==='redeemed'?t('Schön, dass du da warst.','So glad you came by.'):card.status==='expired'?t('Diese Karte ist abgelaufen.','This card has expired.'):t('Oh – du hast mich gefunden. Heute ist ein guter Tag.','Oh – you found me. Today is a good day.');
  $('copy-invitation').textContent=card.status==='unredeemed'?t('Bring diese Karte mit ins NichiNichi.\nEin Good Day Cupcake wartet auf dich.','Bring this card to NichiNichi.\nA Good Day Cupcake is waiting for you.'):'';
 }
 function metric(name){if(!metrics||card?.test)return;try{window.NICHI_CUPCAKE_METRIC?.(name)}catch{}}
 async function call(path,method='GET',body,token){const r=await fetch(apiBase+'/cupcake/'+path,{method,cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('unavailable');return r.json();}
 function open(){if(card){render();if(!dialog.open)dialog.showModal();}}
 async function refresh(){if(!memory.token)return;try{const result=await call('status','GET',undefined,memory.token);card=result;memory.card=card;save();render();recover.hidden=false;$('sync').textContent=t('Status aktualisiert.','Status updated.');}catch{if(memory.card){card=memory.card;render();recover.hidden=false;}$('sync').textContent=t('Offline – Status nicht aktualisiert.','Offline – status not updated.');}}
 async function shown(){try{const result=await call('shown','POST',undefined,memory.token);if(result.first)metric('egg_shown')}catch{}}
 async function draw(){if(busy||!eligible||!storageOK||memory.token)return;if(!memory.pending&&memory.attemptDay===day())return;busy=true;try{
  memory.browserId||=crypto.randomUUID();if(!memory.pending)memory.requestId=crypto.randomUUID();memory.pending=true;if(!save())return;
  const result=await call('claim','POST',{browserId:memory.browserId,requestId:memory.requestId,page:location.pathname});if(result.outcome==='disabled'){memory.pending=false;save();return;}
  memory.pending=false;memory.attemptDay=day();if(result.eligible&&!result.retry&&!result.test)metric('egg_eligible');
  if(result.outcome==='issued'){memory.token=result.token;card=result;memory.card=card;save();render();recover.hidden=false;open();await shown();}else save();
 }catch{memory.pending=true;save();}finally{busy=false;}}
 $('close').onclick=()=>dialog.close();recover.onclick=async()=>{if(!card&&memory.card)card=memory.card;open();await refresh();open();};
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});window.addEventListener('nichinichi-language',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();if(memory.pending)draw();}});window.addEventListener('online',()=>{refresh();if(memory.pending)draw();});
 setInterval(()=>{if(dialog.open){$('clock').textContent=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',timeStyle:'medium'}).format(new Date());refresh();}},3000);
 render();if(memory.card)card=memory.card;refresh();setTimeout(draw,900);
})();
