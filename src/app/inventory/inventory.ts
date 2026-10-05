import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';
import { UserSessionComponent } from '../shared/user-session/user-session';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [RouterLink, NavigationSidebarComponent, UserSessionComponent],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class InventoryComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly sortedResources = computed(() =>
    [...this.resources()].sort((first, second) => first.name.localeCompare(second.name)),
  );
  protected readonly totalStock = computed(() =>
    this.resources().reduce((total, resource) => total + resource.amount, 0),
  );
  protected readonly lowStockCount = computed(
    () => this.resources().filter((resource) => resource.amount <= 5).length,
  );

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => this.resources.set(resources),
        error: () => this.error.set('Der Bestand konnte nicht geladen werden.'),
      });
  }
}
