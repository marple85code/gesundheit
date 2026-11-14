/* Gesundheit – Arztbericht als PDF.
   Wird erst geladen, wenn ein Bericht erstellt wird. Alles passiert auf diesem Gerät:
   die Daten werden hier entschlüsselt und hier zum PDF zusammengesetzt. */
(() => {
"use strict";

// ---------------------------------------------------------------- Grundlagen
const SEITE = { b: 210, h: 297 };
const RAND = { l: 18, r: 18, o: 22, u: 20 };
const BREITE = SEITE.b - RAND.l - RAND.r;
const F = {
  tinte: [18, 38, 46], tinte2: [74, 91, 98], tinte3: [95, 108, 114], linie: [220, 227, 227], stark: [195, 204, 206],
  wash: [243, 246, 246], rose: [184, 51, 79], roseZart: [246, 214, 221], roseMittel: [231, 161, 174],
  gut: [12, 130, 12], ernst: [196, 84, 40], kritisch: [190, 46, 46],
  warnung: [125, 83, 0], // dunkles Gelb wie in der App, auf weißem Papier gut lesbar
};
// Diagrammfarben: immer die helle Fassung, Papier ist weiß
const P = {
  tinte: "#12262e", tinte2: "#4a5b62", tinte3: "#5f6c72", linie: "#dce3e3", stark: "#c3ccce",
  serie: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  phasen: ["#1d3f8f", "#32ade6", "#30d158", "#ffcc00"], // tief, leicht, REM, wach
};
// Zeichen, die die eingebettete Schrift kennt (Atkinson Hyperlegible Next, Latein)
const ERLAUBT = "20-7e,a0-ac,ae-b4,b6-107,10a-113,116-11b,11e-123,126-127,12a-12b,12e-133,136-137,139-13e,141-148,150-155,158-15b,15e-165,16a-16b,16e-17e,2013-2014,2018-201a,201c-201e,2020-2022,2026,2030,2039-203a,20ac,2122,2212,2264-2265"
  .split(",").map((r) => r.split("-").map((x) => parseInt(x, 16))).map(([a, b]) => [a, b ?? a]);
const ERSATZ = { "₂": "2", "₃": "3", "→": "–", "µ": "u", "↑": "", "↓": "", "⌀": "Ø", " ": " ", " ": " ", "‑": "-" };
function t(s) {
  return Array.from(String(s ?? "")).map((c) => {
    if (c in ERSATZ) return ERSATZ[c];
    const cp = c.codePointAt(0);
    return cp === 10 || ERLAUBT.some(([a, b]) => cp >= a && cp <= b) ? c : "?";
  }).join("");
}

let C, O, doc, y;
const VERSION = "1.7.4";

// Diese Hilfen gibt die App seit Version 1.2.2 mit. Eine ältere App, die nach einem Update kurz
// diesen neueren Berichtsteil lädt, kennt sie noch nicht – dann gelten diese gleichlautenden Fassungen.
const RUECKFALL = {
  W_BEREICHE: {
    fett: { w: [[39, 22, 33], [59, 24, 34], [999, 25, 36]], m: [[39, 8, 20], [59, 11, 22], [999, 13, 25]] },
    muskel: { w: [[39, 63, 75.5], [59, 62, 73.5], [999, 60, 72.5]], m: [[39, 75, 89], [59, 73, 86], [999, 70, 84]] },
    wasser: { w: [[999, 45, 60]], m: [[999, 50, 65]] },
    knochen: { w: [[999, 2.5, 4]], m: [[999, 3, 5]] },
  },
  PWV_GRENZE: [[29, 7.1], [39, 8.0], [49, 8.6], [59, 10.0], [69, 13.1], [999, 14.6]],
  wBereich(art, p) {
    const tab = C.W_BEREICHE[art] && C.W_BEREICHE[art][p.geschlecht];
    if (!tab || (p.alter == null && tab.length > 1)) return null;
    return (tab.find(([bis]) => (p.alter ?? 0) <= bis) || tab[tab.length - 1]).slice(1);
  },
  spanne(a, b, einheit = "") {
    const f = (v) => C.zahl(v, Number.isInteger(v) ? 0 : 1);
    return `${f(a)}–${f(b)}${einheit ? ` ${einheit}` : ""}`;
  },
  personAus(info, w) {
    const ud = (info.profil && info.profil.userData) || {};
    const ui = (info.person && info.person.userInfo) || {};
    const bio = (info.person && info.person.biometricProfile) || {};
    const fa = info.fitnessalter || {};
    const g = String(ud.gender || ui.genderType || ui.gender || "").toUpperCase();
    const geschlecht = g.startsWith("F") || g.startsWith("W") ? "w" : g.startsWith("M") ? "m" : null;
    let alter = null;
    const m = String(ud.birthDate || ui.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const jetzt = new Date();
      const vorGeburtstag = jetzt.getMonth() + 1 < +m[2] || (jetzt.getMonth() + 1 === +m[2] && jetzt.getDate() < +m[3]);
      alter = jetzt.getFullYear() - +m[1] - (vorGeburtstag ? 1 : 0);
    } else if (Number.isFinite(ui.age)) alter = ui.age;
    else if (Number.isFinite(fa.chronologicalAge)) alter = fa.chronologicalAge;
    const cm = [ud.height, bio.height].find((x) => Number.isFinite(x) && x > 100 && x < 250);
    const wg = C.letzter(C.wReihe(w, 4));
    const groesse = cm ? cm / 100 : wg && wg[1] > 1 && wg[1] < 2.5 ? wg[1] : null;
    return { geschlecht, alter, groesse, fitness: fa };
  },
  ekgKlasse(e) { // 0 unauffällig, 1 Vorhofflimmern, 2 nicht eindeutig, null ohne Auswertung
    if (e.afib === 0 || e.afib === 1 || e.afib === 2) return e.afib;
    const s = String(e.afib || "").toUpperCase();
    if (!s) return null;
    if (s.startsWith("NO_") || s.includes("SINUS") || s === "NORMAL") return 0;
    if (s.includes("FIBRILLATION") || s.includes("AFIB")) return 1;
    return 2;
  },
};
function mitRueckfall(ctx) {
  const c = { ...ctx };
  for (const [name, wert] of Object.entries(RUECKFALL)) if (c[name] == null) c[name] = wert;
  return c;
}

const DF = {
  lang: new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }),
  kurz: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
  tag: new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" }),
  tagKurz: new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric" }),
  monat: new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" }),
  uhr: new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }),
};
const zahl = (v, st = 0) => C.zahl(v, st);
const isoDatum = (iso) => DF.kurz.format(new Date(C.tagMs(iso)));
const msDatum = (ms) => DF.kurz.format(new Date(ms));
const uhr = (ms) => DF.uhr.format(new Date(ms));
const mittel = (l) => C.mittel(l);
function sd(l) { const v = l.filter(Number.isFinite); if (v.length < 2) return null; const m = mittel(v); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1)); }
const werteVon = (r) => r.map((p) => p[1]).filter(Number.isFinite);
const std = (stunden) => (stunden == null ? "–" : `${Math.floor(stunden)}:${String(Math.round((stunden % 1) * 60)).padStart(2, "0")} Std.`);
const pm = (v, st = 0) => C.vorzeichen(v, st);

// ---------------------------------------------------------------- Seitenaufbau
function neueSeite(quer = false) {
  doc.addPage("a4", quer ? "landscape" : "portrait");
  y = RAND.o + 4;
}
function unten() { return doc.internal.pageSize.getHeight() - RAND.u - 6; }
function platz(hoehe) { if (y + hoehe > unten()) neueSeite(); }
function schrift(groesse, fett = false, farbe = F.tinte) {
  doc.setFont("Atkinson", fett ? "bold" : "normal");
  doc.setFontSize(groesse);
  doc.setTextColor(...farbe);
}
function absatz(text, { groesse = 9.5, fett = false, farbe = F.tinte2, abstand = 2.4, breite = BREITE, x = RAND.l } = {}) {
  schrift(groesse, fett, farbe);
  const zeilen = doc.splitTextToSize(t(text), breite);
  const zh = groesse * 0.3528 * 1.36;
  for (const z of zeilen) {
    platz(zh);
    doc.text(z, x, y + groesse * 0.3528 * 0.82);
    y += zh;
  }
  y += abstand;
}
function ueberschrift(text, untertitel = null) {
  platz(30);
  y += 3;
  schrift(15, true);
  doc.text(t(text), RAND.l, y + 5.2);
  y += 8.2;
  doc.setDrawColor(...F.rose); doc.setLineWidth(0.7); doc.line(RAND.l, y, RAND.l + 12, y);
  y += 4.5;
  if (untertitel) absatz(untertitel, { abstand: 3 });
}
function zwischen(text, folgt = 16) {
  platz(8 + folgt);
  y += 2;
  schrift(10.5, true);
  doc.text(t(text), RAND.l, y + 3.8);
  y += 6.5;
}
/** Tabelle mit AutoTable; zeilen: Arrays aus Text oder {content, styles, colSpan} */
function tabelle(kopf, zeilen, { spalten = {}, abstand = 5, zelle = null, schriftgroesse = 8.6, ...weiter } = {}) {
  if (!zeilen.length) return;
  const sauber = (c) => (c && typeof c === "object" ? { ...c, content: t(c.content) } : t(c ?? "–"));
  platz(Math.min(30, (kopf ? 8 : 0) + zeilen.length * 6.5));
  const kopfAusrichten = (z) => {
    if (z.section === "head" && spalten[z.column.index] && spalten[z.column.index].halign) z.cell.styles.halign = spalten[z.column.index].halign;
    if (zelle) zelle(z);
  };
  doc.autoTable({
    startY: y,
    head: kopf ? [kopf.map(sauber)] : undefined,
    body: zeilen.map((z) => z.map(sauber)),
    margin: { left: RAND.l, right: RAND.r, top: RAND.o + 4, bottom: RAND.u + 7 },
    theme: "plain",
    styles: { font: "Atkinson", fontStyle: "normal", fontSize: schriftgroesse, textColor: F.tinte, cellPadding: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 },
      lineColor: F.linie, lineWidth: { bottom: 0.2 }, valign: "middle", overflow: "linebreak" },
    headStyles: { fontStyle: "bold", textColor: F.tinte2, fillColor: F.wash, lineColor: F.stark, lineWidth: { bottom: 0.3 } },
    columnStyles: spalten,
    didParseCell: kopfAusrichten,
    rowPageBreak: "avoid",
    showHead: "everyPage",
    ...weiter,
  });
  y = doc.lastAutoTable.finalY + abstand;
}
const rechts = { halign: "right" };
const gruppe = (text, spalten = 4) => [{ content: text, colSpan: spalten, styles: { fontStyle: "bold", textColor: F.tinte2, fillColor: F.wash, fontSize: 8.4 } }];
function hinweisKasten(text) {
  schrift(8.8, false, F.tinte2);
  const zeilen = doc.splitTextToSize(t(text), BREITE - 8);
  const hoehe = zeilen.length * 8.8 * 0.3528 * 1.36 + 5;
  platz(hoehe + 2);
  doc.setFillColor(...F.wash); doc.setDrawColor(...F.linie); doc.setLineWidth(0.2);
  doc.roundedRect(RAND.l, y, BREITE, hoehe, 1.6, 1.6, "FD");
  doc.text(zeilen, RAND.l + 4, y + 3 + 8.8 * 0.3528 * 0.82, { lineHeightFactor: 1.36 });
  y += hoehe + 4;
}

