const PLATEPLAN_CACHE = 'plateplan-shell-v10';
const PLATEPLAN_LOCAL_SHELL = [
  './',
  './PlatePlan.html',
  './manifest.json',
  './firebase-config.js',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core.wasm.js',
  './vendor/tesseract/core/tesseract-core-simd.wasm.js',
  './vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/lang/eng.traineddata.gz'
];
const PLATEPLAN_OPTIONAL_SHELL = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'
];
let platePlanReloadClientsAfterActivate = false;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PLATEPLAN_CACHE).then(async cache => {
    await cache.addAll(PLATEPLAN_LOCAL_SHELL);
    await Promise.allSettled(PLATEPLAN_OPTIONAL_SHELL.map(url => cache.add(url)));
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== PLATEPLAN_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(async () => {
        if(!platePlanReloadClientsAfterActivate) return;
        const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
        clients.forEach(client => client.postMessage({type:'PLATEPLAN_UPDATE_ACTIVATED',cacheName:PLATEPLAN_CACHE}));
        setTimeout(() => {
          clients.forEach(client => client.navigate(client.url).catch(()=>{}));
        },1200);
      })
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin === self.location.origin && (url.pathname.endsWith('.html') || url.pathname.endsWith('firebase-config.js'))){
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(PLATEPLAN_CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if(response && response.ok){
      const copy = response.clone();
      caches.open(PLATEPLAN_CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING'){
    platePlanReloadClientsAfterActivate = true;
    event.waitUntil(self.skipWaiting());
  }
  if(event.data?.type === 'GET_VERSION'){
    const message={type:'PLATEPLAN_VERSION',cacheName:PLATEPLAN_CACHE};
    if(event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  }
});
