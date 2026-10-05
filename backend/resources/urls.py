from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, GenderViewSet, ManufacturerViewSet, ResourceViewSet, SalesDataViewSet

router = DefaultRouter()
router.register("resources", ResourceViewSet)
router.register("manufacturers", ManufacturerViewSet)
router.register("categories", CategoryViewSet)
router.register("genders", GenderViewSet)
router.register("sales", SalesDataViewSet)

urlpatterns = router.urls
