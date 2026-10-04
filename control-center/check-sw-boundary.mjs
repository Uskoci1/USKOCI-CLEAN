import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('./sw.js',import.meta.url),'utf8');
const handlers={},deleted=[],stored=[];let response=new Response('shell',{headers:{'content-type':'text/html'}}),offline=false;
const cache={put:async(req,res)=>{stored.push(req.url)},match:async()=>undefined};
const ctx=vm.createContext({URL,Response,Request,Set,Promise,
 self:{location:new URL('https://control.invalid/control-center/sw.js'),skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},
 caches:{keys:async()=>['uskoci-control-shell-v1','uskoci-control-shell-v2','unrelated-app'],delete:async k=>deleted.push(k),open:async()=>cache},
 fetch:async()=>{if(offline)throw Error('OFFLINE');return response.clone()}
});new vm.Script(code).runInContext(ctx);
let checks=0;
async function event(path,{method='GET',headers={}}={}){
 let caught=null;const pending=[];handlers.fetch({request:new Request('https://control.invalid'+path,{method,headers}),waitUntil:p=>pending.push(p),respondWith:p=>caught=p});
 const result=caught?await caught:null;await Promise.all(pending);return result;
}
for(const path of ['/api/control/overview','/api/control/users/secret','/auth/callback','/control-center/data.json','/control-center/overview.html','/control-center/index.html?token=private']){
 assert.equal(await event(path),null);checks++;
}
assert.equal(await event('/control-center/index.html',{method:'POST'}),null);checks++;
assert.equal(await event('/control-center/index.html',{headers:{authorization:'Bearer private'}}),null);checks++;
assert.equal((await event('/control-center/index.html')).status,200);assert.equal(stored.length,1);checks++;
for(const cc of ['private, max-age=60','no-store']){response=new Response('sensitive',{headers:{'cache-control':cc}});await event('/control-center/index.html');assert.equal(stored.length,1);checks++;}
response=new Response('denied',{status:401});await event('/control-center/index.html');assert.equal(stored.length,1);checks++;
offline=true;assert.equal((await event('/control-center/icon.svg')).status,503);assert.equal(await event('/api/control/overview'),null);checks++;
let activation;handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(deleted,['uskoci-control-shell-v1']);checks++;
assert.ok(!code.includes('cache.addAll'));checks++;
console.log('SERVICE WORKER CACHE BOUNDARY: '+checks+' checks PASS; API/auth/snapshot not cached.');
