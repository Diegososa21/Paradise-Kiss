from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.management.base import BaseCommand, CommandError
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from resources.permissions import TEAM_GROUP_NAME


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
        User = get_user_model()
        team_users = {
            user.username.lower(): user
            for user in User.objects.filter(
                is_active=True,
                groups__name=TEAM_GROUP_NAME,
            ).distinct()
        }
        requested = options['usernames'] or sorted(team_users)
        requested = [username.strip().lower() for username in requested]
        invalid = set(requested) - set(team_users)
        if invalid:
            raise CommandError(f'Not an approved app user: {", ".join(sorted(invalid))}')

        for username in requested:
            user = team_users[username]

            if user.has_usable_password():
                self.stdout.write(self.style.WARNING(f'{username}: already activated'))
                continue

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f'{settings.FRONTEND_URL}/?activate_uid={uid}&activate_token={token}'
            self.stdout.write(f'{username}: {link}')
