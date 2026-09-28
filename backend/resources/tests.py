from rest_framework import status
from rest_framework.test import APITestCase

from .models import resources


class ResourceApiTests(APITestCase):
    resource_data = {
        'name': 'Denim jacket',
        'desc': 'Blue oversized jacket',
        'size': 'M',
        'category': 'Jackets',
        'manufacurer': 'Paradise Kiss',
        'material': 'Denim',
        'gender': 'Unisex',
    }

    def test_lists_resources(self):
        resources.objects.create(**self.resource_data)

        response = self.client.get('/resources/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_creates_resource(self):
        response = self.client.post(
            '/resources/',
            self.resource_data,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resources.objects.count(), 1)
        self.assertNotIn('email', response.data)
        self.assertEqual(response.data['material'], 'Denim')

    def test_does_not_allow_resource_updates(self):
        resource = resources.objects.create(**self.resource_data)

        response = self.client.patch(
            f'/resources/{resource.id}/',
            {'name': 'Changed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

# Create your tests here.