// ---------------------------------------------------------------- Diagramme (ECharts -> PNG)
const PX_MM = 4.3;
function achsenZahl(v) { const st = Math.abs(v - Math.round(v)) < 1e-6 ? 0 : 1; return zahl(v, st); }
function datumAchse(spanneTage) {
  return (v) => {
    const d = new Date(v);
    if (spanneTage > 150) return DF.monat.format(d);
    return d.getDate() >= 27 ? "" : DF.tagKurz.format(d); // sonst drängt sich der 29. an den 1. des nächsten Monats
  };
}
/** serien: [{name, daten:[[x,y]], farbe, art:'linie'|'balken'|'punkte', stapel, flaeche, unsichtbar, endWert, stellen}] */
async function diagramm({ serien, breite = BREITE, hoehe = 58, opt = {} }) {
  const w = Math.round(breite * PX_MM), hp = Math.round(hoehe * PX_MM);
  const div = document.createElement("div");
  div.style.cssText = `position:fixed;left:-20000px;top:0;width:${w}px;height:${hp}px;`;
  document.body.append(div);
  try {
    const chart = echarts.init(div, null, { renderer: "canvas", width: w, height: hp });
    const xMin = C.tagMs(O.von) - 43200000, xMax = C.tagMs(O.bis) + 43200000;
    const spanne = (xMax - xMin) / 86400000;
    const stil = { fontFamily: C.SCHRIFT, fontSize: 11, color: P.tinte3 };
    const sichtbar = serien.filter((s) => !s.unsichtbar && !s.ohneLegende);
    const option = {
      animation: false, backgroundColor: "#ffffff", textStyle: { fontFamily: C.SCHRIFT },
      grid: { left: 2, right: opt.rechts ?? 38, top: sichtbar.length > 1 ? 28 : 10, bottom: 2, containLabel: true },
      legend: sichtbar.length > 1 ? { top: 0, left: 0, itemGap: 16, itemWidth: 13, itemHeight: 7, textStyle: { ...stil, color: P.tinte2, fontSize: 11.5 },
        data: sichtbar.map((s) => ({ name: s.name, icon: s.art === "balken" ? "roundRect" : "path://M0,0 L14,0 L14,3 L0,3 Z", itemStyle: { color: s.farbe } })) } : undefined,
      xAxis: { type: "time", min: xMin, max: xMax, splitNumber: breite > 120 ? 6 : 3, axisLine: { lineStyle: { color: P.stark } }, axisTick: { show: false },
        axisLabel: { ...stil, hideOverlap: true, showMinLabel: false, showMaxLabel: false, formatter: datumAchse(spanne) }, splitLine: { show: false } },
      yAxis: { type: "value", scale: !opt.nullBasis, min: opt.yMin, max: opt.yMax, interval: opt.yIntervall, splitNumber: 4, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { ...stil, formatter: opt.yFormat || achsenZahl }, splitLine: { lineStyle: { color: P.linie } } },
      series: serien.map((s) => {
        const daten = s.daten.map((p) => [typeof p[0] === "string" ? C.tagMs(p[0]) : p[0], p[1]]);
        if (s.art === "balken") {
          return { name: s.name, type: "bar", data: daten, stack: s.stapel, barMaxWidth: 18, barMinWidth: 1, barGap: "10%", itemStyle: { color: s.farbe, borderRadius: s.stapel || daten.length > 60 ? 0 : [2, 2, 0, 0] } };
        }
        const punkte = s.art === "punkte" || daten.length <= 60;
        return {
          name: s.name, type: "line", data: daten, stack: s.stapel, connectNulls: true, showSymbol: punkte && !s.unsichtbar, symbol: "circle", symbolSize: s.art === "punkte" ? 5 : 4,
          lineStyle: { width: s.unsichtbar ? 0 : s.art === "punkte" ? 0 : 1.8, color: s.farbe, type: s.gestrichelt ? "dashed" : "solid" },
          itemStyle: { color: s.farbe, borderColor: "#ffffff", borderWidth: 1 },
          areaStyle: s.flaeche ? { color: s.farbe, opacity: 0.13 } : undefined, z: s.z ?? 2,
          endLabel: s.endWert ? { show: true, distance: 5, color: P.tinte, fontFamily: C.SCHRIFT, fontSize: 11, fontWeight: 700, formatter: (p) => (s.format ? s.format(p.value[1]) : zahl(p.value[1], s.stellen ?? 0)) } : undefined,
        };
      }),
    };
    if (opt.referenzen && opt.referenzen.length) {
      option.series.push({ type: "line", data: [], silent: true, markLine: { silent: true, symbol: "none", animation: false,
        lineStyle: { color: P.tinte3, type: "dashed", width: 1 },
        label: { show: true, color: P.tinte2, fontFamily: C.SCHRIFT, fontSize: 10.5, position: "insideStartTop", formatter: (p) => p.name || "", backgroundColor: "#ffffff", padding: [1, 3] },
        data: opt.referenzen.map((r) => ({ yAxis: r.wert, name: r.text, label: r.text ? undefined : { show: false } })) } });
    }
    chart.setOption(option, { notMerge: true, lazyUpdate: false });
    await new Promise((ok) => requestAnimationFrame(() => ok()));
    const url = chart.getDataURL({ type: "png", pixelRatio: 2.6, backgroundColor: "#ffffff" });
    chart.dispose();
    return { url, breite, hoehe };
  } finally { div.remove(); }
}
function bild(b, x = RAND.l) {
  platz(b.hoehe + 2);
  doc.addImage(b.url, "PNG", x, y, b.breite, b.hoehe, undefined, "FAST");
  y += b.hoehe + 2;
}
function bilderNebeneinander(a, b) {
  const hoehe = Math.max(a.hoehe, b.hoehe);
  platz(hoehe + 8);
  const start = y;
  doc.addImage(a.url, "PNG", RAND.l, start, a.breite, a.hoehe, undefined, "FAST");
  doc.addImage(b.url, "PNG", RAND.l + BREITE - b.breite, start, b.breite, b.hoehe, undefined, "FAST");
  y = start + hoehe + 2;
}
function bildTitel(text, x = RAND.l) {
  schrift(9.4, true, F.tinte);
  doc.text(t(text), x, y + 3.4);
}

// ---------------------------------------------------------------- Daten sammeln
async function sammeln() {
  const { Daten } = C;
  const vonMs = C.tagMs(O.von), bisMs = C.tagMs(O.bis) + 86399999;
  const imZr = (ms) => ms >= vonMs && ms <= bisMs;
  const [w, ekgAlle, akt, wInfo, gInfo] = await Promise.all([Daten.withings(), Daten.ekg(), Daten.aktivitaeten(), Daten.info("withings"), Daten.info("garmin")]);
  const k = await C.kennzahlen(["ruhepuls", "hrv", "hrv_unten", "hrv_oben", "schlaf_dauer", "schlaf_tief", "schlaf_leicht", "schlaf_rem", "schlaf_wach", "schlaf_score",
    "schlaf_atem", "schlaf_spo2", "spo2", "atem_wach", "schritte", "schrittziel", "im_mod", "im_int", "etagen", "aktivkcal", "vo2lauf", "vo2rad", "fitnessalter",
    "stress", "bb_hoch", "bb_tief"], O.von, O.bis);
  const spo2Tief = await Daten.reihe("g.tag.lowestSpo2", O.von, O.bis);
  const hrvStatus = await Daten.texte("g.hrv.status", O.von, O.bis);
  const wr = (typ, pos = -1) => C.wReihe(w, typ, pos).filter((p) => imZr(p[0]));
  const bp = C.blutdruckMessungen(w).filter((m) => imZr(m.ts));
  const ekg = ekgAlle.filter((e) => e.ts && imZr(e.ts * 1000)).sort((a, b) => a.ts - b.ts);
  const geraete = [];
  for (const d of ((wInfo.geraete || {}).devices || [])) if (d.model) geraete.push(`Withings ${d.model}`);
  const gg = Array.isArray(gInfo.geraete) ? gInfo.geraete : [];
  for (const d of gg) { const n = d.productDisplayName || d.displayName; if (n && !geraete.includes(`Garmin ${n}`)) geraete.push(`Garmin ${n}`); }
  const groesseW = C.letzter(C.wReihe(w, 4));
  const groesseG = gInfo.profil && gInfo.profil.userData && gInfo.profil.userData.height ? gInfo.profil.userData.height / 100 : null;
  return {
    w, wr, bp, ekg, k, spo2Tief, hrvStatus, geraete, gInfo,
    akt: akt.filter((a) => { const d = String(a.start || "").slice(0, 10); return d >= O.von && d <= O.bis; }).sort((a, b) => (a.start < b.start ? -1 : 1)),
    groesse: groesseW ? groesseW[1] : groesseG,
  };
}

// ---------------------------------------------------------------- Bausteine je Bereich
const BP_FARBEN = { sys: P.serie[0], dia: P.serie[1] };
const rund = (v, stellen = 0) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 10 ** stellen) / 10 ** stellen);
// Mittelwerte so gerundet, wie sie im Bericht stehen – eingeordnet wird der angezeigte Wert
function bpMittel(l) { return l.length ? { sys: rund(mittel(l.map((m) => m.sys))), dia: rund(mittel(l.map((m) => m.dia))), puls: rund(mittel(l.map((m) => m.puls).filter(Number.isFinite))), n: l.length, tage: new Set(l.map((m) => C.isoAusMs(m.ts))).size } : null; }
const bpText = (x) => (x ? `${zahl(x.sys)}/${zahl(x.dia)} mmHg` : "–");
function letzte7Tage(bp) {
  const tage = [...new Set(bp.map((m) => C.isoAusMs(m.ts)))].sort().slice(-7);
  return bp.filter((m) => tage.includes(C.isoAusMs(m.ts)));
}
function anfangEnde(r) { return r.length ? [r[0], r[r.length - 1]] : [null, null]; }
function afibText(e) {
  const a = e.afib;
  if (a === 0 || a === "0") return "Kein Vorhofflimmern erkannt";
  if (a === 1 || a === "1") return "Hinweis auf Vorhofflimmern";
  if (a === 2 || a === "2") return "Nicht eindeutig";
  const s = String(a || "").toUpperCase();
  if (!s) return "ohne Auswertung";
  if (s.includes("SINUS")) return "Sinusrhythmus";
  if (s.includes("ATRIAL") || s.includes("AFIB")) return "Hinweis auf Vorhofflimmern";
  if (s.includes("INCONCLUSIVE")) return "Nicht eindeutig";
  if (s.includes("HIGH")) return "Herzfrequenz zu hoch für Auswertung";
  if (s.includes("LOW")) return "Herzfrequenz zu niedrig für Auswertung";
  if (s.includes("POOR")) return "Aufzeichnung unzureichend";
  return C.textDeutsch(a);
}
function auffaellig(e) { const k = C.ekgKlasse(e); return k === 1 || k === 2; }

