import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
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
  resources: Resource[] = [];
  recentSales: InventorySale[] = [];
  totalSalesCount = 0;
  saleQuantities: Record<number, number> = {};
  rowMessages: Record<number, string> = {};
  rowErrors: Record<number, string> = {};
  busyResourceId: number | null = null;
  loading = true;
  error = '';

  constructor(private resourceService: ResourceService) {}

  get totalStock(): number {
    return this.resources.reduce((total, resource) => total + resource.amount, 0);
  }

  ngOnInit(): void {
    forkJoin({
      resources: this.resourceService.getAll(),
      sales: this.resourceService.getInventorySales(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ resources, sales }) => {
          this.resources = resources;
          this.recentSales = sales.slice(0, 8);
          this.totalSalesCount = sales.length;
          for (const resource of resources) {
            this.saleQuantities[resource.id] = 1;
          }
        },
        error: () => {
          this.error = 'Fehler beim Laden der Daten';
        },
      });
  }

  sell(resource: Resource): void {
    this.clearRowFeedback(resource.id);
    const quantity = Math.trunc(Number(this.saleQuantities[resource.id]));

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > resource.amount) {
      this.rowErrors[resource.id] = `Bitte eine Menge zwischen 1 und ${resource.amount} eingeben.`;
      return;
    }

    this.busyResourceId = resource.id;
    this.resourceService
      .sell(resource.id, quantity)
      .pipe(finalize(() => (this.busyResourceId = null)))
      .subscribe({
        next: ({ resource: updatedResource, sale }) => {
          this.resources = this.resources.map((item) =>
            item.id === updatedResource.id ? updatedResource : item,
          );
          this.recentSales = [sale, ...this.recentSales].slice(0, 8);
          this.totalSalesCount += 1;
          this.saleQuantities[resource.id] = updatedResource.amount > 0 ? 1 : 0;
          this.rowMessages[resource.id] =
            `${quantity} Stück verkauft. ${updatedResource.amount} verbleiben.`;
        },
        error: (error: unknown) => {
          this.rowErrors[resource.id] = this.errorDetail(
            error,
            'Der Verkauf konnte nicht gespeichert werden.',
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

    this.busyResourceId = resource.id;
    this.resourceService
      .delete(resource.id)
      .pipe(finalize(() => (this.busyResourceId = null)))
      .subscribe({
        next: () => {
          this.resources = this.resources.filter((item) => item.id !== resource.id);
        },
        error: (error: unknown) => {
          this.rowErrors[resource.id] = this.errorDetail(
            error,
            'Der Artikel konnte nicht gelöscht werden.',
          );
        },
      });
  }

  private clearRowFeedback(resourceId: number): void {
    delete this.rowMessages[resourceId];
    delete this.rowErrors[resourceId];
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
