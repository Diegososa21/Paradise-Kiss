from django.conf import settings
from django.db import transaction
from rest_framework import mixins, viewsets

from .models import Category, Gender, Manufacturer, SalesData, resources
from .notifications import mail_group
from .permissions import IsApprovedAppUser
from .serializers import (
    ResourceSerializer, ManufacturerSerializer,
    CategorySerializer, GenderSerializer, SalesDataSerializer,
)


def _display_name(user):
    return user.get_full_name().strip() or user.username


class ResourceViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = resources.objects.select_related(
        "manufacturer", "category", "gender"
    ).order_by("-created_at")
    serializer_class = ResourceSerializer
    permission_classes = [IsApprovedAppUser]

    def perform_create(self, serializer):
        instance = serializer.save()
        who = _display_name(self.request.user)
        user = self.request.user

        transaction.on_commit(lambda: mail_group(
            settings.NOTIFY_GROUPS["created"],
            "Neuer Artikel",
            f"{who} hat '{instance.name}' angelegt.",
            exclude_user=user,
        ))

    def perform_update(self, serializer):
        # Alten Stand VOR dem Speichern lesen, danach ist er überschrieben
        old = serializer.instance
        was_deleted = getattr(old, "is_deleted", False)
        old_values = {f.name: getattr(old, f.attname) for f in old._meta.fields}

        instance = serializer.save()
        who = _display_name(self.request.user)
        user = self.request.user

        if not was_deleted and getattr(instance, "is_deleted", False):
            subject = "Artikel gelöscht"
            text = f"{who} hat '{instance.name}' gelöscht."
            group = settings.NOTIFY_GROUPS["deleted"]
        else:
            changed = [
                name for name, value in old_values.items()
                if value != getattr(instance, instance._meta.get_field(name).attname)
            ]
            if not changed:
                return
            subject = "Artikel geändert"
            text = f"{who} hat '{instance.name}' geändert (Felder: {', '.join(changed)})."
            group = settings.NOTIFY_GROUPS["updated"]

        transaction.on_commit(lambda: mail_group(
            group, subject, text, exclude_user=user
        ))


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
    queryset = SalesData.objects.select_related("category").order_by("year", "quarter", "category__name")
    serializer_class = SalesDataSerializer
    permission_classes = [IsApprovedAppUser]