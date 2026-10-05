import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InventorySale, Resource } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { HomeComponent } from './home';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  const resources: Resource[] = [
    {
      id: 3,
      name: 'White Tee',
      amount: 4,
      desc: 'Classic white tee',
      size: 'L',
      material: 'Cotton',
      category: 1,
      category_name: 'Tees',
      manufacturer: 1,
      manufacturer_name: 'Paradise Kiss',
      gender: 1,
      gender_name: 'Unisex',
      shelf_number: 'R-02',
      bin_number: 'F-04',
      reorder_threshold: 5,
      purchase_date: '2026-09-20',
      created_at: '2026-09-28T06:32:50Z',
    },
    {
      id: 4,
      name: 'Violet Top',
      amount: 12,
      desc: 'Mesh top',
      size: 'M',
      material: 'Mesh',
      category: 2,
      category_name: 'Tops',
      manufacturer: 1,
      manufacturer_name: 'Paradise Kiss',
      gender: 1,
      gender_name: 'Unisex',
      shelf_number: 'R-03',
      bin_number: 'F-02',
      reorder_threshold: 5,
      purchase_date: '2026-09-21',
      created_at: '2026-09-28T06:33:50Z',
    },
  ];

  const sales: InventorySale[] = [
    {
      id: 1,
      resource: 3,
      resource_name: 'White Tee',
      category_name: 'Tees',
      quantity: 80,
      stock_before: 100,
      stock_after: 20,
      sold_by: 1,
      sold_by_username: 'sosa.diego',
      sold_at: '2026-09-30T10:00:00Z',
    },
    {
      id: 2,
      resource: 4,
      resource_name: 'Violet Top',
      category_name: 'Tops',
      quantity: 60,
      stock_before: 72,
      stock_after: 12,
      sold_by: 2,
      sold_by_username: 'friedrich.nico',
      sold_at: '2026-10-01T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ResourceService,
          useValue: {
            getAll: () => of(resources),
            getInventorySales: () => of(sales),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({
              id: 1,
              username: 'sosa.diego',
              display_name: 'Diego Sosa',
              email: 'diego@example.com',
              avatar_url: '/profiles/diego.jpeg',
            }),
            logout: () => of({ authenticated: false, user: null }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the article count returned by the backend', () => {
    const content = fixture.nativeElement.textContent;

    expect(content).toContain('2');
    expect(content).toContain('aus Datenbank');
    expect(content).toContain('Meldeschwelle erreicht');
  });

  it('shows only the latest resources on the dashboard', () => {
    const content = fixture.nativeElement.textContent;
    const rows = fixture.nativeElement.querySelectorAll('.attention-row');

    expect(rows).toHaveLength(2);
    expect(content).toContain('Violet Top');
    expect(content).toContain('White Tee');
    expect(fixture.nativeElement.querySelector('.inventory-card')).toBeNull();
  });

  it('keeps sales KPIs and links every quick action to its own section', () => {
    const content = fixture.nativeElement.textContent;
    const quickActions = [...fixture.nativeElement.querySelectorAll('.quick-action')].map(
      (link: HTMLAnchorElement) => link.getAttribute('href'),
    );

    expect(content).toContain('140');
    expect(content).toContain('echte Verkäufe');
    expect(quickActions).toEqual(['/resources/new', '/sales', '/inventory', '/analysis']);
    expect(fixture.nativeElement.querySelector('.sales-column')).toBeNull();
  });
});
