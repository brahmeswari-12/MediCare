from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Role
from accounts.permissions import IsPatient

from . import services
from .filters import AppointmentFilter
from .models import Appointment, AppointmentStatus
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentDetailSerializer,
    AppointmentSerializer,
    AppointmentUpdateSerializer,
    CancelSerializer,
    RescheduleSerializer,
)


class AppointmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Appointments, scoped by role: patients see their own, doctors see those
    assigned to them, admins see all. Other users' appointments return 404."""

    permission_classes = [IsAuthenticated]
    filterset_class = AppointmentFilter
    search_fields = ["reference", "patient__user__full_name", "doctor__user__full_name"]
    # No view-level default ordering: the model orders newest first, and
    # ?scope=upcoming applies its own chronological order.
    ordering_fields = ["date", "start_time", "created_at", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related(
            "doctor__user", "doctor__specialization", "patient__user", "cancelled_by",
            "payment", "medical_record",
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("events__actor")
        if user.role == Role.ADMIN:
            return qs
        if user.role == Role.PATIENT and hasattr(user, "patient_profile"):
            return qs.filter(patient=user.patient_profile)
        if user.role == Role.DOCTOR and hasattr(user, "doctor_profile"):
            return qs.filter(doctor=user.doctor_profile)
        return qs.none()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AppointmentDetailSerializer
        return AppointmentSerializer

    def _respond(self, appointment, status_code=status.HTTP_200_OK):
        appointment = self.get_queryset().prefetch_related("events__actor").get(pk=appointment.pk)
        data = AppointmentDetailSerializer(appointment, context=self.get_serializer_context()).data
        return Response(data, status=status_code)

    def create(self, request):
        if not IsPatient().has_permission(request, self):
            raise PermissionDenied("Only patients can book appointments.")
        serializer = AppointmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        appointment = services.book_appointment(
            patient=request.user.patient_profile,
            doctor_id=data["doctor"],
            day=data["date"],
            start_time=data["start_time"],
            reason=data["reason"],
            actor=request.user,
        )
        return self._respond(appointment, status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        appointment = self.get_object()
        serializer = AppointmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data:
            raise ValidationError({"detail": "Nothing to update."})

        if "reason" in data:
            services.ensure_actor(request.user, appointment, [Role.PATIENT])
            if appointment.status not in (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED):
                raise ValidationError({"reason": ["Only active appointments can be edited."]})
            appointment.reason = data["reason"].strip()
            appointment.save(update_fields=["reason", "updated_at"])

        new_status = data.get("status")
        if new_status and new_status != appointment.status:
            if new_status == AppointmentStatus.CONFIRMED:
                return self.confirm(request, pk)
            if new_status == AppointmentStatus.COMPLETED:
                return self.complete(request, pk)
            if new_status == AppointmentStatus.CANCELLED:
                services.ensure_actor(request.user, appointment, [Role.PATIENT, Role.DOCTOR, Role.ADMIN])
                appointment = services.cancel_appointment(
                    appointment=appointment, actor=request.user, reason=data.get("cancellation_reason", "")
                )
            else:
                raise ValidationError({"status": ["An appointment cannot be moved back to pending."]})
        return self._respond(appointment)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        services.ensure_actor(request.user, appointment, [Role.PATIENT, Role.DOCTOR, Role.ADMIN])
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = services.cancel_appointment(
            appointment=appointment, actor=request.user, reason=serializer.validated_data["reason"]
        )
        return self._respond(appointment)

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        appointment = self.get_object()
        services.ensure_actor(request.user, appointment, [Role.PATIENT, Role.ADMIN])
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = services.reschedule_appointment(
            appointment=appointment,
            actor=request.user,
            day=serializer.validated_data["date"],
            start_time=serializer.validated_data["start_time"],
        )
        return self._respond(appointment)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        appointment = self.get_object()
        services.ensure_actor(request.user, appointment, [Role.DOCTOR, Role.ADMIN])
        appointment = services.confirm_appointment(appointment=appointment, actor=request.user)
        return self._respond(appointment)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        appointment = self.get_object()
        services.ensure_actor(request.user, appointment, [Role.DOCTOR])
        appointment = services.complete_appointment(appointment=appointment, actor=request.user)
        return self._respond(appointment)
