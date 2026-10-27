"""Medical records and prescriptions.

Access rules, checked on every request:
  * Doctors: records for their own appointments only (read and write).
  * Patients: their own records, and only after the doctor releases them.
  * Admins and everyone else: no access. Platform administration does not
    require reading clinical notes.
"""
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from accounts.models import Role
from accounts.permissions import IsDoctor, IsPatient

from .models import MedicalRecord, Prescription
from .serializers import MedicalRecordSerializer, PrescriptionSerializer


class IsCareParticipant(BasePermission):
    message = "Medical records are only available to the patient and their treating doctor."

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return IsDoctor().has_permission(request, view) or IsPatient().has_permission(request, view)
        return IsDoctor().has_permission(request, view)


def scope_records(user, qs, prefix=""):
    if user.role == Role.DOCTOR:
        return qs.filter(**{f"{prefix}appointment__doctor": user.doctor_profile})
    if user.role == Role.PATIENT:
        return qs.filter(**{
            f"{prefix}appointment__patient": user.patient_profile,
            f"{prefix}is_released": True,
        })
    raise PermissionDenied()


class MedicalRecordViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                           mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCareParticipant]
    serializer_class = MedicalRecordSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = {"appointment": ["exact"], "appointment__patient": ["exact"], "is_released": ["exact"]}
    search_fields = ["diagnosis", "appointment__reference", "appointment__patient__user__full_name"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        qs = MedicalRecord.objects.select_related(
            "appointment__doctor__user", "appointment__doctor__specialization", "appointment__patient__user"
        ).prefetch_related("prescriptions__items")
        return scope_records(self.request.user, qs)


class PrescriptionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                          viewsets.GenericViewSet):
    permission_classes = [IsCareParticipant]
    serializer_class = PrescriptionSerializer
    filterset_fields = {"medical_record": ["exact"], "medical_record__appointment__patient": ["exact"]}
    search_fields = ["items__medicine_name", "medical_record__appointment__reference"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        qs = Prescription.objects.select_related(
            "medical_record__appointment__doctor__user",
            "medical_record__appointment__doctor__specialization",
            "medical_record__appointment__patient__user",
        ).prefetch_related("items")
        return scope_records(self.request.user, qs, prefix="medical_record__").distinct()
