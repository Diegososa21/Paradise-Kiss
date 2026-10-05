import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavigationSidebarComponent } from './navigation-sidebar';

describe('NavigationSidebarComponent', () => {
  it('links to sales and inventory management in its own section', async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NavigationSidebarComponent);
    fixture.detectChanges();

    const section: HTMLElement = fixture.nativeElement.querySelector('.sidebar-section');
    const link: HTMLAnchorElement = section.querySelector('a:not(.ai-link)')!;

    expect(section.textContent).toContain('Verwaltung');
    expect(link.textContent?.trim()).toBe('Verkäufe & Bestand verwalten');
    expect(link.getAttribute('href')).toBe('/inventory/manage');
  });

  it('offers the KI-Assistent with a sparkle icon in the management section', async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(NavigationSidebarComponent);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '.sidebar-section .ai-link',
    );

    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe('KI-Assistent KI');
    expect(link.getAttribute('href')).toBe('/analysis#ki-assistant');
    expect(link.querySelector('svg.ai-sparkle')?.getAttribute('aria-hidden')).toBe('true');
  });
});
