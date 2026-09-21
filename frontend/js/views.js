import { icon } from "./icons.js";
import {
  escapeHtml as e,
  number,
  money,
  date,
  button,
  link,
  pageHeading,
  emptyState,
  field,
} from "./ui.js";
import {
  stats,
  activeProducts,
  isLowStock,
  filterProducts,
  locationLabel,
  MOVEMENT_LABELS,
  salesRanking,
} from "./domain.js";
import { chartPanel } from "./charts.js";

export const PAGE_TITLES = {
  dashboard: "Dashboard",
  articles: "Artikel & Bestände",
  movements: "Warenbewegungen",
  locations: "Lagerorte",
  orders: "Nachbestellungen",
  analytics: "Auswertungen",
  settings: "Einstellungen",
  help: "Hilfe & Einstieg",
};
export const WIDGET_TITLES = {
  welcome: "Willkommensbereich",
  metrics: "Kennzahlen",
  chart: "Diagramm",
  quick: "Schnellaktionen",
  articles: "Artikelübersicht",
};
export const METRIC_TITLES = {
  articles: "Artikel gesamt",
  units: "Teile auf Lager",
  low: "Bestand niedrig",
  locations: "Lagerorte",
  value: "Lagerwert (EK)",
  orders: "Offene Nachbestellungen",
};
const productOptions = (data) => [
  { value: "", label: "Artikel auswählen" },
  ...activeProducts(data).map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.size} · ${p.sku}`,
  })),
];
export const locationOptions = (data) => [
  { value: "", label: "Noch nicht zugeordnet" },
  ...data.locations.map((l) => ({
    value: l.id,
    label: `${l.name} · ${l.shelf}${l.bin ? " / " + l.bin : ""}`,
  })),
];
const formError = '<p class="form-error" role="alert"></p>';
export function sourceName(ctx, id = ctx.settings.source) {
  return id === "local"
    ? "Lokaler Arbeitsbereich"
    : ctx.sources.find((s) => s.id === id)?.label || id;
}
export function statusBadge(p) {
  if (p.archived) return '<span class="badge">Archiviert</span>';
  if (p.quantity === 0) return '<span class="badge red">Nicht auf Lager</span>';
  if (isLowStock(p)) return '<span class="badge amber">Bestand niedrig</span>';
  return '<span class="badge green">Auf Lager</span>';
}
export function connectionNote(ctx) {
  if (ctx.settings.source !== "local") return "";
  return `<div class="connection-note">${icon("database")}<p><strong>Dein lokaler Arbeitsbereich.</strong> Deine Eingaben bleiben in diesem Browser. Noch keine Datenbank verbunden.</p><button class="text-link" data-action="connection">Datenquelle verbinden ${icon("arrow-right")}</button></div>`;
}
export function dashboard(ctx) {
  const data = ctx.data,
    s = stats(data);
  const titleDate = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const metricCards = [
    {
      id: "articles",
      label: "Artikel gesamt",
      value: s.articles,
      icon: "box",
      note: "Aktive Artikelvarianten",
      href: "#articles",
    },
    {
      id: "units",
      label: "Teile auf Lager",
      value: s.units,
      icon: "arrows",
      note: "Dein aktueller Gesamtbestand",
      href: "#articles?sort=quantity-desc",
    },
    {
      id: "low",
      label: "Bestand niedrig",
      value: s.low,
      icon: "warning",
      note: s.low ? "Nachbestellung prüfen" : "Keine offenen Bestandshinweise",
      href: "#articles?status=low",
    },
    {
      id: "locations",
      label: "Lagerorte",
      value: s.locations,
      icon: "location",
      note: "Regale & Fächer im Überblick",
      href: "#locations",
    },
    {
      id: "value",
      label: "Lagerwert (EK)",
      value: s.value,
      currency: true,
      icon: "chart",
      note: "Bestand × Einkaufspreis",
      href: "#analytics",
    },
    {
      id: "orders",
      label: "Offene Nachbestellungen",
      value: data.orders.filter((o) => o.status === "open").length,
      icon: "truck",
      note: "Noch nicht eingegangen",
      href: "#orders",
    },
  ].filter((card) => ctx.settings.metrics.includes(card.id));
  const widgets = {
    welcome: `<section class="welcome-banner"><p class="eyebrow">A LITTLE CLARITY. A LOT OF POSSIBILITIES.</p><h2>Dein Lager.<br>Alles an seinem Platz.</h2><p>Mehr Überblick für alles, was du als Nächstes vorhast.</p>${link("Zum Artikelbestand", "#articles", "arrow-right", "button")}<span class="hero-tag">PARADISE STATE OF MIND</span></section>`,
    metrics: `<div class="metrics">${metricCards.map((m) => `<a class="panel metric" href="${m.href}"><div class="metric-top"><span>${m.label}</span><span class="metric-icon">${icon(m.icon)}</span></div><div class="metric-value number ${m.currency ? "currency-value" : ""}">${m.currency ? money(m.value) : number(m.value)}</div><div class="metric-footer"><span>${m.note}</span>${icon("arrow-right")}</div></a>`).join("")}</div>`,
    chart: chartPanel(
      ctx.settings.chart,
      sourceName(
        ctx,
        ctx.settings.chart.source === "active"
          ? ctx.settings.source
          : ctx.settings.chart.source,
      ),
    ),
    quick: `<section class="panel quick-panel"><div class="panel-head"><div><h2>Direkt loslegen</h2><p>Ein guter Flow beginnt mit einem Klick.</p></div><span class="muted">✧</span></div><div class="quick-list"><a href="#articles/new" class="quick-action"><span>${icon("plus")}</span><span><strong>Artikel anlegen</strong><small>Platz für etwas Neues.</small></span>${icon("chevron-right")}</a><button class="quick-action" data-action="book-inbound"><span>${icon("download")}</span><span><strong>Wareneingang buchen</strong><small>Neue Ware willkommen heißen.</small></span>${icon("chevron-right")}</button><button class="quick-action" data-action="book-sale"><span>${icon("upload")}</span><span><strong>Verkauf erfassen</strong><small>Bestände aktuell halten.</small></span>${icon("chevron-right")}</button></div><div class="quick-tip">${icon("heart")}<span>Alles im Flow. Jede Buchung bleibt nachvollziehbar.</span></div></section>`,
    articles: `<section class="panel"><div class="panel-head"><div><h2>Deine Artikel im Überblick</h2><p>Zuletzt angelegt. Immer griffbereit.</p></div>${link("Alle Artikel", "#articles", "arrow-right", "text-link")}</div>${articleTable(
      data,
      activeProducts(data)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
      true,
    )}<div class="card-footer"><span>${number(s.articles)} Artikel · ${number(s.units)} Stück auf Lager</span><span>Mit Liebe organisiert.</span></div></section>`,
  };
  return (
    pageHeading(
      ctx.settings.dashboardTitle,
      ctx.settings.dashboardSubtitle,
      button("Dashboard anpassen", "dashboard-settings", "settings") +
        link("Artikel anlegen", "#articles/new", "plus", "button primary"),
      titleDate.toUpperCase(),
    ) +
    connectionNote(ctx) +
    `<div class="dashboard-widgets">${ctx.settings.widgets.map((id) => `<div class="widget widget-${id}">${widgets[id]}</div>`).join("")}</div>${ctx.settings.widgets.length ? "" : emptyState("Dein Dashboard ist ganz frei.", "Blende die Bereiche ein, die du täglich brauchst.", button("Dashboard anpassen", "dashboard-settings", "settings"))}`
  );
}
export function articleTable(data, rows, compact = false) {
  return `<div class="table-scroll" ${compact ? 'style="margin-top:19px"' : ""}><table><thead><tr><th scope="col">ARTIKEL</th><th scope="col">GRÖSSE</th><th scope="col">BESTAND</th><th scope="col">LAGERORT</th><th scope="col">STATUS</th>${compact ? "" : '<th scope="col">AKTION</th>'}</tr></thead><tbody>${rows.map((p) => `<tr><td><div class="product-cell"><span class="product-monogram">${e(p.name.slice(0, 2).toUpperCase())}</span><div><a href="#articles/${encodeURIComponent(p.id)}" class="product-name">${e(p.name)}</a><div class="product-sub">${e(p.sku)} · ${e(p.manufacturer)}</div></div></div></td><td>${e(p.size)}</td><td class="number"><strong>${number(p.quantity)}</strong><span class="product-sub"> / Min. ${number(p.min_stock)}</span></td><td class="nowrap">${e(locationLabel(data, p.location_id))}</td><td>${statusBadge(p)}</td>${compact ? "" : `<td><a href="#articles/${encodeURIComponent(p.id)}" class="icon-button" aria-label="${e(p.name)} öffnen">${icon("chevron-right")}</a></td>`}</tr>`).join("")}</tbody></table></div>${rows.length ? "" : emptyState("Hier beginnt deine Kollektion.", "Lege deinen ersten Artikel an oder verbinde eure vorhandene Datenquelle.", link("Ersten Artikel anlegen", "#articles/new", "plus", "button soft small"), "box", "table-empty")}`;
}
export function articles(ctx) {
  const f = ctx.filters;
  return (
    pageHeading(
      "Artikel & Bestände",
      "Jede Variante. Jeder Lagerort. Ein klarer Überblick.",
      button("CSV exportieren", "export-articles", "download") +
        link("Artikel anlegen", "#articles/new", "plus", "button primary"),
    ) +
    `<section class="panel"><div class="toolbar"><div class="filters"><label class="field-search">${icon("search")}<input id="article-search" placeholder="Name, Artikelnummer, Material …" aria-label="Artikel filtern" value="${e(f.search)}"></label><select id="article-status" aria-label="Bestandsstatus"><option value="">Alle aktiven Artikel</option><option value="low" ${f.status === "low" ? "selected" : ""}>Bestand niedrig</option><option value="empty" ${f.status === "empty" ? "selected" : ""}>Nicht auf Lager</option><option value="archived" ${f.status === "archived" ? "selected" : ""}>Archivierte Artikel</option></select><select id="article-location" aria-label="Lagerort filtern"><option value="">Alle Lagerorte</option>${ctx.data.locations.map((l) => `<option value="${e(l.id)}" ${f.location === l.id ? "selected" : ""}>${e(l.name)}</option>`).join("")}</select><select id="article-sort" aria-label="Artikel sortieren">${[
      { value: "name", label: "Name A–Z" },
      { value: "recent", label: "Neueste zuerst" },
      { value: "quantity-asc", label: "Bestand aufsteigend" },
      { value: "quantity-desc", label: "Bestand absteigend" },
    ]
      .map(
        (o) =>
          `<option value="${o.value}" ${f.sort === o.value ? "selected" : ""}>${o.label}</option>`,
      )
      .join(
        "",
      )}</select></div><button class="text-link" data-action="clear-filters">Zurücksetzen</button></div><div id="article-results">${articleResults(ctx)}</div></section>`
  );
}
export function articleResults(ctx) {
  const rows = filterProducts(ctx.data, ctx.filters);
  const pages = Math.max(1, Math.ceil(rows.length / 15));
  ctx.filters.page = Math.min(ctx.filters.page, pages);
  const start = (ctx.filters.page - 1) * 15;
  const table = rows.length
    ? articleTable(ctx.data, rows.slice(start, start + 15))
    : emptyState(
        "Keine Artikel gefunden.",
        "Passe deine Filter an oder lege einen neuen Artikel an.",
        button("Filter zurücksetzen", "clear-filters", "refresh"),
        "search",
      );
  return (
    table +
    `<div class="pagination"><span>${number(rows.length)} Artikel${rows.length ? ` · ${start + 1}–${Math.min(start + 15, rows.length)}` : ""}</span><div class="actions">${button("Zurück", "prev-page", "", "small", ctx.filters.page <= 1 ? "disabled" : "")}<span>${ctx.filters.page} / ${pages}</span>${button("Weiter", "next-page", "", "small", ctx.filters.page >= pages ? "disabled" : "")}</div></div>`
  );
}
export function productEditor(ctx, id = "") {
  const p = id ? ctx.data.products.find((p) => p.id === id) : {};
  if (!p || p.archived) return notFound();
  return (
    pageHeading(
      id ? "Artikel bearbeiten" : "Platz für etwas Neues.",
      id
        ? "Stammdaten anpassen. Bestandsänderungen werden separat gebucht."
        : "Ein Artikel pro Variante – so bleiben Größe und Bestand eindeutig.",
      link("Zurück", id ? `#articles/${id}` : "#articles", "arrow-right"),
    ) +
    `<div class="form-layout"><form id="product-form" data-id="${e(id)}"><section class="panel form-section"><h2>01 · Artikelinformationen</h2><p>Die Basis für deine Kollektion. Mit * markierte Felder sind erforderlich.</p>${formError}<div class="form-grid">${field("name", "Artikelname", p.name, { required: true, full: true, placeholder: "Wie heißt der Artikel?" })}${field("sku", "Artikelnummer / SKU", p.sku, { required: true, placeholder: "Eindeutige Artikelnummer" })}${field("manufacturer", "Hersteller", p.manufacturer, { required: true })}${field("description", "Beschreibung", p.description, { textarea: true, full: true, placeholder: "Details, Besonderheiten und Pflegehinweise …" })}${field("size", "Größe", p.size, { required: true, placeholder: "z. B. S, M, L oder 38" })}${field("gender", "Gender", p.gender || "Unisex", { required: true, options: ["Unisex", "Damen", "Herren", "Kinder", "Ohne Angabe"].map((v) => ({ value: v, label: v })) })}${field("material", "Material", p.material, { required: true, full: true, placeholder: "Material und Zusammensetzung" })}</div></section><section class="panel form-section"><h2>02 · Bestand & Lagerort</h2><p>${id ? "Bestände über Warenbewegungen ändern; Lagerorte über Umlagerung." : "Ein Anfangsbestand wird automatisch im Buchungsverlauf erfasst."}</p><div class="form-grid">${field("quantity", id ? "Aktueller Bestand" : "Anfangsbestand", p.quantity ?? 0, { type: "number", min: 0, max: 1000000000, step: 1, required: true, readonly: Boolean(id) })}${field("min_stock", "Mindestbestand", p.min_stock ?? 0, { type: "number", min: 0, max: 1000000000, step: 1, required: true, hint: "Ein Hinweis erscheint, sobald der Bestand darunter liegt." })}${id ? `<div class="field full"><label>Lagerort</label><p>${e(locationLabel(ctx.data, p.location_id))}</p><input type="hidden" name="location_id" value="${e(p.location_id)}"></div>` : field("location_id", "Lagerort", p.location_id, { full: true, options: locationOptions(ctx.data), hint: "Lagerorte kannst du im Bereich „Lagerorte“ anlegen." })}</div></section><section class="panel form-section"><h2>03 · Preise <span class="badge">Optional</span></h2><p>Für eine aussagekräftige Bewertung deines Lagerbestands.</p><div class="form-grid">${field("purchase_price", "Einkaufspreis in EUR", p.purchase_price ?? 0, { type: "number", min: 0, step: ".01" })}${field("sale_price", "Verkaufspreis in EUR", p.sale_price ?? 0, { type: "number", min: 0, step: ".01" })}</div><div class="form-footer"><small>${ctx.settings.source === "local" ? "Speicherung nur in diesem Browser." : `Datenquelle: ${e(sourceName(ctx))}`}</small><div class="actions">${link("Abbrechen", id ? `#articles/${id}` : "#articles")}<button class="button primary" type="submit">${icon("check")}Artikel speichern</button></div></div></section></form><aside class="panel aside-card"><span class="empty-icon">${icon("leaf")}</span><h3>Gut organisiert von Anfang an.</h3><p>Lege jede Kombination aus Artikel und Größe als eigene Variante mit einer eigenen Artikelnummer an.</p><div class="info-callout">Beispiel für die Struktur: derselbe Schnitt in S und M ergibt zwei Artikelvarianten.</div><ul><li>Bestand wird in ganzen Stückzahlen geführt.</li><li>Regal und Fach machen Artikel schnell auffindbar.</li><li>Ein Mindestbestand hilft, rechtzeitig nachzubestellen.</li></ul></aside></div>`
  );
}
export function productDetail(ctx, id) {
  const p = ctx.data.products.find((p) => p.id === id);
  if (!p) return notFound();
  const actions = p.archived
    ? button(
        "Wieder aktivieren",
        "restore-product",
        "refresh",
        "",
        `data-id="${e(id)}"`,
      )
    : link("Bearbeiten", `#articles/${encodeURIComponent(id)}/edit`, "edit") +
      button(
        "Bewegung buchen",
        "book-product",
        "arrows",
        "primary",
        `data-id="${e(id)}"`,
      );
  const details = [
    ["Artikelnummer", p.sku],
    ["Größe", p.size],
    ["Gender", p.gender],
    ["Material", p.material],
    ["Hersteller", p.manufacturer],
    ["Lagerort", locationLabel(ctx.data, p.location_id)],
    ["Einkaufspreis", money(p.purchase_price)],
    ["Verkaufspreis", money(p.sale_price)],
    ["Mindestbestand", `${number(p.min_stock)} Stück`],
    ["Letzter Wareneingang", date(p.last_purchase_at)],
    ["Letzter Verkauf", date(p.last_sale_at)],
    ["Angelegt am", date(p.created_at)],
  ];
  return (
    pageHeading(
      p.name,
      `${p.sku} · ${p.size} · ${p.manufacturer}`,
      actions,
      "DEIN ARTIKEL IM DETAIL",
    ) +
    `<div class="form-layout"><div><section class="panel form-section"><div class="section-heading" style="margin-top:0"><h2>Artikelinformationen</h2>${statusBadge(p)}</div><div class="detail-grid">${details.map(([k, v]) => `<div class="detail-item"><small>${e(k)}</small><strong>${e(v)}</strong></div>`).join("")}</div>${p.description ? `<div class="info-callout" style="white-space:pre-wrap">${e(p.description)}</div>` : ""}</section><section class="panel"><div class="panel-head"><h2>Buchungsverlauf</h2>${link("Alle Bewegungen", `#movements?product=${id}`, "arrow-right", "text-link")}</div>${movementTable(ctx.data, ctx.data.movements.filter((m) => m.product_id === id).slice(0, 10))}</section></div><aside class="panel aside-card"><p>Aktueller Bestand</p><div class="stock-big">${number(p.quantity)} <span>Stück</span></div><p>${e(locationLabel(ctx.data, p.location_id))}</p><div class="actions" style="margin-top:20px">${p.archived ? "" : button("Nachbestellung planen", "order-product", "truck", "soft", `data-id="${e(id)}"`)}</div><div class="info-callout">Bestandsänderungen werden mit Zeitpunkt und Grund im Verlauf gespeichert.</div>${p.archived ? "" : `<div style="margin-top:23px">${button("Artikel archivieren", "archive-product", "archive", "small", `data-id="${e(id)}"`)}<p style="font-size:10px;margin-top:8px">Nur ohne Bestand und ohne offene Bestellungen möglich.</p></div>`}</aside></div>`
  );
}
export function movementTable(data, rows) {
  if (!rows.length)
    return emptyState(
      "Noch keine Warenbewegungen.",
      "Sobald Ware ein- oder ausgeht, findest du die Buchungen hier.",
      "",
      "arrows",
    );
  return `<div class="table-scroll" style="margin-top:18px"><table><thead><tr><th scope="col">ZEITPUNKT</th><th scope="col">ARTIKEL</th><th scope="col">BUCHUNG</th><th scope="col">VERÄNDERUNG</th><th scope="col">GRUND / REFERENZ</th></tr></thead><tbody>${rows
    .map((m) => {
      const p = data.products.find((p) => p.id === m.product_id);
      return `<tr><td class="nowrap">${date(m.occurred_at, true)}</td><td><a class="product-name" href="#articles/${encodeURIComponent(m.product_id)}">${e(p?.name || "Unbekannter Artikel")}</a><div class="product-sub">${e(p?.sku)}</div></td><td><span class="badge ${m.delta > 0 ? "green" : m.delta < 0 ? "pink" : ""}">${e(MOVEMENT_LABELS[m.type])}</span></td><td class="number">${m.delta > 0 ? "+" : ""}${number(m.delta)}<div class="product-sub">Danach: ${number(m.stock_after)}</div></td><td>${e(m.note || "—")}${m.reference ? `<div class="product-sub">${e(m.reference)}</div>` : ""}${m.type === "transfer" ? `<div class="product-sub">${e(locationLabel(data, m.from_location_id))} → ${e(locationLabel(data, m.to_location_id))}</div>` : ""}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
export function movements(ctx, params) {
  let rows = [...ctx.data.movements].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const type = params.get("type") || "",
    product = params.get("product") || "",
    from = params.get("from") || "",
    to = params.get("to") || "";
  if (type) rows = rows.filter((m) => m.type === type);
  if (product) rows = rows.filter((m) => m.product_id === product);
  if (from) rows = rows.filter((m) => m.occurred_at.slice(0, 10) >= from);
  if (to) rows = rows.filter((m) => m.occurred_at.slice(0, 10) <= to);
  ctx.movementRows = rows;
  return (
    pageHeading(
      "Alles in Bewegung.",
      "Eingänge, Verkäufe und Korrekturen. Lückenlos nachvollziehbar.",
      button("CSV exportieren", "export-movements", "download") +
        button("Bewegung buchen", "book", "plus", "primary"),
    ) +
    `<section class="panel"><form id="movement-filter" class="toolbar"><div class="filters"><select name="type" aria-label="Buchungsart filtern"><option value="">Alle Buchungsarten</option>${Object.entries(
      MOVEMENT_LABELS,
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === type ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select><select name="product" aria-label="Artikel auswählen"><option value="">Alle Artikel</option>${ctx.data.products.map((p) => `<option value="${e(p.id)}" ${p.id === product ? "selected" : ""}>${e(p.name)} · ${e(p.size)}</option>`).join("")}</select><input type="date" name="from" value="${e(from)}" aria-label="Buchungen von"><input type="date" name="to" value="${e(to)}" aria-label="Buchungen bis"><button class="button small" type="submit">${icon("filter")}Filtern</button>${link("Zurücksetzen", "#movements", "", "text-link")}</div></form>${movementTable(ctx.data, rows)}<div class="card-footer"><span>${rows.length} Buchungen</span><span>Gespeicherte Buchungen bleiben im Verlauf.</span></div></section>`
  );
}
export function bookingForm(
  ctx,
  { type = "inbound", productId = "", orderId = "" } = {},
) {
  const order = ctx.data.orders.find((o) => o.id === orderId);
  return `<form id="booking-form">${formError}<input type="hidden" name="order_id" value="${e(orderId)}"><div class="form-grid">${field("product_id", "Artikel", productId, { required: true, full: true, options: productOptions(ctx.data) })}${field(
    "type",
    "Buchungsart",
    type,
    {
      required: true,
      options: Object.entries(MOVEMENT_LABELS)
        .filter(([v]) => v !== "initial")
        .map(([value, label]) => ({ value, label })),
    },
  )}${field("quantity", "Menge in Stück", order?.quantity ?? 1, { type: "number", min: 0, step: 1, max: 1000000000, required: true })}<div id="transfer-field" class="field full" ${type === "transfer" ? "" : "hidden"}>${field("to_location_id", "Ziel-Lagerort", "", { options: locationOptions(ctx.data) })}</div>${field("reference", "Beleg / Referenz", "", { full: true, placeholder: "Optional, z. B. Lieferscheinnummer" })}${field("note", "Grund / Notiz", "", { textarea: true, full: true, placeholder: "Bei Korrektur, Umlagerung und sonstigem Ausgang erforderlich." })}</div><div id="booking-preview" class="info-callout">Wähle einen Artikel, um die Bestandsänderung zu sehen.</div>${order ? '<p class="info-callout">Diese Buchung nimmt die gesamte Bestellung entgegen und schließt sie ab.</p>' : ""}<div class="modal-footer">${button("Abbrechen", "close-dialog")}<button class="button primary" type="submit">${icon("check")}Verbindlich buchen</button></div></form>`;
}
export function locations(ctx) {
  return (
    pageHeading(
      "Alles hat seinen Platz.",
      "Vom Regal bis zum Fach. Finde deine Artikel auf Anhieb.",
      button("Lagerort anlegen", "new-location", "plus", "primary"),
    ) +
    (ctx.data.locations.length
      ? `<div class="location-grid">${ctx.data.locations
          .map((l) => {
            const products = activeProducts(ctx.data).filter(
                (p) => p.location_id === l.id,
              ),
              units = products.reduce((n, p) => n + p.quantity, 0);
            return `<section class="panel location-card"><header><span class="empty-icon" style="margin:0;width:40px;height:40px">${icon("location")}</span><button class="icon-button" data-action="edit-location" data-id="${e(l.id)}" aria-label="${e(l.name)} bearbeiten">${icon("edit")}</button></header><h3>${e(l.name)}</h3><p>Regal ${e(l.shelf)}${l.bin ? ` · Fach ${e(l.bin)}` : ""}</p><div class="location-stat">${number(units)} <small style="font-size:12px;font-weight:400">Stück</small></div><p>${products.length} Artikelvarianten${l.capacity ? ` · Kapazität ${number(l.capacity)} Stück` : ""}</p>${l.capacity ? `<div class="progress-track" role="meter" aria-label="Belegung" aria-valuenow="${units}" aria-valuemin="0" aria-valuemax="${l.capacity}"><span style="width:${Math.min(100, (units / l.capacity) * 100)}%"></span></div>` : ""}<footer>${link("Artikel ansehen", `#articles?location=${encodeURIComponent(l.id)}`, "arrow-right", "text-link")}<span class="badge">${l.capacity ? Math.round((units / l.capacity) * 100) + " % belegt" : "Ohne Limit"}</span></footer></section>`;
          })
          .join("")}</div>`
      : `<section class="panel">${emptyState("Ein guter Platz für den Anfang.", "Lege eure echten Regale und Fächer an. Anschließend kannst du Artikel zuordnen.", button("Ersten Lagerort anlegen", "new-location", "plus", "primary"), "location")}</section>`)
  );
}
export function locationForm(ctx, id = "") {
  const l = ctx.data.locations.find((l) => l.id === id) || {};
  return `<form id="location-form" data-id="${e(id)}">${formError}<div class="form-grid">${field("name", "Bezeichnung", l.name, { required: true, full: true })}${field("shelf", "Regal", l.shelf, { required: true })}${field("bin", "Fach", l.bin)}${field("capacity", "Kapazität in Stück", l.capacity ?? 0, { type: "number", min: 0, step: 1, max: 1000000000, full: true, hint: "0 bedeutet keine feste Kapazitätsgrenze." })}</div><div class="modal-footer">${button("Abbrechen", "close-dialog")}<button class="button primary" type="submit">${icon("check")}Lagerort speichern</button></div></form>`;
}
export function orders(ctx, params) {
  const status = params.get("status") || "open";
  const rows = ctx.data.orders.filter((o) => o.status === status);
  return (
    pageHeading(
      "Bereit für Nachschub.",
      "Bedarf planen, Lieferungen verfolgen und Wareneingänge buchen.",
      button("Nachbestellung planen", "new-order", "plus", "primary"),
    ) +
    `<div class="tabs" aria-label="Bestellstatus">${[
      ["open", "Offen"],
      ["received", "Eingegangen"],
      ["cancelled", "Storniert"],
    ]
      .map(
        ([v, l]) =>
          `<a href="#orders?status=${v}" class="${v === status ? "active" : ""}">${l} <span class="nav-count">${ctx.data.orders.filter((o) => o.status === v).length}</span></a>`,
      )
      .join(
        "",
      )}</div><div class="connection-note">${icon("truck")}<p>Hier planst du Nachbestellungen. Es wird keine Bestellung an einen Hersteller versendet.</p></div><section class="panel">${
      rows.length
        ? `<div class="table-scroll"><table><thead><tr><th>ARTIKEL / HERSTELLER</th><th>MENGE</th><th>ERWARTET AM</th><th>NOTIZ</th><th>AKTIONEN</th></tr></thead><tbody>${rows
            .map((o) => {
              const p = ctx.data.products.find((p) => p.id === o.product_id);
              return `<tr><td><a class="product-name" href="#articles/${e(o.product_id)}">${e(p?.name)}</a><div class="product-sub">${e(p?.manufacturer)} · ${e(p?.size)}</div></td><td>${number(o.quantity)} Stück</td><td>${o.expected_date ? date(o.expected_date) : "Noch offen"}</td><td>${e(o.note || "—")}</td><td><div class="actions">${o.status === "open" ? button("Ware erhalten", "receive-order", "download", "small", `data-id="${e(o.id)}"`) + button("Stornieren", "cancel-order", "", "small", `data-id="${e(o.id)}"`) : '<span class="badge">Abgeschlossen</span>'}</div></td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : emptyState(
            "Aktuell keine Bestellungen in dieser Ansicht.",
            "Plane eine Nachbestellung direkt hier oder aus einem Artikel heraus.",
            button("Nachbestellung planen", "new-order", "plus", "soft"),
            "truck",
          )
    }</section>`
  );
}
export function orderForm(ctx, productId = "") {
  const p = ctx.data.products.find((p) => p.id === productId);
  return `<form id="order-form">${formError}<div class="form-grid">${field("product_id", "Artikel", productId, { required: true, full: true, options: productOptions(ctx.data) })}${field("quantity", "Bestellmenge", p ? Math.max(1, p.min_stock - p.quantity) : 1, { type: "number", min: 1, step: 1, max: 1000000000, required: true })}${field("expected_date", "Erwartetes Lieferdatum", "", { type: "date" })}${field("note", "Notiz", "", { textarea: true, full: true })}</div><div class="modal-footer">${button("Abbrechen", "close-dialog")}<button class="button primary" type="submit">${icon("check")}Nachbestellung speichern</button></div></form>`;
}
export function analytics(ctx) {
  const ranking = salesRanking(ctx.data, Number(ctx.settings.chart.days));
  const fast = ranking.filter((r) => r.sold > 0).slice(0, 5);
  const slow = [...ranking].sort((a, b) => a.sold - b.sold).slice(0, 5);
  function rankingPanel(title, rows, emptyText) {
    return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2><p>Letzte ${ctx.settings.chart.days} Tage · ${e(sourceName(ctx))}</p></div>${icon("chart")}</div>${rows.length ? `<div class="ranking">${rows.map((r, i) => `<div class="ranking-row"><span class="rank">0${i + 1}</span><a href="#articles/${e(r.product.id)}">${e(r.product.name)} <small>· ${e(r.product.size)}</small></a><strong>${number(r.sold)} <small>Stück</small></strong></div>`).join("")}</div>` : emptyState(emptyText, "Die Auswertung basiert ausschließlich auf erfassten Verkäufen.", "", "chart")}</section>`;
  }
  return (
    pageHeading(
      "Wissen, was sich bewegt.",
      "Echte Daten. Klare Entscheidungen. Deine Perspektive aufs Lager.",
      button("Drucken", "print", "print") +
        button("Diagramm anpassen", "chart-settings", "settings", "primary"),
    ) +
    `<div class="metrics"><div class="panel metric"><div class="metric-top">Lagerwert zum Einkaufspreis ${icon("box")}</div><div class="metric-value" style="font-size:25px">${money(stats(ctx.data).value)}</div><p class="metric-footer">Aktueller Bestand × hinterlegter Einkaufspreis</p></div><div class="panel metric"><div class="metric-top">Verkaufte Teile ${icon("upload")}</div><div class="metric-value">${number(ranking.reduce((n, r) => n + r.sold, 0))}</div><p class="metric-footer">Aktive Artikel · letzte ${ctx.settings.chart.days} Tage</p></div><div class="panel metric"><div class="metric-top">Offene Nachbestellungen ${icon("truck")}</div><div class="metric-value">${ctx.data.orders.filter((o) => o.status === "open").length}</div><p class="metric-footer">Geplant und noch nicht eingegangen</p></div><a href="#articles?status=low" class="panel metric"><div class="metric-top">Unter Mindestbestand ${icon("warning")}</div><div class="metric-value">${stats(ctx.data).low}</div><p class="metric-footer">Bedarf ansehen →</p></a></div>${chartPanel(ctx.settings.chart, sourceName(ctx, ctx.settings.chart.source === "active" ? ctx.settings.source : ctx.settings.chart.source), true)}<div class="analytics-grid" style="margin-top:22px">${rankingPanel("Stark nachgefragt", fast, "Noch keine Verkäufe im Zeitraum.")}${rankingPanel("Wenig nachgefragt", slow, "Noch keine Artikel vorhanden.")}</div><p class="muted" style="font-size:11px;margin-top:17px">Die Nachfrage-Auswertung zählt Verkäufe aktiver Artikel. Rücksendungen werden als Wareneingang gebucht und nicht mit Verkäufen verrechnet. Neue Artikel können noch keine Verkaufshistorie haben.</p>`
  );
}
export function settings(ctx) {
  const s = ctx.settings;
  return (
    pageHeading(
      "Dein Studio. Deine Regeln.",
      "Passe den Arbeitsbereich so an, wie du am liebsten arbeitest.",
      button("Dashboard anpassen", "dashboard-settings", "dashboard"),
    ) +
    `<div class="settings-layout"><div><section class="panel form-section"><h2>Oberfläche & Bedienung</h2><form id="preferences-form">${formError}<label class="setting-row"><span><strong>Mehr Kontrast</strong><p>Deutlichere Konturen und weniger transparente Flächen.</p></span><input type="checkbox" name="contrast" ${s.contrast ? "checked" : ""}></label><label class="setting-row"><span><strong>Kompakte Tabellen</strong><p>Mehr Artikel auf einen Blick.</p></span><input type="checkbox" name="compact" ${s.compact ? "checked" : ""}></label><label class="setting-row"><span><strong>Bewegungen reduzieren</strong><p>Verzichte auf Animationen und Übergangseffekte.</p></span><input type="checkbox" name="reduceMotion" ${s.reduceMotion ? "checked" : ""}></label><label class="setting-row"><span><strong>Bestandshinweise anzeigen</strong><p>Die Glocke meldet Artikel unter ihrem Mindestbestand.</p></span><input type="checkbox" name="notifications" ${s.notifications ? "checked" : ""}></label><label class="setting-row"><span><strong>Farbwelt</strong><p>Dein Miami-Look, passend zur Tagesstimmung.</p></span><select name="theme" aria-label="Farbwelt"><option value="miami" ${s.theme === "miami" ? "selected" : ""}>Miami Rosé</option><option value="dusk" ${s.theme === "dusk" ? "selected" : ""}>Lavender Dusk</option></select></label><div class="form-footer"><small>Einstellungen gelten für diesen Browser.</small><button class="button primary" type="submit">${icon("check")}Speichern</button></div></form></section><section class="panel form-section"><h2>Datenquellen</h2><p>Wähle, mit welchen Beständen du arbeiten möchtest.</p><div class="source-card"><header><h3>Lokaler Arbeitsbereich</h3><span class="badge ${s.source === "local" ? "green" : ""}">${s.source === "local" ? "Aktiv" : "Verfügbar"}</span></header><p>Deine eigenen Eingaben auf diesem Gerät. Kein Server, keine automatische Synchronisierung.</p>${button("Lokal arbeiten", "use-local", "database", "small", s.source === "local" ? "disabled" : "")}</div>${ctx.sources.map((source) => `<div class="source-card"><header><h3>${e(source.label)}</h3><span class="badge ${s.source === source.id ? "green" : ""}">${s.source === source.id ? "Aktiv" : "Supabase"}</span></header><p>${source.writable ? "Lesen und Buchen vorbereitet" : "Nur Lesen"}</p>${button("Verbinden", "connect-source", "database", "small", `data-id="${e(source.id)}"`)}</div>`).join("")}<div class="actions" style="margin-top:18px">${button("Verbindungen prüfen", "discover-sources", "refresh", "small")}${button("Anbindung einrichten", "integration-help", "help", "small")}${s.source !== "local" ? button("Abmelden", "logout", "logout", "small") : ""}</div></section></div><div><section class="panel aside-card"><span class="empty-icon">${icon("download")}</span><h3>Deine Daten gehören dir.</h3><p>Exportiere Artikel als CSV oder sichere den kompletten lokalen Arbeitsbereich als JSON-Datei.</p><div class="actions" style="margin-top:18px">${button("Sicherung herunterladen", "backup", "download", "small")}${button("Sicherung wiederherstellen", "restore-backup", "upload", "small", s.source !== "local" ? "disabled" : "")}</div><div class="info-callout">Browserdaten können gelöscht werden. Sichere lokale Eingaben regelmäßig. Der Wechsel zur Datenbank überträgt lokale Artikel nicht automatisch.</div></section><section class="panel aside-card" style="margin-top:22px"><h3>Mindestbestand & E-Mail</h3><p>Bestandswarnungen erscheinen sofort in der Oberfläche. E-Mail-Benachrichtigungen werden nach der Anbindung serverseitig eingerichtet.</p><p style="margin-top:10px">${ctx.serverStatus?.email_ready ? "SMTP ist im Backend konfiguriert. Der automatisierte Aufruf muss serverseitig eingerichtet sein." : "E-Mail-Versand ist noch nicht eingerichtet."}</p><div style="margin-top:15px">${link("Einrichtung & Hilfe", "#help", "arrow-right", "text-link")}</div></section><section class="panel aside-card" style="margin-top:22px"><h3>Kleine Abkürzungen</h3><p><kbd>/</kbd> Artikelsuche öffnen<br><kbd>Esc</kbd> Fenster schließen<br><kbd>Tab</kbd> Durch die Oberfläche navigieren</p></section></div></div>`
  );
}
export function help() {
  return (
    pageHeading(
      "Ein guter Start.",
      "Einfach organisiert. Schritt für Schritt.",
      link("Zum Dashboard", "#dashboard", "arrow-right"),
    ) +
    `<div class="form-layout"><section class="panel form-section"><h2>So kommt dein Lager in Bewegung.</h2><div class="help-steps">${[
      [
        "Arbeitsbereich wählen",
        'Arbeite zunächst lokal mit deinen eigenen Eingaben oder verbinde eine vorhandene Datenquelle unter <a href="#settings">Einstellungen</a>. Es werden keine Beispieldaten angelegt.',
      ],
      [
        "Lagerorte anlegen",
        'Erfasse unter <a href="#locations">Lagerorte</a> eure Regale und Fächer. Eine Kapazitätsgrenze ist optional.',
      ],
      [
        "Artikel erfassen",
        'Lege unter <a href="#articles/new">Artikel anlegen</a> jede Variante einzeln an. Artikelnummer, Name, Größe, Material, Gender und Hersteller bilden die Stammdaten.',
      ],
      [
        "Bestände aktuell halten",
        'Buche Wareneingänge, Verkäufe, sonstige Ausgänge und Inventuren unter <a href="#movements">Warenbewegungen</a>. Eine Inventur ersetzt den Bestand durch die gezählte Menge. Eine Umlagerung verschiebt den gesamten Artikelbestand.',
      ],
      [
        "Rechtzeitig nachbestellen",
        'Artikel unter Mindestbestand erscheinen in den Hinweisen. Plane eine <a href="#orders">Nachbestellung</a> und buche sie nach Lieferung mit „Ware erhalten“ ein.',
      ],
      [
        "Deinen Überblick gestalten",
        "Blende Dashboard-Bereiche ein, ändere ihre Reihenfolge und wähle für das Diagramm Datenquelle, Kennzahl, Gruppierung und Darstellungsart.",
      ],
    ]
      .map(
        ([title, description]) =>
          `<div class="help-step"><div><h3>${title}</h3><p>${description}</p></div></div>`,
      )
      .join(
        "",
      )}</div><div class="prose" style="margin-top:25px"><h2>Gut zu wissen</h2><details><summary>Warum sind meine Diagramme leer?</summary><p>Es werden nur tatsächlich erfasste oder angebundene Daten gezeigt. Prüfe die Quelle, Kennzahl und den Zeitraum im Diagrammfenster. Aktueller Bestand und Lagerwert zeigen den jetzigen Zustand; der Zeitraum gilt für Verkäufe und Wareneingänge.</p></details><details><summary>Was passiert beim Wechsel der Datenquelle?</summary><p>Du öffnest einen separaten Arbeitsbereich. Lokale Daten bleiben lokal und werden nicht automatisch in eine Datenbank kopiert. Eine Anmeldung gilt nur bis zum Neuladen der Seite und für die gewählte Quelle.</p></details><details><summary>Wie korrigiere ich einen Fehler?</summary><p>Stammdaten bearbeitest du auf der Artikelseite. Bestandsfehler korrigierst du mit einer Inventurkorrektur und einer aussagekräftigen Notiz. Vergangene Buchungen werden nicht gelöscht. Artikel ohne Bestand und offene Bestellung können archiviert werden.</p></details><details><summary>Wann werden E-Mails verschickt?</summary><p>Im lokalen Modus werden keine E-Mails verschickt. Der vorbereitete Django-Befehl prüft nach Anbindung Mindestbestände. Dafür müssen SMTP, Empfänger, eine leseberechtigte Datenquelle und der geplante Serveraufruf eingerichtet werden. Eine übergebene Liste bereits gemeldeter Artikel verhindert Wiederholungen.</p></details></div></section><aside class="panel aside-card"><h3>Für euer Projektteam</h3><p>Das Frontend verwendet ausschließlich HTML, CSS und JavaScript. Django liefert dieselbe Oberfläche und eine getrennte API.</p><div class="info-callout">Datenbanken und Tabellen werden nicht angelegt. Die Zuordnung eurer vorhandenen Tabellen bleibt konfigurierbar.</div><div class="actions" style="margin-top:20px">${button("Anbindung ansehen", "integration-help", "database", "soft")}${button("Hilfe drucken", "print", "print", "small")}</div><div class="prose"><h3>Projektdateien</h3><p><code>README.md</code> – Start & Aufbau<br><code>docs/ANBINDUNG.md</code> – Schnittstellen<br><code>docs/ANFORDERUNGEN.md</code> – Funktionsübersicht</p></div></aside></div>`
  );
}
export function notFound() {
  return emptyState(
    "Hier ist gerade kein Artikel.",
    "Der Link ist ungültig oder der Artikel ist nicht mehr verfügbar.",
    link("Zum Artikelbestand", "#articles", "arrow-right"),
    "search",
  );
}
