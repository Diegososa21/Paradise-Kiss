from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AssistantView,
    CategoryViewSet,
    GenderViewSet,
    InventorySaleViewSet,
    ManufacturerViewSet,
    ResourceViewSet,
    SalesDataViewSet,
    SalesReportView,
    StockMovementViewSet,
)

router = DefaultRouter()
router.register("resources", ResourceViewSet)
router.register("manufacturers", ManufacturerViewSet)
router.register("categories", CategoryViewSet)
router.register("genders", GenderViewSet)
router.register("sales", SalesDataViewSet)
router.register("inventory-sales", InventorySaleViewSet)
router.register("stock-movements", StockMovementViewSet)

urlpatterns = [
    path('sales-report/', SalesReportView.as_view(), name='sales-report'),
    path('assistant/', AssistantView.as_view(), name='assistant'),
    *router.urls,
]
