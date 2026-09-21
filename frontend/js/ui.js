import { icon } from "./icons.js";
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const number = (value) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(
    Number(value) || 0,
  );
export const money = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    Number(value) || 0,
  );
export function date(value, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return "Noch nicht erfasst";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
export function button(
  label,
  action,
  iconName = "",
  className = "",
  extra = "",
) {
  return `<button type="button" class="button ${className}" data-action="${action}" ${extra}>${iconName ? icon(iconName) : ""}${escapeHtml(label)}</button>`;
}
export function link(label, href, iconName = "", className = "button") {
  return `<a class="${className}" href="${escapeHtml(href)}">${iconName ? icon(iconName) : ""}${escapeHtml(label)}</a>`;
}
export function pageHeading(
  title,
  description,
  actions = "",
  eyebrow = "YOUR INVENTORY, IN HARMONY",
) {
  return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div><div class="actions heading-actions">${actions}</div></div>`;
}
export function emptyState(
  title,
  description,
  action = "",
  iconName = "box",
  className = "",
) {
  return `<div class="empty-state ${className}"><span class="empty-icon">${icon(iconName)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${action}</div>`;
}
export function field(name, label, value = "", options = {}) {
  const attributes = `${options.required ? "required" : ""} ${options.readonly ? "readonly" : ""} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.max !== undefined ? `max="${options.max}"` : ""} ${options.step ? `step="${options.step}"` : ""} ${options.type === "number" ? 'inputmode="decimal"' : ""}`;
  const text = `<label for="f-${name}">${escapeHtml(label)}${options.required ? ' <span class="required">*</span>' : ""}</label>`;
  let control;
  if (options.options)
    control = `<select id="f-${name}" name="${name}" ${attributes}>${options.options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(value) === String(o.value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>`;
  else if (options.textarea)
    control = `<textarea id="f-${name}" name="${name}" maxlength="5000" ${attributes} placeholder="${escapeHtml(options.placeholder || "")}">${escapeHtml(value)}</textarea>`;
  else
    control = `<input id="f-${name}" name="${name}" type="${options.type || "text"}" value="${escapeHtml(value)}" maxlength="200" ${attributes} placeholder="${escapeHtml(options.placeholder || "")}" ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : ""}>`;
  return `<div class="field ${options.full ? "full" : ""}">${text}${control}${options.hint ? `<small>${escapeHtml(options.hint)}</small>` : ""}</div>`;
}
export function showDialog(title, subtitle, content, wide = false) {
  const modal = document.getElementById("modal");
  modal.classList.toggle("wide", wide);
  document.getElementById("modal-content").innerHTML =
    `<div class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Fenster schließen">${icon("close")}</button></div><div class="modal-body">${content}</div>`;
  if (!modal.open) modal.showModal();
}
export function closeDialog() {
  document.getElementById("modal").close();
}
let toastTimer;
export function toast(message, error = false) {
  clearTimeout(toastTimer);
  const region = document.getElementById("toast-region");
  region.innerHTML = `<div class="toast ${error ? "error" : ""}">${icon(error ? "warning" : "check")}<span>${escapeHtml(message)}</span><button class="icon-button" data-action="dismiss-toast" aria-label="Hinweis schließen">${icon("close")}</button></div>`;
  toastTimer = setTimeout(
    () => {
      region.innerHTML = "";
    },
    error ? 10000 : 5000,
  );
}
export function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
