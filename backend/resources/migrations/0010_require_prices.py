import django.core.validators
from decimal import Decimal

from django.db import migrations, models


def price_field(label, help_text):
    return models.DecimalField(
        label,
        max_digits=10,
        decimal_places=2,
        validators=[django.core.validators.MinValueValidator(Decimal('0'))],
        help_text=help_text,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0009_placeholder_prices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='resources',
            name='wholesale_price',
            field=price_field('WHS-Preis', 'Einkaufspreis (Wholesale) pro Stück in Euro.'),
        ),
        migrations.AlterField(
            model_name='resources',
            name='retail_price',
            field=price_field('RT-Preis', 'Verkaufspreis (Retail) pro Stück in Euro.'),
        ),
        migrations.AddConstraint(
            model_name='resources',
            constraint=models.CheckConstraint(
                condition=models.Q(wholesale_price__gte=0, retail_price__gte=0),
                name='resource_prices_non_negative',
            ),
        ),
    ]
