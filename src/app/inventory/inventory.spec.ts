import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Resource } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { InventoryComponent } from './inventory';

describe('InventoryComponent', () => {
  let fixture: ComponentFixture<InventoryComponent>;

  const resources: Resource[] = [
    {
      id: 1,
      gtin: '2000000000015',
      name: 'Denim Jacket',
      amount: 12,
      desc: 'Blue jacket',
      size: 'M',
      material: 'Denim',
      category: 1,
      category_name: 'Jackets',
      manufacturer: 1,
      manufacturer_name: 'Paradise Textiles',
      gender: 1,
      gender_name: 'Unisex',
      shelf_number: 'R-02',
      bin_number: 'F-04',
      reorder_threshold: 5,
      purchase_date: '2026-10-01',
      wholesale_price: '12.00',
      retail_price: '34.99',
      created_at: '2026-10-05T08:00:00Z',
    },
    {
      id: 2,
      gtin: '2000000000022',
      name: 'White Tee',
      amount: 4,
      desc: 'Cotton tee',
      size: 'S',
      material: 'Cotton',
      category: 2,
      category_name: 'Tees',
      manufacturer: 1,
      manufacturer_name: 'Paradise Textiles',
      gender: 2,
      gender_name: 'Women',
      shelf_number: 'R-03',
      bin_number: 'F-01',
      reorder_threshold: 5,
      purchase_date: '2026-10-02',
      wholesale_price: '12.00',
      retail_price: '34.99',
      created_at: '2026-10-05T09:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryComponent],
      providers: [
        provideRouter([]),
        { provide: ResourceService, useValue: { getAll: () => of(resources) } },
        {
          provide: AuthService,
          useValue: { user: signal(null), logout: () => of({ authenticated: false, user: null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders every product and the inventory totals', () => {
    const content = fixture.nativeElement.textContent;

    expect(fixture.nativeElement.querySelectorAll('.inventory-row')).toHaveLength(2);
    expect(content).toContain('Denim Jacket');
    expect(content).toContain('White Tee');
    expect(content).toContain('16');
    expect(content).toContain('individuelle Meldeschwelle erreicht');
    expect(content).toContain('R-02 / F-04');
  });

  function search(value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#product-search');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function rowNames(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll(
        '.inventory-row td:first-child strong',
      ) as NodeListOf<HTMLElement>,
    ).map((cell) => cell.textContent?.trim() ?? '');
  }

  function openFilters(): void {
    fixture.nativeElement.querySelector('.filter-toggle').click();
    fixture.detectChanges();
  }

  function choose(label: string, value: string): void {
    const select = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-panel label') as NodeListOf<HTMLElement>,
    )
      .find((element) => element.querySelector('span')?.textContent === label)
      ?.querySelector('select') as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('shows the GTIN of every product', () => {
    expect(fixture.nativeElement.textContent).toContain(resources[0].gtin);
  });

  it('finds a product by its GTIN', () => {
    search(resources[1].gtin ?? '');

    expect(rowNames()).toEqual(['White Tee']);
    expect(fixture.nativeElement.textContent).toContain('1 von 2 Produkten');
  });

  it('finds products by several characteristics regardless of case and accents', () => {
    search('denim  JACKETS');
    expect(rowNames()).toEqual(['Denim Jacket']);

    search('textiles');
    expect(rowNames()).toEqual(['Denim Jacket', 'White Tee']);

    search('r-03');
    expect(rowNames()).toEqual(['White Tee']);
  });

  it('explains when nothing matches and resets search and filters', () => {
    search('leather');

    expect(rowNames()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Keine Produkte passen');

    fixture.nativeElement.querySelector('.inventory-state .filter-reset').click();
    fixture.detectChanges();

    expect(rowNames()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('#product-search').value).toBe('');
  });

  it('filters by category, size and low stock on demand', () => {
    expect(fixture.nativeElement.querySelector('.filter-panel')).toBeNull();

    openFilters();
    choose('Kategorie', '1');
    expect(rowNames()).toEqual(['Denim Jacket']);
    expect(fixture.nativeElement.querySelector('.filter-count').textContent.trim()).toBe('1');

    choose('Kategorie', '');
    choose('Größe', 'S');
    expect(rowNames()).toEqual(['White Tee']);

    choose('Größe', '');
    choose('Bestand', 'low');
    expect(rowNames()).toEqual(['White Tee']);
  });

  it('combines filters with the search', () => {
    openFilters();
    choose('Lieferant', '1');
    search('tee');

    expect(rowNames()).toEqual(['White Tee']);
  });

  it('shows WHS and RT prices in euro', () => {
    const content = fixture.nativeElement.textContent.replace(/\u00a0/g, ' ');

    expect(content).toContain('12,00 €');
    expect(content).toContain('34,99 €');
  });
});
