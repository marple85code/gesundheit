# Gesundheit

Persönliche Web-App mit allen Daten von Withings und Garmin Connect.

- **App öffnen:** über den Link bzw. QR-Code aus dem Einrichtungsfenster (GitHub Pages).
- **Abruf:** stündlich über GitHub Actions (Ablauf „Gesundheit“), sofort mit dem Sync-Knopf in der App oder unter *Actions → Gesundheit → Run workflow*.
- **Neue App-Version:** Der Ablauf „App veröffentlichen“ stellt sie nach dem Hochladen sofort online, ohne auf den Abruf zu warten. Die App lädt sie beim nächsten Öffnen selbst.
- **Datenschutz:** Alle Gesundheitsdaten liegen nur verschlüsselt (AES-256-GCM) im Zweig `daten`.
  Der Schlüssel steht im Repository-Geheimnis `GESUNDHEIT_SCHLUESSEL` und auf deinen Geräten.
  Die Protokolle der Abläufe enthalten keine Messwerte. Der Token des Sync-Knopfs liegt ebenfalls nur verschlüsselt vor und darf nur Abläufe starten.

- **Wiederherstellen:** Der Ablauf „Wiederherstellen“ wird nur vom Einrichtungsfenster benutzt, wenn dort die Einrichtungsdaten fehlen.
  Er gibt den Schlüssel ausschließlich verschlüsselt für das anfragende Fenster zurück.

Eingerichtet und gepflegt mit dem Einrichtungsfenster (`einrichtung.py`) auf dem Chromebook.
