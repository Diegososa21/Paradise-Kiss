import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';
import { RescourceFormComponent } from './rescourceForm';

describe('RescourceFormComponent', () => {
  let fixture: ComponentFixture<RescourceFormComponent>;
  let resourceService: {
    getCategories: ReturnType<typeof vi.fn>;
    getManufacturers: ReturnType<typeof vi.fn>;
    getGenders: ReturnType<typeof vi.fn>;
    createCategory: ReturnType<typeof vi.fn>;
    createManufacturer: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    resourceService = {
      getCategories: vi.fn(() => of([{ id: 1, name: 'Jackets' }])),
      getManufacturers: vi.fn(() => of([{ id: 1, name: 'Paradise Textiles', location: 'Berlin' }])),
      getGenders: vi.fn(() => of([{ id: 1, name: 'Unisex' }])),
      createCategory: vi.fn(() => of({ id: 2, name: 'Accessoires' })),
      createManufacturer: vi.fn(() => of({ id: 2, name: 'Nordic Wool', location: 'Oslo' })),
      create: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RescourceFormComponent],
      providers: [
        provideRouter([]),
        { provide: ResourceService, useValue: resourceService },
        {
          provide: AuthService,
          useValue: { user: signal(null), logout: () => of({ authenticated: false, user: null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RescourceFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function clickButton(text: string): void {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((element) => element.textContent?.trim() === text);
    if (!button) throw new Error(`Button "${text}" not found`);
    button.click();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function selectedText(selector: string): string {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(selector);
    return select.options[select.selectedIndex].textContent?.trim() ?? '';
  }

  it('adds a category and selects it', () => {
    clickButton('+ Kategorie hinzufügen');
    type('#new-category-name', 'Accessoires');
    clickButton('Kategorie speichern');

    expect(resourceService.createCategory).toHaveBeenCalledWith({ name: 'Accessoires' });
    expect(selectedText('#category')).toBe('Accessoires');
    expect(fixture.nativeElement.querySelector('#quick-add-category')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Kategorie „Accessoires“ wurde angelegt');
  });

  it('adds a supplier with its location and selects it', () => {
    clickButton('+ Lieferant hinzufügen');
    type('#new-manufacturer-name', 'Nordic Wool');
    type('#new-manufacturer-location', 'Oslo');
    clickButton('Lieferant speichern');

    expect(resourceService.createManufacturer).toHaveBeenCalledWith({
      name: 'Nordic Wool',
      location: 'Oslo',
    });
    expect(selectedText('#manufacturer')).toBe('Nordic Wool · Oslo');
  });

  it('requires a location before saving a supplier', () => {
    clickButton('+ Lieferant hinzufügen');
    type('#new-manufacturer-name', 'Nordic Wool');
    clickButton('Lieferant speichern');

    expect(resourceService.createManufacturer).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Bitte einen Standort eingeben.');
  });

  it('shows the message from the server when the category already exists', () => {
    resourceService.createCategory.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { name: ['Die Kategorie „jackets“ existiert bereits.'] },
          }),
      ),
    );

    clickButton('+ Kategorie hinzufügen');
    type('#new-category-name', 'jackets');
    clickButton('Kategorie speichern');

    expect(fixture.nativeElement.textContent).toContain('existiert bereits');
    expect(fixture.nativeElement.querySelector('#quick-add-category')).not.toBeNull();
  });

  it('does not submit the product form when pressing Enter in the quick add field', () => {
    clickButton('+ Kategorie hinzufügen');
    type('#new-category-name', 'Accessoires');
    fixture.nativeElement
      .querySelector('#new-category-name')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(resourceService.createCategory).toHaveBeenCalledTimes(1);
    expect(resourceService.create).not.toHaveBeenCalled();
  });

  it('sends WHS and RT prices typed with a German decimal comma', () => {
    resourceService.create.mockReturnValue(of({ id: 9, gtin: '2000000000091' }));
    const form = (fixture.componentInstance as any).form;
    form.setValue({
      name: 'Denim Jacket',
      amount: 3,
      desc: 'Blue',
      size: 'M',
      category: 1,
      manufacturer: 1,
      material: 'Denim',
      gender: 1,
      shelf_number: 'R-02',
      bin_number: 'F-04',
      reorder_threshold: 5,
      purchase_date: '2026-10-05',
      wholesale_price: '24,50',
      retail_price: '79,99',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Marge: 55,49');

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(resourceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ wholesale_price: 24.5, retail_price: 79.99 }),
    );
    expect(fixture.nativeElement.textContent).toContain('GTIN: 2000000000091');
  });

  it('rejects prices with more than two decimals', () => {
    const form = (fixture.componentInstance as any).form;
    form.controls.retail_price.setValue('19,999');
    form.controls.retail_price.markAsTouched();
    fixture.detectChanges();

    expect(form.controls.retail_price.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Bitte einen Preis wie 79,99 eingeben.');
  });
});
