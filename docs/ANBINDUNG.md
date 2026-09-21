# Django an eure vorhandenen Datenbanken anbinden

## 1. Architektur und Grenzen

```text
Browser (HTML / CSS / JavaScript)
  ├─ Lokaler Arbeitsbereich → localStorage, ausschließlich eigene Eingaben
  └─ Datenquelle → Django /api/ → Supabase REST + Benutzer-Token
                                    ├─ vorhandene Tabellen / Views lesen
                                    └─ vorhandene RPC für atomare Änderungen
```

`DATABASES = {}` in Django ist beabsichtigt. Es gibt keine ORM-Modelle, Migrationen, SQLite-Datei, Seeds oder Demo-Daten. Django ist API- und Validierungsschicht. Tabellen, RLS-Regeln und RPCs bleiben in eurer Verantwortung und werden hier nicht erzeugt.

Die lokale Speicherung ist für einen einzelnen Browserarbeitsplatz gedacht. Im Browser werden Änderungen unter einem Web Lock ausgeführt; andere Tabs desselben Ursprungs lesen vor dem Schreiben den aktuellen Stand. Für Teamarbeit verwendet die angebundene Datenbank.

## 2. Quelle registrieren

1. Kopiert `backend/data_sources.example.json` nach `backend/data_sources.json`.
2. Ersetzt die Tabellennamen durch eure vorhandenen Tabellen oder passende Views. Entfernt nicht benötigte Sammlungen; sie werden als leere Listen geliefert. Für vollständige Lagerfunktionen benötigt ihr alle vier Sammlungen.
3. Links im Objekt `fields` stehen die Namen, die die Anwendung erwartet. Rechts stehen **eure** Spaltennamen. Zum Beispiel: `"name": "artikel_name"`, `"quantity": "bestand"`.
4. Legt Umgebungsvariablen im Serverprozess fest. Das Backend liest **keine `.env`-Datei automatisch**. `backend/.env.example` dokumentiert die Namen.

