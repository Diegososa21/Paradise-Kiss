import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { InventorySale, Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';
import { UserSessionComponent } from '../shared/user-session/user-session';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [DatePipe, NavigationSidebarComponent, UserSessionComponent],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class AnalysisComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly sales = signal<InventorySale[]>([]);
  protected readonly resourcesLoading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly salesError = signal('');
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly loading = computed(() => this.resourcesLoading() || this.salesLoading());
  protected readonly error = computed(() => this.resourceError() || this.salesError());
  protected readonly soldUnits = computed(() =>
    this.sales().reduce((total, sale) => total + sale.quantity, 0),
  );
  protected readonly latestSale = computed(() => this.sales()[0] ?? null);

  protected readonly chartPoints = computed(() => {
    const periods = new Map<string, { year: number; quarter: number; units: number }>();

    for (const sale of this.sales()) {
      const soldAt = new Date(sale.sold_at);
      const year = soldAt.getFullYear();
      const quarter = Math.floor(soldAt.getMonth() / 3) + 1;
      const key = `${year}-${quarter}`;
      const period = periods.get(key) ?? { year, quarter, units: 0 };
      period.units += sale.quantity;
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

  protected readonly productSummaries = computed(() => {
    const products = new Map<
      string,
      { name: string; category: string; units: number; inStock: boolean }
    >();

    for (const resource of this.resources()) {
      products.set(resource.name, {
        name: resource.name,
        category: resource.category_name,
        units: 0,
        inStock: true,
      });
    }

    for (const sale of this.sales()) {
      const product = products.get(sale.resource_name) ?? {
        name: sale.resource_name,
        category: sale.category_name,
        units: 0,
        inStock: false,
      };
      product.units += sale.quantity;
      products.set(sale.resource_name, product);
    }

    const maximum = Math.max(...[...products.values()].map((product) => product.units), 1);
    return [...products.values()]
      .map((product) => ({
        ...product,
        share: Math.round((product.units / maximum) * 100),
      }))
      .sort((first, second) => second.units - first.units || first.name.localeCompare(second.name));
  });

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.resourcesLoading.set(false)))
      .subscribe({
        next: (resources) => this.resources.set(resources),
        error: () => this.resourceError.set('Die Artikel konnten nicht geladen werden.'),
      });

    this.resourceService
      .getInventorySales()
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: (sales) => this.sales.set(sales),
        error: () => this.salesError.set('Die Verkaufsdaten konnten nicht geladen werden.'),
      });
  }
}
