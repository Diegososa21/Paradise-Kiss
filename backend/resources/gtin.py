"""Global Trade Item Numbers (GTIN-13) for Paradise Kiss products.

GS1 reserves the prefixes 20-29 for numbers that are only used inside one
company ("restricted circulation"), so internal product numbers never collide
with real EAN barcodes of other brands.
"""

GTIN_PREFIX = '20'
GTIN_LENGTH = 13


def gtin_check_digit(body: str) -> str:
    """Return the GS1 check digit for the 12 leading digits of a GTIN-13."""
    total = sum(
        int(digit) * (3 if position % 2 == 0 else 1)
        for position, digit in enumerate(reversed(body))
    )
    return str((10 - total % 10) % 10)


def build_gtin(product_id: int) -> str:
    body = f'{GTIN_PREFIX}{product_id:0{GTIN_LENGTH - len(GTIN_PREFIX) - 1}d}'
    if len(body) != GTIN_LENGTH - 1:
        raise ValueError(f'Product id {product_id} is too large for a GTIN-13.')
    return body + gtin_check_digit(body)


def is_valid_gtin(value: str) -> bool:
    return (
        len(value) == GTIN_LENGTH
        and value.isdigit()
        and gtin_check_digit(value[:-1]) == value[-1]
    )
