// Pure business rules. These functions know nothing about HTML or storage.
export const PRODUCT_TEXT_FIELDS = [
  "sku",
  "name",
  "description",
  "size",
  "material",
  "gender",
  "manufacturer",
  "location_id",
];
export const MOVEMENT_LABELS = {
  initial: "Anfangsbestand",
  inbound: "Wareneingang",
  sale: "Verkauf",
  outbound: "Warenausgang",
  correction: "Inventurkorrektur",
  transfer: "Umlagerung",
};
export const EMPTY_DATA = {
  version: 1,
  products: [],
  locations: [],
  movements: [],
  orders: [],
};
export const MAX_QUANTITY = 1000000000;

export function nonnegativeInteger(value, label) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  )
    throw new Error(`${label} fehlt.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > MAX_QUANTITY)
    throw new Error(
      `${label} muss eine ganze Zahl zwischen 0 und ${MAX_QUANTITY} sein.`,
    );
  return number;
}
export function price(value, label) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0 || number > 1000000000)
    throw new Error(`${label} ist ungültig.`);
  return Math.round(number * 100) / 100;
}
export function validateProduct(input, data, editId = "") {
  const product = {};
  for (const key of PRODUCT_TEXT_FIELDS)
    product[key] = String(input[key] || "").trim();
  for (const key of PRODUCT_TEXT_FIELDS) {
    if (product[key].length > (key === "description" ? 5000 : 200))
      throw new Error("Ein Textfeld ist zu lang.");
  }
  if (
    !product.name ||
    !product.sku ||
    !product.size ||
    !product.material ||
    !product.gender ||
    !product.manufacturer
  )
    throw new Error("Bitte fülle alle Pflichtfelder aus.");
  if (
    data.products.some(
      (p) =>
        p.id !== editId && p.sku.toLowerCase() === product.sku.toLowerCase(),
    )
  )
    throw new Error(
      "Diese Artikelnummer ist bereits vergeben, eventuell im Archiv.",
    );
  if (
    product.location_id &&
    !data.locations.some((l) => l.id === product.location_id)
  )
    throw new Error("Der Lagerort existiert nicht mehr.");
  product.min_stock = nonnegativeInteger(input.min_stock, "Mindestbestand");
  product.purchase_price = price(input.purchase_price, "Einkaufspreis");
  product.sale_price = price(input.sale_price, "Verkaufspreis");
  if (!editId)
    product.quantity = nonnegativeInteger(input.quantity, "Anfangsbestand");
  return product;
}
export function validateLocation(input, data, editId = "") {
  const location = {
    name: String(input.name || "").trim(),
    shelf: String(input.shelf || "").trim(),
    bin: String(input.bin || "").trim(),
    capacity: nonnegativeInteger(input.capacity, "Kapazität"),
  };
  if (!location.name || !location.shelf)
    throw new Error("Name und Regal sind erforderlich.");
  if ([location.name, location.shelf, location.bin].some((v) => v.length > 200))
    throw new Error("Die Bezeichnung ist zu lang.");
  if (
    data.locations.some(
      (l) =>
        l.id !== editId &&
        l.shelf.toLowerCase() === location.shelf.toLowerCase() &&
        l.bin.toLowerCase() === location.bin.toLowerCase(),
    )
  )
    throw new Error("Diese Kombination aus Regal und Fach gibt es schon.");
  const used = data.products
    .filter((p) => !p.archived && p.location_id === editId)
    .reduce((sum, p) => sum + p.quantity, 0);
  if (location.capacity && used > location.capacity)
    throw new Error("Die Kapazität liegt unter dem aktuellen Bestand.");
  return location;
}
export function checkCapacity(data, locationId, productId, quantity) {
  if (!locationId) return;
  const location = data.locations.find((l) => l.id === locationId);
  if (!location) throw new Error("Bitte wähle einen gültigen Lagerort.");
  const used = data.products
    .filter(
      (p) => !p.archived && p.id !== productId && p.location_id === locationId,
    )
    .reduce((sum, p) => sum + p.quantity, 0);
  if (location.capacity && used + quantity > location.capacity)
    throw new Error(
      `Am Lagerort ${location.name} ist nicht genug Platz (${location.capacity - used} Stück frei).`,
    );
}
export function planMovement(data, input) {
  const product = data.products.find(
    (p) => p.id === input.product_id && !p.archived,
  );
  if (!product) throw new Error("Bitte wähle einen aktiven Artikel.");
  if (
    !["inbound", "sale", "outbound", "correction", "transfer"].includes(
      input.type,
    )
  )
    throw new Error("Unbekannte Buchungsart.");
  const amount = nonnegativeInteger(
    input.quantity,
    input.type === "correction" ? "Gezählter Bestand" : "Menge",
  );
  if (!amount && input.type !== "correction" && input.type !== "transfer")
    throw new Error("Die Menge muss größer als null sein.");
  if (
    ["correction", "outbound", "transfer"].includes(input.type) &&
    !String(input.note || "").trim()
  )
    throw new Error("Bitte gib einen Grund für diese Buchung an.");
  let delta = amount;
  if (input.type === "sale" || input.type === "outbound") delta = -amount;
  if (input.type === "correction") delta = amount - product.quantity;
  if (input.type === "transfer") delta = 0;
  const stockAfter = product.quantity + delta;
  if (stockAfter < 0)
    throw new Error(
      `Nicht genug Bestand. Verfügbar: ${product.quantity} Stück.`,
    );
  if (stockAfter > MAX_QUANTITY)
    throw new Error("Die zulässige Bestandsgrenze ist überschritten.");
  const locationId =
    input.type === "transfer"
      ? String(input.to_location_id || "")
      : product.location_id;
  if (
    input.type === "transfer" &&
    (!locationId || locationId === product.location_id)
  )
    throw new Error("Bitte wähle einen anderen Ziel-Lagerort.");
  checkCapacity(data, locationId, product.id, stockAfter);
  let order = null;
  if (input.order_id) {
    order = data.orders.find(
      (o) => o.id === input.order_id && o.status === "open",
    );
    if (
      !order ||
      order.product_id !== product.id ||
      amount !== order.quantity ||
      input.type !== "inbound"
    )
      throw new Error(
        "Diese Bestellung wurde geändert oder bereits abgeschlossen.",
      );
  }
  return { product, delta, stockAfter, locationId, order, amount };
}
export function isLowStock(product) {
  return !product.archived && product.quantity < product.min_stock;
}
export function activeProducts(data) {
  return data.products.filter((p) => !p.archived);
}
export function locationLabel(data, id) {
  const location = data.locations.find((l) => l.id === id);
  return location
    ? `${location.shelf}${location.bin ? " · " + location.bin : ""}`
    : "Nicht zugeordnet";
}
export function stats(data) {
  const products = activeProducts(data);
  return {
    articles: products.length,
    units: products.reduce((n, p) => n + p.quantity, 0),
    low: products.filter(isLowStock).length,
    locations: data.locations.length,
    value: products.reduce((n, p) => n + p.quantity * p.purchase_price, 0),
  };
}
export function filterProducts(data, filter) {
  let rows = data.products.filter((p) =>
    filter.status === "archived" ? p.archived : !p.archived,
  );
  const query = String(filter.search || "").toLocaleLowerCase("de");
  if (query)
    rows = rows.filter((p) =>
      [p.name, p.sku, p.manufacturer, p.material, p.size, p.description]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(query),
    );
  if (filter.status === "low") rows = rows.filter(isLowStock);
  if (filter.status === "empty") rows = rows.filter((p) => p.quantity === 0);
  if (filter.location)
    rows = rows.filter((p) => p.location_id === filter.location);
  if (filter.gender) rows = rows.filter((p) => p.gender === filter.gender);
  rows.sort((a, b) => {
    if (filter.sort === "quantity-asc") return a.quantity - b.quantity;
    if (filter.sort === "quantity-desc") return b.quantity - a.quantity;
    if (filter.sort === "recent")
      return String(b.created_at).localeCompare(String(a.created_at));
    return a.name.localeCompare(b.name, "de", { numeric: true });
  });
  return rows;
}
export function chartSeries(data, config, now = new Date()) {
  const groups = new Map();
  const products = activeProducts(data);
  if (config.metric === "stock" || config.metric === "value") {
    for (const p of products) {
      const label =
        config.group === "location"
          ? locationLabel(data, p.location_id)
          : p[config.group] || "Nicht angegeben";
      const value =
        config.metric === "value" ? p.quantity * p.purchase_price : p.quantity;
      groups.set(label, (groups.get(label) || 0) + value);
    }
  } else {
    const start = new Date(now);
    start.setDate(start.getDate() - Number(config.days || 30) + 1);
    start.setHours(0, 0, 0, 0);
    for (const m of data.movements) {
      if (new Date(m.occurred_at) < start || new Date(m.occurred_at) > now)
        continue;
      if (config.metric === "sales" && m.type !== "sale") continue;
      if (
        config.metric === "inbound" &&
        m.type !== "inbound" &&
        m.type !== "initial"
      )
        continue;
      const p = data.products.find((p) => p.id === m.product_id);
      let label = "Unbekannt";
      if (config.group === "day") label = m.occurred_at.slice(0, 10);
      else if (config.group === "location")
        label = locationLabel(data, m.to_location_id || m.from_location_id);
      else label = p?.[config.group] || "Nicht angegeben";
      groups.set(label, (groups.get(label) || 0) + Math.abs(m.delta));
    }
  }
  const rows = [...groups].map(([label, value]) => ({
    label,
    value: Math.round(value * 100) / 100,
  }));
  rows.sort((a, b) =>
    config.group === "day" ? a.label.localeCompare(b.label) : b.value - a.value,
  );
  return rows;
}
export function salesRanking(data, days = 30, now = new Date()) {
  const start = new Date(now.getTime() - days * 86400000);
  return activeProducts(data)
    .map((p) => ({
      product: p,
      sold: data.movements
        .filter(
          (m) =>
            m.product_id === p.id &&
            m.type === "sale" &&
            new Date(m.occurred_at) >= start &&
            new Date(m.occurred_at) <= now,
        )
        .reduce((n, m) => n + Math.abs(m.delta), 0),
    }))
    .sort((a, b) => b.sold - a.sold);
}
export function csv(rows, columns) {
  function cell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  return (
    "\ufeff" +
    [
      columns.map((c) => cell(c.label)).join(";"),
      ...rows.map((row) => columns.map((c) => cell(row[c.key])).join(";")),
    ].join("\r\n")
  );
}
export function validateSnapshot(input) {
  if (!input || input.version !== 1)
    throw new Error("Diese Sicherung hat kein unterstütztes Format.");
  const clean = structuredClone(EMPTY_DATA);
  for (const collection of ["products", "locations", "movements", "orders"]) {
    if (!Array.isArray(input[collection]) || input[collection].length > 100000)
      throw new Error("Die Sicherung ist unvollständig oder zu groß.");
    const ids = new Set();
    for (const row of input[collection]) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !/^[\w-]{1,200}$/.test(row.id) ||
        ids.has(row.id)
      )
        throw new Error("Ungültige oder doppelte IDs in der Sicherung.");
      ids.add(row.id);
    }
  }
  for (const l of input.locations)
    clean.locations.push({ ...validateLocation(l, clean), id: l.id });
  for (const p of input.products) {
    const value = validateProduct(p, clean);
    if (
      typeof p.archived !== "boolean" ||
      !isDate(p.created_at) ||
      !isDate(p.updated_at)
    )
      throw new Error("Ungültiger Artikel in der Sicherung.");
    if (p.archived && value.quantity !== 0)
      throw new Error(
        "Archivierte Artikel müssen einen Bestand von null haben.",
      );
    clean.products.push({
      ...value,
      id: p.id,
      archived: p.archived,
      created_at: p.created_at,
      updated_at: p.updated_at,
      last_sale_at: isDate(p.last_sale_at) ? p.last_sale_at : null,
      last_purchase_at: isDate(p.last_purchase_at) ? p.last_purchase_at : null,
    });
  }
  for (const m of input.movements) {
    if (
      !MOVEMENT_LABELS[m.type] ||
      !clean.products.some((p) => p.id === m.product_id) ||
      !isDate(m.occurred_at) ||
      !Number.isSafeInteger(m.delta) ||
      Math.abs(m.delta) > MAX_QUANTITY
    )
      throw new Error("Ungültige Warenbewegung in der Sicherung.");
    clean.movements.push({
      id: m.id,
      product_id: m.product_id,
      type: m.type,
      quantity: nonnegativeInteger(m.quantity, "Menge"),
      delta: m.delta,
      stock_after: nonnegativeInteger(m.stock_after, "Bestand"),
      occurred_at: m.occurred_at,
      note: String(m.note || "").slice(0, 2000),
      reference: String(m.reference || "").slice(0, 200),
      from_location_id: String(m.from_location_id || ""),
      to_location_id: String(m.to_location_id || ""),
    });
  }
  for (const o of input.orders) {
    if (
      !clean.products.some((p) => p.id === o.product_id) ||
      !["open", "received", "cancelled"].includes(o.status) ||
      !isDate(o.created_at) ||
      (o.expected_date && !/^\d{4}-\d{2}-\d{2}$/.test(o.expected_date))
    )
      throw new Error("Ungültige Bestellung in der Sicherung.");
    const quantity = nonnegativeInteger(o.quantity, "Bestellmenge");
    if (!quantity)
      throw new Error("Eine Bestellung braucht eine positive Menge.");
    clean.orders.push({
      id: o.id,
      product_id: o.product_id,
      quantity,
      status: o.status,
      created_at: o.created_at,
      expected_date: o.expected_date || "",
      note: String(o.note || "").slice(0, 2000),
    });
  }
  for (const p of clean.products)
    checkCapacity(clean, p.location_id, p.id, p.quantity);
  return clean;
}
function isDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
