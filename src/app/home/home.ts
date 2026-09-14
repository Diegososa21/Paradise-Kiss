import { Component } from '@angular/core';
import { ResourceForm } from './resource-form/resource-form';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ResourceForm],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent {
    showForm = false;
}
