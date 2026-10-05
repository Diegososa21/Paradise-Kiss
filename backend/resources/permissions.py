from rest_framework.permissions import BasePermission


TEAM_GROUP_NAME = 'team'


def is_approved_app_user(user):
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.groups.filter(name=TEAM_GROUP_NAME).exists()
    )


class IsApprovedAppUser(BasePermission):
    """Allow only authenticated members of the three-person app team."""

    message = 'A valid Paradise Kiss team session is required.'

    def has_permission(self, request, view):
        return is_approved_app_user(request.user)
