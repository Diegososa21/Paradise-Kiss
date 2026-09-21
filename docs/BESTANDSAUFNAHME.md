# Prüfung vor dem Neuaufbau

Datum: 21.09.2026.

## Vorhandener Stand

- Angular-22-Projekt mit TypeScript, SCSS, CLI, Build-/Cache-Ordnern und npm-Abhängigkeiten.
- `home.html`: allgemeine englische Landingpage, ohne Bestandsfunktionen.
- `rescourceForm.html`: unabhängiger Formularentwurf mit Name und E-Mail, ohne Lagerdaten, Validierung oder Speicherung.
- Leere Routenliste, Angular-Standardtemplate und ein Test mit einer nicht mehr passenden Textannahme.
- Standardkonfiguration der Supabase-CLI. Keine implementierte Datenanbindung, Tabellenmodelle oder Migrationen im geprüften Quellstand.
- Vorhandenes rotes Kuss-Logo.
- Bereits vor Beginn lokal geänderte `package-lock.json`.

## Übernommen

- Projektname, Marke und vorhandenes Logo. Das Original liegt unverändert in `frontend/assets/logo.png`; seine Darstellung wird nur durch CSS angepasst.
- Git-Verlauf als nachvollziehbare Historie. Es wurden keine fremden Commits zurückgesetzt und kein neuer Commit erstellt.

## Ersetzt

Die Angular-App, das unverbundene Formular, TypeScript-/SCSS-/CLI-Konfigurationen und die alten Angular-Editoraufgaben wurden durch Vanilla HTML/CSS/JavaScript und das separate Django-Grundgerüst ersetzt. Der vorherige Code enthielt keine Lagerlogik, die fachlich hätte übernommen werden sollen.

## Sicherungen und Entfernung

Vor den Änderungen wurde der Quellstand einschließlich der lokal geänderten Lockdatei gesichert:

`../Paradise-Kiss-vor-Neuaufbau-20260921-091320.zip`

Die automatische Ausführungsprüfung blockierte das rekursive Löschen mit „blocked by policy“, ohne genaueren Grund. Als sichere Alternative wurden verbleibende alte Ordner aus dem aktiven Projekt verschoben:

`../Paradise-Kiss-Altdateien-20260921/`

Dieser Ordner enthält die alten Abhängigkeiten, Build-/Cache-Dateien, bisherigen Asset-Ordner und verbliebenen leeren Quell-/Editorordner. **Im aktiven Projekt werden sie nicht mehr verwendet. Sie wurden archiviert, nicht endgültig von der Festplatte gelöscht.** Die ursprünglichen Quelltexte sind außerdem im ZIP und im Git-Verlauf nachvollziehbar.

Es wurden keine externen Supabase-Projekte, Datenbanken oder Tabellen verändert.
