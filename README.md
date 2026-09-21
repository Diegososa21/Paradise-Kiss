# Paradise Kiss · Inventory Studio

Ein übersichtliches Lagersystem für das Schulprojekt: **Vanilla JavaScript, HTML und CSS**, ein eigenständiges **Django-Backend** und ein vorbereiteter Adapter für **eure bestehenden Supabase-Datenbanken**. Rosé, Flieder, Türkis und transparente Glasflächen prägen das responsive Design.

**Keine Beispieldaten. Keine angelegte Datenbank. Keine Migrationen. Keine Verbindung zu einem externen Projekt ohne eure Konfiguration.**

## Schnell starten

### Oberfläche ohne Backend

Python ab 3.10 installieren. Im Projektordner:

```powershell
python -m http.server 4200 --bind 127.0.0.1 --directory frontend
```

Öffnen: **http://127.0.0.1:4200**. Alternativ `npm start`; es werden keine npm-Abhängigkeiten benötigt.

Der lokale Arbeitsbereich ist anfangs leer. Eigene Eingaben werden im `localStorage` dieses Browsers gespeichert. Ein anderer Browser, ein anderes Gerät oder ein anderer Port hat einen **separaten** Arbeitsbereich. Regelmäßig unter Einstellungen eine JSON-Sicherung herunterladen. Es gibt keine automatische Synchronisierung zur Datenbank.

### Mit Django

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

Öffnen: **http://127.0.0.1:8000**. Django liefert Frontend und API unter derselben Adresse. **Kein `migrate`, `makemigrations` oder `createsuperuser` ausführen.** Das Backend verwendet keine Django-ORM-Datenbank und kein Django-Admin.

In diesem Arbeitsstand wurde `.venv` bereits angelegt. Der Entwicklungsserver ist nur für lokale Entwicklung gedacht. Für eine Veröffentlichung müssen HTTPS, ein geeigneter WSGI-/ASGI-Server, sichere Umgebungsvariablen, Rate Limits und eure Zugriffsregeln eingerichtet werden.

## Was funktioniert?

- Artikel pro Variante anlegen und bearbeiten: Artikelnummer, Name, Beschreibung, Größe, Material, Gender, Hersteller, Anfangsbestand, Mindestbestand, Lagerort und optionale Preise.
- Bestände durchsuchen, filtern, sortieren und als CSV exportieren; 15 Artikel pro Tabellenseite.
- Separate Artikelseite mit Details und Buchungsverlauf; Archivieren und Wiederherstellen.
- Wareneingang, Verkauf, sonstiger Ausgang, Inventurkorrektur und vollständige Umlagerung; keine negativen Bestände oder gebrochenen Stückzahlen.
- Regale und Fächer mit optionaler Kapazitätsgrenze verwalten.
- Nachbestellungen intern planen, stornieren und vollständig entgegennehmen. Der Wareneingang erhöht den Bestand und schließt die Bestellung in einem Vorgang.
- Mindestbestandswarnungen, Lagerwert und Nachfrage-Auswertungen.
- Dashboard-Titel und Beschreibung bearbeiten, Kennzahlen auswählen, Bereiche ein-/ausblenden und mit Pfeiltasten umordnen.
- Diagrammtitel, Datenquelle, Kennzahl, Gruppierung, Zeitraum und Balken-/Liniendarstellung einstellen. Datentabelle und CSV-Export der Diagrammwerte.
- Kontrast, kompakte Tabellen, reduzierte Animation, Farbwelt, Druckansicht, Tastaturbedienung.
- JSON-Sicherung und validierte Wiederherstellung des lokalen Arbeitsbereichs mit Bestätigung.
- Django-API, Supabase-Anmeldung, mehrere registrierbare Quellen und konfigurierbare Feldzuordnung.
- Vorbereiteter serverseitiger E-Mail-Befehl für Mindestbestände, inklusive Vorschau und Wiederholungsschutz. Versand und Zeitplanung müssen eingerichtet werden.

## Projektaufbau

```text
frontend/
  index.html                 App-Rahmen und Navigation
  css/styles.css             Designvariablen, Glasflächen, Responsive-Regeln
  assets/                    Übernommenes Logo, Miami-Illustration, Favicon
  js/app.js                  Navigation, Ereignisse und Formularspeicherung
  js/views.js                Einzelne Seiten und Formulare
  js/dialogs.js              Bearbeitungs- und Einstellungsfenster
  js/domain.js               Reine Lagerregeln, Filter und Auswertungen
  js/store.js                LocalRepository und ApiRepository
  js/charts.js               SVG-Diagramm und zugängliche Datentabelle
  js/ui.js, icons.js          Kleine wiederverwendbare UI-Helfer
backend/
  manage.py
  config/                    Django-Einstellungen, URLs, WSGI und ASGI
  inventory/                 API, Validierung, Supabase-Adapter, Warnungen
  data_sources.example.json  Zuordnungsvorlage, keine Datenbankdefinition
  requirements.txt           Festgeschriebene Python-Versionen
docs/
  ANBINDUNG.md                Datenvertrag und Integration
  ANFORDERUNGEN.md            Abdeckung der Projektanforderungen
  BESTANDSAUFNAHME.md         Bewertung des vorherigen Projekts
  PRUEFUNG.md                Prüfumfang und verbleibende Integrationsschritte
tests/                       Isolierte Tests ohne produktive Beispieldaten
```

## Eure Datenbanken anschließen

Siehe **[docs/ANBINDUNG.md](docs/ANBINDUNG.md)**. Der Adapter führt kein SQL zur Schemaerstellung aus. Ihr ordnet vorhandene Tabellen/Views zu. Schreibzugriffe benötigen eine vorhandene, an euren Datenbestand angepasste transaktionale RPC-Funktion. Solange diese nicht zugeordnet ist, bleibt eine Quelle nur lesbar.

Es wird ausschließlich der Publishable Key zusammen mit dem Benutzer-Access-Token verwendet; **kein Service-Role-Key**. Eure Supabase-Zugriffsregeln bleiben maßgeblich. Die Anmeldung wird nur im Arbeitsspeicher des Tabs gehalten und verfällt beim Neuladen.

## Erweitern

- **Farben, Abstände, Schriften:** Variablen am Anfang von `frontend/css/styles.css`.
- **Neues Artikelfeld:** Form in `views.js`, Validierung in `domain.js` und `backend/inventory/validation.py`, Snapshot-Vertrag und Feldzuordnung ergänzen.
- **Andere Datenbank/API:** Die Methoden von `LocalRepository`/`ApiRepository` beibehalten und einen weiteren Backend-Adapter ergänzen.
- **Neues Diagramm:** Aggregation in `domain.js`, Auswahl in `charts.js` und Anzeige in `dialogs.js`.
- **Größere Bestände:** Suche, Seitennavigation und Aggregation später auf den Server verlagern. Der Starter lädt die Datensätze einer Quelle vollständig; der Adapter lehnt mehr als 100.000 Zeilen pro Sammlung ab, statt unvollständige Kennzahlen anzuzeigen.

## Prüfen

```powershell
node --test tests/*.test.js
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py test inventory
```

Die Testobjekte existieren nur im isolierten Testspeicher. Django verwendet `SimpleTestCase`; es wird **keine Testdatenbank** angelegt. Der Browser-Prüflauf ist optional und nur für einen separaten QA-Browser vorgesehen; siehe `docs/PRUEFUNG.md`.