```powershell
$env:SUPABASE_URL = 'https://EUER-PROJEKT.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY = 'EUER-PUBLISHABLE-KEY'
$env:DJANGO_DEBUG = 'true'
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

Keine Schlüssel in Git, Screenshots oder Browser-Einstellungen kopieren. Der Publishable Key allein erteilt keine Benutzerrechte. Das Frontend meldet den Benutzer über Django bei Supabase an; danach wird der Access-Token als `Authorization: Bearer …` weitergereicht. Refresh-Tokens und Passwörter werden nicht gespeichert. Nach Neuladen oder Ablauf ist eine erneute Anmeldung nötig. Der Grundaufbau unterstützt E-Mail/Passwort; SSO, MFA und CAPTCHA müssten passend zu eurer Auth-Konfiguration ergänzt werden.

Mehrere Quellen sind weitere Einträge in `sources`, mit eigener `id`, `label`, `url_env`, `key_env`, Tabellenzuordnung und optionaler RPC. `local` ist als Quell-ID reserviert. Die Datei `data_sources.json` ist durch `.gitignore` ausgeschlossen.

Öffnet die Anwendung **über Django auf Port 8000**, dann Einstellungen → Verbindungen prüfen → Verbinden. Ein Wechsel der Datenquelle überträgt keine lokalen Daten. CSV-/JSON-Exporte ermöglichen eine kontrollierte Übernahme durch euer eigenes Importverfahren.

## 3. Datenvertrag

`GET /api/snapshot/?source=<id>` liefert:

```json
{"version": 1, "products": [], "locations": [], "movements": [], "orders": []}
```

Die Listen sind hier bewusst leer. Folgende Felder werden erwartet:

| Sammlung | Felder |
|---|---|
| `products` | `id`, `sku`, `name`, `description`, `size`, `material`, `gender`, `manufacturer`, `quantity`, `min_stock`, `location_id`, `purchase_price`, `sale_price`, `archived`, `created_at`, `updated_at`, `last_sale_at`, `last_purchase_at` |
| `locations` | `id`, `name`, `shelf`, `bin`, `capacity` |
| `movements` | `id`, `product_id`, `type`, `quantity`, `delta`, `stock_after`, `occurred_at`, `note`, `reference`, `from_location_id`, `to_location_id` |
| `orders` | `id`, `product_id`, `quantity`, `expected_date`, `status`, `created_at`, `note` |

- IDs werden als Zeichenketten ausgegeben. Numerische Datenbank-IDs werden konvertiert. Verweise müssen zum zugehörigen Datensatz passen. Für Sicherungsimport unterstützt der Starter Buchstaben, Ziffern, `_` und `-` in IDs.
- Artikel: SKU, Name, Größe, Material, Gender und Hersteller sind Pflicht. Ein Artikel entspricht einer Größen-/Materialvariante. SKU muss eindeutig sein, auch im Archiv.
- Mengen, Mindestbestände und Kapazitäten sind ganze, nicht negative Stückzahlen bis 1.000.000.000.
- `capacity = 0` bedeutet unbegrenzt. `location_id = ""` bedeutet nicht zugeordnet.
- Preise sind nicht negative EUR-Beträge. Fehlende Preise werden mit 0 ausgewertet; ein Lagerwert ohne gepflegte Einkaufspreise ist entsprechend unvollständig.
- `archived` ist ein echtes Boolean. Artikel mit Bestand oder offenen Bestellungen dürfen nicht archiviert werden.
- Zeitpunkte verwenden ISO 8601, möglichst UTC. `created_at` bei Artikeln ist erforderlich; `updated_at` kann auf diesen Wert zurückfallen. Letzte Einkaufs-/Verkaufszeitpunkte dürfen `null` sein.
- `type`: `initial`, `inbound`, `sale`, `outbound`, `correction`, `transfer`.
- `delta` ist die vorzeichenbehaftete Bestandsänderung. `stock_after` ist der Bestand direkt nach der Buchung. `quantity` ist die Eingabemenge; bei Korrektur der gezählte Gesamtbestand, bei Transfer der gesamte verschobene Bestand.
- Bestellstatus: `open`, `received`, `cancelled`. Lieferdatum: `YYYY-MM-DD` oder leer.
- Optional nicht zugeordnete Felder erhalten nur fachlich neutrale Standardwerte (leerer Text, 0, false oder null), keine erfundenen Artikel oder Buchungen.

Das Beispiel-Mapping umfasst alle Felder. Wenn euer Schema anders strukturiert ist, verwendet geeignete Views oder passt `normalization.py` an. Achtet bei Views darauf, dass sie die Zugriffsrechte der angemeldeten Person berücksichtigen.

## 4. Atomare Schreibzugriffe

Der Starter schreibt **nicht** in mehreren unabhängigen REST-Anfragen zuerst den Bestand und danach die Bewegung. Jede Änderung läuft über genau **eine** von euch bereitgestellte Datenbankfunktion. Der konfigurierte `command_rpc`-Name bleibt bis zu eurer Einrichtung leer; dann sind Schreibversuche ausdrücklich gesperrt.

Die vorhandene Funktion muss folgende JSON-Parameter akzeptieren:

```text
action: text
payload: jsonb
```

Django ruft `POST /rest/v1/rpc/<command_rpc>` mit `{"action": ..., "payload": ...}` auf. Die Funktion soll ein JSON-Objekt zurückgeben; bei Artikelanlage/-änderung mindestens `{"id": "..."}`. Es werden keine SQL-Funktionen in diesem Projekt angelegt.

| Aktion | `payload` nach Django-Validierung |
|---|---|
| `create_product` | Artikelstammdaten, `quantity`, `min_stock`, Preise, `location_id` |
| `update_product` | `id`, Stammdaten, `min_stock`, Preise; **ohne** Bestand/Lagerort |
| `create_location` | `name`, `shelf`, `bin`, `capacity` |
| `update_location` | zusätzlich `id` |
| `book_movement` | `product_id`, `type`, `quantity`, `note`, `reference`, `to_location_id`, `order_id` |
| `create_order` | `product_id`, `quantity`, `expected_date`, `note` |
| `cancel_order` | `id` |
| `archive_product` | `id`, `archived` |

Eure Funktion muss innerhalb derselben Transaktion:

1. Benutzerberechtigung und Schreibrechte prüfen; keine Rollen aus veränderbaren Benutzer-Metadaten ableiten.
2. Betroffene Artikel-/Bestellzeilen sperren oder gleichwertige atomare Bedingungen verwenden. Bei Kapazitätsgrenzen auch den Lagerort berücksichtigen.
3. Alle Fachregeln nochmals prüfen: aktive Artikel, eindeutige SKU/Regal-Fach-Kombination, ganze Mengen, Mindestmenge, nicht negativer Bestand, freie Kapazität und gültige Referenzen.
4. Anfangsbestand bei Anlage als `initial` protokollieren; bei `sale` Menge abziehen und letzten Verkaufszeitpunkt setzen; bei `inbound` addieren und letzten Einkaufszeitpunkt setzen; bei `correction` den Gesamtbestand ersetzen und Differenz protokollieren; bei `transfer` den gesamten Bestand zum Ziel-Lagerort verschieben.
5. Bei `order_id` nur eine noch offene passende Bestellung mit exakt ihrer gesamten Menge einbuchen und gleichzeitig auf `received` setzen. Doppelten Wareneingang abweisen.
6. Buchung und Zeitstempel speichern. Vergangene Buchungen unverändert erhalten. Archivierung nur mit Bestand 0 und ohne offene Bestellung zulassen.
7. Bei Fehlern die gesamte Transaktion zurückrollen. Die API führt keine automatischen Wiederholungen von Schreibanfragen durch. Nach einem Netzwerkabbruch vor einer Wiederholung Bestand und Verlauf prüfen; für den Produktivbetrieb zusätzlich fachliche Idempotenzschlüssel in euren Vertrag aufnehmen.

Die lokalen Implementierungen in `store.js` und Regeln in `domain.js` zeigen diese Abläufe lesbar. Sie ersetzen keine serverseitigen Datenbankregeln.

## 5. Konsistente Auswertungen und mehrere Quellen

Bei Tabellenzugriffen liest der Adapter alle Seiten anhand der exakten `Content-Range`-Gesamtzahl. Er zeigt keine unvollständige erste Seite als Gesamtbestand. Die vier Sammlungen werden nacheinander gelesen; bei gleichzeitigem Betrieb ist das keine gemeinsame Datenbank-Snapshot-Transaktion.

Für konsistente Auswertungen könnt ihr deshalb `snapshot_rpc` auf eine vorhandene lesende Funktion setzen. Diese muss den kompletten obigen Snapshot in einer konsistenten Transaktion liefern und dieselben Benutzerrechte beachten. Sie hat keine Parameter.

Im Diagramm ist die Datenquelle unabhängig vom aktiven Artikelarbeitsbereich wählbar. Meldet euch zuerst an der betreffenden Quelle an. Anschließend könnt ihr zum anderen Arbeitsbereich zurückkehren und die bereits angemeldete Quelle nur im Diagramm verwenden.

Kennzahlen: aktueller Bestand, Lagerwert zum Einkaufspreis, verkaufte Stück und eingegangene Stück. Gruppierung: Hersteller, Gender, Größe, Material, Lagerort oder bei Bewegungen Tag. Zeitraum gilt nur für Bewegungen. Die Tagesgruppierung nutzt UTC-Datumsschlüssel; Tagesgrenzen einer lokalen Zeitzone wären bei Bedarf serverseitig anzupassen. Balken zeigen maximal 12 Gruppen, Linien maximal die letzten 30 vorhandenen Gruppen; alle Werte stehen in Tabelle/Export. Tage ohne Bewegung werden nicht künstlich ergänzt.

## 6. Mindestbestand und E-Mail

Die Oberfläche meldet aktive Artikel, deren Bestand **kleiner** als ihr Mindestbestand ist. `0` deaktiviert diese Schwelle für einen Artikel. Sofortige lokale Hinweise funktionieren ohne Backend; E-Mails benötigen den Server.

Der Befehl `check_stock_alerts` ist vorbereitet. Konfiguriert SMTP, Absender, Empfänger und ein dediziertes Konto mit Leserechten auf die erforderlichen Bestandsdaten. `INVENTORY_ALERT_EMAIL` und `INVENTORY_ALERT_PASSWORD` werden nur aus Server-Umgebungsvariablen gelesen; alternativ ist ein aktuelles `INVENTORY_ALERT_TOKEN` möglich. Keine Service-Role-Schlüssel verwenden.

```powershell
# Vorschau: kein Versand, keine Statusdatei wird geschrieben
.\.venv\Scripts\python.exe backend/manage.py check_stock_alerts --source hauptlager --state 'C:\EuerServer\alert-state.json'

