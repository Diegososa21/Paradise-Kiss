import { Component, computed, input } from '@angular/core';
import { SalesReport, SalesSource } from '../../models/resource.model';
import { formatPrice } from '../../shared/price';

/** Total revenue (history + registered sales) with one bar per year. */
@Component({
  selector: 'app-revenue-summary',
  standalone: true,
  templateUrl: './revenue-summary.html',
  styleUrl: './revenue-summary.scss',
})
export class RevenueSummaryComponent {
  readonly report = input<SalesReport | null>(null);
  readonly loading = input(false);
  readonly error = input('');

  protected readonly formatPrice = formatPrice;
  protected readonly sourceLabels: Record<SalesSource, string> = {
    historical: 'historische Daten',
    live: 'registrierte Verkäufe',
    mixed: 'historische Daten + registrierte Verkäufe',
  };

  /** Revenue per year with the bar width relative to the best year. */
  protected readonly revenueYears = computed(() => {
    const years = this.report()?.years ?? [];
    const maximum = Math.max(...years.map((year) => Number(year.revenue)), 1);
    return years.map((year) => ({
      ...year,
      share: Math.max(2, Math.round((Number(year.revenue) / maximum) * 100)),
    }));
  });

  protected readonly revenuePeriod = computed(() => {
    const years = this.revenueYears();
    if (years.length === 0) return '';
    const first = years[0].year;
    const last = years[years.length - 1].year;
    return first === last ? `${first}` : `${first}–${last}`;
  });
}
