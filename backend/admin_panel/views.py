"""Administrator-only management endpoints and dashboard statistics.

These reuse the domain serializers and services of the other apps; they only
add admin scoping and admin-specific actions (approve, reject, disable, enable).
"""
from datetime import timedelta

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from accounts.serializers import PatientRegistrationSerializer
from appointments.models import Appointment, AppointmentStatus
from appointments.serializers import AppointmentSerializer
from appointments.views import AppointmentViewSet
from doctors.filters import DoctorFilter
from doctors.models import ApprovalStatus, Doctor
from doctors.serializers import DoctorSerializer
from inventory.models import HospitalSupply
from patients.models import Patient
from patients.serializers import PatientSerializer
from payments.models import Payment, PaymentStatus


class DashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        appointments = Appointment.objects.all()
        by_status = dict(appointments.values_list("status").annotate(n=Count("id")).values_list("status", "n"))

        start = today - timedelta(days=13)
        daily = dict(
            appointments.filter(date__gte=start, date__lte=today)
            .values_list("date").annotate(n=Count("id")).values_list("date", "n")
        )
        last_14_days = [
            {"date": (start + timedelta(days=i)).isoformat(), "count": daily.get(start + timedelta(days=i), 0)}
            for i in range(14)
        ]

        by_specialization = list(
            appointments.values(name=F("doctor__specialization__name"))
            .annotate(count=Count("id")).order_by("-count")[:8]
        )

        recent = (
            appointments.select_related("doctor__user", "doctor__specialization", "patient__user",
                                        "payment", "medical_record", "cancelled_by")
            .order_by("-created_at")[:6]
        )

        paid = Payment.objects.filter(status=PaymentStatus.PAID).aggregate(total=Sum("amount"))["total"]

        return Response({
            "patients": {
                "active": Patient.objects.filter(user__is_active=True).count(),
                "total": Patient.objects.count(),
            },
            "doctors": {
                "approved": Doctor.objects.bookable().count(),
                "pending": Doctor.objects.filter(approval_status=ApprovalStatus.PENDING).count(),
                "total": Doctor.objects.count(),
            },
            "appointments": {
                "total": appointments.count(),
                "today": appointments.filter(date=today).count(),
                "pending": by_status.get(AppointmentStatus.PENDING, 0),
                "confirmed": by_status.get(AppointmentStatus.CONFIRMED, 0),
                "completed": by_status.get(AppointmentStatus.COMPLETED, 0),
                "cancelled": by_status.get(AppointmentStatus.CANCELLED, 0),
            },
            "appointments_last_14_days": last_14_days,
            "appointments_by_specialization": by_specialization,
            "payments": {"recorded_paid_total": str(paid or 0), "note": "Includes mock (non-real) payments."},
            "inventory": {
                "items": HospitalSupply.objects.count(),
                "low_stock": HospitalSupply.objects.filter(quantity__lte=F("minimum_stock_level")).count(),
            },
            "recent_appointments": AppointmentSerializer(recent, many=True, context={"request": request}).data,
        })


class AccountToggleMixin:
    """disable/enable actions that flip User.is_active instead of deleting rows,
    so appointment history is preserved."""

    def _set_active(self, request, active):
        obj = self.get_object()
        obj.user.is_active = active
        obj.user.save(update_fields=["is_active"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        return self._set_active(request, False)

    @action(detail=True, methods=["post"])
    def enable(self, request, pk=None):
        return self._set_active(request, True)


class AdminPatientViewSet(AccountToggleMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                          mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    search_fields = ["user__full_name", "user__email", "user__phone"]
    ordering_fields = ["user__full_name", "created_at"]
    filterset_fields = {"gender": ["exact"], "user__is_active": ["exact"]}
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return Patient.objects.select_related("user").annotate(appointment_count=Count("appointments"))

    def get_serializer_class(self):
        if self.action == "create":
            return PatientRegistrationSerializer
        return PatientWithStatsSerializer

    def create(self, request, *args, **kwargs):
        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        patient = self.get_queryset().get(user=user)
        return Response(PatientWithStatsSerializer(patient).data, status=status.HTTP_201_CREATED)


class PatientWithStatsSerializer(PatientSerializer):
    appointment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ["appointment_count"]


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class AdminDoctorSerializer(DoctorSerializer):
    appointment_count = serializers.IntegerField(read_only=True, default=0)
    schedule_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(DoctorSerializer.Meta):
        fields = DoctorSerializer.Meta.fields + ["appointment_count", "schedule_count"]


class AdminDoctorViewSet(AccountToggleMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                         mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Doctor management. New doctor accounts are created via POST /api/doctors/."""

    permission_classes = [IsAdminRole]
    serializer_class = AdminDoctorSerializer
    filterset_class = DoctorFilter
    search_fields = ["user__full_name", "user__email", "license_number", "hospital", "specialization__name"]
    ordering_fields = ["user__full_name", "created_at", "consultation_fee"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return Doctor.objects.select_related("user", "specialization").annotate(
            appointment_count=Count("appointments", distinct=True),
            schedule_count=Count("schedules", distinct=True),
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        doctor = self.get_object()
        doctor.approval_status = ApprovalStatus.APPROVED
        doctor.rejection_reason = ""
        doctor.approved_at = timezone.now()
        doctor.save(update_fields=["approval_status", "rejection_reason", "approved_at", "updated_at"])
        if not doctor.user.is_active:
            doctor.user.is_active = True
            doctor.user.save(update_fields=["is_active"])
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        doctor = self.get_object()
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        active = doctor.appointments.filter(
            status__in=[AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED], date__gte=timezone.localdate()
        ).count()
        if active:
            return Response(
                {"detail": f"This doctor has {active} upcoming appointment(s). Cancel them before rejecting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doctor.approval_status = ApprovalStatus.REJECTED
        doctor.rejection_reason = serializer.validated_data["reason"]
        doctor.approved_at = None
        doctor.save(update_fields=["approval_status", "rejection_reason", "approved_at", "updated_at"])
        return Response(self.get_serializer(self.get_object()).data)


class AdminAppointmentViewSet(AppointmentViewSet):
    """Read-only admin view over all appointments. Cancelling uses
    POST /api/appointments/{id}/cancel/, which admins are allowed to call."""

    permission_classes = [IsAdminRole]
    http_method_names = ["get", "head", "options"]
