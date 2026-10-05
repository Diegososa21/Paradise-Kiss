import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InventorySale, Resource, SalesReport } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { AnalysisComponent } from './analysis';

describe('AnalysisComponent', () => {
  let fixture: ComponentFixture<AnalysisComponent>;

  const resources: Resource[] = [
    {
      id: 1,
      gtin: '2000000000015',
      name: 'Classic Shirt',
      amount: 8,
      desc: 'White cotton shirt',
      size: 'M',
      material: 'Cotton',
      category: 1,
      category_name: 'Shirts',
      manufacturer: 1,
      manufacturer_name: 'Paradise Textiles',
      gender: 1,
      gender_name: 'Unisex',
      shelf_number: 'R-01',
      bin_number: 'F-01',
      reorder_threshold: 5,
      purchase_date: '2026-01-02',
      wholesale_price: '12.00',
      retail_price: '34.99',
      created_at: '2026-01-02T08:00:00Z',
    },
    {
      id: 2,
      gtin: '2000000000022',
      name: 'Denim Jacket',
      amount: 4,
      desc: 'Blue jacket',
      size: 'S',
      material: 'Denim',
      category: 2,
      category_name: 'Jackets',
      manufacturer: 1,
      manufacturer_name: 'Paradise Textiles',
      gender: 1,
      gender_name: 'Unisex',
      shelf_number: 'R-02',
      bin_number: 'F-02',
      reorder_threshold: 5,
      purchase_date: '2026-01-02',
      wholesale_price: '12.00',
      retail_price: '34.99',
      created_at: '2026-01-02T08:00:00Z',
    },
    {
      id: 3,
      gtin: '2000000000039',
      name: 'Unsold Skirt',
      amount: 12,
      desc: 'Product without sales',
      size: 'S',
      material: 'Viscose',
      category: 3,
      category_name: 'Skirts',
      manufacturer: 1,
      manufacturer_name: 'Paradise Textiles',
      gender: 2,
      gender_name: 'Women',
      shelf_number: 'R-03',
      bin_number: 'F-03',
      reorder_threshold: 4,
      purchase_date: '2026-01-02',
      wholesale_price: '12.00',
      retail_price: '34.99',
      created_at: '2026-01-02T08:00:00Z',
    },
  ];

  const sales: InventorySale[] = [
    {
      id: 1,
      resource: 1,
      resource_name: 'Classic Shirt',
      category_name: 'Shirts',
      quantity: 80,
      unit_price: '34.99',
      revenue: null,
      stock_before: 100,
      stock_after: 20,
      sold_by: 1,
      sold_by_username: 'sosa.diego',
      sold_at: '2025-12-10T09:00:00Z',
    },
    {
      id: 2,
      resource: 2,
      resource_name: 'Denim Jacket',
      category_name: 'Jackets',
      quantity: 140,
      unit_price: '34.99',
      revenue: null,
      stock_before: 200,
      stock_after: 60,
      sold_by: 2,
      sold_by_username: 'nico',
      sold_at: '2026-04-15T09:00:00Z',
    },
  ];

  const report: SalesReport = {
    quarters: [
      { year: 2025, quarter: 3, units: 684, revenue: '43260.00', source: 'historical' },
      { year: 2025, quarter: 4, units: 851, revenue: '53811.00', source: 'historical' },
      { year: 2026, quarter: 4, units: 140, revenue: '4898.60', source: 'live' },
    ],
    years: [
      { year: 2025, units: 1535, revenue: '97071.00', source: 'historical' },
      { year: 2026, units: 140, revenue: '4898.60', source: 'live' },
    ],
    total_units: 1675,
    total_revenue: '101969.60',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisComponent],
      providers: [
        provideRouter([]),
        {
          provide: ResourceService,
          useValue: {
            getAll: () => of(resources),
            getInventorySales: () => of(sales),
            getSalesReport: () => of(report),
          },
        },
        {
          provide: AuthService,
          useValue: { user: signal(null), logout: () => of({ authenticated: false, user: null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalysisComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders quarterly bars and category rankings', () => {
    const content = fixture.nativeElement.textContent;

    expect(fixture.nativeElement.querySelectorAll('.sales-column')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.products-card li')).toHaveLength(3);
    expect(content).toContain('Denim Jacket');
    expect(content).toContain('Unsold Skirt');
    expect(content).toContain('noch nicht verkauft');
    expect(content).toContain('2026');
    expect(content).toContain('140');
  });

  it('shows the history 2023–2025 next to the registered sales of the current quarter', () => {
    const columns = [...fixture.nativeElement.querySelectorAll('.sales-column')] as HTMLElement[];
    const bars = columns.map((column) => column.querySelector('.sales-bar')!.className);

    expect(columns[0].getAttribute('title')).toContain('2025 Q3: 684 Stück');
    expect(columns[0].getAttribute('title')).toContain('(historische Daten)');
    expect(columns[2].getAttribute('title')).toMatch(/2026 Q4: 140 Stück · 4\.898,60\s€$/);
    expect(bars[2]).toContain('sales-bar--pink');
    expect(bars[0]).not.toContain('sales-bar--pink');
    expect(columns[2].querySelector('.bar-value')!.textContent!.trim()).toBe('140');
    expect(fixture.nativeElement.textContent).toContain('Historische Daten');
    expect(fixture.nativeElement.textContent).toContain('Registrierte Verkäufe');
  });

  it('places the KI-Assistent right below the sales chart, next to the ranking', () => {
    const main: HTMLElement = fixture.nativeElement.querySelector('.analysis-grid .analysis-main');
    const children = [...main.children].map((element) => element.tagName.toLowerCase());

    expect(children).toEqual(['article', 'app-ki-assistant']);
    expect(main.firstElementChild!.classList).toContain('trend-card');
    expect(fixture.nativeElement.querySelectorAll('app-ki-assistant')).toHaveLength(1);
  });
});
