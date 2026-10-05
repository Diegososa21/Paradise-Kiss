import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Category, Gender, Manufacturer } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { formatPrice, parsePrice, priceValidator } from '../shared/price';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';

type QuickAdd = 'category' | 'manufacturer' | null;

const byName = <T extends { name: string }>(first: T, second: T) =>
  first.name.localeCompare(second.name, 'de');

/** Returns the first validation message of a DRF 400 response, if any. */
function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 400 && error.error) {
    for (const messages of Object.values(error.error as Record<string, unknown>)) {
      if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0];
    }
  }
  return fallback;
}

@Component({
  selector: 'app-rescource-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NavigationSidebarComponent],
  templateUrl: './rescourceForm.html',
  styleUrl: './rescourceForm.scss',
})
export class RescourceFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly resourceService = inject(ResourceService);
  private readonly today = new Intl.DateTimeFormat('sv-SE').format(new Date());

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [0, [Validators.required, Validators.min(0)]],
    desc: ['', [Validators.required, Validators.maxLength(200)]],
    size: ['', [Validators.required, Validators.maxLength(10)]],
    category: [0, [Validators.required, Validators.min(1)]],
    manufacturer: [0, [Validators.required, Validators.min(1)]],
    material: ['', [Validators.required, Validators.maxLength(200)]],
    gender: [0, [Validators.required, Validators.min(1)]],
    shelf_number: ['', [Validators.required, Validators.maxLength(30)]],
    bin_number: ['', [Validators.required, Validators.maxLength(30)]],
    reorder_threshold: [5, [Validators.required, Validators.min(0)]],
    purchase_date: [this.today, Validators.required],
    wholesale_price: ['', [Validators.required, priceValidator]],
    retail_price: ['', [Validators.required, priceValidator]],
  });

  protected readonly categoryForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected readonly manufacturerForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    location: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected readonly categories = signal<Category[]>([]);
  protected readonly manufacturers = signal<Manufacturer[]>([]);
  protected readonly genders = signal<Gender[]>([]);
  protected readonly optionsLoading = signal(true);
  protected readonly optionsError = signal('');
  protected readonly submitting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly quickAdd = signal<QuickAdd>(null);
  protected readonly quickAddSaving = signal(false);
  protected readonly quickAddError = signal('');
  protected readonly quickAddSuccess = signal('');

  ngOnInit(): void {
    let pendingRequests = 3;
    const markComplete = () => {
      pendingRequests -= 1;
      if (pendingRequests === 0) this.optionsLoading.set(false);
    };
    const markError = () => {
      this.optionsError.set('Auswahldaten konnten nicht geladen werden.');
    };

    this.resourceService
      .getCategories()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => this.categories.set(items), error: markError });
    this.resourceService
      .getManufacturers()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => this.manufacturers.set(items), error: markError });
    this.resourceService
      .getGenders()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => this.genders.set(items), error: markError });
  }

  protected submit(): void {
    this.successMessage.set('');
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.submitting.set(true);
    this.resourceService
      .create({
        ...values,
        wholesale_price: parsePrice(values.wholesale_price) ?? 0,
        retail_price: parsePrice(values.retail_price) ?? 0,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (resource) => {
          this.successMessage.set(
            resource.gtin
              ? `Der Artikel wurde gespeichert. GTIN: ${resource.gtin}`
              : 'Der Artikel wurde gespeichert.',
          );
          this.resetFormValues();
        },
        error: (error) => {
          this.errorMessage.set(
            apiErrorMessage(error, 'Der Eintrag konnte nicht gespeichert werden.'),
          );
        },
      });
  }

  /** Gross margin between RT and WHS price, shown while typing. */
  protected margin(): string {
    const wholesale = parsePrice(this.form.controls.wholesale_price.value);
    const retail = parsePrice(this.form.controls.retail_price.value);
    if (wholesale === null || retail === null) return '';
    const difference = retail - wholesale;
    const percent = retail > 0 ? Math.round((difference / retail) * 100) : 0;
    return `Marge: ${formatPrice(difference)} (${percent} % vom RT-Preis)`;
  }

  protected resetForm(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.resetFormValues();
  }

  protected openQuickAdd(kind: Exclude<QuickAdd, null>): void {
    this.quickAdd.set(this.quickAdd() === kind ? null : kind);
    this.quickAddError.set('');
    this.quickAddSuccess.set('');
    this.categoryForm.reset();
    this.manufacturerForm.reset();
  }

  protected closeQuickAdd(): void {
    this.quickAdd.set(null);
    this.quickAddError.set('');
  }

  protected saveCategory(event?: Event): void {
    event?.preventDefault();
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.quickAddSaving.set(true);
    this.quickAddError.set('');
    this.resourceService
      .createCategory(this.categoryForm.getRawValue())
      .pipe(finalize(() => this.quickAddSaving.set(false)))
      .subscribe({
        next: (category) => {
          this.categories.update((items) => [...items, category].sort(byName));
          this.form.controls.category.setValue(category.id);
          this.quickAdd.set(null);
          this.quickAddSuccess.set(`Kategorie „${category.name}“ wurde angelegt und ausgewählt.`);
        },
        error: (error) => {
          this.quickAddError.set(
            apiErrorMessage(error, 'Die Kategorie konnte nicht gespeichert werden.'),
          );
        },
      });
  }

  protected saveManufacturer(event?: Event): void {
    event?.preventDefault();
    if (this.manufacturerForm.invalid) {
      this.manufacturerForm.markAllAsTouched();
      return;
    }

    this.quickAddSaving.set(true);
    this.quickAddError.set('');
    this.resourceService
      .createManufacturer(this.manufacturerForm.getRawValue())
      .pipe(finalize(() => this.quickAddSaving.set(false)))
      .subscribe({
        next: (manufacturer) => {
          this.manufacturers.update((items) => [...items, manufacturer].sort(byName));
          this.form.controls.manufacturer.setValue(manufacturer.id);
          this.quickAdd.set(null);
          this.quickAddSuccess.set(
            `Lieferant „${manufacturer.name}“ wurde angelegt und ausgewählt.`,
          );
        },
        error: (error) => {
          this.quickAddError.set(
            apiErrorMessage(error, 'Der Lieferant konnte nicht gespeichert werden.'),
          );
        },
      });
  }

  private resetFormValues(): void {
    this.form.reset({
      amount: 0,
      category: 0,
      manufacturer: 0,
      gender: 0,
      reorder_threshold: 5,
      purchase_date: this.today,
      wholesale_price: '',
      retail_price: '',
    });
  }
}
