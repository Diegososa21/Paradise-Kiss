import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InventorySale, Resource } from '../../../models/resource.model';
import { ResourceService } from '../../resource.service';
import { ResourceList } from './resource-list';

describe('ResourceList', () => {
  let component: ResourceList;
  let fixture: ComponentFixture<ResourceList>;
  let resourceService: {
    getAll: ReturnType<typeof vi.fn>;
    getInventorySales: ReturnType<typeof vi.fn>;
    sell: ReturnType<typeof vi.fn>;
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
    expect(component.resources).toHaveLength(1);
    expect(component.totalStock).toBe(300);
    expect(component.saleQuantities[resource.id]).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Classic Shirt');
  });

  it('registers a sale and updates the remaining stock', () => {
    component.saleQuantities[resource.id] = 150;

    component.sell(resource);
    fixture.detectChanges();

    expect(resourceService.sell).toHaveBeenCalledWith(resource.id, 150);
    expect(component.resources[0].amount).toBe(150);
    expect(component.recentSales[0]).toEqual(sale);
    expect(component.totalSalesCount).toBe(1);
    expect(component.rowMessages[resource.id]).toContain('150 verbleiben');
  });

  it('rejects a sale larger than the available stock before calling the API', () => {
    component.saleQuantities[resource.id] = 301;

    component.sell(resource);

    expect(resourceService.sell).not.toHaveBeenCalled();
    expect(component.rowErrors[resource.id]).toContain('zwischen 1 und 300');
  });

  it('deletes an article after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteResource(resource);

    expect(resourceService.delete).toHaveBeenCalledWith(resource.id);
    expect(component.resources).toHaveLength(0);
  });
});
