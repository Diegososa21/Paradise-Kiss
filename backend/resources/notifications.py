from django.contrib.auth import get_user_model
from django.core.mail import send_mass_mail


def mail_group(group_name, subject, message, exclude_user=None):
    User = get_user_model()
    users = User.objects.filter(
        is_active=True, groups__name=group_name
    ).exclude(email="").distinct()
    if exclude_user is not None:
        users = users.exclude(pk=exclude_user.pk)

    addresses = list(users.values_list("email", flat=True))
    if addresses:
        send_mass_mail([(subject, message, None, [a]) for a in addresses])