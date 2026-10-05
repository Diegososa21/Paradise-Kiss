import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Category, Gender, Manufacturer } from '../models/resource.model';
import { AuthService } from '../services/auth.service';
import { ResourceService } from '../services/resource.service';

@Component({
  selector: 'app-rescource-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './rescourceForm.html',
  styleUrl: './rescourceForm.scss',
})
export class RescourceFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly resourceService = inject(ResourceService);
  protected readonly auth = inject(AuthService);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [0, [Validators.required, Validators.min(0)]],
    desc: ['', [Validators.required, Validators.maxLength(200)]],
    size: ['', [Validators.required, Validators.maxLength(10)]],
    category: [0, [Validators.required, Validators.min(1)]],
    manufacturer: [0, [Validators.required, Validators.min(1)]],
    material: ['', [Validators.required, Validators.maxLength(200)]],
    gender: [0, [Validators.required, Validators.min(1)]],
  });

  protected categories: Category[] = [];
  protected manufacturers: Manufacturer[] = [];
  protected genders: Gender[] = [];
  protected optionsLoading = true;
  protected optionsError = '';
  protected submitting = false;
  protected successMessage = '';
  protected errorMessage = '';

  ngOnInit(): void {
    let pendingRequests = 3;
    const markComplete = () => {
      pendingRequests -= 1;
      if (pendingRequests === 0) this.optionsLoading = false;
    };
    const markError = () => {
      this.optionsError = 'Auswahldaten konnten nicht geladen werden.';
    };

    this.resourceService
      .getCategories()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => (this.categories = items), error: markError });
    this.resourceService
      .getManufacturers()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => (this.manufacturers = items), error: markError });
    this.resourceService
      .getGenders()
      .pipe(finalize(markComplete))
      .subscribe({ next: (items) => (this.genders = items), error: markError });
  }

  protected submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.resourceService
      .create(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Der Eintrag wurde gespeichert.';
          this.form.reset({ amount: 0, category: 0, manufacturer: 0, gender: 0 });
        },
        error: () => {
          this.errorMessage = 'Der Eintrag konnte nicht gespeichert werden.';
        },
      });
  }

  protected resetForm(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.form.reset({ amount: 0, category: 0, manufacturer: 0, gender: 0 });
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
