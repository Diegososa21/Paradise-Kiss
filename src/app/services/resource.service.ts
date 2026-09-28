import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateResource, Resource } from '../models/resource.model';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  private readonly baseUrl = '/api/resources/';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Resource[]> {
    return this.http.get<Resource[]>(this.baseUrl);
  }

  create(resource: CreateResource): Observable<Resource> {
    return this.http.post<Resource>(this.baseUrl, resource);
  }
}
