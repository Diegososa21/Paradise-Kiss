import { icon } from "./icons.js";
import { activeProducts } from "./domain.js";
import { DEFAULT_SETTINGS } from "./store.js";
import {
  escapeHtml as e,
  number,
  button,
  link,
  field,
  showDialog,
  emptyState,
  toast,
} from "./ui.js";
import {
  WIDGET_TITLES,
  METRIC_TITLES,
  bookingForm,
  orderForm,
} from "./views.js";
import { METRICS, GROUPS } from "./charts.js";

const footer = (label = "Speichern") =>
  `<div class="modal-footer">${button("Abbrechen", "close-dialog")}<button class="button primary" type="submit">${icon("check")}${label}</button></div>`;
export function dashboardSettings(ctx) {
  const order = [
    ...ctx.settings.widgets,
    ...DEFAULT_SETTINGS.widgets.filter(
      (w) => !ctx.settings.widgets.includes(w),
    ),
  ];
  showDialog(
    "Dein Dashboard gestalten",
    "Bereiche auswählen und mit den Pfeilen in die gewünschte Reihenfolge bringen.",
    `<form id="dashboard-form"><p class="form-error" role="alert"></p><div class="widget-list">${order.map((id) => `<div class="widget-row" data-widget="${id}"><label><input type="checkbox" name="${id}" ${ctx.settings.widgets.includes(id) ? "checked" : ""}>${WIDGET_TITLES[id]}</label><button type="button" class="icon-button" data-action="widget-up" aria-label="${WIDGET_TITLES[id]} nach oben">${icon("arrow-up")}</button><button type="button" class="icon-button" data-action="widget-down" aria-label="${WIDGET_TITLES[id]} nach unten">${icon("arrow-down")}</button></div>`).join("")}</div><div class="info-callout">Die Auswahl gilt für diesen Browser. Kennzahl und Datenquelle wählst du direkt im Diagramm.</div>${footer("Dashboard speichern")}</form>`,
  );
  const form = document.getElementById("dashboard-form");
  form
    .querySelector(".widget-list")
    .insertAdjacentHTML(
      "beforebegin",
      `<div class="form-grid">${field("dashboardTitle", "Dashboard-Titel", ctx.settings.dashboardTitle, { required: true, full: true })}${field("dashboardSubtitle", "Beschreibung", ctx.settings.dashboardSubtitle, { required: true, full: true })}</div><h3 style="margin-top:24px">Bereiche & Reihenfolge</h3>`,
    );
  form.querySelector(".info-callout").insertAdjacentHTML(
    "beforebegin",
    `<h3 style="margin-top:24px">Deine Kennzahlen</h3><div class="metric-options">${Object.entries(
      METRIC_TITLES,
    )
      .map(
        ([id, label]) =>
          `<label><input type="checkbox" name="metric-${id}" ${ctx.settings.metrics.includes(id) ? "checked" : ""}>${label}</label>`,
      )
      .join("")}</div>`,
  );
  updateWidgetButtons();
}
export function updateWidgetButtons() {
  const rows = [...document.querySelectorAll(".widget-row")];
  rows.forEach((row, index) => {
    row.querySelector('[data-action="widget-up"]').disabled = index === 0;
    row.querySelector('[data-action="widget-down"]').disabled =
      index === rows.length - 1;
  });
}
export function chartSettings(ctx) {
  const c = ctx.settings.chart;
  const sources = [
    { value: "active", label: "Aktiver Arbeitsbereich" },
    { value: "local", label: "Lokaler Arbeitsbereich" },
    ...ctx.sources.map((s) => ({ value: s.id, label: s.label })),
  ];
  showDialog(
    "Deine Daten. Deine Perspektive.",
    "Wähle Quelle und Kennzahl für dein Diagramm.",
    `<form id="chart-form"><p class="form-error" role="alert"></p><div class="form-grid">${field("title", "Diagrammtitel", c.title, { required: true, full: true })}${field("source", "Datenquelle", c.source, { options: sources, full: true })}${field("metric", "Kennzahl", c.metric, { options: METRICS })}${field("group", "Gruppieren nach", c.group, { options: GROUPS })}${field(
      "type",
      "Darstellung",
      c.type,
      {
        options: [
          { value: "bar", label: "Balkendiagramm" },
          { value: "line", label: "Liniendiagramm" },
        ],
      },
    )}${field("days", "Zeitraum", c.days, { options: [7, 30, 90, 365].map((n) => ({ value: n, label: `Letzte ${n} Tage` })) })}</div><div id="chart-hint" class="info-callout"></div>${footer("Diagramm speichern")}</form>`,
  );
  updateChartFields();
}
export function updateChartFields() {
  const form = document.getElementById("chart-form");
  if (!form) return;
  const snapshot = ["stock", "value"].includes(form.elements.metric.value);
  form.elements.group.querySelector('option[value="day"]').disabled = snapshot;
  if (snapshot && form.elements.group.value === "day")
    form.elements.group.value = "manufacturer";
  form.elements.days.disabled = snapshot;
  document.getElementById("chart-hint").textContent = snapshot
    ? "Bestand und Lagerwert sind eine Momentaufnahme. Der Zeitraum wird dafür nicht verwendet."
    : "Verkäufe und Wareneingänge werden im gewählten Zeitraum summiert. Ein Liniendiagramm nach Tag zeigt die zeitliche Entwicklung.";
}
export function openBooking(ctx, options = {}) {
  if (!activeProducts(ctx.data).length) {
    showDialog(
      "Zuerst einen Artikel anlegen",
      "Eine Buchung braucht einen Artikel.",
      emptyState(
        "Dein Bestand ist noch leer.",
        "Erfasse zunächst die Artikelinformationen.",
        link("Artikel anlegen", "#articles/new", "plus", "button primary"),
        "box",
      ),
    );
    return;
  }
  showDialog(
    "Warenbewegung buchen",
    "Jede Änderung bekommt einen nachvollziehbaren Eintrag.",
    bookingForm(ctx, options),
    true,
  );
  if (options.orderId) {
    const form = document.getElementById("booking-form");
    form.elements.product_id.disabled = true;
    form.elements.type.disabled = true;
    form.elements.quantity.readOnly = true;
  }
  updateBookingPreview(ctx);
}
export function bookingValues(form) {
  const values = Object.fromEntries(new FormData(form));
  values.product_id = form.elements.product_id.value;
  values.type = form.elements.type.value;
  if (values.type === "transfer") values.quantity = 0;
  return values;
}
export function updateBookingPreview(ctx) {
  const form = document.getElementById("booking-form");
  if (!form) return;
  const values = bookingValues(form),
    type = values.type;
  const product = ctx.data.products.find((p) => p.id === values.product_id);
  document.getElementById("transfer-field").hidden = type !== "transfer";
  form.elements.quantity.disabled = type === "transfer";
  form.elements.quantity.min = type === "correction" ? 0 : 1;
  form.elements.quantity.parentElement.querySelector("label").textContent =
    type === "correction"
      ? "Gezählter Gesamtbestand *"
      : type === "transfer"
        ? "Gesamter Artikelbestand"
        : "Menge in Stück *";
  if (type === "transfer" && product)
    form.elements.quantity.value = product.quantity;
  form.elements.note.required = ["correction", "outbound", "transfer"].includes(
    type,
  );
  form.elements.to_location_id.required = type === "transfer";
  const preview = document.getElementById("booking-preview");
  if (!product) {
    preview.textContent =
      "Wähle einen Artikel, um die Bestandsänderung zu sehen.";
    return;
  }
  let after = product.quantity;
  if (type === "correction") after = Number(form.elements.quantity.value);
  if (type === "inbound") after += Number(form.elements.quantity.value);
  if (type === "sale" || type === "outbound")
    after -= Number(form.elements.quantity.value);
  preview.textContent =
    type === "transfer"
      ? `Der gesamte Bestand (${number(product.quantity)} Stück) wird umgelagert.`
      : `${product.name} · Aktuell ${number(product.quantity)} → danach ${number(after)} Stück`;
}
export function openOrder(ctx, productId = "") {
  if (!activeProducts(ctx.data).length) {
    toast("Lege zuerst einen Artikel an.", true);
    location.hash = "#articles/new";
    return;
  }
  showDialog(
    "Nachbestellung planen",
    "Nur interne Planung. Es wird keine Bestellung an den Hersteller versendet.",
    orderForm(ctx, productId),
  );
}
export function connectionDialog(ctx) {
  showDialog(
    "Dein Arbeitsbereich",
    "Lokale Daten und Datenbankbestände werden getrennt verwaltet.",
    `<div class="source-card" style="margin-top:0"><header><h3>Lokaler Arbeitsbereich</h3><span class="badge">Dieses Gerät</span></header><p>Eigene Eingaben in diesem Browser speichern. Keine automatische Übertragung.</p>${button("Lokal arbeiten", "use-local", "database", "small")}</div>${ctx.sources.map((s) => `<div class="source-card"><h3>${e(s.label)}</h3><p>${s.writable ? "Verbinden und Bestände verwalten." : "Verbinden und Daten auswerten."}</p>${button("Anmelden & verbinden", "connect-source", "database", "small", `data-id="${e(s.id)}"`)}</div>`).join("")}<div class="actions" style="margin-top:20px">${button("Datenquellen suchen", "discover-dialog", "refresh", "small")}${button("Anbindung einrichten", "integration-help", "help", "small")}</div>`,
  );
}
export function loginDialog(ctx, id) {
  const source = ctx.sources.find((s) => s.id === id);
  if (!source) throw new Error("Die Datenquelle ist nicht registriert.");
  showDialog(
    "Mit Datenquelle verbinden",
    source.label,
    `<form id="login-form" data-source="${e(id)}"><p class="form-error" role="alert"></p><div class="form-grid">${field("email", "E-Mail", "", { type: "email", required: true, full: true, autocomplete: "username" })}${field("password", "Passwort", "", { type: "password", required: true, full: true, autocomplete: "current-password" })}</div><div class="info-callout">Verwende euren Supabase-Benutzerzugang. Berechtigungen prüft eure Datenbank. Die Anmeldung gilt bis zum Neuladen der Seite und nur für diese Quelle.</div>${footer("Anmelden & verbinden")}</form>`,
  );
}
export function integrationHelp() {
  showDialog(
    "Eure Datenbank anbinden",
    "Vorbereitet für Django + Supabase. Es werden keine Tabellen angelegt.",
    `<div class="help-steps"><div class="help-step"><div><h3>Django starten</h3><p>Installiere backend/requirements.txt und starte backend/manage.py runserver. Öffne die Oberfläche unter http://127.0.0.1:8000.</p></div></div><div class="help-step"><div><h3>Vorhandene Datenquelle registrieren</h3><p>Kopiere backend/data_sources.example.json nach backend/data_sources.json. Trage die Namen eurer Umgebungsvariablen für URL und Publishable Key ein.</p></div></div><div class="help-step"><div><h3>Felder und Buchungen zuordnen</h3><p>Ordne eure Tabellen und Spalten den Artikeln, Lagerorten, Bewegungen und Bestellungen zu. Eine vorhandene transaktionale Datenbankfunktion führt Änderungen atomar aus.</p></div></div><div class="help-step"><div><h3>Verbinden und prüfen</h3><p>Suche Quellen in den Einstellungen, melde dich an und wähle im Diagramm die gewünschte Quelle. Die vollständige Anleitung liegt in docs/ANBINDUNG.md.</p></div></div></div><div class="info-callout">Schlüssel bleiben auf dem Server. Es gelten eure Benutzerrechte. Für rein lesende Quellen ist keine Buchungsfunktion nötig.</div><div class="modal-footer">${button("Verbindungen prüfen", "discover-dialog", "refresh")}${button("Verstanden", "close-dialog", "", "primary")}</div>`,
    true,
  );
}
