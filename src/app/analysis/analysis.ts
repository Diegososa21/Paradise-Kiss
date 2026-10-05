import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { SalesData } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';
import { UserSessionComponent } from '../shared/user-session/user-session';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [NavigationSidebarComponent, UserSessionComponent],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class AnalysisComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly salesData = signal<SalesData[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly latestYear = computed(() => {
    const years = this.salesData().map((entry) => entry.year);
    return years.length ? Math.max(...years) : null;
  });
  protected readonly latestYearSales = computed(() => {
    const latestYear = this.latestYear();
    return latestYear === null ? [] : this.salesData().filter((entry) => entry.year === latestYear);
  });
  protected readonly latestYearUnits = computed(() =>
    this.latestYearSales().reduce((total, entry) => total + entry.units_sold, 0),
  );
  protected readonly latestYearRevenue = computed(() =>
    this.latestYearSales().reduce((total, entry) => total + Number(entry.revenue), 0),
  );
  protected readonly growth = computed(() => {
    const latestYear = this.latestYear();
    if (latestYear === null) return null;

    const previousYearUnits = this.salesData()
      .filter((entry) => entry.year === latestYear - 1)
      .reduce((total, entry) => total + entry.units_sold, 0);

    return previousYearUnits
      ? ((this.latestYearUnits() - previousYearUnits) / previousYearUnits) * 100
      : null;
  });
  protected readonly chartPoints = computed(() => {
    const periods = new Map<string, { year: number; quarter: number; units: number }>();

    for (const entry of this.salesData()) {
      const key = `${entry.year}-${entry.quarter}`;
      const period = periods.get(key) ?? { year: entry.year, quarter: entry.quarter, units: 0 };
      period.units += entry.units_sold;
      periods.set(key, period);
    }

    const points = [...periods.values()].sort(
      (first, second) => first.year - second.year || first.quarter - second.quarter,
    );
    const maximum = Math.max(...points.map((point) => point.units), 1);
    const tones = ['violet', 'cyan', 'pink'] as const;
    const years = [...new Set(points.map((point) => point.year))];

    return points.map((point) => ({
      ...point,
      height: Math.max(8, Math.round((point.units / maximum) * 100)),
      tone: tones[Math.max(0, years.indexOf(point.year)) % tones.length],
    }));
  });
  protected readonly categorySummaries = computed(() => {
    const categories = new Map<string, { units: number; revenue: number }>();

    for (const entry of this.salesData()) {
      const category = categories.get(entry.category_name) ?? { units: 0, revenue: 0 };
      category.units += entry.units_sold;
      category.revenue += Number(entry.revenue);
      categories.set(entry.category_name, category);
    }

    const maximum = Math.max(...[...categories.values()].map((category) => category.units), 1);

    return [...categories.entries()]
      .map(([name, summary]) => ({
        name,
        ...summary,
        share: Math.round((summary.units / maximum) * 100),
      }))
      .sort((first, second) => second.units - first.units || first.name.localeCompare(second.name));
  });

  ngOnInit(): void {
    this.resourceService
      .getSalesData()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (salesData) => this.salesData.set(salesData),
        error: () => this.error.set('Die Verkaufsdaten konnten nicht geladen werden.'),
      });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
