from django.db.models import Count, Max
from rest_framework import generics, mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from accounts.models import Role
from accounts.permissions import IsPatient

from .models import Patient
from .serializers import PatientCareSerializer, PatientSerializer


class PatientProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/patients/profile/ - the signed-in patient's own profile."""

    permission_classes = [IsPatient]
    serializer_class = PatientSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return Patient.objects.select_related("user").get(user=self.request.user)


class PatientViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Role-scoped patient directory.

    * Admin: every patient.
    * Doctor: only patients who have (or had) an appointment with them.
    * Patient: only themselves.
    """

    search_fields = ["user__full_name", "user__email", "user__phone"]
    ordering_fields = ["user__full_name", "created_at"]
    filterset_fields = ["gender"]

    def get_queryset(self):
        user = self.request.user
        qs = Patient.objects.select_related("user")
        if user.role == Role.ADMIN:
            return qs.annotate(appointment_count=Count("appointments"))
        if user.role == Role.DOCTOR and hasattr(user, "doctor_profile"):
            return (
                qs.filter(appointments__doctor=user.doctor_profile)
                .annotate(
                    appointment_count=Count("appointments"),
                    last_visit=Max("appointments__date"),
                )
                .distinct()
            )
        if user.role == Role.PATIENT:
            return qs.filter(user=user)
        raise PermissionDenied()

    def get_serializer_class(self):
        if self.request.user.role == Role.DOCTOR:
            return PatientCareSerializer
        return PatientSerializer
