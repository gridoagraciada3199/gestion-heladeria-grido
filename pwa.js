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