// ---------------------------------------------------------------- Titelseite und Übersicht
function titelseite(d) {
  y = RAND.o - 6;
  // Marke: Quadrat mit EKG-Linie
  doc.setFillColor(...F.tinte); doc.roundedRect(RAND.l, y, 11, 11, 3, 3, "F");
  doc.setDrawColor(...F.roseMittel); doc.setLineWidth(0.75); doc.setLineCap("round"); doc.setLineJoin("round");
  doc.lines([[2.2, 0], [1.1, -2.6], [1.9, 5.4], [1.5, -3.8], [0.8, 1], [2.1, 0]], RAND.l + 1.3, y + 6.4, [1, 1], "S", false);
  doc.setLineCap("butt");
  schrift(9, false, F.tinte3);
  doc.text("Gesundheits-App", RAND.l + 14, y + 4.4);
  doc.text(t(`Erstellt am ${DF.lang.format(new Date())}`), RAND.l + 14, y + 8.8);
  y += 22;
  schrift(26, true);
  doc.text("Gesundheitsbericht", RAND.l, y);
  y += 9;
  const tage = Math.round((C.tagMs(O.bis) - C.tagMs(O.von)) / 86400000) + 1;
  schrift(12, false, F.tinte2);
  doc.text(t(`${DF.lang.format(new Date(C.tagMs(O.von)))} bis ${DF.lang.format(new Date(C.tagMs(O.bis)))} (${tage} Tage)`), RAND.l, y);
  y += 9;
  const person = [];
  if (O.name) person.push(["Name", O.name]);
  if (O.geburt) {
    const g = new Date(C.tagMs(O.geburt));
    const heute = new Date();
    let alter = heute.getFullYear() - g.getFullYear();
    if (heute < new Date(heute.getFullYear(), g.getMonth(), g.getDate())) alter--;
    person.push(["Geburtsdatum", `${DF.kurz.format(g)} (${alter} Jahre)`]);
  }
  if (d.groesse) person.push(["Körpergröße", `${zahl(d.groesse * 100)} cm`]);
  if (d.geraete.length) person.push(["Messgeräte", d.geraete.join(", ")]);
  if (person.length) {
    tabelle(null, person.map(([a, b]) => [{ content: a, styles: { textColor: F.tinte2 } }, b]), { spalten: { 0: { cellWidth: 34 } }, schriftgroesse: 9.4, abstand: 4 });
  }
  if (O.notiz) {
    zwischen("Anmerkung");
    hinweisKasten(O.notiz);
  }
}

