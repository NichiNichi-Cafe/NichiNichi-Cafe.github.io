(() => {
 'use strict';
 const pending=[];let active=false;
 const flush=()=>{try{if(!window.goatcounter?.count)return;while(pending.length){const name=pending.shift();window.goatcounter.count({path:name,title:'Good Day Cupcake',event:true,referrer:''});}}catch{pending.length=0;}};
 window.NICHI_CUPCAKE_METRIC=name=>{if(!['egg_eligible','egg_shown','egg_redeemed'].includes(name))return;if(['localhost','127.0.0.1'].includes(location.hostname))return;pending.push(name);if(!active){active=true;const existing=document.querySelector('script[data-goatcounter]');if(existing){existing.addEventListener('load',flush,{once:true});}else{const script=document.createElement('script');script.src='https://gc.zgo.at/count.js';script.async=true;script.dataset.goatcounter='https://nichinichi-cafe.goatcounter.com/count';script.dataset.goatcounterSettings=JSON.stringify({no_onload:true});script.addEventListener('load',flush,{once:true});script.addEventListener('error',()=>{pending.length=0},{once:true});document.head.append(script);}}flush();};
})();
