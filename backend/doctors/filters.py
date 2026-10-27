import django_filters
from django.db.models import Q

from .models import Doctor, DoctorBlockedDate


class DoctorFilter(django_filters.FilterSet):
    specialization = django_filters.CharFilter(method="filter_specialization")
    hospital = django_filters.CharFilter(field_name="hospital", lookup_expr="icontains")
    location = django_filters.CharFilter(field_name="location", lookup_expr="icontains")
    name = django_filters.CharFilter(field_name="user__full_name", lookup_expr="icontains")
    min_fee = django_filters.NumberFilter(field_name="consultation_fee", lookup_expr="gte")
    max_fee = django_filters.NumberFilter(field_name="consultation_fee", lookup_expr="lte")
    available_on = django_filters.DateFilter(method="filter_available_on")
    approval_status = django_filters.CharFilter(field_name="approval_status")

    class Meta:
        model = Doctor
        fields = ["specialization", "hospital", "location", "name", "min_fee", "max_fee",
                  "available_on", "approval_status"]

    def filter_specialization(self, queryset, name, value):
        if value.isdigit():
            return queryset.filter(specialization_id=int(value))
        return queryset.filter(specialization__slug=value)

    def filter_available_on(self, queryset, name, value):
        """Doctors who work on that weekday and have not blocked the date."""
        blocked = DoctorBlockedDate.objects.filter(date=value).values("doctor_id")
        return (
            queryset.filter(Q(schedules__weekday=value.weekday()) & Q(schedules__is_active=True))
            .exclude(pk__in=blocked)
            .distinct()
        )
