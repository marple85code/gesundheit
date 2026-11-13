/* =========================================================
   GaWi · iOS-Skin (Vorlage 1) – Version 5
   Datei: web/ios-heute.js – in index.html DIREKT nach app.js.
   a) Heute: komplettes iOS-Aussehen (Farben, Karten, Knöpfe).
   b) ALLE Einstufungen in der App werden ersetzt durch:
      optimal=gruen, ok=gelb, mittel=orange, schlecht=rot.
   c) Profilbild-Funktion. Keine Daten-, keine Logik-Aenderung.
   ========================================================= */
(function () {
  "use strict";

  var CSS = `
/* ---- iOS-Grundfarben nur fuer die App-Oberflaeche ---- */
body.ios-heute {
  --papier: #f2f2f7; --blatt: #ffffff; --blatt-2: #f2f2f7;
  --tinte: #1c1c1e; --tinte-2: #6e6e73; --tinte-3: #8e8e93;
  --linie: #e5e5ea; --linie-stark: #d1d1d6;
  --rose: #ff2d55; --rose-zart: #ffe0e6; --rose-mittel: #ff8fa3;
  --wash: rgba(120, 120, 128, 0.12);
  --radius: 18px; --radius-klein: 10px; --radius-gross: 22px;
  background: var(--papier);
}
@media (prefers-color-scheme: dark) {
  body.ios-heute {
    --papier: #000000; --blatt: #1c1c1e; --blatt-2: #2c2c2e;
    --tinte: #ffffff; --tinte-2: #98989d; --tinte-3: #7c7c80;
    --linie: #38383a; --linie-stark: #48484a;
    --wash: rgba(255, 255, 255, 0.08); --rose: #ff375f;
  }
}
/* ---- Kopf ---- */
body.ios-heute .kopf { background: color-mix(in srgb, var(--papier) 82%, transparent); }
body.ios-heute .kopf h1 { font-size: clamp(30px, 7vw, 38px); font-weight: 700; letter-spacing: -0.02em; }
body.ios-heute .stand { border: 0; background: transparent; padding: 0; font-size: 12px; color: var(--tinte-2); }
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
  border-radius: 9px; background: #ff3b30; color: #fff;
  font-size: 11px; font-weight: 700; line-height: 16px; text-align: center;
  border: 2px solid var(--papier, #f2f2f7); font-variant-numeric: tabular-nums; cursor: pointer;
}
.ios-badge[hidden] { display: none; }
.ios-punkt {
  position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%;
  background: #34c759; border: 2px solid var(--papier, #f2f2f7);
}
.ios-punkt.warnung { background: #ffcc00; }
.ios-punkt.fehler { background: #ff3b30; }
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
.ios-menue button.gefahr { color: #ff3b30; }
.ios-menue .trenn { height: 1px; background: var(--linie, rgba(60,60,67,.18)); margin: 5px 4px; }
.ios-datei { display: none; }
/* ---- DEIN 4er-Schema: ersetzt ueberall die alten Einstufungen ---- */
.ios-stufe {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px;
  border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; line-height: 1.3;
}
.ios-stufe::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
.ios-stufe.l-opt { color: #006300; background: rgba(12, 163, 12, 0.14); }
.ios-stufe.l-ok  { color: #7d5300; background: rgba(250, 178, 25, 0.22); }
.ios-stufe.l-mit { color: #8a3c1e; background: rgba(236, 131, 90, 0.22); }
.ios-stufe.l-sch { color: #b02a2a; background: rgba(208, 59, 59, 0.15); }
@media (prefers-color-scheme: dark) {
  .ios-stufe.l-opt { color: #7de08f; } .ios-stufe.l-ok { color: #ffd60a; }
  .ios-stufe.l-mit { color: #ffb08a; } .ios-stufe.l-sch { color: #ff8a80; }
}
.marker-stufe.l-opt { color: #0ca30c; } .marker-stufe.l-ok { color: #b07800; }
.marker-stufe.l-mit { color: #c05a2e; } .marker-stufe.l-sch { color: #d03b3b; }
/* Pille neben Kurven-Namen (nur wo keine Einstufung im Kasten steht) */
.ios-pill {
  display: inline-flex; align-items: center; gap: 5px; margin-left: 8px; padding: 2px 9px 2px 7px;
  border-radius: 999px; font-size: 11.5px; font-weight: 650; vertical-align: middle; white-space: nowrap;
}
.ios-pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.ios-pill.ios-opt { color: #006300; background: rgba(12,163,12,.14); }
.ios-pill.ios-ok  { color: #7d5300; background: rgba(250,178,25,.22); }
.ios-pill.ios-mit { color: #8a3c1e; background: rgba(236,131,90,.22); }
.ios-pill.ios-sch { color: #b02a2a; background: rgba(208,59,59,.15); }
@media (prefers-color-scheme: dark) {
  .ios-pill.ios-opt { color: #7de08f; } .ios-pill.ios-ok { color: #ffd60a; }
  .ios-pill.ios-mit { color: #ffb08a; } .ios-pill.ios-sch { color: #ff8a80; }
}
/* ---- iOS-Kartenkoepfe: farbiges Icon + farbiger Name ---- */
.ios-ico { display: inline-flex; width: 17px; height: 17px; margin-right: 6px; vertical-align: -3px; }
.ios-ico svg { width: 100%; height: 100%; fill: currentColor; }
body.ios-heute .kachel-titel, body.ios-heute .verlauf-kopf h3 { font-size: 15px; font-weight: 700; }
.ios-sect {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 4px 4px 10px; font-size: 15px; font-weight: 700; color: var(--tinte, #000);
}
.ios-sect span { font-weight: 600; color: var(--tinte-2, #666); font-size: 13px; }
/* ---- Heute: Karten, Begruessung, Knopfe, Tabellen im iOS-Stil ---- */
body.ios-heute .begruessung { font-size: 14px; color: var(--tinte-2); margin: 6px 0 8px; }
body.ios-heute .brief {
  max-width: 100%; margin: 0 0 16px; padding: 16px;
  background: var(--blatt); border-radius: 18px; border: 0;
  box-shadow: 0 1px 2px rgba(8,18,22,.06), 0 8px 24px rgba(8,18,22,.06);
  font-size: 19px; font-weight: 600; line-height: 1.35; color: var(--tinte);
}
body.ios-heute .brief strong { font-weight: 700; }
body.ios-heute .kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 12px; }
body.ios-heute .kachel, body.ios-heute a.kachel {
  border: 0; border-radius: 18px; background: var(--blatt); padding: 14px 14px 12px;
  box-shadow: 0 1px 2px rgba(8,18,22,.06), 0 8px 24px rgba(8,18,22,.06);
}
body.ios-heute .kachel.auffaellig { box-shadow: inset 0 0 0 2px #ff3b30, 0 8px 24px rgba(8,18,22,.06); }
body.ios-heute .kachel.auffaellig.stufe-hinweis { box-shadow: inset 0 0 0 2px #ffcc00, 0 8px 24px rgba(8,18,22,.06); }
body.ios-heute .verlauf {
  border: 0; border-radius: 18px; background: var(--blatt); padding: 16px;
  box-shadow: 0 1px 2px rgba(8,18,22,.06), 0 8px 24px rgba(8,18,22,.06);
}
body.ios-heute h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
/* iOS-Segmented-Control fuer Zeitraeume und Umschalter */
body.ios-heute .segmente { background: rgba(120,120,128,.16); border: 0; padding: 2px; border-radius: 9px; }
body.ios-heute .segmente button { border-radius: 7px; padding: 5px 10px; font-size: 13px; color: var(--tinte); }
body.ios-heute .segmente button[aria-pressed="true"] {
  background: var(--blatt); color: var(--tinte); font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,.14);
}
/* Tabellen wie iOS-Listen */
body.ios-heute .tabellen-rahmen { border: 0; border-radius: 12px; overflow: hidden; }
body.ios-heute table.tabelle th {
  background: var(--blatt-2); color: var(--tinte-2);
  font-size: 12px; text-transform: uppercase; letter-spacing: .4px;
}
/* ---- Leiste unten: iOS-Tabbar ---- */
body.ios-heute .leiste {
  grid-template-columns: repeat(5, 1fr);
  border-top: .5px solid var(--linie-stark, rgba(60,60,67,.28));
  background: color-mix(in srgb, var(--blatt, #fff) 88%, transparent);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
}
body.ios-heute .leiste a { font-size: 10px; }
body.ios-heute .leiste a svg { width: 26px; height: 26px; }
body.ios-heute .leiste a[href="#hinweise"] { display: none; }
body.ios-heute .leiste a[href="#koerper"] { order: 1; }
body.ios-heute .leiste a[href="#herz"]   { order: 2; }
body.ios-heute .leiste a[href="#heute"]  { order: 3; }
body.ios-heute .leiste a[href="#schlaf"] { order: 4; }
body.ios-heute .leiste a[href="#sport"]  { order: 5; }
body.ios-heute .leiste a[aria-current="page"], body.ios-heute .leiste a.aktiv, body.ios-heute .leiste a.on { color: #0a84ff; }
body.ios-heute .leiste a[aria-current="page"]::before, body.ios-heute .leiste a.aktiv::before, body.ios-heute .leiste a.on::before { display: none; }
@media print { .ios-pill, .ios-profil, .ios-sect { display: none !important; } }
`;

  function cssInjizieren() {
    if (document.getElementById("ios-heute-css")) return;
    var s = document.createElement("style");
    s.id = "ios-heute-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var BILD_KEY = "gawi.profilbild";
  var WORT = { optimal: "optimal", ok: "ok", mittel: "mittel", schlecht: "schlecht" };
  var KURZ = { optimal: "opt", ok: "ok", mittel: "mit", schlecht: "sch" };
  var PILLKLASSE = { optimal: "ios-opt", ok: "ios-ok", mittel: "ios-mit", schlecht: "ios-sch" };

  /* ---------- DEIN 4er-Schema: Ersatz fuer ALLE alten Einstufungen ---------- */
  var KLASSE_STUFE = { gut: "optimal", warnung: "ok", ernst: "mittel", kritisch: "schlecht" };
  var WORT_REGELN = [
    [/(optimal|normal|gut|ausgeglichen|unauffällig|unauffaellig|im ziel)/, "optimal"],
    [/(grenzwertig|leicht erhöht|leicht erhoeht|knapp|^ok$|warnung)/, "ok"],
    [/(sehr hoch|auffällig|auffaellig|deutlich|kritisch|schlecht)/, "schlecht"],
    [/(mittel|erhöht|erhoeht|hoch|mäßig|maessig|ernst)/, "mittel"]
  ];
  function stufeAusText(t) {
    t = String(t || "").trim().toLowerCase();
    for (var i = 0; i < WORT_REGELN.length; i++) if (WORT_REGELN[i][0].test(t)) return WORT_REGELN[i][1];
    return null;
  }
  function ersetzeChips() {
    document.querySelectorAll(".chip").forEach(function (c) {
      if (c.dataset.ios) return;
      var level = null;
      Object.keys(KLASSE_STUFE).forEach(function (k) {
        if (!level && c.classList.contains(k)) level = KLASSE_STUFE[k];
      });
      if (!level) level = stufeAusText(c.textContent);
      if (!level) { c.dataset.ios = "keep"; return; }
      c.dataset.ios = "1";
      c.title = "ursprünglich: " + c.textContent.trim();
      c.className = "ios-stufe l-" + KURZ[level];
      c.textContent = WORT[level];
    });
  }
  function ersetzeMarker() {
    document.querySelectorAll(".marker-stufe").forEach(function (m) {
      if (m.dataset.ios) return;
      var mk = m.closest(".marker");
      var level = null;
      if (mk) {
        var sk = mk.querySelector(".marker-skala");
        if (sk) {
          if (sk.querySelector("span.an.kritisch")) level = "schlecht";
          else if (sk.querySelector("span.an.ernst")) level = "mittel";
          else if (sk.querySelector("span.an.warn")) level = "ok";
          else if (sk.querySelector("span.an.gut") || sk.querySelector("span.an.neutral")) level = "optimal";
        }
      }
      if (!level) level = stufeAusText(m.textContent);
      if (!level) { m.dataset.ios = "keep"; return; }
      m.dataset.ios = "1";
      m.title = "ursprünglich: " + m.textContent.trim();
      m.classList.add("l-" + KURZ[level]);
      m.textContent = WORT[level];
    });
  }
  function einstufungenKonvertieren() { ersetzeChips(); ersetzeMarker(); }

  /* ---------- iOS-Kategorien: Farbe + Icon je Wertename ---------- */
  var KAT = [
    { re: /blutdruck|pulse wave|gefaess|gefäß/, farbe: "#ff3b30", icon: '<path d="M12 2s7 8.2 7 13a7 7 0 0 1-14 0C5 10.2 12 2 12 2z"/>' },
    { re: /herz|puls|hrv|ekg|vorhof/, farbe: "#ff2d55", icon: '<path d="M12 21s-7.2-4.7-9.6-8.6C.5 9 2.4 5.4 6 5.4c2 0 3.4 1.1 4 2.3.6-1.2 2-2.3 4-2.3 3.6 0 5.5 3.6 3.6 7C19.2 16.3 12 21 12 21z"/>' },
    { re: /schlaf|nacht|erholung/, farbe: "#5e5ce6", icon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' },
    { re: /schritt|aktivitaet|aktivität|intensiv|etagen/, farbe: "#ff9f0a", icon: '<path d="M13 2s4 3.6 4 8a4 4 0 0 1-8 0c0-1.6.8-3 1.6-4.2.4 1.6 1.4 2.2 1.4 2.2S11 4.6 13 2z"/><path d="M12 22a6 6 0 0 0 6-6c0-1.2-.3-2.3-.8-3.3A6 6 0 0 1 12 15a6 6 0 0 1-5.2-2.3A6.9 6.9 0 0 0 6 16a6 6 0 0 0 6 6z"/>' },
    { re: /battery|batterie|energie|stress/, farbe: "#8ac800", icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>' },
    { re: /vo2|vo₂|training|sport|lauf|leistung/, farbe: "#34c759", icon: '<circle cx="13" cy="4.5" r="2"/><path d="M9.8 9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z"/>' },
    { re: /gewicht|koerper|körper|fett|muskel|bmi|wasser|knochen|bauch/, farbe: "#30b0c7", icon: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7z"/>' }
  ];
  function katVon(text) {
    var t = String(text || "").toLowerCase();
    for (var i = 0; i < KAT.length; i++) if (KAT[i].re.test(t)) return KAT[i];
    return { farbe: "#8e8e93", icon: '<circle cx="12" cy="12" r="5"/>' };
  }
  function iconsSetzen() {
    document.querySelectorAll("main .kachel-titel, main .verlauf-kopf h3").forEach(function (el) {
      if (el.querySelector(".ios-ico")) return;
      var k = katVon(el.textContent);
      var span = document.createElement("span");
      span.className = "ios-ico";
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = '<svg viewBox="0 0 24 24">' + k.icon + "</svg>";
      el.insertBefore(span, el.firstChild);
      el.style.color = k.farbe;
    });
  }
  function abschnittSetzen() {
    var kacheln = document.querySelector("main .kacheln");
    if (!kacheln) return;
    var vor = kacheln.previousElementSibling;
    if (vor && vor.classList.contains("ios-sect")) return;
    var z = document.createElement("div");
    z.className = "ios-sect";
    z.innerHTML = "Angeheftet<span>Heute</span>";
    kacheln.parentNode.insertBefore(z, kacheln);
  }

  function istHeute() {
    var z = (location.hash || "").replace(/^#\/?/, "");
    return z === "" || z === "heute";
  }
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "");
  }

  /* ---------- Stufe fuer Kurven-Pillen (Warnlogik der App) ---------- */
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
  var befundCache = { zeit: 0, map: null };
  function stufeWort(s) {
    s = String(s || "").toLowerCase();
    if (!s) return null;
    if (s.indexOf("krit") !== -1 || s.indexOf("schlecht") !== -1) return "schlecht";
    if (s.indexOf("ernst") !== -1 || s.indexOf("mittel") !== -1) return "mittel";
    if (s.indexOf("warn") !== -1 || s.indexOf("hinweis") !== -1 || s === "ok") return "ok";
    if (s.indexOf("gut") !== -1 || s.indexOf("optimal") !== -1 || s.indexOf("normal") !== -1) return "optimal";
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

  /* ---------- Pillen nur neben Kurven-Namen ---------- */
  function pill(level) {
    var span = document.createElement("span");
    span.className = "ios-pill " + PILLKLASSE[level];
    span.setAttribute("data-ios-pill", level);
    span.title = "Einordnung: " + WORT[level];
    span.textContent = WORT[level];
    return span;
  }
  function setzePill(ziel, level) {
    if (!ziel) return;
    var alt = ziel.querySelector(":scope > .ios-pill");
    if (alt && alt.getAttribute("data-ios-pill") === level) return;
    if (alt) alt.remove();
    ziel.appendChild(pill(level));
  }
  async function pillenSetzen() {
    var karte = await befundKarte();
    var levelJeTitel = new Map();
    document.querySelectorAll("main .kachel").forEach(function (k) {
      var nt = norm((k.querySelector(".kachel-titel") || {}).textContent || "");
      var level = stufeAusKarte(karte, nt) || stufeDom(k);
      if (nt) levelJeTitel.set(nt, level);
      /* Pille nur, wenn im Kasten keine Einstufung steht */
      if (!k.querySelector(".ios-stufe, .chip") && level !== "optimal") {
        setzePill(k.querySelector(".kachel-titel"), level);
      }
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

  /* ---------- Name + Profilbild ---------- */
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

  /* ---------- Hauptlogik ---------- */
  async function anwenden() {
    cssInjizieren();
    document.body.classList.add("ios-skin");
    einstufungenKonvertieren();
    if (!istHeute()) { document.body.classList.remove("ios-heute"); return; }
    document.body.classList.add("ios-heute");
    profilAnlegen();
    profilAktualisieren();
    abschnittSetzen();
    iconsSetzen();
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