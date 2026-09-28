from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny
from .models import resources, Manufacturer, Category, Gender
from .serializers import (
    ResourceSerializer, ManufacturerSerializer,
    CategorySerializer, GenderSerializer,
)

class ResourceViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = resources.objects.select_related("manufacturer", "category", "gender")
    serializer_class = ResourceSerializer
    permission_classes = [AllowAny]

class ManufacturerViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Manufacturer.objects.all()
    serializer_class = ManufacturerSerializer
    permission_classes = [AllowAny]

class CategoryViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

class GenderViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Gender.objects.all()
    serializer_class = GenderSerializer
    permission_classes = [AllowAny]