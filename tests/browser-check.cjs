const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
(async()=>{
const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00Z']))}static now(){return new NativeDate('2026-10-21T12:00:00Z').getTime()}};
const output=path.join(require('os').tmpdir(),'nichinichi-browser-check');fs.mkdirSync(output,{recursive:true});
const worker=(await import('../cloudflare/worker.mjs')).default;
const data=new Map(),root=path.resolve(__dirname,'..');const env={ADMIN_TOKEN:'local-test-only',STATUS_KV:{
 async get(k,t){const v=data.get(k);return v==null?null:t==='json'?JSON.parse(v):v},async put(k,v){data.set(k,v)},async delete(k){data.delete(k)},
 async list({prefix}){return {keys:[...data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}
}};
const staticResponse=(url)=>{let p=path.join(root,new URL(url,'http://local').pathname);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');return {body:fs.readFileSync(p),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream'};};
const server=http.createServer(async(req,res)=>{
const u=new URL(req.url,'http://local');
if(['/admin','/status','/notice','/opening-exceptions','/state','/little-note','/reset-current'].includes(u.pathname)){
let body='';for await(const c of req)body+=c;
const r=await worker.fetch(new Request(u,{method:req.method,headers:req.headers,...(body?{body}:{})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return;}
try{const r=staticResponse(req.url);res.setHeader('Content-Type',r.contentType);res.end(r.body)}catch{res.statusCode=404;res.end()}
}).listen(0,'127.0.0.1');
let browser;
try{
browser=await chromium.launch({headless:true,...(process.env.NICHI_BROWSER_CHANNEL?{channel:process.env.NICHI_BROWSER_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:390,height:1000},acceptDownloads:true});page.setDefaultTimeout(12000);
await page.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-10-21T12:00:00Z']))}static now(){return new NativeDate('2026-10-21T12:00:00Z').getTime()}};});
await page.addInitScript(()=>{
 window.__artText=[];const fill=CanvasRenderingContext2D.prototype.fillText;
 CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__artText.push({text:String(text),color:this.fillStyle,font:this.font,x:args[0],y:args[1]});return fill.call(this,text,...args);};
});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async r=>{const url=r.request().url();
if(url.startsWith('http://127.0.0.1:'))return r.continue();
if(url.startsWith('https://nichinichi-cafe.github.io/assets/'))return r.fulfill(staticResponse(url));
if(url.startsWith('https://nichinichi-status.fangphaedra.workers.dev/')){const out=await worker.fetch(new Request(url),env);return r.fulfill({status:out.status,headers:{...Object.fromEntries(out.headers),'Access-Control-Allow-Origin':'*'},body:await out.text()});}
return r.abort();});
const base='http://127.0.0.1:'+server.address().port;
await page.goto(base+'/admin');await page.locator('#token').fill('local-test-only');await page.locator('#save-token').click();
await page.locator('#opening-date').fill('2026-10-26');await page.locator('#reload-schedule').click();
await page.waitForFunction(()=>!document.querySelector('#save-special-hours').disabled);
assert.equal(await page.locator('#hours-start-1').inputValue(),'12:00');assert.equal(await page.locator('#hours-end-1').inputValue(),'14:00');
assert.equal(await page.locator('#hours-start-2').inputValue(),'18:00');
await page.locator('#event-type-2').selectOption('dnd');await page.locator('#event-title-2').fill('D&D — Bring dice');await page.locator('#event-description-2').fill('A quiet adventure. <b>Plain text</b>');await page.locator('#save-special-hours').click();
await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('已儲存'));
const stored=JSON.parse(data.get('opening:2026-10-26'));assert.equal(stored.periods.length,2);assert.equal(stored.periods[0].kind,'cafe');assert.equal(stored.periods[1].event.type,'dnd');
await page.locator('#reload-schedule').click();await page.waitForFunction(()=>!document.querySelector('#save-special-hours').disabled);assert.equal(await page.locator('#event-title-2').inputValue(),'D&D — Bring dice');
// Edit through the existing date row, then delete and recreate the exception.
await page.getByRole('button',{name:'編輯',exact:true}).click();
await page.waitForFunction(()=>!document.querySelector('#save-special-hours').disabled);
await page.locator('#event-description-2').fill('Edited adventure. <b>Plain text</b>');await page.locator('#save-special-hours').click();
await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('已儲存'));
assert(JSON.parse(data.get('opening:2026-10-26')).periods[1].event.description.startsWith('Edited'));
await page.getByRole('button',{name:'刪除',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('已移除'));
assert.equal(data.has('opening:2026-10-26'),false);
// Restore test fixture for visual samples; this is an in-memory KV, not production.
data.set('opening:2026-10-26',JSON.stringify(stored));
// OW003 visual fixtures, never production: Friday closure and Thursday special opening.
data.set('opening:2026-10-23',JSON.stringify({date:'2026-10-23',type:'closed',periods:[]}));
data.set('opening:2026-10-22',JSON.stringify({date:'2026-10-22',type:'special',periods:[{kind:'mondstube',start:'17:00',end:'19:00',event:{type:'other',title:'Autumn evening TEST',description:'Off-column test opening'}}]}));
await page.screenshot({path:path.join(output,'task004-cockpit.png'),fullPage:true});
await page.goto(base+'/kalender/');await page.waitForFunction(()=>!document.querySelector('#export-ig').disabled);
assert(await page.locator('#calendar-export-tools').isHidden());
assert.equal(await page.locator('#calendar-message').innerText(),'');
assert(!(await page.locator('#calendar-weekly').innerText()).includes('Lunch'));
assert((await page.locator('#calendar-weekly').innerText()).includes('Mother–Daughter Day'));
// Real keyboard focus check: the hidden skip link appears when tabbed to.
await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);
await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#main');
await page.screenshot({path:path.join(output,'task004-public.png'),fullPage:true});
for(const width of [320,390,1440]){
await page.setViewportSize({width,height:1100});await page.goto(base+'/kalender/?export');await page.waitForFunction(()=>!document.querySelector('#export-ig').disabled);
await page.locator('[data-date="2026-10-26"]').click();
for(const language of ['de','en','de']){
await page.locator('[data-language='+language+']').click();assert(await page.locator('#calendar-detail').innerText().then(s=>s.includes(language==='de'?'Von Oktober bis März':'From October to March')));
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.equal(await page.locator('#calendar-detail b').count(),0);
}
await page.locator('#calendar-grid').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'task004-'+width+'.png'),fullPage:true});
}
for(const [id,w,h] of [['export-ig',1080,1080],['export-a4',2480,3508]]){
const promise=page.waitForEvent('download');await page.locator('#'+id).click();const download=await promise;const png=path.join(output,'task004-'+id+'.png');await download.saveAs(png);const bytes=fs.readFileSync(png);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);
assert((await page.locator('#calendar-caption').inputValue()).includes('D&D — Bring dice'));
}
const ink=await page.evaluate(()=>window.__artText);
assert(ink.some(t=>t.text==='Zu' && t.color==='#171310' && t.font.includes('38px') && t.font.includes('Georgia')));
assert(!ink.some(t=>t.text==='Geschlossen' || t.text==='ZU'));
assert(!ink.some(t=>t.text==='MI' || t.text==='DO'));
const headers=ink.filter(t=>['MO','DI','FR','SA','SO'].includes(t.text)).slice(0,5);
assert.deepEqual(headers.map(t=>t.text),['MO','DI','FR','SA','SO']);
assert(headers[2].x-headers[1].x>headers[3].x-headers[2].x+20,'visible break between Tue and Fri');
assert(ink.some(t=>t.text.includes('+ Sonderöffnung: 22.10.')));
assert(ink.some(t=>t.text.includes('22.10.') && t.text.includes('Autumn evening TEST')));
assert(ink.some(t=>t.text==='nichinichi-cafe.github.io/kalender/' && t.font.includes('28px')));
assert(ink.some(t=>t.text.startsWith('Café ·') && t.font.includes('30px')));
assert.equal(await page.locator('.calendar-weekday').count(),7,'public calendar stays seven-column');
assert(ink.some(t=>t.text==='D&D' && t.color==='#171310' && t.font.includes('28px')));
assert(ink.some(t=>t.text==='18–20' && t.color==='#171310' && t.font.includes('28px')));
assert(!(await page.locator('[data-date="2026-10-30"]').getAttribute('aria-label')).includes('Geschlossen'));
const preview=await browser.newPage({viewport:{width:390,height:390},deviceScaleFactor:1});
const ig=fs.readFileSync(path.join(output,'task004-export-ig.png')).toString('base64');
await preview.setContent('<style>html,body{margin:0;width:390px;height:390px;overflow:hidden}img{display:block;width:390px;height:390px}</style><img alt="IG at phone width" src="data:image/png;base64,'+ig+'">');
await preview.locator('img').evaluate(img=>img.decode());await preview.screenshot({path:path.join(output,'task004-ig-390.png')});await preview.close();
const enText=await page.evaluate(()=>{
 window.__artText=[];window.NICHI_CALENDAR_EXPORT(window.NICHI_CALENDAR.month(2026,9,window.NICHI_SITE,[{date:'2026-10-23',type:'closed',periods:[]}]),window.NICHI_SITE,'en').draw('ig');return window.__artText;
});
assert(enText.some(t=>t.text==='Closed' && t.color==='#171310' && t.font.includes('38px') && t.font.includes('Georgia')));
assert(!enText.some(t=>t.text==='Zu' || t.text==='ZU'));
// Same data, frozen OW002 seven-column vs current five-column renderer.
await page.addScriptTag({path:path.join(root,'tests/fixtures/ow002-export.js')});
const comparison=await page.evaluate(exceptions=>{
 const snap=window.NICHI_CALENDAR.month(2026,9,window.NICHI_SITE,exceptions);
 const old=window.NICHI_CALENDAR_EXPORT_OW002(snap,window.NICHI_SITE,'de').draw('ig');
 const next=window.NICHI_CALENDAR_EXPORT(snap,window.NICHI_SITE,'de').draw('ig');
 const c=document.createElement('canvas');c.width=2160;c.height=1140;const ctx=c.getContext('2d');
 ctx.fillStyle='#f4f0e7';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#171310';ctx.font='38px Georgia';
 ctx.fillText('OW002 · 7 Spalten',48,44);ctx.fillText('OW003 · 5 Spalten · TEST',1128,44);
 ctx.drawImage(old,0,60);ctx.drawImage(next,1080,60);
 return {old:old.toDataURL('image/png'),comparison:c.toDataURL('image/png')};
},[...data.entries()].filter(([k])=>k.startsWith('opening:')).map(([,v])=>JSON.parse(v)));
const saveData=(name,url)=>fs.writeFileSync(path.join(output,name),Buffer.from(url.split(',')[1],'base64'));
saveData('ow003-seven-column-same-data.png',comparison.old);saveData('ow003-comparison-full.png',comparison.comparison);
const pair=await browser.newPage({viewport:{width:390,height:206},deviceScaleFactor:1});
await pair.setContent('<style>html,body{margin:0;width:390px;height:206px;overflow:hidden}img{display:block;width:390px;height:auto}</style><img src="'+comparison.comparison+'">');
await pair.locator('img').evaluate(img=>img.decode());await pair.screenshot({path:path.join(output,'ow003-comparison-390.png')});await pair.close();
// Column set follows configuration rather than hardcoded weekdays.
const dynamic=await page.evaluate(()=>{
 const config=structuredClone(window.NICHI_SITE);config.weeklyHours[3]=[{kind:'cafe',start:'12:00',end:'14:00'}];
 window.__artText=[];window.NICHI_CALENDAR_EXPORT(window.NICHI_CALENDAR.month(2026,9,config,[]),config,'de').draw('ig');
 return window.__artText;
});
assert(dynamic.some(t=>t.text==='MI'));assert(!dynamic.some(t=>t.text==='DO'));
assert(!dynamic.some(t=>t.text==='Zu'),'no closure legend when no temporary closure exists');
// Exercise four- and six-row exports, not only date arithmetic.
for(const target of ['2027-02','2027-05']){
 while(await page.locator('[data-date]').first().getAttribute('data-date').then(k=>k.slice(0,7)!==target))await page.locator('#calendar-next').click();
 for(const id of ['export-ig','export-a4']){
  const promise=page.waitForEvent('download');await page.locator('#'+id).click();const download=await promise;await download.saveAs(path.join(output,target+'-'+id+'.png'));
 }
}
// Return to current month for the past-month behavior check.
while(await page.locator('[data-date]').first().getAttribute('data-date').then(k=>k.slice(0,7)!=='2026-10'))await page.locator('#calendar-prev').click();
await page.locator('[data-language=en]').click();await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');
await page.locator('#calendar-prev').click();assert(await page.locator('#export-ig').isDisabled());assert((await page.locator('#calendar-message').innerText()).includes('no event archive'));
await page.route('**/state',r=>r.abort());await page.reload();assert(await page.locator('#export-ig').isDisabled());
// Failed or stale shared scripts must keep all-day schedule saves disabled.
for(const mode of ['missing-data','missing-model','stale-data','stale-model']){
 const pattern=mode.includes('data')?'https://nichinichi-cafe.github.io/assets/js/site-data.js*':'https://nichinichi-cafe.github.io/assets/js/calendar-data.js*';
 await page.route(pattern,r=>mode.startsWith('missing')?r.abort():r.fulfill({contentType:'text/javascript',body:mode==='stale-data'?'window.NICHI_SITE={weeklyHours:{}};':'window.NICHI_CALENDAR={apiVersion:0};'}));
 await page.goto(base+'/admin');await page.locator('#reload-schedule').click();
 await page.waitForFunction(()=>document.querySelector('#schedule-result').textContent.includes('無法載入'));
 assert(await page.locator('#save-special-hours').isDisabled());
 await page.unroute(pattern);
}
assert.deepEqual(errors,[]);
console.log('PASS: Cockpit one-save round trip preserves cafe/evening; 320/390/1440px; DE→EN→DE & persistence; D&D details; safe text; PNG sizes 1080×1080 & 2480×3508; past/offline exports blocked; no JS errors.');
}finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
