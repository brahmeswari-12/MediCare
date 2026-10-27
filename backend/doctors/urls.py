from rest_framework.routers import SimpleRouter

from .views import BlockedDateViewSet, DoctorViewSet, ScheduleViewSet, SpecializationViewSet

router = SimpleRouter()
router.register("doctors", DoctorViewSet, basename="doctor")
router.register("specializations", SpecializationViewSet, basename="specialization")
# Registered before "schedules" so "blocked-dates" is not captured as a schedule id.
router.register("schedules/blocked-dates", BlockedDateViewSet, basename="blocked-date")
router.register("schedules", ScheduleViewSet, basename="schedule")

urlpatterns = router.urls
