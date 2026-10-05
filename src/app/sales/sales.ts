import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { InventorySale, Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [DatePipe, FormsModule, NavigationSidebarComponent],
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class SalesComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly sales = signal<InventorySale[]>([]);
  protected readonly loading = signal(true);
  protected readonly salesLoading = signal(true);
  protected readonly error = signal('');
  protected readonly salesError = signal('');
  protected readonly selectedResourceId = signal<number | null>(null);
  protected readonly quantity = signal(1);
  protected readonly submitting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly submitError = signal('');
  protected readonly cancellingSaleId = signal<number | null>(null);
  protected readonly historyMessage = signal('');
  protected readonly historyError = signal('');

  protected readonly availableResources = computed(() =>
    [...this.resources()]
      .filter((resource) => resource.amount > 0)
      .sort((first, second) => first.name.localeCompare(second.name)),
  );
  protected readonly selectedResource = computed(() =>
    this.resources().find((resource) => resource.id === this.selectedResourceId()),
  );
  protected readonly soldUnits = computed(() =>
    this.sales().reduce((total, sale) => total + sale.quantity, 0),
  );
  protected readonly remainingStock = computed(() => {
    const resource = this.selectedResource();
    return resource ? Math.max(0, resource.amount - this.quantity()) : 0;
  });

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => {
          this.resources.set(resources);
          const firstAvailable = resources.find((resource) => resource.amount > 0);
          this.selectedResourceId.set(firstAvailable?.id ?? null);
        },
        error: () => this.error.set('Die Artikel konnten nicht geladen werden.'),
      });

    this.resourceService
      .getInventorySales()
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: (sales) => this.sales.set(sales),
        error: () => this.salesError.set('Die Verkaufshistorie konnte nicht geladen werden.'),
      });
  }

  protected selectResource(value: number | string | null): void {
    const resourceId = Number(value);
    this.selectedResourceId.set(Number.isFinite(resourceId) && resourceId > 0 ? resourceId : null);
    this.quantity.set(1);
    this.clearFeedback();
  }

  protected setQuantity(value: number | string): void {
    this.quantity.set(Number(value));
    this.clearFeedback();
  }

  protected registerSale(): void {
    this.clearFeedback();
    const resource = this.selectedResource();
    const quantity = Math.trunc(this.quantity());

    if (!resource) {
      this.submitError.set('Bitte zuerst einen Artikel auswählen.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > resource.amount) {
      this.submitError.set(`Bitte eine Menge zwischen 1 und ${resource.amount} eingeben.`);
      return;
    }

    this.submitting.set(true);
    this.resourceService
      .sell(resource.id, quantity)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: ({ resource: updatedResource, sale }) => {
          this.resources.update((resources) =>
            resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
          );
          this.sales.update((sales) => [sale, ...sales]);
          this.quantity.set(updatedResource.amount > 0 ? 1 : 0);
          this.successMessage.set(
            `${quantity} Stück verkauft. ${updatedResource.amount} Stück verbleiben.`,
          );

          if (updatedResource.amount === 0) {
            this.selectedResourceId.set(this.availableResources()[0]?.id ?? null);
            this.quantity.set(this.selectedResourceId() ? 1 : 0);
          }
        },
        error: (error: unknown) => {
          this.submitError.set(this.errorDetail(error));
        },
      });
  }

  protected cancelSale(sale: InventorySale): void {
    this.historyMessage.set('');
    this.historyError.set('');
    const restock = sale.resource
      ? ` Die ${sale.quantity} Stück werden wieder dem Bestand hinzugefügt.`
      : ' Der Artikel existiert nicht mehr, daher wird kein Bestand zurückgebucht.';
    const confirmed = window.confirm(
      `Verkauf von „${sale.resource_name}“ (${sale.quantity} Stück) wirklich stornieren?${restock}`,
    );
    if (!confirmed) return;

    this.cancellingSaleId.set(sale.id);
    this.resourceService
      .cancelSale(sale.id)
      .pipe(finalize(() => this.cancellingSaleId.set(null)))
      .subscribe({
        next: ({ resource: updatedResource }) => {
          this.sales.update((sales) => sales.filter((item) => item.id !== sale.id));
          if (updatedResource) {
            this.resources.update((resources) =>
              resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
            );
            if (this.selectedResourceId() === null) {
              this.selectedResourceId.set(updatedResource.id);
              this.quantity.set(1);
            }
          }
          this.historyMessage.set(
            updatedResource
              ? `Verkauf von „${sale.resource_name}“ storniert. Neuer Bestand: ${updatedResource.amount} Stück.`
              : `Verkauf von „${sale.resource_name}“ storniert.`,
          );
        },
        error: (error: unknown) => {
          this.historyError.set(
            error instanceof HttpErrorResponse && typeof error.error?.detail === 'string'
              ? error.error.detail
              : 'Der Verkauf konnte nicht storniert werden.',
          );
        },
      });
  }

  private clearFeedback(): void {
    this.successMessage.set('');
    this.submitError.set('');
  }

  private errorDetail(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.detail === 'string') {
      return error.error.detail;
    }
    return 'Der Verkauf konnte nicht gespeichert werden.';
  }
}
