/* =========================================================
   Ernährung: Kalorien- und Makro-Rechner und Tagesringe (ab Version 1.3.0)
   Wird vor app.js geladen; nutzt die Bausteine von app.js erst beim Aufruf.
   ========================================================= */
"use strict";

const E_PROFIL = "gesundheit.ernaehrung.profil";
const E_PAL = [
  [1.2, "Kaum aktiv (überwiegend liegend oder sitzend)"],
  [1.4, "Überwiegend sitzend, wenig Bewegung in der Freizeit"],
  [1.6, "Sitzend und gehend oder stehend, etwas Sport"],
  [1.8, "Überwiegend gehend oder stehend, regelmäßig Sport"],
  [2.0, "Körperlich anstrengend oder täglich intensives Training"],
];
const E_ZIELE = [["abnehmen", "Abnehmen"], ["halten", "Gewicht halten"], ["zunehmen", "Zunehmen oder Muskeln aufbauen"]];
const E_TEMPO = [[0.10, "Sanft (10 % weniger)"], [0.15, "Moderat (15 % weniger)"], [0.20, "Zügig (20 % weniger)"]];
const E_FARBE = { protein: "#ff3b30", kh: "#0a84ff", fett: "#ff9f0a" };

function eProfilLesen() {
  try { return JSON.parse(speicher.get(E_PROFIL) || "{}") || {}; } catch { return {}; }
}
function eProfilSchreiben(p) { speicher.set(E_PROFIL, JSON.stringify(p)); }

/** Reine Rechnung. p: gewicht (kg), groesse (cm), alter, geschlecht ("m"/"w"), pal, ziel, tempo, formel, fettfrei (kg, optional) */
function eBerechnen(p) {
  const r = { fehler: [], hinweise: [] };
  if (!(p.gewicht > 30 && p.groesse > 120 && p.alter > 0 && (p.geschlecht === "m" || p.geschlecht === "w"))) { r.fehler.push("Bitte Größe, Alter und Geschlecht angeben."); return r; }
  if (p.alter < 18) r.hinweise.push("Die Formeln gelten für Erwachsene. Für Kinder und Jugendliche bitte Kinderärztin oder Kinderarzt fragen.");
  const mifflin = 10 * p.gewicht + 6.25 * p.groesse - 5 * p.alter + (p.geschlecht === "m" ? 5 : -161);
  const katch = p.fettfrei > 20 ? 370 + 21.6 * p.fettfrei : null;
  r.formel = p.formel === "katch" && katch ? "katch" : "mifflin";
  r.grund = Math.round(r.formel === "katch" ? katch : mifflin);
  r.pal = p.pal || 1.4;
  r.gesamt = Math.round(r.grund * r.pal);
  const bmi = p.gewicht / ((p.groesse / 100) ** 2);
  r.bmi = bmi;
  let ziel = p.ziel || "halten";
  if (ziel === "abnehmen" && bmi < 18.5) { ziel = "halten"; r.hinweise.push("Bei einem BMI unter 18,5 ist Abnehmen nicht sinnvoll. Der Rechner zeigt deshalb das Halten an."); }
  r.ziel = ziel;
  let kcal = r.gesamt;
  if (ziel === "abnehmen") kcal = r.gesamt * (1 - (p.tempo || 0.15));
  if (ziel === "zunehmen") kcal = r.gesamt * 1.10;
  // Untergrenze: nie unter den Grundumsatz und nie unter 1200 (Frauen) beziehungsweise 1500 (Männer) kcal
  const untergrenze = Math.max(r.grund, p.geschlecht === "m" ? 1500 : 1200);
  if (ziel === "abnehmen" && kcal < untergrenze) { kcal = untergrenze; r.hinweise.push(`Das Defizit wurde begrenzt: Unter ${zahl(untergrenze)} kcal pro Tag sollte man ohne ärztliche Begleitung nicht essen.`); }
  r.kcal = Math.round(kcal / 10) * 10;
  r.differenz = r.kcal - r.gesamt;
  // Eiweiß je kg: DGE-Referenz, bei Abnehmen und Muskelaufbau nach ISSN-Empfehlung; bei BMI über 30 gilt das Gewicht bei BMI 30
  const ref = Math.min(p.gewicht, 30 * (p.groesse / 100) ** 2);
  r.refGewicht = Math.round(ref * 10) / 10;
  const dge = p.alter >= 65 ? 1.0 : 0.8;
  const proKg = ziel === "abnehmen" ? 1.4 : ziel === "zunehmen" ? 1.6 : (r.pal >= 1.8 ? 1.2 : dge);
  r.proteinProKg = proKg;
  r.protein = Math.round(proKg * ref);
  r.fett = Math.round((r.kcal * 0.30) / 9);
  r.kh = Math.max(0, Math.round((r.kcal - r.protein * 4 - r.fett * 9) / 4));
  r.ballast = 30;
  r.anteile = { protein: r.protein * 4 / r.kcal, fett: r.fett * 9 / r.kcal, kh: r.kh * 4 / r.kcal };
  if (ziel === "abnehmen") r.proWoche = Math.round(((r.gesamt - r.kcal) * 7 / 7700) * 100) / 100;
  return r;
}

