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
