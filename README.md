# Gesundheit

Persönliche Web-App mit allen Daten von Withings und Garmin Connect.

- **App öffnen:** über den Link bzw. QR-Code aus dem Einrichtungsfenster (GitHub Pages).
- **Abruf:** stündlich über GitHub Actions (Ablauf „Gesundheit“), sofort mit dem Sync-Knopf in der App oder unter *Actions → Gesundheit → Run workflow*.
- **Datenschutz:** Alle Gesundheitsdaten liegen nur verschlüsselt (AES-256-GCM) im Zweig `daten`.
  Der Schlüssel steht im Repository-Geheimnis `GESUNDHEIT_SCHLUESSEL` und auf deinen Geräten.
  Die Protokolle der Abläufe enthalten keine Messwerte. Der Token des Sync-Knopfs liegt ebenfalls nur verschlüsselt vor und darf nur Abläufe starten.

Eingerichtet und gepflegt mit dem Einrichtungsfenster (`einrichtung.py`) auf dem Chromebook.
