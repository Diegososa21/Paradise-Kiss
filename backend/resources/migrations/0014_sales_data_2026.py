from decimal import Decimal

from django.db import migrations

# Fictitious history for 2026 Q1-Q3, built with the same formula as
# 0004_salesdata. Q4 2026 is the current quarter: it intentionally has no
# historical row and only shows the sales registered in the app.
CATEGORY_PROFILES = (
    ('Tees', 95, Decimal('28.00')),
    ('Hoodies', 72, Decimal('65.00')),
    ('Jeans', 65, Decimal('78.00')),
    ('Tops', 84, Decimal('42.00')),
    ('Jackets', 58, Decimal('120.00')),
    ('Dresses', 69, Decimal('95.00')),
    ('Skirts', 55, Decimal('58.00')),
    ('Shirts', 62, Decimal('55.00')),
    ('Knitwear', 48, Decimal('75.00')),
    ('Shorts', 60, Decimal('45.00')),
)

YEAR = 2026
YEAR_FACTOR = Decimal('1.24')  # 2023: 0.84, 2024: 0.96, 2025: 1.10
QUARTER_FACTORS = {
    1: Decimal('0.86'),
    2: Decimal('1.03'),
    3: Decimal('0.94'),
}


def seed_sales_data_2026(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    Category = apps.get_model('resources', 'Category')
    SalesData = apps.get_model('resources', 'SalesData')
    database = schema_editor.connection.alias
    sales_rows = []

    for category_index, (category_name, base_units, average_price) in enumerate(CATEGORY_PROFILES):
        category, _ = Category.objects.using(database).get_or_create(name=category_name)
        category_factor = Decimal('0.97') + Decimal(category_index % 4) * Decimal('0.02')

        for quarter, quarter_factor in QUARTER_FACTORS.items():
            units_sold = int(Decimal(base_units) * YEAR_FACTOR * quarter_factor * category_factor)
            sales_rows.append(
                SalesData(
                    year=YEAR,
                    quarter=quarter,
                    category=category,
                    units_sold=units_sold,
                    revenue=Decimal(units_sold) * average_price,
                )
            )

    SalesData.objects.using(database).bulk_create(sales_rows, ignore_conflicts=True)


def remove_sales_data_2026(apps, schema_editor):
    SalesData = apps.get_model('resources', 'SalesData')
    SalesData.objects.using(schema_editor.connection.alias).filter(
        year=YEAR, quarter__in=QUARTER_FACTORS
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0013_placeholder_prices_for_orphan_sales'),
    ]

    operations = [
        migrations.RunPython(seed_sales_data_2026, remove_sales_data_2026),
    ]
