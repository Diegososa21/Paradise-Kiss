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



PRICE_FIELD = {'max_digits': 10, 'decimal_places': 2, 'min_value': 0}


class ResourceSerializer(serializers.ModelSerializer):
    amount = serializers.IntegerField(min_value=0)
    wholesale_price = serializers.DecimalField(**PRICE_FIELD)
    retail_price = serializers.DecimalField(**PRICE_FIELD)
    manufacturer_name = serializers.CharField(source='manufacturer.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    gender_name = serializers.CharField(source='gender.name', read_only=True)

    class Meta:
        model = resources
        fields = [
            'id',
            'gtin',
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
            'wholesale_price',
            'retail_price',
        ]
        read_only_fields = ['gtin']


class ResourceDetailsSerializer(serializers.ModelSerializer):
    """Descriptive product data. Stock, prices and location have their own endpoints."""

    class Meta:
        model = resources
        fields = [
            'name',
            'desc',
            'size',
            'material',
            'category',
            'manufacturer',
            'gender',
        ]

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                'Mindestens ein Produktdetail muss angegeben werden.'
            )
        return attrs


class AssistantTurnSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user', 'assistant'])
    text = serializers.CharField(max_length=4000)


class AssistantQuestionSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500)
    history = AssistantTurnSerializer(many=True, required=False, default=list)

    def validate_history(self, value):
        # Only the last turns are sent along, enough for follow-up questions.
        return value[-10:]


class UniqueNameMixin:
    """Reject names that only differ in upper/lower case from an existing entry."""

    duplicate_message = 'Dieser Name existiert bereits.'

    def validate_name(self, value):
        queryset = self.Meta.model.objects.filter(name__iexact=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(self.duplicate_message.format(name=value))
        return value


class ManufacturerSerializer(UniqueNameMixin, serializers.ModelSerializer):
    duplicate_message = 'Der Lieferant „{name}“ existiert bereits.'

    class Meta:
        model = Manufacturer
        fields = [
            'id',
            'name',
            'location',
        ]
        extra_kwargs = {'name': {'validators': []}}


class CategorySerializer(UniqueNameMixin, serializers.ModelSerializer):
    duplicate_message = 'Die Kategorie „{name}“ existiert bereits.'

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
        ]
        extra_kwargs = {'name': {'validators': []}}


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
    wholesale_price = serializers.DecimalField(**PRICE_FIELD, required=False)
    retail_price = serializers.DecimalField(**PRICE_FIELD, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                'Mindestens eine Lagereinstellung muss angegeben werden.'
            )
        return attrs


class InventorySaleSerializer(serializers.ModelSerializer):
    sold_by_username = serializers.SerializerMethodField()
    revenue = serializers.SerializerMethodField()

    def get_sold_by_username(self, obj):
        return obj.sold_by.username if obj.sold_by else 'Unbekannt'

    def get_revenue(self, obj):
        if obj.unit_price is None:
            return None
        return f'{obj.unit_price * obj.quantity:.2f}'

    class Meta:
        model = InventorySale
        fields = [
            'id',
            'resource',
            'resource_name',
            'category_name',
            'quantity',
            'unit_price',
            'revenue',
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