// Einordnung für die Übersicht: dieselben Grenzwerte wie in der App (Bereich „Hinweise“),
// angewandt auf die Werte des Berichtszeitraums
const AUFFAELLIG = "auffaellig", GRENZWERTIG = "grenzwertig";
function personFuerBericht(d) {
  const p = C.personAus(d.gInfo || {}, d.w);
  if (O.geburt) {
    const g = new Date(C.tagMs(O.geburt)), heute = new Date();
    let alter = heute.getFullYear() - g.getFullYear();
    if (heute < new Date(heute.getFullYear(), g.getMonth(), g.getDate())) alter--;
    p.alter = alter;
  }
  return p;
}
function bpEinordnung(x) {
  if (!x) return null;
  if (x.sys >= 135 || x.dia >= 85) return [AUFFAELLIG, "über dem Grenzwert 135/85 mmHg für die Selbstmessung zu Hause (Bluthochdruck)"];
  if (x.sys >= 120 || x.dia >= 80) return [GRENZWERTIG, "über dem Optimalbereich (unter 120/80 mmHg)"];
  return null;
}
// Ärztliche Normen für die Körperwerte (dieselben wie in der App): Körperfett nach Gallagher und Kollegen 2000
// [bis Alter, niedrig unter, erhöht ab, stark erhöht ab], Muskeln an Armen und Beinen nach EWGSOP2 2019 (kg/m²)
const FETT_NORM = { w: [[39, 21, 33, 39], [59, 23, 34, 40], [999, 24, 36, 42]], m: [[39, 8, 20, 25], [59, 11, 22, 28], [999, 13, 25, 30]] };
const ASMI_GRENZE = { w: 5.5, m: 7 };
function fettNorm(p) {
  const t_ = FETT_NORM[p.geschlecht];
  if (!t_ || p.alter == null) return null;
  const [bis, ...grenzen] = t_.find(([b]) => p.alter <= b) || t_[t_.length - 1];
  return { grenzen, gruppe: `${p.geschlecht === "w" ? "Frauen" : "Männer"} ${bis === 39 ? "bis 39 Jahre" : bis === 59 ? "von 40 bis 59 Jahren" : "ab 60 Jahren"}` };
}
const GRUNDLAGEN = "Grundlage: Blutdruck ESH 2023/Deutsche Hochdruckliga; QTc AHA/ACCF/HRS 2009; Pulswellengeschwindigkeit Reference Values for Arterial Stiffness' Collaboration 2010; BMI WHO; Körperfett Gallagher et al. 2000; Muskeln EWGSOP2 2019; Sauerstoffsättigung BTS 2017; Schlafdauer National Sleep Foundation 2015; Bewegung WHO 2020. Viszeralfett, Schlafscore, Stress und HRV-Status sind Einschätzungen von Withings bzw. Garmin ohne ärztliche Norm.";
function fettEinordnung(wert, p) {
  const f = fettNorm(p);
  if (wert == null || !f) return null;
  const [niedrig, hoch, sehr] = f.grenzen;
  const normal = `normal ${zahl(niedrig)}–${zahl(hoch - 0.1, 1)} % für ${f.gruppe}, Gallagher 2000`;
  if (wert >= sehr) return [AUFFAELLIG, `stark erhöht, Bereich der Adipositas (${normal})`];
  if (wert >= hoch) return [GRENZWERTIG, `erhöht (${normal})`];
  if (wert < niedrig) return [GRENZWERTIG, `niedrig (${normal})`];
  return null;
}
function uebersicht(d) {
  ueberschrift("Übersicht", "Die wichtigsten Werte im Berichtszeitraum. Einzelheiten, Verläufe und Methodik folgen auf den nächsten Seiten.");
  const p = personFuerBericht(d);
  const z = [];
  let markiert = 0;
  // zeile(Kennzahl, Wert, Bezug, Einordnung [Stufe, Text] oder null, fett)
  const zeile = (name, wert, bezug, einordnung = null, fett = false) => {
    if (einordnung) markiert++;
    const stufe = einordnung && einordnung[0];
    return [name,
      { content: wert, styles: { fontStyle: fett || stufe === AUFFAELLIG ? "bold" : "normal", textColor: einordnung ? (stufe === AUFFAELLIG ? F.kritisch : F.warnung) : F.tinte } },
      bezug || "",
      einordnung ? { content: `${stufe === AUFFAELLIG ? "Auffällig" : "Grenzwertig"}: ${einordnung[1]}.`, styles: { textColor: stufe === AUFFAELLIG ? F.kritisch : F.warnung } } : ""];
  };
  if (d.bp.length) {
    const g = bpMittel(d.bp), mo = bpMittel(d.bp.filter((m) => C.istMorgens(m.ts))), ab = bpMittel(d.bp.filter((m) => !C.istMorgens(m.ts)));
    const ueber = d.bp.filter((m) => m.sys >= 135 || m.dia >= 85).length;
    const sehrHoch = d.bp.filter((m) => m.sys >= 180 || m.dia >= 110).length;
    const l7 = bpMittel(letzte7Tage(d.bp));
    z.push(gruppe("Blutdruck (Selbstmessung zu Hause)"));
    z.push(zeile("Mittelwert aller Messungen", bpText(g), `${g.n} Messungen an ${g.tage} Tagen; ${g.sys >= 135 || g.dia >= 85 ? "über" : "unter"} dem Grenzwert 135/85 mmHg`, bpEinordnung(g), true));
    if (mo) z.push(zeile("Mittelwert morgens", bpText(mo), `${mo.n} Messungen`, bpEinordnung(mo)));
    if (ab) z.push(zeile("Mittelwert abends", bpText(ab), `${ab.n} Messungen`, bpEinordnung(ab)));
    if (l7 && g.tage > 7) z.push(zeile("Mittelwert der letzten 7 Messtage", bpText(l7), `${l7.n} Messungen`, bpEinordnung(l7)));
    z.push(zeile("Messungen ab 135/85 mmHg", `${zahl((ueber / d.bp.length) * 100)} %`, `${ueber} von ${d.bp.length}`,
      sehrHoch ? [AUFFAELLIG, `${sehrHoch} ${sehrHoch === 1 ? "Messung" : "Messungen"} ab 180/110 mmHg (sehr hoher Einzelwert)`] : null));
    if (g.puls) z.push(zeile("Puls bei der Messung", `${zahl(g.puls)} bpm`, "Mittelwert"));
  }
  const herz = [];
  const rp = werteVon(d.k.ruhepuls), hrv = werteVon(d.k.hrv);
  if (rp.length) {
    const m = mittel(rp);
    const e = m >= 100 ? [AUFFAELLIG, "Ruhepuls über 100 bpm"] : m >= 80 ? [GRENZWERTIG, "über 80 bpm; ein Ruhepuls über 80 bpm geht in großen Studien mit höherem Herz-Kreislauf-Risiko einher"]
      : m < 40 ? [GRENZWERTIG, "unter 40 bpm (bei Ausdauertraining normal)"] : null;
    herz.push(zeile("Ruhepuls (Uhr)", `${zahl(m)} bpm`, `Mittelwert, Spanne ${zahl(Math.min(...rp))}–${zahl(Math.max(...rp))} bpm`, e, true));
  }
  if (hrv.length) {
    const st = C.letzter(d.hrvStatus);
    const code = st ? String(st[1]).toUpperCase().replace(/^HRV_/, "") : "";
    const e = { UNBALANCED: "Garmin-HRV-Status zuletzt „unausgeglichen“ (knapp außerhalb des persönlichen Normalbereichs)",
      LOW: "Garmin-HRV-Status zuletzt „niedrig“ (deutlich unter dem persönlichen Normalbereich)",
      POOR: "Garmin-HRV-Status zuletzt „schlecht“ (unter dem für die Altersgruppe gesunden Wert)" }[code];
    herz.push(zeile("Herzfrequenzvariabilität nachts", `${zahl(mittel(hrv))} ms`, `Mittelwert aus ${hrv.length} Nächten`, e ? [GRENZWERTIG, e] : null));
  }
  const pwv = d.wr(91), ga = d.wr(155).length ? d.wr(155) : d.wr(140);
  if (pwv.length) {
    const v = C.letzter(pwv)[1];
    const grenze = p.alter != null ? C.PWV_GRENZE.find(([bis]) => p.alter <= bis)[1] : null;
    herz.push(zeile("Pulswellengeschwindigkeit", `${zahl(v, 1)} m/s`, `letzte Messung ${msDatum(C.letzter(pwv)[0])}`,
      grenze != null && v > grenze ? [GRENZWERTIG, `über ${zahl(grenze, 1)} m/s, dem Wert, den 90 % der Gleichaltrigen mit normalem Blutdruck erreichen (steifere Gefäße)`] : null));
  }
  if (ga.length) {
    const v = C.letzter(ga)[1];
    herz.push(zeile("Gefäßalter", `${zahl(v)} Jahre`, `letzte Messung ${msDatum(C.letzter(ga)[0])}`,
      p.alter != null && v > p.alter + 3 ? [GRENZWERTIG, `über dem Lebensalter von ${p.alter} Jahren (steifere Gefäße als altersüblich)`] : null));
  }
  if (d.ekg.length) {
    const vhf = d.ekg.filter((e) => C.ekgKlasse(e) === 1).length, unklar = d.ekg.filter((e) => C.ekgKlasse(e) === 2).length;
    const qtc = d.wr(138), qtcLetzt = qtc.length ? C.letzter(qtc) : null, qtcGrenze = p.geschlecht === "m" ? 450 : 460;
    const qtcText = qtcLetzt && qtcLetzt[1] > qtcGrenze ? `; QTc zuletzt ${zahl(qtcLetzt[1])} ms (normal unter ${qtcGrenze} ms)` : "";
    const e = vhf ? [AUFFAELLIG, `${vhf} ${vhf === 1 ? "Aufzeichnung" : "Aufzeichnungen"} mit Hinweis auf Vorhofflimmern (Auswertung des Geräts)${qtcText}`]
      : qtcLetzt && qtcLetzt[1] > 500 ? [AUFFAELLIG, `QTc zuletzt ${zahl(qtcLetzt[1])} ms (über 500 ms)`]
        : unklar ? [GRENZWERTIG, `${unklar} ${unklar === 1 ? "Aufzeichnung" : "Aufzeichnungen"} nicht eindeutig auswertbar${qtcText}`]
          : qtcText ? [GRENZWERTIG, qtcText.slice(2)] : null;
    herz.push(zeile("EKG-Aufzeichnungen", `${d.ekg.length}`, `${vhf + unklar} mit Hinweis oder nicht eindeutig`, e));
  }
  if (herz.length) { z.push(gruppe("Herz und Kreislauf")); z.push(...herz); }
  const koerper = [];
  const gew = d.wr(1);
  if (gew.length) {
    const [a, e] = anfangEnde(gew);
    koerper.push(zeile("Gewicht", `${zahl(e[1], 1)} kg`, gew.length > 1 ? `${pm(e[1] - a[1], 1)} kg seit ${msDatum(a[0])}` : `am ${msDatum(e[0])}`, null, true));
    if (d.groesse) {
      const bmi = rund(e[1] / (d.groesse * d.groesse), 1);
      const eb = bmi >= 30 ? [AUFFAELLIG, `Adipositas Grad ${bmi >= 40 ? "III" : bmi >= 35 ? "II" : "I"} (WHO: ab 30; Normalgewicht 18,5–24,9)`] : bmi >= 25 ? [GRENZWERTIG, "Übergewicht (WHO: 25–29,9; Normalgewicht 18,5–24,9)"]
        : bmi < 18.5 ? [GRENZWERTIG, "Untergewicht (WHO: unter 18,5; Normalgewicht 18,5–24,9)"] : null;
      koerper.push(zeile("Body-Mass-Index", `${zahl(bmi, 1)} kg/m²`, `bei ${zahl(d.groesse * 100)} cm`, eb));
    }
  }
  const fett = d.wr(6), muskel = d.wr(76), visz = d.wr(170);
  if (fett.length) { const [a, e] = anfangEnde(fett); koerper.push(zeile("Körperfettanteil", `${zahl(e[1], 1)} %`, fett.length > 1 ? `${pm(e[1] - a[1], 1)} Prozentpunkte` : "", fettEinordnung(rund(e[1], 1), p))); }
  if (muskel.length) {
    const [a, e] = anfangEnde(muskel);
    koerper.push(zeile("Muskelmasse gesamt", `${zahl(e[1], 1)} kg`, muskel.length > 1 ? `${pm(e[1] - a[1], 1)} kg` : "", null));
  }
  // Muskeln an Armen und Beinen (Body Scan je Körperbereich) – ärztlich nach der Sarkopenie-Leitlinie EWGSOP2
  const glieder = [2, 3, 10, 11].map((pos) => C.letzter(d.wr(175, pos)));
  if (glieder.every(Boolean) && p.geschlecht && p.groesse) {
    const kg = glieder.reduce((s_, x) => s_ + x[1], 0), idx = rund(kg / (p.groesse * p.groesse), 1), grenze = ASMI_GRENZE[p.geschlecht];
    koerper.push(zeile("Muskeln an Armen und Beinen", `${zahl(kg, 1)} kg`, `${zahl(idx, 1)} kg/m² (EWGSOP2: niedrig unter ${zahl(grenze, 1)})`,
      idx < grenze ? [GRENZWERTIG, `niedrig nach der Sarkopenie-Leitlinie EWGSOP2 (unter ${zahl(grenze, 1)} kg/m²); Kraft prüfen`] : null));
  }
  if (visz.length) {
    const v = C.letzter(visz)[1];
    koerper.push(zeile("Viszeralfett", zahl(v, 1), "Index von Withings, keine ärztliche Norm", v > 10 ? [GRENZWERTIG, "laut Withings sehr hoch (bis 5 gut, bis 10 hoch); Bauchumfang messen"]
      : v > 5 ? [GRENZWERTIG, "laut Withings hoch (bis 5 gut, bis 10 hoch); Bauchumfang messen"] : null));
  }
  if (koerper.length) { z.push(gruppe("Körper")); z.push(...koerper); }
  const schlaf = [];
  const sd_ = werteVon(d.k.schlaf_dauer), sc = werteVon(d.k.schlaf_score), sp = werteVon(d.k.schlaf_spo2), at = werteVon(d.k.schlaf_atem);
  if (sd_.length) {
    const m = mittel(sd_);
    const [lo, hi] = p.alter != null && p.alter >= 65 ? [7, 8] : [7, 9];
    const e = m < 6 ? [AUFFAELLIG, `deutlich unter den empfohlenen ${lo}–${hi} Stunden (National Sleep Foundation)`] : m < lo ? [GRENZWERTIG, `unter den empfohlenen ${lo}–${hi} Stunden (National Sleep Foundation)`]
      : m > hi ? [GRENZWERTIG, `über den empfohlenen ${lo}–${hi} Stunden (National Sleep Foundation)`] : null;
    schlaf.push(zeile("Schlafdauer", std(m), `Mittelwert aus ${sd_.length} Nächten`, e, true));
  }
  if (sc.length) {
    const m = mittel(sc);
    schlaf.push(zeile("Schlafscore (Garmin)", zahl(m), "Mittelwert, Skala 0–100",
      m < 60 ? [AUFFAELLIG, "schlechte Schlafqualität (Garmin: unter 60 schlecht, ab 80 gut)"] : m < 80 ? [GRENZWERTIG, "mittlere Schlafqualität (Garmin: ab 80 gut)"] : null));
  }
  if (sp.length) {
    const tief = werteVon(d.spo2Tief), m = rund(mittel(sp));
    schlaf.push(zeile("Sauerstoffsättigung im Schlaf", `${zahl(m)} %`, tief.length ? `Mittelwert; niedrigster Wert ${zahl(Math.min(...tief))} %` : "Mittelwert",
      m < 90 ? [AUFFAELLIG, "unter 90 % (Normalbereich 94–98 % nach BTS; Messung am Handgelenk)"] : m < 94 ? [GRENZWERTIG, "unter dem Normalbereich 94–98 % (BTS; Messung am Handgelenk, eher ungenau)"] : null));
  }
  if (at.length) {
    const m = mittel(at);
    schlaf.push(zeile("Atemfrequenz im Schlaf", `${zahl(m, 1)} /min`, "Mittelwert",
      m > 20 ? [GRENZWERTIG, "über 20 Atemzügen pro Minute (in Ruhe normal 12–20)"] : m < 8 ? [GRENZWERTIG, "unter 8 Atemzügen pro Minute (in Ruhe normal 12–20)"] : null));
  }
  if (schlaf.length) { z.push(gruppe("Schlaf")); z.push(...schlaf); }
  const bew = [];
  const sch = werteVon(d.k.schritte);
  if (sch.length) { const m = mittel(sch); bew.push(zeile("Schritte", zahl(m), "Mittelwert pro Tag", m < 7000 ? [GRENZWERTIG, "unter 7.000 Schritten pro Tag (Lancet Public Health 2025)"] : null, true)); }
  const imWoche = intensitaetProWoche(d);
  if (imWoche.length) { const m = mittel(werteVon(imWoche)); bew.push(zeile("Intensitätsminuten", `${zahl(m)} Min.`, "Mittelwert pro Woche (Empfehlung: 150)", m < 150 ? [GRENZWERTIG, "unter der WHO-Empfehlung von 150 Minuten pro Woche"] : null)); }
  if (d.akt.length) bew.push(zeile("Trainings", `${d.akt.length}`, `zusammen ${zahl(d.akt.reduce((a, x) => a + (x.dauer || 0), 0) / 3600)} Stunden`));
  const vo2 = d.k.vo2lauf.length ? d.k.vo2lauf : d.k.vo2rad;
  if (vo2.length) bew.push(zeile(`VO2max (${d.k.vo2lauf.length ? "Laufen" : "Radfahren"})`, zahl(C.letzter(vo2)[1], 1), "Schätzung der Uhr, ml/kg/min"));
  const st = werteVon(d.k.stress).filter((v) => v >= 0);
  if (st.length) { const m = mittel(st); bew.push(zeile("Stress im Tagesmittel", zahl(m), "Garmin-Skala 0–100", m > 50 ? [GRENZWERTIG, "hohe Stressbelastung (Garmin: über 50)"] : null)); }
  if (bew.length) { z.push(gruppe("Bewegung und Erholung")); z.push(...bew); }
  if (!z.length) { absatz("Für diesen Zeitraum liegen keine Messwerte vor."); return; }
  tabelle(["Kennzahl", "Wert", "Bezug", "Einordnung"], z, { spalten: { 0: { cellWidth: 44 }, 1: { cellWidth: 26 }, 2: { cellWidth: 48 } }, abstand: 2.5 });
  absatz(markiert
    ? `Farbig: Wert außerhalb des Optimal- oder Normalbereichs – „Grenzwertig“ (gelbbraun) knapp außerhalb, „Auffällig“ (rot) deutlich. ${GRUNDLAGEN}`
    : `Alle Werte der Übersicht liegen im Optimal- oder Normalbereich. ${GRUNDLAGEN}`,
  { groesse: 7.8, farbe: F.tinte3, abstand: 4 });
}
function intensitaetProWoche(d) {
  const int = new Map(d.k.im_int);
  const taeglich = d.k.im_mod.map(([t_, v]) => [t_, v + 2 * (int.get(t_) || 0)]);
  // nur vollständige Wochen im Zeitraum
  const wochen = C.nachWochen(taeglich, "summe");
  return wochen.filter(([mo]) => mo >= O.von && C.isoPlus(mo, 6) <= O.bis);
}

