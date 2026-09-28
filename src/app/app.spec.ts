import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './services/auth.service';

describe('App', () => {
  const authStatus = signal<'loading' | 'anonymous' | 'authenticated'>('authenticated');

  beforeEach(async () => {
    authStatus.set('authenticated');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            status: authStatus,
            user: signal(null),
            initialize: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows the lock screen without an authenticated session', async () => {
    authStatus.set('anonymous');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Studio entsperren');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
  });
});
