from rest_framework.routers import SimpleRouter

from .views import HospitalSupplyViewSet

router = SimpleRouter()
router.register("inventory/supplies", HospitalSupplyViewSet, basename="supply")

urlpatterns = router.urls
