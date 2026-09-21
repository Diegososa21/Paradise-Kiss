// Run only in a dedicated QA browser. Restores the exact original browser storage.
// Usage: Get-Content tests/browser-check.js -Raw | npx agent-browser --session paradise-qa eval --stdin
(async () => {
  const dataKey = "paradise-kiss.inventory.v1";
  const settingsKey = "paradise-kiss.settings.v1";
  const originalData = localStorage.getItem(dataKey);
  const originalSettings = localStorage.getItem(settingsKey);
  const results = [];
  const failures = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const find = (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error("Element fehlt: " + selector);
    return el;
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  async function until(predicate, label) {
    for (let i = 0; i < 80; i++) {
      if (predicate()) return;
      await sleep(50);
    }
    throw new Error(
      "Zeitlimit: " +
        label +
        ". " +
        document.querySelector(".form-error")?.textContent,
    );
  }
  async function route(hash, selector) {
    location.hash = hash;
    await until(() => document.querySelector(selector), hash);
  }
  function fill(name, value) {
    const el = find('form [name="' + name + '"]');
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const click = (selector) => find(selector).click();
  const snapshot = () => JSON.parse(localStorage.getItem(dataKey));
  try {
    localStorage.removeItem(dataKey);
    await route("#dashboard", ".welcome-banner");
    await route("#locations", '[data-action="new-location"]');
    click('[data-action="new-location"]');
    fill("name", "QA Regal");
    fill("shelf", "QA-A");
    fill("bin", "1");
    fill("capacity", "100");
    find("#location-form").requestSubmit();
    await until(
      () => !find("#modal").open && document.querySelector(".location-card"),
      "Lagerort speichern",
    );
    assert(
      snapshot().locations.length === 1,
      "Lagerort über Formular angelegt",
    );
    const locationId = snapshot().locations[0].id;

    await route("#articles/new", "#product-form");
    fill("name", "QA <b>Artikel</b>");
    fill("sku", "QA-BROWSER");
    fill("manufacturer", "QA Hersteller");
    fill("size", "M");
    fill("material", "Baumwolle");
    fill("quantity", "10");
    fill("min_stock", "5");
    fill("location_id", locationId);
    fill("purchase_price", "12.50");
    fill("sale_price", "25");
    find("#product-form").requestSubmit();
    await until(
      () => document.querySelector(".stock-big"),
      "Artikel speichern",
    );
    assert(
      snapshot().products[0].quantity === 10,
      "Artikel mit Anfangsbestand gespeichert",
    );
    assert(
      find("h1").textContent === "QA <b>Artikel</b>" &&
        !find("h1").querySelector("b"),
      "Benutzereingaben werden als Text dargestellt",
    );
    const productId = snapshot().products[0].id;

    click('[data-action="book-product"]');
    fill("type", "sale");
    fill("quantity", "11");
    find("#booking-form").requestSubmit();
    await until(
      () =>
        find("#booking-form .form-error").textContent.includes("Nicht genug"),
      "Überverkauf abgewiesen",
    );
    assert(
      snapshot().products[0].quantity === 10,
      "Überverkauf ändert keine Daten",
    );
    fill("quantity", "7");
    find("#booking-form").requestSubmit();
    await until(
      () => !find("#modal").open && snapshot().products[0].quantity === 3,
      "Verkauf",
    );
    assert(
      snapshot().movements.length === 2,
      "Verkauf erzeugt Verlauf und verringert Bestand",
    );

    click('[data-action="notifications"]');
    assert(
      Boolean(document.querySelector(".alert-item")),
      "Mindestbestandswarnung im Dialog sichtbar",
    );
    click('[data-action="order-product"]');
    fill("quantity", "6");
    find("#order-form").requestSubmit();
    await until(() => !find("#modal").open, "Bestellung speichern");
    await route("#orders", '[data-action="receive-order"]');
    click('[data-action="receive-order"]');
    find("#booking-form").requestSubmit();
    await until(
      () => !find("#modal").open && snapshot().orders[0].status === "received",
      "Wareneingang Bestellung",
    );
    assert(
      snapshot().products[0].quantity === 9,
      "Lieferung erhöht Bestand und schließt Bestellung",
    );

    await route("#articles/" + productId + "/edit", "#product-form");
    fill("description", "Über die Oberfläche angepasst.");
    find("#product-form").requestSubmit();
    await until(
      () => document.querySelector(".stock-big"),
      "Metadaten speichern",
    );
    assert(
      snapshot().products[0].description === "Über die Oberfläche angepasst.",
      "Artikeldaten bearbeitet",
    );

    await route("#dashboard", ".welcome-banner");
    click('[data-action="dashboard-settings"]');
    fill("dashboardTitle", "QA Dashboard");
    find('[name="metric-value"]').checked = true;
    find('[name="welcome"]').checked = false;
    click('[data-widget="articles"] [data-action="widget-up"]');
    find("#dashboard-form").requestSubmit();
    await until(
      () => !find("#modal").open && !document.querySelector(".welcome-banner"),
      "Dashboard konfigurieren",
    );
    assert(
      !JSON.parse(localStorage.getItem(settingsKey)).widgets.includes(
        "welcome",
      ),
      "Dashboard-Sichtbarkeit dauerhaft gespeichert",
    );
    assert(
      find("h1").textContent === "QA Dashboard" &&
        JSON.parse(localStorage.getItem(settingsKey)).metrics.includes("value"),
      "Dashboard-Titel und Kennzahlen angepasst",
    );

    click('[data-action="chart-settings"]');
    fill("metric", "sales");
    fill("group", "day");
    fill("type", "line");
    find("#chart-form").requestSubmit();
    await until(() => document.querySelector(".chart-svg"), "Echtes Diagramm");
    assert(
      find(".chart-table").textContent.includes("7"),
      "Diagramm zeigt tatsächliche sieben verkaufte Stück",
    );

    await route("#articles?status=low", "#article-results");
    assert(
      !document.querySelector(".product-name"),
      "Bestandsfilter schließt ausreichend bevorratete Artikel aus",
    );
    click('[data-action="clear-filters"]');
    assert(
      Boolean(document.querySelector(".product-name")),
      "Filter können zurückgesetzt werden",
    );
    await route("#articles/" + productId, ".stock-big");
    click('[data-action="book-product"]');
    fill("type", "correction");
    fill("quantity", "0");
    fill("note", "QA Inventur");
    find("#booking-form").requestSubmit();
    await until(
      () => !find("#modal").open && snapshot().products[0].quantity === 0,
      "Inventurkorrektur",
    );
    click('[data-action="archive-product"]');
    click('[data-action="confirm-action"]');
    await until(
      () => document.querySelector('[data-action="restore-product"]'),
      "Archivierung",
    );
    assert(
      snapshot().products[0].archived,
      "Archivierung nach Inventur funktioniert",
    );
    click('[data-action="restore-product"]');
    await until(
      () => document.querySelector('[data-action="archive-product"]'),
      "Wiederherstellung",
    );
    assert(
      !snapshot().products[0].archived,
      "Artikel aus dem Archiv wiederhergestellt",
    );
    await route("#settings", "#preferences-form");
    find('[name="contrast"]').checked = true;
    find('[name="compact"]').checked = true;
    find("#preferences-form").requestSubmit();
    await until(
      () => document.body.classList.contains("high-contrast"),
      "Einstellungen",
    );
    assert(
      document.body.classList.contains("compact"),
      "Darstellungseinstellungen werden angewendet",
    );
  } catch (error) {
    failures.push(error.message);
  } finally {
    const form = document.querySelector("#product-form");
    if (form) {
      // Mark the editor clean by returning to its unchanged route, then continue cleanup.
      form.dispatchEvent(new Event("reset", { bubbles: true }));
    }
    if (originalData === null) localStorage.removeItem(dataKey);
    else localStorage.setItem(dataKey, originalData);
    if (originalSettings === null) localStorage.removeItem(settingsKey);
    else localStorage.setItem(settingsKey, originalSettings);
    const modal = document.getElementById("modal");
    if (modal.open) modal.close();
    location.hash = "#dashboard";
  }
  return { passed: results, failures, restoredOriginalStorage: true };
})();
