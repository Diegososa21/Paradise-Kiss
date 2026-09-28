import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
   imports: [RouterLink],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent {}
