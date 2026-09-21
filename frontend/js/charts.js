import { chartSeries } from "./domain.js";
import { escapeHtml as e, number, button } from "./ui.js";
import { icon } from "./icons.js";
export const METRICS = [
  { value: "stock", label: "Aktueller Bestand" },
  { value: "sales", label: "Verkaufte Stück" },
  { value: "inbound", label: "Wareneingänge" },
  { value: "value", label: "Lagerwert (EK)" },
];
export const GROUPS = [
  { value: "manufacturer", label: "Hersteller" },
  { value: "gender", label: "Gender" },
  { value: "size", label: "Größe" },
  { value: "material", label: "Material" },
  { value: "location", label: "Lagerort" },
  { value: "day", label: "Tag" },
];
export function chartPanel(config, sourceLabel, full = false) {
  return `<section class="panel chart-panel"><div class="panel-head"><div><h2>${e(config.title)}</h2><p>${e(METRICS.find((m) => m.value === config.metric)?.label || "Bestand")} nach ${e(GROUPS.find((g) => g.value === config.group)?.label || "Hersteller")}</p></div><div class="chart-controls"><select id="chart-period" aria-label="Diagramm-Zeitraum" ${["stock", "value"].includes(config.metric) ? 'disabled title="Aktueller Bestand ist eine Momentaufnahme"' : ""}>${[7, 30, 90, 365].map((n) => `<option value="${n}" ${Number(config.days) === n ? "selected" : ""}>Letzte ${n} Tage</option>`).join("")}</select><button class="icon-button" data-action="chart-settings" aria-label="Diagramm konfigurieren">${icon("settings")}</button></div></div><div class="chart-legend"><span><i class="legend-dot"></i>${e(config.metric === "value" ? "Wert in EUR" : "Stück")}</span><span>Quelle: ${e(sourceLabel)}</span></div><div id="chart-content" class="chart-area" data-full="${full}"></div></section>`;
}
export function renderChart(container, data, config) {
  if (!container) return;
  const rows = chartSeries(data, config);
  if (!rows.length) {
    container.innerHTML = `<div class="chart-grid"><span></span><span></span><span></span><span></span><span></span></div><div class="chart-empty"><span class="empty-icon">${icon("chart")}</span><h3>Hier werden deine Daten sichtbar.</h3><p>Für diese Auswahl liegen noch keine Daten vor. Wähle eine Quelle oder erfasse deine ersten Artikel.</p><button class="text-link" data-action="chart-settings">Diagramm einrichten ${icon("arrow-right")}</button></div>`;
    return;
  }
  const visible = config.type === "line" ? rows.slice(-30) : rows.slice(0, 12);
  const max = Math.max(1, ...visible.map((r) => r.value));
  let html = "";
  if (config.type === "line") {
    const coordinates = visible.map((r, i) => ({
      x: 30 + (visible.length === 1 ? 280 : (i / (visible.length - 1)) * 560),
      y: 167 - (r.value / max) * 135,
      ...r,
    }));
    html = `<svg class="chart-svg" viewBox="0 0 620 210" role="img" aria-label="${e(config.title)}. Die exakten Werte stehen in der Datentabelle darunter."><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d48fba" stop-opacity=".3"/><stop offset="1" stop-color="#d48fba" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3].map((i) => `<line x1="30" x2="590" y1="${32 + i * 45}" y2="${32 + i * 45}" stroke="#eae2ef" stroke-dasharray="4 4"/><text x="0" y="${35 + i * 45}">${number(max * (1 - i / 3))}</text>`).join("")}<polygon points="${coordinates[0].x},167 ${coordinates.map((p) => `${p.x},${p.y}`).join(" ")} ${coordinates.at(-1).x},167" fill="url(#chart-fill)"/><polyline points="${coordinates.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#c378a3" stroke-width="2.5" stroke-linejoin="round"/>${coordinates.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#c378a3"><title>${e(p.label)}: ${number(p.value)}</title></circle>`).join("")}<text x="30" y="200">${e(visible[0].label)}</text><text x="590" y="200" text-anchor="end">${e(visible.at(-1).label)}</text></svg>`;
  } else {
    html = `<div class="bars" role="img" aria-label="${e(config.title)}. Werte in der Datentabelle.">${visible.map((row) => `<div class="bar-row"><span class="bar-label" title="${e(row.label)}">${e(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, (row.value / max) * 100)}%"></div></div><span class="bar-value">${number(row.value)}</span></div>`).join("")}</div>`;
  }
  if (rows.length > visible.length)
    html += `<p class="muted" style="font-size:10px">${config.type === "line" ? "Die letzten 30 Gruppen" : "Die 12 größten Gruppen"} · Alle Werte in der Tabelle.</p>`;
  html += `<details class="chart-table"><summary>Werte als Tabelle ansehen (${rows.length})</summary><div class="table-scroll"><table><thead><tr><th scope="col">Gruppe</th><th scope="col">${config.metric === "value" ? "EUR" : "Stück"}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(r.label)}</td><td>${number(r.value)}</td></tr>`).join("")}</tbody></table></div>${button("Diagrammdaten exportieren", "export-chart", "download", "small")}</details>`;
  container.innerHTML = html;
}
