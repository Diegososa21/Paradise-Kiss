import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Resource, SalesData } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);
  protected readonly auth = inject(AuthService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly salesData = signal<SalesData[]>([]);
  protected readonly loading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly salesError = signal('');
  protected readonly itemTones = ['pink', 'orange', 'yellow'] as const;
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly latestSalesYear = computed(() => {
    const years = this.salesData().map((entry) => entry.year);
    return years.length ? Math.max(...years) : null;
  });

  protected readonly latestYearSales = computed(() => {
    const latestYear = this.latestSalesYear();
    return latestYear === null ? [] : this.salesData().filter((entry) => entry.year === latestYear);
  });

  protected readonly latestYearUnits = computed(() =>
    this.latestYearSales().reduce((total, entry) => total + entry.units_sold, 0),
  );

  protected readonly latestYearRevenue = computed(() =>
    this.latestYearSales().reduce((total, entry) => total + Number(entry.revenue), 0),
  );

  protected readonly salesGrowth = computed(() => {
    const latestYear = this.latestSalesYear();
    if (latestYear === null) {
      return null;
    }

    const previousYearUnits = this.salesData()
      .filter((entry) => entry.year === latestYear - 1)
      .reduce((total, entry) => total + entry.units_sold, 0);

    return previousYearUnits
      ? ((this.latestYearUnits() - previousYearUnits) / previousYearUnits) * 100
      : null;
  });

  protected readonly kpis = computed(() => [
    {
      label: 'Artikel',
      value: this.loading()
        ? '…'
        : this.resourceError()
          ? '—'
          : this.resources().length.toLocaleString('de-DE'),
      meta: this.resourceError() ? 'Backend offline' : 'aus Datenbank',
      tone: 'pink',
      alert: Boolean(this.resourceError()),
    },
    {
      label: 'Umsatz',
      value: this.salesLoading()
        ? '…'
        : this.salesError()
          ? '—'
          : this.formatCurrency(this.latestYearRevenue()),
      meta: this.salesError()
        ? 'Backend offline'
        : (this.latestSalesYear()?.toString() ?? 'keine Daten'),
      tone: 'blue',
      alert: Boolean(this.salesError()),
    },
    {
      label: 'Niedrig',
      value: this.loading()
        ? '…'
        : this.resourceError()
          ? '—'
          : this.resources()
              .filter((resource) => resource.amount <= 5)
              .length.toLocaleString('de-DE'),
      meta: this.resourceError() ? 'Backend offline' : '5 oder weniger',
      tone: 'orange',
      alert: !this.resourceError() && this.resources().some((resource) => resource.amount <= 5),
    },
    {
      label: 'Verkauft',
      value: this.salesLoading()
        ? '…'
        : this.salesError()
          ? '—'
          : this.latestYearUnits().toLocaleString('de-DE'),
      meta: this.salesError() ? 'Backend offline' : `${this.latestSalesYear() ?? '—'} · Stück`,
      tone: 'cyan',
      alert: Boolean(this.salesError()),
    },
  ]);

  protected readonly recentResources = computed(() =>
    [...this.resources()]
      .sort((first, second) => second.created_at.localeCompare(first.created_at))
      .slice(0, 3),
  );

  protected readonly inventoryResources = computed(() =>
    [...this.resources()].sort((first, second) => first.name.localeCompare(second.name)),
  );

  protected readonly salesChartPoints = computed(() => {
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

  protected readonly salesCategorySummaries = computed(() => {
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
      .sort((first, second) => second.units - first.units || first.name.localeCompare(second.name))
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => this.resources.set(resources),
        error: () => this.resourceError.set('Die Datenbank konnte nicht geladen werden.'),
      });

    this.resourceService
      .getSalesData()
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: (salesData) => this.salesData.set(salesData),
        error: () => this.salesError.set('Die Verkaufsdaten konnten nicht geladen werden.'),
      });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
