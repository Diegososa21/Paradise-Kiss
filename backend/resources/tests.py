from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Gender, InventorySale, Manufacturer, SalesData, resources


class ResourceApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='sosa.diego',
            password='A-secure-test-password-2026!',
        )
        self.user.groups.add(Group.objects.create(name='team'))
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
