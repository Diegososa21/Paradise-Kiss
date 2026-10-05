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
      created_at: '2026-10-05T08:00:00Z',
    },
    {
      id: 2,
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
    expect(content).toContain('5 Einheiten oder weniger');
  });
});
