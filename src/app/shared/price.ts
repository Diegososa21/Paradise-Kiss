import { AbstractControl, ValidationErrors } from '@angular/forms';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Formats an API price ("19.99") or number as "19,99 €". */
export function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? euro.format(amount) : '—';
}

/** Parses a price typed by the user ("19,99" or "19.99"); null when invalid. */
export function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Number(text);
}

/** Rejects prices with more than two decimal places. */
export function priceValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return parsePrice(value) === null ? { price: true } : null;
}
