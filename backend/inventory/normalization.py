"""Translate the mapped table output to one predictable frontend contract."""
from datetime import datetime
from .errors import InventoryError
from .validation import integer, price

def date_value(value, required=False):
    if not value and not required:
        return None
    try:
        datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (ValueError, TypeError):
        raise InventoryError('Ein Datum fehlt oder ist ungültig. Prüfe die Feldzuordnung.', 502)
    return str(value)

def normalize_snapshot(data):
    result = {'version': 1, 'products': [], 'locations': [], 'movements': [], 'orders': []}
    for collection in ('products', 'locations', 'movements', 'orders'):
        for row in data.get(collection, []):
            if not isinstance(row, dict) or row.get('id') is None:
                raise InventoryError('Eine Zeile hat keine ID.', 502)
            row = dict(row)
            for key in ('id', 'product_id', 'location_id', 'from_location_id', 'to_location_id'):
                if key in row:
                    row[key] = str(row[key]) if row[key] is not None else ''
            if collection == 'products':
                for key in ('sku', 'name', 'size', 'material', 'gender', 'manufacturer'):
                    if not row.get(key):
                        raise InventoryError(f'Artikelfeld {key} fehlt. Prüfe eure Feldzuordnung.', 502)
                for key in ('description', 'location_id'):
                    row[key] = str(row.get(key) or '')
                row['quantity'] = integer(row.get('quantity'), 'Bestand')
                row['min_stock'] = integer(row.get('min_stock', 0), 'Mindestbestand')
                for key in ('purchase_price', 'sale_price'):
                    row[key] = price(row.get(key, 0))
                row['archived'] = row.get('archived', False)
                if not isinstance(row['archived'], bool):
                    raise InventoryError('archived muss ein boolesches Feld sein.', 502)
                row['created_at'] = date_value(row.get('created_at'), True)
                row['updated_at'] = date_value(row.get('updated_at') or row['created_at'], True)
                for key in ('last_sale_at', 'last_purchase_at'):
                    row[key] = date_value(row.get(key))
            elif collection == 'locations':
                if not row.get('name') or not row.get('shelf'):
                    raise InventoryError('Name und Regal fehlen in der Lagerort-Zuordnung.', 502)
                row['bin'] = str(row.get('bin') or '')
                row['capacity'] = integer(row.get('capacity', 0), 'Kapazität')
            elif collection == 'movements':
                if row.get('type') not in ('initial', 'inbound', 'sale', 'outbound', 'correction', 'transfer') or not row.get('product_id'):
                    raise InventoryError('Ungültige Bewegungsart oder Artikel-ID.', 502)
                row['occurred_at'] = date_value(row.get('occurred_at'), True)
                row['quantity'] = integer(row.get('quantity'), 'Menge')
                row['stock_after'] = integer(row.get('stock_after'), 'Bestand danach')
                delta = row.get('delta')
                try:
                    parsed = float(delta)
                    if not parsed.is_integer() or abs(parsed) > 1_000_000_000:
                        raise ValueError()
                    row['delta'] = int(parsed)
                except (ValueError, TypeError, OverflowError):
                    raise InventoryError('Ungültige Bestandsänderung.', 502)
                for key in ('note', 'reference', 'from_location_id', 'to_location_id'):
                    row[key] = str(row.get(key) or '')
            else:
                if row.get('status') not in ('open', 'received', 'cancelled') or not row.get('product_id'):
                    raise InventoryError('Ungültiger Bestellstatus oder Artikel-ID.', 502)
                row['quantity'] = integer(row.get('quantity'), 'Bestellmenge', 1)
                row['created_at'] = date_value(row.get('created_at'), True)
                row['expected_date'] = date_value(row.get('expected_date')) or ''
                row['note'] = str(row.get('note') or '')
            result[collection].append(row)
    return result
