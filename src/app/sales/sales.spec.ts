import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
  };

  const resource: Resource = {
    id: 10,
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
    created_at: '2026-10-05T08:00:00Z',
  };

  const sale: InventorySale = {
    id: 3,
    resource: 10,
    resource_name: 'Classic Shirt',
    category_name: 'Shirts',
    quantity: 150,
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
});
