import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, switchMap, tap } from 'rxjs';

export interface AppUser {
  id: number;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string;
}

interface AuthResponse {
  authenticated: boolean;
  user: AppUser | null;
}

export interface ActivationCredentials {
  uid: string;
  token: string;
  password: string;
  password_confirm: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/auth';

  readonly status = signal<'loading' | 'anonymous' | 'authenticated'>('loading');
  readonly user = signal<AppUser | null>(null);

  initialize(): void {
    this.http
      .get<AuthResponse>(`${this.baseUrl}/session/`, { withCredentials: true })
      .pipe(catchError(() => of({ authenticated: false, user: null })))
      .subscribe((response) => this.applyResponse(response));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<AuthResponse>(
          `${this.baseUrl}/login/`,
          { username, password },
          { withCredentials: true },
        ),
      ),
      tap((response) => this.applyResponse(response)),
    );
  }

  activate(credentials: ActivationCredentials): Observable<AuthResponse> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<AuthResponse>(`${this.baseUrl}/activate/`, credentials, {
          withCredentials: true,
        }),
      ),
      tap((response) => this.applyResponse(response)),
    );
  }

  logout(): Observable<AuthResponse> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.post<AuthResponse>(`${this.baseUrl}/logout/`, {}, { withCredentials: true }),
      ),
      tap((response) => this.applyResponse(response)),
    );
  }

  private ensureCsrf(): Observable<{ csrf_token: string }> {
    return this.http.get<{ csrf_token: string }>(`${this.baseUrl}/csrf/`, {
      withCredentials: true,
    });
  }

  private applyResponse(response: AuthResponse): void {
    this.user.set(response.user);
    this.status.set(response.authenticated && response.user ? 'authenticated' : 'anonymous');
  }
}
