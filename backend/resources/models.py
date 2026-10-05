from django.conf import settings
from django.db import models

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
    name = models.CharField(max_length=200)
    amount = models.IntegerField()
    desc = models.CharField(max_length=200)
    size = models.CharField(max_length=10)
    material = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    manufacturer = models.ForeignKey(Manufacturer, on_delete=models.PROTECT)
    gender = models.ForeignKey(Gender, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name='resource_amount_non_negative',
            ),
        ]

    def __str__(self):
        return self.name


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
