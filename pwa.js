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

// Clave pública VAPID de Firebase Cloud Messaging.
// No es una contraseña ni una clave privada.
const FCM_VAPID_KEY = "BD8xwfeFDttKMh6KaHlwmk-Cj5eiXEmjn_CxlCWrTapMlpV5x6h_0DIpw1DV9rVNGrT9itBh9T4fDLO5d45rFpo";

async function inicializarNotificacionesPush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!window.firebase?.messaging) return null;

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
async function actualizarGridoManager() {
  const btn = document.getElementById("btnActualizarApp");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Actualizando...";
  }

  try {
    // Fuerza la obtención de los archivos principales sin usar la versión en caché.
    const archivos = ["./", "./index.html", "./styles.css", "./app.js", "./pwa.js", "./sw.js"];
    await Promise.all(archivos.map(url =>
      fetch(url, { cache: "reload", credentials: "same-origin" }).catch(() => null)
    ));

    // Elimina cachés de Service Worker para que la próxima carga parta limpia.
    if ("caches" in window) {
      const nombres = await caches.keys();
      await Promise.all(nombres.map(nombre => caches.delete(nombre)));
    }

    // Actualiza el Service Worker antes de recargar.
    if ("serviceWorker" in navigator) {
      const registro = await navigator.serviceWorker.getRegistration("./");
      if (registro) {
        try { await registro.update(); } catch (e) {}
        try { await registro.unregister(); } catch (e) {}
      }
    }

    // Recarga conservando el acceso directo instalado.
    const separador = window.location.href.includes("?") ? "&" : "?";
    window.location.replace(window.location.href + separador + "actualizacion=" + Date.now());
  } catch (error) {
    console.error("Error actualizando Grido Manager:", error);
    window.location.reload();
  }
}

function crearBotonActualizarApp() {
  if (document.getElementById("btnActualizarApp")) return;

  const btn = document.createElement("button");
  btn.id = "btnActualizarApp";
  btn.textContent = "🔄 Actualizar";
  btn.title = "Buscar la última versión de Grido Manager";
  btn.style.cssText = "position:fixed;bottom:18px;left:18px;z-index:9999;padding:12px 16px;border:0;border-radius:12px;background:#667eea;color:white;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer;";
  btn.onclick = actualizarGridoManager;
  document.body.appendChild(btn);
}

window.addEventListener("load", () => {
  crearBotonActualizarApp();
});
