import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navigation-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navigation-sidebar.html',
  styleUrl: './navigation-sidebar.scss',
})
export class NavigationSidebarComponent {}
