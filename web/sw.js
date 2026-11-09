/* AnimeWeek Tracker v95.28 — caché de la interfaz; los datos siguen en el almacenamiento del navegador. */
const CACHE_NAME='animeweek-shell-v95-28';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./update-center.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('animeweek-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response&&response.ok)caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',response.clone()));return response;}).catch(async()=> (await caches.match(request))||(await caches.match('./index.html'))||Response.error()));return;}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response&&response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));return response;})));
});
