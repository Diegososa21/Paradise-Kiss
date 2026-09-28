from rest_framework import serializers

from .models import resources


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = resources
        fields = [
            'id',
            'name',
            'desc',
            'size',
            'category',
            'manufacurer',
            'material',
            'gender',
            'created_at',
        ]
