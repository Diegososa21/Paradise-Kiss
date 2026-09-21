"""Supabase REST adapter; reads EXISTING tables and calls an EXISTING RPC.

No ORM, no SQL execution, no schema creation and no privileged service-role key.
Field mappings are only read from a server-side, git-ignored configuration file.
"""
import json
import base64
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from django.conf import settings
from .errors import InventoryError
from .normalization import normalize_snapshot

COLLECTIONS = ('products', 'locations', 'movements', 'orders')
FIELDS = {
    'products': ['id', 'sku', 'name', 'description', 'size', 'material', 'gender', 'manufacturer', 'quantity', 'min_stock', 'location_id', 'purchase_price', 'sale_price', 'archived', 'created_at', 'updated_at', 'last_sale_at', 'last_purchase_at'],
    'locations': ['id', 'name', 'shelf', 'bin', 'capacity'],
    'movements': ['id', 'product_id', 'type', 'quantity', 'delta', 'stock_after', 'occurred_at', 'note', 'reference', 'from_location_id', 'to_location_id'],
    'orders': ['id', 'product_id', 'quantity', 'expected_date', 'status', 'created_at', 'note'],
}

def sql_name(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_]*', value):
        raise InventoryError('Ungültiger Tabellen-, Spalten- oder Funktionsname in der Serverkonfiguration.', 503)
    return value

def load_sources():
    path = settings.DATA_SOURCES_FILE
    if not path.exists():
        return []
    try:
        sources = json.loads(path.read_text(encoding='utf-8'))['sources']
        if not isinstance(sources, list):
            raise ValueError()
        ids = set()
        for source in sources:
            source_id = source['id']
            if not re.fullmatch(r'[a-zA-Z0-9_-]+', source_id) or source_id == 'local' or source_id in ids:
                raise ValueError()
            ids.add(source_id)
            if not all(isinstance(source.get(k), str) and source[k] for k in ('label', 'url_env', 'key_env')):
                raise ValueError()
        return sources
    except (ValueError, KeyError, TypeError, OSError):
        raise InventoryError('Die Datenquellen-Konfiguration ist ungültig.', 503)

def get_source(source_id):
    for source in load_sources():
        if source['id'] == source_id:
            return source
    raise InventoryError('Diese Datenquelle ist nicht konfiguriert.', 404)