/** Konzentrische Ringe. liste: [{ anteil 0..1, farbe }] von außen nach innen */
function eRinge(liste, groesse = 132, dicke = 13) {
  const mitte = groesse / 2;
  const svg = s("svg", { viewBox: `0 0 ${groesse} ${groesse}`, width: groesse, height: groesse, role: "img", class: "ringe" });
  liste.forEach((x, i) => {
    const r = mitte - dicke / 2 - 1 - i * (dicke + 3);
    if (r <= 4) return;
    const u = 2 * Math.PI * r;
    svg.append(s("circle", { cx: mitte, cy: mitte, r, fill: "none", stroke: x.farbe, "stroke-opacity": 0.2, "stroke-width": dicke }));
    const a = Math.max(0, Math.min(1, x.anteil || 0));
    if (a > 0) svg.append(s("circle", { cx: mitte, cy: mitte, r, fill: "none", stroke: x.farbe, "stroke-width": dicke, "stroke-linecap": "round",
      "stroke-dasharray": `${Math.max(0.01, a * u)} ${u}`, transform: `rotate(-90 ${mitte} ${mitte})` }));
  });
  return svg;
}

/** Kachel „Tagesaktivität“ für die Startseite: Schritte, Etagen, Aktive Minuten als Ringe */
function eTagesringe(k, heute) {
  const schritte = amTag(k.schritte, heute);
  const etagen = amTag(k.etagen, heute);
  const mod = amTag(k.im_mod, heute), int = amTag(k.im_int, heute);
  const minuten = mod != null || int != null ? (mod || 0) + 2 * (int || 0) : null; // Garmin zählt intensive Minuten doppelt
  const kcal = amTag(k.aktivkcal, heute);
  const strecke = amTag(k.strecke, heute);
  if (schritte == null && etagen == null && minuten == null && kcal == null) return null;
  const schrittZiel = amTag(k.schrittziel, heute) || (letzter(k.schrittziel) || [])[1] || 10000;
  const etagenZiel = 10, minutenZiel = 22; // Garmin-Standard; 150 Minuten pro Woche (WHO) entsprechen etwa 22 pro Tag
  const zeilen = [
    ["Schritte", schritte, schrittZiel, "var(--ring-rot, #ff3b30)", ""],
    ["Etagen", etagen, etagenZiel, "var(--ring-gruen, #34c759)", ""],
    ["Aktive Minuten", minuten, minutenZiel, "var(--ring-blau, #0a84ff)", " Min."],
  ];
  const farben = ["#ff3b30", "#34c759", "#0a84ff"];
  const legende = h("ul", { class: "ring-legende" }, zeilen.map(([name, wert, ziel, , einheit], i) =>
    h("li", null, h("i", { style: { background: farben[i] } }), h("span", { class: "rl-name" }, name),
      h("b", null, wert != null ? `${zahl(Math.round(wert))}${einheit}` : "–"), h("small", null, ` / ${zahl(ziel)}`))));
  const extra = [];
  if (kcal != null) extra.push(h("div", null, h("small", null, "Aktive Kalorien"), h("b", null, `${zahl(Math.round(kcal))} kcal`)));
  if (strecke != null) extra.push(h("div", null, h("small", null, "Strecke"), h("b", null, `${zahl(strecke, 1)} km`)));
  const ringe = eRinge(zeilen.map(([, wert, ziel], i) => ({ anteil: wert != null ? wert / ziel : 0, farbe: farben[i] })));
  ringe.setAttribute("aria-label", zeilen.map(([n, w, z]) => `${n} ${w != null ? zahl(Math.round(w)) : "keine Angabe"} von ${zahl(z)}`).join(", "));
  return h("a", { class: "kachel tagesringe", href: "#sport" },
    h("span", { class: "kachel-titel" }, "Tagesaktivität"),
    h("div", { class: "ring-zeile" }, ringe, h("div", { class: "ring-text" }, legende, extra.length ? h("div", { class: "ring-extra" }, extra) : null)));
}

