import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventorySale, Resource, StockMovement } from '../../../models/resource.model';
import { ResourceService } from '../../resource.service';
import { NavigationSidebarComponent } from '../../../shared/navigation-sidebar/navigation-sidebar';

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavigationSidebarComponent],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.scss',
})
export class ResourceList implements OnInit {
  readonly resources = signal<Resource[]>([]);
  readonly recentSales = signal<InventorySale[]>([]);
  readonly recentMovements = signal<StockMovement[]>([]);
  readonly totalSalesCount = signal(0);
  readonly saleQuantities = signal<Record<number, number>>({});
  readonly restockQuantities = signal<Record<number, number>>({});
  readonly restockDates = signal<Record<number, string>>({});
  readonly restockShelves = signal<Record<number, string>>({});
  readonly restockBins = signal<Record<number, string>>({});
  readonly reorderThresholds = signal<Record<number, number>>({});
  readonly rowMessages = signal<Record<number, string>>({});
  readonly rowErrors = signal<Record<number, string>>({});
  readonly busyResourceId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly salesLoading = signal(true);
  readonly movementsLoading = signal(true);
  readonly error = signal('');
  readonly salesError = signal('');
  readonly movementsError = signal('');
  readonly totalStock = computed(() =>
    this.resources().reduce((total, resource) => total + resource.amount, 0),
  );
  readonly lowStockCount = computed(
    () =>
      this.resources().filter((resource) => resource.amount <= resource.reorder_threshold).length,
  );
  private readonly today = new Intl.DateTimeFormat('sv-SE').format(new Date());

