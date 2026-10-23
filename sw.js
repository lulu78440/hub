/* Service worker du Hub : cache hors ligne versionné.
   Pour publier une nouvelle version : changer VERSION (et mettre à jour js/version.js). */
const VERSION = "2.2.0";
const CACHE = "hub-" + VERSION;
const ROOT = new URL("./", self.location).href;
const PRECACHE = [
  "", "index.html", "manifest.webmanifest",
  "css/base.css", "css/hud.css", "css/mobile.css",
  "js/main.js", "js/version.js", "js/state.js", "js/ui/diag.js", "js/ui/clock.js", "js/ui/search.js", "js/ui/topbar.js", "js/ui/plans.js", "js/ui/windows.js", "js/ui/menus.js", "js/ui/ctxmenu.js", "js/device/vibrate.js", "js/device/orientation.js", "js/ui/toast.js", "js/ui/dom.js", "js/store/prefs.js", "js/fx/force.js", "js/fx/entity.js", "js/fx/cursor.js",
  "js/scene/loader.js", "js/scene/core3d.js", "js/scene/postfx.js",
  "vendor/three/three.min.js",
  "vendor/three/examples/shaders/CopyShader.js", "vendor/three/examples/shaders/LuminosityHighPassShader.js",
  "vendor/three/examples/postprocessing/EffectComposer.js", "vendor/three/examples/postprocessing/RenderPass.js",
  "vendor/three/examples/postprocessing/ShaderPass.js", "vendor/three/examples/postprocessing/UnrealBloomPass.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-48.png",
  "fonts/orbitron-latin-500-normal.woff2", "fonts/orbitron-latin-700-normal.woff2", "fonts/orbitron-latin-900-normal.woff2",
  "fonts/rajdhani-latin-500-normal.woff2", "fonts/rajdhani-latin-600-normal.woff2", "fonts/rajdhani-latin-700-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2", "fonts/ibm-plex-mono-latin-500-normal.woff2"
].map((p) => new URL(p, ROOT).href);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // cache: "reload" : on ne recopie jamais une ancienne version venue du cache HTTP
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("hub-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // on ne touche pas aux autres sites
  if (!url.href.startsWith(ROOT)) return;
  if (url.pathname.startsWith(new URL("maquettes/", ROOT).pathname)) return; // les maquettes restent en ligne
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === "navigate") return (await c.match(new URL("index.html", ROOT).href)) || Response.error();
        throw err;
      }
    })
  );
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "VERSION") e.ports[0] && e.ports[0].postMessage({ version: VERSION, cache: CACHE });
  if (d.type === "SKIP_WAITING") self.skipWaiting();
});
