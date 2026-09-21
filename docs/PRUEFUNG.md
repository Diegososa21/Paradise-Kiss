# Prüfprotokoll

Stand: 21.09.2026. Getestet unter Windows mit Node 24.19.0, Python 3.14.3, Django 5.2.17 und einem separaten Chromium-Browser über agent-browser.

## Automatisierte Prüfungen

- **13 JavaScript-Tests:** leerer Start, Anlage und Anfangsbuchung, doppelte SKU, Verkauf, Überverkauf, Mengenvalidierung, Inventur, Kapazitäten, Umlagerung, sichere Stammdatenänderung, Bestelleingang, Schutz gegen doppelten Eingang, Archivierung, Diagrammaggregation, Sicherungsvalidierung, Wiederherstellung beschädigten Speichers, CSV-Escaping und Speicherfehler.
- **16 Django-Tests:** datenbankloser Start, Frontend-Auslieferung, keine Geheimnisse in der Quellenliste, HTTP-/JSON-/Origin-Prüfung, Anmeldepflicht, Feld-Allowlist, unveränderte Passwörter, Mengenprüfung, keine Bestandsänderung über Stammdaten, vollständige REST-Pagination, fehlende Zeilenzahlen, gesperrte Schreibzugriffe ohne RPC, Mindestbestand, Normalisierung, E-Mail-Vorschau, Versand-Deduplizierung und Verhalten bei SMTP-Fehlern.
- **Django System Check:** keine Beanstandungen.

Der E-Mail-Versand wurde ausschließlich mit einem Mock geprüft. Es wurden keine echten E-Mails versendet. Die Python-Prüfungen verwenden `SimpleTestCase` ohne Datenbank; temporäre Dateien enthalten nur den Benachrichtigungsstatus der Tests.

## Im Browser geprüfter Bedienablauf

16 erfolgreiche Assertions im zusammenhängenden UI-Ablauf:

1. Lagerort über das Formular anlegen.
2. Artikel mit Anfangsbestand erfassen.
3. HTML-Zeichen in Artikelnamen als ungefährlichen Text darstellen.
4. Überverkauf abweisen, ohne Daten zu verändern.
5. Verkauf buchen und Verlauf erzeugen.
6. Mindestbestandswarnung anzeigen.
7. Nachbestellung planen und Wareneingang abschließen.
8. Artikelbeschreibung ändern.
9. Dashboard-Bereiche ausblenden und Reihenfolge speichern.
10. Dashboard-Titel und Kennzahlenauswahl ändern.
11. Die tatsächlich gebuchte Verkaufsmenge im Liniendiagramm anzeigen.
12. Nach Mindestbestand filtern.
13. Filter zurücksetzen.
14. Bestand per Inventur auf null korrigieren und Artikel archivieren.
15. Artikel wieder aktivieren.
16. Kontrast und kompakte Tabellen anwenden.

Die synthetischen Eingaben werden nur im eigenen QA-Browser erzeugt. Danach stellt der Prüflauf den ursprünglichen Browser-Speicher wieder her. Der ausgelieferte Arbeitsbereich bleibt leer.

## Responsive Darstellung und Tastatur

- Dashboard visuell auf 1440 × 1050 und 390 × 844 Pixel geprüft.
- Alle neun Haupt-/Formularansichten bei 320 Pixel Breite kontrolliert: kein horizontaler Seitenüberlauf. Breite Datentabellen haben einen eigenen Scrollbereich.
- Mobile Navigation öffnen, mit Escape schließen und Fokus zum Menüknopf zurückgeben.
- Verborgene mobile Navigation ist `inert` und nicht per Tab erreichbar.
- „Zum Inhalt springen“ setzt den Fokus in den Hauptbereich, ohne die Seitenroute zu verändern.
- Native Dialoge begrenzen den Fokus und unterstützen Escape.
- Keine JavaScript-Fehler im getesteten Browserablauf.

## Live geprüfte lokale API

- `GET /api/status/`: `status=ready`, `database_created=false`, `email_ready=false`.
- `GET /api/sources/`: leere Quellenliste, solange keine eigene Konfiguration existiert.
- Frontend und JavaScript-Module werden mit passenden Content-Types geliefert.

## Noch mit eurer Integration zu prüfen

Eine reale Supabase-Anmeldung, eure Tabellenzuordnung, RLS-Berechtigungen, eure transaktionale RPC, parallele Buchungen mehrerer Benutzer und die SMTP-Zustellung sind **nicht live verifiziert**, weil keine echte Datenbank oder Zugangsdaten konfiguriert wurden. Dafür wurde nichts angelegt oder verändert. Anleitung: [ANBINDUNG.md](ANBINDUNG.md).

Der UI-Prüflauf ist bei Bedarf reproduzierbar. Nur in einem eigenen QA-Browser ausführen; danach neu laden:

```powershell
npx --yes agent-browser@0.38.1 --session paradise-qa open http://127.0.0.1:8000
Get-Content tests/browser-check.js -Raw | npx --yes agent-browser@0.38.1 --session paradise-qa eval --stdin
npx --yes agent-browser@0.38.1 --session paradise-qa reload
npx --yes agent-browser@0.38.1 --session paradise-qa close
```

Der Test verwendet Browserinteraktionen und einen isolierten Speicher. Er ersetzt keine Prüfung der echten Datenbanktransaktionen.
