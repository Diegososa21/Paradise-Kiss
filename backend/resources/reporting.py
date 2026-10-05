"""Sales figures shared by the sales report, the dashboard and the AI assistant.

Two sources are combined:
- SalesData: historical quarterly figures per category (example data 2023-2026 Q3).
- InventorySale: every sale registered in the app, with the RT price of that moment.
"""

from collections import defaultdict
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import Avg, Count, DecimalField, F, Q, Sum
from django.db.models.functions import ExtractQuarter, ExtractYear

from .models import InventorySale, SalesData, resources

REPORT_TIMEZONE = ZoneInfo('Europe/Berlin')
CENT = Decimal('0.01')
ZERO = Decimal('0')


def _registered_sales_by(*fields):
    """Registered sales grouped by year/quarter (German time) and the given fields."""
    return (
        InventorySale.objects.order_by()
        .annotate(
            year=ExtractYear('sold_at', tzinfo=REPORT_TIMEZONE),
            quarter=ExtractQuarter('sold_at', tzinfo=REPORT_TIMEZONE),
        )
        .values(*fields)
        .annotate(
            units=Sum('quantity'),
            revenue=Sum(
                F('quantity') * F('unit_price'),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
    )


def quarterly_sales():
    """Units and revenue per (year, quarter), oldest first, with the data sources used."""
    quarters = {}

    def bucket(year, quarter):
        return quarters.setdefault(
            (year, quarter),
            {'year': year, 'quarter': quarter, 'units': 0, 'revenue': ZERO, 'sources': set()},
        )

    historical = (
        SalesData.objects.order_by()
        .values('year', 'quarter')
        .annotate(units=Sum('units_sold'), revenue=Sum('revenue'))
    )
    for row in historical:
        period = bucket(row['year'], row['quarter'])
        period['units'] += row['units'] or 0
        period['revenue'] += row['revenue'] or ZERO
        period['sources'].add('historical')

    for row in _registered_sales_by('year', 'quarter'):
        period = bucket(row['year'], row['quarter'])
        period['units'] += row['units'] or 0
        period['revenue'] += row['revenue'] or ZERO
        period['sources'].add('live')

    return [quarters[key] for key in sorted(quarters)]


def yearly_sales(quarters):
    years = {}
    for period in quarters:
        year = years.setdefault(
            period['year'],
            {'year': period['year'], 'units': 0, 'revenue': ZERO, 'sources': set()},
        )
        year['units'] += period['units']
        year['revenue'] += period['revenue']
        year['sources'] |= period['sources']
    return list(years.values())


def category_sales_by_year():
    """{year: {category: {'units', 'revenue'}}} from history and registered sales."""
    result = defaultdict(lambda: defaultdict(lambda: {'units': 0, 'revenue': ZERO}))
    historical = (
        SalesData.objects.order_by()
        .values('year', 'category__name')
        .annotate(units=Sum('units_sold'), revenue=Sum('revenue'))
    )
    for row in historical:
        entry = result[row['year']][row['category__name']]
        entry['units'] += row['units'] or 0
        entry['revenue'] += row['revenue'] or ZERO
    for row in _registered_sales_by('year', 'category_name'):
        entry = result[row['year']][row['category_name']]
        entry['units'] += row['units'] or 0
        entry['revenue'] += row['revenue'] or ZERO
    return result


def complete_historical_years():
    """Years whose four quarters are all present in the historical data."""
    quarters_per_year = (
        SalesData.objects.order_by()
        .values('year')
        .annotate(quarters=Count('quarter', distinct=True))
    )
    return sorted(row['year'] for row in quarters_per_year if row['quarters'] == 4)


def registered_product_sales():
    """Units and revenue per product for the sales registered in the app."""
    return list(
        InventorySale.objects.order_by()
        .values('resource_name', 'category_name')
        .annotate(
            units=Sum('quantity'),
            revenue=Sum(
                F('quantity') * F('unit_price'),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        .order_by('-units', 'resource_name')
    )


def stock_by_category():
    return {
        row['category__name']: row
        for row in resources.objects.order_by()
        .values('category__name')
        .annotate(
            stock=Sum('amount'),
            products=Count('id'),
            low_stock_products=Count('id', filter=Q(amount__lte=F('reorder_threshold'))),
            avg_wholesale=Avg('wholesale_price'),
            avg_retail=Avg('retail_price'),
        )
    }


def low_stock_products():
    return list(
        resources.objects.filter(amount__lte=F('reorder_threshold'))
        .select_related('category')
        .order_by('amount', 'name')
        .values('name', 'category__name', 'amount', 'reorder_threshold')
    )
