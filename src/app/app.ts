import { Component } from '@angular/core';
import { HomeComponent } from './home/home';

@Component({
  imports: [HomeComponent],
  selector: 'app-root',
  template: '<app-home />',
  styleUrl: './app.scss',
})
export class App {}