// ---------------------------------------------------------------- Blutdruck
async function blutdruck(d) {
  ueberschrift("Blutdruck und Puls", "Selbstmessung zu Hause mit der Withings BPM Vision am Oberarm. Morgens zählt eine Messung zwischen 4 und 14 Uhr, abends jede andere. Alle Werte stehen so in der Tabelle, wie das Gerät sie gemessen hat; es wurde nichts ausgewählt oder bereinigt.");
  const g = bpMittel(d.bp), mo = bpMittel(d.bp.filter((m) => C.istMorgens(m.ts))), ab = bpMittel(d.bp.filter((m) => !C.istMorgens(m.ts))), l7 = bpMittel(letzte7Tage(d.bp));
  const zeile = (name, x) => (x ? [name, zahl(x.sys), zahl(x.dia), x.puls ? zahl(x.puls) : "–", `${x.n}`, `${x.tage}`] : null);
  tabelle(["Mittelwerte", "Systolisch", "Diastolisch", "Puls", "Messungen", "Messtage"],
    [zeile("Alle Messungen", g), zeile("Morgens", mo), zeile("Abends", ab), g.tage > 7 ? zeile("Letzte 7 Messtage", l7) : null].filter(Boolean),
    { spalten: { 1: rechts, 2: rechts, 3: rechts, 4: rechts, 5: rechts }, abstand: 3 });
  absatz("Blutdruck in mmHg, Puls in Schlägen pro Minute.", { groesse: 7.8, farbe: F.tinte3, abstand: 3 });
  const hoechst = d.bp.reduce((a, m) => (m.sys > a.sys ? m : a), d.bp[0]);
  const tiefst = d.bp.reduce((a, m) => (m.sys < a.sys ? m : a), d.bp[0]);
  const ueber = d.bp.filter((m) => m.sys >= 135 || m.dia >= 85).length;
  const sdS = sd(d.bp.map((m) => m.sys)), sdD = sd(d.bp.map((m) => m.dia));
  tabelle(null, [
    ["Höchster systolischer Wert", `${hoechst.sys}/${hoechst.dia} mmHg`, `${DF.tag.format(new Date(hoechst.ts))}, ${uhr(hoechst.ts)} Uhr`],
    ["Niedrigster systolischer Wert", `${tiefst.sys}/${tiefst.dia} mmHg`, `${DF.tag.format(new Date(tiefst.ts))}, ${uhr(tiefst.ts)} Uhr`],
    sdS != null ? ["Standardabweichung", `${zahl(sdS, 1)} / ${zahl(sdD, 1)} mmHg`, "systolisch / diastolisch"] : null,
    ["Messungen ab 135/85 mmHg", `${ueber} von ${d.bp.length}`, `${zahl((ueber / d.bp.length) * 100)} %`],
  ].filter(Boolean), { spalten: { 0: { cellWidth: 62 }, 1: { cellWidth: 38 } } });
  // Verlauf
  const tage = (C.tagMs(O.bis) - C.tagMs(O.von)) / 86400000;
  const einzeln = tage <= 92;
  const sys = einzeln ? d.bp.map((m) => [m.ts, m.sys]) : C.tagesMittel(d.bp.map((m) => [m.ts, m.sys]));
  const dia = einzeln ? d.bp.map((m) => [m.ts, m.dia]) : C.tagesMittel(d.bp.map((m) => [m.ts, m.dia]));
  const ys = d.bp.flatMap((m) => [m.sys, m.dia]);
  zwischen(einzeln ? "Verlauf aller Messungen" : "Verlauf, Tagesmittel", 66);
  bild(await diagramm({ hoehe: 62, serien: [
    { name: "Systolisch", daten: sys, farbe: BP_FARBEN.sys, endWert: true },
    { name: "Diastolisch", daten: dia, farbe: BP_FARBEN.dia, endWert: true }],
  opt: { yMin: Math.floor(Math.min(60, ...ys.map((v) => v - 6)) / 20) * 20, yMax: Math.ceil(Math.max(150, ...ys.map((v) => v + 6)) / 20) * 20, yIntervall: 20,
    referenzen: [{ wert: 135, text: "135" }, { wert: 85, text: "85" }] } }));
  absatz("Gestrichelt: 135/85 mmHg, der Grenzwert für den Mittelwert der Selbstmessung zu Hause (Europäische Hochdruckgesellschaft).", { groesse: 7.8, farbe: F.tinte3, abstand: 4 });
  // Wochenmittel
  const wochen = new Map();
  for (const m of d.bp) {
    const mo_ = C.montagIso(C.isoAusMs(m.ts));
    if (!wochen.has(mo_)) wochen.set(mo_, []);
    wochen.get(mo_).push(m);
  }
  zwischen("Wochenmittel", 30);
  tabelle(["Woche", "Zeitraum", "Morgens", "Abends", "Puls", "Messungen"], [...wochen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([mo_, l]) => {
    const [j, kw] = C.isoWoche(C.tagMs(mo_));
    const m1 = bpMittel(l.filter((m) => C.istMorgens(m.ts))), a1 = bpMittel(l.filter((m) => !C.istMorgens(m.ts))), g1 = bpMittel(l);
    return [`KW ${kw}/${String(j).slice(2)}`, `${DF.tagKurz.format(new Date(C.tagMs(mo_)))}–${DF.tagKurz.format(new Date(C.tagMs(C.isoPlus(mo_, 6))))}`,
      m1 ? `${zahl(m1.sys)}/${zahl(m1.dia)}` : "–", a1 ? `${zahl(a1.sys)}/${zahl(a1.dia)}` : "–", g1.puls ? zahl(g1.puls) : "–", `${l.length}`];
  }), { spalten: { 2: rechts, 3: rechts, 4: rechts, 5: rechts } });
  if (O.abschnitte.protokoll) absatz("Alle Einzelmessungen stehen im Anhang „Blutdruck-Messprotokoll“.", { groesse: 8.4, farbe: F.tinte3 });
}

// ---------------------------------------------------------------- EKG
function nahe(d, typ, ts) { const r = C.wReihe(d.w, typ).find((x) => Math.abs(x[0] - ts * 1000) < 15 * 60000); return r ? r[1] : null; }
function ekgListe(d) {
  platz(30 + 8 + Math.min(d.ekg.length, 6) * 7.5 + 12); // Überschrift nicht allein am Seitenende
  ueberschrift("EKG", "Einkanal-EKG-Aufzeichnungen der Geräte mit deren automatischer Auswertung. Die Auswertung stammt vom Gerät und ist kein ärztlicher Befund.");
  tabelle(["Datum", "Uhrzeit", "Auswertung des Geräts", "Herzfrequenz", "Intervalle", "Quelle"], d.ekg.map((e) => {
    const iv = [[135, "QRS"], [136, "PR"], [137, "QT"], [138, "QTc"]].map(([typ, n]) => { const v = nahe(d, typ, e.ts); return v != null ? `${n} ${zahl(v)} ms` : null; }).filter(Boolean).join(", ");
    const stil = auffaellig(e) ? { fontStyle: "bold", textColor: F.kritisch } : {};
    return [msDatum(e.ts * 1000), uhr(e.ts * 1000), { content: afibText(e), styles: stil }, e.hf ? `${zahl(e.hf)} bpm` : "–", iv || "–", e.q === "g" ? "Garmin" : "Withings"];
  }), { spalten: { 0: { cellWidth: 21 }, 1: { cellWidth: 14 }, 2: { cellWidth: 48 }, 3: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 17 } }, schriftgroesse: 8.2, abstand: 3 });
  // Zusammenfassung für die Praxis: Vorhofflimmern oder unklare Aufzeichnungen?
  const n = (x, eins, viele) => `${x} ${x === 1 ? eins : viele}`;
  const vhf = d.ekg.filter((e) => C.ekgKlasse(e) === 1).length, unklar = d.ekg.filter((e) => C.ekgKlasse(e) === 2).length;
  const satz = vhf
    ? `In ${n(vhf, "Aufzeichnung", "Aufzeichnungen")} meldet das Gerät einen Hinweis auf Vorhofflimmern.${unklar ? ` ${n(unklar, "weitere ist", "weitere sind")} nicht eindeutig auswertbar.` : ""}`
    : unklar
      ? `Kein Hinweis auf Vorhofflimmern; ${n(unklar, "Aufzeichnung ist", "Aufzeichnungen sind")} jedoch nicht eindeutig auswertbar.`
      : `In ${d.ekg.length === 1 ? "dieser Aufzeichnung" : d.ekg.length === 2 ? "beiden Aufzeichnungen" : `allen ${d.ekg.length} Aufzeichnungen`} erkannte das Gerät kein Vorhofflimmern.`;
  absatz(satz, { groesse: 9.2, fett: true, farbe: vhf || unklar ? F.kritisch : F.tinte, abstand: 2 });
  if (O.abschnitte.ekgKurven && d.ekg.some((e) => e.kurve)) absatz("Die Kurven stehen im Anhang „EKG-Kurven“ (25 mm/s, 10 mm/mV).", { groesse: 8.4, farbe: F.tinte3 });
  y += 2;
}

