/* ============================================================================
   SERVICE WORKER — Withings → Garmin FIT
   Stratégie volontairement simple et prudente :
   - Permet l'installation PWA (condition requise par Chrome Android) et un
     fonctionnement minimal hors-ligne pour l'UI statique (HTML/manifest/icônes).
   - NE MET JAMAIS EN CACHE les appels vers l'API Withings (wbsapi.withings.net)
     ni vers account.withings.com : ce sont des données vivantes (mesures de
     poids, tokens OAuth) qu'il ne faut surtout pas servir depuis un cache local
     périmé. Ces requêtes passent toujours en direct vers le réseau.
   - Stratégie "network-first, fallback cache" pour les assets de l'app : on
     essaie toujours la version la plus récente en ligne, et on ne retombe sur
     le cache que si le réseau est indisponible (mode avion, tunnel, etc.).
   ============================================================================ */

const CACHE_NAME = 'withings-to-garmin-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

// Domaines dont les requêtes ne doivent JAMAIS être interceptées par le cache
// (API Withings : données dynamiques + flux OAuth sensible).
const NEVER_CACHE_HOSTS = [
  'wbsapi.withings.net',
  'account.withings.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) Laisser passer en direct toute requête vers les domaines Withings —
  //    jamais de cache, jamais d'interception, comportement réseau natif.
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname === host)) {
    return; // pas de event.respondWith() => le navigateur traite la requête normalement
  }

  // 2) Pour tout le reste (assets de l'app elle-même), stratégie network-first.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Met à jour le cache avec la version fraîche récupérée du réseau.
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // On ne cache que les requêtes GET réussies (évite les erreurs sur POST/opaque).
          if (event.request.method === 'GET' && networkResponse.status === 200) {
            cache.put(event.request, responseClone);
          }
        });
        return networkResponse;
      })
      .catch(() => {
        // Hors-ligne : on retombe sur la version en cache si disponible.
        return caches.match(event.request);
      })
  );
});
