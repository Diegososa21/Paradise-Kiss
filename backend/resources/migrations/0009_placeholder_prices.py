from decimal import Decimal

from django.db import migrations

# Fictitious example prices (WHS, RT) for articles created before prices existed.
# They are placeholders and can be corrected in "Bestand verwalten".
PLACEHOLDER_PRICES = {
    'tees': ('6.50', '19.99'),
    'tops': ('7.00', '24.99'),
    'shirts': ('14.00', '39.99'),
    'skirts': ('12.00', '39.99'),
    'shorts': ('11.00', '34.99'),
    'hoodies': ('16.00', '49.99'),
    'dresses': ('18.00', '54.99'),
    'knitwear': ('21.00', '64.99'),
    'jeans': ('22.00', '69.99'),
    'jackets': ('32.00', '89.99'),
}
DEFAULT_PRICES = ('12.00', '34.99')


def assign_placeholder_prices(apps, schema_editor):
    Resource = apps.get_model('resources', 'resources')
    database = schema_editor.connection.alias
    products = (
        Resource.objects.using(database)
        .filter(wholesale_price__isnull=True)
        .select_related('category')
    )
    for product in products:
        wholesale, retail = PLACEHOLDER_PRICES.get(
            product.category.name.strip().lower(), DEFAULT_PRICES
        )
        product.wholesale_price = Decimal(wholesale)
        product.retail_price = Decimal(retail)
        product.save(using=database, update_fields=['wholesale_price', 'retail_price'])


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0008_resources_prices'),
    ]

    operations = [
        migrations.RunPython(assign_placeholder_prices, migrations.RunPython.noop),
    ]
