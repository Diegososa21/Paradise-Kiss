import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Resource } from '../models/resource.model';
import { ResourceService } from '../services/resource.service';
import { formatPrice } from '../shared/price';
import { NavigationSidebarComponent } from '../shared/navigation-sidebar/navigation-sidebar';

export type StockFilter = 'all' | 'available' | 'low' | 'empty';

interface FilterOption {
  id: number;
  name: string;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** Lowercase and remove accents so "groesse", "Größe" and "GROSSE" compare sensibly. */
function normalize(value: string): string {
  return value.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function searchableText(resource: Resource): string {
  return normalize(
    [
      resource.gtin ?? '',
      resource.name,
      resource.desc,
      resource.size,
      resource.material,
      resource.category_name,
      resource.manufacturer_name,
      resource.gender_name,
      resource.shelf_number,
      resource.bin_number,
      `${resource.shelf_number}/${resource.bin_number}`,
    ].join(' '),
  );
}

function uniqueOptions(resources: Resource[], key: 'category' | 'manufacturer' | 'gender') {
  const options = new Map<number, string>();
  for (const resource of resources) {
    options.set(resource[key], resource[`${key}_name` as const]);
  }
  return [...options]
    .map(([id, name]): FilterOption => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name, 'de'));
}

function compareSizes(first: string, second: string): number {
  const firstIndex = SIZE_ORDER.indexOf(first.toUpperCase());
  const secondIndex = SIZE_ORDER.indexOf(second.toUpperCase());
  if (firstIndex !== -1 && secondIndex !== -1) return firstIndex - secondIndex;
  if (firstIndex !== -1) return -1;
  if (secondIndex !== -1) return 1;
  return first.localeCompare(second, 'de', { numeric: true });
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [DatePipe, RouterLink, NavigationSidebarComponent],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
})
export class InventoryComponent implements OnInit {
  private readonly resourceService = inject(ResourceService);

  protected readonly resources = signal<Resource[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly categoryTones = ['pink', 'cyan', 'orange', 'violet'] as const;
  protected readonly formatPrice = formatPrice;

  protected readonly searchTerm = signal('');
  protected readonly filtersOpen = signal(false);
  protected readonly categoryFilter = signal<number | null>(null);
  protected readonly manufacturerFilter = signal<number | null>(null);
  protected readonly genderFilter = signal<number | null>(null);
  protected readonly sizeFilter = signal('');
  protected readonly stockFilter = signal<StockFilter>('all');

  protected readonly sortedResources = computed(() =>
    [...this.resources()].sort((first, second) => first.name.localeCompare(second.name)),
  );
  protected readonly totalStock = computed(() =>
    this.resources().reduce((total, resource) => total + resource.amount, 0),
  );
  protected readonly lowStockCount = computed(
    () =>
      this.resources().filter((resource) => resource.amount <= resource.reorder_threshold).length,
  );

  protected readonly categoryOptions = computed(() => uniqueOptions(this.resources(), 'category'));
  protected readonly manufacturerOptions = computed(() =>
    uniqueOptions(this.resources(), 'manufacturer'),
  );
  protected readonly genderOptions = computed(() => uniqueOptions(this.resources(), 'gender'));
  protected readonly sizeOptions = computed(() =>
    [...new Set(this.resources().map((resource) => resource.size))].sort(compareSizes),
  );

  protected readonly activeFilterCount = computed(
    () =>
      [
        this.categoryFilter() !== null,
        this.manufacturerFilter() !== null,
        this.genderFilter() !== null,
        this.sizeFilter() !== '',
        this.stockFilter() !== 'all',
      ].filter(Boolean).length,
  );
  protected readonly isFiltering = computed(
    () => this.activeFilterCount() > 0 || this.searchTerm().trim() !== '',
  );

  protected readonly filteredResources = computed(() => {
    const terms = normalize(this.searchTerm()).split(/\s+/).filter(Boolean);
    const category = this.categoryFilter();
    const manufacturer = this.manufacturerFilter();
    const gender = this.genderFilter();
    const size = this.sizeFilter();
    const stock = this.stockFilter();

    return this.sortedResources().filter((resource) => {
      if (category !== null && resource.category !== category) return false;
      if (manufacturer !== null && resource.manufacturer !== manufacturer) return false;
      if (gender !== null && resource.gender !== gender) return false;
      if (size && resource.size !== size) return false;
      if (stock === 'available' && resource.amount === 0) return false;
      if (stock === 'empty' && resource.amount !== 0) return false;
      if (stock === 'low' && resource.amount > resource.reorder_threshold) return false;
      if (terms.length === 0) return true;

      const text = searchableText(resource);
      return terms.every((term) => text.includes(term));
    });
  });

  ngOnInit(): void {
    this.resourceService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resources) => this.resources.set(resources),
        error: () => this.error.set('Der Bestand konnte nicht geladen werden.'),
      });
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected selectId(event: Event): number | null {
    const value = (event.target as HTMLSelectElement).value;
    return value === '' ? null : Number(value);
  }

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected updateStockFilter(event: Event): void {
    this.stockFilter.set(this.selectValue(event) as StockFilter);
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.categoryFilter.set(null);
    this.manufacturerFilter.set(null);
    this.genderFilter.set(null);
    this.sizeFilter.set('');
    this.stockFilter.set('all');
  }
}
