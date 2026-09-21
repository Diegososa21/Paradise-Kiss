import { icon, hydrateIcons } from "./icons.js";
import {
  EMPTY_DATA,
  activeProducts,
  isLowStock,
  filterProducts,
  locationLabel,
  planMovement,
  chartSeries,
  csv,
  validateSnapshot,
  MOVEMENT_LABELS,
} from "./domain.js";
import {
  loadSettings,
  saveSettings,
  repository,
  api,
  tokens,
  DATA_KEY,
} from "./store.js";
import {
  escapeHtml as e,
  button,
  showDialog,
  closeDialog,
  toast,
  download,
  emptyState,
} from "./ui.js";
import * as views from "./views.js";
import * as dialogs from "./dialogs.js";
import { renderChart } from "./charts.js";

const ctx = {
  settings: loadSettings(),
  data: structuredClone(EMPTY_DATA),
  sources: [],
  serverStatus: null,
  filters: { search: "", status: "", location: "", sort: "name", page: 1 },
  movementRows: [],
  chartData: null,
};
let routeVersion = 0,
  lastHash = "",
  formDirty = false,
  pendingConfirmation = null;
const main = document.getElementById("main");

function applyPreferences() {
  document.body.classList.toggle("compact", Boolean(ctx.settings.compact));
  document.body.classList.toggle(
    "high-contrast",
    Boolean(ctx.settings.contrast),
  );
  document.body.classList.toggle(
    "reduce-motion",
    Boolean(ctx.settings.reduceMotion),
  );
  document.body.dataset.theme = ctx.settings.theme;
}
function persistPreferences() {
  saveSettings(ctx.settings);
  applyPreferences();
}
function setMenu(open) {
  const sidebar = document.getElementById("sidebar");
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  if (!open && mobile && sidebar.contains(document.activeElement)) {
    document.querySelector(".mobile-menu").focus();
  }
  sidebar.inert = mobile && !open;
  document.body.classList.toggle("menu-open", open);
  document
    .querySelector(".mobile-menu")
    .setAttribute("aria-expanded", String(open));
  if (open && mobile) sidebar.querySelector(".nav-list a").focus();
}
function updateShell(page) {
  document.querySelectorAll("[data-page]").forEach((el) => {
    const active = el.dataset.page === page;
    el.classList.toggle("active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  const name = views.PAGE_TITLES[page] || "Seite";
  document.getElementById("breadcrumb-page").textContent = name;
  document.title = `${name} · Paradise Kiss`;
  document.getElementById("article-count").textContent = activeProducts(
    ctx.data,
  ).length;
  document.getElementById("notification-dot").hidden =
    !ctx.settings.notifications || !ctx.data.products.some(isLowStock);
  document.getElementById("sidebar-mode").textContent =
    ctx.settings.source === "local"
      ? "Lokal auf diesem Gerät"
      : views.sourceName(ctx);
  document.getElementById("footer-status").innerHTML =
    `<span class="status-dot"></span>${e(ctx.settings.source === "local" ? "Lokaler Arbeitsbereich" : views.sourceName(ctx))}`;
  setMenu(false);
}
async function discover(silent = false) {
  try {
    const results = await Promise.all([api("sources/"), api("status/")]);
    ctx.sources = results[0].sources;
    ctx.serverStatus = results[1];
    if (!silent)
      toast(
        ctx.sources.length
          ? `${ctx.sources.length} Datenquelle(n) gefunden.`
          : "Django erreichbar. Noch keine Datenquelle konfiguriert.",
      );
    return true;
  } catch (error) {
    if (!silent) toast(error.message, true);
    return false;
  }
}
async function renderRoute() {
  const hash = location.hash || "#dashboard";
  if (
    formDirty &&
    hash !== lastHash &&
    !window.confirm("Ungespeicherte Änderungen verwerfen?")
  ) {
    history.replaceState(null, "", lastHash);
    return;
  }
  formDirty = false;
  lastHash = hash;
  const version = ++routeVersion;
  const [path, query = ""] = hash.slice(1).split("?"),
    segments = path.split("/"),
    page = segments[0] || "dashboard",
    params = new URLSearchParams(query);
  main.innerHTML = `<div class="loading">${icon("refresh")}Dein Arbeitsbereich wird geladen …</div>`;
  updateShell(page);
  try {
    const data = await repository(ctx.settings.source).snapshot();
    if (version !== routeVersion) return;
    ctx.data = data;
    updateShell(page);
    if (page === "dashboard") main.innerHTML = views.dashboard(ctx);
    else if (page === "articles") {
      if (segments[1] === "new") main.innerHTML = views.productEditor(ctx);
      else if (segments[1] && segments[2] === "edit")
        main.innerHTML = views.productEditor(
          ctx,
          decodeURIComponent(segments[1]),
        );
      else if (segments[1])
        main.innerHTML = views.productDetail(
          ctx,
          decodeURIComponent(segments[1]),
        );
      else {
        ctx.filters = {
          search: params.get("search") || "",
          status: params.get("status") || "",
          location: params.get("location") || "",
          sort: params.get("sort") || "name",
          page: 1,
        };
        main.innerHTML = views.articles(ctx);
      }
    } else if (page === "movements")
      main.innerHTML = views.movements(ctx, params);
    else if (page === "locations") main.innerHTML = views.locations(ctx);
    else if (page === "orders") main.innerHTML = views.orders(ctx, params);
    else if (page === "analytics") main.innerHTML = views.analytics(ctx);
    else if (page === "settings") main.innerHTML = views.settings(ctx);
    else if (page === "help") main.innerHTML = views.help();
    else main.innerHTML = views.notFound();
    if (page === "dashboard" || page === "analytics") await loadChart(version);
  } catch (error) {
    if (version !== routeVersion) return;
    if (page === "settings") main.innerHTML = views.settings(ctx);
    else if (page === "help") main.innerHTML = views.help();
    else
      main.innerHTML = emptyState(
        "Der Arbeitsbereich ist nicht erreichbar.",
        error.message,
        button("Erneut laden", "refresh", "refresh") +
          button("Verbindung verwalten", "connection", "database"),
        "warning",
      );
  }
}
async function loadChart(version = routeVersion) {
  const container = document.getElementById("chart-content");
  if (!container) return;
  const source =
    ctx.settings.chart.source === "active"
      ? ctx.settings.source
      : ctx.settings.chart.source;
  ctx.chartData = null;
  try {
    const data =
      source === ctx.settings.source
        ? ctx.data
        : await repository(source).snapshot();
    if (
      version !== routeVersion ||
      container !== document.getElementById("chart-content")
    )
      return;
    ctx.chartData = data;
    renderChart(container, data, ctx.settings.chart);
  } catch (error) {
    container.innerHTML = emptyState(
      "Diese Diagrammquelle ist nicht erreichbar.",
      error.message,
      button("Datenquelle wählen", "chart-settings", "settings", "small"),
      "database",
    );
  }
}
function refreshArticles() {
  document.getElementById("article-results").innerHTML =
    views.articleResults(ctx);
}
function confirmAction(title, description, callback, label = "Bestätigen") {
  pendingConfirmation = callback;
  showDialog(
    title,
    description,
    `<div class="modal-footer" style="margin-top:0;border:0;padding-top:0">${button("Abbrechen", "close-dialog")}${button(label, "confirm-action", "check", "primary")}</div>`,
  );
}
function notifications() {
  const low = ctx.data.products.filter(isLowStock);
  showDialog(
    "Ein Blick auf deine Bestände",
    `${low.length} Artikel liegen unter Mindestbestand.`,
    low.length
      ? `<div class="alert-list">${low.map((p) => `<div class="alert-item">${icon("warning")}<div><h3>${e(p.name)} · ${e(p.size)}</h3><p>${p.quantity} Stück verfügbar · Mindestbestand ${p.min_stock}</p></div>${button("Nachbestellen", "order-product", "plus", "small", `data-id="${e(p.id)}"`)}</div>`).join("")}</div>`
      : emptyState(
          "Alles im grünen Bereich.",
          "Aktuell gibt es keine Artikel unter Mindestbestand.",
          "",
          "check",
        ),
  );
}
async function switchSource(id) {
  await repository(id).snapshot();
  ctx.settings.source = id;
  persistPreferences();
  formDirty = false;
  closeDialog();
  if (location.hash === "#dashboard") await renderRoute();
  else location.hash = "#dashboard";
  toast(
    id === "local"
      ? "Lokaler Arbeitsbereich geöffnet."
      : "Datenquelle verbunden.",
  );
}
function exportArticles() {
  const rows = filterProducts(ctx.data, ctx.filters).map((p) => ({
    ...p,
    location: locationLabel(ctx.data, p.location_id),
  }));
  const columns = [
    ["sku", "Artikelnummer"],
    ["name", "Name"],
    ["description", "Beschreibung"],
    ["size", "Größe"],
    ["material", "Material"],
    ["gender", "Gender"],
    ["manufacturer", "Hersteller"],
    ["quantity", "Bestand"],
    ["min_stock", "Mindestbestand"],
    ["location", "Lagerort"],
    ["purchase_price", "Einkaufspreis EUR"],
    ["sale_price", "Verkaufspreis EUR"],
    ["last_sale_at", "Letzter Verkauf"],
    ["last_purchase_at", "Letzter Wareneingang"],
  ].map(([key, label]) => ({ key, label }));
  download(
    "paradise-kiss-artikel.csv",
    csv(rows, columns),
    "text/csv;charset=utf-8",
  );
  toast(`${rows.length} Artikel exportiert.`);
}

// Delegation keeps dynamic pages and dialogs simple: one click handler.
document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
    return;
  }
  if (
    event.target.closest('a[href^="#"]') &&
    document.getElementById("modal").open
  )
    closeDialog();
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action,
    id = target.dataset.id;
  try {
    if (action === "menu")
      setMenu(!document.body.classList.contains("menu-open"));
    else if (action === "close-menu") setMenu(false);
    else if (action === "close-dialog") closeDialog();
    else if (action === "dismiss-toast")
      document.getElementById("toast-region").innerHTML = "";
    else if (action === "dashboard-settings") dialogs.dashboardSettings(ctx);
    else if (action === "chart-settings") dialogs.chartSettings(ctx);
    else if (action === "notifications") notifications();
    else if (action === "connection") dialogs.connectionDialog(ctx);
    else if (action === "integration-help") dialogs.integrationHelp();
    else if (action === "connect-source") dialogs.loginDialog(ctx, id);
    else if (action === "use-local") await switchSource("local");
    else if (action === "discover-sources") {
      await discover();
      await renderRoute();
    } else if (action === "discover-dialog") {
      await discover();
      dialogs.connectionDialog(ctx);
    } else if (action === "logout") {
      tokens.delete(ctx.settings.source);
      await switchSource("local");
      toast("Abgemeldet. Lokaler Arbeitsbereich geöffnet.");
    } else if (action === "refresh") await renderRoute();
    else if (action === "widget-up" || action === "widget-down") {
      const row = target.closest(".widget-row");
      if (action === "widget-up" && row.previousElementSibling)
        row.parentNode.insertBefore(row, row.previousElementSibling);
      if (action === "widget-down" && row.nextElementSibling)
        row.parentNode.insertBefore(row.nextElementSibling, row);
      dialogs.updateWidgetButtons();
    } else if (action === "book") dialogs.openBooking(ctx);
    else if (action === "book-inbound")
      dialogs.openBooking(ctx, { type: "inbound" });
    else if (action === "book-sale") dialogs.openBooking(ctx, { type: "sale" });
    else if (action === "book-product")
      dialogs.openBooking(ctx, { productId: id });
    else if (action === "new-location")
      showDialog(
        "Einen Platz schaffen",
        "Regal und Fach eindeutig zuordnen.",
        views.locationForm(ctx),
      );
    else if (action === "edit-location")
      showDialog(
        "Lagerort bearbeiten",
        "Bestehende Artikelzuordnungen bleiben erhalten.",
        views.locationForm(ctx, id),
      );
    else if (action === "new-order") dialogs.openOrder(ctx);
    else if (action === "order-product") dialogs.openOrder(ctx, id);
    else if (action === "receive-order") {
      const o = ctx.data.orders.find((o) => o.id === id);
      if (o)
        dialogs.openBooking(ctx, {
          type: "inbound",
          productId: o.product_id,
          orderId: id,
        });
    } else if (action === "cancel-order")
      confirmAction(
        "Nachbestellung stornieren?",
        "Die Planung bleibt als storniert im Verlauf erhalten.",
        () => repository(ctx.settings.source).cancelOrder(id),
        "Stornieren",
      );
    else if (action === "archive-product")
      confirmAction(
        "Artikel archivieren?",
        "Der Artikel bleibt samt Buchungsverlauf im Archiv verfügbar.",
        () => repository(ctx.settings.source).archiveProduct(id, true),
        "Archivieren",
      );
    else if (action === "restore-product") {
      await repository(ctx.settings.source).archiveProduct(id, false);
      await renderRoute();
      toast("Artikel wieder aktiviert.");
    } else if (action === "confirm-action" && pendingConfirmation) {
      target.disabled = true;
      try {
        await pendingConfirmation();
        pendingConfirmation = null;
        closeDialog();
        await renderRoute();
        toast("Änderung gespeichert.");
      } finally {
        target.disabled = false;
      }
    } else if (action === "clear-filters") {
      ctx.filters = {
        search: "",
        status: "",
        location: "",
        sort: "name",
        page: 1,
      };
      history.replaceState(null, "", "#articles");
      lastHash = "#articles";
      main.innerHTML = views.articles(ctx);
    } else if (action === "prev-page") {
      ctx.filters.page--;
      refreshArticles();
    } else if (action === "next-page") {
      ctx.filters.page++;
      refreshArticles();
    } else if (action === "export-articles") exportArticles();
    else if (action === "export-movements") {
      const rows = ctx.movementRows.map((m) => ({
        ...m,
        article:
          ctx.data.products.find((p) => p.id === m.product_id)?.name || "",
        type: MOVEMENT_LABELS[m.type],
      }));
      download(
        "paradise-kiss-bewegungen.csv",
        csv(
          rows,
          [
            ["occurred_at", "Zeitpunkt"],
            ["article", "Artikel"],
            ["type", "Art"],
            ["delta", "Änderung"],
            ["stock_after", "Bestand danach"],
            ["reference", "Referenz"],
            ["note", "Notiz"],
          ].map(([key, label]) => ({ key, label })),
        ),
        "text/csv;charset=utf-8",
      );
      toast(`${rows.length} Buchungen exportiert.`);
    } else if (action === "export-chart") {
      if (!ctx.chartData)
        throw new Error("Die Diagrammquelle ist nicht geladen.");
      download(
        "paradise-kiss-diagramm.csv",
        csv(chartSeries(ctx.chartData, ctx.settings.chart), [
          { key: "label", label: "Gruppe" },
          {
            key: "value",
            label: ctx.settings.chart.metric === "value" ? "EUR" : "Stück",
          },
        ]),
        "text/csv;charset=utf-8",
      );
      toast("Diagrammdaten exportiert.");
    } else if (action === "backup") {
      const data =
        ctx.settings.source === "local"
          ? localStorage.getItem(DATA_KEY) || JSON.stringify(EMPTY_DATA)
          : JSON.stringify(
              await repository(ctx.settings.source).snapshot(),
              null,
              2,
            );
      download(
        `paradise-kiss-sicherung-${new Date().toISOString().slice(0, 10)}.json`,
        data,
        "application/json",
      );
      toast("Sicherung heruntergeladen.");
    } else if (action === "restore-backup")
      document.getElementById("restore-file").click();
    else if (action === "print") window.print();
  } catch (error) {
    toast(error.message, true);
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id === "global-search-form") {
    event.preventDefault();
    location.hash =
      "#articles?search=" + encodeURIComponent(form.elements.search.value);
    return;
  }
  if (form.id === "movement-filter") {
    event.preventDefault();
    location.hash = "#movements?" + new URLSearchParams(new FormData(form));
    return;
  }
  if (
    ![
      "product-form",
      "location-form",
      "booking-form",
      "order-form",
      "preferences-form",
      "dashboard-form",
      "chart-form",
      "login-form",
    ].includes(form.id)
  )
    return;
  event.preventDefault();
  if (form.dataset.busy === "true") return;
  form.dataset.busy = "true";
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  const errorBox = form.querySelector(".form-error");
  if (errorBox) errorBox.textContent = "";
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "product-form") {
      const product = await repository(ctx.settings.source).saveProduct(
        values,
        form.dataset.id,
      );
      formDirty = false;
      location.hash = `#articles/${encodeURIComponent(product.id)}`;
      toast("Artikel gespeichert.");
    } else if (form.id === "location-form") {
      await repository(ctx.settings.source).saveLocation(
        values,
        form.dataset.id,
      );
      closeDialog();
      await renderRoute();
      toast("Lagerort gespeichert.");
    } else if (form.id === "booking-form") {
      const input = dialogs.bookingValues(form);
      planMovement(ctx.data, input);
      await repository(ctx.settings.source).book(input);
      closeDialog();
      await renderRoute();
      toast("Warenbewegung gebucht.");
    } else if (form.id === "order-form") {
      await repository(ctx.settings.source).saveOrder(values);
      closeDialog();
      await renderRoute();
      toast("Nachbestellung geplant.");
    } else if (form.id === "preferences-form") {
      for (const key of [
        "contrast",
        "compact",
        "reduceMotion",
        "notifications",
      ])
        ctx.settings[key] = form.elements[key].checked;
      ctx.settings.theme = values.theme;
      persistPreferences();
      formDirty = false;
      updateShell("settings");
      toast("Einstellungen gespeichert.");
    } else if (form.id === "dashboard-form") {
      if (!values.dashboardTitle.trim() || !values.dashboardSubtitle.trim())
        throw new Error("Bitte Titel und Beschreibung ausfüllen.");
      ctx.settings.dashboardTitle = values.dashboardTitle.trim();
      ctx.settings.dashboardSubtitle = values.dashboardSubtitle.trim();
      ctx.settings.metrics = Object.keys(views.METRIC_TITLES).filter(
        (id) => form.elements["metric-" + id].checked,
      );
      ctx.settings.widgets = [...form.querySelectorAll(".widget-row")]
        .filter((row) => row.querySelector("input").checked)
        .map((row) => row.dataset.widget);
      persistPreferences();
      closeDialog();
      await renderRoute();
      toast("Dashboard angepasst.");
    } else if (form.id === "chart-form") {
      if (!values.title.trim())
        throw new Error("Bitte gib einen Diagrammtitel ein.");
      ctx.settings.chart = {
        ...values,
        title: values.title.trim(),
        days: Number(values.days || ctx.settings.chart.days),
      };
      persistPreferences();
      closeDialog();
      await renderRoute();
      toast("Diagramm angepasst.");
    } else if (form.id === "login-form") {
      const source = form.dataset.source,
        result = await api(
          "login/",
          { method: "POST", body: JSON.stringify(values) },
          source,
        );
      tokens.set(source, result.access_token);
      try {
        await switchSource(source);
      } catch (error) {
        tokens.delete(source);
        throw error;
      }
    }
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.scrollIntoView({ block: "nearest" });
    } else toast(error.message, true);
  } finally {
    form.dataset.busy = "false";
    submit.disabled = false;
  }
});

