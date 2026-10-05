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


    @action(detail=True, methods=['patch'], url_path='inventory-settings')
    def inventory_settings(self, request, pk=None):
        input_serializer = InventorySettingsSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            try:
                resource = (
                    resources.objects.select_for_update()
                    .select_related('category', 'manufacturer', 'gender')
                    .get(pk=pk)
                )
            except resources.DoesNotExist as error:
                raise NotFound('Der Artikel wurde nicht gefunden.') from error

            update_fields = []
            previous_values = {
                field_name: getattr(resource, field_name)
                for field_name in input_serializer.validated_data
            }
            for field_name, value in input_serializer.validated_data.items():
                setattr(resource, field_name, value)
                update_fields.append(field_name)

            resource.save(update_fields=update_fields)
            field_labels = {
                'shelf_number': 'Regalnummer',
                'bin_number': 'Fachnummer',
                'reorder_threshold': 'Meldebestand',
            }
            changed_values = ', '.join(
                f'{field_labels[field_name]}: {previous_values[field_name] or "—"} → '
                f'{getattr(resource, field_name) or "—"}'
                for field_name in update_fields
            )
            schedule_inventory_notification(
                event='update',
                resource_name=resource.name,
                actor=request.user,
                details={'Änderungen': changed_values},
            )

        return Response(ResourceSerializer(resource).data)

    def destroy(self, request, *args, **kwargs):
        with transaction.atomic():
            resource = self.get_object()
            resource_name = resource.name
            resource_amount = resource.amount
            resource_location = f'{resource.shelf_number or "—"} / {resource.bin_number or "—"}'
            resource.delete()
            schedule_inventory_notification(
                event='delete',
                resource_name=resource_name,
                actor=request.user,
                details={
                    'Letzter Bestand': resource_amount,
                    'Letzter Lagerplatz': resource_location,
                },
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

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