// ---------------------------------------------------------------- Herz und Kreislauf
async function herzKreislauf(d) {
  ueberschrift("Herz und Kreislauf", "Ruhepuls und Herzfrequenzvariabilität misst die Garmin-Uhr optisch am Handgelenk (Tageswerte laut Garmin, HRV als Mittelwert jeder Nacht). Pulswellengeschwindigkeit und Gefäßalter misst die Withings Body Scan beim Wiegen.");
  const zeilen = [];
  const stat = (name, r, einheit, st = 0) => { const v = werteVon(r); if (v.length) zeilen.push([name, `${zahl(mittel(v), st)} ${einheit}`, `${zahl(Math.min(...v), st)}–${zahl(Math.max(...v), st)} ${einheit}`, `${v.length}`]); };
  stat("Ruhepuls", d.k.ruhepuls, "bpm");
  stat("HRV nachts", d.k.hrv, "ms");
  if (zeilen.length) tabelle(["Kennzahl", "Mittelwert", "Spanne", "Tage"], zeilen, { spalten: { 1: rechts, 2: rechts, 3: rechts }, abstand: 3 });
  const unten = C.letzter(d.k.hrv_unten), oben = C.letzter(d.k.hrv_oben), status = C.letzter(d.hrvStatus);
  if (unten && oben) absatz(`Persönlicher HRV-Normalbereich laut Garmin zuletzt ${zahl(unten[1])}–${zahl(oben[1])} ms${status ? `, Status „${C.textDeutsch(status[1])}“` : ""}.`, { groesse: 8.6 });
  const halb = (BREITE - 6) / 2;
  const bilder = [];
  if (d.k.ruhepuls.length) bilder.push(["Ruhepuls (bpm)", await diagramm({ breite: halb, hoehe: 48, serien: [{ name: "Ruhepuls", daten: d.k.ruhepuls, farbe: P.serie[0], endWert: true }], opt: { rechts: 26 } })]);
  if (d.k.hrv.length) {
    const u = new Map(d.k.hrv_unten), o = new Map(d.k.hrv_oben);
    const band = d.k.hrv.map((p) => p[0]).filter((t_) => u.has(t_) && o.has(t_));
    bilder.push(["HRV nachts (ms), Fläche: Normalbereich", await diagramm({ breite: halb, hoehe: 48, serien: [
      { name: "unten", daten: band.map((t_) => [t_, u.get(t_)]), farbe: P.serie[0], unsichtbar: true, stapel: "band" },
      { name: "Normalbereich", daten: band.map((t_) => [t_, o.get(t_) - u.get(t_)]), farbe: P.serie[0], unsichtbar: true, stapel: "band", flaeche: true, ohneLegende: true },
      { name: "HRV", daten: d.k.hrv, farbe: P.serie[0], endWert: true, z: 3 }], opt: { rechts: 26 } })]);
  }
  if (bilder.length === 2) {
    platz(bilder[0][1].hoehe + 10);
    bildTitel(bilder[0][0]); bildTitel(bilder[1][0], RAND.l + halb + 6);
    y += 5.5;
    bilderNebeneinander(bilder[0][1], bilder[1][1]);
  } else if (bilder.length === 1) { platz(bilder[0][1].hoehe + 10); bildTitel(bilder[0][0]); y += 5.5; bild(bilder[0][1]); }
  y += 3;
  const gef = [[91, "Pulswellengeschwindigkeit", "m/s", 1], [155, "Gefäßalter", "Jahre", 0], [140, "Gefäßalter", "Jahre", 0]].filter(([typ]) => d.wr(typ).length);
  if (gef.length) {
    zwischen("Gefäße (Withings Body Scan)", 24);
    const gesehen = new Set();
    tabelle(["Kennzahl", "Erste Messung", "Letzte Messung", "Messungen"], gef.filter(([, n]) => (gesehen.has(n) ? false : gesehen.add(n))).map(([typ, n, e, st]) => {
      const r = d.wr(typ); const [a, z] = anfangEnde(r);
      return [n, `${zahl(a[1], st)} ${e} (${msDatum(a[0])})`, `${zahl(z[1], st)} ${e} (${msDatum(z[0])})`, `${r.length}`];
    }), { spalten: { 3: rechts } });
  }
}

// ---------------------------------------------------------------- Körper
async function koerper(d) {
  ueberschrift("Körperzusammensetzung", "Gemessen mit der Withings Body Scan (bioelektrische Impedanz über Füße und Griff). Werte am Anfang und am Ende des Zeitraums; Verläufe als Tageswerte.");
  const halb = (BREITE - 6) / 2;
  const gew = C.wTaeglich(d.wr(1)), fett = C.wTaeglich(d.wr(6));
  if (gew.length || fett.length) {
    const a = gew.length ? await diagramm({ breite: fett.length ? halb : BREITE, hoehe: 48, serien: [{ name: "Gewicht", daten: gew, farbe: P.serie[0], endWert: true, stellen: 1 }], opt: { rechts: 30 } }) : null;
    const b = fett.length ? await diagramm({ breite: gew.length ? halb : BREITE, hoehe: 48, serien: [{ name: "Körperfettanteil", daten: fett, farbe: P.serie[1], endWert: true, stellen: 1 }], opt: { rechts: 30 } }) : null;
    platz(58);
    if (a) bildTitel("Gewicht (kg)");
    if (b) bildTitel("Körperfettanteil (%)", a ? RAND.l + halb + 6 : RAND.l);
    y += 5.5;
    if (a && b) bilderNebeneinander(a, b); else bild(a || b);
    y += 3;
  }
  const typen = [[1, "Gewicht", "kg", 1], [6, "Körperfettanteil", "%", 1], [8, "Fettmasse", "kg", 1], [5, "Fettfreie Masse", "kg", 1], [76, "Muskelmasse", "kg", 1],
    [88, "Knochenmasse", "kg", 2], [77, "Körperwasser", "kg", 1], [168, "Extrazelluläres Wasser", "kg", 1], [169, "Intrazelluläres Wasser", "kg", 1],
    [170, "Viszeralfett (Index)", "", 1], [226, "Grundumsatz", "kcal", 0], [227, "Stoffwechselalter", "Jahre", 0]];
  const zeilen = [];
  for (const [typ, name, e, st] of typen) {
    const r = d.wr(typ);
    if (!r.length) continue;
    const [a, z] = anfangEnde(r);
    const einheit = e ? ` ${e}` : "";
    const diff = z[1] - a[1];
    const diffEinheit = e === "%" ? " Punkte" : e === "Jahre" && Math.abs(Math.round(diff)) === 1 ? " Jahr" : einheit;
    zeilen.push([name, `${zahl(a[1], st)}${einheit}`, `${zahl(z[1], st)}${einheit}`, r.length > 1 ? `${pm(diff, st)}${diffEinheit}` : "–"]);
    if (typ === 1 && d.groesse) zeilen.push(["Body-Mass-Index", `${zahl(a[1] / d.groesse ** 2, 1)} kg/m²`, `${zahl(z[1] / d.groesse ** 2, 1)} kg/m²`, r.length > 1 ? pm((z[1] - a[1]) / d.groesse ** 2, 1) : "–"]);
  }
  if (zeilen.length) {
    const g1 = d.wr(1);
    tabelle(["Kennzahl", g1.length ? `Anfang (${msDatum(g1[0][0])})` : "Anfang", g1.length ? `Ende (${msDatum(C.letzter(g1)[0])})` : "Ende", "Veränderung"], zeilen,
      { spalten: { 1: rechts, 2: rechts, 3: rechts } });
  }
  // Körperregionen
  const reg = [[12, "Rumpf"], [3, "Arm links"], [2, "Arm rechts"], [10, "Bein links"], [11, "Bein rechts"]];
  const letzte = C.letzter(d.wr(175, 12)) || C.letzter(d.wr(174, 12));
  if (letzte) {
    const g = C.wGruppe(d.w, letzte[2]);
    const v = (typ, pos) => (Number.isFinite(g[`${typ}.${pos}`]) ? g[`${typ}.${pos}`] : null);
    zwischen(`Körperregionen (Messung vom ${msDatum(letzte[0])})`, 30);
    tabelle(["Bereich", "Muskelmasse", "Fettmasse", "Fettfreie Masse", "Fettanteil"], reg.map(([pos, name]) => {
      const f = v(174, pos), ffm = v(173, pos);
      return [name, v(175, pos) != null ? `${zahl(v(175, pos), 2)} kg` : "–", f != null ? `${zahl(f, 2)} kg` : "–", ffm != null ? `${zahl(ffm, 2)} kg` : "–", f != null && ffm != null ? `${zahl((f / (f + ffm)) * 100)} %` : "–"];
    }), { spalten: { 1: rechts, 2: rechts, 3: rechts, 4: rechts }, abstand: 3 });
    const seite = (typ, l, r) => (v(typ, l) != null && v(typ, r) != null ? pm(((v(typ, l) - v(typ, r)) / ((v(typ, l) + v(typ, r)) / 2)) * 100, 1) : null);
    const arme = seite(175, 3, 2), beine = seite(175, 10, 11);
    if (arme || beine) absatz(`Seitenvergleich der Muskelmasse (links gegenüber rechts): Arme ${arme ?? "–"} %, Beine ${beine ?? "–"} %.`, { groesse: 8.6 });
  }
  // Nervengesundheit
  const nerven = [[167, "Nervengesundheit Füße (Score)"], [158, "Nervengesundheit linker Fuß"], [159, "Nervengesundheit rechter Fuß"], [196, "Elektrodermale Aktivität Füße"]].filter(([typ]) => d.wr(typ).length);
  if (nerven.length) {
    zwischen("Nervengesundheit (elektrochemische Hautleitfähigkeit der Füße)", 24);
    tabelle(["Kennzahl", "Mittelwert", "Letzte Messung", "Messungen"], nerven.map(([typ, n]) => {
      const r = d.wr(typ); const l = C.letzter(r);
      return [n, zahl(mittel(werteVon(r))), `${zahl(l[1])} (${msDatum(l[0])})`, `${r.length}`];
    }), { spalten: { 1: rechts, 2: rechts, 3: rechts } });
  }
}

// ---------------------------------------------------------------- Schlaf
async function schlaf(d) {
  ueberschrift("Schlaf und Atmung", "Schlafdauer und Schlafphasen schätzt die Garmin-Uhr aus Bewegung und Puls; Sauerstoffsättigung (SpO2) und Atemfrequenz misst sie optisch am Handgelenk. Das ist keine Polysomnografie.");
  const m = (r) => mittel(werteVon(r));
  const zeilen = [];
  if (d.k.schlaf_dauer.length) zeilen.push(["Schlafdauer", std(m(d.k.schlaf_dauer)), `${std(Math.min(...werteVon(d.k.schlaf_dauer)))} bis ${std(Math.max(...werteVon(d.k.schlaf_dauer)))}`]);
  for (const [id, n] of [["schlaf_tief", "Tiefschlaf"], ["schlaf_leicht", "Leichtschlaf"], ["schlaf_rem", "REM-Schlaf"], ["schlaf_wach", "Wach im Bett"]]) if (d.k[id].length) zeilen.push([n, std(m(d.k[id])), ""]);
  if (d.k.schlaf_score.length) zeilen.push(["Schlafscore (Garmin, 0–100)", zahl(m(d.k.schlaf_score)), `${zahl(Math.min(...werteVon(d.k.schlaf_score)))}–${zahl(Math.max(...werteVon(d.k.schlaf_score)))}`]);
  if (d.k.schlaf_spo2.length) zeilen.push(["SpO2 im Schlaf", `${zahl(m(d.k.schlaf_spo2))} %`, d.spo2Tief.length ? `niedrigster Wert ${zahl(Math.min(...werteVon(d.spo2Tief)))} %` : ""]);
  if (d.k.schlaf_atem.length) zeilen.push(["Atemfrequenz im Schlaf", `${zahl(m(d.k.schlaf_atem), 1)} /min`, `${zahl(Math.min(...werteVon(d.k.schlaf_atem)), 1)}–${zahl(Math.max(...werteVon(d.k.schlaf_atem)), 1)} /min`]);
  if (d.k.atem_wach.length) zeilen.push(["Atemfrequenz wach", `${zahl(m(d.k.atem_wach), 1)} /min`, ""]);
  if (zeilen.length) tabelle([`Mittelwerte (${d.k.schlaf_dauer.length} Nächte)`, "Wert", "Spanne"], zeilen, { spalten: { 1: rechts, 2: rechts } });
  if (d.k.schlaf_tief.length) {
    zwischen("Schlafphasen pro Nacht (Stunden)", 60);
    const reihen = [["schlaf_tief", "Tief"], ["schlaf_leicht", "Leicht"], ["schlaf_rem", "REM"], ["schlaf_wach", "Wach"]];
    bild(await diagramm({ hoehe: 56, serien: reihen.map(([id, n], i) => ({ name: n, daten: d.k[id], farbe: P.phasen[i], art: "balken", stapel: "phasen" })), opt: { nullBasis: true, rechts: 10, yFormat: (v) => `${zahl(v)} h` } }));
  } else if (d.k.schlaf_dauer.length) {
    zwischen("Schlafdauer pro Nacht (Stunden)", 56);
    bild(await diagramm({ hoehe: 52, serien: [{ name: "Schlafdauer", daten: d.k.schlaf_dauer, farbe: P.serie[0], endWert: true, stellen: 1 }] }));
  }
  if (d.k.schlaf_spo2.length > 2) {
    zwischen("Sauerstoffsättigung im Schlaf (%)", 48);
    bild(await diagramm({ hoehe: 44, serien: [{ name: "SpO2 im Mittel", daten: d.k.schlaf_spo2, farbe: P.serie[0], endWert: true },
      d.spo2Tief.length ? { name: "Niedrigster Wert des Tages", daten: d.spo2Tief, farbe: P.serie[1], endWert: true } : null].filter(Boolean) }));
  }
}

