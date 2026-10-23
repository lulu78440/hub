// Notifications du navigateur (Brave, Chrome, Android) pour les rappels, quand le hub est en arrière-plan.
// Elles passent par le service worker si possible (obligatoire sur Android), sinon par l'API simple.
export const notify = {
  get supported() { return "Notification" in window; },
  get state() { return this.supported ? Notification.permission : "unsupported"; },   // "granted" | "denied" | "default"
  /** À appeler depuis un clic : demande l'autorisation. Renvoie l'état final. */
  async ask() {
    if (!this.supported) return "unsupported";
    try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; }
  },
  async show(title, body, tag) {
    if (this.state !== "granted") return false;
    const opts = { body, tag, renotify: true, icon: "icons/icon-192.png", badge: "icons/favicon-48.png", requireInteraction: true };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
      new Notification(title, opts); return true;
    } catch (e) { return false; }
  }
};
