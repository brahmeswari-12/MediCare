from django.contrib import admin

from .models import Doctor, DoctorBlockedDate, DoctorSchedule, Specialization


@admin.register(Specialization)
class SpecializationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active"]
    prepopulated_fields = {"slug": ("name",)}


class ScheduleInline(admin.TabularInline):
    model = DoctorSchedule
    extra = 0


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ["__str__", "specialization", "hospital", "location", "approval_status"]
    list_filter = ["approval_status", "specialization"]
    search_fields = ["user__full_name", "user__email", "license_number", "hospital"]
    inlines = [ScheduleInline]


@admin.register(DoctorBlockedDate)
class BlockedDateAdmin(admin.ModelAdmin):
    list_display = ["doctor", "date", "reason"]
