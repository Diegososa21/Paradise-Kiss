import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LockScreenComponent } from './auth/lock-screen';
import { AuthService } from './services/auth.service';
import { UserSessionComponent } from './shared/user-session/user-session';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LockScreenComponent, UserSessionComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);

  constructor() {
    this.auth.initialize();
  }
}