document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.closest("#product-form, #preferences-form")) formDirty = true;
  if (el.id === "article-search") {
    ctx.filters.search = el.value;
    ctx.filters.page = 1;
    refreshArticles();
  }
  if (el.closest("#booking-form")) dialogs.updateBookingPreview(ctx);
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (["article-status", "article-location", "article-sort"].includes(el.id)) {
    ctx.filters[el.id.replace("article-", "")] = el.value;
    ctx.filters.page = 1;
    refreshArticles();
  }
  if (el.closest("#product-form, #preferences-form")) formDirty = true;
  if (el.closest("#booking-form")) dialogs.updateBookingPreview(ctx);
  if (el.closest("#chart-form")) dialogs.updateChartFields();
  if (el.id === "chart-period") {
    ctx.settings.chart.days = Number(el.value);
    persistPreferences();
    if (location.hash.startsWith("#analytics")) await renderRoute();
    else await loadChart();
  }
  if (el.id === "restore-file") {
    const file = el.files[0];
    el.value = "";
    if (!file) return;
    try {
      if (ctx.settings.source !== "local")
        throw new Error(
          "Wiederherstellen ist nur im lokalen Arbeitsbereich möglich.",
        );
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Die Sicherung darf höchstens 20 MB groß sein.");
      const data = validateSnapshot(JSON.parse(await file.text()));
      confirmAction(
        "Lokalen Arbeitsbereich ersetzen?",
        `Die geprüfte Sicherung enthält ${data.products.length} Artikel, ${data.locations.length} Lagerorte und ${data.movements.length} Buchungen. Bisherige lokale Eingaben werden ersetzt. Sichere sie vorher, falls du sie noch benötigst.`,
        () => repository("local").restore(data),
        "Sicherung wiederherstellen",
      );
    } catch (error) {
      toast(error.message, true);
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !document.getElementById("modal").open &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    document.getElementById("global-search").focus();
  }
  if (event.key === "Escape") setMenu(false);
});
window.addEventListener("hashchange", () => {
  closeDialog();
  renderRoute();
  window.scrollTo(0, 0);
});
window.addEventListener("beforeunload", (event) => {
  if (formDirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === DATA_KEY && ctx.settings.source === "local") {
    if (formDirty || document.getElementById("modal").open)
      toast(
        "Bestände wurden in einem anderen Tab geändert. Vor dem Speichern wird der aktuelle Stand erneut geprüft.",
      );
    else renderRoute();
  }
});
hydrateIcons();
applyPreferences();
window
  .matchMedia("(max-width: 760px)")
  .addEventListener("change", () => setMenu(false));
if (location.port !== "4200") await discover(true);
await renderRoute();
