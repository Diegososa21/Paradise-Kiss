import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-session',
  standalone: true,
  templateUrl: './user-session.html',
  styleUrl: './user-session.scss',
})
export class UserSessionComponent {
  protected readonly auth = inject(AuthService);

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