// ---------------------------------------------------------------- Aktivität
async function aktivitaet(d) {
  ueberschrift("Aktivität und Training", "Schritte, Etagen, Intensitätsminuten und Trainings zeichnet die Garmin-Uhr auf. Minuten mit hoher Intensität zählen doppelt, wie bei Garmin und in der Empfehlung der WHO (mindestens 150 Minuten pro Woche).");
  const m = (r) => mittel(werteVon(r));
  const zeilen = [];
  const sch = werteVon(d.k.schritte);
  if (sch.length) {
    const ziel = C.letzter(d.k.schrittziel)?.[1];
    zeilen.push(["Schritte pro Tag", zahl(mittel(sch)), ziel ? `Ziel ${zahl(ziel)} an ${sch.filter((v) => v >= ziel).length} von ${sch.length} Tagen erreicht` : `${sch.length} Tage`]);
  }
  const iw = intensitaetProWoche(d);
  if (iw.length) zeilen.push(["Intensitätsminuten pro Woche", `${zahl(mittel(werteVon(iw)))} Min.`, `${iw.filter((p) => p[1] >= 150).length} von ${iw.length} vollen Wochen mit mindestens 150 Minuten`]);
  if (d.k.etagen.length) zeilen.push(["Etagen pro Tag", zahl(m(d.k.etagen)), ""]);
  if (d.k.aktivkcal.length) zeilen.push(["Aktivkalorien pro Tag", `${zahl(m(d.k.aktivkcal))} kcal`, ""]);
  for (const [id, n] of [["vo2lauf", "VO2max Laufen"], ["vo2rad", "VO2max Radfahren"]]) {
    const r = d.k[id]; if (!r.length) continue; const [a, z] = anfangEnde(r);
    zeilen.push([n, zahl(z[1], 1), r.length > 1 ? `${pm(z[1] - a[1], 1)} im Zeitraum (ml/kg/min)` : "ml/kg/min"]);
  }
  if (d.k.fitnessalter.length) zeilen.push(["Fitnessalter (Garmin)", `${zahl(C.letzter(d.k.fitnessalter)[1], 1)} Jahre`, ""]);
  if (zeilen.length) tabelle(["Kennzahl", "Mittelwert", "Bezug"], zeilen, { spalten: { 0: { cellWidth: 56 }, 1: { cellWidth: 30, halign: "right" } } });
  const halb = (BREITE - 6) / 2;
  const tage = (C.tagMs(O.bis) - C.tagMs(O.von)) / 86400000;
  const a = d.k.schritte.length ? await diagramm({ breite: halb, hoehe: 46, serien: [{ name: "Schritte", daten: tage > 92 ? C.nachWochen(d.k.schritte) : d.k.schritte, farbe: P.serie[0], art: "balken" }],
    opt: { nullBasis: true, rechts: 8, yFormat: (v) => (v >= 1000 ? `${zahl(v / 1000)}k` : zahl(v)) } }) : null;
  const b = iw.length ? await diagramm({ breite: halb, hoehe: 46, serien: [{ name: "Minuten", daten: iw, farbe: P.serie[0], art: "balken" }], opt: { nullBasis: true, rechts: 8, referenzen: [{ wert: 150, text: "" }] } }) : null;
  if (a || b) {
    platz(56);
    if (a) bildTitel(tage > 92 ? "Schritte pro Tag, Wochenmittel" : "Schritte pro Tag");
    if (b) bildTitel("Intensitätsminuten pro Woche (Linie: 150)", a ? RAND.l + halb + 6 : RAND.l);
    y += 5.5;
    if (a && b) bilderNebeneinander(a, b); else bild(a || b);
    y += 3;
  }
  if (d.akt.length) {
    const nachArt = new Map();
    for (const x of d.akt) {
      const n = C.sportName(x.typ);
      if (!nachArt.has(n)) nachArt.set(n, []);
      nachArt.get(n).push(x);
    }
    zwischen(`Trainings nach Sportart (${d.akt.length} Aktivitäten)`, 26);
    tabelle(["Sportart", "Anzahl", "Dauer gesamt", "Strecke", "Puls im Mittel", "Höchster Puls"], [...nachArt.entries()].sort((p, q) => q[1].length - p[1].length).map(([n, l]) => {
      const km = l.reduce((s, x) => s + (x.distanz || 0), 0) / 1000;
      const hf = mittel(l.map((x) => x.hf).filter(Number.isFinite));
      const hfMax = Math.max(...l.map((x) => x.hf_max).filter(Number.isFinite));
      return [n, `${l.length}`, `${zahl(l.reduce((s, x) => s + (x.dauer || 0), 0) / 3600, 1)} Std.`, km > 0.05 ? `${zahl(km, km >= 100 ? 0 : 1)} km` : "–", hf ? `${zahl(hf)} bpm` : "–", Number.isFinite(hfMax) ? `${zahl(hfMax)} bpm` : "–"];
    }), { spalten: { 1: rechts, 2: rechts, 3: rechts, 4: rechts, 5: rechts } });
    if (O.abschnitte.aktivitaetenliste) absatz("Alle Aktivitäten einzeln stehen im Anhang „Aktivitäten“.", { groesse: 8.4, farbe: F.tinte3 });
  }
}

// ---------------------------------------------------------------- Erholung
async function erholung(d) {
  ueberschrift("Stress und Erholung", "Stress schätzt die Garmin-Uhr aus der Herzfrequenzvariabilität (Skala 0–100, unter 26 gilt als ruhig). Die Body Battery (0–100) beschreibt Garmins Schätzung der Energiereserve.");
  const m = (r) => mittel(werteVon(r));
  const zeilen = [];
  if (d.k.stress.length) zeilen.push(["Stress im Tagesmittel", zahl(m(d.k.stress)), `${zahl(Math.min(...werteVon(d.k.stress)))}–${zahl(Math.max(...werteVon(d.k.stress)))}`]);
  if (d.k.bb_hoch.length) zeilen.push(["Body Battery, Höchstwert des Tages", zahl(m(d.k.bb_hoch)), "Mittelwert"]);
  if (d.k.bb_tief.length) zeilen.push(["Body Battery, Tiefstwert des Tages", zahl(m(d.k.bb_tief)), "Mittelwert"]);
  if (zeilen.length) tabelle(["Kennzahl", "Wert", "Spanne / Bezug"], zeilen, { spalten: { 1: rechts, 2: rechts } });
  if (d.k.stress.length > 2) {
    zwischen("Stress im Tagesmittel", 44);
    bild(await diagramm({ hoehe: 40, serien: [{ name: "Stress", daten: d.k.stress, farbe: P.serie[0], endWert: true }], opt: { yMin: 0 } }));
  }
}

// ---------------------------------------------------------------- Hinweise
function hinweise(d) {
  ueberschrift("Hinweise zu den Daten");
  const punkte = [
    `Messgeräte: ${d.geraete.length ? d.geraete.join(", ") : "Withings und Garmin"}. Alle Werte hat die Person selbst gemessen; die Geräte sind Verbrauchergeräte, teils mit Medizinprodukt-Zulassung für einzelne Funktionen.`,
    "Die Daten stammen aus den Schnittstellen von Withings und Garmin Connect und werden ohne Veränderung übernommen. Tageswerte von Garmin sind die Tageszusammenfassungen der Uhr.",
    "Blutdruck: Morgens = Messung zwischen 4 und 14 Uhr, abends = übrige Uhrzeiten. Der Grenzwert 135/85 mmHg gilt für den Mittelwert der Selbstmessung zu Hause.",
    "Leere Tage bedeuten, dass an diesem Tag nicht gemessen wurde oder die Uhr nicht getragen wurde.",
    "Dieser Bericht ersetzt keine ärztliche Untersuchung und enthält keine Diagnose.",
  ];
  for (const p of punkte) {
    platz(6);
    schrift(8.8, false, F.tinte2);
    doc.text("•", RAND.l + 0.5, y + 8.8 * 0.3528 * 0.82);
    absatz(p, { groesse: 8.8, x: RAND.l + 4.5, breite: BREITE - 4.5 });
  }
}

