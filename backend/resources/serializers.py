from rest_framework import serializers
from .models import Category, Gender, InventorySale, Manufacturer, SalesData, resources



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
