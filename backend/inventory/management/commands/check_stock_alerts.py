"""Run from an existing scheduler after connecting a real data source.

Default: dry run. --send explicitly opts into SMTP; no schedule is created.
"""
import json
import os
from pathlib import Path
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from inventory.alerts import pending_alerts
from inventory.errors import InventoryError
from inventory.repository import get_source, SupabaseRepository

class Command(BaseCommand):
    help = 'Prüft Mindestbestände. Ohne --send werden keine E-Mails oder Statusdateien geschrieben.'

    def add_arguments(self, parser):
        parser.add_argument('--source', required=True)
        parser.add_argument('--state', required=True, help='Eigene JSON-Statusdatei für diese Datenquelle.')
        parser.add_argument('--send', action='store_true')

    def handle(self, *args, **options):
        path = Path(options['state']).resolve()
        lock = path.with_suffix(path.suffix + '.lock')
        lock_handle = None
        try:
            if options['send']:
                if not settings.EMAIL_HOST or not settings.DEFAULT_FROM_EMAIL or not settings.INVENTORY_ALERT_RECIPIENTS:
                    raise CommandError('SMTP, Absender und Empfänger müssen konfiguriert sein.')
                if not path.parent.exists():
                    raise CommandError('Der Ordner für die Statusdatei existiert nicht.')
                try:
                    lock_handle = lock.open('x')
                except FileExistsError:
                    raise CommandError('Ein anderer Benachrichtigungslauf ist aktiv. Bei einem Absturz die Sperre manuell prüfen.')
            previous = set()
            if path.exists():
                state = json.loads(path.read_text(encoding='utf-8'))
                if state.get('source') != options['source'] or not isinstance(state.get('notified'), list):
                    raise CommandError('Die Statusdatei gehört nicht zu dieser Quelle oder ist ungültig.')
                previous = set(state['notified'])
            repo = SupabaseRepository(get_source(options['source']))
            token = os.getenv('INVENTORY_ALERT_TOKEN', '')
            if not token:
                email = os.getenv('INVENTORY_ALERT_EMAIL', '')
                password = os.getenv('INVENTORY_ALERT_PASSWORD', '')
                if not email or not password:
                    raise CommandError('Ein leseberechtigtes Benachrichtigungskonto oder ein aktuelles Token ist erforderlich.')
                token = repo.login(email, password)['access_token']
            repo.token = token
            data = repo.snapshot()
            pending, low_ids = pending_alerts(data['products'], previous)
            if not options['send']:
                self.stdout.write(f'Vorschau: {len(low_ids)} Artikel unter Mindestbestand, {len(pending)} neu. Kein Versand.')
                return
            if pending:
                lines = [f"{p['name']} ({p['sku']}, {p['size']}): {p['quantity']} Stück, Minimum {p['min_stock']}" for p in pending]
                sent = send_mail('Paradise Kiss · Mindestbestand unterschritten', '\n'.join(lines), settings.DEFAULT_FROM_EMAIL, settings.INVENTORY_ALERT_RECIPIENTS, fail_silently=False)
                if sent != 1:
                    raise CommandError('SMTP hat die Nachricht nicht angenommen. Status bleibt unverändert.')
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_text(json.dumps({'source': options['source'], 'notified': sorted(low_ids)}, ensure_ascii=False), encoding='utf-8')
            temporary.replace(path)
            self.stdout.write(f'Prüfung abgeschlossen: {len(pending)} neue Hinweise, {len(low_ids)} Artikel unter Mindestbestand.')
        except (InventoryError, OSError, ValueError) as error:
            raise CommandError(str(error))
        finally:
            if lock_handle:
                lock_handle.close()
                lock.unlink(missing_ok=True)
