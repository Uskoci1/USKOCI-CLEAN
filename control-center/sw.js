// Cache the public shell only. API, auth and imported snapshot data are network-only.
const PREFIX='uskoci-control-shell-';
const SHELL=PREFIX+'v2';
const FILES=['./','./index.html','./manifest.webmanifest','./icon.svg'];
const ALLOWED=new Set(FILES.map(path=>new URL(path,self.location.href).href));
function cacheable(request,response){
 return response.ok&&!response.redirected&&response.type!=='opaque'
  &&!request.headers.has('authorization')
  &&!/(?:no-store|private)/i.test(response.headers.get('cache-control')||'');
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==SHELL).map(k=>caches.delete(k))))
 .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin
   ||url.search||!ALLOWED.has(url.href)||event.request.headers.has('authorization'))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(event.request);
   if(cacheable(event.request,response)){
    const copy=response.clone();
    event.waitUntil(caches.open(SHELL).then(cache=>cache.put(event.request,copy)).catch(()=>{}));
   }
   return response;
  }catch{
   const cache=await caches.open(SHELL);
   return (await cache.match(event.request))||new Response('Offline shell unavailable',{status:503,
    headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
 })());
});
