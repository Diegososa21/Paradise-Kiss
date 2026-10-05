from rest_framework import mixins, viewsets
from .models import Category, Gender, Manufacturer, SalesData, resources
from .permissions import IsApprovedAppUser
from .serializers import (
    ResourceSerializer, ManufacturerSerializer,
    CategorySerializer, GenderSerializer, SalesDataSerializer,
)

class ResourceViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = resources.objects.select_related("manufacturer", "category", "gender").order_by("-created_at")
    serializer_class = ResourceSerializer
    permission_classes = [IsApprovedAppUser]

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
