from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from resources.models import resources


PLACEHOLDER_VALUES = {
    'ASK_PROJECT_OWNER_FOR_SHARED_SECRET',
    'ASK_PROJECT_OWNER_FOR_DATABASE_PASSWORD',
    'replace-with-a-long-random-value',
}


class Command(BaseCommand):
    help = 'Verify that this laptop uses the shared Paradise Kiss database.'

    def handle(self, *args, **options):
        database = settings.DATABASES['default']
        configured_values = {
            settings.SECRET_KEY,
            database.get('PASSWORD', ''),
        }
        placeholders = configured_values & PLACEHOLDER_VALUES
        if placeholders:
            raise CommandError(
                'backend/.env still contains placeholder secrets. Ask the '
                'project owner for DJANGO_SECRET_KEY and DB_PASSWORD.'
            )

        try:
            connection.ensure_connection()
            product_count = resources.objects.count()
            users = get_user_model().objects.filter(
                username__in=settings.APP_ALLOWED_USERNAMES,
            )
        except Exception as error:
            raise CommandError(
                'The shared Supabase database is not reachable. Check the '
                'DB_* values in backend/.env.'
            ) from error

        user_statuses = []
        for user in users.order_by('username'):
            status = 'ready' if user.has_usable_password() else 'pending activation'
            user_statuses.append(f'{user.username}={status}')

        missing_users = settings.APP_ALLOWED_USERNAMES - {
            user.username.lower() for user in users
        }
        if missing_users:
            raise CommandError(
                f'Missing approved users: {", ".join(sorted(missing_users))}'
            )

        self.stdout.write(self.style.SUCCESS('Shared Supabase connection: OK'))
        self.stdout.write(f'Products visible: {product_count}')
        self.stdout.write(f'Team users: {", ".join(user_statuses)}')
