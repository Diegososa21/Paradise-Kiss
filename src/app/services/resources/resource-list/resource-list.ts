import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ResourceService } from '../../resource.service';
import { Resource } from '../../../models/resource.model';

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.scss'
})
export class ResourceList implements OnInit {
  resources: Resource[] = [];
  loading = true;
  error = '';

  constructor(private resourceService: ResourceService) {}

  ngOnInit() {
    this.resourceService.getAll().subscribe({
      next: (data) => {
        this.resources = data;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Fehler beim Laden der Daten';
        this.loading = false;
        console.error(error);
      }
    });
  }
}
