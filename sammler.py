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
VERSION = "1.2.6"
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
# Was die Geräte messen können (für die Bestandsliste im Protokoll und in der App)
WITHINGS_NAMEN = {
    1: "Gewicht", 5: "Fettfreie Masse", 6: "Körperfettanteil", 8: "Fettmasse", 9: "Blutdruck", 11: "Puls",
    12: "Temperatur", 54: "SpO₂", 71: "Körpertemperatur", 73: "Hauttemperatur",
    76: "Muskelmasse", 77: "Körperwasser", 88: "Knochenmasse", 91: "Pulswellengeschwindigkeit",
    123: "VO₂max", 130: "EKG-Auswertung", 135: "QRS-Intervall", 136: "PR-Intervall",
    137: "QT-Intervall", 138: "QTc-Intervall", 139: "Vorhofflimmern (PPG)", 155: "Gefäßalter",
    167: "Nervengesundheit", 168: "Extrazelluläres Wasser", 169: "Intrazelluläres Wasser", 170: "Viszeralfett",
    173: "Fettfreie Masse je Körperbereich", 174: "Fettmasse je Körperbereich", 175: "Muskelmasse je Körperbereich",
    226: "Grundumsatz", 227: "Stoffwechselalter", 229: "Hautleitfähigkeit",
}
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
    ("ftp", "get_cycling_ftp", ()),
    ("morgen_bereitschaft", "get_morning_training_readiness", ("heute",)),
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
    def __init__(self, text: str = "", status: int | None = None):
        super().__init__(text)
        self.status = status


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

    def entfernen(self, pfad: str) -> bool:
        """Eine Datei, die nicht mehr gebraucht wird, aus der Ablage loeschen. True, wenn es sie gab."""
        self._cache.pop(pfad, None)
        self._hash.pop(pfad, None)
        self._neu.discard(pfad)
        datei = self.ordner / pfad
        if datei.exists():
            datei.unlink()
            return True
        return False

    def dateien(self) -> dict[str, str]:
        """Pfad -> Kurzversion (aendert sich nur, wenn sich der Inhalt aendert)."""
        ergebnis = {}
        basis = self.ordner / "d"
        if basis.exists():
            for datei in sorted(basis.rglob("*.enc")):
                rel = datei.relative_to(self.ordner).as_posix()
                ergebnis[rel] = hashlib.sha256(datei.read_bytes()).hexdigest()[:10]
        return ergebnis