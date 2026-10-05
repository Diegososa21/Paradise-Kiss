from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Gender, Manufacturer, SalesData, resources


class ResourceApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='diego',
            password='A-secure-test-password-2026!',
        )
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

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

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
