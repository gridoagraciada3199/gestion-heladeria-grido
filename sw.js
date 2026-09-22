importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDz8fzziGrMrj_pWPVwbZ3WPUY9wB1etZ8",
  authDomain: "app-control-grido.firebaseapp.com",
  projectId: "app-control-grido",
  storageBucket: "app-control-grido.firebasestorage.app",
  messagingSenderId: "142344571044",
  appId: "1:142344571044:web:82d27d7599ccf902327e31"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(notification.title || data.title || "Gestión Grido", {
    body: notification.body || data.body || "",
    icon: "./icon-grido.svg",
    badge: "./icon-grido.svg",
    tag: data.tag || "gestion-grido",
    vibrate: [150, 80, 150],
    requireInteraction: data.urgent === "true",
    data
  });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
      const target = event.notification.data?.url || "./";
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
