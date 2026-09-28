import json

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.test import Client, TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class AuthApiTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def csrf_token(self):
        response = self.client.get('/auth/csrf/')
        self.assertEqual(response.status_code, 200)
        return response.cookies['XSRF-TOKEN'].value

    def post_json(self, path, payload):
        return self.client.post(
            path,
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_XSRF_TOKEN=self.csrf_token(),
            HTTP_ORIGIN='http://localhost:4200',
        )

    def test_session_is_anonymous_before_login(self):
        response = self.client.get('/auth/session/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['authenticated'])

    def test_untrusted_origin_is_rejected(self):
        response = self.client.post(
            '/auth/login/',
            data=json.dumps({'username': 'diego', 'password': 'irrelevant'}),
            content_type='application/json',
            HTTP_X_XSRF_TOKEN=self.csrf_token(),
            HTTP_ORIGIN='https://attacker.example',
        )

        self.assertEqual(response.status_code, 403)

    def test_approved_user_can_login_and_logout(self):
        get_user_model().objects.create_user(
            username='diego',
            first_name='Diego',
            password='A-secure-test-password-2026!',
        )

        response = self.post_json(
            '/auth/login/',
            {'username': 'diego', 'password': 'A-secure-test-password-2026!'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['authenticated'])
        self.assertEqual(response.json()['user']['display_name'], 'Diego')

        response = self.post_json('/auth/logout/', {})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['authenticated'])

    def test_admin_account_cannot_login_to_the_app(self):
        get_user_model().objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='A-secure-test-password-2026!',
        )

        response = self.post_json(
            '/auth/login/',
            {'username': 'admin', 'password': 'A-secure-test-password-2026!'},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse('_auth_user_id' in self.client.session)

    def test_activation_link_sets_first_password_and_logs_user_in(self):
        user = get_user_model().objects.create_user(username='nico', first_name='Nico')
        user.set_unusable_password()
        user.save(update_fields=['password'])
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        response = self.post_json(
            '/auth/activate/',
            {
                'uid': uid,
                'token': token,
                'password': 'A-new-secret-password-2026!',
                'password_confirm': 'A-new-secret-password-2026!',
            },
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('A-new-secret-password-2026!'))
        self.assertTrue(response.json()['authenticated'])

        reused = self.post_json(
            '/auth/activate/',
            {
                'uid': uid,
                'token': token,
                'password': 'Another-secret-password-2026!',
                'password_confirm': 'Another-secret-password-2026!',
            },
        )
        self.assertEqual(reused.status_code, 400)

    def test_activation_rejects_weak_passwords(self):
        user = get_user_model().objects.create_user(username='fabian')
        user.set_unusable_password()
        user.save(update_fields=['password'])

        response = self.post_json(
            '/auth/activate/',
            {
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': default_token_generator.make_token(user),
                'password': '123',
                'password_confirm': '123',
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('too short', response.json()['detail'])
