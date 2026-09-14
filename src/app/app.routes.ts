import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { ResourceFormComponent } from './resource-form/resource-form';

export const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'resource-form', component: ResourceFormComponent },
	{ path: '**', redirectTo: '' },
];
