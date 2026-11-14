/* Service worker: deixa o jogo funcionar 100% offline depois da primeira visita.
 * Ao mudar qualquer arquivo, aumente CACHE_VERSION para forcar a atualizacao. */
const CACHE_VERSION = 'coup-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/catalog.js',
  'js/game.js',
  'js/ui.js',
  'js/flows.js',
  'js/app.js',
  'assets/cards/duque.webp',
  'assets/cards/assassino.webp',
  'assets/cards/capitao.webp',
  'assets/cards/embaixador.webp',
  'assets/cards/condessa.webp',
  'assets/cards/verso.webp',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache primeiro; se nao houver, rede (e guarda a resposta).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).then((res) => {
        if (res && res.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
