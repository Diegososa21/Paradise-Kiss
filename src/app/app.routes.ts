import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { ResourceForm } from './home/resource-form/resource-form';

export const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'resource-form', component: ResourceForm },
	{ path: '**', redirectTo: '' },
];
