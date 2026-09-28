from rest_framework import status
from rest_framework.test import APITestCase

from .models import resources


class ResourceApiTests(APITestCase):
    def test_lists_resources(self):
        resources.objects.create(name='Test', email='test@example.com')

        response = self.client.get('/resources/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_creates_resource(self):
        response = self.client.post(
            '/resources/',
            {'name': 'New resource', 'email': 'new@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resources.objects.count(), 1)

    def test_does_not_allow_resource_updates(self):
        resource = resources.objects.create(name='Test', email='test@example.com')

        response = self.client.patch(
            f'/resources/{resource.id}/',
            {'name': 'Changed'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

# Create your tests here.
