/* Gesundheit - Service Worker: App offline verfügbar, Daten zwischengespeichert (verschlüsselt). */
const VERSION = "gesundheit-app-1.7.1";
const DATEN = "gesundheit-daten";
const SCHALE = [
  "./", "index.html", "style.css?v=1.7.1", "start.js?v=1.7.1", "app.js?v=1.7.1", "ios-heute.js?v=1.7.1", "teilen.js?v=1.7.1", "manifest.webmanifest",
  "vendor/echarts.min.js", "vendor/bls.json", "vendor/zxing.min.js", "vendor/swiss.json", "fonts/atkinson-next-latin.woff2", "fonts/atkinson-next-latin-ext.woff2",
  "icons/favicon-64.png", "icons/icon-180.png", "icons/icon-512.png", "icons/icon-192.png",
  // Arztbericht: auch ohne Netz erstellbar
  "bericht.js?v=1.7.1", "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "fonts/atkinson-next-regular.ttf", "fonts/atkinson-next-bold.ttf",
];

self.addEventListener("install", (e) => {
  // Jede Datei frisch vom Server holen: der Zusatz ?sw=… umgeht den Zwischenspeicher von GitHub Pages
  // (bis zu 10 Minuten), damit nie eine alte Datei in die neue Version rutscht.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SCHALE.map(async (pfad) => {
    const url = new URL(pfad, self.registration.scope);
    const frisch = new URL(url);
    frisch.searchParams.set("sw", VERSION);
    const r = await fetch(frisch, { cache: "reload" });
    if (!r.ok) throw new Error(`${pfad}: HTTP ${r.status}`);
    await c.put(url, r);
  }))));
  // Übernehmen erst auf Zuruf der App: Sie wartet, bis die laufende Version nichts mehr zu tun hat.
  // Ohne App (alle Fenster zu) übernimmt die neue Version beim nächsten Öffnen von selbst.
});

// Offene Abrufe dieser Version: Die App fragt danach, bevor sie eine neue Version übernehmen lässt
let offen = 0;
function zaehlen(p) {
  offen += 1;
  const fertig = () => { offen -= 1; };
  Promise.resolve(p).then(fertig, fertig);
  return p;
}
self.addEventListener("message", (e) => {
  if (e.data === "aktivieren") self.skipWaiting();
  else if (e.data === "ruhig" && e.ports && e.ports[0]) e.ports[0].postMessage({ offen });
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n.startsWith("gesundheit-app-") && n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Netzabruf mit Zeitlimit: Ein hängender Abruf soll weder die App noch das nächste Update aufhalten
// (eine neue Version übernimmt erst, wenn die alte keine Abrufe mehr offen hat).
function netz(anfrage, ms = 20000) {
  if (anfrage.mode === "navigate") return fetch(anfrage);
  const ab = new AbortController();
  const zeit = setTimeout(() => ab.abort(), ms);
  return fetch(anfrage, { signal: ab.signal }).finally(() => clearTimeout(zeit));
}
// In den Speicher schreiben, während die App die Antwort schon liest (nicht erst danach antworten)
function nebenbei(e, arbeit) {
  e.waitUntil(zaehlen(arbeit.catch(() => {})));
}

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  // Datenstand: immer zuerst aus dem Netz, ohne Netz der letzte bekannte
  if (url.pathname.endsWith("/d/index.enc") || url.pathname.endsWith("/d/profil.enc")) {
    const schluessel = new URL(url.pathname, self.registration.scope).href;
    e.respondWith(zaehlen(netz(anfrage).then((r) => {
      if (r.ok) { const kopie = r.clone(); nebenbei(e, caches.open(DATEN).then((c) => c.put(schluessel, kopie))); }
      return r;
    }).catch(() => caches.open(DATEN).then((c) => c.match(schluessel)).then((r) => r || Response.error()))));
    return;
  }

  // Versionierte Datendateien ändern sich nie: aus dem Speicher, sonst laden (alte Versionen entfernen)
  if (url.pathname.includes("/d/") && url.searchParams.has("v")) {
    e.respondWith(zaehlen(caches.open(DATEN).then(async (c) => {
      const treffer = await c.match(anfrage);
      if (treffer) return treffer;
      const r = await netz(anfrage);
      if (r.ok) {
        const kopie = r.clone();
        nebenbei(e, (async () => {
          await c.put(anfrage, kopie);
          const alte = (await c.keys()).filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; });
          await Promise.all(alte.map((k) => c.delete(k)));
        })());
      }
      return r;
    })));
    return;
  }

  // Versionsnummer der veröffentlichten App: immer aus dem Netz (dafür ist sie da)
  if (url.pathname.endsWith("/version.json")) return;

  // App selbst: aus dem Speicher dieser Version. Neue Versionen kommen als neuer Service Worker,
  // deshalb hier nichts im Hintergrund überschreiben (sonst könnte eine alte Datei zurückkommen).
  e.respondWith(zaehlen((async () => {
    let c = null;
    try {
      c = await caches.open(VERSION);
      const treffer = await c.match(anfrage);
      if (treffer) return treffer;
    } catch { c = null; } // Speicher nicht nutzbar: direkt aus dem Netz
    const r = await netz(anfrage);
    if (c && r.ok && url.pathname.indexOf("/d/") === -1) { const kopie = r.clone(); nebenbei(e, c.put(anfrage, kopie)); }
    return r;
  })()));
});
