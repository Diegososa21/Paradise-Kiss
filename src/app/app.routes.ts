import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { RescourceFormComponent } from './resources/rescourceForm';
import { ResourceList } from './services/resources/resource-list/resource-list';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'resources/new', component: RescourceFormComponent },
  { path: 'resources', component: ResourceList },
  { path: 'rescourceForm', redirectTo: 'resources/new', pathMatch: 'full' },
  { path: 'resource-list', redirectTo: 'resources', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
