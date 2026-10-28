import {handleCupcakeTest} from './cupcake-test.mjs';
export {CupcakeTestLedger} from './cupcake-test.mjs';
const sign=async(key,text)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');};
export default {async fetch(request,env){
 const url=new URL(request.url);if(url.pathname==='/')return Response.redirect(url.origin+'/cupcake-test',302);
 if(!url.pathname.startsWith('/cupcake-test'))return new Response('TEST only',{status:404});
 if(!env.TEST_SIGNING_KEY)return new Response('Test setup pending',{status:503});
 const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cupcake-test-owner='))?.slice(19)||'';
 let isAdmin=false;if(/^[-a-f0-9]{36}\.[a-f0-9]{64}$/.test(cookie)){const [id,sig]=cookie.split('.'),expected=await sign(env.TEST_SIGNING_KEY,'test-owner:'+id);let diff=0;for(let i=0;i<sig.length;i++)diff|=sig.charCodeAt(i)^expected.charCodeAt(i);isAdmin=!diff;}
 const landing=request.method==='GET'&&['/cupcake-test','/cupcake-test/'].includes(url.pathname);
 let newCookie;if(landing&&!isAdmin){const id=crypto.randomUUID();newCookie=id+'.'+await sign(env.TEST_SIGNING_KEY,'test-owner:'+id);}
 const r=await handleCupcakeTest(request,{CUPCAKE_TEST:env.CUPCAKE_TEST,ADMIN_TOKEN:env.TEST_SIGNING_KEY},isAdmin);
 const headers=new Headers(r.headers);headers.set('Referrer-Policy','no-referrer');headers.set('X-Robots-Tag','noindex, nofollow');
 if(newCookie)headers.append('Set-Cookie','cupcake-test-owner='+newCookie+'; HttpOnly; SameSite=Strict; Path=/cupcake-test; Max-Age=86400'+(url.protocol==='https:'?'; Secure':''));
 return new Response(r.body,{status:r.status,headers});
}};
