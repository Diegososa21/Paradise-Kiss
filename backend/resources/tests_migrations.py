import importlib
from decimal import Decimal
from types import SimpleNamespace

from django.apps import apps as django_apps
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from .gtin import build_gtin


class MigrationTestCase(TransactionTestCase):
    """Migrates to `before`, lets the test add old data, then migrates to `after`."""

    before = []
    after = []

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def migrate_to(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def create_product(self, apps, **fields):
        Category = apps.get_model('resources', 'Category')
        Gender = apps.get_model('resources', 'Gender')
        Manufacturer = apps.get_model('resources', 'Manufacturer')
        Resource = apps.get_model('resources', 'resources')
        category_name = fields.pop('category_name', 'Jackets')
        return Resource.objects.create(
            name=fields.pop('name', 'Denim jacket'),
            amount=4,
            desc='Blue',
            size='M',
            material='Denim',
            category=Category.objects.get_or_create(name=category_name)[0],
            manufacturer=Manufacturer.objects.get_or_create(
                name='Paradise Kiss', defaults={'location': 'Berlin'}
            )[0],
            gender=Gender.objects.get_or_create(name='Unisex')[0],
            **fields,
        )


class GtinMigrationTests(MigrationTestCase):
    def test_existing_products_receive_a_gtin(self):
        old_apps = self.migrate_to([('resources', '0006_add_stock_location_and_movements')])
        product = self.create_product(old_apps)

        new_apps = self.migrate_to([('resources', '0007_resources_gtin')])

        migrated = new_apps.get_model('resources', 'resources').objects.get(pk=product.pk)
        self.assertEqual(migrated.gtin, build_gtin(product.pk))


class PriceMigrationTests(MigrationTestCase):
    def test_existing_products_receive_placeholder_prices_by_category(self):
        old_apps = self.migrate_to([('resources', '0007_resources_gtin')])
        jacket = self.create_product(old_apps, category_name='Jackets')
        accessory = self.create_product(old_apps, name='Belt', category_name='Accessoires')

        new_apps = self.migrate_to([('resources', '0010_require_prices')])

        Resource = new_apps.get_model('resources', 'resources')
        jacket = Resource.objects.get(pk=jacket.pk)
        accessory = Resource.objects.get(pk=accessory.pk)
        self.assertEqual(
            (jacket.wholesale_price, jacket.retail_price), (Decimal('32.00'), Decimal('89.99'))
        )
        self.assertEqual(
            (accessory.wholesale_price, accessory.retail_price),
            (Decimal('12.00'), Decimal('34.99')),
        )


class SaleUnitPriceMigrationTests(MigrationTestCase):
    def test_existing_sales_receive_the_current_retail_price(self):
        old_apps = self.migrate_to([('resources', '0011_stock_movement_cancellation')])
        product = self.create_product(
            old_apps, wholesale_price=Decimal('10.00'), retail_price=Decimal('29.90')
        )
        InventorySale = old_apps.get_model('resources', 'InventorySale')
        sale = InventorySale.objects.create(
            resource=product,
            resource_name=product.name,
            category_name='Jackets',
            quantity=1,
            stock_before=4,
            stock_after=3,
        )

        new_apps = self.migrate_to([('resources', '0012_inventorysale_unit_price')])

        migrated = new_apps.get_model('resources', 'InventorySale').objects.get(pk=sale.pk)
        self.assertEqual(migrated.unit_price, Decimal('29.90'))

    def test_sales_of_deleted_products_receive_a_placeholder_price(self):
        old_apps = self.migrate_to([('resources', '0012_inventorysale_unit_price')])
        InventorySale = old_apps.get_model('resources', 'InventorySale')
        sale = InventorySale.objects.create(
            resource=None,
            resource_name='Hosen',
            category_name='Jeans',
            quantity=1,
            stock_before=2,
            stock_after=1,
        )

        new_apps = self.migrate_to([('resources', '0013_placeholder_prices_for_orphan_sales')])

        migrated = new_apps.get_model('resources', 'InventorySale').objects.get(pk=sale.pk)
        self.assertEqual(migrated.unit_price, Decimal('69.99'))


class SalesData2026MigrationTests(TransactionTestCase):
    def test_seeds_q1_to_q3_of_2026_and_leaves_q4_for_registered_sales(self):
        migration = importlib.import_module('resources.migrations.0014_sales_data_2026')
        # The seed only runs on PostgreSQL (like 0004); pretend to be PostgreSQL here.
        editor = SimpleNamespace(connection=SimpleNamespace(vendor='postgresql', alias='default'))

        migration.seed_sales_data_2026(django_apps, editor)
        migration.seed_sales_data_2026(django_apps, editor)  # running twice adds nothing

        SalesData = django_apps.get_model('resources', 'SalesData')
        rows = SalesData.objects.filter(year=2026)
        self.assertEqual(sorted(set(rows.values_list('quarter', flat=True))), [1, 2, 3])
        self.assertEqual(rows.count(), 30)
        tees_q2 = rows.get(quarter=2, category__name='Tees')
        # 95 units * 1.24 * 1.03 * 0.97 = 117.7 -> 117 units at 28 EUR
        self.assertEqual((tees_q2.units_sold, tees_q2.revenue), (117, Decimal('3276.00')))

        migration.remove_sales_data_2026(django_apps, editor)
        self.assertFalse(SalesData.objects.filter(year=2026).exists())
