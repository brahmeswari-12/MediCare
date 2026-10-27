from django.contrib import admin

from .models import Appointment, AppointmentEvent


class EventInline(admin.TabularInline):
    model = AppointmentEvent
    extra = 0
    readonly_fields = ["action", "from_status", "to_status", "actor", "note", "created_at"]


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ["reference", "patient", "doctor", "date", "start_time", "status"]
    list_filter = ["status", "date"]
    search_fields = ["reference", "patient__user__full_name", "doctor__user__full_name"]
    readonly_fields = ["reference", "slot_key"]
    inlines = [EventInline]
