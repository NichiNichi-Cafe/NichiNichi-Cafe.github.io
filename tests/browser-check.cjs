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
await page.screenshot({path:path.join(output,'task004-cockpit.png'),fullPage:true});
for(const width of [320,390,1440]){
await page.setViewportSize({width,height:1100});await page.goto(base+'/kalender/');await page.waitForFunction(()=>!document.querySelector('#export-ig').disabled);
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
assert.deepEqual(errors,[]);
console.log('PASS: Cockpit one-save round trip preserves cafe/evening; 320/390/1440px; DE→EN→DE & persistence; D&D details; safe text; PNG sizes 1080×1080 & 2480×3508; past/offline exports blocked; no JS errors.');
}finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