  constructor(private resourceService: ResourceService) {}

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => {
          this.resources.set(resources);
          this.saleQuantities.set(
            Object.fromEntries(resources.map((resource) => [resource.id, 1])),
          );
          this.restockQuantities.set(
            Object.fromEntries(resources.map((resource) => [resource.id, 1])),
          );
          this.restockDates.set(
            Object.fromEntries(resources.map((resource) => [resource.id, this.today])),
          );
          this.restockShelves.set(
            Object.fromEntries(resources.map((resource) => [resource.id, resource.shelf_number])),
          );
          this.restockBins.set(
            Object.fromEntries(resources.map((resource) => [resource.id, resource.bin_number])),
          );
          this.reorderThresholds.set(
            Object.fromEntries(
              resources.map((resource) => [resource.id, resource.reorder_threshold]),
            ),
          );
        },
        error: () => {
          this.error.set('Fehler beim Laden der Daten');
        },
      });

    this.resourceService
      .getInventorySales()
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: (sales) => {
          this.recentSales.set(sales.slice(0, 8));
          this.totalSalesCount.set(sales.length);
        },
        error: () => {
          this.salesError.set('Die Verkaufshistorie konnte nicht geladen werden.');
        },
      });

    this.resourceService
      .getStockMovements()
      .pipe(finalize(() => this.movementsLoading.set(false)))
      .subscribe({
        next: (movements) => this.recentMovements.set(movements.slice(0, 8)),
        error: () => {
          this.movementsError.set('Die Lagerbewegungen konnten nicht geladen werden.');
        },
      });
  }

  setSaleQuantity(resourceId: number, value: number | string): void {
    this.saleQuantities.update((quantities) => ({
      ...quantities,
      [resourceId]: Number(value),
    }));
  }

  setRestockQuantity(resourceId: number, value: number | string): void {
    this.restockQuantities.update((quantities) => ({
      ...quantities,
      [resourceId]: Number(value),
    }));
  }

  setRestockDate(resourceId: number, value: string): void {
    this.restockDates.update((dates) => ({ ...dates, [resourceId]: value }));
  }

  setRestockShelf(resourceId: number, value: string): void {
    this.restockShelves.update((shelves) => ({ ...shelves, [resourceId]: value }));
  }

  setRestockBin(resourceId: number, value: string): void {
    this.restockBins.update((bins) => ({ ...bins, [resourceId]: value }));
  }

  setReorderThreshold(resourceId: number, value: number | string): void {
    this.reorderThresholds.update((thresholds) => ({
      ...thresholds,
      [resourceId]: Number(value),
    }));
  }

  saveInventorySettings(resource: Resource): void {
    this.clearRowFeedback(resource.id);
    const shelfNumber = (this.restockShelves()[resource.id] ?? '').trim();
    const binNumber = (this.restockBins()[resource.id] ?? '').trim();
    const reorderThreshold = Math.trunc(Number(this.reorderThresholds()[resource.id]));

    if (!shelfNumber || !binNumber) {
      this.setRowError(resource.id, 'Regalnummer und Fachnummer sind erforderlich.');
      return;
    }
    if (!Number.isFinite(reorderThreshold) || reorderThreshold < 0) {
      this.setRowError(resource.id, 'Der Meldebestand muss 0 oder größer sein.');
      return;
    }

    this.busyResourceId.set(resource.id);
    this.resourceService
      .updateInventorySettings(resource.id, {
        shelf_number: shelfNumber,
        bin_number: binNumber,
        reorder_threshold: reorderThreshold,
      })
      .pipe(finalize(() => this.busyResourceId.set(null)))
      .subscribe({
        next: (updatedResource) => {
          this.resources.update((resources) =>
            resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
          );
          this.rowMessages.update((messages) => ({
            ...messages,
            [resource.id]: 'Lagerplatz und Meldebestand wurden gespeichert.',
          }));
        },
        error: (error: unknown) => {
          this.setRowError(
            resource.id,
            this.errorDetail(error, 'Die Lagereinstellungen konnten nicht gespeichert werden.'),
          );
        },
      });
  }

  sell(resource: Resource): void {
    this.clearRowFeedback(resource.id);
    const quantity = Math.trunc(Number(this.saleQuantities()[resource.id]));

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > resource.amount) {
      this.rowErrors.update((errors) => ({
        ...errors,
        [resource.id]: `Bitte eine Menge zwischen 1 und ${resource.amount} eingeben.`,
      }));
      return;
    }

    this.busyResourceId.set(resource.id);
    this.resourceService
      .sell(resource.id, quantity)
      .pipe(finalize(() => this.busyResourceId.set(null)))
      .subscribe({
        next: ({ resource: updatedResource, sale, movement }) => {
          this.resources.update((resources) =>
            resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
          );
          this.recentSales.update((sales) => [sale, ...sales].slice(0, 8));
          this.recentMovements.update((movements) => [movement, ...movements].slice(0, 8));
          this.totalSalesCount.update((count) => count + 1);
          this.setSaleQuantity(resource.id, updatedResource.amount > 0 ? 1 : 0);
          this.rowMessages.update((messages) => ({
            ...messages,
            [resource.id]: `${quantity} Stück verkauft. ${updatedResource.amount} verbleiben.`,
          }));
        },
        error: (error: unknown) => {
          this.rowErrors.update((errors) => ({
            ...errors,
            [resource.id]: this.errorDetail(error, 'Der Verkauf konnte nicht gespeichert werden.'),
          }));
        },
      });
  }

  restock(resource: Resource): void {
    this.clearRowFeedback(resource.id);
    const quantity = Math.trunc(Number(this.restockQuantities()[resource.id]));
    const purchaseDate = this.restockDates()[resource.id];
    const shelfNumber = (this.restockShelves()[resource.id] ?? '').trim();
    const binNumber = (this.restockBins()[resource.id] ?? '').trim();

    if (!Number.isFinite(quantity) || quantity < 1) {
      this.setRowError(resource.id, 'Bitte mindestens 1 Stück als Nachbestellung eingeben.');
      return;
    }
    if (!purchaseDate || !shelfNumber || !binNumber) {
      this.setRowError(resource.id, 'Einkaufsdatum, Regalnummer und Fachnummer sind erforderlich.');
      return;
    }

    this.busyResourceId.set(resource.id);
    this.resourceService
      .restock(resource.id, {
        quantity,
        purchase_date: purchaseDate,
        shelf_number: shelfNumber,
        bin_number: binNumber,
      })
      .pipe(finalize(() => this.busyResourceId.set(null)))
      .subscribe({
        next: ({ resource: updatedResource, movement }) => {
          this.resources.update((resources) =>
            resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
          );
          this.setRestockQuantity(resource.id, 1);
          this.recentMovements.update((movements) => [movement, ...movements].slice(0, 8));
          this.rowMessages.update((messages) => ({
            ...messages,
            [resource.id]: `${quantity} Stück nachbestellt. Neuer Bestand: ${updatedResource.amount}.`,
          }));
        },
        error: (error: unknown) => {
          this.setRowError(
            resource.id,
            this.errorDetail(error, 'Die Nachbestellung konnte nicht gespeichert werden.'),
          );
        },
      });
  }

  deleteResource(resource: Resource): void {
    this.clearRowFeedback(resource.id);
    const confirmed = window.confirm(
      `„${resource.name}“ wirklich löschen? Bereits registrierte Verkäufe bleiben erhalten.`,
    );
    if (!confirmed) return;

    this.busyResourceId.set(resource.id);
    this.resourceService
      .delete(resource.id)
      .pipe(finalize(() => this.busyResourceId.set(null)))
      .subscribe({
        next: () => {
          this.resources.update((resources) => resources.filter((item) => item.id !== resource.id));
        },
        error: (error: unknown) => {
          this.rowErrors.update((errors) => ({
            ...errors,
            [resource.id]: this.errorDetail(error, 'Der Artikel konnte nicht gelöscht werden.'),
          }));
        },
      });
  }

  private clearRowFeedback(resourceId: number): void {
    this.rowMessages.update((messages) => this.withoutKey(messages, resourceId));
    this.rowErrors.update((errors) => this.withoutKey(errors, resourceId));
  }

  private setRowError(resourceId: number, message: string): void {
    this.rowErrors.update((errors) => ({ ...errors, [resourceId]: message }));
  }

  private withoutKey(values: Record<number, string>, resourceId: number): Record<number, string> {
    const nextValues = { ...values };
    delete nextValues[resourceId];
    return nextValues;
  }

  private errorDetail(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (typeof error.error?.detail === 'string') return error.error.detail;

    const quantityError = error.error?.quantity;
    if (Array.isArray(quantityError) && typeof quantityError[0] === 'string') {
      return quantityError[0];
    }
    if (typeof quantityError === 'string') return quantityError;

    return fallback;
  }
}
