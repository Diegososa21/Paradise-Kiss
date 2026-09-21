"""Pure decision logic shared by the management command and tests."""
def pending_alerts(products, previously_notified):
    low = [p for p in products if not p.get('archived') and p['quantity'] < p['min_stock']]
    active_ids = {str(p['id']) for p in low}
    new = [p for p in low if str(p['id']) not in previously_notified]
    return new, active_ids
