import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InventorySale, Resource, StockMovement } from '../../../models/resource.model';
import { ResourceService } from '../../resource.service';
import { ResourceList } from './resource-list';

describe('ResourceList', () => {
  let component: ResourceList;
  let fixture: ComponentFixture<ResourceList>;
  let resourceService: {
    getAll: ReturnType<typeof vi.fn>;
    getInventorySales: ReturnType<typeof vi.fn>;
    getStockMovements: ReturnType<typeof vi.fn>;
    sell: ReturnType<typeof vi.fn>;
    restock: ReturnType<typeof vi.fn>;
    updateInventorySettings: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
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
    shelf_number: 'R-02',
    bin_number: 'F-04',
    reorder_threshold: 5,
    purchase_date: '2026-10-01',
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

  const saleMovement: StockMovement = {
    id: 3,
    resource: 10,
    resource_name: 'Classic Shirt',
    movement_type: 'sale',
    movement_type_label: 'Verkauf',
    quantity: 150,
    stock_before: 300,
    stock_after: 150,
    purchase_date: null,
    performed_by: 3,
    performed_by_username: 'sosa.diego',
    occurred_at: '2026-10-05T08:05:00Z',
  };

  beforeEach(async () => {
    resourceService = {
      getAll: vi.fn().mockReturnValue(of([resource])),
      getInventorySales: vi.fn().mockReturnValue(of([])),
      getStockMovements: vi.fn().mockReturnValue(of([])),
      sell: vi
        .fn()
        .mockReturnValue(
          of({ resource: { ...resource, amount: 150 }, sale, movement: saleMovement }),
        ),
      restock: vi.fn().mockReturnValue(
        of({
          resource: { ...resource, amount: 350, purchase_date: '2026-10-06' },
          movement: {
            id: 4,
            resource: 10,
            resource_name: 'Classic Shirt',
            movement_type: 'restock',
            movement_type_label: 'Nachbestellung',
            quantity: 50,
            stock_before: 300,
            stock_after: 350,
            purchase_date: '2026-10-06',
            performed_by: 3,
            performed_by_username: 'sosa.diego',
            occurred_at: '2026-10-06T08:05:00Z',
          },
        }),
      ),
      updateInventorySettings: vi
        .fn()
        .mockReturnValue(
          of({ ...resource, shelf_number: 'R-08', bin_number: 'F-09', reorder_threshold: 20 }),
        ),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ResourceList],
      providers: [
        provideRouter([]),
        {
          provide: ResourceService,
          useValue: resourceService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads inventory and initializes the sale quantity', () => {
    expect(component.resources()).toHaveLength(1);
    expect(component.totalStock()).toBe(300);
    expect(component.saleQuantities()[resource.id]).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Classic Shirt');
  });

  it('keeps inventory visible when the sales history request fails', async () => {
    fixture.destroy();
    resourceService.getInventorySales.mockReturnValue(
      throwError(() => new Error('sales unavailable')),
    );
    fixture = TestBed.createComponent(ResourceList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.resources()).toHaveLength(1);
    expect(component.error()).toBe('');
    expect(component.salesError()).toContain('Verkaufshistorie');
    expect(fixture.nativeElement.textContent).toContain('Classic Shirt');
  });

  it('registers a sale and updates the remaining stock', () => {
    component.setSaleQuantity(resource.id, 150);

    component.sell(resource);
    fixture.detectChanges();

    expect(resourceService.sell).toHaveBeenCalledWith(resource.id, 150);
    expect(component.resources()[0].amount).toBe(150);
    expect(component.recentSales()[0]).toEqual(sale);
    expect(component.recentMovements()[0]).toEqual(saleMovement);
    expect(component.totalSalesCount()).toBe(1);
    expect(component.rowMessages()[resource.id]).toContain('150 verbleiben');
  });

  it('rejects a sale larger than the available stock before calling the API', () => {
    component.setSaleQuantity(resource.id, 301);

    component.sell(resource);

    expect(resourceService.sell).not.toHaveBeenCalled();
    expect(component.rowErrors()[resource.id]).toContain('zwischen 1 und 300');
  });

  it('registers a restock and updates the available amount', () => {
    component.setRestockQuantity(resource.id, 50);
    component.setRestockDate(resource.id, '2026-10-06');

    component.restock(resource);
    fixture.detectChanges();

    expect(resourceService.restock).toHaveBeenCalledWith(resource.id, {
      quantity: 50,
      purchase_date: '2026-10-06',
      shelf_number: 'R-02',
      bin_number: 'F-04',
    });
    expect(component.resources()[0].amount).toBe(350);
    expect(component.recentMovements()[0].movement_type).toBe('restock');
    expect(component.rowMessages()[resource.id]).toContain('nachbestellt');
  });

  it('updates the warehouse location and reorder threshold without a movement', () => {
    component.setRestockShelf(resource.id, 'R-08');
    component.setRestockBin(resource.id, 'F-09');
    component.setReorderThreshold(resource.id, 20);

    component.saveInventorySettings(resource);

    expect(resourceService.updateInventorySettings).toHaveBeenCalledWith(resource.id, {
      shelf_number: 'R-08',
      bin_number: 'F-09',
      reorder_threshold: 20,
    });
    expect(component.resources()[0].reorder_threshold).toBe(20);
    expect(component.rowMessages()[resource.id]).toContain('gespeichert');
  });

  it('deletes an article after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteResource(resource);

    expect(resourceService.delete).toHaveBeenCalledWith(resource.id);
    expect(component.resources()).toHaveLength(0);
  });
});
