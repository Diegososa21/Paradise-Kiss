import json
from functools import wraps
from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .errors import InventoryError
from .repository import load_sources, get_source, SupabaseRepository
from .validation import validate_command, text

def endpoint(method):
    """These JSON endpoints authenticate with Bearer tokens, never cookies."""
    def decorate(view):
        @csrf_exempt
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method != method:
                response = JsonResponse({'error': 'HTTP-Methode nicht erlaubt.'}, status=405)
                response['Allow'] = method
                return response
            try:
                if method == 'POST':
                    if request.content_type != 'application/json':
                        raise InventoryError('Content-Type application/json ist erforderlich.', 415)
                    # Same-origin browser requests only. Non-browser Bearer clients may omit Origin.
                    origin = request.headers.get('Origin')
                    if origin and origin != request.build_absolute_uri('/').rstrip('/'):
                        raise InventoryError('Diese Herkunft ist nicht erlaubt.', 403)
                return JsonResponse(view(request, *args, **kwargs), json_dumps_params={'ensure_ascii': False, 'allow_nan': False})
            except InventoryError as error:
                return JsonResponse({'error': str(error)}, status=error.status)
            except (ValueError, TypeError, KeyError):
                return JsonResponse({'error': 'Ungültige Daten oder unvollständige Feldzuordnung.'}, status=400)
        return wrapped
    return decorate

def body(request):
    try:
        value = json.loads(request.body, parse_constant=lambda _: None)
    except (ValueError, UnicodeDecodeError):
        raise InventoryError('Ungültiges JSON.')
    if not isinstance(value, dict):
        raise InventoryError('Ein JSON-Objekt wird erwartet.')
    return value

def repo(request):
    source = get_source(request.GET.get('source', ''))
    auth = request.headers.get('Authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else ''
    return SupabaseRepository(source, token)

@endpoint('GET')
def status(request):
    return {'status': 'ready', 'database_created': False, 'email_ready': bool(settings.EMAIL_HOST and settings.DEFAULT_FROM_EMAIL and settings.INVENTORY_ALERT_RECIPIENTS)}

@endpoint('GET')
def sources(request):
    return {'sources': [{'id': s['id'], 'label': s['label'], 'writable': bool(s.get('command_rpc'))} for s in load_sources()]}

@endpoint('POST')
def login(request):
    data = body(request)
    password = data.get('password')
    if not isinstance(password, str) or not password or len(password) > 1024:
        raise InventoryError('Ein gültiges Passwort ist erforderlich.')
    return repo(request).login(text(data.get('email'), 'E-Mail', True), password)

@endpoint('GET')
def snapshot(request):
    return repo(request).snapshot()

@endpoint('POST')
def command(request):
    data = body(request)
    action = data.get('action')
    payload = validate_command(action, data.get('payload'))
    return repo(request).command(action, payload)

def frontend(request):
    return FileResponse((settings.FRONTEND_DIR / 'index.html').open('rb'), content_type='text/html; charset=utf-8')

def frontend_asset(request, path):
    root = settings.FRONTEND_DIR.resolve()
    asset = (root / path).resolve()
    if not asset.is_relative_to(root) or not asset.is_file():
        raise Http404()
    types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png'}
    if asset.suffix not in types:
        raise Http404()
    return FileResponse(asset.open('rb'), content_type=types[asset.suffix])
