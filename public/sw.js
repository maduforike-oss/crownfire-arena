const CACHE_NAME = 'crowdfire-arena-v10';
const scopeUrl = new URL(self.registration.scope);
const scoped = (path) => new URL(path, scopeUrl).toString();
const APP_SHELL = [scoped('./'), scoped('index.html'), scoped('manifest.webmanifest')];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

  // HTML must be network-first. Vite fingerprints JavaScript assets on every
  // release, so serving a cached index page can otherwise reference a bundle
  // that GitHub Pages has already replaced and leave mobile Safari blank.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(scoped('index.html'), copy));
          return response;
        })
        .catch(() => caches.match(scoped('./')).then((cached) => cached || caches.match(scoped('index.html'))))
    );
    return;
  }

  // Scripts and styles are network-first so an interrupted worker update can
  // never pair a new HTML document with an obsolete bundle on iOS Safari.
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'worker') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Art stays fast after the first visit while every successful request also
  // refreshes its cached copy. Never return index.html for a missing asset:
  // Safari treats that as an invalid module/image response and can blank boot.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const refresh = fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => undefined));
        return cached;
      }
      return refresh;
    })
  );
});