/** Zielwerte als Ring mit Kalorien in der Mitte; Farbbögen nach Energieanteil */
function eZielRing(r) {
  const groesse = 168, dicke = 20, mitte = groesse / 2, rad = mitte - dicke / 2 - 2, u = 2 * Math.PI * rad;
  const svg = s("svg", { viewBox: `0 0 ${groesse} ${groesse}`, width: groesse, height: groesse, role: "img", class: "ziel-ring",
    "aria-label": `Tagesziel ${r.kcal} kcal: Eiweiß ${r.protein} g, Kohlenhydrate ${r.kh} g, Fett ${r.fett} g` });
  svg.append(s("circle", { cx: mitte, cy: mitte, r: rad, fill: "none", stroke: "currentColor", "stroke-opacity": 0.1, "stroke-width": dicke }));
  let start = 0;
  for (const [id, a] of [["protein", r.anteile.protein], ["kh", r.anteile.kh], ["fett", r.anteile.fett]]) {
    const len = a * u;
    if (len > 1) svg.append(s("circle", { cx: mitte, cy: mitte, r: rad, fill: "none", stroke: E_FARBE[id], "stroke-width": dicke,
      "stroke-dasharray": `${Math.max(0.01, len - 3)} ${u}`, "stroke-dashoffset": -start, transform: `rotate(-90 ${mitte} ${mitte})` }));
    start += len;
  }
  const t1 = s("text", { x: mitte, y: mitte - 2, "text-anchor": "middle", "font-size": 30, "font-weight": 700, fill: "currentColor" }, zahl(r.kcal));
  const t2 = s("text", { x: mitte, y: mitte + 20, "text-anchor": "middle", "font-size": 13, fill: "currentColor", "fill-opacity": 0.6 }, "kcal pro Tag");
  svg.append(t1, t2);
  return svg;
}

