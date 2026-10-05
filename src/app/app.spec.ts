import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AppUser, AuthService } from './services/auth.service';

describe('App', () => {
  const authStatus = signal<'loading' | 'anonymous' | 'authenticated'>('authenticated');
  const user = signal<AppUser | null>(null);

  beforeEach(async () => {
    authStatus.set('authenticated');
    user.set({
      id: 5,
      username: 'heyer.tim',
      display_name: 'Tim Heyer',
      email: '',
      avatar_url: '/profiles/teacher.png',
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            status: authStatus,
            user,
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

  it('shows who is signed in once, above every page', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const widgets = fixture.nativeElement.querySelectorAll('app-user-session.session-corner');
    expect(widgets).toHaveLength(1);
    expect(widgets[0].textContent).toContain('Tim Heyer');
    expect(widgets[0].querySelector('img').getAttribute('src')).toBe('/profiles/teacher.png');
  });

  it('does not show the profile widget on the lock screen', async () => {
    authStatus.set('anonymous');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-user-session')).toBeNull();
  });
});
