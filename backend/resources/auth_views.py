import json

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .permissions import is_approved_app_user


User = get_user_model()

AVATAR_URLS = {
    'sosa.diego': '/profiles/diego.jpeg',
    'friedrich.nico': '/profiles/nico.jpeg',
    'tebben.fabian': '/profiles/fabian.jpeg',
}


def _serialize_user(user):
    username = user.username.lower()
    display_name = user.get_full_name().strip() or user.username
    return {
        'id': user.pk,
        'username': username,
        'display_name': display_name,
        'email': user.email,
        'avatar_url': AVATAR_URLS.get(username, ''),
    }


def _json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({'csrf_token': get_token(request)})


@require_GET
def session(request):
    if is_approved_app_user(request.user):
        return JsonResponse({'authenticated': True, 'user': _serialize_user(request.user)})

    return JsonResponse({'authenticated': False, 'user': None})


@require_POST
def sign_in(request):
    payload = _json_body(request)
    if payload is None:
        return JsonResponse({'detail': 'Ungültige Anfrage.'}, status=400)

    username = str(payload.get('username', '')).strip().lower()
    password = str(payload.get('password', ''))
    if not username or not password:
        return JsonResponse({'detail': 'Benutzername oder Passwort ist falsch.'}, status=400)

    existing_user = User.objects.filter(username__iexact=username, is_active=True).first()
    user = authenticate(
        request,
        username=existing_user.username if existing_user else username,
        password=password,
    )
    if not is_approved_app_user(user):
        return JsonResponse({'detail': 'Benutzername oder Passwort ist falsch.'}, status=400)

    login(request, user)
    return JsonResponse({'authenticated': True, 'user': _serialize_user(user)})


@require_POST
def activate(request):
    payload = _json_body(request)
    if payload is None:
        return JsonResponse({'detail': 'Ungültige Anfrage.'}, status=400)

    uid = str(payload.get('uid', ''))
    token = str(payload.get('token', ''))
    password = str(payload.get('password', ''))
    confirmation = str(payload.get('password_confirm', ''))

    if password != confirmation:
        return JsonResponse({'detail': 'Die Passwörter stimmen nicht überein.'}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if (
        not is_approved_app_user(user)
        or user.has_usable_password()
        or not default_token_generator.check_token(user, token)
    ):
        return JsonResponse(
            {'detail': 'Der Aktivierungslink ist ungültig oder bereits verwendet.'},
            status=400,
        )

    try:
        password_validation.validate_password(password, user=user)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)

    user.set_password(password)
    user.save(update_fields=['password'])
    login(request, user)
    return JsonResponse({'authenticated': True, 'user': _serialize_user(user)})


@require_POST
def sign_out(request):
    logout(request)
    return JsonResponse({'authenticated': False, 'user': None})
