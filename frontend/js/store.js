import {
  EMPTY_DATA,
  validateProduct,
  validateLocation,
  checkCapacity,
  planMovement,
  nonnegativeInteger,
  validateSnapshot,
} from "./domain.js";

export const DATA_KEY = "paradise-kiss.inventory.v1";
export const SETTINGS_KEY = "paradise-kiss.settings.v1";
export const DEFAULT_SETTINGS = {
  source: "local",
  theme: "miami",
  compact: false,
  contrast: false,
  reduceMotion: false,
  widgets: ["welcome", "metrics", "chart", "quick", "articles"],
  chart: {
    title: "Dein Lager in Zahlen",
    source: "active",
    metric: "stock",
    group: "manufacturer",
    type: "bar",
    days: 30,
  },
  notifications: true,
  dashboardTitle: "Alles im Blick.",
  dashboardSubtitle: "Dein Lager, deine Kollektion, dein nächster Schritt.",
  metrics: ["articles", "units", "low", "locations"],
};
export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      chart: { ...DEFAULT_SETTINGS.chart, ...stored.chart },
    };
    settings.widgets = Array.isArray(stored.widgets)
      ? [
          ...new Set(
            stored.widgets.filter((w) => DEFAULT_SETTINGS.widgets.includes(w)),
          ),
        ]
      : [...DEFAULT_SETTINGS.widgets];
    if (typeof settings.source !== "string") settings.source = "local";
    for (const key of ["dashboardTitle", "dashboardSubtitle"]) {
      if (typeof settings[key] !== "string" || !settings[key].trim())
        settings[key] = DEFAULT_SETTINGS[key];
    }
    settings.metrics = Array.isArray(stored.metrics)
      ? [
          ...new Set(
            stored.metrics.filter((key) =>
              [
                "articles",
                "units",
                "low",
                "locations",
                "value",
                "orders",
              ].includes(key),
            ),
          ),
        ]
      : [...DEFAULT_SETTINGS.metrics];
    if (!["miami", "dusk"].includes(settings.theme)) settings.theme = "miami";
    for (const key of [
      "compact",
      "contrast",
      "reduceMotion",
      "notifications",
    ]) {
      if (typeof settings[key] !== "boolean")
        settings[key] = DEFAULT_SETTINGS[key];
    }
    const chart = settings.chart;
    if (typeof chart.title !== "string" || !chart.title.trim())
      chart.title = DEFAULT_SETTINGS.chart.title;
    if (typeof chart.source !== "string") chart.source = "active";
    if (!["stock", "value", "sales", "inbound"].includes(chart.metric))
      chart.metric = "stock";
    if (
      ![
        "manufacturer",
        "gender",
        "size",
        "material",
        "location",
        "day",
      ].includes(chart.group)
    )
      chart.group = "manufacturer";
    if (["stock", "value"].includes(chart.metric) && chart.group === "day")
      chart.group = "manufacturer";
    if (!["bar", "line"].includes(chart.type)) chart.type = "bar";
    if (![7, 30, 90, 365].includes(Number(chart.days))) chart.days = 30;
    return settings;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export class LocalRepository {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }
  async snapshot() {
    const raw = this.storage.getItem(DATA_KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    try {
      return validateSnapshot(JSON.parse(raw));
    } catch {
      throw new Error(
        "Die lokalen Daten sind beschädigt. Exportiere sie in den Einstellungen zur Wiederherstellung; sie werden nicht überschrieben.",
      );
    }
  }
  // A Web Lock serializes writes between tabs. Each operation reads the latest state.
  async change(callback) {
    const run = async () => {
      const data = await this.snapshot();
      const result = callback(data);
      this.storage.setItem(DATA_KEY, JSON.stringify(data));
      return result;
    };
    if (globalThis.navigator?.locks)
      return navigator.locks.request(DATA_KEY, run);
    return run();
  }
  async saveProduct(input, id = "") {
    return this.change((data) => {
      const values = validateProduct(input, data, id);
      const now = new Date().toISOString();
      if (id) {
        const product = data.products.find((p) => p.id === id);
        if (!product || product.archived)
          throw new Error("Dieser Artikel kann nicht mehr bearbeitet werden.");
        // Moves and stock changes have their own audited booking workflow.
        values.location_id = product.location_id;
        Object.assign(product, values, { updated_at: now });
        return product;
      }
      checkCapacity(data, values.location_id, "", values.quantity);
      const product = {
        ...values,
        id: crypto.randomUUID(),
        archived: false,
        created_at: now,
        updated_at: now,
        last_sale_at: null,
        last_purchase_at: values.quantity ? now : null,
      };
      data.products.push(product);
      if (values.quantity)
        data.movements.push({
          id: crypto.randomUUID(),
          product_id: product.id,
          type: "initial",
          quantity: values.quantity,
          delta: values.quantity,
          stock_after: values.quantity,
          occurred_at: now,
          note: "Anfangsbestand bei Artikelanlage",
          reference: "",
          from_location_id: "",
          to_location_id: values.location_id,
        });
      return product;
    });
  }
  async saveLocation(input, id = "") {
    return this.change((data) => {
      const values = validateLocation(input, data, id);
      if (id) {
        const location = data.locations.find((l) => l.id === id);
        if (!location) throw new Error("Lagerort nicht gefunden.");
        Object.assign(location, values);
        return location;
      }
      const location = { ...values, id: crypto.randomUUID() };
      data.locations.push(location);
      return location;
    });
  }
  async book(input) {
    return this.change((data) => {
      const plan = planMovement(data, input);
      const now = new Date().toISOString();
      const movement = {
        id: crypto.randomUUID(),
        product_id: plan.product.id,
        type: input.type,
        quantity:
          input.type === "transfer" ? plan.product.quantity : plan.amount,
        delta: plan.delta,
        stock_after: plan.stockAfter,
        occurred_at: now,
        note: String(input.note || "")
          .trim()
          .slice(0, 2000),
        reference: String(input.reference || "")
          .trim()
          .slice(0, 200),
        from_location_id: plan.product.location_id,
        to_location_id: plan.locationId,
      };
      plan.product.quantity = plan.stockAfter;
      plan.product.location_id = plan.locationId;
      plan.product.updated_at = now;
      if (input.type === "sale") plan.product.last_sale_at = now;
      if (input.type === "inbound") plan.product.last_purchase_at = now;
      if (plan.order) plan.order.status = "received";
      data.movements.unshift(movement);
      return movement;
    });
  }
  async saveOrder(input) {
    return this.change((data) => {
      if (!data.products.some((p) => p.id === input.product_id && !p.archived))
        throw new Error("Bitte wähle einen aktiven Artikel.");
      const quantity = nonnegativeInteger(input.quantity, "Bestellmenge");
      if (!quantity)
        throw new Error("Die Bestellmenge muss größer als null sein.");
      const date = String(input.expected_date || "");
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)))
      )
        throw new Error("Ungültiges Lieferdatum.");
      const order = {
        id: crypto.randomUUID(),
        product_id: input.product_id,
        quantity,
        expected_date: date,
        status: "open",
        created_at: new Date().toISOString(),
        note: String(input.note || "")
          .trim()
          .slice(0, 2000),
      };
      data.orders.unshift(order);
      return order;
    });
  }
  async cancelOrder(id) {
    return this.change((data) => {
      const o = data.orders.find((o) => o.id === id);
      if (!o || o.status !== "open")
        throw new Error("Diese Bestellung ist nicht mehr offen.");
      o.status = "cancelled";
    });
  }
  async archiveProduct(id, archived) {
    return this.change((data) => {
      const p = data.products.find((p) => p.id === id);
      if (!p) throw new Error("Artikel nicht gefunden.");
      if (
        archived &&
        (p.quantity !== 0 ||
          data.orders.some((o) => o.product_id === id && o.status === "open"))
      )
        throw new Error(
          "Nur Artikel ohne Bestand und ohne offene Bestellungen können archiviert werden.",
        );
      p.archived = archived;
      p.updated_at = new Date().toISOString();
    });
  }
  async restore(input) {
    const clean = validateSnapshot(input);
    const run = () => this.storage.setItem(DATA_KEY, JSON.stringify(clean));
    if (globalThis.navigator?.locks)
      return navigator.locks.request(DATA_KEY, run);
    return run();
  }
}

