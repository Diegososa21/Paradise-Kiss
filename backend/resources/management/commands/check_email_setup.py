from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError

from resources.notifications import registered_recipient_emails


class Command(BaseCommand):
    help = 'Show the inventory email recipients and optionally send them a test email.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--send',
            action='store_true',
            help='Send a test email to every registered recipient.',
        )

    def handle(self, *args, **options):
        recipients = registered_recipient_emails()
        self.stdout.write(f'Email backend: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'SMTP host: {settings.EMAIL_HOST or "—"}')
        self.stdout.write(f'Sender: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(
            f'Notifications enabled: {settings.INVENTORY_EMAIL_NOTIFICATIONS_ENABLED}'
        )
        if not recipients:
            raise CommandError('No active user has a registered email.')
        self.stdout.write(f'Recipients: {", ".join(recipients)}')

        if not options['send']:
            return

        for recipient in recipients:
            try:
                send_mail(
                    f'{settings.INVENTORY_EMAIL_SUBJECT_PREFIX} Testnachricht',
                    'Die E-Mail-Benachrichtigungen des Paradise-Kiss-Lagersystems funktionieren.',
                    settings.DEFAULT_FROM_EMAIL,
                    [recipient],
                )
            except Exception as error:
                raise CommandError(f'Sending to {recipient} failed: {error}') from error
            self.stdout.write(self.style.SUCCESS(f'Test email sent to {recipient}'))
