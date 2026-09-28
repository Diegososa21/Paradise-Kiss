import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Resource } from '../models/resource.model';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ResourceService,
          useValue: { getAll: () => of(resources) },
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

  it('shows recent resources and their categories', () => {
    const content = fixture.nativeElement.textContent;

    expect(content).toContain('Violet Top');
    expect(content).toContain('White Tee');
    expect(content).toContain('Tops');
    expect(content).toContain('Tees');
  });
});