class SupabaseRepository:
    def __init__(self, source, token=''):
        self.source = source
        self.token = token
        self.base_url = os.getenv(source['url_env'], '').rstrip('/')
        self.key = os.getenv(source['key_env'], '')
        parsed = urlparse(self.base_url)
        local = parsed.hostname in ('localhost', '127.0.0.1') and settings.DEBUG
        if not self.key or not parsed.hostname or (parsed.scheme != 'https' and not local) or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
            raise InventoryError('URL oder Publishable Key der Datenquelle fehlen oder sind ungültig.', 503)
        if self.key.startswith('sb_secret_'):
            raise InventoryError('Verwende einen Publishable Key, keinen Secret Key.', 503)
        if self.key.count('.') == 2:
            # Reject legacy privileged keys as well. Authorization itself is
            # always verified upstream by Supabase, never by this decoding.
            try:
                part = self.key.split('.')[1]
                claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
            except (ValueError, TypeError):
                raise InventoryError('Ungültiger Publishable/Anon-Key.', 503)
            if not isinstance(claims, dict) or claims.get('role') != 'anon':
                raise InventoryError('Verwende einen Publishable/Anon-Key ohne privilegierte Rolle.', 503)

    def request(self, path, method='GET', payload=None, extra_headers=None):
        headers = {'apikey': self.key, 'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        if extra_headers:
            headers.update(extra_headers)
        body = json.dumps(payload, allow_nan=False).encode('utf-8') if payload is not None else None
        request = Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=15) as response:
                result = json.loads(response.read(25 * 1024 * 1024))
                return result, response.headers
        except HTTPError as error:
            # Do not disclose database schemas, SQL details or tokens to browsers.
            status = error.code
            message = {
                400: 'Anfrage abgelehnt. Prüfe Feldzuordnung und Datenbankregeln.',
                401: 'Bitte erneut an der Datenquelle anmelden.',
                403: 'Keine Berechtigung für diese Daten in der gewählten Quelle.',
                404: 'Tabelle oder Buchungsfunktion nicht gefunden. Prüfe die Anbindung.',
                409: 'Konflikt mit dem aktuellen Datenbestand. Bitte neu laden.',
                422: 'Die Datenbank hat diese Buchung abgelehnt.',
                429: 'Zu viele Anfragen. Bitte später erneut versuchen.',
            }.get(status, 'Die Datenquelle ist momentan nicht verfügbar.')
            raise InventoryError(message, status if status in (400, 401, 403, 404, 409, 422, 429) else 502)
        except (URLError, TimeoutError, ValueError, OSError):
            raise InventoryError('Die Datenquelle hat nicht rechtzeitig oder nicht gültig geantwortet.', 502)

    def login(self, email, password):
        result, _ = self.request('/auth/v1/token?grant_type=password', 'POST', {'email': email, 'password': password})
        if not result.get('access_token'):
            raise InventoryError('Anmeldung fehlgeschlagen.', 401)
        # No refresh token is stored or returned by this starter.
        return {'access_token': result['access_token'], 'expires_in': result.get('expires_in', 3600)}

    def require_token(self):
        if not self.token:
            raise InventoryError('Bitte an der Datenquelle anmelden.', 401)

    def rows(self, collection):
        mapping = self.source.get('entities', {}).get(collection)
        if not mapping:
            return []
        table = sql_name(mapping['table'])
        fields = mapping.get('fields', {})
        if 'id' not in fields or any(key not in FIELDS[collection] for key in fields):
            raise InventoryError('Unvollständige oder ungültige Feldzuordnung.', 503)
        select = ','.join(f'{sql_name(alias)}:{sql_name(column)}' for alias, column in fields.items())
        schema = sql_name(mapping.get('schema', 'public'))
        result, offset = [], 0
        while True:
            query = urlencode({'select': select, 'order': sql_name(fields['id']) + '.asc', 'offset': offset, 'limit': 500})
            page, headers = self.request(f'/rest/v1/{table}?{query}', extra_headers={'Accept-Profile': schema, 'Prefer': 'count=exact'})
            if not isinstance(page, list):
                raise InventoryError('Eine Tabelle hat ein ungültiges Format geliefert.', 502)
            result.extend(page)
            offset += len(page)
            if offset > 100000:
                raise InventoryError('Die Quelle ist zu groß für den Starter. Serverseitige Filter und Aggregationen ergänzen.', 422)
            count = headers.get('Content-Range', '').split('/')[-1]
            # Never silently report incomplete totals if the server caps rows.
            if not count.isdigit():
                raise InventoryError('Die Datenquelle liefert keine exakte Zeilenzahl. Prüfe Content-Range und count=exact.', 502)
            if offset >= int(count):
                break
            if not page:
                raise InventoryError('Die Datenquelle hat eine unvollständige Seite geliefert.', 502)
        return result

    def snapshot(self):
        self.require_token()
        snapshot_rpc = self.source.get('snapshot_rpc')
        if snapshot_rpc:
            result, _ = self.request('/rest/v1/rpc/' + sql_name(snapshot_rpc), 'POST', {})
            if not isinstance(result, dict) or result.get('version') != 1 or any(not isinstance(result.get(key), list) for key in COLLECTIONS):
                raise InventoryError('Die Snapshot-Funktion erfüllt den Datenvertrag nicht.', 502)
            return normalize_snapshot(result)
        return normalize_snapshot({'version': 1, **{name: self.rows(name) for name in COLLECTIONS}})

    def command(self, action, payload):
        self.require_token()
        rpc = self.source.get('command_rpc')
        if not rpc:
            raise InventoryError('Diese Quelle ist nur lesbar. Eine transaktionale Buchungsfunktion ist noch nicht zugeordnet.', 409)
        # One RPC transaction handles validation + stock + movement + order.
        result, _ = self.request('/rest/v1/rpc/' + sql_name(rpc), 'POST', {'action': action, 'payload': payload})
        if not isinstance(result, dict):
            raise InventoryError('Die Buchungsfunktion liefert kein Ergebnisobjekt.', 502)
        if action in ('create_product', 'update_product') and not result.get('id'):
            raise InventoryError('Die Buchung liefert keine Artikel-ID. Bitte vor erneutem Speichern den Bestand prüfen.', 502)
        return result
