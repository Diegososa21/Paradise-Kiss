import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'resources/new',
    loadComponent: () =>
      import('./resources/rescourceForm').then((module) => module.RescourceFormComponent),
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./inventory/inventory').then((module) => module.InventoryComponent),
  },
  {
    path: 'inventory/manage',
    loadComponent: () =>
      import('./services/resources/resource-list/resource-list').then(
        (module) => module.ResourceList,
      ),
  },
  {
    path: 'sales',
    loadComponent: () => import('./sales/sales').then((module) => module.SalesComponent),
  },
  {
    path: 'analysis',
    loadComponent: () => import('./analysis/analysis').then((module) => module.AnalysisComponent),
  },
  { path: 'resources', redirectTo: 'inventory/manage', pathMatch: 'full' },
  { path: 'rescourceForm', redirectTo: 'resources/new', pathMatch: 'full' },
  { path: 'resource-list', redirectTo: 'inventory/manage', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
