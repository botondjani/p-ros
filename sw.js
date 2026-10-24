// Időkapszula service worker (a build tölti ki: vite.config.ts → serviceWorker).
// Csak az alkalmazás saját, statikus fájljait tárolja; képet, blobot,
// API-hívást és térképcsempét soha.
const CACHE = 'idokapszula-d31be000173c';
const ASSETS = ["./","./places.json","./favicon.svg","./assets/index-DfOhLULi.js","./assets/DemoPreview-C05eQKrF.js","./assets/EditGrid-COZSsRV_.js","./assets/MapPanel-BG5TWpPX.js","./assets/Story-BW1R_nsM.js","./assets/StoryView-CNIF3Ml2.js","./assets/context-vEVYamwI.js","./assets/jsx-runtime-BHjaDo2T.js","./assets/runtime-CMLcQ_in.js","./assets/MapPanel-qvkd0SPb.css","./assets/fraunces-hu-italic-D46Nqdss.woff2","./assets/fraunces-latin-DihXLNYH.woff2","./assets/fraunces-latin-ext-CJcjJNj7.woff2","./assets/fraunces-latin-ext-italic-CGbN9UgK.woff2","./assets/fraunces-latin-italic-lSdLDfvT.woff2","./assets/index-B-4uuvp3.css","./assets/ingest.worker-ChwZvVyS.js","./assets/inter-latin-Dx4kXJAl.woff2","./assets/inter-latin-ext-DO1Apj_S.woff2","./assets/maplibre-gl-worker-BrB25tGK.mjs","./assets/libheif-bundle-Cpd7L0Ln.js","./viewer/files.json","./viewer/assets/fraunces-hu-italic.woff2","./viewer/assets/fraunces-hu.woff2","./viewer/assets/fraunces-latin-ext-italic.woff2","./viewer/assets/fraunces-latin-ext.woff2","./viewer/assets/fraunces-latin-italic.woff2","./viewer/assets/fraunces-latin.woff2","./viewer/assets/inter-hu.woff2","./viewer/assets/inter-latin-ext.woff2","./viewer/assets/inter-latin.woff2","./viewer/assets/maplibre-gl-worker.mjs","./viewer/viewer.css","./viewer/viewer.js"];

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
