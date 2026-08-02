const PLATEPLAN_CACHE = 'plateplan-shell-v25';
const PLATEPLAN_APP_VERSION = '22.0';
const PLATEPLAN_BUILD_ID = '22.0-v25';
const PLATEPLAN_LOCAL_SHELL = [
  './',
  './PlatePlan.html',
  './repair-update.html',
  './manifest.json',
  './firebase-config.js',
  './styles/tokens.css?v=22.0',
  './styles/components.css?v=22.0',
  './styles/responsive.css?v=22.0',
  './styles/print.css?v=22.0',
  './scripts/plateplan-app.js?v=22.0',
  './scripts/bootstrap.js?v=22.0',
  './scripts/main.js?v=22.0',
  './scripts/core/contracts.js?v=22.0',
  './scripts/core/store.js?v=22.0',
  './scripts/core/runtime.js?v=22.0',
  './scripts/services/firebase.js?v=22.0',
  './scripts/services/sync.js?v=22.0',
  './scripts/services/recovery.js?v=22.0',
  './scripts/services/updates.js?v=22.0',
  './scripts/ui/actions.js?v=22.0',
  './scripts/ui/navigation.js?v=22.0',
  './scripts/ui/workspaces.js?v=22.0',
  './scripts/features/create-legacy-view.js?v=22.0',
  './scripts/features/today.js?v=22.0',
  './scripts/features/recipes.js?v=22.0',
  './scripts/features/ingredients.js?v=22.0',
  './scripts/features/products.js?v=22.0',
  './scripts/features/planner.js?v=22.0',
  './scripts/features/library.js?v=22.0',
  './scripts/features/shopping.js?v=22.0',
  './scripts/features/search.js?v=22.0',
  './scripts/features/data-quality.js?v=22.0',
  './scripts/features/preferences.js?v=22.0',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];
const PLATEPLAN_OPTIONAL_SHELL = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'
];
let platePlanActivationRequested = false;

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
        const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
        const detail = {
          cacheName: PLATEPLAN_CACHE,
          appVersion: PLATEPLAN_APP_VERSION,
          buildId: PLATEPLAN_BUILD_ID,
          requested: platePlanActivationRequested,
        };
        clients.forEach(client => {
          client.postMessage({type:'PLATEPLAN_UPDATE_ACTIVE',...detail});
          client.postMessage({type:'PLATEPLAN_UPDATE_ACTIVATED',...detail});
        });
      })
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin === self.location.origin && (url.pathname.endsWith('.html') || url.pathname.endsWith('firebase-config.js'))){
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(PLATEPLAN_CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
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
  if(event.data?.type === 'PLATEPLAN_ACTIVATE_UPDATE' || event.data?.type === 'SKIP_WAITING'){
    platePlanActivationRequested = true;
    if(event.ports?.[0]){
      event.ports[0].postMessage({
        type:'PLATEPLAN_ACTIVATION_ACCEPTED',
        cacheName:PLATEPLAN_CACHE,
        appVersion:PLATEPLAN_APP_VERSION,
        buildId:PLATEPLAN_BUILD_ID
      });
    }
    event.waitUntil(self.skipWaiting());
  }
  if(event.data?.type === 'PLATEPLAN_GET_VERSION' || event.data?.type === 'GET_VERSION'){
    const message={
      type:'PLATEPLAN_VERSION',
      cacheName:PLATEPLAN_CACHE,
      appVersion:PLATEPLAN_APP_VERSION,
      buildId:PLATEPLAN_BUILD_ID
    };
    if(event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  }
});
