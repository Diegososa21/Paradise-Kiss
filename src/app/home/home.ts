import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventorySale, Resource } from '../models/resource.model';
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
  protected readonly sales = signal<InventorySale[]>([]);
  protected readonly loading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly salesError = signal('');
  protected readonly itemTones = ['pink', 'orange', 'yellow'] as const;

  protected readonly soldUnits = computed(() =>
    this.sales().reduce((total, sale) => total + sale.quantity, 0),
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
      label: 'Buchungen',
      value: this.salesLoading()
        ? '…'
        : this.salesError()
          ? '—'
          : this.sales().length.toLocaleString('de-DE'),
      meta: this.salesError() ? 'Backend offline' : 'echte Verkäufe',
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
              .filter((resource) => resource.amount <= resource.reorder_threshold)
              .length.toLocaleString('de-DE'),
      meta: this.resourceError() ? 'Backend offline' : 'Meldeschwelle erreicht',
      tone: 'orange',
      alert:
        !this.resourceError() &&
        this.resources().some((resource) => resource.amount <= resource.reorder_threshold),
    },
    {
      label: 'Verkauft',
      value: this.salesLoading()
        ? '…'
        : this.salesError()
          ? '—'
          : this.soldUnits().toLocaleString('de-DE'),
      meta: this.salesError() ? 'Backend offline' : 'aus Verkaufsbuchungen',
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
      .getInventorySales()
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: (sales) => this.sales.set(sales),
        error: () => this.salesError.set('Die Verkaufsdaten konnten nicht geladen werden.'),
      });
  }
}
