from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction

from .gtin import build_gtin

class Manufacturer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    location = models.CharField(max_length=200)

    def __str__(self):
        return self.name

class Category(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name

class Gender(models.Model):
    name = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.name

class resources(models.Model):
    gtin = models.CharField(
        'GTIN',
        max_length=13,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text='Globale Artikelnummer (GTIN-13), wird beim Speichern automatisch vergeben.',
    )
    name = models.CharField(max_length=200)
    amount = models.IntegerField()
    desc = models.CharField(max_length=200)
    size = models.CharField(max_length=10)
    material = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    manufacturer = models.ForeignKey(Manufacturer, on_delete=models.PROTECT)
    gender = models.ForeignKey(Gender, on_delete=models.PROTECT)
    shelf_number = models.CharField(max_length=30, blank=True, default='')
    bin_number = models.CharField(max_length=30, blank=True, default='')
    reorder_threshold = models.PositiveIntegerField(default=5)
    purchase_date = models.DateField(null=True, blank=True)
    wholesale_price = models.DecimalField(
        'WHS-Preis',
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Einkaufspreis (Wholesale) pro Stück in Euro.',
    )
    retail_price = models.DecimalField(
        'RT-Preis',
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text='Verkaufspreis (Retail) pro Stück in Euro.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name='resource_amount_non_negative',
            ),
            models.CheckConstraint(
                condition=models.Q(wholesale_price__gte=0, retail_price__gte=0),
                name='resource_prices_non_negative',
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.gtin:
            return super().save(*args, **kwargs)

        # The GTIN is derived from the primary key, so a new product is inserted
        # first and numbered in the same transaction. Older rows without a GTIN
        # receive theirs the next time they are saved.
        using = kwargs.get('using')
        with transaction.atomic(using=using):
            super().save(*args, **kwargs)
            self.gtin = build_gtin(self.pk)
            super().save(using=using, update_fields=['gtin'])


class SalesData(models.Model):
    year = models.PositiveSmallIntegerField()
    quarter = models.PositiveSmallIntegerField()
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='sales_data')
    units_sold = models.PositiveIntegerField()
    revenue = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['year', 'quarter', 'category__name']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quarter__gte=1, quarter__lte=4),
                name='sales_quarter_between_1_and_4',
            ),
            models.UniqueConstraint(
                fields=['year', 'quarter', 'category'],
                name='unique_sales_period_category',
            ),
        ]

    def __str__(self):
        return f'{self.category} · {self.year} Q{self.quarter}'


class InventorySale(models.Model):
    resource = models.ForeignKey(
        resources,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_sales',
    )
    resource_name = models.CharField(max_length=200)
    category_name = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        'Verkaufspreis',
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='RT-Preis pro Stück zum Zeitpunkt des Verkaufs.',
    )
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()
    sold_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_sales',
    )
    sold_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-sold_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name='inventory_sale_quantity_positive',
            ),
            models.CheckConstraint(
                condition=models.Q(stock_before__gte=models.F('quantity')),
                name='inventory_sale_stock_sufficient',
            ),
            models.CheckConstraint(
                condition=models.Q(
                    stock_after=models.F('stock_before') - models.F('quantity')
                ),
                name='inventory_sale_stock_consistent',
            ),
        ]

    def __str__(self):
        return f'{self.resource_name} · {self.quantity} verkauft'


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        SALE = 'sale', 'Verkauf'
        RESTOCK = 'restock', 'Nachbestellung'
        CANCELLATION = 'cancellation', 'Storno'

    resource = models.ForeignKey(
        resources,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
    )
    resource_name = models.CharField(max_length=200)
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.PositiveIntegerField()
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()
    purchase_date = models.DateField(null=True, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
    )
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['movement_type', '-occurred_at'], name='movement_type_date_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name='stock_movement_quantity_positive',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        movement_type='sale',
                        stock_after=models.F('stock_before') - models.F('quantity'),
                    )
                    | models.Q(
                        movement_type__in=['restock', 'cancellation'],
                        stock_after=models.F('stock_before') + models.F('quantity'),
                    )
                ),
                name='stock_movement_amount_consistent',
            ),
        ]

    def __str__(self):
        return f'{self.resource_name} · {self.get_movement_type_display()} · {self.quantity}'