// Remote requests use the same contract. No keys, URLs or table names live here.
// Login tokens remain in memory and are scoped to one configured data source.
export const tokens = new Map();
export async function api(path, options = {}, source = "") {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (tokens.has(source))
    headers.Authorization = `Bearer ${tokens.get(source)}`;
  const separator = path.includes("?") ? "&" : "?";
  let response;
  try {
    response = await fetch(
      `/api/${path}${source ? separator + "source=" + encodeURIComponent(source) : ""}`,
      { ...options, headers, signal: AbortSignal.timeout(20000) },
    );
  } catch {
    throw new Error(
      "Django ist nicht erreichbar. Starte das Backend und öffne die Anwendung über dessen Adresse.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Diese Adresse bietet keine Django-API. Öffne die Anwendung über das Django-Backend.",
    );
  }
  if (!response.ok)
    throw new Error(
      result.error || `Anfrage fehlgeschlagen (${response.status}).`,
    );
  return result;
}
export class ApiRepository {
  constructor(source) {
    this.source = source;
  }
  snapshot() {
    return api("snapshot/", {}, this.source);
  }
  command(action, payload) {
    return api(
      "command/",
      { method: "POST", body: JSON.stringify({ action, payload }) },
      this.source,
    );
  }
  saveProduct(input, id = "") {
    return this.command(id ? "update_product" : "create_product", {
      ...input,
      id,
    });
  }
  saveLocation(input, id = "") {
    return this.command(id ? "update_location" : "create_location", {
      ...input,
      id,
    });
  }
  book(input) {
    return this.command("book_movement", input);
  }
  saveOrder(input) {
    return this.command("create_order", input);
  }
  cancelOrder(id) {
    return this.command("cancel_order", { id });
  }
  archiveProduct(id, archived) {
    return this.command("archive_product", { id, archived });
  }
}
export function repository(source) {
  return source === "local" ? new LocalRepository() : new ApiRepository(source);
}
