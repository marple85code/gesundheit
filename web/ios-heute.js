/* =========================================================
   GaWi · iOS-Heute-Skin (Vorlage 1) – Version 3
   Datei: web/ios-heute.js – in index.html DIREKT nach app.js.
   Nur Optik auf "Heute" + Handy-Leiste + Profilbild-Funktion.
   Ändert KEINE Daten, KEINE Warnlogik, KEINE andere Datei.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Komplett eigenes CSS, wird einmalig injected ---------- */
  var CSS = `
body.ios-heute .kopf h1 { font-size: clamp(30px, 7vw, 38px); font-weight: 700; letter-spacing: -0.02em; }
.ios-profil { position: relative; margin-left: auto; display: flex; align-items: center; gap: 8px; flex: none; }
.ios-name { font-weight: 650; font-size: 14px; color: var(--tinte, #000); white-space: nowrap; }
@media (max-width: 400px) { .ios-name { display: none; } }
.ios-avatar {
  width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--blatt-2, #f2f2f7), var(--blatt, #fff));
  border: 1px solid var(--linie, rgba(60,60,67,.18)); color: var(--tinte, #000);
  font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: .02em;
  cursor: pointer; padding: 0; overflow: hidden;
}
.ios-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.ios-badge {
  position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: var(--kritisch, #ff3b30); color: #fff;
  font-size: 11px; font-weight: 700; line-height: 16px; text-align: center;
  border: 2px solid var(--papier, #f2f2f7); font-variant-numeric: tabular-nums; cursor: pointer;
}
.ios-badge[hidden] { display: none; }
.ios-punkt {
  position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--gut, #34c759); border: 2px solid var(--papier, #f2f2f7);
}
.ios-punkt.warnung { background: var(--warnung, #ffcc00); }
.ios-punkt.fehler { background: var(--kritisch, #ff3b30); }
.ios-menue {
  position: absolute; top: 50px; right: 0; z-index: 60; min-width: 220px;
  background: var(--blatt, #fff); border: 1px solid var(--linie, rgba(60,60,67,.18));
  border-radius: 14px; box-shadow: 0 12px 32px rgba(8,18,22,.18); padding: 6px; display: none;
}
.ios-menue.offen { display: block; }
.ios-menue .kopfzeile { font-size: 12px; font-weight: 600; color: var(--tinte-2, #666); padding: 6px 10px 8px; }
.ios-menue button {
  display: flex; width: 100%; align-items: center; gap: 8px; border: 0; background: transparent;
  color: var(--tinte, #000); font: inherit; font-size: 14px; font-weight: 600;
  padding: 9px 10px; border-radius: 9px; cursor: pointer; text-align: left;
}
.ios-menue button:hover { background: var(--blatt-2, #f2f2f7); }
.ios-menue button.gefahr { color: var(--kritisch, #ff3b30); }
.ios-menue .trenn { height: 1px; background: var(--linie, rgba(60,60,67,.18)); margin: 5px 4px; }
.ios-datei { display: none; }
.ios-pill {
  display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 2px 9px 2px 7px;
  border-radius: 999px; font-size: 11.5px; font-weight: 650; vertical-align: middle; white-space: nowrap;
}
.ios-pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.ios-pill.ios-opt { color: #1d8a3e; background: rgba(52,199,89,.14); }
.ios-pill.ios-ok  { color: #8a6100; background: rgba(255,204,0,.18); }
.ios-pill.ios-mit { color: #8a3c1e; background: rgba(236,131,90,.20); }
.ios-pill.ios-sch { color: #c0143c; background: rgba(255,59,48,.14); }
@media (prefers-color-scheme: dark) {
  .ios-pill.ios-opt { color: #7de08f; } .ios-pill.ios-ok { color: #ffd60a; }
  .ios-pill.ios-mit { color: #ffb08a; } .ios-pill.ios-sch { color: #ff8a80; }
}
body.ios-heute .kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 12px; }
body.ios-heute .kachel {
  border: 0; border-radius: 18px; background: var(--blatt, #fff); padding: 14px 14px 12px;
  box-shadow: 0 1px 2px rgba(8,18,22,.06), 0 8px 24px rgba(8,18,22,.06);
}
body.ios-heute .kachel.auffaellig { box-shadow: inset 0 0 0 2px var(--kritisch, #ff3b30), 0 8px 24px rgba(8,18,22,.06); }
body.ios-heute .kachel.auffaellig.stufe-hinweis { box-shadow: inset 0 0 0 2px var(--warnung, #ffcc00), 0 8px 24px rgba(8,18,22,.06); }
body.ios-heute .verlauf {
  border: 0; border-radius: 18px; background: var(--blatt, #fff); padding: 16px;
  box-shadow: 0 1px 2px rgba(8,18,22,.06), 0 8px 24px rgba(8,18,22,.06);
}
body.ios-heute .leiste {
  grid-template-columns: repeat(5, 1fr);
  border-top: .5px solid var(--linie, rgba(60,60,67,.28));
  background: color-mix(in srgb, var(--blatt, #fff) 88%, transparent);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
}
body.ios-heute .leiste a[href="#hinweise"] { display: none; }
body.ios-heute .leiste a[href="#koerper"] { order: 1; }
body.ios-heute .leiste a[href="#herz"]   { order: 2; }
body.ios-heute .leiste a[href="#heute"]  { order: 3; }
body.ios-heute .leiste a[href="#schlaf"] { order: 4; }
body.ios-heute .leiste a[href="#sport"]  { order: 5; }
body.ios-heute .leiste a[aria-current="page"], body.ios-heute .leiste a.aktiv, body.ios-heute .leiste a.on { color: #0a84ff; }
body.ios-heute .leiste a[aria-current="page"]::before, body.ios-heute .leiste a.aktiv::before, body.ios-heute .leiste a.on::before { display: none; }
@media print { .ios-pill, .ios-profil { display: none !important; } }
`;

  function cssInjizieren() {
    if (document.getElementById("ios-heute-css")) return;
    var s = document.createElement("style");
    s.id = "ios-heute-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var BILD_KEY = "gawi.profilbild";
  var STUFEN = {
    optimal:  { wort: "optimal",  klasse: "ios-opt" },
    ok:       { wort: "ok",       klasse: "ios-ok"  },
    mittel:   { wort: "mittel",   klasse: "ios-mit" },
    schlecht: { wort: "schlecht", klasse: "ios-sch" }
  };

  function istHeute() {
    var z = (location.hash || "").replace(/^#\/?/, "");
    return z === "" || z === "heute";
  }
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "");
  }

  /* ---------- Stufe aus Warnklassen der App (Rückfall) ---------- */
  function stufeDom(wurzel) {
    if (!wurzel) return "optimal";
    if (wurzel.querySelector(".chip.ernst, .ernst")) return "mittel";
    var a = wurzel.querySelector(".achtung");
    if (a) return a.classList.contains("stufe-hinweis") ? "ok" : "schlecht";
    if (wurzel.classList.contains("auffaellig")) {
      return wurzel.classList.contains("stufe-hinweis") ? "ok" : "schlecht";
    }
    return "optimal";
  }

  /* ---------- Stufe aus der App-Einordnung (befunde), falls vorhanden ---------- */
  var befundCache = { zeit: 0, map: null };
  function stufeWort(s) {
    s = String(s || "").toLowerCase();
    if (!s) return null;
    if (s.indexOf("krit") !== -1 || s.indexOf("schlecht") !== -1) return "schlecht";
    if (s.indexOf("ernst") !== -1 || s.indexOf("mittel") !== -1) return "mittel";
    if (s.indexOf("warn") !== -1 || s.indexOf("hinweis") !== -1 || s === "ok") return "ok";
    if (s.indexOf("gut") !== -1 || s.indexOf("optimal") !== -1) return "optimal";
    return null;
  }
  async function befundKarte() {
    if (typeof befunde !== "function") return null;
    var jetzt = Date.now();
    if (befundCache.map && jetzt - befundCache.zeit < 60000) return befundCache.map;
    try {
      var b = await befunde();
      var map = new Map();
      function eintrag(name, stufe) {
        var n = norm(name);
        var level = stufeWort(stufe);
        if (n && level && !map.has(n)) map.set(n, level);
      }
      function feld(v) { return v && (v.stufe || v.level || v.klasse || v.einordnung); }
      if (b && Array.isArray(b.ok)) b.ok.forEach(function (o) { eintrag(o && o.name, "gut"); });
      if (b && Array.isArray(b.liste)) b.liste.forEach(function (l) { eintrag(l && (l.name || l.id), feld(l)); });
      var roh = (b && (b.map || b)) || null;
      if (roh instanceof Map) {
        roh.forEach(function (v, k) { eintrag(k, feld(v)); eintrag(v && v.name, feld(v)); });
      } else if (Array.isArray(roh)) {
        roh.forEach(function (v) { eintrag(v && (v.name || v.titel || v.id), feld(v)); });
      } else if (typeof roh === "object") {
        Object.keys(roh).forEach(function (k) {
          var v = roh[k];
          eintrag(k, feld(v) || (typeof v === "string" ? v : null));
          eintrag(v && v.name, feld(v));
        });
      }
      befundCache = { zeit: jetzt, map: map };
      return map;
    } catch (e) {
      befundCache = { zeit: jetzt, map: null };
      return null;
    }
  }
  function stufeAusKarte(karte, titelNorm) {
    if (!karte || !titelNorm) return null;
    if (karte.has(titelNorm)) return karte.get(titelNorm);
    var gefunden = null;
    karte.forEach(function (lv, kt) {
      if (gefunden || kt.length < 3) return;
      if (titelNorm.indexOf(kt) !== -1) gefunden = lv;
    });
    return gefunden;
  }

  /* ---------- Pillen ---------- */
  function pill(level) {
    var s = STUFEN[level];
    var span = document.createElement("span");
    span.className = "ios-pill " + s.klasse;
    span.setAttribute("data-ios-pill", level);
    span.title = "Einordnung: " + s.wort;
    span.textContent = s.wort;
    return span;
  }
  function setzePill(ziel, level) {
    if (!ziel) return;
    var alt = ziel.querySelector(":scope > .ios-pill");
    if (alt && alt.getAttribute("data-ios-pill") === level) return;
    if (alt) alt.remove();
    ziel.appendChild(pill(level));
  }

  /* ---------- Name aus dem Garmin-Profil ---------- */
  var nameCache = null;
  function nameHolen() {
    if (nameCache) return nameCache;
    nameCache = (async function () {
      try {
        var info = await Daten.info("garmin");
        var p = (info && (info.profil || info)) || {};
        return p.fullName || p.displayName || p.profileName || p.name || "";
      } catch (e) { return ""; }
    })();
    return nameCache;
  }
  function initialen(name) {
    var t = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!t.length) return "•";
    return (t[0][0] + (t[1] ? t[1][0] : "")).toUpperCase();
  }

  /* ---------- Profilbild: laden, speichern, zeichnen ---------- */
  function bildLaden() { try { return localStorage.getItem(BILD_KEY) || null; } catch (e) { return null; } }
  function bildSpeichern(d) { try { localStorage.setItem(BILD_KEY, d); } catch (e) {} }
  function bildLoeschen() { try { localStorage.removeItem(BILD_KEY); } catch (e) {} }
  function bildVerarbeiten(datei, fertig) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var z = 256;
        var c = document.createElement("canvas");
        c.width = z; c.height = z;
        var ctx = c.getContext("2d");
        var s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, z, z);
        fertig(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(datei);
  }
  function avatarZeichnen(wrap, name) {
    var av = wrap.querySelector(".ios-avatar");
    var bild = bildLaden();
    if (bild) av.innerHTML = '<img alt="Profilbild" src="' + bild + '">';
    else av.textContent = initialen(name);
  }

  /* ---------- Profil-Kopf mit Menü "Profilbild bearbeiten" ---------- */
  function menueSchliessen() {
    var m = document.querySelector(".ios-menue");
    if (m) m.classList.remove("offen");
  }
  function profilAnlegen() {
    var kopf = document.querySelector("main .kopf, .kopf");
    if (!kopf || kopf.querySelector(".ios-profil")) return;
    var wrap = document.createElement("div");
    wrap.className = "ios-profil";
    wrap.innerHTML =
      '<span class="ios-name"></span>' +
      '<button type="button" class="ios-avatar" title="Profilbild bearbeiten" aria-haspopup="menu">•</button>' +
      '<span class="ios-badge" hidden title="Hinweise anzeigen"></span>' +
      '<span class="ios-punkt" title="Sync-Status"></span>' +
      '<div class="ios-menue" role="menu"></div>' +
      '<input type="file" accept="image/*" class="ios-datei">';
    kopf.appendChild(wrap);

    var menue = wrap.querySelector(".ios-menue");
    var datei = wrap.querySelector(".ios-datei");
    var zeile = document.createElement("div");
    zeile.className = "kopfzeile";
    zeile.textContent = "Profil";
    var btnAendern = document.createElement("button");
    btnAendern.type = "button";
    btnAendern.textContent = "Profilbild ändern …";
    var trenn = document.createElement("div");
    trenn.className = "trenn";
    var btnEntfernen = document.createElement("button");
    btnEntfernen.type = "button";
    btnEntfernen.className = "gefahr";
    btnEntfernen.textContent = "Profilbild entfernen";
    menue.append(zeile, btnAendern, trenn, btnEntfernen);

    wrap.querySelector(".ios-avatar").addEventListener("click", function (e) {
      e.stopPropagation();
      menue.classList.toggle("offen");
    });
    btnAendern.addEventListener("click", function () { menueSchliessen(); datei.click(); });
    btnEntfernen.addEventListener("click", function () {
      bildLoeschen();
      menueSchliessen();
      nameHolen().then(function (n) { avatarZeichnen(wrap, n); });
    });
    datei.addEventListener("change", function () {
      var f = datei.files && datei.files[0];
      if (!f) return;
      bildVerarbeiten(f, function (data) {
        bildSpeichern(data);
        nameHolen().then(function (n) { avatarZeichnen(wrap, n); });
      });
      datei.value = "";
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) menueSchliessen();
    });
    wrap.querySelector(".ios-badge").addEventListener("click", function () {
      location.hash = "#hinweise";
    });
    nameHolen().then(function (n) {
      wrap.querySelector(".ios-name").textContent = n || "";
      zeile.textContent = n ? "Angemeldet als " + n : "Profil";
      avatarZeichnen(wrap, n);
    });
    function entfernenSichtbar() { btnEntfernen.style.display = bildLaden() ? "" : "none"; }
    entfernenSichtbar();
    menue.addEventListener("click", entfernenSichtbar);
  }
  function profilAktualisieren() {
    var wrap = document.querySelector(".ios-profil");
    if (!wrap) return;
    var marke = document.querySelector(".nav-marke:not([hidden])");
    var badge = wrap.querySelector(".ios-badge");
    if (marke && marke.textContent) { badge.textContent = marke.textContent; badge.hidden = false; }
    else badge.hidden = true;
    var punkt = wrap.querySelector(".ios-punkt");
    var sp = document.querySelector(".stand-punkt");
    punkt.className = "ios-punkt" +
      (sp && sp.classList.contains("fehler") ? " fehler" :
       sp && sp.classList.contains("warnung") ? " warnung" : "");
  }

  /* ---------- Pillen auf Kacheln und Kurven-Überschriften ---------- */
  async function pillenSetzen() {
    var karte = await befundKarte();
    var levelJeTitel = new Map();
    document.querySelectorAll("main .kachel").forEach(function (k) {
      var titel = k.querySelector(".kachel-titel, .kachel-kopf, .titel") || k.firstElementChild;
      var nt = norm(titel ? titel.textContent : "");
      var level = stufeAusKarte(karte, nt) || stufeDom(k);
      setzePill(titel, level);
      if (nt) levelJeTitel.set(nt, level);
    });
    document.querySelectorAll("main .verlauf").forEach(function (v) {
      var h = v.querySelector(".verlauf-kopf h3") || v.querySelector("h3");
      var nt = norm(h ? h.textContent : "");
      var level = stufeAusKarte(karte, nt) || stufeDom(v);
      if (level === "optimal" && nt && nt.length > 5) {
        levelJeTitel.forEach(function (lv, kt) {
          if (level !== "optimal" || kt.length < 5) return;
          if (nt.indexOf(kt) !== -1 || kt.indexOf(nt) !== -1) level = lv;
        });
      }
      setzePill(h, level);
    });
  }

  /* ---------- Hauptlogik: nur auf "Heute" aktiv ---------- */
  async function anwenden() {
    cssInjizieren();
    if (!istHeute()) { document.body.classList.remove("ios-heute"); return; }
    document.body.classList.add("ios-heute");
    profilAnlegen();
    profilAktualisieren();
    await pillenSetzen();
  }
  var timer = null;
  function planen() { clearTimeout(timer); timer = setTimeout(anwenden, 250); }
  function start() {
    cssInjizieren();
    new MutationObserver(planen).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", planen);
    planen();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

