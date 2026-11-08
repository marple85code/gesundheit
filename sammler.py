#!/usr/bin/env python3
"""Gesundheits-App - Datensammler.

Holt alle Daten von Withings und Garmin Connect, legt sie verschluesselt ab und
baut daraus die Webseite fuer GitHub Pages. Laeuft stuendlich als GitHub-Ablauf;
die Anmeldungen kommen aus dem Einrichtungsfenster (einrichtung.py).

    python sammler.py --ablage ablage --web web --seite _site --paket zustand.enc

Der Hauptschluessel steht in der Umgebungsvariable GESUNDHEIT_SCHLUESSEL.
Die Konsole zeigt nur Zaehler und allgemeine Meldungen, niemals Messwerte:
Die Protokolle eines oeffentlichen GitHub-Repositorys kann jeder lesen.
Details stehen verschluesselt im Protokoll der App (Bereich "Status").
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import logging
import math
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

import requests

APP = "GesundheitsApp"
VERSION = "1.2.2"
STANDARD_ZEITZONE = "Europe/Berlin"
UTC = timezone.utc

# --------------------------------------------------------------------------
# Withings
# --------------------------------------------------------------------------
WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2"
WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2"
WITHINGS_API = "https://wbsapi.withings.net/"
WITHINGS_SCOPE = "user.info,user.metrics,user.activity"

# Alle bekannten Messtypen (zusaetzlich zur Standardabfrage, damit auch neuere
# Typen wie Segmentwerte, Gefaessalter und Nervengesundheit sicher dabei sind)
WITHINGS_TYPEN_ERWEITERT = (
    "1,4,5,6,8,9,10,11,12,54,71,73,76,77,88,91,123,130,135,136,137,138,139,140,155,"
    "158,159,167,168,169,170,173,174,175,196,197,198,226,227,229"
)
AKTIVITAET_FELDER = (
    "steps,distance,elevation,soft,moderate,intense,active,calories,totalcalories,"
    "hr_average,hr_min,hr_max,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3"
)
SCHLAF_FELDER = (
    "nb_rem_episodes,sleep_efficiency,sleep_latency,total_sleep_time,total_timeinbed,"
    "wakeup_latency,waso,apnea_hypopnea_index,breathing_disturbances_intensity,"
    "asleepduration,deepsleepduration,hr_average,hr_min,hr_max,lightsleepduration,"
    "mvt_active_duration,mvt_score_avg,night_events,out_of_bed_count,remsleepduration,"
    "rr_average,rr_min,rr_max,sleep_score,snoring,snoringepisodecount,wakeupcount,"
    "wakeupduration,withings_index"
)
TRAINING_FELDER = (
    "calories,intensity,manual_distance,manual_calories,hr_average,hr_min,hr_max,"
    "hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3,pause_duration,algo_pause_duration,"
    "spo2_average,steps,distance,elevation,pool_laps,strokes,pool_length"
)


# --------------------------------------------------------------------------
# Garmin: Bereiche mit Tageswerten
# --------------------------------------------------------------------------
@dataclass
class Bereich:
    methode: str
    tage: int  # Fenstergroesse beim Nachladen der Historie
    intervall: int  # Sekunden zwischen zwei Aktualisierungen der letzten Tage
    args: Callable[[str, str], tuple] = lambda a, b: (a, b)
    kwargs: dict = field(default_factory=dict)
    ersatz_fuer: str | None = None  # nur aktiv, wenn dieser Bereich nicht verfuegbar ist


STUNDE = 3600
BEREICHE: dict[str, Bereich] = {
    "tag": Bereich("get_daily_summaries", 28, STUNDE),
    "schlaf": Bereich("get_sleep_daily", 28, STUNDE),
    "hrv": Bereich("get_hrv_data_range", 28, STUNDE),
    "bereitschaft": Bereich("get_training_readiness_range", 28, STUNDE),
    "vo2max": Bereich("get_max_metrics_range", 28, 6 * STUNDE),
    "fitnessalter": Bereich("get_fitness_age_daily", 28, 6 * STUNDE),
    "atmung": Bereich("get_daily_respiration_stats", 28, 3 * STUNDE),
    "trinken": Bereich("get_daily_hydration_stats", 28, 6 * STUNDE),
    "snapshot": Bereich("get_health_snapshots_range", 28, 3 * STUNDE),
    "ausdauer": Bereich("get_endurance_score", 28, 6 * STUNDE, kwargs={"aggregation": "daily"}),
    "huegel": Bereich("get_hill_score", 28, 6 * STUNDE),
    "akklimatisierung": Bereich("get_heat_altitude_acclimation_range", 28, 6 * STUNDE),
    "gewicht": Bereich("get_body_composition", 90, 3 * STUNDE),
    "blutdruck": Bereich("get_blood_pressure", 90, 3 * STUNDE),
    "zyklus": Bereich("get_menstrual_calendar_data", 90, 6 * STUNDE),
    "wettkampf": Bereich("get_race_predictions", 365, 6 * STUNDE, args=lambda a, b: (a, b, "daily")),
    "trainingsstatus": Bereich("get_weekly_training_status", 182, 6 * STUNDE),
    "laufbelastung": Bereich("get_running_tolerance", 182, 6 * STUNDE, kwargs={"aggregation": "weekly"}),
    # Ersatz, falls Garmin die Tageszusammenfassung fuer dieses Konto nicht liefert
    "schritte": Bereich("get_daily_steps", 28, STUNDE, ersatz_fuer="tag"),
    "herz": Bereich("get_daily_heart_rate_stats", 28, STUNDE, ersatz_fuer="tag"),
    "stress": Bereich("get_daily_stress_stats", 28, STUNDE, ersatz_fuer="tag"),
    "bodybattery": Bereich("get_daily_body_battery_stats", 28, STUNDE, ersatz_fuer="tag"),
    "intensitaet": Bereich("get_daily_intensity_minutes_stats", 28, STUNDE, ersatz_fuer="tag"),
    "etagen": Bereich("get_daily_floors_stats", 28, 3 * STUNDE, ersatz_fuer="tag"),
    "kalorien": Bereich("get_calories_daily", 365, 3 * STUNDE, ersatz_fuer="tag"),
}
# Felder, an denen ein Tag mit echten Uhrdaten erkannt wird
TAG_KERN = ("totalSteps", "restingHeartRate", "averageStressLevel", "sleepingSeconds",
            "floorsAscended", "bodyBatteryHighestValue", "moderateIntensityMinutes")

# Einzelabfragen (aktueller Stand), alle 6 Stunden
INFO = [
    ("profil", "get_user_profile", ()),
    ("person", "get_personal_information", ()),
    ("basis", "get_user_profile_base", ()),
    ("geraete", "get_devices", ()),
    ("letztes_geraet", "get_device_last_used", ()),
    ("rekorde", "get_personal_record", ()),
    ("prognose", "get_race_predictions", ()),
    ("trainingsstatus", "get_training_status", ("heute",)),
    ("vo2max", "get_max_metrics_latest", ()),
    ("fitnessalter", "get_fitness_age_details", ()),
    ("laktat", "get_lactate_threshold", ()),
    ("hf_zonen", "get_heart_rate_zones", ()),
    ("gesamt", "get_lifetime_totals", ()),
    ("ziele", "get_goals", ()),
    ("abzeichen", "get_earned_badges", ()),
    ("ausdauer", "get_endurance_score", ("heute",)),
    ("huegel", "get_hill_score", ("heute",)),
]

# Tagesverlaeufe (Puls, Stress, Body Battery, Schritte, Schlafphasen ...)
TAGESDETAILS = [
    ("hf", "get_heart_rates"),
    ("stress", "get_stress_data"),
    ("schritte", "get_steps_data"),
    ("schlaf", "get_sleep_data"),
    ("atmung", "get_respiration_data"),
    ("spo2", "get_spo2_data"),
    ("hrv", "get_hrv_data"),
    ("bb_ereignisse", "get_body_battery_events"),
]
TAGE_NACHLADEN = 90  # so viele Tage rueckwirkend mit Tagesverlauf

# Aufrufbudget pro Lauf (Garmin mag keine Massenabfragen)
GARMIN_BUDGET = 350
GARMIN_PAUSE = 1.0
RESERVE_DETAILS = 100
RESERVE_TAGE = 40

RE_DATUM = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RE_ENUM = re.compile(r"^[A-Z][A-Z0-9_]{1,48}$")

log = logging.getLogger(APP)


# --------------------------------------------------------------------------
# Fehlerarten
# --------------------------------------------------------------------------
class AnmeldungNoetig(Exception):
    """Zugang abgelaufen oder widerrufen: neu anmelden im Einrichtungsfenster."""


class Gebremst(Exception):
    """Der Dienst meldet zu viele Anfragen."""


class NichtVerfuegbar(Exception):
    """Diese Abfrage gibt es fuer dieses Konto nicht (404/400/403)."""

    def __init__(self, status: int | None = None):
        super().__init__(f"nicht verfügbar ({status})" if status else "nicht verfügbar")
        self.status = status


class BudgetErschoepft(Exception):
    """Aufruf- oder Zeitbudget dieses Laufs ist aufgebraucht."""


class WithingsFehler(Exception):
    pass


class GarminFehler(Exception):
    pass


# --------------------------------------------------------------------------
# Protokoll: oeffentlich (Konsole) und privat (verschluesselt in der App)
# --------------------------------------------------------------------------
class Bericht:
    def __init__(self, konsole: bool = True):
        self.konsole = konsole
        self.zeilen: list[list] = []

    def _neu(self, text: str, stufe: str) -> None:
        self.zeilen.append([int(time.time()), stufe, str(text)[:600]])

    def oeffentlich(self, text: str) -> None:
        """Nur allgemeine Meldungen ohne persoenliche Daten."""
        self._neu(text, "info")
        if self.konsole:
            print(text, flush=True)

    def privat(self, text: str, stufe: str = "info") -> None:
        self._neu(text, stufe)

    def fehler(self, text: str, e: BaseException | None = None) -> None:
        if e is not None:
            text = f"{text}: {type(e).__name__}: {kurz(e)}"
        self._neu(text, "fehler")


def kurz(e: BaseException, laenge: int = 300) -> str:
    text = " ".join(str(e).split())
    text = re.sub(r"(access_token|refresh_token|client_secret|password)=[^&\s]+", r"\1=***", text)
    return text[:laenge]


# --------------------------------------------------------------------------
# Verschluesselung: AES-256-GCM, Schluessel per HKDF aus dem Hauptschluessel
# --------------------------------------------------------------------------
MAGIC = b"GSD1"


def b64u(daten: bytes) -> str:
    return base64.urlsafe_b64encode(daten).rstrip(b"=").decode("ascii")


def b64u_dekodieren(text: str) -> bytes:
    text = (text or "").strip()
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def neuer_hauptschluessel() -> str:
    return b64u(os.urandom(32))


def ableiten(haupt: str, zweck: str) -> bytes:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF

    roh = b64u_dekodieren(haupt)
    if len(roh) != 32:
        raise ValueError("Der Schlüssel hat nicht die richtige Länge.")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"GesundheitsApp/1",
                info=zweck.encode()).derive(roh)


def daten_schluessel(haupt: str) -> str:
    """Schluessel fuer die Anzeige-Daten (kommt per QR-Code aufs Handy)."""
    return b64u(ableiten(haupt, "daten"))


def _json_bytes(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False,
                      sort_keys=False).encode("utf-8")


def verschluesseln(schluessel: bytes, pfad: str, obj) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    klar = gzip.compress(_json_bytes(obj), compresslevel=9, mtime=0)
    nonce = os.urandom(12)
    return MAGIC + nonce + AESGCM(schluessel).encrypt(nonce, klar, pfad.encode("utf-8"))


def entschluesseln(schluessel: bytes, pfad: str, daten: bytes):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if daten[:4] != MAGIC:
        raise ValueError(f"{pfad}: unbekanntes Dateiformat")
    klar = AESGCM(schluessel).decrypt(daten[4:16], daten[16:], pfad.encode("utf-8"))
    return json.loads(gzip.decompress(klar).decode("utf-8"))


def paket_verschluesseln(haupt: str, paket: dict) -> bytes:
    return verschluesseln(ableiten(haupt, "zustand"), "zustand.enc", paket)


def paket_entschluesseln(haupt: str, daten: bytes) -> dict:
    return entschluesseln(ableiten(haupt, "zustand"), "zustand.enc", daten)


# --------------------------------------------------------------------------
# Allgemeine Hilfen
# --------------------------------------------------------------------------
def zahl_ok(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def runden(v):
    if isinstance(v, bool) or not zahl_ok(v):
        return None
    if isinstance(v, int):
        return v
    if v == int(v) and abs(v) < 1e15:
        return int(v)
    return float(f"{v:.6g}")


def ms(wert) -> int | None:
    """Zeitpunkt (Millisekunden, Sekunden oder ISO-Text in UTC) -> Millisekunden."""
    if zahl_ok(wert):
        w = float(wert)
        if w > 1e11:
            return int(w)
        if w > 1e8:
            return int(w * 1000)
        return None
    if isinstance(wert, str) and len(wert) >= 16:
        text = wert.strip().replace(" ", "T")
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            try:
                dt = datetime.fromisoformat(text.split(".")[0])
            except ValueError:
                return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return int(dt.timestamp() * 1000)
    return None


def iso_jetzt(zz: ZoneInfo) -> str:
    return datetime.now(zz).replace(microsecond=0).isoformat()


def zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or STANDARD_ZEITZONE)
    except Exception:
        return ZoneInfo(STANDARD_ZEITZONE)


class Drossel:
    def __init__(self, sekunden: float):
        self.sekunden = sekunden
        self.letzte = 0.0

    def warten(self) -> None:
        rest = self.letzte + self.sekunden - time.monotonic()
        if rest > 0:
            time.sleep(rest)
        self.letzte = time.monotonic()


_AUSLASSEN = {
    "id", "version", "uuid", "rule", "brand", "created", "modified", "lastupdate", "model",
    "modelid", "model_id", "category", "attrib", "startdate", "enddate", "timezone", "date",
    "sequence", "source", "deviceid", "hash_deviceid", "is_tracker", "userprofilepk",
    "userprofileid", "userid", "durationinmilliseconds", "offset", "timezoneoffset",
}


_ZEITPUNKTE = {"starttime", "endtime", "createtime", "updatetime", "lastsynctime", "synctime"}


def _ist_metrik(name: str) -> bool:
    low = name.lower()
    if low in _AUSLASSEN or low in _ZEITPUNKTE:
        return False
    if re.search(r"(Id|ID|Pk|PK|Uuid|UUID)$", name) or low.endswith("_id"):
        return False
    if "timestamp" in low or "millis" in low or low.endswith("gmt") or low.endswith("local"):
        return False
    if low.endswith("date"):
        return False
    return True


def flach(obj: dict, praefix: str = "", tiefe: int = 0, ziel: dict | None = None,
          texte: dict | None = None) -> tuple[dict, dict]:
    """Alle Zahlen eines Datensatzes als {pfad: wert}, Aufzaehlungstexte separat."""
    ziel = {} if ziel is None else ziel
    texte = {} if texte is None else texte
    if not isinstance(obj, dict) or tiefe > 3:
        return ziel, texte
    for k, v in obj.items():
        k = str(k)
        if tiefe == 0 and k in ("values", "data") and isinstance(v, dict):
            flach(v, praefix, tiefe + 1, ziel, texte)  # Verpackung weglassen
            continue
        pfad = f"{praefix}{k}"
        if isinstance(v, dict):
            flach(v, pfad + ".", tiefe + 1, ziel, texte)
        elif zahl_ok(v):
            if _ist_metrik(k):
                ziel[pfad] = runden(v)
        elif isinstance(v, str) and RE_ENUM.match(v) and _ist_metrik(k):
            texte[pfad] = v
    return ziel, texte


_DATUMSFELDER = ("calendarDate", "calendarDay", "summaryDate", "cdate", "startDate", "date",
                 "fromCalendarDate", "weekStartDate", "day", "startDayDate",
                 "startTimestampLocal", "startTimeLocal", "startTimestampGMT", "startTimeGMT")


def _datum_aus(obj: dict, tief: bool = True) -> str | None:
    for k in _DATUMSFELDER:
        v = obj.get(k)
        if isinstance(v, str) and len(v) >= 10 and RE_DATUM.match(v[:10]):
            return v[:10]
    if tief:
        for k in ("generic", "cycling", "summary", "values", "data", "hrvSummary"):
            v = obj.get(k)
            if isinstance(v, dict):
                d = _datum_aus(v, False)
                if d:
                    return d
    return None


def tagesdatensaetze(antwort) -> list[tuple[str, dict]]:
    """Findet in einer Garmin-Antwort die Datensaetze je Tag (Form unbekannt)."""
    gefunden: list[tuple[str, dict]] = []

    def suche(x, tiefe: int) -> bool:
        if tiefe > 4:
            return False
        if isinstance(x, list):
            dicts = [e for e in x if isinstance(e, dict)]
            if dicts:
                mit = [(_datum_aus(e), e) for e in dicts]
                treffer = [(d, e) for d, e in mit if d]
                if treffer and len(treffer) * 2 >= len(dicts):
                    gefunden.extend(treffer)
                    return True
            erfolg = False
            for e in x[:200]:
                erfolg = suche(e, tiefe + 1) or erfolg
            return erfolg
        if isinstance(x, dict):
            schluessel = [str(k) for k in x.keys()]
            datums = [k for k in schluessel if RE_DATUM.match(k)]
            if datums and len(datums) * 2 >= len(schluessel):
                for k in datums:
                    v = x[k]
                    if isinstance(v, dict):
                        gefunden.append((k, v))
                    elif isinstance(v, list):
                        gefunden.append((k, {"eintraege": v}))
                return True
            erfolg = False
            for v in x.values():
                if isinstance(v, (list, dict)):
                    erfolg = suche(v, tiefe + 1) or erfolg
            return erfolg
        return False

    suche(antwort, 0)
    if not gefunden and isinstance(antwort, dict):
        d = _datum_aus(antwort)
        if d:
            gefunden.append((d, antwort))
    return gefunden


# --------------------------------------------------------------------------
# Ablage: verschluesselte Dateien (Daten-Zweig des Repositorys)
# --------------------------------------------------------------------------
class Ablage:
    """d/... = Anzeige-Daten (Schluessel "daten"), z/... = Zugang (Schluessel "zustand")."""

    def __init__(self, ordner: Path, haupt: str, bericht: Bericht):
        self.ordner = Path(ordner)
        self.ordner.mkdir(parents=True, exist_ok=True)
        self.dk = ableiten(haupt, "daten")
        self.zk = ableiten(haupt, "zustand")
        self.bericht = bericht
        self._cache: dict[str, Any] = {}
        self._hash: dict[str, str | None] = {}
        self._neu: set[str] = set()

    def _key(self, pfad: str) -> bytes:
        return self.zk if pfad.startswith("z/") else self.dk

    def existiert(self, pfad: str) -> bool:
        return pfad in self._cache and self._cache[pfad] is not None or (self.ordner / pfad).exists()

    def lesen(self, pfad: str, standard=None):
        if pfad not in self._cache:
            datei = self.ordner / pfad
            obj = None
            if datei.exists():
                try:
                    obj = entschluesseln(self._key(pfad), pfad, datei.read_bytes())
                except Exception as e:
                    self.bericht.fehler(f"{pfad} nicht lesbar", e)
            self._cache[pfad] = obj
            self._hash[pfad] = hashlib.sha256(_json_bytes(obj)).hexdigest() if obj is not None else None
        if self._cache[pfad] is None and standard is not None:
            self._cache[pfad] = standard
        return self._cache[pfad]

    def schreiben(self, pfad: str, obj) -> None:
        self._cache[pfad] = obj
        self._neu.add(pfad)

    def speichern(self, nur: str | None = None) -> list[str]:
        geschrieben = []
        for pfad in sorted(self._neu):
            if nur and not pfad.startswith(nur):
                continue
            obj = self._cache.get(pfad)
            if obj is None:
                continue
            h = hashlib.sha256(_json_bytes(obj)).hexdigest()
            datei = self.ordner / pfad
            if h == self._hash.get(pfad) and datei.exists():
                continue
            datei.parent.mkdir(parents=True, exist_ok=True)
            tmp = datei.with_name(datei.name + ".tmp")
            tmp.write_bytes(verschluesseln(self._key(pfad), pfad, obj))
            os.replace(tmp, datei)
            self._hash[pfad] = h
            geschrieben.append(pfad)
        self._neu = {p for p in self._neu if nur and not p.startswith(nur)}
        return geschrieben

    def dateien(self) -> dict[str, str]:
        """Pfad -> Kurzversion (aendert sich nur, wenn sich der Inhalt aendert)."""
        ergebnis = {}
        basis = self.ordner / "d"
        if basis.exists():
            for datei in sorted(basis.rglob("*.enc")):
                rel = datei.relative_to(self.ordner).as_posix()
                ergebnis[rel] = hashlib.sha256(datei.read_bytes()).hexdigest()[:10]
        return ergebnis

    def liste(self, unterordner: str) -> list[str]:
        basis = self.ordner / unterordner
        if not basis.exists():
            return []
        return sorted(p.relative_to(self.ordner).as_posix() for p in basis.rglob("*.enc"))


class Tagesspeicher:
    """Tageswerte je Jahr: d/tage/<jahr>.enc = {"werte": {metrik: [[datum, wert]]}, "texte": {...}}"""

    def __init__(self, ablage: Ablage):
        self.ablage = ablage
        self.jahre: dict[int, dict] = {}

    def _jahr(self, jahr: int) -> dict:
        if jahr not in self.jahre:
            obj = self.ablage.lesen(f"d/tage/{jahr}.enc") or {}
            self.jahre[jahr] = {
                "werte": {m: {d: v for d, v in paare} for m, paare in (obj.get("werte") or {}).items()},
                "texte": {m: {d: v for d, v in paare} for m, paare in (obj.get("texte") or {}).items()},
                "neu": False,
            }
        return self.jahre[jahr]

    def setzen(self, metrik: str, datum: str, wert) -> None:
        wert = runden(wert)
        if wert is None or not RE_DATUM.match(datum):
            return
        j = self._jahr(int(datum[:4]))
        spalte = j["werte"].setdefault(metrik, {})
        if spalte.get(datum) != wert:
            spalte[datum] = wert
            j["neu"] = True

    def text(self, metrik: str, datum: str, text: str) -> None:
        if not RE_DATUM.match(datum):
            return
        j = self._jahr(int(datum[:4]))
        spalte = j["texte"].setdefault(metrik, {})
        if spalte.get(datum) != text:
            spalte[datum] = text
            j["neu"] = True

    def speichern(self) -> None:
        for jahr, j in self.jahre.items():
            if not j["neu"]:
                continue
            obj = {
                "jahr": jahr,
                "werte": {m: sorted(([d, v] for d, v in s.items()), key=lambda p: p[0])
                          for m, s in sorted(j["werte"].items()) if s},
                "texte": {m: sorted(([d, v] for d, v in s.items()), key=lambda p: p[0])
                          for m, s in sorted(j["texte"].items()) if s},
            }
            self.ablage.schreiben(f"d/tage/{jahr}.enc", obj)
            j["neu"] = False

    def katalog(self) -> dict:
        """Alle Metriken mit Anzahl und Zeitraum (fuer "Alle Werte")."""
        werte: dict[str, list] = {}
        texte: dict[str, list] = {}
        jahre = set(self.jahre)
        for pfad in self.ablage.liste("d/tage"):
            try:
                jahre.add(int(Path(pfad).stem))
            except ValueError:
                continue
        for jahr in sorted(jahre):
            j = self._jahr(jahr)
            for ziel, quelle in ((werte, j["werte"]), (texte, j["texte"])):
                for m, s in quelle.items():
                    if not s:
                        continue
                    eintrag = ziel.setdefault(m, [0, "9999", "0000"])
                    eintrag[0] += len(s)
                    eintrag[1] = min(eintrag[1], min(s))
                    eintrag[2] = max(eintrag[2], max(s))
        belegt = sorted(j for j in jahre if any(self._jahr(j)["werte"].values()))
        return {"werte": werte, "texte": texte, "jahre": belegt}


class Rohspeicher:
    """Rohdaten je Bereich und Jahr: d/roh/<quelle>-<bereich>/<jahr>.enc = {schluessel: datensatz}"""

    def __init__(self, ablage: Ablage):
        self.ablage = ablage
        self.offen: dict[str, dict] = {}

    def setzen(self, bereich: str, schluessel: str, datensatz, jahr: int) -> None:
        pfad = f"d/roh/{bereich}/{jahr}.enc"
        if pfad not in self.offen:
            self.offen[pfad] = dict(self.ablage.lesen(pfad) or {})
        if self.offen[pfad].get(schluessel) != datensatz:
            self.offen[pfad][schluessel] = datensatz
            self.ablage.schreiben(pfad, self.offen[pfad])


# --------------------------------------------------------------------------
# Withings-Zugang
# --------------------------------------------------------------------------
class Withings:
    """konto = {"client_id", "client_secret", "token": {access_token, refresh_token, expires_at}}"""

    def __init__(self, konto: dict, speichern: Callable[[dict], None] | None = None):
        self.konto = konto
        self._speichern = speichern
        self.session = requests.Session()
        self.session.headers["User-Agent"] = f"{APP}/{VERSION}"
        self.drossel = Drossel(0.6)
        self.aufrufe = 0

    def anmelde_adresse(self, callback: str, state: str) -> str:
        from urllib.parse import urlencode

        return WITHINGS_AUTH_URL + "?" + urlencode({
            "response_type": "code", "client_id": self.konto.get("client_id", ""),
            "scope": WITHINGS_SCOPE, "redirect_uri": callback, "state": state,
        })

    def code_einloesen(self, code: str, callback: str) -> None:
        self._token_anfordern({"grant_type": "authorization_code", "code": code, "redirect_uri": callback})

    def _token_anfordern(self, felder: dict) -> None:
        daten = {"action": "requesttoken", "client_id": self.konto.get("client_id", ""),
                 "client_secret": self.konto.get("client_secret", ""), **felder}
        try:
            antwort = self.session.post(WITHINGS_TOKEN_URL, data=daten, timeout=30).json()
        except (requests.RequestException, ValueError) as e:
            raise WithingsFehler(f"Withings nicht erreichbar ({type(e).__name__})") from e
        if antwort.get("status") != 0:
            raise WithingsFehler(f"Status {antwort.get('status')}: {antwort.get('error', 'unbekannt')}")
        body = antwort.get("body") or {}
        self.konto["token"] = {
            "access_token": body["access_token"],
            "refresh_token": body["refresh_token"],
            "expires_at": time.time() + int(body.get("expires_in", 10800)),
            "userid": body.get("userid"),
            "scope": body.get("scope"),
        }
        # Withings tauscht das Refresh-Token bei jeder Erneuerung: sofort sichern
        if self._speichern:
            self._speichern(self.konto)

    def _access_token(self) -> str:
        token = self.konto.get("token") or {}
        if not token.get("refresh_token"):
            raise AnmeldungNoetig("Withings ist nicht verbunden.")
        if time.time() > float(token.get("expires_at", 0)) - 300:
            try:
                self._token_anfordern({"grant_type": "refresh_token", "refresh_token": token["refresh_token"]})
            except WithingsFehler as e:
                raise AnmeldungNoetig(f"Die Withings-Freigabe ist abgelaufen ({e}).") from e
        return self.konto["token"]["access_token"]

    def aufruf(self, pfad: str, params: dict) -> dict:
        auth = limit = netz = 0
        while True:
            token = self._access_token()
            self.drossel.warten()
            self.aufrufe += 1
            try:
                r = self.session.post(WITHINGS_API + pfad, data=params,
                                      headers={"Authorization": f"Bearer {token}"}, timeout=60)
                antwort = r.json()
            except (requests.RequestException, ValueError) as e:
                netz += 1
                if netz >= 4:
                    raise WithingsFehler(f"Withings nicht erreichbar ({type(e).__name__})") from e
                time.sleep(5 * netz)
                continue
            status = antwort.get("status")
            if status == 0:
                return antwort.get("body") or {}
            if status in (100, 101, 102, 200, 401):
                auth += 1
                if auth > 1:
                    raise AnmeldungNoetig("Withings verweigert den Zugriff.")
                self.konto.setdefault("token", {})["expires_at"] = 0  # erneuern erzwingen
                continue
            if status == 601:
                limit += 1
                if limit > 3:
                    raise Gebremst("Withings meldet zu viele Anfragen.")
                time.sleep(65)
                continue
            raise WithingsFehler(f"Withings-Fehler {status}: {antwort.get('error', '')}")

    def alle_seiten(self, pfad: str, params: dict, schluessel: str) -> list:
        ergebnis: list = []
        offset = None
        for _ in range(2000):
            p = dict(params)
            if offset is not None:
                p["offset"] = offset
            body = self.aufruf(pfad, p)
            teil = body.get(schluessel)
            if isinstance(teil, list):
                ergebnis.extend(teil)
            neu = body.get("offset")
            if body.get("more") and neu not in (None, offset):
                offset = neu
                continue
            break
        return ergebnis


# --------------------------------------------------------------------------
# Garmin-Zugang (Tokens aus dem Einrichtungsfenster)
# --------------------------------------------------------------------------
def _http_status(e: BaseException) -> int | None:
    status = getattr(getattr(e, "response", None), "status_code", None)
    if isinstance(status, int):
        return status
    m = re.search(r"\((\d{3})\)", str(e))
    return int(m.group(1)) if m else None


class GarminSitzung:
    def __init__(self, tokens: str, bericht: Bericht, budget: int = GARMIN_BUDGET,
                 frist: float | None = None, pause: float = GARMIN_PAUSE):
        self.tokens = tokens
        self.bericht = bericht
        self.budget = budget
        self.frist = frist or (time.monotonic() + 600)
        self.drossel = Drossel(pause)
        self.aufrufe = 0
        self.api = None

    def anmelden(self) -> None:
        from garminconnect import (Garmin, GarminConnectAuthenticationError,
                                   GarminConnectTooManyRequestsError)

        api = Garmin()
        try:
            api.login(tokenstore=self.tokens)
        except GarminConnectAuthenticationError as e:
            raise AnmeldungNoetig("Die Garmin-Anmeldung ist abgelaufen.") from e
        except GarminConnectTooManyRequestsError as e:
            raise Gebremst("Garmin bremst die Anmeldung.") from e
        except FileNotFoundError as e:
            raise AnmeldungNoetig("Garmin ist nicht verbunden.") from e
        except Exception as e:
            text = str(e).lower()
            if "token" in text and ("missing" in text or "loads" in text or "structurally" in text):
                raise AnmeldungNoetig("Die Garmin-Anmeldung ist unvollständig.") from e
            raise GarminFehler(f"Anmeldung mit gespeicherten Tokens fehlgeschlagen ({type(e).__name__})") from e
        self.api = api
        self.aufrufe += 2

    def neue_tokens(self) -> str:
        if self.api is None:
            return self.tokens
        try:
            text = self.api.client.dumps()
            daten = json.loads(text)
            if daten.get("di_token") or daten.get("di_refresh_token"):
                return text
        except Exception:
            pass
        return self.tokens

    def rest(self) -> int:
        return self.budget - self.aufrufe

    def zeit_uebrig(self) -> float:
        return self.frist - time.monotonic()

    def rufe(self, name: str, *args, **kwargs):
        from garminconnect import (GarminConnectAuthenticationError, GarminConnectConnectionError,
                                   GarminConnectNotFoundError, GarminConnectTooManyRequestsError)

        if self.aufrufe >= self.budget or self.zeit_uebrig() <= 0:
            raise BudgetErschoepft()
        methode = getattr(self.api, name, None)
        if methode is None:
            raise NichtVerfuegbar(None)
        for versuch in range(3):
            self.drossel.warten()
            self.aufrufe += 1
            try:
                return methode(*args, **kwargs)
            except GarminConnectTooManyRequestsError as e:
                if versuch == 2 or self.zeit_uebrig() < 120:
                    raise Gebremst("Garmin meldet zu viele Anfragen.") from e
                pause = 45 * (versuch + 1)
                self.bericht.privat(f"Garmin bremst bei {name}, warte {pause} s")
                time.sleep(pause)
            except GarminConnectNotFoundError as e:
                raise NichtVerfuegbar(404) from e
            except GarminConnectAuthenticationError as e:
                if versuch == 0:
                    try:
                        self.tokens = self.neue_tokens()
                        self.anmelden()
                        continue
                    except AnmeldungNoetig:
                        raise
                    except Exception:
                        pass
                raise AnmeldungNoetig("Die Garmin-Anmeldung ist abgelaufen.") from e
            except GarminConnectConnectionError as e:
                status = _http_status(e)
                text = str(e).lower()
                if status in (400, 403, 404, 405, 410, 422):
                    raise NichtVerfuegbar(status) from e
                if "no data" in text or "no heart rate data" in text:
                    return None
                if versuch == 2:
                    raise GarminFehler(f"{name}: Verbindungsfehler {status or ''}".strip()) from e
                time.sleep(4 * (versuch + 1))
            except (ValueError, TypeError) as e:
                raise NichtVerfuegbar(None) from e
        raise GarminFehler(name)


# --------------------------------------------------------------------------
# Withings-Daten sammeln
# --------------------------------------------------------------------------
class WithingsSammler:
    def __init__(self, w: Withings, ablage: Ablage, tage: Tagesspeicher, roh: Rohspeicher,
                 z: dict, bericht: Bericht, zz: ZoneInfo):
        self.w, self.ablage, self.tage, self.roh, self.z, self.bericht, self.zz = w, ablage, tage, roh, z, bericht, zz
        self.neu = {"messungen": 0, "ekg": 0, "tage": 0}

    def lauf(self) -> None:
        self.messungen()
        self._schritt("EKG", self.ekg)
        self._schritt("Aktivität", lambda: self.tageswerte("aktivitaet"))
        self._schritt("Schlaf", lambda: self.tageswerte("schlaf"))
        self._schritt("Trainings", self.trainings)
        if time.time() - float(self.z.get("info_zuletzt", 0)) > 6 * STUNDE:
            self._schritt("Geräte", self.info)
            self.z["info_zuletzt"] = time.time()

    def _schritt(self, name: str, funktion) -> None:
        try:
            funktion()
        except (AnmeldungNoetig, Gebremst):
            raise
        except Exception as e:
            self.bericht.fehler(f"Withings {name}", e)

    # Messungen (Waage, Blutdruck, EKG-Werte, Nervengesundheit ...): jedes Mal komplett
    def messungen(self) -> None:
        gruppen: list = []
        gruppen += self.w.alle_seiten("measure", {"action": "getmeas", "category": 1}, "measuregrps")
        gruppen += self._erweiterte_messungen()

        alt = self.ablage.lesen("d/withings.enc") or {}
        modelle: list[str] = list(alt.get("modelle") or [])
        zeilen: dict[tuple, list] = {}
        kommentare: dict[str, str] = {}
        for g in gruppen:
            if not isinstance(g, dict) or g.get("category", 1) != 1:
                continue
            ts = g.get("date")
            grpid = g.get("grpid")
            if not isinstance(ts, int) or grpid is None:
                continue
            modell = g.get("model") or (f"Modell {g.get('modelid')}" if g.get("modelid") else "")
            modell = str(modell) if modell else ""
            if modell not in modelle:
                modelle.append(modell)
            mi = modelle.index(modell)
            if g.get("comment"):
                kommentare[str(grpid)] = str(g["comment"])[:500]
            for m in g.get("measures") or []:
                typ, wert, einheit = m.get("type"), m.get("value"), m.get("unit", 0)
                if not isinstance(typ, int) or not zahl_ok(wert) or not isinstance(einheit, int):
                    continue
                pos = m.get("position")
                pos = pos if isinstance(pos, int) and not isinstance(pos, bool) else -1
                v = runden(wert * (10 ** einheit))
                if v is None:
                    continue
                zeilen[(grpid, typ, pos)] = [ts, typ, v, pos, grpid, mi, g.get("attrib", 0)]

        neu = sorted(zeilen.values(), key=lambda z: (z[0], z[1], z[3]))
        alt_zeilen = alt.get("messungen") or []
        if alt_zeilen and len(neu) < 0.8 * len(alt_zeilen):
            # Ungewoehnlich wenige Werte: lieber zusammenfuehren statt ersetzen
            self.bericht.privat("Withings lieferte deutlich weniger Messungen als bisher – führe zusammen", "warnung")
            alle = {(r[4], r[1], r[3]): r for r in alt_zeilen}
            alle.update({(r[4], r[1], r[3]): r for r in neu})
            neu = sorted(alle.values(), key=lambda z: (z[0], z[1], z[3]))
        bekannt = {(r[4], r[1], r[3]) for r in alt_zeilen}
        self.neu["messungen"] = sum(1 for r in neu if (r[4], r[1], r[3]) not in bekannt)
        self.ablage.schreiben("d/withings.enc", {
            "messungen": neu, "modelle": modelle, "kommentare": kommentare,
            "stand": int(time.time()),
        })

    def _erweiterte_messungen(self) -> list:
        """Neuere Messtypen (Viszeralfett, Grundumsatz, Segmente, Nerven ...) liefert Withings nur auf ausdrückliche
        Anfrage. Lehnt Withings die gesammelte Anfrage ab, werden die Typen einzeln geholt; abgelehnte Typen
        bleiben danach außen vor, damit die gesammelte Anfrage wieder klappt."""
        aus = {str(t) for t in (self.z.get("typen_abgelehnt") or [])}
        typen = [t for t in WITHINGS_TYPEN_ERWEITERT.split(",") if t not in aus]
        try:
            return self.w.alle_seiten("measure", {"action": "getmeas", "category": 1, "meastypes": ",".join(typen)}, "measuregrps")
        except (AnmeldungNoetig, Gebremst):
            raise
        except Exception as e:
            self.bericht.privat(f"Withings lehnt die erweiterten Messtypen gesammelt ab ({e}) – hole sie einzeln", "warnung")
        gruppen: list = []
        abgelehnt: list[str] = []
        for typ in typen:
            try:
                gruppen += self.w.alle_seiten("measure", {"action": "getmeas", "category": 1, "meastype": typ}, "measuregrps")
            except (AnmeldungNoetig, Gebremst):
                raise
            except Exception:
                abgelehnt.append(typ)
        if abgelehnt and len(abgelehnt) < len(typen):
            self.z["typen_abgelehnt"] = sorted(aus | set(abgelehnt), key=int)
            self.bericht.privat(f"Withings kennt diese Messtypen nicht: {', '.join(abgelehnt)} – sie werden künftig nicht mehr abgefragt")
        elif abgelehnt:
            self.bericht.fehler("Withings erweiterte Messtypen", WithingsFehler("Withings hat alle erweiterten Messtypen abgelehnt"))
        return gruppen

    def ekg(self) -> None:
        liste = self.w.alle_seiten("v2/heart", {"action": "list", "startdate": 1262304000,
                                                "enddate": int(time.time()) + 86400}, "series")
        alt = self.ablage.lesen("d/ekg.enc") or {}
        eintraege = {(e["q"], str(e["id"])): e for e in alt.get("liste") or []}
        for s in liste:
            if not isinstance(s, dict):
                continue
            ecg = s.get("ecg") or {}
            sid = ecg.get("signalid") or s.get("signalid")
            if not sid:
                continue
            bp = s.get("bloodpressure") or {}
            schluessel = ("w", str(sid))
            eintrag = eintraege.get(schluessel, {})
            eintrag.update({
                "q": "w", "id": str(sid), "ts": s.get("timestamp"), "afib": ecg.get("afib"),
                "hf": s.get("heart_rate"), "modell": s.get("model") or "", "sys": bp.get("systole"),
                "dia": bp.get("diastole"),
            })
            eintraege[schluessel] = eintrag
        # Kurven nachladen (begrenzt pro Lauf)
        offen = [e for e in eintraege.values() if e["q"] == "w" and not e.get("kurve")]
        offen.sort(key=lambda e: -(e.get("ts") or 0))
        for e in offen[:25]:
            try:
                body = self.w.aufruf("v2/heart", {"action": "get", "signalid": e["id"]})
            except (AnmeldungNoetig, Gebremst):
                raise
            except Exception as fehler:
                self.bericht.fehler("Withings EKG-Kurve", fehler)
                continue
            signal = [int(x) for x in body.get("signal") or [] if zahl_ok(x)]
            if not signal:
                e["kurve"] = False
                continue
            self.ablage.schreiben(f"d/ekg/w-{e['id']}.enc", {
                "signal": signal, "freq": body.get("sampling_frequency"),
                "pos": body.get("wearposition"), "einheit": "µV",
            })
            e.update({"kurve": True, "freq": body.get("sampling_frequency"),
                      "pos": body.get("wearposition"), "n": len(signal)})
            self.neu["ekg"] += 1
        self.ablage.schreiben("d/ekg.enc", {"liste": sorted(eintraege.values(), key=lambda e: -(e.get("ts") or 0))})

    def tageswerte(self, art: str) -> None:
        if art == "aktivitaet":
            pfad, params, schluessel = "v2/measure", {"action": "getactivity", "data_fields": AKTIVITAET_FELDER}, "activities"
        else:
            pfad, params, schluessel = "v2/sleep", {"action": "getsummary", "data_fields": SCHLAF_FELDER}, "series"
        seit = self.z.get(f"{art}_seit")
        if seit:
            params["lastupdate"] = int(seit) - 2 * STUNDE
        else:
            params["startdateymd"] = "2009-01-01"
            params["enddateymd"] = (datetime.now(self.zz).date() + timedelta(days=1)).isoformat()
        jetzt = time.time()
        try:
            saetze = self.w.alle_seiten(pfad, params, schluessel)
        except WithingsFehler:
            ohne = {k: v for k, v in params.items() if k != "data_fields"}
            saetze = self.w.alle_seiten(pfad, ohne, schluessel)
        nach_tag: dict[str, list] = {}
        for s in saetze:
            if isinstance(s, dict):
                d = s.get("date")
                if isinstance(d, str) and RE_DATUM.match(d[:10]):
                    nach_tag.setdefault(d[:10], []).append(s)
        for d, liste in nach_tag.items():
            if art == "aktivitaet":
                bester = max(liste, key=lambda s: s.get("steps") or 0)
            else:
                bester = max(liste, key=lambda s: (s.get("data") or {}).get("total_sleep_time") or 0)
            self.roh.setzen(f"w-{art}", d, liste[0] if len(liste) == 1 else {"eintraege": liste}, int(d[:4]))
            werte, texte = flach(bester)
            for k, v in werte.items():
                self.tage.setzen(f"w.{art}.{k}", d, v)
            self.neu["tage"] += 1
        self.z[f"{art}_seit"] = jetzt

    def trainings(self) -> None:
        params = {"action": "getworkouts", "data_fields": TRAINING_FELDER}
        seit = self.z.get("training_seit")
        if seit:
            params["lastupdate"] = int(seit) - 2 * STUNDE
        else:
            params["startdateymd"] = "2009-01-01"
            params["enddateymd"] = (datetime.now(self.zz).date() + timedelta(days=1)).isoformat()
        jetzt = time.time()
        try:
            serie = self.w.alle_seiten("v2/measure", params, "series")
        except WithingsFehler:
            serie = self.w.alle_seiten("v2/measure", {k: v for k, v in params.items() if k != "data_fields"}, "series")
        alt = self.ablage.lesen("d/withings_trainings.enc") or {}
        alle = {str(t.get("id")): t for t in alt.get("liste") or []}
        for t in serie:
            if isinstance(t, dict) and t.get("id") is not None:
                alle[str(t["id"])] = {
                    "id": t.get("id"), "kategorie": t.get("category"), "start": t.get("startdate"),
                    "ende": t.get("enddate"), "modell": t.get("model"), "daten": t.get("data") or {},
                }
        if alle or alt:
            self.ablage.schreiben("d/withings_trainings.enc",
                                  {"liste": sorted(alle.values(), key=lambda t: -(t.get("start") or 0))})
        self.z["training_seit"] = jetzt

    def info(self) -> None:
        info = dict(self.ablage.lesen("d/withings_info.enc") or {})
        for name, pfad, params in (("geraete", "v2/user", {"action": "getdevice"}),
                                   ("ziele", "v2/user", {"action": "getgoals"})):
            try:
                info[name] = self.w.aufruf(pfad, params)
            except (AnmeldungNoetig, Gebremst):
                raise
            except Exception as e:
                self.bericht.fehler(f"Withings {name}", e)
        info["stand"] = int(time.time())
        self.ablage.schreiben("d/withings_info.enc", info)


# --------------------------------------------------------------------------
# Garmin: kompakte Formen fuer die App
# --------------------------------------------------------------------------
SPORT_FELDER = {
    "id": "activityId", "name": "activityName", "start": "startTimeLocal", "start_gmt": "startTimeGMT",
    "dauer": "duration", "bewegt": "movingDuration", "distanz": "distance", "kcal": "calories",
    "hf": "averageHR", "hf_max": "maxHR", "auf": "elevationGain", "ab": "elevationLoss",
    "tempo": "averageSpeed", "tempo_max": "maxSpeed", "te_a": "aerobicTrainingEffect",
    "te_an": "anaerobicTrainingEffect", "last": "activityTrainingLoad", "vo2": "vO2MaxValue",
    "leistung": "avgPower", "np": "normPower", "schritte": "steps", "saetze": "totalSets",
    "wdh": "totalReps", "ort": "locationName", "lat": "startLatitude", "lon": "startLongitude",
    "label": "trainingEffectLabel", "bb": "differenceBodyBattery", "schweiss": "waterEstimated",
    "temp_min": "minTemperature", "temp_max": "maxTemperature", "laenge": "lapCount",
    "mod_min": "moderateIntensityMinutes", "int_min": "vigorousIntensityMinutes",
    "kad_lauf": "averageRunningCadenceInStepsPerMinute", "kad_rad": "averageBikingCadenceInRevPerMinute",
    "bahnen": "poolLength", "zuege": "totalNumberOfStrokes", "hoehe_max": "maxElevation",
    "hoehe_min": "minElevation", "atmung": "avgRespirationRate", "stress": "avgStress",
}


def aktivitaet_kompakt(a: dict) -> dict:
    out = {}
    for kurz_name, feld in SPORT_FELDER.items():
        v = a.get(feld)
        if v is None:
            continue
        if zahl_ok(v):
            out[kurz_name] = runden(v)
        elif isinstance(v, (str, int)) and not isinstance(v, bool):
            out[kurz_name] = v
    typ = a.get("activityType") or {}
    out["typ"] = typ.get("typeKey") or "other"
    if typ.get("parentTypeId") is not None:
        out["eltern"] = typ.get("parentTypeId")
    zonen = [runden(a.get(f"hrTimeInZone_{i}")) for i in range(1, 6)]
    if any(z for z in zonen):
        out["zonen"] = [z or 0 for z in zonen]
    if a.get("hasPolyline"):
        out["gps"] = True
    if a.get("pr"):
        out["pr"] = True
    kinder = a.get("childIds")
    if isinstance(kinder, list) and kinder:
        out["kinder"] = [str(k) for k in kinder if isinstance(k, (int, str))][:12]
    return out


_DETAIL_SCHLUESSEL = {
    "sumDuration": "t", "sumElapsedDuration": "tg", "sumMovingDuration": "tb",
    "directHeartRate": "hf", "directSpeed": "v", "directElevation": "h", "sumDistance": "s",
    "directRunCadence": "kad", "directBikeCadence": "kad_rad", "directDoubleCadence": "kad2",
    "directPower": "p", "directAirTemperature": "temp", "directVerticalOscillation": "vo",
    "directGroundContactTime": "bk", "directStrideLength": "sl", "directVerticalRatio": "vr",
    "directRespirationRate": "atm", "directPerformanceCondition": "lz", "directGradeAdjustedSpeed": "gap",
    "directStamina": "ausdauer", "directVerticalSpeed": "vv", "directLatitude": "lat",
    "directLongitude": "lon", "directTimestamp": "ts", "directBodyBattery": "bb",
}


def details_kompakt(details: dict | None, runden_daten: dict | None, zonen_daten) -> dict:
    out: dict[str, Any] = {"reihen": {}, "track": [], "runden": [], "zonen": []}
    if isinstance(details, dict):
        index = {}
        belegt = set()
        for d in details.get("metricDescriptors") or []:
            if isinstance(d, dict) and isinstance(d.get("metricsIndex"), int) and d.get("key") in _DETAIL_SCHLUESSEL:
                kurz_name = _DETAIL_SCHLUESSEL[d["key"]]
                if kurz_name not in belegt:  # z. B. Lauf- und Radkadenz teilen sich "kad"
                    index[d["metricsIndex"]] = kurz_name
                    belegt.add(kurz_name)
        reihen: dict[str, list] = {k: [] for k in set(index.values())}
        for probe in details.get("activityDetailMetrics") or []:
            werte = (probe or {}).get("metrics") or []
            for i, k in index.items():
                v = werte[i] if i < len(werte) else None
                if k in ("lat", "lon"):
                    reihen[k].append(round(v, 5) if zahl_ok(v) else None)
                else:
                    reihen[k].append(runden(v) if zahl_ok(v) else None)
        out["reihen"] = {k: v for k, v in reihen.items() if any(x is not None for x in v)}
        if "kad" not in out["reihen"] and "kad_rad" in out["reihen"]:  # Rad: Trittfrequenz
            out["reihen"]["kad"] = out["reihen"].pop("kad_rad")
        out["reihen"].pop("kad_rad", None)
        poly = ((details.get("geoPolylineDTO") or {}).get("polyline")) or []
        track = [[round(p["lat"], 5), round(p["lon"], 5)] for p in poly
                 if isinstance(p, dict) and zahl_ok(p.get("lat")) and zahl_ok(p.get("lon"))]
        if not track and "lat" in out["reihen"] and "lon" in out["reihen"]:
            track = [[a, b] for a, b in zip(out["reihen"]["lat"], out["reihen"]["lon"]) if a is not None and b is not None]
        if len(track) > 2500:
            schritt = len(track) / 2500
            track = [track[int(i * schritt)] for i in range(2500)]
        out["track"] = track
        out["reihen"].pop("lat", None)
        out["reihen"].pop("lon", None)
    if isinstance(runden_daten, dict):
        for lap in runden_daten.get("lapDTOs") or []:
            if not isinstance(lap, dict):
                continue
            out["runden"].append({k: runden(lap.get(f)) for k, f in (
                ("s", "distance"), ("t", "duration"), ("tb", "movingDuration"), ("hf", "averageHR"),
                ("hf_max", "maxHR"), ("v", "averageSpeed"), ("auf", "elevationGain"), ("ab", "elevationLoss"),
                ("kad", "averageRunCadence"), ("p", "averagePower"), ("kcal", "calories"))
                if zahl_ok(lap.get(f))})
    if isinstance(zonen_daten, list):
        for z in zonen_daten:
            if isinstance(z, dict) and zahl_ok(z.get("secsInZone")):
                out["zonen"].append([z.get("zoneNumber"), runden(z.get("secsInZone")), runden(z.get("zoneLowBoundary"))])
    return out


def _deskriptor_index(liste, name: str, standard: int) -> int:
    for d in liste or []:
        if not isinstance(d, dict):
            continue
        schluessel = d.get("key") or d.get("bodyBatteryValueDescriptorKey") or d.get("descriptorKey")
        index = d.get("index", d.get("bodyBatteryValueDescriptorIndex"))
        if schluessel == name and isinstance(index, int):
            return index
    return standard


def _paare(werte, ts_i: int = 0, v_i: int = 1, nur_positiv: bool = False) -> list:
    out = []
    for e in werte or []:
        if isinstance(e, (list, tuple)) and len(e) > max(ts_i, v_i):
            t, v = ms(e[ts_i]), e[v_i]
            if t is None or not zahl_ok(v):
                continue
            if nur_positiv and v < 0:
                v = None
            out.append([t, runden(v) if v is not None else None])
    return out


def _punkte(liste, ts_feld: str, wert_feld: str) -> list:
    out = []
    for e in liste or []:
        if isinstance(e, dict):
            t, v = ms(e.get(ts_feld)), e.get(wert_feld)
            if t is not None and zahl_ok(v):
                out.append([t, runden(v)])
    return out


def tag_kompakt(roh: dict) -> dict:
    """Tagesverlaeufe in eine feste, kleine Form bringen."""
    out: dict[str, Any] = {}
    hf = roh.get("hf") or {}
    if isinstance(hf, dict):
        i = _deskriptor_index(hf.get("heartRateValueDescriptors"), "heartrate", 1)
        out["hf"] = [p for p in _paare(hf.get("heartRateValues"), 0, i) if p[1] is not None]
        out["hf_info"] = {k: hf.get(k) for k in ("restingHeartRate", "minHeartRate", "maxHeartRate",
                                                  "lastSevenDaysAvgRestingHeartRate") if zahl_ok(hf.get(k))}
    st = roh.get("stress") or {}
    if isinstance(st, dict):
        i = _deskriptor_index(st.get("stressValueDescriptorsDTOList"), "stressLevel", 1)
        out["stress"] = _paare(st.get("stressValuesArray"), 0, i, nur_positiv=True)
        bb = st.get("bodyBatteryValuesArray") or []
        standard = 2 if bb and isinstance(bb[0], (list, tuple)) and len(bb[0]) >= 3 else 1
        i = _deskriptor_index(st.get("bodyBatteryValueDescriptorsDTOList"), "bodyBatteryLevel", standard)
        out["bb"] = [p for p in _paare(bb, 0, i) if p[1] is not None]
        out["stress_info"] = {k: st.get(k) for k in ("avgStressLevel", "maxStressLevel") if zahl_ok(st.get(k))}
    schritte = roh.get("schritte")
    if isinstance(schritte, list):
        out["schritte"] = [[ms(e.get("startGMT")), runden(e.get("steps")), e.get("primaryActivityLevel")]
                           for e in schritte if isinstance(e, dict) and ms(e.get("startGMT")) and zahl_ok(e.get("steps"))]
    at = roh.get("atmung") or {}
    if isinstance(at, dict):
        i = _deskriptor_index(at.get("respirationValueDescriptorsDTOList"), "respiration", 1)
        out["atmung"] = [p for p in _paare(at.get("respirationValuesArray"), 0, i, nur_positiv=True) if p[1] is not None]
    sp = roh.get("spo2") or {}
    if isinstance(sp, dict):
        werte = _paare(sp.get("spO2HourlyAverages"))
        if not werte:
            werte = _punkte(sp.get("continuousReadingDTOList"), "epochTimestamp", "spo2Reading")
        out["spo2"] = werte
        out["spo2_info"] = {k: sp.get(k) for k in ("averageSpO2", "lowestSpO2", "latestSpO2", "avgSleepSpO2")
                            if zahl_ok(sp.get(k))}
    hrv = roh.get("hrv") or {}
    if isinstance(hrv, dict):
        out["hrv"] = _punkte(hrv.get("hrvReadings"), "readingTimeGMT", "hrvValue")
        if isinstance(hrv.get("hrvSummary"), dict):
            out["hrv_info"] = {k: v for k, v in hrv["hrvSummary"].items() if zahl_ok(v) or isinstance(v, str)}
    s = roh.get("schlaf") or {}
    if isinstance(s, dict) and s:
        dto = s.get("dailySleepDTO") or {}
        schlaf: dict[str, Any] = {}
        schlaf["phasen"] = [[ms(e.get("startGMT")), ms(e.get("endGMT")), runden(e.get("activityLevel"))]
                            for e in s.get("sleepLevels") or []
                            if isinstance(e, dict) and ms(e.get("startGMT")) and ms(e.get("endGMT"))]
        schlaf["bewegung"] = [[ms(e.get("startGMT")), runden(e.get("activityLevel"))]
                              for e in s.get("sleepMovement") or [] if isinstance(e, dict) and ms(e.get("startGMT"))]
        schlaf["hf"] = _punkte(s.get("sleepHeartRate"), "startGMT", "value")
        schlaf["stress"] = _punkte(s.get("sleepStress"), "startGMT", "value")
        schlaf["bb"] = _punkte(s.get("sleepBodyBattery"), "startGMT", "value")
        schlaf["hrv"] = _punkte(s.get("hrvData"), "startGMT", "value")
        schlaf["spo2"] = _punkte(s.get("wellnessEpochSPO2DataDTOList"), "epochTimestamp", "spo2Reading")
        schlaf["atmung"] = _punkte(s.get("wellnessEpochRespirationDataDTOList"), "startTimeGMT", "respirationValue")
        schlaf["unruhe"] = _punkte(s.get("sleepRestlessMoments"), "startGMT", "value")
        werte, texte = flach(dto)
        werte.update({k: runden(s.get(k)) for k in ("avgOvernightHrv", "bodyBatteryChange", "restingHeartRate",
                                                      "restlessMomentsCount") if zahl_ok(s.get(k))})
        if isinstance(s.get("hrvStatus"), str):
            texte["hrvStatus"] = s["hrvStatus"]
        schlaf["werte"] = werte
        schlaf["texte"] = texte
        schlaf["start"] = ms(dto.get("sleepStartTimestampGMT"))
        schlaf["ende"] = ms(dto.get("sleepEndTimestampGMT"))
        for k in ("sleepScoreFeedback", "sleepScoreInsight", "sleepScorePersonalizedInsight"):
            if isinstance(dto.get(k), str):
                schlaf["texte"][k] = dto[k]
        out["schlaf"] = schlaf
    ev = roh.get("bb_ereignisse")
    if isinstance(ev, list):
        ereignisse = []
        for e in ev:
            if not isinstance(e, dict):
                continue
            x = e.get("event") or {}
            ereignisse.append({
                "art": x.get("eventType"), "start": ms(x.get("eventStartTimeGmt")),
                "dauer": runden(x.get("durationInMilliseconds")), "wirkung": runden(x.get("bodyBatteryImpact")),
                "text": x.get("shortFeedback") or x.get("feedbackType"), "name": e.get("activityName"),
            })
        out["ereignisse"] = ereignisse
    return out


def ekg_kurve_suchen(obj) -> tuple[list, Any]:
    """Laengste Zahlenreihe in einer (unbekannten) Garmin-EKG-Antwort finden."""
    beste: list = []
    frequenz = None

    def suche(x, tiefe):
        nonlocal beste, frequenz
        if tiefe > 5:
            return
        if isinstance(x, dict):
            for k, v in x.items():
                if isinstance(k, str) and ("rate" in k.lower() or "frequenc" in k.lower()) and "sampl" in k.lower() and zahl_ok(v):
                    frequenz = v
                suche(v, tiefe + 1)
        elif isinstance(x, list):
            if len(x) > len(beste) and len(x) > 100 and all(zahl_ok(e) for e in x[:50]):
                beste = x
            else:
                for e in x[:20]:
                    suche(e, tiefe + 1)

    suche(obj, 0)
    return beste, frequenz


# --------------------------------------------------------------------------
# Garmin-Daten sammeln
# --------------------------------------------------------------------------
class GarminSammler:
    def __init__(self, g: GarminSitzung, ablage: Ablage, tage: Tagesspeicher, roh: Rohspeicher,
                 z: dict, bericht: Bericht, zz: ZoneInfo):
        self.g, self.ablage, self.tage, self.roh, self.z, self.bericht, self.zz = g, ablage, tage, roh, z, bericht, zz
        for k in ("cursor", "aus", "zuletzt", "tage"):
            z.setdefault(k, {})
        self.neu = {"tage": 0, "aktivitaeten": 0, "details": 0, "verlaeufe": 0, "historie": 0}
        self._aktiv: dict | None = None

    def heute(self) -> date:
        return datetime.now(self.zz).date()

    # ---- Ablauf -------------------------------------------------------------
    def lauf(self) -> None:
        self.g.anmelden()
        try:
            self._schritt("Infos", self.info)
            self._schritt("Aktuelle Tage", self.aktuell)
            self._schritt("Neue Aktivitäten", self.aktivitaeten_neu)
            self._schritt("Tagesverlauf", self.verlaeufe_aktuell)
            self._schritt("Aktivitätsdetails", lambda: self.details(10))
            self._schritt("EKG", self.ekg)
            self._schritt("Ältere Aktivitäten", self.aktivitaeten_alt)
            self._schritt("Historie", self.historie)
            self._schritt("Aktivitätsdetails", lambda: self.details(10_000, RESERVE_TAGE))
            self._schritt("Tagesverläufe", self.verlaeufe_nachladen)
        except BudgetErschoepft:
            self.bericht.privat("Garmin: Budget für diesen Lauf aufgebraucht – weiter beim nächsten Abruf")
        finally:
            self._aktiv_speichern()

    def _schritt(self, name: str, funktion) -> None:
        try:
            funktion()
        except (AnmeldungNoetig, Gebremst, BudgetErschoepft):
            raise
        except Exception as e:
            self.bericht.fehler(f"Garmin {name}", e)

    def _aus(self, art: str) -> bool:
        bis = self.z["aus"].get(art)
        return bool(bis and time.time() < float(bis))

    def _abschalten(self, art: str, e: NichtVerfuegbar, tage: int = 7) -> None:
        self.z["aus"][art] = time.time() + tage * 86400
        self.bericht.privat(f"Garmin {art}: {e} – pausiert für {tage} Tage")

    def _bereiche(self) -> list[str]:
        tag_aus = self._aus("tag")
        return [a for a, b in BEREICHE.items() if (b.ersatz_fuer is None or (b.ersatz_fuer == "tag" and tag_aus))]

    # ---- Tageswerte ---------------------------------------------------------
    def bereich(self, art: str, von: date, bis: date) -> int:
        """Ruft einen Zeitraum ab und speichert alles. Rueckgabe: Tage mit echten Daten (-1 = n. v.)."""
        b = BEREICHE[art]
        if self._aus(art):
            return -1
        try:
            antwort = self.g.rufe(b.methode, *b.args(von.isoformat(), bis.isoformat()), **b.kwargs)
        except NichtVerfuegbar as e:
            self._abschalten(art, e)
            return -1
        return self.verarbeiten(art, antwort, von, bis)

    def verarbeiten(self, art: str, antwort, von: date, bis: date) -> int:
        if antwort in (None, [], {}):
            return 0
        saetze = tagesdatensaetze(antwort)
        if not saetze:
            self.roh.setzen(f"g-{art}", f"{von.isoformat()}_{bis.isoformat()}", antwort, bis.year)
            return 0
        nach_tag: dict[str, list] = {}
        for d, rec in saetze:
            nach_tag.setdefault(d, []).append(rec)
        mit_daten = 0
        for d, recs in nach_tag.items():
            if art == "tag":
                # Tage ohne Uhrdaten (nur Grundumsatz und Ziele) nicht speichern
                recs = [r for r in recs if any(zahl_ok(r.get(k)) and r.get(k) for k in TAG_KERN)]
                if not recs:
                    continue
            if art == "bereitschaft":  # Morgenwert zuletzt, damit er gewinnt
                recs.sort(key=lambda r: (r.get("inputContext") == "AFTER_WAKEUP_RESET", str(r.get("timestamp") or "")))
            self.roh.setzen(f"g-{art}", d, recs[0] if len(recs) == 1 else {"eintraege": recs}, int(d[:4]))
            echt = False
            for rec in recs:
                werte, texte = flach(rec)
                for k, v in werte.items():
                    self.tage.setzen(f"g.{art}.{k}", d, v)
                for k, t in texte.items():
                    self.tage.text(f"g.{art}.{k}", d, t)
                if art == "tag":
                    echt = echt or any(zahl_ok(rec.get(k)) and rec.get(k) for k in TAG_KERN)
                else:
                    echt = echt or bool(werte)
            if echt:
                mit_daten += 1
                if art == "tag":
                    if d < (self.z.get("fruehester_tag") or "9999"):
                        self.z["fruehester_tag"] = d
        self.neu["tage"] += len(nach_tag)
        return mit_daten

    def aktuell(self) -> None:
        heute = self.heute()
        von = heute - timedelta(days=6)
        for art in self._bereiche():
            b = BEREICHE[art]
            if time.time() - float(self.z["zuletzt"].get(art, 0)) < b.intervall - 120:
                continue
            self.bereich(art, von, heute)
            self.z["zuletzt"][art] = time.time()
            self.z["cursor"].setdefault(art, von.isoformat())

    def historie(self) -> None:
        """Rueckwaerts in Zeitfenstern bis zum Beginn der Garmin-Daten."""
        start = (self.heute() - timedelta(days=6)).isoformat()
        while self.g.rest() > RESERVE_DETAILS and self.g.zeit_uebrig() > 90:
            untergrenze = self.z.get("untergrenze")
            tag_cursor = self.z["cursor"].get("tag", start)
            kandidaten = []
            for art in self._bereiche():
                if self._aus(art):
                    continue
                c = self.z["cursor"].get(art, start)
                if untergrenze and c <= untergrenze:
                    continue
                if not untergrenze and art != "tag" and not self._aus("tag"):
                    # Den Tageswerten folgen - aber nicht in die Zeit vor den ersten Uhrdaten,
                    # solange noch nicht feststeht, wo die Daten beginnen
                    frueh = self.z.get("fruehester_tag")
                    if c <= tag_cursor or (frueh and c <= frueh):
                        continue
                kandidaten.append((c, art == "tag", art))
            if not kandidaten:
                if not self.z.get("historie_fertig"):
                    self.z["historie_fertig"] = True
                    self.bericht.privat("Garmin: Historie vollständig geladen")
                return
            kandidaten.sort(reverse=True)
            c, _, art = kandidaten[0]
            b = BEREICHE[art]
            bis = date.fromisoformat(c) - timedelta(days=1)
            von = bis - timedelta(days=b.tage - 1)
            if untergrenze:
                von = max(von, date.fromisoformat(untergrenze))
            n = self.bereich(art, von, bis)
            self.z["cursor"][art] = von.isoformat()
            self.neu["historie"] += 1
            if art == "tag" or (self._aus("tag") and art == "schritte"):
                if n > 0:
                    self.z["leer_in_folge"] = 0
                elif n == 0:
                    self.z["leer_in_folge"] = int(self.z.get("leer_in_folge", 0)) + 1
                grenze_erreicht = von <= date(2006, 1, 1)
                if not untergrenze and (int(self.z.get("leer_in_folge", 0)) >= 13 or grenze_erreicht):
                    frueh = self.z.get("fruehester_tag") or bis.isoformat()
                    akt = self.z.get("frueheste_aktivitaet")
                    if akt and akt < frueh:
                        frueh = akt
                    self.z["untergrenze"] = (date.fromisoformat(frueh) - timedelta(days=1)).isoformat()
                    self.bericht.privat("Garmin: Beginn der Daten gefunden")

    # ---- Einzelabfragen -----------------------------------------------------
    def info(self) -> None:
        if time.time() - float(self.z.get("info_zuletzt", 0)) < 6 * STUNDE:
            return
        info = dict(self.ablage.lesen("d/garmin_info.enc") or {})
        heute = self.heute().isoformat()
        for name, methode, args in INFO:
            if self._aus(f"info-{name}"):
                continue
            try:
                antwort = self.g.rufe(methode, *[heute if a == "heute" else a for a in args])
            except NichtVerfuegbar as e:
                self._abschalten(f"info-{name}", e, 14)
                continue
            if antwort is not None:
                info[name] = antwort
        info["stand"] = int(time.time())
        self.ablage.schreiben("d/garmin_info.enc", info)
        self.z["info_zuletzt"] = time.time()
        # Zeitzone aus dem Garmin-Profil uebernehmen
        tz = ((info.get("person") or {}).get("userInfo") or {}).get("timeZone") if isinstance(info.get("person"), dict) else None
        if isinstance(tz, str) and tz:
            self.z["zeitzone"] = tz

    # ---- Aktivitaeten -------------------------------------------------------
    def _aktivitaeten(self) -> dict:
        if self._aktiv is None:
            alt = self.ablage.lesen("d/aktivitaeten.enc") or {}
            self._aktiv = {str(a["id"]): a for a in alt.get("liste") or [] if a.get("id") is not None}
        return self._aktiv

    def _aktiv_speichern(self) -> None:
        if self._aktiv is None:
            return
        liste = sorted(self._aktiv.values(), key=lambda a: str(a.get("start") or ""), reverse=True)
        self.ablage.schreiben("d/aktivitaeten.enc", {"liste": liste})
        if liste:
            frueh = min(str(a.get("start") or "9999")[:10] for a in liste)
            if RE_DATUM.match(frueh):
                self.z["frueheste_aktivitaet"] = frueh

    def _aufnehmen(self, seite: list) -> int:
        alle = self._aktivitaeten()
        neu = 0
        for a in seite or []:
            if not isinstance(a, dict) or a.get("activityId") is None:
                continue
            k = aktivitaet_kompakt(a)
            schluessel = str(a["activityId"])
            alt = alle.get(schluessel)
            if alt is None:
                neu += 1
            else:
                # Was beim Laden der Details dazukam, bleibt erhalten (Details, GPS-Spur, Teilaktivitäten)
                for feld in ("det", "gps", "kinder", "kinder_gesucht"):
                    if alt.get(feld) and not k.get(feld):
                        k[feld] = alt[feld]
            alle[schluessel] = k
            jahr = str(k.get("start") or "")[:4]
            if jahr.isdigit():
                self.roh.setzen("g-aktivitaet", schluessel, a, int(jahr))
        return neu

    def aktivitaeten_neu(self) -> None:
        start = 0
        while True:
            seite = self.g.rufe("get_activities", start, 50)
            if not isinstance(seite, list) or not seite:
                break
            neu = self._aufnehmen(seite)
            self.neu["aktivitaeten"] += neu
            self.z["akt_offset"] = int(self.z.get("akt_offset", 0)) + neu
            if neu < len(seite) or len(seite) < 50:
                break
            start += 50
        if not self.z.get("akt_offset"):
            self.z["akt_offset"] = len(self._aktivitaeten())

    def aktivitaeten_alt(self) -> None:
        if self.z.get("akt_alle"):
            return
        while self.g.rest() > RESERVE_DETAILS + 20:
            start = max(0, int(self.z.get("akt_offset", 0)) - 5)
            seite = self.g.rufe("get_activities", start, 100)
            if not isinstance(seite, list) or not seite:
                self.z["akt_alle"] = True
                return
            self.neu["aktivitaeten"] += self._aufnehmen(seite)
            self.z["akt_offset"] = start + len(seite)
            if len(seite) < 100:
                self.z["akt_alle"] = True
                return

    def _kinder(self, a: dict) -> list[str]:
        """Teilaktivitäten einer Multisport-Aktivität (die GPS-Spur steckt in den Teilen)."""
        if a.get("kinder"):
            return list(a["kinder"])
        if a.get("typ") not in ("multi_sport", "multisport") or a.get("kinder_gesucht"):
            return []
        a["kinder_gesucht"] = True
        try:
            voll = self.g.rufe("get_activity", str(a["id"]))
        except NichtVerfuegbar:
            return []
        if not isinstance(voll, dict):
            return []
        meta = voll.get("metadataDTO") if isinstance(voll.get("metadataDTO"), dict) else {}
        kinder = meta.get("childIds") or voll.get("childIds")
        if isinstance(kinder, list) and kinder:
            a["kinder"] = [str(k) for k in kinder if isinstance(k, (int, str))][:12]
        return list(a.get("kinder") or [])

    def details(self, anzahl: int, reserve: int = 0) -> None:
        alle = self._aktivitaeten()
        if not self.z.get("multisport_spur"):
            # Einmalig nach dem Update auf 1.2: Multisport-Aktivitäten ohne Spur noch einmal holen,
            # denn erst seitdem wird die Spur aus den Teilaktivitäten zusammengesetzt
            for a in alle.values():
                if a.get("typ") in ("multi_sport", "multisport") and a.get("det") and not a.get("gps") and not a.get("kinder_gesucht"):
                    a["det"] = False
            self.z["multisport_spur"] = True
        neu_ab = (self.heute() - timedelta(days=3)).isoformat()
        # Neue Aktivitäten zuerst, danach solche mit GPS (für die Karte), jeweils die neuesten zuerst
        offen = sorted((a for a in alle.values() if not a.get("det")),
                       key=lambda a: (str(a.get("start") or "") >= neu_ab,
                                      bool(a.get("gps") or a.get("kinder") or a.get("typ") in ("multi_sport", "multisport")),
                                      str(a.get("start") or "")), reverse=True)
        for a in offen[:anzahl]:
            if self.g.rest() <= reserve + 3:
                return
            aid = str(a["id"])
            try:
                det = self.g.rufe("get_activity_details", aid, 1500, 2500)
            except NichtVerfuegbar:
                det = None
            runden_daten = zonen = None
            if a.get("distanz") or a.get("dauer"):
                try:
                    runden_daten = self.g.rufe("get_activity_splits", aid)
                except NichtVerfuegbar:
                    pass
            if a.get("hf"):
                try:
                    zonen = self.g.rufe("get_activity_hr_in_timezones", aid)
                except NichtVerfuegbar:
                    pass
            kompakt = details_kompakt(det, runden_daten, zonen)
            if not kompakt["track"]:
                # Multisport: Spur aus den Teilaktivitäten zusammensetzen
                for kind in self._kinder(a)[:8]:
                    if self.g.rest() <= reserve + 3:
                        break
                    try:
                        teil = details_kompakt(self.g.rufe("get_activity_details", kind, 600, 1500), None, None)
                    except NichtVerfuegbar:
                        continue
                    kompakt["track"].extend(teil["track"])
                if len(kompakt["track"]) > 2500:
                    schritt = len(kompakt["track"]) / 2500
                    kompakt["track"] = [kompakt["track"][int(i * schritt)] for i in range(2500)]
            self.ablage.schreiben(f"d/akt/{aid}.enc", kompakt)
            a["det"] = True
            if kompakt["track"]:
                a["gps"] = True
            self.neu["details"] += 1

    # ---- Tagesverlaeufe -----------------------------------------------------
    def verlauf(self, d: date) -> None:
        roh = {}
        for name, methode in TAGESDETAILS:
            if self._aus(f"verlauf-{name}"):
                continue
            try:
                roh[name] = self.g.rufe(methode, d.isoformat())
            except NichtVerfuegbar as e:
                self._abschalten(f"verlauf-{name}", e, 7)
        kompakt = tag_kompakt(roh)
        hat_daten = any(kompakt.get(k) for k in ("hf", "stress", "bb", "schritte", "schlaf"))
        if hat_daten:
            self.ablage.schreiben(f"d/tag/{d.isoformat()}.enc", kompakt)
        self.z["tage"][d.isoformat()] = {"stand": int(time.time()), "final": d < self.heute(), "daten": hat_daten}
        self.neu["verlaeufe"] += 1

    def verlaeufe_aktuell(self) -> None:
        heute = self.heute()
        eintrag = self.z["tage"].get(heute.isoformat()) or {}
        if time.time() - float(eintrag.get("stand", 0)) > 3 * STUNDE:
            self.verlauf(heute)
        gestern = heute - timedelta(days=1)
        e = self.z["tage"].get(gestern.isoformat()) or {}
        # Gestern abschliessend holen - und nach 9 Uhr noch einmal, falls die Uhr spaet synchronisiert hat
        neun = datetime.combine(heute, datetime.min.time(), self.zz).timestamp() + 9 * STUNDE
        stand = float(e.get("stand", 0))
        if not e.get("final") or (time.time() >= neun and stand < neun):
            self.verlauf(gestern)

    def verlaeufe_nachladen(self) -> None:
        heute = self.heute()
        for n in range(2, TAGE_NACHLADEN + 1):
            d = heute - timedelta(days=n)
            if d.isoformat() in self.z["tage"]:
                continue
            if self.g.rest() < len(TAGESDETAILS) + 1:
                return
            self.verlauf(d)
        # alte Merkposten aufraeumen
        grenze = (heute - timedelta(days=400)).isoformat()
        self.z["tage"] = {k: v for k, v in self.z["tage"].items() if k >= grenze}

    # ---- EKG ----------------------------------------------------------------
    def ekg(self) -> None:
        if self._aus("ekg") or time.time() - float(self.z.get("ekg_zuletzt", 0)) < 6 * STUNDE:
            return
        alt = self.ablage.lesen("d/ekg.enc") or {}
        eintraege = {(e["q"], str(e["id"])): e for e in alt.get("liste") or []}
        seite = None
        gefunden = []
        for _ in range(20):
            try:
                antwort = self.g.rufe("get_ecg_list", "2015-01-01", self.heute().isoformat(), 50, seite)
            except NichtVerfuegbar as e:
                self._abschalten("ekg", e, 30)
                return
            if not antwort:
                break
            for d, rec in tagesdatensaetze(antwort) or []:
                gefunden.append(rec)
            if isinstance(antwort, list):
                gefunden.extend(e for e in antwort if isinstance(e, dict))
            seite = antwort.get("nextPage") or antwort.get("nextPageToken") or antwort.get("next") if isinstance(antwort, dict) else None
            if not seite:
                break
        for rec in gefunden:
            eid = rec.get("ecgId") or rec.get("id") or rec.get("uuid") or rec.get("recordingId")
            if not eid or ("g", str(eid)) in eintraege:
                continue
            eintraege[("g", str(eid))] = {
                "q": "g", "id": str(eid), "ts": (ms(rec.get("startTimeGMT") or rec.get("startTimestampGMT")
                                                    or rec.get("timestamp") or rec.get("startTime")) or 0) // 1000,
                "afib": rec.get("rhythmClassification") or rec.get("classification") or rec.get("result"),
                "hf": rec.get("heartRate") or rec.get("averageHeartRate"), "modell": rec.get("deviceName") or "Garmin",
            }
        for e in [e for e in eintraege.values() if e["q"] == "g" and not e.get("kurve")][:10]:
            try:
                antwort = self.g.rufe("get_ecg", e["id"])
            except NichtVerfuegbar:
                e["kurve"] = False
                continue
            kurve, freq = ekg_kurve_suchen(antwort)
            if kurve:
                self.ablage.schreiben(f"d/ekg/g-{e['id']}.enc", {"signal": [runden(x) for x in kurve],
                                                                 "freq": freq, "einheit": "", "roh_meta": None})
                e.update({"kurve": True, "freq": freq, "n": len(kurve)})
            self.roh.setzen("g-ekg", e["id"], antwort, datetime.fromtimestamp(e.get("ts") or 0, UTC).year)
        self.ablage.schreiben("d/ekg.enc", {"liste": sorted(eintraege.values(), key=lambda e: -(e.get("ts") or 0))})
        self.z["ekg_zuletzt"] = time.time()


# --------------------------------------------------------------------------
# Gesamtablauf
# --------------------------------------------------------------------------
def schluessel_wechsel_pruefen(ordner: Path, haupt: str, bericht: Bericht) -> None:
    """Passt der Schluessel nicht mehr zur Ablage (neu eingerichtet), alles neu aufbauen."""
    datei = Path(ordner) / "z" / "zustand.enc"
    if not datei.exists():
        return
    try:
        entschluesseln(ableiten(haupt, "zustand"), "z/zustand.enc", datei.read_bytes())
    except Exception:
        bericht.oeffentlich("Neuer Schlüssel: Die Daten werden neu aufgebaut.")
        for teil in ("d", "z"):
            shutil.rmtree(Path(ordner) / teil, ignore_errors=True)


def zustand_laden(ablage: Ablage, paket_datei: Path | None, haupt: str, bericht: Bericht) -> dict:
    z = ablage.lesen("z/zustand.enc") or {}
    if paket_datei and paket_datei.exists():
        try:
            paket = paket_entschluesseln(haupt, paket_datei.read_bytes())
        except Exception as e:
            bericht.oeffentlich("Das hochgeladene Anmeldepaket passt nicht zum Schlüssel.")
            bericht.fehler("Anmeldepaket", e)
            paket = None
        if paket and float(paket.get("erstellt", 0)) > float(z.get("paket_erstellt", 0)):
            bericht.oeffentlich("Neues Anmeldepaket übernommen.")
            for quelle in ("withings", "garmin"):
                if paket.get(quelle):
                    ziel = z.setdefault(quelle, {})
                    ziel.update(paket[quelle])
                    ziel.pop("anmeldung_noetig", None)
            if isinstance(paket.get("sync"), dict):
                # Eng begrenzter Token, mit dem die App selbst einen Abruf starten darf
                z["sync"] = {k: paket["sync"].get(k) for k in ("token", "repo")}
            if paket.get("zeitzone"):
                z["zeitzone"] = paket["zeitzone"]
            z["paket_erstellt"] = float(paket.get("erstellt", time.time()))
    return z


def sammeln(ablage_ordner: Path, haupt: str, paket: Path | None = None, frist_sekunden: int = 720,
            budget: int = GARMIN_BUDGET, garmin_pause: float = GARMIN_PAUSE,
            bericht: Bericht | None = None) -> dict:
    bericht = bericht or Bericht()
    beginn = time.monotonic()
    schluessel_wechsel_pruefen(ablage_ordner, haupt, bericht)
    ablage = Ablage(ablage_ordner, haupt, bericht)
    z = zustand_laden(ablage, paket, haupt, bericht)
    zz = zone(z.get("zeitzone") or (z.get("garmin") or {}).get("zeitzone"))
    tage = Tagesspeicher(ablage)
    roh = Rohspeicher(ablage)
    index_alt = ablage.lesen("d/index.enc") or {}
    status = dict(index_alt.get("quellen") or {})

    def zustand_sichern() -> None:
        ablage.schreiben("z/zustand.enc", z)
        ablage.speichern(nur="z/")

    # ---- Withings ----
    wz = z.get("withings")
    ws = dict(status.get("withings") or {})
    if wz and (wz.get("token") or {}).get("refresh_token"):
        ws["verbunden"] = True
        def w_speichern(konto):
            z["withings"] = konto
            zustand_sichern()
        w = Withings(wz, w_speichern)
        sammler = WithingsSammler(w, ablage, tage, roh, wz.setdefault("fortschritt", {}), bericht, zz)
        try:
            sammler.lauf()
            ws.update({"ok": True, "fehler": None, "letzter_erfolg": iso_jetzt(zz), "anmeldung_noetig": False})
            bericht.oeffentlich("Withings: abgerufen.")
            bericht.privat(f"Withings: {sammler.neu['messungen']} neue Messwerte, "
                           f"{sammler.neu['ekg']} neue EKG-Kurven ({w.aufrufe} Abfragen)")
        except AnmeldungNoetig as e:
            ws.update({"ok": False, "fehler": str(e), "anmeldung_noetig": True})
            wz["anmeldung_noetig"] = True
            bericht.oeffentlich("Withings: Anmeldung nötig – bitte im Einrichtungsfenster neu verbinden.")
            bericht.fehler("Withings", e)
        except Gebremst as e:
            ws.update({"ok": True, "fehler": "Withings bremst gerade – weiter beim nächsten Abruf."})
            bericht.oeffentlich("Withings: zu viele Anfragen, weiter beim nächsten Lauf.")
            bericht.fehler("Withings", e)
        except Exception as e:
            ws.update({"ok": False, "fehler": f"Abruf fehlgeschlagen ({type(e).__name__})"})
            bericht.oeffentlich("Withings: Abruf fehlgeschlagen (Details im App-Protokoll).")
            bericht.fehler("Withings", e)
        ws["letzter_versuch"] = iso_jetzt(zz)
        zustand_sichern()
    else:
        ws.update({"verbunden": False})
    status["withings"] = ws

    # ---- Garmin ----
    gz = z.get("garmin")
    gs = dict(status.get("garmin") or {})
    if gz and gz.get("tokens"):
        gs["verbunden"] = True
        rest = max(60, frist_sekunden - (time.monotonic() - beginn))
        sitzung = GarminSitzung(gz["tokens"], bericht, budget=budget, frist=time.monotonic() + rest, pause=garmin_pause)
        fz = gz.setdefault("fortschritt", {})
        sammler = GarminSammler(sitzung, ablage, tage, roh, fz, bericht, zz)
        try:
            sammler.lauf()
            gs.update({"ok": True, "fehler": None, "letzter_erfolg": iso_jetzt(zz), "anmeldung_noetig": False})
            bericht.oeffentlich("Garmin: abgerufen.")
        except AnmeldungNoetig as e:
            gs.update({"ok": False, "fehler": str(e), "anmeldung_noetig": True})
            gz["anmeldung_noetig"] = True
            bericht.oeffentlich("Garmin: Anmeldung nötig – bitte im Einrichtungsfenster neu anmelden.")
            bericht.fehler("Garmin", e)
        except Gebremst as e:
            gs.update({"ok": True, "fehler": "Garmin bremst gerade – weiter beim nächsten Abruf."})
            bericht.oeffentlich("Garmin: zu viele Anfragen, weiter beim nächsten Lauf.")
            bericht.fehler("Garmin", e)
        except Exception as e:
            gs.update({"ok": False, "fehler": f"Abruf fehlgeschlagen ({type(e).__name__})"})
            bericht.oeffentlich("Garmin: Abruf fehlgeschlagen (Details im App-Protokoll).")
            bericht.fehler("Garmin", e)
        finally:
            gz["tokens"] = sitzung.neue_tokens()
            if fz.get("zeitzone"):
                z["zeitzone"] = fz["zeitzone"]
            zustand_sichern()
        n = sammler.neu
        bericht.privat(f"Garmin: {n['tage']} Tageseinträge, {n['aktivitaeten']} neue Aktivitäten, "
                       f"{n['details']} Aktivitätsdetails, {n['verlaeufe']} Tagesverläufe, "
                       f"{n['historie']} Historienfenster ({sitzung.aufrufe} Abfragen)")
        akt = sammler._aktivitaeten()
        gs.update({
            "historie_fertig": bool(fz.get("historie_fertig")),
            "historie_bis": (fz.get("fruehester_tag") if fz.get("historie_fertig") else None) or fz.get("cursor", {}).get("tag"),
            "details_offen": sum(1 for a in akt.values() if not a.get("det")),
            "aktivitaeten": len(akt),
            "aktivitaeten_alle": bool(fz.get("akt_alle")),
        })
        gs["letzter_versuch"] = iso_jetzt(zz)
    else:
        gs.update({"verbunden": False})
    status["garmin"] = gs

    # ---- Abschluss ----
    sync_daten(ablage, z)
    zustand_sichern()
    tage.speichern()
    katalog = tage.katalog()
    ablage.schreiben("d/katalog.enc", katalog)
    protokoll = ablage.lesen("d/protokoll.enc") or {"zeilen": []}
    protokoll["zeilen"] = (protokoll.get("zeilen") or [])[-400:] + bericht.zeilen
    protokoll["zeilen"] = protokoll["zeilen"][-500:]
    ablage.schreiben("d/protokoll.enc", protokoll)
    ablage.speichern()
    verlaeufe = sorted(Path(p).stem for p in ablage.liste("d/tag"))
    w_daten = ablage.lesen("d/withings.enc") or {}
    index = {
        "app": VERSION, "stand": iso_jetzt(zz), "zeitzone": str(zz.key), "quellen": status,
        "jahre": katalog.get("jahre", []), "verlaeufe": verlaeufe,
        "zaehler": {
            "messungen": len(w_daten.get("messungen") or []),
            "aktivitaeten": len(((ablage.lesen("d/aktivitaeten.enc") or {}).get("liste")) or []),
            "ekg": len(((ablage.lesen("d/ekg.enc") or {}).get("liste")) or []),
            "metriken": len(katalog.get("werte", {})),
        },
        "eingerichtet": bool(wz or gz),
    }
    index["dateien"] = ablage.dateien()
    ablage.schreiben("d/index.enc", index)
    ablage.speichern()
    # Dateiliste im Index aktualisieren (der Index selbst ist nicht enthalten)
    return index


def sync_daten(ablage: Ablage, z: dict) -> None:
    """d/sync.enc: Zugang fuer den Sync-Knopf der App (nur mit dem Datenschluessel lesbar)."""
    sz = z.get("sync") or {}
    datei = ablage.ordner / "d" / "sync.enc"
    if sz.get("token"):
        ablage.schreiben("d/sync.enc", {
            "token": sz["token"],
            "repo": os.environ.get("GITHUB_REPOSITORY") or sz.get("repo"),
            "workflow": "gesundheit.yml",
            "zweig": os.environ.get("GITHUB_REF_NAME") or "main",
        })
    elif datei.exists():
        datei.unlink()


def seite_bauen(web: Path, ablage: Path, ziel: Path) -> None:
    if ziel.exists():
        shutil.rmtree(ziel)
    shutil.copytree(web, ziel)
    if (ablage / "d").exists():
        shutil.copytree(ablage / "d", ziel / "d")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Gesundheits-App: Daten abrufen und Webseite bauen")
    p.add_argument("--ablage", default="ablage", help="Ordner mit den verschlüsselten Daten")
    p.add_argument("--web", default="web", help="Ordner mit der Web-App")
    p.add_argument("--seite", default="_site", help="Zielordner für GitHub Pages")
    p.add_argument("--paket", default="zustand.enc", help="Hochgeladenes Anmeldepaket")
    p.add_argument("--frist", type=int, default=720, help="Sekunden für den Abruf")
    p.add_argument("--budget", type=int, default=GARMIN_BUDGET, help="max. Garmin-Abfragen")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.ERROR, stream=sys.stderr, format="%(levelname)s %(name)s")
    for name in ("garminconnect", "urllib3", "requests"):
        logging.getLogger(name).setLevel(logging.CRITICAL)

    haupt = os.environ.get("GESUNDHEIT_SCHLUESSEL", "").strip()
    if not haupt:
        print("Der Schlüssel fehlt: GitHub-Geheimnis GESUNDHEIT_SCHLUESSEL anlegen.", flush=True)
        return 2
    try:
        ableiten(haupt, "test")
    except Exception:
        print("Das GitHub-Geheimnis GESUNDHEIT_SCHLUESSEL ist ungültig.", flush=True)
        return 2

    bericht = Bericht()
    bericht.oeffentlich(f"Gesundheits-App {VERSION}: Abruf startet.")
    try:
        sammeln(Path(args.ablage), haupt, Path(args.paket) if args.paket else None,
                frist_sekunden=args.frist, budget=args.budget, bericht=bericht)
        print("Abruf fertig.", flush=True)
    except Exception as e:
        print(f"Abruf abgebrochen ({type(e).__name__}).", flush=True)
        if os.environ.get("GESUNDHEIT_DEBUG"):
            raise
    if args.web and Path(args.web).exists():
        seite_bauen(Path(args.web), Path(args.ablage), Path(args.seite))
        print("Webseite gebaut.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
