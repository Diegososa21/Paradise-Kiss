from rest_framework import serializers
from .models import (
    Category,
    Gender,
    InventorySale,
    Manufacturer,
    SalesData,
    StockMovement,
    resources,
)



class ResourceSerializer(serializers.ModelSerializer):
    amount = serializers.IntegerField(min_value=0)
    manufacturer_name = serializers.CharField(source='manufacturer.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    gender_name = serializers.CharField(source='gender.name', read_only=True)

    class Meta:
        model = resources
        fields = [
            'id',
            'name',
            'amount',
            'desc',
            'size',
            'material',
            'created_at',
            'category',
            'category_name',
            'manufacturer',
            'manufacturer_name',
            'gender',
            'gender_name',
            'shelf_number',
            'bin_number',
            'reorder_threshold',
            'purchase_date',
        ]

class ManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manufacturer
        fields = [
            'id',
            'name',
            'location',
        ]

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            'id',
            'name',
        ]

class GenderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gender
        fields = [
            'id',
            'name',
        ]


class SalesDataSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = SalesData
        fields = [
            'id',
            'year',
            'quarter',
            'category',
            'category_name',
            'units_sold',
            'revenue',
        ]


class SellResourceSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


class RestockResourceSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
    purchase_date = serializers.DateField(required=False)
    shelf_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    bin_number = serializers.CharField(max_length=30, required=False, allow_blank=True)


class InventorySettingsSerializer(serializers.Serializer):
    shelf_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    bin_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    reorder_threshold = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                'Mindestens eine Lagereinstellung muss angegeben werden.'
            )
        return attrs


class InventorySaleSerializer(serializers.ModelSerializer):
    sold_by_username = serializers.SerializerMethodField()

    def get_sold_by_username(self, obj):
        return obj.sold_by.username if obj.sold_by else 'Unbekannt'

    class Meta:
        model = InventorySale
        fields = [
            'id',
            'resource',
            'resource_name',
            'category_name',
            'quantity',
            'stock_before',
            'stock_after',
            'sold_by',
            'sold_by_username',
            'sold_at',
        ]
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.SerializerMethodField()
    movement_type_label = serializers.CharField(source='get_movement_type_display', read_only=True)

    def get_performed_by_username(self, obj):
        return obj.performed_by.username if obj.performed_by else 'Unbekannt'

    class Meta:
        model = StockMovement
        fields = [
            'id',
            'resource',
            'resource_name',
            'movement_type',
            'movement_type_label',
            'quantity',
            'stock_before',
            'stock_after',
            'purchase_date',
            'performed_by',
            'performed_by_username',
            'occurred_at',
        ]
        read_only_fields = fields
