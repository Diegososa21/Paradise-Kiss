import logging
from collections.abc import Mapping

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.utils import timezone


logger = logging.getLogger(__name__)

EVENT_LABELS = {
    'create': 'Artikel angelegt',
    'sale': 'Verkauf gebucht',
    'restock': 'Nachbestellung gebucht',
    'update': 'Artikel aktualisiert',
    'delete': 'Artikel gelöscht',
}


def team_recipient_emails() -> list[str]:
    return list(
        get_user_model()
        .objects.filter(is_active=True, groups__name='team')
        .exclude(email='')
        .order_by('email')
        .values_list('email', flat=True)
        .distinct()
    )


def schedule_inventory_notification(
    *,
    event: str,
    resource_name: str,
    actor,
    details: Mapping[str, object],
) -> None:
    if not settings.INVENTORY_EMAIL_NOTIFICATIONS_ENABLED:
        return

    event_label = EVENT_LABELS[event]
    actor_name = actor.get_full_name().strip() or actor.username
    detail_lines = tuple(f'{label}: {value}' for label, value in details.items())

    transaction.on_commit(
        lambda: _send_inventory_notification(
            event_label=event_label,
            resource_name=resource_name,
            actor_name=actor_name,
            detail_lines=detail_lines,
        )
    )


def _send_inventory_notification(
    *,
    event_label: str,
    resource_name: str,
    actor_name: str,
    detail_lines: tuple[str, ...],
) -> None:
    recipients = team_recipient_emails()
    if not recipients:
        logger.warning('Inventory email skipped because the team has no active email recipients.')
        return

    occurred_at = timezone.localtime().strftime('%d.%m.%Y %H:%M %Z')
    body = '\n'.join(
        (
            'Hallo,',
            '',
            'im Paradise-Kiss-Lagersystem wurde eine Änderung registriert.',
            '',
            f'Aktion: {event_label}',
            f'Artikel: {resource_name}',
            f'Ausgeführt von: {actor_name}',
            f'Zeitpunkt: {occurred_at}',
            *detail_lines,
            '',
            'Diese Nachricht wurde automatisch vom Paradise-Kiss-Lagersystem versendet.',
        )
    )
    subject = f'{settings.INVENTORY_EMAIL_SUBJECT_PREFIX} {event_label}: {resource_name}'

    try:
        connection = get_connection(fail_silently=True)
        messages = [
            EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
                connection=connection,
            )
            for recipient in recipients
        ]
        sent_count = connection.send_messages(messages)
        if sent_count != len(messages):
            logger.warning(
                'Only %s of %s inventory notification emails were accepted by the backend.',
                sent_count,
                len(messages),
            )
    except Exception:
        logger.exception('Inventory notification email delivery failed.')
