from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import mail
from django.db import connection
from django.test import SimpleTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from .gtin import build_gtin, gtin_check_digit, is_valid_gtin
from .models import (
    Category,
    Gender,
    InventorySale,
    Manufacturer,
    SalesData,
    StockMovement,
    resources,
)


class ResourceApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='sosa.diego',
            email='diego@example.com',
            password='A-secure-test-password-2026!',
        )
        self.team_group = Group.objects.create(name='team')
        self.user.groups.add(self.team_group)
        self.teammate = get_user_model().objects.create_user(
            username='friedrich.nico',
            email='nico@example.com',
            password='A-secure-test-password-2026!',
        )
        self.teammate.groups.add(self.team_group)
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name='Jackets')
        self.gender = Gender.objects.create(name='Unisex')
        self.manufacturer = Manufacturer.objects.create(
            name='Paradise Kiss',
            location='Berlin',
        )
        self.resource_data = {
            'name': 'Denim jacket',
            'amount': 4,
            'desc': 'Blue oversized jacket',
            'size': 'M',
            'category': self.category,
            'manufacturer': self.manufacturer,
            'material': 'Denim',
            'gender': self.gender,
            'shelf_number': 'R-02',
            'bin_number': 'F-04',
            'reorder_threshold': 6,
            'purchase_date': '2026-10-05',
            'wholesale_price': '24.50',
            'retail_price': '79.99',
        }

    def api_payload(self):
        return {
            **self.resource_data,
            'category': self.category.id,
            'manufacturer': self.manufacturer.id,
            'gender': self.gender.id,
        }

    def test_lists_resources(self):
        resources.objects.create(**self.resource_data)

        response = self.client.get('/tables/resources/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_rejects_anonymous_requests(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/tables/resources/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creates_resource(self):
        response = self.client.post(
            '/tables/resources/',
            self.api_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resources.objects.count(), 1)
        self.assertEqual(response.data['category_name'], 'Jackets')
        self.assertEqual(response.data['manufacturer_name'], 'Paradise Kiss')
        self.assertEqual(response.data['material'], 'Denim')
        self.assertEqual(response.data['shelf_number'], 'R-02')
        self.assertEqual(response.data['bin_number'], 'F-04')
        self.assertEqual(response.data['reorder_threshold'], 6)
        self.assertEqual(response.data['purchase_date'], '2026-10-05')

    def test_rejects_negative_amount(self):
        payload = self.api_payload()
        payload['amount'] = -1

        response = self.client.post('/tables/resources/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_does_not_allow_resource_updates(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.patch(
            f'/tables/resources/{resource.id}/',
            {'name': 'Changed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_sells_resource_and_reduces_available_stock(self):
        self.resource_data['amount'] = 300
        resource = resources.objects.create(**self.resource_data)

        response = self.client.post(
            f'/tables/resources/{resource.id}/sell/',
            {'quantity': 150},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 150)
        self.assertEqual(response.data['resource']['amount'], 150)
        sale = InventorySale.objects.get()
        self.assertEqual(sale.quantity, 150)
        self.assertEqual(sale.stock_before, 300)
        self.assertEqual(sale.stock_after, 150)
        self.assertEqual(sale.sold_by, self.user)
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, StockMovement.MovementType.SALE)
        self.assertEqual(movement.quantity, 150)
        self.assertEqual(movement.stock_after, 150)
        self.assertEqual(response.data['movement']['movement_type'], 'sale')
        self.assertEqual(response.data['movement']['performed_by_username'], 'sosa.diego')

    def test_restocks_resource_and_records_purchase_and_location(self):
        self.resource_data['amount'] = 150
        resource = resources.objects.create(**self.resource_data)

        response = self.client.post(
            f'/tables/resources/{resource.id}/restock/',
            {
                'quantity': 75,
                'purchase_date': '2026-10-06',
                'shelf_number': 'R-07',
                'bin_number': 'F-02',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 225)
        self.assertEqual(str(resource.purchase_date), '2026-10-06')
        self.assertEqual(resource.shelf_number, 'R-07')
        self.assertEqual(resource.bin_number, 'F-02')
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, StockMovement.MovementType.RESTOCK)
        self.assertEqual(movement.stock_before, 150)
        self.assertEqual(movement.stock_after, 225)
        self.assertEqual(movement.performed_by, self.user)

    def test_rejects_zero_quantity_restock(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.post(
            f'/tables/resources/{resource.id}/restock/',
            {'quantity': 0},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_updates_inventory_settings_without_changing_stock(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.patch(
            f'/tables/resources/{resource.id}/inventory-settings/',
            {
                'shelf_number': 'R-11',
                'bin_number': 'F-08',
                'reorder_threshold': 12,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 4)
        self.assertEqual(resource.shelf_number, 'R-11')
        self.assertEqual(resource.bin_number, 'F-08')
        self.assertEqual(resource.reorder_threshold, 12)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_rejects_empty_inventory_settings_update(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.patch(
            f'/tables/resources/{resource.id}/inventory-settings/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_sale_larger_than_available_stock(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.post(
            f'/tables/resources/{resource.id}/sell/',
            {'quantity': 5},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 4)
        self.assertEqual(InventorySale.objects.count(), 0)

    def test_rejects_zero_quantity_sale(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.post(
            f'/tables/resources/{resource.id}/sell/',
            {'quantity': 0},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(InventorySale.objects.count(), 0)

    def test_deletes_resource_and_preserves_sale_history(self):
        resource = resources.objects.create(**self.resource_data)
        self.client.post(
            f'/tables/resources/{resource.id}/sell/',
            {'quantity': 2},
            format='json',
        )

        response = self.client.delete(f'/tables/resources/{resource.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(resources.objects.filter(pk=resource.id).exists())
        sale = InventorySale.objects.get()
        self.assertIsNone(sale.resource)
        self.assertEqual(sale.resource_name, 'Denim jacket')
        self.assertEqual(sale.category_name, 'Jackets')
        movement = StockMovement.objects.get()
        self.assertIsNone(movement.resource)
        self.assertEqual(movement.resource_name, 'Denim jacket')

    def test_lists_inventory_sales(self):
        resource = resources.objects.create(**self.resource_data)
        self.client.post(
            f'/tables/resources/{resource.id}/sell/',
            {'quantity': 2},
            format='json',
        )

        response = self.client.get('/tables/inventory-sales/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['quantity'], 2)
        self.assertEqual(response.data[0]['sold_by_username'], 'sosa.diego')

    def test_lists_stock_movements(self):
        resource = resources.objects.create(**self.resource_data)
        self.client.post(
            f'/tables/resources/{resource.id}/restock/',
            {'quantity': 3, 'purchase_date': '2026-10-06'},
            format='json',
        )

        response = self.client.get('/tables/stock-movements/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['movement_type'], 'restock')
        self.assertEqual(response.data[0]['performed_by_username'], 'sosa.diego')

    def test_lists_quarterly_sales_data(self):
        SalesData.objects.create(
            year=2025,
            quarter=4,
            category=self.category,
            units_sold=86,
            revenue='6708.00',
        )

        response = self.client.get('/tables/sales/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['category_name'], 'Jackets')
        self.assertEqual(response.data[0]['units_sold'], 86)

    def test_sales_data_is_read_only(self):
        response = self.client.post(
            '/tables/sales/',
            {
                'year': 2025,
                'quarter': 4,
                'category': self.category.id,
                'units_sold': 86,
                'revenue': '6708.00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL='lager@example.com',
    )
    def test_notifies_every_team_email_after_inventory_changes(self):
        mail.outbox.clear()
        resource = resources.objects.create(**self.resource_data)

        with self.captureOnCommitCallbacks(execute=True):
            sale_response = self.client.post(
                f'/tables/resources/{resource.id}/sell/',
                {'quantity': 1},
                format='json',
            )
        with self.captureOnCommitCallbacks(execute=True):
            restock_response = self.client.post(
                f'/tables/resources/{resource.id}/restock/',
                {'quantity': 2, 'purchase_date': '2026-10-06'},
                format='json',
            )
        with self.captureOnCommitCallbacks(execute=True):
            update_response = self.client.patch(
                f'/tables/resources/{resource.id}/inventory-settings/',
                {'reorder_threshold': 10},
                format='json',
            )
        with self.captureOnCommitCallbacks(execute=True):
            delete_response = self.client.delete(f'/tables/resources/{resource.id}/')

        self.assertEqual(sale_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(restock_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(mail.outbox), 8)
        self.assertEqual(
            {message.to[0] for message in mail.outbox},
            {'diego@example.com', 'nico@example.com'},
        )
        subjects = [message.subject for message in mail.outbox]
        self.assertTrue(any('Verkauf gebucht' in subject for subject in subjects))
        self.assertTrue(any('Nachbestellung gebucht' in subject for subject in subjects))
        self.assertTrue(any('Artikel aktualisiert' in subject for subject in subjects))
        self.assertTrue(any('Artikel gelöscht' in subject for subject in subjects))
        self.assertIn('Ausgeführt von: sosa.diego', mail.outbox[0].body)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL='lager@example.com',
    )
    def test_notifies_team_after_resource_creation(self):
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/tables/resources/', self.api_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 2)
        self.assertTrue(all('Artikel angelegt' in message.subject for message in mail.outbox))

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL='lager@example.com',
    )
    def test_notifies_every_registered_active_email(self):
        get_user_model().objects.create_user(
            username='fabian',
            email='fabian@example.com',
            password='A-secure-test-password-2026!',
        )
        get_user_model().objects.create_user(
            username='inactive',
            email='inactive@example.com',
            password='A-secure-test-password-2026!',
            is_active=False,
        )
        get_user_model().objects.create_user(username='no.email', email='')
        resource = resources.objects.create(**self.resource_data)
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                f'/tables/resources/{resource.id}/sell/',
                {'quantity': 1},
                format='json',
            )

        self.assertEqual(
            sorted(message.to[0] for message in mail.outbox),
            ['diego@example.com', 'fabian@example.com', 'nico@example.com'],
        )
        self.assertTrue(all(message.from_email == 'lager@example.com' for message in mail.outbox))

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=False,
    )
    def test_skips_emails_when_notifications_are_disabled(self):
        resource = resources.objects.create(**self.resource_data)
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(f'/tables/resources/{resource.id}/')

        self.assertEqual(len(mail.outbox), 0)

    def test_assigns_a_global_trade_item_number_on_create(self):
        response = self.client.post('/tables/resources/', self.api_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        resource = resources.objects.get()
        self.assertEqual(response.data['gtin'], build_gtin(resource.pk))
        self.assertEqual(resource.gtin, response.data['gtin'])
        self.assertTrue(is_valid_gtin(resource.gtin))

    def test_ignores_a_gtin_sent_by_the_client(self):
        payload = {**self.api_payload(), 'gtin': '4006381333931'}

        response = self.client.post('/tables/resources/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data['gtin'], '4006381333931')
        self.assertTrue(response.data['gtin'].startswith('20'))

    def test_keeps_the_gtin_when_stock_changes(self):
        resource = resources.objects.create(**self.resource_data)
        original_gtin = resource.gtin

        self.client.post(f'/tables/resources/{resource.id}/sell/', {'quantity': 1}, format='json')

        resource.refresh_from_db()
        self.assertEqual(resource.gtin, original_gtin)

    def test_numbers_products_saved_by_older_code_on_their_next_change(self):
        resource = resources.objects.create(**self.resource_data)
        resources.objects.filter(pk=resource.pk).update(gtin=None)

        self.client.post(f'/tables/resources/{resource.id}/sell/', {'quantity': 1}, format='json')

        resource.refresh_from_db()
        self.assertEqual(resource.gtin, build_gtin(resource.pk))

    def test_searches_products_by_gtin_and_characteristics(self):
        jacket = resources.objects.create(**self.resource_data)
        other_manufacturer = Manufacturer.objects.create(name='Nordic Wool', location='Oslo')
        resources.objects.create(
            **{**self.resource_data, 'name': 'Wool scarf', 'manufacturer': other_manufacturer}
        )

        by_gtin = self.client.get('/tables/resources/', {'search': jacket.gtin})
        by_supplier = self.client.get('/tables/resources/', {'search': 'nordic'})

        self.assertEqual([item['name'] for item in by_gtin.data], ['Denim jacket'])
        self.assertEqual([item['name'] for item in by_supplier.data], ['Wool scarf'])

    def test_creates_a_category(self):
        response = self.client.post('/tables/categories/', {'name': '  Accessoires  '}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Accessoires')
        self.assertTrue(Category.objects.filter(name='Accessoires').exists())

    def test_rejects_a_duplicate_category_ignoring_case(self):
        response = self.client.post('/tables/categories/', {'name': 'jackets'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('existiert bereits', response.data['name'][0])
        self.assertEqual(Category.objects.count(), 1)

    def test_creates_a_supplier(self):
        response = self.client.post(
            '/tables/manufacturers/',
            {'name': 'Nordic Wool', 'location': 'Oslo'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Manufacturer.objects.filter(name='Nordic Wool', location='Oslo').exists())

    def test_rejects_a_supplier_without_location_or_duplicate_name(self):
        missing_location = self.client.post(
            '/tables/manufacturers/', {'name': 'Nordic Wool'}, format='json'
        )
        duplicate = self.client.post(
            '/tables/manufacturers/',
            {'name': 'PARADISE KISS', 'location': 'Hamburg'},
            format='json',
        )

        self.assertEqual(missing_location.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location', missing_location.data)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('existiert bereits', duplicate.data['name'][0])


    def test_stores_wholesale_and_retail_prices(self):
        response = self.client.post('/tables/resources/', self.api_payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['wholesale_price'], '24.50')
        self.assertEqual(response.data['retail_price'], '79.99')
        resource = resources.objects.get()
        self.assertEqual(str(resource.wholesale_price), '24.50')
        self.assertEqual(str(resource.retail_price), '79.99')

    def test_requires_valid_prices(self):
        missing = self.api_payload()
        del missing['retail_price']
        negative = {**self.api_payload(), 'wholesale_price': '-1.00'}
        too_precise = {**self.api_payload(), 'retail_price': '10.999'}

        for payload in (missing, negative, too_precise):
            response = self.client.post('/tables/resources/', payload, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, payload)
        self.assertEqual(resources.objects.count(), 0)

    def test_updates_prices_in_inventory_settings(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.patch(
            f'/tables/resources/{resource.id}/inventory-settings/',
            {'wholesale_price': '26.00', 'retail_price': '84.90'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['retail_price'], '84.90')
        resource.refresh_from_db()
        self.assertEqual(str(resource.wholesale_price), '26.00')
        self.assertEqual(resource.amount, 4)

    def test_edits_product_details_without_touching_stock_or_gtin(self):
        resource = resources.objects.create(**self.resource_data)
        gtin = resource.gtin
        new_category = Category.objects.create(name='Jeans')
        new_supplier = Manufacturer.objects.create(name='Nordic Wool', location='Oslo')

        response = self.client.patch(
            f'/tables/resources/{resource.id}/details/',
            {
                'name': 'Relaxed Jeans',
                'desc': 'Washed denim',
                'size': 'L',
                'material': 'Organic denim',
                'category': new_category.id,
                'manufacturer': new_supplier.id,
                'amount': 999,
                'gtin': '4006381333931',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Relaxed Jeans')
        self.assertEqual(response.data['category_name'], 'Jeans')
        self.assertEqual(response.data['manufacturer_name'], 'Nordic Wool')
        resource.refresh_from_db()
        self.assertEqual(resource.size, 'L')
        self.assertEqual(resource.amount, 4)
        self.assertEqual(resource.gtin, gtin)

    def test_rejects_invalid_product_details(self):
        resource = resources.objects.create(**self.resource_data)

        empty_name = self.client.patch(
            f'/tables/resources/{resource.id}/details/', {'name': ''}, format='json'
        )
        long_size = self.client.patch(
            f'/tables/resources/{resource.id}/details/', {'size': 'X' * 11}, format='json'
        )
        unknown_category = self.client.patch(
            f'/tables/resources/{resource.id}/details/', {'category': 9999}, format='json'
        )
        nothing = self.client.patch(f'/tables/resources/{resource.id}/details/', {}, format='json')

        for response in (empty_name, long_size, unknown_category, nothing):
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        resource.refresh_from_db()
        self.assertEqual(resource.name, 'Denim jacket')

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL='lager@example.com',
    )
    def test_notifies_the_team_about_changed_product_details(self):
        resource = resources.objects.create(**self.resource_data)
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                f'/tables/resources/{resource.id}/details/',
                {'name': 'Relaxed Jeans', 'size': 'M'},
                format='json',
            )

        self.assertEqual(len(mail.outbox), 2)
        self.assertIn('Artikel aktualisiert: Denim jacket', mail.outbox[0].subject)
        self.assertIn('Name: Denim jacket → Relaxed Jeans', mail.outbox[0].body)
        self.assertNotIn('Größe', mail.outbox[0].body)

    def sell(self, resource, quantity):
        response = self.client.post(
            f'/tables/resources/{resource.id}/sell/', {'quantity': quantity}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data['sale']['id']

    def test_cancels_a_sale_and_puts_the_units_back_into_stock(self):
        self.resource_data['amount'] = 10
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 3)

        response = self.client.delete(f'/tables/inventory-sales/{sale_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['resource']['amount'], 10)
        self.assertEqual(response.data['movement']['movement_type'], 'cancellation')
        self.assertEqual(response.data['movement']['movement_type_label'], 'Storno')
        self.assertFalse(InventorySale.objects.filter(pk=sale_id).exists())
        resource.refresh_from_db()
        self.assertEqual(resource.amount, 10)
        cancellation = StockMovement.objects.get(movement_type='cancellation')
        self.assertEqual((cancellation.stock_before, cancellation.stock_after), (7, 10))
        self.assertEqual(cancellation.performed_by, self.user)
        self.assertEqual(StockMovement.objects.filter(movement_type='sale').count(), 1)

    def test_locks_rows_without_outer_joins(self):
        # PostgreSQL rejects SELECT ... FOR UPDATE with LEFT OUTER JOIN; SQLite
        # ignores FOR UPDATE, so check the SQL that would be locked instead.
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 1)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.delete(f'/tables/inventory-sales/{sale_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        locking_selects = [
            query['sql']
            for query in queries.captured_queries
            if query['sql'].startswith('SELECT')
            and ('"resources_inventorysale"' in query['sql'].split('WHERE')[0]
                 or '"resources_resources"' in query['sql'].split('WHERE')[0])
        ]
        self.assertTrue(locking_selects)
        for sql in locking_selects:
            self.assertNotIn('LEFT OUTER JOIN', sql)

    def test_cancels_a_sale_of_a_deleted_product_without_restocking(self):
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 1)
        self.client.delete(f'/tables/resources/{resource.id}/')

        response = self.client.delete(f'/tables/inventory-sales/{sale_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['resource'])
        self.assertFalse(InventorySale.objects.exists())
        self.assertFalse(StockMovement.objects.filter(movement_type='cancellation').exists())

    def test_cancelling_an_unknown_sale_returns_not_found(self):
        response = self.client.delete('/tables/inventory-sales/9999/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_only_team_members_can_cancel_sales(self):
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 1)
        self.client.force_authenticate(user=None)

        response = self.client.delete(f'/tables/inventory-sales/{sale_id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(InventorySale.objects.filter(pk=sale_id).exists())

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL='lager@example.com',
    )
    def test_notifies_the_team_about_a_cancelled_sale(self):
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 2)
        mail.outbox.clear()

        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(f'/tables/inventory-sales/{sale_id}/')

        self.assertEqual(len(mail.outbox), 2)
        self.assertIn('Verkauf storniert: Denim jacket', mail.outbox[0].subject)
        self.assertIn('Stornierte Menge: 2', mail.outbox[0].body)
        self.assertIn('Bestand danach: 4', mail.outbox[0].body)

    def test_a_sale_stores_the_retail_price_of_that_moment(self):
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 2)
        resources.objects.filter(pk=resource.pk).update(retail_price='99.00')

        sale = InventorySale.objects.get(pk=sale_id)
        response = self.client.get('/tables/inventory-sales/')

        self.assertEqual(str(sale.unit_price), '79.99')
        self.assertEqual(response.data[0]['unit_price'], '79.99')
        self.assertEqual(response.data[0]['revenue'], '159.98')

    def test_sales_report_combines_history_and_registered_sales(self):
        other_category = Category.objects.create(name='Tees')
        SalesData.objects.create(
            year=2025, quarter=4, category=self.category, units_sold=10, revenue='500.00'
        )
        SalesData.objects.create(
            year=2025, quarter=4, category=other_category, units_sold=5, revenue='100.50'
        )
        SalesData.objects.create(
            year=2024, quarter=1, category=self.category, units_sold=3, revenue='90.00'
        )
        resource = resources.objects.create(**self.resource_data)
        self.sell(resource, 2)

        response = self.client.get('/tables/sales-report/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        quarters = response.data['quarters']
        self.assertEqual(
            [(q['year'], q['quarter'], q['units'], q['revenue'], q['source']) for q in quarters[:2]],
            [(2024, 1, 3, '90.00', 'historical'), (2025, 4, 15, '600.50', 'historical')],
        )
        live = quarters[-1]
        self.assertEqual((live['units'], live['revenue'], live['source']), (2, '159.98', 'live'))
        self.assertEqual(
            [(y['year'], y['revenue']) for y in response.data['years']][:2],
            [(2024, '90.00'), (2025, '600.50')],
        )
        self.assertEqual(response.data['total_units'], 20)
        self.assertEqual(response.data['total_revenue'], '850.48')

    def test_sales_report_uses_german_time_for_quarters(self):
        resource = resources.objects.create(**self.resource_data)
        sale_id = self.sell(resource, 1)
        # 23:30 UTC on 31 December is already 1 January in Germany.
        InventorySale.objects.filter(pk=sale_id).update(
            sold_at=datetime(2025, 12, 31, 23, 30, tzinfo=dt_timezone.utc)
        )

        response = self.client.get('/tables/sales-report/')

        self.assertEqual(
            [(q['year'], q['quarter']) for q in response.data['quarters']], [(2026, 1)]
        )

    def test_sales_report_requires_a_team_session(self):
        self.client.force_authenticate(user=None)

        response = self.client.get('/tables/sales-report/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class GtinTests(SimpleTestCase):
    def test_check_digit_matches_the_gs1_algorithm(self):
        self.assertEqual(gtin_check_digit('400638133393'), '1')
        self.assertTrue(is_valid_gtin('4006381333931'))
        self.assertFalse(is_valid_gtin('4006381333932'))

    def test_builds_internal_gtins_from_the_product_id(self):
        self.assertEqual(build_gtin(7)[:12], '200000000007')
        self.assertTrue(is_valid_gtin(build_gtin(7)))
        self.assertTrue(is_valid_gtin(build_gtin(9_999_999_999)))
        with self.assertRaises(ValueError):
            build_gtin(10_000_000_000)
