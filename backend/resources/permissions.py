from django.conf import settings
from rest_framework.permissions import BasePermission


class IsApprovedAppUser(BasePermission):
    """Allow only authenticated members of the three-person app team."""

    message = 'A valid Paradise Kiss team session is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.username.lower() in settings.APP_ALLOWED_USERNAMES
        )
