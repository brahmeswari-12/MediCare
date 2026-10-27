from rest_framework.routers import SimpleRouter

from .views import AppointmentViewSet

router = SimpleRouter()
router.register("appointments", AppointmentViewSet, basename="appointment")

urlpatterns = router.urls
