import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Resource, SalesData } from '../models/resource.model';
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
      created_at: '2026-09-28T06:33:50Z',
    },
  ];

  const salesData: SalesData[] = [
    {
      id: 1,
      year: 2024,
      quarter: 4,
      category: 1,
      category_name: 'Tees',
      units_sold: 80,
      revenue: '2240.00',
    },
    {
      id: 2,
      year: 2025,
      quarter: 1,
      category: 1,
      category_name: 'Tees',
      units_sold: 90,
      revenue: '2520.00',
    },
    {
      id: 3,
      year: 2025,
      quarter: 1,
      category: 2,
      category_name: 'Jackets',
      units_sold: 50,
      revenue: '6000.00',
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
            getSalesData: () => of(salesData),
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
    expect(content).toContain('5 oder weniger');
  });

  it('shows all resources in the dashboard inventory', () => {
    const content = fixture.nativeElement.textContent;
    const rows = fixture.nativeElement.querySelectorAll('.inventory-row');

    expect(rows).toHaveLength(2);
    expect(content).toContain('Violet Top');
    expect(content).toContain('White Tee');
    expect(content).toContain('Tops');
    expect(content).toContain('Tees');
    expect(content).toContain('Paradise Kiss');
    expect(content).toContain('Unisex');
  });

  it('shows sales KPIs and diagrams returned by the backend', () => {
    const content = fixture.nativeElement.textContent;
    const bars = fixture.nativeElement.querySelectorAll('.sales-column');
    const categoryRows = fixture.nativeElement.querySelectorAll('.sales-category-list > li');

    expect(content).toContain('Verkaufsdaten');
    expect(content).toContain('2025');
    expect(content).toContain('Jackets');
    expect(content).toContain('140');
    expect(bars).toHaveLength(2);
    expect(categoryRows).toHaveLength(2);
  });
});
