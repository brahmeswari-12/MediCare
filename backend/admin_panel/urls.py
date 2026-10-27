from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import AdminAppointmentViewSet, AdminDoctorViewSet, AdminPatientViewSet, DashboardView

router = SimpleRouter()
router.register("patients", AdminPatientViewSet, basename="admin-patient")
router.register("doctors", AdminDoctorViewSet, basename="admin-doctor")
router.register("appointments", AdminAppointmentViewSet, basename="admin-appointment")

urlpatterns = [path("dashboard/", DashboardView.as_view(), name="admin-dashboard")] + router.urls
