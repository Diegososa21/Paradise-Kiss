from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from .models import Category, Gender, InventorySale, Manufacturer, SalesData, resources
from .permissions import IsApprovedAppUser
from .serializers import (
    CategorySerializer,
    GenderSerializer,
    InventorySaleSerializer,
    ManufacturerSerializer,
    ResourceSerializer,
    SalesDataSerializer,
    SellResourceSerializer,
)


class ResourceViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = resources.objects.select_related("manufacturer", "category", "gender").order_by("-created_at")
    serializer_class = ResourceSerializer
    permission_classes = [IsApprovedAppUser]

    @action(detail=True, methods=['post'])
    def sell(self, request, pk=None):
        input_serializer = SellResourceSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        quantity = input_serializer.validated_data['quantity']

        with transaction.atomic():
            try:
                resource = (
                    resources.objects.select_for_update()
                    .select_related('category', 'manufacturer', 'gender')
                    .get(pk=pk)
                )
            except resources.DoesNotExist as error:
                raise NotFound('Der Artikel wurde nicht gefunden.') from error

            if quantity > resource.amount:
                raise ValidationError(
                    {
                        'quantity': (
                            f'Nur {resource.amount} Stück sind aktuell verfügbar.'
                        )
                    }
                )

            stock_before = resource.amount
            resource.amount -= quantity
            resource.save(update_fields=['amount'])
            sale = InventorySale.objects.create(
                resource=resource,
                resource_name=resource.name,
                category_name=resource.category.name,
                quantity=quantity,
                stock_before=stock_before,
                stock_after=resource.amount,
                sold_by=request.user,
            )

        return Response(
            {
                'resource': ResourceSerializer(resource).data,
                'sale': InventorySaleSerializer(sale).data,
            },
            status=status.HTTP_201_CREATED,
        )

class ManufacturerViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Manufacturer.objects.order_by("name")
    serializer_class = ManufacturerSerializer
    permission_classes = [IsApprovedAppUser]

class CategoryViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsApprovedAppUser]

class GenderViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Gender.objects.order_by("name")
    serializer_class = GenderSerializer
    permission_classes = [IsApprovedAppUser]


class SalesDataViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = SalesData.objects.select_related('category').order_by('year', 'quarter', 'category__name')
    serializer_class = SalesDataSerializer
    permission_classes = [IsApprovedAppUser]


class InventorySaleViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = InventorySale.objects.select_related('resource', 'sold_by').order_by('-sold_at')
    serializer_class = InventorySaleSerializer
    permission_classes = [IsApprovedAppUser]
