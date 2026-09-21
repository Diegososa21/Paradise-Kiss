"""Input allowlists. Database functions must repeat all transactional rules."""
import math
import re
from .errors import InventoryError

MAX_QUANTITY = 1_000_000_000
TEXT_FIELDS = ['sku', 'name', 'description', 'size', 'material', 'gender', 'manufacturer', 'location_id']

def text(value, label, required=False, maximum=200):
    if not isinstance(value, str):
        raise InventoryError(f'{label}: Text erwartet.')
    value = value.strip()
    if len(value) > maximum or (required and not value):
        raise InventoryError(f'{label}: Pflichtfeld fehlt oder Text ist zu lang.')
    return value

def integer(value, label, minimum=0):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)) or value == '':
        raise InventoryError(f'{label}: Ungültige ganze Zahl.')
    try:
        parsed = float(value)
    except (ValueError, OverflowError):
        raise InventoryError(f'{label}: Ungültige ganze Zahl.')
    if not math.isfinite(parsed) or not parsed.is_integer() or not minimum <= parsed <= MAX_QUANTITY:
        raise InventoryError(f'{label}: Wert außerhalb des zulässigen Bereichs.')
    return int(parsed)

def price(value):
    try:
        parsed = float(value or 0)
    except (ValueError, TypeError, OverflowError):
        raise InventoryError('Ungültiger Preis.')
    if isinstance(value, bool) or not math.isfinite(parsed) or not 0 <= parsed <= MAX_QUANTITY:
        raise InventoryError('Ungültiger Preis.')
    return round(parsed, 2)

def identifier(value):
    value = text(value, 'ID', True)
    if not re.fullmatch(r'[\w-]+', value, flags=re.ASCII):
        raise InventoryError('Ungültige ID.')
    return value

def validate_command(action, payload):
    if not isinstance(payload, dict):
        raise InventoryError('Ein Datenobjekt wird erwartet.')
    result = {}
    if action in ('create_product', 'update_product'):
        for name in TEXT_FIELDS:
            result[name] = text(payload.get(name, ''), name, name not in ('description', 'location_id'), 5000 if name == 'description' else 200)
        result['min_stock'] = integer(payload.get('min_stock'), 'Mindestbestand')
        result['purchase_price'] = price(payload.get('purchase_price', 0))
        result['sale_price'] = price(payload.get('sale_price', 0))
        if action == 'create_product':
            result['quantity'] = integer(payload.get('quantity'), 'Anfangsbestand')
        else:
            result['id'] = identifier(payload.get('id'))
            # These may only change through book_movement.
            result.pop('location_id')
    elif action in ('create_location', 'update_location'):
        for name in ('name', 'shelf', 'bin'):
            result[name] = text(payload.get(name, ''), name, name != 'bin')
        result['capacity'] = integer(payload.get('capacity'), 'Kapazität')
        if action == 'update_location':
            result['id'] = identifier(payload.get('id'))
    elif action == 'book_movement':
        result['product_id'] = identifier(payload.get('product_id'))
        kind = payload.get('type')
        if kind not in ('inbound', 'sale', 'outbound', 'correction', 'transfer'):
            raise InventoryError('Ungültige Buchungsart.')
        result['type'] = kind
        result['quantity'] = integer(payload.get('quantity'), 'Menge', 0 if kind in ('correction', 'transfer') else 1)
        result['note'] = text(payload.get('note', ''), 'Grund', kind in ('correction', 'outbound', 'transfer'), 2000)
        result['reference'] = text(payload.get('reference', ''), 'Referenz')
        result['to_location_id'] = identifier(payload.get('to_location_id')) if kind == 'transfer' else ''
        result['order_id'] = identifier(payload['order_id']) if payload.get('order_id') else ''
    elif action == 'create_order':
        result['product_id'] = identifier(payload.get('product_id'))
        result['quantity'] = integer(payload.get('quantity'), 'Bestellmenge', 1)
        result['note'] = text(payload.get('note', ''), 'Notiz', maximum=2000)
        result['expected_date'] = text(payload.get('expected_date', ''), 'Lieferdatum')
        if result['expected_date']:
            from datetime import date
            try:
                date.fromisoformat(result['expected_date'])
            except ValueError:
                raise InventoryError('Ungültiges Lieferdatum.')
    elif action == 'cancel_order':
        result['id'] = identifier(payload.get('id'))
    elif action == 'archive_product':
        result['id'] = identifier(payload.get('id'))
        if not isinstance(payload.get('archived'), bool):
            raise InventoryError('Archivstatus muss true oder false sein.')
        result['archived'] = payload['archived']
    else:
        raise InventoryError('Unbekannte Aktion.')
    return result
