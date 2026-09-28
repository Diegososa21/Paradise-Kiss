import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ResourceService } from '../services/resource.service';

@Component({
  selector: 'app-rescource-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './rescourceForm.html',
  styleUrl: './rescourceForm.scss'
})
export class RescourceFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly resourceService = inject(ResourceService);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    desc: ['', [Validators.required, Validators.maxLength(200)]],
    size: ['', [Validators.required, Validators.maxLength(10)]],
    category: ['', [Validators.required, Validators.maxLength(200)]],
    manufacurer: ['', [Validators.required, Validators.maxLength(200)]],
    material: ['', [Validators.required, Validators.maxLength(200)]],
    gender: ['', [Validators.required, Validators.maxLength(200)]],
  });

  protected submitting = false;
  protected successMessage = '';
  protected errorMessage = '';

  protected submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.resourceService.create(this.form.getRawValue())
      .pipe(finalize(() => this.submitting = false))
      .subscribe({
        next: () => {
          this.successMessage = 'Der Eintrag wurde gespeichert.';
          this.form.reset();
        },
        error: () => {
          this.errorMessage = 'Der Eintrag konnte nicht gespeichert werden.';
        },
      });
  }
}
