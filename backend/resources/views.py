from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import (
    Category,
    Gender,
    InventorySale,
    Manufacturer,
    SalesData,
    StockMovement,
    resources,
)
from .notifications import schedule_inventory_notification
from .permissions import IsApprovedAppUser
from .assistant import answer_question
from .reporting import CENT, quarterly_sales, yearly_sales
from .serializers import (
    AssistantQuestionSerializer,
    CategorySerializer,
    GenderSerializer,
    InventorySettingsSerializer,
    InventorySaleSerializer,
    ManufacturerSerializer,
    RestockResourceSerializer,
    ResourceDetailsSerializer,
    ResourceSerializer,
    SalesDataSerializer,
    SellResourceSerializer,
    StockMovementSerializer,
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
    filter_backends = [SearchFilter]
    search_fields = [
        'gtin',
        'name',
        'desc',
        'size',
        'material',
        'category__name',
        'manufacturer__name',
        'manufacturer__location',
        'gender__name',
        'shelf_number',
        'bin_number',
    ]

    def perform_create(self, serializer):
        with transaction.atomic():
            resource = serializer.save()
            schedule_inventory_notification(
                event='create',
                resource_name=resource.name,
                actor=self.request.user,
                details={
                    'Bestand': resource.amount,
                    'Lagerplatz': f'{resource.shelf_number or "—"} / {resource.bin_number or "—"}',
                },
            )

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
                unit_price=resource.retail_price,
                stock_before=stock_before,
                stock_after=resource.amount,
                sold_by=request.user,
            )
            movement = StockMovement.objects.create(
                resource=resource,
                resource_name=resource.name,
                movement_type=StockMovement.MovementType.SALE,
                quantity=quantity,
                stock_before=stock_before,
                stock_after=resource.amount,
                performed_by=request.user,
            )
            schedule_inventory_notification(
                event='sale',
                resource_name=resource.name,
                actor=request.user,
                details={
                    'Verkaufte Menge': quantity,
                    'Bestand vorher': stock_before,
                    'Bestand danach': resource.amount,
                },
            )

        return Response(
            {
                'resource': ResourceSerializer(resource).data,
                'sale': InventorySaleSerializer(sale).data,
                'movement': StockMovementSerializer(movement).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        input_serializer = RestockResourceSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data
        quantity = data['quantity']
        purchase_date = data.get('purchase_date', timezone.localdate())

        with transaction.atomic():
            try:
                resource = (
                    resources.objects.select_for_update()
                    .select_related('category', 'manufacturer', 'gender')
                    .get(pk=pk)
                )
            except resources.DoesNotExist as error:
                raise NotFound('Der Artikel wurde nicht gefunden.') from error

            stock_before = resource.amount
            resource.amount += quantity
            resource.purchase_date = purchase_date
            update_fields = ['amount', 'purchase_date']

            for field_name in ('shelf_number', 'bin_number'):
                if field_name in data:
                    setattr(resource, field_name, data[field_name])
                    update_fields.append(field_name)

            resource.save(update_fields=update_fields)
            movement = StockMovement.objects.create(
                resource=resource,
                resource_name=resource.name,
                movement_type=StockMovement.MovementType.RESTOCK,
                quantity=quantity,
                stock_before=stock_before,
                stock_after=resource.amount,
                purchase_date=purchase_date,
                performed_by=request.user,
            )
            schedule_inventory_notification(
                event='restock',
                resource_name=resource.name,
                actor=request.user,
                details={
                    'Nachbestellte Menge': quantity,
                    'Bestand vorher': stock_before,
                    'Bestand danach': resource.amount,
                    'Einkaufsdatum': purchase_date.strftime('%d.%m.%Y'),
                    'Lagerplatz': f'{resource.shelf_number} / {resource.bin_number}',
                },
            )

        return Response(
            {
                'resource': ResourceSerializer(resource).data,
                'movement': StockMovementSerializer(movement).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['patch'], url_path='details')
    def details(self, request, pk=None):
        with transaction.atomic():
            try:
                resource = (
                    resources.objects.select_for_update()
                    .select_related('category', 'manufacturer', 'gender')
                    .get(pk=pk)
                )
            except resources.DoesNotExist as error:
                raise NotFound('Der Artikel wurde nicht gefunden.') from error

            input_serializer = ResourceDetailsSerializer(resource, data=request.data, partial=True)
            input_serializer.is_valid(raise_exception=True)
            field_labels = {
                'name': 'Name',
                'desc': 'Beschreibung',
                'size': 'Größe',
                'material': 'Material',
                'category': 'Kategorie',
                'manufacturer': 'Lieferant',
                'gender': 'Geschlecht',
            }
            previous_name = resource.name
            previous_values = {
                field_name: str(getattr(resource, field_name))
                for field_name in input_serializer.validated_data
            }
            input_serializer.save()

            changes = [
                f'{field_labels[field_name]}: {previous_value or "—"} → '
                f'{getattr(resource, field_name) or "—"}'
                for field_name, previous_value in previous_values.items()
                if previous_value != str(getattr(resource, field_name))
            ]
            if changes:
                schedule_inventory_notification(
                    event='update',
                    resource_name=previous_name,
                    actor=request.user,
                    details={'Änderungen': ', '.join(changes)},
                )

        return Response(ResourceSerializer(resource).data)

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
                'wholesale_price': 'WHS-Preis',
                'retail_price': 'RT-Preis',
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
    queryset = SalesData.objects.select_related('category').order_by('year', 'quarter', 'category__name')
    serializer_class = SalesDataSerializer
    permission_classes = [IsApprovedAppUser]


class InventorySaleViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = InventorySale.objects.select_related('resource', 'sold_by').order_by('-sold_at')
    serializer_class = InventorySaleSerializer
    permission_classes = [IsApprovedAppUser]

    def destroy(self, request, pk=None):
        """Cancel (storno) a sale: remove it and put the units back into stock."""
        with transaction.atomic():
            try:
                # No select_related here: sold_by is nullable, and PostgreSQL refuses
                # FOR UPDATE on the nullable side of an outer join.
                sale = InventorySale.objects.select_for_update().get(pk=pk)
            except InventorySale.DoesNotExist as error:
                raise NotFound('Der Verkauf wurde nicht gefunden.') from error

            resource = None
            movement = None
            details = {
                'Stornierte Menge': sale.quantity,
                'Ursprünglich verkauft von': sale.sold_by.username if sale.sold_by else 'Unbekannt',
                'Verkaufszeitpunkt': timezone.localtime(sale.sold_at).strftime('%d.%m.%Y %H:%M'),
            }
            if sale.resource_id is not None:
                resource = (
                    resources.objects.select_for_update()
                    .select_related('category', 'manufacturer', 'gender')
                    .get(pk=sale.resource_id)
                )
                stock_before = resource.amount
                resource.amount += sale.quantity
                resource.save(update_fields=['amount'])
                movement = StockMovement.objects.create(
                    resource=resource,
                    resource_name=resource.name,
                    movement_type=StockMovement.MovementType.CANCELLATION,
                    quantity=sale.quantity,
                    stock_before=stock_before,
                    stock_after=resource.amount,
                    performed_by=request.user,
                )
                details['Bestand vorher'] = stock_before
                details['Bestand danach'] = resource.amount
            else:
                details['Bestand'] = 'Artikel wurde bereits gelöscht, kein Bestand zurückgebucht'

            resource_name = sale.resource_name
            sale.delete()
            schedule_inventory_notification(
                event='sale_cancel',
                resource_name=resource_name,
                actor=request.user,
                details=details,
            )

        return Response(
            {
                'resource': ResourceSerializer(resource).data if resource else None,
                'movement': StockMovementSerializer(movement).data if movement else None,
            }
        )


class StockMovementViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = StockMovement.objects.select_related('resource', 'performed_by').order_by(
        '-occurred_at'
    )
    serializer_class = StockMovementSerializer
    permission_classes = [IsApprovedAppUser]


class SalesReportView(APIView):
    """Units and revenue per quarter and per year.

    Combines the historical quarterly figures (SalesData) with the sales
    registered in the app (InventorySale), so the analysis and the dashboard
    show one continuous history.
    """

    permission_classes = [IsApprovedAppUser]

    def get(self, request):
        quarters = quarterly_sales()

        def source(sources):
            return 'mixed' if len(sources) > 1 else next(iter(sources))

        def serialize(entry, **extra):
            return {
                **extra,
                'units': entry['units'],
                'revenue': str(entry['revenue'].quantize(CENT)),
                'source': source(entry['sources']),
            }

        return Response(
            {
                'quarters': [
                    serialize(period, year=period['year'], quarter=period['quarter'])
                    for period in quarters
                ],
                'years': [serialize(year, year=year['year']) for year in yearly_sales(quarters)],
                'total_units': sum(period['units'] for period in quarters),
                'total_revenue': str(
                    sum((period['revenue'] for period in quarters), Decimal('0')).quantize(CENT)
                ),
            }
        )


class AssistantView(APIView):
    """KI-Assistent: best sellers and purchase tips from the sales data."""

    permission_classes = [IsApprovedAppUser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'assistant'

    def post(self, request):
        serializer = AssistantQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = answer_question(
            serializer.validated_data['question'],
            serializer.validated_data['history'],
        )
        return Response(
            {
                'answer': result.answer,
                'mode': result.mode,
                'model': result.model,
                'notice': result.notice,
            }
        )
