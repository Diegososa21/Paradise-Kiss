import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './lock-screen.html',
  styleUrl: './lock-screen.scss',
})
export class LockScreenComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly query = new URLSearchParams(window.location.search);

  protected readonly activationUid = this.query.get('activate_uid') ?? '';
  protected readonly activationToken = this.query.get('activate_token') ?? '';
  protected readonly activationMode = Boolean(this.activationUid && this.activationToken);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly activationForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirm: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submitLogin(): void {
    this.errorMessage.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { username, password } = this.loginForm.getRawValue();
    this.auth
      .login(username, password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({ error: (error) => this.showError(error) });
  }

  protected submitActivation(): void {
    this.errorMessage.set('');
    if (this.activationForm.invalid) {
      this.activationForm.markAllAsTouched();
      return;
    }

    const values = this.activationForm.getRawValue();
    if (values.password !== values.password_confirm) {
      this.errorMessage.set('Die Passwörter stimmen nicht überein.');
      return;
    }

    this.submitting.set(true);
    this.auth
      .activate({
        uid: this.activationUid,
        token: this.activationToken,
        ...values,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => window.history.replaceState({}, '', '/'),
        error: (error) => this.showError(error),
      });
  }

  private showError(error: unknown): void {
    let message = 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.';
    if (error instanceof HttpErrorResponse && typeof error.error?.detail === 'string') {
      message = error.error.detail;
    } else if (error instanceof HttpErrorResponse && error.status === 403) {
      message = 'Die Sicherheitsprüfung ist fehlgeschlagen. Lade die Seite neu und versuche es erneut.';
    }
    this.errorMessage.set(message);
  }
}
