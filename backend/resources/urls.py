from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    GenderViewSet,
    InventorySaleViewSet,
    ManufacturerViewSet,
    ResourceViewSet,
    SalesDataViewSet,
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

urlpatterns = router.urls
