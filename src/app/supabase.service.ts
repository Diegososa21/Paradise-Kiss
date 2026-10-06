import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly baseUrl = environment.supabaseUrl;
  private readonly publishableKey = environment.supabasePublishableKey;

  private get headers(): HeadersInit {
    return {
      apikey: this.publishableKey,
      'Content-Type': 'application/json',
    };
  }

  async healthCheck(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/rest/v1/`, {
      headers: this.headers,
    });

    return response.ok;
  }

  async select<T>(table: string, query = 'select=*'): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${table}?${query}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T[];
  }
}
