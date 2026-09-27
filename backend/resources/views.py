from rest_framework import viewsets
from .models import resources
from .serializers import ResourceSerializer

class ResourceViewSet(viewsets.ModelViewSet):
    queryset = resources.objects.all()
    serializer_class = ResourceSerializer