async function ansichtEssen() {
  const [w, info] = await Promise.all([Daten.withings(), Daten.info("garmin")]);
  const pers = personAus(info, w);
  const gew = letzter(wReihe(w, 1));
  const fettfrei = letzter(wReihe(w, 5));
  let reihe7 = [];
  try { reihe7 = await Daten.reihe("g.tag.totalKilocalories", isoMinus(8), isoMinus(1)); } catch { reihe7 = []; }
  const gespeichert = eProfilLesen();
  const p = {
    groesse: gespeichert.groesse || (pers.groesse ? Math.round(pers.groesse * 100) : ""),
    alter: gespeichert.alter || pers.alter || "",
    geschlecht: gespeichert.geschlecht || pers.geschlecht || "",
    pal: gespeichert.pal || 1.4, ziel: gespeichert.ziel || "halten", tempo: gespeichert.tempo || 0.15, formel: gespeichert.formel || "mifflin",
  };
  const ergebnis = h("div", { class: "ernaehrung-ergebnis" });
  const feld = (name, steuerung) => h("label", { class: "e-feld" }, h("span", null, name), steuerung);
  const zahlFeld = (id, min, max, einheit) => {
    const i = h("input", { type: "number", inputmode: "numeric", min, max, value: p[id] === "" ? null : p[id], "aria-label": id });
    i.addEventListener("input", () => { p[id] = i.value === "" ? "" : Number(i.value); aenderung(); });
    return h("div", { class: "e-zahl" }, i, h("small", null, einheit));
  };
  const auswahl = (id, optionen, numerisch = false) => {
    const sel = h("select", null, optionen.map(([wert, text]) => h("option", { value: wert, selected: String(p[id]) === String(wert) ? true : null }, text)));
    sel.addEventListener("change", () => { p[id] = numerisch ? Number(sel.value) : sel.value; aenderung(); });
    return sel;
  };
  const tempoFeld = feld("Tempo", auswahl("tempo", E_TEMPO, true));
  const formelFeld = fettfrei ? feld("Formel für den Grundumsatz", auswahl("formel", [["mifflin", "Mifflin-St Jeor (Standard)"], ["katch", "Katch-McArdle (mit fettfreier Masse der Waage)"]])) : null;

  function aenderung() {
    eProfilSchreiben({ groesse: p.groesse, alter: p.alter, geschlecht: p.geschlecht, pal: p.pal, ziel: p.ziel, tempo: p.tempo, formel: p.formel });
    zeichnen();
  }
  function zeichnen() {
    tempoFeld.hidden = p.ziel !== "abnehmen";
    const r = eBerechnen({ gewicht: gew ? gew[1] : 0, groesse: Number(p.groesse), alter: Number(p.alter), geschlecht: p.geschlecht, pal: p.pal, ziel: p.ziel, tempo: p.tempo,
      formel: p.formel, fettfrei: fettfrei ? fettfrei[1] : null });
    if (r.fehler.length) { ergebnis.replaceChildren(hinweis(r.fehler)); return; }
    const makro = (id, name, g, proKg) => h("div", { class: "e-makro" },
      h("div", { class: "e-makro-kopf" }, h("i", { style: { background: E_FARBE[id] } }), h("span", null, name), h("b", null, `${zahl(g)} g`)),
      h("div", { class: "e-balken" }, h("i", { style: { width: `${Math.min(100, Math.round(r.anteile[id] * 100))}%`, background: E_FARBE[id] } })),
      h("small", null, `${zahl(Math.round(r.anteile[id] * 100))} % der Energie${proKg ? `, ${zahl(proKg, 1)} g pro kg` : ""}`));
    const vergleich = reihe7.length >= 3 ? Math.round(reihe7.reduce((a, x) => a + x[1], 0) / reihe7.length) : null;
    ergebnis.replaceChildren(...[
      h("section", { class: "abschnitt e-ziel" },
        h("div", { class: "abschnitt-kopf" }, h("div", null, h("h2", null, "Dein Tagesziel"), h("p", null, `${E_ZIELE.find((z) => z[0] === r.ziel)[1]}${r.ziel === "halten" ? "" : r.differenz < 0 ? `, ${zahl(-r.differenz)} kcal weniger als dein Verbrauch` : `, ${zahl(r.differenz)} kcal mehr als dein Verbrauch`}`))),
        h("div", { class: "e-ziel-zeile" }, eZielRing(r), h("div", { class: "e-makros" },
          makro("protein", "Eiweiß", r.protein, r.proteinProKg), makro("kh", "Kohlenhydrate", r.kh), makro("fett", "Fett", r.fett))),
        h("p", { class: "e-klein" }, `Ballaststoffe: mindestens ${r.ballast} g pro Tag.`)),
      r.hinweise.length ? hinweis(r.hinweise, "warnung", "achtung") : null,
      h("section", { class: "abschnitt" },
        h("div", { class: "abschnitt-kopf" }, h("div", null, h("h2", null, "So wurde gerechnet"))),
        h("ul", { class: "werte e-werte" },
          h("li", null, h("span", { class: "name" }, `Grundumsatz (${r.formel === "katch" ? "Katch-McArdle" : "Mifflin-St Jeor"})`), h("span", { class: "zahl" }, zahl(r.grund), h("small", null, "kcal"))),
          h("li", null, h("span", { class: "name" }, `Gesamtumsatz (Grundumsatz × ${zahl(r.pal, 1)})`), h("span", { class: "zahl" }, zahl(r.gesamt), h("small", null, "kcal"))),
          vergleich ? h("li", null, h("span", { class: "name" }, "Zum Vergleich: Garmin gemessen, Mittel der letzten Tage"), h("span", { class: "zahl" }, zahl(vergleich), h("small", null, "kcal"))) : null,
          r.proWoche ? h("li", null, h("span", { class: "name" }, "Erwartete Abnahme pro Woche"), h("span", { class: "zahl" }, `etwa ${zahl(r.proWoche, 1)}`, h("small", null, "kg"))) : null,
          h("li", null, h("span", { class: "name" }, `Eiweiß: ${zahl(r.proteinProKg, 1)} g pro kg (Bezugsgewicht ${zahl(r.refGewicht, 1)} kg)`), h("span", { class: "zahl" }, zahl(r.protein), h("small", null, "g"))),
          h("li", null, h("span", { class: "name" }, "Fett: 30 % der Energie"), h("span", { class: "zahl" }, zahl(r.fett), h("small", null, "g"))),
          h("li", null, h("span", { class: "name" }, "Kohlenhydrate: der Rest"), h("span", { class: "zahl" }, zahl(r.kh), h("small", null, "g")))),
        h("p", { class: "e-klein" }, "Quellen: Grundumsatz nach ",
          h("a", { href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6413219/", target: "_blank", rel: "noopener" }, "Mifflin-St Jeor und Vergleichsstudien"),
          ", Aktivitätsfaktoren nach ", h("a", { href: "https://www.dge.de/wissenschaft/referenzwerte/energie/", target: "_blank", rel: "noopener" }, "DGE-Referenzwerten"),
          ", Eiweiß nach ", h("a", { href: "https://www.dge.de/wissenschaft/dge-leitlinien/leitlinie-protein/", target: "_blank", rel: "noopener" }, "DGE-Leitlinie"),
          " und ", h("a", { href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13665703/", target: "_blank", rel: "noopener" }, "ISSN-Positionspapier"),
          ". Die Werte sind eine Orientierung und keine ärztliche Beratung. Bei Krankheit, Schwangerschaft oder Essstörung bitte mit Ärztin, Arzt oder Ernährungsberatung sprechen.")),
      hinweis(["Das Ernährungstagebuch mit Suche und Barcode-Scanner folgt in der nächsten Version. Hier steht vorerst der Rechner."], "", "info")].filter(Boolean));
  }

  const knoten = [
    h("section", { class: "abschnitt" },
      h("div", { class: "abschnitt-kopf" }, h("div", null, h("h2", null, "Deine Angaben"), h("p", null, "Das Gewicht kommt automatisch von deiner Waage."))),
      h("div", { class: "e-formular" },
        feld("Gewicht", h("div", { class: "e-zahl e-fest" }, h("b", null, gew ? zahl(gew[1], 1) : "–"), h("small", null, "kg, von der Waage"))),
        feld("Größe", zahlFeld("groesse", 120, 230, "cm")),
        feld("Alter", zahlFeld("alter", 14, 110, "Jahre")),
        feld("Geschlecht", auswahl("geschlecht", [["", "Bitte wählen"], ["w", "weiblich"], ["m", "männlich"]])),
        feld("Bewegung im Alltag", auswahl("pal", E_PAL, true)),
        feld("Ziel", auswahl("ziel", E_ZIELE)), tempoFeld, formelFeld)),
    ergebnis,
  ];
  zeichnen();
  return { titel: "Ernährung", knoten };
}
