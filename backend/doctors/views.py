from datetime import date as date_cls, timedelta

from django.db.models import Count, ProtectedError, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Role
from accounts.permissions import IsAdminOrReadOnly, IsAdminRole, IsDoctor

from .filters import DoctorFilter
from .models import ApprovalStatus, Doctor, DoctorBlockedDate, DoctorSchedule, Specialization
from .serializers import (
    AdminDoctorCreateSerializer,
    BlockedDateSerializer,
    DayAvailabilitySerializer,
    DoctorScheduleSerializer,
    DoctorSelfSerializer,
    DoctorSerializer,
    PublicDoctorSerializer,
    SpecializationSerializer,
)
from .services import booking_window, compute_availability, day_availability


def _parse_date(value, field="date"):
    try:
        return date_cls.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({field: ["Provide a valid date in YYYY-MM-DD format."]})


def _is_admin(user):
    return user.is_authenticated and user.role == Role.ADMIN


class SpecializationViewSet(viewsets.ModelViewSet):
    """Public read; admin-managed. Deleting is refused while doctors reference it."""

    permission_classes = [IsAdminOrReadOnly]
    serializer_class = SpecializationSerializer
    pagination_class = None
    search_fields = ["name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Specialization.objects.annotate(
            doctor_count=Count(
                "doctors",
                filter=Q(doctors__approval_status=ApprovalStatus.APPROVED, doctors__user__is_active=True),
            )
        )
        if not _is_admin(self.request.user):
            qs = qs.filter(is_active=True)
        return qs.order_by("name")

    def destroy(self, request, *args, **kwargs):
        specialization = self.get_object()
        count = specialization.doctors.count()
        if count:
            return Response(
                {"detail": f"{count} doctor(s) use this specialization. Reassign them or deactivate "
                           f"the specialization instead of deleting it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            specialization.delete()
        except ProtectedError:
            return Response({"detail": "This specialization is in use and cannot be deleted."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DoctorViewSet(viewsets.ModelViewSet):
    """Doctor directory and profiles.

    Read endpoints are public and only expose approved, active doctors (admins
    see all). Creating and disabling doctors is admin-only. A doctor may update
    their own profile through PATCH /api/doctors/me/ (or /api/doctors/{own id}/).
    """

    filterset_class = DoctorFilter
    search_fields = ["user__full_name", "specialization__name", "hospital", "location", "qualifications"]
    ordering_fields = ["consultation_fee", "experience_years", "user__full_name", "created_at"]
    ordering = ["user__full_name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "schedule", "availability", "available_dates"):
            return [AllowAny()]
        if self.action in ("create", "destroy"):
            return [IsAdminRole()]
        if self.action == "me":
            return [IsDoctor()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Doctor.objects.select_related("user", "specialization").prefetch_related("schedules")
        if _is_admin(user):
            return qs
        visible = Q(approval_status=ApprovalStatus.APPROVED, user__is_active=True)
        if user.is_authenticated and user.role == Role.DOCTOR:
            visible |= Q(user=user)
        return qs.filter(visible)

    def get_serializer_class(self):
        user = self.request.user
        if self.action == "create":
            return AdminDoctorCreateSerializer
        if self.action == "me":
            return DoctorSelfSerializer
        if _is_admin(user):
            return DoctorSerializer
        if self.action == "partial_update":
            return DoctorSelfSerializer
        if self.action == "retrieve" and user.is_authenticated and user.role == Role.DOCTOR:
            if str(self.kwargs.get("pk")) == str(getattr(getattr(user, "doctor_profile", None), "pk", "")):
                return DoctorSelfSerializer
        return PublicDoctorSerializer

    def partial_update(self, request, *args, **kwargs):
        doctor = self.get_object()
        if not _is_admin(request.user) and doctor.user_id != request.user.id:
            raise PermissionDenied("You can only edit your own profile.")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Soft delete: disables the account so appointment history is preserved."""
        doctor = self.get_object()
        doctor.user.is_active = False
        doctor.user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        doctor = request.user.doctor_profile
        if request.method == "GET":
            return Response(self.get_serializer(doctor).data)
        serializer = self.get_serializer(doctor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        doctor = self.get_object()
        is_owner = request.user.is_authenticated and doctor.user_id == request.user.id
        privileged = is_owner or _is_admin(request.user)
        schedules = doctor.schedules.all() if privileged else doctor.schedules.filter(is_active=True)
        today, last_day = booking_window()
        blocked = doctor.blocked_dates.filter(date__gte=today)
        if not privileged:
            blocked = blocked.filter(date__lte=last_day)
        return Response({
            "doctor_id": doctor.id,
            "max_appointments_per_day": doctor.max_appointments_per_day,
            "schedules": DoctorScheduleSerializer(schedules, many=True).data,
            "blocked_dates": (
                BlockedDateSerializer(blocked, many=True).data
                if privileged else [{"date": b.date} for b in blocked]
            ),
        })

    @action(detail=True, methods=["get"])
    def availability(self, request, pk=None):
        doctor = self.get_object()
        day = _parse_date(request.query_params.get("date"))
        result = day_availability(doctor, day)
        return Response(DayAvailabilitySerializer(result).data)

    @action(detail=True, methods=["get"], url_path="available-dates")
    def available_dates(self, request, pk=None):
        """Calendar helper: which dates in a range have at least one free slot."""
        doctor = self.get_object()
        today, _ = booking_window()
        start = _parse_date(request.query_params["start"], "start") if request.query_params.get("start") else today
        try:
            days = min(max(int(request.query_params.get("days", 31)), 1), 62)
        except ValueError:
            raise ValidationError({"days": ["Must be a number."]})
        dates = [start + timedelta(days=i) for i in range(days)]
        results = compute_availability(doctor, dates)
        return Response([
            {
                "date": d.isoformat(),
                "available": results[d]["available"],
                "free_slots": sum(1 for s in results[d]["slots"] if s["available"]),
            }
            for d in dates
        ])


class DoctorOwnedMixin:
    """Restricts a viewset to the signed-in doctor's own rows."""

    permission_classes = [IsDoctor]

    def get_doctor(self):
        return self.request.user.doctor_profile

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.user.is_authenticated and hasattr(self.request.user, "doctor_profile"):
            context["doctor"] = self.request.user.doctor_profile
        return context

    def perform_create(self, serializer):
        serializer.save(doctor=self.get_doctor())


class ScheduleViewSet(DoctorOwnedMixin, viewsets.ModelViewSet):
    serializer_class = DoctorScheduleSerializer
    pagination_class = None
    filter_backends = []
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return DoctorSchedule.objects.filter(doctor=self.get_doctor()).order_by("weekday", "start_time")


class BlockedDateViewSet(DoctorOwnedMixin, mixins.ListModelMixin, mixins.CreateModelMixin,
                         mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = BlockedDateSerializer
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        qs = DoctorBlockedDate.objects.filter(doctor=self.get_doctor())
        if self.action == "list" and self.request.query_params.get("include_past") != "true":
            qs = qs.filter(date__gte=booking_window()[0])
        return qs.order_by("date")