// ---------------------------------------------------------------- Anhänge
function protokoll(d) {
  neueSeite();
  ueberschrift("Anhang: Blutdruck-Messprotokoll", "Alle Messungen im Zeitraum, je Tag. Werte in mmHg, P = Puls in Schlägen pro Minute. Mit * markiert: ab 135/85 mmHg.");
  const tage = new Map();
  for (const m of d.bp) { const k = C.isoAusMs(m.ts); if (!tage.has(k)) tage.set(k, []); tage.get(k).push(m); }
  const zelle = (l) => l.map((m) => `${uhr(m.ts)}   ${m.sys}/${m.dia}${m.puls ? `   P ${m.puls}` : ""}${m.sys >= 135 || m.dia >= 85 ? " *" : ""}`).join("\n") || "–";
  tabelle(["Datum", "Morgens", "Abends"], [...tage.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, l]) => [
    DF.tag.format(new Date(C.tagMs(k))), zelle(l.filter((m) => C.istMorgens(m.ts))), zelle(l.filter((m) => !C.istMorgens(m.ts)))]),
  { spalten: { 0: { cellWidth: 36 } }, schriftgroesse: 8.4,
    zelle: (z) => { if (z.section === "body" && z.column.index > 0 && String(z.cell.raw).includes("*")) z.cell.styles.fontStyle = "bold"; } });
}
function aktivitaetenListe(d) {
  neueSeite();
  ueberschrift("Anhang: Aktivitäten", `Alle ${d.akt.length} Aktivitäten im Zeitraum.`);
  tabelle(["Datum", "Sportart", "Dauer", "Strecke", "Puls im Mittel", "Höchster Puls"], d.akt.map((x) => [
    `${DF.tag.format(new Date(C.tagMs(String(x.start).slice(0, 10))))} ${String(x.start).slice(11, 16)}`, x.name || C.sportName(x.typ),
    C.dauer(x.dauer || 0, false), x.distanz ? `${zahl(x.distanz / 1000, 1)} km` : "–", x.hf ? `${zahl(x.hf)}` : "–", x.hf_max ? `${zahl(x.hf_max)}` : "–"]),
  { spalten: { 2: rechts, 3: rechts, 4: rechts, 5: rechts }, schriftgroesse: 8.2 });
}
async function ekgKurven(d) {
  const mitKurve = d.ekg.filter((e) => e.kurve);
  // auffällige zuerst, dann die neuesten; höchstens 12
  const auswahl = [...mitKurve.filter(auffaellig), ...mitKurve.filter((e) => !auffaellig(e)).reverse()].slice(0, 12);
  for (const e of auswahl) {
    let k;
    try { k = await C.Daten.datei(`d/ekg/${e.q}-${e.id}.enc`); } catch { k = null; }
    if (!k || !k.signal || !k.signal.length) continue;
    neueSeite(true);
    ekgSeite(e, k, d);
  }
}
function ekgSeite(e, k, d) {
  const bw = doc.internal.pageSize.getWidth(), bh = doc.internal.pageSize.getHeight();
  const x0 = 14, breite = bw - 28;
  y = RAND.o - 6;
  schrift(14, true);
  doc.text(t(`EKG vom ${DF.lang.format(new Date(e.ts * 1000))}, ${uhr(e.ts * 1000)} Uhr`), x0, y + 5);
  y += 10;
  const iv = [[135, "QRS"], [136, "PR"], [137, "QT"], [138, "QTc"]].map(([typ, n]) => { const v = nahe(d, typ, e.ts); return v != null ? `${n} ${zahl(v)} ms` : null; }).filter(Boolean);
  schrift(9.4, false, F.tinte2);
  doc.text(t([`Auswertung des Geräts: ${afibText(e)}`, e.hf ? `Herzfrequenz ${zahl(e.hf)} bpm` : null, iv.length ? iv.join(", ") : null, e.q === "g" ? "Garmin" : "Withings"].filter(Boolean).join("   |   ")), x0, y + 3);
  y += 8;
  // Papier: 25 mm/s, 10 mm/mV, 10 s je Zeile
  const freq = k.freq || 300;
  const signal = k.signal;
  const probe = signal.slice(0, Math.min(signal.length, freq * 5)).map((v) => Math.abs(v)).sort((a, b) => a - b);
  const faktor = probe[Math.floor(probe.length * 0.98)] < 20 ? 1000 : 1; // Millivolt statt Mikrovolt?
  const sek = 10, rand = 10, zeileMm = 30;
  const proZeile = Math.round(sek * freq);
  const zeilen = Math.min(Math.ceil(signal.length / proZeile), Math.floor((bh - y - RAND.u - 10) / zeileMm));
  const papierB = Math.min(breite, rand + sek * 25), papierH = zeilen * zeileMm;
  const px = x0, py = y;
  doc.setLineWidth(0.08); doc.setDrawColor(...F.roseZart);
  for (let mm = 0; mm <= papierB + 0.01; mm += 1) if (mm % 5) doc.line(px + mm, py, px + mm, py + papierH);
  for (let mm = 0; mm <= papierH + 0.01; mm += 1) if (mm % 5) doc.line(px, py + mm, px + papierB, py + mm);
  doc.setLineWidth(0.18); doc.setDrawColor(...F.roseMittel);
  for (let mm = 0; mm <= papierB + 0.01; mm += 5) doc.line(px + mm, py, px + mm, py + papierH);
  for (let mm = 0; mm <= papierH + 0.01; mm += 5) doc.line(px, py + mm, px + papierB, py + mm);
  doc.setDrawColor(...F.tinte); doc.setLineJoin("round");
  for (let z = 0; z < zeilen; z++) {
    const teil = signal.slice(z * proZeile, (z + 1) * proZeile);
    if (!teil.length) break;
    const sortiert = [...teil].sort((a, b) => a - b);
    const mitte = sortiert[Math.floor(sortiert.length / 2)] || 0;
    const y0 = py + z * zeileMm + zeileMm * 0.58;
    const yv = (v) => Math.max(py + z * zeileMm + 0.5, Math.min(py + (z + 1) * zeileMm - 0.5, y0 - ((v - mitte) * faktor / 1000) * 10));
    // Eichzacke 1 mV, 0,2 s
    doc.setLineWidth(0.3);
    doc.lines([[1, 0], [0, -10], [5, 0], [0, 10], [1, 0]], px + 1.5, y0, [1, 1], "S", false);
    doc.setLineWidth(0.26);
    const pfad = [];
    let lx = px + rand, ly = yv(teil[0]);
    const start = [lx, ly];
    for (let i = 1; i < teil.length; i++) {
      const nx = px + rand + (i / freq) * 25, ny = yv(teil[i]);
      pfad.push([nx - lx, ny - ly]);
      lx = nx; ly = ny;
    }
    doc.lines(pfad, start[0], start[1], [1, 1], "S", false);
    schrift(7.5, true, F.tinte2);
    doc.text(`${z * sek} s`, px + 1.2, py + z * zeileMm + 3.4);
  }
  y = py + papierH + 5;
  schrift(8.4, false, F.tinte3);
  doc.text(t(`Papiervorschub 25 mm/s, Verstärkung 10 mm/mV, Ableitung I. Dargestellt: ${zahl(Math.min(signal.length, zeilen * proZeile) / freq)} von ${zahl(signal.length / freq)} Sekunden. Die Auswertung stammt vom Gerät und ist kein ärztlicher Befund.`), x0, y + 3);
}

// ---------------------------------------------------------------- Kopf- und Fußzeilen
function kopfFuss() {
  const n = doc.getNumberOfPages();
  const zeitraum = `${isoDatum(O.von)} bis ${isoDatum(O.bis)}`;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const bw = doc.internal.pageSize.getWidth(), bh = doc.internal.pageSize.getHeight();
    const l = bw > bh ? 14 : RAND.l, r = bw > bh ? 14 : RAND.r;
    doc.setDrawColor(...F.linie); doc.setLineWidth(0.2);
    if (i > 1) {
      schrift(7.6, false, F.tinte3);
      doc.text(t(`Gesundheitsbericht${O.name ? ` – ${O.name}` : ""}`), l, 11.5);
      doc.text(t(zeitraum), bw - r, 11.5, { align: "right" });
      doc.line(l, 13.5, bw - r, 13.5);
    }
    doc.line(l, bh - 13, bw - r, bh - 13);
    schrift(7.4, false, F.tinte3);
    doc.text(t(`Selbst gemessene Werte (Withings, Garmin). Erstellt am ${DF.kurz.format(new Date())} mit der Gesundheits-App ${C.APP_VERSION}. Keine ärztliche Diagnose.`), l, bh - 8.5);
    doc.text(`Seite ${i} von ${n}`, bw - r, bh - 8.5, { align: "right" });
  }
}

// ---------------------------------------------------------------- Ablauf
async function ladeSchrift(pfad) {
  const r = await fetch(pfad);
  if (!r.ok) throw new Error(`Schrift ${pfad}: HTTP ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return s;
}
async function erstellen(ctx, optionen, fortschritt = () => {}) {
  C = mitRueckfall(ctx); O = optionen;
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("Die PDF-Bibliothek ist nicht geladen.");
  if (!window.echarts) throw new Error("Die Diagramm-Bibliothek ist nicht geladen.");
  fortschritt("Daten werden zusammengestellt …");
  const [regular, fett] = await Promise.all([ladeSchrift("fonts/atkinson-next-regular.ttf"), ladeSchrift("fonts/atkinson-next-bold.ttf")]);
  try { await Promise.all([document.fonts.load(`400 12px "Atkinson Next"`), document.fonts.load(`700 12px "Atkinson Next"`)]); } catch { /* Ersatzschrift */ }
  const d = await sammeln();
  doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.addFileToVFS("AtkinsonNext-Regular.ttf", regular); doc.addFont("AtkinsonNext-Regular.ttf", "Atkinson", "normal");
  doc.addFileToVFS("AtkinsonNext-Bold.ttf", fett); doc.addFont("AtkinsonNext-Bold.ttf", "Atkinson", "bold");
  doc.setFont("Atkinson", "normal");
  doc.setProperties({ title: t(`Gesundheitsbericht ${isoDatum(O.von)} bis ${isoDatum(O.bis)}`), subject: "Selbst gemessene Gesundheitsdaten aus Withings und Garmin",
    author: t(O.name || ""), creator: `Gesundheits-App ${C.APP_VERSION}`, keywords: "Withings, Garmin, Blutdruck, EKG, Körperzusammensetzung, Schlaf" });
  try { doc.setLanguage("de-DE"); } catch { /* ältere Fassung */ }
  const A = O.abschnitte;
  titelseite(d);
  uebersicht(d);
  if (A.blutdruck && d.bp.length) { fortschritt("Blutdruck …"); await blutdruck(d); }
  if (A.ekg && d.ekg.length) ekgListe(d);
  if (A.herz && (d.k.ruhepuls.length || d.k.hrv.length || d.wr(91).length || d.wr(155).length)) { fortschritt("Herz und Kreislauf …"); await herzKreislauf(d); }
  if (A.koerper && (d.wr(1).length || d.wr(76).length)) { fortschritt("Körperzusammensetzung …"); await koerper(d); }
  if (A.schlaf && d.k.schlaf_dauer.length) { fortschritt("Schlaf …"); await schlaf(d); }
  if (A.aktivitaet && (d.k.schritte.length || d.akt.length)) { fortschritt("Aktivität …"); await aktivitaet(d); }
  if (A.erholung && (d.k.stress.length || d.k.bb_hoch.length)) await erholung(d);
  hinweise(d);
  if (A.blutdruck && A.protokoll && d.bp.length) protokoll(d);
  if (A.aktivitaet && A.aktivitaetenliste && d.akt.length) aktivitaetenListe(d);
  if (A.ekg && A.ekgKurven && d.ekg.some((e) => e.kurve)) { fortschritt("EKG-Kurven …"); await ekgKurven(d); }
  kopfFuss();
  fortschritt("PDF wird gespeichert …");
  const blob = doc.output("blob");
  return { blob, seiten: doc.getNumberOfPages(), dateiname: `Gesundheitsbericht_${O.von}_bis_${O.bis}.pdf` };
}

window.GesundheitBericht = { version: VERSION, erstellen, rueckfall: RUECKFALL };
})();
