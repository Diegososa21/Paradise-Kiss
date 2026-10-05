import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { InventorySale, Resource } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { SalesComponent } from './sales';

describe('SalesComponent', () => {
  let fixture: ComponentFixture<SalesComponent>;
  let component: SalesComponent;
  let resourceService: {
    getAll: ReturnType<typeof vi.fn>;
    getInventorySales: ReturnType<typeof vi.fn>;
    sell: ReturnType<typeof vi.fn>;
    cancelSale: ReturnType<typeof vi.fn>;
  };

  const resource: Resource = {
    id: 10,
    gtin: '2000000000107',
    name: 'Classic Shirt',
    amount: 300,
    desc: 'White cotton shirt',
    size: 'M',
    material: 'Cotton',
    category: 15,
    category_name: 'Shirts',
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
  };

  const sale: InventorySale = {
    id: 3,
    resource: 10,
    resource_name: 'Classic Shirt',
    category_name: 'Shirts',
    quantity: 150,
    unit_price: '34.99',
    revenue: null,
    stock_before: 300,
    stock_after: 150,
    sold_by: 3,
    sold_by_username: 'sosa.diego',
    sold_at: '2026-10-05T08:05:00Z',
  };

  beforeEach(async () => {
    resourceService = {
      getAll: vi.fn().mockReturnValue(of([resource])),
      getInventorySales: vi.fn().mockReturnValue(of([])),
      sell: vi.fn().mockReturnValue(of({ resource: { ...resource, amount: 150 }, sale })),
      cancelSale: vi
        .fn()
        .mockReturnValue(of({ resource: { ...resource, amount: 300 }, movement: null })),
    };

    await TestBed.configureTestingModule({
      imports: [SalesComponent],
      providers: [
        provideRouter([]),
        { provide: ResourceService, useValue: resourceService },
        {
          provide: AuthService,
          useValue: { user: signal(null), logout: () => of({ authenticated: false, user: null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SalesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('registers a sale from the dedicated sales page', () => {
    const page = component as unknown as {
      setQuantity(value: number): void;
      registerSale(): void;
      remainingStock(): number;
    };

    page.setQuantity(150);
    expect(page.remainingStock()).toBe(150);
    page.registerSale();
    fixture.detectChanges();

    expect(resourceService.sell).toHaveBeenCalledWith(resource.id, 150);
    expect(fixture.nativeElement.textContent).toContain('150 Stück verkauft');
    expect(fixture.nativeElement.textContent).toContain('sosa.diego');
  });

  async function showSales(sales: InventorySale[]): Promise<void> {
    resourceService.getInventorySales.mockReturnValue(of(sales));
    resourceService.getAll.mockReturnValue(of([{ ...resource, amount: 150 }]));
    fixture = TestBed.createComponent(SalesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function cancelButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.cancel-sale');
  }

  it('cancels a recent sale after confirmation and restores the stock', async () => {
    await showSales([sale]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    cancelButton().click();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('wieder dem Bestand hinzugefügt'));
    expect(resourceService.cancelSale).toHaveBeenCalledWith(sale.id);
    expect(fixture.nativeElement.querySelectorAll('.history-card li')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Neuer Bestand: 300 Stück');
    confirm.mockRestore();
  });

  it('keeps the sale when the confirmation is declined', async () => {
    await showSales([sale]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    cancelButton().click();
    fixture.detectChanges();

    expect(resourceService.cancelSale).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.history-card li')).toHaveLength(1);
    confirm.mockRestore();
  });

  it('shows the server message when a sale cannot be cancelled', async () => {
    await showSales([sale]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    resourceService.cancelSale.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { detail: 'Der Verkauf wurde nicht gefunden.' },
          }),
      ),
    );

    cancelButton().click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Der Verkauf wurde nicht gefunden.');
    expect(fixture.nativeElement.querySelectorAll('.history-card li')).toHaveLength(1);
    confirm.mockRestore();
  });
});
