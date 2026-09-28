from rest_framework.routers import DefaultRouter
from .views import ResourceViewSet, ManufacturerViewSet, GenderViewSet, CategoryViewSet

router = DefaultRouter()
router.register("resources", ResourceViewSet)
router.register("manufacturers", ManufacturerViewSet)
router.register("categories", CategoryViewSet)
router.register("genders", GenderViewSet)

urlpatterns = router.urls