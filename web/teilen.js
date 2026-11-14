/* GaWi: Aktivität als Bild teilen (Story 1080x1920 und Feed 1080x1350), alles im Browser gezeichnet. */
(() => {
  "use strict";
  const GROESSEN = { story: [1080, 1920, "Story"], feed: [1080, 1350, "Feed"] };
    const LAYOUTS = [["garmin", "Garmin"], ["strava", "Strava"], ["fitness", "Fitness"], ["wahoo", "Wahoo und Polar"], ["suunto", "Suunto"], ["glas", "Glas"]];
  const HINTERGRUENDE = [
    ["sonne", "Sonnenaufgang", [[0, "#2b4a7a"], [0.45, "#e8886a"], [0.62, "#f7c27a"]], ["#3d5a4a", "#223a30"]],
    ["nacht", "Nacht", [[0, "#0b1230"], [0.6, "#27407a"], [0.85, "#5b6fa8"]], ["#1b2a3a", "#0e1822"]],
    ["wald", "Wald", [[0, "#9ad0c2"], [0.55, "#4f8a6b"], [0.9, "#21463a"]], ["#2f5d46", "#173a2b"]],
  ];
  const SCHRIFT = "Roboto, 'Helvetica Neue', Arial, sans-serif";
  const SCHMAL = "'Roboto Condensed', 'Arial Narrow', Roboto, Arial, sans-serif";
  const logoBild = (() => { const i = new Image(); i.src = "icons/icon-512.png"; return i; })();

  function rundRechteck(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function logo(c, x, y, s) { c.save(); rundRechteck(c, x, y, s, s, s * 0.22); c.clip(); if (logoBild.complete && logoBild.naturalWidth) c.drawImage(logoBild, x, y, s, s); else { c.fillStyle = "#0a84ff"; c.fillRect(x, y, s, s); } c.restore(); }
  function text(c, t, x, y, groesse, opt = {}) {
    c.font = `${opt.kursiv ? "italic " : ""}${opt.gewicht || 400} ${groesse}px ${opt.schrift || SCHRIFT}`;
    c.fillStyle = opt.farbe || "#fff"; c.textAlign = opt.ausrichtung || "left"; c.textBaseline = opt.basis || "alphabetic";
    if (opt.schatten) { c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = opt.schatten; c.shadowOffsetY = 2; }
    if (opt.spur) { try { c.letterSpacing = `${opt.spur}px`; } catch { /* ältere Browser */ } }
    c.fillText(t, x, y);
    c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetY = 0;
    try { c.letterSpacing = "0px"; } catch { /* ältere Browser */ }
  }
  function breite(c, t, groesse, opt = {}) { c.font = `${opt.kursiv ? "italic " : ""}${opt.gewicht || 400} ${groesse}px ${opt.schrift || SCHRIFT}`; return c.measureText(t).width; }

  // ---- Hintergründe
  function hintergrund(c, W, H, bg) {
    if (bg.bild) {
      const i = bg.bild, s = Math.max(W / i.width, H / i.height), w = i.width * s, h = i.height * s;
      c.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); return;
    }
    const d = HINTERGRUENDE.find((x) => x[0] === bg.id) || HINTERGRUENDE[0];
    const g = c.createLinearGradient(0, 0, 0, H); d[2].forEach(([p, f]) => g.addColorStop(p, f)); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = d[3][0]; c.beginPath(); c.moveTo(0, H * 0.66); c.quadraticCurveTo(W * 0.18, H * 0.58, W * 0.36, H * 0.64); c.quadraticCurveTo(W * 0.55, H * 0.7, W * 0.7, H * 0.6); c.quadraticCurveTo(W * 0.88, H * 0.52, W, H * 0.64); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = d[3][1]; c.beginPath(); c.moveTo(0, H * 0.78); c.quadraticCurveTo(W * 0.25, H * 0.7, W * 0.5, H * 0.77); c.quadraticCurveTo(W * 0.78, H * 0.84, W, H * 0.74); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  }
  function topo(c, W, H, bg, linie) {
    c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = linie; c.lineWidth = 2;
    for (const [cx, cy, n, schritt, drehung] of [[0.62, 0.38, 28, 38, -0.3], [0.12, 0.8, 16, 34, 0]]) {
      for (let k = 1; k <= n; k++) { c.beginPath(); c.ellipse(W * cx, H * cy, k * schritt * 1.5, k * schritt, drehung, 0, Math.PI * 2); c.stroke(); }
    }
  }
  function abdunkeln(c, W, H, von, bis, a0, a1) {
    const g = c.createLinearGradient(0, H * von, 0, H * bis); g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, `rgba(0,0,0,${a1})`); c.fillStyle = g; c.fillRect(0, H * Math.min(von, bis), W, H * Math.abs(bis - von));
  }

  // ---- Strecke
  function projizieren(track, x, y, w, h, pad = 0.06) {
    if (!track || track.length < 2) return null;
    const schritt = Math.max(1, Math.floor(track.length / 700)), t = track.filter((_, i) => i % schritt === 0 || i === track.length - 1);
    const lat0 = t.reduce((s, p) => s + p[0], 0) / t.length, k = Math.cos(lat0 * Math.PI / 180);
    const pts = t.map((p) => [p[1] * k, -p[0]]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bw = Math.max(1e-9, Math.max(...xs) - Math.min(...xs)), bh = Math.max(1e-9, Math.max(...ys) - Math.min(...ys));
    const s = Math.min(w * (1 - 2 * pad) / bw, h * (1 - 2 * pad) / bh);
    const ox = x + (w - bw * s) / 2 - Math.min(...xs) * s, oy = y + (h - bh * s) / 2 - Math.min(...ys) * s;
    return { pts: pts.map((p) => [p[0] * s + ox, p[1] * s + oy]), index: t.map((_, i) => Math.round(i * (track.length - 1) / Math.max(1, t.length - 1))) };
  }
  function linie(c, pr, farbe, breiteL, opt = {}) {
    if (!pr) return;
    c.save(); c.lineJoin = "round"; c.lineCap = "round";
    if (opt.schatten) { c.shadowColor = opt.schattenFarbe || "rgba(0,0,0,.5)"; c.shadowBlur = opt.schatten; }
    if (opt.farben) {
      for (let i = 1; i < pr.pts.length; i++) { c.beginPath(); c.moveTo(...pr.pts[i - 1]); c.lineTo(...pr.pts[i]); c.strokeStyle = opt.farben(i); c.lineWidth = breiteL; c.stroke(); }
    } else { c.beginPath(); pr.pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.strokeStyle = farbe; c.lineWidth = breiteL; c.stroke(); }
    c.restore();
    if (opt.punkte !== false) {
      const r = breiteL * 0.9;
      for (const [p, f] of [[pr.pts[0], "#34c759"], [pr.pts[pr.pts.length - 1], "#ff3b30"]]) { c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fillStyle = f; c.fill(); c.lineWidth = r * 0.4; c.strokeStyle = "#fff"; c.stroke(); }
    }
  }
  function tempoFarben(d, pr) {
    const v = d.tempoReihe; if (!v || v.length < 2) return null;
    const ok = v.filter((x) => x > 0.3).sort((a, b) => a - b); if (ok.length < 5) return null;
    const lo = ok[Math.floor(ok.length * 0.1)], hi = ok[Math.floor(ok.length * 0.9)];
    return (i) => { const w = v[Math.min(v.length - 1, Math.round(pr.index[i] * (v.length - 1) / Math.max(1, d.track.length - 1)))]; const t = Math.max(0, Math.min(1, (w - lo) / Math.max(1e-6, hi - lo))); return `hsl(${Math.round(130 * t)},90%,55%)`; };
  }
  function profil(c, d, x, y, w, h, farbe) {
    const r = d.hoeheReihe; if (!r || r.length < 4) return false;
    const s = Math.max(1, Math.floor(r.length / 300)), p = r.filter((_, i) => i % s === 0).filter(Number.isFinite);
    if (p.length < 4) return false;
    const lo = Math.min(...p), hi = Math.max(...p), sp = Math.max(8, hi - lo);
    const py = (v) => y + h - ((v - lo) / sp) * h * 0.85 - h * 0.05;
    c.beginPath(); c.moveTo(x, y + h); p.forEach((v, i) => c.lineTo(x + (i / (p.length - 1)) * w, py(v))); c.lineTo(x + w, y + h); c.closePath();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, farbe + "99"); g.addColorStop(1, farbe + "00"); c.fillStyle = g; c.fill();
    c.beginPath(); p.forEach((v, i) => (i ? c.lineTo(x + (i / (p.length - 1)) * w, py(v)) : c.moveTo(x, py(v)))); c.strokeStyle = farbe; c.lineWidth = 5; c.lineJoin = "round"; c.stroke();
    return true;
  }
  const werteListe = (d, ...ids) => ids.map((i) => d.w[i]).filter(Boolean);

  // ---- Layouts: jeweils für beliebige Höhe
  const ZEICHNEN = {
    garmin(c, W, H, d, bg) {
      hintergrund(c, W, H, bg); abdunkeln(c, W, H, 0, 0.2, 0.4, 0); abdunkeln(c, W, H, 0.4, 1, 0, 0.88);
      logo(c, 60, 80, 84); text(c, "GaWi", 168, 138, 38, { gewicht: 600, schatten: 12 });
      const werte = werteListe(d, "distanz", "zeit", "tempo", "hf", "auf", "kcal").slice(0, 6), zeilen = Math.ceil(werte.length / 2);
      const hoeheBlock = zeilen * (H > 1600 ? 190 : 150), yEnde = H - 90, yStart = yEnde - hoeheBlock;
      const yTitel = yStart - (H > 1600 ? 230 : 190);
      const route = d.track && H > 1600 ? projizieren(d.track, 60, 240, W - 120, yTitel - 300, 0.04) : null;
      if (route) linie(c, route, "#0a84ff", 11, { schatten: 14 });
      c.fillStyle = "#0a84ff"; c.fillRect(60, yTitel, W - 120, 6);
      text(c, `${d.datum} · ${d.uhr} Uhr`, 60, yTitel + 70, 34, { schrift: SCHMAL, farbe: "rgba(255,255,255,.85)" });
      text(c, d.titel, 60, yTitel + 150, 78, { schrift: SCHMAL, gewicht: 700 });
      werte.forEach((w, i) => { const x = 60 + (i % 2) * 500, y = yStart + Math.floor(i / 2) * (hoeheBlock / zeilen) + 90;
        text(c, w.v, x, y, 100, { schrift: SCHMAL, gewicht: 700 }); text(c, w.l.toUpperCase(), x, y + 40, 27, { schrift: SCHMAL, farbe: "rgba(255,255,255,.72)", spur: 2 }); });
    },
    strava(c, W, H, d, bg) {
      hintergrund(c, W, H, bg); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(0, 0, W, H);
      const routeH = H > 1600 ? 700 : 330, route = projizieren(d.track, 120, H > 1600 ? 200 : 100, W - 240, routeH, 0.05);
      if (route) linie(c, route, "#fc4c02", 11, { schatten: 18, punkte: false });
      const werte = werteListe(d, "distanz", "auf", "zeit", "tempo").slice(0, route ? 4 : 4), abstand = H > 1600 ? 150 : 128;
      let y = (route ? (H > 1600 ? 1010 : 500) : H * 0.35);
      werte.forEach((w) => { text(c, w.l, W / 2, y, 32, { ausrichtung: "center", farbe: "rgba(255,255,255,.92)", schatten: 12 }); text(c, w.v + (w.e ? " " + w.e : ""), W / 2, y + 66, 76, { ausrichtung: "center", gewicht: 700, schrift: "Montserrat, " + SCHRIFT, schatten: 14 }); y += abstand; });
    },
    fitness(c, W, H, d) {
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#1c1c1e"; c.beginPath(); c.arc(145, 185, 75, 0, Math.PI * 2); c.fill(); logo(c, 100, 140, 90);
      text(c, d.titel, 250, 175, 58, { gewicht: 700 }); text(c, `${d.datum} · ${d.uhr}`, 250, 228, 34, { farbe: "#8e8e93" });
      const farben = ["#ffd60a", "#30d5e8", "#ff375f", "#ff375f", "#a4ff3b", "#30d5e8"];
      const werte = werteListe(d, "zeit", "distanz", "kcal", "hf", "tempo", "auf").slice(0, 6), zeile = H > 1600 ? 200 : 160;
      werte.forEach((w, i) => { const x = 70 + (i % 2) * 500, y = 380 + Math.floor(i / 2) * zeile;
        text(c, w.l, x, y, 33, { gewicht: 600 }); text(c, w.v, x, y + 80, 96, { gewicht: 600, farbe: farben[i % farben.length] });
        if (w.e) text(c, w.e.toUpperCase(), x + breite(c, w.v, 96, { gewicht: 600 }) + 10, y + 80, 44, { gewicht: 600, farbe: farben[i % farben.length] }); });
      const yp = 380 + Math.ceil(werte.length / 2) * zeile + 20, hp = H - 180 - yp;
      if (d.track && hp > 260) { const r = projizieren(d.track, 70, yp, W - 140, hp - 60, 0.04); linie(c, r, "#a4ff3b", 9, { punkte: false }); }
      else if (hp > 150) profil(c, d, 70, yp, W - 140, hp - 20, "#30d5e8");
    },
    wahoo(c, W, H, d) {
      topo(c, W, H, "#101216", "#1c2128");
      text(c, d.titel.toUpperCase(), 70, 150, 52, { schrift: SCHMAL, kursiv: true, gewicht: 700, farbe: "#e4002b", spur: 3 }); logo(c, W - 160, 90, 90);
      const hStat = H > 1600 ? 560 : 440, rh = H - hStat - 260;
      const r = projizieren(d.track, 60, 220, W - 120, rh, 0.08), farben = r && tempoFarben(d, r);
      if (r) { linie(c, r, "#ff3b30", 15, { farben, schatten: 14, schattenFarbe: "rgba(255,255,255,.18)" }); }
      if (farben) { const y = 220 + rh + 40; text(c, "langsam", 70, y + 12, 26, { farbe: "#9aa0a6" }); const g = c.createLinearGradient(220, 0, 500, 0); [0, 0.5, 1].forEach((p) => g.addColorStop(p, `hsl(${p * 130},90%,55%)`)); c.fillStyle = g; rundRechteck(c, 215, y - 6, 280, 14, 7); c.fill(); text(c, "schnell", 515, y + 12, 26, { farbe: "#9aa0a6" }); }
      const werte = werteListe(d, "distanz", "zeit", "tempo", "hf", "auf", "kcal").slice(0, 6), z = H > 1600 ? 200 : 160;
      werte.forEach((w, i) => { const x = 70 + (i % 3) * 330, y = H - hStat + 100 + Math.floor(i / 3) * z;
        text(c, (w.l + (w.e ? " " + w.e : "")).toUpperCase(), x, y - 60, 25, { schrift: SCHMAL, farbe: "#9aa0a6", spur: 2 }); text(c, w.v, x, y + 30, 90, { schrift: SCHMAL, kursiv: true, gewicht: 800 }); });
    },
    suunto(c, W, H, d) {
      topo(c, W, H, "#f4f1ea", "#d9d2c0");
      text(c, `${d.datum}`.toUpperCase(), 60, 130, 34, { schrift: SCHMAL, farbe: "#666", spur: 3 }); text(c, d.titel, 60, 205, 70, { schrift: SCHMAL, gewicht: 700, farbe: "#111" }); logo(c, W - 156, 90, 96);
      const hp = H > 1600 ? 640 : 520, r = projizieren(d.track, 60, 260, W - 120, H - hp - 300, 0.08); linie(c, r, "#ff3b30", 13, { punkte: true });
      c.fillStyle = "#1c1c1e"; rundRechteck(c, 0, H - hp, W, hp + 60, 44); c.fill();
      profil(c, d, 0, H - hp + 40, W, hp - 330, "#0a84ff");
      const werte = [d.w.distanz, d.w.zeit, d.w.tempo, d.w.auf].filter(Boolean);
      werte.forEach((w, i) => { const x = 60 + i * ((W - 120) / Math.max(1, werte.length)); text(c, w.v, x, H - 130, werte.length > 3 ? 84 : 96, { schrift: SCHMAL, gewicht: 700, farbe: ["#fff", "#30d158", "#0a84ff", "#ff9f0a"][i % 4] }); text(c, (w.e || w.l).toUpperCase(), x, H - 82, 27, { schrift: SCHMAL, farbe: "#8e8e93", spur: 2 }); });
    },
    glas(c, W, H, d, bg) {
      hintergrund(c, W, H, bg); abdunkeln(c, W, H, 0, 1, 0.15, 0.3);
      const hk = H > 1600 ? 720 : 560, y0 = H - hk - 60;
      c.fillStyle = "rgba(18,20,26,.66)"; rundRechteck(c, 40, y0, W - 80, hk, 48); c.fill();
      c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 2; c.stroke();
      text(c, `${d.datum} · ${d.typ}`, 90, y0 + 90, 30, { farbe: "rgba(255,255,255,.8)" }); text(c, d.titel, 90, y0 + 160, 56, { gewicht: 700 }); logo(c, W - 190, y0 + 50, 100);
      const r = projizieren(d.track, 80, y0 + 200, 300, hk - 260, 0.06); linie(c, r, "#fff", 8, { punkte: false });
      const werte = werteListe(d, "distanz", "zeit", "tempo", "hf").slice(0, 4), x0 = r ? 440 : 90;
      werte.forEach((w, i) => { const x = x0 + (i % 2) * 300, y = y0 + 280 + Math.floor(i / 2) * 150; text(c, w.l, x, y, 26, { farbe: "rgba(255,255,255,.75)" }); text(c, w.v + (w.e ? " " + w.e : ""), x, y + 62, 50, { gewicht: 700 }); });
    },
  };

  function zeichnen(canvas, layout, groesse, daten, bg) {
    const [W, H] = GROESSEN[groesse]; canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d"); c.clearRect(0, 0, W, H);
    const F = 210, HI = H - F, tmp = document.createElement("canvas"); tmp.width = W; tmp.height = HI;
    ZEICHNEN[layout](tmp.getContext("2d"), W, HI, daten, bg);
    c.drawImage(tmp, 0, 0);
    const g = c.createLinearGradient(0, HI, 0, H); g.addColorStop(0, "#0b0b0f"); g.addColorStop(1, "#000"); c.fillStyle = g; c.fillRect(0, HI, W, F);
    const s = 76, fy = HI + 26;
    logo(c, W / 2 - s / 2, fy, s);
    text(c, "Geteilt mit GaWi by N.Setz", W / 2, fy + s + 48, 32, { ausrichtung: "center", gewicht: 600, farbe: "#fff" });
  }

  function oeffnen(daten) {
    const bg = { id: "sonne", bild: null };
    let layout = "garmin", groesse = "story";
    const el = (tag, attr, ...kinder) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attr || {})) { if (k === "onclick") e.onclick = v; else if (k === "style") Object.assign(e.style, v); else if (v != null) e.setAttribute(k, v); } e.append(...kinder.flat().filter((x) => x != null)); return e; };
    const dlg = el("dialog", { class: "blatt-dialog teilen-dialog", "aria-label": "Aktivität teilen" });
    const gross = el("canvas", { class: "teilen-gross", "aria-label": "Vorschau" });
    const leiste = el("div", { class: "teilen-leiste" });
    const status = el("p", { class: "e-klein" });
    const datei = el("input", { type: "file", accept: "image/*", hidden: "" });
    const zu = () => dlg.close();
    const gruppe = (items, aktiv, wahl) => el("div", { class: "chips", role: "group" }, items.map(([id, name]) => el("button", { type: "button", "aria-pressed": String(aktiv() === id), onclick: () => { wahl(id); neu(); } }, name)));
    const dateiName = () => `gawi-${daten.datumIso || "aktivitaet"}-${layout}-${groesse}.png`;
    const png = () => new Promise((ok) => { const k = document.createElement("canvas"); zeichnen(k, layout, groesse, daten, bg); k.toBlob(ok, "image/png"); });
    async function herunter() { const b = await png(); const a = el("a", { href: URL.createObjectURL(b), download: dateiName() }); document.body.append(a); a.click(); a.remove(); status.textContent = "Bild gespeichert."; }
    async function teilen() {
      const b = await png(), f = new File([b], dateiName(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: daten.titel }); } catch { /* abgebrochen */ } } else herunter();
    }
    datei.addEventListener("change", () => { const f = datei.files && datei.files[0]; if (!f) return; const i = new Image(); i.onload = () => { bg.bild = i; neu(); }; i.src = URL.createObjectURL(f); });
    const kopf = el("div", { class: "dialog-kopf" }, el("h2", null, "Teilen"), el("button", { class: "dialog-zzu dialog-zu", type: "button", "aria-label": "Schließen", onclick: zu }, "×"));
    const inhalt = el("div", { class: "dialog-inhalt" });
    function neu() {
      const [W, H] = GROESSEN[groesse];
      zeichnen(gross, layout, groesse, daten, bg);
      gross.style.aspectRatio = `${W} / ${H}`;
      gross.style.maxHeight = "52vh";
      inhalt.replaceChildren(kopf, el("div", { class: "teilen-vorschau" }, gross),
        el("div", { class: "teilen-reihe" }, el("b", null, "Größe"), gruppe(Object.entries(GROESSEN).map(([id, g]) => [id, `${g[2]} ${g[0]} x ${g[1]}`]), () => groesse, (v) => { groesse = v; })),
        el("div", { class: "teilen-reihe" }, el("b", null, "Vorlage"), gruppe(LAYOUTS, () => layout, (v) => { layout = v; })),
        el("div", { class: "teilen-reihe" }, el("b", null, "Hintergrund (Garmin, Strava, Glas)"), el("div", { class: "chips" },
          ...HINTERGRUENDE.map(([id, name]) => el("button", { type: "button", "aria-pressed": String(!bg.bild && bg.id === id), onclick: () => { bg.id = id; bg.bild = null; neu(); } }, name)),
          el("button", { type: "button", "aria-pressed": String(!!bg.bild), onclick: () => datei.click() }, "Eigenes Foto …")), datei),
        el("div", { class: "knopf-zeile" }, el("button", { class: "knopf", type: "button", onclick: herunter }, "Herunterladen"), el("button", { class: "knopf zweit", type: "button", onclick: teilen }, "Teilen")), status);
    }
    dlg.append(inhalt); dlg.addEventListener("click", (e) => { if (e.target === dlg) zu(); }); dlg.addEventListener("close", () => dlg.remove());
    document.body.append(dlg); dlg.showModal(); (logoBild.complete ? Promise.resolve() : new Promise((r) => { logoBild.onload = r; logoBild.onerror = r; })).then(neu);
    neu();
  }
  window.GaWiTeilen = { oeffnen, zeichnen, LAYOUTS };
})();
