// PWA: instalación y service worker
let deferredInstallPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.warn("No se pudo registrar el Service Worker:", err);
    });
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;

  if (!document.getElementById("btnInstalarApp")) {
    const btn = document.createElement("button");
    btn.id = "btnInstalarApp";
    btn.textContent = "📱 Instalar app";
    btn.style.cssText = "position:fixed;bottom:18px;right:18px;z-index:9999;padding:12px 16px;border:0;border-radius:12px;background:#667eea;color:white;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer;";
    btn.onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.remove();
    };
    document.body.appendChild(btn);
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.getElementById("btnInstalarApp")?.remove();
});

const FCM_VAPID_KEY = "PEGAR_AQUI_LA_CLAVE_VAPID_DE_FIREBASE";

async function inicializarNotificacionesPush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!window.firebase?.messaging) return null;
  if (FCM_VAPID_KEY.startsWith("PEGAR_")) {
    console.warn("Falta configurar la clave VAPID de Firebase.");
    return null;
  }

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return null;

    const registration = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) return null;

    // El token queda disponible para que el sistema lo asocie al empleado.
    window.fcmToken = token;
    window.dispatchEvent(new CustomEvent("fcm-token-ready", { detail: { token } }));
    console.log("FCM token listo.");
    return token;
  } catch (error) {
    console.error("Error inicializando notificaciones push:", error);
    return null;
  }
}

window.addEventListener("fcm-token-ready", event => {
  // Punto de integración: guardar event.detail.token en Firestore
  // asociado al usuario/empleado que inició sesión.
});

window.addEventListener("load", () => {
  setTimeout(() => inicializarNotificacionesPush(), 1500);
});
