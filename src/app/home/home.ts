import { Component } from '@angular/core';
import { ResourceFormComponent } from '../resource-form/resource-form';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ResourceFormComponent],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent {
    showForm = false;
}
