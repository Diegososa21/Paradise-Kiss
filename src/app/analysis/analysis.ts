import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { InventorySale, Resource, SalesReport } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { formatPrice } from '../shared/price';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';
import { KiAssistantComponent } from './ki-assistant/ki-assistant';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [DatePipe, NavigationSidebarComponent, KiAssistantComponent],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class AnalysisComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly sales = signal<InventorySale[]>([]);
  protected readonly report = signal<SalesReport | null>(null);
  protected readonly resourcesLoading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly reportLoading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly salesError = signal('');
  protected readonly reportError = signal('');
  protected readonly formatPrice = formatPrice;
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly loading = computed(
    () => this.resourcesLoading() || this.salesLoading() || this.reportLoading(),
  );
  protected readonly error = computed(
    () => this.resourceError() || this.salesError() || this.reportError(),
  );
  protected readonly soldUnits = computed(() =>
    this.sales().reduce((total, sale) => total + sale.quantity, 0),
  );
  protected readonly latestSale = computed(() => this.sales()[0] ?? null);

  /** History 2023–2025 (alternating violet/cyan per year) plus registered sales (pink). */
  protected readonly chartPoints = computed(() => {
    const points = this.report()?.quarters ?? [];
    const maximum = Math.max(...points.map((point) => point.units), 1);
    const historicalTones = ['violet', 'cyan'] as const;
    const years = [...new Set(points.map((point) => point.year))];

    return points.map((point) => ({
      ...point,
      height: Math.max(8, Math.round((point.units / maximum) * 100)),
      tone:
        point.source === 'historical'
          ? historicalTones[years.indexOf(point.year) % historicalTones.length]
          : 'pink',
      label: `${point.year} Q${point.quarter}: ${point.units.toLocaleString('de-DE')} Stück · ${formatPrice(point.revenue)}${point.source === 'historical' ? ' (historische Daten)' : ''}`,
    }));
  });
  protected readonly hasHistory = computed(() =>
    this.chartPoints().some((point) => point.source !== 'live'),
  );

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
      .getSalesReport()
      .pipe(finalize(() => this.reportLoading.set(false)))
      .subscribe({
        next: (report) => this.report.set(report),
        error: () => this.reportError.set('Die Quartalsdaten konnten nicht geladen werden.'),
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
