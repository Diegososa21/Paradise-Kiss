import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SalesData } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { AnalysisComponent } from './analysis';

describe('AnalysisComponent', () => {
  let fixture: ComponentFixture<AnalysisComponent>;

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
      category: 2,
      category_name: 'Jackets',
      units_sold: 140,
      revenue: '8520.00',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalysisComponent],
      providers: [
        provideRouter([]),
        { provide: ResourceService, useValue: { getSalesData: () => of(salesData) } },
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

    expect(fixture.nativeElement.querySelectorAll('.sales-column')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.products-card li')).toHaveLength(2);
    expect(content).toContain('Jackets');
    expect(content).toContain('2025');
    expect(content).toContain('140');
  });
});
