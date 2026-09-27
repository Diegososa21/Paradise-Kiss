import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { RescourceFormComponent } from './resources/rescourceForm';
import { ResourceList } from './services/resources/resource-list/resource-list';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'rescourceForm', component: RescourceFormComponent },
  { path: 'resource-list', component: ResourceList },
];