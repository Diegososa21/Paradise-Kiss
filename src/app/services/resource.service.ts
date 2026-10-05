import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Category,
  CreateResource,
  Gender,
  Manufacturer,
  Resource,
  SalesData,
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
}
