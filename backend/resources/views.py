from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny
from .models import resources
from .serializers import ResourceSerializer


class ResourceViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = resources.objects.all()
    serializer_class = ResourceSerializer
    permission_classes = [AllowAny]
