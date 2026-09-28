from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.management.base import BaseCommand, CommandError
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class Command(BaseCommand):
    help = 'Create one-time password activation links for approved app users.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            action='append',
            dest='usernames',
            help='Generate a link for one approved username. May be repeated.',
        )

    def handle(self, *args, **options):
        requested = options['usernames'] or sorted(settings.APP_ALLOWED_USERNAMES)
        requested = [username.strip().lower() for username in requested]
        invalid = set(requested) - settings.APP_ALLOWED_USERNAMES
        if invalid:
            raise CommandError(f'Not an approved app user: {", ".join(sorted(invalid))}')

        User = get_user_model()
        for username in requested:
            try:
                user = User.objects.get(username__iexact=username, is_active=True)
            except User.DoesNotExist as error:
                raise CommandError(f'User does not exist: {username}') from error

            if user.has_usable_password():
                self.stdout.write(self.style.WARNING(f'{username}: already activated'))
                continue

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f'{settings.FRONTEND_URL}/?activate_uid={uid}&activate_token={token}'
            self.stdout.write(f'{username}: {link}')
