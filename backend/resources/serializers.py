from rest_framework import serializers
from .models import resources, Manufacturer, Gender, Category



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
