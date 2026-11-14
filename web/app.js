/* Gesundheit - Web-App
   Liest die verschlüsselten Daten (d/*.enc) und zeigt sie an. Entschlüsselt wird nur im Browser. */
(() => {
"use strict";

const APP_VERSION = "1.3.1";
const SCHRIFT = '"Atkinson Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const S = { schluessel: "gesundheit.schluessel", zeitraum: "gesundheit.zeitraum", darstellung: "gesundheit.darstellung" };
const BEWEGUNG = !matchMedia("(prefers-reduced-motion: reduce)").matches;

const speicher = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ohne Speicher */ } },
};

// Fehler der App auf diesem Gerät merken – für das Fehlerprotokoll (ohne Schlüssel und Zugangsdaten)
const FEHLER_S = "gesundheit.fehler";
function fehlerText(x) {
  if (x && x.stack) return String(x.stack).split("\n").slice(0, 3).map((z) => z.trim()).join(" | ");
  return x && x.message ? x.message : String(x);
}
function fehlerMerken(text) {
  try {
    const liste = JSON.parse(speicher.get(FEHLER_S) || "[]");
    liste.push([Date.now(), String(text).replace(/k=[A-Za-z0-9_-]{20,}/g, "k=…").slice(0, 600)]);
    speicher.set(FEHLER_S, JSON.stringify(liste.slice(-80)));
  } catch { /* ohne Speicher */ }
}
window.addEventListener("error", (e) => fehlerMerken(`${e.message || fehlerText(e.error)}${e.filename ? ` (${String(e.filename).split("/").pop()}:${e.lineno || "?"})` : ""}`));
window.addEventListener("unhandledrejection", (e) => fehlerMerken(`Unbehandelt: ${fehlerText(e.reason)}`));
const konsolenFehler = console.error.bind(console);
console.error = (...teile) => { try { fehlerMerken(teile.map(fehlerText).join(" ")); } catch { /* egal */ } konsolenFehler(...teile); };

// ======================================================================
// DOM-Hilfen
// ======================================================================
function h(tag, attrs, ...kinder) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kinder.flat(3)) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kinder) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kinder.flat()) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
function esc(t) { return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

const ICON = {
  essen: '<path d="M7 3v8M4.5 3v5.2a2.5 2.5 0 0 0 5 0V3M7 11v10M17.5 21V3c-2.2 1.2-3.5 3.8-3.5 7v3h3.5"/>',
  heute: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/>',
  koerper: '<circle cx="12" cy="4.6" r="2.3"/><path d="M5.2 9.4 12 8l6.8 1.4M12 8v6.6M12 14.6 9 21.2M12 14.6l3 6.6"/>',
  herz: '<path d="M12 20.4s-7.6-4.6-7.6-10.3A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.6c0 5.7-7.6 10.3-7.6 10.3Z"/>',
  schlaf: '<path d="M19.6 14.7A8 8 0 1 1 9.3 4.4a6.4 6.4 0 0 0 10.3 10.3Z"/>',
  sport: '<circle cx="12" cy="13.6" r="7.2"/><path d="M12 13.6V9.7M9.8 2.8h4.4M12 2.8v3.6M18.3 7.3l1.4-1.4"/>',
  mehr: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
  tag: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.6h17M8 3v4M16 3v4"/>',
  werte: '<path d="M4 19.5h16M7 16v-6M12 16V6M17 16v-4"/>',
  status: '<circle cx="12" cy="12" r="8.6"/><path d="m8.3 12.3 2.4 2.4 5-5.2"/>',
  zurueck: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  vor: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  unten: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  zu: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.7v.2"/>',
  warnung: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.4M12 16.9v.2"/>',
  kamera: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4Z"/><circle cx="12" cy="13.4" r="3.4"/>',
  ekg: '<path d="M2.5 12h4.2l1.8-4.6 3.2 9.6 2.4-7 1.6 2h5.8"/>',
  lauf: '<circle cx="14.6" cy="4.4" r="1.9"/><path d="m10 21 2.4-5.4 2.9 2.4V22M7.6 11.4l2.8-3.2 4.1.5 2.3 3 2.6.6M12.4 15.6l1.3-6.4M8.6 13.8l-3.2.7"/>',
  fahrrad: '<circle cx="6" cy="16" r="3.8"/><circle cx="18" cy="16" r="3.8"/><path d="m6 16 4.2-7.5h5.3M18 16l-3.6-7.5M10.2 8.5 12.5 16H18M13.3 6H16"/>',
  kraft: '<path d="M3 9.5v5M21 9.5v5M5.8 7v10M18.2 7v10M5.8 12h12.4"/>',
  wandern: '<path d="m2.5 19.5 6.2-9 3.6 4.8 2.5-3.3 6.7 7.5Z"/>',
  schwimmen: '<path d="M2.5 16c2 1.4 3.8 1.4 5.8 0s3.8-1.4 5.8 0 3.8 1.4 5.8 0M2.5 20c2 1.4 3.8 1.4 5.8 0s3.8-1.4 5.8 0 3.8 1.4 5.8 0M6 12.5l4.5-4 3.5 3"/><circle cx="16" cy="7" r="2"/>',
  gehen: '<circle cx="13" cy="4.4" r="1.9"/><path d="m10.4 21 1.7-6.2 2.6 2.4V21M9.2 12.4 11 8.2l2.6.2 1.6 3.5 2 1M12 14.8l1.2-6.4"/>',
  yoga: '<circle cx="12" cy="5" r="2"/><path d="M4.5 18.5C7 17.5 9.5 17 12 17s5 .5 7.5 1.5M12 7.5v6M7 10.5l5 2 5-2"/>',
  sonst: '<path d="M2.5 12h4l2-5 3.5 10 2.5-7 1.5 2h5.5"/>',
  sync: '<path d="M19.4 9.2A7.6 7.6 0 0 0 5.3 7.6M4.6 14.8a7.6 7.6 0 0 0 14.1 1.6"/><path d="M5 3.6v4.3h4.3M19 20.4v-4.3h-4.3"/>',
  haken: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>',
  bericht: '<path d="M6.5 2.8h7.6l4.4 4.4v14H6.5Z"/><path d="M14 2.8v4.6h4.5M9.4 12.4h6.2M9.4 15.6h6.2M9.4 18.8h3.8"/>',
  marke: '<rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor" stroke="none"/><path d="M5 12.6h3l1.5-3.6 2.6 7.4 2-5.2 1.1 1.4H19" stroke="var(--rose)" stroke-width="1.9"/>',
  achtung: '<circle cx="12" cy="12" r="9.8" fill="currentColor" stroke="none"/><path d="M12 6.8v6.8" stroke="#fff" stroke-width="2.6"/><circle cx="12" cy="17.2" r="1.5" fill="#fff" stroke="none"/>',
  hinweise: '<path d="M9.3 18.3h5.4M10.3 21.2h3.4"/><path d="M12 2.8a6.2 6.2 0 0 0-3.8 11.1c.8.6 1.2 1.5 1.2 2.4v.4h5.2v-.4c0-.9.4-1.8 1.2-2.4A6.2 6.2 0 0 0 12 2.8Z"/>',
  vollbild: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  verkleinern: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  speichern: '<path d="M12 3.6v11.2M7.4 10.4l4.6 4.6 4.6-4.6M4.6 19.8h14.8"/>',
  teilen: '<circle cx="6.4" cy="12" r="2.4"/><circle cx="17.6" cy="6" r="2.4"/><circle cx="17.6" cy="18" r="2.4"/><path d="m8.5 10.9 7-3.8M8.5 13.1l7 3.8"/>',
};
function icon(name, groesse = 24) {
  const e = document.createElementNS(SVGNS, "svg");
  e.setAttribute("viewBox", "0 0 24 24");
  e.setAttribute("width", groesse);
  e.setAttribute("height", groesse);
  e.setAttribute("fill", "none");
  e.setAttribute("stroke", "currentColor");
  e.setAttribute("stroke-width", "1.8");
  e.setAttribute("stroke-linecap", "round");
  e.setAttribute("stroke-linejoin", "round");
  e.setAttribute("aria-hidden", "true");
  e.innerHTML = ICON[name] || ICON.sonst;
  return e;
}

// ======================================================================
// Zahlen, Daten und Zeiten (deutsch)
// ======================================================================
const ZF = new Map();
function zahl(v, stellen = 0) {
  if (v == null || !Number.isFinite(v)) return "–";
  let f = ZF.get(stellen);
  if (!f) { f = new Intl.NumberFormat("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen }); ZF.set(stellen, f); }
  return f.format(v);
}
function vorzeichen(v, stellen = 0) { return (v > 0 ? "+" : v < 0 ? "−" : "±") + zahl(Math.abs(v), stellen); }
function zweistellig(n) { return String(n).padStart(2, "0"); }
function isoDatum(d) { return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`; }
function heuteIso() { return isoDatum(new Date()); }
function isoMinus(tage, basis = new Date()) { const d = new Date(basis); d.setDate(d.getDate() - tage); return isoDatum(d); }
function tagMs(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); }
function isoAusMs(ms) { return isoDatum(new Date(ms)); }
function isoPlus(iso, tage) { const d = new Date(tagMs(iso)); d.setDate(d.getDate() + tage); return isoDatum(d); }
const DF = {
  lang: new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }),
  langJahr: new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  kurz: new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }),
  kurzJahr: new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }),
  wochentag: new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" }),
  monat: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }),
  monatKurz: new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" }),
  zeit: new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }),
  datumZeit: new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
};
function datum(x, art = "kurz") {
  const d = typeof x === "string" ? new Date(tagMs(x)) : new Date(x);
  if (art === "kurz" && d.getFullYear() !== new Date().getFullYear()) return DF.kurzJahr.format(d);
  return DF[art].format(d);
}
function uhr(ms) { return DF.zeit.format(new Date(ms)); }
const WOCHENTAG_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function kurzZeit(ms) { const d = new Date(ms); return `${WOCHENTAG_KURZ[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}., ${uhr(ms)}`; }
function dauer(sek, lang = true) {
  if (sek == null || !Number.isFinite(sek)) return "–";
  const min = Math.round(sek / 60);
  const std = Math.floor(min / 60);
  const rest = min % 60;
  if (!lang) return `${std}:${zweistellig(rest)}`;
  if (std === 0) return `${rest} Min.`;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}
function zeitText(sek) {
  if (sek == null || !Number.isFinite(sek)) return "–";
  const s_ = Math.round(sek);
  const std = Math.floor(s_ / 3600), min = Math.floor((s_ % 3600) / 60), sk = s_ % 60;
  return std ? `${std}:${zweistellig(min)}:${zweistellig(sk)}` : `${min}:${zweistellig(sk)}`;
}
const RTF = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
const RTF_KURZ = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto", style: "short" });
/** „vor 23 Stunden“, mit kurz=true „vor 23 Std.“ für schmale Handys */
function vorZeit(iso, kurz = false) {
  if (!iso) return "–";
  const f = kurz ? RTF_KURZ : RTF;
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const a = Math.abs(diff);
  if (a < 90) return "gerade eben";
  if (a < 3600) return f.format(Math.round(diff / 60), "minute");
  if (a < 86400) return f.format(Math.round(diff / 3600), "hour");
  return f.format(Math.round(diff / 86400), "day");
}
function tempoText(mps, laufen) {
  if (!mps || !Number.isFinite(mps)) return "–";
  if (laufen) { const s_ = 1000 / mps; return `${Math.floor(s_ / 60)}:${zweistellig(Math.round(s_ % 60) % 60)}`; }
  return zahl(mps * 3.6, 1);
}
function isoWoche(ms) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  const kw = 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return [d.getFullYear(), kw];
}
function mittel(werte) { const v = werte.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

// ======================================================================
// Schlüssel und Entschlüsselung (AES-256-GCM, gzip)
// ======================================================================
let AES = null;
let SCHLUESSEL_ROH = null;
function b64u(text) {
  const t = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function schluesselAktivieren(text) {
  const roh = b64u(String(text).trim());
  if (roh.length !== 32) throw new Error("falsche Länge");
  SCHLUESSEL_ROH = roh;
  AES = await crypto.subtle.importKey("raw", roh, "AES-GCM", false, ["decrypt", "encrypt"]);
}
/** Verschlüsselt ein Objekt im selben Format wie der Datensammler (GSD1, AES-256-GCM, gzip). */
async function verschluesselnPaket(pfad, objekt) {
  const strom = new Blob([JSON.stringify(objekt)]).stream().pipeThrough(new CompressionStream("gzip"));
  const klar = new Uint8Array(await new Response(strom).arrayBuffer());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const geheim = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(pfad) }, AES, klar));
  const aus = new Uint8Array(16 + geheim.length);
  aus.set([71, 83, 68, 49], 0); aus.set(iv, 4); aus.set(geheim, 16);
  return aus;
}
function b64d(puffer) {
  let bin = "";
  const b = puffer instanceof Uint8Array ? puffer : new Uint8Array(puffer);
  for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(bin);
}
async function entschluesseln(pfad, puffer) {
  const b = new Uint8Array(puffer);
  if (b[0] !== 71 || b[1] !== 83 || b[2] !== 68 || b[3] !== 49) throw new Error("unbekanntes Format");
  const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(4, 16), additionalData: new TextEncoder().encode(pfad) }, AES, b.slice(16));
  const strom = new Blob([klar]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(strom).text());
}
class SchluesselFalsch extends Error {}

// ======================================================================
// Daten
// ======================================================================
const Daten = {
  index: null,
  cache: new Map(),
  async ladeIndex() {
    let r;
    try { r = await fetch("d/index.enc?t=" + Date.now(), { cache: "no-store" }); } catch (e) { throw new Error("offline"); }
    if (r.status === 404) { this.index = null; return null; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const puffer = await r.arrayBuffer();
    try { this.index = await entschluesseln("d/index.enc", puffer); }
    catch (e) { if (e && e.name === "OperationError") throw new SchluesselFalsch(); throw e; }
    return this.index;
  },
  hat(pfad) { return Boolean(this.index && this.index.dateien && this.index.dateien[pfad]); },
  async datei(pfad, standard = null) {
    if (!this.hat(pfad)) return standard;
    if (!this.cache.has(pfad)) {
      const v = this.index.dateien[pfad];
      const p = (async () => {
        const r = await fetch(`${pfad}?v=${v}`);
        if (!r.ok) throw new Error(`${pfad}: HTTP ${r.status}`);
        return entschluesseln(pfad, await r.arrayBuffer());
      })();
      this.cache.set(pfad, p);
      p.catch(() => this.cache.delete(pfad));
    }
    return this.cache.get(pfad);
  },
  async katalog() { return (await this.datei("d/katalog.enc")) || { werte: {}, texte: {}, jahre: [] }; },
  /** Profilbild und Name aus der Cloud holen (d/profil.enc) und auf dieses Gerät übertragen, wenn es dort neuer ist. */
  async profilAbholen() {
    let r;
    try { r = await fetch("d/profil.enc?t=" + Date.now(), { cache: "no-store" }); } catch { return; }
    if (!r.ok) return; // noch nie übertragen oder offline
    let p;
    try { p = await entschluesseln("d/profil.enc", await r.arrayBuffer()); } catch { return; }
    const lokalZeit = Number(speicher.get("gawi.profilbild.zeit")) || 0;
    if (!p || !p.zeit || p.zeit <= lokalZeit) return;
    speicher.set("gawi.profilbild.zeit", String(p.zeit));
    if (p.bild) speicher.set("gawi.profilbild", p.bild); else speicher.set("gawi.profilbild", null);
    if (p.name) speicher.set("gawi.name", p.name);
    document.dispatchEvent(new CustomEvent("gawi:profil"));
  },
  async jahr(j) { return (await this.datei(`d/tage/${j}.enc`)) || { werte: {}, texte: {} }; },
  async reihe(metrik, von = null, bis = null, art = "werte") {
    const kat = await this.katalog();
    const info = (kat[art] || {})[metrik];
    if (!info) return [];
    const [, a, b] = info;
    const ab = von && von > a ? von : a;
    const zu = bis && bis < b ? bis : b;
    if (ab > zu) return [];
    const jahre = (kat.jahre || []).filter((j) => j >= +ab.slice(0, 4) && j <= +zu.slice(0, 4));
    const teile = await Promise.all(jahre.map((j) => this.jahr(j)));
    const out = [];
    for (const t of teile) for (const p of ((t[art] || {})[metrik] || [])) if (p[0] >= ab && p[0] <= zu) out.push(p);
    return out;
  },
  texte(metrik, von, bis) { return this.reihe(metrik, von, bis, "texte"); },
  async tageswerte(iso) {
    const t = await this.jahr(+iso.slice(0, 4));
    const out = {};
    for (const [m, paare] of Object.entries(t.werte || {})) { const p = paare.find((x) => x[0] === iso); if (p) out[m] = p[1]; }
    const texte = {};
    for (const [m, paare] of Object.entries(t.texte || {})) { const p = paare.find((x) => x[0] === iso); if (p) texte[m] = p[1]; }
    return { werte: out, texte };
  },
  async withings() {
    const w = (await this.datei("d/withings.enc")) || { messungen: [], modelle: [] };
    if (!w._typ) {
      w._typ = new Map();
      w._grp = new Map();
      for (const r of w.messungen) {
        // Nur die Werte je Körperbereich brauchen eine Ortsangabe. Kommt ein Wert für den ganzen Körper
        // mit Ortsangabe (etwa „ganzer Körper“ oder „Rumpf“ beim Viszeralfett), zählt er wie ohne.
        if (r[3] !== -1 && !W_JE_BEREICH.has(r[1])) r[3] = -1;
        const k = `${r[1]}|${r[3]}`;
        if (!w._typ.has(k)) w._typ.set(k, []);
        w._typ.get(k).push(r);
        if (!w._grp.has(r[4])) w._grp.set(r[4], []);
        w._grp.get(r[4]).push(r);
      }
    }
    return w;
  },
  async aktivitaeten() { return ((await this.datei("d/aktivitaeten.enc")) || {}).liste || []; },
  async ekg() { return ((await this.datei("d/ekg.enc")) || {}).liste || []; },
  async info(quelle) { return (await this.datei(`d/${quelle}_info.enc`)) || {}; },
  async tag(iso) { return this.datei(`d/tag/${iso}.enc`); },
};

// ---- Withings-Messwerte
const W_JE_BEREICH = new Set([173, 174, 175]);
function wReihe(w, typ, pos = -1) {
  return (w._typ.get(`${typ}|${pos}`) || []).map((r) => [r[0] * 1000, r[2], r[4]]).sort((a, b) => a[0] - b[0]);
}
function wTaeglich(reihe) {
  const m = new Map();
  for (const [ts, v] of reihe) m.set(isoAusMs(ts), v);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
function wLetzte(w, typ, pos = -1) { const r = wReihe(w, typ, pos); return r.length ? r[r.length - 1] : null; }
function wGruppe(w, grpid) {
  const out = {};
  for (const r of w._grp.get(grpid) || []) out[r[3] === -1 ? r[1] : `${r[1]}.${r[3]}`] = r[2];
  return out;
}
function blutdruckMessungen(w) {
  const liste = [];
  for (const [grpid, zeilen] of w._grp) {
    const g = {};
    let ts = 0;
    for (const r of zeilen) { g[r[1]] = r[2]; ts = r[0]; }
    if (g[10] && g[9]) liste.push({ ts: ts * 1000, sys: g[10], dia: g[9], puls: g[11] ?? null, grpid });
  }
  return liste.sort((a, b) => a.ts - b.ts);
}
function istMorgens(ms) { const st = new Date(ms).getHours(); return st >= 4 && st < 14; }

const W_TYPEN = {
  1: ["Gewicht", "kg", 1], 4: ["Größe", "m", 2], 5: ["Magermasse", "kg", 1], 6: ["Körperfettanteil", "%", 1],
  8: ["Fettmasse", "kg", 1], 9: ["Blutdruck diastolisch", "mmHg", 0], 10: ["Blutdruck systolisch", "mmHg", 0], 11: ["Puls", "bpm", 0],
  12: ["Temperatur", "°C", 1], 54: ["SpO₂", "%", 0], 71: ["Körpertemperatur", "°C", 1], 73: ["Hauttemperatur", "°C", 1],
  76: ["Muskelmasse", "kg", 1], 77: ["Körperwasser", "kg", 1], 88: ["Knochenmasse", "kg", 2], 91: ["Pulswellengeschwindigkeit", "m/s", 1],
  123: ["VO₂max", "ml/kg/min", 1], 130: ["Vorhofflimmern (EKG)", "", 0], 135: ["QRS-Dauer", "ms", 0], 136: ["PR-Intervall", "ms", 0],
  137: ["QT-Intervall", "ms", 0], 138: ["QTc-Intervall", "ms", 0], 139: ["Vorhofflimmern (PPG)", "", 0], 140: ["Gefäßalter", "Jahre", 0],
  155: ["Gefäßalter", "Jahre", 0], 158: ["Nervengesundheit linker Fuß", "", 0], 159: ["Nervengesundheit rechter Fuß", "", 0],
  167: ["Nervengesundheit Füße", "", 0], 168: ["Extrazelluläres Wasser", "kg", 1], 169: ["Intrazelluläres Wasser", "kg", 1],
  170: ["Viszeralfett", "", 1], 173: ["Fettfreie Masse", "kg", 2], 174: ["Fettmasse", "kg", 2], 175: ["Muskelmasse", "kg", 2],
  196: ["Elektrodermale Aktivität Füße", "", 0], 197: ["Elektrodermale Aktivität links", "", 0], 198: ["Elektrodermale Aktivität rechts", "", 0],
  226: ["Grundumsatz", "kcal", 0], 227: ["Stoffwechselalter", "Jahre", 0], 229: ["Elektrochemische Hautleitfähigkeit", "", 0],
};
/** Kleinste Achsenspanne je Körperwert, damit Messrauschen der Waage nicht wie eine Veränderung aussieht */
const KOERPER_SPANNE = { 6: 4, 8: 3, 5: 3, 76: 3, 77: 3, 88: 0.5, 170: 3, 226: 150, 227: 6, 168: 2, 169: 2 };
const POSITIONEN = { 0: "rechtes Handgelenk", 1: "linkes Handgelenk", 2: "rechter Arm", 3: "linker Arm", 4: "rechter Fuß", 5: "linker Fuß",
  8: "linke Körperhälfte", 9: "rechte Körperhälfte", 10: "linkes Bein", 11: "rechtes Bein", 12: "Rumpf", 13: "linke Hand", 14: "rechte Hand" };
function wName(typ, pos = -1) {
  const t = W_TYPEN[typ];
  const name = t ? t[0] : `Messtyp ${typ}`;
  return pos >= 0 ? `${name} – ${POSITIONEN[pos] || "Position " + pos}` : name;
}

// ---- Tageswerte: Bezeichnungen und kuratierte Kennzahlen
const K = {
  schritte: ["Schritte", "", 0, ["g.tag.totalSteps", "g.schritte.totalSteps", "w.aktivitaet.steps"]],
  schrittziel: ["Schrittziel", "", 0, ["g.tag.dailyStepGoal", "g.schritte.stepGoal"]],
  strecke: ["Strecke", "km", 1, [["g.tag.totalDistanceMeters", (v) => v / 1000], ["g.schritte.totalDistance", (v) => v / 1000], ["w.aktivitaet.distance", (v) => v / 1000]]],
  ruhepuls: ["Ruhepuls", "bpm", 0, ["g.tag.restingHeartRate", "g.herz.restingHR", "g.schlaf.restingHeartRate"]],
  stress: ["Stress im Tagesmittel", "", 0, ["g.tag.averageStressLevel", "g.stress.overallStressLevel"]],
  bb_hoch: ["Body Battery Höchstwert", "", 0, ["g.tag.bodyBatteryHighestValue", "g.bodybattery.highBB"]],
  bb_tief: ["Body Battery Tiefstwert", "", 0, ["g.tag.bodyBatteryLowestValue", "g.bodybattery.lowBB"]],
  bb_aktuell: ["Body Battery zuletzt", "", 0, ["g.tag.bodyBatteryMostRecentValue"]],
  etagen: ["Etagen hinauf", "", 0, ["g.tag.floorsAscended", "g.etagen.floorsAscended"]],
  im_mod: ["Intensitätsminuten mäßig", "Min.", 0, ["g.tag.moderateIntensityMinutes", "g.intensitaet.moderateValue"]],
  im_int: ["Intensitätsminuten hoch", "Min.", 0, ["g.tag.vigorousIntensityMinutes", "g.intensitaet.vigorousValue"]],
  aktivkcal: ["Aktivkalorien", "kcal", 0, ["g.tag.activeKilocalories", "g.kalorien.active", "w.aktivitaet.calories"]],
  schlaf_dauer: ["Schlafdauer", "Std.", 1, [["g.schlaf.totalSleepTimeInSeconds", (v) => v / 3600], ["w.schlaf.total_sleep_time", (v) => v / 3600], ["g.tag.sleepingSeconds", (v) => v / 3600]]],
  schlaf_tief: ["Tiefschlaf", "Std.", 1, [["g.schlaf.deepTime", (v) => v / 3600], ["w.schlaf.deepsleepduration", (v) => v / 3600]]],
  schlaf_leicht: ["Leichtschlaf", "Std.", 1, [["g.schlaf.lightTime", (v) => v / 3600], ["w.schlaf.lightsleepduration", (v) => v / 3600]]],
  schlaf_rem: ["REM-Schlaf", "Std.", 1, [["g.schlaf.remTime", (v) => v / 3600], ["w.schlaf.remsleepduration", (v) => v / 3600]]],
  schlaf_wach: ["Wach", "Std.", 1, [["g.schlaf.awakeTime", (v) => v / 3600], ["w.schlaf.wakeupduration", (v) => v / 3600]]],
  schlaf_score: ["Schlafscore", "", 0, ["g.schlaf.sleepScore", "w.schlaf.sleep_score"]],
  schlaf_bedarf: ["Schlafbedarf", "Std.", 1, [["g.schlaf.sleepNeed", (v) => v / 60]]],
  schlaf_atem: ["Atemfrequenz im Schlaf", "/min", 1, ["g.schlaf.respiration", "g.atmung.avgSleepRespiration", "w.schlaf.rr_average"]],
  schlaf_spo2: ["SpO₂ im Schlaf", "%", 0, ["g.schlaf.spO2"]],
  schlaf_haut: ["Hauttemperatur (Abweichung)", "°C", 1, ["g.schlaf.skinTempC"]],
  schlaf_bb: ["Body Battery im Schlaf aufgeladen", "", 0, ["g.schlaf.bodyBatteryChange"]],
  hrv: ["HRV letzte Nacht", "ms", 0, ["g.hrv.lastNightAvg"]],
  hrv_woche: ["HRV 7-Tage-Mittel", "ms", 0, ["g.hrv.weeklyAvg"]],
  hrv_unten: ["HRV-Normalbereich unten", "ms", 0, ["g.hrv.baseline.balancedLow"]],
  hrv_oben: ["HRV-Normalbereich oben", "ms", 0, ["g.hrv.baseline.balancedUpper"]],
  bereitschaft: ["Trainingsbereitschaft", "", 0, ["g.bereitschaft.score"]],
  vo2lauf: ["VO₂max Laufen", "", 1, ["g.vo2max.generic.vo2MaxPreciseValue", "g.vo2max.generic.vo2MaxValue"]],
  vo2rad: ["VO₂max Radfahren", "", 1, ["g.vo2max.cycling.vo2MaxPreciseValue", "g.vo2max.cycling.vo2MaxValue"]],
  fitnessalter: ["Fitnessalter", "Jahre", 1, ["g.fitnessalter.fitnessAge"]],
  last_akut: ["Akute Last", "", 0, ["g.trainingsstatus.acuteTrainingLoadDTO.dailyTrainingLoadAcute"]],
  last_chronisch: ["Chronische Last", "", 0, ["g.trainingsstatus.acuteTrainingLoadDTO.dailyTrainingLoadChronic"]],
  wochenlast: ["Wochenlast", "", 0, ["g.trainingsstatus.weeklyTrainingLoad"]],
  p5k: ["5 km", "", 0, ["g.wettkampf.time5K"]], p10k: ["10 km", "", 0, ["g.wettkampf.time10K"]],
  phm: ["Halbmarathon", "", 0, ["g.wettkampf.timeHalfMarathon"]], pm: ["Marathon", "", 0, ["g.wettkampf.timeMarathon"]],
  ausdauer: ["Ausdauerwert", "", 0, ["g.ausdauer.overallScore", "g.ausdauer.groupAverage"]],
  huegel: ["Hill Score", "", 0, ["g.huegel.overallScore"]],
  trinken: ["Getrunken", "ml", 0, ["g.trinken.valueInML"]],
  atem_wach: ["Atemfrequenz wach", "/min", 1, ["g.tag.avgWakingRespirationValue", "g.atmung.avgWakingRespiration"]],
  spo2: ["SpO₂ im Tagesmittel", "%", 0, ["g.tag.averageSpo2"]],
};
async function kennzahl(id, von = null, bis = null) {
  const def = K[id];
  if (!def) return [];
  const nachDatum = new Map();
  for (const q of def[3]) {
    const [m, f] = Array.isArray(q) ? q : [q, null];
    for (const [d, v] of await Daten.reihe(m, von, bis)) if (!nachDatum.has(d)) nachDatum.set(d, f ? f(v) : v);
  }
  return [...nachDatum.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
async function kennzahlen(ids, von, bis) {
  const werte = await Promise.all(ids.map((id) => kennzahl(id, von, bis)));
  return Object.fromEntries(ids.map((id, i) => [id, werte[i]]));
}
const letzter = (r) => (r && r.length ? r[r.length - 1] : null);
function amTag(r, iso) { const p = (r || []).find((x) => x[0] === iso); return p ? p[1] : null; }
function vorTagen(r, tage, basis) {
  // Wert, der am naechsten an "basis - tage" liegt (hoechstens 7 Tage daneben)
  if (!r || !r.length) return null;
  const ziel = typeof basis === "number" ? basis - tage * 86400000 : tagMs(isoMinus(tage));
  let best = null, abstand = Infinity;
  for (const p of r) {
    const t = typeof p[0] === "number" ? p[0] : tagMs(p[0]);
    const a = Math.abs(t - ziel);
    if (a < abstand) { abstand = a; best = p; }
  }
  return abstand <= 7 * 86400000 ? best[1] : null;
}

const TEXTE = {
  BALANCED: "ausgeglichen", UNBALANCED: "unausgeglichen", LOW: "niedrig", POOR: "schlecht", NONE: "keine Angabe",
  HIGH: "hoch", MODERATE: "mäßig", PRIME: "optimal", EXCELLENT: "ausgezeichnet", GOOD: "gut", FAIR: "mittel",
  CALM: "ruhig", STRESSFUL: "stressig", VERY_STRESSFUL: "sehr stressig", OPTIMAL: "optimal", VERY_HIGH: "sehr hoch",
  NO_STATUS: "kein Status",
};
function textDeutsch(t) {
  if (!t) return "";
  if (TEXTE[t]) return TEXTE[t];
  const stamm = String(t).replace(/_\d+$/, "");
  const status = { PRODUCTIVE: "produktiv", MAINTAINING: "Leistung halten", RECOVERY: "Erholung", UNPRODUCTIVE: "unproduktiv",
    DETRAINING: "Leistungsabbau", OVERREACHING: "Überlastung", PEAKING: "Höchstform", STRAINED: "überfordert",
    HRV_BALANCED: "ausgeglichen", HRV_UNBALANCED: "unausgeglichen", HRV_LOW: "niedrig", HRV_POOR: "schlecht" }[stamm];
  return status || String(t).toLowerCase().replace(/_/g, " ");
}

// Bezeichnungen fuer "Alle Werte"
const BEREICH_NAMEN = {
  "g.tag": "Garmin – Tag", "g.schlaf": "Garmin – Schlaf", "g.hrv": "Garmin – HRV", "g.bereitschaft": "Garmin – Trainingsbereitschaft",
  "g.vo2max": "Garmin – VO₂max", "g.fitnessalter": "Garmin – Fitnessalter", "g.atmung": "Garmin – Atmung", "g.trinken": "Garmin – Trinken",
  "g.snapshot": "Garmin – Health Snapshot", "g.ausdauer": "Garmin – Ausdauerwert", "g.huegel": "Garmin – Hill Score",
  "g.akklimatisierung": "Garmin – Akklimatisierung", "g.gewicht": "Garmin – Gewicht", "g.blutdruck": "Garmin – Blutdruck",
  "g.zyklus": "Garmin – Zyklus", "g.wettkampf": "Garmin – Wettkampfprognose", "g.trainingsstatus": "Garmin – Trainingsstatus",
  "g.laufbelastung": "Garmin – Laufbelastung", "g.schritte": "Garmin – Schritte", "g.herz": "Garmin – Herzfrequenz",
  "g.stress": "Garmin – Stress", "g.bodybattery": "Garmin – Body Battery", "g.intensitaet": "Garmin – Intensitätsminuten",
  "g.etagen": "Garmin – Etagen", "g.kalorien": "Garmin – Kalorien", "w.aktivitaet": "Withings – Aktivität", "w.schlaf": "Withings – Schlaf",
};
const FELD_NAMEN = {
  totalSteps: "Schritte", dailyStepGoal: "Schrittziel", totalDistanceMeters: "Strecke (m)", activeKilocalories: "Aktivkalorien",
  bmrKilocalories: "Grundumsatz (kcal)", totalKilocalories: "Kalorien gesamt", wellnessActiveKilocalories: "Aktivkalorien (Alltag)",
  restingHeartRate: "Ruhepuls", minHeartRate: "Puls minimal", maxHeartRate: "Puls maximal", lastSevenDaysAvgRestingHeartRate: "Ruhepuls 7-Tage-Mittel",
  averageStressLevel: "Stress im Mittel", maxStressLevel: "Stress maximal", stressDuration: "Stressdauer (s)", restStressDuration: "Ruhedauer (s)",
  lowStressDuration: "Geringer Stress (s)", mediumStressDuration: "Mittlerer Stress (s)", highStressDuration: "Hoher Stress (s)",
  bodyBatteryHighestValue: "Body Battery Höchstwert", bodyBatteryLowestValue: "Body Battery Tiefstwert", bodyBatteryChargedValue: "Body Battery aufgeladen",
  bodyBatteryDrainedValue: "Body Battery verbraucht", bodyBatteryAtWakeTime: "Body Battery beim Aufwachen", bodyBatteryMostRecentValue: "Body Battery zuletzt",
  floorsAscended: "Etagen hinauf", floorsDescended: "Etagen hinab", userFloorsAscendedGoal: "Etagenziel",
  moderateIntensityMinutes: "Intensitätsminuten mäßig", vigorousIntensityMinutes: "Intensitätsminuten hoch", intensityMinutesGoal: "Ziel Intensitätsminuten",
  sleepingSeconds: "Schlaf (s)", activeSeconds: "Aktiv (s)", highlyActiveSeconds: "Sehr aktiv (s)", sedentarySeconds: "Inaktiv (s)",
  averageSpo2: "SpO₂ Mittel", lowestSpo2: "SpO₂ Tiefstwert", latestSpo2: "SpO₂ zuletzt", avgWakingRespirationValue: "Atemfrequenz wach",
  highestRespirationValue: "Atemfrequenz Höchstwert", lowestRespirationValue: "Atemfrequenz Tiefstwert",
  totalSleepTimeInSeconds: "Schlafdauer (s)", deepTime: "Tiefschlaf (s)", lightTime: "Leichtschlaf (s)", remTime: "REM (s)", awakeTime: "Wach (s)",
  sleepScore: "Schlafscore", respiration: "Atemfrequenz", spO2: "SpO₂", sleepNeed: "Schlafbedarf (Min.)", skinTempC: "Hauttemperatur-Abweichung (°C)",
  bodyBatteryChange: "Body Battery aufgeladen", lastNightAvg: "HRV letzte Nacht", weeklyAvg: "HRV 7-Tage-Mittel", lastNight5MinHigh: "HRV 5-Minuten-Höchstwert",
  "baseline.balancedLow": "Normalbereich unten", "baseline.balancedUpper": "Normalbereich oben", "baseline.lowUpper": "Grenze niedrig", "baseline.markerValue": "Lage im Bereich",
  score: "Wert", recoveryTime: "Erholungszeit (Min.)", acwrFactorPercent: "Faktor Lastverhältnis (%)", hrvFactorPercent: "Faktor HRV (%)",
  sleepHistoryFactorPercent: "Faktor Schlafverlauf (%)", stressHistoryFactorPercent: "Faktor Stressverlauf (%)",
  "generic.vo2MaxPreciseValue": "Laufen (genau)", "generic.vo2MaxValue": "Laufen", "cycling.vo2MaxPreciseValue": "Radfahren (genau)", "cycling.vo2MaxValue": "Radfahren",
  fitnessAge: "Fitnessalter", chronologicalAge: "Lebensalter", achievableFitnessAge: "Erreichbares Fitnessalter", rhr: "Ruhepuls",
  avgWakingRespiration: "Wach", avgSleepRespiration: "Im Schlaf", goalInML: "Trinkziel (ml)", valueInML: "Getrunken (ml)", sweatLossInML: "Schweißverlust (ml)",
  groupAverage: "Ausdauerwert", groupMax: "Ausdauerwert Höchstwert", overallScore: "Gesamt", strengthScore: "Kraft", enduranceScore: "Ausdauer",
  heatAcclimationPercentage: "Hitzeakklimatisierung (%)", altitudeAcclimation: "Höhenakklimatisierung", currentAltitude: "Aktuelle Höhe (m)",
  weight: "Gewicht (g)", bmi: "BMI", time5K: "5 km (s)", time10K: "10 km (s)", timeHalfMarathon: "Halbmarathon (s)", timeMarathon: "Marathon (s)",
  trainingStatus: "Status-Code", weeklyTrainingLoad: "Wochenlast", "acuteTrainingLoadDTO.acwrPercent": "Lastverhältnis (%)",
  "acuteTrainingLoadDTO.dailyTrainingLoadAcute": "Akute Last", "acuteTrainingLoadDTO.dailyTrainingLoadChronic": "Chronische Last",
  steps: "Schritte", distance: "Strecke (m)", calories: "Kalorien", totalcalories: "Kalorien gesamt", elevation: "Höhenmeter",
  soft: "Leicht aktiv (s)", moderate: "Mäßig aktiv (s)", intense: "Intensiv (s)", active: "Aktiv (s)",
  hr_average: "Puls Mittel", hr_min: "Puls minimal", hr_max: "Puls maximal", sleep_score: "Schlafscore", total_sleep_time: "Schlafdauer (s)",
};
function metrikName(m) {
  if (m.startsWith("w.mess.")) {
    const [, , typ, pos] = m.split(".");
    return wName(+typ, pos == null ? -1 : +pos);
  }
  const teile = m.split(".");
  const feld = teile.slice(2).join(".");
  if (FELD_NAMEN[feld]) return FELD_NAMEN[feld];
  const letztes = teile[teile.length - 1];
  if (FELD_NAMEN[letztes]) return FELD_NAMEN[letztes];
  return feld.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
function bereichName(m) {
  if (m.startsWith("w.mess.")) return "Withings – Messungen";
  const p = m.split(".").slice(0, 2).join(".");
  return BEREICH_NAMEN[p] || p;
}

// ---- Sportarten
const SPORT = {
  running: ["Laufen", "lauf"], trail_running: ["Trailrunning", "lauf"], treadmill_running: ["Laufband", "lauf"],
  track_running: ["Bahnlauf", "lauf"], indoor_running: ["Laufen (drinnen)", "lauf"], virtual_run: ["Virtueller Lauf", "lauf"],
  cycling: ["Radfahren", "fahrrad"], road_biking: ["Rennrad", "fahrrad"], mountain_biking: ["Mountainbike", "fahrrad"],
  gravel_cycling: ["Gravel", "fahrrad"], indoor_cycling: ["Indoor-Radfahren", "fahrrad"], virtual_ride: ["Virtuelle Radfahrt", "fahrrad"],
  e_bike_fitness: ["E-Bike", "fahrrad"], e_bike_mountain: ["E-Mountainbike", "fahrrad"], cyclocross: ["Cyclocross", "fahrrad"],
  walking: ["Gehen", "gehen"], casual_walking: ["Spazieren", "gehen"], speed_walking: ["Schnelles Gehen", "gehen"], indoor_walking: ["Gehen (drinnen)", "gehen"],
  hiking: ["Wandern", "wandern"], mountaineering: ["Bergsteigen", "wandern"], snowshoeing_ws: ["Schneeschuh", "wandern"],
  strength_training: ["Krafttraining", "kraft"], indoor_cardio: ["Cardio", "kraft"], cardio_training: ["Cardio", "kraft"], hiit: ["HIIT", "kraft"],
  fitness_equipment: ["Fitnessgeräte", "kraft"], elliptical: ["Crosstrainer", "kraft"], stair_climbing: ["Treppensteigen", "kraft"],
  indoor_rowing: ["Rudergerät", "kraft"], rowing: ["Rudern", "schwimmen"], yoga: ["Yoga", "yoga"], pilates: ["Pilates", "yoga"],
  breathwork: ["Atemübung", "yoga"], meditation: ["Meditation", "yoga"], swimming: ["Schwimmen", "schwimmen"], lap_swimming: ["Bahnenschwimmen", "schwimmen"],
  open_water_swimming: ["Freiwasserschwimmen", "schwimmen"], resort_skiing_snowboarding_ws: ["Ski & Snowboard", "wandern"],
  backcountry_skiing: ["Skitour", "wandern"], cross_country_skiing_ws: ["Langlauf", "wandern"], multi_sport: ["Multisport", "sonst"],
  tennis: ["Tennis", "sonst"], padel: ["Padel", "sonst"], golf: ["Golf", "sonst"], other: ["Sonstiges", "sonst"],
};
function sportName(typ) { return (SPORT[typ] || [String(typ || "Sonstiges").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())])[0]; }
function sportIcon(typ) { return (SPORT[typ] || [0, "sonst"])[1]; }
function istLauf(typ) { return sportIcon(typ) === "lauf"; }

// ---- Blutdruck-Einzelwerte nach den Grenzwerten für die Messung zu Hause (ESH 2023, Deutsche Hochdruckliga):
// Zu Hause gilt ab 135/85 mmHg als über dem Grenzwert – die Stufen „hoch-normal“ und „Grad 1–3“ sind für die
// Messung in der Praxis gemacht. Optimal wie beim Mittelwert unter 120/80, sehr hoch ab 180/110.
function bpKlasse(sys, dia) {
  if (sys >= 180 || dia >= 110) return ["sehr hoch", "kritisch"];
  if (sys >= 135 || dia >= 85) return ["erhöht", "warnung"];
  if (sys >= 120 || dia >= 80) return ["normal", "gut"];
  return ["optimal", "gut"];
}
function chip(text, art = "neutral") { return h("span", { class: `chip ${art}` }, text); }
const AFIB = { 0: ["Kein Vorhofflimmern", "gut"], 1: ["Vorhofflimmern erkannt", "kritisch"], 2: ["Nicht eindeutig", "warnung"] };

// ======================================================================
// Diagramme (ECharts)
// ======================================================================
const DIAGRAMME = new Set();
const NACH = [];
const groesse = new ResizeObserver((eintraege) => {
  for (const e of eintraege) { const c = window.echarts && echarts.getInstanceByDom(e.target); if (c) c.resize(); }
});
function diagrammeAufraeumen() {
  for (const c of DIAGRAMME) { try { groesse.unobserve(c.getDom()); c.dispose(); } catch { /* schon weg */ } }
  DIAGRAMME.clear();
}
function farbe(slot) {
  if (typeof slot === "string") return slot.startsWith("--") ? css(slot) : slot;
  return css(`--serie-${slot || 1}`);
}
function textStil(extra = {}) { return { color: css("--tinte-3"), fontFamily: SCHRIFT, fontSize: 12, ...extra }; }
function zeitFormat(spanneTage) {
  return (v) => {
    const d = new Date(v);
    if (spanneTage <= 2) return DF.zeit.format(d);
    if (spanneTage <= 150) return spanneTage > 20 && d.getDate() >= 27 ? "" : `${d.getDate()}.${d.getMonth() + 1}.`; // kein 29. direkt vor dem 1.
    return DF.monatKurz.format(d);
  };
}
/** Achsenbeschriftung mit so wenigen Nachkommastellen wie nötig */
function achsenZahl(v) {
  const st = Math.abs(v - Math.round(v)) < 1e-6 ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? 1 : 2;
  return zahl(v, st);
}
function tooltipStil() {
  return {
    backgroundColor: css("--blatt"), borderColor: css("--linie-stark"), borderWidth: 1, padding: [8, 10],
    textStyle: { color: css("--tinte"), fontFamily: SCHRIFT, fontSize: 13 },
    extraCssText: "border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.12);", confine: true,
  };
}
function tooltipZeile(farbe_, wert, name) {
  return `<div style="display:flex;align-items:center;gap:8px;margin-top:3px"><i style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${farbe_}"></i><b style="font-weight:650">${esc(wert)}</b><span style="color:${css("--tinte-2")}">${esc(name)}</span></div>`;
}
function xWert(x) { return typeof x === "string" ? tagMs(x) : x; }
/** Runde Schrittweite für die y-Achse; bei Zeiten in Sekunden in Uhr-Schritten, bei ganzen Zahlen ohne Komma */
function schoenerSchritt(roh, zeit = false, ganz = false) {
  if (!(roh > 0)) return 1;
  if (zeit) return [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].find((x) => x >= roh) || 3600 * Math.ceil(roh / 3600);
  const p = 10 ** Math.floor(Math.log10(roh));
  const f = roh / p;
  const schritt = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return ganz ? Math.max(1, schritt === 2.5 ? 5 : Math.round(schritt)) : schritt;
}
/** Feste y-Grenzen, damit kleine Schwankungen nicht übertrieben wirken:
 *  Die Achse umfasst mindestens opt.minSpanne (sonst 4 % des Mittelwerts). */
function yBereich(serien, opt) {
  if (opt.nullBasis || opt.yMin != null || opt.yMax != null) return {};
  const ys = [];
  const gestapelt = new Map();
  for (const se of serien) for (const p of se.daten) {
    let v = p[1];
    if (v == null || !Number.isFinite(v)) continue;
    if (se.stapel) { const key = `${se.stapel}|${xWert(p[0])}`; v += gestapelt.get(key) || 0; gestapelt.set(key, v); }
    ys.push(v);
  }
  for (const r of opt.referenzen || []) if (Number.isFinite(r.wert)) ys.push(r.wert);
  if (!ys.length) return {};
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const mindest = opt.minSpanne ?? Math.abs((lo + hi) / 2) * 0.04;
  const zuEng = mindest > 0 && hi - lo < mindest;
  if (!zuEng && !opt.zeitAchse) return {};
  if (zuEng) {
    const mitte = (lo + hi) / 2;
    const unten = Math.min(...ys) >= 0 ? Math.max(0, mitte - mindest / 2) : mitte - mindest / 2;
    lo = unten; hi = unten + mindest;
  }
  const schritt = schoenerSchritt((hi - lo) / 4 || Math.abs(hi) / 8, opt.zeitAchse, ys.every(Number.isInteger));
  const fein = (x) => +x.toPrecision(12);
  const min = fein(Math.floor(lo / schritt) * schritt);
  let max = fein(Math.ceil(hi / schritt) * schritt);
  if (max <= min) max = fein(min + schritt);
  return { min, max, intervall: schritt };
}

/** Liniendiagramm / Balken auf Zeitachse.
 *  serien: [{name, daten:[[x,y]], slot, art:'linie'|'balken'|'punkte', stellen, einheit, stapel, gestrichelt, endWert, format}] */
function zeitDiagramm(div, serien, opt = {}) {
  const alle = serien.flatMap((s_) => s_.daten.map((p) => xWert(p[0])));
  const min = Math.min(...alle), max = Math.max(...alle);
  const spanne = Number.isFinite(min) ? (max - min) / 86400000 : 30;
  const linie = css("--linie"), stark = css("--linie-stark");
  const flaechenFarbe = css("--blatt");
  const yb = yBereich(serien, opt);
  const option = {
    animation: BEWEGUNG, animationDuration: 380,
    grid: { left: 4, right: opt.rechts ?? 44, top: opt.oben ?? 14, bottom: 4, containLabel: true },
    xAxis: {
      type: "time", min: opt.xMin, max: opt.xMax, splitNumber: (opt.spanne ?? spanne) <= 2 ? 5 : 4,
      axisLine: { lineStyle: { color: stark } }, axisTick: { show: false },
      axisLabel: { ...textStil(), hideOverlap: true, showMaxLabel: false, formatter: zeitFormat(opt.spanne ?? spanne) },
      splitLine: { show: false }, axisPointer: { show: true, type: "line", lineStyle: { color: css("--tinte-3"), width: 1 }, label: { show: false } },
    },
    yAxis: {
      type: "value", scale: opt.nullBasis ? false : true, min: opt.yMin ?? yb.min, max: opt.yMax ?? yb.max, interval: opt.yIntervall ?? yb.intervall, inverse: Boolean(opt.umgekehrt),
      splitNumber: 4, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { ...textStil(), formatter: opt.yFormat || achsenZahl },
      splitLine: { lineStyle: { color: linie, width: 1 } },
    },
    tooltip: {
      trigger: "axis", ...tooltipStil(),
      formatter: (params) => {
        if (!params.length) return "";
        const x = params[0].value[0];
        const kopf = opt.wochen ? `Woche ab ${DF.langJahr.format(new Date(x))}` : opt.mitUhrzeit ? DF.datumZeit.format(new Date(x)) : DF.langJahr.format(new Date(x));
        let html = `<div style="color:${css("--tinte-2")};font-size:12px">${esc(kopf)}</div>`;
        for (const p of params) {
          const se = serien[p.seriesIndex];
          if (!se || se.unsichtbar || p.value[1] == null) continue;
          const wert = se.format ? se.format(p.value[1], p.value) : `${zahl(p.value[1], se.stellen ?? 0)}${se.einheit ? " " + se.einheit : ""}`;
          html += tooltipZeile(farbe(se.slot), wert, se.name);
        }
        if (opt.tooltipExtra) html += opt.tooltipExtra(params);
        return html;
      },
    },
    series: serien.map((se) => {
      const c = farbe(se.slot);
      const daten = se.daten.map((p) => [xWert(p[0]), p[1], ...(p.slice(2))]);
      if (se.art === "balken") {
        const luecke = se.stapel && daten.length <= 40; // 2-px-Lücke nur, wenn die Balken breit genug sind
        return {
          name: se.name, type: "bar", data: daten, stack: se.stapel, barMaxWidth: 24, barMinWidth: 1, barGap: "10%",
          itemStyle: { color: c, borderRadius: se.rund === false || daten.length > 60 ? 0 : (se.stapel && !se.oben ? 0 : [4, 4, 0, 0]), borderColor: luecke ? flaechenFarbe : undefined, borderWidth: luecke ? 1 : 0 },
          emphasis: { itemStyle: { opacity: 0.85 } },
          markLine: se.markLine,
        };
      }
      const punkte = se.art === "punkte" || (se.punkte ?? daten.length <= 45);
      return {
        name: se.name, type: "line", data: daten, stack: se.stapel, smooth: false, connectNulls: Boolean(se.verbinden),
        showSymbol: punkte, symbol: "circle", symbolSize: se.art === "punkte" ? 7 : 6,
        lineStyle: { width: se.unsichtbar ? 0 : se.art === "punkte" ? 0 : 2, color: c, type: se.gestrichelt ? "dashed" : "solid", cap: "round", join: "round" },
        itemStyle: { color: c, borderColor: flaechenFarbe, borderWidth: 2 },
        areaStyle: se.flaeche ? { color: se.flaecheFarbe || c, opacity: se.flaecheDeckkraft ?? 0.1 } : undefined,
        emphasis: { disabled: true }, silent: Boolean(se.unsichtbar), z: se.z ?? 2,
        endLabel: se.endWert ? {
          show: true, distance: 6, color: css("--tinte"), fontFamily: SCHRIFT, fontSize: 12, fontWeight: 650,
          formatter: (p) => (se.endFormat ? se.endFormat(p.value[1]) : se.format ? se.format(p.value[1], p.value) : zahl(p.value[1], se.stellen ?? 0)),
        } : undefined,
        markLine: se.markLine,
      };
    }),
  };
  if (opt.referenzen && opt.referenzen.length) {
    option.series.push({
      type: "line", data: [], silent: true,
      markLine: {
        silent: true, symbol: "none", animation: false,
        lineStyle: { color: css("--tinte-3"), type: "dashed", width: 1 },
        label: { color: css("--tinte-2"), fontFamily: SCHRIFT, fontSize: 11, position: "insideStartTop", formatter: (p) => p.name,
          backgroundColor: css("--blatt"), padding: [1, 4], borderRadius: 3 },
        data: opt.referenzen.map((r) => ({ yAxis: r.wert, name: r.text })),
      },
    });
  }
  return neuesDiagramm(div, option);
}
function neuesDiagramm(div, option) {
  if (!window.echarts) { div.textContent = "Diagramme konnten nicht geladen werden."; return null; }
  const c = echarts.init(div, null, { renderer: "canvas" });
  c.setOption(option);
  DIAGRAMME.add(c);
  groesse.observe(div);
  return c;
}

/** Diagramm mit Überschrift, Legende und Tabellenansicht */
function figur({ titel, wert, serien, opt = {}, hoehe = "", legende, fussnote, tabelle, zeichnen }) {
  const flaeche = h("div", { class: `flaeche ${hoehe}`, role: "img", "aria-label": titel || "Diagramm" });
  const knopf = h("button", { class: "tabellen-knopf", type: "button" }, "Als Tabelle zeigen");
  const rahmen = h("div", { class: "tabellen-rahmen", hidden: true });
  knopf.addEventListener("click", () => {
    if (rahmen.hidden) {
      if (!rahmen.firstChild) rahmen.append(tabelle ? tabelle() : serienTabelle(serien, opt));
      rahmen.hidden = false; knopf.textContent = "Tabelle ausblenden";
    } else { rahmen.hidden = true; knopf.textContent = "Als Tabelle zeigen"; }
  });
  const sichtbar = (serien || []).filter((x) => !x.unsichtbar && !x.ohneLegende);
  const leg = legende || (sichtbar.length >= 2 ? h("div", { class: "legende" }, sichtbar.map((x) =>
    h("span", null, h("i", { class: x.art === "balken" ? "kasten" : x.art === "punkte" ? "punkt" : x.gestrichelt ? "gestrichelt" : "", style: { background: farbe(x.slot) } }), x.name))) : null);
  const f = h("figure", { class: "diagramm" },
    titel || wert ? h("div", { class: "diagramm-kopf" }, h("h3", null, titel || ""), wert ? h("div", { class: "wert" }, wert) : null) : null,
    leg, flaeche,
    h("figcaption", null, h("span", null, fussnote || ""), knopf), rahmen);
  NACH.push(() => (zeichnen ? zeichnen(flaeche) : zeitDiagramm(flaeche, serien, opt)));
  return f;
}
/** Chip-Reihe am Handy: Sie lässt sich seitlich wischen. Solange rechts noch Chips folgen, läuft sie
 *  dort sanft aus, und der gewählte Chip wird in den sichtbaren Bereich gerückt. */
function chipsRand(box) {
  const pruefen = () => box.classList.toggle("geht-weiter", box.scrollLeft + box.clientWidth < box.scrollWidth - 2);
  box.addEventListener("scroll", pruefen, { passive: true });
  new ResizeObserver(() => {
    pruefen();
    const an = box.querySelector('[aria-pressed="true"]');
    if (an && box.scrollWidth > box.clientWidth && (an.offsetLeft + an.offsetWidth > box.scrollLeft + box.clientWidth || an.offsetLeft < box.scrollLeft)) {
      box.scrollLeft = Math.max(0, an.offsetLeft - 24);
    }
  }).observe(box);
  return box;
}
/** Ein Diagramm mit Auswahl-Chips darüber (statt vieler kleiner Diagramme untereinander) */
function auswahlFigur(name, optionen, hoehe = "") {
  if (!optionen.length) return null;
  let aktiv = optionen[0].id;
  const chipsBox = chipsRand(h("div", { class: "chips", role: "group", "aria-label": name }));
  const box = h("div", { style: { marginTop: "12px" } });
  const zeige = () => {
    chipsBox.replaceChildren(...optionen.map((o) => h("button", { type: "button", "aria-pressed": String(o.id === aktiv), onclick: () => { aktiv = o.id; zeige(); } }, o.name)));
    const alt = box.querySelector(".flaeche");
    if (alt && window.echarts) { const c = echarts.getInstanceByDom(alt); if (c) { DIAGRAMME.delete(c); groesse.unobserve(alt); c.dispose(); } }
    const o = optionen.find((x) => x.id === aktiv);
    const vorher = NACH.length;
    box.replaceChildren(figur({ titel: o.name, wert: o.wert, serien: o.serien, opt: o.opt || {}, hoehe, fussnote: o.fussnote }));
    if (box.isConnected) {
      const auftraege = NACH.splice(vorher);
      requestAnimationFrame(() => auftraege.forEach((f) => f()));
    }
  };
  zeige();
  return h("div", null, chipsBox, box);
}
function serienTabelle(serien, opt = {}) {
  const sichtbar = serien.filter((x) => !x.unsichtbar);
  const zeilen = new Map();
  sichtbar.forEach((se, i) => {
    for (const p of se.daten) {
      const k = xWert(p[0]);
      if (!zeilen.has(k)) zeilen.set(k, []);
      zeilen.get(k)[i] = p[1];
    }
  });
  const sortiert = [...zeilen.entries()].sort((a, b) => b[0] - a[0]).slice(0, 800);
  return h("table", { class: "tabelle" },
    h("thead", null, h("tr", null, h("th", null, opt.wochen ? "Woche ab" : opt.mitUhrzeit ? "Zeitpunkt" : "Datum"), sichtbar.map((se) => h("th", null, se.name + (se.einheit ? ` (${se.einheit})` : ""))))),
    h("tbody", null, sortiert.map(([x, werte]) => h("tr", null,
      h("td", null, opt.mitUhrzeit ? DF.datumZeit.format(new Date(x)) : datum(isoAusMs(x), "kurz")),
      sichtbar.map((se, i) => h("td", null, werte[i] == null ? "–" : se.format ? se.format(werte[i]) : zahl(werte[i], se.stellen ?? 0)))))));
}
function funke(punkte, breite = 160, hoehe_ = 30) {
  const svg = s("svg", { class: "funke", viewBox: `0 0 ${breite} ${hoehe_}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  const werte = punkte.filter((p) => Number.isFinite(p[1]));
  if (werte.length < 2) return svg;
  const xs = werte.map((p) => xWert(p[0])), ys = werte.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => ((x - x0) / (x1 - x0 || 1)) * (breite - 6) + 3;
  const sy = (y) => hoehe_ - 4 - ((y - y0) / (y1 - y0 || 1)) * (hoehe_ - 8);
  const d = werte.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join("");
  svg.append(s("path", { d, fill: "none", stroke: "var(--serie-grau)", "stroke-width": 1.6, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const lx = sx(xs[xs.length - 1]), ly = sy(ys[ys.length - 1]);
  svg.append(s("circle", { cx: lx, cy: ly, r: 3.4, fill: "var(--serie-1)", stroke: "var(--blatt)", "stroke-width": 1.5 }));
  return svg;
}

// ======================================================================
// Bausteine
// ======================================================================
function abschnitt(titel, beschreibung, ...inhalt) {
  return h("section", { class: "abschnitt" },
    h("div", { class: "abschnitt-kopf" }, h("div", null, h("h2", null, titel), beschreibung ? h("p", null, beschreibung) : null)),
    ...inhalt);
}
/** Hängt einen Abschnitt an. Folgt er direkt auf den verwandten Abschnitt „vorher“,
 *  stehen beide auf breiten Bildschirmen (Chromebook, Tablet quer) nebeneinander. */
function nebenan(knoten, vorher, neu) {
  if (vorher && knoten[knoten.length - 1] === vorher) knoten[knoten.length - 1] = h("div", { class: "raster zwei paar" }, vorher, neu);
  else knoten.push(neu);
}
/** Abschnitt zum Auf- und Zuklappen: Kopf mit Pfeil, zugeklappt nur Titel und Kurzfassung. Dieses Gerät merkt sich, was offen ist. */
function klappAbschnitt(id, titel, kurz, ...inhalt) {
  const schluessel = `gesundheit.klapp.${id}`;
  const d = h("details", { class: "abschnitt klapp", open: speicher.get(schluessel) === "1" || null },
    h("summary", { class: "abschnitt-kopf" }, h("div", null, h("h2", null, titel), kurz ? h("p", null, kurz) : null),
      h("span", { class: "klapp-pfeil", "aria-hidden": "true" }, icon("unten", 22))),
    ...inhalt);
  d.addEventListener("toggle", () => {
    speicher.set(schluessel, d.open ? "1" : null);
    // Diagramme, die zugeklappt keine Größe hatten, jetzt richtig zeichnen
    if (d.open && window.echarts) d.querySelectorAll(".flaeche").forEach((f) => { const c = echarts.getInstanceByDom(f); if (c) c.resize(); });
  });
  return d;
}
// Lange Statuswörter dürfen in Kacheln umbrechen (weiches Trennzeichen)
const TRENNUNG = { Leistungsabbau: "Leistungs­abbau", Überlastung: "Über­lastung", überfordert: "über­fordert",
  unproduktiv: "un­produktiv", Höchstform: "Höchst­form", ausgeglichen: "aus­geglichen",
  unausgeglichen: "un­aus­geglichen", ausgezeichnet: "aus­gezeichnet", produktiv: "pro­duktiv" };
function achtungSymbol(befund, groesse = 20) {
  const kritisch = befund.stufe === "kritisch";
  return h("span", { class: `achtung stufe-${befund.stufe || "hinweis"}`, role: "img", title: befund.titel,
    "aria-label": `${kritisch ? "Ärztlich abklären" : "Leicht außerhalb des Optimalbereichs"}: ${befund.titel}` }, icon("achtung", groesse));
}
function kachel({ titel, wert, einheit, unter, link, funkeDaten, extra, befund }) {
  const istText = typeof wert === "string" && /[A-Za-zÄÖÜäöüß]{3}/.test(wert);
  const anzeige = istText ? wert.split(" ").map((w) => TRENNUNG[w] || w).join(" ") : wert;
  const inhalt = [
    h("span", { class: "kachel-titel" }, titel),
    befund ? achtungSymbol(befund) : null,
    wert != null ? h("span", { class: istText ? "kachel-wert text" : "kachel-wert" }, anzeige, einheit ? h("small", null, einheit) : null) : null,
    extra || null,
    h("span", { class: "kachel-unter" }, unter || ""),
    befund ? h("span", { class: "kachel-befund" }, befund.kurz) : null,
    funkeDaten && funkeDaten.length > 1 ? funke(funkeDaten) : null,
  ];
  const klasse = befund ? `kachel auffaellig stufe-${befund.stufe || "hinweis"}` : "kachel";
  return link ? h("a", { class: klasse, href: link }, inhalt) : h("div", { class: klasse }, inhalt);
}
function werteListe(eintraege) {
  return h("ul", { class: "werte" }, eintraege.filter(Boolean).map((e) =>
    h("li", { class: e.befund ? "auffaellig" : null }, h("span", { class: "name" }, e.name),
      h("span", { class: "zahl" }, e.befund ? achtungSymbol(e.befund, 18) : null, e.wert, e.einheit ? h("small", null, e.einheit) : null),
      e.befund ? h("span", { class: `befund-kurz stufe-${e.befund.stufe || "hinweis"}` }, e.befund.kurz) : null,
      e.neben ? h("span", { class: "neben" }, e.neben) : null)));
}
/** Körperwerte wie in der Withings-App: links Name und Einordnung, rechts Wert mit einem Balken aus drei Bereichen */
function markerListe(eintraege) {
  const zeilen = eintraege.filter(Boolean).map((e) => {
    const wert = h("div", { class: "marker-wert" }, e.wert, e.einheit ? h("small", null, e.einheit) : null);
    // Zahl und Einheit nicht trennen („30 Tagen“, „1,7 kg“)
    const neben = e.neben ? h("span", { class: "marker-neben" }, e.neben.replace(/(\d) (?=Tagen|kg|%|Jahre|Punkte|cm)/g, "$1\u00a0")) : null;
    if (!e.zone) return h("li", { class: "marker" }, h("div", { class: "marker-text" }, h("span", { class: "marker-name" }, e.name), neben), h("div", { class: "marker-rechts" }, wert));
    const v = Math.round(e.zahl * 10 ** e.stellen) / 10 ** e.stellen; // eingeordnet wird der angezeigte Wert
    const i = zoneIndex(e.zone, v);
    const stufe = (e.zone.wort && e.zone.wort(v)) || e.zone.stufen[i][0];
    const texte = zoneTexte(e.zone, e.stellen);
    // Bezugsbereich mit Quelle: der gute Bereich, dahinter, woher die Einteilung stammt
    const gutJ = e.zone.stufen.findIndex(([, art]) => art === "gut");
    const j = gutJ >= 0 ? gutJ : 1;
    const bezug = `${e.zone.stufen[j][0]} ${texte[j]}${e.einheit ? ` ${e.einheit}` : ""} (${e.zone.quelle})`;
    const bereiche = e.zone.stufen.map(([n], k) => `${n}${texte[k] ? ` ${texte[k]}` : ""}`).join(", ");
    return h("li", { class: "marker" },
      h("div", { class: "marker-text" }, h("span", { class: "marker-name" }, e.name), h("b", { class: "marker-stufe" }, stufe),
        h("span", { class: "marker-bezug" }, bezug), neben),
      h("div", { class: "marker-rechts" }, wert,
        h("div", { class: "marker-skala", role: "img", style: { gridTemplateColumns: `repeat(${e.zone.stufen.length}, 1fr)` },
          "aria-label": `${e.name} ${e.wert}${e.einheit ? ` ${e.einheit}` : ""}: ${stufe}. Bereiche ${e.zone.quelle}: ${bereiche}.` },
          e.zone.stufen.map(([, art], k) => h("span", { class: k === i ? `an ${art}` : null })),
          h("i", { class: "zeiger", style: { left: `${zonePosition(e.zone, v) * 100}%` } }))));
  });
  return zeilen.length ? h("ul", { class: "marker-liste" }, zeilen) : null;
}
function leer(titel, text) { return h("div", { class: "leer" }, h("b", null, titel), text ? h("p", null, text) : null); }
function hinweis(text, art = "", symbol = "info") {
  return h("div", { class: `hinweis ${art}` }, icon(symbol), h("div", null, [].concat(text).map((t) => (t instanceof Node ? t : h("p", null, t)))));
}
function deltaText(jetzt, frueher, stellen, einheit, wort = "") {
  if (jetzt == null || frueher == null) return "";
  const d = jetzt - frueher;
  if (Math.abs(d) < Math.pow(10, -stellen) / 2) return `unverändert${wort ? " " + wort : ""}`;
  // Bei Prozentwerten ist die Differenz in Prozentpunkten; "1 Jahr" statt "1 Jahre"
  let e = einheit === "%" ? "Punkte" : einheit;
  if (e === "Jahre" && Math.abs(Math.round(d * Math.pow(10, stellen))) === Math.pow(10, stellen)) e = "Jahr";
  if (e === "Punkte" && Math.abs(Math.round(d * Math.pow(10, stellen))) === Math.pow(10, stellen)) e = "Punkt";
  return `${vorzeichen(d, stellen)}${e ? " " + e : ""}${wort ? " " + wort : ""}`;
}

// ======================================================================
// Bewertung: Werte außerhalb des Optimalbereichs, mit Hinweisen und Tipps
// Grundlagen siehe QUELLEN (Hochdruckliga/ESH, WHO, National Sleep Foundation,
// Withings, Reference Values for Arterial Stiffness' Collaboration, Garmin).
// ======================================================================
const BEREICHE = [["herz", "Herz und Kreislauf"], ["koerper", "Körper"], ["schlaf", "Schlaf und Erholung"], ["bewegung", "Bewegung"]];
const BEREICH_SEITE = { "#herz": "Herz", "#koerper": "Körper", "#schlaf": "Schlaf", "#sport": "Sport" };
const TIPPS = {
  blutdruck: [
    "Salz sparen: höchstens 5 g am Tag, etwa ein Teelöffel. Viel Salz steckt in Brot, Wurst, Käse und Fertiggerichten.",
    "An den meisten Tagen mindestens 30 Minuten zügig gehen, Rad fahren oder schwimmen.",
    "Alkohol einschränken und nicht rauchen.",
    "Übergewicht abbauen – schon wenige Kilo weniger senken den Blutdruck.",
    "Richtig messen: morgens und abends je zweimal nach 5 Minuten Ruhe im Sitzen, die Manschette auf Herzhöhe.",
  ],
  ruhepuls: [
    "Regelmäßiges Ausdauertraining senkt den Ruhepuls innerhalb weniger Wochen.",
    "Ausreichend schlafen und bewusst entspannen.",
    "Koffein, Alkohol und Nikotin reduzieren.",
    "Steigt der Ruhepuls plötzlich an, kann ein Infekt dahinterstecken – dann lieber eine Trainingspause einlegen.",
  ],
  hrv: [
    "Regelmäßige Schlafenszeiten und 7 bis 9 Stunden Schlaf.",
    "Kein Alkohol am Abend – er senkt die HRV in der Nacht deutlich.",
    "Nach harten Trainingstagen bewusst leichte Tage einplanen.",
    "Täglich ein paar Minuten langsam atmen, zum Beispiel 5 Sekunden ein und 5 Sekunden aus.",
  ],
  schlafWenig: [
    "Feste Zeiten zum Schlafengehen und Aufstehen, auch am Wochenende.",
    "Eine Stunde vor dem Schlafen Bildschirme weglegen und das Licht dimmen.",
    "Nach 14 Uhr keinen Kaffee mehr und abends keinen Alkohol.",
    "Das Schlafzimmer kühl (etwa 16 bis 19 °C), dunkel und ruhig halten.",
  ],
  schlafViel: [
    "Lange Nächte können Nachholbedarf nach einer anstrengenden Zeit oder einem Infekt sein.",
    "Morgens immer zur gleichen Zeit aufstehen und früh Tageslicht tanken – das stabilisiert den Rhythmus.",
  ],
  schlafQualitaet: [
    "Feste Schlafenszeiten helfen dem Körper, tiefer zu schlafen.",
    "Schweres Essen, harten Sport und Alkohol in den letzten 2 bis 3 Stunden vor dem Schlafen meiden.",
    "Abends zur Ruhe kommen: lesen, Atemübungen oder ein Spaziergang statt Bildschirm.",
    "Das Schlafzimmer kühl, dunkel und ruhig halten.",
  ],
  stress: [
    "Mehrmals am Tag kurze Pausen mit ruhiger Atmung, zum Beispiel 4 Sekunden ein und 6 Sekunden aus.",
    "Bewegung an der frischen Luft baut Stress ab.",
    "Ausreichend schlafen und Koffein reduzieren.",
    "Geführte Atemübungen auf der Uhr nutzen (Aktivität „Atemübung“).",
  ],
  schritte: [
    "Kurze Wege zu Fuß oder mit dem Rad erledigen.",
    "Treppe statt Aufzug nehmen.",
    "Nach dem Essen 10 bis 15 Minuten spazieren gehen.",
    "Telefonate im Gehen führen.",
  ],
  intensitaet: [
    "Zügiges Gehen zählt schon als mäßige Bewegung: Du atmest schneller, kannst aber noch sprechen.",
    "Am einfachsten sind 5 Tage pro Woche mit je 30 Minuten.",
    "Radfahren, Schwimmen, Wandern und Tanzen zählen genauso.",
    "Zusätzlich an 2 Tagen pro Woche Kräftigungsübungen, so empfiehlt es die WHO.",
  ],
  abnehmen: [
    "Langsam abnehmen: etwa 0,5 kg pro Woche sind realistisch und halten länger.",
    "Viel Gemüse, Hülsenfrüchte, Vollkorn und Eiweiß – weniger Zucker, Weißmehl und Fertigprodukte.",
    "Ausdauerbewegung mit Krafttraining kombinieren, damit beim Abnehmen die Muskeln erhalten bleiben.",
    "Zuckerhaltige Getränke und Alkohol meiden.",
  ],
  zunehmen: [
    "Regelmäßig und ausreichend essen, gern mit nährstoffreichen Snacks wie Nüssen, Joghurt oder Vollkornbrot.",
    "Krafttraining hilft, gesundes Gewicht in Form von Muskeln aufzubauen.",
  ],
  viszeral: [
    "Bauchfett schmilzt besonders gut durch regelmäßige Ausdauerbewegung.",
    "Zucker, Weißmehl und Alkohol einschränken.",
    "Ausreichend schlafen und Stress abbauen – beides beeinflusst, wie viel Fett sich am Bauch einlagert.",
  ],
  muskel: [
    "Krafttraining 2- bis 3-mal pro Woche, zum Beispiel mit dem eigenen Körpergewicht oder an Geräten.",
    "Genug Eiweiß essen: etwa 1,0 bis 1,2 g pro Kilogramm Körpergewicht am Tag.",
    "Im Alltag aktiv bleiben – Muskeln bauen ab, wenn sie nicht gefordert werden.",
  ],
  wasser: [
    "Über den Tag verteilt trinken, etwa 1,5 bis 2 Liter, bei Hitze und Sport mehr.",
    "Der Wasseranteil sinkt, wenn der Fettanteil steigt – Muskelaufbau erhöht ihn.",
    "Für vergleichbare Werte morgens nüchtern nach dem Toilettengang wiegen.",
  ],
  knochen: [
    "Die Waage schätzt die Knochenmasse nur – genauer ist eine Knochendichtemessung (DXA) in der Praxis.",
    "Kalzium (Milchprodukte, grünes Gemüse) und Vitamin D (Sonne, fetter Fisch) stärken die Knochen.",
    "Belastung baut Knochen auf: Gehen, Treppensteigen und Krafttraining.",
  ],
  gefaesse: [
    "Den Blutdruck regelmäßig messen – hoher Blutdruck macht die Gefäße steif.",
    "Regelmäßige Ausdauerbewegung hält die Gefäße elastisch.",
    "Nicht rauchen und Salz sparen.",
  ],
  stoffwechsel: [
    "Muskelaufbau erhöht den Grundumsatz und senkt das Stoffwechselalter.",
    "Regelmäßig bewegen und ausgewogen essen.",
  ],
  nerven: [
    "Für eine gültige Messung barfuß, mit trockenen Füßen und ohne Creme auf der Waage stehen.",
    "Den Blutzucker im Blick behalten: Diabetes ist die häufigste Ursache für Nervenschäden an den Füßen.",
  ],
  ekgUnklar: [
    "Die Messung in Ruhe wiederholen: sitzen oder ruhig stehen, Arme entspannt, nicht sprechen.",
    "Bei der Body Scan den Griff mit beiden Händen fest umfassen und barfuß auf den Elektroden stehen.",
  ],
  fitness: [
    "Intensive Einheiten an 2 bis 3 Tagen pro Woche verbessern VO₂max und Fitnessalter am stärksten, zum Beispiel Intervalle oder zügig bergauf.",
    "Auch Ruhepuls und Körperfett fließen in das Fitnessalter von Garmin ein.",
  ],
  leistungsabbau: [
    "Wieder regelmäßig trainieren und den Umfang langsam steigern, etwa um 10 % pro Woche.",
    "Lieber oft und locker als selten und hart – schon 3 Einheiten pro Woche halten die Form.",
  ],
  erholung: [
    "Ein paar leichte Tage oder Ruhetage einplanen.",
    "Auf ausreichend Schlaf und gutes Essen achten – dort passiert die Erholung.",
    "Harte Einheiten nicht direkt hintereinander legen.",
  ],
};
// Worauf die Einordnungen beruhen: zuerst ärztliche Leitlinien und Studien, dann Herstellerangaben (nur wo es keine ärztliche Norm gibt)
const QUELLEN = [
  ["Blutdruck: Leitlinie der Europäischen Hochdruckgesellschaft (ESH 2023), Deutsche Hochdruckliga – Mittel der Selbstmessung ab 135/85 mmHg = Bluthochdruck, optimal unter 120/80", "https://www.hochdruckliga.de/fileadmin/downloads/stellungnahmen/DHL-Stellungnahme-Zielblutdruck.pdf"],
  ["Ruhepuls: Normalbereich 60–100/min; ab 80/min höheres Herz-Kreislauf-Risiko laut Zhang und Kollegen, CMAJ 2016", "https://doi.org/10.1503/cmaj.150535"],
  ["QTc-Zeit: Empfehlung von AHA, ACCF und HRS 2009 – verlängert über 450 ms (Männer) bzw. 460 ms (Frauen), über 500 ms deutlich", "https://doi.org/10.1161/CIRCULATIONAHA.108.191096"],
  ["Pulswellengeschwindigkeit: Reference Values for Arterial Stiffness' Collaboration, European Heart Journal 2010 (Normalwerte nach Alter)", "https://doi.org/10.1093/eurheartj/ehq165"],
  ["BMI: Einteilung der WHO – Normalgewicht 18,5–24,9, Übergewicht 25–29,9, Adipositas ab 30 (Grad I bis III)", "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight"],
  ["Körperfettanteil: Gallagher und Kollegen, American Journal of Clinical Nutrition 2000 – Normalbereiche nach Alter und Geschlecht, abgeleitet aus den BMI-Grenzen der WHO", "https://doi.org/10.1093/ajcn/72.3.694"],
  ["Muskeln an Armen und Beinen: Europäische Sarkopenie-Leitlinie EWGSOP2, Age and Ageing 2019 – niedrig unter 5,5 kg/m² (Frauen) bzw. 7,0 kg/m² (Männer)", "https://doi.org/10.1093/ageing/afy169"],
  ["Magermasse: ESPEN-Konsens zur Mangelernährung, Clinical Nutrition 2015 – vermindert unter 15 kg/m² (Frauen) bzw. 17 kg/m² (Männer)", "https://doi.org/10.1016/j.clnu.2015.03.001"],
  ["Grundumsatz: erwarteter Wert nach Mifflin und St Jeor, American Journal of Clinical Nutrition 1990", "https://doi.org/10.1093/ajcn/51.2.241"],
  ["Bauchumfang: Expertenbericht der WHO – erhöhtes Risiko ab 80 cm (Frauen) bzw. 94 cm (Männer)", "https://www.who.int/publications/i/item/9789241501491"],
  ["Schlafdauer: National Sleep Foundation 2015 – 7 bis 9 Stunden für Erwachsene, 7 bis 8 ab 65", "https://doi.org/10.1016/j.sleh.2014.12.010"],
  ["Sauerstoffsättigung: Leitlinie der British Thoracic Society 2017 – Normalbereich 94–98 %, wach unter 70 Jahren meist 96–98 %", "https://doi.org/10.1136/thoraxjnl-2016-209729"],
  ["Bewegung: WHO-Leitlinie 2020 – 150 bis 300 Minuten mäßige Bewegung pro Woche", "https://www.who.int/publications/i/item/9789240015128"],
  ["Schritte: Ding und Kollegen, Lancet Public Health 2025 – deutlicher Nutzen ab etwa 7.000 Schritten am Tag", "https://epocrates.com/online/article/7-000-daily-steps-associated-with-substantial-reductions-in-mortality-and"],
  ["Viszeralfett: Withings – Index bis 5 gut, bis 10 hoch, darüber sehr hoch", "https://support.withings.com/hc/articles/11072390984081", "hersteller"],
  ["Nervengesundheit: Withings – Wert über 50 normal, darunter niedrig", "https://support.withings.com/hc/en-us/articles/11888924491025-Body-Scan-Nerve-Health-Score-NHS", "hersteller"],
  ["Schlafscore: Garmin – ab 80 gut, ab 90 ausgezeichnet", "https://www.garmin.com/en-CA/blog/?p=30765", "hersteller"],
  ["Stress: Garmin – 0–25 Ruhe, 26–50 niedrig, 51–75 mittel, 76–100 hoch", "https://www8.garmin.com/manuals/webhelp/vivosmart4/EN-US/GUID-9282196F-D969-404D-B678-F48A13D8D0CB.html", "hersteller"],
  ["HRV-Status, Fitnessalter und Trainingsstatus: Garmin", "https://www.garmin.com/en-PH/blog/fitness/understanding-the-hrv-status-on-your-garmin-smartwatch/", "hersteller"],
];
// Grundlage jedes Hinweises – steht unter dem Hinweis, damit klar ist, woher die Einordnung kommt
const GRUNDLAGE = {
  blutdruck: "Leitlinie der Europäischen Hochdruckgesellschaft (ESH 2023), Deutsche Hochdruckliga",
  blutdruck_einzel: "Leitlinie der Europäischen Hochdruckgesellschaft (ESH 2023), Deutsche Hochdruckliga",
  ruhepuls: "Normalbereich 60–100/min; höheres Risiko ab 80/min laut Zhang und Kollegen (CMAJ 2016)",
  hrv: "Einschätzung von Garmin – dafür gibt es keine ärztliche Norm",
  pwv: "Normalwerte nach Alter der Reference Values for Arterial Stiffness' Collaboration (European Heart Journal 2010)",
  ekg: "Auswertung des EKG-Geräts (Withings oder Garmin, als Medizinprodukt zugelassen) – sie ersetzt keine ärztliche Befundung",
  qtc: "Empfehlung von AHA, ACCF und HRS (2009)",
  bmi: "Einteilung der Weltgesundheitsorganisation (WHO)",
  fett: "Referenzwerte von Gallagher und Kollegen (American Journal of Clinical Nutrition 2000)",
  muskel: "Europäische Sarkopenie-Leitlinie EWGSOP2 (2019)",
  mager: "ESPEN-Konsens zur Mangelernährung (2015)",
  viszeral: "Einteilung von Withings – dafür gibt es keine ärztliche Norm",
  nerven: "Einteilung von Withings für die Nervenmessung der Body Scan",
  schlafdauer: "Empfehlung der National Sleep Foundation (2015)",
  schlafscore: "Einschätzung von Garmin – dafür gibt es keine ärztliche Norm",
  spo2: "Leitlinie der British Thoracic Society (2017)",
  atmung: "Normalbereich der Atemfrequenz in Ruhe (12–20 pro Minute)",
  stress: "Einschätzung von Garmin – dafür gibt es keine ärztliche Norm",
  schritte: "Studienauswertung von Ding und Kollegen (Lancet Public Health 2025)",
  intensitaet: "Bewegungsempfehlung der WHO (2020)",
  fitnessalter: "Einschätzung von Garmin – dafür gibt es keine ärztliche Norm",
  trainingsstatus: "Einschätzung von Garmin – dafür gibt es keine ärztliche Norm",
};
// Normalbereiche von Withings (Anteil am Körpergewicht in %), nach Geschlecht und Alter [bis Alter, von, bis]
const W_BEREICHE = {
  fett: { w: [[39, 22, 33], [59, 24, 34], [999, 25, 36]], m: [[39, 8, 20], [59, 11, 22], [999, 13, 25]] },
  muskel: { w: [[39, 63, 75.5], [59, 62, 73.5], [999, 60, 72.5]], m: [[39, 75, 89], [59, 73, 86], [999, 70, 84]] },
  wasser: { w: [[999, 45, 60]], m: [[999, 50, 65]] },
  knochen: { w: [[999, 2.5, 4]], m: [[999, 3, 5]] },
};
function wBereich(art, p) {
  const t = W_BEREICHE[art] && W_BEREICHE[art][p.geschlecht];
  if (!t || (p.alter == null && t.length > 1)) return null;
  return (t.find(([bis]) => (p.alter ?? 0) <= bis) || t[t.length - 1]).slice(1);
}
// ---- Körperwerte ärztlich einordnen
// Bewertet wird nur, wofür es eine ärztliche Norm gibt:
//   BMI nach der WHO; Körperfettanteil nach Gallagher et al. (Am J Clin Nutr 2000), nach Alter und Geschlecht;
//   fettfreie Masse nach ESPEN 2015 (Index unter 15 bzw. 17 kg/m² = vermindert, Kriterium für Mangelernährung);
//   Muskeln an Armen und Beinen nach der europäischen Sarkopenie-Leitlinie EWGSOP2 2019 (unter 5,5 bzw. 7,0 kg/m²).
// Das Viszeralfett ist ein Index von Withings ohne ärztliche Norm (ärztlich zählt der Bauchumfang); es behält die
// Einteilung von Withings und ist so gekennzeichnet. Gesamtmuskelmasse, Wasser, Knochen, Grundumsatz und
// Stoffwechselalter haben für Waagen keine ärztliche Norm und bleiben ohne Bewertung.
// Körperfett nach Gallagher (Frauen/Männer): [bis Alter, niedrig unter, erhöht ab, stark erhöht ab]
const FETT_NORM = { w: [[39, 21, 33, 39], [59, 23, 34, 40], [999, 24, 36, 42]], m: [[39, 8, 20, 25], [59, 11, 22, 28], [999, 13, 25, 30]] };
const FFMI_GRENZE = { w: 15, m: 17 };
const ASMI_GRENZE = { w: 5.5, m: 7 };
function fettNorm(p) {
  const t = FETT_NORM[p.geschlecht];
  if (!t || p.alter == null) return null;
  const [bis, ...grenzen] = t.find(([b]) => p.alter <= b) || t[t.length - 1];
  return { grenzen, gruppe: bis === 39 ? "bis 39 Jahre" : bis === 59 ? "40 bis 59 Jahre" : "ab 60 Jahren" };
}
/** Bereiche je Körperwert: grenzen (aufsteigend), Stufen [Name, Art]; Art gut, warn, ernst oder neutral */
function koerperZonen(p) {
  const wer = p.geschlecht === "w" ? "Frauen" : p.geschlecht === "m" ? "Männer" : null;
  const z = {
    bmi: { grenzen: [18.5, 25, 30], schritt: 0.1, stufen: [["Untergewicht", "warn"], ["Normalgewicht", "gut"], ["Übergewicht", "warn"], ["Adipositas", "ernst"]],
      wort: (v) => (v >= 30 ? `Adipositas Grad ${v >= 40 ? "III" : v >= 35 ? "II" : "I"}` : null), quelle: "WHO" },
    viszeral: { grenzen: [5, 10], bisInklusiv: true, stufen: [["Gut", "gut"], ["Hoch", "warn"], ["Sehr hoch", "warn"]], quelle: "laut Withings", hersteller: true },
  };
  const f = fettNorm(p);
  if (f) z.fett = { grenzen: f.grenzen, schritt: 0.1, stufen: [["Niedrig", "warn"], ["Normal", "gut"], ["Erhöht", "warn"], ["Stark erhöht", "ernst"]],
    quelle: "Gallagher 2000", gruppe: `${wer} ${f.gruppe}` };
  if (FFMI_GRENZE[p.geschlecht] && p.groesse) {
    const h2 = p.groesse * p.groesse;
    const kg = (x) => Math.round(x * 10) / 10; // wie angezeigt
    z.mager = { grenzen: [kg(FFMI_GRENZE[p.geschlecht] * h2)], stufen: [["Vermindert", "warn"], ["Normal", "gut"]], index: FFMI_GRENZE[p.geschlecht], quelle: "ESPEN" };
    z.asm = { grenzen: [kg(ASMI_GRENZE[p.geschlecht] * h2)], stufen: [["Niedrig", "warn"], ["Normal", "gut"]], index: ASMI_GRENZE[p.geschlecht], quelle: "EWGSOP2" };
  }
  return z;
}
/** Grundumsatz, den die Formel von Mifflin und St Jeor (Ernährungsmedizin) für Gewicht, Größe, Alter und Geschlecht erwarten lässt */
function grundumsatzErwartet(p, gewicht) {
  if (!p.groesse || p.alter == null || !p.geschlecht || !zahlOk(gewicht)) return null;
  return 10 * gewicht + 625 * p.groesse - 5 * p.alter + (p.geschlecht === "m" ? 5 : -161);
}
/** Muskeln an Armen und Beinen (Body Scan, je Körperbereich): Summe der letzten Messung */
function gliedmassenMuskeln(w) {
  const teile = [2, 3, 10, 11].map((pos) => letzter(wReihe(w, 175, pos)));
  if (!teile.every(Boolean)) return null;
  return { kg: teile.reduce((s, x) => s + x[1], 0), ts: Math.max(...teile.map((x) => x[0])) };
}
function zoneIndex(z, v) {
  for (let i = 0; i < z.grenzen.length; i++) if (z.bisInklusiv ? v <= z.grenzen[i] : v < z.grenzen[i]) return i;
  return z.grenzen.length;
}
/** Beschriftung der Bereiche, zum Beispiel „unter 18,5“, „18,5–24,9“, „ab 30“ */
function zoneTexte(z, stellen) {
  const f = (x) => zahl(x, Number.isInteger(x) && stellen > 0 ? 0 : stellen);
  const g = z.grenzen, n = g.length;
  const bis = (x) => f(z.schritt ? Math.round((x - z.schritt) * 10) / 10 : x);
  return z.stufen.map((_, i) => {
    if (i === 0) return z.bisInklusiv ? `bis ${f(g[0])}` : `unter ${f(g[0])}`;
    if (i === n) return z.bisInklusiv ? `über ${f(g[n - 1])}` : `ab ${f(g[n - 1])}`;
    return z.bisInklusiv ? `bis ${f(g[i])}` : `${f(g[i - 1])}–${bis(g[i])}`;
  });
}
/** Lage des Werts auf dem Balken (0 bis 1): jeder Bereich gleich breit, offene Ränder so breit wie ein innerer Bereich */
function zonePosition(z, v) {
  const g = z.grenzen, n = g.length + 1, i = zoneIndex(z, v);
  const breite = g.length > 1 ? (g[g.length - 1] - g[0]) / (g.length - 1) : Math.abs(g[0]) * 0.25 || 1;
  const lo = i === 0 ? g[0] - breite : g[i - 1];
  const hi = i === g.length ? g[g.length - 1] + breite : g[i];
  return (i + Math.min(0.94, Math.max(0.06, (v - lo) / (hi - lo)))) / n;
}

// Pulswellengeschwindigkeit: 90. Perzentil der Normalwerte nach Alter (m/s)
const PWV_GRENZE = [[29, 7.1], [39, 8.0], [49, 8.6], [59, 10.0], [69, 13.1], [999, 14.6]];
function spanne(a, b, einheit = "") {
  const f = (v) => zahl(v, Number.isInteger(v) ? 0 : 1);
  return `${f(a)}–${f(b)}${einheit ? ` ${einheit}` : ""}`;
}
function personAus(info, w) {
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
  const wg = wLetzte(w, 4);
  const groesse = cm ? cm / 100 : wg && wg[1] > 1 && wg[1] < 2.5 ? wg[1] : null;
  return { geschlecht, alter, groesse, fitness: fa };
}
function ekgKlasse(e) { // 0 unauffällig, 1 Vorhofflimmern, 2 nicht eindeutig, null ohne Auswertung
  if (e.afib === 0 || e.afib === 1 || e.afib === 2) return e.afib;
  const t = String(e.afib || "").toUpperCase();
  if (!t) return null;
  if (t.startsWith("NO_") || t.includes("SINUS") || t === "NORMAL") return 0;
  if (t.includes("FIBRILLATION") || t.includes("AFIB")) return 1;
  return 2;
}

let BEFUNDE = null;
async function befunde() {
  const stand = (Daten.index && Daten.index.stand) || "";
  const tag = heuteIso();
  if (BEFUNDE && BEFUNDE.stand === stand && BEFUNDE.tag === tag) return BEFUNDE.daten;
  let daten;
  try { daten = await befundeBerechnen(); }
  catch (e) { console.error(e); daten = { liste: [], ok: [], fehlt: [], map: {} }; }
  BEFUNDE = { stand, tag, daten };
  return daten;
}

async function befundeBerechnen() {
  const [w, info, ekgListe] = await Promise.all([Daten.withings(), Daten.info("garmin"), Daten.ekg()]);
  const p = personAus(info, w);
  const liste = [], ok = [], fehlt = [];
  const neu = (b) => liste.push({ stufe: "hinweis", tipps: [], ...b });
  const gut = (id, bereich, name, wert, ziel, link) => ok.push({ id, bereich, name, wert, ziel, link });
  const heute = heuteIso();
  const k = await kennzahlen(["ruhepuls", "schlaf_dauer", "schlaf_score", "schlaf_spo2", "schlaf_atem", "stress", "schritte",
    "im_mod", "im_int", "fitnessalter", "hrv_woche", "hrv_unten", "hrv_oben"], isoMinus(30));
  const werteAb = (r, von, bisOhne = null) => r.filter((x) => x[0] >= von && (!bisOhne || x[0] < bisOhne)).map((x) => x[1]).filter(Number.isFinite);
  const mittel7 = (r, mindestens = 3) => { const v = werteAb(r, isoMinus(6)); return v.length >= mindestens ? mittel(v) : null; };
  // Eingeordnet wird der Wert, der auch angezeigt wird – sonst stünde etwa „94 %“ da und gälte trotzdem als „unter 94 %“
  const rund = (v, stellen = 0) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** stellen) / 10 ** stellen);
  const tage = 86400000;

  // ---- Blutdruck: Mittel der Selbstmessung
  const bp = blutdruckMessungen(w);
  const bp7 = bp.filter((m) => m.ts >= Date.now() - 7 * tage), bp14 = bp.filter((m) => m.ts >= Date.now() - 14 * tage);
  const sehrHoch = bp7.filter((m) => m.sys >= 180 || m.dia >= 110).sort((a, b) => b.ts - a.ts)[0];
  if (sehrHoch) neu({ id: "blutdruck_einzel", bereich: "herz", stufe: "kritisch", name: "Blutdruck", link: "#herz",
    titel: "Sehr hoher Einzelwert beim Blutdruck", wert: `${sehrHoch.sys}/${sehrHoch.dia} mmHg`, bezug: `gemessen ${kurzZeit(sehrHoch.ts)}`,
    kurz: "Sehr hoher Einzelwert", text: "Werte ab 180/110 mmHg gelten als sehr hoch.",
    arzt: "Lass sehr hohe Werte zeitnah ärztlich abklären. Bei Brustschmerz, Atemnot, starken Kopfschmerzen, Seh- oder Sprachstörungen sofort den Notruf 112 wählen.",
    tipps: TIPPS.blutdruck.slice(-1) });
  const bpBasis = bp7.length >= 3 ? [bp7, "der letzten 7 Tage"] : bp14.length >= 3 ? [bp14, "der letzten 14 Tage"] : null;
  if (bpBasis) {
    const [l, zr] = bpBasis;
    const sys = rund(mittel(l.map((m) => m.sys))), dia = rund(mittel(l.map((m) => m.dia)));
    const wert = `${zahl(sys)}/${zahl(dia)} mmHg`, bezug = `Mittel ${zr} aus ${l.length} Messungen`;
    if (sys >= 135 || dia >= 85) neu({ id: "blutdruck", bereich: "herz", stufe: "kritisch", name: "Blutdruck", link: "#herz",
      titel: "Blutdruck über dem Grenzwert", wert, bezug, kurz: "Über 135/85", ziel: "unter 120/80 mmHg",
      text: "Bei der Selbstmessung zu Hause gilt ein Mittelwert ab 135/85 mmHg als Bluthochdruck. Optimal ist ein Mittel unter 120/80 mmHg.",
      arzt: "Lass die Werte ärztlich abklären – nimm dazu den Arztbericht aus der App mit.", tipps: TIPPS.blutdruck });
    else if (sys >= 120 || dia >= 80) neu({ id: "blutdruck", bereich: "herz", name: "Blutdruck", link: "#herz",
      titel: "Blutdruck über dem Optimalbereich", wert, bezug, kurz: "Optimal unter 120/80", ziel: "unter 120/80 mmHg",
      text: "Optimal ist ein Mittel unter 120/80 mmHg. Ab 135/85 mmHg spricht man bei der Selbstmessung zu Hause von Bluthochdruck.",
      tipps: TIPPS.blutdruck });
    else gut("blutdruck", "herz", "Blutdruck", wert, "unter 120/80 mmHg", "#herz");
  }

  // ---- Ruhepuls (Uhr)
  const rp = rund(mittel7(k.ruhepuls));
  if (rp != null) {
    const wert = `${zahl(rp)} bpm`, bezug = "Mittel der letzten 7 Tage";
    if (rp >= 100) neu({ id: "ruhepuls", bereich: "herz", stufe: "kritisch", name: "Ruhepuls", link: "#herz", titel: "Ruhepuls sehr hoch", wert, bezug,
      kurz: "Über 100 bpm", ziel: "unter 80 bpm", text: "Ein Ruhepuls über 100 Schlägen pro Minute ist zu hoch.",
      arzt: "Bitte ärztlich abklären lassen, vor allem bei Herzstolpern, Schwindel oder Atemnot.", tipps: TIPPS.ruhepuls });
    else if (rp >= 80) neu({ id: "ruhepuls", bereich: "herz", name: "Ruhepuls", link: "#herz", titel: "Ruhepuls im oberen Normalbereich", wert, bezug,
      kurz: "Günstig unter 80", ziel: "unter 80 bpm",
      text: "Normal sind 60 bis 100 Schläge pro Minute. In großen Studien ging ein Ruhepuls über 80 aber mit einem höheren Herz-Kreislauf-Risiko einher.",
      tipps: TIPPS.ruhepuls });
    else if (rp < 40) neu({ id: "ruhepuls", bereich: "herz", name: "Ruhepuls", link: "#herz", titel: "Ruhepuls sehr niedrig", wert, bezug,
      kurz: "Unter 40 bpm", ziel: "40–79 bpm", text: "Bei trainierten Ausdauersportlern ist ein so niedriger Ruhepuls normal.",
      arzt: "Wenn dir schwindelig wird, du dich schwach fühlst oder kurz ohnmächtig wirst, lass das ärztlich abklären." });
    else gut("ruhepuls", "herz", "Ruhepuls", wert, "unter 80 bpm", "#herz");
  }

  // ---- HRV-Status (Garmin, persönlicher Normalbereich)
  const hrvT = letzter(await Daten.texte("g.hrv.status", isoMinus(3)));
  if (hrvT) {
    const st = String(hrvT[1]).toUpperCase().replace(/^HRV_/, "");
    const wo = letzter(k.hrv_woche)?.[1], u = letzter(k.hrv_unten)?.[1], o = letzter(k.hrv_oben)?.[1];
    const wert = wo != null ? `${zahl(wo)} ms` : textDeutsch(st);
    const ziel = u != null && o != null ? `${zahl(u)}–${zahl(o)} ms (dein Normalbereich)` : "ausgeglichen";
    const texte = {
      UNBALANCED: ["HRV unausgeglichen", "Dein 7-Tage-Mittel liegt knapp außerhalb deines persönlichen Normalbereichs."],
      LOW: ["HRV niedrig", "Dein 7-Tage-Mittel liegt deutlich unter deinem persönlichen Normalbereich."],
      POOR: ["HRV schlecht", "Deine HRV liegt unter dem Wert, den Garmin für deine Altersgruppe als gesund ansieht."],
    };
    if (texte[st]) neu({ id: "hrv", bereich: "herz", name: "Herzfrequenzvariabilität", link: "#herz", titel: texte[st][0], wert,
      bezug: "7-Tage-Mittel laut Garmin", kurz: `Status ${textDeutsch(st)}`, ziel,
      text: `${texte[st][1]} Häufige Gründe sind Stress, wenig Schlaf, Alkohol, hartes Training oder ein beginnender Infekt.`, tipps: TIPPS.hrv });
    else if (st === "BALANCED") gut("hrv", "herz", "Herzfrequenzvariabilität", wert, ziel, "#herz");
  }

  // ---- Blutdruck-unabhängige Herzwerte der Body Scan: Gefäße und EKG
  const pwv = wReihe(w, 91).filter((x) => x[0] >= Date.now() - 30 * tage);
  if (pwv.length) {
    if (p.alter == null) fehlt.push("Pulswellengeschwindigkeit: Für den Vergleich mit Gleichaltrigen fehlt dein Alter im Garmin-Profil.");
    else {
      const grenze = PWV_GRENZE.find(([bis]) => p.alter <= bis)[1];
      const v = rund(mittel(pwv.slice(-3).map((x) => x[1])), 1);
      const wert = `${zahl(v, 1)} m/s`;
      if (v > grenze) neu({ id: "pwv", bereich: "herz", name: "Pulswellengeschwindigkeit", link: "#herz", titel: "Gefäße steifer als üblich", wert,
        bezug: `Mittel der letzten ${Math.min(3, pwv.length)} Messungen`, kurz: `Üblich bis ${zahl(grenze, 1)} m/s`, ziel: `bis ${zahl(grenze, 1)} m/s`,
        text: `Je schneller die Pulswelle läuft, desto steifer sind die Gefäße. Dein Wert liegt über dem, was 90 % der Gleichaltrigen mit normalem Blutdruck erreichen (${zahl(grenze, 1)} m/s).`,
        arzt: "Bleibt der Wert über Wochen erhöht, sprich ihn beim nächsten Arzttermin an.", tipps: TIPPS.gefaesse });
      else gut("pwv", "herz", "Pulswellengeschwindigkeit", wert, `bis ${zahl(grenze, 1)} m/s`, "#herz");
    }
  }
  // Das Gefäßalter schätzt Withings aus der Pulswellengeschwindigkeit; ärztlich zählt die Geschwindigkeit selbst (oben).
  const ekgNeu = ekgListe.filter((e) => e.ts && Date.now() - e.ts * 1000 < 90 * tage).sort((a, b) => b.ts - a.ts)[0];
  if (ekgNeu) {
    const kl = ekgKlasse(ekgNeu);
    const wann = `EKG vom ${datum(isoAusMs(ekgNeu.ts * 1000), "kurz")}`;
    if (kl === 1) neu({ id: "ekg", bereich: "herz", stufe: "kritisch", name: "EKG", link: `#ekg/${ekgNeu.q}/${ekgNeu.id}`, titel: "Hinweis auf Vorhofflimmern",
      wert: "Vorhofflimmern erkannt", bezug: wann, kurz: "Vorhofflimmern?", ziel: "Sinusrhythmus",
      text: "Die Auswertung des letzten EKG zeigt Hinweise auf Vorhofflimmern, eine Herzrhythmusstörung. Sie ist gut behandelbar, sollte aber ärztlich beurteilt werden.",
      arzt: "Bitte zeitnah ärztlich abklären und den Arztbericht mit dem EKG mitnehmen. Bei Brustschmerz, Atemnot oder Ohnmacht sofort den Notruf 112 wählen." });
    else if (kl === 2) neu({ id: "ekg", bereich: "herz", name: "EKG", link: `#ekg/${ekgNeu.q}/${ekgNeu.id}`, titel: "EKG nicht eindeutig",
      wert: "Nicht eindeutig", bezug: wann, kurz: "Nicht eindeutig", ziel: "eindeutige Messung",
      text: "Die letzte Aufzeichnung ließ sich nicht sicher auswerten – meist wegen Bewegung, zu wenig Hautkontakt oder einem sehr hohen oder niedrigen Puls.",
      arzt: "Bleiben die Messungen uneindeutig oder hast du Herzstolpern, lass das ärztlich abklären.", tipps: TIPPS.ekgUnklar });
    else if (kl === 0) gut("ekg", "herz", "EKG", "unauffällig", "Sinusrhythmus", "#herz");
  }
  const qtc = wLetzte(w, 138);
  if (qtc && Date.now() - qtc[0] < 90 * tage) {
    const grenze = p.geschlecht === "m" ? 450 : 460;
    const wert = `${zahl(qtc[1])} ms`, bezug = `EKG vom ${datum(isoAusMs(qtc[0]), "kurz")}`;
    if (Math.round(qtc[1]) > 500) neu({ id: "qtc", bereich: "herz", stufe: "kritisch", name: "QTc-Zeit", link: "#herz", titel: "QTc-Zeit deutlich verlängert", wert, bezug,
      kurz: `Normal unter ${grenze} ms`, ziel: `unter ${grenze} ms`, text: "Eine QTc-Zeit über 500 ms erhöht das Risiko für Herzrhythmusstörungen.",
      arzt: "Bitte zeitnah ärztlich abklären – besonders, wenn du Medikamente nimmst, denn manche verlängern die QT-Zeit." });
    else if (Math.round(qtc[1]) > grenze) neu({ id: "qtc", bereich: "herz", name: "QTc-Zeit", link: "#herz", titel: "QTc-Zeit verlängert", wert, bezug,
      kurz: `Normal unter ${grenze} ms`, ziel: `unter ${grenze} ms`, text: `Normal ist eine QTc-Zeit unter ${grenze} ms. Einzelne Messungen schwanken, wiederhole das EKG in Ruhe.`,
      arzt: "Sprich den Wert beim nächsten Arzttermin an, vor allem wenn du Medikamente nimmst." });
    else gut("qtc", "herz", "QTc-Zeit", wert, `unter ${grenze} ms`, "#herz");
  }

  // ---- Körper: BMI und Zusammensetzung (Withings)
  const gew = wLetzte(w, 1);
  if (gew && p.groesse && Date.now() - gew[0] < 60 * tage) {
    const bmi = rund(gew[1] / (p.groesse * p.groesse), 1);
    const wert = zahl(bmi, 1), bezug = `${zahl(gew[1], 1)} kg bei ${zahl(p.groesse * 100)} cm`;
    // Einstufung nach den BMI-Klassen der WHO: 25–29,9 Übergewicht (leicht), ab 30 Adipositas Grad I (erhöht),
    // ab 35 Adipositas Grad II und III (ärztlich besprechen); Untergewicht: 17–18,4 leicht, 16–16,9 mäßig, unter 16 ausgeprägt.
    if (bmi >= 25) {
      const grad = bmi >= 40 ? "III" : bmi >= 35 ? "II" : "I";
      neu({ id: "bmi", bereich: "koerper", name: "BMI", link: "#koerper",
        stufe: bmi >= 35 ? "kritisch" : bmi >= 30 ? "ernst" : "hinweis",
        titel: bmi >= 30 ? `BMI im Bereich Adipositas Grad ${grad}` : "BMI im Bereich Übergewicht",
        wert, bezug, kurz: bmi >= 30 ? `BMI ${wert}, Adipositas Grad ${grad}` : `BMI ${wert}, Übergewicht (normal bis 24,9)`, ziel: "18,5–24,9",
        text: "Die WHO stuft einen BMI von 18,5 bis 24,9 als Normalgewicht ein, 25 bis 29,9 als Übergewicht, 30 bis 34,9 als Adipositas Grad I, 35 bis 39,9 als Grad II und ab 40 als Grad III. Der BMI unterscheidet allerdings nicht zwischen Muskeln und Fett – aussagekräftiger ist dein Körperfettanteil.",
        arzt: bmi >= 35 ? "Ab einem BMI von 35 steigt das Risiko für Folgeerkrankungen deutlich. Besprich das bitte mit deiner Hausärztin oder deinem Hausarzt." : undefined,
        tipps: TIPPS.abnehmen });
    }
    else if (bmi < 18.5) neu({ id: "bmi", bereich: "koerper", name: "BMI", link: "#koerper",
      stufe: bmi < 16 ? "kritisch" : bmi < 17 ? "ernst" : "hinweis",
      titel: bmi < 17 ? "BMI deutlich unter dem Normalbereich" : "BMI unter dem Normalbereich", wert, bezug,
      kurz: `BMI ${wert}, normal ab 18,5`, ziel: "18,5–24,9", text: "Die WHO stuft einen BMI unter 18,5 als Untergewicht ein; unter 17 gilt es als mäßig, unter 16 als ausgeprägt.",
      arzt: "Wenn du ungewollt abnimmst, lass das ärztlich abklären.", tipps: TIPPS.zunehmen });
    else gut("bmi", "koerper", "BMI", wert, "18,5–24,9", "#koerper");
  }
  const letzteZus = letzter(wReihe(w, 76)) || letzter(wReihe(w, 6));
  if (letzteZus && Date.now() - letzteZus[0] < 90 * tage) {
    const g = wGruppe(w, letzteZus[2]);
    const bezug = `Messung vom ${datum(isoAusMs(letzteZus[0]), "kurz")}`;
    const zonen = koerperZonen(p);
    const ohneProfil = [];
    const wer = p.geschlecht === "w" ? "Frauen" : "Männer";
    // Körperfettanteil nach Gallagher und Kollegen (2000), abgeleitet aus den BMI-Grenzen der WHO
    if (g[6] != null) {
      if (!zonen.fett) ohneProfil.push(["Körperfettanteil", "Geschlecht und Alter"]);
      else {
        const [niedrig, hoch, sehr] = zonen.fett.grenzen;
        const i = zoneIndex(zonen.fett, rund(g[6], 1));
        const w_ = `${zahl(g[6], 1)} %`, ziel = `${zahl(niedrig)}–${zahl(hoch - 0.1, 1)} %`;
        const text = `Nach den Referenzwerten von Gallagher und Kollegen, die aus den BMI-Grenzen der WHO abgeleitet sind, ist für ${zonen.fett.gruppe} ein Körperfettanteil von ${ziel} normal; ab ${zahl(hoch)} % gilt er als erhöht, ab ${zahl(sehr)} % entspricht er dem Bereich der Adipositas. Die Waage schätzt den Wert über den elektrischen Widerstand des Körpers.`;
        if (i >= 2) neu({ id: "fett", bereich: "koerper", name: "Körperfettanteil", link: "#koerper", stufe: i === 3 ? "ernst" : "hinweis", titel: i === 3 ? "Körperfettanteil stark erhöht" : "Körperfettanteil erhöht",
          wert: w_, bezug, kurz: `Normal ${ziel}`, ziel, text, tipps: TIPPS.abnehmen });
        else if (i === 0) neu({ id: "fett", bereich: "koerper", name: "Körperfettanteil", link: "#koerper", titel: "Körperfettanteil niedrig",
          wert: w_, bezug, kurz: `Normal ${ziel}`, ziel, text, tipps: TIPPS.zunehmen });
        else gut("fett", "koerper", "Körperfettanteil", w_, ziel, "#koerper");
      }
    }
    // Muskeln an Armen und Beinen nach der europäischen Sarkopenie-Leitlinie EWGSOP2
    const glied = gliedmassenMuskeln(w);
    if (glied && Date.now() - glied.ts < 90 * tage) {
      if (!zonen.asm) ohneProfil.push(["Muskeln an Armen und Beinen", "Geschlecht und Größe"]);
      else {
        const grenze = zonen.asm.grenzen[0];
        const w_ = `${zahl(glied.kg, 1)} kg`, ziel = `ab ${zahl(grenze, 1)} kg`;
        if (rund(glied.kg, 1) < grenze) neu({ id: "muskel", bereich: "koerper", name: "Muskeln an Armen und Beinen", link: "#koerper", titel: "Muskelmasse an Armen und Beinen niedrig",
          wert: w_, bezug: `${zahl(glied.kg / (p.groesse * p.groesse), 1)} kg/m², Messung vom ${datum(isoAusMs(glied.ts), "kurz")}`, kurz: `Normal ab ${zahl(zonen.asm.index, 1)} kg/m²`, ziel,
          text: `Die europäische Sarkopenie-Leitlinie (EWGSOP2) wertet eine Muskelmasse an Armen und Beinen unter ${zahl(zonen.asm.index, 1)} kg je m² Körpergröße zum Quadrat bei ${wer} als niedrig – bei deiner Größe also unter ${zahl(grenze, 1)} kg. Die Waage schätzt diesen Wert; ärztlich wird zusätzlich die Kraft geprüft, etwa die Handkraft.`,
          arzt: "Kommen nachlassende Kraft oder ungewollter Gewichtsverlust dazu, lass das ärztlich abklären.", tipps: TIPPS.muskel });
        else gut("muskel", "koerper", "Muskeln an Armen und Beinen", w_, ziel, "#koerper");
      }
    }
    // Fettfreie Masse (Magermasse) nach ESPEN
    if (g[5] != null) {
      if (!zonen.mager) ohneProfil.push(["Magermasse", "Geschlecht und Größe"]);
      else {
        const grenze = zonen.mager.grenzen[0];
        const w_ = `${zahl(g[5], 1)} kg`, ziel = `ab ${zahl(grenze, 1)} kg`;
        if (rund(g[5], 1) < grenze) neu({ id: "mager", bereich: "koerper", name: "Magermasse", link: "#koerper", titel: "Fettfreie Masse vermindert",
          wert: w_, bezug: `${zahl(g[5] / (p.groesse * p.groesse), 1)} kg/m², ${bezug}`, kurz: `Normal ab ${zahl(zonen.mager.index)} kg/m²`, ziel,
          text: `Die Europäische Gesellschaft für klinische Ernährung (ESPEN) wertet bei ${wer} eine fettfreie Masse unter ${zahl(zonen.mager.index)} kg je m² Körpergröße zum Quadrat als vermindert – ein Kriterium für Mangelernährung.`,
          arzt: "Hast du ungewollt abgenommen, lass das ärztlich abklären.", tipps: TIPPS.muskel });
        else gut("mager", "koerper", "Magermasse", w_, ziel, "#koerper");
      }
    }
    if (ohneProfil.length) {
      const fehlend = [p.geschlecht ? null : "Geschlecht", p.alter == null ? "Alter" : null, p.groesse ? null : "Größe"].filter(Boolean);
      fehlt.push(`${ohneProfil.map((x) => x[0]).join(", ")}: Für die Einordnung ${fehlend.length > 1 ? "fehlen" : "fehlt"} ${fehlend.join(" und ") || "das Profil"} im Garmin-Profil.`);
    }
    // Viszeralfett: Index von Withings ohne ärztliche Norm – Einteilung von Withings, so gekennzeichnet
    if (g[170] != null) {
      const v = rund(g[170], 1);
      if (v > 5) neu({ id: "viszeral", bereich: "koerper", name: "Viszeralfett", link: "#koerper", titel: v > 10 ? "Viszeralfett laut Withings sehr hoch" : "Viszeralfett laut Withings hoch", wert: zahl(v, 1), bezug,
        kurz: "Laut Withings gut bis 5", ziel: "bis 5", text: `Viszeralfett liegt im Bauchraum um die Organe; viel davon erhöht das Risiko für Herz-Kreislauf-Erkrankungen und Diabetes. Den Index berechnet Withings selbst und stuft bis 5 als gut ein, bis 10 als hoch und darüber als sehr hoch. Eine ärztliche Norm gibt es dafür nicht: Ärztlich zählt der Bauchumfang, gemessen in Höhe des Bauchnabels – erhöhtes Risiko ab ${p.geschlecht === "m" ? "94" : "80"} cm, deutlich erhöht ab ${p.geschlecht === "m" ? "102" : "88"} cm (WHO).`,
        tipps: TIPPS.viszeral });
      else gut("viszeral", "koerper", "Viszeralfett", zahl(v, 1), "bis 5 (laut Withings)", "#koerper");
    }
  }
  const nervR = wReihe(w, 167).length ? wReihe(w, 167) : null;
  const nervWert = (() => {
    if (nervR) { const l = letzter(nervR); return Date.now() - l[0] < 90 * tage ? l : null; }
    const li = wLetzte(w, 158), re = wLetzte(w, 159);
    const l = [li, re].filter((x) => x && Date.now() - x[0] < 90 * tage);
    return l.length ? [Math.max(...l.map((x) => x[0])), Math.min(...l.map((x) => x[1]))] : null;
  })();
  if (nervWert) {
    const wert = `${zahl(nervWert[1])} von 100`;
    if (rund(nervWert[1]) < 50) neu({ id: "nerven", bereich: "koerper", name: "Nervengesundheit", link: "#koerper", titel: "Nervengesundheit der Füße niedrig", wert,
      bezug: `Messung vom ${datum(isoAusMs(nervWert[0]), "kurz")}`, kurz: "Normal über 50", ziel: "über 50",
      text: "Withings stuft Werte unter 50 als niedrig ein – ein mögliches Zeichen für eine Schädigung kleiner Nervenfasern an den Füßen (Neuropathie).",
      arzt: "Bei wiederholt niedrigen Werten, Taubheit, Kribbeln oder Brennen in den Füßen – und besonders bei Diabetes – lass das ärztlich abklären.",
      tipps: TIPPS.nerven });
    else gut("nerven", "koerper", "Nervengesundheit", wert, "über 50", "#koerper");
  }

  // ---- Schlaf und Erholung
  const alt65 = p.alter != null && p.alter >= 65;
  const [sMin, sMax] = alt65 ? [7, 8] : [7, 9];
  const sdRoh = mittel7(k.schlaf_dauer);
  const sd = sdRoh == null ? null : Math.round(sdRoh * 60) / 60; // auf Minuten genau, wie angezeigt
  if (sd != null) {
    const wert = dauer(sd * 3600), bezug = "Mittel der letzten 7 Nächte", ziel = `${sMin}–${sMax} Stunden`;
    const fuer = alt65 ? "Erwachsene ab 65" : "Erwachsene";
    if (sd < sMin) neu({ id: "schlafdauer", bereich: "schlaf", name: "Schlafdauer", link: "#schlaf", titel: sd < 6 ? "Deutlich zu wenig Schlaf" : "Etwas zu wenig Schlaf",
      wert, bezug, kurz: `Empfohlen ${sMin}–${sMax} Std.`, ziel, text: `Für ${fuer} empfiehlt die National Sleep Foundation ${sMin} bis ${sMax} Stunden Schlaf pro Nacht.`,
      tipps: TIPPS.schlafWenig });
    else if (sd > sMax) neu({ id: "schlafdauer", bereich: "schlaf", name: "Schlafdauer", link: "#schlaf", titel: "Mehr Schlaf als empfohlen", wert, bezug,
      kurz: `Empfohlen ${sMin}–${sMax} Std.`, ziel, text: `Für ${fuer} empfiehlt die National Sleep Foundation ${sMin} bis ${sMax} Stunden Schlaf pro Nacht.`,
      arzt: "Wenn du dauerhaft deutlich länger schläfst und dich trotzdem müde fühlst, lass das ärztlich abklären.", tipps: TIPPS.schlafViel });
    else gut("schlafdauer", "schlaf", "Schlafdauer", wert, ziel, "#schlaf");
  }
  const ss = rund(mittel7(k.schlaf_score));
  if (ss != null) {
    if (ss < 80) neu({ id: "schlafscore", bereich: "schlaf", name: "Schlafscore", link: "#schlaf", titel: ss < 60 ? "Schlafqualität schlecht" : "Schlafqualität ausbaufähig",
      wert: zahl(ss), bezug: "Mittel der letzten 7 Nächte", kurz: "Gut ab 80", ziel: "ab 80",
      text: "Garmin bewertet 90 bis 100 als ausgezeichnet, 80 bis 89 als gut, 60 bis 79 als mittel und darunter als schlecht. In den Score fließen Dauer, Tiefschlaf, REM-Schlaf, Wachphasen und Stress in der Nacht ein.",
      tipps: TIPPS.schlafQualitaet });
    else gut("schlafscore", "schlaf", "Schlafscore", zahl(ss), "ab 80", "#schlaf");
  }
  const sp = rund(mittel7(k.schlaf_spo2));
  if (sp != null) {
    if (sp < 94) neu({ id: "spo2", bereich: "schlaf", stufe: sp < 90 ? "kritisch" : "hinweis", name: "Sauerstoffsättigung", link: "#schlaf",
      titel: sp < 90 ? "Sauerstoffsättigung im Schlaf deutlich niedrig" : "Sauerstoffsättigung im Schlaf etwas niedrig", wert: `${zahl(sp)} %`, bezug: "Mittel der letzten 7 Nächte", kurz: "Normal ab 94 %", ziel: "ab 94 %",
      text: "Die British Thoracic Society nennt 94 bis 98 % als Normalbereich; wach liegen Gesunde unter 70 Jahren meist bei 96 bis 98 %. Im Schlaf ist die Sättigung etwas niedriger, kurze Abfälle sind normal. Ein Mittel unter 90 % spräche für einen nächtlichen Sauerstoffmangel. Die Messung am Handgelenk ist ungenau und fällt oft zu niedrig aus.",
      arzt: "Wenn du laut schnarchst, jemand Atemaussetzer bemerkt oder du tagsüber sehr müde bist, lass das ärztlich abklären (Verdacht auf Schlafapnoe).",
      tipps: ["Die Uhr nachts etwas enger und oberhalb des Handgelenkknochens tragen – das verbessert die Messung.",
        "Alkohol am Abend und Schlafmittel verschlechtern die Atmung im Schlaf.", "Übergewicht begünstigt Atemaussetzer im Schlaf."] });
    else gut("spo2", "schlaf", "Sauerstoffsättigung im Schlaf", `${zahl(sp)} %`, "ab 94 %", "#schlaf");
  }
  const at = rund(mittel7(k.schlaf_atem), 1);
  if (at != null) {
    if (at > 20 || at < 8) neu({ id: "atmung", bereich: "schlaf", name: "Atemfrequenz", link: "#schlaf",
      titel: at > 20 ? "Atemfrequenz im Schlaf erhöht" : "Atemfrequenz im Schlaf sehr niedrig", wert: `${zahl(at, 1)} pro Minute`, bezug: "Mittel der letzten 7 Nächte",
      kurz: "Normal bis 20/min", ziel: "bis 20 pro Minute", text: "In Ruhe atmen Erwachsene normalerweise 12- bis 20-mal pro Minute, im Schlaf eher etwas langsamer.",
      arzt: "Bleibt der Wert auffällig oder hast du Atemnot, Husten oder Fieber, lass das ärztlich abklären.",
      tipps: ["Ein vorübergehender Anstieg kann auf einen Infekt hinweisen – dann besser eine Trainingspause einlegen."] });
    else gut("atmung", "schlaf", "Atemfrequenz im Schlaf", `${zahl(at, 1)} pro Minute`, "bis 20 pro Minute", "#schlaf");
  }
  const stressV = werteAb(k.stress, isoMinus(7), heute).filter((v) => v >= 0);
  if (stressV.length >= 3) {
    const m = rund(mittel(stressV));
    if (m > 50) neu({ id: "stress", bereich: "schlaf", name: "Stress", link: "#schlaf", titel: "Stress im Alltag hoch", wert: zahl(m),
      bezug: "Tagesmittel der letzten 7 Tage", kurz: "Niedrig bis 50", ziel: "bis 50",
      text: "Garmin misst Stress über die Herzfrequenzvariabilität: 0 bis 25 ist Ruhe, 26 bis 50 niedrig, 51 bis 75 mittel und darüber hoch.",
      tipps: TIPPS.stress });
    else gut("stress", "schlaf", "Stress im Tagesmittel", zahl(m), "bis 50", "#schlaf");
  }

  // ---- Bewegung
  const schritteV = werteAb(k.schritte, isoMinus(7), heute);
  if (schritteV.length >= 4) {
    const m = rund(mittel(schritteV));
    if (m < 7000) neu({ id: "schritte", bereich: "bewegung", name: "Schritte", link: "#sport", titel: "Wenig Schritte", wert: zahl(m),
      bezug: "Mittel der letzten 7 Tage", kurz: `Mittel ${zahl(m)}, Ziel 7.000`, ziel: "ab 7.000 am Tag",
      text: "Eine große Auswertung vieler Studien (Lancet Public Health 2025) zeigt: Mit etwa 7.000 Schritten am Tag sinkt das Risiko für Herz-Kreislauf-Erkrankungen, Demenz und einen frühen Tod deutlich – verglichen mit 2.000 Schritten.",
      tipps: TIPPS.schritte });
    else gut("schritte", "bewegung", "Schritte", zahl(m), "ab 7.000 am Tag", "#sport");
  }
  const imTage = k.im_mod.filter((x) => x[0] >= isoMinus(7) && x[0] < heute);
  if (imTage.length >= 5) {
    const hoch = new Map(k.im_int);
    const summe = imTage.reduce((s_, [d, v]) => s_ + (v || 0) + 2 * (hoch.get(d) || 0), 0);
    if (summe < 150) neu({ id: "intensitaet", bereich: "bewegung", name: "Intensitätsminuten", link: "#sport", titel: "Weniger Bewegung als empfohlen",
      wert: `${zahl(summe)} Min.`, bezug: "Summe der letzten 7 Tage, intensive Minuten zählen doppelt", kurz: "Ziel 150 Min./Woche", ziel: "ab 150 Min. pro Woche",
      text: "Die WHO empfiehlt Erwachsenen pro Woche mindestens 150 bis 300 Minuten mäßige oder 75 bis 150 Minuten intensive Bewegung, dazu an 2 Tagen Krafttraining.",
      tipps: TIPPS.intensitaet });
    else gut("intensitaet", "bewegung", "Intensitätsminuten", `${zahl(summe)} Min.`, "ab 150 Min. pro Woche", "#sport");
  }
  const faTag = letzter(k.fitnessalter);
  const fa = rund(faTag && faTag[0] >= isoMinus(30) ? faTag[1] : Number.isFinite(p.fitness.fitnessAge) ? p.fitness.fitnessAge : null, 1);
  const lebensalter = p.alter ?? (Number.isFinite(p.fitness.chronologicalAge) ? p.fitness.chronologicalAge : null);
  if (fa != null && lebensalter != null) {
    const erreichbar = Number.isFinite(p.fitness.achievableFitnessAge) ? p.fitness.achievableFitnessAge : null;
    if (fa > lebensalter + 0.5) neu({ id: "fitnessalter", bereich: "bewegung", name: "Fitnessalter", link: "#sport", titel: "Fitnessalter über deinem Lebensalter",
      wert: `${zahl(fa, 1)} Jahre`, bezug: `Lebensalter ${lebensalter} Jahre`, kurz: `Lebensalter ${lebensalter}`, ziel: `höchstens ${lebensalter} Jahre`,
      text: `Garmin schätzt aus VO₂max, Ruhepuls, Körperfett und deinen intensiven Trainingstagen, wie fit du im Vergleich zu anderen bist.${erreichbar != null ? ` Erreichbar sind laut Garmin ${zahl(erreichbar, 1)} Jahre.` : ""}`,
      tipps: TIPPS.fitness });
    else gut("fitnessalter", "bewegung", "Fitnessalter", `${zahl(fa, 1)} Jahre`, `höchstens ${lebensalter} Jahre`, "#sport");
  }
  const tsT = letzter(await Daten.texte("g.trainingsstatus.trainingStatusFeedbackPhrase", isoMinus(7)));
  if (tsT) {
    const stamm = String(tsT[1]).replace(/_\d+$/, "");
    const st = {
      DETRAINING: ["Trainingsstatus: Leistungsabbau", "Training steigern", "Deine Trainingslast war zuletzt zu niedrig, um die Fitness zu halten – sie nimmt ab.", TIPPS.leistungsabbau],
      UNPRODUCTIVE: ["Trainingsstatus: unproduktiv", "Mehr Erholung", "Du trainierst, aber deine Fitness sinkt. Oft fehlt dann Erholung – zu wenig Schlaf, viel Stress oder zu viele harte Einheiten.", TIPPS.erholung],
      OVERREACHING: ["Trainingsstatus: Überlastung", "Mehr Erholung", "Deine Trainingslast ist sehr hoch und übersteigt, was dein Körper gerade verkraftet.", TIPPS.erholung],
      STRAINED: ["Trainingsstatus: überfordert", "Mehr Erholung", "Garmin sieht Zeichen, dass du dich nicht ausreichend erholst.", TIPPS.erholung],
    }[stamm];
    if (st) neu({ id: "trainingsstatus", bereich: "bewegung", name: "Trainingsstatus", link: "#sport", titel: st[0], wert: textDeutsch(tsT[1]),
      bezug: `Stand ${datum(tsT[0], "kurz")}`, kurz: st[1], ziel: "produktiv oder Leistung halten", text: st[2], tipps: st[3] });
    else gut("trainingsstatus", "bewegung", "Trainingsstatus", textDeutsch(tsT[1]), "produktiv oder Leistung halten", "#sport");
  }

  const ordnung = Object.fromEntries(BEREICHE.map(([id], i) => [id, i]));
  liste.sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === "kritisch" ? -1 : 1) || ordnung[a.bereich] - ordnung[b.bereich]);
  const map = {};
  for (const b of liste) if (!map[b.id]) map[b.id] = b;
  return { liste, ok, fehlt, map, person: p };
}

function befundBox(befundListe, { offen = false, mitLink = false } = {}) {
  const liste = befundListe.filter(Boolean);
  if (!liste.length) return null;
  return h("div", { class: "befunde" }, liste.map((b) => h("article", { class: `befund stufe-${b.stufe}` },
    h("div", { class: "befund-kopf" }, h("span", { class: "achtung" }, icon("achtung", 22)),
      h("div", null, h("h3", null, b.titel), h("p", { class: "befund-wert" }, h("b", null, b.wert),
        b.bezug ? h("span", null, b.bezug) : null, b.ziel ? h("span", { class: "befund-ziel" }, `Ziel: ${b.ziel}`) : null))),
    b.text ? h("p", { class: "befund-text" }, b.text) : null,
    GRUNDLAGE[b.id] ? h("p", { class: "befund-grundlage" }, `Grundlage: ${GRUNDLAGE[b.id]}`) : null,
    b.arzt ? h("p", { class: "befund-arzt" }, b.arzt) : null,
    b.tipps && b.tipps.length ? h("details", { class: "befund-tipps", open: offen || null }, h("summary", null, "Was du tun kannst"),
      h("ul", null, b.tipps.map((t) => h("li", null, t)))) : null,
    mitLink && b.link ? h("a", { class: "befund-link", href: b.link }, b.link.startsWith("#ekg") ? "EKG ansehen" : `Zum Bereich ${BEREICH_SEITE[b.link] || ""}`, icon("vor", 16)) : null)));
}

// ---- Zeitraum je Diagramm (wie in den Apps von Withings und Garmin)
const ZEITRAEUME = [["7", "7 T", "7 Tage"], ["30", "1 M", "1 Monat"], ["91", "3 M", "3 Monate"], ["182", "6 M", "6 Monate"], ["365", "12 M", "12 Monate"]];
const ZR_ALLE = ["alle", "Alle", "gesamter Zeitraum"];
const ZR_IN = { 7: "in den letzten 7 Tagen", 30: "im letzten Monat", 91: "in den letzten 3 Monaten", 182: "in den letzten 6 Monaten", 365: "in den letzten 12 Monaten", alle: "bisher" };
function zrAlle() { try { const o = JSON.parse(speicher.get(S.zeitraum) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } }
function zrGewaehlt(id, standard, erlaubt) { const z = zrAlle()[id]; return erlaubt.includes(z) ? z : standard; }
function zrMerken(id, wert) { const o = zrAlle(); o[id] = wert; speicher.set(S.zeitraum, JSON.stringify(o)); }
function zrVon(z) { return z === "alle" ? null : isoMinus(+z - 1); }
function zrWochen(z) { return z === "alle" || +z > 91; }
function montagIso(iso) { const d = new Date(tagMs(iso)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDatum(d); }
/** Tageswerte oder Einzelmessungen zu Wochenwerten (Woche ab Montag) */
function nachWochen(daten, art = "mittel") {
  const m = new Map();
  for (const p of daten) {
    if (!Number.isFinite(p[1])) continue;
    const k = montagIso(typeof p[0] === "number" ? isoAusMs(p[0]) : p[0]);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p[1]);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, l]) => [k, art === "summe" ? l.reduce((a, b) => a + b, 0) : mittel(l)]);
}
function imBereich(daten, von) {
  if (!von) return daten;
  const ms = tagMs(von);
  return daten.filter((p) => (typeof p[0] === "number" ? p[0] >= ms : p[0] >= von));
}
function statistik(daten, stellen = 0, einheit = "", fmt = null) {
  const v = daten.map((p) => p[1]).filter(Number.isFinite);
  if (!v.length) return [];
  const f = fmt || ((x) => zahl(x, stellen));
  return [{ name: "Mittel", wert: f(mittel(v)), einheit }, { name: "Tiefst", wert: f(Math.min(...v)), einheit }, { name: "Höchst", wert: f(Math.max(...v)), einheit }];
}
function veraenderung(daten, stellen, einheit) {
  if (daten.length < 2) return null;
  const d = daten[daten.length - 1][1] - daten[0][1];
  return { name: "Veränderung", wert: vorzeichen(d, stellen), einheit: einheit === "%" ? "Punkte" : einheit };
}
function kennzahlenZeile(liste) {
  return h("dl", { class: "verlauf-werte" }, liste.filter(Boolean).map((k) =>
    h("div", null, h("dt", null, k.name), h("dd", null, k.wert, k.einheit ? h("small", null, k.einheit) : null))));
}
function diagrammeIn(box) {
  if (!window.echarts) return;
  box.querySelectorAll(".flaeche").forEach((el) => { const c = echarts.getInstanceByDom(el); if (c) { DIAGRAMME.delete(c); groesse.unobserve(el); c.dispose(); } });
}
/** Verlaufskarte mit eigenem Zeitraum-Umschalter (7 Tage bis 12 Monate), Kennzahlen zum Zeitraum und Tabellenansicht.
 *  laden({von, tage, wochen, wahl, zr}) liefert {serien, opt, werte, liste, fussnote, tabelle, legende, leerText, unten} */
async function verlauf({ id, titel = null, name = null, auswahl = null, laden, hoehe = "", standard = "30", mitAlle = false }) {
  const liste = mitAlle ? [...ZEITRAEUME, ZR_ALLE] : ZEITRAEUME;
  let zr = zrGewaehlt(id, standard, liste.map((x) => x[0]));
  const ids = auswahl ? auswahl.map((a) => String(a.id)) : [];
  let wahl = auswahl && auswahl.length ? zrGewaehlt(`${id}.wahl`, ids[0], ids) : null;
  const benannt = titel || name;
  const seg = h("div", { class: "segmente zr", role: "group", "aria-label": benannt ? `Zeitraum für ${benannt}` : "Zeitraum" });
  const chipsBox = auswahl && auswahl.length > 1 ? chipsRand(h("div", { class: "chips", role: "group", "aria-label": benannt ? `${benannt}: Auswahl` : "Auswahl" })) : null;
  const inhalt = h("div", { class: "verlauf-inhalt" });
  const karte = h("div", { class: "verlauf" }, h("div", { class: "verlauf-kopf" }, titel ? h("h3", null, titel) : null, seg), chipsBox, inhalt);
  let nr = 0;
  const zeige = async () => {
    const meins = ++nr;
    seg.replaceChildren(...liste.map(([z, kurz, lang]) => h("button", { type: "button", "aria-pressed": String(z === zr), "aria-label": lang, title: lang,
      onclick: () => { if (z !== zr) { zr = z; zrMerken(id, z); zeige(); } } }, kurz)));
    if (chipsBox) chipsBox.replaceChildren(...auswahl.map((a) => h("button", { type: "button", "aria-pressed": String(String(a.id) === wahl),
      onclick: () => { if (String(a.id) !== wahl) { wahl = String(a.id); zrMerken(`${id}.wahl`, wahl); zeige(); } } }, a.name)));
    const von = zrVon(zr);
    let e;
    try { e = (await laden({ von, tage: zr === "alle" ? null : +zr, wochen: zrWochen(zr), wahl, zr })) || {}; }
    catch (fehler) { console.error(fehler); e = { leerText: "Diese Werte konnten nicht geladen werden." }; }
    if (meins !== nr) return;
    diagrammeIn(inhalt);
    const vorher = NACH.length;
    const hatDaten = (e.serien || []).some((x) => x && !x.unsichtbar && x.daten && x.daten.length);
    const teile = [];
    if (hatDaten && e.werte && e.werte.filter(Boolean).length) teile.push(kennzahlenZeile(e.werte));
    if (hatDaten && e.liste) teile.push(werteListe(e.liste));
    if (hatDaten) {
      const serien = e.serien.filter(Boolean);
      const o = e.opt || {};
      const halb = 43200000;
      const xMin = von ? (o.mitUhrzeit ? tagMs(von) : tagMs(o.wochen ? montagIso(von) : von) - halb) : undefined;
      const xMax = von ? (o.mitUhrzeit ? tagMs(heuteIso()) + 86399999 : tagMs(o.wochen ? montagIso(heuteIso()) : heuteIso()) + halb) : undefined;
      teile.push(figur({ serien, hoehe, fussnote: e.fussnote, tabelle: e.tabelle, legende: e.legende, opt: { xMin, xMax, spanne: von ? +zr : undefined, ...o } }));
    } else {
      teile.push(leer(e.leerText || `Keine Werte ${ZR_IN[zr]}`, zr === "365" || zr === "alle" ? "" : "Wähle oben einen längeren Zeitraum."));
    }
    if (e.unten) teile.push(e.unten);
    inhalt.replaceChildren(...teile.filter(Boolean));
    if (inhalt.isConnected) {
      const auftraege = NACH.splice(vorher);
      requestAnimationFrame(() => auftraege.forEach((f) => { try { f(); } catch (x) { console.error(x); } }));
    }
  };
  karte.neuLaden = zeige;
  await zeige();
  return karte;
}

// ======================================================================
// Ansicht: Heute
// ======================================================================
async function ansichtHeute() {
  const heute = heuteIso();
  const von = isoMinus(100);
  const [w, akt, ekgListe] = await Promise.all([Daten.withings(), Daten.aktivitaeten(), Daten.ekg()]);
  const k = await kennzahlen(["schritte", "schrittziel", "ruhepuls", "schlaf_dauer", "schlaf_score", "bb_aktuell", "bb_hoch", "hrv",
    "bereitschaft", "vo2lauf", "stress", "etagen", "im_mod", "im_int", "aktivkcal", "strecke"], von);
  const [hrvText, bereitText] = await Promise.all([Daten.texte("g.hrv.status", isoMinus(10)), Daten.texte("g.bereitschaft.level", isoMinus(10))]);
  const bf = (await befunde()).map;
  const knoten = [];

  // ---- Begrüßung und Lagebericht
  const stunde = new Date().getHours();
  const gruss = stunde < 5 ? "Gute Nacht" : stunde < 11 ? "Guten Morgen" : stunde < 17 ? "Guten Tag" : stunde < 23 ? "Guten Abend" : "Gute Nacht";
  knoten.push(h("p", { class: "begruessung" }, `${gruss}. Heute ist ${datum(heute, "lang")}.`));
  const brief = h("p", { class: "brief" });
  const satz = (...teile) => { if (brief.childNodes.length) brief.append(" "); teile.flat(3).forEach((t) => brief.append(t)); };
  const fett = (t) => h("strong", null, t);
  const schlafH = amTag(k.schlaf_dauer, heute);
  if (schlafH != null) {
    const score = amTag(k.schlaf_score, heute);
    satz("Letzte Nacht hast du ", fett(dauer(schlafH * 3600)), " geschlafen", score != null ? [", Schlafscore ", fett(zahl(score))] : [], ".");
  }
  const bp = blutdruckMessungen(w);
  const bpLetzte = bp[bp.length - 1];
  if (bpLetzte && Date.now() - bpLetzte.ts < 3 * 86400000) {
    const [klasse] = bpKlasse(bpLetzte.sys, bpLetzte.dia);
    const tag = isoAusMs(bpLetzte.ts);
    const stundeBp = new Date(bpLetzte.ts).getHours();
    const tageszeit = istMorgens(bpLetzte.ts) ? "früh" : stundeBp >= 17 ? "Abend" : "Nachmittag";
    const wann = tag === heute ? `Heute ${tageszeit}` : tag === isoMinus(1) ? `Gestern ${tageszeit}` : `Am ${datum(tag, "wochentag")}`;
    satz(`${wann} lag dein Blutdruck bei `, fett(`${zahl(bpLetzte.sys)}/${zahl(bpLetzte.dia)}`), " (", h("span", { class: "einstufung" }, klasse), ").");
  }
  const gew = wReihe(w, 1);
  const gLetzt = letzter(gew);
  if (gLetzt && Date.now() - gLetzt[0] < 4 * 86400000) {
    const vorher = vorTagen(gew, 30, gLetzt[0]);
    let vergleich = "";
    if (vorher != null) {
      const d = gLetzt[1] - vorher;
      vergleich = Math.abs(d) < 0.05 ? " – so viel wie vor einem Monat" : `, ${zahl(Math.abs(d), 1)} kg ${d < 0 ? "weniger" : "mehr"} als vor einem Monat`;
    }
    satz("Gewicht ", fett(`${zahl(gLetzt[1], 1)} kg`), vergleich, ".");
  }
  const bbJetzt = amTag(k.bb_aktuell, heute), schritteHeute = amTag(k.schritte, heute);
  if (bbJetzt != null || schritteHeute != null) {
    satz(bbJetzt != null ? ["Body Battery ", fett(zahl(bbJetzt))] : [], bbJetzt != null && schritteHeute != null ? ", bisher " : schritteHeute != null ? "Bisher " : "",
      schritteHeute != null ? [fett(zahl(schritteHeute)), " Schritte"] : [], ".");
  }
  if (!brief.childNodes.length) brief.append("Für heute sind noch keine neuen Werte da. Sobald deine Uhr, die Waage oder das Blutdruckmessgerät synchronisiert haben, erscheinen sie hier.");
  knoten.push(brief);

  // ---- Kacheln
  const kacheln = [];
  const ringeKachel = eTagesringe(k, heute);
  if (ringeKachel) kacheln.push(ringeKachel);
  if (bp.length) {
    const woche = bp.filter((m) => m.ts >= Date.now() - 7 * 86400000);
    const mo = woche.filter((m) => istMorgens(m.ts)), ab = woche.filter((m) => !istMorgens(m.ts));
    const fmt = (l) => (l.length ? `${zahl(mittel(l.map((m) => m.sys)))}/${zahl(mittel(l.map((m) => m.dia)))}` : "–");
    const alle7 = woche.length ? [mittel(woche.map((m) => m.sys)), mittel(woche.map((m) => m.dia))] : null;
    kacheln.push(kachel({
      titel: "Blutdruck, Mittel 7 Tage", link: "#herz", befund: bf.blutdruck_einzel || bf.blutdruck,
      extra: h("div", { class: "paar" }, h("div", null, h("span", null, "Morgens"), h("b", null, fmt(mo))), h("div", null, h("span", null, "Abends"), h("b", null, fmt(ab)))),
      unter: !alle7 ? "keine Messung in 7 Tagen" : bf.blutdruck_einzel || bf.blutdruck ? "" : chip(alle7[0] >= 135 || alle7[1] >= 85 ? "über 135/85" : "unter 135/85", alle7[0] >= 135 || alle7[1] >= 85 ? "ernst" : "gut"),
    }));
  }
  const pers = personAus(await Daten.info("garmin"), w), zon = koerperZonen(pers);
  // Einstufung als Klartext unter dem Wert, zum Beispiel „BMI 29,4 · Übergewicht“; Farbe wie die Stufe der Kachel
  const einstufung = (text, befund) => (text ? h("span", { class: `kachel-einstufung stufe-${befund ? befund.stufe || "hinweis" : "gut"}` }, text) : null);
  const wortVon = (z, v) => (z ? (z.wort && z.wort(v)) || z.stufen[zoneIndex(z, v)][0] : null);
  const bmiWert = gLetzt && pers.groesse ? Math.round(gLetzt[1] / (pers.groesse * pers.groesse) * 10) / 10 : null;
  if (gLetzt) {
    const t = wTaeglich(gew).filter((p) => p[0] >= isoMinus(90));
    kacheln.push(kachel({ titel: "Gewicht", wert: zahl(gLetzt[1], 1), einheit: "kg", link: "#koerper", funkeDaten: t, befund: bf.bmi,
      extra: bmiWert != null ? einstufung(`BMI ${zahl(bmiWert, 1)} · ${wortVon(zon.bmi, bmiWert)}`, bf.bmi) : null,
      unter: deltaText(gLetzt[1], vorTagen(gew, 30, gLetzt[0]), 1, "kg", "in 30 Tagen") }));
  }
  const fett6 = wReihe(w, 6);
  if (fett6.length) {
    const l = letzter(fett6);
    kacheln.push(kachel({ titel: "Körperfett", wert: zahl(l[1], 1), einheit: "%", link: "#koerper", funkeDaten: wTaeglich(fett6).filter((p) => p[0] >= isoMinus(90)), befund: bf.fett,
      extra: zon && zon.fett ? einstufung(wortVon(zon.fett, Math.round(l[1] * 10) / 10), bf.fett) : null,
      unter: deltaText(l[1], vorTagen(fett6, 30, l[0]), 1, "Punkte", "in 30 Tagen") }));
  }
  const sd = letzter(k.schlaf_dauer);
  if (sd) {
    const score = amTag(k.schlaf_score, sd[0]);
    kacheln.push(kachel({ titel: sd[0] === heute ? "Schlaf letzte Nacht" : `Schlaf ${datum(sd[0], "wochentag")}`, wert: dauer(sd[1] * 3600, false), einheit: "Std.", link: "#schlaf",
      befund: bf.schlafdauer || bf.schlafscore,
      unter: score != null ? `Schlafscore ${zahl(score)}` : "", funkeDaten: k.schlaf_dauer.filter((p) => p[0] >= isoMinus(30)) }));
  }
  const rp = letzter(k.ruhepuls);
  if (rp) {
    const m30 = mittel(k.ruhepuls.filter((p) => p[0] >= isoMinus(30)).map((p) => p[1]));
    kacheln.push(kachel({ titel: "Ruhepuls", wert: zahl(rp[1]), einheit: "bpm", link: "#herz", funkeDaten: k.ruhepuls.filter((p) => p[0] >= isoMinus(30)), befund: bf.ruhepuls,
      unter: m30 != null ? `Mittel 30 Tage ${zahl(m30)}` : "" }));
  }
  const hrv = letzter(k.hrv);
  if (hrv) kacheln.push(kachel({ titel: "HRV letzte Nacht", wert: zahl(hrv[1]), einheit: "ms", link: "#herz", funkeDaten: k.hrv.filter((p) => p[0] >= isoMinus(30)), befund: bf.hrv,
    unter: letzter(hrvText) ? `Status ${textDeutsch(letzter(hrvText)[1])}` : "" }));
  if (schritteHeute != null) {
    const ziel = amTag(k.schrittziel, heute) || letzter(k.schrittziel)?.[1];
    kacheln.push(kachel({ titel: "Schritte heute", wert: zahl(schritteHeute), link: "#sport", befund: bf.schritte,
      extra: ziel ? h("div", { class: "messer", role: "meter", "aria-valuemin": 0, "aria-valuemax": ziel, "aria-valuenow": schritteHeute, "aria-label": "Schrittziel" },
        h("i", { style: { width: `${Math.min(100, (schritteHeute / ziel) * 100)}%` } })) : null,
      unter: ziel ? `Ziel ${zahl(ziel)}` : "" }));
  }
  const ber = letzter(k.bereitschaft);
  if (ber && ber[0] >= isoMinus(2)) kacheln.push(kachel({ titel: "Trainingsbereitschaft", wert: zahl(ber[1]), link: "#sport",
    unter: letzter(bereitText) ? textDeutsch(letzter(bereitText)[1]) : "", funkeDaten: k.bereitschaft.filter((p) => p[0] >= isoMinus(30)) }));
  const bbh = amTag(k.bb_hoch, heute);
  if (bbJetzt != null) kacheln.push(kachel({ titel: "Body Battery", wert: zahl(bbJetzt), link: "#tag", unter: bbh != null ? `Tageshöchstwert ${zahl(bbh)}` : "" }));
  const vo2 = letzter(k.vo2lauf);
  if (vo2) kacheln.push(kachel({ titel: "VO₂max Laufen", wert: zahl(vo2[1], 1), link: "#sport", funkeDaten: k.vo2lauf,
    unter: deltaText(vo2[1], vorTagen(k.vo2lauf, 90), 1, "", "in 90 Tagen") }));
  if (kacheln.length) knoten.push(h("div", { class: "kacheln" }, kacheln));

  // ---- Zuletzt
  const zuletzt = akt.slice(0, 4);
  const neuesEkg = ekgListe.find((e) => e.ts && Date.now() - e.ts * 1000 < 30 * 86400000);
  if (zuletzt.length || neuesEkg) {
    knoten.push(abschnitt("Zuletzt", null, h("ul", { class: "liste" },
      zuletzt.map((a) => h("li", null, aktivitaetZeile(a))),
      neuesEkg ? h("li", null, ekgZeile(neuesEkg, w)) : null),
      akt.length > 4 ? h("div", { class: "knopf-zeile" }, h("a", { class: "knopf zweit", href: "#sport" }, "Alle Aktivitäten")) : null));
  }
  if (!Daten.index.eingerichtet) knoten.push(hinweis("Withings und Garmin sind noch nicht verbunden. Starte auf dem Chromebook das Einrichtungsfenster und folge den Schritten."));
  else knoten.push(h("div", { class: "abschnitt" }, h("a", { class: "bericht-link", href: "#bericht" }, icon("bericht", 22),
    h("span", null, h("b", null, "Arztbericht als PDF"), h("span", null, "Blutdruck, EKG, Körper, Schlaf und Aktivität für den nächsten Termin")), icon("vor", 20))));
  return { titel: "Heute", knoten };
}

function aktivitaetZeile(a) {
  const laufen = istLauf(a.typ);
  const zahlen = [];
  if (a.distanz) zahlen.push(["km", zahl(a.distanz / 1000, a.distanz >= 100000 ? 0 : 1)]);
  zahlen.push(["Dauer", dauer(a.dauer, false)]);
  if (a.distanz && a.tempo) zahlen.push([laufen ? "min/km" : "km/h", tempoText(a.tempo, laufen)]);
  else if (a.hf) zahlen.push(["Puls", zahl(a.hf)]);
  return h("a", { class: "zeile", href: `#aktivitaet/${a.id}` },
    h("span", { class: "symbol" }, icon(sportIcon(a.typ))),
    h("span", { class: "haupt" }, h("b", null, a.name || sportName(a.typ)), h("span", null, `${datum(a.start.slice(0, 10), "wochentag")}, ${a.start.slice(11, 16)} Uhr`)),
    h("span", { class: "kennzahlen" }, zahlen.map(([n, v]) => h("div", null, h("b", null, v), h("span", null, n)))));
}
function ekgZeile(e) {
  const [text, art] = AFIB[e.afib] || [e.afib != null ? String(e.afib) : "ohne Auswertung", "neutral"];
  return h("a", { class: "zeile", href: `#ekg/${e.q}/${e.id}` },
    h("span", { class: "symbol" }, icon("ekg")),
    h("span", { class: "haupt" }, h("b", null, `EKG, ${e.ts ? `${datum(isoAusMs(e.ts * 1000), "wochentag")}, ${uhr(e.ts * 1000)} Uhr` : ""}`),
      h("span", { style: { marginTop: "4px" } }, chip(text, art))),
    h("span", { class: "kennzahlen" }, h("div", null, h("b", null, e.hf ? zahl(e.hf) : "–"), h("span", null, "bpm"))));
}

// ======================================================================
// Ansicht: Körper
// ======================================================================
async function ansichtKoerper() {
  const [w, info] = await Promise.all([Daten.withings(), Daten.info("withings")]);
  const bf = (await befunde()).map;
  const knoten = [];
  if (!wReihe(w, 1).length && !wReihe(w, 76).length) {
    knoten.push(leer("Noch keine Körperwerte", "Sobald die Body Scan Messungen an Withings übertragen hat, erscheinen hier Gewicht, Zusammensetzung und Körperregionen."));
    return { titel: "Körper", knoten };
  }
  // ---- Gewicht
  const zg = ((info.ziele || {}).goals || {}).weight;
  const ziel = zg && zahlOk(zg.value) ? zg.value * Math.pow(10, zg.unit || 0) : null;
  const gewichtAlle = wTaeglich(wReihe(w, 1));
  const gl = letzter(gewichtAlle);
  const groesse_ = letzter(wReihe(w, 4));
  if (gewichtAlle.length) {
    knoten.push(abschnitt("Gewicht", gl ? `Zuletzt ${zahl(gl[1], 1)} kg am ${datum(gl[0], "kurz")}${groesse_ ? `, BMI ${zahl(gl[1] / (groesse_[1] * groesse_[1]), 1)}` : ""}` : null,
      befundBox([bf.bmi]),
      await verlauf({ id: "gewicht", laden: ({ von, wochen }) => {
        const roh = imBereich(gewichtAlle, von);
        return {
          serien: [{ name: "Gewicht", daten: wochen ? nachWochen(roh) : roh, slot: 1, stellen: 1, einheit: "kg", endWert: true }],
          opt: { referenzen: ziel ? [{ wert: ziel, text: `Ziel ${zahl(ziel, 1)} kg` }] : [], wochen },
          werte: [...statistik(roh, 1, "kg"), veraenderung(roh, 1, "kg")],
          fussnote: wochen ? `Wochenmittel aus ${roh.length} Messtagen` : `${roh.length} Messtage`,
        };
      } })));
  }

  // ---- Muskeln und Fett als Körperfigur: immer sichtbar, die Einzelwerte je Bereich weiter unten zum Aufklappen
  const mf = await muskelFettAbschnitte(w);
  if (mf.figur) knoten.push(mf.figur);

  // ---- Zusammensetzung (letzte vollständige Messung)
  const letzteVoll = letzter(wReihe(w, 76));
  if (letzteVoll) {
    const g = wGruppe(w, letzteVoll[2]);
    const gewichtG = g[1];
    const teile = [["Fettmasse", g[8], 2], ["Muskelmasse", g[76], 1], ["Knochenmasse", g[88], 3]];
    const rest = gewichtG != null ? gewichtG - (g[8] || 0) - (g[76] || 0) - (g[88] || 0) : null;
    if (rest != null && rest > 0.05) teile.push(["Übrige fettfreie Masse", rest, 4]);
    const summe = teile.reduce((x, t_) => x + (t_[1] || 0), 0);
    const balken = h("div", { class: "segmentbalken", role: "img", "aria-label": teile.map((t_) => `${t_[0]} ${zahl(t_[1], 1)} kg`).join(", ") },
      teile.filter((t_) => t_[1] > 0).map(([name, v, slot]) => {
        const anteil = v / summe;
        return h("div", { class: slot === 4 && !istDunkel() ? "dunkle-schrift" : "", style: { flex: `${anteil} 1 0`, background: farbe(slot) }, title: `${name}: ${zahl(v, 1)} kg (${zahl(anteil * 100)} %)` },
          anteil > 0.11 ? `${zahl(anteil * 100)} %` : "");
      }));
    const vor30 = (typ) => vorTagen(wReihe(w, typ), 30, letzteVoll[0]);
    const p = personAus(await Daten.info("garmin"), w);
    const zonen = koerperZonen(p);
    const delta = (typ, stellen, einheit) => deltaText(g[typ], vor30(typ), stellen, einheit, "in 30 Tagen");
    const marker = (typ, name, stellen, einheit, zone, befund = null, neben = null) => (g[typ] != null ? { name, zahl: g[typ], wert: zahl(g[typ], stellen), einheit, stellen,
      zone: zone || null, befund, neben: neben ?? delta(typ, stellen, einheit) } : null);
    const index = (kg) => (p.groesse ? `${zahl(kg / (p.groesse * p.groesse), 1)} kg/m²` : null);
    const bmi = gewichtG && p.groesse ? gewichtG / (p.groesse * p.groesse) : null;
    const glied = gliedmassenMuskeln(w);
    const erwartet = grundumsatzErwartet(p, gewichtG);
    // Ärztlich eingeordnet (mit Balken): was eine ärztliche Norm hat; das Viszeralfett nach Withings ist gekennzeichnet
    const bewertet = [
      marker(6, "Körperfettanteil", 1, "%", zonen.fett, bf.fett, g[8] != null ? [`${zahl(g[8], 1)} kg Fettmasse`, delta(8, 1, "kg")].filter(Boolean).join(", ") : null),
      bmi ? { name: "Body-Mass-Index", zahl: bmi, wert: zahl(bmi, 1), einheit: "", stellen: 1, zone: zonen.bmi, befund: bf.bmi, neben: `${zahl(gewichtG, 1)} kg bei ${zahl(p.groesse * 100)} cm` } : null,
      glied ? { name: "Muskeln an Armen und Beinen", zahl: glied.kg, wert: zahl(glied.kg, 1), einheit: "kg", stellen: 1, zone: zonen.asm || null, befund: bf.muskel,
        neben: [index(glied.kg), datum(isoAusMs(glied.ts)) !== datum(isoAusMs(letzteVoll[0])) ? `Messung vom ${datum(isoAusMs(glied.ts), "kurz")}` : null].filter(Boolean).join(", ") } : null,
      marker(5, "Magermasse", 1, "kg", zonen.mager, bf.mager, g[5] != null ? [index(g[5]), delta(5, 1, "kg")].filter(Boolean).join(", ") : null),
      marker(170, "Viszeralfett", 1, "", zonen.viszeral, bf.viszeral),
    ];
    // Ohne ärztliche Norm für Waagen: nur der Wert
    const ohneNorm = [
      marker(76, "Muskelmasse gesamt", 1, "kg"),
      marker(77, "Körperwasser", 1, "kg", null, null, g[77] != null && gewichtG ? [`${zahl((g[77] / gewichtG) * 100)} % des Gewichts`, delta(77, 1, "kg")].filter(Boolean).join(", ") : null),
      marker(88, "Knochenmasse", 1, "kg"),
      marker(226, "Grundumsatz", 0, "kcal", null, null, erwartet ? `erwartet etwa ${zahl(Math.round(erwartet / 10) * 10)} kcal (Mifflin-St Jeor)` : null),
      marker(168, "Extrazelluläres Wasser", 1, "kg"), marker(169, "Intrazelluläres Wasser", 1, "kg"),
      marker(227, "Stoffwechselalter", 0, "Jahre", null, null, p.alter != null ? `Lebensalter ${p.alter} Jahre` : null),
    ];
    const stufeVon = (z, v) => (z ? ((z.wort && z.wort(v)) || z.stufen[zoneIndex(z, v)][0]) : null);
    // Entwicklung der letzten 30 Tage, wie Withings sie zusammenfasst
    const m30 = vor30(76), f30 = vor30(8);
    const trend = g[76] != null && g[8] != null && m30 != null && f30 != null
      ? { wort: koerperTrendWort(g[76] - m30, g[8] - f30), muskel: g[76] - m30, fett: g[8] - f30 } : null;
    const kurz = [g[6] != null && zonen.fett ? `Körperfett ${zahl(g[6], 1)} % ${stufeVon(zonen.fett, Math.round(g[6] * 10) / 10).toLowerCase()}` : null,
      bmi ? `BMI ${zahl(bmi, 1)} ${stufeVon(zonen.bmi, Math.round(bmi * 10) / 10)}` : null, trend ? `30\u00a0Tage: ${trend.wort}` : null].filter(Boolean).join(", ");
    knoten.push(klappAbschnitt("zusammensetzung", "Zusammensetzung", `Messung vom ${datum(isoAusMs(letzteVoll[0]), "kurz")}, ${uhr(letzteVoll[0])} Uhr${kurz ? `: ${kurz}` : ""}`,
      h("div", { class: "legende" }, teile.filter((t_) => t_[1] > 0).map(([name, , slot]) => h("span", null, h("i", { class: "kasten", style: { background: farbe(slot) } }), name))),
      balken,
      trend ? h("p", { class: "koerper-trend" }, h("span", null, "Letzte 30 Tage"), h("b", null, trend.wort),
        h("span", null, `Muskeln ${vorzeichen(trend.muskel, 1)} kg, Fett ${vorzeichen(trend.fett, 1)} kg`)) : null,
      markerListe(bewertet),
      ohneNorm.some(Boolean) ? [h("h3", { class: "marker-zwischen" }, "Ohne ärztliche Norm für Waagen"), markerListe(ohneNorm)] : null,
      h("p", { class: "fussnote" }, koerperFussnote(zonen, p, g, glied)),
      befundBox([bf.fett, bf.bmi, bf.muskel, bf.mager, bf.viszeral])));
  }

  // ---- Körperregionen: Tabelle, Seitenvergleich und Verlauf (zum Aufklappen)
  if (mf.details) knoten.push(mf.details);

  // ---- Verlauf aller Körperwerte
  const typen = [6, 76, 8, 5, 77, 88, 170, 226, 227, 168, 169].filter((t_) => wReihe(w, t_).length > 1);
  if (typen.length) {
    knoten.push(abschnitt("Verlauf der Körperwerte", "Ein Wert pro Messtag, ab 6 Monaten als Wochenmittel.",
      await verlauf({ id: "koerperwerte", auswahl: typen.map((t_) => ({ id: t_, name: W_TYPEN[t_][0] })), laden: ({ von, wochen, wahl }) => {
        const typ = +wahl;
        const [name, einheit, stellen] = W_TYPEN[typ];
        const roh = imBereich(wTaeglich(wReihe(w, typ)), von);
        return { serien: [{ name, daten: wochen ? nachWochen(roh) : roh, slot: 1, stellen, einheit, endWert: true }], opt: { wochen, minSpanne: KOERPER_SPANNE[typ] },
          werte: [...statistik(roh, stellen, einheit), veraenderung(roh, stellen, einheit)], fussnote: `${roh.length} Messtage` };
      } })));
  }

  // ---- Nerven und Hautleitfähigkeit
  const nerven = [[167, -1], [158, -1], [159, -1], [196, -1], [197, -1], [198, -1], [229, -1]].filter(([t_, p_]) => wReihe(w, t_, p_).length);
  if (nerven.length) {
    knoten.push(abschnitt("Nervengesundheit", "Die Body Scan misst über die Fußelektroden die Schweißdrüsenaktivität der Füße (elektrochemische Hautleitfähigkeit).",
      befundBox([bf.nerven]),
      await verlauf({ id: "nerven", standard: "182", hoehe: "klein", auswahl: nerven.map(([t_, p_]) => ({ id: `${t_}`, name: wName(t_, p_).replace("Elektrodermale Aktivität", "Hautleitfähigkeit") })),
        laden: ({ von, wahl }) => {
          const roh = imBereich(wTaeglich(wReihe(w, +wahl)), von);
          return { serien: [{ name: wName(+wahl), daten: roh, slot: 1, endWert: true }], werte: statistik(roh, 0, "") };
        } })));
  }
  return { titel: "Körper", knoten };
}
function zahlOk(v) { return typeof v === "number" && Number.isFinite(v); }
/** Entwicklung der Zusammensetzung in einem Wort, wie Withings „Fettzunahme“. Ab 0,5 kg zählt eine Veränderung
    (kleinere Schwankungen liegen im Messrauschen der Waage); verändert sich beides gleichsinnig, zählt das Größere. */
function koerperTrendWort(dm, df) {
  const s_ = 0.5;
  const m = dm >= s_ ? 1 : dm <= -s_ ? -1 : 0, f = df >= s_ ? 1 : df <= -s_ ? -1 : 0;
  if (!m && !f) return "stabil";
  if (m === 1 && f === -1) return "Muskelaufbau und Fettabbau";
  if (m === -1 && f === 1) return "Fettzunahme und Muskelabbau";
  if (m === 1 && f === 1) return df > dm ? "Fettzunahme" : "Muskelaufbau";
  if (m === -1 && f === -1) return -df >= -dm ? "Fettabbau" : "Muskelabbau";
  if (m) return m === 1 ? "Muskelaufbau" : "Muskelabbau";
  return f === 1 ? "Fettzunahme" : "Fettabbau";
}
/** Woher die Einordnung stammt – nur für Werte, die auch angezeigt werden */
function koerperFussnote(zonen, p, g, glied) {
  const teile = ["BMI nach der Einteilung der WHO"];
  if (zonen.fett && g[6] != null) teile.push(`Körperfettanteil nach den Referenzwerten von Gallagher und Kollegen (2000) für ${zonen.fett.gruppe}`);
  if (zonen.asm && glied) teile.push(`Muskeln an Armen und Beinen nach der europäischen Sarkopenie-Leitlinie EWGSOP2 (niedrig unter ${zahl(zonen.asm.index, 1)} kg/m²)`);
  if (zonen.mager && g[5] != null) teile.push(`Magermasse nach ESPEN (vermindert unter ${zahl(zonen.mager.index)} kg/m², Kriterium für Mangelernährung)`);
  let text = `Ärztliche Einordnung: ${teile.join("; ")}.`;
  if (g[170] != null) text += ` Das Viszeralfett ist ein Index von Withings ohne ärztliche Norm; ärztlich zählt der Bauchumfang (erhöhtes Risiko ab ${p.geschlecht === "m" ? "94" : "80"} cm).`;
  text += " Gesamtmuskelmasse, Wasser, Knochen und Grundumsatz schätzt die Waage; für sie gibt es keine ärztlichen Normwerte, die Knochendichte etwa misst nur eine DXA-Untersuchung.";
  const fehlend = [p.geschlecht ? null : "Geschlecht", p.alter == null ? "Alter" : null, p.groesse ? null : "Größe"].filter(Boolean);
  if (fehlend.length && (!zonen.fett || !zonen.mager)) text += ` Für weitere Einordnungen ${fehlend.length > 1 ? "fehlen" : "fehlt"} ${fehlend.join(" und ")} im Garmin-Profil.`;
  return text;
}

// ---- Muskeln und Fett als Körperfigur, dazu die Werte je Körperbereich wie in der Withings-App
const REGIONEN = [["rumpf", 12, "Rumpf"], ["armR", 2, "Arm rechts"], ["armL", 3, "Arm links"], ["beinR", 11, "Bein rechts"], ["beinL", 10, "Bein links"]];
// Einordnung je Bereich: Grün gut, Blau mittel, Rot schlecht – kräftige, leuchtende Farben, hell und dunkel gleich.
// Grün und Rot bleiben auch bei Rot-Grün-Sehschwäche unterscheidbar (geprüft); die Legende nennt zusätzlich die Bereiche.
const REGION_FARBEN = {
  hell: { gut: "#34c759", mittel: "#007aff", schlecht: "#ff3b30", ohne: "#a7b1b4" },
  dunkel: { gut: "#30d158", mittel: "#0a84ff", schlecht: "#ff453a", ohne: "#56656b" },
};
const REGION_STUFEN = ["gut", "mittel", "schlecht"];
/** Maßstab für die Farben. Für einzelne Körperbereiche gibt es keine ärztlichen Normwerte; die Farben übertragen
    deshalb die Normen für den ganzen Körper:
    Fett: Normalbereich des Körperfettanteils nach Gallagher und Kollegen (Alter, Geschlecht).
    Muskeln: Untergrenze der fettfreien Masse nach ESPEN (15 bzw. 17 kg/m²), über das Verhältnis von Muskeln zu fettfreier
    Masse dieser Messung in Muskeln umgerechnet und als Anteil am Gewicht ausgedrückt; ab 15 % darüber zählt es als gut. */
function regionMassstab(modus, p, gewicht, muskelJeMager = null) {
  if (modus === "fett") {
    const f = fettNorm(p);
    if (!f) return null;
    const [a, b] = f.grenzen;
    return { art: "fett", a, b, mitte: Math.round(((a + b) / 2) * 2) / 2, gruppe: f.gruppe };
  }
  const z = koerperZonen(p).mager;
  if (!z || !zahlOk(gewicht) || gewicht <= 0) return null;
  const kgA = z.grenzen[0] * (zahlOk(muskelJeMager) && muskelJeMager > 0.8 && muskelJeMager < 1 ? muskelJeMager : 0.95);
  const anteil = (kg) => Math.round((kg / gewicht) * 1000) / 10;
  return { art: "muskel", a: anteil(kgA), mitte: anteil(kgA * 1.15), kgA, gewicht, index: z.index };
}
function regionEinordnung(modus, anteil, m) {
  if (anteil == null || !m) return null;
  if (modus === "fett") return anteil >= m.b ? "schlecht" : anteil > m.mitte || anteil < m.a ? "mittel" : "gut";
  return anteil < m.a ? "schlecht" : anteil < m.mitte ? "mittel" : "gut";
}
function regionFarbe(stufe) { return REGION_FARBEN[istDunkel() ? "dunkel" : "hell"][stufe || "ohne"]; }
function leuchtdichte(hex) {
  const k = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}
/** Schrift auf einer Fläche: weiß, wenn das gut lesbar ist (Kontrast ab 4,5), sonst dunkel */
function schriftAuf(hex) { return 1.05 / (leuchtdichte(hex) + 0.05) >= 4.5 ? "#ffffff" : "#12262e"; }
/** Muskeln und Fett als Körperfigur (immer sichtbar) und die Einzelwerte je Körperbereich (zum Aufklappen).
 *  Gibt es keine Messung mit Griff, zeigt die Figur den ganzen Körper in einer Farbe. */
async function muskelFettAbschnitte(w) {
  const p = personAus(await Daten.info("garmin"), w);
  const seg = letzter(wReihe(w, 175, 12)) || letzter(wReihe(w, 174, 12)); // Messung mit Griff: Werte je Bereich
  const voll = letzter(wReihe(w, 76)) || letzter(wReihe(w, 6)); // letzte Messung des ganzen Körpers
  if (!seg && !voll) return {};
  const g = wGruppe(w, (seg || voll)[2]);
  const v = (typ, pos) => (seg && zahlOk(g[`${typ}.${pos}`]) ? g[`${typ}.${pos}`] : null);
  const gesamt = (pos) => (v(174, pos) != null && v(173, pos) != null ? v(174, pos) + v(173, pos) : null);
  const fettAnteil = (pos) => (gesamt(pos) ? (v(174, pos) / gesamt(pos)) * 100 : null);
  const muskelAnteil = (pos) => (gesamt(pos) && v(175, pos) != null ? (v(175, pos) / gesamt(pos)) * 100 : null);
  const vor30 = (typ, pos) => vorTagen(wReihe(w, typ, pos), 30, seg[0]);
  const da = seg
    ? { muskel: REGIONEN.some(([, p_]) => v(175, p_) != null), fett: REGIONEN.some(([, p_]) => v(174, p_) != null) }
    : { muskel: zahlOk(g[76]) && zahlOk(g[1]) && g[1] > 0, fett: zahlOk(g[6]) };
  if (!da.muskel && !da.fett) return {};
  let modus = speicher.get("gesundheit.region") === "fett" ? "fett" : "muskel";
  if (!da[modus]) modus = modus === "fett" ? "muskel" : "fett";
  let verlaufKarte = null;
  const knoepfe = () => [["muskel", "Muskeln"], ["fett", "Fett"]].map(([m, name]) => h("button", { type: "button", "aria-pressed": String(m === modus), disabled: !da[m] || null,
    onclick: () => { if (m !== modus) { modus = m; speicher.set("gesundheit.region", m); zeichne(); if (verlaufKarte) verlaufKarte.neuLaden(); } } }, name));
  const umschalterFigur = h("div", { class: "segmente", role: "group", "aria-label": "Muskeln oder Fett zeigen" });
  const umschalterDetail = seg ? h("div", { class: "segmente", role: "group", "aria-label": "Muskeln oder Fett zeigen" }) : null;
  const figurBox = h("div", { class: "koerper-feld figur-feld" });
  const detailBox = seg ? h("div") : null;
  const zeichne = () => {
    umschalterFigur.replaceChildren(...knoepfe());
    if (umschalterDetail) umschalterDetail.replaceChildren(...knoepfe());
    const massstab = regionMassstab(modus, p, g[1], g[76] != null && g[5] ? g[76] / g[5] : null);
    let werte = null, ganz = null;
    if (seg) {
      const typ = modus === "fett" ? 174 : 175;
      const anteil = modus === "fett" ? fettAnteil : muskelAnteil;
      werte = {};
      for (const [k, pos, name] of REGIONEN) {
        const a_ = anteil(pos);
        werte[k] = { wert: v(typ, pos), anteil: a_, name, stufe: v(typ, pos) != null ? regionEinordnung(modus, a_, massstab) : null };
      }
    } else {
      const wert = modus === "fett" ? (zahlOk(g[8]) ? g[8] : null) : g[76];
      const anteil = modus === "fett" ? g[6] : (g[76] / g[1]) * 100;
      ganz = { wert, anteil, name: "Ganzer Körper", stufe: regionEinordnung(modus, anteil, massstab) };
    }
    figurBox.replaceChildren(koerperFigur(werte, modus, ganz), h("div", { class: "figur-legende" }, regionLegende(modus, massstab, p, werte, ganz)));
    if (!seg) return;
    const typ = modus === "fett" ? 174 : 175;
    const zeile = (k, name, pos) => {
      const d = v(typ, pos) != null && vor30(typ, pos) != null ? v(typ, pos) - vor30(typ, pos) : null;
      const st = werte[k].stufe;
      return h("tr", null, h("td", { class: "text" }, name,
          st ? h("span", { class: "region-stufe" }, h("i", { style: { background: regionFarbe(st) } }), st) : null),
        h("td", null, v(175, pos) != null ? `${zahl(v(175, pos), 2)} kg` : "–"),
        h("td", null, v(174, pos) != null ? `${zahl(v(174, pos), 2)} kg` : "–"),
        h("td", null, werte[k].anteil != null ? `${zahl(werte[k].anteil, 1)} %` : "–"),
        h("td", null, d != null ? `${vorzeichen(d, 2)} kg` : "–"));
    };
    const seiten = (links, rechts, name) => {
      const l = v(typ, links), r = v(typ, rechts);
      if (l == null || r == null) return null;
      const diff = ((l - r) / ((l + r) / 2)) * 100;
      const ausgeglichen = Math.abs(diff) < 3;
      return { name, wert: ausgeglichen ? "ausgeglichen" : `links ${diff > 0 ? "mehr" : "weniger"}`, neben: `${vorzeichen(diff, 1)} % (links ${zahl(l, 2)} kg, rechts ${zahl(r, 2)} kg)` };
    };
    detailBox.replaceChildren(
      h("div", { class: "tabellen-rahmen region-tabelle" }, h("table", { class: "tabelle" },
        h("thead", null, h("tr", null, h("th", null, "Bereich"), h("th", null, "Muskeln"), h("th", null, "Fett"), h("th", null, modus === "fett" ? "Fettanteil" : "Muskelanteil"),
          h("th", { title: `Veränderung der ${modus === "fett" ? "Fettmasse" : "Muskelmasse"} in 30 Tagen` }, "± 30 Tage"))),
        h("tbody", null, REGIONEN.map(([k, pos, name]) => zeile(k, name, pos))))),
      werteListe([seiten(3, 2, `Arme, ${modus === "fett" ? "Fett" : "Muskeln"}`), seiten(10, 11, `Beine, ${modus === "fett" ? "Fett" : "Muskeln"}`)]));
  };
  zeichne();
  const wann = datum(isoAusMs((seg || voll)[0]), "kurz");
  const figur = abschnitt("Muskeln und Fett", seg
    ? `Arme, Beine und Rumpf aus der Messung mit Griff vom ${wann}`
    : `Ganzer Körper, Messung vom ${wann} – Arme, Beine und Rumpf einzeln misst die Body Scan, wenn du beim Wiegen den Griff mit beiden Händen hältst.`,
  umschalterFigur, figurBox);
  if (!seg) return { figur };
  verlaufKarte = await verlauf({ id: "regionen", titel: "Verlauf je Körperbereich", standard: "182",
    auswahl: [{ id: "arme", name: "Arme" }, { id: "beine", name: "Beine" }, { id: "rumpf", name: "Rumpf" }],
    laden: ({ von, wochen, wahl }) => {
      const typ = modus === "fett" ? 174 : 175;
      const teil = { arme: [[3, "Arm links", 1], [2, "Arm rechts", 2]], beine: [[10, "Bein links", 1], [11, "Bein rechts", 2]], rumpf: [[12, "Rumpf", 1]] }[wahl];
      const serien = teil.map(([pos, name, slot]) => {
        const roh = imBereich(wTaeglich(wReihe(w, typ, pos)), von);
        return { name, daten: wochen ? nachWochen(roh) : roh, slot, stellen: 2, einheit: "kg", endWert: true };
      });
      return { serien, opt: { wochen, minSpanne: { arme: 1, beine: 2, rumpf: 3 }[wahl] }, fussnote: `${modus === "fett" ? "Fettmasse" : "Muskelmasse"} in kg, je Messung der Body Scan mit Griff.` };
    } });
  const details = klappAbschnitt("regionen", "Körperregionen", `Werte, Seitenvergleich und Verlauf für Arme, Beine und Rumpf, Messung vom ${wann}`,
    umschalterDetail, detailBox,
    h("p", { class: "fussnote" }, "Die Body Scan misst die Körperregionen, wenn du den Griff mit beiden Händen hältst. „± 30 Tage“ ist die Veränderung gegenüber der Messung vor rund einem Monat. Für einzelne Körperbereiche gibt es keine ärztlichen Normwerte; die Farben übertragen deshalb die Normen für den ganzen Körper und dienen der Orientierung."),
    verlaufKarte);
  return { figur, details };
}

/** Legende zur Figur: die drei Stufen mit ihren Grenzen und welche Bereiche gerade darin liegen, oder warum es keine Farben gibt */
function regionLegende(modus, m, p, werte = null, ganz = null) {
  if (!m) {
    const fehlend = [p.geschlecht ? null : "Geschlecht", modus === "fett" && p.alter == null ? "Alter" : null, modus !== "fett" && !p.groesse ? "Größe" : null].filter(Boolean);
    return h("p", { class: "region-legende leise" }, fehlend.length
      ? `Für die Einordnung in gut, mittel und schlecht ${fehlend.length > 1 ? "fehlen" : "fehlt"} ${fehlend.join(" und ")} im Garmin-Profil.`
      : "Für die Einordnung in gut, mittel und schlecht fehlt das Gewicht dieser Messung.");
  }
  const f = (x) => zahl(x, Number.isInteger(x) ? 0 : 1);
  const grenzen = modus === "fett"
    ? { gut: `${f(m.a)}–${f(m.mitte)} %`, mittel: `${f(m.mitte)}–${zahl(m.b - 0.1, 1)} %`, schlecht: `ab ${f(m.b)} %` }
    : { gut: `ab ${f(m.mitte)} %`, mittel: `${f(m.a)}–${f(m.mitte)} %`, schlecht: `unter ${f(m.a)} %` };
  const bereiche = (st) => {
    if (ganz) return ganz.stufe === st ? ["ganzer Körper"] : [];
    const n = Object.values(werte || {}).filter((x) => x.stufe === st).map((x) => x.name);
    const paar = (a, b, beide) => (n.includes(a) && n.includes(b) ? [beide] : n.filter((x) => x === a || x === b));
    return [...n.filter((x) => x === "Rumpf"), ...paar("Arm rechts", "Arm links", "beide Arme"), ...paar("Bein rechts", "Bein links", "beide Beine")];
  };
  const wer = p.geschlecht === "w" ? "Frauen" : "Männer";
  const wovon = ganz ? "des ganzen Körpers" : "des Bereichs";
  const erklaerung = modus === "fett"
    ? `Fettanteil ${wovon}, gemessen am Normalbereich des Körperfettanteils nach Gallagher und Kollegen für ${wer} ${m.gruppe} (${f(m.a)}–${zahl(m.b - 0.1, 1)} %); ab ${f(m.b)} % gilt er als erhöht. Unter ${f(m.a)} % zeigt die Figur ebenfalls Blau.`
    : `Muskelanteil ${wovon}. Maßstab ist die Untergrenze der fettfreien Masse nach ESPEN (${zahl(m.index)} kg/m²), auf Muskeln und dein Gewicht von ${zahl(m.gewicht, 1)} kg umgerechnet: ${zahl(m.kgA, 1)} kg oder ${f(m.a)} %. Ab 15 % darüber zählt es als gut.`;
  return h("div", { class: "region-legende" },
    h("ul", { class: "region-liste" }, REGION_STUFEN.map((st) => {
      const b = bereiche(st);
      return h("li", null, h("i", { style: { background: regionFarbe(st) } }), h("b", null, st), h("span", { class: "grenze" }, grenzen[st]),
        b.length ? h("span", { class: "bereiche" }, b.join(", ")) : null);
    })),
    h("p", null, erklaerung));
}

function istDunkel() {
  const t_ = document.documentElement.getAttribute("data-theme");
  return t_ ? t_ === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
/** Körperfigur von vorn mit fünf Bereichen; Farbe nach Einordnung (gut, mittel, schlecht), Beschriftung mit kg und Anteil.
 *  Mit „ganz“ (keine Messung mit Griff) zeigt sie den ganzen Körper in einer Farbe. */
function koerperFigur(werte, modus, ganz = null) {
  const was = modus === "fett" ? "Fett" : "Muskeln";
  const beschreibung = (x) => (x.wert != null ? `${zahl(x.wert, x.wert >= 10 ? 1 : 2)} kg${x.anteil != null ? `, ${zahl(x.anteil)} % ${was}` : ""}${x.stufe ? `, ${x.stufe}` : ""}`
    : x.anteil != null ? `${zahl(x.anteil, 1)} % ${was}${x.stufe ? `, ${x.stufe}` : ""}` : "keine Messung");
  const svg = s("svg", { class: "koerperfigur", viewBox: "0 0 440 600", role: "img",
    "aria-label": ganz ? `${was} des ganzen Körpers: ${beschreibung(ganz)}`
      : `${modus === "fett" ? "Fettmasse" : "Muskelmasse"} je Körperbereich: ${Object.values(werte).map((x) => `${x.name} ${beschreibung(x)}`).join("; ")}` });
  const FORMEN = {
    rumpf: "M184 104 C172 110 160 113 152 118 C150 132 151 146 153 160 C155 196 160 222 160 246 C160 268 149 284 147 301 C166 316 184 328 200 333 C216 328 234 316 253 301 C251 284 240 268 240 246 C240 222 245 196 247 160 C249 146 250 132 248 118 C240 113 228 110 216 104 C208 109 192 109 184 104 Z",
    armR: "M148 116 C132 118 122 128 120 144 L113 204 C111 218 109 230 108 240 L100 300 C99 308 97 314 96 320 C92 334 91 348 96 360 C100 368 108 368 112 360 C115 352 114 336 115 322 L124 266 C126 256 129 246 131 236 L140 184 C142 172 145 164 148 158 C146 144 146 130 148 116 Z",
    armL: "M252 116 C268 118 278 128 280 144 L287 204 C289 218 291 230 292 240 L300 300 C301 308 303 314 304 320 C308 334 309 348 304 360 C300 368 292 368 288 360 C285 352 286 336 285 322 L276 266 C274 256 271 246 269 236 L260 184 C258 172 255 164 252 158 C254 144 254 130 252 116 Z",
    beinR: "M147 305 C144 328 141 352 142 374 C143 398 148 420 151 440 C153 452 151 466 151 480 C151 506 156 528 160 548 C161 556 156 562 150 568 C148 574 156 578 166 577 C174 576 179 572 179 566 C179 558 177 552 177 546 C178 524 182 502 182 480 C182 466 180 452 182 440 C185 418 191 396 194 372 C195 360 197 348 198 338 C182 332 164 320 147 305 Z",
    beinL: "M253 305 C256 328 259 352 258 374 C257 398 252 420 249 440 C247 452 249 466 249 480 C249 506 244 528 240 548 C239 556 244 562 250 568 C252 574 244 578 234 577 C226 576 221 572 221 566 C221 558 223 552 223 546 C222 524 218 502 218 480 C218 466 220 452 218 440 C215 418 209 396 206 372 C205 360 203 348 202 338 C218 332 236 320 253 305 Z",
  };
  const koerper = s("g", { transform: "translate(20 0)" });
  svg.append(koerper);
  // Kopf: das Profilbild, wenn eines gewählt ist (gawi.profilbild), sonst die gezeichnete Silhouette
  const profilBild = speicher.get("gawi.profilbild");
  koerper.append(s("path", { d: "M188 82 L212 82 L214 110 L186 110 Z", class: "kopf-form" }));
  if (profilBild) {
    const clipId = "kopf-clip-" + Math.random().toString(36).slice(2, 8);
    svg.append(s("defs", null, s("clipPath", { id: clipId }, s("circle", { cx: 200, cy: 50, r: 36 }))));
    koerper.append(
      s("circle", { cx: 200, cy: 50, r: 36, fill: "var(--blatt-2)" }),
      s("image", { href: profilBild, x: 164, y: 14, width: 72, height: 72, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${clipId})` }),
      s("circle", { cx: 200, cy: 50, r: 36, fill: "none", stroke: "var(--linie)", "stroke-width": 2 }));
  } else {
    koerper.append(s("ellipse", { cx: 200, cy: 54, rx: 28, ry: 35, class: "kopf-form" }));
  }
  for (const [k, d] of Object.entries(FORMEN)) {
    const x = ganz || werte[k];
    const gemessen = x && (x.wert != null || x.anteil != null);
    const p_ = s("path", { d, class: "segment", fill: gemessen ? regionFarbe(x.stufe) : "var(--blatt-2)" });
    p_.append(s("title", null, `${x.name}: ${beschreibung(x)}`));
    koerper.append(p_);
  }
  const text = (x) => (x.wert != null ? `${zahl(x.wert, x.wert >= 10 ? 1 : 2)} kg` : "–");
  const unter = (x) => (x.wert != null && x.anteil != null ? `${x.name}, ${zahl(x.anteil)} %` : x.name);
  const etikett = (k, x0, y, anker) => {
    const x = werte[k];
    const gr = s("g", { class: "etikett" });
    gr.append(s("text", { x: x0, y: y, "text-anchor": anker, class: "wert" }, text(x)));
    gr.append(s("text", { x: x0, y: y + 18, "text-anchor": anker, class: "name" }, unter(x)));
    return gr;
  };
  const r = ganz || werte.rumpf;
  const gemessen = r.wert != null || r.anteil != null;
  const innen = schriftAuf(regionFarbe(r.stufe));
  const rumpf = s("g", { class: "etikett" });
  const oben = r.wert != null ? text(r) : r.anteil != null ? `${zahl(r.anteil, 1)} %` : "–";
  const unten = ganz ? (r.wert != null && r.anteil != null ? `ganzer Körper, ${zahl(r.anteil)} %` : "ganzer Körper")
    : r.wert != null && r.anteil != null ? `Rumpf, ${zahl(r.anteil)} %` : "Rumpf";
  rumpf.append(s("text", { x: 220, y: 190, "text-anchor": "middle", class: "wert", style: `fill:${gemessen ? innen : "var(--tinte)"}` }, oben));
  rumpf.append(s("text", { x: 220, y: 208, "text-anchor": "middle", class: "name", style: `fill:${gemessen ? innen : "var(--tinte-2)"}` }, unten));
  svg.append(rumpf);
  if (!ganz) svg.append(etikett("armR", 4, 208, "start"), etikett("armL", 436, 208, "end"), etikett("beinR", 4, 414, "start"), etikett("beinL", 436, 414, "end"));
  svg.append(s("text", { x: 220, y: 596, "text-anchor": "middle", class: "seiten-hinweis" }, "Ansicht von vorn"));
  return svg;
}

// ======================================================================
// Ansicht: Herz
// ======================================================================
async function ansichtHerz() {
  const [w, ekgListe] = await Promise.all([Daten.withings(), Daten.ekg()]);
  const hrvText = await Daten.texte("g.hrv.status", isoMinus(10));
  const bf = (await befunde()).map;
  const knoten = [];
  const mw = (l) => (l.length ? [mittel(l.map((m) => m.sys)), mittel(l.map((m) => m.dia)), mittel(l.map((m) => m.puls).filter(zahlOk))] : null);
  const bpText = (x) => `${zahl(x[0])}/${zahl(x[1])}`;

  // ---- Blutdruck
  const bpAlle = blutdruckMessungen(w);
  if (bpAlle.length) {
    knoten.push(abschnitt("Blutdruck", "Selbstmessung mit der BPM Vision. Bis 3 Monate jede einzelne Messung, ab 6 Monaten Wochenmittel.",
      befundBox([bf.blutdruck_einzel, bf.blutdruck]),
      await verlauf({ id: "blutdruck", auswahl: [{ id: "alle", name: "Alle Messungen" }, { id: "morgens", name: "Morgens" }, { id: "abends", name: "Abends" }],
        laden: ({ von, wochen, wahl }) => {
          const imZr = bpAlle.filter((m) => !von || m.ts >= tagMs(von));
          const bp = imZr.filter((m) => wahl === "alle" || (wahl === "morgens") === istMorgens(m.ts));
          if (!bp.length) return { serien: [] };
          const mo = imZr.filter((m) => istMorgens(m.ts)), ab = imZr.filter((m) => !istMorgens(m.ts));
          const [m0, a0, g0] = [mw(mo), mw(ab), mw(imZr)];
          const ueber = g0 && (g0[0] >= 135 || g0[1] >= 85);
          const hoechst = imZr.reduce((x, m) => (m.sys > x.sys ? m : x), imZr[0]);
          const sys = bp.map((m) => [m.ts, m.sys]), dia = bp.map((m) => [m.ts, m.dia]);
          const ys = bp.flatMap((m) => [m.sys, m.dia]);
          return {
            liste: [
              m0 ? { name: "Mittel morgens", wert: bpText(m0), einheit: "mmHg", neben: `${mo.length} Messungen` } : null,
              a0 ? { name: "Mittel abends", wert: bpText(a0), einheit: "mmHg", neben: `${ab.length} Messungen` } : null,
              g0 ? { name: "Mittel gesamt", wert: bpText(g0), einheit: "mmHg", neben: chip(ueber ? "über dem Grenzwert 135/85" : "unter dem Grenzwert 135/85", ueber ? "ernst" : "gut") } : null,
              g0 && g0[2] ? { name: "Puls bei der Messung", wert: zahl(g0[2]), einheit: "bpm" } : null,
              { name: "Höchster Wert", wert: `${zahl(hoechst.sys)}/${zahl(hoechst.dia)}`, einheit: "mmHg", neben: kurzZeit(hoechst.ts) },
            ],
            serien: [
              { name: "Systolisch", daten: wochen ? nachWochen(sys) : sys, slot: 1, einheit: "mmHg", endWert: true },
              { name: "Diastolisch", daten: wochen ? nachWochen(dia) : dia, slot: 2, einheit: "mmHg", endWert: true },
            ],
            opt: { yMin: Math.floor(Math.min(60, ...ys.map((y) => y - 6)) / 20) * 20, yMax: Math.ceil(Math.max(150, ...ys.map((y) => y + 6)) / 20) * 20, yIntervall: 20,
              mitUhrzeit: !wochen, wochen, referenzen: [{ wert: 135, text: "135" }, { wert: 85, text: "85" }] },
            fussnote: `${bp.length} Messungen${wochen ? ", als Wochenmittel" : ""}. Gestrichelt: 135/85 mmHg, der Grenzwert für den Mittelwert der Selbstmessung zu Hause.`,
          };
        } })));

    // Puls bei der Messung
    knoten.push(h("div", { class: "abschnitt" }, await verlauf({ id: "bp_puls", titel: "Puls bei der Blutdruckmessung", laden: ({ von, wochen }) => {
      const imZr = bpAlle.filter((m) => (!von || m.ts >= tagMs(von)) && zahlOk(m.puls));
      const reihe = (liste) => { const p_ = liste.map((m) => [m.ts, m.puls]); return wochen ? nachWochen(p_) : tagesMittel(p_); };
      const mo = reihe(imZr.filter((m) => istMorgens(m.ts))), ab = reihe(imZr.filter((m) => !istMorgens(m.ts)));
      return { serien: [{ name: "Morgens", daten: mo, slot: 1, einheit: "bpm", endWert: true }, { name: "Abends", daten: ab, slot: 2, einheit: "bpm", endWert: true }].filter((x) => x.daten.length),
        werte: statistik(imZr.map((m) => [m.ts, m.puls]), 0, "bpm"), opt: { wochen, minSpanne: 10 }, fussnote: wochen ? "Mittelwert je Woche." : "Mittelwert je Tag." };
    } })));

    // Wochenmittel und letzte Messungen
    const wochen = new Map();
    for (const m of bpAlle.filter((x) => x.ts >= tagMs(isoMinus(7 * 26)))) {
      const [j, kw] = isoWoche(m.ts);
      const key = `${j}-${zweistellig(kw)}`;
      if (!wochen.has(key)) wochen.set(key, { j, kw, mo: [], ab: [] });
      wochen.get(key)[istMorgens(m.ts) ? "mo" : "ab"].push(m);
    }
    const fmt = (l) => (l.length ? bpText(mw(l)) : "–");
    const letzte = bpAlle.slice(-14).reverse();
    knoten.push(abschnitt("Wochenmittel und letzte Messungen", "Die letzten 26 Wochen und die 14 neuesten Messungen. Einzelwerte sind nach den Grenzwerten für die Messung zu Hause eingestuft (ESH 2023): unter 120/80 optimal, bis 134/84 normal, ab 135/85 erhöht, ab 180/110 sehr hoch. Das ersetzt keine ärztliche Beurteilung.", h("div", { class: "raster zwei" },
      h("div", { class: "tabellen-rahmen", style: { maxHeight: "420px" } }, h("table", { class: "tabelle" },
        h("thead", null, h("tr", null, h("th", null, "Woche"), h("th", null, "Morgens"), h("th", null, "Abends"), h("th", null, "Anzahl"))),
        h("tbody", null, [...wochen.values()].reverse().map((x) => h("tr", null, h("td", null, `KW ${x.kw}/${String(x.j).slice(2)}`), h("td", null, fmt(x.mo)), h("td", null, fmt(x.ab)), h("td", null, x.mo.length + x.ab.length)))))),
      h("div", { class: "tabellen-rahmen", style: { maxHeight: "420px" } }, h("table", { class: "tabelle" },
        h("thead", null, h("tr", null, h("th", null, "Zeitpunkt"), h("th", null, "Wert"), h("th", null, "Puls"), h("th", null, "Einstufung"))),
        h("tbody", null, letzte.map((m) => { const [t_, a_] = bpKlasse(m.sys, m.dia); return h("tr", null,
          h("td", null, kurzZeit(m.ts)), h("td", null, `${m.sys}/${m.dia}`), h("td", null, m.puls ?? "–"), h("td", null, chip(t_, a_))); })))))));
  }

  // ---- Ruhepuls
  const waagePuls = [];
  for (const [, zeilen] of w._grp) {
    const typen = new Set(zeilen.map((r) => r[1]));
    if (typen.has(11) && !typen.has(10)) { const r = zeilen.find((x) => x[1] === 11); waagePuls.push([r[0] * 1000, r[2]]); }
  }
  waagePuls.sort((x, y) => x[0] - y[0]);
  const rpLetzt = letzter(await kennzahl("ruhepuls", isoMinus(14)));
  let rpAbschnitt = null;
  if (rpLetzt || waagePuls.length) {
    knoten.push(rpAbschnitt = abschnitt("Ruhepuls", rpLetzt ? `Zuletzt ${zahl(rpLetzt[1])} bpm am ${datum(rpLetzt[0], "kurz")}` : null, befundBox([bf.ruhepuls]), await verlauf({ id: "ruhepuls", laden: async ({ von, wochen }) => {
      const uhr_ = await kennzahl("ruhepuls", von);
      const waage = tagesMittel(imBereich(waagePuls, von));
      return {
        serien: [
          uhr_.length ? { name: "Ruhepuls (Uhr)", daten: wochen ? nachWochen(uhr_) : uhr_, slot: 1, einheit: "bpm", endWert: true } : null,
          waage.length ? { name: "Puls auf der Waage", daten: wochen ? nachWochen(waage) : waage, slot: 2, einheit: "bpm", endWert: true } : null,
        ].filter(Boolean),
        werte: statistik(uhr_.length ? uhr_ : waage, 0, "bpm"), opt: { wochen, minSpanne: 10 },
      };
    } })));
  }

  // ---- HRV mit Normalbereich
  const hrvLetzt = letzter(await kennzahl("hrv", isoMinus(14)));
  if (hrvLetzt) {
    nebenan(knoten, rpAbschnitt, abschnitt("Herzfrequenzvariabilität", `Mittelwert jeder Nacht. Die Fläche zeigt deinen persönlichen Normalbereich laut Garmin.${letzter(hrvText) ? ` Status: ${textDeutsch(letzter(hrvText)[1])}.` : ""}`,
      befundBox([bf.hrv]),
      await verlauf({ id: "hrv", laden: async ({ von, wochen }) => {
        const k = await kennzahlen(["hrv", "hrv_unten", "hrv_oben"], von);
        const [hrv, untenR, obenR] = wochen ? [nachWochen(k.hrv), nachWochen(k.hrv_unten), nachWochen(k.hrv_oben)] : [k.hrv, k.hrv_unten, k.hrv_oben];
        const unten = new Map(untenR), oben = new Map(obenR);
        const band = hrv.map((p_) => p_[0]).filter((d) => unten.has(d) && oben.has(d));
        return {
          serien: [
            { name: "Normalbereich unten", daten: band.map((d) => [d, unten.get(d)]), slot: "--serie-1", unsichtbar: true, stapel: "band", punkte: false },
            { name: "Normalbereich", daten: band.map((d) => [d, oben.get(d) - unten.get(d)]), slot: "--serie-1", unsichtbar: true, stapel: "band", flaeche: true, flaecheDeckkraft: 0.12, punkte: false, ohneLegende: true },
            { name: "HRV", daten: hrv, slot: 1, einheit: "ms", endWert: true, z: 3 },
          ],
          werte: statistik(k.hrv, 0, "ms"),
          opt: { wochen, minSpanne: 10, tooltipExtra: (params) => { const x = isoAusMs(params[0].value[0]); return unten.has(x) ? `<div style="margin-top:4px;color:${css("--tinte-2")}">Normalbereich ${zahl(unten.get(x))}–${zahl(oben.get(x))} ms</div>` : ""; } },
          tabelle: () => serienTabelle([{ name: "HRV", daten: hrv, einheit: "ms" }, { name: "Normal unten", daten: untenR, einheit: "ms" }, { name: "Normal oben", daten: obenR, einheit: "ms" }], { wochen }),
        };
      } })));
  }

  // ---- Gefäße
  const gefaesse = [91, 155, 140].filter((t_) => wReihe(w, t_).length);
  if (gefaesse.length) {
    knoten.push(abschnitt("Gefäße", "Pulswellengeschwindigkeit und Gefäßalter misst die Body Scan beim Wiegen.",
      befundBox([bf.pwv]),
      await verlauf({ id: "gefaesse", standard: "182", auswahl: gefaesse.map((t_) => ({ id: t_, name: W_TYPEN[t_][0] })), laden: ({ von, wahl }) => {
        const [name, einheit, stellen] = W_TYPEN[+wahl];
        const roh = imBereich(wTaeglich(wReihe(w, +wahl)), von);
        return { serien: [{ name, daten: roh, slot: 1, stellen, einheit, endWert: true }], werte: [...statistik(roh, stellen, einheit), veraenderung(roh, stellen, einheit)],
          opt: { minSpanne: +wahl === 91 ? 2 : 6 } };
      } })));
  }

  // ---- EKG
  if (ekgListe.length) {
    const neueste = ekgListe.reduce((a_, b_) => ((b_.ts || 0) > (a_.ts || 0) ? b_ : a_));
    const kl = ekgKlasse(neueste);
    const ergebnis = kl === 1 ? "Hinweis auf Vorhofflimmern" : kl === 2 ? "nicht eindeutig" : kl === 0 ? "kein Vorhofflimmern" : null;
    const kurz = `${ekgListe.length} ${ekgListe.length === 1 ? "Aufzeichnung" : "Aufzeichnungen"} von Withings und Garmin${neueste.ts ? `, zuletzt am ${datum(isoAusMs(neueste.ts * 1000), "kurz")}${ergebnis ? `: ${ergebnis}` : ""}` : ""}. Tippe auf eine Aufzeichnung, um die Kurve zu sehen.`;
    knoten.push(klappAbschnitt("ekg", "EKG", kurz,
      befundBox([bf.ekg, bf.qtc]),
      h("ul", { class: "liste" }, ekgListe.map((e_) => h("li", null, ekgZeile(e_, w))))));
  }
  if (!knoten.length) knoten.push(leer("Noch keine Herzwerte", "Blutdruck, Ruhepuls, Herzfrequenzvariabilität und EKG erscheinen hier, sobald Messungen da sind."));
  return { titel: "Herz", knoten };
}
/** Mehrere Werte am Tag zu einem Tagesmittel (x als Datum) */
function tagesMittel(paare) {
  const m = new Map();
  for (const [x, v] of paare) { if (!Number.isFinite(v)) continue; const d = typeof x === "number" ? isoAusMs(x) : x; if (!m.has(d)) m.set(d, []); m.get(d).push(v); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, l]) => [d, mittel(l)]);
}

// ======================================================================
// Ansicht: EKG (Papierstreifen)
// ======================================================================
async function ansichtEkg(q, id) {
  const [liste, w] = await Promise.all([Daten.ekg(), Daten.withings()]);
  const e = liste.find((x) => x.q === q && String(x.id) === String(id));
  const knoten = [];
  if (!e) return { titel: "EKG", zurueck: "#herz", knoten: [leer("EKG nicht gefunden", "")] };
  const kurve = e.kurve ? await Daten.datei(`d/ekg/${q}-${id}.enc`) : null;
  const [text, art] = AFIB[e.afib] || [e.afib != null ? String(e.afib) : "ohne Auswertung", "neutral"];
  // Intervalle aus den Withings-Messungen in der Nähe
  const nahe = (typ) => { const r = wReihe(w, typ).find((x) => Math.abs(x[0] - e.ts * 1000) < 15 * 60000); return r ? r[1] : null; };
  const pos = { 0: "rechtes Handgelenk", 1: "linkes Handgelenk" }[kurve?.pos];
  knoten.push(h("div", { class: "abschnitt" },
    h("p", { class: "leise" }, e.ts ? `${datum(isoAusMs(e.ts * 1000), "langJahr")}, ${uhr(e.ts * 1000)} Uhr` : ""),
    h("div", { style: { margin: "10px 0 16px" } }, chip(text, art)),
    werteListe([
      e.hf ? { name: "Herzfrequenz", wert: zahl(e.hf), einheit: "bpm" } : null,
      nahe(135) != null ? { name: "QRS-Dauer", wert: zahl(nahe(135)), einheit: "ms" } : null,
      nahe(136) != null ? { name: "PR-Intervall", wert: zahl(nahe(136)), einheit: "ms" } : null,
      nahe(137) != null ? { name: "QT-Intervall", wert: zahl(nahe(137)), einheit: "ms" } : null,
      nahe(138) != null ? { name: "QTc-Intervall", wert: zahl(nahe(138)), einheit: "ms" } : null,
      e.sys ? { name: "Blutdruck dabei", wert: `${e.sys}/${e.dia}`, einheit: "mmHg" } : null,
      kurve ? { name: "Aufzeichnung", wert: zahl(kurve.signal.length / (kurve.freq || 300), 0), einheit: "s", neben: pos ? `Elektroden: ${pos}` : "" } : null,
    ])));
  if (kurve && kurve.signal && kurve.signal.length) {
    const papier = h("div", { class: "ekg-papier" });
    knoten.push(h("div", { class: "abschnitt" }, papier,
      h("div", { class: "ekg-legende" }, h("span", null, "Papiervorschub 25 mm/s"), h("span", null, "Verstärkung 10 mm/mV"), h("span", null, "Ableitung I")),
      h("p", { class: "fussnote" }, "Die Auswertung stammt vom Gerät. Ein EKG ohne Befund schließt Herzerkrankungen nicht aus – bei Beschwerden ärztlich abklären.")));
    NACH.push(() => ekgZeichnen(papier, kurve.signal, kurve.freq || 300));
  } else {
    knoten.push(hinweis("Für diese Aufzeichnung liegt keine Kurve vor."));
  }
  return { titel: "EKG", zurueck: "#herz", knoten };
}
function ekgZeichnen(box, signal, freq) {
  const breite = Math.max(300, box.clientWidth - 2);
  const sekProZeile = breite >= 900 ? 10 : 5;
  const rand = 9; // mm links: Eichzacke und Zeitmarken
  const pxMm = Math.max(2.4, Math.min(5, breite / (sekProZeile * 25 + rand)));
  const zeileMm = 32;
  const proZeile = Math.round(sekProZeile * freq);
  const zeilen = Math.ceil(signal.length / proZeile);
  const w_ = Math.round((sekProZeile * 25 + rand) * pxMm), h_ = Math.round(zeilen * zeileMm * pxMm);
  const dpr = window.devicePixelRatio || 1;
  const c = h("canvas", { width: Math.round(w_ * dpr), height: Math.round(h_ * dpr), style: { width: `${w_}px`, height: `${h_}px` }, role: "img", "aria-label": `EKG-Kurve, ${Math.round(signal.length / freq)} Sekunden` });
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  g.fillStyle = css("--blatt"); g.fillRect(0, 0, w_, h_);
  // Raster: 1 mm fein, 5 mm kräftig
  const fein = css("--rose-zart"), grob = css("--rose-mittel");
  g.lineWidth = 1;
  for (let mm = 0; mm * pxMm <= w_; mm++) { g.strokeStyle = mm % 5 ? fein : grob; g.beginPath(); g.moveTo(Math.round(mm * pxMm) + 0.5, 0); g.lineTo(Math.round(mm * pxMm) + 0.5, h_); g.stroke(); }
  for (let mm = 0; mm * pxMm <= h_; mm++) { g.strokeStyle = mm % 5 ? fein : grob; g.beginPath(); g.moveTo(0, Math.round(mm * pxMm) + 0.5); g.lineTo(w_, Math.round(mm * pxMm) + 0.5); g.stroke(); }
  // Einheit erraten: Millivolt statt Mikrovolt?
  const probe = signal.slice(0, Math.min(signal.length, freq * 5)).map((x) => Math.abs(x));
  const faktor = probe.sort((a, b) => a - b)[Math.floor(probe.length * 0.98)] < 20 ? 1000 : 1;
  g.strokeStyle = css("--tinte"); g.lineWidth = 1.3; g.lineJoin = "round";
  for (let z = 0; z < zeilen; z++) {
    const teil = signal.slice(z * proZeile, (z + 1) * proZeile);
    const sortiert = [...teil].sort((a, b) => a - b);
    const mitte = sortiert[Math.floor(sortiert.length / 2)] || 0;
    const y0 = (z * zeileMm + zeileMm * 0.55) * pxMm;
    g.beginPath();
    teil.forEach((v, i) => {
      const x = (rand + (i / freq) * 25) * pxMm;
      const y = y0 - ((v - mitte) * faktor / 1000) * 10 * pxMm;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
    // Zeitmarke
    g.fillStyle = css("--tinte-2"); g.font = `600 11px ${SCHRIFT}`;
    g.fillText(`${z * sekProZeile} s`, 4, z * zeileMm * pxMm + 13);
    // Eichzacke 1 mV (0,2 s breit) am Zeilenanfang
    g.lineWidth = 1.5;
    const ex = 1.5 * pxMm;
    g.beginPath(); g.moveTo(ex, y0); g.lineTo(ex + pxMm, y0); g.lineTo(ex + pxMm, y0 - 10 * pxMm); g.lineTo(ex + 6 * pxMm, y0 - 10 * pxMm); g.lineTo(ex + 6 * pxMm, y0); g.lineTo(ex + 7 * pxMm, y0); g.stroke();
    g.lineWidth = 1.3;
  }
  box.replaceChildren(c);
}

// ======================================================================
// Ansicht: Schlaf
// ======================================================================
const PHASEN = [["Tief", "--phase-tief"], ["Leicht", "--phase-leicht"], ["REM", "--phase-rem"], ["Wach", "--phase-wach"]];
async function letzteNacht() {
  const tage = (Daten.index.verlaeufe || []).slice(-4).reverse();
  for (const t of tage) { const d = await Daten.tag(t); if (d && d.schlaf && d.schlaf.phasen && d.schlaf.phasen.length) return [t, d.schlaf]; }
  return [null, null];
}
function schlafphasenFigur(schlaf, titel = null) {
  const phasen = schlaf.phasen.filter((p) => p[0] && p[1]);
  const stufe = (lvl) => (lvl >= 2.5 ? 3 : lvl >= 1.5 ? 2 : lvl >= 0.5 ? 1 : 0); // 0 tief, 1 leicht, 2 REM, 3 wach
  const zeichnen = (div) => {
    const farben = PHASEN.map((p) => css(p[1]));
    return neuesDiagramm(div, {
      animation: BEWEGUNG, grid: { left: 4, right: 12, top: 8, bottom: 4, containLabel: true },
      xAxis: { type: "time", min: phasen[0][0], max: phasen[phasen.length - 1][1], splitNumber: 4, axisLine: { lineStyle: { color: css("--linie-stark") } }, axisTick: { show: false },
        axisLabel: { ...textStil(), hideOverlap: true, showMinLabel: false, showMaxLabel: false, formatter: (v) => DF.zeit.format(new Date(v)) }, splitLine: { show: false } },
      yAxis: { type: "category", data: PHASEN.map((p) => p[0]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: textStil(),
        splitLine: { show: true, lineStyle: { color: css("--linie") } } },
      tooltip: { trigger: "item", ...tooltipStil(), formatter: (p) => `<div style="color:${css("--tinte-2")};font-size:12px">${uhr(p.value[0])}–${uhr(p.value[1])} Uhr</div>${tooltipZeile(farben[p.value[2]], dauer((p.value[1] - p.value[0]) / 1000), PHASEN[p.value[2]][0])}` },
      series: [{
        type: "custom", data: phasen.map((p) => [p[0], p[1], stufe(p[2])]),
        encode: { x: [0, 1], y: 2 },
        renderItem: (params, api) => {
          const y = api.value(2);
          const a = api.coord([api.value(0), y]), b = api.coord([api.value(1), y]);
          const hoehe_ = api.size([0, 1])[1] * 0.72;
          return { type: "rect", shape: { x: a[0], y: a[1] - hoehe_ / 2, width: Math.max(1, b[0] - a[0]), height: hoehe_, r: 2 }, style: { fill: farben[y] } };
        },
      }],
    });
  };
  const anteile = [0, 0, 0, 0];
  for (const p of phasen) anteile[stufe(p[2])] += (p[1] - p[0]) / 1000;
  return figur({ titel, hoehe: "klein", zeichnen,
    legende: h("div", { class: "legende" }, PHASEN.map((p, i) => h("span", null, h("i", { class: "kasten", style: { background: css(p[1]) } }), `${p[0]} ${dauer(anteile[i])}`))),
    tabelle: () => h("table", { class: "tabelle" }, h("thead", null, h("tr", null, h("th", null, "Von"), h("th", null, "Bis"), h("th", null, "Phase"), h("th", null, "Dauer"))),
      h("tbody", null, phasen.map((p) => h("tr", null, h("td", null, uhr(p[0])), h("td", null, uhr(p[1])), h("td", null, PHASEN[stufe(p[2])][0]), h("td", null, dauer((p[1] - p[0]) / 1000)))))) });
}
async function ansichtSchlaf() {
  const knoten = [];
  const bf = (await befunde()).map;
  const [nachtTag, nacht] = await letzteNacht();
  if (nacht) {
    const wv = nacht.werte || {};
    const qual = nacht.texte && nacht.texte["sleepScores.overall.qualifierKey"];
    knoten.push(abschnitt(nachtTag === heuteIso() ? "Letzte Nacht" : `Nacht zum ${datum(nachtTag, "wochentag")}`,
      nacht.start ? `${uhr(nacht.start)} bis ${uhr(nacht.ende)} Uhr` : null,
      werteListe([
        wv.sleepTimeSeconds != null ? { name: "Schlafdauer", wert: dauer(wv.sleepTimeSeconds, false), einheit: "Std." } : null,
        wv["sleepScores.overall.value"] != null ? { name: "Schlafscore", wert: zahl(wv["sleepScores.overall.value"]), neben: qual ? textDeutsch(qual) : "" } : null,
        wv.deepSleepSeconds != null ? { name: "Tiefschlaf", wert: dauer(wv.deepSleepSeconds, false), einheit: "Std." } : null,
        wv.remSleepSeconds != null ? { name: "REM-Schlaf", wert: dauer(wv.remSleepSeconds, false), einheit: "Std." } : null,
        wv.avgOvernightHrv != null ? { name: "HRV in der Nacht", wert: zahl(wv.avgOvernightHrv), einheit: "ms" } : null,
        wv.restingHeartRate != null ? { name: "Ruhepuls", wert: zahl(wv.restingHeartRate), einheit: "bpm" } : null,
        wv.averageRespirationValue != null ? { name: "Atemfrequenz", wert: zahl(wv.averageRespirationValue, 1), einheit: "/min" } : null,
        wv.averageSpO2Value != null ? { name: "SpO₂ im Mittel", wert: zahl(wv.averageSpO2Value), einheit: "%" } : null,
        wv.bodyBatteryChange != null ? { name: "Body Battery", wert: vorzeichen(wv.bodyBatteryChange) } : null,
        wv.awakeCount != null ? { name: "Wachphasen", wert: zahl(wv.awakeCount) } : null,
      ]),
      h("div", { style: { marginTop: "20px" } }, schlafphasenFigur(nacht, "Schlafphasen"))));
  }
  const hatSchlaf = (await kennzahl("schlaf_dauer", isoMinus(365))).length > 0;
  if (!hatSchlaf && !nacht) { knoten.push(leer("Noch keine Schlafdaten", "Trage die Uhr nachts, dann erscheinen hier Dauer, Phasen und Schlafscore.")); return { titel: "Schlaf", knoten }; }
  const std = (v) => dauer(v * 3600, false);
  if (hatSchlaf) {
    knoten.push(abschnitt("Schlafdauer und Phasen", "Pro Nacht, ab 6 Monaten als Wochenmittel.", befundBox([bf.schlafdauer, bf.schlafscore]), await verlauf({ id: "schlaf", hoehe: "gross", laden: async ({ von, wochen }) => {
      const k = await kennzahlen(["schlaf_dauer", "schlaf_tief", "schlaf_leicht", "schlaf_rem", "schlaf_wach"], von);
      const w_ = (r) => (wochen ? nachWochen(r) : r);
      const mittelH = (r) => mittel(r.map((p_) => p_[1]));
      const werte = [
        k.schlaf_dauer.length ? { name: "Schlafdauer", wert: std(mittelH(k.schlaf_dauer)), einheit: "Std." } : null,
        k.schlaf_tief.length ? { name: "Tiefschlaf", wert: std(mittelH(k.schlaf_tief)), einheit: "Std." } : null,
        k.schlaf_rem.length ? { name: "REM", wert: std(mittelH(k.schlaf_rem)), einheit: "Std." } : null,
        k.schlaf_wach.length ? { name: "Wach", wert: dauer(mittelH(k.schlaf_wach) * 3600) } : null,
      ];
      if (k.schlaf_tief.length) {
        const reihen = [["schlaf_tief", 0], ["schlaf_leicht", 1], ["schlaf_rem", 2], ["schlaf_wach", 3]];
        return { werte, serien: reihen.map(([id, i], n) => ({ name: PHASEN[i][0], daten: w_(k[id]), slot: PHASEN[i][1], art: "balken", stapel: "phasen", oben: n === 3, format: (v) => dauer(v * 3600) })),
          opt: { nullBasis: true, yFormat: (v) => `${zahl(v)} h`, wochen }, fussnote: `Mittelwerte über ${k.schlaf_dauer.length} Nächte.` };
      }
      return { werte, serien: [{ name: "Schlafdauer", daten: w_(k.schlaf_dauer), slot: 1, format: (v) => dauer(v * 3600), endFormat: std, endWert: true }],
        opt: { yFormat: (v) => `${achsenZahl(v)} h`, wochen } };
    } })));
    knoten.push(h("div", { class: "abschnitt raster zwei" },
      await verlauf({ id: "schlafscore", titel: "Schlafscore", laden: async ({ von, wochen }) => {
        const r = await kennzahl("schlaf_score", von);
        return { serien: [{ name: "Schlafscore", daten: wochen ? nachWochen(r) : r, slot: 1, endWert: true }], werte: statistik(r), opt: { yMax: 100, wochen } };
      } }),
      await verlauf({ id: "schlafbedarf", titel: "Dauer und Bedarf", laden: async ({ von, wochen }) => {
        const k = await kennzahlen(["schlaf_dauer", "schlaf_bedarf"], von);
        const w_ = (r) => (wochen ? nachWochen(r) : r);
        return { serien: [
          { name: "Geschlafen", daten: w_(k.schlaf_dauer), slot: 1, format: (v) => dauer(v * 3600), endFormat: std, endWert: true },
          k.schlaf_bedarf.length ? { name: "Bedarf laut Garmin", daten: w_(k.schlaf_bedarf), slot: 2, format: (v) => dauer(v * 3600) } : null].filter(Boolean),
          opt: { yFormat: (v) => `${achsenZahl(v)} h`, wochen } };
      } })));
  }
  const nachtIds = [["schlaf_atem", 1], ["schlaf_spo2", 0], ["schlaf_haut", 1], ["schlaf_bb", 0]];
  const vorhanden = [];
  for (const [id, st] of nachtIds) if ((await kennzahl(id, isoMinus(365))).length) vorhanden.push([id, st]);
  if (vorhanden.length) {
    knoten.push(abschnitt("Werte in der Nacht", null, befundBox([bf.spo2, bf.atmung]), await verlauf({ id: "nachtwerte", auswahl: vorhanden.map(([id]) => ({ id, name: K[id][0].replace(" im Schlaf", "").replace(" (Abweichung)", "").replace(" aufgeladen", "") })),
      laden: async ({ von, wochen, wahl }) => {
        const st = vorhanden.find((x) => x[0] === wahl)[1];
        const [name, einheit] = K[wahl];
        const r = await kennzahl(wahl, von);
        return { serien: [{ name, daten: wochen ? nachWochen(r) : r, slot: 1, stellen: st, einheit, endWert: true }], werte: statistik(r, st, einheit),
          opt: { wochen, minSpanne: { schlaf_atem: 4, schlaf_spo2: 4, schlaf_haut: 1 }[wahl] },
          fussnote: wahl === "schlaf_haut" ? "Abweichung von deinem üblichen Wert." : null };
      } })));
  }
  // ---- Erholung: Stress und Body Battery
  const hatStress = (await kennzahl("stress", isoMinus(365))).length > 0, hatBB = (await kennzahl("bb_hoch", isoMinus(365))).length > 0;
  if (hatStress || hatBB) {
    knoten.push(abschnitt("Stress und Body Battery", "Tageswerte von Garmin, ab 6 Monaten als Wochenmittel.", befundBox([bf.stress]), h("div", { class: "raster zwei" },
      hatStress ? await verlauf({ id: "stress", titel: "Stress im Tagesmittel", laden: async ({ von, wochen }) => {
        const r = await kennzahl("stress", von);
        return { serien: [{ name: "Stress", daten: wochen ? nachWochen(r) : r, slot: 1, endWert: true }], werte: statistik(r), opt: { yMin: 0, wochen }, fussnote: "Skala 0 bis 100; unter 26 gilt als ruhig." };
      } }) : null,
      hatBB ? await verlauf({ id: "bodybattery", titel: "Body Battery", laden: async ({ von, wochen }) => {
        const k = await kennzahlen(["bb_hoch", "bb_tief"], von);
        const w_ = (r) => (wochen ? nachWochen(r) : r);
        return { serien: [{ name: "Höchstwert", daten: w_(k.bb_hoch), slot: 1, endWert: true }, { name: "Tiefstwert", daten: w_(k.bb_tief), slot: 2, endWert: true }].filter((x) => x.daten.length),
          werte: [statistik(k.bb_hoch)[0] ? { ...statistik(k.bb_hoch)[0], name: "Mittel Höchstwert" } : null, statistik(k.bb_tief)[0] ? { ...statistik(k.bb_tief)[0], name: "Mittel Tiefstwert" } : null],
          opt: { yMin: 0, yMax: 100, yIntervall: 25, wochen } };
      } }) : null)));
  }
  return { titel: "Schlaf", knoten };
}

// ======================================================================
// Ansicht: Sport
// ======================================================================
let sportFilter = "alle";
async function ansichtSport() {
  const [akt, info] = await Promise.all([Daten.aktivitaeten(), Daten.info("garmin")]);
  const k = await kennzahlen(["schritte", "im_mod", "etagen", "aktivkcal", "vo2lauf", "vo2rad", "bereitschaft",
    "fitnessalter", "last_akut", "wochenlast", "p5k", "ausdauer", "huegel"], isoMinus(364));
  const tsText = await Daten.texte("g.trainingsstatus.trainingStatusFeedbackPhrase", isoMinus(60));
  const bereitText = await Daten.texte("g.bereitschaft.level", isoMinus(10));
  const bf = (await befunde()).map;
  const knoten = [];

  // Kacheln
  const kacheln = [];
  const kz = (id, titel, stellen, unter, befund = null) => { const l = letzter(k[id]); if (l) kacheln.push(kachel({ titel, wert: zahl(l[1], stellen), funkeDaten: k[id].filter((p_) => p_[0] >= isoMinus(90)), unter: unter ? unter(l) : "", befund })); };
  kz("vo2lauf", "VO₂max Laufen", 1, (l) => deltaText(l[1], vorTagen(k.vo2lauf, 90), 1, "", "in 90 Tagen"));
  kz("vo2rad", "VO₂max Radfahren", 1, (l) => deltaText(l[1], vorTagen(k.vo2rad, 90), 1, "", "in 90 Tagen"));
  kz("bereitschaft", "Trainingsbereitschaft", 0, () => (letzter(bereitText) ? textDeutsch(letzter(bereitText)[1]) : ""));
  if (letzter(tsText)) kacheln.push(kachel({ titel: "Trainingsstatus", wert: textDeutsch(letzter(tsText)[1]), unter: `Stand ${datum(letzter(tsText)[0], "kurz")}`, befund: bf.trainingsstatus }));
  kz("wochenlast", "Wochenlast", 0);
  kz("fitnessalter", "Fitnessalter", 1, (l) => deltaText(l[1], vorTagen(k.fitnessalter, 90), 1, "Jahre", "in 90 Tagen"), bf.fitnessalter);
  if (kacheln.length) knoten.push(h("div", { class: "kacheln", style: { marginTop: "6px" } }, kacheln));

  // Aktivitätenliste mit eigenem Zeitraum
  const gruppenNamen = { lauf: "Laufen", fahrrad: "Radfahren", kraft: "Kraft & Fitness", wandern: "Wandern & Berg", gehen: "Gehen", schwimmen: "Wasser", yoga: "Yoga & Atem", sonst: "Sonstiges" };
  const zrListe = [...ZEITRAEUME, ZR_ALLE];
  let zr = zrGewaehlt("aktivitaeten", "30", zrListe.map((x) => x[0]));
  const segBox = h("div", { class: "segmente zr", role: "group", "aria-label": "Zeitraum der Aktivitäten" });
  const listeBox = h("div");
  const chipsBox = chipsRand(h("div", { class: "chips", role: "group", "aria-label": "Sportart" }));
  let anzahl = 15;
  const zeigeListe = () => {
    segBox.replaceChildren(...zrListe.map(([z, kurz, lang]) => h("button", { type: "button", "aria-pressed": String(z === zr), "aria-label": lang, title: lang,
      onclick: () => { zr = z; zrMerken("aktivitaeten", z); anzahl = 15; zeigeListe(); } }, kurz)));
    const von = zrVon(zr);
    const imZeitraum = akt.filter((a_) => !von || String(a_.start).slice(0, 10) >= von);
    const typen = [...new Set(imZeitraum.map((a_) => sportIcon(a_.typ)))];
    if (!typen.includes(sportFilter)) sportFilter = "alle";
    chipsBox.replaceChildren(...[["alle", "Alle"], ...typen.map((t_) => [t_, gruppenNamen[t_] || t_])].map(([t_, n]) =>
      h("button", { type: "button", "aria-pressed": String(sportFilter === t_), onclick: () => { sportFilter = t_; anzahl = 15; zeigeListe(); } }, n)));
    const gefiltert = imZeitraum.filter((a_) => sportFilter === "alle" || sportIcon(a_.typ) === sportFilter);
    const ul = h("ul", { class: "liste" });
    let monat = "";
    for (const a_ of gefiltert.slice(0, anzahl)) {
      const m = String(a_.start).slice(0, 7);
      if (m !== monat) { monat = m; ul.append(h("li", { class: "monat" }, DF.monat.format(new Date(tagMs(m + "-01"))))); }
      ul.append(h("li", null, aktivitaetZeile(a_)));
    }
    const summe = gefiltert.reduce((x, a_) => ({ n: x.n + 1, km: x.km + (a_.distanz || 0) / 1000, h: x.h + (a_.dauer || 0) / 3600 }), { n: 0, km: 0, h: 0 });
    const mehr = gefiltert.length > anzahl
      ? h("div", { class: "knopf-zeile" }, h("button", { type: "button", class: "knopf zweit", onclick: () => { anzahl += 30; zeigeListe(); } },
        `Weitere anzeigen (${zahl(gefiltert.length - anzahl)} übrig)`)) : null;
    listeBox.replaceChildren(...[
      kennzahlenZeile([{ name: "Aktivitäten", wert: zahl(summe.n) }, { name: "Strecke", wert: zahl(summe.km), einheit: "km" }, { name: "Zeit", wert: zahl(summe.h), einheit: "Std." }]),
      h("div", { style: { marginTop: "10px" } }, gefiltert.length ? ul : leer(`Keine Aktivität ${ZR_IN[zr]}`, zr === "alle" ? "" : "Wähle oben einen längeren Zeitraum.")), mehr].filter(Boolean));
  };
  zeigeListe();
  knoten.push(abschnitt("Aktivitäten", null, h("div", { class: "verlauf" }, h("div", { class: "verlauf-kopf" }, segBox), chipsBox, listeBox)));

  // Bewegung im Alltag: ein Diagramm, der Wert wird über Chips gewählt
  const balkenTage = (r, wochen) => (wochen ? nachWochen(r) : r);
  const tausender = (v) => (v >= 1000 ? `${zahl(v / 1000)}k` : zahl(v));
  const ALLTAG = {
    schritte: { name: "Schritte", da: k.schritte.length, laden: async ({ von, wochen }) => {
      const [r, ziele] = await Promise.all([kennzahl("schritte", von), kennzahl("schrittziel", isoMinus(30))]);
      const ziel = letzter(ziele)?.[1];
      return { serien: [{ name: wochen ? "Schritte pro Tag (Wochenmittel)" : "Schritte", daten: balkenTage(r, wochen), slot: 1, art: "balken" }],
        werte: [...statistik(r).slice(0, 1).map((x) => ({ ...x, name: "Mittel pro Tag" })), ziel ? { name: "Tage am Ziel", wert: `${zahl(r.filter((p_) => p_[1] >= ziel).length)} von ${zahl(r.length)}` } : null],
        opt: { nullBasis: true, wochen, referenzen: ziel ? [{ wert: ziel, text: `Ziel ${zahl(ziel)}` }] : [], yFormat: tausender } };
    } },
    intensitaet: { name: "Intensitätsminuten", da: k.im_mod.length, laden: async ({ von, tage }) => {
      const kk = await kennzahlen(["im_mod", "im_int"], von);
      const int = new Map(kk.im_int);
      const taeglich = kk.im_mod.map(([d, v]) => [d, v + 2 * (int.get(d) || 0)]);
      const woechentlich = (tage == null || tage > 30);
      const daten = woechentlich ? nachWochen(taeglich, "summe") : taeglich;
      return { serien: [{ name: woechentlich ? "Minuten pro Woche" : "Minuten pro Tag", daten, slot: 1, art: "balken", einheit: "Min." }],
        werte: [{ name: "Mittel pro Woche", wert: zahl(mittel(nachWochen(taeglich, "summe").map((p_) => p_[1]))), einheit: "Min." }],
        opt: { nullBasis: true, wochen: woechentlich, referenzen: woechentlich ? [{ wert: 150, text: "Ziel 150" }] : [] },
        fussnote: `${woechentlich ? "Summe pro Woche. " : ""}Minuten mit hoher Intensität zählen doppelt, wie bei Garmin. Ziel laut WHO: 150 Minuten pro Woche.` };
    } },
    etagen: { name: "Etagen", da: k.etagen.length, laden: async ({ von, wochen }) => {
      const r = await kennzahl("etagen", von);
      return { serien: [{ name: wochen ? "Etagen pro Tag (Wochenmittel)" : "Etagen", daten: balkenTage(r, wochen), slot: 1, art: "balken" }],
        werte: statistik(r).slice(0, 1).map((x) => ({ ...x, name: "Mittel pro Tag" })), opt: { nullBasis: true, wochen } };
    } },
    aktivkcal: { name: "Aktivkalorien", da: k.aktivkcal.length, laden: async ({ von, wochen }) => {
      const r = await kennzahl("aktivkcal", von);
      return { serien: [{ name: wochen ? "Aktivkalorien pro Tag (Wochenmittel)" : "Aktivkalorien", daten: balkenTage(r, wochen), slot: 1, art: "balken", einheit: "kcal" }],
        werte: statistik(r, 0, "kcal").slice(0, 1).map((x) => ({ ...x, name: "Mittel pro Tag" })), opt: { nullBasis: true, wochen } };
    } },
  };
  const alltag = Object.entries(ALLTAG).filter(([, a_]) => a_.da).map(([id, a_]) => ({ id, name: a_.name }));
  let alltagAbschnitt = null;
  if (alltag.length) {
    knoten.push(alltagAbschnitt = abschnitt("Bewegung im Alltag", "Bis 3 Monate je Tag, ab 6 Monaten als Mittel pro Tag in der Woche.", befundBox([bf.schritte, bf.intensitaet]),
      await verlauf({ id: "alltag", titel: alltag.length === 1 ? alltag[0].name : null, name: "Bewegung im Alltag", auswahl: alltag, laden: (a_) => ALLTAG[a_.wahl].laden(a_) })));
  }

  // Form und Leistung: ebenfalls ein Diagramm mit Chips
  const FORM = {
    vo2max: { name: "VO₂max", reihen: [["vo2lauf", "Laufen", 1, { stellen: 1 }], ["vo2rad", "Radfahren", 2, { stellen: 1 }]].filter(([id]) => k[id].length), opt: { yStellen: 0, minSpanne: 6 } },
    bereitschaft: { name: "Trainingsbereitschaft", reihen: [["bereitschaft", "Bereitschaft", 1]], opt: { yMin: 0, yMax: 100, yIntervall: 25 }, mitMittel: true },
    trainingslast: { name: "Trainingslast", reihen: [["last_akut", "Akut (7 Tage)", 1], ["last_chronisch", "Chronisch (28 Tage)", 2]], mitMittel: true },
    prognose: { name: "Wettkampfprognose", reihen: [["p5k", "5 km", 1, { format: zeitText }], ["p10k", "10 km", 2, { format: zeitText }]], opt: { yFormat: (v) => zeitText(v), zeitAchse: true, minSpanne: 120 }, fussnote: "Kürzere Zeit ist besser." },
    ausdauer: { name: "Ausdauerwert", reihen: [["ausdauer", "Ausdauerwert", 1]], opt: { minSpanne: 500 } },
    huegel: { name: "Hill Score", reihen: [["huegel", "Hill Score", 1]], opt: { minSpanne: 10 } },
    fitnessalter: { name: "Fitnessalter", reihen: [["fitnessalter", "Fitnessalter", 1, { stellen: 1, einheit: "Jahre" }]], opt: { yStellen: 0, minSpanne: 4 } },
  };
  const formWahl = Object.entries(FORM).filter(([, f_]) => f_.reihen.length && k[f_.reihen[0][0]].length).map(([id, f_]) => ({ id, name: f_.name }));
  if (formWahl.length) {
    nebenan(knoten, alltagAbschnitt, abschnitt("Form und Leistung", "Werte von Garmin, bis 3 Monate je Tag, ab 6 Monaten als Wochenmittel.", await verlauf({ id: "form", standard: "91",
      titel: formWahl.length === 1 ? formWahl[0].name : null, name: "Form und Leistung", auswahl: formWahl, laden: async ({ von, wochen, wahl }) => {
        const f_ = FORM[wahl];
        const kk = await kennzahlen(f_.reihen.map((x) => x[0]), von);
        const serien = f_.reihen.map(([kid, name, slot, extra]) => (kk[kid].length ? { name, daten: wochen ? nachWochen(kk[kid]) : kk[kid], slot, endWert: true, verbinden: true, ...(extra || {}) } : null)).filter(Boolean);
        const erste = kk[f_.reihen[0][0]];
        const ex = f_.reihen[0][3] || {};
        return { serien, opt: { wochen, ...(f_.opt || {}) }, fussnote: f_.fussnote || null,
          werte: erste.length ? [{ name: "Zuletzt", wert: ex.format ? ex.format(letzter(erste)[1]) : zahl(letzter(erste)[1], ex.stellen ?? 0), einheit: ex.einheit },
            ex.format ? null : f_.mitMittel ? statistik(erste, ex.stellen ?? 0)[0] : veraenderung(erste, ex.stellen ?? 0, ex.einheit || "")] : [] };
      } })));
  }

  // Prognose, Rekorde, Zonen
  const extras = [];
  const prog = info.prognose;
  if (prog && (prog.time5K || prog.time10K)) {
    extras.push(h("div", null, h("h3", { style: { marginBottom: "8px" } }, "Aktuelle Prognose"), werteListe([
      prog.time5K ? { name: "5 km", wert: zeitText(prog.time5K) } : null, prog.time10K ? { name: "10 km", wert: zeitText(prog.time10K) } : null,
      prog.timeHalfMarathon ? { name: "Halbmarathon", wert: zeitText(prog.timeHalfMarathon) } : null, prog.timeMarathon ? { name: "Marathon", wert: zeitText(prog.timeMarathon) } : null])));
  }
  const rekorde = Array.isArray(info.rekorde) ? info.rekorde : [];
  if (rekorde.length) {
    const PR = { 1: ["1 km", "zeit"], 2: ["1 Meile", "zeit"], 3: ["5 km", "zeit"], 4: ["10 km", "zeit"], 5: ["Halbmarathon", "zeit"], 6: ["Marathon", "zeit"], 7: ["Längster Lauf", "strecke"] };
    extras.push(h("div", null, h("h3", { style: { marginBottom: "8px" } }, "Bestleistungen"), h("table", { class: "tabelle" },
      h("tbody", null, rekorde.map((r) => {
        const [name, art] = PR[r.typeId] || [`${sportName(r.activityType)} (Rekord ${r.typeId})`, "roh"];
        const wert = art === "zeit" ? zeitText(r.value) : art === "strecke" ? `${zahl(r.value / 1000, 1)} km` : zahl(r.value);
        const wann = r.prStartTimeGmtFormatted || r.prStartTimeLocalFormatted;
        return h("tr", null, h("td", { class: "text" }, name), h("td", null, wert), h("td", null, wann ? datum(String(wann).slice(0, 10), "kurz") : ""));
      })))));
  }
  const zonen = Array.isArray(info.hf_zonen) ? info.hf_zonen.find((z) => z.sport === "DEFAULT") || info.hf_zonen[0] : null;
  const laktat = info.laktat && info.laktat.speed_and_heart_rate;
  if (zonen) {
    const grenzen = [zonen.zone1Floor, zonen.zone2Floor, zonen.zone3Floor, zonen.zone4Floor, zonen.zone5Floor, zonen.maxHeartRateUsed];
    extras.push(h("div", null, h("h3", { style: { marginBottom: "8px" } }, "Herzfrequenzzonen"), h("table", { class: "tabelle" },
      h("tbody", null, [1, 2, 3, 4, 5].map((z) => h("tr", null, h("td", null, h("span", { class: "chip", style: { "--c": css(`--zone-${z}`) } }, `Zone ${z}`)), h("td", null, `${grenzen[z - 1] ?? "–"}–${grenzen[z] ?? "–"} bpm`))))),
      werteListe([zonen.restingHeartRateUsed ? { name: "Ruhepuls dafür", wert: zahl(zonen.restingHeartRateUsed), einheit: "bpm" } : null,
        laktat && laktat.heartRate ? { name: "Laktatschwelle", wert: zahl(laktat.heartRate), einheit: "bpm", neben: laktat.speed ? `Tempo ${tempoText(laktat.speed * 10, true)} min/km` : "" } : null])));
  }
  if (extras.length) knoten.push(abschnitt("Prognose, Rekorde und Zonen", null, h("div", { class: "raster drei" }, extras)));
  return { titel: "Sport", knoten };
}

// ======================================================================
// Ansicht: eine Aktivität
// ======================================================================
let LEAFLET = null;
function leafletLaden() {
  if (window.L) return Promise.resolve();
  if (!LEAFLET) {
    LEAFLET = new Promise((ok, fehler) => {
      document.head.append(h("link", { rel: "stylesheet", href: "vendor/leaflet.css" }));
      const sk = h("script", { src: "vendor/leaflet.js" });
      sk.onload = ok; sk.onerror = fehler;
      document.head.append(sk);
    });
  }
  return LEAFLET;
}
let KARTE = null;
async function ansichtAktivitaet(id) {
  const liste = await Daten.aktivitaeten();
  const a = liste.find((x) => String(x.id) === String(id));
  if (!a) return { titel: "Aktivität", zurueck: "#sport", knoten: [leer("Aktivität nicht gefunden", "")] };
  const det = a.det ? await Daten.datei(`d/akt/${id}.enc`) : null;
  const laufen = istLauf(a.typ);
  const knoten = [h("p", { class: "leise", style: { marginTop: "6px" } }, `${sportName(a.typ)}, ${datum(a.start.slice(0, 10), "langJahr")}, ${a.start.slice(11, 16)} Uhr`)];
  // Die Karte steht ganz oben – sie ist das Erste, was man beim Öffnen einer Aktivität sieht
  if (det && det.track && det.track.length > 1) {
    const box = h("div", { class: "karten-box" }, h("div", { class: "karte", role: "region", "aria-label": "Karte der Strecke" }));
    knoten.push(h("div", { class: "abschnitt" }, box));
    const info = await Daten.info("garmin");
    NACH.push(() => karteZeichnen(box, det, a, laufen, info).catch((e) => console.error(e)));
  } else if (det) {
    knoten.push(h("p", { class: "fussnote", style: { marginTop: "10px" } }, a.gps
      ? "Für diese Aktivität hat Garmin keine GPS-Spur geliefert, deshalb gibt es keine Karte."
      : "Diese Aktivität wurde ohne GPS aufgezeichnet, zum Beispiel drinnen – deshalb gibt es keine Karte."));
  } else if (!a.det) {
    knoten.push(hinweis("Karte und Verlauf dieser Aktivität werden beim nächsten Abruf geladen."));
  }
  knoten.push(h("div", { class: "abschnitt" }, werteListe([
    a.distanz ? { name: "Strecke", wert: zahl(a.distanz / 1000, 2), einheit: "km" } : null,
    { name: "Dauer", wert: zeitText(a.dauer), neben: a.bewegt && Math.abs(a.bewegt - a.dauer) > 60 ? `in Bewegung ${zeitText(a.bewegt)}` : "" },
    a.tempo && a.distanz ? { name: laufen ? "Tempo" : "Geschwindigkeit", wert: tempoText(a.tempo, laufen), einheit: laufen ? "min/km" : "km/h", neben: a.tempo_max ? `max. ${tempoText(a.tempo_max, laufen)}` : "" } : null,
    a.hf ? { name: "Puls im Mittel", wert: zahl(a.hf), einheit: "bpm", neben: a.hf_max ? `max. ${zahl(a.hf_max)}` : "" } : null,
    a.auf != null ? { name: "Anstieg", wert: zahl(a.auf), einheit: "m", neben: a.ab != null ? `Abstieg ${zahl(a.ab)} m` : "" } : null,
    a.kcal ? { name: "Kalorien", wert: zahl(a.kcal), einheit: "kcal" } : null,
    a.te_a != null ? { name: "Trainingseffekt aerob", wert: zahl(a.te_a, 1), neben: a.te_an != null ? `anaerob ${zahl(a.te_an, 1)}` : "" } : null,
    a.last != null ? { name: "Trainingslast", wert: zahl(a.last) } : null,
    a.leistung ? { name: "Leistung im Mittel", wert: zahl(a.leistung), einheit: "W", neben: a.np ? `normiert ${zahl(a.np)} W` : "" } : null,
    a.kad_lauf ? { name: "Schrittfrequenz", wert: zahl(a.kad_lauf), einheit: "spm" } : a.kad_rad ? { name: "Trittfrequenz", wert: zahl(a.kad_rad), einheit: "rpm" } : null,
    a.schritte ? { name: "Schritte", wert: zahl(a.schritte) } : null,
    a.saetze ? { name: "Sätze", wert: zahl(a.saetze), neben: a.wdh ? `${zahl(a.wdh)} Wiederholungen` : "" } : null,
    a.bb != null ? { name: "Body Battery", wert: vorzeichen(a.bb) } : null,
    a.schweiss ? { name: "Schweißverlust", wert: zahl(a.schweiss), einheit: "ml" } : null,
    a.vo2 ? { name: "VO₂max danach", wert: zahl(a.vo2) } : null,
    a.temp_max != null ? { name: "Temperatur", wert: `${zahl(a.temp_min ?? a.temp_max)}–${zahl(a.temp_max)}`, einheit: "°C" } : null,
  ])));
  if (det && det.reihen) {
    const r = det.reihen;
    const nachStrecke = r.s && r.s.some((v) => v);
    const x = nachStrecke ? r.s.map((v) => (v == null ? null : v / 1000)) : (r.t || []).map((v) => (v == null ? null : v / 60));
    const reihe = (werte, f = (v) => v) => (werte || []).map((v, i) => [x[i], v == null ? null : f(v)]).filter((p) => p[0] != null);
    const kurven = [];
    if (r.hf) kurven.push(["Puls", reihe(r.hf), "bpm", 0]);
    if (r.v) kurven.push(laufen ? ["Tempo", reihe(r.v, (v) => (v > 0.5 ? 1000 / v / 60 : null)), "min/km", 2, true] : ["Geschwindigkeit", reihe(r.v, (v) => v * 3.6), "km/h", 1]);
    if (r.h) kurven.push(["Höhe", reihe(r.h), "m", 0]);
    if (r.kad) kurven.push([laufen ? "Schrittfrequenz" : "Trittfrequenz", reihe(r.kad), laufen ? "spm" : "rpm", 0]);
    if (r.p) kurven.push(["Leistung", reihe(r.p), "W", 0]);
    // Kurven ohne Zeit- oder Streckenachse (kommt bei Multisport vor) bleiben weg statt leer zu erscheinen
    const mitDaten = kurven.filter((k) => k[1].filter((p) => p[1] != null).length > 1);
    if (mitDaten.length) {
      knoten.push(abschnitt("Verlauf", nachStrecke ? "Über die Strecke in Kilometern." : "Über die Zeit in Minuten.", h("div", { class: "raster zwei" }, mitDaten.map(([name, daten, einheit, st, umgekehrt]) =>
        figur({ titel: name, hoehe: "klein", serien: [{ name, daten, slot: 1, einheit, stellen: st, punkte: false, format: umgekehrt ? (v) => `${Math.floor(v)}:${zweistellig(Math.round((v % 1) * 60) % 60)} min/km` : undefined }],
          zeichnen: (div) => wertDiagramm(div, name, daten, einheit, st, nachStrecke ? "km" : "min", umgekehrt),
          tabelle: () => h("table", { class: "tabelle" }, h("thead", null, h("tr", null, h("th", null, nachStrecke ? "km" : "Minute"), h("th", null, `${name} (${einheit})`))),
            h("tbody", null, daten.filter((_, i) => i % 5 === 0).map((p) => h("tr", null, h("td", null, zahl(p[0], 2)), h("td", null, p[1] == null ? "–" : zahl(p[1], st)))))) })))));
    }
  }
  if (a.zonen || (det && det.zonen && det.zonen.length)) {
    const sek = det && det.zonen && det.zonen.length ? det.zonen.map((z) => z[1]) : a.zonen;
    const summe = sek.reduce((x, y) => x + (y || 0), 0) || 1;
    knoten.push(abschnitt("Zeit in den Pulszonen", null, h("div", { class: "zonen" }, sek.map((v, i) =>
      h("div", { style: { display: "grid", gridTemplateColumns: "64px 1fr 72px", alignItems: "center", gap: "10px", margin: "6px 0" } },
        h("span", { class: "leise" }, `Zone ${i + 1}`),
        h("div", { style: { height: "18px", background: "var(--wash)", borderRadius: "4px" } }, h("div", { style: { width: `${(v / summe) * 100}%`, height: "100%", background: css(`--zone-${i + 1}`), borderRadius: "0 4px 4px 0", minWidth: v ? "2px" : "0" } })),
        h("span", { class: "zahlen", style: { textAlign: "right" } }, dauer(v)))))));
  }
  if (det && det.runden && det.runden.length > 1) {
    knoten.push(abschnitt("Runden", null, h("div", { class: "tabellen-rahmen", style: { maxHeight: "460px" } }, h("table", { class: "tabelle" },
      h("thead", null, h("tr", null, h("th", null, "Runde"), h("th", null, "Strecke"), h("th", null, "Zeit"), h("th", null, laufen ? "Tempo" : "km/h"), h("th", null, "Puls"), h("th", null, "Anstieg"))),
      h("tbody", null, det.runden.map((r, i) => h("tr", null, h("td", null, i + 1), h("td", null, r.s ? `${zahl(r.s / 1000, 2)} km` : "–"), h("td", null, zeitText(r.t)),
        h("td", null, r.v ? tempoText(r.v, laufen) : "–"), h("td", null, r.hf ? zahl(r.hf) : "–"), h("td", null, r.auf != null ? `${zahl(r.auf)} m` : "–"))))))));
  }
  return { titel: a.name || sportName(a.typ), zurueck: "#sport", knoten };
}
// ---- Karte der Strecke: Route nach Puls-Zone, Tempo oder Höhe eingefärbt, mit Kilometermarken
function abstandM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}
function quantile(werte, anteile) {
  const v = werte.filter(Number.isFinite).sort((x, y) => x - y);
  return v.length ? anteile.map((q) => v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))]) : null;
}
async function karteZeichnen(box, det, a, laufen, info) {
  const flaeche = box.querySelector(".karte");
  try { await leafletLaden(); }
  catch { box.replaceChildren(leer("Karte nicht verfügbar", "Ohne Internetverbindung kann die Karte nicht geladen werden.")); return; }
  if (!flaeche.isConnected) return;
  const mobil = matchMedia("(pointer: coarse)").matches;
  const track = det.track, n = track.length;
  const r = det.reihen || {};
  const angleichen = (werte) => {
    if (!Array.isArray(werte) || werte.length < 2) return null;
    const m = werte.length;
    const out = track.map((_, i) => werte[Math.round((i * (m - 1)) / Math.max(1, n - 1))]);
    return out.some(Number.isFinite) ? out : null;
  };
  const hf = angleichen(r.hf), v = angleichen(r.v), hoehe = angleichen(r.h);
  const zonen = (() => {
    const z = Array.isArray(info.hf_zonen) ? info.hf_zonen.find((x) => x.sport === "DEFAULT") || info.hf_zonen[0] : null;
    if (z && [z.zone1Floor, z.zone2Floor, z.zone3Floor, z.zone4Floor, z.zone5Floor].every(Number.isFinite)) return [z.zone1Floor, z.zone2Floor, z.zone3Floor, z.zone4Floor, z.zone5Floor];
    const max = a.hf_max || (hf ? Math.max(...hf.filter(Number.isFinite)) : null);
    return max ? [0.5, 0.6, 0.7, 0.8, 0.9].map((f) => Math.round(f * max)) : null;
  })();
  const tempoQ = v ? quantile(v.filter((x) => x > 0.3), [0.2, 0.4, 0.6, 0.8]) : null;
  const hoeheQ = hoehe ? quantile(hoehe, [0.2, 0.4, 0.6, 0.8]) : null;
  const modi = [hf && zonen ? ["puls", "Puls-Zonen"] : null, tempoQ ? ["tempo", laufen ? "Tempo" : "Geschwindigkeit"] : null, hoeheQ ? ["hoehe", "Höhe"] : null].filter(Boolean);
  let modus = speicher.get("gesundheit.karte");
  if (!modi.some(([m]) => m === modus)) modus = modi.length ? modi[0][0] : "einfach";
  const klassen = () => {
    const stufe = (x, grenzen) => 1 + grenzen.filter((g) => x >= g).length;
    if (modus === "puls") return hf.map((x) => (Number.isFinite(x) ? Math.min(5, stufe(x, zonen.slice(1))) : null));
    if (modus === "tempo") return v.map((x) => (Number.isFinite(x) && x > 0.3 ? stufe(x, tempoQ) : null));
    if (modus === "hoehe") return hoehe.map((x) => (Number.isFinite(x) ? stufe(x, hoeheQ) : null));
    return null;
  };

  // Kilometermarken (je nach Länge alle 1, 5 oder 10 km)
  const kumuliert = [0];
  for (let i = 1; i < n; i++) kumuliert.push(kumuliert[i - 1] + abstandM(track[i - 1], track[i]));
  const gesamt = kumuliert[n - 1];
  const schritt = gesamt <= 12000 ? 1000 : gesamt <= 45000 ? 5000 : 10000;
  const marken = [];
  for (let ziel = schritt, i = 1; ziel < gesamt - schritt * 0.3 && i < n; i++) if (kumuliert[i] >= ziel) { marken.push([track[i], ziel / 1000]); ziel += schritt; }

  const modiBox = modi.length > 1 ? h("div", { class: "chips karte-modi", role: "group", "aria-label": "Route einfärben nach" }) : null;
  const legende = h("div", { class: "karte-legende" });
  const hinweisText = mobil ? h("p", { class: "fussnote" }, "Mit zwei Fingern zoomen. Zum Verschieben tippe oben rechts auf das Vollbild-Symbol.") : null;
  box.replaceChildren(...[modiBox, flaeche, legende, hinweisText].filter(Boolean));

  KARTE = L.map(flaeche, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, preferCanvas: true, dragging: !mobil });
  KARTE.attributionControl.setPrefix(false);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap-Mitwirkende" }).addTo(KARTE);
  const grenzen = L.latLngBounds(track);
  const ebene = L.layerGroup().addTo(KARTE);
  const dunkel = istDunkel();
  const linienStil = { lineJoin: "round", lineCap: "round", interactive: false };

  const zeichne = () => {
    ebene.clearLayers();
    if (!dunkel) L.polyline(track, { ...linienStil, color: "#12262e", opacity: 0.28, weight: 11 }).addTo(ebene);
    L.polyline(track, { ...linienStil, color: dunkel ? "#0c1417" : "#ffffff", opacity: 0.95, weight: 8 }).addTo(ebene);
    const kl = klassen();
    if (!kl) L.polyline(track, { ...linienStil, color: farbe(1), weight: 5 }).addTo(ebene);
    else {
      let anfang = 0;
      for (let i = 1; i < n; i++) {
        if (kl[i] !== kl[anfang] || i === n - 1) {
          const k_ = kl[anfang];
          L.polyline(track.slice(anfang, i + 1), { ...linienStil, color: k_ ? css(`--zone-${k_}`) : css("--serie-grau"), weight: 5 }).addTo(ebene);
          anfang = i;
        }
      }
    }
    for (const [pos, km] of marken) {
      L.marker(pos, { icon: L.divIcon({ className: "karte-km", html: `<span>${km}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false }).addTo(ebene);
    }
    const punkt = (pos, farbeFuellung, text) => L.circleMarker(pos, { radius: 7, color: "#ffffff", weight: 2.5, fillColor: farbeFuellung, fillOpacity: 1, interactive: false })
      .bindTooltip(text, { permanent: true, direction: "top", offset: [0, -9], className: "karte-schild" }).addTo(ebene);
    if (abstandM(track[0], track[n - 1]) < 200) punkt(track[0], css("--tinte"), "Start und Ziel");
    else { punkt(track[0], css("--tinte"), "Start"); punkt(track[n - 1], css("--rose"), "Ziel"); }

    // Legende
    const kasten = (i) => h("i", { class: "kasten", style: { background: css(`--zone-${i}`) } });
    if (modus === "puls") {
      legende.replaceChildren(...[1, 2, 3, 4, 5].map((i) => h("span", null, kasten(i), `Zone ${i}`,
        h("small", null, i === 1 ? `unter ${zonen[1]}` : i === 5 ? `ab ${zonen[4]}` : `${zonen[i - 1]}–${zonen[i] - 1}`))), h("span", { class: "leise" }, "bpm"));
    } else if (modus === "tempo" || modus === "hoehe") {
      const werte = (modus === "tempo" ? v.filter((x) => x > 0.3) : hoehe).filter(Number.isFinite);
      const lo = Math.min(...werte), hi = Math.max(...werte);
      const f = modus === "hoehe" ? (x) => `${zahl(x)} m` : laufen ? (x) => `${tempoText(x, true)} min/km` : (x) => `${zahl(x * 3.6, 1)} km/h`;
      legende.replaceChildren(h("span", null, f(lo)), h("span", { class: "verlauf-balken", "aria-hidden": "true" }, [1, 2, 3, 4, 5].map(kasten)), h("span", null, f(hi)),
        h("span", { class: "leise" }, modus === "hoehe" ? "niedrig bis hoch" : "langsam bis schnell"));
    } else legende.replaceChildren();
    if (modiBox) modiBox.replaceChildren(...modi.map(([m, name]) => h("button", { type: "button", "aria-pressed": String(m === modus),
      onclick: () => { if (m !== modus) { modus = m; speicher.set("gesundheit.karte", m); zeichne(); } } }, name)));
  };
  zeichne();
  KARTE.fitBounds(grenzen, { padding: [24, 24] });

  // Vollbild: auf dem Handy erst dort verschiebbar, damit die Seite beim Scrollen nicht hängen bleibt
  const groesse = (gross) => {
    box.classList.toggle("gross", gross);
    document.documentElement.classList.toggle("karte-offen", gross);
    if (mobil) { if (gross) KARTE.dragging.enable(); else KARTE.dragging.disable(); }
    setTimeout(() => { if (!KARTE) return; KARTE.invalidateSize(); KARTE.fitBounds(grenzen, { padding: [28, 28] }); }, 80);
  };
  const Knopf = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const k = L.DomUtil.create("button", "karte-knopf");
      k.type = "button";
      const setze = () => { const gross = box.classList.contains("gross"); k.replaceChildren(icon(gross ? "verkleinern" : "vollbild", 20)); k.title = gross ? "Karte verkleinern" : "Karte groß anzeigen"; k.setAttribute("aria-label", k.title); };
      setze();
      L.DomEvent.disableClickPropagation(k);
      L.DomEvent.on(k, "click", () => { groesse(!box.classList.contains("gross")); setze(); });
      box.addEventListener("karte-klein", setze);
      return k;
    },
  });
  new Knopf().addTo(KARTE);
  const taste = (e) => {
    if (!box.isConnected) { document.removeEventListener("keydown", taste); return; }
    if (e.key === "Escape" && box.classList.contains("gross")) { groesse(false); box.dispatchEvent(new Event("karte-klein")); }
  };
  document.addEventListener("keydown", taste);
}
function wertDiagramm(div, name, daten, einheit, stellen, xEinheit, umgekehrt) {
  const c = farbe(1);
  return neuesDiagramm(div, {
    animation: BEWEGUNG, grid: { left: 4, right: 12, top: 10, bottom: 4, containLabel: true },
    xAxis: { type: "value", min: "dataMin", max: "dataMax", axisLine: { lineStyle: { color: css("--linie-stark") } }, axisTick: { show: false },
      axisLabel: { ...textStil(), formatter: achsenZahl }, splitLine: { show: false },
      axisPointer: { show: true, type: "line", lineStyle: { color: css("--tinte-3") }, label: { show: false } } },
    yAxis: { type: "value", scale: true, inverse: Boolean(umgekehrt), splitNumber: 3, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { ...textStil(), formatter: (v) => (umgekehrt ? `${Math.floor(v)}:${zweistellig(Math.round((v % 1) * 60) % 60)}` : zahl(v, stellen > 1 ? 1 : stellen)) },
      splitLine: { lineStyle: { color: css("--linie") } } },
    tooltip: { trigger: "axis", ...tooltipStil(), formatter: (p) => {
      const v = p[0].value[1];
      const t = v == null ? "–" : umgekehrt ? `${Math.floor(v)}:${zweistellig(Math.round((v % 1) * 60) % 60)} min/km` : `${zahl(v, stellen)} ${einheit}`;
      return `<div style="color:${css("--tinte-2")};font-size:12px">${zahl(p[0].value[0], 2)} ${xEinheit}</div>${tooltipZeile(c, t, name)}`; } },
    series: [{ type: "line", data: daten, showSymbol: false, connectNulls: false, lineStyle: { width: 2, color: c }, itemStyle: { color: c },
      areaStyle: umgekehrt ? undefined : { color: c, opacity: 0.08 }, sampling: "lttb" }],
  });
}

// ======================================================================
// Ansicht: Tag
// ======================================================================
/** Neuester Tag mit gespeichertem Tagesverlauf, sonst null */
function neuesterTag() {
  const tage = Object.keys((Daten.index && Daten.index.dateien) || {}).map((p) => /^d\/tag\/(\d{4}-\d{2}-\d{2})\.enc$/.exec(p)?.[1]).filter(Boolean).sort();
  return tage.length ? tage[tage.length - 1] : null;
}
async function ansichtTag(iso) {
  const heute = heuteIso();
  const ohneDatum = !iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso);
  // Ohne Datum: der neueste Tag mit Daten, damit die Seite nicht mit einem noch leeren „heute“ beginnt
  if (ohneDatum) { const n = neuesterTag(); iso = n && n <= heute ? n : heute; }
  const [tag, tw, w, akt] = await Promise.all([Daten.tag(iso), Daten.tageswerte(iso), Daten.withings(), Daten.aktivitaeten()]);
  const geh = (d) => { location.hash = `#tag/${d}`; };
  const eingabe = h("input", { type: "date", value: iso, max: heute, "aria-label": "Datum", onchange: (e) => e.target.value && geh(e.target.value) });
  const knoten = [h("div", { class: "filterzeile" }, h("div", { class: "tag-navi" },
    h("button", { type: "button", "aria-label": "Vorheriger Tag", onclick: () => geh(isoPlus(iso, -1)) }, icon("zurueck", 20)),
    eingabe,
    h("button", { type: "button", "aria-label": "Nächster Tag", disabled: iso >= heute, onclick: () => geh(isoPlus(iso, 1)) }, icon("vor", 20))))];
  knoten.push(h("p", { class: "leise", style: { margin: "6px 0 0" } }, datum(iso, "langJahr"),
    ohneDatum && iso !== heute ? ", der neueste Tag mit Tagesverlauf. Für heute ist noch keiner abgerufen." : ""));
  const bereich = [tagMs(iso), tagMs(iso) + 86400000];
  if (tag) {
    const kurven = [];
    if (tag.schlaf && tag.schlaf.phasen && tag.schlaf.phasen.length) kurven.push(schlafphasenFigur(tag.schlaf, "Schlaf der Nacht"));
    const opt = { mitUhrzeit: true, spanne: 1, xMin: bereich[0], xMax: bereich[1], rechts: 12 };
    if (tag.hf && tag.hf.length) kurven.push(figur({ titel: "Herzfrequenz", wert: tag.hf_info && tag.hf_info.restingHeartRate ? h("span", null, "Ruhepuls ", h("b", null, zahl(tag.hf_info.restingHeartRate))) : null,
      serien: [{ name: "Puls", daten: tag.hf, slot: 1, einheit: "bpm", punkte: false }], opt }));
    if (tag.stress && tag.stress.length) kurven.push(figur({ titel: "Stress", wert: tag.stress_info && tag.stress_info.avgStressLevel != null ? h("span", null, "Mittel ", h("b", null, zahl(tag.stress_info.avgStressLevel))) : null,
      serien: [{ name: "Stress", daten: tag.stress, slot: 1, art: "balken", rund: false }], opt: { ...opt, nullBasis: true, yMin: 0, yMax: 100, yIntervall: 25 }, fussnote: "Lücken: Bewegung oder zu wenige Messwerte." }));
    if (tag.bb && tag.bb.length) kurven.push(figur({ titel: "Body Battery", serien: [{ name: "Body Battery", daten: tag.bb, slot: 1, punkte: false, flaeche: true }], opt: { ...opt, yMin: 0, yMax: 100, yIntervall: 25 } }));
    if (tag.schritte && tag.schritte.length) kurven.push(figur({ titel: "Schritte", wert: h("span", null, "Summe ", h("b", null, zahl(tag.schritte.reduce((x, p) => x + (p[1] || 0), 0)))),
      serien: [{ name: "Schritte je 15 Minuten", daten: tag.schritte.map((p) => [p[0], p[1]]), slot: 1, art: "balken" }], opt: { ...opt, nullBasis: true } }));
    if (tag.atmung && tag.atmung.length) kurven.push(figur({ titel: "Atemfrequenz", hoehe: "klein", serien: [{ name: "Atemfrequenz", daten: tag.atmung, slot: 1, einheit: "/min", stellen: 1, punkte: false }], opt }));
    if (tag.spo2 && tag.spo2.length) kurven.push(figur({ titel: "SpO₂", hoehe: "klein", serien: [{ name: "SpO₂", daten: tag.spo2, slot: 1, einheit: "%" }], opt }));
    knoten.push(h("div", { class: "abschnitt raster zwei" }, kurven));
  } else {
    knoten.push(h("div", { class: "abschnitt" }, hinweis(iso >= isoMinus(90) ? "Für diesen Tag gibt es (noch) keinen Tagesverlauf. Er wird beim nächsten Abruf geladen." :
      "Tagesverläufe werden für die letzten 90 Tage und alle neuen Tage gespeichert. Für diesen Tag gibt es die Tageswerte unten.")));
  }
  // Withings-Messungen dieses Tages
  const gruppen = [];
  for (const [grpid, zeilen] of w._grp) if (isoAusMs(zeilen[0][0] * 1000) === iso) gruppen.push([zeilen[0][0] * 1000, grpid, zeilen]);
  gruppen.sort((a, b) => a[0] - b[0]);
  if (gruppen.length) {
    knoten.push(abschnitt("Messungen", null, h("ul", { class: "liste" }, gruppen.map(([ts, , zeilen]) => {
      const g = Object.fromEntries(zeilen.filter((r) => r[3] === -1).map((r) => [r[1], r[2]]));
      const titel = g[10] ? `Blutdruck ${g[10]}/${g[9]} mmHg` : g[1] ? `Gewicht ${zahl(g[1], 1)} kg` : W_TYPEN[zeilen[0][1]]?.[0] || "Messung";
      const neben = g[10] ? (g[11] ? `Puls ${g[11]}` : "") : g[6] ? `Fett ${zahl(g[6], 1)} %${g[76] ? `, Muskeln ${zahl(g[76], 1)} kg` : ""}` : "";
      return h("li", null, h("div", { class: "zeile" }, h("span", { class: "symbol" }, icon(g[10] ? "herz" : "koerper")),
        h("span", { class: "haupt" }, h("b", null, titel), h("span", null, `${uhr(ts)} Uhr${neben ? ", " + neben : ""}`)), h("span")));
    }))));
  }
  const aktTag = akt.filter((a) => String(a.start).slice(0, 10) === iso);
  if (aktTag.length) knoten.push(abschnitt("Aktivitäten", null, h("ul", { class: "liste" }, aktTag.map((a) => h("li", null, aktivitaetZeile(a))))));
  // alle Tageswerte
  const eintraege = Object.entries(tw.werte).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (eintraege.length) {
    const nachBereich = new Map();
    for (const [m, v] of eintraege) { const b = bereichName(m); if (!nachBereich.has(b)) nachBereich.set(b, []); nachBereich.get(b).push([m, v]); }
    knoten.push(abschnitt("Alle Tageswerte", `${eintraege.length} Werte an diesem Tag.`, h("div", { class: "tabellen-rahmen", style: { maxHeight: "560px" } }, h("table", { class: "tabelle" },
      h("tbody", null, [...nachBereich.entries()].map(([b, liste]) => [
        h("tr", null, h("th", { colspan: 2, style: { textAlign: "left", paddingTop: "14px" } }, b)),
        liste.map(([m, v]) => h("tr", null, h("td", { class: "text" }, h("a", { href: `#werte/${encodeURIComponent(m)}` }, metrikName(m))), h("td", null, zahl(v, Number.isInteger(v) ? 0 : 1)))),
      ]))))));
  }
  if (!tag && !gruppen.length && !aktTag.length && !eintraege.length) knoten.push(leer("Keine Daten an diesem Tag", ""));
  return { titel: "Tag im Detail", knoten };
}

// ======================================================================
// Ansicht: Alle Werte
// ======================================================================
async function ansichtWerte(metrik) {
  if (metrik) return ansichtMetrik(decodeURIComponent(metrik));
  const [kat, w] = await Promise.all([Daten.katalog(), Daten.withings()]);
  const eintraege = [];
  for (const [k_, zeilen] of w._typ) {
    const [typ, pos] = k_.split("|").map(Number);
    const id = pos >= 0 ? `w.mess.${typ}.${pos}` : `w.mess.${typ}`;
    eintraege.push({ id, name: wName(typ, pos), bereich: "Withings – Messungen", n: zeilen.length, bis: isoAusMs(Math.max(...zeilen.map((r) => r[0])) * 1000) });
  }
  for (const [m, [n, , bis]] of Object.entries(kat.werte || {})) eintraege.push({ id: m, name: metrikName(m), bereich: bereichName(m), n, bis });
  const suche = h("input", { class: "suche", type: "search", placeholder: "Wert suchen, z. B. Puls oder Schlaf", "aria-label": "Werte durchsuchen" });
  const box = h("div");
  const zeige = () => {
    const q = suche.value.trim().toLowerCase();
    const treffer = eintraege.filter((e) => !q || e.name.toLowerCase().includes(q) || e.bereich.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
    const gruppen = new Map();
    for (const e of treffer) { if (!gruppen.has(e.bereich)) gruppen.set(e.bereich, []); gruppen.get(e.bereich).push(e); }
    const reihenfolge = [...gruppen.keys()].sort((a, b) => (a.startsWith("Withings") === b.startsWith("Withings") ? a.localeCompare(b, "de") : a.startsWith("Withings") ? -1 : 1));
    box.replaceChildren(...reihenfolge.map((b) => h("div", null, h("h3", { class: "gruppe-titel" }, b),
      h("div", { class: "wertliste" }, gruppen.get(b).sort((x, y) => x.name.localeCompare(y.name, "de")).map((e) =>
        h("a", { href: `#werte/${encodeURIComponent(e.id)}` }, h("b", { style: { fontWeight: 500 } }, e.name), h("span", null, `${zahl(e.n)} Werte, bis ${datum(e.bis, "kurz")}`)))))),
      treffer.length ? "" : leer("Nichts gefunden", "Versuche einen anderen Begriff."));
  };
  suche.addEventListener("input", zeige);
  zeige();
  return { titel: "Alle Werte", knoten: [h("p", { class: "leise", style: { margin: "6px 0 14px" } }, `${eintraege.length} Messgrößen aus Withings und Garmin. Alles, was die Dienste liefern, ist hier abrufbar.`), suche, box] };
}
async function ansichtMetrik(m) {
  let alle, name = metrikName(m), einheit = "", stellen = 1, mitUhrzeit = false;
  if (m.startsWith("w.mess.")) {
    const [, , typ, pos] = m.split(".");
    const w = await Daten.withings();
    const t_ = W_TYPEN[+typ] || [name, "", 1];
    einheit = t_[1]; stellen = t_[2];
    alle = wReihe(w, +typ, pos == null ? -1 : +pos).map((p_) => [p_[0], p_[1]]);
    mitUhrzeit = true;
  } else {
    alle = await Daten.reihe(m);
    stellen = alle.some((p_) => !Number.isInteger(p_[1])) ? 1 : 0;
  }
  const knoten = [h("p", { class: "leise", style: { margin: "4px 0 0" } }, bereichName(m))];
  if (!alle.length) { knoten.push(leer("Noch keine Werte", "")); return { titel: name, zurueck: "#werte", knoten }; }
  const daten = alle;
  const l = alle[alle.length - 1];
  knoten.push(h("div", { class: "abschnitt" },
    werteListe([{ name: "Zuletzt", wert: zahl(l[1], stellen), einheit, neben: mitUhrzeit ? DF.datumZeit.format(new Date(l[0])) : datum(l[0], "kurz") }]),
    h("div", { style: { marginTop: "14px" } }, await verlauf({ id: "metrik", mitAlle: true, hoehe: "gross", laden: ({ von, wochen }) => {
      const roh = imBereich(alle, von);
      return { serien: [{ name, daten: wochen ? nachWochen(roh) : roh, slot: 1, stellen, einheit, endWert: true }],
        werte: [...statistik(roh, stellen, einheit), { name: "Anzahl", wert: zahl(roh.length) }],
        opt: { mitUhrzeit: mitUhrzeit && !wochen, wochen, yStellen: stellen > 1 ? 1 : stellen } };
    } }))));
  // Rohdaten
  if (m.startsWith("g.") || m.startsWith("w.")) {
    const art = m.split(".")[1];
    const quelle = m.startsWith("g.") ? `g-${art}` : `w-${art}`;
    const eingabe = h("input", { type: "date", value: daten[daten.length - 1][0], class: "suche", style: { maxWidth: "220px" } });
    const pre = h("pre", { class: "roh", hidden: true });
    const knopf = h("button", { type: "button", class: "knopf zweit", onclick: async () => {
      const iso = eingabe.value;
      const roh = await Daten.datei(`d/roh/${quelle}/${iso.slice(0, 4)}.enc`);
      const eintrag = roh && roh[iso];
      pre.textContent = eintrag ? JSON.stringify(eintrag, null, 2) : "Für diesen Tag gibt es keine Rohdaten.";
      pre.hidden = false;
    } }, "Rohdaten anzeigen");
    if (!m.startsWith("w.mess.")) knoten.push(abschnitt("Rohdaten eines Tages", "So, wie der Dienst sie geliefert hat.", h("div", { class: "knopf-zeile", style: { alignItems: "center" } }, eingabe, knopf), pre));
  }
  return { titel: name, zurueck: "#werte", knoten };
}

// ======================================================================
// Ansicht: Arztbericht (PDF)
// ======================================================================
const BERICHT_S = "gesundheit.bericht";
function skriptLaden(src) {
  return new Promise((ok, fehler) => {
    const sk = h("script", { src });
    sk.onload = () => ok();
    sk.onerror = () => { sk.remove(); fehler(new Error(`${src} konnte nicht geladen werden. Bist du online?`)); };
    document.head.append(sk);
  });
}
async function berichtBibliotheken() {
  if (!window.jspdf) await skriptLaden("vendor/jspdf.umd.min.js");
  if (!window.jspdf.jsPDF.API.autoTable) await skriptLaden("vendor/jspdf.plugin.autotable.min.js");
  if (!window.GesundheitBericht) await skriptLaden(`bericht.js?v=${APP_VERSION}`);
}
/** Passt der geladene Berichtsteil zur App? Nach einem Update kann kurz eine andere Fassung im Speicher liegen. */
function berichtPasst() {
  return Boolean(window.GesundheitBericht && window.GesundheitBericht.version === APP_VERSION);
}
function berichtKontext() {
  return { Daten, kennzahl, kennzahlen, wReihe, wTaeglich, wGruppe, blutdruckMessungen, istMorgens, textDeutsch, sportName, dauer, zahl, vorzeichen, mittel,
    tagMs, isoAusMs, isoPlus, isoWoche, montagIso, nachWochen, tagesMittel, letzter, SCHRIFT, APP_VERSION,
    personAus, wBereich, W_BEREICHE, PWV_GRENZE, spanne, ekgKlasse, koerperZonen };
}
const BERICHT_TEILE = [
  ["blutdruck", "Blutdruck und Puls", "Mittelwerte morgens und abends, Verlauf, Wochenmittel"],
  ["protokoll", "Blutdruck-Messprotokoll", "Jede einzelne Messung, als Anhang", "blutdruck"],
  ["ekg", "EKG", "Aufzeichnungen mit der Auswertung des Geräts"],
  ["ekgKurven", "EKG-Kurven", "Je Aufzeichnung eine Seite wie auf EKG-Papier", "ekg"],
  ["herz", "Herz und Kreislauf", "Ruhepuls, Herzfrequenzvariabilität, Gefäße"],
  ["koerper", "Körperzusammensetzung", "Gewicht, Fett, Muskeln, Wasser, Körperregionen"],
  ["schlaf", "Schlaf und Atmung", "Dauer, Phasen, Sauerstoffsättigung, Atemfrequenz"],
  ["aktivitaet", "Aktivität und Training", "Schritte, Intensitätsminuten, Trainings, VO₂max"],
  ["aktivitaetenliste", "Aktivitätenliste", "Jede Aktivität einzeln, als Anhang", "aktivitaet"],
  ["erholung", "Stress und Erholung", "Stress und Body Battery"],
];
async function berichtVerfuegbar(von, bis) {
  const [w, ekg, akt] = await Promise.all([Daten.withings(), Daten.ekg(), Daten.aktivitaeten()]);
  const a = tagMs(von), b = tagMs(bis) + 86399999;
  const k = await kennzahlen(["ruhepuls", "hrv", "schlaf_dauer", "schritte", "stress"], von, bis);
  const bp = blutdruckMessungen(w).filter((m) => m.ts >= a && m.ts <= b).length;
  const e = ekg.filter((x) => x.ts && x.ts * 1000 >= a && x.ts * 1000 <= b);
  const gewicht = wTaeglich(wReihe(w, 1).filter((p_) => p_[0] >= a && p_[0] <= b)).length;
  const ak = akt.filter((x) => { const d = String(x.start || "").slice(0, 10); return d >= von && d <= bis; }).length;
  const n = (x, eins, viele) => (x ? `${zahl(x)} ${x === 1 ? eins : viele}` : null);
  return {
    blutdruck: n(bp, "Messung", "Messungen"), protokoll: bp ? `etwa ${Math.max(1, Math.ceil(new Set(blutdruckMessungen(w).filter((m) => m.ts >= a && m.ts <= b).map((m) => isoAusMs(m.ts))).size / 34))} Seiten` : null,
    ekg: n(e.length, "Aufzeichnung", "Aufzeichnungen"), ekgKurven: n(e.filter((x) => x.kurve).length, "Kurve", "Kurven"),
    herz: n(Math.max(k.ruhepuls.length, k.hrv.length), "Tag", "Tage"), koerper: n(gewicht, "Messtag", "Messtage"),
    schlaf: n(k.schlaf_dauer.length, "Nacht", "Nächte"), aktivitaet: n(ak, "Aktivität", "Aktivitäten") || n(k.schritte.length, "Tag", "Tage"),
    aktivitaetenliste: n(ak, "Aktivität", "Aktivitäten"), erholung: n(k.stress.length, "Tag", "Tage"),
  };
}
let berichtDatei = null;
async function ansichtBericht() {
  let g = {};
  try { g = JSON.parse(speicher.get(BERICHT_S) || "{}") || {}; } catch { g = {}; }
  const heute = heuteIso();
  const ZR = [["30", "1 M", "1 Monat"], ["91", "3 M", "3 Monate"], ["182", "6 M", "6 Monate"], ["365", "12 M", "12 Monate"], ["frei", "Eigener", "Eigener Zeitraum"]];
  let zr = ZR.some((x) => x[0] === g.zeitraum) ? g.zeitraum : "91";
  const vonFeld = h("input", { type: "date", class: "eingabe", value: g.von || isoMinus(90), max: heute });
  const bisFeld = h("input", { type: "date", class: "eingabe", value: g.bis || heute, max: heute });
  const freiBox = h("div", { class: "datum-zeile" }, h("label", null, h("span", null, "Von"), vonFeld), h("label", null, h("span", null, "Bis"), bisFeld));
  const zrText = h("p", { class: "leise", style: { marginTop: "10px" } });
  const seg = h("div", { class: "segmente zr", role: "group", "aria-label": "Zeitraum des Berichts" });
  const auswahl = { blutdruck: true, protokoll: true, ekg: true, ekgKurven: true, herz: true, koerper: true, schlaf: true, aktivitaet: true, aktivitaetenliste: false, erholung: true, ...(g.abschnitte || {}) };
  const optionenBox = h("div", { class: "optionen" });
  const zeitraumJetzt = () => (zr === "frei" ? [vonFeld.value || isoMinus(90), bisFeld.value || heute].sort() : [isoMinus(+zr - 1), heute]);
  let verfuegbar = null;
  let nr = 0;
  const zeichneOptionen = () => {
    // Was im Zeitraum keine Daten hat, kommt auch nicht in den Bericht – also gar nicht erst anbieten
    const teile = BERICHT_TEILE.filter(([id, , , eltern]) => !verfuegbar || (verfuegbar[id] && (!eltern || verfuegbar[eltern])));
    optionenBox.replaceChildren(...teile.map(([id, name, text, eltern]) => {
      const box = h("input", { type: "checkbox", id: `bt-${id}`, checked: auswahl[id] || null, disabled: (eltern && !auswahl[eltern]) || null,
        onchange: (e) => { auswahl[id] = e.target.checked; zeichneOptionen(); } });
      return h("label", { class: `option${eltern ? " unter" : ""}`, for: `bt-${id}` }, box,
        h("span", { class: "option-text" }, h("b", null, name), h("span", null, text)),
        verfuegbar ? h("span", { class: "option-anzahl" }, verfuegbar[id]) : null);
    }), verfuegbar && !teile.length ? leer("Keine Daten in diesem Zeitraum", "Wähle einen anderen Zeitraum.") : null);
  };
  const aktualisieren = async () => {
    const meins = ++nr;
    seg.replaceChildren(...ZR.map(([w_, n, lang]) => h("button", { type: "button", "aria-pressed": String(w_ === zr), "aria-label": lang, title: lang, onclick: () => { zr = w_; aktualisieren(); } }, n)));
    freiBox.hidden = zr !== "frei";
    const [von, bis] = zeitraumJetzt();
    const tage = Math.round((tagMs(bis) - tagMs(von)) / 86400000) + 1;
    zrText.textContent = `${DF.kurzJahr.format(new Date(tagMs(von)))} bis ${DF.kurzJahr.format(new Date(tagMs(bis)))}, ${zahl(tage)} Tage`;
    const v = await berichtVerfuegbar(von, bis);
    if (meins !== nr) return;
    verfuegbar = v;
    zeichneOptionen();
  };
  vonFeld.addEventListener("change", aktualisieren);
  bisFeld.addEventListener("change", aktualisieren);
  const nameFeld = h("input", { type: "text", class: "eingabe", value: g.name || "", autocomplete: "name", placeholder: "Vor- und Nachname" });
  const geburtFeld = h("input", { type: "date", class: "eingabe", value: g.geburt || "", max: heute });
  const notizFeld = h("textarea", { class: "eingabe", rows: 3, placeholder: "Zum Beispiel Anlass des Termins, Medikamente oder Fragen an die Praxis" });
  notizFeld.value = g.notiz || "";
  const merken = h("input", { type: "checkbox", id: "bt-merken", checked: g.merken !== false || null });
  const status = h("p", { class: "bericht-status", role: "status", "aria-live": "polite" });
  const ergebnisBox = h("div", { class: "bericht-ergebnis", hidden: true });
  const knopf = h("button", { type: "button", class: "knopf" }, icon("bericht", 20), "PDF erstellen");
  const zeigeErgebnis = (datei) => {
    const kb = datei.blob.size / 1024;
    const groesse = kb > 1000 ? `${zahl(kb / 1024, 1)} MB` : `${zahl(kb)} KB`;
    const teilbar = (() => { try { return Boolean(navigator.canShare && navigator.canShare({ files: [new File([datei.blob], datei.dateiname, { type: "application/pdf" })] })); } catch { return false; } })();
    ergebnisBox.replaceChildren(icon("haken", 24),
      h("div", null, h("b", null, "Der Bericht ist fertig"), h("span", null, `${datei.dateiname}, ${datei.seiten} ${datei.seiten === 1 ? "Seite" : "Seiten"}, ${groesse}`),
        h("div", { class: "knopf-zeile" },
          h("a", { class: "knopf", href: datei.url, download: datei.dateiname }, "Speichern"),
          teilbar ? h("button", { type: "button", class: "knopf zweit", onclick: async () => {
            try { await navigator.share({ files: [new File([datei.blob], datei.dateiname, { type: "application/pdf" })], title: "Gesundheitsbericht" }); }
            catch (e) { if (e && e.name !== "AbortError") status.textContent = "Teilen hat nicht geklappt. Speichere den Bericht und hänge ihn selbst an."; }
          } }, "Teilen") : null,
          h("a", { class: "knopf zweit", href: datei.url, target: "_blank", rel: "noopener" }, "Ansehen"))));
    ergebnisBox.hidden = false;
  };
  knopf.addEventListener("click", async () => {
    const [von, bis] = zeitraumJetzt();
    if (von > bis) { status.textContent = "Der Anfang liegt nach dem Ende. Bitte die Daten prüfen."; return; }
    const einstellungen = { zeitraum: zr, von: vonFeld.value, bis: bisFeld.value, abschnitte: auswahl, merken: merken.checked };
    if (merken.checked) Object.assign(einstellungen, { name: nameFeld.value.trim(), geburt: geburtFeld.value, notiz: notizFeld.value.trim() });
    speicher.set(BERICHT_S, JSON.stringify(einstellungen));
    knopf.disabled = true; ergebnisBox.hidden = true;
    status.textContent = "Bericht wird vorbereitet …";
    try {
      await berichtBibliotheken();
      const datei = await window.GesundheitBericht.erstellen(berichtKontext(),
        { von, bis, name: nameFeld.value.trim(), geburt: geburtFeld.value, notiz: notizFeld.value.trim(), abschnitte: { ...auswahl } },
        (text) => { status.textContent = text; });
      if (berichtDatei && berichtDatei.url) URL.revokeObjectURL(berichtDatei.url);
      berichtDatei = { ...datei, url: URL.createObjectURL(datei.blob) };
      status.textContent = "";
      zeigeErgebnis(berichtDatei);
    } catch (e) {
      console.error(e);
      if (window.GesundheitBericht && !berichtPasst()) {
        // Eine neuere App-Version ist schon teilweise da: einmal neu laden, dann passt alles zusammen
        status.replaceChildren(`Der Bericht konnte nicht erstellt werden, weil gerade eine neue Version der App geladen wird. Lade die App einmal neu und tippe dann noch einmal auf „PDF erstellen“.`,
          h("span", { class: "knopf-zeile" }, h("button", { type: "button", class: "knopf zweit", onclick: () => location.reload() }, "Neu laden")));
      } else status.textContent = `Der Bericht konnte nicht erstellt werden (${e && e.message ? e.message : e}).`;
    } finally { knopf.disabled = false; }
  });
  await aktualisieren();
  return { titel: "Arztbericht", knoten: [
    h("p", { class: "einleitung-bericht" }, "Ein PDF mit den wichtigen Werten aus Withings und Garmin – zum Mitnehmen, Mailen oder Ausdrucken. Es entsteht auf diesem Gerät; deine Daten verlassen es dabei nicht."),
    abschnitt("Zeitraum", null, seg, freiBox, zrText),
    abschnitt("Angaben für die Praxis", "Freiwillig. Sie stehen nur im PDF und bleiben auf diesem Gerät.",
      h("div", { class: "felder" },
        h("label", { class: "feld-app" }, h("span", null, "Name"), nameFeld),
        h("label", { class: "feld-app" }, h("span", null, "Geburtsdatum"), geburtFeld),
        h("label", { class: "feld-app breit" }, h("span", null, "Anmerkung"), notizFeld)),
      h("label", { class: "merken", for: "bt-merken" }, merken, "Angaben auf diesem Gerät merken")),
    abschnitt("Inhalt", "Die Übersicht ist immer dabei. Bereiche ohne Daten im Zeitraum werden übersprungen.", optionenBox),
    h("div", { class: "abschnitt" }, h("div", { class: "knopf-zeile" }, knopf), status, ergebnisBox),
    berichtDatei ? (() => { zeigeErgebnis(berichtDatei); return null; })() : null,
  ] };
}

// ======================================================================
// Ansicht: Status
// ======================================================================
function stundenSeitAbruf() {
  const i = Daten.index;
  if (!i || !i.eingerichtet || !i.stand) return 0;
  return (Date.now() - Date.parse(i.stand)) / 3600000;
}
function workflowAdresse() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  const repo = location.pathname.split("/").filter(Boolean)[0];
  return m && repo ? `https://github.com/${m[1]}/${repo}/actions/workflows/gesundheit.yml` : null;
}
// Was Body Scan und BPM Vision messen können – zum Abgleich, was davon über die Schnittstelle ankommt
const W_GERAETEWERTE = [[[1], "Gewicht"], [[6, 8], "Körperfett"], [[5], "Magermasse"], [[76], "Muskelmasse"], [[77], "Körperwasser"], [[88], "Knochenmasse"],
  [[170], "Viszeralfett"], [[226], "Grundumsatz"], [[173, 174, 175], "Körperregionen"], [[168, 169], "Intra- und extrazelluläres Wasser"], [[227], "Stoffwechselalter"],
  [[91], "Pulswellengeschwindigkeit"], [[155], "Gefäßalter"], [[167, 158, 159], "Nervengesundheit"], [[9, 10], "Blutdruck"]];
async function withingsBestand() {
  const [w, ekg] = await Promise.all([Daten.withings(), Daten.ekg()]);
  const da = new Set(w.messungen.map((r) => r[1]));
  const kommt = [], fehlt = [];
  for (const [typen, name] of W_GERAETEWERTE) (typen.some((t_) => da.has(t_)) ? kommt : fehlt).push(name);
  (ekg.length ? kommt : fehlt).push("EKG");
  return { kommt, fehlt, abgelehnt: (w.abgelehnt || []).map((t_) => wName(+t_)) };
}
async function ansichtStatus() {
  const idx = Daten.index;
  const q = idx.quellen || {};
  const protokoll = ((await Daten.datei("d/protokoll.enc")) || {}).zeilen || [];
  const bestand = await withingsBestand();
  const quelleBlock = (name, st, extra) => {
    let zustand;
    if (!st || !st.verbunden) zustand = chip("nicht verbunden", "neutral");
    else if (st.anmeldung_noetig) zustand = chip("neu anmelden", "kritisch");
    else if (st.ok === false) zustand = chip("Fehler beim Abruf", "ernst");
    else if (st.fehler) zustand = chip("wartet", "warnung");
    else zustand = chip("verbunden", "gut");
    return h("div", { class: "quelle" },
      h("div", { class: "quelle-kopf" }, h("h3", null, name), zustand),
      st && st.letzter_erfolg ? h("p", { class: "leise" }, `Zuletzt erfolgreich ${vorZeit(st.letzter_erfolg)}`) : null,
      st && st.fehler ? h("p", null, st.fehler) : null,
      st && st.anmeldung_noetig ? h("p", { class: "leise" }, "Öffne auf dem Chromebook das Einrichtungsfenster (Symbol „Gesundheit Einrichtung“ bei den Linux-Apps), melde dich dort neu an und klicke auf „In die Cloud übertragen“. Danach geht es automatisch weiter.") : null,
      extra || null);
  };
  const g = q.garmin || {};
  const darstellung = speicher.get(S.darstellung) || "system";
  const wf = workflowAdresse();
  const knopfEntfernen = h("button", { type: "button", class: "knopf zweit" }, "Schlüssel von diesem Gerät entfernen");
  knopfEntfernen.addEventListener("click", () => {
    if (knopfEntfernen.dataset.sicher) { speicher.set(S.schluessel, null); location.hash = ""; location.reload(); return; }
    knopfEntfernen.dataset.sicher = "1"; knopfEntfernen.textContent = "Wirklich entfernen? Noch einmal tippen";
  });
  const knoten = [
    abschnitt("Datenquellen", `Die Daten werden stündlich abgerufen. Letzter Abruf ${vorZeit(idx.stand)}.`,
      stundenSeitAbruf() > 3 ? hinweis([
        `Der letzte Abruf war ${vorZeit(idx.stand)}, normalerweise kommt jede Stunde einer.`,
        "Tippe auf „Jetzt abrufen“ – das schaltet einen von GitHub pausierten Abruf auch wieder ein. Ohne Sync-Knopf: auf der GitHub-Seite „Enable workflow“ und danach „Run workflow“ antippen.",
      ], "warnung", "warnung") : null,
      quelleBlock("Withings", q.withings),
      quelleBlock("Garmin Connect", g, g.verbunden ? werteListe([
        { name: "Historie", wert: g.historie_fertig ? "vollständig" : "lädt", neben: g.historie_bis ? `zurück bis ${datum(g.historie_bis, "kurz")}` : "" },
        { name: "Aktivitäten", wert: zahl(g.aktivitaeten || 0), neben: g.details_offen ? `${zahl(g.details_offen)} Details folgen` : "alle Details geladen" },
        { name: "Tagesverläufe", wert: zahl((idx.verlaeufe || []).length) },
      ]) : null),
      h("div", { class: "knopf-zeile" },
        h("button", { class: "knopf", type: "button", onclick: () => Sync.starten() }, icon("sync", 20), "Jetzt abrufen"),
        wf ? h("a", { class: "knopf zweit", href: wf, target: "_blank", rel: "noopener" }, "GitHub-Seite des Abrufs") : null),
      h("p", { class: "fussnote" }, Daten.hat("d/sync.enc")
        ? `„Jetzt abrufen“ (auch oben mit dem Pfeil-Symbol) startet sofort einen Abruf und meldet, ob er geklappt hat.${Sync.zuletzt ? ` Zuletzt: ${Sync.zuletzt.titel.toLowerCase()}, ${uhr(Sync.zuletzt.zeit)} Uhr.` : ""}`
        : "Der Sync-Knopf ist noch nicht freigeschaltet (Einrichtungsfenster am Chromebook, Schritt 5). Bis dahin: auf der GitHub-Seite „Run workflow“ antippen.")),
    abschnitt("Gespeicherte Daten", null, werteListe([
      { name: "Withings-Messwerte", wert: zahl(idx.zaehler?.messungen || 0) }, { name: "Aktivitäten", wert: zahl(idx.zaehler?.aktivitaeten || 0) },
      { name: "EKG", wert: zahl(idx.zaehler?.ekg || 0) }, { name: "Arten von Tageswerten", wert: zahl(idx.zaehler?.metriken || 0) },
      { name: "Jahre", wert: (idx.jahre || []).length ? `${idx.jahre[0]}–${idx.jahre[idx.jahre.length - 1]}` : "–" },
    ])),
    abschnitt("Was Withings liefert", "Die App zeigt nur Werte, die über die Schnittstelle von Withings ankommen. Was dort nicht ankommt, blendet sie aus.",
      h("dl", { class: "bestand-liste" }, [
        ["Kommt an", bestand.kommt.join(", ") || "noch nichts"],
        bestand.fehlt.length ? ["Kommt nicht an", bestand.fehlt.join(", ")] : null,
        bestand.abgelehnt.length ? ["Von Withings abgelehnt", bestand.abgelehnt.join(", ")] : null,
      ].filter(Boolean).flatMap(([dt, dd]) => [h("dt", null, dt), h("dd", null, dd)])),
      bestand.fehlt.length ? h("p", { class: "fussnote" }, "Die Withings-App zeigt manche dieser Werte, gibt sie über die Schnittstelle aber nicht für jedes Konto heraus. Sobald Withings einen Wert liefert, erscheint er in der App von selbst.") : null),
    abschnitt("Darstellung", null, h("div", { class: "segmente", role: "group", "aria-label": "Darstellung" }, [["system", "Wie das Gerät"], ["light", "Hell"], ["dark", "Dunkel"]].map(([w_, t]) =>
      h("button", { type: "button", "aria-pressed": String(darstellung === w_), onclick: () => {
        speicher.set(S.darstellung, w_ === "system" ? null : w_);
        if (w_ === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", w_);
        neuZeichnen();
      } }, t)))),
    abschnitt("Dieses Gerät", "Der Schlüssel liegt nur in diesem Browser. Ohne ihn sind die Daten nicht lesbar.", knopfEntfernen),
    abschnitt("Fehlerprotokoll speichern", "Alle Meldungen der Abrufe und Fehler der App als Textdatei – zum Beispiel, um sie bei Problemen zu verschicken. Schlüssel und Zugangsdaten stehen nicht darin.",
      protokollKnoepfe(),
      h("p", { class: "fussnote" }, "Am Chromebook findest du die Datei in der App „Dateien“ unter „Downloads“, am Handy im Ordner „Downloads“.")),
    abschnitt("Protokoll", "Die letzten Abrufe, neueste zuerst.", protokoll.length ? h("ul", { class: "protokoll" }, protokoll.slice(-120).reverse().map(([t, stufe, text]) =>
      h("li", { class: stufe === "fehler" ? "fehler" : "" }, h("time", null, DF.datumZeit.format(new Date(t * 1000)).replace(/\d{4}, /, "")), h("span", null, text)))) : leer("Noch kein Protokoll", "")),
    h("p", { class: "fussnote", style: { marginTop: "32px" } }, `App ${APP_VERSION}, Datenstand ${idx.stand ? DF.datumZeit.format(new Date(idx.stand)) : "–"}.`),
  ];
  return { titel: "Status", knoten };
}

// ======================================================================
// Ansicht: Hinweise – alle Werte außerhalb des Optimalbereichs mit Tipps
// ======================================================================
async function ansichtHinweise() {
  const b = await befunde();
  const knoten = [];
  const n = b.liste.length, kritisch = b.liste.filter((x) => x.stufe === "kritisch").length;
  const fett = (t) => h("strong", null, t);
  const arztSatz = !kritisch ? "" : kritisch === n ? (n === 1 ? " Bitte lass ihn ärztlich abklären." : " Bitte lass sie ärztlich abklären.")
    : ` ${kritisch === 1 ? "Einen" : kritisch} davon solltest du ärztlich abklären lassen.`;
  knoten.push(h("p", { class: "hinweise-lead" }, n
    ? [fett(n === 1 ? "Ein Wert" : `${n} Werte`), ` ${n === 1 ? "liegt" : "liegen"} außerhalb des Optimalbereichs.`, arztSatz]
    : "Alle bewerteten Werte liegen im Optimalbereich."));
  knoten.push(h("p", { class: "fussnote", style: { marginTop: "0" } },
    "Eingeordnet wird nach ärztlichen Leitlinien und Studien (zum Beispiel WHO und Fachgesellschaften). Wo es dafür keine ärztliche Norm gibt, steht die Einschätzung von Withings oder Garmin – das steht unter jedem Hinweis. Die Hinweise ersetzen keine ärztliche Untersuchung; Uhr und Waage liefern Schätzwerte. Bewertet wird meist das Mittel der letzten 7 Tage."));
  for (const [id, name] of BEREICHE) {
    const l = b.liste.filter((x) => x.bereich === id);
    if (l.length) knoten.push(abschnitt(name, null, befundBox(l, { offen: true, mitLink: true })));
  }
  if (b.ok.length) {
    knoten.push(abschnitt("Im Optimalbereich", null, h("ul", { class: "ok-liste" }, b.ok.map((o) => h("li", null,
      h("span", { class: "ok-symbol" }, icon("haken", 18)), h("span", { class: "ok-name" }, o.name),
      h("span", { class: "ok-wert" }, o.wert), h("span", { class: "ok-ziel" }, `Ziel: ${o.ziel}`))))));
  }
  if (!n && !b.ok.length) knoten.push(leer("Noch nichts zu bewerten", "Sobald genug Messwerte der letzten Tage da sind, erscheinen hier die Hinweise."));
  if (b.fehlt.length) knoten.push(abschnitt("Nicht bewertet", null, h("ul", { class: "fehlt-liste" }, b.fehlt.map((t) => h("li", null, t)))));
  const quellenListe = (liste) => h("ul", { class: "quellen" }, liste.map(([text, url]) => h("li", null, url ? h("a", { href: url, target: "_blank", rel: "noopener" }, text) : text)));
  knoten.push(abschnitt("Worauf die Einordnung beruht", "Ärztliche Leitlinien und Studien", quellenListe(QUELLEN.filter((q) => q[2] !== "hersteller")),
    h("h3", { class: "quellen-zwischen" }, "Nur Angaben der Hersteller – dafür gibt es keine ärztliche Norm"), quellenListe(QUELLEN.filter((q) => q[2] === "hersteller"))));
  return { titel: "Hinweise", knoten };
}
async function hinweiseMarkieren() {
  if (!Daten.index) return;
  const liste = (await befunde()).liste;
  const n = liste.length, kritisch = liste.some((b) => b.stufe === "kritisch");
  document.querySelectorAll('[data-ziel="hinweise"]').forEach((a) => {
    const marke = a.querySelector(".nav-marke");
    if (marke) { marke.textContent = n > 99 ? "99+" : String(n); marke.hidden = !n; marke.classList.toggle("nur-hinweise", !kritisch); }
    a.setAttribute("aria-label", n ? `Hinweise, ${n} ${n === 1 ? "Wert" : "Werte"} außerhalb des Optimalbereichs` : "Hinweise");
  });
}

// ======================================================================
// Fehlerprotokoll als Textdatei (ohne Schlüssel und Zugangsdaten)
// ======================================================================
async function protokollText() {
  const idx = Daten.index || {};
  const q = idx.quellen || {};
  const zeit = (t) => DF.datumZeit.format(new Date(t));
  const zeilen = ["Gesundheit – Fehlerprotokoll", `Erstellt: ${zeit(Date.now())}`, `App-Version: ${APP_VERSION}`,
    `Datenstand: ${idx.stand ? zeit(idx.stand) : "–"}`, `Gerät: ${navigator.userAgent}`, `Sync-Knopf freigeschaltet: ${Daten.hat("d/sync.enc") ? "ja" : "nein"}`, ""];
  zeilen.push("== Datenquellen ==");
  for (const [name, st] of Object.entries(q)) {
    if (!st) continue;
    const teile = [st.verbunden ? "verbunden" : "nicht verbunden"];
    if (st.anmeldung_noetig) teile.push("neue Anmeldung nötig");
    if (st.ok === false) teile.push("letzter Abruf fehlerhaft");
    if (st.letzter_erfolg) teile.push(`zuletzt erfolgreich ${zeit(st.letzter_erfolg)}`);
    if (st.fehler) teile.push(`Fehler: ${st.fehler}`);
    if (name === "garmin" && st.verbunden) teile.push(`Historie ${st.historie_fertig ? "vollständig" : "lädt"}${st.historie_bis ? ` (bis ${st.historie_bis})` : ""}`, `${st.aktivitaeten || 0} Aktivitäten, ${st.details_offen || 0} Details offen`);
    zeilen.push(`${name}: ${teile.join("; ")}`);
  }
  zeilen.push("", "== Sync-Knopf ==", Sync.zuletzt ? `${zeit(Sync.zuletzt.zeit)}: ${Sync.zuletzt.titel} – ${Sync.zuletzt.text}` : "In dieser Sitzung noch nicht benutzt.");
  let fehler = [];
  try { fehler = JSON.parse(speicher.get(FEHLER_S) || "[]"); } catch { fehler = []; }
  zeilen.push("", "== Fehler in der App auf diesem Gerät (neueste zuerst) ==", ...(fehler.length ? fehler.slice().reverse().map(([t, text]) => `${zeit(t)}  ${text}`) : ["Keine."]));
  let protokoll = [];
  try { protokoll = ((await Daten.datei("d/protokoll.enc")) || {}).zeilen || []; } catch (e) { zeilen.push("", `Protokoll der Abrufe nicht lesbar: ${fehlerText(e)}`); }
  zeilen.push("", "== Protokoll der Abrufe (neueste zuerst) ==", ...(protokoll.length
    ? protokoll.slice(-400).reverse().map(([t, stufe, text]) => `${zeit(t * 1000)}  ${String(stufe).toUpperCase().padEnd(6)}  ${text}`) : ["Noch keine Einträge."]));
  return zeilen.join("\n") + "\n";
}
async function protokollDatei() {
  const d = new Date();
  return new File([await protokollText()], `Gesundheit-Protokoll-${isoDatum(d)}-${zweistellig(d.getHours())}${zweistellig(d.getMinutes())}.txt`, { type: "text/plain" });
}
function protokollKnoepfe() {
  const meldung = h("p", { class: "fussnote", role: "status" });
  const speichern = h("button", { type: "button", class: "knopf" }, icon("speichern", 20), "Als Datei speichern");
  speichern.addEventListener("click", async () => {
    try {
      const datei = await protokollDatei();
      const url = URL.createObjectURL(datei);
      const link = h("a", { href: url, download: datei.name, hidden: true });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      meldung.textContent = `Gespeichert als „${datei.name}“ im Ordner „Downloads“.`;
    } catch (e) { meldung.textContent = `Das Protokoll konnte nicht gespeichert werden (${fehlerText(e)}).`; }
  });
  let teilen = null;
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File(["x"], "test.txt", { type: "text/plain" })] })) {
      teilen = h("button", { type: "button", class: "knopf zweit" }, icon("teilen", 20), "Teilen");
      teilen.addEventListener("click", async () => {
        try { await navigator.share({ files: [await protokollDatei()], title: "Gesundheit – Fehlerprotokoll" }); }
        catch (e) { if (e && e.name !== "AbortError") meldung.textContent = `Teilen hat nicht geklappt (${fehlerText(e)}).`; }
      });
    }
  } catch { teilen = null; }
  return [h("div", { class: "knopf-zeile" }, speichern, teilen), meldung];
}

// ======================================================================
// Sync-Knopf: startet den Abruf bei GitHub und meldet, ob er geklappt hat
// ======================================================================
const SYNC_SPEICHER = "gesundheit.sync";
const GH_API = "https://api.github.com";
class SyncFehler extends Error { constructor(text, status = 0) { super(text); this.status = status; } }
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Bild (Data-URL) quadratisch verkleinern, damit es in den Cloud-Ablauf passt. */
async function bildVerkleinern(dataUrl, ziel = 192, guete = 0.82) {
  const img = await new Promise((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = ziel; c.height = ziel;
  const ctx = c.getContext("2d");
  const k = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, ziel, ziel);
  return c.toDataURL("image/jpeg", guete);
}
const Sync = {
  zustand: "bereit", titel: "", text: "", adresse: null, nr: 0, ausblenden: null, zuletzt: null,
  laeuft() { return ["startet", "wartet", "laeuft"].includes(this.zustand); },
  async zugang() {
    try { const z = await Daten.datei("d/sync.enc"); return z && z.token && z.repo ? z : null; } catch { return null; }
  },
  /** Profilbild und Name verschlüsselt in die Cloud legen, damit andere Geräte sie übernehmen. */
  async profil() {
    try {
      const z = await this.zugang();
      if (!z || !AES) return; // ohne Sync-Token bleibt das Profil nur auf diesem Gerät
      const bild = speicher.get("gawi.profilbild");
      const name = speicher.get("gawi.name") || "";
      const zeit = Date.now();
      speicher.set("gawi.profilbild.zeit", String(zeit));
      let klein = null;
      if (bild) klein = await bildVerkleinern(bild, 192, 0.82).catch(() => bild);
      let puffer = await verschluesselnPaket("d/profil.enc", { bild: klein, name, zeit });
      if (b64d(puffer).length > 60000) { // zu groß für GitHub: stärker verkleinern
        klein = bild ? await bildVerkleinern(bild, 128, 0.72).catch(() => klein) : null;
        puffer = await verschluesselnPaket("d/profil.enc", { bild: klein, name, zeit });
      }
      const b64 = b64d(puffer);
      if (b64.length > 64000) return; // passt nicht in den Ablauf – bleibt lokal
      await this.rufe(z, "POST", `/repos/${z.repo}/actions/workflows/profil.yml/dispatches`,
        { ref: z.zweig || "main", inputs: { bild: b64 } });
    } catch { /* Profil bleibt dann eben nur auf diesem Gerät */ }
  },
  async rufe(z, methode, pfad, body) {
    let r;
    try {
      r = await fetch(GH_API + pfad, { method: methode, cache: "no-store", body: body ? JSON.stringify(body) : undefined,
        headers: { Authorization: `Bearer ${z.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) } });
    } catch { throw new SyncFehler("Keine Verbindung zu GitHub. Bist du online?"); }
    if (r.status === 401) throw new SyncFehler("Der Sync-Token ist ungültig oder wurde gelöscht. Lege im Einrichtungsfenster am Chromebook (Schritt 5) einen neuen an.", 401);
    if (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") throw new SyncFehler("GitHub hat gerade zu viele Anfragen gezählt. Versuch es in ein paar Minuten noch einmal.", 403);
    if (r.status === 403 || r.status === 404) throw new SyncFehler(`Der Sync-Token darf den Abruf nicht starten. Lege ihn im Einrichtungsfenster (Schritt 5) neu an – mit dem Repository „${z.repo.split("/")[1]}“ und „Actions: Read and write“.`, r.status);
    if (!r.ok) throw new SyncFehler(`GitHub meldet Fehler ${r.status}.`, r.status);
    return r.status === 204 ? null : r.json().catch(() => null);
  },
  async starten() {
    if (this.laeuft()) { this.zeigen(); return; }
    const z = await this.zugang();
    if (!z) {
      const wf = workflowAdresse();
      this.setze("aus", "Sync-Knopf noch nicht freigeschaltet", "Schalte ihn einmal im Einrichtungsfenster am Chromebook frei (Schritt 5). Bis dahin holt GitHub die Daten jede Stunde von selbst.",
        wf ? { text: "Abruf auf der GitHub-Seite starten", href: wf } : null);
      return;
    }
    const nr = ++this.nr;
    this.adresse = null;
    this.setze("startet", "Abruf wird gestartet …", "Einen Moment.");
    try {
      const runs = `/repos/${z.repo}/actions/workflows/${z.workflow}/runs?per_page=10`;
      const vorher = new Set((((await this.rufe(z, "GET", runs)) || {}).workflow_runs || []).map((x) => x.id));
      const beginn = Date.now();
      const anstossen = () => this.rufe(z, "POST", `/repos/${z.repo}/actions/workflows/${z.workflow}/dispatches`, { ref: z.zweig || "main" });
      try { await anstossen(); }
      catch (e) {
        // Von GitHub pausiert (60 Tage ohne Aktivität)? Wieder einschalten und noch einmal versuchen.
        if (!(e instanceof SyncFehler) || ![403, 422].includes(e.status) || /zu viele/.test(e.message)) throw e;
        try { await this.rufe(z, "PUT", `/repos/${z.repo}/actions/workflows/${z.workflow}/enable`); await anstossen(); } catch { throw e; }
      }
      this.setze("wartet", "Abruf angefordert", "GitHub startet ihn gleich …");
      let lauf = null;
      for (let i = 0; i < 40 && !lauf; i++) {
        await warte(3000);
        if (nr !== this.nr) return;
        const liste = (((await this.rufe(z, "GET", runs)) || {}).workflow_runs) || [];
        lauf = liste.find((x) => !vorher.has(x.id) && x.event === "workflow_dispatch") || null;
      }
      if (!lauf) throw new SyncFehler("GitHub hat den Abruf angenommen, aber noch nicht gestartet. Schau gleich noch einmal oder auf der GitHub-Seite nach.");
      speicher.set(SYNC_SPEICHER, JSON.stringify({ id: lauf.id, beginn, alt: Daten.index && Daten.index.stand }));
      await this.verfolgen(z, lauf.id, beginn, nr, Daten.index && Daten.index.stand);
    } catch (e) { if (nr === this.nr) this.fehler(e); }
  },
  async verfolgen(z, id, beginn, nr, altStand) {
    for (;;) {
      if (nr !== this.nr) return;
      const l = await this.rufe(z, "GET", `/repos/${z.repo}/actions/runs/${id}`);
      this.adresse = l.html_url || null;
      if (l.status === "completed") { speicher.set(SYNC_SPEICHER, null); await this.abschluss(l, altStand, nr); return; }
      const min = Math.floor((Date.now() - beginn) / 60000);
      if (l.status === "in_progress") this.setze("laeuft", "Abruf läuft …", `Withings und Garmin werden abgefragt${min >= 1 ? ` (seit ${min} Min.)` : ""}. Das dauert meist zwei bis vier Minuten – du kannst die App weiter benutzen.`);
      else this.setze("wartet", "Abruf wartet …", "Gerade läuft schon ein Abruf. Deiner startet direkt danach.");
      if (Date.now() - beginn > 30 * 60000) { speicher.set(SYNC_SPEICHER, null); throw new SyncFehler("Der Abruf dauert ungewöhnlich lange. Schau auf der GitHub-Seite nach."); }
      await warte(5000);
    }
  },
  async abschluss(l, altStand, nr) {
    if (l.conclusion !== "success") {
      this.setze("fehler", "Abruf fehlgeschlagen", l.conclusion === "cancelled" ? "Der Abruf wurde abgebrochen." : "Bei GitHub ist etwas schiefgegangen. Der nächste stündliche Abruf versucht es wieder.",
        this.adresse ? { text: "Details bei GitHub", href: this.adresse } : null);
      return;
    }
    this.setze("laeuft", "Abruf fertig", "Die neuen Daten werden geladen …");
    for (let i = 0; i < 10; i++) {   // GitHub Pages braucht nach dem Abruf einen Moment
      try { await Daten.ladeIndex(); } catch { /* gleich noch einmal */ }
      if (Daten.index && Daten.index.stand !== altStand) break;
      await warte(6000);
      if (nr !== this.nr) return;
    }
    Daten.cache.clear(); standZeigen(); neuZeichnen();
    const q = (Daten.index && Daten.index.quellen) || {};
    const probleme = [["Withings", q.withings], ["Garmin", q.garmin]].filter(([, st]) => st && st.verbunden && (st.anmeldung_noetig || st.ok === false || st.fehler));
    const stand = Daten.index && Daten.index.stand ? `${uhr(Date.parse(Daten.index.stand))} Uhr` : "";
    if (!probleme.length) this.setze("ok", "Abruf erfolgreich", `Withings und Garmin sind auf dem Stand von ${stand}.`);
    else this.setze("teilweise", "Abruf mit Problemen", probleme.map(([n, st]) => `${n}: ${st.anmeldung_noetig ? "bitte neu anmelden (Einrichtungsfenster)" : st.fehler || "Fehler beim Abruf"}.`).join(" "),
      { text: "Status ansehen", href: "#status" });
  },
  fehler(e) {
    console.error(e);
    this.setze("fehler", "Abruf fehlgeschlagen", e instanceof SyncFehler ? e.message : `Unerwarteter Fehler (${e && e.message ? e.message : e}).`,
      this.adresse ? { text: "Details bei GitHub", href: this.adresse } : null);
  },
  async fortsetzen() {
    let g = null;
    try { g = JSON.parse(speicher.get(SYNC_SPEICHER) || "null"); } catch { g = null; }
    if (!g || !g.id || Date.now() - g.beginn > 30 * 60000) { speicher.set(SYNC_SPEICHER, null); return; }
    const z = await this.zugang();
    if (!z) return;
    const nr = ++this.nr;
    this.setze("laeuft", "Abruf läuft …", "Der zuletzt gestartete Abruf wird weiter verfolgt.");
    try { await this.verfolgen(z, g.id, g.beginn, nr, g.alt); } catch (e) { if (nr === this.nr) this.fehler(e); }
  },
  setze(zustand, titel, text, aktion = null) {
    Object.assign(this, { zustand, titel, text, aktion });
    if (["ok", "teilweise", "fehler"].includes(zustand)) this.zuletzt = { zustand, titel, text, zeit: Date.now() };
    this.zeigen();
  },
  zeigen() {
    if (!SYNC_KNOPF) return;
    const z = this.zustand;
    SYNC_KNOPF.className = `sync-knopf ${z}`;
    SYNC_KNOPF.setAttribute("aria-label", this.laeuft() ? "Abruf läuft" : "Jetzt abrufen");
    SYNC_KNOPF.disabled = false;
    clearTimeout(this.ausblenden);
    if (z === "bereit") { SYNC_MELDUNG.hidden = true; return; }
    const symbol = this.laeuft() ? h("span", { class: "sync-drehen", "aria-hidden": "true" }, icon("sync", 22)) : icon(z === "ok" ? "haken" : z === "aus" ? "info" : "warnung", 22);
    SYNC_MELDUNG.className = `sync-meldung ${z}`;
    SYNC_MELDUNG.replaceChildren(...[symbol,
      h("div", { class: "sync-text" }, h("b", null, this.titel), this.text ? h("span", null, this.text) : null,
        this.aktion ? h("a", { href: this.aktion.href, ...(this.aktion.href.startsWith("#") ? {} : { target: "_blank", rel: "noopener" }) }, this.aktion.text) : null),
      this.laeuft() ? null : h("button", { type: "button", class: "dialog-zu", "aria-label": "Meldung schließen", onclick: () => { this.zustand = "bereit"; this.zeigen(); } }, icon("zu", 18))].filter(Boolean));
    SYNC_MELDUNG.hidden = false;
    if (z === "ok") this.ausblenden = setTimeout(() => { if (this.zustand === "ok") { this.zustand = "bereit"; this.zeigen(); } }, 15000);
  },
};

// ======================================================================
// Neue Version gleich beim Öffnen laden (nicht erst beim zweiten Mal)
// ======================================================================
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Höchstens einmal je Sitzung und Version von selbst neu laden (sonst droht eine Schleife)
const sitzung = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ohne Speicher */ } },
};
const Aktualisierung = {
  beginn: Date.now(), hatteSteuerung: false, neu: null, angefragt: null, laedt: false, element: null, reg: null, versuche: 0, wartet: null, aktiviert: false,
  async start() {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    this.hatteSteuerung = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => this.uebernommen());
    try {
      this.reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`));
    } catch { return; }
    this.reg.addEventListener("updatefound", () => this.beobachten(this.reg.installing));
    this.beobachten(this.reg.installing);
    await this.pruefen(); // findet auch eine schon geladene, noch wartende neue Version
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.pruefen(); });
    setInterval(() => { if (!document.hidden) this.pruefen(); }, 30 * 60 * 1000);
  },
  beobachten(w) {
    if (!w) return;
    w.addEventListener("statechange", () => {
      if (w.state === "installed") this.bereit();
      // Laden abgebrochen (zum Beispiel Netz weg): gleich noch einmal versuchen
      if (w.state === "redundant") { this.angefragt = null; this.spaeter(); }
    });
  },
  spaeter() {
    // Nach dem Öffnen ein paar weitere Versuche, falls das Netz gerade hakt
    if (this.versuche >= 3) return;
    this.versuche += 1;
    setTimeout(() => this.pruefen(), 4000 * this.versuche);
  },
  /** Neue Version ist vollständig geladen. Der Browser lässt sie nur übernehmen, wenn die laufende
      Version gerade nichts zu tun hat – und prüft das nicht von selbst nach. Deshalb hier warten, bis
      sie ruhig ist, und erst dann übernehmen lassen. Klappt das nicht, hilft Neuladen. */
  async bereit() {
    if (this.aktiviert) return;
    this.aktiviert = true;
    const ende = Date.now() + 10000;
    while (Date.now() < ende && this.reg && this.reg.waiting && !(await this.ruhig())) await pause(300);
    await pause(150);
    if (!this.reg || !this.reg.waiting || this.laedt) return;
    this.reg.waiting.postMessage("aktivieren");
    clearTimeout(this.wartet);
    this.wartet = setTimeout(async () => {
      if (this.laedt || !this.reg || !this.reg.waiting) return; // inzwischen übernommen
      const bis = Date.now() + 5000;
      while (Date.now() < bis && !(await this.ruhig())) await pause(300);
      this.neuLaden(true);
    }, 3000);
  },
  /** Hat die laufende Version noch Abrufe offen? (Ältere Fassungen antworten nicht: dann ja, ruhig.) */
  ruhig() {
    const c = navigator.serviceWorker.controller;
    if (!c) return Promise.resolve(true);
    return new Promise((ok) => {
      const kanal = new MessageChannel();
      const zeit = setTimeout(() => ok(true), 1000);
      kanal.port1.onmessage = (e) => { clearTimeout(zeit); ok(!(e.data && e.data.offen > 0)); };
      try { c.postMessage("ruhig", [kanal.port2]); } catch { clearTimeout(zeit); ok(true); }
    });
  },
  neuLaden(vonSelbst) {
    if (vonSelbst) {
      // Nur gleich nach dem Öffnen oder im Hintergrund, und je Version nur einmal; sonst fragen
      const eben = Date.now() - this.beginn < 20000 || document.hidden;
      if (!eben || sitzung.get("gesundheit.neu-geladen") === (this.neu || "?")) { this.zeigen(); return; }
      sitzung.set("gesundheit.neu-geladen", this.neu || "?");
    }
    this.laedt = true;
    location.reload();
  },
  async version() {
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
      return r.ok ? String((await r.json()).version || "") || null : null;
    } catch { return null; }
  },
  async pruefen() {
    const v = await this.version();
    if (v && v !== APP_VERSION) this.neu = v;
    // Eine schon fertig geladene Version übernehmen lassen, auch wenn diese Seite sie selbst schon zeigt
    if (this.reg && this.reg.waiting) { this.bereit(); return; }
    if (!v) { this.spaeter(); return; }
    if (v === APP_VERSION) return;
    if (!this.reg) return;
    if (this.reg.installing) return; // wird gerade geladen
    if (this.angefragt === v) return;
    this.angefragt = v;
    // Der Service Worker unter neuer Adresse umgeht alle Zwischenspeicher und holt die neue Version sofort
    try { await navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(v)}`); } catch { this.angefragt = null; this.spaeter(); }
  },
  async uebernommen() {
    const vorher = this.hatteSteuerung;
    this.hatteSteuerung = true;
    clearTimeout(this.wartet);
    if (!vorher || this.laedt) return;
    if (!this.neu) { const v = await this.version(); if (v && v !== APP_VERSION) this.neu = v; }
    if (!this.neu) return;
    // Gerade erst geöffnet oder im Hintergrund: gleich neu laden; sonst fragen, damit nichts verloren geht
    if (Date.now() - this.beginn < 20000 || document.hidden) { this.laedt = true; location.reload(); return; }
    this.zeigen();
  },
  zeigen() {
    if (this.element) return;
    this.element = h("div", { class: "update-meldung", role: "status", "aria-live": "polite" },
      icon("sync", 20), h("span", null, this.neu ? `Version ${this.neu} ist da.` : "Eine neue Version ist da."),
      h("button", { type: "button", class: "knopf", onclick: () => this.neuLaden(false) }, "Neu laden"));
    document.body.append(this.element);
  },
};

// ======================================================================
// Gerüst, Navigation, Router
// ======================================================================
// ======================================================================
// Ernährung (Rechner) und Tagesringe
// ======================================================================
/* =========================================================
   Ernährung: Kalorien- und Makro-Rechner und Tagesringe (ab Version 1.3.1)
   Wird vor app.js geladen; nutzt die Bausteine von app.js erst beim Aufruf.
   ========================================================= */

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

const NAV = [["essen", "Essen"], ["heute", "Heute"], ["koerper", "Körper"], ["herz", "Herz"], ["schlaf", "Schlaf"], ["sport", "Sport"], ["hinweise", "Hinweise"]];
const MEHR = [["bericht", "Arztbericht (PDF)", "Alle wichtigen Werte für die Ärztin oder den Arzt"], ["tag", "Tag im Detail", "Puls, Stress, Body Battery und Schlaf eines Tages"], ["werte", "Alle Werte", "Jede Messgröße einzeln, mit Rohdaten"], ["status", "Status", "Abrufe, Verbindung und Darstellung"]];
const ANSICHTEN = { essen: ansichtEssen, heute: ansichtHeute, koerper: ansichtKoerper, herz: ansichtHerz, schlaf: ansichtSchlaf, sport: ansichtSport, hinweise: ansichtHinweise,
  tag: ansichtTag, werte: ansichtWerte, status: ansichtStatus, aktivitaet: ansichtAktivitaet, ekg: ansichtEkg, bericht: ansichtBericht };
let MAIN, KOPF_TITEL, KOPF_ZURUECK, KOPF, STAND, DIALOG, SYNC_KNOPF, SYNC_MELDUNG;
let LAUF = 0;

function geruestBauen() {
  const wurzel = document.getElementById("wurzel");
  KOPF_TITEL = h("h1", { class: "kopf-titel" }, "Heute");
  KOPF_ZURUECK = h("a", { class: "kopf-zurueck", href: "#heute", "aria-label": "Zurück", hidden: true }, icon("zurueck"));
  STAND = h("a", { class: "stand", href: "#status" });
  const menueKnopf = h("button", { class: "menue-knopf", type: "button", "aria-label": "Mehr" }, icon("mehr"));
  SYNC_KNOPF = h("button", { class: "sync-knopf", type: "button", "aria-label": "Jetzt abrufen", title: "Jetzt abrufen", onclick: () => Sync.starten() }, icon("sync"), h("span", { class: "sync-punkt", "aria-hidden": "true" }));
  KOPF = h("header", { class: "kopf" }, KOPF_ZURUECK, KOPF_TITEL, STAND, SYNC_KNOPF, menueKnopf);
  SYNC_MELDUNG = h("div", { class: "sync-meldung", role: "status", "aria-live": "polite", hidden: true });
  MAIN = h("main", { class: "seite", id: "inhalt" });
  const navLink = ([id, name]) => h("a", { href: `#${id}`, "data-ziel": id }, icon(id), h("span", null, name),
    id === "hinweise" ? h("span", { class: "nav-marke", hidden: true, "aria-hidden": "true" }) : null);
  const leiste = h("nav", { class: "leiste", "aria-label": "Bereiche" }, NAV.map(navLink));
  const seite = h("nav", { class: "seitenleiste", "aria-label": "Bereiche" },
    h("div", { class: "marke" }, icon("marke", 30), "Gesundheit"),
    NAV.map(navLink),
    h("div", { class: "trenner" }),
    MEHR.map(([id, name]) => h("a", { href: `#${id}`, "data-ziel": id }, icon(id), name)));
  DIALOG = h("dialog", { class: "blatt-dialog", "aria-label": "Weitere Bereiche" }, h("div", { class: "dialog-inhalt" },
    h("div", { class: "dialog-kopf" }, h("h2", null, "Mehr"), h("button", { class: "dialog-zu", type: "button", "aria-label": "Schließen", onclick: () => DIALOG.close() }, icon("zu", 20))),
    h("div", { class: "menue-liste" }, MEHR.map(([id, name, text]) => h("a", { href: `#${id}`, onclick: () => DIALOG.close() }, icon(id), h("span", null, name, h("small", null, text)))))));
  DIALOG.addEventListener("click", (e) => { if (e.target === DIALOG) DIALOG.close(); });
  menueKnopf.addEventListener("click", () => DIALOG.showModal());
  wurzel.replaceChildren(h("div", { class: "app" }, seite, h("div", null, KOPF, SYNC_MELDUNG, MAIN), leiste), DIALOG);
  window.addEventListener("scroll", () => KOPF.classList.toggle("mit-linie", window.scrollY > 4), { passive: true });
  standZeigen();
}
function standZeigen() {
  if (!STAND || !Daten.index) return;
  const q = Daten.index.quellen || {};
  const liste = Object.values(q).filter((x) => x && x.verbunden);
  let art = "";
  if (liste.some((x) => x.anmeldung_noetig || x.ok === false)) art = "fehler";
  else if (liste.some((x) => x.fehler) || stundenSeitAbruf() > 3) art = "warnung";
  STAND.replaceChildren(h("span", { class: `stand-punkt ${art}`, "aria-hidden": "true" }),
    h("span", { class: "stand-lang" }, vorZeit(Daten.index.stand)), h("span", { class: "stand-kurz", "aria-hidden": "true" }, vorZeit(Daten.index.stand, true)),
    h("span", { class: "stand-version" }, `v${APP_VERSION}`));
  STAND.setAttribute("aria-label", `Datenstand ${vorZeit(Daten.index.stand)}, App-Version ${APP_VERSION}${art ? ", bitte Status prüfen" : ""}`);
}
function navMarkieren(ziel) {
  const haupt = { aktivitaet: "sport", ekg: "herz" }[ziel] || ziel;
  document.querySelectorAll("[data-ziel]").forEach((a) => { if (a.dataset.ziel === haupt) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
let letzteAnsicht = "";
async function route() {
  const lauf = ++LAUF;
  const [name, ...teile] = (location.hash.slice(1) || "heute").split("/");
  const ansicht = ANSICHTEN[name] ? name : "heute";
  const wechsel = location.hash !== letzteAnsicht;
  letzteAnsicht = location.hash;
  navMarkieren(ansicht);
  const scroll = wechsel ? 0 : window.scrollY;
  NACH.length = 0;
  let ergebnis;
  try { ergebnis = await ANSICHTEN[ansicht](...teile); }
  catch (e) {
    console.error(e);
    ergebnis = { titel: "Fehler", knoten: [hinweis([`Diese Ansicht konnte nicht geladen werden (${e && e.message ? e.message : e}).`, "Lade die Seite neu. Hilft das nicht, prüfe den Status."], "fehler", "warnung")] };
  }
  if (lauf !== LAUF) return;
  diagrammeAufraeumen();
  if (KARTE) { try { KARTE.remove(); } catch { /* weg */ } KARTE = null; }
  document.documentElement.classList.remove("karte-offen");
  KOPF_TITEL.textContent = ergebnis.titel;
  document.title = ergebnis.titel === "Heute" ? "Gesundheit" : `${ergebnis.titel} – Gesundheit`;
  KOPF_ZURUECK.hidden = !ergebnis.zurueck;
  if (ergebnis.zurueck) KOPF_ZURUECK.href = ergebnis.zurueck;
  KOPF.classList.toggle("startseite", ansicht === "heute"); // Versionsnummer am Handy nur auf der Startseite
  MAIN.replaceChildren(...ergebnis.knoten.flat().filter((k) => k != null && k !== false));
  const auftraege = NACH.splice(0);
  requestAnimationFrame(() => {
    for (const f of auftraege) { try { f(); } catch (e) { console.error(e); } }
    window.scrollTo(0, scroll);
  });
  hinweiseMarkieren().catch((e) => console.error(e));
}
function neuZeichnen() { letzteAnsicht = location.hash; route(); }

// ======================================================================
// Schlüssel-Tor
// ======================================================================
function tor(fehlertext) {
  const wurzel = document.getElementById("wurzel");
  const feld = h("textarea", { placeholder: "Schlüssel oder Link aus dem Einrichtungsfenster einfügen", "aria-label": "Schlüssel", autocomplete: "off", spellcheck: "false" });
  const meldung = h("p", { class: "fehlertext", hidden: !fehlertext }, fehlertext || "");
  const kamera = h("div", { class: "kamera", hidden: true });
  const uebernehmen = async (text) => {
    const m = String(text).match(/k=([A-Za-z0-9_-]{43})/) || String(text).trim().match(/^([A-Za-z0-9_-]{43})$/);
    if (!m) { meldung.textContent = "Das ist kein gültiger Schlüssel. Er ist 43 Zeichen lang."; meldung.hidden = false; return; }
    speicher.set(S.schluessel, m[1]);
    location.hash = "#heute";
    location.reload();
  };
  const scannen = async () => {
    meldung.hidden = true;
    let strom;
    try { strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
    catch { meldung.textContent = "Die Kamera ist nicht freigegeben. Erlaube den Zugriff oder füge den Schlüssel unten ein."; meldung.hidden = false; return; }
    const video = h("video", { playsinline: true, muted: true, autoplay: true });
    video.srcObject = strom;
    kamera.replaceChildren(video); kamera.hidden = false;
    await video.play().catch(() => {});
    let erkenner = null;
    if ("BarcodeDetector" in window) { try { erkenner = new BarcodeDetector({ formats: ["qr_code"] }); } catch { erkenner = null; } }
    if (!erkenner) {
      await new Promise((ok, f) => { const sk = h("script", { src: "vendor/jsQR.js" }); sk.onload = ok; sk.onerror = f; document.head.append(sk); }).catch(() => {});
    }
    const leinwand = document.createElement("canvas");
    const ctx = leinwand.getContext("2d", { willReadFrequently: true });
    const stopp = () => strom.getTracks().forEach((t) => t.stop());
    const schritt = async () => {
      if (kamera.hidden) { stopp(); return; }
      try {
        if (erkenner) {
          const codes = await erkenner.detect(video);
          if (codes.length) { stopp(); return uebernehmen(codes[0].rawValue); }
        } else if (window.jsQR && video.videoWidth) {
          leinwand.width = video.videoWidth; leinwand.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const bild = ctx.getImageData(0, 0, leinwand.width, leinwand.height);
          const code = window.jsQR(bild.data, bild.width, bild.height);
          if (code && code.data) { stopp(); return uebernehmen(code.data); }
        }
      } catch { /* weiter versuchen */ }
      setTimeout(schritt, 250);
    };
    schritt();
  };
  wurzel.replaceChildren(h("div", { class: "tor" }, h("div", { class: "tor-inhalt" },
    (() => { const m = icon("marke", 64); m.classList.add("tor-marke"); return m; })(),
    h("h1", null, "Gesundheit"),
    h("p", null, "Deine Withings- und Garmin-Daten sind verschlüsselt. Damit dieses Gerät sie lesen kann, braucht es einmal deinen Schlüssel."),
    h("p", null, "Den QR-Code zeigt dir das Einrichtungsfenster auf dem Chromebook im letzten Schritt."),
    h("div", { class: "knopf-zeile" }, h("button", { class: "knopf", type: "button", onclick: scannen }, icon("kamera", 20), "QR-Code scannen")),
    kamera, meldung, feld,
    h("div", { class: "knopf-zeile" }, h("button", { class: "knopf zweit", type: "button", onclick: () => uebernehmen(feld.value) }, "Schlüssel übernehmen")),
    h("p", { class: "tor-version" }, `App-Version ${APP_VERSION}`))));
}

// ======================================================================
// Start
// ======================================================================
async function start() {
  Aktualisierung.start();
  const m = location.hash.match(/k=([A-Za-z0-9_-]{43})/);
  if (m) { speicher.set(S.schluessel, m[1]); history.replaceState(null, "", location.pathname + location.search + "#heute"); }
  const k = speicher.get(S.schluessel);
  if (!("DecompressionStream" in window) || !window.crypto || !crypto.subtle) {
    document.getElementById("wurzel").replaceChildren(h("div", { class: "tor" }, h("div", { class: "tor-inhalt" }, h("h1", null, "Browser zu alt"),
      h("p", null, "Bitte aktualisiere den Browser (Chrome, Safari 16.4 oder neuer, Firefox), dann klappt es."))));
    return;
  }
  if (!k) return tor();
  try { await schluesselAktivieren(k); } catch { return tor("Der gespeicherte Schlüssel ist ungültig."); }
  try { await Daten.ladeIndex(); }
  catch (e) {
    if (e instanceof SchluesselFalsch) return tor("Dieser Schlüssel passt nicht zu den Daten. Scanne den QR-Code noch einmal.");
    document.getElementById("wurzel").replaceChildren(h("div", { class: "tor" }, h("div", { class: "tor-inhalt" }, h("h1", null, "Keine Verbindung"),
      h("p", null, "Die Daten konnten nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu."))));
    return;
  }
  if (!Daten.index) {
    document.getElementById("wurzel").replaceChildren(h("div", { class: "tor" }, h("div", { class: "tor-inhalt" }, h("h1", null, "Gleich geht's los"),
      h("p", null, "Der erste Abruf läuft noch. Das dauert beim ersten Mal bis zu 15 Minuten. Lade die Seite danach neu."))));
    return;
  }
  geruestBauen();
  window.addEventListener("hashchange", route);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!speicher.get(S.darstellung)) neuZeichnen(); });
  await route();
  Sync.fortsetzen();
  Daten.profilAbholen().catch(() => {});
  // regelmäßig nach neuen Daten sehen
  setInterval(async () => {
    if (document.hidden) return;
    const alt = Daten.index && Daten.index.stand;
    try { await Daten.ladeIndex(); } catch { return; }
    if (Daten.index && Daten.index.stand !== alt) { Daten.cache.clear(); standZeigen(); neuZeichnen(); } else standZeigen();
    Daten.profilAbholen().catch(() => {});
  }, 10 * 60 * 1000);
}
document.addEventListener("DOMContentLoaded", start);
// Für das iOS-Design (ios-heute.js): Profilbild/Name ändern und in die Cloud übertragen
window.GaWiSync = { profil: () => Sync.profil() };
})();
