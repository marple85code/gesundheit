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
  const mirror = (d, cls, st) => `<path d="${d}" class="${cls}" ${st || ""}/><g transform="matrix(-1 0 0 1 200 0)"><path d="${d}" class="${cls}" ${st || ""}/></g>`;
  const SIL = "M104 62 L108 66 C122 68 136 70 144 78 C152 84 154 94 154 104 L158 150 C160 170 162 190 162 204 C163 214 160 220 156 218 C152 216 152 206 150 196 L144 150 C142 134 140 120 138 108 L134 140 C134 160 138 180 138 196 C142 220 142 250 136 276 C133 300 131 322 126 346 L128 360 L110 362 L108 340 C104 300 104 260 102 220 L100 205 L100 64 Z";
  const DELT = "M140 78 C150 82 154 92 152 104 C148 106 142 100 140 92 C138 86 138 80 140 78Z";
  const ARM = ["M146 108 C152 112 154 130 154 150 C150 152 146 150 144 146 C142 134 142 118 146 108Z", "M150 156 C156 160 160 190 158 206 C154 206 152 190 150 176Z"];
  const CALF = "M118 300 C124 304 126 326 122 344 C116 344 112 326 112 308Z";
  const F = {
    brust: "M104 80 C118 76 134 80 138 92 C136 106 124 114 110 112 C104 110 104 96 104 80Z",
    bauch: ["M103 118 h14 a5 5 0 0 1 5 5 v5 a5 5 0 0 1 -5 5 h-14z", "M103 135 h14 a5 5 0 0 1 5 5 v5 a5 5 0 0 1 -5 5 h-14z", "M103 152 h13 a5 5 0 0 1 5 5 v5 a5 5 0 0 1 -5 5 h-13z", "M103 169 h12 a5 5 0 0 1 5 5 v4 a5 5 0 0 1 -5 5 h-12z"],
    quad: "M104 208 C116 204 130 212 134 240 C134 262 130 278 124 290 C114 292 108 278 106 256 C104 236 102 220 104 208Z",
  };
  const B = {
    ruecken: ["M100 64 L108 66 C120 68 134 72 140 78 C130 84 120 92 112 108 L100 118Z", "M102 112 C112 102 126 100 136 108 C136 124 132 138 120 146 L102 146Z"],
    gesaess: "M101 196 C112 188 130 192 136 204 C136 220 124 228 108 226 C102 224 101 210 101 196Z",
    beuger: "M104 232 C118 228 132 236 132 262 C130 276 124 288 118 292 C108 288 104 270 104 250Z",
    wade: "M112 296 C122 296 128 312 124 336 C118 340 112 332 110 316Z",
  };
  function regs(seite) {
    if (seite === "v") return { schulter: [DELT], brust: [F.brust], arm: ARM, bauch: F.bauch, quad: [F.quad], wade: [CALF] };
    return { schulter: [DELT], ruecken: B.ruecken, arm: ARM, gesaess: [B.gesaess], beuger: [B.beuger], wade: [B.wade] };
  }
  /** Eine Figur als SVG-Text. thema: "app" (nutzt CSS-Klassen/Variablen), "dunkel" oder "hell" (eigenstaendig, fuer das Teilen-Bild). */
  function figur(seite, stufen, breite, opt = {}) {
    const thema = opt.thema || "app", u = "f" + Math.random().toString(36).slice(2, 8);
    const r = regs(seite), c = (k) => ({ 0: "", 1: "m1", 2: "m2", 3: "m3" }[stufen[k] || 0]);
    let m = "";
    for (const k in r) r[k].forEach((d) => { m += mirror(d, "mu " + c(k), 'stroke="rgba(0,0,0,.18)" stroke-width="0.8"'); });
    let kopf = `<ellipse cx="100" cy="30" rx="18" ry="21" class="s"/><rect x="93" y="48" width="14" height="16" class="s"/>`;
    if (seite === "v" && opt.bild) kopf = `<rect x="92" y="58" width="16" height="12" class="s"/><defs><clipPath id="${u}c"><circle cx="100" cy="32" r="32"/></clipPath></defs><circle cx="100" cy="32" r="32" class="s"/><image href="${opt.bild}" x="68" y="0" width="64" height="64" clip-path="url(#${u}c)" preserveAspectRatio="xMidYMid slice"/><circle cx="100" cy="32" r="32" fill="none" class="rand"/>`;
    const vy = seite === "v" && opt.bild ? -4 : 0;
    const grad = `<defs><linearGradient id="${u}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>`;
    let stil = "";
    if (thema !== "app") {
      const d = thema === "dunkel";
      stil = `<style>#${u} .s{fill:${d ? "#2c2c2e" : "#e3e3e8"};stroke:${d ? "#48484a" : "#c8c8ce"};stroke-width:1.5}#${u} .rand{stroke:${d ? "#48484a" : "#c8c8ce"};stroke-width:1.5}#${u} .mu{fill:${d ? "#3a3a3c" : "#d2d2d8"}}#${u} .m1{fill:#ffcc00}#${u} .m2{fill:#ff9f0a}#${u} .m3{fill:#ff3b30}</style>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${u}" viewBox="0 ${vy} 200 ${370 - vy}" width="${breite}" height="${Math.round(breite * (370 - vy) / 200)}" class="mk-fig-${seite}">${stil}${grad}${mirror(SIL, "s")}${kopf}<g>${m}</g><path d="${SIL}" fill="url(#${u}g)" pointer-events="none"/></svg>`;
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
