from django.contrib import admin

from .models import (
    Category,
    Gender,
    InventorySale,
    Manufacturer,
    SalesData,
    StockMovement,
    resources,
)


@admin.register(resources)
class ResourceAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'amount',
        'reorder_threshold',
        'shelf_number',
        'bin_number',
        'purchase_date',
    )
    list_filter = ('category', 'manufacturer', 'gender')
    search_fields = ('name', 'shelf_number', 'bin_number')


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        'resource_name',
        'movement_type',
        'quantity',
        'stock_before',
        'stock_after',
        'performed_by',
        'occurred_at',
    )
    list_filter = ('movement_type', 'occurred_at')
    search_fields = ('resource_name', 'performed_by__username')
    readonly_fields = (
        'resource',
        'resource_name',
        'movement_type',
        'quantity',
        'stock_before',
        'stock_after',
        'purchase_date',
        'performed_by',
        'occurred_at',
    )


admin.site.register(Category)
admin.site.register(Gender)
admin.site.register(Manufacturer)
admin.site.register(InventorySale)
admin.site.register(SalesData)
