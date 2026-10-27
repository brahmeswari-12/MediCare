import django_filters
from django.db.models import Q
from django.utils import timezone

from .models import Appointment, AppointmentStatus


class AppointmentFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(method="filter_status", help_text="Comma separated, e.g. PENDING,CONFIRMED")
    date = django_filters.DateFilter(field_name="date")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    doctor = django_filters.NumberFilter(field_name="doctor_id")
    patient = django_filters.NumberFilter(field_name="patient_id")
    specialization = django_filters.CharFilter(method="filter_specialization")
    scope = django_filters.CharFilter(method="filter_scope", help_text="upcoming | past | today")

    class Meta:
        model = Appointment
        fields = ["status", "date", "date_from", "date_to", "doctor", "patient", "specialization", "scope"]

    def filter_status(self, queryset, name, value):
        statuses = [s.strip().upper() for s in value.split(",") if s.strip()]
        valid = [s for s in statuses if s in AppointmentStatus.values]
        return queryset.filter(status__in=valid) if valid else queryset.none()

    def filter_specialization(self, queryset, name, value):
        if value.isdigit():
            return queryset.filter(doctor__specialization_id=int(value))
        return queryset.filter(doctor__specialization__slug=value)

    def filter_scope(self, queryset, name, value):
        now = timezone.localtime()
        today = now.date()
        active = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
        if value == "upcoming":
            return queryset.filter(
                Q(date__gt=today) | Q(date=today, end_time__gt=now.time()), status__in=active
            ).order_by("date", "start_time")
        if value == "past":
            return queryset.filter(
                Q(date__lt=today)
                | Q(date=today, end_time__lte=now.time())
                | Q(status__in=[AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])
            ).order_by("-date", "-start_time")
        if value == "today":
            return queryset.filter(date=today).order_by("start_time")
        return queryset
