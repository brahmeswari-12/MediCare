from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["appointment", "amount", "currency", "status", "provider", "paid_at"]
    list_filter = ["status", "provider"]
