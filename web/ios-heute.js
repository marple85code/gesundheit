/* =========================================================
   GaWi · iOS-26-Design & 4-Stufen-Bewertung – Version 7
   Datei: web/ios-heute.js (in index.html direkt nach app.js)
   Farbschema:
     Grün   = optimal
     Gelb   = ok
     Orange = mittel
     Rot    = schlecht
   ========================================================= */
(function () {
  "use strict";

  var CSS = `
/* ---- iOS-26 Grundfarben für die gesamte App ---- */
body.ios-skin {
  --papier: #f2f2f7;
  --blatt: #ffffff;
  --blatt-2: #f2f2f7;
  --tinte: #1c1c1e;
  --tinte-2: #6e6e73;
  --tinte-3: #8e8e93;
  --linie: #e5e5ea;
  --linie-stark: #d1d1d6;
  --rose: #ff2d55;
  --rose-zart: #ffe0e6;
  --rose-mittel: #ff8fa3;
  --wash: rgba(120, 120, 128, 0.12);
  --radius: 20px;
  --radius-klein: 12px;
  --radius-gross: 24px;
  background: var(--papier);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Atkinson Next", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) body.ios-skin {
    --papier: #000000;
    --blatt: #1c1c1e;
    --blatt-2: #2c2c2e;
    --tinte: #ffffff;
    --tinte-2: #98989d;
    --tinte-3: #7c7c80;
    --linie: #38383a;
    --linie-stark: #48484a;
    --wash: rgba(255, 255, 255, 0.10);
    --rose: #ff375f;
  }
}
:root[data-theme="dark"] body.ios-skin {
  --papier: #000000;
  --blatt: #1c1c1e;
  --blatt-2: #2c2c2e;
  --tinte: #ffffff;
  --tinte-2: #98989d;
  --tinte-3: #7c7c80;
  --linie: #38383a;
  --linie-stark: #48484a;
  --wash: rgba(255, 255, 255, 0.10);
  --rose: #ff375f;
}

/* ---- Kopfzeile & Profil-Avatar ---- */
body.ios-skin .kopf {
  background: color-mix(in srgb, var(--papier) 84%, transparent);
  backdrop-filter: saturate(1.8) blur(20px);
  -webkit-backdrop-filter: saturate(1.8) blur(20px);
}
body.ios-skin .kopf h1 { font-weight: 700; letter-spacing: -0.025em; }
body.ios-skin .kopf.startseite h1 { font-size: clamp(30px, 7vw, 36px); }
body.ios-skin .stand {
  border: 0; background: var(--blatt); padding: 6px 11px; font-size: 12px;
  color: var(--tinte-2); box-shadow: 0 1px 4px rgba(0,0,0,.05);
}

.ios-profil { position: relative; margin-left: auto; display: flex; align-items: center; gap: 8px; flex: none; }
.ios-name { display: none !important; font-weight: 600; font-size: 14px; color: var(--tinte); white-space: nowrap; }
/* Handy: Titel bekommt Platz in der ersten Zeile (nicht abgeschnitten), Status und Knöpfe rücken
   darunter; der Name bleibt neben dem Avatar sichtbar und wird nur bei Platzmangel gekürzt. */
@media (max-width: 640px) {
  /* Zeile 1: Status links, Sync und Menü rechts oben. Zeile 2: Begrüßung links, Profilbild rechts darunter. */
  body.ios-skin .kopf { flex-wrap: wrap; row-gap: 10px; align-items: center; }
  body.ios-skin .kopf .kopf-zurueck { order: 0; }
  body.ios-skin .kopf .stand { order: 1; }
  body.ios-skin .kopf .sync-knopf { order: 2; margin-left: auto; }
  body.ios-skin .kopf .menue-knopf { order: 3; }
  body.ios-skin .kopf::after { content: ""; order: 4; flex: 0 0 100%; height: 0; }
  body.ios-skin .kopf .kopf-titel { order: 5; flex: 1 1 0; min-width: 0; }
  body.ios-skin .kopf .ios-profil { order: 6; margin-left: auto; }
  body.ios-skin .kopf.startseite h1 { font-size: clamp(24px, 7.2vw, 32px); line-height: 1.15; }
}
.ios-avatar {
  width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%);
  border: 0; color: #ffffff;
  font-weight: 700; font-size: 17px; text-transform: uppercase; letter-spacing: .02em;
  cursor: pointer; padding: 0; overflow: hidden;
  box-shadow: 0 2px 8px rgba(255, 45, 85, 0.25);
}
.ios-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.ios-badge {
  position: absolute; top: -4px; right: -4px; min-width: 19px; height: 19px; padding: 0 5px;
  border-radius: 10px; background: #ff3b30; color: #fff; font-size: 11px; font-weight: 700;
  line-height: 17px; text-align: center; border: 2px solid var(--papier);
  font-variant-numeric: tabular-nums; cursor: pointer;
}
.ios-badge[hidden] { display: none; }
.ios-punkt {
  position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%;
  background: #34c759; border: 2px solid var(--papier);
}
.ios-punkt.warnung { background: #ffcc00; }
.ios-punkt.fehler { background: #ff3b30; }
.ios-menue {
  position: absolute; top: 50px; right: 0; z-index: 60; min-width: 230px;
  background: var(--blatt); border: 1px solid var(--linie);
  border-radius: 16px; box-shadow: 0 14px 36px rgba(0, 0, 0, .18); padding: 6px; display: none;
}
.ios-menue.offen { display: block; }
.ios-menue .kopfzeile { font-size: 12px; font-weight: 600; color: var(--tinte-2); padding: 6px 10px 8px; }
.ios-menue button {
  display: flex; width: 100%; align-items: center; gap: 8px; border: 0; background: transparent;
  color: var(--tinte); font: inherit; font-size: 14px; font-weight: 600;
  padding: 9px 10px; border-radius: 10px; cursor: pointer; text-align: left;
}
.ios-menue button:hover { background: var(--blatt-2); }
.ios-menue button.gefahr { color: #ff3b30; }
.ios-menue .trenn { height: 1px; background: var(--linie); margin: 5px 4px; }
.ios-datei { display: none; }

/* ---- 4-Stufen-Farbschema: Grün=optimal, Gelb=ok, Orange=mittel, Rot=schlecht ---- */
.ios-stufe, .ios-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px 3px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 650; white-space: nowrap; line-height: 1.25;
}
.ios-pill { margin-left: auto; font-size: 11.5px; padding: 2px 9px 2px 7px; }
.ios-stufe::before, .ios-pill::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none;
}

/* Grün = optimal */
.ios-stufe.l-opt, .ios-pill.ios-opt { color: #1b873f; background: rgba(52, 199, 89, 0.16); }
/* Gelb = ok */
.ios-stufe.l-ok,  .ios-pill.ios-ok  { color: #946800; background: rgba(255, 204, 0, 0.24); }
/* Orange = mittel */
.ios-stufe.l-mit, .ios-pill.ios-mit { color: #c25100; background: rgba(255, 149, 0, 0.20); }
/* Rot = schlecht */
.ios-stufe.l-sch, .ios-pill.ios-sch { color: #c81e32; background: rgba(255, 59, 48, 0.16); }

@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .ios-stufe.l-opt,
  :root:where(:not([data-theme="light"])) .ios-pill.ios-opt { color: #4cd964; background: rgba(52, 199, 89, 0.22); }
  :root:where(:not([data-theme="light"])) .ios-stufe.l-ok,
  :root:where(:not([data-theme="light"])) .ios-pill.ios-ok  { color: #ffd60a; background: rgba(255, 214, 10, 0.22); }
  :root:where(:not([data-theme="light"])) .ios-stufe.l-mit,
  :root:where(:not([data-theme="light"])) .ios-pill.ios-mit { color: #ff9f0a; background: rgba(255, 159, 10, 0.22); }
  :root:where(:not([data-theme="light"])) .ios-stufe.l-sch,
  :root:where(:not([data-theme="light"])) .ios-pill.ios-sch { color: #ff6961; background: rgba(255, 69, 58, 0.22); }
}
:root[data-theme="dark"] .ios-stufe.l-opt, :root[data-theme="dark"] .ios-pill.ios-opt { color: #4cd964; background: rgba(52, 199, 89, 0.22); }
:root[data-theme="dark"] .ios-stufe.l-ok,  :root[data-theme="dark"] .ios-pill.ios-ok  { color: #ffd60a; background: rgba(255, 214, 10, 0.22); }
:root[data-theme="dark"] .ios-stufe.l-mit, :root[data-theme="dark"] .ios-pill.ios-mit { color: #ff9f0a; background: rgba(255, 159, 10, 0.22); }
:root[data-theme="dark"] .ios-stufe.l-sch, :root[data-theme="dark"] .ios-pill.ios-sch { color: #ff6961; background: rgba(255, 69, 58, 0.22); }

.marker-stufe.l-opt { color: #1b873f; }
.marker-stufe.l-ok  { color: #946800; }
.marker-stufe.l-mit { color: #c25100; }
.marker-stufe.l-sch { color: #c81e32; }

/* ---- iOS-Karten (keine gelben/roten Rahmen, reinweiß mit sanftem Schatten) ---- */
.ios-ico { display: inline-flex; width: 16px; height: 16px; margin-right: 6px; flex: none; }
.ios-ico svg { width: 100%; height: 100%; fill: currentColor; }

body.ios-skin .kachel-titel {
  display: flex; align-items: center; gap: 2px;
  font-size: 14px; font-weight: 650; line-height: 1.25;
  padding-right: 0 !important;
}
body.ios-skin .verlauf-kopf h3 {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  font-size: 16px; font-weight: 700;
}
body.ios-skin .kachel > .achtung { display: none !important; }
body.ios-skin .kachel-befund { display: none !important; }
body.ios-skin .kachel-einstufung { font-size: 12.5px; font-weight: 650; color: #1b873f; }
body.ios-skin .kachel-einstufung.stufe-hinweis { color: #946800; }
body.ios-skin .kachel-einstufung.stufe-ernst { color: #c25100; }
body.ios-skin .kachel-einstufung.stufe-kritisch { color: #c81e32; }
:root[data-theme="dark"] body.ios-skin .kachel-einstufung, :root[data-theme="dark"] .kachel-einstufung { color: #4cd964; }
:root[data-theme="dark"] .kachel-einstufung.stufe-hinweis { color: #ffd60a; }
:root[data-theme="dark"] .kachel-einstufung.stufe-ernst { color: #ff9f0a; }
:root[data-theme="dark"] .kachel-einstufung.stufe-kritisch { color: #ff6961; }

body.ios-skin .kachel, body.ios-skin a.kachel {
  border: 0 !important;
  border-radius: 20px;
  background: var(--blatt);
  padding: 14px 15px 13px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 20px rgba(0, 0, 0, 0.04) !important;
  transition: transform 0.15s ease;
}
body.ios-skin a.kachel:active { transform: scale(0.985); }

body.ios-skin .kachel-wert {
  font-size: 28px; font-weight: 700; letter-spacing: -0.025em;
  color: var(--tinte); margin-top: 2px;
}
body.ios-skin .kachel-wert small { font-size: 15px; font-weight: 550; color: var(--tinte-3); }
body.ios-skin .kachel-unter { font-size: 12.5px; color: var(--tinte-2); line-height: 1.3; }
body.ios-skin .kachel .paar b { font-size: 22px; font-weight: 700; color: var(--tinte); }
body.ios-skin .kachel .paar span { font-size: 12px; color: var(--tinte-2); }

/* iOS-Mini-Visualisierungen in den Kacheln */
.ios-mini { width: 100%; height: 34px; margin-top: 6px; display: flex; align-items: flex-end; }
.ios-mini svg { width: 100%; height: 100%; overflow: visible; }
.ios-schlaf-bar {
  display: flex; width: 100%; height: 10px; border-radius: 999px; overflow: hidden;
  gap: 2px; margin-top: 14px; background: var(--blatt-2);
}
.ios-schlaf-bar span { display: block; height: 100%; border-radius: 3px; }
body.ios-skin .kachel .messer { display: none; }

body.ios-skin .verlauf {
  border: 0; border-radius: 20px; background: var(--blatt); padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 20px rgba(0, 0, 0, 0.04);
}
body.ios-skin h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
body.ios-skin .segmente { background: rgba(120, 120, 128, .15); border: 0; padding: 2px; border-radius: 10px; }
body.ios-skin .segmente button { border-radius: 8px; padding: 5px 10px; font-size: 13px; color: var(--tinte); border: 0; }
body.ios-skin .segmente button[aria-pressed="true"] {
  background: var(--blatt); color: var(--tinte); font-weight: 650; box-shadow: 0 1px 4px rgba(0, 0, 0, .14);
}
body.ios-skin .chips button { border: 0; background: var(--wash); color: var(--tinte-2); border-radius: 999px; }
body.ios-skin .chips button[aria-pressed="true"] {
  background: var(--blatt); color: var(--tinte); font-weight: 650; box-shadow: 0 1px 4px rgba(0, 0, 0, .14);
}
body.ios-skin .tabellen-rahmen { border: 0; border-radius: 14px; overflow: hidden; }
body.ios-skin table.tabelle th {
  background: var(--blatt-2); color: var(--tinte-2); font-size: 12px;
  text-transform: uppercase; letter-spacing: .04em;
}
body.ios-skin .knopf { border-radius: 12px; }
body.ios-skin .knopf:not(.zweit) { background: #007aff; border-color: #007aff; color: #fff; }
body.ios-skin .knopf.zweit { background: var(--wash); border: 0; color: var(--tinte); }
body.ios-skin .befund { border-radius: 16px; border: 0; box-shadow: 0 2px 12px rgba(0,0,0,.05); }
body.ios-skin .bericht-link, body.ios-skin .hinweis {
  border: 0; border-radius: 18px; box-shadow: 0 2px 12px rgba(0,0,0,.04);
}

/* ---- Navigation unten (Handy) & links (Chromebook) ---- */
body.ios-skin .leiste {
  grid-template-columns: repeat(6, 1fr);
  border-top: .5px solid var(--linie-stark);
  background: color-mix(in srgb, var(--blatt) 88%, transparent);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
}
body.ios-skin .leiste a { font-size: 10px; font-weight: 600; }
body.ios-skin .leiste a svg { width: 25px; height: 25px; }
body.ios-skin .leiste a[href="#hinweise"] { display: none; }
body.ios-skin .leiste a[href="#koerper"] { order: 1; }
body.ios-skin .leiste a[href="#herz"]    { order: 2; }
body.ios-skin .leiste a[href="#essen"]   { order: 3; }
body.ios-skin .leiste a[href="#heute"]   { order: 4; }
body.ios-skin .leiste a[href="#schlaf"]  { order: 5; }
body.ios-skin .leiste a[href="#sport"]   { order: 6; }
body.ios-skin .leiste a[aria-current="page"],
body.ios-skin .leiste a.aktiv,
body.ios-skin .leiste a.on { color: #007aff; }
body.ios-skin .leiste a[aria-current="page"]::before,
body.ios-skin .leiste a.aktiv::before,
body.ios-skin .leiste a.on::before { display: none; }

body.ios-skin .seitenleiste { background: var(--blatt); border-right-color: var(--linie); }
body.ios-skin .seitenleiste a[aria-current="page"] { color: #007aff; background: rgba(0, 122, 255, 0.10); border-radius: 12px; }
body.ios-skin .seitenleiste a[aria-current="page"]::before { display: none; }

/* ---- Startseite "Heute": Begrüßung, Zusammenfassung & Favoriten-Header ---- */
body.ios-heute .begruessung {
  font-size: 14px; font-weight: 600; color: var(--tinte-2); margin: 4px 0 8px;
}
body.ios-heute .brief {
  max-width: 100%; margin: 0 0 18px; padding: 16px 18px;
  background: var(--blatt); border-radius: 20px; border: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 20px rgba(0, 0, 0, 0.04);
  font-size: clamp(18px, 4.4vw, 22px); font-weight: 500; line-height: 1.38; color: var(--tinte-2);
}
body.ios-heute .brief strong { font-weight: 700; color: var(--tinte); }
.ios-sect {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 2px 4px 10px; font-size: 17px; font-weight: 700; color: var(--tinte);
}
.ios-sect a, .ios-sect span { font-weight: 600; color: #007aff; font-size: 14px; text-decoration: none; }
body.ios-heute .kacheln {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
}
@media (min-width: 680px) { body.ios-heute .kacheln { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1060px) { body.ios-heute .kacheln { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

@media print { .ios-pill, .ios-profil, .ios-sect, .ios-mini, .ios-schlaf-bar { display: none !important; } }
`;

  function cssInjizieren() {
    if (document.getElementById("ios-heute-css")) return;
    var s = document.createElement("style");
    s.id = "ios-heute-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var BILD_KEY = "gawi.profilbild", NAME_KEY = "gawi.name";
  var WORT = { optimal: "optimal", ok: "ok", mittel: "mittel", schlecht: "schlecht" };
  var KURZ = { optimal: "opt", ok: "ok", mittel: "mit", schlecht: "sch" };
  var PILLKLASSE = { optimal: "ios-opt", ok: "ios-ok", mittel: "ios-mit", schlecht: "ios-sch" };
  var KLASSE_STUFE = { gut: "optimal", warnung: "ok", ernst: "mittel", kritisch: "schlecht" };

  var WORT_REGELN = [
    [/(optimal|normal|gut|ausgeglichen|unauffällig|unauffaellig|im ziel)/, "optimal"],
    [/(grenzwertig|leicht erhöht|leicht erhoeht|knapp|^ok$|warnung|ausbaufähig|etwas zu wenig)/, "ok"],
    [/(sehr hoch|auffällig|auffaellig|deutlich|kritisch|schlecht|vorhofflimmern|überlastung)/, "schlecht"],
    [/(mittel|erhöht|erhoeht|hoch|mäßig|maessig|ernst|unausgeglichen|unproduktiv)/, "mittel"]
  ];

  function stufeAusText(t) {
    t = String(t || "").trim().toLowerCase();
    for (var i = 0; i < WORT_REGELN.length; i++) if (WORT_REGELN[i][0].test(t)) return WORT_REGELN[i][1];
    return null;
  }

  /* ---- Fachlich bewertbare Kennzahlen erkennen ---- */
  var BEWERTBAR_RE = /(blutdruck|ruhepuls|hrv|herzfrequenzvariabilität|schlaf|schritte|gewicht|bmi|körperfett|koerperfett|muskel|magermasse|viszeral|pulswelle|gefäß|gefaess|ekg|qtc|sauerstoff|spo2|atem|stress|intensitätsminuten|fitnessalter|trainingsstatus|nerven)/i;

  function istBewertbar(titelText, wurzel) {
    if (wurzel && (wurzel.classList.contains("auffaellig") || wurzel.querySelector(".achtung, .chip, .ios-stufe"))) return true;
    return BEWERTBAR_RE.test(String(titelText || ""));
  }

  function ersetzeChips() {
    document.querySelectorAll(".chip").forEach(function (c) {
      if (c.dataset.ios) return;
      if (c.textContent.trim().toLowerCase().startsWith("zone ")) { c.dataset.ios = "keep"; return; }
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
      var mk = m.closest(".marker"), level = null;
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

  /* ---- iOS-Kategorien: Farbe + Symbol ---- */
  var KAT = [
    { id: "bp",   re: /blutdruck|pulswelle|gefäß|gefaess/, farbe: "#ff3b30", icon: '<path d="M12 2s7 8.2 7 13a7 7 0 0 1-14 0C5 10.2 12 2 12 2z"/>' },
    { id: "herz", re: /herz|puls|hrv|ekg|vorhof/, farbe: "#ff2d55", icon: '<path d="M12 21s-7.2-4.7-9.6-8.6C.5 9 2.4 5.4 6 5.4c2 0 3.4 1.1 4 2.3.6-1.2 2-2.3 4-2.3 3.6 0 5.5 3.6 3.6 7C19.2 16.3 12 21 12 21z"/>' },
    { id: "schlaf", re: /schlaf|nacht|erholung/, farbe: "#5e5ce6", icon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' },
    { id: "schritt", re: /schritt|aktivität|aktivitaet|intensiv|etagen/, farbe: "#ff9500", icon: '<path d="M13 2s4 3.6 4 8a4 4 0 0 1-8 0c0-1.6.8-3 1.6-4.2.4 1.6 1.4 2.2 1.4 2.2S11 4.6 13 2z"/><path d="M12 22a6 6 0 0 0 6-6c0-1.2-.3-2.3-.8-3.3A6 6 0 0 1 12 15a6 6 0 0 1-5.2-2.3A6.9 6.9 0 0 0 6 16a6 6 0 0 0 6 6z"/>' },
    { id: "energie", re: /battery|batterie|energie|stress/, farbe: "#8ac800", icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>' },
    { id: "sport", re: /vo2|vo₂|training|sport|lauf|leistung|bereitschaft/, farbe: "#34c759", icon: '<circle cx="13" cy="4.5" r="2"/><path d="M9.8 9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z"/>' },
    { id: "koerper", re: /gewicht|körper|koerper|fett|muskel|bmi|wasser|knochen|bauch/, farbe: "#30b0c7", icon: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7z"/>' }
  ];

  function katVon(text) {
    var t = String(text || "").toLowerCase();
    for (var i = 0; i < KAT.length; i++) if (KAT[i].re.test(t)) return KAT[i];
    return { id: "sonst", farbe: "#8e8e93", icon: '<circle cx="12" cy="12" r="5"/>' };
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

  /* ---- iOS-Mini-Charts in Kacheln aufwerten ---- */
  function kachelChartsAufwerten() {
    document.querySelectorAll("main .kachel").forEach(function (k) {
      if (k.dataset.iosChart) return;
      var titelEl = k.querySelector(".kachel-titel");
      var kat = katVon(titelEl ? titelEl.textContent : "");
      var altFunke = k.querySelector("svg.funke");
      var wertEl = k.querySelector(".kachel-wert");
      var zahlWert = wertEl ? parseFloat(wertEl.textContent.replace(/\./g, "").replace(",", ".")) : NaN;

      // 1) Schlaf: mehrteiliger blauer Schlafphasen-Balken wie im iOS-Design
      if (kat.id === "schlaf") {
        if (altFunke) altFunke.remove();
        var bar = document.createElement("div");
        bar.className = "ios-schlaf-bar";
        bar.innerHTML =
          '<span style="flex:24;background:#5e5ce6"></span>' +
          '<span style="flex:48;background:#32ade6"></span>' +
          '<span style="flex:28;background:#0a84ff"></span>';
        k.appendChild(bar);
        k.dataset.iosChart = "1";
        return;
      }

      // 2) Body Battery & Trainingsbereitschaft: iOS Halbkreis-Bogen
      if ((kat.id === "energie" || /bereitschaft/i.test(titelEl ? titelEl.textContent : "")) && Number.isFinite(zahlWert)) {
        if (altFunke) altFunke.remove();
        var pct = Math.max(5, Math.min(100, zahlWert)) / 100;
        var arcLen = 126; // Halbkreisumfang bei r=40
        var dash = (pct * arcLen).toFixed(1);
        var farbe = zahlWert >= 60 ? "#8ac800" : zahlWert >= 35 ? "#ffcc00" : "#ff9500";
        var box = document.createElement("div");
        box.className = "ios-mini";
        box.style.height = "38px";
        box.innerHTML =
          '<svg viewBox="0 0 100 52" preserveAspectRatio="xMidYMax meet">' +
          '<path d="M 10 48 A 40 40 0 0 1 90 48" fill="none" stroke="var(--linie)" stroke-width="9" stroke-linecap="round"/>' +
          '<path d="M 10 48 A 40 40 0 0 1 90 48" fill="none" stroke="' + farbe + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + arcLen + '"/>' +
          "</svg>";
        k.appendChild(box);
        k.dataset.iosChart = "1";
        return;
      }

      // 3) Schritte: orange iOS-Balken (letzter Balken kräftig orange, frühere hellorange)
      if (kat.id === "schritt") {
        var boxS = document.createElement("div");
        boxS.className = "ios-mini";
        var balken = [0.45, 0.72, 0.40, 0.85, 0.58, 0.92, 0.78];
        if (Number.isFinite(zahlWert)) balken[6] = Math.max(0.2, Math.min(1, zahlWert / 10000));
        var rects = balken.map(function (h, i) {
          var bh = Math.round(h * 28);
          var y = 30 - bh;
          var x = 8 + i * 13;
          var fill = i === 6 ? "#ff9500" : "rgba(255, 149, 0, 0.35)";
          return '<rect x="' + x + '" y="' + y + '" width="7" height="' + bh + '" rx="3.5" fill="' + fill + '"/>';
        }).join("");
        boxS.innerHTML = '<svg viewBox="0 0 106 32" preserveAspectRatio="xMidYMax meet">' + rects + "</svg>";
        k.appendChild(boxS);
        k.dataset.iosChart = "1";
        return;
      }

      // 4) Vorhandene Sparkline in der jeweiligen iOS-Kategoriefarbe einfärben
      if (altFunke) {
        var pfad = altFunke.querySelector("path");
        var kreis = altFunke.querySelector("circle");
        if (pfad) {
          pfad.setAttribute("stroke", kat.farbe);
          pfad.setAttribute("stroke-width", "2.1");
        }
        if (kreis) {
          kreis.setAttribute("fill", kat.farbe);
        }
        k.dataset.iosChart = "1";
      }
    });
  }

  function abschnittSetzen() {
    var kacheln = document.querySelector("main .kacheln");
    if (!kacheln) return;
    var vor = kacheln.previousElementSibling;
    if (vor && vor.classList.contains("ios-sect")) return;
    var z = document.createElement("div");
    z.className = "ios-sect";
    z.innerHTML = 'Favoriten<a href="#werte">Alle Werte</a>';
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

  /* ---- 4-Stufen-Logik aus Befunden & DOM ---- */
  function stufeDom(wurzel) {
    if (!wurzel) return "optimal";
    if (wurzel.querySelector(".ios-stufe.l-sch, .chip.kritisch")) return "schlecht";
    if (wurzel.querySelector(".ios-stufe.l-mit, .chip.ernst, .ernst")) return "mittel";
    var a = wurzel.querySelector(".achtung");
    if (a) return a.classList.contains("stufe-hinweis") ? "ok" : a.classList.contains("stufe-ernst") ? "mittel" : "schlecht";
    if (wurzel.classList.contains("auffaellig")) {
      return wurzel.classList.contains("stufe-hinweis") ? "ok" : wurzel.classList.contains("stufe-ernst") ? "mittel" : "schlecht";
    }
    return "optimal";
  }

  function pill(level) {
    var span = document.createElement("span");
    span.className = "ios-pill " + PILLKLASSE[level];
    span.setAttribute("data-ios-pill", level);
    span.title = "Bewertung: " + WORT[level];
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

  function pillenSetzen() {
    var levelJeTitel = new Map();
    document.querySelectorAll("main .kachel").forEach(function (k) {
      var titelEl = k.querySelector(".kachel-titel");
      var rohTitel = titelEl ? titelEl.textContent : "";
      var nt = norm(rohTitel);
      var level = stufeDom(k);
      if (nt) levelJeTitel.set(nt, level);
      // Alte unpassende Text-Chips in der Unterzeile entfernen, wenn die Pille oben sitzt
      var unter = k.querySelector(".kachel-unter");
      if (unter) {
        var alterChip = unter.querySelector(".ios-stufe");
        if (alterChip) {
          var l2 = alterChip.classList.contains("l-sch") ? "schlecht"
                 : alterChip.classList.contains("l-mit") ? "mittel"
                 : alterChip.classList.contains("l-ok")  ? "ok" : "optimal";
          level = l2;
          alterChip.remove();
        }
      }
      if (istBewertbar(rohTitel, k)) {
        setzePill(titelEl, level);
      }
    });

    document.querySelectorAll("main .verlauf").forEach(function (v) {
      var h = v.querySelector(".verlauf-kopf h3") || v.querySelector("h3");
      if (!h) return;
      var rohTitel = h.textContent;
      var nt = norm(rohTitel);
      var level = stufeDom(v);
      if (level === "optimal" && nt && nt.length > 4) {
        levelJeTitel.forEach(function (lv, kt) {
          if (level !== "optimal" || kt.length < 4) return;
          if (nt.indexOf(kt) !== -1 || kt.indexOf(nt) !== -1) level = lv;
        });
      }
      if (istBewertbar(rohTitel, v)) {
        setzePill(h, level);
      }
    });
  }

  /* ---- Profilbild & Name (über Geräte synchronisiert, wenn der Sync-Knopf freigeschaltet ist) ---- */
  function nameLaden() { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } }
  function bildLaden() { try { return localStorage.getItem(BILD_KEY) || null; } catch (e) { return null; } }
  function bildSpeichern(d) { try { localStorage.setItem(BILD_KEY, d); } catch (e) {} }
  function bildLoeschen() { try { localStorage.removeItem(BILD_KEY); } catch (e) {} }
  function initialen(name) {
    var t = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!t.length) return "G";
    return (t[0][0] + (t[1] ? t[1][0] : "")).toUpperCase();
  }
  function bildVerarbeiten(datei, fertig) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var z = 256, c = document.createElement("canvas");
        c.width = z; c.height = z;
        var ctx = c.getContext("2d"), s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, z, z);
        fertig(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(datei);
  }
  function avatarZeichnen(wrap) {
    var av = wrap.querySelector(".ios-avatar"), bild = bildLaden();
    if (bild) av.innerHTML = '<img alt="Profilbild" src="' + bild + '">';
    else av.textContent = initialen(nameLaden());
    wrap.querySelector(".ios-name").textContent = nameLaden();
    begruessung();
  }
  function menueSchliessen() {
    var m = document.querySelector(".ios-menue");
    if (m) m.classList.remove("offen");
  }
  function profilAnlegen() {
    var kopf = document.querySelector("main .kopf, .kopf");
    if (!kopf || kopf.querySelector(".ios-profil")) return;
    // Von einem anderen Gerät übertragenes Profilbild sofort im Avatar zeigen
    document.addEventListener("gawi:profil", function () {
      var w = document.querySelector(".ios-profil");
      if (w) avatarZeichnen(w);
    });
    var wrap = document.createElement("div");
    wrap.className = "ios-profil";
    wrap.innerHTML =
      '<span class="ios-name"></span>' +
      '<button type="button" class="ios-avatar" title="Profil bearbeiten" aria-haspopup="menu">G</button>' +
      '<span class="ios-badge" hidden title="Hinweise anzeigen"></span>' +
      '<span class="ios-punkt" title="Sync-Status"></span>' +
      '<div class="ios-menue" role="menu"></div>' +
      '<input type="file" accept="image/*" class="ios-datei">';
    kopf.appendChild(wrap);

    var menue = wrap.querySelector(".ios-menue"), datei = wrap.querySelector(".ios-datei");
    var zeile = document.createElement("div");
    zeile.className = "kopfzeile";
    var bBild = document.createElement("button");
    bBild.type = "button"; bBild.textContent = "Profilbild ändern …";
    var bName = document.createElement("button");
    bName.type = "button"; bName.textContent = "Namen ändern …";
    var trenn = document.createElement("div");
    trenn.className = "trenn";
    var bWeg = document.createElement("button");
    bWeg.type = "button"; bWeg.className = "gefahr"; bWeg.textContent = "Profilbild entfernen";
    menue.append(zeile, bBild, bName, trenn, bWeg);

    wrap.querySelector(".ios-avatar").addEventListener("click", function (e) {
      e.stopPropagation();
      menue.classList.toggle("offen");
    });
    bBild.addEventListener("click", function () { menueSchliessen(); datei.click(); });
    bName.addEventListener("click", function () {
      menueSchliessen();
      var n = window.prompt("Name für dieses Gerät:", nameLaden());
      if (n === null) return;
      try { n.trim() ? localStorage.setItem(NAME_KEY, n.trim()) : localStorage.removeItem(NAME_KEY); } catch (e) {}
      avatarZeichnen(wrap);
      zeileSetzen();
      if (window.GaWiSync && window.GaWiSync.profil) window.GaWiSync.profil();
    });
    bWeg.addEventListener("click", function () {
      bildLoeschen(); menueSchliessen(); avatarZeichnen(wrap); bWegSichtbar();
      if (window.GaWiSync && window.GaWiSync.profil) window.GaWiSync.profil();
    });
    datei.addEventListener("change", function () {
      var f = datei.files && datei.files[0];
      if (!f) return;
      bildVerarbeiten(f, function (data) {
        bildSpeichern(data); avatarZeichnen(wrap); bWegSichtbar();
        if (window.GaWiSync && window.GaWiSync.profil) window.GaWiSync.profil();
      });
      datei.value = "";
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) menueSchliessen();
    });
    wrap.querySelector(".ios-badge").addEventListener("click", function () {
      location.hash = "#hinweise";
    });
    function zeileSetzen() {
      var n = nameLaden();
      zeile.textContent = n ? "Angemeldet als " + n : "Profil dieses Geräts";
    }
    function bWegSichtbar() { bWeg.style.display = bildLaden() ? "" : "none"; }
    zeileSetzen(); bWegSichtbar(); avatarZeichnen(wrap);
    menue.addEventListener("click", function () { bWegSichtbar(); zeileSetzen(); });
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

  /* ---- Begrüßung statt „Heute“ auf der Startseite ---- */
  function begruessung() {
    var kopf = document.querySelector(".kopf");
    var h1 = kopf && kopf.querySelector(".kopf-titel");
    if (!h1 || !kopf.classList.contains("startseite")) return;
    var h = new Date().getHours(), n = nameLaden().trim();
    var gruss = h >= 5 && h < 11 ? "Guten Morgen" : h >= 11 && h < 17 ? "Hallo" : h >= 17 && h < 23 ? "Guten Abend" : "Gute Nacht";
    var text = n ? gruss + ", " + n : gruss;
    if (h1.textContent !== text) h1.textContent = text;
  }

  /* ---- Hauptlogik ---- */
  function anwenden() {
    cssInjizieren();
    document.body.classList.add("ios-skin");
    profilAnlegen();
    profilAktualisieren();
    begruessung();
    ersetzeChips();
    ersetzeMarker();
    iconsSetzen();
    pillenSetzen();
    if (!istHeute()) {
      document.body.classList.remove("ios-heute");
      return;
    }
    document.body.classList.add("ios-heute");
    abschnittSetzen();
    kachelChartsAufwerten();
  }

  var timer = null;
  function planen() { clearTimeout(timer); timer = setTimeout(anwenden, 180); }
  function start() {
    cssInjizieren();
    new MutationObserver(planen).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", planen);
    setInterval(begruessung, 60000);
    planen();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();