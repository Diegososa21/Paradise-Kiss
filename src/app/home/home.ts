import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly loading = signal(true);
  protected readonly resourceError = signal('');
  protected readonly itemTones = ['pink', 'orange', 'yellow'] as const;
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;

  protected readonly kpis = computed(() => [
    {
      label: 'Artikel',
      value: this.loading()
        ? '…'
        : this.resourceError()
          ? '—'
          : this.resources().length.toLocaleString('de-DE'),
      meta: this.resourceError() ? 'Backend offline' : 'aus Datenbank',
      tone: 'pink',
      alert: Boolean(this.resourceError()),
    },
    { label: 'Lagerwert', value: '—', meta: 'nicht verfügbar', tone: 'blue', alert: false },
    {
      label: 'Niedrig',
      value: this.loading()
        ? '…'
        : this.resourceError()
          ? '—'
          : this.resources()
              .filter((resource) => resource.amount <= 5)
              .length.toLocaleString('de-DE'),
      meta: this.resourceError() ? 'Backend offline' : '5 oder weniger',
      tone: 'orange',
      alert: !this.resourceError() && this.resources().some((resource) => resource.amount <= 5),
    },
    { label: 'Verkauft', value: '—', meta: 'nicht verfügbar', tone: 'cyan', alert: false },
  ]);

  protected readonly recentResources = computed(() =>
    [...this.resources()]
      .sort((first, second) => second.created_at.localeCompare(first.created_at))
      .slice(0, 3),
  );

  protected readonly categorySummaries = computed(() => {
    const counts = new Map<string, number>();

    for (const resource of this.resources()) {
      counts.set(resource.category_name, (counts.get(resource.category_name) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
      .slice(0, 4);
  });

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => this.resources.set(resources),
        error: () => this.resourceError.set('Die Datenbank konnte nicht geladen werden.'),
      });
  }
}
