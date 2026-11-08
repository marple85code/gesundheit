/* Gesundheit - Service Worker: App offline verfügbar, Daten zwischengespeichert (verschlüsselt). */
const VERSION = "gesundheit-app-1.2.2";
const DATEN = "gesundheit-daten";
const SCHALE = [
  "./", "index.html", "style.css?v=1.2.2", "start.js?v=1.2.2", "app.js?v=1.2.2", "manifest.webmanifest",
  "vendor/echarts.min.js", "fonts/atkinson-next-latin.woff2", "fonts/atkinson-next-latin-ext.woff2",
  "icons/favicon.svg", "icons/icon-192.png",
  // Arztbericht: auch ohne Netz erstellbar
  "bericht.js?v=1.2.2", "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "fonts/atkinson-next-regular.ttf", "fonts/atkinson-next-bold.ttf",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SCHALE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n.startsWith("gesundheit-app-") && n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  // Datenstand: immer zuerst aus dem Netz, ohne Netz der letzte bekannte
  if (url.pathname.endsWith("/d/index.enc")) {
    e.respondWith(fetch(anfrage).then((r) => {
      if (r.ok) { const kopie = r.clone(); caches.open(DATEN).then((c) => c.put(new URL("d/index.enc", self.registration.scope).href, kopie)); }
      return r;
    }).catch(() => caches.open(DATEN).then((c) => c.match(new URL("d/index.enc", self.registration.scope).href)).then((r) => r || Response.error())));
    return;
  }

  // Versionierte Datendateien ändern sich nie: aus dem Speicher, sonst laden (alte Versionen entfernen)
  if (url.pathname.includes("/d/") && url.searchParams.has("v")) {
    e.respondWith(caches.open(DATEN).then(async (c) => {
      const treffer = await c.match(anfrage);
      if (treffer) return treffer;
      const r = await fetch(anfrage);
      if (r.ok) {
        await c.put(anfrage, r.clone());
        const alte = (await c.keys()).filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; });
        await Promise.all(alte.map((k) => c.delete(k)));
      }
      return r;
    }));
    return;
  }

  // App selbst: sofort aus dem Speicher, im Hintergrund aktualisieren
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const treffer = await c.match(anfrage);
    const netz = fetch(anfrage).then((r) => { if (r.ok && url.pathname.indexOf("/d/") === -1) c.put(anfrage, r.clone()); return r; }).catch(() => treffer);
    return treffer || netz;
  }));
});
