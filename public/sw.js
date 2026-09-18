// Service Worker for DUB Agenda PWA
const CACHE_NAME = "dubagenda-pwa-v13";

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

// Suporte a cliques em notificações de agendamentos
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/cliente";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
