import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class HomeComponent {
  protected readonly kpis = [
    { label: 'Artikel', value: '1.248', meta: 'heute', tone: 'pink', alert: false },
    { label: 'Lagerwert', value: '€ 84.230', meta: 'heute', tone: 'blue', alert: false },
    { label: 'Niedrig', value: '18', meta: '3 kritisch', tone: 'orange', alert: true },
    { label: 'Verkauft', value: '64', meta: 'heute', tone: 'cyan', alert: false },
  ] as const;

  protected readonly attentionItems = [
    { name: 'PK Hoodie Red', quantity: 4, tone: 'pink' },
    { name: 'Mesh Top Violet', quantity: 6, tone: 'orange' },
    { name: 'Mini Bag Sun', quantity: 5, tone: 'yellow' },
  ] as const;

  protected readonly trendBars = [
    { day: 'Mo', value: 24, height: 76, tone: 'pink' },
    { day: 'Di', value: 38, height: 122, tone: 'violet' },
    { day: 'Mi', value: 30, height: 96, tone: 'cyan' },
    { day: 'Do', value: 48, height: 152, tone: 'orange' },
    { day: 'Fr', value: 42, height: 132, tone: 'pink' },
    { day: 'Sa', value: 64, height: 202, tone: 'blue' },
    { day: 'So', value: 56, height: 176, tone: 'violet' },
  ] as const;

  protected readonly topProducts = [
    { name: 'Satin Skirt Pink', sales: 19, tone: 'pink' },
    { name: 'PK Hoodie Red', sales: 28, tone: 'cyan' },
    { name: 'Mesh Top Violet', sales: 23, tone: 'orange' },
    { name: 'Logo Cap Blue', sales: 15, tone: 'violet' },
  ] as const;
}
