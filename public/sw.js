// Service Worker for DUB Agenda PWA
const CACHE_NAME = "dubagenda-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate / network-first for navigation requests
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Let browser handle requests normally with network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
