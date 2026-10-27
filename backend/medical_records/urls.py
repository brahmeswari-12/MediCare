from rest_framework.routers import SimpleRouter

from .views import MedicalRecordViewSet, PrescriptionViewSet

router = SimpleRouter()
router.register("medical-records", MedicalRecordViewSet, basename="medical-record")
router.register("prescriptions", PrescriptionViewSet, basename="prescription")

urlpatterns = router.urls
