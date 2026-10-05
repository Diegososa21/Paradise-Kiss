import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Resource, SalesData } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';
import { UserSessionComponent } from '../shared/user-session/user-session';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NavigationSidebarComponent, UserSessionComponent],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly salesData = signal<SalesData[]>([]);
  protected readonly loading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly salesError = signal('');
  protected readonly itemTones = ['pink', 'orange', 'yellow'] as const;

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
}
