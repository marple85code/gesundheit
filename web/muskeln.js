/* GaWi: Muskel-Anzeige fuer den Trainingstag. Ordnet Sportarten und Krafttrainings-Uebungen Muskelgruppen zu
   und zeichnet die Koerperfigur (vorne und hinten). Reine Rechenlogik, keine Daten verlassen das Geraet. */
(() => {
  "use strict";
  const REGIONEN = [
    ["quad", "Oberschenkel vorn"], ["gesaess", "Gesäß"], ["beuger", "Oberschenkel hinten"], ["wade", "Waden"],
    ["ruecken", "Rücken"], ["brust", "Brust"], ["schulter", "Schultern"], ["arm", "Arme"], ["bauch", "Bauch"],
  ];
  const NAME = Object.fromEntries(REGIONEN);
  // Gewicht 0..1 je Muskelgruppe und Minute Ausdauersport; die Zuordnung ist eine Naeherung
  const AUSDAUER = {
    rad: { quad: 0.9, gesaess: 0.6, wade: 0.4, beuger: 0.4, bauch: 0.1 },
    lauf: { quad: 0.8, gesaess: 0.6, wade: 0.7, beuger: 0.6, bauch: 0.2 },
    gehen: { quad: 0.45, gesaess: 0.45, wade: 0.5, beuger: 0.3 },
    wandern: { quad: 0.6, gesaess: 0.6, wade: 0.55, beuger: 0.4, bauch: 0.1 },
    schwimmen: { schulter: 0.8, ruecken: 0.7, brust: 0.5, arm: 0.5, bauch: 0.3, quad: 0.2 },
    rudern: { ruecken: 0.8, arm: 0.6, beuger: 0.4, quad: 0.4, schulter: 0.4, bauch: 0.3 },
    yoga: { bauch: 0.5, ruecken: 0.35, gesaess: 0.3, schulter: 0.25, quad: 0.2 },
    gerat: { quad: 0.6, gesaess: 0.6, wade: 0.4, beuger: 0.3 },
    ski: { quad: 0.8, gesaess: 0.6, bauch: 0.3, wade: 0.3 },
    voll: { quad: 0.5, gesaess: 0.5, beuger: 0.4, wade: 0.35, ruecken: 0.5, brust: 0.45, schulter: 0.45, arm: 0.4, bauch: 0.45 },
  };
  function ausdauerArt(typ) {
    const t = String(typ || "");
    if (/cycl|bik|ride|e_bike/.test(t)) return "rad";
    if (/run|jog/.test(t)) return "lauf";
    if (/hik|mountaineer|snowshoe/.test(t)) return "wandern";
    if (/walk/.test(t)) return "gehen";
    if (/swim/.test(t)) return "schwimmen";
    if (/row/.test(t)) return "rudern";
    if (/yoga|pilates|breath|meditat/.test(t)) return "yoga";
    if (/ellip|stair|cardio/.test(t)) return "gerat";
    if (/ski/.test(t)) return "ski";
    return null;
  }
  const KRAFT = /strength|hiit|fitness_equipment/;
  // Garmin-Uebungskategorien (und Namensteile) -> Muskelgruppen, jeweils mit Gewichtung je Satz
  const UEBUNG = [
    [/BENCH_PRESS|PUSH_UP|FLYE|CHEST|DIP/, { brust: 1, schulter: 0.4, arm: 0.5 }],
    [/SHOULDER_PRESS|LATERAL_RAISE|FRONT_RAISE|SHRUG|SHOULDER|ARNOLD|UPRIGHT/, { schulter: 1, arm: 0.4 }],
    [/PULL_UP|CHIN_UP|LAT_PULL|ROW|PULLDOWN|BACK_EXTENSION|HYPEREXTENSION|SUPERMAN/, { ruecken: 1, arm: 0.5, schulter: 0.3 }],
    [/DEADLIFT|GOOD_MORNING/, { ruecken: 0.7, gesaess: 0.8, beuger: 0.9 }],
    [/CURL|BICEP|TRICEP|ARM|EXTENSION_TRICEPS/, { arm: 1 }],
    [/LEG_CURL|HAMSTRING/, { beuger: 1, gesaess: 0.3 }],
    [/CALF/, { wade: 1 }],
    [/HIP_RAISE|HIP_STABILITY|GLUTE|BRIDGE|KICKBACK|HIP_THRUST/, { gesaess: 1, beuger: 0.4 }],
    [/SQUAT|LUNGE|LEG_PRESS|LEG_EXTENSION|STEP_UP|BOX|WALL_SIT/, { quad: 1, gesaess: 0.7, beuger: 0.3 }],
    [/CRUNCH|SIT_UP|PLANK|CORE|LEG_RAISE|RUSSIAN|TWIST|AB_|ABS|HOLLOW|FLUTTER|V_UP|MOUNTAIN_CLIMBER/, { bauch: 1 }],
    [/OLYMPIC|TOTAL_BODY|BURPEE|CLEAN|SNATCH|SWING|THRUSTER|PLYO|CARDIO|JUMP|BATTLE_ROPE|SLED/, { quad: 0.6, gesaess: 0.5, ruecken: 0.5, schulter: 0.5, arm: 0.4, bauch: 0.4, brust: 0.3 }],
  ];
  const MIN_JE_SATZ = 3.5; // ein Satz zaehlt wie gut drei Minuten Belastung
  function uebungZu(u) {
    const roh = `${u.kat || ""} ${u.name || ""}`;
    for (const [re, g] of UEBUNG) if (re.test(roh)) return g;
    return null;
  }
  const lesbar = (t) => String(t || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  /** akten: [{typ, dauer (s)}], uebungen: Map id -> [{kat,name,saetze,wdh}]. Ergibt Punkte, Stufen 0..3 und nicht zugeordnete Uebungen. */
  function berechnen(akten, uebungen) {
    const p = Object.fromEntries(REGIONEN.map(([id]) => [id, 0]));
    const offen = new Map();
    for (const a of akten) {
      const min = (a.dauer || 0) / 60;
      if (KRAFT.test(a.typ || "")) {
        const liste = (uebungen && uebungen.get(String(a.id))) || [];
        let erkannt = 0;
        for (const u of liste) {
          const g = uebungZu(u);
          if (!g) { offen.set(u.name || u.kat, (offen.get(u.name || u.kat) || 0) + u.saetze); continue; }
          erkannt += u.saetze;
          for (const [r, w] of Object.entries(g)) p[r] += u.saetze * MIN_JE_SATZ * w;
        }
        if (!erkannt) for (const [r, w] of Object.entries(AUSDAUER.voll)) p[r] += min * w * 0.8;
        continue;
      }
      const art = ausdauerArt(a.typ);
      if (art) for (const [r, w] of Object.entries(AUSDAUER[art])) p[r] += min * w;
    }
    const stufe = (v) => (v >= 45 ? 3 : v >= 20 ? 2 : v >= 6 ? 1 : 0);
    const stufen = {}, anteil = {};
    for (const r of Object.keys(p)) { stufen[r] = stufe(p[r]); anteil[r] = Math.min(1, p[r] / 60); }
    const rang = REGIONEN.map(([id, name]) => ({ id, name, punkte: p[id], stufe: stufen[id], anteil: anteil[id] })).filter((x) => x.stufe > 0).sort((a, b) => b.punkte - a.punkte);
    return { stufen, rang, nichtZugeordnet: [...offen.keys()].map(lesbar) };
  }

  const FARBE = { 1: "#ffcc00", 2: "#ff9f0a", 3: "#ff3b30" };
  /** Eine Figur als SVG-Text. thema: "app" (nutzt CSS-Klassen/Variablen), "dunkel" oder "hell" (eigenstaendig, fuer das Teilen-Bild). */
  function figur(seite, stufen, breite, opt = {}) {
    const thema = opt.thema || "app";
    const c = (r) => ({ 0: "", 1: "m1", 2: "m2", 3: "m3" }[stufen[r] || 0]);
    const sil = `<path d="M92 52h16v16H92z" class="s"/>
<path d="M60 76 Q100 62 140 76 L136 192 Q100 208 64 192 Z" class="s"/>
<rect x="30" y="78" width="22" height="104" rx="11" transform="rotate(8 41 80)" class="s"/><rect x="148" y="78" width="22" height="104" rx="11" transform="rotate(-8 159 80)" class="s"/>
<rect x="64" y="190" width="34" height="168" rx="17" class="s"/><rect x="102" y="190" width="34" height="168" rx="17" class="s"/>`;
    let kopf = `<circle cx="100" cy="34" r="20" class="s"/>`;
    if (seite === "v" && opt.bild) {
      const id = `mkc${Math.random().toString(36).slice(2, 7)}`;
      kopf = `<defs><clipPath id="${id}"><circle cx="100" cy="34" r="20"/></clipPath></defs><circle cx="100" cy="34" r="20" class="s"/><image href="${opt.bild}" x="80" y="14" width="40" height="40" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/><circle cx="100" cy="34" r="20" fill="none" class="rand"/>`;
    }
    const e = (cx, cy, rx, ry, r, extra = "") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${extra} class="mu ${c(r)}"/>`;
    const arme = e(46, 128, 8, 22, "arm", 'transform="rotate(10 46 128)"') + e(154, 128, 8, 22, "arm", 'transform="rotate(-10 154 128)"');
    const wade = e(80, 326, 10, 26, "wade") + e(120, 326, 10, 26, "wade");
    const schulter = e(62, 88, 15, 12, "schulter") + e(138, 88, 15, 12, "schulter");
    const m = seite === "v"
      ? schulter + e(85, 108, 19, 13, "brust") + e(115, 108, 19, 13, "brust") + arme + `<rect x="86" y="128" width="28" height="56" rx="10" class="mu ${c("bauch")}"/>` + e(81, 250, 15, 46, "quad") + e(119, 250, 15, 46, "quad") + wade
      : `<path d="M82 74 L118 74 L112 112 L88 112 Z" class="mu ${c("ruecken")}"/>` + schulter + e(78, 132, 16, 24, "ruecken") + e(122, 132, 16, 24, "ruecken") + arme + e(82, 198, 18, 16, "gesaess") + e(118, 198, 18, 16, "gesaess") + e(81, 262, 14, 40, "beuger") + e(119, 262, 14, 40, "beuger") + wade;
    let stil = "";
    if (thema !== "app") {
      const d = thema === "dunkel";
      stil = `<style>.s{fill:${d ? "#2c2c2e" : "#e3e3e8"};stroke:${d ? "#48484a" : "#c8c8ce"};stroke-width:1.5}.rand{stroke:${d ? "#48484a" : "#c8c8ce"};stroke-width:1.5}.mu{fill:${d ? "#3a3a3c" : "#cfcfd4"};opacity:.7}.m1{fill:#ffcc00;opacity:.9}.m2{fill:#ff9f0a;opacity:1}.m3{fill:#ff3b30;opacity:1}</style>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 370" width="${breite}" height="${Math.round(breite * 1.85)}" class="mk-fig-${seite}">${stil}${sil}${kopf}<g>${m}</g></svg>`;
  }
  function figurBild(seite, stufen, thema, bild) {
    return new Promise((ok) => {
      const svg = figur(seite, stufen, 400, { thema, bild });
      const i = new Image();
      i.onload = () => ok(i); i.onerror = () => ok(null);
      i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }
  window.GaWiMuskeln = { berechnen, figur, figurBild, REGIONEN, NAME, FARBE, lesbar };
})();
