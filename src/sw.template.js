// Időkapszula service worker (a build tölti ki: vite.config.ts → serviceWorker).
// Csak az alkalmazás saját, statikus fájljait tárolja; képet, blobot,
// API-hívást és térképcsempét soha.
const CACHE = 'idokapszula-__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('idokapszula-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  // Oldalnavigáció: hálózat először (friss verzió), offline a tárolt index.html.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(ASSETS[0], { ignoreVary: true })));
    return;
  }
  // Statikus fájlok: tárból, ha van; a mintaképeket első használatkor eltesszük.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/demo/')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
