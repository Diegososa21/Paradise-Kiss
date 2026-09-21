# Anforderungen des Projektantrags

| Anforderung | Umsetzung |
|---|---|
| Zentrale Lagerverwaltung | Django-API und Supabase-Adapter vorbereitet. Zentraler Betrieb nach Zuordnung eurer vorhandenen Datenbank; bis dahin ausdrücklich lokaler Browserarbeitsbereich. |
| Benutzerfreundliche Oberfläche | Deutsche UI, feste Navigation, mobile Navigation, Suche, strukturierte Einzelansichten, native Dialoge, klar beschriftete Aktionen. |
| Artikel erfassen | Alle verlangten Felder plus SKU, Mindestbestand, Lagerort und optionale Preise. |
| Wareneingänge / Nachbestellungen | Separater Buchungsdialog und Nachbestellungsbereich. Eingang einer vollständigen Bestellung bucht Bestand und Bestellstatus gemeinsam. |
| Verkäufe ausbuchen | Eigene Buchungsart, Bestandsschutz und Buchungsverlauf. |
| Bestände jederzeit einsehen | Dashboard-Kennzahlen, filter-/sortierbare Artikeltabelle, Einzelansicht. |
| Regale / Fächer | Eigene Lagerortverwaltung mit Regal, Fach und optionaler Kapazitätsgrenze. |
| Bestände korrigieren | Inventurkorrektur mit Zählwert und Pflichtbegründung; gesamter Artikelbestand umlagerbar. |
| Letztes Verkaufs-/Einkaufsdatum | Artikelansicht und CSV-Export. |
| Stark / schwach nachgefragt | Mengenbasierte Ranglisten erfasster Verkäufe im gewählten Zeitraum; Hinweis auf fehlende Historie neuer Artikel. |
| Mindestbestand und E-Mail | Lokale Hinweise vollständig umgesetzt. Backend-Befehl für automatische Serverprüfung und SMTP-Versand vorbereitet; echte Verbindung, SMTP und Zeitplanung noch einzurichten. |
| Datenbank | Bewusst keine angelegt. Feldmapping und dokumentierter RPC-Vertrag für eure Datenbanken. |
| Modular / erweiterbar | UI, Fachlogik, Datenspeicherung, API und Adapter getrennt. Keine Frontend-Framework-Abhängigkeiten. |
| Miami-Pink / Liquid Glass | Rosé-/Flieder-Farbvariablen, transparente Glasflächen, eigene Miami-Illustration, alternative Kontraste. |
| Dashboard anpassbar | Eigener Titel und Beschreibung, wählbare Kennzahlen, Sichtbarkeit und Reihenfolge der Bereiche; ohne Drag-and-drop, auch per Tastatur. |
| Grafische Darstellung / Datenquelle | Konfigurierbare Balken-/Liniendiagramme, auswählbare Quelle, Kennzahl, Gruppierung, Zeitraum und Datentabelle. |
| Eigene Daten / keine Testdaten | App startet leer. Testobjekte existieren nur in isolierten Prüfungen, nie als Seed. |
| Optional: externe KI-Bestellvorschläge | Bewusst kein Bestandteil des Pflichtumfangs. Keine externe KI angebunden und keine Daten übertragen. Erweiterbar über eine zusätzliche Django-Servicefunktion. |

## Zusätzliche Funktionen

Archiv statt Verlust des Buchungsverlaufs, JSON-Sicherungen mit geprüfter Wiederherstellung, CSV mit Schutz vor Tabellenformeln, Druckansicht, Tastaturkürzel `/`, reduzierte Bewegung, Kontrastmodus, kompakte Tabellen, Kapazitätskontrolle, ungespeicherte Änderungen erkennen und Schreibfehler sichtbar melden.

## Fachliche Festlegungen

- Eine Artikelvariante liegt in diesem Grundaufbau an genau einem Lagerort. Aufteilung desselben Artikels auf mehrere Fächer erfordert später separate Bestandspositionen.
- Umlagerung bewegt den gesamten Variantenbestand. Teilumlagerungen und Teilanlieferungen sind noch kein Workflow.
- Nachbestellungen sind interne Planung; es wird keine Bestellung extern versendet.
- Bestandskorrekturen behalten alte Bewegungen bei. Keine Löschung vergangener Buchungen über die Oberfläche.
- E-Mail-Schwellenmeldungen sind konfigurationsabhängig. Im lokalen Modus gibt es ausschließlich Hinweise innerhalb der Anwendung.
- Einstellungen und Dashboard-Konfiguration gelten pro Browser. Gemeinsame Team-Einstellungen könnten später in eurer Datenbank gespeichert werden.
- Der Browser lädt die Quelle vollständig; bei großen Datenmengen sind serverseitige Suche und Aggregation der nächste Ausbauschritt.
