// Synthetic records exist only in isolated test memory, never in the application.
import test from "node:test";
import assert from "node:assert/strict";
import { LocalRepository, DATA_KEY } from "../frontend/js/store.js";
import {
  EMPTY_DATA,
  isLowStock,
  chartSeries,
  csv,
  filterProducts,
  validateSnapshot,
} from "../frontend/js/domain.js";

function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  return { repo: new LocalRepository(storage), storage };
}
const article = {
  sku: "QA-1",
  name: "Prüfartikel",
  size: "M",
  material: "Baumwolle",
  gender: "Unisex",
  manufacturer: "Prüflieferant",
  description: "",
  location_id: "",
  quantity: 10,
  min_stock: 5,
  purchase_price: 12.5,
  sale_price: 24.9,
};
test("A fresh workspace is empty and does not create storage", async () => {
  const { repo, storage } = setup();
  assert.deepEqual(await repo.snapshot(), EMPTY_DATA);
  assert.equal(storage.getItem(DATA_KEY), null);
});
test("Creation records initial stock; duplicate SKU is rejected case-insensitively", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  const data = await repo.snapshot();
  assert.equal(data.products[0].quantity, 10);
  assert.equal(data.movements[0].delta, 10);
  assert.equal(data.movements[0].product_id, p.id);
  await assert.rejects(
    repo.saveProduct({ ...article, sku: "qa-1" }),
    /bereits vergeben/,
  );
});
test("A sale updates stock, its audit entry and last sale date atomically", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  await repo.book({ product_id: p.id, type: "sale", quantity: 6 });
  const data = await repo.snapshot();
  assert.equal(data.products[0].quantity, 4);
  assert.ok(isLowStock(data.products[0]));
  assert.equal(data.movements[0].delta, -6);
  assert.ok(data.products[0].last_sale_at);
});
test("Overselling and fractions leave both stock and ledger unchanged", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  const before = await repo.snapshot();
  await assert.rejects(
    repo.book({ product_id: p.id, type: "sale", quantity: 11 }),
    /Nicht genug/,
  );
  await assert.rejects(
    repo.book({ product_id: p.id, type: "inbound", quantity: 1.5 }),
    /ganze Zahl/,
  );
  assert.deepEqual(await repo.snapshot(), before);
});
test("Inventory correction uses the counted total and requires a reason", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  await assert.rejects(
    repo.book({ product_id: p.id, type: "correction", quantity: 0 }),
    /Grund/,
  );
  await repo.book({
    product_id: p.id,
    type: "correction",
    quantity: 3,
    note: "Zählung",
  });
  const data = await repo.snapshot();
  assert.equal(data.products[0].quantity, 3);
  assert.equal(data.movements[0].delta, -7);
});
test("Location capacities, unique bins and full-stock transfers are enforced", async () => {
  const { repo } = setup();
  const a = await repo.saveLocation({
    name: "A",
    shelf: "A",
    bin: "1",
    capacity: 10,
  });
  const b = await repo.saveLocation({
    name: "B",
    shelf: "B",
    bin: "2",
    capacity: 20,
  });
  await assert.rejects(
    repo.saveLocation({ name: "Andere", shelf: "a", bin: "1", capacity: 0 }),
    /gibt es schon/,
  );
  const p = await repo.saveProduct({ ...article, location_id: a.id });
  await assert.rejects(
    repo.book({ product_id: p.id, type: "inbound", quantity: 1 }),
    /nicht genug Platz/,
  );
  await repo.book({
    product_id: p.id,
    type: "transfer",
    quantity: 0,
    to_location_id: b.id,
    note: "Neu sortiert",
  });
  const data = await repo.snapshot();
  assert.equal(data.products[0].location_id, b.id);
  assert.equal(data.products[0].quantity, 10);
  assert.equal(data.movements[0].delta, 0);
  assert.equal(data.movements[0].quantity, 10);
});
test("Editing metadata cannot bypass the stock or transfer workflow", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  await repo.saveProduct({ ...article, name: "Geändert", quantity: 999 }, p.id);
  assert.equal((await repo.snapshot()).products[0].quantity, 10);
});
test("Receiving an order closes it and prevents a second receipt", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct(article);
  const order = await repo.saveOrder({ product_id: p.id, quantity: 5 });
  const input = {
    product_id: p.id,
    quantity: 5,
    type: "inbound",
    order_id: order.id,
  };
  await repo.book(input);
  await assert.rejects(repo.book(input), /bereits abgeschlossen/);
  const data = await repo.snapshot();
  assert.equal(data.products[0].quantity, 15);
  assert.equal(data.orders[0].status, "received");
});
test("Archival is reversible and requires zero stock and no open orders", async () => {
  const { repo } = setup();
  const p = await repo.saveProduct({ ...article, quantity: 0 });
  const order = await repo.saveOrder({ product_id: p.id, quantity: 5 });
  await assert.rejects(repo.archiveProduct(p.id, true), /offene Bestellungen/);
  await repo.cancelOrder(order.id);
  await repo.archiveProduct(p.id, true);
  assert.equal(
    filterProducts(await repo.snapshot(), { status: "archived" }).length,
    1,
  );
  await repo.archiveProduct(p.id, false);
  assert.equal((await repo.snapshot()).products[0].archived, false);
});
test("Chart aggregates genuine movement data within the selected window", () => {
  const data = structuredClone(EMPTY_DATA);
  data.products = [{ ...article, id: "1", archived: false }];
  data.movements = [
    {
      product_id: "1",
      type: "sale",
      delta: -3,
      occurred_at: "2026-09-20T10:00:00Z",
    },
    {
      product_id: "1",
      type: "sale",
      delta: -8,
      occurred_at: "2025-01-01T00:00:00Z",
    },
  ];
  assert.deepEqual(
    chartSeries(
      data,
      { metric: "sales", group: "manufacturer", days: 30 },
      new Date("2026-09-21T12:00:00Z"),
    ),
    [{ label: "Prüflieferant", value: 3 }],
  );
  assert.deepEqual(
    chartSeries(EMPTY_DATA, { metric: "stock", group: "size" }),
    [],
  );
});
test("Backup validation prevents orphan records and restore can repair corrupt storage", async () => {
  const { repo, storage } = setup();
  const p = await repo.saveProduct(article);
  const backup = await repo.snapshot();
  const invalid = structuredClone(backup);
  invalid.movements[0].product_id = "missing";
  assert.throws(() => validateSnapshot(invalid), /Ungültige Warenbewegung/);
  storage.setItem(DATA_KEY, "{broken");
  await assert.rejects(repo.snapshot(), /beschädigt/);
  await repo.restore(backup);
  assert.equal((await repo.snapshot()).products[0].id, p.id);
});
test("CSV handles quotation marks, line breaks and spreadsheet formulas", () => {
  const result = csv(
    [{ name: "=1+1" }, { name: 'a"b\nc' }],
    [{ key: "name", label: "Name" }],
  );
  assert.ok(result.includes('"\'=1+1"'));
  assert.ok(result.includes('"a""b\nc"'));
});
test("Storage failure never reports success", async () => {
  const repo = new LocalRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  });
  await assert.rejects(repo.saveProduct(article), /Quota/);
});
