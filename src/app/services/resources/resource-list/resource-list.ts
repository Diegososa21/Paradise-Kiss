import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventorySale, Resource } from '../../../models/resource.model';
import { ResourceService } from '../../resource.service';

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.scss',
})
export class ResourceList implements OnInit {
  readonly resources = signal<Resource[]>([]);
  readonly recentSales = signal<InventorySale[]>([]);
  readonly totalSalesCount = signal(0);
  readonly saleQuantities = signal<Record<number, number>>({});
  readonly rowMessages = signal<Record<number, string>>({});
  readonly rowErrors = signal<Record<number, string>>({});
  readonly busyResourceId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly salesLoading = signal(true);
  readonly error = signal('');
  readonly salesError = signal('');
  readonly totalStock = computed(() =>
    this.resources().reduce((total, resource) => total + resource.amount, 0),
  );

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
  }

  setSaleQuantity(resourceId: number, value: number | string): void {
    this.saleQuantities.update((quantities) => ({
      ...quantities,
      [resourceId]: Number(value),
    }));
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
        next: ({ resource: updatedResource, sale }) => {
          this.resources.update((resources) =>
            resources.map((item) => (item.id === updatedResource.id ? updatedResource : item)),
          );
          this.recentSales.update((sales) => [sale, ...sales].slice(0, 8));
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
