const CACHE_NAME = "gestion-grido-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, tag, data } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || "Gestión Grido", {
        body: body || "",
        icon: "./icon-grido.svg",
        badge: "./icon-grido.svg",
        tag: tag || "gestion-grido",
        vibrate: [150, 80, 150],
        data: data || {}
      })
    );
  }
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