# Versand nach vollständiger Einrichtung
.\.venv\Scripts\python.exe backend/manage.py check_stock_alerts --source hauptlager --state 'C:\EuerServer\alert-state.json' --send
```

Je Quelle eine separate Statusdatei verwenden. Sie enthält nur IDs bereits gemeldeter Artikel, keine Zugangsdaten. Erst nach erfolgreichem SMTP-Versand wird sie atomar aktualisiert. Erholt sich ein Bestand, kann ein späteres Unterschreiten erneut gemeldet werden. Eine Sperrdatei verhindert parallele Läufe. Bei Prozessabbruch nach SMTP-Versand und vor Statusspeicherung ist eine erneute Nachricht möglich; für garantierte Zustellung/Idempotenz später eine Outbox in eurem bestehenden Backend integrieren.

Für automatische Benachrichtigungen müsst ihr den Befehl in eure bestehende Server-Zeitplanung aufnehmen, beispielsweise alle 15 Minuten. **In diesem Projekt wurde keine geplante Aufgabe angelegt und keine E-Mail versendet.**

## 7. Referenzen und Prüfungen vor Team-Einsatz

- [Supabase Data REST API](https://supabase.com/docs/guides/api): REST-Zugriff und API-Struktur.
- [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys): Publishable Keys und Benutzer-Authentifizierung.
- [Supabase Auth OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml): Passwort-Anmeldeendpunkt.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): Rechte auf Zeilen, Views und Funktionen.
- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/): produktive Serverkonfiguration.

Vor Team-Einsatz mit euren echten Rechten prüfen: Lesen mit zwei Benutzern, gesperrter Fremdzugriff, parallele Verkäufe auf den letzten Artikel, volle Lagerorte, doppelte Lieferung, Netzwerkabbruch und Wiederanmeldung. Diese Prüfungen können ohne eure Datenbank und Zugänge nicht live ausgeführt werden.
