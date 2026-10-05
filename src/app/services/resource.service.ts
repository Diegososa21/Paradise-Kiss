import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AssistantAnswer,
  AssistantTurn,
  CancelSaleResponse,
  Category,
  CreateCategory,
  CreateManufacturer,
  CreateResource,
  Gender,
  InventorySale,
  InventorySettings,
  Manufacturer,
  RestockResource,
  RestockResourceResponse,
  Resource,
  ResourceDetails,
  SalesData,
  SalesReport,
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

  updateDetails(resourceId: number, details: ResourceDetails): Observable<Resource> {
    return this.http.patch<Resource>(`${this.baseUrl}/resources/${resourceId}/details/`, details);
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

  createCategory(category: CreateCategory): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories/`, category);
  }

  getManufacturers(): Observable<Manufacturer[]> {
    return this.http.get<Manufacturer[]>(`${this.baseUrl}/manufacturers/`);
  }

  createManufacturer(manufacturer: CreateManufacturer): Observable<Manufacturer> {
    return this.http.post<Manufacturer>(`${this.baseUrl}/manufacturers/`, manufacturer);
  }

  getGenders(): Observable<Gender[]> {
    return this.http.get<Gender[]>(`${this.baseUrl}/genders/`);
  }

  getSalesData(): Observable<SalesData[]> {
    return this.http.get<SalesData[]>(`${this.baseUrl}/sales/`);
  }

  /** Asks the KI-Assistent about best sellers and purchase tips. */
  askAssistant(question: string, history: AssistantTurn[]): Observable<AssistantAnswer> {
    return this.http.post<AssistantAnswer>(`${this.baseUrl}/assistant/`, { question, history });
  }

  /** Units and revenue per quarter/year: history 2023–2025 plus registered sales. */
  getSalesReport(): Observable<SalesReport> {
    return this.http.get<SalesReport>(`${this.baseUrl}/sales-report/`);
  }

  getInventorySales(): Observable<InventorySale[]> {
    return this.http.get<InventorySale[]>(`${this.baseUrl}/inventory-sales/`);
  }

  /** Cancels (storno) a sale: removes it and returns the units to stock. */
  cancelSale(saleId: number): Observable<CancelSaleResponse> {
    return this.http.delete<CancelSaleResponse>(`${this.baseUrl}/inventory-sales/${saleId}/`);
  }

  getStockMovements(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.baseUrl}/stock-movements/`);
  }
}
