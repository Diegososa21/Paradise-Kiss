import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Category,
  CreateResource,
  Gender,
  InventorySale,
  InventorySettings,
  Manufacturer,
  RestockResource,
  RestockResourceResponse,
  Resource,
  SalesData,
  SellResourceResponse,
  StockMovement,
} from '../models/resource.model';

@Injectable({
  providedIn: 'root',
})
export class ResourceService {
  private readonly baseUrl = '/api/tables';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.baseUrl}/resources/`);
  }

  create(resource: CreateResource): Observable<Resource> {
    return this.http.post<Resource>(`${this.baseUrl}/resources/`, resource);
  }

  sell(resourceId: number, quantity: number): Observable<SellResourceResponse> {
    return this.http.post<SellResourceResponse>(`${this.baseUrl}/resources/${resourceId}/sell/`, {
      quantity,
    });
  }

  restock(resourceId: number, restock: RestockResource): Observable<RestockResourceResponse> {
    return this.http.post<RestockResourceResponse>(
      `${this.baseUrl}/resources/${resourceId}/restock/`,
      restock,
    );
  }

  updateInventorySettings(resourceId: number, settings: InventorySettings): Observable<Resource> {
    return this.http.patch<Resource>(
      `${this.baseUrl}/resources/${resourceId}/inventory-settings/`,
      settings,
    );
  }

  delete(resourceId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/resources/${resourceId}/`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.baseUrl}/categories/`);
  }

  getManufacturers(): Observable<Manufacturer[]> {
    return this.http.get<Manufacturer[]>(`${this.baseUrl}/manufacturers/`);
  }

  getGenders(): Observable<Gender[]> {
    return this.http.get<Gender[]>(`${this.baseUrl}/genders/`);
  }

  getSalesData(): Observable<SalesData[]> {
    return this.http.get<SalesData[]>(`${this.baseUrl}/sales/`);
  }

  getInventorySales(): Observable<InventorySale[]> {
    return this.http.get<InventorySale[]>(`${this.baseUrl}/inventory-sales/`);
  }

  getStockMovements(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.baseUrl}/stock-movements/`);
  }
}
