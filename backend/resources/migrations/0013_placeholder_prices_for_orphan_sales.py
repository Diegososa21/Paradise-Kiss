from decimal import Decimal

from django.db import migrations

# Same fictitious RT prices as 0009_placeholder_prices, for sales whose product
# was deleted before prices existed (their price can no longer be looked up).
PLACEHOLDER_RETAIL_PRICES = {
    'tees': '19.99',
    'tops': '24.99',
    'shirts': '39.99',
    'skirts': '39.99',
    'shorts': '34.99',
    'hoodies': '49.99',
    'dresses': '54.99',
    'knitwear': '64.99',
    'jeans': '69.99',
    'jackets': '89.99',
}
DEFAULT_RETAIL_PRICE = '34.99'


def price_orphan_sales(apps, schema_editor):
    InventorySale = apps.get_model('resources', 'InventorySale')
    database = schema_editor.connection.alias
    for sale in InventorySale.objects.using(database).filter(unit_price__isnull=True):
        price = PLACEHOLDER_RETAIL_PRICES.get(
            sale.category_name.strip().lower(), DEFAULT_RETAIL_PRICE
        )
        sale.unit_price = Decimal(price)
        sale.save(using=database, update_fields=['unit_price'])


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0012_inventorysale_unit_price'),
    ]

    operations = [
        migrations.RunPython(price_orphan_sales, migrations.RunPython.noop),
    ]
