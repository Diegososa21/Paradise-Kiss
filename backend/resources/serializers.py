from rest_framework import serializers
from .models import resources

class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = resources
        fields = ['id', 'name', 'email', 'created_at']