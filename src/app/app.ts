import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LockScreenComponent } from './auth/lock-screen';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LockScreenComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);

  constructor() {
    this.auth.initialize();
  }
}
