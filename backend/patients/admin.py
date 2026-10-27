from django.contrib import admin

from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ["__str__", "gender", "date_of_birth"]
    search_fields = ["user__full_name", "user__email"]
